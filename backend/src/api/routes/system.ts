/**
 * 系统监控路由
 *
 * 提供系统状态监控接口:
 * - 任务队列状态
 * - 系统资源使用情况
 * - 健康检查
 */

import { Router, Request, Response } from 'express';
import taskQueue from '../../services/TaskQueueService.js';

const router = Router();

/**
 * GET /api/v1/system/queue-status
 * 获取任务队列状态
 */
router.get('/queue-status', async (req: Request, res: Response) => {
  try {
    const stats = taskQueue.getStats();
    const queuedTasks = taskQueue.getQueuedTasks();

    res.status(200).json({
      status: 'success',
      data: {
        // 队列统计
        stats: {
          highPriorityRunning: stats.highPriorityRunning,
          lowPriorityQueue: stats.lowPriorityQueue,
          lowPriorityRunning: stats.lowPriorityRunning,
          totalExecuted: stats.totalExecuted,
          totalFailed: stats.totalFailed,
        },

        // 队列中的任务列表
        queuedTasks: queuedTasks.map(task => ({
          id: task.id,
          name: task.name,
          waitTime: Math.round(task.waitTime / 1000), // 转换为秒
        })),

        // 系统状态
        systemStatus: {
          queueHealthy: stats.lowPriorityQueue < 10, // 队列长度小于10为健康
          processingNormal: !stats.lowPriorityRunning || stats.highPriorityRunning < 5,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[System API] Failed to get queue status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve queue status',
    });
  }
});

/**
 * GET /api/v1/system/health
 * 系统健康检查(包含队列状态)
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const stats = taskQueue.getStats();
    const queueHealthy = stats.lowPriorityQueue < 10;

    const health = {
      status: queueHealthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      queue: {
        healthy: queueHealthy,
        queueLength: stats.lowPriorityQueue,
        running: stats.lowPriorityRunning,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
      },
    };

    res.status(200).json(health);
  } catch (error) {
    console.error('[System API] Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
    });
  }
});

/**
 * POST /api/v1/system/queue/clear
 * 清空低优先级队列(管理员操作)
 */
router.post('/queue/clear', async (req: Request, res: Response) => {
  try {
    taskQueue.clearQueue();

    res.status(200).json({
      status: 'success',
      message: 'Low priority queue cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[System API] Failed to clear queue:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear queue',
    });
  }
});

export default router;
