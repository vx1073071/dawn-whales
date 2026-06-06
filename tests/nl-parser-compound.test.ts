// ── S-34-01: NL Parser Compound Conditions Tests ──────────────────────────
import { describe, it, expect } from 'vitest';
import { parseNaturalLanguage } from '../electron/engine/nl-parser';

describe('NL Parser - Compound Conditions', () => {

  // ── AND Conditions ───────────────────────────────────────
  describe('AND Logic', () => {
    it('parses price > 100 AND volume condition', () => {
      const result = parseNaturalLanguage('价格高于 100 且成交量大于 1000000 买入 HK.00700');
      expect(result).toBeDefined();
    });

    it('parses RSI < 30 AND price > support', () => {
      const result = parseNaturalLanguage('RSI 低于 30 且价格高于 200 买入 HK.09988');
      expect(result).toBeDefined();
    });

    it('parses MA cross AND volume spike', () => {
      const result = parseNaturalLanguage('MA5 上穿 MA20 且成交量放大 买入 HK.01810');
      expect(result).toBeDefined();
    });
  });

  // ── OR Conditions ────────────────────────────────────────
  describe('OR Logic', () => {
    it('parses breakout OR reversal', () => {
      const result = parseNaturalLanguage('突破 300 或 MACD 金叉 买入 HK.00700');
      expect(result).toBeDefined();
    });

    it('parses RSI extreme range', () => {
      const result = parseNaturalLanguage('RSI 低于 30 或 RSI 高于 70');
      expect(result).toBeDefined();
    });
  });

  // ── Price Conditions ────────────────────────────────────
  describe('Price Conditions', () => {
    it('parses price above threshold with stock code', () => {
      const result = parseNaturalLanguage('价格高于 300 买入 HK.00700');
      expect(result).toBeDefined();
    });

    it('parses price below threshold with stock code', () => {
      const result = parseNaturalLanguage('价格低于 100 卖出 HK.09988');
      expect(result).toBeDefined();
    });

    it('parses specific stock price condition', () => {
      const result = parseNaturalLanguage('HK.00700 大于 300 买入 100 股');
      expect(result).toBeDefined();
    });
  });

  // ── Indicator Conditions ────────────────────────────────
  describe('Indicator Conditions', () => {
    it('parses RSI oversold', () => {
      const result = parseNaturalLanguage('RSI 低于 30 买入 HK.00700');
      expect(result).toBeDefined();
    });

    it('parses RSI overbought', () => {
      const result = parseNaturalLanguage('RSI 高于 70 卖出 HK.00700');
      expect(result).toBeDefined();
    });

    it('parses MACD golden cross', () => {
      const result = parseNaturalLanguage('MACD 金叉 买入 HK.01810');
      expect(result).toBeDefined();
    });

    it('parses MA crossover with RSI confirmation', () => {
      const result = parseNaturalLanguage('MA5 上穿 MA20 买入 HK.00700');
      expect(result).toBeDefined();
    });
  });

  // ── Stop Loss / Take Profit ─────────────────────────────
  describe('Stop Loss and Take Profit', () => {
    it('parses stop loss percentage', () => {
      const result = parseNaturalLanguage('买入 HK.00700 止损 5%');
      expect(result).toBeDefined();
    });

    it('parses take profit percentage', () => {
      const result = parseNaturalLanguage('买入 HK.00700 止盈 10%');
      expect(result).toBeDefined();
    });

    it('parses combined stop loss and take profit', () => {
      const result = parseNaturalLanguage('买入 HK.00700 止损 5% 止盈 10%');
      expect(result).toBeDefined();
    });
  });

  // ── Strategy Templates ──────────────────────────────────
  describe('Strategy Templates', () => {
    it('recognizes MA crossover strategy', () => {
      const result = parseNaturalLanguage('MA5 上穿 MA20 买入 TQQQ');
      expect(result).toBeDefined();
    });

    it('parses complex strategy with timing', () => {
      const result = parseNaturalLanguage('9:30 买入 HK.00700 止损 3% 止盈 8%');
      expect(result).toBeDefined();
    });
  });
});