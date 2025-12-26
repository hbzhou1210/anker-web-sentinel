# 多语言文案检查 - 本地测试指南

## ✅ 已完成配置

你的本地环境已经配置好,可以立即使用多语言文案检查功能!

### 当前配置

- **后端服务**: ✅ 运行在 http://localhost:3000
- **前端服务**: ✅ 运行在 http://localhost:5173
- **LanguageTool**: ✅ 使用在线 API (https://api.languagetool.org)

---

## 🚀 快速开始

### 方式 1: 使用前端界面 (推荐)

1. **打开前端页面**:
   ```bash
   open http://localhost:5173/tools/multilingual
   ```
   或在浏览器中访问: http://localhost:5173/tools/multilingual

2. **输入测试内容**:
   - 在 URL 输入框中输入任意网页地址,如: `https://www.example.com`
   - 选择要检查的语言(英语、德语、法语等)

3. **点击"开始检查"**:
   - 系统会自动检查网页内容
   - 显示语法错误、拼写错误等问题
   - 提供修复建议

### 方式 2: 使用 API 直接测试

#### 测试脚本 (推荐):
```bash
./test-multilingual-online.sh
```

#### 手动测试:

1. **检查服务状态**:
```bash
curl http://localhost:3000/api/v1/multilingual/health | jq '.'
```

期望输出:
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "service": "LanguageTool",
    "timestamp": "2025-12-26T..."
  }
}
```

2. **测试文本检查**:
```bash
curl -X POST http://localhost:3000/api/v1/multilingual/check-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is an exmaple text with som mistakes.",
    "language": "english"
  }' | jq '.'
```

期望输出:
```json
{
  "success": true,
  "data": {
    "language": "en-US",
    "errors": [
      {
        "message": "Possible spelling mistake found.",
        "replacements": [
          { "value": "example" }
        ],
        ...
      }
    ],
    "errorCount": 2
  }
}
```

3. **获取支持的语言**:
```bash
curl http://localhost:3000/api/v1/multilingual/languages | jq '.data.languages[:5]'
```

---

## 📝 使用示例

### 示例 1: 检查英文文本

**输入**:
```
This is an exmaple text with som mistakes.
```

**输出**:
- ❌ "exmaple" 应该是 "example"
- ❌ "som" 应该是 "some"

### 示例 2: 检查德语文本

```bash
curl -X POST http://localhost:3000/api/v1/multilingual/check-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Das ist ein Beispiel Text mit Fehlern.",
    "language": "german"
  }' | jq '.data.errorCount'
```

### 示例 3: 检查多语言网页

```bash
curl -X POST http://localhost:3000/api/v1/multilingual/check \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example.com",
    "languages": ["english", "german", "french"]
  }' | jq '.data.summary'
```

---

## ⚠️ 重要提示

### 当前使用的是在线 API

你现在使用的是 **LanguageTool 官方在线 API**,有以下限制:

- ✅ 优点: 无需安装 Docker,即开即用
- ⚠️ 限制: **每天最多 20 次请求**
- ⚠️ 限制: 每次请求最多 20KB 文本
- ⚠️ 限制: 速度可能较慢

### 如果超过限制

如果你看到类似错误:
```
"Too many requests. Please try again later."
```

说明已达到每日限制。解决方案:

1. **等待第二天** (限制会重置)
2. **安装本地 Docker 版本** (无限制,速度更快)

---

## 🐳 升级到本地 Docker 版本

如果需要频繁测试或生产使用,建议安装本地 Docker 版本:

### 步骤 1: 安装 Docker Desktop

```bash
# 使用 Homebrew 安装
brew install --cask docker
```

### 步骤 2: 启动 LanguageTool 容器

```bash
docker run -d \
  --name languagetool \
  -p 8010:8010 \
  -e Java_Xms=512m \
  -e Java_Xmx=1g \
  erikvl87/languagetool:latest

# 等待 30 秒让服务启动
sleep 30
```

### 步骤 3: 修改配置

编辑 `backend/.env` 文件,修改以下行:

```bash
# 从在线 API 改为本地
# LANGUAGETOOL_API_URL=https://api.languagetool.org/v2/check
LANGUAGETOOL_API_URL=http://localhost:8010/v2/check
```

### 步骤 4: 重启后端

```bash
# 停止当前后端
lsof -ti:3000 | xargs kill

# 重新启动
cd backend && npm run dev
```

### 步骤 5: 验证

```bash
curl http://localhost:3000/api/v1/multilingual/health
```

应该看到 `"healthy": true`

---

## 🎯 测试检查清单

使用以下命令验证所有功能:

```bash
# 1. 后端健康检查
curl http://localhost:3000/health

# 2. 多语言服务健康检查
curl http://localhost:3000/api/v1/multilingual/health

# 3. 获取支持的语言
curl http://localhost:3000/api/v1/multilingual/languages

# 4. 测试英文文本检查
curl -X POST http://localhost:3000/api/v1/multilingual/check-text \
  -H "Content-Type: application/json" \
  -d '{"text":"This is an exmaple.","language":"english"}'

# 5. 访问前端界面
open http://localhost:5173/tools/multilingual
```

---

## 📊 功能特性

### 支持的语言

- 🇺🇸 英语 (English)
- 🇩🇪 德语 (German)
- 🇫🇷 法语 (French)
- 🇪🇸 西班牙语 (Spanish)
- 🇮🇹 意大利语 (Italian)
- 🇵🇹 葡萄牙语 (Portuguese)
- 🇳🇱 荷兰语 (Dutch)
- 🇯🇵 日语 (Japanese)
- 🇨🇳 中文 (Chinese)

### 检测类型

- ✅ 拼写错误
- ✅ 语法错误
- ✅ 标点符号问题
- ✅ 风格建议
- ✅ 常见错误

### 错误严重性

- 🔴 **Error**: 严重错误 (拼写、语法)
- 🟡 **Warning**: 警告 (风格、可读性)
- 🔵 **Info**: 信息 (提示性建议)

---

## 🐛 故障排除

### 问题 1: "LanguageTool service is not available"

**原因**: 后端未读取到新配置

**解决**:
```bash
# 重启后端
lsof -ti:3000 | xargs kill
cd backend && npm run dev
```

### 问题 2: "Too many requests"

**原因**: 达到在线 API 每日限制 (20 次)

**解决**:
1. 等待第二天
2. 或安装本地 Docker 版本

### 问题 3: 前端显示"服务未启动"

**原因**: LanguageTool 服务不可用

**检查**:
```bash
curl http://localhost:3000/api/v1/multilingual/health
```

### 问题 4: 检查速度很慢

**原因**: 在线 API 网络延迟

**解决**: 安装本地 Docker 版本

---

## 📚 相关文档

- **完整 API 文档**: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **多语言 API**: [MULTILINGUAL_API_DOCUMENTATION.md](MULTILINGUAL_API_DOCUMENTATION.md)
- **Docker 安装指南**: [INSTALL_DOCKER_GUIDE.md](INSTALL_DOCKER_GUIDE.md)
- **集成说明**: [MULTILINGUAL_CHECKER_INTEGRATION.md](MULTILINGUAL_CHECKER_INTEGRATION.md)

---

## 🎉 总结

你现在可以:

1. ✅ 使用前端界面检查网页多语言内容
2. ✅ 使用 API 直接检查文本
3. ✅ 支持 25+ 种语言
4. ✅ 获得详细的错误报告和修复建议

**开始测试**: http://localhost:5173/tools/multilingual

祝测试愉快! 🚀
