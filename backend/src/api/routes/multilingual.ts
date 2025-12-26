import { Router, Request, Response } from 'express';
import { multilingualTestService } from '../../services/MultilingualTestService.js';
import { languageCheckService, LanguageCheckService } from '../../services/LanguageCheckService.js';

const router = Router();

/**
 * GET /api/v1/multilingual/languages
 * 获取支持的语言列表
 */
router.get('/languages', async (req: Request, res: Response) => {
  try {
    const languages = await languageCheckService.getSupportedLanguages();

    res.json({
      success: true,
      data: languages,
    });
  } catch (error) {
    console.error('Failed to fetch supported languages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supported languages',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/v1/multilingual/check
 * 创建多语言检查任务
 *
 * Request body:
 * {
 *   "url": "https://example.com/page",
 *   "languages": ["english", "german", "french"],
 *   "notificationEmail": "user@example.com" // 可选
 * }
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { url, languages, notificationEmail } = req.body;

    // 验证参数
    if (!url || !Array.isArray(languages) || languages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'URL and languages array are required',
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

    console.log(`[Multilingual API] Starting check for ${url} with languages: ${languages.join(', ')}`);

    // 执行检查(同步执行,后续可以改为异步任务队列)
    const report = await multilingualTestService.checkMultilingualPage(url, languages);

    // TODO: 保存到数据库
    // TODO: 发送邮件通知

    res.json({
      success: true,
      data: report,
    });

  } catch (error) {
    console.error('Multilingual check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Check failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/v1/multilingual/check-text
 * 直接检查文本内容(用于测试)
 *
 * Request body:
 * {
 *   "text": "This is an exmaple text",
 *   "language": "english"
 * }
 */
router.post('/check-text', async (req: Request, res: Response) => {
  try {
    const { text, language } = req.body;

    if (!text || !language) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Text and language are required',
      });
    }

    const languageCode = LanguageCheckService.getLanguageCode(language);
    const rawErrors = await languageCheckService.checkText(text, languageCode);
    const errors = languageCheckService.formatErrors(rawErrors);

    res.json({
      success: true,
      data: {
        language,
        languageCode,
        totalErrors: errors.length,
        criticalErrors: errors.filter(e => e.severity === 'error').length,
        warnings: errors.filter(e => e.severity === 'warning').length,
        errors,
      },
    });

  } catch (error) {
    console.error('Text check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Check failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
