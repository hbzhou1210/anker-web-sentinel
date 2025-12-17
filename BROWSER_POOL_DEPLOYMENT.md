# 浏览器连接池部署指南

## 🚀 快速部署

本指南将帮助您部署增强版的浏览器连接池功能。

---

## 📦 更新内容

### 1. 核心功能增强

#### ✅ 已实现的增强功能:

1. **智能健康检查**
   - 自动检测浏览器连接状态
   - 检测崩溃次数
   - 检测浏览器年龄
   - 检测使用次数

2. **自动崩溃恢复**
   - 浏览器崩溃时自动创建新实例
   - 记录崩溃统计
   - 防止崩溃浏览器继续使用

3. **完整的配置系统**
   - 所有参数可通过环境变量配置
   - 支持不同场景的配置模板
   - 配置热重载(重启服务生效)

4. **详细的监控 API**
   - 基础统计信息
   - 详细统计信息
   - 系统健康检查

### 2. 新增 API 端点

```
GET /api/v1/monitor/browser-pool          - 基础统计
GET /api/v1/monitor/browser-pool/detailed - 详细统计
GET /api/v1/monitor/health                 - 系统健康检查
```

---

## 📝 部署步骤

### 步骤 1: 停止当前服务

```bash
pm2 stop anita-backend
```

### 步骤 2: 拉取最新代码

```bash
cd /Users/anker/anita-project
git pull origin master
```

### 步骤 3: 配置环境变量(可选)

编辑 `.env` 文件或设置环境变量:

```bash
# 推荐配置(根据您的服务器调整)
export BROWSER_POOL_SIZE=5
export MAX_CONTEXTS_PER_BROWSER=3
export HEALTH_CHECK_INTERVAL=60000
export MAX_CRASH_COUNT=3
export MAX_BROWSER_AGE=3600000
export MAX_BROWSER_USAGE=100
export BROWSER_LAUNCH_TIMEOUT=60000
```

**或者** 在 `backend/.env` 文件中添加:

```ini
# 浏览器连接池配置
BROWSER_POOL_SIZE=5
MAX_CONTEXTS_PER_BROWSER=3
HEALTH_CHECK_INTERVAL=60000
MAX_CRASH_COUNT=3
MAX_BROWSER_AGE=3600000
MAX_BROWSER_USAGE=100
BROWSER_LAUNCH_TIMEOUT=60000
```

### 步骤 4: 编译代码

```bash
cd backend
npm run build
```

### 步骤 5: 重启服务

```bash
pm2 restart anita-backend
```

### 步骤 6: 验证部署

```bash
# 1. 检查服务状态
pm2 status

# 2. 查看启动日志
pm2 logs anita-backend --lines 50

# 3. 测试监控 API
curl http://localhost:3000/api/v1/monitor/browser-pool

# 4. 测试健康检查
curl http://localhost:3000/api/v1/monitor/health
```

---

## ✅ 部署验证

### 1. 检查启动日志

您应该看到类似以下的日志:

```
[BrowserPool] Initialized with config: {
  poolSize: 5,
  maxContextsPerBrowser: 3,
  healthCheckInterval: 60000,
  maxCrashCount: 3,
  maxBrowserAge: 3600000,
  maxBrowserUsage: 100,
  launchTimeout: 60000
}
[BrowserPool] Initializing with 5 instances...
[BrowserPool] Browser 1/5 created
[BrowserPool] Browser 2/5 created
[BrowserPool] Browser 3/5 created
[BrowserPool] Browser 4/5 created
[BrowserPool] Browser 5/5 created
✓ Browser pool initialized with 5 instances
[BrowserPool] Health check started
```

### 2. 测试监控 API

```bash
# 基础统计
curl http://10.5.3.150:10038/api/v1/monitor/browser-pool

# 预期响应:
{
  "success": true,
  "data": {
    "total": 5,
    "inUse": 0,
    "available": 5,
    "queued": 0,
    "healthy": 5,
    "unhealthy": 0,
    "totalUsage": 0,
    "averageAge": 10,
    "oldestBrowserAge": 12
  },
  "timestamp": "2025-12-17T11:00:00.000Z"
}
```

```bash
# 详细统计
curl http://10.5.3.150:10038/api/v1/monitor/browser-pool/detailed

# 预期响应: 包含 pool, lifetime, config, browsers 等详细信息
```

```bash
# 健康检查
curl http://10.5.3.150:10038/api/v1/monitor/health

# 预期响应:
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-12-17T11:00:00.000Z",
    "uptime": 120,
    "memory": {
      "heapUsed": 256,
      "heapTotal": 512,
      "rss": 768
    },
    "browserPool": {
      "total": 5,
      "available": 5,
      "healthy": 5,
      "unhealthy": 0,
      "queued": 0
    }
  }
}
```

### 3. 测试实际功能

```bash
# 测试响应式检测 API (之前崩溃的功能)
curl -X POST http://10.5.3.150:10038/api/v1/responsive/check \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.anker.com",
    "devices": ["mobile", "desktop"]
  }'

# 预期: 返回 200 OK,包含完整的响应式数据
```

---

## 📊 监控和维护

### 1. 实时监控

**创建监控脚本** (`monitor-browser-pool.sh`):

```bash
#!/bin/bash

echo "=== 浏览器池监控 ==="
echo ""

while true; do
  # 获取统计信息
  stats=$(curl -s http://localhost:3000/api/v1/monitor/browser-pool)

  # 解析并显示
  echo "[$(date '+%Y-%m-%d %H:%M:%S')]"
  echo "$stats" | jq '.data | {total, inUse, available, queued, healthy, unhealthy}'
  echo ""

  # 等待 30 秒
  sleep 30
done
```

使用方法:
```bash
chmod +x monitor-browser-pool.sh
./monitor-browser-pool.sh
```

### 2. 定期健康检查

**添加 cron 任务**:

```bash
# 编辑 crontab
crontab -e

# 每 5 分钟检查一次健康状态
*/5 * * * * curl -s http://localhost:3000/api/v1/monitor/health | jq '.data.status' | grep -q "healthy" || echo "Browser pool unhealthy!" | mail -s "Alert: Browser Pool" admin@example.com
```

### 3. 日志监控

```bash
# 实时查看浏览器池日志
pm2 logs anita-backend | grep "\[BrowserPool\]"

# 查看崩溃日志
pm2 logs anita-backend | grep "Browser crashed"

# 查看健康检查日志
pm2 logs anita-backend | grep "Health check complete"
```

---

## 🔧 故障排查

### 问题 1: 服务启动失败

**检查步骤**:
```bash
# 1. 查看详细日志
pm2 logs anita-backend --lines 100

# 2. 检查端口占用
lsof -i:3000

# 3. 检查依赖
cd backend && npm install

# 4. 手动启动测试
cd backend && npm start
```

### 问题 2: 浏览器池初始化失败

**检查步骤**:
```bash
# 1. 检查 Chromium 是否安装
npx playwright install chromium

# 2. 检查依赖
npx playwright install-deps chromium

# 3. 检查权限
ls -la /tmp

# 4. 检查内存
free -h
```

### 问题 3: 监控 API 返回 404

**检查步骤**:
```bash
# 1. 确认路由已加载
pm2 logs anita-backend | grep "monitor"

# 2. 测试基础健康检查
curl http://localhost:3000/health

# 3. 检查代码版本
cd backend && git log --oneline -5
```

---

## 📈 性能调优

### 1. 根据服务器配置调整

**查看服务器配置**:
```bash
# CPU 核心数
nproc

# 内存大小
free -h

# 当前负载
top
```

**调整建议**:

- **2核 4GB**: `BROWSER_POOL_SIZE=3`
- **4核 8GB**: `BROWSER_POOL_SIZE=5`
- **8核 16GB**: `BROWSER_POOL_SIZE=8`

### 2. 监控关键指标

```bash
# 每分钟检查一次
watch -n 60 'curl -s http://localhost:3000/api/v1/monitor/browser-pool | jq ".data | {inUse, available, queued, unhealthy}"'
```

**关注指标**:
- `queued`: 应该保持在 0
- `unhealthy`: 应该 < 总数的 20%
- `inUse`: 高峰期不应接近 `total`

---

## 🎯 测试清单

部署后请完成以下测试:

- [ ] 服务正常启动
- [ ] 浏览器池初始化成功
- [ ] 健康检查定时器启动
- [ ] 监控 API 正常返回
- [ ] 健康检查 API 正常返回
- [ ] 响应式测试 API 正常工作
- [ ] 巡检任务正常执行
- [ ] 浏览器崩溃后自动恢复
- [ ] 健康检查正常替换老旧浏览器
- [ ] 日志输出清晰完整

---

## 📞 回滚步骤

如果部署后出现问题,可以快速回滚:

```bash
# 1. 停止服务
pm2 stop anita-backend

# 2. 回滚代码
cd /Users/anker/anita-project
git reset --hard HEAD~1

# 3. 重新编译
cd backend && npm run build

# 4. 重启服务
pm2 restart anita-backend
```

---

## ✨ 预期改进

部署后,您应该看到以下改进:

1. **零浏览器崩溃导致的 500 错误**
   - 浏览器崩溃时自动替换
   - 不影响其他正在执行的任务

2. **更稳定的响应式测试**
   - 自动重试机制
   - 健康的浏览器实例

3. **更好的可观测性**
   - 实时监控浏览器池状态
   - 详细的统计信息
   - 健康度评估

4. **更低的维护成本**
   - 自动恢复机制
   - 清晰的日志输出
   - 简单的配置管理

---

## 📚 相关文档

- [浏览器连接池配置指南](BROWSER_POOL_CONFIG.md)
- [综合测试报告](COMPREHENSIVE_TEST_REPORT.md)
- [故障排查指南](BROWSER_POOL_CONFIG.md#故障排查)

---

**部署支持**: 如有问题,请查看日志或联系技术支持
**文档版本**: 1.0.0
**最后更新**: 2025-12-17
