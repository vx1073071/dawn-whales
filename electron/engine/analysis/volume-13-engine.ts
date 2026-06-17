// ── R268 JVS-3 成交量13引擎 (Volume13Engine) ──
// 13个成交量指标: VWMACD/VolumeOscillator/ADLine/EMV/NVI/PVI/VFI/TwiggsMF/
// VPCI/AnchoredVWAP/MFI(volume)/VZO/VolumeBubble

import type { OHLCVData } from './trend-14-engine';

export interface Volume13EngineConfig {
  vwmacd_fastPeriod?: number; vwmacd_slowPeriod?: number; vwmacd_signalPeriod?: number;
  vo_shortPeriod?: number; vo_longPeriod?: number;
  emv_period?: number;
  nvi_initial?: number;
  pvi_initial?: number;
  vfi_period?: number; vfi_coef?: number; vfi_vcoef?: number;
  twiggs_period?: number;
  vpci_shortPeriod?: number; vpci_longPeriod?: number;
  anchoredVWAP_price?: number;
  mfi_period?: number;
  vzo_period?: number;
  volBubble_period?: number; volBubble_threshold?: number;
}

export const DEFAULT_VOLUME_CONFIG: Required<Volume13EngineConfig> = {
  vwmacd_fastPeriod: 12, vwmacd_slowPeriod: 26, vwmacd_signalPeriod: 9,
  vo_shortPeriod: 5, vo_longPeriod: 10,
  emv_period: 14,
  nvi_initial: 1000,
  pvi_initial: 1000,
  vfi_period: 130, vfi_coef: 0.2, vfi_vcoef: 2.5,
  twiggs_period: 21,
  vpci_shortPeriod: 20, vpci_longPeriod: 50,
  anchoredVWAP_price: 0,
  mfi_period: 14,
  vzo_period: 14,
  volBubble_period: 20, volBubble_threshold: 2.0,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class Volume13Engine {
  private config: Required<Volume13EngineConfig>;
  private data: Map<string, OHLCVData[]> = new Map();
  private cache: Map<string, Record<string, unknown>> = new Map();

  constructor(config?: Volume13EngineConfig) {
    this.config = { ...DEFAULT_VOLUME_CONFIG, ...config };
  }

  reset(): void { this.data.clear(); this.cache.clear(); }
  updateConfig(patch: Partial<Volume13EngineConfig>): void { this.config = { ...this.config, ...patch }; this.cache.clear(); }
  getConfig(): Required<Volume13EngineConfig> { return { ...this.config }; }

  loadData(symbol: string, bars: OHLCVData[]): void {
    this.data.set(symbol.toUpperCase(), bars);
    this.cache.delete(symbol.toUpperCase());
  }

  getData(symbol: string): OHLCVData[] {
    return this.data.get(symbol.toUpperCase()) || [];
  }

  // ═══════════ 1. Volume-Weighted MACD ═══════════

  computeVWMACD(symbol: string, fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): { vwmacd: number[]; signal: number[]; histogram: number[] } {
    const bars = this.getData(symbol);
    const fp = fastPeriod || this.config.vwmacd_fastPeriod;
    const sp = slowPeriod || this.config.vwmacd_slowPeriod;
    const sigP = signalPeriod || this.config.vwmacd_signalPeriod;
    if (bars.length < sp) return { vwmacd: bars.map(() => NaN), signal: [], histogram: [] };

    // Volume-weighted price
    const vwp: number[] = [];
    let cumVol = 0, cumPV = 0;
    for (const bar of bars) {
      const vol = bar.volume || 1;
      cumPV += bar.close * vol; cumVol += vol;
      vwp.push(cumPV / cumVol);
    }

    const fastEMA = this._ema(vwp, fp);
    const slowEMA = this._ema(vwp, sp);
    const macd = fastEMA.map((f, i) => (isFinite(f) && isFinite(slowEMA[i]) ? f - slowEMA[i] : NaN));
    const signal = this._ema(macd.filter((v) => isFinite(v)), sigP);
    const sPad = macd.length - signal.length;
    const fullSignal = [...Array(Math.max(0, sPad)).fill(NaN), ...signal];
    const histogram = macd.map((m, i) => (isFinite(m) && fullSignal[i] != null && isFinite(fullSignal[i]) ? m - fullSignal[i] : NaN));
    return { vwmacd: macd, signal: fullSignal, histogram };
  }

  // ═══════════ 2. Volume Oscillator ═══════════

  computeVolumeOscillator(symbol: string, shortPeriod?: number, longPeriod?: number): number[] {
    const bars = this.getData(symbol);
    const sp = shortPeriod || this.config.vo_shortPeriod;
    const lp = longPeriod || this.config.vo_longPeriod;
    const volumes = bars.map((b) => b.volume || 0);
    const shortMA = this._sma(volumes, sp);
    const longMA = this._sma(volumes, lp);
    return shortMA.map((s, i) => (s > 0 && longMA[i] > 0 ? ((s - longMA[i]) / longMA[i]) * 100 : NaN));
  }

  // ═══════════ 3. Accumulation/Distribution Line ═══════════

  computeADLine(symbol: string): number[] {
    const bars = this.getData(symbol);
    const result: number[] = [];
    let adl = 0;
    for (const bar of bars) {
      const range = bar.high - bar.low;
      const clv = range > 0 ? ((bar.close - bar.low) - (bar.high - bar.close)) / range : 0;
      adl += clv * (bar.volume || 0);
      result.push(adl);
    }
    return result;
  }

  // ═══════════ 4. Ease of Movement ═══════════

  computeEMV(symbol: string, period?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.emv_period;
    if (bars.length < 2) return [];
    const emvRaw: number[] = [NaN];
    for (let i = 1; i < bars.length; i++) {
      const dist = ((bars[i].high + bars[i].low) / 2) - ((bars[i - 1].high + bars[i - 1].low) / 2);
      const bvr = (bars[i].volume || 1) / (bars[i].high - bars[i].low || 1) * 100_000_000;
      emvRaw.push(bvr > 0 ? dist / bvr : 0);
    }
    return this._sma(emvRaw, p);
  }

  // ═══════════ 5. Negative Volume Index ═══════════

  computeNVI(symbol: string, initial?: number): number[] {
    const bars = this.getData(symbol);
    const init = initial ?? this.config.nvi_initial;
    const result: number[] = [];
    let nvi = init;
    for (let i = 0; i < bars.length; i++) {
      if (i === 0) { result.push(nvi); continue; }
      const volDec = (bars[i].volume || 0) < (bars[i - 1].volume || 0);
      if (volDec) nvi = nvi * (bars[i].close / bars[i - 1].close);
      result.push(nvi);
    }
    return result;
  }

  // ═══════════ 6. Positive Volume Index ═══════════

  computePVI(symbol: string, initial?: number): number[] {
    const bars = this.getData(symbol);
    const init = initial ?? this.config.pvi_initial;
    const result: number[] = [];
    let pvi = init;
    for (let i = 0; i < bars.length; i++) {
      if (i === 0) { result.push(pvi); continue; }
      const volInc = (bars[i].volume || 0) > (bars[i - 1].volume || 0);
      if (volInc) pvi = pvi * (bars[i].close / bars[i - 1].close);
      result.push(pvi);
    }
    return result;
  }

  // ═══════════ 7. Volume Flow Indicator ═══════════

  computeVFI(symbol: string, period?: number, coef?: number, vcoef?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.vfi_period;
    const c = coef ?? this.config.vfi_coef;
    const vc = vcoef ?? this.config.vfi_vcoef;
    if (bars.length < p) return bars.map(() => NaN);

    const typical = bars.map((b) => (b.high + b.low + b.close) / 3);
    const result: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i < p) { result.push(NaN); continue; }
      let inter: number = 0, vMin = Infinity, vMax = 0;
      const volMA = bars.slice(i - p + 1, i + 1).reduce((s, b) => s + (b.volume || 0), 0) / p;

      for (let j = i - p + 1; j <= i; j++) {
        const vt = typical[j];
        const vt1 = typical[j - 1];
        const h = bars[j].high; const l = bars[j].low;
        const vp = (vt - vt1) * (bars[j].volume || 0);
        const cutoff = c * volMA;
        const v = Math.min((bars[j].volume || 0), cutoff);
        inter += vp * vc;
        vMin = Math.min(vMin, v); vMax = Math.max(vMax, v);
      }
      const iv = vMax - vMin > 0 ? (volMA - vMin) / (vMax - vMin) : 0.5;
      const vfi = inter / Math.max(volMA * p, 1) * iv;
      result.push(vfi);
    }
    return result;
  }

  // ═══════════ 8. Twiggs Money Flow ═══════════

  computeTwiggsMF(symbol: string, period?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.twiggs_period;
    if (bars.length < p) return bars.map(() => NaN);

    // Raw TMF = EMA(volume * ((close - low) - (high - close)) / (high - low), period)
    const tmfRaw: number[] = [NaN];
    for (let i = 1; i < bars.length; i++) {
      const range = bars[i].high - bars[i].low;
      const adj = range > 0 ? ((bars[i].close - bars[i].low) - (bars[i].high - bars[i].close)) / range : 0;
      tmfRaw.push(adj * (bars[i].volume || 0));
    }
    const ema = this._ema(tmfRaw.filter((v) => isFinite(v)), p);
    const volMA = this._sma(bars.map((b) => b.volume || 1), p);
    const pad = tmfRaw.length - ema.length;
    return tmfRaw.map((_, i) => {
      if (i < pad + p - 1 || volMA[i] <= 0) return NaN;
      return ema[i - pad] / volMA[i];
    });
  }

  // ═══════════ 9. Volume Price Confirmation Indicator ═══════════

  computeVPCI(symbol: string, shortPeriod?: number, longPeriod?: number): { vpci: number[]; vpcr: number[] } {
    const bars = this.getData(symbol);
    const sp = shortPeriod || this.config.vpci_shortPeriod;
    const lp = longPeriod || this.config.vpci_longPeriod;
    if (bars.length < lp) return { vpci: bars.map(() => NaN), vpcr: [] };

    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => b.volume || 0);

    const smaClose = this._sma(closes, sp);
    const lmaClose = this._sma(closes, lp);
    const vwmaSP = this._vwap(bars, sp);
    const vwmaLP = this._vwap(bars, lp);
    const smaVol = this._sma(volumes, sp);
    const lmaVol = this._sma(volumes, lp);

    const vpci: number[] = [];
    const vpcr: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i < lp - 1 || isNaN(smaClose[i]) || isNaN(lmaClose[i]) || isNaN(vwmaSP[i]) || isNaN(vwmaLP[i])) {
        vpci.push(NaN); vpcr.push(NaN); continue;
      }
      const vpc = vwmaLP[i] > 0 ? (vwmaSP[i] - vwmaLP[i]) / vwmaLP[i] : 0;
      vpcr.push(vpc);
      const vpr = lmaVol[i] > 0 ? smaVol[i] / lmaVol[i] : 1;
      vpci.push(vpc * vpr);
    }
    return { vpci, vpcr };
  }

  // ═══════════ 10. Anchored VWAP ═══════════

  computeAnchoredVWAP(symbol: string, anchorTimestamp?: number): number[] {
    const bars = this.getData(symbol);
    if (bars.length === 0) return [];
    let anchorIdx = 0;
    if (anchorTimestamp) {
      for (let i = bars.length - 1; i >= 0; i--) {
        if (bars[i].timestamp <= anchorTimestamp) { anchorIdx = i; break; }
      }
    }
    const result: number[] = [];
    let cumPV = 0, cumVol = 0;
    for (let i = 0; i < bars.length; i++) {
      if (i < anchorIdx) { result.push(NaN); continue; }
      const vol = bars[i].volume || 1;
      cumPV += bars[i].close * vol;
      cumVol += vol;
      result.push(cumPV / cumVol);
    }
    return result;
  }

  // ═══════════ 11. Market Facilitation Index (volume-based) ═══════════

  computeMFI(symbol: string, period?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.mfi_period;
    if (bars.length < p) return bars.map(() => NaN);

    const typical = bars.map((b) => (b.high + b.low + b.close) / 3);
    const rawMF: number[] = [NaN];
    for (let i = 1; i < bars.length; i++) {
      const mf = typical[i] * (bars[i].volume || 0);
      rawMF.push(mf);
    }

    const result: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < p) { result.push(NaN); continue; }
      let posSum = 0, negSum = 0;
      for (let j = i - p + 1; j <= i; j++) {
        if (j < 1) continue;
        if (typical[j] > typical[j - 1]) posSum += rawMF[j];
        else if (typical[j] < typical[j - 1]) negSum += rawMF[j];
      }
      result.push(posSum + negSum > 0 ? 100 - 100 / (1 + posSum / Math.max(negSum, 0.0001)) : 50);
    }
    return result;
  }

  // ═══════════ 12. Volume Zone Oscillator ═══════════

  computeVZO(symbol: string, period?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.vzo_period;
    if (bars.length < p + 1) return bars.map(() => NaN);
    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => b.volume || 0);

    const vp: number[] = [0];
    const tv: number[] = [volumes[0]];
    for (let i = 1; i < bars.length; i++) {
      vp.push(closes[i] > closes[i - 1] ? volumes[i] : closes[i] < closes[i - 1] ? -volumes[i] : 0);
      tv.push(volumes[i]);
    }

    const result: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < p - 1) { result.push(NaN); continue; }
      const sumVP = vp.slice(i - p + 1, i + 1).reduce((s, v) => s + v, 0);
      const sumTV = tv.slice(i - p + 1, i + 1).reduce((s, v) => s + v, 0);
      result.push(sumTV > 0 ? (sumVP / sumTV) * 100 : 0);
    }
    return result;
  }

  // ═══════════ 13. Volume Bubble Indicator ═══════════

  computeVolumeBubble(symbol: string, period?: number, threshold?: number): { bubble: number[]; bubbleSignal: ('normal' | 'bubble_warning' | 'bubble')[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.volBubble_period;
    const t = threshold ?? this.config.volBubble_threshold;
    const volumes = bars.map((b) => b.volume || 0);
    const volMA = this._sma(volumes, p);

    const bubble: number[] = [];
    const bubbleSignal: ('normal' | 'bubble_warning' | 'bubble')[] = [];

    for (let i = 0; i < bars.length; i++) {
      if (i < p - 1 || volMA[i] <= 0) { bubble.push(NaN); bubbleSignal.push('normal'); continue; }
      const ratio = volumes[i] / volMA[i];
      bubble.push(ratio);
      if (ratio >= t * 2) bubbleSignal.push('bubble');
      else if (ratio >= t) bubbleSignal.push('bubble_warning');
      else bubbleSignal.push('normal');
    }
    return { bubble, bubbleSignal };
  }

  // ═══════════ 复合扫描 ═══════════

  scanAll(symbol: string) {
    return {
      vwmacd: this.computeVWMACD(symbol),
      volumeOscillator: this.computeVolumeOscillator(symbol),
      adLine: this.computeADLine(symbol),
      emv: this.computeEMV(symbol),
      nvi: this.computeNVI(symbol),
      pvi: this.computePVI(symbol),
      vfi: this.computeVFI(symbol),
      twiggsMF: this.computeTwiggsMF(symbol),
      vpci: this.computeVPCI(symbol),
      anchoredVWAP: this.computeAnchoredVWAP(symbol),
      mfi: this.computeMFI(symbol),
      vzo: this.computeVZO(symbol),
      volumeBubble: this.computeVolumeBubble(symbol),
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

  private _vwap(bars: OHLCVData[], period: number): number[] {
    const r: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < period - 1) { r.push(NaN); continue; }
      let sumPV = 0, sumV = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const v = bars[j].volume || 0;
        sumPV += bars[j].close * v; sumV += v;
      }
      r.push(sumV > 0 ? sumPV / sumV : NaN);
    }
    return r;
  }
}

// ═══════════ Singleton ═══════════

let volume13Instance: Volume13Engine | null = null;

export function getVolume13Engine(config?: Volume13EngineConfig): Volume13Engine {
  if (!volume13Instance) volume13Instance = new Volume13Engine(config);
  return volume13Instance;
}

export function resetVolume13Engine(): void { volume13Instance = null; }
