// ── DAWN WHALES — Standardized Error Types ────────────────────────────
// P2-5: Error standardization for critical paths (engine/ + ipc/)
//
// Usage:
//   throw new EngineError('Strategy execution failed', { code: ErrorCode.ENGINE_TRADE_ERROR, context: { orderId } });
//   throw new EngineError('Authentication rejected', { code: ErrorCode.ENGINE_AUTH_ERROR });
//

export enum ErrorCode {
  // ── Trade / Execution ─────────────────────────────────────────────
  ENGINE_TRADE_ERROR      = 'ENGINE_TRADE_ERROR',
  ENGINE_ORDER_REJECTED   = 'ENGINE_ORDER_REJECTED',
  ENGINE_BACKTEST_ERROR   = 'ENGINE_BACKTEST_ERROR',
  ENGINE_LIVE_EXEC_ERROR  = 'ENGINE_LIVE_EXEC_ERROR',
  ENGINE_BROKER_ERROR     = 'ENGINE_BROKER_ERROR',

  // ── Data ───────────────────────────────────────────────────────────
  ENGINE_DATA_ERROR       = 'ENGINE_DATA_ERROR',
  ENGINE_DATA_FETCH_ERROR = 'ENGINE_DATA_FETCH_ERROR',
  ENGINE_DATA_PARSE_ERROR = 'ENGINE_DATA_PARSE_ERROR',
  ENGINE_DB_ERROR         = 'ENGINE_DB_ERROR',

  // ── AI / LLM ───────────────────────────────────────────────────────
  ENGINE_AI_ERROR         = 'ENGINE_AI_ERROR',
  ENGINE_AI_TIMEOUT       = 'ENGINE_AI_TIMEOUT',
  ENGINE_AI_PARSE_ERROR   = 'ENGINE_AI_PARSE_ERROR',

  // ── Auth / Security ────────────────────────────────────────────────
  ENGINE_AUTH_ERROR       = 'ENGINE_AUTH_ERROR',
  ENGINE_TOKEN_EXPIRED    = 'ENGINE_TOKEN_EXPIRED',
  ENGINE_RATE_LIMIT       = 'ENGINE_RATE_LIMIT',

  // ── Billing / Wallet ───────────────────────────────────────────────
  ENGINE_BILLING_ERROR    = 'ENGINE_BILLING_ERROR',
  ENGINE_WALLET_ERROR     = 'ENGINE_WALLET_ERROR',

  // ── IPC ────────────────────────────────────────────────────────────
  ENGINE_IPC_ERROR        = 'ENGINE_IPC_ERROR',
  ENGINE_IPC_TIMEOUT      = 'ENGINE_IPC_TIMEOUT',

  // ── General ────────────────────────────────────────────────────────
  ENGINE_VALIDATION_ERROR = 'ENGINE_VALIDATION_ERROR',
  ENGINE_INTERNAL_ERROR   = 'ENGINE_INTERNAL_ERROR',
}

export interface EngineErrorDetails {
  code: ErrorCode;
  context?: Record<string, unknown>;
  cause?: Error;
  statusCode?: number;
}

export class EngineError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;
  public readonly statusCode: number;

  constructor(message: string, details: EngineErrorDetails) {
    super(message);
    this.name = 'EngineError';
    this.code = details.code;
    this.context = details.context;
    this.cause = details.cause;
    this.statusCode = details.statusCode ?? 500;

    if (details.cause?.stack) {
      this.stack = `${this.stack}\nCaused by: ${details.cause.stack}`;
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
    };
  }
}

export function isEngineError(err: unknown): err is EngineError {
  return err instanceof EngineError;
}

export function toEngineError(err: unknown, defaultCode: ErrorCode = ErrorCode.ENGINE_INTERNAL_ERROR): EngineError {
  if (err instanceof EngineError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new EngineError(message, {
    code: defaultCode,
    cause: err instanceof Error ? err : undefined,
  });
}
