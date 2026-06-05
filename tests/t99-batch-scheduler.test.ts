import { describe, it, expect, vi } from 'vitest';
import { BatchScheduler } from '../electron/workers/batch-scheduler';

describe('BatchScheduler', () => {
  it('should execute jobs in DAG order', async () => {
    const s = new BatchScheduler();
    const order: string[] = [];

    s.on('extract', async () => { order.push('extract'); });
    s.on('transform', async () => { order.push('transform'); });
    s.on('load', async () => { order.push('load'); });

    s.register({ id: 'extract', name: 'Extract', schedule: { kind: 'interval', ms: 99999 }, dependencies: [], handler: 'extract' });
    s.register({ id: 'transform', name: 'Transform', schedule: { kind: 'interval', ms: 99999 }, dependencies: ['extract'], handler: 'transform' });
    s.register({ id: 'load', name: 'Load', schedule: { kind: 'interval', ms: 99999 }, dependencies: ['transform'], handler: 'load' });

    await s.executeAll();
    expect(order).toEqual(['extract', 'transform', 'load']);
  });

  it('should skip if dependency fails', async () => {
    const s = new BatchScheduler();

    s.on('step1', async () => { throw new Error('fail'); });
    s.on('step2', async () => {});

    s.register({ id: 'step1', name: 'S1', schedule: { kind: 'interval', ms: 99999 }, dependencies: [], handler: 'step1' });
    s.register({ id: 'step2', name: 'S2', schedule: { kind: 'interval', ms: 99999 }, dependencies: ['step1'], handler: 'step2' });

    await s.executeAll();
    expect(s.getDAG().find(n => n.job.id === 'step2')!.job.status).toBe('failed');
  });

  it('should detect cycles', () => {
    const s = new BatchScheduler();
    s.register({ id: 'a', name: 'A', schedule: { kind: 'interval', ms: 99999 }, dependencies: ['b'], handler: 'a' });
    s.register({ id: 'b', name: 'B', schedule: { kind: 'interval', ms: 99999 }, dependencies: ['a'], handler: 'b' });
    const cycles = s.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });
});
