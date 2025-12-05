import { query } from '../../database/connection.js';
import { UITestResult, UITestResultRow, UITestType, TestResultStatus } from '../entities.js';

interface CreateUITestResultData {
  testReportId: string;
  testType: UITestType;
  elementId?: string;
  status: TestResultStatus;
  errorMessage?: string;
  screenshotUrl?: string;
  recommendation?: string;
  diagnostics?: Record<string, any>;
}

export class UITestResultRepository {
  // Batch create UI test results
  async batchCreate(results: CreateUITestResultData[]): Promise<UITestResult[]> {
    if (results.length === 0) {
      return [];
    }

    // Build bulk insert query
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    results.forEach((result, idx) => {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
      );
      values.push(
        result.testReportId,
        result.testType,
        result.elementId || null,
        result.status,
        result.errorMessage || null,
        result.screenshotUrl || null,
        result.recommendation || null,
        result.diagnostics ? JSON.stringify(result.diagnostics) : null
      );
      paramIndex += 8;
    });

    const queryText = `
      INSERT INTO ui_test_results (
        test_report_id, test_type, element_id, status,
        error_message, screenshot_url, recommendation, diagnostics
      )
      VALUES ${placeholders.join(', ')}
      RETURNING id, test_report_id, test_type, element_id, status,
                error_message, screenshot_url, recommendation, diagnostics
    `;

    const result = await query<UITestResultRow>(queryText, values);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  // Find UI test results by report ID
  async findByReportId(reportId: string): Promise<UITestResult[]> {
    const result = await query<UITestResultRow>(
      `SELECT id, test_report_id, test_type, element_id, status,
              error_message, screenshot_url, recommendation, diagnostics
       FROM ui_test_results
       WHERE test_report_id = $1
       ORDER BY test_type, id`,
      [reportId]
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  // Map database row to entity
  private mapRowToEntity(row: UITestResultRow): UITestResult {
    return {
      id: row.id,
      testReportId: row.test_report_id,
      testType: row.test_type as UITestType,
      elementId: row.element_id || undefined,
      status: row.status as TestResultStatus,
      errorMessage: row.error_message || undefined,
      screenshotUrl: row.screenshot_url || undefined,
      recommendation: row.recommendation || undefined,
      diagnostics: row.diagnostics || undefined,
    };
  }
}

export default new UITestResultRepository();
