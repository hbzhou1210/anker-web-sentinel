/**
 * 统一配置管理服务
 *
 * 提供类型安全的配置访问接口,集中管理所有配置项
 * 支持配置验证、默认值、环境变量覆盖
 */

import { ApplicationConfig } from './types.js';
import { ConfigValidationError } from '../errors/index.js';

/**
 * 配置管理服务
 */
export class ConfigService {
  private config: ApplicationConfig;

  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * 加载配置
   * 从环境变量和默认值构建完整配置
   */
  private loadConfiguration(): ApplicationConfig {
    return {
      app: {
        nodeEnv: (process.env.NODE_ENV as any) || 'development',
        port: parseInt(process.env.PORT || '3000', 10),
        apiBasePath: process.env.API_BASE_PATH || '/api/v1',
      },

      database: {
        storage: (process.env.DATABASE_STORAGE as any) || 'bitable',
        postgresUrl: process.env.DATABASE_URL,
      },

      feishu: {
        appId: process.env.FEISHU_APP_ID || '',
        appSecret: process.env.FEISHU_APP_SECRET || '',
        bitableAppToken: process.env.FEISHU_BITABLE_APP_TOKEN || 'X66Mb4mPRagcrSsBlRQcNrHQnKh',
        tables: {
          testReports: process.env.FEISHU_TABLE_TEST_REPORTS || 'tbllXmgEKdXOwFfE',
          responsiveTestResults: process.env.FEISHU_TABLE_RESPONSIVE_RESULTS || 'tbl8Qi8wNm8FRU4y',
          devicePresets: process.env.FEISHU_TABLE_DEVICE_PRESETS || 'tblmB4EAqP1Xbsnb',
          patrolTasks: process.env.FEISHU_TABLE_PATROL_TASKS || 'tblbvi9w4QU1LleK',
          patrolSchedules: process.env.FEISHU_TABLE_PATROL_SCHEDULES || 'tblIxfaEKRZSMksy',
          patrolExecutions: process.env.FEISHU_TABLE_PATROL_EXECUTIONS || 'tbleHxX6bYCwCuVW',
        },
      },

      browser: {
        maxBrowsers: parseInt(process.env.MAX_BROWSERS || '3', 10),
        idleTimeoutMs: parseInt(process.env.BROWSER_IDLE_TIMEOUT_MS || '60000', 10),
        headless: process.env.BROWSER_HEADLESS !== 'false',
        launchTimeoutMs: parseInt(process.env.BROWSER_LAUNCH_TIMEOUT_MS || '30000', 10),
      },

      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        tls: process.env.REDIS_TLS === 'true',
      },

      email: {
        smtpHost: process.env.SMTP_HOST || 'smtp.example.com',
        smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
        smtpUser: process.env.SMTP_USER || '',
        smtpPassword: process.env.SMTP_PASSWORD || '',
        fromEmail: process.env.EMAIL_FROM || 'noreply@example.com',
        fromName: process.env.EMAIL_FROM_NAME || 'Anita QA System',
        useTLS: process.env.SMTP_USE_TLS !== 'false',
      },

      patrol: {
        maxConcurrentUrls: parseInt(process.env.MAX_CONCURRENT_URLS || '3', 10),
        defaultTimeoutMs: parseInt(process.env.PATROL_TIMEOUT_MS || '120000', 10),
        retryEnabled: process.env.PATROL_RETRY_ENABLED !== 'false',
        maxRetryAttempts: parseInt(process.env.PATROL_MAX_RETRY_ATTEMPTS || '3', 10),
        retryDelayMs: parseInt(process.env.PATROL_RETRY_DELAY_MS || '2000', 10),
      },

      screenshot: {
        storagePath: process.env.SCREENSHOT_STORAGE_PATH || '/tmp/screenshots',
        quality: parseInt(process.env.SCREENSHOT_QUALITY || '80', 10),
        uploadToFeishu: process.env.SCREENSHOT_UPLOAD_TO_FEISHU !== 'false',
      },

      performance: {
        webPageTestApiKey: process.env.WEBPAGETEST_API_KEY,
        webPageTestApiUrl: process.env.WEBPAGETEST_API_URL || 'https://www.webpagetest.org',
      },
    };
  }

  /**
   * 验证配置
   * 检查必需的配置项是否存在
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // 验证飞书配置(如果使用 Bitable 存储)
    if (this.config.database.storage === 'bitable') {
      if (!this.config.feishu.appId) {
        errors.push('FEISHU_APP_ID is required when using Bitable storage');
      }
      if (!this.config.feishu.appSecret) {
        errors.push('FEISHU_APP_SECRET is required when using Bitable storage');
      }
      if (!this.config.feishu.bitableAppToken) {
        errors.push('FEISHU_BITABLE_APP_TOKEN is required when using Bitable storage');
      }
    }

    // 验证 PostgreSQL 配置(如果使用 PostgreSQL 存储)
    if (this.config.database.storage === 'postgresql') {
      if (!this.config.database.postgresUrl) {
        errors.push('DATABASE_URL is required when using PostgreSQL storage');
      }
    }

    // 验证端口号
    if (this.config.app.port < 1 || this.config.app.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    // 验证浏览器配置
    if (this.config.browser.maxBrowsers < 1) {
      errors.push('MAX_BROWSERS must be at least 1');
    }

    // 验证巡检配置
    if (this.config.patrol.maxConcurrentUrls < 1) {
      errors.push('MAX_CONCURRENT_URLS must be at least 1');
    }

    // 验证截图质量
    if (this.config.screenshot.quality < 0 || this.config.screenshot.quality > 100) {
      errors.push('SCREENSHOT_QUALITY must be between 0 and 100');
    }

    if (errors.length > 0) {
      throw new ConfigValidationError(
        `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
      );
    }
  }

  /**
   * 获取完整配置
   */
  getConfig(): Readonly<ApplicationConfig> {
    return this.config;
  }

  /**
   * 获取应用配置
   */
  getAppConfig(): Readonly<ApplicationConfig['app']> {
    return this.config.app;
  }

  /**
   * 获取数据库配置
   */
  getDatabaseConfig(): Readonly<ApplicationConfig['database']> {
    return this.config.database;
  }

  /**
   * 获取飞书配置
   */
  getFeishuConfig(): Readonly<ApplicationConfig['feishu']> {
    return this.config.feishu;
  }

  /**
   * 获取浏览器配置
   */
  getBrowserConfig(): Readonly<ApplicationConfig['browser']> {
    return this.config.browser;
  }

  /**
   * 获取 Redis 配置
   */
  getRedisConfig(): Readonly<ApplicationConfig['redis']> {
    return this.config.redis;
  }

  /**
   * 获取邮件配置
   */
  getEmailConfig(): Readonly<ApplicationConfig['email']> {
    return this.config.email;
  }

  /**
   * 获取巡检配置
   */
  getPatrolConfig(): Readonly<ApplicationConfig['patrol']> {
    return this.config.patrol;
  }

  /**
   * 获取截图配置
   */
  getScreenshotConfig(): Readonly<ApplicationConfig['screenshot']> {
    return this.config.screenshot;
  }

  /**
   * 获取性能测试配置
   */
  getPerformanceConfig(): Readonly<ApplicationConfig['performance']> {
    return this.config.performance;
  }

  /**
   * 检查是否使用 Bitable 存储
   */
  useBitable(): boolean {
    return this.config.database.storage === 'bitable';
  }

  /**
   * 检查是否使用 PostgreSQL 存储
   */
  usePostgreSQL(): boolean {
    return this.config.database.storage === 'postgresql';
  }

  /**
   * 检查是否为生产环境
   */
  isProduction(): boolean {
    return this.config.app.nodeEnv === 'production';
  }

  /**
   * 检查是否为开发环境
   */
  isDevelopment(): boolean {
    return this.config.app.nodeEnv === 'development';
  }

  /**
   * 检查是否为测试环境
   */
  isTest(): boolean {
    return this.config.app.nodeEnv === 'test';
  }

  /**
   * 打印配置摘要(隐藏敏感信息)
   */
  printConfigSummary(): void {
    console.log('\n=== Configuration Summary ===');
    console.log(`Environment: ${this.config.app.nodeEnv}`);
    console.log(`Port: ${this.config.app.port}`);
    console.log(`Storage: ${this.config.database.storage}`);
    console.log(`Redis: ${this.config.redis.host}:${this.config.redis.port}`);
    console.log(`Max Browsers: ${this.config.browser.maxBrowsers}`);
    console.log(`Max Concurrent URLs: ${this.config.patrol.maxConcurrentUrls}`);
    console.log(`Feishu App ID: ${this.config.feishu.appId ? 'SET' : 'NOT SET'}`);
    console.log(`Feishu App Secret: ${this.config.feishu.appSecret ? 'SET' : 'NOT SET'}`);
    console.log(`Email SMTP: ${this.config.email.smtpUser ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
    console.log(`WebPageTest API: ${this.config.performance.webPageTestApiKey ? 'SET' : 'NOT SET'}`);
    console.log('=============================\n');
  }
}

// 导出单例
export const configService = new ConfigService();
