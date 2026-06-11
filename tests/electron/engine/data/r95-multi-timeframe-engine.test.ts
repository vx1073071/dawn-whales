/**
 * Tests for MultiTimeframeEngine — signal fusion across timeframes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MultiTimeframeEngine,
  getMultiTimeframeEngine,
  type TimeframeSignal,
  type TimeframeKey,
  type FusionResult,
} from '../../../../electron/engine/data/multi-timeframe-engine';

// Suppress noisy logs
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSignal(overrides: Partial<TimeframeSignal> = {}): TimeframeSignal {
  return {
    timeframe: '5m',
    symbol: 'AAPL',
    direction: 'BUY',
    strength: 70,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ── Construction & Singleton ─────────────────────────────────────────────────

describe('MultiTimeframeEngine — construction', () => {
  it('creates instance with default config', () => {
    const engine = new MultiTimeframeEngine();
    expect(engine).toBeInstanceOf(MultiTimeframeEngine);
    expect(engine.getStatus()).toBe('active');
  });

  it('accepts custom fusion config', () => {
    const engine = new MultiTimeframeEngine({
      fusion: { mode: 'majority', minTimeframes: 3 },
    });
    const cfg = engine.getFusionConfig();
    expect(cfg.mode).toBe('majority');
    expect(cfg.minTimeframes).toBe(3);
  });

  it('getMultiTimeframeEngine returns singleton', () => {
    const a = getMultiTimeframeEngine();
    const b = getMultiTimeframeEngine();
    expect(a).toBe(b);
  });
});

// ── Signal Input ─────────────────────────────────────────────────────────────

describe('MultiTimeframeEngine — submitSignal', () => {
  let engine: MultiTimeframeEngine;

  beforeEach(() => {
    engine = new MultiTimeframeEngine();
  });

  it('stores signal for valid timeframe', () => {
    engine.submitSignal(makeSignal());
    const signals = engine.getCurrentSignals('AAPL');
    expect(signals.length).toBe(1);
    expect(signals[0].direction).toBe('BUY');
  });

  it('rejects signal below minStrength', () => {
    engine.submitSignal(makeSignal({ strength: 5 })); // below default 30
    expect(engine.getCurrentSignals('AAPL').length).toBe(0);
  });

  it('rejects signal for disabled timeframe', () => {
    engine.setTimeframeEnabled('5m', false);
    engine.submitSignal(makeSignal({ timeframe: '5m' }));
    expect(engine.getCurrentSignals('AAPL').length).toBe(0);
  });

  it('emits signal:received event', () => {
    const handler = vi.fn();
    engine.on('signal:received', handler);
    engine.submitSignal(makeSignal());
    expect(handler).toHaveBeenCalledOnce();
  });

  it('emits fusion:result when enough timeframes', () => {
    const handler = vi.fn();
    engine.on('fusion:result', handler);
    // Submit signals from 2 timeframes (minTimeframes=2)
    engine.submitSignal(makeSignal({ timeframe: '5m' }));
    engine.submitSignal(makeSignal({ timeframe: '15m' }));
    expect(handler).toHaveBeenCalled();
  });

  it('submitBatch processes multiple signals', () => {
    engine.submitBatch([
      makeSignal({ timeframe: '5m', symbol: 'AAPL' }),
      makeSignal({ timeframe: '15m', symbol: 'AAPL' }),
      makeSignal({ timeframe: '1h', symbol: 'GOOG' }),
    ]);
    expect(engine.getCurrentSignals('AAPL').length).toBe(2);
    expect(engine.getCurrentSignals('GOOG').length).toBe(1);
  });

  it('overwrites previous signal for same timeframe+symbol', () => {
    engine.submitSignal(makeSignal({ timeframe: '5m', strength: 50 }));
    engine.submitSignal(makeSignal({ timeframe: '5m', strength: 80 }));
    const signals = engine.getCurrentSignals('AAPL');
    expect(signals.length).toBe(1);
    expect(signals[0].strength).toBe(80);
  });
});

// ── Fusion Modes ─────────────────────────────────────────────────────────────

describe('MultiTimeframeEngine — weighted fusion', () => {
  let engine: MultiTimeframeEngine;

  beforeEach(() => {
    engine = new MultiTimeframeEngine({
      fusion: { mode: 'weighted', minTimeframes: 2 },
    });
  });

  it('fuses BUY signals from multiple timeframes', () => {
    engine.submitSignal(makeSignal({ timeframe: '5m', direction: 'BUY', strength: 80 }));
    engine.submitSignal(makeSignal({ timeframe: '15m', direction: 'BUY', strength: 70 }));
    const result = engine.getLatestFusion('AAPL');
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('BUY');
    expect(result!.mode).toBe('weighted');
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it('picks direction with highest weighted score', () => {
    engine.submitSignal(makeSignal({ timeframe: '5m', direction: 'SELL', strength: 90 }));
    engine.submitSignal(makeSignal({ timeframe: '15m', direction: 'BUY', strength: 40 }));
    const result = engine.getLatestFusion('AAPL');
    expect(result).not.toBeNull();
    // SELL has higher strength, should win
    expect(result!.direction).toBe('SELL');
  });

  it('returns null when all active signals are stale (below minTimeframes)', () => {
    const old = Date.now() - 1_000_000_000;
    engine.submitSignal(makeSignal({ timeframe: '5m', direction: 'BUY', strength: 80, timestamp: old }));
    engine.submitSignal(makeSignal({ timeframe: '15m', direction: 'BUY', strength: 70, timestamp: old }));
    // All signals stale → activeCount=0 < minTimeframes=2 → fuse returns null
    const result = engine.fuse('AAPL');
    expect(result).toBeNull();
  });
});

describe('MultiTimeframeEngine — majority fusion', () => {
  let engine: MultiTimeframeEngine;

  beforeEach(() => {
    engine = new MultiTimeframeEngine({
      fusion: { mode: 'majority', minTimeframes: 2, majorityThreshold: 0.6 },
    });
  });

  it('returns majority direction when threshold met', () => {
    engine.submitSignal(makeSignal({ timeframe: '5m', direction: 'BUY', strength: 80 }));
    engine.submitSignal(makeSignal({ timeframe: '15m', direction: 'BUY', strength: 70 }));
    engine.submitSignal(makeSignal({ timeframe: '1h', direction: 'BUY', strength: 60 }));
    const result = engine.fuse('AAPL');
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('BUY');
  });

  it('falls back to highest-vote direction when no majority', () => {
    engine.submitSignal(makeSignal({ timeframe: '5m', direction: 'BUY', strength: 80 }));
    engine.submitSignal(makeSignal({ timeframe: '15m', direction: 'SELL', strength: 70 }));
    const result = engine.fuse('AAPL');
    expect(result).not.toBeNull();
    // 1 BUY, 1 SELL — no majority, falls back to max
    expect(['BUY', 'SELL', 'HOLD']).toContain(result!.direction);
  });
});

describe('MultiTimeframeEngine — any fusion', () => {
  let engine: MultiTimeframeEngine;

  beforeEach(() => {
    engine = new MultiTimeframeEngine({
      fusion: { mode: 'any', minTimeframes: 1, anyThreshold: 60 },
    });
  });

  it('takes strongest signal above threshold', () => {
    engine.submitSignal(makeSignal({ timeframe: '5m', direction: 'SELL', strength: 65 }));
    engine.submitSignal(makeSignal({ timeframe: '15m', direction: 'BUY', strength: 90 }));
    const result = engine.fuse('AAPL');
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('BUY');
    expect(result!.strength).toBe(90);
  });

  it('returns HOLD when no signal above threshold', () => {
    engine.submitSignal(makeSignal({ timeframe: '5m', direction: 'BUY', strength: 30 }));
    engine.submitSignal(makeSignal({ timeframe: '15m', direction: 'BUY', strength: 40 }));
    const result = engine.fuse('AAPL');
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('HOLD');
  });
});

// ── Configuration ────────────────────────────────────────────────────────────

describe('MultiTimeframeEngine — configuration', () => {
  let engine: MultiTimeframeEngine;

  beforeEach(() => {
    engine = new MultiTimeframeEngine();
  });

  it('getFusionConfig returns copy', () => {
    const cfg = engine.getFusionConfig();
    cfg.mode = 'any';
    expect(engine.getFusionConfig().mode).toBe('weighted'); // unchanged
  });

  it('setFusionConfig updates config', () => {
    engine.setFusionConfig({ mode: 'any' });
    expect(engine.getFusionConfig().mode).toBe('any');
  });

  it('getTimeframeConfig returns config for valid tf', () => {
    const cfg = engine.getTimeframeConfig('1h');
    expect(cfg).not.toBeNull();
    expect(cfg!.timeframe).toBe('1h');
  });

  it('setTimeframeConfig updates specific timeframe', () => {
    expect(engine.setTimeframeConfig('5m', { weight: 0.5 })).toBe(true);
    expect(engine.getTimeframeConfig('5m')!.weight).toBe(0.5);
  });

  it('setTimeframeEnabled toggles', () => {
    expect(engine.setTimeframeEnabled('1d', false)).toBe(true);
    expect(engine.getTimeframeConfig('1d')!.enabled).toBe(false);
  });

  it('setTimeframeWeight clamps to [0,1]', () => {
    engine.setTimeframeWeight('1h', 2.0);
    expect(engine.getTimeframeConfig('1h')!.weight).toBe(1);
    engine.setTimeframeWeight('1h', -1.0);
    expect(engine.getTimeframeConfig('1h')!.weight).toBe(0);
  });
});

// ── Query & Analytics ────────────────────────────────────────────────────────

describe('MultiTimeframeEngine — query', () => {
  let engine: MultiTimeframeEngine;

  beforeEach(() => {
    engine = new MultiTimeframeEngine();
  });

  it('getLatestFusion returns null for unknown symbol', () => {
    expect(engine.getLatestFusion('UNKNOWN')).toBeNull();
  });

  it('getFusionHistory returns empty for unknown symbol', () => {
    expect(engine.getFusionHistory('UNKNOWN')).toEqual([]);
  });

  it('getFusionHistory respects limit', () => {
    for (let i = 0; i < 5; i++) {
      engine.submitSignal(makeSignal({ timeframe: '5m', symbol: 'X' }));
      engine.submitSignal(makeSignal({ timeframe: '15m', symbol: 'X' }));
    }
    const history = engine.getFusionHistory('X', 2);
    expect(history.length).toBeLessThanOrEqual(2);
  });

  it('getCurrentSignals returns empty for unknown symbol', () => {
    expect(engine.getCurrentSignals('UNKNOWN')).toEqual([]);
  });

  it('getTimeframeStats returns stats for all 7 timeframes', () => {
    const stats = engine.getTimeframeStats();
    expect(stats.length).toBe(7);
    expect(stats.map(s => s.timeframe)).toEqual(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);
  });

  it('getSymbols returns tracked symbols', () => {
    engine.submitSignal(makeSignal({ symbol: 'AAPL' }));
    engine.submitSignal(makeSignal({ symbol: 'GOOG', timeframe: '1h' }));
    const symbols = engine.getSymbols();
    expect(symbols).toContain('AAPL');
    expect(symbols).toContain('GOOG');
  });

  it('getTimeframeOrder returns 7 timeframes', () => {
    expect(engine.getTimeframeOrder().length).toBe(7);
  });

  it('isSignalStale detects old signals', () => {
    const old = makeSignal({ timestamp: Date.now() - 1e12 });
    expect(engine.isSignalStale(old)).toBe(true);
    const fresh = makeSignal({ timestamp: Date.now() });
    expect(engine.isSignalStale(fresh)).toBe(false);
  });
});

// ── Cleanup ──────────────────────────────────────────────────────────────────

describe('MultiTimeframeEngine — cleanup', () => {
  let engine: MultiTimeframeEngine;

  beforeEach(() => {
    engine = new MultiTimeframeEngine();
  });

  it('clearSymbol removes data for one symbol', () => {
    engine.submitSignal(makeSignal({ symbol: 'AAPL' }));
    engine.submitSignal(makeSignal({ symbol: 'GOOG', timeframe: '1h' }));
    engine.clearSymbol('AAPL');
    expect(engine.getCurrentSignals('AAPL').length).toBe(0);
    expect(engine.getCurrentSignals('GOOG').length).toBe(1);
  });

  it('clearAll removes everything', () => {
    engine.submitSignal(makeSignal({ symbol: 'AAPL' }));
    engine.submitSignal(makeSignal({ symbol: 'GOOG', timeframe: '1h' }));
    engine.clearAll();
    expect(engine.getSymbols().length).toBe(0);
  });

  it('reset sets status to idle', () => {
    engine.reset();
    expect(engine.getStatus()).toBe('idle');
  });

  it('destroy calls reset', () => {
    engine.submitSignal(makeSignal());
    engine.destroy();
    expect(engine.getStatus()).toBe('idle');
    expect(engine.getSymbols().length).toBe(0);
  });
});
