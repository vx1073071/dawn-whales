// TradingEasy R114 QTE-12 — Tick Circular Buffer Cache
// PM: 循环缓冲5000条/symbol, ≥3家券商, UTC统一时间轴

export interface TickRecord {
  brokerId: string;
  symbol: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  time: number;      // Unix ms, UTC
  sequence?: number; // broker sequence id if available
  bid?: number;
  ask?: number;
}

export interface TickStats {
  symbol: string;
  totalTicks: number;
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
  avgSize: number;
  maxSize: number;
  vwap: number;
  lastPrice: number;
  brokerCount: number;
  windowMs: number;
}

const MAX_TICKS_PER_SYMBOL = 5000;

export class TickCircularBuffer {
  private buffers: Map<string, TickRecord[]> = new Map();
  private head: Map<string, number> = new Map(); // write position
  private count: Map<string, number> = new Map();
  private maxSize: number;

  constructor(maxSize = MAX_TICKS_PER_SYMBOL) {
    this.maxSize = maxSize;
  }

  /** Append tick to circular buffer */
  push(tick: TickRecord): void {
    const key = tick.symbol;
    let buf = this.buffers.get(key);
    let pos = this.head.get(key) ?? 0;
    let n = this.count.get(key) ?? 0;

    if (!buf) {
      buf = new Array(this.maxSize);
      this.buffers.set(key, buf);
    }

    buf[pos] = tick;
    this.head.set(key, (pos + 1) % this.maxSize);
    this.count.set(key, Math.min(n + 1, this.maxSize));
  }

  /** Get all ticks for a symbol sorted by time (most recent last) */
  getTicks(symbol: string, limit?: number): TickRecord[] {
    const buf = this.buffers.get(symbol);
    const n = this.count.get(symbol) ?? 0;
    const h = this.head.get(symbol) ?? 0;
    if (!buf || n === 0) return [];

    const start = n < this.maxSize ? 0 : h;
    const result: TickRecord[] = [];
    for (let i = 0; i < n; i++) {
      const idx = (start + i) % this.maxSize;
      if (buf[idx]) result.push(buf[idx]);
    }

    // Sort by time for safety
    result.sort((a, b) => a.time - b.time);

    return limit ? result.slice(-limit) : result;
  }

  /** Get ticks in time range [fromMs, toMs] */
  getTicksInRange(symbol: string, fromMs: number, toMs: number): TickRecord[] {
    return this.getTicks(symbol).filter((t) => t.time >= fromMs && t.time <= toMs);
  }

  /** Compute statistics for a symbol over most recent windowMs */
  computeStats(symbol: string, windowMs: number = 60000): TickStats {
    const now = Date.now();
    const ticks = this.getTicksInRange(symbol, now - windowMs, now);

    if (ticks.length === 0) {
      return {
        symbol, totalTicks: 0, buyVolume: 0, sellVolume: 0, tradeCount: 0,
        avgSize: 0, maxSize: 0, vwap: 0, lastPrice: 0, brokerCount: 0, windowMs,
      };
    }

    let buyVol = 0, sellVol = 0, totalVol = 0, totalPriceVol = 0;
    let maxSize = 0, totalSize = 0;
    const brokers = new Set<string>();

    for (const t of ticks) {
      if (t.side === 'buy') buyVol += t.size;
      else sellVol += t.size;
      totalVol += t.size * t.price;
      totalPriceVol += t.price * t.size;
      maxSize = Math.max(maxSize, t.size);
      totalSize += t.size;
      brokers.add(t.brokerId);
    }

    return {
      symbol,
      totalTicks: ticks.length,
      buyVolume: buyVol,
      sellVolume: sellVol,
      tradeCount: ticks.length,
      avgSize: totalSize / ticks.length,
      maxSize,
      vwap: totalVol > 0 ? totalPriceVol / totalVol : 0,
      lastPrice: ticks[ticks.length - 1].price,
      brokerCount: brokers.size,
      windowMs,
    };
  }

  /** Aggregate ticks by broker (multi-broker comparison) */
  aggregateByBroker(symbol: string, windowMs: number = 60000): Map<string, TickStats> {
    const now = Date.now();
    const ticks = this.getTicksInRange(symbol, now - windowMs, now);
    const byBroker = new Map<string, TickRecord[]>();
    for (const t of ticks) {
      const list = byBroker.get(t.brokerId) || [];
      list.push(t);
      byBroker.set(t.brokerId, list);
    }

    const stats = new Map<string, TickStats>();
    for (const [brokerId, recs] of byBroker) {
      let buyVol = 0, sellVol = 0, totalVol = 0, totalPriceVol = 0;
      let maxS = 0, totalS = 0;
      for (const r of recs) {
        if (r.side === 'buy') buyVol += r.size;
        else sellVol += r.size;
        totalVol += r.size * r.price;
        totalPriceVol += r.price * r.size;
        maxS = Math.max(maxS, r.size);
        totalS += r.size;
      }
      stats.set(brokerId, {
        symbol, totalTicks: recs.length, buyVolume: buyVol, sellVolume: sellVol,
        tradeCount: recs.length,
        avgSize: recs.length > 0 ? totalS / recs.length : 0,
        maxSize: maxS, vwap: totalVol > 0 ? totalPriceVol / totalVol : 0,
        lastPrice: recs[recs.length - 1]?.price ?? 0, brokerCount: 1, windowMs,
      });
    }
    return stats;
  }

  /** Clear old ticks beyond retention */
  prune(maxAgeMs: number = 300_000): number {
    const now = Date.now();
    let pruned = 0;
    for (const [symbol] of this.buffers) {
      const buf = this.buffers.get(symbol);
      if (!buf) continue;
      let n = this.count.get(symbol) ?? 0;
      if (n === 0) continue;
      const h = this.head.get(symbol) ?? 0;
      const start = n < this.maxSize ? 0 : h;
      const keep: TickRecord[] = [];
      for (let i = 0; i < n; i++) {
        const idx = (start + i) % this.maxSize;
        if (buf[idx] && now - buf[idx].time < maxAgeMs) {
          keep.push(buf[idx]);
        }
      }
      // Rebuild circular buffer
      const newBuf = new Array(this.maxSize);
      for (let i = 0; i < Math.min(keep.length, this.maxSize); i++) {
        newBuf[i] = keep[i];
      }
      this.buffers.set(symbol, newBuf);
      this.head.set(symbol, keep.length % this.maxSize);
      this.count.set(symbol, Math.min(keep.length, this.maxSize));
      pruned += n - keep.length;
    }
    return pruned;
  }

  /** List all symbols with cached ticks */
  symbols(): string[] {
    return Array.from(this.buffers.keys());
  }

  clear(symbol?: string): void {
    if (symbol) {
      this.buffers.delete(symbol);
      this.head.delete(symbol);
      this.count.delete(symbol);
    } else {
      this.buffers.clear();
      this.head.clear();
      this.count.clear();
    }
  }
}
