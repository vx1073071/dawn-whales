// ── QUANT MOO — Task Queue with Priority ──────────────────────────────────
import { EventEmitter } from 'events';

export type TaskPriority = 'high' | 'normal' | 'low';

export interface QueueTask<T = any> {
  id: string;
  priority: TaskPriority;
  module: string;
  data: unknown;
  resolve: (result: T) => void;
  reject: (err: Error) => void;
  createdAt: number;
}

export class PriorityTaskQueue extends EventEmitter {
  private queues: Record<TaskPriority, QueueTask[]> = {
    high: [],
    normal: [],
    low: [],
  };
  private totalEnqueued = 0;
  private totalDequeued = 0;

  enqueue(task: QueueTask): void {
    this.queues[task.priority].push(task);
    this.totalEnqueued++;
    this.emit('enqueue', task);
  }

  dequeue(): QueueTask | null {
    for (const prio of ['high', 'normal', 'low'] as TaskPriority[]) {
      if (this.queues[prio].length > 0) {
        const task = this.queues[prio].shift()!;
        this.totalDequeued++;
        this.emit('dequeue', task);
        return task;
      }
    }
    return null;
  }

  get size(): number {
    return this.queues.high.length + this.queues.normal.length + this.queues.low.length;
  }

  get stats() {
    return {
      enqueued: this.totalEnqueued,
      dequeued: this.totalDequeued,
      pending: this.size,
      byPriority: {
        high: this.queues.high.length,
        normal: this.queues.normal.length,
        low: this.queues.low.length,
      },
    };
  }

  clear(): void {
    for (const prio of ['high', 'normal', 'low'] as TaskPriority[]) {
      for (const task of this.queues[prio]) {
        task.reject(new Error('Queue cleared'));
      }
      this.queues[prio] = [];
    }
    this.emit('clear');
  }
}
