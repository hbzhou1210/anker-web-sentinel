import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import discountReportRepo from '../../models/repositories/BitableDiscountReportRepository.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取 output 目录路径
const getOutputDir = () => {
  // __dirname is backend/dist/api/routes, need to go up 4 levels to project root, then into tools
  return path.join(__dirname, '../../../../tools/function-discount-checker/output');
};

// 获取工具目录路径
const getToolDir = () => {
  return path.join(__dirname, '../../../../tools/function-discount-checker');
};

/**
 * GET /api/v1/discount-rule/reports
 * 获取历史报告列表(从 Bitable)
 */
router.get('/reports', async (req, res) => {
  try {
    const { limit = '20', offset = '0', shopDomain, type } = req.query;

    // 从 Bitable 获取报告
    const { reports, total } = await discountReportRepo.findAll({
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      shopDomain: shopDomain as string | undefined,
      type: type as 'single' | 'batch' | undefined,
    });

    // 转换为前端格式
    const formattedReports = reports.map(report => ({
      reportId: report.reportId,
      type: report.type,
      shopDomain: report.shopDomain,
      ruleIds: report.ruleIds,
      createdAt: report.createdAt.toISOString(),
      summary: report.summary,
      status: report.status,
      // 保持向后兼容
      url: report.htmlReportUrl || `/discount-rule-output/${report.reportId}.html`,
    }));

    res.json({
      success: true,
      reports: formattedReports,
      total,
    });
  } catch (error) {
    console.error('获取报告列表失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 动态导入工具模块
 */
async function importToolModules() {
  const toolDir = getToolDir();
  const { checkDiscountStatus } = await import(path.join(toolDir, 'src/checker.js'));
  const { generateHtmlReport } = await import(path.join(toolDir, 'src/htmlGenerator.js'));
  const { batchCheckDiscountStatus } = await import(path.join(toolDir, 'src/batchChecker.js'));
  const { generateBatchHtmlReport } = await import(path.join(toolDir, 'src/batchHtmlGenerator.js'));

  return {
    checkDiscountStatus,
    generateHtmlReport,
    batchCheckDiscountStatus,
    generateBatchHtmlReport
  };
}

/**
 * 执行折扣规则查询的辅助函数
 * 直接调用工具的模块函数
 */
async function executeDiscountCheck(ruleIds: number[], shopDomain: string): Promise<any> {
  const {
    checkDiscountStatus,
    generateHtmlReport,
    batchCheckDiscountStatus,
    generateBatchHtmlReport
  } = await importToolModules();

  const outputDir = getOutputDir();

  // 确保输出目录存在
  try {
    await fs.access(outputDir);
  } catch (error) {
    console.log('⚠️  Output directory not found, creating:', outputDir);
    await fs.mkdir(outputDir, { recursive: true });
    console.log('✓ Output directory created successfully');
  }

  let result: any;
  let detailResults: any;
  let reportFilename: string;

  if (ruleIds.length === 1) {
    // 单个规则查询
    result = await checkDiscountStatus(ruleIds[0], shopDomain);
    detailResults = result;

    // 仍然生成 HTML(向后兼容)
    const reportPath = generateHtmlReport(result, `${outputDir}/report-${Date.now()}.html`);
    reportFilename = path.basename(reportPath);
  } else {
    // 批量查询
    result = await batchCheckDiscountStatus(ruleIds, shopDomain);
    detailResults = result;

    const reportPath = generateBatchHtmlReport(result, `${outputDir}/batch-report-${Date.now()}.html`);
    reportFilename = path.basename(reportPath);
  }

  // 保存到 Bitable
  const reportId = Date.now().toString();
  const discountReport = {
    reportId,
    type: ruleIds.length === 1 ? 'single' as const : 'batch' as const,
    shopDomain,
    ruleIds,
    createdAt: new Date(),
    summary: ruleIds.length === 1 ? {
      ruleId: ruleIds[0],
      status: (result.overallStatus || 'error') as 'active' | 'inactive' | 'error',
      totalVariants: result.summary.totalVariants,
      activeVariants: result.summary.activeVariants,
      inactiveVariants: result.summary.inactiveVariants,
      errorVariants: result.summary.errorVariants
    } : {
      totalRules: result.summary.totalRules,
      activeRules: result.summary.activeRules,
      inactiveRules: result.summary.inactiveRules,
      errorRules: result.summary.errorRules
    },
    detailResults,
    status: (result.overallStatus || 'error') as 'active' | 'inactive' | 'error',
    htmlReportUrl: `/discount-rule-output/${reportFilename}`,
  };

  await discountReportRepo.create(discountReport);

  return {
    success: true,
    reportId,
    type: discountReport.type,
    summary: discountReport.summary,
    reportFilename, // 保留用于向后兼容
  };
}

/**
 * POST /api/check-discount (compatibility route for tool interface)
 * POST /api/v1/discount-rule/check
 * 查询折扣规则状态
 */
const checkHandler = async (req: express.Request, res: express.Response) => {
  try {
    const { ruleIds, shopDomain } = req.body;

    // 验证参数
    if (!ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'rule_ids 必须是非空数组'
      });
    }

    if (!shopDomain || !shopDomain.includes('.myshopify.com')) {
      return res.status(400).json({
        success: false,
        error: 'shop_domain 必须是有效的 Shopify 域名'
      });
    }

    console.log(`\n收到查询请求: rule_ids=${ruleIds.join(',')}, shop_domain=${shopDomain}`);

    // 执行查询
    const result = await executeDiscountCheck(ruleIds, shopDomain);

    if (result.success && result.reportId) {
      res.json({
        success: true,
        reportId: result.reportId,
        type: result.type,
        summary: result.summary,
        // 前端可以用 reportId 查询详情
        detailUrl: `/api/v1/discount-rule/reports/${result.reportId}`,
        // 向后兼容:仍返回 HTML 报告 URL
        reportUrl: `/discount-rule-output/${result.reportFilename}`,
      });
    } else {
      throw new Error('查询失败，未能生成报告');
    }

  } catch (error) {
    console.error('查询折扣规则失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// 注册两个路径指向同一个处理函数
router.post('/check', checkHandler);
router.post('/check-discount', checkHandler);

/**
 * GET /api/v1/discount-rule/reports/:reportId
 * 获取报告详细信息
 */
router.get('/reports/:reportId', async (req: express.Request, res: express.Response) => {
  try {
    const { reportId } = req.params;

    const report = await discountReportRepo.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: '报告不存在'
      });
    }

    res.json({
      success: true,
      report: {
        reportId: report.reportId,
        type: report.type,
        shopDomain: report.shopDomain,
        ruleIds: report.ruleIds,
        createdAt: report.createdAt.toISOString(),
        summary: report.summary,
        detailResults: report.detailResults,
        status: report.status,
        htmlReportUrl: report.htmlReportUrl,
      }
    });
  } catch (error) {
    console.error('获取报告详情失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/discount-rule/check-all
 * 查询店铺下所有买赠规则状态
 */
router.post('/check-all', async (req: express.Request, res: express.Response) => {
  try {
    const { shopDomain } = req.body;

    // 验证参数
    if (!shopDomain || !shopDomain.includes('.myshopify.com')) {
      return res.status(400).json({
        success: false,
        error: 'shop_domain 必须是有效的 Shopify 域名'
      });
    }

    console.log(`\n收到全量查询请求: shop_domain=${shopDomain}`);

    // 调用 check-all-rules.js 脚本
    const toolDir = getToolDir();
    const scriptPath = path.join(toolDir, 'check-all-rules.js');

    const result = await new Promise<{
      reportFilename: string;
      summary: {
        totalRules: number;
        totalVariants: number;
        normalVariants: number;
        abnormalVariants: number;
      };
    }>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn('node', [scriptPath, shopDomain], {
        cwd: toolDir
      });

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        // 实时输出日志到控制台
        process.stdout.write(data);
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Script exited with code ${code}\n${stderr}`));
          return;
        }

        // 从输出中提取报告文件名
        const reportMatch = stdout.match(/batch-check-\d+\.html/);
        if (!reportMatch) {
          reject(new Error('未能生成报告'));
          return;
        }

        // 从输出中提取统计信息
        const statsMatch = stdout.match(/检查规则: (\d+) 条[\s\S]*?总 Variant: (\d+) 个[\s\S]*?状态正常: (\d+) 个[\s\S]*?状态异常: (\d+) 个/);

        if (!statsMatch) {
          reject(new Error('未能解析统计信息'));
          return;
        }

        resolve({
          reportFilename: reportMatch[0],
          summary: {
            totalRules: parseInt(statsMatch[1]),
            totalVariants: parseInt(statsMatch[2]),
            normalVariants: parseInt(statsMatch[3]),
            abnormalVariants: parseInt(statsMatch[4])
          }
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });

    const reportUrl = `/discount-rule-output/${result.reportFilename}`;

    res.json({
      success: true,
      reportUrl,
      summary: result.summary
    });

    console.log(`✓ 全量查询完成，报告已生成: ${result.reportFilename}`);

  } catch (error) {
    console.error('全量查询失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
