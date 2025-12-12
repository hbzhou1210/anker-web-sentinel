/**
 * 飞书多维表格服务
 *
 * 提供对飞书多维表格的 CRUD 操作封装
 * 使用 FeishuApiService 直接调用飞书 HTTP API
 */

import { FEISHU_BITABLE_CONFIG } from '../config/feishu-bitable.config.js';
import feishuApiService from './FeishuApiService.js';
import type { TestReport, ResponsiveTestResult, PatrolTask, PatrolExecution } from '../models/entities.js';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

export interface BitableRecord {
  record_id?: string;
  fields: Record<string, any>;
}

/**
 * 清理 testResults,移除过大的 base64 数据
 * base64 图片数据太大(可能100KB+),存储在 Bitable 文本字段会导致 JSON 被截断
 */
function sanitizeTestResults(testResults: any[]): any[] {
  if (!Array.isArray(testResults)) return [];
  return testResults.map(result => {
    const sanitized = { ...result };
    // 移除 screenshotBase64,保留 screenshotUrl
    delete sanitized.screenshotBase64;
    return sanitized;
  });
}

/**
 * 压缩JSON数据为Base64字符串
 * 解决飞书文本字段长度限制问题(通常限制5000字符)
 */
async function compressJSON(data: any): Promise<string> {
  try {
    const jsonStr = JSON.stringify(data);
    const compressed = await gzipAsync(Buffer.from(jsonStr, 'utf-8'));
    return compressed.toString('base64');
  } catch (error) {
    console.error('[FeishuBitable] Failed to compress JSON:', error);
    return JSON.stringify(data); // 降级方案:返回原始JSON
  }
}

/**
 * 解压Base64字符串为JSON对象
 */
async function decompressJSON(compressedStr: string): Promise<any> {
  try {
    // 检查是否是压缩数据(Base64编码的gzip)
    if (!compressedStr || compressedStr.startsWith('[') || compressedStr.startsWith('{')) {
      // 旧数据或未压缩数据,直接解析JSON
      return JSON.parse(compressedStr || '[]');
    }

    const buffer = Buffer.from(compressedStr, 'base64');
    const decompressed = await gunzipAsync(buffer);
    return JSON.parse(decompressed.toString('utf-8'));
  } catch (error) {
    console.error('[FeishuBitable] Failed to decompress JSON:', error);
    // 降级方案:尝试直接解析
    try {
      return JSON.parse(compressedStr || '[]');
    } catch {
      return [];
    }
  }
}

export interface BitableSearchParams {
  filter?: {
    conjunction?: 'and' | 'or';
    conditions?: Array<{
      field_name: string;
      operator: string;
      value: any[];
    }>;
  };
  sort?: Array<{
    field_name: string;
    desc?: boolean;
  }>;
  field_names?: string[];
  page_size?: number;
  page_token?: string;
}

export class FeishuBitableService {
  private appToken: string;
  private tableIds: typeof FEISHU_BITABLE_CONFIG.tables;

  constructor() {
    this.appToken = FEISHU_BITABLE_CONFIG.appToken;
    this.tableIds = FEISHU_BITABLE_CONFIG.tables;
  }

  // ==================== 测试报告操作 ====================

  /**
   * 创建测试报告
   * @returns 飞书记录 ID (record_id)
   */
  async createTestReport(report: Omit<TestReport, 'id'> & { requestId?: string }): Promise<string> {
    // 清理测试结果,移除过大的 base64 数据
    const sanitizedUIResults = sanitizeTestResults(report.uiTestResults || []);
    const sanitizedPerfResults = sanitizeTestResults(report.performanceResults || []);

    // 压缩测试结果数据
    const compressedUIResults = await compressJSON(sanitizedUIResults);
    const compressedPerfResults = await compressJSON(sanitizedPerfResults);

    // 压缩渲染截图数据(现在包含 image_key 而非 base64,数据很小)
    const compressedRenderingSnapshots = await compressJSON(report.renderingSnapshots || []);

    // 压缩 PageSpeed 数据
    const compressedPageSpeedData = report.pageSpeedData ? await compressJSON(report.pageSpeedData) : undefined;

    // 压缩 WebPageTest 完整数据
    const compressedWebPageTestData = report.webPageTestData ? await compressJSON(report.webPageTestData) : undefined;

    console.log('[FeishuBitable] Creating test report with', sanitizedUIResults.length, 'UI results and', sanitizedPerfResults.length, 'performance results');
    console.log('[FeishuBitable] Rendering snapshots:', report.renderingSnapshots?.length || 0, 'snapshots (stored as image_keys)');
    console.log('[FeishuBitable] Performance test mode:', report.performanceTestMode || 'webpagetest');
    console.log('[FeishuBitable] Has PageSpeed data:', !!report.pageSpeedData);
    console.log('[FeishuBitable] Has WebPageTest data:', !!report.webPageTestData);
    console.log('[FeishuBitable] Compressed sizes: UI', compressedUIResults.length, 'chars, Perf', compressedPerfResults.length, 'chars, Rendering', compressedRenderingSnapshots.length, 'chars');
    console.log('[FeishuBitable] Compressed WebPageTest data:', compressedWebPageTestData ? `${compressedWebPageTestData.length} chars` : 'undefined');

    // 将 TypeScript 对象转换为飞书字段格式
    const fields: Record<string, any> = {
      url: report.url,
      overall_score: report.overallScore,
      total_checks: report.totalChecks,
      passed_checks: report.passedChecks,
      failed_checks: report.failedChecks,
      warning_checks: report.warningChecks,
      test_duration: report.testDuration,
      completed_at: report.completedAt ? new Date(report.completedAt).getTime() : Date.now(),
      status: 'completed',  // 默认状态
      request_id: report.requestId || report.testRequestId,  // 存储 UUID
      performance_test_mode: report.performanceTestMode || 'webpagetest',
      // 将测试结果压缩后存储 (gzip + base64编码)
      ui_test_results: compressedUIResults,
      performance_results: compressedPerfResults,
      rendering_snapshots: compressedRenderingSnapshots,
    };

    // 只在有 PageSpeed 数据时添加该字段
    if (compressedPageSpeedData) {
      fields.pagespeed_data = compressedPageSpeedData;
    }

    // 只在有 WebPageTest 完整数据时添加该字段
    if (compressedWebPageTestData) {
      fields.webpagetest_data = compressedWebPageTestData;
      console.log('[FeishuBitable] Added webpagetest_data to fields:', compressedWebPageTestData.substring(0, 100));
    } else {
      console.log('[FeishuBitable] No WebPageTest data to add to fields');
    }

    console.log('[FeishuBitable] Final fields keys:', Object.keys(fields));

    try {
      const recordId = await feishuApiService.createRecord(this.tableIds.testReports, fields);
      console.log('[FeishuBitable] Test report created with record ID:', recordId);
      return recordId;
    } catch (error) {
      console.error('[FeishuBitable] Failed to create test report:', error);
      throw error;
    }
  }

  /**
   * 根据 request_id 获取测试报告
   */
  async getTestReport(requestId: string): Promise<TestReport | null> {
    console.log('[FeishuBitable] Getting test report by request_id:', requestId);

    try {
      const result = await feishuApiService.searchRecords(this.tableIds.testReports, {
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: 'request_id',
              operator: 'is',
              value: [requestId],
            },
          ],
        },
        field_names: [
          'request_id',
          'url',
          'overall_score',
          'total_checks',
          'passed_checks',
          'failed_checks',
          'warning_checks',
          'test_duration',
          'completed_at',
          'status',
          'performance_test_mode',
          'ui_test_results',
          'performance_results',
          'rendering_snapshots',
          'pagespeed_data',
          'webpagetest_data',
        ],
        page_size: 1,
      });

      if (!result.items || result.items.length === 0) {
        return null;
      }

      return await this.mapBitableRecordToTestReport(result.items[0]);
    } catch (error) {
      console.error('[FeishuBitable] Failed to get test report:', error);
      return null;
    }
  }

  /**
   * 列出测试报告
   */
  async listTestReports(params: { limit?: number; offset?: number; url?: string } = {}): Promise<{
    reports: TestReport[];
    total: number;
  }> {
    const { limit = 10, offset = 0, url } = params;

    console.log('[FeishuBitable] Listing test reports:', { limit, offset, url });

    try {
      const searchParams: BitableSearchParams = {
        sort: [{ field_name: 'completed_at', desc: true }],
        page_size: limit,
        // 注意: 飞书使用 page_token 而不是 offset
        // 这里需要实现分页逻辑
      };

      // 如果指定了 URL,添加过滤条件
      if (url) {
        searchParams.filter = {
          conjunction: 'and',
          conditions: [
            {
              field_name: 'url',
              operator: 'is',
              value: [url],
            },
          ],
        };
      }

      const result = await feishuApiService.searchRecords(this.tableIds.testReports, searchParams);

      const reports = await Promise.all(
        result.items?.map((item: any) => this.mapBitableRecordToTestReport(item)) || []
      );

      return {
        reports,
        total: result.total || 0,
      };
    } catch (error) {
      console.error('[FeishuBitable] Failed to list test reports:', error);
      return {
        reports: [],
        total: 0,
      };
    }
  }

  /**
   * 将飞书记录转换为 TestReport 实体
   */
  private async mapBitableRecordToTestReport(record: any): Promise<TestReport> {
    const fields = record.fields;
    console.log('[FeishuBitable] Record fields:', Object.keys(fields));
    console.log('[FeishuBitable] Has rendering_snapshots field:', !!fields.rendering_snapshots);

    // 辅助函数: 提取文本字段值
    const extractText = (field: any): string => {
      if (!field) return '';
      if (typeof field === 'string') return field;
      if (Array.isArray(field) && field.length > 0 && field[0].text) {
        return field[0].text;
      }
      return '';
    };

    // 解析并解压测试结果数据
    let uiTestResults: any[] = [];
    let performanceResults: any[] = [];
    let renderingSnapshots: any[] = [];
    let pageSpeedData: any = undefined;
    let webPageTestData: any = undefined;

    try {
      if (fields.ui_test_results) {
        const compressedStr = extractText(fields.ui_test_results);
        if (compressedStr) {
          uiTestResults = await decompressJSON(compressedStr);
          console.log('[FeishuBitable] Decompressed', uiTestResults.length, 'UI test results');
        }
      }
    } catch (error) {
      console.error('[FeishuBitable] Failed to decompress ui_test_results:', error);
    }

    try {
      if (fields.performance_results) {
        const compressedStr = extractText(fields.performance_results);
        if (compressedStr) {
          performanceResults = await decompressJSON(compressedStr);
          console.log('[FeishuBitable] Decompressed', performanceResults.length, 'performance results');
        }
      }
    } catch (error) {
      console.error('[FeishuBitable] Failed to decompress performance_results:', error);
    }

    try {
      if (fields.rendering_snapshots) {
        const compressedStr = extractText(fields.rendering_snapshots);
        if (compressedStr) {
          renderingSnapshots = await decompressJSON(compressedStr);
          console.log('[FeishuBitable] Decompressed', renderingSnapshots.length, 'rendering snapshots');
        }
      }
    } catch (error) {
      console.error('[FeishuBitable] Failed to decompress rendering_snapshots:', error);
    }

    try {
      if (fields.pagespeed_data) {
        const compressedStr = extractText(fields.pagespeed_data);
        if (compressedStr) {
          pageSpeedData = await decompressJSON(compressedStr);
          console.log('[FeishuBitable] Decompressed PageSpeed data');
        }
      }
    } catch (error) {
      console.error('[FeishuBitable] Failed to decompress pagespeed_data:', error);
    }

    try {
      console.log('[FeishuBitable] Checking webpagetest_data field:', {
        exists: !!fields.webpagetest_data,
        type: typeof fields.webpagetest_data,
        value: fields.webpagetest_data ?
          (typeof fields.webpagetest_data === 'string' ?
            fields.webpagetest_data.substring(0, 100) :
            JSON.stringify(fields.webpagetest_data).substring(0, 100)) :
          'null'
      });

      if (fields.webpagetest_data) {
        const compressedStr = extractText(fields.webpagetest_data);
        console.log('[FeishuBitable] Extracted compressed string:', {
          exists: !!compressedStr,
          length: compressedStr?.length || 0,
          preview: compressedStr?.substring(0, 100)
        });

        if (compressedStr) {
          webPageTestData = await decompressJSON(compressedStr);
          console.log('[FeishuBitable] Decompressed WebPageTest data:', {
            success: !!webPageTestData,
            hasTestId: !!webPageTestData?.testId,
            hasVideoFrames: webPageTestData?.videoFrames?.length || 0,
            hasMetrics: !!webPageTestData?.metrics
          });
        }
      }
    } catch (error) {
      console.error('[FeishuBitable] Failed to decompress webpagetest_data:', error);
    }

    const performanceTestMode = extractText(fields.performance_test_mode) || 'webpagetest';

    return {
      id: extractText(fields.request_id),
      testRequestId: extractText(fields.request_id),
      url: extractText(fields.url),
      overallScore: fields.overall_score || 0,
      totalChecks: fields.total_checks || 0,
      passedChecks: fields.passed_checks || 0,
      failedChecks: fields.failed_checks || 0,
      warningChecks: fields.warning_checks || 0,
      testDuration: fields.test_duration || 0,
      completedAt: new Date(fields.completed_at),
      performanceTestMode: performanceTestMode as any,
      uiTestResults,
      performanceResults,
      renderingSnapshots,
      pageSpeedData,
      webPageTestData,
    };
  }

  // ==================== 响应式测试结果操作 ====================

  /**
   * 批量创建响应式测试结果
   */
  async createResponsiveTestResults(results: Omit<ResponsiveTestResult, 'id'>[]): Promise<void> {
    console.log('[FeishuBitable] Creating responsive test results:', results.length);

    const records = results.map((result) => ({
      fields: {
        test_report_id: result.testReportId,
        device_name: result.deviceName,
        device_type: result.deviceType,
        viewport_width: result.viewportWidth,
        viewport_height: result.viewportHeight,
        has_horizontal_scroll: result.hasHorizontalScroll,
        has_viewport_meta: result.hasViewportMeta,
        font_size_readable: result.fontSizeReadable,
        touch_targets_adequate: result.touchTargetsAdequate,
        images_responsive: result.imagesResponsive,
        screenshot_portrait_url: result.screenshotPortraitUrl
          ? { text: 'Portrait', link: result.screenshotPortraitUrl }
          : undefined,
        screenshot_landscape_url: result.screenshotLandscapeUrl
          ? { text: 'Landscape', link: result.screenshotLandscapeUrl }
          : undefined,
        issues: JSON.stringify(result.issues || []),
        test_duration: result.testDuration,
      },
    }));

    try {
      await feishuApiService.batchCreateRecords(this.tableIds.responsiveTestResults, records);
      console.log('[FeishuBitable] Created', records.length, 'responsive test results');
    } catch (error) {
      console.error('[FeishuBitable] Failed to create responsive test results:', error);
      throw error;
    }
  }

  /**
   * 获取指定报告的响应式测试结果
   */
  async getResponsiveTestResults(reportId: string): Promise<ResponsiveTestResult[]> {
    console.log('[FeishuBitable] Getting responsive test results for report:', reportId);

    try {
      const result = await feishuApiService.searchRecords(this.tableIds.responsiveTestResults, {
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: 'test_report_id',
              operator: 'is',
              value: [reportId],
            },
          ],
        },
      });

      // TODO: 实现记录到实体的映射
      return [];
    } catch (error) {
      console.error('[FeishuBitable] Failed to get responsive test results:', error);
      return [];
    }
  }

  // ==================== 巡检任务操作 ====================

  /**
   * 创建巡检任务
   */
  async createPatrolTask(task: Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    console.log('[FeishuBitable] Creating patrol task:', task.name);

    const fields = {
      name: task.name,
      description: task.description || '',
      urls: JSON.stringify(task.urls),
      config: JSON.stringify(task.config || {}),
      notification_emails: task.notificationEmails?.join(',') || '',
      enabled: task.enabled,
    };

    try {
      const recordId = await feishuApiService.createRecord(this.tableIds.patrolTasks, fields);
      console.log('[FeishuBitable] Created patrol task with ID:', recordId);
      return recordId;
    } catch (error) {
      console.error('[FeishuBitable] Failed to create patrol task:', error);
      throw error;
    }
  }

  /**
   * 获取所有巡检任务
   */
  async getPatrolTasks(): Promise<PatrolTask[]> {
    console.log('[FeishuBitable] Getting all patrol tasks');

    try {
      const result = await feishuApiService.searchRecords(this.tableIds.patrolTasks, {
        page_size: 100,
      });

      // TODO: 实现记录到实体的映射
      return [];
    } catch (error) {
      console.error('[FeishuBitable] Failed to get patrol tasks:', error);
      return [];
    }
  }

  /**
   * 更新巡检任务
   */
  async updatePatrolTask(id: string, updates: Partial<PatrolTask>): Promise<void> {
    console.log('[FeishuBitable] Updating patrol task:', id);

    const fields: Record<string, any> = {};

    if (updates.name !== undefined) fields.name = updates.name;
    if (updates.description !== undefined) fields.description = updates.description;
    if (updates.urls !== undefined) fields.urls = JSON.stringify(updates.urls);
    if (updates.config !== undefined) fields.config = JSON.stringify(updates.config);
    if (updates.notificationEmails !== undefined) {
      fields.notification_emails = updates.notificationEmails.join(',');
    }
    if (updates.enabled !== undefined) fields.enabled = updates.enabled;

    try {
      await feishuApiService.updateRecord(this.tableIds.patrolTasks, id, fields);
      console.log('[FeishuBitable] Updated patrol task');
    } catch (error) {
      console.error('[FeishuBitable] Failed to update patrol task:', error);
      throw error;
    }
  }

  // ==================== 巡检执行记录操作 ====================

  /**
   * 创建巡检执行记录
   */
  async createPatrolExecution(execution: Omit<PatrolExecution, 'id'>): Promise<string> {
    console.log('[FeishuBitable] Creating patrol execution for task:', execution.patrolTaskId);

    const fields = {
      patrol_task_id: execution.patrolTaskId,
      status: execution.status,
      started_at: execution.startedAt ? new Date(execution.startedAt).getTime() : undefined,
      completed_at: execution.completedAt ? new Date(execution.completedAt).getTime() : undefined,
      total_urls: execution.totalUrls || 0,
      passed_urls: execution.passedUrls || 0,
      failed_urls: execution.failedUrls || 0,
      test_results: JSON.stringify(sanitizeTestResults(execution.testResults || [])),
      email_sent: execution.emailSent || false,
      email_sent_at: execution.emailSentAt ? new Date(execution.emailSentAt).getTime() : undefined,
      error_message: execution.errorMessage || '',
      duration_ms: execution.durationMs || 0,
    };

    try {
      const recordId = await feishuApiService.createRecord(this.tableIds.patrolExecutions, fields);
      console.log('[FeishuBitable] Created patrol execution with ID:', recordId);
      return recordId;
    } catch (error) {
      console.error('[FeishuBitable] Failed to create patrol execution:', error);
      throw error;
    }
  }

  /**
   * 获取巡检执行记录
   */
  async getPatrolExecutions(params: {
    taskId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    executions: PatrolExecution[];
    total: number;
  }> {
    const { taskId, limit = 10, offset = 0 } = params;

    console.log('[FeishuBitable] Getting patrol executions:', { taskId, limit, offset });

    try {
      const searchParams: any = {
        page_size: limit,
        sort: [{ field_name: 'started_at', desc: true }],
      };

      if (taskId) {
        searchParams.filter = {
          conjunction: 'and',
          conditions: [
            {
              field_name: 'patrol_task_id',
              operator: 'is',
              value: [taskId],
            },
          ],
        };
      }

      const result = await feishuApiService.searchRecords(this.tableIds.patrolExecutions, searchParams);

      // TODO: 实现记录到实体的映射
      return {
        executions: [],
        total: result.total || 0,
      };
    } catch (error) {
      console.error('[FeishuBitable] Failed to get patrol executions:', error);
      return {
        executions: [],
        total: 0,
      };
    }
  }

  /**
   * 更新巡检执行记录
   */
  async updatePatrolExecution(id: string, updates: Partial<PatrolExecution>): Promise<void> {
    console.log('[FeishuBitable] Updating patrol execution:', id);

    const fields: Record<string, any> = {};

    if (updates.status !== undefined) fields.status = updates.status;
    if (updates.completedAt !== undefined) {
      fields.completed_at = new Date(updates.completedAt).getTime();
    }
    if (updates.totalUrls !== undefined) fields.total_urls = updates.totalUrls;
    if (updates.passedUrls !== undefined) fields.passed_urls = updates.passedUrls;
    if (updates.failedUrls !== undefined) fields.failed_urls = updates.failedUrls;
    if (updates.testResults !== undefined) {
      fields.test_results = JSON.stringify(sanitizeTestResults(updates.testResults));
    }
    if (updates.emailSent !== undefined) fields.email_sent = updates.emailSent;
    if (updates.emailSentAt !== undefined) {
      fields.email_sent_at = new Date(updates.emailSentAt).getTime();
    }
    if (updates.errorMessage !== undefined) fields.error_message = updates.errorMessage;
    if (updates.durationMs !== undefined) fields.duration_ms = updates.durationMs;

    try {
      await feishuApiService.updateRecord(this.tableIds.patrolExecutions, id, fields);
      console.log('[FeishuBitable] Updated patrol execution');
    } catch (error) {
      console.error('[FeishuBitable] Failed to update patrol execution:', error);
      throw error;
    }
  }
}

// 导出单例
export default new FeishuBitableService();
