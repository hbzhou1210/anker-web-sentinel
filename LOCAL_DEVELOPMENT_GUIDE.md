# 本地开发启动指南

**更新日期**: 2025-12-25

## 🚀 方式 1: 完整本地开发(推荐)

### 前置条件
- Node.js 18+
- npm 或 yarn
- Docker Desktop (用于 LanguageTool 和 Redis)

### 步骤 1: 启动依赖服务

#### 1.1 启动 LanguageTool (可选)

如果您需要测试多语言检查功能:

```bash
# 使用 Docker 启动 LanguageTool
docker run -d \
  --name languagetool \
  -p 8010:8010 \
  -e Java_Xms=512m \
  -e Java_Xmx=1g \
  erikvl87/languagetool:latest

# 检查服务状态
curl http://localhost:8010/v2/languages
```

#### 1.2 启动 Redis (可选)

如果您需要缓存功能:

```bash
# 使用 Docker 启动 Redis
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine

# 测试连接
redis-cli ping
```

### 步骤 2: 配置环境变量

```bash
# 复制环境变量模板
cp backend/.env.example backend/.env

# 编辑 backend/.env
# 确保以下配置正确:
# - FEISHU_APP_ID 和 FEISHU_APP_SECRET
# - LANGUAGETOOL_API_URL=http://localhost:8010/v2/check (如果启动了 LanguageTool)
```

### 步骤 3: 启动后端

```bash
# 进入后端目录
cd backend

# 安装依赖(首次运行)
npm install

# 启动开发服务器
npm run dev
```

后端将在 `http://localhost:3000` 启动。

### 步骤 4: 启动前端

打开新的终端窗口:

```bash
# 进入前端目录
cd frontend

# 安装依赖(首次运行)
npm install

# 启动开发服务器
npm run dev
```

前端将在 `http://localhost:5173` 启动。

## 🧪 测试多语言检查功能

### 快速测试

```bash
# 1. 检查 LanguageTool 健康状态
curl http://localhost:3000/api/v1/multilingual/health

# 2. 测试文本检查
curl -X POST http://localhost:3000/api/v1/multilingual/check-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is an exmaple text with som mistakes.",
    "language": "english"
  }' | jq '.'

# 3. 运行完整测试脚本
./test-multilingual-api.sh
```

## 🔧 方式 2: 不使用 LanguageTool (仅测试其他功能)

如果您暂时不需要测试多语言检查,可以跳过 LanguageTool:

### 修改配置

编辑 `backend/.env`:

```bash
# 注释掉或留空 LanguageTool 配置
# LANGUAGETOOL_API_URL=
```

这样其他功能(巡检、响应式测试等)仍然可以正常工作。

## 📝 常用命令

### 后端开发

```bash
cd backend

# 开发模式(热重载)
npm run dev

# 构建
npm run build

# 启动编译后的代码
npm start

# 类型检查
npx tsc --noEmit

# 运行测试
npm test
```

### 前端开发

```bash
cd frontend

# 开发模式(热重载)
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

## 🐛 常见问题

### 1. LanguageTool 启动失败

**症状**: `ECONNREFUSED` 或服务无响应

**解决方案**:
```bash
# 检查 Docker 容器状态
docker ps | grep languagetool

# 查看日志
docker logs languagetool

# 重启服务
docker restart languagetool

# 或完全重建
docker rm -f languagetool
docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool:latest
```

### 2. 端口被占用

**症状**: `Error: listen EADDRINUSE: address already in use`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3000  # 后端
lsof -i :5173  # 前端
lsof -i :8010  # LanguageTool

# 终止进程
kill -9 <PID>
```

### 3. Playwright 浏览器未安装

**症状**: `browserType.launch: Executable doesn't exist`

**解决方案**:
```bash
cd backend
npx playwright install chromium
```

### 4. 飞书 API 连接失败

**症状**: `FEISHU_APP_ID not found`

**解决方案**:
- 检查 `backend/.env` 中的 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`
- 确保值已正确复制,没有多余空格
- 重启后端服务

### 5. TypeScript 编译错误

**解决方案**:
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npx tsc --noEmit
```

## 📊 开发环境端口映射

| 服务 | 本地端口 | 说明 |
|------|---------|------|
| 前端 | 5173 | Vite 开发服务器 |
| 后端 | 3000 | Express API 服务器 |
| LanguageTool | 8010 | 多语言检查服务 |
| Redis | 6379 | 缓存服务 |

## 🔄 开发工作流

### 典型的开发流程

1. **启动依赖服务**
   ```bash
   docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool:latest
   docker run -d --name redis -p 6379:6379 redis:7-alpine
   ```

2. **启动后端** (终端 1)
   ```bash
   cd backend && npm run dev
   ```

3. **启动前端** (终端 2)
   ```bash
   cd frontend && npm run dev
   ```

4. **开发和测试**
   - 前端访问: http://localhost:5173
   - API 测试: http://localhost:3000/api/v1/...
   - 修改代码会自动热重载

5. **提交代码前**
   ```bash
   # 类型检查
   cd backend && npx tsc --noEmit

   # 前端 lint
   cd frontend && npm run lint
   ```

## 🎯 快速验证多语言功能

### 一键测试脚本

```bash
#!/bin/bash

echo "🚀 启动多语言检查功能测试..."

# 1. 检查 LanguageTool 是否运行
if ! curl -s http://localhost:8010/v2/languages > /dev/null; then
  echo "❌ LanguageTool 未运行,正在启动..."
  docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool:latest
  echo "⏳ 等待 30 秒让服务启动..."
  sleep 30
fi

# 2. 检查后端是否运行
if ! curl -s http://localhost:3000/health > /dev/null; then
  echo "❌ 后端服务未运行,请先启动: cd backend && npm run dev"
  exit 1
fi

# 3. 运行测试
./test-multilingual-api.sh

echo "✅ 测试完成!"
```

保存为 `quick-test-multilingual.sh` 并运行:

```bash
chmod +x quick-test-multilingual.sh
./quick-test-multilingual.sh
```

## 📚 相关文档

- [多语言检查技术方案](MULTILINGUAL_CONTENT_CHECKER_PROPOSAL.md)
- [多语言检查集成文档](MULTILINGUAL_CHECKER_INTEGRATION.md)
- [巡检邮件修复文档](PATROL_EMAIL_LOCALHOST_FIX.md)

## 💡 开发技巧

### VS Code 推荐配置

创建 `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "backend/node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  }
}
```

### 推荐的 VS Code 扩展

- ESLint
- Prettier
- TypeScript Vue Plugin (Volar)
- REST Client (用于测试 API)

### 使用 REST Client 测试 API

创建 `test-api.http`:

```http
### 健康检查
GET http://localhost:3000/api/v1/multilingual/health

### 获取支持的语言
GET http://localhost:3000/api/v1/multilingual/languages

### 测试文本检查
POST http://localhost:3000/api/v1/multilingual/check-text
Content-Type: application/json

{
  "text": "This is an exmaple text with som mistakes.",
  "language": "english"
}

### 检查网页
POST http://localhost:3000/api/v1/multilingual/check
Content-Type: application/json

{
  "url": "https://example.com",
  "languages": ["english", "german"]
}
```

---

**开始开发**: 按照上述步骤启动服务,即可开始本地开发! 🚀
