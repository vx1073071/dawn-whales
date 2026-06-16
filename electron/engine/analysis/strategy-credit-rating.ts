/**
 * R246 P1-26: StrategyCreditRating — 策略信用评级引擎
 * LOBEHUB | v2.8.0
 *
 * 对标债券评级，为124个策略模板构建五维信用评级体系。
 * 评级: A (稳健) / B (良好) / C (一般) / D (高风险)
 *
 * 五维:
 *   1. 稳健性 (30%): 回测长度+样本外验证+多周期测试
 *   2. 衰减风险 (25%): 滚动Sharpe趋势+信号拥挤度
 *   3. 透明度 (20%): 策略逻辑可解释性+实时交易记录
 *   4. 风控 (15%): 最大回撤控制+止损机制
 *   5. 创作者信誉 (10%): 历史策略存活率+用户评价一致性
 *
 * 学术基础:
 *   - McLean & Pontiff (2016): 已发表策略衰减58%
 *   - Resonanz Capital (2025): 拥挤因子出血五原类型
 *   - 电商市场信任信号研究: 关键决策点需多重信号
 *
 * 约束: 纯TypeScript, 零外部依赖, ≥450L
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────────────────

export type CreditRating = 'A' | 'B' | 'C' | 'D';
export type RatingDimension = 'stability' | 'decayResistance' | 'transparency' | 'riskControl' | 'creatorReputation';

export interface CreditRatingInput {
  templateId: string;
  templateName: string;
  templateNameCn: string;
  category: string;
  market: string;

  // 维度1: 稳健性
  backtestMonths: number;           // 回测月数
  sampleOutValidation: boolean;     // 是否有样本外验证
  multiMarketTested: boolean;       // 是否多市场测试
  multiCycleTested: boolean;        // 是否多周期测试 (牛熊震荡)

  // 维度2: 衰减风险
  rollingSharpe3m: number | null;   // 最近3月Sharpe
  rollingSharpe12m: number | null;  // 12月Sharpe
  signalCrowdingScore: number;      // 0-1, 拥挤度

  // 维度3: 透明度
  strategyLogicPublic: boolean;     // 策略逻辑是否公开
  realTimeTradesPublic: boolean;    // 实时交易记录是否可见
  hasHumanReadableDesc: boolean;    // 是否有人话描述

  // 维度4: 风控
  maxDrawdownRatio: number;         // 最大回撤率 (0-1)
  hasStopLoss: boolean;             // 是否有止损
  hasPositionLimit: boolean;        // 是否有仓位限制
  marginUsed: number;               // 保证金使用率 (0-1)

  // 维度5: 创作者信誉
  creatorLevel: 'L1' | 'L2' | 'L3';   // 创作者等级
  strategySurvivalRate: number;     // 0-1, 历史策略存活率
  userRatingAvg: number;            // 1-5, 用户评分均值
  userRatingCount: number;          // 评价数量
}

export interface CreditRatingResult {
  templateId: string;
  templateName: string;
  templateNameCn: string;
  category: string;
  market: string;

  // 总评级
  rating: CreditRating;
  totalScore: number;            // 0-100

  // 各维度得分
  dimensions: {
    stability: { score: number; weight: number; };
    decayResistance: { score: number; weight: number; };
    transparency: { score: number; weight: number; };
    riskControl: { score: number; weight: number; };
    creatorReputation: { score: number; weight: number; };
  };

  // 解读
  summary: string;              // 一句话评价
  strengths: string[];          // 优势
  weaknesses: string[];         // 劣势
  suggestion: string;           // 改进建议

  // 详情
  backtestQuality: string;      // "192个月/牛熊/4市场"
  decayTrend: string;           // "Sharpe下降12%/轻度拥挤"
  riskLevel: string;            // "最大回撤18%/有止损"
  transparencyLevel: string;    // "公开/实时/人话完整"

  ratedAt: number;
}

export interface RatingStats {
  totalRated: number;
  distribution: Record<CreditRating, number>;
  averageScore: number;
  topRated: { id: string; name: string; score: number; rating: CreditRating }[];
  belowThreshold: { id: string; name: string; score: number; rating: CreditRating }[];
}

export interface RatingConfig {
  scoreThresholds: Record<CreditRating, number>;  // A≥80, B≥60, C≥40, D<40
  weights: Record<RatingDimension, number>;        // 维度权重
  minBacktestMonths: number;                       // 最少12个月回测
}

const DEFAULT_CONFIG: RatingConfig = {
  scoreThresholds: { A: 80, B: 60, C: 40, D: 0 },
  weights: {
    stability: 0.30,
    decayResistance: 0.25,
    transparency: 0.20,
    riskControl: 0.15,
    creatorReputation: 0.10,
  },
  minBacktestMonths: 12,
};

// ── StrategyCreditRatingEngine ───────────────────────────────────────────

export class StrategyCreditRatingEngine {
  readonly id = 'strategy_credit_rating';
  readonly version = '2.8.0';

  private config: RatingConfig;
  private results: Map<string, CreditRatingResult> = new Map();

  constructor(config?: Partial<RatingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── 计算 ───────────────────────────────────────────────────────────────

  rate(input: CreditRatingInput): CreditRatingResult {
    const scores = {
      stability: this.calcStability(input),
      decayResistance: this.calcDecayResistance(input),
      transparency: this.calcTransparency(input),
      riskControl: this.calcRiskControl(input),
      creatorReputation: this.calcCreatorReputation(input),
    };

    // 加权总分
    const totalScore = Math.round(
      scores.stability * this.config.weights.stability * 100 +
      scores.decayResistance * this.config.weights.decayResistance * 100 +
      scores.transparency * this.config.weights.transparency * 100 +
      scores.riskControl * this.config.weights.riskControl * 100 +
      scores.creatorReputation * this.config.weights.creatorReputation * 100
    );

    // 评级映射
    let rating: CreditRating = 'D';
    if (totalScore >= this.config.scoreThresholds.A) rating = 'A';
    else if (totalScore >= this.config.scoreThresholds.B) rating = 'B';
    else if (totalScore >= this.config.scoreThresholds.C) rating = 'C';

    // 解读
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (scores.stability >= 0.8) strengths.push('长期回测+多市场验证');
    else if (scores.stability < 0.5) weaknesses.push('回测不足/单市场');
    if (scores.decayResistance >= 0.8) strengths.push('衰减控制好');
    else if (scores.decayResistance < 0.5) weaknesses.push('衰减风险高/拥挤');
    if (scores.transparency >= 0.8) strengths.push('高度透明');
    else if (scores.transparency < 0.4) weaknesses.push('信息不透明');
    if (scores.riskControl >= 0.8) strengths.push('风控完善');
    else if (scores.riskControl < 0.5) weaknesses.push('风控不足');
    if (scores.creatorReputation >= 0.8) strengths.push('高信誉创作者');
    else if (scores.creatorReputation < 0.4) weaknesses.push('创作者信誉不足');

    const summary = rating === 'A' ? '稳健策略，适合长期配置'
      : rating === 'B' ? '良好策略，注意风控'
      : rating === 'C' ? '一般策略，建议改进或短期使用'
      : '高风险策略，谨慎使用';

    const result: CreditRatingResult = {
      templateId: input.templateId,
      templateName: input.templateName,
      templateNameCn: input.templateNameCn,
      category: input.category,
      market: input.market,
      rating,
      totalScore,
      dimensions: {
        stability: { score: Math.round(scores.stability * 100), weight: this.config.weights.stability },
        decayResistance: { score: Math.round(scores.decayResistance * 100), weight: this.config.weights.decayResistance },
        transparency: { score: Math.round(scores.transparency * 100), weight: this.config.weights.transparency },
        riskControl: { score: Math.round(scores.riskControl * 100), weight: this.config.weights.riskControl },
        creatorReputation: { score: Math.round(scores.creatorReputation * 100), weight: this.config.weights.creatorReputation },
      },
      summary,
      strengths,
      weaknesses,
      suggestion: this.generateSuggestion(rating, weaknesses),
      backtestQuality: `${(input.backtestMonths / 12).toFixed(1)}年/${input.multiCycleTested ? '多周期' : '单周期'}/${input.multiMarketTested ? '多市场' : '单市场'}`,
      decayTrend: input.rollingSharpe12m && input.rollingSharpe3m
        ? `Sharpe ${input.rollingSharpe3m > input.rollingSharpe12m ? '↑' : '↓'}${Math.abs(input.rollingSharpe3m - input.rollingSharpe12m).toFixed(2)}/拥挤${(input.signalCrowdingScore * 100).toFixed(0)}%`
        : '数据不足',
      riskLevel: `最大回撤${(input.maxDrawdownRatio * 100).toFixed(0)}%/${input.hasStopLoss ? '有止损' : '无止损'}/${input.marginUsed > 0.5 ? '高杠杆' : '适中杠杆'}`,
      transparencyLevel: `${input.strategyLogicPublic ? '公开' : '私密'}/${input.realTimeTradesPublic ? '实时' : '不公开'}/${input.hasHumanReadableDesc ? '人话' : '无人话'}`,
      ratedAt: Date.now(),
    };

    this.results.set(input.templateId, result);
    return result;
  }

  /** 批量评级 */
  rateAll(inputs: CreditRatingInput[]): { results: CreditRatingResult[]; stats: RatingStats } {
    const results = inputs.map(i => this.rate(i));

    const distribution: Record<CreditRating, number> = { A: 0, B: 0, C: 0, D: 0 };
    results.forEach(r => distribution[r.rating]++);

    const avgScore = Math.round(results.reduce((s, r) => s + r.totalScore, 0) / (results.length || 1));
    const sorted = [...results].sort((a, b) => b.totalScore - a.totalScore);

    return {
      results,
      stats: {
        totalRated: results.length,
        distribution,
        averageScore: avgScore,
        topRated: sorted.slice(0, 5).map(r => ({ id: r.templateId, name: r.templateName, score: r.totalScore, rating: r.rating })),
        belowThreshold: sorted.filter(r => r.rating === 'D').slice(0, 5).map(r => ({ id: r.templateId, name: r.templateName, score: r.totalScore, rating: r.rating })),
      },
    };
  }

  getResult(templateId: string): CreditRatingResult | null {
    return this.results.get(templateId) || null;
  }

  getAllResults(): CreditRatingResult[] {
    return [...this.results.values()];
  }

  // ── Private 评分函数 ───────────────────────────────────────────────────

  private calcStability(input: CreditRatingInput): number {
    let score = 0;

    // 回测长度 (最大48个月，满分50分)
    const backtestScore = Math.min(input.backtestMonths / 48, 1) * 50;
    score += backtestScore;

    // 样本外验证 (25分)
    if (input.sampleOutValidation) score += 25;

    // 多市场 (15分)
    if (input.multiMarketTested) score += 15;

    // 多周期 (10分)
    if (input.multiCycleTested) score += 10;

    return score / 100;
  }

  private calcDecayResistance(input: CreditRatingInput): number {
    let score = 0;

    // Sharpe趋势 (50分) — 上升加分，下降减分
    if (input.rollingSharpe12m !== null && input.rollingSharpe3m !== null) {
      const decay = (input.rollingSharpe3m - input.rollingSharpe12m) / (Math.abs(input.rollingSharpe12m) + 0.001);
      score += Math.max(0, 25 + decay * 25); // 中间值
    } else {
      score += 25; // 无数据，给中间分
    }

    // 拥挤度 (50分) — 低拥挤加分
    score += (1 - input.signalCrowdingScore) * 50;

    return score / 100;
  }

  private calcTransparency(input: CreditRatingInput): number {
    let score = 0;

    // 公开策略逻辑 (40分)
    if (input.strategyLogicPublic) score += 40;

    // 实时交易记录 (35分)
    if (input.realTimeTradesPublic) score += 35;

    // 人话描述 (25分)
    if (input.hasHumanReadableDesc) score += 25;

    return score / 100;
  }

  private calcRiskControl(input: CreditRatingInput): number {
    let score = 0;

    // 回撤控制 (40分) — 回撤越低分越高
    score += (1 - input.maxDrawdownRatio) * 40;

    // 有止损 (30分)
    if (input.hasStopLoss) score += 30;

    // 有仓位限制 (20分)
    if (input.hasPositionLimit) score += 20;

    // 保证金控制 (10分)
    if (input.marginUsed < 1) score += (1 - input.marginUsed) * 10;

    return score / 100;
  }

  private calcCreatorReputation(input: CreditRatingInput): number {
    let score = 0;

    // 创作者等级 (35分)
    const levelScore: Record<string, number> = { L1: 10, L2: 25, L3: 35 };
    score += levelScore[input.creatorLevel] || 0;

    // 策略存活率 (35分)
    score += input.strategySurvivalRate * 35;

    // 用户评分 (30分) — 加权重以鼓励更多评价
    const ratingWeight = Math.min(input.userRatingCount / 50, 1);  // 50条评价=满分权重
    score += (input.userRatingAvg / 5) * 30 * ratingWeight;

    return score / 100;
  }

  private generateSuggestion(rating: CreditRating, weaknesses: string[]): string {
    if (rating === 'A') return '保持优质，可考虑上首页推荐位';
    if (weaknesses.includes('回测不足/单市场')) return '补足6个月以上多市场回测';
    if (weaknesses.includes('衰减风险高/拥挤')) return '减少热门因子权重，引入反拥挤约束';
    if (weaknesses.includes('信息不透明')) return '公开策略逻辑和实时交易记录';
    if (weaknesses.includes('风控不足')) return '添加止损线和仓位限制';
    return '补齐基础后再申请重评';
  }
}

export default StrategyCreditRatingEngine;
