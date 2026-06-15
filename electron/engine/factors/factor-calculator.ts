// ══ R184 P0: Factor Calculator Template Framework ══
// Abstract FactorCalculator base class + 3 concrete template types:
//   RatioCalculator  — ratio-based factors (P/E, Cash/Price, Debt/Equity, etc.)
//   RankCalculator   — cross-sectional ranking factors (size, momentum, etc.)
//   SignalCalculator — signal/trigger based factors (MA cross, RSI, KDJ, etc.)
//
// Design principle: All factor calculators share a unified input/output contract
// so they can be composed, cached, and audited uniformly across the factor system.

import type { FactorId, FactorLevel1, FactorLevel2 } from './factor-id-registry';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/** Raw input data for a single security at a single timestamp */
export interface FactorInput {
  /** Security identifier (ticker, exchange code, or contract symbol) */
  symbol: string;
  /** Market (US, HK, CRYPTO, etc.) */
  market: string;
  /** Reference timestamp (ISO 8601 or Unix ms) */
  timestamp: number;
  /** Open/high/low/close/volume snapshot */
  priceData: PriceSnapshot;
  /** Fundamental data (optional — may not be available for all symbols) */
  fundamental?: FundamentalSnapshot;
  /** On-chain data (crypto only) */
  onChain?: OnChainSnapshot;
  /** Macro indicator context */
  macroContext?: MacroSnapshot;
  /** Arbitrary extension for custom factor data */
  extra?: Record<string, unknown>;
}

export interface PriceSnapshot {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Previous close (for gap calculation) */
  prevClose?: number;
  /** Adjusted close (for dividend/split handling) */
  adjClose?: number;
  /** Unix timestamp of this snapshot */
  timestamp?: number;
  /** ISO date string */
  date?: string;
}

export interface FundamentalSnapshot {
  /** Market cap (in reporting currency) */
  marketCap?: number;
  /** Total revenue (TTM) */
  revenue?: number;
  /** Net income (TTM) */
  netIncome?: number;
  /** Book value per share */
  bookValuePerShare?: number;
  /** Earnings per share (TTM) */
  eps?: number;
  /** Dividends per share (TTM) */
  dps?: number;
  /** Free cash flow (TTM) */
  freeCashFlow?: number;
  /** Total assets */
  totalAssets?: number;
  /** Total liabilities */
  totalLiabilities?: number;
  /** Current ratio */
  currentRatio?: number;
  /** Return on equity (TTM, decimal) */
  roe?: number;
  /** Gross margin (TTM, decimal) */
  grossMargin?: number;
  /** Operating cash flow (TTM) */
  operatingCashFlow?: number;
  /** Interest expense (TTM) */
  interestExpense?: number;
  /** EBITDA (TTM) */
  ebitda?: number;
  /** Piotroski F-Score (0-9) */
  fScore?: number;
  /** ESG composite score */
  esgScore?: number;
}

export interface OnChainSnapshot {
  /** Network value to transactions ratio */
  nvt?: number;
  /** Market value to realized value ratio */
  mvrv?: number;
  /** Number of active addresses (daily) */
  activeAddresses?: number;
  /** Exchange net flow (positive = inflow) */
  exchangeNetFlow?: number;
  /** Total value locked (USD) */
  tvl?: number;
  /** Staking yield (annualized, decimal) */
  stakingYield?: number;
  /** Protocol fee revenue (daily, USD) */
  feeRevenue?: number;
  /** Developer activity score */
  developerActivity?: number;
  /** Stablecoin supply ratio */
  stablecoinRatio?: number;
  /** Network hash rate (hashes/sec) */
  hashRate?: number;
  /** Gas used (daily, gwei) */
  gasUsed?: number;
  /** Staking ratio (decimal, 0-1) */
  stakingRatio?: number;
  /** Total value locked (USD, alias for tvl) */
  totalValueLocked?: number;
  /** Whale transaction count (daily, transfers > $100k) */
  whaleTransactionCount?: number;
  /** Supply held on exchanges */
  supplyOnExchanges?: number;
  /** Spent Output Profit Ratio (SOPR) */
  sopr?: number;
  /** Puell Multiple (mining revenue ratio) */
  puellMultiple?: number;
  /** Exchange inflow (transfer volume to exchanges) */
  exchangeInflow?: number;
  /** Exchange outflow (transfer volume from exchanges) */
  exchangeOutflow?: number;
  /** Network hash rate (hashes/sec, alias) */
  networkHashRate?: number;
  /** Timestamp of data snapshot */
  timestamp?: number;
}

export interface MacroSnapshot {
  /** VIX / volatility index */
  vix?: number;
  /** US 10Y treasury yield (decimal) */
  us10y?: number;
  /** US 2Y treasury yield (decimal) */
  us2y?: number;
  /** USD index */
  dxy?: number;
  /** WTI crude oil price */
  oil?: number;
  /** Gold spot price */
  gold?: number;
  /** Bitcoin price (as macro reference) */
  btc?: number;
  /** PMI manufacturing */
  pmi?: number;
  /** CPI YoY change (decimal) */
  cpi?: number;
  /** Fed funds rate (decimal) */
  fedFundsRate?: number;
  /** Credit spread (Baa-Aaa, decimal) */
  creditSpread?: number;
}

/** Normalized factor output */
export interface FactorOutput {
  /** Factor ID per the canonical registry */
  factorId: FactorId;
  /** Symbol this factor was computed for */
  symbol: string;
  /** Timestamp of the computation */
  timestamp: number;
  /**
   * Normalized factor value.
   * - RatioCalculator: returns the raw ratio (e.g., P/E = 15.3)
   * - RankCalculator: returns cross-sectional percentile [0, 1]
   * - SignalCalculator: returns discrete signal [-1, 0, +1]
   */
  value: number;
  /**
   * Z-score of value within the cross-section (undefined if singleton).
   */
  zScore?: number;
  /**
   * Raw/unscaled value before normalization (for audit/debug).
   */
  rawValue?: number;
  /**
   * Factor percentile in cross-section [0, 1] (set by RankCalculator, optional for others).
   */
  percentile?: number;
  /**
   * Confidence score [0, 1] — how reliable the factor computation is.
   */
  confidence: number;
  /**
   * Human-readable label for display.
   */
  label?: string;
  /**
   * Arbitrary metadata (e.g., sub-component breakdown).
   */
  metadata?: Record<string, unknown>;
}

/** Result of computing a factor for a single symbol */
export interface FactorResult {
  /** The computed factor output */
  output: FactorOutput;
  /** Any warnings (data gaps, boundary issues, etc.) */
  warnings: string[];
  /** Computation duration in ms */
  computeTimeMs: number;
}

/** Result of computing a factor across a cross-section of symbols */
export interface FactorCrossSectionResult {
  /** Factor ID */
  factorId: FactorId;
  /** Timestamp */
  timestamp: number;
  /** All individual results */
  results: FactorResult[];
  /** Cross-sectional statistics */
  stats: CrossSectionStats;
  /** Total computation duration in ms */
  totalComputeTimeMs: number;
}

export interface CrossSectionStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  /** Number of results with warnings */
  warningCount: number;
}

// ═══════════════════════════════════════════════════════════════════
// ABSTRACT BASE CLASS
// ═══════════════════════════════════════════════════════════════════

export interface FactorCalculatorConfig {
  /** Factor ID from canonical registry */
  factorId: FactorId;
  /** Factor L1 category */
  level1: FactorLevel1;
  /** Factor L2 sub-category */
  level2: FactorLevel2;
  /** Human-readable label for the factor */
  label?: string;
  /** Minimum number of data points required for a valid computation */
  minDataPoints?: number;
  /**
   * Lookback window in days (or candles). Used for factors that
   * require historical data (momentum, volatility, etc.).
   */
  lookbackDays?: number;
  /**
   * Whether to compute confidence based on data quality metrics.
   */
  enableConfidence?: boolean;
}

export abstract class FactorCalculator {
  readonly factorId: FactorId;
  readonly level1: FactorLevel1;
  readonly level2: FactorLevel2;
  readonly label: string;
  protected readonly minDataPoints: number;
  protected readonly lookbackDays: number;
  protected readonly enableConfidence: boolean;

  constructor(config: FactorCalculatorConfig) {
    this.factorId = config.factorId;
    this.level1 = config.level1;
    this.level2 = config.level2;
    this.label = config.label ?? config.factorId;
    this.minDataPoints = config.minDataPoints ?? 1;
    this.lookbackDays = config.lookbackDays ?? 0;
    this.enableConfidence = config.enableConfidence ?? true;
  }

  /**
   * Validate input data before computation.
   * Override for factor-specific validation rules.
   */
  protected validate(input: FactorInput): string[] {
    const warnings: string[] = [];
    if (!input.symbol) warnings.push('Missing symbol');
    if (!input.priceData || input.priceData.close <= 0) {
      warnings.push('Invalid or missing price data');
    }
    return warnings;
  }

  /**
   * Compute confidence [0, 1] for a result.
   * Base implementation: 1.0 minus penalty for each warning.
   */
  protected computeConfidence(warnings: string[]): number {
    if (!this.enableConfidence) return 1.0;
    if (warnings.length === 0) return 1.0;
    return Math.max(0, 1.0 - warnings.length * 0.1);
  }

  /**
   * Core computation to be implemented by subclasses.
   */
  protected abstract compute(input: FactorInput): { value: number; rawValue?: number; label?: string; metadata?: Record<string, unknown> };

  /**
   * Normalize value to z-score within a cross-section.
   * Called externally after computing individual results.
   */
  static computeZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0 || isNaN(stdDev)) return 0;
    return (value - mean) / stdDev;
  }

  /**
   * Compute cross-sectional statistics from a list of values.
   */
  static computeCrossSectionStats(values: number[]): CrossSectionStats {
    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, mean: 0, median: 0, stdDev: 0, warningCount: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = n % 2 === 1
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
    return {
      count: n,
      min: sorted[0],
      max: sorted[n - 1],
      mean,
      median,
      stdDev: Math.sqrt(variance),
      warningCount: 0,
    };
  }

  /**
   * Public API: compute factor for a single symbol.
   */
  computeForSymbol(input: FactorInput): FactorResult {
    const t0 = Date.now();
    const warnings = this.validate(input);
    let value = NaN;
    let rawValue: number | undefined;
    let label: string | undefined;
    let metadata: Record<string, unknown> | undefined;

    try {
      const result = this.compute(input);
      value = result.value;
      rawValue = result.rawValue;
      label = result.label;
      metadata = result.metadata;
    } catch (err) {
      warnings.push(`Computation error: ${err instanceof Error ? err.message : String(err)}`);
    }

    const confidence = this.computeConfidence(warnings);
    const computeTimeMs = Date.now() - t0;

    return {
      output: {
        factorId: this.factorId,
        symbol: input.symbol,
        timestamp: input.timestamp,
        value: isNaN(value) ? 0 : value,
        rawValue,
        confidence,
        label: label ?? this.label,
        metadata,
      },
      warnings,
      computeTimeMs,
    };
  }

  /**
   * Public API: compute factor across a cross-section of symbols.
   */
  computeCrossSection(inputs: FactorInput[]): FactorCrossSectionResult {
    const t0 = Date.now();
    const results = inputs.map(input => this.computeForSymbol(input));
    const values = results.map(r => r.output.value).filter(v => !isNaN(v) && isFinite(v));
    const stats = FactorCalculator.computeCrossSectionStats(values);

    // Apply z-score normalization
    for (const result of results) {
      if (stats.stdDev > 0 && isFinite(result.output.value)) {
        result.output.zScore = FactorCalculator.computeZScore(result.output.value, stats.mean, stats.stdDev);
      }
    }

    stats.warningCount = results.filter(r => r.warnings.length > 0).length;

    return {
      factorId: this.factorId,
      timestamp: inputs[0]?.timestamp ?? 0,
      results,
      stats,
      totalComputeTimeMs: Date.now() - t0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 1: RatioCalculator
// ═══════════════════════════════════════════════════════════════════
//
// For factors computed as a ratio of two quantities:
//   P/E, P/B, Cash/Price, Debt/Equity, Dividend Yield, NVT, MVRV, etc.
//
// Usage:
//   const peCalc = new RatioCalculator({
//     factorId: 'EP_RATIO',
//     level1: 'L1_CLASSIC',
//     level2: 'L2_VALUE',
//     numerator: 'eps',       // from fundamental snapshot
//     denominator: 'close',   // from price snapshot
//     invert: false,          // EP_RATIO = EPS/Price (higher=cheaper)
//   });

export interface RatioCalculatorConfig extends FactorCalculatorConfig {
  /** Path to numerator field (e.g., 'eps', 'freeCashFlow', 'dps') */
  numerator:
    | keyof FundamentalSnapshot
    | keyof OnChainSnapshot
    | keyof PriceSnapshot
    | string;
  /** Path to denominator field (same type domains) */
  denominator:
    | keyof FundamentalSnapshot
    | keyof OnChainSnapshot
    | keyof PriceSnapshot
    | string;
  /**
   * If true, returns 1/ratio. Useful for factors where a higher value is
   * "better" (e.g., EP_RATIO where higher = cheaper = better value).
   */
  invert?: boolean;
  /**
   * Floor value to prevent division-by-zero and extreme ratios.
   * If denominator < floor, denominator = floor.
   */
  denominatorFloor?: number;
  /**
   * Ceiling for NaN/infinite clamping.
   */
  valueCap?: number;
}

export class RatioCalculator extends FactorCalculator {
  private numerator: string;
  private denominator: string;
  private invert: boolean;
  private denominatorFloor: number;
  private valueCap: number;

  constructor(config: RatioCalculatorConfig) {
    super(config);
    this.numerator = config.numerator;
    this.denominator = config.denominator;
    this.invert = config.invert ?? false;
    this.denominatorFloor = config.denominatorFloor ?? 1e-10;
    this.valueCap = config.valueCap ?? 1e6;
  }

  /**
   * Resolve a field path from any of the snapshots.
   */
  private resolveField(input: FactorInput, field: string): number | undefined {
    // Check fundamental
    if (field in (input.fundamental ?? {})) {
      return (input.fundamental as Record<string, number | undefined>)[field];
    }
    // Check onChain
    if (field in (input.onChain ?? {})) {
      return (input.onChain as Record<string, number | undefined>)[field];
    }
    // Check price data
    if (field in input.priceData) {
      return (input.priceData as unknown as Record<string, number | undefined>)[field];
    }
    return undefined;
  }

  protected override validate(input: FactorInput): string[] {
    const warnings = super.validate(input);
    const num = this.resolveField(input, this.numerator);
    const den = this.resolveField(input, this.denominator);
    if (num === undefined) warnings.push(`Missing numerator: ${this.numerator}`);
    if (den === undefined) warnings.push(`Missing denominator: ${this.denominator}`);
    if (den !== undefined && den === 0) warnings.push('Denominator is zero');
    return warnings;
  }

  protected compute(input: FactorInput): { value: number; rawValue?: number; label?: string; metadata?: Record<string, unknown> } {
    const num = this.resolveField(input, this.numerator) ?? NaN;
    const den = Math.max(this.resolveField(input, this.denominator) ?? NaN, this.denominatorFloor);

    if (isNaN(num) || isNaN(den) || !isFinite(den)) {
      return { value: NaN };
    }

    let ratio = num / den;
    if (this.invert) {
      ratio = den / num;
    }

    // Clamp extreme values
    if (!isFinite(ratio) || Math.abs(ratio) > this.valueCap) {
      ratio = Math.sign(ratio) * this.valueCap;
    }

    return {
      value: ratio,
      rawValue: ratio,
      metadata: {
        numerator: num,
        denominator: den,
        invert: this.invert,
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 2: RankCalculator
// ═══════════════════════════════════════════════════════════════════
//
// For cross-sectional ranking factors:
//   Size (market cap percentile), momentum ranking, volume ranking, etc.
//
// The RankCalculator computes individual factor values first, then
// ranks them across the cross-section to produce percentile outputs.
//
// Usage:
//   const sizeCalc = new RankCalculator({
//     factorId: 'SIZE',
//     level1: 'L1_CLASSIC',
//     level2: 'L2_SIZE',
//     valueExtractor: (input) => input.fundamental?.marketCap ?? 0,
//     ascending: false,  // larger cap = lower rank (small cap premium)
//   });

export interface RankCalculatorConfig extends FactorCalculatorConfig {
  /**
   * Extract the raw value to rank from each input.
   * Returns the raw metric (market cap, past return %, volume, etc.).
   */
  valueExtractor: (input: FactorInput) => number;
  /**
   * If true, ranks in ascending order (smallest = rank 0).
   * If false, ranks in descending order (largest = rank 0).
   */
  ascending?: boolean;
}

export class RankCalculator extends FactorCalculator {
  private valueExtractor: (input: FactorInput) => number;
  private ascending: boolean;

  constructor(config: RankCalculatorConfig) {
    super(config);
    this.valueExtractor = config.valueExtractor;
    this.ascending = config.ascending ?? true;
  }

  protected override validate(input: FactorInput): string[] {
    const warnings = super.validate(input);
    const raw = this.valueExtractor(input);
    if (raw === undefined || raw === null || isNaN(raw)) {
      warnings.push('Value extractor returned NaN/null');
    }
    return warnings;
  }

  protected compute(input: FactorInput): { value: number; rawValue?: number; label?: string; metadata?: Record<string, unknown> } {
    const raw = this.valueExtractor(input);
    return {
      // Placeholder — actual percentile assigned in computeCrossSection
      value: isNaN(raw) ? 0 : raw,
      rawValue: raw,
    };
  }

  /**
   * Override cross-section to apply ranking after all raw values are collected.
   */
  override computeCrossSection(inputs: FactorInput[]): FactorCrossSectionResult {
    const t0 = Date.now();

    // Phase 1: compute raw values
    const rawResults = inputs.map(input => ({
      input,
      result: this.computeForSymbol(input),
    }));

    // Phase 2: rank raw values
    const rawValues = rawResults.map(r => r.result.output.rawValue).filter(
      (v): v is number => v !== undefined && !isNaN(v) && isFinite(v)
    );
    const sorted = [...rawValues].sort((a, b) => a - b);
    const n = sorted.length;

    // Phase 3: assign percentiles
    const rankMap = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const raw = sorted[i];
      if (this.ascending) {
        rankMap.set(raw, i / (n - 1));
      } else {
        rankMap.set(raw, (n - 1 - i) / (n - 1));
      }
    }

    // Phase 4: update outputs
    const results: FactorResult[] = rawResults.map(({ input, result }) => {
      const raw = result.output.rawValue;
      if (raw !== undefined && rankMap.has(raw)) {
        result.output.percentile = rankMap.get(raw);
        result.output.value = result.output.percentile!;
      }
      return result;
    });

    const stats = FactorCalculator.computeCrossSectionStats(results.map(r => r.output.value));
    stats.warningCount = results.filter(r => r.warnings.length > 0).length;

    return {
      factorId: this.factorId,
      timestamp: inputs[0]?.timestamp ?? 0,
      results,
      stats,
      totalComputeTimeMs: Date.now() - t0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 3: SignalCalculator
// ═══════════════════════════════════════════════════════════════════
//
// For discrete signal/trigger factors:
//   MA crossover (golden cross / death cross), RSI threshold, KDJ,
//   MACD signal, Bollinger squeeze, Ichimoku cloud flip, etc.
//
// Output is always in {-1, 0, +1}:
//   +1 = bullish signal
//    0 = neutral / no signal
//   -1 = bearish signal
//
// Usage:
//   const maCrossCalc = new SignalCalculator({
//     factorId: 'MA_20_60',
//     level1: 'L1_TECHNICAL',
//     level2: 'L2_TREND',
//     signalFn: (input, history) => {
//       const ma20 = computeSMA(history, 20);
//       const ma60 = computeSMA(history, 60);
//       if (ma20 > ma60) return 1;
//       if (ma20 < ma60) return -1;
//       return 0;
//     },
//   });

export interface SignalCalculatorConfig extends FactorCalculatorConfig {
  /**
   * Signal function: given current input and price history,
   * returns -1, 0, or +1.
   */
  signalFn: (input: FactorInput, history: PriceSnapshot[]) => SignalResult;
  /**
   * Number of historical candles needed (default: derived from lookbackDays).
   */
  historyLength?: number;
}

export interface SignalResult {
  /** Signal direction: -1, 0, or +1 */
  signal: number;
  /** Signal strength (0-1) — how pronounced the signal is */
  strength?: number;
  /** Human-readable signal description */
  description?: string;
  /** Additional signal metadata */
  metadata?: Record<string, unknown>;
}

export class SignalCalculator extends FactorCalculator {
  private signalFn: (input: FactorInput, history: PriceSnapshot[]) => SignalResult;
  private historyLength: number;

  constructor(config: SignalCalculatorConfig) {
    super(config);
    this.signalFn = config.signalFn;
    this.historyLength = config.historyLength ?? config.lookbackDays ?? 60;
  }

  protected override validate(input: FactorInput): string[] {
    const warnings = super.validate(input);
    return warnings;
  }

  computeForSymbol(input: FactorInput, history?: PriceSnapshot[]): FactorResult {
    const t0 = Date.now();
    const warnings = this.validate(input);
    let value = 0;
    let metadata: Record<string, unknown> | undefined;

    try {
      const hist = history ?? [];
      const result = this.signalFn(input, hist);
      value = Math.sign(result.signal);
      // Clamp to -1/0/+1
      if (value > 1) value = 1;
      if (value < -1) value = -1;
      metadata = {
        strength: result.strength,
        description: result.description,
        ...(result.metadata ?? {}),
      };
    } catch (err) {
      warnings.push(`Signal computation error: ${err instanceof Error ? err.message : String(err)}`);
    }

    const confidence = this.computeConfidence(warnings);
    const computeTimeMs = Date.now() - t0;

    return {
      output: {
        factorId: this.factorId,
        symbol: input.symbol,
        timestamp: input.timestamp,
        value,
        confidence,
        label: this.label,
        metadata,
      },
      warnings,
      computeTimeMs,
    };
  }

  protected compute(input: FactorInput): { value: number; rawValue?: number; label?: string; metadata?: Record<string, unknown> } {
    const result = this.signalFn(input, []);
    const value = Math.min(1, Math.max(-1, Math.sign(result.signal)));
    return {
      value,
      metadata: {
        strength: result.strength,
        description: result.description,
        ...(result.metadata ?? {}),
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════

export type FactorCalculatorType = 'ratio' | 'rank' | 'signal';

/**
 * Create a FactorCalculator from a factory config.
 */
export function createFactorCalculator(
  config: RatioCalculatorConfig & { type: 'ratio' }
): RatioCalculator;
export function createFactorCalculator(
  config: RankCalculatorConfig & { type: 'rank' }
): RankCalculator;
export function createFactorCalculator(
  config: SignalCalculatorConfig & { type: 'signal' }
): SignalCalculator;
export function createFactorCalculator(
  config: (RatioCalculatorConfig | RankCalculatorConfig | SignalCalculatorConfig) & { type: FactorCalculatorType }
): FactorCalculator {
  switch (config.type) {
    case 'ratio':
      return new RatioCalculator(config as RatioCalculatorConfig);
    case 'rank':
      return new RankCalculator(config as RankCalculatorConfig);
    case 'signal':
      return new SignalCalculator(config as SignalCalculatorConfig);
    default:
      throw new Error(`Unknown calculator type: ${(config as any).type}`);
  }
}
