import { query } from '../../database/connection.js';
import { TestReport, TestReportRow } from '../entities.js';

interface CreateTestReportData {
  testRequestId: string;
  url: string;
  overallScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  testDuration: number;
}

export class TestReportRepository {
  // Create a new test report
  async create(data: CreateTestReportData): Promise<TestReport> {
    const result = await query<TestReportRow>(
      `INSERT INTO test_reports (
        test_request_id, url, overall_score, total_checks,
        passed_checks, failed_checks, warning_checks, test_duration
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, test_request_id, url, overall_score, total_checks,
                passed_checks, failed_checks, warning_checks, test_duration, completed_at`,
      [
        data.testRequestId,
        data.url,
        data.overallScore,
        data.totalChecks,
        data.passedChecks,
        data.failedChecks,
        data.warningChecks,
        data.testDuration,
      ]
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  // Find test report by ID
  async findById(id: string): Promise<TestReport | null> {
    const result = await query<TestReportRow>(
      `SELECT id, test_request_id, url, overall_score, total_checks,
              passed_checks, failed_checks, warning_checks, test_duration, completed_at
       FROM test_reports
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  // Find test report by test request ID
  async findByTestRequestId(testRequestId: string): Promise<TestReport | null> {
    const result = await query<TestReportRow>(
      `SELECT id, test_request_id, url, overall_score, total_checks,
              passed_checks, failed_checks, warning_checks, test_duration, completed_at
       FROM test_reports
       WHERE test_request_id = $1`,
      [testRequestId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  // Find test reports by URL with pagination
  async findByUrl(url: string, limit = 30, offset = 0): Promise<TestReport[]> {
    const result = await query<TestReportRow>(
      `SELECT id, test_request_id, url, overall_score, total_checks,
              passed_checks, failed_checks, warning_checks, test_duration, completed_at
       FROM test_reports
       WHERE url = $1
       ORDER BY completed_at DESC
       LIMIT $2 OFFSET $3`,
      [url, limit, offset]
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  // Find all test reports with pagination
  async findAll(limit = 30, offset = 0): Promise<TestReport[]> {
    const result = await query<TestReportRow>(
      `SELECT id, test_request_id, url, overall_score, total_checks,
              passed_checks, failed_checks, warning_checks, test_duration, completed_at
       FROM test_reports
       ORDER BY completed_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  // Count total test reports
  async count(url?: string): Promise<number> {
    let queryText: string;
    let params: any[];

    if (url) {
      queryText = 'SELECT COUNT(*) as count FROM test_reports WHERE url = $1';
      params = [url];
    } else {
      queryText = 'SELECT COUNT(*) as count FROM test_reports';
      params = [];
    }

    const result = await query<{ count: string }>(queryText, params);
    return parseInt(result.rows[0].count, 10);
  }

  // Map database row to entity (without related entities)
  private mapRowToEntity(row: TestReportRow): TestReport {
    return {
      id: row.id,
      testRequestId: row.test_request_id,
      url: row.url,
      overallScore: row.overall_score,
      totalChecks: row.total_checks,
      passedChecks: row.passed_checks,
      failedChecks: row.failed_checks,
      warningChecks: row.warning_checks,
      testDuration: row.test_duration,
      completedAt: row.completed_at,
      uiTestResults: [],  // Populated separately
      performanceResults: [],  // Populated separately
    };
  }
}

export default new TestReportRepository();
