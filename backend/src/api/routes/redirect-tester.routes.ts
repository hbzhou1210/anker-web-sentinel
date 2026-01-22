import { Router, Request, Response } from 'express';
import { RedirectTesterService, RedirectRule } from '../../services/redirect-tester.service.js';
import { createModuleLogger } from '../../utils/logger.js';

const router = Router();
const logger = createModuleLogger('RedirectTesterRoutes');
const redirectTester = new RedirectTesterService();

/**
 * POST /api/redirect-tester/test
 * 测试单个重定向规则
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const rule: RedirectRule = req.body;

    // 验证必填字段
    if (!rule.from || !rule.to) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: from, to'
      });
    }

    // 验证 URL 格式
    try {
      new URL(rule.from);
      new URL(rule.to);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'URL 格式无效'
      });
    }

    // 验证 matchType
    const validMatchTypes = ['exact', 'partial', 'prefix', 'regex'];
    if (rule.matchType && !validMatchTypes.includes(rule.matchType)) {
      return res.status(400).json({
        success: false,
        error: `matchType 必须是以下之一: ${validMatchTypes.join(', ')}`
      });
    }

    // 验证 regex 模式
    if (rule.matchType === 'regex' && rule.partialMatch?.pattern) {
      try {
        new RegExp(rule.partialMatch.pattern);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: '正则表达式模式无效'
        });
      }
    }

    logger.info('测试单个重定向规则', { from: rule.from, to: rule.to });

    const result = await redirectTester.testRedirect(rule);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('测试重定向失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/redirect-tester/test-batch
 * 批量测试重定向规则
 */
router.post('/test-batch', async (req: Request, res: Response) => {
  try {
    const { rules, concurrency } = req.body;

    // 验证
    if (!Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供有效的规则列表'
      });
    }

    logger.info(`批量测试 ${rules.length} 条规则`);

    const results = await redirectTester.testBatch(rules, { concurrency });
    const report = redirectTester.generateReport(results);

    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    logger.error('批量测试失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/redirect-tester/validate
 * 验证规则配置（不执行实际测试）
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const rules: RedirectRule[] = req.body.rules;

    if (!Array.isArray(rules)) {
      return res.status(400).json({
        success: false,
        error: '请提供规则数组'
      });
    }

    const errors: string[] = [];

    const validMatchTypes = ['exact', 'partial', 'prefix', 'regex'];

    rules.forEach((rule, index) => {
      if (!rule.from) {
        errors.push(`规则 ${index + 1}: 缺少 from 字段`);
      }
      if (!rule.to) {
        errors.push(`规则 ${index + 1}: 缺少 to 字段`);
      }

      // 验证 URL 格式
      if (rule.from) {
        try {
          new URL(rule.from);
        } catch {
          errors.push(`规则 ${index + 1}: from URL 格式无效`);
        }
      }
      if (rule.to) {
        try {
          new URL(rule.to);
        } catch {
          errors.push(`规则 ${index + 1}: to URL 格式无效`);
        }
      }

      // 验证 matchType
      if (rule.matchType && !validMatchTypes.includes(rule.matchType)) {
        errors.push(`规则 ${index + 1}: matchType 必须是 ${validMatchTypes.join(', ')} 之一`);
      }

      // 验证 regex 模式
      if (rule.matchType === 'regex' && rule.partialMatch?.pattern) {
        try {
          new RegExp(rule.partialMatch.pattern);
        } catch {
          errors.push(`规则 ${index + 1}: 正则表达式模式无效`);
        }
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    res.json({
      success: true,
      message: '规则验证通过',
      count: rules.length
    });
  } catch (error: any) {
    logger.error('验证规则失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/redirect-tester/examples
 * 获取示例配置
 */
router.get('/examples', (req: Request, res: Response) => {
  const examples = [
    {
      name: 'HTTPS强制跳转',
      description: 'HTTP强制跳转到HTTPS',
      rules: [
        {
          from: 'http://example.com',
          to: 'https://example.com',
          matchType: 'exact'
        }
      ]
    },
    {
      name: '路径变更',
      description: '旧路径重定向到新路径',
      rules: [
        {
          from: 'http://example.com/old-page',
          to: 'https://example.com/new-page',
          matchType: 'exact'
        }
      ]
    },
    {
      name: '保留查询参数',
      description: '部分匹配，忽略查询参数差异',
      rules: [
        {
          from: 'http://example.com/page?id=123',
          to: 'https://example.com/page?id=123',
          matchType: 'partial',
          partialMatch: {
            startChar: '/',
            endChar: '?'
          }
        }
      ]
    }
  ];

  res.json({
    success: true,
    data: examples
  });
});

export default router;
