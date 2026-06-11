import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../electron/workers/rate-limiter';

vi.setConfig({ testTimeout: 30000 });
describe('RateLimiter', () => {
  it('should allow within limit', async () => {
    const rl = new RateLimiter(5, 10);
    for (let i = 0; i < 5; i++) {
      expect(await rl.acquire('key1')).toBe(true);
    }
  });

  it('should deny exceeding limit', async () => {
    const rl = new RateLimiter(2, 0.1);
    expect(await rl.acquire('key2')).toBe(true);
    expect(await rl.acquire('key2')).toBe(true);
    expect(await rl.acquire('key2')).toBe(false);
  });

  it('should refill over time', async () => {
    const rl = new RateLimiter(2, 100);
    await rl.acquire('key3');
    await rl.acquire('key3');
    expect(await rl.acquire('key3')).toBe(false);
    await new Promise(r => setTimeout(r, 20));
    expect(await rl.acquire('key3')).toBe(true);
  });

  it('should isolate keys', async () => {
    const rl = new RateLimiter(1, 0.1);
    expect(await rl.acquire('a')).toBe(true);
    expect(await rl.acquire('a')).toBe(false);
    expect(await rl.acquire('b')).toBe(true); // separate key
  });
});
