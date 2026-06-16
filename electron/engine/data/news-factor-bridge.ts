/**
 * R245 P0-06: 新闻因子桥数据层 (NewsFactorBridge)
 * 
 * 新闻事件 → 因子影响映射 → 影响权重 → 评分
 * 
 * Pipeline:
 *   News Event (source+category+sentiment)
 *     ↓
 *   FactorMapper (事件→受影响因子列表)
 *     ↓
 *   ImpactCalculator (影响方向+强度+置信度)
 *     ↓
 *   WeightAggregator (多因子加权聚合)
 *     ↓
 *   BridgeSignal (标准化输出→供JVS因子引擎消费)
 * 
 * 价格: FREE (基础设施)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type NewsEventCategory =
  | 'earnings' | 'merger' | 'dividend' | 'product' | 'regulation'
  | 'macro' | 'geopolitical' | 'market' | 'company' | 'crypto'
  | 'commodity' | 'technical';

export type FactorDomain =
  | 'momentum' | 'value' | 'quality' | 'growth' | 'volatility'
  | 'sentiment' | 'risk' | 'macro' | 'technical' | 'liquidity'
  | 'crypto_specific' | 'commodity_specific';

export type ImpactDirection = 'positive' | 'negative' | 'neutral' | 'ambiguous';

export interface NewsFactorMapping {
  /** News event category */
  eventCategory: NewsEventCategory;
  /** Which factor domain is affected */
  factorDomain: FactorDomain;
  /** Specific factor IDs affected (from factor-id-registry) */
  factorIds: string[];
  /** Default impact direction */
  defaultDirection: ImpactDirection;
  /** Impact magnitude 0-1 */
  impactMagnitude: number;
  /** How confident 0-1 */
  confidence: number;
  /** Human-readable explanation */
  humanExplanation: string;
  /** Decay in hours (how long the impact lasts) */
  decayHours: number;
}

export interface FactorImpact {
  factorId: string;
  factorDomain: FactorDomain;
  direction: ImpactDirection;
  magnitude: number;          // 0-1
  confidence: number;         // 0-1
  decayHours: number;
  evidence: string;           // Which news piece(s) support this
  timestamp: number;
}

export interface BridgeSignal {
  id: string;
  newsEventId: string;
  tickers: string[];
  publishedAt: number;
  generatedAt: number;
  impacts: FactorImpact[];
  aggregate: {
    primaryDomain: FactorDomain;
    primaryDirection: ImpactDirection;
    overallMagnitude: number;
    factorCount: number;
    confidenceScore: number;
  };
  summary: string;
  expiresAt: number;
}

export interface BridgeConfig {
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Maximum factors per bridge signal */
  maxFactorsPerSignal: number;
  /** Default decay hours */
  defaultDecayHours: number;
  /** Enable real-time bridge (vs batch) */
  realtime: boolean;
}

// ── Domain weights (how much each event type affects each domain) ──────────

const DOMAIN_WEIGHTS: Record<NewsEventCategory, Partial<Record<FactorDomain, number>>> = {
  earnings:    { quality: 0.9, momentum: 0.7, value: 0.6, growth: 0.5, sentiment: 0.8, volatility: 0.7 },
  merger:      { value: 0.8, momentum: 0.6, volatility: 0.7, sentiment: 0.7, risk: 0.5 },
  dividend:    { value: 0.8, quality: 0.5, growth: 0.3, sentiment: 0.4 },
  product:     { growth: 0.9, momentum: 0.6, quality: 0.5, sentiment: 0.7, volatility: 0.5 },
  regulation:  { risk: 0.9, volatility: 0.7, value: 0.5, sentiment: 0.5, macro: 0.6 },
  macro:       { macro: 0.95, volatility: 0.8, risk: 0.7, momentum: 0.5, value: 0.4 },
  geopolitical:{ risk: 0.95, macro: 0.7, volatility: 0.8, commodity_specific: 0.6 },
  market:      { momentum: 0.7, volatility: 0.6, sentiment: 0.7, liquidity: 0.5, technical: 0.5 },
  company:     { value: 0.5, quality: 0.5, momentum: 0.4, sentiment: 0.6, volatility: 0.5 },
  crypto:      { momentum: 0.8, volatility: 0.9, sentiment: 0.8, crypto_specific: 0.95, risk: 0.5 },
  commodity:   { macro: 0.7, volatility: 0.7, commodity_specific: 0.9, risk: 0.5, momentum: 0.5 },
  technical:   { technical: 0.9, momentum: 0.7, volatility: 0.5, sentiment: 0.4, liquidity: 0.5 },
};

// ── News category → factor ID mapping (canonical IDs from factor-id-registry) ──

const CATEGORY_FACTOR_MAP: Record<NewsEventCategory, Record<FactorDomain, string[]>> = {
  earnings: {
    quality: ['QUALITY_ROE', 'QUALITY_GP', 'QUALITY_NPM', 'QUALITY_ACCRUAL'],
    momentum: ['MOMENTUM_12M', 'MOMENTUM_3M', 'MOMENTUM_1M', 'MOMENTUM_RESIDUAL'],
    value: ['VALUE_EARNINGS_YIELD', 'VALUE_FCF_YIELD', 'VALUE_PE', 'VALUE_EBIT_EV'],
    growth: ['GROWTH_EPS_3Y', 'GROWTH_REVENUE_3Y', 'GROWTH_EARNINGS_EST'],
    sentiment: ['SENT_EARNINGS_SURPRISE', 'SENT_ANALYST_REV', 'SENT_INSIDER'],
    volatility: ['VOL_EVENT', 'VOL_HISTORICAL', 'VOL_IMPLIED', 'VOL_BETA'],
  },
  merger: {
    value: ['VALUE_FCF_YIELD', 'VALUE_PB', 'VALUE_EBIT_EV', 'VALUE_MERGER_ARB'],
    momentum: ['MOMENTUM_3M', 'MOMENTUM_1M', 'MOMENTUM_SHORT'],
    volatility: ['VOL_EVENT', 'VOL_IMPLIED', 'VOL_SPREAD'],
    sentiment: ['SENT_ANALYST_REV', 'SENT_NEWS_BUZZ', 'SENT_MANAGEMENT'],
    risk: ['RISK_IDIOSYNCRATIC', 'RISK_DOWNSIDE_DEV', 'RISK_MAXDD'],
  },
  dividend: {
    value: ['VALUE_DIVIDEND_YIELD', 'VALUE_FCF_YIELD', 'VALUE_EARNINGS_YIELD'],
    quality: ['QUALITY_PAYOUT', 'QUALITY_ROE', 'QUALITY_FCF_STABILITY'],
    growth: ['GROWTH_DIVIDEND_3Y', 'GROWTH_EARNINGS_STABILITY'],
    sentiment: ['SENT_DIVIDEND_SIGNAL', 'SENT_MANAGEMENT'],
  },
  product: {
    growth: ['GROWTH_REVENUE_3Y', 'GROWTH_EPS_3Y', 'GROWTH_MARKET_SHARE'],
    momentum: ['MOMENTUM_6M', 'MOMENTUM_3M', 'MOMENTUM_REVENUE'],
    quality: ['QUALITY_GP', 'QUALITY_RD_INTENSITY', 'QUALITY_PATENT'],
    sentiment: ['SENT_NEWS_BUZZ', 'SENT_SOCIAL_MEDIA', 'SENT_CONSUMER'],
    volatility: ['VOL_EVENT', 'VOL_HISTORICAL'],
  },
  regulation: {
    risk: ['RISK_REGULATORY', 'RISK_TAIL', 'RISK_DOWNSIDE_DEV', 'RISK_CVAR'],
    volatility: ['VOL_EVENT', 'VOL_IMPLIED', 'VOL_VAR'],
    value: ['VALUE_EARNINGS_YIELD', 'VALUE_FCF_YIELD'],
    sentiment: ['SENT_REGULATORY', 'SENT_ANALYST_REV'],
    macro: ['MACRO_POLICY', 'MACRO_REGIME', 'MACRO_INTEREST_RATE'],
  },
  macro: {
    macro: ['MACRO_INTEREST_RATE', 'MACRO_INFLATION', 'MACRO_GDP', 'MACRO_REGIME', 'MACRO_POLICY'],
    volatility: ['VOL_VAR', 'VOL_IMPLIED', 'VOL_HISTORICAL', 'VOL_CORR'],
    risk: ['RISK_TAIL', 'RISK_CVAR', 'RISK_SYSTEMATIC', 'RISK_STRESS'],
    momentum: ['MOMENTUM_MACRO', 'MOMENTUM_SECTOR', 'MOMENTUM_12M'],
    value: ['VALUE_EARNINGS_YIELD', 'VALUE_PB'],
  },
  geopolitical: {
    risk: ['RISK_TAIL', 'RISK_GEOPOLITICAL', 'RISK_SYSTEMATIC', 'RISK_CVAR', 'RISK_STRESS'],
    macro: ['MACRO_REGIME', 'MACRO_CURRENCY', 'MACRO_POLICY', 'MACRO_TRADE'],
    volatility: ['VOL_VAR', 'VOL_CRASH', 'VOL_CORR', 'VOL_TAIL'],
    commodity_specific: ['COMMODITY_OIL', 'COMMODITY_GOLD', 'COMMODITY_ENERGY'],
  },
  market: {
    momentum: ['MOMENTUM_12M', 'MOMENTUM_6M', 'MOMENTUM_SECTOR', 'MOMENTUM_CROSS'],
    volatility: ['VOL_HISTORICAL', 'VOL_IMPLIED', 'VOL_SPREAD'],
    sentiment: ['SENT_MARKET_BREADTH', 'SENT_PUT_CALL', 'SENT_VIX', 'SENT_FEAR_GREED'],
    liquidity: ['LIQUIDITY_AMIHUD', 'LIQUIDITY_TURNOVER', 'LIQUIDITY_SPREAD'],
    technical: ['TECH_MA_TRIX', 'TECH_ADX', 'TECH_MACD', 'TECH_BOLLINGER'],
  },
  company: {
    value: ['VALUE_FCF_YIELD', 'VALUE_EARNINGS_YIELD', 'VALUE_PE'],
    quality: ['QUALITY_ROE', 'QUALITY_GP', 'QUALITY_DEBT_EQUITY'],
    momentum: ['MOMENTUM_3M', 'MOMENTUM_1M'],
    sentiment: ['SENT_NEWS_BUZZ', 'SENT_MANAGEMENT', 'SENT_INSIDER'],
    volatility: ['VOL_EVENT', 'VOL_BETA', 'VOL_RESIDUAL'],
  },
  crypto: {
    momentum: ['MOMENTUM_1M', 'MOMENTUM_3M', 'MOMENTUM_12M'],
    volatility: ['VOL_HISTORICAL', 'VOL_IMPLIED', 'VOL_TAIL'],
    sentiment: ['SENT_SOCIAL_MEDIA', 'SENT_FEAR_GREED', 'SENT_ONCHAIN'],
    crypto_specific: ['CRYPTO_HASHRATE', 'CRYPTO_NAV', 'CRYPTO_VOLUME', 'CRYPTO_NETWORK', 'CRYPTO_STAKING'],
    risk: ['RISK_IDIOSYNCRATIC', 'RISK_TAIL', 'RISK_VOL_REGIME'],
  },
  commodity: {
    macro: ['MACRO_INFLATION', 'MACRO_INTEREST_RATE', 'MACRO_CURRENCY'],
    volatility: ['VOL_HISTORICAL', 'VOL_SEASONAL', 'VOL_SPREAD'],
    commodity_specific: ['COMMODITY_OIL', 'COMMODITY_GOLD', 'COMMODITY_COPPER', 'COMMODITY_ENERGY', 'COMMODITY_AGRI'],
    risk: ['RISK_SUPPLY', 'RISK_GEOPOLITICAL', 'RISK_WEATHER'],
    momentum: ['MOMENTUM_3M', 'MOMENTUM_12M', 'MOMENTUM_TERM_STRUCTURE'],
  },
  technical: {
    technical: ['TECH_MA_TRIX', 'TECH_RSI', 'TECH_MACD', 'TECH_ADX', 'TECH_BOLLINGER', 'TECH_ICHIMOKU'],
    momentum: ['MOMENTUM_SHORT', 'MOMENTUM_1M', 'MOMENTUM_RESIDUAL'],
    volatility: ['VOL_HISTORICAL', 'VOL_ATR', 'VOL_BOLLINGER_WIDTH'],
    sentiment: ['SENT_TECHNICAL_STRENGTH', 'SENT_BREADTH'],
    liquidity: ['LIQUIDITY_VOLUME', 'LIQUIDITY_TURNOVER'],
  },
};

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  minConfidence: 0.3,
  maxFactorsPerSignal: 15,
  defaultDecayHours: 48,
  realtime: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// NewsFactorBridge
// ═══════════════════════════════════════════════════════════════════════════

export class NewsFactorBridge {
  private config: BridgeConfig;
  private signalCache: Map<string, BridgeSignal> = new Map();
  private tickerIndex: Map<string, string[]> = new Map(); // ticker→signalIds
  private mappingRegistry: NewsFactorMapping[] = [];
  private stats_ = { totalBridged: 0, totalFactors: 0, lastBridgeTime: 0 };

  constructor(config?: Partial<BridgeConfig>) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    this._buildMappingRegistry();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Bridge a news event to factor impacts.
   * Main entry point — maps news to factors.
   */
  bridge(
    eventId: string,
    category: NewsEventCategory,
    tickers: string[],
    sentimentScore: number,   // -1 to 1
    publishedAt: number,
    context?: { headline?: string; impact?: string },
  ): BridgeSignal {
    const domains = DOMAIN_WEIGHTS[category];
    if (!domains) {
      return this._emptySignal(eventId, tickers, publishedAt);
    }

    const impacts: FactorImpact[] = [];
    let primaryDomain: FactorDomain = 'sentiment';
    let primaryDirection: ImpactDirection = sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral';
    let maxMagnitude = 0;
    let confidenceSum = 0;

    // Direction modifier from headline keywords
    const headlineMod = context?.headline
      ? this._headlineDirectionModifier(context.headline)
      : 0;

    for (const [domain, weight] of Object.entries(domains)) {
      if (weight <= this.config.minConfidence) continue;

      const factorIds = CATEGORY_FACTOR_MAP[category]?.[domain as FactorDomain] ?? [];
      if (factorIds.length === 0) continue;

      // Direction: sentiment ± headline modifier
      let direction: ImpactDirection;
      const effectiveScore = sentimentScore + headlineMod;
      if (Math.abs(effectiveScore) < 0.1) {
        direction = 'neutral';
      } else {
        direction = effectiveScore > 0 ? 'positive' : 'negative';
      }

      const magnitude = Math.min(1, Math.abs(sentimentScore) * weight);
      const confidence = weight;

      // Track primary domain
      if (magnitude > maxMagnitude) {
        maxMagnitude = magnitude;
        primaryDomain = domain as FactorDomain;
        primaryDirection = direction;
      }

      for (const factorId of factorIds.slice(0, Math.ceil(weight * 3))) {
        confidenceSum += confidence;
        impacts.push({
          factorId,
          factorDomain: domain as FactorDomain,
          direction,
          magnitude,
          confidence,
          decayHours: this.config.defaultDecayHours,
          evidence: context?.headline ?? `News event ${eventId}`,
          timestamp: Date.now(),
        });
      }

      if (impacts.length >= this.config.maxFactorsPerSignal) break;
    }

    const avgConfidence = impacts.length > 0 ? confidenceSum / impacts.length : 0;
    const expiresAt = publishedAt + this.config.defaultDecayHours * 3600000;

    const signal: BridgeSignal = {
      id: `bridge:${eventId}`,
      newsEventId: eventId,
      tickers,
      publishedAt,
      generatedAt: Date.now(),
      impacts: impacts.slice(0, this.config.maxFactorsPerSignal),
      aggregate: {
        primaryDomain,
        primaryDirection,
        overallMagnitude: maxMagnitude,
        factorCount: impacts.length,
        confidenceScore: Math.round(avgConfidence * 100) / 100,
      },
      summary: this._generateSummary(eventId, category, tickers, primaryDomain, primaryDirection, maxMagnitude),
      expiresAt,
    };

    this.signalCache.set(signal.id, signal);
    for (const t of tickers) {
      const existing = this.tickerIndex.get(t) ?? [];
      existing.push(signal.id);
      this.tickerIndex.set(t, existing);
    }

    this.stats_.totalBridged++;
    this.stats_.totalFactors += impacts.length;
    this.stats_.lastBridgeTime = Date.now();

    return signal;
  }

  /**
   * Bridge multiple news events in batch.
   */
  bridgeBatch(
    events: Array<{
      eventId: string; category: NewsEventCategory;
      tickers: string[]; sentimentScore: number; publishedAt: number;
      context?: { headline?: string; impact?: string };
    }>,
  ): BridgeSignal[] {
    return events.map(e => this.bridge(e.eventId, e.category, e.tickers, e.sentimentScore, e.publishedAt, e.context));
  }

  /**
   * Get signals affecting a specific ticker.
   */
  getSignalsForTicker(ticker: string, limit = 20): BridgeSignal[] {
    const signalIds = this.tickerIndex.get(ticker) ?? [];
    return signalIds
      .map(id => this.signalCache.get(id))
      .filter((s): s is BridgeSignal => s !== undefined && s.expiresAt > Date.now())
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, limit);
  }

  /**
   * Get signals affecting a specific factor.
   */
  getSignalsForFactor(factorId: string, limit = 10): BridgeSignal[] {
    const results: BridgeSignal[] = [];
    for (const signal of this.signalCache.values()) {
      if (signal.expiresAt <= Date.now()) continue;
      if (signal.impacts.some(i => i.factorId === factorId)) {
        results.push(signal);
      }
    }
    return results.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, limit);
  }

  /**
   * Get the mapping registry (all category→domain→factor chains).
   */
  getMappingRegistry(): NewsFactorMapping[] {
    return this.mappingRegistry;
  }

  /**
   * Get mapping for a specific event category.
   */
  getMapping(category: NewsEventCategory): NewsFactorMapping[] {
    return this.mappingRegistry.filter(m => m.eventCategory === category);
  }

  /**
   * Calculate the aggregated factor impact across all cached signals for a ticker.
   */
  aggregateForTicker(ticker: string): {
    domainImpacts: Partial<Record<FactorDomain, { direction: ImpactDirection; magnitude: number }>>;
    mostImpactedFactors: string[];
    totalSignals: number;
  } {
    const signals = this.getSignalsForTicker(ticker, 50);
    const domainAcc: Partial<Record<FactorDomain, { pos: number; neg: number; count: number }>> = {};
    const factorCount: Map<string, number> = new Map();

    for (const signal of signals) {
      for (const impact of signal.impacts) {
        const acc = domainAcc[impact.factorDomain] ?? { pos: 0, neg: 0, count: 0 };
        if (impact.direction === 'positive') acc.pos += impact.magnitude;
        else if (impact.direction === 'negative') acc.neg += impact.magnitude;
        acc.count++;
        domainAcc[impact.factorDomain] = acc;

        factorCount.set(impact.factorId, (factorCount.get(impact.factorId) ?? 0) + 1);
      }
    }

    const domainImpacts: Partial<Record<FactorDomain, { direction: ImpactDirection; magnitude: number }>> = {};
    for (const [domain, acc] of Object.entries(domainAcc)) {
      const net = acc.pos - acc.neg;
      domainImpacts[domain as FactorDomain] = {
        direction: net > 0.05 ? 'positive' : net < -0.05 ? 'negative' : 'neutral',
        magnitude: Math.min(1, (acc.pos + acc.neg) / Math.max(1, acc.count)),
      };
    }

    const mostImpactedFactors = Array.from(factorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);

    return { domainImpacts, mostImpactedFactors, totalSignals: signals.length };
  }

  /**
   * Configure custom weight mappings (extensible).
   */
  configureWeights(
    category: NewsEventCategory,
    domainWeights: Partial<Record<FactorDomain, number>>,
  ): void {
    DOMAIN_WEIGHTS[category] = { ...DOMAIN_WEIGHTS[category], ...domainWeights };
    this._buildMappingRegistry();
  }

  /** Get bridge stats */
  getStats() { return { ...this.stats_, cacheSize: this.signalCache.size }; }

  /** Reset all state */
  reset(): void {
    this.signalCache.clear();
    this.tickerIndex.clear();
    this.stats_ = { totalBridged: 0, totalFactors: 0, lastBridgeTime: 0 };
  }

  /** Prune expired signals */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [id, signal] of this.signalCache) {
      if (signal.expiresAt <= now) {
        this.signalCache.delete(id);
        pruned++;
      }
    }
    return pruned;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _buildMappingRegistry(): void {
    this.mappingRegistry = [];
    for (const [category, domainWeights] of Object.entries(DOMAIN_WEIGHTS)) {
      for (const [domain, weight] of Object.entries(domainWeights)) {
        const factorIds = CATEGORY_FACTOR_MAP[category as NewsEventCategory]?.[domain as FactorDomain] ?? [];
        this.mappingRegistry.push({
          eventCategory: category as NewsEventCategory,
          factorDomain: domain as FactorDomain,
          factorIds,
          defaultDirection: 'ambiguous',
          impactMagnitude: weight,
          confidence: weight,
          humanExplanation: `${category} events typically affect ${domain} factors with ${Math.round(weight * 100)}% confidence`,
          decayHours: this.config.defaultDecayHours,
        });
      }
    }
  }

  private _headlineDirectionModifier(headline: string): number {
    const positive = ['beat', 'surge', 'rally', 'upgrade', 'record', 'growth', 'strong', 'buy', 'outperform', 'bull'];
    const negative = ['miss', 'crash', 'plunge', 'downgrade', 'decline', 'weak', 'sell', 'underperform', 'bear', 'loss'];
    const lower = headline.toLowerCase();
    let mod = 0;
    for (const w of positive) if (lower.includes(w)) mod += 0.1;
    for (const w of negative) if (lower.includes(w)) mod -= 0.1;
    return Math.max(-0.5, Math.min(0.5, mod));
  }

  private _generateSummary(
    eventId: string, category: NewsEventCategory,
    tickers: string[], primaryDomain: FactorDomain,
    direction: ImpactDirection, magnitude: number,
  ): string {
    const tickersStr = tickers.slice(0, 3).join(',');
    const dirStr = direction === 'positive' ? 'positively' : direction === 'negative' ? 'negatively' : 'neutrally';
    return `${category} event for ${tickersStr} impacts ${primaryDomain} factors ${dirStr} (magnitude ${Math.round(magnitude * 100)}%)`;
  }

  private _emptySignal(eventId: string, tickers: string[], publishedAt: number): BridgeSignal {
    return {
      id: `bridge:empty:${eventId}`,
      newsEventId: eventId,
      tickers,
      publishedAt,
      generatedAt: Date.now(),
      impacts: [],
      aggregate: {
        primaryDomain: 'sentiment',
        primaryDirection: 'neutral',
        overallMagnitude: 0,
        factorCount: 0,
        confidenceScore: 0,
      },
      summary: `No factor impact detected for event ${eventId}`,
      expiresAt: publishedAt + 3600000,
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: NewsFactorBridge | null = null;

export function newsFactorBridge(config?: Partial<BridgeConfig>): NewsFactorBridge {
  if (!instance) instance = new NewsFactorBridge(config);
  return instance;
}

export function resetNewsFactorBridge(): void { instance = null; }
