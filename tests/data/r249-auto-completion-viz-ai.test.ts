/**
 * R249 autoclaw TEST: P1-03 + P2-26 + P2-29
 * Covers: FactorMarketplaceCompletion, FactorVisualizationDataEngine, AIQuestionableEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorMarketplaceCompletion, factorMarketplaceCompletion, resetFactorMarketplaceCompletion,
} from '../../electron/engine/data/factor-marketplace-completion';
import type { FactorReview, UGCSubmission } from '../../electron/engine/data/factor-marketplace-completion';
import {
  FactorVisualizationDataEngine, factorVisualizationDataEngine, resetFactorVisualizationDataEngine,
} from '../../electron/engine/data/factor-viz-data-engine';
import {
  AIQuestionableEngine, aiQuestionableEngine, resetAIQuestionableEngine,
} from '../../electron/engine/data/ai-questionable-engine';
import type { AIDecision } from '../../electron/engine/data/ai-questionable-engine';

// ═══════════════════════════════════════════════════════════════════════════
// P1-03: FactorMarketplaceCompletion
// ═══════════════════════════════════════════════════════════════════════════

describe('R249 P1-03: FactorMarketplaceCompletion', () => {
  let completion: FactorMarketplaceCompletion;

  beforeEach(() => {
    resetFactorMarketplaceCompletion();
    completion = factorMarketplaceCompletion();
  });

  // ── Reviews ──────────────────────────────────────────────────────────

  it('submitReview creates a review', () => {
    const review = completion.submitReview('F1', 'user:a', {
      rating: 4, title: 'Great factor', body: 'Works well for momentum stocks',
    });
    expect(review.factorId).toBe('F1');
    expect(review.rating).toBe(4);
    expect(review.helpfulCount).toBe(0);
    expect(review.reviewId).toBeTruthy();
  });

  it('submitReview clamps rating to 1-5', () => {
    const review = completion.submitReview('F1', 'user:a', {
      rating: 10, title: 'T', body: 'B',
    });
    expect(review.rating).toBe(5);

    const review2 = completion.submitReview('F2', 'user:b', {
      rating: -2, title: 'T', body: 'B',
    });
    expect(review2.rating).toBe(1);
  });

  it('submitReview replaces previous review from same user', () => {
    completion.submitReview('F1', 'user:a', { rating: 2, title: 'Meh', body: 'Not good' });
    completion.submitReview('F1', 'user:a', { rating: 4, title: 'Better', body: 'Re-evaluated' });

    const stats = completion.getReviewStats('F1');
    expect(stats.totalReviews).toBe(1);
    expect(stats.avgRating).toBe(4);
  });

  it('getReviewStats returns distribution', () => {
    completion.submitReview('F1', 'u1', { rating: 5, title: 'A', body: 'X' });
    completion.submitReview('F1', 'u2', { rating: 4, title: 'B', body: 'Y' });
    completion.submitReview('F1', 'u3', { rating: 3, title: 'C', body: 'Z' });

    const stats = completion.getReviewStats('F1');
    expect(stats.distribution[5]).toBe(1);
    expect(stats.distribution[4]).toBe(1);
    expect(stats.distribution[3]).toBe(1);
    expect(stats.avgRating).toBe(4);
    expect(stats.recentReviews.length).toBe(3);
  });

  it('voteHelpful increments count', () => {
    const review = completion.submitReview('F1', 'u1', { rating: 5, title: 'Great', body: 'Works' });
    const ok = completion.voteHelpful('F1', review.reviewId, 'u2');
    expect(ok).toBe(true);

    const stats = completion.getReviewStats('F1');
    expect(stats.mostHelpfulReview?.helpfulCount).toBe(1);
  });

  it('voteHelpful: same user cannot vote twice', () => {
    const review = completion.submitReview('F1', 'u1', { rating: 5, title: 'T', body: 'B' });
    completion.voteHelpful('F1', review.reviewId, 'u2');
    const ok2 = completion.voteHelpful('F1', review.reviewId, 'u2');
    expect(ok2).toBe(false);
    expect(completion.getReviewStats('F1').mostHelpfulReview?.helpfulCount).toBe(1);
  });

  it('getReviews with pagination', () => {
    for (let i = 0; i < 15; i++) {
      completion.submitReview('F1', `u${i}`, { rating: 4, title: `Review ${i}`, body: `Body ${i}` });
    }
    const page1 = completion.getReviews('F1', { page: 1, pageSize: 10 });
    expect(page1.reviews.length).toBe(10);
    expect(page1.total).toBe(15);

    const page2 = completion.getReviews('F1', { page: 2, pageSize: 10 });
    expect(page2.reviews.length).toBe(5);
  });

  it('getReviews sorts by highest', () => {
    completion.submitReview('F1', 'u1', { rating: 3, title: 'Ok', body: 'X' });
    completion.submitReview('F1', 'u2', { rating: 5, title: 'Great', body: 'Y' });
    completion.submitReview('F1', 'u3', { rating: 1, title: 'Bad', body: 'Z' });

    const sorted = completion.getReviews('F1', { sortBy: 'highest' });
    expect(sorted.reviews[0].rating).toBe(5);
    expect(sorted.reviews[2].rating).toBe(1);
  });

  it('searchReviews filters by keyword', () => {
    completion.submitReview('F1', 'u1', { rating: 5, title: 'Momentum is great', body: 'Highly recommend for momentum' });
    completion.submitReview('F2', 'u2', { rating: 3, title: 'Value average', body: 'Value investing factor' });

    const results = completion.searchReviews('momentum');
    expect(results.total).toBeGreaterThanOrEqual(1);
    expect(results.reviews.some(r => r.title.includes('Momentum'))).toBe(true);
  });

  it('deleteReview removes a review', () => {
    const review = completion.submitReview('F1', 'u1', { rating: 3, title: 'T', body: 'B' });
    const deleted = completion.deleteReview('F1', review.reviewId);
    expect(deleted).toBe(true);
    expect(completion.getReviewStats('F1').totalReviews).toBe(0);
  });

  // ── UGC Submissions ─────────────────────────────────────────────────

  it('submitFactor creates pending submission', () => {
    const sub = completion.submitFactor('creator:c1', {
      factorId: 'CUSTOM_ALPHA', name: 'Custom Alpha', nameCn: '自定义阿尔法',
      domain: 'momentum', description: 'Custom momentum factor', descriptionCn: '自定义动量因子',
      ic: 0.06, sharpe: 1.2,
      backtest: { totalReturn: 0.25, maxDrawdown: -0.15, winRate: 0.55 },
      buyoutPrice: 9.9, proPriceMonthly: 2.9,
      applicableMarkets: ['US'],
    });

    expect(sub.status).toBe('pending');
    expect(sub.creatorId).toBe('creator:c1');
    expect(sub.revisions.length).toBe(0);
  });

  it('approveSubmission moves to approved', () => {
    const sub = completion.submitFactor('creator:c2', {
      factorId: 'F_AWESOME', name: 'Awesome Factor', nameCn: '超棒因子',
      domain: 'quality', description: 'A', descriptionCn: 'A',
      ic: 0.05, sharpe: 1.0,
      backtest: { totalReturn: 0.15, maxDrawdown: -0.1, winRate: 0.5 },
      buyoutPrice: 9.9, proPriceMonthly: 3,
      applicableMarkets: ['US'],
    });

    const approved = completion.approveSubmission(sub.submissionId, 'mod:1');
    expect(approved).not.toBeNull();
    expect(approved!.status).toBe('approved');
    expect(approved!.reviewerId).toBe('mod:1');
  });

  it('rejectSubmission with reason', () => {
    const sub = completion.submitFactor('creator:c3', {
      factorId: 'F_BAD', name: 'Bad Factor', nameCn: '坏因子',
      domain: 'crypto', description: 'B', descriptionCn: 'B',
      ic: 0.01, sharpe: 0.1,
      backtest: { totalReturn: 0.01, maxDrawdown: -0.5, winRate: 0.3 },
      buyoutPrice: 19.9, proPriceMonthly: 5,
      applicableMarkets: ['CRYPTO'],
    });

    const rejected = completion.rejectSubmission(sub.submissionId, 'mod:2', 'IC too low, insufficient backtest history');
    expect(rejected).not.toBeNull();
    expect(rejected!.status).toBe('rejected');
    expect(rejected!.rejectReason).toContain('IC too low');
  });

  it('suspendSubmission changes to suspended', () => {
    const sub = completion.submitFactor('creator:c4', {
      factorId: 'F_SUSPENDED', name: 'Suspended Factor', nameCn: '待停用因子',
      domain: 'momentum', description: 'S', descriptionCn: 'S',
      ic: 0.05, sharpe: 1.0,
      backtest: { totalReturn: 0.15, maxDrawdown: -0.1, winRate: 0.5 },
      buyoutPrice: 9.9, proPriceMonthly: 3,
      applicableMarkets: ['US'],
    });
    completion.approveSubmission(sub.submissionId, 'mod:1');

    const suspended = completion.suspendSubmission(sub.submissionId, 'Misleading backtest data');
    expect(suspended).not.toBeNull();
    expect(suspended!.status).toBe('suspended');
  });

  it('getUGCQueue returns all queues', () => {
    const s1 = completion.submitFactor('creator:1', {
      factorId: 'F1', name: 'F1', nameCn: 'F1', domain: 'momentum', description: 'F1', descriptionCn: 'F1',
      ic: 0.05, sharpe: 1.0, backtest: { totalReturn: 0.2, maxDrawdown: -0.1, winRate: 0.5 },
      buyoutPrice: 9.9, proPriceMonthly: 3, applicableMarkets: ['US'],
    });
    const s2 = completion.submitFactor('creator:2', {
      factorId: 'F2', name: 'F2', nameCn: 'F2', domain: 'value', description: 'F2', descriptionCn: 'F2',
      ic: 0.08, sharpe: 1.5, backtest: { totalReturn: 0.3, maxDrawdown: -0.08, winRate: 0.6 },
      buyoutPrice: 9.9, proPriceMonthly: 3, applicableMarkets: ['US'],
    });
    completion.approveSubmission(s2.submissionId, 'mod:1');

    const queue = completion.getUGCQueue();
    expect(queue.pending.length).toBe(1);
    expect(queue.approved.length).toBe(1);
    expect(queue.approvalRate).toBe(50);
  });

  it('getCreatorSubmissions filters by creator', () => {
    completion.submitFactor('creator:a', {
      factorId: 'FA', name: 'FA1', nameCn: 'FA1', domain: 'value', description: 'A', descriptionCn: 'A',
      ic: 0.05, sharpe: 1.0, backtest: { totalReturn: 0.2, maxDrawdown: -0.1, winRate: 0.5 },
      buyoutPrice: 9.9, proPriceMonthly: 3, applicableMarkets: ['US'],
    });
    completion.submitFactor('creator:b', {
      factorId: 'FB', name: 'FB1', nameCn: 'FB1', domain: 'momentum', description: 'B', descriptionCn: 'B',
      ic: 0.06, sharpe: 1.2, backtest: { totalReturn: 0.25, maxDrawdown: -0.12, winRate: 0.55 },
      buyoutPrice: 9.9, proPriceMonthly: 3, applicableMarkets: ['US'],
    });

    expect(completion.getCreatorSubmissions('creator:a').length).toBe(1);
  });

  it('requestRevision adds revision record', () => {
    const sub = completion.submitFactor('creator:c5', {
      factorId: 'F_NEEDS_REVISION', name: 'Need fix', nameCn: '需要修改',
      domain: 'quality', description: 'R', descriptionCn: 'R',
      ic: 0.04, sharpe: 0.8, backtest: { totalReturn: 0.1, maxDrawdown: -0.2, winRate: 0.45 },
      buyoutPrice: 9.9, proPriceMonthly: 3, applicableMarkets: ['US'],
    });

    const revised = completion.requestRevision(sub.submissionId, 'mod:3', 'Please add more backtest data');
    expect(revised).not.toBeNull();
    expect(revised!.revisions.length).toBe(1);
    expect(revised!.revisions[0].changes).toContain('backtest');
  });

  // ── Featured ─────────────────────────────────────────────────────────

  it('featureFactor and getFeatured', () => {
    completion.featureFactor('MOMENTUM_12M', {
      title: 'Top Momentum Pick', titleCn: '动量首选',
      reason: 'Consistently high IC', reasonCn: 'IC持续高',
      curatorId: 'editor:1', sortOrder: 0,
    });

    completion.featureFactor('VALUE_EARNINGS_YIELD', {
      title: 'Best Value Factor', titleCn: '最佳价值因子',
      reason: 'Low drawdown', reasonCn: '回撤低',
      curatorId: 'editor:1', sortOrder: 1,
    });

    const featured = completion.getFeatured();
    expect(featured.length).toBe(2);
    expect(featured[0].factorId).toBe('MOMENTUM_12M'); // sortOrder 0 first
  });

  it('unfeatureFactor removes listing', () => {
    const feat = completion.featureFactor('F1', {
      title: 'Test', titleCn: '测试', reason: 'R', reasonCn: 'R', curatorId: 'e:1',
    });
    const removed = completion.unfeatureFactor(feat.featureId);
    expect(removed).toBe(true);
    expect(completion.getFeatured().length).toBe(0);
  });

  // ── Changelog ────────────────────────────────────────────────────────

  it('publishChangelog and getChangelog', () => {
    completion.publishChangelog('MOMENTUM_12M', {
      version: '1.2.0', severity: 'minor',
      changes: ['Improved IC by 0.02', 'Added 6-month lookback window'],
      changesCn: ['IC提升0.02', '增加6个月回溯窗口'],
      authorId: 'creator:1',
    });

    const logs = completion.getChangelog('MOMENTUM_12M');
    expect(logs.length).toBe(1);
    expect(logs[0].version).toBe('1.2.0');
    expect(logs[0].changes.length).toBe(2);
  });

  it('getLatestVersion returns most recent', () => {
    completion.publishChangelog('F1', {
      version: '1.0.0', severity: 'major',
      changes: ['Initial release'], changesCn: ['首次发布'], authorId: 'c:1',
    });
    completion.publishChangelog('F1', {
      version: '1.0.1', severity: 'patch',
      changes: ['Bug fix'], changesCn: ['修复'], authorId: 'c:1',
    });

    const latest = completion.getLatestVersion('F1');
    expect(latest?.version).toBe('1.0.1');
  });

  it('getAllChangelogs aggregates across factors', () => {
    completion.publishChangelog('F1', { version: '1.0.0', severity: 'major', changes: ['a'], changesCn: ['a'], authorId: 'c:1' });
    completion.publishChangelog('F2', { version: '2.0.0', severity: 'major', changes: ['b'], changesCn: ['b'], authorId: 'c:2' });

    expect(completion.getAllChangelogs().length).toBeGreaterThanOrEqual(2);
  });

  it('getStats tracks counts', () => {
    completion.submitReview('F1', 'u1', { rating: 5, title: 'T', body: 'B' });
    completion.submitReview('F1', 'u2', { rating: 4, title: 'T2', body: 'B2' });

    completion.submitFactor('c:1', {
      factorId: 'FX', name: 'FX', nameCn: 'FX', domain: 'momentum',
      description: 'D', descriptionCn: 'D',
      ic: 0.05, sharpe: 1.0, backtest: { totalReturn: 0.2, maxDrawdown: -0.1, winRate: 0.5 },
      buyoutPrice: 9.9, proPriceMonthly: 3, applicableMarkets: ['US'],
    });

    const stats = completion.getStats();
    expect(stats.totalReviews).toBe(2);
    expect(stats.totalSubmissionsSubmitted).toBe(1);
  });

  it('reset clears all state', () => {
    completion.submitReview('F1', 'u1', { rating: 5, title: 'T', body: 'B' });
    completion.reset();
    expect(completion.getReviewStats('F1').totalReviews).toBe(0);
    expect(completion.getFeatured().length).toBe(0);
    expect(completion.getStats().totalReviews).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-26: FactorVisualizationDataEngine
// ═══════════════════════════════════════════════════════════════════════════

describe('R249 P2-26: FactorVisualizationDataEngine', () => {
  let engine: FactorVisualizationDataEngine;

  beforeEach(() => {
    resetFactorVisualizationDataEngine();
    engine = factorVisualizationDataEngine();
  });

  it('getICTimeSeries returns IC data with correct shape', () => {
    const ic = engine.getICTimeSeries('MOMENTUM_12M', 252);
    expect(ic).not.toBeNull();
    expect(ic!.series.length).toBeGreaterThan(100); // ~200 weekdays
    expect(ic!.summary.meanIC).toBeGreaterThan(0);
    expect(ic!.summary.recentTrend).toBeDefined();
    expect(ic!.factorName).toBe('12M Momentum');
  });

  it('getICTimeSeries returns null for unknown factor', () => {
    expect(engine.getICTimeSeries('UNKNOWN')).toBeNull();
  });

  it('getCumulativeReturn returns curve vs benchmark', () => {
    const curve = engine.getCumulativeReturn('VALUE_EARNINGS_YIELD', 'SPY');
    expect(curve).not.toBeNull();
    expect(curve!.series.length).toBeGreaterThan(100);
    expect(curve!.summary.totalReturn).toBeDefined();
    expect(curve!.summary.excess).toBeDefined();
    expect(curve!.benchmark).toBe('SPY');
  });

  it('getCumulativeReturn returns null for unknown', () => {
    expect(engine.getCumulativeReturn('BAD_FACTOR')).toBeNull();
  });

  it('buildCorrelationMatrix returns N×N matrix', () => {
    const ids = ['MOMENTUM_12M', 'MOMENTUM_3M', 'VALUE_EARNINGS_YIELD', 'QUALITY_ROE', 'GROWTH_EPS_3Y'];
    const matrix = engine.buildCorrelationMatrix(ids);

    expect(matrix.factors.length).toBe(5);
    expect(matrix.matrix.length).toBe(5);
    expect(matrix.matrix[0].length).toBe(5);
    expect(matrix.matrix[0][0]).toBe(1); // self-correlation
    expect(matrix.matrix[0][1]).toBe(matrix.matrix[1][0]); // symmetric
    expect(matrix.overallAvg).toBeGreaterThan(0);
  });

  it('buildCorrelationMatrix: same domain factors have higher correlation', () => {
    const sameDomain = ['MOMENTUM_12M', 'MOMENTUM_3M', 'MOMENTUM_1M'];
    const diffDomain = ['MOMENTUM_12M', 'VALUE_EARNINGS_YIELD', 'CRYPTO_VOLUME'];

    const corrSame = engine.buildCorrelationMatrix(sameDomain);
    const corrDiff = engine.buildCorrelationMatrix(diffDomain);

    expect(corrSame.overallAvg).toBeGreaterThan(corrDiff.overallAvg);
    expect(corrSame.clusters.length).toBeLessThan(corrDiff.clusters.length);
  });

  it('getRankings returns sorted factors by IC', () => {
    const rankings = engine.getRankings('ic');
    expect(rankings.dimension).toBe('ic');
    expect(rankings.rankings.length).toBeGreaterThanOrEqual(15);
    // Sorted descending by value
    for (let i = 1; i < rankings.rankings.length; i++) {
      expect(rankings.rankings[i - 1].value).toBeGreaterThanOrEqual(rankings.rankings[i].value);
    }
  });

  it('getRankings by sharpe returns sorted', () => {
    const rankings = engine.getRankings('sharpe');
    expect(rankings.dimension).toBe('sharpe');
    expect(rankings.rankings.length).toBeGreaterThanOrEqual(15);
  });

  it('getHeatmap returns domains × metrics grid', () => {
    const heatmap = engine.getHeatmap();
    expect(heatmap.domains.length).toBeGreaterThanOrEqual(8);
    expect(heatmap.metrics.length).toBeGreaterThanOrEqual(5);
    expect(heatmap.data.length).toBe(heatmap.domains.length);
    expect(heatmap.data[0].length).toBe(heatmap.metrics.length);
    expect(heatmap.colorRange.min).toBeLessThan(heatmap.colorRange.max);
  });

  it('getHeatmap accepts domain filter', () => {
    const heatmap = engine.getHeatmap({ domains: ['momentum', 'value'] });
    expect(heatmap.domains.length).toBe(2);
    expect(heatmap.data.length).toBe(2);
  });

  it('getDistribution returns histogram data', () => {
    const dist = engine.getDistribution('MOMENTUM_12M', 'US');
    expect(dist).not.toBeNull();
    expect(dist!.histogram.length).toBe(20);
    expect(dist!.percentiles.p50).toBeDefined();
    expect(dist!.stats.n).toBe(500);
    expect(dist!.stats.mean).toBeDefined();
    expect(dist!.stats.skewness).toBeDefined();
  });

  it('getDistribution returns null for unknown factor', () => {
    expect(engine.getDistribution('UNKNOWN')).toBeNull();
  });

  it('compareDomains returns group comparison data', () => {
    const comparison = engine.compareDomains('ic');
    expect(comparison.data.length).toBeGreaterThanOrEqual(5);
    expect(comparison.groups.length).toBeGreaterThanOrEqual(5);
    expect(comparison.titleCn).toContain('信息系数');
    expect(comparison.data[0].points.length).toBeGreaterThan(0);
    expect(comparison.data[0].median).toBeDefined();
  });

  it('getDashboardSnapshot returns full snapshot', () => {
    const snapshot = engine.getDashboardSnapshot();
    expect(snapshot.topFactors.rankings.length).toBeGreaterThan(0);
    expect(snapshot.heatmap.data.length).toBeGreaterThan(0);
    expect(snapshot.correlation.factors.length).toBeGreaterThan(0);
    expect(snapshot.timestamp).toBeGreaterThan(0);
  });

  it('reset restores registry', () => {
    const before = engine.getRankings().rankings.length;
    engine.reset();
    const after = engine.getRankings().rankings.length;
    expect(after).toBe(before);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-29: AIQuestionableEngine
// ═══════════════════════════════════════════════════════════════════════════

describe('R249 P2-29: AIQuestionableEngine', () => {
  let engine: AIQuestionableEngine;

  beforeEach(() => {
    resetAIQuestionableEngine();
    engine = aiQuestionableEngine();
  });

  it('recordDecision creates an AI decision record', () => {
    const decision = engine.recordDecision('user:1', 'strategy_recommendation', {
      symbol: 'AAPL', market: 'US',
      input: { style: 'growth', capital: 10000 },
      reasoning: 'AAPL has strong momentum and quality metrics',
    }, {
      result: 'AI Momentum Chaser strategy',
      confidence: 0.85,
      alternatives: ['Deep Value', 'Quality Growth'],
      dataSources: ['price_data', 'earnings_reports'],
    });

    expect(decision.decisionId).toBeTruthy();
    expect(decision.type).toBe('strategy_recommendation');
    expect(decision.output.confidence).toBe(0.85);
    expect(decision.disputes.length).toBe(0);
  });

  it('provideFeedback: agree', () => {
    const decision = engine.recordDecision('user:1', 'risk_warning', {
      symbol: 'TSLA', market: 'US',
      input: {}, reasoning: 'High volatility detected',
    }, {
      result: 'Reduce position by 20%',
      confidence: 0.75,
      alternatives: ['Full exit'],
      dataSources: ['volatility_data'],
    });

    const updated = engine.provideFeedback(decision.decisionId, 'user:1', {
      action: 'agree', comment: 'Good call',
    });

    expect(updated).not.toBeNull();
    expect(updated!.feedback!.action).toBe('agree');
    expect(updated!.feedback!.confidenceShift).toBeGreaterThan(0);
  });

  it('provideFeedback: disagree', () => {
    const decision = engine.recordDecision('user:1', 'market_prediction', {
      symbol: 'SPY', market: 'US',
      input: {}, reasoning: 'Interest rate cut expected',
    }, {
      result: 'Bullish next quarter',
      confidence: 0.65,
      alternatives: ['Neutral'],
      dataSources: ['macro_data'],
    });

    const updated = engine.provideFeedback(decision.decisionId, 'user:1', {
      action: 'disagree', comment: 'Rate cut unlikely',
    });
    expect(updated!.feedback!.confidenceShift).toBeLessThan(0);
  });

  it('provideFeedback: correct', () => {
    const decision = engine.recordDecision('user:1', 'portfolio_rebalance', {
      symbol: 'NVDA', market: 'US',
      input: {}, reasoning: 'AI recommends overweight tech',
    }, {
      result: 'Allocate 40% to tech',
      confidence: 0.7,
      alternatives: ['30% tech'],
      dataSources: ['portfolio_data'],
    });

    const updated = engine.provideFeedback(decision.decisionId, 'user:1', {
      action: 'correct',
      correction: 'Should be max 25% tech due to concentration risk',
    });
    expect(updated!.feedback!.correction).toContain('25%');
  });

  it('provideFeedback returns null for unknown decision', () => {
    expect(engine.provideFeedback('bad', 'u1', { action: 'agree' })).toBeNull();
  });

  it('raiseDispute creates a dispute', () => {
    const decision = engine.recordDecision('user:1', 'strategy_recommendation', {
      symbol: 'TSLA', market: 'US',
      input: { style: 'momentum' },
      reasoning: 'Strong technical momentum',
    }, {
      result: 'Momentum Rocket strategy',
      confidence: 0.9,
      alternatives: ['Quality Growth'],
      dataSources: ['price_data'],
    });

    const dispute = engine.raiseDispute(decision.decisionId, 'user:1', {
      reason: 'Momentum is fading, recommendation is stale',
      severity: 'moderate',
    });

    expect(dispute).not.toBeNull();
    expect(dispute!.status).toBe('pending');
    expect(dispute!.severity).toBe('moderate');
  });

  it('raiseDispute returns null for unknown', () => {
    expect(engine.raiseDispute('bad', 'u1', { reason: 'X', severity: 'minor' })).toBeNull();
  });

  it('aiSelfReview: error detected resolves immediately', () => {
    const decision = engine.recordDecision('user:1', 'factor_suggestion', {
      symbol: 'BABA', market: 'HK',
      input: {}, reasoning: 'Low PE suggests value',
    }, {
      result: 'Value factor',
      confidence: 0.6,
      alternatives: [],
      dataSources: ['fundamental'],
    });

    const dispute = engine.raiseDispute(decision.decisionId, 'user:1', {
      reason: 'BABA PE is misleading due to one-time items',
      severity: 'moderate',
    })!;

    const reviewed = engine.aiSelfReview(decision.decisionId, dispute.disputeId, {
      errorDetected: true,
      evaluation: 'Did not account for one-time items in PE calculation',
      confidenceAdjustment: -0.3,
      notes: 'PE should be recalculated excluding non-recurring items',
    });

    expect(reviewed).not.toBeNull();
    expect(reviewed!.status).toBe('resolved');
    expect(reviewed!.finalResolution!.resolution).toBe('ai_corrected');
  });

  it('aiSelfReview: no error → escalates to expert', () => {
    const decision = engine.recordDecision('user:1', 'backtest_interpretation', {
      symbol: 'SPY', market: 'US',
      input: {}, reasoning: 'Backtest shows 25% CAGR',
    }, {
      result: 'Strategy is robust',
      confidence: 0.8,
      alternatives: [],
      dataSources: ['backtest_data'],
    });

    const dispute = engine.raiseDispute(decision.decisionId, 'user:1', {
      reason: 'CAGR seems inflated due to look-ahead bias',
      severity: 'critical',
    })!;

    const reviewed = engine.aiSelfReview(decision.decisionId, dispute.disputeId, {
      errorDetected: false,
      evaluation: 'No look-ahead bias detected in backtest construction',
      confidenceAdjustment: 0,
      notes: 'Backtest uses walk-forward methodology',
    });

    expect(reviewed!.status).toBe('expert_review');
  });

  it('expertReview: agrees with AI → resolved', () => {
    const decision = engine.recordDecision('user:1', 'news_sentiment', {
      symbol: 'AAPL', market: 'US',
      input: {}, reasoning: 'Positive earnings report',
    }, {
      result: 'Bullish sentiment',
      confidence: 0.75,
      alternatives: ['Neutral'],
      dataSources: ['news_feed'],
    });

    const dispute = engine.raiseDispute(decision.decisionId, 'user:1', {
      reason: 'Sentiment analysis missed supply chain concerns',
      severity: 'minor',
    })!;
    engine.aiSelfReview(decision.decisionId, dispute.disputeId, {
      errorDetected: false, evaluation: 'X', confidenceAdjustment: 0, notes: 'N',
    });

    const resolved = engine.expertReview(decision.decisionId, dispute.disputeId, 'expert:1', {
      verdict: 'ai_correct',
      recommendation: 'AI sentiment is reasonable; supply chain impact is minimal',
    });

    expect(resolved!.status).toBe('resolved');
    expect(resolved!.finalResolution!.resolution).toBe('ai_upheld');
  });

  it('expertReview: agrees with user → resolved', () => {
    const decision = engine.recordDecision('user:1', 'price_move_attribution', {
      symbol: 'TSLA', market: 'US',
      input: {}, reasoning: 'Price drop attributed to delivery miss',
    }, {
      result: 'Negative attribution',
      confidence: 0.55,
      alternatives: ['Macro selloff'],
      dataSources: ['delivery_data'],
    });

    const dispute = engine.raiseDispute(decision.decisionId, 'user:1', {
      reason: 'Actually macro selloff, all EV stocks dropped',
      severity: 'moderate',
    })!;
    engine.aiSelfReview(decision.decisionId, dispute.disputeId, {
      errorDetected: false, evaluation: 'X', confidenceAdjustment: 0, notes: 'N',
    });

    const resolved = engine.expertReview(decision.decisionId, dispute.disputeId, 'expert:2', {
      verdict: 'user_correct',
      recommendation: 'User is correct - sector-wide drop confirms macro attribution',
    });

    expect(resolved!.status).toBe('resolved');
    expect(resolved!.finalResolution!.resolution).toBe('user_correct');
  });

  it('manualAdjudication finalizes unresolved disputes', () => {
    const decision = engine.recordDecision('user:1', 'parameter_tuning', {
      symbol: 'SPY', market: 'US',
      input: {}, reasoning: 'Optimal parameters found',
    }, {
      result: 'Stop loss at -8%',
      confidence: 0.7,
      alternatives: ['-5%', '-12%'],
      dataSources: ['optimization_data'],
    });

    const dispute = engine.raiseDispute(decision.decisionId, 'user:1', {
      reason: '-8% is too loose for current vol regime',
      severity: 'moderate',
    })!;
    engine.aiSelfReview(decision.decisionId, dispute.disputeId, {
      errorDetected: false, evaluation: 'X', confidenceAdjustment: 0, notes: 'N',
    });
    engine.expertReview(decision.decisionId, dispute.disputeId, 'expert:3', {
      verdict: 'escalate',
      recommendation: 'Needs senior analyst review',
    });

    const final = engine.manualAdjudication(decision.decisionId, dispute.disputeId, 'senior:1', {
      resolution: 'split_difference',
      explanation: 'Set stop loss at -6.5% with trailing adjustment',
    });

    expect(final!.status).toBe('resolved');
    expect(final!.finalResolution!.resolution).toBe('split_difference');
  });

  it('getUserDecisions filters by type', () => {
    engine.recordDecision('user:a', 'strategy_recommendation',
      { symbol: 'AAPL', market: 'US', input: {}, reasoning: 'R' },
      { result: 'T1', confidence: 0.8, alternatives: [], dataSources: [] },
    );
    engine.recordDecision('user:a', 'risk_warning',
      { symbol: 'TSLA', market: 'US', input: {}, reasoning: 'R' },
      { result: 'Warning', confidence: 0.7, alternatives: [], dataSources: [] },
    );

    const filtered = engine.getUserDecisions('user:a', { type: 'risk_warning' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].type).toBe('risk_warning');
  });

  it('getUserDecisions filters by disputes', () => {
    const d1 = engine.recordDecision('user:b', 'strategy_recommendation',
      { symbol: 'A', market: 'US', input: {}, reasoning: 'R' },
      { result: 'X', confidence: 0.8, alternatives: [], dataSources: [] },
    );
    engine.raiseDispute(d1.decisionId, 'user:b', { reason: 'R', severity: 'minor' });

    engine.recordDecision('user:b', 'risk_warning',
      { symbol: 'B', market: 'US', input: {}, reasoning: 'R' },
      { result: 'Y', confidence: 0.7, alternatives: [], dataSources: [] },
    );

    const disputed = engine.getUserDecisions('user:b', { hasDisputes: true });
    expect(disputed.length).toBe(1);
    expect(disputed[0].disputes.length).toBeGreaterThan(0);
  });

  it('getPendingDisputes returns unresolved', () => {
    const d1 = engine.recordDecision('user:c', 'strategy_recommendation',
      { symbol: 'A', market: 'US', input: {}, reasoning: 'R' },
      { result: 'X', confidence: 0.8, alternatives: [], dataSources: [] },
    );
    engine.raiseDispute(d1.decisionId, 'user:c', { reason: 'R', severity: 'minor' });

    const pending = engine.getPendingDisputes();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending[0].dispute.status).toBe('pending');
  });

  it('getFeedbackStats returns per-type breakdown', () => {
    engine.recordDecision('user:1', 'strategy_recommendation',
      { symbol: 'A', market: 'US', input: {}, reasoning: 'R' },
      { result: 'X', confidence: 0.8, alternatives: [], dataSources: [] },
    );
    engine.recordDecision('user:1', 'factor_suggestion',
      { symbol: 'B', market: 'US', input: {}, reasoning: 'R' },
      { result: 'Y', confidence: 0.7, alternatives: [], dataSources: [] },
    );

    const stats = engine.getFeedbackStats('user:1');
    expect(stats.totalDecisions).toBe(2);
    expect(stats.perType).toHaveProperty('strategy_recommendation');
    expect(stats.perType).toHaveProperty('factor_suggestion');
  });

  it('getLearningInsights returns seed insights', () => {
    const insights = engine.getLearningInsights();
    expect(insights.length).toBeGreaterThanOrEqual(1);
    expect(insights.every(i => i.pattern.length > 0)).toBe(true);
    expect(insights.every(i => i.descriptionCn.length > 0)).toBe(true);
  });

  it('generateInsight adds new insight', () => {
    const before = engine.getLearningInsights().length;
    engine.generateInsight(
      'test_pattern', 'Test description', '测试描述',
      ['evidence 1'], 'Suggestion', '建议', 0.8,
    );
    expect(engine.getLearningInsights().length).toBe(before + 1);
    expect(engine.getLearningInsights()[0].pattern).toBe('test_pattern');
  });

  it('exportAll returns all decisions', () => {
    engine.recordDecision('u1', 'strategy_recommendation',
      { symbol: 'A', market: 'US', input: {}, reasoning: 'R' },
      { result: 'X', confidence: 0.8, alternatives: [], dataSources: [] },
    );
    expect(engine.exportAll().length).toBe(1);
  });

  it('reset clears decisions and insights', () => {
    engine.recordDecision('u1', 'strategy_recommendation',
      { symbol: 'A', market: 'US', input: {}, reasoning: 'R' },
      { result: 'X', confidence: 0.8, alternatives: [], dataSources: [] },
    );
    engine.reset();

    expect(engine.exportAll().length).toBe(0);
    expect(engine.getLearningInsights().length).toBeGreaterThan(0); // seeds restored
  });

  it('confidence is between 0 and 1', () => {
    const d = engine.recordDecision('u1', 'strategy_recommendation',
      { symbol: 'A', market: 'US', input: {}, reasoning: 'R' },
      { result: 'X', confidence: 0.8, alternatives: [], dataSources: [] },
    );
    expect(d.output.confidence).toBeGreaterThanOrEqual(0);
    expect(d.output.confidence).toBeLessThanOrEqual(1);
  });
});
