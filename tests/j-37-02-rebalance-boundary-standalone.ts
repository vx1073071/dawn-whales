// J-37-02: RebalanceEngine Boundary Tests
import { RebalanceEngine } from '../electron/engine/rebalance-engine';

let passed = 0;
let failed = 0;
function assert(cond: any, msg: string) {
  if (cond) { passed++; } else { failed++; console.log('  FAIL:', msg); }
}
function group(name: string, fn: any) { console.log('--' + name); fn(); }
function test(name: string, fn: any) { try { fn(); } catch (e: any) { failed++; console.log('  FAIL:', name, ':', e?.message ?? e); } }

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

group('J-37-02 RebalanceEngine Boundary', () => {
  test('B1: empty targets accepted', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([]);
    assert(engine.getTargets().length === 0, 'targets empty');
  });

  test('B2: weights >1.0 normalized', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([{ code: 'A', weight: 0.6 }, { code: 'B', weight: 0.8 }]);
    const sum = engine.getTargets().reduce((s, t) => s + t.weight, 0);
    assert(Math.abs(sum - 1.0) < 0.02, 'sum near 1.0');
  });

  test('B3: weights <1.0 normalized', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([{ code: 'A', weight: 0.2 }, { code: 'B', weight: 0.3 }]);
    const sum = engine.getTargets().reduce((s, t) => s + t.weight, 0);
    assert(Math.abs(sum - 1.0) < 0.02, 'sum near 1.0');
  });

  test('B4: single asset weight = 1.0', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([{ code: 'SOLO', weight: 1.0 }]);
    assert(engine.getTargets()[0].weight === 1.0, 'weight 1.0');
  });

  test('B5: equal weights', () => {
    const engine = new RebalanceEngine();
    engine.setEqualWeights(['A', 'B', 'C', 'D']);
    const targets = engine.getTargets();
    assert(targets.length === 4, '4 targets');
    assert(Math.abs(targets[0].weight - 0.25) < 0.001, 'weight 0.25');
  });

  test('B6: empty positions cause drift > 0', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([{ code: 'A', weight: 0.5 }, { code: 'B', weight: 0.5 }]);
    engine.updatePositions([]);
    assert(engine.calculateDrift() > 0, 'drift > 0');
  });

  test('B7: no targets → drift = 0', () => {
    const engine = new RebalanceEngine();
    engine.updatePositions(makePositions([{ code: 'A', quantity: 100, price: 50 }]));
    assert(engine.calculateDrift() === 0, 'drift 0');
  });

  test('B8: low drift → shouldRebalance = false', () => {
    const engine = new RebalanceEngine({ mode: 'threshold', thresholdPct: 5 });
    engine.setTargets([{ code: 'A', weight: 0.5 }, { code: 'B', weight: 0.5 }]);
    engine.updatePositions(makePositions([
      { code: 'A', quantity: 100, price: 50 },
      { code: 'B', quantity: 100, price: 50 },
    ]));
    assert(engine.shouldRebalance() === false, 'no rebalance');
  });

  test('B9: high drift → shouldRebalance = true', () => {
    const engine = new RebalanceEngine({ mode: 'threshold', thresholdPct: 5 });
    engine.setTargets([{ code: 'A', weight: 0.5 }, { code: 'B', weight: 0.5 }]);
    engine.updatePositions(makePositions([
      { code: 'A', quantity: 100, price: 100 },
      { code: 'B', quantity: 10, price: 10 },
    ]));
    assert(engine.shouldRebalance() === true, 'rebalance');
  });

  test('B10: zero totalValue orders is array', () => {
    const engine = new RebalanceEngine();
    engine.setTargets([{ code: 'A', weight: 1.0 }]);
    assert(Array.isArray(engine.calculateRebalanceOrders(0)), 'orders array');
  });

  test('B11: zero weight asset included', () => {
    const engine = new RebalanceEngine();
    engine.setCustomWeights({ 'A': 0.5, 'B': 0.5, 'C': 0 });
    assert(engine.getTargets().length === 3, '3 targets');
  });

  test('B12: max positions constraint', () => {
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
    assert(engine.getTargets().length === 4, '4 targets stored');
  });

  test('B13: getStats structure', () => {
    const engine = new RebalanceEngine();
    const stats = engine.getStats();
    assert(typeof stats.totalRebalances === 'number', 'totalRebalances is number');
    assert(typeof stats.avgDriftBefore === 'number', 'avgDriftBefore is number');
  });

  test('B14: manual trigger true', () => {
    const engine = new RebalanceEngine({ mode: 'manual' });
    assert(engine.shouldRebalance('manual') === true, 'manual true');
  });

  test('B15: signal trigger true', () => {
    const engine = new RebalanceEngine({ mode: 'signal' });
    assert(engine.shouldRebalance('signal') === true, 'signal true');
  });

  test('B16: periodic trigger returns boolean', () => {
    const engine = new RebalanceEngine({ mode: 'periodic', periodicIntervalDays: 30 });
    const result = engine.shouldRebalance('periodic');
    assert(typeof result === 'boolean', 'result boolean');
  });

  test('B17: getPosition non-existent returns undefined', () => {
    const engine = new RebalanceEngine();
    assert(engine.getPosition('NONEXISTENT') === undefined, 'undefined');
  });
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
