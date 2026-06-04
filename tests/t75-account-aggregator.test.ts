import { describe, it, expect, vi } from 'vitest';
import { AccountAggregator } from '../electron/workers/account-aggregator';

describe('AccountAggregator', () => {
  it('should aggregate multiple accounts', () => {
    const agg = new AccountAggregator();
    agg.updateAccount({
      brokerId: 'futu', brokerName: 'Futu', totalValue: 100000, cash: 20000,
      marketValue: 80000, currency: 'HKD', todayPnl: 1500, totalPnl: 5000,
      positions: 5, lastUpdated: 0,
    });
    agg.updateAccount({
      brokerId: 'ib', brokerName: 'IB', totalValue: 50000, cash: 10000,
      marketValue: 40000, currency: 'USD', todayPnl: -200, totalPnl: 3000,
      positions: 3, lastUpdated: 0,
    });

    const result = agg.aggregate();
    expect(result.totalValue).toBe(150000);
    expect(result.todayPnl).toBe(1300);
    expect(result.totalPositions).toBe(8);
    expect(result.accounts).toHaveLength(2);
  });

  it('should notify listeners', () => {
    const agg = new AccountAggregator();
    const fn = vi.fn();
    agg.onUpdate(fn);
    agg.updateAccount({
      brokerId: 'moomoo', brokerName: 'Moomoo', totalValue: 1000,
      cash: 1000, marketValue: 0, currency: 'HKD', todayPnl: 0,
      totalPnl: 0, positions: 0, lastUpdated: 0,
    });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should remove account', () => {
    const agg = new AccountAggregator();
    agg.updateAccount({
      brokerId: 'x', brokerName: 'X', totalValue: 1, cash: 1,
      marketValue: 0, currency: 'HKD', todayPnl: 0, totalPnl: 0,
      positions: 0, lastUpdated: 0,
    });
    agg.removeAccount('x');
    expect(agg.aggregate().accounts).toHaveLength(0);
  });
});
