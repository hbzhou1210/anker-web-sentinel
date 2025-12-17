import { Page } from 'playwright';
import { DevicePreset, ResponsiveTestResult, ResponsiveTestIssue, DeviceType } from '../models/entities.js';
import { ScreenshotService } from './ScreenshotService.js';

export class ResponsiveTestingService {
  private screenshotService: ScreenshotService;

  constructor() {
    this.screenshotService = new ScreenshotService();
  }

  /**
   * 执行页面操作并在浏览器崩溃时提供更好的错误信息
   * @param operation 要执行的操作
   * @param operationName 操作名称(用于日志)
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      // 检查是否是浏览器崩溃相关错误
      const isBrowserCrash =
        error.message?.includes('Target page, context or browser has been closed') ||
        error.message?.includes('Browser has been closed') ||
        error.message?.includes('Protocol error') ||
        error.message?.includes('Session closed');

      if (isBrowserCrash) {
        console.warn(`[ResponsiveTestingService] ${operationName} failed due to browser crash: ${error.message}`);
        console.warn(`[ResponsiveTestingService] This error will be propagated to trigger browser replacement at outer retry layer`);
      }

      // 直接抛出错误,让外层的 testDeviceWithRetry() 来处理
      throw error;
    }
  }

  /**
   * 在指定设备上测试网站响应式
   */
  async testOnDevice(
    page: Page,
    url: string,
    device: DevicePreset
  ): Promise<ResponsiveTestResult> {
    const startTime = Date.now();
    const issues: ResponsiveTestIssue[] = [];

    try {
      // 检查页面是否有效
      if (page.isClosed()) {
        throw new Error('Page is already closed before test');
      }

      // 设置视口 - 使用重试机制
      await this.executeWithRetry(
        () => page.setViewportSize({
          width: device.viewportWidth,
          height: device.viewportHeight,
        }),
        'setViewportSize'
      );

      // 设置 User Agent (通过 HTTP Header) - 使用重试机制
      await this.executeWithRetry(
        () => page.setExtraHTTPHeaders({
          'User-Agent': device.userAgent,
        }),
        'setExtraHTTPHeaders'
      );

      // 访问页面 - 使用重试机制和 domcontentloaded 代替 networkidle 加快速度
      await this.executeWithRetry(
        () => page.goto(url, {
          waitUntil: 'domcontentloaded',  // 改为 domcontentloaded,更快
          timeout: 30000
        }),
        'page.goto'
      );

      // 等待页面稳定 - 使用重试机制,减少等待时间
      await this.executeWithRetry(
        () => page.waitForTimeout(1000),  // 从 2000ms 减少到 1000ms
        'waitForTimeout'
      );

      // 再次检查页面状态
      if (page.isClosed()) {
        throw new Error('Page closed during initial load');
      }

      // 1. 检查是否有横向滚动条 - 使用重试机制
      const hasHorizontalScroll = await this.executeWithRetry(
        () => this.checkHorizontalScroll(page, issues),
        'checkHorizontalScroll'
      );

      // 2. 检查 viewport meta 标签 - 使用重试机制
      const hasViewportMeta = await this.executeWithRetry(
        () => this.checkViewportMeta(page, issues),
        'checkViewportMeta'
      );

      // 3. 检查字体大小是否可读 - 使用重试机制
      const fontSizeReadable = await this.executeWithRetry(
        () => this.checkFontSize(page, issues),
        'checkFontSize'
      );

      // 4. 检查触摸目标大小 - 使用重试机制
      const touchTargetsAdequate = await this.executeWithRetry(
        () => this.checkTouchTargets(page, issues, device.isMobile),
        'checkTouchTargets'
      );

      // 5. 检查图片响应式 - 使用重试机制
      const imagesResponsive = await this.executeWithRetry(
        () => this.checkImagesResponsive(page, issues),
        'checkImagesResponsive'
      );

      // 截图 - 竖屏 - 使用重试机制
      const screenshotPortraitUrl = await this.executeWithRetry(
        () => this.screenshotService.captureFullPage(page),
        'captureFullPage(portrait)'
      );

      // 如果是移动设备,测试横屏
      let screenshotLandscapeUrl: string | undefined;
      if (device.isMobile) {
        await this.executeWithRetry(
          () => page.setViewportSize({
            width: device.viewportHeight,
            height: device.viewportWidth,
          }),
          'setViewportSize(landscape)'
        );

        await this.executeWithRetry(
          () => page.waitForTimeout(500),  // 从 1000ms 减少到 500ms
          'waitForTimeout(landscape)'
        );

        screenshotLandscapeUrl = await this.executeWithRetry(
          () => this.screenshotService.captureFullPage(page),
          'captureFullPage(landscape)'
        );

        // 恢复竖屏
        await this.executeWithRetry(
          () => page.setViewportSize({
            width: device.viewportWidth,
            height: device.viewportHeight,
          }),
          'setViewportSize(portrait-restore)'
        );
      }

      const testDuration = Date.now() - startTime;

      return {
        id: '', // 将由数据库生成
        testReportId: '',
        deviceName: device.name,
        deviceType: device.deviceType as DeviceType,
        viewportWidth: device.viewportWidth,
        viewportHeight: device.viewportHeight,
        userAgent: device.userAgent,
        hasHorizontalScroll,
        hasViewportMeta,
        fontSizeReadable,
        touchTargetsAdequate,
        imagesResponsive,
        screenshotPortraitUrl,
        screenshotLandscapeUrl,
        issues,
        testDuration,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error(`Failed to test on device ${device.name}:`, error);

      issues.push({
        type: 'horizontal_scroll',
        severity: 'error',
        message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });

      const testDuration = Date.now() - startTime;

      return {
        id: '',
        testReportId: '',
        deviceName: device.name,
        deviceType: device.deviceType as DeviceType,
        viewportWidth: device.viewportWidth,
        viewportHeight: device.viewportHeight,
        userAgent: device.userAgent,
        hasHorizontalScroll: false,
        hasViewportMeta: false,
        fontSizeReadable: false,
        touchTargetsAdequate: false,
        imagesResponsive: false,
        issues,
        testDuration,
        createdAt: new Date(),
      };
    }
  }

  /**
   * 检查是否有横向滚动条
   */
  private async checkHorizontalScroll(page: Page, issues: ResponsiveTestIssue[]): Promise<boolean> {
    try {
      const scrollInfo = await page.evaluate(() => {
        const scrollWidth = document.documentElement.scrollWidth;
        const clientWidth = document.documentElement.clientWidth;
        const overflow = scrollWidth - clientWidth;

        // 允许1px的误差,避免浏览器舍入误差导致的误报
        const hasScroll = overflow > 1;

        return {
          hasScroll,
          scrollWidth,
          clientWidth,
          overflow
        };
      });

      if (scrollInfo.hasScroll) {
        issues.push({
          type: 'horizontal_scroll',
          severity: 'error',
          message: `页面宽度(${scrollInfo.scrollWidth}px)超出视口宽度(${scrollInfo.clientWidth}px),出现横向滚动条`,
          details: {
            scrollWidth: scrollInfo.scrollWidth,
            clientWidth: scrollInfo.clientWidth,
            overflow: scrollInfo.overflow,
          },
        });
      }

      // 返回是否有横向滚动: true = 有滚动条(失败), false = 无滚动条(通过)
      return scrollInfo.hasScroll;
    } catch (error) {
      console.error('Failed to check horizontal scroll:', error);
      return true;
    }
  }

  /**
   * 检查 viewport meta 标签
   */
  private async checkViewportMeta(page: Page, issues: ResponsiveTestIssue[]): Promise<boolean> {
    try {
      const viewportMeta = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      if (!viewportMeta) {
        issues.push({
          type: 'viewport_meta',
          severity: 'error',
          message: '缺少 viewport meta 标签,可能导致移动端显示异常',
          details: {
            recommendation: '添加: <meta name="viewport" content="width=device-width, initial-scale=1.0">',
          },
        });
        return false;
      }

      // 检查是否包含基本配置
      const hasWidthConfig = viewportMeta.includes('width=device-width');
      const hasInitialScale = viewportMeta.includes('initial-scale');

      if (!hasWidthConfig || !hasInitialScale) {
        issues.push({
          type: 'viewport_meta',
          severity: 'warning',
          message: 'viewport meta 标签配置不完整',
          details: {
            current: viewportMeta,
            recommendation: 'width=device-width, initial-scale=1.0',
          },
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to check viewport meta:', error);
      return false;
    }
  }

  /**
   * 检查字体大小
   */
  private async checkFontSize(page: Page, issues: ResponsiveTestIssue[]): Promise<boolean> {
    try {
      const smallTextElements = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('p, span, a, li, td, div'));
        const smallElements: Array<{ tag: string; fontSize: string; text: string }> = [];

        elements.forEach((el) => {
          const style = window.getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);

          // 检查字体是否小于 12px
          if (fontSize < 12 && el.textContent && el.textContent.trim().length > 0) {
            smallElements.push({
              tag: el.tagName.toLowerCase(),
              fontSize: style.fontSize,
              text: el.textContent.trim().substring(0, 50),
            });
          }
        });

        return smallElements.slice(0, 5); // 只返回前5个
      });

      if (smallTextElements.length > 0) {
        issues.push({
          type: 'font_size',
          severity: 'warning',
          message: `发现 ${smallTextElements.length} 个字体过小的元素(< 12px)`,
          details: {
            elements: smallTextElements,
            recommendation: '移动端字体建议至少 14px',
          },
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to check font size:', error);
      return true;
    }
  }

  /**
   * 检查触摸目标大小
   */
  private async checkTouchTargets(page: Page, issues: ResponsiveTestIssue[], isMobile: boolean): Promise<boolean> {
    if (!isMobile) {
      return true; // 桌面端不检查触摸目标
    }

    try {
      const smallTouchTargets = await page.evaluate(() => {
        const interactiveElements = Array.from(
          document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]')
        );
        const smallTargets: Array<{ tag: string; width: number; height: number; text: string }> = [];

        interactiveElements.forEach((el) => {
          const rect = el.getBoundingClientRect();

          // 检查是否小于推荐的 44x44px
          if ((rect.width < 44 || rect.height < 44) && rect.width > 0 && rect.height > 0) {
            smallTargets.push({
              tag: el.tagName.toLowerCase(),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              text: (el.textContent || '').trim().substring(0, 30),
            });
          }
        });

        return smallTargets.slice(0, 5);
      });

      if (smallTouchTargets.length > 0) {
        issues.push({
          type: 'touch_target',
          severity: 'warning',
          message: `发现 ${smallTouchTargets.length} 个触摸目标过小的元素(< 44x44px)`,
          details: {
            elements: smallTouchTargets,
            recommendation: '移动端可点击元素建议至少 44x44px',
          },
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to check touch targets:', error);
      return true;
    }
  }

  /**
   * 检查图片响应式
   */
  private async checkImagesResponsive(page: Page, issues: ResponsiveTestIssue[]): Promise<boolean> {
    try {
      const imageIssues = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        const problematicImages: Array<{ src: string; issue: string; width: number }> = [];

        images.forEach((img) => {
          const rect = img.getBoundingClientRect();
          const naturalWidth = img.naturalWidth;
          const displayWidth = rect.width;

          // 检查图片是否溢出容器
          if (displayWidth > window.innerWidth) {
            problematicImages.push({
              src: img.src.substring(0, 100),
              issue: '图片宽度超出视口',
              width: Math.round(displayWidth),
            });
          }

          // 检查是否有固定宽度(非百分比)
          const style = window.getComputedStyle(img);
          if (img.hasAttribute('width') && !img.getAttribute('width')?.includes('%')) {
            problematicImages.push({
              src: img.src.substring(0, 100),
              issue: '使用固定宽度,不响应式',
              width: Math.round(displayWidth),
            });
          }
        });

        return problematicImages.slice(0, 5);
      });

      if (imageIssues.length > 0) {
        issues.push({
          type: 'image_responsive',
          severity: 'warning',
          message: `发现 ${imageIssues.length} 个图片响应式问题`,
          details: {
            images: imageIssues,
            recommendation: '使用 max-width: 100%; height: auto; 或 CSS Grid/Flexbox',
          },
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to check images responsive:', error);
      return true;
    }
  }
}
