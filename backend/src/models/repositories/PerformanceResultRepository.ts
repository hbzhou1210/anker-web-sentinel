import { query } from '../../database/connection.js';
import { PerformanceResult, PerformanceResultRow, PerformanceMetric, MetricUnit, TestResultStatus } from '../entities.js';

interface CreatePerformanceResultData {
  testReportId: string;
  metricName: PerformanceMetric;
  measuredValue: number;
  unit: MetricUnit;
  threshold: number;
  status: TestResultStatus;
  recommendation?: string;
  details?: Record<string, any>;
}

export class PerformanceResultRepository {
  // Batch create performance results
  async batchCreate(results: CreatePerformanceResultData[]): Promise<PerformanceResult[]> {
    if (results.length === 0) {
      return [];
    }

    // Build bulk insert query
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    results.forEach((result) => {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
      );
      values.push(
        result.testReportId,
        result.metricName,
        result.measuredValue,
        result.unit,
        result.threshold,
        result.status,
        result.recommendation || null,
        result.details ? JSON.stringify(result.details) : null
      );
      paramIndex += 8;
    });

    const queryText = `
      INSERT INTO performance_results (
        test_report_id, metric_name, measured_value, unit,
        threshold, status, recommendation, details
      )
      VALUES ${placeholders.join(', ')}
      RETURNING id, test_report_id, metric_name, measured_value, unit,
                threshold, status, recommendation, details
    `;

    const result = await query<PerformanceResultRow>(queryText, values);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  // Find performance results by report ID
  async findByReportId(reportId: string): Promise<PerformanceResult[]> {
    const result = await query<PerformanceResultRow>(
      `SELECT id, test_report_id, metric_name, measured_value, unit,
              threshold, status, recommendation, details
       FROM performance_results
       WHERE test_report_id = $1
       ORDER BY metric_name`,
      [reportId]
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  // Map database row to entity
  private mapRowToEntity(row: PerformanceResultRow): PerformanceResult {
    return {
      id: row.id,
      testReportId: row.test_report_id,
      metricName: row.metric_name as PerformanceMetric,
      measuredValue: parseFloat(row.measured_value),  // Convert DECIMAL to number
      unit: row.unit as MetricUnit,
      threshold: parseFloat(row.threshold),  // Convert DECIMAL to number
      status: row.status as TestResultStatus,
      recommendation: row.recommendation || undefined,
      details: row.details || undefined,
    };
  }
}

export default new PerformanceResultRepository();
