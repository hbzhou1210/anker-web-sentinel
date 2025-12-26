import { Router, Request, Response } from 'express';
import { enhancedMultilingualService } from '../../services/EnhancedMultilingualService.js';

const router = Router();

/**
 * POST /api/v1/enhanced-multilingual/check
 * 增强版多语言检查
 *
 * Request body:
 * {
 *   "url": "https://example.com/page",
 *   "language": "en-US"  // 单个语言
 * }
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { url, language } = req.body;

    // 验证参数
    if (!url || !language) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'URL and language are required',
      });
    }

    // URL 格式验证
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        message: 'Please provide a valid URL',
      });
    }

    console.log(`[Enhanced Multilingual] Starting check for ${url} in ${language}`);

    // 执行检查
    const result = await enhancedMultilingualService.checkLanguage(url, language);

    // 生成文本格式输出
    const textOutput = enhancedMultilingualService.formatAsText(result);

    res.json({
      success: true,
      data: {
        ...result,
        textOutput,  // 文本格式输出
      },
    });

  } catch (error) {
    console.error('Enhanced multilingual check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Check failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/v1/enhanced-multilingual/batch-check
 * 批量检查多个语言
 *
 * Request body:
 * {
 *   "url": "https://example.com/page",
 *   "languages": ["en-US", "de-DE", "fr-FR"]
 * }
 */
router.post('/batch-check', async (req: Request, res: Response) => {
  try {
    const { url, languages } = req.body;

    // 验证参数
    if (!url || !Array.isArray(languages) || languages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'URL and languages array are required',
      });
    }

    console.log(`[Enhanced Multilingual Batch] Checking ${url} for ${languages.length} languages`);

    // 并行检查所有语言
    const results = await Promise.all(
      languages.map(lang => enhancedMultilingualService.checkLanguage(url, lang))
    );

    // 生成每个语言的文本输出
    const textOutputs = results.map(result => ({
      language: result.language,
      languageCode: result.languageCode,
      textOutput: enhancedMultilingualService.formatAsText(result),
    }));

    // 转换为与标准检查兼容的格式
    const languageResults = results.map(result => ({
      language: result.languageCode,
      languageName: result.language,
      errorCount: result.criticalCount,
      warningCount: result.warningCount,
      infoCount: result.infoCount,
      errors: [], // 原始错误列表(增强模式不需要)
      textLength: 0,
      // 增强模式的额外字段
      enhancedData: {
        totalErrors: result.totalErrors,
        uniqueErrors: result.uniqueErrors,
        textOutput: enhancedMultilingualService.formatAsText(result),
        summary: result.summary,
        errors: result.errors,
      },
    }));

    // 汇总统计
    const summary = {
      languagesChecked: results.length,
      totalIssues: results.reduce((sum, r) => sum + r.totalErrors, 0),
      criticalIssues: results.reduce((sum, r) => sum + r.criticalCount, 0),
    };

    res.json({
      success: true,
      data: {
        url,
        timestamp: new Date().toISOString(),
        languages: languageResults,
        totalErrors: results.reduce((sum, r) => sum + r.criticalCount, 0),
        totalWarnings: results.reduce((sum, r) => sum + r.warningCount, 0),
        summary,
      },
    });

  } catch (error) {
    console.error('Enhanced batch check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Batch check failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
