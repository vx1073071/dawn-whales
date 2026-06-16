// ══ R250 QClaw P2-15: 财报日历文案 ══
// Earnings calendar copy — labels, states, notifications
// Design: "把财报日程变成你的投资日历"

export type EarningsSurprise = 'beat' | 'miss' | 'inline';
export type CalendarView = 'week' | 'month' | 'my_stocks' | 'all';

export interface EarningsCalendarCopy {
  // UI标签
  labels: {
    viewSwitch: Record<CalendarView, string>;
    filters: Record<string, string>;
    timeRelative: Record<string, string>;  // "明天" / "3天后" / "下周"
    emptyStates: Record<string, { title: string; body: string; cta: string; }>;
    headers: Record<string, string>;
  };
  // 超预期/低于预期/符合预期
  surprise: Record<EarningsSurprise, {
    label: string;
    emoji: string;
    description: string;
    color: string;
  }>;
  // 时间节点
  timeline: {
    confirmed: string;
    estimated: string;
    today: string;
    tomorrow: string;
    thisWeek: string;
    nextWeek: string;
  };
  // 推送
  push: {
    upcoming: string;
    today: string;
    afterClose: string;
    tomorrowBeforeOpen: string;
    beat: string;
    miss: string;
  };
}

export const EARNINGS_CALENDAR_COPY: EarningsCalendarCopy = {
  labels: {
    viewSwitch: {
      week: '本周',
      month: '本月',
      my_stocks: '我的持仓',
      all: '全部',
    },
    filters: {
      marketCap: '市值',
      largeCap: '大盘股',
      midCap: '中盘股',
      smallCap: '小盘股',
      surpriseOnly: '只看有惊喜的',
      confirmedOnly: '只看确认的',
    },
    timeRelative: {
      today: '今天',
      tomorrow: '明天',
      days2: '2天后',
      days3: '3天后',
      days4: '4天后',
      days5: '5天后',
      days6: '6天后',
      nextWeek: '下周',
      laterThisMonth: '本月晚些时候',
    },
    emptyStates: {
      noHoldings: {
        title: '还没有持仓股票发财报',
        body: '添加一些关注的股票到你的持仓列表，财报季到了你会第一时间知道。',
        cta: '添加持仓',
      },
      noEarnings: {
        title: '这周很安静',
        body: '本周没有你关注的股票发财报。享受一下没有业绩波动的周末吧。下周三开始财报季又要密集了。',
        cta: '看本月日历',
      },
      offSeason: {
        title: '财报季还没到',
        body: '现在不是财报密集期。美股财报季通常在1/4/7/10月开始。你可以趁现在提前研究一下关注的股票。',
        cta: '看历史财报',
      },
    },
    headers: {
      confirmedDate: '确认日期',
      estimatedDate: '预估日期',
      beforeOpen: '盘前',
      afterClose: '盘后',
      expectedEps: '预期EPS',
      lastBeat: '上次',
      surpriseHistory: '超预期历史',
      marketCap: '市值',
      avgMove: '平均波动',
    },
  },

  surprise: {
    beat: {
      label: '超预期',
      emoji: '🟢',
      description: '实际盈利超过了华尔街分析师的预期——通常利好，但要看看超了多少。',
      color: '#22c55e',
    },
    miss: {
      label: '低于预期',
      emoji: '🔴',
      description: '实际盈利没达到华尔街预期——通常利空，但要看差了多少以及原因。',
      color: '#ef4444',
    },
    inline: {
      label: '符合预期',
      emoji: '⚪',
      description: '盈利和分析师预期一致——没有惊喜也没有惊吓。股价通常不会有大波动。',
      color: '#94a3b8',
    },
  },

  timeline: {
    confirmed: '已确认',
    estimated: '预估',
    today: '今天',
    tomorrow: '明天',
    thisWeek: '本周',
    nextWeek: '下周',
  },

  push: {
    upcoming: '⏰ {company} 将在{timing}发布财报。市场预期EPS {estimate}。这家公司过去{days}次财报有{beat_count}次超预期。',
    today: '📅 {company} 今天{timing}发财报！预期EPS {estimate}，过去4次{beat_count}次超预期，发布后平均波动{avg_move}%。',
    afterClose: '{company}盘后发布财报！EPS {actual}，{vs_estimate}。{guidance}。盘后股价{direction}{change}%。',
    tomorrowBeforeOpen: '明早盘前注意：{company}盘前发财报。预期EPS {estimate}。上次他们{last_result}。',
    beat: '✅ {company}超预期！EPS {actual} vs 预期{estimate}，超了{beat_by}%。{key_reason}。股价{direction}{change}%。',
    miss: '⚠️ {company}低于预期！EPS {actual} vs 预期{estimate}，差了{miss_by}%。{key_reason}。股价{direction}{change}%。',
  },
};

// ═══════════════════ 财报卡片文案生成 ═══════════════════

export function generateEarningsCard(params: {
  company: string;
  ticker: string;
  when: 'today' | 'tomorrow' | 'days_away';
  daysAway?: number;
  timing?: 'before_open' | 'after_close';
  estimate: string;
  surpriseHistory?: { beat: number; miss: number; inline: number; };
}): { header: string; subtitle: string; badge: string; } {
  const timingLabel = params.timing === 'before_open' ? '盘前' : '盘后';
  const daysText = params.when === 'today' ? '今天' : params.when === 'tomorrow' ? '明天' : `${params.daysAway}天后`;

  let header: string, subtitle: string, badge: string;

  if (params.when === 'today') {
    header = `${params.ticker} 今天${timingLabel}发财报`;
    badge = '🔴 今天';
  } else if (params.when === 'tomorrow') {
    header = `${params.ticker} 明天${timingLabel}发财报`;
    badge = '🟡 明天';
  } else {
    header = `${params.ticker} ${daysText}发财报`;
    badge = `${params.daysAway}天`;
  }

  subtitle = `预期EPS ${params.estimate}`;
  if (params.surpriseHistory) {
    const total = params.surpriseHistory.beat + params.surpriseHistory.miss + params.surpriseHistory.inline;
    if (total > 0) {
      const beatPct = ((params.surpriseHistory.beat / total) * 100).toFixed(0);
      subtitle += ` · 过去${total}次${beatPct}%超预期`;
    }
  }

  return { header, subtitle, badge };
}

/** Generate the historical surprise bar description */
export function generateSurpriseHistory(beat: number, miss: number, inline: number): string {
  const total = beat + miss + inline;
  if (total === 0) return '暂无历史数据';
  const beatPct = ((beat / total) * 100).toFixed(0);
  if (Number(beatPct) >= 80) return `过去${total}次财报里${beatPct}%超预期 — 这家很靠谱`;
  if (Number(beatPct) >= 60) return `过去${total}次里${beatPct}%超预期 — 高于平均水平`;
  if (Number(beatPct) >= 40) return `过去${total}次里${beatPct}%超预期 — 比较平均`;
  return `过去${total}次里只有${beatPct}%超预期 — 预期管理较差`;
}

export default EARNINGS_CALENDAR_COPY;
