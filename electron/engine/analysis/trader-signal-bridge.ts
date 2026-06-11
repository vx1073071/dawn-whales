/**
 * J-54-01: Trader Signal Bridge (R54 P0)
 * →→
 *
 * Connects: TraderProfileEngine ↔ SignalPushEngine ↔ CopyTradeExecutor
 *
 * Features:
 * - Auto-update trader metrics when signals are published/pushed
 * - Auto-trigger copy trades for followers when signals push
 * - Signal-to-trade conversion tracking
 * - Unified bridge stats (signals published → trades executed → PnL)
 * - Bridge event pipeline with error isolation
 *
 * ≥300L, 20+ tests
 */

import log from 'electron-log';
import { EventEmitter } from 'events';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export type SignalSide = 'buy' | 'sell' | 'hold';
export type BridgeStatus = 'active' | 'paused' | 'error';
export type PipelineStage = 'signal_received' | 'profile_updated' | 'followers_notified' | 'copy_executed' | 'completed' | 'failed';

export interface BridgeConfig {
  autoCopyEnabled: boolean;
  maxFollowersPerSignal: number;
  minConfidenceForCopy: number;
  maxSlippagePct: number;
  defaultPositionSize: number;
  positionSizeMode: 'fixed' | 'proportional';
}

export interface BridgePipelineEvent {
  id: string;
  signalId: string;
  traderId: string;
  stage: PipelineStage;
  timestamp: string;
  details: Record<string, unknown>;
  error?: string;
}

export interface BridgeStats {
  totalSignalsProcessed: number;
  totalProfilesUpdated: number;
  totalFollowersNotified: number;
  totalCopyTradesExecuted: number;
  totalCopyTradesFailed: number;
  avgPipelineTimeMs: number;
  status: BridgeStatus;
}

export interface FollowerCopyConfig {
  followerId: string;
  traderId: string;
  enabled: boolean;
  positionSize: number;
  positionSizeMode: 'fixed' | 'proportional';
  maxSlippagePct: number;
  accountEquity: number;
}

export interface CopyTradeResult {
  followerId: string;
  orderId: string | null;
  success: boolean;
  reason?: string;
}

export interface SignalTradeSummary {
  signalId: string;
  traderId: string;
  symbol: string;
  side: SignalSide;
  followersAttempted: number;
  followersSucceeded: number;
  followersFailed: number;
  totalVolume: number;
  pipelineTimeMs: number;
}

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BridgeConfig = {
  autoCopyEnabled: true,
  maxFollowersPerSignal: 100,
  minConfidenceForCopy: 60,
  maxSlippagePct: 2,
  defaultPositionSize: 1000,
  positionSizeMode: 'proportional',
};

// ── Bridge Engine ──────────────────────────────────────────────────────────

export class TraderSignalBridge extends EventEmitter {
  private config: BridgeConfig;
  private status: BridgeStatus = 'active';
  private pipelineLog: BridgePipelineEvent[] = [];
  private followerConfigs: Map<string, FollowerCopyConfig[]> = new Map(); // traderId → followers
  private signalSummaries: Map<string, SignalTradeSummary> = new Map();
  private pipelineTimes: number[] = [];
  private eventCounter = 1;

  // Mock interfaces for external engines (in production, these are real engine instances)
  private traderMetrics: Map<string, { signalsPublished: number; copyTradesTriggered: number; followerCount: number }> = new Map();
  private signalStore: Map<string, { traderId: string; symbol: string; side: SignalSide; confidence: number; price: number }> = new Map();
  private orderStore: Map<string, { followerId: string; signalId: string; symbol: string; side: SignalSide; quantity: number; price: number; status: string }> = new Map();
  private orderCounter = 1;

  constructor(config?: Partial<BridgeConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[TraderSignalBridge] Initialized');
  }

  // ── Configuration ──────────────────────────────────────────────────────

  getConfig(): BridgeConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<BridgeConfig>): void {
    Object.assign(this.config, updates);
    this.emit('config:updated', this.config);
    log.info('[TraderSignalBridge] Config updated');
  }

  getStatus(): BridgeStatus {
    return this.status;
  }

  pause(): void {
    this.status = 'paused';
    this.emit('bridge:paused');
  }

  resume(): void {
    this.status = 'active';
    this.emit('bridge:resumed');
  }

  // ── Follower Management ────────────────────────────────────────────────

  addFollowerConfig(config: FollowerCopyConfig): boolean {
    if (!config.followerId || !config.traderId) return false;

    if (!this.followerConfigs.has(config.traderId)) {
      this.followerConfigs.set(config.traderId, []);
    }

    const existing = this.followerConfigs.get(config.traderId)!;
    const idx = existing.findIndex(f => f.followerId === config.followerId);
    if (idx >= 0) {
      existing[idx] = config; // update
    } else {
      existing.push(config);
    }

    this.emit('follower:added', { traderId: config.traderId, followerId: config.followerId });
    return true;
  }

  removeFollowerConfig(traderId: string, followerId: string): boolean {
    const followers = this.followerConfigs.get(traderId);
    if (!followers) return false;
    const idx = followers.findIndex(f => f.followerId === followerId);
    if (idx < 0) return false;
    followers.splice(idx, 1);
    return true;
  }

  getFollowers(traderId: string): FollowerCopyConfig[] {
    return [...(this.followerConfigs.get(traderId) || [])];
  }

  getFollowerCount(traderId: string): number {
    return (this.followerConfigs.get(traderId) || []).length;
  }

  // ── Signal Processing Pipeline ─────────────────────────────────────────

  /**
   * Main pipeline: process a signal through the full bridge
   * 1. Receive signal → 2. Update profile → 3. Notify followers → 4. Execute copies
   */
  processSignal(params: {
    signalId: string;
    traderId: string;
    symbol: string;
    side: SignalSide;
    confidence: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
  }): SignalTradeSummary {
    const startTime = performance.now();

    if (this.status !== 'active') {
      return this.createFailedSummary(params, startTime, 'Bridge is not active');
    }

    // Store signal
    this.signalStore.set(params.signalId, {
      traderId: params.traderId,
      symbol: params.symbol,
      side: params.side,
      confidence: params.confidence,
      price: params.price,
    });

    // Stage 1: Signal received
    this.logEvent(params.signalId, params.traderId, 'signal_received', { symbol: params.symbol, side: params.side });

    // Stage 2: Update trader profile metrics
    this.updateTraderMetrics(params.traderId);
    this.logEvent(params.signalId, params.traderId, 'profile_updated', {});

    // Stage 3: Get eligible followers and notify
    const followers = this.getEligibleFollowers(params.traderId, params.confidence);
    this.logEvent(params.signalId, params.traderId, 'followers_notified', { count: followers.length });

    // Stage 4: Execute copy trades
    const results = this.executeCopyTrades(params, followers);
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalVolume = results
      .filter(r => r.success)
      .reduce((sum, r) => {
        const order = Array.from(this.orderStore.values()).find(o => o.signalId === params.signalId && o.followerId === r.followerId);
        return sum + (order ? order.quantity * order.price : 0);
      }, 0);

    // Complete
    const pipelineTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    this.pipelineTimes.push(pipelineTimeMs);
    this.logEvent(params.signalId, params.traderId, 'completed', { succeeded, failed, pipelineTimeMs });

    const summary: SignalTradeSummary = {
      signalId: params.signalId,
      traderId: params.traderId,
      symbol: params.symbol,
      side: params.side,
      followersAttempted: followers.length,
      followersSucceeded: succeeded,
      followersFailed: failed,
      totalVolume: Math.round(totalVolume * 100) / 100,
      pipelineTimeMs,
    };

    this.signalSummaries.set(params.signalId, summary);
    this.emit('signal:processed', summary);
    return summary;
  }

  // ── Internal Pipeline Steps ────────────────────────────────────────────

  private updateTraderMetrics(traderId: string): void {
    if (!this.traderMetrics.has(traderId)) {
      this.traderMetrics.set(traderId, { signalsPublished: 0, copyTradesTriggered: 0, followerCount: 0 });
    }
    const metrics = this.traderMetrics.get(traderId)!;
    metrics.signalsPublished++;
    metrics.followerCount = this.getFollowerCount(traderId);
  }

  private getEligibleFollowers(traderId: string, signalConfidence: number): FollowerCopyConfig[] {
    const allFollowers = this.followerConfigs.get(traderId) || [];
    return allFollowers
      .filter(f => f.enabled)
      .filter(() => signalConfidence >= this.config.minConfidenceForCopy)
      .slice(0, this.config.maxFollowersPerSignal);
  }

  private executeCopyTrades(
    signal: { signalId: string; traderId: string; symbol: string; side: SignalSide; confidence: number; price: number; stopLoss?: number; takeProfit?: number },
    followers: FollowerCopyConfig[]
  ): CopyTradeResult[] {
    const results: CopyTradeResult[] = [];

    for (const follower of followers) {
      try {
        if (signal.side === 'hold') {
          results.push({ followerId: follower.followerId, orderId: null, success: false, reason: 'hold signal skipped' });
          continue;
        }

        // Calculate position size
        const positionValue = follower.positionSizeMode === 'proportional'
          ? follower.accountEquity * (follower.positionSize / 100)
          : follower.positionSize;

        if (positionValue <= 0 || follower.accountEquity <= 0) {
          results.push({ followerId: follower.followerId, orderId: null, success: false, reason: 'invalid position' });
          continue;
        }

        const quantity = Math.floor(positionValue / signal.price);
        if (quantity <= 0) {
          results.push({ followerId: follower.followerId, orderId: null, success: false, reason: 'quantity zero' });
          continue;
        }

        // Create order
        const orderId = `bridge_order_${this.orderCounter++}`;
        this.orderStore.set(orderId, {
          followerId: follower.followerId,
          signalId: signal.signalId,
          symbol: signal.symbol,
          side: signal.side,
          quantity,
          price: signal.price,
          status: 'filled',
        });

        // Update trader metrics
        const metrics = this.traderMetrics.get(signal.traderId);
        if (metrics) metrics.copyTradesTriggered++;

        results.push({ followerId: follower.followerId, orderId, success: true });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'unknown error';
        results.push({ followerId: follower.followerId, orderId: null, success: false, reason: errorMsg });
        this.logEvent(signal.signalId, signal.traderId, 'failed', { followerId: follower.followerId }, errorMsg);
      }
    }

    return results;
  }

  private createFailedSummary(
    params: { signalId: string; traderId: string; symbol: string; side: SignalSide },
    startTime: number,
    reason: string
  ): SignalTradeSummary {
    const pipelineTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    this.logEvent(params.signalId, params.traderId, 'failed', {}, reason);
    return {
      signalId: params.signalId,
      traderId: params.traderId,
      symbol: params.symbol,
      side: params.side,
      followersAttempted: 0,
      followersSucceeded: 0,
      followersFailed: 0,
      totalVolume: 0,
      pipelineTimeMs,
    };
  }

  private logEvent(signalId: string, traderId: string, stage: PipelineStage, details: Record<string, unknown>, error?: string): void {
    this.pipelineLog.push({
      id: `evt_${this.eventCounter++}`,
      signalId,
      traderId,
      stage,
      timestamp: new Date().toISOString(),
      details,
      error,
    });
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getSignalSummary(signalId: string): SignalTradeSummary | null {
    return this.signalSummaries.get(signalId) || null;
  }

  getAllSignalSummaries(): SignalTradeSummary[] {
    return Array.from(this.signalSummaries.values());
  }

  getPipelineLog(signalId?: string): BridgePipelineEvent[] {
    if (signalId) {
      return this.pipelineLog.filter(e => e.signalId === signalId);
    }
    return [...this.pipelineLog];
  }

  getTraderMetrics(traderId: string): { signalsPublished: number; copyTradesTriggered: number; followerCount: number } | null {
    return this.traderMetrics.get(traderId) || null;
  }

  getOrdersBySignal(signalId: string): { followerId: string; orderId: string; symbol: string; side: string; quantity: number; price: number; status: string }[] {
    const results: { followerId: string; orderId: string; symbol: string; side: string; quantity: number; price: number; status: string }[] = [];
    for (const [orderId, order] of this.orderStore.entries()) {
      if (order.signalId === signalId) {
        results.push({ orderId, ...order });
      }
    }
    return results;
  }

  getOrdersByFollower(followerId: string): { orderId: string; signalId: string; symbol: string; side: string; quantity: number; price: number; status: string }[] {
    const results: { orderId: string; signalId: string; symbol: string; side: string; quantity: number; price: number; status: string }[] = [];
    for (const [orderId, order] of this.orderStore.entries()) {
      if (order.followerId === followerId) {
        results.push({ orderId, ...order });
      }
    }
    return results;
  }

  getStats(): BridgeStats {
    const summaries = Array.from(this.signalSummaries.values());
    const totalSucceeded = summaries.reduce((sum, s) => sum + s.followersSucceeded, 0);
    const totalFailed = summaries.reduce((sum, s) => sum + s.followersFailed, 0);
    const avgTime = this.pipelineTimes.length > 0
      ? Math.round((this.pipelineTimes.reduce((a, b) => a + b, 0) / this.pipelineTimes.length) * 100) / 100
      : 0;

    const allMetrics = Array.from(this.traderMetrics.values());
    const totalProfilesUpdated = allMetrics.reduce((sum, m) => sum + m.signalsPublished, 0);
    const totalFollowersNotified = summaries.reduce((sum, s) => sum + s.followersAttempted, 0);

    return {
      totalSignalsProcessed: summaries.length,
      totalProfilesUpdated,
      totalFollowersNotified,
      totalCopyTradesExecuted: totalSucceeded,
      totalCopyTradesFailed: totalFailed,
      avgPipelineTimeMs: avgTime,
      status: this.status,
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.pipelineLog = [];
    this.followerConfigs.clear();
    this.signalSummaries.clear();
    this.signalStore.clear();
    this.orderStore.clear();
    this.traderMetrics.clear();
    this.pipelineTimes = [];
    this.orderCounter = 1;
    this.eventCounter = 1;
    this.status = 'active';
    log.info('[TraderSignalBridge] Reset');
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: TraderSignalBridge | null = null;

export function getTraderSignalBridge(config?: Partial<BridgeConfig>): TraderSignalBridge {
  if (!_instance) _instance = new TraderSignalBridge(config);
  return _instance;
}

export function resetTraderSignalBridge(): void {
  _instance?.reset();
  _instance = null;
}

export default TraderSignalBridge;
