/**
 * J-53-04: Mobile API Adapter Tests (10+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MobileApiAdapter,
  ResponseCache,
  FieldStripper,
  getMobileApiAdapter,
  resetMobileApiAdapter,
} from '../electron/engine/data/mobile-api-adapter';

function mkItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `item_${i}`,
    name: `Item ${i}`,
    description: `Description for item ${i} which is fairly long to test compression`,
    price: 10 + i,
    rating: 3 + (i % 3),
    tags: ['tag1', 'tag2'],
    metadata: { created: '2026-01-01', extra: 'data' },
  }));
}

// ── Section 1: ResponseCache ────────────────────────────────────────────

describe('J-53-04-01: ResponseCache', () => {
  let cache: ResponseCache;
  beforeEach(() => { cache = new ResponseCache(5); });

  it('A01: get returns null for missing key', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('A02: set/get round-trips data', () => {
    cache.set('k1', { value: 42 }, 'short');
    expect(cache.get('k1')).toEqual({ value: 42 });
  });

  it('A03: cache:none does not store', () => {
    cache.set('k1', { value: 42 }, 'none');
    expect(cache.get('k1')).toBeNull();
  });

  it('A04: evicts oldest when at capacity', () => {
    for (let i = 0; i < 6; i++) cache.set(`k${i}`, i, 'medium');
    expect(cache.getStats().size).toBeLessThanOrEqual(5);
  });

  it('A05: invalidate by prefix', () => {
    cache.set('trader:1', 'a', 'short');
    cache.set('trader:2', 'b', 'short');
    cache.set('signal:1', 'c', 'short');
    expect(cache.invalidate('trader:')).toBe(2);
    expect(cache.get('signal:1')).toBe('c');
  });
});

// ── Section 2: FieldStripper ────────────────────────────────────────────

describe('J-53-04-02: FieldStripper', () => {
  let stripper: FieldStripper;
  beforeEach(() => { stripper = new FieldStripper(); });

  it('B01: include selects only specified fields', () => {
    const { stripped } = stripper.strip(mkItems(2), { include: ['id', 'name'] });
    expect(Object.keys(stripped[0])).toEqual(['id', 'name']);
  });

  it('B02: exclude removes specified fields', () => {
    const { stripped, fieldsRemoved } = stripper.strip(mkItems(1), { exclude: ['metadata', 'tags'] });
    expect('metadata' in stripped[0]).toBe(false);
    expect(fieldsRemoved).toBe(2);
  });

  it('B03: estimateSavings shows reduction', () => {
    const items = mkItems(10);
    const { stripped } = stripper.strip(items, { include: ['id', 'price'] });
    const savings = stripper.estimateSavings(items, stripped);
    expect(savings.savingsPct).toBeGreaterThan(50);
  });
});

// ── Section 3: MobileApiAdapter ─────────────────────────────────────────

describe('J-53-04-03: MobileApiAdapter', () => {
  let adapter: MobileApiAdapter;
  beforeEach(() => { resetMobileApiAdapter(); adapter = getMobileApiAdapter(); });

  it('C01: paginate returns correct page', () => {
    const r = adapter.paginate(mkItems(50), { page: 1, pageSize: 10 });
    expect(r.items.length).toBe(10);
    expect(r.total).toBe(50);
    expect(r.hasMore).toBe(true);
    expect(r.nextCursor).toBeDefined();
  });

  it('C02: paginate last page has hasMore=false', () => {
    const r = adapter.paginate(mkItems(25), { page: 3, pageSize: 10 });
    expect(r.items.length).toBe(5);
    expect(r.hasMore).toBe(false);
  });

  it('C03: cursor-based pagination works', () => {
    const page1 = adapter.paginate(mkItems(30), { page: 1, pageSize: 10 });
    const page2 = adapter.paginate(mkItems(30), { cursor: page1.nextCursor, pageSize: 10 });
    expect(page2.page).toBe(2);
    expect(page2.items[0].id).toBe('item_10');
  });

  it('C04: adaptResponse strips fields', () => {
    const r = adapter.adaptResponse('traders', mkItems(5), {
      fieldSelector: { include: ['id', 'name', 'price'] },
    });
    expect(r.data.length).toBe(5);
    expect(Object.keys(r.data[0])).toEqual(['id', 'name', 'price']);
    expect(r.meta.fieldsStripped).toBeGreaterThan(0);
    expect(r.meta.compressedSize).toBeLessThan(r.meta.originalSize);
  });

  it('C05: adaptResponse caches with policy', () => {
    const items = mkItems(3);
    adapter.adaptResponse('signals', items, { cachePolicy: 'short' });
    const cached = adapter.adaptResponse('signals', items, { cachePolicy: 'short' });
    expect(cached.meta.cached).toBe(true);
  });

  it('C06: adaptPaginated combines pagination + stripping', () => {
    const r = adapter.adaptPaginated('market', mkItems(50), { page: 2, pageSize: 10 }, {
      fieldSelector: { exclude: ['metadata', 'description'] },
    });
    expect(r.data.items.length).toBe(10);
    expect(r.data.page).toBe(2);
    expect('metadata' in r.data.items[0]).toBe(false);
  });

  it('C07: invalidateCache clears endpoint cache', () => {
    adapter.adaptResponse('traders', mkItems(1), { cachePolicy: 'long' });
    expect(adapter.invalidateCache('traders')).toBe(1);
    const r = adapter.adaptResponse('traders', mkItems(1), { cachePolicy: 'long' });
    expect(r.meta.cached).toBe(false);
  });

  it('C08: singleton returns same instance', () => {
    const a = getMobileApiAdapter();
    const b = getMobileApiAdapter();
    expect(a).toBe(b);
  });

  it('C09: maxPageSize is enforced', () => {
    resetMobileApiAdapter();
    const adapter = getMobileApiAdapter({ maxPageSize: 5 });
    const r = adapter.paginate(mkItems(50), { pageSize: 100 });
    expect(r.items.length).toBe(5);
    expect(r.pageSize).toBe(5);
  });

  it('C10: reset clears cache', () => {
    adapter.adaptResponse('x', mkItems(1), { cachePolicy: 'long' });
    adapter.reset();
    const r = adapter.adaptResponse('x', mkItems(1), { cachePolicy: 'long' });
    expect(r.meta.cached).toBe(false);
  });
});
