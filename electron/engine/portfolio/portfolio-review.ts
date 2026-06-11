// ── Q44: Portfolio Review Report ─────────────────────────────────────────────
// Multi-period review (weekly/monthly/quarterly/annual)
// Benchmark-relative attribution + actionable recommendations

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PeriodReview {
  startDate: string;
  endDate: string;
  period: 'weekly' | 'monthly' | 'quarterly' | 'annual';

  // Returns
  portfolioReturn: number;
  benchmarkReturn: number;
  activeReturn: number;
  annualizedReturn: number;

  // Risk
  volatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trackingError: number;
  informationRatio: number;

  // P&L attribution
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  dividendIncome: number;
  feeCost: number;
  netPnL: number;

  // Position changes
  positionsAdded: string[];
  positionsRemoved: string[];
  positionsIncreased: string[];
  positionsDecreased: string[];
  newPositions: Array<{ symbol: string; weight: number; pnl: number }>;
  closedPositions: Array<{ symbol: string; pnl: number; reason: string }>;

  // Performance drivers
  topContributors: Array<{ symbol: string; contribution: number; return: number }>;
  topDetractors: Array<{ symbol: string; contribution: number; return: number }>;

  // Risk metrics
  varEnd: number;
  leverage: number;
  cashPct: number;
}

export interface AnnualReview extends PeriodReview {
  ytdReturn: number;
  vsGoalReturn: number;        // vs investment objective
  goalAchieved: boolean;
  taxImpact: number;
  rebalancingEvents: number;
  strategyAllocationChanges: Array<{ from: string; to: string; weightChange: number }>;
}

export interface ReviewReport {
  portfolioId: string;
  generatedAt: string;

  reviews: {
    weekly?: PeriodReview;
    monthly?: PeriodReview;
    quarterly?: PeriodReview;
    annual?: AnnualReview;
  };

  benchmark: {
    name: string;
    return: number;
    vol: number;
  };

  // Overall assessment
  overallGrade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
  performanceSummary: string;
  keyTakeaways: string[];
  topRecommendations: string[];
  nextPeriodWatchlist: string[];
  timestamp: number;
}

// ── Portfolio Review Report ───────────────────────────────────────────────

export class PortfolioReviewEngine {
  constructor() {
    log.info('[PortfolioReviewEngine] Initialized');
  }

  // ── Build Single Period Review ──────────────────────────────────────

  buildReview(
    period: 'weekly' | 'monthly' | 'quarterly' | 'annual',
    startDate: string,
    endDate: string,
    trades: Array<{
      date: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      quantity: number;
      price: number;
      pnl: number;
      realized: boolean;
    }>,
    positions: Array<{
      symbol: string;
      quantity: number;
      avgCost: number;
      currentPrice: number;
      weight: number;
      strategyId?: string;
    }>,
    benchmarkReturn: number,
    dividends: number = 0,
    fees: number = 0
  ): PeriodReview {
    const n = trades.length;
    const realizedPnL = trades.filter(t => t.realized).reduce((s, t) => s + t.pnl, 0);
    const unrealizedPnL = positions.reduce((s, p) =>
      s + (p.currentPrice - p.avgCost) * p.quantity, 0
    );
    const totalPnL = realizedPnL + unrealizedPnL;

    // Simple return calc (placeholder)
    const totalValue = positions.reduce((s, p) => s + p.quantity * p.currentPrice, 0);
    const portfolioReturn = totalValue > 0 ? (totalPnL / totalValue) * 100 : 0;
    const activeReturn = portfolioReturn - benchmarkReturn;

    // Top contributors/detractors
    const pnlBySymbol = new Map<string, number>();
    for (const t of trades) {
      const prev = pnlBySymbol.get(t.symbol) ?? 0;
      pnlBySymbol.set(t.symbol, prev + t.pnl);
    }
    const sorted = [...pnlBySymbol.entries()].sort((a, b) => b[1] - a[1]);
    const topContributors = sorted.slice(0, 5).map(([symbol, pnl]) => ({
      symbol,
      contribution: Math.round(pnl * 100) / 100,
      return: Math.round((pnl / (totalValue / sorted.length)) * 10000) / 100,
    }));
    const topDetractors = sorted.slice(-5).map(([symbol, pnl]) => ({
      symbol,
      contribution: Math.round(pnl * 100) / 100,
      return: Math.round((pnl / (totalValue / sorted.length)) * 10000) / 100,
    }));

    // Position changes
    const buySymbols = new Set(trades.filter(t => t.side === 'BUY').map(t => t.symbol));
    const sellSymbols = new Set(trades.filter(t => t.side === 'SELL').map(t => t.symbol));

    return {
      startDate,
      endDate,
      period,
      portfolioReturn: Math.round(portfolioReturn * 100) / 100,
      benchmarkReturn: Math.round(benchmarkReturn * 100) / 100,
      activeReturn: Math.round(activeReturn * 100) / 100,
      annualizedReturn: Math.round(this.annualize(portfolioReturn, period) * 100) / 100,
      volatility: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      trackingError: 0,
      informationRatio: activeReturn / 0.05,
      totalPnL: Math.round(totalPnL * 100) / 100,
      realizedPnL: Math.round(realizedPnL * 100) / 100,
      unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
      dividendIncome: Math.round(dividends * 100) / 100,
      feeCost: Math.round(fees * 100) / 100,
      netPnL: Math.round((totalPnL - dividends - fees) * 100) / 100,
      positionsAdded: [...buySymbols].filter(s => !sellSymbols.has(s)),
      positionsRemoved: [...sellSymbols].filter(s => !buySymbols.has(s)),
      positionsIncreased: [],
      positionsDecreased: [],
      newPositions: [],
      closedPositions: [],
      topContributors,
      topDetractors,
      varEnd: 0,
      leverage: 1,
      cashPct: 0,
    };
  }

  // ── Build Annual Review ──────────────────────────────────────────────

  buildAnnualReview(
    period: PeriodReview,
    goalReturn: number,
    taxImpact: number,
    rebalancingEvents: number,
    allocationChanges: Array<{ from: string; to: string; weightChange: number }>
  ): AnnualReview {
    return {
      ...period,
      ytdReturn: period.portfolioReturn,
      vsGoalReturn: goalReturn - period.portfolioReturn,
      goalAchieved: period.portfolioReturn >= goalReturn,
      taxImpact,
      rebalancingEvents,
      strategyAllocationChanges: allocationChanges,
    };
  }

  // ── Generate Full Report ───────────────────────────────────────────

  generateReport(
    portfolioId: string,
    benchmark: { name: string; return: number; vol: number },
    trades: Array<{
      date: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      quantity: number;
      price: number;
      pnl: number;
      realized: boolean;
    }>,
    positions: Array<{
      symbol: string;
      quantity: number;
      avgCost: number;
      currentPrice: number;
      weight: number;
      strategyId?: string;
    }>
  ): ReviewReport {
    log.info(`[PortfolioReview] Generating review for ${portfolioId}`);

    const now = new Date();
    const endDate = now.toISOString().slice(0, 10);

    // Weekly: last 7 days
    const weekStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const weekTrades = trades.filter(t => new Date(t.date) >= weekStart);
    const weekly = weekTrades.length > 0
      ? this.buildReview('weekly', weekStart.toISOString().slice(0, 10), endDate, weekTrades, positions, benchmark.return)
      : undefined;

    // Monthly: last 30 days
    const monthStart = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const monthTrades = trades.filter(t => new Date(t.date) >= monthStart);
    const monthly = monthTrades.length > 0
      ? this.buildReview('monthly', monthStart.toISOString().slice(0, 10), endDate, monthTrades, positions, benchmark.return)
      : undefined;

    // Quarterly: last 90 days
    const quarterStart = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
    const quarterTrades = trades.filter(t => new Date(t.date) >= quarterStart);
    const quarterly = quarterTrades.length > 0
      ? this.buildReview('quarterly', quarterStart.toISOString().slice(0, 10), endDate, quarterTrades, positions, benchmark.return)
      : undefined;

    // Annual: last 365 days
    const yearStart = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
    const yearTrades = trades.filter(t => new Date(t.date) >= yearStart);
    const annual = yearTrades.length > 0
      ? this.buildReview('annual', yearStart.toISOString().slice(0, 10), endDate, yearTrades, positions, benchmark.return)
      : undefined;

    // Overall grade
    const annualRet = annual?.portfolioReturn ?? monthly?.portfolioReturn ?? 0;
    let overallGrade: ReviewReport['overallGrade'];
    if (annualRet >= 20) overallGrade = 'A+';
    else if (annualRet >= 10) overallGrade = 'A';
    else if (annualRet >= 5) overallGrade = 'B+';
    else if (annualRet >= 0) overallGrade = 'B';
    else if (annualRet >= -10) overallGrade = 'C';
    else overallGrade = 'D';

    const performanceSummary = annual
      ? `YTD return ${annual.portfolioReturn >= 0 ? '+' : ''}${annual.portfolioReturn.toFixed(2)}% vs benchmark ${annual.benchmarkReturn >= 0 ? '+' : ''}${annual.benchmarkReturn.toFixed(2)}%. Active return ${annual.activeReturn >= 0 ? '+' : ''}${annual.activeReturn.toFixed(2)}%.`
      : monthly
      ? `MTD return ${monthly.portfolioReturn >= 0 ? '+' : ''}${monthly.portfolioReturn.toFixed(2)}% vs benchmark ${monthly.benchmarkReturn >= 0 ? '+' : ''}${monthly.benchmarkReturn.toFixed(2)}%.`
      : 'Insufficient trading activity for period review.';

    const keyTakeaways: string[] = [];
    if (annual?.topContributors.length) {
      const top = annual.topContributors[0];
      if (top) keyTakeaways.push(`Top performer: ${top.symbol} (+${top.contribution >= 0 ? '' : ''}${top.contribution})`);
    }
    if (annual?.topDetractors.length) {
      const worst = annual.topDetractors[0];
      if (worst) keyTakeaways.push(`Worst detractor: ${worst.symbol} (${worst.contribution})`);
    }
    if (annual && annual.realizedPnL > 0) keyTakeaways.push(`Realized gains: +HK$${(annual.realizedPnL / 10000).toFixed(1)}W`);
    if (!keyTakeaways.length) keyTakeaways.push('Performance metrics within normal range');

    const topRecommendations: string[] = [];
    if (annual && annual.activeReturn < -5) topRecommendations.push('Review underperforming strategies — consider rebalancing or stopping');
    if (annual && annual.maxDrawdown > 15) topRecommendations.push('Drawdown exceeded 15% — tighten stop-loss rules');
    if (monthly && monthly.realizedPnL > monthly.unrealizedPnL * 2) topRecommendations.push('Good realized P&L — maintain discipline');
    if (topRecommendations.length === 0) topRecommendations.push('Continue current strategy — maintain risk discipline');

    const nextPeriodWatchlist: string[] = [];
    if (annual?.positionsAdded.length) nextPeriodWatchlist.push(...annual.positionsAdded.slice(0, 3));
    if (!nextPeriodWatchlist.length) nextPeriodWatchlist.push('Maintain current allocations');

    return {
      portfolioId,
      generatedAt: now.toISOString(),
      reviews: { weekly, monthly, quarterly, annual: annual as AnnualReview | undefined },
      benchmark,
      overallGrade,
      performanceSummary,
      keyTakeaways,
      topRecommendations,
      nextPeriodWatchlist,
      timestamp: Date.now(),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private annualize(returnPct: number, period: string): number {
    const periods: Record<string, number> = {
      weekly: 52,
      monthly: 12,
      quarterly: 4,
      annual: 1,
    };
    const n = periods[period] ?? 1;
    return (Math.pow(1 + returnPct / 100, n) - 1) * 100;
  }
}

export default PortfolioReviewEngine;