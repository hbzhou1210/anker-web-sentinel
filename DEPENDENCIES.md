# 项目依赖说明 (Dependencies)

本文档详细列出 Anita 项目的所有依赖项和系统要求。

---

## 系统要求 (System Requirements)

### 运行环境
- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **PostgreSQL**: >= 14.0
- **操作系统**: macOS, Linux, Windows

### 推荐配置
- **CPU**: 4 核及以上
- **内存**: 8GB 及以上
- **磁盘**: 20GB 可用空间

---

## Node.js 依赖 (npm packages)

### 根项目 (Root)

```json
{
  "name": "web-automation-checker",
  "version": "1.0.0",
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

**工作区 (Workspaces)**:
- `backend/` - 后端 API 服务
- `frontend/` - 前端 Web 界面

---

## 后端依赖 (Backend Dependencies)

### 生产依赖 (Production)

| 包名 | 版本 | 用途 |
|------|------|------|
| `@anthropic-ai/sdk` | ^0.71.0 | Anthropic Claude API SDK (性能分析) |
| `express` | ^4.18.2 | Web 框架 |
| `cors` | ^2.8.5 | 跨域资源共享 |
| `dotenv` | ^16.3.1 | 环境变量管理 |
| `pg` | ^8.11.3 | PostgreSQL 数据库客户端 |
| `playwright` | ^1.40.1 | 浏览器自动化测试 |
| `sharp` | ^0.33.1 | 图片处理 (截图压缩) |
| `axios` | ^1.6.2 | HTTP 客户端 |
| `nodemailer` | ^7.0.11 | 邮件发送服务 |
| `node-cron` | ^4.2.1 | 定时任务调度 |
| `zod` | ^3.22.4 | 数据验证 |
| `typescript` | ^5.3.3 | TypeScript 编译器 |

### 开发依赖 (Development)

| 包名 | 版本 | 用途 |
|------|------|------|
| `tsx` | ^4.7.0 | TypeScript 执行器 (开发环境) |
| `@types/node` | ^20.10.6 | Node.js 类型定义 |
| `@types/express` | ^4.17.21 | Express 类型定义 |
| `@types/cors` | ^2.8.17 | CORS 类型定义 |
| `@types/pg` | ^8.10.9 | PostgreSQL 类型定义 |
| `@types/nodemailer` | ^7.0.4 | Nodemailer 类型定义 |
| `jest` | ^29.7.0 | 测试框架 |
| `@types/jest` | ^29.5.11 | Jest 类型定义 |
| `supertest` | ^6.3.3 | HTTP 测试工具 |
| `eslint` | ^8.56.0 | 代码检查工具 |

**安装命令**:
```bash
cd backend
npm install
```

---

## 前端依赖 (Frontend Dependencies)

### 生产依赖 (Production)

| 包名 | 版本 | 用途 |
|------|------|------|
| `react` | ^18.2.0 | React 框架 |
| `react-dom` | ^18.2.0 | React DOM 渲染 |
| `react-router-dom` | ^6.21.1 | React 路由 |
| `axios` | ^1.6.5 | HTTP 客户端 |
| `@tanstack/react-query` | ^5.17.0 | 数据获取和缓存 |
| `lucide-react` | ^0.555.0 | 图标库 |
| `recharts` | ^2.10.3 | 图表组件 |

### 开发依赖 (Development)

| 包名 | 版本 | 用途 |
|------|------|------|
| `vite` | ^5.0.11 | 构建工具 |
| `@vitejs/plugin-react` | ^4.2.1 | Vite React 插件 |
| `typescript` | ^5.3.3 | TypeScript 编译器 |
| `tailwindcss` | ^3.4.0 | CSS 框架 |
| `postcss` | ^8.4.33 | CSS 处理器 |
| `autoprefixer` | ^10.4.16 | CSS 自动前缀 |
| `eslint` | ^8.56.0 | 代码检查工具 |
| `vitest` | ^1.1.3 | 测试框架 |

**安装命令**:
```bash
cd frontend
npm install
```

---

## 外部服务依赖 (External Services)

### 必需服务

1. **PostgreSQL 数据库**
   - 版本: >= 14.0
   - 用途: 数据持久化存储
   - 配置: 见 `backend/.env.example`

### 可选服务

1. **SMTP 邮件服务**
   - 用途: 发送巡检失败通知邮件
   - 支持: Gmail, 企业邮箱等
   - 配置: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`

2. **Anthropic Claude API**
   - 用途: AI 性能分析 (Core Web Vitals)
   - 配置: `ANTHROPIC_API_KEY`
   - 可选: 如不配置则跳过 AI 分析功能

---

## Playwright 浏览器 (Browser Binaries)

Playwright 会自动下载以下浏览器:

| 浏览器 | 版本 | 用途 |
|--------|------|------|
| Chromium | ~120.0 | 主要测试浏览器 |

**安装命令**:
```bash
npx playwright install chromium
```

**系统依赖** (Linux):
```bash
# Ubuntu/Debian
apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libxshmfence1 fonts-noto-color-emoji
```

---

## Docker 镜像依赖 (Docker Images)

如果使用 Docker 部署，将使用以下基础镜像:

| 镜像 | 版本 | 用途 |
|------|------|------|
| `node` | 20-slim | 后端运行环境 |
| `nginx` | alpine | 前端 Web 服务器 |
| `postgres` | 16-alpine | 数据库 |

**安装命令**:
```bash
docker-compose pull
```

---

## 安装所有依赖 (Install All Dependencies)

### 方式 1: 完整安装

```bash
# 在项目根目录
npm install

# 这会安装根项目、backend 和 frontend 的所有依赖
```

### 方式 2: 分别安装

```bash
# 后端
cd backend
npm install

# 前端
cd frontend
npm install

# Playwright 浏览器
npx playwright install chromium
```

### 方式 3: Docker (推荐生产环境)

```bash
# 使用 Docker Compose，自动处理所有依赖
docker-compose up -d
```

---

## 依赖更新 (Updating Dependencies)

### 检查过期依赖

```bash
# 根项目
npm outdated

# 后端
cd backend && npm outdated

# 前端
cd frontend && npm outdated
```

### 更新依赖

```bash
# 更新次要版本 (推荐)
npm update

# 更新主要版本 (谨慎)
npm install <package>@latest
```

### 安全审计

```bash
# 检查安全漏洞
npm audit

# 自动修复
npm audit fix
```

---

## 兼容性说明 (Compatibility)

### Node.js 版本

- ✅ 推荐: Node.js 20.x LTS
- ✅ 支持: Node.js 18.x+
- ❌ 不支持: Node.js 16.x 及以下

### 操作系统

| 系统 | 支持状态 | 备注 |
|------|----------|------|
| macOS | ✅ 完全支持 | 开发和生产 |
| Linux (Ubuntu 20.04+) | ✅ 完全支持 | 推荐生产环境 |
| Linux (CentOS 7+) | ✅ 支持 | 需要额外配置 |
| Windows 10/11 | ⚠️ 部分支持 | WSL2 推荐 |

### 浏览器支持 (前端)

| 浏览器 | 最低版本 |
|--------|----------|
| Chrome | >= 90 |
| Firefox | >= 88 |
| Safari | >= 14 |
| Edge | >= 90 |

---

## 故障排查 (Troubleshooting)

### 问题 1: npm install 失败

**原因**: Node.js 版本过低

**解决**:
```bash
# 检查版本
node --version

# 升级 Node.js
# macOS: brew install node@20
# Linux: 使用 nvm
```

### 问题 2: Playwright 安装失败

**原因**: 缺少系统依赖

**解决**:
```bash
# Ubuntu/Debian
sudo apt-get install -y libnss3 libatk1.0-0 libgbm1

# 或使用 Playwright 脚本
npx playwright install-deps
```

### 问题 3: Sharp 编译失败

**原因**: 缺少编译工具

**解决**:
```bash
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt-get install -y build-essential python3
```

---

## 许可证 (Licenses)

本项目使用 MIT 许可证。所有依赖包的许可证信息:

```bash
# 查看所有依赖的许可证
npm run license-checker
```

**主要依赖许可证**:
- Express: MIT
- React: MIT
- Playwright: Apache-2.0
- PostgreSQL: PostgreSQL License
- Anthropic SDK: Apache-2.0

---

## 更新日志 (Changelog)

### 2024-12-05
- 初始版本
- Node.js 20+
- TypeScript 5.3
- React 18
- Playwright 1.40

---

**完整依赖列表**: 参见各目录下的 `package.json` 文件
- [根项目 package.json](./package.json)
- [后端 package.json](./backend/package.json)
- [前端 package.json](./frontend/package.json)
