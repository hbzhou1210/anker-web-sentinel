# MCP 集成指南 - 飞书文档自动化

本文档说明如何使用 MCP (Model Context Protocol) 工具实现飞书文档的自动获取和保存功能。

## 功能概述

anita-project 已经集成了完整的测试点提取和 Markdown 生成功能：

1. ✅ **AI 测试点提取**: 使用 Claude AI 从需求文档中自动提取测试点
2. ✅ **Markdown 思维导图生成**: 自动生成结构化的测试点文档
3. ✅ **飞书文档保存**: 使用 MCP 工具将 Markdown 保存到飞书
4. ⚠️ **飞书文档读取**: 需要通过 Claude Code 使用 MCP 工具

## 核心组件

### 1. FeishuService 服务类

位置: [backend/src/services/FeishuService.ts](../backend/src/services/FeishuService.ts)

主要功能:
- `extractDocumentId(url)`: 从飞书文档 URL 提取文档 ID
- `generateMindMapMarkdown(testPoints, title)`: 生成 Markdown 格式的测试点文档
- `saveMarkdownToFeishu(markdown, fileName)`: 保存 Markdown 到飞书（占位符实现）

### 2. TestPointExtractionService 服务类

位置: [backend/src/services/TestPointExtractionService.ts](../backend/src/services/TestPointExtractionService.ts)

主要功能:
- `extractTestPoints(content, title)`: 使用 Claude AI 从文档内容中提取测试点
- 支持直接 HTTP 请求到 AI Router，避免 SDK 兼容性问题

### 3. API 端点

#### POST /api/v1/test-points/extract-and-save

从需求文档提取测试点并生成 Markdown。

**请求体**:
```json
{
  "content": "需求文档内容\n\n1. 功能需求1\n2. 功能需求2",
  "documentUrl": "https://xxx.feishu.cn/docx/xxxxx" // 可选
}
```

**响应**:
```json
{
  "success": true,
  "message": "成功提取 24 个测试点并保存到飞书",
  "data": {
    "documentId": "uuid",
    "testPoints": [...],
    "feishuDocUrl": "https://feishu.cn/docx/placeholder_xxx",
    "testDocTitle": "测试点文档 - 20251203",
    "markdown": "# 测试点文档\n\n> 生成时间: 2025/12/03\n..."
  }
}
```

## 使用流程

### 方式一: 完整自动化（推荐）

使用 Claude Code 在项目中执行以下步骤：

#### 步骤 1: 提取测试点

```bash
curl -X POST http://localhost:3000/api/v1/test-points/extract-and-save \
  -H "Content-Type: application/json" \
  -d '{
    "content": "用户登录功能\n\n1. 支持邮箱登录\n2. 支持手机号登录\n3. 记住登录状态"
  }'
```

#### 步骤 2: 使用 Claude Code 保存到飞书

在 Claude Code 中运行:

```javascript
// 从 API 响应中获取 markdown 字段
const markdown = apiResponse.data.markdown;
const fileName = apiResponse.data.testDocTitle;

// 使用 MCP 工具保存到飞书
// Claude Code 会自动识别并调用 mcp__feishu__docx_builtin_import 工具
```

实际示例:
```bash
# 获取 markdown 内容
MARKDOWN=$(curl -s -X POST http://localhost:3000/api/v1/test-points/extract-and-save \
  -H "Content-Type: application/json" \
  -d '{"content": "测试内容"}' | jq -r '.data.markdown')

# 在 Claude Code 中，你可以直接请求:
# "请使用 MCP 工具 mcp__feishu__docx_builtin_import 将以下 Markdown 保存到飞书:
# ${MARKDOWN}"
```

### 方式二: 从飞书文档读取（需要 MCP）

⚠️ **注意**: 由于后端 Node.js 环境无法直接调用 MCP 工具，需要通过 Claude Code 完成。

#### 步骤 1: 使用 Claude Code 获取飞书文档内容

在 Claude Code 中请求:
```
请使用 MCP 工具 mcp__feishu__docx_v1_document_rawContent 获取文档 ID 为 Pu4Pdfs94ok38ZxXiQpcHLtbntf 的内容
```

Claude Code 会返回文档的纯文本内容。

#### 步骤 2: 将内容发送到后端 API

```bash
curl -X POST http://localhost:3000/api/v1/test-points/extract-and-save \
  -H "Content-Type: application/json" \
  -d '{
    "content": "从飞书获取的文档内容",
    "documentUrl": "https://anker-in.feishu.cn/docx/Pu4Pdfs94ok38ZxXiQpcHLtbntf"
  }'
```

#### 步骤 3: 保存生成的 Markdown 到飞书

使用响应中的 `markdown` 字段，在 Claude Code 中请求:
```
请使用 MCP 工具 mcp__feishu__docx_builtin_import 将以下 Markdown 保存到飞书，文件名为"测试点文档 - 20251203":
[粘贴 markdown 内容]
```

## MCP 工具参考

### mcp__feishu__docx_v1_document_rawContent

获取飞书文档的纯文本内容。

**参数**:
```json
{
  "path": {
    "document_id": "Pu4Pdfs94ok38ZxXiQpcHLtbntf"
  },
  "query": {
    "lang": 0  // 0=中文, 1=英文
  }
}
```

### mcp__feishu__docx_builtin_import

将 Markdown 内容导入为飞书文档。

**参数**:
```json
{
  "markdown": "# 文档标题\n\n内容...",
  "file_name": "文档名称"  // 可选
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "result": {
      "token": "KN89d0HwqoKr0ExDm5xckUGIngh",
      "type": "docx",
      "url": "https://anker-in.feishu.cn/docx/KN89d0HwqoKr0ExDm5xckUGIngh"
    }
  },
  "msg": "success"
}
```

## 示例: 完整工作流程

### 场景: 从需求文档生成测试点并保存到飞书

```bash
# 1. 调用 API 提取测试点
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/test-points/extract-and-save \
  -H "Content-Type: application/json" \
  -d '{
    "content": "用户注册功能\n\n1. 支持邮箱注册\n2. 支持手机号注册\n3. 密码强度验证\n4. 发送验证邮件"
  }')

# 2. 提取关键信息
MARKDOWN=$(echo $RESPONSE | jq -r '.data.markdown')
TITLE=$(echo $RESPONSE | jq -r '.data.testDocTitle')
TEST_COUNT=$(echo $RESPONSE | jq -r '.data.testPoints | length')

echo "成功提取 $TEST_COUNT 个测试点"
echo "文档标题: $TITLE"

# 3. 在 Claude Code 中保存到飞书
# 直接在 Claude Code 对话中说:
# "请使用 MCP 工具将以下 Markdown 保存到飞书，文件名为'$TITLE':
# $MARKDOWN"
```

### 实际测试结果

从测试可以看到：

1. ✅ API 成功提取了 24 个测试点
2. ✅ 生成了完整的 Markdown 文档（包含分类、优先级、测试数据等）
3. ✅ MCP 工具成功将文档保存到飞书
4. ✅ 返回了飞书文档 URL: https://anker-in.feishu.cn/docx/KN89d0HwqoKr0ExDm5xckUGIngh

## Markdown 文档格式

生成的 Markdown 文档包含以下结构：

```markdown
# 测试点文档标题

> 生成时间: 2025/12/03 10:40
> 测试点总数: 24

## 功能测试

### 邮箱注册

#### 1. 验证用户使用有效的邮箱地址和符合规则的密码能够成功注册

- **优先级**: 高 🔴
- **测试类型**: 正向测试
- **前置条件**: 邮箱未被注册过
- **预期结果**: 注册成功，系统提示注册成功信息
- **测试数据**:

\`\`\`json
{
  "email": "test@example.com",
  "password": "Test123456"
}
\`\`\`
```

按照以下层级组织：
1. **一级标题**: 文档标题
2. **二级标题**: 测试分类（功能测试、安全测试、性能测试等）
3. **三级标题**: 功能模块
4. **四级标题**: 具体测试点

每个测试点包含：
- 优先级（高🔴 / 中🟡 / 低🟢）
- 测试类型（正向测试、反向测试、边界测试等）
- 前置条件
- 预期结果
- 测试数据（JSON 格式）

## 技术实现细节

### 环境变量配置

在 `~/.zshrc` 中配置：

```bash
export ANTHROPIC_MODEL='claude-sonnet-4-5'
export ANTHROPIC_BEDROCK_BASE_URL='https://ai-router.anker-in.com/v1'
export ANTHROPIC_API_KEY='your-api-key'
```

### AI Router 配置

后端使用 AI Router 而不是 Anthropic SDK，以避免兼容性问题：

```typescript
const response = await fetch(`${baseURL}/messages`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  }),
});
```

## 限制和注意事项

1. **MCP 工具限制**:
   - ⚠️ MCP 工具只能在 Claude Code 环境中调用
   - ⚠️ Node.js 后端无法直接调用 MCP 工具
   - ✅ 解决方案：通过 Claude Code 作为中间层，获取飞书文档内容后发送给后端

2. **API 限制**:
   - 单次最多提取 4096 tokens 的内容
   - Claude AI 调用需要有效的 API key
   - AI Router 需要正确配置

3. **Markdown 格式**:
   - 生成的 Markdown 使用标准 GitHub Flavored Markdown
   - 飞书支持大部分 Markdown 语法
   - JSON 代码块会被正确渲染

## 故障排除

### 问题 1: API 返回 401 错误

**原因**: API key 未配置或已过期

**解决方案**:
```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY

# 更新 .zshrc
export ANTHROPIC_API_KEY='your-new-key'
source ~/.zshrc
```

### 问题 2: 生成的 Markdown 解析失败

**原因**: AI 返回的格式不是标准 JSON

**解决方案**:
- 代码已实现多种 JSON 提取策略
- 支持 ```json ... ``` 和 ``` ... ``` 格式
- 自动清理空白字符

### 问题 3: MCP 工具调用失败

**原因**: 不在 Claude Code 环境中

**解决方案**:
- 确保在 Claude Code 中运行
- 使用正确的 MCP 工具名称
- 检查参数格式是否正确

## 下一步计划

1. [ ] 实现前端界面，支持直接输入飞书文档 URL
2. [ ] 添加批量处理功能
3. [ ] 支持从飞书多维表格导入测试点
4. [ ] 实现测试点执行状态追踪
5. [ ] 添加测试报告生成功能

## 相关文档

- [Feishu API 文档](https://open.feishu.cn/document/home/index)
- [MCP 协议文档](https://modelcontextprotocol.io/)
- [Claude Code 使用指南](https://docs.anthropic.com/claude/docs/claude-code)
- [项目 MCP 使用示例](./mcp-usage-example.md)

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**最后更新**: 2025-12-03
**维护者**: anita-project team
