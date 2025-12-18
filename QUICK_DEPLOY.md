# 🚀 快速部署指南

## 📋 三步确保生产环境一致性

### 1️⃣ 检查一致性

```bash
./scripts/check-consistency.sh
```

**会检查什么？**
- ✅ Git commit 和分支
- ✅ 未提交的修改
- ✅ 依赖版本
- ✅ 构建文件
- ✅ 环境变量

### 2️⃣ 自动化部署

```bash
./scripts/deploy-production.sh
```

**会做什么？**
- 🔄 拉取最新代码
- 🧹 清理旧构建
- 📦 更新依赖
- 🔨 构建项目
- 🚀 启动服务
- ✅ 健康检查

### 3️⃣ 验证部署

```bash
./verify-deployment.sh

# 或手动验证
curl http://localhost:3000/health
cat deployment-info.json
```

---

## ⚡ 常见操作

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 后端：http://localhost:3000
# 前端：http://localhost:5173
```

### 生产环境部署

```bash
# SSH 到生产服务器
ssh user@production-server
cd /path/to/anita-project

# 拉取最新代码
git pull origin dev

# 运行部署脚本
./scripts/deploy-production.sh

# 验证
./verify-deployment.sh
```

### Docker 部署

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down
```

---

## 🔍 版本检查

### 查看当前版本

```bash
# Git 信息
git log -1 --oneline
git rev-parse --short HEAD

# 部署信息
cat deployment-info.json
```

### 对比本地和生产

```bash
# 本地
git rev-parse --short HEAD

# 生产（通过 SSH）
ssh user@prod "cd /path/to/project && git rev-parse --short HEAD"
```

---

## 🐛 快速修复

### 问题：代码不一致

```bash
# 重置到远程版本
git reset --hard origin/dev

# 重新部署
./scripts/deploy-production.sh
```

### 问题：依赖错误

```bash
# 清理并重装
rm -rf node_modules */node_modules
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 问题：Docker 缓存

```bash
# 强制重建
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 问题：服务无响应

```bash
# 检查日志
docker-compose logs -f backend

# 重启服务
docker-compose restart backend

# 健康检查
curl http://localhost:3000/health
```

---

## 📊 部署清单

**部署前**
- [ ] 代码已提交并推送
- [ ] 本地测试通过
- [ ] 运行 `./scripts/check-consistency.sh`

**部署中**
- [ ] 运行 `./scripts/deploy-production.sh`
- [ ] 等待构建完成
- [ ] 查看部署日志

**部署后**
- [ ] 运行 `./verify-deployment.sh`
- [ ] 检查 `curl http://localhost:3000/health`
- [ ] 验证核心功能
- [ ] 查看错误日志

---

## 🆘 紧急回滚

```bash
# 查看上一个版本
cat .previous-commit

# 回滚
git reset --hard $(cat .previous-commit)
./scripts/deploy-production.sh
```

---

## 📞 获取帮助

1. **查看完整文档**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
2. **查看修复文档**: [生产环境Redis紧急修复](./生产环境Redis紧急修复_2025-12-18.md)
3. **检查一致性**: `./scripts/check-consistency.sh`
4. **查看日志**: `docker-compose logs -f` 或 `tail -f logs/*.log`

---

**记住**: 生产环境问题 = 版本不一致 + 环境变量差异

**解决方案**: 使用自动化脚本 + 验证检查 ✅
