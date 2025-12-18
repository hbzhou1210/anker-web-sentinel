import { chromium, Browser, BrowserContext } from 'playwright';

interface PooledBrowser {
  browser: Browser;
  inUse: boolean;
  lastHealthCheck?: number; // 上次健康检查时间戳
  crashCount?: number; // 崩溃计数
  createdAt: number; // 创建时间
  totalUsage: number; // 总使用次数
  lastError?: string; // 最后一次错误信息
  lastUsedAt?: number; // 最后使用时间(用于缩容判断)
}

interface BrowserPoolConfig {
  poolSize: number; // 初始连接池大小
  minPoolSize: number; // 最小连接池大小(缩容下限)
  maxPoolSize: number; // 最大连接池大小(扩容上限)
  maxContextsPerBrowser: number; // 每个浏览器最大上下文数
  healthCheckInterval: number; // 健康检查间隔(毫秒)
  maxCrashCount: number; // 最大崩溃次数
  maxBrowserAge: number; // 浏览器最大存活时间(毫秒)
  maxBrowserUsage: number; // 浏览器最大使用次数
  launchTimeout: number; // 浏览器启动超时时间(毫秒)
  acquireTimeout: number; // 获取浏览器超时时间(毫秒)
  scaleUpThreshold: number; // 扩容阈值:队列长度达到此值时触发扩容
  scaleDownThreshold: number; // 缩容阈值:空闲时间超过此值时触发缩容(毫秒)
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
  private waitQueue: Array<{
    resolve: (browser: Browser) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private contextCounts = new Map<Browser, number>(); // 跟踪每个浏览器的上下文数
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private initPromise: Promise<void> | null = null;
  private isShuttingDown = false;
  private isScaling = false; // 防止并发扩容

  // 可配置参数
  private config: BrowserPoolConfig = {
    poolSize: parseInt(process.env.BROWSER_POOL_SIZE || '5', 10),
    minPoolSize: parseInt(process.env.MIN_BROWSER_POOL_SIZE || '3', 10),
    maxPoolSize: parseInt(process.env.MAX_BROWSER_POOL_SIZE || '10', 10),
    maxContextsPerBrowser: parseInt(process.env.MAX_CONTEXTS_PER_BROWSER || '3', 10),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10), // 30秒(从60秒优化)
    maxCrashCount: parseInt(process.env.MAX_CRASH_COUNT || '3', 10),
    maxBrowserAge: parseInt(process.env.MAX_BROWSER_AGE || '1800000', 10), // 30分钟(从1小时优化)
    maxBrowserUsage: parseInt(process.env.MAX_BROWSER_USAGE || '30', 10), // 30次(从100次优化)
    launchTimeout: parseInt(process.env.BROWSER_LAUNCH_TIMEOUT || '60000', 10),
    acquireTimeout: parseInt(process.env.ACQUIRE_TIMEOUT || '120000', 10), // 2分钟
    scaleUpThreshold: parseInt(process.env.SCALE_UP_THRESHOLD || '3', 10), // 队列长度≥3时扩容
    scaleDownThreshold: parseInt(process.env.SCALE_DOWN_THRESHOLD || '60000', 10), // 空闲1分钟后缩容
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
            lastUsedAt: Date.now(),
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
        // 移除 --single-process，使用多进程模式提高稳定性
        // '--single-process',
        // 移除 --no-zygote，允许使用 zygote 进程以提高隔离性
        // '--no-zygote',

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

        // 内存限制 - 提高到 2GB 以支持复杂页面
        '--js-flags=--max-old-space-size=2048',
        '--max_old_space_size=2048',

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

      // 检查是否需要缩容
      this.checkScaleDown();

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
      available.lastUsedAt = Date.now();
      this.stats.totalAcquired++;
      console.log(`✓ Browser acquired from pool (usage: ${available.totalUsage}/${this.config.maxBrowserUsage})`);
      return available.browser;
    }

    // 没有可用的浏览器,检查是否需要扩容
    if (this.pool.length < this.config.maxPoolSize &&
        this.waitQueue.length >= this.config.scaleUpThreshold &&
        !this.isScaling) {
      console.log(`🔼 Scaling up: queue length ${this.waitQueue.length} >= threshold ${this.config.scaleUpThreshold}`);
      this.scaleUp().catch(err => {
        console.error('[BrowserPool] Failed to scale up:', err);
      });
    }

    // 加入等待队列,带超时机制
    console.log(`⌛ No available browsers, queuing request (queue: ${this.waitQueue.length}, pool: ${this.pool.length}/${this.config.maxPoolSize})...`);
    return new Promise((resolve, reject) => {
      const queueItem = {
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.waitQueue.push(queueItem);

      // 超时检查
      const timeoutId = setTimeout(() => {
        const index = this.waitQueue.indexOf(queueItem);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
          reject(new Error(`Acquire timeout after ${this.config.acquireTimeout}ms. Queue length: ${this.waitQueue.length}, Pool: ${this.pool.length}`));
        }
      }, this.config.acquireTimeout);

      // 如果成功获取,清除超时
      const originalResolve = queueItem.resolve;
      queueItem.resolve = (browser: Browser) => {
        clearTimeout(timeoutId);
        originalResolve(browser);
      };
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

    // 检查浏览器健康状态
    let isHealthy = true;
    if (!browser.isConnected()) {
      console.warn('⚠️  Browser disconnected during release, removing from pool');
      await this.removeBrowser(browser);
      return;
    }

    // 清理浏览器上下文以释放内存
    try {
      const contexts = browser.contexts();
      for (const context of contexts) {
        await context.close().catch(err => {
          console.warn('Failed to close context:', err.message);
          isHealthy = false;
        });
      }
      this.contextCounts.set(browser, 0);
    } catch (error) {
      console.warn('Error cleaning up browser contexts:', error);
      pooledBrowser.lastError = (error as Error).message;
      isHealthy = false;
    }

    // 如果浏览器不健康，从池中移除并替换
    if (!isHealthy) {
      console.warn('⚠️  Browser unhealthy during release, removing from pool');
      await this.removeBrowser(browser);
      return;
    }

    pooledBrowser.inUse = false;
    pooledBrowser.lastUsedAt = Date.now();
    this.stats.totalReleased++;

    // 检查是否有等待的请求
    if (this.waitQueue.length > 0) {
      const nextWaiting = this.waitQueue.shift();
      if (nextWaiting) {
        // 再次验证浏览器状态
        if (!browser.isConnected()) {
          console.warn('⚠️  Browser disconnected before reassignment, removing from pool');
          await this.removeBrowser(browser);
          // 将请求放回队列
          this.waitQueue.unshift(nextWaiting);
          return;
        }

        pooledBrowser.inUse = true;
        pooledBrowser.totalUsage++;
        pooledBrowser.lastUsedAt = Date.now();
        console.log('✓ Browser reassigned to waiting request');
        nextWaiting.resolve(browser);
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
          lastUsedAt: Date.now(),
        });

        console.log(`✓ Replacement browser created. Pool size: ${this.pool.length}/${this.config.poolSize}`);

        // 如果有等待的请求,立即分配
        if (this.waitQueue.length > 0) {
          const nextWaiting = this.waitQueue.shift();
          if (nextWaiting) {
            const pooledBrowser = this.pool[this.pool.length - 1];
            pooledBrowser.inUse = true;
            pooledBrowser.totalUsage++;
            pooledBrowser.lastUsedAt = Date.now();
            console.log('✓ New browser assigned to waiting request');
            nextWaiting.resolve(newBrowser);
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
   * 动态扩容:增加浏览器实例
   */
  private async scaleUp(): Promise<void> {
    if (this.isScaling || this.isShuttingDown) {
      return;
    }

    if (this.pool.length >= this.config.maxPoolSize) {
      console.log(`[BrowserPool] Already at max pool size (${this.pool.length}/${this.config.maxPoolSize})`);
      return;
    }

    this.isScaling = true;

    try {
      console.log(`[BrowserPool] 🔼 Scaling up from ${this.pool.length} to ${this.pool.length + 1} browsers...`);
      const newBrowser = await this.createBrowser();

      this.pool.push({
        browser: newBrowser,
        inUse: false,
        lastHealthCheck: Date.now(),
        crashCount: 0,
        createdAt: Date.now(),
        totalUsage: 0,
        lastUsedAt: Date.now(),
      });

      console.log(`✓ Scale up complete. Pool size: ${this.pool.length}/${this.config.maxPoolSize}`);

      // 如果有等待的请求,立即分配
      if (this.waitQueue.length > 0) {
        const nextWaiting = this.waitQueue.shift();
        if (nextWaiting) {
          const pooledBrowser = this.pool[this.pool.length - 1];
          pooledBrowser.inUse = true;
          pooledBrowser.totalUsage++;
          pooledBrowser.lastUsedAt = Date.now();
          console.log('✓ Scaled browser immediately assigned to waiting request');
          nextWaiting.resolve(newBrowser);
        }
      }
    } catch (error) {
      console.error('[BrowserPool] Failed to scale up:', error);
    } finally {
      this.isScaling = false;
    }
  }

  /**
   * 动态缩容:移除空闲浏览器
   */
  private checkScaleDown(): void {
    if (this.isShuttingDown || this.pool.length <= this.config.minPoolSize) {
      return;
    }

    const now = Date.now();
    const idleBrowsers = this.pool
      .filter(item => !item.inUse)
      .sort((a, b) => (a.lastUsedAt || a.createdAt) - (b.lastUsedAt || b.createdAt)); // 按最后使用时间排序

    // 找出空闲时间最长的浏览器
    for (const browserItem of idleBrowsers) {
      // 如果已经到达最小池大小,停止缩容
      if (this.pool.length <= this.config.minPoolSize) {
        break;
      }

      const idleTime = now - (browserItem.lastUsedAt || browserItem.createdAt);

      // 如果空闲时间超过阈值,移除这个浏览器
      if (idleTime > this.config.scaleDownThreshold) {
        console.log(`[BrowserPool] 🔽 Scaling down: removing browser idle for ${Math.round(idleTime / 1000)}s (threshold: ${Math.round(this.config.scaleDownThreshold / 1000)}s)`);

        // 异步移除,但不创建替换(通过直接删除实现)
        const index = this.pool.indexOf(browserItem);
        if (index !== -1) {
          this.pool.splice(index, 1);
          this.contextCounts.delete(browserItem.browser);

          console.log(`✓ Scale down complete. Pool size: ${this.pool.length}/${this.config.maxPoolSize} (min: ${this.config.minPoolSize})`);

          // 异步关闭浏览器
          browserItem.browser.close().catch(err => {
            console.warn('[BrowserPool] Error closing browser during scale down:', err);
          });

          // 只移除一个,下次健康检查再继续评估
          break;
        }
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
        waiting.reject(new Error('BrowserPool is shutting down'));
        console.warn('[BrowserPool] Rejected waiting request due to shutdown');
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
