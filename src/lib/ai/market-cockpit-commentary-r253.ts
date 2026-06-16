// ══ R253 QClaw AI-01: AI快评文案 — 5种市场状态 ══
// AI Quick Commentary for the Market Cockpit
// Design: "不是一堆数字——是AI帮你翻译今天发生了什么、应该关注什么"

export type MarketState = 'NORMAL_BULL' | 'NEUTRAL' | 'NORMAL_BEAR' | 'PANIC' | 'EUPHORIA';

export interface QuickCommentary {
  stateId: MarketState;
  stateName: string;
  stateEmoji: string;
  oneLiner: string;
  whatHappened: string;
  whatItMeans: string;
  whatToWatch: string;
  whisperTip: string;
  triggerThresholds: Record<string, string>;
}

export const MARKET_QUICK_COMMENTARIES: QuickCommentary[] = [
  {
    stateId: 'NORMAL_BULL',
    stateName: '温和上涨',
    stateEmoji: '🌤️',
    oneLiner: '风和日丽的一天。继续按计划来。',
    whatHappened: `今天大盘温和上涨，涨幅在0.3%-1%之间。多数板块飘红，成交量正常。
这不是"暴涨"——是安静的、健康的上涨。市场在一步一步往上走。
VIX在15-20之间，情绪不恐慌也不狂热。`,
    whatItMeans: `这是"让策略自然运行"的市场环境。
你的趋势策略今天大概率在赚钱（如果它持有涨得好的股票）。
你的价值策略今天可能在微涨或走平。
你的低波动策略今天可能波动很小。

一句话：正常天。不需要做任何特别的事情。`,
    whatToWatch: `1. 涨幅大头是集中在某几个板块，还是广泛分布？——集中=热度高但脆弱；广泛=上涨有质量
2. 成交量有没有放大？——温和上涨+温和放量=健康；温和上涨+缩量=动力不足
3. 你的持仓有没有某只突然跳涨/跳跌？——如果没有，今天可以直接跳过盯盘`,
    whisperTip: '今天最危险的事：因为"今天涨了"而觉得"明天也会涨"，然后加仓。明天不一定涨——明天可能回调。策略的规则不会因为今天涨了而改变。',
    triggerThresholds: {
      '大盘涨幅': '0.3%-1%',
      'VIX': '15-20',
      '成交量': '正常(偏离日均±20%以内)',
      '板块分布': '>60%板块上涨',
    },
  },
  {
    stateId: 'NEUTRAL',
    stateName: '横盘震荡',
    stateEmoji: '🌥️',
    oneLiner: '市场在"想一会儿"。你也休息一会儿。',
    whatHappened: `今天市场横盘震荡，涨跌幅度在±0.3%以内。没有明确方向。
成交量偏小——市场参与者在观望，等一个"理由"来打破平衡。
VIX在15-20，波动率偏低的区间。

很多股票今天走出了一个"无聊"的十字星。`,
    whatItMeans: `这是趋势策略最难熬的日子——没有方向=没有信号。
这是震荡策略最喜欢的日子——Rsi在中间游走，布林带收窄。
如果你有趋势策略：今天你的策略大概率在"等"——不要逼它行动。
如果你有震荡策略：今天可能会有交易信号。

但要注意：横盘不会永远继续。窄幅震荡之后，通常会有一个较大的突破。方向？不知道。`,
    whatToWatch: `1. 布林带宽度是否在收窄？——收得越窄，接下来的突破越大
2. 哪几个重要支撑/阻力位在附近？——突破这些位置可能就是方向的答案
3. 成交量极度缩量的话——注意：缩量横盘往往意味着"暴风雨前的宁静"

本周如果连续3天以上横盘→周五或下周一大概率出方向。`,
    whisperTip: '横盘是最容易"手痒"的时刻。你会想"再不动就来不及了"然后随便买点什么。但这正是你亏钱最多的地方——在没方向的行情里，任何方向都是猜。休息也是一种策略。',
    triggerThresholds: {
      '大盘涨幅': '±0.3%以内',
      'VIX': '15-20',
      '成交量': '偏小(低于日均20%+)',
      '板块分布': '涨跌各半',
    },
  },
  {
    stateId: 'NORMAL_BEAR',
    stateName: '正常回调',
    stateEmoji: '🌧️',
    oneLiner: '跌了。但这可能是"健康的下跌"。检查持仓，不要慌。',
    whatHappened: `今天大盘下跌0.5%-2%。板块分布上跌多涨少。
成交量正常或略有放大，但没有任何恐慌性抛售的迹象。
VIX在20-28之间——反映了市场的谨慎情绪，但没有恐慌。

这是个"正常回调"——不是熊市，不是崩盘，就是市场"喘了一口气"。`,
    whatItMeans: `对于你的策略：
- 趋势策略：可能在亏钱——这是正常的。趋势策略在回调中亏钱➝回调结束后继续赚钱。
- 价值策略：今天可能表现不错——因为跌了的股票更"便宜"了。
- 质量策略：今天可能是相对强势——质量股通常在跌市中跌得少。

关键判断：这是不是"你的策略应该经历的回撤"？如果是——坚持。如果不是（比如跌得远超历史最大回撤）——关掉。`,
    whatToWatch: `1. 你的持仓有没有触及止损线？——如果触及→执行止损，不要犹豫
2. 下跌是"全面跌"还是"某几个板块带动的集中下跌"？——集中下跌比全面跌更容易恢复
3. VIX在上升吗？——如果快速上升到28+→回调可能升级

最重要的：回调是你的策略展示"真韧性"的时刻。好策略的回撤之后应该有恢复。`,
    whisperTip: '回调时最想做的事：看盘。最不该做的事：盯盘。每一次刷新都在消耗你的情绪。设好止损线，关掉屏幕。你的策略不需要你在旁边看着它运行。',
    triggerThresholds: {
      '大盘跌幅': '0.5%-2%',
      'VIX': '20-28',
      '成交量': '正常或略放大',
      '板块分布': '跌多涨少',
    },
  },
  {
    stateId: 'PANIC',
    stateName: '恐慌抛售',
    stateEmoji: '⛈️',
    oneLiner: '恐慌来了。深呼吸——你在最该冷静的时候看到了这条消息。',
    whatHappened: `今天大盘暴跌超过2%，部分板块跌幅超过4%。
VIX跳升至30以上——这是恐慌的信号。成交量急剧放大——人们在不计成本地卖。
新闻头条全是利空——这是恐慌日最典型的环境。

过去30年里，像今天这样的交易日占比不到5%。
这不是"正常回调"，这是市场情绪崩溃——但注意：崩溃的另一面是机会。`,
    whatItMeans: `这是对量化策略真正考验的日子：
- 动量策略：大概率在暴跌——因为它在持有"过去涨得好的股票"，而今天是全面杀跌
- 低波动策略：今天会展现出真正的价值——它跌得最少
- 价值策略：可能也在跌——不要把"便宜"当成"防盗"
- 逆向策略：今天可能会有买入信号——如果信号告诉你买，你执行吗？

恐慌中最难的不是判断方向——是执行你的策略。`,
    whatToWatch: `1. VIX在暴涨还是在回落？——VIX冲高后回落=恐慌可能已到顶
2. Put/Call比率在飙升吗？——极度看空=反向指标：当所有人都买了保险，灾难反而不太会来了
3. 哪类资产在相对强势？——恐慌中是质量在显现，还是避险资产(黄金/债券)在涨？
4. 你的止损被触发了吗？——如果是→执行。如果不是→等风暴过去

历史规律：恐慌日之后1个月的正收益概率约70%。多数恐慌的底部——都是在恐慌日当天或之后1-2天。`,
    whisperTip: '恐慌日是最难"做对事"的日子——因为你的大脑在说"跑"，但历史在说"留"。不是让你逆势加仓——是让你遵守策略。策略说卖就卖，策略说等就等。在恐慌日里坚持策略规则，是优秀交易员和普通交易员的分水岭。',
    triggerThresholds: {
      '大盘跌幅': '>2%',
      'VIX': '>30',
      '成交量': '急剧放大(超出日均50%+)',
      '板块分布': '全板块下跌',
    },
  },
  {
    stateId: 'EUPHORIA',
    stateName: '狂热上涨',
    stateEmoji: '☀️🔥',
    oneLiner: '大涨日！开心归开心——但请看一下你的止损线。',
    whatHappened: `今天大盘暴涨超过2%，多个板块涨幅在3%以上。
VIX可能很低（<15）——市场参与者非常乐观。
成交量放大——不只有人在追，还有人在加速追。
新闻头条全是利好——和恐慌日正好相反。

这也是一个"极端"的交易日。
极端好和极端坏一样——都值得你停下来想一想。`,
    whatItMeans: `狂热日对策略的影响：
- 动量策略：今天当然在赚钱——但注意持仓集中度。如果是某几个股票贡献了大部分收益→风险集中。
- 低波动策略：今天可能也涨，但涨幅大概率不如此他策略——这是设计好的，不是"跑输了"。
- 价值策略：今天可能跑输，因为"便宜的股票在狂热中被人遗忘"——这也是正常的。

关键问题：这个"暴涨"是健康的反弹，还是不健康的泡沫冲刺？
健康=基本面支撑+广泛分布+理**性买入。
不健康=纯情绪推动+集中几个板块+有人在喊"再不买就来不及了"。`,
    whatToWatch: `1. 上涨是"普涨"还是"龙头带涨"？——普涨更健康，龙头独涨=可能快到顶
2. 成交量是持续放大还是某一笔巨量？——持续放大=有后继；单笔巨量=可能是聪明钱在出货
3. 你的止盈线被触发了吗？——如果策略告诉你该卖了，执行——别因为"还在涨"就不卖
4. "FOMO"（怕错过）在你心里有多强？——诚实地问自己

💡 一个简单的判断："如果明天跌2%，我今天赚到的钱还会在吗？"——如果答案是"不确定"，你应该锁定一部分利润。`,
    whisperTip: '大涨日最危险的想法："这次找到圣杯了！"没有圣杯——只有概率。今天的暴涨可能明天就回调了。最好的纪律：大涨日检查止盈线，触发就卖。没触发就继续持有。不是你的聪明让你赚钱——是规则。',
    triggerThresholds: {
      '大盘涨幅': '>2%',
      'VIX': '<15',
      '成交量': '放大(超出日均50%+)',
      '板块分布': '>90%板块上涨',
    },
  },
];

// ═══════════════════ 驾驶舱AI快评生成器 ═══════════════════

export interface MarketSnapshot {
  indexReturn: number; // 大盘涨跌幅%
  vix: number;
  advancersPct: number; // 上涨股票占比%
  volumeVsAvg: number; // 成交量vs日均%
  topSector: string;
  topSectorReturn: number;
  worstSector: string;
  worstSectorReturn: number;
}

export function determineMarketState(snap: MarketSnapshot): QuickCommentary {
  const { indexReturn, vix, volumeVsAvg } = snap;

  // Panic: >2% drop + VIX > 28
  if (indexReturn < -2 && vix > 28) {
    return MARKET_QUICK_COMMENTARIES.find(c => c.stateId === 'PANIC')!;
  }
  // Euphoria: >2% gain + VIX < 18
  if (indexReturn > 2 && vix < 18) {
    return MARKET_QUICK_COMMENTARIES.find(c => c.stateId === 'EUPHORIA')!;
  }
  // Normal Bull: +0.3% to +2%
  if (indexReturn >= 0.3 && indexReturn <= 2) {
    return MARKET_QUICK_COMMENTARIES.find(c => c.stateId === 'NORMAL_BULL')!;
  }
  // Normal Bear: -2% to -0.3%
  if (indexReturn <= -0.3 && indexReturn >= -2) {
    return MARKET_QUICK_COMMENTARIES.find(c => c.stateId === 'NORMAL_BEAR')!;
  }
  // With volume check: if VIX > 30 without crash → still panic
  if (vix > 30 && indexReturn < -1) {
    return MARKET_QUICK_COMMENTARIES.find(c => c.stateId === 'PANIC')!;
  }
  // Extreme volume spikes on downside → upgrade to panic
  if (volumeVsAvg > 150 && indexReturn < -1.5) {
    return MARKET_QUICK_COMMENTARIES.find(c => c.stateId === 'PANIC')!;
  }

  // Default: Neutral
  return MARKET_QUICK_COMMENTARIES.find(c => c.stateId === 'NEUTRAL')!;
}

export function generateCockpitCommentary(snap: MarketSnapshot): string {
  const state = determineMarketState(snap);
  const parts = [
    `## ${state.stateEmoji} ${state.stateName}`,
    '',
    `> ${state.oneLiner}`,
    '',
    `### 发生了什么`,
    state.whatHappened,
    '',
    `### 什么意思`,
    state.whatItMeans,
    '',
    `### 该看什么`,
    state.whatToWatch,
    '',
    `---`,
    `🐋 ${state.whisperTip}`,
  ];
  return parts.join('\n');
}

export default MARKET_QUICK_COMMENTARIES;
