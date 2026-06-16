/**
 * P2-16 Top5SelectionEngine — Top-5 Symbol Selection Engine
 * R250 — P2 Deepening
 * JVS / 引擎虾
 *
 * Multi-criteria ranking engine that selects the top-5 symbols to
 * trade based on composite scoring across technicals, fundamentals,
 * sentiment, liquidity, volatility, and momentum factors.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type RankingFactor =
  | 'technical_score'
  | 'fundamental_score'
  | 'sentiment_score'
  | 'liquidity_score'
  | 'volatility_score'
  | 'momentum_score'
  | 'volume_score'
  | 'trend_score'
  | 'risk_adjusted_score'
  | 'user_favorite_score';

export interface SymbolCandidate {
  symbol: string;
  market: string;
  factors: Record<RankingFactor, number>; // 0-100 per factor
}

export interface FactorWeight {
  factor: RankingFactor;
  weight: number; // 0-1
  enabled: boolean;
}

export interface RankedSymbol {
  rank: number;
  symbol: string;
  market: string;
  compositeScore: number; // 0-100
  factorBreakdown: Record<RankingFactor, number>;
  recommendation: 'strong_buy' | 'buy' | 'watch' | 'avoid';
  confidence: number; // 0-1
}

export interface Top5Result {
  timestamp: number;
  top5: RankedSymbol[];
  next5: RankedSymbol[]; // rank 6-10 for context
  totalCandidates: number;
  avgScore: number;
  /** Distribution of recommendations */
  buyCount: number;
  watchCount: number;
  avoidCount: number;
}

export interface FactorCorrelation {
  factorA: RankingFactor;
  factorB: RankingFactor;
  correlation: number; // -1 to 1
  significance: 'high' | 'medium' | 'low';
}

// ═══════════════════════════════════════════════════════════════
// Default Weights (balanced profile)
// ═══════════════════════════════════════════════════════════════

const DEFAULT_WEIGHTS: FactorWeight[] = [
  { factor: 'technical_score', weight: 0.15, enabled: true },
  { factor: 'fundamental_score', weight: 0.15, enabled: true },
  { factor: 'sentiment_score', weight: 0.12, enabled: true },
  { factor: 'liquidity_score', weight: 0.10, enabled: true },
  { factor: 'volatility_score', weight: 0.10, enabled: true },
  { factor: 'momentum_score', weight: 0.12, enabled: true },
  { factor: 'volume_score', weight: 0.08, enabled: true },
  { factor: 'trend_score', weight: 0.10, enabled: true },
  { factor: 'risk_adjusted_score', weight: 0.05, enabled: true },
  { factor: 'user_favorite_score', weight: 0.03, enabled: true },
];

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class Top5SelectionEngine {
  private static instance: Top5SelectionEngine;

  private candidates: Map<string, SymbolCandidate> = new Map();
  private weights: FactorWeight[] = DEFAULT_WEIGHTS.map(w => ({ ...w }));
  private results: Top5Result[] = [];
  private idCounter = 0;

  private constructor() {}

  static getInstance(): Top5SelectionEngine {
    if (!Top5SelectionEngine.instance) {
      Top5SelectionEngine.instance = new Top5SelectionEngine();
    }
    return Top5SelectionEngine.instance;
  }

  reset(): void {
    this.candidates.clear();
    this.weights = DEFAULT_WEIGHTS.map(w => ({ ...w }));
    this.results = [];
    this.idCounter = 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // Candidate Management
  // ═══════════════════════════════════════════════════════════════

  setCandidate(params: {
    symbol: string;
    market: string;
    factors: Partial<Record<RankingFactor, number>>;
  }): SymbolCandidate {
    const fullFactors: Record<RankingFactor, number> = {
      technical_score: 50,
      fundamental_score: 50,
      sentiment_score: 50,
      liquidity_score: 50,
      volatility_score: 50,
      momentum_score: 50,
      volume_score: 50,
      trend_score: 50,
      risk_adjusted_score: 50,
      user_favorite_score: 50,
      ...params.factors,
    };

    // Clamp all to 0-100
    for (const key of Object.keys(fullFactors) as RankingFactor[]) {
      fullFactors[key] = Math.max(0, Math.min(100, fullFactors[key]));
    }

    const candidate: SymbolCandidate = {
      symbol: params.symbol.toUpperCase(),
      market: params.market,
      factors: fullFactors,
    };

    this.candidates.set(candidate.symbol, candidate);
    return candidate;
  }

  removeCandidate(symbol: string): boolean {
    return this.candidates.delete(symbol.toUpperCase());
  }

  getCandidate(symbol: string): SymbolCandidate | undefined {
    return this.candidates.get(symbol.toUpperCase());
  }

  // ═══════════════════════════════════════════════════════════════
  // Weight Configuration
  // ═══════════════════════════════════════════════════════════════

  getWeights(): FactorWeight[] {
    return this.weights.map(w => ({ ...w }));
  }

  setWeights(updates: Partial<Record<RankingFactor, number>>): FactorWeight[] {
    // Sum of provided updates
    const providedSum = Object.values(updates).reduce((s, v) => s + (v || 0), 0);

    for (const w of this.weights) {
      if (updates[w.factor] !== undefined) {
        w.weight = updates[w.factor]!;
      }
    }

    // Normalize remaining weights if provided don't sum to 1
    if (Math.abs(providedSum - 1) > 0.001) {
      const remainingSum = this.weights.reduce((s, w) => {
        return updates[w.factor] !== undefined ? s : s + w.weight;
      }, 0);
      for (const w of this.weights) {
        if (updates[w.factor] === undefined && remainingSum > 0) {
          w.weight = w.weight / remainingSum * (1 - providedSum);
        }
      }
    }

    log.info(`[Top5] Weights updated: ${JSON.stringify(this.weights.map(w => `${w.factor}=${w.weight.toFixed(2)}`))}`);
    return this.getWeights();
  }

  enableFactor(factor: RankingFactor, enabled: boolean): void {
    const w = this.weights.find(fw => fw.factor === factor);
    if (w) w.enabled = enabled;
  }

  // ═══════════════════════════════════════════════════════════════
  // Ranking (Main Entry)
  // ═══════════════════════════════════════════════════════════════

  rankTop5(market?: string): Top5Result {
    const now = Date.now();
    let pool = Array.from(this.candidates.values());

    if (market) {
      pool = pool.filter(c => c.market === market);
    }

    if (pool.length === 0) {
      const empty: Top5Result = {
        timestamp: now, top5: [], next5: [], totalCandidates: 0, avgScore: 0,
        buyCount: 0, watchCount: 0, avoidCount: 0,
      };
      this.results.push(empty);
      return empty;
    }

    // Compute composite score for each candidate
    const enabledWeights = this.weights.filter(w => w.enabled);
    const totalWeight = enabledWeights.reduce((s, w) => s + w.weight, 0);

    const ranked: RankedSymbol[] = pool.map(c => {
      let compositeScore = 0;
      const breakdown: Record<RankingFactor, number> = { ...c.factors };

      for (const w of enabledWeights) {
        compositeScore += (c.factors[w.factor] || 0) * (w.weight / (totalWeight || 1));
      }
      compositeScore = Math.round(compositeScore * 100) / 100;

      const recommendation = compositeScore >= 80 ? 'strong_buy'
        : compositeScore >= 60 ? 'buy'
        : compositeScore >= 35 ? 'watch'
        : 'avoid';

      const confidence = Math.min(0.95, compositeScore / 100 + 0.1);

      return {
        rank: 0, // set after sort
        symbol: c.symbol,
        market: c.market,
        compositeScore,
        factorBreakdown: breakdown,
        recommendation,
        confidence,
      };
    });

    // Sort descending by composite score
    ranked.sort((a, b) => b.compositeScore - a.compositeScore);

    // Assign ranks
    for (let i = 0; i < ranked.length; i++) {
      ranked[i].rank = i + 1;
    }

    const top5 = ranked.slice(0, 5);
    const next5 = ranked.slice(5, 10);
    const avgScore = ranked.length > 0
      ? Math.round(ranked.reduce((s, r) => s + r.compositeScore, 0) / ranked.length * 100) / 100
      : 0;

    const result: Top5Result = {
      timestamp: now,
      top5,
      next5,
      totalCandidates: pool.length,
      avgScore,
      buyCount: ranked.filter(r => r.recommendation === 'strong_buy' || r.recommendation === 'buy').length,
      watchCount: ranked.filter(r => r.recommendation === 'watch').length,
      avoidCount: ranked.filter(r => r.recommendation === 'avoid').length,
    };

    this.results.push(result);
    log.info(`[Top5] Ranked ${pool.length} candidates: #1 ${top5[0]?.symbol || 'N/A'} (${top5[0]?.compositeScore || 0})`);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // Analysis
  // ═══════════════════════════════════════════════════════════════

  getLatestResult(): Top5Result | undefined {
    return this.results.length > 0 ? this.results[this.results.length - 1] : undefined;
  }

  getResultHistory(limit?: number): Top5Result[] {
    return this.results.slice(-(limit || 10));
  }

  compareFactors(factorA: RankingFactor, factorB: RankingFactor): FactorCorrelation {
    const candidates = Array.from(this.candidates.values());
    if (candidates.length < 3) {
      return { factorA, factorB, correlation: 0, significance: 'low' };
    }

    // Simple Pearson correlation approximation
    const valuesA: number[] = [];
    const valuesB: number[] = [];
    for (const c of candidates) {
      valuesA.push(c.factors[factorA] || 0);
      valuesB.push(c.factors[factorB] || 0);
    }

    const meanA = valuesA.reduce((s, v) => s + v, 0) / valuesA.length;
    const meanB = valuesB.reduce((s, v) => s + v, 0) / valuesB.length;

    let num = 0;
    let denA = 0;
    let denB = 0;
    for (let i = 0; i < valuesA.length; i++) {
      const da = valuesA[i] - meanA;
      const db = valuesB[i] - meanB;
      num += da * db;
      denA += da * da;
      denB += db * db;
    }

    const den = Math.sqrt(denA * denB);
    const corr = den > 0 ? Math.round(num / den * 100) / 100 : 0;

    let significance: FactorCorrelation['significance'];
    if (Math.abs(corr) > 0.7) significance = 'high';
    else if (Math.abs(corr) > 0.4) significance = 'medium';
    else significance = 'low';

    return { factorA, factorB, correlation: corr, significance };
  }
}
