// ── Correlation Matrix v2 (JVS-47) ─────────────────────────────────────────
// Cross-stock correlation matrix + heatmap + clustering
// IPC: em:correlation-matrix

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CorrelationMatrixParams {
  returns: Record<string, number[]>;  // code -> daily returns array
  method?: 'pearson' | 'spearman';
}

export interface CorrelationPair {
  codeA: string;
  codeB: string;
  correlation: number;
}

export interface CorrelationMatrixResult {
  codes: string[];
  matrix: number[][];            // NxN correlation matrix
  pairs: CorrelationPair[];      // All pairs sorted by |correlation|
  heatmap: {
    xLabels: string[];
    yLabels: string[];
    data: number[][];            // For ECharts heatmap
  };
  stats: {
    avgCorrelation: number;
    maxCorrelation: number;
    minCorrelation: number;
    maxPair: string;
    minPair: string;
  };
  clusters?: CorrelationCluster[];
  timestamp: number;
}

export interface CorrelationCluster {
  id: number;
  codes: string[];
  avgCorrelation: number;
}

// ── Pearson Correlation ────────────────────────────────────────────────────

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (den === 0) return 0;
  return num / den;
}

// ── Spearman Rank Correlation ──────────────────────────────────────────────

function rankArray(arr: number[]): number[] {
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j].v === sorted[i].v) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[sorted[k].i] = avgRank;
    i = j;
  }
  return ranks;
}

function spearmanCorrelation(x: number[], y: number[]): number {
  return pearsonCorrelation(rankArray(x), rankArray(y));
}

// ── Simple Agglomerative Clustering ────────────────────────────────────────

function clusterCorrelations(
  codes: string[],
  matrix: number[][],
  threshold: number = 0.6
): CorrelationCluster[] {
  const n = codes.length;
  // Start with each code as its own cluster
  let clusters: { codes: string[]; indices: number[] }[] = codes.map((c, i) => ({
    codes: [c],
    indices: [i],
  }));

  // Merge clusters with average correlation > threshold
  let merged = true;
  while (merged && clusters.length > 1) {
    merged = false;
    let bestI = -1, bestJ = -1, bestCorr = -Infinity;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        // Average correlation between clusters
        let sumCorr = 0, count = 0;
        for (const ii of clusters[i].indices) {
          for (const jj of clusters[j].indices) {
            sumCorr += Math.abs(matrix[ii][jj]);
            count++;
          }
        }
        const avgCorr = count > 0 ? sumCorr / count : 0;
        if (avgCorr > bestCorr) {
          bestCorr = avgCorr;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestCorr >= threshold && bestI >= 0) {
      clusters[bestI].codes.push(...clusters[bestJ].codes);
      clusters[bestI].indices.push(...clusters[bestJ].indices);
      clusters.splice(bestJ, 1);
      merged = true;
    }
  }

  return clusters.map((c, id) => {
    // Calculate average internal correlation
    let sumCorr = 0, count = 0;
    for (let i = 0; i < c.indices.length; i++) {
      for (let j = i + 1; j < c.indices.length; j++) {
        sumCorr += Math.abs(matrix[c.indices[i]][c.indices[j]]);
        count++;
      }
    }
    return {
      id,
      codes: c.codes,
      avgCorrelation: count > 0 ? round(sumCorr / count, 4) : 0,
    };
  });
}

// ── Main Function ──────────────────────────────────────────────────────────

export function correlationMatrix(params: CorrelationMatrixParams): CorrelationMatrixResult {
  const { returns, method = 'pearson' } = params;
  const codes = Object.keys(returns);
  const n = codes.length;

  if (n === 0) {
    return {
      codes: [],
      matrix: [],
      pairs: [],
      heatmap: { xLabels: [], yLabels: [], data: [] },
      stats: { avgCorrelation: 0, maxCorrelation: 0, minCorrelation: 0, maxPair: '', minPair: '' },
      timestamp: Date.now(),
    };
  }

  const corrFn = method === 'spearman' ? spearmanCorrelation : pearsonCorrelation;

  // Build NxN matrix
  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j < i) {
        matrix[i][j] = matrix[j][i]; // Symmetric
      } else {
        matrix[i][j] = round(corrFn(returns[codes[i]], returns[codes[j]]), 4);
      }
    }
  }

  // Extract all pairs
  const pairs: CorrelationPair[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push({
        codeA: codes[i],
        codeB: codes[j],
        correlation: matrix[i][j],
      });
    }
  }
  pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  // Stats
  const correlations = pairs.map(p => p.correlation);
  const avgCorrelation = correlations.length > 0
    ? round(correlations.reduce((a, b) => a + b, 0) / correlations.length, 4)
    : 0;
  const maxCorrelation = pairs.length > 0 ? pairs[0].correlation : 0;
  const minCorrelation = pairs.length > 0 ? pairs[pairs.length - 1].correlation : 0;
  const maxPair = pairs.length > 0 ? `${pairs[0].codeA}-${pairs[0].codeB}` : '';
  const minPair = pairs.length > 0 ? `${pairs[pairs.length - 1].codeA}-${pairs[pairs.length - 1].codeB}` : '';

  // Clusters
  const clusters = n >= 3 ? clusterCorrelations(codes, matrix) : undefined;

  log.info(`[CorrelationMatrix] ${n} stocks, ${pairs.length} pairs, avg=${avgCorrelation}`);

  return {
    codes,
    matrix,
    pairs,
    heatmap: {
      xLabels: codes,
      yLabels: codes,
      data: matrix,
    },
    stats: {
      avgCorrelation,
      maxCorrelation,
      minCorrelation,
      maxPair,
      minPair,
    },
    clusters,
    timestamp: Date.now(),
  };
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
