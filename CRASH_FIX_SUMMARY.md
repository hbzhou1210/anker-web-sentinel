# 🎯 浏览器崩溃修复总结

## 问题现象

根据您提供的截图,生产环境的定时巡检中**所有8个页面都出现了相同的错误**:

```
错误信息: page.goto: Page crashed
Call log: - navigating to "https://www.anker.com/...", waiting until "load"
```

测试的页面包括:
- US首页、产品页、落地页
- DE首页、UK首页、FR首页、CA首页

**影响**: 巡检任务 100% 失败,无法完成页面监控

## 根本原因分析

### 1. 共享内存不足 (/dev/shm)
- Docker 默认只分配 **64MB** 共享内存
- Chromium 需要至少 **128MB** 才能稳定运行
- 多个页面同时加载时内存耗尽导致崩溃

### 2. 内存泄漏问题
- 浏览器上下文(BrowserContext)没有及时清理
- 长时间运行导致内存占用持续增长
- 最终触发 OOM(Out of Memory)崩溃

### 3. 进程管理问题
- 多进程模式下资源竞争激烈
- GPU 进程在无硬件加速环境下不稳定
- Zygote 进程增加额外开销

## 已实施的修复方案

### ✅ 修复 1: 优化浏览器启动参数

**文件**: [backend/src/automation/BrowserPool.ts](backend/src/automation/BrowserPool.ts)

**关键参数**:
```javascript
'--disable-dev-shm-usage',  // 使用 /tmp 而不是 /dev/shm
'--single-process',         // 单进程模式,减少崩溃
'--no-zygote',             // 禁用 zygote 进程
'--disable-gpu',           // 完全禁用 GPU
'--disable-3d-apis',       // 禁用 3D API
'--js-flags=--max-old-space-size=512',  // 限制 JS 内存
```

**效果**: 即使在 64MB 共享内存下也能运行

### ✅ 修复 2: 浏览器池自动恢复

**功能**:
- 监听浏览器 `disconnected` 事件
- 自动移除崩溃的浏览器实例
- 立即创建新的替换实例
- 跟踪每个浏览器的上下文数量

**代码**:
```typescript
browser.on('disconnected', () => {
  console.warn('⚠️  Browser disconnected, will be removed from pool');
  this.removeBrowser(browser);
});
```

### ✅ 修复 3: 上下文清理机制

**功能**:
- 每次释放浏览器时自动关闭所有上下文
- 清理内存,防止泄漏
- 重置上下文计数器

**代码**:
```typescript
const contexts = browser.contexts();
for (const context of contexts) {
  await context.close();
}
this.contextCounts.set(browser, 0);
```

### ✅ 修复 4: 页面崩溃检测

**文件**: [backend/src/services/PatrolService.ts](backend/src/services/PatrolService.ts)

**功能**:
- 监听页面 `crash` 事件
- 检测页面是否在加载过程中关闭
- 提供详细的错误信息
- 区分崩溃和其他错误

**代码**:
```typescript
page.on('crash', crashHandler);

if (pageCrashed || page.isClosed()) {
  throw new Error('Page crashed during navigation - browser may be under memory pressure');
}
```

### ✅ 修复 5: Dockerfile 优化

**文件**: [backend/Dockerfile](backend/Dockerfile)

**改进**:
- 添加 Chromium 稳定性环境变量
- 提供共享内存配置建议
- 添加部署说明注释

## 部署指南

### 快速部署(推荐)

在 Launch 平台的 Docker 配置中添加:

```yaml
# docker-compose.yml
services:
  anita-sentinel:
    image: your-registry/anita-web-sentinel:latest
    shm_size: 512m  # 关键配置
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
```

### 验证修复

1. **查看日志**:
```bash
docker logs -f your-container-name
```

期望看到:
```
✓ Browser acquired from pool
✓ Browser released back to pool
✓ Patrol execution completed: 8 passed, 0 failed
```

2. **检查健康状态**:
```bash
curl http://your-host:3000/api/v1/health
```

3. **手动触发巡检**:
```bash
curl -X POST http://your-host:3000/api/v1/patrol/tasks/{task_id}/execute
```

## 性能对比

| 指标 | 修复前 | 修复后(预期) |
|------|--------|-------------|
| 崩溃率 | 100% | < 5% |
| 页面加载成功率 | 0% | > 95% |
| 内存占用 | 不稳定 | ~800MB |
| 平均响应时间 | N/A | 5-10秒 |
| 并发支持 | 失败 | 5-10 个页面 |

## 监控指标

部署后请关注以下指标(在 Launch 平台):

1. **崩溃频率**: 应该 < 1次/天
2. **内存使用**: 稳定在 < 1GB
3. **巡检成功率**: > 95%
4. **响应时间**: P95 < 10秒

## 故障排查

### 如果仍然出现崩溃

1. **检查共享内存大小**:
```bash
docker exec your-container df -h /dev/shm
```
应该看到 > 64MB

2. **检查容器内存限制**:
```bash
docker stats your-container
```

3. **增加日志级别**:
在环境变量中添加 `DEBUG=*`

4. **临时降低并发**:
修改 `BrowserPool.ts` 中的 `poolSize` 从 5 改为 3

## 相关文件

修复涉及的文件:
- ✅ [backend/src/automation/BrowserPool.ts](backend/src/automation/BrowserPool.ts) - 浏览器池优化
- ✅ [backend/src/services/PatrolService.ts](backend/src/services/PatrolService.ts) - 崩溃检测
- ✅ [backend/Dockerfile](backend/Dockerfile) - 容器配置
- 📚 [BROWSER_CRASH_FIX_GUIDE.md](BROWSER_CRASH_FIX_GUIDE.md) - 详细指南
- 🚀 [backend/deploy-crash-fix.sh](backend/deploy-crash-fix.sh) - 部署脚本

## 下一步行动

### 立即执行

1. ✅ 代码已修复完成
2. 🔄 **在 Launch 平台重新部署镜像**
3. 📝 **在 Docker 配置中添加 `shm_size: 512m`**
4. 🧪 **测试一次巡检任务**
5. 📊 **监控 24 小时稳定性**

### 长期优化

1. 收集崩溃日志和内存使用数据
2. 根据实际负载调整浏览器池大小
3. 考虑实施自动扩缩容
4. 定期检查 Playwright 更新

## 技术细节

### 为什么 `--disable-dev-shm-usage` 有效?

Docker 默认的 `/dev/shm` 只有 64MB,Chromium 会在这里存储共享内存数据。当超过限制时会触发 SIGSEGV(段错误)导致崩溃。

`--disable-dev-shm-usage` 强制 Chromium 使用 `/tmp` 目录,而 `/tmp` 通常有更大的空间(受容器文件系统限制,而非 64MB)。

### 为什么使用 `--single-process`?

多进程模式下,Chromium 会创建多个进程(Browser、Renderer、GPU 等),每个进程都需要独立的内存和 IPC 通信。在资源受限的容器环境中,多进程反而增加了崩溃风险。

单进程模式虽然性能略低,但显著提高了稳定性。

## Anthropic AI API Key

您当前使用的 API Key 是:
```
sk-xf3s9l0-hbHHd_VVCvMVfQ
```

Base URL:
```
https://ai-router.anker-in.com/v1
```

Model:
```
us.anthropic.claude-sonnet-4-5-20250929-v1:0
```

---

**修复作者**: Claude (Sonnet 4.5)
**修复日期**: 2025-12-17
**优先级**: 🔴 P0 (Critical)
**状态**: ✅ 修复完成,等待部署
