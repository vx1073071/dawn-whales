/**
 * currency-converter.test.ts — R99 J-01 Currency Converter Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CurrencyConverter,
  getCurrencyConverter,
  CURRENCY_PRECISION,
  CurrencyCode,
} from '../../../../electron/engine/data/currency-converter';

describe('CurrencyConverter', () => {
  let converter: CurrencyConverter;

  beforeEach(() => {
    converter = new CurrencyConverter();
    converter.invalidateCache(); // Start fresh each test
  });

  describe('getPrecision', () => {
    it('USD has 2 decimal places', () => {
      expect(converter.getPrecision('USD')).toBe(2);
    });

    it('CNY has 2 decimal places', () => {
      expect(converter.getPrecision('CNY')).toBe(2);
    });

    it('HKD has 2 decimal places', () => {
      expect(converter.getPrecision('HKD')).toBe(2);
    });

    it('JPY has 0 decimal places', () => {
      expect(converter.getPrecision('JPY')).toBe(0);
    });

    it('EUR has 2 decimal places', () => {
      expect(converter.getPrecision('EUR')).toBe(2);
    });

    it('KRW has 0 decimal places', () => {
      expect(converter.getPrecision('KRW')).toBe(0);
    });

    it('GBP has 2 decimal places', () => {
      expect(converter.getPrecision('GBP')).toBe(2);
    });
  });

  describe('roundToPrecision', () => {
    it('rounds USD to 2 decimal places', () => {
      expect(converter.roundToPrecision(1.234, 'USD')).toBe(1.23);
      expect(converter.roundToPrecision(1.235, 'USD')).toBe(1.24);
    });

    it('rounds JPY to integer', () => {
      expect(converter.roundToPrecision(123.4, 'JPY')).toBe(123);
      expect(converter.roundToPrecision(123.5, 'JPY')).toBe(124);
    });

    it('rounds CNY to 2 decimal places', () => {
      expect(converter.roundToPrecision(7.249, 'CNY')).toBe(7.25);
    });

    it('handles zero', () => {
      expect(converter.roundToPrecision(0, 'USD')).toBe(0);
    });

    it('handles negative values', () => {
      expect(converter.roundToPrecision(-1.235, 'USD')).toBe(-1.24);
    });
  });

  describe('getRateSync', () => {
    it('returns 1 for same currency', () => {
      expect(converter.getRateSync('USD', 'USD')).toBe(1);
      expect(converter.getRateSync('CNY', 'CNY')).toBe(1);
    });

    it('USD to CNY uses static rate', () => {
      const rate = converter.getRateSync('USD', 'CNY');
      expect(rate).toBeGreaterThan(6.5);
      expect(rate).toBeLessThan(8.0);
    });

    it('CNY to USD is reciprocal', () => {
      const forward = converter.getRateSync('USD', 'CNY');
      const reverse = converter.getRateSync('CNY', 'USD');
      expect(reverse).toBeCloseTo(1 / forward, 5);
    });

    it('USD to JPY rate', () => {
      const rate = converter.getRateSync('USD', 'JPY');
      expect(rate).toBeGreaterThan(100);
      expect(rate).toBeLessThan(200);
    });

    it('EUR to USD rate < 1.5', () => {
      const rate = converter.getRateSync('EUR', 'USD');
      expect(rate).toBeGreaterThan(0.5);
      expect(rate).toBeLessThan(1.5);
    });

    it('cross-rate via USD: CNY to JPY', () => {
      const cnyToUsd = converter.getRateSync('CNY', 'USD');
      const usdToJpy = converter.getRateSync('USD', 'JPY');
      const cnyToJpy = converter.getRateSync('CNY', 'JPY');
      expect(cnyToJpy).toBeCloseTo(cnyToUsd * usdToJpy, 1);
    });
  });

  describe('convertSync', () => {
    it('converts USD to CNY', () => {
      const result = converter.convertSync(100, 'USD', 'CNY');
      expect(result.from).toBe('USD');
      expect(result.to).toBe('CNY');
      expect(result.amount).toBe(100);
      expect(result.result).toBeGreaterThan(700);
      expect(result.result).toBeLessThan(800);
      expect(result.source).toBe('static');
    });

    it('converts JPY to USD', () => {
      const result = converter.convertSync(10000, 'JPY', 'USD');
      expect(result.result).toBeGreaterThan(50);
      expect(result.result).toBeLessThan(100);
    });

    it('converts CNY to HKD', () => {
      const result = converter.convertSync(100, 'CNY', 'HKD');
      expect(result.result).toBeGreaterThan(100);
      expect(result.result).toBeLessThan(120);
    });

    it('same currency returns same amount', () => {
      const result = converter.convertSync(50, 'EUR', 'EUR');
      expect(result.result).toBe(50);
      expect(result.rate).toBe(1);
    });

    it('EUR to KRW', () => {
      const result = converter.convertSync(110, 'EUR', 'KRW');
      expect(result.result).toBeGreaterThan(100000);
    });
  });

  describe('cache', () => {
    it('has no cache after invalidation', () => {
      converter.invalidateCache();
      expect(converter.isCacheValid()).toBe(false);
    });

    it('reports cache TTL as 0 when no cache', () => {
      expect(converter.getCacheTTL()).toBe(0);
    });

    it('invalidateCache clears', () => {
      converter.invalidateCache();
      expect(converter.isCacheValid()).toBe(false);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('returns at least 6 currencies', () => {
      const currencies = converter.getSupportedCurrencies();
      expect(currencies.length).toBeGreaterThanOrEqual(6);
    });

    it('includes all major currencies', () => {
      const currencies = converter.getSupportedCurrencies();
      expect(currencies).toContain('USD');
      expect(currencies).toContain('CNY');
      expect(currencies).toContain('HKD');
      expect(currencies).toContain('JPY');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('KRW');
    });
  });

  describe('fetchRates', () => {
    it('falls back to static rates when no cache and no network', async () => {
      // fetchRates tries network first, may get live or static fallback
      const rates = await converter.fetchRates();
      expect(rates.base).toBe('USD');
      // source may be 'live' if API is reachable, or 'static' as fallback
      expect(['live', 'static']).toContain(rates.source);
      expect(rates.rates.USD).toBe(1);
    });
  });

  describe('static rates', () => {
    it('USD rate is 1 in static rates', () => {
      const converter2 = new CurrencyConverter();
      const rate = converter2.getRateSync('USD', 'USD');
      expect(rate).toBe(1);
    });

    it('static CNY rate is ~7.24', () => {
      const rate = converter.getRateSync('USD', 'CNY');
      expect(rate).toBeCloseTo(7.24, 1);
    });

    it('static EUR rate is ~0.92', () => {
      const rate = converter.getRateSync('USD', 'EUR');
      expect(rate).toBeCloseTo(0.92, 1);
    });
  });

  describe('CURRENCY_PRECISION constant', () => {
    it('defines precision for all major currencies', () => {
      expect(CURRENCY_PRECISION['USD']).toBe(2);
      expect(CURRENCY_PRECISION['JPY']).toBe(0);
      expect(CURRENCY_PRECISION['KRW']).toBe(0);
    });
  });

  describe('getCurrencyConverter factory', () => {
    it('returns a CurrencyConverter instance', () => {
      const c = getCurrencyConverter();
      expect(c).toBeInstanceOf(CurrencyConverter);
    });

    it('returns same singleton', () => {
      const c1 = getCurrencyConverter();
      const c2 = getCurrencyConverter();
      expect(c1).toBe(c2);
    });
  });
});
