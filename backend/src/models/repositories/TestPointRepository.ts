import { query } from '../../database/connection.js';
import { TestPoint, TestPointRow, TestPointPriority, TestPointStatus } from '../entities.js';

export class TestPointRepository {
  // Convert database row to entity
  private static rowToEntity(row: TestPointRow): TestPoint {
    return {
      id: row.id,
      feishuDocumentId: row.feishu_document_id ?? undefined,
      category: row.category ?? undefined,
      feature: row.feature,
      description: row.description,
      priority: row.priority as TestPointPriority,
      testType: row.test_type ?? undefined,
      preconditions: row.preconditions ?? undefined,
      expectedResult: row.expected_result ?? undefined,
      testData: row.test_data ?? undefined,
      status: row.status as TestPointStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ?? undefined,
    };
  }

  // Create a new test point
  static async create(testPoint: Omit<TestPoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestPoint> {
    const result = await query<TestPointRow>(
      `INSERT INTO test_points
       (feishu_document_id, category, feature, description, priority, test_type,
        preconditions, expected_result, test_data, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        testPoint.feishuDocumentId ?? null,
        testPoint.category ?? null,
        testPoint.feature,
        testPoint.description,
        testPoint.priority,
        testPoint.testType ?? null,
        testPoint.preconditions ?? null,
        testPoint.expectedResult ?? null,
        testPoint.testData ? JSON.stringify(testPoint.testData) : null,
        testPoint.status,
        testPoint.metadata ? JSON.stringify(testPoint.metadata) : null,
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create test point');
    }

    return this.rowToEntity(result.rows[0]);
  }

  // Batch create test points
  static async createBatch(testPoints: Omit<TestPoint, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<TestPoint[]> {
    if (testPoints.length === 0) {
      return [];
    }

    const values: any[] = [];
    const placeholders: string[] = [];

    testPoints.forEach((tp, index) => {
      const offset = index * 11;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`
      );
      values.push(
        tp.feishuDocumentId ?? null,
        tp.category ?? null,
        tp.feature,
        tp.description,
        tp.priority,
        tp.testType ?? null,
        tp.preconditions ?? null,
        tp.expectedResult ?? null,
        tp.testData ? JSON.stringify(tp.testData) : null,
        tp.status,
        tp.metadata ? JSON.stringify(tp.metadata) : null
      );
    });

    const result = await query<TestPointRow>(
      `INSERT INTO test_points
       (feishu_document_id, category, feature, description, priority, test_type,
        preconditions, expected_result, test_data, status, metadata)
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values
    );

    return result.rows.map(this.rowToEntity);
  }

  // Find test point by ID
  static async findById(id: string): Promise<TestPoint | null> {
    const result = await query<TestPointRow>('SELECT * FROM test_points WHERE id = $1', [id]);

    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  // Find test points by document ID
  static async findByDocumentId(documentId: string): Promise<TestPoint[]> {
    const result = await query<TestPointRow>(
      'SELECT * FROM test_points WHERE feishu_document_id = $1 ORDER BY created_at DESC',
      [documentId]
    );

    return result.rows.map(this.rowToEntity);
  }

  // List all test points with filters
  static async findAll(filters?: {
    category?: string;
    priority?: TestPointPriority;
    status?: TestPointStatus;
    limit?: number;
    offset?: number;
  }): Promise<TestPoint[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (filters?.category) {
      conditions.push(`category = $${paramCount++}`);
      values.push(filters.category);
    }
    if (filters?.priority) {
      conditions.push(`priority = $${paramCount++}`);
      values.push(filters.priority);
    }
    if (filters?.status) {
      conditions.push(`status = $${paramCount++}`);
      values.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const result = await query<TestPointRow>(
      `SELECT * FROM test_points ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...values, limit, offset]
    );

    return result.rows.map(this.rowToEntity);
  }

  // Update test point
  static async update(
    id: string,
    updates: Partial<Omit<TestPoint, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<TestPoint | null> {
    const fields: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.category !== undefined) {
      fields.push(`category = $${paramCount++}`);
      values.push(updates.category);
    }
    if (updates.feature !== undefined) {
      fields.push(`feature = $${paramCount++}`);
      values.push(updates.feature);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }
    if (updates.priority !== undefined) {
      fields.push(`priority = $${paramCount++}`);
      values.push(updates.priority);
    }
    if (updates.testType !== undefined) {
      fields.push(`test_type = $${paramCount++}`);
      values.push(updates.testType);
    }
    if (updates.preconditions !== undefined) {
      fields.push(`preconditions = $${paramCount++}`);
      values.push(updates.preconditions);
    }
    if (updates.expectedResult !== undefined) {
      fields.push(`expected_result = $${paramCount++}`);
      values.push(updates.expectedResult);
    }
    if (updates.testData !== undefined) {
      fields.push(`test_data = $${paramCount++}`);
      values.push(JSON.stringify(updates.testData));
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(updates.status);
    }
    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    values.push(id);
    const result = await query<TestPointRow>(
      `UPDATE test_points SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  // Delete test point
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM test_points WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Delete all test points for a document
  static async deleteByDocumentId(documentId: string): Promise<number> {
    const result = await query('DELETE FROM test_points WHERE feishu_document_id = $1', [documentId]);
    return result.rowCount ?? 0;
  }

  // Count test points by status
  static async countByStatus(): Promise<Record<string, number>> {
    const result = await query<{ status: string; count: string }>(
      'SELECT status, COUNT(*)::text as count FROM test_points GROUP BY status'
    );

    const counts: Record<string, number> = {};
    result.rows.forEach((row) => {
      counts[row.status] = parseInt(row.count, 10);
    });

    return counts;
  }
}
