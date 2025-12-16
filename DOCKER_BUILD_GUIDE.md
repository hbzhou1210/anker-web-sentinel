# Docker 镜像构建与唯一性管理指南

## 问题背景

生产环境部署时,即使拉取了最新代码,如果不重新构建 Docker 镜像,容器仍会运行旧代码。这是因为 **Docker 镜像是不可变的**,必须重新构建才能包含新代码。

## 解决方案:镜像版本追踪

我们为每个 Docker 镜像添加了唯一标识,确保可以追溯镜像对应的代码版本。

### 1. 镜像包含的版本信息

每个镜像都包含以下信息:

- **GIT_COMMIT**: Git commit hash (短格式)
- **BUILD_DATE**: 构建时间 (ISO 8601 格式)
- **VERSION**: 应用版本号
- **NODE_VERSION**: Node.js 版本
- **UPTIME**: 容器运行时长

### 2. 使用构建脚本(推荐)

```bash
# 一键构建,自动添加版本标签
./build-docker.sh
```

脚本会自动:
- 获取当前 Git commit hash
- 检查是否有未提交的更改
- 使用 `--no-cache` 强制完全重建
- 为镜像添加唯一标签(如 `anita-project_backend:a3f5c8d`)
- 显示构建信息和部署命令

### 3. 手动构建

如果需要手动控制构建过程:

```bash
# 获取版本信息
GIT_COMMIT=$(git rev-parse --short HEAD)
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
VERSION="1.0.0"

# 构建镜像
docker compose build --no-cache \
  --build-arg GIT_COMMIT="$GIT_COMMIT" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg VERSION="$VERSION"

# 添加标签
docker tag anita-project_backend:latest anita-project_backend:$GIT_COMMIT
docker tag anita-project_frontend:latest anita-project_frontend:$GIT_COMMIT
```

## 查询运行中容器的版本

### 方法 1: 通过 API 端点

```bash
# 查询后端版本
curl http://10.5.3.150:10038/api/version

# 返回示例:
{
  "git_commit": "efddd0d",
  "build_date": "2025-12-16T10:30:00Z",
  "version": "1.0.0",
  "node_version": "v20.11.0",
  "uptime": 3600.5
}

# 查询前端版本
curl http://10.5.3.150:10038/version.json
```

### 方法 2: 进入容器查看

```bash
# 查看后端版本
docker compose exec backend cat /app/version.json

# 查看前端版本
docker compose exec frontend cat /usr/share/nginx/html/version.json
```

### 方法 3: 检查镜像标签

```bash
# 列出所有镜像及其标签
docker images | grep anita-project

# 输出示例:
# anita-project_backend   efddd0d   abc123   2 hours ago   1.2GB
# anita-project_backend   latest    abc123   2 hours ago   1.2GB
# anita-project_frontend  efddd0d   def456   2 hours ago   50MB
```

## 完整部署流程

### 在 Launch 平台(10.5.3.150)上部署:

```bash
# 1. 登录服务器
ssh user@10.5.3.150

# 2. 进入项目目录
cd /path/to/anita-project

# 3. 拉取最新代码
git pull origin master

# 4. 查看最新提交,确认包含所需修复
git log --oneline -5

# 5. 构建新镜像
./build-docker.sh

# 6. 停止旧容器
docker compose down

# 7. 启动新容器
docker compose up -d

# 8. 验证版本
curl http://localhost/version.json
curl http://localhost:3000/api/version

# 9. 查看启动日志
docker compose logs -f --tail=100
```

## 验证修复是否生效

构建部署后,验证所有修复:

```bash
# 验证修复 1: frontend 不使用 localhost
# 在浏览器开发者工具中检查 Network 请求
# 应该看到相对路径: /api/v1/tests/xxx
# 不应该看到: http://localhost:3000/api/v1/xxx

# 验证修复 2: package-lock.json 存在
docker compose exec backend ls -lh /app/tools/function-discount-checker/package-lock.json

# 验证修复 3: responsive.ts 使用独立浏览器
docker compose exec backend grep "deviceBrowser = await browserPool.acquire" /app/src/api/routes/responsive.ts

# 验证修复 4: BrowserPool 没有 --single-process
docker compose exec backend grep "single-process" /app/src/automation/BrowserPool.ts
# 应该没有输出
```

## 常见问题

### Q: 为什么需要 `--no-cache`?

A: Docker 的分层缓存可能导致:
- 代码更新但仍使用旧缓存层
- `COPY . .` 不触发重建
- npm 依赖使用缓存的 node_modules

使用 `--no-cache` 强制完全重建,确保所有更改生效。

### Q: 如何确认镜像包含最新代码?

A: 三步验证:
1. 检查 git commit hash: `curl http://localhost:3000/api/version`
2. 与 Git 对比: `git log --oneline -1`
3. 确保 hash 一致

### Q: 生产环境更新后仍然报错怎么办?

A: 检查清单:
1. ✅ 是否执行了 `git pull`?
2. ✅ 是否执行了 `docker compose build --no-cache`?
3. ✅ 是否执行了 `docker compose down && docker compose up -d`?
4. ✅ 版本 API 是否返回最新 commit hash?

如果以上都确认,但仍有问题:

```bash
# 清理所有旧容器和镜像
docker compose down -v
docker system prune -a -f

# 重新构建和部署
./build-docker.sh
docker compose up -d
```

### Q: 如何回滚到之前的版本?

A: 如果使用了版本标签:

```bash
# 查看可用的镜像版本
docker images | grep anita-project

# 使用特定版本启动
docker compose down
docker tag anita-project_backend:a3f5c8d anita-project_backend:latest
docker tag anita-project_frontend:a3f5c8d anita-project_frontend:latest
docker compose up -d
```

## 最佳实践

1. **每次修复后立即构建并打标签**
   ```bash
   git commit -m "fix: ..."
   ./build-docker.sh
   ```

2. **部署前验证本地构建**
   ```bash
   ./build-docker.sh
   docker compose up -d
   # 测试功能是否正常
   ```

3. **保留多个版本的镜像标签**
   - 便于快速回滚
   - 便于对比不同版本

4. **定期清理旧镜像**
   ```bash
   # 删除悬空镜像
   docker image prune -f

   # 删除超过 30 天的镜像
   docker images --format "{{.ID}} {{.CreatedAt}}" | \
     awk '$2 < "30 days ago" {print $1}' | \
     xargs docker rmi -f
   ```

## 生产环境当前状态

最新修复的 4 个 commits:
- `efddd0d` - Responsive testing 独立浏览器实例
- `df28629` - 修复 frontend API localhost 问题
- `f81da3c` - 添加 package-lock.json 修复 node-fetch
- `f072cba` - 移除 BrowserPool 的 --single-process

**下一步**: 在生产环境执行完整构建部署流程,验证所有修复生效。
