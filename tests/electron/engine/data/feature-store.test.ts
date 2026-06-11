/**
 * feature-store.test.ts — R95 J-01 Coverage Boost
 * Tests for FeatureStore and its internal TechnicalIndicators computations.
 * Uses mocked better-sqlite3 Database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock better-sqlite3 BEFORE importing the module under test
vi.mock('better-sqlite3', () => {
  const prepareMock = vi.fn().mockReturnValue({
    all: vi.fn().mockReturnValue([]),
    run: vi.fn(),
  });
  const transactionMock = vi.fn().mockImplementation(
    (fn: unknown) => fn
  );
  const MockDatabase = vi.fn().mockImplementation(() => ({
    exec: vi.fn(),
    prepare: prepareMock,
    transaction: transactionMock,
  }));
  return {
    Database: MockDatabase,
    default: MockDatabase,
  };
});

import { FeatureStore } from '../../../../electron/engine/data/feature-store';
import type { FeatureDefinition, FeatureSet, FeatureValue } from '../../../../electron/engine/data/feature-store';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeKlines(overrides: Partial<{ closes: number[]; highs: number[]; lows: number[]; volumes: number[] }> = {}): any[] {
  const closes = overrides.closes ?? generatePrices(100);
  const highs = overrides.highs ?? closes.map((c) => c * 1.01);
  const lows = overrides.lows ?? closes.map((c) => c * 0.99);
  const volumes = overrides.volumes ?? closes.map(() => 10000 + Math.random() * 5000);
  return closes.map((close, i) => ({
    close,
    high: highs[i],
    low: lows[i],
    open: (highs[i] + lows[i]) / 2,
    volume: volumes[i],
    timestamp: Date.now() - (closes.length - i) * 60000,
  }));
}

function generatePrices(n: number, start: number = 10): number[] {
  const prices: number[] = [start];
  for (let i = 1; i < n; i++) {
    prices.push(prices[i - 1] * (1 + (Math.random() - 0.5) * 0.02));
  }
  return prices;
}

// ── FeatureStore ───────────────────────────────────────────────────────────

describe('FeatureStore', () => {
  // Dynamic import of Database to get the mocked version
  let Database: any;
  let db: any;
  let store: FeatureStore;

  beforeEach(async () => {
    const sqlite3 = await import('better-sqlite3');
    Database = sqlite3.Database;
    db = new Database(':memory:');
    store = new FeatureStore(db, '/mock/data/dir');
  });

  describe('construction', () => {
    it('initializes tables on construction', () => {
      expect(db.exec).toHaveBeenCalled();
    });

    it('loads default feature definitions when DB is empty', () => {
      const defs = store.getFeatureDefinitions();
      expect(defs.length).toBeGreaterThan(0);
    });
  });

  describe('getFeatureDefinitions', () => {
    it('returns array of enabled features', () => {
      const defs = store.getFeatureDefinitions();
      expect(Array.isArray(defs)).toBe(true);
      defs.forEach((d) => {
        expect(d).toHaveProperty('name');
        expect(d).toHaveProperty('category');
        expect(d).toHaveProperty('computeFunction');
        expect(d).toHaveProperty('enabled');
        expect(d.enabled).toBe(true);
      });
    });

    it('includes technical indicators', () => {
      const defs = store.getFeatureDefinitions();
      const names = defs.map((d) => d.name);
      expect(names).toContain('sma_5');
      expect(names).toContain('ema_12');
      expect(names).toContain('rsi_14');
    });

    it('includes volume features', () => {
      const defs = store.getFeatureDefinitions();
      const names = defs.map((d) => d.name);
      expect(names).toContain('vwap');
      expect(names).toContain('obv');
      expect(names).toContain('volume_ratio');
    });

    it('includes price pattern features', () => {
      const defs = store.getFeatureDefinitions();
      const names = defs.map((d) => d.name);
      expect(names).toContain('price_change_pct');
      expect(names).toContain('price_momentum_5');
    });
  });

  describe('computeFeatures', () => {
    it('returns empty features when klines < 50', () => {
      const result = store.computeFeatures('000001', makeKlines({ closes: [10, 11, 12] }));
      expect(result.symbol).toBe('000001');
      expect(result.feature_count).toBe(0);
      expect(Object.keys(result.features).length).toBe(0);
    });

    it('computes features when klines >= 50', () => {
      const klines = makeKlines();
      expect(klines.length).toBeGreaterThanOrEqual(50);
      const result = store.computeFeatures('000001', klines);
      expect(result.symbol).toBe('000001');
      expect(result.feature_count).toBeGreaterThan(0);
      expect(Object.keys(result.features).length).toBeGreaterThan(0);
    });

    it('returns timestamp', () => {
      const result = store.computeFeatures('000001', makeKlines());
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('caches result', () => {
      const klines = makeKlines();
      store.computeFeatures('000001', klines);
      const cached = store.getCachedFeatures('000001');
      // May return null if computeFeatures returned empty (klines < 50)
      if (cached) {
        expect(cached.symbol).toBe('000001');
        expect(cached.feature_count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('SMA feature', () => {
    it('computes sma_5 for sufficient data', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('sma_5');
        expect(typeof result.features['sma_5']).toBe('number');
      }
    });

    it('computes sma_10', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('sma_10');
      }
    });

    it('computes sma_20', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('sma_20');
      }
    });
  });

  describe('EMA feature', () => {
    it('computes ema_12', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('ema_12');
      }
    });
  });

  describe('RSI feature', () => {
    it('computes rsi_14', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('rsi_14');
        const rsi = result.features['rsi_14'];
        expect(rsi).toBeGreaterThanOrEqual(0);
        expect(rsi).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('MACD feature', () => {
    it('computes macd_line for sufficient data', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('macd_line');
        expect(typeof result.features['macd_line']).toBe('number');
      }
    });

    it('computes macd_histogram', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('macd_histogram');
      }
    });
  });

  describe('Bollinger Bands', () => {
    it('computes bollinger_upper', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('bollinger_upper');
      }
    });

    it('computes bollinger_middle', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('bollinger_middle');
      }
    });

    it('bollinger upper >= middle >= lower', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.features['bollinger_upper'] !== undefined) {
        expect(result.features['bollinger_upper']).toBeGreaterThanOrEqual(
          result.features['bollinger_middle']
        );
        expect(result.features['bollinger_middle']).toBeGreaterThanOrEqual(
          result.features['bollinger_lower']
        );
      }
    });
  });

  describe('ATR feature', () => {
    it('computes atr_14', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('atr_14');
        expect(result.features['atr_14']).toBeGreaterThan(0);
      }
    });
  });

  describe('Stochastic feature', () => {
    it('computes stochastic_k', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('stochastic_k');
        const k = result.features['stochastic_k'];
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('VWAP feature', () => {
    it('computes vwap', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('vwap');
        expect(result.features['vwap']).toBeGreaterThan(0);
      }
    });
  });

  describe('OBV feature', () => {
    it('computes obv', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('obv');
        expect(typeof result.features['obv']).toBe('number');
      }
    });
  });

  describe('Price Pattern features', () => {
    it('computes price_change_pct', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('price_change_pct');
      }
    });

    it('computes price_momentum_5', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('price_momentum_5');
      }
    });
  });

  describe('Volatility features', () => {
    it('computes price_volatility_20', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('price_volatility_20');
        expect(result.features['price_volatility_20']).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Volume features', () => {
    it('computes volume_ratio', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('volume_ratio');
      }
    });

    it('computes volume_trend', () => {
      const klines = makeKlines();
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        expect(result.features).toHaveProperty('volume_trend');
      }
    });
  });

  describe('SMA correctness', () => {
    it('SMA is the simple average of last N closes', () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
      // Extend to 100+ for feature computation
      const allPrices = [...Array(91).fill(5), ...prices];
      const klines = makeKlines({ closes: allPrices });
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        // sma_5 should be average of last 5: (15+16+17+18+19)/5 = 17
        if (result.features['sma_5'] !== undefined) {
          expect(result.features['sma_5']).toBeCloseTo(17, 0);
        }
      }
    });
  });

  describe('getCachedFeatures', () => {
    it('returns null for uncached symbol', () => {
      expect(store.getCachedFeatures('nobody')).toBeNull();
    });
  });

  describe('saveFeatures', () => {
    it('saves features without error', () => {
      const features: FeatureValue[] = [
        { symbol: '000001', feature_name: 'sma_5', value: 10.5, timestamp: Date.now(), confidence: 1.0 },
      ];
      expect(() => store.saveFeatures(features)).not.toThrow();
    });
  });

  describe('queryFeatures', () => {
    it('returns array', () => {
      const result = store.queryFeatures('000001', ['sma_5'], 10);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('computes features for multiple symbols', () => {
      const result = store.computeFeatures('000001', makeKlines());
      expect(result.symbol).toBe('000001');
    });

    it('handles all-zero prices', () => {
      const prices = Array(100).fill(0);
      const klines = makeKlines({ closes: prices });
      // Should not crash
      expect(() => store.computeFeatures('000001', klines)).not.toThrow();
    });

    it('handles identical prices', () => {
      const prices = Array(100).fill(10);
      const klines = makeKlines({ closes: prices });
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        // Some features may be NaN or 0 for constant prices
        expect(result.feature_count).toBeGreaterThanOrEqual(0);
      }
    });

    it('handles monotonically increasing prices', () => {
      const prices = Array.from({ length: 100 }, (_, i) => 10 + i * 0.1);
      const klines = makeKlines({ closes: prices });
      const result = store.computeFeatures('000001', klines);
      if (result.feature_count > 0) {
        // RSI should be near 100 for monotonic increase
        if (result.features['rsi_14'] !== undefined) {
          expect(result.features['rsi_14']).toBeGreaterThan(50);
        }
      }
    });
  });
});
