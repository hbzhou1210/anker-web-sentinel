import { Browser } from 'playwright';
import browserPool from '../automation/BrowserPool.js';
import uiTestingService from '../automation/UITestingService.js';
import performanceAnalysisService from '../performance/PerformanceAnalysisService.js';
import testRequestRepository from '../models/repositories/InMemoryTestRequestRepository.js';
import testReportRepository from '../models/repositories/BitableTestReportRepository.js';
import { TestRequestStatus, TestReport, TestResultStatus } from '../models/entities.js';
import { emailService } from './EmailService.js';

export class TestExecutionService {
  // Execute complete test for a given test request
  async executeTest(
    testRequestId: string,
    url: string,
    config?: {
      timeout?: number;
      waitTime?: number;
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
    let browser: Browser | null = null;

    try {
      // Update status to running
      await testRequestRepository.updateStatus(testRequestId, TestRequestStatus.Running);
      console.log(`Starting test execution for ${url}`);

      // Acquire browser from pool
      browser = await browserPool.acquire();
      const context = await browser.newContext();
      const page = await context.newPage();

      // Set timeout
      const timeout = (config?.timeout || 30) * 1000;
      page.setDefaultTimeout(timeout);

      // Navigate to URL and wait for network idle
      console.log(`Navigating to ${url}...`);
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout,
      });

      // Wait additional time for JavaScript execution
      const waitTime = (config?.waitTime || 5) * 1000;
      await page.waitForTimeout(waitTime);
      console.log(`✓ Page loaded and waited ${waitTime}ms for JavaScript`);

      // Default to running all tests if testOptions not specified
      const testOptions = config?.testOptions || {
        links: true,
        forms: true,
        buttons: true,
        images: true,
        performance: true,
      };

      // Run UI tests conditionally based on testOptions
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

      // Run WebPageTest performance analysis conditionally (allow it to fail gracefully)
      let performanceResults: Array<{ status: TestResultStatus }> = [];
      if (testOptions.performance) {
        try {
          console.log('Running WebPageTest performance analysis...');
          performanceResults = await performanceAnalysisService.runWebPageTest(url);
          console.log(`✓ Completed ${performanceResults.length} performance metrics`);
        } catch (perfError) {
          console.warn('⚠ Performance test failed, continuing with UI results only:', perfError);
          // Continue execution even if performance test fails
        }
      } else {
        console.log('⊘ Performance test skipped (disabled by user)');
      }

      // Calculate overall score and stats
      const testDuration = Date.now() - startTime;
      const { overallScore, totalChecks, passedChecks, failedChecks, warningChecks } =
        this.calculateScore(allUIResults, performanceResults);

      // Create test report
      const report = await testReportRepository.create({
        testRequestId,
        url,
        overallScore,
        totalChecks,
        passedChecks,
        failedChecks,
        warningChecks,
        testDuration,
      });

      // Update test request status to completed
      await testRequestRepository.updateStatus(testRequestId, TestRequestStatus.Completed);

      console.log(`✓ Test execution completed in ${testDuration}ms with score ${overallScore}/100`);

      // Send email notification if email was provided
      const testRequest = await testRequestRepository.findById(testRequestId);
      console.log(`Email check: notificationEmail=${testRequest?.notificationEmail}, emailService.isAvailable()=${emailService.isAvailable()}`);

      if (testRequest?.notificationEmail && emailService.isAvailable()) {
        try {
          console.log(`Sending email to ${testRequest.notificationEmail}...`);
          const appUrl = process.env.APP_URL || 'http://localhost:5173';
          await emailService.sendTestCompletionEmail(testRequest.notificationEmail, {
            url,
            overallScore,
            totalChecks,
            passedChecks,
            failedChecks,
            warningChecks,
            reportUrl: `${appUrl}/report/${report.id}`,
            completedAt: report.completedAt.toISOString(),
          });
          console.log(`✓ Email notification sent to ${testRequest.notificationEmail}`);
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
          // Don't fail the test execution if email sending fails
        }
      } else {
        console.log(`Email notification skipped: email=${testRequest?.notificationEmail}, service available=${emailService.isAvailable()}`);
      }

      // Return complete report
      return report;
    } catch (error) {
      console.error('Test execution failed:', error);

      // Update test request status to failed
      await testRequestRepository.updateStatus(testRequestId, TestRequestStatus.Failed);

      throw error;
    } finally {
      // Always release browser back to pool
      if (browser) {
        browserPool.release(browser);
      }
    }
  }

  // Calculate overall health score from test results
  private calculateScore(
    uiResults: Array<{ status: TestResultStatus }>,
    performanceResults: Array<{ status: TestResultStatus }>
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
