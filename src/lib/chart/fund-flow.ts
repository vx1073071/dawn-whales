// DAWN WHALES R115 QTE-30 — FundFlow Engine
// PM: 4类大单分级(超大单>100万/大单>20万/中单>4万/小单), 实时聚合, 准确率>99%

import type { TickRecord } from './tick-cache';

// ═══════════ Types ═══════════

export interface FundFlowThresholds {
  hugeThreshold: number;  // default 100万
  largeThreshold: number; // default 20万
  midThreshold: number;   // default 4万
}

export interface FundFlowBucket {
  symbol: string;
  brokerId: string;
  hugeInflow: number;
  hugeOutflow: number;
  largeInflow: number;
  largeOutflow: number;
  midInflow: number;
  midOutflow: number;
  smallInflow: number;
  smallOutflow: number;
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  tradeCount: number;
  startTime: number;
  endTime: number;
  thresholds: FundFlowThresholds;
}

export interface FundFlowSummary {
  symbols: Map<string, FundFlowBucket>;
  aggregated: FundFlowBucket;
  startTime: number;
  endTime: number;
  totalSymbols: number;
}

// ═══════════ Default thresholds ═══════════

export const DEFAULT_THRESHOLDS: FundFlowThresholds = {
  hugeThreshold: 1_000_000,
  largeThreshold: 200_000,
  midThreshold: 40_000,
};

// ═══════════ FundFlow Engine ═══════════

export class FundFlowEngine {
  private thresholds: FundFlowThresholds;
  private activeBuckets: Map<string, FundFlowBucket> = new Map();
  private completedBuckets: FundFlowBucket[] = [];
  private lastReset = Date.now();

  constructor(thresholds?: Partial<FundFlowThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /** Feed a tick record into the flow engine */
  feed(tick: TickRecord): void {
    const key = this.bucketKey(tick.brokerId, tick.symbol);
    let bucket = this.activeBuckets.get(key);

    if (!bucket) {
      bucket = this.createEmptyBucket(tick.brokerId, tick.symbol, tick.time);
      this.activeBuckets.set(key, bucket);
    }

    const size = tick.size * tick.price; // notional value
    const isInflow = tick.side === 'buy';

    if (size >= this.thresholds.hugeThreshold) {
      if (isInflow) bucket.hugeInflow += size;
      else bucket.hugeOutflow += size;
    } else if (size >= this.thresholds.largeThreshold) {
      if (isInflow) bucket.largeInflow += size;
      else bucket.largeOutflow += size;
    } else if (size >= this.thresholds.midThreshold) {
      if (isInflow) bucket.midInflow += size;
      else bucket.midOutflow += size;
    } else {
      if (isInflow) bucket.smallInflow += size;
      else bucket.smallOutflow += size;
    }

    if (isInflow) bucket.totalInflow += size;
    else bucket.totalOutflow += size;

    bucket.netFlow = bucket.totalInflow - bucket.totalOutflow;
    bucket.tradeCount++;
    bucket.endTime = Math.max(bucket.endTime, tick.time);
  }

  /** Batch feed ticks */
  feedBatch(ticks: TickRecord[]): void {
    for (const tick of ticks) this.feed(tick);
  }

  /** Get flow stats for a symbol+broker */
  getFlow(brokerId: string, symbol: string): FundFlowBucket | undefined {
    return this.activeBuckets.get(this.bucketKey(brokerId, symbol));
  }

  /** Get aggregated flow across all brokers for a symbol */
  getAggregatedFlow(symbol: string): FundFlowBucket {
    const aggregated = this.createEmptyBucket('*', symbol, this.lastReset);
    for (const [key, bucket] of this.activeBuckets) {
      if (!key.endsWith(`:${symbol}`)) continue;
      aggregated.hugeInflow += bucket.hugeInflow;
      aggregated.hugeOutflow += bucket.hugeOutflow;
      aggregated.largeInflow += bucket.largeInflow;
      aggregated.largeOutflow += bucket.largeOutflow;
      aggregated.midInflow += bucket.midInflow;
      aggregated.midOutflow += bucket.midOutflow;
      aggregated.smallInflow += bucket.smallInflow;
      aggregated.smallOutflow += bucket.smallOutflow;
      aggregated.totalInflow += bucket.totalInflow;
      aggregated.totalOutflow += bucket.totalOutflow;
      aggregated.tradeCount += bucket.tradeCount;
      aggregated.endTime = Math.max(aggregated.endTime, bucket.endTime);
    }
    aggregated.netFlow = aggregated.totalInflow - aggregated.totalOutflow;
    return aggregated;
  }

  /** Get summary of all symbols */
  getSummary(): FundFlowSummary {
    const bySymbol = new Map<string, FundFlowBucket>();
    for (const [key, bucket] of this.activeBuckets) {
      const symbol = key.split(':')[1];
      const existing = bySymbol.get(symbol);
      if (existing) {
        this.mergeBuckets(existing, bucket);
      } else {
        bySymbol.set(symbol, { ...bucket, brokerId: '*', symbol });
      }
    }

    const aggregated = this.createEmptyBucket('*', '*', this.lastReset);
    for (const [, b] of bySymbol) this.mergeBuckets(aggregated, b);

    return {
      symbols: bySymbol,
      aggregated,
      startTime: this.lastReset,
      endTime: Date.now(),
      totalSymbols: bySymbol.size,
    };
  }

  /** Get top N symbols by net flow */
  getTopByNetFlow(n = 10, direction: 'inflow' | 'outflow' = 'inflow'): FundFlowBucket[] {
    const summary = this.getSummary();
    const buckets = Array.from(summary.symbols.values());
    buckets.sort((a, b) => direction === 'inflow'
      ? b.netFlow - a.netFlow
      : a.netFlow - b.netFlow
    );
    return buckets.slice(0, n);
  }

  /** Get symbols with significant huge-order activity (huge > 5x large threshold in value) */
  getInstitutionFlow(threshold = 5): FundFlowBucket[] {
    const hugeThreshold = this.thresholds.largeThreshold * threshold;
    const results: FundFlowBucket[] = [];
    for (const [, bucket] of this.activeBuckets) {
      if (bucket.hugeInflow > hugeThreshold || bucket.hugeOutflow > hugeThreshold) {
        results.push(bucket);
      }
    }
    results.sort((a, b) => (b.hugeInflow + b.hugeOutflow) - (a.hugeInflow + a.hugeOutflow));
    return results;
  }

  /** Reset all buckets (e.g., daily close) */
  reset(): FundFlowBucket[] {
    const completed = Array.from(this.activeBuckets.values());
    this.completedBuckets.push(...completed);
    this.activeBuckets.clear();
    this.lastReset = Date.now();
    return completed;
  }

  /** Get absolute accuracy: (match against Futu Qot_GetCapitalFlow benchmark data) */
  validate(benchmark: FundFlowBucket, tolerance = 0.01): { accurate: boolean; diff: number; deviationPct: number } {
    const our = this.getAggregatedFlow(benchmark.symbol);
    const diff = Math.abs(our.netFlow - benchmark.netFlow);
    const avgFlow = (Math.abs(our.netFlow) + Math.abs(benchmark.netFlow)) / 2;
    const deviationPct = avgFlow > 0 ? diff / avgFlow : 0;
    return {
      accurate: deviationPct <= tolerance,
      diff,
      deviationPct,
    };
  }

  getActiveBuckets(): Map<string, FundFlowBucket> {
    return new Map(this.activeBuckets);
  }

  getCompletedBuckets(): FundFlowBucket[] {
    return this.completedBuckets;
  }

  updateThresholds(newThresholds: Partial<FundFlowThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  private bucketKey(brokerId: string, symbol: string): string {
    return `${brokerId}:${symbol}`;
  }

  private createEmptyBucket(brokerId: string, symbol: string, startTime: number): FundFlowBucket {
    return {
      symbol,
      brokerId,
      hugeInflow: 0, hugeOutflow: 0,
      largeInflow: 0, largeOutflow: 0,
      midInflow: 0, midOutflow: 0,
      smallInflow: 0, smallOutflow: 0,
      totalInflow: 0, totalOutflow: 0,
      netFlow: 0,
      tradeCount: 0,
      startTime,
      endTime: startTime,
      thresholds: { ...this.thresholds },
    };
  }

  private mergeBuckets(target: FundFlowBucket, source: FundFlowBucket): void {
    target.hugeInflow += source.hugeInflow;
    target.hugeOutflow += source.hugeOutflow;
    target.largeInflow += source.largeInflow;
    target.largeOutflow += source.largeOutflow;
    target.midInflow += source.midInflow;
    target.midOutflow += source.midOutflow;
    target.smallInflow += source.smallInflow;
    target.smallOutflow += source.smallOutflow;
    target.totalInflow += source.totalInflow;
    target.totalOutflow += source.totalOutflow;
    target.tradeCount += source.tradeCount;
    target.netFlow = target.totalInflow - target.totalOutflow;
    target.endTime = Math.max(target.endTime, source.endTime);
  }
}
