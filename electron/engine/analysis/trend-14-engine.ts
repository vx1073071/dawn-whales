// ── R268 JVS-1 趋势14引擎 (Trend14Engine) ──
// 14个趋势指标一站式计算: ALMA/HMA/VIDYA/KAMA/T3/ParabolicSAR/SuperTrend/ZigZag/
// PivotPoints(Standard/Fibonacci/Woodie/Camarilla)/IchimokuCloud/MassIndex/BIAS/CORA/
// RainbowMA/Fractal

export interface OHLCVData {
  timestamp: number; open: number; high: number; low: number; close: number; volume?: number;
}

export interface IchimokuResult {
  timestamp: number; tenkanSen?: number; kijunSen?: number; senkouSpanA?: number;
  senkouSpanB?: number; chikouSpan?: number; cloudColor?: 'green' | 'red';
}

export interface PivotPointsResult {
  pp: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number;
  type: 'standard' | 'fibonacci' | 'woodie' | 'camarilla';
}

export interface Trend14EngineConfig {
  almaPeriod?: number; almaOffset?: number; almaSigma?: number;
  hmaPeriod?: number;
  vidyaPeriod?: number; vidyaR2Scale?: number;
  kamaPeriod?: number; kamaFast?: number; kamaSlow?: number;
  t3Period?: number; t3VolumeFactor?: number;
  psarAcceleration?: number; psarMaxAccel?: number;
  supertrendPeriod?: number; supertrendMultiplier?: number;
  zigzagThreshold?: number; zigzagDepth?: number;
  ichimokuTenkan?: number; ichimokuKijun?: number; ichimokuSenkouB?: number;
  massPeriod?: number; massSumPeriod?: number;
  rainbowPeriods?: number[];
  fractalWindow?: number;
}

export const DEFAULT_TREND_CONFIG: Required<Trend14EngineConfig> = {
  almaPeriod: 9, almaOffset: 0.85, almaSigma: 6,
  hmaPeriod: 16,
  vidyaPeriod: 20, vidyaR2Scale: 0.5,
  kamaPeriod: 10, kamaFast: 2, kamaSlow: 30,
  t3Period: 14, t3VolumeFactor: 0.7,
  psarAcceleration: 0.02, psarMaxAccel: 0.2,
  supertrendPeriod: 10, supertrendMultiplier: 3,
  zigzagThreshold: 5, zigzagDepth: 12,
  ichimokuTenkan: 9, ichimokuKijun: 26, ichimokuSenkouB: 52,
  massPeriod: 9, massSumPeriod: 25,
  rainbowPeriods: [2, 4, 6, 8, 10, 12, 14, 16, 18],
  fractalWindow: 2,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class Trend14Engine {
  private config: Required<Trend14EngineConfig>;
  private data: Map<string, OHLCVData[]> = new Map();
  private cache: Map<string, Record<string, unknown>> = new Map();

  constructor(config?: Trend14EngineConfig) {
    this.config = { ...DEFAULT_TREND_CONFIG, ...config };
  }

  reset(): void { this.data.clear(); this.cache.clear(); }

  updateConfig(patch: Partial<Trend14EngineConfig>): void {
    this.config = { ...this.config, ...patch }; this.cache.clear();
  }

  getConfig(): Required<Trend14EngineConfig> { return { ...this.config }; }

  loadData(symbol: string, bars: OHLCVData[]): void {
    this.data.set(symbol.toUpperCase(), bars);
    this.cache.delete(symbol.toUpperCase());
  }

  getData(symbol: string): OHLCVData[] {
    return this.data.get(symbol.toUpperCase()) || [];
  }

  // ═══════════ 1. ALMA ═══════════

  computeALMA(symbol: string, period?: number, offset?: number, sigma?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.almaPeriod;
    const off = offset ?? this.config.almaOffset;
    const sig = sigma ?? this.config.almaSigma;
    if (bars.length < p) return bars.map(() => NaN);

    const result: number[] = [];
    const m = Math.floor(off * (p - 1));
    const s = p / sig;
    const weights: number[] = [];
    let wSum = 0;
    for (let i = 0; i < p; i++) {
      const w = Math.exp(-(((i - m) * (i - m)) / (2 * s * s)));
      weights.push(w);
      wSum += w;
    }

    for (let i = 0; i < bars.length; i++) {
      if (i < p - 1) { result.push(NaN); continue; }
      let sum = 0;
      for (let j = 0; j < p; j++) sum += bars[i - (p - 1) + j].close * weights[j];
      result.push(sum / wSum);
    }
    return result;
  }

  // ═══════════ 2. HMA ═══════════

  computeHMA(symbol: string, period?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.hmaPeriod;
    if (bars.length < p) return bars.map(() => NaN);

    const halfLen = Math.floor(p / 2);
    const sqrtLen = Math.ceil(Math.sqrt(p));
    const wmaHalf = this._wma(bars, halfLen);
    const wmaFull = this._wma(bars, p);
    const diff: number[] = wmaHalf.map((v, i) => (v !== null && wmaFull[i] !== null) ? 2 * v - wmaFull[i]! : NaN);
    return this._wmaValues(diff, sqrtLen).map((v) => (v !== null ? v : NaN));
  }

  // ═══════════ 3. VIDYA ═══════════

  computeVIDYA(symbol: string, period?: number, r2Scale?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.vidyaPeriod;
    const scale = r2Scale ?? this.config.vidyaR2Scale;
    if (bars.length < p) return bars.map(() => NaN);

    const result: number[] = [];
    let vidya = NaN;
    for (let i = 0; i < bars.length; i++) {
      if (i < p) { result.push(NaN); continue; }
      const closes = bars.slice(i - p + 1, i + 1).map((b) => b.close);
      const cmo = this._cmo(closes, p);
      const alpha = scale * (cmo / 100);
      if (isNaN(vidya)) vidya = bars[i].close;
      vidya = alpha * bars[i].close + (1 - alpha) * vidya;
      result.push(vidya);
    }
    return result;
  }

  // ═══════════ 4. KAMA ═══════════

  computeKAMA(symbol: string, period?: number, fastPeriod?: number, slowPeriod?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.kamaPeriod;
    const fast = fastPeriod ?? this.config.kamaFast;
    const slow = slowPeriod ?? this.config.kamaSlow;
    if (bars.length < p) return bars.map(() => NaN);

    const fastSC = 2 / (fast + 1);
    const slowSC = 2 / (slow + 1);
    const result: number[] = [];
    let kama = NaN;

    for (let i = 0; i < bars.length; i++) {
      if (i < p) { result.push(NaN); continue; }
      let sumAbs = 0;
      for (let j = i - p + 1; j <= i; j++) sumAbs += Math.abs(bars[j].close - bars[j - 1].close);
      const change = Math.abs(bars[i].close - bars[i - p].close);
      const er = sumAbs > 0 ? change / sumAbs : 0;
      const sc = er * (fastSC - slowSC) + slowSC;
      if (isNaN(kama)) kama = bars[i].close;
      kama = kama + sc * sc * (bars[i].close - kama);
      result.push(kama);
    }
    return result;
  }

  // ═══════════ 5. T3 ═══════════

  computeT3(symbol: string, period?: number, volumeFactor?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.t3Period;
    const vf = volumeFactor ?? this.config.t3VolumeFactor;
    if (bars.length < p * 5) return bars.map(() => NaN);

    const closes = bars.map((b) => b.close);
    const e1 = this._ema(closes, p);
    const e2 = this._ema(e1.filter((v) => isFinite(v)), p);
    const e3 = this._ema(e2.filter((v) => isFinite(v)), p);
    const e4 = this._ema(e3.filter((v) => isFinite(v)), p);
    const e5 = this._ema(e4.filter((v) => isFinite(v)), p);
    const e6 = this._ema(e5.filter((v) => isFinite(v)), p);

    const result: number[] = [];
    const pad = bars.length - e6.length;
    for (let i = 0; i < pad; i++) result.push(NaN);

    const c1 = -vf * vf * vf;
    const c2 = 3 * vf * vf + 3 * vf * vf * vf;
    const c3 = -6 * vf * vf - 3 * vf - 3 * vf * vf * vf;
    const c4 = 1 + 3 * vf + vf * vf * vf + 3 * vf * vf;

    for (let i = 0; i < e6.length; i++) {
      result.push(c1 * e1[pad + i] + c2 * e2[pad + i] + c3 * e3[pad + i] + c4 * e4[pad + i]);
    }
    return result;
  }

  // ═══════════ 6. Parabolic SAR ═══════════

  computePSAR(symbol: string, acceleration?: number, maxAccel?: number): { sar: number[]; trend: ('up' | 'down')[] } {
    const bars = this.getData(symbol);
    const afStart = acceleration ?? this.config.psarAcceleration;
    const afMax = maxAccel ?? this.config.psarMaxAccel;
    if (bars.length < 2) return { sar: bars.map(() => NaN), trend: [] };

    const sar: number[] = [NaN];
    const trend: ('up' | 'down')[] = ['up'];
    let psar = bars[0].low;
    let ep = bars[0].high;
    let af = afStart;
    let isUp = true;

    for (let i = 1; i < bars.length; i++) {
      if (isUp) {
        psar = Math.min(psar + af * (ep - psar), bars[i - 1].low);
        if (bars[i].low < psar) { isUp = false; af = afStart; psar = ep; ep = bars[i].low; }
        else { if (bars[i].high > ep) { ep = bars[i].high; af = Math.min(af + afStart, afMax); } }
      } else {
        psar = Math.max(psar - af * (psar - ep), bars[i - 1].high);
        if (bars[i].high > psar) { isUp = true; af = afStart; psar = ep; ep = bars[i].high; }
        else { if (bars[i].low < ep) { ep = bars[i].low; af = Math.min(af + afStart, afMax); } }
      }
      sar.push(parseFloat(psar.toFixed(4)));
      trend.push(isUp ? 'up' : 'down');
    }
    return { sar, trend };
  }

  // ═══════════ 7. SuperTrend ═══════════

  computeSuperTrend(symbol: string, period?: number, multiplier?: number): { supertrend: number[]; direction: ('up' | 'down')[] } {
    const bars = this.getData(symbol);
    const p = period || this.config.supertrendPeriod;
    const mult = multiplier ?? this.config.supertrendMultiplier;
    if (bars.length < p) return { supertrend: bars.map(() => NaN), direction: [] };

    const atr = this._atr(bars, p);
    const hl2 = bars.map((b) => (b.high + b.low) / 2);
    const result: number[] = [];
    const direction: ('up' | 'down')[] = [];

    let upperBand = NaN, lowerBand = NaN, prevDir: 'up' | 'down' = 'down';
    for (let i = 0; i < bars.length; i++) {
      if (i < p - 1 || isNaN(atr[i])) { result.push(NaN); direction.push('down'); continue; }

      const mid = hl2[i];
      const ub = mid + mult * atr[i];
      const lb = mid - mult * atr[i];

      upperBand = (i === p - 1 || ub > upperBand || bars[i - 1].close > upperBand) ? ub : upperBand;
      lowerBand = (i === p - 1 || lb < lowerBand || bars[i - 1].close < lowerBand) ? lb : lowerBand;

      if (bars[i].close > upperBand) prevDir = 'up';
      else if (bars[i].close < lowerBand) prevDir = 'down';

      direction.push(prevDir);
      result.push(prevDir === 'up' ? lowerBand : upperBand);
    }
    return { supertrend: result, direction };
  }

  // ═══════════ 8. ZigZag ═══════════

  computeZigZag(symbol: string, threshold?: number, depth?: number): { points: { index: number; price: number; type: 'high' | 'low' }[] } {
    const bars = this.getData(symbol);
    const thresh = (threshold ?? this.config.zigzagThreshold) / 100;
    const d = depth ?? this.config.zigzagDepth;

    const points: { index: number; price: number; type: 'high' | 'low' }[] = [];
    let lastType: 'high' | 'low' | null = null;
    let lastPrice = 0;

    for (let i = d; i < bars.length - d; i++) {
      const bar = bars[i];
      const isHigh = bars.slice(i - d, i + d + 1).every((b) => b.high <= bar.high);
      const isLow = bars.slice(i - d, i + d + 1).every((b) => b.low >= bar.low);

      if (isHigh && lastType !== 'high') {
        if (lastPrice > 0 && Math.abs(bar.high - lastPrice) / lastPrice < thresh) continue;
        points.push({ index: i, price: bar.high, type: 'high' });
        lastType = 'high'; lastPrice = bar.high;
      } else if (isLow && lastType !== 'low') {
        if (lastPrice > 0 && Math.abs(bar.low - lastPrice) / lastPrice < thresh) continue;
        points.push({ index: i, price: bar.low, type: 'low' });
        lastType = 'low'; lastPrice = bar.low;
      }
    }
    return { points };
  }

  // ═══════════ 9. Pivot Points ═══════════

  computePivotPoints(prevHigh: number, prevLow: number, prevClose: number, type: PivotPointsResult['type'] = 'standard'): PivotPointsResult {
    const pp = (prevHigh + prevLow + prevClose) / 3;
    if (type === 'fibonacci') {
      const r = prevHigh - prevLow;
      return { pp, r1: pp + 0.382 * r, r2: pp + 0.618 * r, r3: pp + r, s1: pp - 0.382 * r, s2: pp - 0.618 * r, s3: pp - r, type };
    }
    if (type === 'woodie') {
      const ppW = (prevHigh + prevLow + 2 * prevClose) / 4;
      const r = prevHigh - prevLow;
      return { pp: ppW, r1: 2 * ppW - prevLow, r2: ppW + r, r3: prevHigh + 2 * (ppW - prevLow), s1: 2 * ppW - prevHigh, s2: ppW - r, s3: prevLow - 2 * (prevHigh - ppW), type };
    }
    if (type === 'camarilla') {
      const r = prevHigh - prevLow;
      return { pp, r1: prevClose + r * 1.1 / 12, r2: prevClose + r * 1.1 / 6, r3: prevClose + r * 1.1 / 4, s1: prevClose - r * 1.1 / 12, s2: prevClose - r * 1.1 / 6, s3: prevClose - r * 1.1 / 4, type };
    }
    return { pp, r1: 2 * pp - prevLow, r2: pp + (prevHigh - prevLow), r3: prevHigh + 2 * (pp - prevLow), s1: 2 * pp - prevHigh, s2: pp - (prevHigh - prevLow), s3: prevLow - 2 * (prevHigh - pp), type: 'standard' };
  }

  computePivotLevels(symbol: string): PivotPointsResult[] {
    const bars = this.getData(symbol);
    if (bars.length < 2) return [];
    const prev = bars[bars.length - 2];
    return ['standard', 'fibonacci', 'woodie', 'camarilla'].map((t) =>
      this.computePivotPoints(prev.high, prev.low, prev.close, t as PivotPointsResult['type']));
  }

  // ═══════════ 10. Ichimoku Cloud ═══════════

  computeIchimoku(symbol: string, tenkan?: number, kijun?: number, senkouB?: number): IchimokuResult[] {
    const bars = this.getData(symbol);
    const tp = tenkan || this.config.ichimokuTenkan;
    const kp = kijun || this.config.ichimokuKijun;
    const sb = senkouB || this.config.ichimokuSenkouB;
    const results: IchimokuResult[] = bars.map((b) => ({ timestamp: b.timestamp }));

    for (let i = 0; i < bars.length; i++) {
      const r = results[i];
      if (i >= tp - 1) {
        const s = bars.slice(i - tp + 1, i + 1);
        r.tenkanSen = (Math.max(...s.map((b) => b.high)) + Math.min(...s.map((b) => b.low))) / 2;
      }
      if (i >= kp - 1) {
        const s = bars.slice(i - kp + 1, i + 1);
        r.kijunSen = (Math.max(...s.map((b) => b.high)) + Math.min(...s.map((b) => b.low))) / 2;
      }
      if (i >= sb - 1) {
        const s = bars.slice(i - sb + 1, i + 1);
        const sB = (Math.max(...s.map((b) => b.high)) + Math.min(...s.map((b) => b.low))) / 2;
        const target = i + kp;
        if (target < results.length) results[target].senkouSpanB = sB;
      }
      if (i - kp >= 0 && i - kp < results.length) results[i - kp].chikouSpan = bars[i].close;
    }
    for (let i = 0; i < results.length; i++) {
      if (i + kp < results.length && results[i].tenkanSen != null && results[i].kijunSen != null) {
        results[i + kp].senkouSpanA = (results[i].tenkanSen! + results[i].kijunSen!) / 2;
      }
      const a = results[i].senkouSpanA ?? 0;
      const b = results[i].senkouSpanB ?? 0;
      results[i].cloudColor = a > b ? 'green' : b > a ? 'red' : undefined;
    }
    return results;
  }

  // ═══════════ 11. Mass Index ═══════════

  computeMassIndex(symbol: string, period?: number, sumPeriod?: number): number[] {
    const bars = this.getData(symbol);
    const p = period || this.config.massPeriod;
    const sp = sumPeriod || this.config.massSumPeriod;
    if (bars.length < p + 9) return bars.map(() => NaN);

    const high = bars.map((b) => b.high);
    const low = bars.map((b) => b.low);
    const range = high.map((h, i) => Math.log(Math.max(h - low[i], 0.0001)));

    const e1 = this._ema(range, p);
    const e2 = this._ema(e1.filter((v) => isFinite(v)), p);
    const pad = bars.length - e2.length;

    const ratios: number[] = [];
    for (let i = 0; i < e2.length; i++) {
      const a = e1[pad + i]; const b = e2[i];
      ratios.push((b !== 0 && isFinite(a) && isFinite(b)) ? a / b : 1);
    }

    const result: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < pad + sp - 1) { result.push(NaN); continue; }
      const idx = i - pad;
      let sum = 0;
      for (let j = Math.max(0, idx - sp + 1); j <= idx; j++) sum += ratios[j] || 0;
      result.push(sum);
    }
    return result;
  }

  // ═══════════ 12. BIAS ═══════════

  computeBIAS(symbol: string): { bias6: number[]; bias12: number[]; bias24: number[] } {
    const bars = this.getData(symbol);
    const ma6 = this._sma(bars.map((b) => b.close), 6);
    const ma12 = this._sma(bars.map((b) => b.close), 12);
    const ma24 = this._sma(bars.map((b) => b.close), 24);
    const bias = (ma: number[]) =>
      bars.map((b, i) => (ma[i] && isFinite(ma[i]) && ma[i] !== 0 ? ((b.close - ma[i]) / ma[i]) * 100 : NaN));
    return { bias6: bias(ma6), bias12: bias(ma12), bias24: bias(ma24) };
  }

  // ═══════════ 13. Rainbow MA ═══════════

  computeRainbowMA(symbol: string, periods?: number[]): Record<string, number[]> {
    const bars = this.getData(symbol);
    const per = periods || this.config.rainbowPeriods;
    const result: Record<string, number[]> = {};
    const closes = bars.map((b) => b.close);
    for (const p of per) {
      result[`ema${p}`] = this._ema(closes, p);
    }
    return result;
  }

  // ═══════════ 14. Fractal ═══════════

  computeFractals(symbol: string, window?: number): { up: { index: number; price: number }[]; down: { index: number; price: number }[] } {
    const bars = this.getData(symbol);
    const w = window || this.config.fractalWindow;
    const up: { index: number; price: number }[] = [];
    const down: { index: number; price: number }[] = [];
    for (let i = w; i < bars.length - w; i++) {
      let isUp = true, isDown = true;
      for (let j = i - w; j <= i + w; j++) {
        if (j === i) continue;
        if (bars[j].high >= bars[i].high) isUp = false;
        if (bars[j].low <= bars[i].low) isDown = false;
      }
      if (isUp) up.push({ index: i, price: bars[i].high });
      if (isDown) down.push({ index: i, price: bars[i].low });
    }
    return { up, down };
  }

  // ═══════════ 复合扫描 ═══════════

  scanAll(symbol: string) {
    return {
      alma: this.computeALMA(symbol), hma: this.computeHMA(symbol),
      vidya: this.computeVIDYA(symbol), kama: this.computeKAMA(symbol),
      t3: this.computeT3(symbol), psar: this.computePSAR(symbol),
      supertrend: this.computeSuperTrend(symbol), zigzag: this.computeZigZag(symbol),
      pivotPoints: this.computePivotLevels(symbol),
      ichimoku: this.computeIchimoku(symbol),
      massIndex: this.computeMassIndex(symbol),
      bias: this.computeBIAS(symbol),
      rainbowMA: this.computeRainbowMA(symbol),
      fractals: this.computeFractals(symbol),
    };
  }

  // ═══════════ Internal helpers ═══════════

  private _sma(values: number[], period: number): number[] {
    const r: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) { r.push(NaN); continue; }
      let sum = 0; for (let j = i - period + 1; j <= i; j++) sum += values[j];
      r.push(sum / period);
    }
    return r;
  }

  private _ema(values: number[], period: number): number[] {
    const r: number[] = [NaN];
    const k = 2 / (period + 1);
    let ema = values[0] || 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] == null) { r.push(NaN); continue; }
      if (isNaN(ema)) ema = values[i - 1] || values[i];
      ema = values[i] * k + ema * (1 - k);
      r.push(ema);
    }
    return r;
  }

  private _wma(bars: OHLCVData[], period: number): (number | null)[] {
    const r: (number | null)[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < period - 1) { r.push(null); continue; }
      let sum = 0, ws = 0;
      for (let j = 0; j < period; j++) { sum += bars[i - (period - 1) + j].close * (j + 1); ws += j + 1; }
      r.push(sum / ws);
    }
    return r;
  }

  private _wmaValues(values: (number | null)[], period: number): (number | null)[] {
    const r: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) { r.push(null); continue; }
      let sum = 0, ws = 0, valid = true;
      for (let j = 0; j < period; j++) {
        const v = values[i - (period - 1) + j];
        if (v == null) { valid = false; break; }
        sum += v * (j + 1); ws += j + 1;
      }
      r.push(valid ? sum / ws : null);
    }
    return r;
  }

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

  private _cmo(closes: number[], period: number): number {
    let upSum = 0, downSum = 0;
    for (let i = 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) upSum += diff; else downSum -= diff;
    }
    return upSum + downSum > 0 ? ((upSum - downSum) / (upSum + downSum)) * 100 : 0;
  }
}

// ═══════════ Singleton ═══════════

let trend14Instance: Trend14Engine | null = null;

export function getTrend14Engine(config?: Trend14EngineConfig): Trend14Engine {
  if (!trend14Instance) trend14Instance = new Trend14Engine(config);
  return trend14Instance;
}

export function resetTrend14Engine(): void { trend14Instance = null; }
