import { describe, it, expect, beforeEach } from 'vitest';
import { getSmartCacheManager } from '../electron/engine/core/smart-cache';

describe('SmartCache', () => {
  let manager: ReturnType<typeof getSmartCacheManager>;
  let cache: ReturnType<typeof manager['getCache']>;

  beforeEach(() => {
    manager = getSmartCacheManager();
    cache = manager.getCache('test-ns');
  });

  describe('getSmartCacheManager singleton', () => {
    it('should return same manager instance', () => {
      const a = getSmartCacheManager();
      const b = getSmartCacheManager();
      expect(a).toBe(b);
    });
  });

  describe('getCache namespace isolation', () => {
    it('should return isolated cache per namespace', () => {
      const ns1 = manager.getCache('ns1');
      const ns2 = manager.getCache('ns2');
      ns1.set('key', 'value1', 60000);
      expect(ns2.get('key')).toBeUndefined();
    });

    it('should return same cache for same namespace', () => {
      const a = manager.getCache('same-ns');
      const b = manager.getCache('same-ns');
      expect(a).toBe(b);
    });
  });

  describe('LRU cache operations', () => {
    it('should set and get values', () => {
      cache.set('k1', { data: 'hello' }, 60000);
      expect(cache.get('k1')).toEqual({ data: 'hello' });
    });

    it('should return undefined for missing key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should delete a key', () => {
      cache.set('k2', { v: 123 }, 60000);
      expect(cache.delete('k2')).toBe(true);
      expect(cache.get('k2')).toBeUndefined();
    });

    it('should return false deleting nonexistent', () => {
      expect(cache.delete('missing')).toBe(false);
    });

    it('should check key existence', () => {
      cache.set('k3', { x: 1 }, 60000);
      expect(cache.has('k3')).toBe(true);
      expect(cache.has('k3-missing')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('a', { v: 1 }, 60000);
      cache.set('b', { v: 2 }, 60000);
      cache.clear();
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });

    it('should list all keys', () => {
      cache.clear();
      cache.set('key1', { v: 1 }, 60000);
      cache.set('key2', { v: 2 }, 60000);
      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should report size', () => {
      cache.clear();
      cache.set('s1', { v: 1 }, 60000);
      expect(cache.size()).toBeGreaterThan(0);
    });
  });

  describe('cache statistics', () => {
    it('should return stats object', () => {
      const stats = cache.getStats();
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('hitCount');
      expect(stats).toHaveProperty('missCount');
      expect(stats).toHaveProperty('evictionCount');
      expect(stats).toHaveProperty('hitRate');
    });

    it('should track hits and misses', () => {
      cache.clear();
      cache.getStats().hitCount; // reset
      cache.set('h1', { v: 1 }, 60000);
      cache.get('h1'); // hit
      cache.get('none'); // miss
      const stats = cache.getStats();
      expect(stats.hitCount).toBeGreaterThan(0);
      expect(stats.missCount).toBeGreaterThan(0);
    });

    it('should compute hit rate', () => {
      cache.clear();
      // Set 2 items, then access both - 2 hits, 1 miss
      cache.set('k1', { v: 1 }, 60000);
      cache.set('k2', { v: 2 }, 60000);
      cache.get('k1'); // hit
      cache.get('k2'); // hit
      cache.get('missing'); // miss
      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should reset stats', () => {
      cache.get('x'); // miss
      cache.resetStats();
      expect(cache.getStats().missCount).toBe(0);
    });
  });

  describe('eviction when at capacity', () => {
    it('should evict oldest entries when maxEntries reached', () => {
      cache.clear();
      const max = 1000;
      for (let i = 0; i < max + 100; i++) {
        cache.set(`evict${i}`, { data: i }, 60000);
      }
      // Oldest entries should be evicted
      expect(cache.get('evict0')).toBeUndefined();
      expect(cache.get(`evict${max + 99}`)).toBeDefined();
    });
  });

  describe('TTL expiry', () => {
    it('should support per-entry TTL', () => {
      cache.set('short', { v: '1s' }, 1000);
      cache.set('long', { v: '1h' }, 3600000);
      expect(cache.get('short')).toBeDefined();
      expect(cache.get('long')).toBeDefined();
    });
  });

  describe('manager-level operations', () => {
    it('should clear all namespaces', () => {
      manager.getCache('ns-a').set('x', { v: 1 }, 60000);
      manager.getCache('ns-b').set('y', { v: 2 }, 60000);
      manager.clearAll();
      expect(manager.getCache('ns-a').get('x')).toBeUndefined();
      expect(manager.getCache('ns-b').get('y')).toBeUndefined();
    });

    it('should clear specific namespace', () => {
      manager.getCache('ns-c').set('z', { v: 3 }, 60000);
      manager.clearNamespace('ns-c');
      expect(manager.getCache('ns-c').get('z')).toBeUndefined();
    });

    it('should return false for non-existent namespace clear', () => {
      expect(manager.clearNamespace('nonexistent-ns')).toBe(false);
    });

    it('should get all stats across namespaces', () => {
      manager.getCache('stat-ns1').set('a', { v: 1 }, 60000);
      manager.getCache('stat-ns2').set('b', { v: 2 }, 60000);
      const allStats = manager.getAllStats();
      expect(allStats).toHaveProperty('stat-ns1');
      expect(allStats).toHaveProperty('stat-ns2');
    });

    it('should reset all stats', () => {
      manager.getCache('reset-ns').get('x');
      manager.resetAllStats();
      expect(manager.getCache('reset-ns').getStats().hitCount).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit set event on insert', () => {
      const events: any[] = [];
      cache.on('set', (key: string) => events.push({ type: 'set', key }));
      cache.set('ev-key', { v: 1 }, 60000);
      expect(events).toContainEqual(expect.objectContaining({ type: 'set', key: 'ev-key' }));
    });

    it('should emit delete event', () => {
      const events: any[] = [];
      cache.on('delete', (key: string) => events.push(key));
      cache.set('del-key', { v: 1 }, 60000);
      cache.delete('del-key');
      expect(events).toContain('del-key');
    });
  });
});
