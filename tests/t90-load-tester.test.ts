import { describe, it, expect } from 'vitest';
import { LoadTester } from '../electron/workers/load-tester';

describe('LoadTester', () => {
  it('should run simple load test', async () => {
    const tester = new LoadTester();
    let counter = 0;
    const fn = async () => { counter++; await new Promise(r => setTimeout(r, 1)); };

    const result = await tester.run(
      { concurrency: 5, totalRequests: 20 },
      fn
    );

    expect(counter).toBe(20);
    expect(result.successCount).toBe(20);
    expect(result.failureCount).toBe(0);
    expect(result.totalDuration).toBeGreaterThan(0);
    expect(result.requestsPerSecond).toBeGreaterThan(0);
  });

  it('should track failures', async () => {
    const tester = new LoadTester();
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls <= 3) throw new Error('test error');
    };

    const result = await tester.run(
      { concurrency: 2, totalRequests: 5 },
      fn
    );

    expect(result.failureCount).toBe(3);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should time out slow requests', async () => {
    const tester = new LoadTester();
    const fn = async () => { await new Promise(r => setTimeout(r, 500)); };

    const result = await tester.run(
      { concurrency: 2, totalRequests: 3, timeoutMs: 10 },
      fn
    );

    expect(result.failureCount).toBe(3);
  });

  it('should compute percentiles', async () => {
    const tester = new LoadTester();
    const fn = async () => { await new Promise(r => setTimeout(r, Math.random() * 10)); };

    const result = await tester.run(
      { concurrency: 5, totalRequests: 30 },
      fn
    );

    expect(result.p50Latency).toBeGreaterThan(0);
    expect(result.p95Latency).toBeGreaterThanOrEqual(result.p50Latency);
  });
});
