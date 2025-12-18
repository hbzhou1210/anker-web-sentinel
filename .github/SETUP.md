# GitHub Actions Setup Guide

## 📋 概述

本项目使用 GitHub Actions 实现自动化 CI/CD 流程,包括:

- ✅ 代码类型检查 (TypeScript)
- ✅ 代码质量检查 (Linting)
- ✅ 自动化测试
- ✅ 构建验证
- ✅ Docker 镜像构建
- ✅ 自动部署

## 🚀 快速开始

### 1. 启用 GitHub Actions

Actions 默认已启用。提交代码到 `master`、`main` 或 `develop` 分支时会自动触发。

### 2. 配置 Secrets (可选)

如需 Docker 推送和自动部署,需要在 GitHub 仓库中配置以下 Secrets:

#### Docker Hub (可选)

Settings → Secrets and variables → Actions → New repository secret

- `DOCKER_USERNAME`: Docker Hub 用户名
- `DOCKER_PASSWORD`: Docker Hub 密码或访问令牌

#### 部署服务器 (可选)

- `DEPLOY_HOST`: 部署服务器 IP 或域名
- `DEPLOY_USER`: SSH 用户名
- `DEPLOY_KEY`: SSH 私钥
- `DEPLOY_PATH`: 应用部署路径 (默认: `/var/www/anita-qa-system`)

## 📝 工作流说明

### CI Workflow (`.github/workflows/ci.yml`)

#### 触发条件

- Push 到 `master`、`main`、`develop` 分支
- 创建 Pull Request 到 `master`、`main` 分支
- 手动触发 (workflow_dispatch)

#### 执行步骤

**1. Test & Build Job**
- 检出代码
- 安装 Node.js 20
- 安装依赖 (npm ci)
- Backend:
  - 类型检查 (通过构建验证)
  - Linting (可选)
  - 测试 (可选)
  - 构建
- Frontend:
  - 类型检查 (通过构建验证)
  - Linting (可选)
  - 测试 (可选)
  - 构建
- 分析构建大小
- 上传构建产物 (保留 7 天)

**2. Docker Job** (仅在 master/main 分支)
- 构建 Docker 镜像
- 推送到 Docker Hub (如果配置了 secrets)
- 使用构建缓存加速

**3. Deploy Job** (仅在 master/main 分支)
- 下载构建产物
- 部署到生产环境 (需要配置 secrets)
- 创建部署摘要

## 🔧 本地测试

### 运行本地 CI 检查

在提交代码前,可以本地运行 CI 检查:

```bash
# 方式 1: 使用本地 CI 脚本
./scripts/ci-check.sh

# 方式 2: 手动运行
cd backend
npm ci
npm run build

cd ../frontend
npm ci
npm run build
```

### Act - 本地运行 GitHub Actions

安装 [act](https://github.com/nektos/act):

```bash
# macOS
brew install act

# 运行工作流
act push
act pull_request
```

## 📊 CI 状态徽章

在 README.md 中添加状态徽章:

```markdown
![CI](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/CI%2FCD%20Pipeline/badge.svg)
```

## 🐳 Docker 构建

### 自动构建

每次推送到 `master`/`main` 分支时自动构建。

### 镜像标签

- `latest` - 最新的 master/main 分支构建
- `master-<commit-sha>` - 特定提交的构建
- `develop-<commit-sha>` - develop 分支构建

### 手动构建

```bash
# 本地构建
docker build -t anita-qa-system:latest .

# 构建并推送
docker build -t your-username/anita-qa-system:latest .
docker push your-username/anita-qa-system:latest
```

## 🚀 部署

### 自动部署 (推荐)

配置好 `DEPLOY_*` secrets 后,每次推送到 `master`/`main` 会自动部署。

### 手动部署

```bash
# 使用部署脚本
export DEPLOY_HOST="your-server-ip"
export DEPLOY_USER="your-ssh-user"
export DEPLOY_PATH="/var/www/anita-qa-system"
export DEPLOY_METHOD="docker-compose"  # 或 ssh-pm2, docker-registry

./scripts/deploy.sh production
```

### 部署方式

#### 1. Docker Compose (推荐)

```bash
# 在服务器上
cd /path/to/app
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

#### 2. PM2 (Node.js)

```bash
# 在服务器上
cd /path/to/app
git pull
npm ci
npm run build
pm2 restart anita-qa-system
```

#### 3. Docker Registry

```bash
# 拉取最新镜像
docker pull your-username/anita-qa-system:latest

# 重启容器
docker-compose down
docker-compose up -d
```

## 🔐 环境变量

### 开发环境

在本地 `.env` 文件中配置。

### 生产环境

通过以下方式配置:

1. **Docker**: `docker-compose.yml` 或 `.env` 文件
2. **服务器**: 系统环境变量或 PM2 ecosystem 文件
3. **GitHub Secrets**: 用于 CI/CD 流程

### 必需环境变量

```bash
# Feishu Bitable
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
BITABLE_APP_TOKEN=your_bitable_token

# 可选
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=production
```

## 📈 监控和日志

### CI/CD 日志

- GitHub Actions 页面查看详细日志
- 每个 job 都有独立的日志输出

### 应用日志

部署后的应用日志:

```bash
# Docker
docker-compose logs -f backend

# PM2
pm2 logs anita-qa-system

# 系统日志
tail -f /var/log/anita-qa-system/application.log
```

## 🐛 故障排除

### 问题 1: 构建失败

**原因**: 依赖安装或类型检查失败

**解决方案**:
1. 本地运行 `npm ci && npm run build`
2. 检查 TypeScript 错误
3. 修复后重新提交

### 问题 2: Docker 推送失败

**原因**: Docker Hub secrets 未配置或无效

**解决方案**:
1. 检查 `DOCKER_USERNAME` 和 `DOCKER_PASSWORD` secrets
2. 确认 Docker Hub 访问令牌有效
3. 工作流会继续执行 (continue-on-error)

### 问题 3: 部署失败

**原因**: SSH 连接失败或权限不足

**解决方案**:
1. 检查 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_KEY` secrets
2. 确认 SSH 密钥已添加到服务器
3. 检查服务器防火墙规则

### 问题 4: 测试超时

**原因**: 测试运行时间过长

**解决方案**:
1. 优化测试性能
2. 增加超时时间
3. 使用 `continue-on-error: true` (临时)

## 🔄 更新工作流

### 修改触发分支

编辑 `.github/workflows/ci.yml`:

```yaml
on:
  push:
    branches: [master, main, develop, feature/*]
  pull_request:
    branches: [master, main]
```

### 添加新的检查步骤

```yaml
- name: Security Audit
  run: npm audit --audit-level=moderate
```

### 自定义构建产物保留时间

```yaml
- name: Upload Build Artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build
    path: dist/
    retention-days: 30  # 修改为 30 天
```

## 📚 参考资料

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Docker 官方文档](https://docs.docker.com/)
- [PM2 文档](https://pm2.keymetrics.io/)
- [Node.js 最佳实践](https://github.com/goldbergyoni/nodebestpractices)

## 💡 最佳实践

1. **频繁提交**: 小步快跑,及时发现问题
2. **本地测试**: 提交前运行 `./scripts/ci-check.sh`
3. **保护分支**: 在 GitHub 设置中启用分支保护规则
4. **代码审查**: 所有 PR 都应经过审查
5. **监控告警**: 部署后监控应用健康状态
6. **回滚计划**: 准备好快速回滚方案

---

**维护者**: Anita QA Team
**最后更新**: 2024-12-18
