/**
 * Winston Logger 配置
 *
 * 提供结构化日志记录功能:
 * - 多级别日志 (error, warn, info, debug)
 * - Console 彩色输出 (开发环境)
 * - 文件日志轮转 (生产环境)
 * - 结构化 JSON 格式
 * - 模块化子 logger
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { combine, timestamp, printf, errors, json, colorize, splat } = winston.format;

/**
 * 获取日志级别
 */
function getLogLevel(): string {
  return process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
}

/**
 * 自定义 Console 格式 (彩色,易读)
 */
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  splat(),
  printf(({ timestamp, level, message, module, ...meta }) => {
    const modulePrefix = module ? `[${module}] ` : '';
    const metaStr = Object.keys(meta).length && Object.keys(meta).some(k => !['service', 'timestamp', 'level'].includes(k))
      ? '\n' + JSON.stringify(meta, null, 2)
      : '';
    return `${timestamp} ${level} ${modulePrefix}${message}${metaStr}`;
  })
);

/**
 * 文件日志格式 (JSON,便于解析)
 */
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

/**
 * 创建日志传输器
 */
function createTransports(): winston.transport[] {
  const transports: winston.transport[] = [];

  // Console 输出 (总是启用)
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );

  // 仅在非测试环境下启用文件日志
  if (process.env.NODE_ENV !== 'test') {
    // 确保日志目录存在
    const logsDir = path.join(__dirname, '../../logs');

    // 普通日志文件 (所有级别)
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
        level: 'info',
      })
    );

    // 错误日志文件 (仅 error 级别)
    transports.push(
      new DailyRotateFile({
        level: 'error',
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: fileFormat,
      })
    );

    // 调试日志文件 (开发环境)
    if (process.env.NODE_ENV === 'development') {
      transports.push(
        new DailyRotateFile({
          level: 'debug',
          filename: path.join(logsDir, 'debug-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '7d',
          format: fileFormat,
        })
      );
    }
  }

  return transports;
}

/**
 * 创建 Winston Logger 实例
 */
export const logger = winston.createLogger({
  level: getLogLevel(),
  defaultMeta: {
    service: 'anita-qa-system',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: createTransports(),
  // 异常处理
  exceptionHandlers: process.env.NODE_ENV !== 'test' ? [
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs/exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
    }),
  ] : [],
  // 拒绝处理
  rejectionHandlers: process.env.NODE_ENV !== 'test' ? [
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs/rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
    }),
  ] : [],
});

/**
 * 创建模块化子 logger
 *
 * 使用示例:
 * ```typescript
 * const logger = createModuleLogger('PatrolService');
 * logger.info('Task started', { taskId: '123' });
 * logger.error('Task failed', { taskId: '123', error: err.message });
 * ```
 */
export function createModuleLogger(moduleName: string): winston.Logger {
  return logger.child({ module: moduleName });
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
}

/**
 * 日志上下文接口
 */
export interface LogContext {
  [key: string]: any;
}

/**
 * 增强的 Logger 接口(提供类型安全)
 */
export interface EnhancedLogger {
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

/**
 * 创建增强的模块 logger (类型安全)
 */
export function createEnhancedLogger(moduleName: string): EnhancedLogger {
  const childLogger = logger.child({ module: moduleName });

  return {
    error: (message: string, context?: LogContext) => {
      childLogger.error(message, context || {});
    },
    warn: (message: string, context?: LogContext) => {
      childLogger.warn(message, context || {});
    },
    info: (message: string, context?: LogContext) => {
      childLogger.info(message, context || {});
    },
    debug: (message: string, context?: LogContext) => {
      childLogger.debug(message, context || {});
    },
  };
}

/**
 * HTTP 请求日志格式化
 */
export function formatHttpLog(req: {
  method: string;
  url: string;
  statusCode?: number;
  duration?: number;
  ip?: string;
  userAgent?: string;
}): LogContext {
  return {
    http: {
      method: req.method,
      url: req.url,
      statusCode: req.statusCode,
      duration: req.duration,
      ip: req.ip,
      userAgent: req.userAgent,
    },
  };
}

/**
 * 错误日志格式化
 */
export function formatErrorLog(error: Error, context?: LogContext): LogContext {
  return {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  };
}

/**
 * 性能日志格式化
 */
export function formatPerformanceLog(operation: string, duration: number, context?: LogContext): LogContext {
  return {
    performance: {
      operation,
      duration,
      durationMs: duration,
      durationSeconds: duration / 1000,
    },
    ...context,
  };
}

// 导出默认 logger
export default logger;
