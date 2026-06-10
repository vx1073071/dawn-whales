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
  ENGINE_CONNECTION_ERROR  = 'ENGINE_CONNECTION_ERROR',

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

// ── R89 Compatibility Layer — ErrorDomain for EngineError standardization ─

/** Error domain — maps to monitoring categories (R84 standard) */
export enum ErrorDomain {
  TRADE      = 'TRADE',
  DATA       = 'DATA',
  AI         = 'AI',
  AUTH       = 'AUTH',
  NETWORK    = 'NETWORK',
  VALIDATION = 'VALIDATION',
  SYSTEM     = 'SYSTEM',
}

/** Map legacy ErrorCode string → ErrorDomain */
export function mapCodeToDomain(code: ErrorCode): ErrorDomain {
  switch (code) {
    case ErrorCode.ENGINE_AI_ERROR:
    case ErrorCode.ENGINE_AI_TIMEOUT:
    case ErrorCode.ENGINE_AI_PARSE_ERROR:
      return ErrorDomain.AI;

    case ErrorCode.ENGINE_TRADE_ERROR:
    case ErrorCode.ENGINE_ORDER_REJECTED:
    case ErrorCode.ENGINE_BACKTEST_ERROR:
    case ErrorCode.ENGINE_LIVE_EXEC_ERROR:
      return ErrorDomain.TRADE;

    case ErrorCode.ENGINE_DATA_ERROR:
    case ErrorCode.ENGINE_DATA_FETCH_ERROR:
    case ErrorCode.ENGINE_DB_ERROR:
    case ErrorCode.ENGINE_DATA_PARSE_ERROR:
      return ErrorDomain.DATA;

    case ErrorCode.ENGINE_AUTH_ERROR:
    case ErrorCode.ENGINE_TOKEN_EXPIRED:
      return ErrorDomain.AUTH;

    case ErrorCode.ENGINE_IPC_ERROR:
    case ErrorCode.ENGINE_IPC_TIMEOUT:
    case ErrorCode.ENGINE_BROKER_ERROR:
    case ErrorCode.ENGINE_CONNECTION_ERROR:
      return ErrorDomain.NETWORK;

    case ErrorCode.ENGINE_VALIDATION_ERROR:
      return ErrorDomain.VALIDATION;

    case ErrorCode.ENGINE_RATE_LIMIT:
    case ErrorCode.ENGINE_BILLING_ERROR:
    case ErrorCode.ENGINE_WALLET_ERROR:
    default:
      return ErrorDomain.SYSTEM;
  }
}

/** Map legacy ErrorCode → standard HTTP status code */
export function mapCodeToStatusCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.ENGINE_AUTH_ERROR:
    case ErrorCode.ENGINE_TOKEN_EXPIRED:
      return 401;

    case ErrorCode.ENGINE_VALIDATION_ERROR:
      return 400;

    case ErrorCode.ENGINE_TRADE_ERROR:
    case ErrorCode.ENGINE_ORDER_REJECTED:
    case ErrorCode.ENGINE_BACKTEST_ERROR:
    case ErrorCode.ENGINE_LIVE_EXEC_ERROR:
      return 402;

    case ErrorCode.ENGINE_DATA_ERROR:
    case ErrorCode.ENGINE_DATA_FETCH_ERROR:
    case ErrorCode.ENGINE_DB_ERROR:
    case ErrorCode.ENGINE_DATA_PARSE_ERROR:
      return 404;

    case ErrorCode.ENGINE_AI_ERROR:
    case ErrorCode.ENGINE_AI_TIMEOUT:
    case ErrorCode.ENGINE_AI_PARSE_ERROR:
      return 502;

    case ErrorCode.ENGINE_IPC_ERROR:
    case ErrorCode.ENGINE_IPC_TIMEOUT:
    case ErrorCode.ENGINE_BROKER_ERROR:
    case ErrorCode.ENGINE_CONNECTION_ERROR:
      return 503;

    case ErrorCode.ENGINE_RATE_LIMIT:
      return 429;

    default:
      return 500;
  }
}

/** Map legacy ENGINE_* ErrorCode → R84 standard code string */
export function mapCodeToStandardCode(code: ErrorCode): string {
  switch (code) {
    case ErrorCode.ENGINE_AI_ERROR:         return 'AI_PARSE_ERROR';
    case ErrorCode.ENGINE_AI_TIMEOUT:       return 'AI_TIMEOUT';
    case ErrorCode.ENGINE_AI_PARSE_ERROR:   return 'AI_PARSE_ERROR';
    case ErrorCode.ENGINE_TRADE_ERROR:      return 'ORDER_REJECTED';
    case ErrorCode.ENGINE_ORDER_REJECTED:   return 'ORDER_REJECTED';
    case ErrorCode.ENGINE_BACKTEST_ERROR:   return 'ORDER_REJECTED';
    case ErrorCode.ENGINE_LIVE_EXEC_ERROR:  return 'ORDER_REJECTED';
    case ErrorCode.ENGINE_BROKER_ERROR:     return 'CONNECTION_FAILED';
    case ErrorCode.ENGINE_DATA_ERROR:       return 'DATA_UNAVAILABLE';
    case ErrorCode.ENGINE_DATA_FETCH_ERROR: return 'DATA_UNAVAILABLE';
    case ErrorCode.ENGINE_DATA_PARSE_ERROR: return 'DATA_CORRUPT';
    case ErrorCode.ENGINE_DB_ERROR:         return 'DATA_CORRUPT';
    case ErrorCode.ENGINE_AUTH_ERROR:       return 'UNAUTHORIZED';
    case ErrorCode.ENGINE_TOKEN_EXPIRED:    return 'TOKEN_EXPIRED';
    case ErrorCode.ENGINE_RATE_LIMIT:       return 'AI_RATE_LIMIT';
    case ErrorCode.ENGINE_BILLING_ERROR:    return 'INTERNAL_ERROR';
    case ErrorCode.ENGINE_WALLET_ERROR:     return 'INTERNAL_ERROR';
    case ErrorCode.ENGINE_IPC_ERROR:        return 'CONNECTION_FAILED';
    case ErrorCode.ENGINE_IPC_TIMEOUT:      return 'CONNECTION_FAILED';
    case ErrorCode.ENGINE_VALIDATION_ERROR: return 'INVALID_PARAM';
    case ErrorCode.ENGINE_INTERNAL_ERROR:   return 'INTERNAL_ERROR';
    default:                                return 'INTERNAL_ERROR';
  }
}

/** Check if given ErrorCode string looks like a legacy ENGINE_* code (R89 compat) */
export function isLegacyEngineCode(code: string): boolean {
  return code.indexOf('ENGINE_') === 0;
}

export interface EngineErrorDetails {
  code: ErrorCode;
  context?: Record<string, unknown>;
  cause?: Error;
  statusCode?: number;
}

export class EngineError extends Error {
  public readonly code: ErrorCode;
  public readonly domain: ErrorDomain;
  public readonly standardCode: string;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;
  public readonly statusCode: number;

  constructor(message: string, details: EngineErrorDetails) {
    super(message);
    this.name = 'EngineError';
    this.code = details.code;
    this.context = details.context;
    this.cause = details.cause;

    // ── R89 Compatibility Layer: auto-map domain + standardCode + statusCode ─
    this.domain = mapCodeToDomain(details.code);
    this.standardCode = mapCodeToStandardCode(details.code);
    this.statusCode = details.statusCode ?? mapCodeToStatusCode(details.code);

    if (details.cause?.stack) {
      this.stack = `${this.stack}\nCaused by: ${details.cause.stack}`;
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      domain: this.domain,
      standardCode: this.standardCode,
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
