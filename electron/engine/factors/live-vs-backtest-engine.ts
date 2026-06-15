// R193 J3: Live vs Backtest Deviation Engine
// Curve overlay + attribution analysis (data delay / overfitting / market structure change)

export interface DeviationPoint {
  date: string;
  liveValue: number;
  backtestValue: number;
  deviation: number;
  deviationPct: number;
}

export interface DeviationCurve {
  factorId: string;
  symbol: string;
  points: DeviationPoint[];
  correlation: number;
  maxDeviation: number;
  meanDeviation: number;
  rmse: number;
}

export type AttributionCategory = 'data_delay' | 'overfitting' | 'market_structure' | 'survivorship_bias' | 'lookahead' | 'regime_change';

export interface AttributionResult {
  category: AttributionCategory;
  weight: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
  contribution: number;
}

export interface DeviationReport {
  factorId: string;
  symbol: string;
  curve: DeviationCurve;
  attributions: AttributionResult[];
  overallVerdict: 'pass' | 'review' | 'fail';
  recommendation: string;
  timestamp: number;
}

export class LiveVsBacktestDeviationEngine {
  constructor(
    private config: {
      maxMeanDeviation: number;
      maxMaxDeviation: number;
      minCorrelation: number;
      dataDelayThresholdMs: number;
      regimeChangeThreshold: number;
    } = {
      maxMeanDeviation: 0.1, maxMaxDeviation: 0.25,
      minCorrelation: 0.7, dataDelayThresholdMs: 60_000,
      regimeChangeThreshold: 0.15,
    }
  ) {}

  compare(liveCurve: DeviationPoint[], backtestCurve: DeviationPoint[], factorId: string, symbol: string): DeviationReport {
    const points = this.alignCurves(liveCurve, backtestCurve);
    const curve = this.computeDeviationMetrics(factorId, symbol, points);
    const attributions = this.attributeDeviation(curve, liveCurve, backtestCurve);
    const verdict = this.evaluateVerdict(curve, attributions);

    return { factorId, symbol, curve, attributions,
      overallVerdict: verdict,
      recommendation: this.generateRecommendation(verdict, attributions),
      timestamp: Date.now(),
    };
  }

  private alignCurves(live: DeviationPoint[], backtest: DeviationPoint[]): DeviationPoint[] {
    const btMap = new Map<string, number>();
    for (const p of backtest) btMap.set(p.date, p.backtestValue);

    return live.map(lp => {
      const btVal = btMap.get(lp.date) ?? lp.backtestValue;
      const dev = lp.liveValue - btVal;
      return {
        date: lp.date,
        liveValue: lp.liveValue,
        backtestValue: btVal,
        deviation: dev,
        deviationPct: btVal !== 0 ? dev / Math.abs(btVal) : 0,
      };
    });
  }

  private computeDeviationMetrics(factorId: string, symbol: string, points: DeviationPoint[]): DeviationCurve {
    if (points.length === 0) {
      return { factorId, symbol, points: [], correlation: 1, maxDeviation: 0, meanDeviation: 0, rmse: 0 };
    }
    const n = points.length;
    const liveVals = points.map(p => p.liveValue);
    const btVals = points.map(p => p.backtestValue);
    const devs = points.map(p => p.deviation);

    const meanLive = liveVals.reduce((a,b)=>a+b,0)/n;
    const meanBt = btVals.reduce((a,b)=>a+b,0)/n;
    const cov = liveVals.reduce((s,l,i)=>s+(l-meanLive)*(btVals[i]-meanBt),0)/n;
    const stdLive = Math.sqrt(liveVals.reduce((s,v)=>s+(v-meanLive)**2,0)/n) || 1;
    const stdBt = Math.sqrt(btVals.reduce((s,v)=>s+(v-meanBt)**2,0)/n) || 1;
    const correlation = stdLive * stdBt > 0 ? cov / (stdLive * stdBt) : 0;

    const meanDev = devs.reduce((a,b)=>a+b,0)/n;
    const maxDev = Math.max(...devs.map(Math.abs));
    const rmse = Math.sqrt(devs.reduce((s,d)=>s+d*d,0)/n);

    return { factorId, symbol, points, correlation, maxDeviation: maxDev, meanDeviation: Math.abs(meanDev), rmse };
  }

  private attributeDeviation(curve: DeviationCurve, live: DeviationPoint[], backtest: DeviationPoint[]): AttributionResult[] {
    const results: AttributionResult[] = [];
    const totalDev = curve.maxDeviation || 1;

    // Data delay: live lags backtest
    const lagCorrelation = this.computeLagCorrelation(live, backtest, 1);
    const lagContribution = Math.max(0, (lagCorrelation - curve.correlation) * 0.5);
    results.push({
      category: 'data_delay',
      weight: lagContribution,
      description: `Lag correlation: ${lagCorrelation.toFixed(3)} vs direct ${curve.correlation.toFixed(3)}`,
      severity: lagContribution > 0.15 ? 'high' : lagContribution > 0.05 ? 'medium' : 'low',
      contribution: lagContribution,
    });

    // Overfitting: divergence grows over time
    if (curve.points.length > 10) {
      const firstHalf = curve.points.slice(0, Math.floor(curve.points.length/2));
      const secondHalf = curve.points.slice(Math.floor(curve.points.length/2));
      const fhMeanDev = firstHalf.reduce((s,p) => s + Math.abs(p.deviation), 0) / Math.max(1, firstHalf.length);
      const shMeanDev = secondHalf.reduce((s,p) => s + Math.abs(p.deviation), 0) / Math.max(1, secondHalf.length);
      const fhDiff = firstHalf.length > 1 ? (fhMeanDev) : 0;
      const shDiff = secondHalf.length > 1 ? (shMeanDev) : 0;
      const decay = shDiff - fhDiff;
      const overfitWeight = Math.max(0, decay / Math.max(0.01, totalDev));
      results.push({
        category: 'overfitting',
        weight: overfitWeight,
        description: `Deviation growth: ${(decay*100).toFixed(1)}% increase in second half`,
        severity: overfitWeight > 0.2 ? 'high' : overfitWeight > 0.1 ? 'medium' : 'low',
        contribution: overfitWeight,
      });
    }

    // Market structure change: regime shift detection
    const regimeWeight = this.detectRegimeChange(curve, live, backtest);
    results.push({
      category: 'market_structure',
      weight: regimeWeight,
      description: `Regime change score: ${regimeWeight.toFixed(3)}`,
      severity: regimeWeight > this.config.regimeChangeThreshold ? 'high' : regimeWeight > 0.1 ? 'medium' : 'low',
      contribution: regimeWeight,
    });

    // Survivorship bias: always mention as potential
    results.push({
      category: 'survivorship_bias',
      weight: 0.03,
      description: 'Backtest may include only surviving assets (survivorship bias)',
      severity: 'low',
      contribution: 0.03,
    });

    // Lookahead: check for negative deviation (live < backtest consistently)
    const posDev = curve.points.filter(p => p.deviation > 0).length;
    const negDev = curve.points.filter(p => p.deviation < 0).length;
    const total = curve.points.length || 1;
    const lookaheadBias = negDev / total > 0.7 ? (negDev / total - 0.7) * 2 : 0;
    results.push({
      category: 'lookahead',
      weight: lookaheadBias,
      description: `Negative bias: ${(negDev/total*100).toFixed(0)}% of points live < backtest`,
      severity: lookaheadBias > 0.3 ? 'high' : lookaheadBias > 0.1 ? 'medium' : 'low',
      contribution: lookaheadBias,
    });

    return results;
  }

  private computeLagCorrelation(live: DeviationPoint[], backtest: DeviationPoint[], lag: number): number {
    if (live.length <= lag) return 0;
    const lv = live.slice(lag).map(p => p.liveValue);
    const bv = backtest.slice(0, backtest.length - lag).map(p => p.backtestValue);
    const n = lv.length;
    if (n < 3) return 0;
    const ml = lv.reduce((a,b)=>a+b,0)/n, mb = bv.reduce((a,b)=>a+b,0)/n;
    const cov = lv.reduce((s,l,i)=>s+(l-ml)*(bv[i]-mb),0)/n;
    const sl = Math.sqrt(lv.reduce((s,v)=>s+(v-ml)**2,0)/n)||1;
    const sb = Math.sqrt(bv.reduce((s,v)=>s+(v-mb)**2,0)/n)||1;
    return sl * sb > 0 ? cov / (sl * sb) : 0;
  }

  private detectRegimeChange(curve: DeviationCurve, live: DeviationPoint[], backtest: DeviationPoint[]): number {
    if (curve.points.length < 5) return 0;
    const mid = Math.floor(curve.points.length / 2);
    const first = curve.points.slice(0, mid);
    const second = curve.points.slice(mid);
    const fStd = this.stdDev(first.map(p => p.liveValue));
    const sStd = this.stdDev(second.map(p => p.liveValue));
    const fMean = first.reduce((s,p)=>s+p.liveValue,0)/Math.max(1,first.length);
    const sMean = second.reduce((s,p)=>s+p.liveValue,0)/Math.max(1,second.length);
    const meanShift = Math.abs(sMean - fMean) / Math.max(0.01, Math.abs(fMean));
    const volShift = Math.abs(sStd - fStd) / Math.max(0.01, fStd);
    return Math.min(1, (meanShift + volShift) / 2);
  }

  private evaluateVerdict(curve: DeviationCurve, attributions: AttributionResult[]): DeviationReport['overallVerdict'] {
    if (curve.meanDeviation > this.config.maxMaxDeviation) return 'fail';
    if (curve.correlation < this.config.minCorrelation) return 'fail';
    const highSev = attributions.filter(a => a.severity === 'high');
    if (highSev.length >= 2) return 'fail';
    if (curve.meanDeviation > this.config.maxMeanDeviation) return 'review';
    if (highSev.length > 0) return 'review';
    return 'pass';
  }

  private generateRecommendation(verdict: DeviationReport['overallVerdict'], attributions: AttributionResult[]): string {
    const highCats = attributions.filter(a => a.severity === 'high').map(a => a.category);
    if (verdict === 'pass') return 'Live and backtest results are consistent. No action needed.';
    if (verdict === 'fail') return `Factor FAILS deviation check. Primary causes: ${highCats.join(', ')}. Rebuild factor with shorter lookback or add regime filters.`;
    return `Factor needs REVIEW. Check: ${highCats.length > 0 ? highCats.join(', ') : 'general deviation'}. Consider retraining or adjusting parameters.`;
  }

  private stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a,b)=>a+b,0)/values.length;
    return Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/values.length);
  }

  getDeviationJSON(report: DeviationReport): string { return JSON.stringify(report); }

  compareSummary(curves: DeviationCurve[]): { passCount: number; reviewCount: number; failCount: number; avgCorrelation: number; } {
    let pass = 0, review = 0, fail = 0, corrSum = 0;
    for (const c of curves) {
      if (c.meanDeviation > this.config.maxMaxDeviation || c.correlation < this.config.minCorrelation) fail++;
      else if (c.meanDeviation > this.config.maxMeanDeviation) review++;
      else pass++;
      corrSum += c.correlation;
    }
    return { passCount: pass, reviewCount: review, failCount: fail, avgCorrelation: curves.length > 0 ? corrSum / curves.length : 0 };
  }
}