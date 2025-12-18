# 技术栈说明

## 当前技术栈（2025-12-18 更新）

### 后端
- **运行时**: Node.js 20+
- **语言**: TypeScript
- **框架**: Express
- **浏览器自动化**: Playwright
- **数据存储**: 飞书 Bitable（多维表格）
- **缓存**: Redis（可选）
- **AI**: Anthropic Claude (via AI Router)

### 前端
- **框架**: React 18
- **语言**: TypeScript
- **构建工具**: Vite
- **样式**: TailwindCSS
- **状态管理**: React Hooks

### DevOps
- **容器化**: Docker + Docker Compose
- **CI/CD**: GitHub Actions（待配置）
- **部署平台**: Launch / 自托管

---

## 数据存储架构

### 为什么使用飞书 Bitable？

1. **无需数据库运维** - 不需要维护 PostgreSQL 实例
2. **企业集成** - 与飞书生态无缝集成
3. **可视化管理** - 通过飞书界面直接查看和编辑数据
4. **权限控制** - 利用飞书的权限体系
5. **成本优化** - 无需额外的数据库服务器成本

### Bitable 数据表结构

项目使用以下飞书多维表格存储数据：

1. **patrol_tasks** - 巡检任务配置
2. **patrol_executions** - 巡检执行记录
3. **patrol_schedules** - 定时调度配置

### PostgreSQL 支持状态

**状态**: ⚠️ 已弃用（代码中保留但不推荐使用）

项目代码中仍保留了 PostgreSQL 的支持，但：
- ❌ 不再推荐使用
- ❌ 不再主动维护
- ❌ 已从 package.json 移除 `pg` 依赖
- ✅ 可通过设置 `DATABASE_STORAGE=postgresql` 切换回来（需自行安装 pg 包）

---

## 缓存策略

### Redis（可选）

**使用场景**:
- API 响应缓存
- 飞书 Access Token 缓存
- 性能测试结果缓存

**配置**:
```bash
# 开启 Redis
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# 关闭 Redis（开发环境推荐）
REDIS_ENABLED=false
```

**注意**: 开发环境可以禁用 Redis，生产环境建议启用以提升性能。

---

## 浏览器自动化

### Playwright 配置

**浏览器**: Chromium（无头模式）

**关键优化**（2025-12-18）:
- 内存限制: 2GB
- 进程模式: 多进程（提高稳定性）
- 浏览器生命周期: 30分钟
- 最大使用次数: 30次
- 动态扩缩容: 3-10个实例

详见: [浏览器崩溃问题修复总结](浏览器崩溃问题修复总结_2025-12-18.md)

---

## AI 集成

### Anthropic Claude

**用途**:
- Core Web Vitals 分析
- 页面质量评估
- 智能测试建议

**配置**:
```bash
APP_ANTHROPIC_API_KEY=your_key
APP_ANTHROPIC_BASE_URL=https://ai-router.anker-in.com/v1
APP_ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
```

---

## 环境变量配置

### 必需配置

```bash
# 数据存储
DATABASE_STORAGE=bitable

# 飞书配置
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
```

### 可选配置

```bash
# Redis 缓存
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379

# 邮件通知
SMTP_HOST=smtp.feishu.cn
SMTP_PORT=465
SMTP_USER=your_email@anker.io
SMTP_PASSWORD=your_password

# 性能测试 API
WEBPAGETEST_API_KEY=your_key
PAGESPEED_API_KEY=your_key

# AI 服务
APP_ANTHROPIC_API_KEY=your_key
```

---

## 依赖管理

### 核心依赖

```json
{
  "playwright": "^1.40.1",      // 浏览器自动化
  "express": "^4.18.2",          // Web 框架
  "axios": "^1.6.2",             // HTTP 客户端
  "@anthropic-ai/sdk": "^0.71.0", // AI SDK
  "redis": "^4.7.1",             // 缓存
  "node-cron": "^4.2.1"          // 定时任务
}
```

### 已移除的依赖

- ❌ `pg` - PostgreSQL 客户端（已移除）
- ❌ `@types/pg` - PostgreSQL 类型定义（已移除）

---

## 迁移指南

### 从 PostgreSQL 迁移到 Bitable

如果你之前使用的是 PostgreSQL 版本：

1. **准备飞书应用**
   - 创建飞书企业自建应用
   - 开通 `bitable:app` 权限
   - 获取 App ID 和 Secret

2. **更新配置**
   ```bash
   # 修改 .env
   DATABASE_STORAGE=bitable
   FEISHU_APP_ID=your_app_id
   FEISHU_APP_SECRET=your_app_secret
   ```

3. **数据迁移**（可选）
   - 目前没有自动迁移工具
   - 建议重新创建巡检任务
   - 历史数据可以手动导出后导入飞书表格

4. **移除 PostgreSQL**
   ```bash
   # 卸载 pg 包（如果之前安装了）
   npm uninstall pg @types/pg
   ```

---

## 性能优化

### 生产环境建议

1. **启用 Redis 缓存**
   ```bash
   REDIS_ENABLED=true
   ```

2. **调整浏览器池配置**
   ```bash
   BROWSER_POOL_SIZE=5
   MIN_BROWSER_POOL_SIZE=3
   MAX_BROWSER_POOL_SIZE=10
   ```

3. **配置健康检查**
   ```bash
   HEALTH_CHECK_INTERVAL=30000  # 30秒
   ```

4. **优化并发**
   ```bash
   MAX_CONCURRENT_URLS=3  # 根据服务器性能调整
   ```

---

## 故障排查

### 常见问题

**Q: Bitable 写入失败**
- 检查飞书应用权限
- 检查 App ID 和 Secret 是否正确
- 检查网络连接到 `open.feishu.cn`

**Q: 浏览器崩溃**
- 查看 [浏览器崩溃问题修复总结](浏览器崩溃问题修复总结_2025-12-18.md)
- 增加 Docker 容器的 shm_size
- 检查内存配置是否充足

**Q: Redis 连接失败**
- 开发环境可以设置 `REDIS_ENABLED=false`
- 检查 Redis 服务是否启动
- 检查 `REDIS_URL` 配置

---

## 技术选型理由

### 为什么选择这些技术？

| 技术 | 理由 |
|------|------|
| **Node.js 20** | LTS 版本，稳定可靠，生态丰富 |
| **TypeScript** | 类型安全，提高代码质量和可维护性 |
| **Express** | 成熟的 Web 框架，简单易用 |
| **Playwright** | 现代化的浏览器自动化工具，支持多浏览器 |
| **飞书 Bitable** | 无需运维，企业集成，可视化管理 |
| **React 18** | 主流前端框架，组件化开发 |
| **Vite** | 极速的开发体验，现代化构建工具 |
| **TailwindCSS** | 实用优先的 CSS 框架，快速开发 UI |
| **Redis** | 高性能缓存，可选配置 |

---

## 未来规划

### 短期（1-3个月）

- [ ] 完善 CI/CD 流程
- [ ] 添加更多自动化测试
- [ ] 优化性能监控
- [ ] 完善错误处理和日志

### 中期（3-6个月）

- [ ] 支持更多浏览器类型
- [ ] 添加 WebSocket 实时通知
- [ ] 实现测试结果趋势分析
- [ ] 支持自定义测试规则

### 长期（6-12个月）

- [ ] 分布式浏览器池
- [ ] AI 驱动的智能测试
- [ ] 多租户支持
- [ ] SaaS 化部署

---

**最后更新**: 2025-12-18
**维护者**: Anker DTC IT Team
