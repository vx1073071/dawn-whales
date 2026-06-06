/**
 * Tests for Account Analytics Engine (JVS-42-03)
 *
 * Tests cross-account analytics, portfolio aggregation, and risk metrics.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AccountAnalytics,
  type AccountData,
  type PositionData,
  type AccountSummary,
  type PerformanceMetrics,
} from '../electron/engine/account-analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePosition(
  symbol: string,
  quantity: number,
  avgCost: number,
  currentPrice: number,
  realizedPnl = 0
): PositionData {
  return {
    symbol,
    quantity,
    avgCost,
    currentPrice,
    marketValue: quantity * currentPrice,
    unrealizedPnl: (currentPrice - avgCost) * quantity,
    realizedPnl,
  };
}

function makeEquityCurve(start: number, points: number, growth: number) {
  const curve = [];
  let eq = start;
  const base = 1700000000000;
  for (let i = 0; i < points; i++) {
    curve.push({ timestamp: base + i * 86400000, equity: eq });
    eq *= 1 + growth + Math.sin(i * 0.5) * 0.01;
  }
  return curve;
}

function makeAccount(overrides: Partial<AccountData> = {}): AccountData {
  return {
    accountName: 'Primary Account',
    accountType: 'primary',
    totalValue: 150000,
    cashBalance: 50000,
    initialCapital: 100000,
    positions: [
      makePosition('AAPL', 100, 150, 155),
      makePosition('TSLA', 50, 200, 210),
    ],
    trades: [
      { symbol: 'AAPL', side: 'buy', quantity: 100, price: 150, timestamp: 1700000000000, pnl: 500 },
      { symbol: 'TSLA', side: 'buy', quantity: 50, price: 200, timestamp: 1700010000000, pnl: -200 },
    ],
    equityCurve: makeEquityCurve(100000, 30, 0.001),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountAnalytics (JVS-42-03)', () => {
  let engine: AccountAnalytics;

  beforeEach(() => {
    engine = new AccountAnalytics();
  });

  describe('Snapshot Management', () => {
    it('should add account data', () => {
      engine.addAccountData('primary-1', makeAccount());
      expect(engine.hasAccount('primary-1')).toBe(true);
      expect(engine.accountCount).toBe(1);
    });

    it('should remove account data', () => {
      engine.addAccountData('primary-1', makeAccount());
      expect(engine.removeAccountData('primary-1')).toBe(true);
      expect(engine.hasAccount('primary-1')).toBe(false);
    });

    it('should return false when removing non-existent account', () => {
      expect(engine.removeAccountData('ghost')).toBe(false);
    });
  });

  describe('Account Summary', () => {
    it('should return a valid summary', () => {
      engine.addAccountData('primary-1', makeAccount());
      const s = engine.getAccountSummary('primary-1');
      expect(s.accountId).toBe('primary-1');
      expect(s.accountName).toBe('Primary Account');
      expect(s.totalValue).toBe(150000);
      expect(s.positionsCount).toBe(2);
    });

    it('should return undefined for missing account', () => {
      // getAccountSummary returns undefined (not throws) so analytics consumers
      // can distinguish "no data" from "errored summary" without try/catch.
      expect(engine.getAccountSummary('missing')).toBeUndefined();
    });

    it('should compute PnL correctly', () => {
      engine.addAccountData('a', makeAccount({
        positions: [makePosition('X', 10, 100, 110, 200)],
        trades: [],
      }));
      const s = engine.getAccountSummary('a');
      // unrealizedPnl = (110-100)*10 = 100, realizedPnl = 200 → total = 300
      expect(s.totalPnl).toBe(300);
    });
  });

  describe('Account Comparison', () => {
    it('should compare two accounts', () => {
      engine.addAccountData('a', makeAccount());
      engine.addAccountData('b', makeAccount({ accountName: 'Second', totalValue: 120000 }));
      const c = engine.compareAccounts(['a', 'b']);
      expect(c.accounts.length).toBe(2);
      expect(c.totalValue).toBe(270000);
    });

    it('should return empty comparison for empty list', () => {
      const c = engine.compareAccounts([]);
      expect(c.accounts).toEqual([]);
    });
  });

  describe('Asset Allocation', () => {
    it('should aggregate positions across accounts', () => {
      engine.addAccountData('a', makeAccount());
      engine.addAccountData('b', makeAccount({
        positions: [makePosition('AAPL', 200, 150, 155)],
      }));
      const alloc = engine.getAssetAllocation();
      const aapl = alloc.find((a) => a.symbol === 'AAPL');
      expect(aapl).toBeDefined();
      expect(aapl!.accounts.length).toBe(2);
    });
  });

  describe('Performance Metrics', () => {
    it('should return valid metrics', () => {
      engine.addAccountData('a', makeAccount());
      const p = engine.getPerformanceMetrics();
      expect(typeof p.totalReturn).toBe('number');
      expect(typeof p.sharpeRatio).toBe('number');
      expect(typeof p.winRate).toBe('number');
    });
  });

  describe('Risk Metrics', () => {
    it('should return risk metrics', () => {
      engine.addAccountData('a', makeAccount());
      const r = engine.getRiskMetrics();
      expect(typeof r.volatility).toBe('number');
      expect(typeof r.maxDrawdown).toBe('number');
      expect(typeof r.concentrationRisk).toBe('number');
    });
  });

  describe('Ranking & Report', () => {
    it('should rank accounts', () => {
      engine.addAccountData('good', makeAccount({ totalValue: 200000, initialCapital: 100000 }));
      engine.addAccountData('bad', makeAccount({ totalValue: 80000, initialCapital: 100000 }));
      const ranking = engine.getAccountRanking();
      expect(ranking[0].accountId).toBe('good');
    });

    it('should generate full report', () => {
      engine.addAccountData('a', makeAccount());
      const report = engine.generateReport();
      expect(report.accountCount).toBe(1);
      expect(report.summaries.length).toBe(1);
      expect(report.performance).toBeDefined();
      expect(report.risk).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should destroy engine', () => {
      engine.addAccountData('a', makeAccount());
      engine.destroy();
      expect(engine.accountCount).toBe(0);
    });
  });
});
