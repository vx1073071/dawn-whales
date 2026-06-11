import { describe, it, expect, vi } from 'vitest';
import { CacheService } from '../electron/workers/cache-service';

vi.setConfig({ testTimeout: 30000 });
describe('CacheService', () => {
  it('should set and get', () => {
    const c = new CacheService();
    c.set('a', 42);
    expect(c.get('a')).toBe(42);
  });

  it('should expire', async () => {
    const c = new CacheService(10, 50);
    c.set('b', 'test');
    expect(c.get('b')).toBe('test');
    await new Promise(r => setTimeout(r, 60));
    expect(c.get('b')).toBeNull();
  });

  it('should evict LRU', () => {
    const c = new CacheService(3, 99999);
    c.set('1', 1); c.set('2', 2); c.set('3', 3);
    c.set('4', 4); // evicts 1
    expect(c.get('1')).toBeNull();
    expect(c.get('4')).toBe(4);
  });

  it('should sweep expired', async () => {
    const c = new CacheService(100, 20);
    c.set('x', 1); c.set('y', 2);
    await new Promise(r => setTimeout(r, 30));
    const removed = c.sweep();
    expect(removed).toBe(2);
    expect(c.size()).toBe(0);
  });

  it('should extend TTL with expire()', () => {
    const c = new CacheService(100, 50);
    c.set('z', 'val');
    c.expire('z', 99999);
    expect(c.ttl('z')).toBeGreaterThan(90000);
  });
});
