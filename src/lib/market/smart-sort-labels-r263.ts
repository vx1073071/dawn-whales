// ══ R263 QClaw Task 2: 智能排序标签文案 ══
// Smart sort dimension labels + sort explanations
// Design: 排序不是"按XX排"——是"告诉他这个排序在帮他回答什么问题"

export interface SortDimension {
  id: string; icon: string;
  zh: { label: string; shortLabel: string; description: string; question: string; };
  en: { label: string; shortLabel: string; description: string; question: string; };
  category: 'price' | 'fundamental' | 'technical' | 'sentiment' | 'risk' | 'custom';
  defaultDirection: 'asc' | 'desc';
  warning?: string;  // 使用时需要注意的陷阱
}

// ═══════════════════════════════════════
// 智能排序维度 (16个)
// ═══════════════════════════════════════

export const SORT_DIMENSIONS: SortDimension[] = [

  // ── 价格类 ──
  {
    id: 'changePct', icon: '📈', category: 'price', defaultDirection: 'desc',
    zh: { label: '涨跌幅', shortLabel: '涨跌', description: '按当天涨跌幅排序——立刻看到你自选里谁在涨、谁在跌', question: '今天谁动得最快？' },
    en: { label: 'Change %', shortLabel: 'Chg%', description: 'Sort by daily price change — see what\'s moving', question: 'What moved the most today?' },
  },
  {
    id: 'price', icon: '💲', category: 'price', defaultDirection: 'desc',
    zh: { label: '股价', shortLabel: '价格', description: '按最新成交价排序', question: '谁最贵/最便宜？' },
    en: { label: 'Price', shortLabel: '$', description: 'Sort by latest price', question: 'Most/least expensive?' },
    warning: '股价本身不反映公司价值——一只$5的股票可能是大盘股(大量流通股)，一只$1000的股票可能是小盘股(少量流通股)。',
  },
  {
    id: 'volume', icon: '📊', category: 'price', defaultDirection: 'desc',
    zh: { label: '成交量', shortLabel: '量', description: '按今天的成交量排序。成交量=\"市场兴趣\"——高量=关注度高', question: '今天谁最受关注？' },
    en: { label: 'Volume', shortLabel: 'Vol', description: 'Sort by today\'s trading volume. Volume = market attention.', question: 'What\'s getting the most attention?' },
    warning: '放量上涨和放量下跌含义相反——光看量不够，必须结合涨跌幅一起判断。',
  },
  {
    id: 'turnover', icon: '🔄', category: 'price', defaultDirection: 'desc',
    zh: { label: '换手率', shortLabel: '换手', description: '当天的交易量占总股本的比例。>2%=交易活跃，<0.5%=交投清淡', question: '筹码在\"换\"吗？' },
    en: { label: 'Turnover', shortLabel: 'Turnover', description: 'Volume as % of shares outstanding. >2%=active, <0.5%=illiquid.', question: 'Are shares changing hands?' },
    warning: '低价股换手率天然偏高——不要用换手率跨股票比较，应该看同一只股票历史换手率的\"异常\"变化。',
  },

  // ── 基本面类 ──
  {
    id: 'peRatio', icon: '🧮', category: 'fundamental', defaultDirection: 'asc',
    zh: { label: '市盈率(P/E)', shortLabel: 'PE', description: '股价÷每股收益。低PE=\"便宜\"，但可能因为利润在涨(low PE for good reason)或股价在跌(low PE for bad reason)', question: '谁\"看起来\"最便宜？' },
    en: { label: 'P/E Ratio', shortLabel: 'PE', description: 'Price ÷ Earnings. Low PE = \"cheap\" but could be good (growing earnings) or bad (falling price).', question: 'What looks cheapest?' },
    warning: '不同行业的PE\"正常范围\"不同：科技20-30，银行8-15，医疗15-25。跨行业比较PE没有意义。',
  },
  {
    id: 'marketCap', icon: '🏢', category: 'fundamental', defaultDirection: 'desc',
    zh: { label: '市值', shortLabel: '市值', description: '股票总价值。大市值=\"大船\"(波动小)，小市值=\"快艇\"(波动大)', question: '谁最大/最小？' },
    en: { label: 'Market Cap', shortLabel: 'Cap', description: 'Total market value. Large cap = \"big ship\" (stable), small cap = \"speedboat\" (volatile).', question: 'Biggest/smallest?' },
  },
  {
    id: 'dividendYield', icon: '💵', category: 'fundamental', defaultDirection: 'desc',
    zh: { label: '股息率', shortLabel: '股息', description: '年股息÷股价。>3%=高股息(收息用途)，<1%=成长型(不分红)', question: '谁在\"发工资\"？' },
    en: { label: 'Dividend Yield', shortLabel: 'Div%', description: 'Annual dividend ÷ price. >3%=high yield, <1%=growth (doesn\'t pay out).', question: 'Who\'s paying me?' },
    warning: '股息率高不一定好——可能是股价暴跌导致的\"被动高股息\"(分母变小)。看股息率必须同时看股价走势。',
  },
  {
    id: 'revenueGrowth', icon: '📈', category: 'fundamental', defaultDirection: 'desc',
    zh: { label: '营收增长', shortLabel: '营收', description: '公司收入在增长还是收缩？同比增长率', question: '谁的生意在变大？' },
    en: { label: 'Revenue Growth', shortLabel: 'Rev↑', description: 'Is the company\'s revenue growing or shrinking? YoY growth rate.', question: 'Whose business is growing?' },
  },

  // ── 技术面类 ──
  {
    id: 'rsi', icon: '⏱️', category: 'technical', defaultDirection: 'asc',
    zh: { label: 'RSI(14)', shortLabel: 'RSI', description: '相对强弱。<30=超卖(可能反弹)，>70=超买(可能回调)', question: '谁\"该\"反弹/回调了？' },
    en: { label: 'RSI(14)', shortLabel: 'RSI', description: 'Relative strength. <30=oversold, >70=overbought.', question: 'What\'s due for a reversal?' },
    warning: 'RSI超买/超卖不是\"必然反转\"——强势股可以超买很久，弱势股可以超卖很久。RSI是\"警示\"不是\"预测\"。',
  },
  {
    id: 'maDeviation', icon: '📏', category: 'technical', defaultDirection: 'desc',
    zh: { label: '均线偏离', shortLabel: '均线', description: '股价离20日均线的距离。远离=\"过热/过冷\"，贴近=\"在均线附近晃\"', question: '谁偏离了\"正常轨道\"？' },
    en: { label: 'MA Deviation', shortLabel: 'Dev', description: 'Price distance from 20-day MA. Far = extreme, near = normal.', question: 'What\'s off the rails?' },
  },
  {
    id: 'volatility', icon: '🎢', category: 'technical', defaultDirection: 'desc',
    zh: { label: '波动率(20日)', shortLabel: '波动', description: '最近20个交易日的价格波幅。高波动=\"刺激\"(机会和风险都大)', question: '谁最\"刺激\"？' },
    en: { label: 'Volatility(20d)', shortLabel: 'Vol', description: '20-day price swing range. High vol = exciting (big opportunities and risks).', question: 'What\'s most exciting?' },
    warning: '高波动率不等于\"趋势\"——可能是在大区间震荡(也是高波动)。看波动率必须同时看方向。',
  },
  {
    id: 'yesterdayGap', icon: '🌅', category: 'technical', defaultDirection: 'desc',
    zh: { label: '开盘跳空', shortLabel: '跳空', description: '今天开盘价 vs 昨天收盘价的差距。>2%=跳空=隔夜有大事', question: '谁被\"隔夜消息\"改变了？' },
    en: { label: 'Opening Gap', shortLabel: 'Gap', description: 'Opening price vs yesterday\'s close. >2% = overnight news hit.', question: 'Who got hit overnight?' },
  },

  // ── AI/信号类 ──
  {
    id: 'whaleySignal', icon: '🤖', category: 'sentiment', defaultDirection: 'desc',
    zh: { label: 'Whaley信号', shortLabel: 'Whaley', description: '按Whaley的综合评分排序(综合因子+技术+情绪)', question: 'Whaley看好谁？' },
    en: { label: 'Whaley Signal', shortLabel: 'Whaley', description: 'Sort by Whaley composite score (factors+tech+sentiment).', question: 'What does Whaley like?' },
    warning: 'Whaley的信号是\"分析辅助\"不是\"投资建议\"。高分不一定涨，低分不一定跌——是决策的\"参考\"。',
  },
  {
    id: 'factorStrength', icon: '🎯', category: 'sentiment', defaultDirection: 'desc',
    zh: { label: '因子强度', shortLabel: '因子', description: '你启用的因子策略的综合得分——\"你策略\"眼中的强弱排名', question: '你的策略在指向谁？' },
    en: { label: 'Factor Strength', shortLabel: 'Score', description: 'Composite score from your active factor strategies — ranking by \"your strategy\".', question: 'What does your strategy suggest?' },
  },

  // ── 风险类 ──
  {
    id: 'maxDrawdown', icon: '🔻', category: 'risk', defaultDirection: 'desc',
    zh: { label: '最大回撤', shortLabel: '回撤', description: '自你买入(或近期的)最高点以来的跌幅。大的回撤=你在这只上头亏了多少', question: '谁跌得最惨？' },
    en: { label: 'Max Drawdown', shortLabel: 'DD', description: 'Drop from recent (or your buy-in) peak. Large drawdown = how much you\'re down.', question: 'What\'s hurting the most?' },
  },
  {
    id: 'beta', icon: '🔗', category: 'risk', defaultDirection: 'desc',
    zh: { label: 'Beta', shortLabel: 'Beta', description: '对大盘的敏感度。Beta=1=跟大盘同步，Beta=2=大盘涨1%它涨2%', question: '谁最\"跟大盘\"？' },
    en: { label: 'Beta', shortLabel: 'Beta', description: 'Sensitivity to the market. Beta=1 = moves with market, Beta=2 = 2× market move.', question: 'What amplifies the market?' },
    warning: 'Beta是\"历史\"关系不是\"未来\"关系。一只股票在熊市中的Beta和在牛市中的Beta可能完全不同。',
  },
];

// ═══════════════════════════════════════
// 排序UI文案
// ═══════════════════════════════════════

export const SORT_UI_COPY = {

  // ── 排序栏 ──
  sortBar: {
    label: { zh: '排序方式', en: 'Sort by' },
    empty: { zh: '选择一个排序维度', en: 'Choose a sort dimension' },
    active: { zh: '当前排序：{dimensionLabel} {direction}', en: 'Sorted: {dimensionLabel} {direction}' },
    directionToggle: { asc_zh: '↑ 升序', asc_en: '↑ Asc', desc_zh: '↓ 降序', desc_en: '↓ Desc' },
    reset: { zh: '重置排序', en: 'Reset Sort' },
  },

  // ── 快速排序预设 ──
  quickSorts: [
    { id: 'movers', zh: '📈 今日最大涨跌', en: '📈 Top Movers', dim: 'changePct', dir: 'desc' },
    { id: 'hot', zh: '🔥 放量活跃', en: '🔥 Hot & Active', dim: 'volume', dir: 'desc' },
    { id: 'oversold', zh: '⏱️ 超卖信号', en: '⏱️ Oversold', dim: 'rsi', dir: 'asc' },
    { id: 'value', zh: '🧮 低估值', en: '🧮 Low P/E', dim: 'peRatio', dir: 'asc' },
    { id: 'dividend', zh: '💵 高股息', en: '💵 High Yield', dim: 'dividendYield', dir: 'desc' },
    { id: 'score', zh: '🤖 Whaley评分', en: '🤖 Whaley Score', dim: 'whaleySignal', dir: 'desc' },
  ],

  // ── 排序说明弹窗 ──
  sortExplanationModal: {
    title: { zh: '关于"{dimensionLabel}"排序', en: 'About sorting by "{dimensionLabel}"' },
    sections: {
      whatItMeans: { zh: '📖 这是什么', en: '📖 What it means' },
      howToUse: { zh: '🎯 怎么用', en: '🎯 How to use' },
      watchOut: { zh: '⚠️ 注意', en: '⚠️ Watch out' },
    },
    noData: { zh: '部分股票暂无{field}数据，它们会出现在列表末尾。', en: 'Some stocks lack {field} data — they appear at the bottom.' },
  },

  // ── 分类标签 ──
  categoryTabs: {
    price: { zh: '💲 价格', en: '💲 Price' },
    fundamental: { zh: '📊 基本面', en: '📊 Fundamentals' },
    technical: { zh: '📈 技术面', en: '📈 Technical' },
    sentiment: { zh: '🤖 AI/信号', en: '🤖 AI/Signal' },
    risk: { zh: '🔻 风险', en: '🔻 Risk' },
  },

  // ── 排序对比模式 ──
  compare: {
    title: { zh: '🔄 对比两种排序', en: '🔄 Compare Two Sorts' },
    description: { zh: '同时看两个维度——看看\"涨跌排名\"和\"Whaley评分排名\"之间差了多少。排名差大的股票=值得关注的\"矛盾\"。', en: 'See two dimensions side-by-side — big rank gaps = interesting contradictions worth investigating.' },
  },

  // ── 排序操作提示 ──
  tips: {
    noDataSmallStocks: { zh: '💡 提示：小市值或新上市的股票可能缺少基本面数据。这些不受影响的排序维度：涨跌幅、成交量、价格、RSI。', en: '💡 Tip: Small-cap or newly listed stocks may lack fundamentals. These dimensions always work: change%, volume, price, RSI.' },
    stickyWarning: { zh: '你看到的数据是{age}秒前的。如果市场在快速变动，排名可能稍有滞后。', en: 'Data is {age}s old. Rankings may lag slightly if the market is moving fast.' },
  },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getSortDimension(id: string): SortDimension | undefined {
  return SORT_DIMENSIONS.find(d => d.id === id);
}

export function getSortLabel(id: string, lang: 'zh' | 'en' = 'zh'): string {
  const d = getSortDimension(id);
  return d ? d[lang].label : id;
}

export function getSortShortLabel(id: string, lang: 'zh' | 'en' = 'zh'): string {
  const d = getSortDimension(id);
  return d ? d[lang].shortLabel : id;
}

export function getSortQuestion(id: string, lang: 'zh' | 'en' = 'zh'): string {
  const d = getSortDimension(id);
  return d ? d[lang].question : '';
}

export function getSortWarning(id: string): string | undefined {
  const d = getSortDimension(id);
  return d?.warning;
}

export function getSortCategory(id: string): string {
  const d = getSortDimension(id);
  return d?.category || 'custom';
}

export function getDimensionsByCategory(cat: string): SortDimension[] {
  return SORT_DIMENSIONS.filter(d => d.category === cat);
}

export function getQuickSort(id: string) {
  return SORT_UI_COPY.quickSorts.find(q => q.id === id);
}

export default SORT_DIMENSIONS;
