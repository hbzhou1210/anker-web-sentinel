/**
 * 截图缓存服务
 * 使用 IndexedDB 存储截图的 Base64 数据，避免依赖服务器临时文件
 */

interface CachedScreenshot {
  url: string;
  base64: string;
  timestamp: number;
  expiresAt: number;
}

class ScreenshotCacheService {
  private dbName = 'ScreenshotCache';
  private storeName = 'screenshots';
  private version = 1;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  // 缓存过期时间：7天
  private readonly CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

  constructor() {
    this.initPromise = this.init();
  }

  /**
   * 初始化 IndexedDB
   */
  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('[ScreenshotCache] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[ScreenshotCache] IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建对象存储
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'url' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          console.log('[ScreenshotCache] Object store created');
        }
      };
    });
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * 从 URL 获取截图并转换为 Base64
   */
  private async fetchAndConvertToBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('[ScreenshotCache] Failed to fetch and convert:', url, error);
      throw error;
    }
  }

  /**
   * 获取缓存的截图
   */
  private async getCached(url: string): Promise<CachedScreenshot | null> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.get(url);

        request.onsuccess = () => {
          const cached = request.result as CachedScreenshot | undefined;

          // 检查是否过期
          if (cached) {
            const now = Date.now();
            if (now > cached.expiresAt) {
              console.log('[ScreenshotCache] Cache expired:', url);
              // 异步删除过期缓存
              this.delete(url).catch(console.error);
              resolve(null);
            } else {
              console.log('[ScreenshotCache] Cache hit:', url);
              resolve(cached);
            }
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error('[ScreenshotCache] Failed to get cached:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[ScreenshotCache] Get cached error:', error);
      return null;
    }
  }

  /**
   * 保存截图到缓存
   */
  private async save(url: string, base64: string): Promise<void> {
    try {
      const db = await this.ensureDB();
      const now = Date.now();

      const cached: CachedScreenshot = {
        url,
        base64,
        timestamp: now,
        expiresAt: now + this.CACHE_EXPIRY_MS,
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.put(cached);

        request.onsuccess = () => {
          console.log('[ScreenshotCache] Saved to cache:', url);
          resolve();
        };

        request.onerror = () => {
          console.error('[ScreenshotCache] Failed to save:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[ScreenshotCache] Save error:', error);
    }
  }

  /**
   * 删除缓存
   */
  private async delete(url: string): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.delete(url);

        request.onsuccess = () => {
          console.log('[ScreenshotCache] Deleted from cache:', url);
          resolve();
        };

        request.onerror = () => {
          console.error('[ScreenshotCache] Failed to delete:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[ScreenshotCache] Delete error:', error);
    }
  }

  /**
   * 获取截图（带缓存）
   * @param url 截图URL
   * @returns Base64 数据URL 或原始URL（如果缓存失败）
   */
  async getScreenshot(url: string): Promise<string> {
    try {
      // 1. 尝试从缓存获取
      const cached = await this.getCached(url);
      if (cached) {
        return cached.base64;
      }

      // 2. 从服务器获取并转换为 Base64
      console.log('[ScreenshotCache] Cache miss, fetching from server:', url);
      const base64 = await this.fetchAndConvertToBase64(url);

      // 3. 保存到缓存（异步，不阻塞返回）
      this.save(url, base64).catch(console.error);

      return base64;
    } catch (error) {
      console.error('[ScreenshotCache] Failed to get screenshot:', url, error);
      // 失败时返回原始URL，让浏览器尝试直接加载
      return url;
    }
  }

  /**
   * 预加载截图（用于后台缓存）
   */
  async preload(urls: string[]): Promise<void> {
    console.log(`[ScreenshotCache] Preloading ${urls.length} screenshots...`);

    // 并发预加载，但限制并发数量
    const batchSize = 3;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(url => this.getScreenshot(url)));
    }

    console.log('[ScreenshotCache] Preload completed');
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpired(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const now = Date.now();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);
        const index = objectStore.index('expiresAt');

        // 获取所有过期的记录
        const range = IDBKeyRange.upperBound(now);
        const request = index.openCursor(range);

        let deletedCount = 0;
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log(`[ScreenshotCache] Cleanup completed, deleted ${deletedCount} expired items`);
            resolve();
          }
        };

        request.onerror = () => {
          console.error('[ScreenshotCache] Cleanup failed:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[ScreenshotCache] Cleanup error:', error);
    }
  }

  /**
   * 清空所有缓存
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.clear();

        request.onsuccess = () => {
          console.log('[ScreenshotCache] All cache cleared');
          resolve();
        };

        request.onerror = () => {
          console.error('[ScreenshotCache] Failed to clear cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[ScreenshotCache] Clear all error:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{ count: number; totalSize: number }> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.getAll();

        request.onsuccess = () => {
          const items = request.result as CachedScreenshot[];
          const totalSize = items.reduce((sum, item) => sum + item.base64.length, 0);

          resolve({
            count: items.length,
            totalSize,
          });
        };

        request.onerror = () => {
          console.error('[ScreenshotCache] Failed to get stats:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[ScreenshotCache] Get stats error:', error);
      return { count: 0, totalSize: 0 };
    }
  }
}

// 导出单例
export const screenshotCache = new ScreenshotCacheService();

// 在页面加载时自动清理过期缓存
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    screenshotCache.cleanupExpired().catch(console.error);
  });
}
