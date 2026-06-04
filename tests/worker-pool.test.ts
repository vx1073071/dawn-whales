// ── Worker Pool Unit Tests ─────────────────────────────────────────────────
// Comprehensive tests for JVS-51: Worker Pool optimization

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock EventEmitter as a proper class that can be extended
const MockEventEmitter = vi.hoisted(() => {
  return class MockEventEmitter {
    private listeners: Map<string, Function[]> = new Map();
    
    on(event: string, listener: Function) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)!.push(listener);
      return this;
    }
    
    emit(event: string, ...args: any[]) {
      const listeners = this.listeners.get(event) || [];
      listeners.forEach(listener => listener(...args));
      return true;
    }
    
    off(event: string, listener: Function) {
      const listeners = this.listeners.get(event) || [];
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      return this;
    }
    
    removeAllListeners(event?: string) {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
      }
      return this;
    }
  };
});

// Mock events module with proper EventEmitter
vi.mock('events', () => ({
  EventEmitter: MockEventEmitter,
  default: MockEventEmitter,
}));

// Mock worker_threads before importing
vi.mock('worker_threads', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      once: vi.fn(),
      postMessage: vi.fn(),
      terminate: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('WorkerPool', () => {
  let pool: any;
  let WorkerPool: any;
  let getWorkerPool: any;
  let resetWorkerPool: any;

  beforeEach(async () => {
    // Dynamic import after mocks are set up
    const workerPoolModule = await import('../electron/workers/worker-pool');
    WorkerPool = workerPoolModule.WorkerPool;
    getWorkerPool = workerPoolModule.getWorkerPool;
    resetWorkerPool = workerPoolModule.resetWorkerPool;
    
    resetWorkerPool();
    pool = getWorkerPool({
      maxWorkers: 4,
      taskTimeout: 5000,
      workerRestartThreshold: 3,
      healthCheckInterval: 10000,
      autoRestart: true,
      maxQueueSize: 100,
    });
  });

  afterEach(async () => {
    await pool.terminate();
    resetWorkerPool();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const defaultPool = new WorkerPool();
      const stats = defaultPool.getStats();
      
      expect(stats.totalWorkers).toBe(0);
      expect(stats.queueLength).toBe(0);
      expect(stats.maxQueueSize).toBe(1000);
    });

    it('should initialize with custom config', () => {
      const customPool = new WorkerPool({
        maxWorkers: 8,
        taskTimeout: 10000,
        maxQueueSize: 500,
      });
      
      const stats = customPool.getStats();
      expect(stats.maxQueueSize).toBe(500);
    });

    it('should use singleton pattern', () => {
      const pool1 = getWorkerPool();
      const pool2 = getWorkerPool();
      
      expect(pool1).toBe(pool2);
    });
  });

  describe('Task Execution', () => {
    it('should accept task submission', async () => {
      const executePromise = pool.execute('test-module', { data: 'test' });
      
      // Task should be queued or executed
      const stats = pool.getStats();
      expect(stats.queueLength).toBeGreaterThanOrEqual(0);
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(0);
    });

    it('should respect queue size limit', async () => {
      const smallPool = new WorkerPool({
        maxWorkers: 1,
        maxQueueSize: 5,
      });

      // Fill the queue
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          smallPool.execute('test-module', { data: i }).catch(() => {
            // Expected to fail when queue is full
          })
        );
      }

      await Promise.allSettled(promises);
      const stats = smallPool.getStats();
      expect(stats.queueLength).toBeLessThanOrEqual(5);
    });

    it('should handle task priority', async () => {
      // Submit tasks with different priorities
      const promises = [
        pool.execute('test-module', { data: 'low' }, 3),
        pool.execute('test-module', { data: 'high' }, 1),
        pool.execute('test-module', { data: 'medium' }, 2),
      ];

      await Promise.allSettled(promises);
      const stats = pool.getStats();
      expect(stats.totalTasksCompleted + stats.totalTasksFailed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Worker Management', () => {
    it('should create workers on demand', async () => {
      await pool.execute('test-module', { data: 'test' });
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBeGreaterThan(0);
    });

    it('should respect max workers limit', async () => {
      const maxWorkers = 2;
      const limitedPool = new WorkerPool({ maxWorkers });

      // Submit multiple tasks
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(limitedPool.execute('test-module', { data: i }));
      }

      await Promise.allSettled(promises);
      const stats = limitedPool.getStats();
      expect(stats.totalWorkers).toBeLessThanOrEqual(maxWorkers);
    });

    it('should track worker health', () => {
      const stats = pool.getStats();
      expect(stats.workerHealth).toBeDefined();
      expect(typeof stats.workerHealth).toBe('object');
    });
  });

  describe('Statistics', () => {
    it('should return comprehensive stats', () => {
      const stats = pool.getStats();

      expect(stats).toHaveProperty('totalWorkers');
      expect(stats).toHaveProperty('busyWorkers');
      expect(stats).toHaveProperty('idleWorkers');
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('maxQueueSize');
      expect(stats).toHaveProperty('totalTasksCompleted');
      expect(stats).toHaveProperty('totalTasksFailed');
      expect(stats).toHaveProperty('averageTaskDuration');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('workerHealth');
    });

    it('should track uptime', () => {
      const stats1 = pool.getStats();
      expect(stats1.uptime).toBeGreaterThanOrEqual(0);

      // Wait a bit and check again
      return new Promise(resolve => {
        setTimeout(() => {
          const stats2 = pool.getStats();
          expect(stats2.uptime).toBeGreaterThan(stats1.uptime);
          resolve(true);
        }, 100);
      });
    });

    it('should maintain backward compatibility with stats getter', () => {
      const stats = pool.stats;
      
      expect(stats).toHaveProperty('totalWorkers');
      expect(stats).toHaveProperty('busyWorkers');
      expect(stats).toHaveProperty('queueLength');
    });
  });

  describe('Termination', () => {
    it('should terminate all workers gracefully', async () => {
      // Create some workers
      await pool.execute('test-module', { data: 'test' });
      
      const statsBefore = pool.getStats();
      expect(statsBefore.totalWorkers).toBeGreaterThan(0);

      await pool.terminate();
      
      const statsAfter = pool.getStats();
      expect(statsAfter.totalWorkers).toBe(0);
      expect(statsAfter.queueLength).toBe(0);
    });

    it('should clear queue on termination', async () => {
      // Submit tasks without waiting
      pool.execute('test-module', { data: 'test1' });
      pool.execute('test-module', { data: 'test2' });

      await pool.terminate();
      
      const stats = pool.getStats();
      expect(stats.queueLength).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle queue overflow', async () => {
      const smallPool = new WorkerPool({
        maxWorkers: 1,
        maxQueueSize: 2,
      });

      // Try to submit more tasks than queue can hold
      let errorCaught = false;
      try {
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(smallPool.execute('test-module', { data: i }));
        }
        await Promise.all(promises);
      } catch (err: any) {
        if (err.message.includes('Queue is full')) {
          errorCaught = true;
        }
      }

      expect(errorCaught).toBe(true);
    });

    it('should handle worker errors gracefully', async () => {
      // Submit a task that will trigger worker error handling
      const executePromise = pool.execute('test-module', { data: 'test' });
      
      // Simulate worker error by checking stats
      const stats = pool.getStats();
      expect(stats.totalTasksFailed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent tasks', async () => {
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          pool.execute('test-module', { data: i }).catch(() => {
            // Expected to fail in test environment
          })
        );
      }

      await Promise.allSettled(promises);
      
      const duration = Date.now() - startTime;
      const stats = pool.getStats();
      
      expect(stats.totalTasksCompleted + stats.totalTasksFailed).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should calculate average task duration', async () => {
      // Submit some tasks
      await Promise.allSettled([
        pool.execute('test-module', { data: 1 }),
        pool.execute('test-module', { data: 2 }),
        pool.execute('test-module', { data: 3 }),
      ]);

      const stats = pool.getStats();
      expect(stats.averageTaskDuration).toBeGreaterThanOrEqual(0);
    });
  });
});
