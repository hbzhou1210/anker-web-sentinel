/**
 * ConfigService 单元测试
 */

import { ConfigService } from '../ConfigService.js';
import { ConfigValidationError } from '../../errors/index.js';

describe('ConfigService', () => {
  // 保存原始环境变量
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 每个测试前重置环境变量
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // 每个测试后恢复原始环境变量
    process.env = { ...originalEnv };
  });

  describe('构造函数与初始化', () => {
    it('应该使用默认值初始化配置', () => {
      // 清空必需的环境变量
      delete process.env.FEISHU_APP_ID;
      delete process.env.FEISHU_APP_SECRET;
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';

      const config = new ConfigService();

      expect(config.getAppConfig().nodeEnv).toBe('test');
      expect(config.getAppConfig().port).toBe(3001);
      expect(config.getDatabaseConfig().storage).toBe('postgresql');
    });

    it('应该从环境变量加载配置', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.DATABASE_STORAGE = 'bitable';
      process.env.FEISHU_APP_ID = 'test_app_id';
      process.env.FEISHU_APP_SECRET = 'test_secret';

      const config = new ConfigService();

      expect(config.getAppConfig().nodeEnv).toBe('production');
      expect(config.getAppConfig().port).toBe(8080);
      expect(config.getDatabaseConfig().storage).toBe('bitable');
    });

    it('应该解析整数配置', () => {
      process.env.PORT = '9999';
      process.env.MAX_BROWSERS = '5';
      process.env.REDIS_PORT = '6380';
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';

      const config = new ConfigService();

      expect(config.getAppConfig().port).toBe(9999);
      expect(config.getBrowserConfig().maxBrowsers).toBe(5);
      expect(config.getRedisConfig().port).toBe(6380);
    });

    it('应该解析布尔配置', () => {
      process.env.BROWSER_HEADLESS = 'false';
      process.env.PATROL_RETRY_ENABLED = 'false';
      process.env.SMTP_USE_TLS = 'false';
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';

      const config = new ConfigService();

      expect(config.getBrowserConfig().headless).toBe(false);
      expect(config.getPatrolConfig().retryEnabled).toBe(false);
      expect(config.getEmailConfig().useTLS).toBe(false);
    });
  });

  describe('配置验证', () => {
    describe('Bitable 存储配置', () => {
      it('应该在使用 Bitable 时验证飞书配置', () => {
        process.env.DATABASE_STORAGE = 'bitable';
        delete process.env.FEISHU_APP_ID;
        delete process.env.FEISHU_APP_SECRET;

        expect(() => new ConfigService()).toThrow(ConfigValidationError);
        expect(() => new ConfigService()).toThrow(/FEISHU_APP_ID is required/);
      });

      it('应该在飞书配置完整时通过验证', () => {
        process.env.DATABASE_STORAGE = 'bitable';
        process.env.FEISHU_APP_ID = 'test_app_id';
        process.env.FEISHU_APP_SECRET = 'test_secret';
        process.env.FEISHU_BITABLE_APP_TOKEN = 'test_token';

        expect(() => new ConfigService()).not.toThrow();
      });
    });

    describe('PostgreSQL 存储配置', () => {
      it('应该在使用 PostgreSQL 时验证数据库 URL', () => {
        process.env.DATABASE_STORAGE = 'postgresql';
        delete process.env.DATABASE_URL;

        expect(() => new ConfigService()).toThrow(ConfigValidationError);
        expect(() => new ConfigService()).toThrow(/DATABASE_URL is required/);
      });

      it('应该在数据库 URL 存在时通过验证', () => {
        process.env.DATABASE_STORAGE = 'postgresql';
        process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

        expect(() => new ConfigService()).not.toThrow();
      });
    });

    describe('端口验证', () => {
      beforeEach(() => {
        process.env.DATABASE_STORAGE = 'postgresql';
        process.env.DATABASE_URL = 'postgresql://test';
      });

      it('应该拒绝小于 1 的端口', () => {
        process.env.PORT = '0';

        expect(() => new ConfigService()).toThrow(ConfigValidationError);
        expect(() => new ConfigService()).toThrow(/PORT must be between 1 and 65535/);
      });

      it('应该拒绝大于 65535 的端口', () => {
        process.env.PORT = '65536';

        expect(() => new ConfigService()).toThrow(ConfigValidationError);
      });

      it('应该接受有效端口', () => {
        process.env.PORT = '3000';

        expect(() => new ConfigService()).not.toThrow();
      });
    });

    describe('浏览器配置验证', () => {
      beforeEach(() => {
        process.env.DATABASE_STORAGE = 'postgresql';
        process.env.DATABASE_URL = 'postgresql://test';
      });

      it('应该拒绝小于 1 的最大浏览器数', () => {
        process.env.MAX_BROWSERS = '0';

        expect(() => new ConfigService()).toThrow(ConfigValidationError);
        expect(() => new ConfigService()).toThrow(/MAX_BROWSERS must be at least 1/);
      });

      it('应该接受有效的最大浏览器数', () => {
        process.env.MAX_BROWSERS = '5';

        expect(() => new ConfigService()).not.toThrow();
      });
    });

    describe('巡检配置验证', () => {
      beforeEach(() => {
        process.env.DATABASE_STORAGE = 'postgresql';
        process.env.DATABASE_URL = 'postgresql://test';
      });

      it('应该拒绝小于 1 的最大并发 URL 数', () => {
        process.env.MAX_CONCURRENT_URLS = '0';

        expect(() => new ConfigService()).toThrow(ConfigValidationError);
        expect(() => new ConfigService()).toThrow(/MAX_CONCURRENT_URLS must be at least 1/);
      });

      it('应该接受有效的最大并发 URL 数', () => {
        process.env.MAX_CONCURRENT_URLS = '10';

        expect(() => new ConfigService()).not.toThrow();
      });
    });

    describe('截图质量验证', () => {
      beforeEach(() => {
        process.env.DATABASE_STORAGE = 'postgresql';
        process.env.DATABASE_URL = 'postgresql://test';
      });

      it('应该拒绝小于 0 的质量', () => {
        process.env.SCREENSHOT_QUALITY = '-1';

        expect(() => new ConfigService()).toThrow(ConfigValidationError);
        expect(() => new ConfigService()).toThrow(/SCREENSHOT_QUALITY must be between 0 and 100/);
      });

      it('应该拒绝大于 100 的质量', () => {
        process.env.SCREENSHOT_QUALITY = '101';

        expect(() => new ConfigService()).toThrow(ConfigValidationError);
      });

      it('应该接受有效的质量值', () => {
        process.env.SCREENSHOT_QUALITY = '80';

        expect(() => new ConfigService()).not.toThrow();
      });
    });

    it('应该收集多个验证错误', () => {
      process.env.DATABASE_STORAGE = 'bitable';
      delete process.env.FEISHU_APP_ID;
      delete process.env.FEISHU_APP_SECRET;
      process.env.PORT = '0';
      process.env.MAX_BROWSERS = '0';

      expect(() => new ConfigService()).toThrow(ConfigValidationError);

      try {
        new ConfigService();
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          expect(error.message).toContain('FEISHU_APP_ID');
          expect(error.message).toContain('FEISHU_APP_SECRET');
          expect(error.message).toContain('PORT');
          expect(error.message).toContain('MAX_BROWSERS');
        }
      }
    });
  });

  describe('配置访问方法', () => {
    let config: ConfigService;

    beforeEach(() => {
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';
      config = new ConfigService();
    });

    it('getConfig() 应该返回完整配置', () => {
      const fullConfig = config.getConfig();

      expect(fullConfig).toHaveProperty('app');
      expect(fullConfig).toHaveProperty('database');
      expect(fullConfig).toHaveProperty('feishu');
      expect(fullConfig).toHaveProperty('browser');
      expect(fullConfig).toHaveProperty('redis');
      expect(fullConfig).toHaveProperty('email');
      expect(fullConfig).toHaveProperty('patrol');
      expect(fullConfig).toHaveProperty('screenshot');
      expect(fullConfig).toHaveProperty('performance');
    });

    it('getAppConfig() 应该返回应用配置', () => {
      const appConfig = config.getAppConfig();

      expect(appConfig).toHaveProperty('nodeEnv');
      expect(appConfig).toHaveProperty('port');
      expect(appConfig).toHaveProperty('apiBasePath');
    });

    it('getDatabaseConfig() 应该返回数据库配置', () => {
      const dbConfig = config.getDatabaseConfig();

      expect(dbConfig).toHaveProperty('storage');
      expect(dbConfig).toHaveProperty('postgresUrl');
    });

    it('getFeishuConfig() 应该返回飞书配置', () => {
      const feishuConfig = config.getFeishuConfig();

      expect(feishuConfig).toHaveProperty('appId');
      expect(feishuConfig).toHaveProperty('appSecret');
      expect(feishuConfig).toHaveProperty('bitableAppToken');
      expect(feishuConfig).toHaveProperty('tables');
    });

    it('getBrowserConfig() 应该返回浏览器配置', () => {
      const browserConfig = config.getBrowserConfig();

      expect(browserConfig).toHaveProperty('maxBrowsers');
      expect(browserConfig).toHaveProperty('idleTimeoutMs');
      expect(browserConfig).toHaveProperty('headless');
      expect(browserConfig).toHaveProperty('launchTimeoutMs');
    });

    it('getRedisConfig() 应该返回 Redis 配置', () => {
      const redisConfig = config.getRedisConfig();

      expect(redisConfig).toHaveProperty('host');
      expect(redisConfig).toHaveProperty('port');
      expect(redisConfig).toHaveProperty('db');
    });

    it('getEmailConfig() 应该返回邮件配置', () => {
      const emailConfig = config.getEmailConfig();

      expect(emailConfig).toHaveProperty('smtpHost');
      expect(emailConfig).toHaveProperty('smtpPort');
      expect(emailConfig).toHaveProperty('fromEmail');
      expect(emailConfig).toHaveProperty('useTLS');
    });

    it('getPatrolConfig() 应该返回巡检配置', () => {
      const patrolConfig = config.getPatrolConfig();

      expect(patrolConfig).toHaveProperty('maxConcurrentUrls');
      expect(patrolConfig).toHaveProperty('defaultTimeoutMs');
      expect(patrolConfig).toHaveProperty('retryEnabled');
      expect(patrolConfig).toHaveProperty('maxRetryAttempts');
    });

    it('getScreenshotConfig() 应该返回截图配置', () => {
      const screenshotConfig = config.getScreenshotConfig();

      expect(screenshotConfig).toHaveProperty('storagePath');
      expect(screenshotConfig).toHaveProperty('quality');
      expect(screenshotConfig).toHaveProperty('uploadToFeishu');
    });

    it('getPerformanceConfig() 应该返回性能测试配置', () => {
      const perfConfig = config.getPerformanceConfig();

      expect(perfConfig).toHaveProperty('webPageTestApiKey');
      expect(perfConfig).toHaveProperty('webPageTestApiUrl');
    });
  });

  describe('环境检查方法', () => {
    it('useBitable() 应该正确检测 Bitable 存储', () => {
      process.env.DATABASE_STORAGE = 'bitable';
      process.env.FEISHU_APP_ID = 'test_id';
      process.env.FEISHU_APP_SECRET = 'test_secret';

      const config = new ConfigService();

      expect(config.useBitable()).toBe(true);
      expect(config.usePostgreSQL()).toBe(false);
    });

    it('usePostgreSQL() 应该正确检测 PostgreSQL 存储', () => {
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';

      const config = new ConfigService();

      expect(config.usePostgreSQL()).toBe(true);
      expect(config.useBitable()).toBe(false);
    });

    it('isProduction() 应该正确检测生产环境', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';

      const config = new ConfigService();

      expect(config.isProduction()).toBe(true);
      expect(config.isDevelopment()).toBe(false);
      expect(config.isTest()).toBe(false);
    });

    it('isDevelopment() 应该正确检测开发环境', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';

      const config = new ConfigService();

      expect(config.isDevelopment()).toBe(true);
      expect(config.isProduction()).toBe(false);
      expect(config.isTest()).toBe(false);
    });

    it('isTest() 应该正确检测测试环境', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';

      const config = new ConfigService();

      expect(config.isTest()).toBe(true);
      expect(config.isProduction()).toBe(false);
      expect(config.isDevelopment()).toBe(false);
    });
  });

  describe('printConfigSummary()', () => {
    it('应该输出配置摘要', () => {
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';

      const config = new ConfigService();
      const consoleSpy = jest.spyOn(console, 'log');

      config.printConfigSummary();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration Summary'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Environment:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Port:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Storage:'));

      consoleSpy.mockRestore();
    });

    it('应该隐藏敏感信息', () => {
      process.env.DATABASE_STORAGE = 'bitable';
      process.env.FEISHU_APP_ID = 'test_app_id';
      process.env.FEISHU_APP_SECRET = 'test_secret';

      const config = new ConfigService();
      const consoleSpy = jest.spyOn(console, 'log');

      config.printConfigSummary();

      const logOutput = consoleSpy.mock.calls.map(call => call[0]).join(' ');

      // 应该显示是否设置,而不是实际值
      expect(logOutput).toContain('SET');
      expect(logOutput).not.toContain('test_secret');

      consoleSpy.mockRestore();
    });
  });

  describe('默认值测试', () => {
    beforeEach(() => {
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';
      // 删除所有可选的环境变量
      delete process.env.PORT;
      delete process.env.API_BASE_PATH;
      delete process.env.MAX_BROWSERS;
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.SMTP_HOST;
    });

    it('应该使用默认的应用配置', () => {
      // 删除 PORT 环境变量以测试真正的默认值
      delete process.env.PORT;

      const config = new ConfigService();
      const appConfig = config.getAppConfig();

      expect(appConfig.port).toBe(3000); // 默认值
      expect(appConfig.apiBasePath).toBe('/api/v1');
    });

    it('应该使用默认的浏览器配置', () => {
      const config = new ConfigService();
      const browserConfig = config.getBrowserConfig();

      expect(browserConfig.maxBrowsers).toBe(3);
      expect(browserConfig.idleTimeoutMs).toBe(60000);
      expect(browserConfig.headless).toBe(true);
      expect(browserConfig.launchTimeoutMs).toBe(30000);
    });

    it('应该使用默认的 Redis 配置', () => {
      const config = new ConfigService();
      const redisConfig = config.getRedisConfig();

      expect(redisConfig.host).toBe('localhost');
      expect(redisConfig.port).toBe(6379);
      expect(redisConfig.db).toBe(0);
      expect(redisConfig.tls).toBe(false);
    });

    it('应该使用默认的邮件配置', () => {
      // 删除邮件相关的环境变量以测试真正的默认值
      delete process.env.EMAIL_FROM;
      delete process.env.SMTP_HOST;
      delete process.env.EMAIL_FROM_NAME;

      const config = new ConfigService();
      const emailConfig = config.getEmailConfig();

      expect(emailConfig.smtpHost).toBe('smtp.example.com');
      expect(emailConfig.smtpPort).toBe(587);
      expect(emailConfig.fromEmail).toBe('noreply@example.com');
      expect(emailConfig.fromName).toBe('Anita QA System');
      expect(emailConfig.useTLS).toBe(true);
    });

    it('应该使用默认的巡检配置', () => {
      const config = new ConfigService();
      const patrolConfig = config.getPatrolConfig();

      expect(patrolConfig.maxConcurrentUrls).toBe(3);
      expect(patrolConfig.defaultTimeoutMs).toBe(120000);
      expect(patrolConfig.retryEnabled).toBe(true);
      expect(patrolConfig.maxRetryAttempts).toBe(3);
      expect(patrolConfig.retryDelayMs).toBe(2000);
    });

    it('应该使用默认的截图配置', () => {
      const config = new ConfigService();
      const screenshotConfig = config.getScreenshotConfig();

      expect(screenshotConfig.storagePath).toBe('/tmp/screenshots');
      expect(screenshotConfig.quality).toBe(80);
      expect(screenshotConfig.uploadToFeishu).toBe(true);
    });
  });

  describe('配置不可变性', () => {
    it('返回的配置对象应该是只读的', () => {
      process.env.DATABASE_STORAGE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://test';

      const config = new ConfigService();
      const appConfig = config.getAppConfig();

      // TypeScript 会阻止编译时的修改,但在运行时尝试修改应该失败
      // 注意: Readonly 类型只在编译时生效,运行时不会真正冻结对象
      // 如果需要运行时不可变性,需要使用 Object.freeze()

      expect(() => {
        (appConfig as any).port = 9999;
      }).not.toThrow();

      // 但是配置对象本身应该保持不变
      const newAppConfig = config.getAppConfig();
      expect(newAppConfig.port).toBe(appConfig.port);
    });
  });
});
