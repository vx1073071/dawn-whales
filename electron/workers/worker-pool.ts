// ── DAWN WHALES — Worker Pool (Production Ready) ──────────────────────────
// CPU密集型任务 offload 到 worker_threads
// JVS-51: Production-ready worker pool with monitoring and recovery

import { Worker } from 'worker_threads';
import path from 'path';
import log from 'electron-log';
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PoolConfig {
  maxWorkers?: number;
  taskTimeout?: number;
  workerRestartThreshold?: number;
  healthCheckInterval?: number;
  autoRestart?: boolean;
  priorityLevels?: number;
  maxQueueSize?: number;
  workerIdleTimeout?: number;
}

interface PoolWorker {
  id: number;
  worker: Worker;
  busy: boolean;
  tasksCompleted: number;
  tasksFailed: number;
  lastActivity: number;
  errorCount: number;
  createdAt: number;
  health: 'healthy' | 'degraded' | 'dead';
}

interface Task<T = any> {
  id: string;
  module: string;
  data: any;
  priority: number;
  submittedAt: number;
  resolve: (result: T) => void;
  reject: (err: Error) => void;
  timeout?: number;
}

interface TaskMetrics {
  taskId: string;
  workerId: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  busyWorkers: number;
  idleWorkers: number;
  queueLength: number;
  maxQueueSize: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  averageTaskDuration: number;
  uptime: number;
  workerHealth: Record<string, 'healthy' | 'degraded' | 'dead'>;
}

// ── Worker Pool Implementation ─────────────────────────────────────────────

export class WorkerPool extends EventEmitter {
  private workers: Map<number, PoolWorker> = new Map();
  private queue: Task[] = [];
  private config: Required<PoolConfig>;
  private nextWorkerId = 0;
  private nextTaskId = 0;
  private startedAt = Date.now();
  private taskMetrics: TaskMetrics[] = [];
  private healthCheckTimer?: NodeJS.Timeout;
  private workerPath: string;

  constructor(config: PoolConfig = {}) {
    super();
    
    this.config = {
      maxWorkers: config.maxWorkers ?? Math.max(1, require('os').cpus().length - 1),
      taskTimeout: config.taskTimeout ?? 30000,
      workerRestartThreshold: config.workerRestartThreshold ?? 3,
      healthCheckInterval: config.healthCheckInterval ?? 60000,
      autoRestart: config.autoRestart ?? true,
      priorityLevels: config.priorityLevels ?? 3,
      maxQueueSize: config.maxQueueSize ?? 1000,
      workerIdleTimeout: config.workerIdleTimeout ?? 300000,
    };

    this.workerPath = path.join(__dirname, 'worker-runner.js');
    log.info('[WorkerPool] Initialized with', this.config.maxWorkers, 'workers');
    
    // Start health check
    this.startHealthCheck();
  }

  /** Check if we're in trading hours */
  private isTradingHours(): boolean {
    const now = new Date();
    const hours = now.getHours();
    const day = now.getDay();
    
    // Weekend
    if (day === 0 || day === 6) return false;
    
    // Trading hours: 9:15 - 15:00
    return hours >= 9 && hours < 15;
  }

  /** Submit a task to be executed in a worker thread */
  async execute<T = any>(
    module: string,
    data: any,
    priority: number = 1,
    timeout?: number
  ): Promise<T> {
    // Check queue size
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error(`Queue is full (${this.config.maxQueueSize} tasks)`);
    }

    return new Promise((resolve, reject) => {
      const task: Task<T> = {
        id: `task-${++this.nextTaskId}-${Date.now()}`,
        module,
        data,
        priority: Math.min(priority, this.config.priorityLevels),
        submittedAt: Date.now(),
        resolve,
        reject,
        timeout: timeout ?? this.config.taskTimeout,
      };

      // Insert by priority (lower number = higher priority)
      const insertIndex = this.queue.findIndex(t => t.priority > task.priority);
      if (insertIndex === -1) {
        this.queue.push(task);
      } else {
        this.queue.splice(insertIndex, 0, task);
      }

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const worker = await this.getAvailableWorker();
      if (!worker) break;

      const task = this.queue.shift()!;
      await this.runTask(worker, task);
    }
  }

  private async getAvailableWorker(): Promise<PoolWorker | null> {
    // Find idle healthy worker
    for (const [id, worker] of this.workers) {
      if (!worker.busy && worker.health === 'healthy') {
        return worker;
      }
    }

    // Create new worker if under limit
    if (this.workers.size < this.config.maxWorkers) {
      return await this.createWorker();
    }

    return null;
  }

  private async createWorker(): Promise<PoolWorker> {
    const id = this.nextWorkerId++;
    
    const worker = new Worker(this.workerPath, {
      workerData: { id },
    });

    const poolWorker: PoolWorker = {
      id,
      worker,
      busy: false,
      tasksCompleted: 0,
      tasksFailed: 0,
      lastActivity: Date.now(),
      errorCount: 0,
      createdAt: Date.now(),
      health: 'healthy',
    };

    // Handle worker errors
    worker.on('error', (err) => {
      log.error(`[WorkerPool] Worker ${id} error:`, err.message);
      poolWorker.errorCount++;
      
      if (poolWorker.errorCount >= this.config.workerRestartThreshold) {
        poolWorker.health = 'degraded';
        log.warn(`[WorkerPool] Worker ${id} marked as degraded`);
      }
    });

    // Handle worker exit
    worker.on('exit', (code) => {
      log.warn(`[WorkerPool] Worker ${id} exited with code ${code}`);
      poolWorker.health = 'dead';
      this.workers.delete(id);

      // Auto-restart if enabled
      if (this.config.autoRestart && this.workers.size < this.config.maxWorkers) {
        setTimeout(() => {
          if (this.workers.size < this.config.maxWorkers) {
            this.createWorker().catch(err => {
              log.error('[WorkerPool] Failed to restart worker:', err);
            });
          }
        }, 1000);
      }
    });

    this.workers.set(id, poolWorker);
    log.info(`[WorkerPool] Created worker ${id}`);
    
    return poolWorker;
  }

  private async runTask(worker: PoolWorker, task: Task): Promise<void> {
    worker.busy = true;
    worker.lastActivity = Date.now();

    const metrics: TaskMetrics = {
      taskId: task.id,
      workerId: worker.id,
      startTime: Date.now(),
      success: false,
    };

    const timeout = setTimeout(() => {
      worker.busy = false;
      worker.tasksFailed++;
      metrics.error = `Task ${task.id} timed out after ${task.timeout}ms`;
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      this.taskMetrics.push(metrics);
      
      task.reject(new Error(metrics.error));
      this.processQueue();
    }, task.timeout);

    worker.worker.once('message', (result) => {
      clearTimeout(timeout);
      worker.busy = false;
      worker.lastActivity = Date.now();
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;

      if (result.error) {
        worker.tasksFailed++;
        metrics.success = false;
        metrics.error = result.error;
        this.taskMetrics.push(metrics);
        task.reject(new Error(result.error));
      } else {
        worker.tasksCompleted++;
        metrics.success = true;
        this.taskMetrics.push(metrics);
        task.resolve(result.data);
      }

      this.processQueue();
    });

    worker.worker.postMessage({
      taskId: task.id,
      module: task.module,
      data: task.data,
    });
  }

  /** Get worker statistics */
  getStats(): WorkerPoolStats {
    const workers = Array.from(this.workers.values());
    const busyWorkers = workers.filter(w => w.busy).length;
    const idleWorkers = workers.length - busyWorkers;
    
    // Calculate average task duration
    const completedTasks = this.taskMetrics.filter(m => m.duration);
    const avgDuration = completedTasks.length > 0
      ? completedTasks.reduce((sum, m) => sum + (m.duration || 0), 0) / completedTasks.length
      : 0;

    const totalCompleted = workers.reduce((sum, w) => sum + w.tasksCompleted, 0);
    const totalFailed = workers.reduce((sum, w) => sum + w.tasksFailed, 0);

    const workerHealth: Record<string, 'healthy' | 'degraded' | 'dead'> = {};
    workers.forEach(w => {
      workerHealth[w.id.toString()] = w.health;
    });

    return {
      totalWorkers: workers.length,
      busyWorkers,
      idleWorkers,
      queueLength: this.queue.length,
      maxQueueSize: this.config.maxQueueSize,
      totalTasksCompleted: totalCompleted,
      totalTasksFailed: totalFailed,
      averageTaskDuration: avgDuration,
      uptime: Date.now() - this.startedAt,
      workerHealth,
    };
  }

  /** Start health check timer */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.checkWorkerHealth();
    }, this.config.healthCheckInterval);
  }

  /** Check and restart unhealthy workers */
  private checkWorkerHealth(): void {
    const now = Date.now();

    for (const [id, worker] of this.workers) {
      // Check for dead workers
      if (worker.health === 'dead') {
        this.workers.delete(id);
        continue;
      }

      // Check for degraded workers
      if (worker.health === 'degraded' && this.config.autoRestart) {
        log.warn(`[WorkerPool] Restarting degraded worker ${id}`);
        worker.worker.terminate();
        this.workers.delete(id);
        
        // Create replacement
        this.createWorker().catch(err => {
          log.error('[WorkerPool] Failed to restart degraded worker:', err);
        });
      }

      // Check for idle workers (optional cleanup)
      if (!worker.busy && now - worker.lastActivity > this.config.workerIdleTimeout) {
        const idleCount = Array.from(this.workers.values()).filter(w => !w.busy).length;
        if (idleCount > Math.ceil(this.config.maxWorkers / 2)) {
          log.info(`[WorkerPool] Terminating idle worker ${id}`);
          worker.worker.terminate();
          this.workers.delete(id);
        }
      }
    }
  }

  /** Gracefully terminate all workers */
  async terminate(): Promise<void> {
    log.info('[WorkerPool] Terminating all workers...');
    
    // Clear health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Terminate all workers
    await Promise.all(
      Array.from(this.workers.values()).map(w => w.worker.terminate())
    );

    this.workers.clear();
    this.queue = [];
    
    log.info('[WorkerPool] All workers terminated');
  }

  /** Get current stats (backward compatibility) */
  get stats() {
    return {
      totalWorkers: this.workers.size,
      busyWorkers: Array.from(this.workers.values()).filter(w => w.busy).length,
      queueLength: this.queue.length,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _pool: WorkerPool | null = null;

export function getWorkerPool(config?: PoolConfig): WorkerPool {
  if (!_pool) {
    _pool = new WorkerPool(config);
  }
  return _pool;
}

export function resetWorkerPool(): void {
  if (_pool) {
    _pool.terminate().catch(err => {
      log.error('[WorkerPool] Failed to terminate pool:', err);
    });
    _pool = null;
  }
}
