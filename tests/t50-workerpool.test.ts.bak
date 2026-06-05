// T50: WorkerPool tests
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WorkerPool } from '../electron/workers/worker-pool';
import { PriorityTaskQueue } from '../electron/workers/task-queue';
import { ResourceMonitor } from '../electron/workers/resource-monitor';

describe('PriorityTaskQueue', () => {
  it('should dequeue high priority tasks first', () => {
    const q = new PriorityTaskQueue();
    const order: string[] = [];
    const mkTask = (id: string, prio: any) => ({
      id, priority: prio, module: 'test', data: {},
      resolve: () => { order.push(id); },
      reject: () => {},
      createdAt: Date.now(),
    });
    q.enqueue(mkTask('low', 'low'));
    q.enqueue(mkTask('normal', 'normal'));
    q.enqueue(mkTask('high', 'high'));
    
    const t1 = q.dequeue()!;
    t1.resolve({});
    expect(t1.id).toBe('high');
    
    const t2 = q.dequeue()!;
    t2.resolve({});
    expect(t2.id).toBe('normal');
    
    const t3 = q.dequeue()!;
    t3.resolve({});
    expect(t3.id).toBe('low');
  });

  it('should report correct stats', () => {
    const q = new PriorityTaskQueue();
    q.enqueue({ id: '1', priority: 'high', module: 't', data: {}, resolve: ()=>{}, reject: ()=>{}, createdAt: Date.now() });
    q.enqueue({ id: '2', priority: 'low', module: 't', data: {}, resolve: ()=>{}, reject: ()=>{}, createdAt: Date.now() });
    
    expect(q.stats.pending).toBe(2);
    expect(q.stats.byPriority.high).toBe(1);
    expect(q.stats.byPriority.low).toBe(1);
  });

  it('should clear all pending tasks', () => {
    const q = new PriorityTaskQueue();
    const fails: string[] = [];
    q.enqueue({ id: '1', priority: 'normal', module: 't', data: {}, resolve: ()=>{}, reject: (e) => { fails.push(e.message); }, createdAt: Date.now() });
    q.clear();
    expect(q.size).toBe(0);
    expect(fails.length).toBe(1);
  });
});

describe('ResourceMonitor', () => {
  it('should start and sample resources', async () => {
    const monitor = new ResourceMonitor();
    monitor.start(500);
    await new Promise(r => setTimeout(r, 1200));
    monitor.stop();
    
    expect(monitor.latest).not.toBeNull();
    expect(monitor.latest!.timestamp).toBeGreaterThan(0);
    expect(monitor.summary).not.toBeNull();
  });

  it('should recommend worker count', () => {
    const monitor = new ResourceMonitor();
    monitor.start(100);
    // After a brief moment, should have at least 1 recommendation
    const count = monitor.recommendWorkers();
    expect(count).toBeGreaterThanOrEqual(1);
    monitor.stop();
  });

  it('should cap history at 100', async () => {
    const monitor = new ResourceMonitor();
    monitor.start(10);
    await new Promise(r => setTimeout(r, 1500));
    monitor.stop();
    expect(monitor.history_.length).toBeLessThanOrEqual(100);
  });
});

describe('WorkerPool', () => {
  let pool: WorkerPool;

  afterAll(async () => {
    await pool?.terminate();
  });

  it('should create pool with default workers', () => {
    pool = new WorkerPool(2);
    expect(pool.stats.totalWorkers).toBe(0); // lazy init
    expect(pool.stats.queueLength).toBe(0);
  });

  it('should return stats', () => {
    pool = new WorkerPool(2);
    const s = pool.stats;
    expect(s).toHaveProperty('totalWorkers');
    expect(s).toHaveProperty('busyWorkers');
    expect(s).toHaveProperty('queueLength');
  });

  it('should terminate cleanly', async () => {
    pool = new WorkerPool(1);
    await pool.terminate();
    expect(pool.stats.totalWorkers).toBe(0);
  });
});
