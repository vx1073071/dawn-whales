// ── WorkerPool Benchmark & Advanced Monitoring ──────────────────────────────
// Extends existing worker-pool.ts with benchmark + health metrics

import { WorkerPool, getWorkerPool } from './worker-pool';
import log from 'electron-log';

export interface PoolBenchmark {
  name: string;
  taskCount: number;
  totalDuration: number;
  avgDuration: number;
  throughput: number;
  workerUtilization: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  failures: number;
}

export class WorkerPoolBenchmark {
  async runBatch(pool: WorkerPool, taskData: any[], taskFn: (data: unknown) => any): Promise<PoolBenchmark> {
    const latencies: number[] = [];
    const start = Date.now();
    let failures = 0;

    const results = await Promise.allSettled(
      taskData.map(async (data, i) => {
        const t0 = Date.now();
        try {
          await pool.execute('bench-task', data);
          latencies.push(Date.now() - t0);
        } catch {
          failures++;
          latencies.push(Date.now() - t0);
        }
      })
    );

    const totalDuration = Date.now() - start;
    const sorted = [...latencies].sort((a, b) => a - b);

    return {
      name: 'pool-bench',
      taskCount: taskData.length,
      totalDuration,
      avgDuration: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      throughput: taskData.length / (totalDuration / 1000),
      workerUtilization: pool.stats.busyWorkers / Math.max(pool.stats.totalWorkers, 1),
      minLatency: Math.min(...latencies),
      maxLatency: Math.max(...latencies),
      p50Latency: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95Latency: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99Latency: sorted[Math.floor(sorted.length * 0.99)] || 0,
      failures,
    };
  }

  async stressTest(pool: WorkerPool, concurrent: number, tasksPerWorker: number): Promise<{
    completed: number;
    failed: number;
    timeout: number;
    duration: number;
    peakConcurrency: number;
  }> {
    let completed = 0;
    let failed = 0;
    let timeout = 0;
    let peakConcurrency = 0;
    let active = 0;
    const start = Date.now();

    const tasks = Array.from({ length: concurrent * tasksPerWorker }, (_, i) => {
      active++;
      peakConcurrency = Math.max(peakConcurrency, active);

      return pool.execute('stress-task', { id: i }).then(
        () => { completed++; active--; },
        (err: unknown) => {
          if (err?.message?.includes('timeout')) timeout++;
          else failed++;
          active--;
        }
      );
    });

    await Promise.allSettled(tasks);

    return {
      completed,
      failed,
      timeout,
      duration: Date.now() - start,
      peakConcurrency,
    };
  }
}

// ── Health Check Integration ───────────────────────────────────────────────

export class PoolHealthMonitor {
  private pool: WorkerPool;
  private checkInterval: NodeJS.Timeout | null = null;
  private metrics: {
    totalTasks: number;
    totalFailures: number;
    totalRestarts: number;
    avgQueueTime: number;
    peakQueueSize: number;
  } = {
    totalTasks: 0,
    totalFailures: 0,
    totalRestarts: 0,
    avgQueueTime: 0,
    peakQueueSize: 0,
  };

  constructor(pool: WorkerPool) {
    this.pool = pool;
  }

  start(intervalMs = 5000): void {
    this.checkInterval = setInterval(() => {
      const stats = this.pool.stats;

      // Log health
      if (stats.busyWorkers / Math.max(stats.totalWorkers, 1) > 0.9) {
        log.warn('[PoolHealth] High utilization:', stats);
      }

      if (stats.queueLength > 100) {
        log.warn('[PoolHealth] Large queue:', stats.queueLength);

      // Auto-scale suggestion
      if (stats.queueLength > 50 && stats.totalWorkers < 8) {
        log.info('[PoolHealth] Suggest scaling workers to', Math.min(stats.totalWorkers + 2, 8));
      }
    }
    }, intervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  healthReport(): {
    status: 'healthy' | 'degraded' | 'critical';
    utilization: number;
    queueDepth: number;
    failureRate: number;
    recommendations: string[];
  } {
    const stats = this.pool.stats;
    const utilization = stats.busyWorkers / Math.max(stats.totalWorkers, 1);
    const failureRate = this.metrics.totalTasks > 0
      ? this.metrics.totalFailures / this.metrics.totalTasks
      : 0;

    const recommendations: string[] = [];

    if (utilization > 0.8) recommendations.push('Scale up workers');
    if (failureRate > 0.05) recommendations.push('Investigate worker failures');
    if (stats.queueLength > 100) recommendations.push('Add queue capacity');

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (utilization > 0.95 || failureRate > 0.1) status = 'critical';
    else if (utilization > 0.8 || failureRate > 0.05) status = 'degraded';

    return { status, utilization, queueDepth: stats.queueLength, failureRate, recommendations };
  }
}

// ── Priority Task Scheduler Inside Pool ────────────────────────────────────

export interface PriorityTask {
  id: string;
  priority: number; // 0=low, 1=normal, 2=high, 3=critical
  data: unknown;
}

export class PriorityPoolScheduler {
  private pool: WorkerPool;
  private priorityQueue: PriorityTask[] = [];

  constructor(pool: WorkerPool) {
    this.pool = pool;
  }

  enqueue(task: PriorityTask): void {
    this.priorityQueue.push(task);
    this.priorityQueue.sort((a, b) => b.priority - a.priority);
  }

  async executeNext(): Promise<any> {
    if (this.priorityQueue.length === 0) return null;
    const task = this.priorityQueue.shift()!;
    return this.pool.execute('priority-task', task.data);
  }

  async drain(): Promise<{ completed: number; failed: number }> {
    let completed = 0;
    let failed = 0;

    while (this.priorityQueue.length > 0) {
      try {
        await this.executeNext();
        completed++;
      } catch {
        failed++;
      }
    }

    return { completed, failed };
  }

  queueSize(): number {
    return this.priorityQueue.length;
  }
}
