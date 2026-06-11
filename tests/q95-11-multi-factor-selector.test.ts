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
    symbol,
    name: `Stock ${symbol}`,
    price: 100,
    marketCap: 500_000_000_000,
    pe: 20,
    pb: 3.5,
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
  // ── scoreAndRankStocks ────────────────────────────────────────
  describe('scoreAndRankStocks', () => {
    it('should score and rank stocks with default weights', () => {
      const stocks: StockData[] = [
        makeStock('AAPL'),
        makeStock('GOOGL', { roe: 0.25, momentum6m: 0.15 }),
        makeStock('MSFT', { pe: 25, revenueGrowth: 0.18 }),
      ];
      const result = scoreAndRankStocks(stocks);
      expect(result.stocks.length).toBe(3);
      expect(result.stocks[0].totalScore).toBeGreaterThan(0);
      expect(result.stocks[0].rank).toBe(1); // highest score first
    });

    it('should score and rank with custom factor weights', () => {
      const stocks: StockData[] = [
        makeStock('AAPL'),
        makeStock('GOOGL', { roe: 0.30 }),
        makeStock('MSFT'),
      ];
      const weights = { roe: 0.5, pe: 0.3, momentum6m: 0.2 };
      const result = scoreAndRankStocks(stocks, weights);
      expect(result.stocks.length).toBe(3);
      // Highest ROE should rank first
      expect(result.stocks[0].stock.symbol).toBe('GOOGL');
    });

    it('should handle empty stock list', () => {
      const result = scoreAndRankStocks([]);
      expect(result.stocks.length).toBe(0);
      expect(result.totalStocks).toBe(0);
    });

    it('should handle single stock', () => {
      const result = scoreAndRankStocks([makeStock('AAPL')]);
      expect(result.stocks.length).toBe(1);
      expect(result.stocks[0].rank).toBe(1);
    });
  });

  // ── screenStocks ─────────────────────────────────────────────
  describe('screenStocks', () => {
    it('should filter by market cap', () => {
      const stocks: StockData[] = [
        makeStock('BIG', { marketCap: 500_000_000_000 }),
        makeStock('MID', { marketCap: 50_000_000_000 }),
        makeStock('SML', { marketCap: 5_000_000_000 }),
      ];
      const criteria = makeScreenCriteria({ minMarketCap: 100_000_000_000 });
      const result = screenStocks(stocks, criteria);
      expect(result.stocks.length).toBe(1);
      expect(result.stocks[0].stock.symbol).toBe('BIG');
    });

    it('should filter by PE max', () => {
      const stocks: StockData[] = [
        makeStock('CHEAP', { pe: 10 }),
        makeStock('EXPENSIVE', { pe: 50 }),
        makeStock('OK', { pe: 25 }),
      ];
      const criteria = makeScreenCriteria({ maxPe: 30 });
      const result = screenStocks(stocks, criteria);
      // CHEAP(10) and OK(25) pass PE ≤ 30
      const cheap = result.stocks.find(s => s.stock.symbol === 'CHEAP');
      const ok = result.stocks.find(s => s.stock.symbol === 'OK');
      expect(cheap).toBeDefined();
      expect(ok).toBeDefined();
    });

    it('should filter by min ROE', () => {
      const stocks: StockData[] = [
        makeStock('HIGH', { roe: 0.25 }),
        makeStock('LOW', { roe: 0.02 }),
      ];
      const criteria = makeScreenCriteria({ minRoe: 0.10 });
      const result = screenStocks(stocks, criteria);
      expect(result.stocks.length).toBe(1);
      expect(result.stocks[0].stock.symbol).toBe('HIGH');
    });

    it('should combine multiple criteria', () => {
      const stocks: StockData[] = [
        makeStock('AAPL', { marketCap: 2_000_000_000_000, pe: 28, roe: 0.15 }),
        makeStock('BAD1', { marketCap: 10_000_000_000, pe: 15, roe: 0.20 }), // too small
        makeStock('BAD2', { marketCap: 1_000_000_000_000, pe: 50, roe: 0.10 }), // PE too high
        makeStock('GOOD', { marketCap: 800_000_000_000, pe: 20, roe: 0.18 }),
      ];
      const criteria = makeScreenCriteria({ minMarketCap: 100_000_000_000, maxPe: 30, minRoe: 0.10 });
      const result = screenStocks(stocks, criteria);
      const symbols = result.stocks.map(s => s.stock.symbol);
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('GOOD');
      expect(symbols).not.toContain('BAD1');
      expect(symbols).not.toContain('BAD2');
    });

    it('should sort by score by default', () => {
      const stocks: StockData[] = [
        makeStock('AVG'),
        makeStock('BEST', { roe: 0.30, revenueGrowth: 0.25, momentum6m: 0.20 }),
        makeStock('WORST', { roe: 0.03, revenueGrowth: -0.05, momentum6m: -0.10 }),
      ];
      const criteria = makeScreenCriteria({ minRoe: 0 });
      const result = screenStocks(stocks, criteria);
      expect(result.stocks[0].rank).toBe(1);
    });
  });

  // ── batchScreenStocks ────────────────────────────────────────
  describe('batchScreenStocks', () => {
    it('should screen multiple batches', async () => {
      const batches = [
        {
          name: 'tech',
          stocks: [makeStock('AAPL'), makeStock('GOOGL'), makeStock('MSFT')],
          criteria: makeScreenCriteria({ maxPe: 25 }),
        },
        {
          name: 'finance',
          stocks: [makeStock('JPM', { pe: 12, roe: 0.12 }), makeStock('BAC', { pe: 10, roe: 0.10 })],
          criteria: makeScreenCriteria({ minRoe: 0.10 }),
        },
      ];
      const results = await batchScreenStocks(batches);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle empty batches', async () => {
      const results = await batchScreenStocks([]);
      expect(results.length).toBe(0);
    });
  });
});
