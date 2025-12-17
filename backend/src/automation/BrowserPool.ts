import { chromium, Browser, BrowserContext } from 'playwright';

interface PooledBrowser {
  browser: Browser;
  inUse: boolean;
  lastHealthCheck?: number; // 上次健康检查时间戳
  crashCount?: number; // 崩溃计数
}

export class BrowserPool {
  private pool: PooledBrowser[] = [];
  private readonly poolSize = 5;
  private initPromise: Promise<void> | null = null;
  private waitQueue: Array<(browser: Browser) => void> = [];
  private maxContextsPerBrowser = 3; // 限制每个浏览器的最大上下文数
  private contextCounts = new Map<Browser, number>(); // 跟踪每个浏览器的上下文数
  private readonly healthCheckInterval = 60000; // 健康检查间隔: 1分钟
  private readonly maxCrashCount = 3; // 最大崩溃次数,超过则替换浏览器
  private healthCheckTimer: NodeJS.Timeout | null = null;

  // Initialize browser pool with 5 warm instances
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      console.log(`Initializing browser pool with ${this.poolSize} instances...`);

      const browserPromises = Array.from({ length: this.poolSize }, async () => {
        const browser = await chromium.launch({
          headless: true,
          args: [
            // 基础安全参数
            '--no-sandbox',
            '--disable-setuid-sandbox',

            // 内存和稳定性 - 关键修复
            '--disable-dev-shm-usage', // 使用 /tmp 而不是 /dev/shm
            '--disable-features=VizDisplayCompositor',
            '--disable-features=IsolateOrigins,site-per-process',
            '--single-process', // 使用单进程模式减少内存占用和崩溃
            '--no-zygote', // 禁用 zygote 进程

            // GPU 和渲染 - 完全禁用 GPU
            '--disable-gpu',
            '--disable-gpu-compositing',
            '--disable-software-rasterizer',
            '--disable-accelerated-2d-canvas',
            '--disable-gl-drawing-for-tests',
            '--disable-3d-apis',

            // 防止崩溃的关键参数
            '--disable-crash-reporter',
            '--disable-in-process-stack-traces',
            '--disable-logging',
            '--disable-breakpad',
            '--log-level=3',

            // 字体和渲染稳定性
            '--font-render-hinting=none',
            '--disable-font-subpixel-positioning',

            // 禁用可能导致崩溃的功能
            '--disable-web-security',
            '--disable-features=site-per-process',
            '--disable-blink-features=AutomationControlled',

            // 内存限制 - 更保守的设置
            '--js-flags=--max-old-space-size=512',
            '--max_old_space_size=512',

            // 额外的稳定性参数
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-sync',
            '--metrics-recording-only',
            '--disable-default-apps',
            '--mute-audio',
            '--no-first-run',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-ipc-flooding-protection',
          ],
          timeout: 60000, // 增加启动超时时间
        });

        // 监听浏览器崩溃事件
        browser.on('disconnected', () => {
          console.warn('⚠️  Browser disconnected, will be removed from pool');
          this.removeBrowser(browser);
        });

        this.contextCounts.set(browser, 0);

        return {
          browser,
          inUse: false,
          lastHealthCheck: Date.now(),
          crashCount: 0,
        };
      });

      this.pool = await Promise.all(browserPromises);
      console.log(`✓ Browser pool initialized with ${this.pool.length} instances`);

      // 启动定期健康检查
      this.startHealthCheck();
    })();

    return this.initPromise;
  }

  /**
   * 启动定期健康检查
   */
  private startHealthCheck(): void {
    // 清除旧的定时器
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // 每分钟检查一次浏览器健康状态
    this.healthCheckTimer = setInterval(async () => {
      console.log('[BrowserPool] Running health check...');

      for (const pooledBrowser of this.pool) {
        try {
          // 跳过正在使用的浏览器
          if (pooledBrowser.inUse) {
            continue;
          }

          // 检查浏览器是否仍然连接
          const isConnected = pooledBrowser.browser.isConnected();

          if (!isConnected) {
            console.warn('[BrowserPool] Found disconnected browser, replacing...');
            await this.removeBrowser(pooledBrowser.browser);
            continue;
          }

          // 检查崩溃次数
          if (pooledBrowser.crashCount && pooledBrowser.crashCount >= this.maxCrashCount) {
            console.warn(`[BrowserPool] Browser exceeded crash limit (${pooledBrowser.crashCount}), replacing...`);
            await this.removeBrowser(pooledBrowser.browser);
            continue;
          }

          // 更新健康检查时间
          pooledBrowser.lastHealthCheck = Date.now();
        } catch (error) {
          console.error('[BrowserPool] Health check error:', error);
        }
      }

      console.log(`[BrowserPool] Health check complete. Pool: ${this.pool.length}/${this.poolSize}`);
    }, this.healthCheckInterval);

    console.log('[BrowserPool] Health check started');
  }

  // Acquire a browser from the pool
  async acquire(): Promise<Browser> {
    // Ensure pool is initialized
    await this.initialize();

    // Find available and healthy browser
    const available = this.pool.find((item) => {
      if (item.inUse) return false;

      // 检查浏览器是否连接
      if (!item.browser.isConnected()) {
        console.warn('[BrowserPool] Skipping disconnected browser');
        // 异步替换崩溃的浏览器
        this.removeBrowser(item.browser).catch(err => {
          console.error('[BrowserPool] Failed to replace browser:', err);
        });
        return false;
      }

      // 检查崩溃次数
      if (item.crashCount && item.crashCount >= this.maxCrashCount) {
        console.warn('[BrowserPool] Skipping browser with too many crashes');
        this.removeBrowser(item.browser).catch(err => {
          console.error('[BrowserPool] Failed to replace browser:', err);
        });
        return false;
      }

      return true;
    });

    if (available) {
      available.inUse = true;
      console.log('✓ Browser acquired from pool');
      return available.browser;
    }

    // No available browsers, add to wait queue
    console.log('⌛ No available browsers, queuing request...');
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  // Release a browser back to the pool
  async release(browser: Browser): Promise<void> {
    const pooledBrowser = this.pool.find((item) => item.browser === browser);

    if (!pooledBrowser) {
      console.warn('⚠️  Attempted to release browser not in pool');
      return;
    }

    // 清理浏览器上下文以释放内存
    try {
      const contexts = browser.contexts();
      for (const context of contexts) {
        await context.close().catch(err => {
          console.warn('Failed to close context:', err.message);
        });
      }
      this.contextCounts.set(browser, 0);
    } catch (error) {
      console.warn('Error cleaning up browser contexts:', error);
    }

    pooledBrowser.inUse = false;

    // Check if anyone is waiting
    if (this.waitQueue.length > 0) {
      const nextWaiting = this.waitQueue.shift();
      if (nextWaiting) {
        pooledBrowser.inUse = true;
        console.log('✓ Browser reassigned to waiting request');
        nextWaiting(browser);
      }
    } else {
      console.log('✓ Browser released back to pool');
    }
  }

  // Remove a crashed browser from the pool and create a new one
  private async removeBrowser(browser: Browser): Promise<void> {
    const index = this.pool.findIndex((item) => item.browser === browser);

    if (index === -1) {
      return;
    }

    // Remove from pool
    this.pool.splice(index, 1);
    this.contextCounts.delete(browser);

    console.log(`Browser removed from pool. Pool size: ${this.pool.length}/${this.poolSize}`);

    // Create a new browser to replace it
    try {
      const newBrowser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-features=VizDisplayCompositor',
          '--disable-features=IsolateOrigins,site-per-process',
          '--single-process',
          '--no-zygote',
          '--disable-gpu',
          '--disable-gpu-compositing',
          '--disable-software-rasterizer',
          '--disable-accelerated-2d-canvas',
          '--disable-gl-drawing-for-tests',
          '--disable-3d-apis',
          '--disable-crash-reporter',
          '--disable-in-process-stack-traces',
          '--disable-logging',
          '--disable-breakpad',
          '--log-level=3',
          '--font-render-hinting=none',
          '--disable-font-subpixel-positioning',
          '--disable-web-security',
          '--disable-features=site-per-process',
          '--disable-blink-features=AutomationControlled',
          '--js-flags=--max-old-space-size=512',
          '--max_old_space_size=512',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-sync',
          '--metrics-recording-only',
          '--disable-default-apps',
          '--mute-audio',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-ipc-flooding-protection',
        ],
        timeout: 60000,
      });

      newBrowser.on('disconnected', () => {
        console.warn('⚠️  Replacement browser disconnected');
        this.removeBrowser(newBrowser);
      });

      this.contextCounts.set(newBrowser, 0);

      this.pool.push({
        browser: newBrowser,
        inUse: false,
        lastHealthCheck: Date.now(),
        crashCount: 0,
      });

      console.log(`✓ Replacement browser created. Pool size: ${this.pool.length}/${this.poolSize}`);
    } catch (error) {
      console.error('Failed to create replacement browser:', error);
    }
  }

  // Get pool statistics
  getStats(): { total: number; inUse: number; available: number; queued: number } {
    const inUse = this.pool.filter((item) => item.inUse).length;
    return {
      total: this.pool.length,
      inUse,
      available: this.pool.length - inUse,
      queued: this.waitQueue.length,
    };
  }

  // Graceful shutdown - close all browsers
  async shutdown(): Promise<void> {
    console.log('Closing browser pool...');

    // 停止健康检查
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('[BrowserPool] Health check stopped');
    }

    const closePromises = this.pool.map(async (item) => {
      try {
        await item.browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    });

    await Promise.all(closePromises);
    this.pool = [];
    this.contextCounts.clear();
    console.log('✓ Browser pool closed');
  }
}

// Singleton instance
export default new BrowserPool();
