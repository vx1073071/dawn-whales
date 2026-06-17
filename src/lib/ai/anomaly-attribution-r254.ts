// ══ R254 QClaw AI-03: 异动归因文案 — 5种异动类型 ══
// Anomaly attribution copy: explaining WHY, not just WHAT
// Design: "不是'这里出了异常'——是'这个异常可能意味着什么'"

export type AnomalyType =
  | 'TECHNICAL'      // 技术面异动：K线/指标/形态突变
  | 'CAPITAL'        // 资金面异动：大单/主力/资金流向突变
  | 'SENTIMENT'      // 情绪面异动：恐慌/贪婪/关注度突变
  | 'NEWS_DRIVEN'    // 新闻驱动异动：财报/事件/公告冲击
  | 'MACRO';         // 宏观驱动异动：利率/政策/地缘冲击

export interface AnomalyAttribution {
  type: AnomalyType;
  typeName: string;
  typeEmoji: string;
  template: string;            // 归因模板
  commonCauses: string[];      // 常见原因
  whatItSuggests: string;      // 暗示什么
  confidenceLevel: string;     // 归因可信度
  nextStep: string;            // 下一步
}

export const ANOMALY_ATTRIBUTIONS: AnomalyAttribution[] = [
  {
    type: 'TECHNICAL',
    typeName: '技术面异动',
    typeEmoji: '📊',
    template: `{stock}在{timeframe}内出现了{indicator}的{pattern}——这是一个值得关注的技术信号。
{indicator}在{period}内从{fromValue}变为{toValue}，变化幅度为{changePercent}%。

这种幅度的变化在过去{lookback}天里只出现过{occurrence}次——上一次发生在{lastDate}，之后{stock}{direction}了{lastReturn}%。`,
    commonCauses: [
      '突破关键阻力/支撑位（最常见——价格碰到"大家都在看的线"）',
      '技术指标极端化（RSI>80或<20，MACD金叉/死叉）',
      '成交量异常放大（可能是聪明钱在行动）',
      'K线形态出现（头肩顶/双底/岛形反转等——有一定预测能力的形态）',
      '波动率突然飙升（布林带突然张大——有大事在发生）',
    ],
    whatItSuggests: `技术面异动通常暗示市场参与者对这只股票的看法正在快速变化。
但注意：技术信号不是"原因"——它是"结果"。价格的异动反映了有人在买入或卖出。
关键是判断：这个技术信号是"真的"（有成交量配合→趋势可能会延续）还是"假的"（没有成交量→可能只是噪音）？

如果是放量突破：可信度较高——有人在用真金白银投票
如果是缩量异动：可能是假信号——一天就回去了`,
    confidenceLevel: '技术面归因的置信度约为65-75%（中等偏高）。因为技术信号是由我们可以量化的价格和成交量驱动的——但技术面只能告诉你"现在不一样了"，不能100%确定"为什么会不一样"。',
    nextStep: `1. 检查成交量是否配合——放量=可信，缩量=存疑
2. 看有没有对应的新闻/基本面变化——技术异动+基本面催化=高概率信号
3. 如果是你的持仓→检查止损线是否需要调整
4. 如果是你的关注→观察1-2天，确认不是一日游`,
  },

  {
    type: 'CAPITAL',
    typeName: '资金面异动',
    typeEmoji: '💰',
    template: `{stock}在{timeframe}内出现了{capitalType}——{amount}。
具体来说：{details}。

这笔资金的规模是过去{lookback}天日均{capitalType}的{ratio}倍——属于{severity}异常。
{brokerInfo}。`,
    commonCauses: [
      '机构大单进出（"聪明钱"在调仓——通常不是一天就结束的）',
      '主力资金流入/流出（特大单净买入/卖出远超正常水平）',
      '北向/南向资金异动（沪深港通资金突然大幅进出某只股票）',
      '融资融券异常（大量融资买入→做多信号；大量融券卖出→做空信号）',
      '经纪商异动（某家大券商突然大幅买卖——可能代表某个大客户在行动）',
    ],
    whatItSuggests: `资金面异动是最有"重量"的信号——因为钱不会说谎。
和技术面不同，资金面告诉你的是"真金白银在流入还是流出"。

关键区分：
· 增量资金（新资金进场）→ 持续性可能较强——新进资金不会马上走
· 存量搬家（从A股票换到B股票）→ 持续性可能较差——调仓完成后就停了
· 大单集中在某家券商→ 可能是某个机构/大佬的行动
· 大单分散在多券商→ 更可能是"市场共识"——比单一机构行动更可靠

但注意：资金面有滞后——你看到的是"已经发生"的资金流动。追大资金的速度永远比大资金慢。`,
    confidenceLevel: '资金面归因置信度约70-80%（高）。因为资金数据相对客观——但不能排除"诱多/诱空"的可能性。大资金也可能在"做给你看"然后反向操作。',
    nextStep: `1. 识别资金性质——是"新进"还是"搬家"？（新进>搬家）
2. 看资金的"入场成本"——如果现在价格和资金入场价接近→跟随的风险较小
3. 时间维度：单日大单=参考价值中等；连续3-5天大单=高概率趋势
4. 如果是你的持仓被大资金"抛弃"→认真考虑减仓`,
  },

  {
    type: 'SENTIMENT',
    typeName: '情绪面异动',
    typeEmoji: '🧠',
    template: `{stock}的市场情绪在{timeframe}内出现了{shift}——从{fromSentiment}转向{toSentiment}。
具体表现：{details}。

这种程度的情绪转变在过去{lookback}天中只出现过{occurrence}次。
当前情绪极端程度排在过去{period}的{percentile}%——属于{extremity}水平。`,
    commonCauses: [
      '社交媒体热度突然飙升（Reddit/雪球/微博讨论量爆发——散户情绪点燃）',
      '社区看涨/看跌比例极端化（所有人都看涨→可能要跌；所有人都看跌→可能要涨）',
      '网络搜索量暴增（Google Trends突然飙升——大量新人在关注这只股票）',
      '新闻情绪剧烈反转（正面新闻刷屏vs负面新闻刷屏——情绪被媒体操作）',
      '期权PCR极端化（看跌/看涨期权比例极端——衍生品市场在投票）',
    ],
    whatItSuggests: `情绪面异动通常是一个"反向指标"——或者至少是一个"极端化"的警告。

华尔街经典规律：
· 极度看涨→ 可能快见顶了（能买的人都已经买了，没有新买家了）
· 极度看跌→ 可能快见底了（能卖的人都已经卖了，没有新卖家了）

但注意：情绪极端化≠立刻反转。
极度看涨的市场可能继续涨——直到没有新买家为止。
极度看跌的市场可能继续跌——直到没有新卖家为止。

情绪信号的正确使用方式：不是"看到极端就反向操作"——是"看到极端就提高警惕，用价格和技术信号确认反转"。`,
    confidenceLevel: '情绪面归因置信度约55-65%（中等）。因为情绪是"软指标"——噪音大、易操控(水军)、不同平台的可靠性差异大。但极端情绪+技术面确认=高概率信号。',
    nextStep: `1. 检查情绪来源的可靠性——是"很多人真的在讨论"，还是"几个号在刷屏"？
2. 情绪+价格组合判断：极度悲观+价格在跌=等反转信号；极度悲观+价格止跌=可能已见底
3. 不要单纯根据情绪做交易——情绪是背景，价格是证据
4. 如果是你的持仓→看看市场对它的情绪是否和你一致——不一致时，想想为什么`,
  },

  {
    type: 'NEWS_DRIVEN',
    typeName: '新闻驱动异动',
    typeEmoji: '📰',
    template: `{stock}在{timeframe}内受到{newsType}冲击——{headline}。
消息发布后{minutes}分钟内，价格{reaction}，成交量{volumeReaction}。

这是一条{importance}级别的消息——对{stock}的影响预计{durability}。
类似消息在过去{lookback}个月内出现过{similarEvents}次，平均影响持续{duration}天。`,
    commonCauses: [
      '财报发布（beat/miss→价格剧烈反应——最常见也最重要的新闻驱动）',
      'SEC 8-K/重大公告（并购/CEO更换/重组/退市——影响深远的事件）',
      '分析师评级变更（升级/降级/目标价大幅调整——短期冲击大）',
      '行业/监管政策变化（新法规→影响整条赛道——不只是一只股票）',
      '诉讼/丑闻/合规（负面事件——通常引发长期持续下跌）',
    ],
    whatItSuggests: `新闻驱动是最"事件性"的异动——它的归因通常最直接：因为有新闻，所以有反应。

关键判断：这个新闻的影响是"一次性"还是"持续性"？

一次性：分析师调级/季度财报beat但无趋势改变→影响可能1-3天
持续性：行业政策转向/公司重大转型/新的增长赛道→影响可能数周-数月
毁灭性：财务造假/监管处罚/商业模式崩溃→可能是"不可逆"的卖出信号

还有一个重要区分：新闻是"被泄露了"还是"真的突发"？
· 如果新闻发布前价格已经动了→有人提前知道了→新闻发布时可能是"利好出尽"
· 如果新闻发布后价格才开始动→真正的市场反应`,
    confidenceLevel: '新闻驱动归因置信度约75-90%（很高）。因为因果关系清晰——但"新闻影响的范围和持续时间"的判断难度大。财报效应相对可量化（beat多少→平均涨多少），但"CEO更换"的影响极难量化。',
    nextStep: `1. 判断新闻性质：一次性/持续性/毁灭性？
2. 一次性→短期波动不影响你的策略逻辑
3. 持续性→考虑是否是个"新因子"（比如新政策创造了一个新的投资逻辑）
4. 毁灭性→不管策略怎么说，优先考虑风险
5. 等待"消息面消化"——新闻发布后的30-60分钟噪音最大，不要在那时做决定`,
  },

  {
    type: 'MACRO',
    typeName: '宏观驱动异动',
    typeEmoji: '🌍',
    template: `{stock}在{timeframe}内受到{macroEvent}的冲击——{description}。

这不是{stock}自身的问题——是整个{affectType}在被重新定价。
受影响的不仅是{stock}，还有{peerCount}只同类型股票出现了类似的异动。

{macroEvent}的预期影响：
· 短期({shortDays}天)：{shortImpact}
· 中期({midDays}天)：{midImpact}`,
    commonCauses: [
      '美联储利率决议/CPI/就业数据（直接影响所有资产定价——最核心的宏观驱动）',
      '地缘政治事件（冲突/制裁/脱钩——影响不确定性，波及广泛）',
      '汇率大幅波动（影响跨国企业利润、进出口——A股/港股/日股尤其敏感）',
      '大宗商品价格异动（石油/铜/黄金——影响相关行业整条产业链）',
      '全球市场联动暴跌/暴涨（美股大跌→全球跟跌——情绪传染）',
    ],
    whatItSuggests: `宏观异动是最"不可控"的——因为它不针对任何一只股票，而是整个市场的"系统性风险"。

在这种情况下：
· 你的策略大概率也会亏——这不是你的策略不好，是"天要下雨"
· 分散投资只能部分对冲——当系统性风险来临时，"所有东西都在跌"
· 低波动策略和质量策略会跌得少——但不会完全不跌

关键判断：这是"短期冲击"还是"趋势性变化"？

短期冲击：地缘冲突(可控)/单次糟糕的数据(不代表趋势)→1-2周会恢复
趋势性变化：加息周期开始/经济衰退确认/信贷危机→可能需要数月
系统性危机：金融系统风险→可能改变整个市场体制`,
    confidenceLevel: '宏观归因置信度约80-95%（最高）。因为因果关系最清晰——利率上升→成长股跌，石油涨价→航空股跌。但"宏观事件的持续时间和影响程度"的判断极难——没有人能准确预测下一次美联储会说什么。',
    nextStep: `1. 判断是系统性风险(所有股票都在跌)还是行业性冲击(只有某板块在跌)
2. 系统性→关注你的整体回撤，决定是否需要降低总仓位
3. 行业性→检查你的持仓集中度：你的持仓中有多少在"受打击的行业"？
4. 如果是利率/政策变化→重新评估市场中哪些策略更适应当前环境
5. 不要在宏观冲击当天大改策略——等冲击过去，看清楚再做调整`,
  },
];

// ═══════════════════ 归因生成器 ═══════════════════

export interface AnomalyEvent {
  stock: string;
  type: AnomalyType;
  timeframe: string;       // '日内' | '近3日' | '近1周'
  severity: 'CRITICAL' | 'IMPORTANT' | 'NORMAL';
  rawValues: Record<string, string | number>;
}

export function attributeAnomaly(event: AnomalyEvent): {
  typeName: string;
  typeEmoji: string;
  severityLabel: string;
  severityEmoji: string;
  attribution: string;
  suggestion: string;
  confidence: string;
} {
  const attr = ANOMALY_ATTRIBUTIONS.find(a => a.type === event.type)!;

  const severityMap = {
    CRITICAL: { label: '严重', emoji: '🔴' },
    IMPORTANT: { label: '重要', emoji: '🟠' },
    NORMAL: { label: '一般', emoji: '🟡' },
  };
  const sev = severityMap[event.severity];

  // Fill template with raw values
  let attribution = attr.template;
  for (const [key, val] of Object.entries(event.rawValues)) {
    attribution = attribution.replace(`{${key}}`, String(val));
  }

  // R256: dead code removed - _parts was declared but never used
  /*
  const _parts = [
    `${sev.emoji} **${attr.typeEmoji} ${attr.typeName}** — ${sev.label}`,
    '',
    `### 发生了什么`,
    attribution,
    '',
    `### 可能意味着什么`,
    attr.whatItSuggests,
    '',
    `### 归因可信度`,
    attr.confidenceLevel,
    '',
    `### 建议下一步`,
    attr.nextStep,
    '',
    `### 常见原因参考`,
    ...attr.commonCauses.map(c => `· ${c}`),
  ];
  */

  return {
    typeName: attr.typeName,
    typeEmoji: attr.typeEmoji,
    severityLabel: sev.label,
    severityEmoji: sev.emoji,
    attribution,
    suggestion: attr.nextStep,
    confidence: attr.confidenceLevel,
  };
}

export default ANOMALY_ATTRIBUTIONS;
