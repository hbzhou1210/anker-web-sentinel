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
    median: {
      firstView: {
        loadTime: number;
        TTFB: number;
        render: number;
        SpeedIndex: number;
        bytesIn: number;
        requests: Array<{
          url: string;
          bytesIn: number;
        }>;
      };
    };
  };
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

  // Run WebPageTest on a URL
  async runWebPageTest(url: string): Promise<PerformanceResult[]> {
    try {
      console.log(`Starting WebPageTest for ${url}...`);

      // Submit test request
      const testId = await this.submitTest(url);
      console.log(`Test submitted with ID: ${testId}`);

      // Poll for results
      const result = await this.pollForResults(testId);
      console.log(`Test completed, extracting metrics...`);

      // Extract and return metrics
      return this.extractMetrics(result);
    } catch (error) {
      console.error('WebPageTest execution failed:', error);
      throw error;
    }
  }

  // Submit a test to WebPageTest
  private async submitTest(url: string): Promise<string> {
    try {
      const response = await axios.post<WebPageTestResponse>(
        `${this.WPT_API_URL}/runtest.php`,
        null,
        {
          params: {
            url,
            f: 'json',
            location: 'Dulles:Chrome', // Default location
            runs: 1, // Single run for faster results
            fvonly: 1, // First view only
            video: 0, // No video
            lighthouse: 0, // No Lighthouse
          },
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

      const largestResources = this.extractLargestResources(firstView.requests);

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
