// ── Q42: Transaction Cost Analytics v2 ───────────────────────────────────────
// IB/Commission comparison + Venue analysis + Best venue suggestion
// Execution quality scoring + Time-of-day analysis

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExecutionRecord {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  venue: string;
  timestamp: number;
  commission: number;
  slippage: number;
  marketImpact: number;
  effectiveSpread: number;
  fillQuality: 'BEST' | 'GOOD' | 'ACCEPTABLE' | 'POOR';
  arrivalPrice: number;
  realizedSpread: number;
}

export interface VenueMetrics {
  venue: string;
  region: 'HK' | 'US' | 'CN' | 'INTL';
  avgCommission: number;
  avgSlippage: number;
  avgMarketImpact: number;
  fillRate: number;         // % of orders filled
  adverseSelection: number; // Price impact vs. fair price
  score: number;            // 0-100 quality score
  bestFor: string[];        // 'large_order' | 'small_order' | 'illiquid'
}

export interface TimeOfDayAnalysis {
  window: string;           // 'open_auction' | 'continuous' | 'close_auction' | 'after_hours'
  avgSlippage: number;
  avgSpread: number;
  fillRate: number;
  volumeShare: number;      // % of daily volume in this window
  recommendation: string;
}

export interface TCAReportV2 {
  period: { start: string; end: string };
  nExecutions: number;
  
  // Overall metrics
  totalCosts: number;
  costPerShare: number;
  costBp: number;
  estimatedMarketImpact: number;
  avgSlippage: number;
  avgSpread: number;

  // Venue comparison
  venues: VenueMetrics[];
  bestVenue: string;
  worstVenue: string;

  // Time analysis
  timeAnalysis: TimeOfDayAnalysis[];

  // Execution quality
  qualityDistribution: Record<string, number>;
  avgFillQuality: number;

  // Symbols breakdown
  costliestSymbols: Array<{ symbol: string; cost: number; nTrades: number }>;

  // Recommendations
  venueSuggestions: Record<string, string>;
  timingAdvice: string[];
  overallGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  timestamp: number;
}

// ── Venue Profiles ────────────────────────────────────────────────────────

const VENUE_PROFILES: Record<string, { region: string; baseCommission: number; quality: number; bestFor: string[] }> = {
  FUTU_HK: { region: 'HK', baseCommission: 0.0003, quality: 85, bestFor: ['small_order', 'liquid'] },
  HSBC_HK: { region: 'HK', baseCommission: 0.0005, quality: 80, bestFor: ['large_order', 'institutional'] },
  IB_HK: { region: 'HK', baseCommission: 0.0002, quality: 88, bestFor: ['small_order', 'large_order'] },
  TIGER: { region: 'HK', baseCommission: 0.0003, quality: 75, bestFor: ['small_order'] },
  MOOMOO: { region: 'HK', baseCommission: 0.0003, quality: 78, bestFor: ['small_order', 'medium_order'] },
  FUTU_US: { region: 'US', baseCommission: 0.0035, quality: 90, bestFor: ['large_order', 'illiquid'] },
  IB_US: { region: 'US', baseCommission: 0.001, quality: 92, bestFor: ['large_order', 'small_order'] },
  RH_US: { region: 'US', baseCommission: 0, quality: 82, bestFor: ['small_order', 'retail'] },
  FUTU_CN: { region: 'CN', baseCommission: 0.0003, quality: 72, bestFor: ['small_order'] },
  CITIC_CN: { region: 'CN', baseCommission: 0.0002, quality: 78, bestFor: ['large_order'] },
};

// ── Time Windows ────────────────────────────────────────────────────────

const HK_TIME_WINDOWS = [
  { name: 'open_auction', start: '09:00', end: '09:30', type: 'auction' },
  { name: 'early_continuous', start: '09:30', end: '12:00', type: 'continuous' },
  { name: 'lunch', start: '12:00', end: '13:00', type: 'closed' },
  { name: 'afternoon', start: '13:00', end: '16:00', type: 'continuous' },
  { name: 'close_auction', start: '16:00', end: '16:10', type: 'auction' },
  { name: 'after_hours', start: '16:10', end: '23:59', type: 'after' },
];

// ── TCA v2 ─────────────────────────────────────────────────────────────

export class TCAEngineV2 {
  constructor() {
    log.info('[TCAEngineV2] Initialized');
  }

  // ── Analyze Executions ──────────────────────────────────────────────

  analyze(executions: ExecutionRecord[]): TCAReportV2 {
    if (executions.length === 0) return this.emptyReport();

    const now = new Date();
    const timestamps = executions.map(e => e.timestamp).sort((a, b) => a - b);

    // Overall metrics
    const totalCosts = executions.reduce((s, e) =>
      s + e.commission + Math.abs(e.slippage) + Math.abs(e.marketImpact), 0);
    const totalShares = executions.reduce((s, e) => s + e.quantity, 0);
    const notional = executions.reduce((s, e) => s + e.quantity * e.price, 0);
    const costPerShare = totalShares > 0 ? totalCosts / totalShares : 0;
    const costBp = notional > 0 ? (totalCosts / notional) * 10000 : 0;
    const avgSlippage = executions.reduce((s, e) => s + Math.abs(e.slippage), 0) / executions.length;
    const avgSpread = executions.reduce((s, e) => s + e.effectiveSpread, 0) / executions.length;
    const estimatedMarketImpact = executions.reduce((s, e) => s + Math.abs(e.marketImpact), 0) / executions.length;

    // Venue analysis
    const byVenue = new Map<string, ExecutionRecord[]>();
    for (const ex of executions) {
      const arr = byVenue.get(ex.venue) ?? [];
      arr.push(ex);
      byVenue.set(ex.venue, arr);
    }

    const venues: VenueMetrics[] = [];
    for (const [venue, exs] of byVenue) {
      const profile = VENUE_PROFILES[venue];
      const avgComm = exs.reduce((s, e) => s + e.commission, 0) / exs.length;
      const avgSlip = exs.reduce((s, e) => s + Math.abs(e.slippage), 0) / exs.length;
      const avgImpact = exs.reduce((s, e) => s + Math.abs(e.marketImpact), 0) / exs.length;
      const fillRate = exs.filter(e => e.fillQuality !== 'POOR').length / exs.length;
      const adverseSel = exs.reduce((s, e) => s + Math.abs(e.realizedSpread - e.effectiveSpread), 0) / exs.length;

      // Score: quality weight 40%, cost weight 30%, fill rate 20%, adverse selection 10%
      const baseScore = profile?.quality ?? 70;
      const costScore = avgComm < 0.001 ? 30 : avgComm < 0.003 ? 20 : 10;
      const fillScore = fillRate * 20;
      const asScore = Math.max(0, 10 - adverseSel * 1000);
      const score = baseScore * 0.4 + costScore + fillScore + asScore;

      venues.push({
        venue,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        region: (profile?.region as any) ?? 'INTL',
        avgCommission: Math.round(avgComm * 10000) / 100,
        avgSlippage: Math.round(avgSlip * 10000) / 100,
        avgMarketImpact: Math.round(avgImpact * 10000) / 100,
        fillRate: Math.round(fillRate * 10000) / 100,
        adverseSelection: Math.round(adverseSel * 10000) / 100,
        score: Math.round(score),
        bestFor: profile?.bestFor ?? ['liquid'],
      });
    }

    venues.sort((a, b) => b.score - a.score);
    const bestVenue = venues[0]?.venue ?? 'UNKNOWN';
    const worstVenue = venues[venues.length - 1]?.venue ?? 'UNKNOWN';

    // Time-of-day analysis
    const timeAnalysis = this.analyzeTimeOfDay(executions);

    // Quality distribution
    const qualityDist: Record<string, number> = { BEST: 0, GOOD: 0, ACCEPTABLE: 0, POOR: 0 };
    for (const ex of executions) {
      qualityDist[ex.fillQuality] = (qualityDist[ex.fillQuality] ?? 0) + 1;
    }
    for (const k of Object.keys(qualityDist)) {
      qualityDist[k] = Math.round((qualityDist[k] / executions.length) * 10000) / 100;
    }

    const qualityScoreMap: Record<string, number> = { BEST: 1, GOOD: 0.75, ACCEPTABLE: 0.5, POOR: 0.25 };
    const avgFillQuality = Object.entries(qualityDist)
      .reduce((s, [k, v]) => s + (qualityScoreMap[k] ?? 0) * v / 100, 0);

    // Costliest symbols
    const bySymbol = new Map<string, { cost: number; n: number }>();
    for (const ex of executions) {
      const cost = ex.commission + Math.abs(ex.slippage) + Math.abs(ex.marketImpact);
      const prev = bySymbol.get(ex.symbol) ?? { cost: 0, n: 0 };
      bySymbol.set(ex.symbol, { cost: prev.cost + cost, n: prev.n + 1 });
    }
    const costliestSymbols = [...bySymbol.entries()]
      .map(([symbol, data]) => ({ symbol, cost: Math.round(data.cost * 100) / 100, nTrades: data.n }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // Venue suggestions
    const venueSuggestions: Record<string, string> = {};
    for (const venue of byVenue.keys()) {
      const exs = byVenue.get(venue)!;
      const avgSlip = exs.reduce((s, e) => s + Math.abs(e.slippage), 0) / exs.length;
      const avgImpact = exs.reduce((s, e) => s + Math.abs(e.marketImpact), 0) / exs.length;

      if (avgSlip > avgSlippage * 1.5) {
        venueSuggestions[venue] = 'High slippage detected — consider limit orders or alternative venue';
      } else if (avgImpact > estimatedMarketImpact * 2) {
        venueSuggestions[venue] = 'High market impact — split large orders or use VWAP';
      } else {
        venueSuggestions[venue] = '✅ Execution quality acceptable for this venue';
      }
    }

    // Timing advice
    const timingAdvice: string[] = [];
    const openAnalysis = timeAnalysis.find(t => t.window === 'open_auction');
    const closeAnalysis = timeAnalysis.find(t => t.window === 'close_auction');
    if (openAnalysis && openAnalysis.avgSlippage > avgSlippage * 1.5) {
      timingAdvice.push('⚠️ Open auction: wider spreads — consider 30min after open');
    }
    if (closeAnalysis && closeAnalysis.avgSlippage < avgSlippage * 0.7) {
      timingAdvice.push('✅ Close auction: best execution — schedule large sells here');
    }
    if (timingAdvice.length === 0) {
      timingAdvice.push('✅ Execution quality consistent across all time windows');
    }

    // Overall grade
    let overallGrade: TCAReportV2['overallGrade'];
    if (costBp < 5) overallGrade = 'A+';
    else if (costBp < 10) overallGrade = 'A';
    else if (costBp < 20) overallGrade = 'B';
    else if (costBp < 35) overallGrade = 'C';
    else overallGrade = 'D';

    return {
      period: {
        start: new Date(timestamps[0]).toISOString().slice(0, 10),
        end: now.toISOString().slice(0, 10),
      },
      nExecutions: executions.length,
      totalCosts: Math.round(totalCosts * 100) / 100,
      costPerShare: Math.round(costPerShare * 10000) / 10000,
      costBp: Math.round(costBp * 10) / 10,
      estimatedMarketImpact: Math.round(estimatedMarketImpact * 100) / 100,
      avgSlippage: Math.round(avgSlippage * 10000) / 10000,
      avgSpread: Math.round(avgSpread * 10000) / 10000,
      venues,
      bestVenue,
      worstVenue,
      timeAnalysis,
      qualityDistribution: qualityDist,
      avgFillQuality: Math.round(avgFillQuality * 100) / 100,
      costliestSymbols,
      venueSuggestions,
      timingAdvice,
      overallGrade,
      timestamp: Date.now(),
    };
  }

  // ── Time-of-Day Analysis ─────────────────────────────────────────────

  private analyzeTimeOfDay(executions: ExecutionRecord[]): TimeOfDayAnalysis[] {
    const results: TimeOfDayAnalysis[] = [];

    for (const win of HK_TIME_WINDOWS) {
      const winExs = executions.filter(ex => {
        const d = new Date(ex.timestamp);
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return timeStr >= win.start && timeStr <= win.end;
      });

      if (winExs.length === 0) continue;

      const avgSlip = winExs.reduce((s, e) => s + Math.abs(e.slippage), 0) / winExs.length;
      const avgSpr = winExs.reduce((s, e) => s + e.effectiveSpread, 0) / winExs.length;
      const fillRate = winExs.filter(e => e.fillQuality !== 'POOR').length / winExs.length;
      const volumeShare = winExs.length / executions.length;

      let recommendation = '';
      if (win.name === 'close_auction' && avgSlip < 0.0003) recommendation = '✅ Best window for execution';
      else if (win.name === 'open_auction' && avgSlip > 0.0005) recommendation = '⚠️ Wide spreads: avoid large orders';
      else if (win.name === 'lunch') recommendation = 'ℹ️ Reduced liquidity during lunch';
      else if (win.name === 'after_hours') recommendation = '⚠️ After-hours: wide spreads, low liquidity';

      results.push({
        window: win.name,
        avgSlippage: Math.round(avgSlip * 10000) / 10000,
        avgSpread: Math.round(avgSpr * 10000) / 10000,
        fillRate: Math.round(fillRate * 10000) / 100,
        volumeShare: Math.round(volumeShare * 10000) / 100,
        recommendation: recommendation || 'Normal execution quality',
      });
    }

    return results;
  }

  // ── Venue Suggestion ─────────────────────────────────────────────────

  suggestVenue(
    orderQty: number,
    symbol: string,
    isIlliquid: boolean
  ): { venue: string; reason: string; estimatedCost: number } {
    // Mock: in reality would use market data + historical TCA
    if (isIlliquid) {
      return {
        venue: 'IB_HK',
        reason: 'Best for illiquid orders: wide reach + dark pool',
        estimatedCost: orderQty * 0.001 * 0.0002,
      };
    }
    if (orderQty > 100000) {
      return {
        venue: 'IB_HK',
        reason: 'Large order: best impact control + algos',
        estimatedCost: orderQty * 0.001 * 0.0002,
      };
    }
    if (orderQty < 10000) {
      return {
        venue: 'MOOMOO',
        reason: 'Small retail order: zero platform fee + tight spread',
        estimatedCost: orderQty * 0.001 * 0.0003,
      };
    }
    return {
      venue: 'FUTU_HK',
      reason: 'Balanced: good quality + competitive commission',
      estimatedCost: orderQty * 0.001 * 0.0003,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private emptyReport(): TCAReportV2 {
    return {
      period: { start: '', end: '' },
      nExecutions: 0,
      totalCosts: 0, costPerShare: 0, costBp: 0, estimatedMarketImpact: 0,
      avgSlippage: 0, avgSpread: 0,
      venues: [], bestVenue: 'N/A', worstVenue: 'N/A',
      timeAnalysis: [],
      qualityDistribution: {},
      avgFillQuality: 0,
      costliestSymbols: [],
      venueSuggestions: {},
      timingAdvice: [],
      overallGrade: 'A+',
      timestamp: Date.now(),
    };
  }
}

export default TCAEngineV2;