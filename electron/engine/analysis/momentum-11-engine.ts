// ── R268 JVS-2 动量11引擎 (Momentum11Engine) ──
// 11个动量指标: StochRSI/UltimateOscillator/TRIX/Vortex/ConnorsRSI/KlingerOscillator/
// RateOfChange/HistoricalVolatility/RelativeVigorIndex/EldersThermometer/PriceChannel

import type { OHLCVData } from './trend-14-engine';

export interface MomentumResult {
  timestamp: number;
  value?: number;
  signal?: number;
  [key: string]: unknown;
}

export interface Momentum11EngineConfig {
  stochRSI_rsiPeriod?: number; stochRSI_stochPeriod?: number; stochRSI_smoothK?: number; stochRSI_smoothD?: number;
  uo_fastPeriod?: number; uo_mediumPeriod?: number; uo_slowPeriod?: number;
  trixPeriod?: number; trixSignalPeriod?: number;
  vortexPeriod?: number;
  connorsRSI_rsiPeriod?: number; connorsRSI_streakPeriod?: number; connorsRSI_rankPeriod?: number;
  klingerPeriod?: number; klingerSignalPeriod?: number;
  rocPeriod?: number;
  hvPeriod?: number;
  rviPeriod?: number;
  elderThermoPeriod?: number;
  priceChannelPeriod?: number;
}

export const DEFAULT_MOMENTUM_CONFIG: Required<Momentum11EngineConfig> = {
  stochRSI_rsiPeriod: 14, stochRSI_stochPeriod: 14, stochRSI_smoothK: 3, stochRSI_smoothD: 3,
  uo_fastPeriod: 7, uo_mediumPeriod: 14, uo_slowPeriod: 28,
  trixPeriod: 15, trixSignalPeriod: 9,
  vortexPeriod: 14,
  connorsRSI_rsiPeriod: 3, connorsRSI_streakPeriod: 2, connorsRSI_rankPeriod: 100,
  klingerPeriod: 34, klingerSignalPeriod: 13,
  rocPeriod: 12,
  hvPeriod: 20,
  rviPeriod: 10,
  elderThermoPeriod: 22,
  priceChannelPeriod: 20,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class Momentum11Engine {
  private config: Required<Momentum11EngineConfig>;
  private data: Map<string, OHLCVData[]> = new Map();

  constructor(config?: Momentum11EngineConfig) {
    this.config = { ...DEFAULT_MOMENTUM_CONFIG, ...config };
  }

  reset(): void { this.data.clear(); }
  updateConfig(patch: Partial<Momentum11EngineConfig>): void { this.config = { ...this.config, ...patch }; }
  getConfig(): Required<Momentum11EngineConfig> { return { ...this.config }; }

  loadData(symbol: string, bars: OHLCVData[]): void {
    this.data.set(symbol.toUpperCase(), bars);
  }

  getData(symbol: string): OHLCVData[] {
    return this.data.get(symbol.toUpperCase()) || [];
  }

  // ═══════════ 1. StochRSI ═══════════

  /**
   * Stochastic RSI = (RSI - min(RSI, period)) / (max(RSI, period) - min(RSI, period))
   * Smoothed by SMA
   */
  computeStochRSI(symbol: string, rsiPeriod?: number, stochPeriod?: number, smoothK?: number, smoothD?: number): { stochRSI: number[]; signalK: number[]; signalD: number[] } {
    const bars = this.getData(symbol);
    const rp = rsiPeriod || this.config.stochRSI_rsiPeriod;
    const sp = stochPeriod || this.config.stochRSI_stochPeriod;
    const sk = smoothK || this.config.stochRSI_smoothK;
    const sd = smoothD || this.config.stochRSI_smoothD;
    if (bars.length < rp + sp) return { stochRSI: bars.map(() => NaN), signalK: [], signalD: [] };

    const rsi = this._rsi(bars.map((b) => b.close), rp);
    const stochRSI: number[] = [];
    for (let i = 0; i < rsi.length; i++) {
      if (i < sp - 1 || isNaN(rsi[i])) { stochRSI.push(NaN); continue; }
      const slice = rsi.slice(i - sp + 1, i + 1).filter((v) => isFinite(v));
      const minR = Math.min(...slice); const maxR = Math.max(...slice);
      stochRSI.push(maxR - minR > 0 ? (rsi[i] - minR) / (maxR - minR) * 100 : 50);
    }
    const signalK = this._sma(stochRSI, sk);
    const signalD = this._sma(signalK, sd);
    return { stochRSI, signalK, signalD };
  }

  // ═══════════ 2. Ultimate Oscillator ═══════════

  computeUltimateOscillator(symbol: string, fastPeriod?: number, mediumPeriod?: number, slowPeriod?: number): number[] {
    const bars = this.getData(symbol);
    const fp = fastPeriod || this.config.uo_fastPeriod;
    const mp = mediumPeriod || this.config.uo_mediumPeriod;
    const sp = slowPeriod || this.config.uo_slowPeriod;
    const results: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i < sp) { results.push(NaN); continue; }

      const bp = (price: number, prevClose: number) => price - Math.min(price, prevClose);
      const tr_ = (h: number, l: number, pc: number) => Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));

      let avg7BP = 0, avg7TR = 0, avg14BP = 0, avg14TR = 0, avg28BP = 0, avg28TR = 0;

      for (let j = i - fp + 1; j <= i; j++) {
        avg7BP += bp(bars[j].low, bars[j - 1].close);
        avg7TR += tr_(bars[j].high, bars[j].low, bars[j - 1].close);
      }
      for (let j = i - mp + 1; j <= i; j++) {
        avg14BP += bp(bars[j].low, bars[j - 1].close);
        avg14TR += tr_(bars[j].high, bars[j].low, bars[j - 1].close);
      }
      for (let j = i - sp + 1; j <= i; j++) {
        avg28BP += bp(bars[j].low, bars[j - 1].close);
        avg28TR += tr_(bars[j].high, bars[j].low, bars[j - 1].close);
      }

      const uo = (4 * (avg7BP / Math.max(avg7TR, 0.0001)) + 2 * (avg14BP / Math.max(avg14TR, 0.0001)) + (avg28BP / Math.max(avg28TR, 0.0001))) / 7 * 100;
      results.push(Math.min(100, Math.max(0, uo)));
    }
    return results;
  }

  // ═══════════ 3. TRIX ═══════════

  computeTRIX(symbol: string, period?: number, signalPeriod?: number): { trix: number[]; signal: number[]; histogram: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.trixPeriod;
    const sp = signalPeriod || this.config.trixSignalPeriod;
    const closes = bars.map((b) => b.close);
    const e1 = this._ema(closes, p);
    const e2 = this._ema(e1.filter((v) => isFinite(v)), p);
    const e3 = this._ema(e2.filter((v) => isFinite(v)), p);

    const pad = bars.length - e3.length;
    const trix: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < pad) { trix.push(NaN); continue; }
      const idx = i - pad;
      if (idx < 1) { trix.push(NaN); continue; }
      trix.push(e3[idx] !== 0 ? ((e3[idx] - e3[idx - 1]) / e3[idx]) * 100 : 0);
    }
    const signal = this._ema(trix.filter((v) => isFinite(v)), sp);
    const sPad = trix.length - signal.length;
    const fullSignal = [...Array(sPad).fill(NaN), ...signal];
    const histogram = trix.map((t, i) => (isFinite(t) && fullSignal[i] != null && isFinite(fullSignal[i]) ? t - fullSignal[i] : NaN));
    return { trix, signal: fullSignal, histogram };
  }

  // ═══════════ 4. Vortex ═══════════

  computeVortex(symbol: string, period?: number): { plusVI: number[]; minusVI: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.vortexPeriod;
    const plusVI: number[] = [];
    const minusVI: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i < p) { plusVI.push(NaN); minusVI.push(NaN); continue; }
      let vmPlus = 0, vmMinus = 0, trSum = 0;
      for (let j = i - p + 1; j <= i; j++) {
        vmPlus += Math.abs(bars[j].high - bars[j - 1].low);
        vmMinus += Math.abs(bars[j].low - bars[j - 1].high);
        trSum += Math.max(bars[j].high - bars[j].low, Math.abs(bars[j].high - bars[j - 1].close), Math.abs(bars[j].low - bars[j - 1].close));
      }
      plusVI.push(trSum > 0 ? (vmPlus / trSum) * 100 : NaN);
      minusVI.push(trSum > 0 ? (vmMinus / trSum) * 100 : NaN);
    }
    return { plusVI, minusVI };
  }

  // ═══════════ 5. Connors RSI ═══════════

  computeConnorsRSI(symbol: string, rsiPeriod?: number, streakPeriod?: number, rankPeriod?: number): number[] {
    const bars = this.getData(symbol);
    const rp = rsiPeriod || this.config.connorsRSI_rsiPeriod;
    const streakP = streakPeriod || this.config.connorsRSI_streakPeriod;
    const rankP = rankPeriod || this.config.connorsRSI_rankPeriod;
    const results: number[] = [];

    // Streak
    const streak: number[] = [0];
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].close > bars[i - 1].close) streak.push(streak[i - 1] >= 0 ? streak[i - 1] + 1 : 1);
      else if (bars[i].close < bars[i - 1].close) streak.push(streak[i - 1] <= 0 ? streak[i - 1] - 1 : -1);
      else streak.push(0);
    }

    const rsi = this._rsi(bars.map((b) => b.close), rp);

    // Percentage rank of close
    const pctRank: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < rankP) { pctRank.push(NaN); continue; }
      const slice = bars.slice(i - rankP + 1, i + 1).map((b) => b.close);
      const rank = slice.filter((v) => v < bars[i].close).length;
      pctRank.push(slice.length > 1 ? rank / (slice.length - 1) * 100 : 50);
    }

    const streakRSI = this._rsi(streak.filter((v) => v != null), streakP);
    const sPad = streak.length - streakRSI.length;

    for (let i = 0; i < bars.length; i++) {
      if (isNaN(rsi[i]) || isNaN(pctRank[i])) { results.push(NaN); continue; }
      const sVal = i >= sPad ? streakRSI[i - sPad] : 0;
      results.push((rsi[i] + sVal + pctRank[i]) / 3);
    }
    return results;
  }

  // ═══════════ 6. Klinger Oscillator ═══════════

  computeKlinger(symbol: string, period?: number, signalPeriod?: number): { ko: number[]; signal: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.klingerPeriod;
    const sp = signalPeriod || this.config.klingerSignalPeriod;
    if (bars.length < p + sp) return { ko: bars.map(() => NaN), signal: [] };

    const vf: number[] = []; // Volume Force
    for (let i = 0; i < bars.length; i++) {
      if (i === 0) { vf.push(0); continue; }
      const trend_ = (bars[i].high + bars[i].low + bars[i].close) > (bars[i - 1].high + bars[i - 1].low + bars[i - 1].close) ? 1 : -1;
      const dm = bars[i].high - bars[i].low;
      const cm = Math.abs(bars[i].high - bars[i - 1].close) + Math.abs(bars[i].low - bars[i - 1].close) - dm;
      const vol = bars[i].volume || 1;
      vf.push(vol * dm * trend_ / Math.max(cm, 0.0001));
    }

    const ko = this._ema(vf, p);
    const signal = this._ema(ko.filter((v) => isFinite(v)), sp);
    const sPad = ko.length - signal.length;
    const fullSignal = [...Array(Math.max(0, sPad)).fill(NaN), ...signal];
    return { ko, signal: fullSignal };
  }

  // ═══════════ 7. Rate of Change ═══════════

  computeROC(symbol: string, period?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.rocPeriod;
    if (bars.length < p) return bars.map(() => NaN);
    const results: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < p) { results.push(NaN); continue; }
      results.push(((bars[i].close - bars[i - p].close) / bars[i - p].close) * 100);
    }
    return results;
  }

  // ═══════════ 8. Historical Volatility ═══════════

  computeHistoricalVolatility(symbol: string, period?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.hvPeriod;
    if (bars.length < p + 1) return bars.map(() => NaN);
    const results: number[] = [];
    const logReturns: number[] = [];
    for (let i = 1; i < bars.length; i++) logReturns.push(Math.log(bars[i].close / bars[i - 1].close));

    for (let i = 0; i < bars.length; i++) {
      if (i < p) { results.push(NaN); continue; }
      const slice = logReturns.slice(i - p, i);
      const mean = slice.reduce((s, v) => s + v, 0) / p;
      const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / (p - 1);
      results.push(Math.sqrt(variance) * Math.sqrt(252) * 100); // Annualized %
    }
    return results;
  }

  // ═══════════ 9. Relative Vigor Index ═══════════

  computeRVI(symbol: string, period?: number): { rvi: number[]; signal: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.rviPeriod;
    if (bars.length < p + 4) return { rvi: bars.map(() => NaN), signal: [] };

    const num: number[] = [];
    const den: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < 3) { num.push(NaN); den.push(NaN); continue; }
      const n = (bars[i].close - bars[i].open) + 2 * (bars[i - 1].close - bars[i - 1].open) + 2 * (bars[i - 2].close - bars[i - 2].open) + (bars[i - 3].close - bars[i - 3].open);
      num.push(n / 6);
      const d = (bars[i].high - bars[i].low) + 2 * (bars[i - 1].high - bars[i - 1].low) + 2 * (bars[i - 2].high - bars[i - 2].low) + (bars[i - 3].high - bars[i - 3].low);
      den.push(d / 6);
    }

    const rvi: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < p + 3) { rvi.push(NaN); continue; }
      const sumNum = num.slice(i - p + 1, i + 1).reduce((s, v) => s + (v || 0), 0);
      const sumDen = den.slice(i - p + 1, i + 1).reduce((s, v) => s + (v || 0), 0);
      rvi.push(sumDen > 0 ? sumNum / sumDen : 0);
    }

    const signal = this._ema(rvi.filter((v) => isFinite(v)), 4);
    const sPad = rvi.length - signal.length;
    return { rvi, signal: [...Array(Math.max(0, sPad)).fill(NaN), ...signal] };
  }

  // ═══════════ 10. Elder's Thermometer ═══════════

  computeEldersThermometer(symbol: string, period?: number): { thermometer: number[]; ma: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.elderThermoPeriod;
    if (bars.length < p * 2) return { thermometer: bars.map(() => NaN), ma: [] };

    const hhv = this._rollingMax(bars.map((b) => b.high), p);
    const llv = this._rollingMin(bars.map((b) => b.low), p);

    const thermometer = bars.map((b, i) => {
      if (i < p - 1) return NaN;
      const range = hhv[i] - llv[i];
      return range > 0 ? ((b.close - llv[i]) / range) * 100 : 50;
    });
    const ma = this._sma(thermometer, p);
    return { thermometer, ma };
  }

  // ═══════════ 11. Price Channel ═══════════

  computePriceChannel(symbol: string, period?: number): { upper: number[]; lower: number[]; middle: number[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.priceChannelPeriod;
    if (bars.length < p) return { upper: bars.map(() => NaN), lower: bars.map(() => NaN), middle: bars.map(() => NaN) };

    const upper: number[] = [];
    const lower: number[] = [];
    const middle: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i < p - 1) { upper.push(NaN); lower.push(NaN); middle.push(NaN); continue; }
      const slice = bars.slice(i - p + 1, i + 1);
      const h = Math.max(...slice.map((b) => b.high));
      const l = Math.min(...slice.map((b) => b.low));
      upper.push(h); lower.push(l); middle.push((h + l) / 2);
    }
    return { upper, lower, middle };
  }

  // ═══════════ 复合扫描 ═══════════

  scanAll(symbol: string) {
    const bars = this.getData(symbol);
    return {
      stochRSI: this.computeStochRSI(symbol),
      ultimateOscillator: this.computeUltimateOscillator(symbol),
      trix: this.computeTRIX(symbol),
      vortex: this.computeVortex(symbol),
      connorsRSI: this.computeConnorsRSI(symbol),
      klinger: this.computeKlinger(symbol),
      roc: this.computeROC(symbol),
      hv: this.computeHistoricalVolatility(symbol),
      rvi: this.computeRVI(symbol),
      eldersThermo: this.computeEldersThermometer(symbol),
      priceChannel: this.computePriceChannel(symbol),
    };
  }

  // ═══════════ Internal helpers ═══════════

  private _rsi(closes: number[], period: number): number[] {
    const r: number[] = [];
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < closes.length; i++) {
      if (i === 0) { r.push(NaN); continue; }
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      if (i < period) { avgGain += gain / period; avgLoss += loss / period; if (i === period - 1) r.push(avgLoss > 0 ? 100 - 100 / (1 + avgGain / avgLoss) : 100); else r.push(NaN); continue; }
      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
      r.push(avgLoss > 0 ? 100 - 100 / (1 + avgGain / avgLoss) : 100);
    }
    return r;
  }

  private _sma(values: number[], period: number): number[] {
    const r: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) { r.push(NaN); continue; }
      let sum = 0, count = 0;
      for (let j = i - period + 1; j <= i; j++) { if (isFinite(values[j])) { sum += values[j]; count++; } }
      r.push(count > 0 ? sum / count : NaN);
    }
    return r;
  }

  private _ema(values: number[], period: number): number[] {
    const r: number[] = [values[0] || NaN];
    const k = 2 / (period + 1);
    let ema = values[0] || 0;
    for (let i = 1; i < values.length; i++) {
      if (isNaN(ema)) ema = values[i - 1] || values[i];
      if (isNaN(values[i]) || values[i] == null) { r.push(NaN); continue; }
      ema = values[i] * k + ema * (1 - k);
      r.push(ema);
    }
    return r;
  }

  private _rollingMax(values: number[], period: number): number[] {
    const r: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) { r.push(NaN); continue; }
      r.push(Math.max(...values.slice(i - period + 1, i + 1)));
    }
    return r;
  }

  private _rollingMin(values: number[], period: number): number[] {
    const r: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) { r.push(NaN); continue; }
      r.push(Math.min(...values.slice(i - period + 1, i + 1)));
    }
    return r;
  }
}

// ═══════════ Singleton ═══════════

let momentum11Instance: Momentum11Engine | null = null;

export function getMomentum11Engine(config?: Momentum11EngineConfig): Momentum11Engine {
  if (!momentum11Instance) momentum11Instance = new Momentum11Engine(config);
  return momentum11Instance;
}

export function resetMomentum11Engine(): void { momentum11Instance = null; }
