// R190 J2: Factor Crowding Alarm — valuation premium + position concentration + turnover rate
// Detects when factors become crowded (too many participants chasing same signal).
// Crowding erodes alpha — early warning prevents decay surprise.
import type { FactorId } from './factor-id-registry';
import type { ICHealthStatus } from './factor-rolling-ic-monitor';

export interface CrowdingMetrics {
  factorId: FactorId;
  /** Overall crowding score (0-100) */
  crowdingScore: number;
  /** Valuation premium: current quintile spread vs 5yr avg */
  valuationPremium: number;
  /** Position concentration: Herfindahl index of factor exposure */
  positionConcentration: number;
  /** Turnover z-score: how abnormal is current rebalancing volume */
  turnoverZScore: number;
  /** Alpha decay correlation: IC erosion vs crowding increase */
  alphaDecayCorrelation: number;
  /** Number of products tracking this factor */
  trackingProductCount: number;
  /** AUM tracking this factor (estimated) */
  estimatedAUM: number;
  /** Crowding trend: 0-100 (growing/stale/deflating) */
  crowdingTrend: number;
  /** Crowding level label */
  level: 'low' | 'moderate' | 'high' | 'extreme';
  /** Is alarm triggered? */
  alarmTriggered: boolean;
  /** Alarm reason */
  alarmReason?: string;
  /** Timestamp */
  timestamp: number;
}

export interface CrowdingConfig {
  /** Valuation premium threshold (z-score, default 2.0) */
  valuationPremiumThreshold?: number;
  /** Position concentration threshold (Herfindahl, default 0.15) */
  concentrationThreshold?: number;
  /** Turnover z-score threshold (default 2.5) */
  turnoverZThreshold?: number;
  /** Minimum tracking AUM to care about crowding ($M) */
  minAUMForCrowding?: number;
  /** Crowding score thresholds */
  crowdingLevels?: { moderate: number; high: number; extreme: number };
}

export class FactorCrowdingAlarm {
  private config: Required<CrowdingConfig>;
  private crowdingData = new Map<FactorId, CrowdingMetrics>();
  private history = new Map<FactorId, CrowdingMetrics[]>();

  constructor(config: CrowdingConfig = {}) {
    this.config = {
      valuationPremiumThreshold: config.valuationPremiumThreshold ?? 2.0,
      concentrationThreshold: config.concentrationThreshold ?? 0.15,
      turnoverZThreshold: config.turnoverZThreshold ?? 2.5,
      minAUMForCrowding: config.minAUMForCrowding ?? 100, // $100M
      crowdingLevels: config.crowdingLevels ?? { moderate: 30, high: 60, extreme: 80 },
    };
  }

  /** Compute crowding metrics for a factor */
  computeCrowding(
    factorId: FactorId,
    icHealth: ICHealthStatus,
    params: {
      valuationPremium: number;
      positionConcentration: number;
      turnoverRate: number;
      historicalTurnoverMean: number;
      historicalTurnoverStd: number;
      trackingProducts: number;
      estimatedAUM: number;
    }
  ): CrowdingMetrics {
    const { valuationPremium, positionConcentration, turnoverRate, historicalTurnoverMean, historicalTurnoverStd, trackingProducts, estimatedAUM } = params;

    // Sub-scores (0-100) with dampening
    const valScore = FactorCrowdingAlarm.dampen(valuationPremium / this.config.valuationPremiumThreshold * 100);
    const concScore = FactorCrowdingAlarm.dampen(positionConcentration / this.config.concentrationThreshold * 100);
    const tzScore = Math.abs(historicalTurnoverStd) > 1e-9 ? (turnoverRate - historicalTurnoverMean) / historicalTurnoverStd : 0;
    const turnScore = FactorCrowdingAlarm.dampen(tzScore / this.config.turnoverZThreshold * 100);
    const aumScore = FactorCrowdingAlarm.dampen(Math.log10(Math.max(1, estimatedAUM)) * 15);

    // Composite crowding score: weighted average
    const crowdingScore = (valScore * 0.25 + concScore * 0.30 + turnScore * 0.20 + aumScore * 0.25);

    // Alpha decay correlation
    const alphaDecayCorrelation = this.computeAlphaDecayCorrelation(icHealth, crowdingScore);

    // Crowding level
    let level: CrowdingMetrics['level'] = 'low';
    if (crowdingScore >= this.config.crowdingLevels.extreme) level = 'extreme';
    else if (crowdingScore >= this.config.crowdingLevels.high) level = 'high';
    else if (crowdingScore >= this.config.crowdingLevels.moderate) level = 'moderate';

    // Alarm logic
    const alarms: string[] = [];
    if (crowdingScore >= this.config.crowdingLevels.high) {
      alarms.push('Crowding high: score=' + crowdingScore.toFixed(1));
    }
    if (valuationPremium > this.config.valuationPremiumThreshold * 1.5) {
      alarms.push('Valuation stretched: premium=' + valuationPremium.toFixed(2) + 'x');
    }
    if (positionConcentration > this.config.concentrationThreshold * 1.3) {
      alarms.push('Position concentration: HHI=' + positionConcentration.toFixed(3));
    }
    if (tzScore > this.config.turnoverZThreshold * 1.2) {
      alarms.push('Abnormal turnover: z=' + tzScore.toFixed(2));
    }
    if (alphaDecayCorrelation > 0.6) {
      alarms.push('Alpha decay accelerating: corr=' + alphaDecayCorrelation.toFixed(3));
    }

    // Trend: compare with previous
    const prev = this.crowdingData.get(factorId);
    const crowdingTrend = prev ? crowdingScore - prev.crowdingScore : 0;

    const metrics: CrowdingMetrics = {
      factorId,
      crowdingScore: Math.min(100, Math.max(0, crowdingScore)),
      valuationPremium,
      positionConcentration,
      turnoverZScore: tzScore,
      alphaDecayCorrelation,
      trackingProductCount: trackingProducts,
      estimatedAUM,
      crowdingTrend,
      level,
      alarmTriggered: alarms.length > 0,
      alarmReason: alarms.length > 0 ? alarms.join('; ') : undefined,
      timestamp: Date.now(),
    };

    // Store
    this.crowdingData.set(factorId, metrics);
    const hist = this.history.get(factorId) ?? [];
    hist.push(metrics);
    if (hist.length > 36) hist.splice(0, 1);
    this.history.set(factorId, hist);

    return metrics;
  }

  /** Get latest crowding metrics for a factor */
  getCrowding(factorId: FactorId): CrowdingMetrics | null {
    return this.crowdingData.get(factorId) ?? null;
  }

  /** Get all factors with high+ crowding */
  getHighCrowdingFactors(): CrowdingMetrics[] {
    const results: CrowdingMetrics[] = [];
    for (const v of Array.from(this.crowdingData.values())) {
      if (v.level === 'high' || v.level === 'extreme') results.push(v);
    }
    return results.sort((a, b) => b.crowdingScore - a.crowdingScore);
  }

  /** Get all factors with alarm triggered */
  getAlarmedFactors(): CrowdingMetrics[] {
    const results: CrowdingMetrics[] = [];
    for (const v of Array.from(this.crowdingData.values())) {
      if (v.alarmTriggered) results.push(v);
    }
    return results.sort((a, b) => b.crowdingScore - a.crowdingScore);
  }

  /** Get crowding trend for a factor over time */
  getCrowdingHistory(factorId: FactorId): CrowdingMetrics[] {
    return this.history.get(factorId) ?? [];
  }

  /** Generate mock crowding data for testing */
  generateMockData(factorIds: FactorId[]): void {
    for (const fid of factorIds) {
      let h = 0;
      for (let i = 0; i < fid.length; i++) h = (h * 31 + fid.charCodeAt(i)) & 0xffffffff;
      const seed = (h % 1000) / 1000;
      const mockIC: ICHealthStatus = {
        factorId: fid,
        currentIC: 0.02 + seed * 0.04,
        averageIC: 0.03 + seed * 0.03,
        icStd: 0.04 + seed * 0.02,
        icIr: 0.5 + seed * 1.5,
        icDecayTrend: -0.003 + seed * 0.004,
        decayLevel: 'none',
        isDeclining: seed > 0.7,
        recentDirection: seed > 0.5 ? 1 : -1,
        flagged: seed > 0.8,
        rollingIC: [],
        marketCorrelation: 0.2 + seed * 0.3,
        monthlyTurnover: 0.1 + seed * 0.3,
      };
      this.computeCrowding(fid, mockIC, {
        valuationPremium: 0.5 + seed * 3,
        positionConcentration: 0.03 + seed * 0.25,
        turnoverRate: 0.05 + seed * 0.2,
        historicalTurnoverMean: 0.08,
        historicalTurnoverStd: 0.04,
        trackingProducts: Math.floor(seed * 50),
        estimatedAUM: seed * 10_000, // $M
      });
    }
  }

  /** Clear all data */
  clearAll(): void {
    this.crowdingData.clear();
    this.history.clear();
  }

  private computeAlphaDecayCorrelation(icHealth: ICHealthStatus, crowdingScore: number): number {
    // Higher crowding -> more alpha decay
    const baseDecay = Math.abs(icHealth.icDecayTrend);
    const crowdEffect = crowdingScore / 100;
    return Math.min(1, baseDecay * 10 + crowdEffect * 0.5);
  }

  // Sigmoid dampening: prevents single dimension from dominating
  static dampen(value: number): number {
    if (value <= 0) return 0;
    const sigmoid = 100 / (1 + Math.exp(-(value - 50) / 15));
    return Math.max(0, Math.min(100, sigmoid));
  }
}

// Singleton
let defaultAlarm: FactorCrowdingAlarm | null = null;
export function getCrowdingAlarm(config?: CrowdingConfig): FactorCrowdingAlarm {
  if (!defaultAlarm) defaultAlarm = new FactorCrowdingAlarm(config);
  return defaultAlarm;
}
export function resetCrowdingAlarm(): void { defaultAlarm = null; }