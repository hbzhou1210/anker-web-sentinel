import pool from '../connection.js';
import { PatrolExecution, PatrolExecutionRow, PatrolExecutionStatus } from '../../models/entities.js';

export class PatrolExecutionRepository {
  /**
   * 将数据库行转换为实体
   */
  private rowToEntity(row: PatrolExecutionRow): PatrolExecution {
    return {
      id: row.id,
      patrolTaskId: row.patrol_task_id,
      status: row.status as PatrolExecutionStatus,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      totalUrls: row.total_urls,
      passedUrls: row.passed_urls,
      failedUrls: row.failed_urls,
      testResults: row.test_results,
      emailSent: row.email_sent,
      emailSentAt: row.email_sent_at || undefined,
      errorMessage: row.error_message || undefined,
      durationMs: row.duration_ms || undefined,
    };
  }

  /**
   * 创建执行记录
   */
  async create(execution: Omit<PatrolExecution, 'id'>): Promise<PatrolExecution> {
    const query = `
      INSERT INTO patrol_executions (
        patrol_task_id, status, started_at, completed_at,
        total_urls, passed_urls, failed_urls, test_results,
        email_sent, email_sent_at, error_message, duration_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      execution.patrolTaskId,
      execution.status,
      execution.startedAt,
      execution.completedAt || null,
      execution.totalUrls,
      execution.passedUrls,
      execution.failedUrls,
      JSON.stringify(execution.testResults),
      execution.emailSent,
      execution.emailSentAt || null,
      execution.errorMessage || null,
      execution.durationMs || null,
    ];

    const result = await pool.query<PatrolExecutionRow>(query, values);
    return this.rowToEntity(result.rows[0]);
  }

  /**
   * 根据 ID 获取执行记录
   */
  async findById(id: string): Promise<PatrolExecution | null> {
    const query = 'SELECT * FROM patrol_executions WHERE id = $1';
    const result = await pool.query<PatrolExecutionRow>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntity(result.rows[0]);
  }

  /**
   * 根据任务 ID 获取执行历史
   */
  async findByTaskId(taskId: string, limit: number = 50): Promise<PatrolExecution[]> {
    const query = `
      SELECT * FROM patrol_executions
      WHERE patrol_task_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `;
    const result = await pool.query<PatrolExecutionRow>(query, [taskId, limit]);
    return result.rows.map((row) => this.rowToEntity(row));
  }

  /**
   * 获取所有执行记录
   */
  async findAll(limit: number = 100): Promise<PatrolExecution[]> {
    const query = `
      SELECT * FROM patrol_executions
      ORDER BY started_at DESC
      LIMIT $1
    `;
    const result = await pool.query<PatrolExecutionRow>(query, [limit]);
    return result.rows.map((row) => this.rowToEntity(row));
  }

  /**
   * 更新执行记录
   */
  async update(id: string, updates: Partial<Omit<PatrolExecution, 'id' | 'patrolTaskId' | 'startedAt'>>): Promise<PatrolExecution | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }
    if (updates.totalUrls !== undefined) {
      fields.push(`total_urls = $${paramIndex++}`);
      values.push(updates.totalUrls);
    }
    if (updates.passedUrls !== undefined) {
      fields.push(`passed_urls = $${paramIndex++}`);
      values.push(updates.passedUrls);
    }
    if (updates.failedUrls !== undefined) {
      fields.push(`failed_urls = $${paramIndex++}`);
      values.push(updates.failedUrls);
    }
    if (updates.testResults !== undefined) {
      fields.push(`test_results = $${paramIndex++}`);
      values.push(JSON.stringify(updates.testResults));
    }
    if (updates.emailSent !== undefined) {
      fields.push(`email_sent = $${paramIndex++}`);
      values.push(updates.emailSent);
    }
    if (updates.emailSentAt !== undefined) {
      fields.push(`email_sent_at = $${paramIndex++}`);
      values.push(updates.emailSentAt);
    }
    if (updates.errorMessage !== undefined) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(updates.errorMessage);
    }
    if (updates.durationMs !== undefined) {
      fields.push(`duration_ms = $${paramIndex++}`);
      values.push(updates.durationMs);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const query = `
      UPDATE patrol_executions
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query<PatrolExecutionRow>(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntity(result.rows[0]);
  }

  /**
   * 更新执行状态
   */
  async updateStatus(id: string, status: PatrolExecutionStatus, errorMessage?: string): Promise<void> {
    const query = `
      UPDATE patrol_executions
      SET status = $1, error_message = $2
      WHERE id = $3
    `;
    await pool.query(query, [status, errorMessage || null, id]);
  }

  /**
   * 完成执行记录
   */
  async complete(id: string, passedUrls: number, failedUrls: number, testResults: any[], durationMs: number): Promise<void> {
    const query = `
      UPDATE patrol_executions
      SET
        status = $1,
        completed_at = NOW(),
        passed_urls = $2,
        failed_urls = $3,
        test_results = $4,
        duration_ms = $5
      WHERE id = $6
    `;
    await pool.query(query, [
      PatrolExecutionStatus.Completed,
      passedUrls,
      failedUrls,
      JSON.stringify(testResults),
      durationMs,
      id,
    ]);
  }

  /**
   * 标记邮件已发送
   */
  async markEmailSent(id: string): Promise<void> {
    const query = `
      UPDATE patrol_executions
      SET email_sent = true, email_sent_at = NOW()
      WHERE id = $1
    `;
    await pool.query(query, [id]);
  }

  /**
   * 删除执行记录
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM patrol_executions WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * 获取任务的最新执行记录
   */
  async findLatestByTaskId(taskId: string): Promise<PatrolExecution | null> {
    const query = `
      SELECT * FROM patrol_executions
      WHERE patrol_task_id = $1
      ORDER BY started_at DESC
      LIMIT 1
    `;
    const result = await pool.query<PatrolExecutionRow>(query, [taskId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntity(result.rows[0]);
  }
}
