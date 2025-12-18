# Phase 4.2: 结构化日志 - 完成报告

## 📊 总体成果

**完成时间**: 2024-12-18
**状态**: ✅ **已完成**

## 🎯 实施内容

### 1. ✅ 安装日志依赖

安装了以下 npm 包:
- `winston` (v3.x) - 强大的日志库
- `winston-daily-rotate-file` (v5.x) - 日志文件自动轮转

```bash
npm install winston winston-daily-rotate-file
```

### 2. ✅ 创建 Winston Logger 配置

**文件**: [src/utils/logger.ts](src/utils/logger.ts) (约 250 行)

#### 核心功能

1. **多级别日志**
   - `error` - 错误信息
   - `warn` - 警告信息
   - `info` - 常规信息
   - `debug` - 调试信息

2. **多种输出格式**
   - **Console 输出**: 彩色格式,易于阅读(开发环境)
   - **文件输出**: JSON 格式,便于解析(生产环境)

3. **日志文件轮转**
   - `application-%DATE%.log` - 所有日志(保留 14 天)
   - `error-%DATE%.log` - 仅错误日志(保留 30 天)
   - `debug-%DATE%.log` - 调试日志(开发环境,保留 7 天)
   - `exceptions-%DATE%.log` - 未捕获异常
   - `rejections-%DATE%.log` - 未处理的 Promise 拒绝

4. **模块化子 Logger**
   ```typescript
   const logger = createModuleLogger('PatrolService');
   logger.info('Task started', { taskId: '123' });
   ```

5. **类型安全的增强 Logger**
   ```typescript
   const logger = createEnhancedLogger('MyModule');
   logger.info('Message', { key: 'value' });
   ```

6. **辅助格式化函数**
   - `formatHttpLog()` - HTTP 请求日志
   - `formatErrorLog()` - 错误日志
   - `formatPerformanceLog()` - 性能日志

#### 日志格式示例

**Console 输出 (开发环境)**:
```
2024-12-18 10:30:45 info [PatrolService] Starting patrol task execution
{
  "taskId": "123",
  "urls": 5
}
```

**文件输出 (JSON)**:
```json
{
  "timestamp": "2024-12-18T10:30:45.123Z",
  "level": "info",
  "message": "Starting patrol task execution",
  "service": "anita-qa-system",
  "environment": "production",
  "module": "PatrolService",
  "taskId": "123",
  "urls": 5
}
```

### 3. ✅ HTTP 请求日志中间件

**文件**: [src/api/middleware/loggingMiddleware.ts](src/api/middleware/loggingMiddleware.ts)

#### 功能特性

1. **loggingMiddleware** - 记录所有 HTTP 请求
   - 请求方法、URL、查询参数
   - 响应状态码
   - 请求处理时长
   - 客户端 IP 和 User-Agent
   - Request ID

2. **errorLoggingMiddleware** - 记录请求错误
   - 错误名称、消息、堆栈
   - 请求上下文信息

#### 智能日志级别

- `2xx` 响应 → `info` 级别
- `4xx` 响应 → `warn` 级别
- `5xx` 响应 → `error` 级别

#### 日志示例

```json
{
  "timestamp": "2024-12-18T10:30:45.123Z",
  "level": "info",
  "message": "GET /api/v1/patrol/tasks - 200",
  "module": "HttpRequest",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "http": {
    "method": "GET",
    "url": "/api/v1/patrol/tasks",
    "statusCode": 200,
    "duration": 45,
    "clientIp": "10.5.3.150",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### 4. ✅ 集成到 Express 应用

**文件**: [src/api/app.ts](src/api/app.ts)

#### 中间件顺序

```typescript
// 1. Request ID middleware
app.use(requestIdMiddleware);

// 2. Logging middleware (记录所有请求)
app.use(loggingMiddleware);

// 3. Metrics middleware
app.use(metricsMiddleware);

// 4. Body parsers
app.use(express.json());

// ... 路由 ...

// 5. 404 handler
app.use(notFoundHandler);

// 6. Error logging middleware (记录错误)
app.use(errorLoggingMiddleware);

// 7. Error handler
app.use(errorHandler);
```

#### 移除旧的 Console 日志

移除了旧的简单 `console.log` 日志中间件,替换为结构化的 Winston logger。

### 5. ✅ 日志目录结构

```
backend/
├── logs/
│   ├── application-2024-12-18.log    # 所有日志
│   ├── error-2024-12-18.log          # 错误日志
│   ├── debug-2024-12-18.log          # 调试日志(开发环境)
│   ├── exceptions-2024-12-18.log     # 未捕获异常
│   └── rejections-2024-12-18.log     # 未处理的拒绝
```

### 6. ✅ 环境配置

通过环境变量控制日志行为:

- `LOG_LEVEL` - 日志级别 (error, warn, info, debug)
- `NODE_ENV` - 环境 (development, production, test)
  - `test` - 不写文件日志
  - `development` - 额外输出 debug 日志文件
  - `production` - 仅 info 和 error 日志

## 📈 使用指南

### 1. 在服务中使用 Logger

#### 基本用法

```typescript
import { createModuleLogger } from '../utils/logger.js';

export class MyService {
  private logger = createModuleLogger('MyService');

  async doSomething(id: string): Promise<void> {
    this.logger.info('Starting operation', { id });

    try {
      // ... 业务逻辑 ...
      this.logger.debug('Operation step completed', { step: 1 });

      this.logger.info('Operation completed successfully', { id, duration: 100 });
    } catch (error) {
      this.logger.error('Operation failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
```

#### 使用增强型 Logger (类型安全)

```typescript
import { createEnhancedLogger, LogContext } from '../utils/logger.js';

const logger = createEnhancedLogger('MyModule');

// 类型安全的上下文
const context: LogContext = {
  userId: '123',
  action: 'login',
};

logger.info('User logged in', context);
```

#### 使用格式化辅助函数

```typescript
import { formatErrorLog, formatPerformanceLog } from '../utils/logger.js';

// 错误日志
try {
  await someOperation();
} catch (error) {
  logger.error('Operation failed', formatErrorLog(error, { userId: '123' }));
}

// 性能日志
const startTime = Date.now();
await someOperation();
const duration = Date.now() - startTime;

logger.info('Operation performance', formatPerformanceLog('someOperation', duration, {
  userId: '123',
}));
```

### 2. 查看日志

#### 查看实时日志 (开发环境)

```bash
# 启动应用
npm run dev

# 日志会实时输出到 console
# 2024-12-18 10:30:45 info [HttpRequest] GET /api/v1/patrol/tasks - 200
```

#### 查看文件日志 (生产环境)

```bash
# 查看所有日志
tail -f logs/application-$(date +%Y-%m-%d).log

# 查看错误日志
tail -f logs/error-$(date +%Y-%m-d).log

# 搜索特定请求
grep "requestId" logs/application-2024-12-18.log | jq .

# 统计错误数
grep -c '"level":"error"' logs/application-2024-12-18.log
```

### 3. 日志分析

#### 使用 jq 解析 JSON 日志

```bash
# 提取所有错误消息
cat logs/error-2024-12-18.log | jq '.message'

# 按模块统计日志
cat logs/application-2024-12-18.log | jq -r '.module' | sort | uniq -c

# 查找慢请求 (>1秒)
cat logs/application-2024-12-18.log | jq 'select(.http.duration > 1000)'

# 按状态码统计
cat logs/application-2024-12-18.log | jq -r '.http.statusCode' | sort | uniq -c
```

#### 使用 ELK Stack (Elasticsearch, Logstash, Kibana)

1. **Logstash 配置** (`logstash.conf`):

```ruby
input {
  file {
    path => "/path/to/logs/application-*.log"
    type => "application"
    codec => "json"
  }
}

filter {
  # 解析 JSON
  json {
    source => "message"
  }

  # 添加时间戳
  date {
    match => [ "timestamp", "ISO8601" ]
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "anita-logs-%{+YYYY.MM.dd}"
  }
}
```

2. **Kibana 查询示例**:
   - `module: "PatrolService" AND level: "error"`
   - `http.statusCode: >= 500`
   - `http.duration: > 1000`

## 🎁 交付成果

### 代码文件

1. **日志核心模块**
   - `src/utils/logger.ts` (250 行) - Winston logger 配置

2. **中间件**
   - `src/api/middleware/loggingMiddleware.ts` (95 行) - HTTP 请求日志

3. **应用集成**
   - `src/api/app.ts` - 集成日志中间件,移除旧 console.log

4. **日志目录**
   - `logs/` - 日志文件存储目录

### 文档

1. **本文档**
   - `PHASE4.2_LOGGING.md` - 完整的实施说明

## 💡 技术亮点

### 1. 结构化日志

- ✅ JSON 格式,便于机器解析
- ✅ 丰富的上下文信息
- ✅ 支持日志聚合工具 (ELK, Splunk)

### 2. 智能日志级别

- ✅ 根据 HTTP 状态码自动调整日志级别
- ✅ 开发/生产环境不同的日志策略
- ✅ 环境变量动态控制

### 3. 自动日志轮转

- ✅ 按日期分割日志文件
- ✅ 自动删除过期日志
- ✅ 大小限制 (20MB/文件)

### 4. 模块化设计

- ✅ 每个模块独立的 logger
- ✅ 类型安全的 Logger 接口
- ✅ 辅助格式化函数

### 5. 异常处理

- ✅ 自动捕获未处理的异常
- ✅ 自动捕获未处理的 Promise 拒绝
- ✅ 完整的错误堆栈

## 🔍 与 Phase 4.1 监控的集成

结构化日志与 Prometheus 监控形成互补:

| 维度 | 监控 (Phase 4.1) | 日志 (Phase 4.2) |
|------|------------------|------------------|
| **目的** | 实时指标、趋势分析 | 详细上下文、问题排查 |
| **数据类型** | 数值指标 (计数器、直方图) | 文本、结构化数据 |
| **查询方式** | PromQL、Grafana | grep, jq, ELK Stack |
| **保留时间** | 短期 (15-30天) | 长期 (30-90天) |
| **用途** | 告警、性能监控 | 调试、审计、合规 |

### 集成示例

当 Prometheus 告警触发时,通过 Request ID 在日志中查找详细信息:

```bash
# 1. Prometheus 告警: API 延迟 P95 > 1s
# 2. 查找慢请求的 requestId
cat logs/application-2024-12-18.log | jq 'select(.http.duration > 1000) | .requestId'

# 3. 根据 requestId 查找完整请求链
grep "a1b2c3d4-e5f6-7890" logs/application-2024-12-18.log | jq .
```

## 🔧 故障排除

### 问题 1: 日志目录不存在

**错误**: `ENOENT: no such file or directory, open 'logs/application-2024-12-18.log'`

**解决方案**:
```bash
mkdir -p backend/logs
```

### 问题 2: 权限不足

**错误**: `EACCES: permission denied, open 'logs/application-2024-12-18.log'`

**解决方案**:
```bash
chmod 755 backend/logs
```

### 问题 3: 日志文件过大

**问题**: 日志文件占用大量磁盘空间

**解决方案**:
1. 调整日志级别 (生产环境使用 `info` 而非 `debug`)
2. 减少保留天数
3. 启用压缩 (Winston 不直接支持,需要外部工具)

```typescript
// 调整保留天数
new DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  maxFiles: '7d', // 从 14d 改为 7d
})
```

### 问题 4: 日志不输出到文件

**问题**: Console 有日志,但文件为空

**原因**: 可能是测试环境(`NODE_ENV=test`)

**解决方案**: 检查环境变量
```bash
echo $NODE_ENV
# 如果是 test,改为 development 或 production
export NODE_ENV=development
```

## 📊 日志示例

### HTTP 请求日志

```json
{
  "timestamp": "2024-12-18T10:30:45.123Z",
  "level": "info",
  "message": "POST /api/v1/patrol/tasks/123/execute - 200",
  "service": "anita-qa-system",
  "environment": "production",
  "module": "HttpRequest",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "http": {
    "method": "POST",
    "url": "/api/v1/patrol/tasks/123/execute",
    "statusCode": 200,
    "duration": 1234,
    "query": {},
    "params": { "id": "123" },
    "clientIp": "10.5.3.150",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)..."
  }
}
```

### 错误日志

```json
{
  "timestamp": "2024-12-18T10:31:15.456Z",
  "level": "error",
  "message": "Request error: POST /api/v1/patrol/tasks/123/execute",
  "service": "anita-qa-system",
  "environment": "production",
  "module": "HttpRequest",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "error": {
    "name": "DatabaseError",
    "message": "Connection timeout",
    "stack": "DatabaseError: Connection timeout\n    at Connection.query (/app/dist/database.js:45:15)\n    ..."
  },
  "http": {
    "method": "POST",
    "url": "/api/v1/patrol/tasks/123/execute"
  }
}
```

## 🚀 下一步建议

### 短期改进

1. **在更多服务中集成 logger**
   - BrowserPool
   - CacheService
   - FeishuService
   - EmailService
   - PatrolSchedulerService

2. **添加性能日志**
   - 数据库查询耗时
   - 外部 API 调用耗时
   - 浏览器操作耗时

3. **日志采样**
   - 对高频日志进行采样,减少存储

### 中期目标

1. **日志聚合 (ELK Stack)**
   - Elasticsearch 存储
   - Logstash 收集和处理
   - Kibana 可视化和查询

2. **日志告警**
   - 错误率超过阈值
   - 特定错误类型
   - 慢请求超过阈值

3. **日志分析**
   - 用户行为分析
   - 性能瓶颈识别
   - 错误模式发现

### 长期目标

1. **分布式追踪集成**
   - OpenTelemetry
   - Jaeger/Zipkin
   - 日志与 trace 关联

2. **日志脱敏**
   - 自动识别和脱敏敏感信息
   - 符合 GDPR/隐私法规

3. **AI 日志分析**
   - 自动异常检测
   - 根因分析
   - 预测性告警

## ✨ 总结

Phase 4.2 成功实施了完整的结构化日志系统:

✅ **Winston Logger**: 强大的日志库,支持多种传输器
✅ **结构化格式**: JSON 日志,便于解析和分析
✅ **自动轮转**: 日志文件按日期分割,自动清理
✅ **HTTP 日志**: 自动记录所有 API 请求和响应
✅ **错误追踪**: 完整的错误堆栈和上下文信息
✅ **模块化设计**: 每个模块独立的 logger

这些日志能力为系统提供了:
- 🔍 **问题排查**: 详细的上下文信息帮助快速定位问题
- 📊 **审计合规**: 完整的操作记录
- 🔬 **性能分析**: 请求耗时、慢查询识别
- 🚨 **告警支持**: 配合监控系统实现智能告警

---

**完成日期**: 2024-12-18
**Phase 状态**: ✅ **已完成**
**下一步**: Phase 4.3 - Frontend Performance Optimization
