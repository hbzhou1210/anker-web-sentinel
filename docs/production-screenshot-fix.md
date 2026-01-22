# 生产环境截图显示问题 - 解决方案

## 问题描述

生产环境 (http://172.16.38.135:10001) 中响应式测试工具完成测试后，截图无法正常显示。

## 根本原因

1. **前端在生产环境使用相对路径访问截图**：`/screenshots/xxx.webp`
2. **Nginx (10001端口) 未配置 `/screenshots` 路径的代理规则**
3. **请求未转发到后端服务 (3000端口)**，导致404错误

## 解决方案

### 方案A：Nginx 反向代理配置（推荐）

在Nginx配置文件中添加截图路径的代理规则。

#### 1. 找到Nginx配置文件

```bash
# 查找主配置文件
nginx -t

# 通常在以下位置之一：
# - /etc/nginx/nginx.conf
# - /etc/nginx/conf.d/default.conf
# - /etc/nginx/sites-enabled/anita-project
```

#### 2. 添加代理配置

在 `server` 块中添加：

```nginx
server {
    listen 10001;
    server_name 172.16.38.135;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 请求代理到后端
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ⭐ 截图文件代理到后端 - 添加此配置
    location /screenshots/ {
        proxy_pass http://localhost:3000/screenshots/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # 截图缓存优化
        proxy_cache_valid 200 7d;
        proxy_cache_bypass $http_cache_control;
        add_header Cache-Control "public, max-age=604800";
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

#### 3. 测试并重启Nginx

```bash
# 测试配置是否正确
sudo nginx -t

# 如果测试通过，重新加载配置
sudo nginx -s reload

# 或者重启Nginx
sudo systemctl restart nginx
```

#### 4. 验证修复

```bash
# 测试截图URL是否可访问
curl -I http://172.16.38.135:10001/screenshots/test.webp

# 应该返回 200 或 404（而不是502）
```

### 方案B：Docker Compose 配置（如果使用Docker）

如果使用Docker Compose，确保Nginx容器可以访问后端容器：

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    volumes:
      - screenshots:/tmp/screenshots  # 持久化截图
    environment:
      - SCREENSHOT_DIR=/tmp/screenshots

  nginx:
    image: nginx:alpine
    ports:
      - "10001:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./frontend/dist:/usr/share/nginx/html
    depends_on:
      - backend

volumes:
  screenshots:  # 使用命名卷而不是临时目录
```

对应的 `nginx.conf`:

```nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
    }

    # 截图代理
    location /screenshots/ {
        proxy_pass http://backend:3000/screenshots/;
        proxy_set_header Host $host;
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
```

### 方案C：使用持久化存储（避免容器重启丢失）

修改 `backend/src/api/middleware/staticFiles.ts`：

```typescript
// 使用持久化目录而不是 /tmp
const screenshotDir = process.env.SCREENSHOT_DIR || '/app/data/screenshots';
```

在Docker中挂载持久卷：

```yaml
services:
  backend:
    volumes:
      - ./data/screenshots:/app/data/screenshots
    environment:
      - SCREENSHOT_DIR=/app/data/screenshots
```

## 快速诊断脚本

使用项目提供的诊断脚本：

```bash
cd /path/to/anita-project

# 本地测试
./scripts/diagnose-screenshots.sh

# 或在生产服务器
scp scripts/diagnose-screenshots.sh user@172.16.38.135:/tmp/
ssh user@172.16.38.135 "bash /tmp/diagnose-screenshots.sh"
```

脚本会自动检测：
- ✅ 截图目录是否存在
- ✅ 文件权限是否正确
- ✅ 后端服务是否正常
- ✅ Nginx配置是否完整
- ✅ 截图文件是否可访问

## 验证步骤

### 1. 检查后端服务

```bash
# 检查后端健康状态
curl http://172.16.38.135:3000/health

# 直接访问后端截图（如果有已知文件）
curl -I http://172.16.38.135:3000/screenshots/test.webp
```

### 2. 检查前端访问

```bash
# 通过Nginx访问截图（应该转发到后端）
curl -I http://172.16.38.135:10001/screenshots/test.webp
```

### 3. 浏览器测试

1. 打开开发者工具 (F12)
2. 进入 Network 标签
3. 运行响应式测试
4. 查看截图请求：
   - ❌ 如果返回 **404**：Nginx未正确代理
   - ❌ 如果返回 **502/503**：后端服务未运行
   - ✅ 如果返回 **200**：问题已解决

## 常见问题

### Q1: Nginx配置后仍然404

**检查**：
```bash
# 确认Nginx进程已重新加载
ps aux | grep nginx

# 检查Nginx错误日志
tail -f /var/log/nginx/error.log
```

**可能原因**：
- Nginx未重启/重新加载
- 配置文件路径错误
- 后端服务未启动

### Q2: 截图文件在容器重启后丢失

**原因**：使用了 `/tmp` 目录（容器重启会清空）

**解决**：
1. 使用Docker卷挂载持久化目录
2. 设置环境变量 `SCREENSHOT_DIR=/app/data/screenshots`
3. 确保目录有写权限：`chmod 755 /app/data/screenshots`

### Q3: 权限被拒绝 (403 Forbidden)

**检查**：
```bash
# 检查目录权限
ls -la /tmp/screenshots

# 修复权限
chmod 755 /tmp/screenshots
chmod 644 /tmp/screenshots/*.webp
```

## 推荐生产环境配置

```bash
# 1. 创建持久化截图目录
sudo mkdir -p /var/lib/anita-screenshots
sudo chown -R www-data:www-data /var/lib/anita-screenshots
sudo chmod 755 /var/lib/anita-screenshots

# 2. 设置环境变量
echo "SCREENSHOT_DIR=/var/lib/anita-screenshots" >> /etc/environment

# 3. 添加Nginx配置
sudo nano /etc/nginx/conf.d/anita-project.conf

# 4. 重启服务
sudo systemctl restart backend
sudo systemctl restart nginx

# 5. 验证
curl -I http://172.16.38.135:10001/screenshots/test.webp
```

## 监控和日志

### 查看后端日志

```bash
# 如果使用PM2
pm2 logs backend

# 如果使用systemd
journalctl -u backend -f

# 如果使用Docker
docker logs -f backend-container
```

### 查看Nginx访问日志

```bash
tail -f /var/log/nginx/access.log | grep screenshots
```

### 查看截图文件列表

```bash
ls -lh /tmp/screenshots/ | head -20
```

## 总结

**核心问题**：生产环境Nginx未配置 `/screenshots` 路径的反向代理

**最简单的解决方案**：
1. 在Nginx配置中添加 `location /screenshots/` 代理规则
2. 将请求转发到 `http://localhost:3000/screenshots/`
3. 重启Nginx

**预计修复时间**：5-10分钟

---

**相关文件**：
- 后端静态文件配置：`backend/src/api/middleware/staticFiles.ts`
- 截图服务：`backend/src/automation/ScreenshotService.ts`
- 前端URL构建：`frontend/src/services/api.ts`
- 诊断脚本：`scripts/diagnose-screenshots.sh`
