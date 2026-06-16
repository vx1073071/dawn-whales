// ══ R251 QClaw P2-19: 异动报告文案 ══
// Daily anomaly report copy — when the market does something unusual
// Design: "不是吓唬你，是提醒你——今天有些事值得注意"

export type AnomalyCategory = 'technical' | 'capital_flow' | 'derivatives' | 'sentiment' | 'news' | 'macro';
export type AnomalySeverity = 'critical' | 'major' | 'minor' | 'info';

export interface AnomalyCategoryCopy {
  category: AnomalyCategory;
  label: string;
  emoji: string;
  description: string;
  emptyMessage: string;
}

export interface AnomalySeverityCopy {
  severity: AnomalySeverity;
  label: string;
  emoji: string;
  urgency: string;
  recommendation: string;
}

export interface DailyAnomalyReportCopy {
  categories: Record<AnomalyCategory, AnomalyCategoryCopy>;
  severities: Record<AnomalySeverity, AnomalySeverityCopy>;
  report: {
    header: Record<string, string>;
    sections: Record<string, string>;
    emptyStates: Record<string, string>;
    closing: Record<string, string>;
  };
  push: Record<string, string>;
}

export const ANOMALY_REPORT_COPY: DailyAnomalyReportCopy = {
  // ═══════════════════ 异动分类 ═══════════════════

  categories: {
    technical: {
      category: 'technical',
      label: '技术面异动',
      emoji: '📊',
      description: '股价、指标或K线形态出现了不常见的信号——比如突破了长期均线、或者指标到了极端位置。',
      emptyMessage: '今天技术面很平静——没有股票出现极端的技术信号。',
    },
    capital_flow: {
      category: 'capital_flow',
      label: '资金面异动',
      emoji: '💰',
      description: '有大资金在动——比如特大单净流入/流出异常、或者某个经纪商的买卖方向变了。',
      emptyMessage: '今天没有明显的大资金异动。主力资金按兵不动。',
    },
    derivatives: {
      category: 'derivatives',
      label: '衍生品异动',
      emoji: '🎯',
      description: '期权、牛熊证或其他衍生品出现了异常——大单、IV飙升、街货比异常等。',
      emptyMessage: '今天衍生品市场风平浪静——没有异常的大单或IV变动。',
    },
    sentiment: {
      category: 'sentiment',
      label: '情绪异动',
      emoji: '🧠',
      description: '市场参与者情绪出现了值得注意的变化——恐慌指数飙升、或者散户情绪极端化。',
      emptyMessage: '今天市场情绪比较正常——VIX稳定，没有极端的恐惧或贪婪。',
    },
    news: {
      category: 'news',
      label: '新闻异动',
      emoji: '📰',
      description: '某只股票的新闻热度突然飙升——可能是财报、公告、或者重大事件。',
      emptyMessage: '今天没有股票出现新闻热度异常飙升。',
    },
    macro: {
      category: 'macro',
      label: '宏观异动',
      emoji: '🌍',
      description: '宏观经济数据、政策或地缘事件引发了值得关注的信号。',
      emptyMessage: '今天宏观层面比较平静——没有影响市场的重大数据或事件。',
    },
  },

  // ═══════════════════ 严重度 ═══════════════════

  severities: {
    critical: {
      severity: 'critical',
      label: '严重',
      emoji: '🔴',
      urgency: '建议立即关注',
      recommendation: '这个异动可能对市场或你的持仓产生重大影响。建议打开详情页面，仔细评估是否需要调整仓位。',
    },
    major: {
      severity: 'major',
      label: '重要',
      emoji: '🟠',
      urgency: '今天抽空看看',
      recommendation: '这个异动值得注意，但不一定需要马上操作。把它加入今天的关注列表，收盘前再检查一次。',
    },
    minor: {
      severity: 'minor',
      label: '一般',
      emoji: '🟡',
      urgency: '了解即可',
      recommendation: '这个异动信号较弱，暂时不需要操作。但如果连续出现类似信号，建议回头再看。',
    },
    info: {
      severity: 'info',
      label: '参考',
      emoji: '🔵',
      urgency: '供你参考',
      recommendation: '这不是异动——只是给你补充一些可能有用的信息。你不会因为没看到这个而犯错。',
    },
  },

  // ═══════════════════ 报告主体 ═══════════════════

  report: {
    header: {
      normal: '📋 今日异动报告 — {date}\n\n今天市场比较平静，没有需要特别关注的异动。风平浪静的日子适合复盘和学习。',
      alert: '📋 今日异动报告 — {date}\n\n今天有{total}个异动信号值得关注。以下按严重度排序：',
      weekend: '📋 周末异动回顾 — {date}\n\n市场休市，这是过去一周最值得关注的异动汇总。',
      preMarket: '☕️ 盘前异动速览 — {date}\n\n距开盘还有{minutes}分钟。盘前需要知道的异动：',
    },

    sections: {
      critical: '🔴 严重异动',
      major: '🟠 重要异动',
      minor: '🟡 一般异动',
      info: '🔵 参考信息',
      yourHoldings: '📌 和你持仓相关的异动',
      watchlist: '👀 你关注的股票的异动',
      marketWide: '🌐 市场整体异动',
    },

    emptyStates: {
      allClear: '🎉 今天没有需要关注的异动。偶尔的平静是好事——市场没给你添乱，你可以把时间花在策略研究上。',
      noHoldingsRelated: '今天这些异动不涉及你的持仓——但如果你在考虑新的机会，可以看看。',
      onlyMinor: '今天只有几个一般级别的异动——重要性不高。如果上午比较忙，可以下午抽空瞄一眼。',
    },

    closing: {
      normal: '──\n🐋 鲸灵说：平静的日子不要觉得无聊——不是每一天都需要操作。不操作本身就是最好的操作。\n\n明天见 👋',
      alert: '──\n🐋 鲸灵说：{anomaly_summary}。记得：异动是提醒，不是操作指令。看完、想清楚、再动手。\n\n明天见 👋',
    },
  },

  // ═══════════════════ 推送文案 ═══════════════════

  push: {
    dailyReady: '📋 今日异动报告已生成 — {total}个信号。{critical_count}个严重，{major_count}个重要。',
    criticalAlert: '🔴 严重异动！{company}出现了{type}异动 — {one_liner}',
    majorAlert: '🟠 {company}出现{type}异动 — {one_liner}。建议今天关注。',
    quietDay: '🌤️ 今天市场比较平静 — 没有需要关注的异动。偶尔休息一天也挺好。',
    weeklySummary: '📊 本周异动回顾：共{cnt}个信号，{critical}个严重，最活跃的是{category}类。',
  },
};

// ═══════════════════ 异动条目卡片文案 ═══════════════════

export interface AnomalyCardCopy {
  title: string;
  subtitle: string;
  detail: string;
  suggestion: string;
}

export function generateAnomalyCard(params: {
  company: string;
  ticker: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  anomalyType: string;
  oneLiner: string;
  detail: string;
}): AnomalyCardCopy {
  const cat = ANOMALY_REPORT_COPY.categories[params.category];
  const sev = ANOMALY_REPORT_COPY.severities[params.severity];

  return {
    title: `${sev.emoji} ${params.company} (${params.ticker}) — ${params.anomalyType}`,
    subtitle: `${cat.emoji} ${cat.label} · ${sev.label}`,
    detail: params.oneLiner + '\n\n' + params.detail,
    suggestion: `${sev.recommendation}`,
  };
}

export function generateReportOpening(totalAnomalies: number, hasCritical: boolean, isWeekend: boolean): string {
  if (totalAnomalies === 0) {
    return ANOMALY_REPORT_COPY.report.header.normal;
  }
  if (isWeekend) {
    return ANOMALY_REPORT_COPY.report.header.weekend.replace('{total}', String(totalAnomalies));
  }
  const header = ANOMALY_REPORT_COPY.report.header.alert
    .replace('{total}', String(totalAnomalies));
  if (hasCritical) {
    return header + '\n⚠️ 有严重异动，建议优先查看。';
  }
  return header;
}

export default ANOMALY_REPORT_COPY;
