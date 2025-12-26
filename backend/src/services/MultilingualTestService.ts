import { Page, Browser } from 'playwright';
import { languageCheckService, LanguageCheckService, FormattedLanguageError } from './LanguageCheckService.js';
import browserPool from '../automation/BrowserPool.js';

/**
 * 多语言检查结果
 */
export interface MultilingualCheckResult {
  language: string;
  languageCode: string;
  textContent: string;
  totalErrors: number;
  criticalErrors: number;
  warnings: number;
  infos: number;
  errors: FormattedLanguageError[];
  timestamp: Date;
}

/**
 * 自定义内容规则检查结果
 */
export interface CustomRuleCheckResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  position?: number;
  context?: string;
}

/**
 * 完整的多语言测试报告
 */
export interface MultilingualTestReport {
  url: string;
  languages: MultilingualCheckResult[];
  customChecks: CustomRuleCheckResult[];
  summary: {
    totalLanguages: number;
    totalErrors: number;
    totalCriticalErrors: number;
    totalWarnings: number;
    languagesWithIssues: number;
  };
  completedAt: Date;
  durationMs: number;
}

/**
 * 多语言测试服务
 * 负责提取页面文本并进行多语言检查
 */
export class MultilingualTestService {
  /**
   * 提取页面的可见文本内容
   */
  async extractPageText(page: Page): Promise<string> {
    // 简单的文本提取 - 获取所有可见文本
    return await page.evaluate(() => {
      return document.body.innerText || '';
    });
  }

  /**
   * 检查单个语言的内容
   */
  async checkLanguage(
    text: string,
    language: string
  ): Promise<MultilingualCheckResult> {
    const startTime = Date.now();
    const languageCode = LanguageCheckService.getLanguageCode(language);

    try {
      // 调用 LanguageTool 检查
      const rawErrors = await languageCheckService.checkText(text, languageCode);
      const errors = languageCheckService.formatErrors(rawErrors);

      // 统计各类错误
      const criticalErrors = errors.filter(e => e.severity === 'error').length;
      const warnings = errors.filter(e => e.severity === 'warning').length;
      const infos = errors.filter(e => e.severity === 'info').length;

      return {
        language,
        languageCode,
        textContent: text,
        totalErrors: errors.length,
        criticalErrors,
        warnings,
        infos,
        errors,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`Failed to check ${language}:`, error);
      throw error;
    }
  }

  /**
   * 切换页面语言
   * 需要根据具体网站的实现方式调整
   */
  async switchLanguage(page: Page, language: string): Promise<void> {
    const url = new URL(page.url());

    // 方式 1: URL 参数
    url.searchParams.set('lang', language);
    url.searchParams.set('language', language);

    try {
      await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000); // 等待内容更新
    } catch (error) {
      console.error(`Failed to switch to ${language}:`, error);
      throw error;
    }
  }

  /**
   * 检查多个语言的页面内容
   */
  async checkMultilingualPage(
    url: string,
    languages: string[]
  ): Promise<MultilingualTestReport> {
    const startTime = Date.now();
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      // 从浏览器池获取浏览器
      browser = await browserPool.acquire();
      page = await browser.newPage();

      const results: MultilingualCheckResult[] = [];
      const customChecks: CustomRuleCheckResult[] = [];

      for (const language of languages) {
        try {
          console.log(`[MultilingualTest] Checking ${language} for ${url}`);

          // 构建带语言参数的 URL
          const urlWithLang = new URL(url);
          urlWithLang.searchParams.set('lang', language);
          urlWithLang.searchParams.set('language', language);

          // 导航到页面 - 使用更宽松的等待条件
          await page.goto(urlWithLang.toString(), {
            waitUntil: 'domcontentloaded', // 改为 domcontentloaded,不等待所有网络请求
            timeout: 60000 // 增加到 60 秒
          });
          await page.waitForTimeout(3000); // 增加等待时间,确保内容渲染

          // 提取文本
          const text = await this.extractPageText(page);

          if (!text || text.length === 0) {
            console.warn(`[MultilingualTest] No text found for ${language}`);
            customChecks.push({
              type: 'empty-content',
              severity: 'warning',
              message: `语言 "${language}" 的页面没有可见文本内容`,
            });
            continue;
          }

          // 检查语言错误
          const result = await this.checkLanguage(text, language);
          results.push(result);

          // 执行自定义规则检查
          const customResult = this.checkCustomRules(text, language);
          customChecks.push(...customResult);

        } catch (error) {
          console.error(`[MultilingualTest] Error checking ${language}:`, error);
          customChecks.push({
            type: 'check-failed',
            severity: 'error',
            message: `无法检查语言 "${language}": ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }

      // 生成摘要
      const summary = {
        totalLanguages: results.length,
        totalErrors: results.reduce((sum, r) => sum + r.totalErrors, 0),
        totalCriticalErrors: results.reduce((sum, r) => sum + r.criticalErrors, 0),
        totalWarnings: results.reduce((sum, r) => sum + r.warnings, 0),
        languagesWithIssues: results.filter(r => r.totalErrors > 0).length,
      };

      return {
        url,
        languages: results,
        customChecks,
        summary,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      };

    } finally {
      // 清理资源
      if (page) {
        await page.close().catch(console.error);
      }
      if (browser) {
        await browserPool.release(browser);
      }
    }
  }

  /**
   * 自定义规则检查
   */
  private checkCustomRules(text: string, language: string): CustomRuleCheckResult[] {
    const results: CustomRuleCheckResult[] = [];

    // 1. 检查占位符完整性
    const openBraces = (text.match(/\{/g) || []).length;
    const closeBraces = (text.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
      results.push({
        type: 'placeholder-mismatch',
        severity: 'error',
        message: `占位符不匹配: ${openBraces} 个 '{' 和 ${closeBraces} 个 '}'`,
      });
    }

    // 2. 检查常见的占位符格式
    const placeholderPatterns = [
      /%[sd]/g,           // %s, %d
      /\{\{.*?\}\}/g,     // {{variable}}
      /\{[^}]+\}/g,       // {variable}
      /%\([^)]+\)s/g,     // %(name)s
    ];

    placeholderPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        console.log(`[CustomRules] Found ${matches.length} ${pattern} placeholders in ${language}`);
      }
    });

    // 3. 检查文本长度(警告)
    if (text.length > 50000) {
      results.push({
        type: 'content-too-long',
        severity: 'warning',
        message: `页面文本过长 (${text.length} 字符),可能影响用户体验`,
      });
    }

    // 4. 检查是否包含常见的错误占位符
    const commonErrors = [
      { pattern: /\[object Object\]/gi, message: '包含未处理的对象占位符' },
      { pattern: /undefined/gi, message: '包含 "undefined" 文本' },
      { pattern: /\bnull\b/gi, message: '包含 "null" 文本' },
      { pattern: /\[missing\]/gi, message: '包含 "[missing]" 标记' },
    ];

    commonErrors.forEach(({ pattern, message }) => {
      if (pattern.test(text)) {
        results.push({
          type: 'common-error',
          severity: 'error',
          message: `${language} - ${message}`,
        });
      }
    });

    return results;
  }

  /**
   * 批量检查多个 URL
   */
  async checkMultipleUrls(
    urls: string[],
    languages: string[]
  ): Promise<MultilingualTestReport[]> {
    const reports: MultilingualTestReport[] = [];

    for (const url of urls) {
      try {
        const report = await this.checkMultilingualPage(url, languages);
        reports.push(report);
      } catch (error) {
        console.error(`Failed to check ${url}:`, error);
      }
    }

    return reports;
  }
}

// 导出单例
export const multilingualTestService = new MultilingualTestService();
