/**
 * R276 auto#2: 因子订阅→推送IPC桥接 (FactorSubscriptionPushBridge) v1.0
 * 
 * QUANT MOO — User-facing factor subscription + push delivery bridge.
 * 
 * 上游: factor-signal-pipeline.ts (因子信号生成)
 * 下游: push-ipc-bridge.ts (桌面推送)
 * 
 * 核心流程:
 *   FactorSignalPipeline → 信号生成
 *   → FactorSubscriptionPushBridge → 匹配用户订阅
 *   → 优先级/过滤/频控 → PushIpcBridge → 桌面通知
 * 
 * 功能:
 *   1. 用户因子订阅管理 (subscribe / unsubscribe / list)
 *   2. 信号→推送适配 (factor signals → push payloads)
 *   3. 频控与去重 (per-factor cooldown, global rate limit)
 *   4. 订阅计费追踪 (free trial / paid / signals remaining)
 *   5. 推送偏好 (per-factor: 系统通知/应用内toast/托盘/tray闪烁)
 *   6. 因子批量推送 (digest mode: merge signals into one notification)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type PushDeliveryChannel = 'system' | 'toast' | 'tray' | 'sound';

export type SubscriptionTier = 'free' | 'basic' | 'premium';

export interface FactorSubscription {
  subscriptionId: string;
  factorId: string;
  factorName: string;
  factorNameCn: string;
  userId: string;
  tier: SubscriptionTier;
  channels: PushDeliveryChannel[];
  minSeverity: 'info' | 'warning' | 'critical';  // Only notify on >= this severity
  threshold?: { field: string; operator: 'gt' | 'lt' | 'gte' | 'lte'; value: number };
  cooldownMs: number;       // Min interval between pushes for this factor
  enabled: boolean;
  createdAt: number;
  expiresAt: number | null; // null = never (paid), set for trials
  signalsReceived: number;
  signalsRemaining: number;  // -1 = unlimited
  lastPushAt: number;
}

export interface FactorPushDelivery {
  deliveryId: string;
  subscriptionId: string;
  factorId: string;
  factorName: string;
  signalId: string;
  channel: PushDeliveryChannel;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  priority: 'low' | 'normal' | 'high';
  data?: Record<string, unknown>;
  timestamp: number;
  acknowledged: boolean;
}

export interface FactorSubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalDeliveries: number;
  deliveriesByFactor: Record<string, number>;
  lastDeliveryAt: number;
  freeTrialsActive: number;
  paidSubscriptions: number;
}

export interface FactorSubscriptionConfig {
  /** Global max pushes per hour across all subscriptions */
  globalMaxPerHour: number;
  /** Default cooldown per factor (ms) */
  defaultCooldownMs: number;
  /** Max subscriptions per free-tier user */
  maxFreeSubscriptions: number;
  /** Free trial duration (ms) */
  freeTrialDurationMs: number;
  /** Free trial signal quota */
  freeTrialSignalQuota: number;
  /** Digest mode: merge multiple signals into one push */
  digestMode: boolean;
  /** Digest interval (ms) - how often to group signals */
  digestIntervalMs: number;
  /** Billing: price per factor subscription (/month, USDT) */
  pricing: {
    free: number;
    basic: number;      // per factor
    premium: number;    // unlimited factors
  };
}

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_SUB_CONFIG: FactorSubscriptionConfig = {
  globalMaxPerHour: 15,
  defaultCooldownMs: 5 * 60 * 1000, // 5 min
  maxFreeSubscriptions: 3,
  freeTrialDurationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  freeTrialSignalQuota: 30,
  digestMode: false,
  digestIntervalMs: 15 * 60 * 1000, // 15 min
  pricing: {
    free: 0,
    basic: 2.9,     // USDT/月 per factor
    premium: 19.9,  // USDT/月 unlimited
  },
};

// ── FactorSubscriptionPushBridge ───────────────────────────────────────────

export class FactorSubscriptionPushBridge {
  private config: FactorSubscriptionConfig;
  
  // Subscriptions: subscriptionId → FactorSubscription
  private subscriptions: Map<string, FactorSubscription> = new Map();
  
  // Delivery history
  private deliveries: FactorPushDelivery[] = [];
  private deliveryHistory: FactorPushDelivery[] = [];
  
  // Rate limiting
  private hourlyDeliveryCount = 0;
  private hourlyWindowStart = Date.now();
  private lastPushByFactor: Map<string, number> = new Map();
  
  // Digest buffer
  private digestBuffer: Array<{ factorId: string; signalTitle: string; signalBody: string; severity: string }> = [];
  private digestTimer: ReturnType<typeof setInterval> | null = null;
  
  // Callbacks
  private deliveryHandlers: Array<(delivery: FactorPushDelivery) => void> = [];
  private digestHandlers: Array<(digest: string) => void> = [];
  
  // Stats
  private stats: FactorSubscriptionStats = {
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    totalDeliveries: 0,
    deliveriesByFactor: {},
    lastDeliveryAt: 0,
    freeTrialsActive: 0,
    paidSubscriptions: 0,
  };

  constructor(config?: Partial<FactorSubscriptionConfig>) {
    this.config = { ...DEFAULT_SUB_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Subscription Management
  // ═══════════════════════════════════════════════════════════════════════

  /** Subscribe to a factor */
  subscribe(params: {
    factorId: string;
    factorName: string;
    factorNameCn: string;
    userId: string;
    tier?: SubscriptionTier;
    channels?: PushDeliveryChannel[];
    minSeverity?: 'info' | 'warning' | 'critical';
    threshold?: { field: string; operator: 'gt' | 'lt' | 'gte' | 'lte'; value: number };
    cooldownMs?: number;
  }): { success: boolean; subscriptionId?: string; error?: string; reason?: string } {
    // Check free subscription limit
    if (params.tier === 'free' || !params.tier) {
      const freeCount = Array.from(this.subscriptions.values())
        .filter(s => s.userId === params.userId && s.tier === 'free').length;
      if (freeCount >= this.config.maxFreeSubscriptions) {
        return {
          success: false,
          error: 'MAX_FREE_LIMIT',
          reason: `Free tier limited to ${this.config.maxFreeSubscriptions} factor subscriptions. Upgrade to Basic (${this.config.pricing.basic} USDT/月) or Premium (${this.config.pricing.premium} USDT/月).`,
        };
      }
    }

    const subscriptionId = `sub_${params.userId}_${params.factorId}_${Date.now()}`;
    const tier = params.tier ?? 'free';
    const now = Date.now();
    
    const subscription: FactorSubscription = {
      subscriptionId,
      factorId: params.factorId,
      factorName: params.factorName,
      factorNameCn: params.factorNameCn,
      userId: params.userId,
      tier,
      channels: params.channels ?? ['system'],
      minSeverity: params.minSeverity ?? 'info',
      threshold: params.threshold,
      cooldownMs: params.cooldownMs ?? this.config.defaultCooldownMs,
      enabled: true,
      createdAt: now,
      expiresAt: tier === 'free' ? now + this.config.freeTrialDurationMs : null,
      signalsReceived: 0,
      signalsRemaining: tier === 'free' ? this.config.freeTrialSignalQuota : -1,
      lastPushAt: 0,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this._updateStats();
    
    return { success: true, subscriptionId };
  }

  /** Unsubscribe from a factor */
  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;
    
    this.subscriptions.delete(subscriptionId);
    this._updateStats();
    return true;
  }

  /** Get a specific subscription */
  getSubscription(subscriptionId: string): FactorSubscription | null {
    return this.subscriptions.get(subscriptionId) ?? null;
  }

  /** List subscriptions for a user */
  listSubscriptions(userId: string): FactorSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(s => s.userId === userId);
  }

  /** Enable/disable a subscription */
  toggleSubscription(subscriptionId: string, enabled: boolean): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;
    sub.enabled = enabled;
    this._updateStats();
    return true;
  }

  /** Update subscription channels */
  updateChannels(subscriptionId: string, channels: PushDeliveryChannel[]): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;
    sub.channels = channels;
    return true;
  }

  /** Update subscription threshold */
  updateThreshold(
    subscriptionId: string,
    threshold: { field: string; operator: 'gt' | 'lt' | 'gte' | 'lte'; value: number },
  ): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;
    sub.threshold = threshold;
    return true;
  }

  /** Upgrade subscription tier */
  upgradeTier(subscriptionId: string, tier: SubscriptionTier): { success: boolean; error?: string } {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return { success: false, error: 'Subscription not found' };
    
    // Validate tier upgrade
    const tierOrder = { free: 0, basic: 1, premium: 2 };
    if (tierOrder[tier] <= tierOrder[sub.tier]) {
      return { success: false, error: `Cannot downgrade from ${sub.tier} to ${tier}` };
    }
    
    sub.tier = tier;
    sub.expiresAt = null; // paid subscriptions don't expire
    if (tier === 'premium') {
      sub.signalsRemaining = -1; // unlimited
    }
    
    this._updateStats();
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Push Delivery (called by signal pipeline)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Dispatch a factor signal to all matching subscriptions.
   * Called by factor-signal-pipeline when a signal is generated.
   */
  dispatchSignal(params: {
    signalId: string;
    factorId: string;
    factorName: string;
    title: string;
    body: string;
    bodyCn?: string;
    severity: 'info' | 'warning' | 'critical';
    value?: number;
    data?: Record<string, unknown>;
  }): { deliveries: number; digestQueued: boolean } {
    const now = Date.now();

    // Check global rate limit
    if (!this._checkGlobalRateLimit()) {
      return { deliveries: 0, digestQueued: false };
    }

    // Find matching subscriptions
    const matching = Array.from(this.subscriptions.values())
      .filter(s => {
        if (!s.enabled) return false;
        if (s.expiresAt && s.expiresAt < now) return false; // expired trial
        if (s.factorId !== params.factorId) return false;
        if (s.signalsRemaining === 0) return false; // quota exhausted
        if (this._severityRank(params.severity) < this._severityRank(s.minSeverity)) return false;
        if (now - s.lastPushAt < s.cooldownMs) return false; // in cooldown
        if (s.threshold && params.value !== undefined) {
          if (!this._checkThreshold(params.value, s.threshold)) return false;
        }
        return true;
      });

    // Digest mode: batch signals
    if (this.config.digestMode && matching.length > 0) {
      this.digestBuffer.push({
        factorId: params.factorId,
        signalTitle: params.title,
        signalBody: params.bodyCn ?? params.body,
        severity: params.severity,
      });
      this._startDigestTimer();
      return { deliveries: 0, digestQueued: true };
    }

    // Dispatch to each matching subscription
    let deliveriesSent = 0;
    for (const sub of matching) {
      for (const channel of sub.channels) {
        const delivery = this._createDelivery(sub, params, channel);
        this._dispatch(delivery);
        deliveriesSent++;
      }
      sub.lastPushAt = now;
      sub.signalsReceived++;
      if (sub.signalsRemaining > 0) {
        sub.signalsRemaining--;
        
        // Warn when quota running low
        if (sub.signalsRemaining <= 5 && sub.signalsRemaining > 0) {
          this._emitQuotaWarning(sub, sub.signalsRemaining);
        }
      }
    }

    this.hourlyDeliveryCount += deliveriesSent;
    if (deliveriesSent > 0) {
      this.stats.lastDeliveryAt = now;
      this.stats.totalDeliveries += deliveriesSent;
    }

    return { deliveries: deliveriesSent, digestQueued: false };
  }

  /** Dispatch a batch of signals */
  dispatchSignals(signals: Array<{
    signalId: string;
    factorId: string;
    factorName: string;
    title: string;
    body: string;
    bodyCn?: string;
    severity: 'info' | 'warning' | 'critical';
    value?: number;
    data?: Record<string, unknown>;
  }>): { totalDeliveries: number } {
    let total = 0;
    for (const sig of signals) {
      const result = this.dispatchSignal(sig);
      total += result.deliveries;
    }
    return { totalDeliveries: total };
  }

  /** Force flush digest buffer (send merge notification) */
  flushDigest(): string | null {
    if (this.digestBuffer.length === 0) return null;
    
    const summary = this._formatDigest(this.digestBuffer);
    this.digestBuffer = [];
    this._stopDigestTimer();
    
    // Notify digest handlers
    for (const handler of this.digestHandlers) {
      try { handler(summary); } catch { /* non-fatal */ }
    }
    
    return summary;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Query
  // ═══════════════════════════════════════════════════════════════════════

  /** Get recent deliveries for a subscription */
  getDeliveries(subscriptionId: string, limit = 20): FactorPushDelivery[] {
    return this.deliveries
      .filter(d => d.subscriptionId === subscriptionId)
      .slice(0, limit);
  }

  /** Get statistics */
  getStats(): FactorSubscriptionStats {
    return { ...this.stats, deliveriesByFactor: { ...this.stats.deliveriesByFactor } };
  }

  /** Check if a user can subscribe to more factors */
  canSubscribe(userId: string, tier?: SubscriptionTier): { canSubscribe: boolean; remaining: number; reason?: string } {
    if (tier === 'premium') return { canSubscribe: true, remaining: Infinity };
    
    const currentCount = Array.from(this.subscriptions.values())
      .filter(s => s.userId === userId && s.enabled).length;
    const remaining = Math.max(0, this.config.maxFreeSubscriptions - currentCount);
    
    return {
      canSubscribe: remaining > 0,
      remaining,
      reason: remaining === 0 ? `Free tier limit reached (${this.config.maxFreeSubscriptions}). Upgrade to subscribe to more factors.` : undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Event handlers
  // ═══════════════════════════════════════════════════════════════════════

  /** Listen for deliveries (for push-ipc-bridge integration) */
  onDelivery(handler: (delivery: FactorPushDelivery) => void): () => void {
    this.deliveryHandlers.push(handler);
    return () => {
      const idx = this.deliveryHandlers.indexOf(handler);
      if (idx >= 0) this.deliveryHandlers.splice(idx, 1);
    };
  }

  /** Listen for digest summaries */
  onDigest(handler: (digest: string) => void): () => void {
    this.digestHandlers.push(handler);
    return () => {
      const idx = this.digestHandlers.indexOf(handler);
      if (idx >= 0) this.digestHandlers.splice(idx, 1);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Config
  // ═══════════════════════════════════════════════════════════════════════

  updateConfig(patch: Partial<FactorSubscriptionConfig>): void {
    this.config = { ...this.config, ...patch };
    if (!this.config.digestMode) this._stopDigestTimer();
  }

  getConfig(): FactorSubscriptionConfig {
    return { ...this.config };
  }

  /** Reset all state */
  reset(): void {
    this.subscriptions.clear();
    this.deliveries = [];
    this.deliveryHistory = [];
    this.hourlyDeliveryCount = 0;
    this.hourlyWindowStart = Date.now();
    this.lastPushByFactor.clear();
    this.digestBuffer = [];
    this._stopDigestTimer();
    this.deliveryHandlers = [];
    this.digestHandlers = [];
    this.stats = {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      totalDeliveries: 0,
      deliveriesByFactor: {},
      lastDeliveryAt: 0,
      freeTrialsActive: 0,
      paidSubscriptions: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Dispatch
  // ═══════════════════════════════════════════════════════════════════════

  private _dispatch(delivery: FactorPushDelivery): void {
    this.deliveries.unshift(delivery);
    if (this.deliveries.length > 1000) this.deliveries = this.deliveries.slice(0, 1000);
    this.deliveryHistory.push(delivery);
    
    this.stats.deliveriesByFactor[delivery.factorId] =
      (this.stats.deliveriesByFactor[delivery.factorId] ?? 0) + 1;

    for (const handler of this.deliveryHandlers) {
      try { handler(delivery); } catch { /* non-fatal */ }
    }
  }

  private _createDelivery(
    sub: FactorSubscription,
    signal: { signalId: string; factorId: string; factorName: string; title: string; body: string; bodyCn?: string; severity: string; data?: Record<string, unknown> },
    channel: PushDeliveryChannel,
  ): FactorPushDelivery {
    return {
      deliveryId: `del_${sub.subscriptionId}_${signal.signalId}_${channel}`,
      subscriptionId: sub.subscriptionId,
      factorId: signal.factorId,
      factorName: signal.factorName,
      signalId: signal.signalId,
      channel,
      title: `[${sub.factorNameCn ?? sub.factorName}] ${signal.title}`,
      body: signal.bodyCn ?? signal.body,
      severity: signal.severity as 'info' | 'warning' | 'critical',
      priority: signal.severity === 'critical' ? 'high' : signal.severity === 'warning' ? 'normal' : 'low',
      data: signal.data,
      timestamp: Date.now(),
      acknowledged: false,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Rate Limiting
  // ═══════════════════════════════════════════════════════════════════════

  private _checkGlobalRateLimit(): boolean {
    const now = Date.now();
    // Reset hourly window
    if (now - this.hourlyWindowStart > 3600_000) {
      this.hourlyDeliveryCount = 0;
      this.hourlyWindowStart = now;
    }
    return this.hourlyDeliveryCount < this.config.globalMaxPerHour;
  }

  private _checkThreshold(value: number, threshold: { operator: string; value: number }): boolean {
    switch (threshold.operator) {
      case 'gt': return value > threshold.value;
      case 'lt': return value < threshold.value;
      case 'gte': return value >= threshold.value;
      case 'lte': return value <= threshold.value;
      default: return true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Helpers
  // ═══════════════════════════════════════════════════════════════════════

  private _severityRank(s: string): number {
    return s === 'critical' ? 3 : s === 'warning' ? 2 : 1;
  }

  private _updateStats(): void {
    const subs = Array.from(this.subscriptions.values());
    this.stats.totalSubscriptions = subs.length;
    this.stats.activeSubscriptions = subs.filter(s => s.enabled).length;
    this.stats.freeTrialsActive = subs.filter(s => s.tier === 'free' && s.enabled).length;
    this.stats.paidSubscriptions = subs.filter(s => s.tier !== 'free').length;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Digest
  // ═══════════════════════════════════════════════════════════════════════

  private _startDigestTimer(): void {
    if (this.digestTimer) return;
    this.digestTimer = setInterval(() => {
      if (this.digestBuffer.length > 0) {
        this.flushDigest();
      }
    }, this.config.digestIntervalMs);
  }

  private _stopDigestTimer(): void {
    if (this.digestTimer) {
      clearInterval(this.digestTimer);
      this.digestTimer = null;
    }
  }

  private _formatDigest(buffer: Array<{ factorId: string; signalTitle: string; signalBody: string; severity: string }>): string {
    const counts: Record<string, number> = {};
    for (const item of buffer) {
      counts[item.factorId] = (counts[item.factorId] ?? 0) + 1;
    }

    const parts = Object.entries(counts).map(([factorId, count]) => `${factorId}: ${count} signal(s)`);
    const criticalCount = buffer.filter(b => b.severity === 'critical').length;
    const warningCount = buffer.filter(b => b.severity === 'warning').length;

    let summary = `📊 Factor Digest (${buffer.length} signals)\n`;
    summary += parts.join('\n');
    if (criticalCount > 0) summary += `\n🔴 ${criticalCount} critical`;
    if (warningCount > 0) summary += `\n🟡 ${warningCount} warnings`;

    return summary;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Quota warning
  // ═══════════════════════════════════════════════════════════════════════

  private _emitQuotaWarning(sub: FactorSubscription, remaining: number): void {
    const delivery: FactorPushDelivery = {
      deliveryId: `quota_${sub.subscriptionId}_${Date.now()}`,
      subscriptionId: sub.subscriptionId,
      factorId: sub.factorId,
      factorName: sub.factorName,
      signalId: 'quota_warning',
      channel: 'system',
      title: `⚠️ ${sub.factorNameCn ?? sub.factorName} 信号配额即将用尽`,
      body: `免费试用信号剩余 ${remaining} 条。升级到 Basic (${this.config.pricing.basic} USDT/月) 获得无限信号。`,
      severity: 'info',
      priority: 'low',
      data: { quotaRemaining: remaining, pricing: this.config.pricing.basic },
      timestamp: Date.now(),
      acknowledged: false,
    };
    this._dispatch(delivery);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _factorSubPushBridge: FactorSubscriptionPushBridge | null = null;

export function getFactorSubPushBridge(): FactorSubscriptionPushBridge {
  if (!_factorSubPushBridge) _factorSubPushBridge = new FactorSubscriptionPushBridge();
  return _factorSubPushBridge;
}

export function resetFactorSubPushBridge(): void {
  if (_factorSubPushBridge) _factorSubPushBridge.reset();
  _factorSubPushBridge = null;
}
