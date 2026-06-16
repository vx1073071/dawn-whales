// ══ R248 QClaw P2-05: 策略健康历史文案 ══
// Human-readable strategy health trends over time
// Design: "不是冰冷的数据表格，是策略的'体检报告'和'病历本'"

export type HealthTrend = 'improving' | 'stable' | 'declining' | 'volatile';

export interface HealthTimepoint {
  label: string;
  dateRange: string;
  /** 发生了什么 */
  narrative: string;
  /** 关键数据 (选1-2个最核心的) */
  keyMetrics: { label: string; value: string; assessment: 'good' | 'neutral' | 'bad'; }[];
  /** 和之前比怎么样 */
  vsPrevious: string;
}

export interface StrategyHealthTimeline {
  strategyId: string;
  strategyName: string;
  overallTrend: HealthTrend;
  /** 一句话总结当前状态 */
  currentStatus: string;
  /** 时间线各节点 */
  timepoints: HealthTimepoint[];
  /** 建议 */
  recommendation: string;
}

// ═══════════════════ 通用健康描述模板 ═══════════════════

export const HEALTH_TREND_COPY: Record<HealthTrend, { emoji: string; label: string; oneLiner: string; }> = {
  improving: {
    emoji: '📈',
    label: '在好转',
    oneLiner: '策略最近表现越来越好——信号质量在回升，胜率在提高。',
  },
  stable: {
    emoji: '➡️',
    label: '稳定运行',
    oneLiner: '策略表现和之前差不多——没有大的波动，按部就班地运行着。',
  },
  declining: {
    emoji: '📉',
    label: '需要注意',
    oneLiner: '策略最近在走下坡——胜率下降、回撤增加。建议检查一下原因。',
  },
  volatile: {
    emoji: '🎢',
    label: '波动很大',
    oneLiner: '策略最近忽上忽下——有时大赚有时大亏。可能市场环境在剧烈变化。',
  },
};

// ═══════════════════ 时间节点文案模板 ═══════════════════

export const HEALTH_NARRATIVE_TEMPLATES = {
  /** 策略刚上线 */
  launch: {
    label: '策略上线',
    narrative: '你第一次部署了「{strategy_name}」。初始设置：仓位{position_size}%，单笔最大亏损{max_loss}%。这就像一个新引擎的磨合期——前面的数据不要完全当真。',
    keyMetrics: [
      { label: '初始胜率', value: '{initial_winrate}%', assessment: 'neutral' as const },
    ],
    vsPrevious: '没有历史对比——这是新的开始。',
  },

  /** 最佳时期 */
  peak: {
    label: '黄金时期',
    narrative: '这是「{strategy_name}」的高光时刻。{month}到{month_end}，策略抓住了{market_condition}的机会——{what_worked}。这个阶段验证了策略的核心逻辑是正确的。',
    keyMetrics: [
      { label: '区间收益', value: '{return}%', assessment: 'good' as const },
      { label: '胜率', value: '{winrate}%', assessment: 'good' as const },
    ],
    vsPrevious: '比前一个季度多赚了{excess}%。',
  },

  /** 最差时期 */
  trough: {
    label: '艰难时期',
    narrative: '这是「{strategy_name}」经历过的最困难阶段。{reason}导致策略连续亏损——最大回撤达到{max_dd}%。但请注意：{context_note}。最黑暗的时候往往是黎明前。',
    keyMetrics: [
      { label: '区间亏损', value: '{return}%', assessment: 'bad' as const },
      { label: '最大回撤', value: '{max_dd}%', assessment: 'bad' as const },
    ],
    vsPrevious: '比前一个季度多亏了{excess}%。',
  },

  /** 恢复期 */
  recovery: {
    label: '恢复期',
    narrative: '经过之前的艰难时期后，「{strategy_name}」开始恢复了。{recovery_reason}推动了反弹——{recovery_period}内回血了{recovered_pct}%。这是一个好信号：策略的核心逻辑没有失灵，只是之前遇到了不利的市场环境。',
    keyMetrics: [
      { label: '已恢复', value: '{recovered_pct}%', assessment: 'good' as const },
      { label: '距前高还有', value: '{to_peak}%', assessment: 'neutral' as const },
    ],
    vsPrevious: '从低点反弹了{recovery_pct}%——正在回血。',
  },

  /** 参数调整 */
  paramChange: {
    label: '策略调参',
    narrative: '你在{date}对「{strategy_name}」做了调整：{changes}。调参就像给发动机换机油——短期内可能有轻微的"适应期"，但长期通常是好的。给你看调参前后的变化...',
    keyMetrics: [
      { label: '调参后胜率', value: '{new_winrate}%', assessment: 'neutral' as const },
      { label: 'vs 调参前', value: '{vs_before}', assessment: 'neutral' as const },
    ],
    vsPrevious: '调参后运行了{trades_count}笔交易——还在观察期。',
  },

  /** 市场巨变影响 */
  regimeShift: {
    label: '市场变了',
    narrative: '{event}引发了市场的剧烈变化。从{old_regime}切换到了{new_regime}这种环境。「{strategy_name}」在这种环境下{assessment}——{detail}。',
    keyMetrics: [
      { label: '事件后收益', value: '{return}%', assessment: 'neutral' as const },
      { label: '波动率变化', value: '{vol_change}', assessment: 'bad' as const },
    ],
    vsPrevious: '市场体制切换后，策略表现{changed_how}。',
  },
};

// ═══════════════════ 健康摘要生成器 ═══════════════════

export function generateHealthSummary(timeline: StrategyHealthTimeline): string {
  const trend = HEALTH_TREND_COPY[timeline.overallTrend];
  let text = `${trend.emoji} 「${timeline.strategyName}」${trend.label}\n`;
  text += `${trend.oneLiner}\n\n`;

  text += `📊 当前状态: ${timeline.currentStatus}\n\n`;

  text += `📅 关键节点:\n`;
  for (const tp of timeline.timepoints) {
    text += `  ${tp.label} (${tp.dateRange})\n`;
    text += `  ${tp.narrative.substring(0, 100)}...\n`;
    for (const m of tp.keyMetrics) {
      const icon = m.assessment === 'good' ? '✅' : m.assessment === 'bad' ? '⚠️' : '➖';
      text += `  ${icon} ${m.label}: ${m.value}\n`;
    }
    text += `\n`;
  }

  text += `💡 建议: ${timeline.recommendation}\n`;
  return text;
}

/** Generate a one-line "what happened this month" summary */
export function generateMonthlyOneLiner(month: string, pnl: number, trades: number, winRate: number, vsBenchmark: number): string {
  const pnlStr = pnl >= 0 ? `赚了${pnl}%` : `亏了${Math.abs(pnl)}%`;
  const wrStr = winRate >= 60 ? `胜率不错` : winRate >= 40 ? `胜率一般` : `胜率偏低`;
  const vsStr = vsBenchmark >= 0 ? `跑赢大盘${vsBenchmark}%` : `跑输大盘${Math.abs(vsBenchmark)}%`;

  if (pnl >= 0 && winRate >= 50) {
    return `${month}：${pnlStr}，做了${trades}笔交易，${wrStr}（${winRate}%），${vsStr}。✅ 这个月还行。`;
  } else if (pnl >= 0 && winRate < 50) {
    return `${month}：${pnlStr}，做了${trades}笔交易，虽然胜率只有${winRate}%，但赚的比亏的大，${vsStr}。↔️ 盈亏比优势。`;
  } else if (pnl < 0 && vsBenchmark >= 0) {
    return `${month}：${pnlStr}，但${vsStr}——说明不是策略的问题，是市场整体不好。📉 可以坚持。`;
  } else {
    return `${month}：${pnlStr}，做了${trades}笔交易，胜率${winRate}%，${vsStr}。⚠️ 策略和市场都不好，要审视一下。`;
  }
}

/** Regime attribution: explain WHY the strategy performed this way */
export function generateRegimeAttribution(regime: string, performance: number, benchmark: number): string {
  const regimes: Record<string, string> = {
    'bull_strong': '强牛市中，趋势策略通常表现最佳。如果你的策略偏趋势，现在的环境对你有利。',
    'bull_weak': '弱牛市中，选股能力变得重要——普涨结束了，个股分化。如果你的策略有好的因子筛选，应该能跑赢。',
    'sideways': '震荡市中，趋势策略最容易被打脸，网格/均值回归策略反而好做。如果你的策略震荡市表现差——这很正常，不是策略错了，是环境不适合。',
    'bear_mild': '温和熊市中，防守型策略（低波动/高股息）相对抗跌。看看你的策略回撤和基准比——如果比基准跌得少，就是好策略。',
    'bear_crash': '暴跌市中，几乎所有策略都会亏——这是系统性风险。重要的是：你的策略亏得比市场少吗？如果比基准跌得少，持有。如果跌得更多，需要反思。',
  };

  const analysis = regimes[regime] || '当前市场体制不明确，策略表现可能更多来自个股选择而非市场环境。';
  const perfVsBench = performance - benchmark;
  const perfNote = perfVsBench >= 0
    ? `你的策略在这种环境下产生了${perfVsBench}%的超额收益——说明策略在当前环境有效。`
    : `你的策略在这种环境下跑输${Math.abs(perfVsBench)}%——${
        Math.abs(perfVsBench) < 3 ? '差距不大，可以接受。' : '差距太大，需要考虑调整或暂停。'
      }`;

  return `${analysis}\n\n${perfNote}`;
}

export default HEALTH_TREND_COPY;
