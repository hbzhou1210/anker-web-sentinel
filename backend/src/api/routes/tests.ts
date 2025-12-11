import { Router, Request, Response } from 'express';
import { validateUrl } from '../middleware/validateUrl.js';
import { rateLimit } from '../middleware/rateLimit.js';

// 使用内存版 TestRequest Repository (只用于追踪异步任务状态)
import testRequestRepository from '../../models/repositories/InMemoryTestRequestRepository.js';

// 使用 Bitable 存储测试报告
import testReportRepository from '../../models/repositories/BitableTestReportRepository.js';
import testExecutionService from '../../services/TestExecutionService.js';

console.log(`[Tests Route] Using in-memory storage for test requests, Bitable for test reports`);

const router = Router();

// POST /api/v1/tests - Create a new test request
router.post('/', validateUrl, rateLimit, async (req: Request, res: Response) => {
  try {
    console.log('[API] Content-Type:', req.headers['content-type']);
    console.log('[API] Full request body:', JSON.stringify(req.body, null, 2));
    console.log('[API] Body keys:', Object.keys(req.body));
    const { url, config, notificationEmail } = req.body;
    console.log(`[API] Received request - url: ${url}, notificationEmail: ${notificationEmail}, type: ${typeof notificationEmail}`);

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

    // Create test request with pending status
    console.log(`[API] Creating test request with email: ${notificationEmail}`);
    const testRequest = await testRequestRepository.create(url, config, notificationEmail);
    console.log(`[API] Test request created with notificationEmail: ${testRequest.notificationEmail}`);

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

// GET /api/v1/tests/:testId - Get test request status
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

    res.json({
      id: testRequest.id,
      url: testRequest.url,
      requestedAt: testRequest.requestedAt,
      status: testRequest.status,
      config: testRequest.config,
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

    // Get UI test results and performance results from Bitable report
    const uiTestResults = report.uiTestResults || [];
    const performanceResults = report.performanceResults || [];

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

export default router;
