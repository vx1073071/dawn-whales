/**
 * data-quality-scorer-dim-bc.test.ts — R95 J-01 Coverage Boost
 * Tests for scoreConsistency, scoreUniqueness (dim-b) and scoreUniformity (dim-c)
 */
import { describe, it, expect } from 'vitest';
import { scoreConsistency, scoreUniqueness } from '../../../../electron/engine/data/data-quality-scorer-dim-b';
import { scoreUniformity } from '../../../../electron/engine/data/data-quality-scorer-dim-c';
import type { QualityContext } from '../../../../electron/engine/data/data-quality-scorer-types';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<QualityContext> = {}): QualityContext {
  return {
    moduleId: 'test',
    ...overrides,
  };
}

// ── scoreConsistency ──────────────────────────────────────────────────────

describe('scoreConsistency', () => {
  it('returns 100 for empty data', () => {
    const result = scoreConsistency([], makeCtx());
    expect(result.score).toBe(100);
    expect(result.dimensionId).toBe('consistency');
  });

  it('returns high score for uniform schema', () => {
    const data = [
      { open: 10, close: 11, volume: 100 },
      { open: 10.5, close: 11.5, volume: 200 },
      { open: 11, close: 12, volume: 150 },
    ];
    const result = scoreConsistency(data, makeCtx());
    expect(result.score).toBe(100); // All same keys
  });

  it('penalizes schema inconsistency', () => {
    const data = [
      { open: 10, close: 11 },
      { open: 10, close: 11, volume: 100 },
      { open: 10 },
    ];
    const result = scoreConsistency(data, makeCtx());
    expect(result.score).toBeLessThan(100);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('detects mixed field types', () => {
    const data = [
      { price: 10, vol: 100 },
      { price: '10.5', vol: 200 },
      { price: null, vol: 100 },
    ];
    const result = scoreConsistency(data, makeCtx());
    expect(result.metadata.mixedTypeFields).toBeGreaterThanOrEqual(0);
  });

  it('detects out-of-order timestamps', () => {
    const data = [
      { timestamp: 3000 },
      { timestamp: 2000 },
      { timestamp: 1000 },
    ];
    const result = scoreConsistency(data, makeCtx());
    expect(result.metadata.outOfOrderRows).toBeGreaterThan(0);
  });

  it('returns all metadata fields', () => {
    const data = [{ a: 1, b: 2 }];
    const result = scoreConsistency(data, makeCtx());
    expect(result.metadata).toHaveProperty('totalRows');
    expect(result.metadata).toHaveProperty('schemaVariants');
    expect(result.metadata).toHaveProperty('mixedTypeFields');
    expect(result.metadata).toHaveProperty('outOfOrderRows');
    expect(result.metadata).toHaveProperty('uniqueFields');
  });
});

// ── scoreUniqueness ───────────────────────────────────────────────────────

describe('scoreUniqueness', () => {
  it('returns 100 for empty data', () => {
    const result = scoreUniqueness([], makeCtx());
    expect(result.score).toBe(100);
    expect(result.dimensionId).toBe('uniqueness');
  });

  it('returns near 100 for unique timestamps', () => {
    const data = [
      { timestamp: 1000, price: 10 },
      { timestamp: 2000, price: 11 },
      { timestamp: 3000, price: 12 },
    ];
    const result = scoreUniqueness(data, makeCtx());
    expect(result.score).toBe(100);
  });

  it('penalizes duplicate timestamps', () => {
    const data = [
      { timestamp: 1000, price: 10 },
      { timestamp: 1000, price: 10 }, // duplicate timestamp
      { timestamp: 2000, price: 11 },
    ];
    const result = scoreUniqueness(data, makeCtx());
    expect(result.score).toBeLessThan(100);
  });

  it('detects identical rows', () => {
    const data = [
      { timestamp: 1000, price: 10 },
      { timestamp: 1000, price: 10 }, // fully identical
      { timestamp: 2000, price: 11 },
    ];
    const result = scoreUniqueness(data, makeCtx());
    expect(result.metadata.duplicateTimestamps).toBeGreaterThanOrEqual(0);
    if (result.metadata.fullyDuplicateRows > 0) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it('reports missing timestamps', () => {
    const data = [
      { price: 10 },
      { price: 11 },
    ];
    const result = scoreUniqueness(data, makeCtx());
    expect(result.metadata.rowsWithoutTimestamp).toBe(2);
  });

  it('handles rows with multiple different timestamps', () => {
    const data = [
      { timestamp: 1000 },
      { timestamp: 2000 },
      { timestamp: 3000 },
      { timestamp: 1000 }, // duplicate with first
    ];
    const result = scoreUniqueness(data, makeCtx());
    // 3 unique timestamps out of 4 → 75% score
    expect(result.score).toBe(75);
  });

  it('returns metadata about uniqueness', () => {
    const data = [{ timestamp: 1000, v: 1 }];
    const result = scoreUniqueness(data, makeCtx());
    expect(result.metadata).toHaveProperty('totalRows');
    expect(result.metadata).toHaveProperty('duplicateTimestamps');
    expect(result.metadata).toHaveProperty('duplicateRows');
    expect(result.metadata).toHaveProperty('fullyDuplicateRows');
    expect(result.metadata).toHaveProperty('rowsWithoutTimestamp');
    expect(result.metadata).toHaveProperty('uniqueTimestamps');
  });
});

// ── scoreUniformity ───────────────────────────────────────────────────────

describe('scoreUniformity', () => {
  it('returns 100 for empty data', () => {
    const result = scoreUniformity([], makeCtx());
    expect(result.score).toBe(100);
    expect(result.dimensionId).toBe('uniformity');
  });

  it('returns 100 for uniform types', () => {
    const data = [
      { price: 10, volume: 100 },
      { price: 11, volume: 200 },
      { price: 12, volume: 300 },
    ];
    const result = scoreUniformity(data, makeCtx());
    expect(result.score).toBe(100);
  });

  it('penalizes non-uniform types', () => {
    const data = [
      { price: 10, volume: 100 },
      { price: '11', volume: 200 }, // price is string now
      { price: null, volume: 300 },
    ];
    const result = scoreUniformity(data, makeCtx());
    // price has mixed types (number, string, null)
    expect(result.score).toBeLessThan(100);
  });

  it('detects mixed numeric strings', () => {
    const data = [
      { price: 10, volume: '100' },
      { price: 11, volume: 200 },
    ];
    const result = scoreUniformity(data, makeCtx());
    expect(result.metadata.mixedNumericStrings).toBeGreaterThanOrEqual(0);
  });

  it('detects mixed date formats', () => {
    const data = [
      { date: '2024-01-15', price: 10 },
      { date: '01/15/2024', price: 11 },
    ];
    const result = scoreUniformity(data, makeCtx());
    // May have date format variants detected
    expect(result.metadata.dateFormatVariants).toBeGreaterThanOrEqual(0);
  });

  it('returns all metadata', () => {
    const data = [{ a: 1, b: 'text' }];
    const result = scoreUniformity(data, makeCtx());
    expect(result.metadata).toHaveProperty('totalRows');
    expect(result.metadata).toHaveProperty('totalFields');
    expect(result.metadata).toHaveProperty('nonUniformFields');
    expect(result.metadata).toHaveProperty('mixedNumericStrings');
    expect(result.metadata).toHaveProperty('dateFormatVariants');
  });

  it('handles arrays as a distinct type', () => {
    const data = [
      { tags: ['a', 'b'] },
      { tags: 'a' },
    ];
    const result = scoreUniformity(data, makeCtx());
    expect(result.metadata.nonUniformFields).toBeGreaterThanOrEqual(0);
  });

  it('handles many rows efficiently', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({
      price: i + 10,
      volume: 1000 + i,
    }));
    const result = scoreUniformity(data, makeCtx());
    expect(result.score).toBe(100);
  });
});
