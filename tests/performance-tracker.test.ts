/**
 * J-35-03: PerformanceTracker Tests
 * Tests Sharpe, Sortino, Calmar ratio calculations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceTracker, TradeRecord, EquityPoint } from '../electron/engine/performance-tracker';

describe('J-35-03: PerformanceTracker', () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker(100000);
  });

  describe('Total Return', () => {
    it('should calculate positive total return', () => {
      tracker.updateEquity(110000);
      const metrics = tracker.getMetrics();
      expect(metrics.totalReturn).toBe(10);
    });

    it('should calculate negative total return', () => {
      tracker.updateEquity(90000);
      const metrics = tracker.getMetrics();
      expect(metrics.totalReturn).toBe(-10);
    });

    it('should calculate zero return', () => {
      const metrics = tracker.getMetrics();
      expect(metrics.totalReturn).toBe(0);
    });
  });

  describe('Sharpe Ratio', () => {
    it('should calculate Sharpe ratio with positive returns', () => {
      // Create equity curve with positive trend
      tracker.updateEquity(100000);
      tracker.updateEquity(101000);
      tracker.updateEquity(102000);
      tracker.updateEquity(103000);
      tracker.updateEquity(104000);

      const metrics = tracker.getMetrics();
      expect(metrics.sharpe).toBeGreaterThan(0);
    });

    it('should calculate negative Sharpe with negative returns', () => {
      tracker.updateEquity(100000);
      tracker.updateEquity(99000);
      tracker.updateEquity(98000);
      tracker.updateEquity(97000);

      const metrics = tracker.getMetrics();
      expect(metrics.sharpe).toBeLessThan(0);
    });

    it('should return 0 for insufficient data', () => {
      const metrics = tracker.getMetrics();
      expect(metrics.sharpe).toBe(0);
    });
  });

  describe('Sortino Ratio', () => {
    it('should calculate Sortino ratio', () => {
      tracker.updateEquity(100000);
      tracker.updateEquity(101000);
      tracker.updateEquity(99000);
      tracker.updateEquity(102000);
      tracker.updateEquity(103000);

      const metrics = tracker.getMetrics();
      expect(metrics.sortino).toBeDefined();
    });

    it('should return Infinity for no downside', () => {
      tracker.updateEquity(100000);
      tracker.updateEquity(101000);
      tracker.updateEquity(102000);
      tracker.updateEquity(103000);

      const metrics = tracker.getMetrics();
      expect(metrics.sortino).toBe(Infinity);
    });
  });

  describe('Calmar Ratio', () => {
    it('should calculate Calmar ratio', () => {
      tracker.updateEquity(100000);
      tracker.updateEquity(110000);
      tracker.updateEquity(105000);
      tracker.updateEquity(115000);

      const metrics = tracker.getMetrics();
      expect(metrics.calmar).toBeDefined();
    });

    it('should return 0 when max drawdown is 0', () => {
      tracker.updateEquity(100000);
      tracker.updateEquity(101000);
      tracker.updateEquity(102000);

      const metrics = tracker.getMetrics();
      expect(metrics.calmar).toBe(0);
    });
  });

  describe('Max Drawdown', () => {
    it('should calculate max drawdown', () => {
      tracker.updateEquity(100000);
      tracker.updateEquity(110000);
      tracker.updateEquity(105000); // 5% drawdown from peak
      tracker.updateEquity(108000);
      tracker.updateEquity(100000); // 10% drawdown from peak
      tracker.updateEquity(112000);

      const metrics = tracker.getMetrics();
      expect(metrics.maxDrawdown).toBeGreaterThan(9);
    });

    it('should return 0 for no drawdown', () => {
      tracker.updateEquity(100000);
      tracker.updateEquity(101000);
      tracker.updateEquity(102000);

      const metrics = tracker.getMetrics();
      expect(metrics.maxDrawdown).toBe(0);
    });
  });

  describe('Win Rate', () => {
    it('should calculate win rate correctly', () => {
      const trades: TradeRecord[] = [
        { symbol: 'AAPL', side: 'BUY', entryPrice: 100, exitPrice: 110, quantity: 10, pnl: 100, pnlPct: 10, entryTime: Date.now(), exitTime: Date.now() + 86400000, holdingDays: 1 },
        { symbol: 'MSFT', side: 'BUY', entryPrice: 200, exitPrice: 190, quantity: 5, pnl: -50, pnlPct: -5, entryTime: Date.now(), exitTime: Date.now() + 86400000, holdingDays: 1 },
        { symbol: 'GOOGL', side: 'BUY', entryPrice: 150, exitPrice: 160, quantity: 8, pnl: 80, pnlPct: 6.67, entryTime: Date.now(), exitTime: Date.now() + 86400000, holdingDays: 1 },
      ];

      tracker.addTrades(trades);
      const metrics = tracker.getMetrics();

      expect(metrics.winRate).toBeCloseTo(66.67, 1);
      expect(metrics.totalTrades).toBe(3);
      expect(metrics.winningTrades).toBe(2);
      expect(metrics.losingTrades).toBe(1);
    });

    it('should return 0 for no trades', () => {
      const metrics = tracker.getMetrics();
      expect(metrics.winRate).toBe(0);
      expect(metrics.totalTrades).toBe(0);
    });
  });

  describe('Profit Factor', () => {
    it('should calculate profit factor correctly', () => {
      const trades: TradeRecord[] = [
        { symbol: 'AAPL', side: 'BUY', entryPrice: 100, exitPrice: 110, quantity: 10, pnl: 100, pnlPct: 10, entryTime: Date.now(), exitTime: Date.now() + 86400000, holdingDays: 1 },
        { symbol: 'MSFT', side: 'BUY', entryPrice: 200, exitPrice: 190, quantity: 5, pnl: -50, pnlPct: -5, entryTime: Date.now(), exitTime: Date.now() + 86400000, holdingDays: 1 },
      ];

      tracker.addTrades(trades);
      const metrics = tracker.getMetrics();

      expect(metrics.profitFactor).toBe(2); // 100 / 50
    });

    it('should return Infinity for no losses', () => {
      const trades: TradeRecord[] = [
        { symbol: 'AAPL', side: 'BUY', entryPrice: 100, exitPrice: 110, quantity: 10, pnl: 100, pnlPct: 10, entryTime: Date.now(), exitTime: Date.now() + 86400000, holdingDays: 1 },
      ];

      tracker.addTrades(trades);
      const metrics = tracker.getMetrics();

      expect(metrics.profitFactor).toBe(Infinity);
    });
  });

  describe('Average Win/Loss', () => {
    it('should calculate average win and loss', () => {
      const trades: TradeRecord[] = [
        { symbol: 'AAPL', side: 'BUY', entryPrice: 100, exitPrice: 110, quantity: 10, pnl: 100, pnlPct: 10, entryTime: Date.now(), exitTime: Date.now() + 86400000, holdingDays: 1 },
        { symbol: 'MSFT', side: 'BUY', entryPrice: 200, exitPrice: 220, quantity: 5, pnl: 100, pnlPct: 10, entryTime: Date.now(), exitTime: Date.now() + 86400000, holdingDays: 1 },
        { symbol: 'GOOGL', side: 'BUY', entryPrice: 150, exitPrice: 140, quantity: 8, pnl: -80, pnlPct: -6.67, entryTime: Date.now(), exitTime: Date.now() + 86400000, holdingDays: 1 },
      ];

      tracker.addTrades(trades);
      const metrics = tracker.getMetrics();

      expect(metrics.avgWin).toBe(100);
      expect(metrics.avgLoss).toBe(80);
    });
  });

  describe('Control Methods', () => {
    it('should reset tracker', () => {
      tracker.updateEquity(110000);
      tracker.addTrade({
        symbol: 'AAPL',
        side: 'BUY',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 10,
        pnl: 100,
        pnlPct: 10,
        entryTime: Date.now(),
        exitTime: Date.now() + 86400000,
        holdingDays: 1,
      });

      tracker.reset();

      const metrics = tracker.getMetrics();
      expect(metrics.totalReturn).toBe(0);
      expect(metrics.totalTrades).toBe(0);
      expect(tracker.getCurrentEquity()).toBe(100000);
    });

    it('should clear trades only', () => {
      tracker.updateEquity(110000);
      tracker.addTrade({
        symbol: 'AAPL',
        side: 'BUY',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 10,
        pnl: 100,
        pnlPct: 10,
        entryTime: Date.now(),
        exitTime: Date.now() + 86400000,
        holdingDays: 1,
      });

      tracker.clearTrades();

      expect(tracker.getTrades().length).toBe(0);
      expect(tracker.getCurrentEquity()).toBe(110000);
    });

    it('should set risk-free rate', () => {
      tracker.setRiskFreeRate(0.03);
      tracker.updateEquity(100000);
      tracker.updateEquity(110000);

      const metrics = tracker.getMetrics();
      expect(metrics.sharpe).toBeDefined();
    });
  });
});
