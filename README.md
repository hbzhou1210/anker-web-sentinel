# Anker Web Sentinel

企业级网站质量监控与测试平台 - 网页质量检测 + 响应式测试 + 定时巡检

## 功能特性

- ✅ **网页质量检测** - 一键检测网页UI、性能、响应式表现，输出健康评分
- ✅ **响应式测试** - 多设备(手机/平板/桌面)尺寸适配检测，自动截图
- ✅ **定时巡检管理** - 配置定时巡检任务、邮件通知、历史记录
- ✅ **测试点提取** - AI 从飞书文档提取测试用例(开发中)
- ✅ **健康评分** - 综合评估页面质量,生成详细报告

## 技术栈

**后端**: Node.js 20 + TypeScript + Express + Playwright + 飞书 Bitable
**前端**: React 18 + TypeScript + Vite + TailwindCSS
**缓存**: Redis（可选）

## 快速开始

### 前置要求

- Node.js >= 20.0.0
- npm >= 10.0.0
- 飞书开放平台应用（用于 Bitable 数据存储）
- Redis（可选，用于缓存）

### 安装

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 设置飞书应用凭证:
# FEISHU_APP_ID=your_app_id
# FEISHU_APP_SECRET=your_app_secret

# 3. 安装浏览器
cd backend && npx playwright install chromium
```

### 飞书应用配置

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 开通以下权限：
   - `bitable:app` - 多维表格应用权限
   - `im:message` - 发送消息（可选，用于通知）
4. 获取 App ID 和 App Secret
5. 配置到 `.env` 文件中

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
# 1. 打包项目
zip -r anker-web-sentinel.zip . \
    -x "node_modules/*" -x ".git/*" -x "dist/*"

# 2. 上传到 Launch 平台
# 选择 "其他类型，自带 Dockerfile"

# 3. 配置环境变量
DATABASE_STORAGE=bitable
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FRONTEND_URL=https://web.anker-launch.com
REDIS_ENABLED=false  # 或配置 Redis
```

## 项目结构

```
anker-web-sentinel/
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
DATABASE_URL=postgresql://user:pass@localhost:5432/anker_web_sentinel
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
