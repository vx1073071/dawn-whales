/**
 * R167 P1-X1: Live Deviation Tracker Backend — Tests
 *
 * Covers: POST /track, GET /snapshots/:strategyId, GET /alert-check/:strategyId,
 *         GET /factor-decay/:strategyId, GET /summary/:strategyId
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import deviationTrackerRoutes from '../../../server/routes/deviation-tracker';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/deviation', deviationTrackerRoutes);
  return app;
}

describe('R167 P1-X1: Live Deviation Tracker', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  // ── POST /track ──────────────────────────────────────────────────────

  describe('POST /api/deviation/track', () => {
    it('records a deviation snapshot successfully', async () => {
      const res = await request(app)
        .post('/api/deviation/track')
        .send({
          strategyId: 'STG-001',
          liveReturns: [
            { symbol: 'HK:00700', market: 'HK', instrumentType: 'stock', liveReturnPct: 12.5, timestamp: new Date().toISOString() },
          ],
          baseline: {
            expectedReturnPct: 15.0,
            expectedSharpe: 1.2,
            expectedDrawdown: 10,
            expectedWinRate: 60,
            backtestRunId: 'BT-001',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.snapshotId).toMatch(/^DEV-/);
      expect(res.body.data.strategyId).toBe('STG-001');
      expect(res.body.data.deviations).toHaveLength(4);
      expect(typeof res.body.data.overallDeviationPct).toBe('number');
    });

    it('detects critical alert for >15% deviation', async () => {
      const res = await request(app)
        .post('/api/deviation/track')
        .send({
          strategyId: 'STG-CRITICAL',
          liveReturns: [
            { symbol: 'US:TSLA', market: 'US', instrumentType: 'stock', liveReturnPct: -5, timestamp: new Date().toISOString() },
          ],
          baseline: {
            expectedReturnPct: 25,
            expectedSharpe: 2.0,
            expectedDrawdown: 5,
            expectedWinRate: 75,
            backtestRunId: 'BT-002',
          },
        });

      expect(res.body.data.alertLevel).toBe('critical');
      expect(res.body.data.alertMessage).toBeTruthy();
      expect(res.body.data.alertMessage).toContain('15%');
    });

    it('detects warning alert for >10% deviation', async () => {
      const res = await request(app)
        .post('/api/deviation/track')
        .send({
          strategyId: 'STG-WARN',
          liveReturns: [
            { symbol: 'HK:00388', market: 'HK', instrumentType: 'stock', liveReturnPct: 8.5, liveDrawdown: 12, liveSharpe: 0.85, liveWinRate: 50, timestamp: new Date().toISOString() },
          ],
          baseline: {
            expectedReturnPct: 10,
            expectedSharpe: 1.0,
            expectedDrawdown: 10,
            expectedWinRate: 55,
            backtestRunId: 'BT-003',
          },
        });

      expect(['warning', 'critical']).toContain(res.body.data.alertLevel);
      expect(res.body.data.overallDeviationPct).toBeGreaterThan(0);
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(app)
        .post('/api/deviation/track')
        .send({ strategyId: 'STG-BAD' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for empty liveReturns array', async () => {
      const res = await request(app)
        .post('/api/deviation/track')
        .send({
          strategyId: 'STG-EMPTY',
          liveReturns: [],
          baseline: { expectedReturnPct: 10, expectedSharpe: 1, expectedDrawdown: 5, expectedWinRate: 50, backtestRunId: 'BT' },
        });

      expect(res.status).toBe(400);
    });

    it('calculates per-metric deviations correctly', async () => {
      const res = await request(app)
        .post('/api/deviation/track')
        .send({
          strategyId: 'STG-ACCURATE',
          liveReturns: [
            { symbol: 'CRYPTO:BTC-USDT', market: 'CRYPTO', instrumentType: 'crypto', liveReturnPct: 20, liveSharpe: 1.5, liveDrawdown: 8, liveWinRate: 65, timestamp: new Date().toISOString() },
          ],
          baseline: {
            expectedReturnPct: 20,
            expectedSharpe: 1.5,
            expectedDrawdown: 8,
            expectedWinRate: 65,
            backtestRunId: 'BT-EXACT',
          },
        });

      for (const d of res.body.data.deviations) {
        expect(d.diff).toBeCloseTo(0, 0);
        expect(d.status).toBe('ok');
      }
    });

    it('aggregates multiple live return entries', async () => {
      const res = await request(app)
        .post('/api/deviation/track')
        .send({
          strategyId: 'STG-MULTI',
          liveReturns: [
            { symbol: 'US:AAPL', market: 'US', instrumentType: 'stock', liveReturnPct: 10, timestamp: new Date().toISOString() },
            { symbol: 'US:GOOGL', market: 'US', instrumentType: 'stock', liveReturnPct: 20, timestamp: new Date().toISOString() },
            { symbol: 'US:MSFT', market: 'US', instrumentType: 'stock', liveReturnPct: 30, timestamp: new Date().toISOString() },
          ],
          baseline: {
            expectedReturnPct: 20,
            expectedSharpe: 1.5,
            expectedDrawdown: 10,
            expectedWinRate: 60,
            backtestRunId: 'BT-MULTI',
          },
        });

      expect(res.body.success).toBe(true);
      const returnDeviation = res.body.data.deviations.find((d: any) => d.metric === 'return');
      // Average live: 20, expected: 20 => ~0 deviation
      expect(returnDeviation.diffPct).toBeCloseTo(0, -1);
    });
  });

  // ── GET /snapshots/:strategyId ────────────────────────────────────────

  describe('GET /api/deviation/snapshots/:strategyId', () => {
    it('returns empty list for unknown strategy', async () => {
      const res = await request(app).get('/api/deviation/snapshots/UNKNOWN');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(0);
    });

    it('returns snapshots after tracking', async () => {
      await request(app).post('/api/deviation/track').send({
        strategyId: 'STG-LIST',
        liveReturns: [{ symbol: 'HK:09988', market: 'HK', instrumentType: 'stock', liveReturnPct: 5, timestamp: new Date().toISOString() }],
        baseline: { expectedReturnPct: 8, expectedSharpe: 1.0, expectedDrawdown: 12, expectedWinRate: 55, backtestRunId: 'BT-LIST' },
      });

      const res = await request(app).get('/api/deviation/snapshots/STG-LIST');
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.strategyId).toBe('STG-LIST');
    });
  });

  // ── GET /alert-check/:strategyId ──────────────────────────────────────

  describe('GET /api/deviation/alert-check/:strategyId', () => {
    it('reports no data for unknown strategy', async () => {
      const res = await request(app).get('/api/deviation/alert-check/FRESH');
      expect(res.body.data.hasDeviations).toBe(false);
      expect(res.body.data.breached).toBe(false);
    });

    it('returns threshold breached=true when deviation >15%', async () => {
      await request(app).post('/api/deviation/track').send({
        strategyId: 'STG-ALERT',
        liveReturns: [{ symbol: 'US:NVDA', market: 'US', instrumentType: 'stock', liveReturnPct: 5, liveDrawdown: 25, liveSharpe: 0.5, liveWinRate: 40, timestamp: new Date().toISOString() }],
        baseline: { expectedReturnPct: 30, expectedSharpe: 2, expectedDrawdown: 5, expectedWinRate: 80, backtestRunId: 'BT-HI' },
      });

      const res = await request(app).get('/api/deviation/alert-check/STG-ALERT');
      expect(res.body.data.breached).toBe(true);
      expect(res.body.data.message).toContain('exceeds');
    });
  });

  // ── GET /factor-decay/:strategyId ────────────────────────────────────

  describe('GET /api/deviation/factor-decay/:strategyId', () => {
    it('returns no decay data when no alerts triggered', async () => {
      const res = await request(app).get('/api/deviation/factor-decay/NO-ALERTS');
      expect(res.body.data.hasFactorDecay).toBe(false);
    });
  });

  // ── GET /summary/:strategyId ────────────────────────────────────────

  describe('GET /api/deviation/summary/:strategyId', () => {
    it('returns empty summary for unknown strategy', async () => {
      const res = await request(app).get('/api/deviation/summary/UNTRACKED');
      expect(res.body.data.totalSnapshots).toBe(0);
    });

    it('returns trend after multiple track calls', async () => {
      const track = (ret: number) =>
        request(app).post('/api/deviation/track').send({
          strategyId: 'STG-SUM',
          liveReturns: [{ symbol: 'HK:00005', market: 'HK', instrumentType: 'stock', liveReturnPct: ret, timestamp: new Date().toISOString() }],
          baseline: { expectedReturnPct: 10, expectedSharpe: 1, expectedDrawdown: 10, expectedWinRate: 60, backtestRunId: 'BT-SUM' },
        });

      await track(5);
      await track(8);
      await track(11);

      const res = await request(app).get('/api/deviation/summary/STG-SUM');
      expect(res.body.data.totalSnapshots).toBeGreaterThanOrEqual(3);
      expect(res.body.data.trend.direction).toBeDefined();
    });

    it('trend improves when deviation decreases', async () => {
      const track = (ret: number) =>
        request(app).post('/api/deviation/track').send({
          strategyId: 'STG-IMPROVE',
          liveReturns: [{ symbol: 'US:AMZN', market: 'US', instrumentType: 'stock', liveReturnPct: ret, timestamp: new Date().toISOString() }],
          baseline: { expectedReturnPct: 20, expectedSharpe: 1.5, expectedDrawdown: 10, expectedWinRate: 65, backtestRunId: 'BT-IMP' },
        });

      await track(5);   // 15% → high deviation
      await track(18);  // 2% → low deviation

      const res = await request(app).get('/api/deviation/summary/STG-IMPROVE');
      expect(res.body.data.trend.direction).toBe('improving');
    });
  });

  // ── Invariants ───────────────────────────────────────────────────────

  describe('invariants', () => {
    it('snapshot IDs are unique', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const res = await request(app).post('/api/deviation/track').send({
          strategyId: 'STG-UNIQ',
          liveReturns: [{ symbol: 'HK:00388', market: 'HK', instrumentType: 'stock', liveReturnPct: 10 + i, timestamp: new Date().toISOString() }],
          baseline: { expectedReturnPct: 15, expectedSharpe: 1.2, expectedDrawdown: 8, expectedWinRate: 58, backtestRunId: `BT-UNIQ-${i}` },
        });
        ids.push(res.body.data.snapshotId);
      }
      expect(new Set(ids).size).toBe(3);
    });

    it('deviation percent is always non-negative', async () => {
      const res = await request(app).post('/api/deviation/track').send({
        strategyId: 'STG-NONNEG',
        liveReturns: [{ symbol: 'HK:00700', market: 'HK', instrumentType: 'stock', liveReturnPct: 5, timestamp: new Date().toISOString() }],
        baseline: { expectedReturnPct: 10, expectedSharpe: 1.0, expectedDrawdown: 10, expectedWinRate: 60, backtestRunId: 'BT-NN' },
      });

      expect(res.body.data.overallDeviationPct).toBeGreaterThanOrEqual(0);
    });

    it('deviations array always has 4 metrics', async () => {
      const res = await request(app).post('/api/deviation/track').send({
        strategyId: 'STG-4METRICS',
        liveReturns: [{ symbol: 'US:GOOGL', market: 'US', instrumentType: 'stock', liveReturnPct: 8, timestamp: new Date().toISOString() }],
        baseline: { expectedReturnPct: 10, expectedSharpe: 1.0, expectedDrawdown: 10, expectedWinRate: 55, backtestRunId: 'BT-4M' },
      });

      expect(res.body.data.deviations).toHaveLength(4);
      const metrics = res.body.data.deviations.map((d: any) => d.metric).sort();
      expect(metrics).toEqual(['drawdown', 'return', 'sharpe', 'winRate']);
    });
  });
});
