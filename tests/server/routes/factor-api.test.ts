/**
 * Tests for Factor API Routes (R163 P1-X3)
 * JVS: Spot-check + Compare + Batch scoring + Health
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';

// We test the route logic directly by importing the router
import factorApiRoutes from '../../../../server/routes/factor-api';

// Mock the factor framework before importing route
vi.mock('../../../../electron/engine/factors/dawn-factor-framework', () => {
  const mockScore = vi.fn();
  
  return {
    getDawnFactorFramework: vi.fn(() => ({
      score: mockScore,
    })),
    DawnFactorFramework: class MockFramework {},
    initDawnFactorFramework: vi.fn(),
  };
});

// Re-import after mock
const { getDawnFactorFramework } = await import('../../../../electron/engine/factors/dawn-factor-framework');

// ============================================================================
// Helpers
// ============================================================================

function makeMockScore(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    symbol: 'HK:00700',
    market: 'HK',
    instrumentType: 'stock',
    compositeScore: 72.5,
    rating: 'good',
    confidence: 0.85,
    factors: [
      { factorId: 'momentum_12m', factorName: '12月动量', score: 78, weight: 0.25, contribution: 7.0, category: 'momentum' },
      { factorId: 'value_pe', factorName: '市盈率', score: 65, weight: 0.20, contribution: 3.0, category: 'value' },
      { factorId: 'quality_roe', factorName: 'ROE质量', score: 70, weight: 0.15, contribution: 3.0, category: 'quality' },
      { factorId: 'vol_annual', factorName: '年化波动率', score: 55, weight: 0.15, contribution: 0.75, category: 'volatility' },
      { factorId: 'sentiment_news', factorName: '新闻情绪', score: 60, weight: 0.10, contribution: 1.0, category: 'sentiment' },
    ],
    momentumScore: 78,
    valueScore: 65,
    qualityScore: 70,
    volatilityScore: 55,
    sentimentScore: 60,
    riskScore: 35,
    maxDrawdownPct: 12.5,
    scoringMode: 'DATA_DRIVEN',
    reason: '12月动量强劲，估值合理。波动率偏高需关注。',
    debug: {
      positiveContributors: [
        { factorId: 'momentum_12m', factorName: '12月动量', score: 78, weight: 0.25, netContribution: 7.0, dragPercent: 0 },
        { factorId: 'quality_roe', factorName: 'ROE质量', score: 70, weight: 0.15, netContribution: 3.0, dragPercent: 0 },
      ],
      negativeContributors: [
        { factorId: 'vol_annual', factorName: '年化波动率', score: 55, weight: 0.15, netContribution: -2.25, dragPercent: -10.5, suggestion: '建议降低该因子权重' },
      ],
    },
    ...overrides,
  };
}

function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/factor', factorApiRoutes);
  return app;
}

// ============================================================================
// Tests
// ============================================================================

describe('Factor API Routes (R163)', () => {

  let mockScoreFn: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    const fw = getDawnFactorFramework() as any;
    mockScoreFn = fw.score;
  });

  // ── GET /api/factor/spot-check ──────────────────────────────────────

  describe('GET /api/factor/spot-check', () => {
    it('returns full factor scoring for a valid symbol', async () => {
      mockScoreFn.mockResolvedValueOnce(makeMockScore());

      const app = createApp();
      const res = await request(app).get('/api/factor/spot-check?symbol=HK:00700');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.compositeScore).toBe(72.5);
      expect(res.body.data.rating).toBe('good');
      expect(res.body.data.momentumScore).toBe(78);
      expect(res.body.data.valueScore).toBe(65);
      expect(res.body.data.qualityScore).toBe(70);
      expect(res.body.data.volatilityScore).toBe(55);
      expect(res.body.data.sentimentScore).toBe(60);
    });

    it('includes drag factors in response', async () => {
      mockScoreFn.mockResolvedValueOnce(makeMockScore());

      const app = createApp();
      const res = await request(app).get('/api/factor/spot-check?symbol=HK:00700');

      expect(res.body.data.dragFactors).toHaveLength(1);
      expect(res.body.data.dragFactors[0].factorName).toBe('年化波动率');
      expect(res.body.data.dragFactors[0].netContribution).toBe(-2.25);
      expect(res.body.data.dragFactors[0].suggestion).toBeTruthy();
    });

    it('includes positive factors', async () => {
      mockScoreFn.mockResolvedValueOnce(makeMockScore());

      const app = createApp();
      const res = await request(app).get('/api/factor/spot-check?symbol=HK:00700');

      expect(res.body.data.positiveFactors.length).toBeGreaterThan(0);
      expect(res.body.data.positiveFactors[0].factorName).toBe('12月动量');
    });

    it('generates a human-readable summary', async () => {
      mockScoreFn.mockResolvedValueOnce(makeMockScore());

      const app = createApp();
      const res = await request(app).get('/api/factor/spot-check?symbol=HK:00700');

      expect(res.body.data.summary).toBeTruthy();
      expect(typeof res.body.data.summary).toBe('string');
      expect(res.body.data.summary.length).toBeGreaterThan(20);
    });

    it('returns 400 for missing symbol parameter', async () => {
      const app = createApp();
      const res = await request(app).get('/api/factor/spot-check');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('symbol');
    });

    it('returns 400 for invalid symbol format', async () => {
      const app = createApp();
      const res = await request(app).get('/api/factor/spot-check?symbol=INVALID');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('respects CRYPTO market symbols', async () => {
      mockScoreFn.mockResolvedValueOnce(makeMockScore({ symbol: 'BTC-USDT', market: 'CRYPTO', instrumentType: 'crypto' }));

      const app = createApp();
      const res = await request(app).get('/api/factor/spot-check?symbol=CRYPTO:BTC-USDT');

      expect(res.status).toBe(200);
      expect(res.body.data.symbol).toBe('BTC-USDT');
    });
  });

  // ── GET /api/factor/compare ─────────────────────────────────────────

  describe('GET /api/factor/compare', () => {
    it('compares two symbols and picks a winner', async () => {
      mockScoreFn
        .mockResolvedValueOnce(makeMockScore({ symbol: 'AAPL', compositeScore: 75, momentumScore: 80 }))
        .mockResolvedValueOnce(makeMockScore({ symbol: 'MSFT', compositeScore: 68, momentumScore: 65, valueScore: 55 }));

      const app = createApp();
      const res = await request(app).get('/api/factor/compare?a=US:AAPL&b=US:MSFT');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.a).toBeDefined();
      expect(res.body.data.b).toBeDefined();
      expect(res.body.data.comparison).toBeDefined();
      expect(res.body.data.comparison.winner).toBe('a');
      expect(res.body.data.comparison.scoreDiff).toBeGreaterThan(0);
    });

    it('detects tie when scores are close', async () => {
      mockScoreFn
        .mockResolvedValueOnce(makeMockScore({ symbol: 'AAPL', compositeScore: 72.2 }))
        .mockResolvedValueOnce(makeMockScore({ symbol: 'GOOGL', compositeScore: 72.0 }));

      const app = createApp();
      const res = await request(app).get('/api/factor/compare?a=US:AAPL&b=US:GOOGL');

      expect(res.body.data.comparison.winner).toBe('tie');
      expect(Math.abs(res.body.data.comparison.scoreDiff)).toBeLessThan(0.5);
    });

    it('returns category diffs', async () => {
      mockScoreFn
        .mockResolvedValueOnce(makeMockScore({ momentumScore: 80, valueScore: 70 }))
        .mockResolvedValueOnce(makeMockScore({ momentumScore: 60, valueScore: 50 }));

      const app = createApp();
      const res = await request(app).get('/api/factor/compare?a=US:AAPL&b=US:MSFT');

      const diffs = res.body.data.comparison.categoryDiffs;
      expect(diffs.length).toBe(5);
      expect(diffs[0].category).toBe('动量');
      expect(diffs[0].diff).toBeGreaterThan(0);
    });

    it('identifies advantages', async () => {
      mockScoreFn
        .mockResolvedValueOnce(makeMockScore({ momentumScore: 80, valueScore: 60, qualityScore: 60 }))
        .mockResolvedValueOnce(makeMockScore({ momentumScore: 60, valueScore: 50, qualityScore: 70 }));

      const app = createApp();
      const res = await request(app).get('/api/factor/compare?a=US:AAPL&b=US:MSFT');

      const comp = res.body.data.comparison;
      expect(comp.aAdvantages.length).toBeGreaterThan(0);
      expect(comp.summary).toBeTruthy();
    });

    it('returns 400 when missing parameters', async () => {
      const app = createApp();
      const res = await request(app).get('/api/factor/compare?a=US:AAPL');
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/factor/scores ──────────────────────────────────────────

  describe('GET /api/factor/scores', () => {
    it('scores multiple symbols in parallel', async () => {
      mockScoreFn
        .mockResolvedValueOnce(makeMockScore({ symbol: 'AAPL', compositeScore: 75 }))
        .mockResolvedValueOnce(makeMockScore({ symbol: 'GOOGL', compositeScore: 68 }))
        .mockResolvedValueOnce(makeMockScore({ symbol: 'MSFT', compositeScore: 72 }));

      const app = createApp();
      const res = await request(app).get('/api/factor/scores?symbols=US:AAPL,US:GOOGL,US:MSFT');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toHaveLength(3);
      // Should be sorted by compositeScore desc
      expect(res.body.results[0].compositeScore).toBe(75);
      expect(res.body.results[1].compositeScore).toBe(72);
      expect(res.body.results[2].compositeScore).toBe(68);
    });

    it('returns 400 for empty symbols', async () => {
      const app = createApp();
      const res = await request(app).get('/api/factor/scores');
      expect(res.status).toBe(400);
    });

    it('returns 400 for too many symbols', async () => {
      const app = createApp();
      const symbols = Array.from({ length: 21 }, (_, i) => `US:SYM${i}`).join(',');
      const res = await request(app).get(`/api/factor/scores?symbols=${symbols}`);
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/factor/health ──────────────────────────────────────────

  describe('GET /api/factor/health', () => {
    it('reports framework ready', async () => {
      const app = createApp();
      const res = await request(app).get('/api/factor/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ready).toBe(true);
    });
  });

  // ── Invariants ──────────────────────────────────────────────────────

  describe('invariants', () => {
    it('response always has success field', async () => {
      const app = createApp();
      const res = await request(app).get('/api/factor/health');
      expect(res.body).toHaveProperty('success');
    });

    it('error responses include error message', async () => {
      const app = createApp();
      const res = await request(app).get('/api/factor/spot-check');
      expect(res.body).toHaveProperty('error');
    });

    it('compositeScore is between 0 and 100', async () => {
      mockScoreFn.mockResolvedValueOnce(makeMockScore({ compositeScore: 45 }));

      const app = createApp();
      const res = await request(app).get('/api/factor/spot-check?symbol=HK:00700');

      const score = res.body.data.compositeScore;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
