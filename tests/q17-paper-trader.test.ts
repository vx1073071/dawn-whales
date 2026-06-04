// Q17: Paper Trader — Unit Tests
// Tests: fill simulation, slippage, position tracking, trade recording, performance

import { describe, it, expect, beforeEach } from 'vitest';
import { PaperTrader, initPaperTrader } from '../electron/engine/paper-trader';
import type { LiveOrder } from '../electron/engine/live-executor';
import type { QuoteTick } from '../electron/engine/quote-stream';

// Helper: make a market BUY order
function makeOrder(overrides: Partial<LiveOrder> = {}): LiveOrder {
  return {
    id: `order_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    symbol: 'SZ.000001',
    side: 'BUY',
    type: 'MARKET',
    quantity: 1000,
    price: 10.0,
    filledQty: 0,
    status: 'PENDING',
    strategyId: 'test-strategy',
    createdAt: Date.now(),
    ...overrides,
  };
}

// Helper: make a quote tick
function makeQuote(code: string, price: number): QuoteTick {
  return {
    code,
    name: code,
    price,
    open: price,
    high: price * 1.01,
    low: price * 0.99,
    close: price,
    volume: 1000000,
    turnover: price * 1000000,
    timestamp: Date.now(),
  };
}

describe('Q17: Paper Trader', () => {
  let trader: PaperTrader;

  beforeEach(() => {
    // Fresh instance for each test
    trader = new PaperTrader({ capital: 1000000, slippageBps: 5 });
    trader.start();
  });

  // ── Account ─────────────────────────────────────────────────

  it('should initialize with correct default account', () => {
    const acc = trader.getAccount();
    expect(acc.capital).toBe(1000000);
    expect(acc.slippageBps).toBe(5);
    expect(acc.commissionRate).toBe(0.0003);
    expect(acc.stampDutyRate).toBe(0.001);
    expect(acc.initialCapital).toBe(1000000);
  });

  it('should accept custom account config', () => {
    const custom = new PaperTrader({ capital: 500000, slippageBps: 10 });
    const acc = custom.getAccount();
    expect(acc.capital).toBe(500000);
    expect(acc.slippageBps).toBe(10);
  });

  // ── Market Order Fill ─────────────────────────────────────

  it('should fill market BUY order immediately with slippage', () => {
    const order = makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 });
    trader.submitOrder(order);

    const positions = trader.getPositions();
    expect(positions).toHaveLength(1);
    const pos = positions[0];
    expect(pos.symbol).toBe('SZ.000001');
    expect(pos.quantity).toBe(1000);
    // Fill price includes slippage: 10 * (1 + 0.0005) = 10.005
    expect(pos.avgCost).toBeCloseTo(10.005, 3);
  });

  it('should fill market SELL order with correct slippage direction', () => {
    // First open a long position
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    trader.submitOrder(makeOrder({ side: 'SELL', symbol: 'SZ.000001', price: 12.0, quantity: 1000 }));

    const positions = trader.getPositions();
    expect(positions).toHaveLength(0); // fully closed

    const trades = trader.getTrades();
    expect(trades).toHaveLength(1);
    // SELL slippage: 12 * (1 - 0.0005) = 11.994
    expect(trades[0].exitPrice).toBeCloseTo(11.994, 3);
  });

  it('should calculate correct commission on fill', () => {
    const order = makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 });
    trader.submitOrder(order);

    const fills = trader.getFills();
    expect(fills).toHaveLength(1);
    // commission = 10.005 * 1000 * 0.0003 = 3.0015
    expect(fills[0].commission).toBeCloseTo(3.0015, 2);
    expect(fills[0].slippage).toBeCloseTo(5.0, 1); // 0.0005 * 1000 = 5
  });

  it('should charge stamp duty only on SELL', () => {
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    trader.submitOrder(makeOrder({ side: 'SELL', symbol: 'SZ.000001', price: 12.0, quantity: 1000 }));

    const fills = trader.getFills();
    const sellFill = fills[1];
    expect(sellFill.stampDuty).toBeGreaterThan(0);
    // stampDuty = 11.994 * 1000 * 0.001 = 11.994
    expect(sellFill.stampDuty).toBeCloseTo(11.994, 2);
  });

  // ── Limit Order ─────────────────────────────────────────────

  it('should not fill limit order immediately', () => {
    const order = makeOrder({ type: 'LIMIT', side: 'BUY', symbol: 'SZ.000001', price: 9.5, quantity: 1000 });
    const id = trader.submitOrder(order);
    expect(id).toBeTruthy();

    const positions = trader.getPositions();
    expect(positions).toHaveLength(0); // not filled yet
  });

  it('should fill limit BUY when price drops to or below limit price', () => {
    const order = makeOrder({ type: 'LIMIT', side: 'BUY', symbol: 'SZ.000001', price: 9.5, quantity: 1000 });
    trader.submitOrder(order);

    // Price drops to limit price — should trigger fill
    trader.onQuotes([makeQuote('SZ.000001', 9.5)]);

    const positions = trader.getPositions();
    expect(positions).toHaveLength(1);
    // Fill price = 9.5 * (1 + 0.0005) = 9.50475
    expect(positions[0].avgCost).toBeCloseTo(9.50475, 4);
  });

  it('should fill limit SELL when price rises to or above limit price', () => {
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    const order = makeOrder({ type: 'LIMIT', side: 'SELL', symbol: 'SZ.000001', price: 12.0, quantity: 1000 });
    trader.submitOrder(order);

    trader.onQuotes([makeQuote('SZ.000001', 12.0)]);

    const positions = trader.getPositions();
    expect(positions).toHaveLength(0); // fully closed
  });

  it('should cancel pending limit order', () => {
    const order = makeOrder({ type: 'LIMIT', side: 'BUY', symbol: 'SZ.000001', price: 9.5, quantity: 1000 });
    trader.submitOrder(order);

    const cancelled = trader.cancelOrder(order.id);
    expect(cancelled).toBe(true);

    // Price hits limit — should NOT fill (cancelled)
    trader.onQuotes([makeQuote('SZ.000001', 9.5)]);
    expect(trader.getPositions()).toHaveLength(0);
  });

  // ── Position Management ───────────────────────────────────

  it('should average into existing position on second BUY', () => {
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 11.0, quantity: 1000 }));

    const positions = trader.getPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].quantity).toBe(2000);
    // Avg cost = (10.005*1000 + 11.0055*1000) / 2000 = 10.505
    expect(positions[0].avgCost).toBeCloseTo(10.505, 3);
  });

  it('should partially close on partial SELL', () => {
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    trader.submitOrder(makeOrder({ side: 'SELL', symbol: 'SZ.000001', price: 12.0, quantity: 400 }));

    const positions = trader.getPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].quantity).toBe(600);
  });

  it('should fully close when SELL quantity >= position quantity', () => {
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    trader.submitOrder(makeOrder({ side: 'SELL', symbol: 'SZ.000001', price: 12.0, quantity: 1500 }));

    expect(trader.getPositions()).toHaveLength(0);
    expect(trader.getTrades()).toHaveLength(1);
  });

  // ── Unrealized P&L ───────────────────────────────────────

  it('should update unrealized P&L on quote tick', () => {
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    trader.onQuotes([makeQuote('SZ.000001', 11.0)]);

    const positions = trader.getPositions();
    expect(positions[0].unrealizedPnL).toBeCloseTo(995, 0); // (11 - 10.005) * 1000
    expect(positions[0].unrealizedPnLPct).toBeGreaterThan(9);
  });

  // ── Reset ────────────────────────────────────────────────

  it('should reset all state on reset()', () => {
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    trader.reset();

    expect(trader.getPositions()).toHaveLength(0);
    expect(trader.getFills()).toHaveLength(0);
    expect(trader.getTrades()).toHaveLength(0);
    expect(trader.getAccount().capital).toBe(1000000);
  });

  // ── Report ────────────────────────────────────────────────

  it('should generate correct report structure', () => {
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    const report = trader.getReport();

    expect(report.success).toBe(true);
    expect(report.account).toBeDefined();
    expect(report.currentCapital).toBeDefined();
    expect(report.totalEquity).toBeDefined();
    expect(Array.isArray(report.positions)).toBe(true);
    expect(Array.isArray(report.trades)).toBe(true);
    expect(Array.isArray(report.performance)).toBe(true);
    expect(Array.isArray(report.equityCurve)).toBe(true);
  });

  // ── Singleton ─────────────────────────────────────────────

  it('should return same instance from initPaperTrader', () => {
    const a = initPaperTrader();
    const b = initPaperTrader();
    expect(a).toBe(b);
  });

  // ── Reject order when not running ─────────────────────────

  it('should reject orders when stopped', () => {
    trader.stop();
    const order = makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 });
    const id = trader.submitOrder(order);
    expect(id).toBe(''); // rejected
    expect(trader.getPositions()).toHaveLength(0);
  });

  // ── Performance calculation ───────────────────────────────

  it('should calculate performance after closing trade', () => {
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    trader.submitOrder(makeOrder({ side: 'SELL', symbol: 'SZ.000001', price: 12.0, quantity: 1000 }));

    const perfs = trader.calculatePerformance();
    expect(perfs).toHaveLength(1);
    const p = perfs[0];
    expect(p.totalTrades).toBe(1);
    expect(p.winningTrades).toBe(1);
    expect(p.losingTrades).toBe(0);
    expect(p.winRate).toBe(1);
    expect(p.totalReturn).toBeGreaterThan(0);
    // No losing trades → profitFactor is 0 (division by zero case)
    expect(p.profitFactor).toBe(0);
    expect(p.netPnl).toBeUndefined(); // field is on Trade, not Performance
    expect(p.totalCommission).toBeGreaterThan(0);
  });

  it('should calculate losing trade performance', () => {
    trader.submitOrder(makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000 }));
    trader.submitOrder(makeOrder({ side: 'SELL', symbol: 'SZ.000001', price: 9.0, quantity: 1000 }));

    const perfs = trader.calculatePerformance();
    expect(perfs[0].winRate).toBe(0);
    expect(perfs[0].totalReturn).toBeLessThan(0);
  });

  it('should filter performance by strategyId', () => {
    const strat1 = makeOrder({ side: 'BUY', symbol: 'SZ.000001', price: 10.0, quantity: 1000, strategyId: 'strat-A' });
    const strat2 = makeOrder({ side: 'BUY', symbol: 'SZ.000002', price: 20.0, quantity: 1000, strategyId: 'strat-B' });
    trader.submitOrder(strat1);
    trader.submitOrder(strat2);
    // Close positions to generate closed trades
    trader.submitOrder(makeOrder({ side: 'SELL', symbol: 'SZ.000001', price: 12.0, quantity: 1000, strategyId: 'strat-A' }));
    trader.submitOrder(makeOrder({ side: 'SELL', symbol: 'SZ.000002', price: 25.0, quantity: 1000, strategyId: 'strat-B' }));

    const perfs = trader.calculatePerformance('strat-A');
    expect(perfs).toHaveLength(1);
    expect(perfs[0].strategyId).toBe('strat-A');
  });

  it('should handle empty trades in performance', () => {
    const perfs = trader.calculatePerformance('non-existent');
    expect(perfs).toHaveLength(0);
  });
});
