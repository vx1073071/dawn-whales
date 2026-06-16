// ── QUANT MOO Error Handler Framework ───────────────────────────────
// R131-P02: Global error handler + degradation chain + error codes

import { Request, Response, NextFunction } from 'express';
import { logAuditError } from './audit-logger';

// ── Error codes ──────────────────────────────────────────────────────

export const ErrorCodes = {
  // Broker errors (5xx)
  BROKER_CONNECT_FAILED:    { code: 'BROKER_001', status: 502, message: 'Broker connection failed' },
  BROKER_ORDER_FAILED:      { code: 'BROKER_002', status: 502, message: 'Broker order execution failed' },
  BROKER_QUOTE_FAILED:      { code: 'BROKER_003', status: 502, message: 'Failed to fetch quote from broker' },
  BROKER_AUTH_FAILED:       { code: 'BROKER_004', status: 401, message: 'Broker authentication failed' },

  // Signal errors (4xx)
  SIGNAL_INVALID:           { code: 'SIGNAL_001', status: 400, message: 'Invalid signal format' },
  SIGNAL_DUPLICATE:         { code: 'SIGNAL_002', status: 409, message: 'Duplicate signal' },
  SIGNAL_NO_COPIERS:        { code: 'SIGNAL_003', status: 404, message: 'No active copiers for this signal' },

  // Rate limit (4xx)
  RATE_LIMITED:             { code: 'RATE_001',  status: 429, message: 'Rate limit exceeded' },
  BROKER_RATE_LIMITED:      { code: 'RATE_002',  status: 429, message: 'Broker rate limit hit, retrying' },

  // Internal errors (5xx)
  DB_ERROR:                 { code: 'SYS_001',   status: 500, message: 'Database error' },
  ENCRYPTION_ERROR:         { code: 'SYS_002',   status: 500, message: 'Encryption/decryption failed' },
  INTERNAL_ERROR:           { code: 'SYS_999',   status: 500, message: 'Internal server error' },
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ── AppError class ───────────────────────────────────────────────────

export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly detail?: string;

  constructor(errCode: ErrorCode, detail?: string) {
    super(errCode.message);
    this.code = errCode.code;
    this.status = errCode.status;
    this.detail = detail;
  }
}

// ── Degradation chain ────────────────────────────────────────────────

export interface DegradationStep {
  name: string;
  execute: () => Promise<unknown>;
  fallback?: () => Promise<unknown>;
}

export async function executeWithDegradation(
  steps: DegradationStep[],
  context: Record<string, unknown> = {},
): Promise<unknown> {
  for (const step of steps) {
    try {
      return await step.execute();
    } catch (err) {
      logAuditError(`Degradation: ${step.name} failed, trying fallback`, {
        ...context,
        step: step.name,
        error: err instanceof Error ? err.message : String(err),
      });

      if (step.fallback) {
        try {
          return await step.fallback();
        } catch (fallbackErr) {
          logAuditError(`Degradation: ${step.name} fallback also failed`, {
            ...context,
            step: step.name,
          });
        }
      }
    }
  }

  throw new AppError(ErrorCodes.INTERNAL_ERROR, 'All degradation steps exhausted');
}

// ── Global error handler middleware ──────────────────────────────────

export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logAuditError('AppError', { code: err.code, message: err.message, detail: err.detail });
    res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, detail: err.detail },
    });
    return;
  }

  logAuditError('Unhandled error', {
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 3).join(' | '),
  });

  res.status(500).json({
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR.code,
      message: 'Internal server error',
    },
  });
}

// ── Circuit breaker ──────────────────────────────────────────────────

export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly threshold: number;
  private readonly resetTimeout: number;

  constructor(threshold = 5, resetTimeoutMs = 30000) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeoutMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
