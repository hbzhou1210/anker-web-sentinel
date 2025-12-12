# 🚀 启动 anker-web-sentinel 项目

## ⚠️ 重要提示

anker-web-sentinel 使用**端口 3001**,不会与 function买赠规则查询工具(端口 3000)冲突。

两个项目可以**同时运行**,互不影响!

---

## 📋 启动步骤

### 1. 启动后端服务

```bash
cd /Users/admin/Desktop/function买赠规则查询/anker-web-sentinel/backend
PORT=3001 npm run dev
```

**后端地址**: http://localhost:3001

### 2. 启动前端(如果需要)

```bash
cd /Users/admin/Desktop/function买赠规则查询/anker-web-sentinel/frontend
npm install
npm run dev
```

---

## 🔍 项目端口分配

| 项目 | 端口 | 用途 |
|------|------|------|
| **function买赠规则查询** | 3000 | 买赠折扣规则查询工具 |
| **anker-web-sentinel** | 3001 | Web 自动化测试和监控 |

---

## ✅ 两个项目同时运行

### 终端 1: function买赠规则查询
```bash
cd /Users/admin/Desktop/function买赠规则查询/anker-web-sentinel/tools/function-discount-checker
npm run server
```
访问: http://localhost:3000

### 终端 2: anker-web-sentinel 后端
```bash
cd /Users/admin/Desktop/function买赠规则查询/anker-web-sentinel/backend
PORT=3001 npm run dev
```
访问: http://localhost:3001

---

## 🛠️ 配置说明

环境变量文件: `.env` (已配置端口 3001)

```env
PORT=3001
DATABASE_STORAGE=bitable
NODE_ENV=development
```

---

## 📝 常见问题

### Q: 端口冲突怎么办?
**A**: 已配置使用不同端口,不会冲突。如需修改端口:
```bash
PORT=3002 npm run dev
```

### Q: Playwright 错误?
**A**: 首次运行需要安装浏览器:
```bash
cd backend
npx playwright install chromium
```

### Q: 如何停止服务?
**A**: 在运行服务的终端按 `Ctrl+C`

### Q: 如何查看端口占用?
**A**:
```bash
# 查看 3000 端口
lsof -i :3000

# 查看 3001 端口
lsof -i :3001
```

---

## 🎯 功能说明

### anker-web-sentinel 主要功能:
- 🌐 Web 页面自动化测试
- 📸 页面截图对比
- 🔍 响应式设计测试
- 📊 性能监控
- ⚡ 巡检调度服务
- 📧 测试报告推送

### function买赠规则查询 主要功能:
- 🎁 折扣规则状态查询
- 📊 批量规则检查
- 📝 HTML 报告生成
- 🌐 Web + 命令行双模式

---

## 📚 相关文档

- [QUICK_START_TOOL.md](QUICK_START_TOOL.md) - function买赠规则查询快速启动
- [tools/function-discount-checker/README.md](tools/function-discount-checker/README.md) - 完整项目文档

---

**创建时间**: 2025-12-12
**状态**: ✅ 已配置,两个项目可同时运行
