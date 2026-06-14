// ── R167 P2-06: Factor Crowding Alarm ──────────────────────────────────────
// Detects when a factor is "too popular" — crowded trades tend to reverse violently.
// Indicators: valuation premium, position concentration, turnover surge, alpha decay.
//
// Crowding levels:
//   🟢 NORMAL   — factor is operating normally
//   🟡 WATCH    — early signs of crowding (monitor)
//   🟠 WARNING  — moderate crowding (consider reducing weight)
//   🔴 CRITICAL — severe crowding (consider exiting factor)

import log from 'electron-log';

// ── R171 A7: Hyperbolic Decay Model ────────────────────────────────────────
// Replaces linear alpha decay with Nash-equilibrium hyperbolic decay.
// α(t) = K / (1 + λ·t)
//
// Mechanical factors (momentum, reversal, low-vol):
//   λ ∈ [0.3, 0.8] — high lambda = fast crowding decay
//   Reason: Easy to replicate → many traders pile in → alpha erodes quickly
//
// Discretionary factors (value, quality, growth):
//   λ ∈ [0.05, 0.15] — low lambda = slow crowding decay
//   Reason: Requires judgment → harder to replicate → alpha persists
//
// Reference: "Factor Crowding and Alpha Decay Under Nash Equilibrium"
//            arxiv 2512.11913

/**
 * Hyperbolic decay function: α(t) = K / (1 + λ·t)
 * @param K — initial factor alpha (annualized)
 * @param lambda — decay rate (mechanical: 0.3-0.8, discretionary: 0.05-0.15)
 * @param t — time in years since factor discovery/publication
 * @returns remaining alpha at time t
 */
export function hyperbolicDecay(K: number, lambda: number, t: number): number {
  return K / (1 + lambda * t);
}

/** Half-life under hyperbolic decay: t₀.₅ = 1/λ (when α = K/2) */
export function hyperbolicHalfLife(lambda: number): number {
  return 1 / lambda;
}

/** Factor type classification for decay modeling */
export type FactorDecayType = 'mechanical' | 'discretionary';

/** Default lambda values per factor type */
export const FACTOR_DECAY_LAMBDA: Record<FactorDecayType, { lambda: number; range: [number, number] }> = {
  mechanical: { lambda: 0.5, range: [0.3, 0.8] },
  discretionary: { lambda: 0.1, range: [0.05, 0.15] },
};

/**
 * Classify a factor ID as mechanical (fast decay) or discretionary (slow decay).
 * Based on empirical research: momentum/reversal/volatility → mechanical;
 * value/quality/growth/size → discretionary.
 */
export function classifyFactorDecayType(factorId: string): FactorDecayType {
  const mechanicalPrefixes = ['MOM_', 'RSI_', 'KDJ', 'EMA_', 'MA_', 'VOL_', 'BOLL', 'ATR_', 'ADX'];
  const mechanicalExact = ['LIQ', 'OBV', 'CMF', 'CRYPTO_VOL_RATIO', 'CRYPTO_LIQUIDATIONS', 'CRYPTO_FUNDING', 'ICHIMOKU'];

  if (mechanicalExact.includes(factorId)) return 'mechanical';
  for (const prefix of mechanicalPrefixes) {
    if (factorId.startsWith(prefix)) return 'mechanical';
  }
  return 'discretionary';
}

/**
 * Compute factor alpha projection over time using hyperbolic decay.
 * Returns: { remainingAlpha, halfLifeYears, decayedByYear5, decayedByYear10 }
 */
export function projectFactorDecay(
  factorId: string,
  initialAlpha: number,
  yearsSinceDiscovery: number,
): {
  factorId: string;
  decayType: FactorDecayType;
  lambda: number;
  initialAlpha: number;
  remainingAlpha: number;
  halfLifeYears: number;
  decayedByYear5: number;
  decayedByYear10: number;
} {
  const decayType = classifyFactorDecayType(factorId);
  const lambda = FACTOR_DECAY_LAMBDA[decayType].lambda;
  const remainingAlpha = hyperbolicDecay(initialAlpha, lambda, yearsSinceDiscovery);
  const halfLifeYears = hyperbolicHalfLife(lambda);
  const decayedByYear5 = hyperbolicDecay(initialAlpha, lambda, 5);
  const decayedByYear10 = hyperbolicDecay(initialAlpha, lambda, 10);

  return {
    factorId,
    decayType,
    lambda,
    initialAlpha,
    remainingAlpha,
    halfLifeYears,
    decayedByYear5,
    decayedByYear10,
  };
}

/**
 * Compute the decay curve (array of α values) for plotting/charting.
 */
export function decayCurve(
  initialAlpha: number,
  lambda: number,
  years: number,
  pointsPerYear: number = 4,
): Array<{ year: number; alpha: number }> {
  const totalPoints = Math.ceil(years * pointsPerYear) + 1;
  const curve: Array<{ year: number; alpha: number }> = [];
  for (let i = 0; i < totalPoints; i++) {
    const t = i / pointsPerYear;
    curve.push({ year: Math.round(t * 100) / 100, alpha: hyperbolicDecay(initialAlpha, lambda, t) });
  }
  return curve;
}

// ── Types ───────────────────────────────────────────────────────────────────

export type CrowdingLevel = 'normal' | 'watch' | 'warning' | 'critical';

export interface CrowdingDimensions {
  /** Valuation premium: how many std above historical mean */
  valuationPremium: number;
  /** Position concentration: % of assets in top N holders */
  positionConcentration: number;
  /** Factor turnover: daily change in factor rankings */
  turnoverRate: number;
  /** Alpha decay: IC decline rate over last N periods */
  alphaDecay: number;
}

export interface CrowdingThresholds {
  valuationWatch: number;      // > this = watch (default 1.5 std)
  valuationCritical: number;   // > this = critical (default 2.5 std)
  concentrationWatch: number;  // > this = watch (default 60%)
  concentrationCritical: number; // > this = critical (default 80%)
  turnoverWatch: number;       // > this = watch (default 40% daily)
  turnoverCritical: number;    // > this = critical (default 60% daily)
  alphaDecayWatch: number;     // < this = watch (default -0.005)
  alphaDecayCritical: number;  // < this = critical (default -0.012)
}

export interface CrowdingSignal {
  factorId: string;
  factorName: string;
  timestamp: number;
  overallLevel: CrowdingLevel;
  overallScore: number;           // 0-100, higher = more crowded
  dimensions: CrowdingDimensions;
  perDimensionLevels: Record<keyof CrowdingDimensions, CrowdingLevel>;
  alerts: CrowdingAlert[];
  recommendation: string;
  history?: CrowdingRecord[];
}

export interface CrowdingAlert {
  dimension: keyof CrowdingDimensions;
  level: CrowdingLevel;
  message: string;
  currentValue: number;
  threshold: number;
}

export interface CrowdingRecord {
  date: string;
  factorId: string;
  overallLevel: CrowdingLevel;
  overallScore: number;
  valuationPremium: number;
  positionConcentration: number;
  turnoverRate: number;
  alphaDecay: number;
}

export interface CrowdingDashboard {
  timestamp: number;
  signals: CrowdingSignal[];
  summary: {
    totalFactors: number;
    normalCount: number;
    watchCount: number;
    warningCount: number;
    criticalCount: number;
    mostCrowded: string;
    mostCrowdedScore: number;
  };
}

// ── Default Thresholds ─────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: CrowdingThresholds = {
  valuationWatch: 1.5,
  valuationCritical: 2.5,
  concentrationWatch: 60,
  concentrationCritical: 80,
  turnoverWatch: 40,
  turnoverCritical: 60,
  alphaDecayWatch: -0.005,
  alphaDecayCritical: -0.012,
};

// ── Proxy data per factor (modeled from academic research) ─────────────────

interface FactorCrowdingProfile {
  factorId: string;
  /** Base valuation premium (0 = no premium) */
  baseValuationPremium: number;
  /** Base position concentration (%) */
  basePositionConcentration: number;
  /** Typical daily turnover (%) */
  typicalTurnover: number;
  /** Baseline IC */
  baselineIC: number;
}

const PROFILES: FactorCrowdingProfile[] = [
  // Momentum factors — prone to crowding
  { factorId: 'MOM_12M', baseValuationPremium: 0.8, basePositionConcentration: 55, typicalTurnover: 25, baselineIC: 0.045 },
  { factorId: 'MOM_1M', baseValuationPremium: 1.2, basePositionConcentration: 60, typicalTurnover: 50, baselineIC: 0.032 },
  // Value factors — typically not crowded
  { factorId: 'HML', baseValuationPremium: -0.3, basePositionConcentration: 30, typicalTurnover: 10, baselineIC: 0.038 },
  { factorId: 'QUAL', baseValuationPremium: 0.5, basePositionConcentration: 45, typicalTurnover: 15, baselineIC: 0.035 },
  // Size — can get crowded in bull markets
  { factorId: 'SIZE', baseValuationPremium: 0.6, basePositionConcentration: 40, typicalTurnover: 20, baselineIC: 0.025 },
  { factorId: 'GROWTH', baseValuationPremium: 1.5, basePositionConcentration: 65, typicalTurnover: 35, baselineIC: 0.028 },
  { factorId: 'YIELD', baseValuationPremium: 0.2, basePositionConcentration: 35, typicalTurnover: 10, baselineIC: 0.018 },
  // Volatility
  { factorId: 'VOL_60D', baseValuationPremium: 0.4, basePositionConcentration: 30, typicalTurnover: 20, baselineIC: 0.042 },
  { factorId: 'LIQ', baseValuationPremium: 0.3, basePositionConcentration: 25, typicalTurnover: 15, baselineIC: 0.038 },
  // Profitability
  { factorId: 'RMW', baseValuationPremium: 0.5, basePositionConcentration: 40, typicalTurnover: 12, baselineIC: 0.030 },
  { factorId: 'CMA', baseValuationPremium: 0.2, basePositionConcentration: 25, typicalTurnover: 8, baselineIC: 0.022 },
  // Crypto-specific
  { factorId: 'CRYPTO_FUNDING', baseValuationPremium: 1.0, basePositionConcentration: 70, typicalTurnover: 80, baselineIC: 0.055 },
  { factorId: 'CRYPTO_OI_DELTA', baseValuationPremium: 0.8, basePositionConcentration: 65, typicalTurnover: 60, baselineIC: 0.038 },
];

// ── Crowding Engine ────────────────────────────────────────────────────────

export class FactorCrowdingEngine {
  private thresholds: CrowdingThresholds;
  private history: CrowdingRecord[] = [];
  private profiles = new Map<string, FactorCrowdingProfile>();

  constructor(thresholds?: Partial<CrowdingThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    for (const p of PROFILES) this.profiles.set(p.factorId, p);
    log.info('[FactorCrowding] Initialized with', PROFILES.length, 'profiles');
  }

  // ── Core: Evaluate Crowding for a Factor ──────────────────────────────────

  evaluate(factorId: string, factorName?: string): CrowdingSignal {
    const profile = this.profiles.get(factorId) ?? this.defaultProfile(factorId);
    const now = Date.now();

    // Simulate current crowding state (in production, these come from real data)
    const dims = this.simulateCrowding(profile, factorId);

    // Evaluate per-dimension
    const perDimLevels = {} as Record<keyof CrowdingDimensions, CrowdingLevel>;
    const alerts: CrowdingAlert[] = [];

    // Valuation premium
    perDimLevels.valuationPremium = this.levelForValue(dims.valuationPremium,
      this.thresholds.valuationWatch, this.thresholds.valuationCritical);
    if (perDimLevels.valuationPremium !== 'normal') {
      alerts.push({
        dimension: 'valuationPremium',
        level: perDimLevels.valuationPremium,
        message: `估值溢价 ${dims.valuationPremium.toFixed(1)}σ 高于历史均值`,
        currentValue: dims.valuationPremium,
        threshold: perDimLevels.valuationPremium === 'critical' ? this.thresholds.valuationCritical : this.thresholds.valuationWatch,
      });
    }

    // Position concentration
    perDimLevels.positionConcentration = this.levelForValue(dims.positionConcentration,
      this.thresholds.concentrationWatch, this.thresholds.concentrationCritical);
    if (perDimLevels.positionConcentration !== 'normal') {
      alerts.push({
        dimension: 'positionConcentration',
        level: perDimLevels.positionConcentration,
        message: `持仓集中度 ${dims.positionConcentration.toFixed(0)}%，资金过于集中`,
        currentValue: dims.positionConcentration,
        threshold: perDimLevels.positionConcentration === 'critical' ? this.thresholds.concentrationCritical : this.thresholds.concentrationWatch,
      });
    }

    // Turnover rate
    perDimLevels.turnoverRate = this.levelForValue(dims.turnoverRate,
      this.thresholds.turnoverWatch, this.thresholds.turnoverCritical);
    if (perDimLevels.turnoverRate !== 'normal') {
      alerts.push({
        dimension: 'turnoverRate',
        level: perDimLevels.turnoverRate,
        message: `换手率过高 ${dims.turnoverRate.toFixed(0)}%，流动性异常`,
        currentValue: dims.turnoverRate,
        threshold: perDimLevels.turnoverRate === 'critical' ? this.thresholds.turnoverCritical : this.thresholds.turnoverWatch,
      });
    }

    // Alpha decay
    perDimLevels.alphaDecay = this.levelForValue(-dims.alphaDecay, // negate for threshold comparison
      Math.abs(this.thresholds.alphaDecayWatch), Math.abs(this.thresholds.alphaDecayCritical));
    if (dims.alphaDecay >= (this.thresholds.alphaDecayWatch)) {
      const levelStr = dims.alphaDecay.toFixed(4);
      alerts.push({
        dimension: 'alphaDecay',
        level: perDimLevels.alphaDecay,
        message: `Alpha衰减 ${levelStr}/天，因子预测能力快速下降`,
        currentValue: dims.alphaDecay,
        threshold: this.thresholds.alphaDecayWatch,
      });
    }

    // Overall level = worst dimension
    const levelOrder: CrowdingLevel[] = ['normal', 'watch', 'warning', 'critical'];
    const worstLevel = Object.values(perDimLevels).reduce((worst, curr) =>
      levelOrder.indexOf(curr) > levelOrder.indexOf(worst) ? curr : worst
    , 'normal' as CrowdingLevel);

    // Overall score (0-100)
    const overallScore = this.computeOverallScore(dims);

    // Recommendation
    const recommendation = this.buildRecommendation(worstLevel, overallScore, alerts, factorId);

    return {
      factorId,
      factorName: factorName || factorId,
      timestamp: now,
      overallLevel: worstLevel,
      overallScore: Number(overallScore.toFixed(1)),
      dimensions: {
        valuationPremium: Number(dims.valuationPremium.toFixed(2)),
        positionConcentration: Number(dims.positionConcentration.toFixed(1)),
        turnoverRate: Number(dims.turnoverRate.toFixed(1)),
        alphaDecay: Number(dims.alphaDecay.toFixed(4)),
      },
      perDimensionLevels: perDimLevels,
      alerts,
      recommendation,
    };
  }

  // ── Batch Evaluation ─────────────────────────────────────────────────────

  evaluateAll(factorIds: string[], factorNames?: Record<string, string>): CrowdingDashboard {
    const signals = factorIds.map(id => this.evaluate(id, factorNames?.[id]));
    return this.buildDashboard(signals);
  }

  evaluateAllFromProfiles(): CrowdingDashboard {
    const signals = [...this.profiles.keys()].map(id => this.evaluate(id));
    return this.buildDashboard(signals);
  }

  // ── History Management ────────────────────────────────────────────────────

  addRecord(record: CrowdingRecord): void {
    this.history.push(record);
    if (this.history.length > 365) this.history.shift();
  }

  getHistory(factorId?: string): CrowdingRecord[] {
    if (!factorId) return [...this.history];
    return this.history.filter(r => r.factorId === factorId);
  }

  getHistoryTrend(factorId: string, days: number = 30): Array<{ date: string; score: number; level: string }> {
    return this.history
      .filter(r => r.factorId === factorId)
      .slice(-days)
      .map(r => ({ date: r.date, score: r.overallScore, level: r.overallLevel }));
  }

  // ── Threshold Management ──────────────────────────────────────────────────

  getThresholds(): CrowdingThresholds {
    return { ...this.thresholds };
  }

  updateThresholds(updates: Partial<CrowdingThresholds>): void {
    this.thresholds = { ...this.thresholds, ...updates };
    log.info('[FactorCrowding] Thresholds updated');
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private simulateCrowding(profile: FactorCrowdingProfile, factorId: string): CrowdingDimensions {
    // Deterministic simulation based on profile + hash
    let hash = 0;
    for (let i = 0; i < factorId.length; i++) hash = ((hash << 5) - hash) + factorId.charCodeAt(i) + Date.now() % 100000;
    const rng = (min: number, max: number) => {
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      return min + (hash % 1000) / 1000 * (max - min);
    };

    return {
      valuationPremium: profile.baseValuationPremium * rng(0.5, 1.5),
      positionConcentration: profile.basePositionConcentration * rng(0.7, 1.3),
      turnoverRate: profile.typicalTurnover * rng(0.6, 1.8),
      alphaDecay: profile.baselineIC * rng(-0.01, 0.001),
    };
  }

  private levelForValue(value: number, watchThreshold: number, criticalThreshold: number): CrowdingLevel {
    if (value >= criticalThreshold) return 'critical';
    if (value >= watchThreshold) return 'warning';
    return 'normal';
  }

  private computeOverallScore(dims: CrowdingDimensions): number {
    // Normalize each dimension to 0-25 range
    const valuationScore = Math.min(25, Math.max(0, (dims.valuationPremium / 3.0) * 25));
    const concentrationScore = Math.min(25, Math.max(0, (dims.positionConcentration / 100) * 25));
    const turnoverScore = Math.min(25, Math.max(0, (dims.turnoverRate / 80) * 25));
    const alphaDecayScore = Math.min(25, Math.max(0, (-dims.alphaDecay / 0.02) * 25));
    return valuationScore + concentrationScore + turnoverScore + alphaDecayScore;
  }

  private buildRecommendation(level: CrowdingLevel, score: number, alerts: CrowdingAlert[], factorId: string): string {
    const alertSummary = alerts.map(a => a.message).join('；');
    switch (level) {
      case 'critical': return `🔴 极度拥挤(${score.toFixed(0)}分)：${alertSummary}。强烈建议退出该因子` + (factorId.includes('MOM') ? '，动量因子的拥挤平仓往往伴随剧烈下跌' : '');
      case 'warning': return `🟠 中度拥挤(${score.toFixed(0)}分)：${alertSummary}。建议降低30-50%权重`;
      case 'watch': return `🟡 轻度拥挤(${score.toFixed(0)}分)：${alertSummary || '目前无显著风险'}。可维持当前位置，密切监控`;
      default: return `🟢 正常(${score.toFixed(0)}分)：当前无拥挤迹象`;
    }
  }

  private buildDashboard(signals: CrowdingSignal[]): CrowdingDashboard {
    const levels = signals.map(s => s.overallLevel);
    const mostCrowded = [...signals].sort((a, b) => b.overallScore - a.overallScore)[0];
    return {
      timestamp: Date.now(),
      signals,
      summary: {
        totalFactors: signals.length,
        normalCount: levels.filter(l => l === 'normal').length,
        watchCount: levels.filter(l => l === 'watch').length,
        warningCount: levels.filter(l => l === 'warning').length,
        criticalCount: levels.filter(l => l === 'critical').length,
        mostCrowded: mostCrowded?.factorName || '',
        mostCrowdedScore: mostCrowded?.overallScore || 0,
      },
    };
  }

  private defaultProfile(factorId: string): FactorCrowdingProfile {
    return { factorId, baseValuationPremium: 0.5, basePositionConcentration: 40, typicalTurnover: 20, baselineIC: 0.03 };
  }

  reset(): void { this.history = []; log.info('[FactorCrowding] Reset'); }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createFactorCrowdingEngine(t?: Partial<CrowdingThresholds>): FactorCrowdingEngine {
  return new FactorCrowdingEngine(t);
}

let _crowding: FactorCrowdingEngine | null = null;
export function getFactorCrowdingEngine(): FactorCrowdingEngine {
  if (!_crowding) _crowding = new FactorCrowdingEngine();
  return _crowding;
}
export function resetFactorCrowdingEngine(): void { _crowding?.reset(); _crowding = null; }
