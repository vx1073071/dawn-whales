/**
 * stock-code-normalizer.test.ts — R100 J-01 Stock Code Normalizer Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  StockCodeNormalizer,
  stockCodeNormalizer,
  normalizeCode,
  formatCodeDisplay,
  getMarketName,
  NormalizedCode,
  MarketCode,
} from '../../../../electron/engine/data/stock-code-normalizer';

describe('StockCodeNormalizer', () => {
  let normalizer: StockCodeNormalizer;

  beforeEach(() => {
    normalizer = new StockCodeNormalizer();
  });

  // ═══════════════ US Market ═══════════════
  describe('US market codes', () => {
    it('recognizes AAPL as US', () => {
      const result = normalizer.normalize('AAPL');
      expect(result.market).toBe('US');
      expect(result.ticker).toBe('AAPL');
      expect(result.confidence).toBe('exact');
      expect(result.iso).toBe('US:AAPL');
    });

    it('recognizes TSLA as US', () => {
      const result = normalizer.normalize('TSLA');
      expect(result.market).toBe('US');
      expect(result.ticker).toBe('TSLA');
    });

    it('recognizes GOOGL as US', () => {
      const result = normalizer.normalize('GOOGL');
      expect(result.market).toBe('US');
    });

    it('handles lowercase input', () => {
      const result = normalizer.normalize('aapl');
      expect(result.market).toBe('US');
      expect(result.ticker).toBe('AAPL');
    });

    it('handles whitespace in input', () => {
      const result = normalizer.normalize('  AAPL  ');
      expect(result.market).toBe('US');
      expect(result.ticker).toBe('AAPL');
    });

    it('US short ticker (1 char)', () => {
      const result = normalizer.normalize('F');
      expect(result.market).toBe('US');
      expect(result.ticker).toBe('F');
    });

    it('US 3-char ticker', () => {
      const result = normalizer.normalize('IBM');
      expect(result.market).toBe('US');
      expect(result.ticker).toBe('IBM');
    });
  });

  // ═══════════════ CN Market ═══════════════
  describe('CN market codes', () => {
    it('6-digit numeric → CN', () => {
      const result = normalizer.normalize('000001');
      expect(result.market).toBe('CN');
      expect(result.ticker).toBe('000001');
      expect(result.confidence).toBe('exact');
      expect(result.iso).toBe('CN:000001');
    });

    it('SH prefix: SH600000 → CN', () => {
      const result = normalizer.normalize('SH600000');
      expect(result.market).toBe('CN');
      expect(result.ticker).toBe('600000');
    });

    it('SZ prefix: SZ000001 → CN', () => {
      const result = normalizer.normalize('SZ000001');
      expect(result.market).toBe('CN');
      expect(result.ticker).toBe('000001');
    });

    it('SH. prefix: SH.600519 → CN', () => {
      const result = normalizer.normalize('SH.600519');
      expect(result.market).toBe('CN');
      expect(result.ticker).toBe('600519');
    });

    it('SZ. prefix: SZ.300750 → CN', () => {
      const result = normalizer.normalize('SZ.300750');
      expect(result.market).toBe('CN');
      expect(result.ticker).toBe('300750');
    });

    it('ping an bank 000001', () => {
      const result = normalizer.normalize('000001');
      expect(result.market).toBe('CN');
    });

    it('kweichow moutai 600519', () => {
      const result = normalizer.normalize('600519');
      expect(result.market).toBe('CN');
    });
  });

  // ═══════════════ HK Market ═══════════════
  describe('HK market codes', () => {
    it('4-digit numeric → HK', () => {
      const result = normalizer.normalize('0700');
      expect(result.market).toBe('HK');
      expect(result.ticker).toBe('0700');
      expect(result.iso).toBe('HK:0700');
    });

    it('5-digit numeric → HK', () => {
      const result = normalizer.normalize('00388');
      expect(result.market).toBe('HK');
    });

    it('HK. prefix: HK.0700 → HK', () => {
      const result = normalizer.normalize('HK.0700');
      expect(result.market).toBe('HK');
      expect(result.ticker).toBe('0700');
    });

    it('tencent 0700', () => {
      const result = normalizer.normalize('0700');
      expect(result.market).toBe('HK');
    });

    it('HK exchange 00388', () => {
      const result = normalizer.normalize('00388');
      expect(result.market).toBe('HK');
    });
  });

  // ═══════════════ JP Market ═══════════════
  describe('JP market codes', () => {
    it('4-digit numeric 0-4 start → JP (fuzzy)', () => {
      const result = normalizer.normalize('1234');
      expect(result.market).toBe('JP');
      expect(result.confidence).toBe('fuzzy');
      expect(result.iso).toBe('JP:1234');
    });

    it('T prefix: T.7203 → JP', () => {
      const result = normalizer.normalize('T.7203');
      expect(result.market).toBe('JP');
      expect(result.ticker).toBe('7203');
    });

    it('TSE. prefix: TSE.7203 → JP', () => {
      const result = normalizer.normalize('TSE.7203');
      expect(result.market).toBe('JP');
      expect(result.ticker).toBe('7203');
    });

    it('toyota 7203 via T suffix', () => {
      const result = normalizer.normalize('T.7203');
      expect(result.market).toBe('JP');
      expect(result.ticker).toBe('7203');
    });

    it('numeric starting 5-9 → HK', () => {
      const result = normalizer.normalize('6000');
      expect(result.market).toBe('HK');
    });
  });

  // ═══════════════ UK Market ═══════════════
  describe('UK market codes', () => {
    it('xxx.L format → UK', () => {
      const result = normalizer.normalize('VOD.L');
      expect(result.market).toBe('UK');
      expect(result.ticker).toBe('VOD');
      expect(result.confidence).toBe('exact');
      expect(result.iso).toBe('UK:VOD');
    });

    it('HSBA.L → UK', () => {
      const result = normalizer.normalize('HSBA.L');
      expect(result.market).toBe('UK');
    });

    it('LSE. prefix: LSE.VOD → UK', () => {
      const result = normalizer.normalize('LSE.VOD');
      expect(result.market).toBe('UK');
      expect(result.ticker).toBe('VOD');
    });

    it('L. prefix: L.BP → UK', () => {
      const result = normalizer.normalize('L.BP');
      expect(result.market).toBe('UK');
      expect(result.ticker).toBe('BP');
    });
  });

  // ═══════════════ EU Market ═══════════════
  describe('EU market codes', () => {
    it('EPA: prefix: EPA:MC → EU', () => {
      const result = normalizer.normalize('EPA:MC');
      expect(result.market).toBe('EU');
      expect(result.ticker).toBe('MC');
    });

    it('AMS: prefix: AMS:ASML → EU', () => {
      const result = normalizer.normalize('AMS:ASML');
      expect(result.market).toBe('EU');
      expect(result.ticker).toBe('ASML');
    });

    it('ENX: prefix: ENX:SAP → EU', () => {
      const result = normalizer.normalize('ENX:SAP');
      expect(result.market).toBe('EU');
    });

    it('MIL: prefix: MIL:UCG → EU', () => {
      const result = normalizer.normalize('MIL:UCG');
      expect(result.market).toBe('EU');
    });
  });

  // ═══════════════ KR Market ═══════════════
  describe('KR market codes', () => {
    it('00xxxx → KR (fuzzy)', () => {
      const result = normalizer.normalize('005930');
      expect(result.market).toBe('KR');
      expect(result.ticker).toBe('005930');
      expect(result.confidence).toBe('fuzzy');
      expect(result.iso).toBe('KR:005930');
    });

    it('samsung 005930', () => {
      const result = normalizer.normalize('005930');
      expect(result.market).toBe('KR');
    });

    it('KRX: prefix: KRX:005930 → KR', () => {
      const result = normalizer.normalize('KRX:005930');
      expect(result.market).toBe('KR');
      expect(result.ticker).toBe('005930');
    });

    it('non-00 6-digit → CN', () => {
      const result = normalizer.normalize('600000');
      expect(result.market).toBe('CN');
    });
  });

  // ═══════════════ formatDisplay ═══════════════
  describe('formatDisplay', () => {
    it('formats US code', () => {
      const result = normalizer.formatDisplay('AAPL', 'zh-CN');
      expect(result).toContain('AAPL');
      expect(result).toContain('US');
    });

    it('formats CN code', () => {
      const result = normalizer.formatDisplay('000001');
      expect(result).toContain('000001');
      expect(result).toContain('CN');
    });

    it('defaults to en locale', () => {
      const result = normalizer.formatDisplay('AAPL');
      expect(result).toContain('AAPL');
    });
  });

  // ═══════════════ getMarketName ═══════════════
  describe('getMarketName', () => {
    it('US market name in zh-CN', () => {
      const name = normalizer.getMarketName('US', 'zh-CN');
      expect(name).toBe('美股');
    });

    it('CN market name in zh-CN', () => {
      const name = normalizer.getMarketName('CN', 'zh-CN');
      expect(name).toBe('A股');
    });

    it('HK market name in en', () => {
      const name = normalizer.getMarketName('HK', 'en');
      expect(name).toBe('HKEX');
    });

    it('JP market name in ja', () => {
      const name = normalizer.getMarketName('JP', 'ja');
      expect(name).toBe('東証');
    });

    it('KR market name in ko', () => {
      const name = normalizer.getMarketName('KR', 'ko');
      expect(name).toBe('한국');
    });

    it('default locale is en', () => {
      const name = normalizer.getMarketName('US');
      expect(name).toBe('NYSE/NASDAQ');
    });

    it('EU market name in fr', () => {
      const name = normalizer.getMarketName('EU', 'fr');
      expect(name).toBe('Europe');
    });
  });

  // ═══════════════ isValidForMarket ═══════════════
  describe('isValidForMarket', () => {
    it('AAPL is valid for US', () => {
      expect(normalizer.isValidForMarket('AAPL', 'US')).toBe(true);
    });

    it('AAPL is not valid for CN', () => {
      expect(normalizer.isValidForMarket('AAPL', 'CN')).toBe(false);
    });

    it('000001 is valid for CN', () => {
      expect(normalizer.isValidForMarket('000001', 'CN')).toBe(true);
    });

    it('0700 is valid for HK', () => {
      expect(normalizer.isValidForMarket('0700', 'HK')).toBe(true);
    });
  });

  // ═══════════════ toISO ═══════════════
  describe('toISO', () => {
    it('AAPL → US:AAPL', () => {
      expect(normalizer.toISO('AAPL')).toBe('US:AAPL');
    });

    it('000001 → CN:000001', () => {
      expect(normalizer.toISO('000001')).toBe('CN:000001');
    });

    it('0700 → HK:0700', () => {
      expect(normalizer.toISO('0700')).toBe('HK:0700');
    });

    it('VOD.L → UK:VOD', () => {
      expect(normalizer.toISO('VOD.L')).toBe('UK:VOD');
    });
  });

  // ═══════════════ getTicker / getMarket ═══════════════
  describe('getTicker and getMarket', () => {
    it('extracts ticker from US code', () => {
      expect(normalizer.getTicker('AAPL')).toBe('AAPL');
    });

    it('extracts ticker from SH-prefixed CN code', () => {
      expect(normalizer.getTicker('SH600000')).toBe('600000');
    });

    it('extracts market from code', () => {
      expect(normalizer.getMarket('0700')).toBe('HK');
      expect(normalizer.getMarket('AAPL')).toBe('US');
    });
  });

  // ═══════════════ Batch normalize ═══════════════
  describe('normalizeBatch', () => {
    it('normalizes multiple codes', () => {
      const results = normalizer.normalizeBatch(['AAPL', '000001', '0700']);
      expect(results).toHaveLength(3);
      expect(results[0].market).toBe('US');
      expect(results[1].market).toBe('CN');
      expect(results[2].market).toBe('HK');
    });

    it('handles empty array', () => {
      const results = normalizer.normalizeBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  // ═══════════════ Edge cases ═══════════════
  describe('edge cases', () => {
    it('unknown alphanumeric falls back to US', () => {
      const result = normalizer.normalize('XYZ123');
      expect(result.market).toBe('US');
      expect(result.confidence).toBe('fuzzy');
    });

    it('short 2-digit code → US fuzzy', () => {
      const result = normalizer.normalize('99');
      expect(result.market).toBe('US');
      expect(result.confidence).toBe('fuzzy');
    });

    it('duplicate prefix already in name', () => {
      // A ticker that happens to start with SH but is pure alpha
      const result = normalizer.normalize('SHOP');
      expect(result.market).toBe('US'); // 4+ uppercase letters = US ticker
    });

    it('consistency: same input gives same output', () => {
      const r1 = normalizer.normalize('AAPL');
      const r2 = normalizer.normalize('AAPL');
      expect(r1.market).toBe(r2.market);
      expect(r1.ticker).toBe(r2.ticker);
    });
  });

  // ═══════════════ Standalone functions ═══════════════
  describe('normalizeCode (standalone)', () => {
    it('works with US code', () => {
      const result = normalizeCode('MSFT');
      expect(result.market).toBe('US');
      expect(result.ticker).toBe('MSFT');
    });
  });

  describe('formatCodeDisplay (standalone)', () => {
    it('works with CN code', () => {
      const display = formatCodeDisplay('000001');
      expect(display).toContain('000001');
    });
  });

  describe('getMarketName (standalone)', () => {
    it('works with HK code', () => {
      const name = getMarketName('0700', 'zh-CN');
      expect(name).toBe('港股');
    });
  });

  // ═══════════════ Singleton ═══════════════
  describe('singleton', () => {
    it('stockCodeNormalizer is a StockCodeNormalizer instance', () => {
      expect(stockCodeNormalizer).toBeInstanceOf(StockCodeNormalizer);
    });
  });
});
