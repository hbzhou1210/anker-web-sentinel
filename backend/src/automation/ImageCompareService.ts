import { Jimp } from 'jimp';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface ImageDiffResult {
  hasDifference: boolean;
  diffPercentage: number; // 0-100
  diffPixelCount: number;
  totalPixels: number;
  diffImagePath?: string; // 差异图像路径
  previousImagePath?: string;
  currentImagePath: string;
}

export interface CompareOptions {
  threshold?: number; // 像素差异阈值 (0-255), 默认10
  diffPercentageThreshold?: number; // 差异百分比阈值 (0-100), 默认5%
  saveBaseline?: boolean; // 是否保存为基线
  generateDiffImage?: boolean; // 是否生成差异图
}

class ImageCompareService {
  private baselineDir: string;
  private diffDir: string;

  constructor() {
    // 使用环境变量或默认路径
    const screenshotDir = process.env.SCREENSHOT_DIR || '/tmp/screenshots';
    this.baselineDir = path.join(screenshotDir, 'baseline');
    this.diffDir = path.join(screenshotDir, 'diff');
  }

  /**
   * 初始化目录
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.baselineDir, { recursive: true });
    await fs.mkdir(this.diffDir, { recursive: true });
    console.log(`✓ Image compare service initialized`);
    console.log(`  Baseline: ${this.baselineDir}`);
    console.log(`  Diff: ${this.diffDir}`);
  }

  /**
   * 生成URL的唯一标识
   */
  private generateUrlHash(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
  }

  /**
   * 获取基线图像路径
   */
  private getBaselinePath(url: string, deviceType?: string): string {
    const urlHash = this.generateUrlHash(url);
    const suffix = deviceType ? `_${deviceType}` : '';
    return path.join(this.baselineDir, `${urlHash}${suffix}.png`);
  }

  /**
   * 获取差异图像路径
   */
  private getDiffPath(url: string, deviceType?: string): `${string}.${string}` {
    const urlHash = this.generateUrlHash(url);
    const timestamp = Date.now();
    const suffix = deviceType ? `_${deviceType}` : '';
    return path.join(this.diffDir, `${urlHash}${suffix}_${timestamp}.png`) as `${string}.${string}`;
  }

  /**
   * 保存基线图像
   */
  async saveBaseline(imagePath: string, url: string, deviceType?: string): Promise<string> {
    const baselinePath = this.getBaselinePath(url, deviceType);

    // 复制图像到基线目录
    await fs.copyFile(imagePath, baselinePath);

    console.log(`✓ Baseline saved: ${baselinePath}`);
    return baselinePath;
  }

  /**
   * 检查是否存在基线图像
   */
  async hasBaseline(url: string, deviceType?: string): Promise<boolean> {
    const baselinePath = this.getBaselinePath(url, deviceType);
    try {
      await fs.access(baselinePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 比较两张图像
   */
  async compareImages(
    currentImagePath: string,
    url: string,
    deviceType?: string,
    options: CompareOptions = {}
  ): Promise<ImageDiffResult> {
    const {
      threshold = 10,
      diffPercentageThreshold = 5,
      saveBaseline = false,
      generateDiffImage = true,
    } = options;

    const baselinePath = this.getBaselinePath(url, deviceType);

    // 如果没有基线图像,保存当前图像作为基线
    const hasBaseline = await this.hasBaseline(url, deviceType);
    if (!hasBaseline) {
      if (saveBaseline) {
        await this.saveBaseline(currentImagePath, url, deviceType);
      }
      return {
        hasDifference: false,
        diffPercentage: 0,
        diffPixelCount: 0,
        totalPixels: 0,
        currentImagePath,
      };
    }

    try {
      // 读取两张图像
      const [baseline, current] = await Promise.all([
        Jimp.read(baselinePath),
        Jimp.read(currentImagePath),
      ]);

      // 确保尺寸一致
      if (baseline.width !== current.width || baseline.height !== current.height) {
        console.warn(`⚠️  Image dimensions mismatch. Baseline: ${baseline.width}x${baseline.height}, Current: ${current.width}x${current.height}`);
        // 调整尺寸到较小的尺寸
        const minWidth = Math.min(baseline.width, current.width);
        const minHeight = Math.min(baseline.height, current.height);
        baseline.resize({ w: minWidth, h: minHeight });
        current.resize({ w: minWidth, h: minHeight });
      }

      const width = baseline.width;
      const height = baseline.height;
      const totalPixels = width * height;
      let diffPixelCount = 0;

      // 创建差异图像
      const diffImage = generateDiffImage ? new Jimp({ width, height }) : null;

      // 逐像素比较
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const baselineColorInt = baseline.getPixelColor(x, y);
          const currentColorInt = current.getPixelColor(x, y);
          const baselineColor = {
            r: (baselineColorInt >> 24) & 0xff,
            g: (baselineColorInt >> 16) & 0xff,
            b: (baselineColorInt >> 8) & 0xff,
            a: baselineColorInt & 0xff
          };
          const currentColor = {
            r: (currentColorInt >> 24) & 0xff,
            g: (currentColorInt >> 16) & 0xff,
            b: (currentColorInt >> 8) & 0xff,
            a: currentColorInt & 0xff
          };

          // 计算RGB差异
          const rDiff = Math.abs(baselineColor.r - currentColor.r);
          const gDiff = Math.abs(baselineColor.g - currentColor.g);
          const bDiff = Math.abs(baselineColor.b - currentColor.b);
          const maxDiff = Math.max(rDiff, gDiff, bDiff);

          if (maxDiff > threshold) {
            diffPixelCount++;
            // 标记差异像素为红色
            if (diffImage) {
              const redColor = (255 << 24) | (0 << 16) | (0 << 8) | 255;
              diffImage.setPixelColor(redColor, x, y);
            }
          } else {
            // 非差异像素显示为灰度
            if (diffImage) {
              const gray = Math.round((currentColor.r + currentColor.g + currentColor.b) / 3);
              const grayColor = (gray << 24) | (gray << 16) | (gray << 8) | 128;
              diffImage.setPixelColor(grayColor, x, y);
            }
          }
        }
      }

      const diffPercentage = (diffPixelCount / totalPixels) * 100;
      const hasDifference = diffPercentage > diffPercentageThreshold;

      let diffImagePath: `${string}.${string}` | undefined;
      if (generateDiffImage && hasDifference && diffImage) {
        diffImagePath = this.getDiffPath(url, deviceType);
        await diffImage.write(diffImagePath);
        console.log(`✓ Diff image saved: ${diffImagePath}`);
      }

      // 如果设置了保存基线且有显著差异,可选择更新基线
      if (saveBaseline && !hasDifference) {
        await this.saveBaseline(currentImagePath, url, deviceType);
      }

      return {
        hasDifference,
        diffPercentage: parseFloat(diffPercentage.toFixed(2)),
        diffPixelCount,
        totalPixels,
        diffImagePath,
        previousImagePath: baselinePath,
        currentImagePath,
      };
    } catch (error) {
      console.error(`Failed to compare images:`, error);
      throw error;
    }
  }

  /**
   * 清理过期的差异图像
   */
  async cleanupDiffImages(daysToKeep: number = 7): Promise<number> {
    const files = await fs.readdir(this.diffDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.diffDir, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`✓ Cleaned up ${deletedCount} old diff images`);
    }

    return deletedCount;
  }

  /**
   * 删除URL的基线图像
   */
  async deleteBaseline(url: string, deviceType?: string): Promise<void> {
    const baselinePath = this.getBaselinePath(url, deviceType);
    try {
      await fs.unlink(baselinePath);
      console.log(`✓ Baseline deleted: ${baselinePath}`);
    } catch (error) {
      // 文件不存在,忽略错误
    }
  }

  /**
   * 获取所有基线图像信息
   */
  async getBaselineInfo(): Promise<{ url: string; path: string; size: number; modifiedAt: Date }[]> {
    const files = await fs.readdir(this.baselineDir);
    const info = [];

    for (const file of files) {
      const filePath = path.join(this.baselineDir, file);
      const stats = await fs.stat(filePath);
      info.push({
        url: file,
        path: filePath,
        size: stats.size,
        modifiedAt: stats.mtime,
      });
    }

    return info;
  }
}

export const imageCompareService = new ImageCompareService();
