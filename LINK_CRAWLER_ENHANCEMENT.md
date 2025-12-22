# 链接爬取工具优化方案

## 新增功能

### 1. 单链接404分级排查
- 输入单个 URL
- 检查页面本身的状态
- 提取页面内所有链接
- 检查每个子链接的404状态
- 分级展示:第1级(起始页面)、第2级(子链接)

### 2. CSV批量导入检查
- 上传 CSV 文件
- 解析 URL 列表
- 批量检查每个 URL 的状态
- 统计404链接数量和比例
- 支持导出检查结果

##

 实现方案

### 后端改动

#### 1. 修改 LinkCrawlerService.ts

新增方法:

```typescript
/**
 * 404检查模式: 检查单个URL及其子链接的404状态
 */
async start404Check(startUrl: string): Promise<LinkCrawlTask> {
  const taskId = uuidv4();
  const task: LinkCrawlTask = {
    id: taskId,
    startUrl,
    maxDepth: 2, // 固定为2级(起始页面+子链接)
    status: CrawlStatus.Running,
    mode: '404check', // 新增模式字段
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

  // 异步执行404检查
  this.execute404Check(taskId, startUrl).catch((error) => {
    task.status = CrawlStatus.Failed;
    task.errorMessage = error.message;
    task.completedAt = new Date();
  });

  return task;
}

/**
 * CSV批量检查模式
 */
async startCsvCheck(urls: string[]): Promise<LinkCrawlTask> {
  const taskId = uuidv4();
  const task: LinkCrawlTask = {
    id: taskId,
    startUrl: `CSV批量检查 (${urls.length} 个URL)`,
    maxDepth: 1, // CSV模式固定1级
    status: CrawlStatus.Running,
    mode: 'csv', // CSV模式
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

  // 异步执行CSV检查
  this.executeCsvCheck(taskId, urls).catch((error) => {
    task.status = CrawlStatus.Failed;
    task.errorMessage = error.message;
    task.completedAt = new Date();
  });

  return task;
}
```

实现检查逻辑:

```typescript
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

    // 第1级: 检查起始页面
    console.log(`[404Check] Checking start URL: ${startUrl}`);
    const startResponse = await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const startStatus = startResponse?.status() || 0;

    const startLink: CrawledLink = {
      url: startUrl,
      level: 1,
      statusCode: startStatus,
      error: startStatus === 404 ? 'Page not found (404)' : undefined,
      crawledAt: new Date().toISOString(),
    };

    task.links.push(startLink);
    task.crawledLinks++;

    if (startStatus === 404) {
      task.stats!.total404++;
    } else if (startStatus === 200) {
      task.stats!.total200++;
    } else {
      task.stats!.totalOther++;
    }

    // 第2级: 提取并检查子链接
    if (startStatus === 200) {
      console.log(`[404Check] Extracting links from page...`);
      const childUrls = await this.extractLinksFromPage(page, startUrl);
      console.log(`[404Check] Found ${childUrls.length} links`);

      // 检查每个子链接
      for (const childUrl of childUrls) {
        try {
          const childResponse = await page.goto(childUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          const childStatus = childResponse?.status() || 0;

          const childLink: CrawledLink = {
            url: childUrl,
            level: 2,
            parentUrl: startUrl,
            statusCode: childStatus,
            error: childStatus === 404 ? 'Page not found (404)' : undefined,
            crawledAt: new Date().toISOString(),
          };

          task.links.push(childLink);
          task.crawledLinks++;

          if (childStatus === 404) {
            task.stats!.total404++;
          } else if (childStatus === 200) {
            task.stats!.total200++;
          } else {
            task.stats!.totalOther++;
          }

          console.log(`[404Check] [${task.crawledLinks}/${childUrls.length + 1}] ${childUrl} -> ${childStatus}`);
        } catch (error: any) {
          const childLink: CrawledLink = {
            url: childUrl,
            level: 2,
            parentUrl: startUrl,
            error: error.message,
            crawledAt: new Date().toISOString(),
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
          crawledAt: new Date().toISOString(),
        };

        task.links.push(link);
        task.crawledLinks++;

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
          crawledAt: new Date().toISOString(),
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
```

#### 2. 更新 LinkCrawlTask 类型定义

在 `backend/src/models/entities.ts` 中:

```typescript
export interface LinkCrawlTask {
  id: string;
  startUrl: string;
  maxDepth: number;
  mode?: 'crawl' | '404check' | 'csv'; // 新增: 任务模式
  status: CrawlStatus;
  totalLinks: number;
  crawledLinks: number;
  links: CrawledLink[];
  stats?: { // 新增: 统计信息
    total404: number;
    total200: number;
    totalOther: number;
  };
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  errorMessage?: string;
}
```

#### 3. 修改 API 路由

在 `backend/src/api/routes/linkCrawler.ts` 中修改 POST 端点,支持不同模式。

### 前端改动

#### 1. 修改 LinkCrawler.tsx

新增模式选择和CSV上传:

```tsx
const [mode, setMode] = useState<'crawl' | '404check' | 'csv'>('crawl');
const [csvFile, setCsvFile] = useState<File | null>(null);
const [csvUrls, setCsvUrls] = useState<string[]>([]);

// 处理CSV文件上传
const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setCsvFile(file);

  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target?.result as string;
    const urls = parseCSV(text);
    setCsvUrls(urls);
  };
  reader.readAsText(file);
};

// 解析CSV
const parseCSV = (text: string): string[] => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);

  // 假设第一列是URL,或者整行就是URL
  const urls = lines.map(line => {
    // 尝试按逗号分割
    const parts = line.split(',');
    const url = parts[0].trim();

    // 验证是否是URL
    try {
      new URL(url);
      return url;
    } catch {
      return null;
    }
  }).filter(url => url !== null) as string[];

  return urls;
};
```

UI部分:

```tsx
{/* 模式选择 */}
<div className="mode-selector">
  <label>检测模式:</label>
  <div className="mode-buttons">
    <button
      className={mode === 'crawl' ? 'active' : ''}
      onClick={() => setMode('crawl')}
    >
      链接爬取
    </button>
    <button
      className={mode === '404check' ? 'active' : ''}
      onClick={() => setMode('404check')}
    >
      404排查
    </button>
    <button
      className={mode === 'csv' ? 'active' : ''}
      onClick={() => setMode('csv')}
    >
      CSV批量检查
    </button>
  </div>
</div>

{/* 根据模式显示不同的输入 */}
{mode === 'csv' ? (
  <div className="csv-upload">
    <label htmlFor="csvFile">上传CSV文件:</label>
    <input
      type="file"
      id="csvFile"
      accept=".csv,.txt"
      onChange={handleCsvUpload}
    />
    {csvUrls.length > 0 && (
      <div className="csv-preview">
        检测到 {csvUrls.length} 个URL
      </div>
    )}
  </div>
) : (
  <>
    <div className="form-group">
      <label htmlFor="startUrl">
        {mode === '404check' ? '检查URL' : '起始 URL'}
      </label>
      <input
        type="url"
        id="startUrl"
        value={startUrl}
        onChange={(e) => setStartUrl(e.target.value)}
        placeholder="https://example.com"
        required
      />
      {mode === '404check' && (
        <p className="hint">将检查此页面及其包含的所有链接</p>
      )}
    </div>

    {mode === 'crawl' && (
      <div className="form-group">
        <label htmlFor="maxDepth">爬取深度</label>
        <select
          id="maxDepth"
          value={maxDepth}
          onChange={(e) => setMaxDepth(Number(e.target.value))}
        >
          <option value={1}>1 级(仅当前页面)</option>
          <option value={2}>2 级(推荐)</option>
          <option value={3}>3 级</option>
          <option value={4}>4 级</option>
          <option value={5}>5 级(最大)</option>
        </select>
      </div>
    )}
  </>
)}
```

#### 2. 结果展示优化

针对404检查和CSV模式,添加统计信息展示:

```tsx
{displayTask.stats && (
  <div className="stats-summary">
    <div className="stat-card">
      <span className="stat-value status-200">{displayTask.stats.total200}</span>
      <span className="stat-label">正常 (200)</span>
    </div>
    <div className="stat-card">
      <span className="stat-value status-404">{displayTask.stats.total404}</span>
      <span className="stat-label">404错误</span>
    </div>
    <div className="stat-card">
      <span className="stat-value status-other">{displayTask.stats.totalOther}</span>
      <span className="stat-label">其他状态</span>
    </div>
    <div className="stat-card">
      <span className="stat-value">
        {((displayTask.stats.total404 / displayTask.totalLinks) * 100).toFixed(1)}%
      </span>
      <span className="stat-label">404比例</span>
    </div>
  </div>
)}
```

#### 3. 导出功能

添加导出检查结果为CSV:

```tsx
const exportToCSV = () => {
  if (!displayTask) return;

  const headers = ['URL', '层级', '状态码', '错误信息', '检查时间'];
  const rows = displayTask.links.map(link => [
    link.url,
    link.level,
    link.statusCode || '',
    link.error || '',
    link.crawledAt,
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `link-check-${displayTask.id}.csv`;
  link.click();
};
```

## 实施步骤

1. ✅ 更新后端类型定义 (entities.ts)
2. ✅ 实现后端404检查逻辑 (LinkCrawlerService.ts)
3. ✅ 实现后端CSV检查逻辑 (LinkCrawlerService.ts)
4. ✅ 更新API路由 (linkCrawler.ts)
5. ✅ 更新前端UI (LinkCrawler.tsx)
6. ✅ 添加CSV解析和上传
7. ✅ 添加结果统计展示
8. ✅ 添加导出功能
9. ✅ 测试所有三种模式

## 预期效果

### 404排查模式
- 输入: https://example.com
- 输出:
  - 第1级: example.com (200)
  - 第2级:
    - /about (200)
    - /contact (404) ❌
    - /products (200)
    - /old-page (404) ❌

### CSV批量检查模式
- 输入: CSV文件包含100个URL
- 输出:
  - 正常: 85个 (85%)
  - 404错误: 12个 (12%)
  - 其他错误: 3个 (3%)
  - 可导出详细检查结果

这样用户就可以:
1. 快速排查单个页面的404链接
2. 批量检查大量URL的可用性
3. 导出检查结果用于分析或报告
