// ── R269 JVS-1 波动8引擎 (Volatility8Engine) ──
// 8个波动率/波动性指标: ATR扩展/ChoppinessIndex/ChaikinVolatility/
// UlcerIndex/BollingerWidth/DonchianChannelWidth/KeltnerWidth/NarrowRangeDetector

import type { OHLCVData } from './trend-14-engine';

export interface Volatility8EngineConfig {
  atrPeriod?: number; atrPercentBasis?: number;
  chopPeriod?: number;
  chVolPeriod?: number; chVolRatePeriod?: number;
  ulcerPeriod?: number;
  bbPeriod?: number; bbStdDev?: number;
  dcPeriod?: number;
  kcPeriod?: number; kcMultiplier?: number;
  nrPeriod?: number; nrThreshold?: number; nrLookback?: number;
}

export const DEFAULT_VOL8_CONFIG: Required<Volatility8EngineConfig> = {
  atrPeriod: 14, atrPercentBasis: 20,
  chopPeriod: 14,
  chVolPeriod: 10, chVolRatePeriod: 10,
  ulcerPeriod: 14,
  bbPeriod: 20, bbStdDev: 2,
  dcPeriod: 20,
  kcPeriod: 20, kcMultiplier: 2,
  nrPeriod: 7, nrThreshold: 0.5, nrLookback: 100,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class Volatility8Engine {
  private config: Required<Volatility8EngineConfig>;
  private data: Map<string, OHLCVData[]> = new Map();

  constructor(config?: Volatility8EngineConfig) {
    this.config = { ...DEFAULT_VOL8_CONFIG, ...config };
  }

  reset(): void { this.data.clear(); }
  updateConfig(patch: Partial<Volatility8EngineConfig>): void { this.config = { ...this.config, ...patch }; }
  getConfig(): Required<Volatility8EngineConfig> { return { ...this.config }; }

  loadData(symbol: string, bars: OHLCVData[]): void { this.data.set(symbol.toUpperCase(), bars); }
  getData(symbol: string): OHLCVData[] { return this.data.get(symbol.toUpperCase()) || []; }

  // ═══════════ 1. ATR扩展 (ATR + ATR% + NormalizedATR) ═══════════

  /**
   * Returns ATR, ATR% (relative to price), and normalized ATR.
   * ATR% = ATR / close × 100 — shows volatility as % of price
   */
  computeATRFull(symbol: string, period?: number, percentBasis?: number): { atr: number[]; atrPercent: number[]; normATR: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.atrPeriod;
    const pb = percentBasis ?? this.config.atrPercentBasis;
    if (bars.length < p) return { atr: bars.map(() => NaN), atrPercent: [], normATR: [] };

    const atr = this._atr(bars, p);
    const atrPercent = bars.map((b, i) => atr[i] && b.close > 0 ? (atr[i] / b.close) * 100 : NaN);

    // Normalized ATR (Z-score against its own history)
    const sliced = atr.filter((v) => isFinite(v));
    const mean = sliced.reduce((s, v) => s + v, 0) / sliced.length;
    const std = Math.sqrt(sliced.reduce((s, v) => s + (v - mean) ** 2, 0) / sliced.length);
    const normATR = atr.map((v) => (isFinite(v) && std > 0 ? (v - mean) / std : NaN));

    return { atr, atrPercent, normATR };
  }

  // ═══════════ 2. Choppiness Index ═══════════

  /**
   * Choppiness Index: 0-100 scale.
   * > 61.8 = choppy/ranging market; < 38.2 = trending market
   * Formula: 100 × log₁₀(ΣATR / (HHV - LLV)) / log₁₀(n)
   */
  computeChoppinessIndex(symbol: string, period?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.chopPeriod;
    if (bars.length < p) return bars.map(() => NaN);

    const atr = this._atr(bars, 1);
    const results: number[] = [];
    const log10n = Math.log10(p);

    for (let i = 0; i < bars.length; i++) {
      if (i < p - 1) { results.push(NaN); continue; }
      let sumATR = 0;
      let hhv = bars[i].high, llv = bars[i].low;
      for (let j = i - p + 1; j <= i; j++) {
        sumATR += atr[j];
        hhv = Math.max(hhv, bars[j].high);
        llv = Math.min(llv, bars[j].low);
      }
      const range = hhv - llv;
      if (range <= 0 || log10n <= 0) { results.push(NaN); continue; }
      results.push(100 * Math.log10(sumATR / range) / log10n);
    }
    return results;
  }

  // ═══════════ 3. Chaikin Volatility ═══════════

  /**
   * Chaikin Volatility = (EMA(HL_Range) - EMA(HL_Range, n-1)) / EMA(HL_Range, n-1) × 100
   * @param ratePeriod period for the rate-of-change of the EMA lines
   */
  computeChaikinVolatility(symbol: string, period?: number, ratePeriod?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.chVolPeriod;
    const rp = ratePeriod ?? this.config.chVolRatePeriod;
    if (bars.length < p + rp) return bars.map(() => NaN);

    const hlRange = bars.map((b) => b.high - b.low);
    const emaRange = this._ema(hlRange, p);
    const results: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i < p + rp - 1 || !isFinite(emaRange[i]) || !isFinite(emaRange[i - rp]) || emaRange[i - rp] <= 0) {
        results.push(NaN); continue;
      }
      results.push(((emaRange[i] - emaRange[i - rp]) / emaRange[i - rp]) * 100);
    }
    return results;
  }

  // ═══════════ 4. Ulcer Index ═══════════

  /**
   * Ulcer Index = √(mean of squared percentage drawdowns)
   * Measures downside volatility only — the "pain" index.
   * High UI = large/ frequent drawdowns; low UI = smooth ride
   */
  computeUlcerIndex(symbol: string, period?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.ulcerPeriod;
    if (bars.length < p) return bars.map(() => NaN);

    const results: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < p - 1) { results.push(NaN); continue; }
      let hh = bars[i - p + 1].close;
      let sumSq = 0;
      for (let j = i - p + 1; j <= i; j++) {
        hh = Math.max(hh, bars[j].close);
        const drawdown = hh > 0 ? ((bars[j].close - hh) / hh) * 100 : 0;
        sumSq += drawdown * drawdown;
      }
      results.push(Math.sqrt(sumSq / p));
    }
    return results;
  }

  // ═══════════ 5. Bollinger Band Width ═══════════

  /**
   * BB Width = (UpperBand - LowerBand) / MiddleBand
   * Shows relative width — narrow = squeeze, wide = expansion
   * Also returns BB %B (price position within bands)
   */
  computeBollingerWidth(symbol: string, period?: number, stdDev?: number): { width: number[]; percentB: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.bbPeriod;
    const sd = stdDev ?? this.config.bbStdDev;
    if (bars.length < p) return { width: bars.map(() => NaN), percentB: [] };

    const closes = bars.map((b) => b.close);
    const width: number[] = [];
    const percentB: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i < p - 1) { width.push(NaN); percentB.push(NaN); continue; }
      const slice = closes.slice(i - p + 1, i + 1);
      const mean = slice.reduce((s, v) => s + v, 0) / p;
      const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / p;
      const std = Math.sqrt(variance);
      const upper = mean + sd * std;
      const lower = mean - sd * std;
      width.push(mean > 0 ? (upper - lower) / mean : NaN);
      percentB.push(upper - lower > 0 ? (bars[i].close - lower) / (upper - lower) : NaN);
    }
    return { width, percentB };
  }

  // ═══════════ 6. Donchian Channel Width ═══════════

  /**
   * Donchian Channel Width = (Upper - Lower) / Middle
   * Measures how wide the breakout channel is
   */
  computeDonchianWidth(symbol: string, period?: number): { width: number[]; upper: number[]; lower: number[]; middle: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.dcPeriod;
    if (bars.length < p) return { width: bars.map(() => NaN), upper: [], lower: [], middle: [] };

    const upper: number[] = [];
    const lower: number[] = [];
    const middle: number[] = [];
    const width: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i < p - 1) { upper.push(NaN); lower.push(NaN); middle.push(NaN); width.push(NaN); continue; }
      const slice = bars.slice(i - p + 1, i + 1);
      const u = Math.max(...slice.map((b) => b.high));
      const l = Math.min(...slice.map((b) => b.low));
      const m = (u + l) / 2;
      upper.push(u); lower.push(l); middle.push(m);
      width.push(m > 0 ? (u - l) / m : NaN);
    }
    return { width, upper, lower, middle };
  }

  // ═══════════ 7. Keltner Channel Width ═══════════

  /**
   * Keltner Channel Width = (Upper - Lower) / Middle
   * Similar to BB Width but uses ATR-based bands
   */
  computeKeltnerWidth(symbol: string, period?: number, multiplier?: number): { width: number[]; upper: number[]; lower: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.kcPeriod;
    const mult = multiplier ?? this.config.kcMultiplier;
    if (bars.length < p) return { width: bars.map(() => NaN), upper: [], lower: [] };

    const closes = bars.map((b) => b.close);
    const ema = this._ema(closes, p);
    const atr = this._atr(bars, p);
    const width: number[] = [];
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i < p - 1 || !isFinite(ema[i]) || !isFinite(atr[i])) { width.push(NaN); upper.push(NaN); lower.push(NaN); continue; }
      upper.push(ema[i] + mult * atr[i]);
      lower.push(ema[i] - mult * atr[i]);
      width.push(ema[i] > 0 ? (2 * mult * atr[i]) / ema[i] : NaN);
    }
    return { width, upper, lower };
  }

  // ═══════════ 8. Narrow Range Detector ═══════════

  /**
   * NR7/NR4/Tight Range detection.
   * NR7 = narrowest range in last 7 bars → often precedes breakouts
   * Returns narrow range signal + range rank + breakout direction hint
   */
  computeNarrowRange(symbol: string, period?: number, threshold?: number, lookback?: number): { isNR: boolean[]; nrRank: number[]; tightCluster: boolean[]; avgRange: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.nrPeriod;
    const thresh = threshold ?? this.config.nrThreshold;
    const lb = lookback ?? this.config.nrLookback;
    if (bars.length < p) return { isNR: bars.map(() => false), nrRank: [], tightCluster: [], avgRange: [] };

    const ranges = bars.map((b) => b.high - b.low);
    const isNR: boolean[] = [];
    const nrRank: number[] = []; // 1 = narrowest this period
    const tightCluster: boolean[] = [];
    const avgRange: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      avgRange.push(i >= lb - 1 ? ranges.slice(i - lb + 1, i + 1).reduce((s, v) => s + v, 0) / lb : ranges.slice(0, i + 1).reduce((s, v) => s + v, 0) / (i + 1));

      if (i < p - 1) { isNR.push(false); nrRank.push(0); tightCluster.push(false); continue; }
      const slice = ranges.slice(i - p + 1, i + 1);
      const curRange = ranges[i];
      const sorted = [...slice].sort((a, b) => a - b);
      const rank = sorted.indexOf(curRange) + 1;

      nrRank.push(rank);
      isNR.push(rank === 1); // NR7 = narrowest day

      // Tight cluster: last 3 bars all below threshold × avg
      const avg = avgRange[i];
      const tight = i >= 2 && ranges.slice(i - 2, i + 1).every((r) => r < thresh * avg);
      tightCluster.push(tight);
    }

    return { isNR, nrRank, tightCluster, avgRange };
  }

  // ═══════════ 复合扫描 ═══════════

  scanAll(symbol: string) {
    return {
      atrFull: this.computeATRFull(symbol),
      choppiness: this.computeChoppinessIndex(symbol),
      chaikinVol: this.computeChaikinVolatility(symbol),
      ulcer: this.computeUlcerIndex(symbol),
      bbWidth: this.computeBollingerWidth(symbol),
      donchianWidth: this.computeDonchianWidth(symbol),
      keltnerWidth: this.computeKeltnerWidth(symbol),
      narrowRange: this.computeNarrowRange(symbol),
    };
  }

  /**
   * Volatility composite: returns a single 0-100 "volatility score"
   * based on multiple indicators combined
   */
  computeVolatilityComposite(symbol: string): { score: number; level: 'extreme_low' | 'low' | 'normal' | 'high' | 'extreme_high'; details: string[] } {
    const bars = this.getData(symbol);
    if (bars.length < 20) return { score: 0, level: 'normal', details: ['insufficient data'] };

    const chop = this.computeChoppinessIndex(symbol);
    const atrP = this.computeATRFull(symbol).atrPercent;
    const bbw = this.computeBollingerWidth(symbol);
    const nr = this.computeNarrowRange(symbol);

    const lastChop = chop.filter((v) => isFinite(v)).pop() || 50;
    const lastATRp = atrP.filter((v) => isFinite(v)).pop() || 2;
    const lastBBW = bbw.width.filter((v) => isFinite(v)).pop() || 0.05;
    const lastNR = nr.isNR[nr.isNR.length - 1];

    // Low chop = trending, high chop = ranging
    const trendScore = Math.max(0, 100 - lastChop);
    // ATR% baseline ~2%, 0% is extreme low, 5%+ is extreme high
    const volScore = Math.min(100, (lastATRp / 5) * 100);
    // BBW baseline ~0.05, 0 is tight, 0.15+ is wide
    const bbScore = Math.min(100, (lastBBW / 0.15) * 100);
    const nrBonus = lastNR ? 15 : 0; // NR7 adds volatility expectation

    const composite = Math.min(100, (trendScore * 0.2 + volScore * 0.4 + bbScore * 0.3 + nrBonus));

    let level: 'extreme_low' | 'low' | 'normal' | 'high' | 'extreme_high';
    if (composite < 15) level = 'extreme_low';
    else if (composite < 35) level = 'low';
    else if (composite < 65) level = 'normal';
    else if (composite < 85) level = 'high';
    else level = 'extreme_high';

    return {
      score: Math.round(composite * 10) / 10,
      level,
      details: [
        `Choppiness: ${lastChop.toFixed(1)} (${lastChop > 61.8 ? 'ranging' : 'trending'})`,
        `ATR%: ${lastATRp.toFixed(2)}%`,
        `BB Width: ${(lastBBW * 100).toFixed(1)}%`,
        `NR7: ${lastNR ? 'YES (narrowest range)' : 'no'}`,
      ],
    };
  }

  // ═══════════ Internal helpers ═══════════

  private _atr(bars: OHLCVData[], period: number): number[] {
    const r: number[] = [NaN];
    let atr = bars[0].high - bars[0].low;
    for (let i = 1; i < bars.length; i++) {
      const tr = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close));
      if (i < period) { r.push(NaN); atr = ((atr * (i - 1)) + tr) / i; continue; }
      atr = (atr * (period - 1) + tr) / period;
      r.push(atr);
    }
    return r;
  }

  private _ema(values: number[], period: number): number[] {
    const r: number[] = [values[0] || NaN];
    const k = 2 / (period + 1);
    let ema = values[0] || 0;
    for (let i = 1; i < values.length; i++) {
      if (isNaN(ema)) ema = values[i - 1] || values[i];
      if (isNaN(values[i])) { r.push(NaN); continue; }
      ema = values[i] * k + ema * (1 - k);
      r.push(ema);
    }
    return r;
  }
}

// ═══════════ Singleton ═══════════

let vol8Instance: Volatility8Engine | null = null;

export function getVolatility8Engine(config?: Volatility8EngineConfig): Volatility8Engine {
  if (!vol8Instance) vol8Instance = new Volatility8Engine(config);
  return vol8Instance;
}

export function resetVolatility8Engine(): void { vol8Instance = null; }
