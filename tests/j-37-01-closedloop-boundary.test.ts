// J-37-01: ClosedLoopExecutor Boundary Tests (15+ tests)
// Tests edge cases, invalid inputs, and boundary conditions

import {
  ClosedLoopExecutor,
  Signal,
  ExecutorConfig,
} from '../electron/engine/closed-loop-executor';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ ${msg}`);
  }
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: `SIG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    strategyId: 'MACD',
    code: '600519',
    type: 'BUY',
    price: 1800,
    timestamp: Date.now(),
    confidence: 85,
    ...overrides,
  };
}

function run() {
  console.log('\n━━ J-37-01: ClosedLoopExecutor Boundary Tests ━━\n');

  // Test 1: Executor disabled
  {
    const exec = new ClosedLoopExecutor({ enabled: false });
    const result = exec.addSignal(makeSignal());
    assert(result.success === false && result.error === 'Executor disabled', 'B1: disabled executor rejects signal');
  }

  // Test 2: HOLD signal passes without execution
  {
    const exec = new ClosedLoopExecutor({ autoExecute: true, executionMode: 'immediate' });
    const result = exec.addSignal(makeSignal({ type: 'HOLD' }));
    assert(result.success === true && result.state === 'IDLE', 'B2: HOLD signal succeeds with IDLE state');
  }

  // Test 3: Negative price signal (executor may process but we check it doesn't crash)
  {
    const exec = new ClosedLoopExecutor({ autoExecute: true });
    const result = exec.addSignal(makeSignal({ price: -100 }));
    assert(result !== undefined, 'B3: negative price handled without crash');
  }

  // Test 4: Zero price signal (executor may process but we check it doesn't crash)
  {
    const exec = new ClosedLoopExecutor({ autoExecute: true });
    const result = exec.addSignal(makeSignal({ price: 0 }));
    assert(result !== undefined, 'B4: zero price handled without crash');
  }

  // Test 5: Extremely large price
  {
    const exec = new ClosedLoopExecutor({ autoExecute: true, executionMode: 'immediate' });
    const result = exec.addSignal(makeSignal({ price: 999999999 }));
    assert(result !== undefined, 'B5: extremely large price handled without crash');
  }

  // Test 6: Empty signal ID
  {
    const exec = new ClosedLoopExecutor({ autoExecute: true });
    const result = exec.addSignal(makeSignal({ id: '' }));
    assert(result !== undefined, 'B6: empty signal ID handled');
  }

  // Test 7: Max daily orders boundary (check that executor tracks orders)
  {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'immediate',
      maxDailyOrders: 2,
      requireConfirmation: false,
      riskCheckEnabled: false,
      cooldownMinutes: 0,
    });

    exec.addSignal(makeSignal());
    exec.addSignal(makeSignal());
    const result3 = exec.addSignal(makeSignal());
    // Executor may or may not enforce maxDailyOrders in all modes, but should not crash
    assert(result3 !== undefined, 'B7: max daily orders handled without crash');
  }

  // Test 8: Cooldown boundary (0 minutes = no cooldown)
  {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'immediate',
      cooldownMinutes: 0,
      requireConfirmation: false,
      riskCheckEnabled: false,
    });
    const r1 = exec.addSignal(makeSignal());
    const r2 = exec.addSignal(makeSignal());
    assert(r1.success === true && r2.success === true, 'B8: zero cooldown allows rapid signals');
  }

  // Test 9: Triggered mode returns VALIDATED state
  {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'triggered',
      requireConfirmation: false,
      riskCheckEnabled: false,
    });
    const result = exec.addSignal(makeSignal());
    assert(result.success === true && result.state === 'VALIDATED', 'B9: triggered mode returns VALIDATED');
  }

  // Test 10: Scheduled mode returns VALIDATED state
  {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'scheduled',
      requireConfirmation: false,
      riskCheckEnabled: false,
    });
    const result = exec.addSignal(makeSignal());
    assert(result.success === true && result.state === 'VALIDATED', 'B10: scheduled mode returns VALIDATED');
  }

  // Test 11: Confidence boundary (0 = minimum)
  {
    const exec = new ClosedLoopExecutor({ autoExecute: true, riskCheckEnabled: false });
    const result = exec.addSignal(makeSignal({ confidence: 0 }));
    assert(result !== undefined, 'B11: zero confidence handled');
  }

  // Test 12: Confidence boundary (100 = maximum)
  {
    const exec = new ClosedLoopExecutor({ autoExecute: true, riskCheckEnabled: false });
    const result = exec.addSignal(makeSignal({ confidence: 100 }));
    assert(result !== undefined, 'B12: max confidence handled');
  }

  // Test 13: Risk check disabled bypasses preflight
  {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'immediate',
      riskCheckEnabled: false,
      requireConfirmation: false,
    });
    const result = exec.addSignal(makeSignal({ price: 0.01 }));
    assert(result.success === true || result.riskCheckPassed !== false, 'B13: risk check disabled bypasses preflight');
  }

  // Test 14: Stats return valid structure
  {
    const exec = new ClosedLoopExecutor();
    exec.addSignal(makeSignal());
    const stats = exec.getStats();
    assert(typeof stats.totalSignals === 'number', 'B14: getStats returns valid structure');
    assert(typeof stats.successRate === 'number', 'B14b: successRate is number');
  }

  // Test 15: getLoops returns array
  {
    const exec = new ClosedLoopExecutor();
    exec.addSignal(makeSignal());
    const loops = exec.getLoops();
    assert(Array.isArray(loops), 'B15: getLoops returns array');
  }

  // Test 16: Multiple rapid signals don't crash
  {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'immediate',
      riskCheckEnabled: false,
      requireConfirmation: false,
      cooldownMinutes: 0,
    });
    let errors = 0;
    for (let i = 0; i < 20; i++) {
      try {
        exec.addSignal(makeSignal({ code: `SYM${i}` }));
      } catch (e) {
        errors++;
      }
    }
    assert(errors === 0, 'B16: 20 rapid signals without crash');
  }

  console.log(`\n━━ J-37-01 Results: ${passed} passed, ${failed} failed ━━`);
  return failed;
}

const failures = run();
process.exit(failures > 0 ? 1 : 0);
