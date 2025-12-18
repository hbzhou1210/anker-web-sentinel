import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * 标准 API 限流器
 * 限制: 100 次/分钟/IP
 */
export const standardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 100, // 每个 IP 最多 100 次请求
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '60 seconds',
  },
  standardHeaders: true, // 返回 RateLimit-* headers
  legacyHeaders: false, // 禁用 X-RateLimit-* headers
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimiter] Standard rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '60 seconds',
    });
  },
});

/**
 * 严格限流器(用于资源密集型操作)
 * 限制: 10 次/分钟/IP
 * 适用于: 巡检任务执行、浏览器自动化等
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 10, // 每个 IP 最多 10 次请求
  message: {
    error: 'Rate limit exceeded for resource-intensive operations.',
    retryAfter: '60 seconds',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimiter] Strict rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'Rate limit exceeded for resource-intensive operations. Please try again later.',
      retryAfter: '60 seconds',
    });
  },
});

/**
 * 创建操作限流器(用于数据修改操作)
 * 限制: 30 次/分钟/IP
 */
export const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Too many create operations, please try again later.',
    retryAfter: '60 seconds',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // 即使成功也计入限制
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimiter] Create rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'Too many create operations. Please try again later.',
      retryAfter: '60 seconds',
    });
  },
});
