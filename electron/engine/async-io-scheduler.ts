/**
 * JVS-89: Async IO Scheduler
 *
 * Manages concurrent data fetch operations with priority queuing,
 * token-bucket throttling, group-based concurrency, backpressure,
 * timeout handling, retry with exponential backoff, and throughput tracking.
 */

import log from 'electron-log';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export type Priority = 'critical' | 'high' | 'normal' | 'low';

export interface IOTask {
  id: string;
  label: string;
  priority: Priority;
  fn: () => Promise<any>;
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  groupId?: string;
  createdAt: string;
}

export interface IOTaskResult {
  taskId: string;
  status: 'success' | 'failed' | 'timeout' | 'cancelled';
  result?: any;
  error?: string;
  durationMs: number;
  retries: number;
  queuedAt: string;
  startedAt: string;
  completedAt: string;
}

export interface SchedulerConfig {
  maxConcurrency: number;
  maxQueueSize: number;
  defaultTimeoutMs: number;
  defaultPriority: Priority;
  throttlePerSecond: number;
  groupConcurrency: number;
}

export interface SchedulerStats {
  running: number;
  queued: number;
  completed: number;
  failed: number;
  cancelled: number;
  avgWaitMs: number;
  avgDurationMs: number;
  throughputPerMinute: number;
  queueUtilization: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrency: 8,
  maxQueueSize: 200,
  defaultTimeoutMs: 30_000,
  defaultPriority: 'normal',
  throttlePerSecond: 50,
  groupConcurrency: 3,
};

const THROUGHPUT_WINDOW_MS = 60_000; // 1 minute rolling window

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `iotask_${Date.now()}_${idCounter}`;
}

function now(): string {
  return new Date().toISOString();
}

function nowMs(): number {
  return Date.now();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// ---------------------------------------------------------------------------
// PriorityQueue
// ---------------------------------------------------------------------------

class PriorityQueue<T extends { priority: Priority }> {
  private buckets: Map<Priority, T[]> = new Map([
    ['critical', []],
    ['high', []],
    ['normal', []],
    ['low', []],
  ]);

  private _size = 0;

  get size(): number {
    return this._size;
  }

  enqueue(item: T): void {
    const bucket = this.buckets.get(item.priority)!;
    bucket.push(item);
    this._size += 1;
  }

  dequeue(): T | undefined {
    for (const p of ['critical', 'high', 'normal', 'low'] as Priority[]) {
      const bucket = this.buckets.get(p)!;
      if (bucket.length > 0) {
        this._size -= 1;
        return bucket.shift()!;
      }
    }
    return undefined;
  }

  remove(predicate: (item: T) => boolean): T[] {
    const removed: T[] = [];
    for (const [, bucket] of this.buckets) {
      for (let i = bucket.length - 1; i >= 0; i--) {
        if (predicate(bucket[i])) {
          removed.push(bucket.splice(i, 1)[0]);
        }
      }
    }
    this._size -= removed.length;
    return removed;
  }

  toArray(): T[] {
    const result: T[] = [];
    for (const p of ['critical', 'high', 'normal', 'low'] as Priority[]) {
      result.push(...this.buckets.get(p)!);
    }
    return result;
  }

  clear(): T[] {
    const all = this.toArray();
    for (const [, bucket] of this.buckets) {
      bucket.length = 0;
    }
    this._size = 0;
    return all;
  }
}

// ---------------------------------------------------------------------------
// TokenBucket Throttle
// ---------------------------------------------------------------------------

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRatePerSecond: number,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = nowMs();
  }

  updateRate(rate: number): void {
    this.refill();
    this.refillRatePerSecond = rate;
    this.maxTokens = Math.max(rate, 1);
    if (this.tokens > this.maxTokens) {
      this.tokens = this.maxTokens;
    }
  }

  private refill(): void {
    const t = nowMs();
    const elapsed = (t - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerSecond);
    this.lastRefill = t;
  }

  tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Throughput Tracker (rolling window)
// ---------------------------------------------------------------------------

interface CompletionRecord {
  timestamp: number;
  durationMs: number;
  waitMs: number;
  success: boolean;
}

class ThroughputTracker {
  private records: CompletionRecord[] = [];
  private readonly windowMs: number;

  constructor(windowMs: number = THROUGHPUT_WINDOW_MS) {
    this.windowMs = windowMs;
  }

  record(rec: CompletionRecord): void {
    this.records.push(rec);
    this.prune();
  }

  private prune(): void {
    const cutoff = nowMs() - this.windowMs;
    while (this.records.length > 0 && this.records[0].timestamp < cutoff) {
      this.records.shift();
    }
  }

  getThroughputPerMinute(): number {
    this.prune();
    return this.records.length;
  }

  getAvgDurationMs(): number {
    this.prune();
    if (this.records.length === 0) return 0;
    const sum = this.records.reduce((a, r) => a + r.durationMs, 0);
    return sum / this.records.length;
  }

  getAvgWaitMs(): number {
    this.prune();
    if (this.records.length === 0) return 0;
    const sum = this.records.reduce((a, r) => a + r.waitMs, 0);
    return sum / this.records.length;
  }

  getCompletedCount(): number {
    this.prune();
    return this.records.filter((r) => r.success).length;
  }

  getFailedCount(): number {
    this.prune();
    return this.records.filter((r) => !r.success).length;
  }

  reset(): void {
    this.records = [];
  }
}

// ---------------------------------------------------------------------------
// Internal task wrapper
// ---------------------------------------------------------------------------

interface InternalTask {
  task: IOTask;
  abortController: AbortController;
  resolve: (result: IOTaskResult) => void;
  startedAt?: string;
  retriesUsed: number;
}

// ---------------------------------------------------------------------------
// AsyncIOScheduler
// ---------------------------------------------------------------------------

export class AsyncIOScheduler {
  private config: SchedulerConfig;
  private queue: PriorityQueue<IOTask> = new PriorityQueue();
  private running: Map<string, InternalTask> = new Map();
  private results: Map<string, IOTaskResult> = new Map();
  private waiters: Map<string, Array<(r: IOTaskResult) => void>> = new Map();
  private groupRunning: Map<string, number> = new Map();
  private throttle: TokenBucket;
  private tracker: ThroughputTracker = new ThroughputTracker();
  private paused = false;
  private disposed = false;
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private drainResolvers: Array<() => void> = [];

  // Cumulative counters (beyond rolling window)
  private totalCompleted = 0;
  private totalFailed = 0;
  private totalCancelled = 0;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.throttle = new TokenBucket(
      Math.max(this.config.throttlePerSecond, 1),
      this.config.throttlePerSecond,
    );
    log.info('[AsyncIOScheduler] Initialized', { config: this.config });
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Submit a single task. Returns the generated task id.
   * Throws if queue is full (backpressure) or scheduler is disposed.
   */
  submit(taskInput: Omit<IOTask, 'id' | 'createdAt'>): string {
    if (this.disposed) {
      throw new Error('AsyncIOScheduler is disposed');
    }
    if (this.queue.size >= this.config.maxQueueSize) {
      log.warn('[AsyncIOScheduler] Queue full, rejecting task', {
        label: taskInput.label,
        queueSize: this.queue.size,
        maxQueueSize: this.config.maxQueueSize,
      });
      throw new Error(
        `Scheduler queue full (${this.queue.size}/${this.config.maxQueueSize}). Backpressure applied.`,
      );
    }

    const id = generateId();
    const task: IOTask = {
      ...taskInput,
      id,
      createdAt: now(),
    };

    this.queue.enqueue(task);

    log.debug('[AsyncIOScheduler] Task queued', {
      id,
      label: task.label,
      priority: task.priority,
      groupId: task.groupId,
      queueSize: this.queue.size,
    });

    this.scheduleNext();
    return id;
  }

  /**
   * Submit a batch of tasks. Returns array of task ids.
   */
  submitBatch(tasks: Omit<IOTask, 'id' | 'createdAt'>[]): string[] {
    const ids: string[] = [];
    for (const t of tasks) {
      ids.push(this.submit(t));
    }
    log.info('[AsyncIOScheduler] Batch submitted', { count: ids.length });
    return ids;
  }

  /**
   * Cancel a queued or running task.
   */
  cancel(taskId: string): boolean {
    // Check running tasks first
    const running = this.running.get(taskId);
    if (running) {
      running.abortController.abort();
      log.info('[AsyncIOScheduler] Running task cancelled', { taskId });
      return true;
    }

    // Check queued tasks
    const removed = this.queue.remove((t) => t.id === taskId);
    if (removed.length > 0) {
      const result: IOTaskResult = {
        taskId,
        status: 'cancelled',
        durationMs: 0,
        retries: 0,
        queuedAt: removed[0].createdAt,
        startedAt: '',
        completedAt: now(),
      };
      this.results.set(taskId, result);
      this.totalCancelled += 1;
      this.resolveWaiters(taskId, result);
      log.info('[AsyncIOScheduler] Queued task cancelled', { taskId });
      return true;
    }

    return false;
  }

  /**
   * Cancel all tasks in a group. Returns number of tasks cancelled.
   */
  cancelGroup(groupId: string): number {
    let count = 0;

    // Cancel running tasks in this group
    for (const [taskId, internal] of this.running) {
      if (internal.task.groupId === groupId) {
        internal.abortController.abort();
        count += 1;
      }
    }

    // Cancel queued tasks in this group
    const removed = this.queue.remove((t) => t.groupId === groupId);
    for (const task of removed) {
      const result: IOTaskResult = {
        taskId: task.id,
        status: 'cancelled',
        durationMs: 0,
        retries: 0,
        queuedAt: task.createdAt,
        startedAt: '',
        completedAt: now(),
      };
      this.results.set(task.id, result);
      this.totalCancelled += 1;
      this.resolveWaiters(task.id, result);
      count += 1;
    }

    log.info('[AsyncIOScheduler] Group cancelled', { groupId, count });
    return count;
  }

  /**
   * Get the result of a completed task, or null if not yet done.
   */
  getResult(taskId: string): IOTaskResult | null {
    return this.results.get(taskId) ?? null;
  }

  /**
   * Returns a promise that resolves when the task completes.
   */
  waitFor(taskId: string): Promise<IOTaskResult> {
    const existing = this.results.get(taskId);
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise<IOTaskResult>((resolve) => {
      const list = this.waiters.get(taskId) ?? [];
      list.push(resolve);
      this.waiters.set(taskId, list);
    });
  }

  /**
   * Wait for multiple tasks to complete.
   */
  async waitForAll(taskIds: string[]): Promise<IOTaskResult[]> {
    return Promise.all(taskIds.map((id) => this.waitFor(id)));
  }

  /**
   * Get current scheduler statistics.
   */
  getStats(): SchedulerStats {
    return {
      running: this.running.size,
      queued: this.queue.size,
      completed: this.totalCompleted,
      failed: this.totalFailed,
      cancelled: this.totalCancelled,
      avgWaitMs: Math.round(this.tracker.getAvgWaitMs()),
      avgDurationMs: Math.round(this.tracker.getAvgDurationMs()),
      throughputPerMinute: this.tracker.getThroughputPerMinute(),
      queueUtilization: this.config.maxQueueSize > 0
        ? Math.min(1, this.queue.size / this.config.maxQueueSize)
        : 0,
    };
  }

  /**
   * Get a copy of the current config.
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Update scheduler config at runtime.
   */
  updateConfig(updates: Partial<SchedulerConfig>): void {
    const prev = { ...this.config };
    this.config = { ...this.config, ...updates };

    if (updates.throttlePerSecond !== undefined) {
      this.throttle.updateRate(updates.throttlePerSecond);
    }

    log.info('[AsyncIOScheduler] Config updated', { prev, next: this.config });

    // If concurrency increased, try scheduling more tasks
    if (
      updates.maxConcurrency !== undefined &&
      updates.maxConcurrency > prev.maxConcurrency
    ) {
      this.scheduleNext();
    }
  }

  /**
   * Pause scheduling. Running tasks continue, but no new tasks are dequeued.
   */
  pause(): void {
    this.paused = true;
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    log.info('[AsyncIOScheduler] Paused');
  }

  /**
   * Resume scheduling after pause.
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    log.info('[AsyncIOScheduler] Resumed');
    this.scheduleNext();
  }

  /**
   * Wait for all queued and running tasks to complete.
   */
  async drain(): Promise<void> {
    if (this.queue.size === 0 && this.running.size === 0) {
      return;
    }
    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  /**
   * Dispose the scheduler. Cancels all pending tasks and cleans up.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.paused = true;

    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    // Cancel all queued tasks
    const queued = this.queue.clear();
    for (const task of queued) {
      const result: IOTaskResult = {
        taskId: task.id,
        status: 'cancelled',
        durationMs: 0,
        retries: 0,
        queuedAt: task.createdAt,
        startedAt: '',
        completedAt: now(),
      };
      this.results.set(task.id, result);
      this.totalCancelled += 1;
      this.resolveWaiters(task.id, result);
    }

    // Abort all running tasks
    for (const [, internal] of this.running) {
      internal.abortController.abort();
    }

    // Resolve drain waiters
    for (const resolve of this.drainResolvers) {
      resolve();
    }
    this.drainResolvers = [];

    this.tracker.reset();
    log.info('[AsyncIOScheduler] Disposed');
  }

  // -----------------------------------------------------------------------
  // Internal: scheduling loop
  // -----------------------------------------------------------------------

  private scheduleNext(): void {
    if (this.paused || this.disposed) return;
    if (this.scheduleTimer) return; // already scheduled

    // Use setImmediate-style microtask to batch scheduling
    this.scheduleTimer = setTimeout(() => {
      this.scheduleTimer = null;
      this.pump();
    }, 0);
  }

  private pump(): void {
    if (this.paused || this.disposed) return;

    while (this.canStartTask()) {
      const task = this.pickNextTask();
      if (!task) break;
      this.startTask(task);
    }

    // If we couldn't start due to throttle, retry after a short delay
    if (this.queue.size > 0 && this.running.size < this.config.maxConcurrency) {
      this.scheduleNext();
    }

    this.checkDrain();
  }

  private canStartTask(): boolean {
    if (this.running.size >= this.config.maxConcurrency) return false;
    if (this.queue.size === 0) return false;
    return this.throttle.tryConsume();
  }

  private pickNextTask(): IOTask | undefined {
    // We need to respect group concurrency. Peek through the priority queue
    // to find the highest-priority task whose group isn't at its limit.
    const all = this.queue.toArray();

    for (const task of all) {
      if (task.groupId) {
        const groupCount = this.groupRunning.get(task.groupId) ?? 0;
        if (groupCount >= this.config.groupConcurrency) {
          continue; // group is at its limit, skip this task
        }
      }
      // This task is eligible — remove it from the queue specifically
      const removed = this.queue.remove((t) => t.id === task.id);
      if (removed.length > 0) {
        return removed[0];
      }
    }

    // No eligible task found (all groups saturated or queue empty)
    return undefined;
  }

  private startTask(task: IOTask): void {
    const abortController = new AbortController();

    const internal: InternalTask = {
      task,
      abortController,
      resolve: () => {}, // will be set below
      startedAt: now(),
      retriesUsed: 0,
    };

    const waitPromise = new Promise<IOTaskResult>((resolve) => {
      internal.resolve = resolve;
    });

    this.running.set(task.id, internal);

    if (task.groupId) {
      this.groupRunning.set(
        task.groupId,
        (this.groupRunning.get(task.groupId) ?? 0) + 1,
      );
    }

    log.debug('[AsyncIOScheduler] Task started', {
      id: task.id,
      label: task.label,
      priority: task.priority,
      groupId: task.groupId,
      running: this.running.size,
    });

    // Execute with retry logic
    this.executeWithRetry(internal).finally(() => {
      this.onTaskDone(task.id);
    });

    // Fire-and-forget; result is stored via internal.resolve
    waitPromise.then(() => {});
  }

  private async executeWithRetry(internal: InternalTask): Promise<void> {
    const { task } = internal;
    const queuedAt = task.createdAt;
    const maxRetries = task.retryCount;
    let lastError = '';
    let startedAt = '';
    let retriesUsed = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (internal.abortController.signal.aborted) {
        const result: IOTaskResult = {
          taskId: task.id,
          status: 'cancelled',
          error: 'Cancelled by user',
          durationMs: 0,
          retries: retriesUsed,
          queuedAt,
          startedAt: startedAt || now(),
          completedAt: now(),
        };
        this.storeResult(result, internal);
        return;
      }

      startedAt = now();
      const startMs = nowMs();

      try {
        const result = await this.executeWithTimeout(
          task,
          internal.abortController.signal,
        );

        const durationMs = nowMs() - startMs;
        const taskResult: IOTaskResult = {
          taskId: task.id,
          status: 'success',
          result,
          durationMs,
          retries: retriesUsed,
          queuedAt,
          startedAt,
          completedAt: now(),
        };
        this.storeResult(taskResult, internal);
        log.debug('[AsyncIOScheduler] Task succeeded', {
          id: task.id,
          label: task.label,
          durationMs,
          retries: retriesUsed,
        });
        return;
      } catch (err: any) {
        lastError = err?.message ?? String(err);
        const isTimeout = err?.name === 'TimeoutError' || lastError.includes('timeout');
        const isAbort = err?.name === 'AbortError' || lastError.includes('Aborted');

        if (isAbort) {
          const taskResult: IOTaskResult = {
            taskId: task.id,
            status: 'cancelled',
            error: 'Cancelled by user',
            durationMs: nowMs() - startMs,
            retries: retriesUsed,
            queuedAt,
            startedAt,
            completedAt: now(),
          };
          this.storeResult(taskResult, internal);
          return;
        }

        const durationMs = nowMs() - startMs;

        if (attempt < maxRetries) {
          retriesUsed += 1;
          const delay = task.retryDelayMs * Math.pow(2, attempt);
          log.warn('[AsyncIOScheduler] Task retry', {
            id: task.id,
            label: task.label,
            attempt: attempt + 1,
            maxRetries,
            delay,
            error: lastError,
          });
          try {
            await sleep(delay, internal.abortController.signal);
          } catch {
            // aborted during retry sleep
            const taskResult: IOTaskResult = {
              taskId: task.id,
              status: 'cancelled',
              error: 'Cancelled during retry backoff',
              durationMs: nowMs() - startMs,
              retries: retriesUsed,
              queuedAt,
              startedAt,
              completedAt: now(),
            };
            this.storeResult(taskResult, internal);
            return;
          }
        } else {
          // Final attempt failed
          const status: IOTaskResult['status'] = isTimeout ? 'timeout' : 'failed';
          const taskResult: IOTaskResult = {
            taskId: task.id,
            status,
            error: lastError,
            durationMs,
            retries: retriesUsed,
            queuedAt,
            startedAt,
            completedAt: now(),
          };
          this.storeResult(taskResult, internal);
          log.error('[AsyncIOScheduler] Task failed', {
            id: task.id,
            label: task.label,
            status,
            error: lastError,
            durationMs,
            retries: retriesUsed,
          });
        }
      }
    }
  }

  private async executeWithTimeout(
    task: IOTask,
    signal: AbortSignal,
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const err = new Error(`Task "${task.label}" timed out after ${task.timeoutMs}ms`);
        err.name = 'TimeoutError';
        reject(err);
      }, task.timeoutMs);

      const onAbort = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });

      // Run the task function
      Promise.resolve()
        .then(() => task.fn())
        .then((result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          resolve(result);
        })
        .catch((err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          reject(err);
        });
    });
  }

  private storeResult(result: IOTaskResult, internal: InternalTask): void {
    this.results.set(result.taskId, result);

    // Track throughput
    const waitMs = result.startedAt
      ? new Date(result.startedAt).getTime() - new Date(internal.task.createdAt).getTime()
      : 0;
    this.tracker.record({
      timestamp: nowMs(),
      durationMs: result.durationMs,
      waitMs: Math.max(0, waitMs),
      success: result.status === 'success',
    });

    if (result.status === 'success') {
      this.totalCompleted += 1;
    } else if (result.status === 'failed' || result.status === 'timeout') {
      this.totalFailed += 1;
    } else if (result.status === 'cancelled') {
      this.totalCancelled += 1;
    }

    // Resolve the internal promise
    internal.resolve(result);

    // Resolve external waiters
    this.resolveWaiters(result.taskId, result);
  }

  private onTaskDone(taskId: string): void {
    const internal = this.running.get(taskId);
    if (!internal) return;

    this.running.delete(taskId);

    if (internal.task.groupId) {
      const count = (this.groupRunning.get(internal.task.groupId) ?? 1) - 1;
      if (count <= 0) {
        this.groupRunning.delete(internal.task.groupId);
      } else {
        this.groupRunning.set(internal.task.groupId, count);
      }
    }

    // Try to start more tasks
    this.scheduleNext();
  }

  private resolveWaiters(taskId: string, result: IOTaskResult): void {
    const list = this.waiters.get(taskId);
    if (list) {
      this.waiters.delete(taskId);
      for (const resolve of list) {
        resolve(result);
      }
    }
  }

  private checkDrain(): void {
    if (this.queue.size === 0 && this.running.size === 0 && this.drainResolvers.length > 0) {
      const resolvers = this.drainResolvers;
      this.drainResolvers = [];
      for (const r of resolvers) {
        r();
      }
      log.info('[AsyncIOScheduler] Drained');
    }
  }
}

// ---------------------------------------------------------------------------
// Default export convenience
// ---------------------------------------------------------------------------

export default AsyncIOScheduler;
