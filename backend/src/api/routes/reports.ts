import { Router, Request, Response } from 'express';
import { useBitable } from '../../config/database.config.js';

// 根据配置选择不同的 Repository
import postgresTestReportRepository from '../../models/repositories/TestReportRepository.js';
import bitableTestReportRepository from '../../models/repositories/BitableTestReportRepository.js';
import uiTestResultRepository from '../../models/repositories/UITestResultRepository.js';
import performanceResultRepository from '../../models/repositories/PerformanceResultRepository.js';

// 选择使用的 Repository
const testReportRepository = useBitable() ? bitableTestReportRepository : postgresTestReportRepository;

console.log(`[Reports Route] Using ${useBitable() ? 'Feishu Bitable' : 'PostgreSQL'} for test reports`);

const router = Router();

// GET /api/v1/reports/:reportId - Get test report by ID
router.get('/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    // Get test report
    const report = await testReportRepository.findById(reportId);

    if (!report) {
      res.status(404).json({
        error: 'Not Found',
        message: `Test report ${reportId} not found`,
      });
      return;
    }

    // Get UI test results and performance results
    // 注意: 使用 Bitable 时,这些数据暂时为空
    let uiTestResults = report.uiTestResults || [];
    let performanceResults = report.performanceResults || [];

    // 只有使用 PostgreSQL 时才查询相关结果
    if (!useBitable()) {
      uiTestResults = await uiTestResultRepository.findByReportId(reportId);
      performanceResults = await performanceResultRepository.findByReportId(reportId);
    }

    // Return complete report
    res.json({
      ...report,
      uiTestResults,
      performanceResults,
    });
  } catch (error) {
    console.error('Failed to get test report:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve test report',
    });
  }
});

// GET /api/v1/reports - List recent test reports
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const url = req.query.url as string | undefined;

    let reports;
    let total;

    if (url) {
      // Filter by URL
      reports = await testReportRepository.findByUrl(url, limit, offset);
      total = await testReportRepository.count(url);
    } else {
      // Get all reports
      reports = await testReportRepository.findAll(limit, offset);
      total = await testReportRepository.count();
    }

    res.json({
      reports: reports.map((r) => ({
        id: r.id,
        url: r.url,
        overallScore: r.overallScore,
        totalChecks: r.totalChecks,
        passedChecks: r.passedChecks,
        failedChecks: r.failedChecks,
        completedAt: r.completedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + reports.length < total,
      },
    });
  } catch (error) {
    console.error('Failed to list test reports:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list test reports',
    });
  }
});

export default router;
