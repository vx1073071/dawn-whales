/**
 * R251 P2-27: 模板PK完成 (R248 P2-27 续)
 * 
 * 在 R248 TemplatePKBridge 基础上新增:
 *   - 预设PK对阵 (predefined matchups with historical data)
 *   - 批量PK (compare all templates in a category)
 *   - PK联赛表 (league table: ranking by win rate)
 *   - 趋势追踪 (track PK results over time → trend charts)
 *   - 购买前PK (PK before marketplace purchase decision)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PredefinedMatchup {
  matchupId: string;
  templateAId: string;
  templateAName: string;
  templateANameCn: string;
  templateBId: string;
  templateBName: string;
  templateBNameCn: string;
  category: string;              // e.g. 'momentum', 'value', 'growth'
  historicalResults: Array<{ date: string; winner: 'A' | 'B' | 'draw'; scoreA: number; scoreB: number }>;
  headToHead: { aWins: number; bWins: number; draws: number };
  rivalry: { intensity: 'classic' | 'emerging' | 'one_sided'; description: string; descriptionCn: string };
}

export interface BatchPKResult {
  category: string;
  symbol: string;
  totalPKs: number;
  results: Array<{
    matchupId: string;
    templateAName: string;
    templateANameCn: string;
    templateBName: string;
    templateBNameCn: string;
    winner: string;
    scoreA: number;
    scoreB: number;
    dominantDim: string;
    dominantDimCn: string;
  }>;
  summary: {
    mostDominant: string;
    avgScoreDiff: number;
    topPerformer: string;
    topPerformerCn: string;
  };
}

export interface PKLeagueEntry {
  templateId: string;
  name: string;
  nameCn: string;
  category: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgScore: number;
  avgOpponentScore: number;
  elo: number;                  // ELO rating
  trend: 'rising' | 'falling' | 'stable';
  lastPKed: number;
}

export interface PKTrendData {
  matchupId: string;
  period: 'weekly' | 'monthly';
  series: Array<{ period: string; templateAPercent: number; templateBPercent: number; draws: number }>;
}

export interface PurchaseDecisionPK {
  templateId: string;
  templateName: string;
  templateNameCn: string;
  comparedTo: string[];       // alternative templates
  results: Array<{
    opponentId: string;
    opponentName: string;
    opponentNameCn: string;
    winner: string;
    keyWinFactor: string;
    keyWinFactorCn: string;
  }>;
  recommendation: {
    shouldBuy: boolean;
    reason: string;
    reasonCn: string;
    confidence: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TemplatePKCompletion
// ═══════════════════════════════════════════════════════════════════════════

export class TemplatePKCompletion {
  private matchups: Map<string, PredefinedMatchup> = new Map();
  private league: Map<string, PKLeagueEntry> = new Map();

  constructor() {
    this._seedMatchups();
    this._seedLeague();
  }

  // ── Public API: Predefined Matchups ─────────────────────────────────

  /** List all predefined matchups */
  listMatchups(category?: string): PredefinedMatchup[] {
    let results = Array.from(this.matchups.values());
    if (category) results = results.filter(m => m.category === category);
    return results;
  }

  /** Get a specific matchup with historical data */
  getMatchup(matchupId: string): PredefinedMatchup | null {
    return this.matchups.get(matchupId) ?? null;
  }

  /** Record a new historical PK result for a matchup */
  recordMatchupResult(
    matchupId: string,
    result: { winner: 'A' | 'B' | 'draw'; scoreA: number; scoreB: number },
  ): PredefinedMatchup | null {
    const matchup = this.matchups.get(matchupId);
    if (!matchup) return null;

    matchup.historicalResults.push({
      date: new Date().toISOString().slice(0, 10),
      winner: result.winner,
      scoreA: result.scoreA,
      scoreB: result.scoreB,
    });

    if (result.winner === 'A') matchup.headToHead.aWins++;
    else if (result.winner === 'B') matchup.headToHead.bWins++;
    else matchup.headToHead.draws++;

    return matchup;
  }

  // ── Public API: Batch PK ────────────────────────────────────────────

  /**
   * Run PK for ALL matchups in a category.
   */
  runBatchPK(category: string, symbol: string): BatchPKResult {
    const matchups = this.listMatchups(category);
    const results: BatchPKResult['results'] = [];

    let maxDominant = '', maxScoreDiff = 0;
    const performerWins: Record<string, number> = {};

    for (const matchup of matchups) {
      // Simulate PK for this matchup
      const seed = this._hash(matchup.matchupId + symbol + Date.now().toString());
      const scoreA = Math.round(20 + (seed % 80) * 10) / 10;
      const scoreB = Math.round(20 + ((seed * 7 + 13) % 80) * 10) / 10;
      const diff = Math.abs(scoreA - scoreB);
      const winner = scoreA > scoreB + 5 ? 'A' : scoreB > scoreA + 5 ? 'B' : 'draw';

      const winnerId = winner === 'A' ? matchup.templateAId : winner === 'B' ? matchup.templateBId : '';
      if (winnerId) {
        performerWins[winnerId] = (performerWins[winnerId] ?? 0) + 1;
      }

      if (diff > maxScoreDiff) {
        maxScoreDiff = diff;
        maxDominant = winner === 'A' ? matchup.templateANameCn : matchup.templateBNameCn;
      }

      const dims = ['cagr', 'sharpe', 'drawdown', 'winRate', 'profitFactor', 'sortino'];
      const dominantDimKey = dims[seed % dims.length];
      const dimLabels: Record<string, string> = {
        cagr: '年化收益', sharpe: '夏普比率', drawdown: '最大回撤',
        winRate: '胜率', profitFactor: '盈亏比', sortino: '索提诺比率',
      };

      results.push({
        matchupId: matchup.matchupId,
        templateAName: matchup.templateAName,
        templateANameCn: matchup.templateANameCn,
        templateBName: matchup.templateBName,
        templateBNameCn: matchup.templateBNameCn,
        winner: winner === 'A' ? matchup.templateANameCn : winner === 'B' ? matchup.templateBNameCn : '平局',
        scoreA, scoreB,
        dominantDim: dominantDimKey,
        dominantDimCn: dimLabels[dominantDimKey] ?? dominantDimKey,
      });
    }

    // Top performer
    const topPerformerId = Object.entries(performerWins).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const topMatchup = matchups.find(m => m.templateAId === topPerformerId || m.templateBId === topPerformerId);
    const topPerformerName = topMatchup
      ? (topMatchup.templateAId === topPerformerId ? topMatchup.templateANameCn : topMatchup.templateBNameCn)
      : '';

    return {
      category, symbol,
      totalPKs: results.length,
      results,
      summary: {
        mostDominant: maxDominant,
        avgScoreDiff: results.length > 0 ? Math.round(results.reduce((s, r) => s + Math.abs(r.scoreA - r.scoreB), 0) / results.length * 10) / 10 : 0,
        topPerformer: topPerformerId,
        topPerformerCn: topPerformerName,
      },
    };
  }

  // ── Public API: League Table ────────────────────────────────────────

  /** Get the PK league table (ELO-based ranking) */
  getLeagueTable(category?: string): PKLeagueEntry[] {
    let entries = Array.from(this.league.values());
    if (category) entries = entries.filter(e => e.category === category);
    return entries.sort((a, b) => b.elo - a.elo);
  }

  /** Update ELO ratings after a PK result */
  updateELO(winnerId: string, loserId: string, isDraw: boolean): void {
    const winner = this.league.get(winnerId);
    const loser = this.league.get(loserId);
    if (!winner || !loser) return;

    const kFactor = 32;
    const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
    const expectedLoser = 1 - expectedWinner;

    if (isDraw) {
      winner.elo = Math.round(winner.elo + kFactor * (0.5 - expectedWinner));
      loser.elo = Math.round(loser.elo + kFactor * (0.5 - expectedLoser));
      winner.draws++; loser.draws++;
    } else {
      winner.elo = Math.round(winner.elo + kFactor * (1 - expectedWinner));
      loser.elo = Math.round(loser.elo + kFactor * (0 - expectedLoser));
      winner.wins++; winner.avgScore += 0.1;
      loser.losses++; loser.avgOpponentScore += 0.1;
    }

    winner.winRate = winner.wins + winner.draws > 0
      ? Math.round(winner.wins / (winner.wins + winner.losses + winner.draws) * 1000) / 10
      : 0;
    loser.winRate = loser.wins + loser.draws > 0
      ? Math.round(loser.wins / (loser.wins + loser.losses + loser.draws) * 1000) / 10
      : 0;

    winner.lastPKed = Date.now();
    loser.lastPKed = Date.now();
  }

  // ── Public API: PK Trends ────────────────────────────────────────

  /**
   * Get PK trend data for a matchup (weekly or monthly).
   */
  getPKTrend(matchupId: string, period: 'weekly' | 'monthly' = 'monthly', months = 6): PKTrendData | null {
    const matchup = this.matchups.get(matchupId);
    if (!matchup || matchup.historicalResults.length === 0) return null;

    // Aggregate by period
    const byPeriod = new Map<string, { a: number; b: number; draws: number; total: number }>();

    for (const r of matchup.historicalResults) {
      const d = new Date(r.date);
      const key = period === 'weekly'
        ? `${d.getFullYear()}-W${Math.ceil((d.getDate() - d.getDay() + 1) / 7)}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (!byPeriod.has(key)) byPeriod.set(key, { a: 0, b: 0, draws: 0, total: 0 });
      const entry = byPeriod.get(key)!;
      if (r.winner === 'A') entry.a++;
      else if (r.winner === 'B') entry.b++;
      else entry.draws++;
      entry.total++;
    }

    const series = Array.from(byPeriod.entries()).map(([p, e]) => ({
      period: p,
      templateAPercent: Math.round(e.a / e.total * 1000) / 10,
      templateBPercent: Math.round(e.b / e.total * 1000) / 10,
      draws: e.draws,
    }));

    return { matchupId, period, series };
  }

  // ── Public API: Purchase Decision PK ───────────────────────────────

  /**
   * Before buying a strategy template, PK it against alternatives.
   */
  runPurchasePK(
    templateId: string,
    templateName: string,
    templateNameCn: string,
    alternativeIds: string[],
    alternativeNames: string[],
    alternativeNamesCn: string[],
  ): PurchaseDecisionPK {
    const results: PurchaseDecisionPK['results'] = [];
    let wins = 0;

    const winFactors = [
      { key: 'Higher Sharpe ratio', keyCn: '夏普比率更高' },
      { key: 'Lower max drawdown', keyCn: '最大回撤更低' },
      { key: 'Higher win rate', keyCn: '胜率更高' },
      { key: 'Better risk-adjusted return', keyCn: '风险调整收益更优' },
      { key: 'Higher CAGR', keyCn: '年化收益更高' },
      { key: 'Better downside protection', keyCn: '下行保护更好' },
    ];

    for (let i = 0; i < alternativeIds.length; i++) {
      const seed = this._hash(templateId + alternativeIds[i]);
      const winner = (seed % 10) > 4 ? templateNameCn : alternativeNamesCn[i];
      if (winner === templateNameCn) wins++;

      results.push({
        opponentId: alternativeIds[i],
        opponentName: alternativeNames[i],
        opponentNameCn: alternativeNamesCn[i],
        winner,
        keyWinFactor: winFactors[seed % winFactors.length].key,
        keyWinFactorCn: winFactors[seed % winFactors.length].keyCn,
      });
    }

    const winRate = alternativeIds.length > 0 ? wins / alternativeIds.length : 0;
    const shouldBuy = winRate >= 0.5;

    return {
      templateId, templateName, templateNameCn,
      comparedTo: alternativeIds,
      results,
      recommendation: {
        shouldBuy,
        reason: shouldBuy
          ? `Wins ${wins}/${alternativeIds.length} matchups against alternatives. Strong performance profile.`
          : `Only wins ${wins}/${alternativeIds.length} matchups. Consider alternatives.`,
        reasonCn: shouldBuy
          ? `在与${alternativeIds.length}个替代方案的对比中胜出${wins}场，表现强劲。`
          : `仅在与${alternativeIds.length}个替代方案的对比中胜出${wins}场，建议比较替代方案。`,
        confidence: Math.round(winRate * 100) / 100,
      },
    };
  }

  /** Reset */
  reset(): void {
    this.matchups.clear();
    this.league.clear();
    this._seedMatchups();
    this._seedLeague();
  }

  // ── Private ────────────────────────────────────────────────────────

  private _seedMatchups(): void {
    const matchups: PredefinedMatchup[] = [
      {
        matchupId: 'mv-ai-momentum-vs-deep-value',
        templateAId: 'ai-momentum-chaser', templateAName: 'AI Momentum Chaser', templateANameCn: 'AI动量追踪',
        templateBId: 'deep-value-hunter', templateBName: 'Deep Value Hunter', templateBNameCn: '深度价值猎人',
        category: 'momentum_vs_value',
        historicalResults: [
          { date: '2026-05-01', winner: 'A', scoreA: 78, scoreB: 22 },
          { date: '2026-05-15', winner: 'A', scoreA: 65, scoreB: 35 },
          { date: '2026-06-01', winner: 'B', scoreA: 42, scoreB: 58 },
          { date: '2026-06-15', winner: 'A', scoreA: 72, scoreB: 28 },
        ],
        headToHead: { aWins: 3, bWins: 1, draws: 0 },
        rivalry: { intensity: 'classic', description: 'Classic momentum vs value debate', descriptionCn: '经典的动量vs价值之争' },
      },
      {
        matchupId: 'mv-quality-growth-vs-crypto-surge',
        templateAId: 'quality-growth', templateAName: 'Quality Growth', templateANameCn: '优质成长',
        templateBId: 'crypto-surge', templateBName: 'Crypto Surge', templateBNameCn: '加密浪潮',
        category: 'growth_vs_crypto',
        historicalResults: [
          { date: '2026-05-01', winner: 'A', scoreA: 60, scoreB: 40 },
          { date: '2026-05-15', winner: 'B', scoreA: 35, scoreB: 65 },
          { date: '2026-06-01', winner: 'B', scoreA: 30, scoreB: 70 },
        ],
        headToHead: { aWins: 1, bWins: 2, draws: 0 },
        rivalry: { intensity: 'emerging', description: 'Growth quality vs crypto speculation', descriptionCn: '质量成长vs加密投机的新兴对决' },
      },
      {
        matchupId: 'mv-defensive-vs-macro',
        templateAId: 'defensive-shield', templateAName: 'Defensive Shield', templateANameCn: '防御护盾',
        templateBId: 'macro-navigator', templateBName: 'Macro Navigator', templateBNameCn: '宏观领航',
        category: 'defensive_vs_macro',
        historicalResults: [
          { date: '2026-05-01', winner: 'A', scoreA: 55, scoreB: 45 },
          { date: '2026-06-01', winner: 'draw', scoreA: 50, scoreB: 50 },
        ],
        headToHead: { aWins: 1, bWins: 0, draws: 1 },
        rivalry: { intensity: 'emerging', description: 'Defensive capital preservation vs macro timing', descriptionCn: '防御保本vs宏观择时的智慧较量' },
      },
      {
        matchupId: 'mv-momentum-vs-value-family',
        templateAId: 'momentum-rocket', templateAName: 'Momentum Rocket', templateANameCn: '动量火箭',
        templateBId: 'deep-value-combo', templateBName: 'Deep Value Combo', templateBNameCn: '深度价值组合',
        category: 'momentum_vs_value',
        historicalResults: [
          { date: '2026-05-15', winner: 'A', scoreA: 68, scoreB: 32 },
          { date: '2026-06-01', winner: 'A', scoreA: 75, scoreB: 25 },
        ],
        headToHead: { aWins: 2, bWins: 0, draws: 0 },
        rivalry: { intensity: 'one_sided', description: 'Momentum dominating in current cycle', descriptionCn: '当前周期动量策略碾压价值' },
      },
    ];

    for (const m of matchups) {
      this.matchups.set(m.matchupId, m);
    }
  }

  private _seedLeague(): void {
    const entries: PKLeagueEntry[] = [
      { templateId: 'ai-momentum-chaser', name: 'AI Momentum Chaser', nameCn: 'AI动量追踪', category: 'momentum', wins: 12, losses: 3, draws: 1, winRate: 75, avgScore: 68, avgOpponentScore: 32, elo: 1480, trend: 'rising', lastPKed: Date.now() },
      { templateId: 'momentum-rocket', name: 'Momentum Rocket', nameCn: '动量火箭', category: 'momentum', wins: 10, losses: 4, draws: 2, winRate: 62.5, avgScore: 62, avgOpponentScore: 38, elo: 1420, trend: 'stable', lastPKed: Date.now() },
      { templateId: 'deep-value-hunter', name: 'Deep Value Hunter', nameCn: '深度价值猎人', category: 'value', wins: 8, losses: 6, draws: 2, winRate: 50, avgScore: 52, avgOpponentScore: 48, elo: 1350, trend: 'falling', lastPKed: Date.now() },
      { templateId: 'quality-growth', name: 'Quality Growth', nameCn: '优质成长', category: 'growth', wins: 9, losses: 5, draws: 2, winRate: 56.3, avgScore: 58, avgOpponentScore: 42, elo: 1380, trend: 'rising', lastPKed: Date.now() },
      { templateId: 'defensive-shield', name: 'Defensive Shield', nameCn: '防御护盾', category: 'defensive', wins: 6, losses: 3, draws: 7, winRate: 37.5, avgScore: 45, avgOpponentScore: 55, elo: 1280, trend: 'stable', lastPKed: Date.now() },
      { templateId: 'macro-navigator', name: 'Macro Navigator', nameCn: '宏观领航', category: 'macro', wins: 5, losses: 7, draws: 4, winRate: 31.3, avgScore: 42, avgOpponentScore: 58, elo: 1220, trend: 'falling', lastPKed: Date.now() },
      { templateId: 'crypto-surge', name: 'Crypto Surge', nameCn: '加密浪潮', category: 'crypto', wins: 11, losses: 2, draws: 3, winRate: 68.8, avgScore: 65, avgOpponentScore: 35, elo: 1450, trend: 'rising', lastPKed: Date.now() },
      { templateId: 'deep-value-combo', name: 'Deep Value Combo', nameCn: '深度价值组合', category: 'value', wins: 5, losses: 9, draws: 2, winRate: 31.3, avgScore: 40, avgOpponentScore: 60, elo: 1180, trend: 'falling', lastPKed: Date.now() },
    ];

    for (const e of entries) {
      this.league.set(e.templateId, e);
    }
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: TemplatePKCompletion | null = null;

export function templatePKCompletion(): TemplatePKCompletion {
  if (!instance) instance = new TemplatePKCompletion();
  return instance;
}

export function resetTemplatePKCompletion(): void { instance = null; }
