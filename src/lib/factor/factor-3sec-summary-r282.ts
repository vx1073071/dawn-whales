// ══ R282 QClaw Task 2: 3秒摘要文案生成器 (2h) ══
// 交付: src/lib/factor/factor-3sec-summary-r282.ts
//
// 给每个因子生成一个「3秒看懂」的摘要：
// - 格式: emoji + 一句话（≤12汉字）
// - 注入逻辑: 不是从 Registry 直接读取 nameCn，而是说「这个因子能帮你做什么」
// - 用于: ML R282 因子卡片折叠L1 + 搜索hover + 推送通知标题

export interface Factor3SecSummary {
  factorId: string;
  /** emoji前端展示 */
  emoji: string;
  /** ≤12汉字，回答"这个因子能帮我做什么" */
  summary: string;
  /** 信号方向 → 不同的话 */
  signalContext: {
    bullish: string;   // 因子看涨时怎么说
    bearish: string;   // 因子看跌时怎么说
    neutral: string;   // 无信号时怎么说
  };
}

// ═══════════ 3秒摘要生成规则 ═══════════
export const SUMMARY_RULES = {
  maxLength: 12,  // 汉字
  prefixEmoji: true,
  tone: '口语化 + 行动指向',
  antiPatterns: [
    '不要用因子英文名直接翻译',
    '不要说技术术语（除非你正在新手视角）',
    '不要超过12字（屏幕上可以一排展示）',
    '不要用「因子」「指标」这些词——直接用',
  ],
  // 按 L1 大类 → 摘要模板
  templates: {
    L1_CLASSIC: '说明这个因子衡量的是股价的哪个维度',
    L1_FUNDAMENTAL: '说明这个因子从财报里挖到了什么',
    L1_ANALYST: '说明分析师在告诉你什么方向',
    L1_SENTIMENT: '说明市场情绪正在往哪边偏',
    L1_TECHNICAL: '说明图表在发生什么',
    L1_RISK: '说明风险有多大，你扛不扛得住',
    L1_MACRO: '说明大环境对这个股票的影响',
    L1_REVERSAL: '说明市场是不是该回头了',
    L1_US: '说明美国市场的特定信息',
    L1_HK: '说明香港市场的特定信息',
    L1_CRYPTO: '说明币圈的特定信号',
    L1_CROSS_ASSET: '说明不同资产之间的关系',
    L1_EVENT: '说明来了什么事件，要怎么应对',
    L1_ESG: '说明公司的良心和未来',
    L1_COMMODITY: '说明大宗商品的供需或情绪',
  },
};

// ═══════════ 核心因子3秒摘要表（采样 — 完整版由 Registry 自动生成） ═══════════
export const FACTOR_3SEC_SUMMARIES: Factor3SecSummary[] = [
  // Classic
  { factorId: 'MKT', emoji: '📈', summary: '涨跌跟大盘走多深', signalContext: { bullish: '牛市里它最猛', bearish: '熊市你别碰它', neutral: '正合适 — 跟着大盘走' } },
  { factorId: 'SIZE', emoji: '🐟', summary: '小公司比大公司有爆发力', signalContext: { bullish: '小票正在起飞', bearish: '大票是避风港', neutral: '大小均衡' } },
  { factorId: 'HML', emoji: '🏷️', summary: '便宜的公司值不值得买', signalContext: { bullish: '便宜货机会来了', bearish: '便宜是陷阱别踩', neutral: '合理定价' } },
  { factorId: 'MOM_12M', emoji: '🚀', summary: '过去1年涨最好的还在涨', signalContext: { bullish: '强者恒强快追上', bearish: '涨过头了要注意', neutral: '走一步看一步' } },
  { factorId: 'MOM_6M', emoji: '⚡', summary: '半年冠军还能继续赢吗', signalContext: { bullish: '中期趋势在加速', bearish: '可能要歇一歇了', neutral: '不急不缓' } },
  { factorId: 'MOM_1M', emoji: '🔥', summary: '最近急涨的还会涨吗', signalContext: { bullish: '短线还在冲', bearish: '该走了别贪心', neutral: '先观望' } },
  { factorId: 'QUAL', emoji: '⭐', summary: '它是真优质还是在讲故事', signalContext: { bullish: '好公司正在发光', bearish: '优质股也被错杀', neutral: '质量稳健' } },
  { factorId: 'GROWTH', emoji: '🌱', summary: '未来赚钱速度会不会更快', signalContext: { bullish: '增长正当时', bearish: '增速要放缓了', neutral: '和预期一致' } },
  { factorId: 'YIELD', emoji: '💸', summary: '躺收分红能赚多少', signalContext: { bullish: '分红在涨', bearish: '分红要被砍', neutral: '分红稳定' } },

  // Fundamental
  { factorId: 'F_SCORE', emoji: '🩺', summary: '财务健康9项体验不踩雷', signalContext: { bullish: '身体倍儿棒', bearish: '账上有猫腻', neutral: '体检过关' } },
  { factorId: 'ACCRUALS', emoji: '📋', summary: '赚的是真钱还是账面利润', signalContext: { bullish: '真金白银', bearish: '纸上富贵', neutral: '利润真实' } },
  { factorId: 'FREE_CASH_FLOW', emoji: '💎', summary: '该花的都花了还剩多少钱', signalContext: { bullish: '现金流在变厚', bearish: '钱越来越紧', neutral: '现金流稳定' } },
  { factorId: 'ROIC', emoji: '🧠', summary: '投下的每块钱赚回多少', signalContext: { bullish: '回报远超成本', bearish: '回报越来越低', neutral: '还凑合' } },
  { factorId: 'DEBT_TO_EQUITY', emoji: '⚡', summary: '借的钱是自有资金的几倍', signalContext: { bullish: '杠杆在降好事', bearish: '借钱太多危险', neutral: '杠杆可控' } },

  // Sentiment
  { factorId: 'FEAR_GREED_INDEX', emoji: '😱', summary: '大家怕得要命时你该买了', signalContext: { bullish: '等等收收别冲动', bearish: '慢慢开始买', neutral: '一切正常' } },
  { factorId: 'INSIDER_TRADING', emoji: '🕵️', summary: '知道最多的人 — 老板 — 在买还是卖', signalContext: { bullish: '老板们在加仓', bearish: '老板们在跑路', neutral: '没人有动作' } },
  { factorId: 'INSTITUTIONAL_FLOW', emoji: '🐋', summary: '管几百亿的人在买什么', signalContext: { bullish: '机构在进场', bearish: '机构在撤退', neutral: '在观望' } },
  { factorId: 'SHORT_CROWDING', emoji: '🐑', summary: '做空的人太多 — 小心踩踏反弹', signalContext: { bullish: '空头要被打爆了', bearish: '空头还在加码', neutral: '多空对峙' } },
  { factorId: 'SHORT_SQUEEZE', emoji: '💥', summary: '空头要被炸了 — 炸空的核弹已就位', signalContext: { bullish: '准备好烟花', bearish: '还没到时候', neutral: '还在蓄力' } },

  // Technical
  { factorId: 'MA_20_60', emoji: '📈', summary: '金叉买死叉卖 — 就这四个字', signalContext: { bullish: '金叉买入信号', bearish: '死叉卖出信号', neutral: '还没交叉' } },
  { factorId: 'RSI_14', emoji: '📉', summary: '涨得太猛/跌得太过', signalContext: { bullish: '还可以更猛', bearish: '跌过头该弹了', neutral: '不温不火' } },
  { factorId: 'BOLL', emoji: '📐', summary: '通道被打破就该有大动作', signalContext: { bullish: '突破了上轨', bearish: '跌穿了下轨', neutral: '在带子里晃' } },
  { factorId: 'ADX', emoji: '🧭', summary: '有方向还是迷迷糊糊', signalContext: { bullish: '上升趋势很强', bearish: '下跌趋势很强', neutral: '没方向歇着' } },

  // Risk
  { factorId: 'MAX_DRAWDOWN', emoji: '📉', summary: '历史上最惨跌过多少', signalContext: { bullish: '没大事', bearish: '快破纪录了', neutral: '正常波动' } },
  { factorId: 'CROWDING', emoji: '🐑', summary: '用这个策略的人太多了', signalContext: { bullish: '还能玩一阵', bearish: '人多该跑了', neutral: '还行' } },
  { factorId: 'BAB', emoji: '🧩', summary: '低风险反而能多赚钱', signalContext: { bullish: '稳中求胜', bearish: '可以分批买', neutral: '平平淡淡' } },

  // Macro
  { factorId: 'SECTOR_ROTATION', emoji: '🔄', summary: '大钱在行业间搬到哪了', signalContext: { bullish: '钱往成长流', bearish: '钱往防守流', neutral: '轮动暂停' } },
  { factorId: 'YIELD_CURVE_SLOPE', emoji: '📈', summary: '债市在预示经济吗', signalContext: { bullish: '经济复苏', bearish: '衰退警告', neutral: '正常运行' } },

  // US
  { factorId: 'US_VIX', emoji: '😱', summary: '华尔街恐惧温度计', signalContext: { bullish: '很淡定好', bearish: '大家都慌了', neutral: '正常水平' } },
  { factorId: 'US_BUYBACK', emoji: '♻️', summary: '公司用手里的钱托自己的股价', signalContext: { bullish: '真心回购', bearish: '借钱回购假心', neutral: '没有回购' } },
  { factorId: 'US_SHORT_SQUEEZE', emoji: '🚀', summary: '下一个GameStop在酝酿中吗', signalContext: { bullish: '弹簧压满', bearish: '还没压够', neutral: '没人做空' } },

  // HK
  { factorId: 'HKEX_SOUTHBOUND', emoji: '🇨🇳', summary: '今天内地有多少钱涌入港股', signalContext: { bullish: '钱在排队进来', bearish: '钱在往外跑', neutral: '暂时没人来' } },
  { factorId: 'HK_SHORT_SELL', emoji: '📉', summary: '今天港股成交量多少是砸的', signalContext: { bullish: '做空的在撤退', bearish: '有人在猛砸', neutral: '正常水平' } },
  { factorId: 'HK_CBBC_STREET', emoji: '🐂', summary: '散户在买牛还是熊 — 你反着做', signalContext: { bullish: '散户看空=机会', bearish: '散户看牛=小心', neutral: '多空各半' } },

  // Crypto
  { factorId: 'CRYPTO_FUNDING', emoji: '💸', summary: '赌涨的人多到要交利息了', signalContext: { bullish: '多单松动好买点', bearish: '多单拥挤要回调', neutral: '费率正常' } },
  { factorId: 'CRYPTO_MVRV', emoji: '📊', summary: '所有人都在赚的时候你该跑', signalContext: { bullish: '还能再涨一段', bearish: '大家亏你敢买', neutral: '一般水平' } },
  { factorId: 'CRYPTO_EXCHANGE_RESERVE', emoji: '🏦', summary: '交易所里的币在变多还是变少', signalContext: { bullish: '囤币党在提走=看好', bearish: '有人搬币要卖了', neutral: '正常水平' } },
  { factorId: 'CRYPTO_STABLECOIN_RATIO', emoji: '💵', summary: '等着抄底的子弹有多少', signalContext: { bullish: '弹药充足', bearish: '买盘无力', neutral: '正常水平' } },

  // Cross-Asset
  { factorId: 'GOLD_MOMENTUM', emoji: '🥇', summary: '金价在告诉你风险在哪', signalContext: { bullish: '黄金在涨=避险', bearish: '黄金在跌=风险偏好', neutral: '黄金没动' } },
  { factorId: 'CORR_REGIME', emoji: '🥚', summary: '你的鸡蛋都往一个方向滚吗', signalContext: { bullish: '分散策略有效', bearish: '分散策略失效', neutral: '正常联动' } },

  // Commodity
  { factorId: 'CMD_EIA_CRUDE', emoji: '🛢️', summary: '每周三油库存 — 多还是少', signalContext: { bullish: '库存大减=油价要涨', bearish: '库存大增=油价要跌', neutral: '库存持平' } },
  { factorId: 'CMD_COT_EXTREME', emoji: '⚠️', summary: '聪明钱仓位太极端要反转', signalContext: { bullish: '空头太挤要反弹', bearish: '多头太挤要回调', neutral: '位置正常' } },
  { factorId: 'CMD_GOLD_SILVER_RATIO', emoji: '🥇🥈', summary: '避险情绪vs工业需求', signalContext: { bullish: '白银要补涨了', bearish: '大家一起在避险', neutral: '正中间' } },
  { factorId: 'CMD_DXY_LINKAGE', emoji: '💵', summary: '美元在指挥商品往哪走', signalContext: { bullish: '美元弱=商品涨', bearish: '美元强=商品跌', neutral: '美元没动' } },

  // ESG
  { factorId: 'ESG_SCORE', emoji: '🌍', summary: '良心和风控会保护你的钱', signalContext: { bullish: '良心公司被关注', bearish: 'ESG暴雷风险', neutral: '中规中矩' } },
  { factorId: 'CARBON_INTENSITY', emoji: '🌿', summary: '排碳越多 — 风险越大', signalContext: { bullish: '减碳利好', bearish: '碳风险在升', neutral: '无新变化' } },
];

// ═══════════ 批量生成函数 ═══════════
export function generate3SecSummary(factorId: string, nameCn: string, _l1Category: string): Factor3SecSummary {
  const existing = FACTOR_3SEC_SUMMARIES.find(s => s.factorId === factorId);
  if (existing) return existing;

  // 自动生成回退：用 nameCn 截取前10字 + 通用模板
  const shortName = nameCn.length > 10 ? nameCn.substring(0, 10) + '…' : nameCn;
  return {
    factorId,
    emoji: '📊',
    summary: shortName,
    signalContext: {
      bullish: `${nameCn}看涨 — 跟`,
      bearish: `${nameCn}看跌 — 避`,
      neutral: `${nameCn}无信号 — 不管`,
    },
  };
}

export default FACTOR_3SEC_SUMMARIES;
