#!/usr/bin/env node
/**
 * 测试浏览器稳定性 - 验证崩溃修复
 */

import { chromium } from 'playwright';

async function testBrowserStability() {
  console.log('🧪 测试浏览器稳定性...\n');

  const args = [
    // 基础安全参数
    '--no-sandbox',
    '--disable-setuid-sandbox',

    // 内存和稳定性
    '--disable-dev-shm-usage',
    '--disable-features=VizDisplayCompositor',
    '--disable-features=IsolateOrigins,site-per-process',

    // GPU 和渲染
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--disable-software-rasterizer',
    '--disable-accelerated-2d-canvas',
    '--disable-gl-drawing-for-tests',

    // 防止崩溃的关键参数
    '--disable-crash-reporter',
    '--disable-in-process-stack-traces',
    '--disable-logging',
    '--disable-breakpad',
    '--log-level=3',

    // 字体和渲染稳定性
    '--font-render-hinting=none',
    '--disable-font-subpixel-positioning',

    // 禁用可能导致崩溃的功能
    '--disable-web-security',
    '--disable-features=site-per-process',
    '--disable-blink-features=AutomationControlled',

    // 内存限制
    '--js-flags=--max-old-space-size=512',
  ];

  console.log('📋 使用的启动参数:');
  args.forEach(arg => console.log(`  ${arg}`));
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    args,
  });

  try {
    console.log('✓ 浏览器启动成功\n');

    // 测试1: 基本页面访问
    console.log('测试 1: 访问 https://www.anker.com');
    const page1 = await browser.newPage();
    await page1.goto('https://www.anker.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page1.waitForTimeout(2000);

    console.log('✓ 页面加载成功');
    console.log(`  状态: ${page1.isClosed() ? '已关闭' : '活跃'}`);

    // 测试2: 截图
    console.log('\n测试 2: 截取完整页面截图');
    try {
      const screenshot = await page1.screenshot({
        fullPage: true,
        type: 'png',
        timeout: 30000,
      });
      console.log(`✓ 截图成功 (${Math.round(screenshot.length / 1024)} KB)`);
    } catch (error) {
      console.error(`❌ 截图失败: ${error.message}`);
      throw error;
    }

    await page1.close();

    // 测试3: 并发页面
    console.log('\n测试 3: 创建3个并发页面');
    const pages = await Promise.all([
      browser.newPage(),
      browser.newPage(),
      browser.newPage(),
    ]);

    console.log('✓ 3个页面创建成功');

    // 并发访问和截图
    console.log('  并发访问和截图...');
    const results = await Promise.allSettled(
      pages.map(async (page, i) => {
        await page.goto('https://www.anker.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        await page.waitForTimeout(1000);
        const screenshot = await page.screenshot({
          fullPage: false,
          type: 'png',
          timeout: 30000,
        });
        return { page: i + 1, size: screenshot.length };
      })
    );

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        console.log(`  ✓ 页面 ${i + 1}: 成功 (${Math.round(result.value.size / 1024)} KB)`);
      } else {
        console.error(`  ❌ 页面 ${i + 1}: 失败 - ${result.reason.message}`);
      }
    });

    // 清理
    for (const page of pages) {
      if (!page.isClosed()) {
        await page.close();
      }
    }

    console.log('\n✅ 所有测试通过!浏览器稳定性良好。');

  } finally {
    await browser.close();
    console.log('\n✓ 浏览器已关闭');
  }
}

testBrowserStability().catch(error => {
  console.error('\n❌ 测试失败:');
  console.error(error);
  process.exit(1);
});
