import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// URL validation schema
const urlSchema = z.object({
  url: z
    .string()
    .url({ message: 'Invalid URL format' })
    .regex(/^https?:\/\//, { message: 'URL must start with http:// or https://' })
    .max(2048, { message: 'URL must not exceed 2048 characters' })
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          // Reject localhost and internal IPs
          const hostname = parsed.hostname.toLowerCase();

          // Block localhost variations
          if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return false;
          }

          // Block private IP ranges (basic check)
          if (
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)
          ) {
            return false;
          }

          // Block file://, ftp://, etc.
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
          }

          return true;
        } catch {
          return false;
        }
      },
      { message: 'URL cannot be localhost, private IP, or non-HTTP protocol' }
    ),
  config: z
    .object({
      timeout: z.number().int().min(5).max(120).optional(),
      waitTime: z.number().int().min(0).max(30).optional(),
      performanceTestMode: z.enum(['webpagetest', 'pagespeed']).optional(),
      enableWebPageTest: z.boolean().optional(),
      enablePageSpeed: z.boolean().optional(),
      deviceStrategy: z.enum(['mobile', 'desktop']).optional(),
      testOptions: z
        .object({
          links: z.boolean().optional(),
          forms: z.boolean().optional(),
          buttons: z.boolean().optional(),
          images: z.boolean().optional(),
          performance: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  notificationEmail: z
    .string()
    .email({ message: 'Invalid email format' })
    .optional(),
});

export function validateUrl(req: Request, res: Response, next: NextFunction): void {
  try {
    // Validate request body
    const validated = urlSchema.parse(req.body);

    // Attach validated data to request
    req.body = validated;

    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          issue: err.message,
        })),
      });
    } else {
      next(error);
    }
  }
}
