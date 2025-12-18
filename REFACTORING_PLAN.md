# Anker Web Sentinel 全面重构计划

> **目标**: 1-2周完成系统性改造,解决性能和稳定性问题,提升代码质量和架构
> **优先级**: 性能和稳定性 > 代码质量 > 架构优化

---

## 📊 执行计划概览

### 阶段划分

| 阶段 | 时间 | 重点 | 预期收益 |
|------|------|------|----------|
| 🔥 第1-3天 | 关键性能优化 | 响应时间↓50%, 吞吐量↑2x | ⭐⭐⭐⭐⭐ |
| 🏗️ 第4-7天 | 架构重构 | 可维护性↑,扩展性↑ | ⭐⭐⭐⭐ |
| 🧹 第8-10天 | 代码质量改进 | 类型安全,错误处理 | ⭐⭐⭐ |
| 🚀 第11-14天 | 新技术引入 | 性能监控,优化工具 | ⭐⭐⭐ |

---

## 🔥 阶段 1: 关键性能优化 (第1-3天)

### 目标
- **响应时间减少 50%**
- **吞吐量提升 2 倍**
- **崩溃率降低到 < 1%**

### 1.1 添加 Redis 查询缓存 (第1天上午)

#### 任务清单
- [ ] 安装和配置 Redis
- [ ] 创建 CacheService 抽象层
- [ ] 为热点查询添加缓存
- [ ] 实现缓存失效策略

#### 实施细节

**文件**: `backend/src/services/CacheService.ts` (新建)

```typescript
import { createClient, RedisClientType } from 'redis';

export class CacheService {
  private client: RedisClientType;
  private isReady: boolean = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.client.on('error', (err) => console.error('Redis Error:', err));
    this.client.on('ready', () => this.isReady = true);
  }

  async connect(): Promise<void> {
    if (!this.isReady) {
      await this.client.connect();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    await this.client.setEx(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}

export default new CacheService();
```

**修改**: `backend/src/models/repositories/BitablePatrolTaskRepository.ts`

```typescript
import cacheService from '../../services/CacheService.js';

export class BitablePatrolTaskRepository {
  private readonly CACHE_PREFIX = 'patrol:task:';
  private readonly CACHE_TTL = 300; // 5分钟

  async findById(id: string): Promise<PatrolTask | null> {
    // 1. 尝试从缓存读取
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await cacheService.get<PatrolTask>(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return cached;
    }

    // 2. 缓存未命中,查询飞书
    const result = await feishuApiService.searchRecords(/* ... */);

    if (result.items && result.items.length > 0) {
      const task = this.recordToPatrolTask(result.items[0]);

      // 3. 写入缓存
      await cacheService.set(cacheKey, task, this.CACHE_TTL);
      console.log(`[Cache MISS] ${cacheKey}`);

      return task;
    }

    return null;
  }

  async update(id: string, updates: Partial<PatrolTask>): Promise<PatrolTask | null> {
    const updated = await feishuApiService.updateRecord(/* ... */);

    // 更新后立即失效缓存
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    await cacheService.del(cacheKey);

    return updated;
  }
}
```

**预期收益**:
- 巡检任务查询响应时间: 500ms → 50ms (↓90%)
- 减少飞书 API 调用 80%
- 降低 API 速率限制风险

---

### 1.2 并行化 URL 测试 (第1天下午)

#### 任务清单
- [ ] 重构 PatrolService.executeTask 方法
- [ ] 实现并发控制(p-limit)
- [ ] 添加并行度配置
- [ ] 测试并行执行稳定性

#### 实施细节

**文件**: `backend/src/services/PatrolService.ts`

```typescript
import pLimit from 'p-limit';

export class PatrolService {
  private readonly MAX_CONCURRENT_URLS = parseInt(
    process.env.MAX_CONCURRENT_URLS || '3',
    10
  );

  async executeTask(taskId: string): Promise<PatrolExecution> {
    const task = await this.taskRepository.findById(taskId);
    const browser = await browserPool.acquire();

    try {
      const context = await browser.newContext();

      // 并行测试所有 URL,限制并发数
      const limit = pLimit(this.MAX_CONCURRENT_URLS);

      const testPromises = task.urls.map((urlConfig) =>
        limit(async () => {
          let page = null;
          try {
            page = await context.newPage();
            return await this.testUrlWithRetry(
              page,
              urlConfig.url,
              urlConfig.name,
              config
            );
          } finally {
            if (page && !page.isClosed()) {
              await page.close().catch(err =>
                console.warn('Failed to close page:', err)
              );
            }
          }
        })
      );

      const testResults = await Promise.allSettled(testPromises);

      // 处理结果
      const results = testResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`URL ${task.urls[index].url} failed:`, result.reason);
          return {
            url: task.urls[index].url,
            name: task.urls[index].name,
            status: 'fail',
            errorMessage: result.reason.message,
          };
        }
      });

      await context.close();
      return this.createExecution(task, results);

    } finally {
      await browserPool.release(browser);
    }
  }
}
```

**预期收益**:
- 10个URL测试时间: 5分钟 → 1.5分钟 (↓70%)
- 用户体验显著提升
- 调度器积压减少

---

### 1.3 优化浏览器池配置 (第2天上午)

#### 任务清单
- [ ] 实现动态扩容机制
- [ ] 添加队列超时处理
- [ ] 优化健康检查频率
- [ ] 调整浏览器启动参数

#### 实施细节

**文件**: `backend/src/automation/BrowserPool.ts`

```typescript
export class BrowserPool {
  private config: BrowserPoolConfig = {
    poolSize: parseInt(process.env.BROWSER_POOL_SIZE || '5', 10),
    maxPoolSize: parseInt(process.env.MAX_BROWSER_POOL_SIZE || '10', 10), // 新增
    minPoolSize: parseInt(process.env.MIN_BROWSER_POOL_SIZE || '3', 10), // 新增
    scaleUpThreshold: parseInt(process.env.SCALE_UP_THRESHOLD || '3', 10), // 队列长度阈值
    scaleDownThreshold: parseInt(process.env.SCALE_DOWN_THRESHOLD || '60000', 10), // 空闲时间
    healthCheckInterval: 30000, // 从60秒减少到30秒
    acquireTimeout: 120000, // 新增:获取浏览器超时时间(2分钟)
    // ... 其他配置
  };

  private waitQueue: Array<{
    resolve: (browser: Browser) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  async acquire(): Promise<Browser> {
    await this.initialize();

    // ... 查找可用浏览器逻辑 ...

    // 如果池未满且队列较长,尝试扩容
    if (this.pool.length < this.config.maxPoolSize &&
        this.waitQueue.length >= this.config.scaleUpThreshold) {
      console.log('🔼 Scaling up: creating additional browser...');
      this.createBrowser().then(browser => {
        this.pool.push({
          browser,
          inUse: false,
          crashCount: 0,
          createdAt: Date.now(),
          totalUsage: 0,
        });
        console.log(`✓ Pool scaled up to ${this.pool.length} browsers`);
      }).catch(err => {
        console.error('Failed to scale up:', err);
      });
    }

    // 加入等待队列,带超时机制
    return new Promise((resolve, reject) => {
      const queueItem = {
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.waitQueue.push(queueItem);

      // 超时检查
      setTimeout(() => {
        const index = this.waitQueue.indexOf(queueItem);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
          reject(new Error(`Acquire timeout after ${this.config.acquireTimeout}ms`));
        }
      }, this.config.acquireTimeout);
    });
  }

  // 新增:自动缩容检查
  private checkScaleDown(): void {
    const idleBrowsers = this.pool.filter(item => !item.inUse);

    // 如果空闲浏览器过多且超过最小池大小,缩容
    if (idleBrowsers.length > 2 && this.pool.length > this.config.minPoolSize) {
      const idleTime = Date.now() - Math.max(
        ...idleBrowsers.map(b => b.lastHealthCheck || b.createdAt)
      );

      if (idleTime > this.config.scaleDownThreshold) {
        const browserToRemove = idleBrowsers[0];
        console.log('🔽 Scaling down: removing idle browser...');
        this.removeBrowser(browserToRemove.browser);
      }
    }
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
      this.checkScaleDown(); // 新增缩容检查
    }, this.config.healthCheckInterval);
  }
}
```

**预期收益**:
- 队列等待时间减少 80%
- 高峰期吞吐量提升 2x
- 低谷期资源节省 40%

---

### 1.4 优化数据压缩策略 (第2天下午)

#### 任务清单
- [ ] 实现流式数据处理
- [ ] 添加压缩结果缓存
- [ ] 优化大数据存储方案
- [ ] 实现数据分片优化

#### 实施细节

**文件**: `backend/src/services/FeishuBitableService.ts`

```typescript
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable, Writable } from 'stream';

export class FeishuBitableService {
  // 使用流式压缩,避免大数据占用内存
  private async compressJSONStream(data: any): Promise<string> {
    const jsonStr = JSON.stringify(data);

    // 小数据直接处理
    if (jsonStr.length < 10000) {
      return this.compressJSON(data);
    }

    // 大数据使用流式压缩
    const chunks: Buffer[] = [];
    const readable = Readable.from([jsonStr]);
    const gzip = createGzip({ level: 6 }); // 平衡压缩率和速度
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });

    await pipeline(readable, gzip, writable);

    const compressed = Buffer.concat(chunks);
    return compressed.toString('base64');
  }

  // 添加压缩缓存(使用 LRU cache)
  private compressionCache = new Map<string, { data: string; timestamp: number }>();
  private readonly COMPRESSION_CACHE_TTL = 60000; // 1分钟
  private readonly COMPRESSION_CACHE_MAX_SIZE = 100;

  private getCachedCompression(key: string, data: any): string | null {
    const cached = this.compressionCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.COMPRESSION_CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedCompression(key: string, data: string): void {
    // LRU 淘汰
    if (this.compressionCache.size >= this.COMPRESSION_CACHE_MAX_SIZE) {
      const firstKey = this.compressionCache.keys().next().value;
      this.compressionCache.delete(firstKey);
    }

    this.compressionCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  async createTestReport(report: TestReport): Promise<string> {
    const id = uuidv4();

    // ... 基础字段处理 ...

    // 对大数据进行缓存key计算
    if (report.webPageTestData) {
      const cacheKey = `webpagetest:${report.url}:${report.completedAt}`;
      let compressed = this.getCachedCompression(cacheKey, report.webPageTestData);

      if (!compressed) {
        compressed = await this.compressJSONStream(report.webPageTestData);
        this.setCachedCompression(cacheKey, compressed);
      }

      fields.webpagetest_data = compressed;
    }

    // ... 其他逻辑 ...
  }
}
```

**预期收益**:
- 内存占用减少 60%
- 压缩时间减少 40%
- 减少 CPU 阻塞

---

### 1.5 实现请求限流和熔断 (第3天)

#### 任务清单
- [ ] 添加 API 限流中间件
- [ ] 实现飞书 API 速率控制
- [ ] 添加熔断器保护
- [ ] 实现请求队列

#### 实施细节

**文件**: `backend/src/api/middleware/rateLimiter.ts` (新建)

```typescript
import rateLimit from 'express-rate-limit';

// API 限流
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100, // 每IP最多100请求
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// 测试执行限流(更严格)
export const testExecutionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 每IP最多10次测试
  message: 'Test execution rate limit exceeded',
});
```

**文件**: `backend/src/services/FeishuApiService.ts`

```typescript
import Bottleneck from 'bottleneck';
import CircuitBreaker from 'opossum';

export class FeishuApiService {
  // 飞书 API 限流器 (QPS限制)
  private limiter = new Bottleneck({
    maxConcurrent: 5, // 最多5个并发请求
    minTime: 200, // 每个请求间隔至少200ms (5 QPS)
  });

  // 熔断器配置
  private circuitBreakerOptions = {
    timeout: 30000, // 30秒超时
    errorThresholdPercentage: 50, // 50%错误率触发熔断
    resetTimeout: 30000, // 30秒后尝试恢复
  };

  // 包装搜索方法
  async searchRecords(tableId: string, params: any): Promise<any> {
    return this.limiter.schedule(() =>
      this.searchRecordsInternal(tableId, params)
    );
  }

  private async searchRecordsInternal(tableId: string, params: any): Promise<any> {
    const breaker = new CircuitBreaker(
      async () => {
        const response = await fetch(
          `${BITABLE_API_BASE}/tables/${tableId}/records/search`,
          {
            method: 'POST',
            headers: await this.getHeaders(),
            body: JSON.stringify(params),
          }
        );

        if (response.status === 429) {
          // 速率限制,抛出可重试错误
          throw new Error('Rate limit exceeded');
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      },
      this.circuitBreakerOptions
    );

    breaker.fallback(() => ({
      code: 0,
      data: { items: [], has_more: false },
      msg: 'Circuit breaker fallback - service unavailable'
    }));

    breaker.on('open', () => {
      console.warn('[FeishuAPI] Circuit breaker opened - too many failures');
    });

    breaker.on('halfOpen', () => {
      console.log('[FeishuAPI] Circuit breaker half-open - attempting recovery');
    });

    return await breaker.fire();
  }
}
```

**预期收益**:
- 防止 API 过载
- 提升系统稳定性
- 自动故障恢复

---

## 🏗️ 阶段 2: 架构重构 (第4-7天)

### 目标
- **实现依赖注入**
- **解耦核心服务**
- **建立清晰的分层架构**

### 2.1 实现 Repository 接口和依赖注入 (第4天)

#### 任务清单
- [ ] 定义所有 Repository 接口
- [ ] 创建依赖注入容器
- [ ] 重构服务使用接口
- [ ] 添加配置切换机制

#### 实施细节

**文件**: `backend/src/models/repositories/interfaces/IPatrolTaskRepository.ts` (新建)

```typescript
import { PatrolTask } from '../../entities.js';

export interface IPatrolTaskRepository {
  create(task: Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatrolTask>;
  findById(id: string): Promise<PatrolTask | null>;
  findAll(enabledOnly?: boolean): Promise<PatrolTask[]>;
  update(id: string, updates: Partial<PatrolTask>): Promise<PatrolTask | null>;
  delete(id: string): Promise<boolean>;
}

export interface IPatrolExecutionRepository {
  create(execution: Omit<PatrolExecution, 'id'>): Promise<PatrolExecution>;
  findById(id: string): Promise<PatrolExecution | null>;
  findByTaskId(taskId: string, limit?: number): Promise<PatrolExecution[]>;
  getLatestByTaskId(taskId: string): Promise<PatrolExecution | null>;
}
```

**文件**: `backend/src/di/container.ts` (新建)

```typescript
import { Container } from 'inversify';
import { IPatrolTaskRepository } from '../models/repositories/interfaces/IPatrolTaskRepository.js';
import { BitablePatrolTaskRepository } from '../models/repositories/BitablePatrolTaskRepository.js';
import { PostgresPatrolTaskRepository } from '../models/repositories/PostgresPatrolTaskRepository.js';

const container = new Container();

// 根据环境变量选择存储实现
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'bitable'; // 'bitable' | 'postgres'

if (STORAGE_TYPE === 'bitable') {
  container.bind<IPatrolTaskRepository>('IPatrolTaskRepository')
    .to(BitablePatrolTaskRepository)
    .inSingletonScope();
} else {
  container.bind<IPatrolTaskRepository>('IPatrolTaskRepository')
    .to(PostgresPatrolTaskRepository)
    .inSingletonScope();
}

export { container };
```

**文件**: `backend/src/services/PatrolService.ts` (修改)

```typescript
import { inject, injectable } from 'inversify';
import { IPatrolTaskRepository } from '../models/repositories/interfaces/IPatrolTaskRepository.js';

@injectable()
export class PatrolService {
  constructor(
    @inject('IPatrolTaskRepository')
    private taskRepository: IPatrolTaskRepository,

    @inject('IPatrolExecutionRepository')
    private executionRepository: IPatrolExecutionRepository
  ) {
    console.log('[PatrolService] Initialized with injected dependencies');
  }

  // ... 方法实现保持不变,只是使用接口 ...
}

// 使用容器创建实例
export const patrolService = container.get<PatrolService>(PatrolService);
```

**预期收益**:
- 测试时可以轻松 mock 依赖
- 支持运行时切换存储实现
- 提升代码可维护性

---

### 2.2 服务拆分和解耦 (第5-6天)

#### 任务清单
- [ ] 提取 PageDetectionService
- [ ] 提取 BrowserOperationService
- [ ] 提取 NotificationService
- [ ] 重构 PatrolService 为流程编排

#### 实施细节

**文件**: `backend/src/services/detection/PageDetectionService.ts` (新建)

```typescript
import { Page } from 'playwright';

export interface DetectionResult {
  passed: boolean;
  message: string;
  screenshotUrl?: string;
  detectedText?: string;
}

@injectable()
export class PageDetectionService {
  /**
   * 检测页面导航栏
   */
  async detectNavbar(
    page: Page,
    navbarConfig: NavbarConfig
  ): Promise<DetectionResult> {
    // 从 PatrolService 中提取的导航栏检测逻辑
    // 行 188-308 → 独立方法
  }

  /**
   * 检测页面 Banner
   */
  async detectBanner(
    page: Page,
    bannerConfig: BannerConfig
  ): Promise<DetectionResult> {
    // 从 PatrolService 中提取的 Banner 检测逻辑
    // 行 330-377 → 独立方法
  }

  /**
   * 检测页脚信息
   */
  async detectFooter(
    page: Page,
    footerConfig: FooterConfig
  ): Promise<DetectionResult> {
    // 页脚检测逻辑
  }

  /**
   * 通用元素检测
   */
  async detectElement(
    page: Page,
    selector: string,
    expectedText?: string
  ): Promise<DetectionResult> {
    // 通用检测逻辑,消除代码重复
  }
}
```

**文件**: `backend/src/services/browser/BrowserOperationService.ts` (新建)

```typescript
import { Page, Browser, BrowserContext } from 'playwright';

@injectable()
export class BrowserOperationService {
  /**
   * 安全地导航到 URL
   */
  async navigateToUrl(
    page: Page,
    url: string,
    options?: NavigationOptions
  ): Promise<{ success: boolean; statusCode?: number; responseTime: number }> {
    // 从 PatrolService 中提取的导航逻辑
    // 行 1261-1328 → 独立方法
    // 包含渐进式加载策略、崩溃检测等
  }

  /**
   * 等待页面稳定
   */
  async waitForStability(
    page: Page,
    strategy: 'fast' | 'balanced' | 'thorough' = 'balanced'
  ): Promise<void> {
    // 不同的等待策略
  }

  /**
   * 安全地关闭页面
   */
  async closePage(page: Page | null): Promise<void> {
    if (page && !page.isClosed()) {
      await page.close().catch(err =>
        console.warn('Failed to close page:', err)
      );
    }
  }

  /**
   * 创建带重试的浏览器上下文
   */
  async createContextWithRetry(
    browser: Browser,
    maxRetries: number = 3
  ): Promise<BrowserContext> {
    // 创建上下文,失败自动重试
  }
}
```

**文件**: `backend/src/services/notification/NotificationService.ts` (新建)

```typescript
@injectable()
export class NotificationService {
  /**
   * 发送巡检结果通知
   */
  async sendPatrolNotification(
    execution: PatrolExecution,
    recipients: string[]
  ): Promise<void> {
    // 从 PatrolService 中提取的邮件发送逻辑
  }

  /**
   * 发送告警通知
   */
  async sendAlert(
    level: 'info' | 'warning' | 'error',
    message: string,
    details?: any
  ): Promise<void> {
    // 统一的告警通知
  }
}
```

**文件**: `backend/src/services/PatrolService.ts` (重构后)

```typescript
@injectable()
export class PatrolService {
  constructor(
    @inject('IPatrolTaskRepository') private taskRepository: IPatrolTaskRepository,
    @inject('IPatrolExecutionRepository') private executionRepository: IPatrolExecutionRepository,
    @inject(PageDetectionService) private detectionService: PageDetectionService,
    @inject(BrowserOperationService) private browserService: BrowserOperationService,
    @inject(NotificationService) private notificationService: NotificationService
  ) {}

  /**
   * 执行巡检任务 - 流程编排
   */
  async executeTask(taskId: string): Promise<PatrolExecution> {
    // 1. 加载任务配置
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    // 2. 获取浏览器资源
    const browser = await browserPool.acquire();

    try {
      // 3. 创建上下文
      const context = await this.browserService.createContextWithRetry(browser);

      // 4. 并行测试所有 URL
      const results = await this.testUrlsConcurrently(context, task);

      // 5. 创建执行记录
      const execution = await this.createExecution(task, results);

      // 6. 发送通知
      if (task.notificationEmails && task.notificationEmails.length > 0) {
        await this.notificationService.sendPatrolNotification(
          execution,
          task.notificationEmails
        );
      }

      return execution;

    } finally {
      await browserPool.release(browser);
    }
  }

  /**
   * 并行测试多个 URL
   */
  private async testUrlsConcurrently(
    context: BrowserContext,
    task: PatrolTask
  ): Promise<PatrolCheckResult[]> {
    const limit = pLimit(this.MAX_CONCURRENT_URLS);

    const testPromises = task.urls.map((urlConfig) =>
      limit(() => this.testSingleUrl(context, urlConfig, task.config))
    );

    const results = await Promise.allSettled(testPromises);
    return this.processResults(results, task.urls);
  }

  /**
   * 测试单个 URL
   */
  private async testSingleUrl(
    context: BrowserContext,
    urlConfig: UrlConfig,
    config: PatrolConfig
  ): Promise<PatrolCheckResult> {
    let page: Page | null = null;

    try {
      page = await context.newPage();

      // 1. 导航到页面
      const navResult = await this.browserService.navigateToUrl(
        page,
        urlConfig.url,
        { timeout: config.timeout }
      );

      if (!navResult.success) {
        return {
          url: urlConfig.url,
          name: urlConfig.name,
          status: 'fail',
          errorMessage: 'Navigation failed',
        };
      }

      // 2. 执行各项检测
      const detectionResults = await Promise.all([
        config.navbar ? this.detectionService.detectNavbar(page, config.navbar) : null,
        config.banner ? this.detectionService.detectBanner(page, config.banner) : null,
        config.footer ? this.detectionService.detectFooter(page, config.footer) : null,
      ]);

      // 3. 汇总结果
      return this.aggregateDetectionResults(
        urlConfig,
        navResult,
        detectionResults.filter(r => r !== null)
      );

    } finally {
      await this.browserService.closePage(page);
    }
  }
}
```

**预期收益**:
- PatrolService 从 1987 行减少到 < 500 行
- 单一职责原则,每个类只做一件事
- 服务可独立测试和复用
- 代码可读性大幅提升

---

### 2.3 建立分层架构 (第7天)

#### 目录结构重组

```
backend/src/
├── api/                    # API 层
│   ├── controllers/       # 控制器 (新增)
│   │   ├── PatrolController.ts
│   │   ├── TestController.ts
│   │   └── ReportController.ts
│   ├── routes/            # 路由定义
│   ├── middleware/        # 中间件
│   └── validators/        # 请求验证 (新增)
│       ├── patrol.validator.ts
│       └── test.validator.ts
│
├── services/              # 业务逻辑层
│   ├── domain/           # 领域服务 (新增)
│   │   ├── PatrolService.ts
│   │   ├── TestExecutionService.ts
│   │   └── ReportService.ts
│   ├── detection/        # 检测服务
│   │   ├── PageDetectionService.ts
│   │   └── ResponsiveDetectionService.ts
│   ├── browser/          # 浏览器服务
│   │   ├── BrowserOperationService.ts
│   │   └── ScreenshotService.ts
│   ├── notification/     # 通知服务
│   │   └── NotificationService.ts
│   ├── infrastructure/   # 基础设施服务 (新增)
│   │   ├── CacheService.ts
│   │   ├── FeishuApiService.ts
│   │   └── StorageService.ts
│   └── scheduling/       # 调度服务
│       └── PatrolSchedulerService.ts
│
├── models/                # 数据层
│   ├── entities/         # 实体定义
│   ├── repositories/     # 数据访问
│   │   ├── interfaces/  # Repository 接口
│   │   ├── bitable/     # Bitable 实现
│   │   └── postgres/    # PostgreSQL 实现
│   └── dto/             # 数据传输对象 (新增)
│
├── automation/           # 自动化层
│   ├── BrowserPool.ts
│   └── ScreenshotService.ts
│
├── di/                   # 依赖注入 (新增)
│   └── container.ts
│
├── config/               # 配置管理
├── utils/                # 工具函数
└── types/                # 类型定义
```

**预期收益**:
- 清晰的层次结构
- 易于定位代码
- 职责边界明确

---

## 🧹 阶段 3: 代码质量改进 (第8-10天)

### 目标
- **消除所有 any 类型**
- **统一错误处理**
- **添加输入验证**
- **提升测试覆盖率**

### 3.1 类型安全改进 (第8天)

#### 任务清单
- [ ] 定义所有飞书 API 响应类型
- [ ] 替换 any 为具体类型
- [ ] 添加类型守卫函数
- [ ] 开启 strict 模式

#### 实施细节

**文件**: `backend/src/types/feishu.types.ts` (新建)

```typescript
// 飞书多维表格字段类型
export type FeishuFieldValue =
  | string
  | number
  | boolean
  | FeishuRichText[]
  | FeishuAttachment[]
  | FeishuUser[];

export interface FeishuRichText {
  type: 'text' | 'mention' | 'link';
  text: string;
  link?: string;
  mention?: {
    token: string;
    type: 'user' | 'at_all';
  };
}

export interface FeishuUser {
  id: string;
  name?: string;
  en_name?: string;
  email?: string;
}

export interface FeishuRecord {
  record_id: string;
  fields: Record<string, FeishuFieldValue>;
  created_time?: number;
  last_modified_time?: number;
}

export interface FeishuSearchResponse {
  code: number;
  msg: string;
  data: {
    items: FeishuRecord[];
    has_more: boolean;
    page_token?: string;
    total?: number;
  };
}

// 类型守卫
export function isFeishuRichText(value: unknown): value is FeishuRichText[] {
  return Array.isArray(value) &&
         value.length > 0 &&
         typeof value[0] === 'object' &&
         'text' in value[0];
}

export function extractText(field: FeishuFieldValue): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'number') return field.toString();
  if (typeof field === 'boolean') return field.toString();
  if (isFeishuRichText(field)) {
    return field[0].text;
  }
  return '';
}
```

**文件**: `backend/src/services/FeishuBitableService.ts` (修改)

```typescript
import { FeishuRecord, FeishuSearchResponse, extractText } from '../types/feishu.types.js';

export class FeishuBitableService {
  // 之前: async function compressJSON(data: any): Promise<string>
  // 修改为:
  private async compressJSON<T>(data: T): Promise<string> {
    const jsonStr = JSON.stringify(data);
    const compressed = await gzipAsync(Buffer.from(jsonStr, 'utf-8'));
    return compressed.toString('base64');
  }

  // 之前: private async mapBitableRecordToTestReport(record: any): Promise<TestReport>
  // 修改为:
  private async mapBitableRecordToTestReport(record: FeishuRecord): Promise<TestReport> {
    const fields = record.fields;

    return {
      id: extractText(fields.id) || record.record_id,
      testRequestId: extractText(fields.test_request_id),
      url: extractText(fields.url),
      overallScore: typeof fields.overall_score === 'number' ? fields.overall_score : 0,
      // ... 其他字段,全部使用类型安全的提取
    };
  }
}
```

**tsconfig.json** (开启 strict 模式):

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    // ... 其他配置
  }
}
```

**预期收益**:
- 编译时发现更多错误
- IDE 自动补全和重构更准确
- 降低运行时错误风险

---

### 3.2 统一错误处理 (第9天上午)

#### 实施细节

**文件**: `backend/src/utils/errors.ts` (新建)

```typescript
// 自定义错误类型
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource} ${id ? `with id ${id}` : ''} not found`,
      404,
      'NOT_FOUND'
    );
  }
}

export class BrowserCrashError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'BROWSER_CRASH', details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(
      `${service} service error: ${message}`,
      503,
      'EXTERNAL_SERVICE_ERROR'
    );
  }
}
```

**文件**: `backend/src/api/middleware/errorHandler.ts` (修改)

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/errors.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 已知错误类型
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
      details: err.details,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack
      })
    });
    return;
  }

  // 未知错误
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
}
```

**文件**: `backend/src/services/PatrolService.ts` (修改)

```typescript
import { NotFoundError, BrowserCrashError } from '../utils/errors.js';

export class PatrolService {
  async executeTask(taskId: string): Promise<PatrolExecution> {
    const task = await this.taskRepository.findById(taskId);

    // 之前: if (!task) throw new Error(`Task ${taskId} not found`);
    // 修改为:
    if (!task) {
      throw new NotFoundError('PatrolTask', taskId);
    }

    const browser = await browserPool.acquire();

    try {
      // ... 执行逻辑 ...
    } catch (error) {
      // 识别浏览器崩溃
      if (error.message?.includes('crash') || error.message?.includes('closed')) {
        throw new BrowserCrashError('Browser crashed during patrol execution', {
          taskId,
          url: 'current URL',
          originalError: error.message
        });
      }

      throw error; // 重新抛出其他错误
    } finally {
      await browserPool.release(browser);
    }
  }
}
```

**预期收益**:
- 统一的错误格式
- 更好的错误追踪
- 前端可以根据错误码处理

---

### 3.3 输入验证 (第9天下午)

#### 实施细节

**安装验证库**:
```bash
npm install zod
```

**文件**: `backend/src/api/validators/patrol.validator.ts` (新建)

```typescript
import { z } from 'zod';

// 巡检任务创建验证
export const createPatrolTaskSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),

  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),

  urls: z.array(
    z.object({
      url: z.string().url('Invalid URL format'),
      name: z.string().min(1, 'URL name is required'),
    })
  ).min(1, 'At least one URL is required')
    .max(50, 'Maximum 50 URLs allowed'),

  notificationEmails: z.array(
    z.string().email('Invalid email format')
  ).max(10, 'Maximum 10 notification emails')
    .optional(),

  config: z.object({
    timeout: z.number().int().min(5000).max(120000).optional(),
    navbar: z.object({
      selector: z.string(),
      expectedTexts: z.array(z.string()).optional(),
    }).optional(),
    banner: z.object({
      selector: z.string(),
      expectedTexts: z.array(z.string()).optional(),
    }).optional(),
    footer: z.object({
      selector: z.string(),
      expectedTexts: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),

  enabled: z.boolean().optional(),
});

export type CreatePatrolTaskInput = z.infer<typeof createPatrolTaskSchema>;

// 验证中间件
export function validateCreatePatrolTask(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    req.body = createPatrolTaskSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
      return;
    }
    next(error);
  }
}
```

**文件**: `backend/src/api/routes/patrol.ts` (修改)

```typescript
import { validateCreatePatrolTask } from '../validators/patrol.validator.js';

router.post('/tasks', validateCreatePatrolTask, async (req: Request, res: Response) => {
  // 此时 req.body 已经过验证和类型转换
  const task = await patrolService.createTask(req.body);
  res.json({ success: true, data: task });
});
```

**预期收益**:
- 自动验证和类型转换
- 友好的错误提示
- 防止无效数据进入系统

---

### 3.4 添加单元测试 (第10天)

#### 实施细节

**安装测试框架**:
```bash
npm install --save-dev jest @types/jest ts-jest
```

**文件**: `backend/jest.config.js` (新建)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
```

**文件**: `backend/src/services/__tests__/PageDetectionService.test.ts` (新建)

```typescript
import { PageDetectionService } from '../detection/PageDetectionService';
import { Page } from 'playwright';

describe('PageDetectionService', () => {
  let service: PageDetectionService;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    service = new PageDetectionService();
    mockPage = {
      locator: jest.fn(),
      isClosed: jest.fn().mockReturnValue(false),
      // ... 其他 mock 方法
    } as any;
  });

  describe('detectNavbar', () => {
    it('should detect navbar successfully', async () => {
      // Arrange
      const config = {
        selector: '.navbar',
        expectedTexts: ['Home', 'Products'],
      };

      mockPage.locator.mockReturnValue({
        isVisible: jest.fn().mockResolvedValue(true),
        textContent: jest.fn().mockResolvedValue('Home Products About'),
      } as any);

      // Act
      const result = await service.detectNavbar(mockPage, config);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.message).toContain('Navbar detected');
      expect(mockPage.locator).toHaveBeenCalledWith('.navbar');
    });

    it('should fail when navbar is not visible', async () => {
      // Arrange
      const config = {
        selector: '.navbar',
        expectedTexts: ['Home'],
      };

      mockPage.locator.mockReturnValue({
        isVisible: jest.fn().mockResolvedValue(false),
      } as any);

      // Act
      const result = await service.detectNavbar(mockPage, config);

      // Assert
      expect(result.passed).toBe(false);
      expect(result.message).toContain('not found');
    });
  });
});
```

**文件**: `backend/src/models/repositories/__tests__/BitablePatrolTaskRepository.test.ts` (新建)

```typescript
import { BitablePatrolTaskRepository } from '../BitablePatrolTaskRepository';
import feishuApiService from '../../../services/FeishuApiService';
import cacheService from '../../../services/CacheService';

jest.mock('../../../services/FeishuApiService');
jest.mock('../../../services/CacheService');

describe('BitablePatrolTaskRepository', () => {
  let repository: BitablePatrolTaskRepository;

  beforeEach(() => {
    repository = new BitablePatrolTaskRepository();
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return cached task if available', async () => {
      // Arrange
      const mockTask = {
        id: 'task-1',
        name: 'Test Task',
        urls: [],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (cacheService.get as jest.Mock).mockResolvedValue(mockTask);

      // Act
      const result = await repository.findById('task-1');

      // Assert
      expect(result).toEqual(mockTask);
      expect(cacheService.get).toHaveBeenCalledWith('patrol:task:task-1');
      expect(feishuApiService.searchRecords).not.toHaveBeenCalled();
    });

    it('should query Feishu when cache misses', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      (feishuApiService.searchRecords as jest.Mock).mockResolvedValue({
        code: 0,
        data: {
          items: [{
            record_id: 'rec-1',
            fields: {
              id: 'task-1',
              name: 'Test Task',
              // ... 其他字段
            }
          }]
        }
      });

      // Act
      const result = await repository.findById('task-1');

      // Assert
      expect(result).toBeTruthy();
      expect(result?.id).toBe('task-1');
      expect(feishuApiService.searchRecords).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
    });
  });
});
```

**预期收益**:
- 代码覆盖率 > 60%
- 防止回归错误
- 文档化代码行为

---

## 🚀 阶段 4: 新技术引入和优化 (第11-14天)

### 目标
- **添加性能监控**
- **优化前端性能**
- **完善日志和追踪**
- **自动化部署**

### 4.1 性能监控 (第11天)

#### 实施细节

**安装监控工具**:
```bash
npm install prom-client express-prom-bundle
```

**文件**: `backend/src/monitoring/metrics.ts` (新建)

```typescript
import promClient from 'prom-client';

// 创建 Prometheus 注册表
const register = new promClient.Register();

// 默认指标(CPU、内存等)
promClient.collectDefaultMetrics({ register });

// 自定义业务指标
export const metrics = {
  // 巡检任务执行时间
  patrolExecutionDuration: new promClient.Histogram({
    name: 'patrol_execution_duration_seconds',
    help: 'Duration of patrol task execution in seconds',
    labelNames: ['task_id', 'status'],
    buckets: [10, 30, 60, 120, 300, 600],
    registers: [register],
  }),

  // 浏览器池状态
  browserPoolSize: new promClient.Gauge({
    name: 'browser_pool_size',
    help: 'Current number of browsers in the pool',
    labelNames: ['status'], // 'total', 'in_use', 'available'
    registers: [register],
  }),

  // 浏览器崩溃计数
  browserCrashes: new promClient.Counter({
    name: 'browser_crashes_total',
    help: 'Total number of browser crashes',
    registers: [register],
  }),

  // API 请求延迟
  apiRequestDuration: new promClient.Histogram({
    name: 'api_request_duration_seconds',
    help: 'Duration of API requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  }),

  // 缓存命中率
  cacheHits: new promClient.Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_key_prefix'],
    registers: [register],
  }),

  cacheMisses: new promClient.Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_key_prefix'],
    registers: [register],
  }),
};

export { register };
```

**文件**: `backend/src/api/middleware/metricsMiddleware.ts` (新建)

```typescript
import { Request, Response, NextFunction } from 'express';
import { metrics } from '../../monitoring/metrics.js';

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;

    metrics.apiRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode.toString(),
      },
      duration
    );
  });

  next();
}
```

**文件**: `backend/src/index.ts` (添加 Metrics 端点)

```typescript
import { register } from './monitoring/metrics.js';
import { metricsMiddleware } from './api/middleware/metricsMiddleware.js';

// 添加 metrics 中间件
app.use(metricsMiddleware);

// Metrics 端点
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**文件**: `backend/src/services/PatrolService.ts` (添加指标记录)

```typescript
import { metrics } from '../monitoring/metrics.js';

export class PatrolService {
  async executeTask(taskId: string): Promise<PatrolExecution> {
    const startTime = Date.now();
    let status = 'success';

    try {
      // ... 执行逻辑 ...
      return execution;

    } catch (error) {
      status = 'failure';
      throw error;

    } finally {
      const duration = (Date.now() - startTime) / 1000;
      metrics.patrolExecutionDuration.observe({ task_id: taskId, status }, duration);
    }
  }
}
```

**Grafana Dashboard 配置** (`monitoring/grafana-dashboard.json`):

```json
{
  "dashboard": {
    "title": "Anker Web Sentinel Monitoring",
    "panels": [
      {
        "title": "Patrol Execution Duration",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, patrol_execution_duration_seconds_bucket)"
          }
        ]
      },
      {
        "title": "Browser Pool Status",
        "targets": [
          {
            "expr": "browser_pool_size"
          }
        ]
      },
      {
        "title": "Browser Crashes",
        "targets": [
          {
            "expr": "rate(browser_crashes_total[5m])"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "cache_hits_total / (cache_hits_total + cache_misses_total)"
          }
        ]
      }
    ]
  }
}
```

**预期收益**:
- 实时监控系统性能
- 快速定位性能瓶颈
- 数据驱动的优化决策

---

### 4.2 结构化日志 (第12天)

#### 实施细节

**安装 Winston**:
```bash
npm install winston winston-daily-rotate-file
```

**文件**: `backend/src/utils/logger.ts` (新建)

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, printf, errors, json } = winston.format;

// 自定义格式
const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...meta,
  });
});

// 创建 logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'anker-web-sentinel' },
  transports: [
    // Console 输出 (开发环境)
    new winston.transports.Console({
      format: combine(
        winston.format.colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}] ${message} ${metaStr}`;
        })
      ),
    }),

    // 文件输出 (生产环境)
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(timestamp(), json()),
    }),

    // 错误日志单独文件
    new DailyRotateFile({
      level: 'error',
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: combine(timestamp(), json()),
    }),
  ],
});

// 子 logger 工厂
export function createModuleLogger(moduleName: string) {
  return logger.child({ module: moduleName });
}
```

**全局替换 console.log**:

```bash
# 查找所有 console.log
find backend/src -name "*.ts" -exec grep -l "console\\.log\\|console\\.error\\|console\\.warn" {} \;

# 批量替换脚本
```

**文件**: `backend/src/services/PatrolService.ts` (修改)

```typescript
import { createModuleLogger } from '../utils/logger.js';

export class PatrolService {
  private logger = createModuleLogger('PatrolService');

  async executeTask(taskId: string): Promise<PatrolExecution> {
    this.logger.info('Starting patrol task execution', { taskId });

    try {
      // ... 执行逻辑 ...

      this.logger.info('Patrol task completed successfully', {
        taskId,
        duration: Date.now() - startTime,
        urlsTestCount: results.length
      });

      return execution;

    } catch (error) {
      this.logger.error('Patrol task execution failed', {
        taskId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}
```

**预期收益**:
- 结构化日志易于分析
- 日志级别可动态调整
- 自动日志轮转和归档
- 支持集中式日志收集

---

### 4.3 前端性能优化 (第13天)

#### 实施细节

**代码分割和懒加载**:

**文件**: `frontend/src/App.tsx` (修改)

```typescript
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// 懒加载页面组件
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TestReports = lazy(() => import('./pages/TestReports'));
const ResponsiveTesting = lazy(() => import('./pages/ResponsiveTesting'));
const PatrolManagement = lazy(() => import('./pages/PatrolManagement'));

// Loading 组件
function LoadingFallback() {
  return (
    <div className="loading-container">
      <div className="spinner">Loading...</div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reports" element={<TestReports />} />
          <Route path="/responsive-testing" element={<ResponsiveTesting />} />
          <Route path="/patrol" element={<PatrolManagement />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
```

**优化 Vite 打包配置**:

**文件**: `frontend/vite.config.ts` (修改)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react'],
          'vendor-utils': ['axios'],
        },
      },
    },
    // 压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除 console
      },
    },
    // chunk 大小警告
    chunkSizeWarningLimit: 500,
  },
  // 开发服务器配置
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

**图片懒加载**:

**文件**: `frontend/src/components/LazyImage.tsx` (新建)

```typescript
import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
}

export function LazyImage({ src, alt, className, placeholder }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isInView ? src : placeholder || '/placeholder.png'}
      alt={alt}
      className={className}
      onLoad={() => setIsLoaded(true)}
      style={{
        opacity: isLoaded ? 1 : 0.5,
        transition: 'opacity 0.3s',
      }}
    />
  );
}
```

**预期收益**:
- 首屏加载时间减少 50%
- JavaScript 包体积减少 30%
- 更好的用户体验

---

### 4.4 CI/CD 自动化 (第14天)

#### 实施细节

**文件**: `.github/workflows/ci.yml` (新建)

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Backend Dependencies
        working-directory: ./backend
        run: npm ci

      - name: Install Frontend Dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run Backend Tests
        working-directory: ./backend
        run: npm test -- --coverage
        env:
          DATABASE_URL: postgresql://postgres:test_password@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

      - name: Run Frontend Tests
        working-directory: ./frontend
        run: npm test -- --coverage

      - name: TypeScript Type Check
        run: |
          cd backend && npm run type-check
          cd ../frontend && npm run type-check

      - name: Lint
        run: |
          cd backend && npm run lint
          cd ../frontend && npm run lint

      - name: Build Backend
        working-directory: ./backend
        run: npm run build

      - name: Build Frontend
        working-directory: ./frontend
        run: npm run build

      - name: Upload Coverage
        uses: codecov/codecov-action@v3

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Production
        run: |
          # 部署脚本
          echo "Deploying to production..."
```

**预期收益**:
- 自动化测试和构建
- 代码质量保证
- 快速发布流程

---

## 📈 预期整体收益

### 性能提升

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| API 响应时间 | 500ms | 200ms | ↓60% |
| 巡检任务执行 | 5min | 1.5min | ↓70% |
| 浏览器崩溃率 | 10% | < 1% | ↓90% |
| 内存使用 | 2GB | 1.2GB | ↓40% |
| 前端首屏加载 | 3s | 1.5s | ↓50% |

### 代码质量

| 指标 | 当前 | 目标 |
|------|------|------|
| TypeScript strict | ❌ | ✅ |
| 测试覆盖率 | 0% | 60%+ |
| any 类型 | 150+ | 0 |
| 代码重复率 | 15% | < 5% |
| 文档覆盖率 | 20% | 80% |

### 可维护性

- ✅ 清晰的分层架构
- ✅ 依赖注入,易于测试
- ✅ 统一的错误处理
- ✅ 结构化日志
- ✅ 完善的监控告警

---

## 🚀 快速开始

### 第 1 天任务清单

#### 上午 (4小时)
- [ ] 安装 Redis
- [ ] 实现 CacheService
- [ ] 为 3 个核心 Repository 添加缓存
- [ ] 测试缓存效果

#### 下午 (4小时)
- [ ] 安装 p-limit
- [ ] 重构 PatrolService.executeTask
- [ ] 实现并行 URL 测试
- [ ] 测试并行执行

#### 验证
```bash
# 测试缓存命中
curl http://localhost:3000/api/v1/patrol/tasks/xxx

# 测试并行执行
curl -X POST http://localhost:3000/api/v1/patrol/tasks/xxx/execute

# 查看日志
tail -f logs/application-$(date +%Y-%m-%d).log
```

---

## 📚 参考文档

### 技术栈版本

| 依赖 | 当前版本 | 目标版本 |
|------|---------|---------|
| Node.js | 20.x | 20.x |
| TypeScript | 5.3.3 | 5.5.x |
| Playwright | 1.40.x | 1.45.x |
| React | 18.x | 18.x |
| Express | 4.x | 4.x |

### 新增依赖

**后端**:
```json
{
  "dependencies": {
    "redis": "^4.6.13",
    "p-limit": "^5.0.0",
    "inversify": "^6.0.2",
    "reflect-metadata": "^0.2.2",
    "zod": "^3.23.8",
    "winston": "^3.13.0",
    "winston-daily-rotate-file": "^5.0.0",
    "prom-client": "^15.1.2",
    "express-prom-bundle": "^7.0.0",
    "bottleneck": "^2.19.5",
    "opossum": "^8.1.3"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.12",
    "ts-jest": "^29.1.5"
  }
}
```

---

## ⚠️ 风险和注意事项

### 重构风险

1. **数据迁移风险**
   - 缓存引入后需要考虑数据一致性
   - Repository 接口切换需要完整测试
   - 建议先在开发环境验证

2. **性能回退风险**
   - 并行化可能导致浏览器资源竞争
   - 建议逐步增加并发度
   - 密切监控崩溃率

3. **兼容性风险**
   - TypeScript strict 模式可能暴露隐藏 bug
   - 建议先修复所有类型错误再部署
   - 保持充分的测试覆盖

### 回滚策略

每个阶段完成后:
1. 创建 Git tag (如 `v2.0-phase1`)
2. 备份数据库
3. 记录关键配置变更
4. 准备回滚脚本

---

## 🎯 成功标准

### 阶段 1 (第1-3天)
- [ ] 缓存命中率 > 80%
- [ ] 巡检任务执行时间减少 > 60%
- [ ] 浏览器崩溃率 < 2%

### 阶段 2 (第4-7天)
- [ ] 所有服务使用依赖注入
- [ ] PatrolService 代码行数 < 500
- [ ] Repository 全部实现接口

### 阶段 3 (第8-10天)
- [ ] any 类型使用 < 10 处
- [ ] 测试覆盖率 > 60%
- [ ] 所有 API 有输入验证

### 阶段 4 (第11-14天)
- [ ] Prometheus metrics 端点可用
- [ ] Grafana dashboard 部署
- [ ] CI/CD 流程运行成功

---

## 📞 支持和反馈

如有问题或建议,请在项目 Issues 中提出。

**文档版本**: 1.0
**创建日期**: 2025-12-17
**预计完成**: 2025-12-31
