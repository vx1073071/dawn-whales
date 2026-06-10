// ── J-75-02 R75 V19: Data Source Adapters ───────────────────────────────
// Unified IDataSourceAdapter interface × 4 concrete adapters
// Yahoo Finance, Alpha Vantage, NewsAPI, Reddit/StockTwits

// ── Unified Interface ─────────────────────────────────────────────────────

export interface AdapterConfig {
  enabled: boolean;
  baseUrl: string;\1/** @deprecated R83 — use server-side AI Gateway token */
\1\2
  rateLimit_perMin: number;
  timeoutMs: number;
  retries: number;
  cache_ms: number;
}

export interface FetchResult<T = unknown> {
  success: boolean;
  source: string;
  data: T | null;
  error: string | null;
  latencyMs: number;
  cached: boolean;
  timestamp: number;
}

export interface IDataSourceAdapter {
  readonly name: string;
  readonly category: "quote" | "fundamental" | "technical" | "news" | "social" | "macro";
  configure(config: Partial<AdapterConfig>): void;
  fetchQuote(symbol: string, market: string): Promise<FetchResult>;
  fetchHistory(symbol: string, market: string, startDate: string, endDate: string): Promise<FetchResult>;
  fetchFundamentals?(symbol: string, market: string): Promise<FetchResult>;
  fetchNews?(symbol: string, keywords: string[]): Promise<FetchResult>;
  fetchSentiment?(symbol: string): Promise<FetchResult>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; rateRemaining: number }>;
  getConfig(): AdapterConfig;
}

// ── Base Adapter ──────────────────────────────────────────────────────────

abstract class BaseAdapter implements IDataSourceAdapter {
  abstract readonly name: string;
  abstract readonly category: IDataSourceAdapter["category"];

  protected config: AdapterConfig = {
    enabled: false,
    baseUrl: "",
    apiKey: undefined,
    rateLimit_perMin: 30,
    timeoutMs: 5000,
    retries: 2,
    cache_ms: 60_000,
  };

  private cache = new Map<string, { data: unknown; ts: number }>();
  private rateCounter = { count: 0, resetAt: Date.now() + 60_000 };

  configure(cfg: Partial<AdapterConfig>): void {
    this.config = { ...this.config, ...cfg };
  }

  getConfig(): AdapterConfig { return { ...this.config }; }

  async fetchQuote(symbol: string, market: string): Promise<FetchResult> {
    return this.executeWithRetry(`quote:${symbol}:${market}`, () =>
      this.doFetchQuote(symbol, market));
  }

  async fetchHistory(symbol: string, market: string, startDate: string, endDate: string): Promise<FetchResult> {
    return this.executeWithRetry(`history:${symbol}:${market}:${startDate}:${endDate}`, () =>
      this.doFetchHistory(symbol, market, startDate, endDate));
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; rateRemaining: number }> {
    const start = performance.now();
    try {
      const ok = await this.doHealthCheck();
      const latencyMs = Math.round(performance.now() - start);
      return { healthy: ok, latencyMs, rateRemaining: this.rateRemaining() };
    } catch {
      return { healthy: false, latencyMs: Math.round(performance.now() - start), rateRemaining: this.rateRemaining() };
    }
  }

  protected abstract doFetchQuote(symbol: string, market: string): Promise<unknown>;
  protected abstract doFetchHistory(symbol: string, market: string, startDate: string, endDate: string): Promise<unknown>;
  protected abstract doHealthCheck(): Promise<boolean>;

  protected async executeWithRetry(key: string, fn: () => Promise<unknown>): Promise<FetchResult> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.ts < this.config.cache_ms) {
      return { success: true, source: this.name, data: cached.data, error: null, latencyMs: 0, cached: true, timestamp: cached.ts };
    }

    if (!this.config.enabled) {
      return { success: false, source: this.name, data: null, error: `${this.name} is disabled`, latencyMs: 0, cached: false, timestamp: Date.now() };
    }

    if (!this.checkRate()) {
      return { success: false, source: this.name, data: null, error: `${this.name} rate limit exceeded`, latencyMs: 0, cached: false, timestamp: Date.now() };
    }

    let lastError: Error | null = null;
    const attempts = this.config.retries + 1;

    for (let i = 0; i < attempts; i++) {
      const start = performance.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const data = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${this.config.timeoutMs}ms`)), this.config.timeoutMs),
          ),
        ]);

        clearTimeout(timeout);
        const latencyMs = Math.round(performance.now() - start);

        this.cache.set(key, { data, ts: Date.now() });
        return { success: true, source: this.name, data, error: null, latencyMs, cached: false, timestamp: Date.now() };
      } catch (e: unknown) {
        lastError = e;
        if (i < attempts - 1) {
          await this.sleep(200 * (i + 1)); // exponential-ish backoff
        }
      }
    }

    return { success: false, source: this.name, data: null, error: lastError?.message ?? "Unknown error", latencyMs: 0, cached: false, timestamp: Date.now() };
  }

  private checkRate(): boolean {
    const now = Date.now();
    if (now > this.rateCounter.resetAt) {
      this.rateCounter = { count: 0, resetAt: now + 60_000 };
    }
    if (this.rateCounter.count >= this.config.rateLimit_perMin) return false;
    this.rateCounter.count++;
    return true;
  }

  private rateRemaining(): number {
    return Math.max(0, this.config.rateLimit_perMin - this.rateCounter.count);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ── Yahoo Finance Adapter ─────────────────────────────────────────────────

export class YahooFinanceAdapter extends BaseAdapter {
  readonly name = "Yahoo Finance";
  readonly category = "quote" as const;

  constructor() {
    super();
    this.config = {
      ...this.config,
      baseUrl: "https://query1.finance.yahoo.com/v8/finance/chart/",
      rateLimit_perMin: 60,
      timeoutMs: 5000,
    };
  }

  protected async doFetchQuote(symbol: string, market: string): Promise<unknown> {
    const mappedSymbol = this.mapSymbol(symbol, market);
    const url = `${this.config.baseUrl}${mappedSymbol}?interval=1d&range=5d`;

    const response = await fetch(url, {
      headers: { "User-Agent": "DawnWhales/1.8" },
    });

    if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);
    const json = await response.json();

    const result = json?.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${symbol}`);

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const lastIdx = result.timestamp?.length - 1 ?? 0;

    return {
      symbol: meta.symbol,
      price: meta.regularMarketPrice,
      change: meta.regularMarketPrice - meta.previousClose,
      changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
      high: quote?.high?.[lastIdx] ?? meta.regularMarketPrice,
      low: quote?.low?.[lastIdx] ?? meta.regularMarketPrice,
      open: quote?.open?.[lastIdx] ?? meta.previousClose,
      volume: quote?.volume?.[lastIdx] ?? 0,
      currency: meta.currency ?? "USD",
      timestamp: meta.regularMarketTime ?? Date.now(),
    };
  }

  protected async doFetchHistory(symbol: string, market: string, startDate: string, endDate: string): Promise<unknown> {
    const mappedSymbol = this.mapSymbol(symbol, market);
    const period1 = Math.floor(new Date(startDate).getTime() / 1000);
    const period2 = Math.floor(new Date(endDate).getTime() / 1000);
    const url = `${this.config.baseUrl}${mappedSymbol}?interval=1d&period1=${period1}&period2=${period2}`;

    const response = await fetch(url, {
      headers: { "User-Agent": "DawnWhales/1.8" },
    });

    if (!response.ok) throw new Error(`Yahoo history failed: ${response.status}`);
    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error(`No history for ${symbol}`);

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];

    return timestamps.map((t, i) => ({
      time: t * 1000,
      open: quote?.open?.[i] ?? 0,
      high: quote?.high?.[i] ?? 0,
      low: quote?.low?.[i] ?? 0,
      close: quote?.close?.[i] ?? 0,
      volume: quote?.volume?.[i] ?? 0,
    }));
  }

  protected async doHealthCheck(): Promise<boolean> {
    try {
      const r = await fetch(`${this.config.baseUrl}AAPL?interval=1d&range=1d`, {
        headers: { "User-Agent": "DawnWhales/1.8" },
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  private mapSymbol(symbol: string, market: string): string {
    if (market === "SSE") return `${symbol}.SS`;
    if (market === "SZSE") return `${symbol}.SZ`;
    if (market === "HKEX") return `${symbol.replace(/^0+/, "")}.HK`;
    if (market === "SGX") return `${symbol}.SI`;
    return symbol;
  }
}

// ── Alpha Vantage Adapter ─────────────────────────────────────────────────

export class AlphaVantageAdapter extends BaseAdapter {
  readonly name = "Alpha Vantage";
  readonly category = "technical" as const;

  constructor() {
    super();
    this.config = {
      ...this.config,
      baseUrl: "https://www.alphavantage.co/query",
      rateLimit_perMin: 5, // free tier
      timeoutMs: 15000,
      retries: 1,
    };
  }

  protected async doFetchQuote(symbol: string, market: string): Promise<unknown> {
    const key = this.config.apiKey ?? "demo";
    const url = `${this.config.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`AV returned ${response.status}`);
    const json = await response.json();
    const quote = json?.["Global Quote"];
    if (!quote || !quote["05. price"]) throw new Error(`No quote for ${symbol}`);

    return {
      symbol,
      price: parseFloat(quote["05. price"]),
      change: parseFloat(quote["09. change"] ?? "0"),
      changePercent: parseFloat(quote["10. change percent"]?.replace("%", "") ?? "0"),
      high: parseFloat(quote["03. high"] ?? "0"),
      low: parseFloat(quote["04. low"] ?? "0"),
      open: parseFloat(quote["02. open"] ?? "0"),
      volume: parseInt(quote["06. volume"] ?? "0"),
      timestamp: Date.now(),
    };
  }

  protected async doFetchHistory(symbol: string, market: string, _start: string, _end: string): Promise<unknown> {
    const key = this.config.apiKey ?? "demo";
    const url = `${this.config.baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${key}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`AV history failed: ${response.status}`);
    const json = await response.json();
    const series = json?.["Time Series (Daily)"];
    if (!series) throw new Error(`No history for ${symbol}`);

    return Object.entries(series).slice(0, 30).map(([date, row]: [string, any]) => ({
      time: new Date(date).getTime(),
      open: parseFloat(row["1. open"]),
      high: parseFloat(row["2. high"]),
      low: parseFloat(row["3. low"]),
      close: parseFloat(row["4. close"]),
      volume: parseInt(row["5. volume"] ?? "0"),
    })).reverse();
  }

  protected async doHealthCheck(): Promise<boolean> {
    try {
      const key = this.config.apiKey ?? "demo";
      const r = await fetch(`${this.config.baseUrl}?function=GLOBAL_QUOTE&symbol=IBM&apikey=${key}`);
      return r.ok;
    } catch { return false; }
  }
}

// ── NewsAPI Adapter ───────────────────────────────────────────────────────

export class NewsAPIAdapter extends BaseAdapter {
  readonly name = "NewsAPI";
  readonly category = "news" as const;

  constructor() {
    super();
    this.config = {
      ...this.config,
      baseUrl: "https://newsapi.org/v2/everything",
      rateLimit_perMin: 30,
      timeoutMs: 10000,
      retries: 2,
    };
  }

  async fetchNews(symbol: string, keywords: string[]): Promise<FetchResult> {
    return this.executeWithRetry(`news:${symbol}:${keywords.join(",")}`, () =>
      this.doFetchNews(symbol, keywords));
  }

  async doFetchQuote(_s: string, _m: string): Promise<unknown> {
    throw new Error("NewsAPI does not provide quotes");
  }
  async doFetchHistory(_s: string, _m: string, _start: string, _end: string): Promise<unknown> {
    throw new Error("NewsAPI does not provide history");
  }

  private async doFetchNews(symbol: string, keywords: string[]): Promise<unknown> {
    const key = this.config.apiKey;
    if (!key) throw new Error("NewsAPI key not configured");

    const query = [symbol, ...keywords].filter(Boolean).join(" OR ");
    const yesterday = new Date(Date.now() - 86400_000).toISOString().split("T")[0];
    const url = `${this.config.baseUrl}?q=${encodeURIComponent(query)}&from=${yesterday}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${key}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`NewsAPI returned ${response.status}`);
    const json = await response.json();

    return (json?.articles ?? []).map((a: any) => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name,
      publishedAt: a.publishedAt,
      sentiment: this.guessSentiment(a.title ?? ""),
    }));
  }

  private guessSentiment(text: string): "positive" | "negative" | "neutral" {
    const positive = ["surge", "rally", "gain", "up", "beat", "growth", "profit", "higher", "jump"];
    const negative = ["drop", "fall", "loss", "plunge", "decline", "risk", "concern", "sanction", "warn"];
    const lower = text.toLowerCase();
    const posScore = positive.filter((w) => lower.includes(w)).length;
    const negScore = negative.filter((w) => lower.includes(w)).length;
    if (posScore > negScore) return "positive";
    if (negScore > posScore) return "negative";
    return "neutral";
  }

  protected async doHealthCheck(): Promise<boolean> {
    try {
      const key = this.config.apiKey;
      if (!key) return false;
      const r = await fetch(`${this.config.baseUrl}?q=test&pageSize=1&apiKey=${key}`);
      return r.ok;
    } catch { return false; }
  }
}

// ── Reddit / StockTwits Adapter ──────────────────────────────────────────

export class SocialSentimentAdapter extends BaseAdapter {
  readonly name = "Social Sentiment";
  readonly category = "social" as const;

  private subreddits: string[];

  constructor() {
    super();
    this.subreddits = ["wallstreetbets", "stocks", "investing", "StockMarket"];
    this.config = {
      ...this.config,
      baseUrl: "https://www.reddit.com",
      rateLimit_perMin: 60,
      timeoutMs: 8000,
      retries: 2,
    };
  }

  async fetchSentiment(symbol: string): Promise<FetchResult> {
    return this.executeWithRetry(`sentiment:${symbol}`, () =>
      this.doFetchSentiment(symbol));
  }

  protected async doFetchQuote(symbol: string, _market: string): Promise<unknown> {
    // Reddit has posts with tickers — not traditional quotes
    return this.doFetchSentiment(symbol);
  }

  protected async doFetchHistory(_s: string, _m: string, _start: string, _end: string): Promise<unknown> {
    throw new Error("Social sentiment does not provide price history");
  }

  private async doFetchSentiment(symbol: string): Promise<unknown> {
    const mentions: { subreddit: string; title: string; score: number; comments: number; url: string; created: number }[] = [];

    for (const sub of this.subreddits.slice(0, 2)) {
      // Using Reddit JSON API (no auth needed for read)
      try {
        const url = `${this.config.baseUrl}/r/${sub}/search.json?q=${encodeURIComponent(symbol)}&sort=new&limit=10&t=week`;
        const response = await fetch(url, {
          headers: { "User-Agent": "DawnWhales/1.8 (research bot)" },
        });
        if (!response.ok) continue;
        const json = await response.json();
        for (const child of json?.data?.children ?? []) {
          const d = child.data;
          mentions.push({
            subreddit: sub,
            title: d.title ?? "",
            score: d.score ?? 0,
            comments: d.num_comments ?? 0,
            url: `https://reddit.com${d.permalink}`,
            created: (d.created_utc ?? 0) * 1000,
          });
        }
      } catch {
        // Skip this subreddit on error (rate limit or network)
      }
    }

    // Compute aggregate sentiment
    const totalScore = mentions.reduce((s, m) => s + m.score, 0);
    const totalComments = mentions.reduce((s, m) => s + m.comments, 0);
    const buzz = Math.min(1, mentionBuzzScore(mentions));

    return {
      symbol,
      mentions: mentions.slice(0, 20),
      mentionCount: mentions.length,
      totalScore,
      totalComments,
      buzzScore: buzz,
      sentiment: buzz > 0.5 ? "bullish" : buzz > 0.2 ? "neutral" : "bearish",
      timestamp: Date.now(),
    };
  }

  protected async doHealthCheck(): Promise<boolean> {
    try {
      const r = await fetch(`${this.config.baseUrl}/r/stocks/hot.json?limit=1`, {
        headers: { "User-Agent": "DawnWhales/1.8" },
      });
      return r.ok;
    } catch { return false; }
  }
}

function mentionBuzzScore(mentions: Array<{ score: number; comments: number; created: number }>): number {
  if (mentions.length === 0) return 0;
  const now = Date.now();
  const recent = mentions.filter((m) => now - m.created < 86400_000 * 3);
  if (recent.length === 0) return 0;
  const totalInteraction = recent.reduce((s, m) => s + m.score + m.comments * 2, 0);
  return Math.min(1, totalInteraction / recent.length / 100);
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createAdapters() {
  return {
    yahoo: new YahooFinanceAdapter(),
    alphaVantage: new AlphaVantageAdapter(),
    newsApi: new NewsAPIAdapter(),
    socialSentiment: new SocialSentimentAdapter(),
  };
}

export type AllAdapters = ReturnType<typeof createAdapters>;
