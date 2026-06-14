/**
 * Tests for Factor API Routes (R163 P1-X3)
 * JVS: Spot-check + Compare + Batch scoring + Health
 * 
 * Tests the route logic by calling handler functions directly (no supertest needed).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';

// ============================================================================
// Mock the factor framework BEFORE importing the route
// ============================================================================

const mockScore = vi.fn();

vi.mock('../../../electron/engine/factors/dawn-factor-framework', () => ({
  getDawnFactorFramework: vi.fn(() => ({
    score: mockScore,
  })),
  DawnFactorFramework: class MockFramework {},
  initDawnFactorFramework: vi.fn(),
}));

// The route module will use our mock
import factorApiRoutes from '../../../server/routes/factor-api';

// ============================================================================
// Helpers
// ============================================================================

function makeMockScoreResult(overrides: Record<string, any> = {}): any {
  return {
    symbol: '00700',
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
      ],
      negativeContributors: [
        { factorId: 'vol_annual', factorName: '年化波动率', score: 55, weight: 0.15, netContribution: -2.25, dragPercent: -10.5, suggestion: '建议降低该因子权重' },
      ],
    },
    ...overrides,
  };
}

/**
 * Call a route handler by simulating Express req/res.
 * Since supertest is not available, we test the public API surface directly.
 */
function buildReq(query: Record<string, string>): any {
  return { query };
}

let lastStatus = 0;
let lastBody: any = null;

function buildRes(): any {
  return {
    status(code: number) {
      lastStatus = code;
      return { json(body: any) { lastBody = body; } };
    },
    json(body: any) {
      lastStatus = 200;
      lastBody = body;
    },
  };
}

// ============================================================================
// Tests — Direct Logic Tests
// ============================================================================

describe('Factor API Route Logic (R163)', () => {

  beforeEach(() => {
    mockScore.mockReset();
    lastStatus = 0;
    lastBody = null;
  });

  // ── Symbol parsing (public logic testable without Express) ──────────

  describe('Symbol parsing', () => {
    // Test the parse logic that the route uses by verifying it through public endpoint behavior
    // For now, test via the router's exported express router
    it('router is an express Router', () => {
      expect(factorApiRoutes).toBeDefined();
      // Express Router() returns a function
      expect(typeof factorApiRoutes).toBe('function');
    });

    it('router has expected route methods', () => {
      // Express Router has .stack array of Layer objects
      expect(Array.isArray(factorApiRoutes.stack)).toBe(true);
      const paths = factorApiRoutes.stack
        .filter((s: any) => s.route)
        .map((s: any) => s.route.path);
      expect(paths).toContain('/spot-check');
      expect(paths).toContain('/compare');
      expect(paths).toContain('/scores');
      expect(paths).toContain('/health');
    });
  });

  // ── Health Endpoint ─────────────────────────────────────────────────

  describe('GET /health', () => {
    it('returns ready=true when framework is initialized', () => {
      const req = buildReq({});
      const res = buildRes();
      
      // Access health handler via router stack
      const healthLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/health' && s.route?.methods?.get
      );
      expect(healthLayer).toBeDefined();
      
      healthLayer.route.stack[0].handle(req, res);
      expect(lastBody.success).toBe(true);
      expect(lastBody.ready).toBe(true);
    });
  });

  // ── Spot-check: Missing parameter ────────────────────────────────────

  describe('GET /spot-check validation', () => {
    it('returns error for missing symbol', () => {
      const spotCheckLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/spot-check' && s.route?.methods?.get
      );
      const handler = spotCheckLayer.route.stack[0].handle;
      
      handler(buildReq({}), buildRes());
      expect(lastStatus).toBe(400);
      expect(lastBody.success).toBe(false);
      expect(lastBody.error).toContain('symbol');
    });

    it('returns error for invalid symbol format', () => {
      const spotCheckLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/spot-check' && s.route?.methods?.get
      );
      const handler = spotCheckLayer.route.stack[0].handle;
      
      handler(buildReq({ symbol: 'INVALID' }), buildRes());
      expect(lastStatus).toBe(400);
      expect(lastBody.success).toBe(false);
    });

    it('processes valid symbol and calls framework.score', async () => {
      mockScore.mockResolvedValueOnce(makeMockScoreResult());
      
      const spotCheckLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/spot-check' && s.route?.methods?.get
      );
      const handler = spotCheckLayer.route.stack[0].handle;
      
      await handler(buildReq({ symbol: 'HK:00700' }), buildRes());
      
      expect(mockScore).toHaveBeenCalledWith('00700', 'HK', 'stock');
      expect(lastBody.success).toBe(true);
      expect(lastBody.data).toBeDefined();
      expect(lastBody.data.compositeScore).toBe(72.5);
    });

    it('spot-check includes drag factors', async () => {
      mockScore.mockResolvedValueOnce(makeMockScoreResult());
      
      const spotCheckLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/spot-check' && s.route?.methods?.get
      );
      const handler = spotCheckLayer.route.stack[0].handle;
      
      await handler(buildReq({ symbol: 'HK:00700' }), buildRes());
      
      expect(lastBody.data.dragFactors).toHaveLength(1);
      expect(lastBody.data.dragFactors[0].factorName).toBe('年化波动率');
      expect(lastBody.data.dragFactors[0].netContribution).toBe(-2.25);
    });

    it('spot-check includes positive factors', async () => {
      mockScore.mockResolvedValueOnce(makeMockScoreResult());
      
      const spotCheckLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/spot-check' && s.route?.methods?.get
      );
      const handler = spotCheckLayer.route.stack[0].handle;
      
      await handler(buildReq({ symbol: 'HK:00700' }), buildRes());
      
      expect(lastBody.data.positiveFactors).toHaveLength(1);
      expect(lastBody.data.positiveFactors[0].factorName).toBe('12月动量');
    });

    it('generates summary in response', async () => {
      mockScore.mockResolvedValueOnce(makeMockScoreResult());
      
      const spotCheckLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/spot-check' && s.route?.methods?.get
      );
      const handler = spotCheckLayer.route.stack[0].handle;
      
      await handler(buildReq({ symbol: 'HK:00700' }), buildRes());
      
      expect(lastBody.data.summary).toBeTruthy();
      expect(typeof lastBody.data.summary).toBe('string');
      expect(lastBody.data.summary.length).toBeGreaterThan(20);
    });

    it('handles CRYPTO market symbols', async () => {
      mockScore.mockResolvedValueOnce(makeMockScoreResult({ symbol: 'BTC-USDT', market: 'CRYPTO', instrumentType: 'crypto' }));
      
      const spotCheckLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/spot-check' && s.route?.methods?.get
      );
      const handler = spotCheckLayer.route.stack[0].handle;
      
      await handler(buildReq({ symbol: 'CRYPTO:BTC-USDT' }), buildRes());
      
      expect(lastBody.data.symbol).toBe('BTC-USDT');
    });
  });

  // ── Compare ──────────────────────────────────────────────────────────

  describe('GET /compare', () => {
    it('returns error for missing parameters', () => {
      const compareLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/compare' && s.route?.methods?.get
      );
      const handler = compareLayer.route.stack[0].handle;
      
      handler(buildReq({}), buildRes());
      expect(lastStatus).toBe(400);
      expect(lastBody.success).toBe(false);
    });

    it('compares two symbols and picks a winner', async () => {
      mockScore
        .mockResolvedValueOnce(makeMockScoreResult({ symbol: 'AAPL', compositeScore: 75, momentumScore: 80 }))
        .mockResolvedValueOnce(makeMockScoreResult({ symbol: 'MSFT', compositeScore: 68, momentumScore: 65 }));

      const compareLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/compare' && s.route?.methods?.get
      );
      const handler = compareLayer.route.stack[0].handle;
      
      await handler(buildReq({ a: 'US:AAPL', b: 'US:MSFT' }), buildRes());
      
      expect(lastBody.success).toBe(true);
      expect(lastBody.data.a).toBeDefined();
      expect(lastBody.data.b).toBeDefined();
      expect(lastBody.data.comparison.winner).toBe('a');
      expect(lastBody.data.comparison.scoreDiff).toBeGreaterThan(0);
    });

    it('detects tie when scores are close', async () => {
      mockScore
        .mockResolvedValueOnce(makeMockScoreResult({ symbol: 'AAPL', compositeScore: 72.2 }))
        .mockResolvedValueOnce(makeMockScoreResult({ symbol: 'GOOGL', compositeScore: 72.0 }));

      const compareLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/compare' && s.route?.methods?.get
      );
      const handler = compareLayer.route.stack[0].handle;
      
      await handler(buildReq({ a: 'US:AAPL', b: 'US:GOOGL' }), buildRes());
      
      expect(lastBody.data.comparison.winner).toBe('tie');
      expect(Math.abs(lastBody.data.comparison.scoreDiff)).toBeLessThan(0.5);
    });

    it('generates category diffs and summary', async () => {
      mockScore
        .mockResolvedValueOnce(makeMockScoreResult({ momentumScore: 80, valueScore: 70 }))
        .mockResolvedValueOnce(makeMockScoreResult({ momentumScore: 60, valueScore: 50 }));

      const compareLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/compare' && s.route?.methods?.get
      );
      const handler = compareLayer.route.stack[0].handle;
      
      await handler(buildReq({ a: 'US:AAPL', b: 'US:MSFT' }), buildRes());
      
      const diffs = lastBody.data.comparison.categoryDiffs;
      expect(diffs).toHaveLength(5);
      expect(diffs[0].category).toBe('动量');
      expect(diffs[0].diff).toBeGreaterThan(0);
      expect(lastBody.data.comparison.summary).toBeTruthy();
    });
  });

  // ── Batch Scores ─────────────────────────────────────────────────────

  describe('GET /scores', () => {
    it('returns error for missing symbols', () => {
      const scoresLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/scores' && s.route?.methods?.get
      );
      const handler = scoresLayer.route.stack[0].handle;
      
      handler(buildReq({}), buildRes());
      expect(lastStatus).toBe(400);
    });

    it('scores multiple symbols in parallel', async () => {
      mockScore
        .mockResolvedValueOnce(makeMockScoreResult({ symbol: 'AAPL', compositeScore: 75 }))
        .mockResolvedValueOnce(makeMockScoreResult({ symbol: 'GOOGL', compositeScore: 68 }))
        .mockResolvedValueOnce(makeMockScoreResult({ symbol: 'MSFT', compositeScore: 72 }));

      const scoresLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/scores' && s.route?.methods?.get
      );
      const handler = scoresLayer.route.stack[0].handle;
      
      await handler(buildReq({ symbols: 'US:AAPL,US:GOOGL,US:MSFT' }), buildRes());
      
      expect(lastBody.success).toBe(true);
      expect(lastBody.results).toHaveLength(3);
      // Should be sorted by compositeScore desc
      expect(lastBody.results[0].compositeScore).toBe(75);
      expect(lastBody.results[1].compositeScore).toBe(72);
      expect(lastBody.results[2].compositeScore).toBe(68);
    });

    it('returns error for too many symbols', () => {
      const scoresLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/scores' && s.route?.methods?.get
      );
      const handler = scoresLayer.route.stack[0].handle;
      
      const over20 = Array.from({ length: 21 }, (_, i) => `US:S${i}`).join(',');
      handler(buildReq({ symbols: over20 }), buildRes());
      expect(lastStatus).toBe(400);
    });
  });

  // ── Invariants ──────────────────────────────────────────────────────

  describe('invariants', () => {
    it('compositeScore is between 0 and 100', async () => {
      mockScore.mockResolvedValueOnce(makeMockScoreResult({ compositeScore: 45 }));
      
      const spotCheckLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/spot-check' && s.route?.methods?.get
      );
      const handler = spotCheckLayer.route.stack[0].handle;
      
      await handler(buildReq({ symbol: 'HK:00700' }), buildRes());
      
      const score = lastBody.data.compositeScore;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('all category scores are between 0 and 100', async () => {
      mockScore.mockResolvedValueOnce(makeMockScoreResult());
      
      const spotCheckLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/spot-check' && s.route?.methods?.get
      );
      const handler = spotCheckLayer.route.stack[0].handle;
      
      await handler(buildReq({ symbol: 'HK:00700' }), buildRes());
      
      const cats = ['momentumScore', 'valueScore', 'qualityScore', 'volatilityScore', 'sentimentScore'];
      for (const cat of cats) {
        expect(lastBody.data[cat]).toBeGreaterThanOrEqual(0);
        expect(lastBody.data[cat]).toBeLessThanOrEqual(100);
      }
    });

    it('response always has success field', () => {
      // Health endpoint
      const healthLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/health' && s.route?.methods?.get
      );
      healthLayer.route.stack[0].handle(buildReq({}), buildRes());
      expect(lastBody).toHaveProperty('success');
    });

    it('score endpoint marks response as success=true on valid input', async () => {
      mockScore.mockResolvedValueOnce(makeMockScoreResult());
      
      const spotCheckLayer = factorApiRoutes.stack.find(
        (s: any) => s.route?.path === '/spot-check' && s.route?.methods?.get
      );
      await spotCheckLayer.route.stack[0].handle(buildReq({ symbol: 'HK:00700' }), buildRes());
      expect(lastBody.success).toBe(true);
    });
  });
});
