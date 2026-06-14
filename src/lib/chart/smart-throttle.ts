// TradingEasy R116 QTE-40 — Smart Throttling Engine
// PM: 动态节流 — BTC/ETH 10条/s, 中盘4条/s, penny/小币1条/s
// 基于成交量和波动率自适应调整

export type ThrottleTier = 'high' | 'medium' | 'low';

export interface ThrottleRule {
  tier: ThrottleTier;
  maxPerSecond: number;
  minVolume24h: number;  // USD
  maxSpreadPct: number;
  priority: number;      // higher = more important
}

export interface SymbolMeta {
  symbol: string;
  volume24h: number;
  spreadPct: number;
  volatility: number;    // ATR ratio
  hasArbitrage: boolean;
  inWatchlist: boolean;
  hasActiveOrder: boolean;
}

export interface ThrottleConfig {
  tiers: Record<ThrottleTier, ThrottleRule>;
  watchlistBoost: number;
  arbBoost: number;
  activeOrderBoost: number;
  globalMaxPerSecond: number;
}

export interface ThrottleState {
  symbol: string;
  tier: ThrottleTier;
  effectiveMaxPerSecond: number;
  recentCount: number;
  blockedCount: number;
  lastAllowed: number;
  burstTokens: number;
  maxBurst: number;
}

// ═══════════ Default Config ═══════════

const DEFAULT_CONFIG: ThrottleConfig = {
  tiers: {
    high: { tier: 'high', maxPerSecond: 10, minVolume24h: 100_000_000, maxSpreadPct: 1, priority: 3 },
    medium: { tier: 'medium', maxPerSecond: 4, minVolume24h: 10_000_000, maxSpreadPct: 5, priority: 2 },
    low: { tier: 'low', maxPerSecond: 1, minVolume24h: 0, maxSpreadPct: 100, priority: 1 },
  },
  watchlistBoost: 2,     // 2x max rate for watchlist symbols
  arbBoost: 1.5,         // 1.5x for symbols with arbitrage
  activeOrderBoost: 2,   // 2x for symbols with active orders
  globalMaxPerSecond: 50, // global rate cap
};

// ═══════════ Token Bucket ═══════════

class TokenBucket {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;

  constructor(maxTokens: number, refillPerSecond: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  updateRate(perSecond: number): void {
    this.refillRate = perSecond / 1000;
    this.maxTokens = Math.max(1, perSecond);
    this.tokens = Math.min(this.tokens, this.maxTokens);
  }
}

// ═══════════ Smart Throttling Engine ═══════════

export class SmartThrottle {
  private config: ThrottleConfig;
  private meta: Map<string, SymbolMeta> = new Map();
  private buckets: Map<string, TokenBucket> = new Map();
  private globalBucket: TokenBucket;
  private states: Map<string, ThrottleState> = new Map();
  private totalAllowed = 0;
  private totalBlocked = 0;

  constructor(config?: Partial<ThrottleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.globalBucket = new TokenBucket(this.config.globalMaxPerSecond, this.config.globalMaxPerSecond);
  }

  /** Register/update symbol metadata */
  updateMeta(symbol: string, meta: Partial<SymbolMeta>): void {
    const existing = this.meta.get(symbol) || {
      symbol,
      volume24h: 0,
      spreadPct: 0,
      volatility: 0,
      hasArbitrage: false,
      inWatchlist: false,
      hasActiveOrder: false,
    };
    this.meta.set(symbol, { ...existing, ...meta });

    // Recompute effective rate
    this.recomputeRate(symbol);
  }

  /** Can this symbol send an update now? */
  canUpdate(symbol: string): boolean {
    // Global cap check
    if (!this.globalBucket.tryConsume()) {
      this.totalBlocked++;
      return false;
    }

    let bucket = this.buckets.get(symbol);
    if (!bucket) {
      bucket = new TokenBucket(1, 1); // default low
      this.buckets.set(symbol, bucket);
    }

    const allowed = bucket.tryConsume();
    const state = this.getOrCreateState(symbol);

    if (allowed) {
      this.totalAllowed++;
      state.lastAllowed = Date.now();
      state.recentCount++;
      state.burstTokens = bucket.getTokens();
    } else {
      this.totalBlocked++;
      state.blockedCount++;
    }

    return allowed;
  }

  /** Bulk check — returns list of symbols that can update now */
  filterAllowed(symbols: string[]): string[] {
    return symbols.filter((s) => this.canUpdate(s));
  }

  /** Get effective max rate for a symbol */
  getEffectiveRate(symbol: string): number {
    return this.getOrCreateState(symbol).effectiveMaxPerSecond;
  }

  /** Get throttling state */
  getState(symbol: string): ThrottleState {
    return this.getOrCreateState(symbol);
  }

  /** Get global stats */
  getStats(): { totalAllowed: number; totalBlocked: number; acceptanceRate: number; trackedSymbols: number } {
    const total = this.totalAllowed + this.totalBlocked;
    return {
      totalAllowed: this.totalAllowed,
      totalBlocked: this.totalBlocked,
      acceptanceRate: total > 0 ? this.totalAllowed / total : 1,
      trackedSymbols: this.meta.size,
    };
  }

  /** Update global max */
  setGlobalMax(perSecond: number): void {
    this.config.globalMaxPerSecond = perSecond;
    this.globalBucket.updateRate(perSecond);
  }

  /** Reset counters */
  reset(): void {
    this.buckets.clear();
    this.states.clear();
    this.totalAllowed = 0;
    this.totalBlocked = 0;
    this.globalBucket = new TokenBucket(this.config.globalMaxPerSecond, this.config.globalMaxPerSecond);
  }

  private recomputeRate(symbol: string): void {
    const meta = this.meta.get(symbol);
    if (!meta) return;

    // Determine tier
    let tier: ThrottleTier = 'low';
    if (meta.volume24h >= this.config.tiers.high.minVolume24h && meta.spreadPct <= this.config.tiers.high.maxSpreadPct) {
      tier = 'high';
    } else if (meta.volume24h >= this.config.tiers.medium.minVolume24h && meta.spreadPct <= this.config.tiers.medium.maxSpreadPct) {
      tier = 'medium';
    }

    const base = this.config.tiers[tier].maxPerSecond;
    let effective = base;

    // Boosts
    if (meta.inWatchlist) effective *= this.config.watchlistBoost;
    if (meta.hasArbitrage) effective *= this.config.arbBoost;
    if (meta.hasActiveOrder) effective *= this.config.activeOrderBoost;

    // Cap at global max
    effective = Math.min(effective, this.config.globalMaxPerSecond);

    // Update or create bucket
    let bucket = this.buckets.get(symbol);
    if (!bucket) {
      bucket = new TokenBucket(effective, effective);
      this.buckets.set(symbol, bucket);
    } else {
      bucket.updateRate(effective);
    }

    // Update state
    const state = this.getOrCreateState(symbol);
    state.tier = tier;
    state.effectiveMaxPerSecond = effective;
    state.maxBurst = effective;
  }

  private getOrCreateState(symbol: string): ThrottleState {
    let state = this.states.get(symbol);
    if (!state) {
      state = {
        symbol,
        tier: 'low',
        effectiveMaxPerSecond: 1,
        recentCount: 0,
        blockedCount: 0,
        lastAllowed: 0,
        burstTokens: 0,
        maxBurst: 1,
      };
      this.states.set(symbol, state);
    }
    return state;
  }
}

// ═══════════ Static helpers ═══════════

/** Classify symbol into tier based on volume 24h */
export function classifyTier(volume24h: number): ThrottleTier {
  if (volume24h >= 100_000_000) return 'high';
  if (volume24h >= 10_000_000) return 'medium';
  return 'low';
}

/** Recommended throttle rates by tier */
export const TIER_RATES: Record<ThrottleTier, number> = {
  high: 10,
  medium: 4,
  low: 1,
};
