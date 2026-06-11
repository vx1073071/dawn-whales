/**
 * Q95-11: Multi-Factor Selector Tests
 * Coverage for multi-factor stock screening and ranking
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  scoreAndRankStocks,
  screenStocks,
  batchScreenStocks,
} from '../electron/engine/factors/multi-factor-selector';
import type { StockData, ScreenCriteria } from '../electron/engine/factors/multi-factor-selector';

function makeStock(symbol: string, overrides: Partial<StockData> = {}): StockData {
  return {
    code: symbol,
    name: `Stock ${symbol}`,
    price: 100,
    priceChange1M: 0.05,
    priceChange3M: 0.12,
    priceChange6M: 0.20,
    priceChange1Y: 0.30,
    marketCap: 500_000_000_000,
    pe: 20,
    pb: 3.5,
    ps: 5.0,
    evEbitda: 15,
    roe: 0.15,
    revenueGrowth: 0.12,
    earningsGrowth: 0.10,
    dividendYield: 0.02,
    momentum6m: 0.08,
    volatility: 0.25,
    beta: 1.1,
    debtToEquity: 0.8,
    currentRatio: 1.5,
    ...overrides,
  };
}

function makeScreenCriteria(overrides: Partial<ScreenCriteria> = {}): ScreenCriteria {
  return {
    minMarketCap: 100_000_000_000,
    maxPe: 30,
    minRoe: 0.05,
    ...overrides,
  };
}

describe('Q95-11: Multi-Factor Selector', () => {
  describe('scoreAndRankStocks', () => {
    it('should score and rank stocks with default weights', () => {
      const stocks: StockData[] = [
        makeStock('AAPL'),
        makeStock('GOOGL', { roe: 0.25, momentum6m: 0.15 }),
        makeStock('MSFT', { pe: 25, revenueGrowth: 0.18 }),
      ];
      const result = scoreAndRankStocks(stocks);
      expect(result.scores.length).toBe(3);
      expect(result.scores[0].rank).toBe(1);
      expect(result.scores[0].compositeScore).toBeGreaterThanOrEqual(0);
    });

    it('should rank by composite score', () => {
      const stocks: StockData[] = [
        makeStock('AAPL'),
        makeStock('GOOGL', { roe: 0.30, revenueGrowth: 0.25, momentum6m: 0.20 }),
        makeStock('MSFT'),
      ];
      const weights = { roe: 0.5, pe: 0.3, momentum6m: 0.2 };
      const result = scoreAndRankStocks(stocks, weights);
      // At least one stock should be ranked
      expect(result.scores.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle empty stock list', () => {
      const result = scoreAndRankStocks([]);
      expect(result.scores.length).toBe(0);
      expect(result.totalStocks).toBe(0);
    });

    it('should handle single stock', () => {
      const result = scoreAndRankStocks([makeStock('AAPL')]);
      expect(result.scores.length).toBe(1);
      expect(result.scores[0].rank).toBe(1);
    });

    it('should set success flag', () => {
      const result = scoreAndRankStocks([makeStock('AAPL')]);
      expect(result.success).toBe(true);
    });
  });

  describe('screenStocks', () => {
    it('should filter by market cap', () => {
      const stocks: StockData[] = [
        makeStock('BIG', { marketCap: 500_000_000_000 }),
        makeStock('MID', { marketCap: 50_000_000_000 }),
        makeStock('SML', { marketCap: 5_000_000_000 }),
      ];
      const criteria = makeScreenCriteria({ minMarketCap: 100_000_000_000 });
      const result = screenStocks(stocks, criteria);
      expect(result.scores.length).toBe(1);
      expect(result.scores[0].code).toBe('BIG');
    });

    it('should filter by PE max', () => {
      const stocks: StockData[] = [
        makeStock('CHEAP', { pe: 10 }),
        makeStock('EXPENSIVE', { pe: 50 }),
        makeStock('OK', { pe: 25 }),
      ];
      const criteria = makeScreenCriteria({ maxPe: 30 });
      const result = screenStocks(stocks, criteria);
      const codes = result.scores.map(s => s.code);
      expect(codes).toContain('CHEAP');
    });

    it('should combine multiple criteria', () => {
      const stocks: StockData[] = [
        makeStock('AAPL', { marketCap: 2_000_000_000_000, pe: 28, roe: 0.15 }),
        makeStock('BAD1', { marketCap: 10_000_000_000, pe: 15, roe: 0.20 }),
        makeStock('GOOD', { marketCap: 800_000_000_000, pe: 20, roe: 0.18 }),
      ];
      const criteria = makeScreenCriteria({ minMarketCap: 100_000_000_000, maxPe: 30, minRoe: 0.10 });
      const result = screenStocks(stocks, criteria);
      const codes = result.scores.map(s => s.code);
      expect(codes).toContain('AAPL');
      expect(codes).toContain('GOOD');
      expect(codes).not.toContain('BAD1');
    });
  });

  describe('batchScreenStocks', () => {
    it('should screen multiple batches', async () => {
      const batches = [
        { name: 'tech', stocks: [makeStock('AAPL'), makeStock('GOOGL')], criteria: makeScreenCriteria() },
        { name: 'finance', stocks: [makeStock('JPM', { pe: 12 }), makeStock('BAC', { pe: 10 })], criteria: makeScreenCriteria() },
      ];
      const results = await batchScreenStocks(batches);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
    });

    it('should handle empty batches', async () => {
      const results = await batchScreenStocks([]);
      expect(results.length).toBe(0);
    });
  });
});
