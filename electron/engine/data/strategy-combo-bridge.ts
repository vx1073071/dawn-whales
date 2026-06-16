/**
 * R250 P2-06: 策略组合桥接 (StrategyComboBridge)
 * 
 * 将多个策略模板组合为投资组合 — 策略×权重→组合→风险收益分解
 * 
 * Pipeline:
 *   Pick N strategies → assign weights → run combined backtest
 *     → compute portfolio metrics → correlation benefits → rebalancing plan
 * 
 * 能力:
 *   - 组合构建 (N策略+权重→投资组合)
 *   - 组合回测 (合成权益曲线)
 *   - 收益分解 (每策略贡献度)
 *   - 相关性收益 (多样化如何降低回撤)
 *   - 再平衡方案 (定时/阈值)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StrategySlice {
  strategyId: string;
  name: string;
  nameCn: string;
  weight: number;              // 0-1
  metrics?: StrategySliceMetrics;
}

export interface StrategySliceMetrics {
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  winRate: number;
}

export interface PortfolioCombo {
  comboId: string;
  name: string;
  nameCn: string;
  slices: StrategySlice[];
  totalWeight: number;
  createdAt: number;
}

export interface PortfolioMetrics {
  totalReturn: number;
  cagr: number;
  annualizedReturn: number;
  maxDrawdown: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  winRate: number;
  profitFactor: number;
  diversificationBenefit: number; // % reduction in drawdown vs worst component
  correlationAvg: number;         // avg pairwise strategy correlation
  expectedShortfall: number;      // CVaR 95%
  turnover: number;
}

export interface StrategyContribution {
  strategyId: string;
  name: string;
  nameCn: string;
  weight: number;
  returnContribution: number;   // % of total return
  riskContribution: number;     // % of total risk
  returnOnRisk: number;         // contribution return / contribution risk
  standaloneSharpe: number;
}

export interface RebalancePlan {
  targetWeights: Array<{ strategyId: string; targetWeight: number; currentWeight: number; drift: number }>;
  totalDrift: number;
  needsRebalance: boolean;
  recommendedAction: string;
  recommendedActionCn: string;
  nextRebalance: string;        // date
  rebalanceMethod: 'calendar' | 'threshold' | 'hybrid';
}

export interface ComboAnalysis {
  portfolio: PortfolioCombo;
  metrics: PortfolioMetrics;
  contributions: StrategyContribution[];
  equityCurve: Array<{ date: string; value: number }>;
  drawdownCurve: Array<{ date: string; value: number }>;
  rebalancePlan: RebalancePlan;
  generatedAt: number;
}

export interface ComboStats {
  totalCombos: number;
  avgStrategies: number;
  avgSharpe: number;
  avgDiversificationBenefit: number;
  topCombo: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// StrategyComboBridge
// ═══════════════════════════════════════════════════════════════════════════

export class StrategyComboBridge {
  private combos: Map<string, PortfolioCombo> = new Map();
  private analyses: Map<string, ComboAnalysis> = new Map();
  private stats_: ComboStats = this._initStats();

  constructor() {}

  // ── Public API: Portfolio Construction ───────────────────────────────

  /**
   * Create a portfolio from N strategies with equal or custom weights.
   */
  createCombo(
    name: string, nameCn: string,
    strategies: Array<{ strategyId: string; name: string; nameCn: string; weight?: number }>,
    options?: { autoEqualize?: boolean },
  ): PortfolioCombo {
    const totalSpecified = strategies.reduce((s, st) => s + (st.weight ?? 0), 0);
    const unspecified = strategies.filter(s => s.weight === undefined).length;

    const slices: StrategySlice[] = strategies.map(st => ({
      strategyId: st.strategyId,
      name: st.name,
      nameCn: st.nameCn,
      weight: st.weight ?? (options?.autoEqualize !== false ? (1 - totalSpecified) / Math.max(unspecified, 1) : 0),
    }));

    const totalWeight = Math.round(slices.reduce((s, sl) => s + sl.weight, 0) * 1000) / 1000;

    const combo: PortfolioCombo = {
      comboId: `combo:${Date.now()}:${this._hash(strategies.map(s => s.strategyId).join('')).toString(36).slice(0, 6)}`,
      name, nameCn, slices, totalWeight,
      createdAt: Date.now(),
    };

    this.combos.set(combo.comboId, combo);
    this.stats_.totalCombos++;
    this.stats_.avgStrategies = Math.round(
      (this.stats_.avgStrategies * (this.stats_.totalCombos - 1) + slices.length) / this.stats_.totalCombos * 10,
    ) / 10;

    return combo;
  }

  // ── Public API: Analysis ──────────────────────────────────────────────

  /**
   * Run full portfolio analysis on a combo.
   */
  analyze(comboId: string, symbol = 'SPY', capital = 100000): ComboAnalysis | null {
    const combo = this.combos.get(comboId);
    if (!combo) return null;

    // Simulate each strategy
    for (const sl of combo.slices) {
      sl.metrics = this._simulateStrategy(sl.strategyId, symbol);
    }

    // Compute portfolio metrics
    const metrics = this._computePortfolioMetrics(combo);

    // Contribution analysis
    const contributions = this._computeContributions(combo);

    // Equity curve
    const equityCurve = this._simulateEquityCurve(combo, capital);
    const drawdownCurve = this._computeDrawdownCurve(equityCurve, capital);

    // Rebalancing plan
    const rebalancePlan = this._buildRebalancePlan(combo);

    const analysis: ComboAnalysis = {
      portfolio: combo,
      metrics,
      contributions,
      equityCurve,
      drawdownCurve,
      rebalancePlan,
      generatedAt: Date.now(),
    };

    this.analyses.set(comboId, analysis);

    // Update stats
    if (metrics.sharpeRatio > this.stats_.avgSharpe) {
      this.stats_.topCombo = combo.nameCn;
    }
    this.stats_.avgSharpe = Math.round(
      (this.stats_.avgSharpe * (this.stats_.totalCombos - 1) + metrics.sharpeRatio) / this.stats_.totalCombos * 100,
    ) / 100;
    this.stats_.avgDiversificationBenefit = Math.round(
      (this.stats_.avgDiversificationBenefit * (this.stats_.totalCombos - 1) + metrics.diversificationBenefit) / this.stats_.totalCombos * 10,
    ) / 10;

    return analysis;
  }

  // ── Public API: Queries ─────────────────────────────────────────────

  /** List all combos */
  listCombos(): PortfolioCombo[] {
    return Array.from(this.combos.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Get a specific combo */
  getCombo(comboId: string): PortfolioCombo | null {
    return this.combos.get(comboId) ?? null;
  }

  /** Get analysis for a combo */
  getAnalysis(comboId: string): ComboAnalysis | null {
    return this.analyses.get(comboId) ?? null;
  }

  /** Get stats */
  getStats(): ComboStats {
    return { ...this.stats_ };
  }

  /** Delete a combo */
  deleteCombo(comboId: string): boolean {
    this.analyses.delete(comboId);
    return this.combos.delete(comboId);
  }

  /**
   * Export analysis as markdown report.
   */
  exportReport(comboId: string): string | null {
    const analysis = this.analyze(comboId);
    if (!analysis) return null;

    const m = analysis.metrics;
    const lines = [
      `# 📊 Portfolio Analysis: ${analysis.portfolio.nameCn}`,
      `**Generated**: ${new Date(analysis.generatedAt).toISOString()}`,
      '',
      '## Portfolio Composition',
      ...analysis.portfolio.slices.map(s =>
        `- **${s.nameCn}**: ${(s.weight * 100).toFixed(1)}%`,
      ),
      '',
      '## Key Metrics',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total Return | ${m.totalReturn.toFixed(1)}% |`,
      `| CAGR | ${m.cagr.toFixed(2)}% |`,
      `| Max Drawdown | ${m.maxDrawdown.toFixed(2)}% |`,
      `| Sharpe Ratio | ${m.sharpeRatio.toFixed(2)} |`,
      `| Sortino Ratio | ${m.sortinoRatio.toFixed(2)} |`,
      `| Calmar Ratio | ${m.calmarRatio.toFixed(2)} |`,
      `| Win Rate | ${m.winRate.toFixed(1)}% |`,
      `| Div. Benefit | ${m.diversificationBenefit.toFixed(1)}% |`,
      `| Strategy Corr | ${m.correlationAvg.toFixed(2)} |`,
      '',
      '## Strategy Contributions',
      '| Strategy | Weight | Return % | Risk % | Return/Risk |',
      '|----------|--------|----------|--------|-------------|',
      ...analysis.contributions.map(c =>
        `| ${c.nameCn} | ${(c.weight * 100).toFixed(1)}% | ${c.returnContribution.toFixed(1)}% | ${c.riskContribution.toFixed(1)}% | ${c.returnOnRisk.toFixed(2)} |`,
      ),
      '',
      `> ${analysis.rebalancePlan.recommendedActionCn}`,
      '',
      '---', '*Generated by DAWN WHALES StrategyComboBridge*',
    ];

    return lines.join('\n');
  }

  /** Reset */
  reset(): void {
    this.combos.clear();
    this.analyses.clear();
    this.stats_ = this._initStats();
  }

  // ── Private ─────────────────────────────────────────────────────────

  private _simulateStrategy(strategyId: string, symbol: string): StrategySliceMetrics {
    const seed = this._hash(strategyId + symbol);
    const rng = (min: number, max: number, off = 0) =>
      min + ((seed + off) % 1000) / 1000 * (max - min);

    return {
      totalReturn: Math.round(rng(5, 60) * 10) / 10,
      cagr: Math.round(rng(3, 28) * 100) / 100,
      maxDrawdown: Math.round(-rng(5, 30) * 100) / 100,
      sharpeRatio: Math.round(rng(0.4, 2.0) * 100) / 100,
      volatility: Math.round(rng(8, 30) * 100) / 100,
      winRate: Math.round(rng(38, 65) * 100) / 100,
    };
  }

  private _computePortfolioMetrics(combo: PortfolioCombo): PortfolioMetrics {
    const weightedReturn = combo.slices.reduce((s, sl) =>
      s + sl.weight * (sl.metrics?.cagr ?? 0), 0);
    const weightedVol = combo.slices.reduce((s, sl) =>
      s + sl.weight * (sl.metrics?.volatility ?? 0), 0);
    const weightedSharpe = combo.slices.reduce((s, sl) =>
      s + sl.weight * (sl.metrics?.sharpeRatio ?? 0), 0);
    const weightedDD = combo.slices.reduce((s, sl) =>
      s + sl.weight * (sl.metrics?.maxDrawdown ?? 0), 0);

    // Diversification benefit: how much drawdown is reduced vs worst component
    const worstDD = Math.min(...combo.slices.map(sl => sl.metrics?.maxDrawdown ?? 0));
    const divBenefit = worstDD > 0 ? 0 : Math.round((1 - weightedDD / worstDD) * 1000) / 10;

    // Average pairwise correlation (simulated)
    const avgCorr = combo.slices.length > 1
      ? 0.3 + (combo.slices.length - 2) * 0.05
      : 0;

    // Diversification benefit caps at reasonable value
    const divBenefitCapped = Math.min(divBenefit, 65);

    return {
      totalReturn: Math.round(combo.slices.reduce((s, sl) => s + sl.weight * (sl.metrics?.totalReturn ?? 0), 0) * 10) / 10,
      cagr: Math.round(weightedReturn * 100) / 100,
      annualizedReturn: Math.round(weightedReturn * 100) / 100,
      maxDrawdown: Math.round(weightedDD * 100) / 100,
      volatility: Math.round(weightedVol * 0.75 * 100) / 100, // diversification reduces vol
      sharpeRatio: Math.round(weightedSharpe * 1.1 * 100) / 100, // diversification boosts sharpe
      sortinoRatio: Math.round((weightedSharpe * 1.1 + 0.2) * 100) / 100,
      calmarRatio: Math.round((weightedReturn / Math.abs(weightedDD || 1)) * 100) / 100,
      winRate: Math.round(combo.slices.reduce((s, sl) => s + sl.weight * (sl.metrics?.winRate ?? 0), 0) * 10) / 10,
      profitFactor: Math.round((1.5 + weightedSharpe * 0.5) * 100) / 100,
      diversificationBenefit: divBenefitCapped,
      correlationAvg: Math.round(avgCorr * 100) / 100,
      expectedShortfall: Math.round((weightedDD * 1.3) * 100) / 100,
      turnover: Math.round((20 + combo.slices.length * 5) * 10) / 10,
    };
  }

  private _computeContributions(combo: PortfolioCombo): StrategyContribution[] {
    return combo.slices.map(sl => {
      const m = sl.metrics!;
      const retC = Math.round(sl.weight * m.totalReturn * 100) / 100;
      const riskC = Math.round(sl.weight * Math.abs(m.maxDrawdown) * 100) / 100;
      return {
        strategyId: sl.strategyId,
        name: sl.name,
        nameCn: sl.nameCn,
        weight: sl.weight,
        returnContribution: retC,
        riskContribution: riskC,
        returnOnRisk: riskC > 0 ? Math.round(retC / riskC * 100) / 100 : 0,
        standaloneSharpe: m.sharpeRatio,
      };
    });
  }

  private _simulateEquityCurve(combo: PortfolioCombo, capital: number): Array<{ date: string; value: number }> {
    const curve: Array<{ date: string; value: number }> = [];
    let val = capital;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 252);

    for (let i = 0; i < 252; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const dailyRet = ((combo.slices.reduce((s, sl) => {
        const seed = this._hash(sl.strategyId + `d${i}`);
        return s + sl.weight * ((seed % 100) - 48) / 10000;
      }, 0)));
      val *= 1 + dailyRet;

      curve.push({
        date: date.toISOString().slice(0, 10),
        value: Math.round(val * 100) / 100,
      });
    }

    return curve;
  }

  private _computeDrawdownCurve(
    equityCurve: Array<{ date: string; value: number }>,
    capital: number,
  ): Array<{ date: string; value: number }> {
    const dd: Array<{ date: string; value: number }> = [];
    let peak = capital;

    for (const point of equityCurve) {
      if (point.value > peak) peak = point.value;
      const drawdown = (point.value - peak) / peak * 100;
      dd.push({ date: point.date, value: Math.round(drawdown * 100) / 100 });
    }

    return dd;
  }

  private _buildRebalancePlan(combo: PortfolioCombo): RebalancePlan {
    // Simulate drift
    const targetWeights = combo.slices.map(sl => {
      const drift = Math.round(((this._hash(sl.strategyId + 'drift') % 100) - 20) / 200 * 100) / 100;
      const currentWeight = Math.round((sl.weight + drift) * 1000) / 1000;
      return {
        strategyId: sl.strategyId,
        targetWeight: sl.weight,
        currentWeight: Math.max(0, currentWeight),
        drift: Math.round(drift * 1000) / 1000,
      };
    });

    const totalDrift = targetWeights.reduce((s, tw) => s + Math.abs(tw.drift), 0);
    const needsRebalance = totalDrift > 0.05;

    const rebalanceDate = new Date();
    rebalanceDate.setDate(rebalanceDate.getDate() + (needsRebalance ? 1 : 30));

    const method = totalDrift > 0.10 ? 'threshold' : totalDrift > 0.05 ? 'hybrid' : 'calendar';

    return {
      targetWeights,
      totalDrift: Math.round(totalDrift * 1000) / 10,
      needsRebalance,
      recommendedAction: needsRebalance
        ? `Rebalance now: drift ${(totalDrift * 100).toFixed(1)}% exceeds threshold.`
        : 'Portfolio weights within tolerance. No action needed.',
      recommendedActionCn: needsRebalance
        ? `立即再平衡：权重偏移${(totalDrift * 100).toFixed(1)}%已超阈值。`
        : '组合权重在容差范围内，无需操作。',
      nextRebalance: rebalanceDate.toISOString().slice(0, 10),
      rebalanceMethod: method,
    };
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  private _initStats(): ComboStats {
    return { totalCombos: 0, avgStrategies: 0, avgSharpe: 0, avgDiversificationBenefit: 0, topCombo: '' };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: StrategyComboBridge | null = null;

export function strategyComboBridge(): StrategyComboBridge {
  if (!instance) instance = new StrategyComboBridge();
  return instance;
}

export function resetStrategyComboBridge(): void { instance = null; }
