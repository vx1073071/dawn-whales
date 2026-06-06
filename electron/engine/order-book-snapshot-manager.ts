// JVS-119: Order Book Snapshot Manager
// Manage order book snapshots with depth tracking and spread analysis

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface OrderLevel {
  price: number;
  quantity: number;
  orderCount?: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  timestamp: number;
  bids: OrderLevel[]; // Sorted by price descending
  asks: OrderLevel[]; // Sorted by price ascending
  sequenceId?: number;
}

export interface SpreadAnalysis {
  symbol: string;
  timestamp: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPct: number;
  midPrice: number;
  bidDepth: number;
  askDepth: number;
  imbalance: number; // -1 to 1 (negative = more sell pressure)
}

export interface DepthAnalysis {
  symbol: string;
  timestamp: number;
  levels: number;
  totalBidVolume: number;
  totalAskVolume: number;
  cumulativeBidVolume: number[];
  cumulativeAskVolume: number[];
  volumeRatio: number; // bid/ask ratio
}

export interface BookManagerConfig {
  maxSnapshots: number;
  depthLevels: number;
  enableSpreadAlerts: boolean;
  spreadAlertThreshold: number; // percentage
}

export class OrderBookSnapshotManager extends EventEmitter {
  private config: Required<BookManagerConfig>;
  private snapshots: Map<string, OrderBookSnapshot[]> = new Map(); // symbol -> history
  private latestBooks: Map<string, OrderBookSnapshot> = new Map(); // symbol -> latest

  constructor(config?: Partial<BookManagerConfig>) {
    super();
    this.config = {
      maxSnapshots: config?.maxSnapshots ?? 100,
      depthLevels: config?.depthLevels ?? 10,
      enableSpreadAlerts: config?.enableSpreadAlerts ?? true,
      spreadAlertThreshold: config?.spreadAlertThreshold ?? 2.0,
    };
    log.info(`[OrderBookManager] Initialized (maxSnapshots=${this.config.maxSnapshots})`);
  }

  /**
   * Update order book snapshot
   */
  updateSnapshot(snapshot: OrderBookSnapshot): void {
    // Validate and sort
    const sorted = this.validateAndSort(snapshot);

    // Store latest
    this.latestBooks.set(snapshot.symbol, sorted);

    // Add to history
    if (!this.snapshots.has(snapshot.symbol)) {
      this.snapshots.set(snapshot.symbol, []);
    }
    const history = this.snapshots.get(snapshot.symbol)!;
    history.push(sorted);
    if (history.length > this.config.maxSnapshots) {
      history.shift();
    }

    this.emit('update', sorted);

    // Spread alert
    if (this.config.enableSpreadAlerts) {
      const analysis = this.analyzeSpread(snapshot.symbol);
      if (analysis && analysis.spreadPct > this.config.spreadAlertThreshold) {
        this.emit('spreadAlert', analysis);
        log.warn(`[OrderBookManager] Wide spread for ${snapshot.symbol}: ${analysis.spreadPct.toFixed(2)}%`);
      }
    }
  }

  /**
   * Validate and sort order book
   */
  private validateAndSort(snapshot: OrderBookSnapshot): OrderBookSnapshot {
    return {
      ...snapshot,
      bids: [...snapshot.bids]
        .sort((a, b) => b.price - a.price)
        .slice(0, this.config.depthLevels),
      asks: [...snapshot.asks]
        .sort((a, b) => a.price - b.price)
        .slice(0, this.config.depthLevels),
    };
  }

  /**
   * Get latest order book for symbol
   */
  getLatestBook(symbol: string): OrderBookSnapshot | null {
    return this.latestBooks.get(symbol) ?? null;
  }

  /**
   * Get snapshot history
   */
  getHistory(symbol: string, limit?: number): OrderBookSnapshot[] {
    const history = this.snapshots.get(symbol);
    if (!history) return [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Analyze spread for symbol
   */
  analyzeSpread(symbol: string): SpreadAnalysis | null {
    const book = this.latestBooks.get(symbol);
    if (!book || book.bids.length === 0 || book.asks.length === 0) {
      return null;
    }

    const bestBid = book.bids[0].price;
    const bestAsk = book.asks[0].price;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;
    const spreadPct = (spread / midPrice) * 100;

    const bidDepth = book.bids.reduce((sum, level) => sum + level.quantity, 0);
    const askDepth = book.asks.reduce((sum, level) => sum + level.quantity, 0);
    const totalDepth = bidDepth + askDepth;
    const imbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;

    return {
      symbol,
      timestamp: book.timestamp,
      bestBid,
      bestAsk,
      spread,
      spreadPct,
      midPrice,
      bidDepth,
      askDepth,
      imbalance,
    };
  }

  /**
   * Analyze depth for symbol
   */
  analyzeDepth(symbol: string): DepthAnalysis | null {
    const book = this.latestBooks.get(symbol);
    if (!book) return null;

    const cumulativeBidVolume: number[] = [];
    const cumulativeAskVolume: number[] = [];
    let totalBidVolume = 0;
    let totalAskVolume = 0;

    for (const level of book.bids) {
      totalBidVolume += level.quantity;
      cumulativeBidVolume.push(totalBidVolume);
    }

    for (const level of book.asks) {
      totalAskVolume += level.quantity;
      cumulativeAskVolume.push(totalAskVolume);
    }

    return {
      symbol,
      timestamp: book.timestamp,
      levels: Math.max(book.bids.length, book.asks.length),
      totalBidVolume,
      totalAskVolume,
      cumulativeBidVolume,
      cumulativeAskVolume,
      volumeRatio: totalAskVolume > 0 ? totalBidVolume / totalAskVolume : 0,
    };
  }

  /**
   * Get best bid/ask
   */
  getBestPrices(symbol: string): { bid: number | null; ask: number | null } {
    const book = this.latestBooks.get(symbol);
    if (!book) return { bid: null, ask: null };

    return {
      bid: book.bids.length > 0 ? book.bids[0].price : null,
      ask: book.asks.length > 0 ? book.asks[0].price : null,
    };
  }

  /**
   * Get all tracked symbols
   */
  getSymbols(): string[] {
    return Array.from(this.latestBooks.keys());
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSymbols: number;
    totalSnapshots: number;
    avgSnapshotsPerSymbol: number;
  } {
    let totalSnapshots = 0;
    for (const history of this.snapshots.values()) {
      totalSnapshots += history.length;
    }

    return {
      totalSymbols: this.latestBooks.size,
      totalSnapshots,
      avgSnapshotsPerSymbol: this.latestBooks.size > 0 ? totalSnapshots / this.latestBooks.size : 0,
    };
  }

  /**
   * Clear symbol
   */
  clearSymbol(symbol: string): void {
    this.latestBooks.delete(symbol);
    this.snapshots.delete(symbol);
  }

  /**
   * Clear all
   */
  clearAll(): void {
    this.latestBooks.clear();
    this.snapshots.clear();
  }

  /**
   * Destroy
   */
  destroy(): void {
    this.clearAll();
    this.removeAllListeners();
  }
}

// Singleton
let bookManagerInstance: OrderBookSnapshotManager | null = null;

export function getOrderBookSnapshotManager(
  config?: Partial<BookManagerConfig>
): OrderBookSnapshotManager {
  if (!bookManagerInstance) {
    bookManagerInstance = new OrderBookSnapshotManager(config);
  }
  return bookManagerInstance;
}
