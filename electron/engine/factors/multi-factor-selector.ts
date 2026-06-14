// ═══════════════════════════════════════════════════════════════════════
// R170 A9: DEPRECATED — multi-factor-selector.ts
//
// Legacy multi-factor selection screen has been superseded by
// DawnFactorFramework (dawn-factor-framework.ts).
//
// This file provides backward-compatible types and a lightweight
// re-export so existing callers (main-slim.ts, dawn-factor-framework.ts)
// continue to compile. NEW CODE SHOULD USE DawnFactorFramework.
//
// Scheduled for full removal in R173+ after all callers are migrated.
// ═══════════════════════════════════════════════════════════════════════

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Legacy types (preserved for backward API compatibility) ─────────────

/** @deprecated Use UnifiedFactorScore + FactorDataProvider from dawn-factor-framework */
export interface StockData {
  code: string;
  name: string;
  sector?: string;
  price: number;
  priceChange1M: number;
  priceChange3M: number;
  priceChange6M: number;
  priceChange1Y: number;
  pe: number;
  pb: number;
  ps: number;
  evEbitda: number;
  dividendYield: number;
  roe: number;
  roa: number;
  profitMargin: number;
  debtToEquity: number;
  revenueGrowth: number;
  volatility20D: number;
  volatility60D: number;
  beta: number;
  avgVolume20D: number;
  turnoverRate: number;
  marketCap: number;
}

/** @deprecated Use UnifiedFactorScore from dawn-factor-framework */
export interface FactorScore {
  factor: string;
  score: number;
  weight: number;
  weightedScore: number;
  rawValue: number;
  percentile: number;
}

/** @deprecated Use UnifiedFactorScore from dawn-factor-framework */
export interface StockScore {
  code: string;
  name: string;
  compositeScore: number;
  rank: number;
  factorScores: FactorScore[];
  sector?: string;
  timestamp: number;
}

export interface FactorScreenResult {
  universeSize: number;
  scoredStocks: number;
  scores: StockScore[];
  top10: StockScore[];
  bottom10: StockScore[];
  recommendations: string[];
  timestamp: number;
}

export interface ScreenCriteria {
  minCompositeScore?: number;
  maxStocks?: number;
  sector?: string;
  excludeStocks?: string[];
}

// ── Lightweight default helpers ─────────────────────────────────────────

const DEFAULT_FACTOR_WEIGHTS: Record<string, number> = {
  momentum: 0.25,
  value: 0.25,
  quality: 0.20,
  volatility: 0.15,
  liquidity: 0.15,
};

function computePercentile(values: number[], target: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.filter(v => v <= target).length;
  return Math.round((rank / Math.max(sorted.length, 1)) * 100);
}

/** @deprecated Use DawnFactorFramework.scoreBatch */
export function scoreAndRankStocks(
  stocks: StockData[],
  factorWeights: Record<string, number> = DEFAULT_FACTOR_WEIGHTS,
): StockScore[] {
  const keys = Object.keys(factorWeights);
  if (keys.length === 0) return [];

  // Compute per-factor percentiles then weighted composite
  const scores: StockScore[] = stocks.map((stock, _idx) => {
    const factorScores: FactorScore[] = [];
    let composite = 0;
    let totalWeight = 0;

    for (const factor of keys) {
      const w = factorWeights[factor] ?? 0;
      if (w <= 0) continue;

      const raw = getRawFactorValue(stock, factor);
      const allRaws = stocks.map(s => getRawFactorValue(s, factor));
      const percentile = computePercentile(allRaws, raw);
      // Higher is better for momentum/value/quality/liquidity; lower is better for volatility
      const factorScore = factor === 'volatility'
        ? Math.round((100 - percentile) * 10) / 10
        : Math.round(percentile * 10) / 10;

      factorScores.push({
        factor,
        score: factorScore,
        weight: w,
        weightedScore: Math.round(factorScore * w * 10) / 10,
        rawValue: raw,
        percentile,
      });

      composite += factorScore * w;
      totalWeight += w;
    }

    return {
      code: stock.code,
      name: stock.name,
      compositeScore: totalWeight > 0 ? Math.round(composite / totalWeight * 10) / 10 : 50,
      rank: 0,
      factorScores,
      sector: stock.sector,
      timestamp: Date.now(),
    };
  });

  scores.sort((a, b) => b.compositeScore - a.compositeScore);
  scores.forEach((s, i) => (s.rank = i + 1));
  return scores;
}

function getRawFactorValue(stock: StockData, factor: string): number {
  switch (factor) {
    case 'momentum': return stock.priceChange6M;
    case 'value': return 1 / Math.max(stock.pe, 0.1);
    case 'quality': return (stock.roe + stock.roa + stock.profitMargin) / 3;
    case 'volatility': return stock.volatility60D;
    case 'liquidity': return Math.log(stock.avgVolume20D + 1);
    default: return 0;
  }
}

/** @deprecated Use DawnFactorFramework.scoreBatch + post-filter */
export function screenStocks(
  stocks: StockData[],
  criteria: ScreenCriteria,
  factorWeights: Record<string, number> = DEFAULT_FACTOR_WEIGHTS,
): FactorScreenResult {
  log.info(`[MultiFactorSelector] Screening ${stocks.length} stocks (deprecated — use DawnFactorFramework)`);

  const scored = scoreAndRankStocks(stocks, factorWeights)
    .filter(s => criteria.minCompositeScore === undefined || s.compositeScore >= criteria.minCompositeScore);

  const top10 = scored.slice(0, 10);
  const bottom10 = scored.slice(-10).reverse();

  return {
    universeSize: stocks.length,
    scoredStocks: scored.length,
    scores: scored,
    top10,
    bottom10,
    recommendations: [
      i18n.t('multiFactorSelector.k6'),
    ],
    timestamp: Date.now(),
  };
}

/** @deprecated Use DawnFactorFramework.scoreBatch × N */
export function batchScreenStocks(
  batches: { name: string; stocks: StockData[]; criteria: ScreenCriteria; factorWeights?: Record<string, number> }[]
): { name: string; result: FactorScreenResult }[] {
  return batches.map(b => ({
    name: b.name,
    result: screenStocks(b.stocks, b.criteria, b.factorWeights),
  }));
}
