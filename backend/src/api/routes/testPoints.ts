import { Router, Request, Response } from 'express';
import { FeishuDocumentRepository } from '../../models/repositories/FeishuDocumentRepository.js';
import { TestPointRepository } from '../../models/repositories/TestPointRepository.js';
import { TestPointExtractionService } from '../../services/TestPointExtractionService.js';
import { FeishuService } from '../../services/FeishuService.js';
import { TestPointPriority, TestPointStatus } from '../../models/entities.js';

const router = Router();

/**
 * POST /api/test-points/extract-and-save
 * 从飞书文档提取测试点并保存为思维导图格式到飞书
 *
 * 请求体:
 * - documentUrl: 飞书文档URL (必填)
 * - documentContent: 文档内容 (可选,如果不提供则返回文档ID供前端调用MCP工具获取)
 * - documentTitle: 文档标题 (可选)
 */
router.post('/extract-and-save', async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentUrl, documentContent, documentTitle } = req.body;

    // 验证必填字段
    if (!documentUrl) {
      res.status(400).json({
        error: 'Missing required field',
        message: '请提供飞书文档链接',
      });
      return;
    }

    // 验证URL格式
    if (!FeishuService.isValidFeishuUrl(documentUrl)) {
      res.status(400).json({
        error: 'Invalid document URL',
        message: '请提供有效的飞书文档链接',
      });
      return;
    }

    // 从URL提取document token
    const documentToken = FeishuService.extractDocumentId(documentUrl);
    if (!documentToken) {
      res.status(400).json({
        error: 'Invalid document URL',
        message: '无法从URL中提取文档ID',
      });
      return;
    }

    // 如果没有提供文档内容,返回文档ID供前端调用MCP工具
    if (!documentContent) {
      res.json({
        success: true,
        needsFetch: true,
        message: '请使用MCP工具获取文档内容',
        data: {
          documentId: documentToken,
          documentUrl: documentUrl,
        },
      });
      return;
    }

    // 验证文档内容
    if (!documentContent || typeof documentContent !== 'string') {
      res.status(400).json({
        error: 'Missing content',
        message: '请提供文档内容',
      });
      return;
    }

    // 使用AI提取测试点
    const extractionService = new TestPointExtractionService();
    const extractedPoints = await extractionService.extractTestPoints(
      documentContent,
      documentTitle
    );

    if (extractedPoints.length === 0) {
      res.status(400).json({
        error: 'No test points found',
        message: '未能从文档中提取到测试点',
      });
      return;
    }

    // 保存文档记录
    const feishuDocument = await FeishuDocumentRepository.create({
      documentId: documentToken || `manual_${Date.now()}`,
      documentUrl: documentUrl || '',
      title: documentTitle,
      content: documentContent,
      lastSyncedAt: new Date(),
    });

    // 转换为TestPoint实体并保存到数据库
    const testPoints = extractedPoints.map((point) =>
      TestPointExtractionService.toTestPoint(point, feishuDocument.id)
    );

    const savedPoints = await TestPointRepository.createBatch(testPoints);

    // 生成测试用例表格格式的Markdown内容
    const testCaseTableMarkdown = FeishuService.generateTestCaseTableMarkdown(
      extractedPoints,
      documentTitle || '测试用例管理表'
    );

    // 生成测试点文档标题(包含时间戳)
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const testDocTitle = documentTitle
      ? `【测试点】${documentTitle} - ${dateStr}`
      : `测试点文档 - ${dateStr}`;

    // 保存到飞书 (使用MCP工具)
    // 注意: 这需要在前端通过 Claude Code 调用 MCP 工具 mcp__feishu__docx_builtin_import
    const feishuDocUrl = await FeishuService.saveMarkdownToFeishu(
      testCaseTableMarkdown,
      testDocTitle
    );

    res.json({
      success: true,
      message: `成功提取 ${savedPoints.length} 个测试点`,
      data: {
        documentId: feishuDocument.id,
        testPoints: savedPoints,
        feishuDocUrl: feishuDocUrl,
        testDocTitle: testDocTitle,
        markdown: testCaseTableMarkdown, // 返回 Markdown 表格内容供前端显示和保存
      },
    });
  } catch (error) {
    console.error('Failed to extract and save test points:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : '提取测试点失败',
    });
  }
});


/**
 * POST /api/test-points/extract-from-feishu
 * 通过飞书文档Token直接提取测试点
 * 此接口期望前端已经通过MCP工具获取了文档内容
 */
router.post('/extract-from-feishu', async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentToken, documentTitle, documentContent, documentUrl } = req.body;

    // 验证必需字段
    if (!documentToken || typeof documentToken !== 'string') {
      res.status(400).json({
        error: 'Missing required field: documentToken',
        message: '请提供飞书文档Token',
      });
      return;
    }

    if (!documentContent || typeof documentContent !== 'string') {
      res.status(400).json({
        error: 'Missing required field: documentContent',
        message: '请提供文档内容',
      });
      return;
    }

    // 保存文档记录
    const feishuDocument = await FeishuDocumentRepository.create({
      documentId: documentToken,
      documentUrl: documentUrl || `https://feishu.cn/docx/${documentToken}`,
      title: documentTitle,
      content: documentContent,
      lastSyncedAt: new Date(),
    });

    // 使用AI提取测试点
    const extractionService = new TestPointExtractionService();
    const extractedPoints = await extractionService.extractTestPoints(
      documentContent,
      documentTitle
    );

    // 转换为TestPoint实体并保存
    const testPoints = extractedPoints.map((point) =>
      TestPointExtractionService.toTestPoint(point, feishuDocument.id)
    );

    const savedPoints = await TestPointRepository.createBatch(testPoints);

    res.json({
      success: true,
      message: `成功提取 ${savedPoints.length} 个测试点`,
      data: {
        documentId: feishuDocument.id,
        testPoints: savedPoints,
      },
    });
  } catch (error) {
    console.error('Failed to extract test points from Feishu:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : '提取测试点失败',
    });
  }
});

/**
 * POST /api/test-points/extract
 * 从飞书文档内容提取测试点
 */
router.post('/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentUrl, documentId: providedDocId, title, content } = req.body;

    // 验证必需字段
    if (!content || typeof content !== 'string') {
      res.status(400).json({
        error: 'Missing required field: content',
        message: '请提供文档内容',
      });
      return;
    }

    // 提取或验证文档ID
    let documentId = providedDocId;
    if (documentUrl) {
      const extractedId = FeishuService.extractDocumentId(documentUrl);
      if (!extractedId) {
        res.status(400).json({
          error: 'Invalid document URL',
          message: '无法从URL中提取文档ID',
        });
        return;
      }
      documentId = extractedId;
    }

    // 保存或更新文档记录
    let feishuDocument = null;
    if (documentId && documentUrl) {
      feishuDocument = await FeishuDocumentRepository.create({
        documentId,
        documentUrl,
        title,
        content,
        lastSyncedAt: new Date(),
      });
    }

    // 使用AI提取测试点
    const extractionService = new TestPointExtractionService();
    const extractedPoints = await extractionService.extractTestPoints(content, title);

    // 转换为TestPoint实体并保存
    const testPoints = extractedPoints.map((point) =>
      TestPointExtractionService.toTestPoint(point, feishuDocument?.id ?? undefined)
    );

    const savedPoints = await TestPointRepository.createBatch(testPoints);

    res.json({
      success: true,
      message: `成功提取 ${savedPoints.length} 个测试点`,
      data: {
        documentId: feishuDocument?.id,
        testPoints: savedPoints,
      },
    });
  } catch (error) {
    console.error('Failed to extract test points:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : '提取测试点失败',
    });
  }
});

/**
 * GET /api/test-points
 * 获取测试点列表
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, priority, status, limit, offset } = req.query;

    const filters = {
      category: category as string | undefined,
      priority: priority as TestPointPriority | undefined,
      status: status as TestPointStatus | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    };

    const testPoints = await TestPointRepository.findAll(filters);

    res.json({
      success: true,
      data: testPoints,
      total: testPoints.length,
    });
  } catch (error) {
    console.error('Failed to fetch test points:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取测试点列表失败',
    });
  }
});

/**
 * GET /api/test-points/stats/summary
 * 获取测试点统计信息
 * 注意: 必须在 /:id 路由之前定义
 */
router.get('/stats/summary', async (_req: Request, res: Response): Promise<void> => {
  try {
    const countsByStatus = await TestPointRepository.countByStatus();

    res.json({
      success: true,
      data: {
        byStatus: countsByStatus,
        total: Object.values(countsByStatus).reduce((sum, count) => sum + count, 0),
      },
    });
  } catch (error) {
    console.error('Failed to fetch test point stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取统计信息失败',
    });
  }
});

/**
 * GET /api/test-points/document/:documentId
 * 获取指定文档的所有测试点
 * 注意: 必须在 /:id 路由之前定义
 */
router.get('/document/:documentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId } = req.params;

    const testPoints = await TestPointRepository.findByDocumentId(documentId);

    res.json({
      success: true,
      data: testPoints,
      total: testPoints.length,
    });
  } catch (error) {
    console.error('Failed to fetch test points by document:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取文档测试点失败',
    });
  }
});

/**
 * GET /api/test-points/:id
 * 获取单个测试点详情
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const testPoint = await TestPointRepository.findById(id);

    if (!testPoint) {
      res.status(404).json({
        error: 'Not found',
        message: '测试点不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: testPoint,
    });
  } catch (error) {
    console.error('Failed to fetch test point:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取测试点失败',
    });
  }
});

/**
 * PATCH /api/test-points/:id
 * 更新测试点
 */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedPoint = await TestPointRepository.update(id, updates);

    if (!updatedPoint) {
      res.status(404).json({
        error: 'Not found',
        message: '测试点不存在',
      });
      return;
    }

    res.json({
      success: true,
      message: '测试点已更新',
      data: updatedPoint,
    });
  } catch (error) {
    console.error('Failed to update test point:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '更新测试点失败',
    });
  }
});

/**
 * DELETE /api/test-points/:id
 * 删除测试点
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await TestPointRepository.delete(id);

    if (!deleted) {
      res.status(404).json({
        error: 'Not found',
        message: '测试点不存在',
      });
      return;
    }

    res.json({
      success: true,
      message: '测试点已删除',
    });
  } catch (error) {
    console.error('Failed to delete test point:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '删除测试点失败',
    });
  }
});

export default router;
