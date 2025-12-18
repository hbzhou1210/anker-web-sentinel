/**
 * Jest 测试设置文件
 *
 * 在所有测试之前运行,设置全局测试环境
 */

// 扩展 Jest 匹配器超时
jest.setTimeout(10000);

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // 使用不同的端口避免冲突
process.env.DATABASE_STORAGE = 'bitable';
process.env.FEISHU_APP_ID = 'test_app_id';
process.env.FEISHU_APP_SECRET = 'test_app_secret';
process.env.FEISHU_BITABLE_APP_TOKEN = 'test_bitable_token';
process.env.MAX_BROWSERS = '2';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.EMAIL_FROM = 'test@example.com';

// Mock console 方法以避免测试输出污染
// 但在测试失败时仍然显示
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  // 保留 warn 和 error,因为它们可能很重要
  // warn: jest.fn(),
  // error: jest.fn(),
};

// 全局测试清理
afterEach(() => {
  // 清理所有 mock
  jest.clearAllMocks();
});
