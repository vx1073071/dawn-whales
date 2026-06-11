import { describe, it, expect, vi } from 'vitest';
import { JobScheduler } from '../electron/workers/job-scheduler';

vi.setConfig({ testTimeout: 30000 });
describe('JobScheduler', () => {
  it('should process job by priority', async () => {
    const s = new JobScheduler(2);
    const results: number[] = [];
    s.register('task', async (job) => {
      results.push(job.payload.n);
    });

    s.enqueue('task', { n: 3 }, 3);
    s.enqueue('task', { n: 1 }, 1);
    s.enqueue('task', { n: 5 }, 5);

    s.start(10);
    await new Promise(r => setTimeout(r, 100));
    s.stop();

    expect(results[0]).toBe(5); // highest priority first
    expect(results[1]).toBe(3);
    expect(results[2]).toBe(1);
  });

  it('should retry on failure', async () => {
    const s = new JobScheduler(1);
    let attempts = 0;
    s.register('flakey', async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'ok';
    });

    s.enqueue('flakey', {}, 0, 3);
    s.start(5);
    await new Promise(r => setTimeout(r, 80));
    s.stop();

    expect(attempts).toBe(3);
  });

  it('should cancel pending job', () => {
    const s = new JobScheduler(1);
    const job = s.enqueue('unknown', {}, 0);
    expect(s.cancel(job.id)).toBe(true);
  });
});
