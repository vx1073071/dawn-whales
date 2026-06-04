// ── Real-time Anomaly Detection ───────────────────────────────────────────────
// Q10: Statistical anomaly detection on prices/volume/spreads
// Methods: Z-score, IQR (Interquartile Range), Moving Window

export type AnomalyMethod = 'zscore' | 'iqr' | 'moving';

export interface AnomalyInput {
  values: number[];
  method?: AnomalyMethod;
  window?: number;      // rolling window size, default 20
  threshold?: number;   // threshold in std devs (zscore) or IQR multiples (iqr), default 3
  minPeriods?: number;  // minimum observations required
}

export interface AnomalyResult {
  isAnomaly: boolean[];
  scores: number[];      // anomaly scores per point
  anomalies: AnomalyPoint[];
  method: AnomalyMethod;
  threshold: number;
  window: number;
  summary: AnomalySummary;
}

export interface AnomalyPoint {
  index: number;
  value: number;
  score: number;
  deviation: number;    // raw deviation from expected
  type: 'spike' | 'dip' | 'breakout' | 'volume_surge' | 'volume_drop';
}

export interface AnomalySummary {
  totalAnomalies: number;
  anomalyRate: number;   // percentage
  spikeCount: number;
  dipCount: number;
  breakoutCount: number;
  avgScore: number;
  maxScore: number;
  anomalyIndices: number[];
}

// ── Z-Score Method ─────────────────────────────────────────────────────────

function detectZScore(values: number[], window = 20, threshold = 3, minPeriods = 5): { isAnomaly: boolean[]; scores: number[] } {
  const isAnomaly: boolean[] = [];
  const scores: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < minPeriods - 1) {
      scores.push(0);
      isAnomaly.push(false);
      continue;
    }
    const start = Math.max(0, i - window + 1);
    const windowValues = values.slice(start, i + 1);
    const m = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
    const s = Math.sqrt(windowValues.reduce((sum, v) => sum + (v - m) ** 2, 0) / windowValues.length);
    const score = s > 0 ? Math.abs(values[i] - m) / s : 0;
    scores.push(Math.round(score * 1000) / 1000);
    isAnomaly.push(score > threshold);
  }

  return { isAnomaly, scores };
}

// ── IQR Method ─────────────────────────────────────────────────────────────

function detectIQR(values: number[], window = 20, threshold = 1.5, minPeriods = 5): { isAnomaly: boolean[]; scores: number[] } {
  const isAnomaly: boolean[] = [];
  const scores: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < minPeriods - 1) {
      scores.push(0);
      isAnomaly.push(false);
      continue;
    }
    const start = Math.max(0, i - window + 1);
    const windowValues = values.slice(start, i + 1).sort((a, b) => a - b);
    const q1Idx = Math.floor(windowValues.length * 0.25);
    const q3Idx = Math.floor(windowValues.length * 0.75);
    const q1 = windowValues[q1Idx];
    const q3 = windowValues[q3Idx];
    const iqr = q3 - q1;
    const upperBound = q3 + threshold * iqr;
    const lowerBound = q1 - threshold * iqr;
    const median = windowValues[Math.floor(windowValues.length / 2)];
    const deviation = values[i] - median;
    const score = iqr > 0 ? Math.abs(deviation) / iqr : 0;
    scores.push(Math.round(score * 1000) / 1000);
    isAnomaly.push(values[i] > upperBound || values[i] < lowerBound);
  }

  return { isAnomaly, scores };
}

// ── Moving Average Divergence Method ─────────────────────────────────────

function detectMovingDivergence(values: number[], window = 20, threshold = 2, minPeriods = 5): { isAnomaly: boolean[]; scores: number[] } {
  const isAnomaly: boolean[] = [];
  const scores: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < minPeriods - 1) {
      scores.push(0);
      isAnomaly.push(false);
      continue;
    }
    const start = Math.max(0, i - window + 1);
    const windowVals = values.slice(start, i + 1);

    // Short MA vs long MA
    const shortWindow = Math.max(2, Math.floor(window / 4));
    const shortMean = windowVals.slice(-shortWindow).reduce((a, b) => a + b, 0) / shortWindow;
    const longMean = windowVals.reduce((a, b) => a + b, 0) / windowVals.length;
    const mad = windowVals.reduce((s, v) => s + Math.abs(v - longMean), 0) / windowVals.length;

    const score = mad > 0 ? Math.abs(shortMean - longMean) / mad : 0;
    scores.push(Math.round(score * 1000) / 1000);
    isAnomaly.push(score > threshold);
  }

  return { isAnomaly, scores };
}

// ── Anomaly Classification ─────────────────────────────────────────────────

function classifyAnomaly(
  values: number[],
  isAnomaly: boolean[],
  scores: number[],
  method: AnomalyMethod,
  window: number
): AnomalyPoint[] {
  const anomalies: AnomalyPoint[] = [];
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    returns.push((values[i] - values[i - 1]) / (values[i - 1] || 1));
  }

  for (let i = 0; i < values.length; i++) {
    if (!isAnomaly[i]) continue;

    const type = classifyType(values, returns, i, method, window);
    const deviation = computeDeviation(values, i, method, window);

    anomalies.push({
      index: i,
      value: Math.round(values[i] * 1000) / 1000,
      score: scores[i],
      deviation: Math.round(deviation * 1000) / 1000,
      type,
    });
  }
  return anomalies;
}

function classifyType(
  values: number[],
  returns: number[],
  i: number,
  method: AnomalyMethod,
  window: number
): AnomalyPoint['type'] {
  if (i < 1 || i >= values.length - 1) return 'spike';

  const start = Math.max(0, i - window + 1);
  const windowVals = values.slice(start, i + 1);
  const mean = windowVals.reduce((a, b) => a + b, 0) / windowVals.length;
  const std = Math.sqrt(windowVals.reduce((s, v) => s + (v - mean) ** 2, 0) / windowVals.length);
  const z = std > 0 ? (values[i] - mean) / std : 0;

  if (i < returns.length) {
    const ret = returns[i];
    const prevReturns = returns.slice(Math.max(0, i - window), i);
    const avgRet = prevReturns.length > 0 ? prevReturns.reduce((a, b) => a + b, 0) / prevReturns.length : 0;
    const retStd = Math.sqrt(prevReturns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / prevReturns.length);

    if (retStd > 0) {
      const retZ = Math.abs((ret - avgRet) / retStd);
      if (ret > 0 && z > 0) return 'breakout';
      if (ret < 0 && z < 0) return 'breakout';
      if (Math.abs(retZ) > 3 && Math.abs(z) < 1) return 'volume_surge';
    }
  }

  return z > 0 ? 'spike' : 'dip';
}

function computeDeviation(values: number[], i: number, method: AnomalyMethod, window: number): number {
  const start = Math.max(0, i - window + 1);
  const windowVals = values.slice(start, i + 1);
  const mean = windowVals.reduce((a, b) => a + b, 0) / windowVals.length;
  return values[i] - mean;
}

// ── Volume anomaly detection ───────────────────────────────────────────────

export function detectVolumeAnomaly(
  volumes: number[],
  prices: number[],
  options: { window?: number; threshold?: number } = {}
): { isAnomaly: boolean[]; scores: number[] } {
  const { window = 20, threshold = 2 } = options;

  // Detect volume anomaly independent of price
  const values = volumes;
  return detectMovingDivergence(values, window, threshold);
}

// ── Main API ───────────────────────────────────────────────────────────────

export function detectAnomalies(input: AnomalyInput): AnomalyResult {
  const {
    values,
    method = 'zscore',
    window = 20,
    threshold = 3,
    minPeriods = 5,
  } = input;

  if (values.length < minPeriods) {
    return {
      isAnomaly: new Array(values.length).fill(false),
      scores: new Array(values.length).fill(0),
      anomalies: [],
      method,
      threshold,
      window,
      summary: { totalAnomalies: 0, anomalyRate: 0, spikeCount: 0, dipCount: 0, breakoutCount: 0, avgScore: 0, maxScore: 0, anomalyIndices: [] },
    };
  }

  let isAnomaly: boolean[];
  let scores: number[];

  switch (method) {
    case 'iqr':
      ({ isAnomaly, scores } = detectIQR(values, window, threshold, minPeriods));
      break;
    case 'moving':
      ({ isAnomaly, scores } = detectMovingDivergence(values, window, threshold, minPeriods));
      break;
    default:
      ({ isAnomaly, scores } = detectZScore(values, window, threshold, minPeriods));
  }

  const anomalies = classifyAnomaly(values, isAnomaly, scores, method, window);
  const anomalyIndices = anomalies.map(a => a.index);
  const totalAnomalies = anomalies.length;
  const anomalyRate = Math.round((totalAnomalies / values.length) * 1000) / 10;

  const spikeCount = anomalies.filter(a => a.type === 'spike').length;
  const dipCount = anomalies.filter(a => a.type === 'dip').length;
  const breakoutCount = anomalies.filter(a => a.type === 'breakout' || a.type === 'volume_surge' || a.type === 'volume_drop').length;
  const validScores = scores.filter(s => s > 0);
  const avgScore = validScores.length > 0 ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 100) / 100 : 0;
  const maxScore = validScores.length > 0 ? Math.max(...validScores) : 0;

  return {
    isAnomaly,
    scores,
    anomalies,
    method,
    threshold,
    window,
    summary: {
      totalAnomalies,
      anomalyRate,
      spikeCount,
      dipCount,
      breakoutCount,
      avgScore,
      maxScore,
      anomalyIndices,
    },
  };
}

// ── Real-time streaming version ─────────────────────────────────────────────

export class StreamingAnomalyDetector {
  private window: number;
  private threshold: number;
  private method: AnomalyMethod;
  private buffer: number[] = [];

  constructor(window = 20, threshold = 3, method: AnomalyMethod = 'zscore') {
    this.window = window;
    this.threshold = threshold;
    this.method = method;
  }

  update(value: number): AnomalyResult {
    this.buffer.push(value);
    if (this.buffer.length > this.window * 2) {
      this.buffer = this.buffer.slice(-this.window * 2);
    }
    return detectAnomalies({
      values: this.buffer,
      method: this.method,
      window: this.window,
      threshold: this.threshold,
    });
  }

  getBuffer(): number[] {
    return [...this.buffer];
  }
}
