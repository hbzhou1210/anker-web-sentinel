/**
 * 飞书多维表格巡检执行记录 Repository
 *
 * 实现与 PatrolExecutionRepository 相同的接口,但使用飞书多维表格作为存储
 */

import feishuApiService from '../../services/FeishuApiService.js';
import { FEISHU_BITABLE_CONFIG } from '../../config/feishu-bitable.config.js';
import { PatrolExecution, PatrolExecutionStatus } from '../entities.js';
import { v4 as uuidv4 } from 'uuid';

export class BitablePatrolExecutionRepository {
  private readonly tableId = FEISHU_BITABLE_CONFIG.tables.patrolExecutions;

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
   * 将飞书记录转换为实体
   */
  private recordToEntity(record: any): PatrolExecution {
    const fields = record.fields;

    const idText = this.extractText(fields.id);
    const taskIdText = this.extractText(fields.patrol_task_id);
    const statusText = this.extractText(fields.status);
    const testResultsText = this.extractText(fields.test_results);
    const errorText = this.extractText(fields.error_message);

    return {
      id: idText,
      patrolTaskId: taskIdText,
      status: statusText as PatrolExecutionStatus,
      startedAt: new Date(fields.started_at),
      completedAt: fields.completed_at ? new Date(fields.completed_at) : undefined,
      totalUrls: fields.total_urls || 0,
      passedUrls: fields.passed_urls || 0,
      failedUrls: fields.failed_urls || 0,
      testResults: testResultsText ? JSON.parse(testResultsText) : [],
      emailSent: fields.email_sent === true,
      emailSentAt: fields.email_sent_at ? new Date(fields.email_sent_at) : undefined,
      errorMessage: errorText || undefined,
      durationMs: fields.duration_ms || undefined,
    };
  }

  /**
   * 创建执行记录
   */
  async create(execution: Omit<PatrolExecution, 'id'>): Promise<PatrolExecution> {
    const id = uuidv4();

    const fields = {
      id,
      patrol_task_id: execution.patrolTaskId,
      status: execution.status,
      started_at: execution.startedAt.getTime(),
      completed_at: execution.completedAt ? execution.completedAt.getTime() : null,
      total_urls: execution.totalUrls,
      passed_urls: execution.passedUrls,
      failed_urls: execution.failedUrls,
      test_results: JSON.stringify(execution.testResults),
      email_sent: execution.emailSent,
      email_sent_at: execution.emailSentAt ? execution.emailSentAt.getTime() : null,
      error_message: execution.errorMessage || '',
      duration_ms: execution.durationMs || null,
    };

    await feishuApiService.createRecord(this.tableId, fields);

    return {
      id,
      ...execution,
    };
  }

  /**
   * 根据 ID 获取执行记录
   */
  async findById(id: string): Promise<PatrolExecution | null> {
    const result = await feishuApiService.searchRecords(this.tableId, {
      filter: {
        conditions: [
          {
            field_name: 'id',
            operator: 'is',
            value: [id],
          },
        ],
        conjunction: 'and',
      },
      page_size: 1,
    });

    if (result.items.length === 0) {
      return null;
    }

    return this.recordToEntity(result.items[0]);
  }

  /**
   * 根据任务 ID 获取执行历史
   */
  async findByTaskId(taskId: string, limit: number = 50): Promise<PatrolExecution[]> {
    const result = await feishuApiService.searchRecords(this.tableId, {
      filter: {
        conditions: [
          {
            field_name: 'patrol_task_id',
            operator: 'is',
            value: [taskId],
          },
        ],
        conjunction: 'and',
      },
      page_size: limit,
    });

    return result.items
      .map((record: any) => this.recordToEntity(record))
      .sort((a: PatrolExecution, b: PatrolExecution) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * 获取所有执行记录
   */
  async findAll(limit: number = 100): Promise<PatrolExecution[]> {
    const result = await feishuApiService.searchRecords(this.tableId, {
      page_size: limit,
    });

    return result.items
      .map((record: any) => this.recordToEntity(record))
      .sort((a: PatrolExecution, b: PatrolExecution) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * 更新执行记录
   */
  async update(id: string, updates: Partial<Omit<PatrolExecution, 'id' | 'patrolTaskId' | 'startedAt'>>): Promise<PatrolExecution | null> {
    // 先查找记录
    const existingResult = await feishuApiService.searchRecords(this.tableId, {
      filter: {
        conditions: [
          {
            field_name: 'id',
            operator: 'is',
            value: [id],
          },
        ],
        conjunction: 'and',
      },
      page_size: 1,
    });

    if (existingResult.items.length === 0) {
      return null;
    }

    const recordId = existingResult.items[0].record_id;

    // 构建更新字段
    const fields: any = {};

    if (updates.status !== undefined) {
      fields.status = updates.status;
    }
    if (updates.completedAt !== undefined) {
      fields.completed_at = updates.completedAt.getTime();
    }
    if (updates.totalUrls !== undefined) {
      fields.total_urls = updates.totalUrls;
    }
    if (updates.passedUrls !== undefined) {
      fields.passed_urls = updates.passedUrls;
    }
    if (updates.failedUrls !== undefined) {
      fields.failed_urls = updates.failedUrls;
    }
    if (updates.testResults !== undefined) {
      fields.test_results = JSON.stringify(updates.testResults);
    }
    if (updates.emailSent !== undefined) {
      fields.email_sent = updates.emailSent;
    }
    if (updates.emailSentAt !== undefined) {
      fields.email_sent_at = updates.emailSentAt.getTime();
    }
    if (updates.errorMessage !== undefined) {
      fields.error_message = updates.errorMessage;
    }
    if (updates.durationMs !== undefined) {
      fields.duration_ms = updates.durationMs;
    }

    if (Object.keys(fields).length === 0) {
      return this.findById(id);
    }

    await feishuApiService.updateRecord(this.tableId, recordId, fields);

    // 返回更新后的实体
    return this.findById(id);
  }

  /**
   * 更新执行状态
   */
  async updateStatus(id: string, status: PatrolExecutionStatus, errorMessage?: string): Promise<void> {
    const updates: any = { status };
    if (errorMessage !== undefined) {
      updates.errorMessage = errorMessage;
    }
    await this.update(id, updates);
  }

  /**
   * 完成执行记录
   */
  async complete(id: string, passedUrls: number, failedUrls: number, testResults: any[], durationMs: number): Promise<void> {
    await this.update(id, {
      status: PatrolExecutionStatus.Completed,
      completedAt: new Date(),
      passedUrls,
      failedUrls,
      testResults,
      durationMs,
    });
  }

  /**
   * 标记邮件已发送
   */
  async markEmailSent(id: string): Promise<void> {
    await this.update(id, {
      emailSent: true,
      emailSentAt: new Date(),
    });
  }

  /**
   * 删除执行记录
   */
  async delete(id: string): Promise<boolean> {
    // 先查找记录
    const existingResult = await feishuApiService.searchRecords(this.tableId, {
      filter: {
        conditions: [
          {
            field_name: 'id',
            operator: 'is',
            value: [id],
          },
        ],
        conjunction: 'and',
      },
      page_size: 1,
    });

    if (existingResult.items.length === 0) {
      return false;
    }

    const recordId = existingResult.items[0].record_id;
    await feishuApiService.deleteRecord(this.tableId, recordId);

    return true;
  }

  /**
   * 获取任务的最新执行记录
   */
  async findLatestByTaskId(taskId: string): Promise<PatrolExecution | null> {
    const result = await feishuApiService.searchRecords(this.tableId, {
      filter: {
        conditions: [
          {
            field_name: 'patrol_task_id',
            operator: 'is',
            value: [taskId],
          },
        ],
        conjunction: 'and',
      },
      page_size: 1,
    });

    if (result.items.length === 0) {
      return null;
    }

    return this.recordToEntity(result.items[0]);
  }
}
