/**
 * BaseError 单元测试
 */

import { BaseError } from '../BaseError.js';
import { ErrorCategory, ErrorSeverity } from '../types.js';

describe('BaseError', () => {
  describe('构造函数', () => {
    it('应该创建带有基本属性的错误', () => {
      const error = new BaseError('Test error', {
        category: ErrorCategory.VALIDATION,
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM); // 默认值
      expect(error.isOperational).toBe(true); // 默认值
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('应该支持自定义严重程度', () => {
      const error = new BaseError('Test error', {
        category: ErrorCategory.INTERNAL,
        severity: ErrorSeverity.CRITICAL,
      });

      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('应该支持上下文信息', () => {
      const context = {
        operation: 'testOperation',
        userId: 'user123',
      };

      const error = new BaseError('Test error', {
        category: ErrorCategory.BUSINESS_LOGIC,
        context,
      });

      expect(error.context).toEqual(context);
    });

    it('应该支持自定义恢复策略', () => {
      const error = new BaseError('Test error', {
        category: ErrorCategory.NETWORK,
        recoveryStrategy: {
          retriable: true,
          maxRetries: 5,
          retryDelay: 2000,
        },
      });

      expect(error.recoveryStrategy.retriable).toBe(true);
      expect(error.recoveryStrategy.maxRetries).toBe(5);
      expect(error.recoveryStrategy.retryDelay).toBe(2000);
    });

    it('应该保留错误链(cause)', () => {
      const originalError = new Error('Original error');
      const error = new BaseError('Wrapped error', {
        category: ErrorCategory.EXTERNAL_SERVICE,
        cause: originalError,
      });

      expect(error.stack).toContain('Caused by:');
      expect(error.stack).toContain('Original error');
    });

    it('应该支持设置 isOperational 标志', () => {
      const operationalError = new BaseError('Operational', {
        category: ErrorCategory.VALIDATION,
        isOperational: true,
      });

      const programmaticError = new BaseError('Programmatic', {
        category: ErrorCategory.INTERNAL,
        isOperational: false,
      });

      expect(operationalError.isOperational).toBe(true);
      expect(programmaticError.isOperational).toBe(false);
    });
  });

  describe('getHttpStatus()', () => {
    it('应该返回正确的 HTTP 状态码', () => {
      const testCases = [
        { category: ErrorCategory.VALIDATION, expected: 400 },
        { category: ErrorCategory.AUTHENTICATION, expected: 401 },
        { category: ErrorCategory.AUTHORIZATION, expected: 403 },
        { category: ErrorCategory.RESOURCE, expected: 404 },
        { category: ErrorCategory.TIMEOUT, expected: 408 },
        { category: ErrorCategory.BUSINESS_LOGIC, expected: 422 },
        { category: ErrorCategory.INTERNAL, expected: 500 },
        { category: ErrorCategory.EXTERNAL_SERVICE, expected: 502 },
        { category: ErrorCategory.NETWORK, expected: 503 },
      ];

      testCases.forEach(({ category, expected }) => {
        const error = new BaseError('Test', { category });
        expect(error.getHttpStatus()).toBe(expected);
      });
    });
  });

  describe('getErrorCode()', () => {
    it('应该生成正确的错误代码', () => {
      const error = new BaseError('Test', {
        category: ErrorCategory.VALIDATION,
      });

      expect(error.getErrorCode()).toBe('VALIDATION_BASE');
    });

    it('应该移除 Error 后缀', () => {
      class CustomError extends BaseError {
        constructor() {
          super('Custom error', {
            category: ErrorCategory.BUSINESS_LOGIC,
          });
        }
      }

      const error = new CustomError();
      expect(error.getErrorCode()).toBe('BUSINESS_LOGIC_CUSTOM');
    });
  });

  describe('isRetriable()', () => {
    it('应该返回正确的重试状态', () => {
      const retriableError = new BaseError('Retriable', {
        category: ErrorCategory.NETWORK,
        recoveryStrategy: {
          retriable: true,
        },
      });

      const nonRetriableError = new BaseError('Non-retriable', {
        category: ErrorCategory.VALIDATION,
        recoveryStrategy: {
          retriable: false,
        },
      });

      expect(retriableError.isRetriable()).toBe(true);
      expect(nonRetriableError.isRetriable()).toBe(false);
    });
  });

  describe('toJSON()', () => {
    it('应该转换为 JSON 格式(不包含堆栈)', () => {
      const error = new BaseError('Test error', {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        recoveryStrategy: {
          retriable: false,
          recoveryActions: ['Check input'],
        },
      });

      const json = error.toJSON(false);

      expect(json.name).toBe('BaseError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('VALIDATION_BASE');
      expect(json.category).toBe(ErrorCategory.VALIDATION);
      expect(json.severity).toBe(ErrorSeverity.LOW);
      expect(json.statusCode).toBe(400);
      expect(json.isOperational).toBe(true);
      expect(json.retriable).toBe(false);
      expect(json.recoveryActions).toEqual(['Check input']);
      expect(json.stack).toBeUndefined();
      expect(json.context).toBeUndefined();
    });

    it('应该包含堆栈和上下文(当启用时)', () => {
      const error = new BaseError('Test error', {
        category: ErrorCategory.INTERNAL,
        context: {
          operation: 'test',
          userId: '123',
        },
      });

      const json = error.toJSON(true);

      expect(json.stack).toBeDefined();
      expect(json.context).toEqual({
        operation: 'test',
        userId: '123',
      });
    });

    it('应该包含 ISO 格式的时间戳', () => {
      const error = new BaseError('Test', {
        category: ErrorCategory.VALIDATION,
      });

      const json = error.toJSON();
      expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('addContext()', () => {
    it('应该添加上下文信息', () => {
      const error = new BaseError('Test', {
        category: ErrorCategory.VALIDATION,
        context: {
          operation: 'test',
        },
      });

      error.addContext({
        userId: '123',
        requestId: 'req-456',
      });

      expect(error.context).toEqual({
        operation: 'test',
        userId: '123',
        requestId: 'req-456',
      });
    });

    it('应该支持链式调用', () => {
      const error = new BaseError('Test', {
        category: ErrorCategory.VALIDATION,
      });

      const result = error
        .addContext({ step: 1 })
        .addContext({ step: 2 });

      expect(result).toBe(error);
      expect(error.context).toEqual({ step: 2 }); // 后面的覆盖前面的
    });
  });

  describe('incrementRetryCount()', () => {
    it('应该增加重试计数', () => {
      const error = new BaseError('Test', {
        category: ErrorCategory.NETWORK,
      });

      error.incrementRetryCount();
      expect(error.context.retryCount).toBe(1);

      error.incrementRetryCount();
      expect(error.context.retryCount).toBe(2);
    });

    it('应该支持链式调用', () => {
      const error = new BaseError('Test', {
        category: ErrorCategory.NETWORK,
      });

      const result = error.incrementRetryCount();
      expect(result).toBe(error);
    });
  });

  describe('继承', () => {
    it('应该支持创建自定义错误类', () => {
      class CustomError extends BaseError {
        constructor(message: string) {
          super(message, {
            category: ErrorCategory.BUSINESS_LOGIC,
            severity: ErrorSeverity.HIGH,
          });
        }
      }

      const error = new CustomError('Custom error message');

      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(CustomError);
      expect(error.message).toBe('Custom error message');
      expect(error.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.name).toBe('CustomError');
    });
  });
});
