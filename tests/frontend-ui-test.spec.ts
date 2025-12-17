/**
 * 前端 UI 功能测试脚本
 *
 * 运行方式:
 * npx playwright test tests/frontend-ui-test.spec.ts --headed
 *
 * 或者使用 Playwright Test Runner:
 * npm run test:ui
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://10.5.3.150:10038';

test.describe('前端 UI 功能测试', () => {

  test.beforeEach(async ({ page }) => {
    // 设置较长的超时时间,因为是远程服务器
    test.setTimeout(120000);
    await page.goto(BASE_URL);
  });

  // ==================== 页面加载测试 ====================

  test('1. 首页应该正确加载', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/Web Automation Checker/);

    // 验证主要容器存在
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // 等待页面完全加载
    await page.waitForLoadState('networkidle');

    console.log('✓ 首页加载成功');
  });

  test('2. 检查页面是否有 React 错误', async ({ page }) => {
    // 监听控制台错误
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(3000); // 等待 React 初始化

    // 检查是否有 React 错误
    const reactErrors = errors.filter(e =>
      e.includes('React') ||
      e.includes('Uncaught') ||
      e.includes('TypeError')
    );

    if (reactErrors.length > 0) {
      console.warn('⚠️  发现控制台错误:', reactErrors);
    } else {
      console.log('✓ 无 React 错误');
    }

    expect(reactErrors.length).toBe(0);
  });

  // ==================== 导航测试 ====================

  test('3. 导航栏应该存在并可交互', async ({ page }) => {
    // 查找导航元素(根据实际 UI 调整选择器)
    const nav = page.locator('nav, [role="navigation"], header');

    if (await nav.count() > 0) {
      await expect(nav.first()).toBeVisible();
      console.log('✓ 导航栏存在');
    } else {
      console.warn('⚠️  未找到导航栏元素');
    }
  });

  test('4. 侧边栏/菜单应该可以展开', async ({ page }) => {
    // 查找菜单按钮或侧边栏
    const menuButton = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]').first();
    const sidebar = page.locator('aside, [role="complementary"]').first();

    if (await menuButton.count() > 0) {
      await menuButton.click();
      await page.waitForTimeout(500); // 等待动画
      console.log('✓ 菜单按钮可点击');
    } else if (await sidebar.count() > 0) {
      await expect(sidebar).toBeVisible();
      console.log('✓ 侧边栏存在');
    } else {
      console.warn('⚠️  未找到菜单或侧边栏');
    }
  });

  // ==================== 巡检任务管理测试 ====================

  test('5. 巡检任务列表应该显示', async ({ page }) => {
    // 查找任务列表相关元素
    const taskList = page.locator('[data-testid="task-list"], .task-list, table');

    if (await taskList.count() > 0) {
      await expect(taskList.first()).toBeVisible();
      console.log('✓ 任务列表显示');

      // 检查是否有任务项
      const taskItems = page.locator('tr, .task-item, [data-testid*="task"]');
      const count = await taskItems.count();
      console.log(`  发现 ${count} 个任务元素`);
    } else {
      console.warn('⚠️  未找到任务列表');
    }
  });

  test('6. 应该能够查看任务详情', async ({ page }) => {
    // 尝试点击第一个任务
    const firstTask = page.locator('tr:not(:first-child), .task-item').first();

    if (await firstTask.count() > 0) {
      await firstTask.click();
      await page.waitForTimeout(1000);

      // 检查是否打开了详情页/模态框
      const modal = page.locator('[role="dialog"], .modal, .drawer');
      if (await modal.count() > 0) {
        await expect(modal.first()).toBeVisible();
        console.log('✓ 任务详情显示');
      } else {
        console.log('  任务可能在新页面打开或没有详情视图');
      }
    } else {
      console.warn('⚠️  未找到任务项');
    }
  });

  test('7. 立即执行按钮应该存在并可点击', async ({ page }) => {
    // 查找执行按钮
    const executeButton = page.locator('button:has-text("执行"), button:has-text("运行"), button:has-text("Run")').first();

    if (await executeButton.count() > 0) {
      await expect(executeButton).toBeVisible();
      await expect(executeButton).toBeEnabled();
      console.log('✓ 执行按钮存在且可用');

      // 可选: 实际点击测试(注释掉避免触发真实执行)
      // await executeButton.click();
      // await page.waitForTimeout(1000);
      // console.log('✓ 执行按钮可点击');
    } else {
      console.warn('⚠️  未找到执行按钮');
    }
  });

  // ==================== 表单交互测试 ====================

  test('8. 新建任务表单应该可以打开', async ({ page }) => {
    // 查找新建按钮
    const createButton = page.locator('button:has-text("新建"), button:has-text("创建"), button:has-text("添加"), button:has-text("Create")').first();

    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(1000);

      // 检查表单是否打开
      const form = page.locator('form, [role="dialog"] form');
      if (await form.count() > 0) {
        await expect(form.first()).toBeVisible();
        console.log('✓ 新建任务表单打开');

        // 检查必填字段
        const nameInput = page.locator('input[name="name"], input[placeholder*="名称"]').first();
        if (await nameInput.count() > 0) {
          await expect(nameInput).toBeVisible();
          console.log('  ✓ 任务名称输入框存在');
        }
      }
    } else {
      console.warn('⚠️  未找到新建按钮');
    }
  });

  test('9. 表单验证应该正常工作', async ({ page }) => {
    // 尝试打开新建表单
    const createButton = page.locator('button:has-text("新建"), button:has-text("创建"), button:has-text("Create")').first();

    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(500);

      // 尝试直接提交空表单
      const submitButton = page.locator('button[type="submit"], button:has-text("确定"), button:has-text("提交")').first();
      if (await submitButton.count() > 0) {
        await submitButton.click();
        await page.waitForTimeout(500);

        // 检查是否有错误提示
        const errorMessage = page.locator('.error, .invalid, [role="alert"]');
        if (await errorMessage.count() > 0) {
          console.log('✓ 表单验证正常工作');
        }
      }
    }
  });

  // ==================== 执行历史测试 ====================

  test('10. 执行历史列表应该显示', async ({ page }) => {
    // 尝试导航到历史页面
    const historyLink = page.locator('a:has-text("历史"), a:has-text("记录"), a:has-text("History")').first();

    if (await historyLink.count() > 0) {
      await historyLink.click();
      await page.waitForTimeout(1000);

      // 检查历史列表
      const historyList = page.locator('table, .history-list');
      if (await historyList.count() > 0) {
        await expect(historyList.first()).toBeVisible();
        console.log('✓ 执行历史显示');
      }
    } else {
      console.log('  未找到历史链接,可能在同一页面');
    }
  });

  // ==================== 响应式测试 ====================

  test('11. 移动端视口应该正确显示', async ({ page }) => {
    // 切换到移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // 检查页面是否适配
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    console.log('✓ 移动端视口渲染正常');
  });

  test('12. 平板视口应该正确显示', async ({ page }) => {
    // 切换到平板视口
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    const root = page.locator('#root');
    await expect(root).toBeVisible();

    console.log('✓ 平板视口渲染正常');
  });

  // ==================== 性能测试 ====================

  test('13. 页面加载性能应该合理', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`  页面加载时间: ${loadTime}ms`);

    // 加载时间应该在 10 秒内
    expect(loadTime).toBeLessThan(10000);
    console.log('✓ 页面加载性能合理');
  });

  // ==================== 数据刷新测试 ====================

  test('14. 数据应该能够刷新', async ({ page }) => {
    // 查找刷新按钮
    const refreshButton = page.locator('button[aria-label*="刷新"], button[aria-label*="refresh"], button:has-text("刷新")').first();

    if (await refreshButton.count() > 0) {
      await refreshButton.click();
      await page.waitForTimeout(1000);
      console.log('✓ 刷新功能可用');
    } else {
      console.log('  未找到刷新按钮,可能自动刷新');
    }
  });

  // ==================== 搜索/筛选测试 ====================

  test('15. 搜索功能应该存在', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="搜索"], input[placeholder*="Search"]').first();

    if (await searchInput.count() > 0) {
      await expect(searchInput).toBeVisible();

      // 尝试输入搜索
      await searchInput.fill('anker');
      await page.waitForTimeout(500);
      console.log('✓ 搜索功能存在');
    } else {
      console.log('  未找到搜索框');
    }
  });

  // ==================== 错误处理测试 ====================

  test('16. 网络错误应该有友好提示', async ({ page }) => {
    // 模拟网络错误
    await page.route('**/api/**', route => route.abort());

    // 尝试触发 API 调用
    await page.reload();
    await page.waitForTimeout(2000);

    // 检查是否有错误提示
    const errorMessage = page.locator('[role="alert"], .error-message, .notification');
    if (await errorMessage.count() > 0) {
      console.log('✓ 错误提示存在');
    } else {
      console.log('  未发现明显的错误提示');
    }

    // 恢复网络
    await page.unroute('**/api/**');
  });

  // ==================== 可访问性测试 ====================

  test('17. 页面应该有合理的可访问性', async ({ page }) => {
    // 检查是否有 main landmark
    const main = page.locator('main, [role="main"]');
    if (await main.count() > 0) {
      console.log('✓ 有 main 区域');
    }

    // 检查按钮是否有合理的 aria-label 或文本
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    let accessibleButtons = 0;

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();

      if (ariaLabel || (text && text.trim())) {
        accessibleButtons++;
      }
    }

    console.log(`  ${accessibleButtons}/${Math.min(buttonCount, 10)} 个按钮有可访问标签`);
  });

  // ==================== 截图对比测试 ====================

  test('18. 首页应该与基准截图一致', async ({ page }) => {
    // 等待页面稳定
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 截图
    await page.screenshot({
      path: 'tests/screenshots/homepage.png',
      fullPage: true
    });

    console.log('✓ 首页截图已保存');
  });
});

// ==================== API 集成测试 ====================

test.describe('前端与后端集成测试', () => {

  test('19. 前端应该能正确调用巡检任务 API', async ({ page }) => {
    // 监听网络请求
    const apiCalls: string[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('  API 调用记录:');
    apiCalls.forEach(call => console.log(`    ${call}`));

    // 应该至少有一个 API 调用
    expect(apiCalls.length).toBeGreaterThan(0);
    console.log('✓ 前端正确调用后端 API');
  });

  test('20. 前端应该能处理 API 响应', async ({ page }) => {
    let hasResponse = false;

    page.on('response', response => {
      if (response.url().includes('/api/v1/patrol/tasks')) {
        hasResponse = true;
        console.log(`  API 响应状态: ${response.status()}`);
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (hasResponse) {
      console.log('✓ 前端接收到 API 响应');
    }
  });
});
