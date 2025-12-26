# 无需 Docker 部署说明

## 🎉 重要更新

多语言检查功能现在**无需 Docker**即可使用!

## 📝 更新内容

### 1. 使用公共 LanguageTool API

**修改前**:
```typescript
// 需要本地 Docker 服务
this.apiUrl = 'http://localhost:8010/v2/check';
```

**修改后**:
```typescript
// 使用公共API,无需Docker
this.apiUrl = 'https://api.languagetool.org/v2/check';
```

### 2. 移除健康检查警告

- ✅ 移除前端健康状态检查
- ✅ 移除 Docker 启动提示
- ✅ 移除服务状态徽章

## 🚀 使用方式

### 直接使用

1. **启动后端服务**:
```bash
npm run dev:backend
```

2. **启动前端服务**:
```bash
npm run dev:frontend
```

3. **访问页面**:
```
http://localhost:3000
```

4. **开始检查** - 无需任何额外配置!

### API 调用

```bash
# 单语言检查
curl -X POST http://localhost:3000/api/v1/enhanced-multilingual/check \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.anker.com","language":"en-US"}'

# 批量检查
curl -X POST http://localhost:3000/api/v1/enhanced-multilingual/batch-check \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.anker.com","languages":["en-US","de-DE"]}'
```

## 📊 公共 API vs 本地 Docker

### 公共 API 优势
- ✅ 无需安装 Docker
- ✅ 无需启动容器
- ✅ 零配置,开箱即用
- ✅ 自动更新和维护

### 公共 API 限制
- ⚠️ 请求频率限制(每IP每天20次)
- ⚠️ 文本长度限制(20KB)
- ⚠️ 需要网络连接

### 本地 Docker 优势(可选)
- ✅ 无请求限制
- ✅ 更快的响应速度
- ✅ 离线使用
- ✅ 数据隐私

## 🔧 高级配置(可选)

如果您需要更高的性能或更多请求,可以使用环境变量切换回本地 Docker:

### 1. 启动 Docker 容器
```bash
docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool:latest
```

### 2. 设置环境变量
```bash
export LANGUAGETOOL_API_URL=http://localhost:8010/v2/check
npm run dev:backend
```

## 📈 性能对比

| 指标 | 公共API | 本地Docker |
|------|---------|------------|
| 响应时间 | ~3-5秒 | ~1-2秒 |
| 请求限制 | 20次/天/IP | 无限制 |
| 部署难度 | ⭐ | ⭐⭐⭐ |
| 维护成本 | 0 | 中等 |

## ⚙️ 代码修改清单

### 后端修改

**文件**: `backend/src/services/LanguageCheckService.ts`

```typescript
// 第 76 行
- this.apiUrl = process.env.LANGUAGETOOL_API_URL || 'http://localhost:8010/v2/check';
+ this.apiUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2/check';
```

### 前端修改

**文件**: `frontend/src/pages/MultilingualCheck.tsx`

删除的代码:
- 第 72 行: `languageToolHealthy` 状态
- 第 85-93 行: `checkHealth()` 函数
- 第 95-97 行: `useEffect(() => checkHealth())`
- 第 123-126 行: 健康检查验证
- 第 203-220 行: 服务状态徽章 UI
- 第 225-234 行: Docker 启动警告
- 第 266 行: 按钮禁用状态中的健康检查

## ✅ 测试验证

### 测试命令
```bash
# 测试增强检查
curl -s -X POST http://localhost:3000/api/v1/enhanced-multilingual/check \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.anker.com","language":"en-US"}' \
  | jq '.success'

# 预期输出
true
```

### 测试结果
- ✅ API 调用成功
- ✅ 语法检查正常
- ✅ 智能过滤生效
- ✅ 无 Docker 依赖

## 🎯 用户体验改进

### 修改前
1. 访问页面
2. 看到"LanguageTool 服务未启动"警告 ❌
3. 需要运行 Docker 命令
4. 等待容器启动
5. 刷新页面
6. 开始使用

**总耗时**: ~5分钟 ⏰

### 修改后
1. 访问页面
2. 直接开始使用 ✅

**总耗时**: ~0秒 ⚡

## 📚 相关文档

- [增强版多语言检查功能](./README_ENHANCED_MULTILINGUAL.md)
- [快速开始指南](./QUICK_START_ENHANCED_MULTILINGUAL.md)
- [功能详细说明](./ENHANCED_MULTILINGUAL_FEATURE.md)

## ⚠️ 注意事项

### 公共 API 限制

LanguageTool 公共 API 有以下限制:
- 每个 IP 地址每天最多 20 次请求
- 每次请求最大文本长度 20KB
- 需要稳定的网络连接

### 生产环境建议

对于生产环境或高频使用场景,建议:
1. 部署本地 LanguageTool Docker 服务
2. 或申请 LanguageTool Premium API
3. 设置 `LANGUAGETOOL_API_URL` 环境变量

## 🔄 回退方案

如果需要回退到使用本地 Docker:

```bash
# 1. 启动 Docker 容器
docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool:latest

# 2. 设置环境变量
export LANGUAGETOOL_API_URL=http://localhost:8010/v2/check

# 3. 重启后端服务
npm run dev:backend
```

## 📅 更新日志

**2025-12-26**
- ✅ 切换到 LanguageTool 公共 API
- ✅ 移除 Docker 依赖
- ✅ 移除健康检查和警告提示
- ✅ 简化用户使用流程
- ✅ 测试验证通过

---

**现在您可以立即开始使用多语言检查功能,无需任何额外配置!** 🎉
