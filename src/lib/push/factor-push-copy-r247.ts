// ══ R247 QClaw P1-12: 因子信号推送文案 ══
// 4 trigger types × human push notification copy + CTA
// Design: push that feels like a friend texting, not a robot alert

export type PushTrigger =
  | 'position_risk'      // 持仓风险预警
  | 'strategy_health'    // 策略健康告警
  | 'better_strategy'    // 更好策略推荐
  | 'factor_signal';     // 个性化因子信号

export interface PushCopyTemplate {
  trigger: PushTrigger;
  /** 用户在什么情况下收到这条推送 */
  triggerCondition: string;
  /** 推送频率控制 */
  frequency: string;
  /** 是否免费 (5条/天免费, 超过按需付费) */
  pricing: string;
  variations: {
    /** 温和版 (日常频率) */
    gentle: { title: string; body: string; cta: string; deepLink: string; };
    /** 紧急版 (高风险/急需关注) */
    urgent: { title: string; body: string; cta: string; deepLink: string; };
    /** 积极版 (好消息/机会) */
    positive: { title: string; body: string; cta: string; deepLink: string; };
    /** 沉默版 (用户3天未登录) */
    reengagement: { title: string; body: string; cta: string; deepLink: string; };
  };
}

export const PUSH_COPY_TEMPLATES: PushCopyTemplate[] = [
  // ═══════════════════ 1. 持仓风险预警 ═══════════════════
  {
    trigger: 'position_risk',
    triggerCondition: '持仓因子触发极端值(RSI>80/<20, VIX跳升>30%, 回撤>15%等)',
    frequency: '同一股票同一因子每天最多1次',
    pricing: '免费额度内: 5条/天; 超出: 无限2U/月',
    variations: {
      gentle: {
        title: '{ticker} 的 {factor_name} 到了 {value}',
        body: '这个位置在历史上77%的情况都出现了回调。要不要看看详情？',
        cta: '看看怎么回事',
        deepLink: '/position/{ticker}/factor/{factorId}',
      },
      urgent: {
        title: '⚠️ {ticker} 有风险信号',
        body: '{factor_name}到了{value}——过去类似情况后{x_days}天内平均跌了{avg_loss}%。建议立刻检查。',
        cta: '立刻查看',
        deepLink: '/position/{ticker}/alert',
      },
      positive: {
        title: '{ticker} 看起来不错',
        body: '{factor_name}显示{human_signal}。你的持仓{unrealized_pnl}。',
        cta: '查看详情',
        deepLink: '/position/{ticker}',
      },
      reengagement: {
        title: '🐋 嘿，你的 {ticker} 在动',
        body: '你{inactive_days}天没来看了。{ticker}的{factor_name}到了{value}——{human_brief}。',
        cta: '回来看看',
        deepLink: '/dashboard',
      },
    },
  },

  // ═══════════════════ 2. 策略健康告警 ═══════════════════
  {
    trigger: 'strategy_health',
    triggerCondition: '策略连续亏损N次/胜率显著下降/波动异常/因子失效',
    frequency: '同一策略每周最多2次',
    pricing: '免费额度内: 5条/天',
    variations: {
      gentle: {
        title: '「{strategy_name}」最近{loss_count}次{win_count}胜{loss_count}负',
        body: '胜率{recent_winrate}%，比历史平均{hist_winrate}%低了{gap}%。要不要检查一下出了什么问题？',
        cta: '看看怎么回事',
        deepLink: '/strategy/{strategyId}/health',
      },
      urgent: {
        title: '🚨 「{strategy_name}」连续亏损{loss_streak}次',
        body: '这是这个策略过去{lookback_period}里最差的表现。建议暂停跟单，检查{problem_factor}是否失效。',
        cta: '立即检查',
        deepLink: '/strategy/{strategyId}/diagnose',
      },
      positive: {
        title: '「{strategy_name}」恢复了',
        body: '经过前面{loss_count}次亏损后，最近{win_count}次全胜。信号质量回升到{quality_score}%。',
        cta: '查看策略状态',
        deepLink: '/strategy/{strategyId}',
      },
      reengagement: {
        title: '🐋 {strategy_name} 有话跟你说',
        body: '你{inactive_days}天没管它了。这段时间跑了{trades_count}笔，{win_count}胜{loss_count}负，净{net_pnl}。',
        cta: '去看看',
        deepLink: '/strategy/{strategyId}',
      },
    },
  },

  // ═══════════════════ 3. 更好策略推荐 ═══════════════════
  {
    trigger: 'better_strategy',
    triggerCondition: '发现与当前持仓/策略高度相关但收益更优的替代方案',
    frequency: '同一场景每周最多1次',
    pricing: '免费额度内: 5条/天',
    variations: {
      gentle: {
        title: '发现一个跟「{current_strategy}」很像但更好的策略',
        body: '「{better_strategy}」过去{period}收益{better_return}%，比你的高了{diff}%。风险差不多。',
        cta: '看看这个',
        deepLink: '/strategy/{betterStrategyId}',
      },
      urgent: {
        title: '你的「{current_strategy}」有更好的替代方案',
        body: '同一个市场里，「{better_strategy}」用的是{better_factor_combo}，回撤{better_drawdown}%更低。',
        cta: '比较一下',
        deepLink: '/compare/{currentStrategyId}/{betterStrategyId}',
      },
      positive: {
        title: '💎 你的持仓风格，这个策略很配',
        body: '根据你的交易记录，你的风格偏{user_style}。「{better_strategy}」跟你的风格非常契合——{match_reason}。免费回测一次？',
        cta: '免费回测',
        deepLink: '/strategy/{betterStrategyId}/backtest',
      },
      reengagement: {
        title: '🐋 你不在的时候我发现了个好东西',
        body: '「{better_strategy}」在过去{period}赚了{better_return}%——而且是你的风格（{user_style}）。要试一下吗？',
        cta: '好奇了',
        deepLink: '/strategy/{betterStrategyId}',
      },
    },
  },

  // ═══════════════════ 4. 个性化因子信号 ═══════════════════
  {
    trigger: 'factor_signal',
    triggerCondition: '用户关注/自定义的因子达到预设阈值',
    frequency: '同一因子每天最多1次',
    pricing: '免费: 最多关注5个因子; 无限: 2U/月',
    variations: {
      gentle: {
        title: '你关注的 {factor_name} 有信号',
        body: '{factor_name}到了{value}——{human_signal}。历史上类似信号{x_days}天后胜率{win_rate}%。',
        cta: '查看信号',
        deepLink: '/factor/{factorId}',
      },
      urgent: {
        title: '🔔 {factor_name} 强信号！',
        body: '{factor_name}到了{value}，这是过去{period}里第{percentile}高的位置。{human_warning}。',
        cta: '现在就看',
        deepLink: '/factor/{factorId}/alert',
      },
      positive: {
        title: '你关注的 {factor_name} 亮绿灯了',
        body: '{factor_name} = {value}，{human_good_news}。跟你持仓的{ticker}有关——要看看吗？',
        cta: '去看看',
        deepLink: '/position/{ticker}/factor/{factorId}',
      },
      reengagement: {
        title: '🐋 你让我盯的 {factor_name} 动了',
        body: '你让我盯的{factor_name}，现在到了{value}。{human_brief}。',
        cta: '看看去',
        deepLink: '/factor/{factorId}',
      },
    },
  },
];

/** Generate push copy given trigger, severity, and params */
export function generatePushCopy(
  trigger: PushTrigger,
  severity: 'gentle' | 'urgent' | 'positive' | 'reengagement',
  params: Record<string, string>
): { title: string; body: string; cta: string; deepLink: string } {
  const tmpl = PUSH_COPY_TEMPLATES.find(t => t.trigger === trigger);
  if (!tmpl) {
    return { title: '新通知', body: '有新的信号，点击查看。', cta: '查看', deepLink: '/dashboard' };
  }
  let copy = tmpl.variations[severity];
  let title = copy.title, body = copy.body, cta = copy.cta, deepLink = copy.deepLink;
  for (const [k, v] of Object.entries(params)) {
    const re = new RegExp(`\\{${k}\\}`, 'g');
    title = title.replace(re, v);
    body = body.replace(re, v);
    deepLink = deepLink.replace(re, v);
  }
  return { title, body, cta, deepLink };
}

export default PUSH_COPY_TEMPLATES;
