/**
 * J-47-01: 国际化数据管道测试
 * 测试多币种财报、多时区时间转换、多币种汇率换算
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  I18nDataPipeline,
  createI18nDataPipeline,
  CurrencyConfig,
  TimezoneConfig,
  CurrencyRate,
  FinancialData,
} from '../electron/engine/i18n-data-pipeline';

describe('I18nDataPipeline', () => {
  let pipeline: I18nDataPipeline;

  beforeEach(() => {
    pipeline = createI18nDataPipeline();
  });

  describe('Currency Management', () => {
    it('should initialize with default currencies', () => {
      const currencies = pipeline.getAllCurrencies();
      expect(currencies.length).toBeGreaterThan(0);
      expect(pipeline.getCurrency('USD')).toBeDefined();
      expect(pipeline.getCurrency('EUR')).toBeDefined();
      expect(pipeline.getCurrency('CNY')).toBeDefined();
    });

    it('should add new currency', () => {
      const newCurrency: CurrencyConfig = {
        code: 'HKD',
        symbol: 'HK$',
        name: 'Hong Kong Dollar',
        decimals: 2,
      };

      pipeline.addCurrency(newCurrency);
      expect(pipeline.getCurrency('HKD')).toBeDefined();
      expect(pipeline.getCurrency('HKD')?.symbol).toBe('HK$');
    });

    it('should get all currencies', () => {
      const currencies = pipeline.getAllCurrencies();
      expect(currencies).toBeInstanceOf(Array);
      expect(currencies.length).toBeGreaterThan(0);
    });
  });

  describe('Currency Rate Management', () => {
    it('should update currency rates', () => {
      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
        { from: 'USD', to: 'GBP', rate: 0.73, timestamp: Date.now() },
      ];

      pipeline.updateRates(rates);
      expect(pipeline.getRate('USD', 'EUR')).toBe(0.85);
      expect(pipeline.getRate('USD', 'GBP')).toBe(0.73);
    });

    it('should add reverse rates automatically', () => {
      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
      ];

      pipeline.updateRates(rates);
      expect(pipeline.getRate('EUR', 'USD')).toBeCloseTo(1 / 0.85, 4);
    });

    it('should return 1 for same currency conversion', () => {
      expect(pipeline.getRate('USD', 'USD')).toBe(1);
    });
  });

  describe('Currency Conversion', () => {
    it('should convert currency correctly', () => {
      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
      ];
      pipeline.updateRates(rates);

      const converted = pipeline.convertCurrency(100, 'USD', 'EUR');
      expect(converted).toBe(85);
    });

    it('should handle same currency conversion', () => {
      const converted = pipeline.convertCurrency(100, 'USD', 'USD');
      expect(converted).toBe(100);
    });

    it('should round to correct decimals', () => {
      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'JPY', rate: 110.5, timestamp: Date.now() },
      ];
      pipeline.updateRates(rates);

      const converted = pipeline.convertCurrency(100, 'USD', 'JPY');
      expect(converted).toBe(11050); // JPY has 0 decimals
    });

    it('should format currency correctly', () => {
      const formatted = pipeline.formatCurrency(1234.56, 'USD');
      expect(formatted).toContain('$');
      expect(formatted).toContain('1234.56');
    });
  });

  describe('Timezone Management', () => {
    it('should initialize with default timezones', () => {
      const timezones = pipeline.getAllTimezones();
      expect(timezones.length).toBeGreaterThan(0);
      expect(pipeline.getTimezone('UTC')).toBeDefined();
      expect(pipeline.getTimezone('Asia/Shanghai')).toBeDefined();
    });

    it('should add new timezone', () => {
      const newTimezone: TimezoneConfig = {
        timezone: 'Australia/Sydney',
        offset: 600, // UTC+10
        name: 'Australian Eastern Time',
      };

      pipeline.addTimezone(newTimezone);
      expect(pipeline.getTimezone('Australia/Sydney')).toBeDefined();
    });

    it('should get all timezones', () => {
      const timezones = pipeline.getAllTimezones();
      expect(timezones).toBeInstanceOf(Array);
      expect(timezones.length).toBeGreaterThan(0);
    });
  });

  describe('Timezone Conversion', () => {
    it('should convert timezone correctly', () => {
      const baseTime = Date.now();
      const converted = pipeline.convertTimezone(baseTime, 'UTC', 'Asia/Shanghai');
      
      // Asia/Shanghai is UTC+8
      expect(converted).toBe(baseTime + 8 * 60 * 60 * 1000);
    });

    it('should handle same timezone conversion', () => {
      const baseTime = Date.now();
      const converted = pipeline.convertTimezone(baseTime, 'UTC', 'UTC');
      expect(converted).toBe(baseTime);
    });

    it('should format timezone correctly', () => {
      const baseTime = Date.now();
      const formatted = pipeline.formatTimezone(baseTime, 'Asia/Shanghai', 'zh-CN');
      expect(formatted).toBeDefined();
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('Data Conversion', () => {
    it('should convert financial data with currency', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        timestamp: Date.now(),
        value: 100,
        currency: 'USD',
        timezone: 'UTC',
      };

      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
      ];
      pipeline.updateRates(rates);

      const result = pipeline.convertData(data, {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
      });

      expect(result.data.currency).toBe('EUR');
      expect(result.data.value).toBe(85);
      expect(result.conversions.currency).toBeDefined();
      expect(result.conversions.currency?.rate).toBe(0.85);
    });

    it('should convert financial data with timezone', () => {
      const baseTime = Date.now();
      const data: FinancialData = {
        symbol: 'AAPL',
        timestamp: baseTime,
        value: 100,
        currency: 'USD',
        timezone: 'UTC',
      };

      const result = pipeline.convertData(data, {
        fromTimezone: 'UTC',
        toTimezone: 'Asia/Shanghai',
      });

      expect(result.data.timezone).toBe('Asia/Shanghai');
      expect(result.data.timestamp).toBe(baseTime + 8 * 60 * 60 * 1000);
      expect(result.conversions.timezone).toBeDefined();
    });

    it('should convert both currency and timezone', () => {
      const baseTime = Date.now();
      const data: FinancialData = {
        symbol: 'AAPL',
        timestamp: baseTime,
        value: 100,
        currency: 'USD',
        timezone: 'UTC',
      };

      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
      ];
      pipeline.updateRates(rates);

      const result = pipeline.convertData(data, {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        fromTimezone: 'UTC',
        toTimezone: 'Asia/Shanghai',
      });

      expect(result.data.currency).toBe('EUR');
      expect(result.data.value).toBe(85);
      expect(result.data.timezone).toBe('Asia/Shanghai');
      expect(result.conversions.currency).toBeDefined();
      expect(result.conversions.timezone).toBeDefined();
    });

    it('should handle same currency and timezone conversion', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        timestamp: Date.now(),
        value: 100,
        currency: 'USD',
        timezone: 'UTC',
      };

      const result = pipeline.convertData(data, {
        fromCurrency: 'USD',
        toCurrency: 'USD',
        fromTimezone: 'UTC',
        toTimezone: 'UTC',
      });

      expect(result.data.currency).toBe('USD');
      expect(result.data.value).toBe(100);
    });
  });

  describe('Batch Data Conversion', () => {
    it('should convert batch data', () => {
      const dataList: FinancialData[] = [
        {
          symbol: 'AAPL',
          timestamp: Date.now(),
          value: 100,
          currency: 'USD',
          timezone: 'UTC',
        },
        {
          symbol: 'GOOGL',
          timestamp: Date.now(),
          value: 200,
          currency: 'USD',
          timezone: 'UTC',
        },
      ];

      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
      ];
      pipeline.updateRates(rates);

      const results = pipeline.convertDataBatch(dataList, {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
      });

      expect(results.length).toBe(2);
      expect(results[0].data.currency).toBe('EUR');
      expect(results[0].data.value).toBe(85);
      expect(results[1].data.currency).toBe('EUR');
      expect(results[1].data.value).toBe(170);
    });
  });

  describe('Cache Management', () => {
    it('should cache conversion results', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        timestamp: Date.now(),
        value: 100,
        currency: 'USD',
        timezone: 'UTC',
      };

      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
      ];
      pipeline.updateRates(rates);

      const result1 = pipeline.convertDataWithCache(data, {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
      });

      const result2 = pipeline.convertDataWithCache(data, {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
      });

      expect(result1.data.value).toBe(result2.data.value);
      
      const stats = pipeline.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        timestamp: Date.now(),
        value: 100,
        currency: 'USD',
        timezone: 'UTC',
      };

      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
      ];
      pipeline.updateRates(rates);

      pipeline.convertDataWithCache(data, {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
      });

      pipeline.clearCache();
      const stats = pipeline.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should get cache stats', () => {
      const stats = pipeline.getCacheStats();
      expect(stats.hits).toBeDefined();
      expect(stats.misses).toBeDefined();
      expect(stats.size).toBeDefined();
      expect(stats.hitRate).toBeDefined();
    });
  });

  describe('Format Financial Data', () => {
    it('should format financial data correctly', () => {
      const data: FinancialData = {
        symbol: 'AAPL',
        timestamp: Date.now(),
        value: 1234.56,
        currency: 'USD',
        timezone: 'Asia/Shanghai',
      };

      const formatted = pipeline.formatFinancialData(data, 'zh-CN');
      expect(formatted).toContain('AAPL');
      expect(formatted).toContain('$');
      expect(formatted).toContain('1234.56');
    });
  });

  describe('Statistics', () => {
    it('should get pipeline stats', () => {
      const stats = pipeline.getStats();
      expect(stats.currencies).toBeDefined();
      expect(stats.timezones).toBeDefined();
      expect(stats.rates).toBeDefined();
      expect(stats.cacheSize).toBeDefined();
      expect(stats.cacheHitRate).toBeDefined();
    });

    it('should have correct initial stats', () => {
      const stats = pipeline.getStats();
      expect(stats.currencies).toBeGreaterThan(0);
      expect(stats.timezones).toBeGreaterThan(0);
      expect(stats.cacheSize).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit currency-added event', async () => {
      const promise = new Promise<string>((resolve) => {
        pipeline.on('currency-added', (code: string) => {
          resolve(code);
        });
      });

      const newCurrency: CurrencyConfig = {
        code: 'HKD',
        symbol: 'HK$',
        name: 'Hong Kong Dollar',
        decimals: 2,
      };

      pipeline.addCurrency(newCurrency);
      const code = await promise;
      expect(code).toBe('HKD');
    });

    it('should emit timezone-added event', async () => {
      const promise = new Promise<string>((resolve) => {
        pipeline.on('timezone-added', (timezone: string) => {
          resolve(timezone);
        });
      });

      const newTimezone: TimezoneConfig = {
        timezone: 'Australia/Sydney',
        offset: 600,
        name: 'Australian Eastern Time',
      };

      pipeline.addTimezone(newTimezone);
      const timezone = await promise;
      expect(timezone).toBe('Australia/Sydney');
    });

    it('should emit rates-updated event', async () => {
      const promise = new Promise<number>((resolve) => {
        pipeline.on('rates-updated', (count: number) => {
          resolve(count);
        });
      });

      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
        { from: 'USD', to: 'GBP', rate: 0.73, timestamp: Date.now() },
      ];

      pipeline.updateRates(rates);
      const count = await promise;
      expect(count).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown currency', () => {
      const formatted = pipeline.formatCurrency(100, 'UNKNOWN');
      expect(formatted).toBe('100');
    });

    it('should handle unknown timezone', () => {
      const baseTime = Date.now();
      const formatted = pipeline.formatTimezone(baseTime, 'Unknown/Timezone', 'en-US');
      expect(formatted).toBeDefined();
    });

    it('should handle zero value', () => {
      const converted = pipeline.convertCurrency(0, 'USD', 'EUR');
      expect(converted).toBe(0);
    });

    it('should handle negative value', () => {
      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
      ];
      pipeline.updateRates(rates);

      const converted = pipeline.convertCurrency(-100, 'USD', 'EUR');
      expect(converted).toBe(-85);
    });

    it('should handle very large value', () => {
      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
      ];
      pipeline.updateRates(rates);

      const converted = pipeline.convertCurrency(1000000000, 'USD', 'EUR');
      expect(converted).toBe(850000000);
    });

    it('should handle very small value', () => {
      const rates: CurrencyRate[] = [
        { from: 'USD', to: 'EUR', rate: 0.85, timestamp: Date.now() },
      ];
      pipeline.updateRates(rates);

      const converted = pipeline.convertCurrency(0.01, 'USD', 'EUR');
      expect(converted).toBeCloseTo(0.0085, 4);
    });
  });
});
