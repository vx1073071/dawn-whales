// ── R269 JVS-3 OrderFlow8引擎 (OrderFlow8Engine) ──
// 8个订单流专业指标: Footprint/DOM/CVD/MarketProfile/Delta/
// DepthOfMarket/OI分析/VolumeCluster

import type { OHLCVData } from './trend-14-engine';

export interface TickData {
  timestamp: number; price: number; volume: number;
  side: 'bid' | 'ask' | 'unknown';
  bidPrice?: number; askPrice?: number;
}

export interface OrderBookLevel {
  price: number; bidVolume: number; askVolume: number; bidCount?: number; askCount?: number;
}

export interface OrderBookSnapshot {
  timestamp: number; levels: OrderBookLevel[];
}

export interface OIData {
  timestamp: number; openInterest: number; oiChange: number; price: number;
}

export interface FootprintBin {
  price: number; bidVolume: number; askVolume: number; totalVolume: number;
  delta: number; cumDelta: number; trades: number; imbalance: number;
}

export interface OrderFlow8EngineConfig {
  footprintTicksPerRow?: number; footprintLevels?: number;
  domLevels?: number;
  cvdPeriod?: number;
  mpPeriod?: number; mpValueArea?: number;
  deltaPeriod?: number;
  domDepthLevels?: number; domImbalanceThreshold?: number;
  oiPeriod?: number; oiSignalThreshold?: number;
  volClusterPeriod?: number; volClusterThreshold?: number;
}

export const DEFAULT_OF8_CONFIG: Required<OrderFlow8EngineConfig> = {
  footprintTicksPerRow: 50, footprintLevels: 20,
  domLevels: 10,
  cvdPeriod: 100,
  mpPeriod: 30, mpValueArea: 0.7,
  deltaPeriod: 50,
  domDepthLevels: 20, domImbalanceThreshold: 2.0,
  oiPeriod: 20, oiSignalThreshold: 0.05,
  volClusterPeriod: 100, volClusterThreshold: 2.0,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class OrderFlow8Engine {
  private config: Required<OrderFlow8EngineConfig>;
  private tickData: Map<string, TickData[]> = new Map();
  private obData: Map<string, OrderBookSnapshot[]> = new Map();
  private oiData: Map<string, OIData[]> = new Map();
  private bars: Map<string, OHLCVData[]> = new Map();

  constructor(config?: OrderFlow8EngineConfig) {
    this.config = { ...DEFAULT_OF8_CONFIG, ...config };
  }

  reset(): void { this.tickData.clear(); this.obData.clear(); this.oiData.clear(); this.bars.clear(); }
  updateConfig(patch: Partial<OrderFlow8EngineConfig>): void { this.config = { ...this.config, ...patch }; }
  getConfig(): Required<OrderFlow8EngineConfig> { return { ...this.config }; }

  loadTicks(symbol: string, ticks: TickData[]): void { this.tickData.set(symbol.toUpperCase(), ticks); }
  loadOB(symbol: string, ob: OrderBookSnapshot[]): void { this.obData.set(symbol.toUpperCase(), ob); }
  loadOI(symbol: string, oi: OIData[]): void { this.oiData.set(symbol.toUpperCase(), oi); }
  loadBars(symbol: string, bars: OHLCVData[]): void { this.bars.set(symbol.toUpperCase(), bars); }

  getTicks(symbol: string): TickData[] { return this.tickData.get(symbol.toUpperCase()) || []; }
  getOB(symbol: string): OrderBookSnapshot[] { return this.obData.get(symbol.toUpperCase()) || []; }
  getOI(symbol: string): OIData[] { return this.oiData.get(symbol.toUpperCase()) || []; }
  getBars(symbol: string): OHLCVData[] { return this.bars.get(symbol.toUpperCase()) || []; }

  // ═══════════ 1. Footprint Chart ═══════════

  computeFootprint(symbol: string, ticksPerRow?: number, levels?: number): FootprintBin[] {
    const ticks = this.getTicks(symbol);
    const tpr = ticksPerRow || this.config.footprintTicksPerRow;
    const lv = levels || this.config.footprintLevels;
    if (ticks.length < tpr) return [];

    const bins: FootprintBin[] = [];
    for (let start = 0; start < ticks.length; start += tpr) {
      const slice = ticks.slice(start, Math.min(start + tpr, ticks.length));
      if (slice.length < 2) continue;

      // Determine price range for this tick block
      const prices = slice.map((t) => t.price);
      const minP = Math.min(...prices), maxP = Math.max(...prices);
      const binSize = (maxP - minP) / lv || 1;

      for (let b = 0; b < lv; b++) {
        const binPrice = minP + binSize * (b + 0.5);
        let bidVol = 0, askVol = 0, trades = 0;
        for (const t of slice) {
          if (t.price >= minP + binSize * b && t.price < minP + binSize * (b + 1)) {
            trades++;
            if (t.side === 'bid') bidVol += t.volume;
            else if (t.side === 'ask') askVol += t.volume;
            else { bidVol += t.volume * 0.5; askVol += t.volume * 0.5; }
          }
        }
        const delta = bidVol - askVol;
        const total = bidVol + askVol;
        const imbalance = total > 0 ? delta / total : 0;
        bins.push({ price: binPrice, bidVolume: bidVol, askVolume: askVol, totalVolume: total, delta, cumDelta: 0, trades, imbalance });
      }
    }

    // Cumulative delta
    let cum = 0;
    for (const bin of bins) { cum += bin.delta; bin.cumDelta = cum; }

    return bins;
  }

  // ═══════════ 2. Depth of Market (DOM) Analysis ═══════════

  computeDOM(symbol: string, levels?: number): {
    bids: { price: number; volume: number; count?: number }[];
    asks: { price: number; volume: number; count?: number }[];
    spread: number; spreadPct: number; midPrice: number;
    imbalance: number; wallDetected: boolean;
    supportWall?: { price: number; volume: number };
    resistanceWall?: { price: number; volume: number };
  } {
    const ob = this.getOB(symbol);
    const lv = levels || this.config.domLevels;
    if (ob.length === 0) return { bids: [], asks: [], spread: 0, spreadPct: 0, midPrice: 0, imbalance: 0, wallDetected: false };

    const last = ob[ob.length - 1];
    const topLevels = last.levels.slice(0, lv);

    const bids = topLevels.map((l) => ({ price: l.price, volume: l.bidVolume, count: l.bidCount }));
    const asks = topLevels.map((l) => ({ price: l.price, volume: l.askVolume, count: l.askCount }));
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;
    const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0;

    const totalBid = bids.reduce((s, b) => s + b.volume, 0);
    const totalAsk = asks.reduce((s, a) => s + a.volume, 0);
    const imbalance = totalBid + totalAsk > 0 ? (totalBid - totalAsk) / (totalBid + totalAsk) : 0;

    // Wall detection: any single level with volume > 2x the average
    const avgBidVol = totalBid / Math.max(bids.length, 1);
    const avgAskVol = totalAsk / Math.max(asks.length, 1);
    const supportWall = bids.find((b) => b.volume > avgBidVol * 3);
    const resistanceWall = asks.find((a) => a.volume > avgAskVol * 3);
    const wallDetected = !!(supportWall || resistanceWall);

    return { bids, asks, spread, spreadPct, midPrice, imbalance, wallDetected, supportWall: supportWall ? { price: supportWall.price, volume: supportWall.volume } : undefined, resistanceWall: resistanceWall ? { price: resistanceWall.price, volume: resistanceWall.volume } : undefined };
  }

  // ═══════════ 3. Cumulative Volume Delta (CVD) ═══════════

  computeCVD(symbol: string, period?: number): {
    cvd: number[]; cvdMa: number[]; divergence: ('bullish' | 'bearish' | 'none')[];
    currentValue: number; trend: 'up' | 'down' | 'flat';
  } {
    const ticks = this.getTicks(symbol);
    const bars = this.getBars(symbol);
    if (ticks.length === 0) {
      if (bars.length === 0) return { cvd: [], cvdMa: [], divergence: [], currentValue: 0, trend: 'flat' };
      // Fallback: use OHLC bars with volume sign from close vs open
      const cvd = this._cvdFromBars(bars);
      const p = period || this.config.cvdPeriod;
      const cvdMa = this._sma(cvd, p);
      const divergence = cvd.map((v, i) => {
        if (i < p) return 'none';
        return v > cvdMa[i] ? 'bullish' : v < cvdMa[i] ? 'bearish' : 'none';
      });
      return { cvd, cvdMa, divergence, currentValue: cvd[cvd.length - 1] || 0, trend: this._trendDirection(cvd.slice(-5)) };
    }

    const p = period || this.config.cvdPeriod;
    const cvd: number[] = [];
    // Group ticks by time bins
    const tBin = 60000; // 1-minute bins
    const tickGroups = new Map<number, TickData[]>();
    const t0 = ticks[0].timestamp;
    for (const t of ticks) {
      const key = Math.floor((t.timestamp - t0) / tBin);
      if (!tickGroups.has(key)) tickGroups.set(key, []);
      tickGroups.get(key)!.push(t);
    }

    const ordered = [...tickGroups.keys()].sort((a, b) => a - b);
    let cum = 0;
    for (const key of ordered) {
      const group = tickGroups.get(key)!;
      let bidVol = 0, askVol = 0;
      for (const t of group) {
        if (t.side === 'bid') bidVol += t.volume;
        else if (t.side === 'ask') askVol += t.volume;
        else { bidVol += t.volume * 0.5; askVol += t.volume * 0.5; }
      }
      cum += bidVol - askVol;
      cvd.push(cum);
    }

    const cvdMa = this._sma(cvd, p);
    const divergence = cvd.map((v, i) => {
      if (i < p) return 'none' as const;
      return v > cvdMa[i] ? 'bullish' : v < cvdMa[i] ? 'bearish' : 'none';
    });

    return { cvd, cvdMa, divergence, currentValue: cvd[cvd.length - 1] || 0, trend: this._trendDirection(cvd.slice(-5)) };
  }

  // ═══════════ 4. Market Profile (TPO) ═══════════

  computeMarketProfile(symbol: string, period?: number, valueArea?: number): {
    profile: { price: number; tpo: number; volume: number }[];
    poc: number; secondaryPoc?: number;
    vah: number; val: number;
    valueAreaRange: number;
    shape: 'P' | 'b' | 'D' | 'P-Tail' | 'Double' | 'Flat';
    initialBalance?: { high: number; low: number };
  } {
    const ticks = this.getTicks(symbol);
    const bars = this.getBars(symbol);
    const p = period || this.config.mpPeriod;
    const va = valueArea ?? this.config.mpValueArea;

    if (ticks.length > 0) {
      const slice = ticks.slice(-Math.min(ticks.length, p * this.config.footprintTicksPerRow));
      const priceMap = new Map<number, { tpo: number; volume: number }>();
      for (const t of slice) {
        const rounded = parseFloat(t.price.toFixed(2));
        const existing = priceMap.get(rounded) || { tpo: 0, volume: 0 };
        existing.tpo++;
        existing.volume += t.volume;
        priceMap.set(rounded, existing);
      }
      const profile = [...priceMap.entries()].map(([price, data]) => ({ price, ...data }));
      profile.sort((a, b) => a.price - b.price);
      return this._analyzeProfile(profile, va);
    }

    if (bars.length > 0) {
      const slice = bars.slice(-Math.min(bars.length, p));
      const priceMap = new Map<number, { tpo: number; volume: number }>();
      for (const bar of slice) {
        for (let pr = bar.low; pr <= bar.high; pr = parseFloat((pr + 0.01).toFixed(2))) {
          const rounded = parseFloat(pr.toFixed(2));
          const existing = priceMap.get(rounded) || { tpo: 0, volume: 0 };
          existing.tpo++;
          existing.volume += (bar.volume || 0) / Math.max(1, (bar.high - bar.low) / 0.01);
          priceMap.set(rounded, existing);
        }
      }
      const profile = [...priceMap.entries()].map(([price, data]) => ({ price, ...data }));
      profile.sort((a, b) => a.price - b.price);
      return this._analyzeProfile(profile, va);
    }

    return { profile: [], poc: 0, vah: 0, val: 0, valueAreaRange: 0, shape: 'Flat' };
  }

  private _analyzeProfile(profile: { price: number; tpo: number; volume: number }[], va: number): {
    profile: typeof profile; poc: number; secondaryPoc?: number; vah: number; val: number; valueAreaRange: number; shape: 'P' | 'b' | 'D' | 'P-Tail' | 'Double' | 'Flat';
  } {
    if (profile.length === 0) return { profile, poc: 0, vah: 0, val: 0, valueAreaRange: 0, shape: 'Flat' };

    // POC
    const sortedByVol = [...profile].sort((a, b) => b.tpo - a.tpo);
    const poc = sortedByVol[0].price;
    const secondaryPoc = sortedByVol.length > 1 && sortedByVol[1].tpo > sortedByVol[0].tpo * 0.6 ? sortedByVol[1].price : undefined;

    // Value Area (70% of total TPO)
    const totalTPO = profile.reduce((s, p) => s + p.tpo, 0);
    const sortedByPrice = [...profile].sort((a, b) => a.price - b.price);
    let cumTPO = 0; let val = sortedByPrice[0].price, vah = sortedByPrice[sortedByPrice.length - 1].price;
    // Find POC index, expand outward until reaching VA%
    const pocIdx = sortedByPrice.findIndex((p) => p.price === poc);
    if (pocIdx < 0) return { profile, poc, secondaryPoc, vah, val, valueAreaRange: vah - val, shape: 'Flat' };

    let lo = pocIdx, hi = pocIdx;
    cumTPO = sortedByPrice[pocIdx].tpo;
    while (cumTPO < totalTPO * va && (lo > 0 || hi < sortedByPrice.length - 1)) {
      if (lo > 0 && hi < sortedByPrice.length - 1) {
        if (sortedByPrice[lo - 1].tpo >= sortedByPrice[hi + 1].tpo) {
          lo--; cumTPO += sortedByPrice[lo].tpo;
        } else {
          hi++; cumTPO += sortedByPrice[hi].tpo;
        }
      } else if (lo > 0) { lo--; cumTPO += sortedByPrice[lo].tpo; }
      else if (hi < sortedByPrice.length - 1) { hi++; cumTPO += sortedByPrice[hi].tpo; }
      else break;
    }
    val = sortedByPrice[lo].price;
    vah = sortedByPrice[hi].price;

    // Shape detection
    const profileVol = sortedByPrice.map((p) => p.tpo);
    const shape = this._detectProfileShape(profileVol, sortedByPrice.map((p) => p.price));

    return { profile, poc, secondaryPoc, vah, val, valueAreaRange: vah - val, shape };
  }

  // ═══════════ 5. Delta Analysis ═══════════

  computeDelta(symbol: string, period?: number): {
    deltas: number[]; cumDelta: number[];
    deltaDivergence: ('bullish' | 'bearish' | 'none')[];
    strengthScore: number; // 0-100
    exhaustion: boolean;
  } {
    const ticks = this.getTicks(symbol);
    const p = period || this.config.deltaPeriod;
    if (ticks.length === 0) {
      const bars = this.getBars(symbol);
      if (bars.length === 0) return { deltas: [], cumDelta: [], deltaDivergence: [], strengthScore: 0, exhaustion: false };
      const deltas = bars.map((b) => (b.close >= b.open ? (b.volume || 0) : -(b.volume || 0)));
      const cum: number[] = []; let c = 0;
      for (const d of deltas) { c += d; cum.push(c); }
      const divergence = deltas.map((_d, i) => this._deltaDivergence(deltas.slice(Math.max(0, i - p + 1), i + 1), cum));
      const score = Math.min(100, Math.abs(cum[cum.length - 1] || 0) / 10000 * 100);
      return { deltas, cumDelta: cum, deltaDivergence: divergence, strengthScore: score, exhaustion: Math.abs(deltas[deltas.length - 1] || 0) > score * 200 };
    }

    // Group by time
    const tBin = 60000, deltas: number[] = [];
    const t0 = ticks[0].timestamp;
    const groups = new Map<number, TickData[]>();
    for (const t of ticks) {
      const k = Math.floor((t.timestamp - t0) / tBin);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(t);
    }

    for (const k of [...groups.keys()].sort((a, b) => a - b)) {
      const g = groups.get(k)!;
      let bid = 0, ask = 0;
      for (const t of g) {
        if (t.side === 'bid') bid += t.volume;
        else if (t.side === 'ask') ask += t.volume;
        else { bid += t.volume * 0.5; ask += t.volume * 0.5; }
      }
      deltas.push(bid - ask);
    }

    const cumDelta: number[] = []; let c = 0;
    for (const d of deltas) { c += d; cumDelta.push(c); }

    const divergence = deltas.map((_d, i) => this._deltaDivergence(deltas.slice(Math.max(0, i - p + 1), i + 1), cumDelta));
    const avgDelta = deltas.slice(-p).reduce((s, d) => s + Math.abs(d), 0) / p;
    const strengthScore = Math.min(100, (Math.abs(cumDelta[cumDelta.length - 1] || 0) / 10000) * 100);
    const exhaustion = Math.abs(deltas[deltas.length - 1] || 0) > avgDelta * 2.5;

    return { deltas, cumDelta, deltaDivergence: divergence, strengthScore, exhaustion };
  }

  // ═══════════ 6. Depth of Market Depth / Imbalance ═══════════

  computeDOMDepth(symbol: string, levels?: number, imbalanceThreshold?: number): {
    bidWall: { price: number; totalVol: number }[];
    askWall: { price: number; totalVol: number }[];
    bidVolumeProfile: number[]; // cumulative bid volume per level
    askVolumeProfile: number[];
    currentImbalance: number;
    imbalanceHistory: number[];
    absorptionDetected: boolean;
    icebergDetected: boolean;
  } {
    const ob = this.getOB(symbol);
    const lv = levels || this.config.domDepthLevels;
    const thresh = imbalanceThreshold ?? this.config.domImbalanceThreshold;
    if (ob.length === 0) return { bidWall: [], askWall: [], bidVolumeProfile: [], askVolumeProfile: [], currentImbalance: 0, imbalanceHistory: [], absorptionDetected: false, icebergDetected: false };

    const last = ob[ob.length - 1];
    const allLv = last.levels.slice(0, lv);

    const bidWall = allLv.map((l) => ({ price: l.price, totalVol: l.bidVolume }));
    const askWall = allLv.map((l) => ({ price: l.price, totalVol: l.askVolume }));
    const bidVP = bidWall.map((w) => w.totalVol);
    const askVP = askWall.map((w) => w.totalVol);

    const totalBid = bidVP.reduce((s, v) => s + v, 0);
    const totalAsk = askVP.reduce((s, v) => s + v, 0);
    const currentImbalance = totalBid + totalAsk > 0 ? (totalBid - totalAsk) / (totalBid + totalAsk) : 0;

    // Imbalance history
    const imbalanceHistory: number[] = [];
    for (const snap of ob.slice(-50)) {
      const bv = snap.levels.slice(0, lv).reduce((s, l) => s + l.bidVolume, 0);
      const av = snap.levels.slice(0, lv).reduce((s, l) => s + l.askVolume, 0);
      imbalanceHistory.push(bv + av > 0 ? (bv - av) / (bv + av) : 0);
    }

    // Absorption: order book stays imbalanced but price doesn't move
    const absorptionDetected = Math.abs(currentImbalance) > 0.6 && imbalanceHistory.length > 5 && imbalanceHistory.slice(-5).every((v) => Math.abs(v) > 0.5);

    // Iceberg: large volume at a single level vs thin above
    const maxBid = Math.max(...bidVP, 0);
    const maxAsk = Math.max(...askVP, 0);
    const icebergDetected = maxBid > thresh * (totalBid / lv) || maxAsk > thresh * (totalAsk / lv);

    return { bidWall, askWall, bidVolumeProfile: bidVP, askVolumeProfile: askVP, currentImbalance, imbalanceHistory, absorptionDetected, icebergDetected };
  }

  // ═══════════ 7. Open Interest Analysis ═══════════

  computeOIAnalysis(symbol: string, period?: number, signalThreshold?: number): {
    oiValues: number[]; oiChanges: number[]; oiMomentum: number[];
    priceVsOI: ('bullish' | 'bearish' | 'none')[];
    signal: 'long_build' | 'long_unwind' | 'short_build' | 'short_unwind' | 'neutral';
    signalStrength: number;
  } {
    const oi = this.getOI(symbol);
    const p = period || this.config.oiPeriod;
    const thresh = signalThreshold ?? this.config.oiSignalThreshold;
    if (oi.length < p) return { oiValues: [], oiChanges: [], oiMomentum: [], priceVsOI: [], signal: 'neutral', signalStrength: 0 };

    const oiValues = oi.map((d) => d.openInterest);
    const oiChanges = oi.map((d) => d.oiChange);
    const oiMomentum = this._sma(oiChanges, p);
    const prices = oi.map((d) => d.price);

    const priceVsOI: ('bullish' | 'bearish' | 'none')[] = [];
    for (let i = 0; i < oi.length; i++) {
      if (i < p) { priceVsOI.push('none'); continue; }
      const priceUp = prices[i] > prices[i - p];
      const oiUp = oiValues[i] > oiValues[i - p];
      if (priceUp && oiUp) priceVsOI.push('bullish'); // price up + OI up = bullish
      else if (!priceUp && oiUp) priceVsOI.push('bearish'); // price down + OI up = bearish
      else priceVsOI.push('none');
    }

    // Signal
    const lastPrice = prices[prices.length - 1];
    const lastOI = oiValues[oiValues.length - 1];
    const prevPrice = prices[prices.length - p - 1] || prices[0];
    const prevOI = oiValues[oiValues.length - p - 1] || oiValues[0];
    const priceDelta = prevPrice > 0 ? (lastPrice - prevPrice) / prevPrice : 0;
    const oiDelta = prevOI > 0 ? (lastOI - prevOI) / prevOI : 0;

    let signal: 'long_build' | 'long_unwind' | 'short_build' | 'short_unwind' | 'neutral' = 'neutral';
    if (priceDelta > thresh && oiDelta > thresh) signal = 'long_build';
    else if (priceDelta > thresh && oiDelta < -thresh) signal = 'short_unwind';
    else if (priceDelta < -thresh && oiDelta > thresh) signal = 'short_build';
    else if (priceDelta < -thresh && oiDelta < -thresh) signal = 'long_unwind';

    const signalStrength = Math.min(100, (Math.abs(priceDelta) + Math.abs(oiDelta)) * 500);

    return { oiValues, oiChanges, oiMomentum, priceVsOI, signal, signalStrength };
  }

  // ═══════════ 8. Volume Cluster ═══════════

  /**
   * High volume node detection across price levels.
   * Identifies concentration of volume → support/resistance.
   */
  computeVolumeCluster(symbol: string, period?: number, threshold?: number): {
    clusters: { price: number; volume: number; intensity: number }[];
    highVolumeNodes: { price: number; volume: number }[];
    lowVolumeNodes: { price: number; volume: number }[];
    mostSignificant!: { price: number; volume: number };
  } {
    const bars = this.getBars(symbol);
    const p = period || this.config.volClusterPeriod;
    const thresh = threshold ?? this.config.volClusterThreshold;
    if (bars.length < p) return { clusters: [], highVolumeNodes: [], lowVolumeNodes: [], mostSignificant: { price: 0, volume: 0 } };

    const slice = bars.slice(-p);
    const minP = Math.min(...slice.map((b) => b.low));
    const maxP = Math.max(...slice.map((b) => b.high));
    const bins = Math.min(50, slice.length);
    const binSize = (maxP - minP) / bins;

    const volPerBin: { price: number; volume: number }[] = [];
    for (let b = 0; b < bins; b++) {
      let vol = 0;
      const binLo = minP + binSize * b, binHi = minP + binSize * (b + 1);
      for (const bar of slice) {
        const overlap = Math.min(bar.high, binHi) - Math.max(bar.low, binLo);
        if (overlap > 0 && (bar.high - bar.low) > 0) vol += (bar.volume || 0) * overlap / (bar.high - bar.low);
      }
      volPerBin.push({ price: minP + binSize * (b + 0.5), volume: vol });
    }

    const avgVol = volPerBin.reduce((s, v) => s + v.volume, 0) / Math.max(bins, 1);
    const clusters = volPerBin.map((v) => ({ price: v.price, volume: v.volume, intensity: avgVol > 0 ? v.volume / avgVol : 1 }));
    clusters.sort((a, b) => b.volume - a.volume);

    const highVolumeNodes = volPerBin.filter((v) => v.volume > avgVol * thresh).sort((a, b) => b.volume - a.volume);
    const lowVolumeNodes = volPerBin.filter((v) => v.volume < avgVol * 0.3).sort((a, b) => a.volume - b.volume);
    const mostSignificant = clusters[0] || { price: 0, volume: 0 };

    return { clusters, highVolumeNodes, lowVolumeNodes, mostSignificant };
  }

  // ═══════════ 复合扫描 ═══════════

  scanAll(symbol: string) {
    return {
      footprint: this.computeFootprint(symbol),
      dom: this.computeDOM(symbol),
      cvd: this.computeCVD(symbol),
      marketProfile: this.computeMarketProfile(symbol),
      delta: this.computeDelta(symbol),
      domDepth: this.computeDOMDepth(symbol),
      oiAnalysis: this.computeOIAnalysis(symbol),
      volumeCluster: this.computeVolumeCluster(symbol),
    };
  }

  // ═══════════ Internal helpers ═══════════

  private _sma(values: number[], period: number): number[] {
    const r: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) { r.push(NaN); continue; }
      let sum = 0; for (let j = i - period + 1; j <= i; j++) sum += (values[j] || 0);
      r.push(sum / period);
    }
    return r;
  }

  private _cvdFromBars(bars: OHLCVData[]): number[] {
    const cvd: number[] = []; let cum = 0;
    for (const bar of bars) {
      cum += (bar.close >= bar.open ? 1 : -1) * (bar.volume || 0);
      cvd.push(cum);
    }
    return cvd;
  }

  private _trendDirection(values: number[]): 'up' | 'down' | 'flat' {
    if (values.length < 2) return 'flat';
    const first = values[0], last = values[values.length - 1];
    const pct = Math.abs(first) > 0.0001 ? (last - first) / Math.abs(first) : last - first;
    if (pct > 0.02) return 'up';
    if (pct < -0.02) return 'down';
    return 'flat';
  }

  private _deltaDivergence(deltas: number[], cumDelta: number[]): 'bullish' | 'bearish' | 'none' {
    if (deltas.length < 3) return 'none';
    const recentDelta = deltas.slice(-3).reduce((s, d) => s + d, 0);
    const cum = cumDelta[cumDelta.length - 1] || 0;
    if (recentDelta > 0 && cum < 0) return 'bullish'; // price down but delta turning up
    if (recentDelta < 0 && cum > 0) return 'bearish'; // price up but delta turning down
    return 'none';
  }

  private _detectProfileShape(volumes: number[], prices: number[]): 'P' | 'b' | 'D' | 'P-Tail' | 'Double' | 'Flat' {
    if (volumes.length < 3) return 'Flat';
    const maxIdx = volumes.indexOf(Math.max(...volumes));
    const n = volumes.length;
    if (maxIdx < n * 0.25) return 'P'; // POC near bottom
    if (maxIdx > n * 0.75) return 'b'; // POC near top
    // Check for double peak
    const peaks: number[] = [];
    for (let i = 1; i < n - 1; i++) {
      if (volumes[i] > volumes[i - 1] && volumes[i] > volumes[i + 1] && volumes[i] > Math.max(...volumes) * 0.5) peaks.push(i);
    }
    if (peaks.length >= 2) return 'Double';
    if (maxIdx > n * 0.3 && maxIdx < n * 0.5) return 'D'; // POC in upper-middle
    if (maxIdx > n * 0.5 && maxIdx < n * 0.7) return 'P-Tail'; // POC in lower-middle
    return 'Flat';
  }
}

// ═══════════ Singleton ═══════════

let of8Instance: OrderFlow8Engine | null = null;

export function getOrderFlow8Engine(config?: OrderFlow8EngineConfig): OrderFlow8Engine {
  if (!of8Instance) of8Instance = new OrderFlow8Engine(config);
  return of8Instance;
}

export function resetOrderFlow8Engine(): void { of8Instance = null; }
