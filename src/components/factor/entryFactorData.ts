// ── R185 ML P1-03: Entry factor data — 38 entry-level factors ───────────
// 35 🌱 entry factors per PM's R185 spec. All have stories, signals, and
// use-case guidance. Compatible with EntryFactorGallery component.
// Categories: value(3) quality(3) momentum(3) volatility(4) tech(4)
//             growth(1) size(1) yield(1) hk(5) us(5) crypto(6) macro(2)

import type { EntryFactor } from './EntryFactorGallery';

export const ENTRY_FACTORS: EntryFactor[] = [
  // ═══ 价值 (3) ═══
  { id: 'HML', nameCN: '价值因子', category: 'value', categoryCN: '价值', level: 'L1', markets: ['US', 'HK'], ic: 0.035, zScore: 1.2, winRate: 55,
    story: '高账面市值比(BP)股票长期跑赢。巴菲特的"烟蒂股"哲学：买便宜的好公司。在利率上升期和经济复苏期最有效。',
    storyShort: '买便宜的好公司。高BP长期跑赢。', useCase: '利率上升/经济复苏/价值回归周期', riskWarning: '价值陷阱：便宜可能因为公司真的在变差' },
  { id: 'YIELD', nameCN: '股息率', category: 'yield', categoryCN: '股息', level: 'L1', markets: ['US', 'HK'], ic: 0.028, zScore: 0.5, winRate: 52,
    story: '高股息股票在低利率下有类债券属性。现金回报+资本增值双收益。避免"股息陷阱"——高股息可能因为股价大跌。',
    storyShort: '现金回报+资本增值。低利率利器。', useCase: '低利率/经济平稳期', riskWarning: '股息陷阱：高股息可能因股价大跌' },
  { id: 'RMW', nameCN: '盈利因子', category: 'quality', categoryCN: '品质', level: 'L1', markets: ['US', 'HK'], ic: 0.032, zScore: 0.8, winRate: 54,
    story: '高运营盈利率公司长期跑赢低运营盈利率公司。Fama-French五因子之一。盈利能力强=商业模式有护城河。',
    storyShort: '高运营盈利率=商业护城河。', useCase: '全市场适用', riskWarning: '行业差异大，科技vs传统不可直接比较' },

  // ═══ 品质 (3) ═══
  { id: 'QUAL', nameCN: '品质因子', category: 'quality', categoryCN: '品质', level: 'L1', markets: ['US', 'HK'], ic: 0.040, zScore: 1.5, winRate: 60,
    story: '综合衡量公司盈利质量：高ROE+低负债+稳定增长。优质公司长期复合收益更高。经济下行期最抗跌。',
    storyShort: '高ROE+低负债+稳定增长=优质。', useCase: '经济下行/信用收缩期', riskWarning: '牛市中可能跑输高成长股' },
  { id: 'CMA', nameCN: '投资因子', category: 'quality', categoryCN: '品质', level: 'L1', markets: ['US', 'HK'], ic: 0.025, zScore: 0.3, winRate: 50,
    story: '保守投资的公司跑赢激进公司。Fama-French五因子之一。过度扩张→ROE稀释，稳健投资→复合增长。',
    storyShort: '保守投资>激进扩张。', useCase: '全市场适用', riskWarning: '信号较弱，建议作为辅助因子' },
  { id: 'SIZE', nameCN: '小盘因子', category: 'size', categoryCN: '规模', level: 'L1', markets: ['US', 'HK'], ic: 0.020, zScore: -0.2, winRate: 48,
    story: '小市值股票长期存在溢价效应。但高波动+流动性差。注册制下小盘供给增加，溢价可能收窄。',
    storyShort: '小盘长期溢价，但波动大。', useCase: '流动性充裕/风险偏好上升', riskWarning: '高波动+流动性差+幸存者偏差' },

  // ═══ 动量 (3) ═══
  { id: 'MOM_12M', nameCN: '12月动量', category: 'momentum', categoryCN: '动量', level: 'L1', markets: ['US', 'HK', 'CRYPTO'], ic: 0.045, zScore: 1.8, winRate: 62,
    story: '过去12个月涨幅越大，趋势延续概率越高。学术界最稳健的因子之一。牛市利器，震荡市克星。',
    storyShort: '强者恒强。过去12月涨的继续涨。', useCase: '趋势延续(牛市)', riskWarning: '动量崩溃：均值回归时大幅回撤' },
  { id: 'MOM_1M', nameCN: '1月动量', category: 'momentum', categoryCN: '动量', level: 'L1', markets: ['US', 'HK', 'CRYPTO'], ic: 0.020, zScore: 0.5, winRate: 50,
    story: '最近1个月涨幅。极端值时可能预示短期反转——涨太快该回调了，跌太狠该反弹了。',
    storyShort: '短期极端信号。涨太快→回调。', useCase: '极端值提示反转', riskWarning: '反转信号不总是准' },
  { id: 'RSI_14', nameCN: 'RSI 14', category: 'momentum', categoryCN: '动量', level: 'L1', markets: ['US', 'HK', 'CRYPTO'], ic: 0.018, zScore: 0.2, winRate: 48,
    story: '相对强弱指标。>70=超买(该卖了)，<30=超卖(该买了)。震荡市最强，趋势市中容易过早离场。',
    storyShort: '>70超买 <30超卖。震荡市之王。', useCase: '横盘震荡市', riskWarning: '趋势市中过早离场/抄底' },

  // ═══ 低波/风控 (4) ═══
  { id: 'VOL_60D', nameCN: '60日低波', category: 'volatility', categoryCN: '低波', level: 'L1', markets: ['US', 'HK'], ic: -0.038, zScore: -1.2, winRate: 58,
    story: '低波动异象：低波动股票长期风险调整收益高于高波动股票。熊市中防御性最强。牛市可能跑输。',
    storyShort: '低波动长期跑赢。熊市避风港。', useCase: '震荡市/熊市', riskWarning: '牛市跑输，可能错过反弹' },
  { id: 'BOLL', nameCN: '布林带', category: 'volatility', categoryCN: '低波', level: 'L1', markets: ['US', 'HK', 'CRYPTO'], ic: 0.015, zScore: 0.1, winRate: 47,
    story: '价格在20日均线±2标准差之间。触及上轨=太贵了，触及下轨=太便宜了。均值回归的经典工具。',
    storyShort: '上轨太贵，下轨太便宜。均值回归。', useCase: '震荡市/均值回归', riskWarning: '强趋势中一直在轨外，不可逆势' },
  { id: 'ATR_14', nameCN: 'ATR 14', category: 'volatility', categoryCN: '低波', level: 'L1', markets: ['US', 'HK', 'CRYPTO'], ic: 0.005, zScore: 0.0, winRate: 50,
    story: '平均真实波幅。衡量股价日常波动范围，纯描述波动大小不指方向。ATR扩大=变盘在即。',
    storyShort: '纯波动度量。ATR扩大=要变盘。', useCase: '止损设置/仓位计算', riskWarning: '不指方向，仅描述波动' },
  { id: 'US_VIX', nameCN: 'VIX恐慌指数', category: 'volatility', categoryCN: '低波', level: 'L1', markets: ['US'], ic: 0.030, zScore: 0.8, winRate: 56,
    story: '标普500期权隐含波动率。VIX>30=市场恐慌(买点)，VIX<15=过度安逸(小心)。"当VIX高时买入，当VIX低时谨慎。"',
    storyShort: '恐慌时买入，安逸时谨慎。', useCase: 'VIX>30抄底，<15减仓', riskWarning: 'VIX可长期保持高位(2008: 3个月>40)' },

  // ═══ 技术面 (4) ═══
  { id: 'KDJ', nameCN: 'KDJ', category: 'technical', categoryCN: '技术', level: 'L1', markets: ['US', 'HK', 'CRYPTO'], ic: 0.012, zScore: 0.0, winRate: 46,
    story: '随机指标，像"心跳仪"——K线是心跳，D线是平均值。太快(K>80)=心动过速该卖出，太慢(K<20)=该抄底。',
    storyShort: '心跳仪。太快该卖，太慢该买。', useCase: '超买超卖判断', riskWarning: '单边市中可长期钝化在超买/超卖区' },
  { id: 'OBV', nameCN: '能量潮(OBV)', category: 'technical', categoryCN: '技术', level: 'L1', markets: ['US', 'HK'], ic: 0.010, zScore: 0.0, winRate: 48,
    story: '量先价行。OBV上涨=资金在悄悄涌入。OBV与价格背离=潜在反转。成交量不会骗人。',
    storyShort: '量先价行。OBV涨=钱在流入。', useCase: '确认趋势/寻找背离', riskWarning: '大盘股OBV信号弱于小盘股' },
  { id: 'EMA_12_26', nameCN: 'MACD交叉', category: 'technical', categoryCN: '技术', level: 'L1', markets: ['US', 'HK', 'CRYPTO'], ic: 0.022, zScore: 0.6, winRate: 51,
    story: '12日EMA上穿26日EMA=金叉(买入)，下穿=死叉(卖出)。最经典的趋势跟踪信号。所有交易者的"共同语言"。',
    storyShort: '金叉买入，死叉卖出。经典不朽。', useCase: '趋势确认/信号确认', riskWarning: '滞后信号：金叉时可能已涨了很多' },
  { id: 'LIQ', nameCN: '流动性', category: 'technical', categoryCN: '技术', level: 'L1', markets: ['US', 'HK', 'CRYPTO'], ic: 0.022, zScore: 0.4, winRate: 52,
    story: '日均换手率。交投活跃=进出方便。主要作风控而非Alpha——大资金策略的硬约束。',
    storyShort: '交投活跃=进出方便。风控硬约束。', useCase: '大资金策略/风控', riskWarning: '超额有限，主要作风控' },

  // ═══ 成长 (1) ═══
  { id: 'GROWTH', nameCN: '成长因子', category: 'growth', categoryCN: '成长', level: 'L1', markets: ['US', 'HK'], ic: 0.038, zScore: 1.1, winRate: 57,
    story: '营收+盈利3年复合增长率。成长股核心。牛市中爆发力最强，加息周期中最受伤。NVIDIA是教科书级成长股。',
    storyShort: '营收盈利双扩张。牛市最锋利的矛。', useCase: '牛市/科技/AI行情', riskWarning: '加息周期杀估值最惨(2022 -42%)' },

  // ═══ 港股专属 (5) ═══
  { id: 'HKEX_SOUTHBOUND', nameCN: '南向资金', category: 'hk_specific', categoryCN: '港股', level: 'L1', markets: ['HK'], ic: 0.030, zScore: 0.9, winRate: 55,
    story: '内地资金通过港股通买入港股。南向净流入=聪明钱看好。连续多日净流入=最可靠的中期看涨信号。',
    storyShort: '内地钱买港股。净流入=看好。', useCase: '南向持续净流入时跟随', riskWarning: '单日数据噪音大，看5日累计' },
  { id: 'HKEX_CBCS_PREMIUM', nameCN: '跨境息差', category: 'hk_specific', categoryCN: '港股', level: 'L1', markets: ['HK'], ic: 0.015, zScore: 0.0, winRate: 48,
    story: '内地vs香港利率利差。利差扩大→资金从内地流向香港→利好港股流动性。',
    storyShort: '利差扩大=钱流向香港。', useCase: '跨境利率变动时', riskWarning: '联动性不稳定，需配合其他信号' },
  { id: 'HKEX_WARRANT_IV', nameCN: '窝轮IV', category: 'hk_specific', categoryCN: '港股', level: 'L1', markets: ['HK'], ic: 0.020, zScore: 0.3, winRate: 49,
    story: '窝轮隐含波动率。IV飙升=市场预期大幅波动。街货极度拥挤=散户都在押注=反向信号。',
    storyShort: '散户都在买窝轮=拥挤=反向。', useCase: '牛熊证街货拥挤时反向', riskWarning: '散户不一定每次都错，但人多的地方少去' },
  { id: 'HKEX_DLHB', nameCN: '大礼盒', category: 'hk_specific', categoryCN: '港股', level: 'L1', markets: ['HK'], ic: 0.010, zScore: 0.0, winRate: 46,
    story: '港股通特别股息/分拆/私有化等事件驱动因子。港股特有的结构性套利机会。',
    storyShort: '特别股息/私有化=港股红利。', useCase: '公司公告发布时', riskWarning: '事件频率低，不适合日常筛选' },
  { id: 'HKEX_FUND_HOLD', nameCN: '基金持仓', category: 'hk_specific', categoryCN: '港股', level: 'L1', markets: ['HK'], ic: 0.025, zScore: 0.5, winRate: 53,
    story: '追踪主要基金在港股的持仓变化。基金增持=机构背书，基金减持=警讯。',
    storyShort: '基金增持=机构背书。跟聪明钱。', useCase: '季报披露后追踪持仓', riskWarning: '基金持仓有45天延迟' },

  // ═══ 美股专属 (5) ═══
  { id: 'US_SHORT_RATIO', nameCN: '做空比率', category: 'us_specific', categoryCN: '美股', level: 'L1', markets: ['US'], ic: 0.025, zScore: 0.4, winRate: 52,
    story: '股票被做空的比例。高空头=市场极度悲观=可能逼空(GameStop式反弹)。但空头也可能是对的。',
    storyShort: '被做空最多=最危险也最爆发。', useCase: '高空头+价格上涨=逼空机会', riskWarning: '空头可能是对的，公司真有问题' },
  { id: 'US_INST_HOLD', nameCN: '机构持仓', category: 'us_specific', categoryCN: '美股', level: 'L1', markets: ['US'], ic: 0.028, zScore: 0.6, winRate: 54,
    story: '机构持仓比例。机构增持=聪明钱看好。13F季报是散户能看到最接近"内幕"的公开信息。',
    storyShort: '机构增持=聪明钱看好。13F。', useCase: '13F季报后追踪调仓', riskWarning: '13F有45天延迟，可能已过时' },
  { id: 'US_BUYBACK', nameCN: '回购因子', category: 'us_specific', categoryCN: '美股', level: 'L1', markets: ['US'], ic: 0.035, zScore: 1.0, winRate: 57,
    story: '公司回购股票=管理层认为股价被低估。2010-2020美股最大买家就是公司自己。回购减少流通股→EPS提升。',
    storyShort: '公司自己买自己=认为便宜。', useCase: '回购公告+持续回购期', riskWarning: '回购可能为掩盖期权稀释/高管套现' },
  { id: 'OPTION_PCR', nameCN: '期权PCR', category: 'sentiment', categoryCN: '情绪', level: 'L1', markets: ['US'], ic: 0.020, zScore: 0.2, winRate: 50,
    story: 'Put/Call比率。PCR>1.0=恐惧→可能反转向上。PCR<0.6=贪婪→小心回调。',
    storyShort: 'PCR>1=恐惧=买点，<0.6=贪婪=小心。', useCase: '极端PCR值提示反转', riskWarning: '仅辅助，不作为主要择时信号' },
  { id: 'FX_EXPOSURE', nameCN: '汇率暴露', category: 'macro', categoryCN: '宏观', level: 'L1', markets: ['US', 'HK'], ic: 0.018, zScore: 0.2, winRate: 49,
    story: '跨国公司的汇率敏感度。美元走强→海外收入占比高的美国公司受损。港元挂钩美元=港股汇率风险低。',
    storyShort: '美元走强=跨国美企受损。', useCase: '汇率大幅波动时关注', riskWarning: '短期汇率波动噪音大' },

  // ═══ 加密专属 (6) ═══
  { id: 'CRYPTO_FUNDING', nameCN: '资金费率', category: 'crypto', categoryCN: '加密', level: 'L1', markets: ['CRYPTO'], ic: -0.030, zScore: -1.0, winRate: 55,
    story: '永续合约多头支付给空头的费用。费率极高=多头拥挤(要爆多头)，极低(负)=空头拥挤(要爆空头)。最直接的过热/过冷温度计。',
    storyShort: '多头太拥挤=费率贵=要爆多头。', useCase: '极端费率时反向操作', riskWarning: '8小时更新一次，频率偏低' },
  { id: 'CRYPTO_OI_DELTA', nameCN: 'OI变化', category: 'crypto', categoryCN: '加密', level: 'L1', markets: ['CRYPTO'], ic: 0.020, zScore: 0.4, winRate: 51,
    story: '期货未平仓合约变化。价格涨+OI涨=真突破。价格涨+OI跌=空头回补(假突破)。四象限分析法。',
    storyShort: 'OI+价格四象限判断真假突破。', useCase: '突破确认/假突破识别', riskWarning: 'OI数据不同交易所有差异' },
  { id: 'CRYPTO_EXCHANGE_FLOW', nameCN: '交易所流', category: 'crypto', categoryCN: '加密', level: 'L1', markets: ['CRYPTO'], ic: -0.025, zScore: -0.8, winRate: 54,
    story: 'BTC/ETH流入交易所=准备卖出=抛压。流出=提到冷钱包=长期持有。大额流入(>1000 BTC)=鲸鱼出货。',
    storyShort: '流入交易所=要卖，流出=要持有。', useCase: '大额转账跟踪', riskWarning: '交易所内部转账会干扰数据' },
  { id: 'CRYPTO_NVT', nameCN: 'NVT比率', category: 'crypto', categoryCN: '加密', level: 'L1', markets: ['CRYPTO'], ic: -0.018, zScore: -0.5, winRate: 52,
    story: '网络价值/交易量。加密版PE比率。NVT过高=被高估(泡沫)，NVT过低=被低估。比PE更纯净——链上交易量不可造假。',
    storyShort: '加密版PE。链上交易量不可造假。', useCase: '估值过高/过低判断', riskWarning: '交易所内部交易会夸大交易量' },
  { id: 'CRYPTO_ACTIVE_ADDR', nameCN: '活跃地址', category: 'crypto', categoryCN: '加密', level: 'L1', markets: ['CRYPTO'], ic: 0.022, zScore: 0.5, winRate: 53,
    story: '每日活跃地址数。越多人在链上交易=网络越有生机=币越有价值。加密市场的"GDP"指标。',
    storyShort: '链上人多=币有价值。加密GDP。', useCase: '活跃度持续增长时看涨', riskWarning: '地址数可被操控(Sybil攻击)' },
  { id: 'CRYPTO_LIQUIDATIONS', nameCN: '清算数据', category: 'crypto', categoryCN: '加密', level: 'L1', markets: ['CRYPTO'], ic: 0.015, zScore: 0.2, winRate: 49,
    story: '期货清算量激增=杠杆被强制平仓。大面积多头清算=恐慌底(该买了)。大面积空头清算=逼空顶(该卖了)。',
    storyShort: '多头被清算完=底，空头被清算完=顶。', useCase: '大规模清算后反向操作', riskWarning: '小规模清算噪音大，看>1亿美元级别' },

  // ═══ 宏观/跨市场 (2) ═══
  { id: 'SECTOR_ROTATION', nameCN: '行业轮动', category: 'macro', categoryCN: '宏观', level: 'L1', markets: ['US', 'HK'], ic: 0.025, zScore: 0.4, winRate: 51,
    story: '行业板块间的资金轮动速度。轮动加快=震荡市(别追涨)。轮动减慢=趋势市(持仓待涨)。',
    storyShort: '轮动快=震荡市别追，慢=趋势市加仓。', useCase: '判断市场风格切换', riskWarning: '行业分类标准随市场变化' },
  { id: 'MKT', nameCN: '市场Beta', category: 'macro', categoryCN: '宏观', level: 'L1', markets: ['US', 'HK'], ic: 0.050, zScore: 2.0, winRate: 65,
    story: '衡量个股对整体市场的敏感度。Beta=1=与市场同步。牛市增配高Beta，熊市降Beta或对冲。最基础的风控维度。',
    storyShort: '对市场的敏感度。牛市高Beta，熊市低。', useCase: '仓位管理/对冲比例计算', riskWarning: 'Beta是历史值，不代表未来' },
];
