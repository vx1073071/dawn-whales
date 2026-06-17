/**
 * R264: AntiNoiseBridge — 防骚扰/噪声过滤引擎
 * 
 * 功能:
 *   1. 智能去重 (语义+时间窗口双去重)
 *   2. 频次封顶 (每小时/每天推送上限)
 *   3. 静默时段 (免打扰时间窗口)
 *   4. 噪声过滤器 (低价值推送过滤: 微幅波动/重复信号/非核心标的)
 *   5. 推送优先级队列 (重要→即时/一般→合并/琐碎→丢弃)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PushCandidate {
  pushId: string;
  symbol: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  titleCn: string;
  body: string;
  bodyCn: string;
  price: number;
  changePercent: number;
  timestamp: number;
  hash: string;  // dedup hash
}

export interface FilterResult {
  pushId: string;
  allowed: boolean;
  blocked: boolean;
  blockReason?: string;
  blockReasonCn?: string;
  priority: 'immediate' | 'batched' | 'digest' | 'dropped';
  checkedAt: number;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startHour: number;      // 0-23
  endHour: number;
  timezone: string;
  allowCritical: boolean;  // critical alerts bypass quiet hours
}

export interface RateLimitConfig {
  maxPerHour: number;      // per symbol
  maxPerDay: number;       // per symbol
  maxTotalPerHour: number; // global
  maxTotalPerDay: number;  // global
}

export interface AntiNoiseStats {
  totalCandidates: number;
  allowed: number;
  blockedDedup: number;
  blockedRateLimit: number;
  blockedQuietHours: number;
  blockedNoise: number;
  batched: number;
  dropped: number;
}

// ── Noise filter patterns ──────────────────────────────────────────────────

const NOISE_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
  reasonCn: string;
}> = [
  { pattern: /\+0\.0*[0-2]%/, reason: 'Micro change (<0.02%)', reasonCn: '微幅波动(<0.02%)' },
  { pattern: /unchanged/i, reason: 'Unchanged price', reasonCn: '价格不变' },
  { pattern: /\bflat\b/i, reason: 'Flat market', reasonCn: '平盘' },
];

// ═══════════════════════════════════════════════════════════════════════════
// AntiNoiseBridge
// ═══════════════════════════════════════════════════════════════════════════

export class AntiNoiseBridge {
  private dedupHashes: Map<string, number> = new Map();  // hash → last seen
  private perSymbolCounts: Map<string, { hour: number; day: number; hourWindow: number }> = new Map();
  private globalCounts = { hour: 0, day: 0, hourWindow: Date.now() };
  private filterResults: FilterResult[] = [];

  private config: {
    quietHours: QuietHoursConfig;
    rateLimit: RateLimitConfig;
    dedupWindowMs: number;
    noiseFilterEnabled: boolean;
  } = {
    quietHours: {
      enabled: true,
      startHour: 22,
      endHour: 7,
      timezone: 'Asia/Hong_Kong',
      allowCritical: true,
    },
    rateLimit: {
      maxPerHour: 5,
      maxPerDay: 20,
      maxTotalPerHour: 50,
      maxTotalPerDay: 200,
    },
    dedupWindowMs: 30 * 60_000,  // 30 min dedup window
    noiseFilterEnabled: true,
  };

  private stats_: AntiNoiseStats = {
    totalCandidates: 0, allowed: 0,
    blockedDedup: 0, blockedRateLimit: 0, blockedQuietHours: 0, blockedNoise: 0,
    batched: 0, dropped: 0,
  };

  constructor(config?: Partial<AntiNoiseBridge['config']>) {
    if (config) Object.assign(this.config, config);
  }

  // ── Public API: Filter Pipeline ─────────────────────────────────────────

  /**
   * Run a push candidate through the full anti-noise pipeline.
   */
  filter(candidate: Omit<PushCandidate, 'hash'>): FilterResult {
    this.stats_.totalCandidates++;

    const hash = this._hashCandidate(candidate);
    const fullCandidate: PushCandidate = { ...candidate, hash };

    // Layer 1: Dedup
    const lastSeen = this.dedupHashes.get(hash);
    if (lastSeen && Date.now() - lastSeen < this.config.dedupWindowMs) {
      this.stats_.blockedDedup++;
      return this._result(candidate.pushId, false, 'dropped', 'Duplicate push within dedup window', '去重窗口内重复推送');
    }

    // Layer 2: Quiet Hours
    if (this._isQuietHours() && !(this.config.quietHours.allowCritical && candidate.severity === 'critical')) {
      this.stats_.blockedQuietHours++;
      return this._result(candidate.pushId, false, 'batched', 'Within quiet hours', '免打扰时段');
    }

    // Layer 3: Noise Filter
    if (this.config.noiseFilterEnabled && this._isNoise(fullCandidate)) {
      this.stats_.blockedNoise++;
      return this._result(candidate.pushId, false, 'dropped', 'Noise filtered', '噪声过滤');
    }

    // Layer 4: Rate Limit
    if (!this._checkRateLimit(candidate.symbol)) {
      this.stats_.blockedRateLimit++;
      return this._result(candidate.pushId, false, 'batched', 'Rate limit exceeded', '频率限制');
    }

    // Passed all checks
    this.dedupHashes.set(hash, Date.now());
    this._incrementCounts(candidate.symbol);

    // Determine priority
    let priority: FilterResult['priority'] = 'immediate';
    if (candidate.severity === 'critical') priority = 'immediate';
    else if (candidate.severity === 'high') priority = 'immediate';
    else if (candidate.severity === 'medium') priority = 'batched';
    else priority = 'digest';

    this.stats_.allowed++;
    return this._result(candidate.pushId, true, priority);
  }

  /**
   * Batch filter multiple candidates.
   */
  filterBatch(candidates: Array<Omit<PushCandidate, 'hash'>>): FilterResult[] {
    return candidates.map(c => this.filter(c));
  }

  // ── Public API: Configuration ───────────────────────────────────────────

  /** Set quiet hours config */
  setQuietHours(config: Partial<QuietHoursConfig>): void {
    Object.assign(this.config.quietHours, config);
  }

  /** Set rate limit config */
  setRateLimit(config: Partial<RateLimitConfig>): void {
    Object.assign(this.config.rateLimit, config);
  }

  /** Enable/disable noise filter */
  setNoiseFilter(enabled: boolean): void {
    this.config.noiseFilterEnabled = enabled;
  }

  /** Set dedup window */
  setDedupWindow(ms: number): void {
    this.config.dedupWindowMs = ms;
  }

  // ── Public API: Batching ────────────────────────────────────────────────

  /**
   * Get batched pushes that were delayed due to quiet hours or rate limiting.
   */
  getBatched(): FilterResult[] {
    return this.filterResults
      .filter(r => r.priority === 'batched' || r.priority === 'digest')
      .slice(-50);
  }

  /**
   * Flush batched pushes (e.g., after quiet hours end).
   */
  flushBatched(): FilterResult[] {
    const batched = this.getBatched();
    for (const r of batched) {
      r.allowed = true;
      r.priority = 'immediate';
    }
    return batched;
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get anti-noise stats */
  getStats(): AntiNoiseStats {
    return {
      ...this.stats_,
      batched: this.filterResults.filter(r => r.priority === 'batched').length,
      dropped: this.filterResults.filter(r => r.priority === 'dropped').length,
    };
  }

  /** Get config */
  getConfig() { return { ...this.config }; }

  /** Check if currently in quiet hours */
  isQuietHours(): boolean { return this._isQuietHours(); }

  /** Get filter results */
  getResults(limit = 100): FilterResult[] {
    return this.filterResults.slice(-limit).reverse();
  }

  /** Reset */
  reset(): void {
    this.dedupHashes.clear();
    this.perSymbolCounts.clear();
    this.globalCounts = { hour: 0, day: 0, hourWindow: Date.now() };
    this.filterResults = [];
    this.stats_ = {
      totalCandidates: 0, allowed: 0,
      blockedDedup: 0, blockedRateLimit: 0, blockedQuietHours: 0, blockedNoise: 0,
      batched: 0, dropped: 0,
    };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _result(
    pushId: string,
    allowed: boolean,
    priority: FilterResult['priority'],
    blockReason?: string,
    blockReasonCn?: string,
  ): FilterResult {
    const result: FilterResult = {
      pushId, allowed, blocked: !allowed, blockReason, blockReasonCn,
      priority: allowed ? priority : (priority === 'immediate' ? 'dropped' : priority),
      checkedAt: Date.now(),
    };
    this.filterResults.push(result);
    if (this.filterResults.length > 500) this.filterResults.shift();
    return result;
  }

  private _isQuietHours(): boolean {
    if (!this.config.quietHours.enabled) return false;
    const hour = new Date().getHours();
    const { startHour, endHour } = this.config.quietHours;

    if (startHour <= endHour) {
      return hour >= startHour && hour < endHour;
    }
    // Overnight: e.g., 22-07
    return hour >= startHour || hour < endHour;
  }

  private _isNoise(candidate: PushCandidate): boolean {
    // Micro changes
    if (Math.abs(candidate.changePercent) < 0.05 && candidate.severity === 'low') return true;

    // Pattern matching
    const title = candidate.title + candidate.titleCn + candidate.body + candidate.bodyCn;
    for (const p of NOISE_PATTERNS) {
      if (p.pattern.test(title)) return true;
    }

    return false;
  }

  private _checkRateLimit(symbol: string): boolean {
    const now = Date.now();

    // Reset global hourly window
    if (now - this.globalCounts.hourWindow > 3_600_000) {
      this.globalCounts.hour = 0;
      this.globalCounts.hourWindow = now;
    }

    const symbolCounts = this.perSymbolCounts.get(symbol);
    if (!symbolCounts) return true; // first push for this symbol

    // Check global limits
    if (this.globalCounts.hour >= this.config.rateLimit.maxTotalPerHour) return false;
    if (this.globalCounts.day >= this.config.rateLimit.maxTotalPerDay) return false;

    // Check per-symbol limits
    if (symbolCounts.hour >= this.config.rateLimit.maxPerHour) return false;
    if (symbolCounts.day >= this.config.rateLimit.maxPerDay) return false;

    return true;
  }

  private _incrementCounts(symbol: string): void {
    this.globalCounts.hour++;
    this.globalCounts.day++;

    const counts = this.perSymbolCounts.get(symbol) ?? { hour: 0, day: 0, hourWindow: Date.now() };
    counts.hour++;
    counts.day++;
    this.perSymbolCounts.set(symbol, counts);
  }

  private _hashCandidate(c: Omit<PushCandidate, 'hash'>): string {
    const raw = `${c.symbol}|${c.type}|${c.severity}|${Math.round(c.changePercent * 100)}`;
    const h = createHash('sha256').update(raw).digest('hex');
    return h.slice(0, 16);
  }
}

export const antiNoiseBridge = new AntiNoiseBridge();
