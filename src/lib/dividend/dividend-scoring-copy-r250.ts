// ══ R250 QClaw P2-17: 股息评分文案 ══
// Dividend safety scoring copy — A-F grades, yield brackets, warnings
// Design: "股息不是越高越好——帮你分辨安全派息和陷阱"

export type DividendGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type YieldBracket = 'low' | 'moderate' | 'high' | 'extreme' | 'none';

export interface DividendGradeCopy {
  grade: DividendGrade;
  label: string;
  emoji: string;
  description: string;
  color: string;
  suitability: string;
  warning?: string;
}

export interface YieldBracketCopy {
  bracket: YieldBracket;
  range: string;
  label: string;
  assessment: string;
  whatItMeans: string;
}

export interface DividendScoringCopy {
  grades: Record<DividendGrade, DividendGradeCopy>;
  yieldBrackets: Record<YieldBracket, YieldBracketCopy>;
  scoreFactors: { label: string; weight: string; description: string; }[];
  push: Record<string, string>;
  comparison: Record<string, string>;
}

export const DIVIDEND_SCORING_COPY: DividendScoringCopy = {
  // ═══════════════════ A-F 安全评分 ═══════════════════

  grades: {
    A: {
      grade: 'A',
      label: '非常安全',
      emoji: '🛡️',
      description: '这家公司派息极其稳健。连续多年提高股息，盈利充分覆盖，负债低。如果它在你的组合里，你完全可以安心持有。',
      color: '#22c55e',
      suitability: '适合：追求稳定现金流的长期投资者。这种股票的股息几乎等同于定期收租。',
    },
    B: {
      grade: 'B',
      label: '安全',
      emoji: '✅',
      description: '股息比较稳健，基本面良好。派息率合理，盈利能覆盖，没有明显的危险信号。虽然不是最顶级的"股息贵族"，但也足够让人放心。',
      color: '#84cc16',
      suitability: '适合：想把"收租"和"成长"结合起来的投资者。B级股票通常既有不错的股息，也有一定增长潜力。',
    },
    C: {
      grade: 'C',
      label: '一般',
      emoji: '⚠️',
      description: '股息还可以，但有几个小问题需要注意。可能派息率偏高，或者盈利不稳定，或者最近几年有过降息记录。可以持有，但要盯住。',
      color: '#f59e0b',
      suitability: '适合：愿意承担一点风险换取更高股息率的投资者。建议不要让它占组合太大比例。',
      warning: '每隔几个月要看一下：派息率有没有继续上升？盈利有没有继续恶化？',
    },
    D: {
      grade: 'D',
      label: '有风险',
      emoji: '🔴',
      description: '这份股息有较大风险。可能派息率超过90%、自由现金流不够、或者公司基本面在恶化。现在的股息率看起来很诱人，但可能不长久。',
      color: '#f97316',
      suitability: '不建议作为核心收息仓位。如果你真的要拿，做好最坏的打算：公司可能在未来一年内削减或暂停派息。',
      warning: '⚠️ 高股息率 ≠ 好投资。有时候高股息率是因为股价跌了，而股息还没来得及砍——这是陷阱，不是机会。',
    },
    F: {
      grade: 'F',
      label: '高危',
      emoji: '🚨',
      description: '这份股息极不可靠。可能是用借来的钱派息，可能盈利完全不够，或者公司已经在财务困境中了。不要把希望寄托在这份股息上。',
      color: '#ef4444',
      suitability: '如果你想拿股息——找别的公司。这个股息大概率不可持续。',
      warning: '🚨 注意：股息率超过10%通常意味着市场认为这份股息快被砍了。不是"高收益"，是"高风险"。',
    },
  },

  // ═══════════════════ 股息率区间 ═══════════════════

  yieldBrackets: {
    none: {
      bracket: 'none',
      range: '0%',
      label: '不分红',
      assessment: '这家公司不派息。不一定是坏事——可能公司在用利润再投资来获得更高增长。成长型公司通常不分红。',
      whatItMeans: '如果你的目标是现金流收入，这类股票不适合。如果你的目标是资产增值，不分红的成长股可能是对的。',
    },
    low: {
      bracket: 'low',
      range: '<2%',
      label: '低股息',
      assessment: '股息率偏低。通常是大盘成长型或科技公司的特征。股息虽然不高，但通常搭配可观的股价增长。',
      whatItMeans: '如果你看重总回报（股息+股价增长），低股息股票如果公司成长性好，完全可以。如果公司不成长也不分红——可能要考虑换一个。',
    },
    moderate: {
      bracket: 'moderate',
      range: '2-4%',
      label: '适中股息',
      assessment: '这个股息率刚刚好——既能提供有意义的现金回报，又通常不会影响公司再投资能力。是"收租+成长"的甜蜜点。',
      whatItMeans: '2-4%是成熟市场的"正常"股息率。如果公司的派息安全评分也是A/B，这是最理想的收息标的。',
    },
    high: {
      bracket: 'high',
      range: '4-7%',
      label: '高股息',
      assessment: '股息率偏高。如果搭配A/B级安全评分——这是"股息宝藏"。如果搭配C级或更低——你要多问一个为什么。',
      whatItMeans: '高股息有两种：一种是好公司暂时被低估了（机会），一种是问题公司股价跌到股息看起来很高（陷阱）。安全评分帮你分辨是哪一种。',
    },
    extreme: {
      bracket: 'extreme',
      range: '>7%',
      label: '极高股息',
      assessment: '股息率非常高。请立刻检查安全评分：如果安全评分为A/B → 超级机会。如果为D/F → 大概率陷阱。',
      whatItMeans: '记住：7%以上的股息率要么是千载难逢的好机会，要么是市场在告诉你"这个股息快完了"。安全评分会告诉你答案。',
    },
  },

  // ═══════════════════ 评分因子 ═══════════════════

  scoreFactors: [
    {
      label: '派息率',
      weight: '30%',
      description: '公司把多少利润用来分红。低于60%是健康的——留了足够的钱做业务。超过80%是红色信号。',
    },
    {
      label: '自由现金流覆盖',
      weight: '25%',
      description: '公司实打实赚到的现金够不够付股息。利润可以做账，现金做不了账。这是最诚实的指标。',
    },
    {
      label: '派息连续性',
      weight: '20%',
      description: '公司是否连续多年派息且不断提高。连续10年以上提高股息的公司，通常非常重视"股息贵族"的荣誉，不会轻易砍。',
    },
    {
      label: '负债水平',
      weight: '15%',
      description: '债务太高的话，公司在困难时期会优先还债而不是派息。负债/EBITDA < 3x 是健康的。',
    },
    {
      label: '盈利稳定性',
      weight: '10%',
      description: '过去5年的盈利波动。盈利大起大落的公司很难维持稳定的股息——今年赚得多可能分得多，明年亏了可能就砍了。',
    },
  ],

  // ═══════════════════ 推送文案 ═══════════════════

  push: {
    exDividendReminder: '📅 {company}将在{days}天后除息。在{ex_date}之前买入，你就能拿到{next_dividend}/股的股息。年化股息率{yield}%。',
    dividendAnnouncement: '{company}宣布每股派息{amount}，与上次相比{change}。按当前股价，年化率{yield}%。安全评级{grade}。',
    dividendCut: '⚠️ {company}削减了股息！从{old}/股降到{new}/股，降幅{cut_pct}%。这是近{recent_years}年来首次削减。建议重新评估这只股票的收息定位。',
    dividendIncrease: '✅ {company}提高了股息！从{old}/股涨到{new}/股，涨幅{increase_pct}%。这是连续第{consecutive}年提高股息了。股息贵族名副其实。',
    yieldAlert: '📊 有个股息异动：{company}的股息率达到了{yield}%，vs历史平均{avg_yield}%。{assessment}。安全评分{grade}。',
  },

  // ═══════════════════ 对比文案 ═══════════════════

  comparison: {
    vsSector: '和同行业{sector}的平均股息率{sector_avg}%比，{company}的{yield}%{better_or_worse}。',
    vsTreasury: 'vs 美国10年期国债({treasury}%)：{company}的股息率{yield}%{more_or_less}。别忘了股票股息还要考虑股价波动风险。',
    vsPeers: '和同类派息股票比：{company}的安全评分{grade}，行业平均{avg_grade}。{comparison_summary}。',
    history: '过去5年，{company}的股息率平均为{avg_yield}%，最高{max_yield}%，最低{min_yield}%。当前{yield}%处于{percentile}水平。',
  },
};

// ═══════════════════ 工具函数 ═══════════════════

export function getDividendGradeCopy(grade: DividendGrade): DividendGradeCopy {
  return DIVIDEND_SCORING_COPY.grades[grade];
}

export function getYieldBracketCopy(yieldPct: number): YieldBracketCopy {
  if (yieldPct === 0) return DIVIDEND_SCORING_COPY.yieldBrackets.none;
  if (yieldPct < 2) return DIVIDEND_SCORING_COPY.yieldBrackets.low;
  if (yieldPct < 4) return DIVIDEND_SCORING_COPY.yieldBrackets.moderate;
  if (yieldPct < 7) return DIVIDEND_SCORING_COPY.yieldBrackets.high;
  return DIVIDEND_SCORING_COPY.yieldBrackets.extreme;
}

export function generateDividendSafetyOneLiner(grade: DividendGrade, yieldPct: number): string {
  const g = getDividendGradeCopy(grade);
  const yb = getYieldBracketCopy(yieldPct);

  if (grade === 'A' || grade === 'B') {
    if (yieldPct >= 4) return `${g.emoji} ${g.label} — ${yb.label}股息，质量很高。这个股息率+这个安全度不多见。`;
    return `${g.emoji} ${g.label} — 股息率${yieldPct}%，安全可靠。长期持有的好选择。`;
  }
  if (grade === 'C') {
    return `${g.emoji} ${g.label} — 股息率${yieldPct}%还不错，但有几点需要留意。`;
  }
  if (grade === 'D') {
    if (yieldPct >= 7) return `${g.emoji} ${g.label} — ${yb.label}股息看起来很诱人，但${g.warning?.split('。')[0] || '可能不长久'}。`;
    return `${g.emoji} ${g.label} — 股息可能不太稳，建议深入查看。`;
  }
  return `${g.emoji} ${g.label} — ${g.warning?.split('。')[0] || '不建议作为收息标的'}。`;
}

export default DIVIDEND_SCORING_COPY;
