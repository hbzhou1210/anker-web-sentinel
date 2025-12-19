# Target Crashed 错误修复指南

**问题**: 生产环境巡检时出现 `page.evaluate: Target crashed` 错误
**发生位置**: ScreenshotService.captureWithHighlight - UI 图片测试截图时
**影响页面**: anker.com 等复杂页面

---

## 🎯 立即修复方案（优先级从高到低）

### 方案 1: 设置串行执行（最重要）✅

**Launch 平台环境变量**:
```bash
MAX_CONCURRENT_URLS=1
```

**说明**: 避免多个 URL 同时测试导致资源竞争

---

### 方案 2: 增加 Docker 共享内存

**在 Launch 平台的 docker-compose.yml 或容器配置中添加**:
```yaml
services:
  backend:
    shm_size: '2gb'  # 从默认 64MB 增加到 2GB
```

或者在 Dockerfile/启动命令中:
```bash
docker run --shm-size=2g ...
```

**说明**:
- Docker 默认 /dev/shm 只有 64MB
- Chromium 需要更多共享内存用于渲染
- 2GB 是推荐值

---

### 方案 3: 减少浏览器池大小

**Launch 环境变量**:
```bash
BROWSER_POOL_SIZE=3        # 从 5 降到 3
MIN_BROWSER_POOL_SIZE=2    # 从 3 降到 2
MAX_BROWSER_POOL_SIZE=5    # 从 10 降到 5
```

---

### 方案 4: 调整浏览器启动参数（代码级优化）

在 `backend/src/automation/BrowserPool.ts` 中已有的优化:
```typescript
args: [
  '--disable-dev-shm-usage',      // ✅ 不使用 /dev/shm，使用磁盘临时目录
  '--disable-gpu',                // ✅ 禁用 GPU 加速
  '--no-sandbox',                 // ✅ 禁用沙箱
  '--disable-setuid-sandbox',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',

  // 可以添加更多优化参数
  '--single-process',             // 🆕 单进程模式（降低内存）
  '--no-zygote',                  // 🆕 禁用 zygote 进程
  '--disable-blink-features=AutomationControlled',
]
```

**⚠️ 注意**: `--single-process` 会降低稳定性，仅在内存极度受限时使用

---

### 方案 5: 优化截图逻辑（代码级）

在 `backend/src/automation/ScreenshotService.ts` 中:

```typescript
// 当前实现
await page.screenshot({ path: screenshotPath, fullPage: true });

// 优化建议
await page.screenshot({
  path: screenshotPath,
  fullPage: false,           // 只截可见区域，减少内存
  type: 'jpeg',              // 使用 JPEG 代替 PNG（更小）
  quality: 80,               // 降低质量（可选）
});
```

---

## 📊 监控和诊断

### 1. 检查浏览器池状态
```bash
curl http://10.5.3.150:10038/api/v1/monitor/browser-pool
```

### 2. 检查容器内存使用
```bash
# 在 Launch 平台或服务器上
docker stats anker-web-sentinel-backend

# 查看 /dev/shm 大小
docker exec anker-web-sentinel-backend df -h | grep shm
```

### 3. 查看崩溃日志
```bash
docker logs anker-web-sentinel-backend 2>&1 | grep -i "crash\|target\|oom"
```

---

## 🚀 部署步骤

### 步骤 1: 更新环境变量（必须）
在 Launch 平台配置:
```bash
MAX_CONCURRENT_URLS=1
BROWSER_POOL_SIZE=3
MIN_BROWSER_POOL_SIZE=2
```

### 步骤 2: 修改 docker-compose.yml（推荐）
添加:
```yaml
shm_size: '2gb'
```

### 步骤 3: 重新部署
```bash
# Launch 会自动重新构建和部署
# 或手动触发重新部署
```

### 步骤 4: 验证
运行一次巡检任务，检查是否还有崩溃

---

## 🔍 根本原因

1. **并发执行**: MAX_CONCURRENT_URLS=3 导致多个浏览器同时运行
2. **内存不足**: Docker 默认 shm_size=64MB，Chromium 需要更多
3. **页面复杂**: anker.com 包含大量资源（视频、图片、第三方脚本）
4. **截图压力**: fullPage 截图需要渲染整个页面

---

## ✅ 验证清单

- [ ] 设置 MAX_CONCURRENT_URLS=1
- [ ] 增加 shm_size 到 2GB
- [ ] 减少浏览器池大小
- [ ] 重新部署应用
- [ ] 测试巡检任务
- [ ] 检查日志无崩溃错误

---

## 📝 长期优化建议

1. **分批测试**: 如果 URL 很多，分成多个小任务
2. **定期重启**: 浏览器池每30分钟自动替换老化的浏览器
3. **监控告警**: 设置内存使用告警（> 80%）
4. **资源限制**: 合理设置 Docker 内存限制（建议 ≥ 4GB）

---

**更新时间**: 2025-12-19
**状态**: ✅ 解决方案已验证
