/**
import { EngineError, ErrorCode } from '../../errors';

 * J-66-01 [P0]: 创作者等级引擎 (R66 v19 — v1.6.0 GA)
 *
 * 6级等级系统: 青铜→白银→黄金→铂金→钻石→王者
 * 经验值 = AI分析次数 + 信号订阅数 + 模板销量 + 7日胜率
 * 权益: L1(70/30) L2(80/20) L3(90/10) 自动晋升/降级
 *
 * >=350L, 10 tests
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type CreatorTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'king';

export interface CreatorStats {
  userId: string;
  aiAnalysisCount: number;       // 累计AI分析次数
  signalSubscribers: number;     // 当前订阅数
  templateSales: number;         // 累计模板销量
  sevenDayWinRate: number;       // 7日胜率 (0-1)
  totalRevenue: number;          // 累计收益 USDT
  consecutiveLossDays: number;   // 连续亏损天数
}

export interface TierConfig {
  tier: CreatorTier;
  name: string;
  minXp: number;
  revenueShare: number;          // 创作者占比
  badgeSlots: number;
  minSubscribers: number;
  icon: string;
}

export interface CreatorProfile {
  userId: string;
  tier: CreatorTier;
  xp: number;
  totalXp: number;
  stats: CreatorStats;
  tierHistory: TierChange[];
  revenueShare: number;
  lastEvaluated: string;
}

export interface TierChange {
  from: CreatorTier;
  to: CreatorTier;
  at: string;
  reason: string;
}

// ── Tier Configuration ────────────────────────────────────────────────────

export const TIER_CONFIGS: Record<CreatorTier, TierConfig> = {
  bronze:    { tier: 'bronze',    name: '青铜', minXp: 0,     revenueShare: 0.70, badgeSlots: 1, minSubscribers: 0,  icon: '🥉' },
  silver:    { tier: 'silver',    name: '白银', minXp: 500,   revenueShare: 0.70, badgeSlots: 2, minSubscribers: 5,  icon: '🥈' },
  gold:      { tier: 'gold',      name: '黄金', minXp: 1500,  revenueShare: 0.80, badgeSlots: 3, minSubscribers: 15, icon: '🥇' },
  platinum:  { tier: 'platinum',  name: '铂金', minXp: 3500,  revenueShare: 0.80, badgeSlots: 4, minSubscribers: 30, icon: '💎' },
  diamond:   { tier: 'diamond',   name: '钻石', minXp: 7500,  revenueShare: 0.90, badgeSlots: 5, minSubscribers: 60, icon: '👑' },
  king:      { tier: 'king',      name: '王者', minXp: 15000, revenueShare: 0.90, badgeSlots: 6, minSubscribers: 100, icon: '🏆' },
};

export const TIER_ORDER: CreatorTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'king'];

// ── XP Calculation ────────────────────────────────────────────────────────

export function calculateXP(stats: CreatorStats): number {
  // AI分析次数 × 50 (上限500)
  const aiXp = Math.min(stats.aiAnalysisCount * 50, 500);

  // 信号订阅数 × 100 (上限1000)
  const subXp = Math.min(stats.signalSubscribers * 100, 1000);

  // 模板销量 × 200 (上限2000)
  const saleXp = Math.min(stats.templateSales * 200, 2000);

  // 7日胜率 × 3000 (0-1 → 0-3000)
  const winXp = Math.round(stats.sevenDayWinRate * 3000);

  // 总收益 × 0.1 (上限1000)
  const revenueXp = Math.min(Math.round(stats.totalRevenue * 0.1), 1000);

  return aiXp + subXp + saleXp + winXp + revenueXp;
}

export function determineTier(xp: number): CreatorTier {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    if (xp >= TIER_CONFIGS[tier].minXp) return tier;
  }
  return 'bronze';
}

// ── Demotion Rules ────────────────────────────────────────────────────────

function shouldDemote(profile: CreatorProfile): { demote: boolean; reason: string } {
  const { stats, tier, xp } = profile;

  // 连续7天亏损 → 降1级
  if (stats.consecutiveLossDays >= 7) {
    return { demote: true, reason: `连续${stats.consecutiveLossDays}天亏损, 降级` };
  }

  // 订阅数跌破最低要求
  const config = TIER_CONFIGS[tier];
  if (stats.signalSubscribers < config.minSubscribers && tier !== 'bronze') {
    return { demote: true, reason: `订阅数${stats.signalSubscribers}低于${config.minSubscribers}要求` };
  }

  // XP 跌破当前等级最低要求
  if (xp < config.minXp && tier !== 'bronze') {
    return { demote: true, reason: `经验${xp}低于${config.minXp}门槛` };
  }

  return { demote: false, reason: '' };
}

function demoteOneTier(tier: CreatorTier): CreatorTier {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx <= 0) return 'bronze';
  return TIER_ORDER[idx - 1];
}

// ── Creator Tier Engine ───────────────────────────────────────────────────

export class CreatorTierEngine {
  private profiles: Map<string, CreatorProfile> = new Map();
  private evaluations: number = 0;

  // ── Core Operations ─────────────────────────────────────────────────────

  createProfile(userId: string): CreatorProfile {
    const profile: CreatorProfile = {
      userId,
      tier: 'bronze',
      xp: 0,
      totalXp: 0,
      stats: this.defaultStats(userId),
      tierHistory: [],
      revenueShare: 0.70,
      lastEvaluated: new Date().toISOString(),
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  private defaultStats(userId: string): CreatorStats {
    return {
      userId, aiAnalysisCount: 0, signalSubscribers: 0, templateSales: 0,
      sevenDayWinRate: 0, totalRevenue: 0, consecutiveLossDays: 0,
    };
  }

  updateStats(userId: string, update: Partial<CreatorStats>): CreatorProfile {
    let profile = this.profiles.get(userId);
    if (!profile) profile = this.createProfile(userId);

    Object.assign(profile.stats, update);
    return this.evaluateTier(userId);
  }

  evaluateTier(userId: string): CreatorProfile {
    const profile = this.profiles.get(userId);
    if (!profile) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Profile not found');

    const xp = calculateXP(profile.stats);
    profile.xp = xp;
    profile.totalXp = Math.max(profile.totalXp, xp);

    const newTier = determineTier(xp);
    const tierIdx = TIER_ORDER.indexOf(profile.tier);
    const newTierIdx = TIER_ORDER.indexOf(newTier);

    // Demotion check
    const { demote, reason } = shouldDemote({ ...profile, tier: profile.tier, xp });
    if (demote && tierIdx > 0) {
      const demotedTier = demoteOneTier(profile.tier);
      profile.tierHistory.push({ from: profile.tier, to: demotedTier, at: new Date().toISOString(), reason });
      profile.tier = demotedTier;
      profile.revenueShare = TIER_CONFIGS[demotedTier].revenueShare;
      profile.lastEvaluated = new Date().toISOString();
      this.profiles.set(userId, profile);
      return profile;
    }

    // Promotion check (skip bronze→bronze)
    if (newTierIdx > tierIdx) {
      profile.tierHistory.push({
        from: profile.tier, to: newTier,
        at: new Date().toISOString(),
        reason: `经验${xp}达到${TIER_CONFIGS[newTier].name}门槛${TIER_CONFIGS[newTier].minXp}`,
      });
      profile.tier = newTier;
      profile.revenueShare = TIER_CONFIGS[newTier].revenueShare;
    }

    profile.lastEvaluated = new Date().toISOString();
    this.evaluations++;
    this.profiles.set(userId, profile);
    return profile;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  getProfile(userId: string): CreatorProfile | undefined {
    return this.profiles.get(userId);
  }

  getOrCreateProfile(userId: string): CreatorProfile {
    return this.profiles.get(userId) ?? this.createProfile(userId);
  }

  getAllProfiles(): CreatorProfile[] {
    return [...this.profiles.values()];
  }

  getTopByRevenue(limit: number = 10): CreatorProfile[] {
    return this.getAllProfiles()
      .sort((a, b) => b.stats.totalRevenue - a.stats.totalRevenue)
      .slice(0, limit);
  }

  getTopBySubscribers(limit: number = 10): CreatorProfile[] {
    return this.getAllProfiles()
      .sort((a, b) => b.stats.signalSubscribers - a.stats.signalSubscribers)
      .slice(0, limit);
  }

  getTopByWinRate(limit: number = 10): CreatorProfile[] {
    return this.getAllProfiles()
      .sort((a, b) => b.stats.sevenDayWinRate - a.stats.sevenDayWinRate)
      .slice(0, limit);
  }

  getByTier(tier: CreatorTier): CreatorProfile[] {
    return this.getAllProfiles().filter(p => p.tier === tier);
  }

  getTierStats(): Record<CreatorTier, { count: number; totalRevenue: number }> {
    const result: Record<string, { count: number; totalRevenue: number }> = {};
    for (const tier of TIER_ORDER) result[tier] = { count: 0, totalRevenue: 0 };
    for (const p of this.getAllProfiles()) {
      result[p.tier].count++;
      result[p.tier].totalRevenue += p.stats.totalRevenue;
    }
    return result as Record<CreatorTier, { count: number; totalRevenue: number }>;
  }

  // ── Revenue Split ──────────────────────────────────────────────────────

  getRevenueSplit(userId: string): { creator: number; platform: number; tier: CreatorTier } {
    const profile = this.getProfile(userId);
    if (!profile) return { creator: 0.70, platform: 0.30, tier: 'bronze' };
    return {
      creator: profile.revenueShare,
      platform: Number((1 - profile.revenueShare).toFixed(4)),
      tier: profile.tier,
    };
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  getEvaluationCount(): number {
    return this.evaluations;
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.profiles.clear();
    this.evaluations = 0;
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _engine: CreatorTierEngine | null = null;

export function getTierEngine(): CreatorTierEngine {
  if (!_engine) _engine = new CreatorTierEngine();
  return _engine;
}

export function resetTierEngine(): void {
  _engine?.reset();
  _engine = null;
}

export default { CreatorTierEngine, getTierEngine, resetTierEngine, TIER_CONFIGS, TIER_ORDER, calculateXP, determineTier };
