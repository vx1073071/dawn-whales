// @ts-nocheck — R114 JVS engine WIP
// DAWN WHALES R114 QTE-10 — OrderBook Core Engine
// PM: 深度行情 P0, 多券商聚合, Snapshot + Delta 合并, 断线全量恢复
// Binance/OKX/Bybit WS depth verified

// ═══════════ Types ═══════════

export interface OrderBookLevel {
  price: number;
  size: number;
  count?: number; // number of orders at this level (if available)
}

export interface OrderBookSnapshot {
  brokerId: string;
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
  lastUpdateId?: number; // Binance-style sequence
  seqId?: number;        // OKX/Bybit-style sequence
  version?: string;
}

export interface OrderBookDelta {
  brokerId: string;
  symbol: string;
  bids: OrderBookLevel[]; // all bids to update/remove (size=0 means delete)
  asks: OrderBookLevel[];
  timestamp: number;
  lastUpdateId: number;  // Binance: final update id
  prevUpdateId: number;  // Binance: first update id in event
  seqId?: number;        // OKX/Bybit sequence
}

export interface OrderBookState {
  brokerId: string;
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
  seqId?: number;
  timestamp: number;
  depth: number; // retained depth (default 200)
  initialized: boolean;
  lastFullSnapshot: number;
  updateCount: number;
}

export interface DepthAnalysis {
  imbalance: number;      // -1 (all asks) to +1 (all bids)
  wallBid: number | null; // largest bid wall price
  wallBidSize: number;
  wallAsk: number | null;
  wallAskSize: number;
  liquidityScore: number; // 0-100
  spread: number;
  spreadPct: number;
  bidDepth: number;       // cumulative bid volume
  askDepth: number;       // cumulative ask volume
  timestamp: number;
}

// ═══════════ OrderBook Engine ═══════════

const DEFAULT_DEPTH = 200;

function cloneLevels(levels: OrderBookLevel[]): OrderBookLevel[] {
  return levels.map((l) => ({ ...l }));
}

/** Merge snapshot into empty state */
function applySnapshot(
  state: OrderBookState | null,
  snapshot: OrderBookSnapshot,
  depth: number = DEFAULT_DEPTH
): OrderBookState {
  return {
    brokerId: snapshot.brokerId,
    symbol: snapshot.symbol,
    bids: cloneLevels(snapshot.bids.slice(0, depth)),
    asks: cloneLevels(snapshot.asks.slice(0, depth)),
    lastUpdateId: snapshot.lastUpdateId || 0,
    seqId: snapshot.seqId,
    timestamp: snapshot.timestamp,
    depth,
    initialized: true,
    lastFullSnapshot: Date.now(),
    updateCount: 0,
  };
}

/** Apply delta (incremental update) to state — Binance style */
function applyDelta(
  _state: OrderBookState,
  delta: OrderBookDelta,
  depth: number = DEFAULT_DEPTH
): OrderBookState {
  const bids = cloneLevels(_state.bids);
  const asks = cloneLevels(_state.asks);

  function mergeSide(side: OrderBookLevel[], updates: OrderBookLevel[], isBid: boolean): OrderBookLevel[] {
    const map = new Map<number, OrderBookLevel>();
    for (const l of side) map.set(l.price, l);
    for (const u of updates) {
      if (u.size === 0) {
        map.delete(u.price);
      } else {
        map.set(u.price, { price: u.price, size: u.size, count: u.count });
      }
    }
    const sorted = Array.from(map.values()).sort((a, b) =>
      isBid ? b.price - a.price : a.price - b.price
    );
    return sorted.slice(0, depth);
  }

  const newBids = mergeSide(bids, delta.bids, true);
  const newAsks = mergeSide(asks, delta.asks, false);

  return {
    ..._state,
    bids: newBids,
    asks: newAsks,
    lastUpdateId: delta.lastUpdateId,
    seqId: delta.seqId ?? _state.seqId,
    timestamp: delta.timestamp,
    updateCount: _state.updateCount + 1,
  };
}

/** Validate snapshot + delta sequence for Binance */
function validateSequence(
  state: OrderBookState,
  delta: OrderBookDelta
): boolean {
  // Binance: firstUpdateId <= lastUpdateId+1 <= finalUpdateId
  if (delta.prevUpdateId != null && state.lastUpdateId != null) {
    if (delta.prevUpdateId > state.lastUpdateId + 1) return false;
  }
  // OKX/Bybit: seqId must be monotonic
  if (delta.seqId != null && state.seqId != null && delta.seqId < state.seqId) {
    return false;
  }
  return true;
}

/** Check if state needs full re-sync (gap > threshold) */
function needsFullSync(
  state: OrderBookState,
  _lastSnapshotTime: number,
  maxGapMs: number = 30_000
): boolean {
  if (!state.initialized) return true;
  if (Date.now() - state.lastFullSnapshot > maxGapMs) return true;
  if (state.updateCount > 50_000) return true; // periodic refresh
  return false;
}

/** Clear levels at/above bid or at/below ask (crossed book fix) */
function clearCrossed(state: OrderBookState): OrderBookState {
  if (state.bids.length === 0 || state.asks.length === 0) return state;
  const bestBid = state.bids[0].price;
  const bestAsk = state.asks[0].price;
  if (bestBid < bestAsk) return state;

  const bids = state.bids.filter((l) => l.price < bestAsk);
  const asks = state.asks.filter((l) => l.price > bestBid);
  return { ...state, bids: bids.slice(0, state.depth), asks: asks.slice(0, state.depth) };
}

// ═══════════ Multi-Broker Aggregator ═══════════

export interface AggregatedOrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  brokerStates: Map<string, OrderBookState>;
  timestamp: number;
  depth: number;
}

function aggregateBooks(
  symbol: string,
  states: Map<string, OrderBookState>,
  depth: number = DEFAULT_DEPTH
): AggregatedOrderBook {
  const bidMap = new Map<number, number>();
  const askMap = new Map<number, number>();
  let latestTs = 0;

  for (const [, state] of states) {
    if (!state.initialized || state.symbol !== symbol) continue;
    for (const l of state.bids) {
      bidMap.set(l.price, (bidMap.get(l.price) || 0) + l.size);
    }
    for (const l of state.asks) {
      askMap.set(l.price, (askMap.get(l.price) || 0) + l.size);
    }
    if (state.timestamp > latestTs) latestTs = state.timestamp;
  }

  const bids = Array.from(bidMap.entries())
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => b.price - a.price)
    .slice(0, depth);

  const asks = Array.from(askMap.entries())
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => a.price - b.price)
    .slice(0, depth);

  return {
    symbol,
    bids,
    asks,
    brokerStates: new Map(states),
    timestamp: latestTs,
    depth,
  };
}

// ═══════════ Depth Analyzer (subset integrated into OrderBook for R114) ═══════════

function analyzeDepth(bids: OrderBookLevel[], asks: OrderBookLevel[]): DepthAnalysis {
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spread = bestAsk - bestBid;
  const mid = (bestBid + bestAsk) / 2;
  const spreadPct = mid > 0 ? (spread / mid) * 100 : 0;

  // Imbalance: (bidVol - askVol) / totalVol → range [-1, 1]
  let bidVol = 0, askVol = 0;
  for (const l of bids) bidVol += l.size;
  for (const l of asks) askVol += l.size;
  const totalVol = bidVol + askVol;
  const imbalance = totalVol === 0 ? 0 : (bidVol - askVol) / totalVol;

  // Wall detection: single level > 3x average
  const avgBid = bids.length > 0 ? bidVol / bids.length : 0;
  const avgAsk = asks.length > 0 ? askVol / asks.length : 0;
  let wallBid: number | null = null, wallBidSize = 0;
  let wallAsk: number | null = null, wallAskSize = 0;
  for (const l of bids) {
    if (l.size > avgBid * 3 && l.size > wallBidSize) {
      wallBid = l.price; wallBidSize = l.size;
    }
  }
  for (const l of asks) {
    if (l.size > avgAsk * 3 && l.size > wallAskSize) {
      wallAsk = l.price; wallAskSize = l.size;
    }
  }

  // Liquidity score 0-100
  // Based on: total depth, number of levels, spread, imbalance
  const depthScore = Math.min(100, (bidVol + askVol) / 100_000 * 100);
  const levelScore = Math.min(100, (bids.length + asks.length) / 40 * 100);
  const spreadScore = spreadPct < 0.01 ? 100 : spreadPct < 0.05 ? 80 : spreadPct < 0.1 ? 60 : spreadPct < 0.5 ? 40 : 20;
  const liquidityScore = Math.round((depthScore + levelScore + spreadScore) / 3);

  return {
    imbalance: +imbalance.toFixed(4),
    wallBid, wallBidSize,
    wallAsk, wallAskSize,
    liquidityScore,
    spread: +spread.toFixed(8),
    spreadPct: +spreadPct.toFixed(4),
    bidDepth: bidVol,
    askDepth: askVol,
    timestamp: Date.now(),
  };
}

// ═══════════ OrderBook Manager (singleton per symbol) ═══════════

export class OrderBookManager {
  private states: Map<string, Map<string, OrderBookState>> = new Map();
  private depth: number;

  constructor(depth = DEFAULT_DEPTH) {
    this.depth = depth;
  }

  /**
   * Initialize order book from snapshot.
   * Returns true if new, false if re-init.
   */
  initSnapshot(snapshot: OrderBookSnapshot): { state: OrderBookState; isNew: boolean } {
    const existing = this.getBrokerState(snapshot.brokerId, snapshot.symbol);
    const isNew = !existing?.initialized;
    const state = applySnapshot(existing ?? null, snapshot, this.depth);
    this.ensureState(state);
    return { state, isNew };
  }

  /**
   * Apply delta update. Validates sequence.
   * Returns null if sequence gap → needs re-sync.
   */
  applyDelta(delta: OrderBookDelta): OrderBookState | null {
    const state = this.getBrokerState(delta.brokerId, delta.symbol);
    if (!state || !state.initialized) {
      // Discard: no snapshot yet
      return null;
    }

    if (!validateSequence(state, delta)) {
      // Gap detected → set stale, signal full re-sync
      state.initialized = false;
      return null;
    }

    const updated = applyDelta(state, delta, this.depth);
    const cleaned = clearCrossed(updated);
    this.ensureState(cleaned);
    return cleaned;
  }

  /**
   * Check if a symbol's book from a broker needs full re-sync.
   * Trigger conditions: not initialized, >30s since last full snapshot, >50k updates.
   */
  needsFullSync(brokerId: string, symbol: string): boolean {
    const state = this.getBrokerState(brokerId, symbol);
    if (!state || !state.initialized) return true;
    return needsFullSync(state, state.lastFullSnapshot);
  }

  /**
   * Get aggregated book from all brokers for a symbol
   */
  getAggregated(symbol: string): AggregatedOrderBook {
    const matched = new Map<string, OrderBookState>();
    for (const [, brokerStates] of this.states) {
      const state = brokerStates.get(symbol);
      if (state?.initialized) matched.set(state.brokerId, state);
    }
    return aggregateBooks(symbol, matched, this.depth);
  }

  /**
   * Get depth analysis for a symbol (single broker or aggregated)
   */
  getDepthAnalysis(brokerId: string, symbol: string): DepthAnalysis | null {
    const state = this.getBrokerState(brokerId, symbol);
    if (!state?.initialized) return null;
    return analyzeDepth(state.bids, state.asks);
  }

  getAggregatedDepthAnalysis(symbol: string): DepthAnalysis {
    const agg = this.getAggregated(symbol);
    return analyzeDepth(agg.bids, agg.asks);
  }

  getBrokerState(brokerId: string, symbol: string): OrderBookState | undefined {
    return this.states.get(brokerId)?.get(symbol);
  }

  getState(symbol: string): Map<string, OrderBookState> | undefined {
    return this.states.get(symbol);
  }

  /**
   * Clear stale broker state (disconnect, symbol removal)
   */
  clearBroker(brokerId: string): void {
    this.states.delete(brokerId);
  }

  clearSymbol(brokerId: string, symbol: string): void {
    this.states.get(brokerId)?.delete(symbol);
  }

  private ensureState(state: OrderBookState): void {
    let brokerMap = this.states.get(state.brokerId);
    if (!brokerMap) {
      brokerMap = new Map();
      this.states.set(state.brokerId, brokerMap);
    }
    brokerMap.set(state.symbol, state);
  }

  getStats(): { totalBooks: number; initializedBooks: number; totalUpdates: number } {
    let total = 0, init = 0, updates = 0;
    for (const [, brokerStates] of this.states) {
      for (const state of brokerStates.values()) {
        total++;
        if (state.initialized) init++;
        updates += state.updateCount;
      }
    }
    return { totalBooks: total, initializedBooks: init, totalUpdates: updates };
  }
}
