import { Router, Request, Response } from 'express';
import browserPool from '../../automation/BrowserPool.js';
import { ResponsiveTestingService } from '../../automation/ResponsiveTestingService.js';
import { BitableResponsiveTestRepository } from '../../models/repositories/BitableResponsiveTestRepository.js';
import { DeviceType, ResponsiveTestResult, ResponsiveTestIssue } from '../../models/entities.js';
import asyncTaskService from '../../services/AsyncTaskService.js';

const router = Router();
const responsiveTestingService = new ResponsiveTestingService();

// Use Bitable for responsive test repository
const responsiveTestRepository = new BitableResponsiveTestRepository();

console.log('[ResponsiveRoute] Using bitable storage');

/**
 * GET /api/v1/responsive/devices
 * 获取所有启用的设备预设
 */
router.get('/devices', async (_req: Request, res: Response): Promise<void> => {
  try {
    const devices = await responsiveTestRepository.getEnabledDevices();

    res.json({
      success: true,
      data: devices,
    });
  } catch (error) {
    console.error('Failed to get devices:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取设备列表失败',
    });
  }
});

/**
 * GET /api/v1/responsive/devices/:type
 * 获取指定类型的设备预设
 */
router.get('/devices/:type', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;

    if (!['mobile', 'tablet', 'desktop'].includes(type)) {
      res.status(400).json({
        error: 'Invalid device type',
        message: '设备类型必须是 mobile, tablet 或 desktop',
      });
      return;
    }

    const devices = await responsiveTestRepository.getDevicesByType(type as DeviceType);

    res.json({
      success: true,
      data: devices,
    });
  } catch (error) {
    console.error('Failed to get devices by type:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取设备列表失败',
    });
  }
});

/**
 * POST /api/v1/responsive/test
 * 执行响应式测试 (异步)
 * 立即返回任务ID,通过 /api/v1/responsive/tasks/:taskId 查询结果
 */
router.post('/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, deviceIds } = req.body;

    if (!url) {
      res.status(400).json({
        error: 'Missing required fields',
        message: '请提供 URL',
      });
      return;
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      res.status(400).json({
        error: 'Invalid URL',
        message: 'URL格式无效',
      });
      return;
    }

    // 获取要测试的设备
    const allDevices = await responsiveTestRepository.getEnabledDevices();
    let devicesToTest = allDevices;

    if (deviceIds && Array.isArray(deviceIds) && deviceIds.length > 0) {
      devicesToTest = allDevices.filter(d => deviceIds.includes(d.id));
    }

    if (devicesToTest.length === 0) {
      res.status(400).json({
        error: 'No devices to test',
        message: '没有可用的测试设备',
      });
      return;
    }

    // 创建异步任务
    const taskId = await asyncTaskService.executeTask(
      'responsive-test',
      async (taskId) => {
        return await executeResponsiveTest(url, devicesToTest, taskId);
      },
      { url, deviceCount: devicesToTest.length }
    );

    // 立即返回任务ID
    res.json({
      success: true,
      data: {
        taskId,
        message: '响应式测试已启动',
        deviceCount: devicesToTest.length,
        estimatedTime: Math.ceil(devicesToTest.length / 3) * 60, // 秒
      },
    });
  } catch (error) {
    console.error('Failed to start responsive test:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : '启动响应式测试失败',
    });
  }
});

/**
 * 执行响应式测试的核心逻辑
 */
async function executeResponsiveTest(
  url: string,
  devicesToTest: any[],
  taskId: string
): Promise<{
  url: string;
  results: ResponsiveTestResult[];
  stats: any;
}> {
  // 并行执行测试 - 限制并发数量避免资源耗尽
  // 注意: 每个设备使用独立的browser实例,避免browser崩溃影响其他测试
  const CONCURRENT_LIMIT = 3; // 同时最多测试3个设备
  console.log(`[Task ${taskId}] Starting tests on ${devicesToTest.length} devices (max ${CONCURRENT_LIMIT} concurrent)...`);
  const startTime = Date.now();

  // 更新任务进度
  asyncTaskService.updateTaskProgress(taskId, 0, `开始测试 ${devicesToTest.length} 个设备`);

  // 辅助函数:带重试的设备测试
  const testDeviceWithRetry = async (device: any, maxRetries = 2): Promise<ResponsiveTestResult> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let deviceBrowser = null;
      let page = null;

      try {
        // 获取浏览器实例
        deviceBrowser = await browserPool.acquire();

        // 双重验证浏览器连接状态
        if (!deviceBrowser.isConnected()) {
          console.warn(`[Task ${taskId}] [${device.name}] Browser not connected after acquire, retrying...`);
          throw new Error('Browser is not connected');
        }

        // 添加短暂延迟，确保浏览器完全就绪
        await new Promise(resolve => setTimeout(resolve, 100));

        // 再次检查连接状态
        if (!deviceBrowser.isConnected()) {
          console.warn(`[Task ${taskId}] [${device.name}] Browser disconnected during wait, retrying...`);
          throw new Error('Browser disconnected during initialization');
        }

        // 使用 try-catch 包装 newPage() 调用
        try {
          page = await deviceBrowser.newPage();
        } catch (pageError: any) {
          console.error(`[Task ${taskId}] [${device.name}] Failed to create page:`, pageError.message);
          throw new Error(`Failed to create page: ${pageError.message}`);
        }

        // 验证页面创建成功
        if (!page || page.isClosed()) {
          throw new Error('Page was closed immediately after creation');
        }

        console.log(`[Task ${taskId}] Testing on ${device.name}... (attempt ${attempt + 1}/${maxRetries + 1})`);
        const result = await responsiveTestingService.testOnDevice(page, url, device);

        console.log(`[Task ${taskId}] ✓ Completed test on ${device.name}`);
        return result;

      } catch (error: any) {
        lastError = error;
        console.error(`[Task ${taskId}] Failed to test on ${device.name} (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);

        // 检查是否是浏览器崩溃相关错误
        const isBrowserCrash =
          error.message?.includes('Target page, context or browser has been closed') ||
          error.message?.includes('Browser is not connected') ||
          error.message?.includes('Browser disconnected') ||
          error.message?.includes('Failed to create page') ||
          error.message?.includes('Protocol error');

        // 如果是浏览器崩溃，标记浏览器需要替换
        if (isBrowserCrash && deviceBrowser) {
          console.warn(`[Task ${taskId}] [${device.name}] Detected browser crash, marking for replacement`);
        }

        // 如果是最后一次尝试，抛出异常
        if (attempt === maxRetries) {
          throw error;
        }

        // 如果不是浏览器崩溃错误且不是第一次尝试，抛出异常
        if (!isBrowserCrash && attempt > 0) {
          throw error;
        }

        // 等待后重试，每次等待时间递增
        const waitTime = 1000 * (attempt + 1);
        console.log(`[Task ${taskId}] [${device.name}] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));

      } finally {
        // 确保页面被关闭
        if (page && !page.isClosed()) {
          await page.close().catch(err => {
            console.warn(`[Task ${taskId}] Failed to close page for ${device.name}:`, err.message);
          });
        }

        // 释放浏览器
        if (deviceBrowser) {
          await browserPool.release(deviceBrowser).catch(err => {
            console.warn(`[Task ${taskId}] Failed to release browser for ${device.name}:`, err.message);
          });
        }
      }
    }

    // 如果所有重试都失败,抛出最后的错误
    throw lastError || new Error('All retries failed');
  };

  // 分批并行执行测试
  const results: ResponsiveTestResult[] = [];
  let completedDevices = 0;

  for (let i = 0; i < devicesToTest.length; i += CONCURRENT_LIMIT) {
    const batch = devicesToTest.slice(i, i + CONCURRENT_LIMIT);
    const batchNumber = Math.floor(i / CONCURRENT_LIMIT) + 1;
    const totalBatches = Math.ceil(devicesToTest.length / CONCURRENT_LIMIT);

    console.log(`[Task ${taskId}] Testing batch ${batchNumber}/${totalBatches}: ${batch.map(d => d.name).join(', ')}`);

    // 更新进度
    const progress = Math.round((completedDevices / devicesToTest.length) * 100);
    asyncTaskService.updateTaskProgress(
      taskId,
      progress,
      `正在测试第 ${batchNumber}/${totalBatches} 批 (${completedDevices}/${devicesToTest.length} 已完成)`
    );

    // 使用 Promise.allSettled 替代 Promise.all，确保即使有失败也不影响其他任务
    const batchSettled = await Promise.allSettled(
      batch.map(device => testDeviceWithRetry(device))
    );

    // 处理结果
    batchSettled.forEach((settled, index) => {
      if (settled.status === 'fulfilled') {
        results.push(settled.value);
      } else {
        // 失败的设备创建一个错误结果
        const device = batch[index];
        console.error(`[Task ${taskId}] Device ${device.name} test failed:`, settled.reason);
        results.push({
          id: '',
          testReportId: '',
          deviceName: device.name,
          deviceType: device.deviceType,
          viewportWidth: device.viewportWidth,
          viewportHeight: device.viewportHeight,
          userAgent: device.userAgent,
          hasHorizontalScroll: false,
          hasViewportMeta: false,
          fontSizeReadable: false,
          touchTargetsAdequate: false,
          imagesResponsive: false,
          issues: [{
            type: 'horizontal_scroll',
            severity: 'error',
            message: `测试失败: ${settled.reason?.message || '未知错误'}`,
          }],
          testDuration: 0,
          createdAt: new Date(),
        } as ResponsiveTestResult);
      }
    });

    completedDevices += batch.length;

    // 批次间添加短暂延迟，确保浏览器资源完全释放
    if (i + CONCURRENT_LIMIT < devicesToTest.length) {
      console.log(`[Task ${taskId}] Waiting 1s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`[Task ${taskId}] ✓ Completed ${devicesToTest.length} device tests in ${totalTime}ms`);

  // 计算统计数据
  // 只有 error 级别的问题才算测试失败,warning 级别不影响通过状态
  const stats = {
    totalDevices: results.length,
    passed: results.filter(r => !r.issues.some(issue => issue.severity === 'error')).length,
    failed: results.filter(r => r.issues.some(issue => issue.severity === 'error')).length,
    totalIssues: results.reduce((sum, r) => sum + r.issues.length, 0),
    duration: totalTime,
  };

  // 更新最终进度
  asyncTaskService.updateTaskProgress(taskId, 100, '测试完成');

  return {
    url,
    results,
    stats,
  };
}

/**
 * GET /api/v1/responsive/tasks/:taskId
 * 查询异步任务状态和结果
 */
router.get('/tasks/:taskId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;

    const task = asyncTaskService.getTask(taskId);

    if (!task) {
      res.status(404).json({
        error: 'Task not found',
        message: '任务不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        progress: task.progress || 0,
        progressMessage: task.progressMessage,
        result: task.result,
        error: task.error,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        metadata: task.metadata,
      },
    });
  } catch (error) {
    console.error('Failed to get task status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取任务状态失败',
    });
  }
});

/**
 * GET /api/v1/responsive/results/:reportId
 * 获取测试报告的响应式测试结果
 */
router.get('/results/:reportId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportId } = req.params;

    const results = await responsiveTestRepository.getByReportId(reportId);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Failed to get responsive test results:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取测试结果失败',
    });
  }
});

export default router;
