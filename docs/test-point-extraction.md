# 测试点提取功能说明

## 功能概述

测试点提取功能可以从飞书需求文档中自动提取测试点,使用 Claude AI 进行智能分析,将非结构化的需求文档转换为结构化的测试用例。

## 功能特性

### 1. 智能提取
- ✅ 使用 Claude 3.5 Sonnet 模型进行文档分析
- ✅ 自动识别功能点、测试类型、优先级
- ✅ 生成详细的测试描述和预期结果

### 2. 数据管理
- ✅ 测试点数据持久化存储
- ✅ 支持测试点的增删改查
- ✅ 关联飞书文档记录

### 3. 用户界面
- ✅ 简洁的表单输入界面
- ✅ 实时提取进度显示
- ✅ 优雅的测试点卡片展示
- ✅ 按优先级分类显示

## 使用方法

### 1. 访问功能页面
- 在左侧菜单中点击 **工具管理 > 测试点提取**
- 或直接访问: http://localhost:5173/tools/test-points

### 2. 填写文档信息
- **飞书文档链接** (可选): 用于记录文档来源
- **文档标题** (可选): 帮助AI更好地理解上下文
- **文档内容** (必填): 从飞书文档复制粘贴需求文本

### 3. 提取测试点
- 点击 **开始提取** 按钮
- 等待 AI 分析完成(通常需要5-10秒)
- 查看右侧自动生成的测试点列表

### 4. 查看结果
每个测试点包含以下信息:
- 优先级标签(高/中/低)
- 测试分类标签
- 功能模块名称
- 详细测试描述
- 测试类型
- 前置条件
- 预期结果

## API 端点

### POST /api/v1/test-points/extract
从文档内容提取测试点

**请求体:**
```json
{
  "documentUrl": "https://example.feishu.cn/docx/xxxxx",  // 可选
  "title": "用户登录功能需求",  // 可选
  "content": "需求文档的文本内容..."  // 必填
}
```

**响应:**
```json
{
  "success": true,
  "message": "成功提取 5 个测试点",
  "data": {
    "documentId": "uuid",
    "testPoints": [...]
  }
}
```

### GET /api/v1/test-points
获取测试点列表

**查询参数:**
- `category`: 测试分类筛选
- `priority`: 优先级筛选 (high/medium/low)
- `status`: 状态筛选
- `limit`: 分页大小
- `offset`: 分页偏移

### GET /api/v1/test-points/stats/summary
获取测试点统计信息

**响应:**
```json
{
  "success": true,
  "data": {
    "byStatus": {
      "pending": 10,
      "approved": 5,
      "completed": 3
    },
    "total": 18
  }
}
```

### GET /api/v1/test-points/:id
获取单个测试点详情

### PATCH /api/v1/test-points/:id
更新测试点信息

### DELETE /api/v1/test-points/:id
删除测试点

## 数据库结构

### feishu_documents 表
存储飞书文档元数据
- `id`: UUID 主键
- `document_id`: 飞书文档ID
- `document_url`: 文档URL
- `title`: 文档标题
- `content`: 文档内容
- `imported_at`: 导入时间
- `last_synced_at`: 最后同步时间
- `metadata`: JSONB 扩展字段

### test_points 表
存储提取的测试点
- `id`: UUID 主键
- `feishu_document_id`: 关联的飞书文档ID (外键)
- `category`: 测试分类
- `feature`: 功能模块
- `description`: 测试描述
- `priority`: 优先级 (high/medium/low)
- `test_type`: 测试类型
- `preconditions`: 前置条件
- `expected_result`: 预期结果
- `test_data`: JSONB 测试数据
- `status`: 状态 (pending/approved/rejected/in_progress/completed)
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `metadata`: JSONB 扩展字段

## 技术架构

### 后端技术栈
- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL
- **AI SDK**: Anthropic Claude SDK
- **ORM**: 原生 SQL (通过 pg 驱动)

### 前端技术栈
- **Framework**: React 18 + TypeScript
- **Routing**: React Router v6
- **Styling**: CSS Modules
- **State**: React Hooks (useState)

### 关键服务

#### TestPointExtractionService
核心AI提取服务,负责:
1. 构建结构化的提示词
2. 调用 Claude API 进行文档分析
3. 解析和验证返回的JSON数据
4. 转换为标准的测试点实体

#### TestPointRepository
数据访问层,提供:
- CRUD 基础操作
- 批量创建测试点
- 按条件筛选查询
- 按状态统计

## 已知限制和注意事项

### 1. API密钥配置
⚠️ **重要**: 需要配置有效的 Anthropic API 密钥

在 `/backend/.env` 文件中配置:
```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

标准的 Anthropic API 密钥格式:
- 以 `sk-ant-` 开头
- 长度约为 100+ 字符
- 可在 https://console.anthropic.com/ 获取

### 2. 文档内容限制
- 建议单次提取的文档内容不超过 4000 字
- 过长的文档可能导致分析时间过长或超时
- 建议将大型文档拆分为多个小节分别提取

### 3. AI 分析质量
- 需求文档越清晰,提取的测试点越准确
- 结构化的需求描述效果最佳
- 可能需要人工审核和调整AI生成的结果

## 未来改进方向

### 1. 直接集成飞书API
- [ ] 通过飞书MCP工具直接获取文档内容
- [ ] 支持文档URL一键导入
- [ ] 自动同步文档更新

### 2. 测试点管理增强
- [ ] 测试点编辑界面
- [ ] 测试点审批流程
- [ ] 测试执行记录
- [ ] 导出为Excel/CSV

### 3. 协作功能
- [ ] 多人协作编辑
- [ ] 评论和讨论
- [ ] 版本历史记录

### 4. 智能推荐
- [ ] 基于历史数据的测试点推荐
- [ ] 测试覆盖率分析
- [ ] 风险评估

## 故障排查

### 问题: API返回401认证错误
**原因**: API密钥无效或未配置
**解决**: 检查 `.env` 文件中的 `ANTHROPIC_API_KEY` 配置

### 问题: 提取的测试点为空
**原因**:
1. 文档内容过于简单或不包含可测试的功能
2. AI解析失败

**解决**:
1. 确保文档包含明确的功能描述
2. 检查后端日志查看详细错误信息

### 问题: 数据库连接失败
**原因**: PostgreSQL服务未启动或配置错误
**解决**:
1. 检查 `DATABASE_URL` 配置
2. 确保 PostgreSQL 服务正在运行
3. 运行数据库迁移: `npm run migrate`

## 开发团队联系方式

如有问题或建议,请联系开发团队。
