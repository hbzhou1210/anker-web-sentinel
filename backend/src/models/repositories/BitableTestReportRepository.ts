/**
 * 飞书多维表格测试报告 Repository
 *
 * 实现与 TestReportRepository 相同的接口,但使用飞书多维表格作为存储
 */

import feishuBitableService from '../../services/FeishuBitableService.js';
import { TestReport } from '../entities.js';
import { v4 as uuidv4 } from 'uuid';

interface CreateTestReportData {
  testRequestId: string;
  url: string;
  overallScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  testDuration: number;
}

export class BitableTestReportRepository {
  /**
   * 创建测试报告
   */
  async create(data: CreateTestReportData): Promise<TestReport> {
    // 生成 UUID 作为 ID
    const id = uuidv4();
    const completedAt = new Date();

    // 创建报告对象
    const report: TestReport = {
      id,
      testRequestId: data.testRequestId,
      url: data.url,
      overallScore: data.overallScore,
      totalChecks: data.totalChecks,
      passedChecks: data.passedChecks,
      failedChecks: data.failedChecks,
      warningChecks: data.warningChecks,
      testDuration: data.testDuration,
      completedAt,
      uiTestResults: [],
      performanceResults: [],
    };

    // 调用飞书服务创建记录
    // TODO: 需要在飞书记录中存储我们生成的 UUID
    const recordId = await feishuBitableService.createTestReport({
      ...report,
      // 添加 request_id 字段存储我们的 UUID
      requestId: id,
    });

    console.log(`[BitableRepo] Created test report with ID: ${id}, Record ID: ${recordId}`);

    return report;
  }

  /**
   * 根据 ID 查找测试报告 (ID 实际是 request_id)
   */
  async findById(id: string): Promise<TestReport | null> {
    console.log(`[BitableRepo] Finding test report by ID: ${id}`);
    return await feishuBitableService.getTestReport(id);
  }

  /**
   * 根据测试请求 ID 查找测试报告
   */
  async findByTestRequestId(testRequestId: string): Promise<TestReport | null> {
    console.log(`[BitableRepo] Finding test report by test request ID: ${testRequestId}`);
    return await feishuBitableService.getTestReport(testRequestId);
  }

  /**
   * 根据 URL 查找测试报告 (分页)
   */
  async findByUrl(url: string, limit = 30, offset = 0): Promise<TestReport[]> {
    console.log(`[BitableRepo] Finding test reports by URL: ${url}, limit: ${limit}, offset: ${offset}`);

    // 调用飞书服务查询记录
    const result = await feishuBitableService.listTestReports({
      limit,
      offset,
      url, // 按 URL 过滤
    });

    return result.reports;
  }

  /**
   * 查找所有测试报告 (分页)
   */
  async findAll(limit = 30, offset = 0): Promise<TestReport[]> {
    console.log(`[BitableRepo] Finding all test reports, limit: ${limit}, offset: ${offset}`);

    const result = await feishuBitableService.listTestReports({ limit, offset });
    return result.reports;
  }

  /**
   * 统计测试报告数量
   */
  async count(url?: string): Promise<number> {
    console.log(`[BitableRepo] Counting test reports${url ? ` for URL: ${url}` : ''}`);

    // 调用飞书服务查询总数
    const result = await feishuBitableService.listTestReports({
      limit: 1, // 只需要获取 total,不需要实际数据
      offset: 0,
      url,
    });

    return result.total;
  }
}

export default new BitableTestReportRepository();
