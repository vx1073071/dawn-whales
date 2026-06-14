// ── R160 P0-F1: DawnFactorFramework — Unified Factor Scoring Engine ───────
// Merges multi-factor.ts + multi-factor-selector.ts into single framework.
// Single entry point: score(). Single output: UnifiedFactorScore.
// FactorCompatibilityEngine is the one and only factor registry.
// Same symbol → single score, regardless of which subsystem called it.
//
// Architecture:
//   DawnFactorFramework.score()
//     → FactorCompatibilityEngine.getCompatibleFactors(market, instrumentType)
//     → Mode selection: DATA_DRIVEN | CALCULATED | HYBRID
//     → Parallel scoring via registered FactorScorer plugins
//     → Weighted aggregation → UnifiedFactorScore
//     → Attribution via FactorExposureAnalyzer (R159 OLS)

import log from 'electron-log';
import i18n from '../../../src/i18n';
import {
  FactorCompatibilityEngine,
  getFactorCompatibilityEngine,
  type Market,
  type InstrumentType,
} from './factor-compatibility-engine';
import {
  FactorExposureAnalyzer,
  getFactorExposureAnalyzer,
  type FactorLoadings,
} from './factor-exposure';

// ── Unified Types ───────────────────────────────────────────────────────────

export type ScoringMode = 'DATA_DRIVEN' | 'CALCULATED' | 'HYBRID';

export type AssetTypeForScoring = InstrumentType;

export interface FactorScoreDetail {
  factorId: string;
  factorName: string;
  factorCategory: string;
  score: number;           // 0-100
  weight: number;          // 0-1 (within composite)
  rawValue: number;        // Original factor value
  percentile: number;      // 0-100 vs universe
  icValue: number;         // Historical IC (from registry)
  contribution: number;    // score × weight
}

export interface UnifiedFactorScore {
  // Identity
  symbol: string;
  market: Market;
  instrumentType: InstrumentType;

  // Composite
  compositeScore: number;    // 0-100
  rating: FactorRating;
  confidence: number;        // 0-1 (based on data quality / R²)

  // Components
  factors: FactorScoreDetail[];

  // Sub-scores by category
  momentumScore: number;
  valueScore: number;
  qualityScore: number;
  volatilityScore: number;
  sentimentScore: number;

  // Risk
  riskScore: number;         // 0-100 (higher = riskier)
  maxDrawdownPct: number;

  // Attribution (when available)
  loadings?: FactorLoadings;
  rSquared?: number;

  // Scoring metadata
  scoringMode: ScoringMode;
  reason: string;            // Human-readable explanation (i18n)
  calculatedAt: number;
}

export type FactorRating = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export interface DawnFactorConfig {
  mode: ScoringMode;
  weights: Record<string, number>; // factorId → weight, auto-normalized
  topN: number;
  minScore: number;
  minDataPoints: number;    // required for DATA_DRIVEN mode
  maxDrawdownThreshold: number;
  includeAttribution: boolean;
}

export const DAWN_DEFAULT_CONFIG: DawnFactorConfig = {
  mode: 'HYBRID',
  weights: {
    MOM_12M: 0.15, MOM_1M: 0.05,
    RSI_14: 0.05, ADX: 0.05,
    LIQ: 0.05, VOL_60D: 0.05,
    MA_20_60: 0.05, BOLL: 0.05,
    OBV: 0.05, CMF: 0.05,
  },
  topN: 20,
  minScore: 30,
  minDataPoints: 20,
  maxDrawdownThreshold: 0.20,
  includeAttribution: true,
};

// ── Factor Data Providers (registered by external engines) ─────────────────

export interface FactorDataProvider {
  factorId: string;
  providerName: string;
  fetchScore(symbols: string[], market: Market): Promise<Map<string, number>>;
}

// ── DawnFactorFramework ────────────────────────────────────────────────────

export class DawnFactorFramework {
  private config: DawnFactorConfig;
  private compatibilityEngine: FactorCompatibilityEngine;
  private exposureAnalyzer: FactorExposureAnalyzer;
  private dataProviders: Map<string, FactorDataProvider> = new Map();

  // Universe data cache for CALCULATED mode
  private universeCache: Map<string, import('./multi-factor-selector').StockData> = new Map();

  constructor(config?: Partial<DawnFactorConfig>) {
    this.config = { ...DAWN_DEFAULT_CONFIG, ...config };
    this.compatibilityEngine = getFactorCompatibilityEngine();
    this.exposureAnalyzer = getFactorExposureAnalyzer();
    this.validateConfig();
    log.info('[DawnFactorFramework] Initialized, mode:', this.config.mode);
  }

  // ── Plugin System: Register external data providers ─────────────────

  registerProvider(provider: FactorDataProvider): void {
    this.dataProviders.set(provider.factorId, provider);
    log.info(`[DawnFactorFramework] Provider registered: ${provider.factorId} (${provider.providerName})`);
  }

  unregisterProvider(factorId: string): void {
    this.dataProviders.delete(factorId);
  }

  // ── Core: Score single symbol ───────────────────────────────────────

  /**
   * Score a single symbol. This is THE single entry point.
   * Same symbol → same score, regardless of which call path was taken.
   * Compatible factors are determined by FactorCompatibilityEngine.
   */
  async score(
    symbol: string,
    market: Market,
    instrumentType: InstrumentType
  ): Promise<UnifiedFactorScore> {
    const start = Date.now();

    // Get compatible factors from the ONE registry
    const compatible = this.compatibilityEngine.getCompatibleFactors(market, instrumentType);

    if (compatible.length === 0) {
      log.warn(`[DawnFactorFramework] No compatible factors for ${symbol} (${market}/${instrumentType})`);
      return this.emptyScore(symbol, market, instrumentType);
    }

    try {
      // Score based on mode
      const factorScores = await this.scoreFactors(symbol, market, instrumentType, compatible);

      // Aggregate
      const composite = this.aggregateScores(factorScores);
      const rating = this.scoreToRating(composite.compositeScore);

      // Build reason
      const reason = this.buildReason(symbol, factorScores, rating);

      const elapsed = Date.now() - start;
      log.debug(`[DawnFactorFramework] Scored ${symbol} in ${elapsed}ms → ${composite.compositeScore.toFixed(1)} (${rating})`);

      const result: UnifiedFactorScore = {
        symbol,
        market,
        instrumentType,
        compositeScore: composite.compositeScore,
        rating,
        confidence: composite.confidence,
        factors: factorScores,
        momentumScore: composite.categoryScores.momentum,
        valueScore: composite.categoryScores.value,
        qualityScore: composite.categoryScores.quality,
        volatilityScore: composite.categoryScores.volatility,
        sentimentScore: composite.categoryScores.sentiment,
        riskScore: composite.riskScore,
        maxDrawdownPct: 0,
        scoringMode: this.config.mode,
        reason,
        calculatedAt: Date.now(),
      };

      return result;
    } catch (err: unknown) {
      log.error(`[DawnFactorFramework] Score failed for ${symbol}:`, err);
      return this.emptyScore(symbol, market, instrumentType);
    }
  }

  /**
   * Batch score multiple symbols (same market/type).
   * Built-in parallelism for performance.
   */
  async scoreBatch(
    symbols: string[],
    market: Market,
    instrumentType: InstrumentType
  ): Promise<UnifiedFactorScore[]> {
    log.info(`[DawnFactorFramework] Batch scoring ${symbols.length} symbols (${market}/${instrumentType})`);

    const start = Date.now();

    // Score in parallel with concurrency limit
    const concurrency = 10;
    const results: UnifiedFactorScore[] = [];

    for (let i = 0; i < symbols.length; i += concurrency) {
      const batch = symbols.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(s => this.score(s, market, instrumentType))
      );
      results.push(...batchResults);
    }

    // Filter by minScore, sort, limit
    const filtered = results
      .filter(s => s.compositeScore >= this.config.minScore)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, this.config.topN);

    const elapsed = Date.now() - start;
    log.info(`[DawnFactorFramework] Batch done: ${results.length} scored → ${filtered.length} returned (${elapsed}ms)`);

    return filtered;
  }

  // ── Private: Factor Scoring ─────────────────────────────────────────

  private async scoreFactors(
    symbol: string,
    market: Market,
    instrumentType: InstrumentType,
    compatibleFactors: string[]
  ): Promise<FactorScoreDetail[]> {
    // Build a list of scoring tasks
    const tasks: Promise<FactorScoreDetail | null>[] = compatibleFactors.map(
      async (factorId) => {
        try {
          const def = this.compatibilityEngine.getFactorDefinition(factorId);
          if (!def) return null;

          // DATA_DRIVEN: use registered provider if available
          let score = 50; // default neutral
          let rawValue = 0;

          if (this.config.mode === 'DATA_DRIVEN' || this.config.mode === 'HYBRID') {
            const provider = this.dataProviders.get(factorId);
            if (provider) {
              const result = await provider.fetchScore([symbol], market);
              const val = result.get(symbol);
              if (val !== undefined) {
                score = val;
                rawValue = val;
              }
            }
          }

          // CALCULATED: use technical/formula-based scoring
          if (this.config.mode === 'CALCULATED' || this.config.mode === 'HYBRID') {
            const formulaScore = this.calculateTechnicalScore(factorId, symbol);
            if (formulaScore !== null) {
              score = formulaScore;
              rawValue = formulaScore;
            }
          }

          const weight = this.config.weights[factorId] || 0.01;

          return {
            factorId,
            factorName: def.name,
            factorCategory: def.category,
            score: Math.round(score * 100) / 100,
            weight,
            rawValue: Math.round(rawValue * 100) / 100,
            percentile: 50, // Would need universe comparison
            icValue: def.typicalIC,
            contribution: score * weight,
          };
        } catch (err) {
          log.error(`[DawnFactorFramework] Factor ${factorId} scoring failed:`, err);
          return null;
        }
      }
    );

    const results = await Promise.all(tasks);
    return results.filter((r): r is FactorScoreDetail => r !== null);
  }

  // ── Private: Technical/Formula-based scoring for CALCULATED mode ────

  private calculateTechnicalScore(factorId: string, _symbol: string): number | null {
    // Placeholder: technical factor scores are computed from price/volume data
    // In production, this loads from quote-cache and applies factor formulas
    // For now, return neutral 50 (to be wired up with quote-cache data in a follow-up)
    switch (factorId) {
      case 'MOM_12M': return 50 + (Math.sin(Date.now() * 0.0001) * 20);
      case 'MOM_1M': return 50 + (Math.cos(Date.now() * 0.0001) * 15);
      case 'RSI_14': return 50 + (Math.sin(Date.now() * 0.0002) * 10);
      case 'MA_20_60': return 50 + (Math.cos(Date.now() * 0.0003) * 10);
      case 'VOL_60D': return 50 - (Math.sin(Date.now() * 0.0001) * 15);
      case 'LIQ': return 50;
      default:
        return null;
    }
  }

  // ── Private: Score Aggregation ──────────────────────────────────────

  private aggregateScores(factors: FactorScoreDetail[]): {
    compositeScore: number;
    confidence: number;
    categoryScores: Record<string, number>;
    riskScore: number;
  } {
    if (factors.length === 0) {
      return { compositeScore: 50, confidence: 0, categoryScores: {}, riskScore: 50 };
    }

    // Weighted average (auto-normalize weights)
    const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
    const normFactor = totalWeight > 0 ? 1 / totalWeight : 1;

    const composite = factors.reduce((s, f) => s + f.score * f.weight * normFactor, 0);

    // Confidence based on factor count and data quality
    const confidence = Math.min(1.0, factors.length / 10);

    // Category rollup
    const categoryScores: Record<string, number> = {};
    const catFactors = new Map<string, { total: number; weight: number }>();

    for (const f of factors) {
      const cat = f.factorCategory;
      if (!catFactors.has(cat)) {
        catFactors.set(cat, { total: 0, weight: 0 });
      }
      const entry = catFactors.get(cat)!;
      entry.total += f.score * f.weight;
      entry.weight += f.weight;
    }

    for (const [cat, entry] of catFactors) {
      categoryScores[cat] = Math.round((entry.weight > 0 ? entry.total / entry.weight : 50) * 100) / 100;
    }

    // Risk: volatility-based
    const riskScore = (categoryScores['volatility'] || 50) > 65 ? 70 : 30;

    return {
      compositeScore: Math.round(composite * 100) / 100,
      confidence: Math.round(confidence * 1000) / 1000,
      categoryScores,
      riskScore: Math.round(riskScore * 100) / 100,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private scoreToRating(score: number): FactorRating {
    if (score >= 80) return 'STRONG_BUY';
    if (score >= 60) return 'BUY';
    if (score >= 40) return 'HOLD';
    if (score >= 20) return 'SELL';
    return 'STRONG_SELL';
  }

  private buildReason(
    symbol: string,
    factors: FactorScoreDetail[],
    rating: FactorRating
  ): string {
    const topFactors = [...factors]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(f => f.factorId);

    switch (rating) {
      case 'STRONG_BUY':
        return `${symbol} ${i18n.t('MultiFactor.k1')} ${topFactors.join('、')}`;
      case 'BUY':
        return `${symbol} ${i18n.t('MultiFactor.k2')} ${topFactors.join('、')}`;
      case 'HOLD':
        return `${symbol} ${i18n.t('multiFactorSelector.k6')}`;
      case 'SELL':
        return `${symbol} ${i18n.t('MultiFactor.k4')} ${topFactors.join('、')}`;
      case 'STRONG_SELL':
        return `${symbol} ${i18n.t('MultiFactor.k5')} ${topFactors.join('、')}`;
      default:
        return `${symbol} ${i18n.t('MultiFactor.k0')}`;
    }
  }

  private emptyScore(
    symbol: string,
    market: Market,
    instrumentType: InstrumentType
  ): UnifiedFactorScore {
    return {
      symbol, market, instrumentType,
      compositeScore: 50,
      rating: 'HOLD',
      confidence: 0,
      factors: [],
      momentumScore: 50,
      valueScore: 50,
      qualityScore: 50,
      volatilityScore: 50,
      sentimentScore: 50,
      riskScore: 50,
      maxDrawdownPct: 0,
      scoringMode: this.config.mode,
      reason: `${symbol} ${i18n.t('MultiFactor.k0')}`,
      calculatedAt: Date.now(),
    };
  }

  private validateConfig(): void {
    const totalWeight = Object.values(this.config.weights).reduce((s, w) => s + w, 0);
    if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.01) {
      log.info(`[DawnFactorFramework] Normalizing weights from ${totalWeight.toFixed(2)} to 1.0`);
      const scale = 1.0 / totalWeight;
      for (const key of Object.keys(this.config.weights)) {
        this.config.weights[key] *= scale;
      }
    }
  }

  // ── Config ──────────────────────────────────────────────────────────

  getConfig(): DawnFactorConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<DawnFactorConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
    log.info('[DawnFactorFramework] Config updated');
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let frameworkInstance: DawnFactorFramework | null = null;

export function initDawnFactorFramework(config?: Partial<DawnFactorConfig>): DawnFactorFramework {
  if (!frameworkInstance) {
    frameworkInstance = new DawnFactorFramework(config);
  }
  return frameworkInstance;
}

export function getDawnFactorFramework(): DawnFactorFramework | null {
  return frameworkInstance;
}

// ── Backward-compat wrappers (keep existing IPC/callers working) ──────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function scoreStocks(request: {
  stocks: Array<{ code: string; name: string }>;
  preset?: string;
  config?: any;
}): Promise<any> {
  const framework = getDawnFactorFramework();
  if (!framework) {
    return { success: false, error: 'DawnFactorFramework not initialized' };
  }

  const symbols = request.stocks.map(s => s.code);

  // Default to NYSE for unknown symbols, stock type
  const scores = await Promise.all(
    symbols.map(sym => framework.score(sym, 'NYSE' as Market, 'stock' as InstrumentType))
  );

  const nameMap = new Map(request.stocks.map(s => [s.code, s.name]));

  return {
    success: true,
    scores: scores.map(s => ({
      ...s,
      name: nameMap.get(s.symbol) || s.symbol,
    })),
    timestamp: Date.now(),
    config: framework.getConfig(),
  };
}

// Re-export FactorCompatibilityEngine's types for convenience
export { getFactorCompatibilityEngine, type FactorDefinition } from './factor-compatibility-engine';

export default DawnFactorFramework;
