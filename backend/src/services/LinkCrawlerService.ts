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
   * 执行爬取 - 使用广度优先遍历（BFS）
   * Level 1: 用户输入的链接
   * Level 2: Level 1提取的所有链接
   * Level 3: Level 2所有链接提取的所有链接
   */
  private async executeCrawl(taskId: string, startUrl: string, maxDepth: number): Promise<void> {
    const task = this.crawlTasks.get(taskId);
    if (!task) return;

    let browser: Browser | null = null;

    try {
      browser = await browserPool.acquire();
      console.log(`[LinkCrawler] Browser acquired for task ${taskId}`);
      console.log(`[LinkCrawler] Starting BFS crawl with max depth: ${maxDepth}`);

      // 使用广度优先遍历（BFS）
      await this.crawlBFS(browser, task, startUrl, maxDepth);

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
   * 广度优先遍历（BFS）爬取
   * 逐层爬取：先完成整个Level N，再进入Level N+1
   * 优化：只爬取同域名链接，外部链接记录但不递归
   */
  private async crawlBFS(
    browser: Browser,
    task: LinkCrawlTask,
    startUrl: string,
    maxDepth: number
  ): Promise<void> {
    // 获取起始URL的域名，用于过滤外部链接
    const startUrlObj = new URL(startUrl);
    const baseDomain = startUrlObj.hostname;
    console.log(`[LinkCrawler] Base domain: ${baseDomain} (only same-domain links will be recursively crawled)`);

    // 当前层级要爬取的URL队列
    let currentLevelUrls: Array<{ url: string; parentUrl?: string }> = [
      { url: startUrl, parentUrl: undefined }
    ];

    // 从Level 1开始，逐层爬取
    for (let level = 1; level <= maxDepth; level++) {
      console.log(`\n========================================`);
      console.log(`[LinkCrawler] Starting Level ${level}/${maxDepth}`);
      console.log(`[LinkCrawler] URLs to crawl: ${currentLevelUrls.length}`);
      console.log(`========================================\n`);

      if (currentLevelUrls.length === 0) {
        console.log(`[LinkCrawler] No URLs to crawl at Level ${level}, stopping.`);
        break;
      }

      // 下一层级的URL队列
      const nextLevelUrls: Array<{ url: string; parentUrl: string }> = [];

      // 遍历当前层级的所有URL
      for (let i = 0; i < currentLevelUrls.length; i++) {
        const { url, parentUrl } = currentLevelUrls[i];

        console.log(`[LinkCrawler] [${i + 1}/${currentLevelUrls.length}] Crawling: ${url}`);

        // 检查是否已访问
        if (this.visitedUrls.has(url)) {
          console.log(`[LinkCrawler] ⊘ Already visited, skipping`);
          continue;
        }

        // 检查任务是否被暂停
        if (task.status === CrawlStatus.Paused) {
          console.log(`[LinkCrawler] ⏸ Task paused by user, stopping crawl`);
          return;
        }

        // 爬取当前URL并提取链接
        const extractedLinks = await this.crawlSinglePage(browser, task, url, level, parentUrl);

        // 如果未达最大深度，将同域名链接加入下一层级队列
        if (level < maxDepth && extractedLinks.length > 0) {
          let sameDomainCount = 0;
          let externalCount = 0;

          for (const childUrl of extractedLinks) {
            try {
              const childUrlObj = new URL(childUrl);

              // 检查是否为同域名链接
              if (childUrlObj.hostname === baseDomain) {
                nextLevelUrls.push({ url: childUrl, parentUrl: url });
                sameDomainCount++;
              } else {
                // 外部链接：记录但不递归爬取
                externalCount++;
                console.log(`[LinkCrawler] ⊗ External link detected: ${childUrl} (recorded but not crawled)`);

                // 记录外部链接到任务中
                task.links.push({
                  url: childUrl,
                  title: 'External Link',
                  level: level + 1,
                  parentUrl: url,
                  statusCode: undefined,
                  crawledAt: new Date(),
                  error: `External domain: ${childUrlObj.hostname}`
                });
              }
            } catch (error) {
              console.warn(`[LinkCrawler] Invalid URL: ${childUrl}`);
            }
          }

          console.log(`[LinkCrawler] ✓ Added ${sameDomainCount} same-domain links to Level ${level + 1} queue`);
          if (externalCount > 0) {
            console.log(`[LinkCrawler] ⊗ Skipped ${externalCount} external links (recorded but not crawled)`);
          }
        }
      }

      console.log(`\n[LinkCrawler] ✓ Completed Level ${level}: Crawled ${currentLevelUrls.length} URLs`);
      console.log(`[LinkCrawler] → Next Level ${level + 1} queue: ${nextLevelUrls.length} URLs\n`);

      // 准备下一层级
      currentLevelUrls = nextLevelUrls;
    }

    console.log(`[LinkCrawler] BFS crawl completed. Total links: ${task.links.length}`);
  }

  /**
   * 爬取单个页面并返回提取的链接
   */
  private async crawlSinglePage(
    browser: Browser,
    task: LinkCrawlTask,
    url: string,
    level: number,
    parentUrl?: string
  ): Promise<string[]> {
    let page: Page | null = null;
    let extractedLinks: string[] = [];

    try {
      page = await browser.newPage();

      // 页面加载策略：双重尝试
      let response = null;
      let navigationError = null;

      try {
        response = await page.goto(url, {
          waitUntil: 'commit',
          timeout: 45000
        });
      } catch (firstError: any) {
        navigationError = firstError;
        console.warn(`[LinkCrawler] First attempt failed: ${firstError.message}`);

        if (firstError.message.includes('Timeout')) {
          try {
            response = await page.goto(url, {
              waitUntil: 'networkidle',
              timeout: 60000
            });
            navigationError = null;
            console.log(`[LinkCrawler] Retry successful`);
          } catch (retryError: any) {
            console.warn(`[LinkCrawler] Retry also failed: ${retryError.message}`);
            navigationError = retryError;
          }
        }
      }

      if (navigationError) {
        throw navigationError;
      }

      const statusCode = response?.status();
      const title = await page.title().catch(() => 'Unknown Title');

      // 等待动态内容
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(2000);
      } catch (waitError: any) {
        console.warn(`[LinkCrawler] Wait error: ${waitError.message}`);
      }

      // 提取链接
      try {
        extractedLinks = await Promise.race([
          this.extractLinks(page, url),
          new Promise<string[]>((_, reject) =>
            setTimeout(() => reject(new Error('Link extraction timeout')), 20000)
          )
        ]);
        console.log(`[LinkCrawler] ✓ Extracted ${extractedLinks.length} links`);
      } catch (extractError: any) {
        console.warn(`[LinkCrawler] ✗ Failed to extract links: ${extractError.message}`);
        extractedLinks = [];
      }

      // 记录链接信息
      const crawledLink: CrawledLink = {
        url,
        title,
        level,
        parentUrl,
        statusCode,
        crawledAt: new Date(),
      };

      task.links.push(crawledLink);
      task.crawledLinks = task.links.length;
      this.visitedUrls.add(url);

      console.log(`[LinkCrawler] ✓ Recorded: ${title} | Status: ${statusCode}`);

    } catch (error: any) {
      console.error(`[LinkCrawler] ✗ Error: ${error.message}`);

      // 记录错误链接
      task.links.push({
        url,
        level,
        parentUrl,
        error: error.message || 'Unknown error',
        crawledAt: new Date(),
      });

      task.crawledLinks = task.links.length;
      this.visitedUrls.add(url);

    } finally {
      if (page) {
        await page.close().catch(err =>
          console.warn(`[LinkCrawler] Failed to close page: ${err.message}`)
        );
      }
    }

    return extractedLinks;
  }


  /**
   * 从页面HTML中提取所有链接
   * 包括: <a> 标签, JavaScript动态生成的链接, href属性中的链接等
   */
  private async extractLinks(page: Page, baseUrl: string): Promise<string[]> {
    // 在浏览器上下文中执行链接提取，获取所有可能的链接
    const links = await page.evaluate(() => {
      const allLinks = new Set<string>();

      // 1. 提取所有 <a> 标签的 href
      document.querySelectorAll('a[href]').forEach((anchor) => {
        const href = (anchor as HTMLAnchorElement).href;
        if (href && href.trim()) {
          allLinks.add(href);
        }
      });

      // 2. 提取所有 <link> 标签的 href (如 canonical, alternate 等)
      document.querySelectorAll('link[href]').forEach((link) => {
        const href = (link as HTMLLinkElement).href;
        if (href && href.trim() && !href.includes('.css') && !href.includes('.js')) {
          allLinks.add(href);
        }
      });

      // 3. 提取所有 <area> 标签的 href (图像地图)
      document.querySelectorAll('area[href]').forEach((area) => {
        const href = (area as HTMLAreaElement).href;
        if (href && href.trim()) {
          allLinks.add(href);
        }
      });

      // 4. 提取 data-href, data-url 等自定义属性中的链接
      document.querySelectorAll('[data-href], [data-url], [data-link]').forEach((elem) => {
        const dataHref = elem.getAttribute('data-href') ||
                        elem.getAttribute('data-url') ||
                        elem.getAttribute('data-link');
        if (dataHref && dataHref.trim()) {
          allLinks.add(dataHref);
        }
      });

      // 5. 提取所有带有 onclick 属性中包含 location.href 或 window.open 的链接
      document.querySelectorAll('[onclick]').forEach((elem) => {
        const onclick = elem.getAttribute('onclick') || '';
        // 匹配 location.href='...' 或 window.open('...')
        const matches = onclick.match(/(?:location\.href|window\.open)\s*=?\s*['"]([^'"]+)['"]/);
        if (matches && matches[1]) {
          allLinks.add(matches[1]);
        }
      });

      return Array.from(allLinks);
    });

    // 过滤和规范化链接
    const baseUrlObj = new URL(baseUrl);
    const normalizedLinks = new Set<string>();

    for (const link of links) {
      try {
        // 将相对链接转换为绝对链接
        const linkUrl = new URL(link, baseUrl);

        // 只爬取同域名的 HTTP/HTTPS 链接
        if (
          linkUrl.hostname === baseUrlObj.hostname &&
          (linkUrl.protocol === 'http:' || linkUrl.protocol === 'https:')
        ) {
          // 移除 hash 和 query 参数,避免重复
          const normalizedUrl = `${linkUrl.protocol}//${linkUrl.hostname}${linkUrl.pathname}`;

          // 过滤掉静态资源文件
          const isStaticResource = /\.(css|js|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip|mp4|mp3)$/i.test(linkUrl.pathname);

          if (!isStaticResource) {
            normalizedLinks.add(normalizedUrl);
          }
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
   * 暂停任务
   */
  pauseTask(taskId: string): boolean {
    const task = this.crawlTasks.get(taskId);
    if (!task) return false;

    if (task.status === CrawlStatus.Running) {
      task.status = CrawlStatus.Paused;
      task.completedAt = new Date();
      task.durationMs = Date.now() - task.startedAt.getTime();
      console.log(`[LinkCrawler] Task ${taskId} paused. Current progress: ${task.crawledLinks} links crawled`);
      return true;
    }

    return false;
  }

  /**
   * 恢复任务
   */
  resumeTask(taskId: string): boolean {
    const task = this.crawlTasks.get(taskId);
    if (!task) return false;

    if (task.status === CrawlStatus.Paused) {
      task.status = CrawlStatus.Running;
      task.completedAt = undefined;
      console.log(`[LinkCrawler] Task ${taskId} resumed. Continuing from ${task.crawledLinks} links`);
      // 注意：当前实现不支持真正的恢复爬取，只是状态切换
      // 如需实现真正的恢复功能，需要保存爬取进度并重新启动爬取
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
