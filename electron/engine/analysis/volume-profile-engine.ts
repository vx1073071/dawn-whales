// ── R266 JVS-1 Volume Profile Engine ──
// 产品级 Market Profile (TPO) + Volume Profile + 支撑阻力识别 + VPOC Gap
// 对标 TradingView Volume Profile / 富途筹码分布

/**
 * A single bar/candle used for profile computation.
 */
export interface VPInputBar {
  timestamp: number;  // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * A Volume-At-Price bin — how much volume traded at a given price level.
 */
export interface VolumeAtPrice {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
}

/**
 * Time-Price Opportunity (TPO) bin — how many periods did price "touch" a level.
 */
export interface TPOBin {
  price: number;
  tpoCount: number;     // number of periods touching this price
}

/**
 * Result of a full Volume Profile analysis for a session.
 */
export interface VolumeProfileResult {
  symbol: string;
  startTime: number;
  endTime: number;
  totalVolume: number;
  priceStep: number;
  /** Volume-At-Price sorted high → low */
  vap: VolumeAtPrice[];
  /** Time-Price Opportunity bins */
  tpo: TPOBin[];
  /** Point of Control (price with most volume) */
  poc: VolumeAtPrice | null;
  /** Next 2 highest volume nodes after POC */
  secondaryPOCs: VolumeAtPrice[];
  /** Value Area High (upper bound of 70% volume) */
  vah: number;
  /** Value Area Low (lower bound of 70% volume) */
  val: number;
  /** Value Area as % of total price range */
  valueAreaPct: number;
  /** Profile shape descriptor: P/D/b/Double/P-Tail */
  profileShape: ProfileShape;
  /** Detected support/resistance levels from VP */
  supportLevels: number[];
  resistanceLevels: number[];
  /** Naked POC — POC that hasn't been revisited */
  nakedPOC: VolumeAtPrice | null;
  /** VPOC gap — gap between current POC and previous session POC */
  vpocGap: number;
  /** Volume nodes (high-volume price clusters for S/R) */
  highVolumeNodes: VolumeAtPrice[];
  /** Low volume nodes (price gaps — fast movement zones) */
  lowVolumeNodes: VolumeAtPrice[];
  /** Composite profile if multi-session */
  compositeSessionCount: number;
}

export type ProfileShape =
  | 'P'       // Normal distribution (bell curve)
  | 'b'       // bimodal
  | 'D'       // P-shape skewed left (bullish — value at top)
  | 'P-Tail'  // P with long tail (imbalance)
  | 'Double'  // Double distribution
  | 'Flat';   // No clear concentration

export interface VolumeProfileConfig {
  priceStep?: number;            // bin granularity, default adaptive
  valueAreaPct?: number;        // default 0.70 (70%)
  tpoPeriodMinutes?: number;    // TPO period length, default 30
  compositeSessions?: number;   // multi-session composite, default 1
  highVolumeThreshold?: number; // std dev multiplier for "high" volume nodes
  lowVolumeThreshold?: number;  // fraction of mean for "low" volume nodes
  seasonality?: boolean;        // weight recent data higher
  seasonalityDecay?: number;    // decay factor (0-1)
}

export const DEFAULT_VP_CONFIG: Required<VolumeProfileConfig> = {
  priceStep: 0,           // 0 = auto
  valueAreaPct: 0.70,
  tpoPeriodMinutes: 30,
  compositeSessions: 1,
  highVolumeThreshold: 1.5,
  lowVolumeThreshold: 0.3,
  seasonality: false,
  seasonalityDecay: 0.9,
};

// ═══════════════════════════════════════════════════════════
// Volume Profile Engine
// ═══════════════════════════════════════════════════════════

export class VolumeProfileEngine {
  private config: Required<VolumeProfileConfig>;
  private bars: VPInputBar[] = [];
  /** Previous session POC for VPOC gap */
  private previousPOC: number | null = null;
  /** Historical POC levels for naked POC detection */
  private historicalPOCs: Map<number, number> = new Map(); // price → timestamp

  constructor(config?: VolumeProfileConfig) {
    this.config = { ...DEFAULT_VP_CONFIG, ...config };
  }

  reset(): void {
    this.bars = [];
    this.previousPOC = null;
    this.historicalPOCs.clear();
  }

  getConfig(): Required<VolumeProfileConfig> {
    return { ...this.config };
  }

  updateConfig(patch: Partial<VolumeProfileConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  /** Load bars for profile computation */
  loadBars(bars: VPInputBar[]): void {
    this.bars = [...bars].sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Set previous session's POC for VPOC gap calculation */
  setPreviousPOC(poc: number): void {
    this.previousPOC = poc;
  }

  /** Register historical POC levels for naked POC detection */
  registerHistoricalPOC(price: number, timestamp: number): void {
    this.historicalPOCs.set(price, timestamp);
  }

  /** Get loaded bar count */
  getBarCount(): number {
    return this.bars.length;
  }

  // ═══════════ Price Step (adaptive) ═══════════

  /**
   * Determine optimal price step based on price range and volume distribution.
   * Targets ~100-200 bins for good resolution without noise.
   */
  private determinePriceStep(bars: VPInputBar[]): number {
    if (this.config.priceStep > 0) return this.config.priceStep;
    if (bars.length === 0) return 0.01;

    const prices = bars.flatMap((b) => [b.high, b.low]);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP;

    // Target ~150 bins
    const raw = range / 150;

    // Round to nice increments
    if (raw >= 10) return Math.ceil(raw / 5) * 5;
    if (raw >= 1) return Math.ceil(raw);
    if (raw >= 0.1) return Math.ceil(raw * 10) / 10;
    if (raw >= 0.01) return Math.ceil(raw * 100) / 100;
    return 0.01;
  }

  // ═══════════ Volume Profile (VAP) ═══════════

  /**
   * Compute Volume-At-Price (VAP) from loaded bars.
   * Each bar's volume is distributed across its high-low range.
   */
  computeVAP(): VolumeAtPrice[] {
    if (this.bars.length === 0) return [];

    const step = this.determinePriceStep(this.bars);
    const vapMap = new Map<number, { vol: number; buyVol: number; sellVol: number; trades: number }>();
    const { seasonality, seasonalityDecay } = this.config;
    const totalBars = this.bars.length;

    for (let i = 0; i < this.bars.length; i++) {
      const bar = this.bars[i];
      const range = bar.high - bar.low;

      // Seasonality weight: recent bars weighted higher
      let barWeight = 1.0;
      if (seasonality) {
        barWeight = Math.pow(seasonalityDecay, totalBars - 1 - i);
      }

      // For zero-range bars (open=high=low=close), put all volume at that price
      if (range <= 0) {
        const key = bar.close;
        const existing = vapMap.get(key);
        if (existing) {
          existing.vol += bar.volume * barWeight;
          existing.buyVol += (bar.close >= bar.open ? bar.volume : 0) * barWeight;
          existing.sellVol += (bar.close < bar.open ? bar.volume : 0) * barWeight;
          existing.trades++;
        } else {
          vapMap.set(key, {
            vol: bar.volume * barWeight,
            buyVol: (bar.close >= bar.open ? bar.volume : 0) * barWeight,
            sellVol: (bar.close < bar.open ? bar.volume : 0) * barWeight,
            trades: 1,
          });
        }
      } else {
        // Distribute volume across the bar's range using step increments
        const levels = Math.max(1, Math.ceil(range / step));
        const volPerLevel = (bar.volume * barWeight) / levels;
        const isUpBar = bar.close >= bar.open;

        for (let level = 0; level < levels; level++) {
          const price = bar.low + level * step;
          const roundedPrice = Math.round(price / step) * step;
          const existing = vapMap.get(roundedPrice);

          if (existing) {
            existing.vol += volPerLevel;
            if (isUpBar) existing.buyVol += volPerLevel;
            else existing.sellVol += volPerLevel;
            existing.trades++;
          } else {
            vapMap.set(roundedPrice, {
              vol: volPerLevel,
              buyVol: isUpBar ? volPerLevel : 0,
              sellVol: isUpBar ? 0 : volPerLevel,
              trades: 1,
            });
          }
        }
      }
    }

    // Convert to sorted array (high → low)
    const vap: VolumeAtPrice[] = [];
    for (const [price, data] of vapMap.entries()) {
      vap.push({
        price: Math.round(price * 10000) / 10000,
        volume: Math.round(data.vol * 100) / 100,
        buyVolume: Math.round(data.buyVol * 100) / 100,
        sellVolume: Math.round(data.sellVol * 100) / 100,
        tradeCount: data.trades,
      });
    }
    vap.sort((a, b) => b.price - a.price);
    return vap;
  }

  // ═══════════ TPO (Time-Price Opportunity / Market Profile) ═══════════

  /**
   * Compute TPO bins — how many time periods "touched" each price level.
   */
  computeTPO(): TPOBin[] {
    if (this.bars.length === 0) return [];

    const step = this.determinePriceStep(this.bars);
    const periodMs = this.config.tpoPeriodMinutes * 60_000;
    const tpoMap = new Map<number, Set<number>>(); // price → set of period start timestamps

    for (const bar of this.bars) {
      const periodStart = Math.floor(bar.timestamp / periodMs) * periodMs;
      const levels = bar.high === bar.low ? 1 : Math.ceil((bar.high - bar.low) / step);

      for (let l = 0; l < levels; l++) {
        const price = bar.low + l * step;
        const roundedPrice = Math.round(price / step) * step;
        let periods = tpoMap.get(roundedPrice);
        if (!periods) {
          periods = new Set();
          tpoMap.set(roundedPrice, periods);
        }
        periods.add(periodStart);
      }
    }

    const tpo: TPOBin[] = [];
    for (const [price, periods] of tpoMap.entries()) {
      tpo.push({
        price: Math.round(price * 10000) / 10000,
        tpoCount: periods.size,
      });
    }
    tpo.sort((a, b) => b.price - a.price);
    return tpo;
  }

  // ═══════════ POC / Secondary POCs ═══════════

  getPOC(vap?: VolumeAtPrice[]): VolumeAtPrice | null {
    const data = vap || this.computeVAP();
    if (data.length === 0) return null;

    let poc = data[0];
    for (const v of data) {
      if (v.volume > poc.volume) poc = v;
    }
    return { ...poc };
  }

  getSecondaryPOCs(vap?: VolumeAtPrice[], count: number = 2): VolumeAtPrice[] {
    const data = vap || this.computeVAP();
    if (data.length === 0) return [];

    const sorted = [...data].sort((a, b) => b.volume - a.volume);
    // Skip the primary POC (index 0), take the next `count`
    return sorted.slice(1, count + 1).map((v) => ({ ...v }));
  }

  // ═══════════ Value Area ═══════════

  getValueArea(vap?: VolumeAtPrice[]): { vah: number; val: number; poc: VolumeAtPrice | null } {
    const data = vap || this.computeVAP();
    if (data.length === 0) return { vah: 0, val: 0, poc: null };

    const poc = this.getPOC(data);
    if (!poc) return { vah: 0, val: 0, poc: null };

    const totalVol = data.reduce((s, v) => s + v.volume, 0);
    const targetVol = totalVol * this.config.valueAreaPct;

    // Start from POC and expand
    const pocIdx = data.findIndex((v) => v.price === poc.price);
    if (pocIdx < 0) return { vah: poc.price, val: poc.price, poc };

    let cumVol = poc.volume;
    let upIdx = pocIdx - 1;       // moving up in price (index decreases, price increases)
    let downIdx = pocIdx + 1;     // moving down in price (index increases, price decreases)
    let vah = poc.price;
    let val = poc.price;

    while (cumVol < targetVol && (upIdx >= 0 || downIdx < data.length)) {
      const upVol = upIdx >= 0 ? data[upIdx].volume : 0;
      const downVol = downIdx < data.length ? data[downIdx].volume : 0;

      if (upVol >= downVol && upIdx >= 0) {
        cumVol += upVol;
        vah = data[upIdx].price;
        upIdx--;
      } else if (downIdx < data.length) {
        cumVol += downVol;
        val = data[downIdx].price;
        downIdx++;
      } else {
        break;
      }
    }

    return {
      vah: Math.round(vah * 100) / 100,
      val: Math.round(val * 100) / 100,
      poc,
    };
  }

  // ═══════════ Profile Shape Classification ═══════════

  determineProfileShape(vap?: VolumeAtPrice[]): ProfileShape {
    const data = vap || this.computeVAP();
    if (data.length < 5) return 'Flat';

    const volumes = data.map((v) => v.volume);
    const mean = volumes.reduce((s, v) => s + v, 0) / volumes.length;
    const variance = volumes.reduce((s, v) => s + (v - mean) ** 2, 0) / volumes.length;
    const stdDev = Math.sqrt(variance);

    // Find peaks (local maxima in volume)
    const peaks: number[] = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i].volume > data[i - 1].volume && data[i].volume > data[i + 1].volume) {
        if (data[i].volume > mean + stdDev) {
          peaks.push(i);
        }
      }
    }

    if (peaks.length === 0) return 'Flat';
    if (peaks.length === 1) {
      // Check if skewed
      const peakPrice = data[peaks[0]].price;
      const midPrice = (data[0].price + data[data.length - 1].price) / 2;
      if (peakPrice > midPrice * 1.05) return 'D';     // skewed bullish (value at top)
      if (peakPrice < midPrice * 0.95) return 'P';     // skewed bearish
      return 'P';
    }
    if (peaks.length === 2) {
      const gap = Math.abs(data[peaks[0]].price - data[peaks[1]].price);
      const totalRange = data[0].price - data[data.length - 1].price;
      if (gap > totalRange * 0.3) return 'b'; // bimodal with significant gap
      return 'Double';
    }
    return 'P-Tail'; // Multiple peaks
  }

  // ═══════════ Support / Resistance from Volume Profile ═══════════

  detectSupportResistance(vap?: VolumeAtPrice[]): {
    supportLevels: number[];
    resistanceLevels: number[];
    highVolumeNodes: VolumeAtPrice[];
    lowVolumeNodes: VolumeAtPrice[];
  } {
    const data = vap || this.computeVAP();
    if (data.length < 10) return { supportLevels: [], resistanceLevels: [], highVolumeNodes: [], lowVolumeNodes: [] };

    const volumes = data.map((v) => v.volume);
    const mean = volumes.reduce((s, v) => s + v, 0) / volumes.length;
    const variance = volumes.reduce((s, v) => s + (v - mean) ** 2, 0) / volumes.length;
    const stdDev = Math.sqrt(variance);
    const { highVolumeThreshold, lowVolumeThreshold } = this.config;

    const highVN: VolumeAtPrice[] = [];
    const lowVN: VolumeAtPrice[] = [];

    const currentPrice = this.bars.length > 0 ? this.bars[this.bars.length - 1].close : 0;

    for (const v of data) {
      if (v.volume > mean + highVolumeThreshold * stdDev) {
        highVN.push({ ...v });
      }
      if (v.volume < mean * lowVolumeThreshold) {
        lowVN.push({ ...v });
      }
    }

    // High volume nodes below current price → support
    // High volume nodes above current price → resistance
    const supportLevels = highVN
      .filter((v) => v.price < currentPrice)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map((v) => v.price);

    const resistanceLevels = highVN
      .filter((v) => v.price > currentPrice)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map((v) => v.price);

    return {
      supportLevels,
      resistanceLevels,
      highVolumeNodes: highVN.sort((a, b) => b.price - a.price),
      lowVolumeNodes: lowVN.sort((a, b) => b.price - a.price),
    };
  }

  // ═══════════ Naked POC / VPOC Gap ═══════════

  /**
   * Naked POC: a POC level that price hasn't revisited since it was formed.
   * Trading psychology: price tends to return to unfilled volume nodes.
   */
  getNakedPOC(vap?: VolumeAtPrice[]): VolumeAtPrice | null {
    const data = vap || this.computeVAP();
    const poc = this.getPOC(data);
    if (!poc) return null;

    const lastBar = this.bars.length > 0 ? this.bars[this.bars.length - 1] : null;
    if (!lastBar) return null;

    // Check if POC has been "touched" (price crossed through it) in recent bars
    const pocTouched = this.bars.some(
      (b) => b.low <= poc.price && b.high >= poc.price,
    );

    // Check historical POC registry
    const histTouch = this.historicalPOCs.has(poc.price);

    // Naked = not touched in current bars AND not in history
    if (!pocTouched && !histTouch) {
      return { ...poc };
    }

    return null;
  }

  /**
   * VPOC Gap: difference between current session POC and previous session POC.
   * Large gap = potential target/fill zone.
   */
  getVPOCGap(vap?: VolumeAtPrice[]): number {
    const data = vap || this.computeVAP();
    const poc = this.getPOC(data);
    if (!poc || this.previousPOC === null) return 0;

    return Math.round((poc.price - this.previousPOC) * 100) / 100;
  }

  // ═══════════ Composite (Multi-Session) Profile ═══════════

  /**
   * Build a composite profile from multiple sessions of data.
   * Useful for weekly/monthly profiles.
   */
  computeComposite(sessions: VPInputBar[][]): VolumeAtPrice[] {
    if (sessions.length === 0) return [];

    const step = this.determinePriceStep(sessions.flat());
    const composite = new Map<number, { vol: number; buyVol: number; sellVol: number; trades: number }>();

    for (const sessionBars of sessions) {
      // Temporarily swap bars, compute VAP, merge
      const savedBars = this.bars;
      this.bars = sessionBars;
      const sessionVAP = this.computeVAP();
      this.bars = savedBars;

      for (const v of sessionVAP) {
        const existing = composite.get(v.price);
        if (existing) {
          existing.vol += v.volume;
          existing.buyVol += v.buyVolume;
          existing.sellVol += v.sellVolume;
          existing.trades += v.tradeCount;
        } else {
          composite.set(v.price, {
            vol: v.volume,
            buyVol: v.buyVolume,
            sellVol: v.sellVolume,
            trades: v.tradeCount,
          });
        }
      }
    }

    const result: VolumeAtPrice[] = [];
    for (const [price, data] of composite.entries()) {
      result.push({
        price: Math.round(price * 10000) / 10000,
        volume: Math.round(data.vol * 100) / 100,
        buyVolume: Math.round(data.buyVol * 100) / 100,
        sellVolume: Math.round(data.sellVol * 100) / 100,
        tradeCount: data.trades,
      });
    }
    result.sort((a, b) => b.price - a.price);
    return result;
  }

  // ═══════════ Full Analysis (all-in-one) ═══════════

  /**
   * Run full volume profile analysis on loaded bars.
   */
  analyze(symbol: string = ''): VolumeProfileResult {
    const startTime = this.bars.length > 0 ? this.bars[0].timestamp : 0;
    const endTime = this.bars.length > 0 ? this.bars[this.bars.length - 1].timestamp : 0;

    const vap = this.computeVAP();
    const tpo = this.computeTPO();
    const poc = this.getPOC(vap);
    const secondaryPOCs = this.getSecondaryPOCs(vap);
    const { vah, val } = this.getValueArea(vap);
    const profileShape = this.determineProfileShape(vap);
    const { supportLevels, resistanceLevels, highVolumeNodes, lowVolumeNodes } = this.detectSupportResistance(vap);
    const nakedPOC = this.getNakedPOC(vap);
    const vpocGap = this.getVPOCGap(vap);

    const totalVolume = vap.reduce((s, v) => s + v.volume, 0);
    const prices = vap.map((v) => v.price);
    const totalRange = prices.length > 1 ? prices[0] - prices[prices.length - 1] : 0;
    const valueAreaPct = totalRange > 0 ? ((vah - val) / totalRange) * 100 : 0;

    return {
      symbol,
      startTime,
      endTime,
      totalVolume: Math.round(totalVolume * 100) / 100,
      priceStep: this.determinePriceStep(this.bars),
      vap,
      tpo,
      poc,
      secondaryPOCs,
      vah,
      val,
      valueAreaPct: Math.round(valueAreaPct * 100) / 100,
      profileShape,
      supportLevels,
      resistanceLevels,
      nakedPOC,
      vpocGap,
      highVolumeNodes,
      lowVolumeNodes,
      compositeSessionCount: 1,
    };
  }

  // ═══════════ Relative Value Analysis ═══════════

  /**
   * Check if price is inside, above, or below the value area.
   * Returns "above_value"/"in_value"/"below_value" and distance %.
   */
  priceVsValueArea(price: number): { position: 'above_value' | 'in_value' | 'below_value'; distancePct: number } {
    const { vah, val } = this.getValueArea();
    if (vah === 0 && val === 0) return { position: 'in_value', distancePct: 0 };

    const midpoint = (vah + val) / 2;
    const halfRange = (vah - val) / 2 || 1;

    if (price > vah) {
      const distance = ((price - vah) / halfRange) * 100;
      return { position: 'above_value', distancePct: Math.round(distance * 100) / 100 };
    } else if (price < val) {
      const distance = ((val - price) / halfRange) * 100;
      return { position: 'below_value', distancePct: Math.round(distance * 100) / 100 };
    }
    return { position: 'in_value', distancePct: 0 };
  }

  /**
   * Volume-weighted average price (VWAP) from loaded bars
   */
  computeVWAP(): number {
    let num = 0;
    let den = 0;
    for (const bar of this.bars) {
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      num += typicalPrice * bar.volume;
      den += bar.volume;
    }
    return den > 0 ? Math.round((num / den) * 10000) / 10000 : 0;
  }
}

// ═══════════ Singleton ═══════════

let vpInstance: VolumeProfileEngine | null = null;

export function getVolumeProfileEngine(config?: VolumeProfileConfig): VolumeProfileEngine {
  if (!vpInstance) {
    vpInstance = new VolumeProfileEngine(config);
  } else if (config) {
    vpInstance.updateConfig(config);
  }
  return vpInstance;
}

export function resetVolumeProfileEngine(): void {
  if (vpInstance) {
    vpInstance.reset();
    vpInstance = null;
  }
}
