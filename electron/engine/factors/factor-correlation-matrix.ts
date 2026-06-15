// R187 J2: Factor Correlation Matrix — Pearson + Spearman
// Computes pairwise correlations between factor values across a cross-section.
// Supports: correlation matrix, top correlated pairs, conflict detection.

import type { FactorId } from './factor-id-registry';

export interface CorrelationPair {
  factorA: FactorId;
  factorB: FactorId;
  pearson: number;
  spearman: number;
  /** Classification: 'strong' (r>=0.7), 'moderate' (0.3-0.7), 'weak' (<0.3) */
  strength: 'strong' | 'moderate' | 'weak';
  direction: 'positive' | 'negative';
  /** Classification based on correlation: complementary, independent, or conflicting */
  relationship: 'complementary' | 'independent' | 'conflicting';
}

export interface CorrelationMatrix {
  factorIds: FactorId[];
  /** Pearson correlation matrix (lower triangle, 1D array row-major) */
  pearsonMatrix: number[][];
  /** Spearman rank correlation matrix */
  spearmanMatrix: number[][];
  /** Pairs sorted by absolute correlation strength */
  topPairs: CorrelationPair[];
  /** Number of observations used */
  observationCount: number;
  /** Timestamp */
  timestamp: number;
}

export interface CorrelationConfig {
  /** Minimum correlation to report as a top pair (default: 0.3) */
  minAbsoluteCorrelation?: number;
  /** Maximum number of top pairs to return (default: 50) */
  maxTopPairs?: number;
  /** Minimum observations required (default: 20) */
  minObservations?: number;
}

export class FactorCorrelationMatrix {
  private config: Required<CorrelationConfig>;

  constructor(config: CorrelationConfig = {}) {
    this.config = {
      minAbsoluteCorrelation: config.minAbsoluteCorrelation ?? 0.3,
      maxTopPairs: config.maxTopPairs ?? 50,
      minObservations: config.minObservations ?? 20,
    };
  }

  /** Compute full correlation matrix from factor values */
  compute(
    factorIds: FactorId[],
    factorValues: Record<string, number[]>,
  ): CorrelationMatrix {
    const n = factorIds.length;
    const pearsonMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const spearmanMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const pairs: CorrelationPair[] = [];

    // Determine min observation count across factor pairs
    let totalObs = 0;
    for (const id of factorIds) {
      const vals = factorValues[id];
      if (vals && vals.length > totalObs) totalObs = vals.length;
    }

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const aValues = factorValues[factorIds[i]];
        const bValues = factorValues[factorIds[j]];

        if (!aValues || !bValues) {
          pearsonMatrix[i][j] = pearsonMatrix[j][i] = 0;
          spearmanMatrix[i][j] = spearmanMatrix[j][i] = 0;
          continue;
        }

        // Align by common length
        const len = Math.min(aValues.length, bValues.length);
        const x = aValues.slice(0, len);
        const y = bValues.slice(0, len);

        if (len < this.config.minObservations || i === j) {
          pearsonMatrix[i][j] = pearsonMatrix[j][i] = i === j ? 1 : 0;
          spearmanMatrix[i][j] = spearmanMatrix[j][i] = i === j ? 1 : 0;
          continue;
        }

        const pearson = FactorCorrelationMatrix.pearsonCorrelation(x, y);
        const spearman = FactorCorrelationMatrix.spearmanRankCorrelation(x, y);

        pearsonMatrix[i][j] = pearsonMatrix[j][i] = pearson;
        spearmanMatrix[i][j] = spearmanMatrix[j][i] = spearman;

        if (i < j) {
          const absCorr = Math.abs(spearman);
          if (absCorr >= this.config.minAbsoluteCorrelation) {
            pairs.push({
              factorA: factorIds[i],
              factorB: factorIds[j],
              pearson,
              spearman,
              strength: absCorr >= 0.7 ? 'strong' : absCorr >= 0.3 ? 'moderate' : 'weak',
              direction: spearman >= 0 ? 'positive' : 'negative',
              relationship: FactorCorrelationMatrix.classifyRelationship(spearman),
            });
          }
        }
      }
    }

    // Sort pairs by absolute correlation
    pairs.sort((a, b) => Math.abs(b.spearman) - Math.abs(a.spearman));

    return {
      factorIds,
      pearsonMatrix,
      spearmanMatrix,
      topPairs: pairs.slice(0, this.config.maxTopPairs),
      observationCount: totalObs,
      timestamp: Date.now(),
    };
  }

  /** Pearson correlation coefficient */
  static pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 2 || n !== y.length) return 0;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
    const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
    const sumY2 = y.reduce((a, yi) => a + yi * yi, 0);
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denominator === 0 || !isFinite(denominator)) return 0;
    return Math.max(-1, Math.min(1, numerator / denominator));
  }

  /** Spearman Rank correlation */
  static spearmanRankCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 3) return 0;
    const rankX = FactorCorrelationMatrix.rank(x);
    const rankY = FactorCorrelationMatrix.rank(y);
    return FactorCorrelationMatrix.pearsonCorrelation(rankX, rankY);
  }

  /** Rank array values (1-based, average rank for ties) */
  static rank(values: number[]): number[] {
    const indexed = values.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks: number[] = new Array(values.length);
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
      const avgRank = (i + j + 1) / 2;
      for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
      i = j;
    }
    return ranks;
  }

  /** Classify the relationship between two factors */
  static classifyRelationship(spearman: number): 'complementary' | 'independent' | 'conflicting' {
    const absR = Math.abs(spearman);
    if (absR >= 0.7) return spearman >= 0 ? 'complementary' : 'conflicting';
    if (absR >= 0.3) return spearman >= 0 ? 'complementary' : 'conflicting';
    return 'independent';
  }

  /** Get conflicts: strongly negatively correlated factor pairs */
  getConflicts(matrix: CorrelationMatrix): CorrelationPair[] {
    return matrix.topPairs.filter(p => p.relationship === 'conflicting' && p.strength === 'strong');
  }

  /** Get strongly complementary factor pairs */
  getComplementaryPairs(matrix: CorrelationMatrix): CorrelationPair[] {
    return matrix.topPairs.filter(p => p.relationship === 'complementary' && p.strength === 'strong');
  }

  /** Get the correlation between two specific factors */
  getPairCorrelation(
    matrix: CorrelationMatrix,
    factorA: FactorId,
    factorB: FactorId,
  ): { pearson: number; spearman: number } | undefined {
    const idxA = matrix.factorIds.indexOf(factorA);
    const idxB = matrix.factorIds.indexOf(factorB);
    if (idxA < 0 || idxB < 0) return undefined;
    return {
      pearson: matrix.pearsonMatrix[idxA][idxB],
      spearman: matrix.spearmanMatrix[idxA][idxB],
    };
  }

  /** Generate a human-readable summary of the correlation structure */
  summarize(matrix: CorrelationMatrix): string {
    const conflicts = this.getConflicts(matrix);
    const complements = this.getComplementaryPairs(matrix);
    const strongPairs = matrix.topPairs.filter(p => p.strength === 'strong');
    const moderatePairs = matrix.topPairs.filter(p => p.strength === 'moderate');

    return [
      'Factor: ' + matrix.factorIds.length + ' factors, ' + matrix.observationCount + ' observations',
      'Strong: ' + strongPairs.length + ' pairs (|r| >= 0.7)',
      'Moderate: ' + moderatePairs.length + ' pairs (0.3 <= |r| < 0.7)',
      'Conflicts: ' + conflicts.length + ' (strong negative)',
      'Complementary: ' + complements.length + ' (strong positive)',
    ].join(' | ');
  }

  /** Generate a compact correlation heatmap data for visualization */
  getHeatmapData(matrix: CorrelationMatrix): { labels: FactorId[]; values: number[][] } {
    return {
      labels: matrix.factorIds,
      values: matrix.spearmanMatrix,
    };
  }
}

let defaultMatrix: FactorCorrelationMatrix | null = null;

export function getFactorCorrelationMatrix(): FactorCorrelationMatrix {
  if (!defaultMatrix) defaultMatrix = new FactorCorrelationMatrix();
  return defaultMatrix;
}

export function resetFactorCorrelationMatrix(): void {
  defaultMatrix = null;
}