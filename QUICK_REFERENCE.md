# 截图功能配置 - 快速参考

## 🎯 核心原则

**本地环境 = 生产环境** (配置逻辑一致)

## 📋 配置检查表

### 本地环境 (✅ 已完成)

- [x] `frontend/nginx.conf` - 使用 `alias` 静态文件服务
- [x] `docker-compose.yml` - Backend 挂载 `screenshot_data`
- [x] `docker-compose.yml` - Frontend 挂载 `screenshot_data`
- [x] `docker-compose.yml` - 定义 `screenshot_data` volume

### 生产环境 (⚠️ 待操作)

- [ ] 修改 Nginx 配置: `proxy_pass` → `alias`
- [ ] 验证 Backend `SCREENSHOT_DIR` 环境变量
- [ ] 确认截图目录权限
- [ ] 测试截图访问

## 🚀 快速命令

### 本地测试

```bash
# 完整测试(推荐)
./scripts/test-screenshot-config.sh

# 快速测试
docker compose down && \
docker compose build frontend && \
docker compose up -d && \
sleep 10 && \
curl -I http://localhost/screenshots/test.txt
```

### 生产部署

```bash
# 在生产服务器 172.16.38.135 执行
sudo cp /etc/nginx/sites-available/anita-project{,.bak}
sudo vim /etc/nginx/sites-available/anita-project  # 修改配置
sudo nginx -t && sudo nginx -s reload
curl -I http://172.16.38.135:10001/screenshots/test.webp
```

## 🔧 核心配置

### Nginx 配置(必须一致)

```nginx
location /screenshots/ {
    alias /path/to/screenshots/;  # 本地: /app/screenshots, 生产: /tmp/screenshots
    expires 7d;
    add_header Cache-Control "public, immutable";
    access_log off;
    limit_rate 10m;
    limit_except GET HEAD { deny all; }
    types { image/webp webp; }
}
```

### Backend 环境变量

| 环境 | 配置 |
|------|------|
| 本地 | `SCREENSHOT_DIR=/app/screenshots` |
| 生产 | `SCREENSHOT_DIR=/tmp/screenshots` |

## ✅ 验证方法

### 方式一: HTTP 状态码

```bash
curl -I http://YOUR_HOST/screenshots/test.webp
```

| 状态码 | 含义 | 配置状态 |
|--------|------|----------|
| 200 | 文件存在且可访问 | ✅ 正确 |
| 404 | 文件不存在(但配置正确) | ✅ 正确 |
| 502 | 代理到后端失败 | ❌ 仍使用 proxy |
| 403 | 权限问题 | ❌ 检查权限 |

### 方式二: 功能测试

1. 访问响应式测试页面
2. 提交测试任务
3. 检查截图是否显示

## 📚 详细文档

| 文档 | 用途 |
|------|------|
| [ENVIRONMENT_CONSISTENCY.md](ENVIRONMENT_CONSISTENCY.md) | 配置对比和一致性 |
| [NON_DOCKER_DEPLOY_GUIDE.md](NON_DOCKER_DEPLOY_GUIDE.md) | 生产环境部署详细步骤 |
| [SCREENSHOT_STATIC_DEPLOY.md](SCREENSHOT_STATIC_DEPLOY.md) | Docker 环境部署指南 |
| [scripts/test-screenshot-config.sh](scripts/test-screenshot-config.sh) | 自动化测试脚本 |

## 🆘 故障排查

### 问题: 本地截图无法显示

```bash
# 1. 检查容器状态
docker ps | grep anker-sentinel

# 2. 检查配置
grep "location /screenshots" frontend/nginx.conf

# 3. 检查卷挂载
docker inspect anker-sentinel-frontend | grep screenshots

# 4. 重新构建
docker compose build frontend && docker compose up -d
```

### 问题: 生产环境截图无法显示

```bash
# 1. 检查 Nginx 配置
sudo nginx -T | grep -A 10 "location /screenshots"

# 2. 检查后端环境变量
ps aux | grep node | grep SCREENSHOT_DIR

# 3. 检查目录权限
ls -la /tmp/screenshots/

# 4. 测试访问
curl -v http://172.16.38.135:10001/screenshots/test.webp
```

## ⚡ 一键修复

### 本地环境

```bash
# 已自动配置,如有问题运行:
git checkout frontend/nginx.conf docker-compose.yml
./scripts/test-screenshot-config.sh
```

### 生产环境

```bash
# 登录生产服务器后执行:
cat << 'EOF' | sudo tee /tmp/fix-screenshots.sh
#!/bin/bash
NGINX_CONF="/etc/nginx/sites-available/anita-project"
sudo cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%Y%m%d%H%M%S)"
sudo sed -i '/location \/screenshots/,/}/c\
    location /screenshots/ {\
        alias /tmp/screenshots/;\
        expires 7d;\
        add_header Cache-Control "public, immutable";\
        access_log off;\
        limit_rate 10m;\
        limit_except GET HEAD { deny all; }\
        types { image/webp webp; }\
    }' "$NGINX_CONF"
sudo nginx -t && sudo nginx -s reload
EOF

chmod +x /tmp/fix-screenshots.sh
sudo /tmp/fix-screenshots.sh
```

## 💡 最佳实践

1. **本地测试优先**: 修改配置后先在本地测试
2. **保持一致性**: 本地和生产配置逻辑保持一致
3. **备份配置**: 修改前备份,出问题可快速回滚
4. **监控磁盘**: 定期检查截图目录大小
5. **文档更新**: 配置变更时同步更新文档

---

**快速链接**:
- 本地测试: `./scripts/test-screenshot-config.sh`
- 生产部署: [NON_DOCKER_DEPLOY_GUIDE.md](NON_DOCKER_DEPLOY_GUIDE.md)
- 配置对比: [ENVIRONMENT_CONSISTENCY.md](ENVIRONMENT_CONSISTENCY.md)
