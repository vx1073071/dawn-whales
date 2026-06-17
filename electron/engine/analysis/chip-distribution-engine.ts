// ── R267 JVS-5 筹码分布引擎 (ChipDistributionEngine) ──
// 对标: 同花顺筹码分布 + 东方财富筹码集中度
// 功能: 筹码价格分布 / 筹码集中度 / 获利比例 / 平均成本 / 筹码峰

export interface TickRecord {
  timestamp: number;
  price: number;
  volume: number;
  direction: 'buy' | 'sell';
}

export interface ChipBin {
  /** Price level (lower bound) */
  priceLow: number;
  /** Price level (upper bound) */
  priceHigh: number;
  /** Total volume in this bin */
  volume: number;
  /** As % of total volume */
  volumePct: number;
  /** Average cost in this bin */
  avgCost: number;
  /** Count of ticks in this bin */
  tickCount: number;
}

export interface ChipDistribution {
  symbol: string;
  /** Price bins from low to high */
  bins: ChipBin[];
  /** Current price */
  currentPrice: number;
  /** Average holding cost */
  avgCost: number;
  /** Weighted average holding cost (volume-weighted) */
  vwapCost: number;
  /** Profit ratio: % of chips currently in profit */
  profitRatio: number;
  /** Chip concentration score 0-100 */
  concentration: number;
  /** Chip concentration tier */
  concentrationTier: 'highly_concentrated' | 'concentrated' | 'moderate' | 'dispersed' | 'widely_dispersed';
  /** Support level = price bin with highest volume below current */
  supportLevel: number | null;
  /** Resistance level = price bin with highest volume above current */
  resistanceLevel: number | null;
  /** Support strength (0-100) */
  supportStrength: number;
  /** Resistance strength (0-100) */
  resistanceStrength: number;
  /** Peak count (how many distinct volume peaks) */
  peakCount: number;
  /** Peaks sorted by volume */
  peaks: { price: number; volume: number; volumePct: number }[];
  /** Whether there's a "chip gap" (price range with very low chips) */
  hasChipGap: boolean;
  /** Date of computation */
  computedAt: number;
}

export interface ConcentrationAnalysis {
  symbol: string;
  /** Top 10% holding cost range */
  top10CostRange: number;
  /** Bottom 10% holding cost range */
  bottom10CostRange: number;
  /** 80% chip concentration price range */
  chip80Range: number;
  /** Lorenz curve Gini coefficient */
  gini: number;
  /** Herfindahl index */
  herfindahl: number;
}

export interface ChipDistributionConfig {
  /** Number of price bins */
  binCount?: number;
  /** Price step for bins (if 0, auto from range/binCount) */
  priceStep?: number;
  /** Concentration threshold (top N% of chips) for "highly concentrated" */
  concentrationThreshold?: number;
  /** Peak threshold: bins with volume% above this = distinct peak */
  peakThreshold?: number;
}

export const DEFAULT_CHIP_CONFIG: Required<ChipDistributionConfig> = {
  binCount: 100,
  priceStep: 0,
  concentrationThreshold: 0.20,
  peakThreshold: 0.03,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class ChipDistributionEngine {
  private config: Required<ChipDistributionConfig>;
  private ticks: Map<string, TickRecord[]> = new Map();

  constructor(config?: ChipDistributionConfig) {
    this.config = { ...DEFAULT_CHIP_CONFIG, ...config };
  }

  reset(): void {
    this.ticks.clear();
  }

  getConfig(): Required<ChipDistributionConfig> {
    return { ...this.config };
  }

  updateConfig(patch: Partial<ChipDistributionConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  /**
   * Feed tick records for a symbol.
   */
  feedTicks(symbol: string, records: TickRecord[]): void {
    const key = symbol.toUpperCase();
    const existing = this.ticks.get(key) || [];
    existing.push(...records);
    this.ticks.set(key, existing);
  }

  getTickCount(symbol: string): number {
    return this.ticks.get(symbol.toUpperCase())?.length || 0;
  }

  // ═══════════ Chip Distribution ═══════════

  /**
   * Compute chip distribution from tick records.
   */
  computeDistribution(symbol: string): ChipDistribution {
    const upper = symbol.toUpperCase();
    const records = this.ticks.get(upper) || [];
    if (records.length === 0) {
      return {
        symbol: upper,
        bins: [], currentPrice: 0, avgCost: 0, vwapCost: 0,
        profitRatio: 0, concentration: 0, concentrationTier: 'widely_dispersed',
        supportLevel: null, resistanceLevel: null,
        supportStrength: 0, resistanceStrength: 0,
        peakCount: 0, peaks: [], hasChipGap: false,
        computedAt: Date.now(),
      };
    }

    const prices = records.map((t) => t.price);
    const volumes = records.map((t) => t.volume);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const currentPrice = prices[prices.length - 1];
    const step = this.config.priceStep > 0
      ? this.config.priceStep
      : (maxP - minP) / this.config.binCount || 0.01;

    // Build bins
    const binMap = new Map<number, ChipBin>();
    for (const rec of records) {
      const binIdx = Math.floor((rec.price - minP) / step);
      const low = minP + binIdx * step;
      const high = low + step;

      const existing = binMap.get(low);
      if (existing) {
        existing.volume += rec.volume;
        existing.avgCost = (existing.avgCost * existing.tickCount + rec.price * rec.volume) /
          (existing.tickCount + rec.volume || 1);
        existing.tickCount += rec.volume;
      } else {
        binMap.set(low, {
          priceLow: Math.round(low * 10000) / 10000,
          priceHigh: Math.round(high * 10000) / 10000,
          volume: rec.volume,
          volumePct: 0,
          avgCost: rec.price * rec.volume,
          tickCount: rec.volume,
        });
      }
    }

    // Compute percentages and finalize avgCost
    const totalVol = records.reduce((s, r) => s + r.volume, 0);
    const bins: ChipBin[] = [];
    for (const bin of binMap.values()) {
      bin.volumePct = totalVol > 0 ? Math.round((bin.volume / totalVol) * 10000) / 100 : 0;
      bin.avgCost = bin.tickCount > 0
        ? Math.round((bin.avgCost / bin.tickCount) * 10000) / 10000
        : (bin.priceLow + bin.priceHigh) / 2;
      bins.push(bin);
    }
    bins.sort((a, b) => a.priceLow - b.priceLow);

    // Average cost
    const avgCost = totalVol > 0
      ? Math.round((records.reduce((s, r) => s + r.price * r.volume, 0) / totalVol) * 100) / 100
      : 0;

    // VWAP cost
    const vwapCost = totalVol > 0
      ? avgCost // same as avg cost since all points are price-weighted
      : 0;

    // Profit ratio: % of volume in bins where price <= currentPrice
    let profitableVol = 0;
    for (const bin of bins) {
      if (bin.priceHigh <= currentPrice) {
        profitableVol += bin.volume;
      } else if (bin.priceLow <= currentPrice && bin.priceHigh > currentPrice) {
        // Partially in profit: linear interpolation
        const fraction = (currentPrice - bin.priceLow) / (bin.priceHigh - bin.priceLow || 1);
        profitableVol += bin.volume * fraction;
      }
    }
    const profitRatio = totalVol > 0 ? Math.round((profitableVol / totalVol) * 10000) / 100 : 0;

    // Peak detection
    const peaks = this.detectPeaks(bins);
    const peakCount = peaks.length;

    // Concentration: top 20% of volume bins as % of total range
    const concentration = this.calculateConcentration(bins);

    // Support = highest volume bin below current price
    let supportLevel: number | null = null;
    let supportStrength = 0;
    let resistanceLevel: number | null = null;
    let resistanceStrength = 0;

    const belowBins = bins.filter((b) => b.priceHigh <= currentPrice);
    const aboveBins = bins.filter((b) => b.priceLow >= currentPrice);

    if (belowBins.length > 0) {
      const best = belowBins.reduce((a, b) => b.volume > a.volume ? b : a);
      supportLevel = best.priceHigh;
      supportStrength = Math.min(100, Math.round(best.volumePct * 100));
    }
    if (aboveBins.length > 0) {
      const best = aboveBins.reduce((a, b) => b.volume > a.volume ? b : a);
      resistanceLevel = best.priceLow;
      resistanceStrength = Math.min(100, Math.round(best.volumePct * 100));
    }

    // Chip gap detection
    const hasChipGap = this.detectChipGap(bins);

    // Concentration tier
    let concentrationTier: ChipDistribution['concentrationTier'] = 'widely_dispersed';
    if (concentration >= 80) concentrationTier = 'highly_concentrated';
    else if (concentration >= 60) concentrationTier = 'concentrated';
    else if (concentration >= 40) concentrationTier = 'moderate';
    else if (concentration >= 20) concentrationTier = 'dispersed';

    return {
      symbol: upper,
      bins,
      currentPrice,
      avgCost,
      vwapCost,
      profitRatio,
      concentration,
      concentrationTier,
      supportLevel,
      resistanceLevel,
      supportStrength,
      resistanceStrength,
      peakCount,
      peaks,
      hasChipGap,
      computedAt: Date.now(),
    };
  }

  // ═══════════ Concentration Analysis ═══════════

  computeConcentrationAnalysis(symbol: string): ConcentrationAnalysis | null {
    const dist = this.computeDistribution(symbol);
    if (dist.bins.length === 0) return null;

    // 80% chip concentration range: price span that contains 80% of chips
    const sorted = [...dist.bins].sort((a, b) => b.volume - a.volume);
    let cumVol = 0;
    const totalVol = sorted.reduce((s, b) => s + b.volume, 0);
    let highPrice = 0, lowPrice = Infinity;

    for (const bin of sorted) {
      cumVol += bin.volume;
      if (bin.priceHigh > highPrice) highPrice = bin.priceHigh;
      if (bin.priceLow < lowPrice) lowPrice = bin.priceLow;
      if (cumVol / totalVol >= 0.80) break;
    }
    const chip80Range = highPrice > 0 && lowPrice < Infinity
      ? Math.round((highPrice - lowPrice) * 100) / 100
      : 0;

    // Top/bottom 10% cost range
    const costs = dist.bins.map((b) => b.avgCost).sort((a, b) => a - b);
    const top10Idx = Math.floor(costs.length * 0.9);
    const bottom10Idx = Math.ceil(costs.length * 0.1);
    const top10CostRange = costs.length > 1 ? costs[costs.length - 1] - costs[top10Idx] : 0;
    const bottom10CostRange = costs.length > 1 ? costs[bottom10Idx] - costs[0] : 0;

    // Gini coefficient (Lorenz curve)
    const gini = this.calculateGini(dist.bins);

    // Herfindahl index (sum of squared shares)
    const herfindahl = this.calculateHerfindahl(dist.bins);

    return {
      symbol: symbol.toUpperCase(),
      top10CostRange,
      bottom10CostRange,
      chip80Range,
      gini: Math.round(gini * 10000) / 10000,
      herfindahl: Math.round(herfindahl * 10000) / 10000,
    };
  }

  // ═══════════ Chip Movement (移仓) ═══════════

  /**
   * Compare two distributions to detect chip transfer between price levels.
   * Returns price bins with significant volume change.
   */
  detectChipTransfer(prev: ChipDistribution, current: ChipDistribution): {
    increasing: ChipBin[];
    decreasing: ChipBin[];
    migrationDirection: 'up' | 'down' | 'stable';
  } {
    const prevMap = new Map<number, ChipBin>();
    for (const b of prev.bins) prevMap.set(b.priceLow, b);

    const increasing: ChipBin[] = [];
    const decreasing: ChipBin[] = [];

    for (const currBin of current.bins) {
      const prevBin = prevMap.get(currBin.priceLow);
      if (!prevBin) continue;

      const diff = currBin.volume - prevBin.volume;
      const pct = prevBin.volume > 0 ? diff / prevBin.volume : 0;

      if (pct > 0.2) increasing.push({ ...currBin, volumePct: Math.round(pct * 10000) / 100 });
      else if (pct < -0.2) {
        decreasing.push({
          ...prevBin,
          volume: Math.abs(diff),
          volumePct: Math.round(Math.abs(pct) * 10000) / 100,
        });
      }
    }

    // Determine migration direction based on average price of increasing vs decreasing
    const incAvgPrice = increasing.reduce((s, b) => s + b.avgCost, 0) / (increasing.length || 1);
    const decAvgPrice = decreasing.reduce((s, b) => s + b.avgCost, 0) / (decreasing.length || 1);

    let migrationDirection: 'up' | 'down' | 'stable' = 'stable';
    if (increasing.length > 0 && decreasing.length > 0) {
      if (incAvgPrice > decAvgPrice) migrationDirection = 'up';
      else if (incAvgPrice < decAvgPrice) migrationDirection = 'down';
    }

    return { increasing, decreasing, migrationDirection };
  }

  // ═══════════ Helpers ═══════════

  private detectPeaks(bins: ChipBin[]): { price: number; volume: number; volumePct: number }[] {
    if (bins.length < 3) return [];

    const peaks: { price: number; volume: number; volumePct: number }[] = [];
    const threshold = this.config.peakThreshold;

    for (let i = 1; i < bins.length - 1; i++) {
      if (bins[i].volumePct > bins[i - 1].volumePct &&
          bins[i].volumePct > bins[i + 1].volumePct &&
          bins[i].volumePct >= threshold) {
        peaks.push({
          price: bins[i].avgCost,
          volume: bins[i].volume,
          volumePct: bins[i].volumePct,
        });
      }
    }
    peaks.sort((a, b) => b.volume - a.volume);
    return peaks;
  }

  private calculateConcentration(bins: ChipBin[]): number {
    if (bins.length === 0) return 0;
    const sorted = [...bins].sort((a, b) => b.volume - a.volume);
    const totalVol = sorted.reduce((s, b) => s + b.volume, 0);
    if (totalVol === 0) return 0;

    let cumVol = 0;
    let topBins = 0;
    const thresholdVol = totalVol * this.config.concentrationThreshold;

    for (const bin of sorted) {
      cumVol += bin.volume;
      topBins++;
      if (cumVol >= thresholdVol) break;
    }

    // Concentration = 100 - (top bins as % of total bins)
    return Math.min(100, Math.round(100 - (topBins / bins.length) * 100));
  }

  private detectChipGap(bins: ChipBin[]): boolean {
    // A chip gap exists when there are consecutive bins with very low volume
    // between two high-volume areas
    let consecutiveLow = 0;
    for (const bin of bins) {
      if (bin.volumePct < 0.1) {
        consecutiveLow++;
        if (consecutiveLow >= 3) return true;
      } else {
        consecutiveLow = 0;
      }
    }
    return false;
  }

  private calculateGini(bins: ChipBin[]): number {
    if (bins.length < 2) return 0;
    const sorted = [...bins].sort((a, b) => a.volume - b.volume);
    const n = sorted.length;
    const total = sorted.reduce((s, b) => s + b.volume, 0);
    if (total === 0) return 0;

    let sum = 0;
    let cum = 0;
    for (let i = 0; i < n; i++) {
      cum += sorted[i].volume;
      sum += (2 * (i + 1) - n - 1) * (sorted[i].volume / total);
    }
    return Math.abs(sum / n);
  }

  private calculateHerfindahl(bins: ChipBin[]): number {
    const total = bins.reduce((s, b) => s + (b.volumePct / 100), 0); // sum of shares
    if (total === 0) return 0;
    return bins.reduce((s, b) => s + (b.volumePct / 100) ** 2, 0) / (total ** 2) * 10000;
  }
}

// ═══════════ Singleton ═══════════

let cdInstance: ChipDistributionEngine | null = null;

export function getChipDistributionEngine(config?: ChipDistributionConfig): ChipDistributionEngine {
  if (!cdInstance) cdInstance = new ChipDistributionEngine(config);
  return cdInstance;
}

export function resetChipDistributionEngine(): void {
  cdInstance = null;
}
