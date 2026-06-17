// ══ R257 QClaw Task 2: 筛选条件人话化 ══
// Screener condition humanization — every filter condition gets a human name + explanation
// Design: 不是"PE<15"——是"市盈率低于15（意思是股价不算贵）"

export interface ScreenerCondition {
  id: string;
  field: string;             // 引擎字段名
  label: string;             // 人话标签(≤8字)
  emoji: string;
  description: string;       // 一句话解释(≤30字)
  unit: string;              // 单位
  category: 'VALUATION' | 'GROWTH' | 'QUALITY' | 'RISK' | 'MOMENTUM' | 'INCOME' | 'SIZE' | 'TECHNICAL';
  min: number;               // 滑块最小值
  max: number;               // 滑块最大值
  step: number;              // 滑块步长
  higherIsBetter: boolean | null; // true=越高越好, false=越低越好, null=不确定
  usageTip: string;          // 使用提示
  commonMistake: string;     // 常见误区
}

export const SCREENER_CONDITIONS: ScreenerCondition[] = [
  // ═══════════ VALUATION (估值) ═══════════
  {
    id: 'pe', field: 'peRatio', label: '市盈率', emoji: '📊',
    description: '你花几块钱买一块钱利润。越低越便宜，但便宜可能有原因。',
    unit: '倍', category: 'VALUATION', min: 0, max: 200, step: 1,
    higherIsBetter: false,
    usageTip: '同行业对比才有意义。银行PE<科技PE很正常——不是银行更便宜，是银行增长慢。',
    commonMistake: '"PE低=被低估"——不对。PE低可能是因为市场在定价它要出大事。',
  },
  {
    id: 'pb', field: 'pbRatio', label: '市净率', emoji: '📕',
    description: '股价÷每股净资产。<1=股价比净资产还低。',
    unit: '倍', category: 'VALUATION', min: 0, max: 50, step: 0.1,
    higherIsBetter: false,
    usageTip: '金融/地产/重资产行业用PB更合适。轻资产公司(科技/服务)PB参考价值不大。',
    commonMistake: '"PB<1=白捡"——有些公司净资产在缩水，PB<1是"正在变少"不是"便宜的宝藏"。',
  },
  {
    id: 'peg', field: 'pegRatio', label: 'PEG', emoji: '🎯',
    description: 'PE÷利润增速。<1=增长能撑起价格。>2=可能太贵了。',
    unit: '', category: 'VALUATION', min: 0, max: 10, step: 0.1,
    higherIsBetter: false,
    usageTip: 'PEG只对有增长的公司有意义。零增长/负增长公司的PEG=无穷大或负数，别用它。',
    commonMistake: '"PEG<1就买"——只看过去12个月增长≠未来也能保持这个速度。',
  },
  {
    id: 'evEbitda', field: 'evToEbitda', label: 'EV/EBITDA', emoji: '🏢',
    description: '企业价值÷经营利润。比PE更"真实"（剔除了负债和折旧影响）。',
    unit: '倍', category: 'VALUATION', min: 0, max: 100, step: 1,
    higherIsBetter: false,
    usageTip: '跨行业对比时EV/EBITDA比PE更准——不同行业折旧政策差异大。',
    commonMistake: '只看EV/EBITDA不看负债。高负债企业EV/EBITDA可能"看起来便宜"但实际风险大。',
  },
  {
    id: 'ps', field: 'psRatio', label: '市销率', emoji: '💰',
    description: '股价÷每股收入。公司没利润时用这个——"每块钱收入卖多少钱"。',
    unit: '倍', category: 'VALUATION', min: 0, max: 100, step: 0.1,
    higherIsBetter: false,
    usageTip: '高增长但还没盈利的公司(生物科技/早期SaaS)用PS。PS<2=便宜。',
    commonMistake: '"PS低=便宜"——收入≠利润。有些公司收入大但每卖一单就亏一单。',
  },

  // ═══════════ GROWTH (增长) ═══════════
  {
    id: 'revenueGrowth', field: 'revenueGrowthYoY', label: '收入增速', emoji: '📈',
    description: '今年卖的钱比去年多了多少%？>10%=快速增长。',
    unit: '%', category: 'GROWTH', min: -100, max: 500, step: 1,
    higherIsBetter: true,
    usageTip: '增速在加速还是放缓比绝对增速更重要。20%但开始减速<15%但在加速。',
    commonMistake: '"增长快=好股票"——如果增长靠烧钱买来的(营销费>收入)，增长越快死得越快。',
  },
  {
    id: 'epsGrowth', field: 'epsGrowthYoY', label: '利润增速', emoji: '💹',
    description: '每股利润涨了多少%？涨得快=会赚钱的能力在增强。',
    unit: '%', category: 'GROWTH', min: -100, max: 500, step: 1,
    higherIsBetter: true,
    usageTip: '利润增速>收入增速=利润率在提升(最好的增长)。利润增速<收入增速=在"卖更多但赚更少"。',
    commonMistake: '"利润增很多"——确认不是一次性收益(卖资产/退税)。要看"扣非净利润"。',
  },
  {
    id: 'earningsGrowthQ', field: 'earningsGrowthQoQ', label: '季度利润增速', emoji: '📆',
    description: '本季度利润比上季度多了多少？正=势头好。',
    unit: '%', category: 'GROWTH', min: -100, max: 500, step: 1,
    higherIsBetter: true,
    usageTip: '季节性公司(零售/旅游)QoQ不太有意义，看YoY更准。',
    commonMistake: 'QoQ为负≠公司出问题，可能是正常季节性波动。',
  },

  // ═══════════ QUALITY (质量) ═══════════
  {
    id: 'roe', field: 'roe', label: 'ROE', emoji: '🏆',
    description: '股东投的钱赚了多少回报？>15%=优秀，>20%=世界级。',
    unit: '%', category: 'QUALITY', min: -50, max: 100, step: 1,
    higherIsBetter: true,
    usageTip: 'ROE高但负债率也高=靠借钱拉高回报(质量打折)。ROE高+低负债=真正的优质。',
    commonMistake: '"ROE>20%肯定好"——如果ROE由大量回购推高(每股净资产减少)，质量打折。',
  },
  {
    id: 'roa', field: 'roa', label: 'ROA', emoji: '⚙️',
    description: '公司所有资产赚了多少回报？ROA>5%=及格，>10%=优秀。',
    unit: '%', category: 'QUALITY', min: -50, max: 50, step: 0.5,
    higherIsBetter: true,
    usageTip: 'ROA比ROE更"诚实"——不能靠借钱提高ROA。银行/保险用ROE不用ROA(资产结构特殊)。',
    commonMistake: '资产重置成本高的公司(航运/航空)ROA天然低——不是经营差。',
  },
  {
    id: 'profitMargin', field: 'netProfitMargin', label: '净利润率', emoji: '💎',
    description: '每卖出100块，最后剩多少利润？越高=生意越好做。',
    unit: '%', category: 'QUALITY', min: -50, max: 100, step: 0.5,
    higherIsBetter: true,
    usageTip: '净利润率>15%=好生意。>5%=正常。<2%=在"保命"(利润太薄，一有风吹草动就亏)。',
    commonMistake: '"利润率低=不好"——超市/零售天然利润率极低(2-3%)，靠高周转赚钱。',
  },
  {
    id: 'grossMargin', field: 'grossMargin', label: '毛利率', emoji: '🏪',
    description: '产品卖价-直接成本=毛利。越高=产品越有不可替代性。',
    unit: '%', category: 'QUALITY', min: 0, max: 100, step: 0.5,
    higherIsBetter: true,
    usageTip: '毛利率>40%=有定价权。>60%=近乎垄断。低于<20%=在卖"大路货"。',
    commonMistake: '"毛利率高=好公司"——有些天然高毛利(软件>70%)，有些天然低(零售<30%)。同行业比。',
  },
  {
    id: 'fcff', field: 'freeCashFlowYield', label: '自由现金流收益率', emoji: '💸',
    description: '公司真正"赚到手"的现金÷市值。>5%=现金奶牛。',
    unit: '%', category: 'QUALITY', min: -20, max: 50, step: 0.5,
    higherIsBetter: true,
    usageTip: 'FCF比净利润更"真"——利润可以"做"(会计调整)，现金做不了假。',
    commonMistake: '"FCF为负=公司不行"——高增长期公司大量资本开支可能拉低FCF(在建工厂/买设备)。',
  },

  // ═══════════ RISK (风险) ═══════════
  {
    id: 'debtToEquity', field: 'debtToEquity', label: '负债率', emoji: '🏋️',
    description: '借了多少钱÷自己的钱？<50%=安全，>100%=高风险。',
    unit: '%', category: 'RISK', min: 0, max: 500, step: 5,
    higherIsBetter: false,
    usageTip: '银行/保险天然高负债(>200%正常)，别跟科技公司比负债率。行业对比。',
    commonMistake: '"负债率低=安全"——有些公司靠借钱扩张赚更多，负债率太低也可能是"太保守"的信号。',
  },
  {
    id: 'currentRatio', field: 'currentRatio', label: '流动比率', emoji: '🧊',
    description: '短期资产÷短期负债。>1.5=安全，<1=可能还不起短期账。',
    unit: '', category: 'RISK', min: 0, max: 10, step: 0.1,
    higherIsBetter: true,
    usageTip: '流动比率<1=流动性危机预警。但快速增长的零售/科技流动比率可能在1-1.5(钱用在扩张上)。',
    commonMistake: '"流动比率高=好"——太高(>5)说明大量现金闲置没用，不如投资或分红。',
  },
  {
    id: 'beta', field: 'beta', label: '波动性', emoji: '🎢',
    description: '比大盘更"颠"还是更"稳"？1=跟大盘一样，>1.5=剧烈波动。',
    unit: '', category: 'RISK', min: 0, max: 5, step: 0.1,
    higherIsBetter: null, // depends on strategy
    usageTip: '追求稳定选<1。追求爆发选>1.5。Beta只能衡量"跟随大盘"的波动，不能衡量公司自身风险。',
    commonMistake: '"Beta低=安全"——低Beta的可能是因为流动性太差根本没交易量。',
  },

  // ═══════════ SIZE (规模) ═══════════
  {
    id: 'marketCap', field: 'marketCap', label: '市值', emoji: '🏢',
    description: '公司"卖价"多少？大=稳健，小=成长空间更大但风险更高。',
    unit: '亿', category: 'SIZE', min: 0, max: 30000, step: 10,
    higherIsBetter: true,
    usageTip: '大盘股(>1000亿)=稳+低波动。中盘(100-1000亿)=均衡。小盘(<100亿)=高成长空间+高风险。',
    commonMistake: '"市值小=能翻倍"——也能归零。微盘股流动性差，想卖的时候可能没人买。',
  },
  {
    id: 'avgVolume', field: 'avgVolume', label: '日均成交量', emoji: '🔄',
    description: '每天交易多少股？量大=随时能进出，量小="进去容易出来难"。',
    unit: '万股', category: 'SIZE', min: 0, max: 100000, step: 10,
    higherIsBetter: true,
    usageTip: '日均成交额<100万美元=流动性风险。日均成交额>1亿美元=机构级别流动性。',
    commonMistake: '"量小=潜力股还没被发现"——也可能是没人要了。',
  },

  // ═══════════ INCOME (收益) ═══════════
  {
    id: 'dividendYield', field: 'dividendYield', label: '股息率', emoji: '💵',
    description: '一年分红÷股价。>3%=不错，>5%=高息但需验证可持续性。',
    unit: '%', category: 'INCOME', min: 0, max: 30, step: 0.1,
    higherIsBetter: true,
    usageTip: '股息率>5%→先验证派息率(分红用了多少利润)。派息率>80%=危险。',
    commonMistake: '"股息率高=好"——可能是股价暴跌导致的"被动高股息"(陷阱)。',
  },
  {
    id: 'payoutRatio', field: 'payoutRatio', label: '派息率', emoji: '🧾',
    description: '利润的百分之多少在分红？<50%=健康，>80%=危险（没留钱防风险）。',
    unit: '%', category: 'INCOME', min: 0, max: 200, step: 5,
    higherIsBetter: false,
    usageTip: '派息率30-60%=黄金区间——既大方分红，又留了钱投资和防风险。',
    commonMistake: '"派息率0=抠门"——高增长公司把利润全投回增长，不分红是合理的。',
  },
  {
    id: 'dividendGrowth', field: 'dividendGrowth5Y', label: '股息增速', emoji: '📊',
    description: '分红每年涨多少？>5%=股息在追赶通胀，>10%="股息增长机器"。',
    unit: '%', category: 'INCOME', min: -50, max: 100, step: 1,
    higherIsBetter: true,
    usageTip: '股息连续增长>5年=公司"承诺"了股东回报。比单次高股息率更可靠。',
    commonMistake: '"股息每年涨=好"——如果涨的速度超过利润增速，迟早会砍股息。',
  },

  // ═══════════ MOMENTUM (动量) ═══════════
  {
    id: 'priceChange1M', field: 'priceChange1M', label: '近1个月涨跌', emoji: '⚡',
    description: '最近一个月是涨是跌？正=有动量，负=在下跌。',
    unit: '%', category: 'MOMENTUM', min: -100, max: 200, step: 1,
    higherIsBetter: true,
    usageTip: '短期动量(1M)适合趋势跟踪策略。但要注意——追涨是"买已经涨了的东西"不是"买还没涨的东西"。',
    commonMistake: '"近1月涨了=继续涨"——动量可能是超买信号。结合RSI判断是否过热。',
  },
  {
    id: 'priceChange6M', field: 'priceChange6M', label: '近6个月涨跌', emoji: '🚀',
    description: '半年来涨了多少？>20%=强动量，<-20%=深度回调中。',
    unit: '%', category: 'MOMENTUM', min: -100, max: 500, step: 1,
    higherIsBetter: true,
    usageTip: '6M动量比1M更稳定(过滤了噪音)。机构看6M和12M居多。',
    commonMistake: '"跌了30%=该反弹了"——没有"该反弹"这回事。便宜≠会涨。',
  },
  {
    id: 'rsi', field: 'rsi14', label: 'RSI(14日)', emoji: '🌡️',
    description: '最近涨太多了还是跌太多了？>70=可能过热，<30=可能超卖。',
    unit: '', category: 'MOMENTUM', min: 0, max: 100, step: 1,
    higherIsBetter: null, // mid is best
    usageTip: 'RSI>70使用"可能该回调"的判断而非"卖出"信号。强趋势中RSI可以维持>70很久(一直在涨)。',
    commonMistake: '"RSI>70=卖出"——大牛市中RSI可以3个月在70以上。等RSI自身掉头再判断。',
  },

  // ═══════════ TECHNICAL (技术指标) ═══════════
  {
    id: 'ma50Cross', field: 'priceToMA50', label: '距50日均线', emoji: '📏',
    description: '现价离50日均线多远？正=在均线上方(多头)，负=在下方(空头)。',
    unit: '%', category: 'TECHNICAL', min: -50, max: 100, step: 1,
    higherIsBetter: true,
    usageTip: '价格上穿50日线是经典的"转多"信号。下穿=转空信号。',
    commonMistake: '"站上50日线=该买"——可能是假突破。等确认(3天以上站稳)。',
  },
  {
    id: 'ma200Cross', field: 'priceToMA200', label: '距200日均线', emoji: '📐',
    description: '长期趋势的"准绳"。站上200日线=长期看多，跌破=看空。',
    unit: '%', category: 'TECHNICAL', min: -80, max: 200, step: 1,
    higherIsBetter: true,
    usageTip: '50日线上穿200日线="金叉"——最经典的长期看多信号。',
    commonMistake: '"跌破200日线=熊市"——可能是短暂假跌破。等周线确认。',
  },
];

// ═══════════════ 分类组织 ═══════════════

export const SCREENER_CATEGORIES = [
  { id: 'VALUATION', name: '💰 估值', description: '这家公司贵不贵？——花多少钱买一块钱利润/资产' },
  { id: 'GROWTH', name: '📈 增长', description: '这家公司在变大吗？——收入和利润增速' },
  { id: 'QUALITY', name: '⭐ 质量', description: '这家公司会赚钱吗？——ROE/利润率/现金流' },
  { id: 'RISK', name: '🛡️ 风险', description: '这家公司安全吗？——负债/流动性/波动' },
  { id: 'SIZE', name: '📏 规模', description: '这家公司有多大？——市值/成交量' },
  { id: 'INCOME', name: '💵 分红', description: '这家公司会发钱吗？——股息率/派息率/股息增长' },
  { id: 'MOMENTUM', name: '🌊 动量', description: '最近在涨还是跌？——价格变化/RSI' },
  { id: 'TECHNICAL', name: '🔧 技术指标', description: '技术面怎么说的？——均线/支撑阻力' },
];

// ═══════════════ 预设筛选方案（人话版） ═══════════════

export const SCREENER_PRESETS = [
  {
    id: 'value_hunt', name: '🔍 捡便宜', emoji: '🔍',
    description: 'PE<15+ROE>15%+负债率<80%——又好又便宜的公司',
    conditions: 'pe<15 AND roe>15 AND debtToEquity<80',
    forWhom: '价值投资者——追求"不被发现的优质公司"',
  },
  {
    id: 'growth_rocket', name: '🚀 增长火箭', emoji: '🚀',
    description: '收入增速>20%+利润增速>15%+PEG<1.5——高增长但价格合理',
    conditions: 'revenueGrowthYoY>20 AND epsGrowthYoY>15 AND pegRatio<1.5',
    forWhom: '成长投资者——追求"增长还能持续的公司"',
  },
  {
    id: 'dividend_king', name: '👑 股息贵族', emoji: '👑',
    description: '股息率>3%+派息率<60%+连续5年股息增长——安全的高股息',
    conditions: 'dividendYield>3 AND payoutRatio<60 AND dividendGrowth5Y>5',
    forWhom: '收息投资者——追求"稳定现金流"',
  },
  {
    id: 'quality_compound', name: '💎 复利机器', emoji: '💎',
    description: 'ROE>20%+利润率>15%+低负债——巴菲特会喜欢的公司',
    conditions: 'roe>20 AND netProfitMargin>15 AND debtToEquity<50',
    forWhom: '长期持有者——追求"一直挣钱的公司"',
  },
  {
    id: 'momentum_trend', name: '🌊 趋势追随', emoji: '🌊',
    description: '近6月涨>15%+站上50日均线+RSI在40-70区间——有动量但不过热',
    conditions: 'priceChange6M>15 AND priceToMA50>0 AND rsi14>=40 AND rsi14<=70',
    forWhom: '趋势交易者——追求"顺势而为"',
  },
  {
    id: 'deep_value', name: '🏚️ 深度折价', emoji: '🏚️',
    description: 'PB<1+低负债+正现金流——"破净"但财务健康的公司',
    conditions: 'pbRatio<1 AND debtToEquity<100 AND freeCashFlowYield>0',
    forWhom: '逆向投资者——追求"别人不要但我分析过能翻身的"',
  },
  {
    id: 'small_gem', name: '💠 小盘掘金', emoji: '💠',
    description: '市值<200亿+ROE>15%+收入增速>10%——小而美的公司',
    conditions: 'marketCap<200 AND roe>15 AND revenueGrowthYoY>10',
    forWhom: '小盘股猎手——追求"还没被大资金发现的宝藏"',
  },
  {
    id: 'safe_haven', name: '🛡️ 避风港', emoji: '🛡️',
    description: 'Beta<0.8+股息率>2.5%+低负债——熊市也不太会跌的',
    conditions: 'beta<0.8 AND dividendYield>2.5 AND debtToEquity<60',
    forWhom: '防御型投资者——市场要跌的时候想躲的地方',
  },
];

// ═══════════════ 工具函数 ═══════════════

export function getCondition(id: string): ScreenerCondition | undefined {
  return SCREENER_CONDITIONS.find(c => c.id === id);
}

export function getConditionsByCategory(cat: string): ScreenerCondition[] {
  return SCREENER_CONDITIONS.filter(c => c.category === cat);
}

export function getPreset(id: string) {
  return SCREENER_PRESETS.find(p => p.id === id);
}

export function formatConditionHint(cond: ScreenerCondition, value: number): string {
  const dir = cond.higherIsBetter === null ? '' :
    (cond.higherIsBetter ? '越高越好' : '越低越好');
  return `${cond.emoji} ${cond.label} ${cond.unit ? value + cond.unit : value} ${dir}`;
}

export default SCREENER_CONDITIONS;
