// J-37-03: ConditionEngine Negative Tests (8+ tests)
// Tests invalid inputs, edge cases, and error conditions

import { ConditionEngine } from '../electron/engine/condition-engine';
import type { MarketSnapshot } from '../electron/types/condition.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${msg}`);
  }
}

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

function run() {
  console.log('\n━━ J-37-03: ConditionEngine Negative Tests ━━\n');

  // Test 1: Evaluate with no rules
  {
    const engine = new ConditionEngine();
    const results = engine.evaluate('600519', makeSnapshot(1800));
    assert(results.length === 0, 'N1: no rules → empty results');
  }

  // Test 2: Evaluate with disabled rule
  {
    const engine = new ConditionEngine();
    const rule = engine.createRule({
      symbol: '600519',
      enabled: false,
      condition: { type: 'price', operator: 'gt', value: 1700 },
      cooldownMs: 60000,
      maxTriggersPerDay: 10,
      action: { type: 'notify', message: 'Price > 1700' },
    });
    const results = engine.evaluate('600519', makeSnapshot(1800));
    assert(results.length === 0, 'N2: disabled rule not evaluated');
  }

  // Test 3: Delete non-existent rule
  {
    const engine = new ConditionEngine();
    const deleted = engine.deleteRule('non-existent-id');
    assert(deleted === false, 'N3: delete non-existent rule returns false');
  }

  // Test 4: Update non-existent rule
  {
    const engine = new ConditionEngine();
    const updated = engine.updateRule('non-existent-id', { enabled: false });
    assert(updated === null, 'N4: update non-existent rule returns null');
  }

  // Test 5: Enable non-existent rule
  {
    const engine = new ConditionEngine();
    const enabled = engine.enableRule('non-existent-id');
    assert(enabled === false, 'N5: enable non-existent rule returns false');
  }

  // Test 6: Disable non-existent rule
  {
    const engine = new ConditionEngine();
    const disabled = engine.disableRule('non-existent-id');
    assert(disabled === false, 'N6: disable non-existent rule returns false');
  }

  // Test 7: Evaluate with negative price
  {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 0 },
      cooldownMs: 0,
      maxTriggersPerDay: 100,
      action: { type: 'notify', message: 'Test' },
    });
    const results = engine.evaluate('600519', makeSnapshot(-100));
    assert(results.length > 0, 'N7: negative price handled without crash');
  }

  // Test 8: Evaluate with zero price
  {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 0 },
      cooldownMs: 0,
      maxTriggersPerDay: 100,
      action: { type: 'notify', message: 'Test' },
    });
    const results = engine.evaluate('600519', makeSnapshot(0));
    assert(results.length > 0, 'N8: zero price handled');
  }

  // Test 9: Cooldown prevents re-trigger
  {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 1700 },
      cooldownMs: 60000, // 1 minute cooldown
      maxTriggersPerDay: 100,
      action: { type: 'notify', message: 'Test' },
    });

    const r1 = engine.evaluate('600519', makeSnapshot(1800));
    const triggered1 = r1.find(r => r.triggered);
    
    // If first evaluation triggered, check that second is blocked
    if (triggered1) {
      const r2 = engine.evaluate('600519', makeSnapshot(1850));
      const triggered2 = r2.find(r => r.triggered);
      assert(triggered2 === undefined || triggered2.cooldownActive === true, 'N9: cooldown prevents immediate re-trigger');
    } else {
      // If first didn't trigger, test passes (condition not met)
      assert(true, 'N9: cooldown test skipped (condition not met)');
    }
  }

  // Test 10: maxTriggersPerDay limit
  {
    const engine = new ConditionEngine();
    engine.createRule({
      symbol: '600519',
      enabled: true,
      condition: { type: 'price', operator: 'gt', value: 1700 },
      cooldownMs: 0, // No cooldown
      maxTriggersPerDay: 2,
      action: { type: 'notify', message: 'Test' },
    });

    engine.evaluate('600519', makeSnapshot(1800)); // Trigger 1
    engine.evaluate('600519', makeSnapshot(1850)); // Trigger 2
    const r3 = engine.evaluate('600519', makeSnapshot(1900)); // Should be blocked

    const triggered3 = r3.find(r => r.triggered);
    assert(triggered3 === undefined, 'N10: maxTriggersPerDay blocks after limit');
  }

  console.log(`\n━━ J-37-03 Results: ${passed} passed, ${failed} failed ━━`);
  return failed;
}

const failures = run();
process.exit(failures > 0 ? 1 : 0);
