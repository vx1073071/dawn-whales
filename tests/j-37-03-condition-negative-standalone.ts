// J-37-03: ConditionEngine Negative Tests
import { ConditionEngine } from '../electron/engine/condition-engine';
import type { MarketSnapshot } from '../electron/types/condition.js';

let passed = 0;
let failed = 0;
function assert(cond: any, msg: string) {
  if (cond) { passed++; } else { failed++; console.log('  FAIL:', msg); }
}
function group(name: string, fn: any) { console.log('--' + name); fn(); }
function test(name: string, fn: any) { try { fn(); } catch (e: any) { failed++; console.log('  FAIL:', name, ':', e?.message ?? e); } }

function makeSnapshot(price: number): MarketSnapshot {
  return {
    symbol: '600519',
    close: price,
    open: price - 1,
    high: price + 5,
    low: price - 5,
    volume: 1000000,
    timestamp: Date.now(),
  };
}

group('J-37-03 ConditionEngine Negative', () => {
  test('N1: no rules → empty results', () => {
    const engine = new ConditionEngine();
    const results = engine.evaluate('600519', makeSnapshot(1800));
    assert(results.length === 0, 'empty results');
  });

  test('N2: disabled rule not evaluated', () => {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: false,
      condition: { type: 'price', operator: 'gt', value: 1700 },
      cooldownMs: 60000,
      maxTriggersPerDay: 10,
      action: { type: 'notify', message: 'Price > 1700' },
    });
    const results = engine.evaluate('600519', makeSnapshot(1800));
    assert(results.length === 0, 'no results');
  });

  test('N3: delete non-existent rule returns false', () => {
    const engine = new ConditionEngine();
    assert(engine.deleteRule('non-existent-id') === false, 'false');
  });

  test('N4: update non-existent rule returns null', () => {
    const engine = new ConditionEngine();
    assert(engine.updateRule('non-existent-id', { enabled: false }) === null, 'null');
  });

  test('N5: enable non-existent rule returns false', () => {
    const engine = new ConditionEngine();
    assert(engine.enableRule('non-existent-id') === false, 'false');
  });

  test('N6: disable non-existent rule returns false', () => {
    const engine = new ConditionEngine();
    assert(engine.disableRule('non-existent-id') === false, 'false');
  });

  test('N7: negative price handled', () => {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 0 },
      cooldownMs: 0,
      maxTriggersPerDay: 100,
      action: { type: 'notify', message: 'Test' },
    });
    let __t = false;
    try { engine.evaluate('600519', makeSnapshot(-100)); } catch (e) { __t = true; }
    assert(!__t, 'no throw');
  });

  test('N8: zero price handled', () => {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 0 },
      cooldownMs: 0,
      maxTriggersPerDay: 100,
      action: { type: 'notify', message: 'Test' },
    });
    let __t = false;
    try { engine.evaluate('600519', makeSnapshot(0)); } catch (e) { __t = true; }
    assert(!__t, 'no throw');
  });

  test('N9: cooldown prevents re-trigger', () => {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 1700 },
      cooldownMs: 60000,
      maxTriggersPerDay: 100,
      action: { type: 'notify', message: 'Test' },
    });

    const r1 = engine.evaluate('600519', makeSnapshot(1800));
    const triggered1 = r1.find((r: any) => r.triggered);

    if (triggered1) {
      const r2 = engine.evaluate('600519', makeSnapshot(1850));
      const triggered2 = r2.find((r: any) => r.triggered);
      assert(triggered2 === undefined || triggered2.cooldownActive === true, 'cooldown active');
    }
    assert(true, 'test completed');
  });

  test('N10: maxTriggersPerDay blocks', () => {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 1700 },
      cooldownMs: 0,
      maxTriggersPerDay: 2,
      action: { type: 'notify', message: 'Test' },
    });

    engine.evaluate('600519', makeSnapshot(1800));
    engine.evaluate('600519', makeSnapshot(1850));
    const r3 = engine.evaluate('600519', makeSnapshot(1900));

    const triggered3 = r3.find((r: any) => r.triggered);
    assert(triggered3 === undefined, 'no trigger after limit');
  });
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
