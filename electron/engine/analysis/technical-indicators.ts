// 鈹€鈹€ Technical Indicators (JVS-43) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// MA/MACD/RSI/BOLL/KDJ/OBV real-time calculation
// IPC: indicator:compute

import log from 'electron-log';

// 鈹€鈹€ Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface KLine {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MAData {
  period: number;
  values: (number | null)[];
}

export interface MACDData {
  dif: (number | null)[];
  dea: (number | null)[];
  macd: (number | null)[];
}

export interface RSIData {
  period: number;
  values: (number | null)[];
}

export interface BollingerData {
  period: number;
  stdDev: number;
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export interface KDJData {
  k: (number | null)[];
  d: (number | null)[];
  j: (number | null)[];
}

export interface OBVData {
  values: (number | null)[];
}

export interface TechnicalIndicatorsResult {
  success: boolean;
  timestamp: number;
  ma?: MAData[];
  macd?: MACDData;
  rsi?: RSIData[];
  boll?: BollingerData;
  kdj?: KDJData;
  obv?: OBVData;
  error?: string;
}

// 鈹€鈹€ Moving Average 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function calculateMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

// 鈹€鈹€ EMA 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      // First EMA = SMA
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[j];
      result.push(sum / period);
    } else {
      const prev = result[i - 1];
      if (prev !== null) {
        result.push(data[i] * k + prev * (1 - k));
      } else {
        result.push(null);
      }
    }
  }
  return result;
}

// 鈹€鈹€ MACD 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function calculateMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): MACDData {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);

  const dif: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      dif.push(emaFast[i]! - emaSlow[i]!);
    } else {
      dif.push(null);
    }
  }

  // DEA = EMA of DIF
  const difValues = dif.map(v => v ?? 0);
  const dea = calculateEMA(difValues, signal);

  // MACD = 2 * (DIF - DEA)
  const macd: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (dif[i] !== null && dea[i] !== null) {
      macd.push(2 * (dif[i]! - dea[i]!));
    } else {
      macd.push(null);
    }
  }

  return { dif, dea, macd };
}

// 鈹€鈹€ RSI 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      let gains = 0;
      let losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const change = closes[j] - closes[j - 1];
        if (change > 0) gains += change;
        else losses -= change;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    }
  }
  return result;
}

// 鈹€鈹€ Bollinger Bands 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function calculateBollinger(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerData {
  const middle = calculateMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += Math.pow(closes[j] - middle[i]!, 2);
      }
      const std = Math.sqrt(sumSq / period);
      upper.push(middle[i]! + stdDev * std);
      lower.push(middle[i]! - stdDev * std);
    }
  }

  return { period, stdDev, upper, middle, lower };
}

// 鈹€鈹€ KDJ 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function calculateKDJ(
  klines: KLine[],
  period: number = 9,
  kSmooth: number = 3,
  dSmooth: number = 3
): KDJData {
  const k: (number | null)[] = [];
  const d: (number | null)[] = [];
  const j: (number | null)[] = [];

  let prevK = 50;
  let prevD = 50;

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      k.push(null);
      d.push(null);
      j.push(null);
    } else {
      let highest = -Infinity;
      let lowest = Infinity;
      for (let p = i - period + 1; p <= i; p++) {
        if (klines[p].high > highest) highest = klines[p].high;
        if (klines[p].low < lowest) lowest = klines[p].low;
      }
      const rsv = highest === lowest ? 50 : ((klines[i].close - lowest) / (highest - lowest)) * 100;

      const currK = (2 / kSmooth) * prevK + (1 / kSmooth) * rsv;
      const currD = (2 / dSmooth) * prevD + (1 / dSmooth) * currK;
      const currJ = 3 * currK - 2 * currD;

      k.push(currK);
      d.push(currD);
      j.push(currJ);

      prevK = currK;
      prevD = currD;
    }
  }

  return { k, d, j };
}

// 鈹€鈹€ OBV 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function calculateOBV(klines: KLine[]): (number | null)[] {
  const result: (number | null)[] = [];
  let obv = 0;

  for (let i = 0; i < klines.length; i++) {
    if (i === 0) {
      obv = klines[i].volume;
    } else {
      if (klines[i].close > klines[i - 1].close) {
        obv += klines[i].volume;
      } else if (klines[i].close < klines[i - 1].close) {
        obv -= klines[i].volume;
      }
    }
    result.push(obv);
  }

  return result;
}

// 鈹€鈹€ Main Export Function 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export function computeIndicators(
  klines: KLine[],
  indicators: string[] = ['ma', 'macd', 'rsi', 'boll', 'kdj', 'obv'],
  options?: {
    maPeriods?: number[];
    rsiPeriods?: number[];
    macdFast?: number;
    macdSlow?: number;
    macdSignal?: number;
    bollPeriod?: number;
    bollStdDev?: number;
    kdjPeriod?: number;
  }
): TechnicalIndicatorsResult {
  if (!klines || klines.length === 0) {
    return { success: false, timestamp: Date.now(), error: 'No kline data' };
  }

  log.info(`[TechnicalIndicators] Computing ${indicators.join(',')} for ${klines.length} bars`);

  const closes = klines.map(k => k.close);
  const result: TechnicalIndicatorsResult = {
    success: true,
    timestamp: Date.now(),
  };

  const maPeriods = options?.maPeriods || [5, 10, 20, 60];
  const rsiPeriods = options?.rsiPeriods || [6, 12, 24];

  for (const ind of indicators) {
    switch (ind.toLowerCase()) {
      case 'ma':
        result.ma = maPeriods.map(period => ({
          period,
          values: calculateMA(closes, period),
        }));
        break;

      case 'macd':
        result.macd = calculateMACD(
          closes,
          options?.macdFast || 12,
          options?.macdSlow || 26,
          options?.macdSignal || 9
        );
        break;

      case 'rsi':
        result.rsi = rsiPeriods.map(period => ({
          period,
          values: calculateRSI(closes, period),
        }));
        break;

      case 'boll':
      case 'bollinger':
        result.boll = calculateBollinger(
          closes,
          options?.bollPeriod || 20,
          options?.bollStdDev || 2
        );
        break;

      case 'kdj':
        result.kdj = calculateKDJ(klines, options?.kdjPeriod || 9);
        break;

      case 'obv':
        result.obv = { values: calculateOBV(klines) };
        break;
    }
  }

  return result;
}
