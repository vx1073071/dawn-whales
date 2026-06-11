/**
 * Tests for DataCleaningPipeline — JVS-84
 * Tests the real built-in stages and pipeline API.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataCleaningPipeline,
  type RawDataPoint,
  type CleanDataPoint,
  type CleaningContext,
  type CleaningStage,
} from '../../../../electron/engine/data/data-cleaning-pipeline';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(overrides: Partial<RawDataPoint> & { time: number }): RawDataPoint {
  return {
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1000,
    source: 'test',
    ...overrides,
  };
}

function makeCtx(overrides?: Partial<CleaningContext>): CleaningContext {
  return {
    symbol: 'TEST',
    metadata: {},
    ...overrides,
  };
}

/** Create n identical OHLC bars at successive times. */
function identicalBars(n: number, interval = 60_000): RawDataPoint[] {
  const bar = { open: 100, high: 110, low: 90, close: 105, volume: 1000, source: 'test' };
  return Array.from({ length: n }, (_, i) => ({ ...bar, time: i * interval }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Pipeline class API
// ══════════════════════════════════════════════════════════════════════════════

describe('DataCleaningPipeline — class API', () => {
  let p: DataCleaningPipeline;

  beforeEach(() => {
    p = new DataCleaningPipeline();
  });

  it('loads 8 default stages', () => {
    expect(p.getStages().length).toBe(8);
    const ids = p.getStages().map(s => s.id);
    expect(ids).toEqual([
      'negative-filter',
      'duplicate-remover',
      'time-alignment',
      'outlier-removal',
      'ohlc-validator',
      'volume-normalizer',
      'gap-filler',
      'stale-data-detector',
    ]);
  });

  it('all default stages are enabled', () => {
    expect(p.getStages().every(s => s.enabled)).toBe(true);
  });

  it('autoLoadDefaults=false starts with 0 stages', () => {
    expect(new DataCleaningPipeline(false).getStages().length).toBe(0);
  });

  // ── addStage ───────────────────────────────────────────────────────────

  it('addStage appends a new stage', () => {
    const s: CleaningStage = {
      id: 'custom',
      name: 'Custom',
      enabled: true,
      fn: d => d.map(x => ({ ...x, adjusted: false, anomalies: [], qualityScore: 1 })),
    };
    p.addStage(s);
    expect(p.getStages().length).toBe(9);
    expect(p.getStages().at(-1)!.id).toBe('custom');
  });

  it('addStage replaces existing stage by id', () => {
    p.addStage({
      id: 'negative-filter',
      name: 'Replaced',
      enabled: true,
      fn: d => d.map(x => ({ ...x, adjusted: false, anomalies: [], qualityScore: 1 })),
    });
    expect(p.getStages().length).toBe(8);
    expect(p.getStages().find(s => s.id === 'negative-filter')!.name).toBe('Replaced');
  });

  // ── removeStage ────────────────────────────────────────────────────────

  it('removeStage removes and returns true', () => {
    expect(p.removeStage('gap-filler')).toBe(true);
    expect(p.getStages().length).toBe(7);
    expect(p.getStages().map(s => s.id)).not.toContain('gap-filler');
  });

  it('removeStage returns false for unknown id', () => {
    expect(p.removeStage('nope')).toBe(false);
  });

  // ── enableStage ────────────────────────────────────────────────────────

  it('enableStage toggles enabled flag', () => {
    expect(p.enableStage('outlier-removal', false)).toBe(true);
    expect(p.getStages().find(s => s.id === 'outlier-removal')!.enabled).toBe(false);
    expect(p.enableStage('outlier-removal', true)).toBe(true);
    expect(p.getStages().find(s => s.id === 'outlier-removal')!.enabled).toBe(true);
  });

  it('enableStage returns false for unknown id', () => {
    expect(p.enableStage('nope', false)).toBe(false);
  });

  // ── reset ──────────────────────────────────────────────────────────────

  it('reset restores defaults and clears report', () => {
    p.removeStage('gap-filler');
    p.clean([makeRaw({ time: 1 })], makeCtx());
    expect(p.getReport()).not.toBeNull();
    p.reset();
    expect(p.getStages().length).toBe(8);
    expect(p.getReport()).toBeNull();
  });

  // ── getReport ──────────────────────────────────────────────────────────

  it('getReport is null before first clean', () => {
    expect(p.getReport()).toBeNull();
  });

  it('getReport returns report after clean', () => {
    p.clean([makeRaw({ time: 1 })], makeCtx());
    const r = p.getReport()!;
    expect(r.totalPoints).toBe(1);
    expect(r.cleanedPoints).toBe(1);
    expect(typeof r.qualityScore).toBe('number');
    expect(typeof r.durationMs).toBe('number');
  });

  // ── convenience methods ────────────────────────────────────────────────

  it('cleanData returns only data array', () => {
    const d = p.cleanData([makeRaw({ time: 1 })], makeCtx());
    expect(Array.isArray(d)).toBe(true);
    expect(d.length).toBe(1);
  });

  it('cleanReport returns only report', () => {
    const r = p.cleanReport([makeRaw({ time: 1 })], makeCtx());
    expect(r).toHaveProperty('totalPoints');
    expect(r).toHaveProperty('qualityScore');
  });

  // ── describe ───────────────────────────────────────────────────────────

  it('describe shows stage count and ids', () => {
    const d = p.describe();
    expect(d).toContain('DataCleaningPipeline (8 stages)');
    expect(d).toContain('negative-filter');
    expect(d).toContain('stale-data-detector');
  });

  it('describe includes last report after clean', () => {
    p.clean([makeRaw({ time: 1 })], makeCtx());
    expect(p.describe()).toContain('Last Report');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Empty / trivial inputs
// ══════════════════════════════════════════════════════════════════════════════

describe('DataCleaningPipeline — empty and trivial inputs', () => {
  let p: DataCleaningPipeline;

  beforeEach(() => {
    p = new DataCleaningPipeline();
  });

  it('empty input → empty output, quality=0', () => {
    const { data, report } = p.clean([], makeCtx());
    expect(data).toEqual([]);
    expect(report.totalPoints).toBe(0);
    expect(report.cleanedPoints).toBe(0);
    expect(report.qualityScore).toBe(0);
    expect(report.removedPoints).toBe(0);
  });

  it('single valid point passes through', () => {
    // Use time=0 so time-alignment doesn't snap a non-aligned value
    const { data, report } = p.clean([makeRaw({ time: 0 })], makeCtx());
    expect(data.length).toBe(1);
    expect(report.cleanedPoints).toBe(1);
  });

  it('disabled stages are skipped (data passes unchanged)', () => {
    const empty = new DataCleaningPipeline(false);
    for (const s of p.getStages()) empty.addStage({ ...s, enabled: false });
    const { data } = empty.clean([makeRaw({ time: 1 }), makeRaw({ time: 2 })], makeCtx());
    expect(data.length).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Built-in stage: negative-filter
// ══════════════════════════════════════════════════════════════════════════════

describe('Built-in stage: negative-filter', () => {
  let p: DataCleaningPipeline;

  beforeEach(() => {
    p = new DataCleaningPipeline(false);
    // Only load negative-filter
    const full = new DataCleaningPipeline();
    p.addStage(full.getStages().find(s => s.id === 'negative-filter')!);
  });

  it('removes point with negative open', () => {
    const { data } = p.clean([makeRaw({ time: 1, open: -5 })], makeCtx());
    expect(data.length).toBe(0);
  });

  it('removes point with negative close', () => {
    const { data } = p.clean([makeRaw({ time: 1, close: -1 })], makeCtx());
    expect(data.length).toBe(0);
  });

  it('removes point with negative volume', () => {
    const { data } = p.clean([makeRaw({ time: 1, volume: -100 })], makeCtx());
    expect(data.length).toBe(0);
  });

  it('removes point with negative high', () => {
    const { data } = p.clean([makeRaw({ time: 1, high: -10 })], makeCtx());
    expect(data.length).toBe(0);
  });

  it('removes point with negative low', () => {
    const { data } = p.clean([makeRaw({ time: 1, low: -1 })], makeCtx());
    expect(data.length).toBe(0);
  });

  it('keeps valid points', () => {
    const { data } = p.clean([makeRaw({ time: 1 }), makeRaw({ time: 2 })], makeCtx());
    expect(data.length).toBe(2);
  });

  it('mixed valid and invalid', () => {
    const { data } = p.clean([
      makeRaw({ time: 1 }),
      makeRaw({ time: 2, open: -1 }),
      makeRaw({ time: 3 }),
    ], makeCtx());
    expect(data.length).toBe(2);
    expect(data.map(d => d.time)).toEqual([1, 3]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Built-in stage: duplicate-remover
// ══════════════════════════════════════════════════════════════════════════════

describe('Built-in stage: duplicate-remover', () => {
  let p: DataCleaningPipeline;

  beforeEach(() => {
    p = new DataCleaningPipeline(false);
    p.addStage(new DataCleaningPipeline().getStages().find(s => s.id === 'duplicate-remover')!);
  });

  it('keeps higher-volume point for duplicate timestamps', () => {
    const { data } = p.clean([
      makeRaw({ time: 100, volume: 500 }),
      makeRaw({ time: 100, volume: 1000 }),
      makeRaw({ time: 200, volume: 300 }),
    ], makeCtx());
    expect(data.length).toBe(2);
    expect(data.find(d => d.time === 100)!.volume).toBe(1000);
  });

  it('keeps first-seen when volumes are equal', () => {
    const { data } = p.clean([
      makeRaw({ time: 1, volume: 100, close: 50 }),
      makeRaw({ time: 1, volume: 100, close: 60 }),
    ], makeCtx());
    expect(data.length).toBe(1);
    expect(data[0].close).toBe(50);
  });

  it('no duplicates → all kept', () => {
    const { data } = p.clean([makeRaw({ time: 1 }), makeRaw({ time: 2 })], makeCtx());
    expect(data.length).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Built-in stage: time-alignment
// ══════════════════════════════════════════════════════════════════════════════

describe('Built-in stage: time-alignment', () => {
  let p: DataCleaningPipeline;
  const interval = 60_000; // 1 min

  beforeEach(() => {
    p = new DataCleaningPipeline(false);
    p.addStage(new DataCleaningPipeline().getStages().find(s => s.id === 'time-alignment')!);
  });

  it('snaps near-boundary timestamp (< 10% drift)', () => {
    // 60001 is 1ms off from 60000 → drift=1ms < 6000ms (10% of 60000)
    const { data } = p.clean([makeRaw({ time: 60001 })], makeCtx({ metadata: { barIntervalMs: interval } }));
    expect(data[0].time).toBe(60000);
    expect(data[0].adjusted).toBe(true);
    expect(data[0].anomalies.some(a => a.startsWith('time-aligned'))).toBe(true);
  });

  it('flags far-from-boundary timestamp (>= 10% drift)', () => {
    // 60000 + 7000 = 67000, drift=7000 > 6000 (10% of 60000)
    const { data } = p.clean([makeRaw({ time: 67000 })], makeCtx({ metadata: { barIntervalMs: interval } }));
    expect(data[0].time).toBe(67000); // not snapped
    expect(data[0].anomalies.some(a => a.startsWith('time-misaligned'))).toBe(true);
  });

  it('on-boundary timestamp → no change', () => {
    const { data } = p.clean([makeRaw({ time: 120000 })], makeCtx({ metadata: { barIntervalMs: interval } }));
    expect(data[0].time).toBe(120000);
    expect(data[0].adjusted).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Built-in stage: outlier-removal
// ══════════════════════════════════════════════════════════════════════════════

describe('Built-in stage: outlier-removal', () => {
  let p: DataCleaningPipeline;

  beforeEach(() => {
    p = new DataCleaningPipeline(false);
    p.addStage(new DataCleaningPipeline().getStages().find(s => s.id === 'outlier-removal')!);
  });

  it('keeps all points when < 3 points', () => {
    const { data } = p.clean([makeRaw({ time: 1 }), makeRaw({ time: 2 })], makeCtx());
    expect(data.length).toBe(2);
  });

  it('keeps all points when all changes are identical', () => {
    // close values: 10, 20, 30, 40 → changes: 10, 10, 10 → stddev=0
    const raw = [10, 20, 30, 40].map((c, i) => makeRaw({ time: i, close: c }));
    const { data } = p.clean(raw, makeCtx());
    expect(data.length).toBe(4);
  });

  it('removes outlier exceeding 3 stddev', () => {
    // 10 normal bars (close=100+i) + 1 outlier (close=500)
    const raw = Array.from({ length: 10 }, (_, i) => makeRaw({ time: i, close: 100 + i }));
    raw.push(makeRaw({ time: 10, close: 500 }));
    const { data } = p.clean(raw, makeCtx());
    expect(data.find(d => d.time === 10 && d.close === 500)).toBeUndefined();
    expect(data.length).toBeLessThanOrEqual(11);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Built-in stage: ohlc-validator
// ══════════════════════════════════════════════════════════════════════════════

describe('Built-in stage: ohlc-validator', () => {
  let p: DataCleaningPipeline;

  beforeEach(() => {
    p = new DataCleaningPipeline(false);
    p.addStage(new DataCleaningPipeline().getStages().find(s => s.id === 'ohlc-validator')!);
  });

  it('fixes high < max(open, close)', () => {
    const { data } = p.clean(
      [makeRaw({ time: 1, open: 100, close: 120, high: 110, low: 80 })],
      makeCtx(),
    );
    expect(data[0].high).toBe(120);
    expect(data[0].adjusted).toBe(true);
    expect(data[0].anomalies.some(a => a.startsWith('high<expected'))).toBe(true);
  });

  it('fixes low > min(open, close)', () => {
    const { data } = p.clean(
      [makeRaw({ time: 1, open: 100, close: 80, high: 120, low: 90 })],
      makeCtx(),
    );
    expect(data[0].low).toBe(80);
    expect(data[0].adjusted).toBe(true);
    expect(data[0].anomalies.some(a => a.startsWith('low>expected'))).toBe(true);
  });

  it('valid data passes unchanged', () => {
    const { data } = p.clean(
      [makeRaw({ time: 1, open: 100, high: 120, low: 80, close: 110 })],
      makeCtx(),
    );
    expect(data[0].adjusted).toBe(false);
    expect(data[0].anomalies.length).toBe(0);
    expect(data[0].qualityScore).toBe(1);
  });

  it('adjustment reduces qualityScore', () => {
    const { data } = p.clean(
      [makeRaw({ time: 1, open: 100, close: 120, high: 90, low: 80 })],
      makeCtx(),
    );
    expect(data[0].qualityScore).toBeLessThan(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Built-in stage: volume-normalizer
// ══════════════════════════════════════════════════════════════════════════════

describe('Built-in stage: volume-normalizer', () => {
  let p: DataCleaningPipeline;

  beforeEach(() => {
    p = new DataCleaningPipeline(false);
    p.addStage(new DataCleaningPipeline().getStages().find(s => s.id === 'volume-normalizer')!);
  });

  it('flags zero volume', () => {
    const { data } = p.clean([makeRaw({ time: 1, volume: 0 })], makeCtx());
    expect(data[0].anomalies).toContain('zero-volume');
    expect(data[0].qualityScore).toBeLessThan(1);
  });

  it('flags volume spike > 5x average', () => {
    const raw = [
      makeRaw({ time: 1, volume: 100 }),
      makeRaw({ time: 2, volume: 100 }),
      makeRaw({ time: 3, volume: 100 }),
      makeRaw({ time: 4, volume: 10000 }), // 32.3x avg of [100,100,100,10000]=2575 → 10000/2575≈3.9x
    ];
    const { data } = p.clean(raw, makeCtx());
    // avg = (100+100+100+10000)/4 = 2575, spike threshold = 2575*5=12875
    // 10000 < 12875 → no spike. Use more extreme value:
    const raw2 = [
      makeRaw({ time: 1, volume: 100 }),
      makeRaw({ time: 2, volume: 100 }),
      makeRaw({ time: 3, volume: 100 }),
      makeRaw({ time: 4, volume: 50000 }), // avg=12575, 50000/12575≈3.98x still < 5x
    ];
    // Need: volume > 5 * avg → volume > 5*(sum/n) → n*volume > 5*sum
    // With 3 normals at 100: sum=300, need v > 5*(300+v)/4 → 4v > 1500+5v → -v > 1500 → impossible with 4 points
    // Use more normal points: 10 normals at 100, 1 spike at 10000
    // avg = (1000+10000)/11 ≈ 909, 10000/909 ≈ 11x > 5x ✓
    const manyNormals = Array.from({ length: 10 }, (_, i) => makeRaw({ time: i, volume: 100 }));
    manyNormals.push(makeRaw({ time: 10, volume: 10000 }));
    const { data: data2 } = p.clean(manyNormals, makeCtx());
    const spike = data2.find(d => d.time === 10)!;
    expect(spike.anomalies.some(a => a.startsWith('volume-spike'))).toBe(true);
  });

  it('fixes negative volume to 0', () => {
    const { data } = p.clean([makeRaw({ time: 1, volume: -500 })], makeCtx());
    expect(data[0].volume).toBe(0);
    expect(data[0].adjusted).toBe(true);
    expect(data[0].anomalies.some(a => a.startsWith('negative-volume'))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Built-in stage: gap-filler
// ══════════════════════════════════════════════════════════════════════════════

describe('Built-in stage: gap-filler', () => {
  let p: DataCleaningPipeline;
  const interval = 60_000;

  beforeEach(() => {
    p = new DataCleaningPipeline(false);
    p.addStage(new DataCleaningPipeline().getStages().find(s => s.id === 'gap-filler')!);
  });

  it('interpolates missing bars for large gap', () => {
    // 60000 → 240000: gap=180000, 180000/60000=3, missing=3-1=2
    const { data } = p.clean(
      [makeRaw({ time: 60000, close: 100 }), makeRaw({ time: 240000, open: 110 })],
      makeCtx({ metadata: { barIntervalMs: interval } }),
    );
    expect(data.length).toBe(4); // 2 original + 2 interpolated
    expect(data[1].source).toBe('interpolated');
    expect(data[1].adjusted).toBe(true);
    expect(data[1].anomalies).toContain('interpolated-gap-fill');
    expect(data[1].qualityScore).toBe(0.5);
    expect(data[2].source).toBe('interpolated');
  });

  it('does not fill when gap <= 1.5x interval', () => {
    // gap = 90000 - 60000 = 30000, threshold = 60000*1.5 = 90000. 30000 <= 90000 → no fill
    const { data } = p.clean(
      [makeRaw({ time: 60000 }), makeRaw({ time: 90000 })],
      makeCtx({ metadata: { barIntervalMs: interval } }),
    );
    expect(data.length).toBe(2);
  });

  it('does not fill for single point', () => {
    const { data } = p.clean([makeRaw({ time: 60000 })], makeCtx());
    expect(data.length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Built-in stage: stale-data-detector
// ══════════════════════════════════════════════════════════════════════════════

describe('Built-in stage: stale-data-detector', () => {
  let p: DataCleaningPipeline;

  beforeEach(() => {
    p = new DataCleaningPipeline(false);
    p.addStage(new DataCleaningPipeline().getStages().find(s => s.id === 'stale-data-detector')!);
  });

  it('flags consecutive identical bars beyond threshold', () => {
    const raw = identicalBars(8, 60_000); // default threshold=5
    const { data } = p.clean(raw, makeCtx());
    // Bars at index 5,6,7 (6th,7th,8th) exceed threshold of 5 consecutive
    const stale = data.filter(d => d.anomalies.some(a => a.startsWith('stale-data')));
    expect(stale.length).toBe(3);
  });

  it('does not flag when bars differ', () => {
    const raw = Array.from({ length: 10 }, (_, i) =>
      makeRaw({ time: i * 60_000, close: 100 + i }),
    );
    const { data } = p.clean(raw, makeCtx());
    expect(data.every(d => d.anomalies.every(a => !a.startsWith('stale-data')))).toBe(true);
  });

  it('respects custom maxConsecutiveIdentical from context', () => {
    const raw = identicalBars(5, 60_000);
    const { data } = p.clean(raw, makeCtx({ metadata: { maxConsecutiveIdentical: 2 } }));
    // Threshold=2: bars at index 2,3,4 exceed → 3 flagged
    const stale = data.filter(d => d.anomalies.some(a => a.startsWith('stale-data')));
    expect(stale.length).toBe(3);
  });

  it('stale penalty increases with consecutive count', () => {
    const raw = identicalBars(10, 60_000);
    const { data } = p.clean(raw, makeCtx());
    const stale = data.filter(d => d.anomalies.some(a => a.startsWith('stale-data')));
    // Later stale bars should have lower qualityScore
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.at(-1)!.qualityScore).toBeLessThanOrEqual(stale[0].qualityScore);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Full pipeline integration
// ══════════════════════════════════════════════════════════════════════════════

describe('Full pipeline integration', () => {
  let p: DataCleaningPipeline;

  beforeEach(() => {
    p = new DataCleaningPipeline();
  });

  it('processes realistic multi-bar data through all 8 stages', () => {
    const raw = Array.from({ length: 20 }, (_, i) =>
      makeRaw({
        time: i * 300_000,
        open: 100 + Math.sin(i) * 5,
        high: 110 + Math.sin(i) * 5,
        low: 90 + Math.sin(i) * 5,
        close: 105 + Math.sin(i) * 5,
        volume: 1000 + i * 10,
      }),
    );
    const { data, report } = p.clean(raw, makeCtx());
    expect(data.length).toBeGreaterThan(0);
    expect(report.totalPoints).toBe(20);
    expect(report.qualityScore).toBeGreaterThan(0);
    expect(report.qualityScore).toBeLessThanOrEqual(1);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('handles stage that throws without losing data', () => {
    const bad = new DataCleaningPipeline(false);
    bad.addStage({
      id: 'bad',
      name: 'Bad',
      enabled: true,
      fn: () => { throw new Error('boom'); },
    });
    bad.addStage({
      id: 'good',
      name: 'Good',
      enabled: true,
      fn: d => d.map(x => ({ ...x, adjusted: false, anomalies: [], qualityScore: 1 })),
    });
    const { data } = bad.clean([makeRaw({ time: 1 })], makeCtx());
    expect(data.length).toBe(1);
  });

  it('report.adjustments collects anomaly categories', () => {
    const raw = [
      makeRaw({ time: 1, volume: 0 }),
      makeRaw({ time: 2, volume: 1000 }),
    ];
    const { report } = p.clean(raw, makeCtx());
    expect(Array.isArray(report.adjustments)).toBe(true);
  });

  it('all output points are CleanDataPoint (have required fields)', () => {
    const raw = [makeRaw({ time: 1 }), makeRaw({ time: 2 })];
    const { data } = p.clean(raw, makeCtx());
    for (const d of data) {
      expect(d).toHaveProperty('adjusted');
      expect(d).toHaveProperty('anomalies');
      expect(d).toHaveProperty('qualityScore');
      expect(typeof d.adjusted).toBe('boolean');
      expect(Array.isArray(d.anomalies)).toBe(true);
      expect(typeof d.qualityScore).toBe('number');
    }
  });

  it('removedPoints can be > 0 when negative-filter fires', () => {
    const raw = [
      makeRaw({ time: 1 }),
      makeRaw({ time: 2, open: -10 }),
      makeRaw({ time: 3 }),
    ];
    const { report } = p.clean(raw, makeCtx());
    expect(report.removedPoints).toBe(1);
    expect(report.cleanedPoints).toBe(2);
  });

  it('qualityScore is rounded to 4 decimal places', () => {
    const { report } = p.clean([makeRaw({ time: 1 })], makeCtx());
    const s = report.qualityScore.toString();
    const dec = s.includes('.') ? s.split('.')[1].length : 0;
    expect(dec).toBeLessThanOrEqual(4);
  });
});
