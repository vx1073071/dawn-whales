// ── DAWN WHALES — Worker Pool ─────────────────────────────────────────────
// CPU密集型任务 offload 到 worker_threads

import { Worker } from 'worker_threads';
import path from 'path';
import log from 'electron-log';

interface PoolWorker {
  worker: Worker;
  busy: boolean;
  id: number;
}

interface Task<T = any> {
  id: string;
  module: string;    // worker script path
  data: any;         // input data
  resolve: (result: T) => void;
  reject: (err: Error) => void;
}

export class WorkerPool {
  private workers: PoolWorker[] = [];
  private queue: Task[] = [];
  private maxWorkers: number;
  private nextId = 0;

  constructor(maxWorkers = Math.max(1, require('os').cpus().length - 1)) {
    this.maxWorkers = maxWorkers;
    log.info('[WorkerPool] Initialized with', maxWorkers, 'workers');
  }

  /** Submit a task to be executed in a worker thread */
  execute<T = any>(module: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: Task<T> = {
        id: `task-${++this.nextId}-${Date.now()}`,
        module,
        data,
        resolve,
        reject,
      };
      this.queue.push(task);
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.queue.length > 0) {
      const worker = this.getAvailableWorker();
      if (!worker) break;
      
      const task = this.queue.shift()!;
      this.runTask(worker, task);
    }
  }

  private getAvailableWorker(): PoolWorker | null {
    // Return idle worker or create new one
    const idle = this.workers.find(w => !w.busy);
    if (idle) return idle;
    
    if (this.workers.length < this.maxWorkers) {
      const id = this.workers.length;
      const workerPath = path.join(__dirname, 'worker-runner.js');
      const worker = new Worker(workerPath, {
        workerData: { id },
      });
      
      const pw: PoolWorker = { worker, busy: false, id };
      
      worker.on('error', (err) => {
        log.error(`[WorkerPool] Worker ${id} error:`, err.message);
        pw.busy = false;
      });
      
      worker.on('exit', (code) => {
        log.warn(`[WorkerPool] Worker ${id} exited with code ${code}`);
        this.workers = this.workers.filter(w => w.id !== id);
      });
      
      this.workers.push(pw);
      return pw;
    }
    
    return null;
  }

  private runTask(worker: PoolWorker, task: Task): void {
    worker.busy = true;
    
    const timeout = setTimeout(() => {
      worker.busy = false;
      task.reject(new Error(`Task ${task.id} timed out after 30s`));
      this.processQueue();
    }, 30000);
    
    worker.worker.once('message', (result) => {
      clearTimeout(timeout);
      worker.busy = false;
      
      if (result.error) {
        task.reject(new Error(result.error));
      } else {
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

  /** Gracefully terminate all workers */
  async terminate(): Promise<void> {
    log.info('[WorkerPool] Terminating all workers...');
    await Promise.all(
      this.workers.map(w => w.worker.terminate())
    );
    this.workers = [];
    this.queue = [];
    log.info('[WorkerPool] All workers terminated');
  }

  get stats() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      queueLength: this.queue.length,
    };
  }
}

// Singleton
let _pool: WorkerPool | null = null;
export function getWorkerPool(): WorkerPool {
  if (!_pool) _pool = new WorkerPool();
  return _pool;
}
