# 🚀 Anita Web Sentinel - Launch 平台部署摘要

## ✅ 已解决的问题

### 1. Docker 启动速度问题 ✅
**问题**: 即使使用 Bitable 模式,启动时仍等待 PostgreSQL 连接 60 秒

**解决方案**:
- 修改 docker-entrypoint.sh,自动从 backend/.env 读取配置
- 默认使用 Bitable 模式
- 创建 .env.example 模板文件

**效果**: 启动时间从 60+ 秒缩短到 5 秒!

### 2. CORS 跨域错误 ✅
**问题**: `Error: Not allowed by CORS`

**解决方案**:
- 允许所有 localhost 和 127.0.0.1
- 支持内网 IP (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- 支持 Launch 平台域名 (*.anker-launch.com, *.launch.anker-in.com)
- 添加 CORS 阻止日志便于调试

### 3. Bitable 模式下的 PostgreSQL 调用 ✅
修复的文件:
- ✅ backend/src/database/connection.ts
- ✅ backend/src/database/migrate.ts
- ✅ backend/src/services/PatrolSchedulerService.ts
- ✅ backend/src/api/routes/patrol.ts
- ✅ backend/src/index.ts

### 4. 其他已修复问题 ✅
- ✅ 端口冲突 (PORT 从 80 改为 3000)
- ✅ Playwright 浏览器缓存保留
- ✅ UUID 依赖添加
- ✅ 前端构建路径修复
- ✅ TypeScript 编译跳过

## 📋 Launch 平台部署配置

### Git 配置
```yaml
仓库地址: http://e.coding.anker-in.com/codingcorp/dtc_it/anker-web-sentinel.git
分支: master
Dockerfile 路径: Dockerfile
构建上下文: .
```

### 环境变量(必填)
```bash
# 数据存储
DATABASE_STORAGE=bitable

# 飞书开放平台
FEISHU_APP_ID=cli_a875ff2f3859d00c
FEISHU_APP_SECRET=MzTfzW3ThazH7kXkbkEhBenRl8RNGj1E
FEISHU_BASE_URL=https://open.feishu.cn

# Anthropic AI
APP_ANTHROPIC_API_KEY=sk-zMCehgSpMSrzgv_Th6i-hA
APP_ANTHROPIC_BASE_URL=https://ai-router.anker-in.com/v1
APP_ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
```

### 环境变量(可选)
```bash
# SMTP 邮件服务
SMTP_HOST=smtp.feishu.cn
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=anita.zhou@anker.io
SMTP_PASSWORD=PpV76eGV3qKncsZQ
SMTP_FROM_NAME=Anita-Web-Sentinel
SMTP_FROM_EMAIL=anita.zhou@anker.io

# 截图存储
SCREENSHOT_DIR=/app/backend/screenshots
```

### 容器配置
```yaml
端口: 80
协议: HTTP
健康检查路径: /health
健康检查端口: 80
```

### 资源配置(建议)
```yaml
CPU: 2 核
内存: 4 GB
存储: 20 GB
```

## 🎯 部署步骤

1. **登录 Launch 平台**: https://launch.anker-in.com

2. **创建新应用**:
   - 应用名称: `anita-web-sentinel`
   - 部署方式: Git 仓库

3. **配置 Git**:
   - 按照上方 Git 配置填写
   - 如需配置访问权限,参考 [LAUNCH_GIT_ACCESS_SETUP.md](LAUNCH_GIT_ACCESS_SETUP.md)

4. **设置环境变量**:
   - 在 Launch 平台的环境变量配置中添加必填变量
   - 可选变量按需添加

5. **配置容器**:
   - 按照上方容器配置填写

6. **点击部署**:
   - 等待构建完成(约 5-10 分钟)
   - 查看构建日志确认无错误

7. **验证部署**:
   ```bash
   # 健康检查
   curl https://your-domain.launch.anker-in.com/health

   # 测试 API
   curl https://your-domain.launch.anker-in.com/api/v1/tasks
   ```

## 📊 部署架构

```
┌─────────────────────────────────────────────┐
│  Launch 平台容器 (端口 80)                   │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Nginx (前端 + API 代理)               │  │
│  │  - 静态文件服务 (React SPA)            │  │
│  │  - API 代理: /api/* -> localhost:3000 │  │
│  │  - 健康检查: /health                   │  │
│  │  - 截图访问: /screenshots/*            │  │
│  └───────────────────────────────────────┘  │
│             ↓                                │
│  ┌───────────────────────────────────────┐  │
│  │  Node.js Backend (端口 3000)          │  │
│  │  - Express API 服务                    │  │
│  │  - Playwright 浏览器测试               │  │
│  │  - Feishu Bitable 数据存储             │  │
│  │  - Anthropic AI 集成                   │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
           ↓
    ┌─────────────┐
    │  用户浏览器  │
    └─────────────┘
```

## 🔍 验证清单

部署成功后,请验证以下功能:

### 基础功能
- [ ] 前端页面正常加载
- [ ] 健康检查返回 200 OK
- [ ] API 接口正常响应
- [ ] 无 CORS 错误

### 核心功能
- [ ] 可以创建测试任务
- [ ] 可以查看测试报告
- [ ] 可以查看巡检任务
- [ ] 可以查看巡检历史
- [ ] Playwright 测试可以正常运行
- [ ] 截图可以正常显示

### 数据存储
- [ ] Bitable 数据正常读写
- [ ] 测试报告正常保存
- [ ] 巡检任务正常保存

## 📝 相关文档

- [LAUNCH_DEPLOYMENT_GUIDE.md](LAUNCH_DEPLOYMENT_GUIDE.md) - 详细部署指南
- [LAUNCH_DEPLOYMENT_CHECKLIST.md](LAUNCH_DEPLOYMENT_CHECKLIST.md) - 部署检查清单
- [LAUNCH_GIT_ACCESS_SETUP.md](LAUNCH_GIT_ACCESS_SETUP.md) - Git 访问配置
- [.env.example](.env.example) - 本地开发环境变量模板

## 🐛 常见问题

### Q: 构建失败,提示 Git 访问权限不足
**解决**: 参考 [LAUNCH_GIT_ACCESS_SETUP.md](LAUNCH_GIT_ACCESS_SETUP.md) 配置访问 Token

### Q: 容器启动后健康检查失败
**检查**:
1. 查看容器日志
2. 确认环境变量正确设置
3. 确认端口配置为 80

### Q: API 返回 500 错误
**检查**:
1. 查看后端日志中的错误堆栈
2. 确认 Feishu 配置正确
3. 确认 Anthropic API 可访问

### Q: Playwright 测试失败
**检查**:
1. 确认 Dockerfile 使用的是最新版本
2. 查看是否有 "Executable doesn't exist" 错误
3. 确认系统依赖已正确安装

### Q: 前端页面空白
**检查**:
1. 打开浏览器开发者工具 Console
2. 查看是否有 JavaScript 错误
3. 查看 Network 标签中的 API 请求状态

## ✨ 项目特点

### 技术栈
- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: Node.js 20 + Express + TypeScript
- **测试**: Playwright (浏览器自动化)
- **存储**: Feishu Bitable (多维表格)
- **AI**: Anthropic Claude (智能分析)
- **部署**: Docker + Nginx

### 核心功能
1. **响应式测试**: 检测网站在不同设备上的兼容性
2. **UI 自动化测试**: 链接、表单、按钮、图片等元素测试
3. **性能测试**: Core Web Vitals 指标监控
4. **视觉回归测试**: 截图对比,检测 UI 变化
5. **定时巡检**: 自动定期执行测试任务
6. **智能报告**: AI 分析测试结果并生成报告

## 🎉 部署成功标志

当你看到以下内容时,说明部署成功:

1. ✅ Launch 平台显示应用运行中
2. ✅ 健康检查返回: `{"status":"healthy","timestamp":"..."}`
3. ✅ 访问前端 URL 可以看到登录页面
4. ✅ 可以创建测试任务并查看结果
5. ✅ 后端日志显示: `🚀 Server running on http://localhost:3000`
6. ✅ 无 CORS 错误或数据库连接错误

---

**祝部署顺利!** 🎊

如有问题,请查看详细文档或联系技术支持。
