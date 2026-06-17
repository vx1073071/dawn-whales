// ══ R269 QClaw Task 2: 21新形态文案 (2h) ══
// 形态识别: 30→51 — 21个新形态的中文名+人话+识别规则+操作建议
// 交付: 形态注册表 — 喂给PatternRecognizer/PatternOverlay

// ═══════════════════════════════════════
// TYPE
// ═══════════════════════════════════════

export interface ChartPatternEntry {
  id: string;
  name: string;            // ≤5字
  emoji: string;
  type: 'bullish' | 'bearish' | 'neutral';
  category: string;        // 大类
  description: string;     // ≤25字 — 形态长什么样
  meaning: string;         // ≤25字 — 这个形态告诉你什么
  action: string;          // ≤25字 — 看到这个形态该做什么
  reliability: 'high' | 'medium' | 'low'; // 可靠度
  caution: string;         // ≤20字 — 警告/陷阱
}

// ═══════════════════════════════════════
// 21个新形态 — 15个K线形态 + 6个图表形态
// ═══════════════════════════════════════

export const NEW_PATTERNS_21: ChartPatternEntry[] = [

  // ── K线形态: 反转类 (8个) ──
  {
    id: 'kicker',           name: '跳空反转',  emoji: '🦘',
    type: 'bearish',
    category: 'kline-reversal',
    description: '跳空大阳→次日跳空大阴——市场在一天之内完全变脸',
    meaning: '最强烈的反转信号——多头瞬间被碾压',
    action: '立即关注——几乎不留反应时间。如果持有——第一时间止损',
    reliability: 'high',
    caution: '必须两根都是大实体K线——小实体不算',
  },
  {
    id: 'bullish_kicker',   name: '跳空反多',  emoji: '🦘',
    type: 'bullish',
    category: 'kline-reversal',
    description: '跳空大阴→次日跳空大阳——空头一日之内被反杀',
    meaning: '恐慌低点被大资金瞬间拉起——空头被套',
    action: '强烈的抄底信号——但确认突破前高后再入场更安全',
    reliability: 'high',
    caution: '跳空缺口越大——信号越真。<1%的缺口可能骗人',
  },

  {
    id: 'tasuki_gap',       name: '跳空续跌',  emoji: '⏬',
    type: 'bearish',
    category: 'kline-continuation',
    description: '阴线→跳空小阳→再来阴线——下跌中"假反弹"',
    meaning: '下跌中继——反弹是逃跑机会不是抄底',
    action: '如果持有——逢反弹减仓。如果想抄底——再等等',
    reliability: 'medium',
    caution: '第三根阴线必须创新低——否则可能是真反转',
  },
  {
    id: 'bullish_tasuki',   name: '跳空续涨',  emoji: '⏫',
    type: 'bullish',
    category: 'kline-continuation',
    description: '阳线→跳空小阴→再来阳线——上涨中"假回调"',
    meaning: '上涨中继——回调是加仓机会',
    action: '可以在第三根阳线确认后加仓',
    reliability: 'medium',
    caution: '第三根阳线需放量——缩量="没劲了"',
  },

  {
    id: 'belt_hold',        name: '光头光脚',  emoji: '💈',
    type: 'bullish',
    category: 'kline-reversal',
    description: '跳空低开后一路涨——全天没有下影线',
    meaning: '开盘就是最低价——买方吃掉所有卖单',
    action: '强烈的买入信号——尤其在关键支撑位',
    reliability: 'medium',
    caution: '必须伴随放量——缩量的光头光脚可能是"假强势"',
  },
  {
    id: 'bearish_belt',     name: '光脚光頭',  emoji: '💈',
    type: 'bearish',
    category: 'kline-reversal',
    description: '跳空高开后一路跌——全天没有上影线',
    meaning: '开盘就是最高价——所有买单都被套',
    action: '高位出现=见顶——如果持有考虑减仓',
    reliability: 'medium',
    caution: '需要确认趋势背景。横盘中的光头光脚意义不大',
  },

  {
    id: 'unique_3river',    name: '三河底',    emoji: '🌊',
    type: 'bullish',
    category: 'kline-reversal',
    description: '长阴→小阳锤子→第三根阴但收在第二根范围内——跌不动了',
    meaning: '卖压三次都打不下去=磨底',
    action: '观察第四根K线——收阳=底部确认，可以入场',
    reliability: 'medium',
    caution: '成交量需要递减——"没人卖了"。如果放量下跌——继续观望',
  },
  {
    id: 'concealing_swallow',name: '吞噬燕归', emoji: '🐦',
    type: 'bearish',
    category: 'kline-reversal',
    description: '两根小阴+第三根吞前两根的大阴——空头突然发力',
    meaning: '缓跌后的加速——"不急不慢的卖突然变疯狂"',
    action: '空头加速信号——如果持有多头——立刻减仓',
    reliability: 'medium',
    caution: '确认成交量——放量=真的加速下跌。缩量=可能是"诱空"',
  },

  // ── K线形态: 中继/震荡类 (4个) ──
  {
    id: 'side_by_side_white',name: '并列阳线', emoji: '☀️',
    type: 'bullish',
    category: 'kline-continuation',
    description: '上涨后出现两根几乎一样高的小阳线——休整而非反转',
    meaning: '趋势中的"中场休息"——休息完继续原方向',
    action: '上涨中继——可以在第二根小阳线确认后加仓',
    reliability: 'low',
    caution: '可靠度低——如果伴随缩量=主力在休息。如果放量停滞=小心变盘',
  },

  {
    id: 'upside_gap_2crows',name: '跳空双鸦',  emoji: '🐦‍⬛',
    type: 'bearish',
    category: 'kline-reversal',
    description: '阳线→跳空高开收阴→第三根再阴——上涨中的突然翻脸',
    meaning: '跳空高开后没能继续涨——多头力量耗尽',
    action: '上涨途中的见顶信号——减仓观察',
    reliability: 'medium',
    caution: '如果第二根阴线收盘高于第一根阳线的收盘=信号减弱',
  },

  {
    id: 'identical_3crows', name: '三只乌鸦',  emoji: '🐦‍⬛',
    type: 'bearish',
    category: 'kline-reversal',
    description: '三根几乎等长的阴线依次创新低——稳定的下跌',
    meaning: '空头在"稳步出货"——不是恐慌，是"有计划地卖"',
    action: '更稳的跌势=更难反弹。不要抄底——等确认底部再动',
    reliability: 'high',
    caution: '可靠的下跌信号——比单根阴线更值得信任',
  },

  {
    id: 'ladder_bottom',    name: '阶梯底',    emoji: '🪜',
    type: 'bullish',
    category: 'kline-reversal',
    description: '四根渐小的阴线+第五根跳空高开的阳线——"卖不动了+有人进场"',
    meaning: '卖压在递减——直到某一天买方突然发力',
    action: '第五根阳线出现后入场——这是"底部的底部"',
    reliability: 'medium',
    caution: '需要第五根放量——如果缩量可能是"假进场"',
  },

  // ── 图表形态: 高级形态 (6个) ──
  {
    id: 'cup_handle',       name: '杯柄形态',  emoji: '🏆',
    type: 'bullish',
    category: 'chart-advanced',
    description: 'U形"杯"+右侧小"柄"回踩——威廉·欧奈尔的招牌',
    meaning: '主力在杯里吸筹——在柄里洗最后一次盘',
    action: '突破柄的上边界时入场——这是经过了"充分准备"的突破',
    reliability: 'high',
    caution: '杯柄必须放量突破。缩量突破=假突破',
  },

  {
    id: 'inverse_cup_handle',name: '倒杯柄',  emoji: '🏆',
    type: 'bearish',
    category: 'chart-advanced',
    description: '倒扣的杯子——反弹后无力再创新高',
    meaning: '见顶形态——"杯子倒过来就是顶"',
    action: '跌破柄的下边界=趋势转空',
    reliability: 'high',
    caution: '右半边必须比左半边低——"反弹无力"才是真反转'
  },

  {
    id: 'diamond_top',      name: '钻石顶',    emoji: '💎',
    type: 'bearish',
    category: 'chart-advanced',
    description: '先扩张再收敛的菱形——由宽变窄的波动',
    meaning: '市场从混乱→安静——安静之后往往选择向下',
    action: '跌破下边界=空头确认。减仓或做空',
    reliability: 'medium',
    caution: '钻石非常罕见——如果看到"有点像"但不确定=不要交易',
  },

  {
    id: 'diamond_bottom',   name: '钻石底',    emoji: '💎',
    type: 'bullish',
    category: 'chart-advanced',
    description: '暴跌后的菱形整理——市场从混乱中慢慢恢复',
    meaning: '恐慌→犹豫→方向选择——选对了就是大反弹',
    action: '突破上边界=多头确认。可以入场',
    reliability: 'medium',
    caution: '钻石底比钻石顶更少见——不要主动去寻找',
  },

  {
    id: 'broadening',       name: '扩散形态',  emoji: '🔊',
    type: 'neutral',
    category: 'chart-advanced',
    description: '高点和低点都在向外扩大——波动越来越大',
    meaning: '市场分歧在加剧——多空双方谁也不服谁',
    action: '不要交易！这是"吵架市"——任何方向都可能被瞬间打脸',
    reliability: 'low',
    caution: '扩散形态中——趋势线本身不可靠。等形态结束再动',
  },

  {
    id: 'rounding_bottom',  name: '圆弧底',    emoji: '🟤',
    type: 'bullish',
    category: 'chart-advanced',
    description: '价格缓缓弯成一道弧——从跌→平→涨的渐变',
    meaning: '主力在极长周期内悄悄吸筹——不急不慢的底部',
    action: '圆弧的右侧上翘+放量=可以入场——这是最耐心的底部',
    reliability: 'high',
    caution: '可能需要1-3个月形成——短线不要等',
  },
];

// ═══════════════════════════════════════
// 形态分类中文标签
// ═══════════════════════════════════════

export const PATTERN_CATEGORY_LABELS: Record<string, { name: string; emoji: string; description: string }> = {
  'kline-reversal':      { name: 'K线反转',    emoji: '🔄', description: '单根/多根K线组合——预示方向要变' },
  'kline-continuation':  { name: 'K线中继',    emoji: '➡️', description: '趋势中的短暂休整——之后继续走' },
  'chart-advanced':      { name: '高级形态',    emoji: '📐', description: '多根K线组成的复杂图表形态' },
  'kline-basic':         { name: '基础K线',    emoji: '🕯️', description: '已有30个经典K线形态' },
  'chart-classic':       { name: '经典形态',    emoji: '📊', description: '已有的头肩/双底/三角等' },
};

// ═══════════════════════════════════════
// 形态总数对比 (面板用)
// ═══════════════════════════════════════

export const PATTERN_COUNTS = {
  before: 30,
  after: 51,
  new: 21,
  kline: { before: 30, after: 45 },
  chart: { before: 0, after: 6 },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getNewPatternById(id: string): ChartPatternEntry | undefined {
  return NEW_PATTERNS_21.find(p => p.id === id);
}

export function getNewPatternsByType(type: ChartPatternEntry['type']): ChartPatternEntry[] {
  return NEW_PATTERNS_21.filter(p => p.type === type);
}

export function getNewPatternsByCategory(cat: string): ChartPatternEntry[] {
  return NEW_PATTERNS_21.filter(p => p.category === cat);
}

export default NEW_PATTERNS_21;
