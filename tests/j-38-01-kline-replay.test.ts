// J-38-01: KLine Replay Engine Tests (20 tests)
// Converted from custom runner to standard vitest
// Tests replay engine with speed control, breakpoints, and data loading

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KLineReplayEngine, KLineBar } from '../electron/engine/kline-replay-engine';

// ── Test Fixtures ────────────────────────────────────────────────────────

function makeBars(count: number, startPrice = 100, startTime = Date.now()): KLineBar[] {
  const bars: KLineBar[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    price = Math.max(1, price + (Math.random() - 0.5) * 2);
    bars.push({
      timestamp: startTime + i * 60000,
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

describe('J-38-01: KLineReplayEngine', () => {
  let engine: KLineReplayEngine;

  beforeEach(() => {
    engine = new KLineReplayEngine();
  });

  afterEach(() => {
    engine?.destroy();
    vi.restoreAllMocks();
  });

  // ── State Machine ───────────────────────────────────────────────────────

  describe('State Machine', () => {
    it('T1: initial state is IDLE', () => {
      expect(engine.getState()).toBe('IDLE');
    });

    it('T2: state is READY after loadData', () => {
      engine.loadData('TEST', makeBars(100));
      expect(engine.getState()).toBe('READY');
    });

    it('T2: totalBars equals loaded count', () => {
      engine.loadData('TEST', makeBars(100));
      expect(engine.getStats().totalBars).toBe(100);
    });

    it('T3: state is PLAYING after play()', () => {
      engine.loadData('TEST', makeBars(50));
      engine.play();
      expect(engine.getState()).toBe('PLAYING');
    });

    it('T3: state is PAUSED after pause()', () => {
      engine.loadData('TEST', makeBars(50));
      engine.play();
      engine.pause();
      expect(engine.getState()).toBe('PAUSED');
    });

    it('T4: state is STOPPED after stop()', () => {
      engine.loadData('TEST', makeBars(50));
      engine.play();
      engine.stop();
      expect(engine.getState()).toBe('STOPPED');
    });

    it('T4: barsProcessed resets to 0 after stop()', () => {
      engine.loadData('TEST', makeBars(50));
      engine.stepForward(5);
      engine.stop();
      expect(engine.getStats().barsProcessed).toBe(0);
    });

    it('T17: state is IDLE after clearData()', () => {
      engine.loadData('TEST', makeBars(50));
      engine.clearData();
      expect(engine.getState()).toBe('IDLE');
    });

    it('T17: totalBars is 0 after clearData()', () => {
      engine.loadData('TEST', makeBars(50));
      engine.clearData();
      expect(engine.getStats().totalBars).toBe(0);
    });
  });

  // ── Playback Control ────────────────────────────────────────────────────

  describe('Playback Control', () => {
    it('T5: stepForward returns correct number of bars', () => {
      engine.loadData('TEST', makeBars(50));
      const stepped = engine.stepForward(5);
      expect(stepped.length).toBe(5);
    });

    it('T5: barsProcessed equals steps after stepForward', () => {
      engine.loadData('TEST', makeBars(50));
      engine.stepForward(5);
      expect(engine.getStats().barsProcessed).toBe(5);
    });

    it('T6: stepBackward does not change barsProcessed', () => {
      engine.loadData('TEST', makeBars(50));
      engine.stepForward(10);
      engine.stepBackward(3);
      expect(engine.getStats().barsProcessed).toBe(10);
    });

    it('T7: seekTo positions to correct bar index', () => {
      const startTime = Date.now();
      engine.loadData('TEST', makeBars(100, 100, startTime));
      engine.seekTo(startTime + 50 * 60000);
      expect(engine.getSnapshot().currentBarIndex).toBeGreaterThanOrEqual(50);
    });

    it('T8: seekToBar positions to exact index', () => {
      engine.loadData('TEST', makeBars(100));
      engine.seekToBar(75);
      expect(engine.getSnapshot().currentBarIndex).toBe(75);
    });

    it('T9: setSpeed changes speed immediately', () => {
      engine.loadData('TEST', makeBars(50));
      engine.setSpeed(5);
      expect(engine.getSpeed()).toBe(5);
      engine.setSpeed(10);
      expect(engine.getSpeed()).toBe(10);
    });
  });

  // ── Breakpoint Management ────────────────────────────────────────────────

  describe('Breakpoints', () => {
    it('T10: addBreakpoint returns correct ID', () => {
      engine.loadData('TEST', makeBars(50));
      const id = engine.addBreakpoint({
        id: 'bp1',
        type: 'price_above',
        condition: { price: 105 },
        enabled: true,
        label: 'Price above 105',
      });
      expect(id).toBe('bp1');
    });

    it('T10: getBreakpoints returns added breakpoint', () => {
      engine.loadData('TEST', makeBars(50));
      engine.addBreakpoint({
        id: 'bp1',
        type: 'price_above',
        condition: { price: 105 },
        enabled: true,
      });
      expect(engine.getBreakpoints()).toHaveLength(1);
    });

    it('T11: removeBreakpoint returns true and removes breakpoint', () => {
      engine.loadData('TEST', makeBars(50));
      engine.addBreakpoint({ id: 'bp1', type: 'price_above', condition: { price: 105 }, enabled: true });
      const removed = engine.removeBreakpoint('bp1');
      expect(removed).toBe(true);
      expect(engine.getBreakpoints()).toHaveLength(0);
    });

    it('T12: toggleBreakpoint disables breakpoint', () => {
      engine.loadData('TEST', makeBars(50));
      engine.addBreakpoint({ id: 'bp1', type: 'price_above', condition: { price: 105 }, enabled: true });
      engine.toggleBreakpoint('bp1', false);
      expect(engine.getBreakpoints()[0].enabled).toBe(false);
    });

    it('T19: volume spike breakpoint triggers', () => {
      const bars = makeBars(50);
      bars[25].volume = 999999; // Inject spike
      engine.loadData('TEST', bars);

      let hit = false;
      engine.on('breakpoint:hit', () => { hit = true; });
      engine.addBreakpoint({
        id: 'vol_spike',
        type: 'volume_spike',
        condition: { volume: 500000 },
        enabled: true,
      });

      // Step until volume spike is reached
      for (let i = 0; i < 30; i++) {
        engine.stepForward(1);
        if (hit) break;
      }

      expect(hit).toBe(true);
    });
  });

  // ── Data Access ─────────────────────────────────────────────────────────

  describe('Data Access', () => {
    it('T13: getCurrentBar returns correct bar after stepping', () => {
      const bars = makeBars(50);
      engine.loadData('TEST', bars);
      engine.stepForward(5);
      const current = engine.getCurrentBar('TEST');
      expect(current).not.toBeNull();
      expect(current!.timestamp).toBe(bars[4].timestamp);
    });

    it('T14: getHistory respects limit parameter', () => {
      engine.loadData('TEST', makeBars(50));
      engine.stepForward(10);
      const history = engine.getHistory('TEST', 5);
      expect(history).toHaveLength(5);
    });

    it('T15: multi-symbol load transitions to READY', () => {
      engine.loadData('SYM1', makeBars(30, 100));
      engine.loadData('SYM2', makeBars(30, 200));
      expect(engine.getState()).toBe('READY');
    });

    it('T15: getStats reports correct symbol count', () => {
      engine.loadData('SYM1', makeBars(30, 100));
      engine.loadData('SYM2', makeBars(30, 200));
      expect(engine.getStats().symbols).toBe(2);
    });

    it('T20: loadBatch loads multiple symbols', () => {
      engine.loadBatch({
        'SYM1': makeBars(20, 100),
        'SYM2': makeBars(20, 200),
      });
      expect(engine.getStats().symbols).toBe(2);
      expect(engine.getState()).toBe('READY');
    });
  });

  // ── Events ──────────────────────────────────────────────────────────────

  describe('Events', () => {
    it('T18: bar event fires on stepForward', () => {
      engine.loadData('TEST', makeBars(10));
      let fired = false;
      engine.on('bar', () => { fired = true; });
      engine.stepForward(1);
      expect(fired).toBe(true);
    });
  });

  // ── Loop Mode ──────────────────────────────────────────────────────────

  describe('Loop Mode', () => {
    it('T16: loopEnabled prevents STOPPED state after exhausting bars', () => {
      const engineWithLoop = new KLineReplayEngine({ symbols: ['TEST'], loopEnabled: true });
      engineWithLoop.loadData('TEST', makeBars(20));
      engineWithLoop.stepForward(20);
      const state = engineWithLoop.getState();
      engineWithLoop.destroy();
      expect(state).toMatch(/READY|PLAYING/);
    });
  });
});
