// ── Market Regime Detector ─────────────────────────────────────────────────────
// Q8: Classify market regime using HMM-lite rules + statistical thresholds
// Output: regime label + confidence score + regime history

export type RegimeLabel = 'bull' | 'bear' | 'range' | 'volatile';

export interface RegimeResult {
  regime: RegimeLabel;
  confidence: number;     // 0–1
  vixPercentile: number;   // 0–100
  trendStrength: number;   // 0–1 (ADX-style)
  volatilityRegime: 'low' | 'medium' | 'high';
  reason: string;
  timestamp: number;
}

export interface RegimeHistoryEntry extends RegimeResult {
  symbol?: string;
}

interface Klines {
  close: number[];
  high: number[];
  low: number[];
  open: number[];
  volume?: number[];
  timestamp: number[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sma(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function atr(high: number[], low: number[], close: number[], period = 14): number {
  const n = Math.min(high.length, low.length, close.length);
  if (n < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < n; i++) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
    trs.push(tr);
  }
  if (trs.length < period) return trs[trs.length - 1] ?? 0;
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function stdDev(values: number[], period = 20): number {
  const slice = values.slice(-period);
  if (slice.length < 2) return 0;
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
  return Math.sqrt(variance);
}

function adx(high: number[], low: number[], close: number[], period = 14): number {
  const n = Math.min(high.length, low.length, close.length);
  if (n < period + 1) return 0;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < n; i++) {
    tr.push(Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1])));
    const upMove = high[i] - high[i - 1];
    const downMove = low[i - 1] - low[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const atrVal = atr(high.slice(-n), low.slice(-n), close.slice(-n), period);
  if (atrVal === 0) return 0;

  const smoothPlus = plusDM.slice(-period * 2).reduce((a, b) => a + b, 0) / period;
  const smoothMinus = minusDM.slice(-period * 2).reduce((a, b) => a + b, 0) / period;

  const plusDI = (smoothPlus / atrVal) * 100;
  const minusDI = (smoothMinus / atrVal) * 100;
  const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI + 0.0001)) * 100;

  return Math.min(dx, 100);
}

// ── VIX Percentile ────────────────────────────────────────────────────────────
// Simulated VIX from ATR/volatility (no live feed needed for backtest mode)

function estimateVixPercentile(atrValues: number[], closeValues: number[]): number {
  if (atrValues.length < 60) return 50;
  const recentVol = atrValues.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const histVol = atrValues.reduce((a, b) => a + b, 0) / atrValues.length;
  const ratio = recentVol / (histVol + 0.0001);
  // Map ratio to percentile: ratio > 1.5 → high VIX, ratio < 0.7 → low VIX
  const pct = Math.min(100, Math.max(0, (ratio - 0.5) / 1.5 * 100));
  return Math.round(pct);
}

// ── Main Detection ───────────────────────────────────────────────────────────

export function detectRegime(
  klines: Klines,
  options: { vixLevel?: number } = {}
): RegimeResult {
  const closes = klines.close;
  const highs = klines.high;
  const lows = klines.low;

  if (closes.length < 30) {
    return {
      regime: 'range',
      confidence: 0.3,
      vixPercentile: 50,
      trendStrength: 0,
      volatilityRegime: 'medium',
      reason: 'Insufficient data',
      timestamp: Date.now(),
    };
  }

  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const currentClose = closes[closes.length - 1];

  // Trend strength (ADX)
  const adxVal = adx(highs, lows, closes, 14);
  const trendStrength = adxVal / 100;

  // Volatility
  const atrVal = atr(highs, lows, closes, 14);
  const atrPctOfPrice = (atrVal / currentClose) * 100;
  let volatilityRegime: 'low' | 'medium' | 'high' = 'medium';
  if (atrPctOfPrice < 0.5) volatilityRegime = 'low';
  else if (atrPctOfPrice > 1.5) volatilityRegime = 'high';

  // VIX percentile
  const vixPercentile = options.vixLevel !== undefined
    ? Math.min(100, Math.max(0, options.vixLevel))
    : estimateVixPercentile(
        closes.map((_, i) => atr(highs.slice(0, i + 1), lows.slice(0, i + 1), closes.slice(0, i + 1), 14)),
        closes
      );

  // ── Regime Classification ──────────────────────────────────────────────
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const recentReturn = returns.slice(-20);
  const avgReturn = recentReturn.reduce((a, b) => a + b, 0) / (recentReturn.length || 1);
  const isUptrend = ma20 > ma50 && ma50 > ma200 && currentClose > ma20;
  const isDowntrend = ma20 < ma50 && ma50 < ma200 && currentClose < ma20;
  const volatilityScore = stdDev(returns, 20) * 20; // annualized-ish

  let regime: RegimeLabel;
  let confidence: number;
  let reason: string;

  if (isUptrend && trendStrength > 0.4 && volatilityRegime !== 'high') {
    regime = 'bull';
    confidence = Math.min(0.95, trendStrength * 0.6 + 0.3);
    reason = `Uptrend confirmed: MA20>MA50>MA200, ADX=${(trendStrength * 100).toFixed(0)}, VIX%p=${vixPercentile}`;
  } else if (isDowntrend && trendStrength > 0.4) {
    regime = 'bear';
    confidence = Math.min(0.95, trendStrength * 0.6 + 0.3);
    reason = `Downtrend confirmed: MA20<MA50<MA200, ADX=${(trendStrength * 100).toFixed(0)}, VIX%p=${vixPercentile}`;
  } else if (vixPercentile > 70 && volatilityRegime === 'high') {
    regime = 'volatile';
    confidence = Math.min(0.9, vixPercentile / 100 * 0.7 + 0.2);
    reason = `High volatility: VIX%p=${vixPercentile}, ATR=${atrPctOfPrice.toFixed(2)}%`;
  } else if (trendStrength < 0.25 && volatilityRegime !== 'high') {
    regime = 'range';
    confidence = Math.min(0.85, 0.7 - Math.abs(avgReturn) * 10);
    reason = `Range-bound: ADX=${(trendStrength * 100).toFixed(0)} (weak), VIX%p=${vixPercentile}`;
  } else if (vixPercentile > 70) {
    regime = 'volatile';
    confidence = Math.min(0.8, vixPercentile / 100);
    reason = `Elevated VIX: VIX%p=${vixPercentile}`;
  } else {
    regime = 'range';
    confidence = 0.5;
    reason = `Mixed signals: ADX=${(trendStrength * 100).toFixed(0)}, VIX%p=${vixPercentile}`;
  }

  return {
    regime,
    confidence: Math.round(confidence * 100) / 100,
    vixPercentile,
    trendStrength: Math.round(trendStrength * 100) / 100,
    volatilityRegime,
    reason,
    timestamp: Date.now(),
  };
}

// ── Regime history buffer ─────────────────────────────────────────────────────

export class RegimeHistory {
  private buffer: RegimeHistoryEntry[] = [];
  private maxSize: number;

  constructor(maxSize = 252) {
    this.maxSize = maxSize;
  }

  push(result: RegimeResult, symbol?: string): void {
    this.buffer.push({ ...result, symbol });
    if (this.buffer.length > this.maxSize) this.buffer.shift();
  }

  getLatest(): RegimeResult | null {
    return this.buffer[this.buffer.length - 1] ?? null;
  }

  getHistory(limit?: number): RegimeHistoryEntry[] {
    return limit ? this.buffer.slice(-limit) : [...this.buffer];
  }

  getRegimeDistribution(): Record<RegimeLabel, number> {
    const counts: Record<RegimeLabel, number> = { bull: 0, bear: 0, range: 0, volatile: 0 };
    for (const entry of this.buffer) counts[entry.regime]++;
    const total = this.buffer.length || 1;
    for (const k of Object.keys(counts) as RegimeLabel[]) {
      counts[k] = Math.round((counts[k] / total) * 100);
    }
    return counts;
  }
}

// ── Backtest compatibility: run on klines array ─────────────────────────────────

export function detectRegimeForBacktest(
  klinesArr: { close: number[]; high: number[]; low: number[]; open: number[] }[],
  vixLevels?: number[]
): RegimeResult[] {
  return klinesArr.map((k, i) =>
    detectRegime(k, { vixLevel: vixLevels?.[i] })
  );
}
