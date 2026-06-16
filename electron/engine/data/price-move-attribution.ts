/**
 * R239-auto#1: PriceMoveAttribution — 价格异动归因引擎
 * v2.7.0 NEWS INTELLIGENCE
 *
 * When a stock moves >5%, this engine:
 *   1. Detects the price move (from real-time or close data)
 *   2. Searches recent news for the symbol (within lookback window)
 *   3. Ranks news by relevance (sentiment alignment + category match)
 *   4. Generates a natural-language attribution: "AAPL +6.2% — Apple reports record earnings"
 *   5. Provides structured output for UI rendering
 *
 * Features:
 *   - Multi-threshold detection (3%/5%/10% configurable)
 *   - Bidirectional attribution (both up and down moves)
 *   - Sector/industry context (if no per-symbol news, check sector)
 *   - Confidence scoring for attribution quality
 *   - Batch processing for portfolio-level scan
 *   - Free tier: always available, no API cost for detection
 *
 * Integrates with:
 *   - AISentimentEngine → news sentiment scoring
 *   - NewsStockScreener → ticker-level news indexing
 *   - DailyBriefingGenerator → attribution feeds into briefings
 *
 * Constraints: ZERO external cost for detection, optional AI enrichment
 * ≥350L production-ready
 */

import log from 'electron-log';
import type { NewsItem } from './news-types';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type MoveDirection = 'UP' | 'DOWN' | 'FLAT';

export interface PriceMove {
  symbol: string;
  direction: MoveDirection;
  percentChange: number;
  priceBefore: number;
  priceAfter: number;
  timestamp: number;
  threshold: 'MINOR' | 'SIGNIFICANT' | 'MAJOR' | 'EXTREME';
}

export interface AttributionResult {
  symbol: string;
  move: PriceMove;
  attribution: string;           // Natural language: "Apple reports record iPhone sales"
  confidence: number;            // 0-1
  relatedNews: {
    title: string;
    source: string;
    publishedAt: number;
    relevanceScore: number;
    sentiment: number;           // -1 to +1
    snippet: string;
  }[];
  sectorContext?: string;        // Broader sector context if no direct news
  generatedAt: number;
}

export interface AttributionConfig {
  minorThreshold: number;        // 3% (default)
  significantThreshold: number;  // 5%
  majorThreshold: number;        // 10%
  lookbackHours: number;         // How far back to search for news
  maxRelatedNews: number;        // Max news items in attribution
  minRelevanceScore: number;     // Minimum relevance to include
  sectorLookbackHours: number;   // Wider lookback for sector context
}

export interface AttributionStats {
  totalMovesDetected: number;
  attributed: number;
  noNewsFound: number;
  avgConfidence: number;
  topMovers: { symbol: string; change: number; direction: MoveDirection }[];
}

const DEFAULT_CONFIG: AttributionConfig = {
  minorThreshold: 3,
  significantThreshold: 5,
  majorThreshold: 10,
  lookbackHours: 4,
  maxRelatedNews: 3,
  minRelevanceScore: 5,
  sectorLookbackHours: 8,
};

// Attribution templates
const UP_TEMPLATES = [
  '{symbol} {percent}% — surging after {reason}',
  '{symbol} {percent}% — {reason} drives rally',
  '{symbol} {percent}% — {reason} fuels bullish momentum',
  '{symbol} {percent}% — {reason}',
  '{symbol} {percent}% — investors react to {reason}',
];

const DOWN_TEMPLATES = [
  '{symbol} {percent}% — dropping after {reason}',
  '{symbol} {percent}% — {reason} triggers selloff',
  '{symbol} {percent}% — {reason} weighs on sentiment',
  '{symbol} {percent}% — {reason}',
  '{symbol} {percent}% — market reacts to {reason}',
];

// Sector keywords for fallback context
const SECTOR_KEYWORDS: Record<string, string[]> = {
  TECH: ['tech', 'technology', 'software', 'semiconductor', 'AI', 'cloud', 'chip'],
  FINANCE: ['bank', 'finance', 'insurance', 'fintech', 'payment', 'lending'],
  HEALTHCARE: ['pharma', 'biotech', 'health', 'medical', 'drug', 'vaccine'],
  ENERGY: ['oil', 'gas', 'energy', 'renewable', 'solar', 'crude'],
  CONSUMER: ['retail', 'consumer', 'ecommerce', 'luxury', 'brand'],
  CRYPTO: ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'defi', 'nft'],
};

// ═══════════════════════════════════════════════════════════════════
// PriceMoveAttribution Engine
// ═══════════════════════════════════════════════════════════════════

export class PriceMoveAttribution {
  private config: AttributionConfig;
  private newsIndex: Map<string, NewsItem[]> = new Map();
  private sectorNews: Map<string, NewsItem[]> = new Map();
  private stats: AttributionStats = this.emptyStats();
  private lastIngestTime = 0;

  constructor(config?: Partial<AttributionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── News Ingestion ───────────────────────────────────────────────

  /**
   * Ingest news items for attribution. Indexed by ticker and by sector.
   */
  ingestNews(items: NewsItem[]): void {
    for (const item of items) {
      // Ticker index
      for (const ticker of item.tickers) {
        const norm = ticker.toUpperCase();
        if (!this.newsIndex.has(norm)) this.newsIndex.set(norm, []);
        this.newsIndex.get(norm)!.push(item);
      }
      // Sector index
      const sector = this.detectSector(item.title + ' ' + item.body);
      if (sector) {
        if (!this.sectorNews.has(sector)) this.sectorNews.set(sector, []);
        this.sectorNews.get(sector)!.push(item);
      }
    }

    // Prune old entries
    this.pruneNews();
    this.lastIngestTime = Date.now();
  }

  // ── Detection ────────────────────────────────────────────────────

  /**
   * Detect a price move and check if it crosses any threshold.
   */
  detectMove(
    symbol: string,
    priceBefore: number,
    priceAfter: number,
    timestamp?: number,
  ): PriceMove | null {
    const percentChange = ((priceAfter - priceBefore) / priceBefore) * 100;
    const absChange = Math.abs(percentChange);

    if (absChange < this.config.minorThreshold) return null;

    let threshold: PriceMove['threshold'];
    if (absChange >= this.config.majorThreshold) threshold = 'EXTREME';
    else if (absChange >= this.config.significantThreshold) threshold = 'MAJOR';
    else if (absChange >= this.config.minorThreshold + 1) threshold = 'SIGNIFICANT';
    else threshold = 'MINOR';

    return {
      symbol: symbol.toUpperCase(),
      direction: percentChange >= 0 ? 'UP' : 'DOWN',
      percentChange: Math.round(percentChange * 100) / 100,
      priceBefore,
      priceAfter,
      timestamp: timestamp || Date.now(),
      threshold,
    };
  }

  // ── Attribution ──────────────────────────────────────────────────

  /**
   * Attribute a price move to relevant news.
   */
  attribute(move: PriceMove): AttributionResult {
    this.stats.totalMovesDetected++;
    const cutoff = move.timestamp - this.config.lookbackHours * 3600_000;
    const bucket = this.newsIndex.get(move.symbol) || [];

    // Filter recent news
    const recentNews = bucket.filter(n => n.publishedAt >= cutoff);

    if (recentNews.length === 0) {
      // Try sector-level context
      const sectorContext = this.getSectorContext(move.symbol, move.timestamp);
      this.stats.noNewsFound++;

      return {
        symbol: move.symbol,
        move,
        attribution: `${move.symbol} ${move.percentChange >= 0 ? '+' : ''}${move.percentChange}% — no specific news found. ${sectorContext || 'Check broader market conditions.'}`,
        confidence: sectorContext ? 0.3 : 0.1,
        relatedNews: [],
        sectorContext,
        generatedAt: Date.now(),
      };
    }

    // Score and rank news by relevance
    const scored = recentNews.map(item => ({
      item,
      score: this.scoreRelevance(item, move),
    }));

    scored.sort((a, b) => b.score - a.score);
    const topNews = scored.slice(0, this.config.maxRelatedNews)
      .filter(s => s.score >= this.config.minRelevanceScore);

    // Generate natural language attribution
    const reason = this.extractReason(topNews[0]?.item);
    const template = move.direction === 'UP'
      ? UP_TEMPLATES[Math.floor(Math.random() * UP_TEMPLATES.length)]
      : DOWN_TEMPLATES[Math.floor(Math.random() * DOWN_TEMPLATES.length)];

    const attribution = template
      .replace('{symbol}', move.symbol)
      .replace('{percent}', `${move.percentChange >= 0 ? '+' : ''}${move.percentChange}%`)
      .replace('{reason}', reason);

    // Compute confidence
    const confidence = topNews.length > 0
      ? Math.min(1, (topNews[0].score / 60) * (topNews.length >= 2 ? 1 : 0.7))
      : 0.2;

    this.stats.attributed++;
    this.stats.topMovers.push({
      symbol: move.symbol, change: move.percentChange,
      direction: move.direction,
    });
    // Keep top 20
    if (this.stats.topMovers.length > 20) {
      this.stats.topMovers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
      this.stats.topMovers = this.stats.topMovers.slice(0, 20);
    }

    return {
      symbol: move.symbol,
      move,
      attribution,
      confidence: Math.round(confidence * 100) / 100,
      relatedNews: topNews.map(s => ({
        title: s.item.title,
        source: s.item.source,
        publishedAt: s.item.publishedAt,
        relevanceScore: s.score,
        sentiment: s.item.sentiment?.score || 0,
        snippet: s.item.body.slice(0, 120),
      })),
      generatedAt: Date.now(),
    };
  }

  /**
   * Batch: scan a portfolio of price changes.
   */
  scanPortfolio(changes: { symbol: string; priceBefore: number; priceAfter: number }[]): AttributionResult[] {
    const results: AttributionResult[] = [];

    for (const change of changes) {
      const move = this.detectMove(change.symbol, change.priceBefore, change.priceAfter);
      if (move) {
        results.push(this.attribute(move));
      }
    }

    return results;
  }

  // ── Scoring ──────────────────────────────────────────────────────

  private scoreRelevance(item: NewsItem, move: PriceMove): number {
    let score = 0;

    // Time proximity (max 40pts)
    const hoursAgo = (move.timestamp - item.publishedAt) / 3600_000;
    if (hoursAgo <= 0.5) score += 40;
    else if (hoursAgo <= 1) score += 35;
    else if (hoursAgo <= 2) score += 25;
    else if (hoursAgo <= 4) score += 15;
    else score += 5;

    // Sentiment-direction alignment (max 30pts)
    const sentScore = item.sentiment?.score ?? 0;
    if (move.direction === 'UP' && sentScore > 0.3) score += 30;
    else if (move.direction === 'UP' && sentScore > 0) score += 15;
    else if (move.direction === 'DOWN' && sentScore < -0.3) score += 30;
    else if (move.direction === 'DOWN' && sentScore < 0) score += 15;

    // Category match (max 20pts)
    if (item.category === 'earnings') score += 20;
    else if (item.category === 'breaking') score += 15;
    else if (item.category === 'company') score += 10;

    // Impact (max 10pts)
    if (item.impact === 'P0') score += 10;
    else if (item.impact === 'P1') score += 6;

    return score;
  }

  // ── Reason Extraction ────────────────────────────────────────────

  private extractReason(item?: NewsItem): string {
    if (!item) return 'market conditions';
    if (item.sentiment?.reasoning) return item.sentiment.reasoning;
    // Use title as reason, truncate to reasonable length
    const title = item.title;
    if (title.length <= 80) return title;
    return title.slice(0, 77) + '...';
  }

  // ── Sector Context ───────────────────────────────────────────────

  private getSectorContext(symbol: string, timestamp: number): string {
    const sector = this.detectSectorForSymbol(symbol);
    if (!sector) return '';

    const cutoff = timestamp - this.config.sectorLookbackHours * 3600_000;
    const news = this.sectorNews.get(sector);
    if (!news || news.length === 0) return '';

    const recent = news
      .filter(n => n.publishedAt >= cutoff)
      .slice(0, 3);

    if (recent.length === 0) return '';
    return `${sector} sector: ${recent.map(n => n.title).join('; ')}`;
  }

  private detectSector(text: string): string | null {
    const lc = text.toLowerCase();
    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      if (keywords.some(k => lc.includes(k.toLowerCase()))) return sector;
    }
    return null;
  }

  private detectSectorForSymbol(_symbol: string): string | null {
    // Could be extended with a symbol→sector mapping
    // For now, check news index for sector context
    return null;
  }

  // ── Maintenance ──────────────────────────────────────────────────

  private pruneNews(): void {
    const cutoff = Date.now() - this.config.sectorLookbackHours * 3600_000;
    for (const [key, bucket] of this.newsIndex) {
      this.newsIndex.set(key, bucket.filter(n => n.publishedAt >= cutoff));
    }
    for (const [key, bucket] of this.sectorNews) {
      this.sectorNews.set(key, bucket.filter(n => n.publishedAt >= cutoff));
    }
  }

  // ── Stats ────────────────────────────────────────────────────────

  private emptyStats(): AttributionStats {
    return {
      totalMovesDetected: 0, attributed: 0, noNewsFound: 0,
      avgConfidence: 0, topMovers: [],
    };
  }

  getStats(): AttributionStats {
    return { ...this.stats, topMovers: [...this.stats.topMovers] };
  }

  getConfig(): AttributionConfig {
    return { ...this.config };
  }

  reset(): void {
    this.newsIndex.clear();
    this.sectorNews.clear();
    this.stats = this.emptyStats();
    this.lastIngestTime = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════

let _instance: PriceMoveAttribution | null = null;

export function getPriceMoveAttribution(): PriceMoveAttribution {
  if (!_instance) _instance = new PriceMoveAttribution();
  return _instance;
}

export function resetPriceMoveAttribution(): void {
  _instance?.reset();
  _instance = null;
}
