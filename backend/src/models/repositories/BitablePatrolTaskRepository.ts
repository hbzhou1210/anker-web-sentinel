/**
 * 飞书多维表格巡检任务 Repository
 *
 * 实现与 PatrolTaskRepository 相同的接口,但使用飞书多维表格作为存储
 */

import feishuApiService from '../../services/FeishuApiService.js';
import { FEISHU_BITABLE_CONFIG } from '../../config/feishu-bitable.config.js';
import { PatrolTask } from '../entities.js';
import { v4 as uuidv4 } from 'uuid';

export class BitablePatrolTaskRepository {
  private readonly tableId = FEISHU_BITABLE_CONFIG.tables.patrolTasks;

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
  private recordToEntity(record: any): PatrolTask {
    const fields = record.fields;

    const idText = this.extractText(fields.id);
    const nameText = this.extractText(fields.name);
    const descText = this.extractText(fields.description);
    const urlsText = this.extractText(fields.urls);
    const configText = this.extractText(fields.config);
    const emailsText = this.extractText(fields.notification_emails);

    return {
      id: idText,
      name: nameText,
      description: descText || undefined,
      urls: urlsText ? JSON.parse(urlsText) : [],
      config: configText ? JSON.parse(configText) : {},
      notificationEmails: emailsText ? emailsText.split(',').map((e: string) => e.trim()) : [],
      enabled: fields.enabled === true,
      createdAt: new Date(fields.created_at),
      updatedAt: new Date(fields.updated_at),
    };
  }

  /**
   * 创建巡检任务
   */
  async create(task: Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatrolTask> {
    const id = uuidv4();
    const now = Date.now();

    const fields = {
      id,
      name: task.name,
      description: task.description || '',
      urls: JSON.stringify(task.urls),
      config: JSON.stringify(task.config),
      notification_emails: Array.isArray(task.notificationEmails) ? task.notificationEmails.join(', ') : task.notificationEmails,
      enabled: task.enabled,
      created_at: now,
      updated_at: now,
    };

    await feishuApiService.createRecord(this.tableId, fields);

    return {
      id,
      name: task.name,
      description: task.description,
      urls: task.urls,
      config: task.config,
      notificationEmails: task.notificationEmails,
      enabled: task.enabled,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  /**
   * 根据 ID 获取巡检任务
   */
  async findById(id: string): Promise<PatrolTask | null> {
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
   * 获取所有巡检任务
   */
  async findAll(enabledOnly: boolean = false): Promise<PatrolTask[]> {
    const searchParams: any = {
      page_size: 500,
    };

    if (enabledOnly) {
      searchParams.filter = {
        conditions: [
          {
            field_name: 'enabled',
            operator: 'is',
            value: [true],
          },
        ],
        conjunction: 'and',
      };
    }

    const result = await feishuApiService.searchRecords(this.tableId, searchParams);

    return result.items
      .map((record: any) => this.recordToEntity(record))
      .sort((a: PatrolTask, b: PatrolTask) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 更新巡检任务
   */
  async update(id: string, updates: Partial<Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PatrolTask | null> {
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
    const fields: any = {
      updated_at: Date.now(),
    };

    if (updates.name !== undefined) {
      fields.name = updates.name;
    }
    if (updates.description !== undefined) {
      fields.description = updates.description || '';
    }
    if (updates.urls !== undefined) {
      fields.urls = JSON.stringify(updates.urls);
    }
    if (updates.config !== undefined) {
      fields.config = JSON.stringify(updates.config);
    }
    if (updates.notificationEmails !== undefined) {
      fields.notification_emails = Array.isArray(updates.notificationEmails)
        ? updates.notificationEmails.join(', ')
        : updates.notificationEmails;
    }
    if (updates.enabled !== undefined) {
      fields.enabled = updates.enabled;
    }

    await feishuApiService.updateRecord(this.tableId, recordId, fields);

    // 返回更新后的实体
    return this.findById(id);
  }

  /**
   * 删除巡检任务
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
   * 启用/禁用巡检任务
   */
  async setEnabled(id: string, enabled: boolean): Promise<PatrolTask | null> {
    return this.update(id, { enabled });
  }
}
