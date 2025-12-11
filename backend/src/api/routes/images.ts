/**
 * 图片代理路由
 * 用于代理访问飞书图片(需要 access_token)
 */

import { Router, Request, Response } from 'express';
import feishuApiService from '../../services/FeishuApiService.js';

const router = Router();

/**
 * GET /api/v1/images/feishu/:imageKey
 * 获取飞书图片
 */
router.get('/feishu/:imageKey', async (req: Request, res: Response) => {
  try {
    const { imageKey } = req.params;

    if (!imageKey) {
      return res.status(400).json({ error: 'Image key is required' });
    }

    console.log(`[ImageProxy] Fetching Feishu image: ${imageKey}`);

    // 从飞书获取图片内容
    const imageBuffer = await feishuApiService.getImage(imageKey);

    // 设置响应头
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存1年
    res.setHeader('Content-Length', imageBuffer.length);

    // 返回图片
    res.send(imageBuffer);
  } catch (error) {
    console.error('[ImageProxy] Failed to fetch image:', error);

    if (error instanceof Error && error.message.includes('404')) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

export default router;
