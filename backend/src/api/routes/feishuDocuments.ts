import { Router, Request, Response } from 'express';
import { FeishuDocumentRepository } from '../../models/repositories/FeishuDocumentRepository.js';
import { TestPointRepository } from '../../models/repositories/TestPointRepository.js';

const router = Router();

/**
 * GET /api/feishu-documents
 * 获取飞书文档列表
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit, offset } = req.query;

    const documents = await FeishuDocumentRepository.findAll(
      limit ? parseInt(limit as string, 10) : undefined,
      offset ? parseInt(offset as string, 10) : undefined
    );

    res.json({
      success: true,
      data: documents,
      total: documents.length,
    });
  } catch (error) {
    console.error('Failed to fetch feishu documents:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取文档列表失败',
    });
  }
});

/**
 * GET /api/feishu-documents/:id
 * 获取单个飞书文档详情
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const document = await FeishuDocumentRepository.findById(id);

    if (!document) {
      res.status(404).json({
        error: 'Not found',
        message: '文档不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Failed to fetch feishu document:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取文档失败',
    });
  }
});

/**
 * GET /api/feishu-documents/:id/test-points
 * 获取文档关联的所有测试点
 */
router.get('/:id/test-points', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 先验证文档是否存在
    const document = await FeishuDocumentRepository.findById(id);
    if (!document) {
      res.status(404).json({
        error: 'Not found',
        message: '文档不存在',
      });
      return;
    }

    // 获取关联的测试点
    const testPoints = await TestPointRepository.findByDocumentId(id);

    res.json({
      success: true,
      data: {
        document,
        testPoints,
      },
      total: testPoints.length,
    });
  } catch (error) {
    console.error('Failed to fetch document test points:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '获取文档测试点失败',
    });
  }
});

/**
 * DELETE /api/feishu-documents/:id
 * 删除飞书文档及其关联的所有测试点
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 先删除关联的测试点
    const deletedPointsCount = await TestPointRepository.deleteByDocumentId(id);

    // 再删除文档
    const deleted = await FeishuDocumentRepository.delete(id);

    if (!deleted) {
      res.status(404).json({
        error: 'Not found',
        message: '文档不存在',
      });
      return;
    }

    res.json({
      success: true,
      message: `文档已删除,同时删除了 ${deletedPointsCount} 个关联的测试点`,
    });
  } catch (error) {
    console.error('Failed to delete feishu document:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '删除文档失败',
    });
  }
});

export default router;
