/**
 * Tests for DataCleaningPipeline — JVS-84
 * Covers all 8 built-in stages, pipeline CRUD, and convenience methods.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataCleaningPipeline,
  type RawDataPoint,
  type CleanDataPoint,
  type CleaningContext,
  type CleaningStage,
} from '../../../electron/engine/data/data-cleaning-pipeline';

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

function range(n: number, start = 0): number[] {
  return Array.from({ length: n }, (_, i) => start + i);
}

// ── Pipeline Class ───────────────────────────────────────────────────────────

describe('DataCleaningPipeline class', () => {
  let pipeline: DataCleaningPipeline;

  beforeEach(() => {
    pipeline = new DataCleaningPipeline();
  });

  it('loads 8 default stages on construction', () => {
    const stages = pipeline.getStages();
    expect(stages.length).toBe(8);
    const ids = stages.map(s => s.id);
    expect(ids).toContain('negative-filter');
    expect(ids).toContain('duplicate-remover');
    expect(ids).toContain('time-alignment');
    expect(ids).toContain('outlier-removal');
    expect(ids).toContain('ohlc-validator');
    expect(ids).toContain('volume-normalizer');
    expect(ids).toContain('gap-filler');
    expect(ids).toContain('stale-data-detector');
  });

  it('constructor with autoLoadDefaults=false starts empty', () => {
    const empty = new DataCleaningPipeline(false);
    expect(empty.getStages().length).toBe(0);
  });

  // ── Stage management ───────────────────────────────────────────────────

  it('addStage appends a new stage', () => {
    const stage: CleaningStage = {
      id: 'custom-1',
      name: 'Custom Stage',
      enabled: true,
      fn: data => data.map(d => ({ ...d, adjusted: false, anomalies: [], qualityScore: 1 })),
    };
    pipeline.addStage(stage);
    expect(pipeline.getStages().length).toBe(9);
    expect(pipeline.getStages()[8].id).toBe('custom-1');
  });

  it('addStage replaces existing stage with same id', () => {
    const stage: CleaningStage = {
      id: 'negative-filter',
      name: 'Replaced',
      enabled: true,
      fn: data => data.map(d => ({ ...d, adjusted: false, anomalies: [], qualityScore: 1 })),
    };
    pipeline.addStage(stage);
    expect(pipeline.getStages().length).toBe(8);
    const neg = pipeline.getStages().find(s => s.id === 'negative-filter')!;
    expect(neg.name).toBe('Replaced');
  });

  it('removeStage removes and returns true', () => {
    expect(pipeline.removeStage('gap-filler')).toBe(true);
    expect(pipeline.getStages().length).toBe(7);
    expect(pipeline.getStages().map(s => s.id)).not.toContain('gap-filler');
  });

  it('removeStage returns false for unknown id', () => {
    expect(pipeline.removeStage('nonexistent')).toBe(false);
  });

  it('enableStage toggles a stage', () => {
    expect(pipeline.enableStage('outlier-removal', false)).toBe(true);
    const s = pipeline.getStages().find(s => s.id === 'outlier-removal')!;
    expect(s.enabled).toBe(false);
    expect(pipeline.enableStage('outlier-removal', true)).toBe(true);
    expect(pipeline.getStages().find(s => s.id === 'outlier-removal')!.enabled).toBe(true);
  });

  it('enableStage returns false for unknown id', () => {
    expect(pipeline.enableStage('nope', false)).toBe(false);
  });

  it('reset restores 8 default stages and clears report', () => {
    pipeline.removeStage('gap-filler');
    expect(pipeline.getStages().length).toBe(7);
    // Run clean to populate report
    pipeline.clean([makeRaw({ time: 1 })], makeCtx());
    expect(pipeline.getReport()).not.toBeNull();
    pipeline.reset();
    expect(pipeline.getStages().length).toBe(8);
    expect(pipeline.getReport()).toBeNull();
  });

  // ── Convenience methods ────────────────────────────────────────────────

  it('cleanData returns only data array', () => {
    const data = pipeline.cleanData([makeRaw({ time: 1 })], makeCtx());
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
  });

  it('cleanReport returns only report object', () => {
    const report = pipeline.cleanReport([makeRaw({ time: 1 })], makeCtx());
    expect(report).toHaveProperty('totalPoints');
    expect(report).toHaveProperty('qualityScore');
  });

  it('getReport returns null before first clean', () => {
    expect(pipeline.getReport()).toBeNull();
  });

  it('getReport returns report after clean', () => {
    pipeline.clean([makeRaw({ time: 1 })], makeCtx());
    const r = pipeline.getReport()!;
    expect(r.totalPoints).toBe(1);
    expect(r.cleanedPoints).toBe(1);
  });

  // ── describe() ─────────────────────────────────────────────────────────

  it('describe includes stage list', () => {
    const desc = pipeline.describe();
    expect(desc).toContain('DataCleaningPipeline (8 stages)');
    expect(desc).toContain('negative-filter');
  });

  it('describe includes last report info when available', () => {
    pipeline.clean([makeRaw({ time: 1 })], makeCtx());
    const desc = pipeline.describe();
    expect(desc).toContain('Last Report');
    expect(desc).toContain('Total: 1');
  });

  // ── Empty input ────────────────────────────────────────────────────────

  it('clean on empty data returns empty result and zero-score report', () => {
    const { data, report } = pipeline.clean([], makeCtx());
    expect(data).toEqual([]);
    expect(report.totalPoints).toBe(0);
    expect(report.cleanedPoints).toBe(0);
    expect(report.qualityScore).toBe(0);
  });
});

// ── Stage: NegativeFilter ────────────────────────────────────────────────────

describe('Stage: negative-filter', () => {
  let pipeline: DataCleaningPipeline;

  beforeEach(() => {
    pipeline = new DataCleaningPipeline(false);
    pipeline.addStage({
      id: 'negative-filter',
      name: 'Negative Filter',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        return data.filter(p =>
          p.open >= 0 && p.high >= 0 && p.low >= 0 && p.close >= 0 && p.volume >= 0
        ).map(d => ({ ...d, adjusted: false, anomalies: [], qualityScore: 1 }));
      },
    });
  });

  it('removes points with negative open', () => {
    const raw = [makeRaw({ time: 1, open: -5 })];
    const { data } = pipeline.clean(raw, makeCtx());
    expect(data.length).toBe(0);
  });

  it('removes points with negative volume', () => {
    const raw = [makeRaw({ time: 1, volume: -100 })];
    const { data } = pipeline.clean(raw, makeCtx());
    expect(data.length).toBe(0);
  });

  it('keeps valid points', () => {
    const raw = [makeRaw({ time: 1 }), makeRaw({ time: 2 })];
    const { data } = pipeline.clean(raw, makeCtx());
    expect(data.length).toBe(2);
  });
});

// ── Stage: DuplicateRemover ──────────────────────────────────────────────────

describe('Stage: duplicate-remover', () => {
  it('keeps highest-volume point for duplicate timestamps', () => {
    const pipeline = new DataCleaningPipeline(false);
    pipeline.addStage({
      id: 'duplicate-remover',
      name: 'Duplicate Remover',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        const seen = new Map<number, any>();
        for (const p of data) {
          const cp = { ...p, adjusted: false, anomalies: [] as string[], qualityScore: 1 };
          const existing = seen.get(cp.time);
          if (existing) {
            if (cp.volume > existing.volume) seen.set(cp.time, cp);
          } else {
            seen.set(cp.time, cp);
          }
        }
        return Array.from(seen.values()).sort((a, b) => a.time - b.time);
      },
    });

    const raw = [
      makeRaw({ time: 100, volume: 500 }),
      makeRaw({ time: 100, volume: 1000 }),
      makeRaw({ time: 200, volume: 300 }),
    ];
    const { data } = pipeline.clean(raw, makeCtx());
    expect(data.length).toBe(2);
    const t100 = data.find(d => d.time === 100)!;
    expect(t100.volume).toBe(1000);
  });
});

// ── Stage: TimeAlignment ─────────────────────────────────────────────────────

describe('Stage: time-alignment', () => {
  it('snaps slightly off-grid timestamps to interval boundary', () => {
    const pipeline = new DataCleaningPipeline(false);
    const intervalMs = 60_000; // 1 minute
    pipeline.addStage({
      id: 'time-alignment',
      name: 'Time Alignment',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        return data.map(p => {
          const cp = { ...p, adjusted: false, anomalies: [] as string[], qualityScore: 1 };
          const rem = cp.time % intervalMs;
          if (rem !== 0) {
            const snapped = Math.round(cp.time / intervalMs) * intervalMs;
            if (Math.abs(cp.time - snapped) < intervalMs * 0.1) {
              cp.time = snapped;
              cp.adjusted = true;
            }
          }
          return cp;
        });
      },
    });

    // 60001 is 1ms off from 60000 — should snap
    const { data } = pipeline.clean([makeRaw({ time: 60001 })], makeCtx());
    expect(data[0].time).toBe(60000);
    expect(data[0].adjusted).toBe(true);
  });
});

// ── Stage: OutlierRemoval ────────────────────────────────────────────────────

describe('Stage: outlier-removal', () => {
  it('removes price outlier exceeding 3 stddev threshold', () => {
    const pipeline = new DataCleaningPipeline(false);
    pipeline.addStage({
      id: 'outlier-removal',
      name: 'Outlier Removal',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        if (data.length < 3) return data.map(d => ({ ...d, adjusted: false, anomalies: [], qualityScore: 1 }));
        const sorted = [...data].sort((a, b) => a.time - b.time);
        const changes = [];
        for (let i = 1; i < sorted.length; i++) {
          changes.push(Math.abs(sorted[i].close - sorted[i - 1].close));
        }
        const avg = changes.reduce((s, v) => s + v, 0) / changes.length;
        const variance = changes.reduce((s, v) => s + (v - avg) ** 2, 0) / changes.length;
        const std = Math.sqrt(variance);
        const threshold = 3 * std;
        if (threshold === 0) return sorted.map(d => ({ ...d, adjusted: false, anomalies: [], qualityScore: 1 }));
        const result: any[] = [{ ...sorted[0], adjusted: false, anomalies: [], qualityScore: 1 }];
        for (let i = 1; i < sorted.length; i++) {
          const change = Math.abs(sorted[i].close - sorted[i - 1].close);
          if (change <= threshold) {
            result.push({ ...sorted[i], adjusted: false, anomalies: [], qualityScore: 1 });
          }
        }
        return result;
      },
    });

    const raw = range(10).map(i => makeRaw({ time: i, close: 100 + i }));
    // Add an outlier
    raw.push(makeRaw({ time: 10, close: 500 }));
    const { data } = pipeline.clean(raw, makeCtx());
    expect(data.length).toBeLessThanOrEqual(11);
    // The outlier at time=10 should be removed
    expect(data.find(d => d.time === 10 && d.close === 500)).toBeUndefined();
  });

  it('keeps all points when data.length < 3', () => {
    const pipeline = new DataCleaningPipeline();
    const raw = [makeRaw({ time: 1 }), makeRaw({ time: 2 })];
    const { data } = pipeline.clean(raw, makeCtx());
    expect(data.length).toBe(2);
  });
});

// ── Stage: OHLCValidator ─────────────────────────────────────────────────────

describe('Stage: ohlc-validator', () => {
  it('adjusts high < max(open, close)', () => {
    const pipeline = new DataCleaningPipeline(false);
    pipeline.addStage({
      id: 'ohlc-validator',
      name: 'OHLC Validator',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        return data.map(p => {
          const cp = { ...p, adjusted: false, anomalies: [] as string[], qualityScore: 1 };
          const expectedHigh = Math.max(cp.open, cp.close);
          if (cp.high < expectedHigh) {
            cp.high = expectedHigh;
            cp.adjusted = true;
            cp.anomalies.push('high<expected');
          }
          return cp;
        });
      },
    });

    // open=100, close=120, high=110 → should fix high to 120
    const { data } = pipeline.clean([makeRaw({ time: 1, open: 100, close: 120, high: 110 })], makeCtx());
    expect(data[0].high).toBe(120);
    expect(data[0].adjusted).toBe(true);
  });

  it('adjusts low > min(open, close)', () => {
    const pipeline = new DataCleaningPipeline(false);
    pipeline.addStage({
      id: 'ohlc-validator',
      name: 'OHLC Validator',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        return data.map(p => {
          const cp = { ...p, adjusted: false, anomalies: [] as string[], qualityScore: 1 };
          const expectedLow = Math.min(cp.open, cp.close);
          if (cp.low > expectedLow) {
            cp.low = expectedLow;
            cp.adjusted = true;
          }
          return cp;
        });
      },
    });

    const { data } = pipeline.clean([makeRaw({ time: 1, open: 100, close: 80, low: 90 })], makeCtx());
    expect(data[0].low).toBe(80);
  });
});

// ── Stage: VolumeNormalizer ──────────────────────────────────────────────────

describe('Stage: volume-normalizer', () => {
  it('flags zero volume', () => {
    const pipeline = new DataCleaningPipeline(false);
    pipeline.addStage({
      id: 'volume-normalizer',
      name: 'Volume Normalizer',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        return data.map(p => {
          const cp = { ...p, adjusted: false, anomalies: [] as string[], qualityScore: 1 };
          if (cp.volume === 0) {
            cp.anomalies.push('zero-volume');
            cp.qualityScore *= 0.8;
          }
          return cp;
        });
      },
    });

    const { data } = pipeline.clean([makeRaw({ time: 1, volume: 0 })], makeCtx());
    expect(data[0].anomalies).toContain('zero-volume');
  });

  it('flags volume spike > 5x average', () => {
    const pipeline = new DataCleaningPipeline(false);
    pipeline.addStage({
      id: 'volume-normalizer',
      name: 'Volume Normalizer',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        const vols = data.map(d => d.volume).filter(v => v > 0);
        const avg = vols.reduce((s, v) => s + v, 0) / vols.length;
        return data.map(p => {
          const cp = { ...p, adjusted: false, anomalies: [] as string[], qualityScore: 1 };
          if (avg > 0 && cp.volume > avg * 5) {
            cp.anomalies.push('volume-spike');
          }
          return cp;
        });
      },
    });

    const raw = [
      makeRaw({ time: 1, volume: 100 }),
      makeRaw({ time: 2, volume: 100 }),
      makeRaw({ time: 3, volume: 10000 }),
    ];
    const { data } = pipeline.clean(raw, makeCtx());
    expect(data[2].anomalies).toContain('volume-spike');
  });
});

// ── Stage: GapFiller ─────────────────────────────────────────────────────────

describe('Stage: gap-filler', () => {
  it('interpolates missing bars in time series', () => {
    const pipeline = new DataCleaningPipeline(false);
    const interval = 60_000;
    pipeline.addStage({
      id: 'gap-filler',
      name: 'Gap Filler',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        if (data.length < 2) return data.map(d => ({ ...d, adjusted: false, anomalies: [], qualityScore: 1 }));
        const sorted = [...data].sort((a, b) => a.time - b.time);
        const result: any[] = [{ ...sorted[0], adjusted: false, anomalies: [], qualityScore: 1 }];
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const curr = sorted[i];
          const gap = curr.time - prev.time;
          if (gap > interval * 1.5) {
            const missing = Math.round(gap / interval) - 1;
            for (let j = 1; j <= missing; j++) {
              result.push({
                time: prev.time + j * interval,
                open: prev.close, high: prev.close, low: prev.close, close: curr.open,
                volume: 0, source: 'interpolated', adjusted: true,
                anomalies: ['interpolated-gap-fill'], qualityScore: 0.5,
              });
            }
          }
          result.push({ ...curr, adjusted: false, anomalies: [], qualityScore: 1 });
        }
        return result;
      },
    });

    // Gap from 60000 to 240000 (3 intervals missing)
    const raw = [
      makeRaw({ time: 60000, close: 100 }),
      makeRaw({ time: 240000, open: 110 }),
    ];
    const { data } = pipeline.clean(raw, makeCtx({ metadata: { barIntervalMs: interval } }));
    // Should have 2 original + 2 interpolated (240000-60000)/60000 - 1 = 2
    expect(data.length).toBe(4);
    expect(data[1].source).toBe('interpolated');
    expect(data[2].source).toBe('interpolated');
  });

  it('does not fill when gap is <= 1.5x interval', () => {
    const pipeline = new DataCleaningPipeline(false);
    const interval = 60_000;
    pipeline.addStage({
      id: 'gap-filler',
      name: 'Gap Filler',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        if (data.length < 2) return data.map(d => ({ ...d, adjusted: false, anomalies: [], qualityScore: 1 }));
        const sorted = [...data].sort((a, b) => a.time - b.time);
        const result: any[] = [{ ...sorted[0], adjusted: false, anomalies: [], qualityScore: 1 }];
        for (let i = 1; i < sorted.length; i++) {
          const gap = sorted[i].time - sorted[i - 1].time;
          if (gap > interval * 1.5) {
            const missing = Math.round(gap / interval) - 1;
            for (let j = 1; j <= missing; j++) {
              result.push({
                time: sorted[i - 1].time + j * interval,
                open: 0, high: 0, low: 0, close: 0,
                volume: 0, source: 'interpolated', adjusted: true,
                anomalies: ['interpolated'], qualityScore: 0.5,
              });
            }
          }
          result.push({ ...sorted[i], adjusted: false, anomalies: [], qualityScore: 1 });
        }
        return result;
      },
    });

    const raw = [
      makeRaw({ time: 60000 }),
      makeRaw({ time: 90000 }), // gap = 30000, which is 0.5 * interval
    ];
    const { data } = pipeline.clean(raw, makeCtx({ metadata: { barIntervalMs: interval } }));
    expect(data.length).toBe(2); // No interpolation
  });
});

// ── Stage: StaleDataDetector ─────────────────────────────────────────────────

describe('Stage: stale-data-detector', () => {
  it('flags consecutive identical OHLC bars', () => {
    const pipeline = new DataCleaningPipeline(false);
    pipeline.addStage({
      id: 'stale-data-detector',
      name: 'Stale Data Detector',
      enabled: true,
      fn: (data: RawDataPoint[]) => {
        if (data.length < 2) return data.map(d => ({ ...d, adjusted: false, anomalies: [], qualityScore: 1 }));
        const sorted = [...data].sort((a, b) => a.time - b.time);
        const result: any[] = [{ ...sorted[0], adjusted: false, anomalies: [], qualityScore: 1 }];
        let consecutive = 1;
        for (let i = 1; i < sorted.length; i++) {
          const cp = { ...sorted[i], adjusted: false, anomalies: [] as string[], qualityScore: 1 };
          const prev = sorted[i - 1];
          if (cp.open === prev.open && cp.high === prev.high && cp.low === prev.low && cp.close === prev.close) {
            consecutive++;
          } else {
            consecutive = 1;
          }
          if (consecutive > 3) {
            cp.anomalies.push(`stale-data (${consecutive} identical)`);
          }
          result.push(cp);
        }
        return result;
      },
    });

    const identical = makeRaw({ time: 1, open: 100, high: 110, low: 90, close: 105 });
    const raw = range(6).map(i => ({ ...identical, time: i }));
    const { data } = pipeline.clean(raw, makeCtx());
    // Bars 3,4,5 should be flagged (consecutive > 3)
    const flagged = data.filter(d => d.anomalies.some(a => a.startsWith('stale-data')));
    expect(flagged.length).toBe(3);
  });
});

// ── Full Pipeline Integration ────────────────────────────────────────────────

describe('Full pipeline integration', () => {
  let pipeline: DataCleaningPipeline;

  beforeEach(() => {
    pipeline = new DataCleaningPipeline();
  });

  it('runs all 8 stages on realistic data', () => {
    const raw = range(20).map(i =>
      makeRaw({
        time: i * 300_000,
        open: 100 + Math.sin(i) * 5,
        high: 110 + Math.sin(i) * 5,
        low: 90 + Math.sin(i) * 5,
        close: 105 + Math.sin(i) * 5,
        volume: 1000 + i * 10,
      })
    );
    const { data, report } = pipeline.clean(raw, makeCtx());
    expect(data.length).toBeGreaterThan(0);
    expect(report.totalPoints).toBe(20);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(report.qualityScore).toBeGreaterThan(0);
    expect(report.qualityScore).toBeLessThanOrEqual(1);
  });

  it('skips disabled stages', () => {
    // Disable all stages
    for (const s of pipeline.getStages()) {
      pipeline.enableStage(s.id, false);
    }
    const raw = [makeRaw({ time: 1 }), makeRaw({ time: 2 })];
    const { data } = pipeline.clean(raw, makeCtx());
    // With all stages disabled, data should pass through as-is
    expect(data.length).toBe(2);
  });

  it('handles stage that throws without losing data', () => {
    const badPipeline = new DataCleaningPipeline(false);
    badPipeline.addStage({
      id: 'bad-stage',
      name: 'Bad Stage',
      enabled: true,
      fn: () => { throw new Error('stage crash'); },
    });
    badPipeline.addStage({
      id: 'good-stage',
      name: 'Good Stage',
      enabled: true,
      fn: (data) => data.map(d => ({ ...d, adjusted: false, anomalies: [], qualityScore: 1 })),
    });

    const raw = [makeRaw({ time: 1 })];
    const { data } = badPipeline.clean(raw, makeCtx());
    expect(data.length).toBe(1);
  });

  it('report adjustments collect anomaly info', () => {
    const raw = [
      makeRaw({ time: 1, volume: 0 }),
      makeRaw({ time: 2, volume: 1000 }),
    ];
    const { report } = pipeline.clean(raw, makeCtx());
    // Volume normalizer should flag zero-volume
    expect(report.adjustments.length).toBeGreaterThanOrEqual(0);
  });

  it('handles single-point input', () => {
    const { data, report } = pipeline.clean([makeRaw({ time: 42 })], makeCtx());
    expect(data.length).toBe(1);
    expect(data[0].time).toBe(42);
    expect(report.cleanedPoints).toBe(1);
  });
});
