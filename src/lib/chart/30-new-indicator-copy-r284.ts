// ══ R284 QClaw Task 1: 30新指标文案 (3h) ══
// 指标引擎 20→50: 为新接入的30个指标写完整人话文案
// 格式: emoji+≤8字中文名 + oneLiner≤15字 + usage≤50字 + caution≤30字 + signals + defaultParams
// 交付: TS常量map — 直接接入IndicatorPanel/IndicatorReadoutPanel/AIIndicatorReadPanel

// ═══════════════════════════════════════
// TYPE
// ═══════════════════════════════════════

export interface IndicatorCopy {
  id: string;
  name: string;
  nameShort: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'china';
  oneLiner: string;
  usage: string;
  caution: string;
  signals: {
    bullish: string;
    bearish: string;
  };
  defaultParams: Record<string, number | number[]>;
  paramHints: string;
}

// ═══════════════════════════════════════
// 趋势类 — 7个 (高级均线/自适应趋势)
// ═══════════════════════════════════════

export const INDICATOR_30_COPY: Record<string, IndicatorCopy> = {

  // ── 1. HMA — 赫尔均线 ──
  hma: {
    id: 'hma',
    name: '赫尔均线',
    nameShort: 'HMA',
    category: 'trend',
    oneLiner: '零滞后的超快均线 — 趋势信号几乎不延迟',
    usage: '价格在HMA上方=上升趋势,下方=下降趋势。HMA转弯比普通均线快很多,能第一时间捕捉拐点。两根HMA(快+慢)的交叉=金叉/死叉信号。',
    caution: 'HMA极度灵敏=震荡市中假信号多。直线上涨时好用,但横盘震荡时HMA在价格附近上蹿下跳,此时换用ADX判断是否该交易。',
    signals: {
      bullish: 'HMA从下降转上升+价格站上HMA — 趋势反转,多头入场',
      bearish: 'HMA从上升转下降+价格跌破HMA — 趋势反转,多头离场',
    },
    defaultParams: { period: 16 },
    paramHints: '16=Hull本人推荐。短线用8,中线用16,长线用32。',
  },

  // ── 2. KAMA — 考夫曼自适应均线 ──
  kama: {
    id: 'kama',
    name: '自适应均线',
    nameShort: 'KAMA',
    category: 'trend',
    oneLiner: '震荡市自动降灵敏度 — 不会频繁翻车',
    usage: 'KAMA在趋势市中贴近价格跑得快,在震荡市中几乎走平不跟噪音。KAMA方向变化=真正的趋势变化,比普通MA更可靠。',
    caution: 'KAMA在行情突然启动时反应慢半拍 — 因为它需要时间"确认"这不是噪音。所以V形反转时不要等KAMA确认再进场,会错过大段。',
    signals: {
      bullish: 'KAMA从走平转向上+价格在KAMA上方 — 趋势行情启动',
      bearish: 'KAMA从向上转走平+价格跌破KAMA — 趋势可能结束',
    },
    defaultParams: { period: 10, fastPeriod: 2, slowPeriod: 30 },
    paramHints: '10-2-30=标准。fast越小越灵敏,slow越大越迟钝。',
  },

  // ── 3. ZLEMA — 零滞后指数均线 ──
  zlema: {
    id: 'zlema',
    name: '零滞后均线',
    nameShort: 'ZLEMA',
    category: 'trend',
    oneLiner: '消除EMA固有滞后 — 拐点出现马上反应',
    usage: 'ZLEMA和EMA看同样的信号,但ZLEMA的反应速度快一倍。价格穿过ZLEMA=趋势转换。ZLEMA斜率变大=趋势加速。',
    caution: '消除滞后=放大了价格中的噪声成分。两根ZLEMA交叉在震荡市中频繁出现假信号,建议配合RSI或MACD确认方向。',
    signals: {
      bullish: '价格从下方向上穿过ZLEMA — 短线多头信号',
      bearish: '价格从上方向下穿过ZLEMA — 短线空头信号',
    },
    defaultParams: { period: 20 },
    paramHints: '20=标准。越小越灵敏,参照EMA的使用习惯即可。',
  },

  // ── 4. ALMA — 阿诺均线 ──
  alma: {
    id: 'alma',
    name: '阿诺均线',
    nameShort: 'ALMA',
    category: 'trend',
    oneLiner: '高斯分布加权 — 又平滑又灵敏的均线',
    usage: 'ALMA像一条"聪明版"的均线 — 比SMA灵敏,比EMA平滑。价格在ALMA上方=看涨。ALMA向上+价格在线上=坚定持有多头。',
    caution: 'ALMA的参数(offset+sigma)调不好=就是一条普通均线。不要随意改参数 — 默认值是经过优化的,改了反而降低效果。',
    signals: {
      bullish: 'ALMA从下降转上升 且 价格突破站上 — 趋势重启',
      bearish: 'ALMA从上升转下降 且 价格跌破下方 — 上升走弱',
    },
    defaultParams: { period: 9, offset: 0.85, sigma: 6 },
    paramHints: '9-0.85-6=优化值。offset越接近1越"追"当前价格。',
  },

  // ── 5. VIDYA — 动态自适应均线 ──
  vidya: {
    id: 'vidya',
    name: '波动自适应',
    nameShort: 'VIDYA',
    category: 'trend',
    oneLiner: '波动大时慢 — 波动小时快 — 自动适配市场',
    usage: 'VIDYA在市场平静时紧跟价格,在剧烈波动时自动放慢节奏避免假信号。VIDYA方向=大方向。适合用在波动大起大落的品种上。',
    caution: 'VIDYA对波动率突然变化的反应有延迟 — 需要几根K线才能"适应"新的波动水平。在突然加速行情中可能滞后。',
    signals: {
      bullish: 'VIDYA向上且价格在线上 — 趋势健康,持股不动',
      bearish: 'VIDYA向下且价格在线下 — 空头趋势,不要抄底',
    },
    defaultParams: { period: 9, cmoPeriod: 20 },
    paramHints: '9-20=标准。period越小对波动越敏感,cmPeriod越大适应越慢。',
  },

  // ── 6. GMMA — 顾比均线组 ──
  gmma: {
    id: 'gmma',
    name: '顾比均线组',
    nameShort: 'GMMA',
    category: 'trend',
    oneLiner: '12条EMA分成两组 — 一眼看穿大资金vs散户',
    usage: '短期组(6条)代表散户/投机者,长期组(6条)代表主力/大资金。两组发散=趋势强,两组收敛=变盘在即。短期组穿过长期组=趋势转换。',
    caution: 'GMMA会占用大量屏幕空间 — 12条线叠加在一起容易眼花。建议先看两组的分合,再看交叉,不要单看某一条线。',
    signals: {
      bullish: '短期组从下方向上穿过长期组 — 散户和主力一起做多,最可靠的买入信号',
      bearish: '短期组从上方向下穿过长期组 — 主力撤退信号,跟风盘松动',
    },
    defaultParams: { shortPeriods: [3,5,8,10,12,15], longPeriods: [30,35,40,45,50,60] },
    paramHints: '标准值=顾比本人选的。不要改,改了就不是顾比了。',
  },

  // ── 7. JMA — JMA均线 ──
  jurik: {
    id: 'jurik',
    name: 'JMA均线',
    nameShort: 'JMA',
    category: 'trend',
    oneLiner: '噪声最低的均线 — TradingView付费才有的',
    usage: 'JMA是所有均线中噪声最小的 — 趋势线非常干净,几乎没有锯齿。JMA方向=最纯粹的趋势方向。JMA斜率变化=趋势强弱变化。',
    caution: '低噪声=会牺牲一部分灵敏度。在快速转折时JMA的响应速度不如HMA/ZLEMA。两种用法:JMA看大方向,HMA看入场点。',
    signals: {
      bullish: 'JMA向上+JMA斜率增大 — 趋势在加速,加仓',
      bearish: 'JMA向下+JMA斜率增大 — 下跌加速,止损或做空',
    },
    defaultParams: { period: 14, phase: 0 },
    paramHints: '14-0=标准。period越大越平滑但越滞后。phase调负数=更灵敏。',
  },

  // ═══════════════════════════════════════
  // 动量类 — 7个 (震荡指标/背离检测)
  // ═══════════════════════════════════════

  // ── 8. StochRSI — 随机RSI ──
  stochrsi: {
    id: 'stochrsi',
    name: '随机RSI',
    nameShort: 'StochRSI',
    category: 'momentum',
    oneLiner: 'RSI的KD版 — 比RSI快三倍,超精准超买超卖',
    usage: 'StochRSI>0.8=短期严重超买,＜0.2=短期严重超卖。在震荡市中超买超卖信号非常准。价格新低但StochRSI不创新低=底背离,反转信号。',
    caution: '单边趋势中StochRSI会"闷死"在0.8以上或0.2以下很久 — 此时超买超卖不意味着反转。只有在横盘震荡时才用它看超买超卖。',
    signals: {
      bullish: 'StochRSI<0.2 然后回到0.2以上 — 超卖反弹,短线买入',
      bearish: 'StochRSI>0.8 然后回到0.8以下 — 超买回落,短线卖出',
    },
    defaultParams: { period: 14, smoothK: 3, smoothD: 3 },
    paramHints: '14-3-3=标准。period越小越敏感,但假信号越多。',
  },

  // ── 9. Ultimate Oscillator — 终极震荡 ──
  ultosc: {
    id: 'ultosc',
    name: '终极震荡',
    nameShort: 'UO',
    category: 'momentum',
    oneLiner: '三个周期加权 — 假信号比RSI少一半',
    usage: 'UO>70=超买,＜30=超卖。UO用短中长三个周期加权平均,过滤单一周期的假信号。UO和价格背离=最重要的信号:价格新高UO不新高=顶背离。',
    caution: 'UO的结构导致它在单边行情中也会"贴边" — 牛市中UO可能一直>60不回来。此时不要等UO回到50以下再买,会踏空。',
    signals: {
      bullish: 'UO<30 且 出现金叉 — 三周期共振的抄底信号',
      bearish: 'UO>70 且 与价格顶背离 — 三周期共振的逃顶信号',
    },
    defaultParams: { fastPeriod: 7, midPeriod: 14, slowPeriod: 28 },
    paramHints: '7-14-28=标准。这是Williams本人选的三周期。',
  },

  // ── 10. Williams %R — 威廉指标 ──
  williamsr: {
    id: 'williamsr',
    name: '威廉指标',
    nameShort: 'WR',
    category: 'momentum',
    oneLiner: '拉里·威廉斯的秘密武器 — 比RSI更直接',
    usage: 'WR在0到-100之间:WR>-20=超买,可能回调。WR<-80=超卖,可能反弹。WR从-80以下上穿到-50以上=买入。WR从-20以下下穿到-50以下=卖出。',
    caution: 'WR是反向指标(倒着装) — 很多新手看反了。WR>-20是超买不是超卖!和RSI反过来理解。单边趋势中WR钝化同样不反转。',
    signals: {
      bullish: 'WR从<-80反弹到>-50 — 超卖结束,短线看涨',
      bearish: 'WR从>-20下跌到<-50 — 超买结束,短线看跌',
    },
    defaultParams: { period: 14 },
    paramHints: '14=标准。越小越敏感,短线可用6-9。',
  },

  // ── 11. RVI — 相对活力指数 ──
  rvi: {
    id: 'rvi',
    name: '相对活力',
    nameShort: 'RVI',
    category: 'momentum',
    oneLiner: '看收盘价vs开盘价 — 判断趋势有没有"活力"',
    usage: 'RVI>0=收盘价高于开盘价,多头有活力。RVI向上=活力在增强,涨势健康。RVI与价格背离=内在活力跟不上了,可能要反转。',
    caution: 'RVI受开盘价影响大 — 跳空开盘会严重扭曲RVI。开盘跳空后的RVI信号要过滤掉,不要盲目信。隔夜跳空后的第一个RVI值是无效的。',
    signals: {
      bullish: 'RVI从负转正 且 持续向上 — 内在动能改善,看涨',
      bearish: 'RVI从正转负 且 价格没创新高 — 上涨已无活力,警惕回调',
    },
    defaultParams: { period: 10 },
    paramHints: '10=标准。短线用5,中线用10。不要超过14会太滞后。',
  },

  // ── 12. PPO — 百分比价格震荡 ──
  ppo: {
    id: 'ppo',
    name: '百分比震荡',
    nameShort: 'PPO',
    category: 'momentum',
    oneLiner: 'MACD的百分比版 — 跨股跨品种都能比',
    usage: 'PPO用法跟MACD一模一样:PPO线上穿信号线=金叉看涨,下穿=死叉看跌。但PPO是百分比,所以茅台和腾讯的PPO可以放在一起比较谁的动能更强。',
    caution: 'PPO看的是"比例"不是"绝对值" — 一只从1元涨到1.1元(+10%)的股票的PPO可能比一只从100元涨到105元(+5%)的高,不代表前者更好。',
    signals: {
      bullish: 'PPO线上穿信号线+PPO从负转正 — 标准多头信号',
      bearish: 'PPO线下穿信号线+PPO从正转负 — 标准空头信号',
    },
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    paramHints: '12-26-9=标准MACD参数。改成5-20-9=更敏感版。',
  },

  // ── 13. KST — 确然指标 ──
  kst: {
    id: 'kst',
    name: '确然指标',
    nameShort: 'KST',
    category: 'momentum',
    oneLiner: '四个周期的ROC加权 — 多重确认才给信号',
    usage: 'KST>0=看涨,信号线上穿=买入。KST<0=看跌,信号线下穿=卖出。KST用了短中长四个周期的变化率,只有四级共振才触发信号,假信号极少。',
    caution: 'KST多重确认=入场时趋势已经走了一小段了 — 会错过趋势最初的那部分。追求"从头吃到尾"的人不适合用KST,换用更灵敏的指标。',
    signals: {
      bullish: 'KST上穿信号线+两者都在0以上 — 四周期共振看涨',
      bearish: 'KST下穿信号线+两者都在0以下 — 四周期共振看跌',
    },
    defaultParams: { roc1: 10, roc2: 15, roc3: 20, roc4: 30, signalPeriod: 9 },
    paramHints: '10-15-20-30=标准(Martin Pring原始参数)。不要随意改。',
  },

  // ── 14. TSI — 真实强度指数 ──
  tsi: {
    id: 'tsi',
    name: '真实强度',
    nameShort: 'TSI',
    category: 'momentum',
    oneLiner: '双平滑动量 — 比MACD更稳定更少假信号',
    usage: 'TSI>0=上涨动能,TSI<0=下跌动能。TSI上穿信号线=金叉。TSI在0线附近反复=震荡市,不适合跟趋势。TSI和中线背离=重要反转信号。',
    caution: 'TSI用了双重平滑,所以信号出现时趋势已经确认了一段时间 — 适合做趋势中段,不适合抓顶底。想抓拐点用StochRSI或Williams%R。',
    signals: {
      bullish: 'TSI从负转正+上穿信号线 — 趋势启动,中线持有',
      bearish: 'TSI从正转负+下穿信号线 — 趋势结束,中线卖出',
    },
    defaultParams: { fastPeriod: 25, slowPeriod: 13, signalPeriod: 13 },
    paramHints: '25-13-13=长线版(原始参数)。短线可用13-7-7。',
  },

  // ═══════════════════════════════════════
  // 成交量类 — 6个 (量价关系/资金流)
  // ═══════════════════════════════════════

  // ── 15. Force Index — 力量指数 ──
  fi: {
    id: 'fi',
    name: '力量指数',
    nameShort: 'FI',
    category: 'volume',
    oneLiner: '价×量=真正的趋势力量 — 有量的涨才可靠',
    usage: 'FI>0=上涨有量,上涨可靠。FI<0=下跌有量,下跌真实。FI背离价格=警告:价格涨但FI下降=无量上涨,随时可能塌。价格跌但FI上升=卖压在减弱。',
    caution: 'FI受大盘股和小盘股的影响巨大 — 大盘股FI动辄几千上万,小盘股FI只有几十。不要跨股比较FI的绝对值,只看自己股票的FI变化趋势。',
    signals: {
      bullish: '价格横盘+FI从负转正 — 主力在吸筹,准备突破',
      bearish: '价格在高位+FI快速下降 — 主力在派发,准备逃顶',
    },
    defaultParams: { period: 13 },
    paramHints: '13=Elder博士的推荐。短线用2-5,长线用13-21。',
  },

  // ── 16. VWMA — 量权均线 ──
  vwma: {
    id: 'vwma',
    name: '量权均线',
    nameShort: 'VWMA',
    category: 'volume',
    oneLiner: '成交量大时权重高 — 均线更"真实"',
    usage: 'VWMA比普通MA更能反映"真正"的成本价 — 因为量大时的价格更接近大多数人的成本。价格在VWMA上方=大多数人赚钱;下方=大多数人亏钱。',
    caution: 'VWMA在成交量极度不均匀时(如开盘首30分钟vs午盘)会有偏差。VWMA更适合日线级别,分时图级别的VWMA参考意义有限。',
    signals: {
      bullish: '价格站上VWMA 且 VWMA开始向上 — 买盘有量支撑,真突破',
      bearish: '价格跌破VWMA 且 VWMA开始向下 — 持股人成本区被跌破,恐慌加剧',
    },
    defaultParams: { period: 20 },
    paramHints: '20=标准。越小越接近价格近期成本。',
  },

  // ── 17. VROC — 量变速率 ──
  vroc: {
    id: 'vroc',
    name: '量变速率',
    nameShort: 'VROC',
    category: 'volume',
    oneLiner: '成交量变化有多快 — 爆量就是这信号',
    usage: 'VROC>0=今天比N天前放量。VROC突然飙高=爆量信号,可能是有大事发生。VROC在低位=地量地价。VROC>100%=今天成交量是N天前两倍,异常放量。',
    caution: '放量≠一定涨 — 可以是放量下跌(恐慌抛售)也可以是放量上涨(主力拉升)。VROC只告诉你"量变了",配合价格方向判断是好事还是坏事。',
    signals: {
      bullish: 'VROC>50%+价格上涨 — 放量上涨,强势突破',
      bearish: 'VROC>50%+价格下跌 — 放量下跌,恐慌出货',
    },
    defaultParams: { period: 12 },
    paramHints: '12=日线标准。周线用4,分钟线用24。',
  },

  // ── 18. PVT — 量价趋势 ──
  pvt: {
    id: 'pvt',
    name: '量价趋势',
    nameShort: 'PVT',
    category: 'volume',
    oneLiner: 'OBV的升级版 — 变化大的K线占更大权重',
    usage: 'PVT上升=量价配合上涨,健康。PVT下降=量价配合下跌。PVT和价格背离=最核心的信号:价涨PVT跌=量的支持在减弱,行情不牢。',
    caution: 'PVT是累积指标=绝对值没有参考意义,只有"PVT的走势"有意义。不要看PVT=1000还是10000,看PVT是上升还是下降。',
    signals: {
      bullish: 'PVT创近期新高+价格突破前高 — 量价齐升,趋势延续',
      bearish: 'PVT在下降+价格在创新高 — 缩量上涨,顶部背离,即将回调',
    },
    defaultParams: { period: 1 },
    paramHints: '1=原始版本(逐K线累积)。不需要改。',
  },

  // ── 19. Chaikin Volatility — 蔡金波幅 ──
  chaikinvol: {
    id: 'chaikinvol',
    name: '蔡金波幅',
    nameShort: 'CHKV',
    category: 'volume',
    oneLiner: '价差×成交量 — 看多空双方在"打架"的激烈程度',
    usage: 'CHKV上升=价差扩大+成交量放大,波动在加剧。CHKV在高位+价格横盘=暴风雨前的宁静,即将变盘。CHKV在低位=市场平静,方向不明。',
    caution: 'CHKV告诉你"要变盘了"但不告诉你往哪边变 — 可能大涨也可能大跌。必须配合趋势方向或支撑阻力位来判断大概率方向。',
    signals: {
      bullish: 'CHKV从低位飙高+价格突破阻力 — 爆发性上涨,跟单',
      bearish: 'CHKV从低位飙高+价格跌破支撑 — 恐慌性下跌,止损',
    },
    defaultParams: { period: 10, rocPeriod: 10 },
    paramHints: '10-10=标准。period越小越敏感。',
  },

  // ── 20. A/D Line — 集散指标 ──
  ad: {
    id: 'ad',
    name: '集散指标',
    nameShort: 'A/D',
    category: 'volume',
    oneLiner: '看主力在悄悄收集还是偷偷派发筹码',
    usage: 'A/D线上升=资金在流入,主力在"收集"筹码。A/D线下降=资金在流出,主力在"派发"。A/D与价格背离=最经典的反转信号:价跌A/D升=主力在接盘,底在眼前。',
    caution: 'A/D线在高位横盘时说明收集/派发力量平衡 — 此时A/D不给出方向信号,等突破确认后再跟随。假的A/D背离在震荡市中也会出现。',
    signals: {
      bullish: '价格新低但A/D线没创新低 — 主力在底部吸筹,反转在即',
      bearish: '价格新高但A/D线没创新高 — 主力在顶部出货,逃顶信号',
    },
    defaultParams: {},
    paramHints: '无参数。这个指标不需要调参。',
  },

  // ═══════════════════════════════════════
  // 波动类 — 5个 (波动率/风险测量)
  // ═══════════════════════════════════════

  // ── 21. ATR Percent — ATR百分比 ──
  atrp: {
    id: 'atrp',
    name: '波动百分比',
    nameShort: 'ATRP',
    category: 'volatility',
    oneLiner: 'ATR除以价格 — 跨股票比较谁的波动更大',
    usage: 'ATRP=5%=这只股票平均每天波动5%。ATRP越高=波动越大,适合做短线。ATRP越低=波动越小,适合中线持有。用ATRP比较同板块的多只股票,选波动适合自己风格的。',
    caution: 'ATRP是"历史"波动率 — 不代表未来也这样波动。重大事件(财报/政策)前后的ATRP可能突然飙升。ATRP低的时候也可能突然来一个暴跌。',
    signals: {
      bullish: 'ATRP从极低值回升+价格突破 — 沉睡的股票醒了,爆发前兆',
      bearish: 'ATRP在极高位 — 波动过大,不适合追单,等冷静下来再说',
    },
    defaultParams: { period: 14 },
    paramHints: '14=跟随ATR的周期。短线用7,长线用21。',
  },

  // ── 22. Historical Volatility — 历史波动率 ──
  hv: {
    id: 'hv',
    name: '历史波动率',
    nameShort: 'HV',
    category: 'volatility',
    oneLiner: '用收益率的标准差来衡量 — 最正统的波动率',
    usage: 'HV=20%=年化波动率20%,即一年内价格大概在±20%范围内波动。HV上升=市场不确定性增加。HV下降=市场趋于平静。HV在低位极值=即将有大行情。',
    caution: 'HV看的是"实际"波动 — 如果市场大家都在等一件事(如降息),HV可能很低但事件发生后突然飙升。HV低≠不会出大事。',
    signals: {
      bullish: 'HV在1年低位+价格突破 — 低波动后的突破往往是大行情',
      bearish: 'HV飙升到1年高位 — 极度恐慌,不要抄底,等波动降下来',
    },
    defaultParams: { period: 20, annualize: 1 },
    paramHints: '20=月波动率。252=年化日线波动率。annualize=0=不年化。',
  },

  // ── 23. Ulcer Index — 回撤指数 ──
  ulcer: {
    id: 'ulcer',
    name: '回撤指数',
    nameShort: 'UI',
    category: 'volatility',
    oneLiner: '"痛苦指数" — 衡量持有多头有多难受',
    usage: 'UI衡量的是"回撤的深度和持续时间"。UI高=持有这只股票很痛苦,回撤大且时间长。UI低=持有体验好。用UI对比两只股票,选UI更低的:同样的涨幅但拿得更舒服。',
    caution: 'UI衡量的是"过去"的回撤痛苦 — 不代表未来。刚经历过暴跌的股票UI会很高,但可能已经到底了。UI是滞后指标,不是预测指标。',
    signals: {
      bullish: 'UI从历史高位回落 — 最痛苦的时期正在过去,可以考虑入场',
      bearish: 'UI创新高 — 回撤在加大,持有体验在恶化,减仓保护心态',
    },
    defaultParams: { period: 14 },
    paramHints: '14=标准。越大越平滑,但也会低估近期回撤。',
  },

  // ── 24. Bollinger Bandwidth — 布林宽度 ──
  bbwidth: {
    id: 'bbwidth',
    name: '布林宽度',
    nameShort: 'BBW',
    category: 'volatility',
    oneLiner: '布林带有多宽 — 宽度越窄变盘越近',
    usage: 'BBW在历史低位=布林带极度收窄,暴风雨前的宁静,即将有大行情。BBW在历史高位=布林带极度扩张,高潮已过,要回归平静。BBW从窄变宽=突破开始。',
    caution: '布林宽度收窄≠马上变盘 — 可能继续收窄好几周。BBW告诉你"快要变了"但精确时点用突破信号确认。不要因为BBW收窄了就去埋伏,要等突破确认。',
    signals: {
      bullish: 'BBW从6个月最低点开始扩张+价格向上突破 — 窄幅整理后的上涨启动',
      bearish: 'BBW从6个月最低点开始扩张+价格向下突破 — 窄幅整理后的下跌启动',
    },
    defaultParams: { period: 20, multiplier: 2 },
    paramHints: '20-2=标准(跟随布林带)。改multiplier=改带宽基准。',
  },

  // ── 25. Consecutive Bars — 连涨连跌 ──
  consec: {
    id: 'consec',
    name: '连涨连跌',
    nameShort: 'CNSC',
    category: 'volatility',
    oneLiner: '连续涨了多少天/跌了多少天 — 极值就是反转',
    usage: '连涨>8天=极度超买,回调概率大增。连跌>8天=极度超卖,反弹概率大增。连涨/跌的天数本身就是人性指标:贪婪和恐惧的量化体现。',
    caution: '连涨连跌在单边大行情(如疯牛/股灾)中可以持续远超你的想象 — 连涨15天也不一定反转。只有结合K线形态(如十字星/吞没线)确认反转才入场。',
    signals: {
      bullish: '连跌8天以上+出现锤子线/十字星 — 超卖+形态信号=高概率反弹',
      bearish: '连涨8天以上+出现上吊线/流星 — 超买+形态信号=高概率回调',
    },
    defaultParams: { threshold: 8 },
    paramHints: '8=标准。短线用5(更敏感),长线用12(更可靠)。',
  },

  // ═══════════════════════════════════════
  // 中国类 — 5个 (A股特色指标)
  // ═══════════════════════════════════════

  // ── 26. BBI — 多空指数 ──
  bbi: {
    id: 'bbi',
    name: '多空指数',
    nameShort: 'BBI',
    category: 'china',
    oneLiner: '3/6/12/24日均线的平均值 — 多空分界线',
    usage: '价格在BBI上方=多头市场,持股。价格在BBI下方=空头市场,持币。BBI从走平转向上+价格站上=买入。BBI不像单根均线那么敏感,假信号少,适合A股趋势操作。',
    caution: 'BBI是慢指标 — 用四条均线的平均,转折时比单均线慢。V形反转中BBI来不及反应。适合做趋势中段,不适合做抄底逃顶。',
    signals: {
      bullish: '价格突破BBI+成交量放大 — 四条均线共振确认多头,买入',
      bearish: '价格跌破BBI+成交量放大 — 四条均线共振确认空头,卖出',
    },
    defaultParams: { periods: [3, 6, 12, 24] },
    paramHints: '3-6-12-24=标准。这些是A股最常用的四条均线,不要改。',
  },

  // ── 27. DKX — 多空线 ──
  dkx: {
    id: 'dkx',
    name: '多空线',
    nameShort: 'DKX',
    category: 'china',
    oneLiner: '一根线告诉你该持股还是该持币',
    usage: 'DKX向上+价格在线上=持股。DKX向下+价格在线下=持币。DKX本质上是一条改良过的移动平均线,加了波动率修正,比普通MA更适合A股的"慢涨急跌"特征。',
    caution: 'DKX在横盘震荡中会频繁翻多翻空 — 这是所有趋势指标的通病。震荡市中DKX的信号要配合布林带或KDJ使用,单看DKX会被反复止损。',
    signals: {
      bullish: 'DKX从下降转上升+价格放量站上 — 趋势转为多头,建仓',
      bearish: 'DKX从上升转下降+价格跌破 — 趋势转为空头,减仓',
    },
    defaultParams: { period: 10 },
    paramHints: '10=标准。A股中期用10,短线可用5,长线用20。',
  },

  // ── 28. MIKE — 麦克指标 ──
  mike: {
    id: 'mike',
    name: '麦克指标',
    nameShort: 'MIKE',
    category: 'china',
    oneLiner: '三档压力+三档支撑 — 压力支撑一目了然',
    usage: 'MIKE有三条压力线(初级/中级/强)和三条支撑线(初级/中级/强)。价格触及初级=轻仓试探。触及中级=正常进出。触及强=重仓决策。过强压=突破确认,破强撑=止损。',
    caution: 'MIKE的压力支撑是"静态"计算的(基于昨日价格) — 今天的突发消息可能导致价格直接跳过中间档位。MIKE适合日线按部就班的交易,不适合盘中快进快出。',
    signals: {
      bullish: '价格突破初级压力+成交量>5日均量 — 即将挑战中级压力,加仓',
      bearish: '价格跌破初级支撑+成交量>5日均量 — 可能滑向中级支撑,减仓',
    },
    defaultParams: { period: 20 },
    paramHints: '20=标准。代表约一个月的价格区间。',
  },

  // ── 29. CYW — 主力控盘 ──
  cyw: {
    id: 'cyw',
    name: '主力控盘',
    nameShort: 'CYW',
    category: 'china',
    oneLiner: '主力控盘程度 — 越高牛市越要拿住',
    usage: 'CYW>50=主力控盘程度高,这是好事:股价稳定,不会被散户带偏。CYW<0=无主力控盘,股价容易被散户情绪左右。CYW持续上升=主力在"锁仓",大行情在酝酿。',
    caution: 'CYW高≠主力要拉升 — 也可能是主力在"护盘"(防止跌)。CYW需要结合股价位置看:低位高控盘=吸筹,高位高控盘=出货前的稳定。不要只看数字看位置。',
    signals: {
      bullish: 'CYW从0以下上穿到正值+股价在低位 — 主力建仓完毕,即将启动',
      bearish: 'CYW从高位快速回落+股价也在跌 — 主力跑了,跟风盘踩踏',
    },
    defaultParams: { period: 10 },
    paramHints: '10=标准。这是A股"主力控盘"的经典参数,不用改。',
  },

  // ── 30. DDY — 大单动向 ──
  ddy: {
    id: 'ddy',
    name: '大单动向',
    nameShort: 'DDY',
    category: 'china',
    oneLiner: '大单净买入/卖出的强度 — 跟聪明钱走',
    usage: 'DDY>0=大单净买入,主力在买。DDY<0=大单净卖出,主力在卖。DDY>0.5=大单买入极其活跃。DDY和股价同步上涨=主力拉升,可信。股价涨DDY跌=散户接盘,危险。',
    caution: 'DDY数据来源是逐笔成交的分单 — 主力可能用拆单(把大单拆成小单)规避检测。所以DDY=0不代表没有主力动作,可能只是主力在隐蔽操作。',
    signals: {
      bullish: 'DDY>0.3+成交量放大+股价上涨 — 主力真金白银在买,跟仓',
      bearish: 'DDY<0+股价横盘 — 主力在偷偷减仓,表面上股价没跌但暗流涌动',
    },
    defaultParams: { period: 10 },
    paramHints: '10=标准。短线用5看短期动向,中线用10看中期趋势。',
  },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getIndicator30ById(id: string): IndicatorCopy | undefined {
  return INDICATOR_30_COPY[id];
}

export function getAll30Indicators(): IndicatorCopy[] {
  return Object.values(INDICATOR_30_COPY);
}

export function get30ByCategory(cat: IndicatorCopy['category']): IndicatorCopy[] {
  return getAll30Indicators().filter(i => i.category === cat);
}

export function get30CategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const i of getAll30Indicators()) {
    counts[i.category] = (counts[i.category] || 0) + 1;
  }
  return counts;
}

// ═══════════════════════════════════════
// 接入面板的快速映射
// ═══════════════════════════════════════

export interface IndicatorPanelEntry {
  id: string;
  name: string;
  shortName: string;
  category: string;
  oneLiner: string;
  signal: 'bullish' | 'bearish' | 'neutral';
}

export function toPanelEntries(): IndicatorPanelEntry[] {
  return getAll30Indicators().map(i => ({
    id: i.id,
    name: i.name,
    shortName: i.nameShort,
    category: i.category,
    oneLiner: i.oneLiner,
    signal: 'neutral' as const,
  }));
}

export default INDICATOR_30_COPY;
