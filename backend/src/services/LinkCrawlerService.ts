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
}

// 导出单例
export const linkCrawlerService = new LinkCrawlerService();
export default linkCrawlerService;
