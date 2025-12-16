# Launch 平台部署指南

## 问题说明

Launch 平台直接从 Git 仓库拉取代码进行自动构建部署,无法手动执行构建命令。本指南提供适配 Launch 平台的部署方案。

## Launch 平台的部署特点

1. **自动拉取代码** - 从 Git 仓库自动同步最新代码
2. **自动构建镜像** - 执行 `docker compose build`
3. **自动启动容器** - 执行 `docker compose up -d`
4. **无法手动干预** - 整个流程自动化,无法执行自定义脚本

## 如何确保 Docker 镜像唯一性

### 方案 1: 在 Launch 平台配置构建钩子(推荐)

如果 Launch 平台支持 Pre-build Hook(构建前钩子),配置执行:

```bash
./pre-build.sh
```

这会在构建前自动生成版本信息并写入 `.env.build` 文件。

### 方案 2: 手动生成版本信息后提交(备选)

如果 Launch 平台不支持钩子,每次部署前在本地执行:

```bash
# 1. 生成版本信息
./pre-build.sh

# 2. 提交 .env.build 文件
git add .env.build
git commit -m "build: update version info for deployment"
git push coding master

# 3. 在 Launch 平台触发重新部署
```

### 方案 3: 使用 Launch 平台环境变量

在 Launch 平台的项目设置中添加环境变量:

```bash
GIT_COMMIT=<当前commit的short hash>
BUILD_DATE=<当前时间>
VERSION=1.0.0
```

Launch 平台会自动将这些变量传递给 `docker compose build`。

## 验证部署版本

### 1. 通过 API 查询版本

```bash
# 查询后端版本
curl http://10.5.3.150:10038/api/version

# 返回示例:
{
  "git_commit": "d93674d",
  "build_date": "2025-12-16T11:30:00Z",
  "version": "1.0.0",
  "node_version": "v20.11.0",
  "uptime": 1234.5
}

# 查询前端版本
curl http://10.5.3.150:10038/version.json
```

### 2. 对比 Git 历史确认版本

```bash
# 查看最近的提交
git log --oneline -5

# 输出示例:
# d93674d feat: 添加Docker镜像版本追踪
# efddd0d fix: Responsive testing独立浏览器
# df28629 fix: Frontend API localhost问题
# f81da3c fix: 添加package-lock.json
# f072cba fix: 移除--single-process参数

# 如果 API 返回的 git_commit 是 d93674d
# 说明部署包含了最新的 5 个修复
```

### 3. 进入容器手动检查

```bash
# SSH 登录到 Launch 平台服务器
ssh user@10.5.3.150

# 查看后端版本文件
docker exec anker-sentinel-backend cat /app/version.json

# 查看前端版本文件
docker exec anker-sentinel-frontend cat /usr/share/nginx/html/version.json

# 检查关键修复是否存在
docker exec anker-sentinel-backend grep "deviceBrowser = await browserPool.acquire" /app/src/api/routes/responsive.ts
```

## Launch 平台部署流程

### 标准部署流程

1. **本地开发完成后提交代码**
   ```bash
   git add .
   git commit -m "fix: 修复XXX问题"
   git push coding master
   ```

2. **登录 Launch 平台 (http://launch.anker-in.com)**
   - 找到项目: `anker-web-sentinel`
   - 点击"重新部署"或"更新"按钮

3. **等待自动构建部署**
   - Launch 会自动拉取最新代码
   - 自动执行 `docker compose build`
   - 自动执行 `docker compose up -d`

4. **验证部署结果**
   ```bash
   curl http://10.5.3.150:10038/api/version
   ```

### 强制重建(清除缓存)

如果发现部署后仍是旧版本,可能是 Docker 缓存问题:

1. **在 Launch 平台操作**:
   - 选择"强制重建"或"清除缓存后重建"选项
   - 这相当于执行 `docker compose build --no-cache`

2. **或者 SSH 登录手动清理**:
   ```bash
   ssh user@10.5.3.150
   cd /path/to/anita-project

   # 停止并删除容器
   docker compose down

   # 删除旧镜像
   docker rmi anita-project_backend:latest anita-project_frontend:latest

   # 在 Launch 平台点击重新部署
   ```

## 当前项目的关键修复

以下 5 个修复已提交到 coding 仓库 master 分支:

| Commit | 修复内容 | 文件 |
|--------|---------|------|
| `d93674d` | Docker镜像版本追踪 | Dockerfile, docker-compose.yml |
| `efddd0d` | Responsive testing独立浏览器 | backend/src/api/routes/responsive.ts |
| `df28629` | Frontend API localhost问题 | frontend/.env.production |
| `f81da3c` | 添加package-lock.json | tools/function-discount-checker/ |
| `f072cba` | 移除--single-process参数 | backend/src/automation/BrowserPool.ts |

### 验证清单

部署后验证所有修复是否生效:

```bash
# ✅ 检查 1: 版本信息包含最新 commit
curl http://10.5.3.150:10038/api/version | grep d93674d

# ✅ 检查 2: Frontend 不使用 localhost
# 在浏览器中访问 http://10.5.3.150:10038
# 打开开发者工具 Network 面板
# 创建测试任务,查看请求 URL 应该是 /api/v1/tests/xxx (相对路径)

# ✅ 检查 3: node-fetch 模块存在
ssh user@10.5.3.150
docker exec anker-sentinel-backend node -e "import('node-fetch').then(() => console.log('OK'))"
# 应该输出: OK

# ✅ 检查 4: Responsive testing 使用独立浏览器
# 在界面中执行响应式测试,测试多个设备
# 应该全部成功,不应该出现 "browser has been closed" 错误

# ✅ 检查 5: BrowserPool 没有 single-process
docker exec anker-sentinel-backend grep "single-process" /app/src/automation/BrowserPool.ts
# 应该没有输出
```

## 故障排查

### 问题: Launch 平台显示"构建成功"但版本仍是旧的

**原因**: Docker 使用了缓存层,没有真正重新构建

**解决**:
1. 在 Launch 平台选择"强制重建(无缓存)"
2. 或在服务器手动清理镜像后重新部署

### 问题: API 返回 git_commit: "unknown"

**原因**: 构建时没有获取到 Git 信息

**解决**:
1. 检查 Launch 平台是否保留了 `.git` 目录
2. 如果不保留,使用方案 2 或方案 3
3. 或在 Launch 平台配置中启用"保留 Git 元数据"

### 问题: 前端访问仍然报 localhost 错误

**原因**: 浏览器缓存或 CDN 缓存

**解决**:
```bash
# 1. 清除浏览器缓存(Ctrl+Shift+Delete)
# 2. 强制刷新(Ctrl+F5)
# 3. 或使用隐私/无痕模式测试

# 4. 验证静态文件是否更新
curl http://10.5.3.150:10038/assets/*.js | grep "localhost"
# 不应该有输出
```

### 问题: 容器启动后立即崩溃

**原因**: 可能是代码有语法错误或依赖缺失

**解决**:
```bash
# 查看容器日志
docker logs anker-sentinel-backend --tail=100
docker logs anker-sentinel-frontend --tail=100

# 常见错误:
# - "Cannot find module": 检查 package.json 和 package-lock.json
# - "Syntax error": 检查代码是否有语法错误
# - "Port already in use": 检查端口是否被占用
```

## 紧急回滚

如果新版本有问题,需要紧急回滚到上一个稳定版本:

```bash
# 1. SSH 登录服务器
ssh user@10.5.3.150
cd /path/to/anita-project

# 2. 回滚 Git 代码
git log --oneline -5  # 查看历史
git reset --hard <上一个稳定的commit>

# 3. 强制重建并部署
docker compose down
docker compose build --no-cache
docker compose up -d

# 4. 验证回滚成功
curl http://10.5.3.150:10038/api/version
```

## 最佳实践

1. **每次修复后验证版本号**
   - 部署后立即检查 `/api/version`
   - 确认 git_commit 是最新的

2. **保存每次部署的版本记录**
   ```bash
   # 部署前记录
   echo "$(date): Deploying commit $(git rev-parse --short HEAD)" >> deploy.log
   ```

3. **使用 Launch 平台的部署历史功能**
   - 记录每次部署的时间和版本
   - 方便追溯问题

4. **定期清理 Docker 缓存**
   ```bash
   # 每周执行一次
   docker system prune -a -f
   ```

5. **监控关键指标**
   - 容器启动时间
   - 健康检查状态
   - 错误日志数量

## 联系方式

如果遇到 Launch 平台相关的技术问题:
- Launch 平台支持: [support@launch.anker-in.com](mailto:support@launch.anker-in.com)
- 项目负责人: [查看项目 README.md]
