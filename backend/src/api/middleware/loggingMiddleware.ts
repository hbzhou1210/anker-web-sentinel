/**
 * HTTP 请求日志中间件
 *
 * 自动记录所有 HTTP 请求的详细信息
 */

import { Request, Response, NextFunction } from 'express';
import { createModuleLogger, formatHttpLog } from '../../utils/logger.js';

const logger = createModuleLogger('HttpRequest');

/**
 * HTTP 请求日志中间件
 *
 * 记录内容:
 * - 请求方法、URL、查询参数
 * - 响应状态码
 * - 请求处理时长
 * - 客户端 IP 和 User-Agent
 * - Request ID
 */
export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // 获取客户端 IP
  const clientIp =
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    'unknown';

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl, query, params } = req;
    const { statusCode } = res;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const requestId = (req as any).requestId || 'unknown';

    // 确定日志级别
    let logLevel: 'info' | 'warn' | 'error' = 'info';
    if (statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400) {
      logLevel = 'warn';
    }

    // 记录日志
    const logContext = {
      requestId,
      http: {
        method,
        url: originalUrl,
        statusCode,
        duration,
        query: Object.keys(query).length > 0 ? query : undefined,
        params: Object.keys(params).length > 0 ? params : undefined,
        clientIp: Array.isArray(clientIp) ? clientIp[0] : clientIp,
        userAgent,
      },
    };

    logger[logLevel](`${method} ${originalUrl} - ${statusCode}`, logContext);
  });

  next();
}

/**
 * 错误日志中间件
 *
 * 记录请求处理过程中发生的错误
 */
export function errorLoggingMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { method, originalUrl } = req;
  const requestId = (req as any).requestId || 'unknown';

  logger.error(`Request error: ${method} ${originalUrl}`, {
    requestId,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    http: {
      method,
      url: originalUrl,
    },
  });

  // 继续传递错误给下一个错误处理中间件
  next(err);
}
