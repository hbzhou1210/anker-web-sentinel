# 快速启动指南

## 当前状态

项目已完成 Phase 1-4 的实现,包括:
- ✅ UI 测试功能 (链接、表单、按钮、图片检测)
- ✅ 性能测试功能 (使用 WebPageTest)
- ✅ 智能失败分析和修复建议
- ✅ 截图功能(自动截图失败元素)
- ✅ 前端可视化界面
- ✅ 测试点提取功能 (从飞书文档提取测试点并生成测试用例表格)

## 前置要求

需要先安装 PostgreSQL 数据库才能启动项目。

### 安装 PostgreSQL

#### macOS (推荐使用 Homebrew)

```bash
# 安装 PostgreSQL 14
brew install postgresql@14

# 启动服务
brew services start postgresql@14

# 创建数据库
createdb web_automation_checker

# 验证安装
psql web_automation_checker -c "SELECT version();"
```

#### Ubuntu/Debian

```bash
# 更新包列表
sudo apt update

# 安装 PostgreSQL
sudo apt install postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建数据库
sudo -u postgres createdb web_automation_checker

# 创建用户(如果需要)
sudo -u postgres createuser --interactive --pwprompt
```

#### Windows

1. 访问 https://www.postgresql.org/download/windows/
2. 下载并安装 PostgreSQL 14+
3. 在安装过程中设置密码
4. 安装完成后,使用 pgAdmin 或命令行创建数据库:

```sql
CREATE DATABASE web_automation_checker;
```

### 验证 PostgreSQL 安装

```bash
# 检查 PostgreSQL 是否运行
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql

# 连接到数据库
psql web_automation_checker
```

## 启动步骤

### 1. 后端依赖已安装 ✓

依赖已经安装完成,可以跳过这一步。

### 2. 配置环境变量 ✓

`.env` 文件已创建。如果需要修改配置:

```bash
cd /Users/anker/anita-project/backend
nano .env
```

重要配置项:
- `DATABASE_URL`: PostgreSQL 连接字符串
- `WEBPAGETEST_API_KEY`: 性能测试 API 密钥 (可选,从 https://www.webpagetest.org/getkey.php 获取)
- `SCREENSHOT_DIR`: 截图存储路径

### 3. 运行数据库迁移

在 PostgreSQL 启动后运行:

```bash
cd /Users/anker/anita-project/backend
npm run migrate
```

成功后会看到:
```
✓ Migration 001_initial_schema.sql executed successfully
✓ Migration 002_add_test_types.sql executed successfully
✓ Migration 003_add_performance_metrics.sql executed successfully
✓ Migration 004_add_diagnostics_field.sql executed successfully
✓ Migration 005_add_screenshot_url.sql executed successfully
✓ All migrations completed successfully
```

### 4. 启动后端服务

```bash
cd /Users/anker/anita-project/backend
npm run dev
```

后端将在 http://localhost:3000 启动

### 5. 安装前端依赖

打开新终端窗口:

```bash
cd /Users/anker/anita-project/frontend
npm install
```

### 6. 启动前端服务

```bash
cd /Users/anker/anita-project/frontend
npm run dev
```

前端将在 http://localhost:5173 启动

## 访问应用

浏览器打开: http://localhost:5173

## 使用示例

### UI 测试
1. 输入 URL (例如: https://example.com)
2. 选择 "UI 测试"
3. 点击"开始测试"
4. 查看结果:
   - 链接检测结果
   - 表单检测结果
   - 按钮检测结果
   - 图片检测结果
5. 点击失败项查看:
   - 失败原因分析
   - 修复建议
   - 截图(红色高亮问题元素)

### 性能测试
1. 输入 URL
2. 选择 "性能测试"
3. 点击"开始测试"
4. 等待 WebPageTest 完成(约 1-3 分钟)
5. 查看结果:
   - 加载时间
   - 资源大小
   - 服务器响应时间
   - 首次渲染时间
6. 点击"查看详情"查看:
   - 超标原因分析
   - 优化建议
   - 最大资源列表

### 测试点提取
1. 导航到"测试点提取"页面
2. 可选:输入飞书文档链接(用于记录来源)
3. 必填:粘贴需求文档内容到文本框
4. 点击"提取测试点并保存到飞书"
5. 等待AI处理(约30-60秒)
6. 查看结果:
   - 📊 卡片视图:查看提取的测试点详情
   - 📝 表格预览:查看生成的测试用例表格(Markdown格式)
7. 点击"复制 Markdown"按钮复制表格内容
8. 系统会自动:
   - 将测试点保存到数据库
   - 生成8列测试用例表格(用例ID、模块、优先级、测试类型、用例标题、操作步骤、预期结果、实际执行结果)
   - 返回飞书文档URL(占位符,待MCP工具集成)

## 故障排查

### 数据库连接失败

**症状**:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方案**:
```bash
# 检查 PostgreSQL 状态
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# 启动 PostgreSQL
brew services start postgresql@14  # macOS
sudo systemctl start postgresql  # Linux

# 验证连接
psql web_automation_checker -c "SELECT 1;"
```

### 端口被占用

**症状**:
```
Error: listen EADDRINUSE :::3000
```

**解决方案**:
```bash
# 查找占用进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或修改端口
# 编辑 backend/.env 修改 PORT=3001
```

### Playwright 浏览器未安装

**症状**:
```
browserType.launch: Executable doesn't exist
```

**解决方案**:
```bash
cd /Users/anker/anita-project/backend
npx playwright install chromium
```

### WebPageTest API 密钥未设置

**症状**:
性能测试时提示 API 密钥未设置

**解决方案**:
1. 访问 https://www.webpagetest.org/getkey.php
2. 输入邮箱获取免费 API 密钥
3. 编辑 `backend/.env`:
   ```
   WEBPAGETEST_API_KEY=your_actual_key_here
   ```
4. 重启后端服务

**注意**: 免费 API 每天限制 200 次测试

## 快速命令参考

```bash
# 启动 PostgreSQL (macOS)
brew services start postgresql@14

# 启动后端 (开发模式)
cd /Users/anker/anita-project/backend && npm run dev

# 启动前端
cd /Users/anker/anita-project/frontend && npm run dev

# 运行迁移
cd /Users/anker/anita-project/backend && npm run migrate

# 安装 Playwright 浏览器
cd /Users/anker/anita-project/backend && npx playwright install chromium
```

## 下一步

- 申请 WebPageTest API 密钥以使用性能测试功能
- 查看 [完整 README](./README.md) 了解更多功能
- 查看 [功能规范](./specs/001-web-automation-checker/spec.md) 了解实现细节
