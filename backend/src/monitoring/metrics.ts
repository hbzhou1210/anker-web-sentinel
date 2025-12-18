/**
 * Prometheus 指标定义
 *
 * 提供业务指标收集:
 * - 巡检任务执行时长
 * - 浏览器池状态
 * - 浏览器崩溃次数
 * - API 请求延迟
 * - 缓存命中率
 */

import promClient from 'prom-client';

// 创建 Prometheus Registry
export const register = new promClient.Registry();

// 添加默认指标 (CPU, Memory, Event Loop 等)
promClient.collectDefaultMetrics({ register });

/**
 * 业务指标定义
 */
export const metrics = {
  /**
   * 巡检任务执行时长 (直方图)
   *
   * 标签:
   * - task_id: 任务 ID
   * - status: 执行状态 (success, failed, timeout)
   *
   * Buckets: 10s, 30s, 1m, 2m, 5m, 10m
   */
  patrolExecutionDuration: new promClient.Histogram({
    name: 'patrol_execution_duration_seconds',
    help: 'Duration of patrol task execution in seconds',
    labelNames: ['task_id', 'status'],
    buckets: [10, 30, 60, 120, 300, 600],
    registers: [register],
  }),

  /**
   * 浏览器池状态 (计量器)
   *
   * 标签:
   * - state: 浏览器状态 (active, idle, total)
   */
  browserPoolStatus: new promClient.Gauge({
    name: 'browser_pool_browsers_total',
    help: 'Number of browsers in different states',
    labelNames: ['state'],
    registers: [register],
  }),

  /**
   * 浏览器崩溃次数 (计数器)
   *
   * 标签:
   * - reason: 崩溃原因 (crash, timeout, oom)
   */
  browserCrashes: new promClient.Counter({
    name: 'browser_crashes_total',
    help: 'Total number of browser crashes',
    labelNames: ['reason'],
    registers: [register],
  }),

  /**
   * API 请求延迟 (直方图)
   *
   * 标签:
   * - method: HTTP 方法
   * - route: API 路由
   * - status_code: HTTP 状态码
   *
   * Buckets: 10ms, 50ms, 100ms, 500ms, 1s, 5s
   */
  httpRequestDuration: new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [register],
  }),

  /**
   * HTTP 请求总数 (计数器)
   *
   * 标签:
   * - method: HTTP 方法
   * - route: API 路由
   * - status_code: HTTP 状态码
   */
  httpRequestsTotal: new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  }),

  /**
   * 缓存操作计数器
   *
   * 标签:
   * - operation: 操作类型 (hit, miss, set, delete)
   * - cache_name: 缓存名称
   */
  cacheOperations: new promClient.Counter({
    name: 'cache_operations_total',
    help: 'Total number of cache operations',
    labelNames: ['operation', 'cache_name'],
    registers: [register],
  }),

  /**
   * 飞书 API 调用次数 (计数器)
   *
   * 标签:
   * - api: API 名称
   * - status: 调用状态 (success, error)
   */
  feishuApiCalls: new promClient.Counter({
    name: 'feishu_api_calls_total',
    help: 'Total number of Feishu API calls',
    labelNames: ['api', 'status'],
    registers: [register],
  }),

  /**
   * 飞书 API 调用延迟 (直方图)
   *
   * 标签:
   * - api: API 名称
   *
   * Buckets: 100ms, 500ms, 1s, 2s, 5s, 10s
   */
  feishuApiDuration: new promClient.Histogram({
    name: 'feishu_api_duration_seconds',
    help: 'Duration of Feishu API calls in seconds',
    labelNames: ['api'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  }),

  /**
   * 邮件发送次数 (计数器)
   *
   * 标签:
   * - status: 发送状态 (success, error)
   * - type: 邮件类型 (patrol_report, alert)
   */
  emailsSent: new promClient.Counter({
    name: 'emails_sent_total',
    help: 'Total number of emails sent',
    labelNames: ['status', 'type'],
    registers: [register],
  }),

  /**
   * 截图生成次数 (计数器)
   *
   * 标签:
   * - status: 生成状态 (success, error)
   * - quality: 截图质量 (high, medium, low)
   */
  screenshotsGenerated: new promClient.Counter({
    name: 'screenshots_generated_total',
    help: 'Total number of screenshots generated',
    labelNames: ['status', 'quality'],
    registers: [register],
  }),

  /**
   * 性能测试执行次数 (计数器)
   *
   * 标签:
   * - metric_type: 指标类型 (lcp, fid, cls, fcp, ttfb)
   */
  performanceTests: new promClient.Counter({
    name: 'performance_tests_total',
    help: 'Total number of performance tests executed',
    labelNames: ['metric_type'],
    registers: [register],
  }),

  /**
   * 性能指标值 (直方图)
   *
   * 标签:
   * - metric_type: 指标类型 (lcp, fid, cls, fcp, ttfb)
   * - url: 测试 URL
   *
   * Buckets: 根据不同指标类型设置
   */
  performanceMetricValue: new promClient.Histogram({
    name: 'performance_metric_value',
    help: 'Performance metric values',
    labelNames: ['metric_type', 'url'],
    buckets: [100, 500, 1000, 2000, 3000, 5000],
    registers: [register],
  }),

  /**
   * 数据库查询延迟 (直方图)
   *
   * 标签:
   * - operation: 操作类型 (select, insert, update, delete)
   * - table: 表名
   */
  databaseQueryDuration: new promClient.Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [register],
  }),

  /**
   * 活跃巡检任务数 (计量器)
   */
  activePatrolTasks: new promClient.Gauge({
    name: 'active_patrol_tasks',
    help: 'Number of currently active patrol tasks',
    registers: [register],
  }),

  /**
   * 错误总数 (计数器)
   *
   * 标签:
   * - error_type: 错误类型
   * - severity: 严重程度 (low, medium, high, critical)
   */
  errorsTotal: new promClient.Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['error_type', 'severity'],
    registers: [register],
  }),
};

/**
 * 辅助函数: 记录 API 请求指标
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number
): void {
  metrics.httpRequestDuration.observe(
    { method, route, status_code: statusCode.toString() },
    durationSeconds
  );
  metrics.httpRequestsTotal.inc({
    method,
    route,
    status_code: statusCode.toString(),
  });
}

/**
 * 辅助函数: 记录巡检任务执行
 */
export function recordPatrolExecution(
  taskId: string,
  status: 'success' | 'failed' | 'timeout',
  durationSeconds: number
): void {
  metrics.patrolExecutionDuration.observe({ task_id: taskId, status }, durationSeconds);
}

/**
 * 辅助函数: 更新浏览器池状态
 */
export function updateBrowserPoolStatus(
  active: number,
  idle: number,
  total: number
): void {
  metrics.browserPoolStatus.set({ state: 'active' }, active);
  metrics.browserPoolStatus.set({ state: 'idle' }, idle);
  metrics.browserPoolStatus.set({ state: 'total' }, total);
}

/**
 * 辅助函数: 记录缓存操作
 */
export function recordCacheOperation(
  operation: 'hit' | 'miss' | 'set' | 'delete',
  cacheName: string
): void {
  metrics.cacheOperations.inc({ operation, cache_name: cacheName });
}

/**
 * 辅助函数: 记录飞书 API 调用
 */
export function recordFeishuApiCall(
  api: string,
  status: 'success' | 'error',
  durationSeconds: number
): void {
  metrics.feishuApiCalls.inc({ api, status });
  metrics.feishuApiDuration.observe({ api }, durationSeconds);
}

/**
 * 辅助函数: 记录错误
 */
export function recordError(errorType: string, severity: string): void {
  metrics.errorsTotal.inc({ error_type: errorType, severity });
}

/**
 * 获取所有指标 (用于 /metrics 端点)
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}
