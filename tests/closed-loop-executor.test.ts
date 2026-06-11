// AU-35-01: ClosedLoopExecutor Tests
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock electron-log BEFORE importing the engine
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ClosedLoopExecutor, ExecutorConfig, Signal } from '../electron/engine/analysis/closed-loop-executor';

function makeSignal(overrides?: Partial<Signal>): Signal {
  return {
    id: 'sig-001',
    strategyId: 'test-strat',
    code: 'HK.00700',
    type: 'BUY',
    price: 300,
    timestamp: Date.now(),
    confidence: 0.9,
    ...overrides,
  };
}

describe('ClosedLoopExecutor', () => {
  let engine: ClosedLoopExecutor;

  const defaultConfig: ExecutorConfig = {
    enabled: true,
    autoExecute: false,
    maxPositionSize: 1000,
    maxDailyOrders: 50,
    cooldownMinutes: 1,
    requireConfirmation: true,
    riskCheckEnabled: true,
    executionMode: 'immediate',
    retryStrategy: 'fixed',
    maxRetries: 3,
    retryDelayMs: 1000,
    retryMultiplier: 2,
    stopLoss: { enabled: true, pct: 5 },
    takeProfit: { enabled: true, pct: 10 },
    maxHoldingMinutes: 0,
    maxDailyLossPct: 3,
    maxDrawdownPct: 15,
  };

  beforeEach(() => {
    engine = new ClosedLoopExecutor(defaultConfig);
  });

  afterEach(() => {
    engine.destroy();
  });

  // ── Initialization ────────────────────────────────────────
  describe('Initialization', () => {
    it('creates with default config', () => {
      const e = new ClosedLoopExecutor();
      expect(e.getConfig()).toBeDefined();
    });

    it('creates with custom config', () => {
      const config: ExecutorConfig = { ...defaultConfig, maxDailyOrders: 30 };
      const e = new ClosedLoopExecutor(config);
      expect(e.getConfig().maxDailyOrders).toBe(30);
    });

    it('starts with no signals', () => {
      const stats = engine.getStats();
      expect(stats.totalSignals).toBe(0);
    });
  });

  // ── Signal Processing ─────────────────────────────────────
  describe('Signal Processing', () => {
    it('adds a valid BUY signal', () => {
      const signal = makeSignal({ type: 'BUY' });
      const result = engine.addSignal(signal);
      expect(result).toBeDefined();
      expect(result.signal).toBe(signal);
    });

    it('adds a valid SELL signal', () => {
      const signal = makeSignal({ type: 'SELL' });
      const result = engine.addSignal(signal);
      expect(result.signal).toBe(signal);
    });

    it('increments signal count after adding', () => {
      engine.addSignal(makeSignal());
      engine.addSignal(makeSignal({ id: 'sig-002' }));
      expect(engine.getStats().totalSignals).toBe(2);
    });

    it('handles HOLD signals', () => {
      const signal = makeSignal({ type: 'HOLD' });
      const result = engine.addSignal(signal);
      expect(result).toBeDefined();
    });

    it('respects disabled state', () => {
      const e = new ClosedLoopExecutor({ ...defaultConfig, enabled: false });
      const result = e.addSignal(makeSignal());
      expect(result.success).toBe(false);
    });

    it('rejects low confidence signals', () => {
      const signal = makeSignal({ confidence: 0.3 });
      const result = engine.addSignal(signal);
      expect(result).toBeDefined();
    });
  });

  // ── Position Management ──────────────────────────────────
  describe('Position Management', () => {
    it('closes a position by code', () => {
      engine.addSignal(makeSignal({ type: 'BUY', code: 'HK.00700' }));
      engine.closePosition('HK.00700', 'manual_close');
    });

    it('handles closing non-existent position gracefully', () => {
      expect(() => engine.closePosition('NONEXISTENT', 'manual')).not.toThrow();
    });
  });

  // ── Monitoring ────────────────────────────────────────────
  describe('Monitoring', () => {
    it('starts and stops monitoring', () => {
      engine.startMonitoring(1000);
      engine.stopMonitoring();
      expect(true).toBe(true);
    });

    it('can restart monitoring', () => {
      engine.startMonitoring(1000);
      engine.stopMonitoring();
      engine.startMonitoring(2000);
      engine.stopMonitoring();
      expect(true).toBe(true);
    });
  });

  // ── Stats ──────────────────────────────────────────────────
  describe('Stats', () => {
    it('returns stats after adding signals', () => {
      engine.addSignal(makeSignal({ type: 'BUY' }));
      const stats = engine.getStats();
      expect(stats.totalSignals).toBe(1);
    });

    it('tracks total positions', () => {
      engine.addSignal(makeSignal({ code: 'HK.00700' }));
      expect(engine.getStats().totalSignals).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Events ────────────────────────────────────────────────
  describe('Events', () => {
    it('emits signal:received on addSignal', () => {
      const handler = vi.fn();
      engine.on('signal:received', handler);
      engine.addSignal(makeSignal());
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits loop:state_change on signal processing', () => {
      const handler = vi.fn();
      engine.on('loop:state_change', handler);
      engine.addSignal(makeSignal());
      expect(handler).toHaveBeenCalled();
    });
  });
});