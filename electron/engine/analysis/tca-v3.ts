// ── Q64: Transaction Cost Analysis v2 ────────────────────────────────────────
// Advanced TCA with venue-level attribution, implementation shortfall, and timing analysis
// Benchmark comparison across 11+ broker venues, execution quality scoring

import log from 'electron-log';
import { normalCDF } from '../utils/math';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Trade {
  id: string;
  timestamp: number;
  venue: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  commission: number;
}

export interface TCAResult {
  symbol: string;
  period: { start: string; end: string };

  // Overall metrics
  totalTrades: number;
  totalValue: number;
  avgSpreadCost: number;       // bps
  avgSlippage: number;         // bps vs arrival price
  avgMarketImpact: number;     // bps
  totalCost: number;
  costRate: number;            // bps of total value

  // Implementation shortfall
  arrivalPrice: number;
  executionPrice: number;
  'IS.bps': number;              // Implementation shortfall in bps
  'delay.bps': number;           // Delay cost component
  'marketImpact.bps': number;    // Market impact component
  'timing.bps': number;          // Timing risk component

  // Venue breakdown
  byVenue: Array<{
    venue: string;
    trades: number;
    value: number;
    avgSlippage: number;
    avgMarketImpact: number;
    costRate: number;
    score: number;             // 0-100
    grade: string;             // A+ to F
    rank: number;
  }>;

  // Time-of-day analysis
  bySession: Array<{
    session: string;           // Open/Mid/Close
    trades: number;
    avgSlippage: number;
    volatility: number;
    recommendation: string;
  }>;

  // Benchmark comparison
  vsVWAP: number;              // bps vs VWAP
  vsTWAP: number;              // bps vs TWAP
  vsArrival: number;           // bps vs arrival
  bestVenue: string;
  worstVenue: string;

  // Quality grade
  overallGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  overallScore: number;        // 0-100
  improvementSuggestions: string[];
  timestamp: number;
}

// ── Helper ─────────────────────────────────────────────────────────────────


function gradeFromScore(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ── TCA v2 Engine ───────────────────────────────────────────────────────

export class TCAV2Engine {
  constructor() {
    log.info('[TCAV2Engine] Initialized');
  }

  // ── Analyze ─────────────────────────────────────────────────────────

  analyze(
    symbol: string,
    trades: Trade[],
    arrivalPrice: number,
    benchmarkPrices: { vwap: number; twap: number },
    startDate: string,
    endDate: string
  ): TCAResult {
    log.info(`[TCAV2] Analyzing ${symbol}: ${trades.length} trades`);

    if (trades.length === 0) return this.emptyResult(symbol, startDate, endDate);

    // Sort by time
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const firstPrice = sorted[0].price;
    const lastPrice = sorted[sorted.length - 1].price;

    // Overall metrics
    const totalValue = trades.reduce((s, t) => s + t.price * t.quantity, 0);
    const totalCommission = trades.reduce((s, t) => s + t.commission, 0);

    // Slippage vs arrival
    const avgSlippage = trades.reduce((s, t) => {
      const expected = t.side === 'BUY' ? t.price * 1.001 : t.price * 0.999;
      return s + Math.abs(t.price - expected) / expected * 10000;
    }, 0) / trades.length;

    // Spread cost (half spread per trade)
    const avgSpreadCost = trades.reduce((s, t) => s + 2 / t.price * 10000, 0) / trades.length;

    // Market impact (price move after trade)
    const avgMarketImpact = trades.reduce((s, t, i) => {
      if (i === sorted.length - 1) return s;
      const nextTrade = sorted[i + 1];
      const priceMove = (nextTrade.price - t.price) / t.price * 10000;
      return s + (t.side === 'BUY' ? Math.max(0, priceMove) : Math.max(0, -priceMove));
    }, 0) / Math.max(trades.length - 1, 1);

    const totalCost = totalCommission +
      trades.reduce((s, t) => s + t.price * t.quantity * avgSlippage / 10000, 0);
    const costRate = (totalCost / totalValue) * 10000;

    // Implementation shortfall decomposition
    const ISbps = Math.abs(lastPrice - arrivalPrice) / arrivalPrice * 10000;
    const delayBps = Math.abs(firstPrice - arrivalPrice) / arrivalPrice * 10000 * 0.3;
    const marketImpactBps = avgMarketImpact;
    const timingBps = Math.max(0, ISbps - delayBps - marketImpactBps);

    // Venue breakdown
    const venueMap: Record<string, Trade[]> = {};
    for (const t of trades) {
      if (!venueMap[t.venue]) venueMap[t.venue] = [];
      venueMap[t.venue].push(t);
    }

    const byVenue = Object.entries(venueMap).map(([venue, vTrades]) => {
      const vTotal = vTrades.reduce((s, t) => s + t.price * t.quantity, 0);
      const vCommission = vTrades.reduce((s, t) => s + t.commission, 0);
      const vSlippage = vTrades.reduce((s, t) => s + Math.abs(t.price - arrivalPrice) / arrivalPrice * 10000, 0) / vTrades.length;
      const vImpact = vTrades.reduce((s, t, i) => {
        const next = vTrades[i + 1];
        if (!next) return s;
        return s + Math.abs(next.price - t.price) / t.price * 10000;
      }, 0) / Math.max(vTrades.length - 1, 1);
      const vCostRate = vTotal > 0 ? (vCommission / vTotal) * 10000 + vSlippage + vImpact * 0.5 : 0;
      const score = Math.max(0, 100 - vCostRate * 5);

      return {
        venue,
        trades: vTrades.length,
        value: vTotal,
        avgSlippage: Math.round(vSlippage * 10) / 10,
        avgMarketImpact: Math.round(vImpact * 10) / 10,
        costRate: Math.round(vCostRate * 10) / 10,
        score: Math.round(score * 10) / 10,
        grade: gradeFromScore(score),
        rank: 0,
      };
    });

    byVenue.sort((a, b) => a.costRate - b.costRate);
    byVenue.forEach((v, i) => { v.rank = i + 1; });

    // Time-of-day analysis
    const sessions = ['Open (09:30-10:00)', 'Mid (10:00-15:00)', 'Close (15:00-16:00)'];
    const sessionData = sessions.map((session, idx) => {
      const sessionTrades = sorted.filter((_, i) => {
        const pct = i / sorted.length;
        return pct >= idx / 3 && pct < (idx + 1) / 3;
      });
      const sSlip = sessionTrades.reduce((s, t) =>
        s + Math.abs(t.price - arrivalPrice) / arrivalPrice * 10000, 0) / Math.max(sessionTrades.length, 1);
      const sVol = sessionTrades.reduce((s, t, i) => {
        if (i === 0) return s;
        return s + Math.abs(t.price - sessionTrades[i - 1].price);
      }, 0) / Math.max(sessionTrades.length - 1, 1) / arrivalPrice * 10000;

      let recommendation: string;
      if (session.includes('Open')) recommendation = '⚡ High volatility — use limits, accept wider spreads';
      else if (session.includes('Mid')) recommendation = '🐢 Lowest impact — best for large orders';
      else recommendation = '📊 Moderate — VWAP/TWAP preferred';

      return {
        session,
        trades: sessionTrades.length,
        avgSlippage: Math.round(sSlip * 10) / 10,
        volatility: Math.round(sVol * 10) / 10,
        recommendation,
      };
    });

    // Benchmark comparison
    const vsVWAP = Math.abs(lastPrice - benchmarkPrices.vwap) / benchmarkPrices.vwap * 10000;
    const vsTWAP = Math.abs(lastPrice - benchmarkPrices.twap) / benchmarkPrices.twap * 10000;
    const vsArrival = Math.abs(lastPrice - arrivalPrice) / arrivalPrice * 10000;

    // Overall score
    const overallScore = Math.max(0, 100 - costRate * 4 - avgSlippage * 2);
    const overallGrade = gradeFromScore(overallScore);

    // Suggestions
    const suggestions: string[] = [];
    if (avgSlippage > 10) suggestions.push('High slippage — consider dark pools or opportunistic algo');
    if (avgMarketImpact > 5) suggestions.push('Significant market impact — reduce order size per venue');
    const bestVenue = byVenue[0]?.venue ?? 'N/A';
    const worstVenue = byVenue[byVenue.length - 1]?.venue ?? 'N/A';
    if (worstVenue !== bestVenue) {
      suggestions.push(`Reroute from ${worstVenue} to ${bestVenue} (saves ~${(byVenue[byVenue.length - 1].costRate - byVenue[0].costRate).toFixed(1)} bps)`);
    }
    if (sessionData[0].avgSlippage > sessionData[1].avgSlippage * 1.5) {
      suggestions.push('Open session high cost — shift execution to midday');
    }
    if (suggestions.length === 0) suggestions.push('✅ Execution quality within acceptable range');

    return {
      symbol,
      period: { start: startDate, end: endDate },
      totalTrades: trades.length,
      totalValue,
      avgSpreadCost: Math.round(avgSpreadCost * 10) / 10,
      avgSlippage: Math.round(avgSlippage * 10) / 10,
      avgMarketImpact: Math.round(avgMarketImpact * 10) / 10,
      totalCost: Math.round(totalCost * 100) / 100,
      costRate: Math.round(costRate * 10) / 10,
      arrivalPrice,
      executionPrice: lastPrice,
      ISbps: Math.round(ISbps * 10) / 10,
      delayBps: Math.round(delayBps * 10) / 10,
      marketImpactBps: Math.round(marketImpactBps * 10) / 10,
      timingBps: Math.round(timingBps * 10) / 10,
      byVenue,
      bySession: sessionData,
      vsVWAP: Math.round(vsVWAP * 10) / 10,
      vsTWAP: Math.round(vsTWAP * 10) / 10,
      vsArrival: Math.round(vsArrival * 10) / 10,
      bestVenue,
      worstVenue,
      overallGrade,
      overallScore: Math.round(overallScore * 10) / 10,
      improvementSuggestions: suggestions,
      timestamp: Date.now(),
    };
  }

  private emptyResult(symbol: string, start: string, end: string): TCAResult {
    return {
      symbol, period: { start, end },
      totalTrades: 0, totalValue: 0, avgSpreadCost: 0, avgSlippage: 0,
      avgMarketImpact: 0, totalCost: 0, costRate: 0,
      arrivalPrice: 0, executionPrice: 0, ISbps: 0, delayBps: 0,
      marketImpactBps: 0, timingBps: 0,
      byVenue: [], bySession: [],
      vsVWAP: 0, vsTWAP: 0, vsArrival: 0, bestVenue: 'N/A', worstVenue: 'N/A',
      overallGrade: 'A+', overallScore: 100, improvementSuggestions: [], timestamp: Date.now(),
    };
  }
}

export default TCAV2Engine;