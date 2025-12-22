# 部署到服务器指南 (172.16.19.71)

**服务器信息**:
- IP: 172.16.19.71
- 用户: op
- 密码: mko0(IJN@

---

## 方式 1: 手动 SSH 连接部署 (推荐)

### 步骤 1: 连接到服务器

打开终端,输入:

```bash
ssh op@172.16.19.71
```

输入密码: `mko0(IJN@`

### 步骤 2: 检查服务器环境

连接成功后,检查是否安装了 Docker:

```bash
# 检查 Docker
docker --version

# 检查 Docker Compose
docker-compose --version

# 如果未安装,需要先安装 Docker
```

**如果 Docker 未安装**,执行:

```bash
# CentOS/RHEL
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# 或 Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
```

### 步骤 3: 创建部署目录

```bash
# 创建项目目录
sudo mkdir -p /opt/anker-web-sentinel
sudo chown op:op /opt/anker-web-sentinel
cd /opt/anker-web-sentinel
```

### 步骤 4: 克隆代码

```bash
# 如果服务器能访问 coding
git clone http://e.coding.anker-in.com/codingcorp/dtc_it/anker-web-sentinel.git .

# 或者输入 Git 账号密码后克隆
```

**如果服务器无法访问 coding**,参考方式 2 从本地上传。

### 步骤 5: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vi .env
# 或
nano .env
```

**关键配置项**:

```bash
# 数据库配置
DB_HOST=postgres
DB_PORT=5432
DB_USER=sentinel
DB_PASSWORD=your_secure_password_here  # 修改为强密码
DB_NAME=anker_web_sentinel

# Redis 配置
REDIS_URL=redis://redis:6379

# 应用配置
NODE_ENV=production
PORT=3000
APP_URL=http://172.16.19.71:10038  # 修改为实际访问地址

# 浏览器池配置 (生产环境推荐)
BROWSER_POOL_SIZE=3
MIN_BROWSER_POOL_SIZE=2
MAX_BROWSER_POOL_SIZE=5

# 并发配置 (UI 自动化场景推荐串行)
MAX_CONCURRENT_URLS=1

# 邮件配置 (如果需要)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=Web Sentinel <noreply@example.com>

# 飞书配置 (如果需要)
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_IMAGE_STORAGE_FOLDER_TOKEN=your_folder_token
```

### 步骤 6: 检查 Docker Compose 配置

查看 `docker-compose.yml`:

```bash
cat docker-compose.yml
```

确认配置正确,特别是:
- 端口映射: `10038:5173` (前端) 和 `3000:3000` (后端)
- 共享内存: `shm_size: '512mb'` (推荐 2GB: `shm_size: '2gb'`)
- 数据持久化: volumes 配置

**建议修改** (如果需要):

```bash
vi docker-compose.yml
```

修改 `shm_size` 为 2GB:

```yaml
services:
  backend:
    shm_size: '2gb'  # 从 512mb 改为 2gb
```

### 步骤 7: 构建和启动服务

```bash
# 构建镜像并启动服务
docker-compose up -d --build

# 查看启动日志
docker-compose logs -f

# 按 Ctrl+C 退出日志查看
```

### 步骤 8: 验证部署

```bash
# 检查容器状态
docker-compose ps

# 应该看到类似:
# NAME                    STATUS          PORTS
# backend                 Up 2 minutes    0.0.0.0:3000->3000/tcp
# frontend                Up 2 minutes    0.0.0.0:10038->5173/tcp
# postgres                Up 2 minutes    5432/tcp
# redis                   Up 2 minutes    6379/tcp

# 检查后端健康状态
curl http://localhost:3000/api/v1/system/health

# 检查前端
curl http://localhost:10038
```

### 步骤 9: 访问应用

在浏览器打开:
```
http://172.16.19.71:10038
```

---

## 方式 2: 从本地上传部署包

如果服务器无法访问 Git,可以从本地上传:

### 步骤 1: 在本地打包

在你的 Mac 上执行:

```bash
cd /Users/anker/anita-project

# 打包项目 (排除 node_modules 和 .git)
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='screenshots' \
    -czf anker-web-sentinel.tar.gz .

# 查看打包大小
ls -lh anker-web-sentinel.tar.gz
```

### 步骤 2: 上传到服务器

```bash
# 使用 scp 上传
scp anker-web-sentinel.tar.gz op@172.16.19.71:/tmp/

# 输入密码: mko0(IJN@
```

### 步骤 3: SSH 到服务器解压

```bash
# 连接服务器
ssh op@172.16.19.71

# 创建目录
sudo mkdir -p /opt/anker-web-sentinel
sudo chown op:op /opt/anker-web-sentinel
cd /opt/anker-web-sentinel

# 解压
tar -xzf /tmp/anker-web-sentinel.tar.gz

# 删除临时文件
rm /tmp/anker-web-sentinel.tar.gz
```

### 步骤 4: 继续从方式 1 的步骤 5 开始

按照方式 1 的步骤 5-9 完成部署。

---

## 方式 3: 使用自动化部署脚本

我可以为你生成一个自动化部署脚本 `deploy.sh`,包含:
- 自动连接服务器
- 自动拉取代码
- 自动构建和启动

**是否需要生成自动化脚本?**

---

## 常用运维命令

在服务器上,项目目录 `/opt/anker-web-sentinel`:

```bash
# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新代码并重新部署
git pull
docker-compose up -d --build

# 查看资源使用
docker stats

# 查看浏览器池状态
curl http://localhost:3000/api/v1/monitor/browser-pool

# 查看队列状态
curl http://localhost:3000/api/v1/system/queue-status

# 进入容器调试
docker-compose exec backend sh
docker-compose exec frontend sh

# 查看数据库
docker-compose exec postgres psql -U sentinel -d anker_web_sentinel
```

---

## 故障排查

### 问题 1: 容器启动失败

```bash
# 查看详细日志
docker-compose logs backend

# 常见原因:
# - 环境变量配置错误
# - 数据库连接失败
# - 端口被占用
```

### 问题 2: 浏览器崩溃 (Target crashed)

**解决方案**: 参考 `TARGET_CRASHED_FIX.md`

```bash
# 在 .env 中设置
MAX_CONCURRENT_URLS=1

# 在 docker-compose.yml 中增加共享内存
shm_size: '2gb'

# 重新部署
docker-compose down
docker-compose up -d --build
```

### 问题 3: 前端无法访问后端 API

```bash
# 检查后端是否启动
curl http://localhost:3000/api/v1/system/health

# 检查防火墙
sudo firewall-cmd --list-ports
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=10038/tcp
sudo firewall-cmd --reload
```

### 问题 4: 数据库初始化失败

```bash
# 手动初始化数据库
docker-compose exec backend npm run migrate

# 或重建数据库
docker-compose down -v
docker-compose up -d
```

---

## 生产环境建议配置

### 环境变量 (.env)

```bash
# 并发控制 (避免崩溃)
MAX_CONCURRENT_URLS=1

# 浏览器池 (适度配置)
BROWSER_POOL_SIZE=3
MIN_BROWSER_POOL_SIZE=2
MAX_BROWSER_POOL_SIZE=5

# 健康检查 (更频繁)
HEALTH_CHECK_INTERVAL=30000

# 浏览器老化 (防止内存泄漏)
MAX_BROWSER_AGE=1800000
MAX_BROWSER_USAGE=30
```

### Docker Compose 配置

```yaml
services:
  backend:
    # 增加共享内存
    shm_size: '2gb'

    # 资源限制 (可选)
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2'

    # 重启策略
    restart: unless-stopped
```

---

## 监控和日志

### 日志查看

```bash
# 实时查看所有日志
docker-compose logs -f

# 查看最近 100 行
docker-compose logs --tail=100

# 查看特定服务
docker-compose logs -f backend

# 导出日志
docker-compose logs > /tmp/sentinel-logs.txt
```

### 性能监控

```bash
# 系统资源
htop
# 或
top

# Docker 容器资源
docker stats

# 磁盘使用
df -h

# 内存使用
free -h
```

---

## 下一步

1. **立即操作**: SSH 连接服务器,按步骤 1-9 部署
2. **验证功能**: 访问 http://172.16.19.71:10038 测试
3. **配置定时巡检**: 创建巡检任务和定时计划
4. **监控运行**: 定期查看日志和浏览器池状态

**需要我帮助的话,随时告诉我!**
