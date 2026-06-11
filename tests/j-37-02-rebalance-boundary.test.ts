// J-37-02: RebalanceEngine Boundary Tests
import { describe, it, expect } from 'vitest';
import { RebalanceEngine } from '../electron/engine/portfolio/rebalance-engine';

function makePositions(items: { code: string; quantity: number; price: number }[]) {
  const totalMV = items.reduce((s, i) => s + i.quantity * i.price, 0);
  return items.map(i => ({
    code: i.code,
    quantity: i.quantity,
    currentPrice: i.price,
    marketValue: i.quantity * i.price,
    weight: totalMV > 0 ? (i.quantity * i.price) / totalMV : 0,
  }));
}

describe('J-37-02 RebalanceEngine Boundary', () => {
  it('B1: empty targets accepted', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([]);
    expect(engine.getTargets().length).toBe(0);
  });

  it('B2: weights >1.0 normalized to ~1.0', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([{ code: 'A', weight: 0.6 }, { code: 'B', weight: 0.8 }]);
    const sum = engine.getTargets().reduce((s, t) => s + t.weight, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.02);
  });

  it('B3: weights <1.0 normalized to ~1.0', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([{ code: 'A', weight: 0.2 }, { code: 'B', weight: 0.3 }]);
    const sum = engine.getTargets().reduce((s, t) => s + t.weight, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.02);
  });

  it('B4: single asset weight = 1.0', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([{ code: 'SOLO', weight: 1.0 }]);
    expect(engine.getTargets()[0].weight).toBe(1.0);
  });

  it('B5: equal weights = 0.25 each', () => {
    const engine = new RebalanceEngine();
    engine.setEqualWeights(['A', 'B', 'C', 'D']);
    const targets = engine.getTargets();
    expect(targets.length).toBe(4);
    expect(Math.abs(targets[0].weight - 0.25)).toBeLessThan(0.001);
  });

  it('B6: empty positions cause drift > 0', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([{ code: 'A', weight: 0.5 }, { code: 'B', weight: 0.5 }]);
    engine.updatePositions([]);
    expect(engine.calculateDrift()).toBeGreaterThan(0);
  });

  it('B7: no targets → drift = 0', () => {
    const engine = new RebalanceEngine();
    engine.updatePositions(makePositions([{ code: 'A', quantity: 100, price: 50 }]));
    expect(engine.calculateDrift()).toBe(0);
  });

  it('B8: low drift → shouldRebalance = false', () => {
    const engine = new RebalanceEngine({ mode: 'threshold', thresholdPct: 5 });
    engine.setTargets([{ code: 'A', weight: 0.5 }, { code: 'B', weight: 0.5 }]);
    engine.updatePositions(makePositions([
      { code: 'A', quantity: 100, price: 50 },
      { code: 'B', quantity: 100, price: 50 },
    ]));
    expect(engine.shouldRebalance()).toBe(false);
  });

  it('B9: high drift → shouldRebalance = true', () => {
    const engine = new RebalanceEngine({ mode: 'threshold', thresholdPct: 5 });
    engine.setTargets([{ code: 'A', weight: 0.5 }, { code: 'B', weight: 0.5 }]);
    engine.updatePositions(makePositions([
      { code: 'A', quantity: 100, price: 100 },
      { code: 'B', quantity: 10, price: 10 },
    ]));
    expect(engine.shouldRebalance()).toBe(true);
  });

  it('B10: zero totalValue → empty or array orders', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([{ code: 'A', weight: 1.0 }]);
    expect(Array.isArray(engine.calculateRebalanceOrders(0))).toBe(true);
  });

  it('B11: zero weight asset included', () => {
    const engine = new RebalanceEngine();
    engine.setCustomWeights({ 'A': 0.5, 'B': 0.5, 'C': 0 });
    expect(engine.getTargets().length).toBe(3);
  });

  it('B12: max positions constraint stored', () => {
    const engine = new RebalanceEngine({
      constraints: {
        minTradeSize: 100,
        maxTradeSize: 100000,
        maxPositions: 2,
        maxTurnoverPct: 30,
        cashBufferPct: 5,
        allowPartialRebalance: true,
      },
    });
    engine.setTargets([
      { code: 'A', weight: 0.25 },
      { code: 'B', weight: 0.25 },
      { code: 'C', weight: 0.25 },
      { code: 'D', weight: 0.25 },
    ]);
    expect(engine.getTargets().length).toBe(4);
  });

  it('B13: getStats returns valid structure', () => {
    const engine = new RebalanceEngine();
    const stats = engine.getStats();
    expect(typeof stats.totalRebalances).toBe('number');
    expect(typeof stats.avgDriftBefore).toBe('number');
  });

  it('B14: manual trigger always true', () => {
    const engine = new RebalanceEngine({ mode: 'manual' });
    expect(engine.shouldRebalance('manual')).toBe(true);
  });

  it('B15: signal trigger always true', () => {
    const engine = new RebalanceEngine({ mode: 'signal' });
    expect(engine.shouldRebalance('signal')).toBe(true);
  });

  it('B16: periodic trigger returns boolean', () => {
    const engine = new RebalanceEngine({ mode: 'periodic', periodicIntervalDays: 30 });
    const result = engine.shouldRebalance('periodic');
    expect(typeof result).toBe('boolean');
  });

  it('B17: getPosition for non-existent returns undefined', () => {
    const engine = new RebalanceEngine();
    expect(engine.getPosition('NONEXISTENT')).toBeUndefined();
  });
});