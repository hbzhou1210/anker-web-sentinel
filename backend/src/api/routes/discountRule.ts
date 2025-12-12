import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

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
 * 获取历史报告列表
 */
router.get('/reports', async (req, res) => {
  try {
    const outputDir = getOutputDir();

    // 读取 output 目录
    const files = await fs.readdir(outputDir);

    // 过滤 HTML 文件并获取文件信息
    const reports = await Promise.all(
      files
        .filter(file => file.endsWith('.html'))
        .map(async (file) => {
          const filePath = path.join(outputDir, file);
          const stats = await fs.stat(filePath);

          // 判断报告类型
          const isBatch = file.startsWith('batch-report-');

          return {
            filename: file,
            url: `/discount-rule-output/${file}`,
            type: isBatch ? 'batch' : 'single',
            createdAt: stats.mtime.toISOString(),
            size: stats.size
          };
        })
    );

    // 按创建时间倒序排序
    reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      reports,
      total: reports.length
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

  if (ruleIds.length === 1) {
    // 单个规则查询
    const result = await checkDiscountStatus(ruleIds[0], shopDomain);
    const reportPath = generateHtmlReport(result, `${outputDir}/report-${Date.now()}.html`);
    const reportFilename = path.basename(reportPath);

    return {
      success: true,
      type: 'single',
      reportFilename,
      summary: {
        ruleId: ruleIds[0],
        status: result.overallStatus || 'error',  // 如果没有status，说明查询出错
        totalVariants: result.summary.totalVariants,
        activeVariants: result.summary.activeVariants,
        inactiveVariants: result.summary.inactiveVariants,
        errorVariants: result.summary.errorVariants
      }
    };
  } else {
    // 批量查询
    const batchResult = await batchCheckDiscountStatus(ruleIds, shopDomain);
    const reportPath = generateBatchHtmlReport(batchResult, `${outputDir}/batch-report-${Date.now()}.html`);
    const reportFilename = path.basename(reportPath);

    return {
      success: true,
      type: 'batch',
      reportFilename,
      summary: {
        totalRules: batchResult.summary.totalRules,
        activeRules: batchResult.summary.activeRules,
        inactiveRules: batchResult.summary.inactiveRules,
        errorRules: batchResult.summary.errorRules
      }
    };
  }
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

    if (result.success && result.reportFilename) {
      const reportUrl = `/discount-rule-output/${result.reportFilename}`;

      res.json({
        success: true,
        type: result.type,
        reportUrl,
        summary: result.summary
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

export default router;
