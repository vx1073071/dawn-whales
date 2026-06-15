// R186 J2: Factor Preprocessor Pipeline v1
// Two pluggable steps: MAD outlier removal + Z-score standardization.
// Configurable per factor; can be extended with custom steps.

import type { FactorInput, PriceSnapshot } from './factor-calculator';
import type { FactorId } from './factor-id-registry';

export interface PreprocessConfig {
  /** Factor IDs to preprocess. If empty, apply to all. */
  factorIds?: FactorId[];
  /** Enable MAD outlier removal (default: true) */
  enableMAD?: boolean;
  /** MAD threshold multiplier (default: 3.0). Points beyond median +- threshold*MAD are clipped. */
  madThreshold?: number;
  /** Enable Z-score standardization (default: true) */
  enableZScore?: boolean;
  /** Minimum data points required to compute statistics (default: 20) */
  minDataPoints?: number;
  /** Custom preprocessing steps (added after built-in steps) */
  customSteps?: PreprocessStep[];
}

export interface PreprocessStep {
  name: string;
  apply(values: number[]): number[];
}

export interface PreprocessResult {
  /** Processed values (same order as input) */
  values: number[];
  /** Number of outliers detected (clipped by MAD) */
  outliersDetected: number;
  /** Original mean before preprocessing */
  originalMean: number;
  /** Original stddev before preprocessing */
  originalStdDev: number;
  /** Mean after preprocessing */
  processedMean: number;
  /** Stddev after preprocessing */
  processedStdDev: number;
  /** Steps applied */
  appliedSteps: string[];
  /** Summary stats */
  stats: PipelineStats;
}

export interface PipelineStats {
  inputCount: number;
  outputCount: number;
  missingCount: number;
  infiniteCount: number;
  nanCount: number;
  min: number;
  max: number;
  mean: number;
  std: number;
  median: number;
  q1: number;
  q3: number;
}

export class FactorPreprocessorV1 {
  private config: Required<Omit<PreprocessConfig, 'customSteps'>> & { customSteps: PreprocessStep[] };

  constructor(config: PreprocessConfig = {}) {
    this.config = {
      factorIds: config.factorIds ?? [],
      enableMAD: config.enableMAD ?? true,
      madThreshold: config.madThreshold ?? 3.0,
      enableZScore: config.enableZScore ?? true,
      minDataPoints: config.minDataPoints ?? 20,
      customSteps: config.customSteps ?? [],
    };
  }

  /**
   * Preprocess raw factor values.
   * Pipeline: Clean → MAD → Z-Score → Custom
   * @returns PreprocessResult with processed values and diagnostic stats.
   */
  preprocess(rawValues: number[]): PreprocessResult {
    const appliedSteps: string[] = [];

    // Step 0: Compute input stats
    const inputStats = FactorPreprocessorV1.computeStats(rawValues);

    // Step 1: Clean — remove NaN, Infinity, missing
    let values = rawValues.filter(v => isFinite(v) && !isNaN(v));
    const missingCount = rawValues.length - values.length;
    appliedSteps.push('clean');

    // Short-circuit if insufficient data
    if (values.length < this.config.minDataPoints) {
      return {
        values,
        outliersDetected: 0,
        originalMean: inputStats.mean,
        originalStdDev: inputStats.std,
        processedMean: inputStats.mean,
        processedStdDev: inputStats.std,
        appliedSteps,
        stats: { ...inputStats, inputCount: rawValues.length, outputCount: values.length, missingCount: inputStats.nanCount, infiniteCount: 0, nanCount: 0 },
      };
    }

    // Step 2: MAD outlier removal
    let outliersDetected = 0;
    if (this.config.enableMAD) {
      const result = FactorPreprocessorV1.applyMADClip(values, this.config.madThreshold);
      outliersDetected = result.outliersDetected;
      values = result.values;
      appliedSteps.push('mad');
    }

    // Step 3: Z-score standardization
    if (this.config.enableZScore) {
      values = FactorPreprocessorV1.applyZScore(values);
      appliedSteps.push('zscore');
    }

    // Step 4: Custom steps
    for (const step of this.config.customSteps) {
      values = step.apply(values);
      appliedSteps.push(step.name);
    }

    const outputStats = FactorPreprocessorV1.computeStats(values);

    return {
      values,
      outliersDetected,
      originalMean: inputStats.mean,
      originalStdDev: inputStats.std,
      processedMean: outputStats.mean,
      processedStdDev: outputStats.std,
      appliedSteps,
      stats: { ...outputStats, inputCount: rawValues.length, outputCount: values.length, missingCount: inputStats.nanCount, infiniteCount: 0, nanCount: 0 },
    };
  }

  /**
   * Preprocess all numeric fields in FactorInput[] for cross-section analysis.
   * Extracts factor values via extractor, preprocesses, and returns modified inputs.
   */
  preprocessCrossSection(
    inputs: FactorInput[],
    valueExtractor: (input: FactorInput) => number,
  ): { inputs: FactorInput[]; result: PreprocessResult } {
    const rawValues = inputs.map(valueExtractor);
    const result = this.preprocess(rawValues);
    // Return original inputs with processed values stored in extra
    const processedInputs = inputs.map((input, i) => ({
      ...input,
      extra: { ...input.extra, preprocessedValue: result.values[i] ?? 0 },
    }));
    return { inputs: processedInputs, result };
  }

  /**
   * Median Absolute Deviation (MAD) outlier clipping.
   * Points beyond median +- threshold * MAD are clipped to the boundary.
   */
  static applyMADClip(
    values: number[],
    threshold: number = 3.0,
  ): { values: number[]; outliersDetected: number; median: number; mad: number } {
    const sorted = [...values].sort((a, b) => a - b);
    const median = FactorPreprocessorV1.median(sorted);
    const absoluteDeviations = values.map(v => Math.abs(v - median));
    const mad = FactorPreprocessorV1.median([...absoluteDeviations].sort((a, b) => a - b));

    if (mad === 0) return { values: [...values], outliersDetected: 0, median, mad };

    const lowerBound = median - threshold * mad * 1.4826;
    const upperBound = median + threshold * mad * 1.4826;
    let outliersDetected = 0;

    const clipped = values.map(v => {
      if (v < lowerBound) { outliersDetected++; return lowerBound; }
      if (v > upperBound) { outliersDetected++; return upperBound; }
      return v;
    });

    return { values: clipped, outliersDetected, median, mad };
  }

  /**
   * Z-score standardization: (x - mean) / stddev.
   * Returns values with mean=0 and stddev=1.
   */
  static applyZScore(values: number[]): number[] {
    if (values.length < 2) return values;
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    if (std === 0) return values.map(() => 0);
    return values.map(v => (v - mean) / std);
  }

  static computeStats(values: number[]): PipelineStats {
    const finites = values.filter(v => isFinite(v) && !isNaN(v));
    if (finites.length === 0) {
      return { inputCount: values.length, outputCount: 0, missingCount: values.length, infiniteCount: 0, nanCount: 0, min: 0, max: 0, mean: 0, std: 0, median: 0, q1: 0, q3: 0 };
    }
    const sorted = [...finites].sort((a, b) => a - b);
    const sum = finites.reduce((a, b) => a + b, 0);
    const mean = sum / finites.length;
    const variance = finites.reduce((s, v) => s + (v - mean) ** 2, 0) / finites.length;
    const std = Math.sqrt(variance);
    return {
      inputCount: values.length,
      outputCount: finites.length,
      missingCount: values.length - finites.length,
      infiniteCount: values.filter(v => !isFinite(v)).length,
      nanCount: values.filter(v => isNaN(v)).length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      std,
      median: FactorPreprocessorV1.median(sorted),
      q1: FactorPreprocessorV1.percentile(sorted, 0.25),
      q3: FactorPreprocessorV1.percentile(sorted, 0.75),
    };
  }

  static median(sorted: number[]): number {
    const n = sorted.length;
    if (n === 0) return 0;
    const mid = Math.floor(n / 2);
    return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  static percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.round(p * (sorted.length - 1));
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  }

  /** Convenience: preprocess a single array of values with default settings */
  static quickPreprocess(values: number[]): PreprocessResult {
    const ppl = new FactorPreprocessorV1();
    return ppl.preprocess(values);
  }
}

export const WINSORIZE_STEP: PreprocessStep = {
  name: 'winsorize',
  apply(values: number[]): number[] {
    const sorted = [...values].filter(v => isFinite(v)).sort((a, b) => a - b);
    if (sorted.length < 4) return values;
    const p1 = sorted[Math.floor(sorted.length * 0.01)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    return values.map(v => {
      if (!isFinite(v)) return v;
      if (v < p1) return p1;
      if (v > p99) return p99;
      return v;
    });
  },
};

export const MIN_MAX_SCALE_STEP: PreprocessStep = {
  name: 'minmax',
  apply(values: number[]): number[] {
    const finites = values.filter(v => isFinite(v));
    if (finites.length < 2) return values;
    const min = Math.min(...finites);
    const max = Math.max(...finites);
    const range = max - min;
    if (range === 0) return values.map(() => 0.5);
    return values.map(v => isFinite(v) ? (v - min) / range : 0);
  },
};