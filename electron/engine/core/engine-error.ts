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

/** Engine error with domain, code, context, and optionally the original cause.
 *
 * Supports 2 constructor signatures:
 *   1. STANDARD  (R84+):   new EngineError(ErrorDomain, ErrorCode, message, options?)
 *   2. LEGACY    (R88):    new EngineError(message, options?)  — auto-maps to SYSTEM/INTERNAL_ERROR
 *      Legacy form is @deprecated since R89; migrate callers to use domain-specific factory methods.
 */
export class EngineError extends Error {
  public readonly domain: ErrorDomain;
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;
  public readonly timestamp: string;

  // Legacy-compatible: 2-arg form maps to SYSTEM/INTERNAL_ERROR
  constructor(message: string, options?: { code?: string; statusCode?: number; context?: Record<string, unknown>; cause?: Error });
  // Standard 3-arg form
  constructor(domain: ErrorDomain, code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error });
  // Implementation
  constructor(
    arg1: string | ErrorDomain,
    arg2?: ErrorCode | { code?: string; statusCode?: number; context?: Record<string, unknown>; cause?: Error },
    arg3?: string,
    options?: { context?: Record<string, unknown>; cause?: Error }
  ) {
    // Legacy form: new EngineError('msg') or new EngineError('msg', { code, statusCode })
    if (typeof arg1 === 'string' && (typeof arg2 !== 'string' || !arg2)) {
      const msg = arg1;
      super(msg);
      const legacyOpts = (arg2 as { code?: string; statusCode?: number; context?: Record<string, unknown>; cause?: Error }) || {};
      this.domain = ErrorDomain.SYSTEM;
      this.code = mapLegacyCodeToErrorCode(legacyOpts.code);
      this.statusCode = legacyOpts.statusCode || 500;
      this.context = legacyOpts.context;
      this.cause = legacyOpts.cause;
    } else {
      // Standard form: new EngineError(ErrorDomain, ErrorCode, message, options?)
      const domain = arg1 as ErrorDomain;
      const code = arg2 as ErrorCode;
      const msg = arg3!;
      super(msg);
      this.domain = domain;
      this.code = code;
      this.statusCode = getDefaultStatusCode(domain, code);
      this.context = options?.context;
      this.cause = options?.cause;
    }

    this.name = 'EngineError';
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

  /** Create a VALIDATION-domain error */
  static validation(code: ErrorCode, message: string, context?: Record<string, unknown>): EngineError {
    return new EngineError(ErrorDomain.VALIDATION, code, message, { context });
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

/** Map legacy string error codes to standard ErrorCode enum */
function mapLegacyCodeToErrorCode(legacyCode?: string): ErrorCode {
  if (!legacyCode) return ErrorCode.INTERNAL_ERROR;

  const codeMap: Record<string, ErrorCode> = {
    'ORDER_REJECTED': ErrorCode.ORDER_REJECTED,
    'ORDER_TIMEOUT': ErrorCode.ORDER_TIMEOUT,
    'INSUFFICIENT_BALANCE': ErrorCode.INSUFFICIENT_BALANCE,
    'POSITION_LIMIT': ErrorCode.POSITION_LIMIT,
    'DATA_UNAVAILABLE': ErrorCode.DATA_UNAVAILABLE,
    'DATA_STALE': ErrorCode.DATA_STALE,
    'DATA_CORRUPT': ErrorCode.DATA_CORRUPT,
    'AI_TIMEOUT': ErrorCode.AI_TIMEOUT,
    'AI_PARSE_ERROR': ErrorCode.AI_PARSE_ERROR,
    'AI_RATE_LIMIT': ErrorCode.AI_RATE_LIMIT,
    'UNAUTHORIZED': ErrorCode.UNAUTHORIZED,
    'TOKEN_EXPIRED': ErrorCode.TOKEN_EXPIRED,
    'LICENSE_INVALID': ErrorCode.LICENSE_INVALID,
    'CONNECTION_FAILED': ErrorCode.CONNECTION_FAILED,
    'WEBSOCKET_CLOSED': ErrorCode.WEBSOCKET_CLOSED,
    'INVALID_PARAM': ErrorCode.INVALID_PARAM,
    'MISSING_FIELD': ErrorCode.MISSING_FIELD,
    'INTERNAL_ERROR': ErrorCode.INTERNAL_ERROR,
    'SHUTDOWN': ErrorCode.SHUTDOWN,
    'ENGINE_VALIDATION_ERROR': ErrorCode.INVALID_PARAM,
    'ENGINE_AI_ERROR': ErrorCode.AI_PARSE_ERROR,
    'ENGINE_INTERNAL_ERROR': ErrorCode.INTERNAL_ERROR,
    'ENGINE_DATA_ERROR': ErrorCode.DATA_UNAVAILABLE,
    'ENGINE_AUTH_ERROR': ErrorCode.UNAUTHORIZED,
    'ENGINE_CONNECTION_ERROR': ErrorCode.CONNECTION_FAILED,
    'ENGINE_ORDER_ERROR': ErrorCode.ORDER_REJECTED,
    'ENGINE_SYSTEM_ERROR': ErrorCode.INTERNAL_ERROR,
    'VALIDATION': ErrorCode.INVALID_PARAM,
    'NOT_FOUND': ErrorCode.DATA_UNAVAILABLE,
    'TIMEOUT': ErrorCode.AI_TIMEOUT,
    'UNAUTHORIZED_ACCESS': ErrorCode.UNAUTHORIZED,
    'PARSE_ERROR': ErrorCode.AI_PARSE_ERROR,
    'NETWORK_ERROR': ErrorCode.CONNECTION_FAILED,
  };

  return codeMap[legacyCode] || ErrorCode.INTERNAL_ERROR;
}

/** Get default HTTP status code for error domain + code */
function getDefaultStatusCode(domain: ErrorDomain, _code: ErrorCode): number {
  switch (domain) {
    case ErrorDomain.AUTH: return 401;
    case ErrorDomain.VALIDATION: return 400;
    case ErrorDomain.DATA: return 404;
    case ErrorDomain.TRADE: return 402;
    case ErrorDomain.AI: return 502;
    case ErrorDomain.NETWORK: return 503;
    case ErrorDomain.SYSTEM: return 500;
    default: return 500;
  }
}
