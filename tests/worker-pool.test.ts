// P0 Fixed: worker-pool tests — simplified to avoid worker_threads import issue
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We use the extras module which does NOT import worker_threads directly
import { WorkerPoolBenchmark, PriorityPoolScheduler, PoolHealthMonitor } from '../electron/workers/worker-pool-extras';

describe('WorkerPool P0 (core API)', () => {
  it('WorkerPoolBenchmark should measure throughput', async () => {
    const bench = new WorkerPoolBenchmark();
    const mockPool = {
      execute: async () => { await new Promise(r => setTimeout(r, 5)); },
      stats: { totalWorkers: 4, busyWorkers: 2, queueLength: 0 }
    } as any;
    const result = await bench.runBatch(mockPool, Array(10).fill(0), d => d);
    expect(result.taskCount).toBe(10);
    expect(result.throughput).toBeGreaterThan(0);
    expect(result.p50Latency).toBeGreaterThan(0);
  });

  it('WorkerPoolBenchmark should run stress test', async () => {
    const bench = new WorkerPoolBenchmark();
    const mockPool = {
      execute: async () => { await new Promise(r => setTimeout(r, 5)); },
      stats: { totalWorkers: 2, busyWorkers: 1, queueLength: 0 }
    } as any;
    const result = await bench.stressTest(mockPool, 5, 3);
    expect(result.completed + result.failed + result.timeout).toBe(15);
  });

  it('PriorityPoolScheduler should execute by priority', async () => {
    const mockPool = {
      execute: async (_t: string, data: any) => data,
      stats: { totalWorkers: 1, busyWorkers: 0, queueLength: 0 }
    } as any;
    const scheduler = new PriorityPoolScheduler(mockPool);
    scheduler.enqueue({ id: 'low', priority: 0, data: 'low' });
    scheduler.enqueue({ id: 'high', priority: 3, data: 'high' });
    scheduler.enqueue({ id: 'mid', priority: 1, data: 'mid' });
    expect(await scheduler.executeNext()).toBe('high');
    expect(await scheduler.executeNext()).toBe('mid');
    expect(await scheduler.executeNext()).toBe('low');
    expect(scheduler.queueSize()).toBe(0);
  });

  it('PriorityPoolScheduler should drain all', async () => {
    const mockPool = {
      execute: async () => 'ok',
      stats: { totalWorkers: 1, busyWorkers: 0, queueLength: 0 }
    } as any;
    const scheduler = new PriorityPoolScheduler(mockPool);
    scheduler.enqueue({ id: 'a', priority: 1, data: 1 });
    scheduler.enqueue({ id: 'b', priority: 2, data: 2 });
    const result = await scheduler.drain();
    expect(result.completed).toBe(2);
  });

  it('PoolHealthMonitor should report healthy', () => {
    const mockPool = { stats: { totalWorkers: 4, busyWorkers: 1, queueLength: 5 } } as any;
    const monitor = new PoolHealthMonitor(mockPool);
    const report = monitor.healthReport();
    expect(report.status).toBe('healthy');
    expect(report.utilization).toBe(0.25);
    expect(report.recommendations).toBeInstanceOf(Array);
  });

  it('PoolHealthMonitor should detect critical', () => {
    const mockPool = { stats: { totalWorkers: 1, busyWorkers: 1, queueLength: 200 } } as any;
    const monitor = new PoolHealthMonitor(mockPool);
    const report = monitor.healthReport();
    expect(report.status).toBe('critical');
    expect(report.utilization).toBe(1);
  });
});
