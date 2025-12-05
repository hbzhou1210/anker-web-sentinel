import pool from '../connection.js';
import { PatrolTask, PatrolTaskRow } from '../../models/entities.js';

export class PatrolTaskRepository {
  /**
   * 将数据库行转换为实体
   */
  private rowToEntity(row: PatrolTaskRow): PatrolTask {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      urls: row.urls,
      config: row.config,
      notificationEmails: row.notification_emails,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 创建巡检任务
   */
  async create(task: Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatrolTask> {
    const query = `
      INSERT INTO patrol_tasks (name, description, urls, config, notification_emails, enabled)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      task.name,
      task.description || null,
      JSON.stringify(task.urls),
      JSON.stringify(task.config),
      task.notificationEmails,
      task.enabled,
    ];

    const result = await pool.query<PatrolTaskRow>(query, values);
    return this.rowToEntity(result.rows[0]);
  }

  /**
   * 根据 ID 获取巡检任务
   */
  async findById(id: string): Promise<PatrolTask | null> {
    const query = 'SELECT * FROM patrol_tasks WHERE id = $1';
    const result = await pool.query<PatrolTaskRow>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntity(result.rows[0]);
  }

  /**
   * 获取所有巡检任务
   */
  async findAll(enabledOnly: boolean = false): Promise<PatrolTask[]> {
    let query = 'SELECT * FROM patrol_tasks';
    if (enabledOnly) {
      query += ' WHERE enabled = true';
    }
    query += ' ORDER BY created_at DESC';

    const result = await pool.query<PatrolTaskRow>(query);
    return result.rows.map((row) => this.rowToEntity(row));
  }

  /**
   * 更新巡检任务
   */
  async update(id: string, updates: Partial<Omit<PatrolTask, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PatrolTask | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.urls !== undefined) {
      fields.push(`urls = $${paramIndex++}`);
      values.push(JSON.stringify(updates.urls));
    }
    if (updates.config !== undefined) {
      fields.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.config));
    }
    if (updates.notificationEmails !== undefined) {
      fields.push(`notification_emails = $${paramIndex++}`);
      values.push(updates.notificationEmails);
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex++}`);
      values.push(updates.enabled);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE patrol_tasks
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query<PatrolTaskRow>(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntity(result.rows[0]);
  }

  /**
   * 删除巡检任务
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM patrol_tasks WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * 启用/禁用巡检任务
   */
  async setEnabled(id: string, enabled: boolean): Promise<PatrolTask | null> {
    const query = `
      UPDATE patrol_tasks
      SET enabled = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query<PatrolTaskRow>(query, [enabled, id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntity(result.rows[0]);
  }
}
