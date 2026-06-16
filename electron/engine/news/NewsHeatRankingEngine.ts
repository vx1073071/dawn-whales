/**
 * P2-13 NewsHeatRankingEngine — News Heat Ranking Engine
 * R251 — P2 Deepening
 * JVS / 引擎虾
 *
 * Multi-source news heat scoring and ranking system. Aggregates news
 * articles from various sources, computes heat scores based on
 * recency/relevance/engagement/source-authority, tracks trending topics
 * (rising/falling), and emits heat alerts at configurable thresholds.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type NewsSource = 'bloomberg' | 'reuters' | 'cnbc' | 'wsj' | 'seeking_alpha' | 'benzinga' | 'twitter' | 'reddit' | 'yahoo_finance' | 'investing_com';

export type HeatTrend = 'rising' | 'hot' | 'cooling' | 'cold' | 'spiking';

export interface NewsArticle {
  id: string;
  symbol: string;
  source: NewsSource;
  title: string;
  url: string;
  publishedAt: number;
  sentiment: number; // -1 to 1
  engagement: number; // 0-100 (likes/shares/comments proxy)
  sourceAuthority: number; // 0-1
  category: string;
}

export interface HeatScore {
  symbol: string;
  score: number; // 0-100
  articleCount: number;
  avgSentiment: number; // -1 to 1
  topSources: NewsSource[];
  lastUpdated: number;
  trend: HeatTrend;
  previousScore?: number;
  momentum: number; // -100 to 100
}

export interface HeatRanking {
  timestamp: number;
  rankings: HeatScore[];
  topRising: HeatScore[];
  topFalling: HeatScore[];
  marketSentiment: number; // -1 to 1 overall
  alertCount: number;
}

export interface HeatAlert {
  id: string;
  symbol: string;
  threshold: number;
  currentScore: number;
  trend: HeatTrend;
  triggeredAt: number;
  message: string;
  acknowledged: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class NewsHeatRankingEngine {
  private static instance: NewsHeatRankingEngine;

  private articles: NewsArticle[] = [];
  private heatScores: Map<string, HeatScore[]> = new Map(); // symbol → history
  private rankings: HeatRanking[] = [];
  private alerts: HeatAlert[] = [];
  private thresholds: Map<string, number> = new Map(); // symbol → threshold
  private idCounter = 0;
  private alertIdCounter = 0;

  private constructor() {}

  static getInstance(): NewsHeatRankingEngine {
    if (!NewsHeatRankingEngine.instance) {
      NewsHeatRankingEngine.instance = new NewsHeatRankingEngine();
    }
    return NewsHeatRankingEngine.instance;
  }

  reset(): void {
    this.articles = [];
    this.heatScores.clear();
    this.rankings = [];
    this.alerts = [];
    this.thresholds.clear();
    this.idCounter = 0;
    this.alertIdCounter = 0;
  }

  private nextId(): string { return `nhr-${++this.idCounter}`; }
  private nextAlertId(): string { return `nhra-${++this.alertIdCounter}`; }

  // ═══════════════════════════════════════════════════════════════
  // Article Ingestion
  // ═══════════════════════════════════════════════════════════════

  ingestArticle(params: {
    symbol: string;
    source: NewsSource;
    title: string;
    url: string;
    publishedAt: number;
    sentiment: number;
    engagement: number;
    sourceAuthority: number;
    category?: string;
  }): NewsArticle {
    const article: NewsArticle = {
      id: this.nextId(),
      symbol: params.symbol.toUpperCase(),
      source: params.source,
      title: params.title,
      url: params.url,
      publishedAt: params.publishedAt,
      sentiment: Math.max(-1, Math.min(1, params.sentiment)),
      engagement: Math.max(0, Math.min(100, params.engagement)),
      sourceAuthority: Math.max(0, Math.min(1, params.sourceAuthority)),
      category: params.category || 'general',
    };
    this.articles.push(article);
    return article;
  }

  ingestBatch(articles: Array<{
    symbol: string; source: NewsSource; title: string; url: string;
    publishedAt: number; sentiment: number; engagement: number;
    sourceAuthority: number; category?: string;
  }>): NewsArticle[] {
    return articles.map(a => this.ingestArticle(a));
  }

  // ═══════════════════════════════════════════════════════════════
  // Heat Scoring
  // ═══════════════════════════════════════════════════════════════

  computeHeatScore(symbol: string, lookbackMs: number = 3600000): HeatScore {
    const now = Date.now();
    const cutoff = now - lookbackMs;

    const symArticles = this.articles.filter(
      a => a.symbol === symbol.toUpperCase() && a.publishedAt >= cutoff,
    );

    if (symArticles.length === 0) {
      const coldScore: HeatScore = {
        symbol: symbol.toUpperCase(), score: 0, articleCount: 0, avgSentiment: 0,
        topSources: [], lastUpdated: now, trend: 'cold', momentum: 0,
      };
      this.storeHeatScore(symbol, coldScore);
      return coldScore;
    }

    // Recency weight: newer = higher
    const recencyWeight = (publishedAt: number): number => {
      const age = now - publishedAt;
      if (age < 300000) return 1.0;        // < 5 min
      if (age < 900000) return 0.8;        // < 15 min
      if (age < 1800000) return 0.6;       // < 30 min
      if (age < 3600000) return 0.4;       // < 60 min
      return 0.2;                          // older
    };

    let weightedScore = 0;
    let totalWeight = 0;
    let totalSentiment = 0;

    const sourceCounts = new Map<NewsSource, number>();
    for (const article of symArticles) {
      const rw = recencyWeight(article.publishedAt);
      const articleScore = (
        rw * 0.3 +
        (article.engagement / 100) * 0.25 +
        article.sourceAuthority * 0.25 +
        (Math.abs(article.sentiment) * 0.2)
      ) * 100;

      weightedScore += articleScore * rw;
      totalWeight += rw;
      totalSentiment += article.sentiment;

      sourceCounts.set(article.source, (sourceCounts.get(article.source) || 0) + 1);
    }

    const avgScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight * 100) / 100 : 0;
    const avgSentiment = symArticles.length > 0
      ? Math.round(totalSentiment / symArticles.length * 100) / 100
      : 0;

    // Top sources by frequency
    const topSources = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([src]) => src);

    // Compute trend by comparing with previous score
    const previousHistory = this.heatScores.get(symbol.toUpperCase()) || [];
    const previousScore = previousHistory.length > 0
      ? previousHistory[previousHistory.length - 1]
      : undefined;

    let trend: HeatTrend;
    let momentum = 0;

    if (previousScore && previousScore.lastUpdated > now - 3600000) {
      momentum = Math.round((avgScore - previousScore.score) * 100) / 100;
      if (momentum > 20) trend = 'spiking';
      else if (momentum > 5) trend = 'rising';
      else if (momentum < -10) trend = 'cooling';
      else if (avgScore > 50 && previousScore.score > 50) trend = 'hot';
      else trend = 'cold';
    } else {
      trend = avgScore > 60 ? 'hot' : avgScore > 30 ? 'rising' : 'cold';
    }

    const heatScore: HeatScore = {
      symbol: symbol.toUpperCase(),
      score: Math.min(100, avgScore),
      articleCount: symArticles.length,
      avgSentiment,
      topSources,
      lastUpdated: now,
      trend,
      previousScore: previousScore?.score,
      momentum,
    };

    this.storeHeatScore(symbol, heatScore);
    return heatScore;
  }

  private storeHeatScore(symbol: string, score: HeatScore): void {
    const key = symbol.toUpperCase();
    if (!this.heatScores.has(key)) {
      this.heatScores.set(key, []);
    }
    this.heatScores.get(key)!.push(score);
  }

  // ═══════════════════════════════════════════════════════════════
  // Ranking (Main Entry)
  // ═══════════════════════════════════════════════════════════════

  rankAllSymbols(symbols?: string[]): HeatRanking {
    const now = Date.now();
    const symList = symbols || this.getActiveSymbols();

    const scores = symList.map(sym => this.computeHeatScore(sym));
    scores.sort((a, b) => b.score - a.score); // descending

    // Top rising
    const rising = scores
      .filter(s => s.trend === 'rising' || s.trend === 'spiking')
      .sort((a, b) => b.momentum - a.momentum)
      .slice(0, 5);

    // Top falling
    const falling = scores
      .filter(s => s.trend === 'cooling')
      .sort((a, b) => a.momentum - b.momentum)
      .slice(0, 5);

    // Market sentiment: weighted average
    const weightedScores = scores.filter(s => s.articleCount > 0);
    const marketSentiment = weightedScores.length > 0
      ? Math.round(weightedScores.reduce((s, sc) => s + sc.avgSentiment, 0) / weightedScores.length * 100) / 100
      : 0;

    // Check alerts
    const newAlerts = this.checkAlertThresholds(scores);

    const ranking: HeatRanking = {
      timestamp: now,
      rankings: scores,
      topRising: rising,
      topFalling: falling,
      marketSentiment,
      alertCount: newAlerts.length,
    };

    this.rankings.push(ranking);
    log.info(`[NewsHeat] Ranked ${scores.length} symbols: top=${scores[0]?.symbol || 'N/A'} (${scores[0]?.score || 0})`);
    return ranking;
  }

  private getActiveSymbols(): string[] {
    const syms = new Set<string>();
    for (const a of this.articles) syms.add(a.symbol);
    for (const [sym] of this.heatScores) syms.add(sym);
    return Array.from(syms);
  }

  // ═══════════════════════════════════════════════════════════════
  // Alerts
  // ═══════════════════════════════════════════════════════════════

  setHeatThreshold(symbol: string, threshold: number): void {
    this.thresholds.set(symbol.toUpperCase(), threshold);
  }

  private checkAlertThresholds(scores: HeatScore[]): HeatAlert[] {
    const newAlerts: HeatAlert[] = [];
    const now = Date.now();

    for (const score of scores) {
      const threshold = this.thresholds.get(score.symbol);
      if (threshold !== undefined && score.score >= threshold) {
        const alert: HeatAlert = {
          id: this.nextAlertId(),
          symbol: score.symbol,
          threshold,
          currentScore: score.score,
          trend: score.trend,
          triggeredAt: now,
          message: `${score.symbol} news heat alert: ${score.score} >= ${threshold}. Trend: ${score.trend}. Articles: ${score.articleCount}`,
          acknowledged: false,
        };
        this.alerts.push(alert);
        newAlerts.push(alert);
      }
    }

    return newAlerts;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  getUnacknowledgedAlerts(): HeatAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  // ═══════════════════════════════════════════════════════════════
  // Trending Topics
  // ═══════════════════════════════════════════════════════════════

  getTrendingTopics(): { symbol: string; trend: HeatTrend; momentum: number; topHeadlines: string[] }[] {
    const result: { symbol: string; trend: HeatTrend; momentum: number; topHeadlines: string[] }[] = [];

    for (const [sym, history] of this.heatScores) {
      if (history.length === 0) continue;
      const latest = history[history.length - 1];
      if (latest.trend === 'hot' || latest.trend === 'spiking' || latest.trend === 'rising') {
        const headlines = this.articles
          .filter(a => a.symbol === sym)
          .slice(-3)
          .map(a => a.title);
        result.push({ symbol: sym, trend: latest.trend, momentum: latest.momentum, topHeadlines: headlines });
      }
    }

    result.sort((a, b) => b.momentum - a.momentum);
    return result.slice(0, 10);
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  getLatestRanking(): HeatRanking | undefined {
    return this.rankings.length > 0 ? this.rankings[this.rankings.length - 1] : undefined;
  }

  getHeatHistory(symbol: string, limit?: number): HeatScore[] {
    const history = this.heatScores.get(symbol.toUpperCase()) || [];
    return limit ? history.slice(-limit) : [...history];
  }

  getArticles(symbol: string, limit?: number): NewsArticle[] {
    const symArticles = this.articles.filter(a => a.symbol === symbol.toUpperCase());
    symArticles.sort((a, b) => b.publishedAt - a.publishedAt);
    return limit ? symArticles.slice(0, limit) : symArticles;
  }

  getRankingHistory(limit?: number): HeatRanking[] {
    return this.rankings.slice(-(limit || 10));
  }

  // ═══════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════

  purgeOldArticles(olderThanMs: number = 86400000): number {
    const cutoff = Date.now() - olderThanMs;
    const before = this.articles.length;
    this.articles = this.articles.filter(a => a.publishedAt >= cutoff);
    const purged = before - this.articles.length;
    if (purged > 0) log.info(`[NewsHeat] Purged ${purged} old articles`);
    return purged;
  }
}
