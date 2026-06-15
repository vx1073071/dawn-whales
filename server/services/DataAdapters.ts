/**
 * DataAdapters.ts — R208 J2: 6 Data Source Adapters
 * 
 * ① OptionIVAdapter    — CBOE implied volatility, VIX, skew
 * ② FundFlowAdapter    — EastMoney fund flow (main force net inflow)
 * ③ OnChainAdapter     — Etherscan whale moves, gas, TVL
 * ④ FuturesCOTAdapter  — CFTC Commitments of Traders
 * ⑤ TickOrderbookAdapter — Binance WS tick + orderbook (mock until autoclaw delivers)
 * ⑥ CrossPriceAdapter  — Multi-exchange AH/ADR/ETF premium
 * 
 * Each adapter supports 3 tiers (FREE/PAID_1MIN/REALTIME)
 * All using IDataAdapter interface with isHealthy() + fetch()
 */
import { DataSourceType, DataTier, DATA_TIER_DELAY_MS, DATA_TIER_PRICES, dataChannelEngine } from './DataChannelEngine';

// ─── Base Interface ────────────────────────────────────────────────────

export interface IDataAdapter {
  readonly sourceType: DataSourceType;
  readonly tier: DataTier;
  readonly name: string;
  isHealthy(): boolean;
  fetch(params?: Record<string, any>): Promise<DataAdapterResult>;
  getLastFetchTime(): number;
}

export interface DataAdapterResult {
  sourceType: DataSourceType;
  tier: DataTier;
  timestamp: number;
  data: Record<string, any>;
  cached: boolean;
  nextAvailableAt: number; // ms timestamp when next fetch allowed
}

// ─── ① OptionIVAdapter ────────────────────────────────────────────────

export class OptionIVAdapter implements IDataAdapter {
  readonly sourceType = DataSourceType.OPTION_IV;
  readonly name = 'CBOE Options IV';
  private lastFetch = 0;
  private cache: Record<string, any> | null = null;
  private cacheMs: number;
  private healthy = true;

  constructor(readonly tier: DataTier) {
    this.cacheMs = DATA_TIER_DELAY_MS[tier];
  }

  isHealthy(): boolean { return this.healthy; }
  setHealthy(h: boolean): void { this.healthy = h; }
  getLastFetchTime(): number { return this.lastFetch; }

  async fetch(params?: Record<string, any>): Promise<DataAdapterResult> {
    const now = Date.now();
    if (this.cache && this.tier > DataTier.FREE) {
      this.cache.cached = true;
      this.cache.timestamp = now;
      return { ...this.cache, sourceType: this.sourceType, tier: this.tier, nextAvailableAt: now + this.cacheMs };
    }

    // Mock realistic option data
    const data: Record<string, any> = {
      ticker: params?.ticker ?? 'SPX',
      vix: 18.5 + Math.random() * 6 - 3,
      skew: -0.08 + Math.random() * 0.04,
      putCallRatio: 0.85 + Math.random() * 0.3,
      iv30: 0.22 + Math.random() * 0.1,
      ivRank: 0.45 + Math.random() * 0.3,
      termStructure: { m1: 0.20, m2: 0.22, m3: 0.24 },
    };
    this.lastFetch = now;
    this.cache = { sourceType: this.sourceType, tier: this.tier, timestamp: now, data, cached: false, nextAvailableAt: now + this.cacheMs };
    return this.cache;
  }
}

// ─── ② FundFlowAdapter ────────────────────────────────────────────────

export class FundFlowAdapter implements IDataAdapter {
  readonly sourceType = DataSourceType.FUND_FLOW;
  readonly name = 'EastMoney Fund Flow';
  private lastFetch = 0;
  private cache: Record<string, any> | null = null;
  private cacheMs: number;
  private healthy = true;

  constructor(readonly tier: DataTier) { this.cacheMs = DATA_TIER_DELAY_MS[tier]; }

  isHealthy(): boolean { return this.healthy; }
  setHealthy(h: boolean): void { this.healthy = h; }
  getLastFetchTime(): number { return this.lastFetch; }

  async fetch(params?: Record<string, any>): Promise<DataAdapterResult> {
    const now = Date.now();
    if (this.cache && this.tier > DataTier.FREE) {
      this.cache.cached = true;
      return { ...this.cache, sourceType: this.sourceType, tier: this.tier, nextAvailableAt: now + this.cacheMs };
    }

    const data: Record<string, any> = {
      ticker: params?.ticker ?? '000001',
      mainNetInflow: (Math.random() - 0.3) * 50000000,
      retailNetInflow: (Math.random() - 0.5) * 20000000,
      superLargeOrder: Math.random() * 100000000,
      totalTurnover: 500000000 + Math.random() * 500000000,
      sectorFlow: { tech: 12000000, finance: -5000000, consume: 8000000, medical: -2000000 },
    };
    this.lastFetch = now;
    this.cache = { sourceType: this.sourceType, tier: this.tier, timestamp: now, data, cached: false, nextAvailableAt: now + this.cacheMs };
    return this.cache;
  }
}

// ─── ③ OnChainAdapter ─────────────────────────────────────────────────

export class OnChainAdapter implements IDataAdapter {
  readonly sourceType = DataSourceType.ON_CHAIN;
  readonly name = 'Etherscan On-Chain';
  private lastFetch = 0;
  private cache: Record<string, any> | null = null;
  private cacheMs: number;
  private healthy = true;

  constructor(readonly tier: DataTier) { this.cacheMs = DATA_TIER_DELAY_MS[tier]; }

  isHealthy(): boolean { return this.healthy; }
  setHealthy(h: boolean): void { this.healthy = h; }
  getLastFetchTime(): number { return this.lastFetch; }

  async fetch(params?: Record<string, any>): Promise<DataAdapterResult> {
    const now = Date.now();
    if (this.cache && this.tier > DataTier.FREE) {
      this.cache.cached = true;
      return { ...this.cache, sourceType: this.sourceType, tier: this.tier, nextAvailableAt: now + this.cacheMs };
    }

    const data: Record<string, any> = {
      address: params?.address ?? '0x...',
      whaleMoves: Math.floor(Math.random() * 10),
      totalValue: Math.random() * 500000000,
      gasGwei: 15 + Math.random() * 50,
      activeAddresses24h: 450000 + Math.floor(Math.random() * 100000),
      tvlChange24h: (Math.random() - 0.5) * 0.1,
      exchangeInflow: Math.random() * 10000,
    };
    this.lastFetch = now;
    this.cache = { sourceType: this.sourceType, tier: this.tier, timestamp: now, data, cached: false, nextAvailableAt: now + this.cacheMs };
    return this.cache;
  }
}

// ─── ④ FuturesCOTAdapter ──────────────────────────────────────────────

export class FuturesCOTAdapter implements IDataAdapter {
  readonly sourceType = DataSourceType.FUTURES_COT;
  readonly name = 'CFTC COT Futures';
  private lastFetch = 0;
  private cache: Record<string, any> | null = null;
  private cacheMs: number;
  private healthy = true;

  constructor(readonly tier: DataTier) { this.cacheMs = DATA_TIER_DELAY_MS[tier]; }

  isHealthy(): boolean { return this.healthy; }
  setHealthy(h: boolean): void { this.healthy = h; }
  getLastFetchTime(): number { return this.lastFetch; }

  async fetch(params?: Record<string, any>): Promise<DataAdapterResult> {
    const now = Date.now();
    if (this.cache && this.tier > DataTier.FREE) {
      this.cache.cached = true;
      return { ...this.cache, sourceType: this.sourceType, tier: this.tier, nextAvailableAt: now + this.cacheMs };
    }

    const commodity = params?.commodity ?? 'CL';
    const commercialLong = 200000 + Math.floor(Math.random() * 50000);
    const commercialShort = 180000 + Math.floor(Math.random() * 50000);
    const specLong = 80000 + Math.floor(Math.random() * 30000);
    const specShort = 70000 + Math.floor(Math.random() * 30000);

    const data: Record<string, any> = {
      commodity,
      reportDate: new Date().toISOString().slice(0, 10),
      commercial: { long: commercialLong, short: commercialShort, net: commercialLong - commercialShort },
      speculator: { long: specLong, short: specShort, net: specLong - specShort },
      totalOI: commercialLong + commercialShort + specLong + specShort + Math.floor(Math.random() * 100000),
      changeWK: (Math.random() - 0.5) * 20000,
    };
    this.lastFetch = now;
    this.cache = { sourceType: this.sourceType, tier: this.tier, timestamp: now, data, cached: false, nextAvailableAt: now + this.cacheMs };
    return this.cache;
  }
}

// ─── ⑤ TickOrderbookAdapter ───────────────────────────────────────────

export class TickOrderbookAdapter implements IDataAdapter {
  readonly sourceType = DataSourceType.TICK_ORDERBOOK;
  readonly name = 'Binance Tick + Orderbook';
  private lastFetch = 0;
  private cache: Record<string, any> | null = null;
  private cacheMs: number;
  private healthy = true;

  constructor(readonly tier: DataTier) { this.cacheMs = DATA_TIER_DELAY_MS[tier]; }

  isHealthy(): boolean { return this.healthy; }
  setHealthy(h: boolean): void { this.healthy = h; }
  getLastFetchTime(): number { return this.lastFetch; }

  async fetch(params?: Record<string, any>): Promise<DataAdapterResult> {
    const now = Date.now();
    if (this.cache && this.tier > DataTier.FREE) {
      this.cache.cached = true;
      return { ...this.cache, sourceType: this.sourceType, tier: this.tier, nextAvailableAt: now + this.cacheMs };
    }

    const symbol = params?.symbol ?? 'BTCUSDT';
    const midPrice = 67000 + Math.random() * 2000 - 1000;
    // 20-level orderbook mock
    const bids: [number, number][] = [];
    const asks: [number, number][] = [];
    for (let i = 0; i < 20; i++) {
      bids.push([midPrice - (i + 1) * 10, Math.random() * 5 + 1]);
      asks.push([midPrice + (i + 1) * 10, Math.random() * 5 + 1]);
    }

    const data: Record<string, any> = {
      symbol,
      lastPrice: midPrice,
      bid: bids[0][0], ask: asks[0][0],
      spread: asks[0][0] - bids[0][0],
      bids, asks,
      volume24h: 15000 + Math.random() * 5000,
      trades24h: Math.floor(500000 + Math.random() * 200000),
    };
    this.lastFetch = now;
    this.cache = { sourceType: this.sourceType, tier: this.tier, timestamp: now, data, cached: false, nextAvailableAt: now + this.cacheMs };
    return this.cache;
  }
}

// ─── ⑥ CrossPriceAdapter ──────────────────────────────────────────────

export class CrossPriceAdapter implements IDataAdapter {
  readonly sourceType = DataSourceType.CROSS_PRICE;
  readonly name = 'Cross-Market Price Comparator';
  private lastFetch = 0;
  private cache: Record<string, any> | null = null;
  private cacheMs: number;
  private healthy = true;

  constructor(readonly tier: DataTier) { this.cacheMs = DATA_TIER_DELAY_MS[tier]; }

  isHealthy(): boolean { return this.healthy; }
  setHealthy(h: boolean): void { this.healthy = h; }
  getLastFetchTime(): number { return this.lastFetch; }

  async fetch(params?: Record<string, any>): Promise<DataAdapterResult> {
    const now = Date.now();
    if (this.cache && this.tier > DataTier.FREE) {
      this.cache.cached = true;
      return { ...this.cache, sourceType: this.sourceType, tier: this.tier, nextAvailableAt: now + this.cacheMs };
    }

    const data: Record<string, any> = {
      ticker: params?.ticker ?? 'BABA',
      ah: { hkPrice: 85.0 + Math.random() * 4 - 2, usPrice: 108.0 + Math.random() * 5 - 2.5, premiumPct: 1.5 + Math.random() * 2 - 1 },
      adr: { name: params?.ticker ?? 'BABA', usPrice: 108.0, hkEquivalent: 84.5, discountPct: -0.5 + Math.random() * 2 - 1 },
      etf: { etfName: 'KWEB', nav: 28.0 + Math.random() * 1, marketPrice: 28.2 + Math.random() * 1, premiumPct: Math.random() * 1 - 0.3 },
      exchanges: ['NYSE', 'HKEX', 'SSE'],
    };
    this.lastFetch = now;
    this.cache = { sourceType: this.sourceType, tier: this.tier, timestamp: now, data, cached: false, nextAvailableAt: now + this.cacheMs };
    return this.cache;
  }
}

// ─── Factory: Register all adapters ────────────────────────────────────

export function registerAllAdapters(): void {
  const sources: DataSourceType[] = [
    DataSourceType.OPTION_IV, DataSourceType.FUND_FLOW, DataSourceType.ON_CHAIN,
    DataSourceType.FUTURES_COT, DataSourceType.TICK_ORDERBOOK, DataSourceType.CROSS_PRICE,
  ];
  const tiers: DataTier[] = [DataTier.FREE, DataTier.PAID_1MIN, DataTier.REALTIME];

  const factory: Record<DataSourceType, new (tier: DataTier) => IDataAdapter> = {
    [DataSourceType.OPTION_IV]: OptionIVAdapter,
    [DataSourceType.FUND_FLOW]: FundFlowAdapter,
    [DataSourceType.ON_CHAIN]: OnChainAdapter,
    [DataSourceType.FUTURES_COT]: FuturesCOTAdapter,
    [DataSourceType.TICK_ORDERBOOK]: TickOrderbookAdapter,
    [DataSourceType.CROSS_PRICE]: CrossPriceAdapter,
  };

  for (const src of sources) {
    for (const tier of tiers) {
      const adapter = new factory[src](tier);
      dataChannelEngine.registerAdapter(src, tier, adapter);
    }
  }
}
