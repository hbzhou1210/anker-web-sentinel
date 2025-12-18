/**
 * 错误处理模块统一导出
 */

// 基础错误类
export { BaseError } from './BaseError.js';

// 具体错误类
export {
  // 验证错误
  ValidationError,
  RequiredFieldError,
  InvalidFormatError,

  // 业务逻辑错误
  BusinessLogicError,
  ResourceConflictError,
  OperationNotAllowedError,

  // 资源错误
  ResourceNotFoundError,

  // 外部服务错误
  ExternalServiceError,
  FeishuApiError,

  // 数据库错误
  DatabaseError,
  DatabaseConnectionError,

  // 网络错误
  NetworkError,

  // 超时错误
  TimeoutError,
  BrowserTimeoutError,

  // 配置错误
  ConfigValidationError,

  // 认证/授权错误
  AuthenticationError,
  AuthorizationError,

  // 内部错误
  InternalError,
} from './errors.js';

// 枚举和常量(运行时值)
export {
  ErrorCategory,
  ErrorSeverity,
  ErrorHttpStatusMap,
} from './types.js';

// 类型定义(仅类型,不生成运行时代码)
export type {
  ErrorContext,
  ErrorRecoveryStrategy,
  ErrorDetails,
} from './types.js';

// 工具函数
export {
  isOperationalError,
  isCriticalError,
  isRetriableError,
  normalizeError,
  errorToResponse,
  logError,
  calculateRetryDelay,
  retryAsync,
  wrapAsync,
  getUserFriendlyMessage,
  shouldShowErrorDetails,
} from './errorUtils.js';
