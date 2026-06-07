/**
 * J-53-03: Copy Trade Executor Tests (20+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CopyTradeExecutor,
  PositionSizer,
  SlippageGuard,
  getCopyTradeExecutor,
  resetCopyTradeExecutor,
} from '../electron/engine/copy-trade-executor';

function mkConfig(overrides: Record<string, any> = {}) {
  return {
    followerId: 'follower_1',
    leaderId: 'leader_1',
    leaderName: 'ProTrader',
    mode: 'proportional' as const,
    amount: 10, // 10% of equity
    maxPositionSize: 5000,
    maxTotalExposure: 20000,
    stopLossPct: 5,
    maxDrawdownPct: 15,
    maxSlippagePct: 2,
    enabled: true,
    ...overrides,
  };
}

function mkExecParams(configId: string, overrides: Record<string, any> = {}) {
  return {
    configId,
    signalId: 'sig_1',
    symbol: 'AAPL',
    side: 'buy' as const,
    signalPrice: 150,
    actualPrice: 150.5,
    accountEquity: 50000,
    currentExposure: 0,
    ...overrides,
  };
}

// ── Section 1: PositionSizer ────────────────────────────────────────────

describe('J-53-03-01: PositionSizer', () => {
  let sizer: PositionSizer;
  beforeEach(() => { sizer = new PositionSizer(); });

  it('A01: fixed mode returns exact amount', () => {
    const r = sizer.calculate({ mode: 'fixed', amount: 1000, price: 100, accountEquity: 50000, currentExposure: 0, maxPositionSize: 5000, maxTotalExposure: 20000 });
    expect(r.positionValue).toBe(1000);
    expect(r.quantity).toBe(10);
  });

  it('A02: proportional mode scales with equity', () => {
    const r = sizer.calculate({ mode: 'proportional', amount: 10, price: 50, accountEquity: 100000, currentExposure: 0, maxPositionSize: 50000, maxTotalExposure: 100000 });
    expect(r.positionValue).toBe(10000); // 10% of 100k
    expect(r.quantity).toBe(200);
  });

  it('A03: kelly mode uses win rate', () => {
    const r = sizer.calculate({ mode: 'kelly', amount: 10, price: 50, accountEquity: 100000, currentExposure: 0, maxPositionSize: 50000, maxTotalExposure: 100000, winRate: 0.6, avgWinLossRatio: 2.0 });
    expect(r.kellyFraction).toBeGreaterThan(0);
    expect(r.positionValue).toBeGreaterThan(0);
  });

  it('A04: caps at max position size', () => {
    const r = sizer.calculate({ mode: 'fixed', amount: 10000, price: 100, accountEquity: 50000, currentExposure: 0, maxPositionSize: 3000, maxTotalExposure: 20000 });
    expect(r.positionValue).toBeLessThanOrEqual(3000);
    expect(r.capped).toBe(true);
  });

  it('A05: caps at remaining exposure', () => {
    const r = sizer.calculate({ mode: 'fixed', amount: 5000, price: 100, accountEquity: 50000, currentExposure: 18000, maxPositionSize: 10000, maxTotalExposure: 20000 });
    expect(r.positionValue).toBeLessThanOrEqual(2000);
    expect(r.capped).toBe(true);
  });

  it('A06: rejects zero price', () => {
    const r = sizer.calculate({ mode: 'fixed', amount: 1000, price: 0, accountEquity: 50000, currentExposure: 0, maxPositionSize: 5000, maxTotalExposure: 20000 });
    expect(r.quantity).toBe(0);
  });
});

// ── Section 2: SlippageGuard ────────────────────────────────────────────

describe('J-53-03-02: SlippageGuard', () => {
  let guard: SlippageGuard;
  beforeEach(() => { guard = new SlippageGuard(); });

  it('B01: accepts within limit', () => {
    const r = guard.check(100, 101, 2);
    expect(r.acceptable).toBe(true);
    expect(r.slippagePct).toBe(1);
  });

  it('B02: rejects above limit', () => {
    const r = guard.check(100, 105, 2);
    expect(r.acceptable).toBe(false);
    expect(r.slippagePct).toBe(5);
  });

  it('B03: handles negative slippage (better price)', () => {
    const r = guard.check(100, 99, 2);
    expect(r.acceptable).toBe(true);
    expect(r.slippagePct).toBe(1);
  });
});

// ── Section 3: CopyTradeExecutor Core ────────────────────────────────────

describe('J-53-03-03: CopyTradeExecutor', () => {
  let executor: CopyTradeExecutor;

  beforeEach(() => {
    resetCopyTradeExecutor();
    executor = getCopyTradeExecutor();
  });

  it('C01: addConfig returns valid id', () => {
    const id = executor.addConfig(mkConfig());
    expect(id.startsWith('copy_')).toBe(true);
  });

  it('C02: getConfig returns config', () => {
    const id = executor.addConfig(mkConfig());
    const c = executor.getConfig(id);
    expect(c).not.toBeNull();
    expect(c!.leaderName).toBe('ProTrader');
  });

  it('C03: executeSignal creates order', () => {
    const id = executor.addConfig(mkConfig());
    const order = executor.executeSignal(mkExecParams(id));
    expect(order).not.toBeNull();
    expect(order!.status).toBe('filled');
    expect(order!.quantity).toBeGreaterThan(0);
  });

  it('C04: rejects when config disabled', () => {
    const id = executor.addConfig(mkConfig({ enabled: false }));
    expect(executor.executeSignal(mkExecParams(id))).toBeNull();
  });

  it('C05: rejects on excessive slippage', () => {
    const id = executor.addConfig(mkConfig({ maxSlippagePct: 0.5 }));
    expect(executor.executeSignal(mkExecParams(id, { actualPrice: 155 }))).toBeNull(); // 3.3% slippage
  });

  it('C06: stop loss calculated for buy orders', () => {
    const id = executor.addConfig(mkConfig({ stopLossPct: 5 }));
    const order = executor.executeSignal(mkExecParams(id, { signalPrice: 100, actualPrice: 100 }));
    expect(order!.stopLoss).toBe(95);
  });

  it('C07: closePosition calculates PnL', () => {
    const id = executor.addConfig(mkConfig());
    const order = executor.executeSignal(mkExecParams(id, { signalPrice: 100, actualPrice: 100 }));
    executor.closePosition(order!.id, 110);
    const orders = executor.getOrders(id);
    const closed = orders.find(o => o.id === order!.id);
    expect(closed!.pnl).toBeGreaterThan(0);
    expect(closed!.pnlPct).toBe(10);
  });

  it('C08: getSummary returns stats', () => {
    const id = executor.addConfig(mkConfig());
    executor.executeSignal(mkExecParams(id, { signalId: 's1', symbol: 'AAPL' }));
    executor.executeSignal(mkExecParams(id, { signalId: 's2', symbol: 'MSFT', actualPrice: 200, signalPrice: 200 }));

    const summary = executor.getSummary(id);
    expect(summary).not.toBeNull();
    expect(summary!.totalOrders).toBe(2);
    expect(summary!.filledOrders).toBe(2);
    expect(summary!.status).toBe('active');
  });

  it('C09: drawdown auto-stops execution', () => {
    const id = executor.addConfig(mkConfig({ maxDrawdownPct: 10 }));
    // First order sets peak at 100000
    const o1 = executor.executeSignal(mkExecParams(id, { accountEquity: 100000, signalPrice: 150, actualPrice: 150 }));
    expect(o1).not.toBeNull();
    // Second order with 20% drawdown (equity=80000, peak=100000)
    const result = executor.executeSignal(mkExecParams(id, { accountEquity: 80000, signalId: 's2', signalPrice: 150, actualPrice: 150 }));
    expect(result).toBeNull();
    expect(executor.getStatus(id)).toBe('stopped');
  });

  it('C10: pause/resume works', () => {
    const id = executor.addConfig(mkConfig());
    executor.pause(id);
    expect(executor.getStatus(id)).toBe('paused');
    executor.resume(id);
    expect(executor.getStatus(id)).toBe('active');
  });
});

// ── Section 4: Lifecycle & Singleton ────────────────────────────────────

describe('J-53-03-04: Lifecycle & Singleton', () => {
  beforeEach(() => { resetCopyTradeExecutor(); });

  it('D01: singleton returns same instance', () => {
    const a = getCopyTradeExecutor();
    const b = getCopyTradeExecutor();
    expect(a).toBe(b);
  });

  it('D02: reset clears everything', () => {
    const e = getCopyTradeExecutor();
    e.addConfig(mkConfig());
    resetCopyTradeExecutor();
    expect(getCopyTradeExecutor().getConfigsByFollower('follower_1').length).toBe(0);
  });

  it('D03: removeConfig works', () => {
    const e = getCopyTradeExecutor();
    const id = e.addConfig(mkConfig());
    expect(e.removeConfig(id)).toBe(true);
    expect(e.getConfig(id)).toBeNull();
  });

  it('D04: getConfigsByFollower filters correctly', () => {
    const e = getCopyTradeExecutor();
    e.addConfig(mkConfig({ followerId: 'f1' }));
    e.addConfig(mkConfig({ followerId: 'f2' }));
    e.addConfig(mkConfig({ followerId: 'f1', leaderId: 'l2' }));
    expect(e.getConfigsByFollower('f1').length).toBe(2);
    expect(e.getConfigsByFollower('f2').length).toBe(1);
  });
});
