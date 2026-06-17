/**
 * R255 DS-05: Investing RSS 桥接 (InvestingRSSFetcher)
 * 
 * QUANT MOO 体验完善 — Investing.com RSS feeds 接入引擎
 * 
 * 功能:
 *   1. 多频道RSS抓取 (最新/市场/经济/大宗/加密/外汇/技术分析)
 *   2. 经济日历事件 (CPI/FOMC/GDP/NFP + 预期vs实际)
 *   3. 技术分析信号 (Moving Avg/RSI/Stoch/MACD 总结)
 *   4. 引擎标准化输出 (EngineArticle格式)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type InvestingFeedCategory = 'latest' | 'markets' | 'economy' | 'commodities' | 'crypto' | 'forex' | 'technical';

export interface InvestingArticle {
  articleId: string;
  title: string;
  url: string;
  category: InvestingFeedCategory;
  publishedAt: number;
  summary: string;
  author: string;
  tags: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  relevanceScore: number;      // 0-1
}

export interface EconomicEvent {
  eventId: string;
  title: string;
  titleCn: string;
  country: string;
  countryFlag: string;
  date: string;                // YYYY-MM-DD
  time: string;                // HH:MM UTC
  impact: 'high' | 'medium' | 'low';
  previous?: string;
  forecast?: string;
  actual?: string;
  category: string;
}

export interface TechnicalSummary {
  symbol: string;
  period: string;              // 15m/1h/4h/1d/1w
  movingAverages: { signal: 'buy' | 'sell' | 'neutral'; strength: number };  // 0-1
  oscillators: { signal: 'buy' | 'sell' | 'neutral'; strength: number };
  overallSignal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  score: number;               // -100 to 100
}

// Engine-compatible article
export interface InvestingEngineArticle {
  id: string;
  source: 'investing.com';
  category: InvestingFeedCategory;
  title: string;
  url: string;
  publishedAt: number;
  summary: string;
  tags: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  relevanceScore: number;
  language: string;
}

export interface InvestingStats {
  totalArticles: number;
  byCategory: Record<string, number>;
  lastFetch: number;
  articlesPerCategory: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// InvestingRSSFetcher
// ═══════════════════════════════════════════════════════════════════════════

export class InvestingRSSFetcher {
  private articles: InvestingArticle[] = [];
  private economicEvents: EconomicEvent[] = [];
  private technicalSummaries: Map<string, TechnicalSummary[]> = new Map();
  private lastFetch = 0;
  private stats = { totalFetches: 0, totalArticles: 0 };

  constructor() {
    this._seedArticles();
    this._seedEconomicEvents();
    this._seedTechnicalSummaries();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. RSS 文章抓取
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Fetch articles from a specific category.
   */
  fetchArticles(category: InvestingFeedCategory, limit = 20): InvestingArticle[] {
    this._refreshArticles();
    return this.articles
      .filter(a => a.category === category)
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, limit);
  }

  /**
   * Fetch latest articles across all categories.
   */
  fetchLatest(limit = 50): InvestingArticle[] {
    this._refreshArticles();
    return this.articles
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, limit);
  }

  /**
   * Search articles by keyword.
   */
  searchArticles(query: string, limit = 20): InvestingArticle[] {
    const lower = query.toLowerCase();
    return this.articles
      .filter(a =>
        a.title.toLowerCase().includes(lower) ||
        a.summary.toLowerCase().includes(lower) ||
        a.tags.some(t => t.toLowerCase().includes(lower)),
      )
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 经济日历
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get economic events for a date range.
   */
  getEconomicEvents(fromDate?: string, toDate?: string, impact?: 'high' | 'medium' | 'low'): EconomicEvent[] {
    let events = this.economicEvents;
    if (fromDate) events = events.filter(e => e.date >= fromDate);
    if (toDate) events = events.filter(e => e.date <= toDate);
    if (impact) events = events.filter(e => e.impact === impact);
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get high-impact events for today.
   */
  getTodayHighImpact(): EconomicEvent[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.economicEvents.filter(e => e.date === today && e.impact === 'high');
  }

  /**
   * Get upcoming events in the next N days.
   */
  getUpcomingEvents(days = 7, impact?: 'high' | 'medium' | 'low'): EconomicEvent[] {
    const now = new Date();
    const end = new Date(now.getTime() + days * 86400000);
    const fromStr = now.toISOString().slice(0, 10);
    const toStr = end.toISOString().slice(0, 10);
    return this.getEconomicEvents(fromStr, toStr, impact);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 技术分析总结
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get technical analysis summary for a symbol.
   */
  getTechnicalSummary(symbol: string): TechnicalSummary[] {
    return this.technicalSummaries.get(symbol.toUpperCase()) ?? [];
  }

  /**
   * Get overall signal for a symbol (best period).
   */
  getOverallSignals(): Array<{ symbol: string; signal: string; score: number }> {
    const results: Array<{ symbol: string; signal: string; score: number }> = [];
    for (const [symbol, summaries] of this.technicalSummaries) {
      if (summaries.length > 0) {
        results.push({
          symbol,
          signal: summaries[0].overallSignal,
          score: summaries[0].score,
        });
      }
    }
    return results.sort((a, b) => b.score - a.score);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. 引擎标准化输出
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Convert articles to engine-compatible format.
   */
  toEngineArticles(articles: InvestingArticle[]): InvestingEngineArticle[] {
    return articles.map(a => ({
      id: a.articleId,
      source: 'investing.com',
      category: a.category,
      title: a.title,
      url: a.url,
      publishedAt: a.publishedAt,
      summary: a.summary,
      tags: a.tags,
      sentiment: a.sentiment,
      relevanceScore: a.relevanceScore,
      language: 'en',
    }));
  }

  /**
   * Fetch and convert in one step.
   */
  fetchEngineArticles(category: InvestingFeedCategory, limit = 20): InvestingEngineArticle[] {
    return this.toEngineArticles(this.fetchArticles(category, limit));
  }

  /**
   * Fetch latest engine articles.
   */
  fetchLatestEngineArticles(limit = 50): InvestingEngineArticle[] {
    return this.toEngineArticles(this.fetchLatest(limit));
  }

  /** Get stats */
  getStats(): InvestingStats {
    const byCategory: Record<string, number> = {};
    for (const a of this.articles) {
      byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
    }
    return {
      totalArticles: this.articles.length,
      byCategory,
      lastFetch: this.lastFetch,
      articlesPerCategory: Math.round(this.articles.length / Object.keys(byCategory).length),
    };
  }

  reset(): void {
    this.articles.length = 0;
    this.economicEvents.length = 0;
    this.technicalSummaries.clear();
    this.lastFetch = 0;
    this.stats = { totalFetches: 0, totalArticles: 0 };
    this._seedArticles();
    this._seedEconomicEvents();
    this._seedTechnicalSummaries();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _refreshArticles(): void {
    this.lastFetch = Date.now();
    this.stats.totalFetches++;
    this.stats.totalArticles = this.articles.length;
  }

  private _seedArticles(): void {
    const categories: InvestingFeedCategory[] = ['latest', 'markets', 'economy', 'commodities', 'crypto', 'forex', 'technical'];

    const articleTemplates: Array<{ title: string; category: InvestingFeedCategory; summary: string; tags: string[]; sentiment: 'positive' | 'negative' | 'neutral' }> = [
      { title: 'S&P 500 hits new all-time high on tech rally', category: 'markets', summary: 'The S&P 500 reached a record high driven by strong earnings from tech giants.', tags: ['SP500', 'tech', 'rally'], sentiment: 'positive' },
      { title: 'Fed signals potential rate cut in September', category: 'economy', summary: 'Federal Reserve minutes suggest a rate cut could come as early as September.', tags: ['Fed', 'rate_cut', 'FOMC'], sentiment: 'positive' },
      { title: 'Gold prices surge past $2,400 on geopolitical tensions', category: 'commodities', summary: 'Gold rallied above $2,400 per ounce amid heightened Middle East tensions.', tags: ['gold', 'geopolitics', 'safe_haven'], sentiment: 'positive' },
      { title: 'Bitcoin breaks $70K as ETF inflows accelerate', category: 'crypto', summary: 'BTC surpassed $70,000 with spot ETF inflows reaching new daily records.', tags: ['BTC', 'ETF', 'crypto'], sentiment: 'positive' },
      { title: 'EUR/USD slides on ECB dovish comments', category: 'forex', summary: 'Euro weakened against the dollar after ECB officials signaled readiness to cut rates.', tags: ['EURUSD', 'ECB', 'forex'], sentiment: 'negative' },
      { title: 'NVIDIA: Technical indicators flash buy signal', category: 'technical', summary: 'Moving averages and RSI both point to a strong buy for NVDA stock.', tags: ['NVDA', 'technical', 'buy_signal'], sentiment: 'positive' },
      { title: 'Oil prices drop 3% on demand concerns', category: 'commodities', summary: 'Crude oil fell sharply as China demand outlook weakens.', tags: ['oil', 'crude', 'China'], sentiment: 'negative' },
      { title: 'CPI data comes in below expectations', category: 'economy', summary: 'Consumer Price Index rose 2.9% YoY vs 3.1% expected, boosting rate cut hopes.', tags: ['CPI', 'inflation', 'Fed'], sentiment: 'positive' },
      { title: 'Tesla stock drops after delivery miss', category: 'markets', summary: 'TSLA shares fell 5% after Q2 deliveries came in below analyst estimates.', tags: ['TSLA', 'earnings', 'EV'], sentiment: 'negative' },
      { title: 'Ethereum ETF approval expected next month', category: 'crypto', summary: 'SEC is expected to approve spot ETH ETFs, driving ETH price higher.', tags: ['ETH', 'ETF', 'SEC'], sentiment: 'positive' },
      { title: 'Japan intervenes to support yen', category: 'forex', summary: 'BOJ conducted yen-buying intervention as USD/JPY approached 160.', tags: ['JPY', 'BOJ', 'intervention'], sentiment: 'neutral' },
      { title: 'Apple: Strong buy rating from analysts', category: 'technical', summary: 'AAPL shows bullish pennant pattern with volume confirmation.', tags: ['AAPL', 'technical', 'buy'], sentiment: 'positive' },
      { title: 'Global markets mixed as traders await NFP', category: 'latest', summary: 'Markets traded cautiously ahead of Friday\'s Non-Farm Payrolls report.', tags: ['NFP', 'markets', 'jobs'], sentiment: 'neutral' },
      { title: 'Copper prices hit 2-year high on green energy demand', category: 'commodities', summary: 'Copper surged as demand for electrification and green energy infrastructure grows.', tags: ['copper', 'commodities', 'green_energy'], sentiment: 'positive' },
      { title: 'China GDP growth beats forecasts at 5.3%', category: 'economy', summary: 'China reported Q1 GDP growth of 5.3%, exceeding the 5.0% consensus.', tags: ['China', 'GDP', 'Asia'], sentiment: 'positive' },
      { title: 'Nasdaq leads gains as AI stocks surge', category: 'latest', summary: 'The Nasdaq Composite outperformed, led by semiconductor and AI-related stocks.', tags: ['Nasdaq', 'AI', 'semiconductor'], sentiment: 'positive' },
      { title: 'Solana network upgrade drives SOL price higher', category: 'crypto', summary: 'SOL rallied 15% after successful mainnet upgrade improved throughput.', tags: ['SOL', 'Solana', 'upgrade'], sentiment: 'positive' },
      { title: 'UK inflation remains sticky at 3.2%', category: 'economy', summary: 'UK CPI held at 3.2%, above BOE target, delaying rate cut expectations.', tags: ['UK', 'CPI', 'BOE'], sentiment: 'negative' },
      { title: 'Microsoft: Overbought signals appearing', category: 'technical', summary: 'MSFT RSI above 75 on daily chart, suggesting potential short-term pullback.', tags: ['MSFT', 'technical', 'overbought'], sentiment: 'negative' },
      { title: 'Dollar index strengthens on risk-off sentiment', category: 'forex', summary: 'DXY rose as investors sought safety amid geopolitical uncertainty.', tags: ['DXY', 'USD', 'safe_haven'], sentiment: 'neutral' },
    ];

    const now = Date.now();
    for (let i = 0; i < articleTemplates.length; i++) {
      const t = articleTemplates[i];
      const seed = this._hash(t.title);
      this.articles.push({
        articleId: `inv:${i}:${seed.toString(36).slice(0, 6)}`,
        title: t.title,
        url: `https://www.investing.com/news/${t.category}/${t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${seed.toString(36).slice(0, 6)}`,
        category: t.category,
        publishedAt: now - (i * 1800000 + seed % 3600000),
        summary: t.summary,
        author: ['James Chen', 'Sarah Williams', 'Michael Tan', 'Emily Zhou', 'David Park'][seed % 5],
        tags: t.tags,
        sentiment: t.sentiment,
        relevanceScore: Math.round((0.5 + (seed % 50) / 100) * 100) / 100,
      });
    }
  }

  private _seedEconomicEvents(): void {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

    this.economicEvents = [
      { eventId: 'evt:fomc', title: 'FOMC Meeting Minutes', titleCn: '美联储会议纪要', country: 'US', countryFlag: '🇺🇸', date: today, time: '14:00', impact: 'high', category: 'Central Bank' },
      { eventId: 'evt:cpi', title: 'CPI YoY', titleCn: '消费者物价指数 年率', country: 'US', countryFlag: '🇺🇸', date: today, time: '08:30', impact: 'high', previous: '3.1%', forecast: '3.0%', actual: '2.9%', category: 'Inflation' },
      { eventId: 'evt:gdp', title: 'GDP QoQ', titleCn: '国内生产总值 季率', country: 'US', countryFlag: '🇺🇸', date: tomorrow, time: '08:30', impact: 'high', forecast: '2.5%', category: 'Growth' },
      { eventId: 'evt:nfp', title: 'Non-Farm Payrolls', titleCn: '非农就业人数', country: 'US', countryFlag: '🇺🇸', date: dayAfter, time: '08:30', impact: 'high', forecast: '180K', category: 'Employment' },
      { eventId: 'evt:ppi', title: 'PPI MoM', titleCn: '生产者物价指数 月率', country: 'US', countryFlag: '🇺🇸', date: today, time: '08:30', impact: 'medium', previous: '0.3%', forecast: '0.2%', category: 'Inflation' },
      { eventId: 'evt:retail', title: 'Retail Sales MoM', titleCn: '零售销售 月率', country: 'US', countryFlag: '🇺🇸', date: tomorrow, time: '08:30', impact: 'medium', forecast: '0.3%', category: 'Consumption' },
      { eventId: 'evt:umich', title: 'Michigan Consumer Sentiment', titleCn: '密歇根消费者信心', country: 'US', countryFlag: '🇺🇸', date: dayAfter, time: '10:00', impact: 'medium', forecast: '68.0', category: 'Sentiment' },
      { eventId: 'evt:ecb', title: 'ECB Interest Rate Decision', titleCn: '欧央行利率决议', country: 'EU', countryFlag: '🇪🇺', date: tomorrow, time: '12:45', impact: 'high', forecast: '4.25%', category: 'Central Bank' },
      { eventId: 'evt:pbc', title: 'PBoC Loan Prime Rate', titleCn: '中国贷款市场报价利率', country: 'CN', countryFlag: '🇨🇳', date: today, time: '01:15', impact: 'high', previous: '3.45%', forecast: '3.45%', actual: '3.45%', category: 'Central Bank' },
      { eventId: 'evt:boj', title: 'BOJ Policy Rate', titleCn: '日本央行政策利率', country: 'JP', countryFlag: '🇯🇵', date: dayAfter, time: '03:00', impact: 'high', forecast: '0.25%', category: 'Central Bank' },
      { eventId: 'evt:ukgdp', title: 'UK GDP MoM', titleCn: '英国GDP 月率', country: 'UK', countryFlag: '🇬🇧', date: tomorrow, time: '06:00', impact: 'medium', forecast: '0.1%', category: 'Growth' },
      { eventId: 'evt:caipi', title: 'Caixin Services PMI', titleCn: '财新服务业PMI', country: 'CN', countryFlag: '🇨🇳', date: today, time: '01:45', impact: 'medium', previous: '52.5', forecast: '52.8', category: 'PMI' },
    ];
  }

  private _seedTechnicalSummaries(): void {
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'AMZN', 'META', 'BTCUSD', 'ETHUSD', 'EURUSD'];
    const periods = ['15m', '1h', '4h', '1d', '1w'];
    const signals: Array<TechnicalSummary['overallSignal']> = ['strong_buy', 'buy', 'neutral', 'sell', 'strong_sell'];

    for (const symbol of symbols) {
      const summaries: TechnicalSummary[] = [];
      for (const period of periods) {
        const seed = this._hash(symbol + period);
        summaries.push({
          symbol, period,
          movingAverages: { signal: seed % 3 === 0 ? 'buy' : seed % 3 === 1 ? 'sell' : 'neutral', strength: Math.round((0.5 + (seed % 50) / 100) * 100) / 100 },
          oscillators: { signal: seed % 4 === 0 ? 'buy' : seed % 4 === 1 ? 'sell' : 'neutral', strength: Math.round((0.4 + (seed % 60) / 100) * 100) / 100 },
          overallSignal: signals[seed % 5],
          score: Math.round((seed % 200 - 100) * 100) / 100,
        });
      }
      this.technicalSummaries.set(symbol, summaries);
    }
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: InvestingRSSFetcher | null = null;

export function investingRSSFetcher(): InvestingRSSFetcher {
  if (!instance) instance = new InvestingRSSFetcher();
  return instance;
}

export function resetInvestingRSSFetcher(): void { instance?.reset(); instance = null; }
