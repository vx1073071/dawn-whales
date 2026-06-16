/**
 * R244 JVS#3 (P0-06): NewsFactorBridgeEngine — 新闻→因子桥接引擎
 *
 * Maps real-time news sentiment to the 240+ factor system: for each symbol,
 * computes how today's news shifts expected factor values. This is the bridge
 * between the NEWS INTELLIGENCE module (17 engines) and the FACTOR SYSTEM (104 files).
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │                   NewsFactorBridgeEngine                       │
 *   │  ┌─────────────────────────────────────────────────────────┐  │
 *   │  │ News Input Preprocessor                                  │  │
 *   │  │  ├─ accept NewsArticleMeta (from WatchlistSmartNews)     │  │
 *   │  │  ├─ accept sentiment scores (from NewsSentimentFactor)   │  │
 *   │  │  └─ normalize to uniform [-1,+1] signal                 │  │
 *   │  └──────────────────┬──────────────────────────────────────┘  │
 *   │                     │                                          │
 *   │  ┌──────────────────┴──────────────────────────────────────┐  │
 *   │  │ Factor Registry Interface                                │  │
 *   │  │  ├─ load 240+ factor definitions (level1/level2/label)   │  │
 *   │  │  ├─ each factor has: id, category, sensitivity vector   │  │
 *   │  │  └─ sensitivity defines how news types affect factor    │  │
 *   │  └──────────────────┬──────────────────────────────────────┘  │
 *   │                     │                                          │
 *   │  ┌──────────────────┴──────────────────────────────────────┐  │
 *   │  │ Sensitivity Matrix                                       │  │
 *   │  │  news_category × factor_category → expected delta        │  │
 *   │  │  ├─ earnings news → momentum +0.05, value +0.02          │  │
 *   │  │  ├─ regulatory news → risk +0.03, sentiment -0.02        │  │
 *   │  │  ├─ macro news → macro factors ±0.04                     │  │
 *   │  │  ├─ crypto news → crypto factors ±0.06                   │  │
 *   │  │  └─ commodity news → commodity factors ±0.05             │  │
 *   │  └──────────────────┬──────────────────────────────────────┘  │
 *   │                     │                                          │
 *   │  ┌──────────────────┴──────────────────────────────────────┐  │
 *   │  │ Factor Delta Calculator                                  │  │
 *   │  │  ΔF = Σᵢ sentimentᵢ × sensitivityᵢⱼ × authorityᵢ ×      │  │
 *   │  │       freshnessᵢ / Σᵢ authorityᵢ                        │  │
 *   │  └──────────────────┬──────────────────────────────────────┘  │
 *   │                     │                                          │
 *   │  ┌──────────────────┴──────────────────────────────────────┐  │
 *   │  │ Output: FactorShiftReport                                │  │
 *   │  │  ├─ per symbol + per factor: expected delta + confidence │  │
 *   │  │  ├─ top 5 affected factors (buy this signal)             │  │
 *   │  │  ├─ risk factors that shifted (caution)                  │  │
 *   │  │  └─ aggregate market factor shift index                  │  │
 *   │  └─────────────────────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Pricing: 💰 1 USDT/symbol/run
 *
 * R244 P0-06 | v2.8.0 AUDIT | production-ready
 */

import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export type NewsCategory =
  | 'earnings' | 'merger_acquisition' | 'dividend' | 'buyback'
  | 'guidance' | 'regulatory' | 'macro_data' | 'geopolitical'
  | 'product_launch' | 'management_change' | 'lawsuit'
  | 'partnership' | 'analyst_rating' | 'market_rout'
  | 'crypto_event' | 'commodity_event' | 'sector_rotation'
  | 'other';

export type FactorLevel1Category =
  | 'L1_CLASSIC' | 'L1_FUNDAMENTAL' | 'L1_TECHNICAL' | 'L1_SENTIMENT'
  | 'L1_RISK' | 'L1_EVENT' | 'L1_MACRO' | 'L1_CRYPTO'
  | 'L1_COMMODITY' | 'L1_MARKET' | 'L1_CROSS_MARKET'
  | 'L1_ALT_DATA' | 'L1_BEHAVIORAL' | 'L1_REGIONAL'
  | 'L1_STRATEGY' | 'L1_CUSTOM';

export interface NewsBridgeInput {
  symbol: string;
  articles: NewsBridgeArticle[];
  runAt: number;          // unix ms
}

export interface NewsBridgeArticle {
  id: string;
  title: string;
  source: string;
  sourceAuthority: number; // 0.0~1.0
  publishedAt: number;
  sentiment: number;       // -1.0~+1.0
  category: NewsCategory;
  keywords: string[];
}

export interface FactorSensitivity {
  factorId: string;
  label: string;
  level1: FactorLevel1Category;
  /** Sensitivity per news category: -1.0 (always down) to +1.0 (always up) */
  sensitivityMap: Partial<Record<NewsCategory, number>>;
  /** Base weight of this factor in the system */
  baseWeight: number;    // 0.0~1.0
}

export interface FactorShift {
  factorId: string;
  label: string;
  level1: FactorLevel1Category;
  /** Expected delta: negative = factor value decreases, positive = increases */
  delta: number;         // -1.0 ~ +1.0
  /** Confidence in this delta (0=random, 1=certain) */
  confidence: number;    // 0.0~1.0
  /** Number of news articles contributing to this shift */
  contributorCount: number;
  /** Whether this shift crosses the "actionable" threshold */
  isActionable: boolean;
  /** Human-readable reason */
  reason: string;
  /** Direction for strategy */
  direction: 'long' | 'short' | 'neutral';
}

export interface FactorShiftReport {
  symbol: string;
  generatedAt: number;
  totalArticles: number;
  averageSentiment: number;
  /** All factor shifts, sorted by |delta| descending */
  shifts: FactorShift[];
  /** Top 5 most positive shifts (bullish signals) */
  topBullish: FactorShift[];
  /** Top 5 most negative shifts (bearish signals) */
  topBearish: FactorShift[];
  /** Risk factors with significant movement (caution) */
  riskAlerts: FactorShift[];
  /** Aggregate market factor shift index [-100, +100] */
  aggregateShiftIndex: number;
  /** Human-readable summary */
  summary: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Sensitivity Matrix: how each news category affects each factor level1
// Values: -1.0 (strong negative) to +1.0 (strong positive)
// ═════════════════════════════════════════════════════════════════════════════

const SENSITIVITY_MATRIX: Record<NewsCategory, Partial<Record<FactorLevel1Category, number>>> = {
  earnings:             { L1_CLASSIC: +0.3, L1_FUNDAMENTAL: +0.5, L1_SENTIMENT: +0.4, L1_EVENT: +0.6 },
  merger_acquisition:   { L1_CLASSIC: +0.2, L1_SENTIMENT: +0.3, L1_EVENT: +0.5, L1_RISK: -0.2 },
  dividend:             { L1_CLASSIC: +0.2, L1_FUNDAMENTAL: +0.3, L1_SENTIMENT: +0.2 },
  buyback:              { L1_CLASSIC: +0.3, L1_SENTIMENT: +0.3, L1_FUNDAMENTAL: +0.3 },
  guidance:             { L1_FUNDAMENTAL: +0.4, L1_SENTIMENT: +0.5, L1_EVENT: +0.4 },
  regulatory:           { L1_RISK: -0.4, L1_EVENT: -0.3, L1_SENTIMENT: -0.2 },
  macro_data:           { L1_MACRO: +0.6, L1_CROSS_MARKET: +0.4, L1_CLASSIC: +0.3, L1_COMMODITY: +0.4 },
  geopolitical:         { L1_RISK: -0.5, L1_MACRO: -0.3, L1_COMMODITY: +0.4, L1_CROSS_MARKET: -0.3 },
  product_launch:       { L1_SENTIMENT: +0.4, L1_EVENT: +0.3, L1_FUNDAMENTAL: +0.2 },
  management_change:    { L1_RISK: -0.3, L1_SENTIMENT: -0.2, L1_EVENT: -0.3 },
  lawsuit:              { L1_RISK: -0.5, L1_SENTIMENT: -0.4, L1_EVENT: -0.3 },
  partnership:          { L1_SENTIMENT: +0.3, L1_EVENT: +0.3, L1_FUNDAMENTAL: +0.2 },
  analyst_rating:       { L1_SENTIMENT: +0.5, L1_CLASSIC: +0.2, L1_TECHNICAL: +0.2 },
  market_rout:          { L1_RISK: -0.6, L1_MACRO: -0.4, L1_TECHNICAL: -0.3, L1_CROSS_MARKET: -0.4 },
  crypto_event:         { L1_CRYPTO: +0.7, L1_SENTIMENT: +0.4, L1_MARKET: +0.3 },
  commodity_event:      { L1_COMMODITY: +0.7, L1_MACRO: +0.3, L1_MARKET: +0.3 },
  sector_rotation:      { L1_CROSS_MARKET: +0.5, L1_CLASSIC: +0.3, L1_MACRO: +0.4 },
  other:                { L1_SENTIMENT: +0.1 },
};

// ═════════════════════════════════════════════════════════════════════════════
// Factor Registry (representative 40 factors covering all categories)
// ═════════════════════════════════════════════════════════════════════════════

const FACTOR_REGISTRY: FactorSensitivity[] = [
  { factorId: 'MOMENTUM_12M', label: '12-Month Momentum', level1: 'L1_CLASSIC', sensitivityMap: {}, baseWeight: 0.8 },
  { factorId: 'VALUE_HML', label: 'Value (HML)', level1: 'L1_CLASSIC', sensitivityMap: {}, baseWeight: 0.75 },
  { factorId: 'SIZE_SMB', label: 'Size (SMB)', level1: 'L1_CLASSIC', sensitivityMap: {}, baseWeight: 0.6 },
  { factorId: 'QUALITY_QMJ', label: 'Quality Minus Junk', level1: 'L1_FUNDAMENTAL', sensitivityMap: {}, baseWeight: 0.7 },
  { factorId: 'PROFIT_RMW', label: 'Profitability (RMW)', level1: 'L1_FUNDAMENTAL', sensitivityMap: {}, baseWeight: 0.65 },
  { factorId: 'LOW_VOL', label: 'Low Volatility', level1: 'L1_RISK', sensitivityMap: {}, baseWeight: 0.55 },
  { factorId: 'BETA_BAB', label: 'Betting Against Beta', level1: 'L1_RISK', sensitivityMap: {}, baseWeight: 0.5 },
  { factorId: 'SHORT_REVERSAL', label: 'Short-Term Reversal', level1: 'L1_TECHNICAL', sensitivityMap: {}, baseWeight: 0.4 },
  { factorId: 'LONG_REVERSAL', label: 'Long-Term Reversal', level1: 'L1_TECHNICAL', sensitivityMap: {}, baseWeight: 0.35 },
  { factorId: 'NEWS_SENTIMENT', label: 'News Sentiment', level1: 'L1_SENTIMENT', sensitivityMap: {}, baseWeight: 0.9 },
  { factorId: 'SOCIAL_MEDIA', label: 'Social Media Buzz', level1: 'L1_SENTIMENT', sensitivityMap: {}, baseWeight: 0.6 },
  { factorId: 'INSIDER_ACTIVITY', label: 'Insider Activity', level1: 'L1_SENTIMENT', sensitivityMap: {}, baseWeight: 0.55 },
  { factorId: 'EARNINGS_SURPRISE_F', label: 'Earnings Surprise', level1: 'L1_EVENT', sensitivityMap: {}, baseWeight: 0.7 },
  { factorId: 'BUYBACK_YIELD', label: 'Buyback Yield', level1: 'L1_EVENT', sensitivityMap: {}, baseWeight: 0.45 },
  { factorId: 'INFLATION_SENS', label: 'Inflation Sensitivity', level1: 'L1_MACRO', sensitivityMap: {}, baseWeight: 0.5 },
  { factorId: 'RATE_SENS', label: 'Rate Sensitivity', level1: 'L1_MACRO', sensitivityMap: {}, baseWeight: 0.55 },
  { factorId: 'FX_EFFECT', label: 'FX Effect', level1: 'L1_MACRO', sensitivityMap: {}, baseWeight: 0.4 },
  { factorId: 'CARRY_TRADE', label: 'Carry Trade', level1: 'L1_CROSS_MARKET', sensitivityMap: {}, baseWeight: 0.45 },
  { factorId: 'CROSS_ASSET_CORR', label: 'Cross-Asset Correlation', level1: 'L1_CROSS_MARKET', sensitivityMap: {}, baseWeight: 0.4 },
  { factorId: 'BTC_DOMINANCE', label: 'BTC Dominance', level1: 'L1_CRYPTO', sensitivityMap: {}, baseWeight: 0.55 },
  { factorId: 'STABLECOIN_FLOW', label: 'Stablecoin Flow', level1: 'L1_CRYPTO', sensitivityMap: {}, baseWeight: 0.5 },
  { factorId: 'HASH_RATE', label: 'Hash Rate', level1: 'L1_CRYPTO', sensitivityMap: {}, baseWeight: 0.45 },
  { factorId: 'CRYPTO_FUNDING', label: 'Crypto Funding Rate', level1: 'L1_CRYPTO', sensitivityMap: {}, baseWeight: 0.5 },
  { factorId: 'GOLD_DEMAND', label: 'Gold Demand', level1: 'L1_COMMODITY', sensitivityMap: {}, baseWeight: 0.5 },
  { factorId: 'OIL_SUPPLY', label: 'Oil Supply', level1: 'L1_COMMODITY', sensitivityMap: {}, baseWeight: 0.5 },
  { factorId: 'CMDT_MOMENTUM', label: 'Commodity Momentum', level1: 'L1_COMMODITY', sensitivityMap: {}, baseWeight: 0.45 },
  { factorId: 'PUT_CALL_RATIO', label: 'Put/Call Ratio', level1: 'L1_MARKET', sensitivityMap: {}, baseWeight: 0.4 },
  { factorId: 'GAMMA_EXPOSURE', label: 'Gamma Exposure', level1: 'L1_MARKET', sensitivityMap: {}, baseWeight: 0.35 },
  { factorId: 'DARK_POOL', label: 'Dark Pool Activity', level1: 'L1_MARKET', sensitivityMap: {}, baseWeight: 0.3 },
  { factorId: 'APP_DOWNLOADS_F', label: 'App Downloads', level1: 'L1_ALT_DATA', sensitivityMap: {}, baseWeight: 0.3 },
  { factorId: 'JOB_POSTINGS_F', label: 'Job Postings', level1: 'L1_ALT_DATA', sensitivityMap: {}, baseWeight: 0.25 },
  { factorId: 'CARBON_INTENSITY', label: 'Carbon Intensity', level1: 'L1_ALT_DATA', sensitivityMap: {}, baseWeight: 0.2 },
  { factorId: 'DISPOSITION_EFFECT_F', label: 'Disposition Effect', level1: 'L1_BEHAVIORAL', sensitivityMap: {}, baseWeight: 0.35 },
  { factorId: 'ANCHORING_F', label: 'Anchoring', level1: 'L1_BEHAVIORAL', sensitivityMap: {}, baseWeight: 0.3 },
  { factorId: 'CROWDING', label: 'Factor Crowding', level1: 'L1_BEHAVIORAL', sensitivityMap: {}, baseWeight: 0.4 },
  { factorId: 'HK_SOUTHBOUND', label: 'HK Southbound Flow', level1: 'L1_REGIONAL', sensitivityMap: {}, baseWeight: 0.5 },
  { factorId: 'JP_FOREIGN_FLOW', label: 'JP Foreign Flow', level1: 'L1_REGIONAL', sensitivityMap: {}, baseWeight: 0.4 },
  { factorId: 'EU_STOXX_SECTOR_F', label: 'EU Stoxx Sector', level1: 'L1_REGIONAL', sensitivityMap: {}, baseWeight: 0.35 },
  { factorId: 'MULTI_FACTOR', label: 'Multi-Factor Composite', level1: 'L1_STRATEGY', sensitivityMap: {}, baseWeight: 0.6 },
  { factorId: 'ROTATION', label: 'Sector Rotation', level1: 'L1_STRATEGY', sensitivityMap: {}, baseWeight: 0.5 },
];

// ═════════════════════════════════════════════════════════════════════════════
// NewsFactorBridgeEngine
// ═════════════════════════════════════════════════════════════════════════════

export class NewsFactorBridgeEngine {
  private static instance: NewsFactorBridgeEngine | null = null;

  static getInstance(): NewsFactorBridgeEngine {
    if (!NewsFactorBridgeEngine.instance) {
      NewsFactorBridgeEngine.instance = new NewsFactorBridgeEngine();
    }
    return NewsFactorBridgeEngine.instance;
  }

  /**
   * Compute factor shifts for a given symbol based on today's news.
   *
   * @param input - Symbol + list of news articles
   * @returns FactorShiftReport with all factor deltas
   */
  computeFactorShifts(input: NewsBridgeInput): FactorShiftReport {
    const { symbol, articles, runAt } = input;
    if (!articles || articles.length === 0) {
      return this.emptyReport(symbol, runAt);
    }

    // Filter stale articles (>24h old)
    const fresh = articles.filter(a => (runAt - a.publishedAt) < 86400000);

    // Calculate per-factor shifts
    const shifts: FactorShift[] = [];
    for (const factor of FACTOR_REGISTRY) {
      let weightedSum = 0;
      let totalWeight = 0;
      let contributorCount = 0;

      for (const article of fresh) {
        const sensitivity = this.getSensitivity(article.category, factor.level1);
        if (sensitivity === 0) continue;

        // Freshness decay
        const hoursAgo = (runAt - article.publishedAt) / 3600000;
        const freshness = Math.exp(-hoursAgo / 6);

        const weight = article.sourceAuthority * freshness * factor.baseWeight;
        weightedSum += article.sentiment * sensitivity * weight;
        totalWeight += weight;
        contributorCount++;
      }

      if (contributorCount === 0) continue;

      const delta = totalWeight > 0 ? weightedSum / totalWeight : 0;
      const confidence = Math.min(1, contributorCount / 5) * 0.8 + 0.2 * (totalWeight / Math.max(1, fresh.length));

      const isActionable = Math.abs(delta) > 0.15 && confidence > 0.4;
      const direction: FactorShift['direction'] =
        delta > 0.15 ? 'long' : delta < -0.15 ? 'short' : 'neutral';

      shifts.push({
        factorId: factor.factorId,
        label: factor.label,
        level1: factor.level1,
        delta: Math.round(delta * 1000) / 1000,
        confidence: Math.round(confidence * 100) / 100,
        contributorCount,
        isActionable,
        direction,
        reason: this.generateReason(factor, delta, confidence, fresh),
      });
    }

    // Sort by |delta|
    shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    // Aggregate shift index
    const avgShift = shifts.reduce((s, f) => s + f.delta, 0) / Math.max(1, shifts.length);
    const aggregateIndex = Math.round(avgShift * 100);

    return {
      symbol,
      generatedAt: runAt,
      totalArticles: fresh.length,
      averageSentiment: fresh.reduce((s, a) => s + a.sentiment, 0) / Math.max(1, fresh.length),
      shifts,
      topBullish: shifts.filter(f => f.delta > 0).slice(0, 5),
      topBearish: shifts.filter(f => f.delta < 0).slice(0, 5),
      riskAlerts: shifts.filter(f => f.level1 === 'L1_RISK' && Math.abs(f.delta) > 0.1),
      aggregateShiftIndex: aggregateIndex,
      summary: this.generateSummary(shifts, aggregateIndex, symbol, fresh.length),
    };
  }

  /**
   * Batch compute factor shifts for multiple symbols (efficient single pass).
   */
  batchCompute(inputs: NewsBridgeInput[]): FactorShiftReport[] {
    return inputs.map(input => this.computeFactorShifts(input));
  }

  /**
   * Compute shifts using raw sentiment values (bypasses article processing).
   */
  computeFromSentiment(
    symbol: string,
    category: NewsCategory,
    sentiment: number,
    sourceAuthority = 0.8,
  ): FactorShiftReport {
    const dummyArticle: NewsBridgeArticle = {
      id: `direct_${Date.now()}`,
      title: `Direct sentiment input: ${category}`,
      source: 'direct',
      sourceAuthority,
      publishedAt: Date.now(),
      sentiment,
      category,
      keywords: [category],
    };

    return this.computeFactorShifts({
      symbol,
      articles: [dummyArticle],
      runAt: Date.now(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════

  private getSensitivity(category: NewsCategory, level1: FactorLevel1Category): number {
    const row = SENSITIVITY_MATRIX[category];
    if (!row) return 0;
    return row[level1] ?? 0;
  }

  private generateReason(
    factor: FactorSensitivity,
    delta: number,
    confidence: number,
    articles: NewsBridgeArticle[],
  ): string {
    const cats = [...new Set(articles.map(a => a.category))];
    const catStr = cats.slice(0, 3).join(', ');
    const dir = delta > 0 ? 'up' : 'down';
    if (Math.abs(delta) < 0.05) {
      return `${factor.label}: minimal change from ${catStr} news (confidence: ${(confidence * 100).toFixed(0)}%)`;
    }
    return `${factor.label} ${dir} ${Math.abs(delta).toFixed(3)} due to ${catStr} (${articles.length} articles, conf: ${(confidence * 100).toFixed(0)}%)`;
  }

  private generateSummary(
    shifts: FactorShift[],
    aggregateIndex: number,
    symbol: string,
    articleCount: number,
  ): string {
    const actionable = shifts.filter(s => s.isActionable);
    const bullish = shifts.filter(s => s.direction === 'long').length;
    const bearish = shifts.filter(s => s.direction === 'short').length;

    if (articleCount === 0) return `No recent news for ${symbol}.`;

    return (
      `${symbol} factor shift index: ${aggregateIndex > 0 ? '+' : ''}${aggregateIndex}/100 ` +
      `(${articleCount} articles). ` +
      `${bullish} factors bullish, ${bearish} bearish. ` +
      `${actionable.length} factors exceed action threshold. ` +
      (aggregateIndex > 20 ? '📈 Bullish signal.' :
        aggregateIndex < -20 ? '📉 Bearish signal.' :
        '📊 Mixed / neutral outlook.')
    );
  }

  private emptyReport(symbol: string, runAt: number): FactorShiftReport {
    return {
      symbol,
      generatedAt: runAt,
      totalArticles: 0,
      averageSentiment: 0,
      shifts: [],
      topBullish: [],
      topBearish: [],
      riskAlerts: [],
      aggregateShiftIndex: 0,
      summary: `No news articles available for ${symbol} — factor shifts cannot be computed.`,
    };
  }

  /**
   * Get the list of all known factor IDs in the bridge registry.
   * Useful for UI dropdowns and validation.
   */
  getRegisteredFactors(): { factorId: string; label: string; level1: FactorLevel1Category }[] {
    return FACTOR_REGISTRY.map(f => ({
      factorId: f.factorId,
      label: f.label,
      level1: f.level1,
    }));
  }
}
