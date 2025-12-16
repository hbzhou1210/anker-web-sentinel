# 快速部署指南 - Launch 平台

## 🚀 在 Launch 平台部署最新代码

### 方式 1: 通过 Launch 平台界面(推荐)

1. 登录 Launch 平台: http://launch.anker-in.com
2. 找到项目: `anker-web-sentinel`
3. 点击 **"重新部署"** 或 **"强制重建"** 按钮
4. 等待构建完成(约 5-10 分钟)
5. 验证部署: `curl http://10.5.3.150:10038/api/version`

### 方式 2: 配置 Pre-build Hook(一次性配置)

在 Launch 平台项目设置中配置构建前钩子:

```bash
./pre-build.sh
```

这样每次部署都会自动生成版本信息。

### 方式 3: 本地生成版本信息后推送

```bash
# 1. 生成版本信息
./pre-build.sh

# 2. 提交并推送
git add .env.build
git commit -m "build: update version info"
git push coding master

# 3. 在 Launch 平台触发部署
```

## ✅ 验证部署是否成功

```bash
# 查询版本信息
curl http://10.5.3.150:10038/api/version

# 期望输出(git_commit 应该是最新的):
{
  "git_commit": "d28db9f",  # 最新 commit
  "build_date": "2025-12-16T...",
  "version": "1.0.0",
  "node_version": "v20.11.0",
  "uptime": 123.4
}
```

## 🔍 检查所有修复是否生效

```bash
# 在浏览器中访问 http://10.5.3.150:10038
# 打开开发者工具 -> Network 面板

# ✅ 修复1: API 请求应该是相对路径
# 正确: /api/v1/tests/xxx
# 错误: http://localhost:3000/api/v1/tests/xxx

# ✅ 修复2: 响应式测试应该成功
# 测试多个设备,不应该出现浏览器崩溃错误

# ✅ 修复3: 买赠规则查询应该正常
# 查看买赠规则信息,不应该出现 node-fetch 错误
```

## 📋 最新提交包含的修复

| Commit | 说明 |
|--------|------|
| `d28db9f` | Launch平台适配 - 版本管理 |
| `d93674d` | Docker镜像版本追踪 |
| `efddd0d` | Responsive testing独立浏览器 |
| `df28629` | Frontend API localhost修复 |
| `f81da3c` | package-lock.json修复 |
| `f072cba` | 移除--single-process参数 |

## ❌ 如果部署后仍有问题

### 问题 1: 版本号不是最新的

```bash
# 在 Launch 平台选择"强制重建(无缓存)"
# 或 SSH 登录清理旧镜像:
ssh user@10.5.3.150
docker compose down
docker rmi anita-project_backend:latest anita-project_frontend:latest
# 然后在 Launch 平台重新部署
```

### 问题 2: 前端仍访问 localhost

```bash
# 清除浏览器缓存: Ctrl+Shift+Delete
# 强制刷新: Ctrl+F5
# 或使用隐私模式测试
```

### 问题 3: 容器启动失败

```bash
# SSH 登录查看日志
ssh user@10.5.3.150
docker logs anker-sentinel-backend --tail=100
docker logs anker-sentinel-frontend --tail=100
```

## 📞 获取帮助

- 详细部署指南: [LAUNCH_DEPLOY_GUIDE.md](LAUNCH_DEPLOY_GUIDE.md)
- Docker 构建指南: [DOCKER_BUILD_GUIDE.md](DOCKER_BUILD_GUIDE.md)
- 项目主文档: [README.md](README.md)
