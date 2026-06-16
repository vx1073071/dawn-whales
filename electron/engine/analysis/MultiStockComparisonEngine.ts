/**
 * AI-05 MultiStockComparisonEngine — R255 QUANT MOO
 *
 * 多股对比引擎。对用户选定的多只股票进行全方位对比分析，
 * 输出结构化排名、相似度矩阵、关键差异点与配置建议。
 *
 * 对比维度:
 * 1. Valuation (估值) — P/E, P/B, P/S, EV/EBITDA
 * 2. Growth (成长) — Rev growth, EPS growth, FCF growth
 * 3. Profitability (盈利) — ROE, ROA, net margin, op margin
 * 4. Momentum (动量) — 1W/1M/3M/6M returns, RSI
 * 5. Risk (风险) — Beta, volatility, max drawdown, Sharpe
 * 6. Quality (质量) — Debt/Equity, current ratio, FCF yield
 * 7. Sentiment (情绪) — Analyst consensus, insider activity
 *
 * Output:
 * - Per-stock scorecards with percentile rankings
 * - Pairwise similarity matrix (Euclidean distance)
 * - Radar chart data (7-axis normalized scores)
 * - Key differentiators (top 3 advantages per stock)
 * - Portfolio-fit recommendation (growth/value/momentum)
 *
 * Architecture:
 * - Singleton with reset() for testability
 * - EventEmitter for comparison events
 * - Mock data generators for dev/test
 *
 * @author JVS
 * @round R255
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export interface StockMetrics {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  // Valuation
  pe: number;
  pb: number;
  ps: number;
  evEbitda: number;
  // Growth
  revGrowth3Y: number;
  epsGrowth3Y: number;
  fcfGrowth3Y: number;
  // Profitability
  roe: number;
  roa: number;
  netMargin: number;
  opMargin: number;
  // Momentum
  return1W: number;
  return1M: number;
  return3M: number;
  return6M: number;
  rsi: number;
  // Risk
  beta: number;
  volatility30D: number;
  maxDrawdown1Y: number;
  sharpe: number;
  // Quality
  debtEquity: number;
  currentRatio: number;
  fcfYield: number;
  // Sentiment
  analystConsensus: number;   // 1-5 scale
  insiderActivity: number;    // -100 to +100
  // Timestamp
  timestamp: number;
}

export interface DimensionScore {
  name: string;
  rawValue: number;
  normalizedScore: number;    // 0-100
  percentile: number;         // 0-100 (among group)
  label: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
}

export interface StockScorecard {
  symbol: string;
  name: string;
  dimensions: Record<string, DimensionScore>;
  overallScore: number;        // 0-100
  rank: number;                // 1-based rank in group
  strengths: string[];         // top 3 strengths
  weaknesses: string[];        // top 3 weaknesses
  fit: 'growth' | 'value' | 'momentum' | 'balanced' | 'defensive';
  summary: string;
}

export interface PairwiseComparison {
  symbolA: string;
  symbolB: string;
  distance: number;            // Euclidean distance (normalized)
  similarity: number;         // 0-1 (higher = more similar)
  keyDifferences: string[];   // where A differs most from B
}

export interface ComparisonResult {
  id: string;
  symbols: string[];
  scorecards: StockScorecard[];
  pairwiseMatrix: PairwiseComparison[];
  radarData: Record<string, number[]>;  // symbol → [7 axes]
  axes: string[];
  recommendations: string[];
  generatedAt: number;
}

export interface ComparisonConfig {
  dimensionWeights: Record<string, number>;
  usePercentiles: boolean;
  maxRecommendations: number;
  detailLevel: 'summary' | 'moderate' | 'full';
}

// ─── Constants ───────────────────────────────────────────

const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  dimensionWeights: {
    valuation: 20,
    growth: 20,
    profitability: 15,
    momentum: 15,
    risk: 10,
    quality: 10,
    sentiment: 10,
  },
  usePercentiles: true,
  maxRecommendations: 5,
  detailLevel: 'moderate',
};

const DIMENSION_KEYS: Array<{ id: string; label: string; metrics: Array<keyof StockMetrics> }> = [
  { id: 'valuation', label: '估值', metrics: ['pe', 'pb', 'ps', 'evEbitda'] },
  { id: 'growth', label: '成长', metrics: ['revGrowth3Y', 'epsGrowth3Y', 'fcfGrowth3Y'] },
  { id: 'profitability', label: '盈利', metrics: ['roe', 'roa', 'netMargin', 'opMargin'] },
  { id: 'momentum', label: '动量', metrics: ['return1W', 'return1M', 'return3M', 'return6M', 'rsi'] },
  { id: 'risk', label: '风险', metrics: ['beta', 'volatility30D', 'maxDrawdown1Y', 'sharpe'] },
  { id: 'quality', label: '质量', metrics: ['debtEquity', 'currentRatio', 'fcfYield'] },
  { id: 'sentiment', label: '情绪', metrics: ['analystConsensus', 'insiderActivity'] },
];

// ─── Engine ──────────────────────────────────────────────

export class MultiStockComparisonEngine extends EventEmitter {
  private static instance: MultiStockComparisonEngine;

  private config: ComparisonConfig = { ...DEFAULT_COMPARISON_CONFIG, dimensionWeights: { ...DEFAULT_COMPARISON_CONFIG.dimensionWeights } };
  private lastResult: ComparisonResult | null = null;
  private compareCount = 0;

  private constructor() {
    super();
  }

  static getInstance(): MultiStockComparisonEngine {
    if (!MultiStockComparisonEngine.instance) {
      MultiStockComparisonEngine.instance = new MultiStockComparisonEngine();
    }
    return MultiStockComparisonEngine.instance;
  }

  reset(): void {
    this.config = { ...DEFAULT_COMPARISON_CONFIG, dimensionWeights: { ...DEFAULT_COMPARISON_CONFIG.dimensionWeights } };
    this.lastResult = null;
    this.compareCount = 0;
    this.removeAllListeners();
  }

  // ─── Config ────────────────────────────────────────

  configure(partial: Partial<ComparisonConfig> & { dimensionWeights?: Partial<Record<string, number>> }): void {
    if (partial.dimensionWeights) Object.assign(this.config.dimensionWeights, partial.dimensionWeights);
    Object.assign(this.config, partial);
    delete (this.config as any).dimensionWeights;
    if (partial.dimensionWeights) this.config.dimensionWeights = { ...DEFAULT_COMPARISON_CONFIG.dimensionWeights, ...partial.dimensionWeights };
  }

  getConfig(): Readonly<ComparisonConfig> {
    return JSON.parse(JSON.stringify(this.config));
  }

  // ─── Normalization ──────────────────────────────────

  /**
   * Normalize a raw value to 0-100 score within the group.
   * Higher is better by default. For metrics where lower is better
   * (pe, pb, debtEquity, volatility, maxDrawdown, beta), we invert.
   */
  private normalize(values: number[], invert = false): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => 50);

    return values.map(v => {
      const ratio = (v - min) / (max - min);
      const score = invert ? (1 - ratio) * 100 : ratio * 100;
      return Math.round(score * 100) / 100;
    });
  }

  private computePercentile(values: number[], target: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const rank = sorted.filter(v => v < target).length;
    return Math.round(rank / sorted.length * 100);
  }

  private valueLabel(percentile: number): DimensionScore['label'] {
    if (percentile >= 80) return 'excellent';
    if (percentile >= 60) return 'good';
    if (percentile >= 40) return 'average';
    if (percentile >= 20) return 'below_average';
    return 'poor';
  }

  // ─── Dimension Scoring ──────────────────────────────

  private scoreDimension(
    dimId: string,
    symbols: StockMetrics[],
    idx: number
  ): DimensionScore {
    const metrics = DIMENSION_KEYS.find(d => d.id === dimId)!.metrics;
    const invertSet = new Set<string>(['pe', 'pb', 'ps', 'evEbitda', 'debtEquity', 'volatility30D', 'maxDrawdown1Y', 'beta']);

    // Compute composite score
    let composite = 0;
    let count = 0;
    for (const metric of metrics) {
      const values = symbols.map(s => s[metric] as number);
      const normalized = this.normalize(values, invertSet.has(metric));
      composite += normalized[idx];
      count++;
    }
    const normalizedScore = count > 0 ? composite / count : 50;

    const allScores = symbols.map(() => {
      let c = 0;
      let n = 0;
      for (const metric of metrics) {
        const values = symbols.map(s => s[metric] as number);
        const norm = this.normalize(values, invertSet.has(metric));
        c += norm[idx];
        n++;
      }
      return n > 0 ? c / n : 50;
    });

    const percentile = this.computePercentile(allScores, normalizedScore);
    const rawValue = symbols[idx][metrics[0]] as number;

    return {
      name: DIMENSION_KEYS.find(d => d.id === dimId)!.label,
      rawValue,
      normalizedScore,
      percentile,
      label: this.valueLabel(percentile),
    };
  }

  // ─── Core Comparison ────────────────────────────────

  compare(symbols: StockMetrics[]): ComparisonResult {
    if (symbols.length < 2) {
      throw new Error('At least 2 symbols required for comparison');
    }

    const dimensionOrder = DIMENSION_KEYS.map(d => d.id);
    const scorecards: StockScorecard[] = [];
    const radarData: Record<string, number[]> = {};

    for (let i = 0; i < symbols.length; i++) {
      const s = symbols[i];
      const dimensions: Record<string, DimensionScore> = {};

      let weightedSum = 0;
      let weightTotal = 0;

      for (const dim of DIMENSION_KEYS) {
        const score = this.scoreDimension(dim.id, symbols, i);
        dimensions[dim.id] = score;
        weightedSum += score.normalizedScore * (this.config.dimensionWeights[dim.id] ?? 10);
        weightTotal += (this.config.dimensionWeights[dim.id] ?? 10);
      }

      const overallScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal * 100) / 100 : 50;

      const strengths = Object.entries(dimensions)
        .filter(([, d]) => d.percentile >= 80)
        .map(([, d]) => d.name);
      const weaknesses = Object.entries(dimensions)
        .filter(([, d]) => d.percentile <= 20)
        .map(([, d]) => d.name);

      // Fit classification
      const moScore = dimensions.momentum?.percentile ?? 50;
      const grScore = dimensions.growth?.percentile ?? 50;
      const valScore = dimensions.valuation?.percentile ?? 50;
      const riskScore = dimensions.risk?.percentile ?? 50;

      let fit: StockScorecard['fit'] = 'balanced';
      if (moScore >= 75 && grScore >= 60) fit = 'momentum';
      else if (valScore >= 70 && riskScore >= 50) fit = 'value';
      else if (grScore >= 70 && (dimensions.profitability?.percentile ?? 0) >= 50) fit = 'growth';
      else if (riskScore >= 80) fit = 'defensive';

      // Radar data
      radarData[s.symbol] = dimensionOrder.map(d => dimensions[d]?.percentile ?? 50);

      scorecards.push({
        symbol: s.symbol,
        name: s.name,
        dimensions,
        overallScore,
        rank: 0, // filled below
        strengths: strengths.slice(0, 3),
        weaknesses: weaknesses.slice(0, 3),
        fit,
        summary: `${s.symbol} 综合得分${overallScore.toFixed(0)}，${fit}类型，强项${strengths[0] ?? '无'}。`,
      });
    }

    // Rank by overall score (reuse symbols loop — actually we need to sort)
    const sorted = [...scorecards].sort((a, b) => b.overallScore - a.overallScore);
    for (let i = 0; i < scorecards.length; i++) {
      scorecards[i].rank = sorted.findIndex(s => s.symbol === scorecards[i].symbol) + 1;
    }

    // Pairwise matrix
    const pairwiseMatrix: PairwiseComparison[] = [];
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const aDim = radarData[symbols[i].symbol];
        const bDim = radarData[symbols[j].symbol];
        const diff = aDim.reduce((sum, a, k) => sum + (a - bDim[k]) ** 2, 0);
        const distance = Math.sqrt(diff);
        const similarity = Math.max(0, 1 - distance / 100);

        const differences: string[] = [];
        for (let k = 0; k < dimensionOrder.length; k++) {
          if (Math.abs(aDim[k] - bDim[k]) > 20) {
            const dimLabel = DIMENSION_KEYS[k].label;
            differences.push(`${dimLabel}: ${symbols[i].symbol}(${aDim[k].toFixed(0)}) vs ${symbols[j].symbol}(${bDim[k].toFixed(0)})`);
          }
        }

        pairwiseMatrix.push({
          symbolA: symbols[i].symbol,
          symbolB: symbols[j].symbol,
          distance,
          similarity: Math.round(similarity * 1000) / 1000,
          keyDifferences: differences.slice(0, 3),
        });
      }
    }

    // Recommendations
    const recommendations = this.generateRecommendations(scorecards, pairwiseMatrix);

    this.compareCount++;

    const result: ComparisonResult = {
      id: `compare-${this.compareCount}-${Date.now()}`,
      symbols: symbols.map(s => s.symbol),
      scorecards,
      pairwiseMatrix,
      radarData,
      axes: dimensionOrder,
      recommendations,
      generatedAt: Date.now(),
    };

    this.lastResult = result;
    this.emit('comparison', result);

    return result;
  }

  // ─── Recommendations ────────────────────────────────

  private generateRecommendations(
    scorecards: StockScorecard[],
    pairwise: PairwiseComparison[]
  ): string[] {
    const recs: string[] = [];

    // Best overall
    const best = [...scorecards].sort((a, b) => b.overallScore - a.overallScore)[0];
    if (best) {
      recs.push(`综合最优: ${best.symbol} (${best.overallScore.toFixed(0)}分)，${best.fit}型，强于${best.strengths.join('、')}`);
    }

    // Best value
    const bestVal = [...scorecards].sort((a, b) =>
      (b.dimensions.valuation?.percentile ?? 0) - (a.dimensions.valuation?.percentile ?? 0)
    )[0];
    if (bestVal && bestVal.symbol !== best?.symbol) {
      recs.push(`估值最优: ${bestVal.symbol} (估值分位${bestVal.dimensions.valuation?.percentile ?? 0})`);
    }

    // Best growth
    const bestGrowth = [...scorecards].sort((a, b) =>
      (b.dimensions.growth?.percentile ?? 0) - (a.dimensions.growth?.percentile ?? 0)
    )[0];
    if (bestGrowth) {
      recs.push(`成长最强: ${bestGrowth.symbol} (成长分位${bestGrowth.dimensions.growth?.percentile ?? 0})`);
    }

    // Most defensive (lowest risk + high quality)
    const bestDef = [...scorecards].sort((a, b) => {
      const aScore = (a.dimensions.risk?.percentile ?? 0) + (a.dimensions.quality?.percentile ?? 0);
      const bScore = (b.dimensions.risk?.percentile ?? 0) + (b.dimensions.quality?.percentile ?? 0);
      return bScore - aScore;
    })[0];
    if (bestDef) {
      recs.push(`防守最优: ${bestDef.symbol} (风险分位${bestDef.dimensions.risk?.percentile ?? 0}，质量分位${bestDef.dimensions.quality?.percentile ?? 0})`);
    }

    // Most complementary pair (lowest similarity)
    const leastSimilar = [...pairwise].sort((a, b) => a.similarity - b.similarity)[0];
    if (leastSimilar) {
      recs.push(`最佳互补对: ${leastSimilar.symbolA}+${leastSimilar.symbolB} (相似度${(leastSimilar.similarity * 100).toFixed(0)}%，差异最大)`);
    }

    return recs.slice(0, this.config.maxRecommendations);
  }

  // ─── Query ──────────────────────────────────────────

  getLastResult(): ComparisonResult | null {
    return this.lastResult;
  }

  getCompareCount(): number {
    return this.compareCount;
  }

  getRadarData(symbol: string): number[] | undefined {
    return this.lastResult?.radarData[symbol.toUpperCase()];
  }

  getPairwiseDistance(symbolA: string, symbolB: string): number | undefined {
    const result = this.lastResult;
    if (!result) return undefined;
    const pair = result.pairwiseMatrix.find(
      p => (p.symbolA === symbolA && p.symbolB === symbolB) || (p.symbolA === symbolB && p.symbolB === symbolA)
    );
    return pair?.distance;
  }

  // ─── Dimension Info ─────────────────────────────────

  getDimensionKeys(): Array<{ id: string; label: string }> {
    return DIMENSION_KEYS.map(d => ({ id: d.id, label: d.label }));
  }

  // ─── Mock Data ──────────────────────────────────────

  createMockMetrics(overrides: Partial<StockMetrics> & { symbol: string }): StockMetrics {
    return {
      name: overrides.symbol,
      sector: 'Technology',
      marketCap: 2.5e12,
      price: 185,
      pe: 30,
      pb: 12,
      ps: 7,
      evEbitda: 22,
      revGrowth3Y: 15,
      epsGrowth3Y: 20,
      fcfGrowth3Y: 18,
      roe: 35,
      roa: 15,
      netMargin: 25,
      opMargin: 32,
      return1W: 2.5,
      return1M: 5,
      return3M: 12,
      return6M: 18,
      rsi: 58,
      beta: 1.2,
      volatility30D: 22,
      maxDrawdown1Y: 15,
      sharpe: 1.5,
      debtEquity: 0.8,
      currentRatio: 2.1,
      fcfYield: 3.5,
      analystConsensus: 4.2,
      insiderActivity: 5,
      timestamp: Date.now(),
      ...overrides,
    };
  }

  createMockGroup(): StockMetrics[] {
    return [
      this.createMockMetrics({ symbol: 'AAPL', name: 'Apple', pe: 30, pb: 42, roe: 145, revGrowth3Y: 8, sector: 'Technology', beta: 1.2 }),
      this.createMockMetrics({ symbol: 'MSFT', name: 'Microsoft', pe: 35, pb: 13, roe: 38, revGrowth3Y: 15, sector: 'Technology', beta: 0.9 }),
      this.createMockMetrics({ symbol: 'GOOG', name: 'Alphabet', pe: 25, pb: 7, roe: 28, revGrowth3Y: 18, sector: 'Technology', beta: 1.1 }),
      this.createMockMetrics({ symbol: 'AMZN', name: 'Amazon', pe: 55, pb: 8, roe: 20, revGrowth3Y: 12, sector: 'Consumer', beta: 1.3 }),
      this.createMockMetrics({ symbol: 'NVDA', name: 'NVIDIA', pe: 65, pb: 50, roe: 90, revGrowth3Y: 60, sector: 'Technology', beta: 1.7 }),
    ];
  }
}
