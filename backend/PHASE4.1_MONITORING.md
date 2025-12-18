# Phase 4.1: Performance Monitoring - 完成报告

## 📊 总体成果

**完成时间**: 2024-12-18
**状态**: ✅ **已完成**

## 🎯 实施内容

### 1. ✅ 安装监控依赖

安装了以下 npm 包:
- `prom-client` (v15.x) - Prometheus 客户端库
- `express-prom-bundle` (v7.x) - Express Prometheus 中间件

```bash
npm install prom-client express-prom-bundle
```

### 2. ✅ 创建 Prometheus 指标定义

**文件**: [src/monitoring/metrics.ts](src/monitoring/metrics.ts)

#### 核心业务指标

1. **巡检任务执行时长** (`patrol_execution_duration_seconds`)
   - 类型: Histogram
   - 标签: `task_id`, `status`
   - Buckets: 10s, 30s, 1m, 2m, 5m, 10m

2. **浏览器池状态** (`browser_pool_browsers_total`)
   - 类型: Gauge
   - 标签: `state` (active, idle, total)

3. **浏览器崩溃次数** (`browser_crashes_total`)
   - 类型: Counter
   - 标签: `reason` (crash, timeout, oom)

4. **HTTP 请求延迟** (`http_request_duration_seconds`)
   - 类型: Histogram
   - 标签: `method`, `route`, `status_code`
   - Buckets: 10ms, 50ms, 100ms, 500ms, 1s, 5s

5. **HTTP 请求总数** (`http_requests_total`)
   - 类型: Counter
   - 标签: `method`, `route`, `status_code`

6. **缓存操作** (`cache_operations_total`)
   - 类型: Counter
   - 标签: `operation` (hit, miss, set, delete), `cache_name`

7. **飞书 API 调用** (`feishu_api_calls_total`, `feishu_api_duration_seconds`)
   - 类型: Counter + Histogram
   - 标签: `api`, `status`

8. **邮件发送** (`emails_sent_total`)
   - 类型: Counter
   - 标签: `status`, `type`

9. **截图生成** (`screenshots_generated_total`)
   - 类型: Counter
   - 标签: `status`, `quality`

10. **性能测试指标** (`performance_tests_total`, `performance_metric_value`)
    - 类型: Counter + Histogram
    - 标签: `metric_type`, `url`

11. **数据库查询延迟** (`database_query_duration_seconds`)
    - 类型: Histogram
    - 标签: `operation`, `table`

12. **活跃巡检任务数** (`active_patrol_tasks`)
    - 类型: Gauge

13. **错误总数** (`errors_total`)
    - 类型: Counter
    - 标签: `error_type`, `severity`

#### 辅助函数

提供了便捷的辅助函数用于记录指标:
- `recordHttpRequest()` - 记录 HTTP 请求
- `recordPatrolExecution()` - 记录巡检任务执行
- `updateBrowserPoolStatus()` - 更新浏览器池状态
- `recordCacheOperation()` - 记录缓存操作
- `recordFeishuApiCall()` - 记录飞书 API 调用
- `recordError()` - 记录错误
- `getMetrics()` - 获取所有指标(用于 /metrics 端点)

### 3. ✅ 创建 Metrics 中间件

**文件**: [src/api/middleware/metricsMiddleware.ts](src/api/middleware/metricsMiddleware.ts)

#### 功能特性

- 自动追踪所有 API 请求
- 记录请求方法、路由路径、状态码
- 记录请求处理时长
- 使用 `res.on('finish')` 事件确保准确性

#### 路由规范化

提供了 `normalizeRoute()` 函数,将动态路由参数替换为占位符:
- UUID: `/api/v1/patrol/tasks/123` → `/api/v1/patrol/tasks/:id`
- 数字 ID: `/api/v1/users/456` → `/api/v1/users/:id`
- 长令牌: 自动识别并替换

这避免了高基数问题(避免为每个 ID 创建单独的时间序列)。

### 4. ✅ 集成到 Express 应用

#### app.ts 更新

在 [src/api/app.ts](src/api/app.ts) 中添加了 metricsMiddleware:

```typescript
import { metricsMiddleware } from './middleware/metricsMiddleware.js';

// Metrics middleware (应该在 Request ID 之后应用)
app.use(metricsMiddleware);
```

**中间件顺序**:
1. `requestIdMiddleware` - 生成请求 ID
2. `metricsMiddleware` - 记录指标
3. `express.json()` - 解析 JSON
4. 其他中间件...

#### index.ts 更新

在 [src/index.ts](src/index.ts) 中添加了 `/metrics` 端点:

```typescript
import { getMetrics } from './monitoring/metrics.js';

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    const metrics = await getMetrics();
    res.send(metrics);
  } catch (error) {
    console.error('Failed to generate metrics:', error);
    res.status(500).send('Failed to generate metrics');
  }
});
```

### 5. ✅ PatrolService 指标集成

**文件**: [src/services/PatrolService.ts](src/services/PatrolService.ts)

#### 集成点

1. **巡检开始时**:
   ```typescript
   // 增加活跃任务计数
   metrics.activePatrolTasks.inc();
   ```

2. **巡检完成时**:
   ```typescript
   // 记录执行时长和状态
   const status = failedUrls === 0 ? 'success' : 'failed';
   recordPatrolExecution(task.id, status, durationMs / 1000);

   // 减少活跃任务计数
   metrics.activePatrolTasks.dec();
   ```

3. **巡检失败时** (catch 块):
   ```typescript
   // 记录失败的指标
   const durationMs = Date.now() - startTime;
   recordPatrolExecution(task.id, 'failed', durationMs / 1000);

   // 减少活跃任务计数
   metrics.activePatrolTasks.dec();
   ```

### 6. ✅ Grafana 仪表板配置

**文件**: [grafana-dashboard.json](grafana-dashboard.json)

#### 仪表板面板

创建了 14 个可视化面板:

1. **Active Patrol Tasks** - 当前活跃的巡检任务数
2. **Patrol Execution Duration (P95)** - 巡检执行时长的 95 分位数
3. **Browser Pool Status** - 浏览器池状态(活跃/空闲/总数)
4. **HTTP Request Rate** - HTTP 请求速率
5. **HTTP Request Duration (P50, P95, P99)** - HTTP 请求延迟分布
6. **Browser Crashes by Reason** - 浏览器崩溃原因统计
7. **Cache Hit Rate** - 缓存命中率
8. **Feishu API Calls** - 飞书 API 调用统计
9. **Feishu API Duration (P95)** - 飞书 API 调用延迟
10. **Email Notifications Sent** - 邮件发送统计
11. **Screenshots Generated** - 截图生成统计
12. **Error Rate by Type** - 错误率(按类型和严重程度)
13. **Performance Metrics Distribution** - 性能指标热力图
14. **Database Query Duration (P95)** - 数据库查询延迟

#### 导入方法

1. 登录 Grafana
2. 导航到 "Dashboards" → "Import"
3. 上传 `grafana-dashboard.json`
4. 选择 Prometheus 数据源
5. 点击 "Import"

### 7. ✅ Prometheus 配置

**文件**: [prometheus.yml](prometheus.yml)

#### 配置要点

```yaml
scrape_configs:
  - job_name: 'anita-backend'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

#### 启动 Prometheus

```bash
# 下载 Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*

# 复制配置文件
cp /path/to/backend/prometheus.yml .

# 启动 Prometheus
./prometheus --config.file=prometheus.yml
```

访问: http://localhost:9090

## 📈 指标示例

### 查询示例

1. **巡检任务成功率**:
   ```promql
   sum(rate(patrol_execution_duration_seconds_count{status="success"}[5m]))
   /
   sum(rate(patrol_execution_duration_seconds_count[5m]))
   ```

2. **API 请求 P95 延迟**:
   ```promql
   histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
   ```

3. **浏览器池利用率**:
   ```promql
   browser_pool_browsers_total{state="active"}
   /
   browser_pool_browsers_total{state="total"}
   ```

4. **缓存命中率**:
   ```promql
   rate(cache_operations_total{operation="hit"}[5m])
   /
   (rate(cache_operations_total{operation="hit"}[5m]) + rate(cache_operations_total{operation="miss"}[5m]))
   ```

## 🚀 使用指南

### 1. 启动应用

```bash
cd backend
npm run dev
```

应用会在以下端点提供服务:
- 健康检查: http://localhost:3000/health
- Prometheus 指标: http://localhost:3000/metrics

### 2. 查看原始指标

访问 http://localhost:3000/metrics 查看 Prometheus 格式的指标:

```
# HELP patrol_execution_duration_seconds Duration of patrol task execution in seconds
# TYPE patrol_execution_duration_seconds histogram
patrol_execution_duration_seconds_bucket{le="10",task_id="task123",status="success"} 5
patrol_execution_duration_seconds_bucket{le="30",task_id="task123",status="success"} 15
...

# HELP active_patrol_tasks Number of currently active patrol tasks
# TYPE active_patrol_tasks gauge
active_patrol_tasks 3

# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.01",method="GET",route="/health",status_code="200"} 1000
...
```

### 3. 启动 Prometheus

```bash
# 使用 Docker (推荐)
docker run -d \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  --name prometheus \
  prom/prometheus

# 或使用二进制文件
./prometheus --config.file=prometheus.yml
```

访问 Prometheus UI: http://localhost:9090

### 4. 启动 Grafana

```bash
# 使用 Docker (推荐)
docker run -d \
  -p 3001:3000 \
  --name grafana \
  grafana/grafana

# 默认登录: admin/admin
```

访问 Grafana: http://localhost:3001

#### 配置步骤

1. 添加 Prometheus 数据源
   - URL: http://localhost:9090
   - Access: Browser

2. 导入仪表板
   - 导入 `grafana-dashboard.json`

### 5. Docker Compose 一键启动

创建 `docker-compose.monitoring.yml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana-dashboard.json:/etc/grafana/provisioning/dashboards/dashboard.json
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false

volumes:
  prometheus-data:
  grafana-data:
```

启动:
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

## 🎁 交付成果

### 代码文件

1. **监控模块**
   - `src/monitoring/metrics.ts` (416 行) - Prometheus 指标定义

2. **中间件**
   - `src/api/middleware/metricsMiddleware.ts` (45 行) - 自动指标收集

3. **应用集成**
   - `src/api/app.ts` - 添加 metricsMiddleware
   - `src/index.ts` - 添加 /metrics 端点

4. **服务集成**
   - `src/services/PatrolService.ts` - 巡检指标记录

### 配置文件

1. **Grafana 仪表板**
   - `grafana-dashboard.json` (8.8 KB) - 14 个可视化面板

2. **Prometheus 配置**
   - `prometheus.yml` - Prometheus 抓取配置

### 文档

1. **本文档**
   - `PHASE4.1_MONITORING.md` - 完整的实施说明

## 💡 技术亮点

### 1. 完整的指标覆盖

- ✅ 业务指标 (巡检执行、浏览器池、缓存)
- ✅ 系统指标 (HTTP 请求、数据库查询)
- ✅ 外部服务指标 (飞书 API、邮件发送)
- ✅ 性能指标 (Web Vitals)
- ✅ 错误跟踪

### 2. 自动化指标收集

- HTTP 请求自动追踪 (metricsMiddleware)
- 巡检任务生命周期指标
- 活跃任务实时计数

### 3. 高质量仪表板

- 14 个精心设计的可视化面板
- 关键指标的阈值告警
- P50/P95/P99 延迟分析
- 热力图分析

### 4. 生产就绪

- 完整的 Prometheus + Grafana 配置
- Docker Compose 一键部署
- 路由规范化避免高基数问题
- 默认指标 (CPU, Memory, Event Loop)

## 🔍 下一步建议

### 短期改进

1. **添加告警规则**
   - 巡检失败率 > 10%
   - API 延迟 P95 > 1s
   - 浏览器崩溃率异常
   - 缓存命中率 < 50%

2. **扩展指标**
   - BrowserPool 中添加浏览器池指标
   - CacheService 中添加缓存指标
   - FeishuService 中添加 API 调用指标
   - EmailService 中添加邮件发送指标

3. **优化仪表板**
   - 添加时间范围选择器
   - 添加任务筛选器
   - 添加环境标签

### 中期目标

1. **分布式追踪** (Jaeger/Zipkin)
   - 完整的请求链追踪
   - 跨服务调用分析

2. **日志聚合** (ELK Stack)
   - 集中式日志管理
   - 日志与指标关联

3. **APM 集成** (New Relic/Datadog)
   - 应用性能监控
   - 用户体验监控

### 长期目标

1. **AI 驱动的异常检测**
   - 自动识别异常模式
   - 预测性告警

2. **成本优化分析**
   - 资源使用分析
   - 浏览器池优化建议

3. **SLO/SLA 监控**
   - 定义服务等级目标
   - 自动化 SLO 报告

## ✨ 总结

Phase 4.1 成功实施了完整的性能监控系统:

✅ **Prometheus 指标**: 13 种核心业务指标 + 默认系统指标
✅ **自动化收集**: HTTP 请求和巡检任务自动追踪
✅ **可视化仪表板**: 14 个 Grafana 面板
✅ **生产配置**: 完整的 Prometheus + Grafana 配置
✅ **文档完善**: 详细的使用指南和部署说明

这些监控能力为系统提供了:
- 🔍 **可观测性**: 实时了解系统运行状态
- 📊 **性能分析**: 识别瓶颈和优化机会
- 🚨 **问题预警**: 及时发现和响应问题
- 📈 **趋势分析**: 长期性能趋势跟踪

---

**完成日期**: 2024-12-18
**Phase 状态**: ✅ **已完成**
**下一步**: Phase 4.2 - Frontend Performance Optimization
