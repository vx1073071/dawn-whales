/**
 * Strategy Ranking Engine — Multi-dimensional strategy ranking for the Marketplace.
 * JVS-41-02
 */
import log from 'electron-log';

// ─── Inline EventEmitter polyfill ────────────────────────────────────────────
type EventListener = (...args: any[]) => void;

class EventEmitter {
  private _listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    list.push(listener);
    this._listeners.set(event, list);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._listeners.get(event);
    if (list) {
      this._listeners.set(
        event,
        list.filter((l) => l !== listener),
      );
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (err) {
        log.error(`[EventEmitter] Error in listener for "${event}":`, err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StrategyMetrics {
  strategyId: string;
  name: string;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  calmar: number;
  sortino: number;
  profitFactor: number;
  avgHoldingDays: number;
}

export type RankingDimension =
  | 'sharpe'
  | 'return'
  | 'drawdown'
  | 'winRate'
  | 'calmar'
  | 'sortino'
  | 'profitFactor'
  | 'consistency';

export interface RankingConfig {
  dimensions: RankingDimension[];
  weights: Record<string, number>; // dimension -> weight (sum to 1)
  minTrades: number;
  minHistoryDays: number;
}

export interface StrategyRank {
  strategyId: string;
  name: string;
  overallScore: number; // 0-100
  dimensionScores: Record<string, number>;
  rank: number;
  metrics: StrategyMetrics;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Dimensions where higher raw values are better */
const HIGHER_IS_BETTER: ReadonlySet<RankingDimension> = new Set([
  'sharpe',
  'return',
  'winRate',
  'calmar',
  'sortino',
  'profitFactor',
  'consistency',
]);

/** Dimensions where lower raw values are better */
const LOWER_IS_BETTER: ReadonlySet<RankingDimension> = new Set(['drawdown']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractDimensionValue(
  dimension: RankingDimension,
  metrics: StrategyMetrics,
): number {
  switch (dimension) {
    case 'sharpe':
      return metrics.sharpe;
    case 'return':
      return metrics.totalReturn;
    case 'drawdown':
      return metrics.maxDrawdown;
    case 'winRate':
      return metrics.winRate;
    case 'calmar':
      return metrics.calmar;
    case 'sortino':
      return metrics.sortino;
    case 'profitFactor':
      return metrics.profitFactor;
    case 'consistency':
      // Consistency heuristic: combination of win-rate and profit-factor normalised
      return (metrics.winRate / 100) * 0.6 + Math.min(metrics.profitFactor / 5, 1) * 0.4;
    default:
      return 0;
  }
}

function percentileRank(value: number, sorted: number[]): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return 100;
  const idx = sorted.findIndex((v) => v >= value);
  if (idx === -1) return 100;
  return (idx / (sorted.length - 1)) * 100;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class StrategyRankingEngine extends EventEmitter {
  // ─── Default configuration ───────────────────────────────────────────────

  getDefaultConfig(): RankingConfig {
    return {
      dimensions: [
        'sharpe',
        'return',
        'drawdown',
        'winRate',
        'calmar',
        'sortino',
        'profitFactor',
        'consistency',
      ],
      weights: {
        sharpe: 0.2,
        return: 0.15,
        drawdown: 0.15,
        winRate: 0.1,
        calmar: 0.1,
        sortino: 0.1,
        profitFactor: 0.1,
        consistency: 0.1,
      },
      minTrades: 30,
      minHistoryDays: 90,
    };
  }

  // ─── Dimension scoring ─────────────────────────────────────────────────

  /**
   * Score a single dimension value relative to the population.
   * Returns a score in [0, 100].
   */
  getDimensionScore(
    dimension: RankingDimension,
    value: number,
    allValues: number[],
  ): number {
    if (allValues.length === 0) return 0;
    if (allValues.length === 1) return 100;

    const sorted = [...allValues].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    // If all values identical, give everyone 50
    if (min === max) return 50;

    if (LOWER_IS_BETTER.has(dimension)) {
      // Lower is better → invert: smallest value gets 100
      return ((max - value) / (max - min)) * 100;
    }

    // Higher is better
    return ((value - min) / (max - min)) * 100;
  }

  // ─── Tier assignment ───────────────────────────────────────────────────

  assignTier(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
    if (score >= 90) return 'S';
    if (score >= 75) return 'A';
    if (score >= 55) return 'B';
    if (score >= 35) return 'C';
    return 'D';
  }

  // ─── Head-to-head comparison ───────────────────────────────────────────

  compareStrategies(
    a: StrategyMetrics,
    b: StrategyMetrics,
  ): { winner: string; details: Record<string, string> } {
    const details: Record<string, string> = {};
    let aWins = 0;
    let bWins = 0;

    const comparisons: Array<{
      label: string;
      aVal: number;
      bVal: number;
      higherBetter: boolean;
    }> = [
      { label: 'Sharpe', aVal: a.sharpe, bVal: b.sharpe, higherBetter: true },
      { label: 'Total Return', aVal: a.totalReturn, bVal: b.totalReturn, higherBetter: true },
      { label: 'Max Drawdown', aVal: a.maxDrawdown, bVal: b.maxDrawdown, higherBetter: false },
      { label: 'Win Rate', aVal: a.winRate, bVal: b.winRate, higherBetter: true },
      { label: 'Calmar', aVal: a.calmar, bVal: b.calmar, higherBetter: true },
      { label: 'Sortino', aVal: a.sortino, bVal: b.sortino, higherBetter: true },
      {
        label: 'Profit Factor',
        aVal: a.profitFactor,
        bVal: b.profitFactor,
        higherBetter: true,
      },
      {
        label: 'Trade Count',
        aVal: a.tradeCount,
        bVal: b.tradeCount,
        higherBetter: true,
      },
    ];

    for (const c of comparisons) {
      if (c.aVal === c.bVal) {
        details[c.label] = 'Tie';
      } else if (c.higherBetter) {
        if (c.aVal > c.bVal) {
          details[c.label] = `${a.name} wins (${c.aVal} vs ${c.bVal})`;
          aWins++;
        } else {
          details[c.label] = `${b.name} wins (${c.bVal} vs ${c.aVal})`;
          bWins++;
        }
      } else {
        // lower is better
        if (c.aVal < c.bVal) {
          details[c.label] = `${a.name} wins (${c.aVal} vs ${c.bVal})`;
          aWins++;
        } else {
          details[c.label] = `${b.name} wins (${c.bVal} vs ${c.aVal})`;
          bWins++;
        }
      }
    }

    let winner: string;
    if (aWins > bWins) {
      winner = a.name;
    } else if (bWins > aWins) {
      winner = b.name;
    } else {
      winner = 'Tie';
    }

    return { winner, details };
  }

  // ─── Main ranking ──────────────────────────────────────────────────────

  /**
   * Rank an array of strategies using multi-dimensional weighted scoring.
   */
  rankStrategies(
    strategies: StrategyMetrics[],
    config?: Partial<RankingConfig>,
  ): StrategyRank[] {
    const cfg: RankingConfig = { ...this.getDefaultConfig(), ...config };

    // Normalise weights so they always sum to 1
    const weightSum = cfg.dimensions.reduce(
      (sum, d) => sum + (cfg.weights[d] ?? 0),
      0,
    );
    const normalisedWeights: Record<string, number> = {};
    for (const d of cfg.dimensions) {
      normalisedWeights[d] = weightSum > 0 ? (cfg.weights[d] ?? 0) / weightSum : 0;
    }

    // Filter strategies that don't meet minimum requirements
    const eligible = strategies.filter((s) => {
      if (s.tradeCount < cfg.minTrades) {
        log.debug(
          `[RankingEngine] Excluding "${s.name}" — tradeCount ${s.tradeCount} < ${cfg.minTrades}`,
        );
        return false;
      }
      // avgHoldingDays * tradeCount gives a rough proxy for history days
      const estimatedDays = s.avgHoldingDays * s.tradeCount;
      if (estimatedDays < cfg.minHistoryDays) {
        log.debug(
          `[RankingEngine] Excluding "${s.name}" — estimatedDays ${estimatedDays} < ${cfg.minHistoryDays}`,
        );
        return false;
      }
      return true;
    });

    if (eligible.length === 0) {
      log.warn('[RankingEngine] No eligible strategies after filtering');
      this.emit('ranking:empty');
      return [];
    }

    // Pre-compute per-dimension value arrays
    const dimensionValues: Record<string, number[]> = {};
    for (const dim of cfg.dimensions) {
      dimensionValues[dim] = eligible.map((s) => extractDimensionValue(dim, s));
    }

    // Score each strategy
    const scored: StrategyRank[] = eligible.map((strategy) => {
      const dimensionScores: Record<string, number> = {};
      let overallScore = 0;

      for (const dim of cfg.dimensions) {
        const value = extractDimensionValue(dim, strategy);
        const score = this.getDimensionScore(dim, value, dimensionValues[dim]);
        dimensionScores[dim] = Math.round(score * 100) / 100;
        overallScore += score * (normalisedWeights[dim] ?? 0);
      }

      overallScore = Math.round(overallScore * 100) / 100;
      const tier = this.assignTier(overallScore);

      return {
        strategyId: strategy.strategyId,
        name: strategy.name,
        overallScore,
        dimensionScores,
        rank: 0, // assigned below
        metrics: strategy,
        tier,
      };
    });

    // Sort descending by overallScore, break ties by sharpe then tradeCount
    scored.sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      if (b.metrics.sharpe !== a.metrics.sharpe) return b.metrics.sharpe - a.metrics.sharpe;
      return b.metrics.tradeCount - a.metrics.tradeCount;
    });

    // Assign ranks (1-based, ties share rank)
    for (let i = 0; i < scored.length; i++) {
      if (i === 0) {
        scored[i].rank = 1;
      } else if (scored[i].overallScore === scored[i - 1].overallScore) {
        scored[i].rank = scored[i - 1].rank;
      } else {
        scored[i].rank = i + 1;
      }
    }

    log.info(
      `[RankingEngine] Ranked ${scored.length} strategies (filtered ${strategies.length - eligible.length})`,
    );

    this.emit('ranking:complete', scored);
    return scored;
  }

  // ─── Convenience: top-N ────────────────────────────────────────────────

  /**
   * Return only the top N strategies from a ranked list.
   */
  getTopN(ranked: StrategyRank[], n: number = 10): StrategyRank[] {
    return ranked.filter((r) => r.rank <= n);
  }

  // ─── Convenience: filter by tier ───────────────────────────────────────

  /**
   * Filter ranked strategies by tier.
   */
  filterByTier(ranked: StrategyRank[], tier: StrategyRank['tier']): StrategyRank[] {
    return ranked.filter((r) => r.tier === tier);
  }

  // ─── Dimension breakdown ───────────────────────────────────────────────

  /**
   * Get a summary of how a strategy scored on each dimension,
   * with human-readable labels.
   */
  getDimensionBreakdown(rank: StrategyRank): Record<string, { score: number; label: string }> {
    const labels: Record<string, string> = {
      sharpe: 'Risk-Adjusted Return (Sharpe)',
      return: 'Total Return',
      drawdown: 'Max Drawdown (lower is better)',
      winRate: 'Win Rate',
      calmar: 'Return vs Drawdown (Calmar)',
      sortino: 'Downside-Adjusted Return (Sortino)',
      profitFactor: 'Profit Factor',
      consistency: 'Consistency Score',
    };

    const breakdown: Record<string, { score: number; label: string }> = {};
    for (const [dim, score] of Object.entries(rank.dimensionScores)) {
      breakdown[dim] = {
        score,
        label: labels[dim] ?? dim,
      };
    }
    return breakdown;
  }

  // ─── Aggregate statistics ──────────────────────────────────────────────

  /**
   * Compute aggregate statistics across a ranked list.
   */
  getAggregateStats(ranked: StrategyRank[]): {
    avgScore: number;
    medianScore: number;
    stdDev: number;
    tierDistribution: Record<string, number>;
    topDimension: string;
    bottomDimension: string;
  } {
    if (ranked.length === 0) {
      return {
        avgScore: 0,
        medianScore: 0,
        stdDev: 0,
        tierDistribution: {},
        topDimension: '',
        bottomDimension: '',
      };
    }

    const scores = ranked.map((r) => r.overallScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianScore =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    const variance = scores.reduce((sum, s) => sum + (s - avgScore) ** 2, 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    const tierDistribution: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of ranked) {
      tierDistribution[r.tier] = (tierDistribution[r.tier] ?? 0) + 1;
    }

    // Find dimension with highest and lowest average scores
    const dimTotals: Record<string, number> = {};
    const dimCounts: Record<string, number> = {};
    for (const r of ranked) {
      for (const [dim, score] of Object.entries(r.dimensionScores)) {
        dimTotals[dim] = (dimTotals[dim] ?? 0) + score;
        dimCounts[dim] = (dimCounts[dim] ?? 0) + 1;
      }
    }

    let topDimension = '';
    let topAvg = -Infinity;
    let bottomDimension = '';
    let bottomAvg = Infinity;
    for (const dim of Object.keys(dimTotals)) {
      const avg = dimTotals[dim] / dimCounts[dim];
      if (avg > topAvg) {
        topAvg = avg;
        topDimension = dim;
      }
      if (avg < bottomAvg) {
        bottomAvg = avg;
        bottomDimension = dim;
      }
    }

    return {
      avgScore: Math.round(avgScore * 100) / 100,
      medianScore: Math.round(medianScore * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      tierDistribution,
      topDimension,
      bottomDimension,
    };
  }

  // ─── Validate config ───────────────────────────────────────────────────

  /**
   * Validate a ranking config, returning an array of issues (empty = valid).
   */
  validateConfig(config: Partial<RankingConfig>): string[] {
    const issues: string[] = [];

    if (config.weights) {
      for (const [dim, weight] of Object.entries(config.weights)) {
        if (typeof weight !== 'number' || weight < 0 || weight > 1) {
          issues.push(`Weight for "${dim}" must be a number between 0 and 1, got ${weight}`);
        }
      }
    }

    if (config.minTrades !== undefined && config.minTrades < 0) {
      issues.push(`minTrades must be >= 0, got ${config.minTrades}`);
    }

    if (config.minHistoryDays !== undefined && config.minHistoryDays < 0) {
      issues.push(`minHistoryDays must be >= 0, got ${config.minHistoryDays}`);
    }

    if (config.dimensions) {
      const validDims: RankingDimension[] = [
        'sharpe',
        'return',
        'drawdown',
        'winRate',
        'calmar',
        'sortino',
        'profitFactor',
        'consistency',
      ];
      for (const d of config.dimensions) {
        if (!validDims.includes(d)) {
          issues.push(`Unknown dimension "${d}"`);
        }
      }
    }

    return issues;
  }
}

export default StrategyRankingEngine;
