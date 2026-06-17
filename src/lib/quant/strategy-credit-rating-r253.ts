// ══ R253 LOBEHUB QU-02: 策略信用评级引擎 ══
// Strategy Credit Rating (A/B/C/D) — 类似标普/穆迪评级
// "不是所有策略都能赚钱。给它们打分。"
//
// 评级维度:
//   A. 回测夏普 (25%)
//   B. 最大回撤 (20%)
//   C. 胜率 (15%)
//   D. 因子IC质量 (15%)
//   E. 过拟合风险 (10%)
//   F. 实盘vs回测偏差 (10%)
//   G. 策略交付延迟 (5%)
//
// 评级: A(>=85) B(70-84) C(50-69) D(<50) F(实盘严重偏离)

export type CreditRating = 'A' | 'B' | 'C' | 'D' | 'F';

export interface StrategyRatingInput {
  strategyId: string;
  strategyName: string;
  backtestSharpe: number;       // 回测夏普
  backtestMaxDrawdown: number;  // 回测最大回撤(%)
  backtestWinRate: number;      // 回测胜率(%)
  avgFactorIC: number;          // 所用因子的平均IC
  paramCount: number;           // 参数个数 → 越多=越可能过拟合
  liveVsBacktestDelta: number;  // 实盘收益率 - 回测收益率 (差)
  deliveryLatencyMs: number;    // 信号生成延迟(ms)
  lastUpdated: number;
}

export interface StrategyRating {
  strategyId: string;
  strategyName: string;
  totalScore: number;           // 0-100
  rating: CreditRating;
  componentScores: {
    sharpe: number;             // 0-25
    drawdown: number;           // 0-20
    winRate: number;            // 0-15
    factorIC: number;           // 0-15
    overfit: number;            // 0-10
    liveDelta: number;          // 0-10
    latency: number;            // 0-5
  };
  warnings: string[];
  lastRated: number;
  nextReview: number;           // 下次重评时间
}

// ═══════════════════ 评分权重（内嵌于各score函数） ═══════════════════
// sharpe:25 drawdown:20 winRate:15 factorIC:15 overfit:10 liveDelta:10 latency:5

// ═══════════════════ 评分函数 ═══════════════════

function scoreSharpe(sharpe: number): number {
  if (sharpe >= 2.0) return 25;
  if (sharpe >= 1.5) return 22;
  if (sharpe >= 1.0) return 18;
  if (sharpe >= 0.5) return 14;
  if (sharpe >= 0.0) return 8;
  if (sharpe >= -0.5) return 4;
  return 0;
}

function scoreDrawdown(dd: number): number {
  if (dd <= 5) return 20;
  if (dd <= 10) return 18;
  if (dd <= 20) return 15;
  if (dd <= 30) return 10;
  if (dd <= 40) return 5;
  if (dd <= 50) return 2;
  return 0;
}

function scoreWinRate(wr: number): number {
  if (wr >= 60) return 15;
  if (wr >= 55) return 13;
  if (wr >= 50) return 11;
  if (wr >= 45) return 8;
  if (wr >= 40) return 5;
  if (wr >= 35) return 2;
  return 0;
}

function scoreFactorIC(ic: number): number {
  if (ic >= 0.08) return 15;
  if (ic >= 0.05) return 13;
  if (ic >= 0.03) return 10;
  if (ic >= 0.02) return 6;
  if (ic >= 0.01) return 3;
  return 0;
}

function scoreOverfit(paramCount: number): number {
  if (paramCount <= 3) return 10;
  if (paramCount <= 5) return 8;
  if (paramCount <= 8) return 6;
  if (paramCount <= 12) return 3;
  if (paramCount <= 20) return 1;
  return 0;
}

function scoreLiveDelta(delta: number): number {
  if (delta >= 0.02) return 10;  // 实盘更好
  if (delta >= -0.02) return 9;  // 偏差很小
  if (delta >= -0.05) return 7;
  if (delta >= -0.10) return 5;
  if (delta >= -0.20) return 2;
  return 0;  // 实盘严重偏差
}

function scoreLatency(ms: number): number {
  if (ms <= 50) return 5;
  if (ms <= 100) return 4;
  if (ms <= 200) return 3;
  if (ms <= 500) return 2;
  if (ms <= 1000) return 1;
  return 0;
}

// ═══════════════════ 评级引擎 ═══════════════════

export function rateStrategy(input: StrategyRatingInput): StrategyRating {
  const sharpe = scoreSharpe(input.backtestSharpe);
  const drawdown = scoreDrawdown(input.backtestMaxDrawdown);
  const winRate = scoreWinRate(input.backtestWinRate);
  const factorIC = scoreFactorIC(input.avgFactorIC);
  const overfit = scoreOverfit(input.paramCount);
  const liveDelta = scoreLiveDelta(input.liveVsBacktestDelta);
  const latency = scoreLatency(input.deliveryLatencyMs);

  const total = sharpe + drawdown + winRate + factorIC + overfit + liveDelta + latency;

  let rating: CreditRating;
  if (total >= 85) rating = 'A';
  else if (total >= 70) rating = 'B';
  else if (total >= 50) rating = 'C';
  else if (total >= 30) rating = 'D';
  else rating = 'F';

  const warnings: string[] = [];
  if (input.liveVsBacktestDelta < -0.10) warnings.push(`⚠️ 实盘偏差${(input.liveVsBacktestDelta*100).toFixed(1)}%：回测可能过度优化`);
  if (input.paramCount > 10) warnings.push(`⚠️ 参数过多(${input.paramCount}个)：高过拟合风险`);
  if (input.avgFactorIC < 0.02) warnings.push(`⚠️ 因子IC太低(${input.avgFactorIC})：信号质量差`);
  if (input.backtestMaxDrawdown > 35) warnings.push(`⚠️ 回撤过大(${input.backtestMaxDrawdown}%)：不适合低风险偏好`);
  if (input.deliveryLatencyMs > 500) warnings.push(`⚠️ 信号延迟过高(${input.deliveryLatencyMs}ms)：可能错失交易窗口`);

  return {
    strategyId: input.strategyId,
    strategyName: input.strategyName,
    totalScore: Math.round(total),
    rating,
    componentScores: { sharpe, drawdown, winRate, factorIC, overfit, liveDelta, latency },
    warnings,
    lastRated: Date.now(),
    nextReview: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30天后重评
  };
}

// ═══════════════════ 批量评级 ═══════════════════

export interface RatingSummary {
  timestamp: number;
  total: number;
  distribution: { A: number; B: number; C: number; D: number; F: number };
  avgScore: number;
  top3: StrategyRating[];
  worst3: StrategyRating[];
  recommendations: string[];
}

export function batchRateStrategies(inputs: StrategyRatingInput[]): RatingSummary {
  const ratings = inputs.map(rateStrategy);
  ratings.sort((a, b) => b.totalScore - a.totalScore);

  const dist: RatingSummary['distribution'] = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const r of ratings) dist[r.rating]++;

  const avgScore = ratings.reduce((s, r) => s + r.totalScore, 0) / ratings.length;
  const top3 = ratings.slice(0, 3);
  const worst3 = ratings.slice(-3).reverse();

  const recs: string[] = [];
  if (dist.D + dist.F > ratings.length * 0.3) recs.push('⚠️ 超过30%策略评级为D/F——建议大规模策略优化');
  if (dist.A === 0) recs.push('💡 当前无A级策略——没有"强烈推荐"标的');
  if (dist.A + dist.B > ratings.length * 0.5) recs.push('✅ 超过半数策略评级为A/B——策略池质量优秀');
  const overfitWarnings = ratings.filter(r => r.warnings.some(w => w.includes('过拟合'))).length;
  if (overfitWarnings > ratings.length * 0.3) recs.push('⚠️ 多个策略存在过拟合风险——建议简化参数');

  return {
    timestamp: Date.now(),
    total: ratings.length,
    distribution: dist,
    avgScore,
    top3,
    worst3,
    recommendations: recs,
  };
}

// ═══════════════════ 评级文案 ═══════════════════

export const RATING_DESCRIPTIONS: Record<CreditRating, { label: string; emoji: string; description: string; action: string }> = {
  A: { label: '优异', emoji: '🏆', description: '多维表现优秀，可放心使用', action: '推荐作为核心策略' },
  B: { label: '良好', emoji: '✅', description: '大部分维度表现良好，有优化空间', action: '可以信任，关注优化点' },
  C: { label: '一般', emoji: '⚠️', description: '有亮眼指标但短板明显', action: '谨慎使用，等待下一期评级' },
  D: { label: '较差', emoji: '🔴', description: '多项指标不佳', action: '不推荐——建议大幅修改或替换' },
  F: { label: '危险', emoji: '💀', description: '严重偏离回测预期', action: '立即暂停！大概率过拟合' },
};

// ═══════════════════ 导出 ═══════════════════

export default StrategyRating;
