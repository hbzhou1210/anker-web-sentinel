import { Router, Request, Response } from 'express';
import { validateUrl } from '../middleware/validateUrl.js';
import { strictLimiter } from '../middleware/rateLimiter.js';

// 使用内存版 TestRequest Repository (只用于追踪异步任务状态)
import testRequestRepository from '../../models/repositories/InMemoryTestRequestRepository.js';

// 使用 Bitable 存储测试报告
import testReportRepository from '../../models/repositories/BitableTestReportRepository.js';
import testExecutionService from '../../services/TestExecutionService.js';

console.log(`[Tests Route] Using in-memory storage for test requests, Bitable for test reports`);

const router = Router();

// POST /api/v1/tests - Create a new test request
// 应用严格限流器(10次/分钟) - 性能测试是资源密集型操作
router.post('/', validateUrl, strictLimiter, async (req: Request, res: Response) => {
  try {
    const { url, config, notificationEmail } = req.body;

    // Validate email format if provided
    if (notificationEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(notificationEmail)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid email format',
        });
        return;
      }
    }

    // 🌐 自动获取请求来源的完整 URL (协议 + 域名 + 端口)
    // 优先使用 X-Forwarded-Host (包含端口), 然后使用 Host 头
    const protocol = req.protocol; // http 或 https
    const forwardedHost = req.get('x-forwarded-host'); // Nginx 转发的原始 Host (可能包含端口)
    const host = forwardedHost || req.get('host'); // 回退到 Host 头

    // 如果 host 不包含端口,但请求来自非标准端口,需要添加端口号
    let originUrl = `${protocol}://${host}`;

    // 检查是否需要添加端口号 (仅当 host 中没有端口,且不是标准端口时)
    if (!host?.includes(':')) {
      const forwardedPort = req.get('x-forwarded-port'); // Nginx 转发的原始端口
      if (forwardedPort &&
          ((protocol === 'http' && forwardedPort !== '80') ||
           (protocol === 'https' && forwardedPort !== '443'))) {
        originUrl = `${protocol}://${host}:${forwardedPort}`;
      }
    }

    console.log(`[Tests API] Request origin: ${originUrl} (host: ${host}, x-forwarded-host: ${forwardedHost}, x-forwarded-port: ${req.get('x-forwarded-port')})`);

    // Create test request with pending status
    const testRequest = await testRequestRepository.create(url, config, notificationEmail, originUrl);

    // Start test execution asynchronously (don't await)
    testExecutionService.executeTest(testRequest.id, url, config).catch((error) => {
      console.error(`Test execution failed for ${testRequest.id}:`, error);
    });

    // Return 201 with test request
    res.status(201).json({
      id: testRequest.id,
      url: testRequest.url,
      requestedAt: testRequest.requestedAt,
      status: testRequest.status,
      config: testRequest.config,
    });
  } catch (error) {
    console.error('Failed to create test request:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create test request',
    });
  }
});

// GET /api/v1/tests/:testId - Get test request status and results
router.get('/:testId', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const testRequest = await testRequestRepository.findById(testId);

    if (!testRequest) {
      res.status(404).json({
        error: 'Not Found',
        message: `Test request ${testId} not found`,
      });
      return;
    }

    // 如果测试已完成,获取报告数据
    let reportData = {};
    if (testRequest.status === 'completed') {
      try {
        const report = await testReportRepository.findByTestRequestId(testId);
        if (report) {
          reportData = {
            overallScore: report.overallScore,
            totalChecks: report.totalChecks,
            passedChecks: report.passedChecks,
            failedChecks: report.failedChecks,
            warningChecks: report.warningChecks,
            testDuration: report.testDuration,
            completedAt: report.completedAt,
            reportId: report.id,
          };
        }
      } catch (error) {
        console.error('Failed to get report data:', error);
        // 即使获取报告失败,也返回基本信息
      }
    }

    res.json({
      id: testRequest.id,
      url: testRequest.url,
      requestedAt: testRequest.requestedAt,
      status: testRequest.status,
      config: testRequest.config,
      ...reportData,
    });
  } catch (error) {
    console.error('Failed to get test request:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve test request',
    });
  }
});

// GET /api/v1/tests/:testId/report - Get test report by test request ID
router.get('/:testId/report', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    // Find test report by test request ID
    const report = await testReportRepository.findByTestRequestId(testId);

    if (!report) {
      res.status(404).json({
        error: 'Not Found',
        message: `Test report for test request ${testId} not found`,
      });
      return;
    }

    // Get UI test results, performance results, and rendering snapshots from Bitable report
    const uiTestResults = report.uiTestResults || [];
    const performanceResults = report.performanceResults || [];
    const renderingSnapshots = report.renderingSnapshots || [];

    // Return complete report
    res.json({
      ...report,
      uiTestResults,
      performanceResults,
      renderingSnapshots,
    });
  } catch (error) {
    console.error('Failed to get test report:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve test report',
    });
  }
});

export default router;
