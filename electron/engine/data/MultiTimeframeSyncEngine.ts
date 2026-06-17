// ── R265 JVS-3 多时间框架引擎 (MultiTimeframeSyncEngine) ──
// 跨周期数据同步与对齐，支持9个时间框架的前向/后向查找、对齐、插值
// 对标 TradingView MTF Analysis，可用于多周期指标叠加、跨周期信号确认

export type TimeFrame = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | 'D' | 'W' | 'M';

export interface KlineBar {
  timestamp: number;   // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AlignedBar {
  timestamp: number;
  source: KlineBar | null;
  target: KlineBar | null;
  offset: number; // ms difference
}

export interface MultiTimeframeData {
  primary: TimeFrame;
  timeframes: Partial<Record<TimeFrame, KlineBar[]>>;
  aligned: AlignedBar[];
  coverage: number; // 0-1
}

export interface MTFSyncConfig {
  primary: TimeFrame;
  secondary: TimeFrame[];
  alignmentMode: 'nearest' | 'forward' | 'backward';
  maxAlignmentMs?: number; // max ms drift allowed
  interpolateMissing?: boolean;
}

// ═══════════ Time constants ═══════════

const TF_DURATION_MS: Record<TimeFrame, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  'D': 86_400_000,
  'W': 604_800_000,
  'M': 2_592_000_000, // ~30 days
};

const TF_ORDER: TimeFrame[] = ['1m', '5m', '15m', '30m', '1h', '4h', 'D', 'W', 'M'];

export function getTimeframeDuration(tf: TimeFrame): number {
  return TF_DURATION_MS[tf];
}

export function getTimeframeOrder(tf: TimeFrame): number {
  return TF_ORDER.indexOf(tf);
}

// ═══════════ MultiTimeframeSyncEngine ═══════════

export class MultiTimeframeSyncEngine {
  private config: MTFSyncConfig;
  private data: Map<TimeFrame, KlineBar[]> = new Map();

  constructor(config: MTFSyncConfig) {
    this.config = {
      alignmentMode: 'nearest',
      maxAlignmentMs: TF_DURATION_MS[config.primary] * 2,
      interpolateMissing: false,
      ...config,
    };
  }

  reset(): void {
    this.data.clear();
  }

  getConfig(): MTFSyncConfig {
    return { ...this.config };
  }

  /** Load bars for a timeframe */
  loadBars(tf: TimeFrame, bars: KlineBar[]): void {
    const sorted = [...bars].sort((a, b) => a.timestamp - b.timestamp);
    this.data.set(tf, sorted);
  }

  /** Get loaded bars for a timeframe */
  getBars(tf: TimeFrame): KlineBar[] {
    return this.data.get(tf) || [];
  }

  /** Count loaded bars per timeframe */
  getBarCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [tf, bars] of this.data.entries()) {
      counts[tf] = bars.length;
    }
    return counts;
  }

  // ═══════════ Alignment ═══════════

  /**
   * Align secondary timeframe bars to primary bars.
   * For each primary bar, find the corresponding secondary bar(s).
   */
  align(): MultiTimeframeData {
    const primaryBars = this.data.get(this.config.primary) || [];
    const result: AlignedBar[] = [];
    const secondaryData: Partial<Record<TimeFrame, KlineBar[]>> = {};

    // Collect all secondary timeframe data
    for (const secTf of this.config.secondary) {
      secondaryData[secTf] = this.data.get(secTf) || [];
    }

    // Find the overlapping time range
    const primaryStart = primaryBars.length > 0 ? primaryBars[0].timestamp : 0;
    const primaryEnd = primaryBars.length > 0 ? primaryBars[primaryBars.length - 1].timestamp : 0;

    // Align each primary bar
    for (const pBar of primaryBars) {
      for (const secTf of this.config.secondary) {
        const secBars = secondaryData[secTf] || [];
        if (secBars.length === 0) continue;

        const aligned = this.alignBar(pBar, secBars, secTf);
        if (aligned.target) {
          result.push(aligned);
        }
      }
    }

    // Calculate coverage
    const expectedPairs = primaryBars.length * this.config.secondary.length;
    const coverage = expectedPairs > 0 ? result.length / expectedPairs : 0;

    // Build secondary data slices aligned to primary range
    const filteredSecondary: Partial<Record<TimeFrame, KlineBar[]>> = {};
    for (const secTf of this.config.secondary) {
      const bars = this.data.get(secTf) || [];
      filteredSecondary[secTf] = bars.filter(
        (b) => b.timestamp >= primaryStart && b.timestamp <= primaryEnd + TF_DURATION_MS[secTf],
      );
    }

    return {
      primary: this.config.primary,
      timeframes: {
        [this.config.primary]: primaryBars,
        ...filteredSecondary,
      },
      aligned: result,
      coverage,
    };
  }

  private alignBar(
    primaryBar: KlineBar,
    secondaryBars: KlineBar[],
    secTf: TimeFrame,
  ): AlignedBar {
    const maxDrift = this.config.maxAlignmentMs || TF_DURATION_MS[this.config.primary] * 2;
    const secDuration = TF_DURATION_MS[secTf];

    let best: KlineBar | null = null;
    let bestOffset = Infinity;

    for (const sBar of secondaryBars) {
      const offset = Math.abs(sBar.timestamp - primaryBar.timestamp);

      switch (this.config.alignmentMode) {
        case 'nearest':
          if (offset < bestOffset && offset <= maxDrift) {
            best = sBar;
            bestOffset = offset;
          }
          break;

        case 'forward':
          // Secondary bar must be at or after primary
          if (sBar.timestamp >= primaryBar.timestamp && offset <= maxDrift) {
            if (offset < bestOffset) {
              best = sBar;
              bestOffset = offset;
            }
          }
          break;

        case 'backward':
          // Secondary bar must be at or before primary
          if (sBar.timestamp <= primaryBar.timestamp && offset <= maxDrift) {
            if (offset < bestOffset) {
              best = sBar;
              bestOffset = offset;
            }
          }
          break;
      }
    }

    const finalOffset = best
      ? best.timestamp - primaryBar.timestamp
      : 0;

    return {
      timestamp: primaryBar.timestamp,
      source: primaryBar,
      target: best,
      offset: finalOffset,
    };
  }

  // ═══════════ Timeframe Resampling ═══════════

  /**
   * Resample bars from a source timeframe to a target timeframe
   * E.g., convert 1m bars → 5m bars
   */
  resample(
    sourceBars: KlineBar[],
    sourceTf: TimeFrame,
    targetTf: TimeFrame,
  ): KlineBar[] {
    if (sourceBars.length === 0) return [];

    const sourceDur = TF_DURATION_MS[sourceTf];
    const targetDur = TF_DURATION_MS[targetTf];

    // Can only upsample if target is larger
    if (targetDur < sourceDur) {
      // Return as-is (can't create detail from less data)
      return [...sourceBars].sort((a, b) => a.timestamp - b.timestamp);
    }

    const sorted = [...sourceBars].sort((a, b) => a.timestamp - b.timestamp);
    const result: KlineBar[] = [];

    let bucketStart = Math.floor(sorted[0].timestamp / targetDur) * targetDur;
    let bucketEnd = bucketStart + targetDur;
    let o = sorted[0].open;
    let h = -Infinity;
    let l = Infinity;
    let c = 0;
    let v = 0;

    const flush = () => {
      if (v > 0) {
        result.push({
          timestamp: bucketStart,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: v,
        });
      }
      o = 0;
      h = -Infinity;
      l = Infinity;
      v = 0;
    };

    for (const bar of sorted) {
      if (bar.timestamp >= bucketEnd) {
        flush();
        bucketStart = Math.floor(bar.timestamp / targetDur) * targetDur;
        bucketEnd = bucketStart + targetDur;
        o = bar.open;
      }

      if (v === 0) o = bar.open;
      h = Math.max(h, bar.high);
      l = Math.min(l, bar.low);
      c = bar.close;
      v += bar.volume;
    }

    flush();
    return result;
  }

  // ═══════════ Multi-timeframe Indicator Value Lookup ═══════════

  /**
   * For a given primary timestamp, find the indicator value from a secondary timeframe.
   * Used for MTF indicator overlay (e.g., show Daily RSI on 1h chart).
   */
  getMTFValue(
    timestamp: number,
    primaryTf: TimeFrame,
    secondaryTf: TimeFrame,
    valueKey: keyof KlineBar = 'close',
  ): { value: number | null; alignedBar: KlineBar | null; offsetMs: number } {
    const primaryBar: KlineBar = {
      timestamp,
      open: 0, high: 0, low: 0, close: 0, volume: 0,
    };

    const secBars = this.data.get(secondaryTf) || [];
    if (secBars.length === 0) return { value: null, alignedBar: null, offsetMs: 0 };

    const aligned = this.alignBar(primaryBar, secBars, secondaryTf);
    if (!aligned.target) return { value: null, alignedBar: null, offsetMs: 0 };

    return {
      value: aligned.target[valueKey] as number,
      alignedBar: aligned.target,
      offsetMs: aligned.offset,
    };
  }

  /**
   * Get MTF values for all secondary timeframes at once
   */
  getMTFSnapshot(
    timestamp: number,
  ): Record<TimeFrame, { value: number | null; offsetMs: number }> {
    const snapshot: Record<string, { value: number | null; offsetMs: number }> = {};

    for (const secTf of this.config.secondary) {
      const { value, offsetMs } = this.getMTFValue(timestamp, this.config.primary, secTf);
      snapshot[secTf] = { value, offsetMs };
    }

    return snapshot;
  }

  // ═══════════ Trend Detection Across Timeframes ═══════════

  /**
   * Check if all timeframes agree on trend direction.
   * Returns: 'up' | 'down' | 'mixed' | 'insufficient_data'
   */
  detectMultiTimeframeTrend(
    lookbackBars: number = 5,
    minTimeframes: number = 2,
  ): 'up' | 'down' | 'mixed' | 'insufficient_data' {
    const allTfs = [this.config.primary, ...this.config.secondary];
    let upCount = 0;
    let downCount = 0;
    let counted = 0;

    for (const tf of allTfs) {
      const bars = this.data.get(tf) || [];
      if (bars.length < lookbackBars + 1) continue;

      const recent = bars.slice(-lookbackBars - 1);
      const firstClose = recent[0].close;
      const lastClose = recent[recent.length - 1].close;

      if (lastClose > firstClose) upCount++;
      else downCount++;

      counted++;
    }

    if (counted < minTimeframes) return 'insufficient_data';

    if (upCount === counted) return 'up';
    if (downCount === counted) return 'down';
    return 'mixed';
  }

  // ═══════════ Bar Interval Alignment ═══════════

  /**
   * Find the nearest bar for a given timestamp in any loaded timeframe
   */
  findNearestBar(
    timestamp: number,
    tf?: TimeFrame,
    maxDriftMs?: number,
  ): { bar: KlineBar | null; timeframe: TimeFrame; offsetMs: number } {
    const maxDrift = maxDriftMs || TF_DURATION_MS['D']; // default 1 day
    let bestBar: KlineBar | null = null;
    let bestTf: TimeFrame | null = null;
    let bestOffset = Infinity;

    const timeframes = tf ? [tf] : (this.config.secondary.includes(this.config.primary)
      ? this.config.secondary
      : [this.config.primary, ...this.config.secondary]);

    for (const t of timeframes) {
      const bars = this.data.get(t) || [];
      for (const bar of bars) {
        const offset = Math.abs(bar.timestamp - timestamp);
        if (offset < bestOffset && offset <= maxDrift) {
          bestBar = bar;
          bestTf = t;
          bestOffset = offset;
        }
      }
    }

    return {
      bar: bestBar,
      timeframe: bestTf || this.config.primary,
      offsetMs: bestOffset === Infinity ? 0 : bestOffset,
    };
  }

  // ═══════════ Coverage & Quality ═══════════

  /**
   * Calculate data coverage metrics for each loaded timeframe
   */
  getCoverageReport(): Record<TimeFrame, {
    barCount: number;
    startTime: number;
    endTime: number;
    durationMs: number;
    expectedBars: number;
    coveragePct: number;
  }> {
    const report: Record<string, any> = {};
    const allBars = [...this.data.values()].flat();
    if (allBars.length === 0) return report;

    const globalStart = Math.min(...allBars.map((b) => b.timestamp));
    const globalEnd = Math.max(...allBars.map((b) => b.timestamp));
    const totalRangeMs = globalEnd - globalStart;

    for (const [tf, bars] of this.data.entries()) {
      if (bars.length === 0) {
        report[tf] = {
          barCount: 0,
          startTime: 0,
          endTime: 0,
          durationMs: 0,
          expectedBars: 0,
          coveragePct: 0,
        };
        continue;
      }

      const tfDuration = TF_DURATION_MS[tf];
      const expectedBars = Math.ceil(totalRangeMs / tfDuration);
      const tfStart = bars[0].timestamp;
      const tfEnd = bars[bars.length - 1].timestamp;
      const actualRange = tfEnd - tfStart;
      const coveragePct = expectedBars > 0
        ? Math.min(100, Math.round((bars.length / expectedBars) * 100))
        : 0;

      report[tf] = {
        barCount: bars.length,
        startTime: tfStart,
        endTime: tfEnd,
        durationMs: actualRange,
        expectedBars,
        coveragePct,
      };
    }

    return report;
  }

  // ═══════════ Relative Strength ═══════════

  /**
   * Compare relative performance across timeframes.
   * Answer: "Is this stock strong on weekly but weak on daily?"
   */
  compareTimeframePerformance(periods: number = 20): Record<TimeFrame, {
    returnsPct: number;
    volatility: number;
    trendStrength: number;
  }> {
    const comparison: Record<string, any> = {};

    for (const [tf, bars] of this.data.entries()) {
      if (bars.length < periods) {
        comparison[tf] = { returnsPct: 0, volatility: 0, trendStrength: 0 };
        continue;
      }

      const slice = bars.slice(-periods);
      const returnsPct = ((slice[slice.length - 1].close - slice[0].close) / slice[0].close) * 100;

      // Calculate volatility (std dev of returns)
      const rets: number[] = [];
      for (let i = 1; i < slice.length; i++) {
        rets.push((slice[i].close - slice[i - 1].close) / slice[i - 1].close);
      }
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
      const volatility = Math.sqrt(variance) * 100;

      // Trend strength: ratio of consecutive same-direction moves
      let trendMoves = 0;
      for (let i = 2; i < slice.length; i++) {
        const dir1 = slice[i].close - slice[i - 1].close;
        const dir2 = slice[i - 1].close - slice[i - 2].close;
        if (dir1 * dir2 > 0) trendMoves++;
      }
      const trendStrength = slice.length > 2
        ? trendMoves / (slice.length - 2)
        : 0;

      comparison[tf] = {
        returnsPct: Math.round(returnsPct * 100) / 100,
        volatility: Math.round(volatility * 100) / 100,
        trendStrength: Math.round(trendStrength * 100) / 100,
      };
    }

    return comparison;
  }
}

// ═══════════ Singleton ═══════════

let mtfInstance: MultiTimeframeSyncEngine | null = null;

export function getMultiTimeframeSyncEngine(config?: MTFSyncConfig): MultiTimeframeSyncEngine {
  if (!mtfInstance) {
    mtfInstance = new MultiTimeframeSyncEngine(config || {
      primary: 'D',
      secondary: ['1h', '4h', 'W'],
    });
  }
  return mtfInstance;
}

export function resetMultiTimeframeSyncEngine(): void {
  if (mtfInstance) {
    mtfInstance.reset();
    mtfInstance = null;
  }
}
