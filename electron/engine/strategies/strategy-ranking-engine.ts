// 
/**
 * Strategy Ranking Engine — Multi-dimensional strategy ranking for the Marketplace.
 * JVS-41-02
 *
 * Features:
 * - Multi-dimensional weighted ranking (Sharpe, return, drawdown, win-rate, Calmar, Sortino, profit-factor, consistency)
 * - Elo Rating System as alternative ranking method
 * - Strategy Correlation Matrix — detect correlated strategies
 * - Performance Attribution — decompose returns into alpha / beta / luck
 * - Drawdown Recovery Analysis — time to recover from max drawdown
 * - Consistency Score — rolling Sharpe stability over time
 * - Benchmark Comparison — compare against SPY / QQQ benchmarks
 * - Strategy Lifecycle Stage detection (new / growing / mature / declining)
 */
import log from 'electron-log';
import { EngineError } from '../core/engine-error';


// ─── Inline EventEmitter polyfill ────────────────────────────────────────────
type EventListener = (...args: unknown[]) => void;

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
    const wrapper = (...args: unknown[]) => {
      listener(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  emit(event: string, ...args: unknown[]): boolean {
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
  weights: Record<string, number>;
  minTrades: number;
  minHistoryDays: number;
}

export interface StrategyRank {
  strategyId: string;
  name: string;
  overallScore: number;
  dimensionScores: Record<string, number>;
  rank: number;
  metrics: StrategyMetrics;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
}

// ─── Elo Rating Types ────────────────────────────────────────────────────────

export interface EloConfig {
  kFactor: number;
  initialRating: number;
  rounds: number;
}

export interface EloResult {
  strategyId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

// ─── Correlation Types ───────────────────────────────────────────────────────

export interface CorrelationEntry {
  strategyA: string;
  strategyB: string;
  correlation: number;
}

// ─── Performance Attribution Types ───────────────────────────────────────────

export interface AttributionResult {
  strategyId: string;
  name: string;
  alpha: number;
  beta: number;
  luck: number;
  totalReturn: number;
}

// ─── Drawdown Recovery Types ─────────────────────────────────────────────────

export interface DrawdownRecoveryResult {
  strategyId: string;
  name: string;
  maxDrawdown: number;
  recoveryDays: number | null;
  recoverySpeed: number;
  isRecovered: boolean;
}

// ─── Consistency Score Types ─────────────────────────────────────────────────

export interface ConsistencyResult {
  strategyId: string;
  name: string;
  consistencyScore: number;
  rollingSharpes: number[];
  sharpeStability: number;
}

// ─── Benchmark Comparison Types ──────────────────────────────────────────────

export interface BenchmarkData {
  name: string;
  totalReturn: number;
  sharpe: number;
  maxDrawdown: number;
}

export interface BenchmarkComparisonResult {
  strategyId: string;
  name: string;
  benchmarkName: string;
  excessReturn: number;
  excessSharpe: number;
  excessDrawdown: number;
  outperformanceScore: number;
}

// ─── Lifecycle Stage Types ───────────────────────────────────────────────────

export type LifecycleStage = 'new' | 'growing' | 'mature' | 'declining';

export interface LifecycleResult {
  strategyId: string;
  name: string;
  stage: LifecycleStage;
  confidence: number;
  details: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HIGHER_IS_BETTER: ReadonlySet<RankingDimension> = new Set([
  'sharpe',
  'return',
  'winRate',
  'calmar',
  'sortino',
  'profitFactor',
  'consistency',
]);

const LOWER_IS_BETTER: ReadonlySet<RankingDimension> = new Set(['drawdown']);

const DEFAULT_ELO_CONFIG: EloConfig = {
  kFactor: 32,
  initialRating: 1500,
  rounds: 5,
};

const DEFAULT_BENCHMARKS: BenchmarkData[] = [
  { name: 'SPY', totalReturn: 12.0, sharpe: 0.85, maxDrawdown: 15.0 },
  { name: 'QQQ', totalReturn: 16.0, sharpe: 0.95, maxDrawdown: 20.0 },
];

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

/**
 * Compute the expected Elo score for player A given ratings.
 */
function expectedElo(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Determine head-to-head winner between two strategies based on metrics.
 * Returns 1 if A wins, 0 if B wins, 0.5 if tie.
 */
function headToHeadResult(a: StrategyMetrics, b: StrategyMetrics): number {
  let aWins = 0;
  let bWins = 0;

  const comparisons: Array<{ aVal: number; bVal: number; higherBetter: boolean }> = [
    { aVal: a.sharpe, bVal: b.sharpe, higherBetter: true },
    { aVal: a.totalReturn, bVal: b.totalReturn, higherBetter: true },
    { aVal: a.maxDrawdown, bVal: b.maxDrawdown, higherBetter: false },
    { aVal: a.winRate, bVal: b.winRate, higherBetter: true },
    { aVal: a.calmar, bVal: b.calmar, higherBetter: true },
    { aVal: a.sortino, bVal: b.sortino, higherBetter: true },
    { aVal: a.profitFactor, bVal: b.profitFactor, higherBetter: true },
  ];

  for (const c of comparisons) {
    if (c.aVal === c.bVal) continue;
    if (c.higherBetter) {
      c.aVal > c.bVal ? aWins++ : bWins++;
    } else {
      c.aVal < c.bVal ? aWins++ : bWins++;
    }
  }

  if (aWins > bWins) return 1;
  if (bWins > aWins) return 0;
  return 0.5;
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

    if (min === max) return 50;

    if (LOWER_IS_BETTER.has(dimension)) {
      return ((max - value) / (max - min)) * 100;
    }

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
      { label: 'Profit Factor', aVal: a.profitFactor, bVal: b.profitFactor, higherBetter: true },
      { label: 'Trade Count', aVal: a.tradeCount, bVal: b.tradeCount, higherBetter: true },
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

  rankStrategies(
    strategies: StrategyMetrics[],
    config?: Partial<RankingConfig>,
  ): StrategyRank[] {
    const cfg: RankingConfig = { ...this.getDefaultConfig(), ...config };

    const weightSum = cfg.dimensions.reduce(
      (sum, d) => sum + (cfg.weights[d] ?? 0),
      0,
    );
    const normalisedWeights: Record<string, number> = {};
    for (const d of cfg.dimensions) {
      normalisedWeights[d] = weightSum > 0 ? (cfg.weights[d] ?? 0) / weightSum : 0;
    }

    const eligible = strategies.filter((s) => {
      if (s.tradeCount < cfg.minTrades) {
        log.debug(
          `[RankingEngine] Excluding "${s.name}" — tradeCount ${s.tradeCount} < ${cfg.minTrades}`,
        );
        return false;
      }
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

    const dimensionValues: Record<string, number[]> = {};
    for (const dim of cfg.dimensions) {
      dimensionValues[dim] = eligible.map((s) => extractDimensionValue(dim, s));
    }

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
        rank: 0,
        metrics: strategy,
        tier,
      };
    });

    scored.sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      if (b.metrics.sharpe !== a.metrics.sharpe) return b.metrics.sharpe - a.metrics.sharpe;
      return b.metrics.tradeCount - a.metrics.tradeCount;
    });

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

  getTopN(ranked: StrategyRank[], n: number = 10): StrategyRank[] {
    return ranked.filter((r) => r.rank <= n);
  }

  // ─── Convenience: filter by tier ───────────────────────────────────────

  filterByTier(ranked: StrategyRank[], tier: StrategyRank['tier']): StrategyRank[] {
    return ranked.filter((r) => r.tier === tier);
  }

  // ─── Dimension breakdown ───────────────────────────────────────────────

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
      breakdown[dim] = { score, label: labels[dim] ?? dim };
    }
    return breakdown;
  }

  // ─── Aggregate statistics ──────────────────────────────────────────────

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
      if (avg > topAvg) { topAvg = avg; topDimension = dim; }
      if (avg < bottomAvg) { bottomAvg = avg; bottomDimension = dim; }
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
        'sharpe', 'return', 'drawdown', 'winRate',
        'calmar', 'sortino', 'profitFactor', 'consistency',
      ];
      for (const d of config.dimensions) {
        if (!validDims.includes(d)) {
          issues.push(`Unknown dimension "${d}"`);
        }
      }
    }

    return issues;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW FEATURES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Elo Rating System ─────────────────────────────────────────────────

  /**
   * Rank strategies using an Elo rating system.
   * Each strategy plays head-to-head matches against every other strategy
   * for a configurable number of rounds. Ratings update based on outcomes.
   */
  computeEloRatings(
    strategies: StrategyMetrics[],
    config?: Partial<EloConfig>,
  ): EloResult[] {
    const cfg: EloConfig = { ...DEFAULT_ELO_CONFIG, ...config };

    if (strategies.length === 0) return [];

    // Initialize ratings and record
    const ratings = new Map<string, number>();
    const wins = new Map<string, number>();
    const losses = new Map<string, number>();
    const draws = new Map<string, number>();

    for (const s of strategies) {
      ratings.set(s.strategyId, cfg.initialRating);
      wins.set(s.strategyId, 0);
      losses.set(s.strategyId, 0);
      draws.set(s.strategyId, 0);
    }

    // Run round-robin rounds
    for (let round = 0; round < cfg.rounds; round++) {
      for (let i = 0; i < strategies.length; i++) {
        for (let j = i + 1; j < strategies.length; j++) {
          const a = strategies[i];
          const b = strategies[j];
          const ratingA = ratings.get(a.strategyId)!;
          const ratingB = ratings.get(b.strategyId)!;

          const expectedA = expectedElo(ratingA, ratingB);
          const actual = headToHeadResult(a, b);

          // Update ratings
          const newRatingA = ratingA + cfg.kFactor * (actual - expectedA);
          const newRatingB = ratingB + cfg.kFactor * ((1 - actual) - (1 - expectedA));

          ratings.set(a.strategyId, newRatingA);
          ratings.set(b.strategyId, newRatingB);

          // Update W/L/D record
          if (actual === 1) {
            wins.set(a.strategyId, wins.get(a.strategyId)! + 1);
            losses.set(b.strategyId, losses.get(b.strategyId)! + 1);
          } else if (actual === 0) {
            losses.set(a.strategyId, losses.get(a.strategyId)! + 1);
            wins.set(b.strategyId, wins.get(b.strategyId)! + 1);
          } else {
            draws.set(a.strategyId, draws.get(a.strategyId)! + 1);
            draws.set(b.strategyId, draws.get(b.strategyId)! + 1);
          }
        }
      }
    }

    const results: EloResult[] = strategies.map((s) => ({
      strategyId: s.strategyId,
      name: s.name,
      rating: Math.round(ratings.get(s.strategyId)! * 100) / 100,
      wins: wins.get(s.strategyId)!,
      losses: losses.get(s.strategyId)!,
      draws: draws.get(s.strategyId)!,
    }));

    // Sort by rating descending
    results.sort((a, b) => b.rating - a.rating);

    log.info(`[RankingEngine] Elo ratings computed for ${results.length} strategies (${cfg.rounds} rounds)`);
    this.emit('elo:complete', results);
    return results;
  }

  // ─── Strategy Correlation Matrix ───────────────────────────────────────

  /**
   * Compute pairwise correlation between strategies based on their metric profiles.
   * Uses a normalized Euclidean distance converted to a correlation-like score [-1, 1].
   * Strategies with similar metric profiles are highly correlated.
   */
  computeCorrelationMatrix(strategies: StrategyMetrics[]): {
    matrix: number[][];
    pairs: CorrelationEntry[];
    highlyCorrelated: CorrelationEntry[];
  } {
    if (strategies.length === 0) {
      return { matrix: [], pairs: [], highlyCorrelated: [] };
    }

    const n = strategies.length;

    // Normalize metrics into feature vectors
    const features = strategies.map((s) => [
      s.sharpe,
      s.totalReturn,
      s.maxDrawdown,
      s.winRate,
      s.calmar,
      s.sortino,
      s.profitFactor,
    ]);

    // Compute per-feature min/max for normalization
    const featureCount = features[0].length;
    const mins = new Array(featureCount).fill(Infinity);
    const maxs = new Array(featureCount).fill(-Infinity);

    for (const f of features) {
      for (let i = 0; i < featureCount; i++) {
        if (f[i] < mins[i]) mins[i] = f[i];
        if (f[i] > maxs[i]) maxs[i] = f[i];
      }
    }

    // Normalize features to [0, 1]
    const normalized = features.map((f) =>
      f.map((v, i) => {
        const range = maxs[i] - mins[i];
        return range === 0 ? 0.5 : (v - mins[i]) / range;
      }),
    );

    // Compute correlation matrix
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const pairs: CorrelationEntry[] = [];
    const HIGH_CORR_THRESHOLD = 0.7;
    const highlyCorrelated: CorrelationEntry[] = [];

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      for (let j = i + 1; j < n; j++) {
        // Euclidean distance in normalized space
        let distSq = 0;
        for (let k = 0; k < featureCount; k++) {
          distSq += (normalized[i][k] - normalized[j][k]) ** 2;
        }
        const distance = Math.sqrt(distSq / featureCount);
        // Convert distance to correlation-like score: 1 - 2*distance (clamped to [-1, 1])
        const correlation = Math.round(Math.max(-1, Math.min(1, 1 - 2 * distance)) * 1000) / 1000;

        matrix[i][j] = correlation;
        matrix[j][i] = correlation;

        const entry: CorrelationEntry = {
          strategyA: strategies[i].strategyId,
          strategyB: strategies[j].strategyId,
          correlation,
        };
        pairs.push(entry);

        if (Math.abs(correlation) >= HIGH_CORR_THRESHOLD) {
          highlyCorrelated.push(entry);
        }
      }
    }

    log.info(`[RankingEngine] Correlation matrix computed: ${n} strategies, ${highlyCorrelated.length} highly correlated pairs`);
    this.emit('correlation:complete', { matrix, pairs, highlyCorrelated });
    return { matrix, pairs, highlyCorrelated };
  }

  // ─── Performance Attribution ───────────────────────────────────────────

  /**
   * Decompose a strategy's returns into alpha (skill), beta (market exposure), and luck.
   *
   * Model:
   *   totalReturn = alpha + beta * benchmarkReturn + luck
   *
   * - alpha: excess return not explained by market (skill component)
   * - beta: sensitivity to benchmark returns (market exposure)
   * - luck: residual component estimated from win-rate variance
   */
  computePerformanceAttribution(
    strategies: StrategyMetrics[],
    benchmarkReturn: number = 12.0,
  ): AttributionResult[] {
    if (strategies.length === 0) return [];

    const results: AttributionResult[] = strategies.map((s) => {
      // Beta: estimated from Sharpe relative to a benchmark Sharpe of ~1.0
      // A higher Sharpe relative to benchmark implies positive market timing
      const betaEstimate = Math.min(Math.max(s.sharpe / 1.0, 0), 3.0);

      // Market-explained return
      const marketReturn = betaEstimate * benchmarkReturn;

      // Luck component: estimated from win-rate deviation from 50% * volatility proxy
      // Higher trade counts reduce luck; fewer trades amplify it
      const luckScale = 1 / Math.sqrt(Math.max(s.tradeCount, 1));
      const luck = (s.winRate - 50) * 0.1 * luckScale * s.totalReturn * 0.01;

      // Alpha = totalReturn - marketReturn - luck
      const alpha = s.totalReturn - marketReturn - luck;

      return {
        strategyId: s.strategyId,
        name: s.name,
        alpha: Math.round(alpha * 100) / 100,
        beta: Math.round(betaEstimate * 1000) / 1000,
        luck: Math.round(luck * 100) / 100,
        totalReturn: s.totalReturn,
      };
    });

    log.info(`[RankingEngine] Performance attribution computed for ${results.length} strategies`);
    this.emit('attribution:complete', results);
    return results;
  }

  // ─── Drawdown Recovery Analysis ────────────────────────────────────────

  /**
   * Analyze drawdown recovery characteristics for each strategy.
   *
   * Estimates:
   * - recoveryDays: estimated days to recover from max drawdown
   * - recoverySpeed: return per day during recovery phase
   * - isRecovered: whether the strategy has likely recovered
   */
  analyzeDrawdownRecovery(strategies: StrategyMetrics[]): DrawdownRecoveryResult[] {
    if (strategies.length === 0) return [];

    const results: DrawdownRecoveryResult[] = strategies.map((s) => {
      // Estimate daily return rate from total return and trading days
      const estimatedTradingDays = s.avgHoldingDays * s.tradeCount;
      const dailyReturn = estimatedTradingDays > 0 ? s.totalReturn / estimatedTradingDays : 0;

      // Recovery days: how long to recover the max drawdown at average daily return
      let recoveryDays: number | null = null;
      let recoverySpeed = 0;
      let isRecovered = false;

      if (dailyReturn > 0 && s.maxDrawdown > 0) {
        recoveryDays = Math.round(s.maxDrawdown / dailyReturn);
        recoverySpeed = Math.round(dailyReturn * 1000) / 1000;

        // Check if enough time has passed since the drawdown to recover
        // Assume drawdown occurred at midpoint of history
        const daysSinceDrawdown = Math.round(estimatedTradingDays * 0.5);
        isRecovered = daysSinceDrawdown >= recoveryDays;
      } else if (s.maxDrawdown === 0) {
        recoveryDays = 0;
        recoverySpeed = dailyReturn;
        isRecovered = true;
      }

      return {
        strategyId: s.strategyId,
        name: s.name,
        maxDrawdown: s.maxDrawdown,
        recoveryDays,
        recoverySpeed,
        isRecovered,
      };
    });

    log.info(`[RankingEngine] Drawdown recovery analysis for ${results.length} strategies`);
    this.emit('drawdown:complete', results);
    return results;
  }

  // ─── Consistency Score ─────────────────────────────────────────────────

  /**
   * Compute a consistency score based on rolling Sharpe ratio stability.
   *
   * Simulates rolling Sharpe windows from available metrics:
   * - Uses trade count to determine window count
   * - Uses win-rate and profit-factor variance to estimate Sharpe stability
   * - Returns a 0-100 score where higher = more consistent
   */
  computeConsistencyScores(strategies: StrategyMetrics[]): ConsistencyResult[] {
    if (strategies.length === 0) return [];

    const results: ConsistencyResult[] = strategies.map((s) => {
      // Simulate rolling Sharpe windows (minimum 4 windows, max 20)
      const windowCount = Math.min(20, Math.max(4, Math.floor(s.tradeCount / 10)));
      const rollingSharpes: number[] = [];

      // Generate synthetic rolling Sharpes centered on the reported Sharpe
      // Variance is inversely proportional to win-rate consistency and trade count
      const varianceFactor = Math.max(0.05, 1 - s.winRate / 100) / Math.sqrt(s.tradeCount);

      for (let i = 0; i < windowCount; i++) {
        // Deterministic pseudo-variation based on index and strategy metrics
        const phase = (i / windowCount) * Math.PI * 2;
        const oscillation = Math.sin(phase) * varianceFactor * s.sharpe;
        const trendBias = (i / windowCount - 0.5) * varianceFactor * 0.5;
        const windowSharpe = s.sharpe + oscillation + trendBias;
        rollingSharpes.push(Math.round(windowSharpe * 1000) / 1000);
      }

      // Sharpe stability = 1 - coefficient of variation (clamped 0-1)
      const mean = rollingSharpes.reduce((a, b) => a + b, 0) / rollingSharpes.length;
      const stdDev = Math.sqrt(
        rollingSharpes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / rollingSharpes.length,
      );
      const cv = Math.abs(mean) > 0 ? stdDev / Math.abs(mean) : 1;
      const sharpeStability = Math.round(Math.max(0, Math.min(1, 1 - cv)) * 1000) / 1000;

      // Overall consistency: combine Sharpe stability with win-rate consistency
      const winRateComponent = s.winRate / 100;
      const profitFactorComponent = Math.min(s.profitFactor / 3, 1);
      const consistencyScore = Math.round(
        (sharpeStability * 0.5 + winRateComponent * 0.3 + profitFactorComponent * 0.2) * 100,
      );

      return {
        strategyId: s.strategyId,
        name: s.name,
        consistencyScore,
        rollingSharpes,
        sharpeStability,
      };
    });

    log.info(`[RankingEngine] Consistency scores computed for ${results.length} strategies`);
    this.emit('consistency:complete', results);
    return results;
  }

  // ─── Benchmark Comparison ──────────────────────────────────────────────

  /**
   * Compare strategies against benchmark indices (SPY, QQQ, etc.).
   * Returns per-benchmark comparison results with an outperformance score.
   */
  compareWithBenchmarks(
    strategies: StrategyMetrics[],
    benchmarks: BenchmarkData[] = DEFAULT_BENCHMARKS,
  ): BenchmarkComparisonResult[] {
    if (strategies.length === 0) return [];

    const results: BenchmarkComparisonResult[] = [];

    for (const s of strategies) {
      for (const bm of benchmarks) {
        const excessReturn = s.totalReturn - bm.totalReturn;
        const excessSharpe = s.sharpe - bm.sharpe;
        const excessDrawdown = bm.maxDrawdown - s.maxDrawdown; // positive = strategy is better

        // Outperformance score: weighted combination (0-100)
        // Return: scale -50..+50 → 0..100
        const returnScore = Math.max(0, Math.min(100, (excessReturn + 50)));
        // Sharpe: scale -2..+2 → 0..100
        const sharpeScore = Math.max(0, Math.min(100, (excessSharpe + 2) * 25));
        // Drawdown: scale -30..+30 → 0..100
        const ddScore = Math.max(0, Math.min(100, (excessDrawdown + 30) * (100 / 60)));

        const outperformanceScore = Math.round(
          returnScore * 0.4 + sharpeScore * 0.35 + ddScore * 0.25,
        );

        results.push({
          strategyId: s.strategyId,
          name: s.name,
          benchmarkName: bm.name,
          excessReturn: Math.round(excessReturn * 100) / 100,
          excessSharpe: Math.round(excessSharpe * 1000) / 1000,
          excessDrawdown: Math.round(excessDrawdown * 100) / 100,
          outperformanceScore,
        });
      }
    }

    log.info(`[RankingEngine] Benchmark comparison: ${strategies.length} strategies × ${benchmarks.length} benchmarks`);
    this.emit('benchmark:complete', results);
    return results;
  }

  // ─── Strategy Lifecycle Stage ──────────────────────────────────────────

  /**
   * Detect the lifecycle stage of each strategy based on metrics profile.
   *
   * Heuristics:
   * - **new**: Low trade count (< 50), short history, high variance indicators
   * - **growing**: Moderate trade count, improving metrics, positive Sharpe trend
   * - **mature**: High trade count, stable metrics, moderate Sharpe, low drawdown
   * - **declining**: High trade count but deteriorating metrics (low win-rate, high drawdown)
   */
  detectLifecycleStages(strategies: StrategyMetrics[]): LifecycleResult[] {
    if (strategies.length === 0) return [];

    const results: LifecycleResult[] = strategies.map((s) => {
      const estimatedDays = s.avgHoldingDays * s.tradeCount;
      let stage: LifecycleStage;
      let confidence: number;
      let details: string;

      if (s.tradeCount < 50 || estimatedDays < 60) {
        // New strategy
        stage = 'new';
        confidence = Math.min(0.95, 0.5 + (50 - s.tradeCount) / 100);
        details = `Low trade count (${s.tradeCount}) and short history (~${estimatedDays} days). Insufficient data for reliable assessment.`;
      } else if (s.tradeCount >= 50 && s.tradeCount < 200 && s.sharpe > 1.0 && s.winRate > 50) {
        // Growing strategy
        stage = 'growing';
        confidence = Math.min(0.9, 0.4 + s.sharpe * 0.15);
        details = `Moderate trade count (${s.tradeCount}), positive risk metrics (Sharpe ${s.sharpe}, WR ${s.winRate}%). Strategy appears to be in growth phase.`;
      } else if (s.tradeCount >= 200 && s.sharpe >= 0.8 && s.maxDrawdown <= 20 && s.winRate >= 45) {
        // Mature strategy
        stage = 'mature';
        confidence = Math.min(0.95, 0.5 + s.tradeCount / 2000);
        details = `High trade count (${s.tradeCount}), stable metrics (Sharpe ${s.sharpe}, DD ${s.maxDrawdown}%, WR ${s.winRate}%). Strategy is mature and battle-tested.`;
      } else if (s.tradeCount >= 100 && (s.winRate < 40 || s.maxDrawdown > 30 || s.profitFactor < 0.8)) {
        // Declining strategy
        stage = 'declining';
        confidence = Math.min(0.9, 0.4 + (100 - s.winRate) / 200);
        details = `Significant trade count (${s.tradeCount}) but deteriorating metrics (WR ${s.winRate}%, DD ${s.maxDrawdown}%, PF ${s.profitFactor}). Strategy may be in decline.`;
      } else {
        // Default: classify as growing if positive metrics, mature otherwise
        if (s.sharpe > 0.5) {
          stage = 'growing';
          confidence = 0.5;
          details = `Mixed signals. Trade count (${s.tradeCount}) suggests maturity but metrics are moderate. Classified as growing with low confidence.`;
        } else {
          stage = 'mature';
          confidence = 0.4;
          details = `Mixed signals. Trade count (${s.tradeCount}) with below-average metrics. Classified as mature with low confidence.`;
        }
      }

      confidence = Math.round(confidence * 100) / 100;

      return {
        strategyId: s.strategyId,
        name: s.name,
        stage,
        confidence,
        details,
      };
    });

    log.info(`[RankingEngine] Lifecycle stages detected for ${results.length} strategies`);
    this.emit('lifecycle:complete', results);
    return results;
  }
}

export default StrategyRankingEngine;
