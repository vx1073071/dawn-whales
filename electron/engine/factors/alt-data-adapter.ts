// R191 J2: Alternative Data Adapter Framework — NewsAPI + JobPosting + ESG Scoring
// Extensible adapter pattern for non-traditional data sources.
// Current providers: NewsAPI (sentiment/news) + Job Postings (labor market) + ESG (MSCI-style)

export interface NewsArticle {
  title: string;
  description: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment?: number; // -1 to +1
  relevanceScore?: number;
  tickers?: string[];
}

export interface NewsSentimentResult {
  symbol: string;
  avgSentiment: number;
  articleCount: number;
  sentimentVolatility: number;
  topKeywords: string[];
  latestHeadline: string;
  timestamp: number;
}

export interface JobPostingData {
  company: string;
  symbol: string;
  activePostings: number;
  newPostings7d: number;
  avgSalary: number;
  trend: 'growing' | 'stable' | 'shrinking';
  departments: { name: string; count: number }[];
  timestamp: number;
}

export interface ESGScore {
  symbol: string;
  environmental: number;
  social: number;
  governance: number;
  overall: number;
  controversyLevel: number;
  rankPercentile: number;
  timestamp: number;
}

export interface AltDataProviderConfig {
  newsApiKey?: string;
  newsApiBaseUrl?: string;
  jobPostingApiKey?: string;
  esgApiKey?: string;
  cacheTtlMs?: number;
  mockOnFail?: boolean;
}

export class AltDataAdapter {
  private config: Required<AltDataProviderConfig>;
  private cache = new Map<string, { data: unknown; ts: number }>();

  constructor(config: AltDataProviderConfig = {}) {
    this.config = {
      newsApiKey: config.newsApiKey ?? '',
      newsApiBaseUrl: config.newsApiBaseUrl ?? 'https://newsapi.org/v2',
      jobPostingApiKey: config.jobPostingApiKey ?? '',
      esgApiKey: config.esgApiKey ?? '',
      cacheTtlMs: config.cacheTtlMs ?? 3600_000,
      mockOnFail: config.mockOnFail ?? true,
    };
  }

  // ---- News / Sentiment ----
  async fetchNewsSentiment(symbol: string): Promise<NewsSentimentResult> {
    const ck = 'news:' + symbol;
    const cached = this.cache.get(ck);
    if (cached && Date.now() - cached.ts < this.config.cacheTtlMs) return cached.data as NewsSentimentResult;

    let result: NewsSentimentResult;
    try {
      if (this.config.newsApiKey) {
        result = await this.fetchFromNewsApi(symbol);
      } else {
        result = this.mockNewsSentiment(symbol);
      }
    } catch {
      if (this.config.mockOnFail) result = this.mockNewsSentiment(symbol);
      else throw new Error('News API failed for ' + symbol);
    }
    this.cache.set(ck, { data: result, ts: Date.now() });
    return result;
  }

  async fetchNewsArticles(symbol: string, limit: number = 20): Promise<NewsArticle[]> {
    const ck = 'articles:' + symbol + ':' + limit;
    const cached = this.cache.get(ck);
    if (cached && Date.now() - cached.ts < this.config.cacheTtlMs) return cached.data as NewsArticle[];

    let result: NewsArticle[];
    try {
      if (this.config.newsApiKey) {
        const url = this.config.newsApiBaseUrl + '/everything?q=' + encodeURIComponent(symbol) + '&pageSize=' + limit + '&apiKey=' + this.config.newsApiKey;
        const res = await fetch(url);
        const data = await res.json();
        result = (data.articles ?? []).slice(0, limit).map(this.normalizeArticle);
      } else {
        result = this.mockArticles(symbol, limit);
      }
    } catch {
      if (this.config.mockOnFail) result = this.mockArticles(symbol, limit);
      else throw new Error('News fetch failed for ' + symbol);
    }
    this.cache.set(ck, { data: result, ts: Date.now() });
    return result;
  }

  // ---- Job Postings ----
  async fetchJobPostings(symbol: string, companyName?: string): Promise<JobPostingData> {
    const ck = 'jobs:' + symbol;
    const cached = this.cache.get(ck);
    if (cached && Date.now() - cached.ts < this.config.cacheTtlMs) return cached.data as JobPostingData;

    let result: JobPostingData;
    try {
      if (this.config.jobPostingApiKey) {
        result = await this.fetchJobsFromApi(symbol, companyName);
      } else {
        result = this.mockJobPostings(symbol, companyName);
      }
    } catch {
      if (this.config.mockOnFail) result = this.mockJobPostings(symbol, companyName);
      else throw new Error('Job API failed for ' + symbol);
    }
    this.cache.set(ck, { data: result, ts: Date.now() });
    return result;
  }

  // ---- ESG Scoring ----
  async fetchESGScore(symbol: string): Promise<ESGScore> {
    const ck = 'esg:' + symbol;
    const cached = this.cache.get(ck);
    if (cached && Date.now() - cached.ts < this.config.cacheTtlMs) return cached.data as ESGScore;

    let result: ESGScore;
    try {
      if (this.config.esgApiKey) {
        result = await this.fetchESGFromApi(symbol);
      } else {
        result = this.mockESG(symbol);
      }
    } catch {
      if (this.config.mockOnFail) result = this.mockESG(symbol);
      else throw new Error('ESG API failed for ' + symbol);
    }
    this.cache.set(ck, { data: result, ts: Date.now() });
    return result;
  }

  /** Batch fetch for multiple symbols */
  async fetchAll(symbols: string[], types: ('news' | 'jobs' | 'esg')[] = ['news', 'jobs', 'esg']): Promise<{
    news: Map<string, NewsSentimentResult>;
    jobs: Map<string, JobPostingData>;
    esg: Map<string, ESGScore>;
  }> {
    const [news, jobs, esg] = await Promise.all([
      types.includes('news') ? Promise.all(symbols.map(async s => [s, await this.fetchNewsSentiment(s)] as const)) : Promise.resolve([]),
      types.includes('jobs') ? Promise.all(symbols.map(async s => [s, await this.fetchJobPostings(s)] as const)) : Promise.resolve([]),
      types.includes('esg') ? Promise.all(symbols.map(async s => [s, await this.fetchESGScore(s)] as const)) : Promise.resolve([]),
    ]);
    return {
      news: new Map(news),
      jobs: new Map(jobs),
      esg: new Map(esg),
    };
  }

  clearCache(): void { this.cache.clear(); }

  // ---- Private API methods ----
  private async fetchFromNewsApi(symbol: string): Promise<NewsSentimentResult> {
    const articles = await this.fetchNewsArticles(symbol, 50);
    const sentiments = articles.map(a => a.sentiment ?? 0).filter(s => s !== 0);
    const avg = sentiments.length > 0 ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0;
    const vol = sentiments.length > 1 ? Math.sqrt(sentiments.reduce((s, v) => s + (v - avg) ** 2, 0) / (sentiments.length - 1)) : 0;
    const keywords = this.extractKeywords(articles);
    return {
      symbol, avgSentiment: avg, articleCount: articles.length,
      sentimentVolatility: vol, topKeywords: keywords,
      latestHeadline: articles[0]?.title ?? '', timestamp: Date.now(),
    };
  }

  private async fetchJobsFromApi(symbol: string, companyName?: string): Promise<JobPostingData> {
    const url = 'https://jobs-api.example.com/v1/search?ticker=' + encodeURIComponent(symbol) + '&apiKey=' + this.config.jobPostingApiKey;
    const res = await fetch(url);
    const data = await res.json();
    return this.normalizeJobData(data, symbol, companyName);
  }

  private async fetchESGFromApi(symbol: string): Promise<ESGScore> {
    const url = 'https://esg-api.example.com/v1/scores/' + encodeURIComponent(symbol) + '?apiKey=' + this.config.esgApiKey;
    const res = await fetch(url);
    const data = await res.json();
    return this.normalizeESGData(data, symbol);
  }

  // ---- Normalization ----
  private normalizeArticle(article: Record<string, unknown>): NewsArticle {
    return {
      title: (article.title as string) ?? '',
      description: (article.description as string) ?? '',
      source: (article.source as Record<string, string>)?.name ?? '',
      publishedAt: (article.publishedAt as string) ?? '',
      url: (article.url as string) ?? '',
      sentiment: undefined,
      relevanceScore: undefined,
      tickers: undefined,
    };
  }

  private normalizeJobData(data: Record<string, unknown>, symbol: string, companyName?: string): JobPostingData {
    return {
      company: (data.company as string) ?? companyName ?? symbol,
      symbol,
      activePostings: (data.activePostings as number) ?? 0,
      newPostings7d: (data.newPostings7d as number) ?? 0,
      avgSalary: (data.avgSalary as number) ?? 0,
      trend: (data.trend as JobPostingData['trend']) ?? 'stable',
      departments: (data.departments as JobPostingData['departments']) ?? [],
      timestamp: Date.now(),
    };
  }

  private normalizeESGData(data: Record<string, unknown>, symbol: string): ESGScore {
    return {
      symbol,
      environmental: (data.environmental as number) ?? 50,
      social: (data.social as number) ?? 50,
      governance: (data.governance as number) ?? 50,
      overall: (data.overall as number) ?? 50,
      controversyLevel: (data.controversyLevel as number) ?? 0,
      rankPercentile: (data.rankPercentile as number) ?? 0.5,
      timestamp: Date.now(),
    };
  }

  // ---- Mock generators ----
  private mockNewsSentiment(symbol: string): NewsSentimentResult {
    const seed = this.hash(symbol);
    return {
      symbol, avgSentiment: -0.3 + seed * 0.6, articleCount: 3 + Math.floor(seed * 20),
      sentimentVolatility: 0.1 + seed * 0.3,
      topKeywords: ['earnings', 'growth', 'revenue', 'competition', 'market'].sort(() => seed - 0.5).slice(0, 3),
      latestHeadline: symbol + ' reports quarterly results amid market volatility',
      timestamp: Date.now(),
    };
  }

  private mockArticles(symbol: string, limit: number): NewsArticle[] {
    const seed = this.hash(symbol);
    const articles: NewsArticle[] = [];
    for (let i = 0; i < limit; i++) {
      articles.push({
        title: symbol + ' Q' + (1 + i % 4) + ' earnings: ' + (seed > 0.5 ? 'beat' : 'miss'),
        description: 'Revenue ' + (seed > 0.5 ? 'exceeded' : 'fell short') + ' consensus by ' + (Math.abs(seed - 0.5) * 20).toFixed(1) + '%',
        source: ['Bloomberg', 'Reuters', 'CNBC', 'WSJ'][i % 4],
        publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
        url: 'https://example.com/news/' + i,
        sentiment: -0.5 + seed + (Math.random() - 0.5) * 0.3,
        relevanceScore: 0.5 + Math.random() * 0.5,
        tickers: [symbol],
      });
    }
    return articles;
  }

  private mockJobPostings(symbol: string, companyName?: string): JobPostingData {
    const seed = this.hash(symbol);
    return {
      company: companyName ?? symbol, symbol,
      activePostings: 50 + Math.floor(seed * 500),
      newPostings7d: 3 + Math.floor(seed * 30),
      avgSalary: 80_000 + seed * 100_000,
      trend: seed > 0.6 ? 'growing' : seed > 0.3 ? 'stable' : 'shrinking',
      departments: [
        { name: 'Engineering', count: 30 + Math.floor(seed * 100) },
        { name: 'Sales', count: 20 + Math.floor(seed * 50) },
        { name: 'Operations', count: 15 + Math.floor(seed * 30) },
      ],
      timestamp: Date.now(),
    };
  }

  private mockESG(symbol: string): ESGScore {
    const seed = this.hash(symbol);
    const e = 20 + seed * 60;
    const s = 25 + seed * 55;
    const g = 30 + seed * 50;
    return {
      symbol, environmental: e, social: s, governance: g,
      overall: (e + s + g) / 3, controversyLevel: Math.floor(seed * 3),
      rankPercentile: seed, timestamp: Date.now(),
    };
  }

  // ---- NLP helpers ----
  private extractKeywords(articles: NewsArticle[]): string[] {
    const words = new Map<string, number>();
    const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'are', 'was', 'were', 'this', 'that']);
    for (const a of articles) {
      const text = (a.title + ' ' + a.description).toLowerCase().replace(/[^a-z0-9 ]/g, '');
      const tokens = text.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
      for (const t of tokens) words.set(t, (words.get(t) ?? 0) + 1);
    }
    const entries = Array.from(words.entries());
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 5).map(([w]) => w);
  }

  private hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
    return (h % 1000) / 1000;
  }
}

// Singleton
let defaultAltData: AltDataAdapter | null = null;
export function getAltDataAdapter(config?: AltDataProviderConfig): AltDataAdapter {
  if (!defaultAltData) defaultAltData = new AltDataAdapter(config);
  return defaultAltData;
}
export function resetAltDataAdapter(): void { defaultAltData = null; }