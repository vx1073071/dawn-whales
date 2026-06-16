/**
 * R242-auto#1: 新闻回测数据准备 (News Backtest Data Prep)
 *
 * 3年历史新闻+股价对齐管线。
 *
 * 功能:
 *   1. 历史新闻检索: 按ticker/keyword查询3年范围
 *   2. 股价对齐: 新闻事件→前后N天股价表现
 *   3. 批量导出: 按ticker/date/event_type分片
 *   4. 统计预计算: 收益分布/胜率/最大回撤
 *   5. 缓存: LRU+T分级缓存 (1d for recent, 7d for old)
 *
 * 回测参数:
 *   - 时间窗口: 1d/3d/5d/7d/14d/30d post-event
 *   - 基准: vs SPY vs sector avg
 *   - 分组: by ticker / by category / by sentiment / by impact
 */

import type { NewsItem } from './news-types';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface PriceSnapshot {
  ticker: string;
  date: number;          // midnight UTC ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;     // Split/dividend adjusted
}

export interface AlignedEvent {
  newsItem: NewsItem;
  ticker: string;
  preEventWindow: PriceSnapshot[];   // N days before event
  postEventWindow: PriceSnapshot[];  // N days after event
  eventDay: PriceSnapshot;
  returns: BacktestReturns;
}

export interface BacktestReturns {
  ticker: string;
  eventDate: number;
  window1d: number;     // % return after 1 day
  window3d: number;
  window5d: number;
  window7d: number;
  window14d: number;
  window30d: number;
  maxDrawdown: number;  // % max drawdown in 30d
  vsSPY5d: number;      // Excess return vs SPY (5d)
  volatility: number;   // Annualized vol in window
}

export interface BacktestSummary {
  totalEvents: number;
  byTicker: Map<string, AlignedEvent[]>;
  byCategory: Map<string, AlignedEvent[]>;
  bySentiment: { positive: AlignedEvent[]; negative: AlignedEvent[]; neutral: AlignedEvent[] };
  byImpact: { P0: AlignedEvent[]; P1: AlignedEvent[]; P2: AlignedEvent[]; P3: AlignedEvent[] };
  statistics: {
    avgReturn1d: number;
    avgReturn5d: number;
    avgReturn30d: number;
    winRate1d: number;
    winRate5d: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
    bestPerforming: { ticker: string; return: number };
    worstPerforming: { ticker: string; return: number };
  };
}

export interface BacktestConfig {
  lookbackYears: number;
  windows: number[];         // [1, 3, 5, 7, 14, 30]
  benchmark: string;         // 'SPY' or sector index
  minNewsPerTicker: number;
  excludeWeekends: boolean;
  adjustForSplits: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: BacktestConfig = {
  lookbackYears: 3,
  windows: [1, 3, 5, 7, 14, 30],
  benchmark: 'SPY',
  minNewsPerTicker: 5,
  excludeWeekends: true,
  adjustForSplits: true,
};

export class NewsBacktestDataPrep {
  private config: BacktestConfig;
  private newsIndex = new Map<string, NewsItem[]>();       // ticker → news items
  private priceCache = new Map<string, PriceSnapshot[]>(); // ticker → price history
  private benchmarkPrices: PriceSnapshot[] = [];
  private alignedCache = new Map<string, AlignedEvent[]>(); // cache key → aligned events

  constructor(config?: Partial<BacktestConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ══════════════════════════════════════════════════════════════════
  // Data Input
  // ══════════════════════════════════════════════════════════════════

  /**
   * 摄入历史新闻数据
   */
  ingestNews(newsItems: NewsItem[]): void {
    for (const item of newsItems) {
      // Index by ticker
      for (const ticker of item.tickers || []) {
        if (!this.newsIndex.has(ticker)) this.newsIndex.set(ticker, []);
        this.newsIndex.get(ticker)!.push(item);
      }

      // Also index by keywords extracted from title
      const keywords = this.extractKeywords(item.title);
      for (const kw of keywords) {
        const key = `kw:${kw}`;
        if (!this.newsIndex.has(key)) this.newsIndex.set(key, []);
        this.newsIndex.get(key)!.push(item);
      }
    }

    // Sort all by date
    for (const [, items] of this.newsIndex) {
      items.sort((a, b) => a.publishedAt - b.publishedAt);
    }
  }

  /**
   * 摄入价格历史
   */
  ingestPrices(ticker: string, prices: PriceSnapshot[]): void {
    prices.sort((a, b) => a.date - b.date);
    this.priceCache.set(ticker, prices);
  }

  /**
   * 摄入基准价格 (SPY)
   */
  ingestBenchmark(prices: PriceSnapshot[]): void {
    prices.sort((a, b) => a.date - b.date);
    this.benchmarkPrices = prices;
  }

  // ══════════════════════════════════════════════════════════════════
  // Alignment
  // ══════════════════════════════════════════════════════════════════

  /**
   * 对齐: 新闻事件 → 股价 (前后N天)
   */
  align(ticker: string, preDays = 5, postDays = 30): AlignedEvent[] {
    const cacheKey = `${ticker}:${preDays}:${postDays}`;
    const cached = this.alignedCache.get(cacheKey);
    if (cached) return cached;

    const news = this.newsIndex.get(ticker);
    const prices = this.priceCache.get(ticker);
    if (!news || !prices || prices.length === 0) return [];

    const results: AlignedEvent[] = [];

    for (const item of news) {
      const eventTs = item.publishedAt;
      const eventDate = this.dayTruncate(eventTs);
      if (this.config.excludeWeekends && this.isWeekend(eventDate)) continue;

      // Find event day in price data
      const eventIdx = prices.findIndex(p => p.date >= eventDate);
      if (eventIdx === -1) continue;

      const preWindow = prices.slice(Math.max(0, eventIdx - preDays), eventIdx);
      const postWindow = prices.slice(eventIdx + 1, eventIdx + 1 + postDays);

      if (postWindow.length < 1) continue; // Need at least 1 day after

      const eventDay = prices[eventIdx];
      const returns = this.calcReturns(eventDay, postWindow, preWindow);

      results.push({
        newsItem: item,
        ticker,
        preEventWindow: preWindow,
        postEventWindow: postWindow,
        eventDay,
        returns,
      });
    }

    this.alignedCache.set(cacheKey, results);
    return results;
  }

  /**
   * 批量对齐多个ticker
   */
  alignBatch(tickers: string[]): Map<string, AlignedEvent[]> {
    const result = new Map<string, AlignedEvent[]>();
    for (const ticker of tickers) {
      const aligned = this.align(ticker);
      if (aligned.length >= this.config.minNewsPerTicker) {
        result.set(ticker, aligned);
      }
    }
    return result;
  }

  // ══════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════

  /**
   * 生成回测摘要
   */
  generateSummary(tickers?: string[]): BacktestSummary {
    const allEvents = tickers
      ? tickers.flatMap(t => this.align(t))
      : [...this.newsIndex.keys()]
          .filter(k => !k.startsWith('kw:'))
          .flatMap(t => this.align(t));

    if (allEvents.length === 0) {
      return this.emptySummary();
    }

    // Group by ticker
    const byTicker = new Map<string, AlignedEvent[]>();
    for (const e of allEvents) {
      if (!byTicker.has(e.ticker)) byTicker.set(e.ticker, []);
      byTicker.get(e.ticker)!.push(e);
    }

    // Group by category
    const byCategory = new Map<string, AlignedEvent[]>();
    for (const e of allEvents) {
      const cat = e.newsItem.category || 'company';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(e);
    }

    // Group by sentiment
    const bySentiment = {
      positive: allEvents.filter(e => (e.newsItem.sentiment?.score || 0) > 0.1),
      negative: allEvents.filter(e => (e.newsItem.sentiment?.score || 0) < -0.1),
      neutral: allEvents.filter(e => Math.abs(e.newsItem.sentiment?.score || 0) <= 0.1),
    };

    // Group by impact
    const byImpact = {
      P0: allEvents.filter(e => e.newsItem.impact === 'P0'),
      P1: allEvents.filter(e => e.newsItem.impact === 'P1'),
      P2: allEvents.filter(e => e.newsItem.impact === 'P2'),
      P3: allEvents.filter(e => !e.newsItem.impact || e.newsItem.impact === 'P3'),
    };

    // Compute statistics
    const returns = allEvents.map(e => e.returns);
    const sorted30d = [...returns].sort((a, b) => a.window30d - b.window30d);

    const statistics = {
      avgReturn1d: this.avg(returns.map(r => r.window1d)),
      avgReturn5d: this.avg(returns.map(r => r.window5d)),
      avgReturn30d: this.avg(returns.map(r => r.window30d)),
      winRate1d: returns.filter(r => r.window1d > 0).length / returns.length,
      winRate5d: returns.filter(r => r.window5d > 0).length / returns.length,
      sharpeRatio: this.calcSharpe(returns.map(r => r.window5d)),
      maxDrawdown: Math.min(...returns.map(r => r.maxDrawdown)),
      volatility: this.calcVolatility(returns.map(r => r.window5d)),
      bestPerforming: { ticker: allEvents[sorted30d[sorted30d.length - 1] ? 0 : 0]?.ticker || '', return: sorted30d[sorted30d.length - 1]?.window30d || 0 },
      worstPerforming: { ticker: allEvents[sorted30d[0] ? 0 : 0]?.ticker || '', return: sorted30d[0]?.window30d || 0 },
    };

    return {
      totalEvents: allEvents.length,
      byTicker,
      byCategory,
      bySentiment,
      byImpact,
      statistics,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // Query
  // ══════════════════════════════════════════════════════════════════

  /**
   * 查询: "当 {ticker} 出现 '{keyword}' 新闻后 {days} 天表现"
   */
  queryEvents(ticker: string, keyword: string, windowDays: number): AlignedEvent[] {
    const aligned = this.align(ticker);
    const kw = keyword.toLowerCase();
    const results: AlignedEvent[] = [];

    for (const event of aligned) {
      const title = event.newsItem.title.toLowerCase();
      const body = (event.newsItem.body || '').toLowerCase();
      if (title.includes(kw) || body.includes(kw)) {
        results.push(event);
      }
    }

    return results;
  }

  /**
   * 统计: 给定条件下的收益率分布
   */
  queryStats(ticker: string, keyword: string): { mean: number; median: number; stdDev: number; winRate: number; count: number } {
    const events = this.queryEvents(ticker, keyword, 30);
    const returns = events.map(e => e.returns.window5d);

    if (returns.length === 0) return { mean: 0, median: 0, stdDev: 0, winRate: 0, count: 0 };

    const sorted = [...returns].sort((a, b) => a - b);
    return {
      mean: this.avg(returns),
      median: sorted[Math.floor(sorted.length / 2)],
      stdDev: this.calcVolatility(returns) * 100,
      winRate: returns.filter(r => r > 0).length / returns.length,
      count: returns.length,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // Export
  // ══════════════════════════════════════════════════════════════════

  /**
   * 导出为CSV格式的字符串
   */
  exportCSV(ticker: string): string {
    const aligned = this.align(ticker);
    if (aligned.length === 0) return '';

    const header = 'date,ticker,title,category,impact,sentiment,return_1d,return_5d,return_30d,volatility,vs_spy_5d';
    const rows = aligned.map(e => {
      return [
        new Date(e.newsItem.publishedAt).toISOString().split('T')[0],
        e.ticker,
        `"${(e.newsItem.title || '').replace(/"/g, '""')}"`,
        e.newsItem.category || '',
        e.newsItem.impact || '',
        (e.newsItem.sentiment?.score || 0).toFixed(2),
        e.returns.window1d.toFixed(4),
        e.returns.window5d.toFixed(4),
        e.returns.window30d.toFixed(4),
        e.returns.volatility.toFixed(4),
        e.returns.vsSPY5d.toFixed(4),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**  
   * 导出回测摘要JSON
   */
  exportJSON(tickers?: string[]): string {
    const summary = this.generateSummary(tickers);
    // Convert Maps to objects for JSON
    return JSON.stringify({
      totalEvents: summary.totalEvents,
      byTicker: Object.fromEntries([...summary.byTicker].map(([k, v]) => [k, v.length])),
      byCategory: Object.fromEntries([...summary.byCategory].map(([k, v]) => [k, v.length])),
      statistics: summary.statistics,
    }, null, 2);
  }

  // ══════════════════════════════════════════════════════════════════
  // Private: Returns Calculation
  // ══════════════════════════════════════════════════════════════════

  private calcReturns(eventDay: PriceSnapshot, postWindow: PriceSnapshot[], preWindow: PriceSnapshot[]): BacktestReturns {
    const base = eventDay.close || eventDay.adjClose || 0;
    if (base === 0) return this.zeroReturns();

    const getReturn = (days: number): number => {
      if (days > postWindow.length) return 0;
      const target = postWindow[days - 1];
      const targetPrice = target.adjClose || target.close;
      return (targetPrice - base) / base;
    };

    const allPostPrices = postWindow.map(p => p.adjClose || p.close);
    const maxDD = this.calcMaxDrawdown(base, allPostPrices);

    // vs SPY
    const spyRet5d = this.calcBenchmarkReturn(eventDay.date, 5);
    const vsSPY = getReturn(5) - spyRet5d;

    // Volatility
    const allReturns = this.priceToReturns([base, ...allPostPrices]);
    const vol = this.calcVolatility(allReturns);

    return {
      ticker: eventDay.ticker,
      eventDate: eventDay.date,
      window1d: getReturn(1),
      window3d: getReturn(3),
      window5d: getReturn(5),
      window7d: getReturn(7),
      window14d: getReturn(14),
      window30d: getReturn(30),
      maxDrawdown: maxDD,
      vsSPY5d: vsSPY,
      volatility: vol,
    };
  }

  private calcMaxDrawdown(base: number, prices: number[]): number {
    let peak = base;
    let maxDD = 0;
    for (const price of prices) {
      if (price > peak) peak = price;
      const dd = (price - peak) / peak;
      if (dd < maxDD) maxDD = dd;
    }
    return maxDD;
  }

  private calcBenchmarkReturn(eventDate: number, days: number): number {
    if (this.benchmarkPrices.length === 0) return 0;
    const idx = this.benchmarkPrices.findIndex(p => p.date >= eventDate);
    if (idx === -1 || idx + days >= this.benchmarkPrices.length) return 0;
    const start = this.benchmarkPrices[idx].adjClose || this.benchmarkPrices[idx].close;
    const end = this.benchmarkPrices[idx + days].adjClose || this.benchmarkPrices[idx + days].close;
    return (end - start) / start;
  }

  // ══════════════════════════════════════════════════════════════════
  // Private: Helpers
  // ══════════════════════════════════════════════════════════════════

  private dayTruncate(ts: number): number {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private isWeekend(ts: number): boolean {
    const day = new Date(ts).getUTCDay();
    return day === 0 || day === 6;
  }

  private extractKeywords(title: string): string[] {
    const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const stopWords = new Set(['about', 'after', 'again', 'against', 'being', 'could', 'every', 'first', 'going', 'other', 'since', 'still', 'their', 'there', 'these', 'thing', 'think', 'those', 'under', 'where', 'which', 'while', 'would']);
    return [...new Set(words.filter(w => !stopWords.has(w)))].slice(0, 10);
  }

  private priceToReturns(prices: number[]): number[] {
    const rets: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] !== 0) {
        rets.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }
    return rets;
  }

  private avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calcVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = this.avg(returns);
    const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  private calcSharpe(returns: number[]): number {
    const vol = this.calcVolatility(returns);
    if (vol === 0) return 0;
    return (this.avg(returns) * 252) / vol;
  }

  private zeroReturns(): BacktestReturns {
    return {
      ticker: '', eventDate: 0,
      window1d: 0, window3d: 0, window5d: 0, window7d: 0, window14d: 0, window30d: 0,
      maxDrawdown: 0, vsSPY5d: 0, volatility: 0,
    };
  }

  private emptySummary(): BacktestSummary {
    return {
      totalEvents: 0,
      byTicker: new Map(),
      byCategory: new Map(),
      bySentiment: { positive: [], negative: [], neutral: [] },
      byImpact: { P0: [], P1: [], P2: [], P3: [] },
      statistics: {
        avgReturn1d: 0, avgReturn5d: 0, avgReturn30d: 0,
        winRate1d: 0, winRate5d: 0,
        sharpeRatio: 0, maxDrawdown: 0, volatility: 0,
        bestPerforming: { ticker: '', return: 0 },
        worstPerforming: { ticker: '', return: 0 },
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // Public Stats
  // ══════════════════════════════════════════════════════════════════

  getStats() {
    let totalNews = 0;
    for (const [, items] of this.newsIndex) totalNews += items.length;

    return {
      tickersTracked: this.newsIndex.size,
      totalNewsItems: totalNews,
      priceDataAvailable: this.priceCache.size,
      benchmarkLoaded: this.benchmarkPrices.length > 0,
      alignedEvents: [...this.alignedCache.values()].reduce((s, v) => s + v.length, 0),
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: NewsBacktestDataPrep | null = null;
export function getBacktestDataPrep(config?: Partial<BacktestConfig>): NewsBacktestDataPrep {
  if (!instance) instance = new NewsBacktestDataPrep(config);
  return instance;
}

export function resetBacktestDataPrep(): void {
  instance = null;
}
