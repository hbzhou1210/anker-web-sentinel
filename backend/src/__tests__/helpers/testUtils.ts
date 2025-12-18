/**
 * 测试工具函数
 *
 * 提供常用的测试辅助函数
 */

import { Request, Response, NextFunction } from 'express';

/**
 * 创建 Mock Request 对象
 */
export function createMockRequest(options: {
  body?: any;
  params?: any;
  query?: any;
  headers?: Record<string, string>;
  method?: string;
  path?: string;
} = {}): Partial<Request> {
  return {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
    method: options.method || 'GET',
    path: options.path || '/',
  };
}

/**
 * 创建 Mock Response 对象
 */
export function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    headersSent: false,
  };
  return res;
}

/**
 * 创建 Mock NextFunction
 */
export function createMockNext(): NextFunction {
  return jest.fn();
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 等待条件满足
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await sleep(interval);
  }
}

/**
 * 期待异步函数抛出特定错误
 */
export async function expectToThrow<T extends Error>(
  fn: () => Promise<any>,
  errorClass: new (...args: any[]) => T
): Promise<T> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (!(error instanceof errorClass)) {
      throw new Error(
        `Expected error to be instance of ${errorClass.name}, but got ${error instanceof Error ? error.constructor.name : typeof error}`
      );
    }
    return error as T;
  }
}

/**
 * 创建 Mock 计时器
 */
export function useFakeTimers(): void {
  jest.useFakeTimers();
}

/**
 * 恢复真实计时器
 */
export function useRealTimers(): void {
  jest.useRealTimers();
}

/**
 * 快进时间
 */
export function advanceTimersByTime(ms: number): void {
  jest.advanceTimersByTime(ms);
}

/**
 * 运行所有计时器
 */
export async function runAllTimers(): Promise<void> {
  jest.runAllTimers();
}

/**
 * 生成随机字符串
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * 生成随机数字
 */
export function randomNumber(min: number = 0, max: number = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成测试用的 UUID
 */
export function testUuid(): string {
  return `test-${randomString(8)}-${randomString(4)}-${randomString(4)}-${randomString(12)}`;
}

/**
 * 创建测试用的日期
 */
export function testDate(offset: number = 0): Date {
  return new Date(Date.now() + offset);
}
