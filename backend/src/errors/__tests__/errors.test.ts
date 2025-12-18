/**
 * 预定义错误类单元测试
 */

import {
  ValidationError,
  RequiredFieldError,
  InvalidFormatError,
  BusinessLogicError,
  ResourceConflictError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ExternalServiceError,
  FeishuApiError,
  DatabaseError,
  DatabaseConnectionError,
  NetworkError,
  TimeoutError,
  BrowserTimeoutError,
  ConfigValidationError,
  AuthenticationError,
  AuthorizationError,
  InternalError,
} from '../errors.js';
import { ErrorCategory, ErrorSeverity } from '../types.js';

describe('预定义错误类', () => {
  describe('ValidationError', () => {
    it('应该创建验证错误', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.isRetriable()).toBe(false);
      expect(error.getHttpStatus()).toBe(400);
    });

    it('应该包含恢复建议', () => {
      const error = new ValidationError('Invalid input');
      const json = error.toJSON();

      expect(json.recoveryActions).toContain('检查输入数据格式');
    });
  });

  describe('RequiredFieldError', () => {
    it('应该创建必填字段错误', () => {
      const error = new RequiredFieldError('email');

      expect(error.message).toBe('必填字段缺失: email');
      expect(error.context.fieldName).toBe('email');
    });
  });

  describe('InvalidFormatError', () => {
    it('应该创建格式无效错误', () => {
      const error = new InvalidFormatError('phone', 'xxx-xxxx-xxxx');

      expect(error.message).toContain('phone');
      expect(error.message).toContain('xxx-xxxx-xxxx');
      expect(error.context.fieldName).toBe('phone');
      expect(error.context.expectedFormat).toBe('xxx-xxxx-xxxx');
    });
  });

  describe('BusinessLogicError', () => {
    it('应该创建业务逻辑错误', () => {
      const error = new BusinessLogicError('Operation not allowed');

      expect(error.message).toBe('Operation not allowed');
      expect(error.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.getHttpStatus()).toBe(422);
    });
  });

  describe('ResourceConflictError', () => {
    it('应该创建资源冲突错误', () => {
      const error = new ResourceConflictError('User', 'user_123');

      expect(error.message).toContain('User');
      expect(error.message).toContain('user_123');
      expect(error.context.resourceType).toBe('User');
      expect(error.context.resourceId).toBe('user_123');
    });
  });

  describe('OperationNotAllowedError', () => {
    it('应该创建操作不允许错误', () => {
      const error = new OperationNotAllowedError('deleteUser', 'User has active sessions');

      expect(error.message).toContain('deleteUser');
      expect(error.message).toContain('User has active sessions');
      expect(error.context.operation).toBe('deleteUser');
      expect(error.context.reason).toBe('User has active sessions');
    });
  });

  describe('ResourceNotFoundError', () => {
    it('应该创建资源未找到错误', () => {
      const error = new ResourceNotFoundError('Task', 'task_456');

      expect(error.message).toContain('Task');
      expect(error.message).toContain('task_456');
      expect(error.category).toBe(ErrorCategory.RESOURCE);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.getHttpStatus()).toBe(404);
      expect(error.context.resourceType).toBe('Task');
      expect(error.context.resourceId).toBe('task_456');
    });

    it('应该包含恢复建议', () => {
      const error = new ResourceNotFoundError('Task', 'task_456');
      const json = error.toJSON();

      expect(json.recoveryActions).toContain('检查资源 ID 是否正确');
    });
  });

  describe('ExternalServiceError', () => {
    it('应该创建外部服务错误', () => {
      const error = new ExternalServiceError('WeatherAPI', 'Service unavailable');

      expect(error.message).toContain('WeatherAPI');
      expect(error.message).toContain('Service unavailable');
      expect(error.category).toBe(ErrorCategory.EXTERNAL_SERVICE);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.getHttpStatus()).toBe(502);
      expect(error.context.serviceName).toBe('WeatherAPI');
    });

    it('应该支持重试', () => {
      const error = new ExternalServiceError('API', 'Timeout');

      expect(error.isRetriable()).toBe(true);
      expect(error.recoveryStrategy.maxRetries).toBe(3);
      expect(error.recoveryStrategy.exponentialBackoff).toBe(true);
    });
  });

  describe('FeishuApiError', () => {
    it('应该创建飞书 API 错误', () => {
      const error = new FeishuApiError('Access token invalid', 99991402);

      expect(error.message).toContain('Access token invalid');
      expect(error.context.serviceName).toBe('Feishu API');
      expect(error.context.feishuErrorCode).toBe(99991402);
    });
  });

  describe('DatabaseError', () => {
    it('应该创建数据库错误', () => {
      const error = new DatabaseError('Query failed');

      expect(error.message).toContain('Query failed');
      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.getHttpStatus()).toBe(500);
    });

    it('应该支持重试', () => {
      const error = new DatabaseError('Connection lost');

      expect(error.isRetriable()).toBe(true);
      expect(error.recoveryStrategy.maxRetries).toBe(2);
    });
  });

  describe('DatabaseConnectionError', () => {
    it('应该创建数据库连接错误', () => {
      const error = new DatabaseConnectionError();

      expect(error.message).toContain('数据库连接失败');
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.recoveryStrategy.maxRetries).toBe(5);
      expect(error.recoveryStrategy.exponentialBackoff).toBe(true);
    });
  });

  describe('NetworkError', () => {
    it('应该创建网络错误', () => {
      const error = new NetworkError('Connection timeout');

      expect(error.message).toContain('Connection timeout');
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.getHttpStatus()).toBe(503);
    });

    it('应该支持重试', () => {
      const error = new NetworkError('Timeout');

      expect(error.isRetriable()).toBe(true);
      expect(error.recoveryStrategy.exponentialBackoff).toBe(true);
    });
  });

  describe('TimeoutError', () => {
    it('应该创建超时错误', () => {
      const error = new TimeoutError('processData', 5000);

      expect(error.message).toContain('processData');
      expect(error.message).toContain('5000');
      expect(error.category).toBe(ErrorCategory.TIMEOUT);
      expect(error.getHttpStatus()).toBe(408);
      expect(error.context.operation).toBe('processData');
      expect(error.context.timeoutMs).toBe(5000);
    });

    it('应该支持重试', () => {
      const error = new TimeoutError('operation', 1000);

      expect(error.isRetriable()).toBe(true);
    });
  });

  describe('BrowserTimeoutError', () => {
    it('应该创建浏览器超时错误', () => {
      const error = new BrowserTimeoutError('https://example.com', 30000);

      expect(error.message).toContain('https://example.com');
      expect(error.context.url).toBe('https://example.com');
      expect(error.context.timeoutMs).toBe(30000);
    });
  });

  describe('ConfigValidationError', () => {
    it('应该创建配置错误', () => {
      const error = new ConfigValidationError('FEISHU_APP_ID is required');

      expect(error.message).toContain('FEISHU_APP_ID is required');
      expect(error.category).toBe(ErrorCategory.CONFIGURATION);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.isOperational).toBe(false);
      expect(error.getHttpStatus()).toBe(500);
    });

    it('不应该支持重试', () => {
      const error = new ConfigValidationError('Config error');

      expect(error.isRetriable()).toBe(false);
    });
  });

  describe('AuthenticationError', () => {
    it('应该创建认证错误', () => {
      const error = new AuthenticationError('Token expired');

      expect(error.message).toBe('Token expired');
      expect(error.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.getHttpStatus()).toBe(401);
    });

    it('不应该支持重试', () => {
      const error = new AuthenticationError('Invalid credentials');

      expect(error.isRetriable()).toBe(false);
    });
  });

  describe('AuthorizationError', () => {
    it('应该创建授权错误', () => {
      const error = new AuthorizationError('deleteUser');

      expect(error.message).toContain('deleteUser');
      expect(error.category).toBe(ErrorCategory.AUTHORIZATION);
      expect(error.getHttpStatus()).toBe(403);
      expect(error.context.operation).toBe('deleteUser');
    });
  });

  describe('InternalError', () => {
    it('应该创建内部错误', () => {
      const error = new InternalError('Unexpected null pointer');

      expect(error.message).toContain('Unexpected null pointer');
      expect(error.category).toBe(ErrorCategory.INTERNAL);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.isOperational).toBe(false);
      expect(error.getHttpStatus()).toBe(500);
    });

    it('不应该支持重试', () => {
      const error = new InternalError('Bug in code');

      expect(error.isRetriable()).toBe(false);
    });
  });

  describe('错误链测试', () => {
    it('支持 cause 的错误类应该保留错误链', () => {
      const originalError = new Error('Original error');

      // 只测试那些接受 cause 参数的错误类
      const errors = [
        new DatabaseError('Test', {}, originalError),
        new NetworkError('Test', {}, originalError),
        new InternalError('Test', {}, originalError),
      ];

      errors.forEach(error => {
        expect(error.stack).toContain('Caused by:');
        expect(error.stack).toContain('Original error');
      });
    });
  });
});
