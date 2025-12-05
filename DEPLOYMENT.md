# Anita 项目部署指南

本文档详细说明如何将 Anita Web 自动化巡检工具部署到生产服务器。

## 📋 目录

- [系统要求](#系统要求)
- [部署架构](#部署架构)
- [快速开始](#快速开始)
- [详细部署步骤](#详细部署步骤)
- [配置说明](#配置说明)
- [维护与管理](#维护与管理)
- [故障排查](#故障排查)

---

## 系统要求

### 硬件要求

- **CPU**: 2 核及以上（推荐 4 核）
- **内存**: 4GB 及以上（推荐 8GB）
  - Playwright 浏览器实例较耗内存
  - 浏览器池默认 5 个实例，每个约占用 200-500MB
- **磁盘**: 20GB 及以上可用空间
  - 包含 Docker 镜像、数据库和截图存储

### 软件要求

- **操作系统**: Linux (Ubuntu 20.04+, CentOS 7+) 或 macOS
- **Docker**: 20.10 及以上版本
- **Docker Compose**: 2.0 及以上版本

---

## 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                        用户                             │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP (端口 80)
                    ↓
┌─────────────────────────────────────────────────────────┐
│                   Nginx (前端容器)                       │
│  - 提供静态文件 (React SPA)                             │
│  - 反向代理 API 请求到后端                               │
└───────────────────┬─────────────────────────────────────┘
                    │ /api/* → http://backend:3000
                    ↓
┌─────────────────────────────────────────────────────────┐
│                  Backend (后端容器)                      │
│  - Express API 服务                                     │
│  - Playwright 浏览器池 (5 个实例)                        │
│  - Core Web Vitals 性能采集                             │
│  - 邮件通知服务                                          │
└───────────────────┬─────────────────────────────────────┘
                    │ PostgreSQL 连接
                    ↓
┌─────────────────────────────────────────────────────────┐
│                 PostgreSQL (数据库)                      │
│  - 巡检任务配置                                          │
│  - 执行历史记录                                          │
│  - 测试结果数据                                          │
└─────────────────────────────────────────────────────────┘
```

### 容器服务说明

| 服务名 | 容器名 | 端口 | 说明 |
|--------|--------|------|------|
| **frontend** | anita-frontend | 80 | Nginx + React SPA |
| **backend** | anita-backend | 3000 | Express API + Playwright |
| **postgres** | anita-postgres | 5432 | PostgreSQL 16 |

---

## 快速开始

如果你想快速部署测试，按照以下步骤即可：

```bash
# 1. 克隆或上传项目到服务器
cd /path/to/anita-project

# 2. 配置环境变量
cp .env.production .env
nano .env  # 编辑配置文件，至少修改 POSTGRES_PASSWORD

# 3. 构建并启动所有服务
docker-compose up -d

# 4. 查看服务状态
docker-compose ps

# 5. 访问应用
# 浏览器打开: http://your-server-ip
```

---

## 详细部署步骤

### 步骤 1: 准备服务器

#### 1.1 安装 Docker

**Ubuntu/Debian:**
```bash
# 更新包索引
sudo apt-get update

# 安装必要工具
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 添加 Docker APT 仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

**CentOS/RHEL:**
```bash
# 安装 yum-utils
sudo yum install -y yum-utils

# 添加 Docker 仓库
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装 Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

#### 1.2 添加当前用户到 docker 组（可选）

```bash
sudo usermod -aG docker $USER
newgrp docker

# 验证（无需 sudo）
docker ps
```

### 步骤 2: 上传项目文件

**方式 1: 使用 Git（推荐）**
```bash
# 在服务器上克隆项目
cd /opt  # 或其他你想放置项目的目录
git clone <your-repo-url> anita-project
cd anita-project
```

**方式 2: 使用 SCP/SFTP**
```bash
# 在本地打包
tar -czf anita-project.tar.gz anita-project/

# 上传到服务器
scp anita-project.tar.gz user@server:/opt/

# 在服务器上解压
ssh user@server
cd /opt
tar -xzf anita-project.tar.gz
cd anita-project
```

### 步骤 3: 配置环境变量

```bash
# 复制环境变量模板
cp .env.production .env

# 编辑配置文件
nano .env
```

**必须修改的配置**:
```bash
# 数据库密码（必须修改为强密码！）
POSTGRES_PASSWORD=your_secure_password_here

# 前端访问地址（修改为你的域名或IP）
FRONTEND_URL=http://your-domain.com
APP_URL=http://your-domain.com
```

**可选配置**:
```bash
# Email 通知配置（如果需要邮件通知功能）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Anthropic API（如果需要 AI 性能分析）
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### 步骤 4: 构建并启动服务

```bash
# 构建镜像并启动所有服务
docker-compose up -d

# 查看构建日志（如果遇到问题）
docker-compose logs -f

# 等待所有服务启动（约 1-2 分钟）
```

### 步骤 5: 初始化数据库

**后端会自动执行数据库迁移**，但如果需要手动执行：

```bash
# 进入后端容器
docker exec -it anita-backend sh

# 运行数据库迁移
npm run migrate

# 退出容器
exit
```

### 步骤 6: 验证部署

```bash
# 检查所有服务状态
docker-compose ps

# 应该看到 3 个服务都是 "Up" 状态:
# - anita-postgres (健康检查: healthy)
# - anita-backend  (健康检查: healthy)
# - anita-frontend (运行中)

# 检查服务日志
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# 测试 API 健康检查
curl http://localhost:3000/api/health
# 预期输出: {"status":"ok"}

# 测试前端访问
curl http://localhost/health
# 预期输出: healthy
```

### 步骤 7: 访问应用

在浏览器中打开：
```
http://your-server-ip
```

或者如果配置了域名：
```
http://your-domain.com
```

---

## 配置说明

### 环境变量详解

| 变量名 | 说明 | 默认值 | 是否必填 |
|--------|------|--------|----------|
| `POSTGRES_PASSWORD` | PostgreSQL 数据库密码 | - | ✅ 必填 |
| `FRONTEND_URL` | 前端访问地址，用于 CORS | http://localhost | ✅ 推荐修改 |
| `APP_URL` | 应用访问地址，用于邮件链接 | http://localhost | ✅ 推荐修改 |
| `SMTP_HOST` | SMTP 邮件服务器地址 | - | ❌ 可选 |
| `SMTP_PORT` | SMTP 端口 | 587 | ❌ 可选 |
| `SMTP_SECURE` | 是否使用 SSL | false | ❌ 可选 |
| `SMTP_USER` | SMTP 用户名 | - | ❌ 可选 |
| `SMTP_PASSWORD` | SMTP 密码 | - | ❌ 可选 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | - | ❌ 可选 |

### 端口配置

默认端口映射：
- **80** → 前端 Nginx
- **3000** → 后端 API（仅容器间通信）
- **5432** → PostgreSQL（仅容器间通信）

如果需要修改端口，编辑 `docker-compose.yml`:
```yaml
services:
  frontend:
    ports:
      - "8080:80"  # 修改前端端口为 8080
```

### 数据持久化

项目使用 Docker 数据卷持久化存储：

| 数据卷名 | 挂载路径 | 用途 |
|----------|----------|------|
| `postgres_data` | `/var/lib/postgresql/data` | 数据库文件 |
| `screenshot_data` | `/app/screenshots` | 截图文件 |

**备份数据卷**:
```bash
# 备份数据库
docker exec anita-postgres pg_dump -U postgres web_automation_checker > backup.sql

# 备份截图
docker cp anita-backend:/app/screenshots ./screenshots_backup
```

---

## 维护与管理

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs

# 实时查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# 查看最近 100 行日志
docker-compose logs --tail=100
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart backend
docker-compose restart frontend
```

### 停止和启动

```bash
# 停止所有服务（不删除容器）
docker-compose stop

# 启动已停止的服务
docker-compose start

# 完全停止并删除容器（数据卷不会删除）
docker-compose down

# 重新启动
docker-compose up -d
```

### 更新应用

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像
docker-compose build

# 3. 重启服务
docker-compose up -d

# 4. 清理旧镜像（可选）
docker image prune -f
```

### 扩容与优化

**调整浏览器池大小**:

编辑 `backend/src/automation/BrowserPool.ts`:
```typescript
private readonly poolSize = 10;  // 改为 10 个浏览器实例
```

重新构建：
```bash
docker-compose up -d --build backend
```

**增加容器资源限制**:

编辑 `docker-compose.yml`:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
```

### 监控

```bash
# 查看容器资源使用
docker stats

# 查看容器状态
docker-compose ps

# 健康检查
curl http://localhost:3000/api/health
```

---

## 故障排查

### 问题 1: 容器启动失败

**症状**: `docker-compose ps` 显示容器 "Exit" 状态

**排查步骤**:
```bash
# 查看容器日志
docker-compose logs backend

# 检查是否端口冲突
sudo lsof -i :80
sudo lsof -i :3000
sudo lsof -i :5432

# 重新启动
docker-compose down
docker-compose up -d
```

### 问题 2: 数据库连接失败

**症状**: 后端日志显示 "connection refused" 或 "database does not exist"

**解决方法**:
```bash
# 检查 PostgreSQL 是否健康
docker-compose ps postgres

# 查看 PostgreSQL 日志
docker-compose logs postgres

# 手动创建数据库（如果不存在）
docker exec -it anita-postgres psql -U postgres -c "CREATE DATABASE web_automation_checker;"

# 运行数据库迁移
docker exec -it anita-backend npm run migrate
```

### 问题 3: Playwright 浏览器启动失败

**症状**: 巡检任务执行失败，日志显示 "browser closed" 或 "timeout"

**解决方法**:
```bash
# 检查后端容器内存
docker stats anita-backend

# 如果内存不足，增加 Docker 内存限制
# 编辑 docker-compose.yml 增加内存限制

# 重新安装 Playwright 浏览器
docker exec -it anita-backend sh
npx playwright install chromium
exit

# 重启后端
docker-compose restart backend
```

### 问题 4: 截图无法显示

**症状**: 前端查看截图时显示 404 或图片加载失败

**排查步骤**:
```bash
# 检查截图目录权限
docker exec -it anita-backend ls -la /app/screenshots

# 检查 nginx 配置
docker exec -it anita-frontend cat /etc/nginx/conf.d/default.conf

# 测试截图 API
curl -I http://localhost:3000/screenshots/test.webp
```

### 问题 5: 前端无法访问后端 API

**症状**: 前端页面显示 "Network Error" 或 API 请求失败

**排查步骤**:
```bash
# 检查 nginx 反向代理
docker exec -it anita-frontend nginx -t

# 查看 nginx 日志
docker-compose logs frontend

# 测试后端 API
curl http://localhost:3000/api/v1/patrol/tasks

# 检查容器网络
docker network inspect anita-project_default
```

### 问题 6: 内存不足

**症状**: 系统卡顿，容器频繁重启

**解决方法**:
```bash
# 检查系统内存
free -h

# 减少浏览器池大小（见上文"扩容与优化"）

# 或者增加服务器内存

# 临时释放内存
echo 3 | sudo tee /proc/sys/vm/drop_caches
```

---

## 安全建议

### 1. 使用 HTTPS

在生产环境中，强烈建议使用 HTTPS。推荐使用 **Nginx + Let's Encrypt**:

```bash
# 安装 certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com

# 修改 docker-compose.yml 映射证书
services:
  frontend:
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
    ports:
      - "443:443"
```

### 2. 更改默认密码

确保修改 `.env` 中的 `POSTGRES_PASSWORD` 为强密码。

### 3. 防火墙配置

```bash
# 仅开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 4. 定期备份

设置定时任务备份数据库：
```bash
# 编辑 crontab
crontab -e

# 添加每日备份任务（凌晨 2 点）
0 2 * * * docker exec anita-postgres pg_dump -U postgres web_automation_checker > /backup/anita_$(date +\%Y\%m\%d).sql
```

---

## 常见问题 FAQ

**Q: 如何修改前端访问端口？**

A: 编辑 `docker-compose.yml`，将 `frontend` 的 `ports` 从 `"80:80"` 改为 `"8080:80"`。

**Q: 如何使用外部 PostgreSQL 数据库？**

A: 删除 `docker-compose.yml` 中的 `postgres` 服务，修改 `backend` 的 `DATABASE_URL` 指向外部数据库。

**Q: 如何扩展到多台服务器？**

A: 可以使用 Docker Swarm 或 Kubernetes 进行容器编排。需要将数据库和文件存储改为外部服务（如 RDS + S3）。

**Q: 如何查看应用版本？**

A: 访问 `http://your-domain.com/api/health`，响应中包含版本信息。

---

## 技术支持

如有问题，请：
1. 查看本文档的 [故障排查](#故障排查) 章节
2. 查看容器日志：`docker-compose logs`
3. 提交 Issue 到项目仓库

---

## 附录

### 完整部署命令清单

```bash
# 1. 安装 Docker (Ubuntu)
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin

# 2. 克隆项目
cd /opt
git clone <repo-url> anita-project
cd anita-project

# 3. 配置环境
cp .env.production .env
nano .env  # 修改 POSTGRES_PASSWORD 等配置

# 4. 启动服务
docker-compose up -d

# 5. 查看状态
docker-compose ps
docker-compose logs -f

# 6. 访问应用
# http://your-server-ip
```

### 项目目录结构

```
anita-project/
├── backend/                 # 后端代码
│   ├── src/
│   ├── Dockerfile          # 后端 Docker 配置
│   └── package.json
├── frontend/               # 前端代码
│   ├── src/
│   ├── Dockerfile         # 前端 Docker 配置
│   ├── nginx.conf         # Nginx 配置
│   └── package.json
├── docker-compose.yml     # Docker Compose 编排文件
├── .env.production        # 生产环境配置模板
├── DEPLOYMENT.md          # 本文档
└── README.md              # 项目说明
```

---

**祝部署顺利！** 🚀
