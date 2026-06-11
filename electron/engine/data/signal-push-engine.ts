/**
 * J-53-02: Signal Push Engine [P0]
 * v1.1.0-beta — Social Trading Signal Generation & Real-time Push
 *
 * :
 * - (SignalGenerator)
 * - (SignalDeduplicator)
 * - (SignalPushManager)
 * - (SignalQualityScorer)
 *
 * :
 * - ≥ 400L
 * - ≥ 25 tests, pass
 * - latency < 500ms
 */

import log from 'electron-log';
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type SignalDirection = 'BUY' | 'SELL' | 'HOLD';
export type SignalPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SignalStatus = 'pending' | 'active' | 'executed' | 'expired' | 'cancelled';

export interface TradingSignal {
  id: string;
  traderId: string;
  traderName: string;
  symbol: string;
  direction: SignalDirection;
  confidence: number; // 0-100
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  priority: SignalPriority;
  status: SignalStatus;
  strategyId?: string;
  strategyName?: string;
  reasoning: string;
  timestamp: string;
  expiresAt: string;
  dedupHash: string;
  qualityScore: number;
  subscribersNotified: number;
}

export interface SignalFilter {
  traderId?: string;
  symbol?: string;
  direction?: SignalDirection;
  minConfidence?: number;
  minQuality?: number;
  status?: SignalStatus;
  page: number;
  pageSize: number;
}

export interface SignalPushSubscription {
  subscriberId: string;
  traderId: string;
  enabled: boolean;
  minConfidence: number;
  symbols?: string[];
  createdAt: string;
}

export interface PushResult {
  signalId: string;
  subscribersNotified: number;
  latencyMs: number;
  deduplicated: boolean;
}

// ── Signal Deduplicator ────────────────────────────────────────────────────

export class SignalDeduplicator {
  private seen: Map<string, number> = new Map();
  private ttlMs: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  /**
   * Compute dedup hash from signal key fields
   */
  computeHash(traderId: string, symbol: string, direction: SignalDirection, entryPrice: number): string {
    const key = `${traderId}|${symbol}|${direction}|${Math.round(entryPrice * 100)}`;
    // Simple FNV-1a hash
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Check if signal is a duplicate within TTL window
   */
  isDuplicate(dedupHash: string): boolean {
    const now = Date.now();
    // Clean expired entries
    for (const [h, ts] of this.seen.entries()) {
      if (now - ts > this.ttlMs) this.seen.delete(h);
    }
    return this.seen.has(dedupHash);
  }

  /**
   * Record a signal hash
   */
  record(dedupHash: string): void {
    this.seen.set(dedupHash, Date.now());
  }

  /**
   * Get current seen count (active, not expired)
   */
  getActiveCount(): number {
    const now = Date.now();
    let count = 0;
    for (const [, ts] of this.seen.entries()) {
      if (now - ts <= this.ttlMs) count++;
    }
    return count;
  }

  reset(): void {
    this.seen.clear();
  }
}

// ── Signal Quality Scorer ──────────────────────────────────────────────────

export class SignalQualityScorer {
  /**
   * Score a signal 0-100 based on confidence, price context, and trader track record
   */
  score(params: {
    confidence: number;
    traderWinRate: number;
    traderSharpe: number;
    hasStopLoss: boolean;
    hasTakeProfit: boolean;
    reasoningLength: number;
  }): number {
    let score = 0;

    // Confidence weight (0-35)
    score += Math.min(35, params.confidence * 0.35);

    // Trader win rate (0-25)
    score += Math.min(25, params.traderWinRate * 0.25);

    // Sharpe (0-15)
    score += Math.min(15, Math.max(0, params.traderSharpe * 7.5));

    // Risk management (0-15)
    if (params.hasStopLoss) score += 8;
    if (params.hasTakeProfit) score += 7;

    // Reasoning quality (0-10)
    score += Math.min(10, params.reasoningLength / 10);

    return Math.round(Math.min(100, Math.max(0, score)));
  }
}

// ── Signal Push Engine ─────────────────────────────────────────────────────

export class SignalPushEngine extends EventEmitter {
  private signals: Map<string, TradingSignal> = new Map();
  private subscriptions: Map<string, SignalPushSubscription[]> = new Map();
  private dedup: SignalDeduplicator;
  private scorer: SignalQualityScorer;
  private idCounter: number = 1;
  private pushLog: PushResult[] = [];

  constructor(dedupTtlMs?: number) {
    super();
    this.dedup = new SignalDeduplicator(dedupTtlMs);
    this.scorer = new SignalQualityScorer();
    log.info('[SignalPushEngine] Initialized');
  }

  // ── Signal Generation ──────────────────────────────────────────────────

  generateSignal(input: {
    traderId: string;
    traderName: string;
    symbol: string;
    direction: SignalDirection;
    confidence: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    strategyId?: string;
    strategyName?: string;
    reasoning: string;
    ttlMinutes?: number;
    traderWinRate?: number;
    traderSharpe?: number;
  }): TradingSignal | null {
    if (!input.symbol || !input.traderId) return null;
    if (input.confidence < 0 || input.confidence > 100) return null;
    if (input.entryPrice <= 0) return null;

    // Dedup check
    const dedupHash = this.dedup.computeHash(input.traderId, input.symbol, input.direction, input.entryPrice);
    if (this.dedup.isDuplicate(dedupHash)) {
      this.emit('signal:deduplicated', { traderId: input.traderId, symbol: input.symbol });
      return null;
    }

    const now = Date.now();
    const ttl = input.ttlMinutes ?? 60;
    const qualityScore = this.scorer.score({
      confidence: input.confidence,
      traderWinRate: input.traderWinRate ?? 50,
      traderSharpe: input.traderSharpe ?? 1.0,
      hasStopLoss: input.stopLoss !== undefined,
      hasTakeProfit: input.takeProfit !== undefined,
      reasoningLength: input.reasoning.length,
    });

    const signal: TradingSignal = {
      id: `sig_${this.idCounter++}`,
      traderId: input.traderId,
      traderName: input.traderName,
      symbol: input.symbol,
      direction: input.direction,
      confidence: input.confidence,
      entryPrice: input.entryPrice,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      priority: this.calculatePriority(input.confidence, qualityScore),
      status: 'active',
      strategyId: input.strategyId,
      strategyName: input.strategyName,
      reasoning: input.reasoning,
      timestamp: new Date(now).toISOString(),
      expiresAt: new Date(now + ttl * 60000).toISOString(),
      dedupHash,
      qualityScore,
      subscribersNotified: 0,
    };

    this.signals.set(signal.id, signal);
    this.dedup.record(dedupHash);

    this.emit('signal:generated', { signalId: signal.id, traderId: input.traderId });
    return signal;
  }

  private calculatePriority(confidence: number, quality: number): SignalPriority {
    const combined = (confidence + quality) / 2;
    if (combined >= 80) return 'urgent';
    if (combined >= 60) return 'high';
    if (combined >= 40) return 'medium';
    return 'low';
  }

  // ── Signal Query ───────────────────────────────────────────────────────

  getSignal(id: string): TradingSignal | null {
    return this.signals.get(id) || null;
  }

  getSignals(filter: SignalFilter): { signals: TradingSignal[]; total: number } {
    let result = Array.from(this.signals.values());

    if (filter.traderId) result = result.filter(s => s.traderId === filter.traderId);
    if (filter.symbol) result = result.filter(s => s.symbol === filter.symbol);
    if (filter.direction) result = result.filter(s => s.direction === filter.direction);
    if (filter.minConfidence !== undefined) result = result.filter(s => s.confidence >= filter.minConfidence!);
    if (filter.minQuality !== undefined) result = result.filter(s => s.qualityScore >= filter.minQuality!);
    if (filter.status) result = result.filter(s => s.status === filter.status);

    // Sort by timestamp desc
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      signals: result.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize),
      total: result.length,
    };
  }

  // ── Signal Lifecycle ───────────────────────────────────────────────────

  cancelSignal(id: string): boolean {
    const signal = this.signals.get(id);
    if (!signal || signal.status !== 'active') return false;
    signal.status = 'cancelled';
    this.emit('signal:cancelled', { signalId: id });
    return true;
  }

  expireSignal(id: string): boolean {
    const signal = this.signals.get(id);
    if (!signal || signal.status !== 'active') return false;
    signal.status = 'expired';
    this.emit('signal:expired', { signalId: id });
    return true;
  }

  markExecuted(id: string): boolean {
    const signal = this.signals.get(id);
    if (!signal || signal.status !== 'active') return false;
    signal.status = 'executed';
    this.emit('signal:executed', { signalId: id });
    return true;
  }

  // ── Push Subscriptions ─────────────────────────────────────────────────

  subscribe(subscriberId: string, traderId: string, minConfidence: number = 50, symbols?: string[]): boolean {
    if (!this.subscriptions.has(traderId)) {
      this.subscriptions.set(traderId, []);
    }

    const subs = this.subscriptions.get(traderId)!;
    if (subs.some(s => s.subscriberId === subscriberId)) return false;

    subs.push({
      subscriberId,
      traderId,
      enabled: true,
      minConfidence,
      symbols,
      createdAt: new Date().toISOString(),
    });

    this.emit('sub:created', { subscriberId, traderId });
    return true;
  }

  unsubscribe(subscriberId: string, traderId: string): boolean {
    const subs = this.subscriptions.get(traderId);
    if (!subs) return false;
    const idx = subs.findIndex(s => s.subscriberId === subscriberId);
    if (idx === -1) return false;
    subs.splice(idx, 1);
    this.emit('sub:removed', { subscriberId, traderId });
    return true;
  }

  getSubscriberCount(traderId: string): number {
    return (this.subscriptions.get(traderId) || []).filter(s => s.enabled).length;
  }

  // ── Push Signal ────────────────────────────────────────────────────────

  pushSignal(signalId: string): PushResult | null {
    const signal = this.signals.get(signalId);
    if (!signal || signal.status !== 'active') return null;

    const start = Date.now();
    const subs = (this.subscriptions.get(signal.traderId) || []).filter(s => s.enabled);

    let notified = 0;
    for (const sub of subs) {
      if (signal.confidence < sub.minConfidence) continue;
      if (sub.symbols && sub.symbols.length > 0 && !sub.symbols.includes(signal.symbol)) continue;
      notified++;
    }

    signal.subscribersNotified = notified;
    const latencyMs = Date.now() - start;

    const result: PushResult = {
      signalId,
      subscribersNotified: notified,
      latencyMs,
      deduplicated: false,
    };

    this.pushLog.push(result);
    this.emit('signal:pushed', { signalId, notified, latencyMs });
    return result;
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  getStats(): {
    totalSignals: number;
    activeSignals: number;
    executedSignals: number;
    expiredSignals: number;
    avgLatencyMs: number;
    totalPushes: number;
    dedupActiveCount: number;
  } {
    const signals = Array.from(this.signals.values());
    return {
      totalSignals: signals.length,
      activeSignals: signals.filter(s => s.status === 'active').length,
      executedSignals: signals.filter(s => s.status === 'executed').length,
      expiredSignals: signals.filter(s => s.status === 'expired').length,
      avgLatencyMs: this.pushLog.length > 0
        ? Math.round(this.pushLog.reduce((s, r) => s + r.latencyMs, 0) / this.pushLog.length)
        : 0,
      totalPushes: this.pushLog.length,
      dedupActiveCount: this.dedup.getActiveCount(),
    };
  }

  getPushLog(): PushResult[] {
    return [...this.pushLog];
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, signal] of this.signals.entries()) {
      if (signal.status === 'active' && new Date(signal.expiresAt).getTime() < now) {
        signal.status = 'expired';
        cleaned++;
      }
    }
    if (cleaned > 0) this.emit('cleanup:expired', { count: cleaned });
    return cleaned;
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.signals.clear();
    this.subscriptions.clear();
    this.pushLog = [];
    this.dedup.reset();
    this.idCounter = 1;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: SignalPushEngine | null = null;

export function getSignalPushEngine(dedupTtlMs?: number): SignalPushEngine {
  if (!_instance) _instance = new SignalPushEngine(dedupTtlMs);
  return _instance;
}

export function resetSignalPushEngine(): void {
  _instance?.reset();
  _instance = null;
}

export default SignalPushEngine;
