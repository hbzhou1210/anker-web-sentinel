/**
 * 折扣规则报告 Repository 接口
 *
 * 用于统一管理折扣规则查询结果的存储
 * 支持单规则查询和批量查询两种类型
 */

/**
 * 折扣规则查询摘要统计
 */
export interface DiscountReportSummary {
  // 单规则查询摘要
  ruleId?: number;
  status?: 'active' | 'inactive' | 'error';
  totalVariants?: number;
  activeVariants?: number;
  inactiveVariants?: number;
  errorVariants?: number;

  // 批量查询摘要
  totalRules?: number;
  activeRules?: number;
  inactiveRules?: number;
  errorRules?: number;
}

/**
 * 折扣规则查询报告实体
 */
export interface DiscountReport {
  recordId?: string;              // Bitable 记录 ID
  reportId: string;                // 报告 ID (timestamp)
  type: 'single' | 'batch';        // 报告类型
  shopDomain: string;              // 店铺域名
  ruleIds: number[];               // 查询的规则 ID 列表
  createdAt: Date;                 // 创建时间
  summary: DiscountReportSummary;  // 摘要统计
  detailResults: any;              // 详细结果数据
  status: 'active' | 'inactive' | 'error';  // 总体状态
  htmlReportUrl?: string;          // HTML 报告链接(向后兼容)
}

/**
 * 查询选项
 */
export interface FindAllOptions {
  limit?: number;          // 每页数量
  offset?: number;         // 偏移量
  shopDomain?: string;     // 按店铺域名过滤
  type?: 'single' | 'batch';  // 按报告类型过滤
}

/**
 * 折扣规则报告 Repository 接口
 */
export interface IDiscountReportRepository {
  /**
   * 创建报告记录
   * @param report 报告实体
   * @returns 创建后的报告(包含 recordId)
   */
  create(report: DiscountReport): Promise<DiscountReport>;

  /**
   * 根据报告 ID 查询
   * @param reportId 报告 ID
   * @returns 报告实体,不存在则返回 null
   */
  findById(reportId: string): Promise<DiscountReport | null>;

  /**
   * 查询所有报告
   * @param options 查询选项(分页、过滤等)
   * @returns 报告列表和总数
   */
  findAll(options?: FindAllOptions): Promise<{
    reports: DiscountReport[];
    total: number;
  }>;

  /**
   * 根据店铺域名查询
   * @param shopDomain 店铺域名
   * @returns 该店铺的所有报告
   */
  findByShopDomain(shopDomain: string): Promise<DiscountReport[]>;

  /**
   * 删除报告
   * @param reportId 报告 ID
   * @returns 是否删除成功
   */
  delete(reportId: string): Promise<boolean>;
}
