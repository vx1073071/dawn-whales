// ── R265 JVS-2 闪电图管线优化 (TimeAndSalesPipeline) ──
// 优化 TickData 处理管线：降噪/异常过滤/聚合压缩/批量查询/VWAP流式
// 专为高频 Time & Sales / Footprint 图表设计

export interface TickRecord {
  timestamp: number;   // ms
  price: number;
  volume: number;
  side?: 'buy' | 'sell' | 'neutral';
  exchange?: string;
  tradeId?: string;
}

export interface AggregatedTick {
  startTime: number;
  endTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
  vwap: number;
}

export interface VolumeProfileBin {
  priceLevel: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
}

export interface FootprintRow {
  price: number;
  bidVolume: number;
  askVolume: number;
  delta: number;           // bid - ask
  cumulativeDelta: number;
  totalVolume: number;
}

export interface PipelineStats {
  inputTicks: number;
  outputTicks: number;
  filteredTicks: number;
  aggregatedBars: number;
  processingTimeMs: number;
  compressionRatio: number;
}

// ═══════════ Config ═══════════

export interface TimeAndSalesPipelineConfig {
  // Noise filter
  noiseThreshold?: number;        // max price change % before flagged as noise, default 0.01 (1%)
  spikeThreshold?: number;        // max price change % before flagged as spike, default 5%
  minVolume?: number;             // minimum volume to keep (0 = keep all)
  outlierStdDev?: number;         // z-score threshold for outlier removal

  // Aggregation
  aggregationIntervalMs?: number; // default 1000ms (1-second bars)
  maxTicksPerBar?: number;        // max before auto-flush

  // Volume Profile
  priceStep?: number;             // bin size for volume profile
  profileDepth?: number;          // max number of price bins

  // Footprint
  footprintLevels?: number;       // price levels for footprint

  // VWAP
  vwapResetSession?: boolean;     // reset VWAP at session boundaries
}

export const DEFAULT_PIPELINE_CONFIG: Required<TimeAndSalesPipelineConfig> = {
  noiseThreshold: 0.01,
  spikeThreshold: 5,
  minVolume: 0,
  outlierStdDev: 4,
  aggregationIntervalMs: 1000,
  maxTicksPerBar: 10000,
  priceStep: 0.01,
  profileDepth: 100,
  footprintLevels: 20,
  vwapResetSession: true,
};

// ═══════════ Pipeline Engine ═══════════

export class TimeAndSalesPipeline {
  private config: Required<TimeAndSalesPipelineConfig>;
  private ticks: TickRecord[] = [];
  private aggregatedBars: AggregatedTick[] = [];
  private currentBar: Partial<AggregatedTick> | null = null;
  private vwapNumerator = 0;
  private vwapDenominator = 0;
  private processStartTime = 0;
  private totalFiltered = 0;

  // Volume profile bins keyed by price level string
  private volumeProfile: Map<string, VolumeProfileBin> = new Map();

  constructor(config?: TimeAndSalesPipelineConfig) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  }

  /** Reset all state */
  reset(): void {
    this.ticks = [];
    this.aggregatedBars = [];
    this.currentBar = null;
    this.vwapNumerator = 0;
    this.vwapDenominator = 0;
    this.totalFiltered = 0;
    this.volumeProfile.clear();
  }

  /** Get config (read-only copy) */
  getConfig(): Required<TimeAndSalesPipelineConfig> {
    return { ...this.config };
  }

  /** Update config at runtime */
  updateConfig(patch: Partial<TimeAndSalesPipelineConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  // ═══════════ Noise & Outlier Filtering ═══════════

  /**
   * Filter a tick: true = keep, false = discard
   */
  filterTick(tick: TickRecord): boolean {
    // Volume filter
    if (tick.volume < this.config.minVolume) return false;

    return true;
  }

  /**
   * Apply noise filter to a batch of ticks
   * Removes ticks where price change from last valid > noiseThreshold and < spikeThreshold
   * Removes spike ticks where price change > spikeThreshold
   */
  applyNoiseFilter(ticks: TickRecord[]): { clean: TickRecord[]; filtered: number } {
    const { noiseThreshold, spikeThreshold, outlierStdDev } = this.config;
    const clean: TickRecord[] = [];
    let filtered = 0;

    // First pass: remove spikes based on consecutive ticks
    for (let i = 0; i < ticks.length; i++) {
      const tick = ticks[i];
      if (i > 0 && clean.length > 0) {
        const prev = clean[clean.length - 1];
        const pctChange = Math.abs((tick.price - prev.price) / prev.price);

        if (pctChange > spikeThreshold / 100) {
          filtered++;
          continue; // spike — drop
        }

        // Small noise: if < threshold and volume is tiny, drop
        if (pctChange < noiseThreshold / 100 && tick.volume < 10) {
          filtered++;
          continue; // noise — drop
        }
      }

      clean.push(tick);
    }

    // Outlier removal by z-score on price
    if (outlierStdDev > 0 && clean.length > 10) {
      const prices = clean.map((t) => t.price);
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
      const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length;
      const stdDev = Math.sqrt(variance);

      const zFiltered: TickRecord[] = [];
      for (const tick of clean) {
        const z = Math.abs((tick.price - mean) / (stdDev || 1));
        if (z > outlierStdDev) {
          filtered++;
        } else {
          zFiltered.push(tick);
        }
      }

      this.totalFiltered += filtered;
      return { clean: zFiltered, filtered };
    }

    this.totalFiltered += filtered;
    return { clean, filtered };
  }

  // ═══════════ Tick Aggregation ═══════════

  /**
   * Ingest raw ticks, apply noise filter, and build aggregated bars
   */
  ingestTicks(
    ticks: TickRecord[],
  ): { bars: AggregatedTick[]; stats: PipelineStats } {
    this.processStartTime = Date.now();
    const inputCount = ticks.length;

    // Apply noise filter
    const { clean } = this.applyNoiseFilter(ticks);

    // Sort by timestamp
    clean.sort((a, b) => a.timestamp - b.timestamp);

    // Aggregate into bars
    const newBars: AggregatedTick[] = [];
    const { aggregationIntervalMs, maxTicksPerBar } = this.config;

    let barOpen = 0;
    let barHigh = -Infinity;
    let barLow = Infinity;
    let barClose = 0;
    let barVolume = 0;
    let barBuyVol = 0;
    let barSellVol = 0;
    let barTrades = 0;
    let barVwapNum = 0;
    let barVwapDen = 0;
    let barStart = 0;
    let tickCount = 0;

    const flushBar = () => {
      if (tickCount > 0 && barStart > 0) {
        newBars.push({
          startTime: barStart,
          endTime: barStart + aggregationIntervalMs,
          open: barOpen,
          high: barHigh,
          low: barLow,
          close: barClose,
          volume: barVolume,
          buyVolume: barBuyVol,
          sellVolume: barSellVol,
          tradeCount: barTrades,
          vwap: barVwapDen > 0 ? barVwapNum / barVwapDen : barClose,
        });
      }
      barHigh = -Infinity;
      barLow = Infinity;
      barVolume = 0;
      barBuyVol = 0;
      barSellVol = 0;
      barTrades = 0;
      barVwapNum = 0;
      barVwapDen = 0;
      tickCount = 0;
      barStart = 0;
    };

    for (const tick of clean) {
      const bucketStart = Math.floor(tick.timestamp / aggregationIntervalMs) * aggregationIntervalMs;

      if (bucketStart !== barStart) {
        flushBar();
        barStart = bucketStart;
        barOpen = tick.price;
      }

      barHigh = Math.max(barHigh, tick.price);
      barLow = Math.min(barLow, tick.price);
      barClose = tick.price;
      barVolume += tick.volume;
      barVwapNum += tick.price * tick.volume;
      barVwapDen += tick.volume;
      barTrades++;
      tickCount++;

      // Update VWAP tracking
      this.vwapNumerator += tick.price * tick.volume;
      this.vwapDenominator += tick.volume;

      if (tick.side === 'buy') barBuyVol += tick.volume;
      else if (tick.side === 'sell') barSellVol += tick.volume;

      // Volume profile
      this.updateVolumeProfile(tick);

      if (tickCount >= maxTicksPerBar) {
        flushBar();
      }
    }

    // Flush last partial bar
    flushBar();

    this.aggregatedBars = newBars;
    this.ticks = clean;

    const processingTime = Date.now() - this.processStartTime;

    return {
      bars: newBars,
      stats: {
        inputTicks: inputCount,
        outputTicks: clean.length,
        filteredTicks: inputCount - clean.length,
        aggregatedBars: newBars.length,
        processingTimeMs: processingTime,
        compressionRatio: clean.length > 0
          ? Math.round((newBars.length / clean.length) * 10000) / 100
          : 0,
      },
    };
  }

  // ═══════════ Volume Profile ═══════════

  private updateVolumeProfile(tick: TickRecord): void {
    const { priceStep, profileDepth } = this.config;
    const priceKey = (Math.round(tick.price / priceStep) * priceStep).toFixed(
      priceStep < 1 ? -Math.floor(Math.log10(priceStep)) : 0,
    );

    const existing = this.volumeProfile.get(priceKey);
    if (existing) {
      existing.totalVolume += tick.volume;
      existing.tradeCount++;
      if (tick.side === 'buy') existing.buyVolume += tick.volume;
      else existing.sellVolume += tick.volume;
    } else {
      this.volumeProfile.set(priceKey, {
        priceLevel: parseFloat(priceKey),
        totalVolume: tick.volume,
        buyVolume: tick.side === 'buy' ? tick.volume : 0,
        sellVolume: tick.side === 'sell' ? tick.volume : 0,
        tradeCount: 1,
      });
    }

    // Trim to profileDepth
    if (this.volumeProfile.size > profileDepth) {
      const sorted = [...this.volumeProfile.entries()]
        .sort((a, b) => b[1].totalVolume - a[1].totalVolume);
      const keep = new Map(sorted.slice(0, profileDepth));
      this.volumeProfile = keep;
    }
  }

  getVolumeProfile(): VolumeProfileBin[] {
    return [...this.volumeProfile.values()]
      .sort((a, b) => b.priceLevel - a.priceLevel);
  }

  getPOC(): VolumeProfileBin | null {
    let max = null;
    for (const bin of this.volumeProfile.values()) {
      if (!max || bin.totalVolume > max.totalVolume) {
        max = bin;
      }
    }
    return max;
  }

  /**
   * Get value area (70% of total volume around POC)
   */
  getValueArea(): { poc: VolumeProfileBin | null; vah: number; val: number } {
    const poc = this.getPOC();
    if (!poc || this.ticks.length === 0) {
      return { poc: null, vah: 0, val: 0 };
    }

    const sorted = this.getVolumeProfile();
    const totalVol = sorted.reduce((s, b) => s + b.totalVolume, 0);
    const targetVol = totalVol * 0.7;

    // Start from POC and expand outward
    const pocIdx = sorted.findIndex((b) => b.priceLevel === poc.priceLevel);
    if (pocIdx < 0) return { poc, vah: 0, val: 0 };

    let cumVol = poc.totalVolume;
    let upIdx = pocIdx + 1;
    let downIdx = pocIdx - 1;
    let vah = poc.priceLevel;
    let val = poc.priceLevel;

    while (cumVol < targetVol) {
      const up = upIdx < sorted.length ? sorted[upIdx] : null;
      const down = downIdx >= 0 ? sorted[downIdx] : null;

      if (up && (!down || up.totalVolume >= down.totalVolume)) {
        cumVol += up.totalVolume;
        vah = up.priceLevel;
        upIdx++;
      } else if (down) {
        cumVol += down.totalVolume;
        val = down.priceLevel;
        downIdx--;
      } else {
        break;
      }
    }

    return { poc, vah, val };
  }

  // ═══════════ Footprint Chart (Bid/Ask Delta) ═══════════

  /**
   * Generate footprint rows for a given time range
   */
  generateFootprint(startTime: number, endTime: number): FootprintRow[] {
    const { footprintLevels } = this.config;
    const relevantTicks = this.ticks.filter(
      (t) => t.timestamp >= startTime && t.timestamp < endTime,
    );

    if (relevantTicks.length === 0) return [];

    // Price range
    const prices = relevantTicks.map((t) => t.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const step = (maxP - minP) / footprintLevels || 0.01;

    // Initialize bins
    const bins: Map<number, { bid: number; ask: number; total: number }> = new Map();
    for (let i = 0; i < footprintLevels; i++) {
      const priceLevel = Math.round((minP + i * step) / 0.01) * 0.01;
      bins.set(priceLevel, { bid: 0, ask: 0, total: 0 });
    }

    // Fill bins
    for (const tick of relevantTicks) {
      const level = Math.round(tick.price / step) * step;
      const key = Math.round(level / 0.01) * 0.01;
      const existing = bins.get(key);
      if (existing) {
        existing.total += tick.volume;
        if (tick.side === 'buy') existing.bid += tick.volume;
        else existing.ask += tick.volume;
      }
    }

    // Build rows with cumulative delta
    const rows: FootprintRow[] = [];
    let cumDelta = 0;

    const sortedLevels = [...bins.entries()]
      .sort((a, b) => b[0] - a[0]); // high to low

    for (const [price, data] of sortedLevels) {
      const delta = data.bid - data.ask;
      cumDelta += delta;
      rows.push({
        price,
        bidVolume: data.bid,
        askVolume: data.ask,
        delta,
        cumulativeDelta: cumDelta,
        totalVolume: data.total,
      });
    }

    return rows;
  }

  // ═══════════ Streaming VWAP ═══════════

  getVWAP(): number {
    return this.vwapDenominator > 0
      ? this.vwapNumerator / this.vwapDenominator
      : 0;
  }

  resetVWAP(): void {
    this.vwapNumerator = 0;
    this.vwapDenominator = 0;
  }

  // ═══════════ Batch Query ═══════════

  /**
   * Query ticks within a time range
   */
  queryTicks(startTime: number, endTime: number): TickRecord[] {
    return this.ticks.filter(
      (t) => t.timestamp >= startTime && t.timestamp < endTime,
    );
  }

  /**
   * Get latest N ticks
   */
  getLatestTicks(n: number = 100): TickRecord[] {
    return this.ticks.slice(-n);
  }

  /**
   * Get aggregated bars within a time range
   */
  queryBars(startTime: number, endTime: number): AggregatedTick[] {
    return this.aggregatedBars.filter(
      (b) => b.startTime >= startTime && b.startTime < endTime,
    );
  }

  // ═══════════ Tick Count & Stats ═══════════

  getStats(): {
    totalTicks: number;
    totalFiltered: number;
    totalBars: number;
    compressionRatio: number;
    vwap: number;
    profileBins: number;
  } {
    return {
      totalTicks: this.ticks.length,
      totalFiltered: this.totalFiltered,
      totalBars: this.aggregatedBars.length,
      compressionRatio: this.ticks.length > 0
        ? Math.round((this.aggregatedBars.length / this.ticks.length) * 10000) / 100
        : 0,
      vwap: this.getVWAP(),
      profileBins: this.volumeProfile.size,
    };
  }

  /**
   * Identify block trades (volume > N * median)
   */
  detectBlockTrades(multiplier: number = 5): TickRecord[] {
    if (this.ticks.length < 10) return [];
    const volumes = this.ticks.map((t) => t.volume).sort((a, b) => a - b);
    const median = volumes[Math.floor(volumes.length / 2)];
    const threshold = median * multiplier;

    return this.ticks.filter((t) => t.volume > threshold);
  }

  /**
   * Calculate bid/ask imbalance ratio
   */
  getImbalanceRatio(): number {
    let buyVol = 0;
    let sellVol = 0;
    for (const t of this.ticks) {
      if (t.side === 'buy') buyVol += t.volume;
      else if (t.side === 'sell') sellVol += t.volume;
    }
    const total = buyVol + sellVol;
    return total > 0 ? (buyVol - sellVol) / total : 0;
  }
}

// ═══════════ Singleton ═══════════

let instance: TimeAndSalesPipeline | null = null;

export function getTimeAndSalesPipeline(config?: TimeAndSalesPipelineConfig): TimeAndSalesPipeline {
  if (!instance) {
    instance = new TimeAndSalesPipeline(config);
  } else if (config) {
    instance.updateConfig(config);
  }
  return instance;
}

export function resetTimeAndSalesPipeline(): void {
  if (instance) {
    instance.reset();
    instance = null;
  }
}
