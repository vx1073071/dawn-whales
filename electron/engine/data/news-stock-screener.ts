/**
 * R240-auto#1: 新闻选股器 (News Stock Screener)
 *
 * 基于情绪趋势+成交量+新闻量的组合条件筛选引擎。
 *
 * 条件:
 *   - 情绪信号: N天内情绪连续改善(score持续上升) / 情绪反转(score<thr→thr) / 情绪强度(avg>thr)
 *   - 成交量信号: N天成交量增幅>thr / 今日成交量>N日均量×factor
 *   - 新闻量信号: N天内新闻量增幅>thr / 今日新闻数>N日均新闻×factor
 *   - 综合筛选: 以上任意组合 AND/OR
 *
 * 输出:
 *   - 符合条件的股票列表, 按综合评分排序
 *   - 每只股票: signals明细, 置信度, 建议操作
 *
 * 成本: 免费功能 (无AI调用, 纯数据计算)
 */

import type { NewsItem, SentimentResult } from './news-types';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface SentimentSnapshot {
  ticker: string;
  date: number;       // Day timestamp (midnight)
  avgScore: number;   // Average sentiment score for the day
  newsCount: number;  // Number of news articles for the day
  volume?: number;    // Trading volume (optional, from external data)
  volatility?: number; // Price volatility % (optional)
}

export interface ScreenerCondition {
  type: 'sentiment_improving' | 'sentiment_reversal' | 'sentiment_strength'
    | 'volume_surge' | 'news_surge' | 'multi_factor';
  params: Record<string, number>; // e.g., { days: 5, threshold: 0.3 }
}

export interface ScreenerPreset {
  name: string;
  description: string;
  conditions: ScreenerCondition[];
  logic: 'AND' | 'OR';
}

export interface ScreenerResult {
  ticker: string;
  name?: string;
  score: number;               // Composite score 0-100
  confidence: number;           // 0-1
  matchedConditions: string[];  // Which conditions triggered
  signals: {
    sentimentTrend: 'improving' | 'stable' | 'declining' | 'unknown';
    sentimentAvg: number;
    volumeChange: number;       // % change
    newsCount: number;
    newsTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  };
  suggestion: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'WATCH' | 'CAUTION';
  recentNews: string[];        // Headlines, max 3
}

export interface ScreenerConfig {
  presets: ScreenerPreset[];
  defaultSort: 'score' | 'sentiment' | 'volume' | 'newsCount';
  maxResults: number;
  minNewsToEvaluate: number;   // Skip tickers with fewer than N news items
  lookbackDays: number;        // Max days to look back
}

// ═══════════════════════════════════════════════════════════════════════
// Default Presets
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_PRESETS: ScreenerPreset[] = [
  {
    name: '情绪改善选股',
    description: '最近3天情绪持续改善，成交量放大，新闻关注度上升',
    conditions: [
      { type: 'sentiment_improving', params: { days: 3, min_change: 0.2 } },
      { type: 'news_surge', params: { days: 3, multiplier: 1.5 } },
    ],
    logic: 'AND',
  },
  {
    name: '情绪反转捕捉',
    description: '昨日情绪<0，今日情绪>0.2，底部反转信号',
    conditions: [
      { type: 'sentiment_reversal', params: { days: 2, from_threshold: -0.1, to_threshold: 0.1 } },
      { type: 'volume_surge', params: { days: 1, multiplier: 2.0 } },
    ],
    logic: 'AND',
  },
  {
    name: '高关注度股票',
    description: '近5天新闻量>平均水平2倍，情绪中性偏多',
    conditions: [
      { type: 'news_surge', params: { days: 5, multiplier: 2.0 } },
      { type: 'sentiment_strength', params: { days: 5, min_score: 0.2 } },
    ],
    logic: 'AND',
  },
  {
    name: '海量新闻预警',
    description: '今日新闻量暴增(>5日均量3倍)，可能是重大事件',
    conditions: [
      { type: 'news_surge', params: { days: 5, multiplier: 3.0 } },
    ],
    logic: 'AND',
  },
  {
    name: '情绪+成交量共振',
    description: '情绪偏多+成交量放大，经典做多信号',
    conditions: [
      { type: 'sentiment_strength', params: { days: 3, min_score: 0.3 } },
      { type: 'volume_surge', params: { days: 3, multiplier: 1.5 } },
    ],
    logic: 'AND',
  },
];

const DEFAULT_CONFIG: ScreenerConfig = {
  presets: DEFAULT_PRESETS,
  defaultSort: 'score',
  maxResults: 50,
  minNewsToEvaluate: 3,
  lookbackDays: 30,
};

// ═══════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════

export class NewsStockScreener {
  private history = new Map<string, SentimentSnapshot[]>();
  private config: ScreenerConfig;

  constructor(config?: Partial<ScreenerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 摄入新闻数据并更新内部日度快照
   */
  ingest(news: NewsItem[]): void {
    // Group by ticker and date
    const grouped = new Map<string, Map<number, { scores: number[]; count: number }>>();

    for (const item of news) {
      const tickers = item.tickers || [];
      if (tickers.length === 0) continue;

      const date = this.dayTruncate(item.publishedAt);
      const score = item.sentiment?.score ?? 0;

      for (const ticker of tickers) {
        if (!grouped.has(ticker)) grouped.set(ticker, new Map());
        const dayMap = grouped.get(ticker)!;
        if (!dayMap.has(date)) dayMap.set(date, { scores: [], count: 0 });
        const day = dayMap.get(date)!;
        day.scores.push(score);
        day.count++;
      }
    }

    // Convert to snapshots
    for (const [ticker, dayMap] of grouped) {
      const snapshots: SentimentSnapshot[] = [];
      for (const [date, day] of dayMap) {
        snapshots.push({
          ticker,
          date,
          avgScore: day.scores.reduce((a, b) => a + b, 0) / day.scores.length,
          newsCount: day.count,
          volatility: undefined, // External data required
        });
      }
      snapshots.sort((a, b) => a.date - b.date);

      // Merge with existing history
      const existing = this.history.get(ticker) || [];
      const merged = this.mergeSnapshots(existing, snapshots);

      // Prune old data
      const cutoff = this.dayTruncate(Date.now()) - this.config.lookbackDays * 86400000;
      this.history.set(ticker, merged.filter(s => s.date >= cutoff));
    }
  }

  /**
   * 设置交易量数据 (来自外部市场数据)
   */
  setVolumeData(data: Array<{ ticker: string; date: number; volume: number }>): void {
    for (const row of data) {
      const snapshots = this.history.get(row.ticker);
      if (!snapshots) continue;
      const date = this.dayTruncate(row.date);
      const snapshot = snapshots.find(s => s.date === date);
      if (snapshot) snapshot.volume = row.volume;
    }
  }

  /**
   * 使用预设策略筛选
   */
  screen(presetName?: string): ScreenerResult[] {
    const presets = presetName
      ? this.config.presets.filter(p => p.name === presetName)
      : this.config.presets;

    const allResults = new Map<string, ScreenerResult>();

    for (const ticker of this.history.keys()) {
      for (const preset of presets) {
        const result = this.evaluateTicker(ticker, preset);
        if (!result) continue;

        // Merge duplicate ticker results (keep best)
        const existing = allResults.get(ticker);
        if (!existing || result.score > existing.score) {
          allResults.set(ticker, result);
        }
      }
    }

    // Sort and limit
    const results = [...allResults.values()].sort((a, b) => b.score - a.score);
    return results.slice(0, this.config.maxResults);
  }

  /**
   * 使用自定义条件筛选
   */
  customScreen(conditions: ScreenerCondition[], logic: 'AND' | 'OR' = 'AND'): ScreenerResult[] {
    const preset: ScreenerPreset = { name: 'custom', description: '', conditions, logic };
    return this.screen('custom');
  }

  /**
   * 获取单个ticker的信号摘要
   */
  getSignals(ticker: string): ScreenerResult['signals'] | null {
    const snapshots = this.history.get(ticker);
    if (!snapshots || snapshots.length < 2) return null;

    const recent = snapshots.slice(-5);
    const avg = recent.reduce((s, r) => s + r.avgScore, 0) / recent.length;

    const trend = this.detectTrend(recent.map(s => s.avgScore));
    const newsCount = recent[recent.length - 1].newsCount;
    const newsTrend = this.detectTrend(recent.map(s => s.newsCount));
    const volumeChange = this.calcVolumeChange(recent);

    return {
      sentimentTrend: trend,
      sentimentAvg: Math.round(avg * 1000) / 1000,
      volumeChange,
      newsCount,
      newsTrend,
    };
  }

  // ── Private: Evaluation ─────────────────────────────────────────

  private evaluateTicker(ticker: string, preset: ScreenerPreset): ScreenerResult | null {
    const snapshots = this.history.get(ticker);
    if (!snapshots || snapshots.length < this.config.minNewsToEvaluate) return null;

    const results: boolean[] = [];
    const matchedNames: string[] = [];

    for (const condition of preset.conditions) {
      const passed = this.checkCondition(snapshots, condition);
      results.push(passed);
      if (passed) matchedNames.push(condition.type);
    }

    const overallPassed = preset.logic === 'AND'
      ? results.every(Boolean)
      : results.some(Boolean);

    if (!overallPassed) return null;

    const signals = this.getSignals(ticker)!;
    const score = this.calcScore(signals, results, preset.conditions.length);
    const suggestion = this.determineSuggestion(score, signals);

    return {
      ticker,
      score,
      confidence: Math.min(0.95, results.filter(Boolean).length / preset.conditions.length + 0.3),
      matchedConditions: matchedNames,
      signals,
      suggestion,
      recentNews: snapshots.slice(-3).map(s => `${s.ticker} (${s.newsCount} articles, sentiment: ${s.avgScore.toFixed(2)})`),
    };
  }

  private checkCondition(snapshots: SentimentSnapshot[], condition: ScreenerCondition): boolean {
    switch (condition.type) {
      case 'sentiment_improving': {
        const days = condition.params.days || 3;
        const minChange = condition.params.min_change || 0.2;
        const recent = snapshots.slice(-days);
        if (recent.length < 2) return false;
        // Check trend: each day's sentiment >= previous
        for (let i = 1; i < recent.length; i++) {
          if (recent[i].avgScore < recent[i - 1].avgScore) return false;
        }
        // Overall improvement > threshold
        return recent[recent.length - 1].avgScore - recent[0].avgScore >= minChange;
      }

      case 'sentiment_reversal': {
        const days = condition.params.days || 2;
        const fromThr = condition.params.from_threshold || -0.1;
        const toThr = condition.params.to_threshold || 0.1;
        const recent = snapshots.slice(-days);
        if (recent.length < 2) return false;
        return recent[0].avgScore <= fromThr && recent[recent.length - 1].avgScore >= toThr;
      }

      case 'sentiment_strength': {
        const days = condition.params.days || 5;
        const minScore = condition.params.min_score || 0.2;
        const recent = snapshots.slice(-days);
        if (recent.length === 0) return false;
        const avg = recent.reduce((s, r) => s + r.avgScore, 0) / recent.length;
        return avg >= minScore;
      }

      case 'volume_surge': {
        const days = condition.params.days || 3;
        const multiplier = condition.params.multiplier || 2.0;
        const recent = snapshots.slice(-days);
        if (recent.length < 2) return false;

        const todayVol = recent[recent.length - 1].volume;
        if (todayVol === undefined) return false;

        const avgVol = recent.slice(0, -1).reduce((s, r) => s + (r.volume || 0), 0) / (recent.length - 1);
        if (avgVol === 0) return false;
        return todayVol / avgVol >= multiplier;
      }

      case 'news_surge': {
        const days = condition.params.days || 5;
        const multiplier = condition.params.multiplier || 2.0;
        const recent = snapshots.slice(-days);
        if (recent.length < 2) return false;

        const todayNews = recent[recent.length - 1].newsCount;
        const avgNews = recent.slice(0, -1).reduce((s, r) => s + r.newsCount, 0) / (recent.length - 1);
        if (avgNews === 0) return false;
        return todayNews / avgNews >= multiplier;
      }

      default:
        return false;
    }
  }

  // ── Private: Helpers ───────────────────────────────────────────

  private dayTruncate(ts: number): number {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private mergeSnapshots(existing: SentimentSnapshot[], incoming: SentimentSnapshot[]): SentimentSnapshot[] {
    const map = new Map<number, SentimentSnapshot>();
    for (const s of existing) map.set(s.date, s);
    for (const s of incoming) map.set(s.date, s); // Incoming overwrites
    return [...map.values()].sort((a, b) => a.date - b.date);
  }

  private detectTrend(values: number[]): ScreenerResult['signals']['sentimentTrend'] {
    if (values.length < 2) return 'unknown';
    let up = 0, down = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) up++;
      else if (values[i] < values[i - 1]) down++;
    }
    if (up > down * 1.5) return 'improving';
    if (down > up * 1.5) return 'declining';
    return 'stable';
  }

  private calcVolumeChange(recent: SentimentSnapshot[]): number {
    if (recent.length < 2) return 0;
    const today = recent[recent.length - 1].volume;
    const prev = recent[recent.length - 2].volume;
    if (today === undefined || prev === undefined || prev === 0) return 0;
    return Math.round(((today - prev) / prev) * 10000) / 100;
  }

  private calcScore(signals: ScreenerResult['signals'], results: boolean[], totalConditions: number): number {
    let score = 0;
    // Base: conditions matched
    score += (results.filter(Boolean).length / totalConditions) * 40;

    // Sentiment contribution
    score += Math.max(0, (signals.sentimentAvg + 1) * 15); // -1→0, 0→15, +1→30

    // Trend bonus
    if (signals.sentimentTrend === 'improving') score += 15;
    else if (signals.sentimentTrend === 'declining') score -= 10;

    // Volume bonus
    if (signals.volumeChange > 50) score += 10;
    else if (signals.volumeChange > 20) score += 5;

    // News attention bonus
    if (signals.newsTrend === 'increasing') score += 5;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private determineSuggestion(score: number, signals: ScreenerResult['signals']): ScreenerResult['suggestion'] {
    if (score >= 80 && signals.sentimentTrend === 'improving') return 'STRONG_BUY';
    if (score >= 65) return 'BUY';
    if (score >= 45) return 'WATCH';
    if (score >= 25) return 'HOLD';
    return 'CAUTION';
  }

  // ── Public: Config ──────────────────────────────────────────────

  getPresets(): ScreenerPreset[] {
    return this.config.presets;
  }

  addPreset(preset: ScreenerPreset): void {
    this.config.presets.push(preset);
  }

  removePreset(name: string): void {
    this.config.presets = this.config.presets.filter(p => p.name !== name);
  }

  getStats() {
    return {
      trackedTickers: this.history.size,
      totalSnapshots: [...this.history.values()].reduce((s, v) => s + v.length, 0),
      presets: this.config.presets.length,
    };
  }

  clear(): void {
    this.history.clear();
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: NewsStockScreener | null = null;
export function getStockScreener(config?: Partial<ScreenerConfig>): NewsStockScreener {
  if (!instance) instance = new NewsStockScreener(config);
  return instance;
}

export function resetStockScreener(): void {
  instance = null;
}
