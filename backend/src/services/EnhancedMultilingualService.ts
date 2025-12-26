import { Page } from 'playwright';
import { languageCheckService, FormattedLanguageError } from './LanguageCheckService.js';
import browserPool from '../automation/BrowserPool.js';

/**
 * 增强的错误详情 - 包含原文和修正建议
 */
export interface EnhancedError {
  index: number;                    // 错误序号
  errorWord: string;                // 错误的单词
  severity: 'critical' | 'warning' | 'info';  // 严重程度
  originalText: string;             // 原文(包含上下文)
  suggestedFix: string;             // 修正建议(最佳修正)
  allSuggestions: string[];         // 所有建议
  category: string;                 // 错误类别
  issueType: string;                // 问题类型
  position: {
    start: number;
    end: number;
  };
  count?: number;                   // 该错误出现次数
}

/**
 * 增强的检查结果
 */
export interface EnhancedCheckResult {
  language: string;
  languageCode: string;
  url: string;
  totalErrors: number;              // 总错误数
  uniqueErrors: number;             // 去重后的错误数
  criticalCount: number;            // 严重错误数
  warningCount: number;             // 警告数
  infoCount: number;                // 提示数
  errors: EnhancedError[];          // 详细错误列表
  duplicateErrors: Map<string, number>;  // 重复错误统计
  summary: string;                  // 总结文本
  checkedAt: Date;
}

/**
 * 增强的多语言检查服务
 * 提供更准确的错误检测和更清晰的结果展示
 */
export class EnhancedMultilingualService {

  /**
   * 检查单个语言的页面内容
   */
  async checkLanguage(url: string, languageCode: string): Promise<EnhancedCheckResult> {
    const startTime = Date.now();

    // 1. 获取页面内容
    const pageText = await this.extractPageText(url, languageCode);

    // 2. 使用 LanguageTool 检查
    const rawErrors = await languageCheckService.checkText(pageText, languageCode);
    const formattedErrors = languageCheckService.formatErrors(rawErrors);

    // 3. 过滤常见误判
    const filteredErrors = this.filterCommonFalsePositives(formattedErrors, pageText);

    // 4. 增强错误信息
    const enhancedErrors = this.enhanceErrors(filteredErrors, pageText);

    // 5. 统计重复错误
    const duplicateStats = this.analyzeDuplicates(enhancedErrors);

    // 5. 生成结果
    const result: EnhancedCheckResult = {
      language: this.getLanguageName(languageCode),
      languageCode,
      url,
      totalErrors: enhancedErrors.length,
      uniqueErrors: duplicateStats.size,
      criticalCount: enhancedErrors.filter(e => e.severity === 'critical').length,
      warningCount: enhancedErrors.filter(e => e.severity === 'warning').length,
      infoCount: enhancedErrors.filter(e => e.severity === 'info').length,
      errors: enhancedErrors,
      duplicateErrors: duplicateStats,
      summary: this.generateSummary(enhancedErrors, duplicateStats),
      checkedAt: new Date(),
    };

    console.log(`[Enhanced Check] ${languageCode} completed in ${Date.now() - startTime}ms`);
    return result;
  }

  /**
   * 提取页面文本内容
   */
  private async extractPageText(url: string, languageCode: string): Promise<string> {
    let browser = null;
    let page: Page | null = null;

    try {
      browser = await browserPool.acquire();
      page = await browser.newPage();

      // 构建带语言参数的 URL
      const urlWithLang = new URL(url);
      urlWithLang.searchParams.set('lang', languageCode.split('-')[0]);

      await page.goto(urlWithLang.toString(), {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await page.waitForTimeout(3000);

      // 提取所有可见文本
      const text = await page.evaluate(() => {
        // 移除不需要检查的元素
        const excludeSelectors = ['script', 'style', 'noscript', 'iframe'];
        excludeSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        });

        return document.body.innerText || '';
      });

      return text;
    } finally {
      if (page) {
        await page.close();
      }
      if (browser) {
        await browserPool.release(browser);
      }
    }
  }

  /**
   * 过滤常见误判
   */
  private filterCommonFalsePositives(errors: FormattedLanguageError[], fullText: string): FormattedLanguageError[] {
    // 常见品牌名称和专有名词白名单
    const brandNames = [
      'anker', 'solix', 'solarbank', 'eufy', 'soundcore', 'nebula',
      'roav', 'powercore', 'powerport', 'powerline', 'powerwave',
      'nano', 'prime', 'gan', 'iq', 'piq', 'multisystem',
    ];

    return errors.filter(error => {
      // 提取错误单词
      const errorWord = fullText.substring(error.position.start, error.position.end).toLowerCase().trim();

      // 1. 过滤品牌名称
      if (brandNames.includes(errorWord)) {
        console.log(`[Filter] Ignoring brand name: ${errorWord}`);
        return false;
      }

      // 2. 过滤全大写的缩写 (如 USB, HDMI)
      if (errorWord === errorWord.toUpperCase() && errorWord.length <= 6) {
        console.log(`[Filter] Ignoring abbreviation: ${errorWord}`);
        return false;
      }

      // 3. 过滤包含数字的产品型号 (如 A1234, 3-Port)
      if (/\d/.test(errorWord) && errorWord.length <= 20) {
        console.log(`[Filter] Ignoring product model: ${errorWord}`);
        return false;
      }

      // 4. 过滤常见的技术术语组合
      const techTerms = ['plug&play', 'plug&go', 'usb-c', 'wi-fi', 'bluetooth'];
      if (techTerms.some(term => errorWord.includes(term))) {
        console.log(`[Filter] Ignoring tech term: ${errorWord}`);
        return false;
      }

      return true;
    });
  }

  /**
   * 增强错误信息 - 提取关键信息
   */
  private enhanceErrors(errors: FormattedLanguageError[], fullText: string): EnhancedError[] {
    return errors.map((error, index) => {
      // 从全文中提取错误单词
      const errorWord = fullText.substring(error.position.start, error.position.end);

      // 提取原文上下文(限制长度)
      const originalText = this.extractContext(error.context, 100);

      // 获取最佳修正建议
      const suggestedFix = error.suggestions[0] || '(无建议)';

      // 确定严重程度
      const severity = this.determineSeverity(error);

      return {
        index: index + 1,
        errorWord,
        severity,
        originalText,
        suggestedFix,
        allSuggestions: error.suggestions,
        category: error.category,
        issueType: error.issueType,
        position: error.position,
      };
    });
  }

  /**
   * 提取上下文文本(限制长度)
   */
  private extractContext(context: string, maxLength: number = 100): string {
    if (!context) return '';

    if (context.length <= maxLength) {
      return context;
    }

    // 截断并添加省略号
    return context.substring(0, maxLength) + '...';
  }

  /**
   * 确定错误严重程度
   */
  private determineSeverity(error: FormattedLanguageError): 'critical' | 'warning' | 'info' {
    // 拼写错误和语法错误视为严重
    const criticalTypes = ['misspelling', 'grammar', 'uncategorized'];

    if (criticalTypes.includes(error.issueType.toLowerCase())) {
      return 'critical';
    }

    if (error.severity === 'error') {
      return 'critical';
    }

    if (error.severity === 'warning') {
      return 'warning';
    }

    return 'info';
  }

  /**
   * 分析重复错误
   */
  private analyzeDuplicates(errors: EnhancedError[]): Map<string, number> {
    const duplicates = new Map<string, number>();

    errors.forEach(error => {
      const key = error.errorWord.toLowerCase();
      duplicates.set(key, (duplicates.get(key) || 0) + 1);
    });

    return duplicates;
  }

  /**
   * 生成总结文本
   */
  private generateSummary(errors: EnhancedError[], duplicates: Map<string, number>): string {
    const total = errors.length;
    const unique = duplicates.size;

    // 找出重复最多的错误
    let maxDuplicates = 0;
    let mostDuplicatedWord = '';

    duplicates.forEach((count, word) => {
      if (count > maxDuplicates && count > 1) {
        maxDuplicates = count;
        mostDuplicatedWord = word;
      }
    });

    let summary = `总计发现 ${total} 处语法/拼写错误`;

    if (maxDuplicates > 1) {
      summary += `,其中 "${mostDuplicatedWord}" 错误出现了 ${maxDuplicates} 次`;
    }

    summary += '。';

    // 按严重程度分类
    const critical = errors.filter(e => e.severity === 'critical').length;
    const warning = errors.filter(e => e.severity === 'warning').length;
    const info = errors.filter(e => e.severity === 'info').length;

    const breakdown = [];
    if (critical > 0) breakdown.push(`${critical} 处严重错误`);
    if (warning > 0) breakdown.push(`${warning} 处警告`);
    if (info > 0) breakdown.push(`${info} 处提示`);

    if (breakdown.length > 0) {
      summary += ` (${breakdown.join('、')})`;
    }

    return summary;
  }

  /**
   * 获取语言名称
   */
  private getLanguageName(code: string): string {
    const languageNames: Record<string, string> = {
      'en-US': 'English (US)',
      'de-DE': 'German',
      'fr-FR': 'French',
      'es': 'Spanish',
      'it': 'Italian',
      'pt': 'Portuguese',
      'nl': 'Dutch',
      'ru': 'Russian',
      'zh-CN': 'Chinese',
    };

    return languageNames[code] || code;
  }

  /**
   * 格式化输出为文本格式(类似截图)
   */
  formatAsText(result: EnhancedCheckResult): string {
    let output = '错误详情\n\n';

    // 按错误单词分组
    const grouped = this.groupErrorsByWord(result.errors);

    let index = 1;
    grouped.forEach((errors, word) => {
      const firstError = errors[0];
      const count = errors.length;

      // 序号和错误单词
      if (count > 1) {
        output += `${index}. "${word}" (出现${count}次)\n`;
      } else {
        const severityLabel = firstError.severity === 'critical' ? '严重' :
                               firstError.severity === 'warning' ? '警告' : '提示';
        output += `${index}. "${word}" (${severityLabel})\n`;
      }

      // 原文
      output += `   原文: ${firstError.originalText}\n`;

      // 修正 - 在原文中替换错误单词
      const correctedText = this.replaceInContext(
        firstError.originalText,
        word,
        firstError.suggestedFix
      );
      output += `   修正: ${correctedText}\n\n`;

      index++;
    });

    output += '---\n';
    output += result.summary;

    return output;
  }

  /**
   * 在上下文中替换错误单词(保持大小写)
   */
  private replaceInContext(context: string, errorWord: string, suggestedFix: string): string {
    // 使用正则表达式进行全词匹配替换
    const regex = new RegExp(this.escapeRegExp(errorWord), 'gi');
    return context.replace(regex, suggestedFix);
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 按错误单词分组
   */
  private groupErrorsByWord(errors: EnhancedError[]): Map<string, EnhancedError[]> {
    const grouped = new Map<string, EnhancedError[]>();

    errors.forEach(error => {
      const key = error.errorWord.toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(error);
    });

    return grouped;
  }
}

// 导出单例
export const enhancedMultilingualService = new EnhancedMultilingualService();
