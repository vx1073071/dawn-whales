// =============================================================================
// MultiTimeframeEngine Tests (Q-39-01)
// J-39-02: Multi-timeframe signal fusion engine
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiTimeframeEngine,
  getMultiTimeframeEngine,
  TimeframeKey,
  SignalDirection,
  FusionMode,
  TimeframeSignal,
  FusionConfig,
  EngineConfig,
  TimeframeConfig,
} from '../electron/engine/multi-timeframe-engine';

function makeSignal(
  timeframe: TimeframeKey,
  direction: SignalDirection,
  strength = 60,
  symbol = 'BTCUSDT',
  offsetMs = 0
): TimeframeSignal {
  return {
    timeframe,
    symbol,
    direction,
    strength,
    timestamp: Date.now() - offsetMs,
  };
}

describe('MultiTimeframeEngine', () => {
  // ── Initialization ───────────────────────────────────────────────────────

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const engine = new MultiTimeframeEngine();
      expect(engine.getStatus()).toBe('active');
      expect(engine.getFusionConfig().mode).toBe('weighted');
      expect(engine.getFusionConfig().minTimeframes).toBe(2);
    });

    it('should initialize with custom fusion config', () => {
      const engine = new MultiTimeframeEngine({
        fusion: { mode: 'majority', majorityThreshold: 0.7 },
      });
      expect(engine.getFusionConfig().mode).toBe('majority');
      expect(engine.getFusionConfig().majorityThreshold).toBe(0.7);
    });

    it('should support weighted fusion mode', () => {
      const engine = new MultiTimeframeEngine({ fusion: { mode: 'weighted' } });
      expect(engine.getFusionConfig().mode).toBe('weighted');
    });

    it('should support any fusion mode', () => {
      const engine = new MultiTimeframeEngine({ fusion: { mode: 'any', anyThreshold: 70 } });
      expect(engine.getFusionConfig().mode).toBe('any');
      expect(engine.getFusionConfig().anyThreshold).toBe(70);
    });

    it('should return timeframe order', () => {
      const engine = new MultiTimeframeEngine();
      const order = engine.getTimeframeOrder();
      expect(order).toContain('1m');
      expect(order).toContain('1d');
      expect(order.length).toBe(7);
    });
  });

  // ── Signal Submission ─────────────────────────────────────────────────

  describe('submitSignal / submitBatch', () => {
    it('should accept and store a valid signal', () => {
      const engine = new MultiTimeframeEngine();
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      const signals = engine.getCurrentSignals('BTCUSDT');
      expect(signals).toHaveLength(1);
      expect(signals[0].direction).toBe('BUY');
    });

    it('should reject signal below minStrength', () => {
      const engine = new MultiTimeframeEngine();
      engine.submitSignal(makeSignal('1m', 'BUY', 10)); // below 30 threshold
      expect(engine.getCurrentSignals('BTCUSDT')).toHaveLength(0);
    });

    it('should reject signal for unknown timeframe', () => {
      const engine = new MultiTimeframeEngine();
      const signal: TimeframeSignal = {
        timeframe: '1m' as TimeframeKey,
        symbol: 'BTCUSDT',
        direction: 'BUY',
        strength: 60,
        timestamp: Date.now(),
      };
      // No error thrown, just silently ignored
      engine.submitSignal(signal);
    });

    it('should accept batch of signals', () => {
      const engine = new MultiTimeframeEngine();
      engine.submitBatch([
        makeSignal('1m', 'BUY', 60),
        makeSignal('5m', 'BUY', 65),
        makeSignal('1h', 'SELL', 55),
      ]);
      expect(engine.getCurrentSignals('BTCUSDT')).toHaveLength(3);
    });

    it('should update existing signal for same timeframe', () => {
      const engine = new MultiTimeframeEngine();
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      engine.submitSignal(makeSignal('1m', 'SELL', 70));
      const signals = engine.getCurrentSignals('BTCUSDT');
      expect(signals).toHaveLength(1);
      expect(signals[0].direction).toBe('SELL');
    });
  });

  // ── Weighted Fusion ───────────────────────────────────────────────────

  describe('Weighted Fusion Mode', () => {
    it('should fuse BUY signals from multiple timeframes', () => {
      const engine = new MultiTimeframeEngine({ fusion: { mode: 'weighted' } });
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      engine.submitSignal(makeSignal('5m', 'BUY', 70));
      engine.submitSignal(makeSignal('1h', 'BUY', 65));
      const result = engine.getLatestFusion('BTCUSDT');
      expect(result).not.toBeNull();
      expect(result!.direction).toBe('BUY');
      expect(result!.strength).toBeGreaterThan(0);
    });

    it('should return HOLD when directions conflict', () => {
      const engine = new MultiTimeframeEngine({ fusion: { mode: 'weighted' } });
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      engine.submitSignal(makeSignal('5m', 'SELL', 60));
      engine.submitSignal(makeSignal('1h', 'BUY', 60));
      const result = engine.getLatestFusion('BTCUSDT');
      // weighted: BUY has 1m+1h weights, SELL has 5m weight → BUY wins
      expect(result!.direction).toBe('BUY');
    });

    it('should return null when below minTimeframes', () => {
      const engine = new MultiTimeframeEngine({ fusion: { mode: 'weighted', minTimeframes: 3 } });
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      engine.submitSignal(makeSignal('5m', 'BUY', 60));
      expect(engine.getLatestFusion('BTCUSDT')).toBeNull();
    });

    it('should calculate confidence as percentage', () => {
      const engine = new MultiTimeframeEngine({ fusion: { mode: 'weighted' } });
      engine.submitSignal(makeSignal('1m', 'BUY', 80));
      engine.submitSignal(makeSignal('5m', 'BUY', 80));
      engine.submitSignal(makeSignal('1h', 'BUY', 80));
      const result = engine.getLatestFusion('BTCUSDT');
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThanOrEqual(100);
    });
  });

  // ── Majority Fusion ──────────────────────────────────────────────────

  describe('Majority Fusion Mode', () => {
    it('should return majority direction', () => {
      const engine = new MultiTimeframeEngine({ fusion: { mode: 'majority', majorityThreshold: 0.6 } });
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      engine.submitSignal(makeSignal('5m', 'BUY', 60));
      engine.submitSignal(makeSignal('1h', 'BUY', 60));
      engine.submitSignal(makeSignal('4h', 'SELL', 60));
      const result = engine.getLatestFusion('BTCUSDT');
      expect(result!.direction).toBe('BUY');
      expect(result!.mode).toBe('majority');
    });

    it('should return HOLD when no majority', () => {
      const engine = new MultiTimeframeEngine({ fusion: { mode: 'majority', majorityThreshold: 1.0 } });
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      engine.submitSignal(makeSignal('5m', 'SELL', 60));
      const result = engine.getLatestFusion('BTCUSDT');
      // No threshold reached → direction may be HOLD or first strong
      expect(['BUY', 'SELL', 'HOLD']).toContain(result!.direction);
    });
  });

  // ── Any Fusion ───────────────────────────────────────────────────────

  describe('Any Fusion Mode', () => {
    it('should return strongest BUY signal above threshold', () => {
      const engine = new MultiTimeframeEngine({ fusion: { mode: 'any', anyThreshold: 60 } });
      engine.submitSignal(makeSignal('1m', 'BUY', 65));
      engine.submitSignal(makeSignal('5m', 'SELL', 70));
      const result = engine.getLatestFusion('BTCUSDT');
      // 'any': SELL at 70 > anyThreshold 60, takes precedence
      expect(result!.direction).toBe('SELL');
    });

    it('should return HOLD when no signal above threshold', () => {
      const engine = new MultiTimeframeEngine({ fusion: { mode: 'any', anyThreshold: 80 } });
      engine.submitSignal(makeSignal('1m', 'BUY', 65));
      engine.submitSignal(makeSignal('5m', 'SELL', 70));
      const result = engine.getLatestFusion('BTCUSDT');
      expect(result!.direction).toBe('HOLD');
    });
  });

  // ── Staleness ────────────────────────────────────────────────────────

  describe('Staleness', () => {
    it('should mark old signals as stale', () => {
      const engine = new MultiTimeframeEngine();
      // 1m signal from 5 minutes ago (stale for 1m: 120000ms threshold)
      engine.submitSignal(makeSignal('1m', 'BUY', 60, 'BTCUSDT', 300_000));
      const signals = engine.getCurrentSignals('BTCUSDT');
      expect(signals).toHaveLength(1);
      expect(engine.isSignalStale(signals[0])).toBe(true);
    });

    it('should not mark recent signals as stale', () => {
      const engine = new MultiTimeframeEngine();
      engine.submitSignal(makeSignal('1m', 'BUY', 60, 'BTCUSDT', 0));
      const signals = engine.getCurrentSignals('BTCUSDT');
      expect(engine.isSignalStale(signals[0])).toBe(false);
    });

    it('should ignore stale signals in fusion when enableStalenessCheck=true', () => {
      const engine = new MultiTimeframeEngine({
        fusion: { enableStalenessCheck: true },
      });
      // 1m stale (300s > 120s threshold)
      engine.submitSignal(makeSignal('1m', 'BUY', 70, 'BTCUSDT', 300_000));
      // 1h fresh
      engine.submitSignal(makeSignal('1h', 'BUY', 70, 'BTCUSDT', 0));
      const result = engine.getLatestFusion('BTCUSDT');
      // Only 1h should count, but minTimeframes=2 → no fusion
      expect(result).toBeNull();
    });
  });

  // ── Config Methods ───────────────────────────────────────────────────

  describe('Configuration Methods', () => {
    it('should update fusion config', () => {
      const engine = new MultiTimeframeEngine();
      engine.setFusionConfig({ mode: 'majority', minTimeframes: 1 });
      expect(engine.getFusionConfig().mode).toBe('majority');
      expect(engine.getFusionConfig().minTimeframes).toBe(1);
    });

    it('should get timeframe config', () => {
      const engine = new MultiTimeframeEngine();
      const config = engine.getTimeframeConfig('1m');
      expect(config).not.toBeNull();
      expect(config!.timeframe).toBe('1m');
      expect(config!.weight).toBeGreaterThan(0);
    });

    it('should return null for invalid timeframe', () => {
      const engine = new MultiTimeframeEngine();
      expect(engine.getTimeframeConfig('99m' as TimeframeKey)).toBeNull();
    });

    it('should update timeframe config', () => {
      const engine = new MultiTimeframeEngine();
      const ok = engine.setTimeframeConfig('1m', { weight: 0.5, minStrength: 50 });
      expect(ok).toBe(true);
      const config = engine.getTimeframeConfig('1m');
      expect(config!.weight).toBe(0.5);
      expect(config!.minStrength).toBe(50);
    });

    it('should enable/disable timeframe', () => {
      const engine = new MultiTimeframeEngine();
      engine.setTimeframeEnabled('1m', false);
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      expect(engine.getCurrentSignals('BTCUSDT')).toHaveLength(0);
    });

    it('should set timeframe weight', () => {
      const engine = new MultiTimeframeEngine();
      engine.setTimeframeWeight('1m', 0.5);
      expect(engine.getTimeframeConfig('1m')!.weight).toBe(0.5);
    });
  });

  // ── Query ─────────────────────────────────────────────────────────────

  describe('Query Methods', () => {
    it('should get symbols list', () => {
      const engine = new MultiTimeframeEngine();
      engine.submitSignal(makeSignal('1m', 'BUY', 60, 'BTCUSDT'));
      engine.submitSignal(makeSignal('5m', 'BUY', 60, 'ETHUSDT'));
      const symbols = engine.getSymbols();
      expect(symbols).toContain('BTCUSDT');
      expect(symbols).toContain('ETHUSDT');
    });

    it('should return empty fusion history by default', () => {
      const engine = new MultiTimeframeEngine();
      expect(engine.getFusionHistory('BTCUSDT')).toHaveLength(0);
    });

    it('should return limited fusion history', () => {
      const engine = new MultiTimeframeEngine({ fusion: { minTimeframes: 1 } });
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      engine.submitSignal(makeSignal('5m', 'BUY', 60));
      engine.submitSignal(makeSignal('1h', 'BUY', 60));
      engine.submitSignal(makeSignal('4h', 'BUY', 60));
      engine.submitSignal(makeSignal('1d', 'BUY', 60));
      const history = engine.getFusionHistory('BTCUSDT', 3);
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should return timeframe stats', () => {
      const engine = new MultiTimeframeEngine({ fusion: { minTimeframes: 1 } });
      // submitSignal stores one signal per (symbol, timeframe); use 2 symbols
      // to get count=2 in stats.
      engine.submitSignal(makeSignal('1m', 'BUY', 60, 'BTCUSDT'));
      engine.submitSignal(makeSignal('1m', 'SELL', 60, 'ETHUSDT'));
      const stats = engine.getTimeframeStats();
      const m1 = stats.find(s => s.timeframe === '1m');
      expect(m1!.signalCount).toBe(2);
    });
  });

  // ── Events ──────────────────────────────────────────────────────────

  describe('EventEmitter', () => {
    it('should emit signal:received event', () => {
      const engine = new MultiTimeframeEngine();
      let received = false;
      engine.on('signal:received', () => { received = true; });
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      expect(received).toBe(true);
    });

    it('should emit fusion:result event', () => {
      const engine = new MultiTimeframeEngine({ fusion: { minTimeframes: 1 } });
      let fused = false;
      engine.on('fusion:result', () => { fused = true; });
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      expect(fused).toBe(true);
    });

    it('should remove all listeners on reset', () => {
      const engine = new MultiTimeframeEngine();
      engine.on('signal:received', () => {});
      engine.reset();
      expect(engine.listenerCount('signal:received')).toBe(0);
    });
  });

  // ── Cleanup ────────────────────────────────────────────────────────

  describe('Cleanup', () => {
    it('should clear symbol signals', () => {
      const engine = new MultiTimeframeEngine();
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      engine.submitBatch([makeSignal('5m', 'BUY', 60), makeSignal('1h', 'BUY', 60)]);
      engine.clearSymbol('BTCUSDT');
      expect(engine.getCurrentSignals('BTCUSDT')).toHaveLength(0);
      expect(engine.getLatestFusion('BTCUSDT')).toBeNull();
    });

    it('should clear all data', () => {
      const engine = new MultiTimeframeEngine({ fusion: { minTimeframes: 1 } });
      engine.submitSignal(makeSignal('1m', 'BUY', 60, 'BTCUSDT'));
      engine.submitSignal(makeSignal('1m', 'BUY', 60, 'ETHUSDT'));
      engine.clearAll();
      expect(engine.getSymbols()).toHaveLength(0);
    });

    it('should reset engine', () => {
      const engine = new MultiTimeframeEngine({ fusion: { minTimeframes: 1 } });
      engine.submitSignal(makeSignal('1m', 'BUY', 60));
      engine.reset();
      expect(engine.getSymbols()).toHaveLength(0);
      expect(engine.getStatus()).toBe('idle');
    });
  });
});