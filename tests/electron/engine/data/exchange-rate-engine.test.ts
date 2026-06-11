/**
 * exchange-rate-engine.test.ts — R102 J-01 Exchange Rate Engine Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ExchangeRateEngine,
  exchangeRateEngine,
  getExchangeRateEngine,
  FiatCurrency,
  ExchangeRates,
} from '../../../../electron/engine/data/exchange-rate-engine';

describe('ExchangeRateEngine', () => {
  let engine: ExchangeRateEngine;

  beforeEach(() => {
    engine = new ExchangeRateEngine();
    engine.invalidateCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    engine.invalidateCache();
  });

  // ═══════════════ getRateSync ═══════════════
  describe('getRateSync', () => {
    it('returns static HKD rate without cache', () => {
      const rate = engine.getRateSync('HKD');
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(0.2);
    });

    it('returns static CNY rate without cache', () => {
      const rate = engine.getRateSync('CNY');
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(0.2);
    });

    it('returns static USD rate as 1.0', () => {
      const rate = engine.getRateSync('USD');
      expect(rate).toBe(1.0);
    });

    it('returns static JPY rate', () => {
      const rate = engine.getRateSync('JPY');
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(0.01);
    });

    it('returns static EUR rate', () => {
      const rate = engine.getRateSync('EUR');
      expect(rate).toBeGreaterThan(0.9);
    });

    it('returns static GBP rate', () => {
      const rate = engine.getRateSync('GBP');
      expect(rate).toBeGreaterThan(1.0);
    });
  });

  // ═══════════════ getAllRates (with fetch mock) ═══════════════
  describe('getAllRates', () => {
    it('returns rates from CoinGecko on cache miss', async () => {
      // Mock fetch to return CoinGecko-style response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          tether: {
            hkd: 7.824,
            cny: 7.241,
            usd: 1.0,
            jpy: 155.6,
            eur: 0.918,
            gbp: 0.785,
          },
        })),
      });

      const rates = await engine.getAllRates();
      expect(rates.HKD).toBeGreaterThan(0.12);
      expect(rates.HKD).toBeLessThan(0.14);
      expect(rates.USD).toBeCloseTo(1.0, 1);
      expect(typeof rates.CNY).toBe('number');
    });

    it('uses cached values within TTL', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          tether: { hkd: 7.8, cny: 7.2, usd: 1.0, jpy: 155, eur: 0.92, gbp: 0.79 },
        })),
      });

      const rates1 = await engine.getAllRates();
      // Second call should use cache, no fetch
      const rates2 = await engine.getAllRates();
      expect(rates2).toEqual(rates1);
      // fetch should only have been called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to Binance when CoinGecko fails', async () => {
      // CoinGecko fails
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([
            { symbol: 'USDTUSDC', price: '1.0001' },
          ])),
        });

      const rates = await engine.getAllRates();
      expect(rates.USD).toBeGreaterThan(0.9);
      expect(engine.getSource()).toBe('binance');
    });

    it('falls back to static when all APIs fail', async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('CoinGecko error'))
        .mockRejectedValueOnce(new Error('Binance error'));

      const rates = await engine.getAllRates();
      expect(rates.USD).toBe(1.0);
      expect(engine.getSource()).toBe('static');
    });

    it('detects stale cache (>5min)', async () => {
      engine.invalidateCache();
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          tether: { hkd: 7.8, cny: 7.2, usd: 1.0, jpy: 155, eur: 0.92, gbp: 0.79 },
        })),
      });

      await engine.getAllRates();
      expect(engine.isStale()).toBe(false);
    });

    it('starts with stale cache', () => {
      expect(engine.isStale()).toBe(true);
    });
  });

  // ═══════════════ getRate (async) ═══════════════
  describe('getRate', () => {
    it('returns HKD rate from fetch', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          tether: { hkd: 7.824, cny: 7.241, usd: 1.0, jpy: 155.6, eur: 0.918, gbp: 0.785 },
        })),
      });

      const rate = await engine.getRate('HKD');
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(0.15);
    });

    it('returns CNY rate from fetch', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          tether: { hkd: 7.824, cny: 7.241, usd: 1.0, jpy: 155.6, eur: 0.918, gbp: 0.785 },
        })),
      });

      const rate = await engine.getRate('CNY');
      expect(rate).toBeGreaterThan(0.13);
    });

    it('returns all 6 currencies', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          tether: { hkd: 7.8, cny: 7.2, usd: 1.0, jpy: 155, eur: 0.92, gbp: 0.79 },
        })),
      });

      const rates = await engine.getAllRates();
      expect(Object.keys(rates)).toHaveLength(6);
      for (const curr of ['HKD', 'CNY', 'USD', 'JPY', 'EUR', 'GBP']) {
        expect(typeof rates[curr as FiatCurrency]).toBe('number');
        expect(rates[curr as FiatCurrency]).toBeGreaterThan(0);
      }
    });
  });

  // ═══════════════ refresh ═══════════════
  describe('refresh', () => {
    it('invalidates cache and fetches fresh', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            tether: { hkd: 7.8, cny: 7.2, usd: 1.0, jpy: 155, eur: 0.92, gbp: 0.79 },
          })),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            tether: { hkd: 7.9, cny: 7.3, usd: 1.0, jpy: 156, eur: 0.93, gbp: 0.80 },
          })),
        });

      const r1 = await engine.getAllRates();
      const r2 = await engine.refresh();
      // Should be different (new rates)
      expect(r2).not.toEqual(r1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════ cache age ═══════════════
  describe('getCacheAge', () => {
    it('returns -1 when never cached', () => {
      expect(engine.getCacheAge()).toBe(-1);
    });

    it('returns positive age after fetch', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          tether: { hkd: 7.8, cny: 7.2, usd: 1.0, jpy: 155, eur: 0.92, gbp: 0.79 },
        })),
      });

      await engine.getAllRates();
      expect(engine.getCacheAge()).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════ CoinGecko error handling ═══════════════
  describe('error handling', () => {
    it('handles HTTP 429 from CoinGecko', async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('HTTP 429'))
        .mockRejectedValueOnce(new Error('Binance also down'));

      const rates = await engine.getAllRates();
      expect(rates.USD).toBe(1.0); // static fallback
      expect(engine.getSource()).toBe('static');
    });

    it('handles invalid JSON response', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('not json') })
        .mockRejectedValueOnce(new Error('Binance error'));

      const rates = await engine.getAllRates();
      expect(rates.USD).toBe(1.0);
      expect(engine.getSource()).toBe('static');
    });

    it('handles missing tether key', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('{"nothing":{}}') })
        .mockRejectedValueOnce(new Error('Binance error'));

      const rates = await engine.getAllRates();
      expect(rates.USD).toBe(1.0);
      expect(engine.getSource()).toBe('static');
    });

    it('handles negative rate values', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            tether: { hkd: -7.8, cny: 7.2, usd: 1.0, jpy: 155, eur: 0.92, gbp: 0.79 },
          })),
        })
        .mockRejectedValueOnce(new Error('Binance error'));

      const rates = await engine.getAllRates();
      expect(rates.USD).toBe(1.0); // falls back
      expect(engine.getSource()).toBe('static');
    });

    it('handles timeout from fetch', async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'))
        .mockRejectedValueOnce(new Error('Binance timeout'));

      const rates = await engine.getAllRates();
      expect(rates.USD).toBe(1.0);
    });
  });

  // ═══════════════ CoinGecko rate inversion ═══════════════
  describe('rate inversion', () => {
    it('inverts CoinGecko rate correctly (1/fiat_per_usdt → usdt_per_fiat)', async () => {
      // CoinGecko returns: 1 USDT = 7.824 HKD
      // We want: 1 HKD = ? USDT → 1/7.824 = 0.1278
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          tether: { hkd: 7.824, cny: 7.241, usd: 1.0, jpy: 155.6, eur: 0.918, gbp: 0.785 },
        })),
      });

      const rates = await engine.getAllRates();
      expect(rates.HKD).toBeCloseTo(1 / 7.824, 4);
      expect(rates.USD).toBeCloseTo(1.0, 1);
    });
  });

  // ═══════════════ setStaticRates ═══════════════
  describe('setStaticRates', () => {
    it('allows overriding static rates', () => {
      engine.setStaticRates({ HKD: 0.123456 });
      expect(engine.getRateSync('HKD')).toBe(0.123456);
    });

    it('partial override leaves other rates intact', () => {
      engine.setStaticRates({ JPY: 0.01 });
      expect(engine.getRateSync('JPY')).toBe(0.01);
      expect(engine.getRateSync('USD')).toBe(1.0);
    });
  });

  // ═══════════════ getSource ═══════════════
  describe('getSource', () => {
    it('returns null before any fetch', () => {
      expect(engine.getSource()).toBeNull();
    });

    it('returns coingecko after successful fetch', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          tether: { hkd: 7.8, cny: 7.2, usd: 1.0, jpy: 155, eur: 0.92, gbp: 0.79 },
        })),
      });

      await engine.getAllRates();
      expect(engine.getSource()).toBe('coingecko');
    });
  });

  // ═══════════════ Singleton ═══════════════
  describe('singleton', () => {
    it('getExchangeRateEngine returns same instance', () => {
      const e1 = getExchangeRateEngine();
      const e2 = getExchangeRateEngine();
      expect(e1).toBe(e2);
    });

    it('exchangeRateEngine is an ExchangeRateEngine instance', () => {
      expect(exchangeRateEngine).toBeInstanceOf(ExchangeRateEngine);
    });
  });
});
