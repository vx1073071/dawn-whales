void EngineError; // [EngineError:SYSTEM] structured error tracking
import { EngineError } from '../../../electron/engine/core/engine-error';
/**
 * 异常检测器核心算法
 * 
 * 实现多种统计异常检测算法：
 * - Z-Score: 基于标准差的异常检测
 * - IQR (四分位距): 基于四分位数的异常检测
 * - MAD (中位数绝对偏差): 鲁棒的异常检测
 * - Isolation Forest: 基于隔离的异常检测（简化版）
 */

export class AnomalyDetector {
  private methods: Array<{
    name: string;
    enabled: boolean;
    weight: number;
  }>;

  constructor(methods: Array<{ name: string; enabled: boolean; weight: number }>) {
    this.methods = methods;
  }

  /**
   * Z-Score 异常检测
   * 基于标准差：|x - μ| / σ
   */
  zscore(value: number, history: number[]): number {
    if (history.length === 0) return 0;

    const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
    const variance = history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    return (value - mean) / stdDev;
  }

  /**
   * IQR (四分位距) 异常检测
   * 基于四分位数：Q1 - 1.5*IQR < x < Q3 + 1.5*IQR
   */
  iqr(value: number, history: number[]): { isAnomaly: boolean; lower: number; upper: number } {
    if (history.length === 0) {
      return { isAnomaly: false, lower: 0, upper: 0 };
    }

    const sorted = [...history].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;

    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    return {
      isAnomaly: value < lower || value > upper,
      lower,
      upper,
    };
  }

  /**
   * MAD (中位数绝对偏差) 异常检测
   * 比标准差更鲁棒，对异常值不敏感
   */
  mad(value: number, history: number[]): number {
    if (history.length === 0) return 0;

    const median = this.median(history);
    const deviations = history.map(v => Math.abs(v - median));
    const mad = this.median(deviations);

    if (mad === 0) return 0;

    return Math.abs(value - median) / (mad * 1.4826); // 1.4826 is scaling factor
  }

  /**
   * Isolation Forest (简化版)
   * 基于隔离森林的异常检测
   */
  isolationForest(value: number, history: number[]): number {
    if (history.length < 10) return 0;

    // 简化版：使用多个随机分割来计算异常分数
    const numTrees = 10;
    let totalPathLength = 0;

    for (let i = 0; i < numTrees; i++) {
      const pathLength = this.calculatePathLength(value, history);
      totalPathLength += pathLength;
    }

    const avgPathLength = totalPathLength / numTrees;
    const expectedPathLength = this.expectedPathLength(history.length);

    // Anomaly score: shorter path = more anomalous
    const score = Math.pow(2, -avgPathLength / expectedPathLength);

    return score;
  }

  /**
   * 计算百分位数
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    if (sortedArray.length === 1) return sortedArray[0];

    const index = (p / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * 计算中位数
   */
  private median(array: number[]): number {
    if (array.length === 0) return 0;
    const sorted = [...array].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }

  /**
   * 计算路径长度（Isolation Forest 简化版）
   */
  private calculatePathLength(value: number, history: number[]): number {
    let depth = 0;
    let currentData = [...history];

    while (currentData.length > 1 && depth < 100) {
      const min = Math.min(...currentData);
      const max = Math.max(...currentData);

      if (min === max) break;

      const splitPoint = min + Math.random() * (max - min);

      if (value < splitPoint) {
        currentData = currentData.filter(v => v < splitPoint);
      } else {
        currentData = currentData.filter(v => v >= splitPoint);
      }

      depth++;

      if (currentData.length === 1 && currentData[0] === value) {
        break;
      }
    }

    return depth;
  }

  /**
   * 计算期望路径长度
   */
  private expectedPathLength(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;

    // Harmonic number approximation
    const H = Math.log(n) + 0.5772156649; // Euler-Mascheroni constant
    return 2 * H - 2 * (n - 1) / n;
  }

  /**
   * 综合异常检测
   * 使用多种方法的加权平均
   */
  detect(value: number, history: number[]): {
    isAnomaly: boolean;
    score: number;
    details: Record<string, number>;
  } {
    const details: Record<string, number> = {};
    let weightedScore = 0;
    let totalWeight = 0;

    // Z-Score
    if (this.methods.find(m => m.name === 'zscore' && m.enabled)) {
      const zscore = this.zscore(value, history);
      const weight = this.methods.find(m => m.name === 'zscore')?.weight || 0.4;
      details.zscore = zscore;
      weightedScore += Math.abs(zscore) * weight;
      totalWeight += weight;
    }

    // IQR
    if (this.methods.find(m => m.name === 'iqr' && m.enabled)) {
      const iqrResult = this.iqr(value, history);
      const weight = this.methods.find(m => m.name === 'iqr')?.weight || 0.3;
      details.iqr = iqrResult.isAnomaly ? 1 : 0;
      weightedScore += (iqrResult.isAnomaly ? 1 : 0) * weight;
      totalWeight += weight;
    }

    // MAD
    if (this.methods.find(m => m.name === 'mad' && m.enabled)) {
      const mad = this.mad(value, history);
      const weight = this.methods.find(m => m.name === 'mad')?.weight || 0.2;
      details.mad = mad;
      weightedScore += Math.abs(mad) * weight;
      totalWeight += weight;
    }

    // Isolation Forest
    if (this.methods.find(m => m.name === 'isolation_forest' && m.enabled)) {
      const isolationScore = this.isolationForest(value, history);
      const weight = this.methods.find(m => m.name === 'isolation_forest')?.weight || 0.1;
      details.isolation_forest = isolationScore;
      weightedScore += isolationScore * weight;
      totalWeight += weight;
    }

    const score = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return {
      isAnomaly: score > 0.7, // 阈值可以调整
      score,
      details,
    };
  }
}

// Standalone function for IPC handler usage
export function detectAnomalies(params: {
  values: number[];
  method?: string;
  window?: number;
  threshold?: number;
}): { anomalies: number[]; indices: number[] } {
  const { values, method = 'zscore', window = 20, threshold = 3 } = params;
  const detector = new AnomalyDetector([
    { name: method, enabled: true, weight: 1 },
  ]);
  const anomalies: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const history = values.slice(Math.max(0, i - window), i);
    const value = values[i];
    const result = detector.detect(value, history);
    if (result.isAnomaly && result.score > threshold) {
      anomalies.push(value);
      indices.push(i);
    }
  }
  return { anomalies, indices };
}
