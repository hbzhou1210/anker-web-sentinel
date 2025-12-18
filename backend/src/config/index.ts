/**
 * 配置模块统一导出
 *
 * 提供类型安全的配置访问接口
 */

// 导出配置服务
export { ConfigService, configService } from './ConfigService.js';

// 导出配置类型
export * from './types.js';

// 导出传统配置(兼容性)
export { FEISHU_BITABLE_CONFIG, FIELD_MAPPINGS } from './feishu-bitable.config.js';
export { DATABASE_CONFIG, useBitable, usePostgreSQL } from './database.config.js';
