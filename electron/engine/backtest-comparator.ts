// ── Q13: Backtest Comparator ─────────────────────────────────────────────────
// Multi-strategy backtest comparison with radar chart data
// IPC: strategy:compare

import log from 'electron-log';

export {};

// ── Types ──────────────────────────────────────────────────────────────────

export interface BacktestResult {
  id: string;
  name: string;
  symbol: string;
  startDate: string;
  endDate: string;
  totalReturn: number;     // % return
  sharpeRatio: number;
  maxDrawdown: number;    // % drawdown (negative)
  sortinoRatio: number;
  calmarRatio: number;
  winRate: number;        // 0-1
  profitFactor: number;   // gross profit / gross loss
  totalTrades: number;
  avgHoldingDays: number;
  beta: number;
  alpha: number;
  turnover: number;        // annual turnover
}

export interface RadarAxis {
  axis: string;
  value: number;
  min: number;
  max: number;
  higherIsBetter: boolean;
  normalized: number;      // 0-1 normalized
}

export interface StrategyComparison {
  strategies: string[];           // strategy IDs
  radarAxes: RadarAxis[];       // common comparison axes
  perStrategy: {
    id: string;
    name: string;
    metrics: Record<string, number>;
    radar: RadarAxis[];
    rank: Record<string, number>;   // rank per metric (1=best)
    overallScore: number;            // weighted overall score
    recommendation: string;
  }[];
  bestPerAxis: Record<string, string>; // axis → best strategy ID
  correlatedPairs: { idA: string; idB: string; rankDiff: number }[];
}

// ── Normalization ─────────────────────────────────────────────────────────────

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.round(((value - min) / (max - min)) * 1000) / 1000;
}

// ── Build Radar Axes ─────────────────────────────────────────────────────────

const AXES: {
  key: string; label: string; higherIsBetter: boolean; weight: number
}[] = [
  { key: 'sharpeRatio',      label: 'Sharpe',       higherIsBetter: true,  weight: 2 },
  { key: 'maxDrawdown',       label: 'Max DD',        higherIsBetter: false, weight: 2 }, // less negative = better
  { key: 'calmarRatio',       label: 'Calmar',        higherIsBetter: true,  weight: 1.5 },
  { key: 'sortinoRatio',      label: 'Sortino',       higherIsBetter: true,  weight: 1 },
  { key: 'winRate',           label: 'Win Rate',       higherIsBetter: true,  weight: 1 },
  { key: 'profitFactor',      label: 'Profit Factor', higherIsBetter: true,  weight: 1.5 },
  { key: 'totalReturn',       label: 'Total Return',  higherIsBetter: true,  weight: 2 },
  { key: 'beta',              label: 'Beta',           higherIsBetter: false, weight: 1 }, // lower abs beta = better
  { key: 'alpha',             label: 'Alpha',          higherIsBetter: true,  weight: 1 },
];

function getMetric(r: BacktestResult, key: string): number {
  switch (key) {
    case 'maxDrawdown': return r.maxDrawdown; // keep negative
    case 'beta':         return Math.abs(r.beta); // use absolute
    default:             return (r as any)[key] ?? 0;
  }
}

function buildAxes(results: BacktestResult[]) {
  return AXES.map(ax => {
    const vals = results.map(r => getMetric(r, ax.key));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return {
      axis: ax.key,
      label: ax.label,
      value: 0, // filled per strategy
      min,
      max,
      higherIsBetter: ax.higherIsBetter,
      normalized: 0,
      weight: ax.weight,
    };
  });
}

// ── Rank per metric ───────────────────────────────────────────────────────────

function rankMetric(results: BacktestResult[], key: string, higherIsBetter: boolean): string[] {
  return [...results]
    .sort((a, b) => {
      const va = getMetric(a, key), vb = getMetric(b, key);
      return higherIsBetter ? vb - va : va - vb;
    })
    .map(r => r.id);
}

// ── Overall Score ─────────────────────────────────────────────────────────────

function overallScore(radar: RadarAxis[]): number {
  let weighted = 0, totalWeight = 0;
  for (const ax of radar) {
    // For metrics where higherIsBetter=false, invert normalized
    const effective = ax.higherIsBetter ? ax.normalized : 1 - ax.normalized;
    weighted += effective * (ax as any).weight;
    totalWeight += (ax as any).weight;
  }
  return totalWeight > 0 ? Math.round((weighted / totalWeight) * 1000) / 1000 : 0;
}

// ── Recommendation ───────────────────────────────────────────────────────────

function recommend(overallScore: number, maxDrawdown: number, sharpe: number): string {
  if (overallScore >= 0.75) {
    if (maxDrawdown > -15) return 'Strong buy — high return, controlled risk';
    return 'Buy — good returns with moderate drawdown';
  }
  if (overallScore >= 0.5) {
    if (maxDrawdown > -10) return 'Hold — stable but not outstanding';
    return 'Cautious hold — risk-adjusted returns are acceptable';
  }
  if (sharpe < 0.5) return 'Avoid — poor risk-adjusted performance';
  return 'Hold/Sell — consider opportunity cost';
}

// ── Main: Compare Backtests ──────────────────────────────────────────────────

export function compareBacktests(results: BacktestResult[]): StrategyComparison {
  log.info('[BacktestComparator] Comparing', results.length, 'strategies');

  if (results.length === 0) {
    return { strategies: [], radarAxes: [], perStrategy: [], bestPerAxis: {}, correlatedPairs: [] };
  }

  const ids = results.map(r => r.id);
  const axes = buildAxes(results);

  // Per-strategy radar + ranks
  const perStrategy = results.map(r => {
    const radar = axes.map(ax => {
      const raw = getMetric(r, ax.key);
      return {
        ...ax,
        value: raw,
        normalized: normalize(raw, ax.min, ax.max),
      };
    });

    const ranks: Record<string, number> = {};
    for (const ax of AXES) {
      const ranked = rankMetric(results, ax.key, ax.higherIsBetter);
      ranks[ax.key] = ranked.indexOf(r.id) + 1;
    }

    const score = overallScore(radar);
    return {
      id: r.id,
      name: r.name,
      metrics: AXES.reduce((m, ax) => ({ ...m, [ax.key]: getMetric(r, ax.key) }), {}),
      radar,
      rank: ranks,
      overallScore: score,
      recommendation: recommend(score, r.maxDrawdown, r.sharpeRatio),
    };
  });

  // Sort by overall score descending
  perStrategy.sort((a, b) => b.overallScore - a.overallScore);

  // Best per axis
  const bestPerAxis: Record<string, string> = {};
  for (const ax of AXES) {
    const ranked = rankMetric(results, ax.key, ax.higherIsBetter);
    bestPerAxis[ax.key] = ranked[0];
  }

  // Correlated pairs (strategies with similar rank profiles)
  const correlatedPairs: StrategyComparison['correlatedPairs'] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const si = perStrategy.find(s => s.id === ids[i])!;
      const sj = perStrategy.find(s => s.id === ids[j])!;
      const rankDiffs = AXES.map(ax => Math.abs(si.rank[ax.key] - sj.rank[ax.key]));
      const avgRankDiff = rankDiffs.reduce((a, b) => a + b, 0) / rankDiffs.length;
      if (avgRankDiff <= 1.5) {
        correlatedPairs.push({ idA: ids[i], idB: ids[j], rankDiff: Math.round(avgRankDiff * 100) / 100 });
      }
    }
  }

  log.info(`[BacktestComparator] Done. Best overall: ${perStrategy[0]?.name ?? 'N/A'}`);

  return {
    strategies: ids,
    radarAxes: axes,
    perStrategy,
    bestPerAxis,
    correlatedPairs,
  };
}

// ── Quick Summary Table ─────────────────────────────────────────────────────

export interface SummaryRow {
  id: string;
  name: string;
  totalReturn: string;
  sharpe: string;
  maxDD: string;
  winRate: string;
  score: string;
  recommendation: string;
}

export function summaryTable(results: BacktestResult[], comparison?: StrategyComparison): SummaryRow[] {
  const comp = comparison ?? compareBacktests(results);
  return comp.perStrategy.map(ps => {
    const r = results.find(x => x.id === ps.id)!;
    return {
      id: ps.id,
      name: ps.name,
      totalReturn: `${r.totalReturn >= 0 ? '+' : ''}${r.totalReturn.toFixed(2)}%`,
      sharpe: r.sharpeRatio.toFixed(2),
      maxDD: `${r.maxDrawdown.toFixed(2)}%`,
      winRate: `${(r.winRate * 100).toFixed(1)}%`,
      score: (ps.overallScore * 100).toFixed(1) + '%',
      recommendation: ps.recommendation,
    };
  });
}