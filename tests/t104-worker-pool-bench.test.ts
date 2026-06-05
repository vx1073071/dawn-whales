import { describe, it, expect } from 'vitest';
import { WorkerPoolBenchmark, PoolHealthMonitor, PriorityPoolScheduler } from '../electron/workers/worker-pool-extras';

describe('WorkerPoolBenchmark', () => {
  it('should measure throughput', async () => {
    const bench = new WorkerPoolBenchmark();
    // Mock pool with simple in-process execution for testing
    const mockPool = {
      execute: async (type: string, data: any) => {
        await new Promise(r => setTimeout(r, 5));
        return data;
      },
      stats: { totalWorkers: 4, busyWorkers: 2, queueLength: 0 },
    };

    const result = await bench.runBatch(mockPool as any, Array.from({ length: 10 }, (_, i) => i), (d) => d);
    expect(result.taskCount).toBe(10);
    expect(result.throughput).toBeGreaterThan(0);
    expect(result.p50Latency).toBeGreaterThan(0);
    expect(result.failures).toBe(0);
  });

  it('should run stress test', async () => {
    const bench = new WorkerPoolBenchmark();
    const mockPool = {
      execute: async () => { await new Promise(r => setTimeout(r, 2)); },
      stats: { totalWorkers: 2, busyWorkers: 1, queueLength: 0 },
    };

    const result = await bench.stressTest(mockPool as any, 5, 4);
    expect(result.completed + result.failed + result.timeout).toBe(20);
    expect(result.peakConcurrency).toBeGreaterThan(0);
  });
});

describe('PoolHealthMonitor', () => {
  it('should report healthy', () => {
    const mockPool = {
      stats: { totalWorkers: 4, busyWorkers: 1, queueLength: 5 },
    };
    const monitor = new PoolHealthMonitor(mockPool as any);
    const report = monitor.healthReport();
    expect(report.status).toBe('healthy');
    expect(report.utilization).toBe(0.25);
  });

  it('should report critical when overloaded', () => {
    const mockPool = {
      stats: { totalWorkers: 1, busyWorkers: 1, queueLength: 200 },
    };
    const monitor = new PoolHealthMonitor(mockPool as any);
    const report = monitor.healthReport();
    expect(report.status).toBe('critical');
  });
});

describe('PriorityPoolScheduler', () => {
  it('should execute by priority', async () => {
    const mockPool = {
      execute: async (type: string, data: any) => data,
      stats: { totalWorkers: 1, busyWorkers: 0, queueLength: 0 },
    };
    const scheduler = new PriorityPoolScheduler(mockPool as any);
    scheduler.enqueue({ id: 'low', priority: 0, data: 'low' });
    scheduler.enqueue({ id: 'high', priority: 3, data: 'high' });
    scheduler.enqueue({ id: 'mid', priority: 1, data: 'mid' });

    const first = await scheduler.executeNext();
    expect(first).toBe('high'); // highest priority first

    const second = await scheduler.executeNext();
    expect(second).toBe('mid');
  });

  it('should drain all', async () => {
    const mockPool = {
      execute: async () => 'ok',
      stats: { totalWorkers: 1, busyWorkers: 0, queueLength: 0 },
    };
    const scheduler = new PriorityPoolScheduler(mockPool as any);
    scheduler.enqueue({ id: 'a', priority: 1, data: 1 });
    scheduler.enqueue({ id: 'b', priority: 2, data: 2 });

    const result = await scheduler.drain();
    expect(result.completed).toBe(2);
    expect(scheduler.queueSize()).toBe(0);
  });
});
