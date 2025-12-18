# 配置管理文档

本文档描述了 Anita QA System 的配置管理系统。

## 概述

配置管理系统提供了类型安全、集中化的配置访问接口,支持:
- ✅ 环境变量覆盖
- ✅ 默认值
- ✅ 配置验证
- ✅ TypeScript 类型安全

## 配置服务使用

### 导入配置服务

```typescript
import { configService } from '../config/index.js';
```

### 获取配置

```typescript
// 获取完整配置
const config = configService.getConfig();

// 获取特定配置部分
const appConfig = configService.getAppConfig();
const dbConfig = configService.getDatabaseConfig();
const feishuConfig = configService.getFeishuConfig();
const browserConfig = configService.getBrowserConfig();
const patrolConfig = configService.getPatrolConfig();
```

### 便捷方法

```typescript
// 检查存储类型
if (configService.useBitable()) {
  // 使用飞书多维表格
}

// 检查环境
if (configService.isProduction()) {
  // 生产环境逻辑
}
```

## 环境变量

### 应用配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `NODE_ENV` | string | `development` | 运行环境: development, production, test |
| `PORT` | number | `3000` | 服务端口 |
| `API_BASE_PATH` | string | `/api/v1` | API 基础路径 |

### 数据库配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `DATABASE_STORAGE` | string | `bitable` | 存储类型: postgresql, bitable |
| `DATABASE_URL` | string | - | PostgreSQL 连接字符串(使用 PostgreSQL 时必需) |

### 飞书配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `FEISHU_APP_ID` | string | - | 飞书应用 ID(使用 Bitable 时必需) |
| `FEISHU_APP_SECRET` | string | - | 飞书应用密钥(使用 Bitable 时必需) |
| `FEISHU_BITABLE_APP_TOKEN` | string | `X66Mb4mPRagcrSsBlRQcNrHQnKh` | 多维表格 App Token |
| `FEISHU_TABLE_*` | string | 见下方 | 数据表 ID |

飞书数据表 ID:
- `FEISHU_TABLE_TEST_REPORTS`: 测试报告表
- `FEISHU_TABLE_RESPONSIVE_RESULTS`: 响应式测试结果表
- `FEISHU_TABLE_DEVICE_PRESETS`: 设备预设表
- `FEISHU_TABLE_PATROL_TASKS`: 巡检任务表
- `FEISHU_TABLE_PATROL_SCHEDULES`: 巡检调度表
- `FEISHU_TABLE_PATROL_EXECUTIONS`: 巡检执行记录表

### 浏览器配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `MAX_BROWSERS` | number | `3` | 浏览器池最大数量 |
| `BROWSER_IDLE_TIMEOUT_MS` | number | `60000` | 浏览器空闲超时(毫秒) |
| `BROWSER_HEADLESS` | boolean | `true` | 是否使用无头模式 |
| `BROWSER_LAUNCH_TIMEOUT_MS` | number | `30000` | 浏览器启动超时(毫秒) |

### Redis 配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `REDIS_HOST` | string | `localhost` | Redis 主机 |
| `REDIS_PORT` | number | `6379` | Redis 端口 |
| `REDIS_PASSWORD` | string | - | Redis 密码(可选) |
| `REDIS_DB` | number | `0` | Redis 数据库编号 |
| `REDIS_TLS` | boolean | `false` | 是否启用 TLS |

### 邮件配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `SMTP_HOST` | string | `smtp.example.com` | SMTP 主机 |
| `SMTP_PORT` | number | `587` | SMTP 端口 |
| `SMTP_USER` | string | - | SMTP 用户名 |
| `SMTP_PASSWORD` | string | - | SMTP 密码 |
| `EMAIL_FROM` | string | `noreply@example.com` | 发件人邮箱 |
| `EMAIL_FROM_NAME` | string | `Anita QA System` | 发件人名称 |
| `SMTP_USE_TLS` | boolean | `true` | 是否使用 TLS |

### 巡检配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `MAX_CONCURRENT_URLS` | number | `3` | 最大并发 URL 测试数量 |
| `PATROL_TIMEOUT_MS` | number | `120000` | 默认超时时间(毫秒) |
| `PATROL_RETRY_ENABLED` | boolean | `true` | 是否启用重试 |
| `PATROL_MAX_RETRY_ATTEMPTS` | number | `3` | 最大重试次数 |
| `PATROL_RETRY_DELAY_MS` | number | `2000` | 重试延迟(毫秒) |

### 截图配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `SCREENSHOT_STORAGE_PATH` | string | `/tmp/screenshots` | 截图存储路径 |
| `SCREENSHOT_QUALITY` | number | `80` | 截图质量(0-100) |
| `SCREENSHOT_UPLOAD_TO_FEISHU` | boolean | `true` | 是否上传到飞书 |

### 性能测试配置

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `WEBPAGETEST_API_KEY` | string | - | WebPageTest API Key(可选) |
| `WEBPAGETEST_API_URL` | string | `https://www.webpagetest.org` | WebPageTest API URL |

## 配置验证

配置服务在启动时会自动验证必需的配置项:

1. **Bitable 存储验证**: 当使用 Bitable 时,验证飞书配置
2. **PostgreSQL 存储验证**: 当使用 PostgreSQL 时,验证数据库 URL
3. **端口验证**: 验证端口号在有效范围内
4. **数值范围验证**: 验证各项数值配置在合理范围内

如果验证失败,应用将抛出 `ConfigValidationError` 并终止启动。

## 示例 .env 文件

```env
# 应用配置
NODE_ENV=production
PORT=3000

# 数据库配置
DATABASE_STORAGE=bitable

# 飞书配置
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_BITABLE_APP_TOKEN=X66Mb4mPRagcrSsBlRQcNrHQnKh

# 浏览器配置
MAX_BROWSERS=5
BROWSER_HEADLESS=true

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=qa-system@example.com

# 巡检配置
MAX_CONCURRENT_URLS=5
PATROL_TIMEOUT_MS=180000

# 截图配置
SCREENSHOT_QUALITY=90
SCREENSHOT_UPLOAD_TO_FEISHU=true
```

## 添加新配置

如果需要添加新的配置项:

1. 在 `types.ts` 中添加类型定义
2. 在 `ConfigService.ts` 的 `loadConfiguration()` 方法中添加加载逻辑
3. 在 `validateConfiguration()` 方法中添加验证逻辑(如需要)
4. 添加对应的 getter 方法(如需要)
5. 更新本文档

## 最佳实践

1. **避免直接使用 `process.env`**: 始终通过 `configService` 访问配置
2. **使用类型安全的方法**: 利用 TypeScript 类型检查
3. **提供合理的默认值**: 确保大多数场景下无需配置即可运行
4. **验证关键配置**: 在应用启动时验证必需的配置项
5. **文档同步**: 添加新配置时同步更新文档
