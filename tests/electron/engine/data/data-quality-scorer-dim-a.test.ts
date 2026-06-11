/**
 * Tests for data-quality-scorer-dim-a — scoreCompleteness, scoreAccuracy, scoreTimeliness.
 */
import { describe, it, expect } from 'vitest';
import {
  scoreCompleteness,
  scoreAccuracy,
  scoreTimeliness,
} from '../../../../electron/engine/data/data-quality-scorer-dim-a';
import type { QualityContext } from '../../../../electron/engine/data/data-quality-scorer-types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<QualityContext>): QualityContext {
  return {
    symbol: 'TEST',
    dataType: 'kline',
    ...overrides,
  };
}

function makeRow(overrides: Record<string, any> = {}) {
  return {
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1000,
    timestamp: 1700000000000,
    ...overrides,
  };
}

// ── scoreCompleteness ────────────────────────────────────────────────────────

describe('scoreCompleteness', () => {
  it('returns score=0 with critical issue for empty dataset', () => {
    const result = scoreCompleteness([], makeCtx());
    expect(result.dimensionId).toBe('completeness');
    expect(result.score).toBe(0);
    expect(result.issues.length).toBe(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].type).toBe('empty_dataset');
    expect(result.metadata.totalRows).toBe(0);
  });

  it('returns 100 for complete data with no gaps', () => {
    const data = [makeRow(), makeRow({ timestamp: 1700000060000 })];
    const result = scoreCompleteness(data, makeCtx());
    expect(result.score).toBe(100);
    expect(result.issues.length).toBe(0);
  });

  it('penalizes missing values in critical fields', () => {
    const data = [
      makeRow({ open: null }),
      makeRow({ high: undefined }),
      makeRow(),
    ];
    const result = scoreCompleteness(data, makeCtx());
    expect(result.score).toBeLessThan(100);
    const missingIssue = result.issues.find(i => i.type === 'missing_values');
    expect(missingIssue).toBeDefined();
    expect(missingIssue!.affectedRows).toBe(2);
  });

  it('treats empty string as missing', () => {
    const data = [makeRow({ close: '' })];
    const result = scoreCompleteness(data, makeCtx());
    expect(result.metadata.missingCells).toBe(1);
  });

  it('detects timestamp gaps when expectedInterval provided', () => {
    const data = [
      makeRow({ timestamp: 1000000 }),
      makeRow({ timestamp: 1000000 + 600000 }), // 10min gap, expected 1min
      makeRow({ timestamp: 1000000 + 1200000 }),
    ];
    const result = scoreCompleteness(data, makeCtx({ expectedInterval: '1m' }));
    const gapIssue = result.issues.find(i => i.type === 'timestamp_gap');
    expect(gapIssue).toBeDefined();
    expect(gapIssue!.affectedRows).toBeGreaterThan(0);
    expect(result.metadata.gapsDetected).toBeGreaterThan(0);
  });

  it('sets expected vs actual points metadata', () => {
    const data = [
      makeRow({ timestamp: 0 }),
      makeRow({ timestamp: 60000 }),
      makeRow({ timestamp: 120000 }),
    ];
    const result = scoreCompleteness(data, makeCtx({ expectedInterval: '1m' }));
    expect(result.metadata.expectedPoints).toBeDefined();
    expect(result.metadata.actualPoints).toBe(3);
  });

  it('missing values percentage determines severity', () => {
    // 1 out of 5 cells = 20% → critical
    const data = [makeRow({ open: null })];
    const result = scoreCompleteness(data, makeCtx());
    const issue = result.issues.find(i => i.type === 'missing_values');
    expect(issue!.severity).toBe('critical'); // 20% > 10%
  });

  it('small missing percentage gives info severity', () => {
    // 1 out of 50 cells = 2% → info
    const data = Array.from({ length: 10 }, (_, i) => makeRow({ timestamp: i }));
    data[0].open = null; // 1 missing out of 50 cells = 2%
    const result = scoreCompleteness(data, makeCtx());
    const issue = result.issues.find(i => i.type === 'missing_values');
    expect(issue!.severity).toBe('info');
  });

  it('handles rows with no critical fields at all', () => {
    const data = [{ foo: 'bar' }, { baz: 42 }];
    const result = scoreCompleteness(data, makeCtx());
    // No critical fields present → cellCompleteness = 100
    expect(result.score).toBe(100);
    expect(result.metadata.missingCells).toBe(0);
  });
});

// ── scoreAccuracy ────────────────────────────────────────────────────────────

describe('scoreAccuracy', () => {
  it('returns 100 for empty dataset', () => {
    const result = scoreAccuracy([], makeCtx());
    expect(result.score).toBe(100);
    expect(result.issues.length).toBe(0);
    expect(result.metadata.totalRows).toBe(0);
  });

  it('returns 100 for valid OHLC data', () => {
    const data = [
      makeRow({ open: 100, high: 110, low: 90, close: 105 }),
      makeRow({ open: 50, high: 60, low: 40, close: 55 }),
    ];
    const result = scoreAccuracy(data, makeCtx());
    expect(result.score).toBe(100);
    expect(result.issues.length).toBe(0);
  });

  it('detects high < low', () => {
    const data = [makeRow({ open: 100, high: 80, low: 90, close: 95 })];
    const result = scoreAccuracy(data, makeCtx());
    expect(result.metadata.highLowViolations).toBe(1);
    const issue = result.issues.find(i => i.type === 'ohlc_high_below_low');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('critical'); // 1/1 = 100% > 5%
  });

  it('detects high < open', () => {
    const data = [makeRow({ open: 120, high: 110, low: 90, close: 100 })];
    const result = scoreAccuracy(data, makeCtx());
    expect(result.metadata.highOpenViolations).toBe(1);
  });

  it('detects high < close', () => {
    const data = [makeRow({ open: 100, high: 105, low: 90, close: 110 })];
    const result = scoreAccuracy(data, makeCtx());
    expect(result.metadata.highCloseViolations).toBe(1);
  });

  it('detects low > open', () => {
    const data = [makeRow({ open: 80, high: 110, low: 90, close: 100 })];
    const result = scoreAccuracy(data, makeCtx());
    expect(result.metadata.lowOpenViolations).toBe(1);
  });

  it('detects low > close', () => {
    const data = [makeRow({ open: 100, high: 110, low: 108, close: 95 })];
    const result = scoreAccuracy(data, makeCtx());
    expect(result.metadata.lowCloseViolations).toBe(1);
  });

  it('detects negative prices', () => {
    const data = [makeRow({ open: -5, high: 110, low: 90, close: 100 })];
    const result = scoreAccuracy(data, makeCtx());
    expect(result.metadata.negativePrices).toBe(1);
    const issue = result.issues.find(i => i.type === 'negative_price');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('critical');
  });

  it('detects zero price range (H=L=O=C)', () => {
    const data = Array.from({ length: 10 }, () =>
      makeRow({ open: 100, high: 100, low: 100, close: 100 })
    );
    const result = scoreAccuracy(data, makeCtx());
    expect(result.metadata.zeroRange).toBe(10);
    const issue = result.issues.find(i => i.type === 'zero_price_range');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('combines high-open and high-close into one issue', () => {
    const data = [makeRow({ open: 120, high: 110, low: 90, close: 130 })];
    const result = scoreAccuracy(data, makeCtx());
    const issue = result.issues.find(i => i.type === 'ohlc_high_not_maximum');
    expect(issue).toBeDefined();
    expect(issue!.affectedRows).toBe(2); // highOpen + highClose
  });

  it('handles null fields gracefully', () => {
    const data = [makeRow({ open: null, high: null, low: null, close: null })];
    const result = scoreAccuracy(data, makeCtx());
    // numField returns null for all → no comparisons made
    expect(result.score).toBe(100);
  });

  it('calculates violatedRows correctly', () => {
    const data = [
      makeRow({ open: -1, high: 110, low: 90, close: 100 }), // negative + ok
      makeRow({ open: 100, high: 80, low: 90, close: 100 }), // high < low
      makeRow(), // clean
    ];
    const result = scoreAccuracy(data, makeCtx());
    expect(result.metadata.violatedRows).toBe(2);
  });
});

// ── scoreTimeliness ──────────────────────────────────────────────────────────
// NOTE: scoreTimeliness has a minimal stub implementation (returns 100 for non-empty data, 0 for empty).

describe('scoreTimeliness (stub)', () => {
  it('is declared as a function', () => {
    expect(typeof scoreTimeliness).toBe('function');
  });

  it('returns score=100 for non-empty data', () => {
    const data = [makeRow()];
    const result = scoreTimeliness(data, makeCtx());
    expect(result.dimensionId).toBe('timeliness');
    expect(result.score).toBe(100);
    expect(result.metadata.totalRows).toBe(1);
  });

  it('returns score=0 for empty data', () => {
    const result = scoreTimeliness([], makeCtx());
    expect(result.score).toBe(0);
    expect(result.metadata.totalRows).toBe(0);
  });

  it('handles data without timestamps', () => {
    const data = [{ open: 100, high: 110, low: 90, close: 105, volume: 1000 }];
    const result = scoreTimeliness(data, makeCtx());
    expect(result.score).toBe(100);
  });
});
