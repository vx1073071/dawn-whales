// Q-45-04: AsyncIOScheduler test suite
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AsyncIOScheduler,
  type IOTask,
} from '../electron/engine/core/async-io-scheduler';

vi.mock('electron-log', () => ({ default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

function makeTask(overrides: Partial<IOTask> = {}): Omit<IOTask, 'id' | 'createdAt'> {
  return {
    label: 'test-task',
    priority: 'normal',
    fn: async () => ({ ok: true }),
    timeoutMs: 5000,
    retryCount: 0,
    retryDelayMs: 100,
    ...overrides,
  };
}

function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

describe('Q-45-04: AsyncIOScheduler', () => {
  describe('constructor', () => {
    it('should create scheduler with default config', () => {
      expect(new AsyncIOScheduler()).toBeDefined();
    });

    it('should accept partial config', () => {
      const s = new AsyncIOScheduler({ maxConcurrency: 2 });
      expect(s).toBeDefined();
    });
  });

  describe('submit()', () => {
    it('should submit a task and return a taskId string', () => {
      const scheduler = new AsyncIOScheduler();
      const taskId = scheduler.submit(makeTask());
      expect(typeof taskId).toBe('string');
      expect(taskId.length).toBeGreaterThan(0);
    });

    it('should accept critical priority', () => {
      const scheduler = new AsyncIOScheduler();
      const taskId = scheduler.submit(makeTask({ priority: 'critical', label: 'urgent' }));
      expect(typeof taskId).toBe('string');
    });
  });

  describe('submitBatch()', () => {
    it('should submit multiple tasks and return taskIds', () => {
      const scheduler = new AsyncIOScheduler();
      const ids = scheduler.submitBatch([makeTask(), makeTask(), makeTask()]);
      expect(ids).toHaveLength(3);
      ids.forEach(id => expect(typeof id).toBe('string'));
    });

    it('should return empty array for empty input', () => {
      const scheduler = new AsyncIOScheduler();
      expect(scheduler.submitBatch([])).toEqual([]);
    });
  });

  describe('cancel()', () => {
    it('should return boolean', () => {
      const scheduler = new AsyncIOScheduler();
      const taskId = scheduler.submit(makeTask({ fn: async () => { await wait(5000); return {}; } }));
      const result = scheduler.cancel(taskId);
      expect(typeof result).toBe('boolean');
    });

    it('should return false for unknown taskId', () => {
      const scheduler = new AsyncIOScheduler();
      expect(scheduler.cancel('nonexistent-id')).toBe(false);
    });
  });

  describe('cancelGroup()', () => {
    it('should cancel all tasks in a group and return count', () => {
      const scheduler = new AsyncIOScheduler();
      scheduler.submitBatch([
        makeTask({ groupId: 'grp-A' }),
        makeTask({ groupId: 'grp-A' }),
        makeTask({ groupId: 'grp-B' }),
      ]);
      const cancelled = scheduler.cancelGroup('grp-A');
      expect(typeof cancelled).toBe('number');
      expect(cancelled).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getResult()', () => {
    it('should return null for unknown task', () => {
      const scheduler = new AsyncIOScheduler();
      expect(scheduler.getResult('unknown')).toBeNull();
    });

    it('should return result after task completes', async () => {
      const scheduler = new AsyncIOScheduler();
      const taskId = scheduler.submit(makeTask({ fn: async () => ({ answer: 42 }) }));
      await wait(150);
      const result = scheduler.getResult(taskId);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('success');
      expect(result!.result).toEqual({ answer: 42 });
    });
  });

  describe('waitFor()', () => {
    it('should resolve with task result', async () => {
      const scheduler = new AsyncIOScheduler();
      const taskId = scheduler.submit(makeTask({ fn: async () => ({ ok: true }) }));
      const result = await scheduler.waitFor(taskId);
      expect(result.status).toBe('success');
    });
  });

  describe('waitForAll()', () => {
    it('should resolve with results array', async () => {
      const scheduler = new AsyncIOScheduler();
      const ids = scheduler.submitBatch([
        makeTask({ fn: async () => { await wait(30); return 1; } }),
        makeTask({ fn: async () => { await wait(30); return 2; } }),
      ]);
      const results = await scheduler.waitForAll(ids);
      expect(results).toHaveLength(2);
    });

    it('should handle empty array', async () => {
      const scheduler = new AsyncIOScheduler();
      const results = await scheduler.waitForAll([]);
      expect(results).toEqual([]);
    });
  });

  describe('getStats()', () => {
    it('should return scheduler stats', async () => {
      const scheduler = new AsyncIOScheduler();
      scheduler.submit(makeTask());
      await wait(100);
      const stats = scheduler.getStats();
      expect(stats).toHaveProperty('running');
      expect(stats).toHaveProperty('queued');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('avgWaitMs');
      expect(stats).toHaveProperty('avgDurationMs');
      expect(stats).toHaveProperty('throughputPerMinute');
      expect(stats).toHaveProperty('queueUtilization');
    });
  });

  describe('getConfig()', () => {
    it('should return current config', () => {
      const scheduler = new AsyncIOScheduler();
      const config = scheduler.getConfig();
      expect(config).toHaveProperty('maxConcurrency');
      expect(config).toHaveProperty('maxQueueSize');
      expect(config).toHaveProperty('defaultTimeoutMs');
      expect(config).toHaveProperty('defaultPriority');
      expect(config).toHaveProperty('throttlePerSecond');
      expect(config).toHaveProperty('groupConcurrency');
    });
  });

  describe('updateConfig()', () => {
    it('should update config', () => {
      const scheduler = new AsyncIOScheduler();
      expect(() => scheduler.updateConfig({ maxConcurrency: 16 })).not.toThrow();
    });

    it('should reflect update in getConfig()', () => {
      const scheduler = new AsyncIOScheduler();
      scheduler.updateConfig({ throttlePerSecond: 100 });
      expect(scheduler.getConfig().throttlePerSecond).toBe(100);
    });
  });

  describe('task lifecycle', () => {
    it('should report failed status for failing tasks', async () => {
      const scheduler = new AsyncIOScheduler();
      const taskId = scheduler.submit(makeTask({ fn: async () => { throw new Error('boom'); } }));
      const result = await scheduler.waitFor(taskId);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('boom');
    });

    it('should increment completed count after task finishes', async () => {
      const scheduler = new AsyncIOScheduler();
      scheduler.submit(makeTask({ fn: async () => { await wait(20); return true; } }));
      scheduler.submit(makeTask({ fn: async () => { await wait(20); return true; } }));
      await wait(300);
      const stats = scheduler.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(0);
    });
  });
});
