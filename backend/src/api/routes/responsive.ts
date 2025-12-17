import { Router, Request, Response } from 'express';
import browserPool from '../../automation/BrowserPool.js';
import { ResponsiveTestingService } from '../../automation/ResponsiveTestingService.js';
import { BitableResponsiveTestRepository } from '../../models/repositories/BitableResponsiveTestRepository.js';
import { DeviceType, ResponsiveTestResult, ResponsiveTestIssue } from '../../models/entities.js';

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
 * 执行响应式测试
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

    // 并行执行测试 - 限制并发数量避免资源耗尽
    // 注意: 每个设备使用独立的browser实例,避免browser崩溃影响其他测试
    const CONCURRENT_LIMIT = 3; // 同时最多测试3个设备
    console.log(`Starting tests on ${devicesToTest.length} devices (max ${CONCURRENT_LIMIT} concurrent)...`);
    const startTime = Date.now();

    // 辅助函数:带重试的设备测试
    const testDeviceWithRetry = async (device: any, maxRetries = 2): Promise<ResponsiveTestResult> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let deviceBrowser = null;
        try {
          // 获取浏览器实例
          deviceBrowser = await browserPool.acquire();

          // 验证浏览器连接状态
          if (!deviceBrowser.isConnected()) {
            throw new Error('Browser is not connected');
          }

          // 创建页面
          const page = await deviceBrowser.newPage();
          try {
            console.log(`Testing on ${device.name}... (attempt ${attempt + 1}/${maxRetries + 1})`);
            const result = await responsiveTestingService.testOnDevice(page, url, device);
            return result;
          } finally {
            await page.close().catch(err => {
              console.warn(`Failed to close page for ${device.name}:`, err.message);
            });
          }
        } catch (error: any) {
          lastError = error;
          console.error(`Failed to test on ${device.name} (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);

          // 检查是否是浏览器崩溃相关错误
          const isBrowserCrash =
            error.message?.includes('Target page, context or browser has been closed') ||
            error.message?.includes('Browser is not connected') ||
            error.message?.includes('Protocol error');

          // 如果是最后一次尝试或不是浏览器崩溃错误,抛出异常
          if (attempt === maxRetries || !isBrowserCrash) {
            throw error;
          }

          // 等待一小段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        } finally {
          // 释放浏览器
          if (deviceBrowser) {
            await browserPool.release(deviceBrowser).catch(err => {
              console.warn(`Failed to release browser for ${device.name}:`, err.message);
            });
          }
        }
      }

      // 如果所有重试都失败,抛出最后的错误
      throw lastError || new Error('All retries failed');
    };

    // 分批并行执行测试
    const results: ResponsiveTestResult[] = [];
    for (let i = 0; i < devicesToTest.length; i += CONCURRENT_LIMIT) {
      const batch = devicesToTest.slice(i, i + CONCURRENT_LIMIT);
      console.log(`Testing batch ${Math.floor(i / CONCURRENT_LIMIT) + 1}/${Math.ceil(devicesToTest.length / CONCURRENT_LIMIT)}: ${batch.map(d => d.name).join(', ')}`);

      const batchResults = await Promise.all(
        batch.map(device => testDeviceWithRetry(device))
      );

      results.push(...batchResults);
    }

    const totalTime = Date.now() - startTime;
    console.log(`✓ Completed ${devicesToTest.length} device tests in ${totalTime}ms`);

    // 计算统计数据
    // 只有 error 级别的问题才算测试失败,warning 级别不影响通过状态
    const stats = {
      totalDevices: results.length,
      passed: results.filter(r => !r.issues.some(issue => issue.severity === 'error')).length,
      failed: results.filter(r => r.issues.some(issue => issue.severity === 'error')).length,
      totalIssues: results.reduce((sum, r) => sum + r.issues.length, 0),
    };

    res.json({
      success: true,
      data: {
        url,
        results,
        stats,
      },
    });
  } catch (error) {
    console.error('Failed to run responsive test:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : '响应式测试失败',
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
