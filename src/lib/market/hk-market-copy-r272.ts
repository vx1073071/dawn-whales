// ══ R272 QClaw Task 1: 港股文案 (2h) ══
// 香港市场三大特色: 卖空面板+牛熊证/窝轮+港股通
// 交付: src/lib/market/hk-market-copy-r272.ts

export const HK_MARKET_COPY = {

  // ── 1. 卖空数据面板 ──
  shortSell: {
    panelTitle: "沽空追踪",
    panelSubtitle: "谁在做空、做空了多少——每天早市更新",

    summary: {
      totalShortAmount: "全日沽空额",
      totalShortRatio: "沽空占成交比例",
      topShortStock: "今日最多沽空",
      trend: "近5日趋势",
      interpretation: {
        high: "沽空>20% = 看空情绪浓",
        medium: "沽空10-20% = 正常范围",
        low: "沽空<10% = 少有沽空",
        extreme: "沽空>30% = 极度看空 — 但也要注意逼空风险",
      },
    },

    columns: {
      stock: "股票",
      shortAmount: "沽空额",
      shortRatio: "沽空占比",
      change: "较昨日",
      prevShort: "前日沽空",
      avg5d: "5日均",
    },

    detail: {
      shortVolume: "沽空股数",
      shortValue: "沽空金额",
      totalVolume: "总成交量",
      totalValue: "总成交额",
      shortPrice: "沽空均价",
      outstandingShort: "未平仓沽空",
    },

    tips: {
      whatIs: "沽空=先卖后买。沽空者预期股价会跌——先在高位卖出借来的股票，等跌了再买入还回去赚差价。",
      howToRead: "沽空占比高=市场看空情绪强。但也意味着——如果股价不跌反涨，沽空者会被迫买回(逼空)，反而推高股价。",
      redFlag: "⚠️ 沽空占比>25%+股价在跌=空头得势。沽空>25%+股价不跌=可能有一方判断错了——小心变盘。",
      squeeze: "🔥 沽空高+突然放量涨=逼空行情！沽空者被迫止损买入——短时间内的快速拉升。",
    },

    alerts: {
      spikeTitle: "⚡ 沽空激增 — {symbol} 沽空占比从{prev}%跳到{curr}%",
      spikeBody: "今日沽空额{amount}，占成交{ratio}%。较昨日{change}%。{interpretation}",
      extremeTitle: "🔴 极端沽空 — {symbol} 沽空占比{ratio}%",
      extremeBody: "这是近{days}天最高。注意逼空风险——如果股价不跌反涨可能触发快速反弹。",
    },
  },

  // ── 2. 牛熊证/窝轮面板 ──
  cbbcWarrants: {
    panelTitle: "牛熊证/窝轮",
    panelSubtitle: "衍生品——杠杆工具。风险高。",

    basics: {
      whatIsCBBC: "牛熊证(CBBC)=有收回价的杠杆产品。牛证看涨、熊证看跌。碰到收回价=立即作废=血本无归。",
      whatIsWarrant: "窝轮(认股证)=没有收回价的杠杆产品。有时间价值——越接近到期日越不值钱。",
      keyDifference: "牛熊证有收回机制(碰到特定价格立即作废) / 窝轮没有收回但时间越久越贬值。两个都会亏完——不是买了放着就行。",
    },

    cbbc: {
      bullName: "牛证",
      bearName: "熊证",
      strikePrice: "行使价",
      callPrice: "收回价",
      distance: "距收回价",
      distancePct: "距收回%",
      leverage: "杠杆",
      outstandingQty: "街货量",
      impliedVol: "引伸波幅",
      maturityDate: "到期日",
      issuer: "发行商",

      distanceWarning: {
        far: "距收回价>10% — 安全距离 — 不容易被收回",
        medium: "距收回价5-10% — 注意 — 剧烈波动可能碰到",
        close: "距收回价<5% — ⚠️ 风险 — 短线波动就能收回",
        critical: "距收回价<2% — 🔴 危险 — 随时可能作废",
      },

      streetAnalysis: {
        what: "街货量=市场上有多少牛熊证在流通。街货多=很多人持有这个产品。",
        highBullStreet: "牛证街货多=很多人看好——但也是‘拥挤交易’。一旦反转可能踩踏。",
        highBearStreet: "熊证街货多=很多人看空——空头拥挤。逼空风险。",
      },
    },

    warrant: {
      callName: "认购证",
      putName: "认沽证",
      timeDecay: "时间损耗",
      timeDecayNote: "每过一天窝轮就贬值一点——这是‘为时间付钱’。最后两周贬值最快。",
      delta: "对冲值",
      deltaNote: "Delta≈正股涨1元窝轮涨多少。价外窝轮Delta低=涨得慢。快要到期的价外窝轮Delta趋近0。",
      premium: "溢价",
      premiumNote: "溢价=买窝轮比直接买正股贵多少%。溢价高=市场预期正股大涨/跌。",
      gearing: "杠杆比率",
      gearingNote: "杠杆越高=涨跌越猛。高杠杆=高风险=可能亏得也快。",
    },

    disclaimer: "⚠️ 衍生品交易风险极高——可能损失全部本金。不熟悉牛熊证/窝轮机制请不要碰。",
  },

  // ── 3. 港股通面板 ──
  stockConnect: {
    panelTitle: "港股通资金流",
    panelSubtitle: "内地资金南下/北上的实时动向",

    summary: {
      southbound: "南下资金(沪+深港股通)",
      northbound: "北上资金(沪+深股通)",
      netSouth: "净南下",
      netNorth: "净北上",
      southboundUsed: "港股通额度使用",
      northboundUsed: "股通额度使用",
    },

    interpretation: {
      bigSouth: ">50亿港元南下 = 内地资金大举买入港股 — 可能预示港股权重股行情",
      bigNorth: ">50亿元北上 = 外资通过沪深股通买入A股 — 外资看好信号",
      southOut: "南下资金转负 = 内地资金在卖港股",
      consecutive: "连续{n}天净南下/北上 = 确定性较高 — 不要逆着这个大方向",
    },

    dailyQuota: {
      shSouth: "沪市港股通 {used}/{total}亿",
      szSouth: "深市港股通 {used}/{total}亿",
      shNorth: "沪股通 {used}/{total}亿",
      szNorth: "深股通 {used}/{total}亿",
      remaining: "剩余额度",
    },

    topTrades: {
      topSouthBuy: "南下买入最多",
      topSouthSell: "南下卖出最多",
      topNorthBuy: "北上买入最多",
      topNorthSell: "北上卖出最多",
    },

    tips: {
      whatIs: "港股通=内地投资者可以直接买港股(南下)，外资可以通过沪深股通买A股(北上)。QUANT MOO追踪的是每日资金净流动——不是价格涨跌。",
      whyMatters: "南下/北上资金是大资金的‘态度’。持续净南下=内地机构看好港股。持续净北上=外资看好A股。这是不能用技术分析替代的宏观信号。",
    },
  },
};

export default HK_MARKET_COPY;
