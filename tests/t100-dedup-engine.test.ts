import { describe, it, expect } from 'vitest';
import { DedupEngine } from '../electron/workers/dedup-engine';

vi.setConfig({ testTimeout: 30000 });
describe('DedupEngine', () => {
  it('should detect duplicates', () => {
    const de = new DedupEngine({ windowMs: 99999 });
    expect(de.isDuplicate({ id: 1, price: 100 })).toBe(false);
    expect(de.isDuplicate({ id: 1, price: 100 })).toBe(true);
  });

  it('should deduplicate array', () => {
    const de = new DedupEngine({ windowMs: 99999 });
    const result = de.deduplicate(['a', 'b', 'a', 'c', 'b']);
    expect(result.unique).toEqual(['a', 'b', 'c']);
    expect(result.duplicates).toBe(2);
  });

  it('should expire old entries', async () => {
    const de = new DedupEngine({ windowMs: 10 });
    de.isDuplicate('x');
    await new Promise(r => setTimeout(r, 15));
    expect(de.isDuplicate('x')).toBe(false); // expired
  });

  it('should hash by fields', () => {
    const de = new DedupEngine({ windowMs: 99999, hashFields: ['symbol', 'timestamp'] });
    expect(de.isDuplicate({ symbol: 'AAPL', timestamp: 1000, price: 150 })).toBe(false);
    expect(de.isDuplicate({ symbol: 'AAPL', timestamp: 1000, price: 999 })).toBe(true); // same key fields
  });
});
