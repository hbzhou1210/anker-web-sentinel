import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { batchCheckDiscountStatus } from './batchChecker.js';
import { generateBatchHtmlReport } from './batchHtmlGenerator.js';
import { checkDiscountStatus } from './checker.js';
import { generateHtmlReport } from './htmlGenerator.js';
import { getFunctionDiscountRuleDetail } from './mcpClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/output', express.static(path.join(__dirname, '../output')));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// 获取历史报告列表
app.get('/api/reports', async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const outputDir = path.join(__dirname, '../output');

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
            url: `/output/${file}`,
            type: isBatch ? 'batch' : 'single',
            createdAt: stats.mtime.toISOString(),
            size: stats.size
          };
        })
    );

    // 按创建时间倒序排序
    reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      reports,
      total: reports.length
    });
  } catch (error) {
    console.error('获取报告列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 查询折扣状态API
app.post('/api/check-discount', async (req, res) => {
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

    let reportPath;
    let reportUrl;

    if (ruleIds.length === 1) {
      // 单个规则查询
      const result = await checkDiscountStatus(ruleIds[0], shopDomain);
      reportPath = generateHtmlReport(result, `output/report-${Date.now()}.html`);
      reportUrl = `/output/${path.basename(reportPath)}`;

      res.json({
        success: true,
        type: 'single',
        reportUrl,
        summary: {
          ruleId: ruleIds[0],
          status: result.overallStatus,
          totalVariants: result.summary.totalVariants,
          activeVariants: result.summary.activeVariants,
          inactiveVariants: result.summary.inactiveVariants,
          errorVariants: result.summary.errorVariants
        }
      });
    } else {
      // 批量查询
      const batchResult = await batchCheckDiscountStatus(ruleIds, shopDomain);
      reportPath = generateBatchHtmlReport(batchResult, `output/batch-report-${Date.now()}.html`);
      reportUrl = `/output/${path.basename(reportPath)}`;

      res.json({
        success: true,
        type: 'batch',
        reportUrl,
        summary: {
          totalRules: batchResult.summary.totalRules,
          activeRules: batchResult.summary.activeRules,
          inactiveRules: batchResult.summary.inactiveRules,
          errorRules: batchResult.summary.errorRules
        }
      });
    }

    console.log(`✓ 查询完成，报告已生成: ${reportPath}`);

  } catch (error) {
    console.error('查询失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 启动服务器
app.listen(PORT, async () => {
  console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
  console.log(`║  🎁 Function买赠折扣规则查询智能体 - Web服务          ║`);
  console.log(`╚═══════════════════════════════════════════════════════════╝\n`);
  console.log(`🌐 服务器已启动:`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/check-discount\n`);

  // 预热 MCP 连接
  console.log(`🔥 正在预热 MCP 连接...\n`);
  try {
    // 发起一次简单的查询以建立连接
    await getFunctionDiscountRuleDetail(1, 'beta-anker-us.myshopify.com');
    console.log(`✓ MCP 连接预热完成！首次查询响应时间将大幅缩短\n`);
  } catch (error) {
    console.log(`⚠ MCP 预热失败（不影响正常使用）: ${error.message}\n`);
  }

  console.log(`按 Ctrl+C 停止服务器\n`);
});
