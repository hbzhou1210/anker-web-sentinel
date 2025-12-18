/**
 * 应用基础错误类
 *
 * 所有自定义错误都应继承此类
 */

import {
  ErrorCategory,
  ErrorSeverity,
  ErrorContext,
  ErrorRecoveryStrategy,
  ErrorHttpStatusMap,
} from './types.js';

/**
 * 应用基础错误类
 */
export class BaseError extends Error {
  public readonly category: ErrorCategory;
  public severity: ErrorSeverity; // 不使用 readonly,允许子类修改
  public readonly context: ErrorContext;
  public recoveryStrategy: ErrorRecoveryStrategy; // 不使用 readonly,允许子类修改
  public readonly timestamp: Date;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    options: {
      category: ErrorCategory;
      severity?: ErrorSeverity;
      context?: ErrorContext;
      recoveryStrategy?: Partial<ErrorRecoveryStrategy>;
      cause?: Error;
      isOperational?: boolean;
    }
  ) {
    super(message);
    this.name = this.constructor.name;

    // 设置原型链(TypeScript 继承 Error 类的必要步骤)
    Object.setPrototypeOf(this, new.target.prototype);

    this.category = options.category;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.context = options.context || {};
    this.timestamp = new Date();
    this.isOperational = options.isOperational !== undefined ? options.isOperational : true;

    // 设置错误堆栈
    if (options.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }

    // 设置默认恢复策略
    this.recoveryStrategy = {
      retriable: false,
      maxRetries: 0,
      retryDelay: 1000,
      exponentialBackoff: false,
      recoveryActions: [],
      ...options.recoveryStrategy,
    };
  }

  /**
   * 获取 HTTP 状态码
   */
  public getHttpStatus(): number {
    return ErrorHttpStatusMap[this.category] || 500;
  }

  /**
   * 获取错误代码
   */
  public getErrorCode(): string {
    return `${this.category}_${this.name.replace(/Error$/, '').toUpperCase()}`;
  }

  /**
   * 是否可重试
   */
  public isRetriable(): boolean {
    return this.recoveryStrategy.retriable;
  }

  /**
   * 转换为 JSON 格式(用于日志和 API 响应)
   */
  public toJSON(includeStack: boolean = false): Record<string, any> {
    const json: Record<string, any> = {
      name: this.name,
      message: this.message,
      code: this.getErrorCode(),
      category: this.category,
      severity: this.severity,
      statusCode: this.getHttpStatus(),
      timestamp: this.timestamp.toISOString(),
      isOperational: this.isOperational,
      retriable: this.isRetriable(),
    };

    if (includeStack) {
      json.stack = this.stack;
      json.context = this.context;
    }

    if (this.recoveryStrategy.recoveryActions && this.recoveryStrategy.recoveryActions.length > 0) {
      json.recoveryActions = this.recoveryStrategy.recoveryActions;
    }

    return json;
  }

  /**
   * 添加上下文信息
   */
  public addContext(context: Partial<ErrorContext>): this {
    Object.assign(this.context, context);
    return this;
  }

  /**
   * 增加重试计数
   */
  public incrementRetryCount(): this {
    this.context.retryCount = (this.context.retryCount || 0) + 1;
    return this;
  }
}
