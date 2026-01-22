# 生产环境截图问题 - 技术分析与解决方案总结

## 📊 问题分析

### 现象对比

| 环境 | URL | 截图显示 | 原因 |
|------|-----|---------|------|
| **本地开发** | `http://localhost:5173` | ✅ 正常 | 前端直接访问后端3000端口 |
| **生产环境** | `http://172.16.38.135:10001` | ❌ 失败 | Nginx未配置截图路径代理 |

### 技术流程分析

#### 本地开发环境（正常）

```
用户浏览器
  ↓ 访问前端
http://localhost:5173
  ↓ 前端检测到localhost
getFullApiUrl('/screenshots/xxx.webp')
  ↓ 返回完整URL
'http://localhost:3000/screenshots/xxx.webp'
  ↓ 浏览器直接请求后端
http://localhost:3000
  ↓ Express static中间件
app.use('/screenshots', express.static('/tmp/screenshots'))
  ↓ 返回文件
200 OK ✅
```

#### 生产环境（失败）

```
用户浏览器
  ↓ 访问前端
http://172.16.38.135:10001
  ↓ 前端检测到非localhost
getFullApiUrl('/screenshots/xxx.webp')
  ↓ 返回相对路径
'/screenshots/xxx.webp'
  ↓ 浏览器请求当前域
http://172.16.38.135:10001/screenshots/xxx.webp
  ↓ Nginx处理（10001端口）
❌ 未找到 /screenshots 配置
  ↓ 返回错误
404 Not Found ❌
```

#### 修复后的生产环境（正常）

```
用户浏览器
  ↓ 访问前端
http://172.16.38.135:10001
  ↓ 前端检测到非localhost
getFullApiUrl('/screenshots/xxx.webp')
  ↓ 返回相对路径
'/screenshots/xxx.webp'
  ↓ 浏览器请求当前域
http://172.16.38.135:10001/screenshots/xxx.webp
  ↓ Nginx处理（10001端口）
location /screenshots/ { proxy_pass http://localhost:3000/screenshots/; }
  ↓ 代理到后端
http://localhost:3000/screenshots/xxx.webp
  ↓ Express static中间件
app.use('/screenshots', express.static('/tmp/screenshots'))
  ↓ 返回文件
200 OK ✅
```

---

## 🔍 代码分析

### 前端URL构建逻辑

**文件**：`frontend/src/services/api.ts:33-59`

```typescript
export const getFullApiUrl = (path: string): string => {
  // 如果已经是完整URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // 生产环境：使用相对路径
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return path.startsWith('/') ? path : `/${path}`;  // ← 返回 '/screenshots/xxx.webp'
  }

  // 开发环境：使用完整URL
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `http://localhost:3000${cleanPath}`;  // ← 返回 'http://localhost:3000/screenshots/xxx.webp'
};
```

**关键点**：
- 开发环境：返回完整URL（直接访问后端）
- 生产环境：返回相对路径（需要通过Nginx代理）

### 后端静态文件配置

**文件**：`backend/src/api/middleware/staticFiles.ts:10-14`

```typescript
export function setupStaticFiles(app: Express): void {
  const screenshotDir = process.env.SCREENSHOT_DIR || '/tmp/screenshots';

  app.use('/screenshots', express.static(screenshotDir, {
    maxAge: '7d',
    etag: true,
    lastModified: true,
  }));
}
```

**关键点**：
- Express在 `/screenshots` 路径提供静态文件服务
- 默认目录：`/tmp/screenshots`
- 缓存策略：7天

### 截图生成服务

**文件**：`backend/src/automation/ScreenshotService.ts:55-64`

```typescript
const filename = `${randomUUID()}.webp`;
const filepath = join(this.screenshotDir, filename);

// 保存到磁盘
await writeFile(filepath, compressed);

// 返回相对URL路径
return `/screenshots/${filename}`;  // ← 返回 '/screenshots/xxx.webp'
```

**关键点**：
- 生成UUID文件名
- 保存为WebP格式（80%质量）
- 返回相对路径（由前端处理完整URL）

---

## ✅ 解决方案

### 核心配置

**最小可行配置**（3行）：

```nginx
location /screenshots/ {
    proxy_pass http://localhost:3000/screenshots/;
    proxy_set_header Host $host;
}
```

**推荐生产配置**（含优化）：

```nginx
location /screenshots/ {
    # 代理到后端
    proxy_pass http://localhost:3000/screenshots/;

    # 请求头转发
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # 缓存优化（7天）
    proxy_cache_valid 200 7d;
    proxy_cache_valid 404 1m;
    add_header Cache-Control "public, max-age=604800";

    # 超时设置
    proxy_connect_timeout 10s;
    proxy_read_timeout 30s;
}
```

---

## 🛠️ 实施步骤

### 方法1：自动化脚本（推荐）

```bash
# 1. 上传脚本
scp scripts/deploy-nginx-fix.sh user@172.16.38.135:/tmp/

# 2. 执行修复
ssh user@172.16.38.135 "sudo bash /tmp/deploy-nginx-fix.sh"

# 3. 验证
ssh user@172.16.38.135 "bash /tmp/verify-screenshot-access.sh"
```

**时间**：2-3分钟
**风险**：低（自动备份配置）

### 方法2：手动配置

```bash
# 1. 编辑配置
sudo nano /etc/nginx/conf.d/anita-project.conf

# 2. 添加配置（参考上面的核心配置）

# 3. 测试
sudo nginx -t

# 4. 重启
sudo nginx -s reload

# 5. 验证
curl -I http://172.16.38.135:10001/screenshots/test.webp
```

**时间**：5-10分钟
**风险**：中（需手动操作）

---

## 📈 性能优化建议

### 1. 持久化存储

**当前问题**：使用 `/tmp` 目录（容器重启会清空）

**解决方案**：

```bash
# 方法A：使用持久化目录
mkdir -p /var/lib/anita-screenshots
echo "SCREENSHOT_DIR=/var/lib/anita-screenshots" >> /etc/environment
```

```yaml
# 方法B：Docker卷
services:
  backend:
    volumes:
      - screenshots:/tmp/screenshots
volumes:
  screenshots:
```

### 2. Nginx缓存优化

```nginx
# 配置缓存路径
proxy_cache_path /var/cache/nginx/screenshots
                 levels=1:2
                 keys_zone=screenshot_cache:10m
                 max_size=1g
                 inactive=7d;

location /screenshots/ {
    proxy_cache screenshot_cache;
    proxy_cache_valid 200 7d;
    proxy_cache_key "$scheme$proxy_host$request_uri";
    add_header X-Cache-Status $upstream_cache_status;

    proxy_pass http://localhost:3000/screenshots/;
}
```

### 3. CDN集成（可选）

如果截图访问量大，可以考虑使用CDN：

```nginx
location /screenshots/ {
    # 添加CORS头（如果CDN需要）
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";

    proxy_pass http://localhost:3000/screenshots/;
}
```

---

## 🧪 测试验证

### 自动化测试脚本

提供了3个验证工具：

1. **快速验证** (`verify-screenshot-access.sh`)
   - 检查后端直接访问
   - 检查Nginx代理访问
   - 检查后端健康状态
   - **时间**：10秒

2. **完整诊断** (`diagnose-screenshots.sh`)
   - 10个维度深度检查
   - 生成详细诊断报告
   - 提供修复建议
   - **时间**：30-60秒

3. **自动修复** (`deploy-nginx-fix.sh`)
   - 检测现有配置
   - 自动备份
   - 添加配置
   - 验证语法
   - 重启服务
   - **时间**：2-3分钟

### 手动验证步骤

```bash
# 1. 后端健康检查
curl http://localhost:3000/health
# 预期: {"status":"ok",...}

# 2. 后端截图访问
curl -I http://localhost:3000/screenshots/test.webp
# 预期: HTTP/1.1 200 OK 或 404

# 3. Nginx代理访问
curl -I http://localhost:10001/screenshots/test.webp
# 预期: HTTP/1.1 200 OK（修复后）

# 4. 浏览器测试
# 打开 http://172.16.38.135:10001/tools/responsive
# 运行测试，检查Network标签中截图请求状态
```

---

## 📊 监控和日志

### 关键日志位置

```bash
# Nginx访问日志
tail -f /var/log/nginx/access.log | grep screenshots

# Nginx错误日志
tail -f /var/log/nginx/error.log

# 后端日志
pm2 logs backend
# 或
journalctl -u backend -f | grep screenshot
```

### 监控指标

建议监控以下指标：

1. **截图请求成功率**
   ```bash
   # 统计最近1小时的截图请求状态码
   grep "/screenshots/" /var/log/nginx/access.log | \
     awk '{print $9}' | sort | uniq -c
   ```

2. **截图生成时间**
   ```bash
   # 从后端日志提取截图生成时间
   grep "Screenshot saved" /var/log/backend.log | \
     awk '{print $NF}'
   ```

3. **存储空间使用**
   ```bash
   # 检查截图目录大小
   du -sh /tmp/screenshots

   # 检查文件数量
   find /tmp/screenshots -type f | wc -l
   ```

---

## 🚨 常见问题处理

### 问题矩阵

| 症状 | HTTP状态码 | 可能原因 | 解决方案 |
|------|-----------|---------|---------|
| 截图不显示 | 404 | Nginx未配置代理 | 运行 `deploy-nginx-fix.sh` |
| 截图不显示 | 502/503 | 后端服务未运行 | 启动后端服务 |
| 截图不显示 | 403 | 文件权限不足 | `chmod 755 /tmp/screenshots` |
| 截图偶尔显示 | 200/404 | 文件被清理 | 使用持久化存储 |
| 加载缓慢 | 200 | 无缓存 | 添加Nginx缓存配置 |

### 故障排查流程图

```
问题：截图不显示
    ↓
1. 运行 verify-screenshot-access.sh
    ↓
后端访问失败？
├─ YES → 检查后端服务
│         - systemctl status backend
│         - 检查端口: netstat -tlnp | grep 3000
│         - 启动服务: systemctl start backend
│
└─ NO → 前端访问失败？
         ├─ YES → Nginx配置问题
         │         - 运行 deploy-nginx-fix.sh
         │         - 检查日志: tail -f /var/log/nginx/error.log
         │
         └─ NO → 其他问题
                   - 运行完整诊断: diagnose-screenshots.sh
                   - 检查浏览器Console
                   - 检查文件权限
```

---

## 📦 交付物清单

### 文档（3个，约22KB）

- [x] `SCREENSHOT_FIX_README.md` - 快速开始指南
- [x] `docs/SCREENSHOT_TROUBLESHOOTING.md` - 完整故障排查指南
- [x] `docs/production-screenshot-fix.md` - 详细技术文档

### 配置（1个）

- [x] `config/nginx-production.conf` - 完整Nginx配置模板

### 脚本（3个）

- [x] `scripts/deploy-nginx-fix.sh` - 自动修复脚本（可执行）
- [x] `scripts/verify-screenshot-access.sh` - 快速验证脚本（可执行）
- [x] `scripts/diagnose-screenshots.sh` - 完整诊断脚本（可执行）

### Git提交

```
commit a3d4a9e
docs: 添加生产环境截图显示问题完整解决方案
```

---

## 🎯 成功标准

修复成功后应满足：

1. ✅ **功能验证**
   - 响应式测试完成后截图正常显示
   - 浏览器开发者工具Network标签显示200 OK
   - 截图文件大小 > 0 bytes

2. ✅ **性能验证**
   - 截图加载时间 < 2秒
   - 后续访问利用缓存（X-Cache-Status: HIT）

3. ✅ **稳定性验证**
   - 连续测试10次，成功率100%
   - 容器重启后截图仍可访问（如使用持久化存储）

---

## 📞 后续支持

### 自助诊断

```bash
# 运行完整诊断
bash scripts/diagnose-screenshots.sh > diagnosis-report.txt

# 查看报告
less diagnosis-report.txt
```

### 需要提供的信息

如果问题仍未解决，请提供：

1. 诊断报告 (`diagnosis-report.txt`)
2. Nginx配置文件
   ```bash
   cat /etc/nginx/conf.d/anita-project.conf
   ```
3. 后端日志（最近100行）
   ```bash
   pm2 logs backend --lines 100
   ```
4. 浏览器开发者工具截图
   - Network标签（显示截图请求）
   - Console标签（显示错误信息）

---

## 📈 项目影响

### 解决的问题

1. **核心功能缺陷**：生产环境响应式测试工具截图无法显示
2. **用户体验**：影响测试结果的可视化展示
3. **运维难度**：缺乏系统化的诊断工具

### 提供的价值

1. **快速修复**：2-5分钟解决问题（vs 数小时手动排查）
2. **自动化工具**：3个脚本覆盖诊断-修复-验证全流程
3. **完整文档**：22KB技术文档，包含原因分析和解决方案
4. **可复用性**：解决方案可应用于其他类似的反向代理问题

---

**创建时间**：2025-01-22
**作者**：Claude Sonnet 4.5
**版本**：1.0
**状态**：已完成 ✅
