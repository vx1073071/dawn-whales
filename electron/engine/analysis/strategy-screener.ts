// ── Q37: Strategy Screener ───────────────────────────────────────────────────
// Multi-factor screening: momentum / quality / value / sentiment
// Score ranking + universe filtering + Top-N with explainability

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockMetrics {
  symbol: string;
  name?: string;

  // Momentum
  momentum1m?: number;     // 1-month return
  momentum3m?: number;     // 3-month return
  momentum6m?: number;    // 6-month return
  momentum12m?: number;   // 12-month return

  // Quality
  roe?: number;           // Return on equity
  debtToEquity?: number;  // Leverage
  grossMargin?: number;   // Gross margin %
  revenueGrowth?: number; // Revenue growth YoY
  earningsYield?: number; // E/P ratio

  // Value
  peRatio?: number;
  pbRatio?: number;
  pcRatio?: number;
  psRatio?: number;
  dividendYield?: number;

  // Sentiment
  sentimentScore?: number; // 0-1 bullish
  analystRating?: number; // 1-5 scale
  newsFlow?: number;       // News count (normalized)

  // Technical
  rsi14?: number;
  sma50vs200?: number;    // Price / SMA200 ratio
  volatility20d?: number; // 20-day vol

  // Liquidity
  avgDailyVolume?: number;
  marketCap?: number;
}

export interface ScreenerResult {
  symbol: string;
  name?: string;
  compositeScore: number;  // 0-100
  rank: number;
  factorScores: Record<string, number>;
  strengthFactors: string[];
  riskFactors: string[];
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'SKIP';
  explanation: string;
}

export interface ScreenerConfig {
  universe: StockMetrics[];
  factors: Array<{
    name: string;
    weight: number;
    direction: 'positive' | 'negative';
    min?: number;
    max?: number;
  }>;
  topN?: number;
  minScore?: number;
  scoreMethod: 'equal' | 'weighted' | 'rank';
}

// ── Factor Z-Score Normalization ──────────────────────────────────────────

function zScore(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return values.map(() => 0);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return values.map(v => sd > 0 ? (v - mean) / sd : 0);
}

function rankNormalize(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v);
  return indexed
    .sort((a, b) => a.i - b.i)
    .map((el, rank) => rank / Math.max(values.length - 1, 1));
}

// ── Strategy Screener ────────────────────────────────────────────────────

export class StrategyScreener {
  constructor() {
    log.info('[StrategyScreener] Initialized');
  }

  // ── Score Single Stock ──────────────────────────────────────────────

  scoreStock(stock: StockMetrics, factors: ScreenerConfig['factors']): {
    compositeScore: number;
    factorScores: Record<string, number>;
  } {
    const factorScores: Record<string, number> = {};
    let totalScore = 0, totalWeight = 0;

    for (const factor of factors) {
      let value: number | undefined;

      switch (factor.name) {
        case 'momentum': value = stock.momentum3m ?? stock.momentum1m; break;
        case 'quality_ROE': value = stock.roe; break;
        case 'quality_Margin': value = stock.grossMargin; break;
        case 'quality_Growth': value = stock.revenueGrowth; break;
        case 'value_PE': value = stock.peRatio; break;
        case 'value_PB': value = stock.pbRatio; break;
        case 'value_DY': value = stock.dividendYield; break;
        case 'sentiment': value = stock.sentimentScore; break;
        case 'analyst': value = stock.analystRating; break;
        case 'tech_RSI': value = stock.rsi14; break;
        case 'tech_SMA': value = stock.sma50vs200; break;
        case 'volatility': value = stock.volatility20d; break;
        case 'liquidity': value = stock.avgDailyVolume; break;
        case 'leverage': value = stock.debtToEquity; break;
        default: continue;
      }

      if (value === undefined || (factor.min !== undefined && value < factor.min) ||
        (factor.max !== undefined && value > factor.max)) {
        factorScores[factor.name] = 0;
        continue;
      }

      // Direction
      let score = factor.direction === 'positive' ? value : -value;
      // Normalize to 0-100
      score = Math.max(0, Math.min(100, score));
      factorScores[factor.name] = Math.round(score * 100) / 100;
      totalScore += score * factor.weight;
      totalWeight += factor.weight;
    }

    const compositeScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    return { compositeScore: Math.round(compositeScore * 100) / 100, factorScores };
  }

  // ── Screen Universe ─────────────────────────────────────────────────

  screen(config: ScreenerConfig): ScreenerResult[] {
    const { universe, factors, topN = 20, minScore = 0, scoreMethod } = config;

    log.info(`[StrategyScreener] Screening ${universe.length} stocks with ${factors.length} factors`);

    if (universe.length === 0 || factors.length === 0) return [];

    // Compute raw scores
    const scored = universe.map(stock => {
      const { compositeScore, factorScores } = this.scoreStock(stock, factors);

      // Find strength/risk factors
      const strengthFactors: string[] = [];
      const riskFactors: string[] = [];

      for (const [fname, fscore] of Object.entries(factorScores)) {
        if (fscore >= 70) strengthFactors.push(`${fname} (${fscore.toFixed(0)})`);
        if (fscore <= 30) riskFactors.push(`${fname} (${fscore.toFixed(0)})`);
      }

      // Recommendation
      let recommendation: ScreenerResult['recommendation'];
      if (compositeScore >= 75 && strengthFactors.length >= 2) recommendation = 'STRONG_BUY';
      else if (compositeScore >= 60) recommendation = 'BUY';
      else if (compositeScore >= 40) recommendation = 'HOLD';
      else if (compositeScore >= 25) recommendation = 'SELL';
      else recommendation = 'SKIP';

      // Explanation
      const topStrength = strengthFactors.slice(0, 2).join(', ');
      const topRisk = riskFactors.slice(0, 2).join(', ');
      let explanation = `Score ${compositeScore.toFixed(1)}/100 [${recommendation}]. `;
      if (topStrength) explanation += `Strengths: ${topStrength}. `;
      if (topRisk) explanation += `Risks: ${topRisk}.`;
      if (!topStrength && !topRisk) explanation += 'Average profile across factors.';

      return {
        symbol: stock.symbol,
        name: stock.name,
        compositeScore,
        rank: 0,
        factorScores,
        strengthFactors,
        riskFactors,
        recommendation,
        explanation,
      } as ScreenerResult;
    });

    // Sort and rank
    const sorted = scored
      .filter(s => s.compositeScore >= minScore)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    return sorted.slice(0, topN);
  }

  // ── Default Screening ──────────────────────────────────────────────

  screenDefault(universe: StockMetrics[], topN = 20): ScreenerResult[] {
    const factors: ScreenerConfig['factors'] = [
      { name: 'momentum', weight: 0.20, direction: 'positive' },
      { name: 'quality_ROE', weight: 0.15, direction: 'positive' },
      { name: 'quality_Growth', weight: 0.10, direction: 'positive' },
      { name: 'value_PE', weight: 0.10, direction: 'negative' },
      { name: 'value_PB', weight: 0.10, direction: 'negative' },
      { name: 'sentiment', weight: 0.10, direction: 'positive' },
      { name: 'analyst', weight: 0.10, direction: 'positive' },
      { name: 'leverage', weight: 0.15, direction: 'negative', max: 2.0 },
    ];

    return this.screen({ universe, factors, topN, scoreMethod: 'weighted' });
  }
}

export default StrategyScreener;