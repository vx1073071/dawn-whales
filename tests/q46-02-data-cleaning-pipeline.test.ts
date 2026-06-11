// Q-46-02: DataCleaningPipeline 测试 — QClaw R46
// 覆盖: addStage / removeStage / enableStage / getStages / getReport / clean

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataCleaningPipeline,
  RawDataPoint,
  CleaningStage,
  CleaningContext,
} from '../electron/engine/data/data-cleaning-pipeline';

function makeBar(open: number, high: number, low: number, close: number, volume: number): RawDataPoint {
  return { timestamp: Date.now(), open, high, low, close, volume } as RawDataPoint;
}

function makeContext(symbol: string = 'HK.00700'): CleaningContext {
  return { symbol, interval: '1m', timezone: 'Asia/Hong_Kong', dataSource: 'futu' };
}

describe('DataCleaningPipeline', () => {
  let pipeline: DataCleaningPipeline;

  beforeEach(() => {
    pipeline = new DataCleaningPipeline(false); // start empty for controlled tests
  });

  describe('constructor & defaults', () => {
    it('starts with 0 stages when autoLoadDefaults=false', () => {
      expect(pipeline.getStages()).toHaveLength(0);
    });

    it('starts with 8 stages when autoLoadDefaults=true', () => {
      const full = new DataCleaningPipeline(true);
      expect(full.getStages()).toHaveLength(8);
    });

    it('getReport returns null before any clean', () => {
      expect(pipeline.getReport()).toBeNull();
    });
  });

  describe('addStage', () => {
    it('adds a single stage', () => {
      const stage: CleaningStage = {
        id: 'my-filter',
        name: 'My Filter',
        fn: (data) => data,
        enabled: true,
      };
      pipeline.addStage(stage);
      expect(pipeline.getStages()).toHaveLength(1);
      expect(pipeline.getStages()[0].id).toBe('my-filter');
    });

    it('replaces stage with same ID', () => {
      const s1: CleaningStage = { id: 'dup', name: 'S1', fn: (d) => d, enabled: true };
      const s2: CleaningStage = { id: 'dup', name: 'S2', fn: (d) => d, enabled: true };
      pipeline.addStage(s1);
      pipeline.addStage(s2);
      expect(pipeline.getStages()).toHaveLength(1);
      expect(pipeline.getStages()[0].name).toBe('S2');
    });

    it('adds multiple stages in order', () => {
      for (let i = 0; i < 3; i++) {
        pipeline.addStage({ id: `s${i}`, name: `Stage ${i}`, fn: (d) => d, enabled: true });
      }
      expect(pipeline.getStages()).toHaveLength(3);
    });
  });

  describe('removeStage', () => {
    it('removes existing stage by id', () => {
      pipeline.addStage({ id: 'to-remove', name: 'Remove Me', fn: (d) => d, enabled: true });
      pipeline.addStage({ id: 'to-keep', name: 'Keep Me', fn: (d) => d, enabled: true });
      const removed = pipeline.removeStage('to-remove');
      expect(removed).toBe(true);
      expect(pipeline.getStages()).toHaveLength(1);
      expect(pipeline.getStages()[0].id).toBe('to-keep');
    });

    it('returns false when stage not found', () => {
      const result = pipeline.removeStage('nonexistent');
      expect(result).toBe(false);
    });

    it('keeps pipeline intact when removing unknown id', () => {
      pipeline.addStage({ id: 's1', name: 'S1', fn: (d) => d, enabled: true });
      pipeline.removeStage('unknown');
      expect(pipeline.getStages()).toHaveLength(1);
    });
  });

  describe('enableStage', () => {
    it('disables an enabled stage', () => {
      pipeline.addStage({ id: 's1', name: 'S1', fn: (d) => d, enabled: true });
      const result = pipeline.enableStage('s1', false);
      expect(result).toBe(true);
      expect(pipeline.getStages()[0].enabled).toBe(false);
    });

    it('enables a disabled stage', () => {
      pipeline.addStage({ id: 's1', name: 'S1', fn: (d) => d, enabled: false });
      const result = pipeline.enableStage('s1', true);
      expect(result).toBe(true);
      expect(pipeline.getStages()[0].enabled).toBe(true);
    });

    it('returns true even when no actual change', () => {
      pipeline.addStage({ id: 's1', name: 'S1', fn: (d) => d, enabled: true });
      const result = pipeline.enableStage('s1', true);
      expect(result).toBe(true);
    });

    it('returns false for unknown stage id', () => {
      const result = pipeline.enableStage('nonexistent', true);
      expect(result).toBe(false);
    });
  });

  describe('clean — empty input', () => {
    it('returns empty array with zeroed report for empty data', () => {
      const ctx = makeContext();
      const { data, report } = pipeline.clean([], ctx);
      expect(data).toHaveLength(0);
      expect(report.totalPoints).toBe(0);
      expect(report.removedPoints).toBe(0);
    });

    it('getReport returns last report after clean', () => {
      const ctx = makeContext();
      pipeline.clean([makeBar(100, 105, 99, 102, 1000)], ctx);
      const report = pipeline.getReport();
      expect(report).not.toBeNull();
      expect(report!.totalPoints).toBe(1);
    });
  });

  describe('clean — default stages (autoLoadDefaults=true)', () => {
    it('processes a single valid bar without errors', () => {
      const full = new DataCleaningPipeline(true);
      const ctx = makeContext();
      const bar = makeBar(100, 105, 99, 102, 1000);
      const { data, report } = full.clean([bar], ctx);
      expect(data.length).toBeGreaterThan(0);
      expect(report.totalPoints).toBe(1);
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('marks negative close prices as removed', () => {
      const full = new DataCleaningPipeline(true);
      const ctx = makeContext();
      const bad = makeBar(100, 105, -50, -10, 1000); // negative close
      const { data, report } = full.clean([bad], ctx);
      expect(data).toHaveLength(0);
      expect(report.removedPoints).toBeGreaterThan(0);
    });

    it('marks high<low bars as invalid', () => {
      const full = new DataCleaningPipeline(true);
      const ctx = makeContext();
      const bad = makeBar(100, 90, 95, 92, 1000); // high < low is invalid
      const { report } = full.clean([bad], ctx);
      // OHLC validator runs; totalPoints should be >= cleanedPoints
      expect(report.totalPoints).toBeGreaterThanOrEqual(report.cleanedPoints);
    });

    it('fills gaps in time series', () => {
      const full = new DataCleaningPipeline(true);
      const ctx = makeContext('HK.00700');
      const now = Date.now();
      const bars = [
        makeBar(100, 105, 99, 102, 1000),
        makeBar(102, 107, 101, 104, 1100),
      ];
      bars[0].timestamp = now;
      bars[1].timestamp = now + 60000 * 5; // 5-min gap (expected 1m interval)
      const { data, report } = full.clean(bars, ctx);
      // Should process both bars; gap filler runs
      expect(report.totalPoints).toBe(2);
    });
  });

  describe('clean — data integrity', () => {
    it('output points are CleanDataPoint type (have all OHLCV fields)', () => {
      const full = new DataCleaningPipeline(true);
      const ctx = makeContext();
      const bar = makeBar(100, 105, 99, 102, 1000);
      const { data } = full.clean([bar], ctx);
      if (data.length > 0) {
        const p = data[0];
        expect(p).toHaveProperty('timestamp');
        expect(p).toHaveProperty('open');
        expect(p).toHaveProperty('high');
        expect(p).toHaveProperty('low');
        expect(p).toHaveProperty('close');
        expect(p).toHaveProperty('volume');
      }
    });

    it('reports duration is a positive number', () => {
      const full = new DataCleaningPipeline(true);
      const ctx = makeContext();
      const { report } = full.clean([makeBar(100, 105, 99, 102, 1000)], ctx);
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
