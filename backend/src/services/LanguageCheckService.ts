import axios from 'axios';

/**
 * LanguageTool API 返回的错误格式
 */
interface LanguageToolError {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  context: {
    text: string;
    offset: number;
    length: number;
  };
  rule: {
    id: string;
    description: string;
    issueType: string;
    category: {
      id: string;
      name: string;
    };
  };
  replacements: Array<{ value: string }>;
  type: {
    typeName: string; // 'UnknownWord', 'Grammar', 'Style', etc.
  };
}

/**
 * LanguageTool API 响应格式
 */
interface LanguageToolResponse {
  software: {
    name: string;
    version: string;
  };
  language: {
    name: string;
    code: string;
  };
  matches: LanguageToolError[];
}

/**
 * 格式化后的语言错误
 */
export interface FormattedLanguageError {
  severity: 'error' | 'warning' | 'info';
  message: string;
  shortMessage: string;
  context: string;
  position: {
    start: number;
    end: number;
  };
  suggestions: string[];
  category: string;
  ruleId: string;
  issueType: string;
}

/**
 * 语言检查服务
 * 集成 LanguageTool 进行多语言文案检查
 */
export class LanguageCheckService {
  private apiUrl: string;
  private timeout: number = 30000; // 30秒超时

  constructor() {
    // 使用环境变量配置 LanguageTool API URL
    // Docker: http://languagetool:8010/v2/check
    // 本地: http://localhost:8010/v2/check
    this.apiUrl = process.env.LANGUAGETOOL_API_URL || 'http://localhost:8010/v2/check';
    console.log(`[LanguageCheckService] Using API URL: ${this.apiUrl}`);
  }

  /**
   * 检查文本的语言错误
   */
  async checkText(text: string, languageCode: string): Promise<LanguageToolError[]> {
    try {
      // 限制文本长度 - LanguageTool 免费 API 有以下限制:
      // 1. 文本大小限制: 20KB
      // 2. 检查时间限制: 20秒
      // 对于复杂的德语等语言,检查速度较慢,需要更短的文本
      // 我们限制为 5,000 字符以确保在 20秒内完成
      const maxLength = 5000;
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

      if (text.length > maxLength) {
        console.log(`[LanguageCheck] Text truncated from ${text.length} to ${maxLength} chars`);
      }

      console.log(`[LanguageCheck] Checking ${truncatedText.length} chars in ${languageCode}`);

      // 使用 URLSearchParams 将数据放在 POST body 中,而不是 URL 参数
      // 这样可以避免 414 "URI Too Long" 错误
      const formData = new URLSearchParams();
      formData.append('text', truncatedText);
      formData.append('language', languageCode);
      formData.append('enabledOnly', 'false');

      const response = await axios.post<LanguageToolResponse>(
        this.apiUrl,
        formData.toString(),
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const matches = response.data.matches || [];
      console.log(`[LanguageCheck] Found ${matches.length} issues in ${languageCode}`);

      return matches;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`[LanguageCheck] API error for ${languageCode}:`, error.message);
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`LanguageTool service is not available at ${this.apiUrl}`);
        }
      } else {
        console.error(`[LanguageCheck] Unexpected error for ${languageCode}:`, error);
      }
      throw error;
    }
  }

  /**
   * 格式化检查结果
   */
  formatErrors(errors: LanguageToolError[]): FormattedLanguageError[] {
    return errors.map(error => ({
      severity: this.getSeverity(error.type.typeName, error.rule.issueType),
      message: error.message,
      shortMessage: error.shortMessage || error.message,
      context: error.context.text,
      position: {
        start: error.offset,
        end: error.offset + error.length,
      },
      suggestions: error.replacements.slice(0, 5).map(r => r.value),
      category: error.rule.category.name,
      ruleId: error.rule.id,
      issueType: error.rule.issueType,
    }));
  }

  /**
   * 根据错误类型确定严重程度
   */
  private getSeverity(
    typeName: string,
    issueType: string
  ): 'error' | 'warning' | 'info' {
    // 基于 issueType 判断
    const criticalTypes = [
      'misspelling',
      'uncategorized',
      'grammar',
      'non-conformance',
    ];

    if (criticalTypes.includes(issueType.toLowerCase())) {
      return 'error';
    }

    // 基于 typeName 判断
    const severityMap: Record<string, 'error' | 'warning' | 'info'> = {
      'UnknownWord': 'error',
      'Hint': 'info',
      'Other': 'warning',
    };

    return severityMap[typeName] || 'warning';
  }

  /**
   * 获取支持的语言列表
   */
  async getSupportedLanguages(): Promise<Array<{ name: string; code: string }>> {
    try {
      const languagesUrl = this.apiUrl.replace('/check', '/languages');
      const response = await axios.get(languagesUrl, { timeout: 5000 });

      return response.data.map((lang: any) => ({
        name: lang.name,
        code: lang.code,
      }));
    } catch (error) {
      console.error('[LanguageCheck] Failed to fetch supported languages:', error);
      // 返回默认支持的语言
      return [
        { name: 'English (US)', code: 'en-US' },
        { name: 'German', code: 'de-DE' },
        { name: 'French', code: 'fr-FR' },
        { name: 'Spanish', code: 'es' },
        { name: 'Italian', code: 'it' },
        { name: 'Portuguese', code: 'pt' },
        { name: 'Dutch', code: 'nl' },
        { name: 'Russian', code: 'ru' },
        { name: 'Chinese', code: 'zh-CN' },
      ];
    }
  }

  /**
   * 检查服务健康状态
   */
  async healthCheck(): Promise<boolean> {
    try {
      const languagesUrl = this.apiUrl.replace('/check', '/languages');
      const response = await axios.get(languagesUrl, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      console.error('[LanguageCheck] Health check failed:', error);
      return false;
    }
  }

  /**
   * 将语言名称转换为 LanguageTool 代码
   */
  static getLanguageCode(language: string): string {
    const languageMap: Record<string, string> = {
      // 英文
      'english': 'en-US',
      'en': 'en-US',
      '英文': 'en-US',
      '英语': 'en-US',

      // 德语
      'german': 'de-DE',
      'de': 'de-DE',
      '德文': 'de-DE',
      '德语': 'de-DE',

      // 法语
      'french': 'fr-FR',
      'fr': 'fr-FR',
      '法文': 'fr-FR',
      '法语': 'fr-FR',

      // 西班牙语
      'spanish': 'es',
      'es': 'es',
      '西班牙语': 'es',

      // 意大利语
      'italian': 'it',
      'it': 'it',
      '意大利语': 'it',

      // 葡萄牙语
      'portuguese': 'pt',
      'pt': 'pt',
      '葡萄牙语': 'pt',

      // 荷兰语
      'dutch': 'nl',
      'nl': 'nl',
      '荷兰语': 'nl',

      // 俄语
      'russian': 'ru',
      'ru': 'ru',
      '俄语': 'ru',

      // 中文
      'chinese': 'zh-CN',
      'zh': 'zh-CN',
      '中文': 'zh-CN',
    };

    return languageMap[language.toLowerCase()] || 'en-US';
  }
}

// 导出单例
export const languageCheckService = new LanguageCheckService();
