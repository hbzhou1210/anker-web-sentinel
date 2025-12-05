# 测试点提取功能 V2 - 优化版

## 更新日期
2025-12-02

## 功能优化说明

### 1. 表单优化
- ✅ **飞书文档链接优先**: 有链接时优先使用(自动获取功能开发中)
- ✅ **移除文档标题字段**: 系统自动从文档中提取或生成
- ✅ **文档内容改为选填**: 飞书链接和文档内容至少提供一个

### 2. 测试点文档生成
- ✅ **思维导图格式**: 生成层级化的Markdown格式
- ✅ **自动标题生成**: 格式为 `【测试点】{原文档标题} - {日期}`
- ✅ **按分类组织**: 测试点按category分组展示
- ✅ **保存到飞书**: 生成后自动创建飞书文档(MCP集成中)

### 3. 工作流程

```
用户输入
├── 飞书文档链接 (优先)
│   └→ 自动获取文档内容和标题
└── 或手动粘贴文档内容

        ↓

AI提取测试点
├── 使用Claude分析文档
├── 识别功能模块
├── 提取测试场景
└── 分配优先级

        ↓

生成思维导图文档
├── 按分类组织
├── 层级结构化展示
├── 包含完整测试信息
└── Markdown格式

        ↓

保存到飞书
├── 自动生成标题
├── 创建新文档
└── 返回文档链接
```

## API端点

### POST /api/v1/test-points/extract-and-save

**描述**: 从飞书文档提取测试点并保存为思维导图格式到飞书

**请求体**:
```json
{
  "documentUrl": "https://feishu.cn/docx/xxxxx",  // 可选,有则优先
  "content": "文档文本内容..."                      // 可选,无URL时必填
}
```

**响应**:
```json
{
  "success": true,
  "message": "成功提取 15 个测试点并保存到飞书",
  "data": {
    "documentId": "uuid",
    "testPoints": [...],
    "feishuDocUrl": "https://feishu.cn/docx/new_doc",
    "testDocTitle": "【测试点】用户登录功能 - 20251202"
  }
}
```

## 思维导图格式示例

```markdown
# 用户登录功能

## 功能测试

### 用户登录-手机验证码
- **测试描述**: 验证用户使用手机号+验证码能够成功登录
- **优先级**: 🔴 高
- **测试类型**: 正向测试
- **前置条件**: 用户已注册且手机号有效
- **预期结果**: 用户成功登录,跳转到首页

### 用户登录-邮箱密码
- **测试描述**: 验证用户使用邮箱+密码能够成功登录
- **优先级**: 🔴 高
- **测试类型**: 正向测试
- **前置条件**: 用户已注册且账号状态正常
- **预期结果**: 用户成功登录,显示用户信息

## 安全测试

### 登录失败限制
- **测试描述**: 验证登录失败5次后账户被锁定30分钟
- **优先级**: 🔴 高
- **测试类型**: 反向测试
- **前置条件**: 用户账号正常
- **预期结果**: 第5次失败后显示锁定提示,30分钟内无法登录

## 性能测试

### 登录日志记录
- **测试描述**: 验证登录成功后系统记录登录日志
- **优先级**: 🟡 中
- **测试类型**: 功能测试
- **前置条件**: 用户成功登录
- **预期结果**: 数据库中有对应的登录记录
```

## 数据库结构

### test_points 表字段
- `id`: UUID主键
- `feishu_document_id`: 关联的源文档ID
- `category`: 测试分类(功能测试、安全测试等)
- `feature`: 功能模块名称
- `description`: 测试点描述
- `priority`: 优先级(high/medium/low)
- `test_type`: 测试类型(正向/反向/边界等)
- `preconditions`: 前置条件
- `expected_result`: 预期结果
- `test_data`: JSONB测试数据
- `status`: 状态(pending/approved/in_progress/completed)
- `created_at`: 创建时间
- `updated_at`: 更新时间

## 当前状态

### ✅ 已完成
1. 前端表单优化(飞书链接优先,内容选填)
2. 后端API路由 `/extract-and-save`
3. 思维导图格式生成逻辑
4. 测试点数据库保存
5. 按分类分组和优先级标识
6. 自动生成带时间戳的标题
7. **Bedrock API配置**: 配置了Bedrock路由和模型
8. **修复reduce函数bug**: 思维导图分类分组现在正常工作

### 🚧 开发中
1. **飞书文档自动获取**: 通过MCP工具从飞书链接自动获取内容
2. **保存到飞书**: 使用MCP的`docx_builtin_import`创建飞书文档

### ⚠️ 注意事项

#### API密钥配置 ✅ 已解决
已配置Bedrock API路由:
- `ANTHROPIC_BEDROCK_BASE_URL=https://ai-router.anker-in.com/bedrock`
- `ANTHROPIC_API_KEY=sk-zMCehgSpMSrzgv_Th6i-hA`
- `ANTHROPIC_MODEL=global.anthropic.claude-sonnet-4-5-20250929-v1:0`

TestPointExtractionService已更新为使用Bedrock配置。

#### 飞书MCP集成
您的环境中已配置飞书MCP工具,但后端无法直接调用。有两种方案:

**方案A: 前端调用MCP**(推荐)
1. 前端通过Claude Code环境调用MCP工具
2. 获取文档内容后发送给后端
3. 后端处理并返回结果

**方案B: MCP代理服务**
1. 创建Node.js代理服务
2. 封装MCP工具调用
3. 后端通过HTTP调用代理

详见 [MCP集成方案文档](./mcp-integration-plan.md)

## 测试流程

### 手动测试步骤

1. **准备测试数据**
   - 选择一个飞书需求文档
   - 复制文档纯文本内容

2. **访问测试页面**
   ```
   http://localhost:5173/tools/test-points
   ```

3. **输入测试数据**
   - 方式1: 粘贴文档内容到文本框
   - 方式2: 输入飞书文档链接(自动获取功能开发中)

4. **点击提取按钮**
   - 等待AI分析(5-10秒)
   - 查看提取的测试点列表
   - 点击飞书文档链接查看生成的文档

### API测试

```bash
# 测试提取测试点
curl -X POST http://localhost:3000/api/v1/test-points/extract-and-save \
  -H "Content-Type: application/json" \
  -d '{
    "content": "用户登录功能需求\\n\\n1. 支持手机号+验证码登录\\n2. 支持邮箱+密码登录\\n3. 登录失败5次锁定30分钟"
  }'
```

## 下一步计划

1. **集成飞书MCP**
   - 实现通过文档链接自动获取内容
   - 实现自动创建飞书文档

2. **优化AI提示词**
   - 提高测试点提取准确率
   - 优化分类和优先级判断

3. **增强功能**
   - 支持批量提取多个文档
   - 测试点去重和合并
   - 导出为Excel/CSV格式
   - 测试执行记录和跟踪

4. **用户体验优化**
   - 添加提取进度显示
   - 支持在线编辑测试点
   - 测试点模板管理

## 技术架构

```
Frontend (React + TypeScript)
    ↓
Backend API (Express + TypeScript)
    ↓
┌─────────────┬──────────────┬─────────────┐
│             │              │             │
AI Service    Database    Feishu MCP
(Claude)      (PostgreSQL)  (文档操作)
```

## 相关文件

- 前端: [/frontend/src/pages/TestPointExtraction.tsx](../frontend/src/pages/TestPointExtraction.tsx)
- 后端路由: [/backend/src/api/routes/testPoints.ts](../backend/src/api/routes/testPoints.ts)
- AI服务: [/backend/src/services/TestPointExtractionService.ts](../backend/src/services/TestPointExtractionService.ts)
- 数据库: [/backend/src/models/repositories/TestPointRepository.ts](../backend/src/models/repositories/TestPointRepository.ts)
- 迁移文件: [/backend/src/database/migrations/009_create_test_points.sql](../backend/src/database/migrations/009_create_test_points.sql)

## 常见问题

### Q: 为什么API返回401错误?
A: ✅ 已解决 - 已配置Bedrock API路由和密钥。

### Q: 如何获取Anthropic API密钥?
A: 本项目使用Anker内部的Bedrock路由,无需单独申请Anthropic密钥。

### Q: 飞书文档链接自动获取什么时候可用?
A: 目前正在开发中,暂时请使用手动复制粘贴的方式。

### Q: 生成的测试点文档在哪里?
A: 提取完成后会显示飞书文档链接,点击即可查看。

### Q: 支持哪些文档格式?
A: 目前支持纯文本格式的需求文档,包括从飞书、Word、Notion等复制的文本。

## 联系方式

如有问题或建议,请联系开发团队。
