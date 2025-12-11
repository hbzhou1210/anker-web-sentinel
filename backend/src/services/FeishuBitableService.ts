/**
 * 飞书多维表格服务
 *
 * 提供对飞书多维表格的 CRUD 操作封装
 * 使用 FeishuApiService 直接调用飞书 HTTP API
 */

import { FEISHU_BITABLE_CONFIG } from '../config/feishu-bitable.config.js';
import feishuApiService from './FeishuApiService.js';
import type { TestReport, ResponsiveTestResult, PatrolTask, PatrolExecution } from '../models/entities.js';

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

    // 将 TypeScript 对象转换为飞书字段格式
    const fields = {
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
      // 将测试结果序列化为 JSON 字符串存储
      ui_test_results: JSON.stringify(sanitizedUIResults),
      performance_results: JSON.stringify(sanitizedPerfResults),
    };

    console.log('[FeishuBitable] Creating test report with', sanitizedUIResults.length, 'UI results and', sanitizedPerfResults.length, 'performance results');

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
        page_size: 1,
      });

      if (!result.items || result.items.length === 0) {
        return null;
      }

      return this.mapBitableRecordToTestReport(result.items[0]);
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

      const reports = result.items?.map((item: any) => this.mapBitableRecordToTestReport(item)) || [];

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
  private mapBitableRecordToTestReport(record: any): TestReport {
    const fields = record.fields;

    // 辅助函数: 提取文本字段值
    const extractText = (field: any): string => {
      if (!field) return '';
      if (typeof field === 'string') return field;
      if (Array.isArray(field) && field.length > 0 && field[0].text) {
        return field[0].text;
      }
      return '';
    };

    // 解析 JSON 字符串格式的测试结果
    let uiTestResults: any[] = [];
    let performanceResults: any[] = [];

    try {
      if (fields.ui_test_results) {
        const jsonStr = extractText(fields.ui_test_results);
        if (jsonStr) {
          uiTestResults = JSON.parse(jsonStr);
          console.log('[FeishuBitable] Parsed', uiTestResults.length, 'UI test results');
        }
      }
    } catch (error) {
      console.error('[FeishuBitable] Failed to parse ui_test_results:', error);
    }

    try {
      if (fields.performance_results) {
        const jsonStr = extractText(fields.performance_results);
        if (jsonStr) {
          performanceResults = JSON.parse(jsonStr);
          console.log('[FeishuBitable] Parsed', performanceResults.length, 'performance results');
        }
      }
    } catch (error) {
      console.error('[FeishuBitable] Failed to parse performance_results:', error);
    }

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
      uiTestResults,
      performanceResults,
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
