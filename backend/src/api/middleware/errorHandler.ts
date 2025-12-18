/**
 * 统一错误处理中间件
 *
 * 捕获并处理所有 API 路由中抛出的错误
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { BaseError } from '../../errors/BaseError.js';
import { errorToResponse, logError, isOperationalError } from '../../errors/errorUtils.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 为请求添加 requestId
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 从请求头获取或生成新的 requestId
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();

  // 将 requestId 附加到请求对象
  (req as any).requestId = requestId;

  // 在响应头中返回 requestId
  res.setHeader('X-Request-ID', requestId);

  next();
}

/**
 * 全局错误处理中间件
 *
 * 应该在所有路由之后注册
 */
export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 获取 requestId
  const requestId = (req as any).requestId || 'unknown';

  // 记录错误日志
  logError(error, {
    requestId,
    operation: `${req.method} ${req.path}`,
    input: {
      body: req.body,
      query: req.query,
      params: req.params,
    },
  });

  // 转换为 API 响应格式
  const errorResponse = errorToResponse(error, requestId);

  // 发送错误响应
  res.status(errorResponse.statusCode).json(errorResponse);

  // 对于非操作错误(程序bug),可能需要额外处理
  if (!isOperationalError(error)) {
    console.error('[Non-Operational Error] This may require immediate attention:', error);
    // 这里可以添加告警通知逻辑
  }
};

/**
 * 404 未找到处理中间件
 *
 * 应该在所有路由之后、错误处理中间件之前注册
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as any).requestId || 'unknown';

  res.status(404).json({
    code: 'RESOURCE_NOT_FOUND',
    message: `路由未找到: ${req.method} ${req.path}`,
    category: 'RESOURCE',
    statusCode: 404,
    timestamp: new Date(),
    requestId,
  });
}

/**
 * 异步路由处理器包装器
 *
 * 自动捕获异步路由中的错误并传递给错误处理中间件
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getUsers();
 *   res.json(users);
 * }));
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
