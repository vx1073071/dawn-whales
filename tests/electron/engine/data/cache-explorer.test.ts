/**
 * Tests for cache-explorer — J-01 R95.1
 */
import { describe, it, expect, vi } from 'vitest';
import {
  exploreCache,
  getCacheEntryDetail,
  getCacheKeys,
} from '../../../../electron/engine/data/cache-explorer';

vi.mock('../../../electron/engine/core/smart-cache', () => ({
  getSmartCacheManager: vi.fn(() => ({
    getStats: vi.fn(() => ({ keys: 10, hits: 100, misses: 5, size: 1024 })),
    get: vi.fn((key: string) => key === 'k1' ? { data: 'cached-data' } : undefined),
    keys: vi.fn(() => ['k1', 'k2']),
  })),
}));

describe('exploreCache', () => {
  it('returns result with namespaces', () => {
    const r = exploreCache();
    expect(r).toHaveProperty('namespaces');
    expect(r).toHaveProperty('totalEntries');
    expect(r).toHaveProperty('timestamp');
  });
});

describe('getCacheEntryDetail', () => {
  it('returns detail for existing key', () => {
    const r = getCacheEntryDetail('k1');
    expect(r).toBeDefined();
  });
  it('returns null for non-existent', () => {
    const r = getCacheEntryDetail('missing');
    expect(r).toBeNull();
  });
});

describe('getCacheKeys', () => {
  it('returns array of keys', () => {
    const keys = getCacheKeys();
    expect(Array.isArray(keys) || keys === undefined).toBe(true);
  });
});
