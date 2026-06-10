// ── Multi-Factor Selection Engine (JVS-56) ──────────────────────────────────
// Score and rank stocks using multiple factors
// Supports: momentum, value, quality, volatility, liquidity factors
// IPC: factor:score, factor:rank, factor:screen

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockData {
  code: string;
  name: string;
  sector?: string;
  // Price data
  price: number;
  priceChange1M: number;    // 1-month return %
  priceChange3M: number;    // 3-month return %
  priceChange6M: number;    // 6-month return %
  priceChange1Y: number;    // 1-year return %
  // Value metrics
  pe: number;               // P/E ratio
  pb: number;               // P/B ratio
  ps: number;               // P/S ratio
  evEbitda: number;         // EV/EBITDA
  dividendYield: number;    // Dividend yield %
  // Quality metrics
  roe: number;              // Return on equity %
  roa: number;              // Return on assets %
  profitMargin: number;     // Net profit margin %
  debtToEquity: number;     // Debt/Equity ratio
  revenueGrowth: number;    // Revenue growth %
  // Volatility
  volatility20D: number;    // 20-day volatility %
  volatility60D: number;    // 60-day volatility %
  beta: number;             // Beta vs benchmark
  // Liquidity
  avgVolume20D: number;     // 20-day avg volume
  turnoverRate: number;     // Turnover rate %
  marketCap: number;        // Market cap (millions)
}

export interface FactorScore {
  factor: string;
  score: number;            // 0-100
  weight: number;           // Weight in composite score
  weightedScore: number;    // score * weight
  rawValue: number;         // Raw factor value
  percentile: number;       // 0-100 percentile vs universe
}

export interface StockScore {
  code: string;
  name: string;
  sector?: string;
  compositeScore: number;   // 0-100
  rank: number;
  factors: FactorScore[];
  // Summary
  valueScore: number;
  momentumScore: number;
  qualityScore: number;
  volatilityScore: number;
  liquidityScore: number;
}

export interface FactorScreenResult {
  success: boolean;
  totalStocks: number;
  scoredStocks: number;
  scores: StockScore[];
  // Top/Bottom performers
  top10: StockScore[];
  bottom10: StockScore[];
  // Factor weights used
  factorWeights: Record<string, number>;
  // Statistics
  avgScore: number;
  medianScore: number;
  // Recommendations
  recommendations: string[];
  timestamp: number;
  error?: string;
}

// ── Factor Scoring Functions ───────────────────────────────────────────────

function scoreMomentum(stock: StockData): number {
  // Composite momentum: weighted average of returns
  const m1 = stock.priceChange1M;
  const m3 = stock.priceChange3M;
  const m6 = stock.priceChange6M;
  const m12 = stock.priceChange1Y;

  // Weighted momentum score (skip most recent month - momentum reversal)
  const momentum = (m3 * 0.3 + m6 * 0.4 + m12 * 0.3) - m1 * 0.1;

  // Normalize to 0-100
  return Math.max(0, Math.min(100, 50 + momentum * 2));
}

function scoreValue(stock: StockData): number {
  let score = 50;

  // P/E: lower is better (inverted)
  if (stock.pe > 0 && stock.pe < 100) {
    score += Math.max(-25, Math.min(25, (20 - stock.pe) * 1.5));
  }

  // P/B: lower is better
  if (stock.pb > 0 && stock.pb < 20) {
    score += Math.max(-20, Math.min(20, (3 - stock.pb) * 5));
  }

  // P/S: lower is better
  if (stock.ps > 0 && stock.ps < 30) {
    score += Math.max(-15, Math.min(15, (5 - stock.ps) * 2));
  }

  // EV/EBITDA: lower is better
  if (stock.evEbitda > 0 && stock.evEbitda < 50) {
    score += Math.max(-15, Math.min(15, (15 - stock.evEbitda) * 2));
  }

  // Dividend yield: higher is better
  if (stock.dividendYield > 0) {
    score += Math.min(15, stock.dividendYield * 3);
  }

  return Math.max(0, Math.min(100, score));
}

function scoreQuality(stock: StockData): number {
  let score = 50;

  // ROE: higher is better
  if (stock.roe > 0) {
    score += Math.min(25, stock.roe * 1.5);
  }

  // ROA: higher is better
  if (stock.roa > 0) {
    score += Math.min(15, stock.roa * 2);
  }

  // Profit margin: higher is better
  if (stock.profitMargin > 0) {
    score += Math.min(15, stock.profitMargin * 1.5);
  }

  // Debt/Equity: lower is better
  if (stock.debtToEquity >= 0) {
    score += Math.max(-20, Math.min(20, (1 - stock.debtToEquity) * 10));
  }

  // Revenue growth: higher is better
  if (stock.revenueGrowth > 0) {
    score += Math.min(15, stock.revenueGrowth * 0.5);
  }

  return Math.max(0, Math.min(100, score));
}

function scoreVolatility(stock: StockData): number {
  let score = 50;

  // Lower volatility is better (for risk-adjusted returns)
  if (stock.volatility20D > 0) {
    score += Math.max(-30, Math.min(30, (30 - stock.volatility20D) * 1.5));
  }

  // Lower beta is better (less systematic risk)
  if (stock.beta > 0) {
    score += Math.max(-20, Math.min(20, (1 - stock.beta) * 15));
  }

  return Math.max(0, Math.min(100, score));
}

function scoreLiquidity(stock: StockData): number {
  let score = 50;

  // Higher volume is better (more liquid)
  if (stock.avgVolume20D > 0) {
    const logVolume = Math.log10(stock.avgVolume20D);
    score += Math.max(-30, Math.min(30, (logVolume - 6) * 15));
  }

  // Higher turnover is better
  if (stock.turnoverRate > 0) {
    score += Math.min(20, stock.turnoverRate * 5);
  }

  // Larger market cap is better (more liquid)
  if (stock.marketCap > 0) {
    const logCap = Math.log10(stock.marketCap);
    score += Math.max(-20, Math.min(20, (logCap - 3) * 10));
  }

  return Math.max(0, Math.min(100, score));
}

// ── Main Scoring Function ──────────────────────────────────────────────────

function scoreStock(stock: StockData, weights: Record<string, number>): StockScore {
  const momentumScore = scoreMomentum(stock);
  const valueScore = scoreValue(stock);
  const qualityScore = scoreQuality(stock);
  const volatilityScore = scoreVolatility(stock);
  const liquidityScore = scoreLiquidity(stock);

  const factors: FactorScore[] = [
    { factor: 'momentum', score: momentumScore, weight: weights.momentum, weightedScore: momentumScore * weights.momentum, rawValue: stock.priceChange6M, percentile: 0 },
    { factor: 'value', score: valueScore, weight: weights.value, weightedScore: valueScore * weights.value, rawValue: stock.pe, percentile: 0 },
    { factor: 'quality', score: qualityScore, weight: weights.quality, weightedScore: qualityScore * weights.quality, rawValue: stock.roe, percentile: 0 },
    { factor: 'volatility', score: volatilityScore, weight: weights.volatility, weightedScore: volatilityScore * weights.volatility, rawValue: stock.volatility20D, percentile: 0 },
    { factor: 'liquidity', score: liquidityScore, weight: weights.liquidity, weightedScore: liquidityScore * weights.liquidity, rawValue: stock.avgVolume20D, percentile: 0 },
  ];

  const compositeScore = factors.reduce((sum, f) => sum + f.weightedScore, 0);

  return {
    code: stock.code,
    name: stock.name,
    sector: stock.sector,
    compositeScore: Math.round(compositeScore * 100) / 100,
    rank: 0,
    factors,
    valueScore: Math.round(valueScore * 100) / 100,
    momentumScore: Math.round(momentumScore * 100) / 100,
    qualityScore: Math.round(qualityScore * 100) / 100,
    volatilityScore: Math.round(volatilityScore * 100) / 100,
    liquidityScore: Math.round(liquidityScore * 100) / 100,
  };
}

// ── Main Function ──────────────────────────────────────────────────────────

export function scoreAndRankStocks(
  stocks: StockData[],
  factorWeights?: Record<string, number>
): FactorScreenResult {
  const weights = factorWeights || {
    momentum: 0.25,
    value: 0.25,
    quality: 0.25,
    volatility: 0.15,
    liquidity: 0.10,
  };

  log.info(`[MultiFactor] Scoring ${stocks.length} stocks with ${Object.keys(weights).length} factors`);

  if (!stocks || stocks.length === 0) {
    return {
      success: false,
      totalStocks: 0,
      scoredStocks: 0,
      scores: [],
      top10: [],
      bottom10: [],
      factorWeights: weights,
      avgScore: 0,
      medianScore: 0,
      recommendations: [],
      timestamp: Date.now(),
      error: 'No stocks provided',
    };
  }

  // Score all stocks
  const scores: StockScore[] = stocks.map(s => scoreStock(s, weights));

  // Rank by composite score (descending)
  scores.sort((a, b) => b.compositeScore - a.compositeScore);
  scores.forEach((s, i) => { s.rank = i + 1; });

  // Calculate percentiles for each factor
  for (const factor of ['momentum', 'value', 'quality', 'volatility', 'liquidity']) {
    const factorScores = scores.map(s => s.factors.find(f => f.factor === factor)?.score || 0).sort((a, b) => a - b);
    for (const score of scores) {
      const factorScore = score.factors.find(f => f.factor === factor);
      if (factorScore) {
        const idx = factorScores.indexOf(factorScore.score);
        factorScore.percentile = Math.round((idx / factorScores.length) * 100);
      }
    }
  }

  // Statistics
  const allScores = scores.map(s => s.compositeScore);
  const avgScore = allScores.reduce((s, v) => s + v, 0) / allScores.length;
  const sorted = [...allScores].sort((a, b) => a - b);
  const medianScore = sorted[Math.floor(sorted.length / 2)];

  // Top/Bottom 10
  const top10 = scores.slice(0, 10);
  const bottom10 = scores.slice(-10).reverse();

  // Recommendations
  const recommendations: string[] = [];

  if (top10.length > 0) {
    recommendations.push(`Top 10 股票平均综合评分: ${top10.reduce((s, s2) => s + s2.compositeScore, 0) / top10.length}`);
    const topSectors = [...new Set(top10.map(s => s.sector).filter(Boolean))];
    if (topSectors.length > 0) {
      recommendations.push(`Top 10 涵盖板块: ${topSectors.join(', ')}`);
    }
  }

  if (top10[0] && top10[0].momentumScore > 70) {
    recommendations.push(`动量因子强势，市场趋势明确。`);
  }

  if (top10[0] && top10[0].valueScore > 70) {
    recommendations.push(`价值因子突出，低估值机会多。`);
  }

  if (top10[0] && top10[0].qualityScore > 70) {
    recommendations.push(`质量因子领先，优质公司集中。`);
  }

  const result: FactorScreenResult = {
    success: true,
    totalStocks: stocks.length,
    scoredStocks: scores.length,
    scores,
    top10,
    bottom10,
    factorWeights: weights,
    avgScore: Math.round(avgScore * 100) / 100,
    medianScore: Math.round(medianScore * 100) / 100,
    recommendations,
    timestamp: Date.now(),
  };

  log.info(`[MultiFactor] Done: ${scores.length} stocks scored, avg ${avgScore.toFixed(2)}, median ${medianScore.toFixed(2)}`);

  return result;
}

// ── Screening Function ─────────────────────────────────────────────────────

export interface ScreenCriteria {
  minScore?: number;
  minMomentum?: number;
  minValue?: number;
  minQuality?: number;
  minVolatility?: number;
  minLiquidity?: number;
  sectors?: string[];
  excludeSectors?: string[];
  minMarketCap?: number;
  maxMarketCap?: number;
}

export function screenStocks(
  stocks: StockData[],
  criteria: ScreenCriteria,
  factorWeights?: Record<string, number>
): FactorScreenResult {
  log.info(`[MultiFactor] Screening ${stocks.length} stocks with criteria`);

  // Apply filters
  let filtered = stocks;

  if (criteria.sectors && criteria.sectors.length > 0) {
    filtered = filtered.filter(s => criteria.sectors!.includes(s.sector || ''));
  }

  if (criteria.excludeSectors && criteria.excludeSectors.length > 0) {
    filtered = filtered.filter(s => !criteria.excludeSectors!.includes(s.sector || ''));
  }

  if (criteria.minMarketCap !== undefined) {
    filtered = filtered.filter(s => s.marketCap >= criteria.minMarketCap!);
  }

  if (criteria.maxMarketCap !== undefined) {
    filtered = filtered.filter(s => s.marketCap <= criteria.maxMarketCap!);
  }

  // Score all
  const result = scoreAndRankStocks(filtered, factorWeights);

  // Apply score filters
  let scores = result.scores;

  if (criteria.minScore !== undefined) {
    scores = scores.filter(s => s.compositeScore >= criteria.minScore!);
  }

  if (criteria.minMomentum !== undefined) {
    scores = scores.filter(s => s.momentumScore >= criteria.minMomentum!);
  }

  if (criteria.minValue !== undefined) {
    scores = scores.filter(s => s.valueScore >= criteria.minValue!);
  }

  if (criteria.minQuality !== undefined) {
    scores = scores.filter(s => s.qualityScore >= criteria.minQuality!);
  }

  if (criteria.minVolatility !== undefined) {
    scores = scores.filter(s => s.volatilityScore >= criteria.minVolatility!);
  }

  if (criteria.minLiquidity !== undefined) {
    scores = scores.filter(s => s.liquidityScore >= criteria.minLiquidity!);
  }

  // Re-rank
  scores.sort((a, b) => b.compositeScore - a.compositeScore);
  scores.forEach((s, i) => { s.rank = i + 1; });

  const top10 = scores.slice(0, 10);
  const bottom10 = scores.slice(-10).reverse();

  return {
    ...result,
    scores,
    scoredStocks: scores.length,
    top10,
    bottom10,
    recommendations: [
      ...result.recommendations,
      `筛选后剩余 ${scores.length} 只股票 (原始 ${stocks.length} 只)`,
    ],
  };
}

// ── Batch Screening ────────────────────────────────────────────────────────

export async function batchScreenStocks(
  batches: { name: string; stocks: StockData[]; criteria: ScreenCriteria; factorWeights?: Record<string, number> }[]
): Promise<{ name: string; result: FactorScreenResult }[]> {
  log.info(`[MultiFactor] Batch screening ${batches.length} batches`);

  const results: { name: string; result: FactorScreenResult }[] = [];
  for (const batch of batches) {
    results.push({
      name: batch.name,
      result: screenStocks(batch.stocks, batch.criteria, batch.factorWeights),
    });
  }

  return results;
}
