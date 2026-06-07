import { describe, it, expect } from 'vitest';
import { BacktestReplayEngine } from '../electron/engine/backtest-replay';
import { SmartCacheManager, LRUCache } from '../electron/engine/smart-cache';

/**
 * Q-44-03: Cleanup Methods (Memory Leak Prevention)
 *
 * Focus: test the engines and classes that can be reliably instantiated
 * and have clear cleanup APIs.
 */
describe('Q-44-03: Cleanup Methods', () => {

  // ── BacktestReplayEngine ───────────────────────────────────────────────
  describe('BacktestReplayEngine', () => {
    let engine: BacktestReplayEngine;

    afterEach(() => { engine?.stop?.(); });

    it('should expose removeAllListeners()', () => {
      engine = new BacktestReplayEngine();
      expect(typeof engine.removeAllListeners).toBe('function');
    });

    it('should expose stop()', () => {
      engine = new BacktestReplayEngine();
      expect(typeof engine.stop).toBe('function');
    });

    it('should expose reset()', () => {
      engine = new BacktestReplayEngine();
      expect(typeof engine.reset).toBe('function');
    });

    it('should expose listenerCount()', () => {
      engine = new BacktestReplayEngine();
      expect(typeof engine.listenerCount).toBe('function');
    });

    it('should clear klines after reset()', () => {
      engine = new BacktestReplayEngine();
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      const bars = Array.from({ length: 50 }, (_, i) => ({ ...kline, time: kline.time + i * 86400 }));
      engine.load(bars);
      expect(engine.getBars(0, 1).length).toBeGreaterThan(0);
      engine.reset();
      expect(engine.getBars(0, 1).length).toBe(0);
    });

    it('should reduce listener count to 0 after removeAllListeners', () => {
      engine = new BacktestReplayEngine();
      engine.on('tick', () => {});
      engine.on('bar', () => {});
      expect(engine.listenerCount('tick')).toBe(1);
      engine.removeAllListeners();
      expect(engine.listenerCount('tick')).toBe(0);
      expect(engine.listenerCount('bar')).toBe(0);
    });

    it('should handle rapid load/reset cycles without error', () => {
      engine = new BacktestReplayEngine();
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      for (let i = 0; i < 10; i++) {
        const bars = Array.from({ length: 100 }, (_, j) => ({ ...kline, time: kline.time + j * 86400 }));
        engine.load(bars);
        engine.reset();
      }
      expect(engine.getBars(0, 1).length).toBe(0);
    });
  });

  // ── LRUCache ─────────────────────────────────────────────────────────
  describe('LRUCache', () => {
    it('should export LRUCache class', () => {
      expect(typeof LRUCache).toBe('function');
    });

    it('should have has() method', () => {
      const cache = new LRUCache();
      expect(typeof cache.has).toBe('function');
    });

    it('should have set() and get() methods', () => {
      const cache = new LRUCache();
      expect(typeof cache.set).toBe('function');
      expect(typeof cache.get).toBe('function');
    });

    it('should have clear() method', () => {
      const cache = new LRUCache();
      expect(typeof cache.clear).toBe('function');
    });

    it('should have delete() method', () => {
      const cache = new LRUCache();
      expect(typeof cache.delete).toBe('function');
    });

    it('should evict oldest entry on overflow', () => {
      // default maxEntries=1000 — create a tiny cache with maxEntries=3
      const cache = new LRUCache({ maxEntries: 3 });
      cache.set('k1', { v: 1 });
      cache.set('k2', { v: 2 });
      cache.set('k3', { v: 3 });
      cache.set('k4', { v: 4 }); // k1 should be evicted
      expect(cache.has('k1')).toBe(false);
      expect(cache.has('k2')).toBe(true);
      expect(cache.has('k3')).toBe(true);
      expect(cache.has('k4')).toBe(true);
    });

    it('should clear all entries', () => {
      const cache = new LRUCache();
      cache.set('a', { v: 1 });
      cache.set('b', { v: 2 });
      cache.clear();
      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(false);
    });

    it('should return undefined for missing key', () => {
      const cache = new LRUCache();
      expect(cache.get('missing')).toBeUndefined();
    });
  });

  // ── SmartCacheManager ─────────────────────────────────────────────────
  describe('SmartCacheManager', () => {
    it('should export SmartCacheManager class', () => {
      expect(typeof SmartCacheManager).toBe('function');
    });

    it('should expose getCache() returning an LRUCache', () => {
      const mgr = new SmartCacheManager();
      expect(typeof mgr.getCache).toBe('function');
      const ns = mgr.getCache('test');
      expect(typeof ns.set).toBe('function');
      expect(typeof ns.get).toBe('function');
      expect(typeof ns.clear).toBe('function');
    });

    it('should isolate namespaces', () => {
      const mgr = new SmartCacheManager();
      const ns1 = mgr.getCache('ns1');
      const ns2 = mgr.getCache('ns2');
      ns1.set('key', { value: 1 });
      expect(ns2.has('key')).toBe(false);
      expect(ns1.has('key')).toBe(true);
    });
  });
});
