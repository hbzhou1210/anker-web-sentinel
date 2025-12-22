# Nginx 端口号丢失问题修复

## 问题描述

**现象**: 邮件报告链接缺少端口号
- 预期: `http://172.16.38.135:10001/report/xxx`
- 实际: `http://172.16.38.135/report/xxx` ❌ (404错误)

**根本原因**:
Nginx 反向代理转发请求时，没有正确传递原始请求的端口号信息。

---

## 解决方案

### 方案 1: Nginx 配置传递端口号 (推荐) ⭐

修改 Nginx 配置文件，确保转发原始的 Host 和端口信息：

```nginx
server {
    listen 10001;
    server_name 172.16.38.135;

    location / {
        proxy_pass http://localhost:3000;

        # 🔧 关键配置: 传递原始 Host (包含端口)
        proxy_set_header Host $host:$server_port;

        # 或者使用以下配置,分别传递 Host 和端口
        # proxy_set_header Host $host;
        # proxy_set_header X-Forwarded-Host $host:$server_port;
        # proxy_set_header X-Forwarded-Port $server_port;

        # 传递协议信息
        proxy_set_header X-Forwarded-Proto $scheme;

        # 传递真实客户端 IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**配置说明**:
- `$host`: 请求的主机名 (如 `172.16.38.135`)
- `$server_port`: Nginx 监听的端口 (如 `10001`)
- `$host:$server_port`: 完整的 Host (如 `172.16.38.135:10001`)

**重启 Nginx**:
```bash
sudo nginx -t  # 测试配置
sudo systemctl reload nginx  # 重新加载配置
```

---

### 方案 2: 代码自动补齐端口号 (已实现)

如果无法修改 Nginx 配置，代码已经实现了自动检测和补齐端口号：

**文件**: `backend/src/api/routes/tests.ts`

```typescript
// 优先使用 X-Forwarded-Host (包含端口), 然后使用 Host 头
const protocol = req.protocol;
const forwardedHost = req.get('x-forwarded-host');
const host = forwardedHost || req.get('host');

// 如果 host 不包含端口,检查 X-Forwarded-Port
let originUrl = `${protocol}://${host}`;

if (!host?.includes(':')) {
  const forwardedPort = req.get('x-forwarded-port');
  if (forwardedPort &&
      ((protocol === 'http' && forwardedPort !== '80') ||
       (protocol === 'https' && forwardedPort !== '443'))) {
    originUrl = `${protocol}://${host}:${forwardedPort}`;
  }
}
```

**Express 配置** (`backend/src/api/app.ts`):
```typescript
// 信任反向代理,使用 X-Forwarded-* 头
app.set('trust proxy', true);
```

---

## Nginx 配置示例

### 完整配置示例

```nginx
# /etc/nginx/sites-available/anita-web-sentinel

upstream backend {
    server localhost:3000;
}

server {
    listen 10001;
    server_name 172.16.38.135;

    # 日志配置
    access_log /var/log/nginx/anita-access.log;
    error_log /var/log/nginx/anita-error.log;

    # 前端静态文件 (如果使用 Nginx 托管前端)
    location / {
        root /path/to/anita-project/dist/frontend;
        try_files $uri $uri/ /index.html;
    }

    # API 请求转发到后端
    location /api/ {
        proxy_pass http://backend;

        # ✅ 传递原始 Host 和端口
        proxy_set_header Host $host:$server_port;

        # ✅ 传递协议信息
        proxy_set_header X-Forwarded-Proto $scheme;

        # ✅ 传递真实客户端 IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # 超时配置 (测试可能耗时较长)
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;

        # WebSocket 支持 (如果需要)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 截图文件访问
    location /screenshots/ {
        alias /path/to/anita-project/backend/screenshots/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # 健康检查
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    # Prometheus 指标
    location /metrics {
        proxy_pass http://backend;
        access_log off;
    }
}
```

---

## 验证配置

### 步骤 1: 检查当前 Nginx 配置

```bash
# 查找 Anita 相关配置
sudo grep -r "172.16.38.135" /etc/nginx/

# 查看完整配置
sudo cat /etc/nginx/sites-enabled/anita-web-sentinel
```

### 步骤 2: 修改配置

```bash
# 编辑配置文件
sudo nano /etc/nginx/sites-enabled/anita-web-sentinel

# 添加或修改 proxy_set_header Host 行:
# proxy_set_header Host $host:$server_port;
```

### 步骤 3: 测试并重启

```bash
# 测试配置语法
sudo nginx -t

# 预期输出:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# 重新加载配置 (不中断服务)
sudo systemctl reload nginx

# 或者重启 Nginx
sudo systemctl restart nginx
```

### 步骤 4: 验证修复

```bash
# 1. 触发一次测试
# 访问: http://172.16.38.135:10001

# 2. 查看后端日志
docker-compose logs -f backend | grep "Request origin"

# 预期日志 (修复后):
# [Tests API] Request origin: http://172.16.38.135:10001 ✅
#   (host: 172.16.38.135:10001, x-forwarded-host: ..., x-forwarded-port: 10001)

# 之前的日志 (有问题):
# [Tests API] Request origin: http://172.16.38.135 ❌
#   (host: 172.16.38.135, x-forwarded-host: null, x-forwarded-port: null)

# 3. 检查邮件
# "查看完整报告"链接应该包含端口号:
# http://172.16.38.135:10001/report/xxx ✅
```

---

## 不同 Nginx 版本的配置

### Nginx 1.18+ (Ubuntu 20.04+)

```nginx
# 推荐配置
proxy_set_header Host $host:$server_port;
```

### Nginx 1.14- (旧版本)

如果 `$server_port` 不可用:

```nginx
# 方案 A: 硬编码端口
proxy_set_header Host $host:10001;

# 方案 B: 使用 X-Forwarded-Port
proxy_set_header X-Forwarded-Port 10001;
```

---

## 常见问题

### Q1: 修改 Nginx 配置后仍然没有端口号？

**解决方案**:
```bash
# 1. 确认配置已加载
sudo nginx -t
sudo systemctl reload nginx

# 2. 查看实际接收到的请求头
docker-compose logs -f backend | grep "x-forwarded"

# 3. 如果还是没有,尝试清除浏览器缓存或使用无痕模式
```

### Q2: 使用 Docker 部署,如何配置？

如果后端也在 Docker 中:

```nginx
upstream backend {
    server anita-backend:3000;  # Docker 容器名
}

server {
    listen 10001;
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host:$server_port;
        # ... 其他配置
    }
}
```

### Q3: 使用 80 或 443 端口需要传递端口号吗？

**不需要**。代码会自动判断:
- HTTP + 80 端口: 不添加端口 (`http://example.com`)
- HTTPS + 443 端口: 不添加端口 (`https://example.com`)
- 非标准端口: 自动添加 (`http://example.com:8080`)

---

## 测试场景

### ✅ 场景 1: 标准 HTTP (80端口)

```nginx
server {
    listen 80;
    server_name example.com;
    # ...
}
```

**预期链接**: `http://example.com/report/xxx` ✅

### ✅ 场景 2: HTTPS (443端口)

```nginx
server {
    listen 443 ssl;
    server_name example.com;
    # ...
}
```

**预期链接**: `https://example.com/report/xxx` ✅

### ✅ 场景 3: 非标准端口 (10001)

```nginx
server {
    listen 10001;
    server_name 172.16.38.135;
    proxy_set_header Host $host:$server_port; # ← 关键配置
    # ...
}
```

**预期链接**: `http://172.16.38.135:10001/report/xxx` ✅

---

## 修改的文件列表

1. ✅ `backend/src/api/routes/tests.ts`
   - 增强端口号检测逻辑
   - 支持 X-Forwarded-Port 头

2. ✅ `backend/src/api/app.ts`
   - 添加 `app.set('trust proxy', true)`
   - 信任反向代理的 X-Forwarded-* 头

---

## 部署步骤

### 步骤 1: 更新代码

```bash
git pull origin master
```

### 步骤 2: 修改 Nginx 配置

```bash
sudo nano /etc/nginx/sites-enabled/anita-web-sentinel

# 添加:
# proxy_set_header Host $host:$server_port;
```

### 步骤 3: 重启服务

```bash
# Nginx
sudo nginx -t && sudo systemctl reload nginx

# 后端
docker-compose restart backend
```

### 步骤 4: 验证

触发测试,检查邮件链接是否包含端口号。

---

## 总结

### 问题根源
- Nginx 默认转发时只传递 Host 不传递端口
- Express 默认不信任反向代理的 X-Forwarded-* 头

### 解决方案
1. ✅ Nginx 配置传递完整 Host (推荐)
2. ✅ 代码自动检测和补齐端口号 (已实现)
3. ✅ Express 信任反向代理 (已实现)

### 预期效果
- 📧 邮件链接包含正确的端口号
- 🌐 支持任意端口部署
- ✅ 向后兼容标准端口 (80/443)

---

**修复完成时间**: 2025-12-22
**修复人员**: Claude Code
