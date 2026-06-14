/**
 * Tests for Backtest Snapshot Store
 * JVS R162 P0-H2: Snapshot storage + comparison
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BacktestSnapshotStore,
  getSnapshotStore,
  type BacktestSnapshot,
  type SnapshotMetrics,
} from '../../../../electron/engine/backtest/backtest-snapshot';

// ============================================================================
// Helpers
// ============================================================================

function makeMetrics(overrides?: Partial<SnapshotMetrics>): SnapshotMetrics {
  return {
    totalReturn: 12.5,
    annualReturn: 18.0,
    sharpeRatio: 1.2,
    maxDrawdown: -15.0,
    winRate: 0.6,
    profitFactor: 1.8,
    totalTrades: 42,
    avgTradePnl: 0.8,
    avgHoldingBars: 5.5,
    initialCapital: 100000,
    ...overrides,
  };
}

function makeSnapshotInput(strategyId = 'test-strategy', overrides?: Partial<Omit<BacktestSnapshot, 'id' | 'timestamp'>>) {
  return {
    strategyId,
    strategyName: `Test ${strategyId}`,
    symbol: 'US.AAPL',
    dateRange: { start: '2026-01-02', end: '2026-06-13' },
    params: { period: 20, threshold: 0.5 },
    strategyType: 'ma_cross',
    metrics: makeMetrics(),
    tradeCount: 15,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('BacktestSnapshotStore (R162)', () => {

  let store: BacktestSnapshotStore;

  beforeEach(() => {
    store = new BacktestSnapshotStore();
  });

  afterEach(async () => {
    await store.flushAll().catch(() => {});
  });

  // ── Save ─────────────────────────────────────────────────────────────

  describe('save', () => {
    it('saves a snapshot and returns it with id + timestamp', async () => {
      const snap = await store.save(makeSnapshotInput('s1'));
      expect(snap.id).toBeTruthy();
      expect(typeof snap.id).toBe('string');
      expect(snap.strategyId).toBe('s1');
      expect(snap.timestamp).toBeGreaterThan(0);
      expect(snap.metrics.totalReturn).toBe(12.5);
    });

    it('generates unique IDs for different saves', async () => {
      const s1 = await store.save(makeSnapshotInput('unique-test'));
      const s2 = await store.save(makeSnapshotInput('unique-test'));
      expect(s1.id).not.toBe(s2.id);
    });

    it('stores all metric fields', async () => {
      const snap = await store.save(makeSnapshotInput('full-metrics'));
      expect(snap.metrics.sharpeRatio).toBe(1.2);
      expect(snap.metrics.maxDrawdown).toBe(-15.0);
      expect(snap.metrics.winRate).toBe(0.6);
      expect(snap.metrics.profitFactor).toBe(1.8);
      expect(snap.metrics.totalTrades).toBe(42);
    });

    it('persists custom params', async () => {
      const snap = await store.save(makeSnapshotInput('params-test', {
        params: { ma_short: 10, ma_long: 30, stopLoss: 0.05 },
        strategyType: 'momentum',
      }));
      expect(snap.params.ma_short).toBe(10);
      expect(snap.params.ma_long).toBe(30);
      expect(snap.strategyType).toBe('momentum');
    });
  });

  // ── List ─────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns empty list for unknown strategy', async () => {
      const result = await store.list('nonexistent');
      expect(result.strategyId).toBe('nonexistent');
      expect(result.snapshots).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.latest).toBeNull();
    });

    it('lists snapshots newest first', async () => {
      await store.save(makeSnapshotInput('list-test', { metrics: makeMetrics({ totalReturn: 10 }) }));
      await new Promise((r) => setTimeout(r, 10));
      await store.save(makeSnapshotInput('list-test', { metrics: makeMetrics({ totalReturn: 15 }) }));

      const result = await store.list('list-test');
      expect(result.count).toBe(2);
      expect(result.snapshots).toHaveLength(2);
      expect(result.latest).not.toBeNull();
      // Newest should have higher return
      expect(result.latest!.metrics.totalReturn).toBe(15);
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await store.save(makeSnapshotInput('limit-test', { metrics: makeMetrics({ totalReturn: i }) }));
        await new Promise((r) => setTimeout(r, 5));
      }

      const result = await store.list('limit-test', 3);
      expect(result.snapshots.length).toBeLessThanOrEqual(3);
      expect(result.count).toBe(5);
    });
  });

  // ── Get single ───────────────────────────────────────────────────────

  describe('get', () => {
    it('returns snapshot by ID', async () => {
      const saved = await store.save(makeSnapshotInput('get-test'));
      const found = await store.get(saved.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(saved.id);
      expect(found!.strategyId).toBe('get-test');
    });

    it('returns null for unknown ID', async () => {
      const found = await store.get('nonexistent-id');
      expect(found).toBeNull();
    });
  });

  // ── Compare ──────────────────────────────────────────────────────────

  describe('compare', () => {
    it('returns first_run when only one snapshot exists', async () => {
      await store.save(makeSnapshotInput('compare-single'));
      const cmp = await store.compare('compare-single');
      expect(cmp.direction).toBe('first_run');
      expect(cmp.previous).toBeNull();
      expect(cmp.current).not.toBeNull();
    });

    it('compares two snapshots and detects improvement', async () => {
      await store.save(makeSnapshotInput('compare-test', {
        params: { period: 10, threshold: 0.3 },
        metrics: makeMetrics({ totalReturn: 5.0 }),
      }));
      await new Promise((r) => setTimeout(r, 10));
      await store.save(makeSnapshotInput('compare-test', {
        params: { period: 20, threshold: 0.5 },
        metrics: makeMetrics({ totalReturn: 12.0 }),
      }));

      const cmp = await store.compare('compare-test');
      expect(cmp.direction).toBe('improved');
      expect(cmp.previous).not.toBeNull();
      expect(cmp.current).not.toBeNull();

      // Should have param changes
      expect(cmp.paramChanges.length).toBeGreaterThan(0);
      const periodChange = cmp.paramChanges.find((p) => p.key === 'period');
      expect(periodChange?.changed).toBe(true);

      // Should have metric diffs
      const returnDiff = cmp.diffs.find((d) => d.key === 'totalReturn');
      expect(returnDiff?.diff).toBeGreaterThan(0);
    });

    it('detects degraded performance', async () => {
      await store.save(makeSnapshotInput('degrade-test', {
        metrics: makeMetrics({ totalReturn: 20.0, sharpeRatio: 2.0 }),
      }));
      await new Promise((r) => setTimeout(r, 10));
      await store.save(makeSnapshotInput('degrade-test', {
        metrics: makeMetrics({ totalReturn: 5.0, sharpeRatio: 0.8 }),
      }));

      const cmp = await store.compare('degrade-test');
      expect(cmp.direction).toBe('degraded');

      const returnDiff = cmp.diffs.find((d) => d.key === 'totalReturn');
      expect(returnDiff?.diff).toBeLessThan(0);

      const sharpeDiff = cmp.diffs.find((d) => d.key === 'sharpeRatio');
      expect(sharpeDiff?.diff).toBeLessThan(0);
    });

    it('marks unchanged when returns are similar', async () => {
      await store.save(makeSnapshotInput('same-test', {
        metrics: makeMetrics({ totalReturn: 10.0 }),
      }));
      await new Promise((r) => setTimeout(r, 10));
      await store.save(makeSnapshotInput('same-test', {
        metrics: makeMetrics({ totalReturn: 10.05 }),
      }));

      const cmp = await store.compare('same-test');
      expect(cmp.direction).toBe('unchanged');
    });

    it('provides summary string', async () => {
      await store.save(makeSnapshotInput('summary-test', {
        params: { fast: 5, slow: 20 },
        metrics: makeMetrics({ totalReturn: 8.0 }),
      }));
      await new Promise((r) => setTimeout(r, 10));
      await store.save(makeSnapshotInput('summary-test', {
        params: { fast: 10, slow: 30 },
        metrics: makeMetrics({ totalReturn: 12.0 }),
      }));

      const cmp = await store.compare('summary-test');
      expect(cmp.summary).toBeTruthy();
      expect(typeof cmp.summary).toBe('string');
      expect(cmp.summary.length).toBeGreaterThan(0);
    });
  });

  // ── Delete ───────────────────────────────────────────────────────────

  describe('deleteAll', () => {
    it('deletes all snapshots for a strategy', async () => {
      await store.save(makeSnapshotInput('delete-test'));
      await store.save(makeSnapshotInput('delete-test'));

      const before = await store.list('delete-test');
      expect(before.count).toBe(2);

      await store.deleteAll('delete-test');

      const after = await store.list('delete-test');
      expect(after.count).toBe(0);
      expect(after.snapshots).toHaveLength(0);
    });

    it('does not affect other strategies', async () => {
      await store.save(makeSnapshotInput('del-a'));
      await store.save(makeSnapshotInput('del-b'));

      await store.deleteAll('del-a');

      const b = await store.list('del-b');
      expect(b.count).toBe(1);
    });
  });

  // ── Singleton ────────────────────────────────────────────────────────

  describe('singleton', () => {
    it('getSnapshotStore returns same instance', () => {
      const a = getSnapshotStore();
      const b = getSnapshotStore();
      expect(a).toBe(b);
    });
  });

  // ── Invariants ───────────────────────────────────────────────────────

  describe('invariants', () => {
    it('snapshot IDs are always strings', async () => {
      const snap = await store.save(makeSnapshotInput('invariant-test'));
      expect(typeof snap.id).toBe('string');
      expect(snap.id.length).toBeGreaterThan(5);
    });

    it('metrics are numbers (not strings or null)', async () => {
      const snap = await store.save(makeSnapshotInput('type-test'));
      expect(typeof snap.metrics.totalReturn).toBe('number');
      expect(typeof snap.metrics.sharpeRatio).toBe('number');
      expect(typeof snap.metrics.maxDrawdown).toBe('number');
      expect(typeof snap.metrics.winRate).toBe('number');
    });

    it('timestamp is recent', async () => {
      const before = Date.now() - 100;
      const snap = await store.save(makeSnapshotInput('ts-test'));
      expect(snap.timestamp).toBeGreaterThanOrEqual(before);
      expect(snap.timestamp).toBeLessThanOrEqual(Date.now() + 1000);
    });
  });
});
