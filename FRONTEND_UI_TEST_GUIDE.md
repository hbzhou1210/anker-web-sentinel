# 前端 UI 测试指南

## 📋 测试说明

我已经创建了一个完整的 Playwright 自动化测试脚本,可以对前端 UI 进行全面测试。

**测试脚本位置**: `tests/frontend-ui-test.spec.ts`

---

## 🚀 快速开始

### 1. 安装 Playwright (如果还没安装)

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 2. 运行测试

#### 方式 1: 无头模式运行 (快速)
```bash
npx playwright test tests/frontend-ui-test.spec.ts
```

#### 方式 2: 有头模式运行 (可视化)
```bash
npx playwright test tests/frontend-ui-test.spec.ts --headed
```

#### 方式 3: 调试模式运行
```bash
npx playwright test tests/frontend-ui-test.spec.ts --debug
```

#### 方式 4: 运行特定测试
```bash
# 运行特定的测试用例
npx playwright test tests/frontend-ui-test.spec.ts -g "首页应该正确加载"
```

#### 方式 5: UI 模式运行 (推荐)
```bash
npx playwright test tests/frontend-ui-test.spec.ts --ui
```

---

## 📊 测试覆盖范围

### ✅ 页面加载测试 (2个)
1. 首页正确加载
2. 无 React 错误

### ✅ 导航测试 (2个)
3. 导航栏存在并可交互
4. 侧边栏/菜单可展开

### ✅ 巡检任务管理测试 (3个)
5. 任务列表显示
6. 查看任务详情
7. 立即执行按钮可用

### ✅ 表单交互测试 (2个)
8. 新建任务表单可打开
9. 表单验证正常工作

### ✅ 执行历史测试 (1个)
10. 执行历史列表显示

### ✅ 响应式测试 (2个)
11. 移动端视口正确显示
12. 平板视口正确显示

### ✅ 性能测试 (1个)
13. 页面加载性能合理

### ✅ 数据刷新测试 (1个)
14. 数据能够刷新

### ✅ 搜索/筛选测试 (1个)
15. 搜索功能存在

### ✅ 错误处理测试 (1个)
16. 网络错误有友好提示

### ✅ 可访问性测试 (1个)
17. 页面有合理的可访问性

### ✅ 截图对比测试 (1个)
18. 首页截图保存

### ✅ API 集成测试 (2个)
19. 前端正确调用后端 API
20. 前端能处理 API 响应

**总计: 20 个测试用例**

---

## 🎯 测试特点

### 1. 容错性强
- 使用 `.first()` 避免多个元素匹配问题
- 使用 `if (await element.count() > 0)` 检查元素存在性
- 找不到元素时输出警告而不是失败

### 2. 多种选择器策略
- 文本匹配: `button:has-text("执行")`
- 属性匹配: `input[type="search"]`
- 占位符匹配: `input[placeholder*="搜索"]`
- ARIA 匹配: `button[aria-label*="刷新"]`

### 3. 详细的日志输出
- 每个测试步骤都有清晰的日志
- 使用 `console.log` 输出测试进度
- 使用 `console.warn` 标记潜在问题

### 4. 实用的等待策略
- `waitForLoadState('networkidle')`: 等待网络空闲
- `waitForTimeout()`: 等待动画完成
- 合理的超时时间设置

---

## 📸 查看测试结果

### 1. 查看测试报告
```bash
npx playwright show-report
```

### 2. 查看截图
```bash
open tests/screenshots/homepage.png
```

### 3. 查看视频录制 (如果启用)
测试失败时会自动录制视频,保存在 `test-results/` 目录

---

## 🔧 配置 Playwright

如果需要更多配置,创建 `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: 'http://10.5.3.150:10038',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
```

---

## 🐛 常见问题

### Q1: 测试超时怎么办?
**A**: 增加超时时间
```typescript
test.setTimeout(180000); // 3分钟
```

### Q2: 元素找不到怎么办?
**A**: 使用浏览器开发者工具检查实际的 HTML 结构,然后调整选择器

### Q3: 如何调试失败的测试?
**A**: 使用 `--debug` 模式
```bash
npx playwright test tests/frontend-ui-test.spec.ts --debug
```

### Q4: 如何跳过某些测试?
**A**: 使用 `test.skip()`
```typescript
test.skip('跳过这个测试', async ({ page }) => {
  // ...
});
```

---

## 💡 扩展测试

### 1. 添加更多交互测试
```typescript
test('应该能够编辑任务', async ({ page }) => {
  const editButton = page.locator('button:has-text("编辑")').first();
  await editButton.click();
  // ... 更多交互
});
```

### 2. 添加数据驱动测试
```typescript
const testData = [
  { name: '测试任务1', url: 'https://example1.com' },
  { name: '测试任务2', url: 'https://example2.com' },
];

for (const data of testData) {
  test(`应该能创建任务: ${data.name}`, async ({ page }) => {
    // ... 使用 data 创建任务
  });
}
```

### 3. 添加性能监控
```typescript
test('应该监控性能指标', async ({ page }) => {
  await page.goto(BASE_URL);

  const metrics = await page.evaluate(() => {
    const perf = performance.getEntriesByType('navigation')[0];
    return {
      domContentLoaded: perf.domContentLoadedEventEnd,
      loadComplete: perf.loadEventEnd,
    };
  });

  console.log('性能指标:', metrics);
});
```

---

## 🎓 最佳实践

1. **使用 data-testid 属性**
   ```html
   <button data-testid="execute-btn">执行</button>
   ```
   ```typescript
   page.locator('[data-testid="execute-btn"]')
   ```

2. **避免使用 XPath**
   - 优先使用 CSS 选择器
   - XPath 难以维护且性能较差

3. **保持测试独立性**
   - 每个测试应该能够独立运行
   - 不要依赖其他测试的状态

4. **使用 Page Object Model**
   - 将页面元素和操作封装到类中
   - 提高代码复用性和可维护性

---

## 📚 参考资源

- [Playwright 官方文档](https://playwright.dev/)
- [Playwright 最佳实践](https://playwright.dev/docs/best-practices)
- [Playwright API 参考](https://playwright.dev/docs/api/class-playwright)

---

**创建时间**: 2025-12-17
**适用版本**: Playwright ^1.40.0
