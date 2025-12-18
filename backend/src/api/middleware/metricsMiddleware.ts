/**
 * Metrics 中间件
 *
 * 自动记录所有 API 请求的性能指标
 */

import { Request, Response, NextFunction } from 'express';
import { recordHttpRequest } from '../../monitoring/metrics.js';

/**
 * 指标记录中间件
 *
 * 自动追踪:
 * - HTTP 请求方法
 * - API 路由路径
 * - HTTP 状态码
 * - 请求处理时长
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // 监听响应完成事件
  res.on('finish', () => {
    const durationSeconds = (Date.now() - startTime) / 1000;
    const route = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode;

    // 记录指标
    recordHttpRequest(method, route, statusCode, durationSeconds);
  });

  next();
}

/**
 * 路由规范化函数
 *
 * 将动态路由参数替换为占位符,避免高基数问题
 *
 * 示例:
 * - /api/v1/patrol/tasks/123 -> /api/v1/patrol/tasks/:id
 * - /api/v1/users/abc-def-ghi -> /api/v1/users/:id
 */
export function normalizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUID
    .replace(/\/\d+/g, '/:id') // 数字 ID
    .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token'); // 长令牌
}
