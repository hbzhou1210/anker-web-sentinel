/**
 * 配置类型定义
 *
 * 集中定义所有配置项的 TypeScript 类型
 */

/**
 * 应用配置
 */
export interface AppConfig {
  /** 环境: development, production, test */
  nodeEnv: 'development' | 'production' | 'test';
  /** 服务端口 */
  port: number;
  /** API 基础路径 */
  apiBasePath: string;
}

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  /** 存储类型 */
  storage: 'postgresql' | 'bitable';
  /** PostgreSQL 连接字符串 */
  postgresUrl?: string;
}

/**
 * 飞书配置
 */
export interface FeishuConfig {
  /** 飞书 App ID */
  appId: string;
  /** 飞书 App Secret */
  appSecret: string;
  /** 多维表格 App Token */
  bitableAppToken: string;
  /** 数据表 ID 映射 */
  tables: {
    testReports: string;
    responsiveTestResults: string;
    devicePresets: string;
    patrolTasks: string;
    patrolSchedules: string;
    patrolExecutions: string;
  };
}

/**
 * 浏览器配置
 */
export interface BrowserConfig {
  /** 浏览器池最大数量 */
  maxBrowsers: number;
  /** 浏览器空闲超时(毫秒) */
  idleTimeoutMs: number;
  /** 是否使用无头模式 */
  headless: boolean;
  /** 浏览器启动超时(毫秒) */
  launchTimeoutMs: number;
}

/**
 * Redis 配置
 */
export interface RedisConfig {
  /** Redis 主机 */
  host: string;
  /** Redis 端口 */
  port: number;
  /** Redis 密码 */
  password?: string;
  /** Redis 数据库编号 */
  db: number;
  /** 是否启用 TLS */
  tls: boolean;
}

/**
 * 邮件配置
 */
export interface EmailConfig {
  /** SMTP 主机 */
  smtpHost: string;
  /** SMTP 端口 */
  smtpPort: number;
  /** SMTP 用户名 */
  smtpUser: string;
  /** SMTP 密码 */
  smtpPassword: string;
  /** 发件人邮箱 */
  fromEmail: string;
  /** 发件人名称 */
  fromName: string;
  /** 是否使用 TLS */
  useTLS: boolean;
}

/**
 * 巡检配置
 */
export interface PatrolConfig {
  /** 最大并发 URL 测试数量 */
  maxConcurrentUrls: number;
  /** 默认超时时间(毫秒) */
  defaultTimeoutMs: number;
  /** 是否启用重试 */
  retryEnabled: boolean;
  /** 最大重试次数 */
  maxRetryAttempts: number;
  /** 重试延迟(毫秒) */
  retryDelayMs: number;
}

/**
 * 截图配置
 */
export interface ScreenshotConfig {
  /** 截图存储路径 */
  storagePath: string;
  /** 截图质量(0-100) */
  quality: number;
  /** 是否上传到飞书 */
  uploadToFeishu: boolean;
}

/**
 * 性能测试配置
 */
export interface PerformanceConfig {
  /** WebPageTest API Key */
  webPageTestApiKey?: string;
  /** WebPageTest API URL */
  webPageTestApiUrl: string;
}

/**
 * 完整应用配置
 */
export interface ApplicationConfig {
  app: AppConfig;
  database: DatabaseConfig;
  feishu: FeishuConfig;
  browser: BrowserConfig;
  redis: RedisConfig;
  email: EmailConfig;
  patrol: PatrolConfig;
  screenshot: ScreenshotConfig;
  performance: PerformanceConfig;
}
