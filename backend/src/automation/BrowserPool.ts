import { chromium, Browser, BrowserContext } from 'playwright';

interface PooledBrowser {
  browser: Browser;
  inUse: boolean;
  lastHealthCheck?: number; // 上次健康检查时间戳
  crashCount?: number; // 崩溃计数
  createdAt: number; // 创建时间
  totalUsage: number; // 总使用次数
  lastError?: string; // 最后一次错误信息
}

interface BrowserPoolConfig {
  poolSize: number; // 连接池大小
  maxContextsPerBrowser: number; // 每个浏览器最大上下文数
  healthCheckInterval: number; // 健康检查间隔(毫秒)
  maxCrashCount: number; // 最大崩溃次数
  maxBrowserAge: number; // 浏览器最大存活时间(毫秒)
  maxBrowserUsage: number; // 浏览器最大使用次数
  launchTimeout: number; // 浏览器启动超时时间(毫秒)
}

interface BrowserPoolStats {
  total: number;
  inUse: number;
  available: number;
  queued: number;
  healthy: number;
  unhealthy: number;
  totalUsage: number;
  averageAge: number;
  oldestBrowserAge: number;
}

export class BrowserPool {
  private pool: PooledBrowser[] = [];
  private waitQueue: Array<(browser: Browser) => void> = [];
  private contextCounts = new Map<Browser, number>(); // 跟踪每个浏览器的上下文数
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private initPromise: Promise<void> | null = null;
  private isShuttingDown = false;

  // 可配置参数
  private config: BrowserPoolConfig = {
    poolSize: parseInt(process.env.BROWSER_POOL_SIZE || '5', 10),
    maxContextsPerBrowser: parseInt(process.env.MAX_CONTEXTS_PER_BROWSER || '3', 10),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000', 10), // 1分钟
    maxCrashCount: parseInt(process.env.MAX_CRASH_COUNT || '3', 10),
    maxBrowserAge: parseInt(process.env.MAX_BROWSER_AGE || '3600000', 10), // 1小时
    maxBrowserUsage: parseInt(process.env.MAX_BROWSER_USAGE || '100', 10),
    launchTimeout: parseInt(process.env.BROWSER_LAUNCH_TIMEOUT || '60000', 10),
  };

  // 统计数据
  private stats = {
    totalAcquired: 0,
    totalReleased: 0,
    totalCrashes: 0,
    totalReplacements: 0,
    totalHealthChecks: 0,
  };

  constructor(customConfig?: Partial<BrowserPoolConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
    console.log('[BrowserPool] Initialized with config:', this.config);
  }

  /**
   * 初始化浏览器池
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      console.log(`[BrowserPool] Initializing with ${this.config.poolSize} instances...`);

      const browserPromises = Array.from({ length: this.config.poolSize }, async (_, index) => {
        try {
          const browser = await this.createBrowser();
          console.log(`[BrowserPool] Browser ${index + 1}/${this.config.poolSize} created`);
          return {
            browser,
            inUse: false,
            lastHealthCheck: Date.now(),
            crashCount: 0,
            createdAt: Date.now(),
            totalUsage: 0,
          };
        } catch (error) {
          console.error(`[BrowserPool] Failed to create browser ${index + 1}:`, error);
          throw error;
        }
      });

      this.pool = await Promise.all(browserPromises);
      console.log(`✓ Browser pool initialized with ${this.pool.length} instances`);

      // 启动定期健康检查
      this.startHealthCheck();
    })();

    return this.initPromise;
  }

  /**
   * 创建新的浏览器实例
   */
  private async createBrowser(): Promise<Browser> {
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
      timeout: this.config.launchTimeout,
    });

    // 监听浏览器崩溃事件
    browser.on('disconnected', () => {
      console.warn('⚠️  Browser disconnected, will be removed from pool');
      this.handleBrowserDisconnect(browser);
    });

    this.contextCounts.set(browser, 0);

    return browser;
  }

  /**
   * 处理浏览器断连
   */
  private handleBrowserDisconnect(browser: Browser): void {
    const pooledBrowser = this.pool.find((item) => item.browser === browser);
    if (pooledBrowser) {
      this.stats.totalCrashes++;
      pooledBrowser.crashCount = (pooledBrowser.crashCount || 0) + 1;
      pooledBrowser.lastError = 'Browser disconnected';

      // 如果浏览器正在使用中,记录错误
      if (pooledBrowser.inUse) {
        console.error('[BrowserPool] Browser crashed while in use!');
      }

      // 异步替换浏览器
      this.removeBrowser(browser).catch(err => {
        console.error('[BrowserPool] Failed to handle browser disconnect:', err);
      });
    }
  }

  /**
   * 启动定期健康检查
   */
  private startHealthCheck(): void {
    // 清除旧的定时器
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // 定期检查浏览器健康状态
    this.healthCheckTimer = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      this.stats.totalHealthChecks++;
      console.log('[BrowserPool] Running health check...');

      const now = Date.now();
      const replacements: Promise<void>[] = [];

      for (const pooledBrowser of this.pool) {
        try {
          // 跳过正在使用的浏览器
          if (pooledBrowser.inUse) {
            continue;
          }

          // 检查1: 浏览器是否连接
          if (!pooledBrowser.browser.isConnected()) {
            console.warn('[BrowserPool] Found disconnected browser, replacing...');
            replacements.push(this.removeBrowser(pooledBrowser.browser));
            continue;
          }

          // 检查2: 崩溃次数是否超限
          if (pooledBrowser.crashCount && pooledBrowser.crashCount >= this.config.maxCrashCount) {
            console.warn(`[BrowserPool] Browser exceeded crash limit (${pooledBrowser.crashCount}), replacing...`);
            replacements.push(this.removeBrowser(pooledBrowser.browser));
            continue;
          }

          // 检查3: 浏览器年龄是否过大
          const age = now - pooledBrowser.createdAt;
          if (age > this.config.maxBrowserAge) {
            console.warn(`[BrowserPool] Browser too old (${Math.round(age / 60000)}min), replacing...`);
            replacements.push(this.removeBrowser(pooledBrowser.browser));
            continue;
          }

          // 检查4: 使用次数是否过多
          if (pooledBrowser.totalUsage >= this.config.maxBrowserUsage) {
            console.warn(`[BrowserPool] Browser used too many times (${pooledBrowser.totalUsage}), replacing...`);
            replacements.push(this.removeBrowser(pooledBrowser.browser));
            continue;
          }

          // 更新健康检查时间
          pooledBrowser.lastHealthCheck = now;
        } catch (error) {
          console.error('[BrowserPool] Health check error:', error);
          pooledBrowser.lastError = (error as Error).message;
        }
      }

      // 等待所有替换完成
      if (replacements.length > 0) {
        await Promise.allSettled(replacements);
        this.stats.totalReplacements += replacements.length;
      }

      const stats = this.getStats();
      console.log(`[BrowserPool] Health check complete. Stats:`, stats);
    }, this.config.healthCheckInterval);

    console.log('[BrowserPool] Health check started');
  }

  /**
   * 从池中获取浏览器
   */
  async acquire(): Promise<Browser> {
    // 确保池已初始化
    await this.initialize();

    if (this.isShuttingDown) {
      throw new Error('BrowserPool is shutting down');
    }

    // 查找可用且健康的浏览器
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
      if (item.crashCount && item.crashCount >= this.config.maxCrashCount) {
        console.warn('[BrowserPool] Skipping browser with too many crashes');
        this.removeBrowser(item.browser).catch(err => {
          console.error('[BrowserPool] Failed to replace browser:', err);
        });
        return false;
      }

      // 检查年龄
      const age = Date.now() - item.createdAt;
      if (age > this.config.maxBrowserAge) {
        console.warn('[BrowserPool] Skipping old browser');
        return false;
      }

      // 检查使用次数
      if (item.totalUsage >= this.config.maxBrowserUsage) {
        console.warn('[BrowserPool] Skipping overused browser');
        return false;
      }

      return true;
    });

    if (available) {
      available.inUse = true;
      available.totalUsage++;
      this.stats.totalAcquired++;
      console.log(`✓ Browser acquired from pool (usage: ${available.totalUsage}/${this.config.maxBrowserUsage})`);
      return available.browser;
    }

    // 没有可用的浏览器,加入等待队列
    console.log('⌛ No available browsers, queuing request...');
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * 释放浏览器回池
   */
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
      pooledBrowser.lastError = (error as Error).message;
    }

    pooledBrowser.inUse = false;
    this.stats.totalReleased++;

    // 检查是否有等待的请求
    if (this.waitQueue.length > 0) {
      const nextWaiting = this.waitQueue.shift();
      if (nextWaiting) {
        pooledBrowser.inUse = true;
        pooledBrowser.totalUsage++;
        console.log('✓ Browser reassigned to waiting request');
        nextWaiting(browser);
      }
    } else {
      console.log('✓ Browser released back to pool');
    }
  }

  /**
   * 从池中移除浏览器并创建新的替换
   */
  private async removeBrowser(browser: Browser): Promise<void> {
    const index = this.pool.findIndex((item) => item.browser === browser);

    if (index === -1) {
      return;
    }

    // 从池中移除
    const removed = this.pool.splice(index, 1)[0];
    this.contextCounts.delete(browser);

    console.log(`[BrowserPool] Browser removed from pool (age: ${Math.round((Date.now() - removed.createdAt) / 60000)}min, usage: ${removed.totalUsage}). Pool size: ${this.pool.length}/${this.config.poolSize}`);

    // 尝试关闭旧浏览器
    try {
      await browser.close();
    } catch (error) {
      console.warn('[BrowserPool] Error closing removed browser:', (error as Error).message);
    }

    // 创建新浏览器替换
    if (!this.isShuttingDown) {
      try {
        const newBrowser = await this.createBrowser();

        this.pool.push({
          browser: newBrowser,
          inUse: false,
          lastHealthCheck: Date.now(),
          crashCount: 0,
          createdAt: Date.now(),
          totalUsage: 0,
        });

        console.log(`✓ Replacement browser created. Pool size: ${this.pool.length}/${this.config.poolSize}`);

        // 如果有等待的请求,立即分配
        if (this.waitQueue.length > 0) {
          const nextWaiting = this.waitQueue.shift();
          if (nextWaiting) {
            const pooledBrowser = this.pool[this.pool.length - 1];
            pooledBrowser.inUse = true;
            pooledBrowser.totalUsage++;
            console.log('✓ New browser assigned to waiting request');
            nextWaiting(newBrowser);
          }
        }
      } catch (error) {
        console.error('[BrowserPool] Failed to create replacement browser:', error);
        // 如果创建失败,稍后重试
        setTimeout(() => {
          if (!this.isShuttingDown) {
            this.removeBrowser(browser).catch(err => {
              console.error('[BrowserPool] Failed to retry browser creation:', err);
            });
          }
        }, 5000);
      }
    }
  }

  /**
   * 获取池统计信息
   */
  getStats(): BrowserPoolStats {
    const inUse = this.pool.filter((item) => item.inUse).length;
    const healthy = this.pool.filter((item) =>
      item.browser.isConnected() &&
      (!item.crashCount || item.crashCount < this.config.maxCrashCount)
    ).length;

    const now = Date.now();
    const ages = this.pool.map(item => now - item.createdAt);
    const totalUsage = this.pool.reduce((sum, item) => sum + item.totalUsage, 0);

    return {
      total: this.pool.length,
      inUse,
      available: this.pool.length - inUse,
      queued: this.waitQueue.length,
      healthy,
      unhealthy: this.pool.length - healthy,
      totalUsage,
      averageAge: ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length / 1000) : 0,
      oldestBrowserAge: ages.length > 0 ? Math.round(Math.max(...ages) / 1000) : 0,
    };
  }

  /**
   * 获取详细统计信息
   */
  getDetailedStats() {
    return {
      pool: this.getStats(),
      lifetime: {
        totalAcquired: this.stats.totalAcquired,
        totalReleased: this.stats.totalReleased,
        totalCrashes: this.stats.totalCrashes,
        totalReplacements: this.stats.totalReplacements,
        totalHealthChecks: this.stats.totalHealthChecks,
      },
      config: this.config,
      browsers: this.pool.map(item => ({
        connected: item.browser.isConnected(),
        inUse: item.inUse,
        age: Math.round((Date.now() - item.createdAt) / 1000),
        usage: item.totalUsage,
        crashes: item.crashCount || 0,
        lastError: item.lastError,
      })),
    };
  }

  /**
   * 优雅关闭 - 关闭所有浏览器
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('[BrowserPool] Already shutting down...');
      return;
    }

    this.isShuttingDown = true;
    console.log('[BrowserPool] Closing browser pool...');

    // 停止健康检查
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('[BrowserPool] Health check stopped');
    }

    // 拒绝所有等待的请求
    while (this.waitQueue.length > 0) {
      const waiting = this.waitQueue.shift();
      if (waiting) {
        // 这里我们不能提供浏览器,但要防止Promise永久挂起
        console.warn('[BrowserPool] Rejecting waiting request due to shutdown');
      }
    }

    // 关闭所有浏览器
    const closePromises = this.pool.map(async (item) => {
      try {
        await item.browser.close();
      } catch (error) {
        console.error('[BrowserPool] Error closing browser:', error);
      }
    });

    await Promise.all(closePromises);
    this.pool = [];
    this.contextCounts.clear();

    console.log('[BrowserPool] ✓ Browser pool closed');
    console.log('[BrowserPool] Final stats:', this.stats);
  }
}

// Singleton instance
export default new BrowserPool();
