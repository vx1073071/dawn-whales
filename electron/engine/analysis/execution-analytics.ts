// ── Q53: Execution Analytics Engine ────────────────────────────────────────────
// VWAP / TWAP / POV / IS implementation + Execution quality scoring
// Slippage attribution + Venue routing optimization

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type AlgoType = 'VWAP' | 'TWAP' | 'POV' | 'IS' | 'ADAPTIVE';

export interface ExecutionSlice {
  timestamp: number;
  price: number;
  quantity: number;
  venue: string;
  side: 'BUY' | 'SELL';
  slippage: number;          // vs arrival price
  marketImpact: number;
  realizedSpread: number;
}

export interface AlgoExecution {
  algoId: string;
  algoType: AlgoType;
  symbol: string;
  targetQty: number;
  filledQty: number;
  fillRate: number;          // % filled
  startTime: number;
  endTime: number;
  durationMin: number;
  arrivalPrice: number;      // Price when algo started
  avgFillPrice: number;
  vwap: number;
  twap: number;
  isPrice: number;           // Implementation shortfall price
  slices: ExecutionSlice[];
  slippageTotal: number;
  marketImpactTotal: number;
  participationRate: number; // % of ADV traded
  qualityScore: number;       // 0-100
  scoreGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
}

export interface ExecutionAnalyticsReport {
  periodStart: string;
  periodEnd: string;
  nExecutions: number;
  totalNotional: number;
  avgSlippage: number;
  avgMarketImpact: number;
  avgQualityScore: number;
  gradeDistribution: Record<string, number>;
  byAlgoType: Record<AlgoType, { n: number; avgSlippage: number; avgScore: number }>;
  byVenue: Record<string, { n: number; avgSlippage: number; fillRate: number }>;
  worstExecutions: Array<{ algoId: string; symbol: string; slippage: number; reason: string }>;
  bestPractices: string[];
  recommendations: string[];
  timestamp: number;
}

// ── VWAP Calculation ─────────────────────────────────────────────────────

function computeVWAP(slices: ExecutionSlice[]): number {
  if (slices.length === 0) return 0;
  const totalPV = slices.reduce((s, sl) => s + sl.price * sl.quantity, 0);
  const totalQ = slices.reduce((s, sl) => s + sl.quantity, 0);
  return totalQ > 0 ? totalPV / totalQ : 0;
}

// ── Execution Analytics Engine ───────────────────────────────────────────

export class ExecutionAnalyticsEngine {
  constructor() {
    log.info('[ExecutionAnalyticsEngine] Initialized');
  }

  // ── Simulate Execution Algos ────────────────────────────────────────

  simulateAlgo(
    algoId: string,
    algoType: AlgoType,
    symbol: string,
    side: 'BUY' | 'SELL',
    targetQty: number,
    startPrice: number,
    startTime: number,
    durationMin: number,
    adv: number,            // Average daily volume
    vol: number = 0.02,
    nSlices: number = 20
  ): AlgoExecution {
    const slices: ExecutionSlice[] = [];
    const sliceInterval = durationMin / nSlices;
    const participationRate = Math.min(0.5, targetQty / adv);

    let filledQty = 0;
    let currentPrice = startPrice;

    for (let i = 0; i < nSlices; i++) {
      if (filledQty >= targetQty) break;

      // Price evolution with drift + impact
      const t = i / nSlices;
      const drift = (side === 'BUY' ? 1 : -1) * vol * Math.sqrt(t) * currentPrice * 0.1;
      const randomMove = (Math.random() - 0.5) * vol * currentPrice * 0.05;
      currentPrice = Math.max(0.01, currentPrice + drift + randomMove);

      // Quantity distribution depends on algo type
      let qty = 0;
      switch (algoType) {
        case 'VWAP':
          // VWAP: proportional to expected volume distribution (U-shaped for HK)
          const baseRate = 0.5 / nSlices;
          const uShape = 1 + Math.abs((i - nSlices / 2) / (nSlices / 2));
          qty = (targetQty - filledQty) * Math.min(baseRate * uShape, 0.3);
          break;
        case 'TWAP':
          qty = (targetQty - filledQty) / (nSlices - i);
          break;
        case 'POV':
          // Participation of volume
          const povRate = participationRate * (0.8 + Math.random() * 0.4);
          qty = adv * povRate * (sliceInterval / 390) * (0.8 + Math.random() * 0.4);
          break;
        case 'IS':
          // Urgency front-loaded
          const urgency = 1 - t;
          qty = Math.min(targetQty - filledQty, targetQty * urgency * 0.3);
          break;
        case 'ADAPTIVE':
          // Adaptive: starts with VWAP, shifts to IS if price moves
          const priceMove = Math.abs(currentPrice - startPrice) / startPrice;
          const isWeight = Math.min(1, priceMove * 10);
          const vwapWeight = 1 - isWeight;
          qty = vwapWeight * (targetQty / nSlices) + isWeight * (targetQty * 0.3 * (1 - t));
          break;
        default:
          qty = (targetQty - filledQty) / (nSlices - i);
      }

      qty = Math.min(qty, targetQty - filledQty);
      qty = Math.max(0, Math.round(qty));

      if (qty <= 0) continue;

      // Slippage = vs arrival price
      const slippage = (currentPrice - startPrice) / startPrice * (side === 'BUY' ? 1 : -1);
      // Market impact from Almgren-Chriss
      const marketImpact = 0.5 * participationRate * vol * currentPrice * 0.01;
      const realizedSpread = currentPrice * 0.0002; // Half spread

      slices.push({
        timestamp: startTime + i * sliceInterval * 60_000,
        price: Math.round(currentPrice * 100) / 100,
        quantity: qty,
        venue: this.randomVenue(),
        side,
        slippage: Math.round(slippage * 10000) / 100,
        marketImpact: Math.round(marketImpact * 100) / 100,
        realizedSpread: Math.round(realizedSpread * 100) / 100,
      });

      filledQty += qty;
    }

    const vwap = computeVWAP(slices);
    const avgFillPrice = slices.length > 0
      ? slices.reduce((s, sl) => s + sl.price * sl.quantity, 0) / slices.reduce((s, sl) => s + sl.quantity, 0)
      : startPrice;

    const isPrice = avgFillPrice; // Implementation shortfall = avg fill vs decision price
    const slippageTotal = slices.reduce((s, sl) => s + Math.abs(sl.slippage) * sl.quantity, 0) / filledQty;
    const marketImpactTotal = slices.reduce((s, sl) => s + sl.marketImpact * sl.quantity, 0) / filledQty;

    // Quality score: based on slippage, fill rate, market impact
    const slipScore = Math.max(0, 100 - Math.abs(slippageTotal) * 10000 / 2);
    const fillScore = (filledQty / targetQty) * 100;
    const impactScore = Math.max(0, 100 - marketImpactTotal * 10000 / 1);
    const qualityScore = Math.round((slipScore * 0.5 + fillScore * 0.2 + impactScore * 0.3) * 10) / 10;

    let scoreGrade: AlgoExecution['scoreGrade'];
    if (qualityScore >= 90) scoreGrade = 'A+';
    else if (qualityScore >= 80) scoreGrade = 'A';
    else if (qualityScore >= 70) scoreGrade = 'B';
    else if (qualityScore >= 50) scoreGrade = 'C';
    else scoreGrade = 'D';

    // TWAP: last slice price
    const twap = slices.length > 0 ? slices[slices.length - 1]!.price : startPrice;

    return {
      algoId,
      algoType,
      symbol,
      targetQty,
      filledQty,
      fillRate: Math.round((filledQty / targetQty) * 10000) / 100,
      startTime,
      endTime: startTime + durationMin * 60_000,
      durationMin,
      arrivalPrice: startPrice,
      avgFillPrice: Math.round(avgFillPrice * 100) / 100,
      vwap: Math.round(vwap * 100) / 100,
      twap: Math.round(twap * 100) / 100,
      isPrice: Math.round(isPrice * 100) / 100,
      slices,
      slippageTotal: Math.round(slippageTotal * 10000) / 10000,
      marketImpactTotal: Math.round(marketImpactTotal * 10000) / 10000,
      participationRate: Math.round(participationRate * 10000) / 100,
      qualityScore,
      scoreGrade,
    };
  }

  // ── Analyze Period ────────────────────────────────────────────────

  analyzePeriod(executions: AlgoExecution[]): ExecutionAnalyticsReport {
    if (executions.length === 0) return this.emptyReport();

    const avgSlippage = executions.reduce((s, e) => s + Math.abs(e.slippageTotal), 0) / executions.length;
    const avgImpact = executions.reduce((s, e) => s + e.marketImpactTotal, 0) / executions.length;
    const avgScore = executions.reduce((s, e) => s + e.qualityScore, 0) / executions.length;

    const gradeDist: Record<string, number> = {};
    for (const e of executions) {
      gradeDist[e.scoreGrade] = (gradeDist[e.scoreGrade] ?? 0) + 1;
    }

    const byAlgoType: ExecutionAnalyticsReport['byAlgoType'] = {} as any;
    for (const e of executions) {
      const existing = byAlgoType[e.algoType] ?? { n: 0, avgSlippage: 0, avgScore: 0 };
      byAlgoType[e.algoType] = {
        n: existing.n + 1,
        avgSlippage: (existing.avgSlippage * existing.n + Math.abs(e.slippageTotal)) / (existing.n + 1),
        avgScore: (existing.avgScore * existing.n + e.qualityScore) / (existing.n + 1),
      };
    }

    const byVenue: ExecutionAnalyticsReport['byVenue'] = {};
    for (const e of executions) {
      for (const sl of e.slices) {
        const existing = byVenue[sl.venue] ?? { n: 0, avgSlippage: 0, fillRate: 0 };
        byVenue[sl.venue] = {
          n: existing.n + 1,
          avgSlippage: (existing.avgSlippage * existing.n + Math.abs(sl.slippage)) / (existing.n + 1),
          fillRate: existing.n > 0 ? (existing.fillRate * existing.n + (e.filledQty / e.targetQty)) / (existing.n + 1) : e.filledQty / e.targetQty,
        };
      }
    }

    const worst = [...executions]
      .filter(e => e.scoreGrade === 'D' || e.scoreGrade === 'C')
      .sort((a, b) => b.slippageTotal - a.slippageTotal)
      .slice(0, 3)
      .map(e => ({
        algoId: e.algoId,
        symbol: e.symbol,
        slippage: e.slippageTotal,
        reason: e.slippages > 0.005 ? 'High slippage' : e.filledQty < e.targetQty * 0.9 ? 'Low fill rate' : 'High impact',
      }));

    const bestPractices: string[] = [];
    const algoBest = Object.entries(byAlgoType).sort(([, a], [, b]) => b.avgScore - a.avgScore)[0];
    if (algoBest) bestPractices.push(`Best algo type: ${algoBest[0]} (score ${algoBest[1].avgScore.toFixed(1)})`);

    const venueBest = Object.entries(byVenue).sort(([, a], [, b]) => a.avgSlippage - b.avgSlippage)[0];
    if (venueBest) bestPractices.push(`Best venue: ${venueBest[0]} (slippage ${(venueBest[1].avgSlippage * 100).toFixed(2)}bps)`);

    const recommendations: string[] = [];
    if (avgSlippage > 0.001) recommendations.push('⚠️ High average slippage — consider using limit orders or improving timing');
    if (avgScore < 70) recommendations.push('⚠️ Execution quality below target — review algo parameters');
    if (recommendations.length === 0) recommendations.push('✅ Execution quality within acceptable range');

    const now = new Date();
    return {
      periodStart: new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10),
      periodEnd: now.toISOString().slice(0, 10),
      nExecutions: executions.length,
      totalNotional: executions.reduce((s, e) => s + e.avgFillPrice * e.filledQty, 0),
      avgSlippage: Math.round(avgSlippage * 10000) / 10000,
      avgMarketImpact: Math.round(avgImpact * 10000) / 10000,
      avgQualityScore: Math.round(avgScore * 10) / 10,
      gradeDistribution: gradeDist,
      byAlgoType,
      byVenue,
      worstExecutions: worst,
      bestPractices,
      recommendations,
      timestamp: Date.now(),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private randomVenue(): string {
    const venues = ['FUTU_HK', 'IB_HK', 'MOOMOO', 'HSBC_HK', 'TIGER'];
    return venues[Math.floor(Math.random() * venues.length)] ?? 'FUTU_HK';
  }

  private emptyReport(): ExecutionAnalyticsReport {
    const now = new Date();
    return {
      periodStart: now.toISOString().slice(0, 10),
      periodEnd: now.toISOString().slice(0, 10),
      nExecutions: 0, totalNotional: 0, avgSlippage: 0, avgMarketImpact: 0, avgQualityScore: 0,
      gradeDistribution: {},
      byAlgoType: {} as any,
      byVenue: {},
      worstExecutions: [],
      bestPractices: [],
      recommendations: ['No executions to analyze'],
      timestamp: Date.now(),
    };
  }
}

export default ExecutionAnalyticsEngine;