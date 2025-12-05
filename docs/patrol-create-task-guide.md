# 创建巡检任务使用指南

## 功能概述

现在你可以通过前端界面或API轻松创建巡检任务,支持以下特性:

### ✨ 主要功能

1. **默认巡检链接**: 系统预设了3个常用巡检链接:
   - https://www.anker.com (首页)
   - https://www.anker.com/products (产品页)
   - https://www.anker.com/about (关于我们)

2. **多邮箱支持**: 可以添加多个邮箱接收巡检报告
   - 支持动态添加/删除邮箱
   - 自动验证邮箱格式
   - 报告将发送到所有配置的邮箱

3. **灵活的URL配置**:
   - 可以使用默认链接
   - 可以添加/删除/修改检测URL
   - 每个URL可以设置友好名称

## 通过前端界面创建

### 步骤 1: 访问巡检管理页面

访问: http://localhost:5173/tools/patrol

### 步骤 2: 点击"创建巡检任务"按钮

点击页面右上角的蓝色按钮

### 步骤 3: 填写任务信息

#### 基本信息
- **任务名称** (必填): 例如 "官网日常巡检"
- **任务描述** (可选): 描述任务的目的和内容

#### 检测URL列表 (必填)

系统默认填充了3个链接,你可以:
- **修改默认链接**: 直接编辑名称和URL
- **添加新URL**: 点击"添加URL"按钮
- **删除URL**: 点击URL右侧的删除按钮
- **最少保留1个URL**

每个URL需要填写:
- **名称**: 例如 "首页"、"产品页"
- **URL**: 例如 "https://www.example.com"

#### 通知邮箱 (必填)

系统默认有一个空邮箱输入框,你可以:
- **添加邮箱**: 点击"添加邮箱"按钮
- **删除邮箱**: 点击邮箱右侧的删除按钮
- **最少保留1个邮箱**
- **邮箱格式**: 自动验证邮箱格式

示例邮箱:
- anita.zhou@anker.io
- team@example.com

#### 启用状态

勾选"创建后立即启用",任务将参与定时调度

### 步骤 4: 提交创建

点击"创建任务"按钮,完成创建

## 通过 API 创建

### 请求示例

```bash
curl -X POST 'http://localhost:3000/api/v1/patrol/tasks' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "测试巡检任务",
    "description": "用于测试的巡检任务",
    "urls": [
      {
        "url": "https://www.anker.com",
        "name": "Anker首页"
      },
      {
        "url": "https://www.anker.com/pages/about-us",
        "name": "关于我们"
      }
    ],
    "notificationEmails": [
      "anita.zhou@anker.io",
      "team@example.com"
    ],
    "enabled": true
  }'
```

### 请求参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 任务名称 |
| description | string | 否 | 任务描述 |
| urls | array | 是 | URL列表,至少1个 |
| urls[].url | string | 是 | 要检测的URL |
| urls[].name | string | 是 | URL的友好名称 |
| notificationEmails | array | 是 | 邮箱列表,至少1个 |
| enabled | boolean | 否 | 是否启用,默认true |

### 响应示例

```json
{
  "id": "bb117c47-2952-415c-8760-ffbf910a1c5f",
  "name": "测试巡检任务",
  "description": "用于测试的巡检任务",
  "urls": [
    {
      "url": "https://www.anker.com",
      "name": "Anker首页"
    },
    {
      "url": "https://www.anker.com/pages/about-us",
      "name": "关于我们"
    }
  ],
  "notificationEmails": [
    "anita.zhou@anker.io",
    "team@example.com"
  ],
  "enabled": true,
  "createdAt": "2025-12-05T02:18:42.174Z",
  "updatedAt": "2025-12-05T02:18:42.174Z"
}
```

## 创建后的自动操作

### 1. 自动创建调度配置

如果任务创建时设置了 `enabled: true`,你可以手动为其创建调度配置:

```bash
curl -X POST 'http://localhost:3000/api/v1/patrol/schedules' \
  -H 'Content-Type: application/json' \
  -d '{
    "patrolTaskId": "任务ID",
    "cronExpression": "0 9,18 * * *",
    "scheduleType": "daily_twice",
    "timeZone": "Asia/Shanghai",
    "enabled": true
  }'
```

### 2. 手动执行测试

创建任务后,可以立即手动执行测试:

```bash
curl -X POST 'http://localhost:3000/api/v1/patrol/tasks/{任务ID}/execute'
```

## 验证创建结果

### 查看所有任务

```bash
curl 'http://localhost:3000/api/v1/patrol/tasks'
```

### 查看特定任务

```bash
curl 'http://localhost:3000/api/v1/patrol/tasks/{任务ID}'
```

### 通过前端查看

访问 http://localhost:5173/tools/patrol 查看任务卡片

## 常见问题

### Q: 为什么创建任务时没有自动创建调度?

A: 目前需要手动为任务创建调度配置。你可以通过API创建调度,设置每天执行的时间。

### Q: 可以同时给多少个邮箱发送报告?

A: 理论上没有限制,但建议不超过10个邮箱,以确保邮件发送的及时性。

### Q: 创建任务后多久会执行?

A: 如果创建了调度配置,将按照cron表达式的时间执行。也可以随时通过"立即执行"按钮手动触发。

### Q: 默认的巡检链接可以修改吗?

A: 可以。默认链接只是预填充在表单中,你可以自由修改、删除或添加新的URL。

### Q: 邮箱格式验证规则是什么?

A: 基本格式为 `username@domain.com`,系统会自动验证邮箱格式的合法性。

## 示例场景

### 场景 1: 监控多个官网

```json
{
  "name": "Anker 全球官网巡检",
  "description": "监控Anker在不同地区的官网可用性",
  "urls": [
    {"url": "https://www.anker.com", "name": "美国站"},
    {"url": "https://www.anker.com.cn", "name": "中国站"},
    {"url": "https://www.anker-in.com", "name": "内部站"}
  ],
  "notificationEmails": [
    "anita.zhou@anker.io",
    "ops-team@anker.io"
  ]
}
```

### 场景 2: 监控核心页面

```json
{
  "name": "核心功能页面巡检",
  "description": "监控关键业务页面的可用性",
  "urls": [
    {"url": "https://www.example.com/login", "name": "登录页"},
    {"url": "https://www.example.com/dashboard", "name": "控制台"},
    {"url": "https://www.example.com/api/health", "name": "API健康检查"}
  ],
  "notificationEmails": [
    "dev-team@example.com",
    "qa-team@example.com",
    "ops-team@example.com"
  ]
}
```

### 场景 3: 测试环境监控

```json
{
  "name": "测试环境巡检",
  "description": "监控测试环境的稳定性",
  "urls": [
    {"url": "https://test.example.com", "name": "测试首页"},
    {"url": "https://staging.example.com", "name": "预发布环境"}
  ],
  "notificationEmails": [
    "qa-lead@example.com"
  ]
}
```

## 最佳实践

1. **任务命名**: 使用清晰、描述性的名称,例如"官网日常巡检"而不是"任务1"

2. **URL分组**: 将相关的URL放在同一个任务中,例如同一个网站的不同页面

3. **邮箱分组**: 根据团队或职责分配邮箱,确保相关人员都能收到通知

4. **描述完整**: 在描述中说明任务的目的、检查频率等信息

5. **定期审查**: 定期检查巡检任务,删除不再需要的任务,更新过时的URL

## 后续操作

创建任务后,你可以:

1. **配置调度**: 为任务创建定时调度
2. **手动执行**: 立即测试任务是否正常工作
3. **查看历史**: 查看执行历史和结果
4. **编辑任务**: 更新URL列表或邮箱配置
5. **启用/禁用**: 临时停止或恢复任务

---

**提示**: 所有创建的任务都会自动保存到数据库,并可以通过前端界面或API进行管理。
