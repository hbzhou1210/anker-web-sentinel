import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { requestIdMiddleware, errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { loggingMiddleware, errorLoggingMiddleware } from './middleware/loggingMiddleware.js';
import { getMetrics } from '../monitoring/metrics.js';

const app: Express = express();

// 信任反向代理 (Nginx)
// 这样 req.protocol, req.hostname, req.ip 等会使用 X-Forwarded-* 头
app.set('trust proxy', true);

// Request ID middleware (应该最先应用)
app.use(requestIdMiddleware);

// Logging middleware (应该在 Request ID 之后,用于记录所有请求)
app.use(loggingMiddleware);

// Metrics middleware (应该在 Request ID 之后应用,用于追踪所有请求)
app.use(metricsMiddleware);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:80',  // Docker 一体式部署
  'http://localhost',  // Docker 一体式部署(默认端口)
  'https://web.anker-launch.com', // Launch 平台域名
  'https://web-uat.anker-launch.com', // Launch UAT 环境
];

app.use(
  cors({
    origin: (origin, callback) => {
      // 允许无 origin 的请求（如 Postman、curl）
      if (!origin) return callback(null, true);

      // 开发环境允许所有 localhost 和内网 IP (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
      if (origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          origin.match(/^https?:\/\/(10|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\./)) {
        return callback(null, true);
      }

      // 检查是否在允许列表中，或者是 Launch 平台的子路径
      if (allowedOrigins.includes(origin) ||
          origin.includes('anker-launch.com') ||
          origin.includes('.launch.anker-in.com')) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    const metrics = await getMetrics();
    res.send(metrics);
  } catch (error) {
    console.error('Failed to generate metrics:', error);
    res.status(500).send('Failed to generate metrics');
  }
});

// 注意: API 路由应该在 index.ts 中注册
// 注意: 404 和错误处理中间件也应该在 index.ts 中所有路由注册后添加

// 导出 app 以及错误处理中间件,供 index.ts 使用
export { notFoundHandler, errorLoggingMiddleware, errorHandler };
export default app;
