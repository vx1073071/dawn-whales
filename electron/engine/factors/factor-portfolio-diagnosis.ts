// ── R167 P2-07: Factor Portfolio Diagnosis Engine ─────────────────────────
// 4 diagnostic categories for multi-factor portfolios:
//   1. Correlation hazard — |ρ|>0.7 → redundant factors
//   2. Crowding exposure — concentrated positions
//   3. Style drift — portfolio shifted away from intended style
//   4. Over-exposure — single factor dominates portfolio risk
//
// Output: DiagnosisReport with actionable suggestions.

import log from 'electron-log';
import type { FactorAssetRegistry, AssetType } from './factor-asset-registry';

// ── Types ───────────────────────────────────────────────────────────────────

export type DiagnosisSeverity = 'ok' | 'info' | 'warning' | 'error';

export interface DiagnosisItem {
  id: string;
  category: 'correlation' | 'crowding' | 'style_drift' | 'over_exposure';
  severity: DiagnosisSeverity;
  title: string;
  description: string;
  suggestion: string;
  /** Affected factor IDs */
  affectedFactors: string[];
  /** Quantitative metrics */
  metrics: Record<string, number>;
}

export interface PortfolioSnapshot {
  portfolioId: string;
  factorWeights: Record<string, number>;  // factorId → weight
  assetType: AssetType;
  /** Current factor values for each holding */
  factorValues?: Record<string, number>;
  /** Intended style (for drift detection) */
  intendedStyle?: 'momentum' | 'value' | 'balanced' | 'defensive' | 'growth';
  /** Position count */
  positionCount?: number;
  /** Total exposure (sum of weights, >1 = leveraged) */
  totalExposure?: number;
  /** Benchmark factor weights (for drift comparison) */
  benchmark?: {
    factorWeights: Record<string, number>;
    name: string;
  };
}

export interface DiagnosisReport {
  portfolioId: string;
  timestamp: number;
  /** Overall health score (0-100) */
  healthScore: number;
  /** Diagnostic items (sorted by severity) */
  items: DiagnosisItem[];
  /** Counts by severity */
  summary: {
    error: number;
    warning: number;
    info: number;
    ok: number;
  };
  /** Executive summary (Chinese) */
  executiveSummary: string;
  /** Recommended actions ordered by priority */
  actionPlan: string[];
}

export interface DiagnosisConfig {
  /** Correlation threshold for redundancy warning */
  correlationRedFlag: number;
  /** Max single factor exposure as % of total */
  maxSingleFactorExposure: number;
  /** Style drift threshold: max deviation from intended weight pattern */
  styleDriftThreshold: number;
  /** Crowding score threshold */
  crowdingWarningThreshold: number;
  /** Leverage warning threshold (totalExposure > 1) */
  leverageWarning: boolean;
}

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: DiagnosisConfig = {
  correlationRedFlag: 0.7,
  maxSingleFactorExposure: 0.40,
  styleDriftThreshold: 0.30,
  crowdingWarningThreshold: 60,
  leverageWarning: true,
};

// ── Diagnosis Engine ───────────────────────────────────────────────────────

export class FactorPortfolioDiagnosisEngine {
  private config: DiagnosisConfig;

  constructor(config?: Partial<DiagnosisConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[FactorPortfolioDiagnosis] Initialized');
  }

  /**
   * Run full diagnosis on a portfolio snapshot.
   */
  diagnose(snapshot: PortfolioSnapshot): DiagnosisReport {
    const items: DiagnosisItem[] = [];

    // 1. Correlation hazard check
    items.push(...this.checkCorrelations(snapshot));

    // 2. Crowding exposure check
    items.push(...this.checkCrowding(snapshot));

    // 3. Style drift check
    items.push(...this.checkStyleDrift(snapshot));

    // 4. Over-exposure check
    items.push(...this.checkOverExposure(snapshot));

    // Sort by severity (error > warning > info > ok)
    const severityOrder = { error: 0, warning: 1, info: 2, ok: 3 };
    items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Compute health score
    const healthScore = this.computeHealthScore(items, snapshot);

    // Summary
    const summary = this.buildSummary(items);

    // Action plan
    const actionPlan = this.buildActionPlan(items, healthScore);

    return {
      portfolioId: snapshot.portfolioId,
      timestamp: Date.now(),
      healthScore,
      items,
      summary,
      executiveSummary: summary.err + summary.warn > 0
        ? `发现 ${summary.err} 个错误和 ${summary.warn} 个警告，综合健康评分 ${healthScore}/100`
        : `因子组合健康，评分为 ${healthScore}/100`,
      actionPlan,
    };
  }

  // ── 1. Correlation Hazard ─────────────────────────────────────────────────

  private checkCorrelations(snapshot: PortfolioSnapshot): DiagnosisItem[] {
    const items: DiagnosisItem[] = [];
    const factorIds = Object.keys(snapshot.factorWeights);

    // Known high-correlation pairs
    const knownPairs: Array<[string, string, number]> = [
      ['MOM_12M', 'MOM_1M', 0.45],
      ['MA_20_60', 'EMA_12_26', 0.70],
      ['HML', 'RMW', 0.35],
      ['QUAL', 'RMW', 0.40],
      ['VOL_60D', 'ATR_14', 0.55],
      ['OBV', 'CMF', 0.60],
      ['KDJ', 'RSI_14', 0.40],
      ['SIZE', 'HML', -0.20],
    ];

    const presentPairs = knownPairs.filter(([a, b]) =>
      factorIds.includes(a) && factorIds.includes(b),
    );

    for (const [a, b, corr] of presentPairs) {
      const absCorr = Math.abs(corr);
      if (absCorr >= this.config.correlationRedFlag) {
        items.push({
          id: `corr-${a}-${b}`,
          category: 'correlation',
          severity: 'error',
          title: `因子高度相关: ${a} ↔ ${b}`,
          description: `相关系数 |ρ|=${corr.toFixed(2)} ≥ ${this.config.correlationRedFlag}，存在冗余。同时持有这两个因子相当于双重押注同一信号。`,
          suggestion: `建议仅保留I{C较高的因子，或通过正交化消除共线性`,
          affectedFactors: [a, b],
          metrics: { correlation: corr, threshold: this.config.correlationRedFlag },
        });
      } else if (absCorr >= 0.5) {
        items.push({
          id: `corr-${a}-${b}`,
          category: 'correlation',
          severity: 'warning',
          title: `因子中度相关: ${a} ↔ ${b}`,
          description: `相关系数 |ρ|=${corr.toFixed(2)}，中度线性关系`,
          suggestion: `可保留但建议降低两者总权重，或使用正交化版本`,
          affectedFactors: [a, b],
          metrics: { correlation: corr, threshold: 0.5 },
        });
      }
    }

    return items;
  }

  // ── 2. Crowding Exposure ─────────────────────────────────────────────────

  private checkCrowding(snapshot: PortfolioSnapshot): DiagnosisItem[] {
    const items: DiagnosisItem[] = [];

    // Factors known to be crowding-prone
    const crowdingProneFactors: Record<string, { name: string; score: number; reason: string }> = {
      MOM_12M: { name: '12月动量', score: 55, reason: '动量因子在牛市后期通常拥挤' },
      GROWTH: { name: '成长性', score: 62, reason: '成长因子在市场乐观期超额配置显著' },
      CRYPTO_FUNDING: { name: '资金费率', score: 75, reason: '合约资金费率极高，多头拥挤' },
      SIZE: { name: '规模因子', score: 45, reason: '小盘因子在流动性宽松期资金流入增多' },
    };

    for (const [fid, info] of Object.entries(crowdingProneFactors)) {
      if (snapshot.factorWeights[fid] && snapshot.factorWeights[fid] > 0) {
        if (info.score >= 70) {
          items.push({
            id: `crowding-${fid}`,
            category: 'crowding',
            severity: 'error',
            title: `拥挤暴露: ${info.name}`,
            description: `${info.reason}（拥挤度评分 ${info.score}/100）`,
            suggestion: `建议降低${info.name}权重至当前的一半以下，等待拥挤缓解后重建`,
            affectedFactors: [fid],
            metrics: { crowdingScore: info.score, currentWeight: snapshot.factorWeights[fid] },
          });
        } else if (info.score >= 55) {
          items.push({
            id: `crowding-${fid}`,
            category: 'crowding',
            severity: 'warning',
            title: `关注拥挤: ${info.name}`,
            description: `${info.reason}（拥挤度评分 ${info.score}/100）`,
            suggestion: `密切监控拥挤指标，如分数继续上升建议逐步减仓`,
            affectedFactors: [fid],
            metrics: { crowdingScore: info.score, currentWeight: snapshot.factorWeights[fid] },
          });
        }
      }
    }

    return items;
  }

  // ── 3. Style Drift ───────────────────────────────────────────────────────

  private checkStyleDrift(snapshot: PortfolioSnapshot): DiagnosisItem[] {
    const items: DiagnosisItem[] = [];
    if (!snapshot.intendedStyle) return items;

    // Expected weight distribution per style
    const styleExpectations: Record<string, Record<string, number>> = {
      momentum: { MOM_12M: 0.30, MOM_1M: 0.15, MA_20_60: 0.15, ADX: 0.15, LIQ: 0.10, EMA_12_26: 0.10, RSI_14: 0.05 },
      value: { HML: 0.35, QUAL: 0.25, RMW: 0.15, YIELD: 0.10, SIZE: 0.10, CMA: 0.05 },
      balanced: { MOM_12M: 0.20, HML: 0.20, QUAL: 0.20, VOL_60D: 0.15, SIZE: 0.10, LIQ: 0.10, YIELD: 0.05 },
      defensive: { VOL_60D: 0.25, QUAL: 0.25, YIELD: 0.20, LIQ: 0.15, HML: 0.10, SIZE: 0.05 },
      growth: { GROWTH: 0.30, MOM_12M: 0.20, QUAL: 0.20, RMW: 0.15, LIQ: 0.10, SIZE: 0.05 },
    };

    const expectedWeights = styleExpectations[snapshot.intendedStyle] || {};

    // Compute drift: how much actual weights deviate from expected
    let driftSum = 0;
    let driftCount = 0;
    const drifts: Array<{ factorId: string; actual: number; expected: number; drift: number }> = [];

    for (const [fid, expW] of Object.entries(expectedWeights)) {
      const actualW = snapshot.factorWeights[fid] || 0;
      const drift = Math.abs(actualW - expW);
      if (drift > 0.05) {
        drifts.push({ factorId: fid, actual: actualW, expected: expW, drift });
      }
      driftSum += drift;
      driftCount++;
    }

    const avgDrift = driftCount > 0 ? driftSum / driftCount : 0;

    if (avgDrift > this.config.styleDriftThreshold * 1.5) {
      const majorDrifts = drifts.slice(0, 3).map(d =>
        `${d.factorId}(实际${(d.actual * 100).toFixed(0)}% vs 预期${(d.expected * 100).toFixed(0)}%)`
      ).join('、');

      items.push({
        id: 'style-drift',
        category: 'style_drift',
        severity: 'error',
        title: `风格漂移: 偏离${snapshot.intendedStyle}风格`,
        description: `当前因子权重与${snapshot.intendedStyle}类型预期权重平均偏差 ${(avgDrift * 100).toFixed(1)}%（阈值 ${(this.config.styleDriftThreshold * 100).toFixed(0)}%）。主要偏差: ${majorDrifts}`,
        suggestion: `建议重新平衡因子权重，使其更贴近${snapshot.intendedStyle}风格特点`,
        affectedFactors: drifts.map(d => d.factorId),
        metrics: { avgDrift, threshold: this.config.styleDriftThreshold, driftCount: drifts.length },
      });
    } else if (avgDrift > this.config.styleDriftThreshold) {
      items.push({
        id: 'style-drift',
        category: 'style_drift',
        severity: 'warning',
        title: `轻微风格漂移: 偏离${snapshot.intendedStyle}风格`,
        description: `平均偏差 ${(avgDrift * 100).toFixed(1)}%，部分因子权重偏离预期`,
        suggestion: `在下次调仓时修正偏差因子的权重`,
        affectedFactors: drifts.map(d => d.factorId),
        metrics: { avgDrift, threshold: this.config.styleDriftThreshold },
      });
    }

    return items;
  }

  // ── 4. Over-Exposure ─────────────────────────────────────────────────────

  private checkOverExposure(snapshot: PortfolioSnapshot): DiagnosisItem[] {
    const items: DiagnosisItem[] = [];
    const entries = Object.entries(snapshot.factorWeights);

    // Check single factor dominance
    const maxEntry = entries.reduce((max, curr) =>
      curr[1] > max[1] ? curr : max, ['', 0]);
    if (maxEntry[1] > this.config.maxSingleFactorExposure) {
      items.push({
        id: 'overexposure-single',
        category: 'over_exposure',
        severity: 'error',
        title: `过度暴露: ${maxEntry[0]} 权重过高`,
        description: `因子 ${maxEntry[0]} 权重 ${(maxEntry[1] * 100).toFixed(0)}% 超过上限 ${(this.config.maxSingleFactorExposure * 100).toFixed(0)}%。单一因子主导会导致策略实质上退化为单因子策略。`,
        suggestion: `降低${maxEntry[0]}权重至${(this.config.maxSingleFactorExposure * 100).toFixed(0)}%以下，将超额部分重新分配到相关性较低的因子`,
        affectedFactors: [maxEntry[0]],
        metrics: { maxWeight: maxEntry[1], limit: this.config.maxSingleFactorExposure },
      });
    }

    // Check leverage
    const totalExposure = entries.reduce((sum, [, w]) => sum + w, 0);
    if (this.config.leverageWarning && totalExposure > 1.05) {
      items.push({
        id: 'overexposure-leverage',
        category: 'over_exposure',
        severity: 'warning',
        title: '组合杠杆: 总暴露 > 1',
        description: `总因子暴露 ${totalExposure.toFixed(2)} 超过1.0，存在杠杆效应`,
        suggestion: '将总权重归一化至1.0，或确保风险预算允许杠杆',
        affectedFactors: [],
        metrics: { totalExposure, limit: 1.0 },
      });
    }

    // Check category concentration (same-category factors dominate)
    const categoryGroups: Record<string, number> = {};
    const categories: Record<string, string> = {
      MOM_12M: 'momentum', MOM_1M: 'momentum', RSI_14: 'momentum', KDJ: 'momentum',
      HML: 'value', SIZE: 'value', YIELD: 'value',
      QUAL: 'quality', RMW: 'quality', CMA: 'quality', GROWTH: 'quality',
      VOL_60D: 'volatility', ATR_14: 'volatility', BOLL: 'volatility',
      MA_20_60: 'trend', EMA_12_26: 'trend', ADX: 'trend', ICHIMOKU: 'trend',
    };
    for (const [fid, w] of entries) {
      const cat = categories[fid] || 'other';
      categoryGroups[cat] = (categoryGroups[cat] || 0) + w;
    }
    const maxCat = Object.entries(categoryGroups).reduce((m, c) => c[1] > m[1] ? c : m, ['', 0]);
    if (maxCat[1] > 0.50) {
      items.push({
        id: 'overexposure-category',
        category: 'over_exposure',
        severity: 'warning',
        title: `类别集中: ${maxCat[0]} 类占比过高`,
        description: `${maxCat[0]}类别因子占总权重 ${(maxCat[1] * 100).toFixed(0)}%，超过50%`,
        suggestion: '建议增加其他类别因子以分散风险',
        affectedFactors: entries.filter(([fid]) => (categories[fid] || 'other') === maxCat[0]).map(([fid]) => fid),
        metrics: { categoryWeight: maxCat[1], limit: 0.50 },
      });
    }

    return items;
  }

  // ── Scoring & Summary ────────────────────────────────────────────────────

  private computeHealthScore(items: DiagnosisItem[], _snapshot: PortfolioSnapshot): number {
    let score = 100;
    for (const item of items) {
      if (item.severity === 'error') score -= 15;
      else if (item.severity === 'warning') score -= 8;
      else if (item.severity === 'info') score -= 3;
    }
    return Math.max(0, score);
  }

  private buildSummary(items: DiagnosisItem[]) {
    return {
      error: items.filter(i => i.severity === 'error').length,
      warning: items.filter(i => i.severity === 'warning').length,
      info: items.filter(i => i.severity === 'info').length,
      ok: items.filter(i => i.severity === 'ok').length,
    };
  }

  private buildActionPlan(items: DiagnosisItem[], healthScore: number): string[] {
    const plan: string[] = [];

    // Errors first
    for (const item of items.filter(i => i.severity === 'error')) {
      plan.push(`[紧急] ${item.title}: ${item.suggestion}`);
    }
    for (const item of items.filter(i => i.severity === 'warning')) {
      plan.push(`[建议] ${item.title}: ${item.suggestion}`);
    }

    if (healthScore >= 80) plan.push('[状态] 组合健康，当前配置可持续运行');
    else if (healthScore >= 60) plan.push('[状态] 组合需小幅调整，优先处理上述建议项');
    else plan.push('[状态] 组合需大幅重构，不建议直接实盘运行');

    return plan;
  }

  reset(): void { log.info('[FactorPortfolioDiagnosis] Reset'); }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createFactorPortfolioDiagnosisEngine(c?: Partial<DiagnosisConfig>): FactorPortfolioDiagnosisEngine {
  return new FactorPortfolioDiagnosisEngine(c);
}

let _diag: FactorPortfolioDiagnosisEngine | null = null;
export function getFactorPortfolioDiagnosisEngine(): FactorPortfolioDiagnosisEngine {
  if (!_diag) _diag = new FactorPortfolioDiagnosisEngine();
  return _diag;
}
export function resetFactorPortfolioDiagnosisEngine(): void { _diag?.reset(); _diag = null; }
