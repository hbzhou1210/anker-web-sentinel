import { Browser, Page } from 'playwright';
import browserPool from '../automation/BrowserPool.js';
import uiTestingService from '../automation/UITestingService.js';
import performanceAnalysisService from '../performance/PerformanceAnalysisService.js';
import screenshotService from '../automation/ScreenshotService.js';
import testRequestRepository from '../models/repositories/InMemoryTestRequestRepository.js';
import testReportRepository from '../models/repositories/BitableTestReportRepository.js';
import { TestRequestStatus, TestReport, TestResultStatus, UITestResult, PerformanceResult, RenderingSnapshot, PerformanceTestMode, MetricUnit } from '../models/entities.js';
import { emailService } from './EmailService.js';
import feishuApiService from './FeishuApiService.js';
import { pageSpeedService } from './PageSpeedService.js';

export class TestExecutionService {
  // Execute PageSpeed Insights test (no Playwright needed)
  private async executePageSpeedTest(url: string, strategy: 'mobile' | 'desktop' = 'desktop') {
    console.log(`[PageSpeed Mode] Running PageSpeed Insights test for ${url}`);
    const pageSpeedData = await pageSpeedService.runPageSpeedTest(url, strategy);

    // Convert PageSpeed metrics to PerformanceResult format for compatibility
    const performanceResults: PerformanceResult[] = [
      {
        id: '',
        testReportId: '',
        metricName: 'loadTime' as any,
        measuredValue: pageSpeedData.metrics.speedIndex,
        unit: MetricUnit.Milliseconds,
        threshold: 3400,
        status: pageSpeedData.metrics.speedIndex <= 3400 ? TestResultStatus.Pass : TestResultStatus.Fail,
      },
    ];

    return {
      pageSpeedData,
      performanceResults,
    };
  }

  // Upload base64 screenshot to Feishu and return image_key
  private async uploadScreenshotToFeishu(base64Data: string, filename: string): Promise<string> {
    try {
      // Remove data URL prefix (e.g., "data:image/webp;base64,")
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Content, 'base64');

      // Upload to Feishu
      const imageKey = await feishuApiService.uploadImage(imageBuffer, filename);
      console.log(`  ✓ Uploaded ${filename} to Feishu: ${imageKey}`);
      return imageKey;
    } catch (error) {
      console.error(`  ✗ Failed to upload ${filename} to Feishu:`, error);
      throw error;
    }
  }

  // Capture rendering process screenshots
  private async captureRenderingSnapshots(page: Page, url: string): Promise<RenderingSnapshot[]> {
    const snapshots: RenderingSnapshot[] = [];
    const navigationStartTime = Date.now();

    try {
      console.log('📸 Capturing rendering process screenshots...');

      // 1. Initial state (right after navigation commit)
      const initialScreenshotBase64 = await screenshotService.captureFullPageBase64(page);
      const initialImageKey = await this.uploadScreenshotToFeishu(initialScreenshotBase64, 'rendering_initial.webp');
      snapshots.push({
        stage: 'initial',
        stageName: '初始加载',
        timestamp: Date.now() - navigationStartTime,
        screenshotUrl: initialImageKey,
        metrics: {
          description: '页面开始加载时的初始状态'
        }
      });
      console.log('  ✓ Captured initial state');

      // 2. Wait for FCP (First Contentful Paint) and capture
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
      const fcpScreenshotBase64 = await screenshotService.captureFullPageBase64(page);
      const fcpImageKey = await this.uploadScreenshotToFeishu(fcpScreenshotBase64, 'rendering_fcp.webp');
      snapshots.push({
        stage: 'fcp',
        stageName: '首次内容渲染 (FCP)',
        timestamp: Date.now() - navigationStartTime,
        screenshotUrl: fcpImageKey,
        metrics: {
          description: '首次绘制内容到屏幕的时刻'
        }
      });
      console.log('  ✓ Captured FCP state');

      // 3. Wait for DOM Load and capture
      await page.waitForLoadState('load', { timeout: 15000 });
      const domloadScreenshotBase64 = await screenshotService.captureFullPageBase64(page);
      const domloadImageKey = await this.uploadScreenshotToFeishu(domloadScreenshotBase64, 'rendering_domload.webp');
      snapshots.push({
        stage: 'domload',
        stageName: 'DOM 加载完成',
        timestamp: Date.now() - navigationStartTime,
        screenshotUrl: domloadImageKey,
        metrics: {
          description: 'DOM 树构建完成,初始脚本已执行'
        }
      });
      console.log('  ✓ Captured DOM load state');

      // 4. Wait for network idle (LCP approximate) and capture
      try {
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        const lcpScreenshotBase64 = await screenshotService.captureFullPageBase64(page);
        const lcpImageKey = await this.uploadScreenshotToFeishu(lcpScreenshotBase64, 'rendering_lcp.webp');
        snapshots.push({
          stage: 'lcp',
          stageName: '最大内容渲染 (LCP)',
          timestamp: Date.now() - navigationStartTime,
          screenshotUrl: lcpImageKey,
          metrics: {
            description: '最大的内容元素渲染完成'
          }
        });
        console.log('  ✓ Captured LCP state');
      } catch (error) {
        console.warn('  ⚠ Network idle timeout, capturing current state as LCP');
        const lcpScreenshotBase64 = await screenshotService.captureFullPageBase64(page);
        const lcpImageKey = await this.uploadScreenshotToFeishu(lcpScreenshotBase64, 'rendering_lcp.webp');
        snapshots.push({
          stage: 'lcp',
          stageName: '最大内容渲染 (LCP)',
          timestamp: Date.now() - navigationStartTime,
          screenshotUrl: lcpImageKey,
          metrics: {
            description: '最大的内容元素渲染完成（网络未完全空闲）'
          }
        });
      }

      // 5. Final state after additional wait
      await page.waitForTimeout(2000);
      const finalScreenshotBase64 = await screenshotService.captureFullPageBase64(page);
      const finalImageKey = await this.uploadScreenshotToFeishu(finalScreenshotBase64, 'rendering_fullyloaded.webp');
      snapshots.push({
        stage: 'fullyloaded',
        stageName: '完全加载',
        timestamp: Date.now() - navigationStartTime,
        screenshotUrl: finalImageKey,
        metrics: {
          description: '页面完全加载,包括异步内容'
        }
      });
      console.log('  ✓ Captured fully loaded state');

      console.log(`✓ Captured ${snapshots.length} rendering snapshots`);
      return snapshots;

    } catch (error) {
      console.warn('⚠ Failed to capture some rendering snapshots:', error);
      // Return whatever snapshots we managed to capture
      return snapshots;
    }
  }

  // Execute complete test for a given test request
  async executeTest(
    testRequestId: string,
    url: string,
    config?: {
      timeout?: number;
      waitTime?: number;
      performanceTestMode?: PerformanceTestMode;
      enableWebPageTest?: boolean;  // 是否启用 WebPageTest API
      enablePageSpeed?: boolean;     // 是否启用 PageSpeed API
      pageSpeedStrategy?: 'mobile' | 'desktop';  // PageSpeed 设备策略
      webPageTestStrategy?: 'mobile' | 'desktop';  // WebPageTest 设备策略
      deviceStrategy?: 'mobile' | 'desktop';  // 兼容旧版本的设备策略
      testOptions?: {
        links?: boolean;
        forms?: boolean;
        buttons?: boolean;
        images?: boolean;
        performance?: boolean;
      };
    }
  ): Promise<TestReport> {
    const startTime = Date.now();

    try {
      // Update status to running
      await testRequestRepository.updateStatus(testRequestId, TestRequestStatus.Running);
      console.log(`[TestExecution] Starting test execution for ${url}`);
      console.log(`[TestExecution] Config received:`, JSON.stringify(config, null, 2));

      const performanceTestMode = config?.performanceTestMode || PerformanceTestMode.WebPageTest;
      const testOptions = config?.testOptions || {
        links: true,
        forms: true,
        buttons: true,
        images: true,
        performance: true,
      };

      // 检查是否启用了性能测试
      const enableWebPageTest = config?.enableWebPageTest ?? (performanceTestMode === PerformanceTestMode.WebPageTest);
      const enablePageSpeed = config?.enablePageSpeed ?? (performanceTestMode === PerformanceTestMode.PageSpeedInsights);

      // Check if any UI tests are enabled
      const hasUITests = testOptions.links || testOptions.forms || testOptions.buttons || testOptions.images;

      // 纯性能测试模式（无 UI 测试且不需要 WebPageTest 的渲染快照）
      if (!hasUITests && !enableWebPageTest && enablePageSpeed && testOptions.performance) {
        console.log('[PageSpeed-Only Mode] Skipping Playwright, running PageSpeed API only');
        return await this.executePageSpeedOnlyTest(testRequestId, url, config, startTime);
      }

      // WebPageTest mode or UI tests enabled: Need Playwright
      return await this.executePlaywrightBasedTest(testRequestId, url, config, startTime);

    } catch (error) {
      console.error('Test execution failed:', error);
      await testRequestRepository.updateStatus(testRequestId, TestRequestStatus.Failed);
      throw error;
    }
  }

  // Execute PageSpeed-only test (no Playwright)
  private async executePageSpeedOnlyTest(
    testRequestId: string,
    url: string,
    config: any,
    startTime: number
  ): Promise<TestReport> {
    let performanceResults: PerformanceResult[] = [];
    let pageSpeedData = undefined;

    // Run PageSpeed test
    if (config?.testOptions?.performance !== false) {
      try {
        // 优先使用 pageSpeedStrategy,其次使用 deviceStrategy,最后默认为 'desktop'
        const strategy = config?.pageSpeedStrategy || config?.deviceStrategy || 'desktop';
        console.log(`Running PageSpeed Insights performance analysis with ${strategy} strategy...`);
        const pageSpeedResult = await this.executePageSpeedTest(url, strategy);
        performanceResults = pageSpeedResult.performanceResults;
        pageSpeedData = pageSpeedResult.pageSpeedData;
        console.log(`✓ PageSpeed Insights completed with score ${pageSpeedData.performanceScore}/100`);
      } catch (perfError) {
        console.warn('⚠ Performance test failed:', perfError);
      }
    }

    // Calculate scores
    const testDuration = Date.now() - startTime;
    const { overallScore, totalChecks, passedChecks, failedChecks, warningChecks } =
      this.calculateScore([], performanceResults);

    // Create report
    const report = await testReportRepository.create({
      testRequestId,
      url,
      overallScore,
      totalChecks,
      passedChecks,
      failedChecks,
      warningChecks,
      testDuration,
      performanceTestMode: PerformanceTestMode.PageSpeedInsights,
      uiTestResults: [],
      performanceResults,
      pageSpeedData,
    });

    await testRequestRepository.updateStatus(testRequestId, TestRequestStatus.Completed);
    console.log(`✓ PageSpeed-only test completed in ${testDuration}ms with score ${overallScore}/100`);

    await this.sendEmailNotification(testRequestId, url, report);
    return report;
  }

  // Execute Playwright-based test (WebPageTest mode or with UI tests)
  private async executePlaywrightBasedTest(
    testRequestId: string,
    url: string,
    config: any,
    startTime: number
  ): Promise<TestReport> {
    let browser: Browser | null = null;

    try {
      // Acquire browser from pool
      browser = await browserPool.acquire();
      const context = await browser.newContext();
      const page = await context.newPage();

      // Set timeout
      const timeout = (config?.timeout || 30) * 1000;
      page.setDefaultTimeout(timeout);

      // Navigate to URL
      console.log(`Navigating to ${url}...`);
      await page.goto(url, {
        waitUntil: 'commit',
        timeout,
      });

      const performanceTestMode = config?.performanceTestMode || PerformanceTestMode.WebPageTest;
      const testOptions = config?.testOptions || {
        links: true,
        forms: true,
        buttons: true,
        images: true,
        performance: true,
      };

      // Capture rendering snapshots only for WebPageTest mode
      let renderingSnapshots: RenderingSnapshot[] = [];
      if (performanceTestMode === PerformanceTestMode.WebPageTest) {
        renderingSnapshots = await this.captureRenderingSnapshots(page, url);
      }

      // Wait additional time for JavaScript execution
      const waitTime = (config?.waitTime || 5) * 1000;
      await page.waitForTimeout(waitTime);
      console.log(`✓ Page loaded and waited ${waitTime}ms for JavaScript`);

      // Run UI tests
      console.log('Running UI tests...');
      const uiTestPromises: Array<Promise<any[]>> = [];

      if (testOptions.links) {
        uiTestPromises.push(uiTestingService.testLinks(page));
      }
      if (testOptions.forms) {
        uiTestPromises.push(uiTestingService.testForms(page));
      }
      if (testOptions.buttons) {
        uiTestPromises.push(uiTestingService.testButtons(page));
      }
      if (testOptions.images) {
        uiTestPromises.push(uiTestingService.testImages(page));
      }

      const uiTestResults = await Promise.all(uiTestPromises);
      const allUIResults = uiTestResults.flat();
      console.log(`✓ Completed ${allUIResults.length} UI tests`);

      // Close browser context
      await context.close();

      // Run performance analysis (支持同时运行两种测试)
      let performanceResults: PerformanceResult[] = [];
      let pageSpeedData = undefined;
      let webPageTestData = undefined;

      if (testOptions.performance) {
        const enableWebPageTest = config?.enableWebPageTest ?? (performanceTestMode === PerformanceTestMode.WebPageTest);
        const enablePageSpeed = config?.enablePageSpeed ?? (performanceTestMode === PerformanceTestMode.PageSpeedInsights);

        console.log(`[Performance Tests] WebPageTest: ${enableWebPageTest}, PageSpeed: ${enablePageSpeed}`);

        // 并行运行两种性能测试
        const performancePromises: Promise<void>[] = [];

        if (enableWebPageTest) {
          performancePromises.push(
            (async () => {
              try {
                // 优先使用 webPageTestStrategy,其次使用 deviceStrategy,最后默认为 'desktop'
                const strategy = config?.webPageTestStrategy || config?.deviceStrategy || 'desktop';
                console.log(`Running WebPageTest API with ${strategy} strategy...`);
                const wptResult = await performanceAnalysisService.runWebPageTest(url, strategy);
                // WebPageTest 成功时,仅设置 webPageTestData(包含 testId),不设置 performanceResults
                // 前端将引导用户访问 WebPageTest.org 查看完整报告
                webPageTestData = performanceAnalysisService.transformWebPageTestData(wptResult.completeData);
                console.log(`✓ WebPageTest completed successfully, testId: ${webPageTestData?.testId}`);
              } catch (error) {
                console.warn('⚠ WebPageTest API failed:', error);
              }
            })()
          );
        }

        if (enablePageSpeed) {
          performancePromises.push(
            (async () => {
              try {
                // 优先使用 pageSpeedStrategy,其次使用 deviceStrategy,最后默认为 'desktop'
                const strategy = config?.pageSpeedStrategy || config?.deviceStrategy || 'desktop';
                console.log(`Running PageSpeed Insights with ${strategy} strategy...`);
                const pageSpeedResult = await this.executePageSpeedTest(url, strategy);
                pageSpeedData = pageSpeedResult.pageSpeedData;
                console.log(`✓ PageSpeed Insights completed with score ${pageSpeedData.performanceScore}/100`);
              } catch (error) {
                console.warn('⚠ PageSpeed Insights API failed:', error);
              }
            })()
          );
        }

        // 等待所有性能测试完成（忽略失败）
        if (performancePromises.length > 0) {
          await Promise.allSettled(performancePromises);
        } else {
          console.log('⊘ No performance tests enabled');
        }
      } else {
        console.log('⊘ Performance test skipped (disabled by user)');
      }

      // Calculate scores
      const testDuration = Date.now() - startTime;
      const { overallScore, totalChecks, passedChecks, failedChecks, warningChecks } =
        this.calculateScore(allUIResults, performanceResults);

      // Create report
      const report = await testReportRepository.create({
        testRequestId,
        url,
        overallScore,
        totalChecks,
        passedChecks,
        failedChecks,
        warningChecks,
        testDuration,
        performanceTestMode,
        uiTestResults: allUIResults,
        performanceResults,
        renderingSnapshots: performanceTestMode === PerformanceTestMode.WebPageTest ? renderingSnapshots : undefined,
        pageSpeedData,
        webPageTestData,
      });

      await testRequestRepository.updateStatus(testRequestId, TestRequestStatus.Completed);
      console.log(`✓ Test execution completed in ${testDuration}ms with score ${overallScore}/100`);

      await this.sendEmailNotification(testRequestId, url, report);
      return report;

    } finally {
      if (browser) {
        browserPool.release(browser);
      }
    }
  }

  // Send email notification helper
  private async sendEmailNotification(testRequestId: string, url: string, report: TestReport) {
    const testRequest = await testRequestRepository.findById(testRequestId);
    console.log(`Email check: notificationEmail=${testRequest?.notificationEmail}, emailService.isAvailable()=${emailService.isAvailable()}`);

    if (testRequest?.notificationEmail && emailService.isAvailable()) {
      try {
        console.log(`Sending email to ${testRequest.notificationEmail}...`);
        // 🌐 智能获取应用 URL (优先级: 请求来源 > 环境变量 > localhost)
        const appUrl = testRequest.originUrl || process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
        console.log(`[Email] Using app URL: ${appUrl} (source: ${testRequest.originUrl ? 'request' : (process.env.APP_URL ? 'APP_URL' : (process.env.FRONTEND_URL ? 'FRONTEND_URL' : 'fallback'))})`);

        await emailService.sendTestCompletionEmail(testRequest.notificationEmail, {
          url,
          overallScore: report.overallScore,
          totalChecks: report.totalChecks,
          passedChecks: report.passedChecks,
          failedChecks: report.failedChecks,
          warningChecks: report.warningChecks,
          reportUrl: `${appUrl}/report/${report.id}`,
          completedAt: report.completedAt.toISOString(),
          // 新增: UI测试结果(用于详细分类统计)
          uiTestResults: report.uiTestResults?.map(result => ({
            testType: result.testType,
            status: result.status,
          })),
          // 新增: 包含完整的性能测试数据
          performanceTestMode: report.performanceTestMode,
          pageSpeedData: report.pageSpeedData ? {
            performanceScore: report.pageSpeedData.performanceScore,
            metrics: report.pageSpeedData.metrics,
          } : undefined,
          webPageTestData: report.webPageTestData ? {
            testId: report.webPageTestData.testId,
            // 基于 SpeedIndex 计算性能分数
            // 如果 SpeedIndex 不存在或过大(>10000),不显示分数
            performanceScore: (() => {
              const si = report.webPageTestData.metrics?.speedIndex;

              // 数据无效或质量太差,不显示分数
              if (!si || si > 10000 || si <= 0) {
                console.log('[Email] SpeedIndex not available or too poor, skipping score display:', si);
                return undefined;
              }

              // SpeedIndex < 1000: 90-100分
              if (si < 1000) return Math.round(90 + (1000 - si) / 100);
              // SpeedIndex 1000-3000: 50-89分
              if (si < 3000) return Math.round(50 + (3000 - si) / 50);
              // SpeedIndex 3000-10000: 1-49分
              return Math.max(1, Math.round(50 - (si - 3000) / 150));
            })(),
          } : undefined,
        });
        console.log(`✓ Email notification sent to ${testRequest.notificationEmail}`);
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    } else {
      console.log(`Email notification skipped: email=${testRequest?.notificationEmail}, service available=${emailService.isAvailable()}`);
    }
  }

  // Calculate overall health score from test results
  private calculateScore(
    uiResults: UITestResult[],
    performanceResults: PerformanceResult[]
  ): {
    overallScore: number;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
  } {
    const allResults = [...uiResults, ...performanceResults];
    const totalChecks = allResults.length;

    const passedChecks = allResults.filter((r) => r.status === TestResultStatus.Pass).length;
    const failedChecks = allResults.filter((r) => r.status === TestResultStatus.Fail).length;
    const warningChecks = allResults.filter((r) => r.status === TestResultStatus.Warning).length;

    // Calculate score: passed tests / total tests * 100
    // Warnings count as 0.5 passed
    const effectivePassed = passedChecks + warningChecks * 0.5;
    const overallScore = totalChecks > 0 ? Math.round((effectivePassed / totalChecks) * 100) : 0;

    return {
      overallScore,
      totalChecks,
      passedChecks,
      failedChecks,
      warningChecks,
    };
  }
}

export default new TestExecutionService();
