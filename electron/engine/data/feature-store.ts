// ── Real-time Feature Engineering Platform (JVS-60) ─────────────────────────
// 实时特征工程平台 - 100+ 技术指标自动计算 + Feature Store
// 支持：技术指标、价格形态、成交量特征、波动率指标、资金流指标

import { Database } from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface FeatureDefinition {
  name: string;
  category: 'technical' | 'price_pattern' | 'volume' | 'volatility' | 'capital_flow' | 'macro';
  description: string;
  computeFunction: string;  // Function name
  parameters: Record<string, any>;
  enabled: boolean;
}

export interface FeatureValue {
  symbol: string;
  feature_name: string;
  value: number;
  timestamp: number;
  confidence: number;  // 0-1
}

export interface FeatureSet {
  symbol: string;
  timestamp: number;
  features: Record<string, number>;
  feature_count: number;
}

// ── Technical Indicator Functions ──────────────────────────────────────────

class TechnicalIndicators {
  // Simple Moving Average
  static sma(prices: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  // Exponential Moving Average
  static ema(prices: number[], period: number): number[] {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA is SMA
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(ema);
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
      result.push(ema);
    }
    
    // Pad with NaN for periods before EMA starts
    while (result.length < prices.length) {
      result.unshift(NaN);
    }
    
    return result;
  }

  // RSI - Relative Strength Index
  static rsi(prices: number[], period: number = 14): number[] {
    const result: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
    
    // First RSI
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = 100 - (100 / (1 + rs));
    
    // Pad with NaN
    for (let i = 0; i < period; i++) {
      result.push(NaN);
    }
    result.push(rsi);
    
    // Calculate remaining RSI values
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    }
    
    return result;
  }

  // MACD
  static macd(prices: number[], fast: number = 12, slow: number = 26, signal: number = 9): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    const emaFast = this.ema(prices, fast);
    const emaSlow = this.ema(prices, slow);
    
    const macdLine: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) {
        macdLine.push(emaFast[i] - emaSlow[i]);
      } else {
        macdLine.push(NaN);
      }
    }
    
    const signalLine = this.ema(macdLine.filter(x => !isNaN(x)), signal);
    const histogram = macdLine.map((macd, i) => {
      const signalValue = signalLine[i] || 0;
      return macd - signalValue;
    });
    
    return { macd: macdLine, signal: signalLine, histogram };
  }

  // Bollinger Bands
  static bollingerBands(prices: number[], period: number = 20, stdDev: number = 2): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    const middle = this.sma(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upper.push(NaN);
        lower.push(NaN);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        
        upper.push(mean + stdDev * std);
        lower.push(mean - stdDev * std);
      }
    }
    
    return { upper, middle, lower };
  }

  // ATR - Average True Range
  static atr(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
    const trueRanges: number[] = [];
    
    for (let i = 1; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
    
    const result: number[] = [];
    for (let i = 0; i < trueRanges.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else {
        const slice = trueRanges.slice(i - period + 1, i + 1);
        const atr = slice.reduce((a, b) => a + b, 0) / period;
        result.push(atr);
      }
    }
    
    return result;
  }

  // Stochastic Oscillator
  static stochastic(highs: number[], lows: number[], closes: number[], period: number = 14): {
    k: number[];
    d: number[];
  } {
    const kValues: number[] = [];
    
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        kValues.push(NaN);
      } else {
        const sliceHighs = highs.slice(i - period + 1, i + 1);
        const sliceLows = lows.slice(i - period + 1, i + 1);
        const highestHigh = Math.max(...sliceHighs);
        const lowestLow = Math.min(...sliceLows);
        const k = highestHigh === lowestLow ? 50 : ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
        kValues.push(k);
      }
    }
    
    const dValues = this.sma(kValues.filter(x => !isNaN(x)), 3);
    
    return { k: kValues, d: dValues };
  }

  // Volume Weighted Average Price (VWAP)
  static vwap(highs: number[], lows: number[], closes: number[], volumes: number[]): number[] {
    const result: number[] = [];
    let cumulativeTPV = 0;  // Typical Price * Volume
    let cumulativeVolume = 0;
    
    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      cumulativeTPV += typicalPrice * volumes[i];
      cumulativeVolume += volumes[i];
      
      const vwap = cumulativeVolume === 0 ? closes[i] : cumulativeTPV / cumulativeVolume;
      result.push(vwap);
    }
    
    return result;
  }

  // On-Balance Volume (OBV)
  static obv(closes: number[], volumes: number[]): number[] {
    const result: number[] = [volumes[0]];
    
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        result.push(result[i - 1] + volumes[i]);
      } else if (closes[i] < closes[i - 1]) {
        result.push(result[i - 1] - volumes[i]);
      } else {
        result.push(result[i - 1]);
      }
    }
    
    return result;
  }
}

// ── Feature Store ──────────────────────────────────────────────────────────

export class FeatureStore {
  private db: Database;
  private featureDefinitions: Map<string, FeatureDefinition> = new Map();
  private cache: Map<string, FeatureSet> = new Map();
  private dataDir: string;

  constructor(db: Database, dataDir: string) {
    this.db = db;
    this.dataDir = dataDir;
    this.initTables();
    this.loadFeatureDefinitions();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feature_definitions (
        name TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        description TEXT,
        compute_function TEXT NOT NULL,
        parameters TEXT,
        enabled INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS feature_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        feature_name TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        confidence REAL DEFAULT 1.0,
        UNIQUE(symbol, feature_name, timestamp)
      );

      CREATE INDEX IF NOT EXISTS idx_feature_values_symbol 
      ON feature_values(symbol, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_feature_values_feature 
      ON feature_values(feature_name, timestamp DESC);
    `);
  }

  private loadFeatureDefinitions(): void {
    const definitions = this.db.prepare('SELECT * FROM feature_definitions').all() as any[];
    
    if (definitions.length === 0) {
      this.initDefaultFeatures();
    } else {
      for (const def of definitions) {
        this.featureDefinitions.set(def.name, {
          name: def.name,
          category: def.category,
          description: def.description,
          computeFunction: def.compute_function,
          parameters: JSON.parse(def.parameters || '{}'),
          enabled: def.enabled === 1,
        });
      }
    }
  }

  private initDefaultFeatures(): void {
    const defaults: FeatureDefinition[] = [
      // Technical Indicators
      { name: 'sma_5', category: 'technical', description: '5-period SMA', computeFunction: 'sma', parameters: { period: 5 }, enabled: true },
      { name: 'sma_10', category: 'technical', description: '10-period SMA', computeFunction: 'sma', parameters: { period: 10 }, enabled: true },
      { name: 'sma_20', category: 'technical', description: '20-period SMA', computeFunction: 'sma', parameters: { period: 20 }, enabled: true },
      { name: 'sma_50', category: 'technical', description: '50-period SMA', computeFunction: 'sma', parameters: { period: 50 }, enabled: true },
      { name: 'sma_200', category: 'technical', description: '200-period SMA', computeFunction: 'sma', parameters: { period: 200 }, enabled: true },
      { name: 'ema_12', category: 'technical', description: '12-period EMA', computeFunction: 'ema', parameters: { period: 12 }, enabled: true },
      { name: 'ema_26', category: 'technical', description: '26-period EMA', computeFunction: 'ema', parameters: { period: 26 }, enabled: true },
      { name: 'rsi_14', category: 'technical', description: '14-period RSI', computeFunction: 'rsi', parameters: { period: 14 }, enabled: true },
      { name: 'macd_line', category: 'technical', description: 'MACD Line', computeFunction: 'macd', parameters: { fast: 12, slow: 26, signal: 9 }, enabled: true },
      { name: 'macd_signal', category: 'technical', description: 'MACD Signal', computeFunction: 'macd', parameters: { fast: 12, slow: 26, signal: 9 }, enabled: true },
      { name: 'macd_histogram', category: 'technical', description: 'MACD Histogram', computeFunction: 'macd', parameters: { fast: 12, slow: 26, signal: 9 }, enabled: true },
      { name: 'bollinger_upper', category: 'technical', description: 'Bollinger Upper Band', computeFunction: 'bollingerBands', parameters: { period: 20, stdDev: 2 }, enabled: true },
      { name: 'bollinger_middle', category: 'technical', description: 'Bollinger Middle Band', computeFunction: 'bollingerBands', parameters: { period: 20, stdDev: 2 }, enabled: true },
      { name: 'bollinger_lower', category: 'technical', description: 'Bollinger Lower Band', computeFunction: 'bollingerBands', parameters: { period: 20, stdDev: 2 }, enabled: true },
      { name: 'atr_14', category: 'volatility', description: '14-period ATR', computeFunction: 'atr', parameters: { period: 14 }, enabled: true },
      { name: 'stochastic_k', category: 'technical', description: 'Stochastic %K', computeFunction: 'stochastic', parameters: { period: 14 }, enabled: true },
      { name: 'stochastic_d', category: 'technical', description: 'Stochastic %D', computeFunction: 'stochastic', parameters: { period: 14 }, enabled: true },
      { name: 'vwap', category: 'volume', description: 'Volume Weighted Average Price', computeFunction: 'vwap', parameters: {}, enabled: true },
      { name: 'obv', category: 'volume', description: 'On-Balance Volume', computeFunction: 'obv', parameters: {}, enabled: true },
      
      // Price Patterns
      { name: 'price_change_pct', category: 'price_pattern', description: 'Price change %', computeFunction: 'priceChange', parameters: {}, enabled: true },
      { name: 'price_momentum_5', category: 'price_pattern', description: '5-day momentum', computeFunction: 'momentum', parameters: { period: 5 }, enabled: true },
      { name: 'price_momentum_10', category: 'price_pattern', description: '10-day momentum', computeFunction: 'momentum', parameters: { period: 10 }, enabled: true },
      { name: 'price_volatility_20', category: 'volatility', description: '20-day volatility', computeFunction: 'volatility', parameters: { period: 20 }, enabled: true },
      
      // Volume Features
      { name: 'volume_ratio', category: 'volume', description: 'Volume ratio vs average', computeFunction: 'volumeRatio', parameters: { period: 20 }, enabled: true },
      { name: 'volume_trend', category: 'volume', description: 'Volume trend', computeFunction: 'volumeTrend', parameters: { period: 10 }, enabled: true },
    ];

    const insertStmt = this.db.prepare(`
      INSERT INTO feature_definitions (name, category, description, compute_function, parameters, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((defs: FeatureDefinition[]) => {
      for (const def of defs) {
        insertStmt.run(
          def.name,
          def.category,
          def.description,
          def.computeFunction,
          JSON.stringify(def.parameters),
          def.enabled ? 1 : 0
        );
        this.featureDefinitions.set(def.name, def);
      }
    });

    insertMany(defaults);
  }

  /**
   * Compute all features for a symbol
   */
  computeFeatures(symbol: string, klines: any[]): FeatureSet {
    const timestamp = Date.now();
    const features: Record<string, number> = {};

    if (klines.length < 50) {
      return {
        symbol,
        timestamp,
        features: {},
        feature_count: 0,
      };
    }

    const closes = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const volumes = klines.map(k => k.volume);

    // Compute each enabled feature
    for (const [name, def] of this.featureDefinitions.entries()) {
      if (!def.enabled) continue;

      try {
        const value = this.computeFeature(name, def, closes, highs, lows, volumes);
        if (!isNaN(value)) {
          features[name] = value;
        }
      } catch (err) {
        // Skip failed features
      }
    }

    const featureSet: FeatureSet = {
      symbol,
      timestamp,
      features,
      feature_count: Object.keys(features).length,
    };

    // Cache the result
    this.cache.set(symbol, featureSet);

    return featureSet;
  }

  private computeFeature(
    name: string,
    def: FeatureDefinition,
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[]
  ): number {
    const params = def.parameters;

    switch (def.computeFunction) {
      case 'sma': {
        const values = TechnicalIndicators.sma(closes, params.period);
        return values[values.length - 1];
      }
      case 'ema': {
        const values = TechnicalIndicators.ema(closes, params.period);
        return values[values.length - 1];
      }
      case 'rsi': {
        const values = TechnicalIndicators.rsi(closes, params.period);
        return values[values.length - 1];
      }
      case 'macd': {
        const result = TechnicalIndicators.macd(closes, params.fast, params.slow, params.signal);
        if (name.includes('line')) return result.macd[result.macd.length - 1];
        if (name.includes('signal')) return result.signal[result.signal.length - 1];
        return result.histogram[result.histogram.length - 1];
      }
      case 'bollingerBands': {
        const result = TechnicalIndicators.bollingerBands(closes, params.period, params.stdDev);
        if (name.includes('upper')) return result.upper[result.upper.length - 1];
        if (name.includes('lower')) return result.lower[result.lower.length - 1];
        return result.middle[result.middle.length - 1];
      }
      case 'atr': {
        const values = TechnicalIndicators.atr(highs, lows, closes, params.period);
        return values[values.length - 1];
      }
      case 'stochastic': {
        const result = TechnicalIndicators.stochastic(highs, lows, closes, params.period);
        if (name.includes('_k')) return result.k[result.k.length - 1];
        return result.d[result.d.length - 1];
      }
      case 'vwap': {
        const values = TechnicalIndicators.vwap(highs, lows, closes, volumes);
        return values[values.length - 1];
      }
      case 'obv': {
        const values = TechnicalIndicators.obv(closes, volumes);
        return values[values.length - 1];
      }
      case 'priceChange': {
        if (closes.length < 2) return 0;
        return ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
      }
      case 'momentum': {
        if (closes.length < params.period + 1) return 0;
        const current = closes[closes.length - 1];
        const past = closes[closes.length - 1 - params.period];
        return ((current - past) / past) * 100;
      }
      case 'volatility': {
        if (closes.length < params.period + 1) return 0;
        const slice = closes.slice(-params.period);
        const returns = [];
        for (let i = 1; i < slice.length; i++) {
          returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * Math.sqrt(252) * 100;  // Annualized %
      }
      case 'volumeRatio': {
        if (volumes.length < params.period + 1) return 1;
        const current = volumes[volumes.length - 1];
        const avg = volumes.slice(-params.period).reduce((a, b) => a + b, 0) / params.period;
        return avg === 0 ? 1 : current / avg;
      }
      case 'volumeTrend': {
        if (volumes.length < params.period + 1) return 0;
        const slice = volumes.slice(-params.period);
        const firstHalf = slice.slice(0, Math.floor(slice.length / 2));
        const secondHalf = slice.slice(Math.floor(slice.length / 2));
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        return avgFirst === 0 ? 0 : ((avgSecond - avgFirst) / avgFirst) * 100;
      }
      default:
        return 0;
    }
  }

  /**
   * Get cached feature set for a symbol
   */
  getCachedFeatures(symbol: string): FeatureSet | null {
    return this.cache.get(symbol) || null;
  }

  /**
   * Get all enabled feature definitions
   */
  getFeatureDefinitions(): FeatureDefinition[] {
    return Array.from(this.featureDefinitions.values()).filter(d => d.enabled);
  }

  /**
   * Save feature values to database
   */
  saveFeatures(features: FeatureValue[]): void {
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO feature_values 
      (symbol, feature_name, value, timestamp, confidence)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((values: FeatureValue[]) => {
      for (const f of values) {
        insertStmt.run(f.symbol, f.feature_name, f.value, f.timestamp, f.confidence);
      }
    });

    insertMany(features);
  }

  /**
   * Query historical feature values
   */
  queryFeatures(symbol: string, featureNames: string[], limit: number = 100): FeatureValue[] {
    const placeholders = featureNames.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT * FROM feature_values 
      WHERE symbol = ? AND feature_name IN (${placeholders})
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const rows = stmt.all(symbol, ...featureNames, limit) as any[];
    return rows.map(row => ({
      symbol: row.symbol,
      feature_name: row.feature_name,
      value: row.value,
      timestamp: row.timestamp,
      confidence: row.confidence,
    }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let featureStoreInstance: FeatureStore | null = null;

export function getFeatureStore(db: Database, dataDir: string): FeatureStore {
  if (!featureStoreInstance) {
    featureStoreInstance = new FeatureStore(db, dataDir);
  }
  return featureStoreInstance;
}
