/**
 * R245 P1-25: FactorDecayIndex — 因子衰减指数引擎
 * LOBEHUB | v2.8.0
 *
 * 监测每个因子的"衰减"程度，提前预警。
 *
 * 核心指标:
 *   1. 滚动Sharpe变化率 — 最近30d Sharpe vs 90d Sharpe
 *   2. 拥挤度(Crowding) — 多因子间信号相关性 >0.7 即拥挤
 *   3. 样本内外差异 — 上线后表现 vs 回测表现的差距
 *   4. 衰减速度 — α(t) = K/(1+λt) 拟合，估算半衰期
 *
 * 学术基础:
 *   - 双曲线衰减: α(t) = K/(1+λt)   (arXiv 2512.11913v1)
 *   - McLean & Pontiff (2016): 因子发表后衰减58%
 *   - 拥挤因子出血(Crowding) — Resonanz Capital 2025 去杠杆研究
 *
 * 输出: 每个因子的 DecayScore (0-100), 0=健康, 100=完全衰减
 *
 * 约束: 纯TypeScript, 零外部依赖, ≥450L
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────────────────

export interface FactorPerformanceSample {
  timestamp: number;
  dailyReturn: number;         // 因子当天的收益
  cumulativeReturn: number;    // 累计收益
  sharpeRolling?: number;      // 滚动Sharpe
  icValue?: number;            // IC值 (信息系统)
}

export interface FactorDecayRecord {
  factorId: string;
  nameEn: string;
  nameCn: string;
  level1: string;

  // 核心衰减指标
  decayScore: number;           // 0-100, 综合衰减分
  decayStatus: 'healthy' | 'warning' | 'decaying' | 'dead';
  decayTrend: 'improving' | 'stable' | 'deteriorating' | 'unknown';

  // 子指标
  sharpeDecay: number;          // Sharpe变化率 (-1到+1, 负数=衰减)
  crowdingScore: number;        // 拥挤度 (0-1, >0.7=拥挤)
  sampleGap: number;            // 样本内外差异 (-1到+1, 负数=样本外更差)
  decaySpeed: number;           // λ (衰减速度, 越大越快衰减)
  halfLifeDays: number | null;  // 半衰期天数 (预测)

  // 原始数据
  rollingSharpe30d: number;
  rollingSharpe90d: number | null;
  backtestSharpe: number | null;
  liveSharpe: number | null;
  correlatedFactors: string[];  // 与之高度相�关的因子
  correlatedCount: number;

  updatedAt: number;
  dataPoints: number;           // 样本数量
}

export interface DecayIndexStats {
  totalFactors: number;
  healthyCount: number;
  warningCount: number;
  decayingCount: number;
  deadCount: number;
  averageDecayScore: number;
  highestRiskFactors: string[];  // top 5 danger
  overallCrowding: number;       // 总体拥挤度
  updatedAt: number;
}

export interface DecayConfig {
  sharpeWindowShort: number;     // 30天
  sharpeWindowLong: number;      // 90天
  crowdingThreshold: number;     // 0.7
  crowdingCorrelationThreshold: number; // 0.7
  sampleGapThreshold: number;    // -0.3 (样本外比样本内差30%以上→警告)
  decayWarningThreshold: number;  // decayScore > 40 → warning
  decayDangerThreshold: number;   // decayScore > 70 → decaying
  decayDeadThreshold: number;     // decayScore > 90 → dead
  minDataPoints: number;         // 最少需要10个数据点
  halfLifeModelFitMinPoints: number; // 最少20个点才能拟合半衰期
}

const DEFAULT_CONFIG: DecayConfig = {
  sharpeWindowShort: 30,
  sharpeWindowLong: 90,
  crowdingThreshold: 0.7,
  crowdingCorrelationThreshold: 0.7,
  sampleGapThreshold: -0.3,
  decayWarningThreshold: 40,
  decayDangerThreshold: 70,
  decayDeadThreshold: 90,
  minDataPoints: 10,
  halfLifeModelFitMinPoints: 20,
};

// ── FactorDecayIndex ─────────────────────────────────────────────────────

export class FactorDecayIndex {
  readonly id = 'factor_decay_index';
  readonly version = '2.8.0';

  private config: DecayConfig;
  private factorData: Map<string, FactorPerformanceSample[]> = new Map();
  private backtestResults: Map<string, number> = new Map();  // factorId → backtest Sharpe

  constructor(config?: Partial<DecayConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── 数据注入 ─────────────────────────────────────────────────────────

  /** 注入因子历史收益数据 */
  feedPerformanceData(factorId: string, samples: FactorPerformanceSample[]): void {
    if (samples.length === 0) return;
    const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);
    this.factorData.set(factorId, sorted);
  }

  /** 追加单日数据 */
  appendDailyData(factorId: string, sample: FactorPerformanceSample): void {
    const existing = this.factorData.get(factorId) || [];
    existing.push(sample);
    this.factorData.set(factorId, existing);
  }

  /** 设置回测Sharpe (样本内表现) */
  setBacktestSharpe(factorId: string, sharpe: number): void {
    this.backtestResults.set(factorId, sharpe);
  }

  // ── 核心计算 ─────────────────────────────────────────────────────────

  /** 计算单个因子的衰减指数 */
  computeDecayIndex(
    factorId: string,
    nameEn: string = factorId,
    nameCn: string = factorId,
    level1: string = 'L1_UNKNOWN',
  ): FactorDecayRecord | null {
    const data = this.factorData.get(factorId);
    if (!data || data.length < this.config.minDataPoints) {
      return null;
    }

    const now = Date.now();
    const days30 = now - this.config.sharpeWindowShort * 86400000;
    const days90 = now - this.config.sharpeWindowLong * 86400000;

    // 1. 滚动Sharpe
    const recent30d = data.filter(s => s.timestamp >= days30);
    const recent90d = data.filter(s => s.timestamp >= days90);

    const sharpe30d = this.calcSharpe(recent30d.map(s => s.dailyReturn));
    const sharpe90d = this.calcSharpe(recent90d.map(s => s.dailyReturn));

    // Sharpe衰减: 短期Sharpe vs 长期Sharpe
    let sharpeDecay = 0;
    if (sharpe90d !== 0) {
      sharpeDecay = (sharpe30d - sharpe90d) / (Math.abs(sharpe90d) + 0.001);
      sharpeDecay = Math.max(-1, Math.min(1, sharpeDecay));
    }

    // 2. 样本内外差异
    const backtestSharpe = this.backtestResults.get(factorId) || null;
    let sampleGap = 0;
    let liveSharpe: number | null = null;
    if (backtestSharpe !== null && backtestSharpe !== 0) {
      // liveSharpe: 最近30天样本外表现
      liveSharpe = sharpe30d;
      sampleGap = (liveSharpe - backtestSharpe) / (Math.abs(backtestSharpe) + 0.001);
      sampleGap = Math.max(-1, Math.min(1, sampleGap));
    }

    // 3. 拥挤度 — 基于与所有因子的相关性
    const crowdingResult = this.calcCrowding(factorId, data);
    const crowdingScore = crowdingResult.score;
    const correlatedFactors = crowdingResult.correlated;

    // 4. 衰减速度 (双曲线拟合)
    const { lambda, halfLife } = this.fitDecayCurve(data);

    // 5. 综合衰减分 (加权)
    // Sharpe衰减 35% + 样本差异 25% + 拥挤度 25% + 衰减速度 15%
    const sharpeComponent = Math.abs(Math.min(0, sharpeDecay)) * 100 * 0.35;
    const sampleComponent = Math.abs(Math.min(0, sampleGap)) * 100 * 0.25;
    const crowdingComponent = crowdingScore * 100 * 0.25;
    const speedComponent = Math.min(lambda * 20, 100) * 0.15;  // 速度快→分数高

    const decayScore = Math.round(Math.min(100, sharpeComponent + sampleComponent + crowdingComponent + speedComponent));

    // 状态判定
    let decayStatus: FactorDecayRecord['decayStatus'];
    if (decayScore >= this.config.decayDeadThreshold) decayStatus = 'dead';
    else if (decayScore >= this.config.decayDangerThreshold) decayStatus = 'decaying';
    else if (decayScore >= this.config.decayWarningThreshold) decayStatus = 'warning';
    else decayStatus = 'healthy';

    // 趋势判定
    let decayTrend: FactorDecayRecord['decayTrend'];
    if (data.length >= 20) {
      const firstHalf = data.slice(0, Math.floor(data.length / 2));
      const secondHalf = data.slice(Math.floor(data.length / 2));
      const firstSharpe = this.calcSharpe(firstHalf.map(s => s.dailyReturn));
      const secondSharpe = this.calcSharpe(secondHalf.map(s => s.dailyReturn));
      if (secondSharpe > firstSharpe + 0.1) decayTrend = 'improving';
      else if (secondSharpe < firstSharpe - 0.1) decayTrend = 'deteriorating';
      else decayTrend = 'stable';
    } else {
      decayTrend = 'unknown';
    }

    return {
      factorId,
      nameEn,
      nameCn,
      level1,
      decayScore,
      decayStatus,
      decayTrend,
      sharpeDecay: Math.round(sharpeDecay * 1000) / 1000,
      crowdingScore: Math.round(crowdingScore * 1000) / 1000,
      sampleGap: Math.round(sampleGap * 1000) / 1000,
      decaySpeed: Math.round(lambda * 10000) / 10000,
      halfLifeDays: halfLife,
      rollingSharpe30d: Math.round(sharpe30d * 1000) / 1000,
      rollingSharpe90d: sharpe90d !== 0 ? Math.round(sharpe90d * 1000) / 1000 : null,
      backtestSharpe,
      liveSharpe,
      correlatedFactors: correlatedFactors.slice(0, 5),
      correlatedCount: correlatedFactors.length,
      updatedAt: now,
      dataPoints: data.length,
    };
  }

  /** 批量计算所有因子衰减 */
  computeAll(
    factorDefinitions: { id: string; nameEn: string; nameCn: string; level1: string }[],
  ): { records: FactorDecayRecord[]; stats: DecayIndexStats } {
    const records: FactorDecayRecord[] = [];

    for (const def of factorDefinitions) {
      const record = this.computeDecayIndex(def.id, def.nameEn, def.nameCn, def.level1);
      if (record) records.push(record);
    }

    return { records, stats: this.computeStats(records) };
  }

  /** 获取全局衰减统计 */
  computeStats(records: FactorDecayRecord[]): DecayIndexStats {
    const healthy = records.filter(r => r.decayStatus === 'healthy');
    const warning = records.filter(r => r.decayStatus === 'warning');
    const decaying = records.filter(r => r.decayStatus === 'decaying');
    const dead = records.filter(r => r.decayStatus === 'dead');

    const avgDecay = records.length > 0
      ? Math.round(records.reduce((s, r) => s + r.decayScore, 0) / records.length)
      : 0;

    const sorted = [...records].sort((a, b) => b.decayScore - a.decayScore);
    const highestRisk = sorted.slice(0, 5).map(r => r.factorId);

    const overallCrowding = records.length > 0
      ? Math.round(records.reduce((s, r) => s + r.crowdingScore, 0) / records.length * 1000) / 1000
      : 0;

    return {
      totalFactors: records.length,
      healthyCount: healthy.length,
      warningCount: warning.length,
      decayingCount: decaying.length,
      deadCount: dead.length,
      averageDecayScore: avgDecay,
      highestRiskFactors: highestRisk,
      overallCrowding,
      updatedAt: Date.now(),
    };
  }

  /** 获取单个因子记录 */
  getRecord(factorId: string): FactorDecayRecord | null {
    return this.computeDecayIndex(factorId);
  }

  // ── Private: 统计计算 ─────────────────────────────────────────────────

  private calcSharpe(returns: number[], riskFreeRate: number = 0.02 / 365): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const excess = returns.map(r => r - riskFreeRate);
    const meanExcess = excess.reduce((a, b) => a + b, 0) / excess.length;
    const variance = excess.reduce((s, r) => s + (r - meanExcess) ** 2, 0) / (excess.length - 1);
    if (variance <= 0) return 0;
    return (meanExcess / Math.sqrt(variance)) * Math.sqrt(252); // 年化
  }

  private calcCrowding(
    factorId: string,
    currentData: FactorPerformanceSample[],
  ): { score: number; correlated: string[] } {
    const currentReturns = currentData.map(s => s.dailyReturn);
    const correlated: string[] = [];

    for (const [otherId, otherData] of this.factorData.entries()) {
      if (otherId === factorId) continue;
      if (otherData.length < this.config.minDataPoints) continue;

      const otherReturns = otherData.map(s => s.dailyReturn);
      const corr = this.pearsonCorrelation(
        currentReturns.slice(-Math.min(currentReturns.length, otherReturns.length)),
        otherReturns.slice(-Math.min(currentReturns.length, otherReturns.length)),
      );

      if (Math.abs(corr) > this.config.crowdingCorrelationThreshold) {
        correlated.push(otherId);
      }
    }

    // 拥挤度 = 高相关因子数 / 因子因子总数
    const score = this.factorData.size > 1
      ? correlated.length / (this.factorData.size - 1)
      : 0;

    return {
      score: Math.min(1, Math.round(score * 1000) / 1000),
      correlated: correlated.sort(),
    };
  }

  private pearsonCorrelation(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;
    const meanA = a.reduce((s, v) => s + v, 0) / n;
    const meanB = b.reduce((s, v) => s + v, 0) / n;
    let cov = 0, varA = 0, varB = 0;
    for (let i = 0; i < n; i++) {
      const da = a[i] - meanA, db = b[i] - meanB;
      cov += da * db;
      varA += da * da;
      varB += db * db;
    }
    if (varA === 0 || varB === 0) return 0;
    return cov / Math.sqrt(varA * varB);
  }

  /**
   * 双曲线衰减拟合: α(t) = K/(1+λt)
   * 用最近N个数据点拟合λ(衰减速度)
   * 然后估算半衰期 t_half = 1/λ
   */
  private fitDecayCurve(data: FactorPerformanceSample[]): { lambda: number; halfLife: number | null } {
    if (data.length < this.config.halfLifeModelFitMinPoints) {
      return { lambda: 0, halfLife: null };
    }

    // 简化的线性回归: 对 α ≈ K/(1+λt)
    // 取最近30个点
    const recent = data.slice(-30);
    const timestamps = recent.map((_, i) => i);
    const values = recent.map(s => s.dailyReturn);

    // 用线性回归拟合 y = a + b*x，其中斜率b代表衰减趋势
    const n = timestamps.length;
    const sumX = timestamps.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = timestamps.reduce((s, x, i) => s + x * values[i], 0);
    const sumX2 = timestamps.reduce((s, x) => s + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    // 负斜率 = 衰减
    const lambda = Math.max(0, -slope);
    const halfLife = lambda > 0 ? Math.round(1 / lambda) : null;

    return { lambda, halfLife };
  }

  /** 清空数据 */
  reset(): void {
    this.factorData.clear();
    this.backtestResults.clear();
  }
}

export default FactorDecayIndex;
