/**
 * 具体错误类定义
 *
 * 为不同的错误场景提供专门的错误类
 */

import { BaseError } from './BaseError.js';
import { ErrorCategory, ErrorSeverity, ErrorContext } from './types.js';

// ==================== 验证错误 ====================

/**
 * 验证错误 - 用户输入或数据格式不正确
 */
export class ValidationError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(message, {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      context,
      recoveryStrategy: {
        retriable: false,
        recoveryActions: ['检查输入数据格式', '参考 API 文档确认必填字段'],
      },
    });
  }
}

/**
 * 必填字段缺失错误
 */
export class RequiredFieldError extends ValidationError {
  constructor(fieldName: string, context?: ErrorContext) {
    super(`必填字段缺失: ${fieldName}`, {
      ...context,
      fieldName,
    });
  }
}

/**
 * 无效格式错误
 */
export class InvalidFormatError extends ValidationError {
  constructor(fieldName: string, expectedFormat: string, context?: ErrorContext) {
    super(`字段格式无效: ${fieldName},期望格式: ${expectedFormat}`, {
      ...context,
      fieldName,
      expectedFormat,
    });
  }
}

// ==================== 业务逻辑错误 ====================

/**
 * 业务逻辑错误 - 违反业务规则
 */
export class BusinessLogicError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(message, {
      category: ErrorCategory.BUSINESS_LOGIC,
      severity: ErrorSeverity.MEDIUM,
      context,
      recoveryStrategy: {
        retriable: false,
      },
    });
  }
}

/**
 * 资源冲突错误
 */
export class ResourceConflictError extends BusinessLogicError {
  constructor(resourceType: string, resourceId: string, context?: ErrorContext) {
    super(`资源冲突: ${resourceType} [${resourceId}] 已存在或被占用`, {
      ...context,
      resourceType,
      resourceId,
    });
  }
}

/**
 * 操作不允许错误
 */
export class OperationNotAllowedError extends BusinessLogicError {
  constructor(operation: string, reason: string, context?: ErrorContext) {
    super(`操作不允许: ${operation} - ${reason}`, {
      ...context,
      operation,
      reason,
    });
  }
}

// ==================== 资源错误 ====================

/**
 * 资源未找到错误
 */
export class ResourceNotFoundError extends BaseError {
  constructor(resourceType: string, resourceId: string, context?: ErrorContext) {
    super(`资源未找到: ${resourceType} [${resourceId}]`, {
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.LOW,
      context: {
        ...context,
        resourceType,
        resourceId,
      },
      recoveryStrategy: {
        retriable: false,
        recoveryActions: ['检查资源 ID 是否正确', '确认资源是否已被删除'],
      },
    });
  }
}

// ==================== 外部服务错误 ====================

/**
 * 外部服务错误 - 第三方 API 调用失败
 */
export class ExternalServiceError extends BaseError {
  constructor(
    serviceName: string,
    message: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(`外部服务错误 [${serviceName}]: ${message}`, {
      category: ErrorCategory.EXTERNAL_SERVICE,
      severity: ErrorSeverity.HIGH,
      context: {
        ...context,
        serviceName,
      },
      cause,
      recoveryStrategy: {
        retriable: true,
        maxRetries: 3,
        retryDelay: 2000,
        exponentialBackoff: true,
        recoveryActions: ['稍后重试', '检查外部服务状态', '联系服务提供商'],
      },
    });
  }
}

/**
 * 飞书 API 错误
 */
export class FeishuApiError extends ExternalServiceError {
  constructor(message: string, errorCode?: number, context?: ErrorContext, cause?: Error) {
    super('Feishu API', message, {
      ...context,
      feishuErrorCode: errorCode,
    }, cause);
  }
}

// ==================== 数据库错误 ====================

/**
 * 数据库错误
 */
export class DatabaseError extends BaseError {
  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(`数据库错误: ${message}`, {
      category: ErrorCategory.DATABASE,
      severity: ErrorSeverity.HIGH,
      context,
      cause,
      recoveryStrategy: {
        retriable: true,
        maxRetries: 2,
        retryDelay: 1000,
        recoveryActions: ['检查数据库连接', '查看数据库日志', '联系数据库管理员'],
      },
    });
  }
}

/**
 * 数据库连接错误
 */
export class DatabaseConnectionError extends DatabaseError {
  constructor(context?: ErrorContext, cause?: Error) {
    super('数据库连接失败', context, cause);
    this.severity = ErrorSeverity.CRITICAL;
    this.recoveryStrategy.maxRetries = 5;
    this.recoveryStrategy.exponentialBackoff = true;
  }
}

// ==================== 网络错误 ====================

/**
 * 网络错误
 */
export class NetworkError extends BaseError {
  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(`网络错误: ${message}`, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      context,
      cause,
      recoveryStrategy: {
        retriable: true,
        maxRetries: 3,
        retryDelay: 2000,
        exponentialBackoff: true,
        recoveryActions: ['检查网络连接', '稍后重试'],
      },
    });
  }
}

// ==================== 超时错误 ====================

/**
 * 超时错误
 */
export class TimeoutError extends BaseError {
  constructor(operation: string, timeoutMs: number, context?: ErrorContext) {
    super(`操作超时: ${operation} (${timeoutMs}ms)`, {
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      context: {
        ...context,
        operation,
        timeoutMs,
      },
      recoveryStrategy: {
        retriable: true,
        maxRetries: 2,
        retryDelay: 1000,
        recoveryActions: ['增加超时时间', '优化操作性能', '检查系统负载'],
      },
    });
  }
}

/**
 * 浏览器超时错误
 */
export class BrowserTimeoutError extends TimeoutError {
  constructor(url: string, timeoutMs: number, context?: ErrorContext) {
    super(`页面加载超时: ${url}`, timeoutMs, {
      ...context,
      url,
    });
  }
}

// ==================== 配置错误 ====================

/**
 * 配置验证错误
 */
export class ConfigValidationError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(`配置错误: ${message}`, {
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.CRITICAL,
      context,
      isOperational: false, // 配置错误通常需要修复后重启
      recoveryStrategy: {
        retriable: false,
        recoveryActions: ['检查 .env 文件', '参考配置文档', '确认必需的环境变量已设置'],
      },
    });
  }
}

// ==================== 认证/授权错误 ====================

/**
 * 认证错误
 */
export class AuthenticationError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(message, {
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.MEDIUM,
      context,
      recoveryStrategy: {
        retriable: false,
        recoveryActions: ['检查认证凭据', '重新登录'],
      },
    });
  }
}

/**
 * 授权错误
 */
export class AuthorizationError extends BaseError {
  constructor(operation: string, context?: ErrorContext) {
    super(`无权限执行操作: ${operation}`, {
      category: ErrorCategory.AUTHORIZATION,
      severity: ErrorSeverity.MEDIUM,
      context: {
        ...context,
        operation,
      },
      recoveryStrategy: {
        retriable: false,
        recoveryActions: ['联系管理员申请权限', '使用有权限的账户'],
      },
    });
  }
}

// ==================== 内部错误 ====================

/**
 * 内部错误 - 未预期的系统错误
 */
export class InternalError extends BaseError {
  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(`内部错误: ${message}`, {
      category: ErrorCategory.INTERNAL,
      severity: ErrorSeverity.HIGH,
      context,
      cause,
      isOperational: false,
      recoveryStrategy: {
        retriable: false,
        recoveryActions: ['查看错误日志', '联系技术支持'],
      },
    });
  }
}
