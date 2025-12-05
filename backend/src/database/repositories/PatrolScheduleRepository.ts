import pool from '../connection.js';
import { PatrolSchedule, PatrolScheduleRow, PatrolScheduleType } from '../../models/entities.js';

export class PatrolScheduleRepository {
  /**
   * 将数据库行转换为实体
   */
  private rowToEntity(row: PatrolScheduleRow): PatrolSchedule {
    return {
      id: row.id,
      patrolTaskId: row.patrol_task_id,
      cronExpression: row.cron_expression,
      scheduleType: row.schedule_type as PatrolScheduleType,
      timeZone: row.time_zone,
      enabled: row.enabled,
      lastExecutionAt: row.last_execution_at || undefined,
      nextExecutionAt: row.next_execution_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 创建调度配置
   */
  async create(schedule: Omit<PatrolSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatrolSchedule> {
    const query = `
      INSERT INTO patrol_schedules (
        patrol_task_id, cron_expression, schedule_type, time_zone,
        enabled, last_execution_at, next_execution_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      schedule.patrolTaskId,
      schedule.cronExpression,
      schedule.scheduleType,
      schedule.timeZone,
      schedule.enabled,
      schedule.lastExecutionAt || null,
      schedule.nextExecutionAt || null,
    ];

    const result = await pool.query<PatrolScheduleRow>(query, values);
    return this.rowToEntity(result.rows[0]);
  }

  /**
   * 根据 ID 获取调度配置
   */
  async findById(id: string): Promise<PatrolSchedule | null> {
    const query = 'SELECT * FROM patrol_schedules WHERE id = $1';
    const result = await pool.query<PatrolScheduleRow>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntity(result.rows[0]);
  }

  /**
   * 根据任务 ID 获取调度配置
   */
  async findByTaskId(taskId: string): Promise<PatrolSchedule[]> {
    const query = `
      SELECT * FROM patrol_schedules
      WHERE patrol_task_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query<PatrolScheduleRow>(query, [taskId]);
    return result.rows.map((row) => this.rowToEntity(row));
  }

  /**
   * 获取所有启用的调度配置
   */
  async findAllEnabled(): Promise<PatrolSchedule[]> {
    const query = `
      SELECT ps.*
      FROM patrol_schedules ps
      JOIN patrol_tasks pt ON ps.patrol_task_id = pt.id
      WHERE ps.enabled = true AND pt.enabled = true
      ORDER BY ps.next_execution_at ASC
    `;
    const result = await pool.query<PatrolScheduleRow>(query);
    return result.rows.map((row) => this.rowToEntity(row));
  }

  /**
   * 获取需要执行的调度配置
   */
  async findDueSchedules(): Promise<PatrolSchedule[]> {
    const query = `
      SELECT ps.*
      FROM patrol_schedules ps
      JOIN patrol_tasks pt ON ps.patrol_task_id = pt.id
      WHERE ps.enabled = true
        AND pt.enabled = true
        AND ps.next_execution_at <= NOW()
      ORDER BY ps.next_execution_at ASC
    `;
    const result = await pool.query<PatrolScheduleRow>(query);
    return result.rows.map((row) => this.rowToEntity(row));
  }

  /**
   * 更新调度配置
   */
  async update(id: string, updates: Partial<Omit<PatrolSchedule, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PatrolSchedule | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.cronExpression !== undefined) {
      fields.push(`cron_expression = $${paramIndex++}`);
      values.push(updates.cronExpression);
    }
    if (updates.scheduleType !== undefined) {
      fields.push(`schedule_type = $${paramIndex++}`);
      values.push(updates.scheduleType);
    }
    if (updates.timeZone !== undefined) {
      fields.push(`time_zone = $${paramIndex++}`);
      values.push(updates.timeZone);
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex++}`);
      values.push(updates.enabled);
    }
    if (updates.lastExecutionAt !== undefined) {
      fields.push(`last_execution_at = $${paramIndex++}`);
      values.push(updates.lastExecutionAt);
    }
    if (updates.nextExecutionAt !== undefined) {
      fields.push(`next_execution_at = $${paramIndex++}`);
      values.push(updates.nextExecutionAt);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE patrol_schedules
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query<PatrolScheduleRow>(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntity(result.rows[0]);
  }

  /**
   * 更新执行时间
   */
  async updateExecutionTime(id: string, lastExecutionAt: Date, nextExecutionAt: Date): Promise<void> {
    const query = `
      UPDATE patrol_schedules
      SET last_execution_at = $1, next_execution_at = $2, updated_at = NOW()
      WHERE id = $3
    `;
    await pool.query(query, [lastExecutionAt, nextExecutionAt, id]);
  }

  /**
   * 删除调度配置
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM patrol_schedules WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * 启用/禁用调度配置
   */
  async setEnabled(id: string, enabled: boolean): Promise<PatrolSchedule | null> {
    const query = `
      UPDATE patrol_schedules
      SET enabled = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query<PatrolScheduleRow>(query, [enabled, id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntity(result.rows[0]);
  }
}
