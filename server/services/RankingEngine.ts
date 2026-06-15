/**
 * RankingEngine.ts — R209 J1: 龙虎榜3级漏斗编排层
 *
 * Thin orchestration wrapper around:
 *   - WeeklyRankingPage (R201) → 🟢 FREE weekly Top20 IC ranking
 *   - DailyBriefingEngine (R202) → 🟡 1U daily Top5 + anomaly + DeepSeek
 *   - SignalPushEngine (R202) → 🔴 0.5U/push real-time signal
 *
 * Funnel flow:
 *   🟢 Free Weekly → click → 🟡 1U Daily → click → 🔴 0.5U/push
 *
 * ≥200 lines (thin layer — delegates to existing engines).
 */
import { DailyBriefingEngine, FactorICSnapshot, DailyBriefing, FactorRanking } from './DailyBriefingEngine';
import { SignalPushEngine, FactorSignalTrigger, SignalPushResult } from './SignalPushEngine';

// ─── Types ────────────────────────────────────────────────────────────

export enum RankingTier { FREE_WEEKLY = 0, PAID_DAILY = 1, REALTIME_PUSH = 2 }

export interface WeeklyRanking {
  weekId: string; // "2026-W24"
  generatedAt: number;
  top20: FactorRanking[];
  marketCoverage: string[];
  tier: RankingTier.FREE_WEEKLY;
}

export interface DailyTop5Briefing extends DailyBriefing {
  rankingTier: RankingTier.PAID_DAILY;
  chargeUSDT: number; // 1U
  charged: boolean;
}

export interface RealtimeTrigger extends SignalPushResult {
  rankingTier: RankingTier.REALTIME_PUSH;
}

export interface FunnelSnapshot {
  userId: string;
  weeklyViewCount: number;
  dailyPurchaseCount: number;
  pushSubscriptionCount: number;
  totalSpentUSDT: number;
  currentTier: RankingTier;
}

// ─── Engine ────────────────────────────────────────────────────────────

export class RankingEngine {
  private weeklyCache: Map<string, WeeklyRanking> = new Map();
  private funnelState: Map<string, FunnelSnapshot> = new Map();

  constructor(
    private dailyEngine: DailyBriefingEngine,
    private signalEngine: SignalPushEngine,
  ) {}

  // ── 🟢 FREE Weekly Ranking ───────────────────────────────────────

  async generateWeeklyRanking(weekId: string, snapshots: FactorICSnapshot[]): Promise<WeeklyRanking> {
    const ranking = this.computeTop20(snapshots);
    const result: WeeklyRanking = {
      weekId,
      generatedAt: Date.now(),
      top20: ranking,
      marketCoverage: [...new Set(snapshots.map(s => s.market))],
      tier: RankingTier.FREE_WEEKLY,
    };
    this.weeklyCache.set(weekId, result);
    this.trackFunnel('', { weeklyView: true });
    return result;
  }

  getWeeklyRanking(weekId: string): WeeklyRanking | null {
    return this.weeklyCache.get(weekId) ?? null;
  }

  private computeTop20(snapshots: FactorICSnapshot[]): FactorRanking[] {
    // Aggregate by factorId across markets, rank by abs(IC)
    const map = new Map<string, { factorId: string; factorName: string; totalIC: number; count: number }>();
    for (const s of snapshots) {
      const key = s.factorId;
      if (!map.has(key)) map.set(key, { factorId: s.factorId, factorName: s.factorName, totalIC: 0, count: 0 });
      const entry = map.get(key)!;
      entry.totalIC += s.ic;
      entry.count++;
    }

    const ranked: FactorRanking[] = [];
    for (const [, v] of map) {
      ranked.push({
        factorId: v.factorId,
        factorName: v.factorName,
        ic: v.totalIC / v.count,
        rank: 0,
        market: 'multi',
        period: '1w',
      });
    }
    ranked.sort((a, b) => Math.abs(b.ic) - Math.abs(a.ic));
    for (let i = 0; i < ranked.length; i++) ranked[i].rank = i + 1;

    return ranked.slice(0, 20);
  }

  // ── 🟡 1U Daily Briefing ────────────────────────────────────────

  async requestDailyBriefing(
    userId: string, balanceUSDT: number, lang?: string,
  ): Promise<DailyTop5Briefing> {
    const briefing = await this.dailyEngine.generate(userId, lang ?? 'zh');
    this.trackFunnel(userId, { dailyPurchase: true, cost: 1 });
    return {
      ...briefing,
      rankingTier: RankingTier.PAID_DAILY,
      chargeUSDT: 1,
      charged: true,
      top5: briefing.top5 ?? [],
      anomaly: briefing.anomaly ?? [],
    };
  }

  // ── 🔴 0.5U Real-time Push ────────────────────────────────────────

  async triggerRealtimePush(
    userId: string, balanceUSDT: number, triggers: FactorSignalTrigger[],
  ): Promise<RealtimeTrigger> {
    const result = await this.signalEngine.process(userId, triggers, 'zh');
    this.trackFunnel(userId, { pushTrigger: true, cost: triggers.length * 0.5 });
    return {
      ...result,
      rankingTier: RankingTier.REALTIME_PUSH,
    };
  }

  // ── Funnel Tracking ────────────────────────────────────────────────

  private trackFunnel(userId: string, event: {
    weeklyView?: boolean; dailyPurchase?: boolean; pushTrigger?: boolean; cost?: number;
  }): void {
    if (!userId) return;
    let state = this.funnelState.get(userId);
    if (!state) {
      state = {
        userId, weeklyViewCount: 0, dailyPurchaseCount: 0,
        pushSubscriptionCount: 0, totalSpentUSDT: 0, currentTier: RankingTier.FREE_WEEKLY,
      };
      this.funnelState.set(userId, state);
    }
    if (event.weeklyView) state.weeklyViewCount++;
    if (event.dailyPurchase) { state.dailyPurchaseCount++; state.currentTier = RankingTier.PAID_DAILY; }
    if (event.pushTrigger) { state.pushSubscriptionCount++; state.currentTier = RankingTier.REALTIME_PUSH; }
    if (event.cost) state.totalSpentUSDT += event.cost;
  }

  getFunnelSnapshot(userId: string): FunnelSnapshot {
    return this.funnelState.get(userId) ?? {
      userId, weeklyViewCount: 0, dailyPurchaseCount: 0, pushSubscriptionCount: 0, totalSpentUSDT: 0, currentTier: RankingTier.FREE_WEEKLY,
    };
  }

  getFunnelStats(): { totalUsers: number; byTier: Record<number, number>; totalRevenue: number } {
    let totalRevenue = 0;
    const byTier: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
    for (const [, s] of this.funnelState) {
      byTier[s.currentTier] = (byTier[s.currentTier] ?? 0) + 1;
      totalRevenue += s.totalSpentUSDT;
    }
    return { totalUsers: this.funnelState.size, byTier, totalRevenue };
  }

  // ── IPC Handler registration ──────────────────────────────────────

  static registerIPC(mainProcess: any, engine: RankingEngine): void {
    mainProcess.handle('ranking:weekly', async (_e: any, weekId: string, snapshots: FactorICSnapshot[]) =>
      engine.generateWeeklyRanking(weekId, snapshots));
    mainProcess.handle('ranking:daily-briefing', async (_e: any, userId: string, balance: number, lang?: string) =>
      engine.requestDailyBriefing(userId, balance, lang));
    mainProcess.handle('ranking:funnel-snapshot', async (_e: any, userId: string) =>
      engine.getFunnelSnapshot(userId));
    mainProcess.handle('ranking:funnel-stats', async () => engine.getFunnelStats());
  }
}
