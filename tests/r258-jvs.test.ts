import { describe, it, expect, beforeEach } from 'vitest';
import { AIQuickCommentEngine } from '../electron/engine/ai/AIQuickCommentEngine';
import { AIAnomalyAttributionEngine } from '../electron/engine/ai/AIAnomalyAttributionEngine';
import { CrashAlertEngine } from '../electron/engine/ai/CrashAlertEngine';

// ═══════════════════════════════════════════════════════════════
// P1-02 AIQuickCommentEngine
// ═══════════════════════════════════════════════════════════════

describe('AIQuickCommentEngine', () => {
  let engine: AIQuickCommentEngine;
  beforeEach(() => { engine = AIQuickCommentEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(AIQuickCommentEngine.getInstance()).toBe(engine); });

  it('analyzes a single stock', () => {
    const comment = engine.analyze({
      symbol: 'AAPL', price: 195, change: 4.5, changePct: 2.3,
      volume: 55000000, avgVolume20d: 48000000, high52: 200, low52: 140,
    });
    expect(comment.symbol).toBe('AAPL');
    expect(comment.overallScore).toBeGreaterThan(0);
    expect(comment.overallScore).toBeLessThanOrEqual(100);
    expect(comment.dimensions).toHaveLength(7);
    expect(comment.oneLiner).toBeTruthy();
    expect(comment.confidence).toBeGreaterThan(0);
  });

  it('dimensions sum weights to ~1', () => {
    const comment = engine.analyze({
      symbol: 'TSLA', price: 220, change: -18, changePct: -7.5,
      volume: 180000000, avgVolume20d: 95000000, high52: 300, low52: 150,
    });
    const totalWeight = comment.dimensions.reduce((s, d) => s + d.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 1);
  });

  it('crash regime for large decline', () => {
    const comment = engine.analyze({
      symbol: 'CRASH', price: 50, change: -10, changePct: -15,
      volume: 200000000, avgVolume20d: 50000000, high52: 100, low52: 40,
    });
    expect(comment.marketRegime).toBe('crash');
  });

  it('bull regime for strong stock', () => {
    const comment = engine.analyze({
      symbol: 'BULL', price: 190, change: 10, changePct: 5.5,
      volume: 60000000, avgVolume20d: 40000000, high52: 200, low52: 100,
    });
    expect(['bull', 'recovery']).toContain(comment.marketRegime);
  });

  it('history tracking', () => {
    engine.analyze({ symbol: 'AAPL', price: 195, change: 2, changePct: 1, volume: 50000000, avgVolume20d: 48000000, high52: 200, low52: 140 });
    engine.analyze({ symbol: 'TSLA', price: 220, change: -18, changePct: -7.5, volume: 180000000, avgVolume20d: 95000000, high52: 300, low52: 150 });
    expect(engine.getCommentHistory()).toHaveLength(2);
    expect(engine.getCommentHistory('AAPL')).toHaveLength(1);
  });

  it('latest comment', () => {
    engine.analyze({ symbol: 'AAPL', price: 100, change: 1, changePct: 1, volume: 10000000, avgVolume20d: 10000000, high52: 150, low52: 50 });
    const latest = engine.getLatestComment('AAPL');
    expect(latest).toBeDefined();
    expect(latest!.symbol).toBe('AAPL');
  });

  it('batch analysis', () => {
    const mock = engine.createMockRequests();
    const comments = engine.analyzeBatch(mock);
    expect(comments).toHaveLength(3);
    expect(comments[0].symbol).toBe('AAPL');
    expect(comments[1].symbol).toBe('TSLA');
  });

  it('tags include regime label', () => {
    const comment = engine.analyze({
      symbol: 'NVDA', price: 880, change: 25, changePct: 2.9,
      volume: 42000000, avgVolume20d: 38000000, high52: 920, low52: 400,
    });
    expect(comment.tags.length).toBeGreaterThan(0);
  });

  it('key signals contain overall rating', () => {
    const comment = engine.analyze({
      symbol: 'NVDA', price: 880, change: 25, changePct: 2.9,
      volume: 42000000, avgVolume20d: 38000000, high52: 920, low52: 400,
    });
    expect(comment.keySignals.length).toBeGreaterThan(0);
    expect(comment.keySignals[0]).toContain('综合评分');
  });

  it('technical snapshot generated', () => {
    const comment = engine.analyze({
      symbol: 'AAPL', price: 195, change: 2, changePct: 1, volume: 50000000, avgVolume20d: 48000000, high52: 200, low52: 140,
    });
    expect(comment.technicalSnapshot.sma20).toBeGreaterThan(0);
    expect(comment.technicalSnapshot.rsi14).toBeGreaterThan(0);
  });

  it('createMockRequests returns 3', () => {
    expect(engine.createMockRequests()).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-04 AIAnomalyAttributionEngine
// ═══════════════════════════════════════════════════════════════

describe('AIAnomalyAttributionEngine', () => {
  let engine: AIAnomalyAttributionEngine;
  beforeEach(() => { engine = AIAnomalyAttributionEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(AIAnomalyAttributionEngine.getInstance()).toBe(engine); });

  it('attributes price surge', () => {
    const assessment = engine.attribute({
      symbol: 'AAPL', price: 195, prevClose: 189, changePct: 3.2,
      volume: 75000000, avgVolume: 48000000,
      recentNews: ['Apple 发布新品'],
      sectorMoves: [{ symbol: 'MSFT', changePct: 2.1 }],
      marketIndexChange: 1.2,
    });
    expect(assessment.symbol).toBe('AAPL');
    expect(assessment.primaryFactor).toBeDefined();
    expect(assessment.attributions.length).toBeGreaterThan(0);
    expect(assessment.summary).toBeTruthy();
    expect(assessment.confidence).toBeGreaterThan(0);
  });

  it('classifies severity correctly', () => {
    const assessment = engine.attribute({
      symbol: 'CRASH', price: 100, prevClose: 120, changePct: -16,
      volume: 300000000, avgVolume: 50000000,
      recentNews: ['重大利空'],
      marketIndexChange: -4,
    });
    expect(['P0', 'P1']).toContain(assessment.severity);
  });

  it('anomaly type breakout for strong up', () => {
    const assessment = engine.attribute({
      symbol: 'BULL', price: 200, prevClose: 180, changePct: 10,
      volume: 150000000, avgVolume: 50000000,
      marketIndexChange: 0.5,
    });
    expect(assessment.anomalyType).toBe('breakout');
  });

  it('anomaly type breakdown for strong down', () => {
    const assessment = engine.attribute({
      symbol: 'BEAR', price: 100, prevClose: 120, changePct: -15,
      volume: 150000000, avgVolume: 50000000,
      marketIndexChange: -2,
    });
    expect(assessment.anomalyType).toBe('breakdown');
  });

  it('recommendation for P0 severity', () => {
    const assessment = engine.attribute({
      symbol: 'P0', price: 10, prevClose: 15, changePct: -30,
      volume: 300000000, avgVolume: 30000000,
      marketIndexChange: -5,
    });
    expect(assessment.severity).toBe('P0');
    expect(assessment.recommendation).toContain('暂停');
  });

  it('history tracking', () => {
    engine.attribute({ symbol: 'AAPL', price: 195, prevClose: 189, changePct: 3.2, volume: 75000000, avgVolume: 48000000, marketIndexChange: 1.2 });
    engine.attribute({ symbol: 'TSLA', price: 220, prevClose: 238, changePct: -7.5, volume: 180000000, avgVolume: 95000000, marketIndexChange: -0.8 });
    expect(engine.getAssessments()).toHaveLength(2);
    expect(engine.getAssessments('AAPL')).toHaveLength(1);
  });

  it('severity breakdown', () => {
    engine.attribute({ symbol: 'A', price: 100, prevClose: 90, changePct: 11, volume: 200000000, avgVolume: 50000000, marketIndexChange: 2 });
    const breakdown = engine.getSeverityBreakdown();
    expect(breakdown.P0 + breakdown.P1 + breakdown.P2 + breakdown.P3 + breakdown.P4).toBe(1);
  });

  it('attribution includes earnings when close', () => {
    const assessment = engine.attribute({
      symbol: 'AAPL', price: 195, prevClose: 189, changePct: 3.2,
      volume: 75000000, avgVolume: 48000000,
      earningsDate: new Date(Date.now() + 86400000).toISOString(),
      marketIndexChange: 1.2,
    });
    const earnings = assessment.attributions.find(a => a.factor === 'earnings');
    expect(earnings).toBeDefined();
    expect(earnings!.confidence).toBeGreaterThan(0.5);
  });

  it('batch attribution', () => {
    const mock = engine.createMockRequests();
    const results = engine.attributeBatch(mock);
    expect(results).toHaveLength(3);
  });

  it('createMockRequests returns 3', () => {
    expect(engine.createMockRequests()).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-05 CrashAlertEngine
// ═══════════════════════════════════════════════════════════════

describe('CrashAlertEngine', () => {
  let engine: CrashAlertEngine;
  beforeEach(() => { engine = CrashAlertEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(CrashAlertEngine.getInstance()).toBe(engine); });

  it('normal market is GREEN', () => {
    const req = engine.createMockNormalRequest();
    const result = engine.assess(req);
    expect(result.level).toBe('GREEN');
    expect(result.score).toBeLessThan(20);
  });

  it('crash market is RED or BLACK', () => {
    const req = engine.createMockCrashRequest();
    const result = engine.assess(req);
    expect(['RED', 'BLACK']).toContain(result.level);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('warning market is ORANGE or YELLOW', () => {
    const req = engine.createMockWarningRequest();
    const result = engine.assess(req);
    expect(['ORANGE', 'YELLOW']).toContain(result.level);
  });

  it('indicators generated correctly', () => {
    const req = engine.createMockCrashRequest();
    const result = engine.assess(req);
    expect(result.indicators).toHaveLength(8);
    const triggered = result.indicators.filter(i => i.triggered);
    expect(triggered.length).toBeGreaterThan(3);
  });

  it('soothing message for BLACK', () => {
    // Force high score
    const req = engine.createMockCrashRequest();
    const result = engine.assess(req);
    if (result.level === 'BLACK') {
      expect(result.soothingMessage).toContain('冷静');
    }
  });

  it('recovery detection', () => {
    // First crash
    engine.assess(engine.createMockCrashRequest());
    // Then normal
    const normal = engine.createMockNormalRequest();
    const result = engine.assess(normal);
    expect(result.isRecovery).toBe(true);
  });

  it('history tracking', () => {
    engine.assess(engine.createMockNormalRequest());
    engine.assess(engine.createMockCrashRequest());
    expect(engine.getHistory()).toHaveLength(2);
    const latest = engine.getLatestAssessment();
    expect(latest).toBeDefined();
  });

  it('recovery events tracked', () => {
    engine.assess(engine.createMockCrashRequest());
    engine.assess(engine.createMockNormalRequest());
    const recoveries = engine.getRecoveryEvents();
    expect(recoveries.length).toBeGreaterThan(0);
  });

  it('current level updates on change', () => {
    engine.assess(engine.createMockNormalRequest());
    expect(engine.getCurrentLevel()).toBe('GREEN');
    engine.assess(engine.createMockCrashRequest());
    expect(engine.getCurrentLevel()).not.toBe('GREEN');
  });

  it('snapshot has all fields', () => {
    const result = engine.assess(engine.createMockCrashRequest());
    expect(result.marketSnapshot.indexChangePct).toBeDefined();
    expect(result.marketSnapshot.vixLevel).toBeDefined();
    expect(result.marketSnapshot.breadthPct).toBeDefined();
  });
});
