/**
 * JVS-83: Data Aggregator Benchmark Tests
 * Performance benchmarks for multi-source data aggregation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataAggregator,
  DataSource,
  QuoteData,
  validateQuoteData,
  normalizeQuoteData,
  calculateDataQuality,
} from '../electron/data/data-aggregator';

describe('JVS-83: Data Aggregator Benchmarks', () => {
  let aggregator: DataAggregator;

  beforeEach(() => {
    aggregator = new DataAggregator({
      sources: [
        { name: 'source1', type: 'opend', priority: 1, timeout: 5000, maxRetries: 2 },
        { name: 'source2', type: 'yahoo', priority: 2, timeout: 5000, maxRetries: 2 },
      ],
      qualityThreshold: 60,
      fallbackEnabled: true,
      cacheEnabled: true,
      cacheTTL: 60000,
    });
  });

  describe('Performance Benchmarks', () => {
    it('should validate 1000 quotes in < 100ms', () => {
      const quotes: QuoteData[] = [];
      for (let i = 0; i < 1000; i++) {
        quotes.push({
          code: `STOCK${i}`,
          price: 100 + i,
          change: 2.50,
          changePct: 1.5,
          volume: 1000000,
          timestamp: Date.now(),
          source: 'opend',
        });
      }

      const start = performance.now();
      for (const quote of quotes) {
        validateQuoteData(quote);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      console.log(`Validated 1000 quotes in ${duration.toFixed(2)}ms`);
    });

    it('should normalize 1000 quotes in < 100ms', () => {
      const quotes: QuoteData[] = [];
      for (let i = 0; i < 1000; i++) {
        quotes.push({
          code: `STOCK${i}`,
          price: 100.567 + i,
          change: 2.567,
          changePct: 1.567,
          volume: 1000000,
          high: 151.123,
          low: 149.456,
          open: 150.789,
          turnover: 150000000.5,
          timestamp: Date.now(),
          source: 'opend',
        });
      }

      const start = performance.now();
      for (const quote of quotes) {
        normalizeQuoteData(quote);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      console.log(`Normalized 1000 quotes in ${duration.toFixed(2)}ms`);
    });

    it('should calculate quality for 1000 quotes in < 200ms', () => {
      const quotes: QuoteData[] = [];
      for (let i = 0; i < 1000; i++) {
        quotes.push({
          code: `STOCK${i}`,
          price: 100 + i,
          change: 2.50,
          changePct: 1.5,
          volume: 1000000,
          high: 151.00,
          low: 149.50,
          open: 150.00,
          turnover: 150000000,
          timestamp: Date.now() - 10000,
          source: 'opend',
        });
      }

      const start = performance.now();
      for (const quote of quotes) {
        calculateDataQuality(quote);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
      console.log(`Calculated quality for 1000 quotes in ${duration.toFixed(2)}ms`);
    });

    it('should cache 1000 quotes efficiently', () => {
      const quotes: QuoteData[] = [];
      for (let i = 0; i < 1000; i++) {
        quotes.push({
          code: `STOCK${i}`,
          price: 100 + i,
          change: 2.50,
          changePct: 1.5,
          volume: 1000000,
          timestamp: Date.now(),
          source: 'opend',
        });
      }

      const start = performance.now();
      for (const quote of quotes) {
        (aggregator as any).cache.set(quote.code, {
          quote,
          timestamp: Date.now(),
        });
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect((aggregator as any).cache.size).toBe(1000);
      console.log(`Cached 1000 quotes in ${duration.toFixed(2)}ms`);
    });

    it('should retrieve 1000 cached quotes efficiently', () => {
      // Populate cache
      for (let i = 0; i < 1000; i++) {
        (aggregator as any).cache.set(`STOCK${i}`, {
          quote: {
            code: `STOCK${i}`,
            price: 100 + i,
            change: 2.50,
            changePct: 1.5,
            volume: 1000000,
            timestamp: Date.now(),
            source: 'cache',
          },
          timestamp: Date.now(),
        });
      }

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        (aggregator as any).cache.get(`STOCK${i}`);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      console.log(`Retrieved 1000 cached quotes in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Benchmarks', () => {
    it('should handle 10000 cached quotes', () => {
      for (let i = 0; i < 10000; i++) {
        (aggregator as any).cache.set(`STOCK${i}`, {
          quote: {
            code: `STOCK${i}`,
            price: 100 + i,
            change: 2.50,
            changePct: 1.5,
            volume: 1000000,
            timestamp: Date.now(),
            source: 'cache',
          },
          timestamp: Date.now(),
        });
      }

      expect((aggregator as any).cache.size).toBe(10000);
      console.log(`Successfully cached 10000 quotes`);
    });

    it('should maintain cache performance with large cache', () => {
      // Populate with 5000 quotes
      for (let i = 0; i < 5000; i++) {
        (aggregator as any).cache.set(`STOCK${i}`, {
          quote: {
            code: `STOCK${i}`,
            price: 100 + i,
            change: 2.50,
            changePct: 1.5,
            volume: 1000000,
            timestamp: Date.now(),
            source: 'cache',
          },
          timestamp: Date.now(),
        });
      }

      // Measure retrieval performance
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        const idx = Math.floor(Math.random() * 5000);
        (aggregator as any).cache.get(`STOCK${idx}`);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      console.log(`Retrieved 1000 random quotes from 5000 cache in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Stress Tests', () => {
    it('should handle rapid cache updates', async () => {
      const updates = 1000;
      const start = performance.now();

      for (let i = 0; i < updates; i++) {
        const code = `STOCK${i % 100}`;
        (aggregator as any).cache.set(code, {
          quote: {
            code,
            price: 100 + i,
            change: 2.50,
            changePct: 1.5,
            volume: 1000000,
            timestamp: Date.now(),
            source: 'cache',
          },
          timestamp: Date.now(),
        });
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200);
      console.log(`Updated cache ${updates} times in ${duration.toFixed(2)}ms`);
    });

    it('should handle cache cleanup efficiently', () => {
      // Populate cache
      for (let i = 0; i < 1000; i++) {
        (aggregator as any).cache.set(`STOCK${i}`, {
          quote: {
            code: `STOCK${i}`,
            price: 100 + i,
            change: 2.50,
            changePct: 1.5,
            volume: 1000000,
            timestamp: Date.now() - 120000, // 2 minutes ago
          },
          timestamp: Date.now() - 120000,
        });
      }

      const start = performance.now();
      aggregator.clearCache();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200); // realistic threshold for CI environment
      expect((aggregator as any).cache.size).toBe(0);
      console.log(`Cleared 1000 cached quotes in ${duration.toFixed(2)}ms`);
    });
  });
});
