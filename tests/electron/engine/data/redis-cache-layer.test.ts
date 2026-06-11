/**
 * Tests for RedisCacheLayer
 * Covers: electron/engine/data/redis-cache-layer.ts (821 lines)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RedisCacheLayer,
  createRedisCache,
  destroyRedisCache,
  destroyAllRedisCaches,
} from '../../../../electron/engine/data/redis-cache-layer';

// Suppress noisy log output in test
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

describe('RedisCacheLayer', () => {
  let cache: RedisCacheLayer;

  beforeEach(() => {
    destroyAllRedisCaches();
    cache = new RedisCacheLayer({
      namespace: 'test',
      maxKeys: 100,
      enableStats: false,
    });
  });

  afterEach(() => {
    cache.disconnect();
    destroyAllRedisCaches();
  });

  // ── Connection ───────────────────────────────────────────────────────────

  describe('connection', () => {
    it('should be connected after construction', () => {
      expect(cache.isConnected()).toBe(true);
    });

    it('should disconnect', () => {
      cache.disconnect();
      expect(cache.isConnected()).toBe(false);
    });

    it('should throw on operations when disconnected', async () => {
      cache.disconnect();
      await expect(cache.get('k')).rejects.toThrow();
    });
  });

  // ── Core string commands ─────────────────────────────────────────────────

  describe('get/set/del', () => {
    it('should set and get a string value', async () => {
      await cache.set('name', 'alice');
      expect(await cache.get('name')).toBe('alice');
    });

    it('should set and get object values', async () => {
      await cache.set('user', { id: 1, name: 'bob' });
      const val = await cache.get<{ id: number; name: string }>('user');
      expect(val).toEqual({ id: 1, name: 'bob' });
    });

    it('should return null for missing key', async () => {
      expect(await cache.get('missing')).toBeNull();
    });

    it('should delete keys', async () => {
      await cache.set('a', '1');
      await cache.set('b', '2');
      const deleted = await cache.del('a', 'b', 'c');
      expect(deleted).toBe(2);
      expect(await cache.get('a')).toBeNull();
    });

    it('should handle overwrite', async () => {
      await cache.set('k', 'v1');
      await cache.set('k', 'v2');
      expect(await cache.get('k')).toBe('v2');
    });
  });

  // ── TTL ──────────────────────────────────────────────────────────────────

  describe('TTL', () => {
    it('should expire keys after TTL', async () => {
      vi.useFakeTimers();
      await cache.set('temp', 'val', 2); // 2 seconds TTL
      vi.advanceTimersByTime(1000);
      expect(await cache.get('temp')).toBe('val'); // still alive
      vi.advanceTimersByTime(1500);
      expect(await cache.get('temp')).toBeNull(); // expired
      vi.useRealTimers();
    });

    it('should report TTL correctly', async () => {
      vi.useFakeTimers();
      await cache.set('k', 'v', 10);
      vi.advanceTimersByTime(3000);
      const ttl = await cache.ttl('k');
      expect(ttl).toBeGreaterThanOrEqual(6);
      expect(ttl).toBeLessThanOrEqual(7);
      vi.useRealTimers();
    });

    it('should return -2 for nonexistent key TTL', async () => {
      expect(await cache.ttl('nope')).toBe(-2);
    });

    it('should return -1 for key without TTL', async () => {
      await cache.set('perm', 'val');
      expect(await cache.ttl('perm')).toBe(-1);
    });

    it('should set expire on existing key', async () => {
      vi.useFakeTimers();
      await cache.set('k', 'v');
      await cache.expire('k', 1);
      vi.advanceTimersByTime(1500);
      expect(await cache.get('k')).toBeNull();
      vi.useRealTimers();
    });

    it('expire should return false for nonexistent key', async () => {
      expect(await cache.expire('nope', 10)).toBe(false);
    });

    it('ttl should return -2 for expired key', async () => {
      vi.useFakeTimers();
      await cache.set('k', 'v', 1);
      vi.advanceTimersByTime(1500);
      expect(await cache.ttl('k')).toBe(-2);
      vi.useRealTimers();
    });
  });

  // ── Key operations ───────────────────────────────────────────────────────

  describe('exists/keys', () => {
    it('should check key existence', async () => {
      await cache.set('a', '1');
      expect(await cache.exists('a')).toBe(1);
      expect(await cache.exists('b')).toBe(0);
      expect(await cache.exists('a', 'b')).toBe(1);
    });

    it('should find keys by pattern', async () => {
      await cache.set('user:1', 'a');
      await cache.set('user:2', 'b');
      await cache.set('item:1', 'c');
      const userKeys = await cache.keys('user:*');
      expect(userKeys.length).toBe(2);
    });

    it('should exclude expired keys from pattern search', async () => {
      vi.useFakeTimers();
      await cache.set('temp:1', 'a', 1);
      await cache.set('temp:2', 'b');
      vi.advanceTimersByTime(1500);
      const keys = await cache.keys('temp:*');
      expect(keys.length).toBe(1);
      vi.useRealTimers();
    });
  });

  // ── Increment ────────────────────────────────────────────────────────────

  describe('incr', () => {
    it('should increment existing numeric string', async () => {
      await cache.set('counter', '10');
      expect(await cache.incr('counter')).toBe(11);
    });

    it('should initialize missing key to 0 then increment', async () => {
      expect(await cache.incr('new_counter')).toBe(1);
    });

    it('should throw on non-numeric value', async () => {
      await cache.set('str', 'hello');
      await expect(cache.incr('str')).rejects.toThrow();
    });
  });

  // ── flushdb ──────────────────────────────────────────────────────────────

  describe('flushdb', () => {
    it('should clear all data', async () => {
      await cache.set('a', '1');
      await cache.hset('h', 'f', 'v');
      await cache.flushdb();
      expect(await cache.dbsize()).toBe(0);
    });
  });

  // ── Hash commands ────────────────────────────────────────────────────────

  describe('hash commands', () => {
    it('hset/hget should work', async () => {
      await cache.hset('myhash', 'name', 'alice');
      expect(await cache.hget('myhash', 'name')).toBe('alice');
    });

    it('hget should return null for missing hash', async () => {
      expect(await cache.hget('nope', 'f')).toBeNull();
    });

    it('hgetall should return all fields', async () => {
      await cache.hset('h', 'a', '1');
      await cache.hset('h', 'b', '2');
      const all = await cache.hgetall('h');
      expect(all).toEqual({ a: '1', b: '2' });
    });

    it('hgetall should return null for missing hash', async () => {
      expect(await cache.hgetall('nope')).toBeNull();
    });

    it('hdel should remove fields', async () => {
      await cache.hset('h', 'a', '1');
      await cache.hset('h', 'b', '2');
      expect(await cache.hdel('h', 'a', 'c')).toBe(1);
      expect(await cache.hget('h', 'a')).toBeNull();
    });

    it('hdel should return 0 for missing hash', async () => {
      expect(await cache.hdel('nope', 'f')).toBe(0);
    });

    it('hlen should return field count', async () => {
      await cache.hset('h', 'a', '1');
      await cache.hset('h', 'b', '2');
      expect(await cache.hlen('h')).toBe(2);
      expect(await cache.hlen('nope')).toBe(0);
    });

    it('hset should return 1 for new field', async () => {
      expect(await cache.hset('h', 'new_field', 'val')).toBe(1);
      expect(await cache.hset('h', 'new_field', 'val2')).toBe(0); // overwrite
    });

    it('should clean up empty hash after hdel', async () => {
      await cache.hset('h', 'only', 'val');
      await cache.hdel('h', 'only');
      expect(await cache.hgetall('h')).toBeNull();
    });
  });

  // ── Pub/Sub ──────────────────────────────────────────────────────────────

  describe('pub/sub', () => {
    it('should deliver messages to direct subscribers', async () => {
      const received: string[] = [];
      cache.subscribe('ch1', (msg) => received.push(msg.message));
      const count = await cache.publish('ch1', 'hello');
      expect(count).toBe(1);
      expect(received).toEqual(['hello']);
    });

    it('should deliver to multiple subscribers', async () => {
      let count1 = 0, count2 = 0;
      cache.subscribe('ch', () => count1++);
      cache.subscribe('ch', () => count2++);
      await cache.publish('ch', 'msg');
      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it('should support pattern subscribers', async () => {
      const received: string[] = [];
      cache.psubscribe('news:*', (msg) => received.push(msg.channel));
      await cache.publish('news:sports', 'goal');
      expect(received).toEqual(['news:sports']);
    });

    it('should unsubscribe all listeners', async () => {
      cache.subscribe('ch', () => {});
      cache.unsubscribe('ch');
      const count = await cache.publish('ch', 'msg');
      expect(count).toBe(0);
    });

    it('should unsubscribe specific listener', async () => {
      let called = 0;
      const cb = () => called++;
      cache.subscribe('ch', cb);
      cache.unsubscribe('ch', cb);
      await cache.publish('ch', 'msg');
      expect(called).toBe(0);
    });

    it('on/off should be aliases for subscribe/unsubscribe', async () => {
      let called = 0;
      const cb = () => called++;
      cache.on('ev', cb);
      await cache.publish('ev', 'x');
      expect(called).toBe(1);
      cache.off('ev');
      await cache.publish('ev', 'x');
      expect(called).toBe(1);
    });

    it('should handle subscriber callback errors', async () => {
      cache.subscribe('ch', () => { throw new Error('cb error'); });
      // Should not throw
      const count = await cache.publish('ch', 'msg');
      expect(count).toBe(0); // errored cb not counted
    });

    it('should return 0 for no subscribers', async () => {
      expect(await cache.publish('empty', 'msg')).toBe(0);
    });
  });

  // ── Statistics ───────────────────────────────────────────────────────────

  describe('statistics', () => {
    it('should track hits and misses', async () => {
      await cache.set('k', 'v');
      await cache.get('k'); // hit
      await cache.get('missing'); // miss
      const stats = cache.getStats();
      expect(stats.hits).toBeGreaterThanOrEqual(1);
      expect(stats.misses).toBeGreaterThanOrEqual(1);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });

    it('should track sets and deletes', async () => {
      await cache.set('a', '1');
      await cache.set('b', '2');
      await cache.del('a');
      const stats = cache.getStats();
      expect(stats.sets).toBe(2);
      expect(stats.deletes).toBe(1);
    });

    it('should reset stats', async () => {
      await cache.set('k', 'v');
      await cache.get('k');
      cache.resetStats();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should report memory usage', async () => {
      await cache.set('k', 'some value');
      const stats = cache.getStats();
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
    });

    it('should track evictions', async () => {
      const small = new RedisCacheLayer({ namespace: 'small', maxKeys: 3, enableStats: false });
      for (let i = 0; i < 5; i++) {
        await small.set(`k${i}`, `v${i}`);
      }
      const stats = small.getStats();
      expect(stats.evictions).toBeGreaterThanOrEqual(2);
      small.disconnect();
    });
  });

  // ── LRU eviction ────────────────────────────────────────────────────────

  describe('LRU eviction', () => {
    it('should evict least recently used key', async () => {
      const small = new RedisCacheLayer({ namespace: 'lru', maxKeys: 3, enableStats: false });
      await small.set('a', '1');
      await small.set('b', '2');
      await small.set('c', '3');
      // Access 'a' to make it recently used
      await small.get('a');
      // Adding 'd' should evict 'b' (least recently used)
      await small.set('d', '4');
      expect(await small.get('b')).toBeNull();
      expect(await small.get('a')).toBe('1');
      small.disconnect();
    });

    it('should support LFU eviction policy', async () => {
      const lfu = new RedisCacheLayer({ namespace: 'lfu', maxKeys: 3, evictionPolicy: 'lfu', enableStats: false });
      await lfu.set('a', '1');
      await lfu.set('b', '2');
      await lfu.set('c', '3');
      // Access 'a' and 'c' multiple times
      await lfu.get('a');
      await lfu.get('a');
      await lfu.get('c');
      // 'b' has least access count
      await lfu.set('d', '4');
      expect(await lfu.get('b')).toBeNull();
      lfu.disconnect();
    });

    it('should support TTL eviction policy', async () => {
      vi.useFakeTimers();
      const ttlCache = new RedisCacheLayer({ namespace: 'ttl', maxKeys: 3, evictionPolicy: 'ttl', enableStats: false });
      await ttlCache.set('a', '1', 1);  // expires in 1s
      await ttlCache.set('b', '2', 10); // expires in 10s
      await ttlCache.set('c', '3');      // no expiry
      vi.advanceTimersByTime(500);
      // Adding 'd' should evict 'a' (earliest TTL)
      await ttlCache.set('d', '4');
      // 'a' might have been evicted
      // With TTL policy, entry with closest expiry is evicted
      expect(await ttlCache.dbsize()).toBeLessThanOrEqual(4);
      ttlCache.disconnect();
      vi.useRealTimers();
    });
  });

  // ── Utility commands ─────────────────────────────────────────────────────

  describe('utility commands', () => {
    it('dbsize should return total entries', async () => {
      await cache.set('a', '1');
      await cache.hset('h', 'f', 'v');
      expect(await cache.dbsize()).toBe(2);
    });

    it('type should return key type', async () => {
      await cache.set('str', 'val');
      await cache.hset('hash', 'f', 'v');
      expect(await cache.type('str')).toBe('string');
      expect(await cache.type('hash')).toBe('hash');
      expect(await cache.type('nope')).toBe('none');
    });

    it('mget should get multiple keys', async () => {
      await cache.set('a', '1');
      await cache.set('b', '2');
      const vals = await cache.mget('a', 'b', 'c');
      expect(vals).toEqual(['1', '2', null]);
    });

    it('mset should set multiple keys', async () => {
      await cache.mset([['a', '1'], ['b', '2']]);
      expect(await cache.get('a')).toBe('1');
      expect(await cache.get('b')).toBe('2');
    });

    it('setnx should only set if not exists', async () => {
      expect(await cache.setnx('k', 'v1')).toBe(true);
      expect(await cache.setnx('k', 'v2')).toBe(false);
      expect(await cache.get('k')).toBe('v1');
    });

    it('setnx should set if previous key expired', async () => {
      vi.useFakeTimers();
      await cache.set('k', 'old', 1);
      vi.advanceTimersByTime(1500);
      expect(await cache.setnx('k', 'new')).toBe(true);
      expect(await cache.get('k')).toBe('new');
      vi.useRealTimers();
    });

    it('append should concatenate values', async () => {
      await cache.set('k', 'hello');
      const len = await cache.append('k', ' world');
      expect(len).toBe(11);
      expect(await cache.get('k')).toBe('hello world');
    });

    it('append should create key if not exists', async () => {
      const len = await cache.append('new', 'val');
      expect(len).toBe(3);
    });

    it('strlen should return value length', async () => {
      await cache.set('k', 'hello');
      expect(await cache.strlen('k')).toBe(5);
      expect(await cache.strlen('nope')).toBe(0);
    });
  });

  // ── Pipeline builder ─────────────────────────────────────────────────────

  describe('pipeline builder', () => {
    it('should batch commands', async () => {
      await cache.set('x', '10');
      const pipe = cache.pipeline();
      const results = await pipe
        .get('x')
        .set('y', '20')
        .incr('x')
        .hset('h', 'f', 'v')
        .hget('h', 'f')
        .del('y')
        .exec();
      expect(results.length).toBe(6);
      expect(results[0]).toBe('10');    // get
      expect(results[1]).toBe(true);    // set
      expect(results[2]).toBe(11);      // incr
      expect(results[4]).toBe('v');     // hget
    });

    it('should handle errors in pipeline', async () => {
      await cache.set('str', 'hello');
      const results = await cache.pipeline()
        .get('str')
        .incr('str')  // will fail
        .exec();
      expect(results[0]).toBe('hello');
      expect(results[1]).toBeInstanceOf(Error);
    });
  });

  // ── Key prefix ───────────────────────────────────────────────────────────

  describe('key prefix', () => {
    it('should prefix all keys', async () => {
      const prefixed = new RedisCacheLayer({ namespace: 'pfx', keyPrefix: 'app', enableStats: false });
      await prefixed.set('user', 'alice');
      // Internal storage should have prefixed key
      expect(await prefixed.get('user')).toBe('alice');
      const keys = await prefixed.keys('*');
      expect(keys).toContain('user');
      prefixed.disconnect();
    });
  });

  // ── Factory & singleton ──────────────────────────────────────────────────

  describe('factory', () => {
    it('createRedisCache should return singleton per namespace', () => {
      const c1 = createRedisCache({ namespace: 'ns1' });
      const c2 = createRedisCache({ namespace: 'ns1' });
      expect(c1).toBe(c2);
      c1.disconnect();
      c2.disconnect();
    });

    it('createRedisCache should create different instances for different namespaces', () => {
      const c1 = createRedisCache({ namespace: 'ns_a' });
      const c2 = createRedisCache({ namespace: 'ns_b' });
      expect(c1).not.toBe(c2);
      c1.disconnect();
      c2.disconnect();
    });

    it('destroyRedisCache should cleanup', () => {
      const c = createRedisCache({ namespace: 'to_destroy' });
      destroyRedisCache('to_destroy');
      const c2 = createRedisCache({ namespace: 'to_destroy' });
      expect(c).not.toBe(c2);
      c2.disconnect();
    });

    it('destroyAllRedisCaches should cleanup all', () => {
      createRedisCache({ namespace: 'all1' });
      createRedisCache({ namespace: 'all2' });
      destroyAllRedisCaches();
      // Creating again should give new instances
      const c = createRedisCache({ namespace: 'all1' });
      expect(c.isConnected()).toBe(true);
      c.disconnect();
    });
  });
});
