// J-38-02: MultiTimeframeReplayEngine Tests (12 tests)
// Converted from custom runner to standard vitest
// Tests multi-timeframe synchronization, aggregation, and cross-timeframe events

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MultiTimeframeReplayEngine, KLineBar } from '../electron/engine/multi-timeframe-replay';

// ── Test Fixtures ────────────────────────────────────────────────────────

function makeBars(count: number, startPrice = 100, startTime = Date.now(), intervalMs = 60000): KLineBar[] {
  const bars: KLineBar[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    price = Math.max(1, price + (Math.random() - 0.5) * 2);
    bars.push({
      timestamp: startTime + i * intervalMs,
      open: price,
      high: price + Math.random() * 2,
      low: price - Math.random() * 2,
      close: price + (Math.random() - 0.5),
      volume: 1000 + Math.floor(Math.random() * 5000),
      amount: 100000 + Math.floor(Math.random() * 500000),
    });
  }
  return bars;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

describe('J-38-02: MultiTimeframeReplayEngine', () => {
  let engine: MultiTimeframeReplayEngine;

  afterEach(() => {
    engine?.destroy();
    vi.restoreAllMocks();
  });

  // ── Initialization ──────────────────────────────────────────────────────

  describe('Initialization', () => {
    it('T1: engine initializes with config', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m', '15m'],
        syncMode: 'master-slave',
      });
      expect(engine).not.toBeNull();
      expect(engine.getOverallProgress()).toBe(0);
    });
  });

  // ── Data Loading ────────────────────────────────────────────────────────

  describe('Data Loading', () => {
    it('T2: loadFromRaw creates correct bar counts per timeframe', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m', '15m'],
        baseTimeframe: '1m',
      });

      const startTime = Date.now();
      engine.loadFromRaw(makeBars(100, 100, startTime, 60000));

      const snapshots = engine.getSnapshot();
      expect(snapshots).toHaveLength(3);

      const tf1m = snapshots.find(s => s.timeframe === '1m');
      const tf5m = snapshots.find(s => s.timeframe === '5m');

      expect(tf1m?.totalBars).toBe(100);
      expect(tf5m?.totalBars).toBeGreaterThan(0);
    });

    it('T3: loadPreAggregated sets all timeframes to READY', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m', '1h'],
      });

      const startTime = Date.now();
      engine.loadPreAggregated({
        '1m': makeBars(60, 100, startTime, 60000),
        '5m': makeBars(12, 100, startTime, 300000),
        '1h': makeBars(1, 100, startTime, 3600000),
      });

      const snapshots = engine.getSnapshot();
      expect(snapshots.every(s => s.state === 'READY')).toBe(true);
    });
  });

  // ── Playback Control ────────────────────────────────────────────────────

  describe('Playback Control', () => {
    it('T4: play transitions timeframe to PLAYING', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m'],
        syncMode: 'parallel',
        speed: 10,
      });

      const startTime = Date.now();
      engine.loadPreAggregated({
        '1m': makeBars(50, 100, startTime, 60000),
        '5m': makeBars(10, 100, startTime, 300000),
      });

      engine.play();
      const snapshots = engine.getSnapshot();
      expect(snapshots.some(s => s.state === 'PLAYING')).toBe(true);
    });

    it('T4: pause transitions all timeframes to PAUSED', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m'],
        syncMode: 'parallel',
        speed: 10,
      });

      const startTime = Date.now();
      engine.loadPreAggregated({
        '1m': makeBars(50, 100, startTime, 60000),
        '5m': makeBars(10, 100, startTime, 300000),
      });

      engine.play();
      engine.pause();
      const snapshots = engine.getSnapshot();
      expect(snapshots.every(s => s.state === 'PAUSED')).toBe(true);
    });

    it('T5: stepForward advances all timeframes', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m'],
      });

      const startTime = Date.now();
      engine.loadPreAggregated({
        '1m': makeBars(50, 100, startTime, 60000),
        '5m': makeBars(10, 100, startTime, 300000),
      });

      engine.stepForward(5);
      const currentBars = engine.getCurrentBars();

      expect(currentBars.get('1m')).not.toBeNull();
      expect(currentBars.get('5m')).not.toBeNull();
    });

    it('T6: seekTo updates progress', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m'],
      });

      const startTime = Date.now();
      engine.loadPreAggregated({
        '1m': makeBars(100, 100, startTime, 60000),
        '5m': makeBars(20, 100, startTime, 300000),
      });

      engine.seekTo(startTime + 30 * 60000);
      const progress = engine.getOverallProgress();
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(100);
    });

    it('T10: stop transitions all timeframes to STOPPED', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m'],
      });

      const startTime = Date.now();
      engine.loadPreAggregated({
        '1m': makeBars(50, 100, startTime, 60000),
        '5m': makeBars(10, 100, startTime, 300000),
      });

      engine.stepForward(10);
      engine.stop();
      const snapshots = engine.getSnapshot();
      expect(snapshots.every(s => s.state === 'STOPPED')).toBe(true);
    });
  });

  // ── Speed Control ───────────────────────────────────────────────────────

  describe('Speed Control', () => {
    it('T7: setSpeed changes speed without error', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m'],
        speed: 1,
      });

      const rawBars = makeBars(50, 100, Date.now(), 60000);
      engine.loadFromRaw(rawBars);

      expect(() => engine.setSpeed(5)).not.toThrow();
      expect(() => engine.setSpeed(10)).not.toThrow();
    });
  });

  // ── Sync & State ────────────────────────────────────────────────────────

  describe('Sync & State', () => {
    it('T8: isSynced returns boolean', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m'],
        baseTimeframe: '1m',
      });

      const startTime = Date.now();
      engine.loadPreAggregated({
        '1m': makeBars(100, 100, startTime, 60000),
        '5m': makeBars(20, 100, startTime, 300000),
      });

      const result = engine.isSynced();
      expect(typeof result).toBe('boolean');
    });

    it('T11: master-slave mode maintains multiple timeframes', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m'],
        syncMode: 'master-slave',
        masterTimeframe: '1m',
        speed: 10,
      });

      const startTime = Date.now();
      engine.loadPreAggregated({
        '1m': makeBars(50, 100, startTime, 60000),
        '5m': makeBars(10, 100, startTime, 300000),
      });

      engine.play();
      const snapshots = engine.getSnapshot();
      expect(snapshots).toHaveLength(2);
    });
  });

  // ── Events ──────────────────────────────────────────────────────────────

  describe('Events', () => {
    it('T9: bar events emitted during playback', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m', '5m'],
        syncMode: 'parallel',
        speed: 100,
      });

      const startTime = Date.now();
      engine.loadPreAggregated({
        '1m': makeBars(20, 100, startTime, 60000),
        '5m': makeBars(4, 100, startTime, 300000),
      });

      let barEvents = 0;
      engine.on('bar', () => { barEvents++; });

      engine.stepForward(5);
      expect(barEvents).toBeGreaterThan(0);
    });

    it('T12: timeframe:complete event or progress 100%', () => {
      engine = new MultiTimeframeReplayEngine({
        symbol: 'TEST',
        timeframes: ['1m'],
        speed: 100,
      });

      const rawBars = makeBars(10, 100, Date.now(), 60000);
      engine.loadFromRaw(rawBars);

      let completeFired = false;
      engine.on('timeframe:complete', () => { completeFired = true; });

      engine.stepForward(10);

      const isComplete = completeFired || engine.getOverallProgress() >= 100;
      expect(isComplete).toBe(true);
    });
  });
});
