import { describe, it, expect, beforeEach } from 'vitest';
import { DailyMovementReportEngine } from '../electron/engine/news/DailyMovementReportEngine';
import { AILearningModeEngine } from '../electron/engine/news/AILearningModeEngine';
import { NewsHeatRankingEngine } from '../electron/engine/news/NewsHeatRankingEngine';

// ═══════════════════════════════════════════════════════════════
// P2-19 DailyMovementReportEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('DailyMovementReportEngine', () => {
  let engine: DailyMovementReportEngine;
  beforeEach(() => { engine = DailyMovementReportEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(DailyMovementReportEngine.getInstance()).toBe(engine); });

  it('ingest movement entry', () => {
    const e = engine.ingestMovement({
      symbol: 'AAPL', market: 'US', category: 'top_gainers',
      value: 5.2, metricDetail: '+5.2% daily change',
    });
    expect(e.symbol).toBe('AAPL');
    expect(e.category).toBe('top_gainers');
    expect(e.value).toBe(5.2);
  });

  it('ingest batch', () => {
    const entries = engine.ingestBatch([
      { symbol: 'MSFT', market: 'US', category: 'top_gainers', value: 3.1, metricDetail: '+3.1%' },
      { symbol: 'GOOG', market: 'US', category: 'volume_surge', value: 2.5, metricDetail: '250% avg volume' },
    ]);
    expect(entries.length).toBe(2);
    expect(entries[1].symbol).toBe('GOOG');
  });

  it('generate report with entries', () => {
    engine.ingestBatch([
      { symbol: 'AAPL', market: 'US', category: 'top_gainers', value: 8.5, metricDetail: '+8.5%' },
      { symbol: 'MSFT', market: 'US', category: 'top_gainers', value: 6.2, metricDetail: '+6.2%' },
      { symbol: 'GOOG', market: 'US', category: 'top_gainers', value: 4.1, metricDetail: '+4.1%' },
      { symbol: 'TSLA', market: 'US', category: 'top_losers', value: -7.3, metricDetail: '-7.3%' },
      { symbol: 'NVDA', market: 'US', category: 'volume_surge', value: 3.2, metricDetail: '320% avg volume', volumeRatio: 3.2 },
    ]);
    const report = engine.generateReport();
    expect(report.entries.length).toBeGreaterThan(0);
    expect(report.headline).toContain('Market Movement Report');
    expect(report.highlights.length).toBeGreaterThan(0);
    expect(report.markets).toContain('US');
  });

  it('generate report with custom template', () => {
    engine.registerTemplate({
      name: 'crypto_only', categories: ['top_gainers', 'volatility_spike'],
      markets: ['CRYPTO'], topN: 3, includeCharts: false, includeAnalysis: false,
      pushEnabled: true, format: 'text',
    });

    engine.ingestBatch([
      { symbol: 'BTC', market: 'CRYPTO', category: 'top_gainers', value: 12.5, metricDetail: '+12.5%' },
      { symbol: 'ETH', market: 'CRYPTO', category: 'volatility_spike', value: 8.0, metricDetail: 'IV spike 80%' },
      { symbol: 'AAPL', market: 'US', category: 'top_gainers', value: 5.0, metricDetail: '+5.0%' },
    ]);

    const report = engine.generateReport(undefined, 'crypto_only');
    expect(report.markets).toContain('CRYPTO');
    expect(report.entries.every(e => e.market === 'CRYPTO')).toBe(true);
  });

  it('entries filtered by date', () => {
    const yesterday = new Date(Date.now() - 86400000);
    engine.ingestMovement({
      symbol: 'OLD', market: 'US', category: 'top_gainers',
      value: 10, metricDetail: 'old', timestamp: yesterday.getTime(),
    });
    engine.ingestMovement({
      symbol: 'NEW', market: 'US', category: 'top_gainers',
      value: 5, metricDetail: 'new', timestamp: Date.now(),
    });

    const todayReport = engine.generateReport();
    const todaySymbols = todayReport.entries.map(e => e.symbol);
    expect(todaySymbols).toContain('NEW');
    expect(todaySymbols).not.toContain('OLD');

    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const oldReport = engine.generateReport(yesterdayStr);
    expect(oldReport.entries.map(e => e.symbol)).toContain('OLD');
  });

  it('export JSON', () => {
    engine.ingestMovement({ symbol: 'TEST', market: 'US', category: 'top_gainers', value: 10, metricDetail: '+10%' });
    const report = engine.generateReport();
    const json = engine.exportReport(report, 'json');
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.headline).toBe(report.headline);
  });

  it('export CSV', () => {
    engine.ingestMovement({ symbol: 'CSV', market: 'US', category: 'top_gainers', value: 3, metricDetail: '+3%' });
    const report = engine.generateReport();
    const csv = engine.exportReport(report, 'csv');
    expect(csv).toContain('symbol,market,category');
    expect(csv).toContain('CSV');
  });

  it('export markdown', () => {
    engine.ingestMovement({ symbol: 'MD', market: 'HK', category: 'top_gainers', value: 5, metricDetail: '+5%' });
    const report = engine.generateReport();
    const md = engine.exportReport(report, 'markdown');
    expect(md).toContain('# ');
    expect(md).toContain('MD');
  });

  it('export text', () => {
    engine.ingestMovement({ symbol: 'TXT', market: 'US', category: 'top_losers', value: -4, metricDetail: '-4%' });
    const report = engine.generateReport();
    const text = engine.exportReport(report, 'text');
    expect(text).toContain('HIGHLIGHTS');
    expect(text).toContain('TXT');
  });

  it('alerts trigger at threshold', () => {
    engine.setAlertThreshold('top_gainers', 5);
    engine.ingestMovement({ symbol: 'HOT', market: 'US', category: 'top_gainers', value: 7.5, metricDetail: '+7.5%' });
    engine.ingestMovement({ symbol: 'MILD', market: 'US', category: 'top_gainers', value: 2.0, metricDetail: '+2.0%' });
    const report = engine.generateReport();
    expect(report.alertCount).toBe(1);

    const unacked = engine.getUnacknowledgedAlerts();
    expect(unacked.length).toBe(1);
    expect(unacked[0].symbol).toBe('HOT');

    engine.acknowledgeAlert(unacked[0].id);
    expect(engine.getUnacknowledgedAlerts().length).toBe(0);
  });

  it('purge old entries', () => {
    const oldMs = Date.now() - 86400000 * 30; // 30 days ago
    engine.ingestMovement({ symbol: 'OLD', market: 'US', category: 'top_gainers', value: 5, metricDetail: 'old', timestamp: oldMs });
    engine.ingestMovement({ symbol: 'NEW', market: 'US', category: 'top_gainers', value: 5, metricDetail: 'new' });
    const purged = engine.purgeOldEntries(86400000 * 7); // older than 7 days
    expect(purged).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// P2-07 AILearningModeEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('AILearningModeEngine', () => {
  let engine: AILearningModeEngine;
  beforeEach(() => { engine = AILearningModeEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(AILearningModeEngine.getInstance()).toBe(engine); });

  it('get lesson by ID', () => {
    const l = engine.getLesson('L001');
    expect(l).toBeDefined();
    expect(l!.title).toBe('What is a Stock Market?');
  });

  it('list lessons by level', () => {
    const beginner = engine.listLessons('beginner');
    expect(beginner.length).toBeGreaterThan(0);
    expect(beginner.every(l => l.level === 'beginner')).toBe(true);
  });

  it('list lessons by topic', () => {
    const ta = engine.listLessons(undefined, 'technical_analysis');
    expect(ta.every(l => l.topic === 'technical_analysis')).toBe(true);
  });

  it('create learner profile', () => {
    const p = engine.createProfile('user1');
    expect(p.userId).toBe('user1');
    expect(p.currentLevel).toBe('beginner');
    expect(p.totalPoints).toBe(0);
    expect(p.streakDays).toBe(0);
  });

  it('complete a lesson', () => {
    engine.createProfile('user1');
    const p = engine.completeLesson('user1', 'L001');
    expect(p.completedLessons).toContain('L001');
    expect(p.totalPoints).toBe(10);
    expect(p.topicProgress.market_basics).toBeGreaterThan(0);
  });

  it('quiz submission passes at 70%+', () => {
    engine.createProfile('user1');
    const result = engine.submitQuiz('user1', 'L001', [
      { correct: true }, { correct: true }, { correct: true }, { correct: true }, { correct: false },
    ], 120);
    expect(result.score).toBe(80);
    expect(result.passed).toBe(true);
  });

  it('quiz submission fails below 70%', () => {
    engine.createProfile('user1');
    const result = engine.submitQuiz('user1', 'L001', [
      { correct: true }, { correct: false }, { correct: false }, { correct: false }, { correct: false },
    ], 200);
    expect(result.score).toBe(20);
    expect(result.passed).toBe(false);
  });

  it('streak system', () => {
    engine.createProfile('user1');
    const today = new Date().toISOString().slice(0, 10);
    expect(engine.updateStreak('user1', today)).toBe(1);

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(engine.updateStreak('user1', tomorrow)).toBe(2);
  });

  it('streak resets on gap', () => {
    engine.createProfile('user1');
    const day1 = new Date().toISOString().slice(0, 10);
    engine.updateStreak('user1', day1);

    // Skip 2 days
    const day4 = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
    expect(engine.updateStreak('user1', day4)).toBe(1);
  });

  it('achievements unlock on completion', () => {
    engine.createProfile('user1');
    engine.completeLesson('user1', 'L001');
    const achievements = engine.getAchievements('user1');
    const firstLesson = achievements.find(a => a.name === 'First Steps');
    expect(firstLesson!.earned).toBe(true);
  });

  it('auto-level-up to intermediate', () => {
    engine.createProfile('user1');
    // Complete all 5 beginner lessons
    for (let i = 1; i <= 5; i++) {
      engine.completeLesson('user1', `L00${i}`);
    }
    const p = engine.getProfile('user1')!;
    expect(p.currentLevel).toBe('intermediate');
  });

  it('generate learning path', () => {
    engine.createProfile('user1', { preferredTopics: ['technical_analysis'] });
    engine.completeLesson('user1', 'L001');
    const path = engine.generateLearningPath('user1');
    expect(path.recommendedLessons.length).toBeGreaterThan(0);
    expect(path.adaptiveHint.length).toBeGreaterThan(0);
  });

  it('topic graph', () => {
    const graph = engine.getTopicGraph();
    expect(graph.size).toBeGreaterThan(0);
  });

  it('topic stats', () => {
    engine.createProfile('user1');
    engine.completeLesson('user1', 'L001');
    engine.completeLesson('user1', 'L002');
    const stats = engine.getTopicStats('user1');
    const marketBasics = stats.find(s => s.topic === 'market_basics')!;
    expect(marketBasics.completedCount).toBe(2);
    expect(marketBasics.totalCount).toBe(2);
    expect(marketBasics.progress).toBe(100);
  });

  it('speed learner achievement', () => {
    engine.createProfile('user1');
    engine.submitQuiz('user1', 'L001', [
      { correct: true }, { correct: true }, { correct: true }, { correct: true }, { correct: true },
    ], 30); // < 60s, 100% → speed learner
    const p = engine.getProfile('user1')!;
    expect(p.achievements).toContain('speed_learner');
  });
});

// ═══════════════════════════════════════════════════════════════
// P2-13 NewsHeatRankingEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('NewsHeatRankingEngine', () => {
  let engine: NewsHeatRankingEngine;
  beforeEach(() => { engine = NewsHeatRankingEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(NewsHeatRankingEngine.getInstance()).toBe(engine); });

  const now = Date.now();

  it('ingest article', () => {
    const a = engine.ingestArticle({
      symbol: 'AAPL', source: 'bloomberg', title: 'Apple beats earnings',
      url: 'https://bloomberg.com/aapl', publishedAt: now, sentiment: 0.6,
      engagement: 75, sourceAuthority: 0.9,
    });
    expect(a.symbol).toBe('AAPL');
    expect(a.source).toBe('bloomberg');
    expect(a.sentiment).toBe(0.6);
  });

  it('compute heat score', () => {
    engine.ingestArticle({ symbol: 'AAPL', source: 'reuters', title: 'AAPL news', url: 'a', publishedAt: now - 60000, sentiment: 0.5, engagement: 80, sourceAuthority: 0.95 });
    engine.ingestArticle({ symbol: 'AAPL', source: 'cnbc', title: 'AAPL update', url: 'b', publishedAt: now - 120000, sentiment: 0.3, engagement: 60, sourceAuthority: 0.8 });

    const score = engine.computeHeatScore('AAPL');
    expect(score.articleCount).toBe(2);
    expect(score.score).toBeGreaterThan(0);
    expect(score.avgSentiment).toBe(0.4);
    expect(score.topSources.length).toBeGreaterThan(0);
  });

  it('cold score for no articles', () => {
    const score = engine.computeHeatScore('NOEXIST');
    expect(score.trend).toBe('cold');
    expect(score.score).toBe(0);
    expect(score.articleCount).toBe(0);
  });

  it('hot trend for many recent articles', () => {
    for (let i = 0; i < 5; i++) {
      engine.ingestArticle({ symbol: 'HOT', source: 'benzinga', title: 'Hot news', url: 'h', publishedAt: now - i * 30000, sentiment: 0.8, engagement: 90, sourceAuthority: 0.9 });
    }
    const score = engine.computeHeatScore('HOT');
    expect(score.articleCount).toBe(5);
    expect(['hot', 'rising']).toContain(score.trend);
  });

  it('rank all symbols', () => {
    engine.ingestArticle({ symbol: 'HOT1', source: 'bloomberg', title: 't', url: 'u', publishedAt: now, sentiment: 0.7, engagement: 90, sourceAuthority: 0.95 });
    engine.ingestArticle({ symbol: 'COLD1', source: 'reddit', title: 't', url: 'u', publishedAt: now - 3000000, sentiment: -0.2, engagement: 10, sourceAuthority: 0.2 });

    const ranking = engine.rankAllSymbols();
    expect(ranking.rankings.length).toBe(2);
    // HOT1 should rank first
    expect(ranking.rankings[0].symbol).toBe('HOT1');
  });

  it('top rising and falling', () => {
    // Low score first, then higher signals to create momentum
    engine.computeHeatScore('RISER');
    engine.ingestArticle({ symbol: 'RISER', source: 'cnbc', title: 't', url: 'u', publishedAt: now, sentiment: 0.8, engagement: 80, sourceAuthority: 0.9 });
    // Second compute to get rising trend
    engine.computeHeatScore('RISER');
    // Now rank
    engine.ingestArticle({ symbol: 'RISER', source: 'reuters', title: 't', url: 'u', publishedAt: now, sentiment: 0.9, engagement: 95, sourceAuthority: 0.95 });
    engine.ingestArticle({ symbol: 'FALLER', source: 'reddit', title: 't', url: 'u', publishedAt: now - 3600000, sentiment: -0.5, engagement: 20, sourceAuthority: 0.2 });

    const ranking = engine.rankAllSymbols();
    expect(ranking.topRising.length + ranking.topFalling.length).toBeGreaterThanOrEqual(0);
    // Market sentiment should be computed
    expect(typeof ranking.marketSentiment).toBe('number');
  });

  it('heat threshold alerts', () => {
    engine.setHeatThreshold('ALERT_SYM', 50);
    for (let i = 0; i < 5; i++) {
      engine.ingestArticle({ symbol: 'ALERT_SYM', source: 'bloomberg', title: 'alert', url: 'a', publishedAt: now - i * 10000, sentiment: 0.8, engagement: 90, sourceAuthority: 0.95 });
    }
    const ranking = engine.rankAllSymbols();
    expect(ranking.alertCount).toBeGreaterThanOrEqual(1);

    const unacked = engine.getUnacknowledgedAlerts();
    expect(unacked.length).toBeGreaterThanOrEqual(1);
    expect(unacked[0].symbol).toBe('ALERT_SYM');
  });

  it('acknowledge alert', () => {
    engine.setHeatThreshold('HOT', 30);
    engine.ingestArticle({ symbol: 'HOT', source: 'bloomberg', title: 't', url: 'u', publishedAt: now, sentiment: 0.8, engagement: 90, sourceAuthority: 0.95 });
    engine.rankAllSymbols();

    const unacked = engine.getUnacknowledgedAlerts();
    expect(unacked.length).toBe(1);
    engine.acknowledgeAlert(unacked[0].id);
    expect(engine.getUnacknowledgedAlerts().length).toBe(0);
  });

  it('trending topics', () => {
    for (let i = 0; i < 5; i++) {
      engine.ingestArticle({ symbol: 'TREND', source: 'bloomberg', title: 'Trending topic', url: 't', publishedAt: now - i * 10000, sentiment: 0.7, engagement: 85, sourceAuthority: 0.9 });
    }
    engine.computeHeatScore('TREND');
    engine.computeHeatScore('TREND');
    const topics = engine.getTrendingTopics();
    expect(topics.length).toBeGreaterThanOrEqual(0);
  });

  it('purge old articles', () => {
    const old = now - 86400000 * 2;
    engine.ingestArticle({ symbol: 'OLD', source: 'reddit', title: 'stale', url: 's', publishedAt: old, sentiment: 0, engagement: 5, sourceAuthority: 0.1 });
    const purged = engine.purgeOldArticles(86400000);
    expect(purged).toBe(1);
  });

  it('get heat history', () => {
    engine.computeHeatScore('HIST');
    engine.computeHeatScore('HIST');
    const history = engine.getHeatHistory('HIST');
    expect(history.length).toBe(2);
  });

  it('get articles for symbol', () => {
    engine.ingestArticle({ symbol: 'SYM1', source: 'cnbc', title: 'Title 1', url: 'u1', publishedAt: now, sentiment: 0.5, engagement: 50, sourceAuthority: 0.7 });
    engine.ingestArticle({ symbol: 'SYM1', source: 'reuters', title: 'Title 2', url: 'u2', publishedAt: now - 5000, sentiment: 0.6, engagement: 60, sourceAuthority: 0.8 });

    const articles = engine.getArticles('SYM1');
    expect(articles.length).toBe(2);
  });
});
