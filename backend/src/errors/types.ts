/**
 * 错误处理系统类型定义
 *
 * 定义了应用中所有错误类型和错误上下文
 */

/**
 * 错误类别
 */
export enum ErrorCategory {
  // 验证错误 - 用户输入或数据格式问题
  VALIDATION = 'VALIDATION',

  // 业务逻辑错误 - 业务规则违反
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',

  // 配置错误 - 系统配置问题
  CONFIGURATION = 'CONFIGURATION',

  // 外部服务错误 - 第三方 API 调用失败
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',

  // 数据库错误 - 数据持久化问题
  DATABASE = 'DATABASE',

  // 网络错误 - 网络连接问题
  NETWORK = 'NETWORK',

  // 资源错误 - 资源不存在或无法访问
  RESOURCE = 'RESOURCE',

  // 认证/授权错误
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',

  // 系统内部错误 - 未预期的系统问题
  INTERNAL = 'INTERNAL',

  // 超时错误
  TIMEOUT = 'TIMEOUT',

  // 未知错误
  UNKNOWN = 'UNKNOWN',
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  // 低 - 可恢复的错误,不影响系统运行
  LOW = 'LOW',

  // 中 - 影响单个操作,但系统仍可正常运行
  MEDIUM = 'MEDIUM',

  // 高 - 影响关键功能,需要立即关注
  HIGH = 'HIGH',

  // 严重 - 系统级故障,需要紧急处理
  CRITICAL = 'CRITICAL',
}

/**
 * HTTP 状态码映射
 */
export const ErrorHttpStatusMap: Record<ErrorCategory, number> = {
  [ErrorCategory.VALIDATION]: 400,
  [ErrorCategory.BUSINESS_LOGIC]: 422,
  [ErrorCategory.CONFIGURATION]: 500,
  [ErrorCategory.EXTERNAL_SERVICE]: 502,
  [ErrorCategory.DATABASE]: 500,
  [ErrorCategory.NETWORK]: 503,
  [ErrorCategory.RESOURCE]: 404,
  [ErrorCategory.AUTHENTICATION]: 401,
  [ErrorCategory.AUTHORIZATION]: 403,
  [ErrorCategory.INTERNAL]: 500,
  [ErrorCategory.TIMEOUT]: 408,
  [ErrorCategory.UNKNOWN]: 500,
};

/**
 * 错误上下文
 * 携带额外的调试和诊断信息
 */
export interface ErrorContext {
  // 错误发生的操作/方法名称
  operation?: string;

  // 相关的资源 ID
  resourceId?: string;

  // 相关的用户 ID
  userId?: string;

  // 请求 ID (用于追踪)
  requestId?: string;

  // 错误发生时的输入数据
  input?: any;

  // 错误发生时的系统状态
  systemState?: Record<string, any>;

  // 重试次数
  retryCount?: number;

  // 错误堆栈
  stack?: string;

  // 其他自定义上下文
  [key: string]: any;
}

/**
 * 错误恢复策略
 */
export interface ErrorRecoveryStrategy {
  // 是否可重试
  retriable: boolean;

  // 最大重试次数
  maxRetries?: number;

  // 重试延迟(毫秒)
  retryDelay?: number;

  // 是否使用指数退避
  exponentialBackoff?: boolean;

  // 恢复建议
  recoveryActions?: string[];
}

/**
 * 错误详情(用于 API 响应)
 */
export interface ErrorDetails {
  // 错误代码
  code: string;

  // 用户友好的错误消息
  message: string;

  // 详细的技术错误信息(仅开发/测试环境)
  details?: string;

  // 错误类别
  category: ErrorCategory;

  // HTTP 状态码
  statusCode: number;

  // 时间戳
  timestamp: Date;

  // 请求 ID
  requestId?: string;

  // 错误上下文(仅开发/测试环境)
  context?: ErrorContext;

  // 恢复建议
  recoveryActions?: string[];
}
