/**
 * @vitest-environment node
 * J-V15-02: Auto Trade Billing Tests (25+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AutoTradeBilling,
  getAutoTradeBilling,
  resetAutoTradeBilling,
} from '../electron/engine/auto-trade-billing';

// ── Section 1: Fee Calculation ──────────────────────────────────────────────

describe('J-V15-02-01: Fee Calculation', () => {
  let billing: AutoTradeBilling;

  beforeEach(() => {
    resetAutoTradeBilling();
    billing = getAutoTradeBilling();
  });

  it('01: fee schedule returns v15 rates', () => {
    const s = billing.getFeeSchedule();
    expect(s.takerRate).toBe(0.001);    // 0.1%
    expect(s.makerRate).toBe(0.0002);   // 0.02%
    expect(s.specialTakerRate).toBe(0.0004); // 0.04%
    expect(s.platformPercent).toBe(100);
  });

  it('02: market order = taker', () => {
    expect(billing.determineFeeRole('market')).toBe('taker');
  });

  it('03: limit order = maker', () => {
    expect(billing.determineFeeRole('limit')).toBe('maker');
  });

  it('04: taker fee rate is 0.1%', () => {
    expect(billing.getFeeRate('taker')).toBe(0.001);
  });

  it('05: maker fee rate is 0.02%', () => {
    expect(billing.getFeeRate('maker')).toBe(0.0002);
  });

  it('06: special taker fee rate is 0.04%', () => {
    expect(billing.getFeeRate('taker', true)).toBe(0.0004);
  });

  it('07: calculateFee for taker', () => {
    // $10,000 trade at 0.1% = $10
    expect(billing.calculateFee(10000, 'taker')).toBe(10);
  });

  it('08: calculateFee for maker', () => {
    // $10,000 trade at 0.02% = $2
    expect(billing.calculateFee(10000, 'maker')).toBe(2);
  });
});

// ── Section 2: Trade Billing ────────────────────────────────────────────────

describe('J-V15-02-02: Trade Billing', () => {
  let billing: AutoTradeBilling;

  beforeEach(() => {
    resetAutoTradeBilling();
    billing = getAutoTradeBilling();
  });

  it('09: bill online market buy', () => {
    const bill = billing.billTrade({
      userId: 'u1', symbol: 'AAPL', side: 'buy', orderType: 'market',
      tradePrice: 150, tradeQuantity: 100, isOnline: true,
    });
    expect(bill).not.toBeNull();
    expect(bill!.tradeValue).toBe(15000);
    expect(bill!.feeAmount).toBe(15); // 15000 * 0.001
    expect(bill!.feeRole).toBe('taker');
    expect(bill!.status).toBe('charged');
  });

  it('10: bill online limit sell', () => {
    const bill = billing.billTrade({
      userId: 'u1', symbol: 'AAPL', side: 'sell', orderType: 'limit',
      tradePrice: 155, tradeQuantity: 50, isOnline: true,
    });
    expect(bill!.feeRole).toBe('maker');
    expect(bill!.feeAmount).toBeCloseTo(1.55, 2); // 7750 * 0.0002
  });

  it('11: offline trade returns null (NOT charged)', () => {
    const bill = billing.billTrade({
      userId: 'u1', symbol: 'AAPL', side: 'buy', orderType: 'market',
      tradePrice: 150, tradeQuantity: 100, isOnline: false,
    });
    expect(bill).toBeNull();
    expect(billing.billCount).toBe(0);
  });

  it('12: special taker rate for cross-market', () => {
    const bill = billing.billTrade({
      userId: 'u1', symbol: 'BTC/USDT', side: 'buy', orderType: 'market',
      tradePrice: 50000, tradeQuantity: 0.1, isOnline: true, special: true,
    });
    expect(bill!.feeRate).toBe(0.0004); // 0.04%
    expect(bill!.feeAmount).toBe(2); // 5000 * 0.0004
  });

  it('13: platform keeps 100% of trading fees', () => {
    // This is a v15 rule: trading fees are platform revenue, creator gets 0%
    const bill = billing.billTrade({
      userId: 'u1', symbol: 'AAPL', side: 'buy', orderType: 'market',
      tradePrice: 100, tradeQuantity: 10, isOnline: true,
    });
    expect(bill!.feeAmount).toBe(1); // 1000 * 0.001
    // No creator split for trading fees
  });

  it('14: refund trade', () => {
    const bill = billing.billTrade({
      userId: 'u1', symbol: 'AAPL', side: 'buy', orderType: 'market',
      tradePrice: 100, tradeQuantity: 10, isOnline: true,
    });
    expect(billing.refundTrade(bill!.id, 'Failed execution')).toBe(true);
    expect(billing.getBill(bill!.id)!.status).toBe('refunded');
  });

  it('15: double refund fails', () => {
    const bill = billing.billTrade({
      userId: 'u1', symbol: 'AAPL', side: 'buy', orderType: 'market',
      tradePrice: 100, tradeQuantity: 10, isOnline: true,
    });
    billing.refundTrade(bill!.id);
    expect(billing.refundTrade(bill!.id)).toBe(false);
  });
});

// ── Section 3: Queries ──────────────────────────────────────────────────────

describe('J-V15-02-03: Billing Queries', () => {
  let billing: AutoTradeBilling;

  beforeEach(() => {
    resetAutoTradeBilling();
    billing = getAutoTradeBilling();
    // Seed some trades
    billing.billTrade({ userId: 'u1', symbol: 'AAPL', side: 'buy', orderType: 'market', tradePrice: 150, tradeQuantity: 100, isOnline: true });
    billing.billTrade({ userId: 'u1', symbol: 'MSFT', side: 'sell', orderType: 'limit', tradePrice: 300, tradeQuantity: 50, isOnline: true });
    billing.billTrade({ userId: 'u2', symbol: 'GOOGL', side: 'buy', orderType: 'market', tradePrice: 100, tradeQuantity: 200, isOnline: true });
  });

  it('16: getUserBills returns user-specific bills', () => {
    const bills = billing.getUserBills('u1');
    expect(bills.length).toBe(2);
  });

  it('17: getUserBillingStats aggregates correctly', () => {
    const stats = billing.getUserBillingStats('u1');
    expect(stats.totalTrades).toBe(2);
    expect(stats.totalValueUSDT).toBe(30000); // 15000 + 15000
    expect(stats.makerPercent).toBe(50);
  });

  it('18: getPlatformBillingSummary shows totals', () => {
    const summary = billing.getPlatformBillingSummary();
    expect(summary.totalTrades).toBe(3);
    expect(summary.uniqueUsers).toBe(2);
    expect(summary.totalFeesUSDT).toBeGreaterThan(0);
    expect(summary.netRevenueUSDT).toBe(summary.totalFeesUSDT); // no refunds
  });

  it('19: refund reduces net revenue', () => {
    const bills = billing.getUserBills('u1');
    billing.refundTrade(bills[0].id);
    const summary = billing.getPlatformBillingSummary();
    expect(summary.totalRefunds).toBe(1);
    expect(summary.netRevenueUSDT).toBeLessThan(summary.totalFeesUSDT);
  });

  it('20: getMonthlyBillingSummary filters by month', () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const summary = billing.getMonthlyBillingSummary('u1', month);
    expect(summary.totalTrades).toBe(2);
    expect(summary.onlineTrades).toBe(2);
    expect(summary.offlineTrades).toBe(0);
  });
});

// ── Section 4: Edge Cases ──────────────────────────────────────────────────

describe('J-V15-02-04: Edge Cases', () => {
  let billing: AutoTradeBilling;

  beforeEach(() => {
    resetAutoTradeBilling();
    billing = getAutoTradeBilling();
  });

  it('21: getUserBills for unknown user returns empty', () => {
    expect(billing.getUserBills('unknown').length).toBe(0);
  });

  it('22: getBill for unknown id returns null', () => {
    expect(billing.getBill('unknown')).toBeNull();
  });

  it('23: refund unknown bill fails', () => {
    expect(billing.refundTrade('unknown')).toBe(false);
  });

  it('24: multiple trades accumulate fees', () => {
    for (let i = 0; i < 100; i++) {
      billing.billTrade({ userId: 'u1', symbol: 'AAPL', side: 'buy', orderType: 'market', tradePrice: 100, tradeQuantity: 10, isOnline: true });
    }
    const stats = billing.getUserBillingStats('u1');
    expect(stats.totalTrades).toBe(100);
    expect(stats.totalFeesUSDT).toBe(100); // 100 trades × $1 fee each
  });

  it('25: reset clears all data', () => {
    billing.billTrade({ userId: 'u1', symbol: 'AAPL', side: 'buy', orderType: 'market', tradePrice: 100, tradeQuantity: 10, isOnline: true });
    billing.reset();
    expect(billing.billCount).toBe(0);
    expect(billing.getUserBills('u1').length).toBe(0);
  });
});
