// ══ R272 QClaw Task 2: A股涨跌停文案 (2h) ══
// A股独有机制: 涨跌停板(±10%/20%)+封板+连板+炸板+地天板
// 交付: src/lib/market/cn-limit-copy-r272.ts

export const CN_LIMIT_COPY = {

  panelTitle: "涨跌停看板",
  panelSubtitle: "A股独有--没有涨跌停的外国软件看不懂A股",

  // ── 1. 涨跌停基础 ──
  basics: {
    whatIs: "涨跌停板=A股交易价格单日最大波动限制。主板±10%,创业板/科创板±20%,ST股±5%。涨到上限叫涨停,跌到下限叫跌停。",

    thresholds: {
      mainBoard: "主板/中小板: ±10%",
      gem: "创业板: ±20%",
      star: "科创板: ±20%",
      st: "ST\\*ST: ±5%",
      newStock: "新股上市首5日无涨跌停",
      note: "以上为价格限制--不是停牌。达到涨跌停后仍可以交易(涨停板上有人卖、跌停板上有人买)但价格不再变化。",
    },

    key: {
      limitUp: "涨停",
      limitDown: "跌停",
      sealBoard: "封板",
      boardBreak: "炸板",
      boardOpen: "开板",
      consecutiveUp: "连板",
      consecutiveDown: "连跌停",
      floorToCeiling: "地天板",
      ceilingToFloor: "天地板",
      volumeSpike: "放量",
    },
  },

  // ── 2. 涨停面板 ──
  limitUp: {
    title: "涨停股票",
    columns: {
      stock: "股票",
      price: "涨停价",
      sealAmount: "封单额",
      sealRatio: "封单比",
      consecutive: "连板",
      firstLimitTime: "首封时间",
      turnover: "换手率",
      boardOpenCount: "炸板次数",
    },

    sealInterpretation: {
      strong: "封单>成交额10倍 = 强势封板 - 当天基本不可能打开",
      normal: "封单3-10倍 = 正常封板 - 有小概率打开",
      weak: "封单<3倍 = 弱封 - 可能开板",
      ticking: "封单<成交额 = 随时可能开板",
    },

    firstLimitTime: {
      morning: "09:30前涨停 = 最强 - 开盘秒板",
      early: "09:30-10:30涨停 = 强 - 早盘抢封",
      midday: "10:30-14:00涨停 = 一般 - 午后封板",
      late: "14:00-14:57涨停 = 弱 - 尾盘偷袭封板",
      closing: "14:57涨停 = 最弱 - 集合竞价封板,可能是拉高出货",
    },

    turnover: {
      low: "换手<3% = 筹码锁定好 - 明天大概率继续",
      medium: "换手3-10% = 正常 - 封板中有人在卖",
      high: "换手>10% = 高位换手 - 明天分歧大",
      extreme: "换手>20% = 筹码已换一轮 - 明天方向难说",
    },

    tags: {
      firstBoard: "首板",
      secondBoard: "二板",
      thirdBoard: "三板",
      dragonBoard: "妖股连板",
      bigOrderSeal: "大单封板",
      smallOrderSeal: "散单封板",
    },

    empty: "今日无股票触及涨停",
  },

  // ── 3. 跌停面板 ──
  limitDown: {
    title: "跌停股票",
    columns: {
      stock: "股票",
      price: "跌停价",
      sealAmount: "封单额",
      lockRatio: "封死度",
      consecutive: "连跌",
      firstLimitTime: "首封时间",
      volume: "跌停板成交",
    },

    sealInterpretation: {
      deadlock: "跌停封单>10亿 = 封死 - 今天大概率打不开",
      heavy: "封单1-10亿 = 重压 - 很难打开",
      light: "封单<1亿 = 轻压 - 可能被撬开",
      opening: "跌停板成交放量 = 有人在跌停板上抄底 - 可能开板",
    },

    tips: {
      panic: "跌停封单巨大+缩量 = 恐慌盘还没出完 - 明天大概率继续跌。千万不要在跌停板上抄底--封死的跌停板明天可能更低。",
      relief: "跌停板大成交 = 有资金在跌停上接货。可能是散户恐慌出逃被主力接走。但也不要冲动--确认下一天不再跌停再说。",
      chain: "连跌{n}天 = 极端弱势。这种股票的资金在夺路而逃——每一秒都在亏钱。不要幻想'已经跌这么多了该反弹了'——A股连续跌停可以跌很久。",
    },

    empty: "今日无股票触及跌停",
  },

  // ── 4. 特殊形态 ──
  specialPatterns: {
    floorToCeiling: {
      name: "地天板 🌪️",
      description: "从跌停板打开--一路拉到涨停板。一天之内从最低到最高--20%/40%的振幅(科创板80%)。",
      meaning: "极端的'空翻多'。通常是大资金在跌停板上接完所有恐慌盘,然后一口气拉涨停让今天卖的人后悔、让涨停板追的人帮它抬轿。",
      action: "如果没买到=错过了,不要追--地天板第二天大幅波动的概率高。如果持有=恭喜--但考虑在第二天高开时适度减仓。",
    },
    ceilingToFloor: {
      name: "天地板 💥",
      description: "从涨停板打开--一路砸到跌停板。一天之内从最高到最低。",
      meaning: "极端出货信号--大概是涨停板上出货、能出多少出多少、出完直接砸跌停。当天追涨停的人全部被套。",
      action: "如果你在涨停板买入的--已经亏了20%。明天大概率继续低开。不要补仓--抄底这种股票的危险系数极高。止损是最好的选择。",
    },
    boardBreak: {
      name: "炸板 💣",
      description: "涨停板被打开--封单消失、价格回落。",
      meaning: "封板的人撤单了(或被人砸开了)。可能是主力在涨停板上出货--把追涨停的人全部套住。",
      action: "如果涨停打开后在三分钟内没回封--大概率今天封不回去了。追板买入的话--考虑止损。",
    },
  },

  // ── 5. 通知文案 ──
  alerts: {
    limitUpAlert: "🔴 {symbol} {consecutive}连板 - 封单{sealAmount} {strength}",
    limitDownAlert: "🟢 {symbol} 跌停 - 封单{sealAmount} {strength}",
    nearLimitUp: "🔶 {symbol} 距涨停仅{distance}% - 换手{turnover}%",
    nearLimitDown: "🔶 {symbol} 距跌停仅{distance}% - 注意风险",
    boardOpen: "⚡ {symbol} 炸板!涨停打开 - 封单消失",
    floorCeiling: "🔥 {symbol} 地天板!从跌停拉到涨停",
    ceilingFloor: "💀 {symbol} 天地板!从涨停砸到跌停",
  },
};

export default CN_LIMIT_COPY;
