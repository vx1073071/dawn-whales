// ── J-72-03: Factor Research Engine ──────────────────────────────────────
// IC (Information Coefficient) + IR (Information Ratio) + Factor Exposure
// Factor Return + Decay + Crowding + Long-Short Spread

// ── Types ────────────────────────────────────────────────────────────────

export interface FactorSeries {
  symbol: string;
  factorName: string;
  values: number[];
  dates: string[];
}

export interface FactorReturn {
  factorName: string;
  date: string;
  longReturn: number;
  shortReturn: number;
  longShortSpread: number;
}

export interface ICResult {
  factorName: string;
  period: string;
  rankIC: number; // Spearman rank correlation
  pearsonIC: number; // Pearson correlation
  IR: number; // Information Ratio = mean(IC) / std(IC)
  tStat: number; // IC t-statistic
  hitRate: number; // proportion of IC > 0
  halfLife: number; // decay half-life (periods)
  crowding: number; // 0-1, higher = more crowded
  observations: number;
}

export interface FactorExposure {
  symbol: string;
  factorName: string;
  exposure: number; // standardized beta
  contribution: number; // % contribution to total return
  tValue: number; // significance
  date: string;
}

export interface FactorDecay {
  factorName: string;
  decayCurve: number[]; // IC over lag periods
  halfLife: number; // periods until IC drops to 50%
  stable: boolean; // true if halfLife > 12
}

// ── Factor Research Engine ───────────────────────────────────────────────

export class FactorResearchEngine {
  // ── IC / IR Calculation ────────────────────────────────────────────────

  /**
   * Compute Rank IC (Spearman) and Pearson IC between factor values and forward returns.
   */
  computeIC(
    factorName: string,
    factorValues: number[],
    forwardReturns: number[],
    dates: string[],
  ): ICResult {
    if (factorValues.length !== forwardReturns.length || factorValues.length < 20) {
      return this.emptyIC(factorName, dates[0] ?? "");
    }

    const n = factorValues.length;

    // Rank IC (Spearman)
    const rankIC = this.spearmanRank(factorValues, forwardReturns);

    // Pearson IC
    const pearsonIC = this.pearsonCorrelation(factorValues, forwardReturns);

    // IR = mean(IC) / std(IC) over rolling periods
    const rollingICs = this.rollingIC(factorValues, forwardReturns, 20);
    const meanRollingIC = rollingICs.reduce((a, b) => a + b, 0) / rollingICs.length;
    const stdRollingIC = Math.sqrt(
      rollingICs.reduce((s, v) => s + (v - meanRollingIC) ** 2, 0) / rollingICs.length,
    );
    const IR = stdRollingIC > 0 ? meanRollingIC / stdRollingIC : 0;

    // t-stat
    const tStat = stdRollingIC > 0 ? (meanRollingIC * Math.sqrt(rollingICs.length)) / stdRollingIC : 0;

    // Hit rate
    const hitRate = rollingICs.filter((v) => v > 0).length / rollingICs.length;

    // Half-life (decay)
    const halfLife = this.estimateHalfLife(factorValues, forwardReturns);

    // Crowding (lower IC spread => more crowded)
    const crowding = this.estimateCrowding(rollingICs);

    return {
      factorName,
      period: `${dates[0]}–${dates[dates.length - 1]}`,
      rankIC: Number(rankIC.toFixed(4)),
      pearsonIC: Number(pearsonIC.toFixed(4)),
      IR: Number(IR.toFixed(4)),
      tStat: Number(tStat.toFixed(4)),
      hitRate: Number(hitRate.toFixed(4)),
      halfLife,
      crowding: Number(crowding.toFixed(4)),
      observations: n,
    };
  }

  // ── Factor Exposure ─────────────────────────────────────────────────────

  computeExposure(
    symbol: string,
    factorValues: number[],
    returns: number[],
    dates: string[],
  ): FactorExposure[] {
    if (factorValues.length < 2 || returns.length !== factorValues.length) return [];

    const n = factorValues.length;
    const meanFactor = factorValues.reduce((a, b) => a + b, 0) / n;
    const meanReturn = returns.reduce((a, b) => a + b, 0) / n;

    let cov = 0;
    let varFactor = 0;
    for (let i = 0; i < n; i++) {
      cov += (factorValues[i] - meanFactor) * (returns[i] - meanReturn);
      varFactor += (factorValues[i] - meanFactor) ** 2;
    }
    cov /= n;
    varFactor /= n;

    const beta = varFactor > 0 ? cov / varFactor : 0;
    const tValue = varFactor > 0 ? beta / Math.sqrt(varFactor / n) : 0;

    const totalReturn = returns.reduce((a, b) => a + Math.abs(b), 0);
    const contribution = totalReturn > 0 ? Math.abs(beta * meanFactor * 100) / totalReturn : 0;

    return factorValues.map((fv, i) => ({
      symbol,
      factorName: "custom",
      exposure: Number(beta.toFixed(4)),
      contribution: Number(contribution.toFixed(4)),
      tValue: Number(tValue.toFixed(4)),
      date: dates[i] ?? `d${i}`,
    }));
  }

  // ── Factor Returns & Long-Short Spread ─────────────────────────────────

  computeFactorReturn(
    factorValues: number[],
    returns: number[],
    dates: string[],
    quantile: number = 0.2,
  ): FactorReturn[] {
    if (factorValues.length < 5) return [];
    const n = factorValues.length;
    const results: FactorReturn[] = [];

    // Sort by factor, split into quintiles
    for (let i = 0; i < n; i++) {
      const topCutoff = this.quantile(factorValues, 1 - quantile);
      const bottomCutoff = this.quantile(factorValues, quantile);

      const topRets = returns.filter((_, j) => factorValues[j] >= topCutoff);
      const bottomRets = returns.filter((_, j) => factorValues[j] <= bottomCutoff);

      const longRet = topRets.length > 0 ? topRets.reduce((a, b) => a + b, 0) / topRets.length : 0;
      const shortRet = bottomRets.length > 0 ? bottomRets.reduce((a, b) => a + b, 0) / bottomRets.length : 0;

      results.push({
        factorName: "custom",
        date: dates[i] ?? `d${i}`,
        longReturn: Number(longRet.toFixed(6)),
        shortReturn: Number(shortRet.toFixed(6)),
        longShortSpread: Number((longRet - shortRet).toFixed(6)),
      });
    }

    return results;
  }

  // ── Factor Decay ───────────────────────────────────────────────────────

  computeDecay(
    factorValues: number[],
    forwardReturns: number[],
    maxLag: number = 60,
  ): FactorDecay {
    const decayCurve: number[] = [];
    const n = factorValues.length;

    for (let lag = 1; lag <= Math.min(maxLag, n - 10); lag++) {
      const laggedValues = factorValues.slice(0, n - lag);
      const laggedReturns = forwardReturns.slice(lag);
      const ic = this.pearsonCorrelation(laggedValues, laggedReturns);
      decayCurve.push(Number(ic.toFixed(4)));
    }

    // Half-life: find lag where IC drops to 50% of initial
    let halfLife = maxLag;
    if (decayCurve.length > 0 && decayCurve[0] > 0) {
      const halfTarget = decayCurve[0] / 2;
      for (let i = 1; i < decayCurve.length; i++) {
        if (decayCurve[i] <= halfTarget) {
          halfLife = i + 1;
          break;
        }
      }
    }

    return {
      factorName: "custom",
      decayCurve,
      halfLife,
      stable: halfLife >= 12,
    };
  }

  // ── Multi-Factor Comparison ────────────────────────────────────────────

  compareFactors(factors: ICResult[]): {
    best: ICResult | null;
    ranking: { name: string; score: number }[];
  } {
    if (factors.length === 0) return { best: null, ranking: [] };

    // Composite score: 40% IR + 30% rankIC + 20% hitRate + 10% halfLife stability
    const ranking = factors.map((f) => {
      const score =
        0.4 * f.IR +
        0.3 * Math.abs(f.rankIC) +
        0.2 * f.hitRate +
        0.1 * (f.halfLife >= 12 ? 1 : f.halfLife / 12);
      return { name: f.factorName, score: Number(score.toFixed(4)) };
    });

    ranking.sort((a, b) => b.score - a.score);

    return {
      best: factors.find((f) => f.factorName === ranking[0]?.name) ?? null,
      ranking,
    };
  }

  // ── Statistics Utilities ────────────────────────────────────────────────

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let cov = 0, varX = 0, varY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      cov += dx * dy;
      varX += dx * dx;
      varY += dy * dy;
    }

    const denom = Math.sqrt(varX * varY);
    return denom > 0 ? cov / denom : 0;
  }

  private spearmanRank(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    const rankX = this.rank(x);
    const rankY = this.rank(y);
    return this.pearsonCorrelation(rankX, rankY);
  }

  private rank(values: number[]): number[] {
    const indexed = values.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(values.length);
    for (let i = 0; i < indexed.length; i++) {
      ranks[indexed[i].i] = (i + 1) / values.length;
    }
    return ranks;
  }

  private quantile(values: number[], q: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.floor(q * (sorted.length - 1));
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  private rollingIC(factorValues: number[], returns: number[], window: number): number[] {
    const results: number[] = [];
    for (let i = window; i <= factorValues.length; i++) {
      const fv = factorValues.slice(i - window, i);
      const r = returns.slice(i - window, i);
      results.push(this.spearmanRank(fv, r));
    }
    return results;
  }

  private estimateHalfLife(factorValues: number[], returns: number[]): number {
    // Autocorrelation of factor IC over lags
    const ics = this.rollingIC(factorValues, returns, 20);
    if (ics.length < 2) return 0;
    const mean = ics.reduce((a, b) => a + b, 0) / ics.length;
    let sumSq = 0;
    for (let i = 1; i < ics.length; i++) {
      sumSq += (ics[i] - ics[i - 1]) ** 2;
    }
    const variance = sumSq / (ics.length - 1);
    return variance > 0 ? Math.round(Math.log(2) / Math.sqrt(variance)) : 0;
  }

  private estimateCrowding(rollingICs: number[]): number {
    if (rollingICs.length < 2) return 0;
    const stdIC = Math.sqrt(
      rollingICs.reduce((s, v) => s + (v - rollingICs.reduce((a, b) => a + b, 0) / rollingICs.length) ** 2, 0) /
        rollingICs.length,
    );
    // Lower IC std => more crowded (everyone uses the same factor)
    return Math.max(0, Math.min(1, 1 - stdIC / 0.1));
  }

  private emptyIC(factorName: string, period: string): ICResult {
    return {
      factorName,
      period,
      rankIC: 0,
      pearsonIC: 0,
      IR: 0,
      tStat: 0,
      hitRate: 0,
      halfLife: 0,
      crowding: 0,
      observations: 0,
    };
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createFactorResearchEngine(): FactorResearchEngine {
  return new FactorResearchEngine();
}
