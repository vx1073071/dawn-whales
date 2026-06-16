/**
 * R251 autoclaw TEST: P2-26 + P2-27 + P2-28
 * Covers: FactorVisualizationCompletion, TemplatePKCompletion, AIVerifiableEvidence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorVisualizationCompletion, factorVisualizationCompletion, resetFactorVisualizationCompletion,
} from '../../electron/engine/data/factor-viz-completion';
import type { FactorAlert, FactorSnapshot } from '../../electron/engine/data/factor-viz-completion';
import {
  TemplatePKCompletion, templatePKCompletion, resetTemplatePKCompletion,
} from '../../electron/engine/data/template-pk-completion';
import {
  AIVerifiableEvidence, aiVerifiableEvidence, resetAIVerifiableEvidence,
} from '../../electron/engine/data/ai-verifiable-evidence';

// ═══════════════════════════════════════════════════════════════════════════
// P2-26: FactorVisualizationCompletion
// ═══════════════════════════════════════════════════════════════════════════

describe('R251 P2-26: FactorVisualizationCompletion', () => {
  let viz: FactorVisualizationCompletion;

  beforeEach(() => {
    resetFactorVisualizationCompletion();
    viz = factorVisualizationCompletion();
  });

  it('compareFactors returns multi-factor overlay data', () => {
    const result = viz.compareFactors(
      ['MOMENTUM_12M', 'VALUE_EARNINGS_YIELD', 'QUALITY_ROE'],
      'ic',
    );

    expect(result.series.length).toBe(3);
    expect(result.series[0].data.length).toBeGreaterThan(100);
    expect(result.summary.bestFactor.length).toBeGreaterThan(0);
    expect(result.summary.dispersion).toBeGreaterThanOrEqual(0);
  });

  it('compareFactors with cumulative_return', () => {
    const result = viz.compareFactors(
      ['MOMENTUM_12M', 'VALUE_EARNINGS_YIELD'],
      'cumulative_return',
      { benchmark: 'SPY' },
    );

    expect(result.seriesType).toBe('cumulative_return');
    expect(result.benchmark).toBe('SPY');
    expect(result.series[0].data[0].value).toBeGreaterThan(0);
  });

  it('buildDrillDownTree returns domain→group→factor', () => {
    const tree = viz.buildDrillDownTree();
    expect(tree.length).toBeGreaterThanOrEqual(5);
    expect(tree[0].type).toBe('domain');
    expect(tree[0].children!.length).toBeGreaterThan(0);

    const firstGroup = tree[0].children![0];
    expect(firstGroup.type).toBe('group');
    expect(firstGroup.children!.length).toBeGreaterThan(0);
    expect(firstGroup.children![0].type).toBe('factor');
  });

  it('buildDrillDownTree nodes have metrics', () => {
    const tree = viz.buildDrillDownTree();
    for (const domain of tree) {
      expect(domain.metrics!.count).toBeGreaterThan(0);
      expect(domain.metrics!.avgIC).toBeGreaterThan(0);
    }
  });

  it('generateInsight returns auto-narrative', () => {
    const insight = viz.generateInsight('MOMENTUM_12M');
    expect(insight).not.toBeNull();
    expect(insight!.trend.direction).toBeDefined();
    expect(insight!.trend.descriptionCn.length).toBeGreaterThan(0);
    expect(insight!.recommendation.action).toBeDefined();
    expect(insight!.recommendation.confidence).toBeGreaterThan(0);
    expect(insight!.recommendation.confidence).toBeLessThanOrEqual(1);
  });

  it('generateInsight returns null for unknown factor', () => {
    expect(viz.generateInsight('UNKNOWN')).toBeNull();
  });

  it('addToWatchlist adds factor', () => {
    const item = viz.addToWatchlist('user:1', 'MOMENTUM_12M');
    expect(item).not.toBeNull();
    expect(item!.factorId).toBe('MOMENTUM_12M');

    const list = viz.getWatchlist('user:1');
    expect(list.length).toBe(1);
  });

  it('addToWatchlist: no duplicate', () => {
    viz.addToWatchlist('user:1', 'MOMENTUM_12M');
    const again = viz.addToWatchlist('user:1', 'MOMENTUM_12M');
    expect(again).toBeNull();
    expect(viz.getWatchlist('user:1').length).toBe(1);
  });

  it('addToWatchlist returns null for unknown factor', () => {
    expect(viz.addToWatchlist('user:1', 'UNKNOWN')).toBeNull();
  });

  it('removeFromWatchlist removes', () => {
    viz.addToWatchlist('user:1', 'MOMENTUM_12M');
    const removed = viz.removeFromWatchlist('user:1', 'MOMENTUM_12M');
    expect(removed).toBe(true);
    expect(viz.getWatchlist('user:1').length).toBe(0);
  });

  it('setAlert adds alert to watchlist item', () => {
    viz.addToWatchlist('user:1', 'MOMENTUM_12M');
    const alert = viz.setAlert('user:1', 'MOMENTUM_12M', {
      metric: 'ic', condition: 'below', threshold: 0.03, enabled: true,
    });

    expect(alert).not.toBeNull();
    expect(alert!.condition).toBe('below');

    const list = viz.getWatchlist('user:1');
    expect(list[0].alerts.length).toBe(1);
  });

  it('setAlert returns null for unknown', () => {
    expect(viz.setAlert('user:1', 'NOPE', { metric: 'ic', condition: 'below', threshold: 0.03, enabled: true })).toBeNull();
    viz.addToWatchlist('user:1', 'MOMENTUM_12M');
    expect(viz.setAlert('user:99', 'MOMENTUM_12M', { metric: 'ic', condition: 'below', threshold: 0.03, enabled: true })).toBeNull();
  });

  it('checkAlerts triggers for below-threshold IC', () => {
    viz.addToWatchlist('user:1', 'MOMENTUM_12M');
    viz.setAlert('user:1', 'MOMENTUM_12M', {
      metric: 'ic', condition: 'below', threshold: 0.50, enabled: true,
    });

    const triggered = viz.checkAlerts();
    expect(triggered.length).toBeGreaterThanOrEqual(1);
  });

  it('checkAlerts: disabled alerts do not trigger', () => {
    viz.addToWatchlist('user:1', 'MOMENTUM_12M');
    viz.setAlert('user:1', 'MOMENTUM_12M', {
      metric: 'ic', condition: 'below', threshold: 0.50, enabled: false,
    });

    const triggered = viz.checkAlerts();
    expect(triggered.length).toBe(0);
  });

  it('getSnapshot returns ranked factor table', () => {
    const snap = viz.getSnapshot(['MOMENTUM_12M', 'VALUE_EARNINGS_YIELD', 'QUALITY_ROE']);
    expect(snap.rows.length).toBe(3);
    expect(snap.rows[0].rank).toBe(1);
    expect(snap.marketSummaryCn.length).toBeGreaterThan(0);
    expect(snap.timestamp).toBeGreaterThan(0);
  });

  it('snapshot is sorted by sharpe descending', () => {
    const snap = viz.getSnapshot();
    for (let i = 1; i < snap.rows.length; i++) {
      expect(snap.rows[i - 1].sharpe).toBeGreaterThanOrEqual(snap.rows[i].sharpe);
    }
  });

  it('reset clears watchlists', () => {
    viz.addToWatchlist('user:1', 'MOMENTUM_12M');
    viz.reset();
    expect(viz.getWatchlist('user:1').length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-27: TemplatePKCompletion
// ═══════════════════════════════════════════════════════════════════════════

describe('R251 P2-27: TemplatePKCompletion', () => {
  let pk: TemplatePKCompletion;

  beforeEach(() => {
    resetTemplatePKCompletion();
    pk = templatePKCompletion();
  });

  it('seeds 4 predefined matchups', () => {
    const matchups = pk.listMatchups();
    expect(matchups.length).toBeGreaterThanOrEqual(4);
  });

  it('listMatchups filters by category', () => {
    const filtered = pk.listMatchups('momentum_vs_value');
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.every(m => m.category === 'momentum_vs_value')).toBe(true);
  });

  it('getMatchup returns with historical data', () => {
    const matchup = pk.getMatchup('mv-ai-momentum-vs-deep-value');
    expect(matchup).not.toBeNull();
    expect(matchup!.historicalResults.length).toBeGreaterThanOrEqual(3);
    expect(matchup!.headToHead.aWins).toBeGreaterThan(0);
    expect(matchup!.rivalry.intensity).toBeDefined();
  });

  it('recordMatchupResult updates head-to-head', () => {
    const before = pk.getMatchup('mv-ai-momentum-vs-deep-value')!.headToHead.aWins;
    pk.recordMatchupResult('mv-ai-momentum-vs-deep-value', {
      winner: 'A', scoreA: 70, scoreB: 30,
    });
    const after = pk.getMatchup('mv-ai-momentum-vs-deep-value')!.headToHead.aWins;
    expect(after).toBe(before + 1);
  });

  it('recordMatchupResult: draw increments draws', () => {
    const before = pk.getMatchup('mv-defensive-vs-macro')!.headToHead.draws;
    pk.recordMatchupResult('mv-defensive-vs-macro', {
      winner: 'draw', scoreA: 50, scoreB: 50,
    });
    expect(pk.getMatchup('mv-defensive-vs-macro')!.headToHead.draws).toBe(before + 1);
  });

  it('recordMatchupResult returns null for unknown', () => {
    expect(pk.recordMatchupResult('bad', { winner: 'A', scoreA: 70, scoreB: 30 })).toBeNull();
  });

  it('runBatchPK returns all matchups in category', () => {
    const result = pk.runBatchPK('momentum_vs_value', 'SPY');
    expect(result.totalPKs).toBeGreaterThanOrEqual(2);
    expect(result.category).toBe('momentum_vs_value');
    expect(result.results.every(r => r.winner.length > 0)).toBe(true);
    expect(result.summary.avgScoreDiff).toBeGreaterThan(0);
  });

  it('batchPK results include dominant dimensions', () => {
    const result = pk.runBatchPK('momentum_vs_value', 'SPY');
    for (const r of result.results) {
      expect(r.dominantDimCn.length).toBeGreaterThan(0);
    }
  });

  it('getLeagueTable returns ELO-ranked list', () => {
    const league = pk.getLeagueTable();
    expect(league.length).toBeGreaterThanOrEqual(5);
    // Descending ELO
    for (let i = 1; i < league.length; i++) {
      expect(league[i - 1].elo).toBeGreaterThanOrEqual(league[i].elo);
    }
  });

  it('getLeagueTable filters by category', () => {
    const momentum = pk.getLeagueTable('momentum');
    expect(momentum.length).toBeGreaterThanOrEqual(1);
    expect(momentum.every(e => e.category === 'momentum')).toBe(true);
  });

  it('updateELO adjusts ratings', () => {
    const beforeWinner = pk.getLeagueTable().find(e => e.templateId === 'ai-momentum-chaser')!.elo;
    const beforeLoser = pk.getLeagueTable().find(e => e.templateId === 'deep-value-hunter')!.elo;

    pk.updateELO('ai-momentum-chaser', 'deep-value-hunter', false);

    const afterWinner = pk.getLeagueTable().find(e => e.templateId === 'ai-momentum-chaser')!.elo;
    const afterLoser = pk.getLeagueTable().find(e => e.templateId === 'deep-value-hunter')!.elo;

    expect(afterWinner).toBeGreaterThan(beforeWinner);
    expect(afterLoser).toBeLessThan(beforeLoser);
  });

  it('updateELO: draw adjusts both slightly', () => {
    const beforeA = pk.getLeagueTable().find(e => e.templateId === 'ai-momentum-chaser')!.elo;
    const beforeB = pk.getLeagueTable().find(e => e.templateId === 'deep-value-hunter')!.elo;

    pk.updateELO('ai-momentum-chaser', 'deep-value-hunter', true);

    const afterA = pk.getLeagueTable().find(e => e.templateId === 'ai-momentum-chaser')!.elo;
    // Higher-rated team should lose some ELO in a draw
    expect(afterA).toBeLessThan(beforeA);
  });

  it('getPKTrend returns trend series', () => {
    const trend = pk.getPKTrend('mv-ai-momentum-vs-deep-value', 'monthly');
    expect(trend).not.toBeNull();
    expect(trend!.series.length).toBeGreaterThanOrEqual(1);
  });

  it('getPKTrend returns null for no history', () => {
    // Create a matchup with no results via a fresh instance approach
    // Actually all seed matchups have history, so this is for a non-existent matchup
    expect(pk.getPKTrend('nonexistent')).toBeNull();
  });

  it('runPurchasePK compares template against alternatives', () => {
    const result = pk.runPurchasePK(
      'template:1', 'Test Template', '测试模板',
      ['alt:1', 'alt:2'], ['Alt 1', 'Alt 2'], ['备选1', '备选2'],
    );

    expect(result.results.length).toBe(2);
    expect(result.recommendation.confidence).toBeGreaterThanOrEqual(0);
    expect(result.recommendation.confidence).toBeLessThanOrEqual(1);
    expect(result.recommendation.reasonCn.length).toBeGreaterThan(0);
  });

  it('reset restores seed data', () => {
    pk.recordMatchupResult('mv-ai-momentum-vs-deep-value', { winner: 'A', scoreA: 80, scoreB: 20 });
    pk.reset();
    // Should be back to 4 seed matchups
    expect(pk.listMatchups().length).toBeGreaterThanOrEqual(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-28: AIVerifiableEvidence
// ═══════════════════════════════════════════════════════════════════════════

describe('R251 P2-28: AIVerifiableEvidence', () => {
  let ev: AIVerifiableEvidence;

  beforeEach(() => {
    resetAIVerifiableEvidence();
    ev = aiVerifiableEvidence();
  });

  it('registerClaim creates a verifiable claim', () => {
    const claim = ev.registerClaim(
      'dec:1',
      'AAPL will outperform SPY by 5% next quarter',
      '苹果下季度将跑赢标普500 5%',
      'market_data',
    );

    expect(claim.claimId).toBeTruthy();
    expect(claim.decisionId).toBe('dec:1');
    expect(claim.verificationStatus).toBe('pending');
    expect(claim.evidence.length).toBe(0);
  });

  it('addEvidence links evidence to claim', () => {
    const claim = ev.registerClaim('dec:1', 'Claim', '声明', 'fundamental');

    const evidence = ev.addEvidence(claim.claimId, {
      source: 'Bloomberg Terminal',
      sourceType: 'market_data',
      dataPoint: 'AAPL trailing P/E',
      value: '28.5',
      valueNumeric: 28.5,
      credibilityScore: 95,
      verificationLevel: 'verified',
    });

    expect(evidence).not.toBeNull();
    expect(evidence!.credibilityScore).toBe(95);

    const updated = ev.getClaim(claim.claimId)!;
    expect(updated.evidence.length).toBe(1);
    expect(updated.verificationStatus).toBe('verified');
  });

  it('addEvidence returns null for unknown claim', () => {
    expect(ev.addEvidence('bad', {
      source: 'X', sourceType: 'api', dataPoint: 'X', value: '0',
      credibilityScore: 50, verificationLevel: 'raw',
    })).toBeNull();
  });

  it('detectContradiction flags contradiction', () => {
    const claim = ev.registerClaim('dec:1', 'AAPL bullish', '苹果看涨', 'sentiment');
    const contra = ev.detectContradiction(
      claim.claimId, 'Market Data',
      'AAPL insider selling detected',
      '苹果内部人减持检测到',
      'critical',
    );

    expect(contra).not.toBeNull();
    expect(contra!.severity).toBe('critical');
    expect(contra!.resolved).toBe(false);

    const updated = ev.getClaim(claim.claimId)!;
    expect(updated.verificationStatus).toBe('contradicted');
    expect(updated.contradictions.length).toBe(1);
  });

  it('detectContradiction returns null for unknown', () => {
    expect(ev.detectContradiction('bad', 'src', 'e', 'e', 'minor')).toBeNull();
  });

  it('resolveContradiction clears contradiction', () => {
    const claim = ev.registerClaim('dec:1', 'Claim', '声明', 'sentiment');
    const contra = ev.detectContradiction(claim.claimId, 'Source', 'Evidence', '证据', 'moderate')!;

    const resolved = ev.resolveContradiction(claim.claimId, contra.contradictionId, 'Insider selling was pre-scheduled');
    expect(resolved).toBe(true);

    const updated = ev.getClaim(claim.claimId)!;
    expect(updated.contradictions[0].resolved).toBe(true);
  });

  it('resolveContradiction returns false for bad ids', () => {
    expect(ev.resolveContradiction('bad', 'bad', 'R')).toBe(false);
  });

  it('scoreClaim: well-supported claim scores high', () => {
    const claim = ev.registerClaim('dec:1', 'Strong claim', '强声明', 'technical');
    ev.addEvidence(claim.claimId, {
      source: 'TradingView', sourceType: 'market_data', dataPoint: 'RSI strength', value: '35',
      credibilityScore: 90, verificationLevel: 'verified',
    });
    ev.addEvidence(claim.claimId, {
      source: 'FactSet', sourceType: 'api', dataPoint: 'MACD strength', value: 'bullish crossover',
      credibilityScore: 88, verificationLevel: 'corroborated',
    });
    ev.addEvidence(claim.claimId, {
      source: 'Bloomberg', sourceType: 'market_data', dataPoint: 'Strong technical momentum', value: 'confirmed',
      credibilityScore: 92, verificationLevel: 'consensus',
    });

    const score = ev.scoreClaim(claim.claimId)!;
    expect(score.overallScore).toBeGreaterThan(50);
    // With 3 strong evidence sources, score should be well supported
    expect(score.overallScore).toBeGreaterThan(70);
    expect(score.verdictCn.length).toBeGreaterThan(0);
  });

  it('scoreClaim: refuted claim scores low', () => {
    const claim = ev.registerClaim('dec:2', 'Weak claim', '弱声明', 'sentiment');
    // No evidence added, just a contradiction
    ev.detectContradiction(claim.claimId, 'Market', 'Opposite data', '相反数据', 'critical');

    const score = ev.scoreClaim(claim.claimId)!;
    expect(score.overallScore).toBeLessThan(40);
    expect(score.breakdown.contradictionPenalty).toBeGreaterThan(0);
    expect(['disputed', 'refuted']).toContain(score.verdict);
  });

  it('scoreClaim returns null for unknown', () => {
    expect(ev.scoreClaim('bad')).toBeNull();
  });

  it('generateReport aggregates claims for a decision', () => {
    const claim1 = ev.registerClaim('dec:1', 'C1', '声明1', 'market_data');
    const claim2 = ev.registerClaim('dec:1', 'C2', '声明2', 'fundamental');
    ev.addEvidence(claim1.claimId, {
      source: 'S', sourceType: 'api', dataPoint: 'D', value: '1',
      credibilityScore: 80, verificationLevel: 'verified',
    });
    ev.addEvidence(claim2.claimId, {
      source: 'S2', sourceType: 'report', dataPoint: 'D2', value: '2',
      credibilityScore: 70, verificationLevel: 'verified',
    });

    const report = ev.generateReport('dec:1');
    expect(report).not.toBeNull();
    expect(report!.claims.length).toBe(2);
    expect(report!.scores.length).toBe(2);
    expect(report!.summaryCn.length).toBeGreaterThan(0);
  });

  it('generateReport returns null for unknown decision', () => {
    expect(ev.generateReport('bad')).toBeNull();
  });

  it('exportMarkdownReport generates formatted markdown', () => {
    const claim = ev.registerClaim('dec:1', 'Test claim', '测试声明', 'fundamental');
    ev.addEvidence(claim.claimId, {
      source: 'Source A', sourceType: 'report', dataPoint: 'EPS', value: '$6.20',
      credibilityScore: 85, verificationLevel: 'verified',
    });

    const report = ev.exportMarkdownReport('dec:1');
    expect(report).not.toBeNull();
    expect(report!).toContain('Evidence Verification Report');
    expect(report!).toContain('测试声明');
    expect(report!).toContain('Audit Trail');
  });

  it('getAuditTrail tracks all actions', () => {
    const claim = ev.registerClaim('dec:1', 'C', 'C', 'market_data');
    ev.addEvidence(claim.claimId, {
      source: 'S', sourceType: 'api', dataPoint: 'D', value: '1',
      credibilityScore: 50, verificationLevel: 'raw',
    });

    const trail = ev.getAuditTrail('dec:1');
    expect(trail.length).toBeGreaterThanOrEqual(2); // register + add evidence
    expect(trail[0].actionCn).toBeDefined();
  });

  it('getAuditTrail without decisionId returns all', () => {
    ev.registerClaim('dec:a', 'A', 'A', 'market_data');
    ev.registerClaim('dec:b', 'B', 'B', 'fundamental');

    const all = ev.getAuditTrail();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('exportState returns full state', () => {
    ev.registerClaim('dec:1', 'C', 'C', 'market_data');
    const state = ev.exportState();
    expect(state.claims.length).toBeGreaterThanOrEqual(1);
    expect(state.auditTrails.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears all', () => {
    ev.registerClaim('dec:1', 'C', 'C', 'market_data');
    ev.reset();
    expect(ev.getAuditTrail().length).toBe(0);
    expect(ev.exportState().claims.length).toBe(0);
  });

  it('verificationStatus transitions from pending→verified→contradicted', () => {
    const claim = ev.registerClaim('dec:1', 'Test', '测试', 'market_data');
    expect(claim.verificationStatus).toBe('pending');

    ev.addEvidence(claim.claimId, {
      source: 'S', sourceType: 'api', dataPoint: 'D', value: '1',
      credibilityScore: 70, verificationLevel: 'verified',
    });
    expect(ev.getClaim(claim.claimId)!.verificationStatus).toBe('verified');

    ev.detectContradiction(claim.claimId, 'S', 'E', '证据', 'critical');
    expect(ev.getClaim(claim.claimId)!.verificationStatus).toBe('contradicted');
  });
});
