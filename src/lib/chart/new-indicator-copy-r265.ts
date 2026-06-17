// ══ R265 QClaw Task 1: 10新指标中文文案 (3h) ══
// P0-02: 新指标入IndicatorEngine — 每一指标含≤15字人话名称 + 一句话用途 + signal解读 + 参数建议
// 交付: TS枚举+文案map — 直接接入indicator-panel/ChartToolbarCustom

// ═══════════════════════════════════════
// TYPE: 指标定义
// ═══════════════════════════════════════

export interface NewIndicatorCopy {
  id: string;
  name: string;           // ≤8字中文名
  nameShort: string;      // ≤4字缩写 (面板/按钮用)
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'cycle';
  oneLiner: string;       // ≤15字一句话说人话
  usage: string;          // ≤50字 — 小白能看懂怎么用
  caution: string;        // ≤30字 — 什么时候别信这个指标
  signals: {
    bullish: string;      // 看涨信号 (≤15字)
    bearish: string;      // 看跌信号 (≤15字)
  };
  defaultParams: Record<string, number>;
  paramHints: string;     // 参数调法 — ≤30字
}

// ═══════════════════════════════════════
// 10指标完整文案
// ═══════════════════════════════════════

export const NEW_INDICATOR_COPY: Record<string, NewIndicatorCopy> = {

  // ── 1. ADX — 趋势强度 ──
  adx: {
    id: 'adx',
    name: '趋势强度',
    nameShort: 'ADX',
    category: 'trend',
    oneLiner: '判断现在是"有趋势"还是"在震荡"',
    usage: 'ADX>25=有趋势,不管是涨是跌 — 此时适合跟趋势走。ADX<20=在震荡 — 此时别追。ADX+方向线(DI)看涨跌方向。',
    caution: 'ADX只看趋势"有没有" — 不告诉你涨还是跌。所以只看ADX不行,要配合+DI/-DI。',
    signals: {
      bullish: '+DI上穿-DI且ADX>25 — 上涨趋势开始',
      bearish: '-DI上穿+DI且ADX>25 — 下跌趋势开始',
    },
    defaultParams: { period: 14 },
    paramHints: '周期14=标准。越小越敏感,越大越平滑。新手不要动。',
  },

  // ── 2. Stochastics (KD) — 随机指标 ──
  stoch: {
    id: 'stoch',
    name: '随机KD',
    nameShort: 'KD',
    category: 'momentum',
    oneLiner: '看当前价格在过去一段时间中处于什么位置',
    usage: 'K在20以下=超卖,可能反弹。K在80以上=超买,可能回调。K上穿D=金叉看涨,K下穿D=死叉看跌。D是最重要的那条线。',
    caution: 'KD在单边大行情里会"钝化" — 一直保持超买/超卖就是不反转。此时KD的信号是假信号,别信。',
    signals: {
      bullish: 'K上穿D 且 都在20以下 — 超卖区的金叉最可靠',
      bearish: 'K下穿D 且 都在80以上 — 超买区的死叉最可靠',
    },
    defaultParams: { kPeriod: 9, dPeriod: 3, smooth: 3 },
    paramHints: '9-3-3=标准。短周期=更敏感但假信号多。新手不要动。',
  },

  // ── 3. CMF — 资金流量 ──
  cmf: {
    id: 'cmf',
    name: '资金流量',
    nameShort: 'CMF',
    category: 'volume',
    oneLiner: '看钱是在流入还是在流出这只股票',
    usage: 'CMF>0=资金净流入,有买入意愿。CMF<0=资金净流出,有人在卖。CMF>0.1且持续=主力在吸筹。零线是最重要的参考。',
    caution: 'CMF只看"意愿" — 大单可能是假的对倒。CMF配合成交量看更可靠,单看CMF容易被对倒迷惑。',
    signals: {
      bullish: 'CMF从负转正 且 上穿0.05 — 资金开始流入',
      bearish: 'CMF从正转负 且 下穿-0.05 — 资金开始流出',
    },
    defaultParams: { period: 20 },
    paramHints: '周期20=标准。越短越敏感。建议不要改。',
  },

  // ── 4. Chaikin Oscillator — 蔡金震荡 ──
  chaikin: {
    id: 'chaikin',
    name: '蔡金震荡',
    nameShort: 'CHKO',
    category: 'volume',
    oneLiner: '量价是否"对齐" — 涨有量跌无量=健康',
    usage: '正值向上=价量齐升,涨势健康。负值向下=价跌量增,有人在恐慌抛售。与价格背离是重要信号:价格跌但CHKO不跌=下跌动力不足。',
    caution: 'CHKO是短周期EMA减长周期EMA — 滞后信号。震荡市中频繁上穿下穿=噪声多,别在震荡市用它。',
    signals: {
      bullish: '价格新低但CHKO没新低 — 下跌动力衰竭,可能反转',
      bearish: '价格新高但CHKO没新高 — 上涨动力衰竭,可能反转',
    },
    defaultParams: { fastPeriod: 3, slowPeriod: 10 },
    paramHints: '3-10=标准。不要改 — 这是蔡金本人选的值。',
  },

  // ── 5. Aroon — 阿隆指标 ──
  aroon: {
    id: 'aroon',
    name: '阿隆指标',
    nameShort: 'ARO',
    category: 'trend',
    oneLiner: '看近期的高点和低点是"新"还是"旧"',
    usage: 'AroonUp>70=价格在创近期新高,强势。AroonDown>70=价格在创近期新低,弱势。两线交叉=趋势转换信号。',
    caution: '周期越短信号越频繁=噪声越多。Aroon在窄幅横盘时会产生大量假信号,此时换用ADX或布林带更好。',
    signals: {
      bullish: 'AroonUp>70 且 AroonDown<30 — 明确的上涨趋势',
      bearish: 'AroonDown>70 且 AroonUp<30 — 明确的下跌趋势',
    },
    defaultParams: { period: 14 },
    paramHints: '周期14=标准。大盘股可用25(减少假信号)。',
  },

  // ── 6. BB%B — 布林带百分比 ──
  bbb: {
    id: 'bbb',
    name: '布林位置',
    nameShort: '%B',
    category: 'volatility',
    oneLiner: '价格在布林带中处于"高"还是"低"位置',
    usage: '%B=1=刚好在上轨,%B=0=刚好在下轨。%B>1=突破上轨,超强也可能是见顶。%B<0=跌破下轨,超弱也可能是见底。%B在0.5左右=在中间。',
    caution: '%B>1≠一定跌,%B<0≠一定涨 — 在强趋势中价格可以沿着轨线"骑"很久。此时% B的超买超卖是无效的。',
    signals: {
      bullish: '%B<0 然后回到0以上 — 下轨反弹,抄底信号',
      bearish: '%B>1 然后回到1以下 — 上轨回落,逃顶信号',
    },
    defaultParams: { period: 20, multiplier: 2 },
    paramHints: '20-2=标准。改multiplier=改轨宽。2是正态分布95%置信区间。',
  },

  // ── 7. Donchian Channel — 唐奇安通道 ──
  donchian: {
    id: 'donchian',
    name: '唐奇安通道',
    nameShort: 'DC',
    category: 'trend',
    oneLiner: '看N天内的最高价和最低价 — 海龟交易员用的',
    usage: '突破上轨=N天新高,突破信号。跌破下轨=N天新低。中轨=上下轨平均值。上轨=强阻力,下轨=强支撑。通道宽=波动大。',
    caution: '假突破极多 — 突破上轨≠必涨,尤其在震荡区间。海龟交易员配合ATR设置止损,单独靠DC进场会亏得很惨。',
    signals: {
      bullish: '价格突破上轨+成交量放大 — 海龟入场信号',
      bearish: '价格跌破下轨+成交量放大 — 海龟做空信号',
    },
    defaultParams: { period: 20 },
    paramHints: '20=海龟标准。短线用10,长线用55。越小信号越多。',
  },

  // ── 8. Supertrend — 超级趋势 ──
  supertrend: {
    id: 'supertrend',
    name: '超级趋势',
    nameShort: 'ST',
    category: 'trend',
    oneLiner: '最傻瓜的趋势指标 — "红持有绿卖出"',
    usage: '价格在ST上方且ST变绿=上升趋势,持有多头。价格在ST下方且ST变红=下降趋势,持币或空头。ST翻转=趋势转换信号。',
    caution: '震荡市是ST的死穴 — 频繁翻红翻绿,每翻一次亏一次。此时换用布林带或ADX看是否在震荡。',
    signals: {
      bullish: 'ST从红变绿 — 翻多信号,买入',
      bearish: 'ST从绿变红 — 翻空信号,卖出',
    },
    defaultParams: { period: 10, multiplier: 3 },
    paramHints: '10-3=标准。越小越敏感。multiplier=3最经典,海龟精神。',
  },

  // ── 9. Keltner Channel — 肯特纳通道 ──
  keltner: {
    id: 'keltner',
    name: '肯特纳通道',
    nameShort: 'KC',
    category: 'volatility',
    oneLiner: '布林带的"表兄弟" — 用ATR不用标准差',
    usage: '上轨=阻力,下轨=支撑。价格突破上轨+量放大=强势启动。通道收窄=变盘在即。与布林带对比看:KC比布林带更平滑,假信号更少。',
    caution: 'KC和布林带都会给出"价格在轨外"的信号 — 但这个信号本身不等于反转,只等于"极端"。要结合趋势判断。',
    signals: {
      bullish: '价格突破上轨+通道向上扩张 — 强势拉升开始',
      bearish: '价格跌破下轨+通道向上收缩 — 上涨结束调整开始',
    },
    defaultParams: { emaPeriod: 20, multiplier: 2 },
    paramHints: '20-2=标准。multiplier变大=通道变宽=信号变少但更可靠。',
  },

  // ── 10. Elder Ray — 艾尔德射线 ──
  elder: {
    id: 'elder',
    name: '多空力量',
    nameShort: 'ELD',
    category: 'momentum',
    oneLiner: '拆开看多头和空头的力量各有多大',
    usage: 'BullPower=多头能把价格推到均线以上多远。BearPower=空头能把价格压到均线以下多远。Bull为正值Bear为负值=看涨。两者都在均线同侧=看那一侧。',
    caution: 'Elder Ray的BullPower/BearPower是"绝对值" — 大盘股和小盘股的数值不能跨股比较。只用来比较同一只股票的"昨天vs今天"。',
    signals: {
      bullish: 'BullPower转正且BearPower仍在负值区 — 多头占优',
      bearish: 'BearPower转正且BullPower转负 — 空头占优',
    },
    defaultParams: { period: 13 },
    paramHints: '13=标准。这是Elder博士本人选的值 — 26EMA的一半。改了就不是Elder Ray了。',
  },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getNewIndicatorById(id: string): NewIndicatorCopy | undefined {
  return NEW_INDICATOR_COPY[id];
}

export function getAllNewIndicators(): NewIndicatorCopy[] {
  return Object.values(NEW_INDICATOR_COPY);
}

export function getNewIndicatorsByCategory(cat: NewIndicatorCopy['category']): NewIndicatorCopy[] {
  return getAllNewIndicators().filter(i => i.category === cat);
}

// ═══════════════════════════════════════
// 面板显示映射 — IndicatorPanel直接吃
// ═══════════════════════════════════════

export interface IndicatorPanelEntry {
  id: string;
  name: string;
  shortName: string;
  category: string;
  oneliner: string;
  signal: string; // 最近一条信号 (bullish/bearish/neutral)
}

export function toPanelEntries(): IndicatorPanelEntry[] {
  return getAllNewIndicators().map(i => ({
    id: i.id,
    name: i.name,
    shortName: i.nameShort,
    category: i.category,
    oneliner: i.oneLiner,
    signal: 'neutral',
  }));
}

export default NEW_INDICATOR_COPY;
