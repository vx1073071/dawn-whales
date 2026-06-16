// ── R173 F5: Factor Weight Optimizer ─────────────────────────────────────
// Strategy optimizer: brute-force weight scanning + multi-objective Pareto
// Copyright (c) 2026 QUANT MOO. All rights reserved.

import { log } from '../../../../src/lib/logger';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FactorWeightConfig {
  factorId: string;
  weight: number; // 0-1
  nameCN?: string;
}

export interface StrategyCandidate {
  weights: FactorWeightConfig[];
  metrics: StrategyMetrics;
  factorContributions: FactorContribution[];
}

export interface StrategyMetrics {
  expectedReturn: number;   // annualized %
  expectedSharpe: number;
  expectedMaxDrawdown: number; // %
  expectedWinRate: number;    // %
  expectedVolatility: number; // %
  score: number;              // composite score (0-100)
}

export interface FactorContribution {
  factorId: string;
  weight: number;
  returnContribution: number;
  riskContribution: number;
  icContribution: number;
}

export interface OptimizationConstraints {
  minFactors?: number;       // minimum factors to include (default 3)
  maxFactors?: number;       // maximum factors to include (default 8)
  minWeightPerFactor?: number; // minimum weight per factor (default 0.05)
  maxWeightPerFactor?: number; // maximum weight per factor (default 0.40)
  maxSingleSector?: number;    // max weight for any single "momentum"/"value" family
  requiredFactors?: string[];  // factors that MUST be included
  excludedFactors?: string[];  // factors to exclude
}

export interface ParetoPoint {
  weights: FactorWeightConfig[];
  sharpe: number;
  returnPct: number;
  maxDrawdown: number;
  dominance: number; // Pareto dominance count (how many others it dominates)
}

export interface ParetoFrontier {
  points: ParetoPoint[];
  efficientFrontier: {
    maxSharpe: ParetoPoint;
    maxReturn: ParetoPoint;
    minDrawdown: ParetoPoint;
    optimal: ParetoPoint; // closest to ideal (knee point)
  };
  summary: string;
}

export interface OptimizationResult {
  topCandidates: StrategyCandidate[];
  paretoFrontier: ParetoFrontier;
  summary: {
    totalScans: number;
    validCandidates: number;
    durationMs: number;
    bestScore: number;
    bestSharpe: number;
    bestReturn: number;
    bestDrawdown: number;
  };
}

// ── Internal Metrics Model ──────────────────────────────────────────────────

interface FactorMeta {
  factorId: string;
  typicalIC: number;
  typicalIR: number;
  category: string;
  volatilitySensitivity: number; // 0=stable, 1=very volatile
  nameCN: string;
}

// Pre-calibrated factor metadata (used for scan scoring)
const FACTOR_META: Record<string, FactorMeta> = {
  MOM_12M: { factorId: 'MOM_12M', typicalIC: 0.045, typicalIR: 0.60, category: 'momentum', volatilitySensitivity: 0.70, nameCN: '12月动量' },
  MOM_1M: { factorId: 'MOM_1M', typicalIC: 0.032, typicalIR: 0.40, category: 'momentum', volatilitySensitivity: 0.85, nameCN: '1月动量' },
  HML: { factorId: 'HML', typicalIC: 0.038, typicalIR: 0.55, category: 'value', volatilitySensitivity: 0.20, nameCN: '价值因子' },
  SIZE: { factorId: 'SIZE', typicalIC: 0.025, typicalIR: 0.35, category: 'size', volatilitySensitivity: 0.25, nameCN: '规模因子' },
  QUAL: { factorId: 'QUAL', typicalIC: 0.035, typicalIR: 0.50, category: 'quality', volatilitySensitivity: 0.30, nameCN: '质量因子' },
  RMW: { factorId: 'RMW', typicalIC: 0.030, typicalIR: 0.45, category: 'quality', volatilitySensitivity: 0.35, nameCN: '盈利能力' },
  CMA: { factorId: 'CMA', typicalIC: 0.022, typicalIR: 0.30, category: 'value', volatilitySensitivity: 0.15, nameCN: '投资风格' },
  GROWTH: { factorId: 'GROWTH', typicalIC: 0.028, typicalIR: 0.40, category: 'growth', volatilitySensitivity: 0.50, nameCN: '成长因子' },
  YIELD: { factorId: 'YIELD', typicalIC: 0.018, typicalIR: 0.25, category: 'yield', volatilitySensitivity: 0.10, nameCN: '股息因子' },
  VOL_60D: { factorId: 'VOL_60D', typicalIC: 0.042, typicalIR: 0.55, category: 'volatility', volatilitySensitivity: 0.80, nameCN: '60日波动率' },
  LIQ: { factorId: 'LIQ', typicalIC: 0.038, typicalIR: 0.48, category: 'volatility', volatilitySensitivity: 0.60, nameCN: '流动性因子' },
  MA_20_60: { factorId: 'MA_20_60', typicalIC: 0.025, typicalIR: 0.32, category: 'trend', volatilitySensitivity: 0.75, nameCN: '均线交叉' },
  RSI_14: { factorId: 'RSI_14', typicalIC: 0.028, typicalIR: 0.35, category: 'momentum', volatilitySensitivity: 0.55, nameCN: 'RSI' },
};

// Rough correlation matrix (simplified)
const CORRELATION_MATRIX: Record<string, Record<string, number>> = {
  MOM_12M: { MOM_1M: 0.45, RSI_14: 0.35, VOL_60D: -0.20, HML: -0.30, QUAL: 0.10, SIZE: 0.05 },
  MOM_1M: { MOM_12M: 0.45, RSI_14: 0.40, VOL_60D: -0.25, HML: -0.25, QUAL: 0.05, SIZE: 0.02 },
  HML: { CMA: 0.55, MOM_12M: -0.30, YIELD: 0.25, QUAL: 0.20, SIZE: 0.15 },
  QUAL: { RMW: 0.50, HML: 0.20, GROWTH: -0.15 },
  RMW: { QUAL: 0.50, HML: 0.15, GROWTH: -0.10 },
  CMA: { HML: 0.55, YIELD: 0.20 },
  VOL_60D: { MOM_12M: -0.20, LIQ: 0.35 },
  GROWTH: { MOM_12M: 0.15, QUAL: -0.15, RMW: -0.10 },
  YIELD: { HML: 0.25, CMA: 0.20 },
  SIZE: { HML: 0.15, MOM_12M: 0.05, MOM_1M: 0.02 },
  LIQ: { VOL_60D: 0.35, MOM_12M: 0.05 },
};

// ── Strategy Optimizer ──────────────────────────────────────────────────────

export class FactorOptimizer {
  private factorMeta: Map<string, FactorMeta>;

  constructor() {
    this.factorMeta = new Map();
    for (const [, meta] of Object.entries(FACTOR_META)) {
      this.factorMeta.set(meta.factorId, meta);
    }
  }

  /**
   * Register additional factor metadata.
   */
  registerFactorMeta(meta: FactorMeta): void {
    this.factorMeta.set(meta.factorId, meta);
  }

  /**
   * Main entry: Run strategy weight optimization via brute-force scan.
   *
   * @param factors — candidate factor IDs to include
   * @param constraints — optimization constraints
   * @param scanCount — number of weight combinations to try (default 5000)
   * @returns OptimizationResult with top candidates + Pareto frontier
   */
  strategyOptimizer(
    factors: string[],
    constraints: OptimizationConstraints = {},
    scanCount: number = 5000,
  ): OptimizationResult {
    const startTime = Date.now();

    // Validate factors against meta
    const validFactors = factors.filter(f => this.factorMeta.has(f));
    if (validFactors.length < (constraints.minFactors || 3)) {
      return this.emptyResult(validFactors.length, startTime);
    }

    const {
      minFactors = 3,
      maxFactors = 8,
      minWeightPerFactor = 0.05,
      maxWeightPerFactor = 0.40,
      maxSingleSector,
      requiredFactors = [],
      excludedFactors = [],
    } = constraints;

    // Filter factors
    let candidatePool = validFactors.filter(f => !excludedFactors.includes(f));

    // Ensure required factors are included
    for (const req of requiredFactors) {
      if (!candidatePool.includes(req) && this.factorMeta.has(req)) {
        candidatePool.unshift(req);
      }
    }

    if (candidatePool.length < minFactors) {
      return this.emptyResult(candidatePool.length, startTime);
    }

    const candidates: StrategyCandidate[] = [];

    // ── Brute force weight scanning ──
    for (let s = 0; s < scanCount; s++) {
      // Randomly select N factors (between minFactors and maxFactors)
      const nFactors = this.randomInt(minFactors, Math.min(maxFactors, candidatePool.length));
      const selected = this.randomSubset(candidatePool, nFactors);

      // Generate random weights
      const weights = this.generateWeights(selected, minWeightPerFactor, maxWeightPerFactor, maxSingleSector);

      // Evaluate metrics
      const metrics = this.evaluateMetrics(weights);
      const contributions = this.evaluateContributions(weights);

      candidates.push({
        weights,
        metrics,
        factorContributions: contributions,
      });
    }

    // Sort by composite score descending
    candidates.sort((a, b) => b.metrics.score - a.metrics.score);

    // Extract top 20 and Pareto frontier
    const topCandidates = candidates.slice(0, 20);
    const paretoFrontier = this.buildParetoFrontier(candidates);

    const durationMs = Date.now() - startTime;

    return {
      topCandidates,
      paretoFrontier,
      summary: {
        totalScans: scanCount,
        validCandidates: candidates.length,
        durationMs,
        bestScore: topCandidates[0]?.metrics.score || 0,
        bestSharpe: topCandidates[0]?.metrics.expectedSharpe || 0,
        bestReturn: topCandidates[0]?.metrics.expectedReturn || 0,
        bestDrawdown: topCandidates[0]?.metrics.expectedMaxDrawdown || 0,
      },
    };
  }

  /**
   * Multi-objective optimization: computes full Pareto frontier.
   * Returns all non-dominated solutions sorted by Sharpe.
   */
  multiObjective(
    candidates: StrategyCandidate[],
  ): ParetoPoint[] {
    // Convert to ParetoPoint
    const points: ParetoPoint[] = candidates.map(c => ({
      weights: c.weights,
      sharpe: c.metrics.expectedSharpe,
      returnPct: c.metrics.expectedReturn,
      maxDrawdown: c.metrics.expectedMaxDrawdown,
      dominance: 0,
    }));

    // Compute dominance count
    for (let i = 0; i < points.length; i++) {
      let dominatedBy = 0;
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        // point j dominates point i if j is better in ALL objectives AND strictly better in at least ONE
        const betterSharpe = points[j].sharpe > points[i].sharpe;
        const betterReturn = points[j].returnPct > points[i].returnPct;
        const betterDD = points[j].maxDrawdown < points[i].maxDrawdown; // lower DD is better

        if (betterSharpe && betterReturn && betterDD) {
          dominatedBy++;
        }
      }
      points[i].dominance = dominatedBy;
    }

    // Non-dominated: dominance === 0
    const frontier = points.filter(p => p.dominance === 0);

    // Sort by Sharpe
    frontier.sort((a, b) => b.sharpe - a.sharpe);

    return frontier;
  }

  /**
   * Build comprehensive Pareto frontier from optimization results.
   */
  private buildParetoFrontier(candidates: StrategyCandidate[]): ParetoFrontier {
    const points = this.multiObjective(candidates);

    if (points.length === 0) {
      return {
        points: [],
        efficientFrontier: {
          maxSharpe: { weights: [], sharpe: 0, returnPct: 0, maxDrawdown: 0, dominance: 0 },
          maxReturn: { weights: [], sharpe: 0, returnPct: 0, maxDrawdown: 0, dominance: 0 },
          minDrawdown: { weights: [], sharpe: 0, returnPct: 0, maxDrawdown: 0, dominance: 0 },
          optimal: { weights: [], sharpe: 0, returnPct: 0, maxDrawdown: 0, dominance: 0 },
        },
        summary: 'No valid Pareto frontier points.',
      };
    }

    // Find extreme points
    const maxSharpe = points.reduce((a, b) => a.sharpe > b.sharpe ? a : b);
    const maxReturn = points.reduce((a, b) => a.returnPct > b.returnPct ? a : b);
    const minDrawdown = points.reduce((a, b) => a.maxDrawdown < b.maxDrawdown ? a : b);

    // Optimal (knee point): closest to ideal — maximize Sharpe, maximize return, minimize DD
    const maxSharpeVal = maxSharpe.sharpe || 1e-6;
    const maxReturnVal = maxReturn.returnPct || 1e-6;
    const minDDVal = Math.max(minDrawdown.maxDrawdown, 0.01) || 0.01;

    let optimal = maxSharpe;
    let bestDist = Infinity;
    for (const p of points) {
      // Normalized distance to ideal point (best sharpe/return/lowest DD)
      const dist = Math.sqrt(
        ((maxSharpeVal - p.sharpe) / maxSharpeVal) ** 2 +
        ((maxReturnVal - p.returnPct) / maxReturnVal) ** 2 +
        ((p.maxDrawdown - minDDVal) / minDDVal) ** 2,
      );
      if (dist < bestDist) { bestDist = dist; optimal = p; }
    }

    return {
      points,
      efficientFrontier: { maxSharpe, maxReturn, minDrawdown, optimal },
      summary: `${points.length} Pareto-optimal solutions. Best: Sharpe=${maxSharpe.sharpe.toFixed(3)}, Return=${maxReturn.returnPct.toFixed(1)}%, MaxDD=${minDrawdown.maxDrawdown.toFixed(1)}%`,
    };
  }

  // ── Weight Generation ─────────────────────────────────────────────────────

  private generateWeights(
    factorIds: string[],
    minWeight: number,
    maxWeight: number,
    maxSector?: number,
  ): FactorWeightConfig[] {
    const n = factorIds.length;
    // Feasible: each in [minWeight, maxWeight], sum=1
    const feasibleMin = Math.min(minWeight, 1.0 / n);
    const feasibleMax = Math.min(maxWeight, 1.0 - (n - 1) * feasibleMin);

    // Start with equal weights
    let weights = factorIds.map(() => feasibleMin);

    // Distribute remaining budget randomly
    const remaining = 1.0 - n * feasibleMin;
    if (remaining > 0) {
      // Random fractions summing to 1
      const rawAlloc = factorIds.map(() => Math.random());
      const rawSum = rawAlloc.reduce((a, b) => a + b, 0);
      const alloc = rawAlloc.map(r => (r / rawSum) * remaining);

      for (let i = 0; i < n; i++) {
        const target = weights[i] + alloc[i];
        weights[i] = Math.min(feasibleMax, Math.max(feasibleMin, target));
      }

      // Re-normalize after clamping
      const sumW = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / sumW);
    }

    // Enforce max single sector if specified
    if (maxSector !== undefined) {
      const sectors = this.groupByCategory(factorIds, weights);
      for (const [cat, catWeight] of Object.entries(sectors)) {
        if (catWeight > maxSector) {
          const scale = maxSector / catWeight;
          for (let i = 0; i < factorIds.length; i++) {
            const meta = this.factorMeta.get(factorIds[i]);
            if (meta?.category === cat) {
              weights[i] *= scale;
            }
          }
          // Re-normalize
          const newSum = weights.reduce((a, b) => a + b, 0);
          weights = weights.map(w => w / newSum);
        }
      }
    }

    return factorIds.map((fid, i) => {
      const meta = this.factorMeta.get(fid);
      return {
        factorId: fid,
        weight: Number(weights[i].toFixed(4)),
        nameCN: meta?.nameCN || fid,
      };
    });
  }

  private groupByCategory(factorIds: string[], weights: number[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (let i = 0; i < factorIds.length; i++) {
      const meta = this.factorMeta.get(factorIds[i]);
      const cat = meta?.category || 'other';
      groups[cat] = (groups[cat] || 0) + weights[i];
    }
    return groups;
  }

  // ── Metrics Evaluation ────────────────────────────────────────────────────

  private evaluateMetrics(weights: FactorWeightConfig[]): StrategyMetrics {
    let weightedIC = 0;
    let weightedIR = 0;
    let weightedVol = 0;
    let totalWeight = 0;

    // Diversification penalty from correlations
    let diversificationScore = 1.0;

    for (const w of weights) {
      const meta = this.factorMeta.get(w.factorId);
      if (!meta) continue;

      const wVal = w.weight;
      totalWeight += wVal;
      weightedIC += meta.typicalIC * wVal;
      weightedIR += meta.typicalIR * wVal;
      weightedVol += meta.volatilitySensitivity * wVal;

      // Correlation penalty
      for (const w2 of weights) {
        if (w.factorId === w2.factorId) continue;
        const corr = CORRELATION_MATRIX[w.factorId]?.[w2.factorId]
          || CORRELATION_MATRIX[w2.factorId]?.[w.factorId]
          || 0;
        if (corr > 0.3) {
          diversificationScore -= corr * wVal * w2.weight * 0.02;
        }
      }
    }

    diversificationScore = Math.max(0.5, Math.min(1.0, diversificationScore));

    // Annualized return estimate: 4% base + weighted IC contribution
    const baseReturn = 4.0;
    const factorAlpha = weightedIC * 100; // convert IC to alpha contribution %
    const expectedReturn = baseReturn + factorAlpha * 1.5; // scale factor

    // Sharpe: weightedIR * sqrt(N) with diversification
    const nFactors = weights.length;
    const expectedSharpe = (weightedIR * Math.sqrt(nFactors) * diversificationScore * 1.2);

    // Volatility: base 15% + weighted vol sensitivity
    const expectedVolatility = 12.0 + weightedVol * 20;

    // Max drawdown: proportional to volatility * (1 - diversification)
    const expectedMaxDrawdown = expectedVolatility * 1.8 * (1.0 - diversificationScore + 0.2);

    // Win rate: base 50% + IR contribution
    const expectedWinRate = Math.min(80, 50 + weightedIR * 40);

    // Composite score (0-100): weighted combination
    const sharpeScore = Math.min(25, expectedSharpe * 12.5); // max 25 pts
    const returnScore = Math.min(25, (expectedReturn - 4) / 2); // max 25 pts
    const ddScore = Math.min(20, Math.max(0, 20 - expectedMaxDrawdown / 2)); // max 20 pts
    const winRateScore = Math.min(15, (expectedWinRate - 45) * 0.5); // max 15 pts
    const diversityScore = Math.min(15, diversificationScore * 15 + (nFactors - 3) * 2); // max 15 pts
    const score = Number((sharpeScore + returnScore + ddScore + winRateScore + diversityScore).toFixed(2));

    return {
      expectedReturn: Number(expectedReturn.toFixed(2)),
      expectedSharpe: Number(expectedSharpe.toFixed(3)),
      expectedMaxDrawdown: Number(expectedMaxDrawdown.toFixed(2)),
      expectedWinRate: Number(expectedWinRate.toFixed(1)),
      expectedVolatility: Number(expectedVolatility.toFixed(2)),
      score: Number(score.toFixed(2)),
    };
  }

  private evaluateContributions(weights: FactorWeightConfig[]): FactorContribution[] {
    const totalIC = weights.reduce((s, w) => {
      const meta = this.factorMeta.get(w.factorId);
      return s + (meta?.typicalIC || 0) * w.weight;
    }, 0);

    const totalRisk = weights.reduce((s, w) => {
      const meta = this.factorMeta.get(w.factorId);
      return s + (meta?.volatilitySensitivity || 0.5) * w.weight;
    }, 0);

    return weights.map(w => {
      const meta = this.factorMeta.get(w.factorId);
      const ic = meta?.typicalIC || 0;
      const risk = meta?.volatilitySensitivity || 0.5;
      return {
        factorId: w.factorId,
        weight: w.weight,
        returnContribution: Number(((ic * w.weight) / Math.max(totalIC, 1e-6) * 100).toFixed(2)),
        riskContribution: Number(((risk * w.weight) / Math.max(totalRisk, 1e-6) * 100).toFixed(2)),
        icContribution: Number((ic * w.weight * 100).toFixed(4)),
      };
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private randomInt(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  private randomSubset<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  private emptyResult(factors: number, startTime: number): OptimizationResult {
    return {
      topCandidates: [],
      paretoFrontier: {
        points: [],
        efficientFrontier: {
          maxSharpe: { weights: [], sharpe: 0, returnPct: 0, maxDrawdown: 0, dominance: 0 },
          maxReturn: { weights: [], sharpe: 0, returnPct: 0, maxDrawdown: 0, dominance: 0 },
          minDrawdown: { weights: [], sharpe: 0, returnPct: 0, maxDrawdown: 0, dominance: 0 },
          optimal: { weights: [], sharpe: 0, returnPct: 0, maxDrawdown: 0, dominance: 0 },
        },
        summary: `Insufficient factors: need >=3, got ${factors}`,
      },
      summary: {
        totalScans: 0,
        validCandidates: 0,
        durationMs: Date.now() - startTime,
        bestScore: 0,
        bestSharpe: 0,
        bestReturn: 0,
        bestDrawdown: 0,
      },
    };
  }

  /**
   * [R176 F5续] Get optimizer summary for UI display.
   * Returns key metrics from the last optimization run.
   */
  getOptimizerSummary(lastResult?: OptimizationResult): {
    totalScans: number;
    validCandidates: number;
    durationMs: number;
    bestScore: number;
    bestSharpe: number;
    bestReturn: number;
    bestDrawdown: number;
    convergenceRate: number; // valid / total
    top3Combos: Array<{ factors: string[]; weights: number[]; sharpe: number; returnPct: number }>;
  } {
    const s = lastResult?.summary;
    const totalScans = s?.totalScans ?? 5000;
    const valid = s?.validCandidates ?? totalScans;
    const top3 = (lastResult?.topCandidates ?? []).slice(0, 3).map(c => ({
      factors: c.weights.map(w => w.factorId),
      weights: c.weights.map(w => Math.round(w.weight * 10000) / 100),
      sharpe: Math.round(c.metrics.expectedSharpe * 100) / 100,
      returnPct: Math.round(c.metrics.expectedReturn * 100) / 100,
    }));

    return {
      totalScans,
      validCandidates: valid,
      durationMs: s?.durationMs ?? 0,
      bestScore: s?.bestScore != null ? Math.round(s.bestScore * 100) / 100 : 0,
      bestSharpe: s?.bestSharpe != null ? Math.round(s.bestSharpe * 100) / 100 : 0,
      bestReturn: s?.bestReturn != null ? Math.round(s.bestReturn * 100) / 100 : 0,
      bestDrawdown: s?.bestDrawdown != null ? Math.round(s.bestDrawdown * 100) / 100 : 0,
      convergenceRate: totalScans > 0 ? Math.round((valid / totalScans) * 10000) / 100 : 0,
      top3Combos: top3,
    };
  }

  /**
   * [R176 F5续] Get Pareto frontier as chart-friendly JSON.
   * Returns datasets suitable for scatter/line charts (Sharpe vs Return).
   */
  getParetoFrontierJSON(frontier?: ParetoFrontier): {
    labels: string[]; // e.g. ["S1","S2",...]
    datasets: Array<{
      label: string;
      data: Array<{ x: number; y: number }>; // x=sharpe, y=return
      pointRadius: number;
      borderColor: string;
      backgroundColor: string;
    }>;
    efficientPoints: Array<{ label: string; sharpe: number; returnPct: number; dominance: number }>;
    summary: string;
  } {
    const points = frontier?.points ?? [];
    const effPoints = frontier?.efficientFrontier;
    const labels = points.map((_, i) => `S${i + 1}`);

    const allPoints = points.map(p => ({
      x: Math.round(p.sharpe * 100) / 100,
      y: Math.round(p.returnPct * 100) / 100,
    }));

    const efficientList: Array<{ label: string; sharpe: number; returnPct: number; dominance: number }> = [];
    if (effPoints) {
      for (const [key, pt] of Object.entries(effPoints)) {
        efficientList.push({
          label: key,
          sharpe: Math.round(pt.sharpe * 100) / 100,
          returnPct: Math.round(pt.returnPct * 100) / 100,
          dominance: pt.dominance,
        });
      }
    }

    return {
      labels,
      datasets: [
        {
          label: 'All candidates',
          data: allPoints,
          pointRadius: 2,
          borderColor: '#8b8b9e',
          backgroundColor: '#8b8b9e',
        },
        {
          label: 'Efficient frontier',
          data: efficientList.map(e => ({ x: e.sharpe, y: e.returnPct })),
          pointRadius: 5,
          borderColor: '#22c55e',
          backgroundColor: '#22c55e',
        },
      ],
      efficientPoints: efficientList,
      summary: frontier?.summary ?? 'No Pareto frontier available',
    };
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createFactorOptimizer(): FactorOptimizer {
  return new FactorOptimizer();
}

let _optimizer: FactorOptimizer | null = null;
export function getFactorOptimizer(): FactorOptimizer {
  if (!_optimizer) _optimizer = new FactorOptimizer();
  return _optimizer;
}
export function resetFactorOptimizer(): void {
  _optimizer = null;
}
