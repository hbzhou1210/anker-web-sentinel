import axios from 'axios';
import { LightweightMonitor } from './LightweightMonitor.js';
import { StandardMonitor, EnhancedCheckResult } from './StandardMonitor.js';
import { MonitoringLevel, PatrolUrl } from '../models/entities.js';

/**
 * 智能监控服务
 *
 * 功能：
 * 1. 自动检测网站类型（SPA/SSR/静态）
 * 2. 智能路由到合适的监控级别
 * 3. 双重确认机制（轻量级失败后升级到浏览器检查）
 *
 * 监控级别：
 * - LIGHTWEIGHT: HTTP 快速检查（适用于 60% 网站）
 * - STANDARD: HTTP + SSL + DNS（适用于 30% 网站）
 * - BROWSER: Playwright 完整测试（适用于 10% 网站）
 * - AUTO: 自动检测并选择合适级别
 */
export class MonitoringService {
  private lightweightMonitor = new LightweightMonitor();
  private standardMonitor = new StandardMonitor();

  // 自动检测缓存（避免重复检测）
  private detectionCache = new Map<string, { level: MonitoringLevel; timestamp: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

  /**
   * 智能监控路由
   *
   * @param urlConfig - 巡检 URL 配置
   * @returns 监控结果
   */
  async checkUrl(urlConfig: PatrolUrl): Promise<EnhancedCheckResult> {
    const level = urlConfig.monitoringLevel || MonitoringLevel.AUTO;

    // 自动判断级别
    if (level === MonitoringLevel.AUTO) {
      const detectedLevel = await this.detectLevel(urlConfig.url);
      console.log(`[MonitoringService] Auto-detected level for ${urlConfig.url}: ${detectedLevel}`);
      return this.executeCheck(urlConfig.url, detectedLevel);
    }

    return this.executeCheck(urlConfig.url, level);
  }

  /**
   * 自动判断监控级别
   *
   * 判断逻辑：
   * 1. 检查缓存（避免重复检测）
   * 2. 访问页面获取 HTML
   * 3. 分析页面结构判断类型：
   *    - SPA（React/Vue）且内容少 → BROWSER
   *    - SSR 或静态内容丰富 → STANDARD
   *    - 简单页面或检测失败 → LIGHTWEIGHT
   */
  private async detectLevel(url: string): Promise<MonitoringLevel> {
    // 检查缓存
    const cached = this.detectionCache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.level;
    }

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'AnkerWebSentinel/1.0 (Auto-Detector)'
        }
      });

      const html = String(response.data);
      const level = this.analyzePageType(html, url);

      // 缓存结果
      this.detectionCache.set(url, { level, timestamp: Date.now() });

      return level;

    } catch (error: any) {
      console.warn(`[MonitoringService] Detection failed for ${url}, defaulting to LIGHTWEIGHT`);
      // 检测失败，降级为轻量级
      return MonitoringLevel.LIGHTWEIGHT;
    }
  }

  /**
   * 分析页面类型
   */
  private analyzePageType(html: string, url: string): MonitoringLevel {
    // 判断 1: 是否是 SPA（React/Vue/Angular）
    const isSPA =
      html.includes('id="root"') ||
      html.includes('id="app"') ||
      html.includes('ng-app') ||
      /react/i.test(html) ||
      /vue/i.test(html) ||
      // 典型的 SPA 特征：主体是空 div + script
      /<div[^>]*>\s*<\/div>\s*<script/i.test(html);

    // 判断 2: 内容是否在 HTML 中（SSR 或静态页面）
    const hasContent =
      html.length > 3000 &&
      html.includes('<h1') &&
      (html.includes('<p') || html.includes('<article'));

    // 判断 3: 是否需要 JavaScript 渲染
    const requiresJS = !hasContent && isSPA;

    if (requiresJS) {
      console.log(`[MonitoringService] ${url} detected as SPA, requires BROWSER level`);
      return MonitoringLevel.BROWSER;
    }

    if (hasContent) {
      console.log(`[MonitoringService] ${url} detected as SSR/Static, using STANDARD level`);
      return MonitoringLevel.STANDARD;
    }

    console.log(`[MonitoringService] ${url} using LIGHTWEIGHT level (default)`);
    return MonitoringLevel.LIGHTWEIGHT;
  }

  /**
   * 执行监控检查
   */
  private async executeCheck(
    url: string,
    level: MonitoringLevel
  ): Promise<EnhancedCheckResult> {
    switch (level) {
      case MonitoringLevel.LIGHTWEIGHT:
        console.log(`[MonitoringService] Executing LIGHTWEIGHT check for ${url}`);
        return this.lightweightMonitor.check(url);

      case MonitoringLevel.STANDARD:
        console.log(`[MonitoringService] Executing STANDARD check for ${url}`);
        return this.standardMonitor.check(url, {
          checkSSL: url.startsWith('https://'),
          checkDNS: true
        });

      case MonitoringLevel.BROWSER:
        console.log(`[MonitoringService] BROWSER level requires full Playwright test`);
        // 返回一个标记，告诉调用者需要完整的浏览器测试
        return {
          status: 'degraded',
          responseTime: 0,
          warning: 'Requires full browser test'
        };

      default:
        return this.lightweightMonitor.check(url);
    }
  }

  /**
   * 清空检测缓存（用于重新检测所有页面）
   */
  clearDetectionCache(): void {
    this.detectionCache.clear();
    console.log('[MonitoringService] Detection cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number;
    levels: Record<MonitoringLevel, number>;
  } {
    const stats = {
      size: this.detectionCache.size,
      levels: {
        [MonitoringLevel.LIGHTWEIGHT]: 0,
        [MonitoringLevel.STANDARD]: 0,
        [MonitoringLevel.BROWSER]: 0,
        [MonitoringLevel.AUTO]: 0
      }
    };

    for (const { level } of this.detectionCache.values()) {
      stats.levels[level]++;
    }

    return stats;
  }
}

export default new MonitoringService();
