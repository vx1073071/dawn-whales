// ── Q56: Portfolio Cost Analytics ────────────────────────────────────────────────
// All-in cost tracking: commissions + slippage + spread + financing + margin interest
// Cost attribution by strategy/asset/execution + Hidden cost analysis

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CostItem {
  category: 'COMMISSION' | 'SLIPPAGE' | 'SPREAD' | 'FINANCING' | 'MARGIN_INTEREST' | 'FX_FEE' | 'CLEARING' | 'PLATFORM_FEE' | 'DATA_FEE';
  subcategory: string;
  amount: number;          // HKD
  currency: string;
  date: string;
  symbol?: string;
  assetClass?: string;
  strategyId?: string;
  legId?: string;
  note?: string;
}

export interface CostAnalyticsReport {
  portfolioId: string;
  periodStart: string;
  periodEnd: string;
  totalCost: number;
  totalCostBp: number;    // Cost in bps of avg portfolio value
  avgDailyCost: number;

  // Breakdown by category
  byCategory: Record<string, number>;
  byCategoryBp: Record<string, number>;

  // Breakdown by asset class
  byAssetClass: Record<string, number>;

  // Breakdown by strategy
  byStrategy: Record<string, { total: number; nTrades: number; costPerTrade: number }>;

  // Timeline
  dailyCosts: Array<{ date: string; total: number; cumulative: number; breakdown: Record<string, number> }>;

  // Attribution
  realizedCostBreakdown: {
    commissions: number;
    slippage: number;
    spread: number;
    financing: number;
    margin: number;
    other: number;
  };

  // Hidden costs
  hiddenCosts: {
    spreadCost: number;
    marketImpact: number;
    timingCost: number;
    totalHidden: number;
    hiddenToExplicit: number; // Ratio
  };

  // Benchmark comparison
  benchmarkBp: number;    // Industry benchmark (typically 5-15bps for active)
  vsBenchmark: number;    // My cost - benchmark
  benchmarkGrade: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'HIGH' | 'EXCESSIVE';

  // Top cost contributors
  topCosts: Array<{ description: string; amount: number; category: string; date: string }>;

  recommendations: string[];
  timestamp: number;
}

// ── Cost Analytics Engine ────────────────────────────────────────────────

export class PortfolioCostAnalytics {
  constructor(private avgPortfolioValue = 10_000_000) {
    log.info('[PortfolioCostAnalytics] Initialized');
  }

  // ── Analyze ───────────────────────────────────────────────────────

  analyze(
    portfolioId: string,
    costs: CostItem[],
    periodDays = 30
  ): CostAnalyticsReport {
    log.info(`[CostAnalytics] Analyzing ${costs.length} cost items for ${portfolioId}`);

    if (costs.length === 0) return this.emptyReport(portfolioId);

    // Filter by date range
    const now = Date.now();
    const cutoff = now - periodDays * 86400_000;
    const recent = costs.filter(c => new Date(c.date).getTime() >= cutoff);

    const totalCost = recent.reduce((s, c) => s + c.amount, 0);
    const totalCostBp = (totalCost / this.avgPortfolioValue) * 10000;
    const avgDailyCost = totalCost / periodDays;

    // By category
    const byCategory: Record<string, number> = {};
    const byCategoryBp: Record<string, number> = {};
    for (const c of recent) {
      byCategory[c.category] = (byCategory[c.category] ?? 0) + c.amount;
    }
    for (const [cat, amt] of Object.entries(byCategory)) {
      byCategoryBp[cat] = Math.round((amt / this.avgPortfolioValue) * 10000 * 100) / 100;
    }

    // By asset class
    const byAssetClass: Record<string, number> = {};
    for (const c of recent) {
      const assetClass = c.assetClass ?? 'UNKNOWN';
      byAssetClass[assetClass] = (byAssetClass[assetClass] ?? 0) + c.amount;
    }

    // By strategy
    const byStrategy: Record<string, { total: number; nTrades: number; costPerTrade: number }> = {};
    for (const c of recent) {
      const sid = c.strategyId ?? 'UNKNOWN';
      const existing = byStrategy[sid] ?? { total: 0, nTrades: 0, costPerTrade: 0 };
      existing.total += c.amount;
      existing.nTrades += c.note?.includes('trade') ? 1 : 0;
      byStrategy[sid] = existing;
    }
    for (const [sid, data] of Object.entries(byStrategy)) {
      data.costPerTrade = Math.round((data.total / Math.max(data.nTrades, 1)) * 100) / 100;
      data.total = Math.round(data.total * 100) / 100;
    }

    // Daily timeline
    const dateGroups = new Map<string, CostItem[]>();
    for (const c of recent) {
      const existing = dateGroups.get(c.date) ?? [];
      existing.push(c);
      dateGroups.set(c.date, existing);
    }

    let cumulative = 0;
    const dailyCosts = [...dateGroups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => {
        const total = items.reduce((s, c) => s + c.amount, 0);
        cumulative += total;
        const breakdown: Record<string, number> = {};
        for (const c of items) {
          breakdown[c.category] = (breakdown[c.category] ?? 0) + c.amount;
        }
        return {
          date,
          total: Math.round(total * 100) / 100,
          cumulative: Math.round(cumulative * 100) / 100,
          breakdown,
        };
      });

    // Realized breakdown
    const realizedCostBreakdown = {
      commissions: byCategory['COMMISSION'] ?? 0,
      slippage: byCategory['SLIPPAGE'] ?? 0,
      spread: byCategory['SPREAD'] ?? 0,
      financing: byCategory['FINANCING'] ?? 0,
      margin: byCategory['MARGIN_INTEREST'] ?? 0,
      other: totalCost - (byCategory['COMMISSION'] ?? 0) - (byCategory['SLIPPAGE'] ?? 0) - (byCategory['SPREAD'] ?? 0) - (byCategory['FINANCING'] ?? 0) - (byCategory['MARGIN_INTEREST'] ?? 0),
    };

    // Hidden costs
    const explicitCosts = byCategory['COMMISSION'] ?? 0;
    const slippage = byCategory['SLIPPAGE'] ?? 0;
    const spread = byCategory['SPREAD'] ?? 0;
    const spreadCost = slippage * 0.5; // Half of slippage is spread-related
    const marketImpact = slippage * 0.3; // Estimate
    const timingCost = totalCost * 0.05; // Timing friction estimate
    const totalHidden = spreadCost + marketImpact + timingCost;
    const hiddenToExplicit = explicitCosts > 0 ? totalHidden / explicitCosts : 0;

    // Benchmark (active trading: ~10bps typical)
    const benchmarkBp = 10;
    const vsBenchmark = totalCostBp - benchmarkBp;
    let benchmarkGrade: CostAnalyticsReport['benchmarkGrade'];
    if (totalCostBp < 5) benchmarkGrade = 'EXCELLENT';
    else if (totalCostBp < 10) benchmarkGrade = 'GOOD';
    else if (totalCostBp < 20) benchmarkGrade = 'AVERAGE';
    else if (totalCostBp < 40) benchmarkGrade = 'HIGH';
    else benchmarkGrade = 'EXCESSIVE';

    // Top contributors
    const topCosts = [...recent]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(c => ({
        description: `${c.category}: ${c.subcategory}${c.symbol ? ` (${c.symbol})` : ''}`,
        amount: Math.round(c.amount * 100) / 100,
        category: c.category,
        date: c.date,
      }));

    const recommendations: string[] = [];
    if (totalCostBp > 15) recommendations.push(`⚠️ High trading costs: ${totalCostBp.toFixed(1)}bps vs ${benchmarkBp}bps benchmark — reduce turnover`);
    if ((byCategory['SLIPPAGE'] ?? 0) > totalCost * 0.3) recommendations.push(`💸 Slippage is ${((byCategory['SLIPPAGE'] ?? 0) / totalCost * 100).toFixed(0)}% of costs — improve execution algo`);
    if ((byCategory['MARGIN_INTEREST'] ?? 0) > totalCost * 0.2) recommendations.push(`💰 Margin interest high: review leverage usage`);
    if (hiddenToExplicit > 2) recommendations.push(`🔍 Hidden costs ${hiddenToExplicit.toFixed(1)}x explicit — improve execution quality`);
    if (recommendations.length === 0) recommendations.push(`✅ Trading costs ${totalCostBp.toFixed(1)}bps — within acceptable range`);

    return {
      portfolioId,
      periodStart: new Date(cutoff).toISOString().slice(0, 10),
      periodEnd: new Date(now).toISOString().slice(0, 10),
      totalCost: Math.round(totalCost * 100) / 100,
      totalCostBp: Math.round(totalCostBp * 100) / 100,
      avgDailyCost: Math.round(avgDailyCost * 100) / 100,
      byCategory,
      byCategoryBp,
      byAssetClass,
      byStrategy,
      dailyCosts,
      realizedCostBreakdown: {
        commissions: Math.round(realizedCostBreakdown.commissions * 100) / 100,
        slippage: Math.round(realizedCostBreakdown.slippage * 100) / 100,
        spread: Math.round(realizedCostBreakdown.spread * 100) / 100,
        financing: Math.round(realizedCostBreakdown.financing * 100) / 100,
        margin: Math.round(realizedCostBreakdown.margin * 100) / 100,
        other: Math.round(Math.max(0, realizedCostBreakdown.other) * 100) / 100,
      },
      hiddenCosts: {
        spreadCost: Math.round(spreadCost * 100) / 100,
        marketImpact: Math.round(marketImpact * 100) / 100,
        timingCost: Math.round(timingCost * 100) / 100,
        totalHidden: Math.round(totalHidden * 100) / 100,
        hiddenToExplicit: Math.round(hiddenToExplicit * 100) / 100,
      },
      benchmarkBp,
      vsBenchmark: Math.round(vsBenchmark * 100) / 100,
      benchmarkGrade,
      topCosts,
      recommendations,
      timestamp: Date.now(),
    };
  }

  // ── Estimate from Trade Activity ─────────────────────────────────

  estimateFromActivity(
    nTrades: number,
    avgTradeValue: number,
    portfolioValue: number,
    leverage: number = 1,
    marginRate: number = 0.06,
    marginDays: number = 5
  ): CostAnalyticsReport {
    // Commission: HK$2-10 per trade + 0.1% of value (min HK$5)
    const commissions = nTrades * Math.max(5, avgTradeValue * 0.001);
    // Slippage: ~5bps for HK stocks
    const slippage = nTrades * avgTradeValue * 0.0005;
    // Margin interest: HKD margin rate × leverage × days
    const marginInterest = portfolioValue * (marginRate * leverage) * (marginDays / 365);
    // FX fees: 0.1% for USD/HKD conversion
    const fxFees = nTrades * avgTradeValue * 0.001;

    const costs: CostItem[] = [
      { category: 'COMMISSION', subcategory: 'Broker', amount: commissions, currency: 'HKD', date: new Date().toISOString().slice(0, 10), note: `${nTrades} trades` },
      { category: 'SLIPPAGE', subcategory: 'Market impact', amount: slippage, currency: 'HKD', date: new Date().toISOString().slice(0, 10) },
      { category: 'MARGIN_INTEREST', subcategory: 'Margin financing', amount: marginInterest, currency: 'HKD', date: new Date().toISOString().slice(0, 10) },
      { category: 'FX_FEE', subcategory: 'Currency conversion', amount: fxFees, currency: 'HKD', date: new Date().toISOString().slice(0, 10) },
    ];

    return this.analyze('ESTIMATED', costs);
  }

  private emptyReport(portfolioId: string): CostAnalyticsReport {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 86400_000);
    return {
      portfolioId,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: now.toISOString().slice(0, 10),
      totalCost: 0, totalCostBp: 0, avgDailyCost: 0,
      byCategory: {}, byCategoryBp: {}, byAssetClass: {},
      byStrategy: {},
      dailyCosts: [],
      realizedCostBreakdown: { commissions: 0, slippage: 0, spread: 0, financing: 0, margin: 0, other: 0 },
      hiddenCosts: { spreadCost: 0, marketImpact: 0, timingCost: 0, totalHidden: 0, hiddenToExplicit: 0 },
      benchmarkBp: 10, vsBenchmark: 0, benchmarkGrade: 'EXCELLENT',
      topCosts: [],
      recommendations: ['No cost data available'],
      timestamp: Date.now(),
    };
  }
}

export default PortfolioCostAnalytics;