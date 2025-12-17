import { Router, Request, Response } from 'express';
import browserPool from '../automation/BrowserPool.js';

const router = Router();

/**
 * GET /api/v1/monitor/browser-pool
 * 获取浏览器池统计信息
 */
router.get('/browser-pool', async (req: Request, res: Response) => {
  try {
    const stats = browserPool.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting browser pool stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get browser pool stats',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/v1/monitor/browser-pool/detailed
 * 获取浏览器池详细统计信息
 */
router.get('/browser-pool/detailed', async (req: Request, res: Response) => {
  try {
    const stats = browserPool.getDetailedStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting detailed browser pool stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get detailed browser pool stats',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/v1/monitor/health
 * 系统健康检查
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const browserStats = browserPool.getStats();

    // 判断系统是否健康
    const isHealthy =
      browserStats.total > 0 &&
      browserStats.healthy > 0 &&
      browserStats.unhealthy < browserStats.total / 2;

    const health = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      browserPool: {
        total: browserStats.total,
        available: browserStats.available,
        healthy: browserStats.healthy,
        unhealthy: browserStats.unhealthy,
        queued: browserStats.queued,
      },
    };

    res.status(isHealthy ? 200 : 503).json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Error checking health:', error);
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: (error as Error).message,
    });
  }
});

export default router;
