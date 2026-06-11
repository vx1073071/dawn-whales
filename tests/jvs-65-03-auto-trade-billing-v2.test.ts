/**
 * J-65-03 Tests: 自动交易计费完善 (R65 FIX)
 *
 * Tests:
 * 01: Fee calculation (taker/maker)
 * 02: Desktop trade charges USDT
 * 03: Futu App trade = FREE
 * 04: Insufficient balance = no charge
 * 05: Monthly revenue tracking
 * 06: Fee warnings
 * 07: Stats
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AutoTradeBillingV2,
  getBillingV2,
  resetBillingV2,
  FEE_SCHEDULE,
} from '../electron/engine/analysis/auto-trade-billing-v2';
import type { TradeExecution } from '../electron/engine/analysis/auto-trade-billing-v2';

function makeTrade(overrides: Partial<TradeExecution> = {}): TradeExecution {
  return {
    id: 'TRD-' + Math.random().toString(36).substring(2, 8),
    userId: 'user-1',
    symbol: '00700',
    market: 'HK',
    side: 'buy',
    orderType: 'market',
    source: 'desktop',
    quantity: 100,
    price: 350,
    totalValue: 35000,
    executedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('J-65-03: Auto Trade Billing v2', () => {
  let billing: AutoTradeBillingV2;

  beforeEach(() => {
    resetBillingV2();
    billing = getBillingV2();
    billing.setBalance('user-1', 500);
  });

  it('01: market order charges taker fee (0.1%)', () => {
    const trade = makeTrade({ orderType: 'market', quantity: 100, price: 350 });
    const result = billing.executeTradeWithBilling(trade);
    expect(result.feeModel).toBe('taker');
    expect(result.feeRate).toBe(FEE_SCHEDULE.taker);
    expect(result.feeAmount).toBe(35); // 35000 * 0.001 = 35 USDT
    expect(result.charged).toBe(true);
  });

  it('02: limit order charges maker fee (0.02%)', () => {
    const trade = makeTrade({ orderType: 'limit', quantity: 1000, price: 50 });
    const result = billing.executeTradeWithBilling(trade);
    expect(result.feeModel).toBe('maker');
    expect(result.feeAmount).toBe(10); // 50000 * 0.0002 = 10 USDT
  });

  it('03: futu_app source = FREE (no charge)', () => {
    const trade = makeTrade({ source: 'futu_app' });
    const result = billing.executeTradeWithBilling(trade);
    expect(result.charged).toBe(false);
    expect(result.feeAmount).toBe(0);
    expect(result.reason).toContain('own broker');
  });

  it('04: insufficient balance = no charge', () => {
    billing.setBalance('user-1', 1); // only 1 USDT
    const trade = makeTrade({ quantity: 1000, price: 100 }); // 100000 * 0.001 = 100 USDT fee
    const result = billing.executeTradeWithBilling(trade);
    expect(result.charged).toBe(false);
    expect(result.reason).toContain('Insufficient');
    expect(result.preBalance).toBe(1);
    expect(result.postBalance).toBe(1);
  });

  it('05: monthly revenue aggregates correctly', () => {
    billing.setBalance('user-1', 1000);
    const t1 = makeTrade({ executedAt: '2026-06-09T10:00:00Z' });
    const t2 = makeTrade({ executedAt: '2026-06-09T11:00:00Z' });
    billing.executeTradeWithBilling(t1);
    billing.executeTradeWithBilling(t2);

    const june = billing.getMonthlyRevenue('2026-06');
    expect(june).toBe(70); // 35 + 35
    expect(billing.getTotalRevenue()).toBe(70);
  });

  it('06: fee warnings trigger correctly', () => {
    // Low balance warning
    billing.setBalance('user-1', 50);
    const trade = makeTrade();
    const warning = billing.getFeeWarning(trade);
    expect(warning).toContain('偏低');

    // Zero balance
    billing.setBalance('user-1', 0);
    const warning2 = billing.getFeeWarning(trade);
    expect(warning2).toContain('零');
  });

  it('07: stats show correct totals', () => {
    billing.setBalance('user-1', 1000);
    billing.executeTradeWithBilling(makeTrade({ source: 'desktop' }));
    billing.executeTradeWithBilling(makeTrade({ source: 'desktop' }));
    billing.executeTradeWithBilling(makeTrade({ source: 'futu_app' }));

    const stats = billing.getStats();
    expect(stats.totalTrades).toBe(3);
    expect(stats.totalCharged).toBe(2);
    expect(stats.totalRevenue).toBeGreaterThan(0);
  });
});
