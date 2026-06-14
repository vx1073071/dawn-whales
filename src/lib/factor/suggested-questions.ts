/**
 * AI Suggested Follow-up Questions — 建议后续问题话术模板
 *
 * 14种AI intent × 3-5个后续问题模板。
 * AI每次回复后自动推荐2-3个可点击的后续问题，引导用户深入探索。
 *
 * 每个模板包含:
 *   - intent: 对应的AI intent类型
 *   - context: 使用时的话语情境
 *   - questions: 3-5个自然语言后续问题 (中文+英文)
 *   - triggerCondition: 何时展示这组问题
 *
 * @module suggested-questions
 * @author QClaw(设计虾)
 * @task R181 P0-06
 */

// ─── 类型定义 ────────────────────────────────────────────

export interface SuggestedQuestions {
  /** 对应的AI intent */
  intent: string;
  /** 使用场景描述 */
  context: string;
  /** 触发条件 */
  triggerCondition: string;
  /** 后续问题列表 (可点击) */
  questions: Array<{
    /** 中文版本 */
    cn: string;
    /** 英文版本 */
    en: string;
    /** 问题类型: deep=深入分析, compare=对比, action=行动, risk=风险, general=通用 */
    type: 'deep' | 'compare' | 'action' | 'risk' | 'general';
  }>;
  /** 分组标签 (AI回复末尾显示) */
  groupLabelCN: string;
}

// ─── 14 Intent 话术模板库 ─────────────────────────────────

export const SUGGESTED_QUESTIONS: Record<string, SuggestedQuestions> = {

  // ═══ 核心策略Intents (9) ════════════════════════════════

  high_growth_low_volatility: {
    intent: 'high_growth_low_volatility',
    context: '用户询问"高成长+低波动"因子组合',
    triggerCondition: 'AI已输出因子推荐列表 + 权重分配',
    groupLabelCN: '🔍 继续深入这个方案',
    questions: [
      {
        cn: '这些因子在过去3个月的表现如何？有没有哪个因子最近失效了？',
        en: 'How have these factors performed in the last 3 months? Has any factor been failing recently?',
        type: 'deep',
      },
      {
        cn: '如果市场突然大跌20%，这个组合会亏多少？帮我做压力测试',
        en: 'If the market drops 20% suddenly, how much would this portfolio lose? Stress test it.',
        type: 'risk',
      },
      {
        cn: '跟纯成长策略对比，加低波动的保护到底值不值？跑个对比看',
        en: 'Compare this with a pure growth strategy—is the low-volatility protection worth it?',
        type: 'compare',
      },
      {
        cn: '帮我把这个方案一键导入到我的策略里，我想看回测效果',
        en: 'Import this plan into my strategy—I want to see backtest results.',
        type: 'action',
      },
      {
        cn: '有没有比动量12M更好的替代因子？比如换个不那么拥挤的',
        en: 'Any better alternatives to 12M momentum? Something less crowded?',
        type: 'deep',
      },
    ],
  },

  value_reversal: {
    intent: 'value_reversal',
    context: '用户询问价值反转/低估值策略',
    triggerCondition: 'AI已输出价值因子推荐',
    groupLabelCN: '💡 关于价值反转',
    questions: [
      {
        cn: '现在是价值回归的时机吗？有什么宏观信号支持价值风格切换？',
        en: 'Is now the time for value to come back? What macro signals support a value rotation?',
        type: 'deep',
      },
      {
        cn: '帮我找5个同时满足"便宜+安全+有催化剂"的股票',
        en: 'Find me 5 stocks that are cheap, safe, AND have a catalyst.',
        type: 'action',
      },
      {
        cn: '这些价值因子会不会是"价值陷阱"？怎么区分真便宜和真垃圾？',
        en: 'Could these value factors be value traps? How to tell genuinely cheap from genuinely bad?',
        type: 'risk',
      },
      {
        cn: '价值策略在当前的加息周期表现如何？历史上有参考吗？',
        en: 'How does value perform in this rate-hike cycle? Any historical reference?',
        type: 'deep',
      },
    ],
  },

  momentum_following: {
    intent: 'momentum_following',
    context: '用户询问动量/趋势跟随策略',
    triggerCondition: 'AI已输出动量因子推荐',
    groupLabelCN: '🚀 动量策略下一步',
    questions: [
      {
        cn: '当前市场的趋势强度怎么样？ADX给的是什么信号？',
        en: 'How strong is the current trend? What is ADX signaling?',
        type: 'deep',
      },
      {
        cn: '如果趋势突然反转，我该怎么快速切换？帮我设计一个"逃生路线"',
        en: 'If the trend suddenly reverses, how do I switch fast? Design an escape route.',
        type: 'risk',
      },
      {
        cn: '帮我把动量策略跟价值策略组合起来——一半追涨、一半抄底',
        en: 'Combine momentum with value—half chasing winners, half bottom-fishing.',
        type: 'action',
      },
      {
        cn: '动量因子最近拥挤吗？我会不会刚好站在"山顶"上？',
        en: 'Is the momentum factor crowded right now? Am I standing at the peak?',
        type: 'risk',
      },
    ],
  },

  quality_defensive: {
    intent: 'quality_defensive',
    context: '用户询问质量/防御策略',
    triggerCondition: 'AI已输出质量因子推荐',
    groupLabelCN: '🛡️ 防御策略深入',
    questions: [
      {
        cn: '在经济衰退预测中，这些质量因子哪个最抗跌？历史回测数据有吗？',
        en: 'In a recession scenario, which quality factor holds up best? Any historical data?',
        type: 'deep',
      },
      {
        cn: '质量策略会不会太保守了？年化收益能跑赢通胀吗？',
        en: "Isn't the quality strategy too conservative? Can it beat inflation?",
        type: 'compare',
      },
      {
        cn: '给我一个"核心(质量)+卫星(动量)"的组合方案',
        en: 'Give me a core-satellite combo: quality as core, momentum as satellite.',
        type: 'action',
      },
      {
        cn: '哪些质量因子在经济复苏时会变得"多余"？我怎么提前切换？',
        en: 'Which quality factors become redundant in recovery? How to switch early?',
        type: 'deep',
      },
    ],
  },

  high_dividend: {
    intent: 'high_dividend',
    context: '用户询问高股息策略',
    triggerCondition: 'AI已输出股息因子推荐',
    groupLabelCN: '💰 股息策略延伸',
    questions: [
      {
        cn: '这些高股息公司有削减分红的记录吗？派息率分别是多少？',
        en: 'Have these high-dividend companies ever cut dividends? What are their payout ratios?',
        type: 'risk',
      },
      {
        cn: '股息策略跟成长策略能不能兼容？有没有"又分红又增长"的因子？',
        en: 'Can dividend and growth strategies coexist? Any factor for "dividends + growth"?',
        type: 'compare',
      },
      {
        cn: '如果利率继续上升，高股息会不会失去吸引力？历史上发生了什么？',
        en: 'If rates keep rising, will high-dividend lose appeal? What happened historically?',
        type: 'deep',
      },
      {
        cn: '帮我把股息策略做成每个季度自动调整权重的方案',
        en: 'Turn this into a quarterly auto-rebalancing dividend portfolio.',
        type: 'action',
      },
    ],
  },

  small_cap_growth: {
    intent: 'small_cap_growth',
    context: '用户询问小盘成长策略',
    triggerCondition: 'AI已输出小盘+成长因子推荐',
    groupLabelCN: '🔬 小盘成长深挖',
    questions: [
      {
        cn: '小盘股在加息周期里通常表现最差——现在的利率环境安全吗？',
        en: 'Small caps usually suffer most in rate hikes—is the current rate environment safe?',
        type: 'risk',
      },
      {
        cn: '帮我加上一个流动性过滤器——只选日均成交>5000万的',
        en: 'Add a liquidity filter—only stocks with daily avg turnover > 50M HKD.',
        type: 'action',
      },
      {
        cn: '这些小盘成长因子和大盘质量因子一起用会打架吗？跑个相关性矩阵',
        en: 'Would these small-cap growth factors conflict with large-cap quality? Run a correlation matrix.',
        type: 'compare',
      },
      {
        cn: '小盘成长在A股、港股、美股的表现差异有多大？帮我分开看',
        en: 'How different is small-cap growth across A-shares, HK, and US? Show me separately.',
        type: 'deep',
      },
    ],
  },

  crypto_trend: {
    intent: 'crypto_trend',
    context: '用户询问加密趋势策略',
    triggerCondition: 'AI已输出加密趋势因子推荐',
    groupLabelCN: '₿ 加密趋势下一步',
    questions: [
      {
        cn: '当前BTC的主导地位(Dominance)在什么水平？山寨季来了吗？',
        en: "What's BTC dominance now? Is altcoin season here?",
        type: 'deep',
      },
      {
        cn: '资金费率现在高不高？如果太高我应该先观望吗？',
        en: 'Is the funding rate high right now? Should I wait if it is?',
        type: 'risk',
      },
      {
        cn: '帮我做一个加密+传统资产的混合组合——加密30%+美股70%',
        en: 'Build me a hybrid: 30% crypto + 70% US equities.',
        type: 'action',
      },
      {
        cn: '交易所的稳定币余额在增加还是减少？"弹药"够不够支撑下一波涨？',
        en: 'Are exchange stablecoin balances rising or falling? Enough ammo for the next leg up?',
        type: 'deep',
      },
      {
        cn: '如果BTC跌到60000，这个策略会怎么样？帮我测几个极端场景',
        en: 'If BTC drops to 60000, what happens to this strategy? Run extreme scenarios.',
        type: 'risk',
      },
    ],
  },

  crypto_mean_reversion: {
    intent: 'crypto_mean_reversion',
    context: '用户询问加密均值回归策略',
    triggerCondition: 'AI已输出加密均值回归因子推荐',
    groupLabelCN: '₿ 均值回归深入',
    questions: [
      {
        cn: '均值回归策略在加密市场会不会"回归到零"？怎么设止损？',
        en: 'Could mean reversion in crypto mean "reverting to zero"? How to set stops?',
        type: 'risk',
      },
      {
        cn: '这个策略在BTC震荡时的成功率是多少？帮我看看最近90天的数据',
        en: "What's the win rate during BTC consolidation? Show me the last 90 days.",
        type: 'deep',
      },
      {
        cn: '跟纯粹的趋势跟随策略比，均值回归能减少多少回撤？',
        en: 'Compared to pure trend-following, how much does mean reversion reduce drawdown?',
        type: 'compare',
      },
      {
        cn: '帮我设好开仓条件：RSI<30且ATR<均值的70%才开仓',
        en: 'Set entry rules: only enter when RSI<30 AND ATR<70% of average.',
        type: 'action',
      },
    ],
  },

  balanced_all_weather: {
    intent: 'balanced_all_weather',
    context: '用户询问全天候/均衡策略',
    triggerCondition: 'AI已输出均衡因子配置',
    groupLabelCN: '⚖️ 全天候策略调优',
    questions: [
      {
        cn: '这个全天候配置在2008、2020、2022三次大熊市里分别表现怎么样？',
        en: 'How did this all-weather allocation perform in the 2008, 2020, and 2022 bear markets?',
        type: 'deep',
      },
      {
        cn: '根据当前宏观环境，帮我微调每个因子的权重——降成长、加质量',
        en: 'Fine-tune weights based on current macro—reduce growth, boost quality.',
        type: 'action',
      },
      {
        cn: '这个组合的夏普比率是多少？跟纯买SPY比哪个更划算？',
        en: "What's the Sharpe ratio? Is it worth it compared to just buying SPY?",
        type: 'compare',
      },
      {
        cn: '每天帮我跑一次健康检查，任何因子偏离>10%自动提醒我',
        en: 'Run daily health check—alert me if any factor deviates >10%.',
        type: 'action',
      },
    ],
  },

  // ═══ 新增高级Intents (3) ════════════════════════════════

  sector_neutral: {
    intent: 'sector_neutral',
    context: '用户询问行业中性策略',
    triggerCondition: 'AI已输出行业中性因子配置',
    groupLabelCN: '🏭 行业中性策略深挖',
    questions: [
      {
        cn: '目前我有多少行业偏离？哪些行业暴露超出了我的预期？',
        en: 'How much sector deviation do I have? Which sectors are over-exposed?',
        type: 'deep',
      },
      {
        cn: '如果科技板块再跌10%，行业中性策略会比行业集中策略少亏多少？',
        en: 'If tech drops another 10%, how much less would a sector-neutral strategy lose?',
        type: 'risk',
      },
      {
        cn: '帮我把所有行业偏离压到±2%以内——给我修改后的权重',
        en: 'Cap all sector deviations at ±2%—show me the adjusted weights.',
        type: 'action',
      },
      {
        cn: '这个行业中性策略在任何市场环境下都有效吗？有没有反例？',
        en: 'Does sector-neutral work in all market conditions? Any counter-examples?',
        type: 'deep',
      },
    ],
  },

  macro_resilient: {
    intent: 'macro_resilient',
    context: '用户询问宏观韧性策略',
    triggerCondition: 'AI已输出宏观韧性因子配置',
    groupLabelCN: '🌍 宏观韧性深挖',
    questions: [
      {
        cn: '目前的宏观压力测试通过了几个场景？哪些场景最危险？',
        en: 'How many macro stress scenarios passed? Which scenarios are most dangerous?',
        type: 'risk',
      },
      {
        cn: '帮我加入通胀、PMI、失业率这三个宏观指标作为动态权重调整的触发器',
        en: 'Add CPI, PMI, unemployment as dynamic weight adjustment triggers.',
        type: 'action',
      },
      {
        cn: '这个策略在滞胀环境下会怎么表现？历史上70年代类似环境参考一下',
        en: 'How would this perform in stagflation? Reference the 1970s.',
        type: 'deep',
      },
      {
        cn: '跟桥水全天候比，我的宏观韧性策略差在哪里？',
        en: 'Compared to Bridgewater All-Weather, where does my macro resilient strategy fall short?',
        type: 'compare',
      },
    ],
  },

  multi_style_rotation: {
    intent: 'multi_style_rotation',
    context: '用户询问多风格轮动策略',
    triggerCondition: 'AI已输出风格轮动配置',
    groupLabelCN: '🔄 风格轮动深化',
    questions: [
      {
        cn: '现在是动量风格好还是价值风格好？给我一个"风格评分卡"',
        en: 'Is momentum or value the better style now? Give me a style scorecard.',
        type: 'deep',
      },
      {
        cn: '风格切换的信号是什么？帮我设置3个"该换风格了"的预警条件',
        en: "What signals a style rotation? Set up 3 alerts for \"time to switch styles.\"",
        type: 'action',
      },
      {
        cn: '过去10年里，这种风格轮动策略有没有失效过？最长连续亏损多久？',
        en: 'Has this style-rotation strategy ever failed in the past 10 years? Longest losing streak?',
        type: 'risk',
      },
      {
        cn: '帮我把风格轮动做成自动化的——每月初根据信号自动切换',
        en: 'Automate the style rotation—auto-switch monthly based on signals.',
        type: 'action',
      },
      {
        cn: '我的风格轮动会不会"左右打脸"？怎么验证我切换的时机是对的？',
        en: 'Am I getting whipsawed? How to verify my rotation timing is correct?',
        type: 'risk',
      },
    ],
  },

  // ═══ 对话模式Intents (5) ════════════════════════════════

  question: {
    intent: 'question',
    context: '用户在问"某个因子/策略是什么"',
    triggerCondition: 'AI已回答了解释性内容',
    groupLabelCN: '🤔 还想了解',
    questions: [
      {
        cn: '这个因子跟我正在用的相比，优劣势在哪？',
        en: 'How does this factor compare to what I am currently using?',
        type: 'compare',
      },
      {
        cn: '有没有更简单的方式解释？用大白话再讲一遍',
        en: 'Can you explain it even simpler? In plain language.',
        type: 'general',
      },
      {
        cn: '这个因子在A股有效吗？港股呢？美股呢？',
        en: 'Does this factor work in A-shares? HK? US?',
        type: 'deep',
      },
      {
        cn: '给我举3个实际案例——哪些股票最符合这个因子的特征？',
        en: 'Give me 3 real examples—which stocks have the strongest signal from this factor?',
        type: 'action',
      },
    ],
  },

  selection: {
    intent: 'selection',
    context: '用户在"选"——从多个选项中选择因子',
    triggerCondition: 'AI已输出对比分析',
    groupLabelCN: '👈 继续筛选',
    questions: [
      {
        cn: '如果我只保留2个因子，你推荐哪两个？为什么？',
        en: 'If I can only keep 2 factors, which 2 would you recommend? Why?',
        type: 'deep',
      },
      {
        cn: '这些因子相关性高吗？会不会"两个变一个"？',
        en: 'Are these factors highly correlated? Am I "buying the same thing twice"?',
        type: 'risk',
      },
      {
        cn: '帮我把选中的因子加上我的资金限制——最大持仓8只，重新算权重',
        en: 'Add my constraints—max 8 positions, recalculate weights.',
        type: 'action',
      },
      {
        cn: '给我这三个因子的"入场时机"——现在进还是等一等？',
        en: 'Give me entry timing for these 3 factors—buy now or wait?',
        type: 'action',
      },
    ],
  },

  answer: {
    intent: 'answer',
    context: '用户在"答"——AI给出直接答案',
    triggerCondition: 'AI已给出确切结论',
    groupLabelCN: '📋 验证这个结论',
    questions: [
      {
        cn: '这个结论的置信度有多高？哪些假设如果不成立结论会推翻？',
        en: 'How confident is this conclusion? Which assumptions would invalidate it?',
        type: 'deep',
      },
      {
        cn: '有没有"反方观点"？如果我是空头我会怎么反驳这个结论？',
        en: "Any counter-arguments? If I were short, how would I attack this conclusion?",
        type: 'deep',
      },
      {
        cn: '帮我把这个结论转化成可执行的操作——具体买什么、买多少、什么时候买？',
        en: 'Turn this conclusion into executable steps—what to buy, how much, when?',
        type: 'action',
      },
      {
        cn: '历史上有哪些类似情况？结果怎么样了？',
        en: 'Any historical precedents? How did those turn out?',
        type: 'deep',
      },
    ],
  },

  skeptic: {
    intent: 'skeptic',
    context: '用户在"疑"——质疑已有策略',
    triggerCondition: 'AI已输出反方分析',
    groupLabelCN: '🔍 继续较真',
    questions: [
      {
        cn: '除了你指出的问题，还有没有其他隐藏的风险？',
        en: 'Besides what you pointed out, any other hidden risks?',
        type: 'risk',
      },
      {
        cn: '如果我完全反着做（把多头改成空头），这个策略表现如何？',
        en: 'If I did the exact opposite (long → short), how would this strategy perform?',
        type: 'deep',
      },
      {
        cn: '在什么极端情况下这个策略仍然能赚钱，什么情况下会彻底失效？',
        en: 'Under what extreme conditions would this strategy still make money vs completely fail?',
        type: 'risk',
      },
      {
        cn: '给我设计一个更好的替代方案，哪怕是完全不同类型的策略',
        en: 'Design a better alternative—even if it means a totally different kind of strategy.',
        type: 'action',
      },
      {
        cn: '把这个策略丢给"魔鬼代言人"——帮我找出所有可能出问题的地方',
        en: "Run this through the devil's advocate—find every possible failure point.",
        type: 'risk',
      },
    ],
  },

  deep_analysis: {
    intent: 'deep_analysis',
    context: '用户在"深度分析"——多角度深度分析',
    triggerCondition: 'AI已输出多维度分析报告',
    groupLabelCN: '🔬 更深一层',
    questions: [
      {
        cn: '帮我分市场看——美股、港股、A股分别是什么结论？哪里是不一样的？',
        en: 'Break it down by market—US, HK, A-shares separately. Where do they differ?',
        type: 'deep',
      },
      {
        cn: '用不同时间窗口再分析一遍——5年、3年、1年、3个月——趋势在变吗？',
        en: 'Re-analyze with different time windows—5Y, 3Y, 1Y, 3M. Is the trend shifting?',
        type: 'deep',
      },
      {
        cn: '把这些因子表现跟我的实际投资记录对比一下——我的决策偏差在哪？',
        en: 'Compare these factor returns to my actual investing record—where do I deviate?',
        type: 'compare',
      },
      {
        cn: '加入行为金融学的角度——当前市场的"情绪"有没有导致因子定价错误？',
        en: 'Add a behavioral finance lens—is market emotion causing factor mispricing?',
        type: 'deep',
      },
    ],
  },

  unknown: {
    intent: 'unknown',
    context: 'AI无法确定用户意图',
    triggerCondition: 'AI需要引导用户明确需求',
    groupLabelCN: '💬 你可以试试这些问题',
    questions: [
      {
        cn: '帮我的持仓做个"体检"——哪些因子暴露过高了，哪些缺失了',
        en: 'Give my portfolio a "health check"—which factor exposures are too high, which are missing?',
        type: 'action',
      },
      {
        cn: '当前市场最适合什么类型的因子策略？',
        en: 'What type of factor strategy suits the current market best?',
        type: 'general',
      },
      {
        cn: '我现在的策略最大回撤太深了，有没有办法在不牺牲太多收益的情况下降低波动？',
        en: 'My strategy has too deep drawdowns—how to reduce volatility without sacrificing too much return?',
        type: 'risk',
      },
      {
        cn: '随便给我推荐几个今天值得关注的因子信号',
        en: 'Show me a few factor signals worth watching today.',
        type: 'general',
      },
      {
        cn: '帮我对比价值、动量、质量三大风格，当前谁最强？',
        en: 'Compare value, momentum, and quality styles—which is strongest now?',
        type: 'compare',
      },
    ],
  },
};

// ─── 辅助函数 ──────────────────────────────────────────────

/**
 * 根据intent获取建议的后续问题列表
 * 每次返回2-3个，优先deep和action类型，穿插1个risk
 */
export function getSuggestedQuestions(intent: string, count: number = 3): SuggestedQuestions['questions'] {
  const entry = SUGGESTED_QUESTIONS[intent];
  if (!entry) {
    // Fallback to unknown
    return SUGGESTED_QUESTIONS['unknown'].questions.slice(0, count);
  }

  const questions = entry.questions;

  // Prioritize: 1 deep, 1 action, 1 risk (if available)
  const selected: SuggestedQuestions['questions'] = [];

  const deep = questions.find(q => q.type === 'deep');
  if (deep) selected.push(deep);

  const action = questions.find(q => q.type === 'action' && q !== deep);
  if (action) selected.push(action);

  const remaining = count - selected.length;
  if (remaining > 0) {
    const rest = questions.filter(q => !selected.includes(q)).slice(0, remaining);
    selected.push(...rest);
  }

  return selected.slice(0, count);
}

/**
 * 获取完整的问题组（含元数据）
 */
export function getSuggestedQuestionsGroup(intent: string): SuggestedQuestions | undefined {
  return SUGGESTED_QUESTIONS[intent] || SUGGESTED_QUESTIONS['unknown'];
}

/**
 * 获取所有支持的intent列表
 */
export function getAllIntents(): string[] {
  return Object.keys(SUGGESTED_QUESTIONS);
}
