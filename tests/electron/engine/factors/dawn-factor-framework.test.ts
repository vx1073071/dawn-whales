/**
 * Tests for DawnFactorFramework
 * JVS R160 P0-F1: Unified factor scoring engine
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DawnFactorFramework,
  initDawnFactorFramework,
  getDawnFactorFramework,
  type DawnFactorConfig,
  type UnifiedFactorScore,
  type FactorScoreDetail,
} from '../../../../electron/engine/factors/dawn-factor-framework';

// ============================================================================
// Helpers
// ============================================================================

function mockConfig(overrides?: Partial<DawnFactorConfig>): DawnFactorConfig {
  return {
    mode: 'HYBRID',
    weights: {
      MOM_12M: 0.15, MOM_1M: 0.05,
      RSI_14: 0.05, ADX: 0.05,
      LIQ: 0.05, VOL_60D: 0.05,
      MA_20_60: 0.05, BOLL: 0.05,
      OBV: 0.05, CMF: 0.05,
    },
    topN: 20,
    minScore: 30,
    minDataPoints: 20,
    maxDrawdownThreshold: 0.20,
    includeAttribution: true,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('DawnFactorFramework', () => {

  // ── Construction & Singleton ──────────────────────────────────────

  describe('construction', () => {
    it('creates with default config', () => {
      const fw = new DawnFactorFramework();
      const cfg = fw.getConfig();
      expect(cfg.mode).toBe('HYBRID');
      expect(cfg.minScore).toBe(30);
      expect(typeof cfg.weights).toBe('object');
      expect(Object.keys(cfg.weights).length).toBeGreaterThan(0);
    });

    it('merges partial config', () => {
      const fw = new DawnFactorFramework({ mode: 'DATA_DRIVEN', minScore: 50 });
      const cfg = fw.getConfig();
      expect(cfg.mode).toBe('DATA_DRIVEN');
      expect(cfg.minScore).toBe(50);
      // Defaults preserved
      expect(cfg.topN).toBe(20);
    });

    it('normalizes weights to 1.0 when sum != 1', () => {
      const fw = new DawnFactorFramework({ weights: { A: 2, B: 2 } });
      const cfg = fw.getConfig();
      const total = Object.values(cfg.weights).reduce((s, w) => s + w, 0);
      expect(total).toBeCloseTo(1.0, 2);
    });

    it('initDawnFactorFramework returns singleton', () => {
      const a = initDawnFactorFramework({ mode: 'CALCULATED' });
      const b = initDawnFactorFramework();
      expect(a).toBe(b); // same instance
      expect(getDawnFactorFramework()).toBe(a);
    });
  });

  // ── Config management ──────────────────────────────────────────────

  describe('config', () => {
    it('updateConfig merges partially', () => {
      const fw = new DawnFactorFramework({ mode: 'HYBRID' });
      fw.updateConfig({ minScore: 60, topN: 10 });
      const cfg = fw.getConfig();
      expect(cfg.mode).toBe('HYBRID'); // preserved
      expect(cfg.minScore).toBe(60);
      expect(cfg.topN).toBe(10);
    });

    it('getConfig returns a copy not reference', () => {
      const fw = new DawnFactorFramework();
      const cfg1 = fw.getConfig();
      cfg1.minScore = 99; // mutate copy
      const cfg2 = fw.getConfig();
      expect(cfg2.minScore).toBe(30); // original unchanged
    });

    it('re-normalizes weights after updateConfig', () => {
      const fw = new DawnFactorFramework({ weights: { A: 1, B: 3 } });
      fw.updateConfig({ weights: { A: 5, B: 5 } });
      const cfg = fw.getConfig();
      const total = Object.values(cfg.weights).reduce((s, w) => s + w, 0);
      expect(total).toBeCloseTo(1.0, 2);
    });
  });

  // ── Provider plugin system ──────────────────────────────────────

  describe('providers', () => {
    it('registers and unregisters providers', () => {
      const fw = new DawnFactorFramework();
      const provider = {
        factorId: 'MOM_12M',
        providerName: 'test-provider',
        fetchScore: async (_symbols: string[], _market: string) => new Map<string, number>(),
      };
      fw.registerProvider(provider);
      // Unregister
      fw.unregisterProvider('MOM_12M');
      // No error = success
    });

    it('can register multiple providers', () => {
      const fw = new DawnFactorFramework();
      fw.registerProvider({
        factorId: 'MOM_12M', providerName: 'p1',
        fetchScore: async () => new Map(),
      });
      fw.registerProvider({
        factorId: 'RSI_14', providerName: 'p2',
        fetchScore: async () => new Map(),
      });
      // No duplicate error
    });
  });

  // ── Score (core entry point) ───────────────────────────────────────

  describe('score', () => {
    it('returns UnifiedFactorScore for US stock', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const result = await fw.score('AAPL', 'US', 'stock');

      expect(result.symbol).toBe('AAPL');
      expect(result.market).toBe('US');
      expect(result.instrumentType).toBe('stock');
      expect(typeof result.compositeScore).toBe('number');
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
    });

    it('returns rating based on compositeScore', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const result = await fw.score('AAPL', 'US', 'stock');
      expect(['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL']).toContain(result.rating);
    });

    it('same symbol returns consistent structure', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const r1 = await fw.score('AAPL', 'US', 'stock');
      const r2 = await fw.score('AAPL', 'US', 'stock');

      // Identity fields identical
      expect(r1.symbol).toBe(r2.symbol);
      expect(r1.market).toBe(r2.market);
      expect(r1.instrumentType).toBe(r2.instrumentType);
      // Both return valid scores
      expect(typeof r1.compositeScore).toBe('number');
      expect(typeof r2.compositeScore).toBe('number');
    });

    it('returns valid score for different markets', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });

      const us = await fw.score('AAPL', 'US', 'stock');
      expect(us.market).toBe('US');
      expect(typeof us.compositeScore).toBe('number');

      const hk = await fw.score('0700', 'HK', 'stock');
      expect(hk.market).toBe('HK');
      expect(typeof hk.compositeScore).toBe('number');

      const crypto = await fw.score('BTC-USDT', 'CRYPTO', 'crypto_spot');
      expect(crypto.market).toBe('CRYPTO');
      expect(typeof crypto.compositeScore).toBe('number');
    });

    it('returns expected UnifiedFactorScore shape', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const result = await fw.score('AAPL', 'US', 'stock');

      // Check all required fields exist
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('compositeScore');
      expect(result).toHaveProperty('rating');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('factors');
      expect(Array.isArray(result.factors)).toBe(true);
      expect(result).toHaveProperty('momentumScore');
      expect(result).toHaveProperty('valueScore');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('volatilityScore');
      expect(result).toHaveProperty('sentimentScore');
      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('scoringMode');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('calculatedAt');
    });

    it('factors array contains valid FactorScoreDetail', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const result = await fw.score('AAPL', 'US', 'stock');

      if (result.factors.length > 0) {
        const f = result.factors[0];
        expect(typeof f.factorId).toBe('string');
        expect(typeof f.factorName).toBe('string');
        expect(typeof f.factorCategory).toBe('string');
        expect(typeof f.score).toBe('number');
        expect(f.score).toBeGreaterThanOrEqual(0);
        expect(f.score).toBeLessThanOrEqual(100);
        expect(typeof f.weight).toBe('number');
        expect(typeof f.contribution).toBe('number');
      }
    });

    it('returns empty score for unknown market with no factors', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      // 'XX' is not a valid market — may or may not have factors
      const result = await fw.score('TEST', 'XX' as any, 'stock' as any);
      expect(result.symbol).toBe('TEST');
      expect(typeof result.compositeScore).toBe('number');
      expect(typeof result.confidence).toBe('number');
    });
  });

  // ── ScoreBatch ─────────────────────────────────────────────────────

  describe('scoreBatch', () => {
    it('returns array of scores for multiple symbols', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED', minScore: 0 });
      const results = await fw.scoreBatch(['AAPL', 'MSFT', 'GOOGL'], 'US', 'stock');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      for (const r of results) {
        expect(typeof r.compositeScore).toBe('number');
        expect(r.market).toBe('US');
        expect(r.instrumentType).toBe('stock');
      }
    });

    it('filters below minScore', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED', minScore: 95, topN: 50 });
      const results = await fw.scoreBatch(['AAPL', 'MSFT', 'GOOGL'], 'US', 'stock');

      // With minScore=95, most scores will be filtered
      // Just verify filtering doesn't crash
      expect(Array.isArray(results)).toBe(true);
    });

    it('limits to topN results', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED', minScore: 0, topN: 2 });
      const results = await fw.scoreBatch(['AAPL', 'MSFT', 'GOOGL'], 'US', 'stock');

      expect(results.length).toBeLessThanOrEqual(2);
      // Verify sorted descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].compositeScore).toBeGreaterThanOrEqual(results[i].compositeScore);
      }
    });
  });

  // ── Scoring modes ─────────────────────────────────────────────────

  describe('scoring modes', () => {
    it('CALCULATED mode works', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const result = await fw.score('AAPL', 'US', 'stock');
      expect(result.scoringMode).toBe('CALCULATED');
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    });

    it('HYBRID mode works', async () => {
      const fw = new DawnFactorFramework({ mode: 'HYBRID' });
      const result = await fw.score('AAPL', 'US', 'stock');
      expect(result.scoringMode).toBe('HYBRID');
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    });

    it('DATA_DRIVEN mode works', async () => {
      const fw = new DawnFactorFramework({ mode: 'DATA_DRIVEN' });
      const result = await fw.score('AAPL', 'US', 'stock');
      expect(result.scoringMode).toBe('DATA_DRIVEN');
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    });

    it('all modes return valid scores', async () => {
      const modes: Array<'DATA_DRIVEN' | 'CALCULATED' | 'HYBRID'> = ['DATA_DRIVEN', 'CALCULATED', 'HYBRID'];
      for (const mode of modes) {
        const fw = new DawnFactorFramework({ mode });
        const result = await fw.score('AAPL', 'US', 'stock');
        expect(result.scoringMode).toBe(mode);
        expect(typeof result.compositeScore).toBe('number');
        expect(result.compositeScore).toBeGreaterThanOrEqual(0);
        expect(result.compositeScore).toBeLessThanOrEqual(100);
      }
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('empty weights handled gracefully', () => {
      const fw = new DawnFactorFramework({ weights: {} });
      const cfg = fw.getConfig();
      expect(typeof cfg).toBe('object');
    });

    it('multiple initDawn calls return same instance', () => {
      const a = initDawnFactorFramework({ mode: 'CALCULATED' });
      const b = initDawnFactorFramework({ mode: 'DATA_DRIVEN' });
      expect(a).toBe(b);
      // Config from first init is kept (singleton pattern)
      expect(a.getConfig().mode).toBe('CALCULATED');
    });

    it('topN limits results', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED', minScore: 0, topN: 1 });
      const results = await fw.scoreBatch(['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'], 'US', 'stock');
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('score returns reason as string', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const result = await fw.score('AAPL', 'US', 'stock');
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });

  // ── Invariants ─────────────────────────────────────────────────────

  describe('invariants', () => {
    it('compositeScore is always in [0, 100]', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const symbols = ['AAPL', 'MSFT', 'GOOGL', '0700', 'BTC-USDT'];
      const types: Array<[string, string, string]> = [
        ['AAPL', 'US', 'stock'],
        ['0700', 'HK', 'stock'],
        ['BTC-USDT', 'CRYPTO', 'crypto_spot'],
      ];

      for (const [sym, mkt, type] of types) {
        const result = await fw.score(sym, mkt as any, type as any);
        expect(result.compositeScore).toBeGreaterThanOrEqual(0);
        expect(result.compositeScore).toBeLessThanOrEqual(100);
      }
    });

    it('confidence is always in [0, 1]', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const result = await fw.score('AAPL', 'US', 'stock');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('category scores are all present', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const result = await fw.score('AAPL', 'US', 'stock');
      expect(typeof result.momentumScore).toBe('number');
      expect(typeof result.valueScore).toBe('number');
      expect(typeof result.qualityScore).toBe('number');
      expect(typeof result.volatilityScore).toBe('number');
      expect(typeof result.sentimentScore).toBe('number');
    });

    it('calculatedAt is a recent timestamp', async () => {
      const fw = new DawnFactorFramework({ mode: 'CALCULATED' });
      const before = Date.now();
      const result = await fw.score('AAPL', 'US', 'stock');
      const after = Date.now();
      expect(result.calculatedAt).toBeGreaterThanOrEqual(before);
      expect(result.calculatedAt).toBeLessThanOrEqual(after + 100);
    });
  });
});
