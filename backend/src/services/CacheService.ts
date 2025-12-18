import { createClient, RedisClientType } from 'redis';

/**
 * Redis 缓存服务
 * 提供统一的缓存访问接口
 */
export class CacheService {
  private client: RedisClientType | null = null;
  private isReady: boolean = false;
  private isEnabled: boolean = true;
  private connectPromise: Promise<void> | null = null;

  constructor() {
    this.isEnabled = process.env.REDIS_ENABLED !== 'false';

    if (!this.isEnabled) {
      console.log('[CacheService] Redis caching is disabled');
      return;
    }

    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10),
      },
    });

    // 错误处理
    this.client.on('error', (err) => {
      console.error('[CacheService] Redis Error:', err);
      this.isReady = false;
    });

    // 连接成功
    this.client.on('ready', () => {
      console.log('[CacheService] Redis connected and ready');
      this.isReady = true;
    });

    // 连接断开
    this.client.on('end', () => {
      console.log('[CacheService] Redis connection closed');
      this.isReady = false;
    });

    // 重新连接
    this.client.on('reconnecting', () => {
      console.log('[CacheService] Redis reconnecting...');
    });
  }

  /**
   * 连接到 Redis
   */
  async connect(): Promise<void> {
    if (!this.isEnabled || !this.client) {
      return;
    }

    // 如果已经在连接中,等待连接完成
    if (this.connectPromise) {
      return this.connectPromise;
    }

    // 如果已经连接,直接返回
    if (this.isReady) {
      return;
    }

    // 开始连接
    this.connectPromise = this.client
      .connect()
      .then(() => {
        console.log('[CacheService] Successfully connected to Redis');
      })
      .catch((err) => {
        console.error('[CacheService] Failed to connect to Redis:', err);
        this.isEnabled = false; // 禁用缓存,避免后续调用失败
      })
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  /**
   * 获取缓存值
   * @param key 缓存键
   * @returns 缓存值,如果不存在则返回 null
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.isReady || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[CacheService] Failed to get cache for key "${key}":`, error);
      return null;
    }
  }

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间(秒),默认 300 秒(5分钟)
   */
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    if (!this.isEnabled || !this.isReady || !this.client) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttl, serialized);
    } catch (error) {
      console.error(`[CacheService] Failed to set cache for key "${key}":`, error);
    }
  }

  /**
   * 删除缓存键
   * @param key 缓存键
   */
  async del(key: string): Promise<void> {
    if (!this.isEnabled || !this.isReady || !this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`[CacheService] Failed to delete cache for key "${key}":`, error);
    }
  }

  /**
   * 删除匹配模式的所有缓存键
   * @param pattern 匹配模式 (例如: "patrol:task:*")
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isEnabled || !this.isReady || !this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(keys);
      console.log(`[CacheService] Invalidated ${keys.length} cache keys matching "${pattern}"`);
      return keys.length;
    } catch (error) {
      console.error(`[CacheService] Failed to invalidate pattern "${pattern}":`, error);
      return 0;
    }
  }

  /**
   * 检查缓存键是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.isReady || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      console.error(`[CacheService] Failed to check existence for key "${key}":`, error);
      return false;
    }
  }

  /**
   * 设置缓存过期时间
   * @param key 缓存键
   * @param ttl 过期时间(秒)
   */
  async expire(key: string, ttl: number): Promise<void> {
    if (!this.isEnabled || !this.isReady || !this.client) {
      return;
    }

    try {
      await this.client.expire(key, ttl);
    } catch (error) {
      console.error(`[CacheService] Failed to set expiration for key "${key}":`, error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{ keys: number; memory: string; hits: string; misses: string } | null> {
    if (!this.isEnabled || !this.isReady || !this.client) {
      return null;
    }

    try {
      const info = await this.client.info('stats');
      const memory = await this.client.info('memory');

      // 解析 INFO 命令返回的数据
      const parseInfo = (data: string): Record<string, string> => {
        const result: Record<string, string> = {};
        data.split('\r\n').forEach((line) => {
          if (line && !line.startsWith('#')) {
            const [key, value] = line.split(':');
            if (key && value) {
              result[key] = value;
            }
          }
        });
        return result;
      };

      const statsData = parseInfo(info);
      const memoryData = parseInfo(memory);

      return {
        keys: await this.client.dbSize(),
        memory: memoryData.used_memory_human || '0',
        hits: statsData.keyspace_hits || '0',
        misses: statsData.keyspace_misses || '0',
      };
    } catch (error) {
      console.error('[CacheService] Failed to get cache stats:', error);
      return null;
    }
  }

  /**
   * 清空所有缓存
   */
  async flush(): Promise<void> {
    if (!this.isEnabled || !this.isReady || !this.client) {
      return;
    }

    try {
      await this.client.flushDb();
      console.log('[CacheService] All cache cleared');
    } catch (error) {
      console.error('[CacheService] Failed to flush cache:', error);
    }
  }

  /**
   * 断开 Redis 连接
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.quit();
      console.log('[CacheService] Redis connection closed gracefully');
    } catch (error) {
      console.error('[CacheService] Failed to close Redis connection:', error);
    }
  }

  /**
   * 获取缓存是否已启用
   */
  isAvailable(): boolean {
    return this.isEnabled && this.isReady;
  }
}

// 导出单例实例
export default new CacheService();
