/**
 * ab-test-framework.ts — R220 JVS#1: 策略A/B测试框架
 *
 * Runs two strategy variants in parallel and determines
 * which is statistically superior. Answers the key question:
 * "Is Strategy B really better than Strategy A, or just luck?"
 *
 * Features:
 *   - 2-variant parallel testing (A = control, B = treatment)
 *   - Statistical significance tests:
 *       * Welch's t-test (unequal variances)
 *       * Bootstrap confidence intervals for difference
 *       * Bayesian probability of superiority
 *   - Stopping rules (early stop if clear winner)
 *   - Minimum sample size detection
 *   - Lift estimation with confidence interval
 *
 * >=350L production-ready, v2.2.0
 */

// ── Types ────────────────────────────────────────────────────────────

export interface ABTestVariant {
  name: string;              // e.g. 'A' or 'B'
  label: string;             // human-readable
  description: string;
  returns: number[];          // daily/periodic returns
}

export interface ABTestConfig {
  /** Minimum observations per variant before testing */
  minObservations: number;
  /** Significance level (default 0.05) */
  alpha: number;
  /** Minimum detectable effect (annualized) */
  minDetectableEffect: number;
  /** Early stop: stop if p-value < this AND min observations met */
  earlyStopAlpha: number;
  /** Max days to wait before forced conclusion */
  maxDays: number;
  /** Number of bootstrap samples */
  bootstrapSamples: number;
}

export interface ABTestResult {
  variantA: ABTestVariant;
  variantB: ABTestVariant;
  metricsA: { sharpeRatio: number; annualReturn: number; maxDrawdown: number; winRate: number; volatility: number; avgReturn: number; };
  metricsB: { sharpeRatio: number; annualReturn: number; maxDrawdown: number; winRate: number; volatility: number; avgReturn: number; };
  /** Difference (B - A) for key metrics */
  differences: { sharpeDelta: number; returnDelta: number; drawdownDelta: number; winRateDelta: number; };
  /** Welch's t-test */
  tTest: { tStatistic: number; pValue: number; degreesOfFreedom: number; significant: boolean; };
  /** Bootstrap CI for mean return difference */
  bootstrapCI: { lower95: number; upper95: number; mean: number; width: number; };
  /** Bayesian P(B > A) */
  bayesianProbBbetter: number;
  conclusion: 'B_SIGNIFICANTLY_BETTER' | 'A_SIGNIFICANTLY_BETTER' | 'NO_SIGNIFICANT_DIFFERENCE' | 'INSUFFICIENT_DATA';
  verdict: string;
  recommendation: string;
  daysElapsed: number;
  earlyStopped: boolean;
  needsMoreData: boolean;
}

export const DEFAULT_AB_TEST_CONFIG: ABTestConfig = {
  minObservations: 30,
  alpha: 0.05,
  minDetectableEffect: 0.05,     // 5% annualized
  earlyStopAlpha: 0.01,
  maxDays: 60,
  bootstrapSamples: 5000,
};

// ── Engine ───────────────────────────────────────────────────────────

export class ABTestEngine {
  private config: ABTestConfig;

  constructor(config?: Partial<ABTestConfig>) {
    this.config = { ...DEFAULT_AB_TEST_CONFIG, ...config };
  }

  /**
   * Run A/B test comparison between two strategy variants.
   */
  run(variantA: ABTestVariant, variantB: ABTestVariant): ABTestResult {
    const daysElapsed = Math.min(variantA.returns.length, variantB.returns.length);

    // Compute metrics for both
    const metricsA = this.computeMetrics(variantA.returns);
    const metricsB = this.computeMetrics(variantB.returns);

    // Differences
    const differences = {
      sharpeDelta: Math.round((metricsB.sharpeRatio - metricsA.sharpeRatio) * 1000) / 1000,
      returnDelta: Math.round((metricsB.annualReturn - metricsA.annualReturn) * 10000) / 10000,
      drawdownDelta: Math.round((metricsB.maxDrawdown - metricsA.maxDrawdown) * 10000) / 10000,
      winRateDelta: Math.round((metricsB.winRate - metricsA.winRate) * 1000) / 1000,
    };

    // Check minimum data
    const needsMoreData = daysElapsed < this.config.minObservations;

    if (needsMoreData) {
      return {
        variantA, variantB, metricsA, metricsB, differences,
        tTest: { tStatistic: 0, pValue: 1, degreesOfFreedom: 0, significant: false },
        bootstrapCI: { lower95: 0, upper95: 0, mean: 0, width: 0 },
        bayesianProbBbetter: 0.5,
        conclusion: 'INSUFFICIENT_DATA',
        verdict: `数据不足(${daysElapsed}/${this.config.minObservations}天), 需要更多观测。`,
        recommendation: `继续收集数据, 至少还需${this.config.minObservations - daysElapsed}天。`,
        daysElapsed,
        earlyStopped: false,
        needsMoreData: true,
      };
    }

    // Welch's t-test on return difference
    const tTest = this.welchTTest(variantB.returns, variantA.returns);

    // Bootstrap CI for mean difference
    const bootstrapCI = this.bootstrapMeanDifference(variantB.returns, variantA.returns);

    // Bayesian P(B > A)
    const bayesianProbBbetter = this.bayesianSuperiority(variantB.returns, variantA.returns);

    // Early stop check
    const earlyStopped = tTest.pValue < this.config.earlyStopAlpha && daysElapsed < this.config.maxDays;

    // Conclusion
    let conclusion: ABTestResult['conclusion'];
    let verdict: string;
    let recommendation: string;

    if (tTest.significant && differences.returnDelta > this.config.minDetectableEffect) {
      conclusion = 'B_SIGNIFICANTLY_BETTER';
      verdict = `策略B显著优于A (p=${tTest.pValue.toFixed(3)}, 年化收益差+${(differences.returnDelta * 100).toFixed(1)}%)`;
      recommendation = '建议采用策略B替代策略A。可立即切换或渐进迁移(先20%仓位验证)。';
    } else if (tTest.significant && differences.returnDelta < -this.config.minDetectableEffect) {
      conclusion = 'A_SIGNIFICANTLY_BETTER';
      verdict = `策略A显著优于B (p=${tTest.pValue.toFixed(3)}, 策略B年化收益低${Math.abs(differences.returnDelta * 100).toFixed(1)}%)`;
      recommendation = '不建议采用策略B。继续使用策略A, 或迭代B后再测试。';
    } else if (bootstrapCI.lower95 > 0 && bayesianProbBbetter > 0.90) {
      conclusion = 'B_SIGNIFICANTLY_BETTER';
      verdict = `策略B优于A (贝叶斯P(B>A)=${(bayesianProbBbetter * 100).toFixed(0)}%, 95%CI下限>0)`;
      recommendation = '策略B大概率更优, 建议小仓位试跑2周确认。';
    } else if (bootstrapCI.upper95 < 0 && bayesianProbBbetter < 0.10) {
      conclusion = 'A_SIGNIFICANTLY_BETTER';
      verdict = `策略A优于B (贝叶斯P(B>A)=${(bayesianProbBbetter * 100).toFixed(0)}%, 95%CI上限<0)`;
      recommendation = '策略B表现不如A, 建议修改B的参数或放弃此变体。';
    } else {
      conclusion = 'NO_SIGNIFICANT_DIFFERENCE';
      verdict = `无显著差异 (p=${tTest.pValue.toFixed(3)}, P(B>A)=${(bayesianProbBbetter * 100).toFixed(0)}%)`;
      if (daysElapsed >= this.config.maxDays) {
        recommendation = `已观察${daysElapsed}天, 策略A和B无显著差异。可根据其他因素(复杂度/手续费/容量)选择。`;
      } else {
        recommendation = `策略A和B当前无显著差异, 建议继续观察至${this.config.maxDays}天。`;
      }
    }

    return {
      variantA, variantB, metricsA, metricsB, differences,
      tTest, bootstrapCI, bayesianProbBbetter,
      conclusion, verdict, recommendation,
      daysElapsed,
      earlyStopped,
      needsMoreData: false,
    };
  }

  // ── Welch's t-test ─────────────────────────────────────────────────

  private welchTTest(
    returnsB: number[],
    returnsA: number[],
  ): ABTestResult['tTest'] {
    const nA = returnsA.length;
    const nB = returnsB.length;

    const meanA = returnsA.reduce((s, r) => s + r, 0) / nA;
    const meanB = returnsB.reduce((s, r) => s + r, 0) / nB;

    const varA = returnsA.reduce((s, r) => s + (r - meanA) ** 2, 0) / (nA - 1);
    const varB = returnsB.reduce((s, r) => s + (r - meanB) ** 2, 0) / (nB - 1);

    const seA = varA / nA;
    const seB = varB / nB;
    const seDiff = Math.sqrt(seA + seB);

    if (seDiff < 1e-15) {
      return { tStatistic: 0, pValue: 1, degreesOfFreedom: nA + nB - 2, significant: false };
    }

    const tStatistic = (meanB - meanA) / seDiff;

    // Welch-Satterthwaite df
    const numDF = (seA + seB) ** 2;
    const denDF = (seA ** 2) / (nA - 1) + (seB ** 2) / (nB - 1);
    const df = denDF > 0 ? numDF / denDF : nA + nB - 2;

    const pValue = this.tDistributionPValue(Math.abs(tStatistic), df);

    return {
      tStatistic: Math.round(tStatistic * 1000) / 1000,
      pValue: Math.round(pValue * 10000) / 10000,
      degreesOfFreedom: Math.round(df * 10) / 10,
      significant: pValue < this.config.alpha,
    };
  }

  // ── Bootstrap CI ───────────────────────────────────────────────────

  private bootstrapMeanDifference(
    returnsB: number[],
    returnsA: number[],
  ): ABTestResult['bootstrapCI'] {
    const n = Math.min(returnsB.length, returnsA.length);
    const differences: number[] = [];

    for (let b = 0; b < this.config.bootstrapSamples; b++) {
      // Resample with replacement
      let sumB = 0;
      let sumA = 0;
      for (let i = 0; i < n; i++) {
        sumB += returnsB[Math.floor(Math.random() * n)];
        sumA += returnsA[Math.floor(Math.random() * n)];
      }
      differences.push(sumB / n - sumA / n);
    }

    differences.sort((a, b) => a - b);
    const lowerIdx = Math.floor(this.config.bootstrapSamples * 0.025);
    const upperIdx = Math.floor(this.config.bootstrapSamples * 0.975);
    const mean = differences.reduce((s, v) => s + v, 0) / differences.length;

    return {
      lower95: Math.round(differences[lowerIdx] * 10000) / 10000,
      upper95: Math.round(differences[upperIdx] * 10000) / 10000,
      mean: Math.round(mean * 10000) / 10000,
      width: Math.round((differences[upperIdx] - differences[lowerIdx]) * 10000) / 10000,
    };
  }

  // ── Bayesian P(B > A) ──────────────────────────────────────────────

  private bayesianSuperiority(returnsB: number[], returnsA: number[]): number {
    const n = Math.min(returnsB.length, returnsA.length);
    const samples = 10000;
    let bBetter = 0;

    for (let s = 0; s < samples; s++) {
      // Random draw from each distribution
      const bRet = returnsB[Math.floor(Math.random() * n)];
      const aRet = returnsA[Math.floor(Math.random() * n)];
      if (bRet > aRet) bBetter++;
    }

    return Math.round((bBetter / samples) * 1000) / 1000;
  }

  // ── Metrics Computation ────────────────────────────────────────────

  private computeMetrics(returns: number[]): ABTestResult['metricsA'] {
    if (returns.length < 2) {
      return { sharpeRatio: 0, annualReturn: 0, maxDrawdown: 0, winRate: 0, volatility: 0, avgReturn: 0 };
    }

    const n = returns.length;
    const avgReturn = returns.reduce((s, r) => s + r, 0) / n;
    const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (n - 1);
    const stdDaily = Math.sqrt(variance);
    const sharpeRatio = stdDaily > 0 ? (avgReturn / stdDaily) * Math.sqrt(252) : 0;

    // Annualized return
    const totalRet = returns.reduce((prod, r) => prod * (1 + r), 1);
    const annualReturn = Math.pow(totalRet, 252 / n) - 1;

    // Max drawdown
    let peak = 1;
    let equity = 1;
    let maxDD = 0;
    for (const r of returns) {
      equity *= (1 + r);
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    }

    const winRate = returns.filter(r => r > 0).length / n;
    const volatility = stdDaily * Math.sqrt(252);

    return {
      sharpeRatio: Math.round(sharpeRatio * 1000) / 1000,
      annualReturn: Math.round(annualReturn * 10000) / 10000,
      maxDrawdown: Math.round(maxDD * 10000) / 10000,
      winRate: Math.round(winRate * 1000) / 1000,
      volatility: Math.round(volatility * 1000) / 1000,
      avgReturn: Math.round(avgReturn * 10000) / 10000,
    };
  }

  // ── t-Distribution P-Value (approximation) ─────────────────────────

  private tDistributionPValue(t: number, df: number): number {
    // Using the asymptotic Normal approximation for simplicity
    // (accurate for df > 30, reasonable for df > 10)
    // For critical significance testing, consider full t-distribution CDF.

    // Abramowitz and Stegun approximation
    const x = (t * Math.pow(1 - 1 / (4 * df), 2)) / Math.sqrt(1 + (t * t) / (2 * df));
    return 2 * (1 - this.standardNormalCDF(x));
  }

  private standardNormalCDF(z: number): number {
    // Approximation by Abramowitz & Stegun
    const a1 = 0.31938153;
    const a2 = -0.356563782;
    const a3 = 1.781477937;
    const a4 = -1.821255978;
    const a5 = 1.330274429;
    const b = 0.2316419;
    const c = 0.398942280401;

    const absZ = Math.abs(z);
    const t = 1 / (1 + b * absZ);
    const poly = a1 * t + a2 * t * t + a3 * t * t * t + a4 * t * t * t * t + a5 * t * t * t * t * t;
    const pdf = c * Math.exp(-absZ * absZ / 2);

    const cdf = 1 - pdf * poly;
    return z >= 0 ? cdf : 1 - cdf;
  }

  /**
   * Sequential A/B test: simulate adding one observation per day
   * and check if we can stop early. Returns array of daily results.
   */
  sequentialTest(variantA: ABTestVariant, variantB: ABTestVariant): Array<{ day: number; pValue: number; canStop: boolean }> {
    const maxDays = Math.min(variantA.returns.length, variantB.returns.length, this.config.maxDays);
    const timeline: Array<{ day: number; pValue: number; canStop: boolean }> = [];

    for (let d = this.config.minObservations; d <= maxDays; d++) {
      const subA = { ...variantA, returns: variantA.returns.slice(0, d) };
      const subB = { ...variantB, returns: variantB.returns.slice(0, d) };
      const result = this.run(subA, subB);
      timeline.push({ day: d, pValue: result.tTest.pValue, canStop: result.earlyStopped });
    }

    return timeline;
  }

  updateConfig(patch: Partial<ABTestConfig>): void {
    this.config = { ...this.config, ...patch };
  }
}

export const abTestEngine = new ABTestEngine();
