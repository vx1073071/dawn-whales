// ── Factor Preprocessor: 5-Stage Pipeline (R160 P0-F4) ──────────────────
// MAD outlier → Industry neutralization → MarketCap neutralization → Z-score → Impute
// Silent execution, expandable trace view per symbol/factor

// ── Types ──────────────────────────────────────────────────────────────────

export type PreprocessStage =
  | "mad_outlier"
  | "industry_neutralize"
  | "marketcap_neutralize"
  | "zscore"
  | "impute";

export interface PreprocessConfig {
  /** Enabled stages (default: all 5) */
  stages: PreprocessStage[];
  /** MAD multiplier for outlier capping (default: 5.0) */
  madMultiplier: number;
  /** Minimum observations to compute MAD (default: 10) */
  madMinObs: number;
  /** Z-score epsilon to avoid division by zero */
  zscoreEpsilon: number;
  /** Impute method: forward-fill then backward-fill then cross-section median */
  imputeMethod: "ffill-bfill-median" | "ffill-median" | "median";
}

export const DEFAULT_PREPROCESS_CONFIG: PreprocessConfig = {
  stages: ["mad_outlier", "industry_neutralize", "marketcap_neutralize", "zscore", "impute"],
  madMultiplier: 5.0,
  madMinObs: 10,
  zscoreEpsilon: 1e-10,
  imputeMethod: "ffill-bfill-median",
};

/** Per-stage statistics for expandable trace view */
export interface StageTrace {
  stage: PreprocessStage;
  inputMin: number;
  inputMax: number;
  inputMean: number;
  inputStd: number;
  inputNaN: number;
  outputMin: number;
  outputMax: number;
  outputMean: number;
  outputStd: number;
  outputNaN: number;
  valuesChanged: number;    // how many values were modified
  processingTimeMs: number; // wall time for this stage
  detail?: string;          // human-readable summary
}

export interface PreprocessResult {
  /** Processed factor values */
  values: number[];
  /** Per-stage trace for expandable UI inspection */
  trace: StageTrace[];
  /** Overall processing time */
  totalTimeMs: number;
  /** Total values modified across all stages */
  totalModified: number;
}

/** Cross-section context optionally provided by caller */
export interface CrossSectionContext {
  /** Market cap per symbol (same length as values, NaN if unavailable) */
  marketCaps?: number[];
  /** Industry code per symbol (same length, NaN if unavailable) */
  industryCodes?: number[];
}

// ── Statistics Helpers ─────────────────────────────────────────────────────

interface SeriesStats {
  min: number;
  max: number;
  mean: number;
  std: number;
  nanCount: number;
  nonNanCount: number;
  median: number;
  mad: number; // Median Absolute Deviation
}

function computeStats(arr: number[]): SeriesStats {
  const valid = arr.filter((v) => !isNaN(v));
  const n = valid.length;
  if (n === 0) {
    return { min: NaN, max: NaN, mean: NaN, std: NaN, nanCount: arr.length, nonNanCount: 0, median: NaN, mad: 0 };
  }

  valid.sort((a, b) => a - b);
  const min = valid[0];
  const max = valid[valid.length - 1];
  const sum = valid.reduce((s, v) => s + v, 0);
  const mean = sum / n;
  const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  // Median
  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (valid[mid - 1] + valid[mid]) / 2 : valid[mid];

  // MAD
  const absDevs = valid.map((v) => Math.abs(v - median));
  absDevs.sort((a, b) => a - b);
  const mad = n % 2 === 0
    ? (absDevs[mid - 1] + absDevs[mid]) / 2
    : absDevs[mid];

  return {
    min, max, mean, std,
    nanCount: arr.length - n,
    nonNanCount: n,
    median, mad,
  };
}

// ── Factor Preprocessor Engine ─────────────────────────────────────────────

export class FactorPreprocessor {
  private config: PreprocessConfig;

  constructor(config: Partial<PreprocessConfig> = {}) {
    this.config = { ...DEFAULT_PREPROCESS_CONFIG, ...config };
  }

  /** Main pipeline entry: process raw factor values through all enabled stages */
  process(
    values: number[],
    context?: CrossSectionContext,
  ): PreprocessResult {
    const t0 = performance.now();
    const trace: StageTrace[] = [];
    let data = [...values];
    let totalModified = 0;

    for (const stage of this.config.stages) {
      const before = computeStats(data);
      const tStage = performance.now();

      switch (stage) {
        case "mad_outlier":
          data = this.stageMADOutlier(data, before);
          break;
        case "industry_neutralize":
          data = this.stageIndustryNeutralize(data, context, before);
          break;
        case "marketcap_neutralize":
          data = this.stageMarketCapNeutralize(data, context, before);
          break;
        case "zscore":
          data = this.stageZScore(data, before);
          break;
        case "impute":
          data = this.stageImpute(data, before, context);
          break;
      }

      const after = computeStats(data);
      const elapsed = performance.now() - tStage;
      const changed = this.countChanges(values, data, before.nanCount);

      trace.push({
        stage,
        inputMin: before.min,
        inputMax: before.max,
        inputMean: before.mean,
        inputStd: before.std,
        inputNaN: before.nanCount,
        outputMin: after.min,
        outputMax: after.max,
        outputMean: after.mean,
        outputStd: after.std,
        outputNaN: after.nanCount,
        valuesChanged: changed,
        processingTimeMs: Math.round(elapsed * 1000) / 1000,
        detail: this.buildDetail(stage, before, after, changed),
      });

      totalModified += changed;
    }

    return {
      values: data,
      trace,
      totalTimeMs: Math.round((performance.now() - t0) * 1000) / 1000,
      totalModified,
    };
  }

  /** Process multiple factors in parallel (same data context) */
  processBatch(
    factors: Record<string, number[]>,
    context?: CrossSectionContext,
  ): Record<string, PreprocessResult> {
    const results: Record<string, PreprocessResult> = {};
    for (const [name, values] of Object.entries(factors)) {
      results[name] = this.process(values, context);
    }
    return results;
  }

  // ── Stage 1: MAD Outlier Removal ─────────────────────────────────────────
  // Capping: values beyond 5*MAD from median are capped at median ± 5*MAD
  private stageMADOutlier(data: number[], stats: SeriesStats): number[] {
    if (stats.nonNanCount < this.config.madMinObs || stats.mad === 0) {
      return data;
    }

    const lower = stats.median - this.config.madMultiplier * stats.mad;
    const upper = stats.median + this.config.madMultiplier * stats.mad;

    return data.map((v) => {
      if (isNaN(v)) return v;
      if (v > upper) return upper;
      if (v < lower) return lower;
      return v;
    });
  }

  // ── Stage 2: Industry Neutralization ─────────────────────────────────────
  // Demean within each industry group: subtract industry median from each value
  private stageIndustryNeutralize(
    data: number[],
    context: CrossSectionContext | undefined,
    stats: SeriesStats,
  ): number[] {
    if (!context?.industryCodes || context.industryCodes.length !== data.length) {
      return data; // no industry info → pass through
    }

    // Group values by industry code
    const groups = new Map<number, number[]>();
    const indexMap = new Map<number, number[]>();

    for (let i = 0; i < data.length; i++) {
      if (isNaN(data[i]) || isNaN(context.industryCodes[i])) continue;
      const code = context.industryCodes[i];
      if (!groups.has(code)) {
        groups.set(code, []);
        indexMap.set(code, []);
      }
      groups.get(code)!.push(data[i]);
      indexMap.get(code)!.push(i);
    }

    const result = [...data];

    for (const [code, groupValues] of groups.entries()) {
      if (groupValues.length < 3) continue; // too small to neutralize
      const gs = computeStats(groupValues);
      if (isNaN(gs.median)) continue;

      const indices = indexMap.get(code)!;
      for (const idx of indices) {
        if (!isNaN(result[idx])) {
          result[idx] = result[idx] - gs.median;
        }
      }
    }

    return result;
  }

  // ── Stage 3: Market Cap Neutralization ───────────────────────────────────
  // Simple cross-sectional regression: factor ~ marketCap, subtract fitted
  private stageMarketCapNeutralize(
    data: number[],
    context: CrossSectionContext | undefined,
    stats: SeriesStats,
  ): number[] {
    if (!context?.marketCaps || context.marketCaps.length !== data.length) {
      return data; // no market cap info → pass through
    }

    // Log-transform market cap (more linear with factor exposures)
    const logMktCaps = context.marketCaps.map((mc) =>
      mc > 0 ? Math.log(mc) : NaN,
    );

    // Build pairs of (x=logMktCap, y=factorValue) where both exist
    const pairs: { x: number; y: number }[] = [];
    const validIndices: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(data[i]) && !isNaN(logMktCaps[i])) {
        pairs.push({ x: logMktCaps[i], y: data[i] });
        validIndices.push(i);
      }
    }

    if (pairs.length < 10) return data; // need decent sample for regression

    // Simple OLS: y = alpha + beta * x → residual = y - (alpha + beta * x)
    const n = pairs.length;
    const sumX = pairs.reduce((s, p) => s + p.x, 0);
    const sumY = pairs.reduce((s, p) => s + p.y, 0);
    const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = pairs.reduce((s, p) => s + p.x * p.x, 0);

    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 0.000001) return data;

    const beta = (n * sumXY - sumX * sumY) / denom;
    const alpha = (sumY - beta * sumX) / n;

    const result = [...data];
    for (let i = 0; i < result.length; i++) {
      if (!isNaN(result[i]) && !isNaN(logMktCaps[i])) {
        result[i] = result[i] - (alpha + beta * logMktCaps[i]);
      }
    }

    return result;
  }

  // ── Stage 4: Z-Score Standardization ─────────────────────────────────────
  private stageZScore(data: number[], stats: SeriesStats): number[] {
    const denom = stats.std + this.config.zscoreEpsilon;
    return data.map((v) => {
      if (isNaN(v) || isNaN(stats.mean) || denom === 0) return v;
      return (v - stats.mean) / denom;
    });
  }

  // ── Stage 5: Missing Value Imputation ────────────────────────────────────
  private stageImpute(
    data: number[],
    statsIn: SeriesStats,
    context?: CrossSectionContext,
  ): number[] {
    const result = [...data];

    if (this.config.imputeMethod === "median") {
      // Cross-section median fill only
      const fill = isNaN(statsIn.median) ? 0 : statsIn.median;
      for (let i = 0; i < result.length; i++) {
        if (isNaN(result[i])) result[i] = fill;
      }
      return result;
    }

    // ffill-bfill-median: forward-fill → backward-fill → cross-section median
    // Forward fill
    let lastValid = NaN;
    for (let i = 0; i < result.length; i++) {
      if (isNaN(result[i])) {
        result[i] = lastValid;
      } else {
        lastValid = result[i];
      }
    }

    // Backward fill remaining NaN at the front
    let nextValid = NaN;
    for (let i = result.length - 1; i >= 0; i--) {
      if (isNaN(result[i])) {
        result[i] = nextValid;
      } else {
        nextValid = result[i];
      }
    }

    // If still NaN after both fills, use cross-section median
    const fallback = isNaN(statsIn.median) ? 0 : statsIn.median;
    for (let i = 0; i < result.length; i++) {
      if (isNaN(result[i])) {
        result[i] = fallback;
      }
    }

    return result;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private countChanges(original: number[], processed: number[], nanBefore: number): number {
    let changed = 0;
    for (let i = 0; i < original.length; i++) {
      if (isNaN(original[i]) && !isNaN(processed[i])) {
        changed++; // imputed
      } else if (!isNaN(original[i]) && isNaN(processed[i])) {
        changed++; // shouldn't happen but count it
      } else if (!isNaN(original[i]) && !isNaN(processed[i])) {
        if (Math.abs(original[i] - processed[i]) > 0.000001) {
          changed++;
        }
      }
    }
    return changed;
  }

  private buildDetail(
    stage: PreprocessStage,
    before: SeriesStats,
    after: SeriesStats,
    changed: number,
  ): string {
    const names: Record<PreprocessStage, string> = {
      mad_outlier: "MAD Outlier",
      industry_neutralize: "Industry Neutralize",
      marketcap_neutralize: "MarketCap Neutralize",
      zscore: "Z-Score",
      impute: "Impute",
    };

    const lines = [`${names[stage]}: ${changed} values modified`];

    if (!isNaN(before.min) && !isNaN(after.min)) {
      lines.push(`Range: [${before.min.toFixed(3)}, ${before.max.toFixed(3)}] → [${after.min.toFixed(3)}, ${after.max.toFixed(3)}]`);
    }
    if (!isNaN(before.std) && !isNaN(after.std)) {
      lines.push(`σ: ${before.std.toFixed(3)} → ${after.std.toFixed(3)}`);
    }
    if (before.nanCount !== after.nanCount) {
      lines.push(`NaN: ${before.nanCount} → ${after.nanCount}`);
    }

    return lines.join(" | ");
  }

  /** Reset config */
  updateConfig(patch: Partial<PreprocessConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  /** Get current config */
  getConfig(): PreprocessConfig {
    return { ...this.config };
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

let _defaultPreprocessor: FactorPreprocessor | null = null;

export function getPreprocessor(): FactorPreprocessor {
  if (!_defaultPreprocessor) {
    _defaultPreprocessor = new FactorPreprocessor();
  }
  return _defaultPreprocessor;
}

export function createPreprocessor(config?: Partial<PreprocessConfig>): FactorPreprocessor {
  return new FactorPreprocessor(config);
}

export default getPreprocessor;
