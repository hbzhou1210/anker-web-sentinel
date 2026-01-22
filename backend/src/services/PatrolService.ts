import { Browser, Page, BrowserContext } from 'playwright';
import pLimit from 'p-limit';
import browserPool from '../automation/BrowserPool.js';
import { IPatrolTaskRepository, IPatrolExecutionRepository } from '../models/interfaces/index.js';
import { BitablePatrolTaskRepository } from '../models/repositories/BitablePatrolTaskRepository.js';
import { BitablePatrolExecutionRepository } from '../models/repositories/BitablePatrolExecutionRepository.js';
import { PatrolExecutionStatus, PatrolTestResult, PatrolTask, PatrolConfig } from '../models/entities.js';
import screenshotService from '../automation/ScreenshotService.js';
import { patrolEmailService } from './PatrolEmailService.js';
import { imageCompareService } from '../automation/ImageCompareService.js';
import { EventEmitter, PatrolEventType } from '../events/index.js';
import { configService } from '../config/index.js';
import { recordPatrolExecution, metrics } from '../monitoring/metrics.js';
import { SEOCheckerService, SEOReport } from './SEOCheckerService.js';

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

/**
 * 计算SEO评分 (0-100分)
 *
 * 评分规则:
 * - 基础分: 60分
 * - 标题存在: +10分
 * - Hreflang链接: 每个有效链接 +2分 (最多20分)
 * - 缺少x-default: -10分
 * - 重复语言代码: 每个重复 -5分
 * - 无效Hreflang URL: 每个 -3分
 * - Article信息: author +5分, publishedTime +5分, modifiedTime +5分
 * - 语言代码不一致: 每个 -3分
 */
function calculateSEOScore(seoReport: SEOReport): number {
  let score = 60; // 基础分

  // 标题检查
  if (seoReport.title && seoReport.title.trim().length > 0) {
    score += 10;
  }

  // Hreflang链接评分 (每个有效链接+2分,最多20分)
  const validHreflangCount = seoReport.hreflangLinks.filter(link => link.isValid).length;
  score += Math.min(validHreflangCount * 2, 20);

  // Hreflang问题扣分
  if (seoReport.hreflangIssues) {
    // 缺少x-default
    const hasXDefault = seoReport.hreflangLinks.some(link => link.lang === 'x-default');
    if (!hasXDefault && seoReport.hreflangLinks.length > 0) {
      score -= 10;
    }

    // 重复语言代码
    if (seoReport.hreflangIssues.hasDuplicates) {
      score -= seoReport.hreflangIssues.duplicates.length * 5;
    }

    // 语言代码不一致
    if (seoReport.hreflangIssues.inconsistentCount > 0) {
      score -= seoReport.hreflangIssues.inconsistentCount * 3;
    }
  }

  // 无效URL扣分
  const invalidUrlCount = seoReport.hreflangLinks.filter(link => !link.isValid).length;
  score -= invalidUrlCount * 3;

  // Article信息加分
  if (seoReport.article) {
    if (seoReport.article.author) score += 5;
    if (seoReport.article.datePublished) score += 5;
    if (seoReport.article.dateModified) score += 5;
  }

  // 确保分数在0-100范围内
  return Math.max(0, Math.min(100, score));
}

export class PatrolService {
  private taskRepository: IPatrolTaskRepository;
  private executionRepository: IPatrolExecutionRepository;
  private eventEmitter: EventEmitter;
  private seoCheckerService: SEOCheckerService;
  // 并发控制:同时测试的最大 URL 数量(从配置服务获取)
  private readonly MAX_CONCURRENT_URLS: number;

  constructor(
    taskRepository?: IPatrolTaskRepository,
    executionRepository?: IPatrolExecutionRepository,
    eventEmitter?: EventEmitter
  ) {
    // 依赖注入:允许传入自定义实现,默认使用 Bitable
    this.taskRepository = taskRepository || new BitablePatrolTaskRepository();
    this.executionRepository = executionRepository || new BitablePatrolExecutionRepository();
    this.eventEmitter = eventEmitter || new EventEmitter();
    this.seoCheckerService = new SEOCheckerService();

    // 从配置服务获取巡检配置
    const patrolConfig = configService.getPatrolConfig();
    this.MAX_CONCURRENT_URLS = patrolConfig.maxConcurrentUrls;

    console.log(`[PatrolService] Using ${configService.getDatabaseConfig().storage} storage`);
    console.log(`[PatrolService] Max concurrent URL tests: ${this.MAX_CONCURRENT_URLS}`);
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
      // 1. 导航栏检查 - 优先检查导航栏容器，如果没找到再检查 go home 元素
      const navigationResult = await page.evaluate(function() {
        // 第一步: 优先使用标准导航栏选择器检测
        const selectors = [
          'nav[class*="nav"]',
          'header nav',
          '[class*="navigation"]',
          '[class*="header"] nav',
          'nav',
          '[id*="header"]'
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
                hasGoHome: false,
                position: `${Math.round(rect.top)}px from top`
              };
            }
          }
        }

        // 第二步: 如果没找到导航栏容器，检查是否存在 aria-label='go home' 元素
        const goHomeElement = document.querySelector('[aria-label="go home"]');
        if (goHomeElement) {
          const rect = goHomeElement.getBoundingClientRect();
          const style = window.getComputedStyle(goHomeElement);
          const isVisible = style.display !== 'none' &&
                          style.visibility !== 'hidden' &&
                          style.opacity !== '0';

          if (isVisible && rect.width > 0 && rect.height > 0) {
            // 找到 go home 元素，尝试查找其所在的导航栏容器
            let navContainer = goHomeElement.closest('nav, header, [class*="nav"], [class*="header"],[id*="header"]');

            if (navContainer) {
              const navRect = navContainer.getBoundingClientRect();
              const navStyle = window.getComputedStyle(navContainer);
              const isNavVisible = navStyle.display !== 'none' &&
                                  navStyle.visibility !== 'hidden' &&
                                  navStyle.opacity !== '0';

              if (isNavVisible) {
                // 检查导航栏的功能特征
                const hasSearch = navContainer.querySelector('input[type="search"], [class*="search"]') !== null;
                const hasCart = navContainer.querySelector('[class*="cart"], [class*="Cart"]') !== null;
                const hasDropdown = navContainer.querySelector('[class*="dropdown"], [class*="menu"]') !== null;
                const allLinks = navContainer.querySelectorAll('a');

                return {
                  found: true,
                  confidence: 'high',
                  totalLinkCount: allLinks.length,
                  hasSearch,
                  hasCart,
                  hasDropdown,
                  hasGoHome: true,
                  position: `${Math.round(navRect.top)}px from top`
                };
              }
            }

            // go home 元素存在但没找到导航栏容器，仍然判断为找到导航栏
            return {
              found: true,
              confidence: 'medium',
              totalLinkCount: 0,
              hasSearch: false,
              hasCart: false,
              hasDropdown: false,
              hasGoHome: true,
              position: `${Math.round(rect.top)}px from top`
            };
          }
        }

        // 第三步: 都没找到，返回失败
        return {
          found: false,
          confidence: 'low',
          totalLinkCount: 0,
          hasSearch: false,
          hasCart: false,
          hasDropdown: false,
          hasGoHome: false
        };
      });

      const navFeatures = [];
      if (navigationResult.hasGoHome) navFeatures.push('Go Home按钮');
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
      const bannerResult = await page.evaluate(function() {
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
      await page.evaluate(function() {
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
      const footerResult = await page.evaluate(function() {
        const selectors = ['footer', '.footer', '[class*="footer"]','input[type="email"]'];

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

              // 改进的按钮检测 - 支持 role="button" 的元素(如 Anker Solix)
              const buttons = Array.from(footer.querySelectorAll('button, input[type="submit"], [role="button"]')).filter(function(btn) {
                const text = (btn.textContent || '').toLowerCase();
                const className = btn.className.toLowerCase();
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

                // 检查是否在邮箱输入框附近(布局检测)
                let isNearEmailInput = false;
                const btnRect = btn.getBoundingClientRect();
                for (let i = 0; i < emailInputs.length; i++) {
                  const input = emailInputs[i];
                  const inputRect = input.getBoundingClientRect();
                  // 检查按钮是否在输入框右侧50px内,或者垂直距离在100px内
                  const horizontalDistance = Math.abs(btnRect.left - inputRect.right);
                  const verticalDistance = Math.abs(btnRect.top - inputRect.top);
                  if (horizontalDistance < 50 || verticalDistance < 100) {
                    isNearEmailInput = true;
                    break;
                  }
                }

                // 文本/类名匹配 或 在邮箱输入框附近
                const hasSubscribeKeyword = text.includes('subscribe') ||
                       text.includes('sign up') ||
                       text.includes('submit') ||
                       text.includes('join') ||
                       ariaLabel.includes('subscribe') ||
                       ariaLabel.includes('submit') ||
                       className.includes('subscribe') ||
                       className.includes('newsletter');

                return hasSubscribeKeyword || isNearEmailInput;
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
              // 改进的按钮检测 - 支持 role="button" 的元素
              const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]')).filter(function(btn) {
                const text = (btn.textContent || '').toLowerCase();
                const className = btn.className.toLowerCase();
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

                // 检查是否在邮箱输入框附近(布局检测)
                let isNearEmailInput = false;
                const btnRect = btn.getBoundingClientRect();
                for (let i = 0; i < allEmailInputs.length; i++) {
                  const input = allEmailInputs[i];
                  const inputRect = input.getBoundingClientRect();
                  // 检查按钮是否在输入框右侧50px内,或者垂直距离在100px内
                  const horizontalDistance = Math.abs(btnRect.left - inputRect.right);
                  const verticalDistance = Math.abs(btnRect.top - inputRect.top);
                  if (horizontalDistance < 50 || verticalDistance < 100) {
                    isNearEmailInput = true;
                    break;
                  }
                }

                // 文本/类名匹配 或 在邮箱输入框附近
                const hasSubscribeKeyword = text.includes('subscribe') ||
                       text.includes('sign up') ||
                       text.includes('submit') ||
                       text.includes('join') ||
                       ariaLabel.includes('subscribe') ||
                       ariaLabel.includes('submit') ||
                       className.includes('subscribe') ||
                       className.includes('newsletter');

                return hasSubscribeKeyword || isNearEmailInput;
              });

              // 只统计可见的元素
              const visibleEmailInputs = allEmailInputs.filter(function(input) {
                return (input as HTMLElement).offsetParent !== null;
              });
              const visibleButtons = allButtons.filter(function(btn) {
                return (btn as HTMLElement).offsetParent !== null;
              });

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
        function(img: any) {
          return !!(img.complete && img.naturalHeight > 0);
        }
      ).catch(function() { return false; });

      checks.push({
        name: '产品图片',
        passed: productImage,
        message: productImage ? '产品图片已加载' : '产品图片加载失败或不存在'
      });

      // 3. 价格信息检查 - 改进的价格提取逻辑
      let priceInfo = null;
      let priceConfidence: 'high' | 'medium' | 'low' = 'high';

      // 策略0: 如果找到了产品标题,优先在标题附近查找价格(最准确)
      if (productTitle) {
        try {
          const titleNearbyPrice = await page.evaluate(() => {
            // 找到产品标题元素
            const titleSelectors = ['h1', '.product-title', '[class*="product-title"]', '[class*="productTitle"]'];
            let titleElement = null;

            for (const selector of titleSelectors) {
              titleElement = document.querySelector(selector);
              if (titleElement) break;
            }

            if (!titleElement) return null;

            // 查找标题元素的父容器
            let container = titleElement.parentElement;
            let searchDepth = 0;

            // 向上找最多3层,找到产品信息容器
            while (container && searchDepth < 3) {
              const className = container.className?.toLowerCase() || '';
              if (className.includes('product') || className.includes('item') ||
                  container.tagName === 'MAIN' || container.getAttribute('role') === 'main') {
                break;
              }
              container = container.parentElement;
              searchDepth++;
            }

            if (!container) container = titleElement.parentElement;

            // 直接从容器文本中提取价格,不使用元素查找
            const containerText = container.textContent || '';

            // 策略1: $XX.XX (带小数点的价格,更精确)
            let match = containerText.match(/\$\s*(\d{1,3}(?:,\d{3})*\.\d{2})/);
            if (match) {
              const priceStr = match[1].replace(/,/g, '');
              const priceNum = parseFloat(priceStr);
              if (!isNaN(priceNum) && priceNum > 0 && priceNum < 100000) {
                return {
                  price: `$${priceNum.toFixed(2)}`,
                  confidence: 'high',
                  source: 'title-nearby-regex'
                };
              }
            }

            // 策略2: $XX (整数价格)
            match = containerText.match(/\$\s*(\d{1,3}(?:,\d{3})*)\b/);
            if (match) {
              const priceStr = match[1].replace(/,/g, '');
              const priceNum = parseFloat(priceStr);
              if (!isNaN(priceNum) && priceNum > 0 && priceNum < 100000) {
                return {
                  price: `$${priceNum.toFixed(2)}`,
                  confidence: 'high',
                  source: 'title-nearby-regex'
                };
              }
            }

            return null;
          });

          if (titleNearbyPrice) {
            priceInfo = titleNearbyPrice.price;
            priceConfidence = 'high';
          }
        } catch (error) {
          console.log('  标题附近价格提取失败:', error);
        }
      }

      // 策略1: 尝试从JSON-LD schema中提取价格
      if (!priceInfo) {
        try {
          const schemaPrice = await page.evaluate(function() {
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
      }

      // 如果JSON-LD失败,尝试更精确的DOM选择器策略
      if (!priceInfo) {
        const priceResult = await page.evaluate(() => {
          // 策略1: 查找明确标记为"当前价格"的元素(仅在页面顶部2000px内)
          const priceSelectors = [
            '[data-price-type="current"]',
            '[class*="currentPrice"]',
            '[class*="current-price"]',
            '[class*="sale-price"]',
            '[class*="salePrice"]',
            'span[class*="price"]:not([class*="old"]):not([class*="original"]):not([class*="was"])',
            'div[class*="price"]:not([class*="old"]):not([class*="original"]):not([class*="was"])',
            '[itemprop="price"]',
            '.price:not(.old-price):not(.was-price)',
            '[class*="Price"]:not([class*="Old"]):not([class*="Was"])'
          ];

          for (const selector of priceSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              const rect = el.getBoundingClientRect();
              if (rect.top >= 2000) continue;

              const text = el.textContent?.trim() || '';
              const classList = el.className.toLowerCase();

              if (classList.includes('old') || classList.includes('was') ||
                  classList.includes('original') || classList.includes('compare')) {
                continue;
              }

              // 内联价格提取逻辑 - 策略1
              let match = text.match(/\$\s*(\d{1,3}(?:,\d{3})*\.\d{2})/);
              if (match) {
                const priceStr = match[1].replace(/,/g, '');
                const priceNum = parseFloat(priceStr);
                if (!isNaN(priceNum) && priceNum > 0 && priceNum < 100000) {
                  return {
                    price: `$${priceNum.toFixed(2)}`,
                    confidence: selector.includes('current') || selector.includes('sale') ? 'high' : 'medium'
                  };
                }
              }

              // 内联价格提取逻辑 - 策略2
              match = text.match(/\$\s*(\d{1,3}(?:,\d{3})*)\b/);
              if (match) {
                const priceStr = match[1].replace(/,/g, '');
                const priceNum = parseFloat(priceStr);
                if (!isNaN(priceNum) && priceNum > 0 && priceNum < 100000) {
                  return {
                    price: `$${priceNum.toFixed(2)}`,
                    confidence: selector.includes('current') || selector.includes('sale') ? 'high' : 'medium'
                  };
                }
              }

              // 内联价格提取逻辑 - 策略3
              match = text.match(/\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/);
              if (match) {
                const priceStr = match[1].replace(/,/g, '');
                const priceNum = parseFloat(priceStr);
                if (!isNaN(priceNum) && priceNum > 0 && priceNum < 100000) {
                  return {
                    price: `$${priceNum.toFixed(2)}`,
                    confidence: 'medium'
                  };
                }
              }
            }
          }

          // 策略2: 在主内容区域搜索价格模式
          const mainContainersRaw = [
            document.querySelector('main'),
            document.querySelector('[class*="product-info"]'),
            document.querySelector('[class*="productInfo"]'),
            document.querySelector('[class*="product-detail"]'),
            document.querySelector('[role="main"]'),
          ];
          const mainContainers = [];
          for (var i = 0; i < mainContainersRaw.length; i++) {
            if (mainContainersRaw[i]) {
              mainContainers.push(mainContainersRaw[i]);
            }
          }

          const candidates = [];
          for (const container of mainContainers) {
            const allElements = container.querySelectorAll('span, div');

            for (const el of allElements) {
              const rect = el.getBoundingClientRect();
              if (rect.top >= 2000) continue;

              const text = el.textContent?.trim() || '';
              if (text.length > 50) continue;

              const lowerText = text.toLowerCase();
              if (lowerText.includes('save') || lowerText.includes('off') ||
                  lowerText.includes('discount') || lowerText.includes('deal')) {
                continue;
              }

              // 内联价格提取并收集候选
              let priceNum = null;
              let match = text.match(/\$\s*(\d{1,3}(?:,\d{3})*\.\d{2})/);
              if (match) {
                const priceStr = match[1].replace(/,/g, '');
                priceNum = parseFloat(priceStr);
                if (isNaN(priceNum) || priceNum <= 0 || priceNum >= 100000) {
                  priceNum = null;
                }
              }

              if (!priceNum) {
                match = text.match(/\$\s*(\d{1,3}(?:,\d{3})*)\b/);
                if (match) {
                  const priceStr = match[1].replace(/,/g, '');
                  priceNum = parseFloat(priceStr);
                  if (isNaN(priceNum) || priceNum <= 0 || priceNum >= 100000) {
                    priceNum = null;
                  }
                }
              }

              if (!priceNum) {
                match = text.match(/\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/);
                if (match) {
                  const priceStr = match[1].replace(/,/g, '');
                  priceNum = parseFloat(priceStr);
                  if (isNaN(priceNum) || priceNum <= 0 || priceNum >= 100000) {
                    priceNum = null;
                  }
                }
              }

              if (priceNum) {
                const style = window.getComputedStyle(el);
                const fontSize = parseFloat(style.fontSize);
                candidates.push({
                  price: priceNum,
                  fontSize: fontSize,
                  top: rect.top,
                  confidence: fontSize >= 20 ? 'medium' : 'low'
                });
              }
            }
          }

          if (candidates.length > 0) {
            // 按字体大小排序(降序)
            candidates.sort((a, b) => b.fontSize - a.fontSize);
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
   * 通用页面基础可用性检查
   * 对于无法归类为特定类型的页面(如集合页、关于页等),执行基本的可用性验证
   */
  private async checkGeneralPageAvailability(page: Page): Promise<CheckDetail[]> {
    const checks: CheckDetail[] = [];

    try {
      // 1. 检查页面是否有有效内容
      const contentCheck = await page.evaluate(function() {
        // 检查页面是否有实质性内容
        const body = document.body;
        if (!body) return { hasContent: false, contentLength: 0 };

        const textContent = body.innerText || body.textContent || '';
        const contentLength = textContent.trim().length;

        // 检查是否有图片
        const images = document.querySelectorAll('img');
        const visibleImages = Array.from(images).filter(img => {
          const rect = img.getBoundingClientRect();
          const style = window.getComputedStyle(img);
          return style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 rect.width > 0 &&
                 rect.height > 0;
        });

        return {
          hasContent: contentLength > 100, // 至少100个字符
          contentLength,
          imageCount: visibleImages.length
        };
      });

      checks.push({
        name: '页面内容',
        passed: contentCheck.hasContent,
        confidence: 'high',
        message: contentCheck.hasContent
          ? `页面包含有效内容 (${contentCheck.contentLength}字符, ${contentCheck.imageCount}张图片)`
          : `页面内容不足 (仅${contentCheck.contentLength}字符)`
      });

      // 2. 检查页面是否有导航功能
      const navigationCheck = await page.evaluate(function() {
        // 检查导航链接
        const links = document.querySelectorAll('a[href]');
        const validLinks = Array.from(links).filter(link => {
          const href = link.getAttribute('href');
          if (!href || href === '#' || href === 'javascript:void(0)') return false;

          const rect = link.getBoundingClientRect();
          const style = window.getComputedStyle(link);
          return style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 rect.width > 0 &&
                 rect.height > 0;
        });

        // 检查是否有返回首页的链接
        const homeLinks = Array.from(validLinks).filter(link => {
          const href = (link.getAttribute('href') || '').toLowerCase();
          const text = (link.textContent || '').toLowerCase();
          return href === '/' ||
                 href.includes('/home') ||
                 text.includes('home') ||
                 text.includes('首页') ||
                 link.getAttribute('aria-label')?.toLowerCase().includes('home');
        });

        return {
          totalLinks: validLinks.length,
          hasHomeLink: homeLinks.length > 0
        };
      });

      checks.push({
        name: '导航功能',
        passed: navigationCheck.totalLinks >= 3,
        confidence: 'medium',
        message: navigationCheck.totalLinks >= 3
          ? `页面包含${navigationCheck.totalLinks}个有效链接${navigationCheck.hasHomeLink ? ', 可返回首页' : ''}`
          : `页面链接不足 (仅${navigationCheck.totalLinks}个)`
      });

      // 3. 检查页面布局是否正常
      const layoutCheck = await page.evaluate(function() {
        const body = document.body;
        if (!body) return { hasLayout: false };

        const bodyRect = body.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 检查页面高度是否合理(至少占据一屏)
        const hasReasonableHeight = bodyRect.height > viewportHeight * 0.5;

        // 检查是否有可见的内容区块
        const visibleElements = Array.from(document.querySelectorAll('main, section, article, div')).filter(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 rect.width > 100 &&
                 rect.height > 50;
        });

        return {
          hasLayout: hasReasonableHeight && visibleElements.length >= 1,
          bodyHeight: Math.round(bodyRect.height),
          visibleBlocks: visibleElements.length
        };
      });

      checks.push({
        name: '页面布局',
        passed: layoutCheck.hasLayout,
        confidence: 'high',
        message: layoutCheck.hasLayout
          ? `布局正常 (高度${layoutCheck.bodyHeight}px, ${layoutCheck.visibleBlocks}个内容区块)`
          : `布局异常 (高度${layoutCheck.bodyHeight}px, ${layoutCheck.visibleBlocks}个内容区块)`
      });

    } catch (error) {
      checks.push({
        name: '基础检查',
        passed: false,
        confidence: 'low',
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

    // 浏览器崩溃相关错误
    if (errorMessage.includes('browser has been closed') ||
        errorMessage.includes('context or browser has been closed') ||
        errorMessage.includes('target page') ||
        errorMessage.includes('page crashed') ||
        errorMessage.includes('page closed')) {
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

      // 设置页面崩溃监听
      let pageCrashed = false;
      const crashHandler = () => {
        pageCrashed = true;
        console.error(`  ✗ Page crashed while loading: ${url}`);
        console.error(`  URL: ${url}, Name: ${name}`);
        console.error(`  Device: ${deviceConfig ? deviceConfig.name : 'desktop'}`);
        console.error(`  Memory pressure suspected - consider increasing shm_size in docker-compose.yml`);
      };
      page.on('crash', crashHandler);

      // 访问页面 - 使用保守的加载策略,优先稳定性而非完整性
      // 🔧 优化: 直接使用 domcontentloaded,避免 networkidle 导致的崩溃和超时
      let response: any;
      try {
        // 直接使用 domcontentloaded (更快更稳定)
        response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,  // 30秒超时
        });

        // 检查页面是否在加载过程中崩溃
        if (pageCrashed || page.isClosed()) {
          throw new Error('Page crashed during navigation');
        }

        // 等待页面部分渲染(减少从 3秒 到 1.5秒)
        await page.waitForTimeout(1500);

      } catch (error) {
        const errorMsg = (error as Error).message.toLowerCase();

        // 检测是否是页面崩溃错误
        if (errorMsg.includes('crash') || errorMsg.includes('closed') || pageCrashed) {
          page.off('crash', crashHandler);
          throw new Error('Page crashed during navigation - browser may be under memory pressure');
        }

        // 如果 domcontentloaded 也失败,降级到 load
        console.warn(`  DOMContentLoaded failed, falling back to load event...`);
        try {
          response = await page.goto(url, {
            waitUntil: 'load',
            timeout: 20000,
          });

          if (pageCrashed || page.isClosed()) {
            throw new Error('Page crashed during navigation');
          }

          // 最小等待时间
          await page.waitForTimeout(1000);

        } catch (fallbackError) {
          const fallbackMsg = (fallbackError as Error).message.toLowerCase();

          if (fallbackMsg.includes('crash') || fallbackMsg.includes('closed') || pageCrashed) {
            page.off('crash', crashHandler);
            throw new Error('Page crashed during navigation - browser may be under memory pressure');
          }

          // 最后尝试 commit (最基础的加载状态)
          console.warn(`  Load event failed, falling back to commit...`);
          response = await page.goto(url, {
            waitUntil: 'commit',
            timeout: 15000,
          });

          if (pageCrashed || page.isClosed()) {
            throw new Error('Page crashed during navigation');
          }

          // 给予最小等待时间让页面初始化
          await page.waitForTimeout(500);
        }
      } finally {
        // 清理事件监听
        page.off('crash', crashHandler);
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

      // 在任何页面操作前检查页面是否仍然有效
      if (page.isClosed()) {
        throw new Error('Page was closed after navigation');
      }

      // 等待页面稳定 - 使用 try-catch 保护
      try {
        await page.waitForTimeout(2000);
      } catch (error) {
        if (page.isClosed()) {
          throw new Error('Page closed while waiting for stability');
        }
        throw error;
      }

      // 再次检查页面状态
      if (page.isClosed()) {
        throw new Error('Page closed before popup dismissal');
      }

      // 尝试关闭弹窗(在检查页面元素之前) - 使用 try-catch 保护
      try {
        await this.dismissCommonPopups(page);
      } catch (error) {
        if (page.isClosed()) {
          throw new Error('Page closed during popup dismissal');
        }
        // 弹窗关闭失败不影响主流程
        console.warn(`  Failed to dismiss popups:`, (error as Error).message);
      }

      // 检查页面状态
      if (page.isClosed()) {
        throw new Error('Page closed before content check');
      }

      // 基本可用性检查 - 使用 try-catch 保护
      let bodyExists = false;
      try {
        bodyExists = await page.evaluate(function() {
          return document.body !== null && document.body.children.length > 0;
        });
      } catch (error) {
        if (page.isClosed()) {
          throw new Error('Page closed during content check');
        }
        throw error;
      }

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

      // 检查页面状态
      if (page.isClosed()) {
        throw new Error('Page closed before element checks');
      }

      // 执行页面检查 - 使用 try-catch 保护
      try {
        if (pageType === PageType.ProductPage) {
          console.log(`  Checking product page functions...`);
          checks = await this.checkProductPageFunctions(page);
        } else if (pageType === PageType.Homepage || pageType === PageType.LandingPage) {
          console.log(`  Checking page modules...`);
          checks = await this.checkHomepageModules(page, config);
        } else if (pageType === PageType.General) {
          console.log(`  Checking general page availability...`);
          checks = await this.checkGeneralPageAvailability(page);
        }
      } catch (error) {
        if (page.isClosed()) {
          throw new Error('Page closed during element checks');
        }
        // 检查失败,返回错误信息
        checks = [{
          name: '模块检查',
          passed: false,
          message: `检查过程出错: ${(error as Error).message}`
        }];
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

      // SEO检查(如果启用)
      let seoResults: PatrolTestResult['seoResults'] | undefined;
      if (config.seoChecks?.enabled) {
        // 检查页面状态
        if (page.isClosed()) {
          console.warn(`  Page closed before SEO check, skipping SEO check`);
        } else {
          try {
            console.log(`  Performing SEO check...`);
            const seoReport = await this.seoCheckerService.checkSEO(url);

            // 计算SEO评分
            const seoScore = calculateSEOScore(seoReport);
            console.log(`  SEO Score: ${seoScore}/100`);

            // 构建seoResults
            seoResults = {
              title: seoReport.title || undefined,
              hreflangLinks: seoReport.hreflangLinks.map(link => ({
                lang: link.lang,
                href: link.href,
                isValid: config.seoChecks?.validateHreflangUrls ? link.isValid : undefined,
              })),
              hreflangIssues: {
                missingXDefault: !seoReport.hreflangLinks.some(link => link.lang === 'x-default') && seoReport.hreflangLinks.length > 0,
                duplicateLangs: seoReport.hreflangIssues?.duplicates || [],
                invalidUrls: config.seoChecks?.validateHreflangUrls
                  ? seoReport.hreflangLinks.filter(link => !link.isValid).map(link => link.href)
                  : undefined,
              },
              article: config.seoChecks?.checkArticleInfo ? {
                hasArticleTag: !!(seoReport.article?.author || seoReport.article?.datePublished),
                author: seoReport.article?.author || undefined,
                publishedTime: seoReport.article?.datePublished || undefined,
                modifiedTime: seoReport.article?.dateModified || undefined,
              } : undefined,
              score: seoScore,
            };

            // 如果SEO分数过低,记录警告
            if (seoScore < 60) {
              console.warn(`  ⚠️  Low SEO score detected: ${seoScore}/100`);
            }
          } catch (error) {
            console.error(`  Failed to perform SEO check:`, error);
            // SEO检查失败不影响主流程
          }
        }
      }

      // 检查页面状态
      if (page.isClosed()) {
        throw new Error('Page closed before screenshot capture');
      }

      // 截图保存页面状态 - 上传到飞书 - 使用 try-catch 保护
      let screenshotUrl: string | undefined;
      try {
        const imageKey = await screenshotService.captureAndUploadToFeishu(page);
        // 转换为后端代理 URL
        screenshotUrl = `/api/v1/images/feishu/${imageKey}`;
      } catch (error) {
        if (page.isClosed()) {
          console.warn(`  Page closed during screenshot capture, skipping screenshot`);
        } else {
          console.error(`  Failed to capture and upload screenshot:`, error);
        }
      }

      // 视觉对比(如果启用)
      let visualDiff: any = undefined;
      if (config.visualComparison?.enabled && screenshotUrl) {
        // 检查页面状态
        if (page.isClosed()) {
          console.warn(`  Page closed before visual comparison, skipping comparison`);
        } else {
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
        screenshotUrl, // 截图URL(来自飞书)
        testDuration: Date.now() - startTime,
        visualDiff, // 视觉对比结果
        deviceType: deviceConfig?.type,
        deviceName: deviceConfig?.name,
        viewport: deviceConfig?.viewport,
        seoResults, // SEO检查结果
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

      // 尝试保存截图到飞书,即使检查失败 - 使用 try-catch 保护
      let screenshotUrl: string | undefined;
      // 检查页面是否仍然可用
      if (!page.isClosed()) {
        try {
          console.log(`  Capturing screenshot for failed test...`);
          const imageKey = await screenshotService.captureAndUploadToFeishu(page);
          // 转换为后端代理 URL
          screenshotUrl = `/api/v1/images/feishu/${imageKey}`;
          console.log(`  Screenshot uploaded to Feishu: ${screenshotUrl}`);
        } catch (screenshotError) {
          if (page.isClosed()) {
            console.warn(`  Page closed during error screenshot capture, skipping screenshot`);
          } else {
            console.error(`  Failed to capture and upload screenshot:`, screenshotError);
          }
        }
      } else {
        console.warn(`  Page already closed, cannot capture error screenshot`);
      }

      return {
        url,
        name,
        status: 'fail',
        responseTime,
        errorMessage: isInfraError ? `基础设施错误: ${errorMessage}` : errorMessage,
        screenshotUrl, // 包含截图URL(来自飞书)
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

      // 增加活跃任务计数
      metrics.activePatrolTasks.inc();

      // 发射巡检开始事件
      await this.eventEmitter.emit({
        type: PatrolEventType.PATROL_STARTED,
        timestamp: new Date(),
        executionId,
        task,
      });

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

          let context: BrowserContext;
          try {
            context = await browser.newContext({
              viewport: device.viewport,
              userAgent: device.userAgent,
            });
          } catch (error) {
            console.error(`[Responsive Test] Failed to create context for ${device.name}:`, error);
            console.warn('[Responsive Test] Browser may have crashed, acquiring new browser...');

            try {
              if (browser) {
                await browserPool.release(browser);
              }
              browser = await browserPool.acquire();
              context = await browser.newContext({
                viewport: device.viewport,
                userAgent: device.userAgent,
              });
              console.log(`[Responsive Test] Successfully created context with fresh browser`);
            } catch (retryError) {
              console.error(`[Responsive Test] Failed to create context even after browser refresh:`, retryError);
              // 跳过整个设备的测试
              for (const urlConfig of task.urls) {
                testResults.push({
                  url: urlConfig.url,
                  name: urlConfig.name,
                  status: 'fail',
                  errorMessage: `无法创建浏览器上下文 (浏览器不稳定): ${retryError instanceof Error ? retryError.message : 'Unknown error'}`,
                  responseTime: 0,
                  testDuration: 0,
                  isInfrastructureError: true,
                });
                failedUrls++;
              }
              continue; // 跳过这个设备
            }
          }

          // 🚀 并行测试当前设备上的所有 URL,限制并发数
          console.log(`  Testing ${task.urls.length} URLs with max concurrency: ${this.MAX_CONCURRENT_URLS}`);
          const limit = pLimit(this.MAX_CONCURRENT_URLS);

          const testPromises = task.urls.map((urlConfig) =>
            limit(async () => {
              let page: Page | null = null;

              try {
                // 验证浏览器和上下文状态
                if (!browser.isConnected()) {
                  throw new Error('Browser is not connected');
                }

                // 添加短暂延迟，确保上下文就绪
                await new Promise(resolve => setTimeout(resolve, 50));

                // 使用 try-catch 包装 newPage() 调用
                try {
                  page = await context.newPage();
                } catch (pageError: any) {
                  console.error(`[Responsive Test] Failed to create page for ${urlConfig.name}:`, pageError.message);
                  throw new Error(`Failed to create page: ${pageError.message}`);
                }

                // 验证页面创建成功
                if (!page || page.isClosed()) {
                  throw new Error('Page was closed immediately after creation');
                }
              } catch (error) {
                // Context 可能已关闭(浏览器崩溃)
                console.warn(`[Responsive Test] Failed to create page for ${urlConfig.name} on ${device.name}:`, error);
                return {
                  url: urlConfig.url,
                  name: urlConfig.name,
                  status: 'fail' as const,
                  errorMessage: `无法创建页面 (浏览器不稳定): ${error instanceof Error ? error.message : 'Unknown error'}`,
                  responseTime: 0,
                  testDuration: 0,
                  isInfrastructureError: true,
                };
              }

              try {
                const result = await this.testUrlWithRetry(
                  page,
                  urlConfig.url,
                  urlConfig.name,
                  config,
                  device
                );
                return result;
              } catch (error) {
                // 处理测试失败
                const errorMessage = error instanceof Error ? error.message : '未知错误';
                console.error(`[Responsive Test] Test failed for ${urlConfig.name} on ${device.name}:`, errorMessage);

                return {
                  url: urlConfig.url,
                  name: urlConfig.name,
                  status: 'fail' as const,
                  errorMessage,
                  responseTime: 0,
                  testDuration: 0,
                };
              } finally {
                // 确保每个URL测试后都关闭页面
                if (page && !page.isClosed()) {
                  await page.close().catch(() => {});
                }
              }
            })
          );

          // 等待所有测试完成
          const results = await Promise.allSettled(testPromises);

          // 处理结果
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              const testResult = result.value;
              testResults.push(testResult);

              if (testResult.status === 'pass') {
                passedUrls++;
              } else {
                failedUrls++;
              }
            } else {
              // Promise rejected
              console.error(`[Responsive Test] URL ${task.urls[index].name} test rejected on ${device.name}:`, result.reason);
              testResults.push({
                url: task.urls[index].url,
                name: task.urls[index].name,
                status: 'fail',
                errorMessage: result.reason instanceof Error ? result.reason.message : '测试失败',
                responseTime: 0,
                testDuration: 0,
              });
              failedUrls++;
            }
          });

          await context.close().catch(() => {});
        }
      } else {
        // 默认桌面端测试 - 并行测试所有 URL
        let context: BrowserContext;
        try {
          context = await browser.newContext();
        } catch (error) {
          console.error('[Desktop Test] Failed to create context:', error);
          console.warn('[Desktop Test] Browser may have crashed, acquiring new browser...');

          try {
            if (browser) {
              await browserPool.release(browser);
            }
            browser = await browserPool.acquire();
            context = await browser.newContext();
            console.log('[Desktop Test] Successfully created context with fresh browser');
          } catch (retryError) {
            console.error('[Desktop Test] Failed to create context even after browser refresh:', retryError);
            // 跳过所有URL测试
            for (const urlConfig of task.urls) {
              testResults.push({
                url: urlConfig.url,
                name: urlConfig.name,
                status: 'fail',
                errorMessage: `无法创建浏览器上下文 (浏览器不稳定): ${retryError instanceof Error ? retryError.message : 'Unknown error'}`,
                responseTime: 0,
                testDuration: 0,
                isInfrastructureError: true,
              });
              failedUrls++;
            }
            // 无法继续测试,提前结束
            throw new Error('Failed to create browser context after retry');
          }
        }

        // 🚀 并行测试所有 URL,限制并发数
        console.log(`\n[Desktop Test] Testing ${task.urls.length} URLs with max concurrency: ${this.MAX_CONCURRENT_URLS}`);
        const limit = pLimit(this.MAX_CONCURRENT_URLS);

        const testPromises = task.urls.map((urlConfig) =>
          limit(async () => {
            // 直接使用浏览器进行完整测试（UI 检查场景）
            let page: Page | null = null;

            try {
              // 验证浏览器和上下文状态
              if (!browser.isConnected()) {
                throw new Error('Browser is not connected');
              }

              // 添加短暂延迟，确保上下文就绪
              await new Promise(resolve => setTimeout(resolve, 50));

              // 使用 try-catch 包装 newPage() 调用
              try {
                page = await context.newPage();
              } catch (pageError: any) {
                console.error(`[Desktop Test] Failed to create page for ${urlConfig.name}:`, pageError.message);
                throw new Error(`Failed to create page: ${pageError.message}`);
              }

              // 验证页面创建成功
              if (!page || page.isClosed()) {
                throw new Error('Page was closed immediately after creation');
              }
            } catch (error) {
              // Context 可能已关闭(浏览器崩溃)
              console.warn(`[Desktop Test] Failed to create page for ${urlConfig.name}:`, error);
              return {
                url: urlConfig.url,
                name: urlConfig.name,
                status: 'fail' as const,
                errorMessage: `无法创建页面 (浏览器不稳定): ${error instanceof Error ? error.message : 'Unknown error'}`,
                responseTime: 0,
                testDuration: 0,
                isInfrastructureError: true,
              };
            }

            try {
              const result = await this.testUrlWithRetry(
                page,
                urlConfig.url,
                urlConfig.name,
                config
              );
              return result;
            } catch (error) {
              // 处理测试失败
              const errorMessage = error instanceof Error ? error.message : '未知错误';
              console.error(`[Desktop Test] Test failed for ${urlConfig.name}:`, errorMessage);

              return {
                url: urlConfig.url,
                name: urlConfig.name,
                status: 'fail' as const,
                errorMessage,
                responseTime: 0,
                testDuration: 0,
              };
            } finally {
              // 确保每个URL测试后都关闭页面
              if (page && !page.isClosed()) {
                await page.close().catch(() => {});
              }
            }
          })
        );

        // 等待所有测试完成
        const results = await Promise.allSettled(testPromises);

        // 处理结果
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const testResult = result.value;
            testResults.push(testResult);

            if (testResult.status === 'pass') {
              passedUrls++;
            } else {
              failedUrls++;
            }
          } else {
            // Promise rejected
            console.error(`[Desktop Test] URL ${task.urls[index].name} test rejected:`, result.reason);
            testResults.push({
              url: task.urls[index].url,
              name: task.urls[index].name,
              status: 'fail',
              errorMessage: result.reason instanceof Error ? result.reason.message : '测试失败',
              responseTime: 0,
              testDuration: 0,
            });
            failedUrls++;
          }
        });

        await context.close().catch(() => {});
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

      // 记录 Prometheus 指标
      const status = failedUrls === 0 ? 'success' : 'failed';
      recordPatrolExecution(task.id, status, durationMs / 1000);

      // 减少活跃任务计数
      metrics.activePatrolTasks.dec();

      // 获取完整的执行记录
      const execution = await this.executionRepository.findById(executionId);
      if (execution) {
        // 发射巡检完成事件
        await this.eventEmitter.emit({
          type: PatrolEventType.PATROL_COMPLETED,
          timestamp: new Date(),
          executionId,
          task,
          execution,
          passedUrls,
          failedUrls,
          durationMs,
        });
      }

      // 发送邮件通知
      // 无论成功或失败都发送邮件通知
      if (task.notificationEmails.length > 0) {
        try {
          const hasContentIssues = testResults.some(
            result => result.status === 'fail' && !result.isInfrastructureError
          );
          const hasInfraErrors = testResults.some(
            result => result.status === 'fail' && result.isInfrastructureError
          );

          let statusMsg = '';
          if (failedUrls === 0) {
            statusMsg = '(All checks passed)';
          } else if (hasContentIssues && hasInfraErrors) {
            statusMsg = '(Content issues + Infrastructure errors detected)';
          } else if (hasContentIssues) {
            statusMsg = '(Content issues detected)';
          } else if (hasInfraErrors) {
            statusMsg = '(Infrastructure errors only)';
          }

          console.log(`Sending email notification to ${task.notificationEmails.length} recipient(s)... ${statusMsg}`);
          await patrolEmailService.sendPatrolReport(executionId);
          console.log(`✓ Email notification sent successfully`);
        } catch (emailError) {
          console.error(`Failed to send email notification:`, emailError);
          // 邮件发送失败不影响巡检任务的完成
        }
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('未知错误');
      const errorMessage = errorObj.message;
      console.error(`Patrol execution failed:`, errorMessage);

      // 记录失败的 Prometheus 指标
      const durationMs = Date.now() - startTime;
      recordPatrolExecution(task.id, 'failed', durationMs / 1000);

      // 减少活跃任务计数
      metrics.activePatrolTasks.dec();

      // 更新状态为失败
      await this.executionRepository.updateStatus(
        executionId,
        PatrolExecutionStatus.Failed,
        errorMessage
      );

      // 发射巡检失败事件
      await this.eventEmitter.emit({
        type: PatrolEventType.PATROL_FAILED,
        timestamp: new Date(),
        executionId,
        task,
        error: errorObj,
        errorMessage,
      });
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
  async executePatrol(taskId: string, originUrl?: string): Promise<string> {
    // 获取巡检任务
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error(`Patrol task ${taskId} not found`);
    }

    if (!task.enabled) {
      throw new Error(`Patrol task ${taskId} is disabled`);
    }

    // 创建执行记录
    const executionId = await this.executionRepository.create({
      patrolTaskId: taskId,
      status: PatrolExecutionStatus.Pending,
      startedAt: new Date(),
      totalUrls: task.urls.length,
      passedUrls: 0,
      failedUrls: 0,
      testResults: [],
      emailSent: false,
      originUrl, // 🌐 保存请求来源
    });

    // 发射执行记录创建事件
    await this.eventEmitter.emit({
      type: PatrolEventType.EXECUTION_CREATED,
      timestamp: new Date(),
      executionId,
      taskId,
    });

    // 在后台异步执行测试
    this.runPatrolTests(executionId, task).catch((error) => {
      console.error(`Background patrol test execution failed:`, error);
    });

    // 立即返回executionId
    return executionId;
  }

  /**
   * 获取巡检任务列表
   */
  async getPatrolTasks(enabledOnly: boolean = false): Promise<PatrolTask[]> {
    // enabledOnly=true: 只获取启用的任务
    // enabledOnly=false: 获取所有任务(不传递筛选条件,避免 InvalidFilter)
    return this.taskRepository.findAll(enabledOnly ? { enabled: true } : {});
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
    const id = await this.taskRepository.create(task);
    const createdTask = await this.taskRepository.findById(id);
    if (!createdTask) {
      throw new Error(`Failed to retrieve created task with id ${id}`);
    }

    // 发射任务创建事件
    await this.eventEmitter.emit({
      type: PatrolEventType.TASK_CREATED,
      timestamp: new Date(),
      task: createdTask,
    });

    return createdTask;
  }

  /**
   * 更新巡检任务
   */
  async updatePatrolTask(
    taskId: string,
    updates: Partial<Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<PatrolTask | null> {
    const updatedTask = await this.taskRepository.update(taskId, updates);

    if (updatedTask) {
      // 发射任务更新事件
      await this.eventEmitter.emit({
        type: PatrolEventType.TASK_UPDATED,
        timestamp: new Date(),
        taskId,
        task: updatedTask,
        changes: updates,
      });
    }

    return updatedTask;
  }

  /**
   * 删除巡检任务
   */
  async deletePatrolTask(taskId: string): Promise<boolean> {
    const deleted = await this.taskRepository.delete(taskId);

    if (deleted) {
      // 发射任务删除事件
      await this.eventEmitter.emit({
        type: PatrolEventType.TASK_DELETED,
        timestamp: new Date(),
        taskId,
      });
    }

    return deleted;
  }

  /**
   * 获取执行历史
   */
  async getExecutionHistory(taskId?: string, limit: number = 50) {
    if (taskId) {
      return this.executionRepository.findByTaskId(taskId, { limit });
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
