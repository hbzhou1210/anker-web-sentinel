import { Router, Request, Response } from 'express';
import browserPool from '../../automation/BrowserPool.js';
import { ResponsiveTestingService } from '../../automation/ResponsiveTestingService.js';
import { ResponsiveTestRepository } from '../../models/repositories/ResponsiveTestRepository.js';
import { DeviceType } from '../../models/entities.js';

const router = Router();
const responsiveTestingService = new ResponsiveTestingService();
const responsiveTestRepository = new ResponsiveTestRepository();

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
  const browser = await browserPool.acquire();

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

    // 执行测试
    const page = await browser.newPage();
    const results = [];

    for (const device of devicesToTest) {
      console.log(`Testing on ${device.name}...`);
      const result = await responsiveTestingService.testOnDevice(page, url, device);
      results.push(result);
    }

    await page.close();

    // 计算统计数据
    const stats = {
      totalDevices: results.length,
      passed: results.filter(r =>
        !r.hasHorizontalScroll &&
        r.hasViewportMeta &&
        r.fontSizeReadable &&
        r.touchTargetsAdequate &&
        r.imagesResponsive
      ).length,
      failed: results.filter(r =>
        r.hasHorizontalScroll ||
        !r.hasViewportMeta ||
        !r.fontSizeReadable ||
        !r.touchTargetsAdequate ||
        !r.imagesResponsive
      ).length,
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
  } finally {
    await browserPool.release(browser);
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
