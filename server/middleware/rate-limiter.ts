// ── QUANT MOO Rate Limiter ──────────────────────────────────────────
// R129: Per-endpoint rate limiting with memory store

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60000);

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.rateLimitWindowMs });
    res.setHeader('X-RateLimit-Limit', config.rateLimitMax);
    res.setHeader('X-RateLimit-Remaining', config.rateLimitMax - 1);
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + config.rateLimitWindowMs) / 1000));
    next();
    return;
  }

  if (entry.count >= config.rateLimitMax) {
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
    return;
  }

  entry.count++;
  res.setHeader('X-RateLimit-Limit', config.rateLimitMax);
  res.setHeader('X-RateLimit-Remaining', config.rateLimitMax - entry.count);
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
  next();
}
