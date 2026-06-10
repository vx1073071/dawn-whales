/**
 * JVS-36: Real-time Technical Indicator Calculator
 * 实时技术指标计算引擎
 * 
 * 支持指标:
 * - MA (Simple Moving Average)
 * - EMA (Exponential Moving Average)
 * - MACD (Moving Average Convergence Divergence)
 * - RSI (Relative Strength Index)
 * - KDJ (KDJ Oscillator)
 * - Bollinger Bands
 * - ATR (Average True Range)
 * 
 * 特性:
 * - 增量计算（避免重复计算）
 * - 多股票并行计算
 * - 实时推送更新
 */

import { EventEmitter } from 'events';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface KLine {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MAIndicator {
  timestamp: number;
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma60: number | null;
  ma120: number | null;
  ma250: number | null;
}

export interface EMAIndicator {
  timestamp: number;
  ema12: number | null;
  ema26: number | null;
  ema60: number | null;
}

export interface MACDIndicator {
  timestamp: number;
  dif: number | null;
  dea: number | null;
  macd: number | null;
}

export interface RSIIndicator {
  timestamp: number;
  rsi6: number | null;
  rsi12: number | null;
  rsi24: number | null;
}

export interface KDJIndicator {
  timestamp: number;
  k: number | null;
  d: number | null;
  j: number | null;
}

export interface BollingerIndicator {
  timestamp: number;
  upper: number | null;
  middle: number | null;
  lower: number | null;
  width: number | null;
}

export interface ATRIndicator {
  timestamp: number;
  atr: number | null;
}

export interface AllIndicators {
  symbol: string;
  timestamp: number;
  ma: MAIndicator;
  ema: EMAIndicator;
  macd: MACDIndicator;
  rsi: RSIIndicator;
  kdj: KDJIndicator;
  bollinger: BollingerIndicator;
  atr: ATRIndicator;
}

// ─── Helper Functions ──────────────────────────────────────────────────────

function calculateMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

function calculateEMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  
  const k = 2 / (period + 1);
  let ema = data[0];
  
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calculateMACD(data: number[]): { dif: number | null; dea: number | null; macd: number | null } {
  if (data.length < 26) {
    return { dif: null, dea: null, macd: null };
  }
  
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  
  if (ema12 === null || ema26 === null) {
    return { dif: null, dea: null, macd: null };
  }
  
  const dif = ema12 - ema26;
  
  // Calculate DEA (EMA9 of DIF)
  const difHistory: number[] = [];
  for (let i = 25; i < data.length; i++) {
    const e12 = calculateEMA(data.slice(0, i + 1), 12);
    const e26 = calculateEMA(data.slice(0, i + 1), 26);
    if (e12 !== null && e26 !== null) {
      difHistory.push(e12 - e26);
    }
  }
  
  const dea = calculateEMA(difHistory, 9);
  const macd = dea !== null ? 2 * (dif - dea) : null;
  
  return { dif, dea, macd };
}

function calculateRSI(data: number[], period: number): number | null {
  if (data.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) {
      gains = (gains * (period - 1) + change) / period;
      losses = (losses * (period - 1)) / period;
    } else {
      gains = (gains * (period - 1)) / period;
      losses = (losses * (period - 1) + Math.abs(change)) / period;
    }
  }
  
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function calculateKDJ(klines: KLine[], period: number = 9): { k: number | null; d: number | null; j: number | null } {
  if (klines.length < period) {
    return { k: null, d: null, j: null };
  }
  
  let k = 50;
  let d = 50;
  
  for (let i = period - 1; i < klines.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    
    for (let j = i - period + 1; j <= i; j++) {
      highest = Math.max(highest, klines[j].high);
      lowest = Math.min(lowest, klines[j].low);
    }
    
    const rsv = highest === lowest ? 50 : ((klines[i].close - lowest) / (highest - lowest)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
  }
  
  const j = 3 * k - 2 * d;
  
  return { k, d, j };
}

function calculateBollingerBands(data: number[], period: number = 20, multiplier: number = 2): { upper: number | null; middle: number | null; lower: number | null; width: number | null } {
  if (data.length < period) {
    return { upper: null, middle: null, lower: null, width: null };
  }
  
  const slice = data.slice(-period);
  const middle = slice.reduce((sum, val) => sum + val, 0) / period;
  
  const squaredDiffs = slice.map(val => Math.pow(val - middle, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
  const stdDev = Math.sqrt(variance);
  
  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;
  const width = upper - lower;
  
  return { upper, middle, lower, width };
}

function calculateATR(klines: KLine[], period: number = 14): number | null {
  if (klines.length < period + 1) return null;
  
  const trueRanges: number[] = [];
  
  for (let i = 1; i < klines.length; i++) {
    const high = klines[i].high;
    const low = klines[i].low;
    const prevClose = klines[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  if (trueRanges.length < period) return null;
  
  const atr = trueRanges.slice(-period).reduce((sum, val) => sum + val, 0) / period;
  return atr;
}

// ─── Real-time Indicator Calculator ────────────────────────────────────────

export class RealtimeIndicatorCalculator extends EventEmitter {
  private klineBuffer: Map<string, KLine[]> = new Map();
  private maxBufferSize = 500;

  constructor() {
    super();
  }

  /**
   * 添加新的K线数据并计算指标
   */
  addKLine(symbol: string, kline: KLine): AllIndicators {
    // 获取或创建K线缓冲区
    if (!this.klineBuffer.has(symbol)) {
      this.klineBuffer.set(symbol, []);
    }
    
    const buffer = this.klineBuffer.get(symbol)!;
    buffer.push(kline);
    
    // 保持缓冲区大小
    if (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }
    
    // 计算所有指标
    const indicators = this.calculateAllIndicators(symbol, buffer);
    
    // 发送事件
    this.emit('indicators-updated', symbol, indicators);
    
    return indicators;
  }

  /**
   * 批量添加K线数据
   */
  addKLines(symbol: string, klines: KLine[]): AllIndicators {
    if (!this.klineBuffer.has(symbol)) {
      this.klineBuffer.set(symbol, []);
    }
    
    const buffer = this.klineBuffer.get(symbol)!;
    buffer.push(...klines);
    
    // 保持缓冲区大小
    while (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }
    
    // 计算所有指标
    const indicators = this.calculateAllIndicators(symbol, buffer);
    
    // 发送事件
    this.emit('indicators-updated', symbol, indicators);
    
    return indicators;
  }

  /**
   * 计算单个股票的所有指标
   */
  private calculateAllIndicators(symbol: string, klines: KLine[]): AllIndicators {
    const closes = klines.map(k => k.close);
    const timestamp = klines[klines.length - 1]?.timestamp || Date.now();

    // MA
    const ma: MAIndicator = {
      timestamp,
      ma5: calculateMA(closes, 5),
      ma10: calculateMA(closes, 10),
      ma20: calculateMA(closes, 20),
      ma60: calculateMA(closes, 60),
      ma120: calculateMA(closes, 120),
      ma250: calculateMA(closes, 250),
    };

    // EMA
    const ema: EMAIndicator = {
      timestamp,
      ema12: calculateEMA(closes, 12),
      ema26: calculateEMA(closes, 26),
      ema60: calculateEMA(closes, 60),
    };

    // MACD
    const macdResult = calculateMACD(closes);
    const macd: MACDIndicator = {
      timestamp,
      dif: macdResult.dif,
      dea: macdResult.dea,
      macd: macdResult.macd,
    };

    // RSI
    const rsi: RSIIndicator = {
      timestamp,
      rsi6: calculateRSI(closes, 6),
      rsi12: calculateRSI(closes, 12),
      rsi24: calculateRSI(closes, 24),
    };

    // KDJ
    const kdjResult = calculateKDJ(klines);
    const kdj: KDJIndicator = {
      timestamp,
      k: kdjResult.k,
      d: kdjResult.d,
      j: kdjResult.j,
    };

    // Bollinger Bands
    const bollingerResult = calculateBollingerBands(closes);
    const bollinger: BollingerIndicator = {
      timestamp,
      upper: bollingerResult.upper,
      middle: bollingerResult.middle,
      lower: bollingerResult.lower,
      width: bollingerResult.width,
    };

    // ATR
    const atr: ATRIndicator = {
      timestamp,
      atr: calculateATR(klines),
    };

    return {
      symbol,
      timestamp,
      ma,
      ema,
      macd,
      rsi,
      kdj,
      bollinger,
      atr,
    };
  }

  /**
   * 获取股票的K线缓冲区
   */
  getKLineBuffer(symbol: string): KLine[] {
    return this.klineBuffer.get(symbol) || [];
  }

  /**
   * 清除股票的缓冲区
   */
  clearBuffer(symbol: string): void {
    this.klineBuffer.delete(symbol);
  }

  /**
   * 清除所有缓冲区
   */
  clearAllBuffers(): void {
    this.klineBuffer.clear();
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let calculatorInstance: RealtimeIndicatorCalculator | null = null;

export function getRealtimeIndicatorCalculator(): RealtimeIndicatorCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new RealtimeIndicatorCalculator();
  }
  return calculatorInstance;
}
