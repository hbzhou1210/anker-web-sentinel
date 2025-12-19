# Launch 生产环境部署指南

## 📋 买赠规则查询工具配置要求

### 1. 飞书多维表格配置

#### 1.1 创建 Bitable 表

在飞书多维表格中创建新表 `折扣规则查询报告`，包含以下字段：

| 字段名称 | 字段类型 | 是否必填 | 说明 | 示例值 |
|---------|---------|---------|------|--------|
| **record_id** | 单行文本 | ✓ | 记录唯一标识 | `rec_xxxxx` |
| **report_id** | 单行文本 | ✓ | 报告 UUID | `550e8400-e29b-41d4-a716-446655440000` |
| **type** | 单选 | ✓ | 查询类型 | `single` 或 `batch` |
| **shop_domain** | 单行文本 | ✓ | 店铺域名 | `anker.com` |
| **rule_ids** | 多行文本 | ✓ | 规则 ID 列表（JSON 数组） | `["12345", "67890"]` |
| **created_at** | 日期 | ✓ | 创建时间 | `2025-12-19 10:30:00` |
| **summary** | 多行文本 | ✓ | 汇总信息（JSON） | `{"totalRules": 2, ...}` |
| **detail_results** | 多行文本 | ✓ | 详细结果（JSON 或压缩数据） | `{...}` 或 `gzip:base64...` |
| **status** | 单选 | ✓ | 状态 | `active` / `inactive` / `error` |
| **html_report_url** | 网址 | | HTML 报告链接 | `https://...` |

#### 1.2 字段详细配置

**type 字段**（单选）：
- 选项 1：`single`（单规则查询）
- 选项 2：`batch`（批量查询）

**status 字段**（单选）：
- 选项 1：`active`（活跃）
- 选项 2：`inactive`（未激活）
- 选项 3：`error`（错误）

**created_at 字段**（日期）：
- 格式：`YYYY-MM-DD HH:mm:ss`
- 时区：使用服务器时区

**detail_results 字段**（多行文本）：
- 自动压缩：数据大于 5KB 时自动 gzip 压缩
- 格式：
  - 未压缩：直接 JSON 字符串
  - 已压缩：`gzip:base64编码数据`

---

### 2. 环境变量配置

在 Launch 平台的环境变量中添加：

```bash
# ========== 飞书多维表格配置 ==========
FEISHU_TABLE_DISCOUNT_REPORTS=tblXXXXXXXX  # 替换为实际的表 ID
```

**获取表 ID 方法**：
1. 打开飞书多维表格
2. 点击你创建的 `折扣规则查询报告` 表
3. 查看浏览器地址栏，URL 格式如：
   ```
   https://xxx.feishu.cn/base/bascXXXX?table=tblYYYYYYYY&view=vewZZZZ
   ```
4. 其中 `tblYYYYYYYY` 就是表 ID

---

### 3. 完整环境变量清单

以下是 Launch 部署必需的环境变量：

```bash
# ========== 数据存储配置 ==========
DATABASE_STORAGE=bitable

# ========== 应用配置 ==========
PORT=3000
NODE_ENV=production

# ========== 飞书开放平台配置 ==========
FEISHU_APP_ID=cli_xxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxx
FEISHU_BASE_URL=https://open.feishu.cn

# ========== Anthropic AI 配置 ==========
APP_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
APP_ANTHROPIC_BASE_URL=https://ai-router.anker-in.com/v1
APP_ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0

# ========== SMTP 邮件配置 ==========
SMTP_HOST=smtp.feishu.cn
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@anker.io
SMTP_PASSWORD=your_password
SMTP_FROM_NAME=Anita-Web-Sentinel
SMTP_FROM_EMAIL=your_email@anker.io

# ========== 前端 URL 配置 ==========
APP_URL=http://10.5.3.150:10038

# ========== MCP Server 配置（买赠规则查询工具）==========
MCP_SERVER_URL=http://beta-dtc-mcp.anker-in.com/mcp/tc_y7odih2ds
MCP_SERVER_TOKEN=mcpt_dc0f56690e00e98e7342e3ebf9c20f4a887a50c61eba20f0a888253495c47ec0

# ========== Redis 缓存配置 ==========
REDIS_URL=redis://localhost:6379
REDIS_CONNECT_TIMEOUT=5000
REDIS_ENABLED=true

# ========== 巡检任务并发配置 ==========
MAX_CONCURRENT_URLS=3

# ========== 飞书多维表格配置 ==========
FEISHU_TABLE_DISCOUNT_REPORTS=tblXXXXXXXX  # ⚠️ 必须配置

# ========== 浏览器池配置 ==========
BROWSER_POOL_SIZE=5
MIN_BROWSER_POOL_SIZE=3
MAX_BROWSER_POOL_SIZE=10
ACQUIRE_TIMEOUT=120000
SCALE_UP_THRESHOLD=3
SCALE_DOWN_THRESHOLD=60000
HEALTH_CHECK_INTERVAL=30000
MAX_BROWSER_AGE=1800000
MAX_BROWSER_USAGE=30
```

---

## 🚀 部署步骤

### 步骤 1: 创建飞书表格

1. 登录飞书
2. 打开多维表格应用
3. 创建新表 `折扣规则查询报告`
4. 按照上述"1.1 创建 Bitable 表"的字段配置创建字段
5. 复制表 ID（地址栏中的 `tblXXXXXXXX`）

### 步骤 2: 配置 Launch 环境变量

1. 登录 Launch 平台
2. 找到 `anker-web-sentinel` 应用
3. 进入"环境变量"配置页
4. 添加或更新 `FEISHU_TABLE_DISCOUNT_REPORTS=tblXXXXXXXX`
5. 保存配置

### 步骤 3: 部署代码

```bash
# 在本地
git push origin master

# Launch 会自动构建和部署
# 或手动触发部署
```

### 步骤 4: 验证部署

1. **访问应用**：
   ```
   http://10.5.3.150:10038
   ```

2. **测试买赠规则查询**：
   - 进入"买赠规则查询"页面
   - 选择店铺和规则类型
   - 提交查询

3. **检查 Bitable 表**：
   - 打开飞书多维表格
   - 查看 `折扣规则查询报告` 表
   - 确认有新记录生成

4. **查看报告详情**：
   - 在查询历史中点击"查看详情"
   - 确认能正常显示详细结果

---

## ⚠️ 注意事项

### 1. 必需配置

**必须配置的环境变量**：
- ✅ `FEISHU_APP_ID` - 飞书应用 ID
- ✅ `FEISHU_APP_SECRET` - 飞书应用密钥
- ✅ `FEISHU_TABLE_DISCOUNT_REPORTS` - 折扣规则报告表 ID
- ✅ `MCP_SERVER_URL` - MCP 服务器地址
- ✅ `MCP_SERVER_TOKEN` - MCP 服务器认证 Token

**如果未配置 `FEISHU_TABLE_DISCOUNT_REPORTS`**：
- ⚠️ 报告会保存失败，但不影响 HTML 生成
- ⚠️ 前端无法查看历史报告列表
- ⚠️ 控制台会输出警告日志

### 2. 数据压缩

系统会自动处理大数据：
- 数据 < 5KB：直接存储 JSON
- 数据 ≥ 5KB：自动 gzip 压缩后 base64 编码
- 读取时自动解压缩

### 3. 缓存策略

报告详情会缓存 1 小时：
- 首次访问：从 Bitable 读取
- 后续访问：从 Redis 缓存读取
- 1 小时后：缓存过期，重新读取

### 4. 向后兼容

系统同时支持新旧两种方式：
- ✅ **新方式**：Bitable 结构化存储（推荐）
- ✅ **旧方式**：HTML 文件存储（向后兼容）
- ✅ 前端自动适配两种数据格式

---

## 🔍 故障排查

### 问题 1: 报告保存失败

**错误日志**：
```
FEISHU_TABLE_DISCOUNT_REPORTS 未配置,无法保存到 Bitable
```

**解决方案**：
1. 检查环境变量是否配置
2. 检查表 ID 是否正确
3. 检查飞书应用权限

### 问题 2: 无法读取报告列表

**症状**：前端显示"暂无查询记录"

**排查步骤**：
1. 检查 Bitable 表中是否有数据
2. 检查 API 响应：`GET /api/v1/discount-rule/reports`
3. 查看后端日志

### 问题 3: 报告详情显示错误

**症状**：点击"查看详情"后显示错误

**排查步骤**：
1. 检查 `detail_results` 字段数据是否完整
2. 如果是压缩数据，确认格式为 `gzip:base64...`
3. 查看浏览器控制台错误

### 问题 4: 飞书 API 调用失败

**错误日志**：
```
Failed to save report to Bitable: 99991401
```

**常见原因**：
- 飞书应用 Token 过期
- 表权限不足
- 表 ID 错误

**解决方案**：
1. 刷新飞书应用 Token
2. 确认应用有表的读写权限
3. 验证表 ID 正确性

---

## 📊 监控指标

### 1. Bitable 存储监控

```bash
# 查看报告数量
curl http://10.5.3.150:10038/api/v1/discount-rule/reports?limit=1

# 返回示例
{
  "success": true,
  "data": {
    "total": 156,  # 总报告数
    "reports": [...]
  }
}
```

### 2. 性能监控

- **平均查询时间**：2-5 秒
- **缓存命中率**：> 80%
- **压缩比**：通常 3-5 倍

### 3. 日志监控

关键日志标记：
```bash
# 成功保存
[DiscountReport] Saved report to Bitable: report-uuid

# 压缩日志
[DiscountReport] Compressed data: 12345 bytes → 4567 bytes (63% reduction)

# 缓存日志
[DiscountReport] Cache hit for report: report-uuid
```

---

## 📚 相关文档

- [买赠规则 Bitable 迁移总结](./DISCOUNT_RULE_BITABLE_MIGRATION.md)
- [轻量级监控实施总结](./LIGHTWEIGHT_MONITORING_IMPLEMENTATION.md)
- [任务队列实施总结](./TASK_QUEUE_IMPLEMENTATION.md)

---

## 🆘 获取帮助

如遇到问题，请：
1. 查看后端日志：`docker-compose logs -f backend`
2. 查看前端控制台错误
3. 检查 Bitable 表数据
4. 联系技术支持

---

**更新时间**: 2025-12-19
**状态**: ✅ 已验证可用
