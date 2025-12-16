# 🚀 立即部署 - 修复版本追踪问题

## 问题说明

之前部署后 `curl http://10.5.3.150:10038/api/version` 返回:
```json
{
  "git_commit": "unknown",  ❌ 错误
  "build_date": "unknown",  ❌ 错误
  ...
}
```

## 🔧 已修复

刚刚提交的 `625c41e` 修复了这个问题:
- Dockerfile 现在会自动从 .git 目录获取 commit hash
- 不再依赖环境变量或构建参数
- Launch 平台拉取代码后会自动包含正确版本信息

## 📦 现在部署

### 在 Launch 平台操作:

1. **登录 Launch 平台**
   - 访问: http://launch.anker-in.com
   - 找到项目: `anker-web-sentinel`

2. **触发重新部署**
   - 点击 **"强制重建(无缓存)"** 按钮
   - ⚠️ 必须选择"无缓存",确保使用新的 Dockerfile

3. **等待构建完成**
   - 构建时间: 约 5-10 分钟
   - 可以查看构建日志,应该会看到:
     ```
     Step XX: RUN GIT_COMMIT=$(git rev-parse --short HEAD)...
     {"git_commit":"625c41e","build_date":"2025-12-16...","version":"1.0.0"}
     ```

4. **验证部署成功**
   ```bash
   curl http://10.5.3.150:10038/api/version
   ```

   **期望输出**:
   ```json
   {
     "git_commit": "625c41e",  ✅ 正确!
     "build_date": "2025-12-16T...",  ✅ 正确!
     "version": "1.0.0",
     "node_version": "v20.19.6",
     "uptime": 123.4
   }
   ```

5. **验证前端版本**
   ```bash
   curl http://10.5.3.150:10038/version.json
   ```

   应该也返回 `"git_commit": "625c41e"`

## ✅ 验证所有修复生效

部署成功后,测试所有功能:

### 1. Frontend API 不使用 localhost
- 访问 http://10.5.3.150:10038
- 打开浏览器开发者工具 -> Network 面板
- 创建一个测试任务
- 检查请求 URL:
  - ✅ 正确: `/api/v1/tests/xxx`
  - ❌ 错误: `http://localhost:3000/api/v1/tests/xxx`

### 2. 响应式测试不崩溃
- 在界面中选择"响应式测试"
- 选择多个设备(iPhone, iPad, Desktop)
- 点击开始测试
- ✅ 应该全部成功,不出现浏览器崩溃错误

### 3. 买赠规则查询正常
- 在测试报告中查看买赠规则信息
- ✅ 应该显示具体规则,不报 node-fetch 错误

### 4. 网页质量测试不崩溃
- 创建一个网页质量测试任务
- ✅ 应该正常完成,不出现浏览器崩溃

## 📋 本次部署包含的所有修复

| Commit | 说明 |
|--------|------|
| `625c41e` | ✅ **修复版本追踪** - Dockerfile自动获取git commit |
| `5a88084` | 添加快速部署指南 |
| `d28db9f` | Launch平台适配 |
| `d93674d` | Docker镜像版本追踪 |
| `efddd0d` | ✅ **修复响应式测试** - 独立浏览器实例 |
| `df28629` | ✅ **修复localhost问题** - Frontend API相对路径 |
| `f81da3c` | ✅ **修复node-fetch** - 添加package-lock.json |
| `f072cba` | ✅ **修复浏览器崩溃** - 移除--single-process |

## 🔍 如果版本仍然显示 unknown

如果部署后 git_commit 仍然是 "unknown",可能的原因:

### 原因 1: Launch 平台没有拉取 .git 目录

**解决方案**: 在 Launch 平台设置中启用"包含 Git 元数据"

### 原因 2: 使用了 Docker 缓存

**解决方案**: 确保点击"强制重建(无缓存)",不要用普通的"重新部署"

### 原因 3: 代码没有更新

**验证**:
```bash
# SSH 登录服务器
ssh user@10.5.3.150
cd /path/to/project

# 检查代码是否最新
git log --oneline -1
# 应该显示: 625c41e fix: 修复Launch平台Docker镜像版本追踪问题
```

如果不是 625c41e,执行:
```bash
git pull coding master
```
然后在 Launch 平台重新部署。

## 📞 需要帮助?

如果遇到问题:

1. 查看 Launch 平台的构建日志
2. 查看容器日志:
   ```bash
   docker logs anker-sentinel-backend --tail=100
   docker logs anker-sentinel-frontend --tail=100
   ```
3. 查看详细文档:
   - [LAUNCH_DEPLOY_GUIDE.md](LAUNCH_DEPLOY_GUIDE.md)
   - [DOCKER_BUILD_GUIDE.md](DOCKER_BUILD_GUIDE.md)

## 🎯 总结

**当前状态**: 所有修复已完成并推送到 coding 仓库

**下一步**: 在 Launch 平台点击"强制重建(无缓存)"

**预期结果**:
- ✅ 版本信息正确显示 commit hash
- ✅ 所有功能正常工作
- ✅ 没有 localhost、浏览器崩溃、node-fetch 等错误

立即部署吧! 🚀
