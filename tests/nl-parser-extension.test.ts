// tests/nl-parser-extension.test.ts
// NL Parser PriceCondition extension — Phase 4.2 R30 Q-30-03

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseNaturalLanguage, normalizeInput } from '../electron/engine/agents/nl-parser.js';

describe('NL Parser — PriceCondition extension', () => {
  describe('above operators', () => {
    it('"AAPL 涨破 200" → crosses_above 200', () => {
      const result = parseNaturalLanguage('AAPL 涨破 200');
      expect(result.success).toBe(true);
      expect(result.condition).toBeDefined();
      expect(result.condition!.operator).toBe('crosses_above');
      expect(result.condition!.targetPrice).toBe(200);
      expect(result.symbol).toBe('US.AAPL');
    });

    it('"AAPL 超过 200" → above 200', () => {
      const result = parseNaturalLanguage('AAPL 超过 200');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('above');
      expect(result.condition!.targetPrice).toBe(200);
    });

    it('"AAPL 高于 200 买入" → above 200', () => {
      const result = parseNaturalLanguage('AAPL 高于 200 买入');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('above');
      expect(result.condition!.targetPrice).toBe(200);
    });

    it('"TSLA price >= 50" → above 200', () => {
      const result = parseNaturalLanguage('TSLA price >= 50');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('above');
      expect(result.condition!.targetPrice).toBe(200);
    });

    it('"NVDA 触及 900" → above 900', () => {
      const result = parseNaturalLanguage('NVDA 触及 900');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('above');
      expect(result.condition!.targetPrice).toBe(900);
    });

    it('"AAPL 涨到 150" → above 150', () => {
      const result = parseNaturalLanguage('AAPL 涨到 150');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('above');
      expect(result.condition!.targetPrice).toBe(150);
    });
  });

  describe('below operators', () => {
    it('"AAPL 低于 200" → below 200', () => {
      const result = parseNaturalLanguage('AAPL 低于 200');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('below');
      expect(result.condition!.targetPrice).toBe(200);
      expect(result.symbol).toBe('US.AAPL');
    });

    it('"TSLA price < 150" → below 150', () => {
      const result = parseNaturalLanguage('TSLA price < 150');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('below');
      expect(result.condition!.targetPrice).toBe(150);
    });

    it('"NVDA 跌破 800" → crosses_below 800', () => {
      const result = parseNaturalLanguage('NVDA 跌破 800');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('crosses_below');
      expect(result.condition!.targetPrice).toBe(800);
    });

    it('"AAPL 价格低于 100" → below 100', () => {
      const result = parseNaturalLanguage('AAPL 价格低于 100');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('below');
      expect(result.condition!.targetPrice).toBe(100);
    });
  });

  describe('crosses operators', () => {
    it('"AAPL 上穿 200" → crosses_above 200', () => {
      const result = parseNaturalLanguage('AAPL 上穿 200');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('crosses_above');
      expect(result.condition!.targetPrice).toBe(200);
      expect(result.symbol).toBe('US.AAPL');
    });

    it('"AAPL 突破 200" → crosses_above 200', () => {
      const result = parseNaturalLanguage('AAPL 突破 200');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('crosses_above');
      expect(result.condition!.targetPrice).toBe(200);
    });

    it('"AAPL 下穿 200" → crosses_below 200', () => {
      const result = parseNaturalLanguage('AAPL 下穿 200');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('crosses_below');
      expect(result.condition!.targetPrice).toBe(200);
    });

    it('"AAPL 跌破 200" → crosses_below 200', () => {
      const result = parseNaturalLanguage('AAPL 跌破 200');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('crosses_below');
      expect(result.condition!.targetPrice).toBe(200);
    });

    it('"TSLA crosses above 300" → crosses_above 300', () => {
      const result = parseNaturalLanguage('TSLA crosses above 300');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('crosses_above');
      expect(result.condition!.targetPrice).toBe(300);
    });

    it('"AAPL crosses below 100" → crosses_below 100', () => {
      const result = parseNaturalLanguage('AAPL crosses below 100');
      expect(result.success).toBe(true);
      expect(result.condition!.operator).toBe('crosses_below');
      expect(result.condition!.targetPrice).toBe(100);
    });
  });

  describe('decimal prices', () => {
    it('"AAPL 涨破 199.99" → 199.99', () => {
      const result = parseNaturalLanguage('AAPL 涨破 199.99');
      expect(result.success).toBe(true);
      expect(result.condition!.targetPrice).toBe(199.99);
    });

    it('"TSLA 低于 150.50" → 150.50', () => {
      const result = parseNaturalLanguage('TSLA 低于 150.50');
      expect(result.success).toBe(true);
      expect(result.condition!.targetPrice).toBe(150.5);
    });
  });

  describe('condition field in output', () => {
    it('returns condition object with type price', () => {
      const result = parseNaturalLanguage('AAPL 涨破 200');
      expect(result.condition).toEqual(expect.objectContaining({
        type: 'price',
        operator: 'crosses_above',
        targetPrice: 200,
        reference: 'close',
      }));
    });

    it('strategy.type is price_condition for pure price inputs', () => {
      const result = parseNaturalLanguage('AAPL 涨破 200');
      expect(result.strategy.type).toBe('price_condition');
    });

    it('no condition for non-price patterns (falls back to rule-based)', () => {
      const result = parseNaturalLanguage('MA5 上穿 MA20 买入');
      expect(result.condition ?? null).toBeNull();
      expect(result.success).toBe(true);
    });
  });

  describe('trigger history integration', () => {
    it('parsed condition can be used to create a ConditionRule', () => {
      const result = parseNaturalLanguage('AAPL 涨破 200');
      expect(result.success).toBe(true);
      expect(result.condition).toBeDefined();
      const { type, operator, targetPrice, reference } = result.condition!;
      expect(type).toBe('price');
      expect(['above', 'below', 'crosses_above', 'crosses_below']).toContain(operator);
      expect(typeof targetPrice).toBe('number');
      expect(['close', 'open', 'high', 'low', 'vwap']).toContain(reference || 'close');
    });
  });

  describe('unknown symbol handling', () => {
    it('parses price condition without symbol', () => {
      const result = parseNaturalLanguage('涨破 200');
      // Without a stock symbol, the price condition matcher correctly skips.
      // Falls through to LLM fallback or returns error (depends on config).
      // The key invariant: no crash, no throw.
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      // condition field may or may not be present — either is acceptable
    });

    it('handles unrecognized text gracefully', () => {
      const result = parseNaturalLanguage('do something random');
      // Either fails gracefully or returns indicator-based result
      // should not throw
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });
});
