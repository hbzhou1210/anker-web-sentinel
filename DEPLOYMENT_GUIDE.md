# 生产环境部署指南

## 📋 目录

- [确保代码一致性](#确保代码一致性)
- [本地部署流程](#本地部署流程)
- [生产环境部署](#生产环境部署)
- [常见问题排查](#常见问题排查)
- [回滚操作](#回滚操作)

---

## 🎯 确保代码一致性

### 核心原则

**生产环境的代码必须与 Git 仓库中的某个 commit 完全一致**

### 检查清单

使用我们的一致性检查工具：

```bash
./scripts/check-consistency.sh
```

这个脚本会检查：
- ✅ Git commit 和分支
- ✅ 未提交的修改
- ✅ 依赖版本 (package-lock.json)
- ✅ 构建文件状态
- ✅ 环境变量配置
- ✅ Docker 容器状态

---

## 🚀 本地部署流程

### 方式1: 使用自动化脚本（推荐）

```bash
# 运行完整的部署流程
./scripts/deploy-production.sh
```

这个脚本会自动：
1. 检查 Git 状态
2. 拉取最新代码
3. 清理旧的构建文件
4. 更新依赖
5. 构建项目
6. 生成部署信息
7. 启动服务（可选 Docker）
8. 执行健康检查

### 方式2: 手动部署

```bash
# 1. 拉取最新代码
git pull origin dev

# 2. 清理构建
rm -rf backend/dist frontend/dist

# 3. 安装依赖
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 4. 构建
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..

# 5. 启动服务
npm run dev
# 或使用 Docker
docker-compose up -d --build
```

---

## 🌐 生产环境部署

### 前置要求

1. **SSH 访问权限**
   ```bash
   ssh user@production-server
   ```

2. **Node.js 20+**
   ```bash
   node --version  # 应该 >= 20.0.0
   ```

3. **Git 仓库访问权限**
   ```bash
   git pull origin dev  # 能够成功拉取
   ```

### 部署步骤

#### 步骤1: SSH 到生产服务器

```bash
ssh user@your-production-server
cd /path/to/anita-project
```

#### 步骤2: 备份当前版本

```bash
# 记录当前 commit
git rev-parse HEAD > .previous-commit

# 备份环境变量（如果有修改）
cp .env .env.backup
```

#### 步骤3: 执行部署

```bash
# 拉取最新代码
git fetch origin
git pull origin dev  # 或 master

# 运行部署脚本
./scripts/deploy-production.sh
```

#### 步骤4: 验证部署

```bash
# 运行验证脚本
./verify-deployment.sh

# 手动检查
curl http://localhost:3000/health

# 查看日志
docker-compose logs -f backend  # 如使用 Docker
# 或
pm2 logs anita-web-sentinel    # 如使用 PM2
```

---

## 🔍 版本验证

### 查看当前部署版本

```bash
# 查看部署信息文件
cat deployment-info.json

# 查看 Git 信息
git log -1 --oneline
git rev-parse --short HEAD
```

### 对比本地和生产环境

**本地环境**:
```bash
git rev-parse --short HEAD
git log -1 --pretty=%B
```

**生产环境**:
```bash
ssh user@production-server "cd /path/to/anita-project && git rev-parse --short HEAD"
ssh user@production-server "cd /path/to/anita-project && git log -1 --pretty=%B"
```

**对比**:
```bash
# 本地
LOCAL_COMMIT=$(git rev-parse HEAD)

# 生产
PROD_COMMIT=$(ssh user@production-server "cd /path/to/anita-project && git rev-parse HEAD")

# 检查是否一致
if [ "$LOCAL_COMMIT" = "$PROD_COMMIT" ]; then
    echo "✅ 版本一致"
else
    echo "⚠️  版本不一致!"
    echo "本地: $LOCAL_COMMIT"
    echo "生产: $PROD_COMMIT"
fi
```

---

## 🐛 常见问题排查

### 问题1: 代码不一致

**症状**: 生产环境行为与本地不同

**排查**:
```bash
# 1. 检查 commit
git log -1 --oneline

# 2. 检查未提交的修改
git status

# 3. 检查构建时间
ls -la backend/dist frontend/dist
```

**解决**:
```bash
# 清理并重新部署
git reset --hard origin/dev
./scripts/deploy-production.sh
```

### 问题2: 依赖版本不一致

**症状**: 出现"module not found"或版本冲突错误

**排查**:
```bash
# 检查 package-lock.json
git diff package-lock.json

# 检查 node_modules
npm list --depth=0
```

**解决**:
```bash
# 删除 node_modules 并重新安装
rm -rf node_modules backend/node_modules frontend/node_modules
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 问题3: 环境变量不同

**症状**: 配置相关错误，如 Redis、飞书连接失败

**排查**:
```bash
# 检查环境变量
cat .env | grep -E "FEISHU|REDIS|DATABASE"
```

**解决**:
```bash
# 对比本地和生产的 .env
diff .env.example .env

# 确保关键配置正确
# REDIS_ENABLED=false
# DATABASE_STORAGE=bitable
# FEISHU_APP_ID=xxx
# FEISHU_APP_SECRET=xxx
```

### 问题4: Docker 缓存问题

**症状**: 修改代码后重启 Docker 但未生效

**排查**:
```bash
# 检查镜像构建时间
docker images | grep anker-sentinel

# 检查容器启动时间
docker ps --format "{{.Names}}: {{.Status}}"
```

**解决**:
```bash
# 强制重新构建（不使用缓存）
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 或清理所有内容
docker system prune -a
docker-compose up -d --build
```

---

## ⏪ 回滚操作

### 快速回滚

如果新版本出现问题，可以快速回滚到上一个版本：

```bash
# 1. 查看上一个 commit
PREVIOUS_COMMIT=$(cat .previous-commit)

# 2. 回滚代码
git reset --hard $PREVIOUS_COMMIT

# 3. 重新部署
./scripts/deploy-production.sh
```

### 回滚到特定版本

```bash
# 1. 查看历史 commit
git log --oneline -10

# 2. 回滚到特定 commit
git reset --hard <commit-hash>

# 3. 重新部署
./scripts/deploy-production.sh
```

### Docker 回滚

```bash
# 1. 查看镜像历史
docker images | grep anker-sentinel

# 2. 使用旧镜像
docker-compose down
docker tag anker-sentinel-backend:previous anker-sentinel-backend:latest
docker-compose up -d
```

---

## 📊 部署检查表

部署前：
- [ ] 所有修改已提交
- [ ] 代码已推送到远程仓库
- [ ] 本地测试通过
- [ ] 环境变量已配置
- [ ] 备份当前版本信息

部署中：
- [ ] 拉取最新代码成功
- [ ] 依赖安装成功
- [ ] 构建成功
- [ ] 服务启动成功

部署后：
- [ ] 健康检查通过
- [ ] 核心功能验证通过
- [ ] 版本信息一致
- [ ] 日志无错误
- [ ] 记录部署信息

---

## 🛠️ 工具脚本说明

### deploy-production.sh
完整的自动化部署脚本，包含：
- 代码检查和更新
- 依赖安装
- 项目构建
- 服务启动
- 健康检查

### check-consistency.sh
环境一致性检查工具，检查：
- Git 状态
- 依赖版本
- 构建文件
- 环境变量
- Docker 状态

### verify-deployment.sh
部署验证脚本，验证：
- 版本信息
- 服务状态
- API 响应

---

## 📞 支持

如果遇到部署问题：

1. 查看日志：
   ```bash
   # Docker
   docker-compose logs -f backend

   # PM2
   pm2 logs anita-web-sentinel

   # 直接运行
   tail -f logs/*.log
   ```

2. 运行诊断：
   ```bash
   ./scripts/check-consistency.sh
   ```

3. 查看部署文档：
   - [生产环境Redis紧急修复](./生产环境Redis紧急修复_2025-12-18.md)
   - [技术栈清理总结](./技术栈清理总结_2025-12-18.md)

---

**最后更新**: 2025-12-18
**维护者**: Anker DTC IT Team
