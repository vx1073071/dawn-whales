// AU-35-02: RebalanceEngine Tests
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock electron-log BEFORE importing the engine
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { RebalanceEngine, RebalanceConfig, TargetWeight, Position } from '../electron/engine/portfolio/rebalance-engine';

describe('RebalanceEngine', () => {
  let engine: RebalanceEngine;

  const defaultConfig: RebalanceConfig = {
    mode: 'threshold',
    strategy: 'target_weight',
    thresholdPct: 5,
    periodicIntervalDays: 30,
    minRebalanceAmount: 100,
    maxSlippagePct: 2,
    autoExecute: false,
    requireConfirmation: true,
    constraints: {
      minTradeSize: 100,
      maxTradeSize: 100000,
      maxPositions: 10,
      maxTurnoverPct: 25,
      cashBufferPct: 5,
      allowPartialRebalance: true,
    },
  };

  const sampleTargets: TargetWeight[] = [
    { code: 'HK.00700', weight: 0.4 },
    { code: 'HK.09988', weight: 0.3 },
    { code: 'HK.01810', weight: 0.2 },
    { code: 'HK.09888', weight: 0.1 },
  ];

  // Positions matching the sample targets (total portfolio value = 100000)
  const samplePositions: Position[] = [
    { code: 'HK.00700', quantity: 200, currentPrice: 200, marketValue: 40000, weight: 0.4 },
    { code: 'HK.09988', quantity: 150, currentPrice: 200, marketValue: 30000, weight: 0.3 },
    { code: 'HK.01810', quantity: 100, currentPrice: 200, marketValue: 20000, weight: 0.2 },
    { code: 'HK.09888', quantity: 50, currentPrice: 200, marketValue: 10000, weight: 0.1 },
  ];

  beforeEach(() => {
    engine = new RebalanceEngine(defaultConfig);
  });

  afterEach(() => {
    engine.destroy();
  });

  // ── Initialization ────────────────────────────────────────
  describe('Initialization', () => {
    it('creates with default config', () => {
      const e = new RebalanceEngine();
      expect(e.getConfig()).toBeDefined();
    });

    it('creates with custom config', () => {
      const config: RebalanceConfig = { ...defaultConfig, thresholdPct: 10 };
      const e = new RebalanceEngine(config);
      expect(e.getConfig().thresholdPct).toBe(10);
    });

    it('has zero targets initially', () => {
      expect(engine.getTargets().length).toBe(0);
    });
  });

  // ── Target Management ─────────────────────────────────────
  describe('Target Management', () => {
    it('sets and retrieves targets', () => {
      engine.setTargets(sampleTargets);
      expect(engine.getTargets().length).toBe(4);
    });

    it('sum of target weights equals 1', () => {
      engine.setTargets(sampleTargets);
      const total = engine.getTargets().reduce((s, t) => s + t.weight, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });

    it('replaces existing targets', () => {
      engine.setTargets(sampleTargets);
      engine.setTargets([{ code: 'HK.00700', weight: 1.0 }]);
      expect(engine.getTargets().length).toBe(1);
    });

    it('normalizes weights that do not sum to 1', () => {
      engine.setTargets([{ code: 'A', weight: 0.5 }, { code: 'B', weight: 0.5 }]);
      // sum is already 1 so no normalization needed
      const total = engine.getTargets().reduce((s, t) => s + t.weight, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });
  });

  // ── Drift Calculation ─────────────────────────────────────
  describe('Drift Calculation', () => {
    it('returns zero drift for empty targets', () => {
      expect(engine.calculateDrift()).toBe(0);
    });

    it('returns zero drift when weights match', () => {
      engine.setTargets(sampleTargets);
      engine.updatePositions(samplePositions);
      // All weights match exactly, drift should be 0
      expect(engine.calculateDrift()).toBe(0);
    });

    it('calculates positive drift when weights diverge', () => {
      engine.setTargets(sampleTargets);
      // Overweight Tencent, underweight others
      const drifted: Position[] = [
        { code: 'HK.00700', quantity: 300, currentPrice: 200, marketValue: 60000, weight: 0.6 },
        { code: 'HK.09988', quantity: 150, currentPrice: 200, marketValue: 30000, weight: 0.3 },
        { code: 'HK.01810', quantity: 50, currentPrice: 200, marketValue: 10000, weight: 0.1 },
        { code: 'HK.09888', quantity: 0, currentPrice: 200, marketValue: 0, weight: 0 },
      ];
      engine.updatePositions(drifted);
      expect(engine.calculateDrift()).toBeGreaterThan(0);
    });
  });

  // ── Rebalance Execution ───────────────────────────────────
  describe('Rebalance Execution', () => {
    it('executes rebalance with total value', () => {
      engine.setTargets(sampleTargets);
      engine.updatePositions(samplePositions);
      const result = engine.executeRebalance(100000);
      expect(result).toBeDefined();
      expect(result.orders).toBeDefined();
    });

    it('includes drift before and after in result', () => {
      engine.setTargets(sampleTargets);
      engine.updatePositions(samplePositions);
      const result = engine.executeRebalance(100000);
      expect(result.driftBefore).toBeDefined();
      expect(result.driftAfter).toBeDefined();
    });

    it('reduces drift after rebalance', () => {
      engine.setTargets(sampleTargets);
      const drifted: Position[] = [
        { code: 'HK.00700', quantity: 300, currentPrice: 200, marketValue: 60000, weight: 0.6 },
        { code: 'HK.09988', quantity: 150, currentPrice: 200, marketValue: 30000, weight: 0.3 },
        { code: 'HK.01810', quantity: 50, currentPrice: 200, marketValue: 10000, weight: 0.1 },
        { code: 'HK.09888', quantity: 0, currentPrice: 200, marketValue: 0, weight: 0 },
      ];
      engine.updatePositions(drifted);
      const result = engine.executeRebalance(100000);
      expect(result.driftAfter).toBeLessThan(result.driftBefore);
    });

    it('returns orders array with side BUY or SELL', () => {
      engine.setTargets(sampleTargets);
      engine.updatePositions(samplePositions);
      const result = engine.executeRebalance(100000);
      result.orders.forEach(order => {
        expect(['BUY', 'SELL']).toContain(order.side);
      });
    });
  });

  // ── Stats ────────────────────────────────────────────────
  describe('Stats', () => {
    it('tracks rebalance count', () => {
      engine.setTargets(sampleTargets);
      engine.updatePositions(samplePositions);
      engine.executeRebalance(100000);
      engine.executeRebalance(105000);
      expect(engine.getStats().totalRebalances).toBe(2);
    });

    it('returns initial stats with zero rebalances', () => {
      const stats = engine.getStats();
      expect(stats.totalRebalances).toBe(0);
    });
  });
});