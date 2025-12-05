/**
 * Core Web Vitals 采集器
 * 基于 Playwright 真实浏览器环境采集性能指标
 *
 * 采集方式:
 * 1. 使用 web-vitals 库(Google官方)采集 LCP/FID/CLS
 * 2. 使用 PerformanceObserver API 采集 FCP/TTI/TBT
 * 3. 使用 Navigation Timing API 采集 TTFB/DOMLoad/OnLoad
 */

import { Page } from 'playwright';
import { WebVitalMetric } from './coreWebVitalsThresholds.js';

// ============ 性能指标结果结构 ============
export interface WebVitalResult {
  metric: WebVitalMetric;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';  // web-vitals库的原生评级
  delta: number;  // 与上次测量的差值
  id: string;     // 指标唯一标识
}

export interface CoreWebVitalsData {
  // Core Web Vitals
  lcp?: WebVitalResult;
  fid?: WebVitalResult;
  cls?: WebVitalResult;

  // 重要辅助指标
  fcp?: WebVitalResult;
  tti?: number;
  tbt?: number;

  // 传统指标
  ttfb?: number;
  domLoad?: number;
  onLoad?: number;

  // 元数据
  url: string;
  timestamp: number;
  userAgent: string;
  viewport: { width: number; height: number };
}

/**
 * Core Web Vitals 采集器
 */
export class CoreWebVitalsCollector {
  /**
   * 在页面中注入 web-vitals 库
   */
  private async injectWebVitalsLibrary(page: Page): Promise<void> {
    // 使用 CDN 版本的 web-vitals (Google官方库)
    await page.addScriptTag({
      url: 'https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js',
    });

    // 等待库加载完成
    await page.waitForFunction(function() {
      return typeof (window as any).webVitals !== 'undefined';
    }, { timeout: 5000 });
  }

  /**
   * 采集 Core Web Vitals (LCP/FID/CLS)
   */
  private async collectCoreWebVitals(page: Page): Promise<{
    lcp?: WebVitalResult;
    fid?: WebVitalResult;
    cls?: WebVitalResult;
    fcp?: WebVitalResult;
  }> {
    return await page.evaluate(function() {
      return new Promise(function(resolve) {
        const results: any = {};
        let collectedCount = 0;
        const totalMetrics = 4; // LCP, FID, CLS, FCP

        const checkComplete = function() {
          collectedCount++;
          // 等待4个指标或5秒超时
          if (collectedCount >= totalMetrics) {
            resolve(results);
          }
        };

        // 采集 LCP
        (window as any).webVitals.onLCP(function(metric: any) {
          results.lcp = {
            metric: 'LCP',
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id,
          };
          checkComplete();
        }, { reportAllChanges: false }); // 仅报告最终值

        // 采集 FID (需要用户交互,可能为空)
        (window as any).webVitals.onFID(function(metric: any) {
          results.fid = {
            metric: 'FID',
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id,
          };
          checkComplete();
        });

        // 采集 CLS
        (window as any).webVitals.onCLS(function(metric: any) {
          results.cls = {
            metric: 'CLS',
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id,
          };
          checkComplete();
        }, { reportAllChanges: false });

        // 采集 FCP
        (window as any).webVitals.onFCP(function(metric: any) {
          results.fcp = {
            metric: 'FCP',
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id,
          };
          checkComplete();
        });

        // 5秒超时保护
        setTimeout(function() {
          resolve(results);
        }, 5000);
      });
    });
  }

  /**
   * 采集 TTI (Time to Interactive)
   * 使用简化算法: 找到首次5秒静默窗口 (无长任务)
   */
  private async collectTTI(page: Page): Promise<number | undefined> {
    return await page.evaluate(function() {
      return new Promise(function(resolve) {
        const observer = new PerformanceObserver(function(list) {
          const entries = list.getEntries();

          // 查找首次内容绘制时间
          const fcpEntry = performance.getEntriesByType('paint')
            .find(function(e: any) { return e.name === 'first-contentful-paint'; });

          if (!fcpEntry) {
            resolve(undefined);
            return;
          }

          const fcpTime = fcpEntry.startTime;

          // 查找FCP后的首个5秒静默窗口
          const longTasks = entries.filter(function(e: any) { return e.duration > 50; });

          if (longTasks.length === 0) {
            // 无长任务,TTI ≈ FCP + 1s (估算)
            resolve(fcpTime + 1000);
            observer.disconnect();
            return;
          }

          // 找到最后一个长任务结束时间
          const lastTaskEnd = Math.max(...longTasks.map(function(t: any) { return t.startTime + t.duration; }));
          resolve(lastTaskEnd);
          observer.disconnect();
        });

        try {
          observer.observe({ type: 'longtask', buffered: true });

          // 3秒超时
          setTimeout(function() {
            observer.disconnect();
            resolve(undefined);
          }, 3000);
        } catch (error) {
          resolve(undefined);
        }
      });
    });
  }

  /**
   * 采集 TBT (Total Blocking Time)
   * FCP到TTI之间,所有长任务(>50ms)的阻塞时间总和
   */
  private async collectTBT(page: Page): Promise<number | undefined> {
    return await page.evaluate(function() {
      return new Promise(function(resolve) {
        const fcpEntry = performance.getEntriesByType('paint')
          .find(function(e: any) { return e.name === 'first-contentful-paint'; });

        if (!fcpEntry) {
          resolve(undefined);
          return;
        }

        const fcpTime = fcpEntry.startTime;
        let totalBlockingTime = 0;

        const observer = new PerformanceObserver(function(list) {
          for (const entry of list.getEntries()) {
            const taskEntry = entry as any;
            if (taskEntry.startTime >= fcpTime && taskEntry.duration > 50) {
              // 阻塞时间 = 任务时长 - 50ms (50ms以内不计入阻塞)
              totalBlockingTime += taskEntry.duration - 50;
            }
          }
        });

        try {
          observer.observe({ type: 'longtask', buffered: true });

          setTimeout(function() {
            observer.disconnect();
            resolve(totalBlockingTime);
          }, 3000);
        } catch (error) {
          resolve(undefined);
        }
      });
    });
  }

  /**
   * 采集传统性能指标 (TTFB/DOMLoad/OnLoad)
   */
  private async collectNavigationTimings(page: Page): Promise<{
    ttfb?: number;
    domLoad?: number;
    onLoad?: number;
  }> {
    return await page.evaluate(function() {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      if (!navigation) {
        return {};
      }

      return {
        ttfb: navigation.responseStart - navigation.requestStart,
        domLoad: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        onLoad: navigation.loadEventEnd - navigation.fetchStart,
      };
    });
  }

  /**
   * 主方法: 采集完整的 Core Web Vitals 数据
   *
   * @param page Playwright Page 对象
   * @param waitForInteraction 是否等待用户交互采集FID (默认false)
   * @returns Core Web Vitals 完整数据
   */
  async collect(page: Page, waitForInteraction: boolean = false): Promise<CoreWebVitalsData> {
    try {
      console.log('Starting Core Web Vitals collection...');

      // 1. 注入 web-vitals 库
      await this.injectWebVitalsLibrary(page);

      // 2. 采集 Core Web Vitals (LCP/FID/CLS/FCP)
      const coreVitals = await this.collectCoreWebVitals(page);
      console.log('✓ Core Web Vitals collected:', {
        LCP: coreVitals.lcp?.value,
        FID: coreVitals.fid?.value,
        CLS: coreVitals.cls?.value,
        FCP: coreVitals.fcp?.value,
      });

      // 3. 如果需要FID但未采集到,触发一次点击
      if (waitForInteraction && !coreVitals.fid) {
        console.log('Triggering interaction to collect FID...');
        await page.mouse.move(100, 100);
        await page.mouse.click(100, 100);
        await page.waitForTimeout(500);

        // 重新采集FID
        const fidResult = await page.evaluate(function() {
          return new Promise(function(resolve) {
            (window as any).webVitals.onFID(function(metric: any) {
              resolve({
                metric: 'FID',
                value: metric.value,
                rating: metric.rating,
                delta: metric.delta,
                id: metric.id,
              });
            });
            setTimeout(function() { resolve(null); }, 1000);
          });
        });

        if (fidResult) {
          coreVitals.fid = fidResult as WebVitalResult;
          console.log('✓ FID collected after interaction:', coreVitals.fid.value);
        }
      }

      // 4. 采集 TTI 和 TBT
      const [tti, tbt] = await Promise.all([
        this.collectTTI(page),
        this.collectTBT(page),
      ]);
      console.log('✓ TTI/TBT collected:', { TTI: tti, TBT: tbt });

      // 5. 采集传统指标
      const navigationTimings = await this.collectNavigationTimings(page);
      console.log('✓ Navigation Timings collected:', navigationTimings);

      // 6. 采集元数据
      const url = page.url();
      const userAgent = await page.evaluate(() => navigator.userAgent);
      const viewport = page.viewportSize() || { width: 1920, height: 1080 };

      // 7. 组装完整数据
      const result: CoreWebVitalsData = {
        ...coreVitals,
        tti,
        tbt,
        ...navigationTimings,
        url,
        timestamp: Date.now(),
        userAgent,
        viewport,
      };

      console.log('✓ Core Web Vitals collection completed');
      return result;
    } catch (error) {
      console.error('Failed to collect Core Web Vitals:', error);
      throw error;
    }
  }

  /**
   * 快速采集 (仅采集核心指标,不等待交互)
   */
  async collectQuick(page: Page): Promise<CoreWebVitalsData> {
    return this.collect(page, false);
  }

  /**
   * 完整采集 (包括FID,需要等待交互)
   */
  async collectComplete(page: Page): Promise<CoreWebVitalsData> {
    return this.collect(page, true);
  }
}

export default new CoreWebVitalsCollector();
