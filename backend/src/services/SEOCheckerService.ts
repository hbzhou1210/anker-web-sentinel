import { Browser, Page } from 'playwright';
import browserPool from '../automation/BrowserPool.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('SEOCheckerService');

/**
 * Hreflang 链接信息
 */
export interface HreflangLink {
  lang: string;
  href: string;
  isValid: boolean;
  statusCode?: number;
  error?: string;
  warning?: string; // 警告信息(如语言代码不一致)
  validationDetails?: {
    isAccessible: boolean; // URL是否可访问
    isConsistent: boolean; // 语言代码与URL地区是否一致
    consistencyMessage?: string; // 一致性检查详细信息
  };
}

/**
 * SEO 检测报告
 */
export interface SEOReport {
  url: string;
  title: string | null;
  hreflangLinks: HreflangLink[];
  hreflangIssues?: {
    hasDuplicates: boolean; // 是否有重复的语言代码
    duplicates: string[]; // 重复的语言代码列表
    hasSelfReference: boolean; // 是否包含自引用
    inconsistentCount: number; // 语言代码不一致的数量
  };
  article: {
    dateModified: string | null;
    datePublished: string | null;
    author: string | null;
  };
  checkTime: Date;
  error?: string;
}

/**
 * SEO 检测服务
 */
export class SEOCheckerService {
  /**
   * 检查页面的 SEO 信息
   */
  async checkSEO(url: string): Promise<SEOReport> {
    logger.info('Starting SEO check', { url });

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      // 获取浏览器实例
      browser = await browserPool.acquire();
      page = await browser.newPage();

      // 访问页面
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      if (!response) {
        throw new Error('Failed to load page');
      }

      // 等待页面渲染
      await page.waitForTimeout(2000);

      // 提取 Title
      const title = await page.title().catch(() => null);
      logger.info('Page title extracted', { title });

      // 提取 Hreflang 链接
      const hreflangLinks = await this.extractHreflangLinks(page);
      logger.info('Hreflang links found', { count: hreflangLinks.length });

      // 提取 Article 信息（从 JSON-LD 或 meta 标签）
      const article = await this.extractArticleInfo(page);
      logger.info('Article info extracted', { article });

      // 验证 Hreflang 链接（检查是否 404）
      const validatedHreflangLinks = await this.validateHreflangLinks(hreflangLinks, browser);

      // 检测 Hreflang 问题
      const duplicateCheck = this.detectDuplicateLangCodes(validatedHreflangLinks);
      const hasSelfReference = this.validateSelfReference(url, validatedHreflangLinks);
      const inconsistentCount = validatedHreflangLinks.filter(
        link => link.validationDetails && !link.validationDetails.isConsistent
      ).length;

      const hreflangIssues = {
        hasDuplicates: duplicateCheck.hasDuplicates,
        duplicates: duplicateCheck.duplicates,
        hasSelfReference,
        inconsistentCount
      };

      return {
        url,
        title,
        hreflangLinks: validatedHreflangLinks,
        hreflangIssues,
        article,
        checkTime: new Date()
      };

    } catch (error: any) {
      logger.error('Error checking SEO', { url, error: error instanceof Error ? error.message : String(error) });
      return {
        url,
        title: null,
        hreflangLinks: [],
        article: {
          dateModified: null,
          datePublished: null,
          author: null
        },
        checkTime: new Date(),
        error: error.message
      };
    } finally {
      if (page) {
        await page.close().catch(err => logger.warn('Failed to close page', { error: err.message }));
      }
      if (browser) {
        await browserPool.release(browser);
      }
    }
  }

  /**
   * 提取页面中的 Hreflang 链接
   */
  private async extractHreflangLinks(page: Page): Promise<HreflangLink[]> {
    try {
      const hreflangLinks = await page.evaluate(() => {
        const links: Array<{ lang: string; href: string }> = [];

        // 从 <link rel="alternate" hreflang="..."> 标签提取
        document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((link) => {
          const lang = link.getAttribute('hreflang');
          const href = link.getAttribute('href');
          if (lang && href) {
            links.push({ lang, href });
          }
        });

        return links;
      });

      return hreflangLinks.map(link => ({
        lang: link.lang,
        href: link.href,
        isValid: false // 将在后续验证中更新
      }));
    } catch (error: any) {
      logger.warn('Failed to extract hreflang links', { error: error.message });
      return [];
    }
  }

  /**
   * 提取文章信息（JSON-LD 和 meta 标签）
   */
  private async extractArticleInfo(page: Page): Promise<{
    dateModified: string | null;
    datePublished: string | null;
    author: string | null;
  }> {
    try {
      const articleInfo = await page.evaluate(() => {
        let dateModified: string | null = null;
        let datePublished: string | null = null;
        let author: string | null = null;

        // 1. 尝试从 JSON-LD 提取 (推荐方式)
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');

        for (const script of Array.from(jsonLdScripts)) {
          try {
            const data = JSON.parse(script.textContent || '');

            // 支持单个对象或数组
            const items = Array.isArray(data) ? data : [data];

            for (const item of items) {
              // 查找 Article 类型
              if (item['@type'] === 'Article' ||
                  item['@type'] === 'NewsArticle' ||
                  item['@type'] === 'BlogPosting') {

                dateModified = item.dateModified || dateModified;
                datePublished = item.datePublished || datePublished;

                // 提取作者信息
                if (item.author) {
                  if (typeof item.author === 'string') {
                    author = item.author;
                  } else if (item.author.name) {
                    author = item.author.name;
                  } else if (Array.isArray(item.author) && item.author[0]?.name) {
                    author = item.author[0].name;
                  }
                }
              }
            }
          } catch (e) {
            // 忽略解析错误，继续检查其他 script 标签
          }
        }

        // 2. 如果 JSON-LD 没有找到，尝试从 meta 标签提取
        if (!dateModified) {
          const metaModified = document.querySelector('meta[property="article:modified_time"]') ||
                              document.querySelector('meta[name="article:modified_time"]');
          dateModified = metaModified?.getAttribute('content') || null;
        }

        if (!datePublished) {
          const metaPublished = document.querySelector('meta[property="article:published_time"]') ||
                               document.querySelector('meta[name="article:published_time"]') ||
                               document.querySelector('meta[property="datePublished"]');
          datePublished = metaPublished?.getAttribute('content') || null;
        }

        if (!author) {
          const metaAuthor = document.querySelector('meta[property="article:author"]') ||
                            document.querySelector('meta[name="author"]');
          author = metaAuthor?.getAttribute('content') || null;
        }

        return { dateModified, datePublished, author };
      });

      return articleInfo;
    } catch (error: any) {
      logger.warn('Failed to extract article info', { error: error.message });
      return {
        dateModified: null,
        datePublished: null,
        author: null
      };
    }
  }

  /**
   * 验证 Hreflang 链接是否有效（非404）
   */
  private async validateHreflangLinks(
    hreflangLinks: HreflangLink[],
    browser: Browser
  ): Promise<HreflangLink[]> {
    const validatedLinks: HreflangLink[] = [];

    for (const link of hreflangLinks) {
      let page: Page | null = null;

      try {
        logger.debug('Validating hreflang link', { lang: link.lang, href: link.href });

        page = await browser.newPage();

        // 设置较短的超时时间，只检查状态码
        const response = await page.goto(link.href, {
          waitUntil: 'commit',
          timeout: 15000
        });

        const statusCode = response?.status() || 0;
        const isAccessible = statusCode >= 200 && statusCode < 400;

        // 验证语言代码与URL地区代码的一致性
        const consistencyCheck = this.validateLangUrlConsistency(link.lang, link.href);

        // 综合判定: 既要可访问,也要语言代码一致
        const isValid = isAccessible && consistencyCheck.isConsistent;

        validatedLinks.push({
          ...link,
          isValid,
          statusCode,
          warning: consistencyCheck.message,
          validationDetails: {
            isAccessible,
            isConsistent: consistencyCheck.isConsistent,
            consistencyMessage: consistencyCheck.message
          }
        });

        logger.info('Hreflang link validated', {
          lang: link.lang,
          statusCode,
          isValid,
          message: consistencyCheck.message
        });

      } catch (error: any) {
        logger.warn('Failed to validate hreflang link', { lang: link.lang, error: error.message });

        validatedLinks.push({
          ...link,
          isValid: false,
          error: error.message
        });
      } finally {
        if (page) {
          await page.close().catch(() => {});
        }
      }
    }

    return validatedLinks;
  }

  /**
   * 验证语言代码与URL地区代码的一致性
   *
   * @param lang - 语言代码 (如 en-GB, en-US)
   * @param href - URL地址
   * @returns 一致性检查结果
   */
  private validateLangUrlConsistency(lang: string, href: string): {
    isConsistent: boolean;
    message?: string;
  } {
    try {
      // x-default 是特殊情况,始终有效
      if (lang === 'x-default') {
        return { isConsistent: true };
      }

      // 解析语言代码 (格式: language-region, 如 en-GB)
      const langParts = lang.toLowerCase().split('-');
      if (langParts.length < 2) {
        // 只有语言没有地区代码,无法验证
        return { isConsistent: true };
      }

      const [, region] = langParts; // 地区代码 (如 gb, us, ca)

      // 从URL中提取地区代码
      // 匹配模式: /xx/ 或 /xx- 或域名中的地区代码
      const urlLower = href.toLowerCase();

      // 尝试从路径中提取地区代码 (如 /ca/, /gb/, /eu-en/)
      const pathRegionMatch = urlLower.match(/\/([a-z]{2})(?:\/|-|$)/);
      const pathRegion = pathRegionMatch?.[1];

      // 地区代码映射表 (处理别名和常见变体)
      const regionMappings: Record<string, string[]> = {
        'gb': ['gb', 'uk'], // 英国
        'us': ['us', 'usa'], // 美国
        'au': ['au', 'australia'], // 澳大利亚
        'ca': ['ca', 'canada'], // 加拿大
        'ae': ['ae', 'uae'], // 阿联酋
        'nz': ['nz', 'newzealand'], // 新西兰
        'my': ['my', 'malaysia'], // 马来西亚
        'vn': ['vn', 'vietnam'], // 越南
        'pl': ['pl', 'poland'], // 波兰
        'de': ['de', 'germany'], // 德国
        'fr': ['fr', 'france'], // 法国
        'es': ['es', 'spain'], // 西班牙
        'it': ['it', 'italy'], // 意大利
        'jp': ['jp', 'japan'], // 日本
        'kr': ['kr', 'korea'], // 韩国
        'cn': ['cn', 'china'], // 中国
        'in': ['in', 'india'], // 印度
        'br': ['br', 'brazil'], // 巴西
        'mx': ['mx', 'mexico'], // 墨西哥
      };

      // 特殊情况: eu-xx (欧洲通用版本)
      if (pathRegion === 'eu') {
        // en-GB 指向 /eu-en/ 是不一致的，应该指向 /gb/ 或 /uk/
        if (region === 'gb' && urlLower.includes('/eu-en/')) {
          return {
            isConsistent: false,
            message: `Language code '${lang}' (region: ${region}) does not match URL region 'eu'. Expected URL to contain '/${region}/' or similar.`
          };
        }
      }

      // 如果没有找到路径中的地区代码,无法验证
      if (!pathRegion) {
        return { isConsistent: true };
      }

      // 获取允许的地区代码列表
      const allowedRegions = regionMappings[region] || [region];

      // 检查URL中的地区代码是否在允许列表中
      if (!allowedRegions.includes(pathRegion)) {
        return {
          isConsistent: false,
          message: `Language code '${lang}' (region: ${region}) does not match URL region '${pathRegion}'. Expected URL to contain '/${region}/' or similar.`
        };
      }

      return { isConsistent: true };

    } catch (error: any) {
      // 验证过程出错,保守地返回一致
      logger.warn('Error validating lang-url consistency', { error: error.message });
      return { isConsistent: true };
    }
  }

  /**
   * 检测重复的语言代码
   *
   * @param links - Hreflang链接列表
   * @returns 重复检测结果
   */
  private detectDuplicateLangCodes(links: HreflangLink[]): {
    hasDuplicates: boolean;
    duplicates: string[];
  } {
    const langCounts = new Map<string, number>();

    // 统计每个语言代码出现的次数
    links.forEach(link => {
      langCounts.set(link.lang, (langCounts.get(link.lang) || 0) + 1);
    });

    // 找出出现次数大于1的语言代码
    const duplicates = Array.from(langCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([lang]) => lang);

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates
    };
  }

  /**
   * 验证是否包含自引用
   * Google要求: 每个页面的hreflang应该包含指向自己的链接
   *
   * @param currentUrl - 当前页面URL
   * @param links - Hreflang链接列表
   * @returns 是否包含自引用
   */
  private validateSelfReference(currentUrl: string, links: HreflangLink[]): boolean {
    const normalizedCurrentUrl = this.normalizeUrl(currentUrl);

    return links.some(link => {
      const normalizedLinkUrl = this.normalizeUrl(link.href);
      return normalizedLinkUrl === normalizedCurrentUrl;
    });
  }

  /**
   * 标准化URL用于比较
   * 移除协议、尾部斜杠、查询参数等
   *
   * @param url - 原始URL
   * @returns 标准化后的URL
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // 移除协议和www,保留域名和路径
      let normalized = urlObj.hostname.replace(/^www\./, '') + urlObj.pathname;
      // 移除尾部斜杠
      normalized = normalized.replace(/\/$/, '');
      return normalized.toLowerCase();
    } catch {
      // URL解析失败,返回原始URL的小写形式
      return url.toLowerCase().replace(/\/$/, '');
    }
  }
}

// 导出单例实例
export const seoCheckerService = new SEOCheckerService();
