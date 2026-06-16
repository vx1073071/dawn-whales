/**
 * QUANT MOO R162 P0-H2 — Backtest Snapshot API Routes
 *
 * Endpoints:
 *   GET  /api/backtest/snapshots?strategyId=X&limit=10&offset=0 — List snapshots
 *   GET  /api/backtest/snapshots/compare?strategyId=X — Compare latest 2
 *   GET  /api/backtest/snapshots/:snapshotId — Get single snapshot detail
 *   POST /api/backtest/snapshots — Save a new snapshot (called by backtest-engine)
 *   DELETE /api/backtest/snapshots?strategyId=X — Delete all snapshots for a strategy
 *
 * ≥200L
 */

import { Router, Request, Response } from 'express';
import { getSnapshotStore } from '../../electron/engine/backtest/backtest-snapshot';
import type {
  BacktestSnapshot,
  SnapshotMetrics,
} from '../../electron/engine/backtest/backtest-snapshot';

const router = Router();

// ═══════════════════════════════════════════════════════════
// POST /api/backtest/snapshots — Save a new snapshot
// ═══════════════════════════════════════════════════════════

router.post('/', async (req: Request, res: Response) => {
  try {
    const { strategyId, strategyName, symbol, dateRange, params, strategyType, metrics, tradeCount, equityCurve } = req.body;

    if (!strategyId || !symbol || !metrics) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: strategyId, symbol, metrics',
      });
      return;
    }

    // Validate metrics
    const requiredMetrics = ['totalReturn', 'sharpeRatio', 'maxDrawdown', 'winRate'];
    const missing = requiredMetrics.filter((k) => !(k in metrics));
    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        error: `Missing required metrics: ${missing.join(', ')}`,
      });
      return;
    }

    const store = getSnapshotStore();
    const snapshot = await store.save({
      strategyId,
      strategyName: strategyName || strategyId,
      symbol,
      dateRange: dateRange || { start: '', end: '' },
      params: params || {},
      strategyType: strategyType || 'custom',
      metrics: {
        totalReturn: metrics.totalReturn ?? 0,
        annualReturn: metrics.annualReturn ?? 0,
        sharpeRatio: metrics.sharpeRatio ?? 0,
        maxDrawdown: metrics.maxDrawdown ?? 0,
        winRate: metrics.winRate ?? 0,
        profitFactor: metrics.profitFactor ?? 0,
        totalTrades: metrics.totalTrades ?? 0,
        avgTradePnl: metrics.avgTradePnl ?? 0,
        avgHoldingBars: metrics.avgHoldingBars ?? 0,
        initialCapital: metrics.initialCapital ?? 100000,
        sortinoRatio: metrics.sortinoRatio,
        calmarRatio: metrics.calmarRatio,
      } as SnapshotMetrics,
      tradeCount: tradeCount ?? metrics.totalTrades ?? 0,
      equityCurve,
    });

    res.status(201).json({ success: true, snapshot });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error',
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/backtest/snapshots — List snapshots for a strategy
// ═══════════════════════════════════════════════════════════

router.get('/', async (req: Request, res: Response) => {
  try {
    const strategyId = String(req.query.strategyId || '').trim();
    if (!strategyId) {
      res.status(400).json({ success: false, error: 'Missing query parameter: strategyId' });
      return;
    }

    const limit = Math.min(parseInt(String(req.query.limit || '10')) || 10, 50);
    const offset = parseInt(String(req.query.offset || '0')) || 0;

    const store = getSnapshotStore();
    const result = await store.list(strategyId, limit, offset);

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error',
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/backtest/snapshots/compare — Compare latest 2
// ═══════════════════════════════════════════════════════════

router.get('/compare', async (req: Request, res: Response) => {
  try {
    const strategyId = String(req.query.strategyId || '').trim();
    if (!strategyId) {
      res.status(400).json({ success: false, error: 'Missing query parameter: strategyId' });
      return;
    }

    const store = getSnapshotStore();
    const comparison = await store.compare(strategyId);

    res.json({ success: true, ...comparison });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error',
    });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /api/backtest/snapshots — Delete all for a strategy
// ═══════════════════════════════════════════════════════════

router.delete('/', async (req: Request, res: Response) => {
  try {
    const strategyId = String(req.query.strategyId || '').trim();
    if (!strategyId) {
      res.status(400).json({ success: false, error: 'Missing query parameter: strategyId' });
      return;
    }

    const store = getSnapshotStore();
    await store.deleteAll(strategyId);

    res.json({ success: true, message: `All snapshots for ${strategyId} deleted.` });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error',
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/backtest/snapshots/:snapshotId — Get snapshot detail
// ═══════════════════════════════════════════════════════════

router.get('/:snapshotId', async (req: Request, res: Response) => {
  try {
    const snapshotId = req.params.snapshotId;
    if (!snapshotId) {
      res.status(400).json({ success: false, error: 'Missing snapshotId' });
      return;
    }

    const store = getSnapshotStore();
    const snapshot = await store.get(snapshotId);

    if (!snapshot) {
      res.status(404).json({ success: false, error: 'Snapshot not found' });
      return;
    }

    res.json({ success: true, snapshot });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error',
    });
  }
});

export default router;
