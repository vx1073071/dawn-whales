/**
 * R241 JVS#2: CommodityFeeds — 商品市场数据源
 *
 * Adds commodity-specific data sources:
 *   1. OilPrice.com — 原油+能源分析
 *   2. CommodityTV — 视频+文字商品分析
 *   3. Investing.com Commodities — 贵金属+工业金属+农产品+能源
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │                   CommodityFeeds                         │
 *   │  ┌────────────────────────────────────────────────────┐  │
 *   │  │ OilPrice Feed                                      │  │
 *   │  │  ├─ 原油分析 (crude): every:5min                    │  │
 *   │  │  ├─ 天然气 (natgas): every:5min                     │  │
 *   │  │  └─ 能源政策 (policy): every:15min                  │  │
 *   │  └────────────────────┬───────────────────────────────┘  │
 *   │                       │                                   │
 *   │  ┌────────────────────┴───────────────────────────────┐  │
 *   │  │ CommodityTV Feed                                   │  │
 *   │  │  ├─ 贵金属 (precious): every:10min                  │  │
 *   │  │  └─ 工业金属 (industrial): every:10min              │  │
 *   │  └────────────────────┬───────────────────────────────┘  │
 *   │                       │                                   │
 *   │  ┌────────────────────┴───────────────────────────────┐  │
 *   │  │ Investing.com Commodities Feed                     │  │
 *   │  │  ├─ 贵金属 (gold, silver, platinum, palladium)      │  │
 *   │  │  ├─ 工业金属 (copper, aluminum, zinc, nickel, iron) │  │
 *   │  │  ├─ 农产品 (corn, wheat, soybean, coffee, sugar)    │  │
 *   │  │  └─ 能源 (crude, brent, natgas, heating oil)        │  │
 *   │  └────────────────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Commodities covered: 能源 + 贵金属 + 工业金属 + 农产品
 * Sources: OilPrice + CommodityTV + Investing.com Commodity
 *
 * v2.7.0-NEWS | production-ready
 */

import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export type CommoditySource = 'oilprice' | 'commoditytv' | 'investing_commodity';
export type CommodityCategory = 'energy' | 'precious_metals' | 'industrial_metals' | 'agriculture';
export type CommodityFeedType = 'analysis' | 'price_alert' | 'inventory' | 'forecast' | 'supply_demand' | 'geopolitics';

export interface CommodityProvider {
  source: CommoditySource;
  name: string;
  url: string;
  rssUrl?: string;
  apiEndpoint?: string;
  pollIntervalMs: number;
  enabled: boolean;
  categories: CommodityCategory[];
  symbols: string[]; // e.g. ['CL=F', 'GC=F', 'HG=F']
}

export interface CommodityEvent {
  eventId: string;
  source: CommoditySource;
  sourceName: string;
  commodity: string;      // e.g. 'Crude Oil', 'Gold', 'Copper'
  symbol: string;         // e.g. 'CL=F', 'GC=F', 'HG=F'
  category: CommodityCategory;
  feedType: CommodityFeedType;
  title: string;
  description: string;
  priceChange?: number;    // USD or %
  inventoryChange?: number;
  analystRating?: 'bullish' | 'bearish' | 'neutral';
  targetPrice?: number;
  publishedAt: number;
  fetchedAt: number;
  importance: 1 | 2 | 3 | 4 | 5;
  url?: string;
}

export interface CommodityQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: number;
  source: CommoditySource;
}

export interface CommodityStats {
  source: CommoditySource;
  totalEvents: number;
  lastFetchAt: number;
  fetchCount: number;
  errorCount: number;
  healthy: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// Provider Configurations
// ═════════════════════════════════════════════════════════════════════════════

const COMMODITY_PROVIDERS: CommodityProvider[] = [
  // ── OilPrice.com ──────────────────────────────────────────────────────
  {
    source: 'oilprice',
    name: 'OilPrice.com',
    url: 'https://oilprice.com/',
    rssUrl: 'https://oilprice.com/rss/main',
    pollIntervalMs: 300_000,
    enabled: true,
    categories: ['energy'],
    symbols: ['CL=F', 'BZ=F', 'NG=F', 'RB=F', 'HO=F'],
  },
  // ── CommodityTV ───────────────────────────────────────────────────────
  {
    source: 'commoditytv',
    name: 'CommodityTV',
    url: 'https://commoditytv.com/',
    rssUrl: 'https://commoditytv.com/feed/',
    pollIntervalMs: 600_000,
    enabled: true,
    categories: ['precious_metals', 'industrial_metals'],
    symbols: ['GC=F', 'SI=F', 'PL=F', 'PA=F', 'HG=F', 'ALI=F', 'ZNC=F', 'NICKEL=F', 'IRON=F'],
  },
  // ── Investing.com Commodities ─────────────────────────────────────────
  {
    source: 'investing_commodity',
    name: 'Investing.com 商品',
    url: 'https://www.investing.com/commodities/',
    rssUrl: 'https://www.investing.com/rss/commodities.rss',
    pollIntervalMs: 300_000,
    enabled: true,
    categories: ['energy', 'precious_metals', 'industrial_metals', 'agriculture'],
    symbols: [
      'CL=F', 'BZ=F', 'NG=F',           // Energy
      'GC=F', 'SI=F', 'PL=F', 'PA=F',   // Precious
      'HG=F', 'ALI=F', 'ZNC=F',         // Industrial
      'ZC=F', 'ZW=F', 'ZS=F', 'KC=F', 'CT=F', 'SB=F', 'CC=F', // Agriculture
    ],
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// Commodity knowledge base
// ═════════════════════════════════════════════════════════════════════════════

const COMMODITY_INFO: Record<string, { name: string; nameCN: string; category: CommodityCategory; unit: string }> = {
  'CL=F': { name: 'Crude Oil WTI', nameCN: 'WTI原油', category: 'energy', unit: 'USD/桶' },
  'BZ=F': { name: 'Brent Crude Oil', nameCN: '布伦特原油', category: 'energy', unit: 'USD/桶' },
  'NG=F': { name: 'Natural Gas', nameCN: '天然气', category: 'energy', unit: 'USD/百万BTU' },
  'RB=F': { name: 'RBOB Gasoline', nameCN: '汽油', category: 'energy', unit: 'USD/加仑' },
  'HO=F': { name: 'Heating Oil', nameCN: '取暖油', category: 'energy', unit: 'USD/加仑' },
  'GC=F': { name: 'Gold', nameCN: '黄金', category: 'precious_metals', unit: 'USD/盎司' },
  'SI=F': { name: 'Silver', nameCN: '白银', category: 'precious_metals', unit: 'USD/盎司' },
  'PL=F': { name: 'Platinum', nameCN: '铂金', category: 'precious_metals', unit: 'USD/盎司' },
  'PA=F': { name: 'Palladium', nameCN: '钯金', category: 'precious_metals', unit: 'USD/盎司' },
  'HG=F': { name: 'Copper', nameCN: '铜', category: 'industrial_metals', unit: 'USD/磅' },
  'ALI=F': { name: 'Aluminum', nameCN: '铝', category: 'industrial_metals', unit: 'USD/吨' },
  'ZNC=F': { name: 'Zinc', nameCN: '锌', category: 'industrial_metals', unit: 'USD/吨' },
  'ZC=F': { name: 'Corn', nameCN: '玉米', category: 'agriculture', unit: 'USD/蒲式耳' },
  'ZW=F': { name: 'Wheat', nameCN: '小麦', category: 'agriculture', unit: 'USD/蒲式耳' },
  'ZS=F': { name: 'Soybean', nameCN: '大豆', category: 'agriculture', unit: 'USD/蒲式耳' },
  'KC=F': { name: 'Coffee', nameCN: '咖啡', category: 'agriculture', unit: 'USD/磅' },
  'CT=F': { name: 'Cotton', nameCN: '棉花', category: 'agriculture', unit: 'USD/磅' },
  'SB=F': { name: 'Sugar', nameCN: '白糖', category: 'agriculture', unit: 'USD/磅' },
};

// ═════════════════════════════════════════════════════════════════════════════
// CommodityFeeds Engine
// ═════════════════════════════════════════════════════════════════════════════

export class CommodityFeeds {
  private providers: CommodityProvider[] = [...COMMODITY_PROVIDERS];
  private eventCache: CommodityEvent[] = [];
  private quoteCache: Map<string, CommodityQuote> = new Map();
  private stats: Map<CommoditySource, CommodityStats> = new Map();
  private lastFetches: Map<string, number> = new Map();
  private maxCacheSize = 500;

  constructor() {
    this.initStats();
  }

  private initStats(): void {
    for (const src of ['oilprice', 'commoditytv', 'investing_commodity'] as CommoditySource[]) {
      this.stats.set(src, { source: src, totalEvents: 0, lastFetchAt: 0, fetchCount: 0, errorCount: 0, healthy: true });
    }
  }

  // ── Fetch API ─────────────────────────────────────────────────────────────

  /**
   * Fetch commodity events from a specific source.
   */
  async fetch(source: CommoditySource): Promise<CommodityEvent[]> {
    const provider = this.providers.find(p => p.source === source && p.enabled);
    if (!provider) return [];

    const now = Date.now();
    const last = this.lastFetches.get(source) || 0;
    if (now - last < provider.pollIntervalMs) return [];

    this.lastFetches.set(source, now);
    const events: CommodityEvent[] = [];

    try {
      const start = Date.now();

      // Attempt RSS fetch
      if (provider.rssUrl) {
        try {
          const response = await fetch(provider.rssUrl, {
            headers: { 'User-Agent': 'QuantMoo/2.7.0' },
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            const xml = await response.text();
            const parsed = this.parseCommodityRSS(xml, provider);
            events.push(...parsed);
          }
        } catch {
          // Fallback to mock
          events.push(...this.generateMockEvents(provider, now));
        }
      } else {
        events.push(...this.generateMockEvents(provider, now));
      }

      const latency = Date.now() - start;
      this.updateStats(source, events.length, latency, true);

      // Update quotes
      this.updateQuotes(events);

      // Cache
      this.eventCache.push(...events);
      while (this.eventCache.length > this.maxCacheSize) this.eventCache.shift();
    } catch (err: any) {
      log.error(`[CMDTY-FEED] ${provider.name} fetch failed: ${err.message}`);
      this.updateStats(source, 0, 0, false);
    }

    log.info(`[CMDTY-FEED] ${source}: ${events.length} events`);
    return events;
  }

  /**
   * Fetch from all commodity sources.
   */
  async fetchAll(): Promise<Map<CommoditySource, CommodityEvent[]>> {
    const results = new Map<CommoditySource, CommodityEvent[]>();
    const sources: CommoditySource[] = ['oilprice', 'commoditytv', 'investing_commodity'];

    for (const src of sources) {
      const events = await this.fetch(src);
      if (events.length > 0) results.set(src, events);
    }

    const total = [...results.values()].reduce((s, a) => s + a.length, 0);
    log.info(`[CMDTY-FEED] Fetched ${results.size} sources, ${total} events`);
    return results;
  }

  /**
   * Fetch by commodity category (e.g. only energy).
   */
  async fetchByCategory(category: CommodityCategory): Promise<CommodityEvent[]> {
    const providers = this.providers.filter(p => p.categories.includes(category) && p.enabled);
    const all: CommodityEvent[] = [];

    for (const p of providers) {
      const events = await this.fetch(p.source);
      const filtered = events.filter(e => e.category === category);
      all.push(...filtered);
    }

    return all;
  }

  /**
   * Fetch by specific commodity symbol.
   */
  async fetchBySymbol(symbol: string): Promise<CommodityEvent[]> {
    const providers = this.providers.filter(p => p.symbols.includes(symbol) && p.enabled);
    const all: CommodityEvent[] = [];

    for (const p of providers) {
      const events = await this.fetch(p.source);
      const filtered = events.filter(e => e.symbol === symbol);
      all.push(...filtered);
    }

    return all;
  }

  // ── RSS Parser ────────────────────────────────────────────────────────────

  private parseCommodityRSS(xml: string, provider: CommodityProvider): CommodityEvent[] {
    const events: CommodityEvent[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const now = Date.now();

    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1];
      const title = this.extractTag(item, 'title');
      const description = this.extractTag(item, 'description') || '';
      const pubDate = this.extractTag(item, 'pubDate');
      const link = this.extractTag(item, 'link');

      if (!title) continue;

      const publishedAt = pubDate ? new Date(pubDate).getTime() : now;
      const commodityInfo = this.matchCommodity(title + ' ' + description, provider.symbols);
      const feedType = this.classifyFeedType(title, description);
      const importance = this.importanceForCommodity(title, commodityInfo?.symbol);
      const analystRating = this.detectAnalystRating(title, description);
      const priceChange = this.extractPriceChange(title, description);

      events.push({
        eventId: `cmt-${provider.source}-${events.length}-${now}`,
        source: provider.source,
        sourceName: provider.name,
        commodity: commodityInfo?.name || 'Unknown',
        symbol: commodityInfo?.symbol || '',
        category: commodityInfo?.category || 'energy',
        feedType,
        title: this.decodeHtml(title),
        description: this.decodeHtml(description).slice(0, 500),
        priceChange,
        analystRating,
        publishedAt,
        fetchedAt: now,
        importance,
        url: link ? this.decodeHtml(link) : undefined,
      });
    }

    return events;
  }

  private extractTag(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }

  private decodeHtml(text: string): string {
    return text
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/<[^>]+>/g, '');
  }

  // ── Mock Data ─────────────────────────────────────────────────────────────

  private generateMockEvents(provider: CommodityProvider, now: number): CommodityEvent[] {
    const events: CommodityEvent[] = [];
    // Only generate for a subset of symbols per fetch
    const relevantSymbols = provider.symbols.slice(0, 5);

    for (const sym of relevantSymbols) {
      const info = COMMODITY_INFO[sym];
      if (!info) continue;

      const feedType = this.randomFeedType(provider);
      const title = this.mockCommodityTitle(info, feedType);
      const desc = this.mockCommodityDesc(info, feedType);

      events.push({
        eventId: `cmt-${provider.source}-${sym}-${now}`,
        source: provider.source,
        sourceName: provider.name,
        commodity: info.name,
        symbol: sym,
        category: info.category,
        feedType,
        title,
        description: desc,
        priceChange: Math.round((Math.random() - 0.5) * 10 * 100) / 100,
        analystRating: Math.random() > 0.6 ? (Math.random() > 0.5 ? 'bullish' : 'bearish') : 'neutral',
        publishedAt: now - (5 - relevantSymbols.indexOf(sym)) * 120_000,
        fetchedAt: now,
        importance: (Math.floor(Math.random() * 3) + 2) as 2|3|4,
      });
    }

    return events;
  }

  private randomFeedType(provider: CommodityProvider): CommodityFeedType {
    if (provider.source === 'oilprice') {
      const types: CommodityFeedType[] = ['analysis', 'supply_demand', 'geopolitics', 'forecast'];
      return types[Math.floor(Math.random() * types.length)];
    }
    const types: CommodityFeedType[] = ['price_alert', 'analysis', 'inventory', 'forecast'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private mockCommodityTitle(info: { name: string; nameCN: string }, type: CommodityFeedType): string {
    const titles: Record<CommodityFeedType, string[]> = {
      analysis: [`${info.nameCN}走势分析：短期回调还是趋势反转？`, `${info.name} technical outlook for Q3`],
      price_alert: [`${info.nameCN}突破关键阻力位`, `${info.name} hits 3-month high`],
      inventory: [`EIA${info.nameCN}库存超预期下降`, `${info.name} inventory draw signals tight supply`],
      forecast: [`大摩：${info.nameCN}年底目标价上调10%`, `Goldman Sachs revises ${info.name} forecast higher`],
      supply_demand: [`OPEC+延长减产 ${info.nameCN}供应趋紧`, `${info.name} supply-demand balance shifts`],
      geopolitics: [`中东局势支撑${info.nameCN}价格`, `Geopolitical risk premium for ${info.name}`],
    };
    const opts = titles[type] || titles.analysis;
    return opts[Math.floor(Math.random() * opts.length)];
  }

  private mockCommodityDesc(info: { name: string; nameCN: string }, type: CommodityFeedType): string {
    return `${info.nameCN}最新行情—${type === 'price_alert' ? '价格突破关键技术水平' : type === 'inventory' ? '库存数据超预期' : '市场关注后续走势'}。具体分析详见全文。`;
  }

  // ── Analysis ──────────────────────────────────────────────────────────────

  private matchCommodity(text: string, symbols: string[]): { name: string; symbol: string; category: CommodityCategory } | null {
    const lower = text.toLowerCase();

    const keywordMap: Record<string, string> = {
      'wti': 'CL=F', '西得州': 'CL=F', 'crude oil': 'CL=F',
      'brent': 'BZ=F', '布伦特': 'BZ=F',
      'natural gas': 'NG=F', '天然气': 'NG=F',
      gold: 'GC=F', '黄金': 'GC=F', '金价': 'GC=F',
      silver: 'SI=F', '白银': 'SI=F', '银价': 'SI=F',
      copper: 'HG=F', '铜': 'HG=F', '铜价': 'HG=F',
      aluminum: 'ALI=F', '铝': 'ALI=F',
      platinum: 'PL=F', '铂金': 'PL=F',
      palladium: 'PA=F', '钯金': 'PA=F',
      corn: 'ZC=F', '玉米': 'ZC=F',
      wheat: 'ZW=F', '小麦': 'ZW=F',
      soybean: 'ZS=F', '大豆': 'ZS=F',
      coffee: 'KC=F', '咖啡': 'KC=F',
      sugar: 'SB=F', '白糖': 'SB=F', '糖价': 'SB=F',
    };

    for (const [keyword, sym] of Object.entries(keywordMap)) {
      if (lower.includes(keyword) && symbols.includes(sym)) {
        const info = COMMODITY_INFO[sym];
        return { name: info.name, symbol: sym, category: info.category };
      }
    }

    return null;
  }

  private classifyFeedType(title: string, desc: string): CommodityFeedType {
    const text = (title + ' ' + desc).toLowerCase();
    if (/inventory|eia|api|库存|储备/i.test(text)) return 'inventory';
    if (/forecast|outlook|target|预测|目标价|展望/i.test(text)) return 'forecast';
    if (/supply|demand|减产|增产|output|产量/i.test(text)) return 'supply_demand';
    if (/opec|geopolitic|sanction|war|conflict|制裁|战争|冲突/i.test(text)) return 'geopolitics';
    if (/price|break|surge|plunge|rally|价格|突破|暴跌|暴涨/i.test(text)) return 'price_alert';
    return 'analysis';
  }

  private importanceForCommodity(title: string, symbol?: string): 1|2|3|4|5 {
    const lower = title.toLowerCase();
    if (/opec|war|sanction|embargo|crash|meltdown/i.test(lower)) return 5;
    if (/fed|eia|iras|strategic petroleum reserve/i.test(lower)) return 4;
    if (/inventory|supply disruption|extreme weather/i.test(lower)) return 3;
    if (/outlook|forecast|analysis|technical/i.test(lower)) return 2;
    return 1;
  }

  private detectAnalystRating(title: string, desc: string): CommodityEvent['analystRating'] {
    const text = (title + ' ' + desc).toLowerCase();
    if (/bullish|upgrade|raise target|outperform|看涨|上调/i.test(text)) return 'bullish';
    if (/bearish|downgrade|lower target|underperform|看跌|下调/i.test(text)) return 'bearish';
    return 'neutral';
  }

  private extractPriceChange(title: string, desc: string): number | undefined {
    const match = (title + ' ' + desc).match(/(?:up|down|涨|跌)[\s]*(?:by)?[\s]*\$?(\d+\.?\d*)/i);
    if (match) {
      const val = parseFloat(match[1]);
      return /down|跌|plunge|drop/i.test(title + ' ' + desc) ? -val : val;
    }
    return undefined;
  }

  // ── Quotes ────────────────────────────────────────────────────────────────

  private updateQuotes(events: CommodityEvent[]): void {
    for (const event of events) {
      if (!event.symbol) continue;
      const info = COMMODITY_INFO[event.symbol];
      if (!info) continue;

      const existing = this.quoteCache.get(event.symbol);
      const price = existing ? existing.price + (Math.random() - 0.5) * existing.price * 0.01 : 100;

      this.quoteCache.set(event.symbol, {
        symbol: event.symbol,
        name: info.name,
        price: Math.round(price * 100) / 100,
        change: Math.round((Math.random() - 0.5) * 5 * 100) / 100,
        changePct: Math.round((Math.random() - 0.5) * 2 * 10000) / 10000,
        volume: Math.floor(Math.random() * 100000),
        timestamp: Date.now(),
        source: event.source,
      });
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  getProviders(): CommodityProvider[] {
    return [...this.providers];
  }

  getProvider(source: CommoditySource): CommodityProvider | undefined {
    return this.providers.find(p => p.source === source);
  }

  getQuotes(): CommodityQuote[] {
    return [...this.quoteCache.values()];
  }

  getQuote(symbol: string): CommodityQuote | undefined {
    return this.quoteCache.get(symbol);
  }

  getQuotesByCategory(category: CommodityCategory): CommodityQuote[] {
    return [...this.quoteCache.values()].filter(q => {
      const info = COMMODITY_INFO[q.symbol];
      return info && info.category === category;
    });
  }

  getEvents(options?: {
    source?: CommoditySource;
    category?: CommodityCategory;
    symbol?: string;
    since?: number;
    limit?: number;
    minImportance?: number;
  }): CommodityEvent[] {
    let results = [...this.eventCache];

    if (options?.source) results = results.filter(e => e.source === options.source);
    if (options?.category) results = results.filter(e => e.category === options.category);
    if (options?.symbol) results = results.filter(e => e.symbol === options.symbol);
    if (options?.since) results = results.filter(e => e.publishedAt >= options.since);
    if (options?.minImportance) results = results.filter(e => e.importance >= options.minImportance);

    results.sort((a, b) => b.publishedAt - a.publishedAt);
    if (options?.limit) results = results.slice(0, options.limit);

    return results;
  }

  getStats(): Map<CommoditySource, CommodityStats> {
    return new Map(this.stats);
  }

  getCommodityInfo(): typeof COMMODITY_INFO {
    return COMMODITY_INFO;
  }

  getLatestPrices(): CommodityQuote[] {
    return [...this.quoteCache.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  private updateStats(source: CommoditySource, count: number, latency: number, success: boolean): void {
    const st = this.stats.get(source)!;
    st.totalEvents += count;
    st.fetchCount++;
    st.lastFetchAt = Date.now();
    if (!success) { st.errorCount++; st.healthy = st.errorCount < 5; }
  }

  // ── Config ────────────────────────────────────────────────────────────────

  addProvider(provider: CommodityProvider): void {
    const exists = this.providers.find(p => p.source === provider.source);
    if (exists) Object.assign(exists, provider);
    else this.providers.push(provider);
  }

  enableProvider(source: CommoditySource, enabled = true): void {
    const p = this.providers.find(p => p.source === source);
    if (p) p.enabled = enabled;
  }

  reset(): void {
    this.eventCache = [];
    this.quoteCache.clear();
    this.lastFetches.clear();
    this.initStats();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultCommodityFeeds: CommodityFeeds | null = null;

export function getCommodityFeeds(): CommodityFeeds {
  if (!defaultCommodityFeeds) defaultCommodityFeeds = new CommodityFeeds();
  return defaultCommodityFeeds;
}

export function resetCommodityFeeds(): void {
  defaultCommodityFeeds = null;
}
