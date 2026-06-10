// ── Q39: Order Book Simulator ────────────────────────────────────────────────
// Limit Order Book model with queue position estimation + fill probability
// Slippage simulation + market impact model (Almgren-Chriss)

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrderBookLevel {
  price: number;
  size: number;
  nOrders: number;         // Number of orders at this level
  queuePosition?: number; // Position in queue (0 = first)
}

export interface OrderBookSnapshot {
  symbol: string;
  timestamp: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadBp: number;       // Spread in basis points
  midPrice: number;
  depth: number;          // Total depth (bid + ask volume)
  imbalance: number;       // Bid volume / total volume ratio
}

export interface FillProbability {
  orderType: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  fillProb: number;        // 0-1
  expectedFillTime: number; // ms
  expectedSlippage: number; // % of price
  avgFillPrice: number;
  worstFillPrice: number;
  bestFillPrice: number;
}

export interface SimulatedTrade {
  side: 'buy' | 'sell';
  quantity: number;
  fillPrice: number;
  slippage: number;
  marketImpact: number;
  queuePosition: number;
  timestamp: number;
}

export interface LOBConfig {
  tickSize: number;        // Minimum price increment
  lotSize: number;        // Minimum order size
  maxLevels: number;      // How many price levels to track
  avgOrderSize: number;   // Average order size per level
  orderArrivalRate: number; // Orders per second per level
  cancelRate: number;     // % of orders cancelled
}

// ── Order Book Simulator ──────────────────────────────────────────────────

export class OrderBookSimulator {
  private config: LOBConfig;

  constructor(config?: Partial<LOBConfig>) {
    this.config = {
      tickSize: 0.01,
      lotSize: 100,
      maxLevels: 10,
      avgOrderSize: 1000,
      orderArrivalRate: 1.0,
      cancelRate: 0.3,
      ...config,
    };
    log.info('[OrderBookSimulator] Initialized', this.config);
  }

  // ── Generate Snapshot ───────────────────────────────────────────────

  generateSnapshot(
    symbol: string,
    midPrice: number,
    depth: number = 50000
  ): OrderBookSnapshot {
    const { tickSize, maxLevels, avgOrderSize } = this.config;
    const spread = tickSize * (1 + Math.floor(Math.random() * 5));

    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];

    let cumBidSize = 0, cumAskSize = 0;

    for (let i = 0; i < maxLevels; i++) {
      const bidPrice = Math.round((midPrice - spread / 2 - i * tickSize) * 100) / 100;
      const askPrice = Math.round((midPrice + spread / 2 + i * tickSize) * 100) / 100;

      // Size grows with distance from mid (realistic LOB shape)
      const distFactor = 1 + i * 0.3;
      const bidSize = Math.round((avgOrderSize + Math.random() * avgOrderSize) * distFactor);
      const askSize = Math.round((avgOrderSize + Math.random() * avgOrderSize) * distFactor);

      cumBidSize += bidSize;
      cumAskSize += askSize;

      bids.push({
        price: bidPrice,
        size: bidSize,
        nOrders: Math.ceil(bidSize / this.config.lotSize),
        queuePosition: i,
      });

      asks.push({
        price: askPrice,
        size: askSize,
        nOrders: Math.ceil(askSize / this.config.lotSize),
        queuePosition: i,
      });
    }

    const totalDepth = cumBidSize + cumAskSize;
    const imbalance = totalDepth > 0 ? cumBidSize / totalDepth : 0.5;

    return {
      symbol,
      timestamp: Date.now(),
      bids,
      asks,
      spread: Math.round(spread * 10000) / 10000,
      spreadBp: Math.round((spread / midPrice) * 10000 * 100) / 100,
      midPrice,
      depth: cumBidSize + cumAskSize,
      imbalance: Math.round(imbalance * 10000) / 10000,
    };
  }

  // ── Fill Probability ────────────────────────────────────────────────

  calcFillProbability(
    book: OrderBookSnapshot,
    side: 'buy' | 'sell',
    orderType: 'market' | 'limit' | 'stop',
    price: number,
    quantity: number
  ): FillProbability {
    const { tickSize, lotSize } = this.config;
    const levels = side === 'buy' ? book.asks : book.bids;
    const mid = book.midPrice;

    let remainingQty = quantity;
    let totalCost = 0;
    let filledLevels = 0;
    let worstPrice = price;

    for (const level of levels) {
      if (remainingQty <= 0) break;

      const fillQty = Math.min(remainingQty, level.size);
      totalCost += fillQty * level.price;
      remainingQty -= fillQty;
      filledLevels++;

      if (filledLevels === 1) worstPrice = level.price;
    }

    const filledQty = quantity - remainingQty;
    const avgFillPrice = filledQty > 0 ? totalCost / filledQty : price;

    // Fill probability: market orders always fill (eventually)
    // Limit orders fill if price crosses level
    let fillProb = 0;
    if (orderType === 'market') {
      fillProb = 1;
    } else if (orderType === 'limit') {
      const bestLevel = levels[0];
      const bestLevelPrice = bestLevel?.price ?? mid;
      const crossesLevel = side === 'buy'
        ? price >= bestLevelPrice
        : price <= bestLevelPrice;
      fillProb = crossesLevel ? 0.95 - filledLevels * 0.05 : 0;
    }

    // Slippage
    const slippage = Math.abs(avgFillPrice - mid) / mid;
    const expectedSlippage = Math.round(slippage * 10000) / 100;

    return {
      orderType,
      side,
      price,
      quantity,
      fillProb: Math.round(fillProb * 1000) / 1000,
      expectedFillTime: orderType === 'market' ? 100 + filledLevels * 50 : 500 + filledLevels * 200,
      expectedSlippage,
      avgFillPrice: Math.round(avgFillPrice * 100) / 100,
      worstFillPrice: Math.round(worstPrice * 100) / 100,
      bestFillPrice: Math.round((levels[0]?.price ?? mid) * 100) / 100,
    };
  }

  // ── Almgren-Chriss Market Impact ─────────────────────────────────────

  calcMarketImpact(
    orderQty: number,
    price: number,
    avgDailyVolume: number,
    vol: number = 0.02,
    urgency: 'low' | 'medium' | 'high' = 'medium'
  ): { temporaryImpact: number; permanentImpact: number; totalImpact: number } {
    const { orderArrivalRate } = this.config;
    const participationRate = avgDailyVolume > 0 ? orderQty / avgDailyVolume : 0.1;
    const eta = urgency === 'low' ? 0.5 : urgency === 'high' ? 2.0 : 1.0;
    const lambda = urgency === 'low' ? 0.1 : urgency === 'high' ? 1.0 : 0.5;

    // Almgren-Chriss: temporary impact ∝ participation rate × vol × η
    const temporaryImpact = eta * participationRate * vol * price;
    // Permanent impact ∝ participation rate × vol × λ
    const permanentImpact = lambda * participationRate * vol * price;
    const totalImpact = temporaryImpact + permanentImpact;

    return {
      temporaryImpact: Math.round(temporaryImpact * 100) / 100,
      permanentImpact: Math.round(permanentImpact * 100) / 100,
      totalImpact: Math.round(totalImpact * 100) / 100,
    };
  }

  // ── Simulate Trade Execution ─────────────────────────────────────────

  simulateExecution(
    book: OrderBookSnapshot,
    side: 'buy' | 'sell',
    quantity: number,
    orderType: 'market' | 'limit' | 'stop' = 'market',
    urgency: 'low' | 'medium' | 'high' = 'medium'
  ): SimulatedTrade[] {
    const { cancelRate } = this.config;
    const levels = side === 'buy' ? book.asks : book.bids;
    const trades: SimulatedTrade[] = [];
    let remainingQty = quantity;

    // Apply cancel rate
    const effectiveBook = levels.map(level => ({
      ...level,
      size: Math.round(level.size * (1 - cancelRate * Math.random())),
    }));

    for (const level of effectiveBook) {
      if (remainingQty <= 0 || level.size <= 0) break;

      const fillQty = Math.min(remainingQty, level.size);
      const slippage = Math.abs(level.price - book.midPrice) / book.midPrice;
      const impact = this.calcMarketImpact(
        fillQty, book.midPrice, book.depth, 0.02, urgency
      );

      trades.push({
        side,
        quantity: fillQty,
        fillPrice: Math.round(level.price * 100) / 100,
        slippage: Math.round(slippage * 10000) / 100,
        marketImpact: Math.round(impact.totalImpact * 100) / 100,
        queuePosition: level.queuePosition ?? 0,
        timestamp: Date.now() + (level.queuePosition ?? 0) * 100,
      });

      remainingQty -= fillQty;
    }

    return trades;
  }

  // ── Queue Estimation ──────────────────────────────────────────────────

  estimateQueuePosition(
    book: OrderBookSnapshot,
    side: 'buy' | 'sell',
    price: number
  ): number {
    const levels = side === 'buy' ? book.asks : book.bids;

    // Find the level at or better than our limit price
    let queuePos = 0;
    for (const level of levels) {
      const crosses = side === 'buy'
        ? level.price <= price
        : level.price >= price;

      if (!crosses) continue;

      queuePos += level.nOrders;
      if (level.price === price) break;
    }

    return queuePos;
  }

  getConfig(): LOBConfig {
    return { ...this.config };
  }
}

export default OrderBookSimulator;