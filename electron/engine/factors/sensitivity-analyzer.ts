// ── R167 P2-08: Sensitivity Analyzer — 参数敏感性分析 + 过拟合检测 ──────
// Grid-search sensitivity surface, overfitting score (sharpness, degradation,
// robustness), and stable parameter interval detection.
//
// Core metric: if Δparam=10% causes Δreturn>50% → 🔴 severe overfitting.
// Output: SensitivityResult consumed by SensitivityHeatmap.tsx.

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ParamRange {
  name: string;
  nameCN: string;
  min: number;
  max: number;
  step: number;         // grid step size
  isInteger: boolean;   // if true, round to int
}

export interface SensitivityConfig {
  parameters: ParamRange[];
  /** Performance metric to evaluate: 'sharpe' | 'totalReturn' | 'calmar' | 'custom' */
  metric: 'sharpe' | 'totalReturn' | 'calmar' | 'sortino' | 'profitFactor' | 'custom';
  /** If metric='custom', this fn maps strategy return value to score (higher=better) */
  customScorer?: (strategyResult: Record<string, number>) => number;
  /** Smoothing sigma for surface interpolation (0 = no smoothing) */
  smoothSigma: number;
  /** Minimum adjacent points for robustness evaluation */
  robustnessNeighbors: number;
}

export const DEFAULT_SENSITIVITY_CONFIG: Omit<SensitivityConfig, 'parameters'> = {
  metric: 'sharpe',
  smoothSigma: 0.5,
  robustnessNeighbors: 3,
};

export interface SurfacePoint {
  paramValues: Record<string, number>;
  score: number;
}

export interface OverfittingResult {
  /** 🟢=stable(0-30) 🟡=moderate(30-60) 🔴=severe(60+) */
  overfittingScore: number;
  status: 'stable' | 'moderate' | 'severe';
  light: '🟢' | '🟡' | '🔴';
  /** Key evidence */
  evidence: string[];
  /** Peak sharpness: how fast does performance drop near optimum? (%) */
  peakSharpnessPct: number;
  /** Degradation: ratio of worst-adjacent to best */
  degradationRatio: number;
  /** Param islands detected? */
  hasIslands: boolean;
  /** Island count */
  islandCount: number;
}

export interface RobustInterval {
  paramName: string;
  paramNameCN: string;
  min: number;
  max: number;
  /** Average score within this interval */
  avgScore: number;
  /** Score stability (1 - cv) */
  stability: number;
}

export interface Param1DSensitivity {
  paramName: string;
  paramNameCN: string;
  points: Array<{ value: number; avgScore: number; minScore: number; maxScore: number }>;
  /** Best value */
  bestValue: number;
  bestScore: number;
  /** Overfitting signal per parameter */
  paramOverfitting: OverfittingResult;
  /** Robust interval */
  robustInterval: RobustInterval;
}

export interface SensitivityResult {
  config: SensitivityConfig;
  /** 2D surfaces: each entry = one parameter-pair surface */
  surfaces: ParamPairSurface[];
  /** 1D marginal sensitivity per parameter */
  marginals: Param1DSensitivity[];
  /** Global overfitting assessment */
  overfitting: OverfittingResult;
  /** Top-5 best parameter combos */
  topCombos: SurfacePoint[];
  /** Total points evaluated */
  totalPoints: number;
}

export interface ParamPairSurface {
  paramX: string;
  paramY: string;
  paramXCN: string;
  paramYCN: string;
  /** Normalized (0-1) grid values for heatmap rendering */
  grid: number[][];
  /** Raw labels for axes */
  xLabels: number[];
  yLabels: number[];
  /** Best point on this surface */
  bestX: number;
  bestY: number;
  bestScore: number;
  /** Overfitting signal on this surface */
  surfaceOverfitting: OverfittingResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sensitivity Analyzer Engine
// ═══════════════════════════════════════════════════════════════════════════

export class SensitivityAnalyzer {
  private config: SensitivityConfig;

  constructor(config: SensitivityConfig) {
    this.config = this.normalizeConfig(config);
    log.info(`[SensitivityAnalyzer] Initialized: ${config.parameters.length} params, metric=${config.metric}`);
  }

  /**
   * Analyze parameter sensitivity from a pre-computed grid of scores.
   *
   * @param gridPoints  All evaluated (paramValues → score) points
   * @returns Full sensitivity analysis including overfitting detection
   */
  analyze(gridPoints: SurfacePoint[]): SensitivityResult {
    if (gridPoints.length === 0) {
      return this.emptyResult();
    }

    // 1D marginal sensitivity
    const marginals = this.computeMarginals(gridPoints);

    // 2D pair surfaces
    const surfaces = this.computePairSurfaces(gridPoints);

    // Global overfitting
    const overfitting = this.computeGlobalOverfitting(marginals);

    // Top combos
    const sorted = [...gridPoints].sort((a, b) => b.score - a.score);
    const topCombos = sorted.slice(0, 5);

    return {
      config: { ...this.config },
      surfaces,
      marginals,
      overfitting,
      topCombos,
      totalPoints: gridPoints.length,
    };
  }

  /**
   * Convenience: run full grid search + analysis.
   *
   * @param strategyFn  Evaluates param combo; returns object with metrics.
   *                    Called for each grid point.
   */
  runFullAnalysis(
    strategyFn: (params: Record<string, number>) => Record<string, number>,
  ): SensitivityResult {
    const grid = this.generateGrid();
    const points: SurfacePoint[] = [];

    for (const combo of grid) {
      try {
        const result = strategyFn(combo);
        const score = this.extractScore(result);
        points.push({ paramValues: { ...combo }, score });
      } catch (err) {
        log.warn(`[SensitivityAnalyzer] Strategy eval failed for ${JSON.stringify(combo)}: ${(err as Error).message}`);
      }
    }

    return this.analyze(points);
  }

  /**
   * Quick overfitting check on a single parameter: if small Δparam → large Δscore.
   * e.g., "参数12→13导致收益腰斩" → overfittingScore > 80
   */
  quickOverfittingCheck(
    paramName: string,
    paramValues: number[],
    scores: number[],
  ): { score: number; verdict: string } {
    if (paramValues.length < 3) return { score: 0, verdict: '数据不足' };

    const maxScore = Math.max(...scores);
    const maxIdx = scores.indexOf(maxScore);

    // Check degradation: how much do nearby params drop?
    let maxDrop = 0;
    const range = paramValues[paramValues.length - 1] - paramValues[0];
    const stepTypical = range / (paramValues.length - 1);

    for (let i = 0; i < paramValues.length; i++) {
      const dist = Math.abs(paramValues[i] - paramValues[maxIdx]);
      if (dist > 0 && dist <= stepTypical * 2) {
        const drop = (maxScore - scores[i]) / Math.max(Math.abs(maxScore), 0.0001);
        maxDrop = Math.max(maxDrop, drop);
      }
    }

    // Normalize to 0-100
    const score = Math.min(100, Math.round(maxDrop * 120));
    const verdict = score >= 60 ? '🔴严重过拟合' : score >= 30 ? '🟡中度过拟合' : '🟢鲁棒性好';

    return { score, verdict };
  }

  // ── Grid Generation ────────────────────────────────────────────────────

  private generateGrid(): Record<string, number>[] {
    const { parameters } = this.config;
    const combos: Record<string, number>[] = [{}];

    for (const p of parameters) {
      const values = this.linspace(p.min, p.max, p.step, p.isInteger);
      const newCombos: Record<string, number>[] = [];

      for (const combo of combos) {
        for (const v of values) {
          newCombos.push({ ...combo, [p.name]: v });
        }
      }

      // Limit total grid size to prevent explosion
      if (newCombos.length > 200000) {
        log.warn(`[SensitivityAnalyzer] Grid too large (${newCombos.length}), truncating`);
        break;
      }

      combos.length = 0;
      combos.push(...newCombos);
    }

    return combos;
  }

  // ── 1D Marginal Sensitivity ─────────────────────────────────────────────

  private computeMarginals(gridPoints: SurfacePoint[]): Param1DSensitivity[] {
    return this.config.parameters.map((p) => {
      // Group by param value
      const groups = new Map<number, number[]>();
      for (const pt of gridPoints) {
        const v = pt.paramValues[p.name];
        if (!groups.has(v)) groups.set(v, []);
        groups.get(v)!.push(pt.score);
      }

      const points = Array.from(groups.entries())
        .map(([value, scores]) => ({
          value,
          avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
          minScore: Math.min(...scores),
          maxScore: Math.max(...scores),
        }))
        .sort((a, b) => a.value - b.value);

      const best = points.reduce((best, pt) => pt.avgScore > best.avgScore ? pt : best, points[0]);
      const scores = points.map((pt) => pt.avgScore);
      const values = points.map((pt) => pt.value);

      // Overfitting per parameter
      const paramOverfitting = this.detectParamOverfitting(points, p);

      // Robust interval
      const robustInterval = this.findRobustInterval(points, p);

      return {
        paramName: p.name,
        paramNameCN: p.nameCN,
        points,
        bestValue: best?.value ?? p.min,
        bestScore: best?.avgScore ?? 0,
        paramOverfitting,
        robustInterval,
      };
    });
  }

  // ── 2D Pair Surfaces ───────────────────────────────────────────────────

  private computePairSurfaces(gridPoints: SurfacePoint[]): ParamPairSurface[] {
    const surfaces: ParamPairSurface[] = [];
    const params = this.config.parameters;

    for (let i = 0; i < params.length; i++) {
      for (let j = i + 1; j < params.length; j++) {
        surfaces.push(this.computePairSurface(gridPoints, params[i], params[j]));
      }
    }

    return surfaces;
  }

  private computePairSurface(
    gridPoints: SurfacePoint[],
    px: ParamRange,
    py: ParamRange,
  ): ParamPairSurface {
    // Build 2D index
    const xValues = this.linspace(px.min, px.max, px.step, px.isInteger);
    const yValues = this.linspace(py.min, py.max, py.step, py.isInteger);

    const index = new Map<string, number[]>();
    for (const pt of gridPoints) {
      const key = `${pt.paramValues[px.name]}|${pt.paramValues[py.name]}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key)!.push(pt.score);
    }

    // Build normalized grid (0-1)
    const grid: number[][] = [];
    let bestScore = -Infinity;
    let bestX = xValues[0], bestY = yValues[0];

    // Compute min/max for normalization
    let allMin = Infinity, allMax = -Infinity;
    for (const scores of index.values()) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg < allMin) allMin = avg;
      if (avg > allMax) allMax = avg;
    }
    const range = allMax - allMin || 1;

    for (let yi = 0; yi < yValues.length; yi++) {
      const row: number[] = [];
      for (let xi = 0; xi < xValues.length; xi++) {
        const key = `${xValues[xi]}|${yValues[yi]}`;
        const scores = index.get(key);
        if (scores && scores.length > 0) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          const norm = (avg - allMin) / range;
          row.push(Math.round(norm * 100) / 100);

          if (avg > bestScore) {
            bestScore = avg;
            bestX = xValues[xi];
            bestY = yValues[yi];
          }
        } else {
          row.push(0);
        }
      }
      grid.push(row);
    }

    // Surface overfitting: check isolated peak
    const surfaceOF = this.detectSurfaceOverfitting(grid, bestX, xValues, bestY, yValues, range, allMin);

    return {
      paramX: px.name,
      paramY: py.name,
      paramXCN: px.nameCN,
      paramYCN: py.nameCN,
      grid,
      xLabels: xValues,
      yLabels: yValues,
      bestX, bestY, bestScore,
      surfaceOverfitting: surfaceOF,
    };
  }

  // ── Overfitting Detection ──────────────────────────────────────────────

  private computeGlobalOverfitting(marginals: Param1DSensitivity[]): OverfittingResult {
    const scores = marginals.map((m) => m.paramOverfitting.overfittingScore);
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const evidence: string[] = [];
    let peakSharpnessTotal = 0;
    let degradationTotal = 0;
    let hasIslands = false;
    let islandCount = 0;

    for (const m of marginals) {
      evidence.push(...m.paramOverfitting.evidence);
      peakSharpnessTotal += m.paramOverfitting.peakSharpnessPct;
      degradationTotal += m.paramOverfitting.degradationRatio;
      if (m.paramOverfitting.hasIslands) hasIslands = true;
      islandCount += m.paramOverfitting.islandCount;
    }

    const avgSharpness = marginals.length > 0 ? peakSharpnessTotal / marginals.length : 0;
    const avgDegradation = marginals.length > 0 ? degradationTotal / marginals.length : 0;

    // Composite overfitting score (0-100)
    const score = Math.min(100, Math.round(
      maxScore * 0.5 + avgSharpness * 40 + avgDegradation * 30 + (hasIslands ? 15 : 0)
    ));

    const status = score >= 60 ? 'severe' : score >= 30 ? 'moderate' : 'stable';
    const light = score >= 60 ? '🔴' : score >= 30 ? '🟡' : '🟢';

    if (evidence.length === 0) {
      evidence.push('所有参数表现平滑，无过拟合迹象');
    }

    return {
      overfittingScore: score,
      status,
      light,
      evidence,
      peakSharpnessPct: Math.round(avgSharpness * 100),
      degradationRatio: Math.round(avgDegradation * 100) / 100,
      hasIslands,
      islandCount,
    };
  }

  private detectParamOverfitting(
    points: Array<{ value: number; avgScore: number }>,
    param: ParamRange,
  ): OverfittingResult {
    if (points.length < 3) {
      return {
        overfittingScore: 0, status: 'stable', light: '🟢', evidence: [],
        peakSharpnessPct: 0, degradationRatio: 0, hasIslands: false, islandCount: 0,
      };
    }

    const scores = points.map((p) => p.avgScore);
    const maxScore = Math.max(...scores);
    const maxIdx = scores.indexOf(maxScore);
    const paramRange = param.max - param.min;

    const evidence: string[] = [];

    // Peak sharpness: how much does score drop when param changes by 10% of range?
    const step10Pct = paramRange * 0.1;
    let sharpness = 0;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].value - points[maxIdx].value);
      if (dist > 0 && dist <= step10Pct * 2) {
        const drop = maxScore > 0 ? (maxScore - scores[i]) / maxScore : 0;
        sharpness = Math.max(sharpness, drop);
      }
    }

    // Degradation: ratio of worst adjacent to best (1-N neighbor average / best)
    const neighbors = this.config.robustnessNeighbors;
    let adjacentSum = 0;
    let adjacentN = 0;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(i - maxIdx);
      if (dist > 0 && dist <= neighbors) {
        adjacentSum += scores[i];
        adjacentN++;
      }
    }
    const avgAdjacent = adjacentN > 0 ? adjacentSum / adjacentN : maxScore;
    const degradation = maxScore > 0 ? 1 - avgAdjacent / maxScore : 0;

    // Island detection: are there separate high-scoring clusters?
    const peaks = this.findPeaks(scores);
    const significantPeaks = peaks.filter((p) => scores[p] >= maxScore * 0.85);
    const hasIslands = significantPeaks.length > 1;
    const islandCount = significantPeaks.length;

    // Build evidence
    if (sharpness > 0.5) {
      evidence.push(`${param.nameCN}: 参数变化10%导致收益下降${Math.round(sharpness * 100)}%（>50%→严重过拟合）`);
    }
    if (degradation > 0.4) {
      evidence.push(`${param.nameCN}: 最优参数的邻近区域平均收益下降${Math.round(degradation * 100)}%`);
    }
    if (hasIslands) {
      evidence.push(`${param.nameCN}: 检测到${islandCount}个孤立高收益区域（参数岛）`);
    }

    // Composite score
    const score = Math.min(100, Math.round(sharpness * 80 + degradation * 60 + (hasIslands ? 20 : 0)));
    const status = score >= 60 ? 'severe' : score >= 30 ? 'moderate' : 'stable';
    const light = score >= 60 ? '🔴' : score >= 30 ? '🟡' : '🟢';

    return {
      overfittingScore: score,
      status,
      light,
      evidence,
      peakSharpnessPct: Math.round(sharpness * 100),
      degradationRatio: Math.round(degradation * 100) / 100,
      hasIslands,
      islandCount,
    };
  }

  private detectSurfaceOverfitting(
    grid: number[][],
    bestX: number, xValues: number[],
    bestY: number, yValues: number[],
    scoreRange: number,
    _scoreMin: number,
  ): OverfittingResult {
    // Find peak coordinates
    const xi = xValues.indexOf(bestX);
    const yi = yValues.indexOf(bestY);
    if (xi < 0 || yi < 0 || grid.length === 0) {
      return {
        overfittingScore: 0, status: 'stable', light: '🟢', evidence: [],
        peakSharpnessPct: 0, degradationRatio: 0, hasIslands: false, islandCount: 0,
      };
    }

    const bestNorm = grid[yi][xi];
    let neighborSum = 0;
    let neighborN = 0;

    // Check 8-neighbor drop
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = yi + dy;
        const nx = xi + dx;
        if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
          neighborSum += grid[ny][nx];
          neighborN++;
        }
      }
    }

    const avgNeighbor = neighborN > 0 ? neighborSum / neighborN : bestNorm;
    const drop = bestNorm > 0 ? (bestNorm - avgNeighbor) / bestNorm : 0;
    const sharpness = Math.min(1, Math.max(0, drop));

    // Island counting
    const peaks = this.findSurfacePeaks(grid);
    const highPeaks = peaks.filter((p) => grid[p[1]][p[0]] >= bestNorm * 0.85);

    const score = Math.min(100, Math.round(sharpness * 100 + (highPeaks.length > 1 ? 20 : 0)));

    return {
      overfittingScore: score,
      status: score >= 60 ? 'severe' : score >= 30 ? 'moderate' : 'stable',
      light: score >= 60 ? '🔴' : score >= 30 ? '🟡' : '🟢',
      evidence: sharpness > 0.3 ? [`二维参数面: 峰值邻近下降${Math.round(sharpness * 100)}%`] : [],
      peakSharpnessPct: Math.round(sharpness * 100),
      degradationRatio: Math.round((scoreRange > 0 ? drop : 0) * 100) / 100,
      hasIslands: highPeaks.length > 1,
      islandCount: highPeaks.length,
    };
  }

  // ── Robust Interval Detection ───────────────────────────────────────────

  private findRobustInterval(
    points: Array<{ value: number; avgScore: number }>,
    param: ParamRange,
  ): RobustInterval {
    // Strategy: sliding window, find the widest window where all avgScores ≥ 90% of max
    const maxScore = Math.max(...points.map((p) => p.avgScore));
    const threshold = maxScore * 0.90;

    let bestStart = 0;
    let bestEnd = 0;
    let bestWidth = 0;
    let bestSum = 0;
    let bestN = 0;

    for (let start = 0; start < points.length; start++) {
      let sum = 0;
      let n = 0;
      for (let end = start; end < points.length; end++) {
        if (points[end].avgScore < threshold) break;
        sum += points[end].avgScore;
        n++;
      }
      const width = n > 0 ? points[start + n - 1].value - points[start].value : 0;
      if (width > bestWidth) {
        bestStart = start;
        bestEnd = start + n - 1;
        bestWidth = width;
        bestSum = sum;
        bestN = n;
      }
    }

    const avgScore = bestN > 0 ? bestSum / bestN : 0;
    const stability = maxScore > 0 ? (1 - Math.sqrt(
      points.slice(bestStart, bestEnd + 1).reduce((s, p) => s + (p.avgScore - avgScore) ** 2, 0) / bestN
    ) / maxScore) : 0;

    return {
      paramName: param.name,
      paramNameCN: param.nameCN,
      min: points[bestStart]?.value ?? param.min,
      max: points[bestEnd]?.value ?? param.max,
      avgScore: Math.round(avgScore * 100) / 100,
      stability: Math.max(0, Math.round(stability * 100) / 100),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private extractScore(result: Record<string, number>): number {
    if (this.config.metric === 'custom' && this.config.customScorer) {
      return this.config.customScorer(result);
    }
    const key = this.config.metric;
    return result[key] ?? 0;
  }

  private linspace(min: number, max: number, step: number, isInteger: boolean): number[] {
    const values: number[] = [];
    for (let v = min; v <= max + step * 0.5; v += step) {
      values.push(isInteger ? Math.round(v) : Math.round(v * 1e8) / 1e8);
    }
    return values;
  }

  private findPeaks(arr: number[]): number[] {
    const peaks: number[] = [];
    for (let i = 1; i < arr.length - 1; i++) {
      if (arr[i] > arr[i - 1] && arr[i] > arr[i + 1]) {
        peaks.push(i);
      }
    }
    return peaks;
  }

  private findSurfacePeaks(grid: number[][]): Array<[number, number]> {
    const peaks: Array<[number, number]> = [];
    const h = grid.length;
    const w = grid[0]?.length ?? 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const v = grid[y][x];
        if (
          v > grid[y - 1][x] && v > grid[y + 1][x] &&
          v > grid[y][x - 1] && v > grid[y][x + 1]
        ) {
          peaks.push([x, y]);
        }
      }
    }
    return peaks;
  }

  private normalizeConfig(config: SensitivityConfig): SensitivityConfig {
    return {
      ...config,
      smoothSigma: config.smoothSigma ?? DEFAULT_SENSITIVITY_CONFIG.smoothSigma,
      robustnessNeighbors: config.robustnessNeighbors ?? DEFAULT_SENSITIVITY_CONFIG.robustnessNeighbors,
    };
  }

  private emptyResult(): SensitivityResult {
    return {
      config: this.config,
      surfaces: [],
      marginals: [],
      overfitting: {
        overfittingScore: 0, status: 'stable', light: '🟢', evidence: [],
        peakSharpnessPct: 0, degradationRatio: 0, hasIslands: false, islandCount: 0,
      },
      topCombos: [],
      totalPoints: 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory & Singleton
// ═══════════════════════════════════════════════════════════════════════════

let _analyzer: SensitivityAnalyzer | null = null;

export function getSensitivityAnalyzer(config: SensitivityConfig): SensitivityAnalyzer {
  return new SensitivityAnalyzer(config);
}

export default {
  SensitivityAnalyzer,
  getSensitivityAnalyzer,
};
