/**
 * 链接爬取 API 路由
 *
 * 提供链接爬取功能的 RESTful API
 */

import express, { Request, Response } from 'express';
import linkCrawlerService from '../../services/LinkCrawlerService.js';

const router = express.Router();

/**
 * POST /api/v1/link-crawler
 * 创建新的链接爬取任务
 *
 * Body:
 * - mode: 'crawl' | '404check' | 'csv' (可选,默认 'crawl') - 任务模式
 * - startUrl: string (mode=crawl/404check时必填) - 起始 URL
 * - maxDepth: number (mode=crawl时可选,默认2) - 最大爬取深度
 * - urls: string[] (mode=csv时必填) - URL列表
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { mode = 'crawl', startUrl, maxDepth = 2, urls } = req.body;

    // 验证模式
    if (!['crawl', '404check', 'csv'].includes(mode)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'mode must be one of: crawl, 404check, csv'
      });
    }

    let task;

    if (mode === 'csv') {
      // CSV 模式: 批量检查 URL 列表
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'urls array is required for CSV mode'
        });
      }

      // 验证 URL 格式
      for (const url of urls) {
        try {
          new URL(url);
        } catch (error) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `Invalid URL format: ${url}`
          });
        }
      }

      console.log(`[API] Creating CSV check task: ${urls.length} URLs`);
      task = await linkCrawlerService.startCsvCheck(urls);

    } else if (mode === '404check') {
      // 404 检查模式
      if (!startUrl) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'startUrl is required for 404check mode'
        });
      }

      // 验证 URL 格式
      try {
        new URL(startUrl);
      } catch (error) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid URL format'
        });
      }

      console.log(`[API] Creating 404 check task: ${startUrl}`);
      task = await linkCrawlerService.start404Check(startUrl);

    } else {
      // 爬取模式 (原有逻辑)
      if (!startUrl) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'startUrl is required for crawl mode'
        });
      }

      // 验证 URL 格式
      try {
        new URL(startUrl);
      } catch (error) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid URL format'
        });
      }

      // 验证深度
      if (maxDepth < 1 || maxDepth > 5) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'maxDepth must be between 1 and 5'
        });
      }

      console.log(`[API] Creating link crawl task: ${startUrl}, maxDepth=${maxDepth}`);
      task = await linkCrawlerService.startCrawl(startUrl, maxDepth);
    }

    res.status(201).json(task);
  } catch (error: any) {
    console.error('[API] Error creating crawl task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/link-crawler
 * 获取所有爬取任务
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const tasks = linkCrawlerService.getAllTasks();
    res.json(tasks);
  } catch (error: any) {
    console.error('[API] Error getting crawl tasks:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/link-crawler/:taskId
 * 获取指定爬取任务的详情
 */
router.get('/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = linkCrawlerService.getTask(taskId);

    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Crawl task ${taskId} not found`
      });
    }

    res.json(task);
  } catch (error: any) {
    console.error('[API] Error getting crawl task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/v1/link-crawler/:taskId
 * 删除指定的爬取任务
 */
router.delete('/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const deleted = linkCrawlerService.deleteTask(taskId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Crawl task ${taskId} not found`
      });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    console.error('[API] Error deleting crawl task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/link-crawler/:taskId/cancel
 * 取消正在运行的爬取任务
 */
router.post('/:taskId/cancel', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const cancelled = linkCrawlerService.cancelTask(taskId);

    if (!cancelled) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Task cannot be cancelled (not found or not running)'
      });
    }

    res.json({ message: 'Task cancelled successfully' });
  } catch (error: any) {
    console.error('[API] Error cancelling crawl task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

export default router;
