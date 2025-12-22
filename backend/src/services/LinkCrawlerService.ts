/**
 * 链接爬取服务
 *
 * 功能:
 * - 从指定 URL 开始爬取页面链接
 * - 支持多级爬取(递归爬取子页面)
 * - 去重处理
 * - 记录爬取层级关系
 */

import { Browser, Page } from 'playwright';
import browserPool from '../automation/BrowserPool.js';
import { CrawledLink, LinkCrawlTask, CrawlStatus } from '../models/entities.js';
import { v4 as uuidv4 } from 'uuid';

export class LinkCrawlerService {
  private visitedUrls = new Set<string>();
  private crawlTasks = new Map<string, LinkCrawlTask>();

  /**
   * 开始爬取任务
   */
  async startCrawl(startUrl: string, maxDepth: number = 2): Promise<LinkCrawlTask> {
    const taskId = uuidv4();
    const task: LinkCrawlTask = {
      id: taskId,
      startUrl,
      maxDepth,
      mode: 'crawl',
      status: CrawlStatus.Running,
      totalLinks: 0,
      crawledLinks: 0,
      links: [],
      startedAt: new Date(),
    };

    this.crawlTasks.set(taskId, task);
    this.visitedUrls.clear();

    console.log(`[LinkCrawler] Starting crawl task ${taskId}: ${startUrl}, maxDepth=${maxDepth}`);

    // 异步执行爬取
    this.executeCrawl(taskId, startUrl, maxDepth).catch((error) => {
      console.error(`[LinkCrawler] Task ${taskId} failed:`, error);
      task.status = CrawlStatus.Failed;
      task.errorMessage = error.message;
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();
    });

    return task;
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): LinkCrawlTask | undefined {
    return this.crawlTasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): LinkCrawlTask[] {
    return Array.from(this.crawlTasks.values());
  }

  /**
   * 执行爬取
   */
  private async executeCrawl(taskId: string, startUrl: string, maxDepth: number): Promise<void> {
    const task = this.crawlTasks.get(taskId);
    if (!task) return;

    let browser: Browser | null = null;

    try {
      browser = await browserPool.acquire();
      console.log(`[LinkCrawler] Browser acquired for task ${taskId}`);

      // 从第1层开始爬取
      await this.crawlLevel(browser, task, startUrl, 1, maxDepth, undefined);

      // 更新任务状态
      task.status = CrawlStatus.Completed;
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();
      task.totalLinks = task.links.length;

      console.log(`[LinkCrawler] Task ${taskId} completed: ${task.totalLinks} links found in ${task.durationMs}ms`);
    } catch (error: any) {
      console.error(`[LinkCrawler] Task ${taskId} error:`, error);
      task.status = CrawlStatus.Failed;
      task.errorMessage = error.message;
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();
      throw error;
    } finally {
      if (browser) {
        await browserPool.release(browser);
        console.log(`[LinkCrawler] Browser released for task ${taskId}`);
      }
    }
  }

  /**
   * 爬取指定层级
   */
  private async crawlLevel(
    browser: Browser,
    task: LinkCrawlTask,
    url: string,
    currentLevel: number,
    maxDepth: number,
    parentUrl?: string
  ): Promise<void> {
    // 检查是否已访问
    if (this.visitedUrls.has(url)) {
      return;
    }

    // 检查层级是否超过最大深度
    if (currentLevel > maxDepth) {
      return;
    }

    this.visitedUrls.add(url);

    console.log(`[LinkCrawler] Crawling level ${currentLevel}: ${url}`);

    let page: Page | null = null;

    try {
      page = await browser.newPage();

      // 设置较短的超时时间
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      const statusCode = response?.status();
      const title = await page.title();

      // 记录当前链接
      const crawledLink: CrawledLink = {
        url,
        title,
        level: currentLevel,
        parentUrl,
        statusCode,
        crawledAt: new Date(),
      };

      task.links.push(crawledLink);
      task.crawledLinks = task.links.length;

      console.log(`[LinkCrawler] Found link at level ${currentLevel}: ${url} - ${title}`);

      // 如果还没到达最大深度,继续爬取当前页面的链接
      if (currentLevel < maxDepth) {
        const links = await this.extractLinks(page, url);
        console.log(`[LinkCrawler] Found ${links.length} links on ${url}`);

        // 递归爬取子链接
        for (const childUrl of links) {
          try {
            await this.crawlLevel(browser, task, childUrl, currentLevel + 1, maxDepth, url);
          } catch (error: any) {
            console.error(`[LinkCrawler] Failed to crawl ${childUrl}:`, error.message);

            // 记录失败的链接
            task.links.push({
              url: childUrl,
              level: currentLevel + 1,
              parentUrl: url,
              error: error.message,
              crawledAt: new Date(),
            });
          }
        }
      }
    } catch (error: any) {
      console.error(`[LinkCrawler] Error crawling ${url}:`, error);

      // 记录错误
      const crawledLink: CrawledLink = {
        url,
        level: currentLevel,
        parentUrl,
        error: error.message,
        crawledAt: new Date(),
      };

      task.links.push(crawledLink);
      task.crawledLinks = task.links.length;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * 从页面提取所有链接
   */
  private async extractLinks(page: Page, baseUrl: string): Promise<string[]> {
    const links = await page.$$eval('a[href]', (anchors) => {
      return anchors.map((a) => (a as HTMLAnchorElement).href).filter((href) => href);
    });

    // 过滤和规范化链接
    const baseUrlObj = new URL(baseUrl);
    const normalizedLinks = new Set<string>();

    for (const link of links) {
      try {
        const linkUrl = new URL(link, baseUrl);

        // 只爬取同域名的 HTTP/HTTPS 链接
        if (
          linkUrl.hostname === baseUrlObj.hostname &&
          (linkUrl.protocol === 'http:' || linkUrl.protocol === 'https:')
        ) {
          // 移除 hash 和 query 参数,避免重复
          const normalizedUrl = `${linkUrl.protocol}//${linkUrl.hostname}${linkUrl.pathname}`;
          normalizedLinks.add(normalizedUrl);
        }
      } catch (error) {
        // 忽略无效的 URL
      }
    }

    return Array.from(normalizedLinks);
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.crawlTasks.get(taskId);
    if (!task) return false;

    if (task.status === CrawlStatus.Running) {
      task.status = CrawlStatus.Failed;
      task.errorMessage = 'Task cancelled by user';
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();
      return true;
    }

    return false;
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): boolean {
    return this.crawlTasks.delete(taskId);
  }

  /**
   * 开始404检查任务
   */
  async start404Check(startUrl: string): Promise<LinkCrawlTask> {
    const taskId = uuidv4();
    const task: LinkCrawlTask = {
      id: taskId,
      startUrl,
      maxDepth: 2, // 固定2级: 起始页面+子链接
      mode: '404check',
      status: CrawlStatus.Running,
      totalLinks: 0,
      crawledLinks: 0,
      links: [],
      stats: {
        total404: 0,
        total200: 0,
        totalOther: 0,
      },
      startedAt: new Date(),
    };

    this.crawlTasks.set(taskId, task);

    console.log(`[404Check] Starting task ${taskId}: ${startUrl}`);

    // 异步执行404检查
    this.execute404Check(taskId, startUrl).catch((error) => {
      console.error(`[404Check] Task ${taskId} failed:`, error);
      task.status = CrawlStatus.Failed;
      task.errorMessage = error.message;
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();
    });

    return task;
  }

  /**
   * 开始CSV批量检查任务
   */
  async startCsvCheck(urls: string[]): Promise<LinkCrawlTask> {
    const taskId = uuidv4();
    const task: LinkCrawlTask = {
      id: taskId,
      startUrl: `CSV批量检查 (${urls.length} 个URL)`,
      maxDepth: 1, // CSV模式固定1级
      mode: 'csv',
      status: CrawlStatus.Running,
      totalLinks: urls.length,
      crawledLinks: 0,
      links: [],
      stats: {
        total404: 0,
        total200: 0,
        totalOther: 0,
      },
      startedAt: new Date(),
    };

    this.crawlTasks.set(taskId, task);

    console.log(`[CSVCheck] Starting task ${taskId}: ${urls.length} URLs`);

    // 异步执行CSV检查
    this.executeCsvCheck(taskId, urls).catch((error) => {
      console.error(`[CSVCheck] Task ${taskId} failed:`, error);
      task.status = CrawlStatus.Failed;
      task.errorMessage = error.message;
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();
    });

    return task;
  }

  /**
   * 执行404检查
   */
  private async execute404Check(taskId: string, startUrl: string): Promise<void> {
    const task = this.crawlTasks.get(taskId);
    if (!task) return;

    let browser: Browser | null = null;

    try {
      browser = await browserPool.acquire();
      const context = await browser.newContext();
      const page = await context.newPage();

      console.log(`[404Check] Checking start URL: ${startUrl}`);

      // 第1级: 检查起始页面
      let startStatus = 0;
      let startError: string | undefined;

      try {
        const startResponse = await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        startStatus = startResponse?.status() || 0;
      } catch (error: any) {
        startError = error.message;
        console.error(`[404Check] Error loading start URL:`, error.message);
      }

      const startLink: CrawledLink = {
        url: startUrl,
        level: 1,
        statusCode: startStatus || undefined,
        error: startError || (startStatus === 404 ? 'Page not found (404)' : undefined),
        crawledAt: new Date(),
      };

      task.links.push(startLink);
      task.crawledLinks++;

      // 更新统计
      if (startStatus === 404) {
        task.stats!.total404++;
      } else if (startStatus === 200) {
        task.stats!.total200++;
      } else {
        task.stats!.totalOther++;
      }

      // 第2级: 提取并检查子链接 (仅当主页面正常时)
      if (startStatus === 200) {
        console.log(`[404Check] Extracting links from page...`);
        const childUrls = await this.extractLinks(page, startUrl);
        console.log(`[404Check] Found ${childUrls.length} links`);

        // 检查每个子链接
        for (let i = 0; i < childUrls.length; i++) {
          const childUrl = childUrls[i];

          try {
            console.log(`[404Check] [${i + 1}/${childUrls.length}] Checking: ${childUrl}`);
            const childResponse = await page.goto(childUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            const childStatus = childResponse?.status() || 0;

            const childLink: CrawledLink = {
              url: childUrl,
              level: 2,
              parentUrl: startUrl,
              statusCode: childStatus,
              error: childStatus === 404 ? 'Page not found (404)' : undefined,
              crawledAt: new Date(),
            };

            task.links.push(childLink);
            task.crawledLinks++;

            // 更新统计
            if (childStatus === 404) {
              task.stats!.total404++;
            } else if (childStatus === 200) {
              task.stats!.total200++;
            } else {
              task.stats!.totalOther++;
            }
          } catch (error: any) {
            const childLink: CrawledLink = {
              url: childUrl,
              level: 2,
              parentUrl: startUrl,
              error: error.message,
              crawledAt: new Date(),
            };

            task.links.push(childLink);
            task.crawledLinks++;
            task.stats!.totalOther++;

            console.error(`[404Check] Error checking ${childUrl}:`, error.message);
          }
        }
      }

      // 更新任务状态
      task.status = CrawlStatus.Completed;
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();
      task.totalLinks = task.links.length;

      console.log(`[404Check] Task ${taskId} completed: ${task.totalLinks} links checked, ${task.stats!.total404} 404s found`);

      await context.close();
    } catch (error: any) {
      console.error(`[404Check] Task ${taskId} error:`, error);
      task.status = CrawlStatus.Failed;
      task.errorMessage = error.message;
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();
      throw error;
    } finally {
      if (browser) {
        await browserPool.release(browser);
      }
    }
  }

  /**
   * 执行CSV批量检查
   */
  private async executeCsvCheck(taskId: string, urls: string[]): Promise<void> {
    const task = this.crawlTasks.get(taskId);
    if (!task) return;

    let browser: Browser | null = null;

    try {
      browser = await browserPool.acquire();
      const context = await browser.newContext();
      const page = await context.newPage();

      // 逐个检查URL
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];

        try {
          console.log(`[CSVCheck] [${i + 1}/${urls.length}] Checking: ${url}`);
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          const status = response?.status() || 0;

          const link: CrawledLink = {
            url,
            level: 1,
            statusCode: status,
            error: status === 404 ? 'Page not found (404)' : undefined,
            crawledAt: new Date(),
          };

          task.links.push(link);
          task.crawledLinks++;

          // 更新统计
          if (status === 404) {
            task.stats!.total404++;
          } else if (status === 200) {
            task.stats!.total200++;
          } else {
            task.stats!.totalOther++;
          }
        } catch (error: any) {
          const link: CrawledLink = {
            url,
            level: 1,
            error: error.message,
            crawledAt: new Date(),
          };

          task.links.push(link);
          task.crawledLinks++;
          task.stats!.totalOther++;

          console.error(`[CSVCheck] Error checking ${url}:`, error.message);
        }
      }

      // 更新任务状态
      task.status = CrawlStatus.Completed;
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();

      console.log(`[CSVCheck] Task ${taskId} completed: ${task.totalLinks} URLs checked, ${task.stats!.total404} 404s found`);

      await context.close();
    } catch (error: any) {
      console.error(`[CSVCheck] Task ${taskId} error:`, error);
      task.status = CrawlStatus.Failed;
      task.errorMessage = error.message;
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();
      throw error;
    } finally {
      if (browser) {
        await browserPool.release(browser);
      }
    }
  }
}

// 导出单例
export const linkCrawlerService = new LinkCrawlerService();
export default linkCrawlerService;
