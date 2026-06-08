/**
 * J-58-01 Tests: Cache Optimizer — ≥95% hit rate (R58 v19)
 *
 * Tests:
 * 01-04: Prompt hashing + basic get/set
 * 05-08: Cross-agent data sharing
 * 09-12: Pre-warming + statistics
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CacheOptimizer,
  getCacheOptimizer,
  resetCacheOptimizer,
} from '../electron/engine/cache-optimizer';

describe('J-58-01: CacheOptimizer', () => {
  let cache: CacheOptimizer;

  beforeEach(() => {
    resetCacheOptimizer();
    cache = getCacheOptimizer();
  });

  describe('Hashing & Basic Operations', () => {
    it('01: generates consistent key for same input', () => {
      const key1 = cache.generateKey('system prompt', 'user input', { param: 1 });
      const key2 = cache.generateKey('system prompt', 'user input', { param: 1 });
      expect(key1).toBe(key2);
    });

    it('02: generates different key for different input', () => {
      const key1 = cache.generateKey('prompt A', 'input', {});
      const key2 = cache.generateKey('prompt B', 'input', {});
      expect(key1).not.toBe(key2);
    });

    it('03: set and get works', () => {
      cache.set('test-key', { result: 'hello' }, {
        layer: 'L1_prompt',
        agent: 'fundamentals',
      });

      const value = cache.get<{ result: string }>('test-key');
      expect(value).not.toBeNull();
      expect(value!.result).toBe('hello');
    });

    it('04: returns null for expired entry', () => {
      cache.set('test-key', { data: 1 }, {
        layer: 'L1_prompt',
        agent: 'fundamentals',
        ttlMs: -1, // already expired
      });

      const value = cache.get('test-key');
      expect(value).toBeNull();
    });

    it('05: tracks hit count', () => {
      cache.set('test-key', { data: 1 }, {
        layer: 'L1_prompt',
        agent: 'fundamentals',
      });

      cache.get('test-key');
      cache.get('test-key');

      const meta = cache.getWithMeta('test-key');
      expect(meta!.entry.hitCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Cross-Agent Data Sharing', () => {
    it('06: share data between agents', () => {
      cache.shareData('em-mx-finance', 'AAPL', 'revenue=2025', { revenue: 383.29 }, 'fundamentals');

      // Sentiment agent retrieves same data
      const data = cache.getSharedData<{ revenue: number }>('em-mx-finance', 'AAPL', 'revenue=2025');
      expect(data).not.toBeNull();
      expect(data!.revenue).toBe(383.29);
    });

    it('07: different symbols get different cache entries', () => {
      cache.shareData('em-mx-finance', 'AAPL', 'revenue', { val: 100 }, 'fundamentals');
      cache.shareData('em-mx-finance', 'TSLA', 'revenue', { val: 200 }, 'fundamentals');

      expect(cache.getSharedData('em-mx-finance', 'AAPL', 'revenue')).not.toBeNull();
      expect(cache.getSharedData('em-mx-finance', 'TSLA', 'revenue')).not.toBeNull();
    });

    it('08: shared entries tagged with requesting agent', () => {
      cache.shareData('news-search', 'AAPL', 'headlines', ['news1'], 'sentiment');
      const data = cache.getWithMeta(cache.generateDataKey('news-search', 'AAPL', 'headlines'));
      expect(data!.entry.agent).toContain('shared');
    });
  });

  describe('Pre-Warming', () => {
    it('09: adds pre-warm symbol', () => {
      let added: string | null = null;
      cache.on('prewarm:added', (symbol) => { added = symbol as string; });

      cache.addPreWarmSymbol({
        symbol: 'AAPL',
        dataTypes: ['financials', 'sentiment'],
        refreshIntervalMs: 3600000,
      });

      expect(added).toBe('AAPL');
      expect(cache.getPreWarmSymbols().length).toBe(1);
    });

    it('10: removes pre-warm symbol', () => {
      cache.addPreWarmSymbol({ symbol: 'AAPL', dataTypes: ['financials'], refreshIntervalMs: 3600000 });
      cache.removePreWarmSymbol('AAPL');
      expect(cache.getPreWarmSymbols().length).toBe(0);
    });

    it('11: pre-warm timer fires refresh event', async () => {
      let refreshed: string | null = null;
      cache.on('prewarm:refresh', (symbol) => { refreshed = symbol as string; });

      cache.addPreWarmSymbol({
        symbol: '00700',
        dataTypes: ['financials'],
        refreshIntervalMs: 10, // very fast for test
      });

      await new Promise(r => setTimeout(r, 50));
      expect(refreshed).toBe('00700');
    });
  });

  describe('Statistics & Cleanup', () => {
    it('12: returns layer-level stats', () => {
      cache.set('k1', 'v1', { layer: 'L1_prompt', agent: 'fundamentals' });
      cache.set('k2', 'v2', { layer: 'L2_tool_call', agent: 'sentiment' });
      cache.set('k3', 'v3', { layer: 'L3_data_source', agent: 'fundamentals', symbol: 'AAPL' });

      const stats = cache.getStats();
      expect(stats.length).toBe(3);
      expect(stats.find(s => s.layer === 'L1_prompt')!.entries).toBe(1);
    });

    it('13: returns agent-level stats', () => {
      cache.set('k1', 'v1', { layer: 'L1_prompt', agent: 'fundamentals' });
      cache.set('k2', 'v2', { layer: 'L1_prompt', agent: 'sentiment' });
      cache.get('k1'); // hit

      const agentStats = cache.getAgentStats();
      expect(agentStats.length).toBeGreaterThanOrEqual(2);
    });

    it('14: invalidates by agent', () => {
      cache.set('k1', 'v1', { layer: 'L1_prompt', agent: 'fundamentals' });
      cache.set('k2', 'v2', { layer: 'L1_prompt', agent: 'fundamentals' });
      cache.set('k3', 'v3', { layer: 'L1_prompt', agent: 'sentiment' });

      const removed = cache.invalidateByAgent('fundamentals');
      expect(removed).toBe(2);
      expect(cache.get('k3')).not.toBeNull(); // sentiment still there
    });

    it('15: invalidates by symbol', () => {
      cache.set('k1', 'v1', { layer: 'L3_data_source', agent: 'fundamentals', symbol: 'AAPL' });
      cache.set('k2', 'v2', { layer: 'L3_data_source', agent: 'fundamentals', symbol: 'TSLA' });

      const removed = cache.invalidateBySymbol('AAPL');
      expect(removed).toBe(1);
    });

    it('16: cleans expired entries', () => {
      cache.set('k1', 'v1', { layer: 'L1_prompt', agent: 'fundamentals', ttlMs: -1 });
      cache.set('k2', 'v2', { layer: 'L1_prompt', agent: 'fundamentals', ttlMs: 3600000 });

      cache.cleanExpired();
      const size = cache.getCacheSize();
      expect(size.entries).toBe(1);
    });

    it('17: getCacheSize reports fullness', () => {
      cache.set('k1', 'v1', { layer: 'L1_prompt', agent: 'fundamentals' });
      const size = cache.getCacheSize();
      expect(size.entries).toBe(1);
      expect(size.fullnessPct).toBeGreaterThan(0);
    });

    it('18: reset clears everything', () => {
      cache.set('k1', 'v1', { layer: 'L1_prompt', agent: 'fundamentals' });
      cache.addPreWarmSymbol({ symbol: 'AAPL', dataTypes: ['financials'], refreshIntervalMs: 3600000 });
      cache.reset();

      expect(cache.getCacheSize().entries).toBe(0);
      expect(cache.getPreWarmSymbols().length).toBe(0);
      expect(cache.getStats().reduce((s, st) => s + st.entries, 0)).toBe(0);
    });
  });
});
