/**
 * DAWN WHALES R162 P0-H2 — Backtest Snapshot + Comparison
 *
 * - Saves every backtest run as an immutable snapshot
 * - GET /api/backtest/snapshots?strategyId=X lists all snapshots for a strategy
 * - Param highlighting: changed params vs previous run marked green/red
 * - Return diff: absolute % change vs previous snapshot
 *
 * JVS 4h
 */

import log from 'electron-log';
import { createRedisCache } from '../data/redis-cache-layer';
import i18n from '../../../src/i18n';

// ─── Types ────────────────────────────────────────────────────────────────

/** A single backtest snapshot — immutable record of one run */
export interface BacktestSnapshot {
  /** Unique snapshot ID (generated) */
  id: string;
  /** Strategy identifier (user-level) */
  strategyId: string;
  /** Strategy display name at time of run */
  strategyName: string;
  /** Symbol traded */
  symbol: string;
  /** Human-readable timestamp */
  timestamp: number;
  /** Date range of the backtest */
  dateRange: { start: string; end: string };
  /** Strategy params frozen at run time */
  params: Record<string, number>;
  /** Strategy type */
  strategyType: string;
  /** Core metrics */
  metrics: SnapshotMetrics;
  /** Trades count for quick summary */
  tradeCount: number;
  /** Optional: full equity curve (points) — omitted in list, included in detail */
  equityCurve?: { time: number; value: number }[];
}

/** Key performance metrics in a snapshot */
export interface SnapshotMetrics {
  totalReturn: number;
  annualReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgTradePnl: number;
  avgHoldingBars: number;
  initialCapital: number;
  sortinoRatio?: number;
  calmarRatio?: number;
}

/** Comparison between two snapshots */
export interface SnapshotComparison {
  /** Current snapshot */
  current: BacktestSnapshot;
  /** Previous snapshot (or null if first run) */
  previous: BacktestSnapshot | null;
  /** Per-metric differences (current - previous) */
  diffs: MetricDiff[];
  /** Per-param differences (highlight changed params) */
  paramChanges: ParamChange[];
  /** One-line summary of change */
  summary: string;
  /** Overall improvement direction */
  direction: 'improved' | 'degraded' | 'unchanged' | 'first_run';
}

/** Difference for a single metric */
export interface MetricDiff {
  key: string;
  label: string;
  current: number;
  previous: number | null;
  diff: number | null;
  /** Whether higher is better for this metric */
  higherIsBetter: boolean;
  /** Normalized change for color coding (green/red) */
  pctChange: number | null;
}

/** Highlight a changed parameter */
export interface ParamChange {
  key: string;
  previous: number | null;
  current: number;
  /** true if value changed */
  changed: boolean;
}

/** Summary of all snapshots for a strategy */
export interface SnapshotListResponse {
  strategyId: string;
  snapshots: BacktestSnapshot[];
  count: number;
  /** Latest snapshot (for quick reference) */
  latest: BacktestSnapshot | null;
}

/** Request to list snapshots */
export interface SnapshotListRequest {
  strategyId: string;
  limit?: number;
  offset?: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const SNAPSHOT_PREFIX = 'btsnap:';
const MAX_SNAPSHOTS_PER_STRATEGY = 50; // keep last 50 per strategy
const SNAPSHOT_TTL = 30 * 24 * 3600; // 30 days

/** Human-readable labels for metrics */
const METRIC_LABELS: Record<string, string> = {
  totalReturn: 'Total Return',
  annualReturn: 'Annual Return',
  sharpeRatio: 'Sharpe Ratio',
  maxDrawdown: 'Max Drawdown',
  winRate: 'Win Rate',
  profitFactor: 'Profit Factor',
  totalTrades: 'Total Trades',
  avgTradePnl: 'Avg Trade PnL',
  avgHoldingBars: 'Avg Holding Bars',
  initialCapital: 'Initial Capital',
  sortinoRatio: 'Sortino Ratio',
  calmarRatio: 'Calmar Ratio',
};

/** Which metrics are "higher is better" */
const HIGHER_IS_BETTER: Set<string> = new Set([
  'totalReturn', 'annualReturn', 'sharpeRatio', 'winRate',
  'profitFactor', 'avgTradePnl', 'sortinoRatio', 'calmarRatio',
]);

// ─── Backtest Snapshot Store ─────────────────────────────────────────────

export class BacktestSnapshotStore {
  private cache = createRedisCache({ namespace: 'backtest-snapshots', defaultTTL: SNAPSHOT_TTL });

  /**
   * Save a backtest run as a snapshot.
   * Called automatically after each backtest run.
   */
  async save(snapshot: Omit<BacktestSnapshot, 'id' | 'timestamp'>): Promise<BacktestSnapshot> {
    const id = this.generateId(snapshot.strategyId);
    const now = Date.now();

    const snap: BacktestSnapshot = {
      ...snapshot,
      id,
      timestamp: now,
    };

    // Store in a list for this strategy
    const listKey = `${SNAPSHOT_PREFIX}list:${snapshot.strategyId}`;
    const detailKey = `${SNAPSHOT_PREFIX}detail:${id}`;

    // Save detail
    await this.cache.set(detailKey, JSON.stringify(snap), SNAPSHOT_TTL);

    // Append to list (store as hash: snapId → timestamp)
    await this.cache.hset(listKey, id, String(now));

    // Prune old snapshots
    await this.pruneOldSnapshots(snapshot.strategyId);

    log.info(`[BacktestSnapshot] Saved snapshot ${id} for strategy ${snapshot.strategyId}`);
    return snap;
  }

  /**
   * List snapshots for a strategy, newest first.
   */
  async list(strategyId: string, limit = 10, offset = 0): Promise<SnapshotListResponse> {
    const listKey = `${SNAPSHOT_PREFIX}list:${snapshot.strategyId}`;
    const hash = await this.cache.hgetall(listKey);

    if (!hash || Object.keys(hash).length === 0) {
      return { strategyId, snapshots: [], count: 0, latest: null };
    }

    // Sort by timestamp descending
    const sorted = Object.entries(hash)
      .sort(([, a], [, b]) => Number(b) - Number(a));

    const total = sorted.length;
    const page = sorted.slice(offset, offset + limit);

    // Load detail for each
    const details = await this.cache.mget<string>(...page.map(([id]) => `${SNAPSHOT_PREFIX}detail:${id}`));
    const snapshots: BacktestSnapshot[] = [];
    for (const detail of details) {
      if (detail) {
        try {
          snapshots.push(JSON.parse(detail));
        } catch { /* skip corrupt */ }
      }
    }

    // Omit equity curve for list view (reduce payload)
    const listSnapshots = snapshots.map((s) => {
      const { equityCurve: _, ...rest } = s;
      return rest as BacktestSnapshot;
    });

    const latest = listSnapshots.length > 0 ? listSnapshots[0] : null;

    return { strategyId, snapshots: listSnapshots, count: total, latest };
  }

  /**
   * Get a single snapshot by ID.
   */
  async get(snapshotId: string): Promise<BacktestSnapshot | null> {
    const detailKey = `${SNAPSHOT_PREFIX}detail:${snapshotId}`;
    const data = await this.cache.get<string>(detailKey);
    if (!data) return null;
    try {
      return JSON.parse(data) as BacktestSnapshot;
    } catch {
      return null;
    }
  }

  /**
   * Compare the two most recent snapshots for a strategy.
   * Returns param highlights and metric diffs.
   */
  async compare(strategyId: string): Promise<SnapshotComparison> {
    const { snapshots } = await this.list(strategyId, 2);

    const current = snapshots[0] || null;
    const previous = snapshots[1] || null;

    if (!current) {
      return {
        current: null as any,
        previous: null,
        diffs: [],
        paramChanges: [],
        summary: 'No snapshots found.',
        direction: 'unchanged',
      };
    }

    if (!previous) {
      return {
        current,
        previous: null,
        diffs: [],
        paramChanges: [],
        summary: i18n.t('backtest.snapshot.firstRun', 'First backtest run for this strategy.'),
        direction: 'first_run',
      };
    }

    // Compute metric diffs
    const diffs: MetricDiff[] = [];
    const currentMetrics = current.metrics as Record<string, number>;
    const prevMetrics = previous.metrics as Record<string, number>;

    for (const key of Object.keys(currentMetrics)) {
      const cur = currentMetrics[key];
      const prev = prevMetrics[key] ?? null;
      const diff = prev !== null ? cur - prev : null;
      const higherIsBetter = HIGHER_IS_BETTER.has(key);
      let pctChange: number | null = null;
      if (prev !== null && prev !== 0) {
        pctChange = (diff! / Math.abs(prev)) * 100;
      }

      diffs.push({
        key,
        label: METRIC_LABELS[key] || key,
        current: cur,
        previous: prev,
        diff,
        higherIsBetter,
        pctChange,
      });
    }

    // Compute param changes
    const paramChanges: ParamChange[] = [];
    const currentParams = current.params;
    const prevParams = previous.params;

    const allParamKeys = new Set([
      ...Object.keys(currentParams),
      ...Object.keys(prevParams),
    ]);

    for (const key of allParamKeys) {
      paramChanges.push({
        key,
        previous: prevParams[key] ?? null,
        current: currentParams[key] ?? 0,
        changed: currentParams[key] !== prevParams[key],
      });
    }

    // Determine direction
    const returnDiff = diffs.find((d) => d.key === 'totalReturn');
    let direction: SnapshotComparison['direction'] = 'unchanged';
    if (returnDiff && returnDiff.diff !== null) {
      if (returnDiff.diff > 0.1) direction = 'improved';
      else if (returnDiff.diff < -0.1) direction = 'degraded';
    }

    // Summary
    const changedParams = paramChanges.filter((p) => p.changed);
    let summary = '';
    if (changedParams.length > 0) {
      const changedList = changedParams.map((p) => `${p.key}: ${p.previous ?? 'none'}→${p.current}`).join(', ');
      summary = i18n.t('backtest.snapshot.summaryChanged', {
        count: changedParams.length,
        params: changedList,
        returnDiff: returnDiff?.diff?.toFixed(2) ?? '0',
        defaultValue: `${changedParams.length} param(s) changed (${changedList}). Return Δ: ${returnDiff?.diff?.toFixed(2) ?? '0'}%`,
      });
    } else {
      summary = i18n.t('backtest.snapshot.summaryNoChange', {
        returnDiff: returnDiff?.diff?.toFixed(2) ?? '0',
        defaultValue: `No params changed. Return Δ: ${returnDiff?.diff?.toFixed(2) ?? '0'}%`,
      });
    }

    return {
      current,
      previous,
      diffs,
      paramChanges,
      summary,
      direction,
    };
  }

  /**
   * Delete all snapshots for a strategy.
   */
  async deleteAll(strategyId: string): Promise<boolean> {
    const listKey = `${SNAPSHOT_PREFIX}list:${snapshot.strategyId}`;
    const hash = await this.cache.hgetall(listKey);
    if (hash) {
      const keys = Object.keys(hash).map((id) => `${SNAPSHOT_PREFIX}detail:${id}`);
      await this.cache.del(...keys);
    }
    await this.cache.del(listKey);
    log.info(`[BacktestSnapshot] Deleted all snapshots for ${strategyId}`);
    return true;
  }

  /**
   * Clear all snapshot data (for testing).
   */
  async flushAll(): Promise<void> {
    await this.cache.flushdb();
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private generateId(strategyId: string): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const shortId = strategyId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    return `${shortId}-${ts}-${rand}`;
  }

  private async pruneOldSnapshots(strategyId: string): Promise<void> {
    const listKey = `${SNAPSHOT_PREFIX}list:${snapshot.strategyId}`;
    const hash = await this.cache.hgetall(listKey);
    if (!hash) return;

    const entries = Object.entries(hash).sort(([, a], [, b]) => Number(b) - Number(a));
    if (entries.length <= MAX_SNAPSHOTS_PER_STRATEGY) return;

    const toDelete = entries.slice(MAX_SNAPSHOTS_PER_STRATEGY);
    for (const [id] of toDelete) {
      const detailKey = `${SNAPSHOT_PREFIX}detail:${id}`;
      await this.cache.del(detailKey);
      await this.cache.hdel(listKey, id);
    }
    log.info(`[BacktestSnapshot] Pruned ${toDelete.length} old snapshots for ${strategyId}`);
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let _store: BacktestSnapshotStore | null = null;

export function getSnapshotStore(): BacktestSnapshotStore {
  if (!_store) {
    _store = new BacktestSnapshotStore();
  }
  return _store;
}

export function createSnapshotStore(): BacktestSnapshotStore {
  _store = new BacktestSnapshotStore();
  return _store;
}
