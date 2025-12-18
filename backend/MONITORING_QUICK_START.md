# 监控系统快速开始指南

## 🚀 快速启动

### 1. 启动应用

```bash
cd backend
npm run dev
```

应用启动后,访问以下端点:

- **健康检查**: http://localhost:3000/health
- **Prometheus 指标**: http://localhost:3000/metrics

### 2. 查看指标

打开浏览器访问 http://localhost:3000/metrics

你会看到类似这样的输出:

```
# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total 0.5

# HELP active_patrol_tasks Number of currently active patrol tasks
# TYPE active_patrol_tasks gauge
active_patrol_tasks 0

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/health",status_code="200"} 10

# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.01",method="GET",route="/health",status_code="200"} 8
http_request_duration_seconds_bucket{le="0.05",method="GET",route="/health",status_code="200"} 10
...
```

## 📊 使用 Docker 启动监控栈

### 使用 Docker Compose (推荐)

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
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - monitoring
    depends_on:
      - prometheus

volumes:
  prometheus-data:
  grafana-data:

networks:
  monitoring:
```

启动监控栈:

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

### 访问监控界面

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (默认登录: admin/admin)

## 🎯 配置 Grafana

### 1. 添加 Prometheus 数据源

1. 登录 Grafana (http://localhost:3001)
2. 点击左侧菜单 "Configuration" → "Data Sources"
3. 点击 "Add data source"
4. 选择 "Prometheus"
5. 配置:
   - Name: `Prometheus`
   - URL: `http://prometheus:9090` (Docker 网络内) 或 `http://localhost:9090` (本地)
6. 点击 "Save & Test"

### 2. 导入仪表板

1. 点击左侧菜单 "+" → "Import"
2. 点击 "Upload JSON file"
3. 选择 `grafana-dashboard.json`
4. 选择 Prometheus 数据源
5. 点击 "Import"

## 📈 关键指标说明

### 巡检相关指标

- `active_patrol_tasks` - 当前正在执行的巡检任务数
- `patrol_execution_duration_seconds` - 巡检任务执行时长
  - 标签: `task_id`, `status` (success/failed)

### API 性能指标

- `http_requests_total` - HTTP 请求总数
  - 标签: `method`, `route`, `status_code`
- `http_request_duration_seconds` - HTTP 请求延迟
  - 使用 histogram_quantile 计算 P50/P95/P99

### 浏览器池指标

- `browser_pool_browsers_total` - 浏览器池状态
  - 标签: `state` (active, idle, total)
- `browser_crashes_total` - 浏览器崩溃次数
  - 标签: `reason` (crash, timeout, oom)

### 缓存指标

- `cache_operations_total` - 缓存操作次数
  - 标签: `operation` (hit, miss, set, delete), `cache_name`

### 外部服务指标

- `feishu_api_calls_total` - 飞书 API 调用次数
  - 标签: `api`, `status` (success/error)
- `feishu_api_duration_seconds` - 飞书 API 调用延迟
- `emails_sent_total` - 邮件发送次数
  - 标签: `status`, `type`

## 🔍 常用 PromQL 查询

### 1. API 请求成功率

```promql
sum(rate(http_requests_total{status_code=~"2.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

### 2. API P95 延迟

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### 3. 巡检任务成功率

```promql
sum(rate(patrol_execution_duration_seconds_count{status="success"}[5m]))
/
sum(rate(patrol_execution_duration_seconds_count[5m]))
```

### 4. 浏览器池利用率

```promql
browser_pool_browsers_total{state="active"}
/
browser_pool_browsers_total{state="total"}
```

### 5. 缓存命中率

```promql
rate(cache_operations_total{operation="hit"}[5m])
/
(rate(cache_operations_total{operation="hit"}[5m]) + rate(cache_operations_total{operation="miss"}[5m]))
```

### 6. 每秒错误数

```promql
sum(rate(errors_total[5m])) by (error_type, severity)
```

## 🚨 告警规则示例

创建 `alerts.yml`:

```yaml
groups:
  - name: anita_alerts
    interval: 30s
    rules:
      # 巡检失败率过高
      - alert: HighPatrolFailureRate
        expr: |
          sum(rate(patrol_execution_duration_seconds_count{status="failed"}[5m]))
          /
          sum(rate(patrol_execution_duration_seconds_count[5m]))
          > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高巡检失败率"
          description: "最近 5 分钟巡检失败率超过 10%"

      # API 延迟过高
      - alert: HighAPILatency
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
          > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API 延迟过高"
          description: "P95 延迟超过 1 秒"

      # 浏览器崩溃率异常
      - alert: HighBrowserCrashRate
        expr: |
          sum(rate(browser_crashes_total[5m]))
          > 0.5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "浏览器崩溃率异常"
          description: "浏览器崩溃速率超过 0.5/秒"

      # 缓存命中率过低
      - alert: LowCacheHitRate
        expr: |
          rate(cache_operations_total{operation="hit"}[5m])
          /
          (rate(cache_operations_total{operation="hit"}[5m]) + rate(cache_operations_total{operation="miss"}[5m]))
          < 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "缓存命中率过低"
          description: "缓存命中率低于 50%"
```

## 📚 更多资源

- **详细文档**: [PHASE4.1_MONITORING.md](PHASE4.1_MONITORING.md)
- **Prometheus 文档**: https://prometheus.io/docs/
- **Grafana 文档**: https://grafana.com/docs/
- **prom-client 文档**: https://github.com/siimon/prom-client

## 🆘 故障排除

### 问题 1: /metrics 端点返回 404

**解决方案**: 确保应用已启动,并且 `index.ts` 中已添加 `/metrics` 端点

### 问题 2: Prometheus 无法抓取指标

**解决方案**:
1. 检查 `prometheus.yml` 中的 `targets` 配置
2. 如果使用 Docker,确保网络配置正确
3. 检查防火墙设置

### 问题 3: Grafana 无法连接 Prometheus

**解决方案**:
1. 检查 Prometheus URL 配置
2. 如果使用 Docker Compose,使用服务名 `http://prometheus:9090`
3. 如果本地运行,使用 `http://localhost:9090`

### 问题 4: 指标数据为空

**解决方案**:
1. 访问应用端点生成一些流量
2. 等待 Prometheus 抓取周期(默认 10-15 秒)
3. 检查 Prometheus 的 Targets 页面确认抓取状态

---

**祝监控愉快!** 🎉
