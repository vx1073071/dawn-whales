// J-39-02: MultiTimeframeEngine Tests
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiTimeframeEngine,
  TimeframeSignal,
  FusionMode,
} from '../electron/engine/multi-timeframe-engine';

describe('J-39-02: MultiTimeframeEngine', () => {
  let engine: MultiTimeframeEngine;

  const createSignal = (
    timeframe: string,
    direction: string,
    strength: number,
    symbol = 'BTCUSDT'
  ): TimeframeSignal => ({
    timeframe: timeframe as any,
    symbol,
    direction: direction as any,
    strength,
    timestamp: Date.now(),
    strategy: 'test',
  });

  beforeEach(() => {
    engine = new MultiTimeframeEngine({
      fusion: {
        mode: 'weighted',
        minTimeframes: 2,
        majorityThreshold: 0.6,
        anyThreshold: 60,
        enableStalenessCheck: false,
        defaultStalenessMs: 3600000,
      },
    });
  });

  // ── Initialization Tests ──────────────────────────────────────────

  it('should initialize with default config', () => {
    const config = engine.getFusionConfig();
    expect(config.mode).toBe('weighted');
    expect(config.minTimeframes).toBe(2);
  });

  it('should initialize all timeframes', () => {
    const order = engine.getTimeframeOrder();
    expect(order).toEqual(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);
  });

  it('should have active status after init', () => {
    expect(engine.getStatus()).toBe('active');
  });

  // ── Signal Submission Tests ───────────────────────────────────────

  it('should accept valid signals', () => {
    const signal = createSignal('1h', 'BUY', 75);
    engine.submitSignal(signal);

    const signals = engine.getCurrentSignals('BTCUSDT');
    expect(signals).toHaveLength(1);
    expect(signals[0].direction).toBe('BUY');
  });

  it('should reject signals below minimum strength', () => {
    const signal = createSignal('1h', 'BUY', 10);
    engine.submitSignal(signal);

    const signals = engine.getCurrentSignals('BTCUSDT');
    expect(signals).toHaveLength(0);
  });

  it('should handle multiple timeframes', () => {
    engine.submitSignal(createSignal('15m', 'BUY', 70));
    engine.submitSignal(createSignal('1h', 'BUY', 80));
    engine.submitSignal(createSignal('4h', 'SELL', 65));

    const signals = engine.getCurrentSignals('BTCUSDT');
    expect(signals).toHaveLength(3);
  });

  it('should handle multiple symbols', () => {
    engine.submitSignal(createSignal('1h', 'BUY', 75, 'BTCUSDT'));
    engine.submitSignal(createSignal('1h', 'SELL', 70, 'ETHUSDT'));

    expect(engine.getSymbols()).toHaveLength(2);
    expect(engine.getSymbols()).toContain('BTCUSDT');
    expect(engine.getSymbols()).toContain('ETHUSDT');
  });

  // ── Weighted Fusion Tests ────────────────────────────────────────

  it('should perform weighted fusion', () => {
    engine.submitSignal(createSignal('1h', 'BUY', 80));
    engine.submitSignal(createSignal('4h', 'BUY', 75));

    const result = engine.getLatestFusion('BTCUSDT');
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('BUY');
    expect(result!.mode).toBe('weighted');
    expect(result!.strength).toBeGreaterThan(0);
  });

  it('should weight higher timeframes more heavily', () => {
    engine.setTimeframeWeight('1h', 0.8);
    engine.setTimeframeWeight('4h', 0.2);

    engine.submitSignal(createSignal('1h', 'BUY', 70));
    engine.submitSignal(createSignal('4h', 'SELL', 70));

    const result = engine.getLatestFusion('BTCUSDT');
    expect(result!.direction).toBe('BUY'); // 1h has higher weight
  });

  it('should return null when insufficient timeframes', () => {
    engine.submitSignal(createSignal('1h', 'BUY', 75));

    const result = engine.getLatestFusion('BTCUSDT');
    expect(result).toBeNull(); // Need at least 2 timeframes
  });

  // ── Majority Fusion Tests ────────────────────────────────────────

  it('should perform majority fusion', () => {
    engine.setFusionConfig({ mode: 'majority' });

    engine.submitSignal(createSignal('15m', 'BUY', 70));
    engine.submitSignal(createSignal('1h', 'BUY', 75));
    engine.submitSignal(createSignal('4h', 'BUY', 80));

    const result = engine.getLatestFusion('BTCUSDT');
    expect(result!.direction).toBe('BUY');
    expect(result!.mode).toBe('majority');
  });

  it('should respect majority threshold', () => {
    engine.setFusionConfig({ mode: 'majority', majorityThreshold: 0.7 });

    engine.submitSignal(createSignal('15m', 'BUY', 70));
    engine.submitSignal(createSignal('1h', 'BUY', 75));
    engine.submitSignal(createSignal('4h', 'SELL', 80));

    const result = engine.getLatestFusion('BTCUSDT');
    // 2/3 = 66.7% < 70% threshold, should fallback
    expect(result).not.toBeNull();
  });

  // ── Any Fusion Tests ─────────────────────────────────────────────

  it('should perform any fusion', () => {
    engine.setFusionConfig({ mode: 'any', anyThreshold: 60 });

    engine.submitSignal(createSignal('1h', 'BUY', 85));
    engine.submitSignal(createSignal('4h', 'HOLD', 40));

    const result = engine.getLatestFusion('BTCUSDT');
    expect(result!.direction).toBe('BUY');
    expect(result!.mode).toBe('any');
    expect(result!.strength).toBeGreaterThanOrEqual(60);
  });

  it('should return HOLD when no strong signals in any mode', () => {
    engine.setFusionConfig({ mode: 'any', anyThreshold: 80 });

    engine.submitSignal(createSignal('1h', 'BUY', 70));
    engine.submitSignal(createSignal('4h', 'SELL', 65));

    const result = engine.getLatestFusion('BTCUSDT');
    expect(result!.direction).toBe('HOLD');
  });

  // ── Staleness Tests ──────────────────────────────────────────────

  it('should detect stale signals', () => {
    const oldSignal: TimeframeSignal = {
      timeframe: '1h',
      symbol: 'BTCUSDT',
      direction: 'BUY',
      strength: 75,
      timestamp: Date.now() - 7200000, // 2 hours old
    };

    engine.setFusionConfig({ enableStalenessCheck: true });
    engine.setTimeframeConfig('1h', { stalenessMs: 3600000 }); // 1 hour

    expect(engine.isSignalStale(oldSignal)).toBe(true);
  });

  it('should ignore stale signals in fusion', () => {
    engine.setFusionConfig({ enableStalenessCheck: true, minTimeframes: 1 });
    engine.setTimeframeConfig('1h', { stalenessMs: 60000 });

    const oldSignal: TimeframeSignal = {
      timeframe: '1h',
      symbol: 'BTCUSDT',
      direction: 'BUY',
      strength: 75,
      timestamp: Date.now() - 120000, // 2 minutes old
    };

    engine.submitSignal(oldSignal);
    engine.submitSignal(createSignal('4h', 'SELL', 70));

    const result = engine.getLatestFusion('BTCUSDT');
    // 1h signal is stale, so only 4h contributes
    expect(result!.contributingTimeframes).toContain('4h');
  });

  // ── Configuration Tests ──────────────────────────────────────────

  it('should update fusion config', () => {
    engine.setFusionConfig({ mode: 'majority', minTimeframes: 3 });

    const config = engine.getFusionConfig();
    expect(config.mode).toBe('majority');
    expect(config.minTimeframes).toBe(3);
  });

  it('should enable/disable timeframes', () => {
    engine.setTimeframeEnabled('1m', false);

    const config = engine.getTimeframeConfig('1m');
    expect(config!.enabled).toBe(false);

    // Disabled timeframe should be ignored
    engine.submitSignal(createSignal('1m', 'BUY', 90));
    expect(engine.getCurrentSignals('BTCUSDT')).toHaveLength(0);
  });

  it('should set timeframe weights', () => {
    engine.setTimeframeWeight('1h', 0.5);

    const config = engine.getTimeframeConfig('1h');
    expect(config!.weight).toBe(0.5);
  });

  it('should clamp weights to 0-1 range', () => {
    engine.setTimeframeWeight('1h', 1.5);
    expect(engine.getTimeframeConfig('1h')!.weight).toBe(1);

    engine.setTimeframeWeight('1h', -0.5);
    expect(engine.getTimeframeConfig('1h')!.weight).toBe(0);
  });

  // ── History & Analytics Tests ────────────────────────────────────

  it('should maintain fusion history', () => {
    engine.submitSignal(createSignal('1h', 'BUY', 75));
    engine.submitSignal(createSignal('4h', 'BUY', 80));
    engine.submitSignal(createSignal('1h', 'SELL', 70));
    engine.submitSignal(createSignal('4h', 'SELL', 65));

    const history = engine.getFusionHistory('BTCUSDT');
    expect(history.length).toBeGreaterThan(0);
  });

  it('should limit history size', () => {
    for (let i = 0; i < 150; i++) {
      engine.submitSignal(createSignal('1h', 'BUY', 75));
      engine.submitSignal(createSignal('4h', 'BUY', 80));
    }

    const history = engine.getFusionHistory('BTCUSDT');
    expect(history.length).toBeLessThanOrEqual(100);
  });

  it('should provide timeframe statistics', () => {
    engine.submitSignal(createSignal('1h', 'BUY', 75));
    engine.submitSignal(createSignal('1h', 'BUY', 80, 'ETHUSDT'));
    engine.submitSignal(createSignal('4h', 'SELL', 70));

    const stats = engine.getTimeframeStats();
    const hourStats = stats.find(s => s.timeframe === '1h');

    expect(hourStats!.signalCount).toBe(2);
    expect(hourStats!.directionDistribution.BUY).toBe(2);
    expect(hourStats!.avgStrength).toBe(77.5);
  });

  // ── Cleanup Tests ────────────────────────────────────────────────

  it('should clear symbol data', () => {
    engine.submitSignal(createSignal('1h', 'BUY', 75));
    engine.submitSignal(createSignal('4h', 'BUY', 80));

    engine.clearSymbol('BTCUSDT');
    expect(engine.getCurrentSignals('BTCUSDT')).toHaveLength(0);
    expect(engine.getLatestFusion('BTCUSDT')).toBeNull();
  });

  it('should clear all data', () => {
    engine.submitSignal(createSignal('1h', 'BUY', 75, 'BTCUSDT'));
    engine.submitSignal(createSignal('1h', 'SELL', 70, 'ETHUSDT'));

    engine.clearAll();
    expect(engine.getSymbols()).toHaveLength(0);
  });

  it('should reset engine', () => {
    engine.submitSignal(createSignal('1h', 'BUY', 75));
    engine.on('fusion:result', () => {});

    engine.reset();
    expect(engine.getStatus()).toBe('idle');
    expect(engine.getSymbols()).toHaveLength(0);
    expect(engine.listenerCount('fusion:result')).toBe(0);
  });
});
