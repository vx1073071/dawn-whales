// T59: Dead Letter Queue for failed IPC messages
interface DeadLetter {
  id: string;
  topic: string;
  payload: any;
  error: string;
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  nextRetry: number;
}

export class DeadLetterQueue {
  private queue: DeadLetter[] = [];
  private maxRetries: number;
  private retryBackoff: number; // ms base

  constructor(maxRetries = 5, retryBackoffMs = 1000) {
    this.maxRetries = maxRetries;
    this.retryBackoff = retryBackoffMs;
  }

  push(topic: string, payload: any, error: string): string {
    const now = Date.now();
    const entry: DeadLetter = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      topic,
      payload,
      error,
      attempts: 0,
      firstAttempt: now,
      lastAttempt: now,
      nextRetry: now + this.retryBackoff,
    };
    this.queue.push(entry);
    return entry.id;
  }

  popReady(): DeadLetter | null {
    const idx = this.queue.findIndex(d => d.nextRetry <= Date.now());
    if (idx === -1) return null;
    return this.queue.splice(idx, 1)[0];
  }

  requeue(entry: DeadLetter): void {
    entry.attempts++;
    entry.lastAttempt = Date.now();
    entry.nextRetry = Date.now() + this.retryBackoff * Math.pow(2, entry.attempts);
    if (entry.attempts < this.maxRetries) {
      this.queue.push(entry);
    }
  }

  getPending(): DeadLetter[] {
    return [...this.queue];
  }

  getDead(): number {
    return this.queue.filter(d => d.attempts >= this.maxRetries).length;
  }

  clear(): void {
    this.queue = [];
  }

  size(): number {
    return this.queue.length;
  }

  purge(topic?: string): number {
    if (topic) {
      const before = this.queue.length;
      this.queue = this.queue.filter(d => d.topic !== topic);
      return before - this.queue.length;
    }
    const count = this.queue.length;
    this.clear();
    return count;
  }
}

export const dlq = new DeadLetterQueue();
