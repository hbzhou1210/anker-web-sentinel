# 响应式截图 - 非 Docker 生产环境部署指南

## 问题背景

生产环境 http://172.16.38.135:10001 使用的是**直接部署**(非 Docker),响应式测试的截图无法显示。

## 根本原因

Nginx 配置将 `/screenshots` 请求代理到后端,但后端没有实现该路由,导致 404。

## ✅ 本地环境已更新

为了保证**本地环境和生产环境一致**,以下配置已同步修改:

1. **[frontend/nginx.conf](frontend/nginx.conf:34-52)** - 截图静态文件配置(已修改)
2. **[docker-compose.yml](docker-compose.yml:127-128)** - Frontend 容器挂载截图目录(已添加)

现在本地 Docker 环境的配置与生产环境保持一致,可以在本地提前发现问题!

## 解决方案 (不重启服务)

### 方式一:仅修改 Nginx 配置(推荐)

生产环境 Nginx 配置文件通常在:
- `/etc/nginx/sites-available/anita-project`
- `/etc/nginx/conf.d/anita-project.conf`
- `/etc/nginx/nginx.conf`

#### 1. 登录生产服务器

```bash
ssh user@172.16.38.135
```

#### 2. 查找当前 Nginx 配置文件

```bash
# 查看 Nginx 配置
sudo nginx -T 2>&1 | grep -A 20 "server_name"

# 或查找配置文件
sudo grep -r "10001" /etc/nginx/
```

#### 3. 备份现有配置

```bash
# 假设配置文件是 /etc/nginx/sites-available/anita-project
sudo cp /etc/nginx/sites-available/anita-project /etc/nginx/sites-available/anita-project.backup.$(date +%Y%m%d)
```

#### 4. 修改 Nginx 配置

找到类似这样的配置块:

```nginx
# 截图静态文件代理到后端 (旧配置 - 需要修改)
location /screenshots {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

**修改为**:

```nginx
# 截图静态文件服务 (新配置)
location /screenshots/ {
    alias /tmp/screenshots/;
    expires 7d;
    add_header Cache-Control "public, immutable";
    access_log off;

    # 限速 10MB/s,避免大量截图占用带宽
    limit_rate 10m;

    # 只允许 GET 和 HEAD 请求
    limit_except GET HEAD {
        deny all;
    }

    # 自动添加 Content-Type
    types {
        image/webp webp;
    }
}
```

#### 5. 验证配置语法

```bash
sudo nginx -t
```

期望输出:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

#### 6. 重新加载 Nginx (不中断服务)

```bash
# 平滑重载配置,不中断现有连接
sudo nginx -s reload

# 或使用 systemctl
sudo systemctl reload nginx
```

#### 7. 验证修复

```bash
# 测试截图访问 (使用真实的截图文件名)
curl -I http://172.16.38.135:10001/screenshots/test.webp

# 期望输出: HTTP/1.1 200 OK (或 404 如果文件不存在)
# 不应该是 502 Bad Gateway
```

### 方式二:后端添加静态文件服务(需要重启后端)

如果不想修改 Nginx,可以让后端处理 `/screenshots` 请求。

#### 1. 检查后端配置

查看 `backend/src/app.ts` 是否已有静态文件服务:

```typescript
// 添加截图静态文件服务
app.use('/screenshots', express.static(
  process.env.SCREENSHOT_DIR || '/tmp/screenshots',
  {
    maxAge: '7d',
    immutable: true,
  }
));
```

#### 2. 如果没有,需要添加并重启后端

```bash
# 在生产服务器上
cd /path/to/anita-project/backend

# 重启后端服务
pm2 restart anita-backend
# 或
sudo systemctl restart anita-backend
```

## 检查清单

### 🔍 部署前检查

- [ ] 确认生产环境是否使用 Docker
- [ ] 确认截图保存目录路径 (`/tmp/screenshots` 或其他)
- [ ] 确认 Nginx 配置文件位置
- [ ] 备份现有 Nginx 配置

### ✅ 部署步骤

- [ ] 修改 Nginx 配置(将 proxy 改为 alias)
- [ ] 验证 Nginx 配置语法 (`nginx -t`)
- [ ] 重新加载 Nginx (`nginx -s reload`)
- [ ] 测试截图访问 (curl 测试)
- [ ] Web UI 功能测试

### 📊 验证测试

- [ ] 访问 http://172.16.38.135:10001/tools/responsive
- [ ] 提交一个测试任务
- [ ] 等待测试完成
- [ ] 确认截图正常显示

## 常见问题

### Q1: 找不到 Nginx 配置文件

```bash
# 查看 Nginx 主配置
sudo nginx -T | less

# 查找包含 10001 端口的配置
sudo nginx -T | grep -B 10 -A 10 "10001"

# 查找所有 Nginx 配置文件
sudo find /etc/nginx -name "*.conf"
```

### Q2: 截图目录权限问题

```bash
# 确保 Nginx 用户有读取权限
sudo ls -la /tmp/screenshots/

# 如果权限不足,修改权限
sudo chmod -R 755 /tmp/screenshots/
sudo chown -R www-data:www-data /tmp/screenshots/
```

### Q3: Nginx reload 失败

```bash
# 查看错误日志
sudo tail -f /var/log/nginx/error.log

# 如果 reload 失败,需要重启
sudo systemctl restart nginx
```

### Q4: 生产环境截图目录不是 /tmp/screenshots

```bash
# 查看后端环境变量
ps aux | grep node | grep backend

# 或查看后端进程
pm2 show anita-backend

# 或查看 systemd 配置
sudo cat /etc/systemd/system/anita-backend.service
```

找到 `SCREENSHOT_DIR` 环境变量的实际值,然后在 Nginx 配置中使用该路径。

## 回滚方案

如果新配置有问题:

```bash
# 恢复备份
sudo cp /etc/nginx/sites-available/anita-project.backup.YYYYMMDD /etc/nginx/sites-available/anita-project

# 重新加载
sudo nginx -s reload
```

## 配置模板

### 完整的 Nginx Server 块示例

```nginx
server {
    listen 10001;
    server_name _;
    root /var/www/anita-project/frontend/dist;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 代理到后端
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # ⭐ 截图静态文件服务 (关键配置)
    location /screenshots/ {
        alias /tmp/screenshots/;
        expires 7d;
        add_header Cache-Control "public, immutable";
        access_log off;
        limit_rate 10m;
        limit_except GET HEAD {
            deny all;
        }
        types {
            image/webp webp;
        }
    }

    # SPA 路由处理
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

## 部署命令总结

```bash
# 一键部署(在生产服务器上执行)
# 1. 备份配置
sudo cp /etc/nginx/sites-available/anita-project /etc/nginx/sites-available/anita-project.backup.$(date +%Y%m%d)

# 2. 编辑配置
sudo vim /etc/nginx/sites-available/anita-project
# 将 location /screenshots 的 proxy_pass 改为 alias

# 3. 测试配置
sudo nginx -t

# 4. 重新加载
sudo nginx -s reload

# 5. 验证
curl -I http://172.16.38.135:10001/screenshots/test.webp
```

## 监控和维护

### 磁盘空间监控

```bash
# 查看截图目录大小
du -sh /tmp/screenshots/

# 查看文件数量
find /tmp/screenshots/ -type f | wc -l
```

### 自动清理(可选)

添加 cron 任务定期清理旧截图:

```bash
# 编辑 crontab
sudo crontab -e

# 添加每天凌晨 2 点清理 7 天前的截图
0 2 * * * find /tmp/screenshots/ -name "*.webp" -mtime +7 -delete
```

## 技术支持

- 本地配置文件: [frontend/nginx.conf](frontend/nginx.conf:33-52)
- 部署脚本: [scripts/deploy-production.sh](scripts/deploy-production.sh)
- 后端截图服务: [backend/src/automation/ScreenshotService.ts](backend/src/automation/ScreenshotService.ts)

---

**文档版本**: v1.0
**更新时间**: 2025-12-30
**适用环境**: 非 Docker 直接部署
