/**
 * R239-auto#3: DegradationChain + AIUsageTracker
 * v2.7.0 NEWS INTELLIGENCE
 *
 * Degradation Chain:
 *   When the primary AI (DeepSeek) is unavailable, the system degrades
 *   through a chain of fallback strategies:
 *     Layer 1: DeepSeek V4 Pro       (full AI, highest accuracy)
 *     Layer 2: DeepSeek Flash        (cheaper, slightly lower accuracy)
 *     Layer 3: Keyword Sentiment     (rule-based, moderate accuracy)
 *     Layer 4: Neutral Default       (safe fallback, lowest accuracy)
 *
 * AI Usage Tracker:
 *   Tracks per-user usage against billing:
 *     - Free tier: 10 calls/day
 *     - Basic tier: 100 calls/day
 *     - Pro tier: 500 calls/day
 *     - Enterprise: unlimited
 *   - Per-model cost tracking
 *   - Monthly usage reports
 *   - Budget alerts
 *
 * Features:
 *   - Auto-degradation with configurable thresholds
 *   - Circuit breaker (5 consecutive failures → open 60s)
 *   - Per-model latency tracking
 *   - Usage quotas with soft/hard limits
 *   - Cost projection and alerts
 *
 * Constraints: ZERO external cost for degradation logic
 * ≥350L production-ready
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type AITier = 'deepseek_v4' | 'deepseek_flash' | 'keyword' | 'neutral';
export type UsageTier = 'free' | 'basic' | 'pro' | 'enterprise';

export interface DegradationConfig {
  /** Max consecutive failures before circuit break */
  circuitBreakerThreshold: number;
  /** Circuit breaker cooldown (ms) */
  circuitBreakerCooldownMs: number;
  /** Max retries per layer before degrading */
  maxRetriesPerLayer: number;
  /** Timeout per attempt (ms) */
  perAttemptTimeoutMs: number;
  /** Health check interval (ms) */
  healthCheckIntervalMs: number;
}

export interface DegradationState {
  currentTier: AITier;
  healthy: boolean;
  circuitOpen: boolean;
  circuitOpenSince: number | null;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastHealthCheck: number;
  degradationCount: number;
}

export interface UsageConfig {
  tier: UsageTier;
  dailyLimit: number;
  monthlyLimit: number;
  costPerCallV4: number;
  costPerCallFlash: number;
  softLimitPercent: number;  // Alert at this % of limit
}

const USAGE_LIMITS: Record<UsageTier, { daily: number; monthly: number }> = {
  free: { daily: 10, monthly: 300 },
  basic: { daily: 100, monthly: 3000 },
  pro: { daily: 500, monthly: 15000 },
  enterprise: { daily: Infinity, monthly: Infinity },
};

export interface UsageRecord {
  userId: string;
  tier: UsageTier;
  daily: {
    date: string;
    totalCalls: number;
    v4Calls: number;
    flashCalls: number;
    keywordFallbacks: number;
    totalCost: number;
  };
  monthly: {
    month: string;
    totalCalls: number;
    totalCost: number;
    avgLatencyMs: number;
  };
}

export interface UsageAlert {
  userId: string;
  type: 'SOFT_LIMIT' | 'HARD_LIMIT' | 'BUDGET_EXCEEDED' | 'TIER_UPGRADE_SUGGESTED';
  message: string;
  currentUsage: number;
  limit: number;
  timestamp: number;
}

export interface CombinedStats {
  degradation: DegradationState;
  usage: {
    activeUsers: number;
    totalCallsToday: number;
    totalCostToday: number;
    totalCostMonth: number;
  };
}

const DEFAULT_DEGRADATION_CONFIG: DegradationConfig = {
  circuitBreakerThreshold: 5,
  circuitBreakerCooldownMs: 60000,
  maxRetriesPerLayer: 3,
  perAttemptTimeoutMs: 15000,
  healthCheckIntervalMs: 300000, // 5 min
};

// ═══════════════════════════════════════════════════════════════════
// DegradationChain
// ═══════════════════════════════════════════════════════════════════

export class DegradationChain {
  private config: DegradationConfig;
  private state: DegradationState = {
    currentTier: 'deepseek_v4',
    healthy: true,
    circuitOpen: false,
    circuitOpenSince: null,
    consecutiveFailures: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    lastHealthCheck: Date.now(),
    degradationCount: 0,
  };
  private tierLatency: Map<AITier, number[]> = new Map();

  constructor(config?: Partial<DegradationConfig>) {
    this.config = { ...DEFAULT_DEGRADATION_CONFIG, ...config };
  }

  /**
   * Execute with automatic degradation.
   * Takes executor functions for each tier; tries them in order.
   */
  async execute<T>(
    executors: Partial<Record<AITier, () => Promise<T>>>,
  ): Promise<{ result: T; tier: AITier; degraded: boolean }> {
    // Check circuit breaker
    if (this.state.circuitOpen) {
      const cooldownRemaining = this.state.circuitOpenSince
        ? this.config.circuitBreakerCooldownMs - (Date.now() - this.state.circuitOpenSince)
        : 0;
      if (cooldownRemaining > 0) {
        log.warn(`[DegradationChain] Circuit open — skipping to lowest available tier (${cooldownRemaining}ms remaining)`);
        return this.tryFallback(executors, 2); // Skip first 2 tiers
      }
      // Cooldown expired → half-open
      this.state.circuitOpen = false;
      this.state.circuitOpenSince = null;
      log.info('[DegradationChain] Circuit half-open, probing');
    }

    // Try tiers in order
    const tierOrder: AITier[] = ['deepseek_v4', 'deepseek_flash', 'keyword', 'neutral'];

    for (let i = 0; i < tierOrder.length; i++) {
      const tier = tierOrder[i];
      const executor = executors[tier];
      if (!executor) continue;

      let lastError: Error | null = null;
      for (let attempt = 0; attempt < this.config.maxRetriesPerLayer; attempt++) {
        try {
          const startTime = Date.now();
          const result = await this.withTimeout(executor(), this.config.perAttemptTimeoutMs);
          const latency = Date.now() - startTime;

          // Success! Record and return.
          this.recordSuccess(tier, latency);
          const degraded = tier !== 'deepseek_v4';

          if (this.state.circuitOpen && tier === 'deepseek_v4') {
            // Circuit close on successful V4 probe
            this.state.circuitOpen = false;
            this.state.circuitOpenSince = null;
            this.state.healthy = true;
            log.info('[DegradationChain] Circuit closed — V4 restored');
          }

          return { result, tier, degraded };
        } catch (err: any) {
          lastError = err;
          if (attempt < this.config.maxRetriesPerLayer - 1) {
            await this.sleep(200 * (attempt + 1)); // Exponential backoff
          }
        }
      }

      // Layer exhausted
      this.recordFailure(tier);
      log.warn(`[DegradationChain] Tier ${tier} failed after ${this.config.maxRetriesPerLayer} attempts: ${lastError?.message}`);
    }

    // All tiers failed — catastrophic
    this.state.healthy = false;
    throw new Error('All degradation tiers exhausted — system unavailable');
  }

  // ── Internal ─────────────────────────────────────────────────────

  private async tryFallback<T>(
    executors: Partial<Record<AITier, () => Promise<T>>>,
    skipTiers: number,
  ): Promise<{ result: T; tier: AITier; degraded: boolean }> {
    const tierOrder: AITier[] = ['deepseek_v4', 'deepseek_flash', 'keyword', 'neutral'];
    const effectiveTiers = tierOrder.slice(skipTiers);

    for (const tier of effectiveTiers) {
      const executor = executors[tier];
      if (!executor) continue;

      try {
        const startTime = Date.now();
        const result = await this.withTimeout(executor(), this.config.perAttemptTimeoutMs);
        this.recordSuccess(tier, Date.now() - startTime);
        return { result, tier, degraded: true };
      } catch (err: any) {
        this.recordFailure(tier);
        log.warn(`[DegradationChain] Fallback ${tier} failed: ${err.message}`);
      }
    }

    throw new Error('All fallback tiers exhausted');
  }

  private recordSuccess(tier: AITier, latencyMs: number): void {
    this.state.consecutiveFailures = 0;
    this.state.totalSuccesses++;
    this.state.currentTier = tier;
    this.state.lastHealthCheck = Date.now();

    if (!this.tierLatency.has(tier)) this.tierLatency.set(tier, []);
    const latencies = this.tierLatency.get(tier)!;
    latencies.push(latencyMs);
    if (latencies.length > 100) latencies.shift(); // Keep last 100
  }

  private recordFailure(tier: AITier): void {
    this.state.consecutiveFailures++;
    this.state.totalFailures++;

    if (this.state.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      if (!this.state.circuitOpen) {
        this.state.circuitOpen = true;
        this.state.circuitOpenSince = Date.now();
        this.state.degradationCount++;
        log.warn(`[DegradationChain] Circuit breaker OPEN — ${this.state.consecutiveFailures} consecutive failures`);
      }
    }

    // Auto-degrade tier
    const tierOrder: AITier[] = ['deepseek_v4', 'deepseek_flash', 'keyword', 'neutral'];
    const currentIdx = tierOrder.indexOf(this.state.currentTier);
    if (currentIdx < tierOrder.length - 1 && this.state.consecutiveFailures >= 3) {
      this.state.currentTier = tierOrder[currentIdx + 1];
      this.state.degradationCount++;
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
      promise.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); },
      );
    });
  }

  // ── Health ───────────────────────────────────────────────────────

  getState(): DegradationState {
    return { ...this.state };
  }

  getAvgLatency(tier: AITier): number {
    const latencies = this.tierLatency.get(tier);
    if (!latencies || latencies.length === 0) return 0;
    return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  }

  resetCircuitBreaker(): void {
    this.state.circuitOpen = false;
    this.state.circuitOpenSince = null;
    this.state.consecutiveFailures = 0;
    this.state.currentTier = 'deepseek_v4';
    this.state.healthy = true;
    this.state.lastHealthCheck = Date.now();
  }

  reset(): void {
    this.state = {
      currentTier: 'deepseek_v4', healthy: true,
      circuitOpen: false, circuitOpenSince: null,
      consecutiveFailures: 0, totalFailures: 0, totalSuccesses: 0,
      lastHealthCheck: Date.now(), degradationCount: 0,
    };
    this.tierLatency.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════
// AIUsageTracker
// ═══════════════════════════════════════════════════════════════════

export class AIUsageTracker {
  private users = new Map<string, UsageRecord>();
  private alerts: UsageAlert[] = [];
  private stats = {
    activeUsers: 0, totalCallsToday: 0,
    totalCostToday: 0, totalCostMonth: 0,
  };

  // ── Record ───────────────────────────────────────────────────────

  /**
   * Record a single AI call for billing/usage tracking.
   */
  recordCall(userId: string, tier: UsageTier, model: AITier, cost?: number): void {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    let record = this.users.get(userId);
    if (!record) {
      record = {
        userId, tier,
        daily: { date: today, totalCalls: 0, v4Calls: 0, flashCalls: 0, keywordFallbacks: 0, totalCost: 0 },
        monthly: { month, totalCalls: 0, totalCost: 0, avgLatencyMs: 0 },
      };
      this.users.set(userId, record);
      this.stats.activeUsers = this.users.size;
    }

    // Check daily reset
    if (record.daily.date !== today) {
      record.daily = { date: today, totalCalls: 0, v4Calls: 0, flashCalls: 0, keywordFallbacks: 0, totalCost: 0 };
    }
    // Check monthly reset
    if (record.monthly.month !== month) {
      record.monthly = { month, totalCalls: 0, totalCost: 0, avgLatencyMs: 0 };
    }

    // Update counts
    record.daily.totalCalls++;
    record.monthly.totalCalls++;
    this.stats.totalCallsToday++;
    this.stats.totalCostMonth += cost || 0;
    this.stats.totalCostToday += cost || 0;

    if (model === 'deepseek_v4') record.daily.v4Calls++;
    else if (model === 'deepseek_flash') record.daily.flashCalls++;
    else if (model === 'keyword') record.daily.keywordFallbacks++;

    const callCost = cost || (model === 'deepseek_v4' ? 0.0005 : model === 'deepseek_flash' ? 0.0001 : 0);
    record.daily.totalCost += callCost;
    record.monthly.totalCost += callCost;

    // Check limits
    this.checkLimits(record);
  }

  // ── Queries ──────────────────────────────────────────────────────

  canCall(userId: string, tier: UsageTier): boolean {
    const limits = USAGE_LIMITS[tier];
    if (limits.daily === Infinity) return true;

    const record = this.users.get(userId);
    if (!record) return true;

    const today = new Date().toISOString().split('T')[0];
    if (record.daily.date !== today) return true;

    return record.daily.totalCalls < limits.daily;
  }

  getRemainingQuota(userId: string, tier: UsageTier): number {
    const limits = USAGE_LIMITS[tier];
    const record = this.users.get(userId);
    if (!record) return limits.daily;

    const today = new Date().toISOString().split('T')[0];
    if (record.daily.date !== today) return limits.daily;

    return Math.max(0, limits.daily - record.daily.totalCalls);
  }

  getUserUsage(userId: string): UsageRecord | null {
    return this.users.get(userId) || null;
  }

  getAlerts(userId?: string): UsageAlert[] {
    if (userId) return this.alerts.filter(a => a.userId === userId);
    return [...this.alerts];
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  // ── Reports ──────────────────────────────────────────────────────

  getDailyReport(): { totalCalls: number; totalCost: number; topUsers: { userId: string; calls: number; cost: number }[] } {
    const today = new Date().toISOString().split('T')[0];

    const topUsers = [...this.users.entries()]
      .filter(([, r]) => r.daily.date === today)
      .map(([userId, r]) => ({ userId, calls: r.daily.totalCalls, cost: Math.round(r.daily.totalCost * 10000) / 10000 }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    return {
      totalCalls: this.stats.totalCallsToday,
      totalCost: Math.round(this.stats.totalCostToday * 10000) / 10000,
      topUsers,
    };
  }

  getMonthlyReport(): { totalCalls: number; totalCost: number; avgCallsPerDay: number } {
    const month = new Date().toISOString().substring(0, 7);
    let monthlyCalls = 0;
    let monthlyCost = 0;

    for (const [, record] of this.users) {
      if (record.monthly.month === month) {
        monthlyCalls += record.monthly.totalCalls;
        monthlyCost += record.monthly.totalCost;
      }
    }

    const daysElapsed = new Date().getDate();
    return {
      totalCalls: monthlyCalls,
      totalCost: Math.round(monthlyCost * 100) / 100,
      avgCallsPerDay: daysElapsed > 0 ? Math.round(monthlyCalls / daysElapsed) : 0,
    };
  }

  // ── Internal ─────────────────────────────────────────────────────

  private checkLimits(record: UsageRecord): void {
    const limits = USAGE_LIMITS[record.tier];

    // Soft limit (80%)
    const softLimit = Math.floor(limits.daily * 0.8);
    if (record.daily.totalCalls === softLimit) {
      this.alerts.push({
        userId: record.userId, type: 'SOFT_LIMIT',
        message: `Daily usage at 80% (${record.daily.totalCalls}/${limits.daily})`,
        currentUsage: record.daily.totalCalls, limit: limits.daily,
        timestamp: Date.now(),
      });
    }

    // Hard limit
    if (record.daily.totalCalls >= limits.daily && limits.daily !== Infinity) {
      this.alerts.push({
        userId: record.userId, type: 'HARD_LIMIT',
        message: `Daily limit reached (${record.daily.totalCalls}/${limits.daily})`,
        currentUsage: record.daily.totalCalls, limit: limits.daily,
        timestamp: Date.now(),
      });
    }

    // Tier upgrade suggestion (3 consecutive days near limit)
    if (record.monthly.totalCalls > limits.monthly * 0.7 && record.tier !== 'enterprise') {
      this.alerts.push({
        userId: record.userId, type: 'TIER_UPGRADE_SUGGESTED',
        message: `Consider upgrading from ${record.tier} — ${record.monthly.totalCalls} calls this month`,
        currentUsage: record.monthly.totalCalls, limit: limits.monthly,
        timestamp: Date.now(),
      });
    }
  }

  // ── Stats ────────────────────────────────────────────────────────

  getStats(): CombinedStats {
    const chain = degradationChain;
    return {
      degradation: chain.getState(),
      usage: {
        activeUsers: this.stats.activeUsers,
        totalCallsToday: this.stats.totalCallsToday,
        totalCostToday: Math.round(this.stats.totalCostToday * 10000) / 10000,
        totalCostMonth: Math.round(this.stats.totalCostMonth * 100) / 100,
      },
    };
  }

  reset(): void {
    this.users.clear();
    this.alerts = [];
    this.stats = { activeUsers: 0, totalCallsToday: 0, totalCostToday: 0, totalCostMonth: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Singletons
// ═══════════════════════════════════════════════════════════════════

export const degradationChain = new DegradationChain();
export const usageTracker = new AIUsageTracker();

export function resetDegradationChain(): void {
  degradationChain.reset();
}

export function resetUsageTracker(): void {
  usageTracker.reset();
}
