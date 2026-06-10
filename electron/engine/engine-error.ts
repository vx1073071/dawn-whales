// ── DAWN WHALES — Engine Error Standardization (R84) ──────────────────────
// Unified error types for all engine error paths.
// Replace throw new Error('...') with throw new EngineError(...) for structured logging.

/** Error domain — maps to monitoring categories */
export enum ErrorDomain {
  TRADE = 'TRADE',
  DATA = 'DATA',
  AI = 'AI',
  AUTH = 'AUTH',
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  SYSTEM = 'SYSTEM',
}

/** Standard error codes within domains */
export enum ErrorCode {
  // TRADE
  ORDER_REJECTED = 'ORDER_REJECTED',
  ORDER_TIMEOUT = 'ORDER_TIMEOUT',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  POSITION_LIMIT = 'POSITION_LIMIT',
  // DATA
  DATA_UNAVAILABLE = 'DATA_UNAVAILABLE',
  DATA_STALE = 'DATA_STALE',
  DATA_CORRUPT = 'DATA_CORRUPT',
  // AI
  AI_TIMEOUT = 'AI_TIMEOUT',
  AI_PARSE_ERROR = 'AI_PARSE_ERROR',
  AI_RATE_LIMIT = 'AI_RATE_LIMIT',
  // AUTH
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  LICENSE_INVALID = 'LICENSE_INVALID',
  // NETWORK
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  WEBSOCKET_CLOSED = 'WEBSOCKET_CLOSED',
  // VALIDATION
  INVALID_PARAM = 'INVALID_PARAM',
  MISSING_FIELD = 'MISSING_FIELD',
  // SYSTEM
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SHUTDOWN = 'SHUTDOWN',
}

/** Engine error with domain, code, context, and optionally the original cause */
export class EngineError extends Error {
  public readonly domain: ErrorDomain;
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;
  public readonly timestamp: string;

  constructor(
    domain: ErrorDomain,
    code: ErrorCode,
    message: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'EngineError';
    this.domain = domain;
    this.code = code;
    this.context = options?.context;
    this.cause = options?.cause;
    this.timestamp = new Date().toISOString();
  }

  /** Create a DATA-domain error */
  static data(code: ErrorCode, message: string, context?: Record<string, unknown>): EngineError {
    return new EngineError(ErrorDomain.DATA, code, message, { context });
  }

  /** Create a TRADE-domain error */
  static trade(code: ErrorCode, message: string, context?: Record<string, unknown>): EngineError {
    return new EngineError(ErrorDomain.TRADE, code, message, { context });
  }

  /** Create an AI-domain error */
  static ai(code: ErrorCode, message: string, context?: Record<string, unknown>): EngineError {
    return new EngineError(ErrorDomain.AI, code, message, { context });
  }

  /** Create an AUTH-domain error */
  static auth(code: ErrorCode, message: string, context?: Record<string, unknown>): EngineError {
    return new EngineError(ErrorDomain.AUTH, code, message, { context });
  }

  /** Create a SYSTEM-domain error */
  static system(code: ErrorCode, message: string, context?: Record<string, unknown>): EngineError {
    return new EngineError(ErrorDomain.SYSTEM, code, message, { context });
  }

  /** Serialize for logging / IPC transport */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      domain: this.domain,
      code: this.code,
      message: this.message,
      context: this.context,
      causeMessage: this.cause?.message,
      timestamp: this.timestamp,
    };
  }
}
