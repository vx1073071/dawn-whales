/**
 * R242 JVS#1: NewsSentimentFactor — 消息因子值计算引擎
 *
 * Converts news sentiment signals into normalized factor values (-100 to +100)
 * usable across the entire Dawn Whales factor system.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │                     NewsSentimentFactor                              │
 *   │  ┌──────────────────────────────────────────────────────────────┐   │
 *   │  │ NEWS_SENTIMENT → FactorOutput (-100 ∼ +100)                  │   │
 *   │  │  ├─ titleSentiment  (–2.0 ∼ +2.0 weight)                     │   │
 *   │  │  ├─ bodySentiment   (–3.0 ∼ +3.0 weight)                     │   │
 *   │  │  ├─ sourceAuthority (0.3 ∼ 1.0 weight)                       │   │
 *   │  │  ├─ freshnessDecay  (hourly exponential decay)               │   │
 *   │  │  ├─ volumeIntensity (news count burst penalty/bonus)          │   │
 *   │  │  └─ marketAlignment (sector/region multiplier)               │   │
 *   │  └──────────────────┬───────────────────────────────────────────┘   │
 *   │                     │                                                │
 *   │  ┌──────────────────┴───────────────────────────────────────────┐   │
 *   │  │ Market Factor Outputs                                         │   │
 *   │  │  ├─ US equities:  N = news count, aggregated sentiment        │   │
 *   │  │  ├─ HK equities:  weighted by A+H premium correlation         │   │
 *   │  │  ├─ Crypto:       Twitter/Reddit social momentum amplified    │   │
 *   │  │  └─ Commodities:  supply-demand + geopolitics weighted        │   │
 *   │  └──────────────────────────────────────────────────────────────┘   │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * Factor formula:
 *   f(sym) = Σᵢ sentimentᵢ × authorityᵢ × freshnessᵢ × marketAlignᵢ
 *           / (Σᵢ authorityᵢ + ε)
 *
 *   final = clamp(f(sym) × 50, -100, +100)
 *
 * Pricing: FREE (公共因子, non-billable)
 *
 * v2.7.0-NEWS | production-ready
 */

import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export type NewsMarket = 'us_equities' | 'hk_equities' | 'crypto' | 'commodities' | 'global';

export interface NewsFactorInput {
  symbol: string;
  market: NewsMarket;
  titleSentiment: number;    // -1.0 ~ +1.0
  bodySentiment: number;     // -1.0 ~ +1.0
  source: string;            // e.g. 'reuters', 'bloomberg', 'wallstreetcn'
  sourceAuthority: number;   // 0.0 ~ 1.0
  publishedAt: number;       // unix ms
  volume?: number;           // news count in this batch (for intensity)
  categories?: string[];     // e.g. ['earnings', 'merger', 'regulation']
  sector?: string;           // e.g. 'tech', 'finance', 'energy'
}

export interface NewsFactorOutput {
  symbol: string;
  market: NewsMarket;
  factorName: 'NEWS_SENTIMENT';
  rawScore: number;          // unclamped sum
  normalizedValue: number;   // -100 ~ +100
  confidence: number;        // 0.0 ~ 1.0
  components: {
    sentimentWeighted: number;
    authorityMean: number;
    freshnessMean: number;
    volumeAdjustment: number;
    marketMultiplier: number;
  };
  newsCount: number;
  lastNewsAt: number;
  signalType: 'strong_bearish' | 'bearish' | 'neutral' | 'bullish' | 'strong_bullish';
  timestamp: number;
}

export interface BatchFactorOutput {
  factors: Map<string, NewsFactorOutput>;
  marketAggregates: Record<NewsMarket, { mean: number; stddev: number; count: number; topBull: string[]; topBear: string[] }>;
  processingTimeMs: number;
  totalNews: number;
  timestamp: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Source Authority Map
// ═════════════════════════════════════════════════════════════════════════════

const SOURCE_AUTHORITY: Record<string, number> = {
  reuters: 0.95, bloomberg: 0.95, wsj: 0.90, ft: 0.90,
  cnbc: 0.75, marketwatch: 0.70, seekingalpha: 0.45,
  wallstreetcn: 0.65, jin10: 0.55, sina: 0.40,
  reddit: 0.25, twitter: 0.20, stocktwits: 0.15,
  benzinga: 0.50, investing: 0.55, yahoo: 0.35,
  default: 0.50,
};

// Market alignment multipliers (higher = more correlation to news)
const MARKET_MULTIPLIERS: Record<NewsMarket, number> = {
  us_equities: 1.0,
  hk_equities: 1.15,  // HK more policy-driven → news matters more
  crypto: 1.5,         // Crypto extremely news/social-driven
  commodities: 1.2,    // Commodities very geopolitics-driven
  global: 1.0,
};

// ═════════════════════════════════════════════════════════════════════════════
// NewsSentimentFactor
// ═════════════════════════════════════════════════════════════════════════════

export class NewsSentimentFactor {
  private config = {
    sentimentWeight: { title: 2.0, body: 3.0 },
    freshnessHalfLifeHours: 4,
    volumeThreshold: 5,     // news count above which we consider "burst"
    volumePenalty: 0.3,     // burst intensity penalty multiplier
    confidenceDecayDays: 7,
    minConfidence: 0.1,
    epsilon: 0.001,
  };

  // ── Single Symbol Factor ──────────────────────────────────────────────

  /**
   * Compute NEWS_SENTIMENT factor for a single symbol from multiple news inputs.
   */
  compute(symbol: string, market: NewsMarket, newsItems: NewsFactorInput[]): NewsFactorOutput {
    const now = Date.now();

    if (newsItems.length === 0) {
      return {
        symbol, market, factorName: 'NEWS_SENTIMENT',
        rawScore: 0, normalizedValue: 0, confidence: 0,
        components: { sentimentWeighted: 0, authorityMean: 0, freshnessMean: 0, volumeAdjustment: 0, marketMultiplier: this.getMarketMultiplier(market) },
        newsCount: 0, lastNewsAt: 0, signalType: 'neutral', timestamp: now,
      };
    }

    let totalWeighted = 0;
    let totalAuthorityWeight = 0;
    let totalFreshness = 0;

    for (const item of newsItems) {
      const authority = this.getAuthority(item.source);
      const freshness = this.computeFreshness(item.publishedAt, now);
      const sentiment = this.combineSentiment(item.titleSentiment, item.bodySentiment);

      const weight = authority * freshness;
      totalWeighted += sentiment * weight;
      totalAuthorityWeight += authority;
      totalFreshness += freshness;
    }

    const n = newsItems.length;
    const meanAuthority = totalAuthorityWeight / n;
    const meanFreshness = totalFreshness / n;

    const rawScore = totalWeighted / (totalAuthorityWeight + this.config.epsilon);

    const volumeAdjustment = this.computeVolumeAdjustment(n, newsItems);
    const marketMult = this.getMarketMultiplier(market);

    const adjustedScore = (rawScore + volumeAdjustment) * marketMult;
    const normalizedValue = this.clamp(adjustedScore * 50, -100, 100);

    const confidence = this.computeConfidence(n, meanAuthority, meanFreshness);

    const now2 = Date.now();
    const lastNewsAt = Math.max(...newsItems.map(ni => ni.publishedAt));

    return {
      symbol, market, factorName: 'NEWS_SENTIMENT',
      rawScore: Math.round(rawScore * 10000) / 10000,
      normalizedValue: Math.round(normalizedValue * 100) / 100,
      confidence: Math.round(confidence * 10000) / 10000,
      components: {
        sentimentWeighted: Math.round(totalWeighted * 10000) / 10000,
        authorityMean: Math.round(meanAuthority * 10000) / 10000,
        freshnessMean: Math.round(meanFreshness * 10000) / 10000,
        volumeAdjustment: Math.round(volumeAdjustment * 10000) / 10000,
        marketMultiplier: marketMult,
      },
      newsCount: n,
      lastNewsAt,
      signalType: this.classifySignal(normalizedValue, confidence),
      timestamp: now2,
    };
  }

  // ── Batch Compute ─────────────────────────────────────────────────────

  /**
   * Compute NEWS_SENTIMENT for multiple symbols in a batch.
   */
  computeBatch(items: NewsFactorInput[]): BatchFactorOutput {
    const start = Date.now();

    // Group by symbol
    const bySymbol = new Map<string, NewsFactorInput[]>();
    for (const item of items) {
      const key = item.symbol;
      if (!bySymbol.has(key)) bySymbol.set(key, []);
      bySymbol.get(key)!.push(item);
    }

    const factors = new Map<string, NewsFactorOutput>();
    const marketValues: Record<NewsMarket, number[]> = {
      us_equities: [], hk_equities: [], crypto: [], commodities: [], global: [],
    };

    for (const [sym, news] of bySymbol) {
      const market = news[0].market || 'global';
      const output = this.compute(sym, market, news);
      factors.set(sym, output);
      marketValues[market].push(output.normalizedValue);
    }

    // Market aggregates
    const marketAggregates: BatchFactorOutput['marketAggregates'] = {} as any;
    for (const [mkt, vals] of Object.entries(marketValues)) {
      if (vals.length === 0) {
        marketAggregates[mkt as NewsMarket] = { mean: 0, stddev: 0, count: 0, topBull: [], topBear: [] };
        continue;
      }
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      marketAggregates[mkt as NewsMarket] = {
        mean: Math.round(mean * 100) / 100,
        stddev: Math.round(Math.sqrt(variance) * 100) / 100,
        count: vals.length,
        topBull: [], topBear: [], // filled below
      };
    }

    // Top/Bottom symbols by market
    for (const mkt of ['us_equities', 'hk_equities', 'crypto', 'commodities', 'global'] as NewsMarket[]) {
      const syms = [...factors.entries()]
        .filter(([, o]) => o.market === mkt)
        .sort((a, b) => b[1].normalizedValue - a[1].normalizedValue);
      marketAggregates[mkt].topBull = syms.slice(0, 3).map(([s]) => s);
      marketAggregates[mkt].topBear = syms.slice(-3).reverse().map(([s]) => s);
    }

    const totalNews = items.length;
    log.info(`[NSF] Batch: ${factors.size} symbols, ${totalNews} news items, ${Date.now() - start}ms`);

    return {
      factors,
      marketAggregates,
      processingTimeMs: Date.now() - start,
      totalNews,
      timestamp: Date.now(),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private combineSentiment(title: number, body: number): number {
    return title * this.config.sentimentWeight.title +
           body * this.config.sentimentWeight.body;
  }

  private getAuthority(source: string): number {
    const key = source.toLowerCase().replace(/[^a-z]/g, '');
    return SOURCE_AUTHORITY[key] || SOURCE_AUTHORITY.default;
  }

  private computeFreshness(publishedAt: number, now: number): number {
    const hoursOld = (now - publishedAt) / (1000 * 60 * 60);
    const halfLife = this.config.freshnessHalfLifeHours;
    return Math.exp(-Math.LN2 * hoursOld / halfLife);
  }

  private getMarketMultiplier(market: NewsMarket): number {
    return MARKET_MULTIPLIERS[market] || 1.0;
  }

  private computeVolumeAdjustment(count: number, items: NewsFactorInput[]): number {
    if (count <= this.config.volumeThreshold) return 0;
    // Burst detection: many news in short time
    const { volumePenalty } = this.config;
    // Check if all items arrived within a short window
    if (items.length < 2) return 0;
    const times = items.map(i => i.publishedAt).sort();
    const windowMs = times[times.length - 1] - times[0];
    const density = count / Math.max(windowMs, 1);

    if (density > 0.001) return -(count - this.config.volumeThreshold) / count * volumePenalty;
    return 0;
  }

  private computeConfidence(count: number, authority: number, freshness: number): number {
    let conf = Math.min(count / 10, 1) * authority * freshness;
    conf = Math.max(conf, this.config.minConfidence);
    return Math.min(conf, 1);
  }

  private classifySignal(value: number, confidence: number): NewsFactorOutput['signalType'] {
    if (confidence < 0.2) return 'neutral';
    if (value >= 60) return 'strong_bullish';
    if (value >= 20) return 'bullish';
    if (value <= -60) return 'strong_bearish';
    if (value <= -20) return 'bearish';
    return 'neutral';
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  // ── Utility ───────────────────────────────────────────────────────────

  getAuthorityMap(): Record<string, number> {
    return { ...SOURCE_AUTHORITY };
  }

  getMarketMultipliers(): Record<NewsMarket, number> {
    return { ...MARKET_MULTIPLIERS };
  }

  setConfig(updates: Partial<typeof this.config>): void {
    Object.assign(this.config, updates);
  }

  getConfig(): typeof this.config {
    return { ...this.config };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultNSF: NewsSentimentFactor | null = null;

export function getNewsSentimentFactor(): NewsSentimentFactor {
  if (!defaultNSF) defaultNSF = new NewsSentimentFactor();
  return defaultNSF;
}

export function resetNewsSentimentFactor(): void {
  defaultNSF = null;
}
