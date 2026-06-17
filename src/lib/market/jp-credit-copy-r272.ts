// ══ R272 QClaw Task 3: 日本信用文案 (2h) ══
// 日本独有: 信用取引(保证金交易)+信用残+追証(追加保证金)
// 交付: src/lib/market/jp-credit-copy-r272.ts

export const JP_CREDIT_COPY = {

  panelTitle: "信用取引",
  panelSubtitle: "保证金交易余额--日本独有的市场情绪指标",

  // ── 1. 信用交易基础 ──
  basics: {
    whatIs: "信用取引=借钱买股票(信用买入)或借股票卖(信用卖出)。日本散户使用信用交易非常普遍--信用余额是日本独有的市场情绪指标。",
    whatIsShort: "日本散户≠中国散户。日本的个人投资者(日経新聞称'個人')喜欢用信用交易做空——所以日本的信用卖出余额是重要的看空指标。",

    terms: {
      marginBuy: "信用買残",
      marginSell: "信用売残",
      marginBuyBalance: "信用买入余额",
      marginSellBalance: "信用卖出余额",
      marginRatio: "信用倍率",
      additionalMargin: "追証",
      outstanding: "未決済残高",
    },
  },

  // ── 2. 信用买卖余额 ──
  balance: {
    title: "信用买卖余额",
    description: "全市场/个股的信用买入余额和信用卖出余额--每周公布两次(周三和周五)",

    marketWide: {
      totalBuyBalance: "全市场信用買残",
      totalSellBalance: "全市场信用売残",
      netBuyBalance: "净买入余额",
      ratio: "買残/売残比率",
    },

    columns: {
      stock: "銘柄",
      buyBalance: "信用買残",
      sellBalance: "信用売残",
      buyChange: "買残增减",
      sellChange: "売残增减",
      netBalance: "净余额",
      marginRatio: "信用倍率",
      sellRatio: "売残比率",
    },

    interpretation: {
      buyUpSellDown: "買残増+売残減 = 散户转向看多 - 但散户是'逆指標'?",
      buyUpSellUp: "買残増+売残増 = 分歧大 - 多头和空头都在加仓",
      buyDownSellUp: "買残減+売残増 = 看空情绪升温 - 散户在减仓买、加仓卖",
      extremeSell: "売残比率>40% = 散户看空浓厚。但这也可能=逼空--太多人做空=潜在买方。",
      lowMarginRatio: "信用倍率<0.6 = 卖残远超买残。极度看空--注意--这可能反而是反向信号。",
    },
  },

  // ── 3. 追証 (追加保证金) ──
  additionalMargin: {
    title: "追証",
    description: "追証=追加保证金通知。当股票跌到一定程度--券商要求追加保证金。如果加不上=强制平仓。日本的追証触发日股价大跌是著名的--市場恐慌。",

    what: "追証=当你的信用交易持仓亏损到一定程度(通常是保证金的30%)--券商要求你在约定日期前追加保证金。加不上=强制平仓(在市场上卖出你的持仓)。",
    whyMatters: "日本很多个人投资者使用信用交易。某只股票的信用买残巨大+股价下跌=大量追証发生=被强制平仓卖出=加速下跌。而且--日本人会按'追証日'(每月特定日期)提前减仓--导致特定日期前抛压集中。",
    schedule: [
      "追証発生日: 每月15日、25日(各证券公司的集中追証结算日)",
      "15日前后的1-2天=抛压增加--散户在追証日之前主动减仓",
      "追証日前3天+追証日当天=最容易出现'追証売り'的窗口--注意相关持仓",
    ],

    warning: "⚠️ 如果你持有信用買残大的股票--注意追証日。这几天可能出现不计成本的抛售。",
  },

  // ── 4. 个股信用面板 ──
  stockDetail: {
    title: "信用取引状況 - {symbol}",
    buyBalance: "信用買残: {amount}株",
    sellBalance: "信用売残: {amount}株",
    buyChangeWeek: "買残周比: {change}",
    sellChangeWeek: "売残周比: {change}",
    marginRatio: "信用倍率(買残÷売残): {ratio}",
    daysToCover: "売残回転日数: {days}日",

    signals: {
      buyBalanceSpike: "買残急増 = 散户大量借钱买入 - 如果股价不涨=危险 - 这些买残随时可能变成'追証売'",
      sellBalanceSpike: "売残急増 = 散户大量做空 - 如果股价不跌=空头会被迫买回(踏み上げ/逼空)",
      buyBalanceCrater: "買残急減 = 散户被迫平仓(追証売) - 是下跌中的加速器",
      daysToCoverHigh: "回転日数>10天 = 卖空量大 - 如果股价突然涨,这些空头需要很多天才能买回来",
    },

    notes: {
      disclosure: "信用残数据由各交易所每周公布两次(水曜日·金曜日)。数据有2-3天延迟--不是实时数据。",
      retailCharacter: "日本的信用交易主要由个人投资者使用--所以信用余额反映的是'散户'的态度,不是机构的。日本散户的历史记录是: 长期群体性的反向指标。",
    },
  },

  // ── 5. 通知模板 ──
  alerts: {
    sellSpike: "🇯🇵 {symbol} 信用売残急増 - 前周比{change}% - 散户看空激增",
    buySpike: "🇯🇵 {symbol} 信用買残急増 - 前周比{change}% - 散户借钱买入激增",
    marginCall: "⚠️ {symbol} 接近追証日 - 信用買残{balance}株 - 注意抛售风险",
    ratioExtreme: "🇯🇵 {symbol} 信用倍率{ratio} - {interpretation}",
  },
};

export default JP_CREDIT_COPY;
