/**
 * API 应用集成测试
 *
 * 测试 Express app 的基本功能:健康检查、CORS、错误处理等
 */

import request from 'supertest';
import app from '../app.js';

describe('API Application', () => {
  describe('GET /health', () => {
    it('应该返回健康状态', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
      });

      // 验证时间戳格式
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    it('应该在响应头中包含 X-Request-ID', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/); // UUID 格式
    });

    it('应该使用自定义的 X-Request-ID', async () => {
      const customRequestId = 'custom-request-id-123';

      const response = await request(app)
        .get('/health')
        .set('X-Request-ID', customRequestId)
        .expect(200);

      expect(response.headers['x-request-id']).toBe(customRequestId);
    });
  });

  describe('404 Not Found Handler', () => {
    it('应该对不存在的路由返回 404', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent-route')
        .expect(404)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
        category: 'RESOURCE',
        statusCode: 404,
        requestId: expect.any(String),
        timestamp: expect.any(String),
      });

      // 验证消息包含必要信息
      expect(response.body.message).toContain('路由未找到');
      expect(response.body.message).toContain('GET');
      expect(response.body.message).toContain('/api/v1/non-existent-route');
    });

    it('应该对 POST 请求到不存在的路由返回 404', async () => {
      const response = await request(app)
        .post('/api/v1/invalid-endpoint')
        .send({ data: 'test' })
        .expect(404);

      expect(response.body.message).toContain('POST');
      expect(response.body.message).toContain('/api/v1/invalid-endpoint');
    });

    it('应该对 PUT 请求到不存在的路由返回 404', async () => {
      const response = await request(app)
        .put('/api/v1/invalid-endpoint/123')
        .send({ data: 'test' })
        .expect(404);

      expect(response.body.message).toContain('PUT');
    });

    it('应该对 DELETE 请求到不存在的路由返回 404', async () => {
      const response = await request(app)
        .delete('/api/v1/invalid-endpoint/123')
        .expect(404);

      expect(response.body.message).toContain('DELETE');
    });
  });

  describe('CORS Configuration', () => {
    it('应该允许来自 localhost 的请求', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('应该允许来自内网 IP 的请求', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://192.168.1.100:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://192.168.1.100:3000');
    });

    it('应该允许来自 10.x.x.x 内网的请求', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://10.5.3.150:8080')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://10.5.3.150:8080');
    });

    it('应该允许没有 Origin 的请求 (如 Postman)', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // 没有 Origin 时不应该有 CORS 错误
      expect(response.status).toBe(200);
    });
  });

  describe('Request Logging', () => {
    it('应该记录请求日志', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      await request(app)
        .get('/health')
        .expect(200);

      // 验证日志包含请求信息
      const logCalls = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasRequestLog = logCalls.some(log =>
        log.includes('GET') && log.includes('/health') && log.includes('200')
      );

      expect(hasRequestLog).toBe(true);

      consoleSpy.mockRestore();
    });

    it('日志应该包含响应时间', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      await request(app)
        .get('/health')
        .expect(200);

      const logCalls = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasResponseTime = logCalls.some(log =>
        log.match(/\d+ms/)
      );

      expect(hasResponseTime).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('JSON Parsing', () => {
    it('应该解析 JSON 请求体', async () => {
      // 使用 health 端点来测试 JSON 解析 (虽然它不使用 body)
      const response = await request(app)
        .post('/api/v1/non-existent') // 404 路由也会解析 JSON
        .send({ test: 'data' })
        .set('Content-Type', 'application/json')
        .expect(404);

      // 如果 JSON 解析失败,会返回 400,这里返回 404 说明解析成功
      expect(response.status).toBe(404);
    });

    it('应该解析 URL 编码的请求体', async () => {
      const response = await request(app)
        .post('/api/v1/non-existent')
        .send('key=value')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(404);

      expect(response.status).toBe(404);
    });

    it('应该拒绝无效的 JSON', async () => {
      const response = await request(app)
        .post('/api/v1/non-existent')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json');

      // body-parser 抛出的 JSON 解析错误被错误处理器捕获,返回 500
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Request ID Middleware', () => {
    it('每个请求应该有唯一的 Request ID', async () => {
      const response1 = await request(app)
        .get('/health')
        .expect(200);

      const response2 = await request(app)
        .get('/health')
        .expect(200);

      const requestId1 = response1.headers['x-request-id'];
      const requestId2 = response2.headers['x-request-id'];

      expect(requestId1).toBeDefined();
      expect(requestId2).toBeDefined();
      expect(requestId1).not.toBe(requestId2);
    });

    it('应该保留客户端提供的 Request ID', async () => {
      const clientRequestId = 'client-' + Date.now();

      const response = await request(app)
        .get('/health')
        .set('X-Request-ID', clientRequestId)
        .expect(200);

      expect(response.headers['x-request-id']).toBe(clientRequestId);
    });
  });

  describe('Error Handling Integration', () => {
    // 由于我们测试的是 app.ts,它没有实际会抛出错误的路由
    // 我们只能测试 404 处理,具体路由的错误处理会在路由测试中覆盖

    it('错误响应应该包含标准字段', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent')
        .expect(404);

      // 验证错误响应格式
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('category');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('requestId');

      // 验证数据类型
      expect(typeof response.body.code).toBe('string');
      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.category).toBe('string');
      expect(typeof response.body.statusCode).toBe('number');
      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.requestId).toBe('string');
    });

    it('错误响应的 statusCode 应该与 HTTP 状态码一致', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent')
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.status).toBe(404);
    });
  });

  describe('Content-Type Headers', () => {
    it('JSON 响应应该有正确的 Content-Type', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('错误响应也应该是 JSON 格式', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent')
        .expect(404);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('HTTP Methods Support', () => {
    it('应该支持 GET 请求', async () => {
      await request(app)
        .get('/health')
        .expect(200);
    });

    it('应该支持 POST 请求 (即使路由不存在)', async () => {
      await request(app)
        .post('/api/v1/test')
        .send({ data: 'test' })
        .expect(404);
    });

    it('应该支持 PUT 请求', async () => {
      await request(app)
        .put('/api/v1/test/123')
        .send({ data: 'test' })
        .expect(404);
    });

    it('应该支持 DELETE 请求', async () => {
      await request(app)
        .delete('/api/v1/test/123')
        .expect(404);
    });

    it('应该支持 PATCH 请求', async () => {
      await request(app)
        .patch('/api/v1/test/123')
        .send({ data: 'test' })
        .expect(404);
    });
  });

  describe('Performance', () => {
    it('健康检查应该快速响应 (<100ms)', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/health')
        .expect(200);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('应该能够处理并发请求', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/health').expect(200)
      );

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });
});
