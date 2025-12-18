# 买赠规则查询工具 - Bitable 存储迁移总结

**完成时间**: 2025-12-18
**Commit**: 00dc589

## 📋 需求背景

将买赠规则查询工具的测试结果从**文件系统 HTML 存储**迁移到**飞书多维表格(Bitable)**,实现结构化存储和更好的前端展示。

## ✅ 已完成的工作

### 1. 后端实现

#### 1.1 配置层
**文件**: `backend/src/config/feishu-bitable.config.ts`

添加了折扣规则报告表的配置:
```typescript
tables: {
  discountRuleReports: process.env.FEISHU_TABLE_DISCOUNT_REPORTS || ''
}

FIELD_MAPPINGS.discountRuleReports = {
  recordId: 'record_id',
  reportId: 'report_id',
  type: 'type',
  shopDomain: 'shop_domain',
  ruleIds: 'rule_ids',
  createdAt: 'created_at',
  summary: 'summary',
  detailResults: 'detail_results',
  status: 'status',
  htmlReportUrl: 'html_report_url'
}
```

#### 1.2 数据访问层

**新增接口**: `backend/src/models/interfaces/IDiscountReportRepository.ts`
- 定义 `DiscountReport` 实体
- 定义 `DiscountReportSummary` 摘要结构
- 定义 Repository 接口方法(CRUD)

**新增实现**: `backend/src/models/repositories/BitableDiscountReportRepository.ts`
- 实现完整的 CRUD 操作
- **智能压缩**: 大于 5KB 的数据自动 gzip 压缩
- **缓存集成**: 1小时 TTL 缓存
- **容错设计**: Bitable 保存失败不影响核心功能

核心特性:
```typescript
// 自动压缩
private readonly COMPRESS_THRESHOLD = 5000; // 5KB
private async compressIfNeeded(data: any): Promise<string>

// 缓存策略
private readonly CACHE_TTL = 3600; // 1小时
```

#### 1.3 API 层
**文件**: `backend/src/api/routes/discountRule.ts`

**修改的路由**:
1. `GET /api/v1/discount-rule/reports` - 从 Bitable 获取报告列表
   - 支持分页 (limit, offset)
   - 支持过滤 (shopDomain, type)
   - 按创建时间倒序排序

2. **新增** `GET /api/v1/discount-rule/reports/:reportId` - 获取报告详情
   - 返回完整的 detailResults
   - 支持缓存

3. 修改 `executeDiscountCheck` 函数
   - 保存结果到 Bitable
   - 仍然生成 HTML 报告(向后兼容)
   - 返回 reportId 和 detailUrl

**查询流程**:
```
用户提交查询
  ↓
调用工具模块(MCP)
  ↓
生成 HTML 报告(向后兼容)
  ↓
保存到 Bitable ← 新增
  ↓
返回 reportId + reportUrl
```

### 2. 前端实现

**文件**: `frontend/src/pages/DiscountRuleQuery.tsx`

#### 2.1 数据结构升级
```typescript
interface Report {
  reportId: string;        // 唯一标识
  type: 'single' | 'batch';
  shopDomain: string;      // 店铺信息
  ruleIds: number[];       // 规则列表
  createdAt: string;
  summary: {...};          // 详细摘要
  status: string;          // 总体状态
  url?: string;            // HTML链接(向后兼容)
}
```

#### 2.2 UI 增强

**报告列表卡片**显示:
- 🏪 店铺域名
- 🔢 规则 ID 列表
- ⏰ 创建时间
- ✓/✗ 状态徽章
- 📊 摘要统计(总数/正常/异常)

**详情模态框**:
- **单规则详情**: Variant 检查结果表格
  - Product / Variant
  - 状态
  - Metafield 值

- **批量查询详情**: 规则汇总表格
  - 规则 ID
  - 状态
  - Variant 统计

#### 2.3 新增功能
```typescript
// 详情查看
const viewReportDetail = async (report: Report) => {
  const response = await fetch(`/api/v1/discount-rule/reports/${report.reportId}`);
  // 显示模态框
}

// 模态框关闭
const closeDetailModal = () => {
  setSelectedReport(null);
}
```

### 3. 环境配置

**`.env.example`** 新增:
```bash
# 折扣规则查询报告表 ID
FEISHU_TABLE_DISCOUNT_REPORTS=
```

## 🎯 实现亮点

### 1. 数据压缩策略
```typescript
// 小数据: 直接存储 JSON 字符串
// 大数据: gzip 压缩 + base64 编码
const compressed = await gzip(Buffer.from(jsonStr, 'utf-8'));
return `gzip:${compressed.toString('base64')}`;
```

### 2. 缓存机制
```typescript
// 读取时先查缓存
const cached = await cacheService.get<DiscountReport>(cacheKey);
if (cached) return cached;

// 写入时更新缓存
await cacheService.set(cacheKey, report, this.CACHE_TTL);
```

### 3. 容错设计
```typescript
try {
  await discountReportRepo.create(discountReport);
} catch (error) {
  console.error('保存到 Bitable 失败:', error);
  // 不抛出错误,因为 HTML 已生成
  return report;
}
```

### 4. 向后兼容
- 继续生成 HTML 报告文件
- Bitable 中存储 `htmlReportUrl` 字段
- 前端支持查看旧的 HTML 报告

## 📊 数据结构设计

### Bitable 表结构
| 字段 | 类型 | 说明 |
|------|------|------|
| record_id | Text | Bitable 记录 ID (主键) |
| report_id | Text | 报告 ID (timestamp) |
| type | Select | single / batch |
| shop_domain | Text | 店铺域名 |
| rule_ids | Text | JSON 数组 "[1,2,3]" |
| created_at | DateTime | 创建时间 |
| summary | Text | JSON 格式摘要 |
| detail_results | Text | JSON 或压缩数据 |
| status | Select | active / inactive / error |
| html_report_url | URL | HTML 报告链接 |

### Summary 结构

**单规则**:
```json
{
  "ruleId": 12345,
  "status": "active",
  "totalVariants": 10,
  "activeVariants": 8,
  "inactiveVariants": 2,
  "errorVariants": 0
}
```

**批量查询**:
```json
{
  "totalRules": 5,
  "activeRules": 3,
  "inactiveRules": 2,
  "errorRules": 0
}
```

## 🧪 测试状态

- ✅ 后端 TypeScript 编译通过
- ✅ 前端 Vite 构建通过
- ⏳ 功能测试待配置 Bitable 表后进行

## 📝 部署步骤

### 1. 创建 Bitable 表

在飞书多维表格中创建新表,包含以下字段:

| 字段名称 | 字段类型 | 是否必填 | 说明 |
|---------|---------|---------|------|
| record_id | 单行文本 | ✓ | 自动生成 |
| report_id | 单行文本 | ✓ | 唯一标识 |
| type | 单选 | ✓ | single, batch |
| shop_domain | 单行文本 | ✓ | |
| rule_ids | 多行文本 | ✓ | JSON 数组 |
| created_at | 日期 | ✓ | |
| summary | 多行文本 | ✓ | JSON |
| detail_results | 多行文本 | ✓ | JSON 或压缩数据 |
| status | 单选 | ✓ | active, inactive, error |
| html_report_url | 网址 | | |

### 2. 配置环境变量

在 `.env` 文件中添加:
```bash
FEISHU_TABLE_DISCOUNT_REPORTS=tblXXXXXXXX
```

### 3. 部署代码

```bash
# 1. 拉取最新代码
git pull origin master

# 2. 构建项目
./scripts/deploy-production.sh

# 3. 重启服务
docker-compose restart
```

### 4. 验证功能

1. 访问买赠规则查询页面
2. 提交一个测试查询
3. 检查 Bitable 表是否有新记录
4. 点击"查看详情"验证详情显示
5. 检查 HTML 报告仍可访问

## 🔄 迁移策略

### 渐进式迁移
- **新报告**: 保存到 Bitable + 生成 HTML
- **旧报告**: 继续通过文件系统访问
- **前端**: 自动适配新旧数据格式

### 数据同步(可选)
如需将历史报告迁移到 Bitable:
```typescript
// 读取 output 目录的 HTML 文件
// 解析 HTML 提取数据
// 调用 discountReportRepo.create() 保存
```

## ⚠️ 注意事项

1. **Bitable 表 ID 必填**: 否则报告保存会失败(但不影响 HTML 生成)
2. **数据大小限制**: Bitable 单字段最大 10KB,已实现自动压缩
3. **性能优化**: 列表查询只返回摘要,详情按需加载
4. **缓存时间**: 报告数据缓存 1 小时,适合查询为主的场景
5. **向后兼容**: 保留 HTML 生成逻辑,确保功能不中断

## 📈 预期效果

### 用户体验提升
- ✅ 快速查看报告摘要(无需打开 HTML)
- ✅ 结构化展示,易于理解
- ✅ 支持过滤和搜索(通过 shopDomain, type)

### 数据管理改进
- ✅ 统一的数据存储
- ✅ 易于查询和分析
- ✅ 支持数据导出

### 性能优化
- ✅ 缓存机制减少数据库查询
- ✅ 数据压缩节省存储空间
- ✅ 按需加载详情数据

## 🚀 后续优化方向

1. **数据分析**: 基于 Bitable 数据生成统计报表
2. **自动清理**: 定期清理过期报告(超过30天)
3. **批量操作**: 支持批量删除/导出报告
4. **搜索增强**: 添加全文搜索功能
5. **通知集成**: 异常报告自动发送飞书通知

## 📚 相关文档

- [实现计划](/.claude/plans/cozy-kindling-cupcake.md)
- [Bitable API 文档](https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview)
- [部署指南](./DEPLOYMENT_GUIDE.md)

---

**总结**: 本次迁移成功将买赠规则查询结果从文件存储迁移到 Bitable,实现了结构化存储、更好的前端展示和数据管理能力,同时保持了向后兼容性和系统稳定性。
