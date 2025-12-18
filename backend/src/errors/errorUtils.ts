/**
 * 错误处理工具函数
 */

import { BaseError } from './BaseError.js';
import { ErrorCategory, ErrorSeverity, ErrorDetails, ErrorContext } from './types.js';
import { InternalError } from './errors.js';
import { configService } from '../config/index.js';

/**
 * 判断是否为操作错误(可预期的业务错误)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

/**
 * 判断是否为严重错误
 */
export function isCriticalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.severity === ErrorSeverity.CRITICAL;
  }
  return false;
}

/**
 * 判断错误是否可重试
 */
export function isRetriableError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isRetriable();
  }
  return false;
}

/**
 * 将任意错误转换为 BaseError
 */
export function normalizeError(error: unknown, context?: ErrorContext): BaseError {
  // 如果已经是 BaseError,直接返回
  if (error instanceof BaseError) {
    if (context) {
      error.addContext(context);
    }
    return error;
  }

  // 如果是普通 Error
  if (error instanceof Error) {
    return new InternalError(
      error.message,
      {
        ...context,
        originalErrorName: error.name,
      },
      error
    );
  }

  // 如果是字符串
  if (typeof error === 'string') {
    return new InternalError(error, context);
  }

  // 其他未知类型
  return new InternalError(
    '发生未知错误',
    {
      ...context,
      originalError: String(error),
    }
  );
}

/**
 * 将错误转换为 API 响应格式
 */
export function errorToResponse(error: Error, requestId?: string): ErrorDetails {
  const baseError = normalizeError(error);
  const isProduction = configService.isProduction();

  const response: ErrorDetails = {
    code: baseError.getErrorCode(),
    message: baseError.message,
    category: baseError.category,
    statusCode: baseError.getHttpStatus(),
    timestamp: baseError.timestamp,
    requestId,
  };

  // 非生产环境返回详细信息
  if (!isProduction) {
    response.details = error.stack;
    response.context = baseError.context;
  }

  // 添加恢复建议
  if (baseError.recoveryStrategy.recoveryActions && baseError.recoveryStrategy.recoveryActions.length > 0) {
    response.recoveryActions = baseError.recoveryStrategy.recoveryActions;
  }

  return response;
}

/**
 * 记录错误日志
 */
export function logError(error: Error, context?: ErrorContext): void {
  const baseError = normalizeError(error, context);
  const logData = baseError.toJSON(true);

  // 根据严重程度选择日志级别
  switch (baseError.severity) {
    case ErrorSeverity.CRITICAL:
      console.error('[CRITICAL ERROR]', logData);
      break;
    case ErrorSeverity.HIGH:
      console.error('[HIGH ERROR]', logData);
      break;
    case ErrorSeverity.MEDIUM:
      console.warn('[MEDIUM ERROR]', logData);
      break;
    case ErrorSeverity.LOW:
      console.info('[LOW ERROR]', logData);
      break;
    default:
      console.error('[ERROR]', logData);
  }
}

/**
 * 计算重试延迟(支持指数退避)
 */
export function calculateRetryDelay(
  baseDelay: number,
  retryCount: number,
  useExponentialBackoff: boolean = false
): number {
  if (!useExponentialBackoff) {
    return baseDelay;
  }

  // 指数退避: baseDelay * (2 ^ retryCount)
  // 最大延迟不超过 30 秒
  const delay = baseDelay * Math.pow(2, retryCount);
  return Math.min(delay, 30000);
}

/**
 * 异步操作重试包装器
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    exponentialBackoff?: boolean;
    onRetry?: (error: Error, attempt: number) => void;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = false,
    onRetry,
    shouldRetry = isRetriableError,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // 检查是否应该重试
      if (attempt < maxRetries && shouldRetry(lastError)) {
        const delay = calculateRetryDelay(retryDelay, attempt, exponentialBackoff);

        if (onRetry) {
          onRetry(lastError, attempt + 1);
        }

        console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError!;
}

/**
 * 休眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 包装异步函数,自动捕获和规范化错误
 */
export function wrapAsync<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: Partial<ErrorContext>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw normalizeError(error, {
        ...context,
        operation: fn.name,
      });
    }
  };
}

/**
 * 从错误中提取用户友好的消息
 */
export function getUserFriendlyMessage(error: Error): string {
  if (error instanceof BaseError) {
    return error.message;
  }

  // 对于未知错误,返回通用消息
  return '操作失败,请稍后重试';
}

/**
 * 判断是否应该向用户显示错误详情
 */
export function shouldShowErrorDetails(): boolean {
  return !configService.isProduction();
}
