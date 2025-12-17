# Bug 修复总结 - 2025-12-17

## 修复的问题

### 问题 1: 买赠规则检查接口报错
**报错信息**:
```
获取规则列表失败: undefined
```

**根本原因**:
- MCP API 调用失败时,错误处理不够友好
- 错误消息格式不一致,导致 `result.msg` 为 undefined

**修复方案**:
1. 增强 `callMcpTool` 函数的错误处理
   - 添加 HTTP 响应状态检查
   - 增强 JSON 解析失败的处理
   - 提供详细的错误日志(工具名称、参数、错误信息)

2. 改进 `getRulesList` 函数的错误检查
   - 添加返回结果格式验证
   - 兼容多种错误消息字段 (`msg`, `message`, `Unknown error`)

**修改文件**:
- [check-all-rules.js](tools/function-discount-checker/check-all-rules.js)
  - Lines 36-80: 增强 `callMcpTool` 错误处理
  - Lines 90-97: 改进 `getRulesList` 错误检查

### 问题 2: browser.newPage 崩溃导致测试失败

**报错信息**:
```
browser.newPage: Target page, context or browser has been closed
Test failed
```

**根本原因**:
1. 目标网站(ankersolix.com)存在大量 React 错误循环
   - Minified React error #418 (重复 30+ 次)
   - Minified React error #423
2. 浏览器进程因内存压力或页面错误崩溃
3. 崩溃后尝试创建新页面失败,但错误处理不完善
4. 主要影响移动端/响应式测试(错误日志显示 390x844 viewport)

**修复方案**:

#### 2.1 增强 newPage 错误恢复机制
在响应式测试和桌面测试中,当 `newPage` 失败时:
1. 记录详细的错误日志(设备信息、URL等)
2. 尝试获取新的浏览器实例并重试
3. 如果重试仍然失败,跳过该 URL 并继续下一个
4. 标记为基础设施错误 (`isInfrastructureError: true`)

#### 2.2 修复 context 重新赋值问题
- 将响应式测试中的 `const context` 改为 `let context`
- 允许在浏览器刷新后更新 context 引用

**修改文件**:
- [PatrolService.ts](backend/src/services/PatrolService.ts)
  - Line 1587: `const context` → `let context`
  - Lines 1595-1630: 响应式测试的 newPage 错误处理增强
  - Lines 1678-1708: 桌面测试的 newPage 错误处理增强

**代码改进点**:
```typescript
// 之前: 单层 try-catch,失败后没有保护
try {
  page = await context.newPage();
} catch (error) {
  // 获取新浏览器但没有错误保护
  browser = await browserPool.acquire();
  context = await browser.newContext();
  page = await context.newPage(); // 可能再次失败!
}

// 现在: 双层 try-catch,完整的错误恢复
try {
  page = await context.newPage();
} catch (error) {
  console.warn('[Test] Failed to create page, retrying...');
  try {
    // 重试逻辑
    browser = await browserPool.acquire();
    context = await browser.newContext();
    page = await context.newPage();
    console.log('[Test] Successfully created page with fresh browser');
  } catch (retryError) {
    console.error('[Test] Failed even after browser refresh:', retryError);
    // 跳过该URL,继续下一个
    testResults.push({
      url: urlConfig.url,
      status: 'fail',
      errorMessage: `无法创建页面 (浏览器不稳定): ${retryError.message}`,
      isInfrastructureError: true,
    });
    failedUrls++;
    continue; // 跳过这个URL
  }
}
```

## 之前已部署的修复(上下文)

### 1. node-fetch 依赖移除
- 移除 node-fetch 依赖,使用 Node.js 内置 fetch
- 修复生产环境依赖缺失问题

### 2. 浏览器崩溃综合优化
- Docker 共享内存增加到 512MB
- 实现浏览器健康检查和自动替换机制
- 增强崩溃错误日志

## 验证结果

### 编译验证
```bash
✅ npm run build - TypeScript 编译通过,无错误
```

### 功能验证
- ✅ 买赠规则查询 - 错误处理更健壮
- ✅ 巡检服务 - newPage 失败时能够恢复
- ✅ 响应式测试 - 浏览器崩溃时跳过问题URL
- ✅ 桌面测试 - 浏览器崩溃时跳过问题URL

## 预期效果

### 1. 买赠规则查询
- **现在**: 提供详细的错误信息,便于快速定位问题
- **预期**: 即使 MCP 服务异常,也能给出明确的错误提示

### 2. 巡检测试稳定性
- **现在**: 单个URL浏览器崩溃不会中断整个巡检任务
- **预期**:
  - 崩溃时自动跳过问题URL
  - 继续完成其他URL的测试
  - 测试报告中标记基础设施错误

### 3. 移动端/响应式测试
- **现在**: 目标网站的 React 错误不会导致测试完全失败
- **预期**:
  - 即使某些页面崩溃浏览器,其他页面仍能正常测试
  - 提供清晰的错误日志便于排查

## 不受影响的功能

- ✅ UI 测试服务
- ✅ 性能测试服务
- ✅ 邮件通知服务
- ✅ 其他巡检功能
- ✅ 视觉对比功能
- ✅ 截图功能

## 部署步骤

### 1. 提交代码
```bash
git add tools/function-discount-checker/check-all-rules.js
git add backend/src/services/PatrolService.ts
git commit -m "fix: 增强错误处理 - 买赠规则查询 & 浏览器崩溃恢复"
```

### 2. 推送到远程
```bash
./push-dual.sh "fix: 增强错误处理 - 买赠规则查询 & 浏览器崩溃恢复

问题1 - 买赠规则查询接口报错:
- 增强 MCP API 调用的错误处理
- 添加 HTTP 响应状态检查
- 提供详细的错误日志
- 兼容多种错误消息格式

问题2 - browser.newPage 崩溃:
- 增强 newPage 失败时的错误恢复机制
- 双层 try-catch 保护
- 失败时跳过问题 URL 继续测试
- 修复 context 重新赋值问题

修改文件:
- tools/function-discount-checker/check-all-rules.js
- backend/src/services/PatrolService.ts

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 3. 验证部署效果

**监控买赠规则查询**:
```bash
# 查看错误日志是否提供详细信息
docker logs -f anker-sentinel-backend | grep "MCP"
```

**监控巡检测试**:
```bash
# 查看 newPage 错误恢复日志
docker logs -f anker-sentinel-backend | grep "Failed to create page"
docker logs -f anker-sentinel-backend | grep "Successfully created"
```

## 风险评估

### 风险等级: ⭐️ (极低)

**原因**:
1. 所有修改都是防御性编程,增强错误处理
2. 不改变正常流程的业务逻辑
3. 有完整的 try-catch 保护
4. TypeScript 编译通过

### 潜在问题

**问题 1: 跳过的 URL 过多**
- 概率: 低
- 影响: 某些 URL 无法测试
- 缓解:
  - 错误日志会明确标记 `isInfrastructureError`
  - 可以查看具体是哪些 URL 失败
  - 根据失败原因决定是否需要进一步优化

**问题 2: MCP API 持续异常**
- 概率: 低
- 影响: 买赠规则查询失败
- 缓解:
  - 详细的错误日志帮助快速定位问题
  - 错误信息明确指出是 HTTP 错误还是 MCP 错误

## 回滚方案

如果新版本出现问题:

### 方案 1: 代码回滚
```bash
git revert <commit-hash>
./push-dual.sh "revert: 回滚错误处理增强"
```

### 方案 2: 仅回滚 PatrolService
```bash
git checkout HEAD~1 backend/src/services/PatrolService.ts
./push-dual.sh "revert: 回滚 PatrolService 修改"
```

## 监控建议

### 关键指标

1. **巡检成功率**
   - 监控跳过的 URL 数量
   - 检查 `isInfrastructureError: true` 的比例

2. **MCP API 错误率**
   - 监控 MCP 调用失败的频率
   - 分析错误类型分布

3. **浏览器替换频率**
   - 监控 "Failed to create page" 日志
   - 监控 "Successfully created page with fresh browser" 日志

### 告警阈值建议

- **巡检任务中跳过 URL > 20%**: 警告,需要调查浏览器稳定性
- **MCP API 错误率 > 10%**: 警告,需要检查 MCP 服务
- **连续 3 次浏览器创建失败**: 警告,可能需要重启服务

## 总结

本次修复采用防御性编程策略,增强系统的容错能力:

1. **错误处理增强**: 提供详细的错误信息,便于快速定位问题
2. **优雅降级**: 单个 URL 失败不影响整体任务
3. **错误恢复**: 浏览器崩溃时自动重试,重试失败则跳过
4. **可观测性**: 详细的日志记录,便于问题排查

**预期收益**:
- ✅ 买赠规则查询错误更易诊断
- ✅ 巡检测试更加稳定
- ✅ 问题 URL 不会阻塞整个任务
- ✅ 错误日志更加详细

**向后兼容**:
- ✅ 所有修改都是增强,不破坏现有功能
- ✅ 正常情况下行为不变
- ✅ 仅在异常情况下提供更好的处理

---

**修复日期**: 2025-12-17
**修复版本**: v1.2.0
**状态**: ✅ 待部署验证
**风险等级**: ⭐️ (极低)
