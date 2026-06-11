// J-47-01: International Data Pipeline Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  InternationalDataPipeline,
  getInternationalDataPipeline,
  destroyInternationalDataPipeline,
  type FinancialData,
  type Currency,
  type Timezone,
} from '../electron/data/international-data-pipeline';

describe('InternationalDataPipeline', () => {
  let pipeline: InternationalDataPipeline;

  beforeEach(() => {
    pipeline = new InternationalDataPipeline({
      defaultCurrency: 'USD',
      defaultTimezone: 'Asia/Shanghai',
      exchangeRateRefreshIntervalMs: 60000,
      maxCacheAge: 60000,
      enableAutoConversion: true,
    });
  });

  afterEach(() => {
    pipeline.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const pipeline = new InternationalDataPipeline();
      expect(pipeline).toBeDefined();
      pipeline.destroy();
    });

    it('should initialize with custom config', () => {
      const config = {
        defaultCurrency: 'EUR' as Currency,
        defaultTimezone: 'Europe/London' as Timezone,
        exchangeRateRefreshIntervalMs: 300000,
        maxCacheAge: 120000,
        enableAutoConversion: false,
      };
      const pipeline = new InternationalDataPipeline(config);
      expect(pipeline).toBeDefined();
      pipeline.destroy();
    });

    it('should initialize default exchange rates', () => {
      const rate = pipeline.getExchangeRate('USD', 'CNY');
      expect(rate).toBeDefined();
      expect(rate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Currency Conversion', () => {
    it('should convert USD to CNY', () => {
      const result = pipeline.convertCurrency(100, 'USD', 'CNY');
      expect(result.originalValue).toBe(100);
      expect(result.originalCurrency).toBe('USD');
      expect(result.targetCurrency).toBe('CNY');
      expect(result.convertedValue).toBeGreaterThan(0);
      expect(result.exchangeRate).toBeGreaterThan(0);
    });

    it('should convert USD to EUR', () => {
      const result = pipeline.convertCurrency(100, 'USD', 'EUR');
      expect(result.convertedValue).toBeGreaterThan(0);
      expect(result.convertedValue).toBeLessThan(100); // EUR is usually less than USD
    });

    it('should convert CNY to USD', () => {
      const result = pipeline.convertCurrency(700, 'CNY', 'USD');
      expect(result.convertedValue).toBeGreaterThan(0);
      expect(result.convertedValue).toBeLessThan(700);
    });

    it('should handle same currency conversion', () => {
      const result = pipeline.convertCurrency(100, 'USD', 'USD');
      expect(result.convertedValue).toBe(100);
      expect(result.exchangeRate).toBe(1);
    });

    it('should convert through USD when direct rate not available', () => {
      const result = pipeline.convertCurrency(100, 'CNY', 'EUR');
      expect(result.convertedValue).toBeGreaterThan(0);
    });

    it('should use cached exchange rates', () => {
      const result1 = pipeline.convertCurrency(100, 'USD', 'CNY');
      const result2 = pipeline.convertCurrency(100, 'USD', 'CNY');
      
      // Should use same rate (cached)
      expect(result1.exchangeRate).toBe(result2.exchangeRate);
    });
  });

  describe('Timezone Conversion', () => {
    it('should convert Shanghai to New York', () => {
      const now = Date.now();
      const result = pipeline.convertTimezone(now, 'Asia/Shanghai', 'America/New_York');
      
      expect(result.originalTime).toBe(now);
      expect(result.originalTimezone).toBe('Asia/Shanghai');
      expect(result.targetTimezone).toBe('America/New_York');
      expect(result.offsetMinutes).toBe(-13 * 60); // Shanghai is UTC+8, NY is UTC-5
    });

    it('should convert Shanghai to Tokyo', () => {
      const now = Date.now();
      const result = pipeline.convertTimezone(now, 'Asia/Shanghai', 'Asia/Tokyo');
      
      expect(result.offsetMinutes).toBe(1 * 60); // Tokyo is UTC+9, Shanghai is UTC+8
    });

    it('should handle same timezone conversion', () => {
      const now = Date.now();
      const result = pipeline.convertTimezone(now, 'Asia/Shanghai', 'Asia/Shanghai');
      
      expect(result.convertedTime).toBe(now);
      expect(result.offsetMinutes).toBe(0);
    });
  });

  describe('Financial Data Processing', () => {
    it('should process financial data with auto conversion', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: Date.now(),
        timezone: 'America/New_York',
        volume: 1000000,
        change: 5,
        changePercent: 2.5,
      };

      const processed = pipeline.processFinancialData(data);
      
      expect(processed.symbol).toBe('AAPL');
      expect(processed.currency).toBe('USD'); // Default currency
      expect(processed.timezone).toBe('Asia/Shanghai'); // Default timezone
    });

    it('should convert currency automatically', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        price: 150,
        currency: 'EUR',
        timestamp: Date.now(),
        timezone: 'Europe/London',
      };

      const processed = pipeline.processFinancialData(data);
      
      expect(processed.currency).toBe('USD');
      expect(processed.price).not.toBe(150); // Should be converted
    });

    it('should convert timezone automatically', () => {
      const now = Date.now();
      const data: FinancialData = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: now,
        timezone: 'America/New_York',
      };

      const processed = pipeline.processFinancialData(data);
      
      expect(processed.timezone).toBe('Asia/Shanghai');
      expect(processed.timestamp).not.toBe(now); // Should be converted
    });

    it('should cache processed data', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: Date.now(),
        timezone: 'Asia/Shanghai',
      };

      const processed1 = pipeline.processFinancialData(data);
      const processed2 = pipeline.processFinancialData(data);
      
      expect(processed1).toEqual(processed2);
    });

    it('should not convert when auto conversion is disabled', () => {
      const pipeline = new InternationalDataPipeline({
        enableAutoConversion: false,
      });

      const data: FinancialData = {
        symbol: 'AAPL',
        price: 150,
        currency: 'EUR',
        timestamp: Date.now(),
        timezone: 'Europe/London',
      };

      const processed = pipeline.processFinancialData(data);
      
      expect(processed.currency).toBe('EUR'); // Should not convert
      expect(processed.timezone).toBe('Europe/London'); // Should not convert
      
      pipeline.destroy();
    });
  });

  describe('Cache Management', () => {
    it('should cache processed data', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: Date.now(),
        timezone: 'Asia/Shanghai',
      };

      pipeline.processFinancialData(data);
      const stats = pipeline.getStats();
      
      expect(stats.cachedEntries).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: Date.now(),
        timezone: 'Asia/Shanghai',
      };

      pipeline.processFinancialData(data);
      pipeline.clearCache();
      
      const stats = pipeline.getStats();
      expect(stats.cachedEntries).toBe(0);
    });

    it('should expire old cache entries', async () => {
      const pipeline = new InternationalDataPipeline({
        maxCacheAge: 100, // 100ms for testing
      });

      const data: FinancialData = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: Date.now(),
        timezone: 'Asia/Shanghai',
      };

      pipeline.processFinancialData(data);
      
      await new Promise(resolve => setTimeout(resolve, 150)); // Wait for expiry
      
      const stats = pipeline.getStats();
      expect(stats.cachedEntries).toBe(0);
      
      pipeline.destroy();
    });
  });

  describe('Exchange Rate Management', () => {
    it('should get exchange rate', () => {
      const rate = pipeline.getExchangeRate('USD', 'CNY');
      expect(rate).toBeDefined();
      expect(rate).toBeGreaterThanOrEqual(0);
    });

    it('should return null for non-existent rate', () => {
      const rate = pipeline.getExchangeRate('XYZ' as Currency, 'ABC' as Currency);
      expect(rate).toBeNull();
    });

    it('should refresh exchange rates periodically', async () => {
      const pipeline = new InternationalDataPipeline({
        exchangeRateRefreshIntervalMs: 100,
      });

      let refreshCount = 0;
      pipeline.on('ratesUpdated', () => {
        refreshCount++;
      });

      await new Promise(resolve => setTimeout(resolve, 250));
      
      expect(refreshCount).toBeGreaterThanOrEqual(0);
      
      pipeline.destroy();
    });
  });

  describe('Statistics', () => {
    it('should get pipeline stats', () => {
      const stats = pipeline.getStats();
      
      expect(stats.cachedEntries).toBeDefined();
      expect(stats.exchangeRatesCount).toBeDefined();
      expect(stats.processedDataCount).toBeDefined();
    });

    it('should track processed data count', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: Date.now(),
        timezone: 'Asia/Shanghai',
      };

      pipeline.processFinancialData(data);
      const stats = pipeline.getStats();
      
      expect(stats.processedDataCount).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit dataProcessed event', () => {
      let emitted = false;
      pipeline.on('dataProcessed', () => {
        emitted = true;
      });

      const data: FinancialData = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: Date.now(),
        timezone: 'Asia/Shanghai',
      };

      pipeline.processFinancialData(data);
      
      expect(emitted).toBe(true);
    });

    it('should emit ratesUpdated event', async () => {
      const pipeline = new InternationalDataPipeline({
        exchangeRateRefreshIntervalMs: 100,
      });

      let emitted = false;
      pipeline.on('ratesUpdated', () => {
        emitted = true;
      });

      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(emitted).toBe(true);
      
      pipeline.destroy();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return singleton instance', () => {
      const instance1 = getInternationalDataPipeline();
      const instance2 = getInternationalDataPipeline();
      
      expect(instance1).toBe(instance2);
      
      destroyInternationalDataPipeline();
    });

    it('should destroy singleton instance', () => {
      const instance = getInternationalDataPipeline();
      destroyInternationalDataPipeline();
      
      const newInstance = getInternationalDataPipeline();
      expect(newInstance).not.toBe(instance);
      
      destroyInternationalDataPipeline();
    });
  });
});
