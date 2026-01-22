# 生产环境截图显示问题 - 完整故障排查指南

## 📋 问题描述

**症状**：生产环境 (http://172.16.38.135:10001) 响应式测试工具完成测试后，截图区域显示空白

**环境**：
- 前端：端口 10001 (Nginx)
- 后端：端口 3000 (Express)
- 本地开发环境：正常显示 ✅
- 生产环境：显示失败 ❌

## 🔍 根本原因

### 技术分析

1. **前端URL构建逻辑**
   ```typescript
   // 生产环境返回相对路径
   getFullApiUrl('/screenshots/xxx.webp') → '/screenshots/xxx.webp'
   ```

2. **浏览器请求流程**
   ```
   浏览器 → http://172.16.38.135:10001/screenshots/xxx.webp
            ↓
   Nginx (10001端口) → ❌ 未找到 /screenshots 配置
            ↓
   返回 404 Not Found
   ```

3. **期望的正确流程**
   ```
   浏览器 → http://172.16.38.135:10001/screenshots/xxx.webp
            ↓
   Nginx (10001端口) → 代理配置
            ↓
   后端 (3000端口) → Express静态文件服务
            ↓
   返回截图文件 (200 OK)
   ```

### 为什么本地环境正常？

本地开发环境前端直接访问后端完整URL：
```typescript
// 开发环境返回完整URL
return `http://localhost:3000/screenshots/xxx.webp`;
```

浏览器直接请求后端3000端口，绕过了代理问题。

## ✅ 解决方案

### 方案1：自动化脚本修复（推荐）⭐

**步骤1：上传修复脚本到生产服务器**

```bash
# 从本地上传
scp scripts/deploy-nginx-fix.sh user@172.16.38.135:/tmp/
```

**步骤2：执行修复脚本**

```bash
# SSH到生产服务器
ssh user@172.16.38.135

# 运行修复脚本（需要root权限）
sudo bash /tmp/deploy-nginx-fix.sh
```

脚本会自动：
1. ✅ 检测Nginx安装和配置
2. ✅ 备份现有配置
3. ✅ 添加 `/screenshots` 代理规则
4. ✅ 验证配置语法
5. ✅ 重新加载Nginx
6. ✅ 测试后端健康状态

**预计时间**：2-3分钟

---

### 方案2：手动配置Nginx

**步骤1：编辑Nginx配置文件**

```bash
# 查找配置文件
sudo nginx -t

# 编辑配置（通常在以下位置之一）
sudo nano /etc/nginx/conf.d/anita-project.conf
# 或
sudo nano /etc/nginx/sites-enabled/default
```

**步骤2：添加截图代理配置**

在 `server` 块中添加：

```nginx
server {
    listen 10001;
    server_name _;

    # 现有配置...
    location / {
        # ...
    }

    location /api/ {
        # ...
    }

    # ⭐ 添加此配置块
    location /screenshots/ {
        proxy_pass http://localhost:3000/screenshots/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # 缓存优化（可选）
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
```

**步骤3：测试并重启Nginx**

```bash
# 测试配置语法
sudo nginx -t

# 重新加载配置
sudo nginx -s reload
# 或
sudo systemctl reload nginx
```

**预计时间**：5分钟

---

### 方案3：使用提供的完整Nginx配置模板

项目提供了完整的生产环境配置模板：

```bash
# 1. 备份现有配置
sudo cp /etc/nginx/conf.d/anita-project.conf /etc/nginx/conf.d/anita-project.conf.backup

# 2. 复制模板配置
sudo cp config/nginx-production.conf /etc/nginx/conf.d/anita-project.conf

# 3. 根据实际情况修改配置
sudo nano /etc/nginx/conf.d/anita-project.conf
# 修改：server_name, root路径等

# 4. 测试并重启
sudo nginx -t && sudo nginx -s reload
```

**预计时间**：10分钟

---

## 🧪 验证修复

### 快速验证（推荐）

运行自动验证脚本：

```bash
# 上传验证脚本
scp scripts/verify-screenshot-access.sh user@172.16.38.135:/tmp/

# SSH到服务器
ssh user@172.16.38.135

# 运行验证
bash /tmp/verify-screenshot-access.sh
```

验证脚本会检查：
- ✅ 截图目录和文件
- ✅ 后端直接访问 (http://localhost:3000/screenshots/xxx.webp)
- ✅ 前端代理访问 (http://172.16.38.135:10001/screenshots/xxx.webp)
- ✅ 后端健康状态
- ✅ Nginx配置

### 手动验证

**1. 测试后端健康**
```bash
curl http://localhost:3000/health
# 预期: {"status":"ok",...}
```

**2. 测试后端截图访问**
```bash
# 查找最新截图
ls -lh /tmp/screenshots/ | head

# 测试访问（替换实际文件名）
curl -I http://localhost:3000/screenshots/xxx.webp
# 预期: HTTP/1.1 200 OK
```

**3. 测试Nginx代理**
```bash
# 通过Nginx访问
curl -I http://localhost:10001/screenshots/xxx.webp
# 预期: HTTP/1.1 200 OK（修复后）
```

**4. 浏览器测试**

1. 打开浏览器开发者工具 (F12)
2. 切换到 Network 标签
3. 访问：http://172.16.38.135:10001/tools/responsive
4. 运行测试
5. 查看截图请求：
   - ✅ 状态码应为 **200 OK**
   - ✅ 响应类型应为 **image/webp**
   - ✅ 文件大小应大于 **0 bytes**

---

## 🛠️ 完整诊断工具

如果问题仍未解决，运行完整诊断脚本：

```bash
# 上传诊断脚本
scp scripts/diagnose-screenshots.sh user@172.16.38.135:/tmp/

# 运行诊断
ssh user@172.16.38.135
bash /tmp/diagnose-screenshots.sh > diagnosis-report.txt

# 查看报告
cat diagnosis-report.txt
```

诊断脚本提供10个维度的检查：
1. 环境信息
2. 截图目录检查
3. 后端服务检查
4. Nginx配置检查
5. 网络连通性测试
6. 环境变量检查
7. 进程检查
8. 日志检查
9. 诊断总结
10. 修复建议

---

## 📚 相关文件

| 文件 | 用途 |
|------|------|
| `docs/production-screenshot-fix.md` | 详细技术文档和多种解决方案 |
| `config/nginx-production.conf` | 完整Nginx生产环境配置模板 |
| `scripts/deploy-nginx-fix.sh` | 自动化Nginx修复脚本 |
| `scripts/verify-screenshot-access.sh` | 快速验证脚本 |
| `scripts/diagnose-screenshots.sh` | 完整诊断工具 |

---

## 🔧 常见问题

### Q1: 修复后仍然显示404

**可能原因**：
1. Nginx未重新加载
2. 后端服务未运行
3. 配置文件路径错误

**解决方法**：
```bash
# 1. 确认Nginx已重新加载
sudo systemctl status nginx
ps aux | grep nginx

# 2. 确认后端服务运行
curl http://localhost:3000/health

# 3. 检查Nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

### Q2: 截图偶尔显示，偶尔不显示

**可能原因**：
1. 使用 `/tmp` 目录（容器重启会清空）
2. 自动清理脚本删除了文件

**解决方法**：
```bash
# 方法1: 使用持久化目录
# 修改环境变量
echo "SCREENSHOT_DIR=/var/lib/anita-screenshots" >> /etc/environment

# 创建目录
sudo mkdir -p /var/lib/anita-screenshots
sudo chown www-data:www-data /var/lib/anita-screenshots
sudo chmod 755 /var/lib/anita-screenshots

# 重启后端服务
sudo systemctl restart backend
```

```yaml
# 方法2: Docker卷挂载
services:
  backend:
    volumes:
      - screenshots:/tmp/screenshots
    environment:
      - SCREENSHOT_DIR=/tmp/screenshots

volumes:
  screenshots:
```

### Q3: 403 Forbidden 错误

**可能原因**：文件或目录权限不足

**解决方法**：
```bash
# 修复目录权限
sudo chmod 755 /tmp/screenshots

# 修复文件权限
sudo chmod 644 /tmp/screenshots/*.webp

# 修改所有者（如果需要）
sudo chown -R www-data:www-data /tmp/screenshots
```

### Q4: 502 Bad Gateway

**可能原因**：后端服务未运行或端口错误

**解决方法**：
```bash
# 检查后端服务
sudo systemctl status backend
pm2 list
docker ps | grep backend

# 检查端口
netstat -tlnp | grep 3000

# 重启后端
sudo systemctl restart backend
```

---

## 📞 需要帮助？

如果以上方法都无法解决问题：

1. **收集诊断信息**
   ```bash
   bash scripts/diagnose-screenshots.sh > diagnosis-report.txt
   ```

2. **提供以下信息**：
   - 诊断报告 (`diagnosis-report.txt`)
   - Nginx配置文件内容
   - 后端日志最近50行
   - 浏览器开发者工具 Network 标签截图

3. **检查日志**：
   ```bash
   # Nginx错误日志
   sudo tail -f /var/log/nginx/error.log

   # 后端日志
   pm2 logs backend
   # 或
   journalctl -u backend -f
   ```

---

## ⚡ 快速参考

### 一键修复命令（推荐）

```bash
# 在生产服务器执行
curl -O https://your-repo/scripts/deploy-nginx-fix.sh
sudo bash deploy-nginx-fix.sh
```

### 最小可行配置

```nginx
# 只需在Nginx配置中添加这3行核心配置
location /screenshots/ {
    proxy_pass http://localhost:3000/screenshots/;
    proxy_set_header Host $host;
}
```

然后重启Nginx：
```bash
sudo nginx -s reload
```

---

**文档版本**：1.0
**最后更新**：2025-01-22
**适用环境**：生产环境 (端口10001)
