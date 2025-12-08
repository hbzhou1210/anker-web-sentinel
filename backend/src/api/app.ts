import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://web.anker-launch.com', // Launch 平台域名
  'https://web-uat.anker-launch.com', // Launch UAT 环境
];

app.use(
  cors({
    origin: (origin, callback) => {
      // 允许无 origin 的请求（如 Postman、curl）
      if (!origin) return callback(null, true);

      // 检查是否在允许列表中，或者是 Launch 平台的子路径
      if (allowedOrigins.includes(origin) || origin.includes('anker-launch.com')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error handler:', err);

  // Check if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  // Default error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
