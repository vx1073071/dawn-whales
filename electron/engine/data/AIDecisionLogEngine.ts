/**
 * AIDecisionLogEngine — R264 Claw(PM) P1-03
 * 
 * "为什么推荐这个" — AI推荐透明化引擎。
 * 每次AI推荐附带思考链：触发因子×权重×得分 + 关键证据 + 不确定性标注。
 * 
 * 铁律合规：免费功能，不收费。这是AI推荐的透明度保证。
 */
import { EventEmitter } from 'events';

// ── Types ──
export interface FactorScore {
  factorId: string;
  factorName: string;
  weight: number;        // 0-1, 总权重=1
  score: number;         // 0-10
  signal: 'bull' | 'bear' | 'neutral';
  evidence: string;      // 一句话证据
}

export interface DecisionLog {
  logId: string;
  symbol: string;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  overallScore: number;  // 0-10
  factors: FactorScore[];
  keyEvidence: string[];         // 关键证据 (≤3条)
  uncertaintyLabel: string;      // 不确定性描述
  confidencePercent: number;     // 55-95%
  worstCase: string;             // 最坏情况
  counterView: string;           // 反面观点 (为什么不更看多/空)
  timestamp: number;
}

export type ScoreRange = 'excellent' | 'good' | 'neutral' | 'poor' | 'terrible';

// ── Templates ──
const RANGE_LABEL: Record<ScoreRange, { cn: string; emoji: string }> = {
  excellent:    { cn: '强烈看多', emoji: '🟢🟢' },
  good:         { cn: '看多',     emoji: '🟢' },
  neutral:      { cn: '中性',     emoji: '🟡' },
  poor:         { cn: '看空',     emoji: '🟠' },
  terrible:     { cn: '强烈看空', emoji: '🔴' },
};

function getRange(score: number): ScoreRange {
  if (score >= 9) return 'excellent';
  if (score >= 7) return 'good';
  if (score >= 5) return 'neutral';
  if (score >= 3) return 'poor';
  return 'terrible';
}

// ── Engine ──
export class AIDecisionLogEngine extends EventEmitter {
  private static instance: AIDecisionLogEngine;
  private logs: DecisionLog[] = [];
  private logSeq = 0;

  private constructor() { super(); }

  static getInstance(): AIDecisionLogEngine {
    if (!this.instance) this.instance = new AIDecisionLogEngine();
    return this.instance;
  }

  reset(): void {
    this.logs = [];
    this.logSeq = 0;
    this.removeAllListeners();
  }

  /**
   * 生成AI决策日志
   * @param symbol 股票代码
   * @param factors 因子得分列表
   * @param externalContext 外部上下文（财报/新闻/宏观）
   */
  generateLog(
    symbol: string,
    factors: FactorScore[],
    externalContext?: { earningsNear?: boolean; macroHeadwind?: boolean; sectorStrength?: 'strong' | 'weak' | 'neutral' }
  ): DecisionLog {
    if (factors.length === 0) {
      return this.emptyLog(symbol);
    }

    // 计算加权得分
    const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
    const normalizedFactors = factors.map(f => ({
      ...f,
      weight: totalWeight > 0 ? f.weight / totalWeight : 1 / factors.length,
    }));

    const overallScore = normalizedFactors.reduce((s, f) => s + f.weight * f.score, 0);
    const range = getRange(overallScore);
    const label = RANGE_LABEL[range];

    // 推荐
    let recommendation: DecisionLog['recommendation'] = 'hold';
    if (range === 'excellent') recommendation = 'strong_buy';
    else if (range === 'good') recommendation = 'buy';
    else if (range === 'poor') recommendation = 'sell';
    else if (range === 'terrible') recommendation = 'strong_sell';

    // 关键证据 (得分最高/最低的3个因子)
    const sorted = [...normalizedFactors].sort((a, b) => b.score - a.score);
    const keyEvidence = sorted.slice(0, 3).map(f => `${f.factorName}(${f.score.toFixed(1)}分): ${f.evidence}`);

    // 置信度
    const signalConsistency = sorted.filter(f => f.signal === (range.includes('多') ? 'bull' : 'bear')).length;
    let confidencePercent = 65;
    if (signalConsistency >= normalizedFactors.length * 0.8) confidencePercent = 85;
    else if (signalConsistency >= normalizedFactors.length * 0.6) confidencePercent = 75;
    if (externalContext?.earningsNear) confidencePercent -= 10;
    confidencePercent = Math.max(55, Math.min(95, confidencePercent));

    // 不确定性
    let uncertaintyLabel = `置信度${confidencePercent}%`;
    if (externalContext?.earningsNear) uncertaintyLabel += '。财报临近，不确定性增加。';
    if (signalConsistency < normalizedFactors.length * 0.5) uncertaintyLabel += '。信号混杂，多个因子指向不同方向。';

    // 最坏情况
    const bearishFactors = normalizedFactors.filter(f => f.signal === 'bear');
    const worstCase = bearishFactors.length > 0
      ? `若${bearishFactors.map(f => f.factorName).join('、')}持续恶化，建议观望`
      : '暂无显著下行风险';

    // 反面观点
    const counterSignals = normalizedFactors.filter(f =>
      (recommendation.includes('buy') && f.signal === 'bear') ||
      (recommendation.includes('sell') && f.signal === 'bull')
    );
    const counterView = counterSignals.length > 0
      ? `${counterSignals.map(f => f.factorName).join('、')}方向相反：${counterSignals[0].evidence}`
      : '全部因子方向一致';

    const log: DecisionLog = {
      logId: `DL-${++this.logSeq}`,
      symbol,
      recommendation,
      overallScore: Number(overallScore.toFixed(1)),
      factors: normalizedFactors,
      keyEvidence,
      uncertaintyLabel,
      confidencePercent,
      worstCase,
      counterView,
      timestamp: Date.now(),
    };

    this.logs.unshift(log);
    this.emit('decision_log', log);
    return log;
  }

  private emptyLog(symbol: string): DecisionLog {
    return {
      logId: `DL-${++this.logSeq}`, symbol,
      recommendation: 'hold', overallScore: 5.0,
      factors: [], keyEvidence: [],
      uncertaintyLabel: '数据不足，无法分析', confidencePercent: 50,
      worstCase: '未知', counterView: '无可分析数据',
      timestamp: Date.now(),
    };
  }

  getLog(logId: string): DecisionLog | undefined {
    return this.logs.find(l => l.logId === logId);
  }

  getSymbolHistory(symbol: string, limit = 10): DecisionLog[] {
    return this.logs.filter(l => l.symbol === symbol).slice(0, limit);
  }

  getAllLogs(): DecisionLog[] { return this.logs; }

  /** 因子加权得分计算器 (供外部调用) */
  static computeWeightedScore(factors: FactorScore[]): number {
    const total = factors.reduce((s, f) => s + f.weight, 0);
    return factors.reduce((s, f) => s + (total > 0 ? f.weight / total : 0) * f.score, 0);
  }
}
