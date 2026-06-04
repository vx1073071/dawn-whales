// ── Data Cleaning Pipeline — Real-time Data Cleaning ──────────────────────
// JVS-57: Real-time data cleaning pipeline for market data
// Features: anomaly detection (3σ/IQR/isolation forest), missing value interpolation
// Output: data-pipeline.ts

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MarketDataPoint {
  timestamp: number;
  code: string;
  price: number;
  volume: number;
  high?: number;
  low?: number;
  open?: number;
  change?: number;
  changePct?: number;
}

export interface CleaningResult {
  original: MarketDataPoint;
  cleaned: MarketDataPoint;
  anomalies: Anomaly[];
  interpolated: boolean;
  quality: DataQuality;
}

export interface Anomaly {
  field: string;
  type: 'outlier' | 'missing' | 'inconsistent';
  originalValue: any;
  cleanedValue: any;
  confidence: number;
  method: string;
}

export interface DataQuality {
  score: number;          // 0-100
  completeness: number;   // % of non-null fields
  consistency: number;    // 0-100
  freshness: number;      // 0-100
}

export interface PipelineConfig {
  anomalyDetection: {
    enabled: boolean;
    methods: ('3sigma' | 'iqr' | 'isolation_forest')[];
    sensitivity: number;    // 0-1, higher = more sensitive
  };
  interpolation: {
    enabled: boolean;
    maxGap: number;         // Max consecutive missing values to interpolate
    method: 'linear' | 'spline' | 'nearest';
  };
  historySize: number;      // Number of historical points to keep for anomaly detection
}

// ── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_CONFIG: PipelineConfig = {
  anomalyDetection: {
    enabled: true,
    methods: ['3sigma', 'iqr'],
    sensitivity: 0.7,
  },
  interpolation: {
    enabled: true,
    maxGap: 5,
    method: 'linear',
  },
  historySize: 100,
};

// ── Anomaly Detection Algorithms ───────────────────────────────────────────

/**
 * 3-Sigma Rule: Values beyond 3 standard deviations from mean are outliers
 */
function detect3SigmaOutliers(values: number[], sensitivity: number): { outliers: number[]; mean: number; std: number } {
  if (values.length < 3) return { outliers: [], mean: 0, std: 0 };

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);

  // Adjust threshold based on sensitivity (0-1 -> 2-4 sigma)
  const threshold = 2 + (1 - sensitivity) * 2;
  const outliers: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (Math.abs(values[i] - mean) > threshold * std) {
      outliers.push(i);
    }
  }

  return { outliers, mean, std };
}

/**
 * IQR (Interquartile Range) Method
 * Values beyond Q1 - 1.5*IQR or Q3 + 1.5*IQR are outliers
 */
function detectIQROutliers(values: number[], sensitivity: number): { outliers: number[]; q1: number; q3: number } {
  if (values.length < 4) return { outliers: [], q1: 0, q3: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  // Adjust multiplier based on sensitivity (0-1 -> 2.0-1.0)
  const multiplier = 2.0 - sensitivity;
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  const outliers: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] < lowerBound || values[i] > upperBound) {
      outliers.push(i);
    }
  }

  return { outliers, q1, q3 };
}

/**
 * Simple Isolation Forest approximation
 * Uses average depth in random partitions
 */
function detectIsolationForestOutliers(values: number[], sensitivity: number): { outliers: number[]; scores: number[] } {
  if (values.length < 5) return { outliers: [], scores: [] };

  // Simplified: use z-score as proxy for isolation score
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

  const scores = values.map(v => {
    const zScore = std > 0 ? Math.abs(v - mean) / std : 0;
    return zScore;
  });

  // Adjust threshold based on sensitivity
  const threshold = 2 + (1 - sensitivity) * 2;
  const outliers: number[] = [];

  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > threshold) {
      outliers.push(i);
    }
  }

  return { outliers, scores };
}

// ── Interpolation Methods ──────────────────────────────────────────────────

/**
 * Linear interpolation for missing values
 */
function linearInterpolate(values: (number | null)[], maxGap: number): number[] {
  const result = [...values];

  for (let i = 0; i < result.length; i++) {
    if (result[i] === null) {
      // Find previous and next non-null values
      let prevIdx = -1;
      let nextIdx = -1;

      for (let j = i - 1; j >= 0 && i - j <= maxGap; j--) {
        if (result[j] !== null) {
          prevIdx = j;
          break;
        }
      }

      for (let j = i + 1; j < result.length && j - i <= maxGap; j++) {
        if (result[j] !== null) {
          nextIdx = j;
          break;
        }
      }

      if (prevIdx >= 0 && nextIdx >= 0) {
        // Linear interpolation
        const t = (i - prevIdx) / (nextIdx - prevIdx);
        result[i] = result[prevIdx]! + t * (result[nextIdx]! - result[prevIdx]!);
      } else if (prevIdx >= 0) {
        // Forward fill
        result[i] = result[prevIdx];
      } else if (nextIdx >= 0) {
        // Backward fill
        result[i] = result[nextIdx];
      } else {
        // Use 0 as fallback
        result[i] = 0;
      }
    }
  }

  return result as number[];
}

// ── Data Cleaning Pipeline Class ───────────────────────────────────────────

export class DataCleaningPipeline {
  private config: PipelineConfig;
  private history: Map<string, MarketDataPoint[]> = new Map();

  constructor(config?: Partial<PipelineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Clean a single data point
   */
  clean(point: MarketDataPoint): CleaningResult {
    const anomalies: Anomaly[] = [];
    const cleaned = { ...point };
    let interpolated = false;

    // Get or create history for this code
    if (!this.history.has(point.code)) {
      this.history.set(point.code, []);
    }
    const history = this.history.get(point.code)!;

    // Add current point to history
    history.push(point);
    if (history.length > this.config.historySize) {
      history.shift();
    }

    // Detect anomalies for price
    if (this.config.anomalyDetection.enabled && history.length >= 3) {
      const prices = history.map(p => p.price);
      const priceAnomalies = this.detectAnomalies(prices, 'price');

      for (const anomaly of priceAnomalies) {
        anomalies.push({
          field: 'price',
          type: 'outlier',
          originalValue: anomaly.originalValue,
          cleanedValue: anomaly.cleanedValue,
          confidence: anomaly.confidence,
          method: anomaly.method,
        });
        cleaned.price = anomaly.cleanedValue;
      }
    }

    // Detect anomalies for volume
    if (this.config.anomalyDetection.enabled && history.length >= 3) {
      const volumes = history.map(p => p.volume);
      const volumeAnomalies = this.detectAnomalies(volumes, 'volume');

      for (const anomaly of volumeAnomalies) {
        anomalies.push({
          field: 'volume',
          type: 'outlier',
          originalValue: anomaly.originalValue,
          cleanedValue: anomaly.cleanedValue,
          confidence: anomaly.confidence,
          method: anomaly.method,
        });
        cleaned.volume = anomaly.cleanedValue;
      }
    }

    // Check for missing values
    if (this.config.interpolation.enabled) {
      if (point.price === 0 || point.price === null) {
        interpolated = true;
        const lastPrice = history.length > 1 ? history[history.length - 2].price : 0;
        cleaned.price = lastPrice;
        anomalies.push({
          field: 'price',
          type: 'missing',
          originalValue: 0,
          cleanedValue: cleaned.price,
          confidence: 0.8,
          method: 'forward_fill',
        });
      }

      if (point.volume === 0 || point.volume === null) {
        interpolated = true;
        const lastVolume = history.length > 1 ? history[history.length - 2].volume : 0;
        cleaned.volume = lastVolume;
        anomalies.push({
          field: 'volume',
          type: 'missing',
          originalValue: 0,
          cleanedValue: cleaned.volume,
          confidence: 0.8,
          method: 'forward_fill',
        });
      }
    }

    // Calculate quality score
    const quality = this.calculateQuality(cleaned, anomalies);

    return {
      original: point,
      cleaned,
      anomalies,
      interpolated,
      quality,
    };
  }

  /**
   * Batch clean multiple data points
   */
  cleanBatch(points: MarketDataPoint[]): CleaningResult[] {
    return points.map(point => this.clean(point));
  }

  private detectAnomalies(values: number[], field: string): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const methods = this.config.anomalyDetection.methods;

    let outlierIndices: number[] = [];
    const methodScores: Map<string, number[]> = new Map();

    // Run each detection method
    if (methods.includes('3sigma')) {
      const result = detect3SigmaOutliers(values, this.config.anomalyDetection.sensitivity);
      outlierIndices.push(...result.outliers);
      methodScores.set('3sigma', result.outliers);
    }

    if (methods.includes('iqr')) {
      const result = detectIQROutliers(values, this.config.anomalyDetection.sensitivity);
      outlierIndices.push(...result.outliers);
      methodScores.set('iqr', result.outliers);
    }

    if (methods.includes('isolation_forest')) {
      const result = detectIsolationForestOutliers(values, this.config.anomalyDetection.sensitivity);
      outlierIndices.push(...result.outliers);
      methodScores.set('isolation_forest', result.outliers);
    }

    // Only flag if multiple methods agree (for last point only)
    const lastIdx = values.length - 1;
    const lastPointOutlierCount = outlierIndices.filter(i => i === lastIdx).length;

    if (lastPointOutlierCount >= 2 || (outlierIndices.includes(lastIdx) && methods.length === 1)) {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const cleanedValue = mean; // Replace with mean

      anomalies.push({
        field,
        type: 'outlier',
        originalValue: values[lastIdx],
        cleanedValue,
        confidence: lastPointOutlierCount / methods.length,
        method: methods.join('+'),
      });
    }

    return anomalies;
  }

  private calculateQuality(point: MarketDataPoint, anomalies: Anomaly[]): DataQuality {
    // Completeness: check for non-null fields
    const fields = ['price', 'volume', 'high', 'low', 'open', 'change', 'changePct'];
    const nonNullFields = fields.filter(f => (point as any)[f] !== null && (point as any)[f] !== 0);
    const completeness = (nonNullFields.length / fields.length) * 100;

    // Consistency: fewer anomalies = higher consistency
    const consistency = Math.max(0, 100 - anomalies.length * 20);

    // Freshness: based on timestamp
    const ageMs = Date.now() - point.timestamp;
    const freshness = Math.max(0, 100 - (ageMs / (5 * 60 * 1000)) * 100);

    // Overall score
    const score = (completeness * 0.4 + consistency * 0.3 + freshness * 0.3);

    return {
      score: Math.round(score),
      completeness: Math.round(completeness),
      consistency: Math.round(consistency),
      freshness: Math.round(freshness),
    };
  }

  /**
   * Clear history for a specific code or all codes
   */
  clearHistory(code?: string): void {
    if (code) {
      this.history.delete(code);
    } else {
      this.history.clear();
    }
  }

  getStats(): { codes: string[]; historySize: number } {
    return {
      codes: Array.from(this.history.keys()),
      historySize: this.history.size,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let pipelineInstance: DataCleaningPipeline | null = null;

export function getDataCleaningPipeline(config?: Partial<PipelineConfig>): DataCleaningPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new DataCleaningPipeline(config);
  }
  return pipelineInstance;
}
