import { Browser, Page, BrowserContext } from 'playwright';
import browserPool from '../automation/BrowserPool.js';
import { PatrolTaskRepository } from '../database/repositories/PatrolTaskRepository.js';
import { PatrolExecutionRepository } from '../database/repositories/PatrolExecutionRepository.js';
import { BitablePatrolTaskRepository } from '../models/repositories/BitablePatrolTaskRepository.js';
import { BitablePatrolExecutionRepository } from '../models/repositories/BitablePatrolExecutionRepository.js';
import { PatrolExecutionStatus, PatrolTestResult, PatrolTask, PatrolConfig } from '../models/entities.js';
import screenshotService from '../automation/ScreenshotService.js';
import { patrolEmailService } from './PatrolEmailService.js';
import { imageCompareService } from '../automation/ImageCompareService.js';

// 根据环境变量选择数据存储方式
const DATABASE_STORAGE = process.env.DATABASE_STORAGE || 'postgres';

// 页面类型枚举
// Updated: Removed TypeScript type annotations from page.evaluate() functions
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
  private taskRepository: PatrolTaskRepository | BitablePatrolTaskRepository;
  private executionRepository: PatrolExecutionRepository | BitablePatrolExecutionRepository;

  constructor() {
    if (DATABASE_STORAGE === 'bitable') {
      console.log('[PatrolService] Using Bitable storage');
      this.taskRepository = new BitablePatrolTaskRepository();
      this.executionRepository = new BitablePatrolExecutionRepository();
    } else {
      console.log('[PatrolService] Using PostgreSQL storage');
      this.taskRepository = new PatrolTaskRepository();
      this.executionRepository = new PatrolExecutionRepository();
    }
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
  private async checkHomepageModules(page: Page, config?: PatrolConfig): Promise<CheckDetail[]> {
    const checks: CheckDetail[] = [];

    // 获取检查配置(使用默认值)
    const homepageConfig = config?.pageChecks?.homepage || {};
    const footerConfig = config?.pageChecks?.footer || {};
    const requireNavigation = homepageConfig.requireNavigation !== false; // 默认true
    const requireBanner = homepageConfig.requireBanner !== false; // 默认true
    const requireFooter = homepageConfig.requireFooter !== false; // 默认true
    const minContentModules = homepageConfig.minContentModules ?? 3; // 默认3

    // 页脚功能要求
    const requireFooterLinks = footerConfig.requireLinks !== false; // 默认true
    const requireFooterSocial = footerConfig.requireSocial === true; // 默认false
    // 修复: 支持两种配置路径 - 新路径(直接在config下)和旧路径(在pageChecks.footer下)
    const requireFooterNewsletter = config?.requireFooterNewsletter === true || footerConfig.requireNewsletter === true; // 默认false
    const requireFooterCopyright = footerConfig.requireCopyright !== false; // 默认true

    try {
      // 1. 导航栏检查 - 简化为只检查导航栏是否存在和展示正常
      const navigationResult = await page.evaluate(() => {
        const selectors = [
          'nav[class*="nav"]',
          'header nav',
          '[class*="navigation"]',
          '[class*="header"] nav',
          'nav'
        ];

        // 排除侧边栏购物车等非主导航元素
        const excludeTexts = ['my cart', 'cart', 'shopping cart'];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const text = (el.textContent || '').toLowerCase();

            // 排除侧边栏购物车
            const isExcluded = excludeTexts.some(ex => text.includes(ex) && text.length < 50);
            if (isExcluded) continue;

            // 检查元素是否在视口顶部且可见
            const isAtTop = rect.top < 200;
            const isVisible = style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            style.opacity !== '0';
            const hasSize = rect.width > 200 && rect.height > 20; // 导航栏应该较宽

            // 简化检测逻辑: 只要导航栏存在、可见、尺寸合理、在顶部即可
            if (isVisible && hasSize && isAtTop) {
              // 检查是否有导航功能特征(可选)
              const hasSearch = el.querySelector('input[type="search"], [class*="search"]') !== null;
              const hasCart = el.querySelector('[class*="cart"], [class*="Cart"]') !== null;
              const hasDropdown = el.querySelector('[class*="dropdown"], [class*="menu"]') !== null;

              // 统计链接数量(仅用于显示,不影响判断)
              const allLinks = el.querySelectorAll('a');

              return {
                found: true,
                confidence: 'high',
                totalLinkCount: allLinks.length,
                hasSearch,
                hasCart,
                hasDropdown,
                position: `${Math.round(rect.top)}px from top`
              };
            }
          }
        }
        return {
          found: false,
          confidence: 'low',
          totalLinkCount: 0,
          hasSearch: false,
          hasCart: false,
          hasDropdown: false
        };
      });

      const navFeatures = [];
      if (navigationResult.hasSearch) navFeatures.push('搜索');
      if (navigationResult.hasCart) navFeatures.push('购物车');
      if (navigationResult.hasDropdown) navFeatures.push('下拉菜单');
      const featuresText = navFeatures.length > 0 ? `, 包含${navFeatures.join('、')}` : '';

      // 导航栏检查通过条件: 找到导航栏结构即可
      const navPassed = navigationResult.found;

      checks.push({
        name: '导航栏',
        passed: navPassed,
        confidence: navigationResult.confidence as 'high' | 'medium' | 'low',
        message: navigationResult.found
          ? `导航栏展示正常${featuresText}`
          : `未找到导航栏`
      });

      // 2. 主Banner/首屏内容检查 - 简化为只检查是否存在和展示正常
      const bannerResult = await page.evaluate(() => {
        const selectors = [
          '.banner',
          '.hero',
          '.main-banner',
          '[class*="banner"]',
          '[class*="hero"]',
          '[class*="Banner"]',
          '[class*="Hero"]',
          'section:first-of-type',
          'main > div:first-child',
          'main > section:first-child'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const banner of elements) {
            const rect = banner.getBoundingClientRect();
            const style = window.getComputedStyle(banner);
            const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

            // 降低尺寸要求: 宽度>300, 高度>40 (支持较矮的促销banner)
            const hasSize = rect.width > 300 && rect.height > 40;

            // 检查是否在页面上半部分(前1000px内)
            const isNearTop = rect.top < 1000;

            // 简化检测逻辑: 只要banner存在、可见、尺寸合理、在首屏即可
            if (isVisible && hasSize && isNearTop) {
              // 检查可选特征(用于显示,不影响判断)
              const ctas = banner.querySelectorAll('button, a[class*="button"], a[class*="btn"], a[class*="cta"], a[class*="Button"], a[class*="Btn"]');
              const hasCTA = ctas.length > 0;
              const hasHeading = banner.querySelector('h1, h2, h3, [class*="title"], [class*="heading"], [class*="Title"], [class*="Heading"]') !== null;
              const hasImage = banner.querySelector('img') !== null || style.backgroundImage !== 'none';

              return {
                found: true,
                hasCTA,
                hasHeading,
                hasImage,
                ctaCount: ctas.length,
                position: `${Math.round(rect.top)}px from top`
              };
            }
          }
        }
        return { found: false, hasCTA: false, hasHeading: false, hasImage: false, ctaCount: 0 };
      });

      // 如果配置为不要求Banner,则跳过检查
      if (!requireBanner) {
        if (bannerResult.found) {
          checks.push({
            name: '主Banner',
            passed: true,
            confidence: 'high',
            message: `Banner已忽略检查`
          });
        }
      } else {
        // Banner只要找到就算通过
        const bannerPassed = bannerResult.found;

        checks.push({
          name: '主Banner',
          passed: bannerPassed,
          confidence: bannerResult.found ? 'high' : 'low',
          message: bannerResult.found
            ? `Banner展示正常`
            : '未找到Banner'
        });
      }

      // 3. 主要内容区检查 - 增强等待和重试逻辑,处理慢加载
      console.log('  Waiting for content modules to load...');

      // 先等待主内容区域加载
      await page.waitForSelector('main, #main, [role="main"], .main-content', {
        timeout: 5000
      }).catch(() => console.log('    Main content area not found'));

      // 额外等待以确保动态内容加载完成
      await page.waitForTimeout(3000);

      // 尝试滚动页面触发懒加载
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(2000);

      const contentSections = await page.$$eval(
        'main section, .content-section, [class*="section"], main > div, [class*="module"]',
        function(elements) {
          return elements.filter(function(el) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
            const hasContent = el.textContent && el.textContent.trim().length > 50;
            return isVisible && rect.width > 100 && rect.height > 100 && hasContent;
          }).length;
        }
      );

      // 简化检测逻辑: 只要找到至少1个内容模块就算通过
      const contentPassed = contentSections > 0;

      checks.push({
        name: '内容模块',
        passed: contentPassed,
        confidence: contentPassed ? 'high' : 'low',
        message: contentPassed
          ? `内容模块展示正常`
          : '未找到内容模块'
      });

      // 4. 页脚检查 - 简化为只检查元素展示和订阅功能
      const footerResult = await page.evaluate(() => {
        const selectors = ['footer', '.footer', '[class*="footer"]'];

        // 遍历所有可能的页脚元素
        for (const selector of selectors) {
          const footers = document.querySelectorAll(selector);

          for (const footer of footers) {
            const rect = footer.getBoundingClientRect();
            const style = window.getComputedStyle(footer);
            const isVisible = style.display !== 'none' && style.visibility !== 'hidden';

            // 只要元素可见且有合理的高度即可
            if (isVisible && rect.height > 50) {
              // 检查订阅功能 - 先在footer内部查找
              const emailInputs = Array.from(footer.querySelectorAll('input')).filter(function(input) {
                const type = input.getAttribute('type');
                const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
                const nameAttr = input.getAttribute('name');
                const name = (nameAttr && nameAttr !== 'null') ? nameAttr.toLowerCase() : '';
                const className = input.className.toLowerCase();
                return type === 'email' ||
                       placeholder.includes('email') ||
                       placeholder.includes('subscribe') ||
                       name.includes('email') ||
                       name.includes('subscribe') ||
                       className.includes('email') ||
                       className.includes('subscribe') ||
                       className.includes('newsletter');
              });
              const buttons = Array.from(footer.querySelectorAll('button, input[type="submit"]')).filter(function(btn) {
                const text = (btn.textContent || '').toLowerCase();
                const className = btn.className.toLowerCase();
                return text.includes('subscribe') ||
                       text.includes('sign up') ||
                       text.includes('submit') ||
                       className.includes('subscribe') ||
                       className.includes('newsletter');
              });

              const hasNewsletter = emailInputs.length > 0;
              const hasNewsletterButton = buttons.length > 0;

              // 如果footer内部找到了订阅功能,直接返回
              if (hasNewsletter || hasNewsletterButton) {
                return {
                  found: true,
                  hasNewsletter,
                  hasNewsletterButton
                };
              }

              // 如果footer内部没找到,尝试全局搜索页面底部的订阅功能
              // 某些网站的订阅框可能不在footer元素内部(如弹出框、固定定位等)
              const allEmailInputs = Array.from(document.querySelectorAll('input')).filter(function(input) {
                const type = input.getAttribute('type');
                const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
                const nameAttr = input.getAttribute('name');
                const name = (nameAttr && nameAttr !== 'null') ? nameAttr.toLowerCase() : '';
                const className = input.className.toLowerCase();
                return type === 'email' ||
                       placeholder.includes('email') ||
                       placeholder.includes('subscribe') ||
                       name.includes('email') ||
                       name.includes('subscribe') ||
                       className.includes('email') ||
                       className.includes('subscribe') ||
                       className.includes('newsletter');
              });
              const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"]')).filter(function(btn) {
                const text = (btn.textContent || '').toLowerCase();
                const className = btn.className.toLowerCase();
                return text.includes('subscribe') ||
                       text.includes('sign up') ||
                       text.includes('submit') ||
                       className.includes('subscribe') ||
                       className.includes('newsletter');
              });

              // 只统计可见的元素
              const visibleEmailInputs = allEmailInputs.filter(function(input) { return input.offsetParent !== null; });
              const visibleButtons = allButtons.filter(function(btn) { return btn.offsetParent !== null; });

              return {
                found: true,
                hasNewsletter: visibleEmailInputs.length > 0,
                hasNewsletterButton: visibleButtons.length > 0
              };
            }
          }
        }
        return {
          found: false,
          hasNewsletter: false,
          hasNewsletterButton: false
        };
      });

      // 如果配置为不要求页脚,则跳过检查
      if (!requireFooter) {
        if (footerResult.found) {
          checks.push({
            name: '页脚',
            passed: true,
            confidence: 'high',
            message: `页脚已忽略检查`
          });
        }
      } else {
        // 页脚检查: 简化为只检查元素是否展示正常
        const footerPassed = footerResult.found;

        checks.push({
          name: '页脚',
          passed: footerPassed,
          confidence: footerResult.found ? 'high' : 'medium',
          message: footerResult.found
            ? `页脚展示正常`
            : '未找到页脚'
        });

        // 检查2: 订阅功能(如果配置要求)
        if (requireFooterNewsletter) {
          const newsletterPassed = footerResult.hasNewsletter && footerResult.hasNewsletterButton;
          const components = [];
          if (footerResult.hasNewsletter) components.push('邮箱输入框');
          if (footerResult.hasNewsletterButton) components.push('提交按钮');

          checks.push({
            name: '页脚订阅',
            passed: newsletterPassed,
            confidence: newsletterPassed ? 'high' : 'medium',
            message: footerResult.found
              ? newsletterPassed
                ? `订阅功能展示正常 (含${components.join('、')})`
                : components.length > 0
                  ? `订阅功能不完整 (仅含${components.join('、')})`
                  : '未找到订阅功能'
              : '未找到页脚,无法检测订阅功能'
          });
        }
      }

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
        function(el) { return el.textContent?.trim(); }
      ).catch(function() { return null; });

      checks.push({
        name: '产品标题',
        passed: !!productTitle,
        message: productTitle ? `标题: ${productTitle.substring(0, 50)}` : '未找到产品标题'
      });

      // 2. 产品图片检查
      const productImage = await page.$eval(
        'img[class*="product"], .product-image img, [class*="productImage"] img, main img',
        function(img) { return img.complete && img.naturalHeight > 0; }
      ).catch(function() { return false; });

      checks.push({
        name: '产品图片',
        passed: productImage,
        message: productImage ? '产品图片已加载' : '产品图片加载失败或不存在'
      });

      // 3. 价格信息检查 - 改进的价格提取逻辑
      let priceInfo = null;
      let priceConfidence: 'high' | 'medium' | 'low' = 'high';

      // 首先尝试从JSON-LD schema中提取价格(最准确)
      try {
        const schemaPrice = await page.evaluate(() => {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          for (const script of scripts) {
            try {
              const data = JSON.parse(script.textContent || '');
              if (data['@type'] === 'Product' && data.offers) {
                const offers = Array.isArray(data.offers) ? data.offers[0] : data.offers;
                const price = offers?.price;
                const currency = offers?.priceCurrency || 'USD';

                if (price) {
                  const numPrice = typeof price === 'number' ? price : parseFloat(price);
                  if (!isNaN(numPrice) && numPrice > 0) {
                    const symbol = currency === 'USD' ? '$' : currency;
                    return {
                      price: `${symbol}${numPrice.toFixed(2)}`,
                      confidence: 'high'
                    };
                  }
                }
              }
            } catch (e) {
              // 继续尝试下一个script
            }
          }
          return null;
        });
        if (schemaPrice) {
          priceInfo = schemaPrice.price;
          priceConfidence = 'high';
        }
      } catch {}

      // 如果JSON-LD失败,尝试更精确的DOM选择器策略
      if (!priceInfo) {
        const priceResult = await page.evaluate(() => {
          // 辅助函数: 提取价格数值 - 使用 function 声明避免 __name 问题
          function extractPrice(text) {
            // 优先匹配 $数字.数字 格式
            let match = text.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
            if (match) {
              const priceStr = match[1].replace(/,/g, '');
              const priceNum = parseFloat(priceStr);
              if (!isNaN(priceNum) && priceNum > 0 && priceNum < 100000) {
                return priceNum;
              }
            }

            // 匹配纯数字价格 (如 129.99)
            match = text.match(/\b(\d+(?:,\d{3})*\.\d{2})\b/);
            if (match) {
              const priceStr = match[1].replace(/,/g, '');
              const priceNum = parseFloat(priceStr);
              if (!isNaN(priceNum) && priceNum > 0 && priceNum < 100000) {
                return priceNum;
              }
            }

            return null;
          }

          // 策略1: 查找明确标记为"当前价格"的元素(仅在页面顶部2000px内)
          const priceSelectors = [
            // 优先级最高: 明确标记的价格
            '[data-price-type="current"]',
            '[class*="currentPrice"]',
            '[class*="current-price"]',
            '[class*="sale-price"]',
            '[class*="salePrice"]',

            // 次优先: 包含price但排除old/original/was等
            'span[class*="price"]:not([class*="old"]):not([class*="original"]):not([class*="was"])',
            'div[class*="price"]:not([class*="old"]):not([class*="original"]):not([class*="was"])',

            // 最后: 通用price类
            '[itemprop="price"]',
            '.price:not(.old-price):not(.was-price)',
            '[class*="Price"]:not([class*="Old"]):not([class*="Was"])'
          ];

          for (const selector of priceSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              const rect = el.getBoundingClientRect();

              // 只检查页面顶部2000px内的元素(主产品信息区域)
              if (rect.top >= 2000) continue;

              const text = el.textContent?.trim() || '';
              const classList = el.className.toLowerCase();

              // 跳过明确标记为旧价格的元素
              if (classList.includes('old') || classList.includes('was') ||
                  classList.includes('original') || classList.includes('compare')) {
                continue;
              }

              const priceNum = extractPrice(text);
              if (priceNum) {
                return {
                  price: `$${priceNum.toFixed(2)}`,
                  confidence: selector.includes('current') || selector.includes('sale') ? 'high' : 'medium'
                };
              }
            }
          }

          // 策略2(降级): 如果选择器策略失败,在主内容区域搜索价格模式
          // 适用于Tailwind CSS等不使用语义化class名的网站
          const mainContainers = [
            document.querySelector('main'),
            document.querySelector('[class*="product-info"]'),
            document.querySelector('[class*="productInfo"]'),
            document.querySelector('[class*="product-detail"]'),
            document.querySelector('[role="main"]'),
          ].filter(function(el) { return el; });

          // 收集所有候选价格,按字体大小排序
          const candidates = [];

          for (const container of mainContainers) {
            // 查找所有包含价格模式的span和div元素
            const allElements = container.querySelectorAll('span, div');

            for (const el of allElements) {
              const rect = el.getBoundingClientRect();

              // 只检查页面顶部2000px内的元素
              if (rect.top >= 2000) continue;

              const text = el.textContent?.trim() || '';

              // 文本长度合理(避免匹配到大容器)
              if (text.length > 50) continue;

              // 排除明确的折扣/促销文案
              const lowerText = text.toLowerCase();
              if (lowerText.includes('save') || lowerText.includes('off') ||
                  lowerText.includes('discount') || lowerText.includes('deal')) {
                continue;
              }

              const priceNum = extractPrice(text);
              if (priceNum) {
                // 检查字体大小(主产品价格通常字体较大)
                const style = window.getComputedStyle(el);
                const fontSize = parseFloat(style.fontSize);

                candidates.push({
                  price: priceNum,
                  fontSize,
                  top: rect.top,
                  confidence: fontSize >= 20 ? 'medium' : 'low'
                });
              }
            }
          }

          // 按字体大小降序排序,选择字体最大的价格
          if (candidates.length > 0) {
            candidates.sort(function(a, b) { return b.fontSize - a.fontSize; });
            const best = candidates[0];
            return {
              price: `$${best.price.toFixed(2)}`,
              confidence: best.confidence
            };
          }

          return null;
        });

        if (priceResult) {
          priceInfo = priceResult.price;
          priceConfidence = priceResult.confidence as 'high' | 'medium' | 'low';
        }
      }

      checks.push({
        name: '价格信息',
        passed: !!priceInfo && priceInfo !== '$0.00' && priceInfo !== '$0',
        confidence: priceConfidence,
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
        checks = await this.checkHomepageModules(page, config);
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
      let screenshotBase64: string | undefined;
      try {
        console.log(`  Capturing screenshot...`);
        screenshotUrl = await screenshotService.captureFullPage(page);
        console.log(`  Screenshot saved: ${screenshotUrl}`);

        // 同时生成 base64 格式用于 Bitable 存储
        try {
          screenshotBase64 = await screenshotService.captureFullPageBase64(page);
          console.log(`  Screenshot base64 captured`);
        } catch (base64Error) {
          console.error(`  Failed to capture base64 screenshot:`, base64Error);
        }
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
        screenshotBase64, // Base64 截图(用于 Bitable)
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
      let screenshotBase64: string | undefined;
      try {
        console.log(`  Capturing screenshot for failed test...`);
        screenshotUrl = await screenshotService.captureFullPage(page);
        console.log(`  Screenshot saved: ${screenshotUrl}`);

        // 同时生成 base64 格式用于 Bitable 存储
        try {
          screenshotBase64 = await screenshotService.captureFullPageBase64(page);
          console.log(`  Screenshot base64 captured`);
        } catch (base64Error) {
          console.error(`  Failed to capture base64 screenshot:`, base64Error);
        }
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
        screenshotBase64, // Base64 截图(用于 Bitable)
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
