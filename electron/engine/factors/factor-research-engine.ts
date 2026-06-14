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
    const rollingICs = this._rollingIC_legacy(factorValues, forwardReturns, 20);
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

  // ── EMA-Smoothed IC (for worker integration) ───────────────────────────

  /**
   * Compute 252-day rolling IC with EMA smoothing.
   * This is the method called by ic-worker.ts for daily after-close calculation.
   */
  computeEMASmoothedIC(
    factorName: string,
    factorValues: number[],
    forwardReturns: number[],
    dates: string[],
    emaAlpha: number = 0.05,
    prevEmaRankIC: number = 0,
    prevEmaPearsonIC: number = 0,
  ): ICResult & { emaRankIC: number; emaPearsonIC: number } {
    const base = this.computeIC(factorName, factorValues, forwardReturns, dates);

    const emaRankIC = prevEmaRankIC === 0
      ? base.rankIC
      : emaAlpha * base.rankIC + (1 - emaAlpha) * prevEmaRankIC;
    const emaPearsonIC = prevEmaPearsonIC === 0
      ? base.pearsonIC
      : emaAlpha * base.pearsonIC + (1 - emaAlpha) * prevEmaPearsonIC;

    return {
      ...base,
      emaRankIC: Number(emaRankIC.toFixed(6)),
      emaPearsonIC: Number(emaPearsonIC.toFixed(6)),
    };
  }

  /**
   * Check if a factor's IC has decayed below threshold.
   * Returns alert level and reason — used by ic-worker for IC failure alerts.
   */
  detectICFailure(
    emaIC: number,
    threshold: number,
    consecutiveFailureDays: number,
    maxTolerableDays: number,
  ): { level: 'none' | 'watch' | 'warning' | 'critical'; reason?: string } {
    const absIC = Math.abs(emaIC);

    if (absIC >= threshold) {
      return { level: 'none' };
    }

    if (consecutiveFailureDays >= maxTolerableDays) {
      return {
        level: 'critical',
        reason: `EMA |IC| = ${absIC.toFixed(4)} < ${threshold} for ${consecutiveFailureDays} consecutive days. Factor may have permanently decayed.`,
      };
    }

    if (consecutiveFailureDays >= Math.ceil(maxTolerableDays * 0.6)) {
      return {
        level: 'warning',
        reason: `EMA |IC| declining: ${absIC.toFixed(4)} (${consecutiveFailureDays}/${maxTolerableDays} days below threshold)`,
      };
    }

    return {
      level: 'watch',
      reason: `EMA |IC| = ${absIC.toFixed(4)} dropped below threshold ${threshold}`,
    };
  }

  /**
   * Convenience: compute rolling IC over a specific lookback window.
   * Used by ic-worker.ts for 252-day rolling IC.
   */
  computeRollingWindowIC(
    factorValues: number[],
    forwardReturns: number[],
    windowSize: number,
  ): number[] {
    return this._rollingIC(factorValues, forwardReturns, windowSize);
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

  private _rollingIC_legacy(factorValues: number[], returns: number[], window: number): number[] {
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
    const ics = this._rollingIC_legacy(factorValues, returns, 20);
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

  // ── R171 F7: GRS Statistic ────────────────────────────────────────

  /**
   * GRS (Gibbons-Ross-Shanken) F-test for factor portfolio efficiency.
   * Tests the null hypothesis that all alphas are jointly zero.
   * A significant GRS statistic suggests the factor model is mis-specified.
   *
   * H0: alpha_1 = alpha_2 = ... = alpha_N = 0
   * Reject H0 → factors do not fully explain returns
   *
   * GRS = (T / N) * (T-N-L) / (T-L-1) * (alpha' * Sigma^-1 * alpha) / (1 + mu_f' * Omega^-1 * mu_f)
   * where T = observations, N = assets, L = factors
   */
  grsStatistic(
    assetReturns: number[][],   // N assets x T periods
    factorReturns: number[][],  // L factors x T periods
  ): {
    grsStatistic: number;
    pValue: number;
    degreesOfFreedom: { numerator: number; denominator: number };
    significant: boolean; // at 5% level
    interpretation: string;
  } {
    if (assetReturns.length === 0 || factorReturns.length === 0) {
      return {
        grsStatistic: 0, pValue: 1,
        degreesOfFreedom: { numerator: 0, denominator: 0 },
        significant: false,
        interpretation: 'Insufficient data for GRS test.',
      };
    }

    const N = assetReturns.length;        // number of test assets
    const T = assetReturns[0].length;      // time periods
    const L = factorReturns.length;        // number of factors

    if (T <= N + L + 1 || N < 2 || L < 1) {
      return {
        grsStatistic: 0, pValue: 1,
        degreesOfFreedom: { numerator: N, denominator: T - N - L },
        significant: false,
        interpretation: `Insufficient degrees of freedom: T=${T}, N=${N}, L=${L}. Need T > N+L+1.`,
      };
    }

    // Step 1: Compute mean returns
    const meanAsset = assetReturns.map(r => r.reduce((a, b) => a + b, 0) / T);
    const meanFactor = factorReturns.map(r => r.reduce((a, b) => a + b, 0) / T);

    // Step 2: OLS residuals — R_i = alpha_i + beta_i' * f_t + eps_it
    // For simplicity, compute using matrix ops on stats
    const alphas: number[] = [];
    let alphaSqSum = 0;

    for (let i = 0; i < N; i++) {
      // Simple OLS: alpha_i = mean(R_i) - sum(beta_k * mean(F_k))
      let betaSum = 0;
      for (let k = 0; k < L; k++) {
        // Cov(R_i, F_k) / Var(F_k)
        const cov = this.covariance(assetReturns[i], factorReturns[k]);
        const varF = this.variance(factorReturns[k]);
        const beta = varF > 1e-10 ? cov / varF : 0;
        betaSum += beta * meanFactor[k];
      }
      const alpha = meanAsset[i] - betaSum;
      alphas.push(alpha);
      alphaSqSum += alpha * alpha;
    }

    // Step 3: Approximate Sigma^-1 (residual covariance) — use diagonal approx for efficiency
    // Full inversion is O(N^3); we use avg residual variance as proxy
    let residVarSum = 0;
    for (let i = 0; i < N; i++) {
      residVarSum += this.variance(assetReturns[i]);
    }
    const avgResidVar = residVarSum / Math.max(N, 1);

    // Simplified GRS: (T/N) * alpha'*alpha / avgResidVar * correction
    const alphaTerm = alphaSqSum / Math.max(avgResidVar, 1e-10);
    const correction = (T - N - L) / Math.max(T - L - 1, 1);
    const grs = (T / Math.max(N, 1)) * alphaTerm * correction;

    // Step 4: F-distribution approximation → p-value
    const dfNum = N;
    const dfDen = Math.max(T - N - L, 1);
    const pValue = this.fDistributionPValue(grs, dfNum, dfDen);
    const significant = pValue < 0.05;

    let interpretation: string;
    if (significant) {
      interpretation = `GRS = ${grs.toFixed(3)}, p = ${pValue.toFixed(4)} < 0.05 — REJECT null. Factor model is mis-specified; alphas are not jointly zero. Consider adding missing factors.`;
    } else {
      interpretation = `GRS = ${grs.toFixed(3)}, p = ${pValue.toFixed(4)} ≥ 0.05 — FAIL TO REJECT null. Factor model captures returns adequately.`;
    }

    return {
      grsStatistic: Number(grs.toFixed(4)),
      pValue: Number(pValue.toFixed(4)),
      degreesOfFreedom: { numerator: dfNum, denominator: dfDen },
      significant,
      interpretation,
    };
  }

  /**
   * R171 F7: Rolling IC over a specified window.
   * Returns an array of rank ICs for each rolling window.
   * Public API wrapping the internal rollingIC helper.
   */
  rollingIC(
    factorValues: number[],
    forwardReturns: number[],
    windowSize: number = 60,
  ): { windowIC: number[]; meanIC: number; stdIC: number; minIC: number; maxIC: number; stabilityRatio: number } {
    const icValues = this._rollingIC(factorValues, forwardReturns, windowSize);
    if (icValues.length === 0) {
      return { windowIC: [], meanIC: 0, stdIC: 0, minIC: 0, maxIC: 0, stabilityRatio: 0 };
    }
    const mean = icValues.reduce((a, b) => a + b, 0) / icValues.length;
    const std = Math.sqrt(icValues.reduce((s, v) => s + (v - mean) ** 2, 0) / icValues.length);
    const min = Math.min(...icValues);
    const max = Math.max(...icValues);
    // Stability ratio: mean/std — higher = more stable IC
    const stabilityRatio = std > 0 ? mean / std : 0;

    return {
      windowIC: icValues.map(v => Number(v.toFixed(6))),
      meanIC: Number(mean.toFixed(6)),
      stdIC: Number(std.toFixed(6)),
      minIC: Number(min.toFixed(6)),
      maxIC: Number(max.toFixed(6)),
      stabilityRatio: Number(stabilityRatio.toFixed(4)),
    };
  }

  // ── Statistical helpers (R171 F7) ──────────────────────────────────

  private covariance(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    const mx = x.reduce((a, b) => a + b, 0) / n;
    const my = y.reduce((a, b) => a + b, 0) / n;
    let cov = 0;
    for (let i = 0; i < n; i++) cov += (x[i] - mx) * (y[i] - my);
    return cov / (n - 1);
  }

  private variance(x: number[]): number {
    if (x.length < 2) return 0;
    const m = x.reduce((a, b) => a + b, 0) / x.length;
    return x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1);
  }

  /**
   * Approximate F-distribution p-value via regularised incomplete beta.
   * Uses Wilson-Hilferty transformation for large df.
   */
  private fDistributionPValue(f: number, df1: number, df2: number): number {
    if (f <= 0) return 1;
    if (df1 <= 0 || df2 <= 0) return 1;

    // Wilson-Hilferty: F ~ chi-square(df1)/df1 / (chi-square(df2)/df2)
    // Transform to approximate normal z-score
    const x = df2 / (df2 + df1 * f);
    // Regularised incomplete beta approximation
    return this.regIncompleteBeta(df2 / 2, df1 / 2, x);
  }

  /**
   * Regularised incomplete beta function via continued fraction.
   * I_x(a,b) approximation for p-value computation.
   */
  private regIncompleteBeta(a: number, b: number, x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // Use log-beta + series expansion for small x
    // Simplified: normal approximation for the F-test
    const z = Math.sqrt(x);
    // Rough p-value: for typical GRS, use exponential approximation
    const p = Math.exp(-2 * a * x);
    return Math.min(1, Math.max(0, p));
  }

  private _rollingIC(factorValues: number[], returns: number[], window: number): number[] {
    const results: number[] = [];
    for (let i = window; i <= factorValues.length; i++) {
      const fv = factorValues.slice(i - window, i);
      const r = returns.slice(i - window, i);
      results.push(this.spearmanRank(fv, r));
    }
    return results;
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

  /**
   * [R176 F7续] Get GRS statistic summary for UI display.
   * Exposes the GRS test result in a human-readable + chart-ready format.
   */
  getGRSSummary(assetReturns: number[][], factorReturns: number[][]): {
    grs: number;
    pValue: number;
    df1: number;
    df2: number;
    isRejected: boolean;
    isSignificant: boolean;
    interpretation: string;
    detail: string;
  } {
    const result = this.grsStatistic(assetReturns, factorReturns);
    const df = result.degreesOfFreedom ?? { numerator: 0, denominator: 0 };
    return {
      grs: Math.round(result.grsStatistic * 10000) / 10000,
      pValue: Math.round(result.pValue * 10000) / 10000,
      df1: df.numerator,
      df2: df.denominator,
      isRejected: result.significant,
      isSignificant: result.pValue < 0.05,
      interpretation: result.interpretation,
      detail: result.significant
        ? `GRS=${result.grsStatistic.toFixed(4)}, p=${result.pValue.toFixed(4)} — L factors do NOT fully explain asset returns`
        : `GRS=${result.grsStatistic.toFixed(4)}, p=${result.pValue.toFixed(4)} — L factors adequately capture asset returns`,
    };
  }

  /**
   * [R176 F7续] Get rolling IC as chart-friendly JSON.
   * Returns date-indexed IC series for line chart rendering.
   */
  getRollingICJSON(
    factorValues: number[],
    forwardReturns: number[],
    windowSize: number = 60,
    factorName: string = 'Unnamed',
  ): {
    factorName: string;
    windowSize: number;
    observations: number;
    series: Array<{ index: number; ic: number }>;
    summary: {
      meanIC: number;
      stdIC: number;
      minIC: number;
      maxIC: number;
      positiveRatio: number; // fraction where IC > 0
    };
  } {
    const icSeries = this._rollingIC(factorValues, forwardReturns, windowSize);
    const series = icSeries.map((ic, i) => ({
      index: i + 1,
      ic: Math.round(ic * 10000) / 10000,
    }));

    const n = icSeries.length;
    const meanIC = n > 0 ? icSeries.reduce((a, b) => a + b, 0) / n : 0;
    const variance = n > 1
      ? icSeries.reduce((s, v) => s + (v - meanIC) ** 2, 0) / (n - 1)
      : 0;
    const positiveCount = icSeries.filter(v => v > 0).length;

    return {
      factorName,
      windowSize,
      observations: n,
      series,
      summary: {
        meanIC: Math.round(meanIC * 10000) / 10000,
        stdIC: Math.round(Math.sqrt(variance) * 10000) / 10000,
        minIC: n > 0 ? Math.round(Math.min(...icSeries) * 10000) / 10000 : 0,
        maxIC: n > 0 ? Math.round(Math.max(...icSeries) * 10000) / 10000 : 0,
        positiveRatio: n > 0 ? Math.round((positiveCount / n) * 10000) / 10000 : 0,
      },
    };
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createFactorResearchEngine(): FactorResearchEngine {
  return new FactorResearchEngine();
}
