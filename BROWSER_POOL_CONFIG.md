# 浏览器连接池配置指南

## 📋 概述

浏览器连接池 (BrowserPool) 是 Anker Web Sentinel 的核心组件,负责管理 Playwright 浏览器实例,提供高效、稳定的浏览器资源。

---

## 🎯 核心功能

### 1. 连接池管理
- **预热实例**: 启动时创建多个浏览器实例
- **智能分配**: 自动分配健康的浏览器给请求
- **排队机制**: 当所有浏览器忙碌时,请求进入队列等待

### 2. 健康检查
- **定期检测**: 每分钟自动检查浏览器健康状态
- **自动替换**: 发现问题浏览器立即替换
- **崩溃恢复**: 浏览器崩溃时自动创建新实例

### 3. 智能淘汰
- **年龄限制**: 超过最大存活时间的浏览器会被替换
- **使用次数限制**: 使用次数过多的浏览器会被替换
- **崩溃次数限制**: 频繁崩溃的浏览器会被移除

### 4. 监控统计
- **实时统计**: 提供详细的连接池状态信息
- **历史统计**: 记录总使用次数、崩溃次数等
- **健康度评估**: 评估系统整体健康状况

---

## ⚙️ 配置参数

### 环境变量配置

在 `.env` 文件或环境变量中设置以下参数:

```bash
# 浏览器池大小 (默认: 5)
# 建议: 根据服务器 CPU 核心数和内存大小调整
# 计算公式: CPU核心数 * 0.5 到 CPU核心数 * 1
BROWSER_POOL_SIZE=5

# 每个浏览器最大上下文数 (默认: 3)
# 说明: 每个浏览器可以同时打开的页面数
# 建议: 保持 3-5 之间,避免单个浏览器负载过重
MAX_CONTEXTS_PER_BROWSER=3

# 健康检查间隔 (默认: 60000ms = 1分钟)
# 说明: 每隔多久检查一次浏览器健康状态
# 建议: 高频使用环境可以缩短到 30000ms
HEALTH_CHECK_INTERVAL=60000

# 最大崩溃次数 (默认: 3)
# 说明: 浏览器崩溃超过此次数后将被替换
# 建议: 保持 2-5 之间
MAX_CRASH_COUNT=3

# 浏览器最大存活时间 (默认: 3600000ms = 1小时)
# 说明: 浏览器运行超过此时间后将被替换
# 建议: 高频使用环境可以设置为 1800000ms (30分钟)
MAX_BROWSER_AGE=3600000

# 浏览器最大使用次数 (默认: 100)
# 说明: 浏览器使用超过此次数后将被替换
# 建议: 根据内存情况调整,内存充足可以增加到 200
MAX_BROWSER_USAGE=100

# 浏览器启动超时时间 (默认: 60000ms = 1分钟)
# 说明: 启动浏览器的最大等待时间
# 建议: 服务器性能较差时可以增加到 90000ms
BROWSER_LAUNCH_TIMEOUT=60000
```

### 配置示例

#### 1. 高性能服务器配置 (8核 16GB)
```bash
BROWSER_POOL_SIZE=8
MAX_CONTEXTS_PER_BROWSER=4
HEALTH_CHECK_INTERVAL=30000
MAX_CRASH_COUNT=5
MAX_BROWSER_AGE=1800000  # 30分钟
MAX_BROWSER_USAGE=200
BROWSER_LAUNCH_TIMEOUT=60000
```

#### 2. 标准服务器配置 (4核 8GB)
```bash
BROWSER_POOL_SIZE=5
MAX_CONTEXTS_PER_BROWSER=3
HEALTH_CHECK_INTERVAL=60000
MAX_CRASH_COUNT=3
MAX_BROWSER_AGE=3600000  # 1小时
MAX_BROWSER_USAGE=100
BROWSER_LAUNCH_TIMEOUT=60000
```

#### 3. 低配服务器配置 (2核 4GB)
```bash
BROWSER_POOL_SIZE=3
MAX_CONTEXTS_PER_BROWSER=2
HEALTH_CHECK_INTERVAL=90000
MAX_CRASH_COUNT=2
MAX_BROWSER_AGE=5400000  # 1.5小时
MAX_BROWSER_USAGE=50
BROWSER_LAUNCH_TIMEOUT=90000
```

---

## 📊 监控 API

### 1. 基础统计信息

```bash
GET /api/v1/monitor/browser-pool
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 5,
    "inUse": 2,
    "available": 3,
    "queued": 0,
    "healthy": 5,
    "unhealthy": 0,
    "totalUsage": 47,
    "averageAge": 325,
    "oldestBrowserAge": 450
  },
  "timestamp": "2025-12-17T11:00:00.000Z"
}
```

**字段说明**:
- `total`: 连接池总浏览器数
- `inUse`: 正在使用的浏览器数
- `available`: 可用的浏览器数
- `queued`: 排队等待的请求数
- `healthy`: 健康的浏览器数
- `unhealthy`: 不健康的浏览器数
- `totalUsage`: 总使用次数
- `averageAge`: 平均存活时间(秒)
- `oldestBrowserAge`: 最老的浏览器年龄(秒)

### 2. 详细统计信息

```bash
GET /api/v1/monitor/browser-pool/detailed
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "pool": {
      "total": 5,
      "inUse": 2,
      "available": 3,
      "queued": 0,
      "healthy": 5,
      "unhealthy": 0,
      "totalUsage": 47,
      "averageAge": 325,
      "oldestBrowserAge": 450
    },
    "lifetime": {
      "totalAcquired": 123,
      "totalReleased": 121,
      "totalCrashes": 2,
      "totalReplacements": 3,
      "totalHealthChecks": 15
    },
    "config": {
      "poolSize": 5,
      "maxContextsPerBrowser": 3,
      "healthCheckInterval": 60000,
      "maxCrashCount": 3,
      "maxBrowserAge": 3600000,
      "maxBrowserUsage": 100,
      "launchTimeout": 60000
    },
    "browsers": [
      {
        "connected": true,
        "inUse": false,
        "age": 325,
        "usage": 8,
        "crashes": 0,
        "lastError": null
      },
      {
        "connected": true,
        "inUse": true,
        "age": 450,
        "usage": 12,
        "crashes": 0,
        "lastError": null
      }
    ]
  },
  "timestamp": "2025-12-17T11:00:00.000Z"
}
```

### 3. 系统健康检查

```bash
GET /api/v1/monitor/health
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-12-17T11:00:00.000Z",
    "uptime": 3600,
    "memory": {
      "heapUsed": 256,
      "heapTotal": 512,
      "rss": 768
    },
    "browserPool": {
      "total": 5,
      "available": 3,
      "healthy": 5,
      "unhealthy": 0,
      "queued": 0
    }
  }
}
```

**健康状态**:
- `healthy`: 系统正常
- `degraded`: 系统降级(部分浏览器不健康)

---

## 🚀 使用指南

### 1. 基本使用

浏览器池在服务器启动时自动初始化,服务会自动从池中获取和释放浏览器:

```typescript
import browserPool from './automation/BrowserPool.js';

// 获取浏览器
const browser = await browserPool.acquire();

try {
  // 使用浏览器
  const page = await browser.newPage();
  await page.goto('https://example.com');

  // ... 你的逻辑

} finally {
  // 释放浏览器回池
  await browserPool.release(browser);
}
```

### 2. 自定义配置

如果需要创建自定义配置的浏览器池:

```typescript
import { BrowserPool } from './automation/BrowserPool.js';

const customPool = new BrowserPool({
  poolSize: 3,
  maxCrashCount: 2,
  maxBrowserAge: 1800000, // 30分钟
});

await customPool.initialize();
```

### 3. 获取统计信息

```typescript
// 获取基础统计
const stats = browserPool.getStats();
console.log('Available browsers:', stats.available);

// 获取详细统计
const detailedStats = browserPool.getDetailedStats();
console.log('Total crashes:', detailedStats.lifetime.totalCrashes);
```

### 4. 优雅关闭

```typescript
// 关闭浏览器池(通常在服务器关闭时调用)
await browserPool.shutdown();
```

---

## 🔍 故障排查

### 问题 1: 浏览器频繁崩溃

**症状**: 日志中频繁出现 `Browser disconnected`

**可能原因**:
1. 内存不足
2. 浏览器参数不当
3. 目标网站触发了浏览器保护机制

**解决方案**:
```bash
# 1. 减小连接池大小
BROWSER_POOL_SIZE=3

# 2. 缩短浏览器生命周期
MAX_BROWSER_AGE=1800000  # 30分钟
MAX_BROWSER_USAGE=50

# 3. 降低崩溃容忍度
MAX_CRASH_COUNT=2

# 4. 检查系统内存
free -h
```

### 问题 2: 请求排队

**症状**: 日志中出现 `No available browsers, queuing request`

**可能原因**:
1. 并发请求过多
2. 连接池大小不足
3. 浏览器未及时释放

**解决方案**:
```bash
# 1. 增加连接池大小
BROWSER_POOL_SIZE=8

# 2. 增加健康检查频率
HEALTH_CHECK_INTERVAL=30000

# 3. 检查是否有浏览器泄漏
curl http://localhost:3000/api/v1/monitor/browser-pool/detailed
```

### 问题 3: 内存占用过高

**症状**: 服务器内存使用率持续上升

**可能原因**:
1. 浏览器实例过多
2. 浏览器生命周期过长
3. 页面未正确关闭

**解决方案**:
```bash
# 1. 减小连接池大小
BROWSER_POOL_SIZE=3

# 2. 缩短浏览器生命周期
MAX_BROWSER_AGE=1800000  # 30分钟
MAX_BROWSER_USAGE=50

# 3. 检查内存使用
curl http://localhost:3000/api/v1/monitor/health
```

### 问题 4: 浏览器启动失败

**症状**: 日志中出现 `Failed to create browser`

**可能原因**:
1. 系统资源不足
2. Chromium 依赖缺失
3. 权限问题

**解决方案**:
```bash
# 1. 检查 Chromium 依赖
npx playwright install chromium
npx playwright install-deps chromium

# 2. 增加启动超时
BROWSER_LAUNCH_TIMEOUT=90000

# 3. 检查权限
ls -la /tmp
```

---

## 📈 性能优化建议

### 1. 根据硬件调整配置

**CPU 核心数**:
- 2核: BROWSER_POOL_SIZE=2-3
- 4核: BROWSER_POOL_SIZE=4-5
- 8核: BROWSER_POOL_SIZE=6-8
- 16核: BROWSER_POOL_SIZE=10-12

**内存大小**:
- 4GB: BROWSER_POOL_SIZE=2-3, MAX_BROWSER_USAGE=50
- 8GB: BROWSER_POOL_SIZE=4-5, MAX_BROWSER_USAGE=100
- 16GB: BROWSER_POOL_SIZE=6-8, MAX_BROWSER_USAGE=200

### 2. 根据使用场景调整

**高频巡检场景**:
```bash
BROWSER_POOL_SIZE=8
HEALTH_CHECK_INTERVAL=30000
MAX_BROWSER_AGE=1800000  # 30分钟
MAX_BROWSER_USAGE=200
```

**低频测试场景**:
```bash
BROWSER_POOL_SIZE=3
HEALTH_CHECK_INTERVAL=120000  # 2分钟
MAX_BROWSER_AGE=7200000  # 2小时
MAX_BROWSER_USAGE=50
```

### 3. 监控关键指标

定期检查以下指标:
- **排队请求数**: 应该保持在 0
- **不健康浏览器数**: 应该 < 总数的 20%
- **平均使用次数**: 应该 < MAX_BROWSER_USAGE 的 80%
- **崩溃率**: totalCrashes / totalAcquired < 5%

---

## 🎓 最佳实践

### 1. 生产环境配置
```bash
# 使用稳定的配置
BROWSER_POOL_SIZE=5
MAX_CONTEXTS_PER_BROWSER=3
HEALTH_CHECK_INTERVAL=60000
MAX_CRASH_COUNT=3
MAX_BROWSER_AGE=3600000
MAX_BROWSER_USAGE=100
BROWSER_LAUNCH_TIMEOUT=60000
```

### 2. 监控告警
- 设置健康检查监控(每5分钟检查一次)
- 当不健康浏览器数 > 2 时发送告警
- 当排队请求数 > 5 时发送告警

### 3. 定期维护
- 每周查看崩溃日志
- 每月评估配置是否需要调整
- 定期更新 Playwright 版本

### 4. 日志分析
- 关注 `[BrowserPool]` 标签的日志
- 记录崩溃模式,识别问题网站
- 统计平均使用时长和崩溃率

---

## 📞 技术支持

如有问题,请查看:
1. 服务器日志: `pm2 logs anita-backend`
2. 浏览器池统计: `GET /api/v1/monitor/browser-pool/detailed`
3. 系统健康: `GET /api/v1/monitor/health`

---

**文档版本**: 1.0.0
**最后更新**: 2025-12-17
**适用版本**: Anker Web Sentinel v1.0+
