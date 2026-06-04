import { describe, it, expect, vi } from 'vitest';
import { withRetry, safeAsync, errorReporter } from '../electron/workers/error-middleware';
import { MetricsCollector } from '../electron/workers/metrics-collector';

describe('error-middleware', () => {
  it('withRetry should succeed on first try', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withRetry(fn);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('withRetry should retry on failure', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'ok';
    };
    const result = await withRetry(fn, { maxRetries: 3 });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('withRetry should throw after exhausted', async () => {
    const fn = async () => { throw new Error('persistent fail'); };
    await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow('persistent fail');
  });

  it('safeAsync should return fallback', async () => {
    const result = await safeAsync(
      async () => { throw new Error('crash'); },
      'fallback'
    );
    expect(result).toBe('fallback');
  });
});

describe('MetricsCollector', () => {
  it('should track counters', () => {
    const m = new MetricsCollector();
    m.counter('orders.placed');
    m.counterInc('orders.placed', 4);
    m.counterInc('orders.placed', 1);
    const points = m.collect();
    expect(points.find(p => p.name === 'orders.placed')!.value).toBe(6);
  });

  it('should track gauges', () => {
    const m = new MetricsCollector();
    m.gauge('position.value', 50000);
    m.gauge('position.value', 52000); // overwrite
    const points = m.collect();
    expect(points.find(p => p.name === 'position.value')!.value).toBe(52000);
  });

  it('should track histograms', () => {
    const m = new MetricsCollector();
    const h = m.histogram('api.latency', [10, 50, 100, 500]);
    h.observe(25); h.observe(75); h.observe(200);
    const stats = h.stats();
    expect(stats.count).toBe(3);
    expect(stats.avg).toBe(100);
  });
});
