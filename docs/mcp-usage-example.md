# 飞书MCP工具使用示例

本文档展示如何在Claude Code环境中使用飞书MCP工具来实现测试点提取的完整工作流程。

## 工作流程

### 1. 从飞书文档获取内容

假设用户提供了一个飞书文档链接:
```
https://example.feishu.cn/docx/Pu4Pdfs94ok38ZxXiQpcHLtbntf
```

**步骤 1.1**: 从URL提取document_id
```typescript
// 提取document_id: Pu4Pdfs94ok38ZxXiQpcHLtbntf
const documentId = "Pu4Pdfs94ok38ZxXiQpcHLtbntf";
```

**步骤 1.2**: 调用MCP工具获取文档内容
```typescript
// 使用MCP工具
const result = await mcp__feishu__docx_v1_document_rawContent({
  path: {
    document_id: documentId
  },
  query: {
    lang: 0  // 0=中文
  }
});

// result.content 包含文档的纯文本内容
const documentContent = result.content;
```

### 2. 发送到后端提取测试点

**步骤 2.1**: 调用后端API
```typescript
const response = await fetch('http://localhost:3000/api/v1/test-points/extract-and-save', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: documentContent,  // 从MCP获取的内容
    // documentUrl可选,用于记录
  }),
});

const result = await response.json();
// result.data.testPoints: 提取的测试点数组
// result.data.testDocTitle: 生成的测试文档标题
```

### 3. 生成思维导图Markdown

后端会自动生成思维导图格式的Markdown内容,格式如下:

```markdown
# 用户登录功能

## 功能测试

### 用户登录-手机验证码
- **测试描述**: 验证用户使用手机号+验证码能够成功登录
- **优先级**: 🔴 高
- **测试类型**: 正向测试
- **前置条件**: 用户已注册且手机号有效
- **预期结果**: 用户成功登录,跳转到首页

## 安全测试

### 登录失败限制
- **测试描述**: 验证登录失败5次后账户被锁定30分钟
- **优先级**: 🔴 高
- **测试类型**: 反向测试
- **前置条件**: 用户账号正常
- **预期结果**: 第5次失败后显示锁定提示,30分钟内无法登录
```

### 4. 保存测试文档到飞书

**步骤 4.1**: 生成Markdown内容
```typescript
// 从后端响应获取测试点
const testPoints = result.data.testPoints;
const documentTitle = "用户登录功能需求";

// 构建思维导图Markdown
let markdown = `# ${documentTitle}\n\n`;

// 按分类分组
const byCategory = {};
testPoints.forEach(point => {
  const category = point.category || '其他';
  if (!byCategory[category]) {
    byCategory[category] = [];
  }
  byCategory[category].push(point);
});

// 生成每个分类的内容
Object.entries(byCategory).forEach(([category, points]) => {
  markdown += `## ${category}\n\n`;

  points.forEach(point => {
    markdown += `### ${point.feature}\n\n`;
    markdown += `- **测试描述**: ${point.description}\n`;
    markdown += `- **优先级**: ${getPriorityEmoji(point.priority)}\n`;

    if (point.testType) {
      markdown += `- **测试类型**: ${point.testType}\n`;
    }

    if (point.preconditions) {
      markdown += `- **前置条件**: ${point.preconditions}\n`;
    }

    if (point.expectedResult) {
      markdown += `- **预期结果**: ${point.expectedResult}\n`;
    }

    markdown += '\n';
  });
});

function getPriorityEmoji(priority) {
  switch (priority) {
    case 'high': return '🔴 高';
    case 'medium': return '🟡 中';
    case 'low': return '🟢 低';
    default: return priority;
  }
}
```

**步骤 4.2**: 调用MCP创建飞书文档
```typescript
// 生成文档标题(带时间戳)
const now = new Date();
const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
const testDocTitle = `【测试点】${documentTitle} - ${dateStr}`;

// 使用MCP工具创建飞书文档
const createResult = await mcp__feishu__docx_builtin_import({
  markdown: markdown,
  file_name: testDocTitle
});

// createResult 包含新创建的文档URL
const feishuDocUrl = createResult.url;
console.log('测试点文档已保存到飞书:', feishuDocUrl);
```

## 完整流程示例

```typescript
async function extractAndSaveTestPoints(feishuDocUrl) {
  // 1. 从飞书URL提取document_id
  const documentId = feishuDocUrl.split('/').pop();

  // 2. 获取文档内容
  const docResult = await mcp__feishu__docx_v1_document_rawContent({
    path: { document_id: documentId },
    query: { lang: 0 }
  });

  const documentContent = docResult.content;

  // 3. 调用后端API提取测试点
  const response = await fetch('http://localhost:3000/api/v1/test-points/extract-and-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: documentContent })
  });

  const result = await response.json();
  const testPoints = result.data.testPoints;

  // 4. 生成思维导图Markdown
  const markdown = generateMindMapMarkdown(testPoints, "需求文档标题");

  // 5. 创建飞书文档
  const createResult = await mcp__feishu__docx_builtin_import({
    markdown: markdown,
    file_name: `【测试点】需求文档 - ${new Date().toISOString().split('T')[0].replace(/-/g, '')}`
  });

  console.log('✓ 测试点文档已保存:', createResult.url);
  return createResult.url;
}
```

## 前端集成方案

由于MCP工具只能在Claude Code环境中使用,不能在浏览器前端直接调用,我们有以下方案:

### 方案A: 用户手动操作(当前实现)
1. 用户手动从飞书复制文档内容
2. 粘贴到前端表单
3. 点击提取按钮
4. 后端返回测试点和Markdown
5. 前端显示结果(带placeholder URL)

### 方案B: Claude Code辅助(推荐)
1. 用户在Claude Code中提供飞书文档URL
2. Claude使用MCP工具获取文档内容
3. 调用后端API提取测试点
4. Claude使用MCP工具创建飞书文档
5. 返回真实的飞书文档链接给用户

### 方案C: Chrome扩展
1. 开发Chrome扩展,在飞书页面上添加"提取测试点"按钮
2. 扩展调用后端API(需要解决跨域问题)
3. 扩展使用飞书Open API创建文档

### 方案D: 桌面应用
1. 使用Electron开发桌面应用
2. 内置MCP客户端
3. 提供完整的图形界面

## 当前状态

- ✅ 后端API已完成
- ✅ 前端UI已完成
- ✅ 思维导图生成已完成
- ✅ MCP工具可用
- ⚠️ 需要在Claude Code环境中手动调用MCP工具
- ⚠️ 前端暂时显示placeholder URL

## 使用建议

当前推荐的使用方式:
1. 在前端手动粘贴文档内容进行测试
2. 或在Claude Code环境中使用上述完整流程脚本
3. 未来可以考虑开发Chrome扩展或桌面应用

## 相关文档

- [MCP集成方案](./mcp-integration-plan.md)
- [测试点提取功能V2](./test-point-extraction-v2.md)
- [实现总结](./implementation-summary.md)
