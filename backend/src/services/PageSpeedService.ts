import axios from 'axios';
import { PageSpeedInsightsData } from '../models/entities';

/**
 * PageSpeed Insights API Service
 * 使用 Google PageSpeed Insights API 进行性能测试
 */
class PageSpeedService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

  constructor() {
    // 从环境变量读取 API Key
    this.apiKey = process.env.PAGESPEED_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[PageSpeed] Warning: PAGESPEED_API_KEY not set. PageSpeed tests will be limited.');
    }
  }

  /**
   * 运行 PageSpeed Insights 测试
   * @param url 要测试的 URL
   * @param strategy 测试策略: 'mobile' | 'desktop'
   */
  async runPageSpeedTest(url: string, strategy: 'mobile' | 'desktop' = 'desktop'): Promise<PageSpeedInsightsData> {
    console.log(`[PageSpeed] Running PageSpeed Insights test for: ${url} (${strategy})`);

    try {
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
    } catch (error: any) {
      console.error('[PageSpeed] Failed to run PageSpeed test:', error.message);

      // 如果是 API 限制错误,提供更友好的错误信息
      if (error.response?.status === 429) {
        throw new Error('PageSpeed API rate limit exceeded. Please add PAGESPEED_API_KEY to .env file.');
      }

      throw new Error(`PageSpeed test failed: ${error.message}`);
    }
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
