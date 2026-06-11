import { EngineError } from './engine/core/engine-error';
﻿// T60: Priority-Based Job Scheduler
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Job<T = unknown> {
  id: string;
  name: string;
  priority: number; // higher = more important
  status: JobStatus;
  payload: T;
  result?: unknown;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  maxRetries: number;
  retries: number;
  timeoutMs?: number;
}

type JobHandler = (job: Job) => Promise<any>;

export class JobScheduler {
  private heap: Job[] = [];
  private handlers = new Map<string, JobHandler>();
  private running = 0;
  private maxConcurrent: number;
  private tickInterval: NodeJS.Timeout | null = null;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  enqueue(name: string, payload: unknown, priority = 0, maxRetries = 1, timeoutMs?: number): Job {
    const job: Job = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      priority,
      status: 'pending',
      payload,
      createdAt: Date.now(),
      maxRetries,
      retries: 0,
      timeoutMs,
    };
    this._insert(job);
    queueMicrotask(() => this._tick());
    return job;
  }

  getQueue(): Job[] {
    return [...this.heap].sort((a, b) => b.priority - a.priority);
  }

  cancel(jobId: string): boolean {
    const idx = this.heap.findIndex(j => j.id === jobId && j.status === 'pending');
    if (idx === -1) return false;
    this.heap[idx].status = 'cancelled';
    this.heap.splice(idx, 1);
    return true;
  }

  start(autoTickMs = 100): void {
    this.tickInterval = setInterval(() => this._tick(), autoTickMs);
  }

  stop(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  stats(): { pending: number; running: number; completed: number; failed: number } {
    return {
      pending: this.heap.length,
      running: this.running,
      completed: 0, // tracked externally
      failed: 0,
    };
  }

  private _insert(job: Job): void {
    this.heap.push(job);
    this._bubbleUp(this.heap.length - 1);
  }

  private _pop(): Job | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent].priority >= this.heap[idx].priority) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  private _sinkDown(idx: number): void {
    const len = this.heap.length;
    while (true) {
      let largest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < len && this.heap[left].priority > this.heap[largest].priority) largest = left;
      if (right < len && this.heap[right].priority > this.heap[largest].priority) largest = right;
      if (largest === idx) break;
      [this.heap[idx], this.heap[largest]] = [this.heap[largest], this.heap[idx]];
      idx = largest;
    }
  }

  private async _tick(): Promise<void> {
    while (this.running < this.maxConcurrent && this.heap.length > 0) {
      const job = this._pop()!;
      const handler = this.handlers.get(job.name);
      if (!handler) {
        job.status = 'failed';
        job.error = `No handler for "${job.name}"`;
        continue;
      }
      this.running++;
      job.status = 'running';
      job.startedAt = Date.now();

      this._execute(job, handler).finally(() => {
        this.running--;
        this._tick();
      });
    }
  }

  private async _execute(job: Job, handler: JobHandler): Promise<void> {
    try {
      if (job.timeoutMs) {
        const timer = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Job timeout')), job.timeoutMs)
        );
        job.result = await Promise.race([handler(job), timer]);
      } else {
        job.result = await handler(job);
      }
      job.status = 'completed';
      job.completedAt = Date.now();
    } catch (e) {
      if (job.retries < job.maxRetries) {
        job.retries++;
        job.status = 'pending';
        this._insert(job); // re-queue
      } else {
        job.status = 'failed';
        job.error = e.message;
        job.completedAt = Date.now();
      }
    }
  }
}

export const jobScheduler = new JobScheduler(4);
