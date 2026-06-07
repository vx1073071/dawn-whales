/**
 * JVS-45-03: Test Helpers Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createMockMarketData,
  createMockTradeData,
  createMockStrategy,
  createMockAccount,
  createMockKlines,
  createTestContext,
  cleanupContext,
  calculateMean,
  calculateStdDev,
  calculateSharpeRatio,
  generateTrendData,
  generateRandomWalk,
} from './utils/test-helpers';

describe('JVS-45-03: Test Helpers', () => {
  describe('createMockMarketData', () => {
    it('should create mock market data', () => {
      const data = createMockMarketData(100);
      expect(data.length).toBe(100);
      expect(data[0]).toHaveProperty('time');
      expect(data[0]).toHaveProperty('open');
      expect(data[0]).toHaveProperty('high');
      expect(data[0]).toHaveProperty('low');
      expect(data[0]).toHaveProperty('close');
      expect(data[0]).toHaveProperty('volume');
    });

    it('should create data with default count', () => {
      const data = createMockMarketData();
      expect(data.length).toBe(100);
    });
  });

  describe('createMockTradeData', () => {
    it('should create mock trade data', () => {
      const data = createMockTradeData(10);
      expect(data.length).toBe(10);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('symbol');
      expect(data[0]).toHaveProperty('side');
      expect(data[0]).toHaveProperty('price');
      expect(data[0]).toHaveProperty('quantity');
    });

    it('should create data with default count', () => {
      const data = createMockTradeData();
      expect(data.length).toBe(10);
    });
  });

  describe('createMockStrategy', () => {
    it('should create mock strategy', () => {
      const strategy = createMockStrategy();
      expect(strategy).toHaveProperty('id');
      expect(strategy).toHaveProperty('name');
      expect(strategy).toHaveProperty('sharpe');
      expect(strategy).toHaveProperty('maxDrawdown');
      expect(strategy).toHaveProperty('winRate');
    });

    it('should accept overrides', () => {
      const strategy = createMockStrategy({ name: 'Custom Strategy', sharpe: 3.0 });
      expect(strategy.name).toBe('Custom Strategy');
      expect(strategy.sharpe).toBe(3.0);
    });
  });

  describe('createMockAccount', () => {
    it('should create mock account', () => {
      const account = createMockAccount();
      expect(account).toHaveProperty('accountId');
      expect(account).toHaveProperty('name');
      expect(account).toHaveProperty('broker');
      expect(account).toHaveProperty('balance');
    });

    it('should accept overrides', () => {
      const account = createMockAccount({ name: 'My Account', balance: 50000 });
      expect(account.name).toBe('My Account');
      expect(account.balance).toBe(50000);
    });
  });

  describe('createMockKlines', () => {
    it('should create mock klines', () => {
      const klines = createMockKlines(50);
      expect(klines.length).toBe(50);
      expect(klines[0]).toHaveProperty('time');
      expect(klines[0]).toHaveProperty('close');
    });
  });

  describe('createTestContext', () => {
    it('should create test context', () => {
      const ctx = createTestContext();
      expect(ctx.strategies.length).toBe(3);
      expect(ctx.accounts.length).toBe(2);
      expect(ctx.trades.length).toBe(20);
      expect(ctx.klines.length).toBe(200);
      expect(ctx.startTime).toBeGreaterThan(0);
    });
  });

  describe('cleanupContext', () => {
    it('should cleanup context', () => {
      const ctx = createTestContext();
      cleanupContext(ctx);
      expect(ctx.strategies.length).toBe(0);
      expect(ctx.accounts.length).toBe(0);
      expect(ctx.trades.length).toBe(0);
      expect(ctx.klines.length).toBe(0);
    });
  });

  describe('calculateMean', () => {
    it('should calculate mean', () => {
      const mean = calculateMean([10, 20, 30, 40, 50]);
      expect(mean).toBe(30);
    });

    it('should handle empty array', () => {
      const mean = calculateMean([]);
      expect(mean).toBe(0);
    });
  });

  describe('calculateStdDev', () => {
    it('should calculate standard deviation', () => {
      const std = calculateStdDev([10, 20, 30, 40, 50]);
      expect(std).toBeGreaterThan(0);
      expect(std).toBeCloseTo(14.14, 1);
    });

    it('should handle single element', () => {
      const std = calculateStdDev([10]);
      expect(std).toBe(0);
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should calculate sharpe ratio', () => {
      const returns = [0.01, 0.02, -0.01, 0.03, 0.02];
      const sharpe = calculateSharpeRatio(returns);
      expect(sharpe).toBeGreaterThan(0);
    });

    it('should handle empty returns', () => {
      const sharpe = calculateSharpeRatio([]);
      expect(sharpe).toBe(0);
    });

    it('should handle single return', () => {
      const sharpe = calculateSharpeRatio([0.01]);
      expect(sharpe).toBe(0);
    });
  });

  describe('generateTrendData', () => {
    it('should generate trend data', () => {
      const data = generateTrendData(100, 100, 0.01);
      expect(data.length).toBe(100);
      expect(Math.abs(data[0] - 100)).toBeLessThan(5);
      // With positive trend, later values should be higher on average
      expect(data[99]).toBeGreaterThan(data[0] * 0.9);
    });

    it('should handle negative trend', () => {
      const data = generateTrendData(100, 100, -0.01, 0.001);
      expect(data[99]).toBeLessThan(data[0] * 1.1);
    });
  });

  describe('generateRandomWalk', () => {
    it('should generate random walk', () => {
      const data = generateRandomWalk(100, 100);
      expect(data.length).toBe(100);
      // Random walk should start near 100 (within 5% tolerance)
      expect(Math.abs(data[0] - 100)).toBeLessThan(5);
    });
  });
});
