// ══ R246 QClaw P1-01: 名人影子策略文案 (10位投资大师) ══
// Each: name, philosophy one-liner, shadow factor combo, what they'd say, UX card copy
// Design goal: "用巴菲特的方式看市场" — 把大师思维变成可点击的策略因子包

export interface CelebrityShadow {
  id: string;
  name: string;
  nameEn: string;
  title: string;
  era: string;
  /** 一句话投资哲学 */
  philosophy: string;
  /** TradingEasy如何"翻译"他的方法 */
  shadowApproach: string;
  /** 对应的因子组合 */
  factorCombo: string[];
  /** 他会对现在的你说什么 */
  whatHeWouldSay: string;
  /** 策略卡片的UX文案 */
  uxCard: {
    headline: string;
    subtitle: string;
    styleLabel: string;
    difficulty: number;
    timeHorizon: string;
  };
}

export const CELEBRITY_SHADOWS: CelebrityShadow[] = [
  {
    id: 'buffett-value',
    name: '沃伦·巴菲特',
    nameEn: 'Warren Buffett',
    title: '奥马哈先知 · 伯克希尔哈撒韦CEO',
    era: '1965至今，年化20%+',
    philosophy: '用合理的价格买好公司，然后永远不卖。',
    shadowApproach: '我们帮你找那些PE合理、ROE多年稳定>15%、F-Score高分、利润是真金白银的公司。巴菲特说"别人贪婪我恐惧"——我们用恐惧贪婪指数帮你量化这句话。',
    factorCombo: ['EP_RATIO', 'ROE_STABILITY', 'F_SCORE', 'ACCRUALS', 'DEBT_COVERAGE', 'GROSS_MARGIN', 'FEAR_GREED_INDEX'],
    whatHeWouldSay: '"如果你不打算持有一只股票十年，那就别持有十分钟。现在市场{x_direction}，但好公司不会因为大盘跌就变差。看看那些ROE稳定在15%以上的公司——它们才是你应该在恐慌时买入的。"',
    uxCard: {
      headline: '像巴菲特一样买股票',
      subtitle: '找好公司，等好价格，然后一直拿着',
      styleLabel: '深度价值',
      difficulty: 2,
      timeHorizon: '3年+',
    },
  },

  {
    id: 'dalio-allweather',
    name: '瑞·达利欧',
    nameEn: 'Ray Dalio',
    title: '桥水基金创始人 · 全天候策略之父',
    era: '1975至今，管理$1500亿+',
    philosophy: '没有人知道明天会发生什么，所以什么都要配置一点。',
    shadowApproach: '我们用跨资产相关性+波动率体制+尾部依赖，帮你检查你的持仓是不是"把鸡蛋放在了一个篮子里"。达利欧说"分散是唯一免费的午餐"——我们让这句话可操作。',
    factorCombo: ['CROSS_ASSET_CORR', 'VOL_60D', 'TAIL_DEPENDENCE', 'CORR_REGIME', 'MARKET_REGIME', 'RATE_BETA', 'INFLATION_BETA', 'FX_EXPOSURE'],
    whatHeWouldSay: '"你的痛苦来自于你认为事情应该是什么样，而不是事情实际是什么样。现在{x_asset}和{y_asset}的相关性在变化——这意味着你需要调整配置。不要执着于单一资产，让组合自己平衡。"',
    uxCard: {
      headline: '像达利欧一样配置资产',
      subtitle: '什么都配一点，什么风暴都不怕',
      styleLabel: '全天候风险平价',
      difficulty: 4,
      timeHorizon: '持续再平衡',
    },
  },

  {
    id: 'soros-reflexivity',
    name: '乔治·索罗斯',
    nameEn: 'George Soros',
    title: '量子基金创始人 · 击败英格兰银行的人',
    era: '1970-2011，年化30%',
    philosophy: '市场总是错的，我的工作是找到它错在哪里——然后狠狠押注。',
    shadowApproach: '我们用极端情绪+拥挤度+趋势加速来捕捉"市场共识过度"的时刻。索罗斯说"当趋势确认时，加大赌注"——ADX>40就是那个信号。',
    factorCombo: ['ADX', 'MOM_12M', 'FEAR_GREED_INDEX', 'CROWDING', 'RSI_14', 'PUT_CALL_SKEW', 'CRYPTO_FUNDING'],
    whatHeWouldSay: '"重要的不是你对还是错，而是你对的时候赚了多少，错的时候亏了多少。现在市场{x_status}——这是一个{x_quality}的机会。如果我是你，我会{x_action}。但要设好止损，因为我也经常错。"',
    uxCard: {
      headline: '像索罗斯一样抓拐点',
      subtitle: '找到市场共识错得离谱的时候，重仓出击',
      styleLabel: '宏观对冲',
      difficulty: 5,
      timeHorizon: '几周-几个月',
    },
  },

  {
    id: 'tudor-jones-macro',
    name: '保罗·都铎·琼斯',
    nameEn: 'Paul Tudor Jones',
    title: 'Tudor投资公司创始人 · 宏观交易教父',
    era: '1980至今，连续28年正收益',
    philosophy: '防守是最好的进攻。先想你会亏多少，再想能赚多少。',
    shadowApproach: '我们用MAX_DRAWDOWN+CVaR+尾尾依赖帮你量化"最坏情况"。琼斯说"第一天我只关心风险"——我们把这变成每次交易前必看的仪表盘。',
    factorCombo: ['MAX_DRAWDOWN', 'CVAR_95', 'ATR_14', 'TAIL_DEPENDENCE', 'CREDIT_SPREAD_BETA', 'RATE_BETA', 'VOLATILITY_REGIME'],
    whatHeWouldSay: '"每天早上我问的第一件事是：如果今天世界变了，我最亏多少钱？你能接受这个数字吗？如果不能，减仓。仓位不是用来证明你有多勇敢——是用来控制你晚上能不能睡着的。"',
    uxCard: {
      headline: '像琼斯一样管风险',
      subtitle: '先算会亏多少，再决定下注多大',
      styleLabel: '宏观防守',
      difficulty: 3,
      timeHorizon: '持续风险监控',
    },
  },

  {
    id: 'lynch-growth',
    name: '彼得·林奇',
    nameEn: 'Peter Lynch',
    title: '富达麦哲伦基金经理 · 13年年化29%',
    era: '1977-1990，管理$140亿',
    philosophy: '买你懂的东西。你每天用的产品背后，就是最好的投资机会。',
    shadowApproach: '我们帮你找那些毛利率高、盈利在加速上调、分析师在追着上调预期的公司。林奇说"PEG<1就是好公司"——我们用GROWTH+EARNINGS_REVISION来量化这个逻辑。',
    factorCombo: ['GROWTH', 'GROSS_MARGIN', 'EARNINGS_REVISION', 'EARNINGS_SURPRISE', 'ANALYST_MOMENTUM', 'GROSS_MARGIN_TREND'],
    whatHeWouldSay: '"最好的股票往往就在你的生活里。你每天用的产品，你去吃的餐厅，你手机上刷的App——如果它们的生意在变好，买入就对了。但记住：高速增长之后往往跟着减速，在PEG<1时入场最安全。"',
    uxCard: {
      headline: '像林奇一样找成长股',
      subtitle: '找到你身边的伟大公司，在它还便宜时买入',
      styleLabel: '成长+质量',
      difficulty: 2,
      timeHorizon: '1-3年',
    },
  },

  {
    id: 'simons-quant',
    name: '詹姆斯·西蒙斯',
    nameEn: 'Jim Simons',
    title: '文艺复兴科技创始人 · 量化投资之王',
    era: '1988至今，大奖章基金年化66%',
    philosophy: '把投资变成一个模式识别问题。如果数据反复告诉你一个规律，就相信它。',
    shadowApproach: '我们用68+因子的系统化打分，找出统计上最稳定的超额收益来源。西蒙斯说"我们不做预测，我们做概率"——每个信号都带置信区间。',
    factorCombo: ['MOM_6_1', 'STR_5D', 'MEAN_REVERSION_SPEED', 'MOM_12M', 'SIZE', 'LIQ', 'VOL_60D', 'SKEWNESS'],
    whatHeWouldSay: '"如果一个模式在过去1000次里对了600次，这就是值得下注的信号。不要问为什么——数据故事是人类事后编的。我们只关心：这个信号现在有多强，历史上胜率是多少。"',
    uxCard: {
      headline: '像西蒙斯一样做量化',
      subtitle: '把交易变成概率游戏，相信数据不相信故事',
      styleLabel: '系统化量化',
      difficulty: 4,
      timeHorizon: '几天-几周',
    },
  },

  {
    id: 'bogle-index',
    name: '约翰·博格',
    nameEn: 'John Bogle',
    title: '先锋集团创始人 · 指数投资之父',
    era: '1975-2019，改变了整个行业',
    philosophy: '不要试图打败市场——买下整个市场，然后收工。',
    shadowApproach: '我们帮你确认：你的主动交易跑赢大盘了吗？如果没有，考虑用MKT因子+低成本宽基做底仓。博格说"长期来看，费用才是最大的敌人"——我们追踪你的真实净收益。',
    factorCombo: ['MKT', 'LIQ', 'VOL_60D', 'MAX_DRAWDOWN', 'BETA_STABILITY'],
    whatHeWouldSay: '"你今年操作了{x_trades}次，扣掉手续费和税，净收益是{x_net}%。而同期大盘指数涨了{x_index}%。数学不会说谎——有时候最好的操作就是什么都不做。"',
    uxCard: {
      headline: '像博格一样躺平投资',
      subtitle: '买下整个市场，忘记密码，几年后回来看',
      styleLabel: '被动指数',
      difficulty: 1,
      timeHorizon: '10年+',
    },
  },

  {
    id: 'wood-innovation',
    name: '凯西·伍德',
    nameEn: 'Cathie Wood',
    title: 'ARK Invest创始人 · 颠覆式创新旗手',
    era: '2014至今，管理$200亿+',
    philosophy: '未来属于颠覆者。买那些改变世界的公司，然后忍受过程中的颠簸。',
    shadowApproach: '我们帮你找那些研发投入高、营收增速>30%、毛利率在扩大的创新公司。伍德说"波动不是风险，错过未来才是"——我们用ATR帮你衡量这个"颠簸"你能接受多少。',
    factorCombo: ['GROWTH', 'GROSS_MARGIN_TREND', 'EARNINGS_SURPRISE', 'ATR_14', 'US_INST_HOLD', 'SOCIAL_SENTIMENT'],
    whatHeWouldSay: '"看看那些年化增长30%以上的公司——它们在创造未来。是的，波动会很大，回撤50%也不是没可能。但如果你相信技术变革的方向，短期的颠簸只是噪音。"',
    uxCard: {
      headline: '像木头姐一样投创新',
      subtitle: '找改变世界的公司，坐稳起飞',
      styleLabel: '颠覆式成长',
      difficulty: 4,
      timeHorizon: '5年+',
    },
  },

  {
    id: 'burry-contrarian',
    name: '迈克尔·伯里',
    nameEn: 'Michael Burry',
    title: 'Scion资管创始人 · 《大空头》原型',
    era: '2000至今，2008年做空次贷赚$7亿',
    philosophy: '当所有人都说"这次不一样"时，往往就是一样。找到万众欢呼中的裂缝。',
    shadowApproach: '我们用应计率+债务覆盖+空头持仓+拥挤度来找出"皇帝的新衣"。伯里说"泡沫爆裂的声音全世界都听得到——但没人想在爆之前离场"——我们用数字帮你客观判断。',
    factorCombo: ['ACCRUALS', 'DEBT_COVERAGE', 'SHORT_COVERING', 'CROWDING', 'EARN_QUALITY', 'CREDIT_SPREAD_BETA', 'US_SHORT_RATIO'],
    whatHeWouldSay: '"如果一家公司的利润有一半是应收账款，而且债务利息都快还不起了——但股价还在创新高——那不是投资机会，那是定时炸弹。我不跟人群走，数据告诉我什么时候人群错了。"',
    uxCard: {
      headline: '像伯里一样找裂缝',
      subtitle: '在万众欢呼中找到皇帝的新衣',
      styleLabel: '逆向做空',
      difficulty: 5,
      timeHorizon: '几个月-1年',
    },
  },

  {
    id: 'druckenmiller-macro',
    name: '斯坦利·德鲁肯米勒',
    nameEn: 'Stanley Druckenmiller',
    title: '杜肯资管创始人 · 索罗斯接班人',
    era: '1981-2010，30年年化30%，零亏损年',
    philosophy: '不要分散——把子弹集中到最好的机会上。但确认错了要第一时间认。',
    shadowApproach: '我们用市场体制+经济意外+利率敏感度来找"最佳击球点"。德鲁肯米勒说"好的年份我要赚50%，差的年份我要保本"——我们帮你选最佳进攻窗口。',
    factorCombo: ['MARKET_REGIME', 'ECONOMIC_SURPRISE', 'RATE_BETA', 'SECTOR_ROTATION', 'ADX', 'FACTOR_LEAD_LAG', 'YIELD_CURVE_SLOPE'],
    whatHeWouldSay: '"大多数时候你应该等待。但当宏观+技术面+情绪三者都指向同一个方向时——这就是你加大赌注的时候。然后设好止损。如果错了，立刻承认，寻找下一个机会。"',
    uxCard: {
      headline: '像德鲁肯米勒一样抓大机会',
      subtitle: '等待最佳击球点，然后重拳出击',
      styleLabel: '宏观择时',
      difficulty: 5,
      timeHorizon: '几周-几个月',
    },
  },
];

/** Get a celebrity shadow by id */
export function getCelebrityShadow(id: string): CelebrityShadow | undefined {
  return CELEBRITY_SHADOWS.find(c => c.id === id);
}

/** Generate a UX card string for display */
export function generateCelebrityCard(id: string): string {
  const c = getCelebrityShadow(id);
  if (!c) return '';
  return `${c.uxCard.headline}
${c.uxCard.subtitle}

👤 ${c.name}（${c.title}）
📈 ${c.era}
💡 "${c.philosophy}"

🔧 我们用这些因子复刻他的思路:
${c.factorCombo.map(f => `  · ${f}`).join('\n')}

🗣️ ${c.whatHeWouldSay}

[用${c.name}的方式看市场] [看看我的持仓符合吗]`;
}

export default CELEBRITY_SHADOWS;
