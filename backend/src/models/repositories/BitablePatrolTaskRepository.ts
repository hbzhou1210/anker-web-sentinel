/**
 * 飞书多维表格巡检任务 Repository
 *
 * 实现 IPatrolTaskRepository 接口,使用飞书多维表格作为存储
 */

import feishuApiService from '../../services/FeishuApiService.js';
import cacheService from '../../services/CacheService.js';
import { FEISHU_BITABLE_CONFIG } from '../../config/feishu-bitable.config.js';
import { PatrolTask } from '../entities.js';
import { IPatrolTaskRepository } from '../interfaces/IPatrolTaskRepository.js';
import { v4 as uuidv4 } from 'uuid';

export class BitablePatrolTaskRepository implements IPatrolTaskRepository {
  private readonly tableId = FEISHU_BITABLE_CONFIG.tables.patrolTasks;
  private readonly CACHE_PREFIX = 'patrol:task:';
  private readonly CACHE_TTL = 300; // 5分钟缓存

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
  async create(task: Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
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

    return id;
  }

  /**
   * 根据 ID 获取巡检任务
   */
  async findById(id: string): Promise<PatrolTask | null> {
    // 1. 尝试从缓存读取
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await cacheService.get<PatrolTask>(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return cached;
    }

    // 2. 缓存未命中,查询飞书
    console.log(`[Cache MISS] ${cacheKey}`);
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

    const task = this.recordToEntity(result.items[0]);

    // 3. 写入缓存
    await cacheService.set(cacheKey, task, this.CACHE_TTL);

    return task;
  }

  /**
   * 获取所有巡检任务
   * @param options 查询选项
   * @returns 任务列表
   */
  async findAll(options?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PatrolTask[]> {
    const searchParams: any = {
      page_size: options?.limit || 500,
    };

    // 构建筛选条件 - 只在有具体条件时才添加 filter
    if (options?.enabled !== undefined) {
      searchParams.filter = {
        conditions: [
          {
            field_name: '启用',
            operator: 'is',
            value: [options.enabled],
          },
        ],
        conjunction: 'and',
      };
    }
    // 注意: 如果没有筛选条件,不添加 filter 字段(避免 InvalidFilter 错误)

    const result = await feishuApiService.searchRecords(this.tableId, searchParams);

    let tasks = result.items
      .map((record: any) => this.recordToEntity(record))
      .sort((a: PatrolTask, b: PatrolTask) => b.createdAt.getTime() - a.createdAt.getTime());

    // 应用偏移量
    if (options?.offset) {
      tasks = tasks.slice(options.offset);
    }

    return tasks;
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

    // 更新后立即失效缓存
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    await cacheService.del(cacheKey);

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

    // 删除后立即失效缓存
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    await cacheService.del(cacheKey);

    return true;
  }

  /**
   * 启用/禁用巡检任务
   */
  async setEnabled(id: string, enabled: boolean): Promise<PatrolTask | null> {
    return this.update(id, { enabled });
  }

  /**
   * 统计任务数量
   * @param options 统计选项
   * @returns 任务数量
   */
  async count(options?: { enabled?: boolean }): Promise<number> {
    try {
      const filter: any = {};

      // 构建筛选条件
      if (options?.enabled !== undefined) {
        filter.conditions = [
          {
            field_name: '启用',
            operator: 'is',
            value: [options.enabled],
          },
        ];
        filter.conjunction = 'and';
      }

      const result = await feishuApiService.searchRecords(this.tableId, {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        page_size: 1, // 只需要知道总数
      });

      return result.total;
    } catch (error) {
      console.error('[BitablePatrolTaskRepository] Failed to count tasks:', error);
      throw error;
    }
  }
}
