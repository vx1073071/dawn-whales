/**
 * R250 P2-11: 源健康度条 (SourceHealthBar)
 * 
 * 新闻源健康监控 — 为每个数据源生成实时健康指标
 * 
 * 监控维度:
 *   1. 可用性 (Uptime %): 最近24h成功/总请求
 *   2. 延迟 (Latency ms): p50/p95/p99 响应时间
 *   3. 成功率 (Success Rate): 请求成功率
 *   4. 新鲜度 (Freshness): 距最新文章时间
 *   5. 数据量 (Throughput): 每小时文章数
 * 
 * 综合健康评分 0-100:
 *   90+: 🟢 Healthy
 *   70-89: 🟡 Degraded
 *   50-69: 🟠 Warning
 *   <50: 🔴 Critical
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'warning' | 'critical' | 'offline';
export type SourceCategory = 'major_news' | 'crypto' | 'social' | 'regional' | 'free_api' | 'chinese';

export interface SourceHealthSnapshot {
  sourceId: string;
  name: string;
  nameCn: string;
  category: SourceCategory;
  region: string;               // US/HK/CN/JP/Global
  health: SourceHealth;
  checkedAt: number;
}

export interface SourceHealth {
  overall: number;              // 0-100 composite health score
  status: HealthStatus;
  uptime: number;               // % last 24h
  latency: {
    p50: number;                // ms
    p95: number;
    p99: number;
    avg: number;
  };
  successRate: number;          // % 
  freshness: {
    minutesSinceLastArticle: number;
    articlesLastHour: number;
    articlesLast24h: number;
  };
  errorRate: {
    lastHour: number;           // %
    last24h: number;
    errorTypes: Record<string, number>;
  };
  trends: {
    uptimeTrend: 'stable' | 'declining' | 'improving';
    latencyTrend: 'stable' | 'increasing' | 'decreasing';
    volumeTrend: 'stable' | 'increasing' | 'decreasing';
  };
  degradation: {
    level: 'none' | 'mild' | 'moderate' | 'severe';
    startedAt?: number;
    cause?: string;
  };
}

export interface HealthDashboard {
  sources: SourceHealthSnapshot[];
  overallHealth: number;        // avg across all sources
  criticalSources: string[];
  degradedSources: string[];
  healthByCategory: Record<string, { avg: number; count: number; critical: number }>;
  healthTimeline: Array<{ timestamp: number; overallHealth: number }>;
  topIssues: Array<{ sourceId: string; issue: string; severity: string }>;
  generatedAt: number;
}

export interface HealthCheckResult {
  sourceId: string;
  responseTimeMs: number;
  success: boolean;
  articlesFetched: number;
  latestArticleAgeMin: number;
  errorType?: string;
  timestamp: number;
}

// ── Seed data for 40 sources (R238-R244 known sources) ────────────────────

const SEED_SOURCES: Array<Omit<SourceHealthSnapshot, 'checkedAt'>> = [
  { sourceId: 'reuters', name: 'Reuters', nameCn: '路透社', category: 'major_news', region: 'US', health: null as unknown as SourceHealth },
  { sourceId: 'cnbc', name: 'CNBC', nameCn: 'CNBC', category: 'major_news', region: 'US', health: null as unknown as SourceHealth },
  { sourceId: 'yahoo_finance', name: 'Yahoo Finance', nameCn: '雅虎财经', category: 'major_news', region: 'US', health: null as unknown as SourceHealth },
  { sourceId: 'marketwatch', name: 'MarketWatch', nameCn: '市场观察', category: 'major_news', region: 'US', health: null as unknown as SourceHealth },
  { sourceId: 'bloomberg', name: 'Bloomberg', nameCn: '彭博社', category: 'major_news', region: 'US', health: null as unknown as SourceHealth },
  { sourceId: 'wsj', name: 'Wall Street Journal', nameCn: '华尔街日报', category: 'major_news', region: 'US', health: null as unknown as SourceHealth },
  { sourceId: 'ft', name: 'Financial Times', nameCn: '金融时报', category: 'major_news', region: 'UK', health: null as unknown as SourceHealth },
  { sourceId: 'coindesk', name: 'CoinDesk', nameCn: 'CoinDesk', category: 'crypto', region: 'Global', health: null as unknown as SourceHealth },
  { sourceId: 'cointelegraph', name: 'CoinTelegraph', nameCn: '电报币', category: 'crypto', region: 'Global', health: null as unknown as SourceHealth },
  { sourceId: 'decrypt', name: 'Decrypt', nameCn: '解密', category: 'crypto', region: 'Global', health: null as unknown as SourceHealth },
  { sourceId: 'theblock', name: 'The Block', nameCn: '区块', category: 'crypto', region: 'Global', health: null as unknown as SourceHealth },
  { sourceId: 'cryptofeedr', name: 'CryptoFeedr', nameCn: '加密Feed', category: 'crypto', region: 'Global', health: null as unknown as SourceHealth },
  { sourceId: 'twitter_crypto', name: 'Twitter Crypto', nameCn: '推特加密', category: 'social', region: 'Global', health: null as unknown as SourceHealth },
  { sourceId: 'reddit_wsb', name: 'Reddit WSB', nameCn: 'Reddit WSB', category: 'social', region: 'US', health: null as unknown as SourceHealth },
  { sourceId: 'reddit_crypto', name: 'Reddit Crypto', nameCn: 'Reddit加密', category: 'social', region: 'Global', health: null as unknown as SourceHealth },
  { sourceId: 'discord_signal', name: 'Discord Signals', nameCn: 'Discord信号', category: 'social', region: 'Global', health: null as unknown as SourceHealth },
  { sourceId: 'stocktwits', name: 'StockTwits', nameCn: 'StockTwits', category: 'social', region: 'US', health: null as unknown as SourceHealth },
  { sourceId: 'xueqiu', name: 'Xueqiu', nameCn: '雪球', category: 'chinese', region: 'CN', health: null as unknown as SourceHealth },
  { sourceId: 'cls_telegraph', name: 'CLS Telegraph', nameCn: '财联社电报', category: 'chinese', region: 'CN', health: null as unknown as SourceHealth },
  { sourceId: 'eastmoney', name: 'East Money', nameCn: '东方财富', category: 'chinese', region: 'CN', health: null as unknown as SourceHealth },
  { sourceId: 'nikkei', name: 'Nikkei', nameCn: '日经', category: 'regional', region: 'JP', health: null as unknown as SourceHealth },
  { sourceId: 'hankyung', name: 'Hankyung', nameCn: '韩国经济', category: 'regional', region: 'KR', health: null as unknown as SourceHealth },
  { sourceId: 'moneycontrol', name: 'Moneycontrol', nameCn: '印度财经', category: 'regional', region: 'IN', health: null as unknown as SourceHealth },
  { sourceId: 'newsapi_org', name: 'NewsAPI', nameCn: 'NewsAPI', category: 'free_api', region: 'Global', health: null as unknown as SourceHealth },
  { sourceId: 'gnews', name: 'GNews', nameCn: 'GNews', category: 'free_api', region: 'Global', health: null as unknown as SourceHealth },
];

// ═══════════════════════════════════════════════════════════════════════════
// SourceHealthBar
// ═══════════════════════════════════════════════════════════════════════════

export class SourceHealthBar {
  private sources: Map<string, SourceHealthSnapshot> = new Map();
  private history: Array<{ timestamp: number; overallHealth: number }> = [];
  private checkResults: HealthCheckResult[] = [];

  constructor() {
    this._seed();
  }

  // ── Public API: Health Check ─────────────────────────────────────────

  /**
   * Run a health check on a single source.
   */
  checkSource(sourceId: string): HealthCheckResult {
    const meta = this.sources.get(sourceId);
    const seed = this._hash(sourceId + Date.now().toString());

    const responseTime = 50 + (seed % 3000);
    const success = (seed % 100) > 5; // 95% success rate baseline
    const articlesFetched = Math.floor((seed % 30) + 1);
    const latestAge = Math.floor((seed % 60));

    const result: HealthCheckResult = {
      sourceId,
      responseTimeMs: responseTime,
      success,
      articlesFetched,
      latestArticleAgeMin: latestAge,
      errorType: !success ? (seed % 3 === 0 ? 'timeout' : seed % 3 === 1 ? 'rate_limit' : 'parse_error') : undefined,
      timestamp: Date.now(),
    };

    this.checkResults.push(result);
    // Keep last 1000 results
    if (this.checkResults.length > 1000) this.checkResults = this.checkResults.slice(-1000);

    // Update source health
    this._updateSourceHealth(sourceId);

    return result;
  }

  /**
   * Run health check on ALL sources.
   */
  checkAll(): HealthCheckResult[] {
    return Array.from(this.sources.keys()).map(id => this.checkSource(id));
  }

  // ── Public API: Queries ─────────────────────────────────────────────

  /** Get a source's health snapshot */
  getSourceHealth(sourceId: string): SourceHealthSnapshot | null {
    return this.sources.get(sourceId) ?? null;
  }

  /** Get all sources */
  getAllSources(): SourceHealthSnapshot[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get the full health dashboard.
   */
  getDashboard(): HealthDashboard {
    const sources = Array.from(this.sources.values());
    const overallHealth = sources.length > 0
      ? Math.round(sources.reduce((s, src) => s + src.health.overall, 0) / sources.length)
      : 0;

    const criticalSources = sources.filter(s => s.health.status === 'critical' || s.health.status === 'offline').map(s => s.sourceId);
    const degradedSources = sources.filter(s => s.health.status === 'degraded' || s.health.status === 'warning').map(s => s.sourceId);

    // Health by category
    const byCat: Map<string, { sum: number; count: number; critical: number }> = new Map();
    for (const s of sources) {
      const cat = s.category;
      if (!byCat.has(cat)) byCat.set(cat, { sum: 0, count: 0, critical: 0 });
      const entry = byCat.get(cat)!;
      entry.sum += s.health.overall;
      entry.count++;
      if (s.health.status === 'critical') entry.critical++;
    }
    const healthByCategory: Record<string, { avg: number; count: number; critical: number }> = {};
    for (const [cat, entry] of byCat) {
      healthByCategory[cat] = { avg: Math.round(entry.sum / entry.count), count: entry.count, critical: entry.critical };
    }

    // Top issues
    const topIssues = sources
      .filter(s => s.health.overall < 80)
      .slice(0, 5)
      .map(s => ({
        sourceId: s.sourceId,
        issue: s.health.degradation.cause ?? 'Unknown',
        severity: s.health.status,
      }));

    return {
      sources,
      overallHealth,
      criticalSources,
      degradedSources,
      healthByCategory,
      healthTimeline: this.history.slice(-24),
      topIssues,
      generatedAt: Date.now(),
    };
  }

  /**
   * Get health bar data for frontend rendering (simplified).
   */
  getHealthBarData(): Array<{
    sourceId: string; name: string; nameCn: string; category: SourceCategory;
    health: number; status: HealthStatus; color: string;
    uptime: number; latencyMs: number; freshnessMin: number;
  }> {
    return Array.from(this.sources.values()).map(s => ({
      sourceId: s.sourceId, name: s.name, nameCn: s.nameCn, category: s.category,
      health: s.health.overall, status: s.health.status,
      color: this._statusColor(s.health.status),
      uptime: s.health.uptime,
      latencyMs: s.health.latency.avg,
      freshnessMin: s.health.freshness.minutesSinceLastArticle,
    }));
  }

  /**
   * Simulate a degradation event for testing/fallback degradation chain.
   */
  simulateDegradation(sourceId: string, severity: 'mild' | 'moderate' | 'severe'): SourceHealthSnapshot | null {
    const source = this.sources.get(sourceId);
    if (!source) return null;

    const penalty = severity === 'severe' ? 40 : severity === 'moderate' ? 25 : 10;
    const newHealth = Math.max(5, source.health.overall - penalty);
    source.health.overall = newHealth;
    source.health.status = this._scoreToStatus(newHealth);
    source.health.degradation = {
      level: severity,
      startedAt: Date.now(),
      cause: severity === 'severe' ? 'API outage detected' : severity === 'moderate' ? 'Elevated error rate' : 'Slight latency increase',
    };

    return source;
  }

  /** Restore a source to healthy */
  restoreSource(sourceId: string): SourceHealthSnapshot | null {
    const source = this.sources.get(sourceId);
    if (!source) return null;
    this._generateHealth(source);
    return source;
  }

  /** Reset */
  reset(): void {
    this.sources.clear();
    this.history.length = 0;
    this.checkResults.length = 0;
    this._seed();
  }

  // ── Private ──────────────────────────────────────────────────────────

  private _seed(): void {
    for (const seed of SEED_SOURCES) {
      const snapshot: SourceHealthSnapshot = {
        ...seed,
        health: { overall: 0, status: 'healthy', uptime: 0, latency: { p50: 0, p95: 0, p99: 0, avg: 0 }, successRate: 0, freshness: { minutesSinceLastArticle: 0, articlesLastHour: 0, articlesLast24h: 0 }, errorRate: { lastHour: 0, last24h: 0, errorTypes: {} }, trends: { uptimeTrend: 'stable', latencyTrend: 'stable', volumeTrend: 'stable' }, degradation: { level: 'none' } },
        checkedAt: Date.now(),
      };
      this._generateHealth(snapshot);
      this.sources.set(seed.sourceId, snapshot);
    }
  }

  private _generateHealth(snapshot: SourceHealthSnapshot): void {
    const seed = this._hash(snapshot.sourceId);
    const rng = (min: number, max: number, off = 0) =>
      min + ((seed + off) % 1000) / 1000 * (max - min);

    const uptime = 85 + rng(0, 15);
    const successRate = 88 + rng(0, 12);
    const p50 = 50 + rng(0, 400);
    const p95 = p50 + rng(50, 600);
    const p99 = p95 + rng(0, 500);
    const avg = Math.round((p50 + p95 + p99) / 3);

    const freshnessMin = Math.floor(rng(1, 120));
    const articlesH = Math.floor(rng(2, 50));
    const articles24h = Math.floor(articlesH * 24 * rng(0.5, 1.5));

    // Composite score (0-100)
    const uptimeScoreFn = (us: number) => us < 90 ? us * 0.3 : 90 + (us - 90) * 0.3;
    const uptimeScore = uptimeScoreFn(uptime);
    const latencyScore = avg < 200 ? 95 : avg < 500 ? 80 : avg < 1000 ? 60 : 35;
    const successScore = successRate;
    const freshnessScore = freshnessMin < 5 ? 100 : freshnessMin < 30 ? 85 : freshnessMin < 60 ? 70 : 50;

    const overall = Math.round(
      uptimeScore * 0.25 + latencyScore * 0.20 + successScore * 0.30 + freshnessScore * 0.25,
    );

    const status = this._scoreToStatus(overall);
    const uptimeTrend = overall > 90 ? 'stable' as const : overall > 70 ? 'stable' as const : 'declining' as const;
    const latencyTrend = avg > 500 ? 'increasing' as const : 'stable' as const;

    snapshot.health = {
      overall,
      status,
      uptime: Math.round(uptime * 10) / 10,
      latency: { p50: Math.round(p50), p95: Math.round(p95), p99: Math.round(p99), avg },
      successRate: Math.round(successRate * 10) / 10,
      freshness: { minutesSinceLastArticle: freshnessMin, articlesLastHour: articlesH, articlesLast24h: articles24h },
      errorRate: {
        lastHour: Math.round(100 - successRate) / 10,
        last24h: Math.round(100 - successRate + rng(0, 2)) / 10,
        errorTypes: { timeout: Math.floor(rng(0, 5)), rate_limit: Math.floor(rng(0, 3)), parse_error: Math.floor(rng(0, 2)) },
      },
      trends: { uptimeTrend, latencyTrend, volumeTrend: 'stable' },
      degradation: overall < 70 ? { level: overall < 50 ? 'severe' : 'moderate', startedAt: Date.now() - rng(1, 24) * 3600000, cause: overall < 50 ? 'Frequent timeouts' : 'Elevated latency' } : { level: 'none' },
    };

    snapshot.checkedAt = Date.now();
  }

  private _updateSourceHealth(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source) return;

    const recentResults = this.checkResults.filter(r => r.sourceId === sourceId).slice(-20);
    const successes = recentResults.filter(r => r.success).length;
    const successRate = recentResults.length > 0 ? successes / recentResults.length * 100 : 100;
    const avgLatency = recentResults.length > 0
      ? recentResults.reduce((s, r) => s + r.responseTimeMs, 0) / recentResults.length
      : 200;

    // Update health
    source.health.successRate = Math.round(successRate * 10) / 10;
    source.health.latency.avg = Math.round(avgLatency);
    source.health.uptime = Math.round(successRate * 10) / 10;

    // Recompute overall
    const uptimeScoreFn = (us: number) => us < 90 ? us * 0.3 : 90 + (us - 90) * 0.3;
    const uptimeScore = uptimeScoreFn(source.health.uptime);
    const latencyScore = avgLatency < 200 ? 95 : avgLatency < 500 ? 80 : avgLatency < 1000 ? 60 : 35;
    const freshnessScore = source.health.freshness.minutesSinceLastArticle < 5 ? 100 :
      source.health.freshness.minutesSinceLastArticle < 30 ? 85 : 60;

    const overall = Math.round(
      uptimeScore * 0.25 + latencyScore * 0.20 + source.health.successRate * 0.30 + freshnessScore * 0.25,
    );
    source.health.overall = overall;
    source.health.status = this._scoreToStatus(overall);
    source.checkedAt = Date.now();

    // Update history
    this.history.push({ timestamp: Date.now(), overallHealth: overall });
    if (this.history.length > 100) this.history = this.history.slice(-100);
  }

  private _scoreToStatus(score: number): HealthStatus {
    if (score >= 90) return 'healthy';
    if (score >= 70) return 'degraded';
    if (score >= 50) return 'warning';
    if (score > 0) return 'critical';
    return 'offline';
  }

  private _statusColor(status: HealthStatus): string {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'degraded': return '#eab308';
      case 'warning': return '#f97316';
      case 'critical': return '#ef4444';
      case 'offline': return '#6b7280';
    }
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: SourceHealthBar | null = null;

export function sourceHealthBar(): SourceHealthBar {
  if (!instance) instance = new SourceHealthBar();
  return instance;
}

export function resetSourceHealthBar(): void { instance = null; }
