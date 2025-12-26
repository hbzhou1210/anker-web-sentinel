import { Browser, Page } from 'playwright';
import browserPool from '../automation/BrowserPool.js';

/**
 * Hreflang 链接信息
 */
export interface HreflangLink {
  lang: string;
  href: string;
  isValid: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * SEO 检测报告
 */
export interface SEOReport {
  url: string;
  title: string | null;
  hreflangLinks: HreflangLink[];
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
    console.log(`[SEOChecker] Starting SEO check for: ${url}`);

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
      console.log(`[SEOChecker] Title: ${title}`);

      // 提取 Hreflang 链接
      const hreflangLinks = await this.extractHreflangLinks(page);
      console.log(`[SEOChecker] Found ${hreflangLinks.length} hreflang links`);

      // 提取 Article 信息（从 JSON-LD 或 meta 标签）
      const article = await this.extractArticleInfo(page);
      console.log(`[SEOChecker] Article info:`, article);

      // 验证 Hreflang 链接（检查是否 404）
      const validatedHreflangLinks = await this.validateHreflangLinks(hreflangLinks, browser);

      return {
        url,
        title,
        hreflangLinks: validatedHreflangLinks,
        article,
        checkTime: new Date()
      };

    } catch (error: any) {
      console.error(`[SEOChecker] Error checking SEO for ${url}:`, error);
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
        await page.close().catch(err => console.warn(`[SEOChecker] Failed to close page: ${err.message}`));
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
      console.warn(`[SEOChecker] Failed to extract hreflang links: ${error.message}`);
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
      console.warn(`[SEOChecker] Failed to extract article info: ${error.message}`);
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
        console.log(`[SEOChecker] Validating hreflang link: ${link.lang} -> ${link.href}`);

        page = await browser.newPage();

        // 设置较短的超时时间，只检查状态码
        const response = await page.goto(link.href, {
          waitUntil: 'commit',
          timeout: 15000
        });

        const statusCode = response?.status() || 0;
        const isValid = statusCode >= 200 && statusCode < 400;

        validatedLinks.push({
          ...link,
          isValid,
          statusCode
        });

        console.log(`[SEOChecker] ✓ ${link.lang}: ${statusCode} ${isValid ? '(Valid)' : '(Invalid)'}`);

      } catch (error: any) {
        console.warn(`[SEOChecker] ✗ Failed to validate ${link.lang}: ${error.message}`);

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
}

// 导出单例实例
export const seoCheckerService = new SEOCheckerService();
