# Anita 项目 - Coding 平台部署指南

本文档详细说明如何使用 **Coding（腾讯云开发者平台）+ 腾讯云服务器** 部署 Anita 项目。

---

## 📋 部署架构

```
本地开发
   ↓ git push
Coding 代码仓库
   ↓ 触发 CI/CD
自动构建 & 测试
   ↓ SSH 部署
腾讯云服务器 (CVM)
   ↓ Docker 容器运行
用户访问应用
```

---

## 🎯 准备工作

### 1. 需要的资源

| 资源 | 说明 | 获取方式 |
|------|------|----------|
| **Coding 账号** | 代码托管和 CI/CD | [https://coding.net](https://coding.net) 注册 |
| **腾讯云服务器** | 运行应用 | [https://cloud.tencent.com](https://cloud.tencent.com) 购买 CVM |
| **域名**（可选） | 访问应用 | 腾讯云/阿里云购买 |

### 2. 服务器配置要求

- **CPU**: 4 核及以上
- **内存**: 8GB 及以上（推荐）
- **磁盘**: 50GB SSD
- **操作系统**: Ubuntu 20.04 或 CentOS 7.6
- **带宽**: 5Mbps 及以上

**推荐配置**：腾讯云 CVM 标准型 S5.MEDIUM8（4核8GB）约 ¥200/月

---

## 📝 部署步骤

### 步骤 1: 创建 Coding 项目

#### 1.1 创建代码仓库

1. 登录 [Coding](https://coding.net)
2. 进入你的团队：`http://codingcorp.coding.anker-in.com/p/dtc_it`
3. 点击 **「创建仓库」**
4. 填写信息：
   - **仓库名称**: `anita-project`
   - **描述**: Web 自动化巡检工具
   - **可见性**: 私有
5. 点击 **「创建」**

#### 1.2 推送代码到 Coding

```bash
# 在项目目录下
cd /Users/anker/anita-project

# 添加 Coding 远程仓库
git remote add coding https://codingcorp.coding.anker-in.com/p/dtc_it/repos/anita-project.git

# 或者如果已有 origin，可以替换
git remote set-url origin https://codingcorp.coding.anker-in.com/p/dtc_it/repos/anita-project.git

# 推送代码
git add .
git commit -m "Initial commit: Add deployment config"
git push -u coding main

# 如果分支名是 master
git push -u coding master
```

### 步骤 2: 购买并配置腾讯云服务器

#### 2.1 购买 CVM

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com)
2. 选择 **「云服务器 CVM」** → **「实例」** → **「新建」**
3. 选择配置：
   - **计费模式**: 按量计费 或 包年包月
   - **地域**: 选择离用户最近的地域（如：北京、上海）
   - **实例**: 标准型 S5 / 4核8GB
   - **镜像**: Ubuntu Server 20.04 LTS 64位
   - **系统盘**: 50GB SSD 云硬盘
   - **带宽**: 5Mbps
4. 设置 **安全组**：
   - 放行端口 22 (SSH)
   - 放行端口 80 (HTTP)
   - 放行端口 443 (HTTPS，如果需要）
5. 设置登录密码
6. 点击 **「立即购买」**

#### 2.2 连接服务器

**方式 1: 使用 SSH 客户端**
```bash
ssh ubuntu@your-server-ip
# 或
ssh root@your-server-ip
```

**方式 2: 腾讯云控制台 VNC**
- 在 CVM 实例列表中，点击 **「登录」** → **「标准登录」**

#### 2.3 安装 Docker

```bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 添加 Docker APT 仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
docker compose version
```

#### 2.4 克隆项目到服务器

```bash
# 安装 Git（如果没有）
sudo apt-get install -y git

# 创建项目目录
sudo mkdir -p /opt/anita-project
sudo chown $USER:$USER /opt/anita-project

# 克隆代码（需要输入 Coding 账号密码）
cd /opt
git clone https://codingcorp.coding.anker-in.com/p/dtc_it/repos/anita-project.git

# 进入项目目录
cd anita-project
```

#### 2.5 配置环境变量

```bash
# 复制环境变量模板
cp .env.production .env

# 编辑配置
nano .env
```

**必须修改**：
```bash
# 数据库密码（修改为强密码！）
POSTGRES_PASSWORD=your_secure_password_here

# 前端访问地址（修改为服务器公网IP或域名）
FRONTEND_URL=http://your-server-ip
APP_URL=http://your-server-ip
```

按 `Ctrl+X`，然后 `Y`，最后 `Enter` 保存。

#### 2.6 启动应用

```bash
# 构建并启动
docker compose up -d

# 查看启动状态
docker compose ps

# 查看日志
docker compose logs -f
```

等待 1-2 分钟，所有服务启动完成。

#### 2.7 验证部署

在浏览器中访问：
```
http://your-server-ip
```

你应该能看到 Anita 的前端界面。

### 步骤 3: 配置 Coding CI/CD 自动部署

#### 3.1 启用持续集成

1. 在 Coding 项目中，点击左侧菜单 **「持续集成」** → **「构建计划」**
2. 点击 **「创建构建计划」**
3. 选择 **「自定义构建过程」**
4. 构建计划配置会自动读取项目根目录的 `.coding-ci.yml` 文件

#### 3.2 配置环境变量

在 Coding 项目中：
1. 点击 **「项目设置」** → **「开发者选项」** → **「环境变量」**
2. 添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `SERVER_HOST` | 你的服务器IP | 如: `123.456.78.90` |
| `SERVER_PORT` | `22` | SSH 端口 |
| `SERVER_USER` | `ubuntu` 或 `root` | SSH 用户名 |
| `SERVER_PASSWORD` | 你的SSH密码 | **设为保密变量** |

**注意**: 勾选 `SERVER_PASSWORD` 的 **「保密」** 选项！

#### 3.3 测试自动部署

```bash
# 在本地修改代码
echo "# Test CI/CD" >> README.md

# 提交并推送
git add .
git commit -m "test: CI/CD auto deploy"
git push coding main
```

然后：
1. 在 Coding 的 **「持续集成」** 页面查看构建状态
2. 构建成功后，应用会自动部署到服务器
3. 刷新浏览器查看更新

### 步骤 4: 配置域名（可选）

#### 4.1 购买域名

在 [腾讯云域名注册](https://dnspod.cloud.tencent.com) 购买域名，如：`anita.example.com`

#### 4.2 添加 DNS 解析

1. 进入 **「域名管理」** → **「解析」**
2. 添加记录：
   - **主机记录**: `@` 或 `anita`
   - **记录类型**: `A`
   - **记录值**: 你的服务器公网IP
   - **TTL**: `600`
3. 保存

等待 5-10 分钟 DNS 生效。

#### 4.3 配置 HTTPS（推荐）

```bash
# 在服务器上安装 certbot
sudo apt-get install -y certbot

# 停止 Anita 服务（占用 80 端口）
cd /opt/anita-project
docker compose down

# 获取 SSL 证书
sudo certbot certonly --standalone -d anita.example.com

# 证书路径: /etc/letsencrypt/live/anita.example.com/

# 修改 docker-compose.yml
nano docker-compose.yml
```

在 `frontend` 服务中添加：
```yaml
services:
  frontend:
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
    ports:
      - "80:80"
      - "443:443"
```

修改 `frontend/nginx.conf`，添加 HTTPS 配置：
```nginx
server {
    listen 80;
    server_name anita.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name anita.example.com;

    ssl_certificate /etc/letsencrypt/live/anita.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/anita.example.com/privkey.pem;

    # ... 其他配置保持不变
}
```

重新启动：
```bash
docker compose up -d --build
```

现在可以通过 `https://anita.example.com` 访问应用。

---

## 🔧 日常维护

### 查看应用状态

```bash
# SSH 登录服务器
ssh ubuntu@your-server-ip

# 查看容器状态
cd /opt/anita-project
docker compose ps

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend
```

### 手动更新应用

```bash
# SSH 登录服务器
ssh ubuntu@your-server-ip

# 拉取最新代码
cd /opt/anita-project
git pull origin main

# 重新构建和部署
docker compose up -d --build

# 清理旧镜像
docker image prune -f
```

### 备份数据

```bash
# 备份数据库
docker exec anita-postgres pg_dump -U postgres web_automation_checker > backup_$(date +%Y%m%d).sql

# 下载到本地
scp ubuntu@your-server-ip:/opt/anita-project/backup_*.sql ./
```

### 恢复数据

```bash
# 上传备份文件到服务器
scp backup_20240101.sql ubuntu@your-server-ip:/opt/anita-project/

# 恢复数据库
docker exec -i anita-postgres psql -U postgres web_automation_checker < backup_20240101.sql
```

---

## 🚨 故障排查

### 问题 1: git clone 失败，提示认证失败

**解决方法**：
```bash
# 方式 1: 使用 HTTPS 带凭证
git clone https://your-username:your-token@codingcorp.coding.anker-in.com/p/dtc_it/repos/anita-project.git

# 方式 2: 配置 SSH 密钥
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
cat ~/.ssh/id_rsa.pub
# 复制输出，添加到 Coding 的「账户设置」→「SSH 公钥」
```

### 问题 2: CI/CD 部署失败，SSH 连接超时

**排查步骤**：
1. 检查服务器安全组是否放行 22 端口
2. 检查服务器 SSH 服务是否运行：`sudo systemctl status sshd`
3. 检查 Coding 环境变量中的 `SERVER_HOST`、`SERVER_USER`、`SERVER_PASSWORD` 是否正确

### 问题 3: 应用无法访问

**排查步骤**：
```bash
# 检查容器状态
docker compose ps

# 检查端口占用
sudo lsof -i :80
sudo lsof -i :3000

# 检查防火墙
sudo ufw status
sudo ufw allow 80/tcp

# 查看日志
docker compose logs
```

### 问题 4: 内存不足

**症状**: 容器频繁重启，系统卡顿

**解决方法**：
```bash
# 查看内存使用
free -h
docker stats

# 临时方案: 减少浏览器池大小
# 编辑 backend/src/automation/BrowserPool.ts
# 将 poolSize 从 5 改为 3

# 长期方案: 升级服务器配置
```

---

## 💰 成本估算

### 腾讯云 CVM（按月计费）

| 配置 | 价格 | 适用场景 |
|------|------|----------|
| 2核4GB | ~¥100/月 | 测试环境 |
| 4核8GB | ~¥200/月 | 小型生产环境（推荐） |
| 8核16GB | ~¥400/月 | 大型生产环境 |

### 其他费用

- **域名**: ¥50-100/年
- **SSL 证书**: 免费（Let's Encrypt）
- **带宽**: 按流量计费，约 ¥0.8/GB

**总计**: 约 ¥200-500/月

---

## 📚 相关链接

- [Coding 文档](https://coding.net/help/docs)
- [腾讯云 CVM 文档](https://cloud.tencent.com/document/product/213)
- [Docker 官方文档](https://docs.docker.com/)
- [Let's Encrypt](https://letsencrypt.org/)

---

## 🎯 快速命令清单

```bash
# === 服务器初始化 ===
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git
sudo systemctl start docker && sudo systemctl enable docker

# === 部署应用 ===
cd /opt
git clone https://codingcorp.coding.anker-in.com/p/dtc_it/repos/anita-project.git
cd anita-project
cp .env.production .env
nano .env  # 修改配置
docker compose up -d

# === 查看状态 ===
docker compose ps
docker compose logs -f

# === 更新应用 ===
git pull origin main
docker compose up -d --build
docker image prune -f

# === 备份数据 ===
docker exec anita-postgres pg_dump -U postgres web_automation_checker > backup.sql

# === 重启服务 ===
docker compose restart
```

---

**祝部署顺利！如有问题，请查看故障排查章节或联系技术支持。** 🚀
