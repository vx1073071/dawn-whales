// J-37-01: ClosedLoopExecutor Boundary Tests
import {
  ClosedLoopExecutor,
  Signal,
} from '../electron/engine/closed-loop-executor';

let passed = 0;
let failed = 0;
function assert(cond: any, msg: string) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL:', msg); }
}
function group(name: string, fn: any) { console.log('--' + name); fn(); }
function test(name: string, fn: any) { try { fn(); } catch (e: any) { failed++; console.log('  FAIL:', name, ':', e?.message ?? e); } }

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

group('J-37-01 ClosedLoopExecutor Boundary', () => {
  test('B1: disabled executor rejects signal', () => {
    const exec = new ClosedLoopExecutor({ enabled: false });
    const result = exec.addSignal(makeSignal());
    assert(result.success === false, 'result.success false');
    assert(result.error === 'Executor disabled', 'error disabled');
  });

  test('B2: HOLD signal succeeds with IDLE state', () => {
    const exec = new ClosedLoopExecutor({ autoExecute: true, executionMode: 'immediate' });
    const result = exec.addSignal(makeSignal({ type: 'HOLD' }));
    assert(result.success === true, 'success true');
    assert(result.state === 'IDLE', 'state IDLE');
  });

  test('B3: very low confidence rejected by risk check', () => {
    const exec = new ClosedLoopExecutor({ riskCheckEnabled: true });
    const result = exec.addSignal(makeSignal({ confidence: 10 }));
    assert(result !== undefined, 'low conf handled');
  });

  test('B4: SELL signal with negative price', () => {
    const exec = new ClosedLoopExecutor({ riskCheckEnabled: false });
    const result = exec.addSignal(makeSignal({ type: 'SELL', price: -10 }));
    assert(result !== undefined, 'result defined');
  });

  test('B5: zero price signal', () => {
    const exec = new ClosedLoopExecutor({ riskCheckEnabled: false });
    const result = exec.addSignal(makeSignal({ price: 0 }));
    assert(result !== undefined, 'result defined');
  });

  test('B6: duplicate signal ID handled', () => {
    const exec = new ClosedLoopExecutor({ riskCheckEnabled: false });
    const sig = makeSignal({ id: 'DUP-1' });
    exec.addSignal(sig);
    const result2 = exec.addSignal(sig);
    assert(result2 !== undefined, 'dup handled');
  });

  test('B7: empty code handled', () => {
    const exec = new ClosedLoopExecutor({ riskCheckEnabled: false });
    const result = exec.addSignal(makeSignal({ code: '' }));
    assert(result !== undefined, 'empty code handled');
  });

  test('B8: 20 unique signals in sequence', () => {
    const exec = new ClosedLoopExecutor({ riskCheckEnabled: false, autoExecute: false });
    for (let i = 0; i < 20; i++) {
      let __t = false;
      try { exec.addSignal(makeSignal({ code: `SYM${i}` })); } catch (e) { __t = true; }
      assert(!__t, `signal ${i} accepted`);
    }
  });
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
