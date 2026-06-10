import { EngineError, ErrorCode } from '../errors';
// ── J-73-01 R73 V19: 4Agent Real Data Connector ─────────────────────────
// Connects 4Agent orchestration to real data sources
// Connects Yahoo Finance, Alpha Vantage, NewsAPI, Reddit/StockTwits + proprietary
// v1.9.0: Live orchestrator replaces MOCK constants with real API responses

// ── Data Source Interfaces ───────────────────────────────────────────────

export interface RealDataSourceConfig {
  yahooFinance: {
    enabled: boolean;
    baseUrl: string; // "https://query1.finance.yahoo.com/v8/finance/chart/"
    rateLimit_perMin: number; // default 60
    timeoutMs: number;
  };
  alphaVantage: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string; // "https://www.alphavantage.co/query"
    rateLimit_perMin: number; // default 5 (free tier)
    timeoutMs: number;
  };
  newsApi: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string; // "https://newsapi.org/v2/"
    rateLimit_perMin: number; // default 100
    timeoutMs: number;
    sources: string[]; // Bloomberg, Reuters, CNBC, etc.
  };
  reddit: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    userAgent: string;
    subreddits: string[]; // ["wallstreetbets", "stocks", "investing", "StockMarket"]
    rateLimit_perMin: number;
    timeoutMs: number;
  };
  stockTwits: {
    enabled: boolean;
    accessToken: string;
    baseUrl: string; // "https://api.stocktwits.com/api/2/"
    rateLimit_perMin: number;
    timeoutMs: number;
  };
  proprietary: {
    enabled: boolean;
    endpoint: string;
    apiKey: string;
    rateLimit_perMin: number;
    timeoutMs: number;
  };
}

export interface DataSourceStatus {
  source: string;
  enabled: boolean;
  connected: boolean;
  lastSuccess: number; // epoch ms
  lastError: string | null;
  errorCount: number;
  rateLimitRemaining: number;
}

export interface MarketDataResult {
  symbol: string;
  market: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  high52w: number;
  low52w: number;
  marketCap: number;
  pe: number;
  eps: number;
  dividend: number;
  timestamp: number;
  source: string; // which source provided the data
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: number;
  sentiment: number; // -1 to 1
  symbols: string[]; // related tickers
  relevance: number; // 0-1, how relevant to current context
}

export interface SocialSentiment {
  symbol: string;
  source: "reddit" | "stocktwits";
  mentions: number; // 24h mention count
  sentiment: number; // -1 to 1 aggregated
  bullishCount: number;
  bearishCount: number;
  totalPosts: number;
  timestamp: number;
}

// ── Real Data Orchestrator ────────────────────────────────────────────────

export class RealDataOrchestrator {
  private config: RealDataSourceConfig;
  private status: Map<string, DataSourceStatus> = new Map();
  private cache: Map<string, { data: unknown; expires: number }> = new Map();

  // Rate limit tracking
  private rateLimiters: Map<string, { remaining: number; resetAt: number }> = new Map();

  // Circuit breakers: if a source fails N times in a row, disable it temporarily
  private circuitBreakers: Map<string, { failures: number; disabledUntil: number; maxFailures: number }> = new Map();

  constructor(config?: Partial<RealDataSourceConfig>) {
    this.config = {
      yahooFinance: {
        enabled: true,
        baseUrl: "https://query1.finance.yahoo.com/v8/finance/chart/",
        rateLimit_perMin: 60,
        timeoutMs: 5000,
        ...config?.yahooFinance,
      },
      alphaVantage: {
        enabled: true,
        apiKey: config?.alphaVantage?.apiKey ?? "demo",
        baseUrl: "https://www.alphavantage.co/query",
        rateLimit_perMin: 5,
        timeoutMs: 10000,
        ...config?.alphaVantage,
      },
      newsApi: {
        enabled: true,
        apiKey: config?.newsApi?.apiKey ?? "",
        baseUrl: "https://newsapi.org/v2/",
        rateLimit_perMin: 100,
        timeoutMs: 5000,
        sources: ["bloomberg", "reuters", "cnbc", "business-insider"],
        ...config?.newsApi,
      },
      reddit: {
        enabled: true,
        clientId: config?.reddit?.clientId ?? "",
        clientSecret: config?.reddit?.clientSecret ?? "",
        userAgent: config?.reddit?.userAgent ?? "DawnWhales/1.8.0",
        subreddits: ["wallstreetbets", "stocks", "investing", "StockMarket"],
        rateLimit_perMin: 30,
        timeoutMs: 5000,
        ...config?.reddit,
      },
      stockTwits: {
        enabled: true,
        accessToken: config?.stockTwits?.accessToken ?? "",
        baseUrl: "https://api.stocktwits.com/api/2/",
        rateLimit_perMin: 30,
        timeoutMs: 5000,
        ...config?.stockTwits,
      },
      proprietary: {
        enabled: true,
        endpoint: config?.proprietary?.endpoint ?? "http://localhost:9400/api/v1",
        apiKey: config?.proprietary?.apiKey ?? "",
        rateLimit_perMin: 300,
        timeoutMs: 5000,
        ...config?.proprietary,
      },
    };

    // Initialize status trackers
    for (const source of ["yahooFinance", "alphaVantage", "newsApi", "reddit", "stockTwits", "proprietary"]) {
      this.status.set(source, {
        source,
        enabled: (this.config as any)[source]?.enabled ?? false,
        connected: false,
        lastSuccess: 0,
        lastError: null,
        errorCount: 0,
        rateLimitRemaining: (this.config as any)[source]?.rateLimit_perMin ?? 0,
      });
      this.circuitBreakers.set(source, { failures: 0, disabledUntil: 0, maxFailures: 3 });
    }
  }

  // ── Market Data ──────────────────────────────────────────────────────────

  /** Fetch market data for a symbol, tries sources in priority order */
  async fetchMarketData(symbol: string, market: string): Promise<MarketDataResult> {
    // 1. Try proprietary first (fastest/most reliable)
    if (this.config.proprietary.enabled && this.isCircuitOk("proprietary")) {
      try {
        const data = await this.fetchFromProprietary(symbol, market);
        this.recordSuccess("proprietary");
        return data;
      } catch (e) {
        this.recordFailure("proprietary", e);
      }
    }

    // 2. Try Yahoo Finance
    if (this.config.yahooFinance.enabled && this.isCircuitOk("yahooFinance")) {
      try {
        const data = await this.fetchFromYahoo(symbol, market);
        this.recordSuccess("yahooFinance");
        return data;
      } catch (e) {
        this.recordFailure("yahooFinance", e);
      }
    }

    // 3. Try Alpha Vantage
    if (this.config.alphaVantage.enabled && this.isCircuitOk("alphaVantage")) {
      try {
        const data = await this.fetchFromAlphaVantage(symbol, market);
        this.recordSuccess("alphaVantage");
        return data;
      } catch (e) {
        this.recordFailure("alphaVantage", e);
      }
    }

    throw new EngineError("`All data sources exhausted for ${market}:${symbol}`", { code: ErrorCode.ENGINE_DATA_ERROR });
  }

  private async fetchFromProprietary(symbol: string, market: string): Promise<MarketDataResult> {
    const response = await this.httpGet(
      `${this.config.proprietary.endpoint}/quote?symbol=${symbol}&market=${market}`,
      { "X-API-Key": this.config.proprietary.apiKey },
      this.config.proprietary.timeoutMs,
    );
    return this.normalizeQuote(response, "proprietary");
  }

  private async fetchFromYahoo(symbol: string, market: string): Promise<MarketDataResult> {
    const yahooSymbol = this.toYahooSymbol(symbol, market);
    const response = await this.httpGet(
      `${this.config.yahooFinance.baseUrl}${yahooSymbol}?interval=1d&range=1d`,
      {},
      this.config.yahooFinance.timeoutMs,
    );
    return this.normalizeYahooQuote(response, symbol, market);
  }

  private async fetchFromAlphaVantage(symbol: string, market: string): Promise<MarketDataResult> {
    const avSymbol = this.toAVSymbol(symbol, market);
    const response = await this.httpGet(
      `${this.config.alphaVantage.baseUrl}?function=GLOBAL_QUOTE&symbol=${avSymbol}&apikey=${this.config.alphaVantage.apiKey}`,
      {},
      this.config.alphaVantage.timeoutMs,
    );
    return this.normalizeAVQuote(response, symbol, market);
  }

  // ── News ─────────────────────────────────────────────────────────────────

  async fetchNews(symbols: string[], options?: { limit?: number; since?: number }): Promise<NewsItem[]> {
    const cacheKey = `news:${symbols.join(",")}:${options?.limit ?? 20}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as NewsItem[];

    const allNews: NewsItem[] = [];

    // Try NewsAPI first
    if (this.config.newsApi.enabled && this.isCircuitOk("newsApi")) {
      try {
        const query = symbols.join(" OR ");
        const response = await this.httpGet(
          `${this.config.newsApi.baseUrl}everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=${options?.limit ?? 20}&apiKey=${this.config.newsApi.apiKey}`,
          {},
          this.config.newsApi.timeoutMs,
        );
        this.recordSuccess("newsApi");
        allNews.push(...this.normalizeNewsApi(response));
      } catch (e) {
        this.recordFailure("newsApi", e);
      }
    }

    // Try proprietary news
    if (this.config.proprietary.enabled && this.isCircuitOk("proprietary")) {
      try {
        const response = await this.httpGet(
          `${this.config.proprietary.endpoint}/news?symbols=${symbols.join(",")}&limit=${options?.limit ?? 20}`,
          { "X-API-Key": this.config.proprietary.apiKey },
          this.config.proprietary.timeoutMs,
        );
        this.recordSuccess("proprietary");
        allNews.push(...this.normalizeProprietaryNews(response));
      } catch (e) {
        this.recordFailure("proprietary", e);
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const deduped = allNews.filter((n) => {
      if (seen.has(n.url)) return false;
      seen.add(n.url);
      return true;
    });

    // Sort by published time (newest first)
    deduped.sort((a, b) => b.publishedAt - a.publishedAt);

    const limited = deduped.slice(0, options?.limit ?? 20);
    this.setCache(cacheKey, limited, 60_000); // 1min cache
    return limited;
  }

  // ── Social Sentiment ────────────────────────────────────────────────────

  async fetchSocialSentiment(symbol: string): Promise<SocialSentiment[]> {
    const cacheKey = `social:${symbol}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as SocialSentiment[];

    const results: SocialSentiment[] = [];

    // Reddit
    if (this.config.reddit.enabled && this.isCircuitOk("reddit")) {
      try {
        const redditData = await this.fetchRedditSentiment(symbol);
        results.push(redditData);
        this.recordSuccess("reddit");
      } catch (e) {
        this.recordFailure("reddit", e);
      }
    }

    // StockTwits
    if (this.config.stockTwits.enabled && this.isCircuitOk("stockTwits")) {
      try {
        const stData = await this.fetchStockTwitsSentiment(symbol);
        results.push(stData);
        this.recordSuccess("stockTwits");
      } catch (e) {
        this.recordFailure("stockTwits", e);
      }
    }

    this.setCache(cacheKey, results, 60_000); // 1min cache
    return results;
  }

  private async fetchRedditSentiment(symbol: string): Promise<SocialSentiment> {
    const response = await this.httpGet(
      `https://oauth.reddit.com/r/wallstreetbets/search?q=${symbol}&sort=new&limit=100&t=day`,
      {
        Authorization: `Bearer ${await this.getRedditToken()}`,
        "User-Agent": this.config.reddit.userAgent,
      },
      this.config.reddit.timeoutMs,
    );

    const posts = response?.data?.children ?? [];
    let bullishCount = 0;
    let bearishCount = 0;

    for (const post of posts) {
      const title = (post.data?.title ?? "").toLowerCase();
      if (/bull|buy|long|calls?|🚀|📈|💎|moon|rip|yolo/.test(title)) bullishCount++;
      if (/bear|sell|short|puts?|📉|🔻|bag|crash/.test(title)) bearishCount++;
    }

    const total = bullishCount + bearishCount || 1;
    return {
      symbol,
      source: "reddit",
      mentions: posts.length,
      sentiment: (bullishCount - bearishCount) / total,
      bullishCount,
      bearishCount,
      totalPosts: posts.length,
      timestamp: Date.now(),
    };
  }

  private async fetchStockTwitsSentiment(symbol: string): Promise<SocialSentiment> {
    const response = await this.httpGet(
      `${this.config.stockTwits.baseUrl}streams/symbol/${symbol}.json?limit=100`,
      {},
      this.config.stockTwits.timeoutMs,
    );

    const messages = response?.messages ?? [];
    let bullishCount = 0;
    let bearishCount = 0;

    for (const msg of messages) {
      if (msg.entities?.sentiment?.basic === "Bullish") bullishCount++;
      else if (msg.entities?.sentiment?.basic === "Bearish") bearishCount++;
    }

    const total = bullishCount + bearishCount || 1;
    return {
      symbol,
      source: "stocktwits",
      mentions: messages.length,
      sentiment: (bullishCount - bearishCount) / total,
      bullishCount,
      bearishCount,
      totalPosts: messages.length,
      timestamp: Date.now(),
    };
  }

  // ── Status & Health ─────────────────────────────────────────────────────

  getDataSourceStatus(): DataSourceStatus[] {
    return [...this.status.values()];
  }

  getDataSourceStatusFor(source: string): DataSourceStatus | undefined {
    return this.status.get(source);
  }

  /** Check if ALL required sources are healthy */
  healthCheck(): { healthy: boolean; failingSources: string[]; allStatus: DataSourceStatus[] } {
    const failingSources: string[] = [];
    for (const [source, status] of this.status) {
      if (status.enabled && !status.connected && status.errorCount > 0) {
        failingSources.push(source);
      }
    }
    return {
      healthy: failingSources.length === 0,
      failingSources,
      allStatus: [...this.status.values()],
    };
  }

  // ── Config ──────────────────────────────────────────────────────────────

  /** Update API keys / endpoints at runtime */
  updateConfig(partial: Partial<RealDataSourceConfig>): void {
    this.config = { ...this.config, ...partial };
    this.cache.clear(); // invalidate all cache on config change
  }

  getConfig(): Readonly<RealDataSourceConfig> {
    return this.config;
  }

  /** Enable/disable a specific data source */
  setSourceEnabled(source: keyof RealDataSourceConfig, enabled: boolean): void {
    (this.config[source] as any).enabled = enabled;
    const status = this.status.get(source);
    if (status) status.enabled = enabled;
  }

  /** Reset all circuit breakers (e.g. after network recovery) */
  resetCircuitBreakers(): void {
    for (const [, cb] of this.circuitBreakers) {
      cb.failures = 0;
      cb.disabledUntil = 0;
    }
  }

  reset(): void {
    this.cache.clear();
    this.status.clear();
    this.rateLimiters.clear();
    this.circuitBreakers.clear();
  }

  // ── Private: Helpers ────────────────────────────────────────────────────

  private isCircuitOk(source: string): boolean {
    const cb = this.circuitBreakers.get(source);
    if (!cb) return true;
    if (cb.disabledUntil > Date.now()) return false;
    return true;
  }

  private recordSuccess(source: string): void {
    const status = this.status.get(source);
    if (status) {
      status.connected = true;
      status.lastSuccess = Date.now();
      status.lastError = null;
    }
    const cb = this.circuitBreakers.get(source);
    if (cb) cb.failures = 0;
  }

  private recordFailure(source: string, error: unknown): void {
    const status = this.status.get(source);
    if (status) {
      status.connected = false;
      status.lastError = String(error);
      status.errorCount++;
    }
    const cb = this.circuitBreakers.get(source);
    if (cb) {
      cb.failures++;
      if (cb.failures >= cb.maxFailures) {
        cb.disabledUntil = Date.now() + 300_000; // 5min circuit break
      }
    }
  }

  private async getRedditToken(): Promise<string> {
    const cacheKey = "reddit:token";
    const cached = this.getCache(cacheKey);
    if (cached) return cached as string;

    const response = await this.httpPost(
      "https://www.reddit.com/api/v1/access_token",
      "grant_type=client_credentials",
      {
        Authorization: `Basic ${Buffer.from(`${this.config.reddit.clientId}:${this.config.reddit.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      5000,
    );

    const token = response.access_token;
    this.setCache(cacheKey, token, 3_600_000); // 1 hour
    return token;
  }

  // ── Private: Symbol Mapping ────────────────────────────────────────────

  private toYahooSymbol(symbol: string, market: string): string {
    // HKEX: 00700 → 0700.HK
    // NYSE: AAPL → AAPL
    // NASDAQ: TSLA → TSLA
    // SGX: D05 → D05.SI
    // TSE: 7203 → 7203.T
    // ASX: BHP → BHP.AX
    // TSX: RY → RY.TO
    // BURSA: 1155 → 1155.KL
    const suffix: Record<string, string> = {
      HKEX: ".HK", SGX: ".SI", TSE: ".T", ASX: ".AX", TSX: ".TO", BURSA: ".KL",
    };
    const trimmed = symbol.padStart(4, "0").replace(/^0+(?=\d)/, "");
    return suffix[market] ? `${trimmed}${suffix[market]}` : symbol;
  }

  private toAVSymbol(symbol: string, market: string): string {
    // Alpha Vantage format: same as Yahoo but different prefix
    return this.toYahooSymbol(symbol, market);
  }

  // ── Private: Response Normalizers ───────────────────────────────────────

  private normalizeQuote(data: any, source: string): MarketDataResult {
    // Proprietary format
    return {
      symbol: data.symbol,
      market: data.market,
      price: data.last ?? data.price,
      change: data.change,
      changePct: data.changePct ?? data.changePercent,
      volume: data.volume,
      high52w: data.high52w ?? data.high52Week,
      low52w: data.low52w ?? data.low52Week,
      marketCap: data.marketCap ?? data.marketCapitalization,
      pe: data.pe ?? data.peRatio,
      eps: data.eps,
      dividend: data.dividend ?? data.dividendYield,
      timestamp: Date.now(),
      source,
    };
  }

  private normalizeYahooQuote(data: any, symbol: string, market: string): MarketDataResult {
    const result = data?.chart?.result?.[0];
    const meta = result?.meta ?? {};
    const quote = result?.indicators?.quote?.[0] ?? {};
    return {
      symbol, market,
      price: meta.regularMarketPrice ?? 0,
      change: meta.regularMarketPrice - meta.previousClose,
      changePct: meta.previousClose ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100 : 0,
      volume: meta.regularMarketVolume ?? 0,
      high52w: meta.fiftyTwoWeekHigh ?? 0,
      low52w: meta.fiftyTwoWeekLow ?? 0,
      marketCap: meta.marketCap ?? 0,
      pe: meta.trailingPE ?? 0,
      eps: meta.epsTrailingTwelveMonths ?? 0,
      dividend: meta.dividendYield ?? 0,
      timestamp: Date.now(),
      source: "yahooFinance",
    };
  }

  private normalizeAVQuote(data: any, symbol: string, market: string): MarketDataResult {
    const quote = data?.["Global Quote"] ?? {};
    return {
      symbol, market,
      price: parseFloat(quote["05. price"]) || 0,
      change: parseFloat(quote["09. change"]) || 0,
      changePct: parseFloat(quote["10. change percent"]?.replace("%", "")) || 0,
      volume: parseInt(quote["06. volume"]) || 0,
      high52w: 0, // Alpha Vantage doesn't provide 52w in GLOBAL_QUOTE
      low52w: 0,
      marketCap: 0,
      pe: parseFloat(quote["PE"]) || 0,
      eps: 0,
      dividend: 0,
      timestamp: Date.now(),
      source: "alphaVantage",
    };
  }

  private normalizeNewsApi(data: any): NewsItem[] {
    const articles = data?.articles ?? [];
    return articles.map((a: any, i: number) => ({
      id: `newsapi-${i}`,
      title: a.title ?? "",
      summary: a.description ?? "",
      url: a.url ?? "",
      source: a.source?.name ?? "NewsAPI",
      publishedAt: new Date(a.publishedAt).getTime(),
      sentiment: 0, // NewsAPI doesn't provide sentiment
      symbols: [],
      relevance: 0.5,
    }));
  }

  private normalizeProprietaryNews(data: any): NewsItem[] {
    const articles = data?.articles ?? data?.data ?? [];
    return articles.map((a: any, i: number) => ({
      id: a.id ?? `propnews-${i}`,
      title: a.title ?? "",
      summary: a.summary ?? a.description ?? "",
      url: a.url ?? "",
      source: a.source ?? "Proprietary",
      publishedAt: new Date(a.publishedAt ?? Date.now()).getTime(),
      sentiment: a.sentiment ?? 0,
      symbols: a.symbols ?? [],
      relevance: a.relevance ?? 0.5,
    }));
  }

  // ── Private: HTTP Helpers ──────────────────────────────────────────────

  private async httpGet(url: string, headers: Record<string, string>, timeoutMs: number): Promise<any> {
    // In real implementation: use fetch/axios/electron net module
    // This is the engine interface — actual HTTP is done by the renderer process
    return this.httpRequest("GET", url, headers, null, timeoutMs);
  }

  private async httpPost(url: string, body: string, headers: Record<string, string>, timeoutMs: number): Promise<any> {
    return this.httpRequest("POST", url, headers, body, timeoutMs);
  }

  private async httpRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: string | null,
    timeoutMs: number,
  ): Promise<any> {
    // Placeholder: real implementation uses Electron IPC to main process
    // which has fetch/crypto/persistent connections
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new EngineError("`HTTP ${response.status}: ${response.statusText}`", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
      }

      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Private: Cache ────────────────────────────────────────────────────

  private getCache(key: string): unknown | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  private setCache(key: string, data: unknown, ttlMs: number): void {
    this.cache.set(key, { data, expires: Date.now() + ttlMs });
  }
}

// ── 4Agent Real Data Integration ──────────────────────────────────────────

export type AgentType = "technical" | "fundamentals" | "sentiment" | "macro";

export interface AgentRealDataContext {
  symbol: string;
  market: string;
  marketData: MarketDataResult | null;
  news: NewsItem[];
  social: SocialSentiment[];
  technicals?: unknown; // from agent-technical
  fundamentals?: unknown; // from agent-fundamentals
  timestamp: number;
}

/**
 * Bridge function: replaces MOCK_xxx constants with real data from the orchestrator.
 * Called by agent-techical.ts, agent-fundamentals.ts, agent-sentiment.ts, agent-macro.ts
 */
export async function getRealDataContext(
  orchestrator: RealDataOrchestrator,
  symbol: string,
  market: string,
): Promise<AgentRealDataContext> {
  const [marketData, news, social] = await Promise.allSettled([
    orchestrator.fetchMarketData(symbol, market).catch(() => null),
    orchestrator.fetchNews([symbol], { limit: 10 }),
    orchestrator.fetchSocialSentiment(symbol),
  ]);

  return {
    symbol,
    market,
    marketData: marketData.status === "fulfilled" ? marketData.value : null,
    news: news.status === "fulfilled" ? news.value : [],
    social: social.status === "fulfilled" ? social.value : [],
    timestamp: Date.now(),
  };
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createRealDataOrchestrator(config?: Partial<RealDataSourceConfig>): RealDataOrchestrator {
  return new RealDataOrchestrator(config);
}

// ── Constants ────────────────────────────────────────────────────────────

/** Minimum real data indicators before falling back to cached/mock */
export const REAL_DATA_MIN_INDICATORS = {
  price: true,
  volume: true,
  pe: true,
  marketCap: true,
  high52w: true,
  low52w: true,
};

/** Data freshness thresholds (ms) */
export const DATA_FRESHNESS = {
  quote: 60_000,       // 1 minute
  news: 300_000,       // 5 minutes
  social: 120_000,     // 2 minutes
  fundamentals: 3_600_000, // 1 hour (quarterly data doesn't change often)
};
