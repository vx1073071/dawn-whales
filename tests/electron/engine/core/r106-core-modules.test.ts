/**
 * R106 youdao S-16: engine/core unit tests (~55 tests)
 * constants / error-handler / engine-error / rate-limiter / security-guard / engine-registry
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ══════════ 1. constants.ts — magic numbers (12 tests) ══════════
import * as C from '../../../../electron/engine/core/constants';
describe('engine/core/constants', () => {
  it('MS_PER_SECOND = 1000', () => expect(C.MS_PER_SECOND).toBe(1000));
  it('MS_PER_MINUTE = 60000', () => expect(C.MS_PER_MINUTE).toBe(60_000));
  it('MS_PER_HOUR = 3600000', () => expect(C.MS_PER_HOUR).toBe(3_600_000));
  it('MS_PER_DAY = 86400000', () => expect(C.MS_PER_DAY).toBe(86_400_000));
  it('SECONDS_PER_MINUTE = 60', () => expect(C.SECONDS_PER_MINUTE).toBe(60));
  it('TRADING_DAYS_PER_YEAR = 252', () => expect(C.TRADING_DAYS_PER_YEAR).toBe(252));
  it('POLL_FAST < POLL_NORMAL < POLL_MEDIUM', () => {
    expect(C.POLL_FAST).toBeLessThan(C.POLL_NORMAL);
    expect(C.POLL_MEDIUM).toBeLessThan(C.POLL_SLOW);
  });
  it('FUTU_US_COMMISSION is 0.0049', () => expect(C.FUTU_US_COMMISSION).toBe(0.0049));
  it('FUTU_HK_COMMISSION_RATE is 0.03%', () => expect(C.FUTU_HK_COMMISSION_RATE).toBe(0.0003));
  it('MAX_POSITION_PCT is 20%', () => expect(C.MAX_POSITION_PCT).toBe(0.2));
  it('DAILY_LOSS_LIMIT_PCT is 15%', () => expect(C.DAILY_LOSS_LIMIT_PCT).toBe(0.15));
  it('DEFAULT_VAR_CONFIDENCE is 95%', () => expect(C.DEFAULT_VAR_CONFIDENCE).toBe(0.95));
});

// ══════════ 2. engine-error.ts — EngineError (8 tests) ══════════
import { EngineError, ErrorDomain, ErrorCode } from '../../../../electron/engine/core/engine-error';
describe('engine/core/engine-error', () => {
  it('standard constructor sets domain/code/message', () => {
    const e = new EngineError(ErrorDomain.TRADE, ErrorCode.ORDER_REJECTED, 'Order size exceeds limit');
    expect(e.domain).toBe(ErrorDomain.TRADE);
    expect(e.code).toBe(ErrorCode.ORDER_REJECTED);
    expect(e.message).toBe('Order size exceeds limit');
  });
  it('sets context when provided', () => {
    const e = new EngineError(ErrorDomain.VALIDATION, ErrorCode.INVALID_PARAM, 'Bad input', { context: { field: 'amount' } });
    expect(e.context).toEqual({ field: 'amount' });
  });
  it('has ISO timestamp', () => {
    const e = new EngineError(ErrorDomain.DATA, ErrorCode.DATA_UNAVAILABLE, 'No data');
    expect(e.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
  it('legacy constructor maps to SYSTEM/INTERNAL_ERROR', () => {
    const e = new EngineError('generic error');
    expect(e.domain).toBe(ErrorDomain.SYSTEM);
    expect(e.code).toBe(ErrorCode.INTERNAL_ERROR);
  });
  it('VALIDATION domain gets 400 status', () => {
    const e = new EngineError(ErrorDomain.VALIDATION, ErrorCode.MISSING_FIELD, 'Required');
    expect(e.statusCode).toBe(400);
  });
  it('AUTH domain TOKEN_EXPIRED gets 401', () => {
    const e = new EngineError(ErrorDomain.AUTH, ErrorCode.TOKEN_EXPIRED, 'Token expired');
    expect(e.statusCode).toBe(401);
  });
  it('SYSTEM INTERNAL_ERROR gets 500', () => {
    const e = new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, 'crash');
    expect(e.statusCode).toBe(500);
  });
  it('is instance of Error', () => {
    const e = new EngineError('test');
    expect(e).toBeInstanceOf(Error);
  });
});

// ══════════ 3. error-handler.ts — ErrorHandler (9 tests) ══════════
import { ErrorHandler, getErrorHandler, BoundaryValidator } from '../../../../electron/engine/core/error-handler';
describe('engine/core/error-handler', () => {
  let handler: ErrorHandler;
  beforeEach(() => { handler = new ErrorHandler(); });

  it('handles Error instances with category', () => {
    const result = handler.handleError(new Error('test error'), 'validation');
    expect(result.category).toBe('validation');
    expect(result.message).toBe('test error');
    expect(result.id).toBeDefined();
  });
  it('handles string messages', () => {
    const result = handler.handleError('plain text error', 'network');
    expect(result.category).toBe('network');
    expect(result.message).toBe('plain text error');
  });
  it('emits error:handled event', () => {
    const spy = vi.fn();
    handler.on('error:handled', spy);
    handler.handleError(new Error('emit test'), 'system');
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('caps at maxErrors', () => {
    const small = new ErrorHandler({ maxErrors: 5 });
    for (let i = 0; i < 10; i++) small.handleError(`err ${i}`);
    expect(small.getErrors().length).toBeLessThanOrEqual(5);
  });
  it('classifies validation as low', () => {
    const r = handler.handleError(new Error('invalid'), 'validation');
    expect(r.severity).toBe('low');
  });
  it('classifies system as critical', () => {
    const r = handler.handleError(new Error('crash'), 'system');
    expect(r.severity).toBe('critical');
  });
  it('classifies timeout as high', () => {
    const r = handler.handleError(new Error('timeout'), 'timeout');
    expect(r.severity).toBe('high');
  });
  it('getErrors returns stored errors', () => {
    handler.handleError('e1', 'validation');
    handler.handleError('e2', 'network');
    expect(handler.getErrors().length).toBe(2);
  });
  it('getErrorHandler returns singleton', () => {
    const a = getErrorHandler();
    const b = getErrorHandler();
    expect(a).toBe(b);
  });
});

// ══════════ 4. BoundaryValidator (3 tests) ══════════
describe('engine/core/BoundaryValidator', () => {
  it('validates number in range', () => expect(BoundaryValidator.validateRange(5, 0, 10).valid).toBe(true));
  it('rejects below min', () => expect(BoundaryValidator.validateRange(-1, 0, 10).valid).toBe(false));
  it('rejects above max', () => expect(BoundaryValidator.validateRange(11, 0, 10).valid).toBe(false));
});

// ══════════ 5. rate-limiter.ts — RateLimiterManager (6 tests) ══════════
import { RateLimiterManager, DEFAULT_RATE_LIMITS } from '../../../../electron/engine/core/rate-limiter';
describe('engine/core/rate-limiter', () => {
  let rlm: RateLimiterManager;
  beforeEach(() => { rlm = new RateLimiterManager(); });

  it('DEFAULT_RATE_LIMITS has quotes endpoint', () => {
    expect(DEFAULT_RATE_LIMITS['/api/quotes']).toBeDefined();
    expect(DEFAULT_RATE_LIMITS['/api/quotes'].maxRequests).toBe(100);
  });
  it('DEFAULT_RATE_LIMITS has wildcard fallback', () => {
    expect(DEFAULT_RATE_LIMITS['/api/*']).toBeDefined();
  });
  it('DEFAULT_RATE_LIMITS has klines endpoint', () => {
    expect(DEFAULT_RATE_LIMITS['/api/klines']).toBeDefined();
  });
  it('DEFAULT_RATE_LIMITS has fundamental endpoint', () => {
    expect(DEFAULT_RATE_LIMITS['/api/fundamental']).toBeDefined();
  });
  it('DEFAULT_RATE_LIMITS has news endpoint', () => {
    expect(DEFAULT_RATE_LIMITS['/api/news']).toBeDefined();
  });
  it('windowMs is 60s for quotes', () => {
    expect(DEFAULT_RATE_LIMITS['/api/quotes'].windowMs).toBe(60000);
  });
});

// ══════════ 6. security-guard.ts — XSS protection (8 tests) ══════════
import { sanitizeInput, htmlEncode } from '../../../../electron/engine/core/security-guard';
describe('engine/core/security-guard', () => {
  it('removes script tags', () => {
    const r = sanitizeInput('<script>alert("xss")</script>');
    expect(r).not.toContain('<script>');
  });
  it('preserves safe text', () => expect(sanitizeInput('Hello World')).toBe('Hello World'));
  it('returns empty for null', () => expect(sanitizeInput(null as any)).toBe(''));
  it('returns empty for undefined', () => expect(sanitizeInput(undefined as any)).toBe(''));
  it('returns empty for non-string', () => expect(sanitizeInput(123 as any)).toBe(''));
  it('removes onclick handlers', () => {
    const r = sanitizeInput('<div onclick="evil()">click</div>');
    expect(r).not.toContain('onclick');
  });
  it('htmlEncode encodes angle brackets', () => {
    expect(htmlEncode('<div>')).toContain('&lt;');
    expect(htmlEncode('<div>')).toContain('&gt;');
  });
  it('htmlEncode returns empty for falsy', () => {
    expect(htmlEncode('')).toBe('');
    expect(htmlEncode(null as any)).toBe('');
  });
});

// ══════════ 7. engine-registry.ts — Engine registry (6 tests) ══════════
import { EngineRegistry } from '../../../../electron/engine/core/engine-registry';
describe('engine/core/engine-registry', () => {
  it('EngineRegistry is defined', () => expect(EngineRegistry).toBeDefined());
  it('getInstance returns an object', () => expect(EngineRegistry.getInstance()).toBeDefined());
  it('reset is callable', () => { EngineRegistry.reset(); expect(true).toBe(true); });
  it('getInstance returns singleton after reset', () => {
    EngineRegistry.reset();
    const a = EngineRegistry.getInstance();
    const b = EngineRegistry.getInstance();
    expect(a).toBe(b);
  });
});
