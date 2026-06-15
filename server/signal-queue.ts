/**
 * DAWN WHALES R131 J04 — Signal Queue Engine
 * 
 * Priority-based signal queue for cloud + OpenD dual-mode copy trading.
 * 
 * Architecture:
 *   Signal Source (Trader/AI) → SignalQueue → Priority Router → Executor
 *                                    ↓
 *                              cloud broker (Binance/OKX/...)
 *                              OpenD broker (Futu/moomoo)
 * 
 * Features:
 *  - Priority levels: P0 (urgent/stop-loss), P1 (normal), P2 (batched)
 *  - De-duplication by signalId
 *  - FIFO within same priority
 *  - Timeout-based stale removal
 *  - Per-user queue isolation
 */

export type SignalPriority = 'P0' | 'P1' | 'P2';

export type SignalTarget = 'cloud' | 'opend';

export interface QueuedSignal {
  signalId: string;
  userId: string;
  sourceBrokerId: string;
  targetBrokerId: string;
  targetType: SignalTarget;
  priority: SignalPriority;
  payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    quantity: number;
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage?: number;
    /** Fraction of source position size to copy (0.01–1.0) */
    copyRatio?: number;
    /** Source signal provider ID for subscription check (R137 J03) */
    providerId?: string;
  };
  metadata: {
    timestamp: number;
    ttlMs: number;         // Time-to-live (0 = no expiry)
    retryCount: number;
    maxRetries: number;
    sourceTradeId?: string;
    notes?: string;
  };
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'expired';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  errorMessage?: string;
}

interface SignalQueueConfig {
  /** Max queue size per user */
  maxQueueSize: number;
  /** Default TTL for P1 signals (ms) */
  defaultP1TtlMs: number;
  /** Default TTL for P2 signals (ms) */
  defaultP2TtlMs: number;
  /** Max retries before marking as failed */
  maxRetries: number;
  /** Cleanup interval for stale/expired signals (ms) */
  cleanupIntervalMs: number;
}

interface SignalQueueStats {
  totalQueued: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  totalExpired: number;
  perPriority: Record<SignalPriority, number>;
  perTarget: Record<SignalTarget, number>;
  oldestSignalAge: number;
}

// ═══════════════ Signal Queue ═══════════════════════════

export class SignalQueue {
  private queues: Map<string, QueuedSignal[]> = new Map(); // userId → signals
  private processing: Map<string, QueuedSignal> = new Map(); // signalId → signal (dedup)
  private config: SignalQueueConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<SignalQueueConfig>) {
    this.config = {
      maxQueueSize: 1000,
      defaultP1TtlMs: 5 * 60 * 1000,   // 5 min
      defaultP2TtlMs: 30 * 60 * 1000,  // 30 min
      maxRetries: 3,
      cleanupIntervalMs: 60 * 1000,    // 1 min
      ...config,
    };
    this.startCleanup();
  }

  // ═══════════════ Enqueue ═══════════════════════════════

  enqueue(signal: Omit<QueuedSignal, 'status' | 'createdAt' | 'updatedAt' | 'metadata.retryCount'> & { metadata: Omit<QueuedSignal['metadata'], 'retryCount'> }): { ok: boolean; signalId: string; error?: string } {
    // Dedup
    if (this.processing.has(signal.signalId)) {
      return { ok: false, signalId: signal.signalId, error: 'Signal already in queue' };
    }

    // Queue size check
    const userQueue = this.getUserQueue(signal.userId);
    if (userQueue.length >= this.config.maxQueueSize) {
      return { ok: false, signalId: signal.signalId, error: 'Queue full' };
    }

    const now = Date.now();
    const fullSignal: QueuedSignal = {
      ...signal,
      status: 'queued' as const,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...signal.metadata,
        retryCount: 0,
        maxRetries: signal.metadata.maxRetries || this.config.maxRetries,
        ttlMs: signal.metadata.ttlMs || 0,
      },
    };

    userQueue.push(fullSignal);
    this.sortByPriority(userQueue);
    this.processing.set(signal.signalId, fullSignal);

    return { ok: true, signalId: signal.signalId };
  }

  /** Batch enqueue (for copy-trade: 1 source → N targets) */
  enqueueBatch(
    signals: Array<Omit<QueuedSignal, 'status' | 'createdAt' | 'updatedAt'>>,
  ): { enqueued: number; rejected: number; errors: string[] } {
    let enqueued = 0;
    let rejected = 0;
    const errors: string[] = [];

    for (const signal of signals) {
      const result = this.enqueue(signal as any);
      if (result.ok) {
        enqueued++;
      } else {
        rejected++;
        errors.push(`${signal.signalId}: ${result.error}`);
      }
    }

    return { enqueued, rejected, errors };
  }

  // ═══════════════ Dequeue ═══════════════════════════════

  /** Get next signal for a user, highest priority first */
  dequeue(userId: string): QueuedSignal | null {
    const userQueue = this.getUserQueue(userId);

    // Skip expired/stale
    const now = Date.now();
    let idx = userQueue.findIndex((s) => {
      if (s.status !== 'queued') return false;
      if (s.metadata.ttlMs > 0 && (now - s.createdAt) > s.metadata.ttlMs) {
        s.status = 'expired';
        s.updatedAt = now;
        return false;
      }
      return true;
    });

    if (idx === -1) return null;

    const signal = userQueue.splice(idx, 1)[0];
    signal.status = 'processing';
    signal.updatedAt = now;
    return signal;
  }

  /** Dequeue all queued signals for a user, ordered by priority */
  dequeueAll(userId: string): QueuedSignal[] {
    const results: QueuedSignal[] = [];
    let signal = this.dequeue(userId);
    while (signal) {
      results.push(signal);
      signal = this.dequeue(userId);
    }
    return results;
  }

  // ═══════════════ Lifecycle ═══════════════════════════════

  /** Acknowledge signal completion */
  ack(signalId: string, success: boolean, errorMessage?: string): void {
    const signal = this.processing.get(signalId);
    if (!signal) return;

    if (success) {
      signal.status = 'completed';
      signal.completedAt = Date.now();
    } else {
      const retries = signal.metadata.retryCount + 1;
      if (retries > signal.metadata.maxRetries) {
        signal.status = 'failed';
        signal.completedAt = Date.now();
      } else {
        // Re-queue for retry with incremented count
        signal.status = 'queued';
        signal.metadata.retryCount = retries;
        const userQueue = this.getUserQueue(signal.userId);
        userQueue.push(signal);
        this.sortByPriority(userQueue);
      }
    }
    signal.errorMessage = errorMessage;
    signal.updatedAt = Date.now();

    if (signal.status === 'completed' || signal.status === 'failed') {
      this.processing.delete(signalId);
    }
  }

  // ═══════════════ Query ═══════════════════════════════

  getStats(userId?: string): SignalQueueStats {
    const stats: SignalQueueStats = {
      totalQueued: 0, totalProcessing: 0, totalCompleted: 0, totalFailed: 0, totalExpired: 0,
      perPriority: { P0: 0, P1: 0, P2: 0 },
      perTarget: { cloud: 0, opend: 0 },
      oldestSignalAge: 0,
    };

    const now = Date.now();
    const allSignals = userId
      ? this.getUserQueue(userId)
      : Array.from(this.queues.values()).flat();

    for (const s of allSignals) {
      switch (s.status) {
        case 'queued': stats.totalQueued++; break;
        case 'processing': stats.totalProcessing++; break;
        case 'completed': stats.totalCompleted++; break;
        case 'failed': stats.totalFailed++; break;
        case 'expired': stats.totalExpired++; break;
      }
      stats.perPriority[s.priority]++;
      stats.perTarget[s.targetType]++;
      const age = now - s.createdAt;
      if (age > stats.oldestSignalAge) stats.oldestSignalAge = age;
    }

    // Also count processing signals
    for (const s of this.processing.values()) {
      if (!allSignals.includes(s)) {
        stats.totalProcessing++;
        stats.perPriority[s.priority]++;
        stats.perTarget[s.targetType]++;
      }
    }

    return stats;
  }

  /** Get queue snapshot for monitoring */
  getSnapshot(userId: string): { queued: QueuedSignal[]; processing: QueuedSignal[] } {
    const userQueue = this.getUserQueue(userId);
    return {
      queued: userQueue.filter((s) => s.status === 'queued'),
      processing: userQueue.filter((s) => s.status === 'processing'),
    };
  }

  // ═══════════════ Cleanup ═══════════════════════════════

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [, userQueue] of this.queues) {
        for (let i = userQueue.length - 1; i >= 0; i--) {
          const s = userQueue[i];
          // Remove completed/failed after 1h
          if ((s.status === 'completed' || s.status === 'failed') && s.completedAt && (now - s.completedAt > 3600000)) {
            userQueue.splice(i, 1);
            this.processing.delete(s.signalId);
          }
          // Expire stale queued
          if (s.status === 'queued' && s.metadata.ttlMs > 0 && (now - s.createdAt > s.metadata.ttlMs)) {
            s.status = 'expired';
            s.updatedAt = now;
            this.processing.delete(s.signalId);
            userQueue.splice(i, 1);
          }
          // R137 J04: Reset stuck processing signals (OpenD offline for > TTL*2)
          if (s.status === 'processing' && s.metadata.ttlMs > 0 && (now - s.updatedAt) > (s.metadata.ttlMs * 2)) {
            const retryCount = s.metadata.retryCount + 1;
            if (retryCount <= s.metadata.maxRetries) {
              // Reset to queued so executor picks it up again
              s.status = 'queued';
              s.metadata.retryCount = retryCount;
              s.updatedAt = now;
              s.errorMessage = `Processing timeout reset (attempt ${retryCount}/${s.metadata.maxRetries})`;
            } else {
              // Max retries exceeded → mark failed
              s.status = 'failed';
              s.completedAt = now;
              s.updatedAt = now;
              s.errorMessage = 'Processing timeout after max retries';
              this.processing.delete(s.signalId);
            }
          }
        }
      }
    }, this.config.cleanupIntervalMs);
  }

  /** Shutdown cleanup timer */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.queues.clear();
    this.processing.clear();
  }

  // ═══════════════ Private ═══════════════════════════════

  private getUserQueue(userId: string): QueuedSignal[] {
    if (!this.queues.has(userId)) {
      this.queues.set(userId, []);
    }
    return this.queues.get(userId)!;
  }

  /** Sort by priority: P0 first, P1, then P2 */
  private sortByPriority(queue: QueuedSignal[]): void {
    const weight = (p: SignalPriority) => p === 'P0' ? 0 : p === 'P1' ? 1 : 2;
    queue.sort((a, b) => weight(a.priority) - weight(b.priority));
  }
}

// ═══════════════ Singleton ═══════════════════════════════

let _queue: SignalQueue | null = null;

export function getSignalQueue(): SignalQueue {
  if (!_queue) {
    _queue = new SignalQueue();
  }
  return _queue;
}
