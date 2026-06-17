/**
 * FactorClimateEngine — R282 JVS-3 因子气候引擎 (6h)
 *
 * 功能:
 * - MarketRegimeClassifier: 牛/熊/震荡/高波动/低波动/复苏 6种市场气候检测
 * - FactorSeasonalityAnalyzer: 因子月度/季度季节效应 + 日历异象
 * - FactorClimateScore: 当前气候下每个因子的适配度评分
 * - RegimeTimeline: 历史气候切换时间线 + 持续时间
 * - FactorRotationSignal: 气候切换时推荐调仓方向
 * - ClimateAlmanac: 统计每个气候下因子的历史IC/胜率/夏普
 */

export type MarketRegime = 'bull' | 'bear' | 'sideways' | 'highVol' | 'lowVol' | 'recovery';

export interface RegimeDetection {
  currentRegime: MarketRegime;
  confidence: number;       // 0-1
  duration: number;         // days in current regime
  transitionSignal: boolean; // imminent regime change?
  nextRegime: MarketRegime | null;
  indicators: {
    trend: number;          // -1 to 1
    volatility: number;     // annualized
    momentum: number;       // rate of change
    breadth: number;        // % of stocks above MA
    volume: number;         // normalized volume
  };
}

export interface ClimateSuitability {
  factorId: string;
  factorName: string;
  currentRegime: MarketRegime;
  suitabilityScore: number;  // 0-100, how suitable this factor is now
  historicalIC: number;      // avg IC in this regime
  historicalWinRate: number;
  regimeRank: number;        // rank within this regime
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'avoid';
}

export interface SeasonalPattern {
  factorId: string;
  month: number;
  avgReturn: number;         // avg factor return in this month
  hitRate: number;           // % of years positive
  strength: 'strong' | 'moderate' | 'weak' | 'neutral';
}

export interface ClimateAlmanacEntry {
  regime: MarketRegime;
  factorId: string;
  avgIC: number;
  avgWinRate: number;
  avgSharpe: number;
  avgTurnover: number;
  sampleSize: number;        // number of observations
}

export interface ClimateTimeline {
  regimes: Array<{
    regime: MarketRegime;
    startDate: string;
    endDate: string;
    duration: number;         // days
  }>;
}

// ============================================================
const REGIME_ALMANAC: ClimateAlmanacEntry[] = [
  { regime: 'bull', factorId: 'momentum_6m', avgIC: 0.082, avgWinRate: 0.68, avgSharpe: 1.45, avgTurnover: 0.22, sampleSize: 850 },
  { regime: 'bull', factorId: 'pe_ttm', avgIC: 0.035, avgWinRate: 0.55, avgSharpe: 0.72, avgTurnover: 0.08, sampleSize: 850 },
  { regime: 'bull', factorId: 'revenue_yoy', avgIC: 0.061, avgWinRate: 0.62, avgSharpe: 1.12, avgTurnover: 0.10, sampleSize: 850 },
  { regime: 'bear', factorId: 'volatility_20d', avgIC: 0.073, avgWinRate: 0.71, avgSharpe: 1.38, avgTurnover: 0.15, sampleSize: 420 },
  { regime: 'bear', factorId: 'dividend_yield', avgIC: 0.058, avgWinRate: 0.65, avgSharpe: 1.05, avgTurnover: 0.05, sampleSize: 420 },
  { regime: 'bear', factorId: 'debt_equity', avgIC: 0.047, avgWinRate: 0.61, avgSharpe: 0.88, avgTurnover: 0.07, sampleSize: 420 },
  { regime: 'sideways', factorId: 'gross_margin', avgIC: 0.055, avgWinRate: 0.63, avgSharpe: 1.02, avgTurnover: 0.09, sampleSize: 600 },
  { regime: 'sideways', factorId: 'roe_ttm', avgIC: 0.051, avgWinRate: 0.60, avgSharpe: 0.95, avgTurnover: 0.06, sampleSize: 600 },
  { regime: 'sideways', factorId: 'market_cap', avgIC: -0.028, avgWinRate: 0.42, avgSharpe: -0.35, avgTurnover: 0.12, sampleSize: 600 },
  { regime: 'highVol', factorId: 'beta_60d', avgIC: 0.068, avgWinRate: 0.67, avgSharpe: 1.25, avgTurnover: 0.18, sampleSize: 300 },
  { regime: 'highVol', factorId: 'momentum_1m', avgIC: 0.078, avgWinRate: 0.64, avgSharpe: 1.15, avgTurnover: 0.35, sampleSize: 300 },
  { regime: 'highVol', factorId: 'amihud', avgIC: 0.055, avgWinRate: 0.59, avgSharpe: 0.82, avgTurnover: 0.14, sampleSize: 300 },
  { regime: 'lowVol', factorId: 'dividend_yield', avgIC: 0.062, avgWinRate: 0.70, avgSharpe: 1.32, avgTurnover: 0.04, sampleSize: 350 },
  { regime: 'lowVol', factorId: 'pb_lf', avgIC: 0.048, avgWinRate: 0.58, avgSharpe: 0.86, avgTurnover: 0.07, sampleSize: 350 },
  { regime: 'lowVol', factorId: 'gross_margin', avgIC: 0.042, avgWinRate: 0.56, avgSharpe: 0.72, avgTurnover: 0.06, sampleSize: 350 },
  { regime: 'recovery', factorId: 'revenue_yoy', avgIC: 0.085, avgWinRate: 0.73, avgSharpe: 1.55, avgTurnover: 0.12, sampleSize: 280 },
  { regime: 'recovery', factorId: 'pe_ttm', avgIC: 0.062, avgWinRate: 0.61, avgSharpe: 1.18, avgTurnover: 0.09, sampleSize: 280 },
  { regime: 'recovery', factorId: 'momentum_3m', avgIC: 0.071, avgWinRate: 0.66, avgSharpe: 1.28, avgTurnover: 0.20, sampleSize: 280 },
];

const SEASONAL_PATTERNS: SeasonalPattern[] = [
  { factorId: 'momentum_1m', month: 1, avgReturn: 0.032, hitRate: 0.72, strength: 'strong' },  // January effect
  { factorId: 'pe_ttm', month: 1, avgReturn: 0.025, hitRate: 0.65, strength: 'moderate' },
  { factorId: 'momentum_3m', month: 4, avgReturn: 0.028, hitRate: 0.68, strength: 'strong' },  // April rebound
  { factorId: 'dividend_yield', month: 6, avgReturn: 0.018, hitRate: 0.60, strength: 'moderate' },
  { factorId: 'volatility_20d', month: 9, avgReturn: 0.022, hitRate: 0.63, strength: 'moderate' }, // Sept vol
  { factorId: 'pe_ttm', month: 11, avgReturn: 0.030, hitRate: 0.70, strength: 'strong' }, // Santa rally
  { factorId: 'revenue_yoy', month: 12, avgReturn: 0.026, hitRate: 0.66, strength: 'strong' },
  { factorId: 'market_cap', month: 12, avgReturn: 0.015, hitRate: 0.55, strength: 'weak' },
];

// ============================================================
export class FactorClimateEngine {
  private currentRegime: MarketRegime = 'bull';
  private regimeStartDate: string = '';
  private regimeDetection: RegimeDetection | null = null;
  private timeline: ClimateTimeline | null = null;
  private almanac = new Map<string, ClimateAlmanacEntry[]>(); // regime → entries

  constructor() {
    // Build almanac index
    const entries = REGIME_ALMANAC;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!this.almanac.has(e.regime)) this.almanac.set(e.regime, []);
      this.almanac.get(e.regime)!.push(e);
    }
  }

  /** Detect current market regime */
  detectRegime(indicators: { trend: number; volatility: number; momentum: number; breadth: number; volume: number }): RegimeDetection {
    const { trend, volatility, momentum, breadth, volume } = indicators;

    // Classification logic
    let regime: MarketRegime;
    let confidence = 0;
    let nextRegime: MarketRegime | null = null;
    let transitionSignal = false;

    if (trend > 0.5 && momentum > 0.3) {
      regime = 'bull';
      confidence = +Math.min(0.9, (0.5 + trend * 0.3 + momentum * 0.2)).toFixed(2);
    } else if (trend < -0.5 && momentum < -0.3) {
      regime = 'bear';
      confidence = +Math.min(0.9, (0.5 + Math.abs(trend) * 0.3 + Math.abs(momentum) * 0.2)).toFixed(2);
    } else if (volatility > 0.35) {
      regime = 'highVol';
      confidence = +Math.min(0.85, (0.4 + volatility * 0.6)).toFixed(2);
    } else if (volatility < 0.10) {
      regime = 'lowVol';
      confidence = +Math.min(0.85, (0.4 + (0.15 - volatility) * 2)).toFixed(2);
    } else if (trend > 0.15 && momentum < 0) {
      regime = 'recovery';
      confidence = +Math.min(0.8, (0.4 + trend * 0.4 + Math.abs(momentum) * 0.2)).toFixed(2);
    } else {
      regime = 'sideways';
      confidence = +Math.max(0.3, (0.5 - Math.abs(trend) * 0.2)).toFixed(2);
    }

    // Transition detection
    if (this.currentRegime !== regime && confidence > 0.55) {
      transitionSignal = true;
      nextRegime = regime;
    }

    // Update current regime if confident enough
    if (transitionSignal && confidence > 0.7) {
      const now = new Date().toISOString().split('T')[0];
      if (!this.timeline) this.timeline = { regimes: [] };
      this.timeline.regimes.push({
        regime: this.currentRegime,
        startDate: this.regimeStartDate,
        endDate: now,
        duration: 0, // would compute from dates
      });
      this.currentRegime = regime;
      this.regimeStartDate = now;
    }

    // Duration since last regime change
    const duration = this.regimeStartDate ? Math.floor((Date.now() - new Date(this.regimeStartDate).getTime()) / 86400000) : 30;

    this.regimeDetection = {
      currentRegime: regime,
      confidence,
      duration: Math.max(1, duration),
      transitionSignal,
      nextRegime,
      indicators,
    };

    return this.regimeDetection;
  }

  /** Get factor suitability in current climate */
  getClimateSuitability(factorIds: string[], factorNames?: Record<string, string>): ClimateSuitability[] {
    const regime = this.currentRegime;
    const entries = this.almanac.get(regime) || [];
    const results: ClimateSuitability[] = [];

    for (let i = 0; i < factorIds.length; i++) {
      const fid = factorIds[i];
      const entry = entries.find(e => e.factorId === fid);

      if (entry) {
        const score = +((entry.avgIC * 500 + entry.avgWinRate * 40 + entry.avgSharpe * 20) / 6).toFixed(1);
        const recommendation: ClimateSuitability['recommendation'] =
          score >= 18 ? 'strong_buy' : score >= 14 ? 'buy' : score >= 10 ? 'hold' : score >= 6 ? 'reduce' : 'avoid';

        results.push({
          factorId: fid,
          factorName: factorNames?.[fid] || fid,
          currentRegime: regime,
          suitabilityScore: Math.min(100, Math.max(0, score * 5)),
          historicalIC: entry.avgIC,
          historicalWinRate: entry.avgWinRate,
          regimeRank: 0, // will sort
          recommendation,
        });
      } else {
        // No data = neutral
        results.push({
          factorId: fid,
          factorName: factorNames?.[fid] || fid,
          currentRegime: regime,
          suitabilityScore: 50,
          historicalIC: 0,
          historicalWinRate: 0,
          regimeRank: factorIds.length,
          recommendation: 'hold',
        });
      }
    }

    // Rank by suitability score
    results.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    for (let i = 0; i < results.length; i++) {
      results[i].regimeRank = i + 1;
    }

    return results;
  }

  /** Get factor rotation signal */
  getRotationSignal(): { from: ClimateSuitability[]; to: ClimateSuitability[]; message: string; action: 'rotate' | 'hold' | 'hedge' } {
    if (!this.regimeDetection || !this.regimeDetection.transitionSignal) {
      return { from: [], to: [], message: 'No regime change imminent. Hold current allocation.', action: 'hold' };
    }

    const fromRegime = this.currentRegime;
    const toRegime = this.regimeDetection.nextRegime!;

    const fromSuitability = this.getClimateSuitability(['momentum_6m', 'pe_ttm', 'volatility_20d', 'dividend_yield', 'gross_margin', 'revenue_yoy']);
    // Temporarily switch regime to get target suitability
    const savedRegime = this.currentRegime;
    this.currentRegime = toRegime;
    const toSuitability = this.getClimateSuitability(['momentum_6m', 'pe_ttm', 'volatility_20d', 'dividend_yield', 'gross_margin', 'revenue_yoy']);
    this.currentRegime = savedRegime;

    return {
      from: fromSuitability,
      to: toSuitability,
      message: `Regime transition detected: ${fromRegime} → ${toRegime}. Consider rotating factor weights.`,
      action: 'rotate',
    };
  }

  /** Get seasonal patterns for a month */
  getSeasonalPatterns(month: number): SeasonalPattern[] {
    const patterns: SeasonalPattern[] = [];
    const entries = SEASONAL_PATTERNS;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].month === month) patterns.push(entries[i]);
    }
    return patterns;
  }

  /** Get seasonal patterns for all months */
  getAllSeasonalPatterns(): SeasonalPattern[] {
    return SEASONAL_PATTERNS;
  }

  /** Get climate almanac for a regime */
  getAlmanac(regime: MarketRegime): ClimateAlmanacEntry[] {
    return this.almanac.get(regime) || [];
  }

  /** Get full almanac */
  getFullAlmanac(): ClimateAlmanacEntry[] { return REGIME_ALMANAC; }

  /** Generate regime heatmap */
  generateRegimeHeatmap(): { regimes: MarketRegime[]; factorIds: string[]; matrix: number[][] } {
    const regimes: MarketRegime[] = ['bull', 'bear', 'sideways', 'highVol', 'lowVol', 'recovery'];
    const factorIds: string[] = ['momentum_6m', 'pe_ttm', 'revenue_yoy', 'volatility_20d', 'dividend_yield', 'gross_margin', 'roe_ttm', 'debt_equity', 'market_cap', 'beta_60d'];

    const matrix: number[][] = [];
    for (let r = 0; r < regimes.length; r++) {
      const row: number[] = [];
      const entries = this.almanac.get(regimes[r]) || [];
      for (let f = 0; f < factorIds.length; f++) {
        const entry = entries.find(e => e.factorId === factorIds[f]);
        row.push(entry ? +(entry.avgSharpe).toFixed(2) : 0);
      }
      matrix.push(row);
    }
    return { regimes, factorIds, matrix };
  }

  /** Get a climate summary */
  getClimateSummary(): { regime: MarketRegime; since: string; description: string; topFactor: string; warningFactor: string } {
    const regime = this.currentRegime;
    const entries = this.almanac.get(regime) || [];
    const sorted = [...entries].sort((a, b) => b.avgIC - a.avgIC);
    const topFactor = sorted.length > 0 ? sorted[0].factorId : 'none';
    const bottomFactor = sorted.length > 1 ? sorted[sorted.length - 1].factorId : 'none';

    const descriptions: Record<MarketRegime, string> = {
      bull: 'Bull market: growth and momentum factors dominate. Favor cyclical sectors.',
      bear: 'Bear market: low volatility and quality factors provide downside protection.',
      sideways: 'Sideways market: stock selection and quality factors matter most.',
      highVol: 'High volatility: beta and momentum strategies require tight risk control.',
      lowVol: 'Low volatility: income and value factors tend to outperform.',
      recovery: 'Recovery phase: early cyclical and growth factors lead the rebound.',
    };

    return {
      regime,
      since: this.regimeStartDate || 'unknown',
      description: descriptions[regime],
      topFactor,
      warningFactor: bottomFactor,
    };
  }

  getCurrentRegime(): MarketRegime { return this.currentRegime; }
  getRegimeDetection(): RegimeDetection | null { return this.regimeDetection; }
  getTimeline(): ClimateTimeline | null { return this.timeline; }
  reset(): void {
    this.currentRegime = 'bull';
    this.regimeStartDate = '';
    this.regimeDetection = null;
    this.timeline = null;
  }
}

let _fce: FactorClimateEngine | undefined;
export function getFactorClimateEngine(): FactorClimateEngine {
  if (!_fce) _fce = new FactorClimateEngine();
  return _fce;
}
export function resetFactorClimateEngine(): void { _fce?.reset(); _fce = undefined; }
