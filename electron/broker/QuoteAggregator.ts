// ── QUANT MOO — QuoteAggregator ─────────────────────────────────────
// R1 CONC-02: 多券商行情聚合 + 套利扫描
// 接收所有已连接券商的TaggedQuoteInfo → 按standardCode聚合 → 分发给前端
// 同时扫描跨券商套利机会 (bid(brokerA) > ask(brokerB) → arbitrage)

import { CodeNormalizer } from './CodeNormalizer';
import type { MarketType, TaggedQuoteInfo } from './IBrokerAdapterV2';
import type { BrokerManagerV2 } from './BrokerManagerV2';

export interface AggregatedQuote {
  standardCode: string;
  market: MarketType;
  brokers: TaggedQuoteInfo[];     // 每个券商的最新行情
  bestBid: { brokerId: string; price: number; brokerName: string };
  bestAsk: { brokerId: string; price: number; brokerName: string };
  spreadPct: number;              // bestBid/bestAsk spread %
  arbitrage: ArbitrageOpportunity | null;
  lastUpdate: number;             // UTC ms
}

export interface ArbitrageOpportunity {
  exists: boolean;
  buyBroker: { brokerId: string; brokerName: string; ask: number };
  sellBroker: { brokerId: string; brokerName: string; bid: number };
  profitPct: number;              // (bid - ask) / ask * 100
  profitPerUnit: number;          // bid - ask (absolute)
  timestamp: number;
  staleMs: number;                // how old the quotes are
}

export interface QuoteAggregatorConfig {
  minArbitrageThresholdPct: number;   // default: 0.05% (5bps)
  quoteStaleMs: number;               // default: 5000ms
  maxCacheEntriesPerSymbol: number;   // default: 100
}

const DEFAULT_CONFIG: QuoteAggregatorConfig = {
  minArbitrageThresholdPct: 0.05,
  quoteStaleMs: 5000,
  maxCacheEntriesPerSymbol: 100,
};

type AggregatedQuoteCallback = (quotes: AggregatedQuote[]) => void;
type ArbitrageCallback = (opportunities: ArbitrageOpportunity[]) => void;

export class QuoteAggregator {
  private config: QuoteAggregatorConfig;
  private normalizer: CodeNormalizer;
  private quotes = new Map<string, AggregatedQuote>();   // standardCode → AggregatedQuote
  private brokerQuotes = new Map<string, Map<string, TaggedQuoteInfo>>(); // brokerId → (code → quote)
  private aggCallbacks: AggregatedQuoteCallback[] = [];
  private arbCallbacks: ArbitrageCallback[] = [];

  constructor(config: Partial<QuoteAggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.normalizer = new CodeNormalizer();
  }

  /**
   * Called by BrokerManagerV2 when any broker pushes a quote.
   */
  onBrokerQuote(brokerId: string, quotes: TaggedQuoteInfo[]): void {
    const now = Date.now();

    for (const q of quotes) {
      // Normalize code
      const normalized = this.normalizer.normalize(q.originalCode, brokerId, q.brokerType);
      if (!normalized.normalized) continue;

      const tagged = {
        code: q.code,
        price: q.price,
        change: q.change,
        changePct: q.changePct,
        volume: q.volume,
        turnover: q.turnover,
        high: q.high,
        low: q.low,
        open: q.open,
        prevClose: q.prevClose,
        time: q.time,
        brokerId: q.brokerId,
        brokerName: q.brokerName,
        brokerType: q.brokerType,
        market: q.market,
        originalCode: q.originalCode,
        standardCode: normalized.standardCode,
        timestamp: now,
      } as TaggedQuoteInfo;

      // Store per-broker quote
      if (!this.brokerQuotes.has(brokerId)) {
        this.brokerQuotes.set(brokerId, new Map());
      }
      this.brokerQuotes.get(brokerId)!.set(tagged.standardCode, tagged);

      // Aggregate
      this._aggregate(tagged.standardCode, tagged);
    }

    // Flush to listeners
    this._flushAggregated();
  }

  /**
   * Get aggregated quotes for a specific standard code.
   */
  getCrossBrokerQuotes(standardCode: string): AggregatedQuote | null {
    return this.quotes.get(standardCode) || null;
  }

  /**
   * Get all aggregated quotes.
   */
  getAllAggregated(): AggregatedQuote[] {
    return Array.from(this.quotes.values());
  }

  /**
   * Scan for arbitrage opportunities above threshold.
   */
  scanArbitrageOpportunities(thresholdPct?: number): ArbitrageOpportunity[] {
    const threshold = thresholdPct ?? this.config.minArbitrageThresholdPct;
    const opportunities: ArbitrageOpportunity[] = [];
    const now = Date.now();

    for (const agg of this.quotes.values()) {
      if (!agg.arbitrage?.exists) continue;
      if (agg.arbitrage.profitPct >= threshold) {
        opportunities.push({
          ...agg.arbitrage,
          staleMs: now - agg.lastUpdate,
        });
      }
    }

    // Sort by profit
    opportunities.sort((a, b) => b.profitPct - a.profitPct);

    return opportunities;
  }

  /**
   * Get best quote price for a standard code.
   */
  getBestPrice(standardCode: string, side: 'bid' | 'ask'): { brokerId: string; price: number | undefined } {
    const agg = this.quotes.get(standardCode);
    if (!agg) return { brokerId: '', price: undefined };
    return side === 'bid' ? agg.bestBid : agg.bestAsk;
  }

  // ═══ Callbacks ═══════════════════════════════════════

  onAggregatedQuote(callback: AggregatedQuoteCallback): void {
    this.aggCallbacks.push(callback);
  }

  removeAggregatedQuote(callback: AggregatedQuoteCallback): void {
    this.aggCallbacks = this.aggCallbacks.filter(c => c !== callback);
  }

  onArbitrage(callback: ArbitrageCallback): void {
    this.arbCallbacks.push(callback);
  }

  removeArbitrage(callback: ArbitrageCallback): void {
    this.arbCallbacks = this.arbCallbacks.filter(c => c !== callback);
  }

  // ═══ Wire to BrokerManagerV2 ═══════════════════════
  /**
   * Attach this aggregator to BrokerManagerV2's global quote feed.
   */
  attachToManager(manager: BrokerManagerV2): void {
    manager.onGlobalQuote((quotes) => {
      // Group quotes by brokerId
      const grouped = new Map<string, TaggedQuoteInfo[]>();
      for (const q of quotes) {
        if (!grouped.has(q.brokerId)) grouped.set(q.brokerId, []);
        grouped.get(q.brokerId)!.push(q);
      }
      for (const [brokerId, brokerQuotes] of grouped) {
        this.onBrokerQuote(brokerId, brokerQuotes);
      }
    });
  }

  // ═══ Private ═════════════════════════════════════════

  private _aggregate(standardCode: string, quote: TaggedQuoteInfo): void {
    let agg = this.quotes.get(standardCode);
    if (!agg) {
      agg = {
        standardCode,
        market: quote.market,
        brokers: [],
        bestBid: { brokerId: '', price: 0, brokerName: '' },
        bestAsk: { brokerId: '', price: Infinity, brokerName: '' },
        spreadPct: 0,
        arbitrage: null,
        lastUpdate: Date.now(),
      };
      this.quotes.set(standardCode, agg);
    }

    // Update/Insert broker quote in brokers list
    const idx = agg.brokers.findIndex(b => b.brokerId === quote.brokerId);
    if (idx >= 0) {
      agg.brokers[idx] = quote;
    } else {
      agg.brokers.push(quote);
      // Limit cache
      if (agg.brokers.length > this.config.maxCacheEntriesPerSymbol) {
        agg.brokers = agg.brokers.slice(-this.config.maxCacheEntriesPerSymbol);
      }
    }

    // Update best bid/ask across all brokers
    let bestBidPrice = -Infinity;
    let bestAskPrice = Infinity;
    let bestBidBroker = { brokerId: '', price: 0, brokerName: '' };
    let bestAskBroker = { brokerId: '', price: Infinity, brokerName: '' };

    for (const bq of agg.brokers) {
      if (bq.bid && bq.bid > bestBidPrice) {
        bestBidPrice = bq.bid;
        bestBidBroker = { brokerId: bq.brokerId, price: bq.bid, brokerName: bq.brokerName };
      }
      if (bq.ask && bq.ask > 0 && bq.ask < bestAskPrice) {
        bestAskPrice = bq.ask;
        bestAskBroker = { brokerId: bq.brokerId, price: bq.ask, brokerName: bq.brokerName };
      }
    }

    agg.bestBid = bestBidBroker;
    agg.bestAsk = bestAskBroker;
    agg.spreadPct = bestAskPrice > 0 ? ((bestBidPrice - bestAskPrice) / bestAskPrice) * 100 : 0;
    agg.lastUpdate = Date.now();

    // Check arbitrage: bestBid(broker1) > bestAsk(broker2)
    if (bestBidPrice > bestAskPrice && bestBidBroker.brokerId !== bestAskBroker.brokerId) {
      const profitPct = ((bestBidPrice - bestAskPrice) / bestAskPrice) * 100;
      agg.arbitrage = {
        exists: true,
        buyBroker: { brokerId: bestAskBroker.brokerId, brokerName: bestAskBroker.brokerName, ask: bestAskPrice },
        sellBroker: { brokerId: bestBidBroker.brokerId, brokerName: bestBidBroker.brokerName, bid: bestBidPrice },
        profitPct,
        profitPerUnit: bestBidPrice - bestAskPrice,
        timestamp: Date.now(),
        staleMs: 0,
      };
    } else {
      agg.arbitrage = { exists: false } as ArbitrageOpportunity;
    }
  }

  private _flushAggregated(): void {
    if (this.aggCallbacks.length === 0 && this.arbCallbacks.length === 0) return;

    const all = this.getAllAggregated();

    if (this.aggCallbacks.length > 0) {
      for (const cb of this.aggCallbacks) cb(all);
    }

    if (this.arbCallbacks.length > 0) {
      const opps = this.scanArbitrageOpportunities();
      if (opps.length > 0) {
        for (const cb of this.arbCallbacks) cb(opps);
      }
    }
  }

  // Cleanup
  destroy(): void {
    this.quotes.clear();
    this.brokerQuotes.clear();
    this.aggCallbacks = [];
    this.arbCallbacks = [];
  }
}
