/**
 * 飞书多维表格巡检调度 Repository
 *
 * 实现与 PatrolScheduleRepository 相同的接口,但使用飞书多维表格作为存储
 */

import feishuApiService from '../../services/FeishuApiService.js';
import { FEISHU_BITABLE_CONFIG } from '../../config/feishu-bitable.config.js';
import { PatrolSchedule, PatrolScheduleType } from '../entities.js';
import { v4 as uuidv4 } from 'uuid';

export class BitablePatrolScheduleRepository {
  private readonly scheduleTableId = FEISHU_BITABLE_CONFIG.tables.patrolSchedules;
  private readonly taskTableId = FEISHU_BITABLE_CONFIG.tables.patrolTasks;

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
   * 将飞书记录转换为调度配置实体
   */
  private recordToSchedule(record: any): PatrolSchedule {
    const fields = record.fields;

    const idText = this.extractText(fields.id);
    const patrolTaskIdText = this.extractText(fields.patrol_task_id);
    const cronExpressionText = this.extractText(fields.cron_expression);
    const scheduleTypeText = this.extractText(fields.schedule_type);
    const timeZoneText = this.extractText(fields.time_zone);

    return {
      id: idText || record.record_id,
      patrolTaskId: patrolTaskIdText,
      cronExpression: cronExpressionText,
      scheduleType: scheduleTypeText as PatrolScheduleType,
      timeZone: timeZoneText || 'Asia/Shanghai',
      enabled: fields.enabled === true,
      lastExecutionAt: fields.last_execution_at ? new Date(fields.last_execution_at) : undefined,
      nextExecutionAt: fields.next_execution_at ? new Date(fields.next_execution_at) : undefined,
      createdAt: new Date(fields.created_at || Date.now()),
      updatedAt: new Date(fields.updated_at || Date.now()),
    };
  }

  /**
   * 创建调度配置
   */
  async create(schedule: Omit<PatrolSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatrolSchedule> {
    const id = uuidv4();
    const now = Date.now();

    const fields = {
      id,
      patrol_task_id: schedule.patrolTaskId,
      cron_expression: schedule.cronExpression,
      schedule_type: schedule.scheduleType,
      time_zone: schedule.timeZone || 'Asia/Shanghai',
      enabled: schedule.enabled,
      last_execution_at: schedule.lastExecutionAt?.getTime() || null,
      next_execution_at: schedule.nextExecutionAt?.getTime() || null,
      created_at: now,
      updated_at: now,
    };

    await feishuApiService.createRecord(this.scheduleTableId, fields);

    return {
      id,
      patrolTaskId: schedule.patrolTaskId,
      cronExpression: schedule.cronExpression,
      scheduleType: schedule.scheduleType,
      timeZone: schedule.timeZone || 'Asia/Shanghai',
      enabled: schedule.enabled,
      lastExecutionAt: schedule.lastExecutionAt,
      nextExecutionAt: schedule.nextExecutionAt,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  /**
   * 根据 ID 获取调度配置
   */
  async findById(id: string): Promise<PatrolSchedule | null> {
    const result = await feishuApiService.searchRecords(this.scheduleTableId, {
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

    return this.recordToSchedule(result.items[0]);
  }

  /**
   * 根据任务 ID 获取调度配置
   */
  async findByTaskId(taskId: string): Promise<PatrolSchedule[]> {
    const result = await feishuApiService.searchRecords(this.scheduleTableId, {
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
      sort: [
        {
          field_name: 'created_at',
          desc: true,
        },
      ],
      page_size: 500,
    });

    return result.items.map((record: any) => this.recordToSchedule(record));
  }

  /**
   * 获取所有启用的调度配置
   */
  async findAllEnabled(): Promise<PatrolSchedule[]> {
    // 首先获取所有启用的巡检任务
    const tasksResult = await feishuApiService.searchRecords(this.taskTableId, {
      filter: {
        conditions: [
          {
            field_name: 'enabled',
            operator: 'is',
            value: [true],
          },
        ],
        conjunction: 'and',
      },
      page_size: 500,
    });

    const enabledTaskIds = tasksResult.items.map((record: any) => {
      const idText = this.extractText(record.fields.id);
      return idText || record.record_id;
    });

    if (enabledTaskIds.length === 0) {
      return [];
    }

    // 获取所有启用的调度配置
    const result = await feishuApiService.searchRecords(this.scheduleTableId, {
      filter: {
        conditions: [
          {
            field_name: 'enabled',
            operator: 'is',
            value: [true],
          },
        ],
        conjunction: 'and',
      },
      sort: [
        {
          field_name: 'next_execution_at',
          desc: false,
        },
      ],
      page_size: 500,
    });

    // 过滤出任务也启用的调度
    const schedules = result.items
      .map((record: any) => this.recordToSchedule(record))
      .filter((schedule: PatrolSchedule) => enabledTaskIds.includes(schedule.patrolTaskId));

    return schedules;
  }

  /**
   * 获取需要执行的调度配置
   */
  async findDueSchedules(): Promise<PatrolSchedule[]> {
    const now = Date.now();

    // 获取所有启用的调度
    const allEnabled = await this.findAllEnabled();

    // 过滤出到期的调度
    return allEnabled.filter((schedule) => {
      if (!schedule.nextExecutionAt) return false;
      return schedule.nextExecutionAt.getTime() <= now;
    });
  }

  /**
   * 更新调度配置
   */
  async update(
    id: string,
    updates: Partial<Omit<PatrolSchedule, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<PatrolSchedule | null> {
    // 先查找记录
    const existingResult = await feishuApiService.searchRecords(this.scheduleTableId, {
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

    if (updates.cronExpression !== undefined) {
      fields.cron_expression = updates.cronExpression;
    }
    if (updates.scheduleType !== undefined) {
      fields.schedule_type = updates.scheduleType;
    }
    if (updates.timeZone !== undefined) {
      fields.time_zone = updates.timeZone;
    }
    if (updates.enabled !== undefined) {
      fields.enabled = updates.enabled;
    }
    if (updates.lastExecutionAt !== undefined) {
      fields.last_execution_at = updates.lastExecutionAt?.getTime() || null;
    }
    if (updates.nextExecutionAt !== undefined) {
      fields.next_execution_at = updates.nextExecutionAt?.getTime() || null;
    }

    // 更新记录
    await feishuApiService.updateRecord(this.scheduleTableId, recordId, fields);

    // 返回更新后的记录
    return this.findById(id);
  }

  /**
   * 更新执行时间
   */
  async updateExecutionTime(id: string, lastExecutionAt: Date, nextExecutionAt: Date): Promise<void> {
    const existingResult = await feishuApiService.searchRecords(this.scheduleTableId, {
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
      return;
    }

    const recordId = existingResult.items[0].record_id;

    await feishuApiService.updateRecord(this.scheduleTableId, recordId, {
      last_execution_at: lastExecutionAt.getTime(),
      next_execution_at: nextExecutionAt.getTime(),
      updated_at: Date.now(),
    });
  }

  /**
   * 删除调度配置
   */
  async delete(id: string): Promise<boolean> {
    const existingResult = await feishuApiService.searchRecords(this.scheduleTableId, {
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
    await feishuApiService.deleteRecord(this.scheduleTableId, recordId);
    return true;
  }

  /**
   * 启用/禁用调度配置
   */
  async setEnabled(id: string, enabled: boolean): Promise<PatrolSchedule | null> {
    await this.update(id, { enabled });
    return this.findById(id);
  }
}
