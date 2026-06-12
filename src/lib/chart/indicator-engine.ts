// ── R113 Indicator Engine — 20 核心指标计算 (纯函数, 无依赖) ──────────
// PM: 模块2 P0, 对标富途80+指标，先做20个核心
// 输入: KlineBar[] + params → 输出: (number|null)[]
// 设计: Web Worker 兼容 (无 DOM/React 依赖)

import type { KlineBar } from './types';

// ═══════════ TREND (4) ═══════════

/** Simple Moving Average */
export function calcSMA(bars: KlineBar[], period: number, field: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4' = 'close'): (number | null)[] {
  const values = bars.map(b => field === 'close' ? b.close : field === 'open' ? b.open : field === 'high' ? b.high : field === 'low' ? b.low : field === 'hl2' ? (b.high + b.low) / 2 : field === 'hlc3' ? (b.high + b.low + b.close) / 3 : (b.open + b.high + b.low + b.close) / 4);
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out.push(+(sum / period).toFixed(8));
  }
  return out;
}

/** Exponential Moving Average */
export function calcEMA(bars: KlineBar[], period: number, field: 'close' | 'open' | 'high' | 'low' = 'close'): (number | null)[] {
  const values = bars.map(b => b[field]);
  const out: (number | null)[] = [];
  const alpha = 2 / (period + 1);
  let ema = values[0];
  out.push(ema);
  for (let i = 1; i < values.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    ema = values[i] * alpha + ema * (1 - alpha);
    out.push(+ema.toFixed(8));
  }
  return out;
}

/** Weighted Moving Average */
export function calcWMA(bars: KlineBar[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let sum = 0, weightSum = 0;
    for (let j = 0; j < period; j++) {
      const w = j + 1;
      sum += bars[i - period + 1 + j].close * w;
      weightSum += w;
    }
    out.push(+(sum / weightSum).toFixed(8));
  }
  return out;
}

/** Bollinger Bands — returns [middle, upper, lower] */
export function calcBOLL(bars: KlineBar[], period = 20, multiplier = 2): [(number | null)[], (number | null)[], (number | null)[]] {
  const middle = calcSMA(bars, period);
  const upper: (number | null)[] = [], lower: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1 || middle[i] == null) { upper.push(null); lower.push(null); continue; }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (bars[j].close - middle[i]!) ** 2;
    const std = Math.sqrt(sumSq / period);
    upper.push(+((middle[i]!) + multiplier * std).toFixed(8));
    lower.push(+((middle[i]!) - multiplier * std).toFixed(8));
  }
  return [middle, upper, lower];
}

// ═══════════ MOMENTUM (5) ═══════════

/** MACD — returns [diff, dea, histogram] */
export function calcMACD(bars: KlineBar[], fast = 12, slow = 26, signal = 9): [(number | null)[], (number | null)[], (number | null)[]] {
  const fastEMA = calcEMA(bars, fast);
  const slowEMA = calcEMA(bars, slow);
  const diff: (number | null)[] = [], dea: (number | null)[] = [], hist: (number | null)[] = [];

  let emaDea = 0; const alpha = 2 / (signal + 1);
  for (let i = 0; i < bars.length; i++) {
    if (fastEMA[i] == null || slowEMA[i] == null) { diff.push(null); dea.push(null); hist.push(null); continue; }
    const d = fastEMA[i]! - slowEMA[i]!;
    diff.push(+d.toFixed(8));
    if (i === slow - 1) { emaDea = d; dea.push(+d.toFixed(8)); hist.push(null); continue; }
    if (i < slow + signal - 2) { dea.push(null); hist.push(null); continue; }
    emaDea = d * alpha + emaDea * (1 - alpha);
    dea.push(+emaDea.toFixed(8));
    hist.push(+((d - emaDea) * 2).toFixed(8));
  }
  return [diff, dea, hist];
}

/** RSI */
export function calcRSI(bars: KlineBar[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) { out.push(null); continue; }
    const chg = bars[i].close - bars[i - 1].close;
    const gain = chg > 0 ? chg : 0, loss = chg < 0 ? -chg : 0;
    if (i < period) {
      avgGain += gain; avgLoss += loss;
      if (i === period - 1) { avgGain /= period; avgLoss /= period; }
      else { out.push(null); continue; }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    if (avgLoss === 0) { out.push(100); continue; }
    out.push(+(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
  }
  return out;
}

/** KDJ — returns [K, D, J] */
export function calcKDJ(bars: KlineBar[], n = 9, m1 = 3, m2 = 3): [(number | null)[], (number | null)[], (number | null)[]] {
  const k: (number | null)[] = [], d: (number | null)[] = [], j: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < n - 1) { k.push(null); d.push(null); j.push(null); continue; }
    const slice = bars.slice(i - n + 1, i + 1);
    const lowMin = Math.min(...slice.map(b => b.low));
    const highMax = Math.max(...slice.map(b => b.high));
    const rsv = highMax === lowMin ? 50 : ((bars[i].close - lowMin) / (highMax - lowMin)) * 100;
    const kPrev = k.length > m1 && k[k.length - 1] != null ? k[k.length - 1]! : 50;
    const kVal = (2 / 3) * kPrev + (1 / 3) * rsv;
    k.push(+kVal.toFixed(2));
    const dPrev = d.length > m2 && d[d.length - 1] != null ? d[d.length - 1]! : 50;
    const dVal = (2 / 3) * dPrev + (1 / 3) * kVal;
    d.push(+dVal.toFixed(2));
    j.push(+(3 * kVal - 2 * dVal).toFixed(2));
  }
  return [k, d, j];
}

/** Williams %R */
export function calcWR(bars: KlineBar[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    const slice = bars.slice(i - period + 1, i + 1);
    const highMax = Math.max(...slice.map(b => b.high));
    const lowMin = Math.min(...slice.map(b => b.low));
    out.push(highMax === lowMin ? 0 : +(((highMax - bars[i].close) / (highMax - lowMin)) * -100).toFixed(2));
  }
  return out;
}

/** CCI (Commodity Channel Index) */
export function calcCCI(bars: KlineBar[], period = 20): (number | null)[] {
  const tp = bars.map(b => (b.high + b.low + b.close) / 3);
  const out: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    const slice = tp.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const mad = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
    out.push(mad === 0 ? 0 : +((tp[i] - mean) / (0.015 * mad)).toFixed(2));
  }
  return out;
}

// ═══════════ VOLATILITY (2) ═══════════

/** Average True Range */
export function calcATR(bars: KlineBar[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  let atr = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) { out.push(null); continue; }
    const tr = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close));
    if (i < period) { atr += tr; if (i === period - 1) atr /= period; else { out.push(null); continue; } }
    else { atr = (atr * (period - 1) + tr) / period; }
    out.push(+atr.toFixed(8));
  }
  return out;
}

/** Standard Deviation */
export function calcStdDev(bars: KlineBar[], period = 20): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    const slice = bars.slice(i - period + 1, i + 1).map(b => b.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    out.push(+(Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period)).toFixed(8));
  }
  return out;
}

// ═══════════ VOLUME (3) ═══════════

/** On-Balance Volume */
export function calcOBV(bars: KlineBar[]): (number | null)[] {
  const out: (number | null)[] = [];
  let obv = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) { out.push(0); continue; }
    if (bars[i].close > bars[i - 1].close) obv += bars[i].volume;
    else if (bars[i].close < bars[i - 1].close) obv -= bars[i].volume;
    out.push(obv);
  }
  return out;
}

/** VWAP (Volume Weighted Average Price) — cumulative */
export function calcVWAP(bars: KlineBar[]): (number | null)[] {
  const out: (number | null)[] = [];
  let cumPV = 0, cumV = 0;
  for (let i = 0; i < bars.length; i++) {
    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3;
    cumPV += tp * bars[i].volume;
    cumV += bars[i].volume;
    out.push(cumV === 0 ? null : +(cumPV / cumV).toFixed(8));
  }
  return out;
}

/** MFI (Money Flow Index) */
export function calcMFI(bars: KlineBar[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let posFlow = 0, negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (bars[j].high + bars[j].low + bars[j].close) / 3;
      const mf = tp * bars[j].volume;
      if (j > i - period + 1 && tp > (bars[j - 1].high + bars[j - 1].low + bars[j - 1].close) / 3) posFlow += mf;
      else negFlow += mf;
    }
    out.push(negFlow === 0 ? 100 : +(100 - 100 / (1 + posFlow / negFlow)).toFixed(2));
  }
  return out;
}

// ═══════════ OVERLAP (2) ═══════════

/** Parabolic SAR */
export function calcSAR(bars: KlineBar[], af = 0.02, maxAf = 0.2): (number | null)[] {
  const out: (number | null)[] = [];
  if (bars.length < 2) { out.push(null); return out; }
  let isUp = bars[1].close > bars[0].close;
  let ep = isUp ? bars[0].high : bars[0].low;
  let sar = isUp ? bars[0].low : bars[0].high;
  let accel = af;
  out.push(null); out.push(sar);
  for (let i = 2; i < bars.length; i++) {
    sar = sar + accel * (ep - sar);
    if (isUp) {
      if (bars[i].low < sar) { isUp = false; sar = ep; ep = bars[i].low; accel = af; }
      else { if (bars[i].high > ep) { ep = bars[i].high; accel = Math.min(accel + af, maxAf); } }
    } else {
      if (bars[i].high > sar) { isUp = true; sar = ep; ep = bars[i].high; accel = af; }
      else { if (bars[i].low < ep) { ep = bars[i].low; accel = Math.min(accel + af, maxAf); } }
    }
    out.push(+sar.toFixed(8));
  }
  return out;
}

/** Ichimoku Cloud — returns [tenkan, kijun, senkouA, senkouB, chikou] */
export function calcIchimoku(bars: KlineBar[], tenkanP = 9, kijunP = 26, senkouBP = 52): [(number | null)[], (number | null)[], (number | null)[], (number | null)[], (number | null)[]] {
  const tenkan: (number | null)[] = [], kijun: (number | null)[] = [], senkouA: (number | null)[] = [], senkouB: (number | null)[] = [], chikou: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i >= tenkanP - 1) { const s = bars.slice(i - tenkanP + 1, i + 1); tenkan.push(+((Math.max(...s.map(b => b.high)) + Math.min(...s.map(b => b.low))) / 2).toFixed(8)); }
    else tenkan.push(null);
    if (i >= kijunP - 1) { const s = bars.slice(i - kijunP + 1, i + 1); kijun.push(+((Math.max(...s.map(b => b.high)) + Math.min(...s.map(b => b.low))) / 2).toFixed(8)); }
    else kijun.push(null);
    if (i >= senkouBP - 1) { const s = bars.slice(i - senkouBP + 1, i + 1); senkouB.push(+((Math.max(...s.map(b => b.high)) + Math.min(...s.map(b => b.low))) / 2).toFixed(8)); }
    else senkouB.push(null);
    senkouA.push(tenkan[i] != null && kijun[i] != null ? +((tenkan[i]! + kijun[i]!) / 2).toFixed(8) : null);
    chikou.push(i >= kijunP ? bars[i - kijunP].close : null);
  }
  return [tenkan, kijun, senkouA, senkouB, chikou];
}

// ═══════════ CUSTOM (3) ═══════════

/** Pivot Points (Standard) — returns [r3, r2, r1, pp, s1, s2, s3] */
export function calcPivot(bars: KlineBar[]): [(number | null)[], (number | null)[], (number | null)[], (number | null)[], (number | null)[], (number | null)[], (number | null)[]] {
  const r3: (number | null)[] = [], r2: (number | null)[] = [], r1: (number | null)[] = [], pp: (number | null)[] = [], s1: (number | null)[] = [], s2: (number | null)[] = [], s3: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < 1) { const a = [r3, r2, r1, pp, s1, s2, s3]; a.forEach(arr => arr.push(null)); continue; }
    const h = bars[i - 1].high, l = bars[i - 1].low, c = bars[i - 1].close;
    const p = (h + l + c) / 3, range = h - l;
    pp.push(+p.toFixed(8));
    r1.push(+(2 * p - l).toFixed(8)); s1.push(+(2 * p - h).toFixed(8));
    r2.push(+(p + range).toFixed(8)); s2.push(+(p - range).toFixed(8));
    r3.push(+(h + 2 * (p - l)).toFixed(8)); s3.push(+(l - 2 * (h - p)).toFixed(8));
  }
  return [r3, r2, r1, pp, s1, s2, s3];
}

/** MA Envelope — returns [upper, middle, lower] */
export function calcMAEnvelope(bars: KlineBar[], period = 20, pct = 3): [(number | null)[], (number | null)[], (number | null)[]] {
  const middle = calcSMA(bars, period);
  const upper = middle.map(v => v == null ? null : +(v * (1 + pct / 100)).toFixed(8));
  const lower = middle.map(v => v == null ? null : +(v * (1 - pct / 100)).toFixed(8));
  return [upper, middle, lower];
}

/** EMA Cross Signal — returns 1 (golden cross), -1 (death cross), 0, null */
export function calcEMACross(bars: KlineBar[], fast = 12, slow = 26): (number | null)[] {
  const fema = calcEMA(bars, fast), sema = calcEMA(bars, slow);
  const out: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (fema[i] == null || sema[i] == null) { out.push(null); continue; }
    if (i === 0) { out.push(0); continue; }
    if (fema[i]! > sema[i]! && (fema[i - 1] == null || sema[i - 1] == null || fema[i - 1]! <= sema[i - 1]!)) out.push(1);
    else if (fema[i]! < sema[i]! && (fema[i - 1] == null || sema[i - 1] == null || fema[i - 1]! >= sema[i - 1]!)) out.push(-1);
    else out.push(0);
  }
  return out;
}

// ═══════════ HELPERS ═══════════

/** Compute all indicators selected in config */
export function computeIndicator(id: string, bars: KlineBar[], params: Record<string, number>): (number | null)[] {
  switch (id) {
    case 'ma': return calcSMA(bars, params.period || 20);
    case 'ema': return calcEMA(bars, params.period || 20);
    case 'wma': return calcWMA(bars, params.period || 20);
    case 'rsi': return calcRSI(bars, params.period || 14);
    case 'wr': return calcWR(bars, params.period || 14);
    case 'cci': return calcCCI(bars, params.period || 20);
    case 'atr': return calcATR(bars, params.period || 14);
    case 'stddev': return calcStdDev(bars, params.period || 20);
    case 'obv': return calcOBV(bars);
    case 'vwap': return calcVWAP(bars);
    case 'mfi': return calcMFI(bars, params.period || 14);
    case 'sar': return calcSAR(bars, params.af || 0.02, params.maxAf || 0.2);
    default: return [];
  }
}

/** Generate MACD series (histogram + 2 lines) */
export function computeMACDSeries(bars: KlineBar[], fast = 12, slow = 26, signal = 9) {
  return calcMACD(bars, fast, slow, signal);
}

/** Generate BOLL series */
export function computeBOLLSeries(bars: KlineBar[], period = 20, mult = 2) {
  return calcBOLL(bars, period, mult);
}

/** Generate KDJ series */
export function computeKDJSeries(bars: KlineBar[], n = 9, m1 = 3, m2 = 3) {
  return calcKDJ(bars, n, m1, m2);
}

/** Generate Ichimoku series */
export function computeIchimokuSeries(bars: KlineBar[]) {
  return calcIchimoku(bars);
}

/** Generate Pivot series */
export function computePivotSeries(bars: KlineBar[]) {
  return calcPivot(bars);
}

/** Generate MA Envelope series */
export function computeEnvelopeSeries(bars: KlineBar[], period = 20, pct = 3) {
  return calcMAEnvelope(bars, period, pct);
}
