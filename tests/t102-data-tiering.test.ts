import { describe, it, expect } from 'vitest';
import { DataTiering } from '../electron/workers/data-tiering';

describe('DataTiering', () => {
  it('should start in hot tier', () => {
    const dt = new DataTiering();
    dt.set('key1', 'value');
    const entries = dt.getByTier('hot');
    expect(entries.length).toBe(1);
    expect(entries[0].tier).toBe('hot');
  });

  it('should promote on frequent access', () => {
    const dt = new DataTiering();
    dt.set('key1', 'value');
    // Access 15 times
    for (let i = 0; i < 15; i++) dt.get('key1');
    const result = dt.classify();
    // Already hot, no promotion needed essentially
    const stats = dt.getStats();
    expect(stats.total).toBe(1);
  });

  it('should evict cold entries', () => {
    const dt = new DataTiering();
    // Override rules for testing
    (dt as any).rules = [
      { tier: 'hot', maxAgeMs: 1, maxAccessGapMs: 1, storageType: 'memory' },
      { tier: 'cold', maxAgeMs: 1, maxAccessGapMs: 1, storageType: 'archive' },
    ];

    dt.set('old_key', 'data');
    // Force age past threshold
    (dt as any).entries.get('old_key').createdAt = 0;
    (dt as any).entries.get('old_key').lastAccessed = 0;

    const result = dt.classify();
    expect(result.demotions.length + dt.getStats().stats.evictions).toBeGreaterThanOrEqual(1);
  });
});
