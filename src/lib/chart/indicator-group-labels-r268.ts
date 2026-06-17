// ══ R268 QClaw Task 2: 分组标签文案 (2h) ══
// 93指标×10分组 — 指标选择面板的分类导航
// 交付: 分类定义+选择面板配置

// ═══════════════════════════════════════
// TYPE
// ═══════════════════════════════════════

export interface IndicatorCategory {
  id: string;
  name: string;              // ≤4字
  emoji: string;
  description: string;       // ≤30字 — 这组指标是干什么的
  color: string;             // 分类主题色
  count: number;             // 该分类下指标数量
  whenToUse: string;         // ≤25字 — 什么时候用这类指标
  beginnerTip: string;       // ≤25字 — 给小白的一句话建议
}

export interface IndicatorSelectorConfig {
  header: {
    title: string;
    searchPlaceholder: string;
    noResults: string;
    favoritesLabel: string;
    favoritesEmpty: string;
    recentLabel: string;
    recentEmpty: string;
    allLabel: string;
  };
  categories: IndicatorCategory[];
  groupLabels: {
    builtin: string;         // "已有指标"
    r265new: string;         // "R265新增"
    r268new: string;         // "R268扩充"
    favorites: string;       // "我的收藏"
    popular: string;         // "热门"
  };
}

// ═══════════════════════════════════════
// 10大分类
// ═══════════════════════════════════════

export const INDICATOR_CATEGORIES: IndicatorCategory[] = [

  // ── 1. 趋势类 ──
  {
    id: 'trend',
    name: '趋势',
    emoji: '📈',
    description: '判断"现在是涨是跌"——方向类指标',
    color: '#3b82f6',
    count: 14 + 5 + 2,          // 14新 + 5原(SMA/EMA/WMA/MAEnv/EMACross) + 2 R265(ADX/ST)
    whenToUse: '不确定现在该不该持有——看趋势',
    beginnerTip: '先学会看MA5和MA20的关系——够了',
  },

  // ── 2. 动量类 ──
  {
    id: 'momentum',
    name: '动量',
    emoji: '🔋',
    description: '判断"涨跌的力量强不强"——速度/加速度',
    color: '#f59e0b',
    count: 11 + 14 + 3,         // 11新 + 14原(RSI/KDJ/CCI/ROC/MACD等) + 3 R265(Stoch/Aroon/Elder)
    whenToUse: '想知道趋势是"刚开始"还是"快结束了"',
    beginnerTip: 'RSI>70=涨太快了可能回调；RSI<30=跌太猛了可能反弹',
  },

  // ── 3. 成交量 ──
  {
    id: 'volume',
    name: '成交量',
    emoji: '📊',
    description: '判断"钱真的在进场还是只是喊喊"——量验证价格',
    color: '#10b981',
    count: 13 + 4 + 2,          // 13新 + 4原(OBV/VWAP/MFI/EMV) + 2 R265(CMF/Chaikin)
    whenToUse: '价格涨了但你不确定是不是"真涨"——看量',
    beginnerTip: '涨有量=真涨。涨无量=假涨。这一条规则就够了',
  },

  // ── 4. 波动类 ──
  {
    id: 'volatility',
    name: '波动',
    emoji: '↔️',
    description: '判断"市场是安静还是疯狂"——风险测量',
    color: '#8b5cf6',
    count: 8 + 5 + 0,           // 8新 + 5原(BOLL/ATR/%B/Keltner/Donchian)
    whenToUse: '想知道"现在可以放心睡觉还是需要盯盘"',
    beginnerTip: 'ATR=今天的正常波动范围。设止损用ATR——不是瞎猜',
  },

  // ── 5. 通道类 ──
  {
    id: 'channel',
    name: '通道',
    emoji: '〰️',
    description: '画"天花板和地板"——价格大概率在什么区间',
    color: '#ec4899',
    count: 4,                    // BOLL/Keltner/Donchian/MAEnvelope (已分到其他类中，这里是通道专用展示)
    whenToUse: '想找"高抛低吸"的边界',
    beginnerTip: '价格碰到上轨=贵了。碰到下轨=便宜了。但小心"骑轨"',
  },

  // ── 6. 背离/综合类 ──
  {
    id: 'divergence',
    name: '背离',
    emoji: '⚠️',
    description: '判断"价格和技术面打架了"——即将变盘',
    color: '#ef4444',
    count: 8,                    // MACD/RSI/OBV/CCI的背离识别 + ROC/DMI/ASI/Fisher
    whenToUse: '价格在涨但指标在跌——"涨不动了"',
    beginnerTip: '背离=警告。不是"马上反转"——是"小心"',
  },

  // ── 7. 中国专属 ──
  {
    id: 'china',
    name: '中国',
    emoji: '🇨🇳',
    description: 'A股用户最常用的——同花顺/通达信同款',
    color: '#ef4444',
    count: 10 + 4,              // 10新 + 4原(ARBR/CR/PSY/BIAS)
    whenToUse: '炒A股/港股——这些指标你肯定见过',
    beginnerTip: 'BBI多空线=最直观的持股/持币信号——A股新手入门首选',
  },

  // ── 8. OrderFlow ──
  {
    id: 'orderflow',
    name: '订单流',
    emoji: '📡',
    description: '看"每一笔交易在干什么"——微观市场结构',
    color: '#14b8a6',
    count: 8,
    whenToUse: '想做日内交易/想看大资金在干什么',
    beginnerTip: '进阶功能——先学会常用的再来看这些',
  },

  // ── 9. 一目均衡 ──
  {
    id: 'ichimoku',
    name: '一目',
    emoji: '☁️',
    description: '一目均衡表——五条线看全趋势支撑阻力',
    color: '#6366f1',
    count: 2,                    // Ichimoku + Ichimoku精简
    whenToUse: '想看"整个市场画面"——趋势/支撑/阻力/时间周期',
    beginnerTip: '价格在云上方=多头。价格在云下方=空头。够用了',
  },

  // ── 10. 特色指标 ──
  {
    id: 'special',
    name: '特色',
    emoji: '⭐',
    description: 'QUANT MOO独有——你在别的平台找不到的',
    color: '#f97316',
    count: 3,                    // Supertrend / Elder Ray / Fisher
    whenToUse: '想做和别人不一样的分析',
    beginnerTip: '超级趋势(Supertrend)=最傻瓜的趋势指标——"红卖绿买"',
  },
];

// ═══════════════════════════════════════
// 指标选择器面板配置
// ═══════════════════════════════════════

export const INDICATOR_SELECTOR_CONFIG: IndicatorSelectorConfig = {
  header: {
    title: '指标库',
    searchPlaceholder: '搜索指标——中文名/英文名/缩写都可以',
    noResults: '没找到"{query}"——试试别的名字？',
    favoritesLabel: '我的收藏',
    favoritesEmpty: '收藏常用的指标——点击⭐添加',
    recentLabel: '最近使用',
    recentEmpty: '用了指标后会出现在这里',
    allLabel: '全部指标',
  },

  categories: INDICATOR_CATEGORIES,

  groupLabels: {
    builtin: '已内置',
    r265new: 'R265新增',
    r268new: 'R268扩充',
    favorites: '我的收藏',
    popular: '热门推荐',
  },
};

// ═══════════════════════════════════════
// 按类别归类的指标名列表 (用于选择器渲染)
// ═══════════════════════════════════════

export interface CategoryWithIndicators {
  category: IndicatorCategory;
  indicatorIds: string[];
}

export const CATEGORY_INDICATOR_MAP: Record<string, string[]> = {
  trend:       ['hma','kama','tema','dema','zlema','alma','t3','vidya','mama','mcginley','gmma','rainbow','jurik','lsma', 'sma','ema','wma','maenvelope','emacross', 'adx','supertrend'],
  momentum:    ['stochrsi','ultosc','williamsr','cmo','rvi','ppo','kst','tsi','dpo','fisher','ergodic', 'rsi','kdj','wr','cci','macd','psy','vr','asi','arbr','cr','trix','roc','bias','dmi', 'stoch','aroon','elder'],
  volume:      ['ad','fi','volosc','nvi','pvi','vwma','mfi_vol','vroc','pvt','mfm','obvm','twap','chaikinvol', 'obv','vwap','mfi','emv', 'cmf','chaikin'],
  volatility:  ['atrp','hv','ulcer','gkvol','parkinson','yangzhang','bbwidth','consec', 'boll','atr','bbb','keltner','donchian'],
  china:       ['bbi','dkx','pbx','mike','cyw','cyx','zjlj','zlmm','ddy','ddy3', 'arbr','cr','psy','bias'],
  orderflow:   ['delta','cdelta','bvav','depthr','imbalance','flowpress','vpoc','vva'],
  divergence:  ['macd','rsi','obv','cci','roc','dmi','asi','fisher'],
  channel:     ['boll','keltner','donchian','maenvelope'],
  ichimoku:    ['ichimoku','ichimokulite'],
  special:     ['supertrend','elder','fisher'],
};

// ═══════════════════════════════════════
// 工具
// ═══════════════════════════════════════

export function getCategoryById(id: string): IndicatorCategory | undefined {
  return INDICATOR_CATEGORIES.find(c => c.id === id);
}

export function getCategoryForIndicator(indicatorId: string): string | undefined {
  for (const [cat, ids] of Object.entries(CATEGORY_INDICATOR_MAP)) {
    if (ids.includes(indicatorId)) return cat;
  }
  return undefined;
}

export default INDICATOR_CATEGORIES;
