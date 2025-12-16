import { chromium, Browser, BrowserContext } from 'playwright';

interface PooledBrowser {
  browser: Browser;
  inUse: boolean;
}

export class BrowserPool {
  private pool: PooledBrowser[] = [];
  private readonly poolSize = 5;
  private initPromise: Promise<void> | null = null;
  private waitQueue: Array<(browser: Browser) => void> = [];

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
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-gpu-compositing',
            '--disable-software-rasterizer',
            '--disable-accelerated-2d-canvas',
            '--disable-gl-drawing-for-tests',
            '--disable-features=IsolateOrigins,site-per-process',
            // 注意: 不使用 --single-process,因为它可能导致浏览器不稳定
          ],
        });

        return {
          browser,
          inUse: false,
        };
      });

      this.pool = await Promise.all(browserPromises);
      console.log(`✓ Browser pool initialized with ${this.pool.length} instances`);
    })();

    return this.initPromise;
  }

  // Acquire a browser from the pool
  async acquire(): Promise<Browser> {
    // Ensure pool is initialized
    await this.initialize();

    // Find available browser
    const available = this.pool.find((item) => !item.inUse);

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
  release(browser: Browser): void {
    const pooledBrowser = this.pool.find((item) => item.browser === browser);

    if (!pooledBrowser) {
      console.warn('⚠️  Attempted to release browser not in pool');
      return;
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

    const closePromises = this.pool.map(async (item) => {
      try {
        await item.browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    });

    await Promise.all(closePromises);
    this.pool = [];
    console.log('✓ Browser pool closed');
  }
}

// Singleton instance
export default new BrowserPool();
