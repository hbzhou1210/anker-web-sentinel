import { Page } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import feishuApiService from '../services/FeishuApiService.js';

export class ScreenshotService {
  private screenshotDir = process.env.SCREENSHOT_DIR || '/tmp/screenshots';

  constructor() {
    this.ensureScreenshotDir();
  }

  // Ensure screenshot directory exists
  private async ensureScreenshotDir(): Promise<void> {
    try {
      await mkdir(this.screenshotDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create screenshot directory:', error);
    }
  }

  // Capture screenshot of specific element with highlighting
  async captureElement(
    page: Page,
    selector: string,
    errorType?: string
  ): Promise<string> {
    try {
      // Highlight the element with red border
      await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (element instanceof HTMLElement) {
          element.style.border = '3px solid red';
          element.style.outline = '2px solid rgba(255, 0, 0, 0.3)';
        }
      }, selector);

      // Wait a moment for styles to apply
      await page.waitForTimeout(200);

      // Capture full page screenshot as PNG
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
      });

      // Compress to WebP format at 80% quality
      const compressed = await sharp(screenshot)
        .webp({ quality: 80 })
        .toBuffer();

      // Generate unique filename
      const filename = `${randomUUID()}.webp`;
      const filepath = join(this.screenshotDir, filename);

      // Save to disk
      await writeFile(filepath, compressed);

      console.log(`✓ Screenshot saved: ${filename} (${(compressed.length / 1024).toFixed(2)}KB)`);

      // Return relative URL path
      return `/screenshots/${filename}`;
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      throw error;
    }
  }

  /**
   * 捕获全屏截图并返回 base64 编码
   * 用于直接保存到 Bitable
   */
  async captureFullPageBase64(page: Page): Promise<string> {
    try {
      // Capture full page screenshot as PNG
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
      });

      // Compress to WebP format at 80% quality
      const compressed = await sharp(screenshot)
        .webp({ quality: 80 })
        .toBuffer();

      // Convert to base64
      const base64 = compressed.toString('base64');

      console.log(`✓ Screenshot captured as base64 (${(compressed.length / 1024).toFixed(2)}KB)`);

      return `data:image/webp;base64,${base64}`;
    } catch (error) {
      console.error('Failed to capture screenshot as base64:', error);
      throw error;
    }
  }

  // Capture screenshot with highlighted element and error overlay
  async captureWithHighlight(
    page: Page,
    selector: string,
    errorType: string
  ): Promise<string> {
    try {
      // Add error indicator overlay to the page
      await page.evaluate(
        ({ sel, error }) => {
          // Highlight the element
          const element = document.querySelector(sel);
          if (element instanceof HTMLElement) {
            element.style.border = '4px solid #ef4444';
            element.style.outline = '3px solid rgba(239, 68, 68, 0.3)';
            element.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.5)';
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Add error label overlay
            const overlay = document.createElement('div');
            overlay.style.position = 'absolute';
            overlay.style.backgroundColor = '#ef4444';
            overlay.style.color = 'white';
            overlay.style.padding = '8px 12px';
            overlay.style.borderRadius = '4px';
            overlay.style.fontSize = '14px';
            overlay.style.fontWeight = 'bold';
            overlay.style.zIndex = '999999';
            overlay.style.pointerEvents = 'none';
            overlay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            overlay.textContent = `❌ ${error}`;

            // Position overlay above element
            const rect = element.getBoundingClientRect();
            overlay.style.left = `${rect.left + window.scrollX}px`;
            overlay.style.top = `${rect.top + window.scrollY - 40}px`;

            document.body.appendChild(overlay);
          }
        },
        { sel: selector, error: errorType }
      );

      // Wait for overlay to render
      await page.waitForTimeout(300);

      // Capture full page screenshot
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
      });

      // Compress to WebP format
      const compressed = await sharp(screenshot)
        .webp({ quality: 85 })
        .toBuffer();

      // Generate unique filename
      const filename = `${randomUUID()}.webp`;
      const filepath = join(this.screenshotDir, filename);

      // Save to disk
      await writeFile(filepath, compressed);

      console.log(`✓ Highlighted screenshot saved: ${filename} (${(compressed.length / 1024).toFixed(2)}KB)`);

      // Return relative URL path
      return `/screenshots/${filename}`;
    } catch (error) {
      console.error('Failed to capture highlighted screenshot:', error);
      // Return empty string on failure to avoid breaking test flow
      return '';
    }
  }

  // Capture full page screenshot without highlighting
  async captureFullPage(page: Page): Promise<string> {
    try {
      // 检查页面是否仍然有效
      if (page.isClosed()) {
        console.warn('Page is closed, cannot capture screenshot');
        return '';
      }

      // 等待页面稳定,防止在渲染过程中截图崩溃
      // 🔧 优化: 使用更宽容的等待策略,避免 "Page closed while waiting for stability" 错误
      try {
        // 首先检查页面是否已关闭
        if (page.isClosed()) {
          console.warn('Page already closed before waiting for stability');
          return '';
        }

        // 尝试等待 networkidle (但超时时间更短)
        await page.waitForLoadState('networkidle', { timeout: 3000 });
      } catch (error: any) {
        // 如果页面关闭,直接返回
        if (error.message?.includes('closed') || page.isClosed()) {
          console.warn('Page closed while waiting for stability');
          return '';
        }

        // 如果只是超时,继续截图(可能页面有持续的网络请求)
        console.log('Page did not reach networkidle state within 3s, proceeding with screenshot');

        // 给予最小等待时间让页面基本渲染完成
        try {
          await page.waitForTimeout(500);
        } catch {
          // 如果连 waitForTimeout 都失败,说明页面已经不可用
          return '';
        }
      }

      // 尝试完整页面截图
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
        timeout: 30000, // 30秒超时
      });

      // Compress to WebP format at 80% quality
      const compressed = await sharp(screenshot)
        .webp({ quality: 80 })
        .toBuffer();

      // Generate unique filename
      const filename = `${randomUUID()}.webp`;
      const filepath = join(this.screenshotDir, filename);

      // Save to disk
      await writeFile(filepath, compressed);

      console.log(`✓ Full page screenshot saved: ${filename}`);

      return `/screenshots/${filename}`;
    } catch (error) {
      // 如果完整页面截图失败(通常是因为页面太长超过WebP限制)
      // 降级到视口截图
      console.warn('Full page screenshot failed, falling back to viewport screenshot:', error instanceof Error ? error.message : error);

      try {
        const screenshot = await page.screenshot({
          fullPage: false,  // 只截取当前视口
          type: 'png',
        });

        const compressed = await sharp(screenshot)
          .webp({ quality: 80 })
          .toBuffer();

        const filename = `${randomUUID()}.webp`;
        const filepath = join(this.screenshotDir, filename);

        await writeFile(filepath, compressed);

        console.log(`✓ Viewport screenshot saved (fallback): ${filename}`);

        return `/screenshots/${filename}`;
      } catch (fallbackError) {
        console.error('Failed to capture viewport screenshot:', fallbackError);
        // 返回空字符串以避免中断测试流程
        return '';
      }
    }
  }

  // Get absolute file path for a screenshot URL
  getFilePath(screenshotUrl: string): string {
    const filename = screenshotUrl.replace('/screenshots/', '');
    return join(this.screenshotDir, filename);
  }

  // Clean up screenshots older than specified days
  async cleanupOldScreenshots(daysToKeep: number = 7): Promise<number> {
    try {
      const { readdir, stat, unlink } = await import('fs/promises');
      const files = await readdir(this.screenshotDir);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      let deletedCount = 0;

      for (const file of files) {
        const filepath = join(this.screenshotDir, file);
        const stats = await stat(filepath);

        // Delete if older than maxAge
        if (now - stats.mtimeMs > maxAge) {
          await unlink(filepath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`✓ Cleaned up ${deletedCount} old screenshots`);
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old screenshots:', error);
      return 0;
    }
  }

  /**
   * 捕获全屏截图并上传到飞书
   * @param page Playwright Page 对象
   * @returns 飞书图片 Key
   */
  async captureAndUploadToFeishu(page: Page): Promise<string> {
    try {
      console.log('  Capturing screenshot for Feishu upload...');

      // 等待页面完全加载,确保图片和内容都渲染完成
      try {
        // 1. 等待网络空闲(最多5秒)
        await page.waitForLoadState('networkidle', { timeout: 5000 });
        console.log('  ✓ Page reached networkidle state');
      } catch (error) {
        // 如果5秒内没有达到networkidle,继续等待DOMContentLoaded
        console.log('  Page did not reach networkidle, waiting for load state...');
        await page.waitForLoadState('load', { timeout: 3000 }).catch(() => {});
      }

      // 2. 滚动页面触发懒加载图片
      try {
        await page.evaluate(async () => {
          // 滚动到页面底部,触发懒加载
          await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 300;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                // 滚动回顶部
                window.scrollTo(0, 0);
                resolve();
              }
            }, 100);
          });
        });
        console.log('  ✓ Page scrolled to trigger lazy loading');
      } catch (error) {
        console.log('  Warning: Could not scroll page:', error);
      }

      // 3. 等待所有图片加载完成(包括懒加载的图片)
      try {
        await page.evaluate(async () => {
          const images = Array.from(document.querySelectorAll('img'));
          await Promise.all(
            images.map((img) => {
              if (img.complete && img.naturalHeight > 0) return Promise.resolve();
              return new Promise((resolve) => {
                img.addEventListener('load', resolve);
                img.addEventListener('error', resolve); // 即使加载失败也继续
                // 超时保护 - 每张图片最多等待5秒
                setTimeout(resolve, 5000);
              });
            })
          );
        });
        console.log('  ✓ All images loaded');
      } catch (error) {
        console.log('  Warning: Could not wait for all images:', error);
      }

      // 4. 额外等待2秒,确保动画和延迟加载内容完成
      await page.waitForTimeout(2000);

      // Capture full page screenshot as PNG
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
        timeout: 30000,
      });

      // Compress to WebP format at 80% quality
      const compressed = await sharp(screenshot)
        .webp({ quality: 80 })
        .toBuffer();

      console.log(`  Screenshot captured (${(compressed.length / 1024).toFixed(2)}KB), uploading to Feishu...`);

      // Upload to Feishu and get image key
      const filename = `screenshot-${Date.now()}.webp`;
      const imageKey = await feishuApiService.uploadImage(compressed, filename);

      console.log(`  ✓ Screenshot uploaded to Feishu, key: ${imageKey}`);

      return imageKey;
    } catch (error) {
      console.error('  Failed to capture and upload screenshot to Feishu:', error);
      throw error;
    }
  }
}

export default new ScreenshotService();
