import axios from 'axios';
import { PageSpeedInsightsData } from '../models/entities.js';

/**
 * PageSpeed Insights API Service
 * 使用 Google PageSpeed Insights API 进行性能测试
 */
class PageSpeedService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5秒

  constructor() {
    // 从环境变量读取 API Key
    this.apiKey = process.env.PAGESPEED_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[PageSpeed] Warning: PAGESPEED_API_KEY not set. PageSpeed tests will be limited to 25 requests/day/IP.');
      console.warn('[PageSpeed] Get your API key from: https://developers.google.com/speed/docs/insights/v5/get-started');
    }
  }

  /**
   * 运行 PageSpeed Insights 测试(带重试机制)
   * @param url 要测试的 URL
   * @param strategy 测试策略: 'mobile' | 'desktop'
   */
  async runPageSpeedTest(url: string, strategy: 'mobile' | 'desktop' = 'desktop'): Promise<PageSpeedInsightsData> {
    console.log(`[PageSpeed] Running PageSpeed Insights test for: ${url} (${strategy})`);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.executePageSpeedTest(url, strategy);
      } catch (error: any) {
        lastError = error;

        // 如果是 API 限制错误或认证错误,不重试
        if (error.response?.status === 429 || error.response?.status === 403) {
          console.error(`[PageSpeed] API error (${error.response.status}), not retrying`);
          break;
        }

        // 如果还有重试次数,等待后重试
        if (attempt < this.MAX_RETRIES) {
          console.warn(`[PageSpeed] Attempt ${attempt} failed: ${error.message}, retrying in ${this.RETRY_DELAY / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    // 所有重试都失败,抛出最后一个错误
    throw this.formatError(lastError);
  }

  /**
   * 执行单次 PageSpeed 测试
   */
  private async executePageSpeedTest(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedInsightsData> {
    const params: Record<string, string> = {
      url,
      strategy,
      category: 'performance',
    };

    // 只有在有 API Key 时才添加(没有 API Key 可以使用,但有请求限制)
    if (this.apiKey) {
      params.key = this.apiKey;
    }

    const response = await axios.get(this.apiUrl, {
      params,
      timeout: 120000, // 120秒超时 (复杂网站需要更长时间)
    });

      const data = response.data;
      const lighthouseResult = data.lighthouseResult;
      const categories = lighthouseResult.categories;
      const audits = lighthouseResult.audits;

      // 提取性能分数
      const performanceScore = Math.round((categories.performance?.score || 0) * 100);

      // 提取核心 Web Vitals 指标
      const metrics = {
        firstContentfulPaint: audits['first-contentful-paint']?.numericValue || 0,
        largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || 0,
        totalBlockingTime: audits['total-blocking-time']?.numericValue || 0,
        cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || 0,
        speedIndex: audits['speed-index']?.numericValue || 0,
        timeToInteractive: audits['interactive']?.numericValue || 0,
      };

      // 提取优化建议 (Opportunities)
      const opportunities: Array<{
        title: string;
        description: string;
        score: number;
        savings: number;
      }> = [];

      const opportunityAudits = [
        'render-blocking-resources',
        'unused-css-rules',
        'unused-javascript',
        'modern-image-formats',
        'offscreen-images',
        'unminified-css',
        'unminified-javascript',
        'efficient-animated-content',
        'uses-optimized-images',
        'uses-text-compression',
        'uses-responsive-images',
      ];

      for (const auditId of opportunityAudits) {
        const audit = audits[auditId];
        if (audit && audit.score !== null && audit.score < 1) {
          opportunities.push({
            title: audit.title,
            description: audit.description,
            score: Math.round((audit.score || 0) * 100),
            savings: audit.numericValue || 0,
          });
        }
      }

      // 提取诊断信息 (Diagnostics)
      const diagnostics: Array<{
        title: string;
        description: string;
        score: number;
      }> = [];

      const diagnosticAudits = [
        'uses-long-cache-ttl',
        'total-byte-weight',
        'dom-size',
        'critical-request-chains',
        'user-timings',
        'bootup-time',
        'mainthread-work-breakdown',
        'font-display',
        'third-party-summary',
      ];

      for (const auditId of diagnosticAudits) {
        const audit = audits[auditId];
        if (audit && audit.score !== null) {
          diagnostics.push({
            title: audit.title,
            description: audit.description,
            score: Math.round((audit.score || 0) * 100),
          });
        }
      }

      console.log(`[PageSpeed] Test completed. Performance score: ${performanceScore}`);
      console.log(`[PageSpeed] FCP: ${metrics.firstContentfulPaint}ms, LCP: ${metrics.largestContentfulPaint}ms`);
      console.log(`[PageSpeed] Found ${opportunities.length} opportunities, ${diagnostics.length} diagnostics`);

    return {
      performanceScore,
      metrics,
      opportunities: opportunities.slice(0, 10), // 最多返回 10 条优化建议
      diagnostics: diagnostics.slice(0, 10), // 最多返回 10 条诊断信息
    };
  }

  /**
   * 格式化错误信息
   */
  private formatError(error: any): Error {
    if (!error) {
      return new Error('PageSpeed test failed with unknown error');
    }

    // API 限制错误
    if (error.response?.status === 429) {
      return new Error(
        'PageSpeed API rate limit exceeded (25 requests/day/IP without API key). ' +
        'Please add PAGESPEED_API_KEY to your .env file to increase the limit. ' +
        'Get your API key from: https://developers.google.com/speed/docs/insights/v5/get-started'
      );
    }

    // 认证错误
    if (error.response?.status === 403) {
      return new Error(
        'PageSpeed API authentication failed. Please check your PAGESPEED_API_KEY in .env file.'
      );
    }

    // 超时错误
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new Error(
        'PageSpeed API request timed out after 120 seconds. The target website may be too slow to analyze.'
      );
    }

    // 网络错误
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new Error(
        'Failed to connect to PageSpeed API. Please check your network connection.'
      );
    }

    // 通用错误
    return new Error(`PageSpeed test failed: ${error.message || 'Unknown error'}`);
  }

  /**
   * 检查 PageSpeed API 是否可用
   */
  isAvailable(): boolean {
    // PageSpeed API 即使没有 key 也可以使用,只是有频率限制
    return true;
  }

  /**
   * 获取 API Key 状态
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }
}

export const pageSpeedService = new PageSpeedService();
