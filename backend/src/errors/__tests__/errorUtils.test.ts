/**
 * 错误工具函数单元测试
 */

import {
  isOperationalError,
  isCriticalError,
  isRetriableError,
  normalizeError,
  errorToResponse,
  calculateRetryDelay,
  retryAsync,
} from '../errorUtils.js';
import {
  BaseError,
  ValidationError,
  InternalError,
  NetworkError,
  ErrorCategory,
  ErrorSeverity,
} from '../index.js';
import { sleep } from '../../__tests__/helpers/testUtils.js';

describe('errorUtils', () => {
  describe('isOperationalError()', () => {
    it('应该识别操作错误', () => {
      const operationalError = new ValidationError('Test');
      const programmaticError = new InternalError('Bug');

      expect(isOperationalError(operationalError)).toBe(true);
      expect(isOperationalError(programmaticError)).toBe(false);
    });

    it('应该对普通 Error 返回 false', () => {
      const error = new Error('Test');

      expect(isOperationalError(error)).toBe(false);
    });
  });

  describe('isCriticalError()', () => {
    it('应该识别严重错误', () => {
      const criticalError = new BaseError('Critical', {
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.CRITICAL,
      });

      const normalError = new ValidationError('Normal');

      expect(isCriticalError(criticalError)).toBe(true);
      expect(isCriticalError(normalError)).toBe(false);
    });

    it('应该对普通 Error 返回 false', () => {
      const error = new Error('Test');

      expect(isCriticalError(error)).toBe(false);
    });
  });

  describe('isRetriableError()', () => {
    it('应该识别可重试错误', () => {
      const retriableError = new NetworkError('Timeout');
      const nonRetriableError = new ValidationError('Invalid input');

      expect(isRetriableError(retriableError)).toBe(true);
      expect(isRetriableError(nonRetriableError)).toBe(false);
    });

    it('应该对普通 Error 返回 false', () => {
      const error = new Error('Test');

      expect(isRetriableError(error)).toBe(false);
    });
  });

  describe('normalizeError()', () => {
    it('应该保留 BaseError', () => {
      const original = new ValidationError('Test');
      const normalized = normalizeError(original);

      expect(normalized).toBe(original);
    });

    it('应该转换普通 Error 为 InternalError', () => {
      const original = new Error('Test error');
      const normalized = normalizeError(original);

      expect(normalized).toBeInstanceOf(InternalError);
      expect(normalized.message).toContain('Test error');
      expect(normalized.context.originalErrorName).toBe('Error');
    });

    it('应该转换字符串为 InternalError', () => {
      const normalized = normalizeError('Error message');

      expect(normalized).toBeInstanceOf(InternalError);
      expect(normalized.message).toBe('内部错误: Error message');
    });

    it('应该转换未知类型为 InternalError', () => {
      const normalized = normalizeError({ code: 123 });

      expect(normalized).toBeInstanceOf(InternalError);
      expect(normalized.message).toBe('内部错误: 发生未知错误');
      expect(normalized.context.originalError).toBeDefined();
    });

    it('应该添加额外的上下文', () => {
      const original = new Error('Test');
      const normalized = normalizeError(original, {
        operation: 'testOp',
        userId: '123',
      });

      expect(normalized.context.operation).toBe('testOp');
      expect(normalized.context.userId).toBe('123');
    });
  });

  describe('errorToResponse()', () => {
    // Mock configService
    beforeEach(() => {
      // 设置测试环境为 development
      process.env.NODE_ENV = 'test';
    });

    it('应该转换错误为 API 响应格式', () => {
      const error = new ValidationError('Invalid input');
      const response = errorToResponse(error, 'req-123');

      expect(response.code).toBe('VALIDATION_VALIDATION');
      expect(response.message).toBe('Invalid input');
      expect(response.category).toBe(ErrorCategory.VALIDATION);
      expect(response.statusCode).toBe(400);
      expect(response.requestId).toBe('req-123');
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('应该在非生产环境包含详细信息', () => {
      process.env.NODE_ENV = 'development';

      const error = new ValidationError('Test', {
        operation: 'testOp',
      });
      const response = errorToResponse(error);

      expect(response.details).toBeDefined();
      expect(response.context).toBeDefined();
      expect(response.context?.operation).toBe('testOp');
    });

    it('应该包含恢复建议', () => {
      const error = new ValidationError('Invalid input');
      const response = errorToResponse(error);

      expect(response.recoveryActions).toBeDefined();
      expect(response.recoveryActions?.length).toBeGreaterThan(0);
    });
  });

  describe('calculateRetryDelay()', () => {
    it('应该在不使用指数退避时返回固定延迟', () => {
      expect(calculateRetryDelay(1000, 0, false)).toBe(1000);
      expect(calculateRetryDelay(1000, 1, false)).toBe(1000);
      expect(calculateRetryDelay(1000, 2, false)).toBe(1000);
    });

    it('应该在使用指数退避时增加延迟', () => {
      expect(calculateRetryDelay(1000, 0, true)).toBe(1000);
      expect(calculateRetryDelay(1000, 1, true)).toBe(2000);
      expect(calculateRetryDelay(1000, 2, true)).toBe(4000);
      expect(calculateRetryDelay(1000, 3, true)).toBe(8000);
    });

    it('应该限制最大延迟为 30 秒', () => {
      expect(calculateRetryDelay(1000, 10, true)).toBe(30000);
      expect(calculateRetryDelay(1000, 20, true)).toBe(30000);
    });
  });

  describe('retryAsync()', () => {
    it('应该在成功时不重试', async () => {
      let callCount = 0;
      const operation = jest.fn(async () => {
        callCount++;
        return 'success';
      });

      const result = await retryAsync(operation, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(callCount).toBe(1);
    });

    it('应该在失败时重试', async () => {
      let callCount = 0;
      const operation = jest.fn(async () => {
        callCount++;
        if (callCount < 3) {
          throw new NetworkError('Timeout');
        }
        return 'success';
      });

      const result = await retryAsync(operation, {
        maxRetries: 3,
        retryDelay: 10,
      });

      expect(result).toBe('success');
      expect(callCount).toBe(3);
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      const operation = jest.fn(async () => {
        throw new NetworkError('Always fails');
      });

      await expect(
        retryAsync(operation, {
          maxRetries: 2,
          retryDelay: 10,
        })
      ).rejects.toThrow(NetworkError);

      expect(operation).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('应该在非重试错误时不重试', async () => {
      let callCount = 0;
      const operation = jest.fn(async () => {
        callCount++;
        throw new ValidationError('Invalid input');
      });

      await expect(
        retryAsync(operation, {
          maxRetries: 3,
          retryDelay: 10,
        })
      ).rejects.toThrow(ValidationError);

      expect(callCount).toBe(1); // No retries
    });

    it('应该调用 onRetry 回调', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount < 2) {
          throw new NetworkError('Fail');
        }
        return 'success';
      };

      const onRetry = jest.fn();

      await retryAsync(operation, {
        maxRetries: 2,
        retryDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(NetworkError),
        1
      );
    });

    it('应该支持自定义 shouldRetry 函数', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        throw new Error('Custom error');
      };

      const shouldRetry = jest.fn(() => true);

      await expect(
        retryAsync(operation, {
          maxRetries: 2,
          retryDelay: 10,
          shouldRetry,
        })
      ).rejects.toThrow();

      expect(callCount).toBe(3); // 1 initial + 2 retries
      expect(shouldRetry).toHaveBeenCalled();
    });
  });
});
