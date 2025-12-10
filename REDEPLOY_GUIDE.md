# 🔄 Launch 平台重新部署指南

## 📌 为什么需要重新部署?

代码已修复以下关键问题:
- ✅ Docker 启动速度从 60+ 秒优化到 5 秒
- ✅ 修复 CORS 跨域错误
- ✅ **前端 API 自动适配部署环境 (关键修复!)**

**最新代码已推送到 master 分支 (commit: 1d5152e)**

## 🚀 重新部署步骤

### 方案 1: 触发重新构建 (推荐)
1. 登录 Launch 平台: https://launch.anker-in.com
2. 找到应用 `anitazhou_ankerwebsentinel`
3. 点击 **"重新构建"** 或 **"触发部署"** 按钮
4. 等待构建完成(约 5-10 分钟)

### 方案 2: 如果没有重新构建按钮
1. 登录 Launch 平台
2. 进入应用详情页
3. 找到部署配置页面
4. 确认分支为 `master`
5. 点击 **"保存"** 或 **"更新"** 触发重新部署

## ✅ 验证部署成功

### 1. 检查健康状态
```bash
curl https://anitazhou_ankerwebsentinel.anker-launch.com/health
```
应返回:
```json
{"status":"healthy","timestamp":"2025-12-10T..."}
```

### 2. 访问前端页面
打开浏览器访问: https://anitazhou_ankerwebsentinel.anker-launch.com

**打开开发者工具 (F12) -> Network 标签**

### 3. 验证 API 路径
在 Network 标签中,查看前端发出的 API 请求:
- ✅ **正确**: URL 为相对路径,如 `/api/v1/patrol/tasks`
- ❌ **错误**: URL 为绝对路径,如 `http://localhost:3000/api/v1/...`

### 4. 测试核心功能
- 创建测试任务
- 查看巡检任务列表
- 查看测试报告

## 🔍 排查问题

### 如果仍然报 404 错误

**1. 确认代码版本**
查看 Launch 平台构建日志,确认拉取的是最新 commit:
```
Commit: 1d5152e or later
Branch: master
```

**2. 检查前端代码**
如果可以进入容器,执行:
```bash
cat /app/frontend/dist/assets/*.js | grep -o "getApiBaseUrl"
```
如果找到 `getApiBaseUrl`,说明代码已更新。

**3. 清除浏览器缓存**
- 按 Ctrl+Shift+Delete 或 Cmd+Shift+Delete
- 清除缓存和 Cookie
- 刷新页面 (Ctrl+F5 强制刷新)

### 如果启动很慢

**检查环境变量**
确认 Launch 平台已设置:
```bash
DATABASE_STORAGE=bitable
```

查看启动日志,应该看到:
```
📊 使用 Bitable 存储模式,跳过 PostgreSQL 检查和迁移
```

### 如果有 CORS 错误

查看后端日志,如果看到:
```
[CORS] Blocked origin: http://xxx
```

这可能是新的访问来源,需要在 `backend/src/api/app.ts` 中添加到白名单。

## 📝 部署后检查清单

- [ ] 健康检查返回 200 OK
- [ ] 前端页面正常加载
- [ ] API 请求使用相对路径 `/api/v1/xxx`
- [ ] 可以创建测试任务
- [ ] 可以查看巡检任务
- [ ] 无 CORS 错误
- [ ] 容器启动时间 < 10 秒

## 🎉 成功标志

当你看到以下内容,说明部署成功:

1. ✅ Launch 平台显示 "运行中" 状态
2. ✅ 健康检查正常
3. ✅ 前端可以正常访问并加载
4. ✅ API 请求正常(无 404 或 CORS 错误)
5. ✅ 可以创建和查看测试任务
6. ✅ 容器日志显示:
   ```
   📊 使用 Bitable 存储模式
   🚀 Server running on http://localhost:3000
   🎭 Playwright 浏览器初始化完成
   ```

## 📚 相关文档

- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - 完整部署摘要
- [LAUNCH_DEPLOYMENT_GUIDE.md](LAUNCH_DEPLOYMENT_GUIDE.md) - 详细部署指南
- [.env.example](.env.example) - 环境变量模板

---

**需要帮助?** 请参考 [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) 中的常见问题部分。
