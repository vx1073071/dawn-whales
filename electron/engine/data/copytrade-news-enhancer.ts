/**
 * R243-auto#1: CopytradeNewsEnhancer — 跟单新闻增强引擎
 * v2.7.0 NEWS INTELLIGENCE — 社区与跟单增强
 *
 * Architecture:
 *   1. Trade→News Matching — 高手调仓→关联新闻(ticker/时间/类别/情绪匹配)
 *   2. News Context Enrichment — 跟单订单自动附加新闻上下文
 *   3. Creator Trade Justification — 从新闻中提取调仓理由
 *   4. Follower Notification Augmentation — 跟单者通知附带新闻摘要
 *
 * Integrates with:
 *   - FollowTradePipeline (R210) → copytrade order flow
 *   - NewsStockScreener (R240) → ticker screening
 *   - DailyDigestV2Engine (R242) → daily digest context
 *   - AISentimentEngine (R239) → sentiment analysis
 *
 * Constraints: ZERO external cost, pure engine, no new dependencies
 * ≥400L production-ready
 */

import log from 'electron-log';
import type { NewsItem, SentimentResult } from './news-types';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Trade direction */
export type TradeDirection = 'BUY' | 'SELL' | 'CLOSE';

/** Trade signal from a creator */
export interface CreatorTradeSignal {
  tradeId: string;
  creatorId: string;
  creatorName: string;
  symbol: string;
  direction: TradeDirection;
  quantity: number;
  price?: number;
  timestamp: number;
  strategyId?: string;
  strategyName?: string;
  market?: 'US' | 'HK' | 'A' | 'Crypto';
}

/** News match result for a trade */
export interface TradeNewsMatch {
  tradeId: string;
  matchedNews: MatchedNewsItem[];
  topJustification: string;       // best single reason for the trade
  sentimentSummary: SentimentSummary;
  confidence: number;             // match confidence 0-1
  justificationKeywords: string[]; // key justification terms
}

/** Individual matched news item */
export interface MatchedNewsItem {
  newsId: string;
  title: string;
  source: string;
  publishedAt: number;
  matchScore: number;             // relevance 0-100
  matchReasons: string[];         // why this matches
  sentiment: SentimentResult | null;
  category: string;
  snippet: string;                // 80-char summary
}

/** Sentiment summary across matched news */
export interface SentimentSummary {
  score: number;                  // -1 to +1 aggregated
  label: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
  consensus: number;              // how aligned the sources are (0-1)
  sourceCount: number;
  topKeywords: string[];
}

/** Enriched copytrade order (for follower confirmation UI) */
export interface EnrichedCopytradeOrder {
  tradeId: string;
  symbol: string;
  direction: TradeDirection;
  quantity: number;
  creatorName: string;
  newsContext: string;            // natural language news context
  justification: string;          // 1-line justification
  sentimentLabel: SentimentSummary['label'];
  relatedNewsCount: number;
  topNewsTitle?: string;
  riskSignal?: 'GREEN' | 'YELLOW' | 'RED';
  generatedAt: number;
}

/** Follower notification with news enrichment */
export interface EnhancedNotification {
  followerId: string;
  creatorId: string;
  creatorName: string;
  trade: EnrichedCopytradeOrder;
  message: string;                // full notification text
  briefMessage: string;           // push-short version
  newsLinks: { title: string; url?: string }[];
  requiresConfirmation: boolean;
}

/** Engine statistics */
export interface CopytradeNewsStats {
  totalTradesProcessed: number;
  totalNewsMatched: number;
  avgNewsPerTrade: number;
  avgMatchConfidence: number;
  justificationCacheSize: number;
  topSymbols: { symbol: string; count: number }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Keyword & Matching Data
// ═══════════════════════════════════════════════════════════════════════════════

/** Direction→sentiment alignment keywords */
const BUY_KEYWORDS = [
  'beat', 'surprise', 'upgrade', 'buy', 'outperform', 'overweight',
  'growth', 'record', 'breakthrough', 'launch', 'approved', 'partnership',
  'guidance raised', 'strong demand', 'expanding', 'bullish',
  '利好', '超预期', '上调', '增长', '突破', '买入', '合作', '获批',
];
const SELL_KEYWORDS = [
  'miss', 'downgrade', 'sell', 'underperform', 'underweight',
  'decline', 'loss', 'layoff', 'investigation', 'fine', 'lawsuit',
  'warning', 'cut guidance', 'weak demand', 'bearish', 'recall',
  '利空', '不及预期', '下调', '下跌', '亏损', '调查', '罚款', '诉讼',
];

/** Risk escalation keywords */
const RISK_KEYWORDS = [
  'crash', 'scandal', 'fraud', 'bankruptcy', 'delisting', 'halt',
  'suspension', 'SEC investigation', 'DOJ', 'class action',
  '违约', '造假', '退市', '停牌', '调查', '诉讼',
];

/** Ticker matching patterns: normalize symbols for cross-market comparison */
function normalizeTicker(t: string): string {
  return t.toUpperCase().replace(/[.\- ].*$/, '').replace(/^([\d]+)/, '$1');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CopytradeNewsEnhancer
// ═══════════════════════════════════════════════════════════════════════════════

export class CopytradeNewsEnhancer {
  /** Internal news index: ticker → sorted news items */
  private newsIndex: Map<string, NewsItem[]> = new Map();
  /** Cache of trade→news matches (tradeId → match) */
  private matchCache: Map<string, TradeNewsMatch> = new Map();
  /** Cache of enriched orders */
  private orderCache: Map<string, EnrichedCopytradeOrder> = new Map();
  /** Maximum cache size */
  private readonly maxCacheSize = 500;
  /** Latest ingested timestamp */
  private lastIngestTime = 0;

  // ── News Ingestion ─────────────────────────────────────────────────────────

  /**
   * Ingest news items into the enhancer's index.
   * Replaces/adds news per ticker, keeps only items within the lookback window.
   */
  ingestNews(items: NewsItem[], lookbackDays = 14): void {
    const cutoff = Date.now() - lookbackDays * 24 * 3600_000;

    for (const item of items) {
      if (item.publishedAt < cutoff) continue;
      for (const ticker of (item.tickers || [])) {
        const norm = normalizeTicker(ticker);
        if (!this.newsIndex.has(norm)) {
          this.newsIndex.set(norm, []);
        }
        const bucket = this.newsIndex.get(norm)!;
        // Dedup within bucket by ID
        if (!bucket.some(n => n.id === item.id)) {
          bucket.push(item);
        }
      }
    }

    // Sort each bucket by publishedAt descending
    for (const [, bucket] of this.newsIndex) {
      bucket.sort((a, b) => b.publishedAt - a.publishedAt);
    }

    this.lastIngestTime = Date.now();
    log.info(`[CopytradeNewsEnhancer] Ingested ${items.length} news items across ${this.newsIndex.size} tickers`);
  }

  // ── Trade→News Matching ────────────────────────────────────────────────────

  /**
   * Match a creator trade to relevant news.
   * Returns enriched match with justifications, sentiment summary, and confidence.
   */
  matchTrade(signal: CreatorTradeSignal): TradeNewsMatch {
    const cached = this.matchCache.get(signal.tradeId);
    if (cached) return cached;

    const normSymbol = normalizeTicker(signal.symbol);
    const bucket = this.newsIndex.get(normSymbol) || [];

    if (bucket.length === 0) {
      const empty: TradeNewsMatch = {
        tradeId: signal.tradeId,
        matchedNews: [],
        topJustification: 'No recent news found for this symbol.',
        sentimentSummary: { score: 0, label: 'neutral', consensus: 1, sourceCount: 0, topKeywords: [] },
        confidence: 0,
        justificationKeywords: [],
      };
      return empty;
    }

    // Score each news item against the trade
    const scored: { item: NewsItem; score: number; reasons: string[] }[] = [];

    for (const item of bucket) {
      let score = 0;
      const reasons: string[] = [];

      // 1. Time proximity (max 30pts) — recent news more relevant
      const hoursAgo = (signal.timestamp - item.publishedAt) / 3600_000;
      if (hoursAgo <= 2) { score += 30; reasons.push(`Published ${Math.round(hoursAgo * 60)}min ago`); }
      else if (hoursAgo <= 6) { score += 25; }
      else if (hoursAgo <= 24) { score += 20; }
      else if (hoursAgo <= 48) { score += 10; }
      else if (hoursAgo <= 72) { score += 5; }

      // 2. Impact level (max 20pts)
      if (item.impact === 'P0') { score += 20; reasons.push('P0 impact'); }
      else if (item.impact === 'P1') { score += 12; }
      else if (item.impact === 'P2') { score += 6; }

      // 3. Sentiment-direction alignment (max 25pts)
      const sentScore = item.sentiment?.score ?? 0;
      if (signal.direction === 'BUY' && sentScore > 0.3) {
        score += 25;
        reasons.push('Sentiment aligned with buy');
      } else if (signal.direction === 'BUY' && sentScore > 0.1) {
        score += 15;
      } else if (signal.direction === 'SELL' && sentScore < -0.3) {
        score += 25;
        reasons.push('Sentiment aligned with sell');
      } else if (signal.direction === 'SELL' && sentScore < -0.1) {
        score += 15;
      } else if (signal.direction === 'CLOSE' && Math.abs(sentScore) > 0.3) {
        score += 10;
      }

      // 4. Keyword matching (max 15pts)
      const keywordSet = signal.direction === 'BUY' ? BUY_KEYWORDS : SELL_KEYWORDS;
      const text = (item.title + ' ' + item.body).toLowerCase();
      const matches = keywordSet.filter(k => text.includes(k.toLowerCase()));
      score += Math.min(15, matches.length * 3);
      if (matches.length >= 3) reasons.push(`${matches.length} keyword matches`);

      // 5. Category bonus (max 10pts)
      if (item.category === 'earnings') { score += 10; reasons.push('Earnings event'); }
      else if (item.category === 'breaking') { score += 8; reasons.push('Breaking news'); }
      else if (item.category === 'policy') { score += 6; }

      scored.push({ item, score, reasons });
    }

    // Sort by score descending, take top 5
    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, 5).filter(s => s.score >= 10);

    // Build matched news items
    const matchedNews: MatchedNewsItem[] = topMatches.map(s => ({
      newsId: s.item.id,
      title: s.item.title,
      source: s.item.source,
      publishedAt: s.item.publishedAt,
      matchScore: s.score,
      matchReasons: s.reasons,
      sentiment: s.item.sentiment || null,
      category: s.item.category || 'company',
      snippet: s.item.body.slice(0, 80).replace(/\n/g, ' '),
    }));

    // Aggregate sentiment
    const sentimentSources = matchedNews
      .filter(n => n.sentiment)
      .map(n => ({ score: n.sentiment!.score, conf: n.sentiment!.confidence }));

    let sentimentSummary: SentimentSummary;
    if (sentimentSources.length === 0) {
      sentimentSummary = { score: 0, label: 'neutral', consensus: 1, sourceCount: 0, topKeywords: [] };
    } else {
      const weightedScore = sentimentSources.reduce((sum, s) => sum + s.score * s.conf, 0)
        / sentimentSources.reduce((sum, s) => sum + s.conf, 0);
      const scores = sentimentSources.map(s => s.score);
      // Consensus: 1 - stdDev of normalized scores
      const stdDev = Math.sqrt(scores.reduce((s, v) => s + (v - weightedScore) ** 2, 0) / scores.length);
      const consensus = Math.max(0, 1 - stdDev * 2);

      let label: SentimentSummary['label'];
      if (weightedScore > 0.6) label = 'strong_bullish';
      else if (weightedScore > 0.15) label = 'bullish';
      else if (weightedScore < -0.6) label = 'strong_bearish';
      else if (weightedScore < -0.15) label = 'bearish';
      else label = 'neutral';

      // Extract top keywords from all matched news
      const kwCount = new Map<string, number>();
      for (const n of matchedNews) {
        for (const kw of (n.sentiment?.keywords || [])) {
          kwCount.set(kw, (kwCount.get(kw) || 0) + 1);
        }
      }
      const topKeywords = [...kwCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k);

      sentimentSummary = {
        score: Math.round(weightedScore * 100) / 100,
        label,
        consensus: Math.round(consensus * 100) / 100,
        sourceCount: sentimentSources.length,
        topKeywords,
      };
    }

    // Build top justification
    let topJustification = '';
    const justificationKeywords: string[] = [];
    if (matchedNews.length > 0) {
      const best = matchedNews[0];
      topJustification = `${best.title}`;
      justificationKeywords.push(...best.matchReasons);
    } else {
      topJustification = 'No news context available for this trade.';
    }

    const confidence = matchedNews.length > 0
      ? Math.min(1, matchedNews[0].matchScore / 100)
      : 0;

    const match: TradeNewsMatch = {
      tradeId: signal.tradeId,
      matchedNews,
      topJustification,
      sentimentSummary,
      confidence,
      justificationKeywords,
    };

    // Cache
    this.matchCache.set(signal.tradeId, match);
    if (this.matchCache.size > this.maxCacheSize) {
      const first = this.matchCache.keys().next().value;
      if (first) this.matchCache.delete(first);
    }

    return match;
  }

  // ── Order Enrichment ───────────────────────────────────────────────────────

  /**
   * Enrich a copytrade order with news context for follower confirmation UI.
   */
  enrichOrder(signal: CreatorTradeSignal): EnrichedCopytradeOrder {
    const cached = this.orderCache.get(signal.tradeId);
    if (cached) return cached;

    const match = this.matchTrade(signal);
    const { sentimentSummary } = match;

    // Build natural language news context
    let newsContext = '';
    if (match.matchedNews.length === 0) {
      newsContext = `No recent news found for ${signal.symbol}. ` +
        `Creator ${signal.creatorName} may be acting on private analysis.`;
    } else if (match.matchedNews.length === 1) {
      const n = match.matchedNews[0];
      newsContext = `Recent news for ${signal.symbol}: "${n.title}" (${n.source}, ${n.matchReasons.join(', ')}).`;
    } else {
      newsContext = `${match.matchedNews.length} recent news items for ${signal.symbol}: ` +
        match.matchedNews.slice(0, 3).map(n => `"${n.title.slice(0, 60)}"`).join('; ');
    }

    // Build one-line justification
    const justification = signal.direction === 'BUY'
      ? `Creator buying ${signal.symbol} — ${sentimentSummary.label.replace('_', ' ')} news context (${sentimentSummary.score >= 0 ? '+' : ''}${sentimentSummary.score.toFixed(2)} sentiment)`
      : signal.direction === 'SELL'
        ? `Creator selling ${signal.symbol} — ${sentimentSummary.label.replace('_', ' ')} news context (${sentimentSummary.score >= 0 ? '+' : ''}${sentimentSummary.score.toFixed(2)} sentiment)`
        : `Creator closing ${signal.symbol} position`;

    // Risk signal
    let riskSignal: EnrichedCopytradeOrder['riskSignal'] = 'GREEN';
    if (match.matchedNews.some(n => {
      const text = (n.title + ' ' + (n.sentiment?.reasoning || '')).toLowerCase();
      return RISK_KEYWORDS.some(k => text.includes(k.toLowerCase()));
    })) {
      riskSignal = 'RED';
    } else if (match.confidence < 0.3) {
      riskSignal = 'YELLOW';
    }

    const enriched: EnrichedCopytradeOrder = {
      tradeId: signal.tradeId,
      symbol: signal.symbol,
      direction: signal.direction,
      quantity: signal.quantity,
      creatorName: signal.creatorName,
      newsContext,
      justification,
      sentimentLabel: sentimentSummary.label,
      relatedNewsCount: match.matchedNews.length,
      topNewsTitle: match.matchedNews[0]?.title,
      riskSignal,
      generatedAt: Date.now(),
    };

    this.orderCache.set(signal.tradeId, enriched);
    if (this.orderCache.size > this.maxCacheSize) {
      const first = this.orderCache.keys().next().value;
      if (first) this.orderCache.delete(first);
    }

    return enriched;
  }

  // ── Notification Generation ────────────────────────────────────────────────

  /**
   * Generate an enhanced follower notification with news context.
   */
  generateNotification(
    signal: CreatorTradeSignal,
    followerId: string,
    options?: { requireConfirmation?: boolean; mentionNews?: boolean },
  ): EnhancedNotification {
    const enriched = this.enrichOrder(signal);
    const directionLabel = signal.direction === 'BUY' ? 'bought' : signal.direction === 'SELL' ? 'sold' : 'closed';

    // Full message
    let message = `📊 ${enriched.creatorName} ${directionLabel} ${enriched.quantity} ${enriched.symbol}`;
    if (signal.price) {
      message += ` @ ${signal.price}`;
    }
    message += `\n\n`;
    if (options?.mentionNews !== false && enriched.relatedNewsCount > 0) {
      message += `📰 ${enriched.newsContext}\n\n`;
    }
    message += `💡 ${enriched.justification}`;

    // Brief message (for push)
    const briefMessage = `${enriched.creatorName} ${directionLabel} ${enriched.quantity} ${enriched.symbol} — ${enriched.sentimentLabel.replace('_', ' ')}`;

    // News links
    const newsLinks: { title: string; url?: string }[] = [];
    if (options?.mentionNews !== false) {
      const match = this.matchCache.get(signal.tradeId);
      if (match) {
        for (const n of match.matchedNews.slice(0, 3)) {
          newsLinks.push({ title: n.title });
        }
      }
    }

    return {
      followerId,
      creatorId: signal.creatorId,
      creatorName: signal.creatorName,
      trade: enriched,
      message,
      briefMessage,
      newsLinks,
      requiresConfirmation: options?.requireConfirmation ?? true,
    };
  }

  // ── Batch Processing ───────────────────────────────────────────────────────

  /**
   * Process multiple signals at once. Returns enriched orders sorted by news confidence.
   */
  processBatch(signals: CreatorTradeSignal[]): EnrichedCopytradeOrder[] {
    return signals
      .map(s => this.enrichOrder(s))
      .sort((a, b) => b.relatedNewsCount - a.relatedNewsCount);
  }

  /**
   * Batch generate notifications for a follower subscribing to multiple creators.
   */
  batchNotifications(
    signals: CreatorTradeSignal[],
    followerId: string,
    options?: { requireConfirmation?: boolean },
  ): EnhancedNotification[] {
    return signals.map(s => this.generateNotification(s, followerId, options));
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  /**
   * Get all news currently indexed for a symbol.
   */
  getNewsForSymbol(symbol: string, limit = 10): NewsItem[] {
    const bucket = this.newsIndex.get(normalizeTicker(symbol));
    return bucket ? bucket.slice(0, limit) : [];
  }

  /**
   * Get the last cached match for a trade.
   */
  getCachedMatch(tradeId: string): TradeNewsMatch | undefined {
    return this.matchCache.get(tradeId);
  }

  /**
   * Get the last enriched order for a trade.
   */
  getCachedOrder(tradeId: string): EnrichedCopytradeOrder | undefined {
    return this.orderCache.get(tradeId);
  }

  // ── Statistics ─────────────────────────────────────────────────────────────

  getStats(): CopytradeNewsStats {
    const totalTrades = this.matchCache.size;
    let totalNewsMatched = 0;
    let totalConfidence = 0;
    const symCount = new Map<string, number>();

    for (const [, match] of this.matchCache) {
      totalNewsMatched += match.matchedNews.length;
      totalConfidence += match.confidence;
    }
    // Symbol stats from order cache
    for (const [, order] of this.orderCache) {
      symCount.set(order.symbol, (symCount.get(order.symbol) || 0) + 1);
    }

    const topSymbols = [...symCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbol, count]) => ({ symbol, count }));

    return {
      totalTradesProcessed: totalTrades,
      totalNewsMatched,
      avgNewsPerTrade: totalTrades > 0 ? Math.round(totalNewsMatched / totalTrades * 10) / 10 : 0,
      avgMatchConfidence: totalTrades > 0 ? Math.round(totalConfidence / totalTrades * 100) / 100 : 0,
      justificationCacheSize: this.matchCache.size,
      topSymbols,
    };
  }

  // ── Maintenance ─────────────────────────────────────────────────────────────

  /**
   * Clear old cache entries and stale news.
   */
  prune(olderThanHours = 72): number {
    let pruned = 0;
    const cutoff = Date.now() - olderThanHours * 3600_000;

    for (const [ticker, bucket] of this.newsIndex) {
      const before = bucket.length;
      this.newsIndex.set(ticker, bucket.filter(n => n.publishedAt >= cutoff));
      pruned += before - this.newsIndex.get(ticker)!.length;
    }

    // Clean cache
    for (const [tradeId, match] of this.matchCache) {
      if (match.matchedNews.every(n => n.publishedAt < cutoff)) {
        this.matchCache.delete(tradeId);
        this.orderCache.delete(tradeId);
        pruned++;
      }
    }

    log.info(`[CopytradeNewsEnhancer] Pruned ${pruned} stale entries (cutoff: ${olderThanHours}h)`);
    return pruned;
  }

  /**
   * Reset all state (for testing).
   */
  reset(): void {
    this.newsIndex.clear();
    this.matchCache.clear();
    this.orderCache.clear();
    this.lastIngestTime = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════════════════

let _instance: CopytradeNewsEnhancer | null = null;

export function getCopytradeNewsEnhancer(): CopytradeNewsEnhancer {
  if (!_instance) _instance = new CopytradeNewsEnhancer();
  return _instance;
}

export function resetCopytradeNewsEnhancer(): void {
  _instance?.reset();
  _instance = null;
}
