# Anita - Web Automation Checker

可视化网页自动化巡检工具 - UI测试 + 性能分析 + 自动化巡检

## 功能特性

- ✅ **UI 自动化测试** - 链接、表单、按钮、图片检测，自动截图
- ✅ **性能分析** - Core Web Vitals、资源大小、加载时间
- ✅ **响应式测试** - 多设备尺寸适配检测
- ✅ **自动化巡检** - 定时巡检任务、邮件通知、历史记录
- ✅ **测试点提取** - AI 从飞书文档提取测试用例

## 技术栈

**后端**: Node.js 20 + TypeScript + Express + Playwright + PostgreSQL
**前端**: React 18 + TypeScript + Vite + TailwindCSS

## 快速开始

### 前置要求

- Node.js >= 20.0.0
- PostgreSQL >= 14
- npm >= 10.0.0

### 安装

```bash
# 1. 安装依赖
npm install

# 2. 配置数据库
createdb web_automation_checker

# 3. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env 设置 DATABASE_URL

# 4. 运行数据库迁移
npm run migrate

# 5. 安装浏览器
cd backend && npx playwright install chromium
```

### 开发

```bash
# 启动开发服务器
npm run dev

# 前端: http://localhost:5173
# 后端: http://localhost:3000
```

### 生产构建

```bash
npm run build
```

## Docker 部署

### 使用 Docker Compose（推荐）

```bash
# 1. 配置环境变量
cp .env.production .env
nano .env  # 编辑数据库密码等配置

# 2. 启动所有服务
docker-compose up -d

# 3. 访问应用
# 前端: http://localhost
# 后端: http://localhost:3000
```

### Launch 平台部署

```bash
# 1. 准备数据库（推荐 Neon: https://neon.tech）
# 获取 PostgreSQL 连接字符串

# 2. 打包项目
zip -r anita-launch.zip . \
    -x "node_modules/*" -x ".git/*" -x "dist/*"

# 3. 上传到 Launch 平台
# 选择 "其他类型，自带 Dockerfile"

# 4. 配置环境变量
DATABASE_URL=postgresql://user:pass@host:5432/dbname
FRONTEND_URL=https://web.anker-launch.com
```

## 项目结构

```
anita-project/
├── backend/               # 后端 Node.js 服务
│   ├── src/
│   │   ├── api/          # Express API 路由
│   │   ├── automation/   # Playwright 浏览器池
│   │   ├── database/     # 数据库连接和迁移
│   │   ├── models/       # 实体和仓库
│   │   ├── services/     # 业务逻辑
│   │   └── index.ts
│   └── package.json
├── frontend/              # 前端 React 应用
│   ├── src/
│   │   ├── components/   # React 组件
│   │   ├── pages/        # 页面路由
│   │   ├── services/     # API 客户端
│   │   └── main.tsx
│   └── package.json
├── Dockerfile             # Docker 镜像配置
├── docker-compose.yml     # Docker Compose 配置
└── package.json           # Monorepo 配置
```

## API 端点

```
GET  /api/v1/tests/:id              - 获取测试结果
POST /api/v1/tests/run              - 执行 UI 测试
POST /api/v1/tests/performance      - 执行性能测试
POST /api/v1/responsive/test        - 响应式测试
GET  /api/v1/patrol/tasks           - 巡检任务列表
POST /api/v1/patrol/tasks           - 创建巡检任务
POST /api/v1/patrol/tasks/:id/run   - 执行巡检
POST /api/v1/testPoints/extract     - 提取测试点
GET  /health                        - 健康检查
```

## 环境变量

**后端** (`backend/.env`):
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/web_automation_checker
FRONTEND_URL=http://localhost:5173
ANTHROPIC_API_KEY=sk-xxx           # Claude AI (可选)
SMTP_HOST=smtp.gmail.com           # 邮件通知 (可选)
SMTP_USER=your@email.com
SMTP_PASSWORD=your_password
```

**前端** (`frontend/.env.production`):
```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## 许可证

MIT
