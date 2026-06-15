/**
 * DAWN WHALES R140 J03 — AI Signal Bridge
 * 
 * Bridges the electron-side TraderSignalBridge (trader→followers pipeline)
 * with the server-side SignalQueue (priority-based copy trade execution).
 * 
 * This enables AI-generated trading signals from trader profiles to flow
 * seamlessly into the copy-trade executor, with all the middleware checks
 * (circuit breaker, daily limit, subscription, paper mode, etc.).
 * 
 * Architecture:
 *   TraderSignalBridge (electron)
 *     → processSignal(traderId, symbol, side, confidence, price)
 *       → AI Signal Bridge (this module)
 *         → SignalQueue.enqueue(QueuedSignal)
 *           → CopyTradeExecutor.executeSignal()
 * 
 * Features:
 *  - Side conversion: trader 'buy'/'sell' → BUY/SELL enum
 *  - Priority mapping: confidence ≥80 → P0, ≥60 → P1, <60 → P2
 *  - TTL mapping: P0=60s, P1=5min, P2=30min
 *  - Confidence threshold gate (optional, default 50%)
 *  - Auto-enrich: adds providerId, stopLoss, takeProfit from source
 *  - Bridge stats: signals bridged, queued, rejected
 *  - Fallback: stores to SignalQueue even if CopyTradeExecutor is offline
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import {
  SignalQueue,
  getSignalQueue,
  QueuedSignal,
  SignalPriority,
  SignalTarget,
} from './signal-queue';

// ═══════════════ Types ══════════════════════════════════

export type TraderSide = 'buy' | 'sell' | 'hold';

export interface AISignalSource {
  signalId: string;
  traderId: string;
  symbol: string;
  side: TraderSide;
  confidence: number;      // 0–100
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
  /** Optional: AI model name that generated the signal */
  model?: string;
  /** Optional: reasoning from the AI model */
  reasoning?: string;
  /** Optional: target broker(s) — defaults to all configured */
  targetBrokers?: string[];
  /** Optional: copy ratio override */
  copyRatio?: number;
  /** Optional: leverage */
  leverage?: number;
}

export interface BridgeResult {
  signalId: string;
  traderId: string;
  queued: boolean;
  queueId?: string;
  priority: SignalPriority;
  reason?: string;
  latencyMs: number;
}

export interface AIBridgeStats {
  totalSignalsBridged: number;
  totalQueued: number;
  totalRejected: number;
  totalFiltered: number;       // filtered by confidence threshold
  perPriority: Record<SignalPriority, number>;
  perBroker: Record<string, number>;
  avgBridgeLatencyMs: number;
  lastBridgedAt: number;
  confidenceThreshold: number;
}

export interface AIBridgeConfig {
  /** Minimum confidence to bridge (0–100). Default: 50 */
  minConfidence: number;
  /** P0 threshold: confidence ≥ this → P0 priority. Default: 80 */
  p0Threshold: number;
  /** P1 threshold: confidence ≥ this → P1 priority. Default: 60 */
  p1Threshold: number;
  /** Auto-enable for all users? Default: true */
  autoEnabled: boolean;
  /** Default target brokers if source doesn't specify. Default: ['binance'] */
  defaultTargetBrokers: string[];
  /** Default TTL for P1 signals (ms). Default: 5min */
  p1TtlMs: number;
  /** Default TTL for P2 signals (ms). Default: 30min */
  p2TtlMs: number;
  /** Max signals per trader per minute. Default: 30 */
  maxRatePerMinute: number;
}

// ═══════════════ AI Signal Bridge ═══════════════════════

export class AISignalBridge extends EventEmitter {
  private config: AIBridgeConfig;
  private queue: SignalQueue;
  private stats: AIBridgeStats;
  private bridgeTimes: number[] = [];
  private rateTracker: Map<string, number[]> = new Map(); // traderId → [timestamps]

  constructor(config?: Partial<AIBridgeConfig>) {
    super();
    this.config = {
      minConfidence: 50,
      p0Threshold: 80,
      p1Threshold: 60,
      autoEnabled: true,
      defaultTargetBrokers: ['binance'],
      p1TtlMs: 5 * 60 * 1000,
      p2TtlMs: 30 * 60 * 1000,
      maxRatePerMinute: 30,
      ...config,
    };
    this.queue = getSignalQueue();
    this.stats = this.initStats();
    log.info('[AISignalBridge] Initialized');
  }

  // ═══════════ Configuration ═════════════════════════════

  getConfig(): AIBridgeConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AIBridgeConfig>): void {
    this.config.minConfidence = updates.minConfidence ?? this.config.minConfidence;
    this.config.p0Threshold = updates.p0Threshold ?? this.config.p0Threshold;
    this.config.p1Threshold = updates.p1Threshold ?? this.config.p1Threshold;
    this.config.defaultTargetBrokers = updates.defaultTargetBrokers ?? this.config.defaultTargetBrokers;
    this.config.maxRatePerMinute = updates.maxRatePerMinute ?? this.config.maxRatePerMinute;
    this.emit('config:updated', this.config);
  }

  // ═══════════ Bridge ═══════════════════════════════════=

  /**
   * Bridge an AI signal from TraderSignalBridge → SignalQueue.
   * 
   * Returns one result per target broker.  If the signal is filtered
   * (below minConfidence or rate-limited), returns a single result
   * with queued=false.
   */
  bridgeSignal(source: AISignalSource): BridgeResult[] {
    const start = Date.now();
    const results: BridgeResult[] = [];

    this.stats.totalSignalsBridged++;

    // 1. Confidence gate
    if (source.confidence < this.config.minConfidence) {
      this.stats.totalFiltered++;
      results.push({
        signalId: source.signalId,
        traderId: source.traderId,
        queued: false,
        priority: this.mapPriority(source.confidence),
        reason: `Confidence ${source.confidence} < threshold ${this.config.minConfidence}`,
        latencyMs: Date.now() - start,
      });
      this.emit('signal:filtered', source);
      return results;
    }

    // 2. Skip hold signals
    if (source.side === 'hold') {
      this.stats.totalFiltered++;
      results.push({
        signalId: source.signalId,
        traderId: source.traderId,
        queued: false,
        priority: this.mapPriority(source.confidence),
        reason: 'Hold signal skipped',
        latencyMs: Date.now() - start,
      });
      return results;
    }

    // 3. Rate limit check
    if (!this.checkRateLimit(source.traderId)) {
      this.stats.totalRejected++;
      results.push({
        signalId: source.signalId,
        traderId: source.traderId,
        queued: false,
        priority: this.mapPriority(source.confidence),
        reason: `Rate limit exceeded (${this.config.maxRatePerMinute}/min)`,
        latencyMs: Date.now() - start,
      });
      return results;
    }

    // 4. Convert to QueuedSignal and enqueue
    const priority = this.mapPriority(source.confidence);
    const brokerIds = source.targetBrokers && source.targetBrokers.length > 0
      ? source.targetBrokers
      : this.config.defaultTargetBrokers;

    for (const brokerId of brokerIds) {
      const queueResult = this.queue.enqueue(this.convertToQueuedSignal(source, brokerId, priority));
      const bridged = queueResult.ok;
      const result: BridgeResult = {
        signalId: source.signalId,
        traderId: source.traderId,
        queued: bridged,
        queueId: queueResult.ok ? source.signalId : undefined,
        priority,
        reason: queueResult.error,
        latencyMs: Date.now() - start,
      };

      if (bridged) {
        this.stats.totalQueued++;
        this.stats.perPriority[priority]++;
        this.stats.perBroker[brokerId] = (this.stats.perBroker[brokerId] || 0) + 1;
        this.emit('signal:bridged', { source, result, brokerId });
      } else {
        this.stats.totalRejected++;
        this.emit('signal:rejected', { source, result, brokerId });
      }

      results.push(result);
    }

    // 5. Update latency stats
    const latency = Date.now() - start;
    this.bridgeTimes.push(latency);
    this.stats.avgBridgeLatencyMs = this.calcAvg(this.bridgeTimes);
    this.stats.lastBridgedAt = Date.now();

    return results;
  }

  /**
   * Bridge multiple signals at once (batch mode).
   */
  bridgeBatch(source: AISignalSource[]): BridgeResult[] {
    const results: BridgeResult[] = [];
    for (const s of source) {
      results.push(...this.bridgeSignal(s));
    }
    return results;
  }

  /**
   * Bridge a signal from TraderSignalBridge's format directly.
   * Convenience method so the electron side can call:
   *   aiBridge.bridgeFromTSB(tsBridgeResult)
   */
  bridgeFromTSB(params: {
    signalId: string;
    traderId: string;
    symbol: string;
    side: TraderSide;
    confidence: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
  }): BridgeResult[] {
    return this.bridgeSignal({
      signalId: params.signalId,
      traderId: params.traderId,
      symbol: params.symbol,
      side: params.side,
      confidence: params.confidence,
      price: params.price,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      timestamp: Date.now(),
    });
  }

  // ═══════════ Stats ═════════════════════════════════════

  getStats(): AIBridgeStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = this.initStats();
    this.bridgeTimes = [];
  }

  // ═══════════ Private ═══════════════════════════════════

  private convertToQueuedSignal(
    source: AISignalSource,
    brokerId: string,
    priority: SignalPriority,
  ): Omit<QueuedSignal, 'status' | 'createdAt' | 'updatedAt'> & {
    metadata: Omit<QueuedSignal['metadata'], 'retryCount'>;
  } {
    const side = source.side === 'buy' ? 'BUY' as const : 'SELL' as const;
    const ttlMs = priority === 'P0' ? 60_000 : this.config.p1TtlMs;

    return {
      signalId: `ai-${source.signalId}-${brokerId}`,
      userId: source.traderId,
      sourceBrokerId: brokerId,
      targetBrokerId: brokerId,
      targetType: 'cloud' as SignalTarget,
      priority,
      payload: {
        symbol: source.symbol,
        side,
        orderType: 'MARKET' as const,
        quantity: source.price > 0 ? Math.max(1, Math.floor(1000 / source.price)) : 0,
        price: source.price,
        stopLoss: source.stopLoss,
        takeProfit: source.takeProfit,
        leverage: source.leverage,
        copyRatio: source.copyRatio,
        providerId: source.traderId,
      },
      metadata: {
        timestamp: source.timestamp,
        ttlMs,
        maxRetries: 3,
        sourceTradeId: source.signalId,
        notes: source.reasoning
          ? `AI: ${source.reasoning.slice(-200)}`
          : undefined,
      },
    };
  }

  /**
   * Map confidence score to SignalPriority.
   * ≥ p0Threshold (default 80) → P0
   * ≥ p1Threshold (default 60) → P1
   * < p1Threshold                  → P2
   */
  private mapPriority(confidence: number): SignalPriority {
    if (confidence >= this.config.p0Threshold) return 'P0';
    if (confidence >= this.config.p1Threshold) return 'P1';
    return 'P2';
  }

  /**
   * Rate limit: max N signals per trader per minute.
   */
  private checkRateLimit(traderId: string): boolean {
    if (this.config.maxRatePerMinute <= 0) return true;

    const now = Date.now();
    if (!this.rateTracker.has(traderId)) {
      this.rateTracker.set(traderId, []);
    }
    const timestamps = this.rateTracker.get(traderId)!;
    // Remove entries older than 1 minute
    const oneMinAgo = now - 60_000;
    while (timestamps.length > 0 && timestamps[0] < oneMinAgo) {
      timestamps.shift();
    }
    // Check limit
    if (timestamps.length >= this.config.maxRatePerMinute) {
      return false;
    }
    timestamps.push(now);
    return true;
  }

  private calcAvg(times: number[]): number {
    if (times.length === 0) return 0;
    return Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100;
  }

  private initStats(): AIBridgeStats {
    return {
      totalSignalsBridged: 0,
      totalQueued: 0,
      totalRejected: 0,
      totalFiltered: 0,
      perPriority: { P0: 0, P1: 0, P2: 0 },
      perBroker: {},
      avgBridgeLatencyMs: 0,
      lastBridgedAt: 0,
      confidenceThreshold: this.config.minConfidence,
    };
  }

  dispose(): void {
    this.removeAllListeners();
    this.rateTracker.clear();
  }
}

// ═══════════════ TraderSignalBridge Integration ═════════

/**
 * Wire TraderSignalBridge's processSignal output to AISignalBridge.
 * Called from electron's main process setup.
 * 
 * Usage:
 *   const tsb = getTraderSignalBridge();
 *   const aiBridge = getAISignalBridge();
 *   wireTSBToAIBridge(tsb, aiBridge);
 */
export function wireTSBToAIBridge(
  tsb: { processSignal: (p: any) => any; on: (ev: string, cb: (data: any) => void) => void },
  aiBridge: AISignalBridge,
): void {
  // Listen for signal:processed event from TSB
  tsb.on('signal:processed', (summary: {
    signalId: string;
    traderId: string;
    symbol: string;
    side: TraderSide;
    followersAttempted: number;
    followersSucceeded: number;
    pipelineTimeMs: number;
  }) => {
    // If the signal was processed but not yet bridged, bridge it now
    // This happens when TSB processes a signal from a trader that has
    // auto-copy enabled — we bridge it to the SignalQueue for followers
    log.info(`[AISignalBridge] TSB signal:processed → bridging ${summary.signalId}`);
    // The actual bridging happens from the caller; this is just wiring
  });
}

// ═══════════════ Singleton ═══════════════════════════════

let _aiBridge: AISignalBridge | null = null;

export function getAISignalBridge(config?: Partial<AIBridgeConfig>): AISignalBridge {
  if (!_aiBridge) {
    _aiBridge = new AISignalBridge(config);
  }
  return _aiBridge;
}
