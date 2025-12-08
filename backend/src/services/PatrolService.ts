import { Browser, Page, BrowserContext } from 'playwright';
import browserPool from '../automation/BrowserPool.js';
import { PatrolTaskRepository } from '../database/repositories/PatrolTaskRepository.js';
import { PatrolExecutionRepository } from '../database/repositories/PatrolExecutionRepository.js';
import { PatrolExecutionStatus, PatrolTestResult, PatrolTask, PatrolConfig } from '../models/entities.js';
import screenshotService from '../automation/ScreenshotService.js';
import { patrolEmailService } from './PatrolEmailService.js';
import { imageCompareService } from '../automation/ImageCompareService.js';

// 页面类型枚举
export enum PageType {
  Homepage = 'homepage',      // 首页
  LandingPage = 'landing',    // 落地页
  ProductPage = 'product',    // 产品页
  General = 'general'         // 通用页面
}

// 检查结果详情
interface CheckDetail {
  name: string;
  passed: boolean;
  message?: string;
  confidence?: 'high' | 'medium' | 'low'; // 置信度
}

export class PatrolService {
  private taskRepository: PatrolTaskRepository;
  private executionRepository: PatrolExecutionRepository;

  constructor() {
    this.taskRepository = new PatrolTaskRepository();
    this.executionRepository = new PatrolExecutionRepository();
  }

  /**
   * 尝试关闭常见的弹窗和遮罩层
   */
  private async dismissCommonPopups(page: Page): Promise<void> {
    try {
      console.log(`  Attempting to dismiss common popups...`);

      // 常见的弹窗关闭按钮选择器
      const closeSelectors = [
        // 通用关闭按钮
        'button[aria-label="Close"]',
        'button[aria-label="close"]',
        'button[aria-label="关闭"]',
        '[class*="close-button"]',
        '[class*="close-btn"]',
        '[class*="modal-close"]',
        '[class*="popup-close"]',
        '[data-dismiss="modal"]',

        // Cookie 同意弹窗
        'button:has-text("Accept")',
        'button:has-text("Accept all")',
        'button:has-text("同意")',
        'button:has-text("接受")',
        '#onetrust-accept-btn-handler',
        '.cookie-accept-button',

        // Newsletter 弹窗
        '[class*="newsletter"] button[class*="close"]',
        '[class*="email-popup"] button[class*="close"]',

        // X 图标
        'button:has-text("×")',
        'button:has-text("✕")',
        '[aria-label="dismiss"]',
      ];

      let closedCount = 0;
      for (const selector of closeSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            const isVisible = await element.isVisible();
            if (isVisible) {
              await element.click({ timeout: 1000 });
              closedCount++;
              await page.waitForTimeout(500); // 等待弹窗关闭动画
            }
          }
        } catch (error) {
          // 忽略单个选择器的错误,继续尝试其他的
        }
      }

      // 尝试按 ESC 键关闭弹窗
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      if (closedCount > 0) {
        console.log(`  ✓ Dismissed ${closedCount} popup(s)`);
      }
    } catch (error) {
      console.log(`  Could not dismiss popups (this is usually fine):`, (error as Error).message);
    }
  }

  /**
   * 检测页面类型
   */
  private detectPageType(url: string, name: string): PageType {
    const urlLower = url.toLowerCase();
    const nameLower = name.toLowerCase();

    // 产品页检测
    if (
      urlLower.includes('/products/') ||
      urlLower.includes('/product/') ||
      urlLower.match(/\/[a-z]\d+/i) || // 匹配产品ID模式如 /y1811
      nameLower.includes('产品') ||
      nameLower.includes('product')
    ) {
      return PageType.ProductPage;
    }

    // 首页检测 - 必须是域名根路径
    try {
      const parsedUrl = new URL(url);
      const isRootPath = parsedUrl.pathname === '/' || parsedUrl.pathname === '';

      if (
        isRootPath ||
        nameLower.includes('首页') ||
        nameLower.includes('home')
      ) {
        return PageType.Homepage;
      }
    } catch (error) {
      // URL 解析失败,继续其他检测
    }

    // 活动页/促销页检测
    if (
      urlLower.includes('/deals') ||
      urlLower.includes('/sale') ||
      urlLower.includes('/promotion') ||
      urlLower.includes('/campaign') ||
      nameLower.includes('活动') ||
      nameLower.includes('促销') ||
      nameLower.includes('deal')
    ) {
      return PageType.LandingPage;
    }

    // 落地页检测
    if (
      nameLower.includes('落地页') ||
      nameLower.includes('landing') ||
      urlLower.includes('/pages/') ||
      nameLower.includes('关于') ||
      nameLower.includes('about')
    ) {
      return PageType.LandingPage;
    }

    return PageType.General;
  }

  /**
   * 首页/落地页检查: 功能模块完整性
   */
  private async checkHomepageModules(page: Page): Promise<CheckDetail[]> {
    const checks: CheckDetail[] = [];

    try {
      // 1. 导航栏检查 - 改进的检测逻辑
      const navigationResult = await page.evaluate(() => {
        const selectors = [
          'header nav',
          'header',
          '.header',
          '.navigation',
          'nav[class*="nav"]',
          '[class*="header"]',
          'nav'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            // 检查元素是否在视口顶部且可见
            const isAtTop = rect.top < 200; // 允许一些偏移
            const isVisible = style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            style.opacity !== '0';
            const hasSize = rect.width > 100 && rect.height > 20;

            // 检查是否包含导航链接
            const links = el.querySelectorAll('a');
            const hasLinks = links.length >= 3;

            if (isVisible && hasSize && (isAtTop || hasLinks)) {
              return {
                found: true,
                confidence: (isAtTop && hasLinks) ? 'high' : 'medium',
                linkCount: links.length,
                position: `${Math.round(rect.top)}px from top`
              };
            }
          }
        }
        return { found: false, confidence: 'low' };
      });

      checks.push({
        name: '导航栏',
        passed: navigationResult.found,
        confidence: navigationResult.confidence as 'high' | 'medium' | 'low',
        message: navigationResult.found
          ? `导航栏存在且可见 (${navigationResult.linkCount} 个链接, ${navigationResult.position})`
          : '未找到导航栏或被遮挡'
      });

      // 2. 主Banner/首屏内容检查
      const bannerSelectors = [
        '.banner',
        '.hero',
        '.main-banner',
        '[class*="banner"]',
        '[class*="hero"]',
        'section:first-of-type'
      ];

      let bannerFound = false;
      for (const selector of bannerSelectors) {
        try {
          const banner = await page.$(selector);
          if (banner && await banner.isVisible()) {
            bannerFound = true;
            break;
          }
        } catch {}
      }

      checks.push({
        name: '主Banner',
        passed: bannerFound,
        message: bannerFound ? '主Banner存在且可见' : '未找到主Banner'
      });

      // 3. 主要内容区检查
      const contentSections = await page.$$eval(
        'main section, .content-section, [class*="section"], main > div',
        (elements) => elements.filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 100 && rect.height > 100;
        }).length
      );

      checks.push({
        name: '内容模块',
        passed: contentSections >= 3,
        message: `找到 ${contentSections} 个内容模块${contentSections >= 3 ? '(正常)' : '(不足3个)'}`
      });

      // 4. 页脚检查
      const footerSelectors = ['footer', '.footer', '[class*="footer"]'];
      let footerFound = false;
      for (const selector of footerSelectors) {
        try {
          const footer = await page.$(selector);
          if (footer && await footer.isVisible()) {
            footerFound = true;
            break;
          }
        } catch {}
      }

      checks.push({
        name: '页脚',
        passed: footerFound,
        message: footerFound ? '页脚存在且可见' : '未找到页脚'
      });

    } catch (error) {
      checks.push({
        name: '模块检查',
        passed: false,
        message: `检查过程出错: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }

    return checks;
  }

  /**
   * 产品页检查: 加购/购买功能
   */
  private async checkProductPageFunctions(page: Page): Promise<CheckDetail[]> {
    const checks: CheckDetail[] = [];

    try {
      // 1. 产品信息基础检查
      const productTitle = await page.$eval(
        'h1, .product-title, [class*="product-title"], [class*="productTitle"]',
        (el) => el.textContent?.trim()
      ).catch(() => null);

      checks.push({
        name: '产品标题',
        passed: !!productTitle,
        message: productTitle ? `标题: ${productTitle.substring(0, 50)}` : '未找到产品标题'
      });

      // 2. 产品图片检查
      const productImage = await page.$eval(
        'img[class*="product"], .product-image img, [class*="productImage"] img, main img',
        (img: HTMLImageElement) => img.complete && img.naturalHeight > 0
      ).catch(() => false);

      checks.push({
        name: '产品图片',
        passed: productImage,
        message: productImage ? '产品图片已加载' : '产品图片加载失败或不存在'
      });

      // 3. 价格信息检查
      let priceInfo = null;

      // 首先尝试从JSON-LD schema中提取价格(最准确)
      try {
        const schemaPrice = await page.evaluate(() => {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          for (const script of scripts) {
            try {
              const data = JSON.parse(script.textContent || '');
              if (data['@type'] === 'Product' && data.offers) {
                const price = data.offers.price || data.offers[0]?.price;
                if (price) {
                  return typeof price === 'number' ? `$${price.toFixed(2)}` : `$${parseFloat(price).toFixed(2)}`;
                }
              }
            } catch (e) {
              // 继续尝试下一个script
            }
          }
          return null;
        });
        if (schemaPrice) {
          priceInfo = schemaPrice;
        }
      } catch {}

      // 如果JSON-LD失败,尝试DOM选择器
      if (!priceInfo) {
        const priceSelectors = [
          'span[class*="price"]',
          'div[class*="price"]',
          '[data-price]',
          '.price',
          '[class*="Price"]'
        ];

        for (const selector of priceSelectors) {
          try {
            // 等待选择器出现
            await page.waitForSelector(selector, { timeout: 2000 }).catch(() => {});

            const price = await page.$eval(selector, (el) => {
              const text = el.textContent?.trim() || '';
              // 优先匹配带货币符号的完整价格,如 $129.99
              let match = text.match(/\$\s*\d+(?:\.\d{2})?/);
              // 如果没有货币符号,匹配独立的数字价格
              if (!match) {
                match = text.match(/\b\d+\.\d{2}\b/); // 匹配小数点后两位的价格,如 129.99
              }
              // 最后尝试匹配任何数字
              if (!match) {
                match = text.match(/\b\d+(?:\.\d+)?\b/);
              }
              return match ? match[0] : null;
            });
            if (price) {
              priceInfo = price;
              break;
            }
          } catch {}
        }
      }

      checks.push({
        name: '价格信息',
        passed: !!priceInfo && priceInfo !== '$0' && priceInfo !== '0',
        message: priceInfo ? `价格: ${priceInfo}` : '未找到有效价格信息'
      });

      // 4. 加购按钮检查
      const addToCartSelectors = [
        'button[class*="cart"]',
        'button[class*="add-to"]',
        '.add-to-cart',
        '[class*="addToCart"]',
        'button[class*="AddToCart"]',
        'button:has-text("Add to Cart")',
        'button:has-text("加入购物车")'
      ];

      let addToCartButton = null;
      for (const selector of addToCartSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            const isVisible = await button.isVisible();
            const isEnabled = await button.isEnabled();
            if (isVisible && isEnabled) {
              addToCartButton = { selector, isVisible, isEnabled };
              break;
            }
          }
        } catch {}
      }

      checks.push({
        name: '加购按钮',
        passed: !!addToCartButton,
        message: addToCartButton
          ? '加购按钮存在且可用'
          : '未找到可用的加购按钮'
      });

      // 5. 立即购买按钮检查
      const buyNowSelectors = [
        'button[class*="buy"]',
        '.buy-now',
        '[class*="buyNow"]',
        'button[class*="BuyNow"]',
        'button:has-text("Buy Now")',
        'button:has-text("立即购买")'
      ];

      let buyNowButton = null;
      for (const selector of buyNowSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            const isVisible = await button.isVisible();
            const isEnabled = await button.isEnabled();
            if (isVisible && isEnabled) {
              buyNowButton = { selector, isVisible, isEnabled };
              break;
            }
          }
        } catch {}
      }

      checks.push({
        name: '购买按钮',
        passed: !!buyNowButton,
        message: buyNowButton
          ? '购买按钮存在且可用'
          : '立即购买按钮不存在(可能仅支持加购)'
      });

    } catch (error) {
      checks.push({
        name: '功能检查',
        passed: false,
        message: `检查过程出错: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }

    return checks;
  }

  /**
   * 评估检查结果 - 考虑置信度
   */
  private evaluateChecks(
    pageType: PageType,
    checks: CheckDetail[]
  ): { status: 'pass' | 'warning' | 'fail'; message: string } {
    const passedCount = checks.filter(c => c.passed).length;
    const totalCount = checks.length;
    const passRate = totalCount > 0 ? (passedCount / totalCount) * 100 : 0;

    // 统计低置信度的检查
    const lowConfidenceChecks = checks.filter(c => c.confidence === 'low' || c.confidence === 'medium');
    const hasUncertainty = lowConfidenceChecks.length > 0;

    // 产品页特殊处理: 加购或购买至少一个可用
    if (pageType === PageType.ProductPage) {
      const addToCart = checks.find(c => c.name === '加购按钮');
      const buyNow = checks.find(c => c.name === '购买按钮');

      // 如果加购和购买都不可用,判定为失败
      if (addToCart && buyNow && !addToCart.passed && !buyNow.passed) {
        return {
          status: 'fail',
          message: '产品页缺少可用的购买功能'
        };
      }
    }

    // 根据通过率和置信度判定
    if (passRate === 100) {
      if (hasUncertainty) {
        return {
          status: 'pass',
          message: `所有检查项通过 (注意: ${lowConfidenceChecks.length} 项置信度较低)`
        };
      }
      return { status: 'pass', message: '所有检查项通过' };
    } else if (passRate >= 60) {
      const uncertaintyNote = hasUncertainty
        ? ` (${lowConfidenceChecks.length} 项结果不确定)`
        : '';
      return {
        status: 'warning',
        message: `部分检查项未通过 (${passedCount}/${totalCount})${uncertaintyNote}`
      };
    } else {
      // 如果大部分失败项都是低置信度,可能需要人工复查
      const failedChecks = checks.filter(c => !c.passed);
      const lowConfidenceFails = failedChecks.filter(c => c.confidence === 'low' || c.confidence === 'medium');

      if (lowConfidenceFails.length === failedChecks.length && lowConfidenceFails.length > 0) {
        return {
          status: 'warning',
          message: `多项检查失败 (${passedCount}/${totalCount}),但结果不确定,建议人工复查`
        };
      }

      return {
        status: 'fail',
        message: `多项检查失败 (${passedCount}/${totalCount})`
      };
    }
  }

  /**
   * 判断错误是否为基础设施错误(网络、超时等)
   */
  private isInfrastructureError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    // 超时错误
    if (errorMessage.includes('timeout') || errorMessage.includes('exceeded')) {
      return true;
    }

    // 网络连接错误
    if (errorMessage.includes('net::err') || errorMessage.includes('connection')) {
      return true;
    }

    // DNS 解析错误
    if (errorMessage.includes('dns') || errorMessage.includes('getaddrinfo')) {
      return true;
    }

    // SSL/TLS 证书错误
    if (errorMessage.includes('certificate') || errorMessage.includes('ssl')) {
      return true;
    }

    return false;
  }

  /**
   * 带重试机制的URL测试包装
   */
  private async testUrlWithRetry(
    page: Page,
    url: string,
    name: string,
    config: PatrolConfig,
    deviceConfig?: { type: 'desktop' | 'mobile' | 'tablet'; name: string; viewport: { width: number; height: number } }
  ): Promise<PatrolTestResult> {
    const retryConfig = config.retry || { enabled: false, maxAttempts: 3, retryDelay: 2000, retryOnInfraError: true };
    const maxAttempts = retryConfig.enabled ? (retryConfig.maxAttempts || 3) : 1;

    let lastError: Error | null = null;
    let lastResult: PatrolTestResult | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`  Attempt ${attempt}/${maxAttempts} for ${name}`);

        const result = await this.testUrl(page, url, name, config, deviceConfig);

        // 如果成功或者非基础设施错误失败,直接返回
        if (result.status === 'pass' || (result.status === 'fail' && !result.isInfrastructureError)) {
          if (attempt > 1) {
            console.log(`  ✓ ${name} succeeded on attempt ${attempt}`);
          }
          return result;
        }

        // 基础设施错误,检查是否需要重试
        if (result.isInfrastructureError && retryConfig.retryOnInfraError && attempt < maxAttempts) {
          console.warn(`  ⚠️  Infrastructure error on attempt ${attempt}, retrying...`);
          lastResult = result;
          await new Promise(resolve => setTimeout(resolve, retryConfig.retryDelay || 2000));
          continue;
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts) {
          console.error(`  ✗ Attempt ${attempt} failed:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, retryConfig.retryDelay || 2000));
        }
      }
    }

    // 所有重试都失败了
    console.error(`  ✗ All ${maxAttempts} attempts failed for ${name}`);

    if (lastResult) {
      return lastResult;
    }

    return {
      url,
      name,
      status: 'fail',
      errorMessage: `所有 ${maxAttempts} 次尝试都失败: ${lastError?.message || '未知错误'}`,
      testDuration: 0,
      isInfrastructureError: true,
    };
  }

  /**
   * 执行单个 URL 的巡检测试
   */
  private async testUrl(
    page: Page,
    url: string,
    name: string,
    config: PatrolConfig,
    deviceConfig?: { type: 'desktop' | 'mobile' | 'tablet'; name: string; viewport: { width: number; height: number } }
  ): Promise<PatrolTestResult> {
    const startTime = Date.now();

    try {
      // 设置设备视口(如果配置了)
      if (deviceConfig) {
        await page.setViewportSize(deviceConfig.viewport);
        console.log(`Testing URL: ${name} (${url}) on ${deviceConfig.name} (${deviceConfig.viewport.width}x${deviceConfig.viewport.height})`);
      } else {
        console.log(`Testing URL: ${name} (${url})`);
      }

      // 检测页面类型
      const pageType = this.detectPageType(url, name);
      console.log(`  Page type detected: ${pageType}`);

      // 访问页面 - 使用渐进式加载策略
      let response: any;
      try {
        // 优先尝试 networkidle (网络空闲)
        response = await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
      } catch (error) {
        // 如果 networkidle 超时,降级到 domcontentloaded
        console.warn(`  NetworkIdle timeout, falling back to domcontentloaded...`);
        try {
          response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
          });
          // 额外等待一段时间让页面继续加载
          await page.waitForTimeout(3000);
        } catch (fallbackError) {
          // 最后降级到 load 事件
          console.warn(`  DOMContentLoaded timeout, falling back to load...`);
          response = await page.goto(url, {
            waitUntil: 'load',
            timeout: 20000,
          });
          await page.waitForTimeout(2000);
        }
      }

      const statusCode = response?.status() || 0;
      const responseTime = Date.now() - startTime;

      // 检查响应状态
      if (!response || statusCode >= 400) {
        return {
          url,
          name,
          status: 'fail',
          statusCode,
          responseTime,
          errorMessage: `HTTP ${statusCode} - 页面访问失败`,
          testDuration: responseTime,
        };
      }

      // 等待页面稳定
      await page.waitForTimeout(2000);

      // 尝试关闭弹窗(在检查页面元素之前)
      await this.dismissCommonPopups(page);

      // 基本可用性检查
      const bodyExists = await page.evaluate(() => {
        return document.body !== null && document.body.children.length > 0;
      });

      if (!bodyExists) {
        return {
          url,
          name,
          status: 'fail',
          statusCode,
          responseTime,
          errorMessage: '页面内容为空',
          testDuration: Date.now() - startTime,
        };
      }

      // 根据页面类型执行对应检查
      let checks: CheckDetail[] = [];

      if (pageType === PageType.ProductPage) {
        console.log(`  Checking product page functions...`);
        checks = await this.checkProductPageFunctions(page);
      } else if (pageType === PageType.Homepage || pageType === PageType.LandingPage) {
        console.log(`  Checking page modules...`);
        checks = await this.checkHomepageModules(page);
      }

      // 评估检查结果
      const evaluation = this.evaluateChecks(pageType, checks);

      // 构建检查详情消息(包含置信度)
      const checkMessages = checks.map(c => {
        const icon = c.passed ? '✓' : '✗';
        const confidenceLabel = c.confidence
          ? ` [置信度: ${c.confidence === 'high' ? '高' : c.confidence === 'medium' ? '中' : '低'}]`
          : '';
        return `${icon} ${c.name}: ${c.message || ''}${confidenceLabel}`;
      }).join('\n');

      const finalStatus = evaluation.status === 'pass' ? 'pass' : 'fail';
      const detailedMessage = `页面类型: ${pageType}\n${evaluation.message}\n\n检查详情:\n${checkMessages}`;

      // 截图保存页面状态
      let screenshotUrl: string | undefined;
      try {
        console.log(`  Capturing screenshot...`);
        screenshotUrl = await screenshotService.captureFullPage(page);
        console.log(`  Screenshot saved: ${screenshotUrl}`);
      } catch (error) {
        console.error(`  Failed to capture screenshot:`, error);
      }

      // 视觉对比(如果启用)
      let visualDiff: any = undefined;
      if (config.visualComparison?.enabled && screenshotUrl) {
        try {
          console.log(`  Performing visual comparison...`);
          const deviceType = deviceConfig?.type || 'desktop';
          const screenshotPath = screenshotUrl.startsWith('/screenshots/')
            ? `/tmp${screenshotUrl}`
            : screenshotUrl;

          const diffResult = await imageCompareService.compareImages(
            screenshotPath,
            url,
            deviceType,
            {
              diffPercentageThreshold: config.visualComparison.diffThreshold || 5,
              saveBaseline: config.visualComparison.saveBaseline || false,
              generateDiffImage: true,
            }
          );

          if (diffResult.hasDifference) {
            console.warn(`  ⚠️  Visual difference detected: ${diffResult.diffPercentage}%`);
          }

          visualDiff = {
            hasDifference: diffResult.hasDifference,
            diffPercentage: diffResult.diffPercentage,
            diffImageUrl: diffResult.diffImagePath?.replace('/tmp/screenshots', '/screenshots'),
            baselineImageUrl: diffResult.previousImagePath?.replace('/tmp/screenshots', '/screenshots'),
          };
        } catch (error) {
          console.error(`  Failed to perform visual comparison:`, error);
        }
      }

      console.log(`${finalStatus === 'pass' ? '✓' : '✗'} ${name} ${evaluation.status} (${statusCode}) - ${responseTime}ms`);

      return {
        url,
        name,
        status: finalStatus,
        statusCode,
        responseTime,
        errorMessage: finalStatus === 'fail' ? detailedMessage : undefined,
        checkDetails: detailedMessage, // 始终包含检查详情
        screenshotUrl, // 截图URL
        testDuration: Date.now() - startTime,
        visualDiff, // 视觉对比结果
        deviceType: deviceConfig?.type,
        deviceName: deviceConfig?.name,
        viewport: deviceConfig?.viewport,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const isInfraError = error instanceof Error && this.isInfrastructureError(error);

      if (isInfraError) {
        console.warn(`⚠️  ${name} infrastructure error (no email):`, errorMessage);
      } else {
        console.error(`✗ ${name} failed:`, errorMessage);
      }

      // 尝试保存截图,即使检查失败
      let screenshotUrl: string | undefined;
      try {
        console.log(`  Capturing screenshot for failed test...`);
        screenshotUrl = await screenshotService.captureFullPage(page);
        console.log(`  Screenshot saved: ${screenshotUrl}`);
      } catch (screenshotError) {
        console.error(`  Failed to capture screenshot:`, screenshotError);
      }

      return {
        url,
        name,
        status: 'fail',
        responseTime,
        errorMessage: isInfraError ? `基础设施错误: ${errorMessage}` : errorMessage,
        screenshotUrl, // 包含截图URL(如果成功保存)
        testDuration: responseTime,
        isInfrastructureError: isInfraError,
      };
    }
  }

  /**
   * 在后台执行巡检测试
   */
  private async runPatrolTests(executionId: string, task: PatrolTask): Promise<void> {
    const startTime = Date.now();
    let browser: Browser | null = null;

    try {
      console.log(`Starting patrol execution for task: ${task.name}`);

      // 更新状态为运行中
      await this.executionRepository.updateStatus(executionId, PatrolExecutionStatus.Running);

      // 获取浏览器
      browser = await browserPool.acquire();

      // 解析配置
      const config: PatrolConfig = task.config || {};
      const devices = config.devices || []; // 默认无设备配置,使用桌面端

      // 测试所有 URL
      const testResults: PatrolTestResult[] = [];
      let passedUrls = 0;
      let failedUrls = 0;

      // 如果配置了多个设备,在每个设备上测试所有URL
      if (devices.length > 0) {
        for (const device of devices) {
          console.log(`\n=== Testing on ${device.name} (${device.viewport.width}x${device.viewport.height}) ===`);

          const context = await browser.newContext({
            viewport: device.viewport,
            userAgent: device.userAgent,
          });
          const page = await context.newPage();

          for (const urlConfig of task.urls) {
            const result = await this.testUrlWithRetry(
              page,
              urlConfig.url,
              urlConfig.name,
              config,
              device
            );
            testResults.push(result);

            if (result.status === 'pass') {
              passedUrls++;
            } else {
              failedUrls++;
            }
          }

          await context.close();
        }
      } else {
        // 默认桌面端测试
        const context = await browser.newContext();
        const page = await context.newPage();

        for (const urlConfig of task.urls) {
          const result = await this.testUrlWithRetry(
            page,
            urlConfig.url,
            urlConfig.name,
            config
          );
          testResults.push(result);

          if (result.status === 'pass') {
            passedUrls++;
          } else {
            failedUrls++;
          }
        }

        await context.close();
      }

      const durationMs = Date.now() - startTime;

      // 更新执行记录
      await this.executionRepository.complete(
        executionId,
        passedUrls,
        failedUrls,
        testResults,
        durationMs
      );

      console.log(
        `✓ Patrol execution completed: ${passedUrls} passed, ${failedUrls} failed in ${durationMs}ms`
      );

      // 发送邮件通知
      // 只有当存在真正的页面内容问题时才发送邮件（排除基础设施错误)
      const hasContentIssues = testResults.some(
        result => result.status === 'fail' && !result.isInfrastructureError
      );

      if (task.notificationEmails.length > 0 && hasContentIssues) {
        try {
          console.log(`Sending email notification to ${task.notificationEmails.length} recipient(s)...`);
          await patrolEmailService.sendPatrolReport(executionId);
          console.log(`✓ Email notification sent successfully`);
        } catch (emailError) {
          console.error(`Failed to send email notification:`, emailError);
          // 邮件发送失败不影响巡检任务的完成
        }
      } else if (task.notificationEmails.length > 0 && !hasContentIssues && failedUrls > 0) {
        console.log(`⚠️  All failures are infrastructure errors - email notification skipped`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`Patrol execution failed:`, errorMessage);

      // 更新状态为失败
      await this.executionRepository.updateStatus(
        executionId,
        PatrolExecutionStatus.Failed,
        errorMessage
      );
    } finally {
      // 释放浏览器
      if (browser) {
        await browserPool.release(browser);
      }
    }
  }

  /**
   * 执行巡检任务 - 立即返回executionId,测试在后台异步执行
   */
  async executePatrol(taskId: string): Promise<string> {
    // 获取巡检任务
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error(`Patrol task ${taskId} not found`);
    }

    if (!task.enabled) {
      throw new Error(`Patrol task ${taskId} is disabled`);
    }

    // 创建执行记录
    const execution = await this.executionRepository.create({
      patrolTaskId: taskId,
      status: PatrolExecutionStatus.Pending,
      startedAt: new Date(),
      totalUrls: task.urls.length,
      passedUrls: 0,
      failedUrls: 0,
      testResults: [],
      emailSent: false,
    });

    // 在后台异步执行测试
    this.runPatrolTests(execution.id, task).catch((error) => {
      console.error(`Background patrol test execution failed:`, error);
    });

    // 立即返回executionId
    return execution.id;
  }

  /**
   * 获取巡检任务列表
   */
  async getPatrolTasks(enabledOnly: boolean = false): Promise<PatrolTask[]> {
    return this.taskRepository.findAll(enabledOnly);
  }

  /**
   * 获取巡检任务详情
   */
  async getPatrolTask(taskId: string): Promise<PatrolTask | null> {
    return this.taskRepository.findById(taskId);
  }

  /**
   * 创建巡检任务
   */
  async createPatrolTask(
    task: Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PatrolTask> {
    return this.taskRepository.create(task);
  }

  /**
   * 更新巡检任务
   */
  async updatePatrolTask(
    taskId: string,
    updates: Partial<Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<PatrolTask | null> {
    return this.taskRepository.update(taskId, updates);
  }

  /**
   * 删除巡检任务
   */
  async deletePatrolTask(taskId: string): Promise<boolean> {
    return this.taskRepository.delete(taskId);
  }

  /**
   * 获取执行历史
   */
  async getExecutionHistory(taskId?: string, limit: number = 50) {
    if (taskId) {
      return this.executionRepository.findByTaskId(taskId, limit);
    }
    return this.executionRepository.findAll(limit);
  }

  /**
   * 获取执行详情
   */
  async getExecutionDetail(executionId: string) {
    return this.executionRepository.findById(executionId);
  }
}

export const patrolService = new PatrolService();
