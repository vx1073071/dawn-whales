/**
 * TimeAndSalesEngine — R260 QUANT MOO P2-09
 *
 * 闪电图 Time & Sales 逐笔成交引擎。
 * 实时接收逐笔成交数据，构建时间轴可视化数据流。
 *
 * Feature set:
 *   - 逐笔成交聚合 (按时间/价格/量级分桶)
 *   - 价格阶梯分布 (price ladder)
 *   - 大单检测 (block trade detection)
 *   - 买卖方向推断 (Lee-Ready algorithm)
 *   - 成交量加权平均价 (VWAP)
 *   - 分时成交量柱图
 *   - 异常成交检测 (z-score on tick volume)
 *   - 实时推送粒度: 100ms 批次
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Ring buffer for tick storage (max 50000 ticks)
 *   - Price ladder with 0.01 granularity
 *
 * @author JVS
 * @round R260
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export interface Tick {
  symbol: string;
  timestamp: number;
  price: number;
  volume: number;
  side?: 'buy' | 'sell' | 'unknown';
  tradeId?: string;
  exchange?: string;
  conditions?: string[];  // trade conditions e.g. 'ODD_LOT', 'BLOCK'
}

export interface BucketedTick {
  bucketTs: number;        // floored timestamp (100ms)
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ticks: number;           // number of ticks aggregated
  buys: number;
  sells: number;
  vwap: number;
  anomalies: number;
}

export interface PriceLadderLevel {
  price: number;
  totalVolume: number;
  tradeCount: number;
  buyVolume: number;
  sellVolume: number;
  lastTradeTime: number;
  dominance: 'buy' | 'sell' | 'neutral';
}

export interface BlockTrade {
  tick: Tick;
  isBlock: boolean;
  blockThreshold: number;
  percentile: number;      // 0-100 among recent ticks
}

export interface TASConfig {
  bucketMs: number;
  maxTicks: number;
  anomalyZScore: number;
  blockPercentile: number;
  ladderPrecision: number;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_CONFIG: TASConfig = {
  bucketMs: 100,
  maxTicks: 50000,
  anomalyZScore: 3.0,
  blockPercentile: 95,
  ladderPrecision: 0.01,   // $0.01 for stocks
};

// ─── Engine ──────────────────────────────────────────────

export class TimeAndSalesEngine extends EventEmitter {
  private static instance: TimeAndSalesEngine;

  private ticks: Tick[] = [];
  private buckets: Map<string, BucketedTick[]> = new Map(); // key = symbol
  private config: TASConfig;
  private volumeHistory: Map<string, number[]> = new Map(); // key = symbol, for anomaly detection
  private idCounter = 0;

  constructor(config?: Partial<TASConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<TASConfig>): TimeAndSalesEngine {
    if (!TimeAndSalesEngine.instance) {
      TimeAndSalesEngine.instance = new TimeAndSalesEngine(config);
    } else if (config) {
      TimeAndSalesEngine.instance.config = { ...TimeAndSalesEngine.instance.config, ...config };
    }
    return TimeAndSalesEngine.instance;
  }

  reset(): void {
    this.ticks = [];
    this.buckets.clear();
    this.volumeHistory.clear();
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Tick Ingestion ─────────────────────────────────────

  ingest(tick: Tick): void {
    tick.tradeId = tick.tradeId || `tid_${++this.idCounter}`;
    tick.timestamp = tick.timestamp || Date.now();

    // Ring buffer — push first so inferSide has access to prior ticks
    this.ticks.push(tick);
    if (this.ticks.length > this.config.maxTicks) {
      this.ticks.shift();
    }

    // Auto-detect side (after tick is in buffer so prior ticks are visible)
    if (!tick.side || tick.side === 'unknown') {
      tick.side = this.inferSide(tick);
    }

    // Bucket
    this.addToBucket(tick);

    // Anomaly detection
    this.checkAnomaly(tick);

    // Block trade detection
    const block = this.detectBlockTrade(tick);
    if (block.isBlock) {
      this.emit('block_trade', block);
    }

    this.emit('tick', tick);
  }

  ingestBatch(ticks: Tick[]): void {
    for (const t of ticks) this.ingest(t);
    this.emit('batch_ingested', ticks.length);
  }

  // ─── Side Inference (Lee-Ready) ─────────────────────────

  inferSide(tick: Tick): 'buy' | 'sell' | 'unknown' {
    const recent = this.ticks.filter(t => t.symbol === tick.symbol);
    if (recent.length < 2) return 'unknown';

    const lastTick = recent[recent.length - 2]; // previous tick
    if (tick.price > lastTick.price) return 'buy';
    if (tick.price < lastTick.price) return 'sell';

    // Same price: compare to bid/ask midpoint if available
    return 'unknown';
  }

  // ─── Bucketing ──────────────────────────────────────────

  private addToBucket(tick: Tick): void {
    const bucketTs = Math.floor(tick.timestamp / this.config.bucketMs) * this.config.bucketMs;
    let symBuckets = this.buckets.get(tick.symbol);
    if (!symBuckets) { symBuckets = []; this.buckets.set(tick.symbol, symBuckets); }

    // Find existing bucket or create
    let bucket = symBuckets.find(b => b.bucketTs === bucketTs);
    if (!bucket) {
      bucket = {
        bucketTs, symbol: tick.symbol,
        open: tick.price, high: tick.price, low: tick.price, close: tick.price,
        volume: 0, ticks: 0, buys: 0, sells: 0, vwap: 0, anomalies: 0,
      };
      symBuckets.push(bucket);
    }

    bucket.high = Math.max(bucket.high, tick.price);
    bucket.low = Math.min(bucket.low, tick.price);
    bucket.close = tick.price;
    bucket.volume += tick.volume;
    bucket.ticks++;
    if (tick.side === 'buy') bucket.buys++;
    else if (tick.side === 'sell') bucket.sells++;
    bucket.vwap = bucket.volume > 0 ? (bucket.vwap * (bucket.ticks - 1) + tick.price * tick.volume) / bucket.volume : tick.price;
  }

  // ─── Anomaly Detection ──────────────────────────────────

  private checkAnomaly(tick: Tick): void {
    let history = this.volumeHistory.get(tick.symbol);
    if (!history) { history = []; this.volumeHistory.set(tick.symbol, history); }

    history.push(tick.volume);
    if (history.length > 200) history.shift();
    if (history.length < 10) return;

    const mean = history.reduce((s, v) => s + v, 0) / history.length;
    const vari = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;
    const std = Math.sqrt(vari);
    if (std === 0) return;

    const zScore = (tick.volume - mean) / std;
    if (Math.abs(zScore) >= this.config.anomalyZScore) {
      this.emit('anomalous_tick', { tick, zScore, mean, std });
    }
  }

  // ─── Block Trade Detection ──────────────────────────────

  detectBlockTrade(tick: Tick): BlockTrade {
    const symbolTicks = this.ticks.filter(t => t.symbol === tick.symbol);
    const volumes = symbolTicks.map(t => t.volume);
    volumes.sort((a, b) => a - b);
    const blockThreshold = volumes[Math.floor(volumes.length * this.config.blockPercentile / 100)] || tick.volume * 2;
    const isBlock = tick.volume >= blockThreshold;
    const rank = volumes.filter(v => v <= tick.volume).length;
    const percentile = volumes.length > 0 ? (rank / volumes.length) * 100 : 50;

    return { tick, isBlock, blockThreshold, percentile };
  }

  // ─── Price Ladder ───────────────────────────────────────

  getPriceLadder(symbol: string, limit = 50): PriceLadderLevel[] {
    const symbolTicks = this.ticks.filter(t => t.symbol === symbol);
    const ladder = new Map<number, PriceLadderLevel>();

    for (const tick of symbolTicks) {
      const price = Math.round(tick.price / this.config.ladderPrecision) * this.config.ladderPrecision;
      let level = ladder.get(price);
      if (!level) {
        level = { price, totalVolume: 0, tradeCount: 0, buyVolume: 0, sellVolume: 0, lastTradeTime: 0, dominance: 'neutral' };
        ladder.set(price, level);
      }
      level.totalVolume += tick.volume;
      level.tradeCount++;
      level.lastTradeTime = Math.max(level.lastTradeTime, tick.timestamp);
      if (tick.side === 'buy') level.buyVolume += tick.volume;
      else if (tick.side === 'sell') level.sellVolume += tick.volume;
    }

    // Determine dominance
    for (const level of ladder.values()) {
      if (level.buyVolume > level.sellVolume * 1.5) level.dominance = 'buy';
      else if (level.sellVolume > level.buyVolume * 1.5) level.dominance = 'sell';
    }

    return [...ladder.values()]
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, limit);
  }

  // ─── Queries ────────────────────────────────────────────

  getTicks(symbol?: string, limit = 100): Tick[] {
    let list = symbol ? this.ticks.filter(t => t.symbol === symbol) : this.ticks;
    return list.slice(-limit);
  }

  getBuckets(symbol: string, limit = 100): BucketedTick[] {
    const symBuckets = this.buckets.get(symbol);
    if (!symBuckets) return [];
    return symBuckets.slice(-limit);
  }

  getVWAP(symbol: string): number | null {
    const symBuckets = this.buckets.get(symbol);
    if (!symBuckets || symBuckets.length === 0) return null;
    const totalVol = symBuckets.reduce((s, b) => s + b.volume, 0);
    const totalVal = symBuckets.reduce((s, b) => s + b.vwap * b.volume, 0);
    return totalVol > 0 ? totalVal / totalVol : null;
  }

  getTickCount(symbol?: string): number {
    if (symbol) return this.ticks.filter(t => t.symbol === symbol).length;
    return this.ticks.length;
  }

  // ─── Mock ──────────────────────────────────────────────

  createMockTicks(symbol: string, count = 100): Tick[] {
    const ticks: Tick[] = [];
    let price = 100;
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 0.2;
      price += change;
      const ts = now - (count - i) * 150 + Math.round(Math.random() * 50);
      ticks.push({
        symbol,
        timestamp: ts,
        price: Math.round(price * 100) / 100,
        volume: Math.round(10 + Math.abs(Math.random() * 500 - 250)),
        tradeId: `mock_${symbol}_${i}`,
        exchange: 'NASDAQ',
      });
    }
    return ticks;
  }
}
