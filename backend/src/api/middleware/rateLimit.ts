import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests = 10; // requests per window
  private readonly windowMs = 60 * 1000; // 1 minute in milliseconds

  // Get client identifier (IP address)
  private getClientId(req: Request): string {
    return (
      req.ip ||
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  // Check if request should be rate limited
  shouldLimit(req: Request): { limited: boolean; retryAfter?: number } {
    const clientId = this.getClientId(req);
    const now = Date.now();

    let entry = this.store.get(clientId);

    // No entry or expired window - create new entry
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.store.set(clientId, entry);
      return { limited: false };
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > this.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return { limited: true, retryAfter };
    }

    return { limited: false };
  }

  // Clean up expired entries (run periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [clientId, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(clientId);
      }
    }
  }
}

const limiter = new RateLimiter();

// Run cleanup every 5 minutes
setInterval(() => {
  limiter.cleanup();
}, 5 * 60 * 1000);

// Express middleware
export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const result = limiter.shouldLimit(req);

  if (result.limited) {
    res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests. Max 10 per minute.',
      retryAfter: result.retryAfter,
    });
    return;
  }

  next();
}
