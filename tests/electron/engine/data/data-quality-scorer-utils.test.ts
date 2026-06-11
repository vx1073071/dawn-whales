/**
 * Tests for data-quality-scorer-utils — pure helper functions.
 */
import { describe, it, expect } from 'vitest';
import {
  intervalToMs,
  numField,
  extractTimestamp,
  clamp,
  scoreToGrade,
  buildSummary,
  buildRecommendations,
} from '../../../../electron/engine/data/data-quality-scorer-utils';
import type { DimensionResult, QualityIssue } from '../../../../electron/engine/data/data-quality-scorer-types';

// ── intervalToMs ─────────────────────────────────────────────────────────────

describe('intervalToMs', () => {
  it('converts seconds', () => {
    expect(intervalToMs('30s')).toBe(30_000);
    expect(intervalToMs('1s')).toBe(1_000);
  });

  it('converts minutes', () => {
    expect(intervalToMs('1m')).toBe(60_000);
    expect(intervalToMs('5m')).toBe(300_000);
    expect(intervalToMs('15m')).toBe(900_000);
  });

  it('converts hours', () => {
    expect(intervalToMs('1h')).toBe(3_600_000);
    expect(intervalToMs('4h')).toBe(14_400_000);
  });

  it('converts days', () => {
    expect(intervalToMs('1d')).toBe(86_400_000);
  });

  it('converts weeks', () => {
    expect(intervalToMs('1w')).toBe(604_800_000);
  });

  it('returns default 60000 for invalid format', () => {
    expect(intervalToMs('abc')).toBe(60_000);
    expect(intervalToMs('')).toBe(60_000);
    expect(intervalToMs('10x')).toBe(60_000);
  });
});

// ── numField ─────────────────────────────────────────────────────────────────

describe('numField', () => {
  it('returns number for valid numeric field', () => {
    expect(numField({ price: 42 }, 'price')).toBe(42);
    expect(numField({ price: '42.5' }, 'price')).toBe(42.5);
    expect(numField({ price: 0 }, 'price')).toBe(0);
  });

  it('returns null for missing field', () => {
    expect(numField({}, 'price')).toBeNull();
    expect(numField(null, 'price')).toBeNull();
    expect(numField(undefined, 'price')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(numField({ price: '' }, 'price')).toBeNull();
  });

  it('returns null for NaN/Infinity', () => {
    expect(numField({ price: NaN }, 'price')).toBeNull();
    expect(numField({ price: Infinity }, 'price')).toBeNull();
    expect(numField({ price: 'abc' }, 'price')).toBeNull();
  });

  it('handles null value', () => {
    expect(numField({ price: null }, 'price')).toBeNull();
  });
});

// ── extractTimestamp ─────────────────────────────────────────────────────────

describe('extractTimestamp', () => {
  it('extracts from "timestamp" field (ms)', () => {
    expect(extractTimestamp({ timestamp: 1700000000000 })).toBe(1700000000000);
  });

  it('extracts from "time" field (seconds → ms)', () => {
    // Value < 1e12 is treated as seconds
    expect(extractTimestamp({ time: 1700000000 })).toBe(1700000000000);
  });

  it('extracts from "date" field (string)', () => {
    const result = extractTimestamp({ date: '2024-01-01T00:00:00Z' });
    expect(result).toBe(new Date('2024-01-01T00:00:00Z').getTime());
  });

  it('extracts from "datetime" field', () => {
    const result = extractTimestamp({ datetime: '2024-06-15T12:00:00Z' });
    expect(result).toBeGreaterThan(0);
  });

  it('extracts from "t" field', () => {
    expect(extractTimestamp({ t: 1700000000000 })).toBe(1700000000000);
  });

  it('returns null when no timestamp field found', () => {
    expect(extractTimestamp({ price: 100 })).toBeNull();
    expect(extractTimestamp({})).toBeNull();
    expect(extractTimestamp(null)).toBeNull();
  });

  it('handles Date object', () => {
    const d = new Date('2024-01-01T00:00:00Z');
    const result = extractTimestamp({ timestamp: d });
    expect(result).toBe(d.getTime());
  });

  it('returns null for invalid date string', () => {
    expect(extractTimestamp({ timestamp: 'not-a-date' })).toBeNull();
  });
});

// ── clamp ────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles equal min/max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

// ── scoreToGrade ─────────────────────────────────────────────────────────────

describe('scoreToGrade', () => {
  it('returns A for >= 90', () => {
    expect(scoreToGrade(90)).toBe('A');
    expect(scoreToGrade(100)).toBe('A');
    expect(scoreToGrade(95)).toBe('A');
  });

  it('returns B for >= 75', () => {
    expect(scoreToGrade(75)).toBe('B');
    expect(scoreToGrade(89)).toBe('B');
  });

  it('returns C for >= 60', () => {
    expect(scoreToGrade(60)).toBe('C');
    expect(scoreToGrade(74)).toBe('C');
  });

  it('returns D for >= 40', () => {
    expect(scoreToGrade(40)).toBe('D');
    expect(scoreToGrade(59)).toBe('D');
  });

  it('returns F for < 40', () => {
    expect(scoreToGrade(0)).toBe('F');
    expect(scoreToGrade(39)).toBe('F');
  });
});

// ── buildSummary ─────────────────────────────────────────────────────────────

describe('buildSummary', () => {
  function makeDim(id: string, score: number, issues: QualityIssue[] = []): DimensionResult {
    return {
      dimensionId: id,
      score,
      weight: 0.5,
      weightedScore: score * 0.5,
      issues,
      metadata: {},
    };
  }

  it('includes grade and score', () => {
    const dims = [makeDim('completeness', 80), makeDim('accuracy', 60)];
    const summary = buildSummary('B', 70, dims, 0);
    expect(summary).toContain('grade: B');
    expect(summary).toContain('70.0/100');
  });

  it('identifies strongest and weakest dimensions', () => {
    const dims = [makeDim('completeness', 90), makeDim('accuracy', 50)];
    const summary = buildSummary('B', 70, dims, 0);
    expect(summary).toContain('Strongest dimension: completeness');
    expect(summary).toContain('Weakest dimension: accuracy');
  });

  it('reports no issues when totalIssues=0', () => {
    const dims = [makeDim('a', 80)];
    const summary = buildSummary('A', 80, dims, 0);
    expect(summary).toContain('No quality issues detected');
  });

  it('reports issue counts with critical/warning breakdown', () => {
    const issues: QualityIssue[] = [
      { type: 'a', severity: 'critical', message: 'crit', affectedRows: 1, percentage: 1 },
      { type: 'b', severity: 'warning', message: 'warn', affectedRows: 2, percentage: 2 },
      { type: 'c', severity: 'warning', message: 'warn2', affectedRows: 3, percentage: 3 },
    ];
    const dims = [makeDim('completeness', 50, issues)];
    const summary = buildSummary('D', 50, dims, 3);
    expect(summary).toContain('3 issue(s) found');
    expect(summary).toContain('1 critical');
    expect(summary).toContain('2 warning');
  });

  it('does not duplicate weakest when only one dimension', () => {
    const dims = [makeDim('only', 80)];
    const summary = buildSummary('A', 80, dims, 0);
    expect(summary).toContain('Strongest dimension: only');
    expect(summary).not.toContain('Weakest dimension');
  });
});

// ── buildRecommendations ─────────────────────────────────────────────────────

describe('buildRecommendations', () => {
  function makeDim(id: string, score: number, issues: QualityIssue[]): DimensionResult {
    return {
      dimensionId: id,
      score,
      weight: 0,
      weightedScore: 0,
      issues,
      metadata: {},
    };
  }

  it('skips dimensions with score >= 90', () => {
    const dims = [makeDim('healthy', 95, [{ type: 'x', severity: 'info', message: '', affectedRows: 0, percentage: 0, suggestion: 'should not appear' }])];
    const recs = buildRecommendations(dims);
    expect(recs.length).toBe(0);
  });

  it('includes suggestion from issue', () => {
    const dims = [makeDim('completeness', 60, [
      { type: 'missing', severity: 'warning', message: 'missing data', affectedRows: 5, percentage: 10, suggestion: 'Fill missing values' },
    ])];
    const recs = buildRecommendations(dims);
    expect(recs.length).toBe(1);
    expect(recs[0]).toContain('[completeness]');
    expect(recs[0]).toContain('Fill missing values');
  });

  it('generates fallback recommendation when no suggestions', () => {
    const dims = [makeDim('accuracy', 30, [
      { type: 'bad', severity: 'critical', message: 'ohlc violation', affectedRows: 10, percentage: 20 },
    ])];
    const recs = buildRecommendations(dims);
    expect(recs.length).toBe(1);
    expect(recs[0]).toContain('Critical');
    expect(recs[0]).toContain('immediate investigation');
  });

  it('generates "below acceptable" fallback for score 40-74', () => {
    const dims = [makeDim('timeliness', 55, [
      { type: 'stale', severity: 'warning', message: 'stale data', affectedRows: 3, percentage: 5 },
    ])];
    const recs = buildRecommendations(dims);
    expect(recs.length).toBe(1);
    expect(recs[0]).toContain('Below acceptable');
  });

  it('handles multiple dimensions', () => {
    const dims = [
      makeDim('a', 92, []), // skipped
      makeDim('b', 50, [{ type: 'x', severity: 'warning', message: '', affectedRows: 1, percentage: 1, suggestion: 'fix b' }]),
      makeDim('c', 20, [{ type: 'y', severity: 'critical', message: '', affectedRows: 5, percentage: 50 }]),
    ];
    const recs = buildRecommendations(dims);
    expect(recs.length).toBe(2);
    expect(recs[0]).toContain('[b]');
    expect(recs[1]).toContain('[c]');
  });

  it('handles empty dimensions array', () => {
    expect(buildRecommendations([])).toEqual([]);
  });
});
