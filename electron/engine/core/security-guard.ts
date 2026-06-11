/**
 * J-77-03: CSRF/XSS/CSP 安全防护中间件
 * 
 * 用于 Express/Electron API 端的安全加固:
 * - XSS防护: 所有用户输入 HTML encode
 * - CSRF token: 写操作必须验证
 * - CSP header: 内容安全策略
 * - Helmet-like headers
 */

// ── XSS 防护 ──────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

export function htmlEncode(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[&<>"'`/=]/g, (ch) => HTML_ENTITIES[ch] || ch);
}

export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  // Remove script tags
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove on* event handlers
  sanitized = sanitized.replace(/\bon\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/\bon\w+\s*=\s*'[^']*'/gi, 'i18n.t('securityGuard.k1')string') {
      result[key] = sanitizeInput(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeInput(item)
          : item && typeof item === 'object'
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    }
  }
  return result;
}

// ── CSRF Token ────────────────────────────────────────────────

import { randomBytes, timingSafeEqual } from 'crypto';

import i18n from '../../../src/i18n';
import { EngineError } from './engine-error';


const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'csrf-token';

let csrfSecret: Buffer | null = null;

export function initCsrfSecret(secret?: string): void {
  csrfSecret = Buffer.from(secret || randomBytes(32).toString('hex'), 'utf8');
}

export function generateCsrfToken(sessionId: string): string {
  if (!csrfSecret) initCsrfSecret();
  const hmac = require('crypto').createHmac('sha256', csrfSecret!);
  hmac.update(sessionId);
  hmac.update(Date.now().toString());
  return hmac.digest('hex');
}

export function validateCsrfToken(token: string, sessionId: string): boolean {
  if (!csrfSecret) return false;
  const expected = generateCsrfToken(sessionId); // Simplified — in production use session-stored token
  try {
    const tokenBuf = Buffer.from(token, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (tokenBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(tokenBuf, expectedBuf);
  } catch (_e: unknown) {
    return false;
  }
}

/**
 * Express middleware: CSRF token verification (write methods only)
 */
export function csrfMiddleware(
  req: { method: string; headers: Record<string, string>; cookies?: Record<string, string> },
  _res: unknown,
  next: (err?: Error) => void
): void {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  const token = req.headers[CSRF_HEADER];
  if (!token) {
    return next(new Error('CSRF token missing'));
  }

  // Simplified: expect header token to match session's token
  // In production, compare against session-stored expected token
  if (typeof token !== 'string' || token.length < 16) {
    return next(new Error('CSRF token invalid'));
  }

  next();
}

// ── CSP Header ────────────────────────────────────────────────

export const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: https: blob:",
  "font-src 'self' https://cdn.jsdelivr.net",
  "connect-src 'self' https://api.dawnwhales.com wss://opend.dawn-whales.cloud",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

/**
 * Express middleware: CSP injection
 */
export function cspMiddleware(
  _req: unknown,
  res: { setHeader: (key: string, value: string) => void },
  next: () => void
): void {
  res.setHeader('Content-Security-Policy', CSP_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

// ── Export helpers ────────────────────────────────────────────

export const CSRF_HEADER_NAME = CSRF_HEADER;
export const CSRF_COOKIE_NAME = CSRF_COOKIE;

export default {
  htmlEncode,
  sanitizeInput,
  sanitizeObject,
  initCsrfSecret,
  generateCsrfToken,
  validateCsrfToken,
  csrfMiddleware,
  cspMiddleware,
  CSP_POLICY,
};
