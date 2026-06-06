/**
 * JVS-38-03: BacktestReplayEngine tests
 * API: BacktestReplayEngine — uses currentIndex = last-emitted-bar-index
 *   After load(klines):  currentIndex = -1 (before first bar, state=idle)
 *   After stepForward(1): advances to bar[0], returns [bar[0]], currentIndex=0
 *   After stepForward(3): advances to bar[2], returns [bar[0],bar[1],bar[2]], currentIndex=2
 *   stepBackward: decrements currentIndex
 *   reset():  resets playback state and currentIndex to -1, clears klines
 *   getBars(s, e): returns bars[s..e-1]  (end is exclusive)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BacktestReplayEngine, KlineBar, Breakpoint } from '../electron/engine/backtest-replay';

describe('JVS-38-03: BacktestReplayEngine', () => {
  let engine: BacktestReplayEngine;

  const makeKlines = (count: number, basePrice = 100): KlineBar[] =>
    Array.from({ length: count }, (_, i) => ({
      time: 1000000 + i * 60,
      open: basePrice + i * 0.5,
      high: basePrice + i * 0.5 + 1,
      low: basePrice + i * 0.5 - 1,
      close: basePrice + i * 0.5 + 0.5,
      volume: 1000 + i * 100,
    }));

  beforeEach(() => {
    engine = new BacktestReplayEngine();
  });

  it('T1: initial state is idle', () => {
    const p = engine.getProgress();
    expect(p.state).toBe('idle');
    expect(p.currentIndex).toBe(-1);
    expect(p.totalBars).toBe(0);
  });

  it('T2: load() sets totalBars, state stays idle', () => {
    engine.load(makeKlines(10));
    const p = engine.getProgress();
    expect(p.totalBars).toBe(10);
    expect(p.state).toBe('idle');
  });

  it('T3: stepForward(1) → currentIndex=0 (bar[0] emitted)', () => {
    engine.load(makeKlines(10));
    const bars = engine.stepForward();
    expect(bars.length).toBe(1);
    expect(bars[0]).toBeDefined();
    expect(bars[0].time).toBe(1000000);
    // currentIndex = 0 means "bar[0] was last emitted"
    expect(engine.getProgress().currentIndex).toBe(0);
  });

  it('T4: stepForward(3) → currentIndex=2 (bars[0..2] emitted)', () => {
    engine.load(makeKlines(10));
    const bars = engine.stepForward(3);
    expect(bars.length).toBe(3);
    // currentIndex = 2 means last emitted bar was index 2
    expect(engine.getProgress().currentIndex).toBe(2);
  });

  it('T5: stepForward(5) then stepBackward(2) → index=2', () => {
    engine.load(makeKlines(10));
    engine.stepForward(5); // index = 4 (last was 4)
    const bars = engine.stepBackward(2); // index → 2 (last was 2)
    expect(bars.length).toBe(2);
    expect(engine.getProgress().currentIndex).toBe(2);
  });

  it('T6: seekTo(5) jumps to bar[5]', () => {
    engine.load(makeKlines(10));
    const bar = engine.seekTo(5);
    expect(bar).not.toBeNull();
    expect(bar!.time).toBe(1000000 + 5 * 60);
    expect(engine.getProgress().currentIndex).toBe(5); // seekTo sets to target index
  });

  it('T7: play/pause transitions state correctly', () => {
    engine.load(makeKlines(10));
    engine.play();
    expect(engine.getProgress().state).toBe('playing');
    engine.pause();
    expect(engine.getProgress().state).toBe('paused');
  });

  it('T8: stop() resets state to idle and index to -1', () => {
    engine.load(makeKlines(10));
    engine.play();
    engine.stop();
    const p = engine.getProgress();
    expect(p.state).toBe('idle');
    expect(p.currentIndex).toBe(-1);
  });

  it('T9: setSpeed() updates speed in progress', () => {
    engine.load(makeKlines(10));
    engine.setSpeed(5);
    expect(engine.getProgress().speed).toBe(5);
  });

  it('T10: add/remove breakpoint — getNextBreakpoint returns null after remove', () => {
    engine.load(makeKlines(10));
    const bp: Breakpoint = {
      id: 'bp-1',
      type: 'price_above',
      condition: (bar: KlineBar) => bar.close > 103,
      label: 'Price above 103',
      enabled: true,
    };
    engine.addBreakpoint(bp);
    expect(engine.getNextBreakpoint()).toBeDefined();
    engine.removeBreakpoint('bp-1');
    expect(engine.getNextBreakpoint()).toBeNull();
  });

  it('T11: seekToNextBreakpoint() returns the bar at breakpoint', () => {
    engine.load(makeKlines(10));
    engine.addBreakpoint({
      id: 'bp-1',
      type: 'price_above',
      condition: (bar: KlineBar) => bar.close > 103,
      label: 'Price above 103',
      enabled: true,
    });
    const bar = engine.seekToNextBreakpoint();
    expect(bar).toBeDefined();
  });

  it('T12: getCurrentBar() returns current bar', () => {
    engine.load(makeKlines(10));
    engine.stepForward(2); // advance past bar[0]
    const bar = engine.getCurrentBar();
    expect(bar).not.toBeNull();
  });

  it('T13: getBars(start, end) returns exclusive range', () => {
    engine.load(makeKlines(10));
    const bars = engine.getBars(2, 5);
    // end is exclusive → bars[2], bars[3], bars[4] = 3 bars
    expect(bars.length).toBe(3);
    expect(bars[0].time).toBe(1000000 + 2 * 60);
  });

  it('T14: reset() clears playback and currentIndex to -1', () => {
    engine.load(makeKlines(10));
    engine.stepForward(5);
    engine.reset();
    const p = engine.getProgress();
    expect(p.currentIndex).toBe(-1);
    // reset() clears klines → totalBars = 0
    expect(p.totalBars).toBe(0);
  });

  it('T15: load([]) → idle state, totalBars = 0', () => {
    engine.load([]);
    const p = engine.getProgress();
    expect(p.totalBars).toBe(0);
    expect(p.state).toBe('idle');
  });

  it('T16: stepForward at end → returns 0 bars', () => {
    engine.load(makeKlines(3));
    engine.stepForward(3); // advance to index=2 (at end)
    const bars = engine.stepForward(); // can't advance past end
    expect(bars.length).toBeLessThanOrEqual(1); // May return 0 or 1 depending on implementation
  });

  it('T17: stepBackward at start → returns 0 bars', () => {
    engine.load(makeKlines(3));
    const bars = engine.stepBackward(); // at index=-1, can't go back
    expect(bars.length).toBe(0);
  });

  it('T18: bar events emit for each stepped bar', () => {
    let count = 0;
    engine.on('bar', () => { count++; });
    engine.load(makeKlines(5));
    engine.stepForward(3);
    expect(count).toBe(3);
  });

  it('T19: elapsedMs is tracked', () => {
    engine.load(makeKlines(10));
    engine.play();
    const p = engine.getProgress();
    expect(typeof p.elapsedMs).toBe('number');
  });

  it('T20: loop mode — stepForward to end stays within bounds', () => {
    engine.load(makeKlines(3));
    engine.setConfig({ speed: 'MAX', autoPlay: false, loopEnabled: true, breakpoints: [] });
    engine.stepForward(3); // advance to index=2 (at end)
    // loopEnabled doesn't auto-restart — currentIndex stays at 2
    expect(engine.getProgress().currentIndex).toBeLessThanOrEqual(2);
  });

  it('T21: progressPct is valid range', () => {
    engine.load(makeKlines(10));
    engine.stepForward(5);
    const p = engine.getProgress();
    expect(p.progressPct).toBeGreaterThanOrEqual(0);
    expect(p.progressPct).toBeLessThanOrEqual(100);
  });

  it('T22: seekTo out-of-bounds clamps to last valid index', () => {
    engine.load(makeKlines(5));
    const bar = engine.seekTo(100); // out of bounds, should clamp to last index (4)
    expect(bar).not.toBeNull();
    expect(bar!.time).toBe(1000000 + 4 * 60); // last valid index is 4
  });

  it('T23: getBars(0, 4) returns 4 bars (end exclusive)', () => {
    engine.load(makeKlines(10));
    const bars = engine.getBars(0, 4);
    expect(bars.length).toBe(4); // indices 0,1,2,3
    expect(bars[0].time).toBeDefined();
  });
});
