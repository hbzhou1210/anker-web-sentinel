/**
 * 前端深度交互测试 - 多项目功能验证
 *
 * 本测试通过实际操作前端页面,验证各项功能的完整流程
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://10.5.3.150:10038';

test.describe('前端多项目功能深度测试', () => {

  test.beforeEach(async ({ page }) => {
    test.setTimeout(180000); // 3分钟超时
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 等待页面完全加载
    await page.waitForTimeout(2000);
  });

  // ==================== 功能 1: 巡检任务管理 ====================

  test('功能测试 1: 查看所有巡检任务', async ({ page }) => {
    console.log('\n=== 测试: 查看所有巡检任务 ===');

    // 截图初始状态
    await page.screenshot({ path: 'tests/screenshots/01-initial-page.png' });
    console.log('✓ 截图已保存: 01-initial-page.png');

    // 获取页面中所有文本内容
    const bodyText = await page.locator('body').textContent();
    console.log('页面包含的关键词:');

    // 检查是否有任务相关的关键词
    const keywords = ['巡检', '任务', 'task', 'patrol', '执行', 'execute', '测试', 'test'];
    for (const keyword of keywords) {
      if (bodyText?.includes(keyword)) {
        console.log(`  ✓ 找到关键词: "${keyword}"`);
      }
    }

    // 查找所有可能的任务名称
    const headings = await page.locator('h1, h2, h3, h4, h5, h6, .title, [class*="title"]').allTextContents();
    console.log('\n页面标题:');
    headings.forEach((heading, i) => {
      if (heading.trim()) {
        console.log(`  ${i + 1}. ${heading.trim()}`);
      }
    });

    // 查找所有链接
    const links = await page.locator('a[href]').evaluateAll(links =>
      links.map(link => ({
        text: link.textContent?.trim(),
        href: link.getAttribute('href')
      })).filter(link => link.text && link.text.length > 0)
    );

    console.log('\n页面链接:');
    links.slice(0, 10).forEach((link, i) => {
      console.log(`  ${i + 1}. "${link.text}" -> ${link.href}`);
    });

    // 查找所有按钮
    const buttons = await page.locator('button').evaluateAll(btns =>
      btns.map(btn => btn.textContent?.trim()).filter(text => text && text.length > 0)
    );

    console.log('\n页面按钮:');
    buttons.forEach((btn, i) => {
      console.log(`  ${i + 1}. "${btn}"`);
    });

    expect(bodyText).toBeTruthy();
  });

  test('功能测试 2: 查看任务详情 (通过API数据)', async ({ page }) => {
    console.log('\n=== 测试: 查看任务详情 ===');

    // 监听网络请求
    const apiRequests: any[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        try {
          const json = await response.json();
          apiRequests.push({
            url: response.url(),
            status: response.status(),
            data: json
          });
        } catch (e) {
          // 不是JSON响应,忽略
        }
      }
    });

    // 刷新页面触发API调用
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('\n捕获到的API调用:');
    apiRequests.forEach((req, i) => {
      console.log(`\n  ${i + 1}. ${req.url}`);
      console.log(`     状态: ${req.status}`);

      // 如果是任务列表API
      if (req.url.includes('/tasks') && Array.isArray(req.data)) {
        console.log(`     返回任务数: ${req.data.length}`);
        req.data.forEach((task: any, j: number) => {
          console.log(`       ${j + 1}. ${task.name || task.id}`);
          if (task.urls) {
            console.log(`          URL数量: ${task.urls.length}`);
          }
        });
      }
    });

    await page.screenshot({ path: 'tests/screenshots/02-after-reload.png' });
    console.log('\n✓ 截图已保存: 02-after-reload.png');

    expect(apiRequests.length).toBeGreaterThan(0);
  });

  test('功能测试 3: 尝试触发各种交互', async ({ page }) => {
    console.log('\n=== 测试: 触发各种交互 ===');

    // 查找所有可点击的元素
    const clickableElements = await page.locator('button, a, [role="button"], [onclick]').all();
    console.log(`\n找到 ${clickableElements.length} 个可点击元素`);

    // 尝试点击前5个按钮/链接
    for (let i = 0; i < Math.min(5, clickableElements.length); i++) {
      const element = clickableElements[i];

      try {
        const text = await element.textContent();
        const tagName = await element.evaluate(el => el.tagName);

        console.log(`\n尝试点击元素 ${i + 1}: <${tagName}> "${text?.trim()}"`);

        // 检查元素是否可见和可用
        const isVisible = await element.isVisible();
        const isEnabled = await element.isEnabled();

        console.log(`  可见: ${isVisible}, 可用: ${isEnabled}`);

        if (isVisible && isEnabled) {
          // 截图点击前
          await page.screenshot({ path: `tests/screenshots/03-before-click-${i + 1}.png` });

          await element.click({ timeout: 3000 });
          await page.waitForTimeout(1500);

          // 截图点击后
          await page.screenshot({ path: `tests/screenshots/03-after-click-${i + 1}.png` });
          console.log(`  ✓ 点击成功`);

          // 检查URL是否变化
          const currentUrl = page.url();
          console.log(`  当前URL: ${currentUrl}`);

          // 返回首页
          if (currentUrl !== BASE_URL && currentUrl !== BASE_URL + '/') {
            await page.goto(BASE_URL);
            await page.waitForLoadState('networkidle');
          }
        }
      } catch (error) {
        console.log(`  ✗ 点击失败: ${(error as Error).message}`);
      }
    }
  });

  // ==================== 功能 4: 表单交互测试 ====================

  test('功能测试 4: 查找并填写表单', async ({ page }) => {
    console.log('\n=== 测试: 查找并填写表单 ===');

    // 查找所有输入框
    const inputs = await page.locator('input, textarea, select').all();
    console.log(`\n找到 ${inputs.length} 个输入字段`);

    for (let i = 0; i < Math.min(5, inputs.length); i++) {
      const input = inputs[i];

      try {
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const placeholder = await input.getAttribute('placeholder');
        const tagName = await input.evaluate(el => el.tagName);

        console.log(`\n字段 ${i + 1}:`);
        console.log(`  标签: ${tagName}`);
        console.log(`  类型: ${type || 'text'}`);
        console.log(`  名称: ${name || '(无)'}`);
        console.log(`  占位符: ${placeholder || '(无)'}`);

        const isVisible = await input.isVisible();
        console.log(`  可见: ${isVisible}`);

        if (isVisible && tagName === 'INPUT') {
          // 尝试填写测试数据
          if (type === 'text' || type === 'search' || !type) {
            await input.fill('测试数据');
            console.log(`  ✓ 已填写: "测试数据"`);
            await page.waitForTimeout(500);
            await input.clear();
          } else if (type === 'checkbox') {
            await input.check();
            console.log(`  ✓ 已勾选`);
            await page.waitForTimeout(500);
            await input.uncheck();
          }
        }
      } catch (error) {
        console.log(`  ✗ 操作失败: ${(error as Error).message}`);
      }
    }

    await page.screenshot({ path: 'tests/screenshots/04-form-fields.png' });
    console.log('\n✓ 截图已保存: 04-form-fields.png');
  });

  // ==================== 功能 5: 导航菜单测试 ====================

  test('功能测试 5: 探索导航结构', async ({ page }) => {
    console.log('\n=== 测试: 探索导航结构 ===');

    // 查找可能的导航元素
    const navElements = await page.locator('nav, [role="navigation"], aside, .sidebar, .menu, [class*="nav"]').all();
    console.log(`\n找到 ${navElements.length} 个导航元素`);

    for (let i = 0; i < navElements.length; i++) {
      const nav = navElements[i];

      try {
        const text = await nav.textContent();
        const className = await nav.getAttribute('class');

        console.log(`\n导航元素 ${i + 1}:`);
        console.log(`  类名: ${className}`);
        console.log(`  内容预览: ${text?.substring(0, 100)}...`);

        // 查找导航内的链接
        const navLinks = await nav.locator('a').all();
        console.log(`  包含 ${navLinks.length} 个链接`);

        for (let j = 0; j < Math.min(10, navLinks.length); j++) {
          const link = navLinks[j];
          const linkText = await link.textContent();
          const href = await link.getAttribute('href');
          console.log(`    ${j + 1}. "${linkText?.trim()}" -> ${href}`);
        }
      } catch (error) {
        console.log(`  ✗ 解析失败: ${(error as Error).message}`);
      }
    }

    await page.screenshot({ path: 'tests/screenshots/05-navigation.png', fullPage: true });
    console.log('\n✓ 全页截图已保存: 05-navigation.png');
  });

  // ==================== 功能 6: 数据展示测试 ====================

  test('功能测试 6: 检查数据展示组件', async ({ page }) => {
    console.log('\n=== 测试: 检查数据展示组件 ===');

    // 查找表格
    const tables = await page.locator('table').all();
    console.log(`\n找到 ${tables.length} 个表格`);

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];

      try {
        // 获取表头
        const headers = await table.locator('th').allTextContents();
        console.log(`\n表格 ${i + 1} 表头:`);
        headers.forEach((header, j) => {
          console.log(`  列 ${j + 1}: ${header.trim()}`);
        });

        // 获取行数
        const rows = await table.locator('tbody tr').count();
        console.log(`  数据行数: ${rows}`);

        // 获取前3行数据
        if (rows > 0) {
          console.log('  前3行数据:');
          for (let j = 0; j < Math.min(3, rows); j++) {
            const row = table.locator('tbody tr').nth(j);
            const cells = await row.locator('td').allTextContents();
            console.log(`    行 ${j + 1}: ${cells.map(c => c.trim()).join(' | ')}`);
          }
        }
      } catch (error) {
        console.log(`  ✗ 解析失败: ${(error as Error).message}`);
      }
    }

    // 查找卡片组件
    const cards = await page.locator('.card, [class*="card"], .panel, [class*="panel"]').all();
    console.log(`\n找到 ${cards.length} 个卡片组件`);

    for (let i = 0; i < Math.min(5, cards.length); i++) {
      const card = cards[i];
      try {
        const text = await card.textContent();
        console.log(`\n卡片 ${i + 1}:`);
        console.log(`  内容: ${text?.substring(0, 150)}...`);
      } catch (error) {
        console.log(`  ✗ 解析失败: ${(error as Error).message}`);
      }
    }

    await page.screenshot({ path: 'tests/screenshots/06-data-display.png', fullPage: true });
    console.log('\n✓ 全页截图已保存: 06-data-display.png');
  });

  // ==================== 功能 7: 模态框/弹窗测试 ====================

  test('功能测试 7: 触发并测试弹窗', async ({ page }) => {
    console.log('\n=== 测试: 触发并测试弹窗 ===');

    // 查找可能触发弹窗的按钮
    const triggerButtons = await page.locator('button:has-text("新建"), button:has-text("创建"), button:has-text("添加"), button:has-text("详情"), button:has-text("编辑")').all();
    console.log(`\n找到 ${triggerButtons.length} 个可能触发弹窗的按钮`);

    for (let i = 0; i < Math.min(3, triggerButtons.length); i++) {
      const button = triggerButtons[i];

      try {
        const buttonText = await button.textContent();
        console.log(`\n尝试点击: "${buttonText?.trim()}"`);

        await button.click({ timeout: 3000 });
        await page.waitForTimeout(1000);

        // 检查是否出现弹窗
        const modal = page.locator('[role="dialog"], .modal, .drawer, [class*="modal"], [class*="dialog"]').first();
        const isModalVisible = await modal.isVisible().catch(() => false);

        if (isModalVisible) {
          console.log('  ✓ 弹窗已打开');

          // 截图弹窗
          await page.screenshot({ path: `tests/screenshots/07-modal-${i + 1}.png` });
          console.log(`  ✓ 截图已保存: 07-modal-${i + 1}.png`);

          // 查找弹窗内的元素
          const modalInputs = await modal.locator('input, textarea').count();
          const modalButtons = await modal.locator('button').count();
          console.log(`  弹窗包含: ${modalInputs} 个输入框, ${modalButtons} 个按钮`);

          // 尝试关闭弹窗
          const closeButton = modal.locator('button:has-text("取消"), button:has-text("关闭"), button[aria-label*="close"], .close').first();
          if (await closeButton.isVisible().catch(() => false)) {
            await closeButton.click();
            await page.waitForTimeout(500);
            console.log('  ✓ 弹窗已关闭');
          } else {
            // 尝试按ESC关闭
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            console.log('  ✓ 按ESC关闭弹窗');
          }
        } else {
          console.log('  ℹ 未检测到弹窗,可能在当前页面打开或需要其他条件');
        }
      } catch (error) {
        console.log(`  ✗ 操作失败: ${(error as Error).message}`);
      }
    }
  });

  // ==================== 功能 8: 实际执行巡检任务 ====================

  test('功能测试 8: 尝试执行巡检任务', async ({ page }) => {
    console.log('\n=== 测试: 尝试执行巡检任务 ===');

    // 监听API调用
    const apiCalls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/execute')) {
        apiCalls.push(request.url());
        console.log(`  → API调用: ${request.method()} ${request.url()}`);
      }
    });

    // 查找执行相关的按钮
    const executeButtons = await page.locator('button:has-text("执行"), button:has-text("运行"), button:has-text("Run"), button:has-text("Execute")').all();
    console.log(`\n找到 ${executeButtons.length} 个执行按钮`);

    if (executeButtons.length > 0) {
      try {
        const button = executeButtons[0];
        const buttonText = await button.textContent();
        console.log(`\n点击执行按钮: "${buttonText?.trim()}"`);

        await button.click();
        await page.waitForTimeout(3000);

        console.log(`\n捕获到 ${apiCalls.length} 个执行API调用`);

        // 检查是否有成功提示
        const successMessage = page.locator('[class*="success"], [class*="message"], .notification, [role="alert"]').first();
        if (await successMessage.isVisible().catch(() => false)) {
          const message = await successMessage.textContent();
          console.log(`✓ 成功提示: ${message?.trim()}`);
        }

        await page.screenshot({ path: 'tests/screenshots/08-after-execute.png' });
        console.log('✓ 截图已保存: 08-after-execute.png');
      } catch (error) {
        console.log(`✗ 执行失败: ${(error as Error).message}`);
      }
    } else {
      console.log('未找到执行按钮,尝试通过URL直接调用API');

      // 直接调用API
      const response = await page.request.post(`${BASE_URL}/api/v1/patrol/tasks/c580fa78-3fed-432c-a5d0-fc54227460a2/execute`);
      console.log(`API响应状态: ${response.status()}`);

      if (response.ok()) {
        const data = await response.json();
        console.log('API响应:', JSON.stringify(data, null, 2));
      }
    }
  });

  // ==================== 功能 9: 检查执行历史 ====================

  test('功能测试 9: 查看执行历史', async ({ page }) => {
    console.log('\n=== 测试: 查看执行历史 ===');

    // 尝试导航到历史页面
    const historyLinks = await page.locator('a:has-text("历史"), a:has-text("记录"), a:has-text("History"), a:has-text("Execution")').all();

    if (historyLinks.length > 0) {
      const link = historyLinks[0];
      const linkText = await link.textContent();
      console.log(`\n点击历史链接: "${linkText?.trim()}"`);

      await link.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/screenshots/09-history-page.png', fullPage: true });
      console.log('✓ 截图已保存: 09-history-page.png');
    } else {
      console.log('未找到历史链接,直接通过API获取');

      const response = await page.request.get(`${BASE_URL}/api/v1/patrol/executions?limit=5`);
      if (response.ok()) {
        const data = await response.json();
        console.log(`\n获取到 ${data.length} 条执行记录:`);
        data.forEach((record: any, i: number) => {
          console.log(`\n记录 ${i + 1}:`);
          console.log(`  ID: ${record.id}`);
          console.log(`  状态: ${record.status}`);
          console.log(`  开始时间: ${record.startedAt}`);
          console.log(`  总URL数: ${record.totalUrls}`);
          console.log(`  通过: ${record.passedUrls}, 失败: ${record.failedUrls}`);
        });
      }
    }
  });

  // ==================== 功能 10: 页面布局和响应式 ====================

  test('功能测试 10: 完整的响应式测试', async ({ page }) => {
    console.log('\n=== 测试: 完整的响应式测试 ===');

    const viewports = [
      { name: '桌面 (1920x1080)', width: 1920, height: 1080 },
      { name: '笔记本 (1366x768)', width: 1366, height: 768 },
      { name: '平板横屏 (1024x768)', width: 1024, height: 768 },
      { name: '平板竖屏 (768x1024)', width: 768, height: 1024 },
      { name: 'iPhone XR (414x896)', width: 414, height: 896 },
      { name: 'iPhone SE (375x667)', width: 375, height: 667 },
      { name: '小屏手机 (320x568)', width: 320, height: 568 },
    ];

    for (const viewport of viewports) {
      console.log(`\n测试视口: ${viewport.name}`);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);

      // 检查主要元素是否可见
      const root = page.locator('#root');
      const isVisible = await root.isVisible();
      console.log(`  #root 可见: ${isVisible ? '✓' : '✗'}`);

      // 检查滚动
      const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const clientHeight = await page.evaluate(() => document.documentElement.clientHeight);
      const hasScroll = scrollHeight > clientHeight;
      console.log(`  页面高度: ${scrollHeight}px, 视口高度: ${clientHeight}px, 有滚动: ${hasScroll ? '是' : '否'}`);

      // 截图
      const filename = `10-viewport-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: `tests/screenshots/${filename}`, fullPage: false });
      console.log(`  ✓ 截图: ${filename}`);
    }
  });

});
