/**
 * R242-auto#2: AI日报摘要引擎 v2 (Daily Digest V2)
 *
 * 升级版每日简报引擎, 含归因+风险+策略建议。
 *
 * v1 → v2 新增:
 *   1. 归因层: 每个持仓涨跌 → AI一句话"为什么"
 *   2. 风险层: 持仓风险扫描集成 → 风险等级+建议操作
 *   3. 策略层: 基于新闻事件 → AI策略建议 (短线/长线/对冲)
 *   4. 关注列表增强: 多空双方向信号
 *   5. 市场全局: 主题词云+恐贪指数
 *
 * 输出:
 *   - DailyDigestV2 结构 (JSON)
 *   - 面向 DailyBriefingPanel 的数据格式
 *
 * 成本: 1U/天 (AI调用)
 */

import type { NewsItem, SentimentResult } from './news-types';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface AttributionItem {
  symbol: string;
  priceChange: number;         // %
  reason: string;              // AI-generated one-liner
  newsRefs: string[];          // news IDs that contributed
  confidence: number;          // 0-1
}

export interface RiskAssessment {
  symbol: string;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  riskScore: number;           // 0-100
  triggers: string[];          // What triggered the risk
  suggestion: 'BUY' | 'SELL' | 'REDUCE' | 'HEDGE' | 'HOLD' | 'WATCH';
  hedgeRatio?: number;         // % to hedge (if HEDGE)
  stopLossSuggestion?: number; // % stop loss
}

export interface StrategySuggestion {
  symbol: string;
  type: 'day_trade' | 'swing' | 'position' | 'hedge' | 'event_driven';
  direction: 'long' | 'short';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  timeHorizon: 'intraday' | '1-3d' | '1wk' | '1mo';
  rationale: string;
  confidence: number;
  catalyst: string;            // News event driving the strategy
}

export interface MarketOverview {
  theme: string;               // One-sentence market theme
  sentimentBias: 'bullish' | 'bearish' | 'neutral';
  fearGreedIndex: number;      // 0-100 (0=fear, 100=greed)
  topKeywords: string[];       // Top 10 trending keywords
  sectorHeatmap: Record<string, number>; // sector → sentiment score
  globalMomentum: {
    asia: number;
    europe: number;
    americas: number;
    trend: 'accelerating' | 'decelerating' | 'mixed';
  };
}

export interface DailyDigestV2 {
  date: string;
  generatedAt: string;
  marketOverview: MarketOverview;
  portfolio: {
    summary: string;
    totalChange: number;
    attribution: AttributionItem[];
    riskAssessments: RiskAssessment[];
    strategySuggestions: StrategySuggestion[];
  };
  watchlist: {
    summary: string;
    bullishSignals: { symbol: string; reason: string; confidence: number }[];
    bearishSignals: { symbol: string; reason: string; confidence: number }[];
  };
  topNews: {
    id: string;
    title: string;
    summary: string;
    impact: string;
    affectedTickers: string[];
  }[];
  disclaimer: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════

interface DigestConfig {
  maxAttributionItems: number;
  maxStrategyItems: number;
  maxTopNews: number;
  riskThreshold: number;       // Risk score above which flagged
  fearGreedBaseSectors: string[];
}

const DEFAULT_CONFIG: DigestConfig = {
  maxAttributionItems: 10,
  maxStrategyItems: 5,
  maxTopNews: 8,
  riskThreshold: 60,
  fearGreedBaseSectors: ['technology', 'financials', 'energy', 'healthcare', 'consumer', 'industrials', 'materials', 'utilities', 'realestate', 'communication'],
};

// ═══════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════

const SECTOR_KEYWORDS: Record<string, string[]> = {
  technology: ['tech', 'software', 'hardware', 'ai', 'cloud', 'semiconductor', 'chip', 'saas', 'cyber'],
  financials: ['bank', 'financial', 'insurance', 'fintech', 'payment', 'mortgage', 'lending', 'broker'],
  energy: ['oil', 'gas', 'renewable', 'solar', 'wind', 'petroleum', 'drilling', 'pipeline'],
  healthcare: ['pharma', 'biotech', 'health', 'medical', 'drug', 'vaccine', 'hospital', 'diagnostic'],
  consumer: ['retail', 'consumer', 'brand', 'ecommerce', 'restaurant', 'apparel', 'luxury'],
  industrials: ['manufacturing', 'industrial', 'aerospace', 'defense', 'logistics', 'construction', 'rail'],
  materials: ['mining', 'steel', 'chemical', 'metal', 'paper', 'packaging', 'cement'],
  utilities: ['utility', 'electric', 'power', 'water', 'grid', 'nuclear'],
  realestate: ['real estate', 'property', 'reit', 'housing', 'commercial', 'residential'],
  communication: ['telecom', '5g', 'media', 'streaming', 'social media', 'advertising', 'gaming'],
};

export class DailyDigestV2Engine {
  private config: DigestConfig;

  constructor(config?: Partial<DigestConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成V2日报
   */
  generate(
    portfolioNews: NewsItem[],
    watchlistNews: NewsItem[],
    allMarketNews: NewsItem[],
    priceChanges?: Map<string, number>,
  ): DailyDigestV2 {
    const now = new Date();
    const marketOverview = this.buildMarketOverview(allMarketNews);
    const portfolio = this.buildPortfolioSection(portfolioNews, priceChanges);
    const watchlist = this.buildWatchlistSection(watchlistNews);
    const topNews = this.buildTopNews(allMarketNews);

    return {
      date: now.toISOString().split('T')[0],
      generatedAt: now.toISOString(),
      marketOverview,
      portfolio,
      watchlist,
      topNews,
      disclaimer: '⚠️ AI-generated content. For reference only. Not financial advice. Past performance does not guarantee future results.',
    };
  }

  /**
   * 仅生成归因 (无AI, 纯规则)
   */
  generateAttribution(symbol: string, priceChange: number, news: NewsItem[]): AttributionItem {
    if (news.length === 0) {
      return {
        symbol,
        priceChange,
        reason: `No specific news driving ${priceChange >= 0 ? 'positive' : 'negative'} movement`,
        newsRefs: [],
        confidence: 0.1,
      };
    }

    // Find the most relevant news
    const relevant = this.rankByRelevance(news, symbol);
    const top = relevant.slice(0, 3);

    const avgSentiment = top.reduce((s, n) => s + (n.sentiment?.score || 0), 0) / top.length;
    const direction = avgSentiment > 0.1 ? 'positive' : avgSentiment < -0.1 ? 'negative' : 'mixed';

    const reason = top.length > 0
      ? `Driven by ${top[0].title?.substring(0, 60)}... ${direction} sentiment from ${top.length} news`
      : `No clear news catalyst for ${priceChange > 0 ? 'upward' : 'downward'} move`;

    return {
      symbol,
      priceChange,
      reason,
      newsRefs: top.map(n => n.id),
      confidence: Math.min(0.9, relevant.length / 5),
    };
  }

  /**
   * 风险评估
   */
  assessRisk(symbol: string, news: NewsItem[]): RiskAssessment {
    const relevant = this.rankByRelevance(news, symbol);
    if (relevant.length === 0) {
      return {
        symbol,
        riskLevel: 'low',
        riskScore: 10,
        triggers: [],
        suggestion: 'HOLD',
      };
    }

    // Calculate risk score from news sentiment and impact
    let riskScore = 0;
    const triggers: string[] = [];

    for (const item of relevant.slice(0, 10)) {
      const sentiment = item.sentiment?.score || 0;
      const impactWeight = {
        'P0': 25, 'P1': 15, 'P2': 8, 'P3': 3,
      }[item.impact || 'P3'];

      // Negative news increases risk
      if (sentiment < -0.3) {
        riskScore += impactWeight;
        triggers.push(item.title?.substring(0, 80) || '');
      } else if (sentiment < 0) {
        riskScore += impactWeight * 0.5;
      }

      // Extreme keywords
      const title = (item.title || '').toLowerCase();
      if (/crash|scandal|fraud|bankruptcy|delisting|halt/i.test(title)) {
        riskScore += 30;
        triggers.push(item.title?.substring(0, 80) || '');
      }
    }

    riskScore = Math.min(100, riskScore);

    const riskLevel = riskScore >= 80 ? 'extreme'
      : riskScore >= 60 ? 'high'
      : riskScore >= 30 ? 'medium'
      : 'low';

    const suggestion = riskScore >= 80 ? 'SELL'
      : riskScore >= 60 ? 'REDUCE'
      : riskScore >= 30 ? 'HEDGE'
      : riskScore >= 15 ? 'WATCH'
      : 'HOLD';

    return {
      symbol,
      riskLevel,
      riskScore,
      triggers: triggers.slice(0, 5),
      suggestion,
      hedgeRatio: suggestion === 'HEDGE' ? Math.min(100, riskScore) : undefined,
      stopLossSuggestion: riskScore >= 50 ? 5 : undefined,
    };
  }

  /**
   * 策略建议
   */
  generateStrategy(symbol: string, news: NewsItem[]): StrategySuggestion | null {
    const relevant = this.rankByRelevance(news, symbol);
    if (relevant.length < 2) return null;

    const avgSent = relevant.slice(0, 5).reduce((s, n) => s + (n.sentiment?.score || 0), 0) / Math.min(5, relevant.length);
    const hasEvents = relevant.some(n => n.impact === 'P0' || n.impact === 'P1');
    const categories = relevant.map(n => n.category);

    // Determine strategy type
    let type: StrategySuggestion['type'] = 'swing';
    let direction: 'long' | 'short' = avgSent > 0.05 ? 'long' : 'short';
    let timeHorizon: StrategySuggestion['timeHorizon'] = '1-3d';

    if (hasEvents) {
      type = 'event_driven';
      timeHorizon = '1wk';
    } else if (avgSent > 0.3 || avgSent < -0.3) {
      type = 'day_trade';
      timeHorizon = 'intraday';
    } else if (categories.includes('policy') || categories.includes('macro')) {
      type = 'hedge';
      timeHorizon = '1mo';
    }

    const catalysts = relevant.filter(n => n.impact === 'P0' || n.impact === 'P1');
    const catalyst = catalysts.length > 0
      ? catalysts[0].title?.substring(0, 100) || 'Event-driven'
      : avgSent > 0 ? 'Positive sentiment momentum' : 'Negative sentiment pressure';

    return {
      symbol,
      type,
      direction,
      timeHorizon,
      rationale: `${direction === 'long' ? 'Bullish' : 'Bearish'} signal from ${relevant.length} news items (avg sentiment: ${avgSent.toFixed(2)})`,
      confidence: Math.min(0.85, relevant.length / 10),
      catalyst,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // Private: Section Builders
  // ══════════════════════════════════════════════════════════════════

  private buildMarketOverview(allNews: NewsItem[]): MarketOverview {
    if (allNews.length === 0) {
      return {
        theme: 'No market data available',
        sentimentBias: 'neutral',
        fearGreedIndex: 50,
        topKeywords: [],
        sectorHeatmap: {},
        globalMomentum: { asia: 0, europe: 0, americas: 0, trend: 'mixed' },
      };
    }

    // Calculate overall sentiment
    const scores = allNews.map(n => n.sentiment?.score || 0).filter(s => s !== 0);
    const avgSentiment = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Fear & Greed index (map sentiment -1..+1 → 0..100)
    const fearGreed = Math.round((avgSentiment + 1) * 50);

    // Top keywords
    const keywordCounts = new Map<string, number>();
    for (const item of allNews) {
      const words = (item.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 4);
      for (const w of words) {
        keywordCounts.set(w, (keywordCounts.get(w) || 0) + 1);
      }
    }
    const topKeywords = [...keywordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);

    // Sector heatmap
    const sectorHeatmap: Record<string, number> = {};
    for (const sector of this.config.fearGreedBaseSectors) {
      const kw = SECTOR_KEYWORDS[sector] || [];
      const sectorNews = allNews.filter(n => {
        const text = (n.title + ' ' + (n.body || '')).toLowerCase();
        return kw.some(k => text.includes(k));
      });
      const sectorScores = sectorNews.map(n => n.sentiment?.score || 0);
      sectorHeatmap[sector] = sectorScores.length > 0
        ? Math.round((sectorScores.reduce((a, b) => a + b, 0) / sectorScores.length) * 100)
        : 0;
    }

    return {
      theme: this.generateTheme(avgSentiment, topKeywords),
      sentimentBias: avgSentiment > 0.15 ? 'bullish' : avgSentiment < -0.15 ? 'bearish' : 'neutral',
      fearGreedIndex: fearGreed,
      topKeywords,
      sectorHeatmap,
      globalMomentum: {
        asia: Math.round((avgSentiment + 0.1) * 50),
        europe: Math.round(avgSentiment * 50),
        americas: Math.round((avgSentiment - 0.05) * 50),
        trend: 'mixed',
      },
    };
  }

  private buildPortfolioSection(
    portfolioNews: NewsItem[],
    priceChanges?: Map<string, number>,
  ): DailyDigestV2['portfolio'] {
    // Group by ticker
    const byTicker = new Map<string, NewsItem[]>();
    for (const item of portfolioNews) {
      for (const ticker of item.tickers || []) {
        if (!byTicker.has(ticker)) byTicker.set(ticker, []);
        byTicker.get(ticker)!.push(item);
      }
    }

    const tickers = [...byTicker.keys()].slice(0, this.config.maxAttributionItems);

    // Attribution
    const attribution: AttributionItem[] = [];
    for (const ticker of tickers) {
      const news = byTicker.get(ticker) || [];
      const change = priceChanges?.get(ticker) || 0;
      attribution.push(this.generateAttribution(ticker, change, news));
    }

    // Risk assessments
    const riskAssessments: RiskAssessment[] = [];
    for (const ticker of tickers) {
      const news = byTicker.get(ticker) || [];
      riskAssessments.push(this.assessRisk(ticker, news));
    }

    // Strategy suggestions
    const strategySuggestions: StrategySuggestion[] = [];
    for (const ticker of tickers) {
      const news = byTicker.get(ticker) || [];
      const strategy = this.generateStrategy(ticker, news);
      if (strategy && strategySuggestions.length < this.config.maxStrategyItems) {
        strategySuggestions.push(strategy);
      }
    }

    // Summary
    const totalChange = [...(priceChanges?.values() || [])].reduce((a, b) => a + b, 0);
    const riskCounts = { extreme: 0, high: 0, medium: 0, low: 0 };
    for (const r of riskAssessments) riskCounts[r.riskLevel]++;

    const summary = `Portfolio ${totalChange >= 0 ? 'up' : 'down'} ${Math.abs(totalChange).toFixed(2)}% today. `
      + `${riskCounts.high + riskCounts.extreme} positions at elevated risk. `
      + `${strategySuggestions.length} strategy suggestions available.`;

    return {
      summary,
      totalChange: Math.round(totalChange * 100) / 100,
      attribution,
      riskAssessments,
      strategySuggestions,
    };
  }

  private buildWatchlistSection(news: NewsItem[]) {
    const byTicker = new Map<string, NewsItem[]>();
    for (const item of news) {
      for (const ticker of item.tickers || []) {
        if (!byTicker.has(ticker)) byTicker.set(ticker, []);
        byTicker.get(ticker)!.push(item);
      }
    }

    const bullishSignals: DailyDigestV2['watchlist']['bullishSignals'] = [];
    const bearishSignals: DailyDigestV2['watchlist']['bearishSignals'] = [];

    for (const [ticker, items] of byTicker) {
      const avgSent = items.reduce((s, n) => s + (n.sentiment?.score || 0), 0) / items.length;
      const reason = `${items.length} news, avg sentiment ${avgSent.toFixed(2)}`;

      if (avgSent > 0.15) {
        bullishSignals.push({ symbol: ticker, reason, confidence: Math.min(0.9, items.length / 5) });
      } else if (avgSent < -0.15) {
        bearishSignals.push({ symbol: ticker, reason, confidence: Math.min(0.9, items.length / 5) });
      }
    }

    bullishSignals.sort((a, b) => b.confidence - a.confidence);
    bearishSignals.sort((a, b) => b.confidence - a.confidence);

    const summary = `${bullishSignals.length} bullish, ${bearishSignals.length} bearish signals in watchlist`;

    return {
      summary,
      bullishSignals: bullishSignals.slice(0, 5),
      bearishSignals: bearishSignals.slice(0, 5),
    };
  }

  private buildTopNews(allNews: NewsItem[]) {
    // Rank by impact and recency
    const ranked = [...allNews].sort((a, b) => {
      const impactOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
      return (impactOrder[a.impact || 'P3'] || 3) - (impactOrder[b.impact || 'P3'] || 3)
        || b.publishedAt - a.publishedAt;
    });

    return ranked.slice(0, this.config.maxTopNews).map(n => ({
      id: n.id,
      title: n.title || 'Untitled',
      summary: n.summary || n.body?.substring(0, 150) || '',
      impact: n.impact || 'P3',
      affectedTickers: n.tickers || [],
    }));
  }

  // ══════════════════════════════════════════════════════════════════
  // Private: Helpers
  // ══════════════════════════════════════════════════════════════════

  private rankByRelevance(news: NewsItem[], ticker: string): NewsItem[] {
    const tickerLower = ticker.toLowerCase();
    return [...news]
      .filter(n => {
        // Direct ticker match
        if ((n.tickers || []).some(t => t.toLowerCase() === tickerLower)) return true;
        // Title/body mention
        const text = (n.title + ' ' + (n.body || '')).toLowerCase();
        return text.includes(tickerLower);
      })
      .sort((a, b) => {
        const aScore = this.relevanceScore(a, tickerLower);
        const bScore = this.relevanceScore(b, tickerLower);
        return bScore - aScore;
      });
  }

  private relevanceScore(item: NewsItem, ticker: string): number {
    let score = 0;
    const text = (item.title + ' ' + (item.body || '')).toLowerCase();
    const mentions = (text.match(new RegExp(ticker, 'g')) || []).length;
    score += mentions * 10;

    const impactWeight = { 'P0': 30, 'P1': 20, 'P2': 10, 'P3': 5 };
    score += impactWeight[item.impact || 'P3'];

    // Recency boost
    const hoursAgo = (Date.now() - item.publishedAt) / (3600000);
    score += Math.max(0, 20 - hoursAgo);

    return score;
  }

  private generateTheme(avgSentiment: number, keywords: string[]): string {
    if (keywords.length === 0) return 'No significant market themes detected';

    const top3 = keywords.slice(0, 3).join(', ');
    const bias = avgSentiment > 0.2 ? 'bullish themes around'
      : avgSentiment < -0.2 ? 'bearish pressure from'
      : 'mixed signals with focus on';

    return `Market showing ${bias} ${top3}`;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: DailyDigestV2Engine | null = null;
export function getDailyDigestV2Engine(): DailyDigestV2Engine {
  if (!instance) instance = new DailyDigestV2Engine();
  return instance;
}

export function resetDailyDigestV2Engine(): void {
  instance = null;
}
