import { describe, it, expect } from 'vitest';
import { MarketScanner } from '../electron/workers/market-scanner';

describe('MarketScanner', () => {
  const stocks: any[] = [
    { symbol: 'AAPL', name: 'Apple', price: 180, change: 0.02, volume: 50000000, marketCap: 2800000000000, pe: 28, sector: 'Tech' },
    { symbol: 'XYZ', name: 'XYZ Corp', price: 0.5, change: -0.05, volume: 1000, marketCap: 5000000, pe: 5, sector: 'Energy' },
    { symbol: 'MSFT', name: 'Microsoft', price: 400, change: 0.03, volume: 30000000, marketCap: 3000000000000, pe: 35, sector: 'Tech' },
  ];

  it('should filter by price', () => {
    const scanner = new MarketScanner();
    scanner.setCriteria({ minPrice: 10 });
    const results = scanner.feed(stocks);
    expect(results.length).toBe(2);
    expect(results[0].symbol).toBe('MSFT'); // higher change = higher score
  });

  it('should filter out all', () => {
    const scanner = new MarketScanner();
    scanner.setCriteria({ minPrice: 1000 });
    const results = scanner.feed(stocks);
    expect(results.length).toBe(0);
  });

  it('should return top N', () => {
    const scanner = new MarketScanner();
    scanner.setCriteria({});
    scanner.feed(stocks);
    expect(scanner.top(1)).toHaveLength(1);
  });
});
