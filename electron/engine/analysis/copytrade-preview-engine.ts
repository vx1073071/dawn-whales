/**
 * R249 P2-39: CopytradePreview — 策略跟单预览引擎
 * LOBEHUB | v2.8.0
 *
 * "模拟该策略在你持仓下的表现 + AI解释为什么适合/不适合你"
 *
 * 增强跟单决策：不止看策略本身的回测，要看在你的持仓组合中是什么效果。
 *
 * 功能:
 *   1. 假设跟单: 输入持仓+策略→模拟过去N天跟单效果
 *   2. 适合度评分: 风格匹配+风险兼容+因子重叠度
 *   3. AI解释: 自然语言解释为什么这个策略适合/不适合你
 *   4. 风险暴露: 跟单后 vs 跟单前的风险变化
 *
 * 约束: 纯TypeScript, >=450L
 */

import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────

export interface PortfolioHolding {
  symbol: string; name: string; market: string; sector: string;
  weight: number; value: number;
  dailyReturn: number[];
}

export interface StrategyProfile {
  id: string; name: string; category: string; market: string;
  factorIds: string[]; factorWeights: Record<string, number>;
  sharpe: number; maxDrawdown: number; winRate: number;
  riskLevel: 'conservative' | 'balanced' | 'aggressive';
  style: string; avgHoldingDays: number;
}

export interface CopytradePreviewResult {
  strategyId: string; strategyName: string;
  // 适配度
  fitScore: number;         // 0-100
  fitVerdict: 'excellent' | 'good' | 'fair' | 'poor' | 'conflict';
  // 模拟效果
  simulatedReturn: number;   // 跟单模拟收益率
  simulatedSharpe: number;
  simulatedMaxDD: number;
  // 风险变化
  riskBefore: { volatility: number; maxDrawdown: number; diversification: number; };
  riskAfter: { volatility: number; maxDrawdown: number; diversification: number; };
  riskChange: 'improved' | 'neutral' | 'worsened';
  // 因子分析
  factorOverlap: number;     // 策略因子与持仓因子的重叠度 0-1
  overlappingFactors: string[];
  newFactors: string[];      // 策略有你没有的新因子
  // AI解释
  aiExplanation: string;
  recommendation: string;
}

export interface PreviewConfig {
  simulationDays: number;
  fitWeights: { style: number; risk: number; factor: number; market: number; };
  maxOverlapWarning: number; // 重叠度过高
}

const DEFAULT_CONFIG: PreviewConfig = {
  simulationDays: 90,
  fitWeights: { style: 0.30, risk: 0.25, factor: 0.25, market: 0.20 },
  maxOverlapWarning: 0.6,
};

// ── CopytradePreviewEngine ─────────────────────────────────

export class CopytradePreviewEngine {
  readonly id = 'copytrade_preview';
  readonly version = '2.8.0';
  private config: PreviewConfig;

  constructor(config?: Partial<PreviewConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  preview(portfolio: PortfolioHolding[], strategy: StrategyProfile): CopytradePreviewResult {
    // 1. 适合度评分
    const fit = this.calcFit(portfolio, strategy);

    // 2. 模拟跟单
    const sim = this.simulate(portfolio, strategy);

    // 3. 风险变化
    const riskB = this.calcRisk(portfolio);
    const riskA = this.calcRiskSimulated(portfolio, strategy, sim);
    const riskChange = this.judgeRiskChange(riskB, riskA);

    // 4. 因子分析
    const factorAnalysis = this.analyzeFactorOverlap(portfolio, strategy);

    // 5. AI解释
    const ai = this.generateExplanation(fit, sim, riskChange, factorAnalysis, strategy);

    return {
      strategyId: strategy.id, strategyName: strategy.name,
      fitScore: fit.score, fitVerdict: fit.verdict,
      simulatedReturn: sim.return_, simulatedSharpe: sim.sharpe, simulatedMaxDD: sim.maxDD,
      riskBefore: riskB, riskAfter: riskA, riskChange,
      factorOverlap: factorAnalysis.overlap,
      overlappingFactors: factorAnalysis.overlapping,
      newFactors: factorAnalysis.newFactors,
      aiExplanation: ai.explanation, recommendation: ai.recommendation,
    };
  }

  // ── 适合度评分 ──────────────────────────────────────────

  private calcFit(portfolio: PortfolioHolding[], strategy: StrategyProfile): { score: number; verdict: CopytradePreviewResult['fitVerdict'] } {
    let styleScore = 0, riskScore = 0, factorScore = 0, marketScore = 0;

    // 风格匹配: 策略风格 vs 持仓推断风格
    const pfStyle = this.inferStyle(portfolio);
    if (pfStyle === strategy.style) styleScore = 1;
    else if (['momentum', 'trend'].includes(pfStyle) && ['momentum', 'trend'].includes(strategy.style)) styleScore = 0.7;
    else styleScore = 0.3;

    // 风险兼容: 风险等级匹配
    const pfRisk = this.inferRiskLevel(portfolio);
    if (pfRisk === strategy.riskLevel) riskScore = 1;
    else if (pfRisk === 'balanced') riskScore = 0.7;
    else riskScore = 0.4;

    // 因子重叠: 重叠越低分散化越好 (反相关: 重叠高=不适合互补但可能适合替代)
    const overlap = this.calcFactorOverlap(portfolio, strategy);
    factorScore = 1 - overlap; // 低重叠高分

    // 市场覆盖
    const pfMarkets = new Set(portfolio.map(h => h.market));
    marketScore = pfMarkets.has(strategy.market) ? 1 : 0.5;

    const score = Math.round(
      (styleScore * this.config.fitWeights.style +
       riskScore * this.config.fitWeights.risk +
       factorScore * this.config.fitWeights.factor +
       marketScore * this.config.fitWeights.market) * 100
    );

    let verdict: CopytradePreviewResult['fitVerdict'];
    if (score >= 80) verdict = 'excellent';
    else if (score >= 60) verdict = 'good';
    else if (score >= 40) verdict = 'fair';
    else if (score >= 20) verdict = 'poor';
    else verdict = 'conflict';

    return { score, verdict };
  }

  // ── 模拟跟单 ───────────────────────────────────────────

  private simulate(portfolio: PortfolioHolding[], strategy: StrategyProfile): { return_: number; sharpe: number; maxDD: number } {
    const days = this.config.simulationDays;
    const pfReturns: number[] = [];
    // 简化: 混合持仓收益+策略信号
    for (let d = 0; d < days; d++) {
      let dailyRet = 0;
      for (const h of portfolio) {
        dailyRet += (h.dailyReturn[d % (h.dailyReturn.length || 1)] || 0) * h.weight;
      }
      // 叠加策略阿尔法
      const strategyAlpha = (strategy.sharpe / Math.sqrt(252)) * (0.5 + Math.random() * 0.5);
      pfReturns.push(dailyRet * 0.8 + strategyAlpha * 0.2);
    }

    const mean = pfReturns.reduce((a, b) => a + b, 0) / pfReturns.length;
    const variance = pfReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / pfReturns.length;
    const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;
    const annualRet = (1 + mean) ** 252 - 1;

    // MaxDD
    let peak = 1, maxDD = 0, cum = 1;
    for (const r of pfReturns) {
      cum *= (1 + r);
      if (cum > peak) peak = cum;
      const dd = (peak - cum) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    return { return_: Math.round(annualRet * 10000) / 100, sharpe: Math.round(sharpe * 100) / 100, maxDD: Math.round(maxDD * 10000) / 100 };
  }

  // ── 风险分析 ────────────────────────────────────────────

  private calcRisk(portfolio: PortfolioHolding[]): { volatility: number; maxDrawdown: number; diversification: number } {
    const vols = portfolio.map(h => {
      if (h.dailyReturn.length < 2) return 0;
      const m = h.dailyReturn.reduce((a, b) => a + b, 0) / h.dailyReturn.length;
      return Math.sqrt(h.dailyReturn.reduce((s, r) => s + (r - m) ** 2, 0) / h.dailyReturn.length) * Math.sqrt(252);
    });
    const avgVol = vols.reduce((a, b) => a + b, 0) / (vols.length || 1);
    // 分散度 = 1 - (top3 权重和)
    const sorted = [...portfolio].sort((a, b) => b.weight - a.weight);
    const top3 = sorted.slice(0, 3).reduce((s, h) => s + h.weight, 0);
    const divers = 1 - top3;
    return { volatility: Math.round(avgVol * 10000) / 100, maxDrawdown: 0, diversification: Math.round(divers * 100) };
  }

  private calcRiskSimulated(portfolio: PortfolioHolding[], strategy: StrategyProfile, sim: { return_: number; sharpe: number; maxDD: number }): { volatility: number; maxDrawdown: number; diversification: number } {
    const vol = sim.sharpe !== 0 ? Math.abs(sim.return_ / 100 / sim.sharpe) : 0.2;
    return { volatility: Math.round(vol * 10000) / 100, maxDrawdown: sim.maxDD, diversification: Math.round((1 - this.calcFactorOverlap(portfolio, strategy)) * 100) };
  }

  private judgeRiskChange(before: { volatility: number; maxDrawdown: number; diversification: number }, after: { volatility: number; maxDrawdown: number; diversification: number }): 'improved' | 'neutral' | 'worsened' {
    const change = (after.diversification - before.diversification) - (after.volatility - before.volatility) * 0.5;
    if (change > 5) return 'improved';
    if (change < -5) return 'worsened';
    return 'neutral';
  }

  // ── 因子重叠 ───────────────────────────────────────────

  private calcFactorOverlap(portfolio: PortfolioHolding[], strategy: StrategyProfile): number {
    if (strategy.factorIds.length === 0) return 0;
    const allSectors = [...new Set(portfolio.map(h => h.sector))];
    // 简化的重叠: 基于sector和factor的粗略匹配
    let overlap = 0;
    // 模拟: 每个持仓sector可能对应某些因子
    const impliedFactors = new Set(allSectors.flatMap(s => [s.substring(0, 2).toUpperCase() + '_MOMENTUM']));
    for (const f of strategy.factorIds) {
      if (impliedFactors.has(f)) overlap++;
    }
    return overlap > 0 ? Math.min(1, overlap / strategy.factorIds.length) : 0;
  }

  private analyzeFactorOverlap(portfolio: PortfolioHolding[], strategy: StrategyProfile): { overlap: number; overlapping: string[]; newFactors: string[] } {
    const overlap = this.calcFactorOverlap(portfolio, strategy);
    const overlapping = strategy.factorIds.slice(0, Math.floor(strategy.factorIds.length * overlap));
    const newFactors = strategy.factorIds.slice(Math.floor(strategy.factorIds.length * overlap));
    return { overlap: Math.round(overlap * 100), overlapping, newFactors };
  }

  // ── AI解释 ──────────────────────────────────────────────

  private generateExplanation(
    fit: { score: number; verdict: string },
    sim: { return_: number; sharpe: number; maxDD: number },
    riskChange: string,
    factorAnalysis: { overlap: number; overlapping: string[]; newFactors: string[] },
    strategy: StrategyProfile,
  ): { explanation: string; recommendation: string } {
    const fitText: Record<string, string> = {
      excellent: '非常适合你的投资风格',
      good: '与你的持仓较匹配',
      fair: '部分适合，需关注风险',
      poor: '不太匹配你的持仓特征',
      conflict: '与你当前策略冲突',
    };

    let exp = `${fitText[fit.verdict] || '适中'}。`;
    exp += ` 跟单模拟 ${this.config.simulationDays}天 年化${sim.return_ > 0 ? '+' : ''}${sim.return_}%，Sharpe ${sim.sharpe}。`;
    exp += ` 风险${riskChange === 'improved' ? '改善' : riskChange === 'worsened' ? '增加' : '不变'}。`;
    if (factorAnalysis.newFactors.length > 0) {
      exp += ` 带来${factorAnalysis.newFactors.length}个新因子暴露。`;
    }
    if (factorAnalysis.overlap > this.config.maxOverlapWarning * 100) {
      exp += ` ⚠️ 因子重叠度${factorAnalysis.overlap}%，与你现有策略相似，分散化效果有限。`;
    }

    let rec = '';
    if (fit.verdict === 'excellent' || fit.verdict === 'good') rec = '推荐跟单，建议先用小仓位测试';
    else if (fit.verdict === 'fair') rec = '可少量跟单观察，建议设置止损';
    else rec = '建议寻找更匹配的策略，或调整持仓后再跟单';

    return { explanation: exp, recommendation: rec };
  }

  private inferStyle(portfolio: PortfolioHolding[]): string {
    const m = portfolio.reduce((s, h) => { s[h.sector] = (s[h.sector] || 0) + h.weight; return s; }, {} as Record<string, number>);
    const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    if (!top) return 'balanced';
    if (['Technology', 'Crypto'].includes(top[0])) return 'momentum';
    if (['Financials', 'Utilities', 'Consumer'].includes(top[0])) return 'value';
    return 'balanced';
  }

  private inferRiskLevel(portfolio: PortfolioHolding[]): string {
    const avgVol = portfolio.reduce((s, h) => {
      const m = h.dailyReturn.reduce((a, b) => a + b, 0) / (h.dailyReturn.length || 1);
      return s + Math.sqrt(h.dailyReturn.reduce((s2, r) => s2 + (r - m) ** 2, 0) / (h.dailyReturn.length || 1)) * Math.sqrt(252);
    }, 0) / (portfolio.length || 1);
    if (avgVol > 0.4) return 'aggressive';
    if (avgVol > 0.2) return 'balanced';
    return 'conservative';
  }
}

export default CopytradePreviewEngine;
