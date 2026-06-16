// ══ R245 QClaw P1-06: 因子信号翻译器文案 (20核心因子) ══
// Each factor: high/low/normal signal translation in natural language
// Principle: "不看数字看含义" — user shouldn't need to know what RSI=70 means

export type SignalLevel = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';

export interface FactorSignalTemplate {
  factorId: string;
  displayName: string;
  /** Template for "what does a high value mean" */
  highSignal: string;
  /** Template for "what does a low value mean" */
  lowSignal: string;
  /** Combined: current value + context = what to do */
  templates: {
    /** e.g. "RSI 78 = 市场太热了，别追高，等回调再买" */
    extremeHigh: string;
    /** e.g. "RSI 22 = 市场太冷了，超卖区，可以分批买" */
    extremeLow: string;
    /** e.g. "RSI 55 = 平平无奇，既不过热也不过冷，等信号" */
    normal: string;
    /** e.g. "RSI从80跌到55 = 过热情绪在消退，不是买入信号" */
    falling: string;
    /** e.g. "RSI从25涨到50 = 恐慌情绪在恢复，可以考虑跟进了" */
    rising: string;
  };
}

export const FACTOR_SIGNAL_TEMPLATES: Record<string, FactorSignalTemplate> = {
  // ── 1. RSI ──
  RSI_14: {
    factorId: 'RSI_14',
    displayName: '买卖热度计',
    highSignal: '买方力量压倒性强势',
    lowSignal: '卖方力量压倒性强势',
    templates: {
      extremeHigh: 'RSI {value} = 📈 市场太热了，大家都冲进去了。别追高，等回到60以下再考虑买入。如果你已经持有，可以考虑卖一部分锁利。',
      extremeLow: 'RSI {value} = 📉 市场太冷了，恐慌过头了。历史上这种位置分批买入胜率高于60%。建议分3次建仓，别一次梭哈。',
      normal: 'RSI {value} = 😐 刚刚好，既不太热也不太冷。现在的价格比较公允，可以按你原定计划操作。',
      falling: 'RSI从{prev}降到{value} = 🌡️ 热度在退。如果是从极端区(>70)降下来，说明冲进去的人在获利了结，不一定代表趋势逆转。',
      rising: 'RSI从{prev}涨到{value} = 🔥 情绪在回暖。如果是从超卖区(<30)起来，而且配合放量，那就是真正的反转信号。',
    },
  },

  // ── 2. MACD ──
  EMA_12_26: {
    factorId: 'EMA_12_26',
    displayName: '趋势加速器',
    highSignal: '短期趋势远强于长期趋势',
    lowSignal: '短期趋势远弱于长期趋势',
    templates: {
      extremeHigh: 'MACD柱{value} = 📡 多头信号强劲！趋势向上且加速中。持股不动就好，别自作聪明做波段。',
      extremeLow: 'MACD柱{value} = 📡 空头信号强劲！趋势向下且加速中。别抄底，离场观望，等MACD柱开始收窄再考虑。',
      normal: 'MACD柱{value} ≈ 0 = 😐 没有明显趋势。市场在震荡，频繁交易会亏手续费，减少操作频率。',
      falling: 'MACD柱正在缩短 = ⚠️ 上涨动能减弱！不是卖出信号，但要做好心理准备——可能进入调整期。',
      rising: 'MACD柱正在拉长 = ✅ 趋势加速中！顺势加仓的最佳时机，设好移动止损跟着走。',
    },
  },

  // ── 3. BOLL ──
  BOLL: {
    factorId: 'BOLL',
    displayName: '价格弹性带',
    highSignal: '价格突破了上轨',
    lowSignal: '价格跌穿了下轨',
    templates: {
      extremeHigh: '布林带：价格突破上轨 📈 = 强势突破！如果是放量突破，这是趋势启动的信号，别急着卖。如果是无量冲高，可能假突破。',
      extremeLow: '布林带：价格跌破下轨 📉 = 超跌！历史统计：89%的情况下会回到布林带中轨。可以先买半仓，回到中轨再加。',
      normal: '布林带：价格在通道内 = 😐 正常波动范围，无特别信号。注意看带宽——收窄时预示变盘。',
      falling: '价格从上轨回落到中轨 = 强势股回调，正常行为。中轨附近如果能企稳，是加仓位置。',
      rising: '价格从下轨反弹到中轨 = 弱势股反弹。如果能继续突破中轨，说明趋势可能逆转。',
    },
  },

  // ── 4. MA金叉死叉 ──
  MA_20_60: {
    factorId: 'MA_20_60',
    displayName: '金叉死叉',
    highSignal: '20日均线上穿60日均线',
    lowSignal: '20日均线下穿60日均线',
    templates: {
      extremeHigh: '✨ 金叉刚刚形成！20日线从下方穿越60日线 = 经典买入信号。但要看成交量——放量金叉才可信。',
      extremeLow: '💀 死叉刚刚形成！20日线从上方跌穿60日线 = 经典卖出信号。短期大概率走弱，减仓保护本金。',
      normal: '两线缠绕 = 震荡行情的标志。金叉死叉频繁切换，别按这个操作，容易反复打脸。',
      falling: '两线距离在收窄 = ⚠️ 可能即将死叉。注意减仓或设保护性止损。',
      rising: '两线距离在扩大 = ✅ 金叉后趋势加速。hold住，让利润跑。',
    },
  },

  // ── 5. KDJ ──
  KDJ: {
    factorId: 'KDJ',
    displayName: '短线方向盘',
    highSignal: 'K/D/J全部80以上',
    lowSignal: 'K/D/J全部20以下',
    templates: {
      extremeHigh: 'KDJ {value} = 🔥 三线全部超买区！短线回调压力大。如果J值>100且拐头，可以考虑T+0卖出一半。',
      extremeLow: 'KDJ {value} = ❄️ 三线全部超卖区！短线反弹概率高。但要做短线——赚5-10个点就走，别幻想大行情。',
      normal: 'KDJ {value} = 😐 常规区域，无明确信号。等K线和D线形成交叉再加码。',
      falling: 'J值从高位快速下降 = 短线资金在离场。别追，等J值企稳。',
      rising: 'J值从低位快速上升 = 短线资金在进场。可以小仓位跟一把，止损设在前期低点。',
    },
  },

  // ── 6. ATR ──
  ATR_14: {
    factorId: 'ATR_14',
    displayName: '波动体温计',
    highSignal: '价格波动异常放大',
    lowSignal: '价格波动异常缩小',
    templates: {
      extremeHigh: 'ATR飙升到{value} = 🌊 波动爆炸！你的止损要放宽（至少2倍ATR），否则会被噪音震出去。仓位也要缩小——波动大=风险大。',
      extremeLow: 'ATR低迷{value} = 🏖️ 风平浪静。但平静之后往往是风暴——变盘在即。现在不宜开新仓，等方向明确。',
      normal: 'ATR {value} = 正常波动水平，按你的常规止损止盈设置即可。',
      falling: 'ATR在下降 = 波动在收敛，市场在积蓄能量。这种时候的突破信号最可靠。',
      rising: 'ATR在上升 = 波动在放大，风险在增加。降低仓位，扩大止损距离。',
    },
  },

  // ── 7. ADX ──
  ADX: {
    factorId: 'ADX',
    displayName: '趋势强度计',
    highSignal: '趋势非常强劲(ADX>40)',
    lowSignal: '无明显趋势(ADX<20)',
    templates: {
      extremeHigh: 'ADX {value} = 🚀 超强趋势！不管多空，趋势就是你的朋友。不要逆势操作，顺着走，设追踪止损。',
      extremeLow: 'ADX {value} = 😐 震荡市。这个阶段不适合趋势策略——你的金叉死叉信号都不靠谱。改用震荡指标（RSI/KDJ更有效）。',
      normal: 'ADX {value} 在20-40 = 趋势正在形成中。耐心等ADX突破40确认。',
      falling: 'ADX从高位下降 = 趋势在衰竭。可以平掉一半仓位，等重新加速再加回来。',
      rising: 'ADX突破25向上 = 趋势正在启动！这是入场的最佳时机，止损可以设在最近低点。',
    },
  },

  // ── 8. OBV ──
  OBV: {
    factorId: 'OBV',
    displayName: '量价验证器',
    highSignal: 'OBV创新高配合价格上涨',
    lowSignal: 'OBV创新低配合价格下跌',
    templates: {
      extremeHigh: 'OBV创新高，价格也创新高 = ✅ 量价齐升，真正的上涨！机构和散户都在买，hold住。',
      extremeLow: 'OBV创新低，价格也创新低 = ❌ 量价齐跌，真正的下跌！有人在持续出货，先离场等信号。',
      normal: 'OBV与价格同步 = 正常状态，量价一致，无特别信号。',
      falling: 'OBV在跌但价格在涨 = 🚩 量价背离！这是危险信号——上涨是靠不住的。考虑减仓或设保护性止盈。',
      rising: 'OBV在涨但价格在跌 = 💡 量价背离！聪明钱在悄悄吸纳。可以密切观察，等价格也转头就跟。',
    },
  },

  // ── 9. VWAP ──
  VWAP: {
    factorId: 'VWAP',
    displayName: '机构成本线',
    highSignal: '价格远高于VWAP',
    lowSignal: '价格远低于VWAP',
    templates: {
      extremeHigh: '价格远高于VWAP = 今天买的人平均成本比你低很多。你不划算。等价格回调到VWAP附近再买，省几个点。',
      extremeLow: '价格远低于VWAP = 今天所有买家平均都在亏钱。这是个日内机会——回到VWAP就是5-8个点的空间。',
      normal: '价格在VWAP附近 = 当前价即是公允价，日内无特别优势。',
      falling: '价格从上方跌穿VWAP = 卖盘在接手，日内走势转弱。如果跌破后回抽不过VWAP，是短线卖出信号。',
      rising: '价格从下方突破VWAP = 买盘在接手，日内走势转强。突破后回踩靠到VWAP是好的日内入场点。',
    },
  },

  // ── 10. 资金费率 (Crypto) ──
  CRYPTO_FUNDING: {
    factorId: 'CRYPTO_FUNDING',
    displayName: '多空温度计',
    highSignal: '多头极度拥挤(费率>0.1%)',
    lowSignal: '空头极度拥挤(费率<-0.05%)',
    templates: {
      extremeHigh: '资金费率 {value}% = 🔥 多头太拥挤了！所有人都做多，潜在的踩踏风险。如果你是做多，要么平仓要么设紧止损。如果你在观望，等着爆多单后抄底。',
      extremeLow: '资金费率 {value}% = ❄️ 空头太拥挤了！所有人都做空，逼空风险极高。如果你是做空，保护好自己。这是做多的好时机——空头在给你付钱。',
      normal: '资金费率 {value}% = 市场情绪正常，多空均衡。',
      falling: '资金费率从正转负 = 多头在撤退，情绪在降温。注意可能是一波回调的开始。',
      rising: '资金费率从负转正 = 空头在撤退，情绪在回暖。可能是一波上涨的开始。',
    },
  },

  // ── 11. Fear & Greed ──
  FEAR_GREED_INDEX: {
    factorId: 'FEAR_GREED_INDEX',
    displayName: '市场心情表',
    highSignal: '极度贪婪(Greed>75)',
    lowSignal: '极度恐惧(Fear<25)',
    templates: {
      extremeHigh: '贪婪指数{value} = 🤑 市场太亢奋了！巴菲特说"别人贪婪我恐惧"。现在不是all in的时候，逐步减仓，保留现金。但不要做空——贪婪可以持续很久。',
      extremeLow: '恐惧指数{value} = 😱 市场太恐慌了！巴菲特说"别人恐惧我贪婪"。这是长期价值投资者的黄金买入区。分3-5次建仓，不要一次性买入。',
      normal: '恐惧贪婪指数{value} = 😐 市场情绪适中，估值相对合理。',
      falling: '恐惧贪婪指数在下降 = 情绪在恶化。短期内还会跌——但越往下越接近买入区。准备好现金。',
      rising: '恐惧贪婪指数在上升 = 情绪在回暖。从恐惧到中性是最舒服的上涨阶段，可以适当加仓。',
    },
  },

  // ── 12. VIX ──
  US_VIX: {
    factorId: 'US_VIX',
    displayName: '华尔街恐惧表',
    highSignal: 'VIX>30, 极度恐慌',
    lowSignal: 'VIX<12, 极度安逸',
    templates: {
      extremeHigh: 'VIX {value} = 😨 华尔街在发抖！通常是买入机会——历史上VIX>30时买入持有1年，胜率>80%。但不要一次买完，VIX可以更高。',
      extremeLow: 'VIX {value} = 😴 华尔街在睡觉！所有人都很安逸——但安逸期越长，积累的风险越大。减仓到7成，留现金等突发机会。',
      normal: 'VIX {value} 12-20 = 正常波动水平，市场健康。',
      falling: 'VIX在下降 = 恐慌情绪在消退，市场在恢复信心。这是最舒服的上涨期。',
      rising: 'VIX在上升 = 恐慌情绪在蔓延，市场在定价不确定性。如果你的持仓对波动敏感，先减仓。',
    },
  },

  // ── 13. 动量12M ──
  MOM_12M: {
    factorId: 'MOM_12M',
    displayName: '年度赢家榜',
    highSignal: '过去12个月涨幅Top 10%',
    lowSignal: '过去12个月跌幅Top 10%',
    templates: {
      extremeHigh: '12月动量{value}% = 🏆 年度大赢家！市场里有句老话"让赢家继续赢"——除非趋势明显走弱，别急着卖掉赚钱的票。但也要设好止盈点。',
      extremeLow: '12月动量{value}% = 📉 年度大输家。要么基本面真的出了问题，要么就是被市场过度惩罚。如果是后者，反弹空间大。但要搞清楚哪个。',
      normal: '12月动量{value}% = 过去一年表现和市场差不多，没有明显的动量信号。',
      falling: '12月动量在衰减 = 曾经的强势股在走弱。如果是从高位衰减，可能是趋势拐点，要小心。',
      rising: '12月动量在增强 = 这只股票正在加速上涨。趋势跟进的信号，可以考虑加仓。',
    },
  },

  // ── 14. MVRV (Crypto) ──
  CRYPTO_MVRV: {
    factorId: 'CRYPTO_MVRV',
    displayName: '比特币盈亏表',
    highSignal: 'MVRV>3.7, 持有人平均赚3.7倍以上',
    lowSignal: 'MVRV<1, 持有人平均在亏损',
    templates: {
      extremeHigh: 'MVRV Z-Score {value} = 🚨 比特币持有人平均赚超3.7倍！历史上这个位置都是牛市顶部区域。逐步卖出，别恋战。但不要做空——疯狂期可能比你撑得久。',
      extremeLow: 'MVRV Z-Score {value} < 0 = 🟢 比特币持有人平均在亏损！历史上这是最好的买点——每次MVRV进入负值最终都涨回来了。分批买入，长期持有。',
      normal: 'MVRV {value} 1-2.5 = 估值合理区间，持有人平均有小幅盈利。',
      falling: 'MVRV在下降 = 市场在冷却。如果降到1以下就是囤币机会。',
      rising: 'MVRV在上升 = 市场在变热。超过3时要开始警惕。',
    },
  },

  // ── 15. Put/Call Skew ──
  PUT_CALL_SKEW: {
    factorId: 'PUT_CALL_SKEW',
    displayName: '聪明钱暗号',
    highSignal: '看跌期权远贵于看涨(恐慌)',
    lowSignal: '看涨期权远贵于看跌(亢奋)',
    templates: {
      extremeHigh: 'Put/Call偏度极高 = 🛡️ 大资金在疯狂买保险！机构在押注大幅下跌。短期要小心——但很多时候机构买Put只是常规对冲，别过度恐慌。',
      extremeLow: 'Put/Call偏度极低 = 🎉 市场过度乐观！没人觉得会跌。但历史告诉我们：所有人松懈的时候最危险。检查你的仓位，该保护的保护。',
      normal: 'Put/Call偏度正常 = 市场对涨跌没有极端看法，风险定价合理。',
      falling: '偏度从极端向正常回归 = 恐慌情绪在消退。这是个好信号。',
      rising: '偏度在持续上升 = 有人在持续买入保护。关注是否有你不知道的风险事件。',
    },
  },

  // ── 16. 爆仓量 (Crypto) ──
  CRYPTO_LIQUIDATIONS: {
    factorId: 'CRYPTO_LIQUIDATIONS',
    displayName: '爆仓探测器',
    highSignal: '大量多头被强制平仓',
    lowSignal: '大量空头被强制平仓',
    templates: {
      extremeHigh: '24h爆仓{value}M USDT = 💥 大规模多头爆仓！市场在清算杠杆——这是残酷但必要的清洗。爆完后通常会有反弹：别人割肉你买，等恐慌稳定后缓缓进场。',
      extremeLow: '24h爆仓{value}M USDT = 💥 大规模空头爆仓！市场在轧空——如果你做多，这是最佳状态。但如果还没进场，别追——轧空结束回踩是更好的买点。',
      normal: '爆仓量正常水平 = 市场杠杆健康，没有踩踏风险。',
      falling: '爆仓量在减少 = 市场情绪趋于稳定，杠杆在合理化。',
      rising: '爆仓量在激增 = ⚠️ 杠杆在清算！不要急着入场——等爆仓量开始下降+价格企稳，才是安全时点。',
    },
  },

  // ── 17. Max Drawdown ──
  MAX_DRAWDOWN: {
    factorId: 'MAX_DRAWDOWN',
    displayName: '历史深坑',
    highSignal: '当前离历史最大的坑很近',
    lowSignal: '当前远高于所有历史坑',
    templates: {
      extremeHigh: '当前价格离历史最大回撤只剩{value}% = 📍 接近历史底部区域。如果你能接受再跌10%的可能，这里位置已经很好了。',
      extremeLow: '当前回撤仅{value}% = 📍 看起来很美但要注意——涨越多回撤空间越大。设好保护，锁住利润。',
      normal: '回撤{value}% = 正常的调整范围，不用太紧张。',
      falling: '回撤在扩大 = 市场在下跌。计算你的底线：你能接受的最大亏损是多少？如果快到了，该减仓就减仓。',
      rising: '回撤在缩小 = 价格在恢复。说明你安全了——但别放松警惕，新一轮回撤随时可能开始。',
    },
  },

  // ── 18. 市盈率EP ──
  EP_RATIO: {
    factorId: 'EP_RATIO',
    displayName: '便宜还是贵',
    highSignal: '市盈率很低=很便宜',
    lowSignal: '市盈率很高=很贵',
    templates: {
      extremeHigh: '市盈率非常低 = 💰 这只股票很便宜！但需要问：是真的便宜还是价值陷阱？看下ROE是否高于10%——如果ROE也高，那可能是真便宜。',
      extremeLow: '市盈率非常高/亏损 = ⚠️ 这只股票很贵甚至亏损。买这种票就是在赌未来——要么爆发要么归零。用小仓位参与，心态要放平。',
      normal: '市盈率{value} = 和行业平均水平差不多，估值合理。',
      falling: '市盈率在下降 = 要么股价在跌(便宜了)，要么利润在涨(公司变好了)。搞清楚是哪种——前者要小心，后者是好消息。',
      rising: '市盈率在上升 = 要么股价在涨(贵了)，要么利润在降(公司变差了)。如果是靠利润增长驱动的估值上升，说明市场看好未来。',
    },
  },

  // ── 19. Accruals ──
  ACCRUALS: {
    factorId: 'ACCRUALS',
    displayName: '利润真不真',
    highSignal: '利润中现金比例高(真金白银)',
    lowSignal: '利润中应收/存货比例高(纸面富贵)',
    templates: {
      extremeHigh: '应计比率极低 = ✅ 利润来自真金白银的现金！这家公司的利润质量非常高，做账保守。可以放心持有。',
      extremeLow: '应计比率极高 = 🚩 利润里大部分是应收账款和存货！可能是在做账。如果连续2个季度应计率>50%，坚决回避。',
      normal: '应计率正常 = 利润质量处于健康范围，没有明显的问题。',
      falling: '应计率在下降 = 利润质量在改善。现金流在好转，是好信号。',
      rising: '应计率在上升 = 利润质量在恶化。销售收入没问题但现金没到账——可能是客户在拖款或库存积压。',
    },
  },

  // ── 20. 波动率 ──
  VOL_60D: {
    factorId: 'VOL_60D',
    displayName: '颠簸程度',
    highSignal: '极度颠簸(高波动)',
    lowSignal: '异常平稳(低波动)',
    templates: {
      extremeHigh: '60日波动率{value}% = 🎢 这只股票非常颠簸！坐稳了——每天4-5%的振幅是家常便饭。你的仓位要减半，止损要放得比平时宽两倍。',
      extremeLow: '60日波动率{value}% = 🛤️ 异常平稳。要么这只股票没人关注，要么就是暴风雨前的宁静。历史上低波动之后往往跟着大行情——但方向不确定。',
      normal: '波动率{value}% = 正常的日内波动范围，交易体验舒适。',
      falling: '波动率在下降 = 市场在稳定下来。之前的高波动恐慌期正在过去。',
      rising: '波动率在上升 = 市场在变得更躁动。这意味着方向的确定性在增加——但也意味着要用更小的仓位参与。',
    },
  },
};

/** Generate a signal message by plugging factor value into template */
export function translateSignal(
  factorId: string,
  currentValue: number,
  prevValue?: number,
  context?: string
): string {
  const tmpl = FACTOR_SIGNAL_TEMPLATES[factorId];
  if (!tmpl) return `${factorId} 当前值: ${currentValue}`;

  let msg: string;
  // Determine which template to use
  let level: keyof typeof tmpl.templates;
  if (currentValue > 75) level = 'extremeHigh';
  else if (currentValue < 25) level = 'extremeLow';
  else if (prevValue !== undefined && currentValue < prevValue) level = 'falling';
  else if (prevValue !== undefined && currentValue > prevValue) level = 'rising';
  else level = 'normal';

  msg = tmpl.templates[level]
    .replace('{value}', String(currentValue))
    .replace('{prev}', String(prevValue ?? '—'));

  if (context) msg = `[${context}] ` + msg;
  return msg;
}

export default FACTOR_SIGNAL_TEMPLATES;
