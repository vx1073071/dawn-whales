// ── DAWN WHALES Audit Logger ──────────────────────────────────────────
// R130-P03: Winston audit logger with daily rotation + sensitive data masking

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Mask sensitive fields
function maskSensitive(body: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...body };
  for (const key of ['apiKey', 'secret', 'secretKey', 'password', 'passphrase', 'api_key', 'api_secret']) {
    if (masked[key]) masked[key] = '***REDACTED***';
  }
  return masked;
}

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxsize: '10m',
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        }),
      ),
    }),
  ],
});

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown): Response {
    const duration = Date.now() - start;
    const userId = (req as Request & { user?: { userId: string } }).user?.userId || 'anonymous';

    auditLogger.info('API Request', {
      userId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.socket.remoteAddress,
      body: req.method !== 'GET' ? maskSensitive(req.body) : undefined,
      userAgent: req.headers['user-agent']?.slice(0, 100),
    });

    return originalJson(body);
  };

  next();
}

// Key access audit (called from encryption.ts)
export function logKeyAccess(
  userId: string,
  brokerId: string,
  action: 'encrypt' | 'decrypt' | 'delete' | 'rotate',
): void {
  auditLogger.info('API Key Access', { userId, brokerId, action });
}

// Error audit
export function logAuditError(
  message: string,
  meta?: Record<string, unknown>,
): void {
  auditLogger.error(message, meta || {});
}

export { auditLogger };
