import { describe, it, expect } from 'vitest';
import { BacktestFormatter } from '../electron/workers/backtest-formatter';

describe('BacktestFormatter', () => {
  it('should format report', () => {
    const fmt = new BacktestFormatter();
    const metrics = {
      totalReturn: 0.25, annualReturn: 0.12, sharpeRatio: 1.5,
      maxDrawdown: 0.15, winRate: 0.6, profitFactor: 1.8,
      totalTrades: 100, avgWin: 200, avgLoss: -100, calmarRatio: 0.8,
    };
    const equity = [
      { date: '2025-01-01', value: 10000, drawdown: 0 },
      { date: '2025-01-15', value: 10500, drawdown: 0 },
      { date: '2025-01-31', value: 11000, drawdown: 0 },
      { date: '2025-02-01', value: 11200, drawdown: 0 },
    ];
    const report = fmt.format(metrics, equity, []);
    expect(report.metrics.totalReturn).toBe(0.25);
    expect(report.summary).toContain('25.00%');
    expect(report.monthlyReturns.length).toBeGreaterThan(0);
  });
});
