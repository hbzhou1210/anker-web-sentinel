# 日常巡检系统使用指南

## 系统概述

日常巡检系统是一个自动化的网页可用性检测工具,可以定时检查指定网页的可用性并发送邮件报告。

## 主要功能

### 1. 巡检任务管理

- **创建任务**: 配置需要巡检的 URL 列表和通知邮箱
- **手动执行**: 随时手动触发巡检任务
- **查看历史**: 查看所有巡检执行记录和详细结果
- **启用/禁用**: 控制任务是否参与定时执行

### 2. 定时调度

- **每日两次执行**: 默认在每天早上 9:00 和下午 18:00 执行
- **自定义调度**: 支持自定义 cron 表达式
- **时区配置**: 支持设置时区(默认 Asia/Shanghai)

### 3. 邮件报告

- **自动发送**: 巡检完成后自动发送邮件报告
- **精美模板**: HTML 格式的报告,包含通过率、详细结果等
- **多收件人**: 支持配置多个通知邮箱

## API 接口

### 巡检任务 API

#### 创建任务
```bash
POST /api/v1/patrol/tasks
Content-Type: application/json

{
  "name": "官网巡检",
  "description": "检查官网核心页面",
  "urls": [
    { "url": "https://www.example.com", "name": "首页" },
    { "url": "https://www.example.com/about", "name": "关于我们" }
  ],
  "notificationEmails": ["admin@example.com"],
  "enabled": true
}
```

#### 获取任务列表
```bash
GET /api/v1/patrol/tasks
```

#### 手动执行任务
```bash
POST /api/v1/patrol/tasks/{taskId}/execute
```

#### 更新任务
```bash
PUT /api/v1/patrol/tasks/{taskId}
Content-Type: application/json

{
  "enabled": false
}
```

#### 删除任务
```bash
DELETE /api/v1/patrol/tasks/{taskId}
```

### 调度配置 API

#### 创建调度
```bash
POST /api/v1/patrol/schedules
Content-Type: application/json

{
  "patrolTaskId": "task-id",
  "cronExpression": "0 9,18 * * *",
  "scheduleType": "daily_twice",
  "timeZone": "Asia/Shanghai",
  "enabled": true
}
```

#### 获取调度列表
```bash
GET /api/v1/patrol/schedules
GET /api/v1/patrol/schedules?taskId={taskId}
```

#### 更新调度
```bash
PUT /api/v1/patrol/schedules/{scheduleId}
```

#### 删除调度
```bash
DELETE /api/v1/patrol/schedules/{scheduleId}
```

### 执行记录 API

#### 获取执行历史
```bash
GET /api/v1/patrol/executions
GET /api/v1/patrol/executions?taskId={taskId}&limit=10
```

#### 获取执行详情
```bash
GET /api/v1/patrol/executions/{executionId}
```

## 前端使用

访问 [http://localhost:5173/tools/patrol](http://localhost:5173/tools/patrol) 即可使用前端界面:

### 功能特性

1. **任务卡片**: 显示所有巡检任务,包括:
   - 任务名称和描述
   - 检测 URL 列表
   - 通知邮箱
   - 启用/禁用状态

2. **操作按钮**:
   - **立即执行**: 手动触发巡检
   - **启用/禁用**: 切换任务状态
   - **查看历史**: 查看该任务的执行记录
   - **删除**: 删除任务

3. **执行历史**: 显示最近的执行记录,包括:
   - 执行状态(成功/失败)
   - 通过率统计
   - 执行时间和耗时
   - 邮件发送状态

## 测试结果示例

```json
{
  "id": "9478de03-aabd-44af-848d-5020920dc792",
  "patrolTaskId": "0cc2fbd2-6ce0-4216-b4a2-98a9f6d3e75a",
  "status": "completed",
  "startedAt": "2025-12-04T11:24:49.278Z",
  "completedAt": "2025-12-04T11:25:27.164Z",
  "totalUrls": 3,
  "passedUrls": 2,
  "failedUrls": 1,
  "testResults": [
    {
      "url": "https://www.anker.com",
      "name": "首页",
      "status": "pass",
      "statusCode": 200,
      "responseTime": 17093,
      "testDuration": 19111
    },
    {
      "url": "https://www.anker.com/products",
      "name": "产品页",
      "status": "fail",
      "statusCode": 404,
      "errorMessage": "HTTP 404 - 页面访问失败",
      "responseTime": 10919,
      "testDuration": 10919
    },
    {
      "url": "https://www.anker.com/about",
      "name": "关于我们",
      "status": "pass",
      "statusCode": 200,
      "responseTime": 5644,
      "testDuration": 7654
    }
  ],
  "emailSent": false,
  "durationMs": 37887
}
```

## 环境变量配置

### 邮件服务配置

巡检系统需要配置 SMTP 邮件服务才能发送报告:

```env
# SMTP 服务器配置
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your-password
```

如果未配置邮件服务,巡检仍会正常执行,但不会发送邮件报告。

## 数据库表结构

### patrol_tasks (巡检任务表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 任务 ID |
| name | VARCHAR(255) | 任务名称 |
| description | TEXT | 任务描述 |
| urls | JSONB | URL 列表 |
| config | JSONB | 配置信息 |
| notification_emails | TEXT[] | 通知邮箱 |
| enabled | BOOLEAN | 是否启用 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### patrol_schedules (调度配置表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 调度 ID |
| patrol_task_id | UUID | 任务 ID |
| cron_expression | VARCHAR(100) | Cron 表达式 |
| schedule_type | VARCHAR(20) | 调度类型 |
| time_zone | VARCHAR(50) | 时区 |
| enabled | BOOLEAN | 是否启用 |
| last_execution_at | TIMESTAMP | 上次执行时间 |
| next_execution_at | TIMESTAMP | 下次执行时间 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### patrol_executions (执行记录表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 执行 ID |
| patrol_task_id | UUID | 任务 ID |
| status | VARCHAR(20) | 执行状态 |
| started_at | TIMESTAMP | 开始时间 |
| completed_at | TIMESTAMP | 完成时间 |
| total_urls | INTEGER | 总 URL 数 |
| passed_urls | INTEGER | 通过数 |
| failed_urls | INTEGER | 失败数 |
| test_results | JSONB | 测试结果 |
| email_sent | BOOLEAN | 邮件是否已发送 |
| email_sent_at | TIMESTAMP | 邮件发送时间 |
| error_message | TEXT | 错误信息 |
| duration_ms | INTEGER | 执行耗时(毫秒) |

## Cron 表达式说明

Cron 表达式格式: `分钟 小时 日 月 星期`

常用示例:
- `0 9 * * *` - 每天早上 9:00
- `0 9,18 * * *` - 每天 9:00 和 18:00
- `0 */2 * * *` - 每 2 小时
- `0 9 * * 1-5` - 工作日早上 9:00
- `0 0 1 * *` - 每月 1 号零点

## 注意事项

1. **网络超时**: 默认超时时间为 30 秒,如果网页响应慢可能会失败
2. **邮件配置**: 如果需要邮件报告,请确保正确配置 SMTP 环境变量
3. **数据库连接**: 确保数据库连接正常,否则调度器无法启动
4. **时区设置**: 默认使用 Asia/Shanghai 时区,可根据需要修改
5. **执行频率**: 不建议设置过于频繁的执行频率,以免对目标网站造成压力

## 故障排查

### 调度器未启动

检查日志中是否有 "✓ Patrol scheduler ready" 的输出。如果没有:

1. 检查数据库连接是否正常
2. 确认 patrol_schedules 表是否存在
3. 查看错误日志了解具体原因

### 邮件未发送

1. 检查 SMTP 环境变量是否配置正确
2. 查看日志中是否有 "✓ 邮件服务已初始化" 的输出
3. 确认网络能够访问 SMTP 服务器

### 执行失败

1. 检查目标 URL 是否可访问
2. 查看错误信息了解失败原因
3. 确认网络连接正常

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
│                  巡检任务管理界面                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    RESTful API (Express)                     │
│              /api/v1/patrol/tasks                            │
│              /api/v1/patrol/schedules                        │
│              /api/v1/patrol/executions                       │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ PatrolService│  │ PatrolScheduler│  │ PatrolEmail │
    │              │  │    Service     │  │   Service   │
    │ 执行巡检测试  │  │  Cron 定时调度  │  │  发送邮件报告 │
    └──────────────┘  └──────────────┘  └──────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │   数据库          │
                    │ - patrol_tasks   │
                    │ - patrol_schedules│
                    │ - patrol_executions│
                    └──────────────────┘
```

## 技术栈

- **后端**: Node.js + TypeScript + Express
- **前端**: React + TypeScript + Tailwind CSS
- **数据库**: PostgreSQL
- **浏览器自动化**: Playwright
- **任务调度**: node-cron
- **邮件发送**: nodemailer

## 未来改进计划

1. ✅ 完善前端创建任务表单
2. 支持更多的检测类型(不仅仅是页面可用性)
3. 添加告警阈值配置
4. 支持 Webhook 通知
5. 添加巡检报告统计图表
6. 支持批量导入 URL
7. 添加巡检结果趋势分析

## 版本历史

- **v1.0.0** (2025-12-04): 初始版本,完成基础功能
  - 巡检任务管理
  - 定时调度执行
  - 邮件报告发送
  - 前端管理界面
