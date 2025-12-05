# 飞书MCP集成方案

## 概述

本文档说明如何集成飞书MCP工具来实现:
1. 从飞书文档链接自动获取文档内容和标题
2. 将生成的测试点文档保存到飞书

## MCP工具说明

您的环境中已配置以下飞书MCP工具:

### 1. 获取文档内容
- **工具名称**: `mcp__feishu__docx_v1_document_rawContent`
- **功能**: 获取飞书文档的纯文本内容
- **输入**: `document_id` (文档ID)
- **输出**: 文档纯文本内容

### 2. 搜索文档
- **工具名称**: `mcp__feishu__docx_builtin_search`
- **功能**: 搜索飞书文档
- **输入**: `search_key` (搜索关键词)
- **输出**: 文档列表

### 3. 创建文档
- **工具名称**: `mcp__feishu__docx_builtin_import`
- **功能**: 创建新的飞书文档
- **输入**: `markdown` (Markdown内容), `file_name` (可选文件名)
- **输出**: 新文档的链接和ID

## 集成方案对比

### 方案A: 前端调用MCP (推荐) ✅

**优点**:
- 实现简单,无需额外服务
- 利用Claude Code环境的MCP工具
- 调试方便

**缺点**:
- 前端代码复杂度增加
- 需要处理异步调用链

**实现步骤**:
1. 用户在前端输入飞书文档链接
2. 前端提取document_id并调用MCP工具获取内容
3. 前端将文档内容和标题发送给后端API
4. 后端提取测试点并返回结果
5. 前端调用MCP工具创建新文档
6. 显示新文档链接给用户

### 方案B: MCP代理服务

**优点**:
- 前后端职责分离清晰
- 可以被其他服务复用
- 统一的错误处理

**缺点**:
- 需要额外的服务
- 增加部署复杂度
- MCP工具在代理服务中可能无法使用

## 选定方案: 方案A (前端调用MCP)

由于MCP工具只在Claude Code环境中可用,我们采用方案A。

## 实现细节

### 前端实现流程

```typescript
// 1. 用户输入飞书文档链接
const documentUrl = "https://feishu.cn/docx/xxxxx";

// 2. 提取document_id
const documentId = extractDocumentId(documentUrl);

// 3. 调用MCP工具获取文档内容(需要在Claude Code环境中执行)
// 这部分需要通过Claude Code的MCP工具来实现
// 因为浏览器环境无法直接调用MCP工具

// 4. 将内容发送给后端
const response = await fetch('/api/v1/test-points/extract-and-save', {
  method: 'POST',
  body: JSON.stringify({
    documentToken: documentId,
    documentTitle: "文档标题",
    documentContent: "文档内容...",
    documentUrl: documentUrl
  })
});

// 5. 获取测试点后,调用MCP创建新文档
const mindMapContent = "# 测试点\n\n...";
// 通过MCP工具创建飞书文档
// const newDocUrl = await createFeishuDocument(mindMapContent, "【测试点】...");

// 6. 显示新文档链接
console.log("新文档链接:", newDocUrl);
```

### MCP工具调用示例

#### 获取文档内容

```typescript
// 通过Claude Code的MCP工具调用
const result = await mcp__feishu__docx_v1_document_rawContent({
  path: {
    document_id: "doxcnXXXXXXXXXXX"
  },
  query: {
    lang: 0 // 0=中文, 1=英文
  }
});

// 返回结果包含文档的纯文本内容
console.log(result.content);
```

#### 创建新文档

```typescript
// 通过Claude Code的MCP工具调用
const result = await mcp__feishu__docx_builtin_import({
  markdown: "# 测试点文档\n\n## 功能测试\n\n...",
  file_name: "【测试点】用户登录功能 - 20251202"
});

// 返回结果包含新文档的URL
console.log("新文档链接:", result.url);
```

## 实现限制

### 当前限制
1. **MCP工具只在Claude Code环境可用**: 浏览器环境中的前端代码无法直接调用MCP工具
2. **需要手动集成**: 用户需要在Claude Code环境中手动调用MCP工具,或者通过Claude Code的扩展功能来实现

### 解决方案
由于MCP工具的限制,我们提供以下实现方式:

1. **临时方案**: 用户手动复制粘贴文档内容到前端表单
2. **未来增强**: 开发Chrome扩展或桌面应用来调用MCP工具

## API端点更新

### 新增端点: POST /api/v1/test-points/extract-from-feishu-with-mcp

此端点期望前端已经通过MCP获取了文档内容。

**请求体**:
```json
{
  "documentToken": "doxcnXXXXXXXX",
  "documentTitle": "用户登录功能需求",
  "documentContent": "文档的纯文本内容...",
  "documentUrl": "https://feishu.cn/docx/xxxxx"
}
```

**响应**:
```json
{
  "success": true,
  "message": "成功提取 15 个测试点",
  "data": {
    "documentId": "uuid",
    "testPoints": [...],
    "mindMapMarkdown": "# 测试点\n\n...",
    "testDocTitle": "【测试点】用户登录功能 - 20251202"
  }
}
```

前端收到响应后,可以再次调用MCP工具的`docx_builtin_import`来创建飞书文档。

## 测试步骤

### 手动测试MCP工具

1. **测试获取文档内容**:
   ```
   在Claude Code环境中执行:
   mcp__feishu__docx_v1_document_rawContent({
     path: { document_id: "你的文档ID" },
     query: { lang: 0 }
   })
   ```

2. **测试创建文档**:
   ```
   在Claude Code环境中执行:
   mcp__feishu__docx_builtin_import({
     markdown: "# 测试文档\n\n这是测试内容",
     file_name: "测试文档"
   })
   ```

### 集成测试

1. 用户提供飞书文档链接
2. Claude Code调用MCP获取内容
3. 发送到后端API提取测试点
4. 后端返回测试点和Markdown内容
5. Claude Code调用MCP创建新文档
6. 返回新文档链接给用户

## 未来改进

1. **开发Chrome扩展**: 在浏览器中直接调用MCP工具
2. **开发桌面应用**: 使用Electron封装,提供原生MCP调用能力
3. **飞书开放平台集成**: 直接使用飞书Open API,无需MCP工具
4. **批量处理**: 支持一次性处理多个文档

## 参考资料

- [飞书开放平台文档](https://open.feishu.cn/document/)
- [Claude MCP协议](https://modelcontextprotocol.io/)
- 项目MCP配置: `~/.zshrc`

## 联系方式

如有问题,请联系开发团队。
