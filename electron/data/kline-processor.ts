// JVS-113: K
// K，period

import log from 'electron-log';

export interface KLineData {
  timestamp: number;      // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;       // turnover
}

export interface KLineProcessorConfig {
  timeframes: TimeFrame[];
  maxHistorySize?: number;
}

export type TimeFrame = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

interface TimeFrameConfig {
  name: TimeFrame;
  intervalMs: number;
}

const TIMEFRAME_CONFIG: Record<TimeFrame, TimeFrameConfig> = {
  '1m':  { name: '1m',  intervalMs: 60 * 1000 },
  '5m':  { name: '5m',  intervalMs: 5 * 60 * 1000 },
  '15m': { name: '15m', intervalMs: 15 * 60 * 1000 },
  '30m': { name: '30m', intervalMs: 30 * 60 * 1000 },
  '1h':  { name: '1h',  intervalMs: 60 * 60 * 1000 },
  '4h':  { name: '4h',  intervalMs: 4 * 60 * 60 * 1000 },
  '1d':  { name: '1d',  intervalMs: 24 * 60 * 60 * 1000 },
};

export class KLineProcessor {
  private config: Required<KLineProcessorConfig>;
  private history: Map<string, KLineData[]> = new Map(); // symbol -> K-line history
  private multiTimeframeData: Map<string, Map<TimeFrame, KLineData[]>> = new Map();

  constructor(config?: KLineProcessorConfig) {
    this.config = {
      timeframes: config?.timeframes ?? ['1m', '5m', '15m', '1h'],
      maxHistorySize: config?.maxHistorySize ?? 1000,
    };
  }

  processKLine(symbol: string, kline: KLineData): void {
    // Initialize history if not exists
    if (!this.history.has(symbol)) {
      this.history.set(symbol, []);
    }

    // Add to history
    const history = this.history.get(symbol)!;
    history.push(kline);

    // Trim history if exceeds max size
    if (history.length > this.config.maxHistorySize) {
      history.shift();
    }

    // Process multi-timeframe aggregation
    this.aggregateTimeframes(symbol, kline);
  }

  processBatch(symbol: string, klines: KLineData[]): void {
    for (const kline of klines) {
      this.processKLine(symbol, kline);
    }
  }

  private aggregateTimeframes(symbol: string, kline: KLineData): void {
    if (!this.multiTimeframeData.has(symbol)) {
      this.multiTimeframeData.set(symbol, new Map());
    }

    const symbolData = this.multiTimeframeData.get(symbol)!;

    for (const timeframe of this.config.timeframes) {
      const config = TIMEFRAME_CONFIG[timeframe];
      const aggregated = this.aggregateToTimeframe(kline, config);
      
      if (!symbolData.has(timeframe)) {
        symbolData.set(timeframe, []);
      }

      const timeframeData = symbolData.get(timeframe)!;
      
      // Check if we need to start a new candle
      const lastCandle = timeframeData[timeframeData.length - 1];
      const candleStart = this.getCandleStart(kline.timestamp, config.intervalMs);

      if (!lastCandle || this.getCandleStart(lastCandle.timestamp, config.intervalMs) !== candleStart) {
        // Start new candle
        timeframeData.push({
          timestamp: candleStart,
          open: kline.open,
          high: kline.high,
          low: kline.low,
          close: kline.close,
          volume: kline.volume,
          turnover: kline.turnover,
        });
      } else {
        // Update existing candle
        lastCandle.high = Math.max(lastCandle.high, kline.high);
        lastCandle.low = Math.min(lastCandle.low, kline.low);
        lastCandle.close = kline.close;
        lastCandle.volume += kline.volume;
        if (kline.turnover && lastCandle.turnover) {
          lastCandle.turnover += kline.turnover;
        }
      }
    }
  }

  private aggregateToTimeframe(kline: KLineData, config: TimeFrameConfig): KLineData {
    const candleStart = this.getCandleStart(kline.timestamp, config.intervalMs);
    
    return {
      timestamp: candleStart,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
      volume: kline.volume,
      turnover: kline.turnover,
    };
  }

  private getCandleStart(timestamp: number, intervalMs: number): number {
    return Math.floor(timestamp / intervalMs) * intervalMs;
  }

  // Data validation and cleaning
  validateKLine(kline: KLineData): boolean {
    if (!kline.timestamp || kline.timestamp <= 0) return false;
    if (kline.open <= 0 || kline.high <= 0 || kline.low <= 0 || kline.close <= 0) return false;
    if (kline.high < kline.low) return false;
    if (kline.open > kline.high || kline.open < kline.low) return false;
    if (kline.close > kline.high || kline.close < kline.low) return false;
    if (kline.volume < 0) return false;
    return true;
  }

  cleanKLine(kline: KLineData): KLineData {
    return {
      timestamp: kline.timestamp,
      open: Math.max(0, kline.open),
      high: Math.max(kline.open, kline.high, kline.low, kline.close),
      low: Math.min(kline.open, kline.high, kline.low, kline.close),
      close: Math.max(0, kline.close),
      volume: Math.max(0, kline.volume),
      turnover: kline.turnover ? Math.max(0, kline.turnover) : undefined,
    };
  }

  // Getters
  getHistory(symbol: string): KLineData[] {
    return this.history.get(symbol) || [];
  }

  getTimeframeData(symbol: string, timeframe: TimeFrame): KLineData[] {
    const symbolData = this.multiTimeframeData.get(symbol);
    if (!symbolData) return [];
    return symbolData.get(timeframe) || [];
  }

  getLatestKLine(symbol: string): KLineData | null {
    const history = this.history.get(symbol);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  getLatestTimeframeData(symbol: string, timeframe: TimeFrame): KLineData | null {
    const data = this.getTimeframeData(symbol, timeframe);
    return data.length > 0 ? data[data.length - 1] : null;
  }

  // Statistics
  getStats(symbol: string): {
    totalKLines: number;
    timeframes: Map<TimeFrame, number>;
    latestTimestamp: number | null;
  } {
    const history = this.history.get(symbol) || [];
    const symbolData = this.multiTimeframeData.get(symbol);
    
    const timeframes = new Map<TimeFrame, number>();
    if (symbolData) {
      for (const [tf, data] of symbolData) {
        timeframes.set(tf, data.length);
      }
    }

    return {
      totalKLines: history.length,
      timeframes,
      latestTimestamp: history.length > 0 ? history[history.length - 1].timestamp : null,
    };
  }

  // Clear data
  clearSymbol(symbol: string): void {
    this.history.delete(symbol);
    this.multiTimeframeData.delete(symbol);
  }

  clearAll(): void {
    this.history.clear();
    this.multiTimeframeData.clear();
  }
}

// Singleton
let processorInstance: KLineProcessor | null = null;

export function getKLineProcessor(config?: KLineProcessorConfig): KLineProcessor {
  if (!processorInstance) {
    processorInstance = new KLineProcessor(config);
  }
  return processorInstance;
}
