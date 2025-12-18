import axios from 'axios';
import { PerformanceResult, PerformanceMetric, MetricUnit, TestResultStatus } from '../models/entities.js';
import { PERFORMANCE_THRESHOLDS } from './thresholds.js';
import failureAnalysisService from '../automation/FailureAnalysisService.js';

interface WebPageTestResponse {
  statusCode: number;
  statusText: string;
  data: {
    testId: string;
    jsonUrl: string;
    userUrl: string;
  };
}

interface WebPageTestResult {
  data: {
    testId: string;
    summary: string;
    testUrl: string;
    runs: {
      [key: string]: {
        firstView: WebPageTestRun;
      };
    };
    median: {
      firstView: WebPageTestRun;
    };
  };
}

interface WebPageTestRun {
  loadTime: number;
  TTFB: number;
  render: number;
  SpeedIndex: number;
  visualComplete: number;
  fullyLoaded: number;
  bytesIn: number;
  bytesOut: number;
  requests: number;
  requestsFull: number;
  responses_200: number;
  responses_404: number;
  responses_other: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  totalBlockingTime: number;
  domContentLoadedEventStart: number;
  domContentLoadedEventEnd: number;
  loadEventStart: number;
  loadEventEnd: number;
  images: {
    bytes: number;
    requests: number;
  };
  js: {
    bytes: number;
    requests: number;
  };
  css: {
    bytes: number;
    requests: number;
  };
  video: {
    frames: Array<{
      time: number;
      image: string;
      visuallyComplete: number;
    }>;
  };
  videoFrames: Array<{
    time: number;
    image: string;
    VisuallyComplete: number;
  }>;
  thumbnails: {
    checklist: string;
    waterfall: string;
    screenShot: string;
  };
  domains: Record<string, {
    bytes: number;
    requests: number;
    connections: number;
  }>;
  breakdown: Record<string, {
    bytes: number;
    requests: number;
  }>;
  requestsDoc: Array<{
    url: string;
    host: string;
    method: string;
    status: number;
    type: string;
    request_id: number;
    ip_addr: string;
    full_url: string;
    is_secure: number;
    bytesIn: number;
    bytesOut: number;
    objectSize: number;
    load_start: number;
    ttfb_start: number;
    ttfb_end: number;
    download_start: number;
    download_end: number;
    all_start: number;
    all_end: number;
    dns_start: number;
    dns_end: number;
    connect_start: number;
    connect_end: number;
    ssl_start: number;
    ssl_end: number;
    initiator: string;
    priority: string;
  }>;
}

export class PerformanceAnalysisService {
  private readonly WPT_API_KEY: string;
  private readonly WPT_API_URL = 'https://www.webpagetest.org';
  private readonly POLL_INTERVAL = 5000; // 5 seconds
  private readonly MAX_WAIT_TIME = 300000; // 5 minutes

  constructor() {
    this.WPT_API_KEY = process.env.WEBPAGETEST_API_KEY || '';
    if (!this.WPT_API_KEY) {
      console.warn('⚠️  WEBPAGETEST_API_KEY not set in environment. Performance testing may fail.');
    }
  }

  // Run WebPageTest on a URL - returns both metrics and complete data
  async runWebPageTest(url: string, strategy: 'mobile' | 'desktop' = 'desktop'): Promise<{
    metrics: PerformanceResult[];
    completeData: any;
  }> {
    try {
      console.log(`Starting WebPageTest for ${url}...`);

      // Submit test request
      const testId = await this.submitTest(url, strategy);
      console.log(`Test submitted with ID: ${testId}`);

      // Poll for results
      const result = await this.pollForResults(testId);
      console.log(`Test completed, extracting metrics...`);

      // Extract metrics for scoring
      const metrics = this.extractMetrics(result);

      // Return both metrics and complete data
      return {
        metrics,
        completeData: result.data
      };
    } catch (error) {
      console.error('WebPageTest execution failed:', error);
      throw error;
    }
  }

  // Submit a test to WebPageTest
  private async submitTest(url: string, strategy: 'mobile' | 'desktop' = 'desktop'): Promise<string> {
    try {
      // Mobile configuration: use mobile device emulation
      const location = strategy === 'mobile'
        ? 'Dulles:Moto G4' // Mobile device with 3G network
        : 'Dulles:Chrome';  // Desktop Chrome

      console.log(`[WebPageTest] Submitting test with strategy: ${strategy}, location: ${location}`);

      const params = {
        url,
        f: 'json',
        location,
        runs: 1, // Single run for faster results
        fvonly: 1, // First view only
        video: 1, // Enable video for filmstrip
        lighthouse: 0, // No Lighthouse (we already have PageSpeed)
        priority: 5, // Higher priority for faster results
        ...(strategy === 'mobile' && {
          mobile: 1, // Enable mobile mode
          mobileDevice: 'Moto G4', // Specific mobile device
        }),
      };

      console.log('[WebPageTest] Request params:', JSON.stringify(params, null, 2));

      const response = await axios.post<WebPageTestResponse>(
        `${this.WPT_API_URL}/runtest.php`,
        null,
        {
          params,
          headers: {
            'X-WPT-API-KEY': this.WPT_API_KEY,
          },
          timeout: 30000,
        }
      );

      if (response.data.statusCode !== 200) {
        throw new Error(`WebPageTest API error: ${response.data.statusText}`);
      }

      return response.data.data.testId;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to submit WebPageTest: ${error.message}`);
      }
      throw error;
    }
  }

  // Poll for test results
  private async pollForResults(testId: string): Promise<WebPageTestResult> {
    const startTime = Date.now();
    const resultUrl = `${this.WPT_API_URL}/jsonResult.php?test=${testId}`;

    while (Date.now() - startTime < this.MAX_WAIT_TIME) {
      try {
        const response = await axios.get(resultUrl, { timeout: 10000 });

        // Check if test is complete
        if (response.data.statusCode === 200 && response.data.data) {
          return response.data as WebPageTestResult;
        }

        // Still running, wait and retry
        console.log(`Test still running... (elapsed: ${Math.round((Date.now() - startTime) / 1000)}s)`);
        await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL));
      } catch (error) {
        // Ignore polling errors and retry
        console.log('Polling error, retrying...');
        await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL));
      }
    }

    throw new Error('WebPageTest timeout: Test did not complete within 5 minutes');
  }

  // Extract performance metrics from WebPageTest result
  private extractMetrics(result: WebPageTestResult): PerformanceResult[] {
    const firstView = result.data.median.firstView;
    const metrics: PerformanceResult[] = [];

    // Extract load time (Total load time)
    if (firstView.loadTime !== undefined) {
      const status = this.calculateStatus(firstView.loadTime, PERFORMANCE_THRESHOLDS.loadTime);
      const analysis = failureAnalysisService.analyzePerformanceFailure(
        'loadTime',
        firstView.loadTime,
        PERFORMANCE_THRESHOLDS.loadTime,
        status
      );

      metrics.push({
        id: '',
        testReportId: '',
        metricName: PerformanceMetric.LoadTime,
        measuredValue: firstView.loadTime,
        unit: MetricUnit.Milliseconds,
        threshold: PERFORMANCE_THRESHOLDS.loadTime,
        status,
        details: analysis ? {
          cause: analysis.cause,
          recommendation: analysis.recommendation,
          severity: analysis.severity,
          fixComplexity: analysis.fixComplexity,
        } : undefined,
      });
    }

    // Extract resource size (Total bytes downloaded)
    if (firstView.bytesIn !== undefined) {
      const status = this.calculateStatus(firstView.bytesIn, PERFORMANCE_THRESHOLDS.resourceSize);
      const analysis = failureAnalysisService.analyzePerformanceFailure(
        'resourceSize',
        firstView.bytesIn,
        PERFORMANCE_THRESHOLDS.resourceSize,
        status
      );

      // requestsDoc 可能是对象或数组,需要安全处理
      const requestsArray = Array.isArray(firstView.requestsDoc)
        ? firstView.requestsDoc
        : (firstView.requests && Array.isArray(firstView.requests) ? firstView.requests : []);
      const largestResources = this.extractLargestResources(requestsArray);

      metrics.push({
        id: '',
        testReportId: '',
        metricName: PerformanceMetric.ResourceSize,
        measuredValue: firstView.bytesIn,
        unit: MetricUnit.Bytes,
        threshold: PERFORMANCE_THRESHOLDS.resourceSize,
        status,
        details: {
          ...largestResources,
          ...(analysis ? {
            cause: analysis.cause,
            recommendation: analysis.recommendation,
            severity: analysis.severity,
            fixComplexity: analysis.fixComplexity,
          } : {}),
        },
      });
    }

    // Extract response time (Time to First Byte)
    if (firstView.TTFB !== undefined) {
      const status = this.calculateStatus(firstView.TTFB, PERFORMANCE_THRESHOLDS.responseTime);
      const analysis = failureAnalysisService.analyzePerformanceFailure(
        'responseTime',
        firstView.TTFB,
        PERFORMANCE_THRESHOLDS.responseTime,
        status
      );

      metrics.push({
        id: '',
        testReportId: '',
        metricName: PerformanceMetric.ResponseTime,
        measuredValue: firstView.TTFB,
        unit: MetricUnit.Milliseconds,
        threshold: PERFORMANCE_THRESHOLDS.responseTime,
        status,
        details: analysis ? {
          cause: analysis.cause,
          recommendation: analysis.recommendation,
          severity: analysis.severity,
          fixComplexity: analysis.fixComplexity,
        } : undefined,
      });
    }

    // Extract render time (Start Render / First Paint)
    if (firstView.render !== undefined) {
      const status = this.calculateStatus(firstView.render, PERFORMANCE_THRESHOLDS.renderTime);
      const analysis = failureAnalysisService.analyzePerformanceFailure(
        'renderTime',
        firstView.render,
        PERFORMANCE_THRESHOLDS.renderTime,
        status
      );

      metrics.push({
        id: '',
        testReportId: '',
        metricName: PerformanceMetric.RenderTime,
        measuredValue: firstView.render,
        unit: MetricUnit.Milliseconds,
        threshold: PERFORMANCE_THRESHOLDS.renderTime,
        status,
        details: analysis ? {
          cause: analysis.cause,
          recommendation: analysis.recommendation,
          severity: analysis.severity,
          fixComplexity: analysis.fixComplexity,
        } : undefined,
      });
    }

    console.log(`✓ Extracted ${metrics.length} performance metrics from WebPageTest`);
    return metrics;
  }

  // Calculate performance status based on threshold
  calculateStatus(measuredValue: number, threshold: number): TestResultStatus {
    // Pass if within threshold
    if (measuredValue <= threshold) {
      return TestResultStatus.Pass;
    }

    // Warning if 10-20% over threshold
    if (measuredValue <= threshold * 1.2) {
      return TestResultStatus.Warning;
    }

    // Fail if >20% over threshold
    return TestResultStatus.Fail;
  }

  // Transform WebPageTest result to structured data
  transformWebPageTestData(wptData: any): any {
    try {
      const firstView = wptData.median?.firstView || wptData.runs?.[1]?.firstView;

      if (!firstView) {
        console.warn('No firstView data found in WebPageTest result');
        return null;
      }

      // 转换为结构化数据
      const transformedData = {
        testId: wptData.testId || wptData.id,
        testUrl: wptData.testUrl || wptData.url,
        summary: wptData.summary,

        // 核心性能指标
        metrics: {
          loadTime: firstView.loadTime || 0,
          TTFB: firstView.TTFB || 0,
          startRender: firstView.render || 0,
          firstContentfulPaint: firstView.firstContentfulPaint || firstView.firstPaint || 0,
          speedIndex: firstView.SpeedIndex || 0,
          largestContentfulPaint: firstView.largestContentfulPaint || 0,
          cumulativeLayoutShift: firstView.cumulativeLayoutShift || 0,
          totalBlockingTime: firstView.totalBlockingTime || 0,
          domContentLoaded: firstView.domContentLoadedEventEnd || 0,
          fullyLoaded: firstView.fullyLoaded || 0,
        },

        // 资源统计
        resources: {
          totalBytes: firstView.bytesIn || 0,
          totalRequests: (() => {
            // firstView.requests 是数组,需要获取长度或使用 requestsDoc
            if (Array.isArray(firstView.requests)) {
              return firstView.requests.length;
            }
            if (Array.isArray(firstView.requestsDoc)) {
              return firstView.requestsDoc.length;
            }
            // 如果有 requestsFull 或其他字段,也可以尝试
            return typeof firstView.requests === 'number' ? firstView.requests : 0;
          })(),
          images: {
            bytes: firstView.image_bytes || firstView.images?.bytes || 0,
            requests: firstView.image_requests || firstView.images?.requests || 0,
          },
          js: {
            bytes: firstView.js_bytes || firstView.js?.bytes || 0,
            requests: firstView.js_requests || firstView.js?.requests || 0,
          },
          css: {
            bytes: firstView.css_bytes || firstView.css?.bytes || 0,
            requests: firstView.css_requests || firstView.css?.requests || 0,
          },
        },

        // 视频帧（Filmstrip）
        videoFrames: firstView.videoFrames?.slice(0, 10).map((frame: any) => ({
          time: frame.time,
          image: frame.image,
          visuallyComplete: frame.VisuallyComplete || frame.visuallyComplete || 0,
        })) || [],

        // 缩略图
        thumbnails: {
          waterfall: firstView.thumbnails?.waterfall,
          checklist: firstView.thumbnails?.checklist,
          screenShot: firstView.thumbnails?.screenShot,
        },

        // 请求瀑布图数据（前50个请求）
        // requestsDoc 可能是对象或数组,需要安全处理
        requests: (() => {
          const requestsData = Array.isArray(firstView.requestsDoc)
            ? firstView.requestsDoc
            : (firstView.requests && Array.isArray(firstView.requests) ? firstView.requests : []);

          return requestsData.slice(0, 50).map((req: any) => ({
            url: req.url || req.full_url,
            host: req.host,
            method: req.method,
            status: req.status,
            type: req.type,
            bytesIn: req.bytesIn || req.objectSize,
            startTime: req.load_start || req.all_start,
            endTime: req.download_end || req.all_end,
            duration: (req.download_end || req.all_end) - (req.load_start || req.all_start),
          }));
        })(),

        // 域名统计（前20个域名）
        domains: firstView.domains ? Object.entries(firstView.domains)
          .slice(0, 20)
          .map(([domain, stats]: [string, any]) => ({
            domain,
            bytes: stats.bytes,
            requests: stats.requests,
            connections: stats.connections,
          })) : [],
      };

      console.log('✓ Transformed WebPageTest data successfully');
      return transformedData;
    } catch (error) {
      console.error('Failed to transform WebPageTest data:', error);
      return null;
    }
  }

  // Extract top 5 largest resources for resource size details
  private extractLargestResources(
    requests: Array<{ url: string; bytesIn: number }>
  ): Record<string, any> | undefined {
    try {
      if (!requests || requests.length === 0) {
        return undefined;
      }

      // Get top 5 largest resources
      const top5 = requests
        .sort((a, b) => b.bytesIn - a.bytesIn)
        .slice(0, 5)
        .map((item, index) => ({
          rank: index + 1,
          url: item.url,
          size: item.bytesIn,
          sizeKB: (item.bytesIn / 1024).toFixed(2),
        }));

      return { largestResources: top5 };
    } catch (error) {
      console.error('Failed to extract largest resources:', error);
      return undefined;
    }
  }
}

export default new PerformanceAnalysisService();
