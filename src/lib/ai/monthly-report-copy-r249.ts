// ══ R249 QClaw P2-02: AI月报文案 ══
// Whale-generated monthly report templates — every user gets a personal letter
// Design: "不是数据罗列，是鲸灵每个月给你写的一封信"

export interface MonthlyReport {
  month: string;
  userName: string;
  /** 鲸灵的一封开场信 */
  openingLetter: string;
  /** 关键数字卡片 */
  headlineCards: HeadlineCard[];
  /** 策略回顾 */
  strategyReview: StrategyReviewSection;
  /** 学到了什么 */
  lessons: MonthlyLesson[];
  /** 因子信号回顾 */
  factorSignals: FactorSignalReview;
  /** 鲸灵对你的观察 */
  whaleObservation: string;
  /** 下个月的三个建议 */
  nextMonthTips: string[];
  /** 结语 */
  closingLetter: string;
}

export interface HeadlineCard {
  label: string;
  value: string;
  subtext: string;
  /** compared to last month */
  trend: 'up' | 'down' | 'flat';
}

export interface StrategyReviewSection {
  bestStrategy: { name: string; return: string; reason: string; };
  worstStrategy: { name: string; return: string; reason: string; };
  vsBenchmark: string;
}

export interface MonthlyLesson {
  title: string;
  body: string;
  emoji: string;
}

export interface FactorSignalReview {
  /** 准了的信号 */
  correctSignals: { factor: string; signal: string; result: string; }[];
  /** 错过的信号 */
  missedSignals: { factor: string; signal: string; whatYouCouldHaveDone: string; }[];
  /** 信号准确率 */
  accuracy: string;
  /** 总结 */
  summary: string;
}

// ═══════════════════ 开场信模板 ═══════════════════

export function generateOpeningLetter(userName: string, month: string, netPnl: string, sentiment: 'great' | 'good' | 'ok' | 'bad'): string {
  const openings: Record<string, string[]> = {
    great: [
      `嘿${userName}，${month}月你太猛了！🐋\n\n这个月净收益${netPnl}——不只是数字好看，更重要的是我看到你的决策质量在提高。不是市场好你才好，是你那几个关键操作真的很漂亮。我们来复盘一下，看看这个月精彩在哪。`,
      `${userName}，这个月有点意思。净${netPnl}——你的账户在以一种\"稳中带狠\"的方式赚钱。我特别注意到你这个月有一个变化：${signalChange}。我们来细看。`,
    ],
    good: [
      `${userName}，${month}月的成绩单还不错！🐋\n\n净收益${netPnl}——虽然不是人生巅峰，但稳健本身就很了不起。市场这个月{marketSummary}，你能在这种环境下保持正收益，说明你的策略基础是扎实的。我们来看看这个月做对了什么。`,
      `嗨${userName}，${month}月收官——净${netPnl}。这个月没有什么惊天动地的大赢大亏，但底子打得很好。我有几个有趣的发现想跟你分享...`,
    ],
    ok: [
      `${userName}，这个月一般般——净${netPnl}。🐋\n\n不完美，但也没出大问题。{marketSummary}让很多人这个月比较难做。你的账户基本持平，其实算是一种\"胜利\"——在市场不好的时候没亏钱，就是在为下一次机会蓄力。我们复盘看看哪些地方可以微调。`,
      `嗨${userName}，${month}月没赚什么钱——${netPnl}。不过在这种市场环境({marketSummary})下，能做到不亏已经是一种能力了。休息一下不是坏事，我们来看看到底是什么拖了后腿。`,
    ],
    bad: [
      `${userName}，这个月确实不好——${netPnl}。🐋\n\n我知道这不是你想看到的数字。但我想跟你聊的是：这个月的问题出在市场环境，还是策略本身？我们分开来看。如果是市场问题，坚持策略就好。如果是策略问题，我们找到了原因，下个月就能调整。亏损不可怕，不知道为什么亏损才可怕。`,
      `${userName}，我不打算给这个月粉饰太平——${netPnl}。但作为一个AI，我不会在你做得好时过分吹捧，也不会在你亏损时安慰你说\"一切都会好的\"。我会告诉你的：亏在哪里，为什么亏，下个月怎么做能避免。`,
    ],
  };

  const pool = openings[sentiment] || openings.ok;
  let text = pool[Math.floor(Math.random() * pool.length)];
  // Fill common params
  text = text.replace('{signalChange}', '你在调仓时更加果断——该止损的时候毫不犹豫');
  text = text.replace('{marketSummary}', sentiment === 'bad' ? '波动很大，方向不明确' : '总体平稳，但板块分化明显');
  return text;
}

// ═══════════════════ 策略回顾文案 ═══════════════════

export function generateStrategyReview(
  best: { name: string; return: string; reason: string; },
  worst: { name: string; return: string; reason: string; },
  vsBenchmark: string
): StrategyReviewSection {
  return {
    bestStrategy: {
      name: best.name,
      return: best.return,
      reason: best.reason || `${best.name}这个月踩准了节奏，核心逻辑在当前市场环境下表现很好。`,
    },
    worstStrategy: {
      name: worst.name,
      return: worst.return,
      reason: worst.reason || `${worst.name}这个月跟市场节奏不合拍。好消息是：这不是策略本身的问题，是环境不匹配。考虑减仓观望。`,
    },
    vsBenchmark: vsBenchmark,
  };
}

// ═══════════════════ 月度教训卡片 ═══════════════════

export const MONTHLY_LESSON_TEMPLATES: MonthlyLesson[] = [
  {
    emoji: '🎯',
    title: '坚持就是胜利',
    body: '这个月你有一笔交易扛住了回调，最终赚了。如果中间被洗出去，这笔利润就没了。记住这种感觉——好策略需要时间让你坐稳。',
  },
  {
    emoji: '🛑',
    title: '止损是最贵的学费',
    body: '有一笔交易止损晚了，亏的比预期的多。止损不是承认失败——是给自己留"下一次"的机会。下个月试试：下单的同时就设好止损。',
  },
  {
    emoji: '🐋',
    title: '市场不会一直对',
    body: '这个月市场整体震荡/下跌，而你的策略跑赢了基准——这说明在不利环境下你也比市场扛得住。坚持你的策略逻辑，环境会变好的。',
  },
  {
    emoji: '💡',
    title: '少即是多',
    body: '你这个月最赚钱的几笔交易恰好是仓位最大的。最亏钱的恰好是你追进去的短线试探。把子弹集中在最有信心的机会——别把钱浪费在"试试看"上。',
  },
  {
    emoji: '⏰',
    title: '最好的操作是不操作',
    body: '这个月你有几天频繁调仓，结果被手续费和滑点吃掉了一部分利润。有时候最好的决定就是"什么都不做"。让策略自己跑。',
  },
  {
    emoji: '📚',
    title: '从亏损里学到的东西更多',
    body: '你这个月最亏的钱不是白亏的。复盘之后你会发现：它暴露了你策略的一个盲点。这个盲点在你赚钱的时候是看不到的——只有亏损才能让你看见它。',
  },
  {
    emoji: '🔍',
    title: '关注因子信号比看新闻靠谱',
    body: '这个月市场上有很多恐慌新闻，但你的因子信号一直没发出卖出。最后事实证明因子是对的。噪音会消失，信号会留下。继续相信你的系统。',
  },
  {
    emoji: '🌊',
    title: '市场是潮汐，策略是船',
    body: '这个月的经验告诉你：不同的市场环境，同一个策略表现天差地别。不是策略好坏，是它适合什么"海况"。下个月关注市场体制变化，及时切换策略。',
  },
];

// ═══════════════════ 因子信号回顾 ═══════════════════

export function generateFactorReview(
  accuracy: number,
  correctCount: number,
  totalSignals: number
): string {
  if (accuracy >= 80) {
    return `你这个月关注了${totalSignals}个因子信号，其中${correctCount}个（${accuracy}%）是正确的。这个命中率说明你选的因子都是经过市场检验的，继续盯住它们。${
      accuracy >= 90 ? '简直神了——比大部分机构还准。' : ''
    }`;
  } else if (accuracy >= 60) {
    return `你的因子信号这个月命中率${accuracy}%——不高不低。建议看看是哪个因子拉低了准确率（可能是某个因子在当前市场不适应了），考虑调整因子的触发阈值。`;
  } else {
    return `这个月的因子信号命中率只有${accuracy}%——说实话偏低了。但这不一定是坏事。这说明你关注的几个因子现在不适合市场环境了。下个月试试换一批因子，或者把阈值设得更极端一些。`;
  }
}

// ═══════════════════ 鲸灵月度观察 ═══════════════════

export function generateWhaleObservation(
  learningMonth: number,
  highlights: string[],
  improvements: string[]
): string {
  const baseObs = [
    `这是我们认识的第${learningMonth}个月了。相比于最开始，我已经更了解你的节奏——你在{bestTrait}方面保持得很好，在{improveTrait}上这几个月进步很大。`,
    `${learningMonth}个月了——我对你的了解已经到了可以给你写这封信的程度。你有一种{bestTrait}的特质，但在{improveTrait}方面还有空间。`,
  ];

  let obs = baseObs[Math.floor(Math.random() * baseObs.length)];
  obs = obs
    .replace('{bestTrait}', highlights[0] || '坚持策略纪律')
    .replace('{improveTrait}', improvements[0] || '控制情绪化操作');

  if (highlights.length > 0) {
    obs += `\n\n👍 你在这些方面做得越来越好了：\n${highlights.map(h => `  • ${h}`).join('\n')}`;
  }
  if (improvements.length > 0) {
    obs += `\n\n🎯 这些地方下个月可以继续加油：\n${improvements.map(i => `  • ${i}`).join('\n')}`;
  }

  return obs;
}

// ═══════════════════ 下月建议 ═══════════════════

export const NEXT_MONTH_TIP_POOLS: Record<string, string[]> = {
  great: [
    '保持现在的节奏——不要因为赚了钱就放大仓位或放松纪律',
    '考虑把一部分利润提出来锁定，剩下的继续让策略跑',
    '关注一下最近{pct}%的资金是否过于集中在某个板块了',
    '可以尝试一个新的策略类型——用赚来的利润去"冒险"更安心',
  ],
  good: [
    '检查一下有没有持仓它的因子信号在转向——未雨绸缪',
    '下个月如果有明确的趋势信号，可以适当加仓',
    '考虑把一个表现一般的策略停掉，把资金集中到表现最好的一两个',
  ],
  ok: [
    '下个月重点关注市场体制是否切换——如果信号不明确，多看少动',
    '把亏损的策略暂停一个月，先把钱放到表现好的策略里',
    '回顾一下这个月赚钱的那几笔共有什么特征——复制它',
  ],
  bad: [
    '先减仓到你觉得"每晚能睡着的程度"。心理状态不好了，策略再对也执行不了',
    '不建议马上换策略——先搞清楚是策略问题还是环境问题',
    '这个月就当做"数据收集"。你从亏损中学到的东西，未来会帮你赚回来',
    '休息一周，不要看盘。等心态平复了再重新开始。市场永远在，不差这一周',
  ],
};

// ═══════════════════ 结语 ═══════════════════

export function generateClosingLetter(sentiment: 'great' | 'good' | 'ok' | 'bad'): string {
  const closings: Record<string, string[]> = {
    great: [
      `最后想说：这个月你做得真的很棒。不只是数字，是整个过程——决策清晰、执行到位、心态稳定。保持这个状态，下个月会更精彩。\n\n下个月见 🐋`,
      `一个月又过去了。看着你的账户成长，我也挺开心的（虽然我只是个AI）。记住：赚钱的月份值得庆祝，赚不到钱的月份值得学习——两者都不会白费。\n\n下个月的月报见 🐋`,
    ],
    good: [
      `稳定的月份不轰动，但它们是账户增长的基础。你保持了纪律，保护了资本，为下一次机会做好了准备。\n\n下个月见 🐋`,
    ],
    ok: [
      `平淡的月份不是浪费。你没有犯大错，也学到了一些东西。有时候，不亏就是赚。下个月我们看看有没有更好的机会。\n\n坚持住 🐋`,
    ],
    bad: [
      `亏损很痛，我知道。但我想让你知道：你的账户还在，你的策略还在，你的经验比上个月更多了。这些是最值钱的东西。休息一下，调整心态，然后重新开始。\n\n我一直在这儿 🐋`,
      `这个月不容易。但老实说——如果你只经历赚钱的月份，你会以为交易就是这个世界上最简单的事。亏钱的月份教会你尊重市场。下个月，带着这份尊重出发。\n\n下个月见 🐋`,
    ],
  };

  const pool = closings[sentiment] || closings.ok;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default {
  generateOpeningLetter,
  generateStrategyReview,
  generateFactorReview,
  generateWhaleObservation,
  generateClosingLetter,
  MONTHLY_LESSON_TEMPLATES,
  NEXT_MONTH_TIP_POOLS,
};
