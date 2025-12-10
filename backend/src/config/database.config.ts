/**
 * 数据库配置
 *
 * 用于控制使用哪种数据存储方式:
 * - PostgreSQL (传统数据库)
 * - Feishu Bitable (飞书多维表格)
 */

export const DATABASE_CONFIG = {
  /**
   * 数据存储类型
   * - 'postgresql': 使用 PostgreSQL 数据库
   * - 'bitable': 使用飞书多维表格
   */
  storage: (process.env.DATABASE_STORAGE || 'bitable') as 'postgresql' | 'bitable',
};

/**
 * 是否使用飞书多维表格
 */
export const useBitable = () => DATABASE_CONFIG.storage === 'bitable';

/**
 * 是否使用 PostgreSQL
 */
export const usePostgreSQL = () => DATABASE_CONFIG.storage === 'postgresql';
