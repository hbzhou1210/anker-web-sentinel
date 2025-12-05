import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * POST /api/feishu/fetch-document
 * 从飞书获取文档内容
 *
 * 由于MCP工具只能在Claude Code环境中调用,这个端点作为临时解决方案
 * 实际生产环境应该使用飞书API官方SDK
 */
router.post('/fetch-document', async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId } = req.body;

    if (!documentId) {
      res.status(400).json({
        error: 'Missing required field',
        message: '请提供文档ID',
      });
      return;
    }

    // 检查是否配置了飞书API凭据
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;

    if (!appId || !appSecret) {
      res.status(501).json({
        error: 'Feishu API not configured',
        message: '飞书API未配置。请在.env文件中设置FEISHU_APP_ID和FEISHU_APP_SECRET',
        suggestion: '当前解决方案:请手动复制飞书文档内容,或通过Claude Code获取内容',
      });
      return;
    }

    // 步骤1: 获取tenant_access_token
    const tokenResponse = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (tokenResponse.data.code !== 0) {
      throw new Error(`获取access token失败: ${tokenResponse.data.msg}`);
    }

    const accessToken = tokenResponse.data.tenant_access_token;

    // 步骤2: 获取文档原始内容
    const docResponse = await axios.get(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/raw_content`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          lang: 0, // 0表示中文
        },
      }
    );

    if (docResponse.data.code !== 0) {
      throw new Error(`获取文档内容失败: ${docResponse.data.msg}`);
    }

    res.json({
      success: true,
      data: {
        documentId: documentId,
        content: docResponse.data.data.content,
      },
    });
  } catch (error) {
    console.error('Failed to fetch Feishu document:', error);

    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch document',
        message: error.response?.data?.msg || error.message,
        details: error.response?.data,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : '获取飞书文档失败',
      });
    }
  }
});

export default router;
