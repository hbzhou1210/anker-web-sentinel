import axios from 'axios';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('RedirectTesterService');

export interface RedirectRule {
  from: string;
  to: string;
  matchType: 'exact' | 'partial' | 'prefix' | 'regex';
  partialMatch?: {
    startChar?: string;
    endChar?: string;
    pattern?: string;
  };
  description?: string;
}

export interface RedirectTestResult {
  from: string;
  expectedTo: string;
  actualTo: string | null;
  statusCode: number | null;
  redirectChain: Array<{
    url: string;
    statusCode: number;
    location: string | null;
  }>;
  passed: boolean;
  reason: string;
  timestamp: string;
  responseTime: number;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: string;
}

export interface TestReport {
  summary: TestSummary;
  results: RedirectTestResult[];
}

export class RedirectTesterService {
  private timeout: number;
  private maxRedirects: number;
  private userAgent: string;

  constructor(options: {
    timeout?: number;
    maxRedirects?: number;
    userAgent?: string;
  } = {}) {
    this.timeout = options.timeout || 10000;
    this.maxRedirects = options.maxRedirects || 10;
    this.userAgent = options.userAgent || 'RedirectTester/1.0';
  }

  /**
   * 测试单个重定向规则
   */
  async testRedirect(rule: RedirectRule): Promise<RedirectTestResult> {
    const result: RedirectTestResult = {
      from: rule.from,
      expectedTo: rule.to,
      actualTo: null,
      statusCode: null,
      redirectChain: [],
      passed: false,
      reason: '',
      timestamp: new Date().toISOString(),
      responseTime: 0
    };

    const startTime = Date.now();

    try {
      // 跟踪重定向链
      let currentUrl = rule.from;
      let redirectCount = 0;

      while (redirectCount < this.maxRedirects) {
        const response = await axios.get(currentUrl, {
          maxRedirects: 0, // 禁用自动重定向
          validateStatus: (status) => status >= 200 && status < 400,
          timeout: this.timeout,
          headers: {
            'User-Agent': this.userAgent
          }
        });

        result.statusCode = response.status;
        result.redirectChain.push({
          url: currentUrl,
          statusCode: response.status,
          location: response.headers.location || null
        });

        // 检查是否是重定向状态码
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.location;
          if (!location) {
            result.reason = '重定向响应缺少Location头';
            break;
          }

          // 处理相对URL
          currentUrl = this.resolveUrl(currentUrl, location);
          redirectCount++;
        } else {
          // 到达最终URL
          result.actualTo = currentUrl;
          break;
        }
      }

      if (redirectCount >= this.maxRedirects) {
        result.reason = `重定向次数超过限制(${this.maxRedirects})`;
      } else if (result.actualTo) {
        // 验证重定向结果
        result.passed = this.validateRedirect(
          result.actualTo,
          rule.to,
          rule.matchType,
          rule.partialMatch
        );

        if (!result.passed) {
          result.reason = this.getValidationFailureReason(
            result.actualTo,
            rule.to,
            rule.matchType,
            rule.partialMatch
          );
        }
      }

    } catch (error: any) {
      result.reason = `请求失败: ${error.message}`;
      if (error.response) {
        result.statusCode = error.response.status;
      }
      logger.error('测试重定向失败', { rule, error: error.message });
    }

    result.responseTime = Date.now() - startTime;
    return result;
  }

  /**
   * 批量测试重定向规则
   */
  async testBatch(
    rules: RedirectRule[],
    options: { concurrency?: number } = {}
  ): Promise<RedirectTestResult[]> {
    const concurrency = options.concurrency || 5;
    const results: RedirectTestResult[] = [];

    logger.info(`开始批量测试 ${rules.length} 条规则，并发数: ${concurrency}`);

    // 分批处理
    for (let i = 0; i < rules.length; i += concurrency) {
      const batch = rules.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(rule => this.testRedirect(rule))
      );
      results.push(...batchResults);

      logger.info(`进度: ${Math.min(i + concurrency, rules.length)}/${rules.length}`);
    }

    logger.info(`批量测试完成，通过: ${results.filter(r => r.passed).length}/${results.length}`);

    return results;
  }

  /**
   * 生成测试报告
   */
  generateReport(results: RedirectTestResult[]): TestReport {
    const summary: TestSummary = {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      passRate: '0%'
    };

    if (summary.total > 0) {
      summary.passRate = ((summary.passed / summary.total) * 100).toFixed(2) + '%';
    }

    return {
      summary,
      results
    };
  }

  /**
   * 验证重定向是否匹配预期
   */
  private validateRedirect(
    actual: string,
    expected: string,
    matchType: string,
    partialMatch?: RedirectRule['partialMatch']
  ): boolean {
    if (matchType === 'exact') {
      return actual === expected;
    } else if (matchType === 'partial' && partialMatch) {
      const actualPart = this.extractPartialMatch(actual, partialMatch);
      const expectedPart = this.extractPartialMatch(expected, partialMatch);
      return actualPart === expectedPart;
    } else if (matchType === 'prefix') {
      return actual.startsWith(expected);
    } else if (matchType === 'regex' && partialMatch?.pattern) {
      const regex = new RegExp(partialMatch.pattern);
      return regex.test(actual);
    }
    return false;
  }

  /**
   * 提取部分匹配的字符串
   */
  private extractPartialMatch(
    url: string,
    config: RedirectRule['partialMatch']
  ): string {
    if (!config || (!config.startChar && !config.endChar)) {
      return url;
    }

    let startIndex = 0;
    let endIndex = url.length;

    if (config.startChar) {
      startIndex = url.indexOf(config.startChar);
      if (startIndex === -1) return '';
      startIndex += config.startChar.length;
    }

    if (config.endChar) {
      endIndex = url.indexOf(config.endChar, startIndex);
      if (endIndex === -1) endIndex = url.length;
    }

    return url.substring(startIndex, endIndex);
  }

  /**
   * 获取验证失败的原因
   */
  private getValidationFailureReason(
    actual: string,
    expected: string,
    matchType: string,
    partialMatch?: RedirectRule['partialMatch']
  ): string {
    if (matchType === 'exact') {
      return `URL不匹配。期望: ${expected}, 实际: ${actual}`;
    } else if (matchType === 'partial' && partialMatch) {
      const actualPart = this.extractPartialMatch(actual, partialMatch);
      const expectedPart = this.extractPartialMatch(expected, partialMatch);
      return `部分匹配失败。期望: ${expectedPart}, 实际: ${actualPart}`;
    } else if (matchType === 'prefix') {
      return `前缀不匹配。期望前缀: ${expected}, 实际URL: ${actual}`;
    }
    return '匹配失败';
  }

  /**
   * 解析相对URL
   */
  private resolveUrl(baseUrl: string, relativeUrl: string): string {
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }

    try {
      const base = new URL(baseUrl);
      if (relativeUrl.startsWith('/')) {
        return `${base.protocol}//${base.host}${relativeUrl}`;
      } else {
        return new URL(relativeUrl, baseUrl).href;
      }
    } catch (error) {
      logger.error('解析URL失败', { baseUrl, relativeUrl, error });
      return relativeUrl;
    }
  }
}
