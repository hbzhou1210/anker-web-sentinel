import { query } from '../../database/connection.js';
import { TestRequest, TestRequestStatus, TestRequestRow } from '../entities.js';

export class TestRequestRepository {
  // Create a new test request
  async create(url: string, config?: { timeout?: number; waitTime?: number }, notificationEmail?: string): Promise<TestRequest> {
    const result = await query<TestRequestRow>(
      `INSERT INTO test_requests (url, config, notification_email)
       VALUES ($1, $2, $3)
       RETURNING id, url, requested_at, status, config, notification_email`,
      [url, config ? JSON.stringify(config) : null, notificationEmail || null]
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  // Find test request by ID
  async findById(id: string): Promise<TestRequest | null> {
    const result = await query<TestRequestRow>(
      'SELECT id, url, requested_at, status, config, notification_email FROM test_requests WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  // Update test request status
  async updateStatus(id: string, status: TestRequestStatus): Promise<void> {
    await query(
      'UPDATE test_requests SET status = $1 WHERE id = $2',
      [status, id]
    );
  }

  // Map database row to entity
  private mapRowToEntity(row: TestRequestRow): TestRequest {
    return {
      id: row.id,
      url: row.url,
      requestedAt: row.requested_at,
      status: row.status as TestRequestStatus,
      config: row.config,
      notificationEmail: row.notification_email,
    };
  }
}

export default new TestRequestRepository();
