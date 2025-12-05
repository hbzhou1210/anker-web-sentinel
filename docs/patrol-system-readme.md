# 🔍 日常巡检系统

一个功能完整的自动化网页可用性检测系统,支持定时巡检、邮件报告和完整的管理界面。

## ✨ 核心功能

### 1. 灵活的任务配置
- 📋 支持配置多个 URL 进行批量检测
- 📧 支持多个邮箱接收报告
- ⚙️ 每个任务可独立启用/禁用
- 📝 详细的任务描述和命名

### 2. 智能的定时调度
- ⏰ 默认每天早上 9:00 和下午 6:00 执行
- 🔄 支持自定义 Cron 表达式
- 🌏 支持时区配置(默认 Asia/Shanghai)
- 🎯 精确的下次执行时间计算

### 3. 完善的执行记录
- 📊 详细的通过率统计
- ⚡ 每个 URL 的响应时间和状态码
- 📝 失败时的详细错误信息
- 📅 完整的历史记录查询

### 4. 精美的邮件报告
- 💌 HTML 格式的精美报告
- 📈 可视化的统计卡片
- 🎨 根据结果自动着色(成功/失败)
- 📋 详细的 URL 测试结果表格

## 🚀 快速开始

### 系统要求
- Node.js >= 18
- PostgreSQL >= 14
- SMTP 邮箱服务(可选,用于发送报告)

### 数据库初始化
```bash
# 运行迁移脚本
npm run migrate
```

这将创建以下表:
- `patrol_tasks` - 巡检任务
- `patrol_schedules` - 调度配置
- `patrol_executions` - 执行记录

并插入一个示例任务。

### 启动服务

```bash
# 启动后端和前端
npm run dev

# 仅启动后端
npm run dev:backend

# 仅启动前端
npm run dev:frontend
```

### 访问界面

- 前端: http://localhost:5173/tools/patrol
- 后端 API: http://localhost:3000/api/v1/patrol

## 📖 使用示例

### 1. 通过 API 创建任务

```bash
curl -X POST http://localhost:3000/api/v1/patrol/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "官网日常巡检",
    "description": "检查官网核心页面的可用性",
    "urls": [
      { "url": "https://www.example.com", "name": "首页" },
      { "url": "https://www.example.com/about", "name": "关于我们" }
    ],
    "notificationEmails": ["admin@example.com"],
    "enabled": true
  }'
```

### 2. 手动执行巡检

```bash
curl -X POST http://localhost:3000/api/v1/patrol/tasks/{taskId}/execute
```

### 3. 查看执行结果

```bash
curl http://localhost:3000/api/v1/patrol/executions?limit=10
```

### 4. 创建定时调度

```bash
curl -X POST http://localhost:3000/api/v1/patrol/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "patrolTaskId": "task-id",
    "cronExpression": "0 9,18 * * *",
    "scheduleType": "daily_twice",
    "timeZone": "Asia/Shanghai",
    "enabled": true
  }'
```

## 🎯 测试结果示例

执行完成后,你会得到如下的测试报告:

```json
{
  "status": "completed",
  "totalUrls": 3,
  "passedUrls": 2,
  "failedUrls": 1,
  "testResults": [
    {
      "name": "首页",
      "url": "https://www.anker.com",
      "status": "pass",
      "statusCode": 200,
      "responseTime": 17093
    },
    {
      "name": "产品页",
      "url": "https://www.anker.com/products",
      "status": "fail",
      "statusCode": 404,
      "errorMessage": "HTTP 404 - 页面访问失败"
    }
  ],
  "durationMs": 37887
}
```

## 📧 邮件配置

在 `.env` 文件中配置 SMTP 信息:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your-password
```

如果未配置,巡检仍会正常执行,但不会发送邮件。

## 📱 前端界面

前端提供了完整的管理界面:

### 任务列表
- 查看所有巡检任务
- 显示 URL 列表和通知邮箱
- 快速启用/禁用任务
- 一键手动执行

### 执行历史
- 实时显示执行状态
- 可视化的通过率统计
- 详细的测试结果
- 邮件发送状态

### 操作按钮
- ▶️ 立即执行
- ✅/⛔ 启用/禁用
- 📅 查看历史
- 🗑️ 删除任务

## 🔧 系统架构

```
前端 (React + TypeScript)
    ↓
RESTful API (Express)
    ↓
┌─────────────┬─────────────┬─────────────┐
│ PatrolService│ Scheduler   │ EmailService│
│ 执行测试     │ Cron调度    │ 发送报告    │
└─────────────┴─────────────┴─────────────┘
    ↓
PostgreSQL Database
```

## 📝 核心文件结构

```
backend/src/
├── services/
│   ├── PatrolService.ts           # 巡检执行服务
│   ├── PatrolSchedulerService.ts  # 定时调度服务
│   └── PatrolEmailService.ts      # 邮件报告服务
├── database/
│   ├── repositories/
│   │   ├── PatrolTaskRepository.ts
│   │   ├── PatrolScheduleRepository.ts
│   │   └── PatrolExecutionRepository.ts
│   └── migrations/
│       └── 011_create_patrol_system.sql
├── api/routes/
│   └── patrol.ts                  # 巡检 API 路由
└── models/
    └── entities.ts                # TypeScript 类型定义

frontend/src/
├── pages/
│   └── PatrolManagement.tsx       # 巡检管理页面
└── components/
    └── Sidebar/
        └── Sidebar.tsx            # 侧边栏(添加巡检菜单项)
```

## 🎨 技术栈

### 后端
- **Node.js + TypeScript** - 类型安全的服务器端开发
- **Express** - Web 框架
- **PostgreSQL** - 关系型数据库
- **Playwright** - 浏览器自动化测试
- **node-cron** - 任务调度
- **nodemailer** - 邮件发送

### 前端
- **React + TypeScript** - 用户界面
- **Tailwind CSS** - 样式框架
- **lucide-react** - 图标库

## 📊 数据库设计

### patrol_tasks (巡检任务)
- 任务名称、描述
- URL 列表 (JSONB)
- 通知邮箱数组
- 启用状态

### patrol_schedules (调度配置)
- Cron 表达式
- 时区设置
- 上次/下次执行时间
- 关联任务 ID

### patrol_executions (执行记录)
- 执行状态 (pending/running/completed/failed)
- 测试结果 (JSONB)
- 通过/失败统计
- 邮件发送状态
- 执行耗时

## 🔐 安全考虑

1. ✅ 邮件地址格式验证
2. ✅ 数据库参数化查询(防止 SQL 注入)
3. ✅ 环境变量存储敏感信息
4. ✅ 优雅的错误处理和日志记录

## 🐛 故障排查

### 调度器未启动
```bash
# 检查日志
grep "Patrol scheduler" backend-log.txt

# 确认数据库连接
psql -d web_automation_checker -c "\dt patrol*"
```

### 邮件未发送
```bash
# 检查环境变量
env | grep SMTP

# 查看邮件服务状态
grep "Email service" backend-log.txt
```

## 📈 监控和日志

系统会输出详细的日志:

```
✓ Patrol scheduler ready
⏰ Executing scheduled patrol task: task-id at 2025-12-04T09:00:00Z
✓ Scheduled patrol task completed: task-id
✓ 巡检报告已发送至 admin@example.com
```

## 🚧 待完善功能

- [ ] 前端创建任务表单
- [ ] 更多的检测类型(JS错误、性能指标)
- [ ] 告警阈值配置
- [ ] Webhook 通知支持
- [ ] 统计图表展示
- [ ] 批量导入 URL
- [ ] 趋势分析报表

## 📚 相关文档

- [详细使用指南](./patrol-system-guide.md)
- [API 文档](./api-documentation.md)
- [数据库架构](./database-schema.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📄 许可证

MIT License

---

**现在就开始使用日常巡检系统,让网站监控变得简单高效!** 🎉
