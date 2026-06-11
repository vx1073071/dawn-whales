/**
 * J-53-04: Mobile API Adapter Tests (10+ tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PaginationHelper,
  LightweightResponse,
  ResponseCache,
  RateLimiter,
  okResponse,
  errorResponse,
  cachedResponse,
  resetMobileApi,
  getResponseCache,
  getRateLimiter,
} from '../electron/engine/data/mobile-api-adapter';

// ── Section 1: Pagination ──────────────────────────────────────────────────

describe('J-53-04-01: Pagination', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: `item_${i}`, name: `Item ${i}` }));

  it('01: paginate returns correct page', () => {
    const result = PaginationHelper.paginate(items, { page: 1, pageSize: 10 });
    expect(result.data.length).toBe(10);
    expect(result.total).toBe(50);
    expect(result.totalPages).toBe(5);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(false);
  });

  it('02: paginate last page has no next', () => {
    const result = PaginationHelper.paginate(items, { page: 5, pageSize: 10 });
    expect(result.data.length).toBe(10);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(true);
  });

  it('03: cursorPaginate starts from beginning', () => {
    const result = PaginationHelper.cursorPaginate(items, { limit: 10 });
    expect(result.data.length).toBe(10);
    expect(result.data[0].id).toBe('item_0');
    expect(result.hasNext).toBe(true);
    expect(result.nextCursor).toBe('item_9');
  });

  it('04: cursorPaginate continues from cursor', () => {
    const result = PaginationHelper.cursorPaginate(items, { cursor: 'item_9', limit: 10 });
    expect(result.data.length).toBe(10);
    expect(result.data[0].id).toBe('item_10');
  });

  it('05: cursorPaginate at end has no next', () => {
    const result = PaginationHelper.cursorPaginate(items, { cursor: 'item_45', limit: 10 });
    expect(result.data.length).toBe(4); // items 46-49
    expect(result.hasNext).toBe(false);
    expect(result.nextCursor).toBeUndefined();
  });
});

// ── Section 2: Lightweight Response ────────────────────────────────────────

describe('J-53-04-02: Lightweight Response', () => {
  it('06: strips heavy fields', () => {
    const lr = new LightweightResponse();
    const obj = { id: 's1', name: 'Strategy', code: '1000 lines', backtestResult: { big: true } };
    const result = lr.build(obj);
    expect(result.id).toBe('s1');
    expect(result.name).toBe('Strategy');
    expect((result as any).code).toBeUndefined();
    expect((result as any).backtestResult).toBeUndefined();
  });

  it('07: buildList processes arrays', () => {
    const lr = new LightweightResponse();
    const items = [
      { id: '1', name: 'A', code: 'heavy' },
      { id: '2', name: 'B', code: 'heavy' },
    ];
    const result = lr.buildList(items);
    expect(result.length).toBe(2);
    result.forEach(r => expect((r as any).code).toBeUndefined());
  });

  it('08: estimateSize returns byte count', () => {
    const size = LightweightResponse.estimateSize({ hello: 'world' });
    expect(size).toBeGreaterThan(0);
    expect(size).toBe(JSON.stringify({ hello: 'world' }).length);
  });
});

// ── Section 3: Cache ──────────────────────────────────────────────────────

describe('J-53-04-03: Response Cache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache(100, 10); // 100ms TTL, max 10 entries
  });

  it('09: get returns null for missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('10: set + get returns cached data', () => {
    cache.set('key1', { value: 42 });
    expect(cache.get('key1')).toEqual({ value: 42 });
  });

  it('11: expired entries return null', async () => {
    cache.set('key1', { value: 42 }, 10); // 10ms TTL
    await new Promise(r => setTimeout(r, 20));
    expect(cache.get('key1')).toBeNull();
  });

  it('12: invalidate removes entry', () => {
    cache.set('key1', { value: 1 });
    cache.invalidate('key1');
    expect(cache.get('key1')).toBeNull();
  });

  it('13: invalidatePattern removes matching entries', () => {
    cache.set('strat_1', 'a');
    cache.set('strat_2', 'b');
    cache.set('user_1', 'c');
    const count = cache.invalidatePattern('strat');
    expect(count).toBe(2);
    expect(cache.size).toBe(1);
  });
});

// ── Section 4: Rate Limiter ────────────────────────────────────────────────

describe('J-53-04-04: Rate Limiter', () => {
  it('14: allows within limit', () => {
    const limiter = new RateLimiter(5, 60000);
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('client1').allowed).toBe(true);
    }
  });

  it('15: blocks over limit', () => {
    const limiter = new RateLimiter(3, 60000);
    limiter.check('c1');
    limiter.check('c1');
    limiter.check('c1');
    const result = limiter.check('c1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('16: independent per client', () => {
    const limiter = new RateLimiter(2, 60000);
    limiter.check('c1');
    limiter.check('c1');
    expect(limiter.check('c1').allowed).toBe(false);
    expect(limiter.check('c2').allowed).toBe(true); // different client
  });

  it('17: reset clears client', () => {
    const limiter = new RateLimiter(2, 60000);
    limiter.check('c1');
    limiter.check('c1');
    limiter.reset('c1');
    expect(limiter.check('c1').allowed).toBe(true);
  });
});

// ── Section 5: Response Builders ───────────────────────────────────────────

describe('J-53-04-05: Response Builders', () => {
  it('18: okResponse wraps data', () => {
    const r = okResponse({ items: [1, 2, 3] });
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ items: [1, 2, 3] });
  });

  it('19: errorResponse includes code and retryable', () => {
    const r = errorResponse('RATE_LIMIT', 'Too many requests', true);
    expect(r.ok).toBe(false);
    expect(r.error!.code).toBe('RATE_LIMIT');
    expect(r.error!.retryable).toBe(true);
  });

  it('20: cachedResponse marks cached flag', () => {
    const r = cachedResponse({ stale: true });
    expect(r.ok).toBe(true);
    expect(r.meta!.cached).toBe(true);
  });
});
