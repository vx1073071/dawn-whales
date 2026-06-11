/**
 * number-precision.test.ts — R99 J-02 Number Precision Engine Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  NumberPrecision,
  getNumberPrecision,
  numberPrecision,
  MARKET_PRECISION,
  CURRENCY_SYMBOLS,
  MarketCode,
  CurrencyCode,
} from '../../../../electron/engine/data/number-precision';

describe('NumberPrecision', () => {
  let np: NumberPrecision;

  beforeEach(() => {
    np = new NumberPrecision();
  });

  describe('pricePrecision', () => {
    it('US stocks: 2 decimal places', () => {
      expect(np.pricePrecision('US')).toBe(2);
    });

    it('CN stocks: 2 decimal places', () => {
      expect(np.pricePrecision('CN')).toBe(2);
    });

    it('HK stocks: 3 decimal places', () => {
      expect(np.pricePrecision('HK')).toBe(3);
    });

    it('JP stocks: 0 decimal places (integer)', () => {
      expect(np.pricePrecision('JP')).toBe(0);
    });

    it('UK stocks: 2 decimal places', () => {
      expect(np.pricePrecision('UK')).toBe(2);
    });

    it('EU stocks: 2 decimal places', () => {
      expect(np.pricePrecision('EU')).toBe(2);
    });

    it('CRYPTO: 8 decimal places', () => {
      expect(np.pricePrecision('CRYPTO')).toBe(8);
    });
  });

  describe('round', () => {
    it('rounds to 2 decimals', () => {
      expect(np.round(1.234, 2)).toBe(1.23);
      expect(np.round(1.235, 2)).toBe(1.24);
    });

    it('rounds to 0 decimals', () => {
      expect(np.round(123.4, 0)).toBe(123);
    });

    it('handles negative numbers', () => {
      expect(np.round(-1.235, 2)).toBe(-1.24);
    });

    it('handles zero', () => {
      expect(np.round(0, 4)).toBe(0);
    });

    it('rounds crypto to 8 decimals', () => {
      expect(np.round(0.123456789, 8)).toBe(0.12345679);
    });
  });

  describe('roundPrice', () => {
    it('rounds US price to 2 decimals', () => {
      expect(np.roundPrice(150.123, 'US')).toBe(150.12);
    });

    it('rounds HK price to 3 decimals', () => {
      expect(np.roundPrice(85.1234, 'HK')).toBe(85.123);
    });

    it('rounds JP price to integer', () => {
      expect(np.roundPrice(1200.5, 'JP')).toBe(1201);
    });

    it('rounds crypto to 8 decimals', () => {
      expect(np.roundPrice(0.12345678901, 'CRYPTO')).toBe(0.12345679);
    });
  });

  describe('formatNumber', () => {
    it('formats integer with comma separators', () => {
      expect(np.formatNumber(1234567)).toBe('1,234,567.00');
    });

    it('formats with custom decimals', () => {
      expect(np.formatNumber(1234.5, 'en', 1)).toBe('1,234.5');
    });

    it('formats with 0 decimals', () => {
      expect(np.formatNumber(1234567, 'en', 0)).toBe('1,234,567');
    });

    it('formats small number', () => {
      expect(np.formatNumber(42.123, 'en', 2)).toBe('42.12');
    });

    it('formats negative number', () => {
      const result = np.formatNumber(-1234.5, 'en', 1);
      expect(result).toContain('-');
    });

    it('zh-CN locale uses same comma style', () => {
      const result = np.formatNumber(1234567, 'zh-CN', 0);
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('567');
    });
  });

  describe('formatPercent', () => {
    it('formats 0.123 as 12.3%', () => {
      expect(np.formatPercent(0.123)).toBe('12.30%');
    });

    it('formats with custom decimals', () => {
      expect(np.formatPercent(0.1234, 0)).toBe('12%');
    });

    it('formats 1.0 as 100%', () => {
      expect(np.formatPercent(1.0, 0)).toBe('100%');
    });
  });

  describe('smartUnit', () => {
    it('small value returns raw number in en', () => {
      const result = np.smartUnit(123);
      expect(result.unit).toBe('');
      expect(result.divisor).toBe(1);
    });

    it('1234 returns no unit in en', () => {
      const result = np.smartUnit(1234, { locale: 'en' });
      expect(result.unit).toBe('');
    });

    it('12345 returns 1.23 K in en', () => {
      // K divisor = 10,000. 12345/10000 = 1.2345 → 1.23
      const result = np.smartUnit(12345, { locale: 'en', maxDecimals: 2 });
      expect(result.unit).toBe('K');
      expect(result.value).toBe(1.23);
    });

    it('1234567 returns 1.23 M in en', () => {
      const result = np.smartUnit(1234567, { locale: 'en', maxDecimals: 2 });
      expect(result.unit).toBe('M');
      expect(result.value).toBe(1.23);
    });

    it('1234567890 returns 1.23 B in en', () => {
      const result = np.smartUnit(1234567890, { locale: 'en', maxDecimals: 2 });
      expect(result.unit).toBe('B');
      expect(result.value).toBe(1.23);
    });

    it('zh-CN: 12345 returns 万', () => {
      const result = np.smartUnit(12345, { locale: 'zh-CN', maxDecimals: 2 });
      expect(result.unit).toBe('万');
    });

    it('zh-CN: 123456789 returns 亿', () => {
      const result = np.smartUnit(123456789, { locale: 'zh-CN', maxDecimals: 2 });
      expect(result.unit).toBe('亿');
    });

    it('zh-CN: 100000000 returns 1亿', () => {
      const result = np.smartUnit(100000000, { locale: 'zh-CN', maxDecimals: 0 });
      expect(result.unit).toBe('亿');
      expect(result.value).toBe(1);
    });

    it('ja: uses 万/億', () => {
      const result = np.smartUnit(10000, { locale: 'ja', maxDecimals: 0 });
      expect(result.unit).toBe('万');
    });

    it('negative value with unit', () => {
      const result = np.smartUnit(-5000000, { locale: 'en', maxDecimals: 2 });
      expect(result.formatted).toContain('-');
      expect(result.unit).toBe('M');
    });

    it('T threshold for en', () => {
      const result = np.smartUnit(2_000_000_000_000, { locale: 'en', maxDecimals: 1 });
      expect(result.unit).toBe('T');
    });
  });

  describe('formatMoney', () => {
    it('USD prefix with $', () => {
      const result = np.formatMoney(1234.56, 'USD');
      expect(result).toBe('$1,234.56');
    });

    it('CNY prefix with ¥', () => {
      const result = np.formatMoney(1000, 'CNY');
      expect(result).toBe('¥1,000.00');
    });

    it('JPY integer, ¥ prefix', () => {
      const result = np.formatMoney(5000, 'JPY');
      expect(result).toBe('¥5,000');
    });

    it('EUR prefix with €', () => {
      const result = np.formatMoney(99.99, 'EUR');
      expect(result).toBe('€99.99');
    });

    it('HKD prefix with HK$', () => {
      const result = np.formatMoney(88.5, 'HKD');
      expect(result).toBe('HK$88.50');
    });

    it('negative USD', () => {
      const result = np.formatMoney(-50, 'USD');
      expect(result).toContain('-$');
    });

    it('with smart unit for large amount', () => {
      const result = np.formatMoney(5000000, 'USD', 'en', { useSmartUnit: true });
      expect(result).toContain('M');
    });
  });

  describe('formatCompact', () => {
    it('uses smart unit abbreviation', () => {
      const result = np.formatCompact(1500000, 'en');
      expect(result).toContain('M');
    });

    it('standard notation no abbreviation', () => {
      const result = np.formatCompact(1500000, 'en', 'standard');
      expect(result).not.toContain('M');
    });
  });

  describe('getCurrencySymbol', () => {
    it('USD is $', () => {
      expect(np.getCurrencySymbol('USD')).toBe('$');
    });

    it('CNY is ¥', () => {
      expect(np.getCurrencySymbol('CNY')).toBe('¥');
    });

    it('EUR is €', () => {
      expect(np.getCurrencySymbol('EUR')).toBe('€');
    });

    it('GBP is £', () => {
      expect(np.getCurrencySymbol('GBP')).toBe('£');
    });

    it('HKD is HK$', () => {
      expect(np.getCurrencySymbol('HKD')).toBe('HK$');
    });
  });

  describe('getCurrencySymbolPosition', () => {
    it('USD is prefix', () => {
      expect(np.getCurrencySymbolPosition('USD')).toBe('prefix');
    });

    it('JPY is prefix', () => {
      expect(np.getCurrencySymbolPosition('JPY')).toBe('prefix');
    });
  });

  describe('formatVolume', () => {
    it('small volume uses raw number', () => {
      const result = np.formatVolume(500);
      expect(result).toContain('500');
    });

    it('large volume uses abbreviation', () => {
      const result = np.formatVolume(5000000, 'en');
      expect(result).toContain('M');
    });

    it('zh-CN: 5000000 uses 万', () => {
      const result = np.formatVolume(5000000, 'zh-CN');
      expect(result).toContain('万');
    });
  });

  describe('MARKET_PRECISION constant', () => {
    it('defines precision for all markets', () => {
      expect(MARKET_PRECISION['US']).toBe(2);
      expect(MARKET_PRECISION['CN']).toBe(2);
      expect(MARKET_PRECISION['HK']).toBe(3);
      expect(MARKET_PRECISION['JP']).toBe(0);
      expect(MARKET_PRECISION['UK']).toBe(2);
      expect(MARKET_PRECISION['EU']).toBe(2);
      expect(MARKET_PRECISION['CRYPTO']).toBe(8);
    });
  });

  describe('CURRENCY_SYMBOLS constant', () => {
    it('has all major symbols', () => {
      expect(CURRENCY_SYMBOLS['USD']).toBe('$');
      expect(CURRENCY_SYMBOLS['CNY']).toBe('¥');
      expect(CURRENCY_SYMBOLS['EUR']).toBe('€');
      expect(CURRENCY_SYMBOLS['GBP']).toBe('£');
      expect(CURRENCY_SYMBOLS['KRW']).toBe('₩');
    });
  });

  describe('getNumberPrecision factory', () => {
    it('returns NumberPrecision instance', () => {
      const p = getNumberPrecision();
      expect(p).toBeInstanceOf(NumberPrecision);
    });
  });

  describe('numberPrecision singleton', () => {
    it('is a NumberPrecision instance', () => {
      expect(numberPrecision).toBeInstanceOf(NumberPrecision);
    });
  });
});
