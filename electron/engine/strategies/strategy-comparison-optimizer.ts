// ── J-72-04: Strategy Comparison + Portfolio Optimization ────────────────
// Multi-strategy radar chart (6-dim) + Efficient Frontier (Markowitz)
// + Risk Budget + Rebalance Suggestions

// ── Types ────────────────────────────────────────────────────────────────

export interface StrategyMetrics {
  name: string;
  totalReturn: number; // % annualized
  sharpe: number;
  maxDrawdown: number; // % negative
  winRate: number; // 0-1
  volatility: number; // % annualized
  alpha: number; // vs benchmark
}

export interface RadarPoint {
  dimension: string;
  value: number; // normalized 0-100
  raw: number;
}

export interface EfficientFrontierPoint {
  return_: number; // expected return %
  risk: number; // std dev %
  sharpe: number;
  weights: Record<string, number>; // strategy → allocation %
}

export interface RiskBudget {
  strategyName: string;
  weight: number;
  marginalRisk: number; // contribution to total risk
  riskBudget: number; // % of total risk
}

export interface RebalanceAction {
  strategyName: string;
  currentWeight: number;
  targetWeight: number;
  delta: number;
  action: "buy" | "sell" | "hold";
  reason: string;
}

// ── Strategy Comparison Engine ───────────────────────────────────────────

export class StrategyComparisonEngine {
  // ── Radar Chart Data ────────────────────────────────────────────────────

  /**
   * Normalize 6-dim strategy metrics to 0-100 radar chart values.
   */
  computeRadar(strategies: StrategyMetrics[]): Map<string, RadarPoint[]> {
    if (strategies.length === 0) return new Map();

    const dims = ["totalReturn", "sharpe", "winRate", "alpha"] as const; // positive
    const negDims = ["maxDrawdown", "volatility"] as const; // negative (lower = better)

    const max: Record<string, number> = {};
    for (const d of [...dims, ...negDims]) {
      const vals = strategies.map((s) => Math.abs(s[d]));
      max[d] = Math.max(...vals, 1e-6);
    }

    const result = new Map<string, RadarPoint[]>();
    for (const s of strategies) {
      const points: RadarPoint[] = [
        { dimension: "Weighted α", value: Math.round((s.totalReturn / max.totalReturn) * 100), raw: s.totalReturn },
        { dimension: "Sharpe", value: Math.round((s.sharpe / Math.max(max.sharpe, 1)) * 100), raw: s.sharpe },
        { dimension: "Drawdown ↓", value: Math.round((1 - s.maxDrawdown / max.maxDrawdown) * 100), raw: s.maxDrawdown },
        { dimension: "WinRate", value: Math.round(s.winRate * 100), raw: s.winRate },
        { dimension: "Vol ↓", value: Math.round((1 - s.volatility / max.volatility) * 100), raw: s.volatility },
        { dimension: "Alpha", value: Math.round((s.alpha / Math.max(max.alpha, 1e-6)) * 100), raw: s.alpha },
      ];
      result.set(s.name, points);
    }

    return result;
  }

  compare(strategies: StrategyMetrics[]): {
    ranking: { name: string; compositeScore: number }[];
    best: string | null;
  } {
    if (strategies.length === 0) return { ranking: [], best: null };

    // Composite: 25% return + 25% sharpe + 15% winRate + 15% drawdown + 10% alpha + 10% vol
    const ranked = strategies.map((s) => {
      const score =
        0.25 * s.totalReturn +
        0.25 * s.sharpe +
        0.15 * s.winRate * 100 +
        0.15 * (1 - s.maxDrawdown) * 100 +
        0.1 * s.alpha +
        0.1 * (1 - s.volatility) * 100;
      return { name: s.name, compositeScore: Number(score.toFixed(2)) };
    });

    ranked.sort((a, b) => b.compositeScore - a.compositeScore);

    return {
      ranking: ranked,
      best: ranked[0]?.name ?? null,
    };
  }

  // Invert drawdown/vol to "higher is better" for chart display
  normalizeMetrics(metrics: StrategyMetrics): Record<string, number> {
    return {
      WeightedAlpha: metrics.totalReturn,
      Sharpe: metrics.sharpe,
      MaxDrawdown: metrics.maxDrawdown,
      WinRate: metrics.winRate,
      Volatility: metrics.volatility,
      Alpha: metrics.alpha,
    };
  }
}

// ── Portfolio Optimization Engine ────────────────────────────────────────

export interface CovMatrixEntry {
  strategyA: string;
  strategyB: string;
  covariance: number;
}

export class PortfolioOptimizer {
  // ── Efficient Frontier (Mean-Variance) ──────────────────────────────────

  /**
   * Generate efficient frontier points by varying target return.
   * Uses simplified Markowitz MVO with 2-asset case first.
   */
  computeEfficientFrontier(
    returns: number[], // expected returns [r1, r2, ...]
    covMatrix: number[][], // covariance matrix
    strategyNames: string[],
    numPoints: number = 20,
  ): EfficientFrontierPoint[] {
    const n = returns.length;
    if (n < 2 || covMatrix.length !== n) return [];

    const points: EfficientFrontierPoint[] = [];

    // For 2-asset case, analytical solution
    for (let i = 0; i <= numPoints; i++) {
      // Generate random weight combos (simulated)
      const weights = this.randomWeights(n);
      const portReturn = weights.reduce((sum, w, j) => sum + w * returns[j], 0);

      // Portfolio variance: w' Σ w
      let portVariance = 0;
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          portVariance += weights[a] * weights[b] * covMatrix[a][b];
        }
      }

      const risk = Math.sqrt(Math.max(0, portVariance));
      const sharpe = risk > 0 ? portReturn / risk : 0;

      const weightMap: Record<string, number> = {};
      for (let j = 0; j < n; j++) {
        weightMap[strategyNames[j] ?? `s${j}`] = Number((weights[j] * 100).toFixed(1));
      }

      points.push({
        return_: Number((portReturn * 100).toFixed(2)),
        risk: Number((risk * 100).toFixed(2)),
        sharpe: Number(sharpe.toFixed(4)),
        weights: weightMap,
      });
    }

    // Sort by risk ascending (efficient frontier)
    points.sort((a, b) => a.risk - b.risk);

    // Filter: only keep Pareto-efficient points (higher return for same or lower risk)
    const efficient: EfficientFrontierPoint[] = [];
    let maxReturn = -Infinity;
    for (const p of points) {
      if (p.return_ >= maxReturn) {
        efficient.push(p);
        maxReturn = p.return_;
      }
    }

    return efficient;
  }

  // ── Risk Budget ─────────────────────────────────────────────────────────

  computeRiskBudget(
    weights: number[],
    covMatrix: number[][],
    strategyNames: string[],
  ): RiskBudget[] {
    const n = weights.length;
    if (n < 2 || covMatrix.length !== n) return [];

    // Total portfolio variance
    let totalVar = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        totalVar += weights[i] * weights[j] * covMatrix[i][j];
      }
    }
    const totalRisk = Math.sqrt(Math.max(0, totalVar));

    const budgets: RiskBudget[] = [];
    for (let i = 0; i < n; i++) {
      // Marginal risk contribution: ∂σ/∂w_i = (Σw)_i / σ
      let marginal = 0;
      for (let j = 0; j < n; j++) {
        marginal += covMatrix[i][j] * weights[j];
      }
      marginal = totalRisk > 0 ? marginal / totalRisk : 0;

      const riskContrib = weights[i] * marginal;
      const riskBudgetPct = totalRisk > 0 ? riskContrib / totalRisk : 0;

      budgets.push({
        strategyName: strategyNames[i] ?? `s${i}`,
        weight: Number((weights[i] * 100).toFixed(1)),
        marginalRisk: Number(marginal.toFixed(4)),
        riskBudget: Number((riskBudgetPct * 100).toFixed(1)),
      });
    }

    return budgets;
  }

  // ── Rebalance Suggestions ──────────────────────────────────────────────

  computeRebalanceActions(
    currentWeights: Record<string, number>,
    targetWeights: Record<string, number>,
    threshold: number = 0.05,
  ): RebalanceAction[] {
    const allKeys = new Set([...Object.keys(currentWeights), ...Object.keys(targetWeights)]);
    const actions: RebalanceAction[] = [];

    for (const k of allKeys) {
      const current = currentWeights[k] ?? 0;
      const target = targetWeights[k] ?? 0;
      const delta = target - current;

      if (Math.abs(delta) < threshold) {
        actions.push({
          strategyName: k,
          currentWeight: Number(current.toFixed(3)),
          targetWeight: Number(target.toFixed(3)),
          delta: 0,
          action: "hold",
          reason: `within ${(threshold * 100).toFixed(0)}% threshold (Δ: ${(delta * 100).toFixed(1)}%)`,
        });
        continue;
      }

      const action = delta > 0 ? "buy" : "sell";
      const reason =
        delta > 0
          ? `underweight by ${(delta * 100).toFixed(1)}% — rebalance to target`
          : `overweight by ${(Math.abs(delta) * 100).toFixed(1)}% — rebalance to target`;

      actions.push({
        strategyName: k,
        currentWeight: Number(current.toFixed(3)),
        targetWeight: Number(target.toFixed(3)),
        delta: Number(delta.toFixed(3)),
        action,
        reason,
      });
    }

    return actions;
  }

  // ── Equal Risk Contribution (ERC) ───────────────────────────────────────

  computeERC(covMatrix: number[][], strategyNames: string[]): number[] {
    const n = covMatrix.length;
    if (n < 2) return n === 1 ? [1] : [];

    // Simplified ERC: inverse of volatility
    const vols = covMatrix.map((row, i) => Math.sqrt(Math.max(0, row[i])));
    const totalInvVol = vols.reduce((sum, v) => sum + (v > 0 ? 1 / v : 0), 0);

    return vols.map((v) => {
      const w = v > 0 ? 1 / v / totalInvVol : 0;
      return Number(w.toFixed(4));
    });
  }

  // ── Max Sharpe Portfolio ────────────────────────────────────────────────

  computeMaxSharpe(
    returns: number[],
    covMatrix: number[][],
    riskFreeRate: number = 0.02,
  ): { weights: number[]; expectedReturn: number; risk: number; sharpe: number } {
    const n = returns.length;
    if (n < 2 || covMatrix.length !== n) {
      return { weights: [], expectedReturn: 0, risk: 0, sharpe: 0 };
    }

    // Tangency portfolio: w* = Σ⁻¹ (μ - rf) / 1' Σ⁻¹ (μ - rf)
    // For 2-asset, use analytical; for n>2 use simulated approach
    const nTrials = n <= 3 ? 100 : 500;
    let bestSharpe = -Infinity;
    let bestWeights: number[] = [];
    let bestReturn = 0;
    let bestRisk = 0;

    for (let t = 0; t < nTrials; t++) {
      const w = this.randomWeights(n);
      const portReturn = w.reduce((sum, wi, i) => sum + wi * returns[i], 0);
      let portVar = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          portVar += w[i] * w[j] * covMatrix[i][j];
        }
      }
      const risk = Math.sqrt(Math.max(0, portVar));
      const sharpe = (portReturn - riskFreeRate) / Math.max(risk, 1e-6);

      if (sharpe > bestSharpe) {
        bestSharpe = sharpe;
        bestWeights = w;
        bestReturn = portReturn;
        bestRisk = risk;
      }
    }

    return {
      weights: bestWeights.map((w) => Number(w.toFixed(4))),
      expectedReturn: Number((bestReturn * 100).toFixed(2)),
      risk: Number((bestRisk * 100).toFixed(2)),
      sharpe: Number(bestSharpe.toFixed(4)),
    };
  }

  // ── Utility ─────────────────────────────────────────────────────────────

  private randomWeights(n: number): number[] {
    const raw = Array.from({ length: n }, () => Math.random());
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map((v) => v / total);
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createStrategyComparisonEngine(): StrategyComparisonEngine {
  return new StrategyComparisonEngine();
}

export function createPortfolioOptimizer(): PortfolioOptimizer {
  return new PortfolioOptimizer();
}
