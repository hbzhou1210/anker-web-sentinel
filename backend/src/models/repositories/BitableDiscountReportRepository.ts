/**
 * 飞书多维表格折扣规则报告 Repository
 *
 * 实现 IDiscountReportRepository 接口,使用飞书多维表格作为存储
 */

import feishuApiService from '../../services/FeishuApiService.js';
import cacheService from '../../services/CacheService.js';
import { FEISHU_BITABLE_CONFIG, FIELD_MAPPINGS } from '../../config/feishu-bitable.config.js';
import {
  DiscountReport,
  DiscountReportSummary,
  FindAllOptions,
  IDiscountReportRepository
} from '../interfaces/IDiscountReportRepository.js';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class BitableDiscountReportRepository implements IDiscountReportRepository {
  private readonly tableId = FEISHU_BITABLE_CONFIG.tables.discountRuleReports;
  private readonly CACHE_PREFIX = 'discount:report:';
  private readonly CACHE_TTL = 3600; // 1小时缓存
  private readonly COMPRESS_THRESHOLD = 5000; // 5KB 阈值

  /**
   * 从飞书富文本格式提取纯文本
   */
  private extractText(field: any): string {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (Array.isArray(field) && field.length > 0 && field[0].text) {
      return field[0].text;
    }
    return '';
  }

  /**
   * 压缩数据(如果超过阈值)
   */
  private async compressIfNeeded(data: any): Promise<string> {
    const jsonStr = JSON.stringify(data);

    // 如果数据小于阈值,直接返回 JSON 字符串
    if (jsonStr.length < this.COMPRESS_THRESHOLD) {
      return jsonStr;
    }

    // 压缩数据并转换为 base64
    const compressed = await gzip(Buffer.from(jsonStr, 'utf-8'));
    return `gzip:${compressed.toString('base64')}`;
  }

  /**
   * 解压缩数据
   */
  private async decompressIfNeeded(data: string): Promise<any> {
    if (!data) return null;

    // 检查是否是压缩数据
    if (data.startsWith('gzip:')) {
      const base64Data = data.slice(5);
      const compressed = Buffer.from(base64Data, 'base64');
      const decompressed = await gunzip(compressed);
      return JSON.parse(decompressed.toString('utf-8'));
    }

    // 未压缩,直接解析 JSON
    return JSON.parse(data);
  }

  /**
   * 将飞书记录转换为实体
   */
  private async recordToEntity(record: any): Promise<DiscountReport> {
    const fields = record.fields;
    const mapping = FIELD_MAPPINGS.discountRuleReports;

    const reportIdText = this.extractText(fields[mapping.reportId]);
    const typeText = this.extractText(fields[mapping.type]);
    const shopDomainText = this.extractText(fields[mapping.shopDomain]);
    const ruleIdsText = this.extractText(fields[mapping.ruleIds]);
    const summaryText = this.extractText(fields[mapping.summary]);
    const detailResultsText = this.extractText(fields[mapping.detailResults]);
    const statusText = this.extractText(fields[mapping.status]);
    const htmlReportUrlText = this.extractText(fields[mapping.htmlReportUrl]);

    return {
      recordId: record.record_id,
      reportId: reportIdText,
      type: typeText as 'single' | 'batch',
      shopDomain: shopDomainText,
      ruleIds: ruleIdsText ? JSON.parse(ruleIdsText) : [],
      createdAt: new Date(fields[mapping.createdAt]),
      summary: summaryText ? JSON.parse(summaryText) : {},
      detailResults: await this.decompressIfNeeded(detailResultsText),
      status: statusText as 'active' | 'inactive' | 'error',
      htmlReportUrl: htmlReportUrlText || undefined,
    };
  }

  /**
   * 将实体转换为飞书字段格式
   */
  private async entityToFields(report: DiscountReport): Promise<any> {
    const mapping = FIELD_MAPPINGS.discountRuleReports;

    return {
      [mapping.reportId]: report.reportId,
      [mapping.type]: report.type,
      [mapping.shopDomain]: report.shopDomain,
      [mapping.ruleIds]: JSON.stringify(report.ruleIds),
      [mapping.createdAt]: report.createdAt.getTime(),
      [mapping.summary]: JSON.stringify(report.summary),
      [mapping.detailResults]: await this.compressIfNeeded(report.detailResults),
      [mapping.status]: report.status,
      [mapping.htmlReportUrl]: report.htmlReportUrl || '',
    };
  }

  /**
   * 创建报告记录
   */
  async create(report: DiscountReport): Promise<DiscountReport> {
    if (!this.tableId) {
      throw new Error('FEISHU_TABLE_DISCOUNT_REPORTS 未配置,无法保存到 Bitable');
    }

    try {
      const fields = await this.entityToFields(report);
      const recordId = await feishuApiService.createRecord(this.tableId, fields);

      const createdReport: DiscountReport = {
        ...report,
        recordId,
      };

      // 写入缓存
      const cacheKey = `${this.CACHE_PREFIX}${report.reportId}`;
      await cacheService.set(cacheKey, createdReport, this.CACHE_TTL);

      console.log(`✓ 折扣规则报告已保存到 Bitable: ${report.reportId}`);
      return createdReport;
    } catch (error) {
      console.error('保存折扣规则报告到 Bitable 失败:', error);
      // 不抛出错误,因为 HTML 报告已经生成
      return report;
    }
  }

  /**
   * 根据报告 ID 查询
   */
  async findById(reportId: string): Promise<DiscountReport | null> {
    if (!this.tableId) {
      console.warn('FEISHU_TABLE_DISCOUNT_REPORTS 未配置');
      return null;
    }

    // 1. 尝试从缓存读取
    const cacheKey = `${this.CACHE_PREFIX}${reportId}`;
    const cached = await cacheService.get<DiscountReport>(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return cached;
    }

    // 2. 缓存未命中,查询飞书
    console.log(`[Cache MISS] ${cacheKey}`);
    const mapping = FIELD_MAPPINGS.discountRuleReports;

    try {
      const result = await feishuApiService.searchRecords(this.tableId, {
        filter: {
          conditions: [
            {
              field_name: mapping.reportId,
              operator: 'is',
              value: [reportId],
            },
          ],
          conjunction: 'and',
        },
        page_size: 1,
      });

      if (result.items.length === 0) {
        return null;
      }

      const report = await this.recordToEntity(result.items[0]);

      // 3. 写入缓存
      await cacheService.set(cacheKey, report, this.CACHE_TTL);

      return report;
    } catch (error) {
      console.error('从 Bitable 查询折扣报告失败:', error);
      return null;
    }
  }

  /**
   * 查询所有报告
   */
  async findAll(options?: FindAllOptions): Promise<{
    reports: DiscountReport[];
    total: number;
  }> {
    if (!this.tableId) {
      console.warn('FEISHU_TABLE_DISCOUNT_REPORTS 未配置');
      return { reports: [], total: 0 };
    }

    const mapping = FIELD_MAPPINGS.discountRuleReports;
    const searchParams: any = {
      page_size: options?.limit || 20,
      sort: [
        {
          field_name: mapping.createdAt,
          desc: true, // 按创建时间倒序
        },
      ],
    };

    // 构建筛选条件
    const conditions: any[] = [];

    if (options?.shopDomain) {
      conditions.push({
        field_name: mapping.shopDomain,
        operator: 'is',
        value: [options.shopDomain],
      });
    }

    if (options?.type) {
      conditions.push({
        field_name: mapping.type,
        operator: 'is',
        value: [options.type],
      });
    }

    // 只有有条件时才添加 filter
    if (conditions.length > 0) {
      searchParams.filter = {
        conditions,
        conjunction: 'and',
      };
    }

    try {
      const result = await feishuApiService.searchRecords(this.tableId, searchParams);

      let reports = await Promise.all(
        result.items.map((record: any) => this.recordToEntity(record))
      );

      // 应用偏移量
      const offset = options?.offset || 0;
      if (offset > 0) {
        reports = reports.slice(offset);
      }

      // 获取总数(这里简化处理,实际应该单独查询)
      const total = result.total || reports.length;

      return { reports, total };
    } catch (error) {
      console.error('从 Bitable 查询折扣报告列表失败:', error);
      return { reports: [], total: 0 };
    }
  }

  /**
   * 根据店铺域名查询
   */
  async findByShopDomain(shopDomain: string): Promise<DiscountReport[]> {
    const result = await this.findAll({ shopDomain, limit: 500 });
    return result.reports;
  }

  /**
   * 删除报告
   */
  async delete(reportId: string): Promise<boolean> {
    if (!this.tableId) {
      console.warn('FEISHU_TABLE_DISCOUNT_REPORTS 未配置');
      return false;
    }

    try {
      // 先查找记录
      const mapping = FIELD_MAPPINGS.discountRuleReports;
      const result = await feishuApiService.searchRecords(this.tableId, {
        filter: {
          conditions: [
            {
              field_name: mapping.reportId,
              operator: 'is',
              value: [reportId],
            },
          ],
          conjunction: 'and',
        },
        page_size: 1,
      });

      if (result.items.length === 0) {
        return false;
      }

      const recordId = result.items[0].record_id;

      // 删除记录
      await feishuApiService.deleteRecord(this.tableId, recordId);

      // 清除缓存
      const cacheKey = `${this.CACHE_PREFIX}${reportId}`;
      await cacheService.del(cacheKey);

      console.log(`✓ 折扣规则报告已删除: ${reportId}`);
      return true;
    } catch (error) {
      console.error('从 Bitable 删除折扣报告失败:', error);
      return false;
    }
  }
}

// 导出单例
export default new BitableDiscountReportRepository();
