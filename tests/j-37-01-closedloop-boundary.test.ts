// J-37-01: ClosedLoopExecutor Boundary Tests
import {
  ClosedLoopExecutor,
  Signal,
} from '../electron/engine/analysis/closed-loop-executor';

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

describe('J-37-01 ClosedLoopExecutor Boundary', () => {
  it('B1: disabled executor rejects signal', () => {
    const exec = new ClosedLoopExecutor({ enabled: false });
    const result = exec.addSignal(makeSignal());
    expect(result.success).toBe(false);
    expect(result.error).toBe('Executor disabled');
  });

  it('B2: HOLD signal succeeds with IDLE state', () => {
    const exec = new ClosedLoopExecutor({ autoExecute: true, executionMode: 'immediate' });
    const result = exec.addSignal(makeSignal({ type: 'HOLD' }));
    expect(result.success).toBe(true);
    expect(result.state).toBe('IDLE');
  });

  it('B3: negative price handled without crash', () => {
    const exec = new ClosedLoopExecutor({ autoExecute: true });
    expect(() => exec.addSignal(makeSignal({ price: -100 }))).not.toThrow();
  });

  it('B4: zero price handled without crash', () => {
    const exec = new ClosedLoopExecutor({ autoExecute: true });
    expect(() => exec.addSignal(makeSignal({ price: 0 }))).not.toThrow();
  });

  it('B5: extremely large price handled without crash', () => {
    const exec = new ClosedLoopExecutor({ autoExecute: true, executionMode: 'immediate' });
    expect(() => exec.addSignal(makeSignal({ price: 999999999 }))).not.toThrow();
  });

  it('B6: empty signal ID handled', () => {
    const exec = new ClosedLoopExecutor({ autoExecute: true });
    expect(() => exec.addSignal(makeSignal({ id: '' }))).not.toThrow();
  });

  it('B7: max daily orders handled without crash', () => {
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
    expect(() => exec.addSignal(makeSignal())).not.toThrow();
  });

  it('B8: zero cooldown allows rapid signals', () => {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'immediate',
      cooldownMinutes: 0,
      requireConfirmation: false,
      riskCheckEnabled: false,
    });
    const r1 = exec.addSignal(makeSignal());
    const r2 = exec.addSignal(makeSignal());
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('B9: triggered mode returns VALIDATED', () => {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'triggered',
      requireConfirmation: false,
      riskCheckEnabled: false,
    });
    const result = exec.addSignal(makeSignal());
    expect(result.success).toBe(true);
    expect(result.state).toBe('VALIDATED');
  });

  it('B10: scheduled mode returns VALIDATED', () => {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'scheduled',
      requireConfirmation: false,
      riskCheckEnabled: false,
    });
    const result = exec.addSignal(makeSignal());
    expect(result.success).toBe(true);
    expect(result.state).toBe('VALIDATED');
  });

  it('B11: zero confidence handled', () => {
    const exec = new ClosedLoopExecutor({ autoExecute: true, riskCheckEnabled: false });
    expect(() => exec.addSignal(makeSignal({ confidence: 0 }))).not.toThrow();
  });

  it('B12: max confidence handled', () => {
    const exec = new ClosedLoopExecutor({ autoExecute: true, riskCheckEnabled: false });
    expect(() => exec.addSignal(makeSignal({ confidence: 100 }))).not.toThrow();
  });

  it('B13: risk check disabled bypasses preflight', () => {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'immediate',
      riskCheckEnabled: false,
      requireConfirmation: false,
    });
    const result = exec.addSignal(makeSignal({ price: 0.01 }));
    assert(!!(result.success===true || result.riskCheckPassed!==false), "L:125");
  });

  it('B14: getStats returns valid structure', () => {
    const exec = new ClosedLoopExecutor();
    exec.addSignal(makeSignal());
    const stats = exec.getStats();
    expect(typeof stats.totalSignals).toBe('number');
    expect(typeof stats.successRate).toBe('number');
  });

  it('B15: getLoops returns array', () => {
    const exec = new ClosedLoopExecutor();
    exec.addSignal(makeSignal());
    const loops = exec.getLoops();
    expect(Array.isArray(loops)).toBe(true);
  });

  it('B16: 20 rapid signals without crash', () => {
    const exec = new ClosedLoopExecutor({
      autoExecute: true,
      executionMode: 'immediate',
      riskCheckEnabled: false,
      requireConfirmation: false,
      cooldownMinutes: 0,
    });
    for (let i = 0; i < 20; i++) {
      expect(() => exec.addSignal(makeSignal({ code: `SYM${i}` }))).not.toThrow();
    }
  });
});