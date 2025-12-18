# 响应式测试异步执行 - 快速部署指南

## 概述

本次更新解决了生产环境响应式测试的 504 超时问题，将测试改为异步执行模式，支持实时进度显示。

**Git Commit**: `96f7c3a`

## 变更内容

### 新增文件
- `backend/src/services/AsyncTaskService.ts` - 异步任务管理服务
- `ASYNC_RESPONSIVE_TEST_IMPLEMENTATION.md` - 详细实现文档
- `test-async-responsive.sh` - 测试脚本

### 修改文件
- `backend/src/api/routes/responsive.ts` - 响应式测试 API
- `frontend/src/pages/ResponsiveTesting.tsx` - 前端页面

## 部署步骤

### 方法 1: Docker 部署（推荐）

```bash
# 1. 拉取最新代码
git pull origin master

# 2. 构建 Docker 镜像
./build-docker.sh

# 3. 重启服务
docker-compose down
docker-compose up -d

# 4. 查看日志确认启动成功
docker-compose logs -f backend
```

### 方法 2: 传统部署

```bash
# 1. 拉取最新代码
git pull origin master

# 2. 后端部署
cd backend
npm install
npm run build

# 重启后端服务
pm2 restart backend  # 或使用您的进程管理器

# 3. 前端部署
cd ../frontend
npm install
npm run build

# 重新加载 Nginx（如果需要）
sudo nginx -s reload

# 4. 验证
curl http://localhost:3000/api/v1/responsive/devices
```

## 验证部署

### 快速验证

```bash
# 方法 1: 使用测试脚本
./test-async-responsive.sh

# 方法 2: 手动测试
# 启动测试
curl -X POST http://localhost:3000/api/v1/responsive/test \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.apple.com", "deviceIds": [1]}'

# 应该返回类似：
# {"success": true, "data": {"taskId": "uuid", "message": "响应式测试已启动", ...}}

# 查询状态（替换 {taskId}）
curl http://localhost:3000/api/v1/responsive/tasks/{taskId}
```

### 浏览器验证

1. 访问应用 URL
2. 进入"响应式测试"页面
3. 输入测试 URL，选择设备
4. 点击"开始测试"
5. **关键验证点**：
   - ✅ 按钮应该立即变为"测试中... (0%)"
   - ✅ 下方应该显示进度条
   - ✅ 进度条应该实时更新
   - ✅ 显示详细进度消息（如："正在测试第 2/3 批 (6/9 已完成)"）
   - ✅ 完成后显示测试结果

## API 变更说明

### 响应式测试 API

**之前**:
```
POST /api/v1/responsive/test
→ 同步执行，直接返回结果（可能超时）
```

**现在**:
```
POST /api/v1/responsive/test
→ 异步执行，立即返回 taskId

GET /api/v1/responsive/tasks/:taskId
→ 查询任务状态和结果
```

### 兼容性

⚠️ **前端必须同时更新**，旧前端无法处理新的异步响应格式。

## 回滚方案

如果部署后发现问题，可以快速回滚：

```bash
# 1. 回退到上一个提交
git reset --hard d3720a8

# 2. 重新构建和部署
# Docker:
./build-docker.sh && docker-compose up -d

# 传统:
cd backend && npm run build && pm2 restart backend
cd frontend && npm run build && nginx -s reload
```

## 监控和日志

### 关键日志标记

部署后，在日志中查找以下标记：

```bash
# 后端日志
docker-compose logs -f backend | grep -E "Task|AsyncTask|responsive"
```

**正常日志示例**:
```
[AsyncTask] Created task abc-123 (responsive-test)
[Task abc-123] Starting tests on 9 devices (max 3 concurrent)...
[Task abc-123] Testing batch 1/3: iPhone 13, iPhone 14, iPhone SE
[Task abc-123] ✓ Completed test on iPhone 13
[Task abc-123] ✓ Completed 9 device tests in 178234ms
```

### 性能指标

关注以下指标：

| 指标 | 预期值 | 说明 |
|------|--------|------|
| API 响应时间 (POST /test) | < 100ms | 应该立即返回 taskId |
| 轮询频率 | 每 2 秒 | 前端轮询任务状态 |
| 任务完成时间 | ~60s/3设备 | 取决于设备数量和并发数 |
| 内存使用 | 正常 | AsyncTaskService 使用内存存储 |

## 常见问题

### Q1: 前端一直显示 "测试中... (0%)"

**原因**: 后端任务没有正常启动或进度更新失败

**排查**:
```bash
# 查看后端日志
docker-compose logs backend | grep "Task"

# 手动查询任务状态
curl http://localhost:3000/api/v1/responsive/tasks/{taskId}
```

### Q2: 任务状态查询返回 404

**原因**: taskId 不存在或任务已过期

**解决**:
- 确认 taskId 正确
- AsyncTaskService 会在 24 小时后清理过期任务

### Q3: 测试结果显示为空

**原因**: 任务执行失败或结果格式错误

**排查**:
```bash
# 查询任务详情
curl http://localhost:3000/api/v1/responsive/tasks/{taskId}

# 查看 error 字段
```

### Q4: 多实例部署时任务状态不一致

**当前限制**: AsyncTaskService 使用内存存储，不支持多实例

**解决方案**:
1. 短期：使用负载均衡的 sticky session
2. 长期：改用 Redis 存储（参考 ASYNC_RESPONSIVE_TEST_IMPLEMENTATION.md）

## 性能优化建议

如果发现性能问题，可以调整以下参数：

### 后端参数

**文件**: `backend/src/api/routes/responsive.ts`

```typescript
// 并发限制（每批测试的设备数）
const CONCURRENT_LIMIT = 3;  // 可以增加到 5

// 重试次数
const maxRetries = 2;  // 减少到 1 可加快失败检测
```

### 前端参数

**文件**: `frontend/src/pages/ResponsiveTesting.tsx`

```typescript
// 轮询间隔
const pollInterval = 2000;  // 毫秒，可以调整为 1000-5000

// 最大轮询次数
const maxAttempts = 300;  // 减少可以更早超时
```

## 下一步优化

该实现为 MVP 版本，后续可以优化：

1. **WebSocket 推送** - 替代轮询，实时性更好
2. **Redis 存储** - 支持多实例部署
3. **任务取消** - 允许用户中止测试
4. **任务历史** - 持久化到数据库

详见 `ASYNC_RESPONSIVE_TEST_IMPLEMENTATION.md`

## 支持

如有问题，请查看：
1. `ASYNC_RESPONSIVE_TEST_IMPLEMENTATION.md` - 详细实现文档
2. 后端日志：`docker-compose logs backend`
3. 浏览器控制台：查找 `[ResponsiveTesting]` 标记的日志

---

**部署日期**: 2025-12-18
**Git Commit**: 96f7c3a
**负责人**: DevOps Team
