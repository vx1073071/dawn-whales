// JVS-42-03: AccountAnalytics Tests
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AccountAnalytics,
  type AccountData,
  type PositionData,
} from '../electron/engine/analysis/account-analytics';

describe('AccountAnalytics', () => {
  let analytics: AccountAnalytics;

  beforeEach(() => {
    analytics = new AccountAnalytics();
  });

  const createMockAccount = (overrides: Partial<AccountData> = {}): AccountData => ({
    accountName: 'Test Account',
    accountType: 'paper',
    totalValue: 100000,
    cashBalance: 50000,
    initialCapital: 100000,
    positions: [
      {
        symbol: 'AAPL',
        quantity: 100,
        avgCost: 150,
        currentPrice: 155,
        marketValue: 15500,
        unrealizedPnl: 500,
        realizedPnl: 0,
      },
    ],
    trades: [],
    equityCurve: [],
    ...overrides,
  });

  describe('Account Data Management', () => {
    it('should add account data', () => {
      const data = createMockAccount();
      analytics.addAccountData('acc-1', data);
      expect(analytics.getAccountSummary('acc-1')).toBeDefined();
    });

    it('should remove account data', () => {
      const data = createMockAccount();
      analytics.addAccountData('acc-1', data);
      expect(analytics.removeAccountData('acc-1')).toBe(true);
      expect(analytics.getAccountSummary('acc-1')).toBeUndefined();
    });

    it('should return false when removing non-existent account', () => {
      expect(analytics.removeAccountData('non-existent')).toBe(false);
    });
  });

  describe('Account Summary', () => {
    it('should get account summary', () => {
      const data = createMockAccount({ accountName: 'My Account' });
      analytics.addAccountData('acc-1', data);
      const summary = analytics.getAccountSummary('acc-1');
      expect(summary).toBeDefined();
      expect(summary!.accountId).toBe('acc-1');
      expect(summary!.accountName).toBe('My Account');
      expect(summary!.totalValue).toBe(100000);
    });

    it('should get all account summaries', () => {
      analytics.addAccountData('acc-1', createMockAccount({ accountName: 'A1' }));
      analytics.addAccountData('acc-2', createMockAccount({ accountName: 'A2', totalValue: 200000 }));
      const summaries = analytics.getAllAccountSummaries();
      expect(summaries).toHaveLength(2);
    });

    it('should return undefined for non-existent account', () => {
      expect(analytics.getAccountSummary('non-existent')).toBeUndefined();
    });
  });

  describe('Account Comparison', () => {
    it('should compare accounts', () => {
      analytics.addAccountData('acc-1', createMockAccount({ accountName: 'A1' }));
      analytics.addAccountData('acc-2', createMockAccount({ accountName: 'A2', totalValue: 200000 }));
      const comparison = analytics.compareAccounts(['acc-1', 'acc-2']);
      expect(comparison.accounts).toContain('acc-1');
      expect(comparison.accounts).toContain('acc-2');
      expect(comparison.totalValue).toBe(300000);
    });

    it('should handle empty account list', () => {
      const comparison = analytics.compareAccounts([]);
      expect(comparison.accounts).toHaveLength(0);
      expect(comparison.totalValue).toBe(0);
    });
  });

  describe('Asset Allocation', () => {
    it('should get asset allocation', () => {
      analytics.addAccountData('acc-1', createMockAccount({
        positions: [
          { symbol: 'AAPL', quantity: 100, avgCost: 150, currentPrice: 155, marketValue: 15500, unrealizedPnl: 500, realizedPnl: 0 },
          { symbol: 'MSFT', quantity: 50, avgCost: 300, currentPrice: 310, marketValue: 15500, unrealizedPnl: 500, realizedPnl: 0 },
        ],
      }));
      const allocation = analytics.getAssetAllocation();
      expect(allocation.length).toBeGreaterThan(0);
    });
  });

  describe('Consolidated Positions', () => {
    it('should get consolidated positions', () => {
      analytics.addAccountData('acc-1', createMockAccount({
        positions: [
          { symbol: 'AAPL', quantity: 100, avgCost: 150, currentPrice: 155, marketValue: 15500, unrealizedPnl: 500, realizedPnl: 0 },
        ],
      }));
      analytics.addAccountData('acc-2', createMockAccount({
        positions: [
          { symbol: 'AAPL', quantity: 50, avgCost: 150, currentPrice: 155, marketValue: 7750, unrealizedPnl: 250, realizedPnl: 0 },
        ],
      }));
      const positions = analytics.getConsolidatedPositions();
      expect(positions.length).toBeGreaterThan(0);
      const aapl = positions.find(p => p.symbol === 'AAPL');
      expect(aapl?.totalQuantity).toBe(150);
    });
  });

  describe('Performance Metrics', () => {
    it('should get performance metrics', () => {
      analytics.addAccountData('acc-1', createMockAccount());
      const metrics = analytics.getPerformanceMetrics('acc-1');
      expect(metrics).toBeDefined();
      expect(typeof metrics.sharpeRatio).toBe('number');
      expect(typeof metrics.maxDrawdown).toBe('number');
    });
  });

  describe('Risk Metrics', () => {
    it('should get risk metrics', () => {
      analytics.addAccountData('acc-1', createMockAccount());
      const metrics = analytics.getRiskMetrics('acc-1');
      expect(metrics).toBeDefined();
      expect(typeof metrics.volatility).toBe('number');
      expect(typeof metrics.valueAtRisk95).toBe('number');
    });
  });

  describe('Correlation Matrix', () => {
    it('should get correlation matrix', () => {
      analytics.addAccountData('acc-1', createMockAccount({
        positions: [
          { symbol: 'AAPL', quantity: 100, avgCost: 150, currentPrice: 155, marketValue: 15500, unrealizedPnl: 500, realizedPnl: 0 },
        ],
        equityCurve: [
          { timestamp: 1000, equity: 100000 },
          { timestamp: 2000, equity: 101000 },
        ],
      }));
      const matrix = analytics.getCorrelationMatrix();
      expect(matrix).toBeDefined();
      expect(matrix.accounts).toBeDefined();
    });
  });

  describe('Diversification Score', () => {
    it('should get diversification score', () => {
      analytics.addAccountData('acc-1', createMockAccount({
        positions: [
          { symbol: 'AAPL', quantity: 100, avgCost: 150, currentPrice: 155, marketValue: 15500, unrealizedPnl: 500, realizedPnl: 0 },
          { symbol: 'MSFT', quantity: 50, avgCost: 300, currentPrice: 310, marketValue: 15500, unrealizedPnl: 500, realizedPnl: 0 },
        ],
      }));
      const score = analytics.getDiversificationScore();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('Account Ranking', () => {
    it('should get account ranking', () => {
      analytics.addAccountData('acc-1', createMockAccount({ accountName: 'A1' }));
      analytics.addAccountData('acc-2', createMockAccount({ accountName: 'A2', totalValue: 200000 }));
      const ranking = analytics.getAccountRanking();
      expect(ranking).toHaveLength(2);
    });
  });

  describe('Report Generation', () => {
    it('should generate report', () => {
      analytics.addAccountData('acc-1', createMockAccount());
      const report = analytics.generateReport();
      expect(report).toBeDefined();
      expect(report.accountCount).toBe(1);
      expect(report.summaries).toBeDefined();
    });
  });
});
