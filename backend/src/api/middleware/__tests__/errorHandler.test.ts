/**
 * ErrorHandler Middleware 单元测试
 */

import { Request, Response, NextFunction } from 'express';
import {
  requestIdMiddleware,
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from '../errorHandler.js';
import { ValidationError, DatabaseError, InternalError } from '../../../errors/index.js';
import { createMockRequest, createMockResponse, createMockNext } from '../../../__tests__/helpers/testUtils.js';

describe('ErrorHandler Middleware', () => {
  // Mock console methods
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('requestIdMiddleware', () => {
    it('应该生成并附加新的 requestId', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      requestIdMiddleware(req as Request, res as Response, next);

      // 应该附加 requestId 到请求对象
      expect((req as any).requestId).toBeDefined();
      expect(typeof (req as any).requestId).toBe('string');

      // 应该在响应头中设置 requestId
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Request-ID',
        (req as any).requestId
      );

      // 应该调用 next()
      expect(next).toHaveBeenCalled();
    });

    it('应该使用请求头中的 requestId', () => {
      const customRequestId = 'custom-request-id-123';
      const req = createMockRequest({
        headers: { 'x-request-id': customRequestId },
      });
      const res = createMockResponse();
      const next = createMockNext();

      requestIdMiddleware(req as Request, res as Response, next);

      // 应该使用自定义的 requestId
      expect((req as any).requestId).toBe(customRequestId);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', customRequestId);
      expect(next).toHaveBeenCalled();
    });

    it('生成的 requestId 应该是 UUID 格式', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      requestIdMiddleware(req as Request, res as Response, next);

      const requestId = (req as any).requestId;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      expect(requestId).toMatch(uuidRegex);
    });
  });

  describe('errorHandler', () => {
    it('应该处理 ValidationError', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      const req = createMockRequest({
        method: 'POST',
        path: '/api/v1/users',
      });
      (req as any).requestId = 'test-request-id';
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req as Request, res as Response, next);

      // 应该返回 400 状态码
      expect(res.status).toHaveBeenCalledWith(400);

      // 应该返回标准错误响应格式
      const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(res.json).toHaveBeenCalled();
      expect(jsonCall).toMatchObject({
        code: expect.any(String),
        category: 'VALIDATION',
        statusCode: 400,
        requestId: 'test-request-id',
      });
      expect(jsonCall.timestamp).toBeDefined();
      expect(jsonCall.message).toContain('Invalid input');
    });

    it('应该处理 DatabaseError', () => {
      const error = new DatabaseError('Connection failed');
      const req = createMockRequest({
        method: 'GET',
        path: '/api/v1/data',
      });
      (req as any).requestId = 'test-request-id';
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req as Request, res as Response, next);

      // 应该返回 500 状态码
      expect(res.status).toHaveBeenCalledWith(500);

      // 应该返回标准错误响应格式
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: expect.any(String),
          message: expect.stringContaining('Connection failed'),
          category: 'DATABASE',
          statusCode: 500,
        })
      );
    });

    it('应该处理普通 Error', () => {
      const error = new Error('Something went wrong');
      const req = createMockRequest({
        method: 'GET',
        path: '/api/v1/test',
      });
      (req as any).requestId = 'test-request-id';
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req as Request, res as Response, next);

      // 应该返回 500 状态码
      expect(res.status).toHaveBeenCalledWith(500);

      // 应该返回标准错误响应格式
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: expect.any(String),
          category: 'INTERNAL',
          statusCode: 500,
        })
      );
    });

    it('应该在没有 requestId 时使用 "unknown"', () => {
      const error = new ValidationError('Test error');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'unknown',
        })
      );
    });

    it('应该记录非操作错误', () => {
      const error = new Error('Unexpected error');
      const req = createMockRequest();
      (req as any).requestId = 'test-request-id';
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req as Request, res as Response, next);

      // 应该记录非操作错误
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Non-Operational Error] This may require immediate attention:',
        error
      );
    });

    it('不应该记录操作错误为非操作错误', () => {
      const error = new ValidationError('Valid error');
      const req = createMockRequest();
      (req as any).requestId = 'test-request-id';
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req as Request, res as Response, next);

      // 不应该记录为非操作错误
      const nonOpCalls = consoleErrorSpy.mock.calls.filter(
        call => call[0] && call[0].includes('[Non-Operational Error]')
      );
      expect(nonOpCalls).toHaveLength(0);
    });

    it('应该包含请求上下文信息', () => {
      const error = new ValidationError('Test error');
      const req = createMockRequest({
        method: 'POST',
        path: '/api/v1/test',
        body: { name: 'test' },
        query: { page: '1' },
        params: { id: '123' },
      });
      (req as any).requestId = 'test-request-id';
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req as Request, res as Response, next);

      // 验证错误响应中包含上下文信息
      const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.context).toBeDefined();
      expect(jsonCall.context).toMatchObject({
        requestId: 'test-request-id',
        operation: 'POST /api/v1/test',
      });
    });
  });

  describe('notFoundHandler', () => {
    it('应该返回 404 响应', () => {
      const req = createMockRequest({
        method: 'GET',
        path: '/api/v1/non-existent',
      });
      (req as any).requestId = 'test-request-id';
      const res = createMockResponse();
      const next = createMockNext();

      notFoundHandler(req as Request, res as Response, next);

      // 应该返回 404 状态码
      expect(res.status).toHaveBeenCalledWith(404);

      // 应该返回标准错误响应格式
      expect(res.json).toHaveBeenCalledWith({
        code: 'RESOURCE_NOT_FOUND',
        message: '路由未找到: GET /api/v1/non-existent',
        category: 'RESOURCE',
        statusCode: 404,
        timestamp: expect.any(Date),
        requestId: 'test-request-id',
      });
    });

    it('应该包含请求方法和路径', () => {
      const req = createMockRequest({
        method: 'POST',
        path: '/api/v1/invalid',
      });
      (req as any).requestId = 'test-request-id';
      const res = createMockResponse();
      const next = createMockNext();

      notFoundHandler(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '路由未找到: POST /api/v1/invalid',
        })
      );
    });

    it('应该在没有 requestId 时使用 "unknown"', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      notFoundHandler(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'unknown',
        })
      );
    });

    it('不应该调用 next()', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      notFoundHandler(req as Request, res as Response, next);

      // 404 处理器应该直接响应,不调用 next()
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('asyncHandler', () => {
    it('应该正常执行异步函数', async () => {
      const mockFn = jest.fn(async (req, res) => {
        res.json({ success: true });
      });

      const handler = asyncHandler(mockFn);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as Request, res as Response, next);

      expect(mockFn).toHaveBeenCalledWith(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该捕获异步函数中的错误并传递给 next', async () => {
      const error = new Error('Async error');
      const mockFn = jest.fn(async () => {
        throw error;
      });

      const handler = asyncHandler(mockFn);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as Request, res as Response, next);

      expect(mockFn).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });

    it('应该捕获 Promise rejection', async () => {
      const error = new ValidationError('Validation failed');
      const mockFn = jest.fn(() => Promise.reject(error));

      const handler = asyncHandler(mockFn);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('应该支持同步返回值', async () => {
      const mockFn = jest.fn((req, res) => {
        res.json({ sync: true });
        return undefined;
      });

      const handler = asyncHandler(mockFn);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as Request, res as Response, next);

      expect(mockFn).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ sync: true });
    });

    it('应该传递所有参数', async () => {
      const mockFn = jest.fn(async (req, res, next) => {
        expect(req).toBeDefined();
        expect(res).toBeDefined();
        expect(next).toBeDefined();
      });

      const handler = asyncHandler(mockFn);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await handler(req as Request, res as Response, next);

      expect(mockFn).toHaveBeenCalledWith(req, res, next);
    });

    it('应该支持多次调用', async () => {
      const mockFn = jest.fn(async (req, res) => {
        res.json({ call: true });
      });

      const handler = asyncHandler(mockFn);
      const req1 = createMockRequest();
      const res1 = createMockResponse();
      const next1 = createMockNext();

      await handler(req1 as Request, res1 as Response, next1);

      const req2 = createMockRequest();
      const res2 = createMockResponse();
      const next2 = createMockNext();

      await handler(req2 as Request, res2 as Response, next2);

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('集成测试', () => {
    it('requestIdMiddleware 和 errorHandler 应该协同工作', () => {
      // 先添加 requestId
      const req = createMockRequest();
      const res = createMockResponse();
      const next1 = createMockNext();

      requestIdMiddleware(req as Request, res as Response, next1);

      const requestId = (req as any).requestId;
      expect(requestId).toBeDefined();

      // 然后处理错误
      const error = new ValidationError('Test error');
      const next2 = createMockNext();

      errorHandler(error, req as Request, res as Response, next2);

      // 错误响应应该包含相同的 requestId
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId,
        })
      );
    });

    it('asyncHandler 和 errorHandler 应该协同工作', async () => {
      const error = new DatabaseError('DB connection failed');
      const mockFn = jest.fn(async () => {
        throw error;
      });

      const handler = asyncHandler(mockFn);
      const req = createMockRequest();
      (req as any).requestId = 'test-request-id';
      const res = createMockResponse();
      const next = createMockNext();

      // asyncHandler 捕获错误并传递给 next
      await handler(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(error);

      // errorHandler 处理错误
      errorHandler(error, req as Request, res as Response, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'DATABASE',
          statusCode: 500,
        })
      );
    });
  });
});
