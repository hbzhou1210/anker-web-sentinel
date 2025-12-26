# Anker Web Sentinel - API 接口文档

## 📋 文档概述

本文档提供 Anker Web Sentinel 项目的完整 API 接口说明,适用于第三方集成和自动化调用。

**基础 URL**: `http://your-domain:port/api/v1`
**当前版本**: v1.0
**协议**: HTTP/HTTPS
**数据格式**: JSON

---

## 🔐 通用说明

### 请求格式

所有 POST/PUT 请求必须包含 Content-Type 头:

```http
Content-Type: application/json
```

### 响应格式

**成功响应**:
```json
{
  "success": true,
  "data": { ... }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "错误描述",
  "error": "详细错误信息"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 204 | 请求成功,无返回内容 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |

### 限流策略

| 限流级别 | 频率限制 | 适用场景 |
|---------|---------|---------|
| 严格限流 | 10 次/分钟 | 资源密集型操作 (执行测试、巡检) |
| 标准限流 | 20 次/分钟 | 普通 API 调用 |
| 创建限流 | 30 次/分钟 | 资源创建操作 |

---

## 📦 功能模块

- [1. 网页质量检测](#1-网页质量检测)
- [2. 报告查询](#2-报告查询)
- [3. 响应式测试](#3-响应式测试)
- [4. 定时巡检管理](#4-定时巡检管理)
- [5. 链接爬取工具](#5-链接爬取工具)
- [6. 多语言文案检查](#6-多语言文案检查)
- [7. 折扣规则查询](#7-折扣规则查询)
- [8. 飞书集成](#8-飞书集成)
- [9. 系统监控](#9-系统监控)
- [10. 图片代理](#10-图片代理)

---

## 1. 网页质量检测

### 1.1 创建测试任务

创建新的网页质量检测任务,包括 UI 功能测试和性能测试。

```http
POST /api/v1/tests
```

**请求体**:
```json
{
  "url": "https://www.example.com",
  "config": {
    "enableUITests": true,
    "enablePerformanceTests": true,
    "enableWebPageTest": false,
    "enableLighthouse": true
  },
  "notificationEmail": "user@example.com"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 要测试的网页 URL |
| config.enableUITests | boolean | 否 | 是否启用 UI 测试 (默认 true) |
| config.enablePerformanceTests | boolean | 否 | 是否启用性能测试 (默认 true) |
| config.enableWebPageTest | boolean | 否 | 是否启用 WebPageTest (默认 false) |
| config.enableLighthouse | boolean | 否 | 是否启用 Lighthouse (默认 true) |
| notificationEmail | string | 否 | 测试完成后发送邮件通知 |

**响应**:
```json
{
  "id": "test-uuid-123",
  "url": "https://www.example.com",
  "requestedAt": "2025-12-26T01:00:00.000Z",
  "status": "pending",
  "config": { ... }
}
```

**限流**: 10 次/分钟

**示例**:
```bash
curl -X POST http://localhost:3000/api/v1/tests \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example.com",
    "config": {
      "enableUITests": true,
      "enablePerformanceTests": true
    }
  }'
```

---

### 1.2 查询测试状态

查询测试任务的执行状态和结果。

```http
GET /api/v1/tests/:testId
```

**路径参数**:
| 参数 | 说明 |
|------|------|
| testId | 测试任务 ID |

**响应**:
```json
{
  "id": "test-uuid-123",
  "url": "https://www.example.com",
  "status": "completed",
  "requestedAt": "2025-12-26T01:00:00.000Z",
  "completedAt": "2025-12-26T01:02:30.000Z",
  "overallScore": 85,
  "totalChecks": 20,
  "passedChecks": 17,
  "failedChecks": 3,
  "uiTestResults": { ... },
  "performanceResults": { ... }
}
```

**状态值**:
- `pending`: 等待执行
- `running`: 执行中
- `completed`: 已完成
- `failed`: 失败

**示例**:
```bash
curl http://localhost:3000/api/v1/tests/test-uuid-123
```

---

### 1.3 获取测试报告

获取详细的测试报告内容。

```http
GET /api/v1/tests/:testId/report
```

**响应**: 包含完整测试结果的报告对象

---

## 2. 报告查询

### 2.1 获取报告详情

根据报告 ID 获取完整测试报告。

```http
GET /api/v1/reports/:reportId
```

**路径参数**:
| 参数 | 说明 |
|------|------|
| reportId | 报告 ID |

**响应**: 完整报告对象

**示例**:
```bash
curl http://localhost:3000/api/v1/reports/report-uuid-456
```

---

### 2.2 获取报告列表

获取最近的测试报告列表,支持分页和 URL 过滤。

```http
GET /api/v1/reports
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | number | 20 | 每页数量 |
| offset | number | 0 | 偏移量 |
| url | string | - | 按 URL 过滤 |

**响应**:
```json
{
  "reports": [
    {
      "id": "report-uuid-456",
      "url": "https://www.example.com",
      "createdAt": "2025-12-26T01:00:00.000Z",
      "overallScore": 85
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**示例**:
```bash
# 获取前 10 条报告
curl "http://localhost:3000/api/v1/reports?limit=10&offset=0"

# 按 URL 过滤
curl "http://localhost:3000/api/v1/reports?url=https://www.example.com"
```

---

## 3. 响应式测试

### 3.1 获取设备预设

获取可用的设备预设列表。

```http
GET /api/v1/responsive/devices
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "iPhone 13 Pro",
      "deviceType": "mobile",
      "viewportWidth": 390,
      "viewportHeight": 844,
      "enabled": true
    }
  ]
}
```

**示例**:
```bash
curl http://localhost:3000/api/v1/responsive/devices
```

---

### 3.2 按类型获取设备

获取指定类型的设备预设。

```http
GET /api/v1/responsive/devices/:type
```

**路径参数**:
| 参数 | 说明 | 可选值 |
|------|------|--------|
| type | 设备类型 | mobile, tablet, desktop |

**示例**:
```bash
curl http://localhost:3000/api/v1/responsive/devices/mobile
```

---

### 3.3 创建响应式测试任务

创建新的响应式测试任务(异步执行)。

```http
POST /api/v1/responsive/test
```

**请求体**:
```json
{
  "url": "https://www.example.com",
  "deviceIds": [1, 2, 3]
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 要测试的网页 URL |
| deviceIds | number[] | 否 | 设备 ID 列表,不传则测试所有启用的设备 |

**响应**:
```json
{
  "success": true,
  "data": {
    "taskId": "task-uuid-789",
    "message": "Responsive test task created",
    "deviceCount": 3,
    "estimatedTime": "30 seconds"
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/v1/responsive/test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example.com",
    "deviceIds": [1, 2, 3]
  }'
```

---

### 3.4 查询测试任务状态

查询异步测试任务的执行状态和结果。

```http
GET /api/v1/responsive/tasks/:taskId
```

**路径参数**:
| 参数 | 说明 |
|------|------|
| taskId | 任务 ID |

**响应**:
```json
{
  "success": true,
  "data": {
    "taskId": "task-uuid-789",
    "status": "completed",
    "progress": 100,
    "result": {
      "url": "https://www.example.com",
      "devices": [ ... ],
      "summary": {
        "totalDevices": 3,
        "passed": 2,
        "failed": 1
      }
    },
    "createdAt": "2025-12-26T01:00:00.000Z",
    "completedAt": "2025-12-26T01:00:30.000Z"
  }
}
```

**状态值**:
- `pending`: 等待执行
- `running`: 执行中
- `completed`: 已完成
- `failed`: 失败

**示例**:
```bash
curl http://localhost:3000/api/v1/responsive/tasks/task-uuid-789
```

---

### 3.5 获取测试结果

获取指定报告的响应式测试结果。

```http
GET /api/v1/responsive/results/:reportId
```

**示例**:
```bash
curl http://localhost:3000/api/v1/responsive/results/report-uuid-456
```

---

## 4. 定时巡检管理

### 4.1 任务管理

#### 4.1.1 创建巡检任务

```http
POST /api/v1/patrol/tasks
```

**请求体**:
```json
{
  "name": "官网日常巡检",
  "description": "每日巡检官网主要页面",
  "urls": [
    "https://www.example.com",
    "https://www.example.com/products"
  ],
  "notificationEmails": ["admin@example.com"],
  "config": {
    "enableUITests": true,
    "enablePerformanceTests": true,
    "performanceThreshold": 70
  },
  "enabled": true
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 任务名称 |
| description | string | 否 | 任务描述 |
| urls | string[] | 是 | 要巡检的 URL 列表 |
| notificationEmails | string[] | 否 | 通知邮箱列表 |
| config | object | 否 | 测试配置 |
| enabled | boolean | 否 | 是否启用 (默认 true) |

**响应**: 创建的任务对象

**限流**: 30 次/分钟

**示例**:
```bash
curl -X POST http://localhost:3000/api/v1/patrol/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "官网日常巡检",
    "urls": ["https://www.example.com"],
    "notificationEmails": ["admin@example.com"],
    "enabled": true
  }'
```

---

#### 4.1.2 获取任务列表

```http
GET /api/v1/patrol/tasks
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| enabledOnly | boolean | 只返回启用的任务 |

**示例**:
```bash
# 获取所有任务
curl http://localhost:3000/api/v1/patrol/tasks

# 只获取启用的任务
curl "http://localhost:3000/api/v1/patrol/tasks?enabledOnly=true"
```

---

#### 4.1.3 获取任务详情

```http
GET /api/v1/patrol/tasks/:taskId
```

---

#### 4.1.4 更新任务

```http
PUT /api/v1/patrol/tasks/:taskId
```

**请求体**: 要更新的字段

**示例**:
```bash
curl -X PUT http://localhost:3000/api/v1/patrol/tasks/task-uuid-123 \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false,
    "description": "暂时禁用"
  }'
```

---

#### 4.1.5 删除任务

```http
DELETE /api/v1/patrol/tasks/:taskId
```

**响应**: 204 No Content

---

#### 4.1.6 手动执行任务

手动触发巡检任务执行。

```http
POST /api/v1/patrol/tasks/:taskId/execute
```

**响应**:
```json
{
  "message": "Patrol execution started",
  "taskId": "task-uuid-123",
  "executionId": "exec-uuid-456"
}
```

**限流**: 10 次/分钟

**示例**:
```bash
curl -X POST http://localhost:3000/api/v1/patrol/tasks/task-uuid-123/execute
```

---

### 4.2 调度配置管理

#### 4.2.1 创建调度配置

创建定时执行配置。

```http
POST /api/v1/patrol/schedules
```

**请求体**:
```json
{
  "patrolTaskId": "task-uuid-123",
  "cronExpression": "0 9 * * *",
  "scheduleType": "cron",
  "timeZone": "Asia/Shanghai",
  "enabled": true
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| patrolTaskId | string | 是 | 巡检任务 ID |
| cronExpression | string | 是 | Cron 表达式 |
| scheduleType | string | 是 | 调度类型 (固定为 "cron") |
| timeZone | string | 否 | 时区 (默认 Asia/Shanghai) |
| enabled | boolean | 否 | 是否启用 (默认 true) |

**Cron 表达式示例**:
- `0 9 * * *` - 每天上午 9:00
- `0 9,14 * * *` - 每天上午 9:00 和下午 14:00
- `0 */2 * * *` - 每 2 小时执行一次
- `0 9 * * 1-5` - 周一到周五上午 9:00

**示例**:
```bash
curl -X POST http://localhost:3000/api/v1/patrol/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "patrolTaskId": "task-uuid-123",
    "cronExpression": "0 9 * * *",
    "scheduleType": "cron",
    "enabled": true
  }'
```

---

#### 4.2.2 获取调度配置列表

```http
GET /api/v1/patrol/schedules
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| taskId | string | 按任务 ID 过滤 |

---

#### 4.2.3 更新调度配置

```http
PUT /api/v1/patrol/schedules/:scheduleId
```

---

#### 4.2.4 删除调度配置

```http
DELETE /api/v1/patrol/schedules/:scheduleId
```

---

### 4.3 执行记录查询

#### 4.3.1 获取执行历史

```http
GET /api/v1/patrol/executions
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| taskId | string | - | 按任务 ID 过滤 |
| limit | number | 10 | 返回数量 |

**示例**:
```bash
# 获取指定任务的执行历史
curl "http://localhost:3000/api/v1/patrol/executions?taskId=task-uuid-123&limit=20"
```

---

#### 4.3.2 获取执行详情

```http
GET /api/v1/patrol/executions/:executionId
```

**响应**: 包含每个 URL 的测试结果、总体统计等

---

### 4.4 调度器管理

#### 4.4.1 重新加载调度配置

手动重新加载所有调度配置,用于配置更新后立即生效。

```http
POST /api/v1/patrol/scheduler/reload
```

**响应**:
```json
{
  "success": true,
  "message": "Scheduler reloaded successfully"
}
```

---

#### 4.4.2 获取调度器状态

获取当前运行中的调度任务状态。

```http
GET /api/v1/patrol/scheduler/status
```

**响应**:
```json
{
  "success": true,
  "schedules": [
    {
      "scheduleId": "schedule-uuid-789",
      "patrolTaskId": "task-uuid-123",
      "taskName": "官网日常巡检",
      "cronExpression": "0 9 * * *",
      "nextExecution": "2025-12-27T09:00:00.000Z",
      "lastExecution": "2025-12-26T09:00:00.000Z",
      "enabled": true
    }
  ]
}
```

---

## 5. 链接爬取工具

### 5.1 创建爬取任务

创建新的链接爬取或 404 检查任务。

```http
POST /api/v1/link-crawler
```

**请求体 - 爬取模式**:
```json
{
  "mode": "crawl",
  "startUrl": "https://www.example.com",
  "maxDepth": 3,
  "domainFilter": "example.com"
}
```

**请求体 - 404 检查模式**:
```json
{
  "mode": "404check",
  "urls": [
    "https://www.example.com/page1",
    "https://www.example.com/page2"
  ]
}
```

**请求体 - CSV 模式**:
```json
{
  "mode": "csv",
  "urls": [
    "https://www.example.com/page1",
    "https://www.example.com/page2"
  ]
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| mode | string | 是 | 模式: crawl(爬取), 404check(检查), csv(批量) |
| startUrl | string | crawl 时必填 | 起始 URL |
| maxDepth | number | 否 | 最大爬取深度 (默认 3) |
| domainFilter | string | 否 | 域名过滤器 |
| urls | string[] | 404check/csv 时必填 | URL 列表 |

**响应**: 创建的任务对象,包含 taskId

**示例**:
```bash
# 爬取模式
curl -X POST http://localhost:3000/api/v1/link-crawler \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "crawl",
    "startUrl": "https://www.example.com",
    "maxDepth": 2
  }'

# 404 检查模式
curl -X POST http://localhost:3000/api/v1/link-crawler \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "404check",
    "urls": ["https://www.example.com/page1", "https://www.example.com/page2"]
  }'
```

---

### 5.2 获取任务列表

```http
GET /api/v1/link-crawler
```

**响应**: 所有爬取任务的数组

---

### 5.3 获取任务详情

```http
GET /api/v1/link-crawler/:taskId
```

**响应**: 任务详情,包含爬取的链接和统计信息

---

### 5.4 删除任务

```http
DELETE /api/v1/link-crawler/:taskId
```

---

### 5.5 取消任务

取消正在运行的爬取任务。

```http
POST /api/v1/link-crawler/:taskId/cancel
```

---

### 5.6 暂停任务

暂停正在运行的爬取任务。

```http
POST /api/v1/link-crawler/:taskId/pause
```

---

### 5.7 恢复任务

恢复已暂停的爬取任务。

```http
POST /api/v1/link-crawler/:taskId/resume
```

---

## 6. 多语言文案检查

### 6.1 获取支持的语言列表

获取所有支持的检查语言及其代码。

```http
GET /api/v1/multilingual/languages
```

**响应**:
```json
{
  "success": true,
  "data": {
    "languages": [
      {
        "code": "en-US",
        "name": "English (US)"
      },
      {
        "code": "de-DE",
        "name": "German (Germany)"
      },
      {
        "code": "fr-FR",
        "name": "French (France)"
      }
    ],
    "count": 25
  }
}
```

**示例**:
```bash
curl http://localhost:3000/api/v1/multilingual/languages
```

---

### 6.2 检查服务健康状态

检查 LanguageTool 服务是否正常运行。

```http
GET /api/v1/multilingual/health
```

**响应**:
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "service": "LanguageTool",
    "apiUrl": "http://localhost:8010/v2/check",
    "timestamp": "2025-12-26T01:00:00.000Z"
  }
}
```

**示例**:
```bash
curl http://localhost:3000/api/v1/multilingual/health
```

---

### 6.3 检查网页多语言内容

自动访问网页并检查多种语言版本的内容。

```http
POST /api/v1/multilingual/check
```

**请求体**:
```json
{
  "url": "https://www.example.com",
  "languages": ["english", "german", "french"],
  "notificationEmail": "user@example.com"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 要检查的网页 URL |
| languages | string[] | 是 | 要检查的语言列表 |
| notificationEmail | string | 否 | 邮件通知地址 |

**支持的语言**:
- `english` (en-US)
- `german` (de-DE)
- `french` (fr-FR)
- `spanish` (es-ES)
- `italian` (it-IT)
- `portuguese` (pt-PT)
- `dutch` (nl-NL)
- `chinese` (zh-CN)
- `japanese` (ja-JP)

**响应**:
```json
{
  "success": true,
  "data": {
    "url": "https://www.example.com",
    "timestamp": "2025-12-26T01:00:00.000Z",
    "languages": [
      {
        "language": "en-US",
        "languageName": "English (US)",
        "errors": [
          {
            "message": "Possible spelling mistake found.",
            "shortMessage": "Spelling mistake",
            "offset": 150,
            "length": 8,
            "context": {
              "text": "...surrounding text...",
              "offset": 150,
              "length": 8
            },
            "replacements": [
              { "value": "correct" }
            ],
            "rule": {
              "id": "MORFOLOGIK_RULE_EN_US",
              "description": "Possible spelling mistake",
              "category": {
                "id": "TYPOS",
                "name": "Possible Typo"
              }
            },
            "severity": "error"
          }
        ],
        "errorCount": 1,
        "warningCount": 0,
        "infoCount": 0,
        "textLength": 2450
      }
    ],
    "totalErrors": 1,
    "totalWarnings": 0,
    "summary": {
      "languagesChecked": 2,
      "totalIssues": 1,
      "criticalIssues": 1
    }
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/v1/multilingual/check \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example.com",
    "languages": ["english", "german", "french"]
  }'
```

---

### 6.4 检查文本内容

直接检查提供的文本内容。

```http
POST /api/v1/multilingual/check-text
```

**请求体**:
```json
{
  "text": "This is an exmaple text with som mistakes.",
  "language": "english"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 要检查的文本内容 |
| language | string | 是 | 语言名称或代码 |

**响应**:
```json
{
  "success": true,
  "data": {
    "language": "en-US",
    "errors": [
      {
        "message": "Possible spelling mistake found.",
        "shortMessage": "Spelling mistake",
        "offset": 11,
        "length": 7,
        "context": {
          "text": "This is an exmaple text with som mistakes.",
          "offset": 11,
          "length": 7
        },
        "replacements": [
          { "value": "example" },
          { "value": "examples" }
        ],
        "rule": {
          "id": "MORFOLOGIK_RULE_EN_US",
          "description": "Possible spelling mistake",
          "category": {
            "id": "TYPOS",
            "name": "Possible Typo"
          }
        },
        "severity": "error"
      }
    ],
    "errorCount": 2,
    "textLength": 43
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/v1/multilingual/check-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is an exmaple text with som mistakes.",
    "language": "english"
  }'
```

---

## 7. 折扣规则查询

### 7.1 查询折扣规则状态

查询指定折扣规则的状态。

```http
POST /api/v1/discount-rule/check
```

**请求体**:
```json
{
  "ruleIds": ["rule-123", "rule-456"],
  "shopDomain": "example-shop.myshopify.com"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleIds | string[] | 是 | 折扣规则 ID 列表 |
| shopDomain | string | 是 | 店铺域名 |

**响应**:
```json
{
  "success": true,
  "reportId": "report-uuid-789",
  "type": "multi",
  "summary": {
    "totalRules": 2,
    "activeRules": 1,
    "inactiveRules": 1
  },
  "detailUrl": "http://localhost:3000/discount-rule-output/report-uuid-789-details.html",
  "reportUrl": "http://localhost:3000/discount-rule-output/report-uuid-789.html"
}
```

**示例**:
```bash
curl -X POST http://localhost:3000/api/v1/discount-rule/check \
  -H "Content-Type: application/json" \
  -d '{
    "ruleIds": ["rule-123", "rule-456"],
    "shopDomain": "example-shop.myshopify.com"
  }'
```

---

### 7.2 查询店铺所有规则

查询店铺下所有买赠规则的状态。

```http
POST /api/v1/discount-rule/check-all
```

**请求体**:
```json
{
  "shopDomain": "example-shop.myshopify.com"
}
```

**响应**: 包含所有规则的检查结果和报告 URL

---

### 7.3 获取历史报告列表

从 Bitable 获取历史报告列表。

```http
GET /api/v1/discount-rule/reports
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | number | 20 | 每页数量 |
| offset | number | 0 | 偏移量 |
| shopDomain | string | - | 按店铺域名过滤 |
| type | string | - | 按类型过滤 (single/multi/all) |

**示例**:
```bash
curl "http://localhost:3000/api/v1/discount-rule/reports?limit=10&shopDomain=example-shop.myshopify.com"
```

---

### 7.4 获取报告详情

获取指定报告的详细信息。

```http
GET /api/v1/discount-rule/reports/:reportId
```

---

## 8. 飞书集成

### 8.1 获取飞书文档

从飞书获取文档内容。

```http
POST /api/v1/feishu/fetch-document
```

**请求体**:
```json
{
  "documentId": "doccnXXXXXXXXXXXXXXXXXXXXXXX"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "documentId": "doccnXXXXXXXXXXXXXXXXXXXXXXX",
    "content": "文档内容..."
  }
}
```

**前置条件**: 需要配置环境变量:
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`

---

## 9. 系统监控

### 9.1 获取队列状态

获取任务队列的状态信息。

```http
GET /api/v1/system/queue-status
```

**响应**:
```json
{
  "status": "ok",
  "data": {
    "stats": {
      "pending": 5,
      "running": 2,
      "completed": 100,
      "failed": 3
    },
    "queuedTasks": [
      {
        "id": "task-uuid-123",
        "type": "performance-test",
        "status": "pending",
        "priority": "normal"
      }
    ],
    "systemStatus": {
      "healthy": true,
      "activeBrowsers": 3,
      "memoryUsage": "45%"
    }
  },
  "timestamp": "2025-12-26T01:00:00.000Z"
}
```

---

### 9.2 系统健康检查

检查系统整体健康状态。

```http
GET /api/v1/system/health
```

**响应**:
```json
{
  "status": "ok",
  "uptime": 86400,
  "timestamp": "2025-12-26T01:00:00.000Z",
  "queue": {
    "pending": 5,
    "running": 2
  },
  "memory": {
    "used": 512,
    "total": 1024,
    "percentage": 50
  }
}
```

---

### 9.3 清空队列

清空低优先级任务队列。

```http
POST /api/v1/system/queue/clear
```

**响应**:
```json
{
  "status": "success",
  "message": "Queue cleared successfully",
  "timestamp": "2025-12-26T01:00:00.000Z"
}
```

---

### 9.4 浏览器池监控

#### 9.4.1 获取浏览器池统计

```http
GET /api/v1/monitor/browser-pool
```

**响应**:
```json
{
  "success": true,
  "data": {
    "totalBrowsers": 5,
    "activeBrowsers": 3,
    "idleBrowsers": 2,
    "metrics": { ... }
  },
  "timestamp": "2025-12-26T01:00:00.000Z"
}
```

---

#### 9.4.2 获取浏览器池详细统计

```http
GET /api/v1/monitor/browser-pool/detailed
```

---

#### 9.4.3 监控健康检查

```http
GET /api/v1/monitor/health
```

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 86400,
    "memory": {
      "heapUsed": 512,
      "heapTotal": 1024
    },
    "browserPool": {
      "totalBrowsers": 5,
      "activeBrowsers": 3
    }
  }
}
```

---

## 10. 图片代理

### 10.1 获取飞书图片

代理获取飞书图片,支持缓存。

```http
GET /api/v1/images/feishu/:imageKey
```

**路径参数**:
| 参数 | 说明 |
|------|------|
| imageKey | 飞书图片的 image_key |

**响应**: 图片二进制数据 (Content-Type: image/webp)

**缓存策略**: 1 年缓存 (Cache-Control: max-age=31536000)

**示例**:
```bash
curl http://localhost:3000/api/v1/images/feishu/img_v3_XXXXXXXX
```

---

## 11. 通用端点

### 11.1 获取版本信息

```http
GET /api/version
```

**响应**:
```json
{
  "git_commit": "8a51255",
  "build_date": "2025-12-26",
  "version": "1.0.0",
  "node_version": "v18.17.0",
  "uptime": 86400
}
```

---

### 11.2 应用健康检查

```http
GET /health
```

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-26T01:00:00.000Z"
}
```

---

## 📊 使用场景示例

### 场景 1: CI/CD 集成

在部署流程中自动检查网页质量:

```bash
#!/bin/bash

# 创建测试任务
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/tests \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://staging.example.com",
    "config": {
      "enableUITests": true,
      "enablePerformanceTests": true
    }
  }')

TEST_ID=$(echo $RESPONSE | jq -r '.id')

# 轮询测试状态
while true; do
  STATUS=$(curl -s http://localhost:3000/api/v1/tests/$TEST_ID | jq -r '.status')

  if [ "$STATUS" = "completed" ]; then
    SCORE=$(curl -s http://localhost:3000/api/v1/tests/$TEST_ID | jq -r '.overallScore')

    if [ "$SCORE" -lt 70 ]; then
      echo "质量检查失败: 分数 $SCORE < 70"
      exit 1
    fi

    echo "质量检查通过: 分数 $SCORE"
    break
  fi

  sleep 5
done
```

---

### 场景 2: 定期监控

使用巡检功能定期监控重要页面:

```javascript
// 1. 创建巡检任务
const createTask = await fetch('http://localhost:3000/api/v1/patrol/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '官网日常巡检',
    urls: [
      'https://www.example.com',
      'https://www.example.com/products',
      'https://www.example.com/about'
    ],
    notificationEmails: ['ops@example.com'],
    enabled: true
  })
});

const task = await createTask.json();

// 2. 配置定时执行 (每天上午 9 点和下午 2 点)
await fetch('http://localhost:3000/api/v1/patrol/schedules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patrolTaskId: task.id,
    cronExpression: '0 9,14 * * *',
    scheduleType: 'cron',
    enabled: true
  })
});
```

---

### 场景 3: 多语言内容检查

在发布前检查多语言内容质量:

```python
import requests

# 检查多语言内容
response = requests.post(
    'http://localhost:3000/api/v1/multilingual/check',
    json={
        'url': 'https://www.example.com/product/123',
        'languages': ['english', 'german', 'french', 'spanish']
    }
)

result = response.json()

# 检查是否有严重问题
if result['data']['summary']['criticalIssues'] > 0:
    print(f"发现 {result['data']['summary']['criticalIssues']} 个严重问题")

    for lang_result in result['data']['languages']:
        print(f"\n{lang_result['languageName']}:")
        for error in lang_result['errors']:
            if error['severity'] == 'error':
                print(f"  - {error['message']}")
                print(f"    上下文: {error['context']['text']}")
                print(f"    建议: {', '.join([r['value'] for r in error['replacements'][:3]])}")

    exit(1)  # 阻止发布

print("所有语言内容检查通过")
```

---

### 场景 4: 响应式测试自动化

测试网页在不同设备上的表现:

```javascript
// 1. 获取所有移动设备
const devicesRes = await fetch('http://localhost:3000/api/v1/responsive/devices/mobile');
const devices = await devicesRes.json();
const deviceIds = devices.data.map(d => d.id);

// 2. 创建测试任务
const testRes = await fetch('http://localhost:3000/api/v1/responsive/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://www.example.com',
    deviceIds: deviceIds
  })
});

const { taskId } = (await testRes.json()).data;

// 3. 轮询任务状态
let status = 'pending';
while (status !== 'completed') {
  await new Promise(resolve => setTimeout(resolve, 5000));

  const statusRes = await fetch(`http://localhost:3000/api/v1/responsive/tasks/${taskId}`);
  const taskStatus = await statusRes.json();

  status = taskStatus.data.status;
  console.log(`进度: ${taskStatus.data.progress}%`);

  if (status === 'completed') {
    const result = taskStatus.data.result;
    console.log(`测试完成: ${result.summary.passed}/${result.summary.totalDevices} 通过`);

    if (result.summary.failed > 0) {
      console.error('部分设备测试失败');
      exit(1);
    }
  }
}
```

---

## 🔧 最佳实践

### 1. 异步任务处理

对于长时间运行的任务(测试、巡检、爬取),使用轮询方式:

```javascript
async function pollTaskStatus(taskId, apiPath, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${apiPath}/${taskId}`);
    const data = await response.json();

    if (data.status === 'completed') {
      return data;
    }

    if (data.status === 'failed') {
      throw new Error('Task failed');
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error('Task timeout');
}
```

---

### 2. 错误处理

统一处理 API 错误:

```javascript
async function apiCall(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API 调用失败: ${url}`, error);
    throw error;
  }
}
```

---

### 3. 限流处理

实现简单的限流重试:

```javascript
async function apiCallWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall(url, options);
    } catch (error) {
      if (error.status === 429) {
        // 限流,等待后重试
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}
```

---

### 4. 批量操作

批量处理时控制并发数:

```javascript
async function batchProcess(items, processFunc, concurrency = 3) {
  const results = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(item => processFunc(item))
    );
    results.push(...batchResults);
  }

  return results;
}

// 使用示例
const urls = ['url1', 'url2', 'url3', /* ... */];
await batchProcess(urls, async (url) => {
  return await apiCall('http://localhost:3000/api/v1/tests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
}, 3);
```

---

## 📞 技术支持

如有问题或建议,请联系:

- **项目仓库**:
  - [GitHub](https://github.com/hbzhou1210/anker-web-sentinel)
  - [Coding](http://e.coding.anker-in.com/codingcorp/dtc_it/anker-web-sentinel)
- **文档**: 参见项目根目录的相关文档

---

## 📝 更新日志

### v1.0 (2025-12-26)
- ✅ 初始版本发布
- ✅ 11 个功能模块,60+ API 端点
- ✅ 完整的网页质量检测功能
- ✅ 响应式测试支持
- ✅ 定时巡检管理
- ✅ 多语言文案检查
- ✅ 链接爬取工具
- ✅ 系统监控和健康检查
