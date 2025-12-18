# 测试文档

## 概述

本项目使用 **Jest** 作为测试框架,支持 TypeScript + ESM 模块。测试覆盖了核心基础设施层,包括错误处理、配置管理和事件系统。

## 测试统计

### 总体情况

- **总测试数**: 202 个 ⬆️ (+51)
- **通过率**: 100%
- **测试文件**: 7 个
- **测试执行时间**: ~8.8秒

### 模块覆盖率

| 模块 | 测试数 | 覆盖率 | 状态 |
|------|--------|--------|------|
| 错误处理系统 (errors) | 69 | 87.57% | ✅ |
| 配置服务 (config) | 43 | 88.31% | ✅ |
| 事件系统 (events) | 39 | 78.26% | ✅ |
| **API 应用层 (api)** ⭐ | **29** | **87.09%** | ✅ |
| **API 中间件 (middleware)** ⭐ | **22** | **100%** | ✅ |
| **总计** | **202** | **~88%*** | ✅ |

\* 核心模块平均覆盖率

## 测试结构

```
backend/
├── src/
│   ├── __tests__/
│   │   ├── setup.ts                     # Jest 全局设置
│   │   └── helpers/
│   │       └── testUtils.ts             # 测试工具函数
│   ├── errors/__tests__/
│   │   ├── BaseError.test.ts            # 基础错误类测试
│   │   ├── errors.test.ts               # 预定义错误类测试
│   │   └── errorUtils.test.ts           # 错误工具函数测试
│   ├── config/__tests__/
│   │   └── ConfigService.test.ts        # 配置服务测试
│   ├── events/__tests__/
│   │   └── EventEmitter.test.ts         # 事件发射器测试
│   ├── api/__tests__/                    ⭐ NEW
│   │   └── app.test.ts                  # Express 应用集成测试
│   └── api/middleware/__tests__/         ⭐ NEW
│       └── errorHandler.test.ts         # 错误处理中间件测试
├── jest.config.js                       # Jest 配置文件
└── coverage/                            # 测试覆盖率报告
    ├── lcov-report/                     # HTML 格式报告
    ├── lcov.info                        # LCOV 格式报告
    └── coverage-summary.json            # JSON 格式摘要
```

## 运行测试

### 基本命令

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- BaseError.test.ts

# 运行匹配特定模式的测试
npm test -- --testPathPattern="errors"

# 以监听模式运行测试
npm test -- --watch

# 生成测试覆盖率报告
npm test -- --coverage

# 运行测试并显示详细信息
npm test -- --verbose
```

### 调试测试

```bash
# 运行单个测试
npm test -- --testNamePattern="应该创建验证错误"

# 调试模式运行测试
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 测试详情

### 1. 错误处理系统测试 (69 个测试)

#### BaseError.test.ts (18 个测试)

测试 BaseError 基础错误类的核心功能:

- ✅ 构造函数和初始化
- ✅ HTTP 状态码映射
- ✅ 错误代码生成
- ✅ 重试逻辑
- ✅ JSON 序列化
- ✅ 上下文管理
- ✅ 错误链 (cause)
- ✅ 继承支持

#### errors.test.ts (29 个测试)

测试所有预定义的错误类:

**验证错误**
- ✅ ValidationError
- ✅ RequiredFieldError
- ✅ InvalidFormatError

**业务逻辑错误**
- ✅ BusinessLogicError
- ✅ ResourceConflictError
- ✅ OperationNotAllowedError

**资源错误**
- ✅ ResourceNotFoundError

**外部服务错误**
- ✅ ExternalServiceError
- ✅ FeishuApiError

**数据库错误**
- ✅ DatabaseError
- ✅ DatabaseConnectionError

**网络错误**
- ✅ NetworkError

**超时错误**
- ✅ TimeoutError
- ✅ BrowserTimeoutError

**配置错误**
- ✅ ConfigValidationError

**认证/授权错误**
- ✅ AuthenticationError
- ✅ AuthorizationError

**内部错误**
- ✅ InternalError

**错误链测试**
- ✅ 错误 cause 参数支持

#### errorUtils.test.ts (22 个测试)

测试错误工具函数:

- ✅ `isOperationalError()` - 识别操作错误
- ✅ `isCriticalError()` - 识别严重错误
- ✅ `isRetriableError()` - 识别可重试错误
- ✅ `normalizeError()` - 标准化错误对象
- ✅ `errorToResponse()` - 转换为 API 响应格式
- ✅ `calculateRetryDelay()` - 计算重试延迟
- ✅ `retryAsync()` - 异步重试机制

### 2. 配置服务测试 (43 个测试)

#### ConfigService.test.ts

测试配置管理服务的所有功能:

**构造函数与初始化**
- ✅ 默认值加载
- ✅ 环境变量覆盖
- ✅ 整数解析
- ✅ 布尔值解析

**配置验证**
- ✅ Bitable 存储配置验证
- ✅ PostgreSQL 存储配置验证
- ✅ 端口号验证 (1-65535)
- ✅ 浏览器配置验证
- ✅ 巡检配置验证
- ✅ 截图质量验证 (0-100)
- ✅ 多错误收集

**配置访问方法**
- ✅ `getConfig()` - 获取完整配置
- ✅ `getAppConfig()` - 应用配置
- ✅ `getDatabaseConfig()` - 数据库配置
- ✅ `getFeishuConfig()` - 飞书配置
- ✅ `getBrowserConfig()` - 浏览器配置
- ✅ `getRedisConfig()` - Redis 配置
- ✅ `getEmailConfig()` - 邮件配置
- ✅ `getPatrolConfig()` - 巡检配置
- ✅ `getScreenshotConfig()` - 截图配置
- ✅ `getPerformanceConfig()` - 性能测试配置

**环境检查方法**
- ✅ `useBitable()` - 检测 Bitable 存储
- ✅ `usePostgreSQL()` - 检测 PostgreSQL 存储
- ✅ `isProduction()` - 检测生产环境
- ✅ `isDevelopment()` - 检测开发环境
- ✅ `isTest()` - 检测测试环境

**其他功能**
- ✅ `printConfigSummary()` - 打印配置摘要
- ✅ 敏感信息隐藏
- ✅ 默认值测试
- ✅ 配置不可变性

### 3. 事件系统测试 (39 个测试)

#### EventEmitter.test.ts

测试事件发射器的完整功能:

**监听器注册**
- ✅ `on()` - 注册事件监听器
- ✅ `once()` - 注册一次性监听器
- ✅ 多监听器支持
- ✅ 不同事件类型
- ✅ 重复注册防护

**监听器移除**
- ✅ `off()` - 移除指定监听器
- ✅ `removeAllListeners()` - 移除所有监听器
- ✅ 选择性移除

**事件发射**
- ✅ `emit()` - 异步发射事件
- ✅ `emitSync()` - 同步发射事件
- ✅ 按顺序调用监听器
- ✅ 异步监听器支持
- ✅ 一次性监听器自动移除
- ✅ 错误隔离 (一个监听器失败不影响其他)

**工具方法**
- ✅ `listenerCount()` - 获取监听器数量
- ✅ `eventNames()` - 获取所有事件类型

**实际使用场景**
- ✅ 巡检完成事件
- ✅ 巡检失败事件
- ✅ 任务创建事件
- ✅ 事件链式处理

**边界情况**
- ✅ 监听器返回 undefined
- ✅ 监听器返回 Promise<void>
- ✅ 动态添加/移除监听器
- ✅ 无监听器时发射事件

### 4. API 应用层测试 (app.test.ts) - 29 个测试 ⭐

Express 应用的集成测试,验证 API 应用的基本功能:

**健康检查端点** (3 个测试)
- ✅ 返回健康状态和时间戳
- ✅ 在响应头中包含 X-Request-ID
- ✅ 使用客户端提供的 X-Request-ID

**404 处理器** (4 个测试)
- ✅ GET 请求返回 404 响应
- ✅ POST/PUT/DELETE 请求返回 404
- ✅ 错误消息包含方法和路径

**CORS 配置** (4 个测试)
- ✅ 允许 localhost 请求
- ✅ 允许内网 IP (192.168.x.x, 10.x.x.x)
- ✅ 允许无 Origin 的请求

**请求日志** (2 个测试)
- ✅ 记录请求方法、路径和状态码
- ✅ 日志包含响应时间

**JSON 解析** (3 个测试)
- ✅ 解析 JSON 请求体
- ✅ 解析 URL 编码请求体
- ✅ 拒绝无效 JSON

**Request ID 中间件** (2 个测试)
- ✅ 生成唯一的 Request ID
- ✅ 保留客户端提供的 Request ID

**错误处理集成** (2 个测试)
- ✅ 错误响应包含标准字段
- ✅ statusCode 与 HTTP 状态码一致

**Content-Type 头** (2 个测试)
- ✅ JSON 响应有正确的 Content-Type
- ✅ 错误响应也是 JSON 格式

**HTTP 方法支持** (5 个测试)
- ✅ 支持 GET/POST/PUT/DELETE/PATCH

**性能测试** (2 个测试)
- ✅ 健康检查快速响应 (<100ms)
- ✅ 处理并发请求 (10 个并发)

### 5. API 中间件测试 (errorHandler.test.ts) - 22 个测试 ⭐

错误处理中间件的单元测试,达到 100% 覆盖率:

**requestIdMiddleware** (3 个测试)
- ✅ 生成并附加新的 requestId
- ✅ 使用请求头中的 requestId
- ✅ 生成的 requestId 是 UUID 格式

**errorHandler** (7 个测试)
- ✅ 处理 ValidationError (返回 400)
- ✅ 处理 DatabaseError (返回 500)
- ✅ 处理普通 Error (返回 500)
- ✅ 没有 requestId 时使用 "unknown"
- ✅ 记录非操作错误
- ✅ 不记录操作错误为非操作错误
- ✅ 包含请求上下文信息

**notFoundHandler** (4 个测试)
- ✅ 返回 404 响应
- ✅ 包含请求方法和路径
- ✅ 没有 requestId 时使用 "unknown"
- ✅ 不调用 next()

**asyncHandler** (6 个测试)
- ✅ 正常执行异步函数
- ✅ 捕获异步函数中的错误
- ✅ 捕获 Promise rejection
- ✅ 支持同步返回值
- ✅ 传递所有参数
- ✅ 支持多次调用

**集成测试** (2 个测试)
- ✅ requestIdMiddleware 和 errorHandler 协同工作
- ✅ asyncHandler 和 errorHandler 协同工作

## 测试配置

### Jest 配置 (jest.config.js)

```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts',
  ],

  // ESM 模块路径映射
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // 覆盖率配置
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70,
    },
  },

  // 覆盖率报告格式
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // 测试设置文件
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
```

### 测试设置 (setup.ts)

```typescript
// 扩展测试超时
jest.setTimeout(10000);

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_STORAGE = 'bitable';
// ... 其他环境变量

// Mock console 输出
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// 全局清理
afterEach(() => {
  jest.clearAllMocks();
});
```

## 测试工具

### testUtils.ts

提供常用的测试辅助函数:

```typescript
// Mock Express 对象
createMockRequest(options)
createMockResponse()
createMockNext()

// 异步工具
sleep(ms)
waitFor(condition, timeout)
expectToThrow(fn, errorClass)

// 计时器工具
useFakeTimers()
useRealTimers()
advanceTimersByTime(ms)
runAllTimers()

// 数据生成
randomString(length)
randomNumber(min, max)
testUuid()
testDate(offset)
```

## 最佳实践

### 1. 测试文件组织

- 每个源文件对应一个测试文件
- 测试文件放在 `__tests__` 目录下
- 使用 `.test.ts` 后缀

### 2. 测试结构

```typescript
describe('模块名称', () => {
  // 设置和清理
  beforeEach(() => {
    // 测试前准备
  });

  afterEach(() => {
    // 测试后清理
  });

  describe('功能分组', () => {
    it('应该满足特定行为', () => {
      // 测试代码
    });
  });
});
```

### 3. 断言风格

使用清晰的断言描述:

```typescript
// ✅ 好的命名
it('应该在验证失败时抛出 ValidationError', () => {
  // ...
});

// ❌ 避免的命名
it('test validation', () => {
  // ...
});
```

### 4. Mock 使用

```typescript
// Mock 函数
const mockFn = jest.fn();
const mockFn = jest.fn().mockReturnValue(value);
const mockFn = jest.fn().mockResolvedValue(value);
const mockFn = jest.fn().mockRejectedValue(error);

// Mock 模块
jest.mock('../module', () => ({
  functionName: jest.fn(),
}));
```

### 5. 异步测试

```typescript
// 使用 async/await
it('应该处理异步操作', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});

// 测试错误
it('应该抛出错误', async () => {
  await expect(asyncFunction()).rejects.toThrow(ErrorClass);
});
```

## 测试覆盖率

### 查看覆盖率报告

运行测试后,打开 HTML 报告:

```bash
open coverage/lcov-report/index.html
```

### 覆盖率目标

- **核心模块**: ≥ 85%
  - 错误处理系统: ✅ 87.57%
  - 配置服务: ✅ 88.31%
  - 事件系统: ✅ 78.26%

- **整体目标**: ≥ 70%
  - 当前状态: 🔄 进行中
  - 下一步: API 路由集成测试

## 持续集成

### GitHub Actions 配置示例

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
```

## 故障排除

### 常见问题

#### 1. ESM 模块导入错误

```
Cannot use import statement outside a module
```

**解决方案**: 确保 package.json 中有 `"type": "module"`

#### 2. TypeScript 编译错误

```
Cannot find module or its corresponding type declarations
```

**解决方案**:
- 检查 `tsconfig.json` 中的 `paths` 配置
- 确保导入路径包含 `.js` 后缀

#### 3. 测试超时

```
Timeout - Async callback was not invoked within the 5000 ms timeout
```

**解决方案**:
- 增加测试超时时间: `jest.setTimeout(10000)`
- 确保异步操作正确完成

#### 4. Mock 不生效

**解决方案**:
- 确保 mock 在导入模块之前设置
- 使用 `jest.clearAllMocks()` 清理 mock 状态

## 未来计划

### 短期 (Phase 3 剩余)

- [ ] API 路由集成测试
- [ ] 服务层单元测试
- [ ] 数据层单元测试
- [ ] 达到 70% 整体覆盖率

### 中期

- [ ] E2E 测试 (使用 Playwright)
- [ ] 性能测试
- [ ] 负载测试
- [ ] CI/CD 集成

### 长期

- [ ] 视觉回归测试
- [ ] A/B 测试支持
- [ ] 测试数据工厂
- [ ] 测试报告看板

## 参考资料

- [Jest 官方文档](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [TypeScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

**最后更新**: 2024-12-18
**维护者**: Anita QA System Team
