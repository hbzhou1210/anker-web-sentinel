# 生产环境部署指南

## 问题诊断

### 症状
生产环境 (http://10.5.3.150:10038) 的网页质量检测报告无法查询到 `ui_test_results` 和 `performance_results` 数据。

### 根本原因
生产环境的 `.env.production` 文件中缺少飞书多维表格的必需配置:
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_BASE_URL`
- `DATABASE_STORAGE`

没有这些配置,后端无法获取飞书访问令牌,导致数据无法写入飞书多维表格。

## 解决方案

### 1. 更新生产环境配置文件

在生产服务器上,编辑 `/opt/anita-project/.env.production` (或实际部署路径的 .env 文件),添加以下配置:

```bash
# 飞书多维表格配置 (必填!)
FEISHU_APP_ID=cli_a875ff2f3859d00c
FEISHU_APP_SECRET=MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E
FEISHU_BASE_URL=https://open.feishu.cn
DATABASE_STORAGE=bitable
```

### 2. 部署最新代码

确保生产环境使用最新的 master 分支代码,包含以下关键修复:

- `55939b6` - fix: 修复测试报告缺少详细结果数据的问题
- `5a5960d` - fix: 修复测试结果保存和读取功能
- `eb5fbd9` - fix: 使用 testRequestId 作为报告 ID 保持一致性

### 3. 重启服务

```bash
# 如果使用 Docker
cd /opt/anita-project
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# 如果使用 PM2
pm2 restart anita-backend
```

### 4. 验证部署

创建一个测试任务验证配置是否正确:

```bash
# 创建测试
TEST_ID=$(curl -X POST http://10.5.3.150:10038/api/v1/tests \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.baidu.com"}' -s | jq -r '.id')

# 等待测试完成
sleep 20

# 查询测试报告
curl -s "http://10.5.3.150:10038/api/v1/reports/${TEST_ID}" | \
  jq '{id, url, overallScore, uiTestResultsCount: (.uiTestResults | length), performanceResultsCount: (.performanceResults | length)}'
```

预期结果应该显示:
- `uiTestResultsCount` > 0 (通常为 80-100 个结果)
- `performanceResultsCount` >= 0

### 5. 验证飞书多维表格

在飞书多维表格中查看最新记录:
- 打开: https://anker-in.feishu.cn/base/X66Mb4mPRagcrSsBlRQcNrHQnKh
- 检查 `ui_test_results` 和 `performance_results` 字段是否有数据

## 配置说明

### 必需的环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `FEISHU_APP_ID` | 飞书应用 ID | cli_a875ff2f3859d00c |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E |
| `FEISHU_BASE_URL` | 飞书 API 基础 URL | https://open.feishu.cn |
| `DATABASE_STORAGE` | 数据存储方式 | bitable |

### 可选的环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SMTP_HOST` | 邮件服务器地址 | - |
| `SMTP_PORT` | 邮件服务器端口 | 587 |
| `SMTP_USER` | 邮件账户 | - |
| `SMTP_PASSWORD` | 邮件密码 | - |
| `APP_URL` | 应用访问地址 | http://localhost |

## 技术细节

### 数据流程

1. **测试创建**: 用户通过 API 创建测试任务
2. **测试执行**: Playwright 执行浏览器测试,生成 UI 测试结果和性能结果
3. **数据保存**: `FeishuBitableService.createTestReport()` 将结果序列化为 JSON 并保存到飞书多维表格
4. **数据查询**: 通过 `request_id` 查询记录,反序列化 JSON 返回完整结果

### 关键文件

- [backend/src/config/feishu-bitable.config.ts](backend/src/config/feishu-bitable.config.ts) - 飞书配置
- [backend/src/services/FeishuBitableService.ts](backend/src/services/FeishuBitableService.ts) - 飞书服务
- [backend/src/models/repositories/BitableTestReportRepository.ts](backend/src/models/repositories/BitableTestReportRepository.ts) - 数据仓库

### 数据结构

飞书多维表格字段:
- `request_id` (文本) - 测试请求 UUID
- `url` (URL) - 被测试的 URL
- `overall_score` (数字) - 总体评分
- `ui_test_results` (文本) - UI 测试结果 JSON 字符串
- `performance_results` (文本) - 性能测试结果 JSON 字符串
- `total_checks` (数字) - 总检查项
- `passed_checks` (数字) - 通过的检查项
- `failed_checks` (数字) - 失败的检查项
- `warning_checks` (数字) - 警告的检查项
- `completed_at` (日期) - 完成时间

## 故障排查

### 问题: 数据没有写入飞书

**检查步骤:**

1. 验证环境变量:
```bash
# 在服务器上
cat .env.production | grep FEISHU
```

2. 检查后端日志:
```bash
# Docker
docker logs anita-backend | grep "FeishuBitable\|BitableRepo"

# PM2
pm2 logs anita-backend --lines 100 | grep "FeishuBitable\|BitableRepo"
```

3. 验证飞书访问令牌:
```bash
curl -X POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "cli_a875ff2f3859d00c",
    "app_secret": "MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E"
  }'
```

**预期日志输出:**
```
[FeishuBitable] Creating test report with 94 UI results and 0 performance results
[FeishuBitable] Test report created with record ID: recXXXXXXXXXX
[BitableRepo] Created test report with ID: xxx-xxx-xxx-xxx, Record ID: recXXXXXXXXXX
```

### 问题: API 返回数据但飞书没有

这通常意味着代码使用了内存存储而不是飞书存储。

**检查:**
- 确认 `DATABASE_STORAGE=bitable` 已设置
- 检查代码是否正确初始化了 BitableTestReportRepository

## 联系支持

如有问题,请联系:
- 开发者: anita.zhou@anker.io
- 项目仓库: http://e.coding.anker-in.com/codingcorp/dtc_it/anker-web-sentinel.git
