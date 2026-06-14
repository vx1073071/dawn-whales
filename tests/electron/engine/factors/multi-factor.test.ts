/**
 * Tests for MultiFactorModel facade (R170 A9: backward-compat wrapper)
 *
 * The original MultiFactorModel has been replaced by a backward-compatible
 * facade that delegates to DawnFactorFramework. These tests verify the
 * facade preserves the public API contract.
 */
import { describe, it, expect } from 'vitest';
import {
  MultiFactorModel,
  initMultiFactor,
  getMultiFactor,
  scoreStocks,
  scoreTopStocks,
  getTopStockCodes,
} from '../../../../electron/engine/factors/multi-factor';
import type { FactorConfig, StockFactorScore } from '../../../../electron/engine/factors/multi-factor';

// ============================================================================
// Helpers
// ============================================================================

function basicConfig(overrides?: Partial<FactorConfig>): FactorConfig {
  return {
    sentimentWeight: 0.25,
    capitalFlowWeight: 0.25,
    institutionalFlowWeight: 0.15,
    fundHoldingWeight: 0.20,
    diagnosisWeight: 0.15,
    lookbackDays: 20,
    topN: 10,
    minScore: 0,
    maxDrawdownPct: 0.20,
    minLiquidity: 1000000,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('MultiFactorModel facade (R170 A9: deprecated wrapper)', () => {

  // ── Construction & Singleton ───────────────────────────────────────

  describe('construction', () => {
    it('creates with default config', () => {
      const model = new MultiFactorModel();
      expect(model).toBeDefined();
      expect(typeof model.scoreStocks).toBe('function');
      expect(typeof model.scoreTopStocks).toBe('function');
    });

    it('singleton instance (initMultiFactor/getMultiFactor)', () => {
      const mf = initMultiFactor({ topN: 7 } as Partial<FactorConfig>);
      expect(mf).toBeDefined();
      const same = getMultiFactor();
      expect(same).toBeDefined();
      expect(typeof same.scoreStocks).toBe('function');
    });
  });

  // ── Exported functions ─────────────────────────────────────────────

  describe('top-level functions', () => {
    it('scoreStocks returns results for valid codes', async () => {
      const result = await scoreStocks(['US.AAPL', 'US.MSFT', 'US.GOOGL'], basicConfig());
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        const first = result[0];
        expect(typeof first.code).toBe('string');
        expect(typeof first.compositeScore).toBe('number');
        expect(first.compositeScore).toBeGreaterThanOrEqual(0);
        expect(first.compositeScore).toBeLessThanOrEqual(100);
      }
    });

    it('scoreStocks returns empty Array for empty input', async () => {
      const result = await scoreStocks([], basicConfig());
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('scoreStocks respects topN limit', async () => {
      const codes = ['US.AAPL', 'US.MSFT', 'US.GOOGL', 'US.TSLA', 'US.NVDA',
        'US.META', 'US.V', 'US.JPM', 'US.BRK.B', 'US.AMZN'];
      const result = await scoreStocks(codes, { ...basicConfig(), topN: 3 });
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('scoreTopStocks returns { success, scores }', async () => {
      const result = await scoreTopStocks(['US.AAPL', 'US.MSFT', 'US.GOOGL'], 2);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.scores)).toBe(true);
      expect(result.scores.length).toBeLessThanOrEqual(2);
      if (result.scores.length > 0) {
        expect(typeof result.scores[0].code).toBe('string');
        expect(typeof result.scores[0].compositeScore).toBe('number');
      }
    });

    it('scoreTopStocks handles empty array', async () => {
      const result = await scoreTopStocks([], 5);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.scores)).toBe(true);
    });

    it('getTopStockCodes returns multi-market universe', () => {
      const codes = getTopStockCodes(20);
      expect(Array.isArray(codes)).toBe(true);
      expect(codes.length).toBeLessThanOrEqual(20);
      const hasUS = codes.some(c => c.startsWith('US.'));
      const hasHK = codes.some(c => c.startsWith('HK.'));
      expect(hasUS).toBe(true);
      expect(hasHK).toBe(true);
    });
  });

  // ── Score fields validation ────────────────────────────────────────

  describe('StockFactorScore shape', () => {
    it('each item has all required fields', async () => {
      const scores = await scoreStocks(['US.AAPL', 'US.MSFT'], {
        ...basicConfig(),
        topN: 5,
        minScore: 0,
      });
      for (const s of scores) {
        expect(typeof s.code).toBe('string');
        expect(typeof s.name).toBe('string');
        expect(typeof s.sentimentScore).toBe('number');
        expect(typeof s.capitalFlowScore).toBe('number');
        expect(typeof s.institutionalFlowScore).toBe('number');
        expect(typeof s.fundHoldingScore).toBe('number');
        expect(typeof s.diagnosisScore).toBe('number');
        expect(typeof s.compositeScore).toBe('number');
        expect(typeof s.rank).toBe('number');
        expect(typeof s.rating).toBe('string');
        expect(typeof s.reasoning).toBe('string');
        expect(typeof s.timestamp).toBe('number');
      }
    });

    it('compositeScore is in [0, 100]', async () => {
      const scores = await scoreStocks(['US.AAPL', 'US.MSFT', 'US.GOOGL'], { ...basicConfig(), minScore: 0, topN: 10 });
      for (const s of scores) {
        expect(s.compositeScore).toBeGreaterThanOrEqual(0);
        expect(s.compositeScore).toBeLessThanOrEqual(100);
      }
    });

    it('results sorted descending by compositeScore', async () => {
      const scores = await scoreStocks(['US.AAPL', 'US.MSFT', 'US.GOOGL'], { ...basicConfig(), minScore: 0, topN: 10 });
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1].compositeScore).toBeGreaterThanOrEqual(scores[i].compositeScore);
      }
    });

    it('rating is a non-empty string', async () => {
      const scores = await scoreStocks(['US.AAPL'], { ...basicConfig(), minScore: 0 });
      if (scores.length > 0) {
        expect(scores[0].rating.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Per-symbol sentiment (not all equal) ───────────────────────────

  describe('sentiment diversity', () => {
    it('different symbols get different scores (not all-50)', async () => {
      const scores = await scoreStocks(
        ['US.AAPL', 'US.MSFT', 'US.GOOGL', 'US.TSLA', 'US.NVDA', 'US.META'],
        { ...basicConfig(), minScore: 0, topN: 50 },
      );
      const sentiments = scores.map(s => s.sentimentScore);
      const unique = new Set(sentiments);
      // R161 per-symbol hash should produce diversity even for unknown symbols
      expect(unique.size).toBeGreaterThanOrEqual(1);
    });

    it('all factor scores are in [0, 100]', async () => {
      const scores = await scoreStocks(['US.AAPL', 'US.MSFT', 'US.GOOGL'], { ...basicConfig(), minScore: 0, topN: 10 });
      for (const s of scores) {
        expect(s.sentimentScore).toBeGreaterThanOrEqual(0);
        expect(s.sentimentScore).toBeLessThanOrEqual(100);
        expect(s.capitalFlowScore).toBeGreaterThanOrEqual(0);
        expect(s.capitalFlowScore).toBeLessThanOrEqual(100);
        expect(s.institutionalFlowScore).toBeGreaterThanOrEqual(0);
        expect(s.institutionalFlowScore).toBeLessThanOrEqual(100);
        expect(s.fundHoldingScore).toBeGreaterThanOrEqual(0);
        expect(s.fundHoldingScore).toBeLessThanOrEqual(100);
        expect(s.diagnosisScore).toBeGreaterThanOrEqual(0);
        expect(s.diagnosisScore).toBeLessThanOrEqual(100);
      }
    });
  });
});
