// ══ R268 QClaw Task 3: 搜索引导文案 (1h) ══
// 93指标搜索体验 — 搜索框placeholder/无结果/引导/推荐/别名/联想
// 交付: 搜索配置 + 别名映射 + 热门推荐 + 引导卡片

// ═══════════════════════════════════════
// TYPE
// ═══════════════════════════════════════

export interface IndicatorSearchConfig {
  searchbar: {
    placeholder: string;         // 搜索框占位
    emptyDefault: string;        // 空搜索时的引导文字
    noResults: string;           // 搜索无结果
    noResultsTip: string;        // 无结果时的建议
    tooShort: string;            // 输入太短
    searching: string;           // 搜索中
  };
  hotSearches: string[];         // 热门搜索词
  aliases: Record<string, string[]>; // 别名映射 — "kdj"→"kdj"
  quickAdd: {
    label: string;               // 快速添加按钮 — "+"
    tooltip: string;             // "添加到图表"
    added: string;               // "已添加"
    remove: string;              // "移除"
  };
  onboarding: {
    title: string;
    steps: string[];
  };
}

// ═══════════════════════════════════════
// 搜索配置
// ═══════════════════════════════════════

export const INDICATOR_SEARCH_CONFIG: IndicatorSearchConfig = {

  searchbar: {
    placeholder: '搜指标 — "MACD"、"布林带"、"趋势" 都可以',
    emptyDefault: '输入关键词搜索93个指标 — 或直接按数字键1-5加载模板',
    noResults: '没有找到匹配"{query}"的指标',
    noResultsTip: '试试: 搜中文名("布林带") / 搜缩写("BOLL") / 搜分类("动量")',
    tooShort: '再输入几个字…',
    searching: '搜索中…',
  },

  hotSearches: [
    'MACD', 'RSI', '布林带', 'KDJ', '均线', '成交量', 'Supertrend', 'ADX', '一目均衡', '主力控盘',
  ],

  aliases: {
    boll:       ['布林带', '布林', 'bollinger', 'bollinger bands'],
    macd:       ['macd', 'macd指标', '金叉死叉'],
    rsi:        ['rsi', '相对强弱', 'rsi指标'],
    kdj:        ['kdj', '随机指标', 'kd指标'],
    ma:         ['均线', '移动平均', 'ma均线', 'sma', 'ema'],
    ichimoku:   ['一目均衡', '一目均衡表', '云图', 'ichimoku cloud', 'ichimoku kinko hyo'],
    bbi:        ['多空指数', 'bbi指标', '牛熊线', 'bbi'],
    supertrend: ['超级趋势', 'st', '超级趋势线'],
    adx:        ['adx', '趋势强度', '平均趋向'],
    vwap:       ['vwap', '均价', '成交量加权均价'],
    sar:        ['sar', '抛物线', '止损转向', 'parabolic sar'],
    obv:        ['obv', '能量潮', '成交量净额'],
    cci:        ['cci', '商品通道', '顺势指标'],
    mfi:        ['mfi', '资金流量', 'mfi指标'],
    atr:        ['atr', '真实波幅', '平均真实波幅', '波动率'],
    cmf:        ['cmf', '资金流量', ' chaikin money flow'],
    stoch:      ['kd', '随机', 'stochastic', 'stoch指标'],
    aroon:      ['aroon', '阿隆', 'aro'],
    donchian:   ['唐奇安', 'dc', '海龟通道', 'donchian channel'],
    keltner:    ['肯特纳', 'kc', 'keltner channel'],
    elder:      ['elder', '艾尔德', '多空力量', 'elder ray'],
    // bbi already merged above
    dkx:        ['多空线', 'dkx指标'],
    cyw:        ['主力控盘', 'cyw指标'],
    cyx:        ['市场强弱', 'cyx指标'],
    pbx:        ['瀑布线', 'pbx指标'],
    mike:       ['麦克', 'mike支撑压力'],
    delta:      ['委托差', '买卖差', 'order delta'],
    vpoc:       ['量峰', 'poc', 'point of control', '成交量密集区'],
    ad:         ['集散', 'accumulation distribution', 'a/d线'],
    fi:         ['力量', 'force index', '力量指数'],
    nvi:        ['负量', 'negative volume', '缩量'],
    pvi:        ['正量', 'positive volume', '放量'],
    kst:        ['确然', 'know sure thing'],
    tsi:        ['tsi', '真实强度', 'true strength'],
    dpo:        ['去趋势', 'dpo震荡'],
    rvi:        ['相对活力', 'rvi'],
    cmo:        ['钱德', 'cmo', 'chande momentum'],
    fisher:     ['费雪', 'fisher变换', 'fisher transform'],
    hma:        ['赫尔', 'hull ma', 'hma'],
    kama:       ['考夫曼', 'kama', '自适应均线'],
    jurik:      ['jurik', 'jma', '超平滑均线'],
    gmma:       ['顾比', 'gmma', 'guppy', '顾比均线'],
    alma:       ['阿诺', 'alma均线', 'arnaud legoux'],
    ultimate:   ['终极', 'ultimate oscillator', 'ultosc'],
    hsvol:      ['历史波动', 'hv', 'historical vol'],
    ulcer:      ['回撤', 'ulcer index', '痛苦指数'],
    bbwidth:    ['布林宽', 'boll width', 'bollinger bandwidth'],
    zlmm:       ['主力买卖', '主力进出'],
    zjlj:       ['资金统计', '资金流向统计'],
  },

  quickAdd: {
    label: '+',
    tooltip: '添加到当前图表',
    added: '✓',
    remove: '✕',
  },

  onboarding: {
    title: '93个指标 — 从哪开始？',
    steps: [
      '1️⃣ 按数字键 1-5 加载模板 → 最快上手',
      '2️⃣ 按 I 打开这个面板 → 浏览/搜索',
      '3️⃣ 点⭐收藏常用的 → 下次更快找到',
      '4️⃣ 搜"中国" → 找到A股用户最常用的指标',
      '5️⃣ 搜"OrderFlow" → 进阶玩法，等你准备好了再看',
    ],
  },
};

// ═══════════════════════════════════════
// 搜索联想引擎
// ═══════════════════════════════════════

export function getSearchSuggestions(query: string): string[] {
  if (!query || query.length < 1) return INDICATOR_SEARCH_CONFIG.hotSearches;

  const q = query.toLowerCase();
  const matches: Set<string> = new Set();

  // 搜索别名映射
  for (const [key, aliases] of Object.entries(INDICATOR_SEARCH_CONFIG.aliases)) {
    if (key.toLowerCase().includes(q)) {
      matches.add(key);
      continue;
    }
    for (const alias of aliases) {
      if (alias.toLowerCase().includes(q)) {
        matches.add(key);
        break;
      }
    }
  }

  return Array.from(matches).slice(0, 8);
}

// ═══════════════════════════════════════
// 分类搜索快捷方式
// ═══════════════════════════════════════

export const SEARCH_SHORTCUTS = [
  { keyword: '趋势',    description: 'MA/EMA/Supertrend/ADX等21个趋势指标' },
  { keyword: '动量',    description: 'RSI/KDJ/MACD/CCI等28个动量指标' },
  { keyword: '成交量',  description: 'OBV/CMF/VWAP等19个成交量指标' },
  { keyword: '波动',    description: 'BOLL/ATR/Keltner等13个波动指标' },
  { keyword: '中国',    description: 'BBI/主力控盘/瀑布线等14个A股指标' },
  { keyword: '订单流',  description: '委托差/买卖盘/深度等8个微观指标' },
  { keyword: '背离',    description: 'MACD背离/RSI背离等8个变盘信号' },
  { keyword: '超买超卖', description: 'RSI/KDJ/StochRSI等' },
  { keyword: '均线',    description: 'SMA/EMA/HMA/KAMA/TEMA等' },
  { keyword: '资金',    description: 'CMF/主力控盘/资金统计等' },
];

export default INDICATOR_SEARCH_CONFIG;
