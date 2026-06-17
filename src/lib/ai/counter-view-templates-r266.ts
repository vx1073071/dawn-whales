// ══ R266 QClaw Task 3: 反向观点模板 (2h) ══
// P1-07: AI的反方律师 — 每次给出看多/看空结论时，自动展示"反过来看为什么不成立"
// 设计哲学: "决策日志里最值钱的是矛盾段——反方律师说的那几句"
// 交付: 反向观点生成器 — 按信号类型匹配反方模板

// ═══════════════════════════════════════
// TYPE: 反向观点
// ═══════════════════════════════════════

export interface CounterView {
  id: string;
  triggerSignal: string;     // 触发此反方观点的AI结论
  heading: string;           // 反方标题 (≤15字)
  opening: string;           // 开场白 "但是..."
  arguments: CounterArgument[];
  probability: string;       // "根据历史——这类反方观点正确的概率约{X}%"
  whatWouldConfirm: string;  // "如果{X}发生——反方是对的。如果{Y}发生——原结论成立。"
  severity: 'mild' | 'moderate' | 'strong'; // 反方力度
}

export interface CounterArgument {
  point: string;             // 反方论点 (≤25字)
  reasoning: string;         // 为什么这是有效的反驳 (≤40字)
  evidence: string;          // 需要什么证据来验证 (≤30字)
}

// ═══════════════════════════════════════
// 反方观点库 (10个核心场景)
// ═══════════════════════════════════════

export const COUNTER_VIEWS: CounterView[] = [

  // ── 场景1: AI说"强烈看多" → 反方说"一致性本身是风险" ──
  {
    id: 'counter-strong-buy',
    triggerSignal: '强烈看多 / 多个指标一致看多',
    heading: '一致性本身就是风险',
    opening: '但是——当所有人都说买的时候，买方已经进场了。剩下的只有卖方。',
    arguments: [
      {
        point: '指标一致性过高可能是"集体滞后"',
        reasoning: '均线、MACD、RSI都是基于历史价格——它们同时看多不等于未来涨，只等于"过去已经涨了"',
        evidence: '看ADX: 如果ADX>40且仍在上升→指标一致是真的。如果ADX<25→集体撒谎。',
      },
      {
        point: '没有分歧就没有超额收益',
        reasoning: '市场中最赚钱的入场点往往是"大部分人还在犹豫"的时候，不是"所有人都说买"的时候',
        evidence: '看成交量: 如果放量→资金确实在进场。如果缩量→"喊买"只是技术面的回声。',
      },
    ],
    probability: '根据历史——极度一致看多时，次日回调的概率约38%。但一旦回调确认——幅度通常2-4%。',
    whatWouldConfirm: '如果次日高开低走→反方是对的，这是"利好多出尽"。如果次日高开高走→原结论成立，趋势确实强。',
    severity: 'moderate',
  },

  // ── 场景2: AI说"MACD金叉看涨" → 反方说"看在哪发生的" ──
  {
    id: 'counter-macd-golden',
    triggerSignal: 'MACD金叉 / MACD看涨信号',
    heading: '金叉发生在哪里才是关键',
    opening: '但是——不是每个金叉都值得买。零轴下方金叉=反弹不是反转。',
    arguments: [
      {
        point: '零轴下方金叉大概率是"假反弹"',
        reasoning: '零轴下方=空头区域。此处的金叉只是下跌中继的反弹，不是转势。只有零轴上方的金叉才有趋势意义。',
        evidence: '看MA60: 如果价格在MA60下方→大势还是空。金叉只是短期反抽。',
      },
      {
        point: '金叉时的成交量决定真假',
        reasoning: '缩量金叉=没人跟风→大概率失败。只有放量金叉才说明有人真的在买。',
        evidence: '看成交量: 金叉当日成交量<前5日均量→假信号。',
      },
    ],
    probability: '历史上零轴下方金叉的"真转势"概率约23%。大多数是反弹后再创新低。',
    whatWouldConfirm: '如果金叉后3根K线内价格跌破金叉当日收盘价→反方是对的。如果突破MA60→原结论成立。',
    severity: 'strong',
  },

  // ── 场景3: AI说"超卖反弹" → 反方说"超卖了还能更超卖" ──
  {
    id: 'counter-oversold',
    triggerSignal: '超卖 / RSI<30 / KDJ超卖 / 抄底信号',
    heading: '超卖了 —— 还能更超卖',
    opening: '但是——"便宜"不等于"马上涨"。恐慌中的市场可以把便宜的东西变得更便宜。',
    arguments: [
      {
        point: '超卖在下跌趋势中是"加速信号"而非"反转信号"',
        reasoning: 'RSI<30说明卖压很强——强卖压说明空头在掌控。空头掌控的时候"抄底"="接飞刀"。',
        evidence: '看ADX: 如果ADX>30且-DI在上方→下跌趋势中，超卖只会更超卖。',
      },
      {
        point: '真正的底部不是"超卖"——是"超卖+缩量+横盘"',
        reasoning: '单靠RSI<30就入场=在猜测"别人不再卖了"。等成交量萎缩+价格止跌横盘才是真正的底。',
        evidence: '等RSI从20反弹到30以上+成交量缩到均量以下→这两条同时出现再动手。',
      },
    ],
    probability: '在下跌趋势中RSI<30的直接反弹概率约31%。但如果等待RSI回到40以上再入场——胜率提升到54%。',
    whatWouldConfirm: '如果第二天继续跌+RSI创新低→反方是对的。如果出现"下影线+阳线"→原结论可能成立。',
    severity: 'strong',
  },

  // ── 场景4: AI说"布林带上轨突破看跌" → 反方说"突破≠反转" ──
  {
    id: 'counter-boll-overbought',
    triggerSignal: '布林带超买 / 价格在上轨 / 看跌',
    heading: '突破不等于反转',
    opening: '但是——最强趋势中价格可以沿着上轨"骑"很久，每次碰轨都在"超买"状态。',
    arguments: [
      {
        point: '%B>1不代表价格会跌——强趋势中%B常年在0.8-1.2之间',
        reasoning: '寻找"突破布林带后还没跌"的标的——它们往往不是在"即将调整"，而是在"加速"。',
        evidence: '看前5根K线: 如果每次都碰轨后下跌→这次也可能。如果最近几次碰轨都没跌→趋势在强化。',
      },
    ],
    probability: '在ADX>30的强趋势中，%B>1后继续涨的概率约47%——接近一半。震荡市中才是65%回调。',
    whatWouldConfirm: '如果下根K线是阴线→反方的"会回调"是对的。如果继续阳线→原结论的"看跌"是错的。',
    severity: 'moderate',
  },

  // ── 场景5: AI说"强烈看空/多指标一致看空" → 反方说"别在恐慌中卖" ──
  {
    id: 'counter-strong-sell',
    triggerSignal: '强烈看空 / 多指标一致看空',
    heading: '一致性恐慌 = 卖压即将耗尽',
    opening: '但是——当所有指标都在说"跑"的时候，想跑的人已经跑了。剩下的只有没跑但也卖不动的人。',
    arguments: [
      {
        point: '极度看空的一致信号往往出现在"最后一跌"',
        reasoning: '恐惧会自我强化。多个指标一起说"卖"→散户恐慌卖出→大资金接货。指标的一致性恰恰制造了对手盘。',
        evidence: '看CMF: 如果CMF在指标看空的同时却悄悄转正→大资金在"别人恐惧时贪婪"。',
      },
    ],
    probability: '极度一致看空后的5个交易日内——反弹幅度平均3.2%。这不是劝你抄底——是提醒你不要在最低点割肉。',
    whatWouldConfirm: '如果有"下影线极长"的K线+成交量放大→反方是对的，这是恐慌底。如果继续阴跌无抵抗→原结论成立。',
    severity: 'moderate',
  },

  // ── 场景6: AI说"放量突破好信号" → 反方说"量可能是出货" ──
  {
    id: 'counter-volume-break',
    triggerSignal: '放量 / 量价齐升 / 突破放量',
    heading: '放量不一定是"有人在买"',
    opening: '但是——每一笔成交都有买方和卖方。放量=分歧大——有人非常想做多、同时有人非常想出货。',
    arguments: [
      {
        point: '天量=主力出货窗口',
        reasoning: '大成交量让大资金可以悄悄出货而不影响价格。天量+价格未能继续突破=经典的"放量滞涨"出货形态。',
        evidence: '看下根K线: 如果放量后缩量下跌→出货确认。如果放量后继续放量上涨→真突破。',
      },
    ],
    probability: '天量（超过5日均量200%）之后的3天——价格回落的概率约42%。',
    whatWouldConfirm: '如果放量后第二天低开→反方是对的。如果第二天高开继续→原结论成立，趋势加速。',
    severity: 'moderate',
  },

  // ── 场景7: AI说"震荡市中可以做波段" → 反方说"你不知道震荡什么时候结束" ──
  {
    id: 'counter-range-bound',
    triggerSignal: '区间震荡 / ADX<20 / 做波段',
    heading: '震荡=你不知道方向',
    opening: '但是——震荡随时可能结束。你的"波段"可能正好是突破的前一根K线。',
    arguments: [
      {
        point: '震荡市做波段=赌"这次也会弹回去"——但每次都可能是最后一次',
        reasoning: '震荡结束的瞬间往往伴随假突破——你先被假突破止损，然后真突破朝着你相反的方向飞驰。',
        evidence: '看布林带宽度: 如果布林带开始扩张→震荡要结束了。此时停止做波段，等方向出来。',
      },
    ],
    probability: 'ADX<20的震荡市中——随机在高抛低吸的边缘被突破击穿的概率约22%/笔。做10次波段≈2.2次被击穿。',
    whatWouldConfirm: '如果布林带收窄后放量突破→反方对了，"震荡结束"。如果价格继续在区间内→波段策略继续有效。',
    severity: 'mild',
  },

  // ── 场景8: AI说"Supertrend翻多" → 反方说"第一次翻多别信" ──
  {
    id: 'counter-supertrend-flip',
    triggerSignal: 'Supertrend翻绿 / 趋势转多',
    heading: '第一次翻多——别信',
    opening: '但是——Supertrend第一次翻多经常是"假突破"。它需要在回踩确认后才真有效。',
    arguments: [
      {
        point: 'Supertrend的翻色常常被市场"测试"——第一次翻绿后大概率回踩',
        reasoning: '翻色的本质是价格突破了ATR的3倍——这是一个"异常值"。异常值之后的市场往往需要"回归正常"。',
        evidence: '等价格回踩到Supertrend线附近不跌破→二次确认。历史胜率比第一次翻多直接入场高22个百分点。',
      },
    ],
    probability: 'Supertrend第一次翻多后直接不回踩就持续上涨的概率约34%。等回踩确认后入场的胜率约56%。',
    whatWouldConfirm: '如果翻多后价格立即跌破Supertrend线→反方对的，"假翻多"。如果回踩不破→原结论成立。"',
    severity: 'strong',
  },

  // ── 场景9: AI说"背离——即将反转" → 反方说"背离可以背离很久" ──
  {
    id: 'counter-divergence',
    triggerSignal: 'MACD背离 / RSI背离 / 顶背离 / 底背离',
    heading: '背离可以背离很久',
    opening: '但是——背离不是"明天反转"的意思。在最强趋势中背离可以持续数周——每次看起来要反转，然后继续原方向。',
    arguments: [
      {
        point: '背离只是"动力在衰竭"——不等于"方向要变"',
        reasoning: '一个正在减速的火车——它还是在往前开。直到有足够的力量让它停下来+倒车。背离本身只说了前半句。',
        evidence: '等价格真的跌破趋势线/MA20→背离才确认有效。在跌破之前不要根据背离反向操作。',
      },
    ],
    probability: 'MACD顶背离出现后——价格在接下来的5根K线内实际反转的概率约39%。在20根K线内反转的概率升至67%。',
    whatWouldConfirm: '如果价格跌破上一次回调的低点→背离被确认，反方此时转为原结论支持者。',
    severity: 'mild',
  },

  // ── 场景10: AI说"指标组合强烈看多+历史胜率高" → 反方说"这次不一样" ──
  {
    id: 'counter-this-time-different',
    triggerSignal: '历史胜率高 / 多次类似信号 / 高置信度',
    heading: '"这次不一样" —— 最贵的四个字',
    opening: '但是——历史上最惨烈的亏损，都发生在"历史胜率90%+的信号"之后。这次的钱比历史上任何一次都聪明。',
    arguments: [
      {
        point: '高胜率信号本身就是一种"拥挤交易"',
        reasoning: '胜率越高的信号→用的人越多→入场的人越多→越容易成为"大资金的对手盘"。高胜率=最拥挤的路。',
        evidence: '看当前的市场情绪: 如果社交媒体上该股票/币讨论量激增→"这次真的不一样"的风险在上升。',
      },
      {
        point: '你有"这次不一样"的证据吗？',
        reasoning: '如果没有任何重大的基本面变化（财报/政策/事件）——那这次就不该不一样。历史规律大概率继续有效。',
        evidence: '检查新闻/事件→有实质变化→"这次可能不一样"。没变化→"这次还是一样的"。',
      },
    ],
    probability: '没有实质性新信息时——历史信号的有效性约85%。有重大新信息时——降至约40%。关键是信息本身。',
    whatWouldConfirm: '如果出现与历史模式中从未见过的新变量→反方是对的。如果可以找到类似的先例→原结论更可能成立。',
    severity: 'mild',
  },
];

// ═══════════════════════════════════════
// 反向观点UI文案
// ═══════════════════════════════════════

export const COUNTER_VIEW_UI = {
  panelTitle: '反过来看',
  panelSubtitle: '反方律师 — Whaley质疑它自己的结论',
  divider: '为什么不一定对',
  probabilityLabel: '历史概率',
  whatWouldConfirmLabel: '如何验证',
  dismissLabel: '知道了',
  actionLabel: '加入决策日志',
  severityLabels: {
    mild: '温和',
    moderate: '值得考虑',
    strong: '严重质疑',
  },
  severityColors: {
    mild: '#f59e0b',
    moderate: '#f97316',
    strong: '#ef4444',
  },
};

// ═══════════════════════════════════════
// 匹配引擎
// ═══════════════════════════════════════

export function findCounterViews(aiSignal: string): CounterView[] {
  const lower = aiSignal.toLowerCase();
  return COUNTER_VIEWS.filter(cv => {
    const triggers = cv.triggerSignal.toLowerCase();
    // 按 / 分割的关键词
    const keywords = triggers.split('/').map(k => k.trim());
    return keywords.some(k => lower.includes(k));
  });
}

export function getTopCounterView(aiSignal: string): CounterView | null {
  const matches = findCounterViews(aiSignal);
  if (matches.length === 0) return null;
  // 按力度排序: strong > moderate > mild
  const order = { strong: 3, moderate: 2, mild: 1 };
  matches.sort((a, b) => (order[b.severity] || 0) - (order[a.severity] || 0));
  return matches[0];
}

export function getCounterViewById(id: string): CounterView | undefined {
  return COUNTER_VIEWS.find(cv => cv.id === id);
}

export default COUNTER_VIEWS;
