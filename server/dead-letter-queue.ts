
/**
 * QUANT MOO R139 J01 — Dead Letter Queue (DLQ) for Copy Trade
 * 
 * A Dead Letter Queue (DLQ) stores signals that failed after all retries.
 * When a signal exhausts maxRetries, instead of just marking it 'failed',
 * it is moved to the DLQ with rich failure metadata.
 * 
 * The DLQ pushes real-time events via WebSocket so the CopyTradeStatusBar
 * can show a "dead letter" badge count.
 * 
 * Features:
 *  - Per-user DLQ (Map<userId, DeadLetter[]>)
 *  - Max 200 entries per user (FIFO eviction)
 *  - WS push on new dead letter (event: copytrade:deadletter)
 *  - Ack/Replay/Dismiss operations
 *  - DeadLetterDashboard exposes stats for the status bar badge
 */

import { WSPushEnhancer } from './ws-push-enhancer';
import { QueuedSignal } from './signal-queue';

// ═══════════════ Types ══════════════════════════════════

export type DeadLetterReason =
  | 'max_retries_exceeded'
  | 'circuit_breaker_open'
  | 'no_api_key'
  | 'subscription_missing'
  | 'position_limit_exceeded'
  | 'adapter_error'
  | 'auth_error'
  | 'timeout'
  | 'rate_limited'
  | 'unknown';

export interface DeadLetter {
  id: string;
  userId: string;
  signalId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  brokerId: string;
  brokerName?: string;
  reason: DeadLetterReason;
  reasonDetail: string;
  retryCount: number;
  maxRetries: number;
  originalQuantity: number;
  originalPrice?: number;
  failedAt: number;
  /** Whether user has acknowledged this dead letter */
  acked: boolean;
  /** Can this be replayed? */
  replayable: boolean;
}

export interface DLQStats {
  total: number;
  unacked: number;
  byBroker: Record<string, number>;
  byReason: Record<DeadLetterReason, number>;
  lastFailedAt: number;
}

export interface DLQEntryResult {
  letter: DeadLetter;
  wasEnqueued: boolean;
  /** True if the oldest entry was evicted to make room */
  oldestEvicted: boolean;
}

// ═══════════════ Dead Letter Queue ══════════════════════

export class DeadLetterQueue {
  private dlq: Map<string, DeadLetter[]> = new Map(); // userId → letters
  private maxPerUser: number;
  private pushEnhancer?: WSPushEnhancer;

  constructor(maxPerUser = 200, pushEnhancer?: WSPushEnhancer) {
    this.maxPerUser = maxPerUser;
    this.pushEnhancer = pushEnhancer;
  }

  /** Attach WS pusher so new DL entries get pushed in real time */
  setPushEnhancer(enhancer: WSPushEnhancer): void {
    this.pushEnhancer = enhancer;
  }

  /**
   * Enqueue a dead letter from a failed signal.
   * 
   * Called by the CopyTradeExecutor when a signal exhausts all retries.
   * Also callable directly if a signal fails before entering the executor
   * (e.g. circuit breaker open, no API key, subscription missing).
   */
  enqueue(
    signal: Pick<QueuedSignal, 'signalId'|'userId'|'targetBrokerId'|'payload'|'metadata'>,
    reason: DeadLetterReason,
    reasonDetail: string,
    brokerName?: string,
  ): DLQEntryResult {
    const userQueue = this.getUserQueue(signal.userId);

    // Evict oldest if full
    let oldestEvicted = false;
    if (userQueue.length >= this.maxPerUser) {
      userQueue.shift(); // Remove oldest
      oldestEvicted = true;
    }

    const letter: DeadLetter = {
      id: `${signal.signalId}-dl-${Date.now().toString(36)}`,
      userId: signal.userId,
      signalId: signal.signalId,
      symbol: signal.payload.symbol,
      side: signal.payload.side,
      brokerId: signal.targetBrokerId,
      brokerName,
      reason,
      reasonDetail,
      retryCount: signal.metadata.retryCount,
      maxRetries: signal.metadata.maxRetries,
      originalQuantity: signal.payload.quantity,
      originalPrice: signal.payload.price,
      failedAt: Date.now(),
      acked: false,
      replayable: this.isReplayable(reason),
    };

    userQueue.push(letter);

    // Push real-time event via WS
    if (this.pushEnhancer) {
      this.pushEnhancer.pushCopyTradeDeadLetter(signal.userId, letter);
    }

    return { letter, wasEnqueued: true, oldestEvicted };
  }

  /**
   * Acknowledge (dismiss) a dead letter.
   */
  ack(userId: string, letterId: string): boolean {
    const userQueue = this.getUserQueue(userId);
    const letter = userQueue.find((l) => l.id === letterId);
    if (!letter) return false;
    letter.acked = true;
    return true;
  }

  /**
   * Dismiss (remove) a dead letter from the queue.
   */
  dismiss(userId: string, letterId: string): boolean {
    const userQueue = this.getUserQueue(userId);
    const idx = userQueue.findIndex((l) => l.id === letterId);
    if (idx === -1) return false;
    userQueue.splice(idx, 1);
    return true;
  }

  /**
   * Dismiss all dead letters for a user.
   */
  dismissAll(userId: string): number {
    const prev = this.getUserQueue(userId).length;
    this.dlq.set(userId, []);
    return prev;
  }

  /**
   * Get all dead letters for a user (most recent first).
   */
  getForUser(userId: string, options?: {
    unackedOnly?: boolean;
    limit?: number;
    brokerId?: string;
    reason?: DeadLetterReason;
  }): DeadLetter[] {
    let results = [...this.getUserQueue(userId)].reverse();

    if (options?.unackedOnly) {
      results = results.filter((l) => !l.acked);
    }
    if (options?.brokerId) {
      results = results.filter((l) => l.brokerId === options.brokerId);
    }
    if (options?.reason) {
      results = results.filter((l) => l.reason === options.reason);
    }
    if (options?.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get stats for the status bar badge.
   */
  getStats(userId: string): DLQStats {
    const letters = this.getUserQueue(userId);
    const stats: DLQStats = {
      total: letters.length,
      unacked: 0,
      byBroker: {},
      byReason: {} as Record<DeadLetterReason, number>,
      lastFailedAt: 0,
    };

    for (const l of letters) {
      if (!l.acked) stats.unacked++;
      stats.byBroker[l.brokerId] = (stats.byBroker[l.brokerId] || 0) + 1;
      stats.byReason[l.reason] = (stats.byReason[l.reason] || 0) + 1;
      if (l.failedAt > stats.lastFailedAt) stats.lastFailedAt = l.failedAt;
    }

    return stats;
  }

  /**
   * Get unacked count for badge number.
   */
  getBadgeCount(userId: string): number {
    return this.getStats(userId).unacked;
  }

  /**
   * Mark a dead letter as replayable by re-enqueuing it as a fresh signal.
   * The caller (CopyTradeExecutor) should call signalQueue.enqueue() with
   * the reconstructed signal.
   */
  markReplay(userId: string, letterId: string): DeadLetter | null {
    const userQueue = this.getUserQueue(userId);
    const letter = userQueue.find((l) => l.id === letterId);
    if (!letter || !letter.replayable) return null;
    // Remove from DLQ (it's being replayed)
    const idx = userQueue.findIndex((l) => l.id === letterId);
    userQueue.splice(idx, 1);
    return letter;
  }

  /**
   * Cleanup old entries (older than maxAgeMs, default 7 days).
   */
  cleanup(maxAgeMs = 7 * 24 * 3600 * 1000): number {
    const now = Date.now();
    let removed = 0;
    for (const [, userQueue] of this.dlq) {
      for (let i = userQueue.length - 1; i >= 0; i--) {
        if (now - userQueue[i].failedAt > maxAgeMs) {
          userQueue.splice(i, 1);
          removed++;
        }
      }
    }
    return removed;
  }

  /**
   * Get all user IDs that have dead letters.
   */
  getUserIds(): string[] {
    const ids: string[] = [];
    for (const [userId, queue] of this.dlq) {
      if (queue.length > 0) ids.push(userId);
    }
    return ids;
  }

  dispose(): void {
    this.dlq.clear();
    this.pushEnhancer = undefined;
  }

  // ═══════════════ Private ═══════════════════════════════

  private getUserQueue(userId: string): DeadLetter[] {
    if (!this.dlq.has(userId)) {
      this.dlq.set(userId, []);
    }
    return this.dlq.get(userId)!;
  }

  private isReplayable(reason: DeadLetterReason): boolean {
    // Non-replayable: subscription missing, auth expired, breaker needs reset
    const nonReplayable: DeadLetterReason[] = [
      'subscription_missing',
      'auth_error',
    ];
    return !nonReplayable.includes(reason);
  }
}

// ═══════════════ Singleton ═══════════════════════════════

let _dlq: DeadLetterQueue | null = null;

export function getDeadLetterQueue(pushEnhancer?: WSPushEnhancer): DeadLetterQueue {
  if (!_dlq) {
    _dlq = new DeadLetterQueue(200, pushEnhancer);
  } else if (pushEnhancer && !_dlq['pushEnhancer']) {
    _dlq.setPushEnhancer(pushEnhancer);
  }
  return _dlq;
}
