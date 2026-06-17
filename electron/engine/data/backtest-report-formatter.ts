/**
 * R276 Claw(PM): 策略回测报告美化 — BacktestReportFormatter
 * 收益曲线 + 最大回撤 + 夏普比率 + 胜率 + 月度热图
 */

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPct: number;
  annualReturn: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  winRate: number;
  totalTrades: number;
  avgTrade: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestMonth: { month: string; return: number };
  worstMonth: { month: string; return: number };
  monthlyReturns: { month: string; return: number }[];
  dailyEquity: { date: string; equity: number }[];
  drawdowns: { date: string; drawdown: number }[];
}

export interface BacktestReport {
  title: string;
  symbol: string;
  strategy: string;
  period: { start: string; end: string };
  metrics: BacktestMetrics;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  gradeLabel: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export class BacktestReportFormatter {
  static grade(m: BacktestMetrics): Pick<BacktestReport, 'grade' | 'gradeLabel'> {
    if (m.sharpeRatio >= 2.5 && m.winRate >= 65 && m.profitFactor >= 2.0)
      return { grade: 'S', gradeLabel: '🏆 卓越 — 机构级表现' };
    if (m.sharpeRatio >= 1.5 && m.winRate >= 55 && m.profitFactor >= 1.5)
      return { grade: 'A', gradeLabel: '🥇 优秀 — 持续盈利' };
    if (m.sharpeRatio >= 1.0 && m.winRate >= 50 && m.profitFactor >= 1.2)
      return { grade: 'B', gradeLabel: '🥈 良好 — 有盈利潜力' };
    if (m.totalReturn > 0)
      return { grade: 'C', gradeLabel: '🥉 一般 — 勉强盈利' };
    if (m.totalReturn > -20)
      return { grade: 'D', gradeLabel: '⚠️ 较差 — 持续亏损' };
    return { grade: 'F', gradeLabel: '❌ 失败 — 应放弃此策略' };
  }

  static generateReport(
    symbol: string,
    strategy: string,
    metrics: BacktestMetrics,
    period: { start: string; end: string }
  ): BacktestReport {
    const { grade, gradeLabel } = this.grade(metrics);

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (metrics.sharpeRatio >= 1.5) strengths.push(`夏普比率 ${metrics.sharpeRatio.toFixed(2)}，风险调整收益优秀`);
    else if (metrics.sharpeRatio < 0.5) weaknesses.push(`夏普比率仅 ${metrics.sharpeRatio.toFixed(2)}，风险调整收益不足`);

    if (metrics.winRate >= 60) strengths.push(`胜率 ${metrics.winRate}%，超过60%`);
    else if (metrics.winRate < 40) weaknesses.push(`胜率仅 ${metrics.winRate}%，低于40%`);

    if (metrics.profitFactor >= 2.0) strengths.push(`盈亏比 ${metrics.profitFactor.toFixed(1)}:1，远超行业标准`);
    else if (metrics.profitFactor < 1.0) weaknesses.push(`盈亏比仅 ${metrics.profitFactor.toFixed(1)}:1，亏多赚少`);

    if (metrics.maxDrawdownPct < 15) strengths.push(`最大回撤仅 ${metrics.maxDrawdownPct}%，风险控制良好`);
    else if (metrics.maxDrawdownPct > 30) weaknesses.push(`最大回撤 ${metrics.maxDrawdownPct}%，超过30%警戒线`);

    if (metrics.consecutiveWins >= 5) strengths.push(`最长连胜 ${metrics.consecutiveWins}笔，趋势捕捉能力强`);
    if (metrics.consecutiveLosses >= 5) weaknesses.push(`最长连亏 ${metrics.consecutiveLosses}笔，逆势风险高`);

    const recommendations: string[] = [];
    if (metrics.maxDrawdownPct > 20) recommendations.push('建议设置止损线，控制单笔最大亏损');
    if (metrics.winRate < 50 && metrics.profitFactor > 1.0) recommendations.push('低胜率高盈亏比策略——适合耐心投资者。不要因连续亏损而放弃。');
    if (metrics.totalTrades < 30) recommendations.push('交易次数较少（<30笔），回测结果统计意义不足。建议延长回测周期或增加信号频率。');
    if (grade === 'S' || grade === 'A') recommendations.push('策略表现优异，建议小资金实盘验证');
    if (grade === 'F') recommendations.push('策略持续亏损，建议重新设计因子或更换市场');
    recommendations.push('建议结合实盘价差和执行滑点（0.1-0.3%）重新评估');

    const summary = `${strategy}策略在${period.start}至${period.end}期间，累计收益 ${metrics.totalReturnPct > 0 ? '+' : ''}${metrics.totalReturnPct}%，年化收益 ${metrics.annualReturn}%。胜率 ${metrics.winRate}%，夏普比率 ${metrics.sharpeRatio.toFixed(2)}，最大回撤 ${metrics.maxDrawdownPct}%。综合评级: ${gradeLabel}。`;

    return {
      title: `${symbol} — ${strategy} 回测报告`,
      symbol, strategy, period,
      metrics, grade, gradeLabel, summary,
      strengths: strengths.slice(0, 5),
      weaknesses: weaknesses.slice(0, 5),
      recommendations,
    };
  }

  /** 月度热图数据: 绿=盈利, 红=亏损, 深浅=幅度 */
  static monthlyHeatmap(m: BacktestMetrics): { month: string; return: number; intensity: number }[] {
    const maxAbs = Math.max(...m.monthlyReturns.map(r => Math.abs(r.return)), 1);
    return m.monthlyReturns.map(r => ({
      month: r.month,
      return: r.return,
      intensity: Math.round(Math.abs(r.return) / maxAbs * 100),
    }));
  }

  /** 收益曲线图表数据 (SVG ready) */
  static equityCurveData(m: BacktestMetrics): { x: number; y: number }[] {
    if (m.dailyEquity.length === 0) return [];
    const maxE = Math.max(...m.dailyEquity.map(d => d.equity));
    const minE = Math.min(...m.dailyEquity.map(d => d.equity));
    const range = maxE - minE || 1;
    return m.dailyEquity.map((d, i) => ({
      x: Math.round(i / m.dailyEquity.length * 100),
      y: Math.round((1 - (d.equity - minE) / range) * 80 + 10),
    }));
  }
}

export default BacktestReportFormatter;
