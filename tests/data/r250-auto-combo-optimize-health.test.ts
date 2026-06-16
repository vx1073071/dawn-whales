/**
 * R250 autoclaw TEST: P2-06 + P2-18 + P2-11
 * Covers: StrategyComboBridge, PortfolioOptimizationBridge, SourceHealthBar
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StrategyComboBridge, strategyComboBridge, resetStrategyComboBridge,
} from '../../electron/engine/data/strategy-combo-bridge';
import {
  PortfolioOptimizationBridge, portfolioOptimizationBridge, resetPortfolioOptimizationBridge,
} from '../../electron/engine/data/portfolio-optimization-bridge';
import type { OptimizationInput } from '../../electron/engine/data/portfolio-optimization-bridge';
import {
  SourceHealthBar, sourceHealthBar, resetSourceHealthBar,
} from '../../electron/engine/data/source-health-bar';

// ═══════════════════════════════════════════════════════════════════════════
// P2-06: StrategyComboBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R250 P2-06: StrategyComboBridge', () => {
  let bridge: StrategyComboBridge;

  beforeEach(() => {
    resetStrategyComboBridge();
    bridge = strategyComboBridge();
  });

  it('creates combo with strategies', () => {
    const combo = bridge.createCombo('Growth+Value', '成长+价值', [
      { strategyId: 'ai-momentum', name: 'AI Momentum', nameCn: 'AI动量', weight: 0.4 },
      { strategyId: 'deep-value', name: 'Deep Value', nameCn: '深度价值', weight: 0.6 },
    ]);

    expect(combo.slices.length).toBe(2);
    expect(combo.totalWeight).toBeCloseTo(1.0, 1);
    expect(combo.comboId).toBeTruthy();
  });

  it('autoEqualize distributes remaining weight', () => {
    const combo = bridge.createCombo('Auto', '自动', [
      { strategyId: 's1', name: 'S1', nameCn: 'S1', weight: 0.3 },
      { strategyId: 's2', name: 'S2', nameCn: 'S2' }, // no weight
      { strategyId: 's3', name: 'S3', nameCn: 'S3' }, // no weight
    ]);

    expect(combo.totalWeight).toBeCloseTo(1.0, 1);
    expect(combo.slices[1].weight).toBeCloseTo(0.35, 1);
    expect(combo.slices[2].weight).toBeCloseTo(0.35, 1);
  });

  it('analyze runs full portfolio analysis', () => {
    const combo = bridge.createCombo('Test', '测试', [
      { strategyId: 'ai-momentum', name: 'AI Momentum', nameCn: 'AI动量', weight: 0.5 },
      { strategyId: 'deep-value', name: 'Deep Value', nameCn: '深度价值', weight: 0.5 },
    ]);

    const analysis = bridge.analyze(combo.comboId, 'SPY', 100000);
    expect(analysis).not.toBeNull();
    expect(analysis!.metrics.sharpeRatio).toBeGreaterThan(0);
    expect(analysis!.metrics.diversificationBenefit).toBeGreaterThanOrEqual(0);
    expect(analysis!.contributions.length).toBe(2);
    expect(analysis!.equityCurve.length).toBeGreaterThan(100);
    expect(analysis!.drawdownCurve.length).toBeGreaterThan(100);
    expect(analysis!.rebalancePlan.needsRebalance).toBeDefined();
  });

  it('analyze returns null for unknown combo', () => {
    expect(bridge.analyze('bad', 'SPY')).toBeNull();
  });

  it('rebalance plan with threshold detection', () => {
    const combo = bridge.createCombo('Rebalance Test', '再平衡测试', [
      { strategyId: 's1', name: 'S1', nameCn: 'S1', weight: 0.5 },
      { strategyId: 's2', name: 'S2', nameCn: 'S2', weight: 0.5 },
    ]);
    const analysis = bridge.analyze(combo.comboId)!;

    expect(analysis.rebalancePlan.totalDrift).toBeGreaterThanOrEqual(0);
    expect(analysis.rebalancePlan.rebalanceMethod).toBeDefined();
    expect(analysis.rebalancePlan.recommendedActionCn.length).toBeGreaterThan(0);
    expect(analysis.rebalancePlan.nextRebalance).toBeTruthy();
  });

  it('contribution analysis returns per-strategy breakdown', () => {
    const combo = bridge.createCombo('Contribution', '贡献分析', [
      { strategyId: 's1', name: 'S1', nameCn: 'S1', weight: 0.6 },
      { strategyId: 's2', name: 'S2', nameCn: 'S2', weight: 0.4 },
    ]);
    const analysis = bridge.analyze(combo.comboId)!;

    analysis.contributions.forEach(c => {
      expect(c.returnContribution).toBeDefined();
      expect(c.riskContribution).toBeDefined();
      expect(c.returnOnRisk).toBeDefined();
      expect(c.standaloneSharpe).toBeGreaterThan(0);
    });
  });

  it('listCombos returns all created combos', () => {
    bridge.createCombo('A', 'A', [{ strategyId: 's1', name: 'S1', nameCn: 'S1' }]);
    bridge.createCombo('B', 'B', [{ strategyId: 's2', name: 'S2', nameCn: 'S2' }]);

    expect(bridge.listCombos().length).toBe(2);
  });

  it('getCombo returns specific combo', () => {
    const combo = bridge.createCombo('Test', '测试', [
      { strategyId: 's1', name: 'S1', nameCn: 'S1' },
    ]);
    expect(bridge.getCombo(combo.comboId)!.name).toBe('Test');
  });

  it('getAnalysis caches result', () => {
    const combo = bridge.createCombo('Cache', '缓存', [
      { strategyId: 's1', name: 'S1', nameCn: 'S1', weight: 1 },
    ]);
    bridge.analyze(combo.comboId);
    const cached = bridge.getAnalysis(combo.comboId);
    expect(cached).not.toBeNull();
    expect(cached!.portfolio.comboId).toBe(combo.comboId);
  });

  it('deleteCombo removes combo and analysis', () => {
    const combo = bridge.createCombo('Del', '删除', [
      { strategyId: 's1', name: 'S1', nameCn: 'S1' },
    ]);
    bridge.analyze(combo.comboId);

    expect(bridge.deleteCombo(combo.comboId)).toBe(true);
    expect(bridge.getCombo(combo.comboId)).toBeNull();
    expect(bridge.getAnalysis(combo.comboId)).toBeNull();
  });

  it('getStats tracks metrics', () => {
    const combo = bridge.createCombo('Stats', '统计', [
      { strategyId: 's1', name: 'S1', nameCn: 'S1', weight: 1 },
    ]);
    bridge.analyze(combo.comboId);

    const stats = bridge.getStats();
    expect(stats.totalCombos).toBe(1);
    expect(stats.avgSharpe).toBeGreaterThan(0);
    expect(stats.avgDiversificationBenefit).toBeGreaterThanOrEqual(0);
  });

  it('exportReport generates markdown', () => {
    const combo = bridge.createCombo('Export', '导出', [
      { strategyId: 's1', name: 'S1', nameCn: 'S1', weight: 1 },
    ]);
    const report = bridge.exportReport(combo.comboId);
    expect(report).not.toBeNull();
    expect(report!).toContain('Portfolio Analysis');
    expect(report!).toContain('CAGR');
    expect(report!).toContain('Sharpe');
  });

  it('exportReport returns null for unknown combo', () => {
    expect(bridge.exportReport('bad')).toBeNull();
  });

  it('reset clears all state', () => {
    const combo = bridge.createCombo('Reset', '重置', [
      { strategyId: 's1', name: 'S1', nameCn: 'S1' },
    ]);
    bridge.analyze(combo.comboId);
    bridge.reset();

    expect(bridge.listCombos().length).toBe(0);
    expect(bridge.getStats().totalCombos).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-18: PortfolioOptimizationBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R250 P2-18: PortfolioOptimizationBridge', () => {
  let bridge: PortfolioOptimizationBridge;

  const makeInput = (): OptimizationInput => ({
    strategies: [
      { id: 's1', name: 'Momentum', nameCn: '动量', expectedReturn: 0.15, volatility: 0.22, maxDrawdown: -0.25, sharpeRatio: 0.68 },
      { id: 's2', name: 'Value', nameCn: '价值', expectedReturn: 0.12, volatility: 0.18, maxDrawdown: -0.20, sharpeRatio: 0.67 },
      { id: 's3', name: 'Quality', nameCn: '质量', expectedReturn: 0.10, volatility: 0.14, maxDrawdown: -0.15, sharpeRatio: 0.71 },
      { id: 's4', name: 'Crypto', nameCn: '加密', expectedReturn: 0.25, volatility: 0.45, maxDrawdown: -0.55, sharpeRatio: 0.56 },
    ],
    correlationMatrix: [
      [1.0, 0.3, 0.4, 0.1],
      [0.3, 1.0, 0.5, 0.0],
      [0.4, 0.5, 1.0, 0.0],
      [0.1, 0.0, 0.0, 1.0],
    ],
    constraints: { minWeight: 0.05, maxWeight: 0.4, maxStrategies: 4 },
  });

  beforeEach(() => {
    resetPortfolioOptimizationBridge();
    bridge = portfolioOptimizationBridge();
  });

  it('mean_variance optimization returns weights', () => {
    const result = bridge.optimize(makeInput(), 'mean_variance');
    expect(result.method).toBe('mean_variance');
    expect(result.optimizedWeights.length).toBe(4);
    const sum = result.optimizedWeights.reduce((s, w) => s + w.weight, 0);
    expect(sum).toBeCloseTo(1.0, 1);
    expect(result.portfolioMetrics.expectedSharpe).toBeGreaterThan(0);
  });

  it('risk_parity assigns lower weights to high vol', () => {
    const result = bridge.optimize(makeInput(), 'risk_parity');
    // Crypto (vol 0.45) should get less weight
    const cryptoWeight = result.optimizedWeights.find(w => w.strategyId === 's4')!.weight;
    const qualityWeight = result.optimizedWeights.find(w => w.strategyId === 's3')!.weight;
    expect(cryptoWeight).toBeLessThan(qualityWeight);
  });

  it('min_correlation weights inversely to avg correlation', () => {
    const result = bridge.optimize(makeInput(), 'min_correlation');
    const sum = result.optimizedWeights.reduce((s, w) => s + w.weight, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('max_diversification uses sharpe/vol ratio', () => {
    const result = bridge.optimize(makeInput(), 'max_diversification');
    expect(result.optimizedWeights.every(w => w.weight >= 0)).toBe(true);
  });

  it('min_drawdown gives higher weight to lower drawdown', () => {
    const result = bridge.optimize(makeInput(), 'min_drawdown');
    // Quality (drawdown -0.15) should get more weight than Crypto (drawdown -0.55)
    const qualityWeight = result.optimizedWeights.find(w => w.strategyId === 's3')!.weight;
    const cryptoWeight = result.optimizedWeights.find(w => w.strategyId === 's4')!.weight;
    expect(qualityWeight).toBeGreaterThan(cryptoWeight);
  });

  it('equal_weight divides evenly', () => {
    const result = bridge.optimize(makeInput(), 'equal_weight');
    result.optimizedWeights.forEach(w => {
      expect(w.weight).toBeCloseTo(0.25, 1);
    });
  });

  it('compareAll returns winner and scores', () => {
    const result = bridge.compareAll(makeInput());
    expect(result.methods.length).toBe(6);
    expect(result.winner.length).toBeGreaterThan(0);
    expect(Object.keys(result.scoreBoard).length).toBe(6);
    expect(result.recommendationCn.length).toBeGreaterThan(0);
  });

  it('generateFrontier returns tangency and min_vol', () => {
    const frontier = bridge.generateFrontier(makeInput(), 20);
    expect(frontier.points.length).toBe(20);
    expect(frontier.tangencyPortfolio.sharpe).toBeGreaterThan(0);
    expect(frontier.minVolPortfolio.volatility).toBeGreaterThan(0);
    expect(frontier.maxReturnPortfolio.return).toBeGreaterThan(0);
  });

  it('frontier points have non-decreasing return at higher vol', () => {
    const frontier = bridge.generateFrontier(makeInput(), 20);
    let prevReturn = -Infinity;
    for (const point of frontier.points) {
      expect(point.return).toBeGreaterThanOrEqual(prevReturn);
      prevReturn = point.return;
    }
  });

  it('maxStrategies constraint limits active strategies', () => {
    const input = makeInput();
    input.constraints.maxStrategies = 2;

    const result = bridge.optimize(input, 'mean_variance');
    const nonZero = result.optimizedWeights.filter(w => w.weight > 0.01);
    expect(nonZero.length).toBeLessThanOrEqual(2);
  });

  it('portfolio metrics include herfindahl', () => {
    const result = bridge.optimize(makeInput(), 'equal_weight');
    expect(result.portfolioMetrics.herfindahlIndex).toBeGreaterThan(0);
    expect(result.portfolioMetrics.herfindahlIndex).toBeLessThan(1);
    expect(result.portfolioMetrics.diversificationRatio).toBeGreaterThanOrEqual(1);
  });

  it('efficiency score is between 0 and 100', () => {
    const result = bridge.optimize(makeInput(), 'mean_variance');
    expect(result.efficiency).toBeGreaterThanOrEqual(0);
    expect(result.efficiency).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-11: SourceHealthBar
// ═══════════════════════════════════════════════════════════════════════════

describe('R250 P2-11: SourceHealthBar', () => {
  let bar: SourceHealthBar;

  beforeEach(() => {
    resetSourceHealthBar();
    bar = sourceHealthBar();
  });

  it('seeds 25 sources', () => {
    const sources = bar.getAllSources();
    expect(sources.length).toBeGreaterThanOrEqual(25);
  });

  it('all sources have health scores 0-100', () => {
    const sources = bar.getAllSources();
    sources.forEach(s => {
      expect(s.health.overall).toBeGreaterThanOrEqual(0);
      expect(s.health.overall).toBeLessThanOrEqual(100);
    });
  });

  it('sources have valid health status', () => {
    const sources = bar.getAllSources();
    sources.forEach(s => {
      expect(['healthy', 'degraded', 'warning', 'critical', 'offline']).toContain(s.health.status);
    });
  });

  it('getSourceHealth returns specific source', () => {
    const reuters = bar.getSourceHealth('reuters');
    expect(reuters).not.toBeNull();
    expect(reuters!.name).toBe('Reuters');
    expect(reuters!.category).toBe('major_news');
  });

  it('getSourceHealth returns null for unknown', () => {
    expect(bar.getSourceHealth('unknown')).toBeNull();
  });

  it('checkSource returns health check result', () => {
    const result = bar.checkSource('reuters');
    expect(result.sourceId).toBe('reuters');
    expect(result.responseTimeMs).toBeGreaterThan(0);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('checkSource updates source health', () => {
    const before = bar.getSourceHealth('reuters')!;
    bar.checkSource('reuters');
    const after = bar.getSourceHealth('reuters')!;

    expect(after.health.overall).toBeDefined();
    expect(after.checkedAt).toBeGreaterThanOrEqual(before.checkedAt);
  });

  it('checkAll runs for all sources', () => {
    const results = bar.checkAll();
    expect(results.length).toBeGreaterThanOrEqual(25);
    results.forEach(r => expect(r.success).toBeDefined());
  });

  it('getDashboard returns full dashboard', () => {
    bar.checkAll(); // warm up
    const dash = bar.getDashboard();

    expect(dash.sources.length).toBeGreaterThanOrEqual(25);
    expect(dash.overallHealth).toBeGreaterThanOrEqual(0);
    expect(dash.healthByCategory).toHaveProperty('major_news');
    expect(dash.generatedAt).toBeGreaterThan(0);
  });

  it('getHealthBarData returns frontend-ready data', () => {
    const data = bar.getHealthBarData();
    expect(data.length).toBeGreaterThanOrEqual(25);
    data.forEach(d => {
      expect(d.color.startsWith('#')).toBe(true);
      expect(['healthy', 'degraded', 'warning', 'critical', 'offline']).toContain(d.status);
    });
  });

  it('simulateDegradation reduces health', () => {
    const before = bar.getSourceHealth('reuters')!.health.overall;
    bar.simulateDegradation('reuters', 'severe');
    const after = bar.getSourceHealth('reuters')!.health.overall;

    expect(after).toBeLessThan(before);
    expect(bar.getSourceHealth('reuters')!.health.degradation.level).toBe('severe');
  });

  it('simulateDegradation returns null for unknown', () => {
    expect(bar.simulateDegradation('unknown', 'severe')).toBeNull();
  });

  it('restoreSource resets health', () => {
    bar.simulateDegradation('reuters', 'severe');
    bar.restoreSource('reuters');

    const restored = bar.getSourceHealth('reuters')!;
    expect(restored.health.status).toBeDefined();
    expect(restored.health.overall).toBeGreaterThanOrEqual(0);
  });

  it('restoreSource returns null for unknown', () => {
    expect(bar.restoreSource('unknown')).toBeNull();
  });

  it('health history is tracked', () => {
    bar.checkAll();
    const dash = bar.getDashboard();
    expect(dash.healthTimeline.length).toBeGreaterThan(0);
  });

  it('categories include all source types', () => {
    const dash = bar.getDashboard();
    const cats = Object.keys(dash.healthByCategory);
    expect(cats).toContain('major_news');
    expect(cats).toContain('crypto');
    expect(cats).toContain('social');
    expect(cats).toContain('chinese');
    expect(cats).toContain('regional');
    expect(cats).toContain('free_api');
  });

  it('reset restores seed data', () => {
    bar.simulateDegradation('reuters', 'severe');
    bar.reset();
    const sources = bar.getAllSources();
    expect(sources.length).toBeGreaterThanOrEqual(25);
    expect(sources.every(s => s.health.overall > 0)).toBe(true);
  });

  it('health scores correspond to correct status', () => {
    const sources = bar.getAllSources();
    for (const s of sources) {
      const { overall, status } = s.health;
      if (overall >= 90) expect(status).toBe('healthy');
      else if (overall >= 70) expect(status).toBe('degraded');
      else if (overall >= 50) expect(status).toBe('warning');
      else if (overall > 0) expect(status).toBe('critical');
      else expect(status).toBe('offline');
    }
  });
});
