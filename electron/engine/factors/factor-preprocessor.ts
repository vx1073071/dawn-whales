// ── Factor Preprocessor: 5-Stage Pipeline (R160 P0-F4) ──────────────────
// MAD outlier → Industry neutralization → MarketCap neutralization → Z-score → Impute
// Silent execution, expandable trace view per symbol/factor

// ── Types ──────────────────────────────────────────────────────────────────

export type PreprocessStage =
  | "mad_outlier"
  | "industry_neutralize"
  | "marketcap_neutralize"
  | "market_adaptive"
  | "zscore"
  | "impute";

export type MarketAdaptiveMode = "equity" | "crypto" | "forex" | "commodity" | "auto";

export interface PreprocessConfig {
  /** Enabled stages (default: all 6) */
  stages: PreprocessStage[];
  /** MAD multiplier for outlier capping (default: 5.0) */
  madMultiplier: number;
  /** Minimum observations to compute MAD (default: 10) */
  madMinObs: number;
  /** Z-score epsilon to avoid division by zero */
  zscoreEpsilon: number;
  /** Impute method: forward-fill then backward-fill then cross-section median */
  imputeMethod: "ffill-bfill-median" | "ffill-median" | "median";
  /** R165: Market-adaptive neutralization mode */
  adaptiveMode: MarketAdaptiveMode;
  /** R165: Max leverage cap for crypto volatility normalization */
  adaptiveMaxLeverage: number;
}

export const DEFAULT_PREPROCESS_CONFIG: PreprocessConfig = {
  stages: ["mad_outlier", "industry_neutralize", "marketcap_neutralize", "market_adaptive", "zscore", "impute"],
  madMultiplier: 5.0,
  madMinObs: 10,
  zscoreEpsilon: 1e-10,
  imputeMethod: "ffill-bfill-median",
  adaptiveMode: "auto",
  adaptiveMaxLeverage: 3.0,
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
  /** R165: Arbitrary metadata (market, timeframe, etc.) for adaptive mode detection */
  metadata?: Record<string, unknown>;
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
        case "market_adaptive":
          data = this.stageMarketAdaptive(data, context, before);
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

  // ── Stage 3b: Market-Adaptive Normalization (R165 P1-R2) ─────────────────
  /**
   * Market-adaptive neutralization: applies per-market normalization strategy.
   *
   * EQUITY: Re-apply industry+market-cap residuals if prior stages were
   *   generic. Uses GICS sectors for US, Hang Seng Industry for HK.
   * CRYPTO: Volatility-normalized scaling (rank-based, non-parametric) —
   *   traditional industry/MCap neutralization is meaningless for crypto.
   * FOREX/COMMODITY: Rank-normalize to [0, 1] with outlier clipping.
   * AUTO: Detect market from context or derive from data distribution.
   */
  private stageMarketAdaptive(
    data: number[],
    context: CrossSectionContext | undefined,
    stats: SeriesStats,
  ): number[] {
    const mode = this.detectAdaptiveMode(context);

    switch (mode) {
      case "crypto":
        return this.adaptiveCryptoNormalize(data, stats);
      case "forex":
      case "commodity":
        return this.adaptiveRankNormalize(data);
      case "equity":
      default:
        return this.adaptiveEquityRefine(data, context, stats);
    }
  }

  /**
   * Auto-detect market mode from context metadata.
   * Falls back to data-driven heuristics when no context is available.
   */
  private detectAdaptiveMode(context?: CrossSectionContext): MarketAdaptiveMode {
    if (this.config.adaptiveMode !== "auto") {
      return this.config.adaptiveMode;
    }

    // Use metadata hints from context
    if (context?.metadata) {
      const mkt = (context.metadata as Record<string, unknown>).market as string | undefined;
      if (mkt) {
        const m = mkt.toUpperCase();
        if (["CRYPTO", "CC", "BINANCE", "OKX"].some((k) => m.includes(k))) return "crypto";
        if (["FOREX", "FX", "CURRENCY"].some((k) => m.includes(k))) return "forex";
        if (["COMMODITY", "CME", "XAU", "XAG", "CL"].some((k) => m.includes(k))) return "commodity";
      }
    }

    // Data-driven heuristic: crypto factors often have higher kurtosis and
    // no meaningful industry/cap grouping → treat as equity by default with
    // a note that the user can override
    return "equity";
  }

  /**
   * Crypto-adaptive normalization:
   * - Rank-based transformation (non-parametric, robust to extreme values)
   * - Cross-section rank → uniform(0,1) → inverse normal
   * - Preserves ordinal relationships without assuming normality
   * - Caps leverage to config.adaptiveMaxLeverage
   */
  private adaptiveCryptoNormalize(data: number[], stats: SeriesStats): number[] {
    if (stats.nonNanCount < 5) return data;

    // Step 1: Compute ranks (1=lowest, N=highest)
    const valid: { idx: number; value: number }[] = [];
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(data[i])) valid.push({ idx: i, value: data[i] });
    }
    valid.sort((a, b) => a.value - b.value);

    // Step 2: Assign rank percentiles
    const n = valid.length;
    const ranks = new Map<number, number>();
    for (let r = 0; r < n; r++) {
      ranks.set(valid[r].idx, (r + 0.5) / n);
    }

    // Step 3: Inverse normal transform → z-like values bounded to [-maxLev, +maxLev]
    const result = [...data];
    const maxLev = this.config.adaptiveMaxLeverage;
    for (let i = 0; i < result.length; i++) {
      if (!isNaN(result[i])) {
        const p = ranks.get(i)!;
        // Approximate inverse normal (Abramowitz & Stegun)
        const z = this.inverseNormalCDF(p);
        result[i] = Math.max(-maxLev, Math.min(maxLev, z));
      }
    }

    return result;
  }

  /**
   * Forex/Commodity rank normalization: map to [0, 1] via percentile rank,
   * then clip outliers at top/bottom 1% to control noise.
   */
  private adaptiveRankNormalize(data: number[]): number[] {
    const valid: { idx: number; value: number }[] = [];
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(data[i])) valid.push({ idx: i, value: data[i] });
    }
    if (valid.length < 3) return data;

    valid.sort((a, b) => a.value - b.value);
    const n = valid.length;
    const ranks = new Map<number, number>();
    for (let r = 0; r < n; r++) {
      // Windsorize at 1% / 99%
      const pct = Math.max(0.01, Math.min(0.99, (r + 0.5) / n));
      ranks.set(valid[r].idx, pct);
    }

    const result = [...data];
    for (let i = 0; i < result.length; i++) {
      if (!isNaN(result[i])) {
        result[i] = ranks.get(i)!;
      }
    }
    return result;
  }

  /**
   * Equity adaptive refinement:
   * When prior industry + market-cap neutralization ran with generic
   * parameters, this stage checks residual correlation against known
   * sector/market-cap signals and cleans up remaining structure.
   * Falls back to identity pass-through if residuals are already clean.
   */
  private adaptiveEquityRefine(
    data: number[],
    context: CrossSectionContext | undefined,
    stats: SeriesStats,
  ): number[] {
    // Check if residuals still have structure: if std ≈ 0 or NaN count is high,
    // prior stages may have failed; apply rank-based fallback
    if (stats.nonNanCount < 10 || isNaN(stats.std) || stats.std < 0.01) {
      return this.adaptiveRankNormalize(data);
    }

    // Check for residual sector bias: if industry codes are available,
    // compute ANOVA F-statistic to detect remaining sector structure.
    if (context?.industryCodes && context.industryCodes.length === data.length) {
      const sectorResiduals = this.computeSectorResidualBias(data, context.industryCodes);
      if (sectorResiduals.fStat > 2.0) {
        // Significant sector bias remains → re-neutralize with stricter demeaning
        return this.stageIndustryNeutralize(data, context, stats);
      }
    }

    // No significant residual structure → pass through
    return data;
  }

  /**
   * Compute one-way ANOVA F-statistic for sector residual bias detection.
   * Returns {fStat, pValueApprox}. fStat > 2.0 suggests significant sector structure.
   */
  private computeSectorResidualBias(
    data: number[],
    industryCodes: number[],
  ): { fStat: number } {
    const groups = new Map<number, number[]>();
    for (let i = 0; i < data.length; i++) {
      if (isNaN(data[i]) || isNaN(industryCodes[i])) continue;
      const code = industryCodes[i];
      if (!groups.has(code)) groups.set(code, []);
      groups.get(code)!.push(data[i]);
    }

    const groupList = Array.from(groups.values()).filter((g) => g.length >= 3);
    if (groupList.length < 2) return { fStat: 0 };

    // Grand mean
    let totalSum = 0;
    let totalN = 0;
    for (const g of groupList) {
      totalSum += g.reduce((s, v) => s + v, 0);
      totalN += g.length;
    }
    const grandMean = totalSum / totalN;

    // Between-group SS
    let ssBetween = 0;
    for (const g of groupList) {
      const gMean = g.reduce((s, v) => s + v, 0) / g.length;
      ssBetween += g.length * (gMean - grandMean) ** 2;
    }

    // Within-group SS
    let ssWithin = 0;
    for (const g of groupList) {
      const gMean = g.reduce((s, v) => s + v, 0) / g.length;
      ssWithin += g.reduce((s, v) => s + (v - gMean) ** 2, 0);
    }

    const dfBetween = groupList.length - 1;
    const dfWithin = totalN - groupList.length;
    if (dfBetween <= 0 || dfWithin <= 0 || ssWithin < 0.0001) return { fStat: 0 };

    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;
    const fStat = msBetween / (msWithin + 0.0001);

    return { fStat };
  }

  /**
   * Abramowitz & Stegun approximation for inverse normal CDF.
   * Maps p ∈ (0, 1) → z-score. Max error < 4.5e-4.
   */
  private inverseNormalCDF(p: number): number {
    if (p <= 0) return -4;
    if (p >= 1) return 4;

    // Coefficients for rational approximation
    const a1 = -39.6968302866538;
    const a2 = 220.9460984245205;
    const a3 = -275.9285104469687;
    const a4 = 138.3577518672690;
    const a5 = -30.66479806614716;
    const a6 = 2.506628277459239;
    const b1 = -54.47609879822406;
    const b2 = 161.5858368580409;
    const b3 = -155.6989798598866;
    const b4 = 66.80131188771972;
    const b5 = -13.28068155288572;

    const q = p < 0.5 ? p : 1 - p;
    const r = Math.sqrt(-2 * Math.log(q));

    const num = ((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6;
    const den = ((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1;

    const z = num / den;
    return p < 0.5 ? -z : z;
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

// ── R218 JVS#1: 增强3步管线 (MAD + 行业中性化 + Z-score) + 质量报告 ─────

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface FactorQualityReport {
  timestamp: number;
  factorName: string;
  market: string;
  rawCount: number;
  validCount: number;
  outlierCount: number;
  outlierPct: number;
  industryBiasBefore: number;   // max industry avg deviation (raw)
  industryBiasAfter: number;    // after neutralization
  coverageScore: number;        // 0-1 valid/raw
  outlierScore: number;         // 0-1 inverted
  neutralityScore: number;      // 0-1 inverted
  normalizationScore: number;   // 0-1 (distribution closeness to normal)
  compositeQualityScore: number; // 0-100
  grade: QualityGrade;
  warnings: string[];
  recommendation: string;
}

export interface EnhancedPreprocessResult extends PreprocessResult {
  qualityReport: FactorQualityReport;
}

/**
 * R218 upgrade: runs the enhanced 3-step pipeline:
 *   1. MAD outlier detection & capping
 *   2. Industry neutralization (cross-sectional)
 *   3. Z-score normalization
 * Plus quality report with A-F grading.
 */
export function preprocessEnhanced(
  rawValues: number[],
  industryCodes: number[],
  factorName: string,
  market: string,
  config?: Partial<PreprocessConfig>,
): EnhancedPreprocessResult {
  const preprocessor = config ? new FactorPreprocessor(config) : getPreprocessor();

  const stages: PreprocessStage[] = ['mad_outlier', 'industry_neutralize', 'zscore'];

  // Run the 3-stage pipeline
  const baseResult = preprocessor.process(rawValues, {
    stages,
    industryCodes,
  });

  // ── Build quality report ─────────────────────────────────────────────
  const validValues = baseResult.values.filter(v => !isNaN(v) && isFinite(v));
  const rawCount = rawValues.length;
  const validCount = validValues.length;
  const outlierCount = baseResult.trace.find(t => t.stage === 'mad_outlier')?.valuesChanged || 0;
  const outlierPct = rawCount > 0 ? outlierCount / rawCount : 0;

  // Industry bias: max deviation of industry means from grand mean
  const allMean = validValues.reduce((s, v) => s + v, 0) / Math.max(1, validValues.length);
  const industryGroups = new Map<number, number[]>();
  for (let i = 0; i < rawValues.length; i++) {
    if (!isNaN(rawValues[i]) && isFinite(rawValues[i])) {
      const ic = industryCodes[i] ?? 0;
      const group = industryGroups.get(ic) || [];
      group.push(rawValues[i]);
      industryGroups.set(ic, group);
    }
  }
  let maxBiasBefore = 0;
  for (const [_, vals] of industryGroups) {
    const im = vals.reduce((s, v) => s + v, 0) / vals.length;
    maxBiasBefore = Math.max(maxBiasBefore, Math.abs(im - allMean));
  }

  // After neutralization, compute bias again on processed values
  const procIndustryGroups = new Map<number, number[]>();
  for (let i = 0; i < baseResult.values.length; i++) {
    if (!isNaN(baseResult.values[i]) && isFinite(baseResult.values[i])) {
      const ic = i < industryCodes.length ? (industryCodes[i] ?? 0) : 0;
      const group = procIndustryGroups.get(ic) || [];
      group.push(baseResult.values[i]);
      procIndustryGroups.set(ic, group);
    }
  }
  const procAllMean = validCount > 0
    ? baseResult.values.filter(v => !isNaN(v) && isFinite(v)).reduce((s, v) => s + v, 0) / validCount
    : 0;
  let maxBiasAfter = 0;
  for (const [_, vals] of procIndustryGroups) {
    const im = vals.reduce((s, v) => s + v, 0) / vals.length;
    maxBiasAfter = Math.max(maxBiasAfter, Math.abs(im - procAllMean));
  }

  // Coverage score
  const coverageScore = rawCount > 0 ? validCount / rawCount : 0;

  // Outlier score (inverted: fewer outliers = higher)
  const outlierScore = Math.max(0, 1 - outlierPct * 5); // 20%+ outliers = 0

  // Neutrality score (maxBiasAfter / allMean, inverted)
  const neutralityScore = allMean !== 0
    ? Math.max(0, 1 - Math.min(1, Math.abs(maxBiasAfter / Math.max(0.001, Math.abs(allMean)))))
    : 1;

  // Z-score distribution closeness to normal (skewness check)
  const n = validCount;
  const mean = n > 0 ? validValues.reduce((s, v) => s + v, 0) / n : 0;
  const variance = n > 1 ? validValues.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);
  let skewness = 0;
  if (std > 0 && n > 2) {
    skewness = validValues.reduce((s, v) => s + ((v - mean) / std) ** 3, 0) / n;
  }
  const normalizationScore = Math.max(0, 1 - Math.min(1, Math.abs(skewness) / 2)); // skew>2 = 0

  // Composite quality score (0-100)
  const compositeQualityScore = Math.round(
    (coverageScore * 30 + outlierScore * 25 + neutralityScore * 25 + normalizationScore * 20)
  );

  // Grading
  let grade: QualityGrade;
  if (compositeQualityScore >= 90) grade = 'A';
  else if (compositeQualityScore >= 75) grade = 'B';
  else if (compositeQualityScore >= 60) grade = 'C';
  else if (compositeQualityScore >= 40) grade = 'D';
  else grade = 'F';

  // Warnings
  const warnings: string[] = [];
  if (outlierPct > 0.1) warnings.push(`MAD检出${(outlierPct * 100).toFixed(1)}%离群值, 已截尾处理。`);
  if (coverageScore < 0.5) warnings.push(`因子覆盖率仅${(coverageScore * 100).toFixed(0)}%, 大量缺失数据。`);
  if (maxBiasAfter > Math.abs(allMean) * 0.2) warnings.push('行业中性化后偏差仍较大, 可能有未建模行业因子。');
  if (Math.abs(skewness) > 1.5) warnings.push(`偏度${skewness.toFixed(2)}, 分布严重非正态。`);
  if (grade === 'F') warnings.push('⚠️ 因子质量极差, 不建议用于实盘策略。');

  const qualityReport: FactorQualityReport = {
    timestamp: Date.now(),
    factorName,
    market,
    rawCount,
    validCount,
    outlierCount,
    outlierPct: Math.round(outlierPct * 10000) / 10000,
    industryBiasBefore: Math.round(maxBiasBefore * 10000) / 10000,
    industryBiasAfter: Math.round(maxBiasAfter * 10000) / 10000,
    coverageScore: Math.round(coverageScore * 1000) / 1000,
    outlierScore: Math.round(outlierScore * 1000) / 1000,
    neutralityScore: Math.round(neutralityScore * 1000) / 1000,
    normalizationScore: Math.round(normalizationScore * 1000) / 1000,
    compositeQualityScore,
    grade,
    warnings,
    recommendation: grade === 'A' || grade === 'B'
      ? '因子预处理质量良好, 可直接用于多因子模型。'
      : grade === 'C'
        ? '因子质量一般, 建议检查数据源或考虑权重折扣。'
        : '因子质量不足, 强烈建议追溯原始数据问题。',
  };

  return {
    ...baseResult,
    qualityReport,
  };
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
