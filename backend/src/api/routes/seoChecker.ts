import { Router, Request, Response } from 'express';
import { seoCheckerService } from '../../services/SEOCheckerService.js';

const router = Router();

/**
 * POST /api/v1/seo-checker/check
 * 检查指定URL的SEO信息
 *
 * Request body:
 * {
 *   "url": "https://example.com/page"
 * }
 *
 * Response:
 * {
 *   "url": "https://example.com/page",
 *   "title": "Page Title",
 *   "hreflangLinks": [
 *     {
 *       "lang": "en",
 *       "href": "https://example.com/en/page",
 *       "isValid": true,
 *       "statusCode": 200
 *     }
 *   ],
 *   "article": {
 *     "dateModified": "2024-01-01T00:00:00Z",
 *     "datePublished": "2023-12-01T00:00:00Z",
 *     "author": "John Doe"
 *   },
 *   "checkTime": "2024-01-15T10:30:00Z"
 * }
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    // 验证输入
    if (!url) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'URL is required'
      });
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch (urlError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid URL format'
      });
    }

    console.log(`[API] SEO check request received for: ${url}`);

    // 执行 SEO 检查
    const report = await seoCheckerService.checkSEO(url);

    // 返回结果
    res.json(report);

  } catch (error: any) {
    console.error('[API] Error in SEO checker:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/seo-checker/health
 * 健康检查接口
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'SEO Checker',
    timestamp: new Date().toISOString()
  });
});

export default router;
