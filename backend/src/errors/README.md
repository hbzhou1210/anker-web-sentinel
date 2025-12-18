# 错误处理系统文档

本文档描述了 Anita QA System 的统一错误处理系统。

## 概述

统一错误处理系统提供了:
- ✅ 类型安全的错误类体系
- ✅ 错误分类和严重程度标识
- ✅ 错误上下文和调试信息
- ✅ 错误恢复策略
- ✅ 统一的 API 错误响应格式
- ✅ 自动错误日志记录
- ✅ 重试机制

## 错误类体系

### 基础错误类

所有自定义错误都继承自 `BaseError`:

```typescript
import { BaseError, ErrorCategory, ErrorSeverity } from '../errors/index.js';

throw new BaseError('操作失败', {
  category: ErrorCategory.BUSINESS_LOGIC,
  severity: ErrorSeverity.MEDIUM,
  context: {
    operation: 'createUser',
    userId: '123',
  },
  recoveryStrategy: {
    retriable: true,
    maxRetries: 3,
  },
});
```

### 预定义错误类

系统提供了多种预定义错误类:

#### 验证错误

```typescript
import { ValidationError, RequiredFieldError, InvalidFormatError } from '../errors/index.js';

// 通用验证错误
throw new ValidationError('输入数据格式不正确');

// 必填字段缺失
throw new RequiredFieldError('email');

// 格式无效
throw new InvalidFormatError('phone', 'xxx-xxxx-xxxx');
```

#### 业务逻辑错误

```typescript
import { BusinessLogicError, ResourceConflictError, OperationNotAllowedError } from '../errors/index.js';

// 通用业务逻辑错误
throw new BusinessLogicError('订单已关闭,无法修改');

// 资源冲突
throw new ResourceConflictError('User', 'user_123');

// 操作不允许
throw new OperationNotAllowedError('deleteUser', '用户有未完成的订单');
```

#### 资源错误

```typescript
import { ResourceNotFoundError } from '../errors/index.js';

throw new ResourceNotFoundError('Task', taskId);
```

#### 外部服务错误

```typescript
import { ExternalServiceError, FeishuApiError } from '../errors/index.js';

// 通用外部服务错误
throw new ExternalServiceError('WeatherAPI', '服务不可用', { apiEndpoint: '/weather' });

// 飞书 API 错误
throw new FeishuApiError('获取用户信息失败', 99991402);
```

#### 数据库错误

```typescript
import { DatabaseError, DatabaseConnectionError } from '../errors/index.js';

// 通用数据库错误
throw new DatabaseError('查询失败', { query: 'SELECT * FROM users' });

// 数据库连接错误
throw new DatabaseConnectionError();
```

#### 网络错误

```typescript
import { NetworkError } from '../errors/index.js';

throw new NetworkError('连接超时', { url: 'https://api.example.com' });
```

#### 超时错误

```typescript
import { TimeoutError, BrowserTimeoutError } from '../errors/index.js';

// 通用超时错误
throw new TimeoutError('processData', 5000);

// 浏览器超时错误
throw new BrowserTimeoutError('https://example.com', 30000);
```

#### 配置错误

```typescript
import { ConfigValidationError } from '../errors/index.js';

throw new ConfigValidationError('FEISHU_APP_ID 未配置');
```

#### 认证/授权错误

```typescript
import { AuthenticationError, AuthorizationError } from '../errors/index.js';

// 认证错误
throw new AuthenticationError('令牌已过期');

// 授权错误
throw new AuthorizationError('deleteUser');
```

#### 内部错误

```typescript
import { InternalError } from '../errors/index.js';

throw new InternalError('未预期的错误', { code: 'UNEXPECTED_NULL' });
```

## 错误类别

系统定义了以下错误类别:

| 类别 | HTTP 状态码 | 说明 |
|------|------------|------|
| `VALIDATION` | 400 | 验证错误 - 用户输入或数据格式问题 |
| `BUSINESS_LOGIC` | 422 | 业务逻辑错误 - 违反业务规则 |
| `CONFIGURATION` | 500 | 配置错误 - 系统配置问题 |
| `EXTERNAL_SERVICE` | 502 | 外部服务错误 - 第三方 API 调用失败 |
| `DATABASE` | 500 | 数据库错误 - 数据持久化问题 |
| `NETWORK` | 503 | 网络错误 - 网络连接问题 |
| `RESOURCE` | 404 | 资源错误 - 资源不存在或无法访问 |
| `AUTHENTICATION` | 401 | 认证错误 |
| `AUTHORIZATION` | 403 | 授权错误 |
| `INTERNAL` | 500 | 内部错误 - 未预期的系统问题 |
| `TIMEOUT` | 408 | 超时错误 |
| `UNKNOWN` | 500 | 未知错误 |

## 错误严重程度

| 严重程度 | 说明 |
|---------|------|
| `LOW` | 可恢复的错误,不影响系统运行 |
| `MEDIUM` | 影响单个操作,但系统仍可正常运行 |
| `HIGH` | 影响关键功能,需要立即关注 |
| `CRITICAL` | 系统级故障,需要紧急处理 |

## 在路由中使用错误

### 使用 asyncHandler 包装器

推荐使用 `asyncHandler` 包装异步路由处理器,自动捕获错误:

```typescript
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ResourceNotFoundError } from '../../errors/index.js';

const router = Router();

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await userService.getUser(req.params.id);

  if (!user) {
    throw new ResourceNotFoundError('User', req.params.id);
  }

  res.json(user);
}));

export default router;
```

### 不使用包装器的方式

也可以手动传递错误给 `next`:

```typescript
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userService.getUser(req.params.id);

    if (!user) {
      throw new ResourceNotFoundError('User', req.params.id);
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});
```

## 错误响应格式

API 返回的错误响应统一格式如下:

```json
{
  "code": "RESOURCE_NOTFOUND",
  "message": "资源未找到: User [user_123]",
  "category": "RESOURCE",
  "statusCode": 404,
  "timestamp": "2024-01-20T10:30:00.000Z",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "recoveryActions": [
    "检查资源 ID 是否正确",
    "确认资源是否已被删除"
  ]
}
```

在开发/测试环境,还会包含详细信息:

```json
{
  "code": "RESOURCE_NOTFOUND",
  "message": "资源未找到: User [user_123]",
  "category": "RESOURCE",
  "statusCode": 404,
  "timestamp": "2024-01-20T10:30:00.000Z",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "details": "Error: 资源未找到: User [user_123]\n    at ...",
  "context": {
    "operation": "getUser",
    "resourceType": "User",
    "resourceId": "user_123"
  },
  "recoveryActions": [
    "检查资源 ID 是否正确",
    "确认资源是否已被删除"
  ]
}
```

## 错误工具函数

### normalizeError

将任意错误转换为 `BaseError`:

```typescript
import { normalizeError } from '../errors/index.js';

try {
  // 某些操作
} catch (error) {
  const baseError = normalizeError(error, {
    operation: 'processData',
    userId: '123',
  });
  throw baseError;
}
```

### logError

记录错误日志:

```typescript
import { logError } from '../errors/index.js';

try {
  // 某些操作
} catch (error) {
  logError(error, {
    operation: 'processPayment',
    userId: '123',
  });
}
```

### retryAsync

带重试机制的异步操作:

```typescript
import { retryAsync } from '../errors/index.js';

const result = await retryAsync(
  async () => {
    return await externalApi.fetchData();
  },
  {
    maxRetries: 3,
    retryDelay: 2000,
    exponentialBackoff: true,
    onRetry: (error, attempt) => {
      console.log(`重试第 ${attempt} 次,错误:`, error.message);
    },
  }
);
```

### wrapAsync

包装异步函数,自动捕获和规范化错误:

```typescript
import { wrapAsync } from '../errors/index.js';

const safeProcessData = wrapAsync(async (data: any) => {
  // 处理数据
  return processedData;
}, {
  operation: 'processData',
});

// 使用
try {
  const result = await safeProcessData(inputData);
} catch (error) {
  // error 已经是 BaseError 类型
}
```

## 最佳实践

### 1. 使用正确的错误类

根据错误场景选择合适的错误类:

```typescript
// ✅ 好 - 使用具体的错误类
throw new ResourceNotFoundError('Task', taskId);

// ❌ 不好 - 使用通用错误
throw new Error('Task not found');
```

### 2. 添加有用的上下文

```typescript
// ✅ 好 - 包含上下文信息
throw new DatabaseError('查询失败', {
  query: 'SELECT * FROM users WHERE id = ?',
  params: [userId],
  operation: 'getUserById',
});

// ❌ 不好 - 缺少上下文
throw new DatabaseError('查询失败');
```

### 3. 设置合理的恢复策略

```typescript
// ✅ 好 - 为临时错误启用重试
throw new ExternalServiceError('API', '服务暂时不可用', {
  apiEndpoint: '/data',
}, {
  retriable: true,
  maxRetries: 3,
  exponentialBackoff: true,
});

// ✅ 好 - 为永久错误禁用重试
throw new ValidationError('邮箱格式不正确', {
  retriable: false,
});
```

### 4. 在路由中使用 asyncHandler

```typescript
// ✅ 好 - 使用 asyncHandler
router.get('/data', asyncHandler(async (req, res) => {
  const data = await service.getData();
  res.json(data);
}));

// ❌ 不好 - 手动处理每个错误
router.get('/data', async (req, res) => {
  try {
    const data = await service.getData();
    res.json(data);
  } catch (error) {
    // 重复的错误处理代码
  }
});
```

### 5. 不要捕获和忽略错误

```typescript
// ✅ 好 - 记录或重新抛出错误
try {
  await service.doSomething();
} catch (error) {
  logError(error);
  throw error;
}

// ❌ 不好 - 吞掉错误
try {
  await service.doSomething();
} catch (error) {
  // 什么都不做
}
```

### 6. 使用错误链

```typescript
// ✅ 好 - 保留原始错误
try {
  await externalApi.call();
} catch (error) {
  throw new ExternalServiceError(
    'API',
    '调用失败',
    { endpoint: '/data' },
    error as Error // 作为 cause 传递
  );
}
```

## 错误处理中间件

系统提供了三个中间件:

### 1. requestIdMiddleware

为每个请求生成唯一的 requestId:

```typescript
app.use(requestIdMiddleware);
```

### 2. notFoundHandler

处理 404 未找到错误:

```typescript
// 应该在所有路由之后注册
app.use(notFoundHandler);
```

### 3. errorHandler

全局错误处理中间件:

```typescript
// 应该最后注册
app.use(errorHandler);
```

## 中间件注册顺序

在 `app.ts` 中按以下顺序注册:

```typescript
import { requestIdMiddleware, notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

// 1. RequestId 中间件(最先)
app.use(requestIdMiddleware);

// 2. 其他中间件(JSON, CORS, 日志等)
app.use(express.json());
app.use(cors());

// 3. 路由
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/tasks', tasksRouter);

// 4. 404 处理(所有路由之后)
app.use(notFoundHandler);

// 5. 错误处理(最后)
app.use(errorHandler);
```

## 测试错误处理

```typescript
import { ValidationError } from '../errors/index.js';

describe('UserService', () => {
  it('should throw ValidationError for invalid email', async () => {
    await expect(
      userService.createUser({ email: 'invalid' })
    ).rejects.toThrow(ValidationError);
  });

  it('should include correct error context', async () => {
    try {
      await userService.createUser({ email: 'invalid' });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).context.fieldName).toBe('email');
    }
  });
});
```

## 迁移指南

### 从旧错误代码迁移

**之前:**
```typescript
// 旧代码
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await taskService.getTask(req.params.id);
    if (!task) {
      res.status(404).json({
        error: 'Not Found',
        message: '任务不存在',
      });
      return;
    }
    res.json(task);
  } catch (error) {
    console.error('获取任务失败:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '获取任务失败',
    });
  }
});
```

**之后:**
```typescript
// 新代码
import { asyncHandler } from '../middleware/errorHandler.js';
import { ResourceNotFoundError } from '../../errors/index.js';

router.get('/tasks/:id', asyncHandler(async (req, res) => {
  const task = await taskService.getTask(req.params.id);

  if (!task) {
    throw new ResourceNotFoundError('Task', req.params.id);
  }

  res.json(task);
}));
```

**优势:**
- ✅ 更简洁的代码
- ✅ 统一的错误格式
- ✅ 自动错误日志
- ✅ 类型安全
- ✅ 自动 requestId 追踪

## 常见问题

### Q: 我应该在什么时候创建新的错误类?

A: 当现有错误类无法准确描述错误场景时。新错误类应该继承自 `BaseError` 或其子类。

### Q: 操作错误和程序错误有什么区别?

A:
- **操作错误** (`isOperational = true`): 可预期的业务错误,如验证失败、资源未找到等
- **程序错误** (`isOperational = false`): 代码 bug,如配置错误、未处理的异常等

### Q: 什么时候应该启用重试?

A: 对于临时性错误启用重试,如网络错误、外部服务暂时不可用等。对于永久性错误(如验证错误)不应重试。

### Q: 如何在生产环境隐藏敏感信息?

A: 错误处理中间件会根据 `NODE_ENV` 自动隐藏详细信息。生产环境只返回错误消息和恢复建议,不包含堆栈和上下文。

### Q: 如何追踪跨服务的错误?

A: 使用 `requestId`。每个请求都有唯一的 requestId,会在日志和错误响应中包含。
