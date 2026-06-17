// ── R265 JVS-1 新10指标引擎 (IndicatorExpansion) ──
// 新增10个核心技术指标，对标富途80+/TV 400+，补全DawnWhales指标库
// STOCH / DEMA / AROON / CMO / DPO / ChaikinOsc / BOP / KeltnerChannel / TEMA / ForceIndex
//
// 所有指标纯函数，Worker-compatible，无副作用

export interface OHLCVBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ═══════════════════════════════════════════════════════════════════
// 1. STOCH — Stochastic Oscillator (随机震荡指标)
// %K = (Close - LowestLow_N) / (HighestHigh_N - LowestLow_N) * 100
// %D = SMA(%K, smoothK)
// 超买>80, 超卖<20
// ═══════════════════════════════════════════════════════════════════

export interface STOCHResult {
  k: (number | null)[];
  d: (number | null)[];
}

export function calcSTOCH(
  bars: OHLCVBar[],
  periodK: number = 14,
  periodD: number = 3,
  smoothK: number = 3,
): STOCHResult {
  const n = bars.length;
  const kRaw: (number | null)[] = new Array(n).fill(null);
  const k: (number | null)[] = new Array(n).fill(null);
  const d: (number | null)[] = new Array(n).fill(null);

  // Raw %K
  for (let i = periodK - 1; i < n; i++) {
    let highest = bars[i].high;
    let lowest = bars[i].low;
    for (let j = i - periodK + 1; j <= i; j++) {
      if (bars[j].high > highest) highest = bars[j].high;
      if (bars[j].low < lowest) lowest = bars[j].low;
    }
    const range = highest - lowest;
    kRaw[i] = range === 0 ? 50 : ((bars[i].close - lowest) / range) * 100;
  }

  // Smooth %K (SMA of raw %K)
  for (let i = periodK + smoothK - 2; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - smoothK + 1; j <= i; j++) {
      if (kRaw[j] !== null) {
        sum += kRaw[j]!;
        count++;
      }
    }
    if (count > 0) k[i] = sum / count;
  }

  // %D (SMA of smooth %K)
  for (let i = periodK + smoothK + periodD - 3; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - periodD + 1; j <= i; j++) {
      if (k[j] !== null) {
        sum += k[j]!;
        count++;
      }
    }
    if (count > 0) d[i] = sum / count;
  }

  return { k, d };
}

// ═══════════════════════════════════════════════════════════════════
// 2. DEMA — Double Exponential Moving Average (双指数移动平均)
// DEMA = 2*EMA(price,N) - EMA(EMA(price,N),N)
// 比EMA更快响应趋势变化，滞后更小
// ═══════════════════════════════════════════════════════════════════

export function calcDEMA(values: number[], period: number): (number | null)[] {
  if (period <= 0 || values.length < period * 2) {
    return new Array(values.length).fill(null);
  }
  const ema1 = calcEMAInternal(values, period);
  const ema2 = calcEMAInternal(ema1.filter((v): v is number => v !== null), period);

  // Pad ema2 with nulls to align with original
  const result: (number | null)[] = new Array(values.length).fill(null);
  const offset = values.length - ema2.length;
  for (let i = 0; i < ema2.length; i++) {
    if (ema1[i + offset] !== null && ema2[i] !== null) {
      result[i + offset] = 2 * ema1[i + offset]! - ema2[i]!;
    }
  }
  return result;
}

// ── Internal EMA (returns array same length, null-padded) ──
function calcEMAInternal(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const result: (number | null)[] = new Array(n).fill(null);
  if (n < period) return result;

  const multiplier = 2 / (period + 1);

  // Initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;

  for (let i = period; i < n; i++) {
    result[i] = (values[i] - result[i - 1]!) * multiplier + result[i - 1]!;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 3. TEMA — Triple Exponential Moving Average (三重指数移动平均)
// TEMA = 3*EMA1 - 3*EMA2 + EMA3
// ═══════════════════════════════════════════════════════════════════

export function calcTEMA(values: number[], period: number): (number | null)[] {
  if (period <= 0 || values.length < period * 3) {
    return new Array(values.length).fill(null);
  }
  const ema1 = calcEMAInternal(values, period);
  // EMA of EMA of EMA
  const ema1Clean = ema1.filter((v): v is number => v !== null);
  const ema2 = calcEMAInternal(ema1Clean, period);
  const ema2Clean = ema2.filter((v): v is number => v !== null);
  const ema3 = calcEMAInternal(ema2Clean, period);

  const result: (number | null)[] = new Array(values.length).fill(null);
  const n = ema3.length;
  const offset = values.length - n;
  for (let i = 0; i < n; i++) {
    const idx = i + offset;
    if (ema1[idx] !== null && ema2[i] !== null && ema3[i] !== null) {
      result[idx] = 3 * ema1[idx]! - 3 * ema2[i]! + ema3[i]!;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 4. AROON — Aroon Indicator (阿隆指标)
// AroonUp = ((N - 最高价距今天数) / N) * 100
// AroonDown = ((N - 最低价距今天数) / N) * 100
// AroonOsc = AroonUp - AroonDown
// 趋势强度判断：>70 强趋势，<30 弱趋势
// ═══════════════════════════════════════════════════════════════════

export interface AROONResult {
  up: (number | null)[];
  down: (number | null)[];
  oscillator: (number | null)[];
}

export function calcAROON(bars: OHLCVBar[], period: number = 25): AROONResult {
  const n = bars.length;
  const up: (number | null)[] = new Array(n).fill(null);
  const down: (number | null)[] = new Array(n).fill(null);
  const oscillator: (number | null)[] = new Array(n).fill(null);

  for (let i = period; i < n; i++) {
    let highestIdx = i;
    let lowestIdx = i;
    let highest = bars[i].high;
    let lowest = bars[i].low;

    for (let j = i - period; j <= i; j++) {
      if (bars[j].high > highest) { highest = bars[j].high; highestIdx = j; }
      if (bars[j].low < lowest) { lowest = bars[j].low; lowestIdx = j; }
    }

    const daysSinceHigh = i - highestIdx;
    const daysSinceLow = i - lowestIdx;

    up[i] = ((period - daysSinceHigh) / period) * 100;
    down[i] = ((period - daysSinceLow) / period) * 100;
    oscillator[i] = up[i]! - down[i]!;
  }

  return { up, down, oscillator };
}

// ═══════════════════════════════════════════════════════════════════
// 5. CMO — Chande Momentum Oscillator (钱德动量震荡)
// CMO = 100 * (SumUp - SumDown) / (SumUp + SumDown)
// 类似RSI但更平滑，没有RSI的向上偏差
// ═══════════════════════════════════════════════════════════════════

export function calcCMO(values: number[], period: number = 14): (number | null)[] {
  const n = values.length;
  const result: (number | null)[] = new Array(n).fill(null);

  for (let i = period; i < n; i++) {
    let sumUp = 0;
    let sumDown = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - values[j - 1];
      if (diff > 0) sumUp += diff;
      else sumDown += Math.abs(diff);
    }

    const total = sumUp + sumDown;
    result[i] = total === 0 ? 0 : ((sumUp - sumDown) / total) * 100;
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 6. DPO — Detrended Price Oscillator (去趋势价格震荡)
// DPO = Close - SMA(Close, N/2+1) shifted back N/2+1 periods
// 帮助识别被趋势遮蔽的短期周期
// ═══════════════════════════════════════════════════════════════════

export function calcDPO(values: number[], period: number = 20): (number | null)[] {
  const n = values.length;
  const result: (number | null)[] = new Array(n).fill(null);
  const lookback = Math.floor(period / 2) + 1;

  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += values[j];
    }
    const sma = sum / period;
    const dpoIdx = i - lookback;
    if (dpoIdx >= 0) {
      result[dpoIdx] = values[dpoIdx] - sma;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 7. ChaikinOsc — Chaikin Oscillator (蔡金震荡)
// = EMA(ADL, fast) - EMA(ADL, slow)
// ADL = Accumulation/Distribution Line = Sum(MoneyFlowMultiplier * Volume)
// MoneyFlowMultiplier = ((Close-Low)-(High-Close)) / (High-Low)
// ═══════════════════════════════════════════════════════════════════

export function calcChaikinOsc(
  bars: OHLCVBar[],
  fastPeriod: number = 3,
  slowPeriod: number = 10,
): (number | null)[] {
  const n = bars.length;
  const adl: number[] = new Array(n);
  let runningADL = 0;

  for (let i = 0; i < n; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const c = bars[i].close;
    const v = bars[i].volume;

    const range = h - l;
    let mfm: number;
    if (range === 0) {
      mfm = 0;
    } else {
      mfm = ((c - l) - (h - c)) / range;
    }

    runningADL += mfm * v;
    adl[i] = runningADL;
  }

  const emaFast = calcEMAInternal(adl, fastPeriod);
  const emaSlow = calcEMAInternal(adl, slowPeriod);

  const result: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      result[i] = emaFast[i]! - emaSlow[i]!;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 8. BOP — Balance of Power (力量平衡)
// BOP = (Close - Open) / (High - Low)
// 范围[-1, 1]，正值多头控制，负值空头控制
// ═══════════════════════════════════════════════════════════════════

export function calcBOP(bars: OHLCVBar[]): (number | null)[] {
  return bars.map((bar) => {
    const range = bar.high - bar.low;
    if (range === 0) return 0;
    return (bar.close - bar.open) / range;
  });
}

// 平滑版BOP (SMA of BOP)
export function calcBOPSmoothed(bars: OHLCVBar[], period: number = 14): (number | null)[] {
  const raw = calcBOP(bars);
  const n = raw.length;
  const result: (number | null)[] = new Array(n).fill(null);

  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += raw[j]!;
    }
    result[i] = sum / period;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 9. KeltnerChannel — Keltner Channel (肯特纳通道)
// 中线 = EMA(Close, period)
// 上轨 = 中线 + multiplier * ATR(atrPeriod)
// 下轨 = 中线 - multiplier * ATR(atrPeriod)
// 突破上轨=强势，跌破下轨=弱势
// ═══════════════════════════════════════════════════════════════════

export interface KeltnerChannelResult {
  middle: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
}

export function calcKeltnerChannel(
  bars: OHLCVBar[],
  emaPeriod: number = 20,
  atrPeriod: number = 10,
  multiplier: number = 2,
): KeltnerChannelResult {
  const n = bars.length;
  const closes = bars.map((b) => b.close);

  const middle = calcEMAInternal(closes, emaPeriod);
  const atr = calcATRInternal(bars, atrPeriod);

  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    if (middle[i] !== null && atr[i] !== null) {
      upper[i] = middle[i]! + multiplier * atr[i]!;
      lower[i] = middle[i]! - multiplier * atr[i]!;
    }
  }

  return { middle, upper, lower };
}

// ── Internal ATR (for Keltner) ──
function calcATRInternal(bars: OHLCVBar[], period: number): (number | null)[] {
  const n = bars.length;
  const tr: number[] = new Array(n);
  const result: (number | null)[] = new Array(n).fill(null);

  for (let i = 1; i < n; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const prevC = bars[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
  }

  // Wilder's smoothing for ATR
  if (n > period) {
    let sum = 0;
    for (let i = 1; i <= period; i++) sum += tr[i] || 0;
    result[period] = sum / period;

    for (let i = period + 1; i < n; i++) {
      result[i] = (result[i - 1]! * (period - 1) + tr[i]) / period;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 10. ForceIndex — Force Index (力量指数)
// FI(1) = (Close - PrevClose) * Volume
// FI(N) = EMA(FI(1), N)
// 正值=多头力量，负值=空头力量
// ═══════════════════════════════════════════════════════════════════

export function calcForceIndex(
  bars: OHLCVBar[],
  period: number = 13,
): (number | null)[] {
  const n = bars.length;
  const raw: (number | null)[] = new Array(n).fill(null);

  for (let i = 1; i < n; i++) {
    raw[i] = (bars[i].close - bars[i - 1].close) * bars[i].volume;
  }

  // EMA of raw FI
  const rawClean: number[] = [];
  const rawIdx: number[] = [];
  for (let i = 1; i < n; i++) {
    rawClean.push(raw[i]!);
    rawIdx.push(i);
  }

  const emaFI = calcEMAInternal(rawClean, period);
  const result: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < emaFI.length; i++) {
    const origIdx = rawIdx[i];
    if (emaFI[i] !== null) {
      result[origIdx] = emaFI[i];
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 批量计算入口
// ═══════════════════════════════════════════════════════════════════

export interface ExpandedIndicatorResult {
  stoch?: STOCHResult;
  dema?: { period: number; values: (number | null)[] };
  tema?: { period: number; values: (number | null)[] };
  aroon?: AROONResult;
  cmo?: { period: number; values: (number | null)[] };
  dpo?: { period: number; values: (number | null)[] };
  chaikinOsc?: { fast: number; slow: number; values: (number | null)[] };
  bop?: { values: (number | null)[] };
  bopSmoothed?: { period: number; values: (number | null)[] };
  keltner?: KeltnerChannelResult;
  forceIndex?: { period: number; values: (number | null)[] };
}

export function computeExpandedIndicators(
  bars: OHLCVBar[],
  config: {
    stoch?: boolean | { periodK?: number; periodD?: number; smoothK?: number };
    dema?: boolean | { period?: number };
    tema?: boolean | { period?: number };
    aroon?: boolean | { period?: number };
    cmo?: boolean | { period?: number };
    dpo?: boolean | { period?: number };
    chaikinOsc?: boolean | { fastPeriod?: number; slowPeriod?: number };
    bop?: boolean | { smoothed?: boolean; period?: number };
    keltner?: boolean | { emaPeriod?: number; atrPeriod?: number; multiplier?: number };
    forceIndex?: boolean | { period?: number };
  } = {},
): ExpandedIndicatorResult {
  const result: ExpandedIndicatorResult = {};
  const closes = bars.map((b) => b.close);

  if (config.stoch) {
    const cfg = typeof config.stoch === 'object' ? config.stoch : {};
    result.stoch = calcSTOCH(bars, cfg.periodK ?? 14, cfg.periodD ?? 3, cfg.smoothK ?? 3);
  }

  if (config.dema) {
    const cfg = typeof config.dema === 'object' ? config.dema : {};
    const period = cfg.period ?? 20;
    result.dema = { period, values: calcDEMA(closes, period) };
  }

  if (config.tema) {
    const cfg = typeof config.tema === 'object' ? config.tema : {};
    const period = cfg.period ?? 20;
    result.tema = { period, values: calcTEMA(closes, period) };
  }

  if (config.aroon) {
    const cfg = typeof config.aroon === 'object' ? config.aroon : {};
    result.aroon = calcAROON(bars, cfg.period ?? 25);
  }

  if (config.cmo) {
    const cfg = typeof config.cmo === 'object' ? config.cmo : {};
    const period = cfg.period ?? 14;
    result.cmo = { period, values: calcCMO(closes, period) };
  }

  if (config.dpo) {
    const cfg = typeof config.dpo === 'object' ? config.dpo : {};
    const period = cfg.period ?? 20;
    result.dpo = { period, values: calcDPO(closes, period) };
  }

  if (config.chaikinOsc) {
    const cfg = typeof config.chaikinOsc === 'object' ? config.chaikinOsc : {};
    result.chaikinOsc = {
      fast: cfg.fastPeriod ?? 3,
      slow: cfg.slowPeriod ?? 10,
      values: calcChaikinOsc(bars, cfg.fastPeriod ?? 3, cfg.slowPeriod ?? 10),
    };
  }

  if (config.bop) {
    const cfg = typeof config.bop === 'object' ? config.bop : {};
    result.bop = { values: calcBOP(bars) };
    if (cfg.smoothed) {
      result.bopSmoothed = { period: cfg.period ?? 14, values: calcBOPSmoothed(bars, cfg.period ?? 14) };
    }
  }

  if (config.keltner) {
    const cfg = typeof config.keltner === 'object' ? config.keltner : {};
    result.keltner = calcKeltnerChannel(
      bars,
      cfg.emaPeriod ?? 20,
      cfg.atrPeriod ?? 10,
      cfg.multiplier ?? 2,
    );
  }

  if (config.forceIndex) {
    const cfg = typeof config.forceIndex === 'object' ? config.forceIndex : {};
    const period = cfg.period ?? 13;
    result.forceIndex = { period, values: calcForceIndex(bars, period) };
  }

  return result;
}
