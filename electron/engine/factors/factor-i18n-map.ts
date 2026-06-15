// ── R162 P0-H1a / R184 A3: Factor i18n Map ───────────────────────────────
// Chinese names, one-line usage guides, color thresholds, and multi-language
// metadata for all factors. Used by factor-summary-engine.ts and frontend cards.
//
// R184 upgrade: Added level (L1/L2/L3), story (human-readable narrative),
// and signaldesc (what the current signal level means in plain language).
//
// Design: hardcoded CN strings (not dependent on i18n.t()) for reliability
// and fast lookup at render time. Chinese-language UX is the primary market.

import type { FactorSourceName } from './factor-data-provider';

// ── Level classification ──────────────────────────────────────────────────

/** Factor complexity tier — pure info layering, no access gates */
export type FactorLevel = 'L1' | 'L2' | 'L3';

/** Level display labels (8 languages) */
export const FACTOR_LEVEL_LABELS: Record<FactorLevel, Record<string, string>> = {
  L1: { 'zh-CN': '常用', 'en': 'Basic', 'ja': '基本', 'ko': '기본', 'ru': 'Базовый', 'es': 'Básico', 'fr': 'Basique', 'ar': 'أساسي' },
  L2: { 'zh-CN': '进阶', 'en': 'Advanced', 'ja': '応用', 'ko': '심화', 'ru': 'Продвинутый', 'es': 'Avanzado', 'fr': 'Avancé', 'ar': 'متقدم' },
  L3: { 'zh-CN': '专业', 'en': 'Expert', 'ja': '専門', 'ko': '전문가', 'ru': 'Эксперт', 'es': 'Experto', 'fr': 'Expert', 'ar': 'خبير' },
};

// ── Factor i18n entry ──────────────────────────────────────────────────────

export interface FactorI18nEntry {
  /** Factor ID (matches FactorDefinition.id) */
  factorId: string;
  /** Complexity tier: L1=常用(basic), L2=进阶(advanced), L3=专业(expert) */
  level: FactorLevel;
  /** Chinese display name */
  nameCN: string;
  /** Category in Chinese */
  categoryCN: string;
  /** Primary market region identifier */
  region: 'global' | 'hk' | 'us' | 'crypto';
  /** One-line usage guide (Chinese) */
  oneLine: string;
  /** Detailed description (Chinese, 2-3 sentences) */
  descriptionCN: string;
  /** How to interpret high values */
  highMeaning: string;
  /** How to interpret low values */
  lowMeaning: string;
  /** Human-readable story/narrative for the factor (Chinese) */
  story: string;
  /** What the current signal level means in plain language (Chinese) */
  signaldesc: string;
  /** Color band thresholds for score visualization (0-100) */
  colors: {
    /** ≤greenMax = green (good/safe/bullish) */
    greenMax: number;
    /** >greenMax and ≤yellowMax = yellow (neutral/caution) */
    yellowMax: number;
    /** >yellowMax = red (danger/overbought/warning) */
    redMin: number;
  };
  /** Directions: 'higherBetter' means green zone is high scores */
  direction: 'higherBetter' | 'lowerBetter' | 'neutral';
  /** Which source provides this factor's data */
  source: FactorSourceName;
}

// ── Complete Factor i18n Registry (42 entries) ────────────────────────────

export const FACTOR_I18N_REGISTRY: ReadonlyMap<string, FactorI18nEntry> = new Map(
  [
    // ═══ Universal / Fama-French — L1 常用 (6) ═══
    {
      factorId: 'MOM_12M',
      level: 'L1',
      nameCN: '12月动量',
      categoryCN: '动量',
      region: 'global',
      oneLine: '过去12个月涨幅越大，动量越强，趋势延续概率更高',
      descriptionCN: '计算过去12个月（跳过最近1个月）的总收益率。学术研究表明中期动量（3-12个月）是最稳健的因子之一。高动量股票倾向于继续上涨，但需警惕动量崩盘。',
      highMeaning: '强趋势，历史涨幅靠前',
      lowMeaning: '弱趋势或回调中，表现落后',
      story: '🏃 就像百米赛跑——前80米领先的人，后20米大概率还是领先的。动量因子相信"强者恒强"，买过去一年涨得好的股票。但在牛市末期，当所有人都冲进场后，很可能发生踩踏式崩盘——所以动量的好日子需要"适可而止"的配合。',
      signaldesc: '动量分>70=强势趋势中，可以考虑趋势跟踪策略；30-70=中等，趋势不明显；<30=弱势或回调，不宜追高',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'MOM_1M',
      level: 'L1',
      nameCN: '1月动量',
      categoryCN: '动量',
      region: 'global',
      oneLine: '最近1个月涨幅，极端值可能预示短期反转',
      descriptionCN: '计算最近1个月的收益率。短周期动量存在反转效应：极端上涨后的回调压力，以及超跌后的反弹动力。适合配合RSI判断超买超卖。',
      highMeaning: '近期强势上涨，注意回调风险',
      lowMeaning: '近期弱势下跌，可能存在反弹机会',
      story: '🔄 近乡情更怯——涨太快反而要小心。短期暴涨就像短跑冲刺，往往伴随着体力透支后的减速。1月动量的极端值常常是"物极必反"的前兆。',
      signaldesc: '动量分>80=短期过热，注意回调；40-80=正常；<40=超跌区域，可能反弹',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'LIQ',
      level: 'L1',
      nameCN: '流动性',
      categoryCN: '波动率',
      region: 'global',
      oneLine: '日均换手率，流动性越高交易成本越低',
      descriptionCN: '日均成交额/流通市值比率。高流动性标志易于进出，滑点低。学术上流动性溢价表明低流动性股票长期收益更高，但实际交易需考虑摩擦成本。',
      highMeaning: '交投活跃，进出方便',
      lowMeaning: '交投清淡，可能面临流动性风险',
      story: '💧 想进就进、想出就出才是好市场。就像超市排队——人太多要等(滑点大)，人太少可能货不全(没人接盘)。适中的流动性最舒服。',
      signaldesc: '流动性分>70=交投活跃，交易成本低；40-70=正常；<40=流动性偏紧，注意买卖价差',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'neutral',
      source: 'capital_flow',
    },
    {
      factorId: 'VOL_60D',
      level: 'L1',
      nameCN: '60日波动率',
      categoryCN: '波动率',
      region: 'global',
      oneLine: '60天年化波动率，高波动=高风险=高收益潜力',
      descriptionCN: '60日收益率标准差年化。低波动异常（低波动股票长期跑赢高波动）是学术界广泛记录的现象。防御型策略偏好低波动，激进型偏好高波动。',
      highMeaning: '价格波动剧烈，风险较高',
      lowMeaning: '价格平稳，适合稳健策略',
      story: '🛡️ 慢悠悠的乌龟反而跑赢了兔子。学术上这叫"低波动异象"——没什么大涨大跌的股票，长期收益反而更好。因为不恐慌不踩踏，复利积累最稳。',
      signaldesc: '波动率分<35=低波动，防御型股票；35-65=中等；>65=高波动，激进型',
      colors: { greenMax: 50, yellowMax: 75, redMin: 76 },
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      factorId: 'GROWTH',
      level: 'L2',
      nameCN: '成长性',
      categoryCN: '成长',
      region: 'global',
      oneLine: '营收和盈利3年复合增长率，成长股的核心指标',
      descriptionCN: 'Z(营收增长率) + Z(盈利增长率) 的合成指标。使用3年CAGR平滑短期噪音。高成长股估值通常较高，需配合估值因子判断是否合理。',
      highMeaning: '高增长，营收盈利双扩张',
      lowMeaning: '增长放缓或衰退，需警惕',
      story: '🌱 买的是未来而不是现在。高成长公司就像青少年——现在不值钱但潜力无穷。但要注意：成长越快预期越高，一旦"长慢了"股价会狠狠惩罚你。所以成长因子需要价值因子做搭档。',
      signaldesc: '成长分>70=高成长，适合趋势策略；30-70=中等增长；<30=低增长或衰退',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'QUAL',
      level: 'L1',
      nameCN: '质量',
      categoryCN: '质量',
      region: 'global',
      oneLine: '高ROE、低负债、低应计项目的综合质量评分',
      descriptionCN: 'Z(ROE) + Z(-负债率) + Z(-应计项目) 的合成指标。避开财务质量差的公司。高质量公司长期超额收益显著，尤其在高通胀/高利率环境。',
      highMeaning: '财务健康，盈利真实，造血能力强',
      lowMeaning: '财务质量存疑，应计项目偏高',
      story: '🎓 学霸到哪里都能考好。高质量公司有护城河、有定价权、有真金白银的现金流——不管经济好坏都能站着赚钱。这不是投机，是投资。',
      signaldesc: '质量分>70=财务优秀，值得长期持有；40-70=中等；<40=质量问题，需谨慎',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'SIZE',
      level: 'L1',
      nameCN: '规模(SMB)',
      categoryCN: '规模',
      region: 'global',
      oneLine: '市值对数，小盘股长期超额收益但波动更高',
      descriptionCN: 'Fama-French SMB因子。小盘股市值小、关注度低、信息不对称程度高，长期存在超额收益，但流动性差、波动大。牛市小盘强、熊市大盘稳。',
      highMeaning: '大盘蓝筹，稳定性好',
      lowMeaning: '小盘成长，弹性大、波动高',
      story: '🐟 小鱼长得快但容易翻，大鱼长得慢但稳。小盘股弹性惊人但需要强心脏——波动砸下来时很多散户先跑了。牛市小盘是战斗机，熊市是碎钞机。',
      signaldesc: '规模分<40=小盘股，弹性大；40-70=中盘；>70=大盘蓝筹，防御性强',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'lowerBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'YIELD',
      level: 'L1',
      nameCN: '股息率',
      categoryCN: '收益',
      region: 'global',
      oneLine: '过去12个月每股股息/当前股价，高股息=价值锚',
      descriptionCN: 'TTM股息收益率。在低利率环境中高股息策略有吸引力。需区分"真高股息"（持续派息）和"假高股息"（股价暴跌造成的虚高）。',
      highMeaning: '高分红，适合收息策略',
      lowMeaning: '低分红或不分红，更偏成长',
      story: '💰 躺赚收租。高股息就像收房租——稳定现金流，市场涨跌都不影响你每次收钱。但要小心"假高股息"：股价跌了一半，股息率看起来高了，但公司可能快撑不住了。',
      signaldesc: '股息率分>65=高股息，收息策略优选；35-65=中等；<35=低股息或不分红',
      colors: { greenMax: 65, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'HML',
      level: 'L1',
      nameCN: '价值(HML)',
      categoryCN: '价值',
      region: 'global',
      oneLine: '市净率倒数，低估值股票长期跑赢高估值',
      descriptionCN: 'Fama-French HML因子：账面价值/市值比率。价值股在市场恐慌期折价更深，在市场复苏期弹性更大。价值因子在美国市场2018-2020表现较弱后在2022年强势回归。',
      highMeaning: '低估值，便宜货，安全边际高',
      lowMeaning: '高估值，成长溢价已充分反映',
      story: '🛒 超市折扣区——有些是临期的"该扔"，有些是包装旧了但内容没变。价值因子帮你找到后者：价格被打趴了但公司本身不差。买打折好货，等人发现它的价值。',
      signaldesc: '价值分>70=深度低估，安全边际高；30-70=合理估值；<30=高估值，需业绩兑现',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'RMW',
      level: 'L2',
      nameCN: '盈利能力(RMW)',
      categoryCN: '质量',
      region: 'global',
      oneLine: '营业利润/账面权益，利润率高=护城河宽',
      descriptionCN: 'Fama-French RMW因子：(营收-成本-费用)/账面权益。高盈利能力意味着公司有定价权、成本控制好、竞争壁垒高。盈利持续稳定的公司适合长期持有。',
      highMeaning: '盈利能力强、成本控制好、行业地位稳固',
      lowMeaning: '盈利能力弱、可能面临价格战或成本压力',
      story: '🏰 真正的护城河——不是一次性暴利，而是持续高于行业平均的利润率。RMW高的公司：涨价客户不跑、降价同行受不了。这是深厚壁垒财务上的直接体现。',
      signaldesc: '盈利分>70=高利润率护城河；30-70=行业平均；<30=利润率偏弱',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'CMA',
      level: 'L3',
      nameCN: '投资风格(CMA)',
      categoryCN: '质量',
      region: 'global',
      oneLine: '总资产变化率，低投资扩张=保守=长期溢价',
      descriptionCN: 'Fama-French CMA因子：Δ总资产/总资产。保守投资（低扩张）公司管理者更谨慎，避免过度扩张破坏股东价值。激进扩张可能稀释ROE。',
      highMeaning: '保守经营，不大举扩张，资本纪律好',
      lowMeaning: '激进扩张，可能面临整合风险',
      story: '🏗️ 有些公司赚了钱就疯狂扩产、并购——钱花出去了，利润却不一定回来。CMA因子偏好那些"赚了钱不乱花"的管理层：利润高但投资低=把钱还给股东才是正道。',
      signaldesc: 'CMA分<35=保守投资风格(+); 35-65=正常扩张; >65=激进扩张(需警惕)',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'lowerBetter',
      source: 'stock_diagnosis',
    },

    // ═══ Technical Indicators — L1常用(5)+L2进阶(4)+L3专业(1) ═══
    {
      factorId: 'MA_20_60',
      level: 'L1',
      nameCN: '均线交叉(20/60)',
      categoryCN: '趋势',
      region: 'global',
      oneLine: 'MA20上穿MA60=金叉看涨；下穿=死叉看跌',
      descriptionCN: '20日均线与60日均线交叉信号：短期均线上穿长期均线形成金叉（看涨），下穿形成死叉（看跌）。最经典的趋势跟踪指标之一。',
      highMeaning: '短期趋势强于中期，金叉信号',
      lowMeaning: '短期趋势弱于中期，死叉信号',
      story: '🔀 金叉死叉——全球散户第一课。就像看汽车换挡：短期快线从下面穿上来=加速升挡；从上面跌下去=减速降挡。交易最基本的语言，但注意虚假信号。',
      signaldesc: '均线分>65=金叉区域，短中期趋势向上；35-65=均线纠缠；<35=死叉区域，趋势向下',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'EMA_12_26',
      level: 'L1',
      nameCN: 'MACD',
      categoryCN: '趋势',
      region: 'global',
      oneLine: 'MACD柱状图转正=动能增强，转负=动能减弱',
      descriptionCN: 'EMA12-EMA26与EMA9的差值（MACD柱状图）。柱状图由负转正（金叉）和由正转负（死叉）是最常用的交易信号，配合背离判断更准确。',
      highMeaning: '上涨动能增强，金叉区域',
      lowMeaning: '下跌动能增强，死叉区域',
      story: '📊 MACD是技术分析界的"心跳检测仪"——看的是动能而非价格本身。当价格创新低但MACD不创新低（底背离），往往是最可靠的抄底信号之一。散户最爱，机构也用。',
      signaldesc: 'MACD分>65=动能增强，多头占优；35-65=动能中性；<35=动能减弱，空头占优',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'RSI_14',
      level: 'L1',
      nameCN: 'RSI(14)',
      categoryCN: '动量',
      region: 'global',
      oneLine: 'RSI<30超卖(反弹机会)>，RSI>70超买(回调风险)',
      descriptionCN: '14日相对强弱指数。经典用法：RSI<30为超卖区（潜在买入机会），RSI>70为超买区（潜在卖出信号）。在强趋势市场中RSI会长期停留在极端区域，不宜盲目抄底。',
      highMeaning: '超买区域，短期回调压力大',
      lowMeaning: '超卖区域，短期反弹概率高',
      story: '⚖️ 股市的"温度计"。太冷了(RSI<30)说明没人敢买——往往是机会；太热了(RSI>70)说明人人都在抢——往往是风险。但注意：大牛市中RSI可以长期>80，单纯看超买超卖会过早下车。',
      signaldesc: 'RSI分<30=超卖区，反弹概率高；30-70=正常；>70=超买区，回调风险',
      colors: { greenMax: 40, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      factorId: 'KDJ',
      level: 'L2',
      nameCN: 'KDJ随机指标',
      categoryCN: '动量',
      region: 'global',
      oneLine: 'K线上穿D线=金叉看涨；J值>100超买、<0超卖',
      descriptionCN: '快速随机震荡器。K线=快速线，D线=慢速线，J线=3K-2D为加速线。J值突破100为超买（警惕回调），跌破0为超卖（关注反弹）。A股和港股市场常用短周期交易指标。',
      highMeaning: '短期强势，但警惕超买回调',
      lowMeaning: '短期弱势，但关注超卖反弹',
      story: '🎯 KDJ是RSI的"加速版"——加了J线作为领先指示器，比RSI反应更快但也更容易出假信号。短线交易者喜欢用它做日内交易参考，但长线持有者不需要太在意它。',
      signaldesc: 'KDJ分<30=超卖，短线反弹概率高；30-70=正常；>70=超买，短线回调风险',
      colors: { greenMax: 40, yellowMax: 65, redMin: 66 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'BOLL',
      level: 'L2',
      nameCN: '布林带%B',
      categoryCN: '波动率',
      region: 'global',
      oneLine: '价格在布林带的位置：上轨附近=压力，下轨附近=支撑',
      descriptionCN: '价格在布林带(20,2)中的相对位置。%B=0对应下轨（支撑），%B=1对应上轨（压力）。布林带收窄预示变盘，扩张预示趋势延续。',
      highMeaning: '价格接近上轨，短期有回调压力',
      lowMeaning: '价格接近下轨，短期有反弹动力',
      story: '📐 布林带就是价格的"弹性橡皮筋"——拉太远了会弹回来，太近了即将弹出去。布林带收窄时（带宽变小）往往是暴风雨前的宁静，随时可能突破。',
      signaldesc: '%B<30=下轨附近，有支撑；30-70=中轨附近；>70=上轨附近，有压力',
      colors: { greenMax: 40, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      factorId: 'ATR_14',
      level: 'L2',
      nameCN: 'ATR(14)',
      categoryCN: '波动率',
      region: 'global',
      oneLine: '14日平均真实波幅，用于止损设置和仓位计算',
      descriptionCN: '14日平均真实波幅。不是方向性指标，而是波动幅度指标。ATR越大表示日内波动越剧烈，止损应设得更宽；ATR越小表示平静，突破往往更有效。',
      highMeaning: '波动剧烈，止损需放宽',
      lowMeaning: '波动平缓，适合突破交易',
      story: '📏 不告诉你涨跌方向，只告诉你能跑多远。ATR是"振幅温度计"——波动大的票需要更大的止损空间，否则会被反复扫出局。仓位管理和止损设计必备。',
      signaldesc: 'ATR分>70=高波动，宽止损；30-70=中等；<30=低波动，突破策略有效',
      colors: { greenMax: 50, yellowMax: 70, redMin: 71 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'ADX',
      level: 'L2',
      nameCN: 'ADX趋势强度',
      categoryCN: '趋势',
      region: 'global',
      oneLine: 'ADX>25=趋势市场(宜追涨)，ADX<20=震荡市场(宜高抛低吸)',
      descriptionCN: '14日平均趋向指数。衡量趋势强度而非方向：ADX>25表明市场处于趋势状态（适合趋势跟踪策略），ADX<20表明市场处于盘整状态（适合均值回归策略）。',
      highMeaning: '强趋势，趋势策略有效',
      lowMeaning: '弱趋势/盘整，回归策略有效',
      story: '🧭 告诉你是直线开车还是原地转圈。ADX>25就用趋势策略（追涨杀跌）；ADX<20就用回归策略（高抛低吸）。最实用的"先用ADX决定用哪种武器"的元指标。',
      signaldesc: 'ADX>25=趋势市场，跟随趋势；20-25=过渡；<20=震荡市场，反转交易',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'OBV',
      level: 'L2',
      nameCN: '能量潮(OBV)',
      categoryCN: '情绪',
      region: 'global',
      oneLine: '价升量增=上涨真实，价升量缩=上涨乏力',
      descriptionCN: '累积成交量指标：OBV = Σ(Volume × sign(Close - PrevClose))。OBV与价格同步上行确认上涨趋势，OBV与价格背离是警告信号。',
      highMeaning: '量价配合好，资金持续流入',
      lowMeaning: '量能不足，上涨缺乏支撑',
      story: '📈 OBV验证的是"真金白银在买还是假涨"。股价涨了但OBV没跟上=可能是诱多；股价跌了但OBV稳住了=可能是洗盘。量价背离是技术分析最可靠的信号之一。',
      signaldesc: 'OBV分>65=量价配合，资金流入；35-65=中性；<35=量能不足或背离',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'sentiment',
    },
    {
      factorId: 'CMF',
      level: 'L2',
      nameCN: '蔡金资金流',
      categoryCN: '情绪',
      region: 'global',
      oneLine: '21日资金流向：正值=资金净流入(看涨)，负值=净流出(看跌)',
      descriptionCN: '蔡金资金流指标：结合价格位置和成交量判断资金流向。正值表示收盘价靠近日内高点且有量配合（资金流入），负值反之。适合中期趋势确认。',
      highMeaning: '资金持续净流入，买盘意愿强',
      lowMeaning: '资金持续净流出，抛压较重',
      story: '💵 比OBV更细致的资金流指标——不光看当天涨跌，还看收盘价在日内的位置。收在高位=资金真心想买；收在低位=资金在出货。21日均值足以过滤噪音。',
      signaldesc: 'CMF>0.1=资金持续流入；-0.1~0.1=均衡；<-0.1=资金持续流出',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'capital_flow',
    },
    {
      factorId: 'ICHIMOKU',
      level: 'L3',
      nameCN: '一目均衡云',
      categoryCN: '趋势',
      region: 'global',
      oneLine: '价格在云上方=牛市，云下方=熊市，云内=震荡',
      descriptionCN: '一目均衡表(Ichimoku Kinko Hyo)：包含转换线、基准线、先行带A/B和延迟线。云层（先行带A和B之间）是未来支撑/阻力区域。价格在云上方看涨，下方看跌。',
      highMeaning: '牛市结构，云层提供支撑',
      lowMeaning: '熊市结构，云层构成压力',
      story: '☁️ 一目均衡表是日本股民用了半个世纪的"上帝视角"——一张图看完趋势、支撑压力、动能、时间周期。云层越厚支撑越强，转换线穿过基准线是交易信号。学习成本高但一旦掌握，如虎添翼。',
      signaldesc: '价格在云上方=牛市(+); 在云内=震荡(○); 在云下方=熊市(-)',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },

    // ═══ HK-Specific — L1常用(1)+L2进阶(2)+L3专业(1) ═══
    {
      factorId: 'HKEX_SOUTHBOUND',
      level: 'L1',
      nameCN: '南向资金',
      categoryCN: '情绪',
      region: 'hk',
      oneLine: '内地资金通过港股通净买入港股的金额，越多越看涨',
      descriptionCN: '港股通每日净买入金额(港元)的Z-score。南向资金是港股最重要的增量资金来源。持续净流入=内地资金看好港股，持续净流出=撤离信号。20日滚动标准化。',
      highMeaning: '内地资金大幅流入，看好港股后市',
      lowMeaning: '内地资金流出或流入减少',
      story: '🇭🇰 内地"聪明钱"每天通过港股通北上南下。南向净买入多=内地资金在"抄底"港股。这是港股散户每天必看的数字——和北向资金一起，构成了A股和港股最大的资金面信号。',
      signaldesc: '南向分>60=资金持续流入港股；30-60=中性；<30=资金流出或减少',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'capital_flow',
    },
    {
      factorId: 'HKEX_CBCS_PREMIUM',
      level: 'L3',
      nameCN: '牛熊证溢价',
      categoryCN: '价值',
      region: 'hk',
      oneLine: '牛熊证价格与内在价值的偏离，溢价越高越贵',
      descriptionCN: '牛熊证(CBBC)市场价格与内在价值之差与现价的比率。高溢价表示牛熊证定价偏高，低溢价或折价可能是机会。注意临近收回价的牛熊证风险极高。',
      highMeaning: '牛熊证定价偏高，买入成本高',
      lowMeaning: '牛熊证定价合理或偏便宜',
      story: '🎫 牛熊证是港股的特色衍生品——自带"自动收回"机制(碰线就game over)。溢价太高说明散户在狂热追涨，往往是反向信号。专业衍生品交易员的核心参考。',
      signaldesc: '溢价分<30=合理定价；30-60=偏高；>60=溢价过高，谨慎',
      colors: { greenMax: 40, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'HKEX_WARRANT_IV',
      level: 'L3',
      nameCN: '窝轮隐含波动率',
      categoryCN: '波动率',
      region: 'hk',
      oneLine: '窝轮IV与历史波动率的差值，正=贵、负=便宜',
      descriptionCN: '窝轮BSM模型隐含波动率与正股30日历史波动率之差。正差值表示窝轮IV高于历史波动率（偏贵），负差值可能表示低估。需注意窝轮流动性。',
      highMeaning: '窝轮IV偏高，买入成本高',
      lowMeaning: '窝轮IV偏低，可能有套利机会',
      story: '📊 窝轮"贵不贵"的温度计。IV远高于历史波动率=市场在恐慌定价，窝轮偏贵不适合买；IV低于历史=市场过度平静，可能是买入窝轮的好时机。专业窝轮投资者的必修课。',
      signaldesc: 'IV差值<5%=窝轮合理；5-15%=偏贵；>15%=严重高估',
      colors: { greenMax: 40, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'HKEX_FUND_HOLD',
      level: 'L2',
      nameCN: '基金持仓',
      categoryCN: '质量',
      region: 'hk',
      oneLine: '前10大基金持仓重叠度，机构越多越受认可',
      descriptionCN: '前10大基金在个股的持仓重叠度Z-score。机构投资者通常代表专业判断，但需警惕抱团股在赎回期的一致性抛售。',
      highMeaning: '机构集中持有，专业认可度高',
      lowMeaning: '机构关注度低或回避该标的',
      story: '🏛️ 跟着大基金走——机构持仓重叠度高说明大家都在研究、在看好这只股。但反过来，一旦这些基金要赎回、要减仓，一致性抛售就是踩踏现场。看多信号，但需要拥挤度配合。',
      signaldesc: '基金分>60=机构集中持股，认可度高；30-60=正常；<30=机构少或回避',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'fund_holdings',
    },

    // ═══ US-Specific — L1常用(1)+L2进阶(3) ═══
    {
      factorId: 'US_VIX',
      level: 'L1',
      nameCN: 'VIX恐慌指数',
      categoryCN: '宏观',
      region: 'us',
      oneLine: 'VIX>30=极度恐慌(可能见底)，VIX<15=过度乐观(警惕回调)',
      descriptionCN: 'CBOE波动率指数，衡量标普500期权隐含波动率。VIX越高恐慌越大（逆势买入机会），VIX越低市场越自满（警惕黑天鹅）。著名反向指标，当VIX高就该买。',
      highMeaning: '市场恐慌，波动加大，可能是买入窗口',
      lowMeaning: '市场乐观/自满，警惕尾部风险',
      story: '😱 华尔街"恐惧温度计"——当CNBC主持人都在喊VIX飙了，往往是该抄底了。VIX>30=市场在踩踏；VIX<15=市场在睡觉。历史规律：VIX极少长期停留在极端区域，均值回归是最确定的事。',
      signaldesc: 'VIX<20=市场平静；20-30=担忧；>30=恐慌，逆向看反弹',
      colors: { greenMax: 35, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'sentiment',
    },
    {
      factorId: 'US_SHORT_RATIO',
      level: 'L2',
      nameCN: '空头持仓',
      categoryCN: '情绪',
      region: 'us',
      oneLine: '空头持仓天数>5=可能轧空(逼空)，<2=看空情绪弱',
      descriptionCN: '空头持仓/日均成交量，即空头需要多少天才能完全平仓。高天数=大量空头持仓=潜在轧空（逼空）机会。GME事件是该因子的经典案例。',
      highMeaning: '大量空头持仓，轧空概率高',
      lowMeaning: '空头情绪不重，无逼空压力',
      story: '🔥 做空的人太多=火药桶。当空头持仓天数>5天，意味着一旦股价反弹，空头被迫平仓会形成"火箭燃料"——2021年的GameStop就是教科书案例。散户反向狙击空头的利器。',
      signaldesc: '空头天数>5=逼空风险高；2-5=正常；<2=空头轻',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'sentiment',
    },
    {
      factorId: 'US_INST_HOLD',
      level: 'L2',
      nameCN: '机构持仓变化',
      categoryCN: '情绪',
      region: 'us',
      oneLine: '13F报告机构持仓环比变化，增持=看涨信号',
      descriptionCN: '基于13F季报的机构总持仓环比变化/总股本。注意数据滞后45天，但机构调仓通常持续性较强。连续两个季度增持为强信号。',
      highMeaning: '机构大幅增持，专业投资者看好',
      lowMeaning: '机构减持，需关注基本面是否恶化',
      story: '🏦 每季度末13F报告告诉你大基金在买什么。虽然数据本身有45天延迟，但机构的长期建仓通常持续数月。连续两个季度增持的信号最可靠——他们不是短线玩家。',
      signaldesc: '机构分>65=机构增持，看涨；35-65=持仓稳定；<35=机构减持，警惕',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'fund_holdings',
    },
    {
      factorId: 'US_BUYBACK',
      level: 'L2',
      nameCN: '回购收益率',
      categoryCN: '收益',
      region: 'us',
      oneLine: '净回购/市值，回购越多股东回报越高',
      descriptionCN: '(股票回购-股票发行)/市值TTM。美股市场中回购是回报股东的主要方式。高回购收益率=管理层认为股价低估+有效提升EPS。但需区分"真回购"（注销）和"假回购"（对冲期权行权稀释）。',
      highMeaning: '大量回购，股价有支撑',
      lowMeaning: '回购少或增发稀释股权',
      story: '💎 美股公司回报股东的"第一手段"不是分红而是回购。苹果一年回购800亿美元=每天都在买自己的股票。公司拿真金白银回购=CEO认为"我们自己都觉得便宜"。但要注意股票是否真的注销了还是对冲期权稀释。',
      signaldesc: '回购分>65=大量回购，股价有支撑；35-65=正常；<35=回购少或增发稀释',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },

    // ═══ Global / Multi-Market — L2进阶(1)+L3专业(2) ═══
    {
      factorId: 'OPTION_PCR',
      level: 'L2',
      nameCN: '看跌/看涨比率',
      categoryCN: '情绪',
      region: 'global',
      oneLine: 'Put/Call持仓比>1=市场看空(逆势看涨)，<0.7=过度看多(警惕)',
      descriptionCN: '看跌期权持仓/看涨期权持仓。>1.0表示市场看空情绪浓（逆势可能看涨），<0.7表示市场过度看多。是经典的逆向情绪指标。',
      highMeaning: '市场悲观情绪浓，逆向看涨',
      lowMeaning: '市场过度乐观，警惕反转',
      story: '🪞 看跌/看涨比是一面"照妖镜"——当所有人都在买Put对冲，市场往往快见底了；当没人买Put保护，市场往往太自满了。"别人贪婪时恐惧，别人恐惧时贪婪"的量化版本。',
      signaldesc: 'PCR<0.7=过度乐观，警惕；0.7-1.0=正常；>1.0=过度悲观，逆向看涨',
      colors: { greenMax: 40, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'sentiment',
    },
    {
      factorId: 'SECTOR_ROTATION',
      level: 'L3',
      nameCN: '行业轮动',
      categoryCN: '宏观',
      region: 'global',
      oneLine: '行业3/6/12月动量排名，前3行业=市场主线',
      descriptionCN: 'GICS 11大类行业的3/6/12月加权动量排名。选前3名行业作为市场主线配置方向。经济周期不同阶段不同行业占优：复苏期金融+可选消费，过热期能源+材料，衰退期防御+公用。',
      highMeaning: '所属行业处于轮动强势期',
      lowMeaning: '所属行业处于轮动弱势期',
      story: '🎡 市场资金在不同行业间轮流转——今天AI，明天银行，后天医药。识别"现在轮到谁了"比判断大盘涨跌更容易赚钱。和季节一样：春夏秋冬各有主角。',
      signaldesc: '行业分>65=该行业轮动强势，值得关注；35-65=中等；<35=弱势行业',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'FX_EXPOSURE',
      level: 'L3',
      nameCN: '汇率暴露',
      categoryCN: '宏观',
      region: 'global',
      oneLine: '非本地货币收入占比×汇率变动，本币贬值利好出口型企业',
      descriptionCN: '非本地货币收入占比 × 汇率月度变动。适用于新加坡/日本/澳大利亚等出口导向市场。本币贬值→出口企业利润增厚，本币升值→出口企业承压。',
      highMeaning: '汇率因素对盈利有利',
      lowMeaning: '汇率因素拖累盈利',
      story: '💱 做全球化生意就要看汇率脸色。美元贬值=苹果海外收入换回更多美元=财报好看。日元贬值=丰田出口车更便宜=竞争力更强。但这个因子波动快且持续短，适合辅助而非主信号。',
      signaldesc: '汇率分>60=汇率有利；30-60=中性；<30=汇率拖累',
      colors: { greenMax: 60, yellowMax: 75, redMin: 76 },
      direction: 'neutral',
      source: 'factor_research',
    },

    // ═══ Crypto-Specific — L1常用(3)+L2进阶(5)+L3专业(2) ═══
    {
      factorId: 'CRYPTO_FUNDING',
      level: 'L1',
      nameCN: '资金费率',
      categoryCN: '情绪',
      region: 'crypto',
      oneLine: '永续合约资金费率，极端正=多头拥挤(看跌)，极端负=空头拥挤(看涨)',
      descriptionCN: '8小时资金费率年化。>0.1%表示多头过度拥挤（逆势看跌），<-0.05%表示空头过度拥挤（逆势看涨）。高频率信号，适合日内/短线交易。',
      highMeaning: '多头拥挤，警惕多杀多',
      lowMeaning: '空头拥挤，可能空杀空反弹',
      story: '🏋️ 永续合约的"跷跷板"——多头太多时，费率变贵惩罚多头、奖励空头，让跷跷板回归平衡。极端费率是加密市场最可靠的反向信号之一。但要注意：极端费率可以持续数天，过早反向会受伤。',
      signaldesc: '费率<0.01%=正常；0.01-0.05%=偏高；>0.05%=多头拥挤，警惕回调',
      colors: { greenMax: 35, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_OI_DELTA',
      level: 'L2',
      nameCN: '持仓量变化',
      categoryCN: '情绪',
      region: 'crypto',
      oneLine: '24h持仓变化：价格涨+OI涨=趋势确认；价格涨+OI跌=趋势减弱',
      descriptionCN: '24小时未平仓合约变化率。OI与价格同步变化确认趋势强度，OI与价格背离是反转信号。期货市场最重要的技术指标之一。',
      highMeaning: '资金持续进场，趋势强劲',
      lowMeaning: '资金离场或观望，趋势减弱',
      story: '📊 期货市场有四象限：价涨OI涨=真突破(最bullish)；价涨OI跌=空头回补(涨不久)；价跌OI涨=真下跌(bearish)；价跌OI跌=多头止盈(跌不久)。看清你在哪个象限比看裸价格重要十倍。',
      signaldesc: 'OI+价同向=趋势确认；OI+价背离=反转预警',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_EXCHANGE_FLOW',
      level: 'L1',
      nameCN: '交易所净流量',
      categoryCN: '情绪',
      region: 'crypto',
      oneLine: '链上BTC/ETH流入交易所=抛压，流出交易所=囤币看涨',
      descriptionCN: '净流入交易所量/流通供应的7日滚动Z-score。币流入交易所通常准备卖出（利空），币流出交易所通常转入冷钱包（看涨）。链上数据最可靠的中期指标之一。',
      highMeaning: '大量币流入交易所，抛售压力',
      lowMeaning: '币流出交易所，持有者惜售',
      story: '🏦 想象你在看一个停车场——币从街道(链上)开进停车场(交易所)=准备交易/卖出；币从停车场开走(提到钱包)=不打算卖。净流入多=抛压大，净流出多=持有者在囤积。链上数据不会骗人。',
      signaldesc: '净流入<0=币流出交易所，看涨；净流入>0且<+1=轻微流入；>+1=大量流入，警惕抛压',
      colors: { greenMax: 35, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_ORDERBOOK_IMB',
      level: 'L3',
      nameCN: '订单簿不平衡',
      categoryCN: '波动率',
      region: 'crypto',
      oneLine: '买卖盘2%深度比，>0.55看涨、<0.45看跌',
      descriptionCN: '中间价2%范围内买盘深度/(买盘+卖盘深度)。>0.55表示买盘厚（短期看涨），<0.45表示卖盘厚（短期看跌）。高频微观结构信号。',
      highMeaning: '买盘深厚，短期看涨',
      lowMeaning: '卖盘压顶，短期看跌',
      story: '🔍 用最微观的视角——直接看挂单墙。买盘厚=有人愿意兜底；卖盘厚=上方压力重。订单簿深度是加密市场最实时的"多空力量对比图"。短线交易和做市商的专属武器。',
      signaldesc: '不平衡度>0.55=买盘厚，短期看涨；0.45-0.55=均衡；<0.45=卖盘厚，短期看跌',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_VOL_RATIO',
      level: 'L2',
      nameCN: '波动率比值',
      categoryCN: '波动率',
      region: 'crypto',
      oneLine: '7日/30日波动率比，>1.5=变盘突破，<0.7=压缩蓄力',
      descriptionCN: '短期波动率与中期波动率的比值。>1.5表示波动扩张（趋势策略），<0.7表示波动压缩（突破策略）。加密市场波动率变化剧烈，该指标可提前预警。',
      highMeaning: '波动扩张，趋势可能加速',
      lowMeaning: '波动压缩，可能酝酿大行情',
      story: '🌊 加密特有的"波动率呼吸"——价格不会永远平静，也不会永远疯狂。波动压缩=弹簧被压紧，随时释放(不管方向)；波动扩张=弹簧已释放，正在奔跑(跟随方向)。识别压缩→扩张的转折点=最好的入场时机。',
      signaldesc: '波动比<0.7=压缩蓄力，等待突破；0.7-1.5=正常；>1.5=扩张加速中',
      colors: { greenMax: 50, yellowMax: 75, redMin: 76 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'CRYPTO_VOLUME_PROFILE',
      level: 'L2',
      nameCN: '成交量分布POC',
      categoryCN: '趋势',
      region: 'crypto',
      oneLine: '价格与最大成交量节点(POC)的相对位置，突破POC=方向确认',
      descriptionCN: '(当前价 - POC30日)/POC。POC是过去30日成交量最密集的价格。价格在POC上方且远离=强势，价格在POC下方且远离=弱势。POC突破往往伴随放量。',
      highMeaning: '价格远高于成本区，多头优势',
      lowMeaning: '价格低于成本区，多头处于防守',
      story: '📐 "大多数人的成本价"是你的锚。价格在POC上方=大多数人在赚钱=持有信心强；在POC下方=大多数人套牢=每次反弹都会有人跑。POC被突破=市场情绪彻底转换。',
      signaldesc: '价格>POC=多头占优；价格≈POC=成本区博弈；价格<POC=空头占优',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'CRYPTO_BTC_CORR',
      level: 'L2',
      nameCN: 'BTC相关性',
      categoryCN: '宏观',
      region: 'crypto',
      oneLine: '30日滚动与BTC相关系数，>0.85=BTC影子，<0.3=独立行情',
      descriptionCN: '30日收益率与BTC收益率的Pearson相关系数。高相关性意味着该币种跟随BTC波动（beta play），低相关性意味着独立行情（alpha potential）。山寨季通常伴随低相关性。',
      highMeaning: '高度跟随BTC，同涨同跌',
      lowMeaning: '独立行情，可能有alpha机会',
      story: '🔗 加密市场90%的时间是"BTC带着全家走"，但有10%的时间某些币会走自己的路——那个就是alpha所在。相关性低=独立行情=超额收益的机会。山寨季的本质就是全场低相关+资金外溢。',
      signaldesc: '相关性>0.85=BTC影子，beta play；0.3-0.85=中度独立；<0.3=独立行情，alpha potential',
      colors: { greenMax: 50, yellowMax: 75, redMin: 76 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'CRYPTO_NVT',
      level: 'L2',
      nameCN: 'NVT比率',
      categoryCN: '价值',
      region: 'crypto',
      oneLine: '加密货币的"市盈率"：市值/链上交易量，高=高估泡沫',
      descriptionCN: '市值/日链上交易量(USD)，加密货币版P/E。NVT越高表示每单位交易量支撑的市值越大（高估），NVT越低表示链上使用活跃相对市值合理（低估）。90日Z-score标准化。',
      highMeaning: '估值偏高，市值脱离实际使用量',
      lowMeaning: '估值合理/偏低，链上活跃度高',
      story: '📊 比特币的"市盈率"。如果BTC市值1万亿但每天链上交易只有10亿=每"1元交易支撑1000元市值"——太贵了，泡沫。反过来说，链上交易量大而市值低=被低估。传统估值方法在加密世界的最佳适配。',
      signaldesc: 'NVT Z<-1=低估区域；-1~+1=正常；>+1=高估区域',
      colors: { greenMax: 35, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_ACTIVE_ADDR',
      level: 'L2',
      nameCN: '活跃地址数',
      categoryCN: '成长',
      region: 'crypto',
      oneLine: '日活地址30日均线/90日均线，增长=网络效应增强',
      descriptionCN: '(30日MA活跃地址 - 90日MA)/90日MA的Z-score。活跃地址增长是网络采用率的核心指标，领先于价格。Metcalfe定律：网络价值∝用户数²。',
      highMeaning: '网络使用率增长，基本面改善',
      lowMeaning: '网络使用率下降，用户流失',
      story: '👥 加密项目的"日活用户"——Web2用DAU、加密用活跃地址。活跃地址持续增长=网络效应在形成=基本面在变好。但注意区分bot空投地址和真实用户(需要配合交易量验证)。',
      signaldesc: '活跃地址分>65=网络增长，基本面改善；35-65=稳定；<35=活跃下降',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_LIQUIDATIONS',
      level: 'L3',
      nameCN: '爆仓热度',
      categoryCN: '波动率',
      region: 'crypto',
      oneLine: '4h爆仓量/OI，极端爆仓=恐慌抛售底+后续反弹',
      descriptionCN: '4小时总爆仓量/未平仓合约的Z-score。极端爆仓（>2.0）通常发生在插针行情中，清理杠杆后市场往往反弹。是加密货币市场特有的"恐慌底"指标。',
      highMeaning: '大量爆仓，恐慌抛售，注意反弹',
      lowMeaning: '爆仓正常，市场杠杆健康',
      story: '💣 加密市场独有的"杠杆炸弹"——一夜之间几十万人爆仓、数十亿美金灰飞烟灭。但这往往是反向信号的极端值：爆仓把杠杆全部清掉后，留下来的是现货持有者和新入场资金，市场往往在"血洗"后加速反弹。',
      signaldesc: '爆仓分<30=健康；30-60=略高；>60=极端，注意恐慌后反弹',
      colors: { greenMax: 35, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },

    // ═══ 🆕 R185: 🟢入门35因子 — A1价值 (3) ═══
    {
      direction: 'higherBetter',
      source: 'financials',
    },

    // ═══ A1价值 (续) + A2质量 (3) ═══
    {
      direction: 'higherBetter',
      source: 'financials',
    },
    {
      direction: 'higherBetter',
      source: 'financials',
    },
    {
      factorId: 'ROA',
      level: 'L1',
      nameCN: '总资产收益率',
      categoryCN: '质量',
      region: 'global',
      oneLine: '净利润/总资产，衡量"每100元资产能赚多少"，>5%=高效',
      descriptionCN: 'TTM净利润/总资产。ROA衡量管理层利用公司全部资产赚钱的效率。ROA>10%为优质公司，ROA<3%为低效资产。服务业ROA通常高于制造业(轻资产vs重资产)。',
      highMeaning: '资产使用效率高，赚钱能力强',
      lowMeaning: '资产回报低，重资产或经营低效',
      story: '🔧 同样是100万资产——A公司赚15万(ROA=15%)、B公司赚2万(ROA=2%)。A的CEO比B的CEO更会"用钱生钱"。但轻资产公司(互联网)ROA天然高，重资产(钢铁)天然低，不跨行业比较。',
      signaldesc: 'ROA>10%=高效利用；5-10%=合格；<3%=低效',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'financials',
    },
    {
      factorId: 'GROSS_MARGIN',
      level: 'L1',
      nameCN: '毛利率',
      categoryCN: '质量',
      region: 'global',
      oneLine: '(收入-成本)/收入，毛利率>40%=强定价权，<15%=价格战泥潭',
      descriptionCN: 'TTM(收入-营业成本)/收入。毛利率是定价权和竞争壁垒的直接体现——毛利率高意味着客户愿意为产品溢价买单。毛利率稳定或上升=竞争优势在增强，毛利率持续下降=竞争压力或成本失控。',
      highMeaning: '定价权强，产品溢价能力好',
      lowMeaning: '利润率薄，可能陷于价格竞争',
      story: '🏰 毛利率是"你卖的东西有多独特"的度量衡。茅台毛利率90%+说明"我就这个价你也得买"；超市毛利率15%说明"旁边还有一家你自己选"。毛利率上升说明护城河在拓宽，毛利率下降说明竞争对手在靠近。',
      signaldesc: '毛利率>40%=强定价权；20-40%=正常；<15%=薄利/价格战',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'financials',
    },
    {
      factorId: 'DEBT_TO_EQUITY',
      level: 'L1',
      nameCN: '负债权益比',
      categoryCN: '质量',
      region: 'global',
      oneLine: '总负债/净资产，<1=保守财务，>3=高杠杆高风险',
      descriptionCN: '总负债/净资产。D/E<1表示公司主要靠自有资金运营(稳健)，D/E>3表示大量依赖借债(风险高)。行业差异大：银行D/E天然>10，科技公司D/E通常<1。需同行业比较。',
      highMeaning: '借钱太多，还债压力大',
      lowMeaning: '财务保守，自有资金充足',
      story: '⚖️ 借钱做生意是把双刃剑——借对了加速成长，借错了加速破产。D/E=0.5=每年赚100万只欠50万，坦荡；D/E=5=每年赚100万欠了500万，哪天银行抽贷就歇菜。但记住银行/地产天然高杠杆≠差。',
      signaldesc: 'D/E<1=财务保守稳健；1-3=中等杠杆；>3=高杠杆，注意偿债风险',
      colors: { greenMax: 35, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'financials',
    },

    // ═══ A3低波 (2) ═══
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },

    // ═══ A4情绪 (3) — KDJ已在现有42因子中，此处新增 INSIDER_BUYING/FUND_FLOW/ETF_FLOW ═══
    {
      factorId: 'INSIDER_BUYING',
      level: 'L1',
      nameCN: '内部人增持',
      categoryCN: '情绪',
      region: 'global',
      oneLine: '高管/大股东自掏腰包买入，真金白银的看涨信号',
      descriptionCN: '近3月内部人净买入/日均成交额的Z-score。CEO/CFO/大股东用自己的钱买入通常比任何分析师报告更有说服力。但需区分例行买入(期权行权)和主动增持(大宗买入)。',
      highMeaning: '高管积极增持，看好公司前景',
      lowMeaning: '内部人买卖平衡或净减持',
      story: '🕵️ CEO用自己工资卡买自家股票——这比任何PPT都有说服力。世界上只有两个原因让人自掏腰包买入：要么觉得便宜了，要么知道好消息快来了。注意区分"主动买入"和"期权行权后持有"——前者是真信号。',
      signaldesc: '内部人分>65=显著增持，看涨信号；35-65=中性；<35=内部人净卖出，警惕',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'sentiment',
    },
    {
      factorId: 'FUND_FLOW',
      level: 'L1',
      nameCN: '资金流量',
      categoryCN: '情绪',
      region: 'global',
      oneLine: '大单资金净流入/流出，持续流入=机构在买',
      descriptionCN: '超大单+大单净买入金额/总成交额的20日滚动Z-score。大单通常代表机构资金动向——持续大单净流入是机构建仓信号。但需注意"对倒"（左手倒右手）造成的假信号。',
      highMeaning: '大资金持续流入，机构在买',
      lowMeaning: '大资金持续流出，机构在减仓',
      story: '🐋 跟着大鱼游——大单资金就是市场的"大鱼"。散户买100股，机构买100万股，谁更知道自己在做什么？但小心"对倒"陷阱：同一机构左右手互倒制造放量假象。连续多日的资金流向比单日更有意义。',
      signaldesc: '资金流分>65=持续净流入，机构建仓信号；35-65=资金平衡；<35=持续净流出',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'ETF_FLOW',
      level: 'L1',
      nameCN: 'ETF资金净流入',
      categoryCN: '情绪',
      region: 'global',
      oneLine: '板块/风格ETF资金流，流入=看好该板块，流出=撤退信号',
      descriptionCN: '所属板块ETF的20日滚动净资金流入Z-score。ETF资金流反映的是"一篮子"配置需求——板块ETF大幅流入说明有机构在系统性地增配该板块。按行业/风格/因子ETF分类跟踪。',
      highMeaning: '资金涌入该板块ETF，板块受追捧',
      lowMeaning: '资金流出该板块ETF，热度降温',
      story: '🧺 ETF就是一篮子股票——有人买这篮子说明看好这个板块整体。ETF资金大幅流入等于"我不挑个股，整个板块我都要"。相比个股资金流，ETF流更反映机构对板块/风格的宏观判断。',
      signaldesc: 'ETF流分>65=板块资金涌入；35-65=中性；<35=板块资金流出',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },

    // ═══ A5事件 (2) ═══
    {
      factorId: 'EARNINGS_SURPRISE',
      level: 'L1',
      nameCN: '业绩超预期',
      categoryCN: '事件',
      region: 'global',
      oneLine: '实际EPS vs 分析师一致预期，(实际-预期)/预期，正=超预期',
      descriptionCN: '(实际EPS - 一致预期EPS) / abs(一致预期EPS)。正值为超预期(利好)，负值为不及预期(利空)。PEAD效应(财报后漂移)是学术上最强的事后异常收益之一——超预期后股价往往持续跑赢数月。',
      highMeaning: '业绩大幅超预期，PEAD效应可能推动后续上涨',
      lowMeaning: '业绩不及预期，基本面被质疑',
      story: '🎯 分析师猜不透的才是alpha。当公司业绩远超华尔街预期——相当于考试时老师以为你考70分，结果你考了90分。市场会"补票"：之前预期太保守，股价需要重新定价。学术研究发现超预期后股价还会继续涨数周(PEAD效应)。',
      signaldesc: '超预期>10%=大幅超预期；0-10%=小幅超预期；<0(负)=不及预期',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'financials',
    },
    {
      factorId: 'DIVIDEND_CHANGE',
      level: 'L1',
      nameCN: '股息变化',
      categoryCN: '事件',
      region: 'global',
      oneLine: '最近股息调整方向，增加=管理层信心，削减=警示信号',
      descriptionCN: '(最新股息 - 去年同期股息) / 去年同期股息。股息增加是管理层对未来现金流有信心的最强信号；股息削减或取消则是重大负面信号——公司默认不会轻易动股息。',
      highMeaning: '股息增加，管理层对未来有信心',
      lowMeaning: '股息削减，现金流可能有问题',
      story: '📢 分红就是公司的"官宣"——增加分红="我们赚到钱了未来还会赚更多"；削减分红="对不起出事了"。因为公司最不愿意动的就是分红(动了股价立刻反应)，所以股息的变动方向比幅度更有信息量。',
      signaldesc: '股息增加>10%=管理层强信心；0-10%=微增；<0(削减)=警示信号',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'financials',
    },

    // ═══ A6行业 (1) ═══
    {
      factorId: 'SECTOR_STRENGTH',
      level: 'L1',
      nameCN: '行业强度',
      categoryCN: '行业',
      region: 'global',
      oneLine: '个股所在行业相对大盘的强弱，行业强=顺风，行业弱=逆风',
      descriptionCN: '(行业板块指数3月涨跌幅 - 大盘3月涨跌幅)的Z-score。行业顺风比个股选股更重要——机构研究发现40%的个股收益归因于行业因素。行业龙头股在行业上行期表现更好。',
      highMeaning: '行业强势，顺风环境',
      lowMeaning: '行业弱势，逆风环境',
      story: '🌊 选对行业比选对个股重要——大海涨潮时所有船都升高，退潮时再好的船也搁浅。研究说40%的个股涨跌归因于行业趋势。先看行业风向再选个股，像航海先看天气再起航。',
      signaldesc: '行业分>65=强势行业，顺风；35-65=中性；<35=弱势行业，逆风',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },

    // ═══ A7期权 (1) ═══
    {
      factorId: 'IV_RANK',
      level: 'L1',
      nameCN: '隐含波动率排名',
      categoryCN: '期权',
      region: 'global',
      oneLine: '当前IV在1年中的百分位，>70=IV偏高(适合卖期权)，<30=IV偏低(适合买期权)',
      descriptionCN: '当前隐含波动率在过去1年所处百分位。IV Rank>70%表示当前期权价格偏贵(卖期权有利)，IV Rank<30%表示期权价格便宜(买期权有利)。适合期权策略择时。',
      highMeaning: '期权偏贵，适合卖出期权收权利金',
      lowMeaning: '期权便宜，适合买入期权做方向',
      story: '🎟️ 期权的"贵贱温度计"——IV Rank=90%意味着当前期权价格是过去一年中最贵的10%时段，这时候卖期权可以收更高的"保险费"。就像在台风来之前卖飓风险(保险费高)，风平浪静时买保险(保险费低)。',
      signaldesc: 'IV Rank>70=期权偏贵，卖期权有利；30-70=正常；<30=期权便宜，买期权有利',
      colors: { greenMax: 40, yellowMax: 70, redMin: 71 },
      direction: 'neutral',
      source: 'sentiment',
    },

    // ═══ A8事件 (1) ═══
    {
      factorId: 'CURRENCY_EFFECT',
      level: 'L1',
      nameCN: '汇率效应',
      categoryCN: '宏观',
      region: 'global',
      oneLine: '外币收入公司受汇率影响，本币贬值=利好出口，本币升值=利好进口',
      descriptionCN: '海外收入占比 × (1/间接标价汇率月度变动)的正负判断。适用于有显著海外收入的港股(港元挂钩美元)和美股公司。本币走弱→海外收入折算更多本币→利润增厚。',
      highMeaning: '汇率变动有利于公司盈利',
      lowMeaning: '汇率变动拖累公司盈利',
      story: '💵 汇率是跨国公司的"隐形税率"——美元升值=苹果的欧洲/亚洲收入换算回美元时"缩水"；日元贬值=丰田的海外收入换成日元后"膨胀"。这个效应每季度都在悄悄发生，但很多人直到财报出来才注意到。',
      signaldesc: '汇率分>60=汇率利好；30-60=中性；<30=汇率拖累',
      colors: { greenMax: 60, yellowMax: 75, redMin: 76 },
      direction: 'neutral',
      source: 'factor_research',
    },

    // ═══ A9基本面 (2) ═══
    {
      factorId: 'FREE_CASH_FLOW_YIELD',
      level: 'L1',
      nameCN: '自由现金流收益率',
      categoryCN: '质量',
      region: 'global',
      oneLine: 'FCF/市值，比PE更诚实(不易操纵)，>5%=现金牛',
      descriptionCN: 'TTM自由现金流(经营性现金流-资本开支)/总市值。自由现金流比净利润更难操纵——利润可以通过会计手段美化，但银行的现金不会说谎。FCF/EV>8%为深度价值区间。',
      highMeaning: '真金白银的现金回报率高，财务扎实',
      lowMeaning: '自由现金流弱，利润可能"含金量"不足',
      story: '💎 利润可以"做"出来，但银行的现金不会骗人。FCF收益率问的是"老板真拿到多少钱"而非"账上写了赚多少"。很多公司利润很漂亮但FCF为负——钱被应收账款和库存吃掉了，根本没落袋。',
      signaldesc: 'FCF收益率>8%=现金牛，财务扎实；3-8%=正常；<3%=FCF偏弱',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'financials',
    },
    {
      factorId: 'EQUITY_MULTIPLIER',
      level: 'L1',
      nameCN: '权益乘数',
      categoryCN: '质量',
      region: 'global',
      oneLine: '总资产/净资产，杠杆的温度计，<2=保守，>5=高杠杆',
      descriptionCN: '总资产/净资产(Equity Multiplier = 1 + D/E)。权益乘数是杜邦分析的核心环节——ROE=净利率×周转率×权益乘数。权益乘数高说明公司大量依赖负债驱动ROE(风险较高)。',
      highMeaning: '高杠杆运营，ROE含"借来的"成分',
      lowMeaning: '低杠杆运营，ROE含金量高',
      story: '🔢 杜邦分析的"杠杆因子"——ROE好看不一定是真本事，可能是借钱借出来的。权益乘数=5意味着公司80%的资产靠借钱买的。用这个指标来拆解ROE：净利率×周转率=经营能力，权益乘数高=加杠杆。',
      signaldesc: '权益乘数<2=低杠杆保守运营；2-4=适中；>5=高杠杆运营',
      colors: { greenMax: 40, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'financials',
    },

    // ═══ A10行为 (2) ═══
    {
      factorId: 'DISPOSITION_EFFECT',
      level: 'L1',
      nameCN: '处置效应',
      categoryCN: '行为金融',
      region: 'global',
      oneLine: '浮盈卖出/浮亏持有比例，高处置效应=大量浮盈被锁，可能压制上涨',
      descriptionCN: '(浮盈卖出量/浮盈持仓) vs (浮亏卖出量/浮亏持仓)的比值。处置效应描述投资者"赚一点就跑、亏了死扛"的行为偏差。效应强度高意味着大量获利盘可能随时了结，压制上行空间。',
      highMeaning: '获利了结压力大，上行空间可能受限',
      lowMeaning: '持仓稳定，趋势可能延续',
      story: '😤 "赚3%赶紧跑，亏30%打死不卖"——这是人类天性，也是行为金融学最著名的发现之一。高处置效应=获利盘随时可能涌出=这条"获利天花板"压制股价继续涨。识别这个效应帮你预判抛压。',
      signaldesc: '效应分>70=获利了结压力大；30-70=正常；<30=持仓稳定',
      colors: { greenMax: 35, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      factorId: 'ANCHORING',
      level: 'L1',
      nameCN: '锚定效应',
      categoryCN: '行为金融',
      region: 'global',
      oneLine: '价格偏离52周高低点的"锚"，接近高点=关注回调，远离高点=可能反弹',
      descriptionCN: '1 - (52周高点-当前价)/(52周高点-52周低点)的Z-score。投资者倾向于用52周高/低点作为心理锚——接近高点时过度乐观，接近低点时过度悲观。逆向信号：接近高点时谨慎，远离高点时关注。',
      highMeaning: '股价接近52周高点，心理阻力大',
      lowMeaning: '股价远离52周高点，可能过度悲观',
      story: '⚓ 心理上的"参考价"在作祟——52周高点="这个位置之前没突破过"，低点="这个位置之前没人敢买"。但锚只是一个心理惯性，不是基本面。接近高点的股票往往有真实的好消息支撑，远离高点的也往往真有坏消息。',
      signaldesc: '锚定分>80=极接近高点，追高风险；50-80=强势区间；<30=价值回归可能',
      colors: { greenMax: 40, yellowMax: 70, redMin: 71 },
      direction: 'neutral',
      source: 'factor_research',
    },

    // ═══ 🆕 R185: 港股🟢 (5) ═══
    {
      factorId: 'HK_AH_PREMIUM',
      level: 'L1',
      nameCN: 'AH溢价',
      categoryCN: '价值',
      region: 'hk',
      oneLine: 'A股相对H股溢价率，>130=H股便宜，<110=A股便宜',
      descriptionCN: '(A股价格-H股价格)/H股价格。AH溢价指数>130表示A股显著贵于H股(H股更便宜)，是南下资金买入H股的驱动力之一。长期均值在120左右，极端溢价往往回归。',
      highMeaning: 'A股溢价高，H股相对便宜',
      lowMeaning: 'AH价差缩小或H股不便宜',
      story: '🇭🇰 同一家公司的股票，A股比H股贵30%——你会买哪边的？这就是AH溢价的"套利直觉"。溢价高时南下资金涌入买H股"薅羊毛"，溢价低时说明H股已经涨过了。长期120是均值，极端会回归。',
      signaldesc: 'AH溢价>130=H股便宜，南向买入信号；110-130=正常；<110=A股便宜',
      colors: { greenMax: 40, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'AH_PREMIUM_CHANGE',
      level: 'L1',
      nameCN: 'AH溢价变动',
      categoryCN: '价值',
      region: 'hk',
      oneLine: 'AH溢价的20日变动，收窄=H股补涨可能，扩大=H股可能承压',
      descriptionCN: '当前AH溢价-20日前AH溢价的Z-score。溢价快速收窄时说明H股正在追赶A股涨幅(南向资金活跃)，溢价扩大时说明H股跑输A股(可能有南下资金流出)。',
      highMeaning: '溢价收窄，H股在追赶',
      lowMeaning: '溢价扩大，H股跑输A股',
      story: '📏 AH溢价的加速度——溢价快速收窄说明南下资金正在"收割"：之前H股太便宜了，现在正在被买上来。溢价扩大说明A股独自狂欢、H股被冷落。这个方向比溢价绝对值本身更有交易价值。',
      signaldesc: '溢价变动<0(收窄)=H股追赶中，看涨；≈0=稳定；>0(扩大)=H股跑输',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'HSI_CONSTITUENT',
      level: 'L1',
      nameCN: '恒指成分股',
      categoryCN: '质量',
      region: 'hk',
      oneLine: '是否恒生指数成分股，成分股=流动性好+基本面优良',
      descriptionCN: '恒生指数成分股属性评分(是=1/否=0)+权重排名百分位。恒指成分股代表港股市场中最优质的蓝筹公司，享有更好的流动性和估值溢价。新纳入恒指的股票通常有正面的短期公告效应。',
      highMeaning: '恒指核心成分股，大蓝筹',
      lowMeaning: '非恒指成分股或权重极低',
      story: '🏅 恒指成分股=港股的"国家队"。进入恒指意味着被动基金必须配置、知名度大增、流动性溢价。每年恒指季检公布前后是交易机会——被纳入的涨、被剔除的跌，但要小心"买预期卖事实"。',
      signaldesc: '恒指成分分>80=核心蓝筹，流动性好；20-80=中型成分；<20=小型股/非成分',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'HK_REIT_YIELD',
      level: 'L1',
      nameCN: '港股REIT收益率',
      categoryCN: '价值',
      region: 'hk',
      oneLine: 'REIT分派率/10年国债收益率，>1.5=高息吸引，港人收租最爱',
      descriptionCN: 'REIT预期分派收益率/香港10年期政府债收益率。>1.5表示REIT的"租金回报"显著高于国债利息(具有吸引力)。领展、置富等是港人"收息"首选。注意分派率受租金收入和物业估值影响。',
      highMeaning: 'REIT分派率高，收息价值突出',
      lowMeaning: 'REIT分派率低或债券收益高，吸引力下降',
      story: '🏢 香港人爱"收租"——买REIT就等于买了一篮子收租物业(商场、写字楼、停车场)。当REIT分派率远高于银行利息和国债时="与其存银行不如买REIT收租"。领展是香港散户的"国民REIT"。',
      signaldesc: 'REIT收益比>1.5=高息吸引力强；1.0-1.5=正常；<1.0=吸引力不足',
      colors: { greenMax: 60, yellowMax: 75, redMin: 76 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },

    // ═══ 🆕 R185: 美股🟢 (5) ═══
    {
      factorId: 'US_EARNINGS_CALENDAR',
      level: 'L1',
      nameCN: '美股财报日历',
      categoryCN: '事件',
      region: 'us',
      oneLine: '距离下次财报天数+财报季节奏，财报前=波动加大，财报后=漂移期',
      descriptionCN: '基于财报日历的时间因子：距下次财报天数+当前处于财报季的哪个阶段。财报前隐含波动率上升(期权贵)，财报后PEAD效应可能持续数周。',
      highMeaning: '财报临近，市场关注度高',
      lowMeaning: '财报已过，处于信息真空期',
      story: '📅 美股一年四次"财报季"——每90天一轮的固定节目。财报前期权贵(隐含波动率高)，财报后股价可能因为PEAD效应继续漂移数周。知道公司什么时候交作业有助于把握交易节奏。',
      signaldesc: '距财报<10天=临近，波动加大；10-30天=中；>30天=真空期',
      colors: { greenMax: 60, yellowMax: 75, redMin: 76 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'US_SECTOR_ROTATION',
      level: 'L1',
      nameCN: '美股板块轮动',
      categoryCN: '宏观',
      region: 'us',
      oneLine: '标普11大板块动量排名，Top3板块=当前主线',
      descriptionCN: 'GICS 11板块的3/6/12月加权动量排名。识别当前市场主导板块——科技领先=成长风格，必须消费领先=防御风格，金融+能源领先=价值/周期风格。',
      highMeaning: '所属板块处于强势轮动中',
      lowMeaning: '所属板块处于弱势/被轮出',
      story: '🎠 美股每年都在换风格——2023科技称霸，2024能源金融接棒，年中又回AI。识别谁在领跑比选个股更关键——领跑板块的二线股常比落后板块的龙头涨得多。',
      signaldesc: '板块分>65=领跑板块；35-65=中性；<35=落后板块',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'US_SMALL_CAP_MOMENTUM',
      level: 'L1',
      nameCN: '小盘股动能',
      categoryCN: '趋势',
      region: 'us',
      oneLine: '罗素2000 vs 标普500相对强弱，跑赢=小盘风格占优',
      descriptionCN: '罗素2000指数3月收益率-标普500指数3月收益率的Z-score。正值=小盘股跑赢大盘(小盘风格占优)，负值=大盘股领先。小盘股在利率见顶和降息周期表现更好。',
      highMeaning: '小盘股跑赢，风险偏好高',
      lowMeaning: '大盘股主导，风险偏好低',
      story: '🐭 小盘股是经济温度计——经济好转预期强时小盘股起飞(弹性大)，担忧时资金回流大盘(防御)。降息周期是小盘股的春天：借钱便宜，小公司最先受益。',
      signaldesc: '小盘分>65=小盘占优；35-65=均衡；<35=大盘主导',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'US_DIVIDEND_ARISTOCRATS',
      level: 'L1',
      nameCN: '股息贵族',
      categoryCN: '价值',
      region: 'us',
      oneLine: '连续25年+提高分红=股息贵族，稳定性的代名词',
      descriptionCN: '是否标普500股息贵族成员(连续25年以上每年增加分红)。极高质量标志——能经历2000年泡沫/2008年危机/2020年疫情还年年涨分红，说明盈利稳定性和股东回报文化非凡。',
      highMeaning: '连续25年+增加分红，极高质量',
      lowMeaning: '非股息贵族，分红历史不够稳定',
      story: '👑 美股股息贵族俱乐部——连续25年以上每年增加分红，仅约65家公司有资格入会。经历互联网泡沫、金融危机、疫情还年年涨分红——背后是极其稳定的现金流和自律的管理层。',
      signaldesc: '股息贵族=是(1)，极高确定性；非=0',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'financials',
    },
    {
      factorId: 'US_SP500_EQUAL_WEIGHT',
      level: 'L1',
      nameCN: '标普等权vs加权',
      categoryCN: '趋势',
      region: 'us',
      oneLine: '等权指数跑赢加权=市场广度好(健康)，跑输=巨头独舞(不健康)',
      descriptionCN: '标普500等权重指数/市值加权指数的3月涨跌幅差。比值上升=大多数股票都在涨(健康)，比值下降=只有少数巨头拉指数(虚假繁荣)。2023年AI行情就是典型分化行情。',
      highMeaning: '市场广度好，多数股票参与上涨',
      lowMeaning: '市场分化，仅少数巨头拉动指数',
      story: '⚖️ 标普涨不代表大多数股票在涨——2023年7大科技巨头拉指数，其余493只几乎不动。等权vs加权告诉你涨得多假——比值升=大家都有份，比值降=只有巨头表演。',
      signaldesc: '比值分>65=广泛参与，健康牛；35-65=正常；<35=巨头独舞',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },

    // ═══ 🆕 R185: 加密🟢 (3) ═══
    {
      factorId: 'CRYPTO_MVRV',
      level: 'L1',
      nameCN: 'MVRV比率',
      categoryCN: '价值',
      region: 'crypto',
      oneLine: '市值/实现市值，>3.7=过热高估，<1=低估(矿工亏钱)',
      descriptionCN: '市值(当前价×流通量)/实现市值(每枚币最后移动价格×数量)。MVRV是加密最著名估值指标——>3.7为历史顶部(2017/2021顶均在此)，<1为历史底部(矿工亏损)。',
      highMeaning: '估值偏高，市场可能过热',
      lowMeaning: '估值偏低，可能接近底部',
      story: '📊 加密市盈率的升级版——不用盈利衡量(币无盈利)，用"多少钱进的货"衡量。MVRV>3.7=平均持仓成本仅当前价27%，大家都有巨大浮盈——历史顶部信号。MVRV<1=都在亏钱——历史底部。',
      signaldesc: 'MVRV<1=低估；1-2.5=正常；2.5-3.7=偏高；>3.7=过热',
      colors: { greenMax: 35, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_S2F',
      level: 'L1',
      nameCN: 'Stock-to-Flow',
      categoryCN: '价值',
      region: 'crypto',
      oneLine: '存量/年产量，BTC减半后S2F翻倍=稀缺性上升',
      descriptionCN: '当前流通量/年新增产量。S2F由PlanB推广——BTC每4年减半S2F翻倍(稀缺性翻倍)，历史上对应价格大幅上涨。作为稀缺性因子有参考价值。',
      highMeaning: '稀缺性高，供应增长有限',
      lowMeaning: '稀缺性低，供应增长较快',
      story: '🥇 比特币数字黄金叙事核心。黄金S2F约62，BTC在2024减半后约120——比黄金还稀缺。虽然PlanB预测模型争议大，但越来越稀缺的事实无法否认。',
      signaldesc: 'S2F>100=极度稀缺；50-100=高稀缺；<50=较低',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'CRYPTO_HASH_RATE',
      level: 'L1',
      nameCN: '哈希率变化',
      categoryCN: '成长',
      region: 'crypto',
      oneLine: '算力30日变化率，增长=网络安全增强+矿工信心足',
      descriptionCN: '(当前30日均算力-90日均)/90日均的Z-score。哈希率↑=更多矿工加入=网络安全增强=矿工中长期看好；哈希率↓=矿工关机离场(价格太低)。',
      highMeaning: '算力增长，矿工信心充足',
      lowMeaning: '算力下降，矿工可能关机离场',
      story: '⛏️ 哈希率是比特币的国防预算——算力越高网络越安全。矿工是价格先知：花真金白银买矿机电费，算力持续增长说明矿工觉得未来价够高值得投入。算力暴跌往往在BTC触底前后。',
      signaldesc: '哈希率分>65=增长，矿工信心强；35-65=稳定；<35=下降',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },

    // ═══ 🆕 R185: 跨市场🟢 (3) ═══
    {
      factorId: 'XM_MKTCAP_EXPOSURE',
      level: 'L1',
      nameCN: '市值因子暴露',
      categoryCN: '因子暴露',
      region: 'global',
      oneLine: '大小盘风格暴露度，正=偏大盘，负=偏小盘',
      descriptionCN: '个股相对市场的市值因子Beta(Fama-French三因子回归)。正值=大市值属性，负值=小市值属性。帮助判断持仓的风格倾向。',
      highMeaning: '持仓偏大盘风格',
      lowMeaning: '持仓偏小盘风格',
      story: '⚖️ 你的组合是"大象"多还是"蚂蚁"多？市值因子暴露告诉你大小盘倾向。配合市场风格判断使用：小盘风来时加大暴露，大盘防御时减暴露。',
      signaldesc: '暴露>0.3=大盘倾向；-0.3~0.3=均衡；<-0.3=小盘倾向',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'XM_LIQUIDITY',
      level: 'L1',
      nameCN: '跨市场流动性',
      categoryCN: '流动性',
      region: 'global',
      oneLine: '换手率+买卖价差综合评分，高=容易进出',
      descriptionCN: 'Z(日均换手率)+Z(-日均买卖价差)的综合流动性评分。高分=活跃且成本低，低分=流动性不足(大滑点风险)。跨市场可直接比较不同市场的流动性。',
      highMeaning: '流动性好，进出方便',
      lowMeaning: '流动性差，大额交易有滑点',
      story: '💧 能自由进出才是好市场。跨市场流动性让你比较"港股腾讯"和"美股苹果"谁的门更宽——换手率高+价差小=随时进出。大资金最敏感这个指标。',
      signaldesc: '流动性分>65=好，适合大资金；35-65=正常；<35=紧张',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'XM_DIVIDEND_ARAMA',
      level: 'L1',
      nameCN: '跨市场股息套利',
      categoryCN: '价值',
      region: 'global',
      oneLine: '跨市场上市分红净收益差异(考虑税率)，正=有套利空间',
      descriptionCN: '(H股分红净收益-美股ADR分红净收益)/股价，考虑不同市场税率差异。同一底层资产在不同市场的股息税后差距——H股红利税率20% vs 美股ADR税率30%。',
      highMeaning: '存在跨市场股息税后收益差',
      lowMeaning: '跨市场股息收益差异不大',
      story: '🧮 同一家公司，香港买分红到手80%，美国买到手70%——多出的10%就是换市场能多拿的钱。高股息股票(银行、公用事业)经复利积累差异可观。',
      signaldesc: '套利差>2%=显著空间；1-2%=有差异；<1%=不大',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },

    // ═══════════════════════════════════════════════════════════════════════
    // R187: 🟡 L2 进阶因子 Batch1 — 30 factors (29 new + ETF_FLOW already L1)
    // ═══════════════════════════════════════════════════════════════════════

    // ── A1 价值 🟡 ─────────────────────────────────────────────────────────
    {
      direction: 'lowerBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'lowerBetter',
      source: 'stock_diagnosis',
    },

    // ── A2 质量 🟡 ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'ASSET_TURNOVER',
      level: 'L2',
      nameCN: '资产周转率',
      categoryCN: '质量',
      region: 'global',
      oneLine: '资产利用效率——同样的资产，谁能卖出更多货',
      descriptionCN: '营收/总资产。高周转=轻资产运营，用较少的资产创造大量的收入(如互联网企业)。低周转=重资产行业(钢铁/航空)，需要巨量设备才能产生收入。资产周转率下行=存量资产利用率恶化——预警信号。',
      highMeaning: '轻资产高效运营，资产利用充分',
      lowMeaning: '重资产或资产闲置，效率待提升',
      story: '🔄 两个餐厅：A用10万元设备年营收50万(周转5次)，B用50万设备年营收80万(周转1.6次)。A的设备用到极致翻台率高，B可能只做晚市白天空着。高周转的企业往往有更强的定价权和更轻的模式。',
      signaldesc: '周转>1.5=高效；0.5-1.5=正常；<0.3=低效',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },

    // ── A3 低波 🟡 ─────────────────────────────────────────────────────────
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },

    // ── A4 情绪 🟡 ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'sentiment',
    },
    {
      direction: 'lowerBetter',
      source: 'sentiment',
    },

    // ── A5 宏观 🟡 ─────────────────────────────────────────────────────────
    {
      factorId: 'INFLATION_BETA',
      level: 'L2',
      nameCN: '通胀敏感度',
      categoryCN: '宏观',
      region: 'global',
      oneLine: '这家公司在通胀面前是涨价受益还是成本受害者',
      descriptionCN: '股票收益对通胀(CPI)变化的回归系数。正β=通胀上涨公司反而受益(如大宗商品/能源/房地产)。负β=通胀侵蚀利润(如消费/科技/高负债企业)。接近0=通胀不敏感。需结合当前通胀周期使用——高通胀期选正β+低通胀期选负β。',
      highMeaning: '通胀受益型——涨价传导力强',
      lowMeaning: '通胀侵蚀型——成本压力大',
      story: '🎈 通货膨胀来了：茅台说"我们也涨价"(正通胀β)，猪肉商说"饲料涨了我只能自己扛"(负通胀β)。银行说"利率跟着涨，利差更大了"(正)。科技公司说"员工要求涨薪，但我的产品不能涨价"(负)。知道自己站在通胀跷跷板的哪一端很重要。',
      signaldesc: 'β>0.5=通胀受益；-0.5~0.5=不敏感；<-0.5=通胀受损',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'contextDependent',
      source: 'factor_research',
    },
    {
      direction: 'contextDependent',
      source: 'factor_research',
    },

    // ── A6 主题 🟡 ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },

    // ── A7 期权 🟡 ─────────────────────────────────────────────────────────
    {
      direction: 'lowerBetter',
      source: 'sentiment',
    },
    {
      direction: 'lowerBetter',
      source: 'sentiment',
    },
    {
      direction: 'contextDependent',
      source: 'sentiment',
    },

    // ── A8 事件 🟡 ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'contextDependent',
      source: 'sentiment',
    },
    // ── A9 基本面 🟡 ───────────────────────────────────────────────────────
    {
      factorId: 'FREE_CASH_FLOW',
      level: 'L2',
      nameCN: '自由现金流',
      categoryCN: '基本面',
      region: 'global',
      oneLine: '经营性现金流减去资本开支——公司真正"落袋"的钱',
      descriptionCN: '经营性现金流-资本支出。正FCF=赚的钱超过再投资需求=可以分红/回购/还债。负FCF=赚的不够投入=需要融资或举债(成长期公司常见)。连续5年FCF增长+正值=自由现金流机器(巴菲特最爱)。FCF Yield=FCF/市值>5%=不贵。',
      highMeaning: '自由现金流充裕，可自由支配',
      lowMeaning: '运营现金流不足以覆盖投资',
      story: '💵 你月入2万：房贷8000+吃喝3000+孩子5000=剩4000——这4000就是你的"自由现金流"，可以旅游/投资/攒钱。公司一样：赚了1亿，维护设备花6000万，剩下4000万才是真正由公司支配的。FCF为负的公司一直在"吃老本"或借新还旧。',
      signaldesc: 'FCF正且增长=优；正但下降=关注；负=需融资',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'lowerBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'lowerBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'INVENTORY_TURNOVER',
      level: 'L2',
      nameCN: '存货周转率',
      categoryCN: '基本面',
      region: 'global',
      oneLine: '货在仓库里待了多久——存货转得越快，钱回得越快',
      descriptionCN: '营收成本/平均存货。反映库存变成现金的速度。高周转="今天进货下周卖完"=营运资金效率高。低周转="货压仓库卖不动"=占用资金+可能减值。周转突然下降→需求下滑预警(需求没变但公司一直在生产→存货堆积)。',      
      highMeaning: '存货快速周转，资金效率高',
      lowMeaning: '存货积压，需求可能下滑',
      story: '📦 开服装店：春季新款进货1000件，3月卖完=存货周转快；10月还有500件没卖=周转慢，这500件明年就是"过季"只能打折。存货周转突然变慢是危险信号——不是生产多了就是卖不动了。零售业尤其敏感。',
      signaldesc: '>8次/年=高效；4-8次=正常；<4次=存货压力',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },

    // ── A10 行为 🟡 (4降级因子已在R185注册，此处添加教育文案) ─────
    // DISPOSITION_EFFECT / ANCHORING / EQUITY_MULTIPLIER / AH_PREMIUM_CHANGE
    // 这4个因子在R185已作为L1注册，R187降级为L2，需通过补丁更新

    // ═══════════════════════════════════════════════════════════════════════
    // R188: 🟡 L2 市场专项因子 — HK(8) + US(12) + Crypto(14) = 34
    // ═══════════════════════════════════════════════════════════════════════

    // ── 🇭🇰 港股 🟡 ─────────────────────────────────────────────────────────
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'capital_flow',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },

    // ── 🇺🇸 美股 🟡 ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'sentiment',
    },
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'lowerBetter',
      source: 'sentiment',
    },
    {
      direction: 'contextDependent',
      source: 'sentiment',
    },
    {
      direction: 'contextDependent',
      source: 'factor_research',
    },
    {
      direction: 'higherBetter',
      source: 'capital_flow',
    },
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'contextDependent',
      source: 'sentiment',
    },
    {
      direction: 'lowerBetter',
      source: 'sentiment',
    },
    {
      direction: 'contextDependent',
      source: 'sentiment',
    },
    {
      direction: 'higherBetter',
      source: 'capital_flow',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },

    // ── 🪙 加密 🟡 ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },

    // ═══════════════════════════════════════════════════════════════════════
    // R191: ⚡ L3 专业因子 Batch1 — 30 factors (Phase 3 基石)
    // ═══════════════════════════════════════════════════════════════════════

    // ── A1 价值 ⚡ ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },

    // ── A2 质量 ⚡ ─────────────────────────────────────────────────────────
    {
      factorId: 'ACCRUALS',
      level: 'L3',
      nameCN: '应计利润质量',
      categoryCN: '质量',
      region: 'global',
      oneLine: '(净利润-经营现金流)/总资产——利润中的"水分"探测器',
      descriptionCN: '(净利润-经营性现金流)/总资产。高应计=利润远超实际流入的现金="纸上利润"(可能通过提前确认收入/延后费用/存货资本化等手段美化)。学术研究(Sloan 1996)证明：高应计公司未来1-2年显著跑输低应计公司。负值(现金流>利润)为最优——公司"藏"了利润。',
      highMeaning: '利润质量极高，现金流远超账面利润',
      lowMeaning: '利润含大量非现金项目，质量存疑',
      story: '📊 一家公司年报说赚了10亿，但经营现金流只进来2亿——那8亿差在哪？可能是"应收账款"(客户还没付)、"存货增值"(还没卖出去)。应计利润率高的公司，利润是"画"出来的；低的公司，利润是"真金白银"收进来的。Sloan教授因为这个发现发了顶刊JFE——金融学术最重要的质量因子之一。',
      signaldesc: '<0=最优(现金流>利润)；0-3%=健康；>6%=利润质量存疑',
      colors: { greenMax: 40, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'lowerBetter',
      source: 'stock_diagnosis',
    },

    // ── A3 低波 ⚡ ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },

    // ── A4 情绪 ⚡ ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },

    // ── A5 宏观 ⚡ ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'VOLATILITY_REGIME',
      level: 'L3',
      nameCN: '波动率区间',
      categoryCN: '宏观',
      region: 'global',
      oneLine: '用HMM隐马尔可夫模型识别高波/低波区间——当前该用趋势策略还是反转策略',
      descriptionCN: '隐马尔可夫模型(Hidden Markov Model)对VIX+市场波动率的两状态分类。状态1=低波动区间(适合趋势跟踪/因子策略/杠杆操作)，状态2=高波动区间(适合反转策略/波动率交易/减仓/分散化)。区间切换概率<5%(市场不会频繁切换)。>80%=确定性极强。注意模型滞后约3-5个交易日。',
      highMeaning: '高波动区间确认——反转策略+防御配置',
      lowMeaning: '低波动区间确认——趋势策略+因子配置',
      story: '🔄 市场有"两种天气"：风平浪静(低波动)时，趋势跟踪赚钱——买了持有就行。暴风雨(高波动)来了，趋势策略失灵——今天是涨明天就暴跌，你该做的是反转交易+买波动率。VOLATILITY_REGIME用隐马尔可夫模型自动识别"今天什么天气"——你不用猜，模型告诉你该穿雨衣还是戴墨镜。',
      signaldesc: '>70=高波区间(反转/对冲)；30-70=过渡；<30=低波区间(趋势)',
      colors: { greenMax: 40, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      factorId: 'CROSS_ASSET_CORR',
      level: 'L3',
      nameCN: '跨资产相关性',
      categoryCN: '宏观',
      region: 'global',
      oneLine: '股/债/商品/汇率的交叉相关性——"分散化还有效吗"',
      descriptionCN: '4资产间30日滚动Pearson相关系数均值：股票(S&P500)、债券(10年美债)、商品(CRB指数)、汇率(DXY美元指数)。相关性>0.6="所有东西一起涨一起跌"(分散化失效——需要降低总仓位)。相关性<0.2=资产独立运动(分散化有效——可加大配置)。2022年相关性>0.7、经典60/40组合失效。',
      highMeaning: '跨资产高度联动——传统分散化失效',
      lowMeaning: '资产独立运行——分散化有效发挥作用',
      story: '🌐 "不要把鸡蛋放在一个篮子里"的前提是——篮子不会一起翻。2022年股债双杀(股票跌+债券也跌)，跨资产相关性飙到0.7——分散化完全失效。CROSS_ASSET_CORR实时监测：如果股债商汇一起动，分散化就是个谎言——你该降低总仓位而不是跨资产配置。',
      signaldesc: '>0.6=分散化失效(减仓)；0.3-0.6=部分有效；<0.3=高度分散',
      colors: { greenMax: 35, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_research',
    },

    // ── A7 期权 ⚡ ─────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      direction: 'contextDependent',
      source: 'factor_research',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'contextDependent',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },

    // ── A8 事件 ⚡ ─────────────────────────────────────────────────────────
    {
      factorId: 'INDEX_REBALANCE',
      level: 'L3',
      nameCN: '指数再平衡效应',
      categoryCN: '事件',
      region: 'global',
      oneLine: '纳入/调出指数前的"被动资金踩踏"——提前布局指数调整',
      descriptionCN: '综合纳入概率×预期被动资金流×距调整日的倒数的评分。>70=极可能纳入指数+大量被动资金将被迫买入(提前布局)。<-30=可能被剔除(被动资金将被迫卖出→撤离)。S&P500纳入平均带来+5-8%短期超额收益。MSCI/FTSE等国际指数纳入的新兴市场股票效应更强(外资被动配置)。',
      highMeaning: '即将纳入指数——大量被动资金将进场',
      lowMeaning: '不符合指数纳入条件',
      story: '📋 被纳入S&P500就像"上市"了第二次——所有跟踪该指数的ETF/基金必须买入你的股票。这个"被动买入潮"创造确定性的短期需求冲击(平均+5-8%超额)。INDEX_REBALANCE提前识别这种"确定性的被动需求"——你不是在赌，你是在算："多少亿资金必须在下周五买入这只股票"。',
      signaldesc: '>70=极高纳入概率(布局)；30-70=可能纳入；<-30=可能剔除',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },

    // ── A9 基本面 ⚡ ───────────────────────────────────────────────────────
    {
      direction: 'contextDependent',
      source: 'factor_research',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },

    // ── A10 财务 ⚡ ────────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },

    // ── A12 另类数据 ⚡ ────────────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },

    // ═══════════════════════════════════════════════════════════════════════
    // R192: ⚡ L3 市场专属因子 Batch2 — 30 factors (HK11+US14+Crypto5)
    // ═══════════════════════════════════════════════════════════════════════

    // ── 🇭🇰 港股专属 ⚡ (11) ────────────────────────────────────────────
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'capital_flow',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },

    // ── 🇺🇸 美股专属 ⚡ (14) ────────────────────────────────────────────
    {
      direction: 'higherBetter',
      source: 'sentiment',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'contextDependent',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },
    {
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      direction: 'contextDependent',
      source: 'factor_cloud',
    },

    // ── 🪙 加密专属 ⚡ (5) ────────────────────────────────────────────
    {
      direction: 'contextDependent',
      source: 'factor_research',
    },
    {
      direction: 'contextDependent',
      source: 'factor_research',
    },
    {
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },

    // ═══════════════════════════════════════════════════════════════════════
    // R193: ⚡ 终局 — 31剩余因子 (Crypto16 + 跨市场5 + 综合10)
    // ═══════════════════════════════════════════════════════════════════════

    // ── 🪙 加密剩余 ⚡ (16) ──────────────────────────────────────────

    // ── 🌏 跨市场专属 ⚡ (5) ──────────────────────────────────────────

    // ── 🔬 综合/学术因子 ⚡ (10) ──────────────────────────────────────

    // ═══════════════════════════════════════════════════════════════════════
    // R194: 🇯🇵 日本+🇹🇼 台湾市场专属因子 (JP12 + TW7 = 19)
    // ═══════════════════════════════════════════════════════════════════════

    // ── 🇯🇵 日本市场 ⚡ (12) ──────────────────────────────────────────

    // ── 🇹🇼 台湾市场 ⚡ (7) ──────────────────────────────────────────

    // ── 🇦🇺 澳洲 ⚡ (5) ──────────────────────────────────────────────

    // ── 🇪🇺 欧洲 ⚡ (4) ──────────────────────────────────────────────

    // ═══════════════════════════════════════════════════════════════════════
    // R198: 🛢️ 大宗商品因子第一批 — L1期限+L2库存+L6季节 (14因子)
    // ═══════════════════════════════════════════════════════════════════════

    // ── L1 期限结构 ⚡ (7) ────────────────────────────────────────────
    { factorId: 'CMD_ROLL_YIELD', level: 'L1', nameCN: '展期收益', categoryCN: '大宗商品', region: 'global', oneLine: '商品期货近月vs次近月的年化展期收益率——"持有这个商品是赚钱还是亏钱"', descriptionCN: '(近月合约价格-次近月合约价格)/次近月价格的年化率。>5%=Backwardation(现货溢价→做多=持有商品有正收益+展期收益→"多头赚钱")。<−5%=Contango(期货溢价→展期亏损→"多头在流血"≈年化亏5%+)。商品长期正收益的第一性原理——Erb & Harvey(2006)经典发现。', highMeaning: 'Backwardation——做多持有有正收益', lowMeaning: 'Contango——做多持有在亏展期费', story: '🔄 商品期货和股票不一样——持有商品期货需要"展期"(到期换月)。如果远月比近月贵(Contango)→每次展期你都在"亏钱"(买贵了)。反之后向(Backwardation)→每次展期你在"赚钱"(低价买入)。展期收益是商品长期收益的"发动机"——没有它，商品指数长期收益为负。', signaldesc: '>5%=强Backwardation(持有多头)；0-5%=弱；<−5%=强Contango(做空或回避)', colors: { greenMax: 45, yellowMax: 65, redMin: 66 }, direction: 'higherBetter', source: 'factor_cloud' },
    { factorId: 'CMD_TERM_STRUCTURE', level: 'L1', nameCN: '期限结构斜率', categoryCN: '大宗商品', region: 'global', oneLine: '期货曲线从近月到远月的整体斜率——"供给紧缺还是过剩"', descriptionCN: '(近月-12月远月)/近月的标准化斜率。>0.3=极度Backwardation(供给紧缺——"现货就是比期货贵"→恐慌抢现货)。<−0.3=极度Contango(供给过剩——"仓库都堆满了"→做空信号)。斜率反映的是"有多少人愿意现在高价买现货"——斜率陡=现货抢购。Gorton, Hayashi & Rouwenhorst(2013)核心指标。', highMeaning: '陡峭Backwardation——供给极度紧缺', lowMeaning: '陡峭Contango——供给严重过剩', story: '📐 期货曲线是商品的"心电图"——曲线陡峭向下(Backwardation)=市场在喊"现货不够！"。原油Contango深度>−0.3=油罐都满了→价格得跌到有人愿意买为止。期限结构是商品供需最纯粹的量化表达。', signaldesc: '>0.3=极度紧缺(做多)；0-0.3=正常；<−0.3=严重过剩(做空)', colors: { greenMax: 45, yellowMax: 70, redMin: 71 }, direction: 'higherBetter', source: 'factor_cloud' },
    { factorId: 'CMD_BASIS', level: 'L1', nameCN: '基差', categoryCN: '大宗商品', region: 'global', oneLine: '现货价格-近月期货价格的偏离——"现货市场比期货市场更聪明吗"', descriptionCN: '(现货价格-近月期货价格)/近月期货价格的Z-score。>2=现货远高于期货(基差走强→现货买家在抢购→"现货比期货聪明"→期货可能跟涨)。<−2=现货远低于期货(基差走弱→现货市场疲软)。基差=现货和期货的"投票结果"——谁领先谁？实证: 现货基差领先期货价格1-5天。', highMeaning: '现货大幅溢价——现货市场极度紧张', lowMeaning: '现货大幅折价——现货市场疲软', story: '🔍 现货vs期货——"谁更聪明"？如果现货突然比期货贵2%+——现货买家(炼油厂/矿商/贸易商)在用真金白银投票："我现在就要货！"这种"现货紧张"通常1-5天后会传导到期货价格。基差是商品短线交易的"秘密武器"。', signaldesc: '>2=现货溢价极强(期货将跟涨)；0-2=温和；<−2=现货疲软', colors: { greenMax: 50, yellowMax: 70, redMin: 71 }, direction: 'higherBetter', source: 'factor_cloud' },
    { factorId: 'CMD_MOMENTUM_12M', level: 'L1', nameCN: '12月动量', categoryCN: '大宗商品', region: 'global', oneLine: '过去12个月(扣除最近1个月)的累积收益——"这个商品在走趋势吗"', descriptionCN: '过去12个月(扣除最近1月以滤除短期反转)累积收益的横截面Z-score。>1.5=强趋势(动量策略基石——Moskowitz, Ooi & Pedersen 2012证明商品12月动量Sharpe>1.0)。<−1.5=强下跌趋势。注：商品动量收益集中在上行周期(供给冲击驱动的暴涨)→负偏度风险。能源和金属板块动量效应最强。', highMeaning: '强上涨趋势——商品趋势跟踪信号', lowMeaning: '强下跌趋势——做空或回避', story: '🚀 商品是全球最适合"趋势跟踪"的资产——因为供给冲击(飓风/战争/矿难)造成的价格趋势通常持续12-18个月。Moskowitz et al.(2012)证明：只做"过去12个月涨最多的商品、做空跌最多的"——年化收益+10-15%。商品动量的"秘密"：趋势持续时间比股票长、比汇率更可靠。', signaldesc: '>1.5=强上涨趋势(做多)；0-1.5=温和；<−1.5=强下跌(做空)', colors: { greenMax: 50, yellowMax: 70, redMin: 71 }, direction: 'higherBetter', source: 'factor_research' },
    { factorId: 'CMD_MOMENTUM_1M', level: 'L1', nameCN: '1月反转', categoryCN: '大宗商品', region: 'global', oneLine: '过去1个月的极端收益的反转概率——"涨太快就该回调"', descriptionCN: '-1×过去1月累计收益的横截面Z-score。>2=过去1月暴跌(短期超卖→反转反弹概率高)。<−2=过去1月暴涨(短期超买→回调风险高)。Miffre & Rallis(2007)发现商品存在短期反转效应(1-4周)→与12月动量的"中期趋势"互补——"短反长趋"。', highMeaning: '短期超跌——反转反弹', lowMeaning: '短期暴涨——回调风险', story: '🔄 商品短期(1个月)和中期(12个月)是"反着走"的——上个月涨最多的商品这个月容易回调，上个月跌最多的容易反弹。为什么？商品供给短期"粘性"+需求冲击的过度反应→均值回归。短反+长趋=商品CTA的"两把刀"。', signaldesc: '>2=强超跌反弹信号；0-2=轻度；<−2=短期超买(回调)', colors: { greenMax: 55, yellowMax: 75, redMin: 76 }, direction: 'higherBetter', source: 'factor_research' },
    { factorId: 'CMD_VOLATILITY', level: 'L1', nameCN: '波幅率', categoryCN: '大宗商品', region: 'global', oneLine: '商品60日年化波动率的Z-score——"这个商品最近安静还是暴躁"', descriptionCN: '60日年化波动率在5年历史中的分位数。>90%分位=极度高波动(供给+需求双重不确定性→"商品在暴走"→风险溢价极高但回撤风险也大)。<30%分位=波动率压缩(商品"横盘整理"→即将突破→期权跨式策略机会)。商品波动率具有"聚集性"——高波后继续高波(与股票不同)。', highMeaning: '极度高波动——商品暴走', lowMeaning: '波动率压缩——即将突破', story: '🌪️ 商品波动率比股票更"暴脾气"——天然气可以一天涨20%，原油可以一天跌10%。高波=供给冲击(飓风/战争)+需求恐慌(衰退)。但商品波动率的"聚集效应"比股票强→高波会持续高波→"波动率交易"是商品CTA的核心利润来源。', signaldesc: '>90%分位=暴走(CTA做多波动率)；30-90%=正常；<30%=压缩(突破在即)', colors: { greenMax: 50, yellowMax: 70, redMin: 71 }, direction: 'contextDependent', source: 'factor_cloud' },
    { factorId: 'CMD_SKEWNESS', level: 'L1', nameCN: '偏度', categoryCN: '大宗商品', region: 'global', oneLine: '商品收益分布的不对称性——"这个商品更喜欢暴涨还是暴跌"', descriptionCN: '60日日收益的偏度(skewness)系数。>0.5=正偏(暴涨概率>暴跌——"供应冲击"特征→农产品/天然气)。<−0.5=负偏(暴跌概率>暴涨——"需求冲击"特征→工业金属/原油在经济衰退期)。Fernandez-Perez et al.(2018)发现商品偏度可预测未来收益——正偏商品未来收益低(保险溢价已定价)。', highMeaning: '正偏(暴涨多)——供应冲击驱动的"彩票"', lowMeaning: '负偏(暴跌多)——需求冲击风险', story: '🎲 商品和股票的最大区别——股票暴跌多(负偏)，商品却常常暴涨(正偏)！因为供给冲击(飓风摧毁天然气平台→价格一天涨30%)。但学术发现：正偏商品=市场已经把"暴涨保险"定价了→长期预期收益更低。偏度告诉你："现在是在赌暴涨还是防暴跌"。', signaldesc: '>0.5=正偏(暴涨多~供给紧张)；-0.5到0.5=对称；<−0.5=负偏(暴跌风险)', colors: { greenMax: 50, yellowMax: 70, redMin: 71 }, direction: 'lowerBetter', source: 'factor_research' },

    // ── L2 库存供给 ⚡ (5) ────────────────────────────────────────────
    { factorId: 'CMD_EIA_CRUDE', level: 'L2', nameCN: 'EIA原油库存', categoryCN: '大宗商品', region: 'global', oneLine: 'EIA周度原油库存变化vs市场预期——"原油圈的非农数据"', descriptionCN: '(EIA库存实际变化-分析师预期中值)/预期标准差。<-2=库存骤降远超预期(强做多信号→库存下降=需求强劲/供给不足→原油涨。历史胜率>70%)。>2=库存暴增(供给过剩→做空原油)。EIA报告周三22:30发布——原油市场"最重要的周度数据"。', highMeaning: '库存骤降远超预期——强做多', lowMeaning: '库存远超预期增加——做空', story: '🛢️ 每周三晚上EIA报告是全原油市场的"心跳时刻"——库存降了多少？比预期多还是少？这5分钟的波动经常比一周都大。EIA库存意外<-2标准差=主力在"抢油"→油价必涨。这是人类已经养成的习惯——我们只是量化了它。', signaldesc: '<-2=库存骤降(强做多)；-2到2=符合预期；>2=暴增(做空)', colors: { greenMax: 45, yellowMax: 65, redMin: 66 }, direction: 'lowerBetter', source: 'factor_cloud' },
    { factorId: 'CMD_NATGAS_STORAGE', level: 'L2', nameCN: '天然气库存', categoryCN: '大宗商品', region: 'global', oneLine: 'EIA天然气周度库存vs5年均值——"这个冬天够不够烧"', descriptionCN: '(当前库存-5年同期均值)/5年标准差。<-2=库存极度不足(供给紧缺→天然气暴涨风险——"这个冬天冷吗"成为市场核心问题)。>2=库存极度充裕(供给过剩→天然气承压)。天然气是最"天气驱动"的商品——库存偏离是供暖季(11-3月)最强信号。', highMeaning: '库存极度不足——寒冬风险', lowMeaning: '库存极度充裕——过剩', story: '🔥 天然气是"天气商品"——库存不够+天气预报说冷=价格可以翻倍。2022年欧洲天然气危机=库存低+俄罗斯断供=价格涨10倍。NatGas库存偏离-2=你在赌"这个冬天会很冷"——历史上天然气库存不足时12月-2月平均涨+25%。', signaldesc: '<-2=库存极度不足(做多)；-2到2=正常；>2=充裕(做空)', colors: { greenMax: 40, yellowMax: 65, redMin: 66 }, direction: 'lowerBetter', source: 'factor_cloud' },
    { factorId: 'CMD_LME_INVENTORY', level: 'L2', nameCN: 'LME铜库存', categoryCN: '大宗商品', region: 'global', oneLine: 'LME注册仓单+注销仓单的库存信号——"铜博士的脉搏"', descriptionCN: '(LME铜总库存-5年均值)/5年标准差+(注销仓单/总库存的Z-score)的联合评分。注销仓单>40%+库存低于均值=铜即将"出库"(需求强→价格涨→强做多)。铜是"经济学博士"——库存变化领先全球PMI 1-2个月。LME每日公布注册/注销仓单——"铜圈日报"。', highMeaning: '库存低+注销高——铜需求爆发', lowMeaning: '库存高+注销低——铜需求疲弱', story: '🔬 铜是全球经济的"心电图"——LME仓库里的铜被"注销"(预约提货)=工业在扩张。注销仓单>40%+库存低于5年均值="铜博士"说："经济在加速"。LME库存是铜价最强的"领先指标"——领先价格3-7天。', signaldesc: '注销>40%+低库存=强做多；正常=中性；高库存+低注销=疲弱', colors: { greenMax: 45, yellowMax: 70, redMin: 71 }, direction: 'higherBetter', source: 'factor_cloud' },
    { factorId: 'CMD_GOLD_ETF', level: 'L2', nameCN: '黄金ETF持仓', categoryCN: '大宗商品', region: 'global', oneLine: 'GLD+IAU黄金ETF的持仓量变化——"散户和机构在买金吗"', descriptionCN: 'GLD+IAU周度持仓变化的Z-score。>2=大量资金涌入黄金ETF(恐慌/避险情绪→"恐荒指数"→黄金涨)。<-2=资金大量撤离(风险偏好回归→黄金冷落→黄金承压)。黄金ETF持仓与金价高度正相关(r>0.8)——"ETF在买=金价在涨"。配合CFTC COT使用：ETF看散户+机构，COT看投机者。', highMeaning: 'ETF持仓大幅增加——黄金需求强劲', lowMeaning: 'ETF持仓大幅减少——黄金冷落', story: '🥇 GLD是全球最大黄金ETF——持仓量=全球投资者"用脚投票"的黄金需求。每天新闻报"黄金ETF增持X吨"——我们把这个"新闻"变成量化因子。ETF持仓暴增2标准差+美联储降息预期=黄金牛市最强组合。', signaldesc: '>2=ETF大幅流入(看涨金价)；0-2=温和；<-2=大幅流出', colors: { greenMax: 55, yellowMax: 75, redMin: 76 }, direction: 'higherBetter', source: 'capital_flow' },
    { factorId: 'CMD_BALANCE_SHEET', level: 'L2', nameCN: '供需平衡表', categoryCN: '大宗商品', region: 'global', oneLine: 'USDA/EIA/IEA月度供需平衡(产量-消费)的"缺口"——"这个世界缺不缺这个商品"', descriptionCN: '（全球产量-全球消费）/全球消费的Z-score。<-2=极度供不应求(消耗库存→价格必涨→最强基本面做多信号)。>2=极度供过于求(库存堆积→价格承压)。覆盖USDA(农产品)/EIA(能源)/IEA(能源)/世界金属统计局(金属)。月度更新——是商品基本面"最重"的指标。', highMeaning: '供应缺口大——供不应求', lowMeaning: '供应过剩——库存堆积', story: '⚖️ 商品基本面最"笨"也最"真"的指标——全世界生产了多少、消费了多少，差值就是"缺口"。缺口>2%=这个世界每天消耗的商品比生产的多了2%→只能从库存里拿→库存总会用完→价格必须涨到有人愿意少用为止。这是商品投资最接近"内在价值"的因子。', signaldesc: '<-2=严重短缺(强做多)；-2到2=均衡；>2=严重过剩', colors: { greenMax: 40, yellowMax: 65, redMin: 66 }, direction: 'lowerBetter', source: 'factor_research' },

    // ── L6 季節期 ⚡ (2) ────────────────────────────────────────────
    { factorId: 'CMD_SEASONALITY', level: 'L3', nameCN: '商品季节性', categoryCN: '大宗商品', region: 'global', oneLine: '当前月份商品的历史涨跌概率——"天然气冬天涨、汽油夏天涨"', descriptionCN: '商品在当前月份的10/20年平均涨跌幅Z-score(覆盖24个主要商品)。>2=历史上这个月该商品总是涨(天然气1月+7%/汽油5月+5%/大豆6月+4%/黄金9月+3%/棉花3月、可可12月)。<−1=历史上总是跌。商品季节性由供需周期驱动——取暖季/出行季/种植季/收获季。', highMeaning: '本月历史季节性极强——做多', lowMeaning: '本月历史上表现差——回避', story: '📅 商品有"体质"——天然气冬天必涨(取暖)、汽油夏天必涨(自驾游)、大豆6月必涨(种植面积不确定)。这些季节性来自"地球绕太阳"——人类改变不了。>2标准差的季节性=你在利用"地球公转"赚钱。', signaldesc: '>2=强季节性(做多)；0-2=温和；<0=历史弱势', colors: { greenMax: 55, yellowMax: 75, redMin: 76 }, direction: 'higherBetter', source: 'factor_cloud' },
    { factorId: 'CMD_GOLD_SUMMER', level: 'L3', nameCN: '黄金夏季效应', categoryCN: '大宗商品', region: 'global', oneLine: '黄金6-8月"夏季低迷"→9月"秋季觉醒"——"黄金最准的日历"', descriptionCN: '基于月份+印度排灯节+中国春节的黄金需求日历评分。>60=黄金需求旺季(印度婚庆+春节+圣诞→做多)。<30=夏季低迷(5-8月)。黄金70%需求来自珠宝和零售。', highMeaning: '黄金需求旺季——"秋季觉醒"', lowMeaning: '夏季低迷——横盘等风', story: '🌞 黄金有最"灵验"的日历——5-8月横盘，9月涨(排灯节+国庆+圣诞"三连击")。"5月卖金、9月买金"是黄金交易员公开的秘密。', signaldesc: '>60=旺季(做多)；30-60=过渡；<30=夏淡(等待)', colors: { greenMax: 55, yellowMax: 75, redMin: 76 }, direction: 'higherBetter', source: 'factor_cloud' },

    // ═══════════════════════════════════════════════════════════════════════
    // R199: 🛢️ 大宗商品收关 — L3持仓COT+L4宏观驱动+L5价差 (12因子)
    // ═══════════════════════════════════════════════════════════════════════

    // ── L3 持仓COT ⚡ (5) ────────────────────────────────────────────
    { factorId: 'CMD_COT_COMMERCIAL', level: 'L3', nameCN: '商业净持仓', categoryCN: '大宗商品', region: 'global', oneLine: 'CFTC COT报告中商业对冲者的净多头寸——"生产者/消费者在用什么价格锁货"', descriptionCN: '(商业多头-商业空头)/总持仓的Z-score。>2=商业净多头极端(生产者和消费者都在做多对冲→他们预见价格上涨→跟"产业资本"站在一起)。<-2=商业净空头极端(产业在大量卖出远期→他们预见价格下跌)。CFTC每周公布——商业持仓是"最聪明"的——因为他们最了解供需。', highMeaning: '商业净多极端——产业在锁上涨风险', lowMeaning: '商业净空极端——产业在锁下跌风险', story: '🏭 CFTC COT报告的"灵魂"——商业持仓(BHP/嘉吉/Cargill/Exxon等生产者和消费者)。他们不做投机——他们在"对冲"。如果商业净多创新高→产业资本在用真金白银赌价格上涨。商业持仓="跟聪明钱站在一起"。', signaldesc: '>2=商业强烈看涨；0-2=偏多；<-2=商业看空', colors: { greenMax: 50, yellowMax: 70, redMin: 71 }, direction: 'higherBetter', source: 'sentiment' },
    { factorId: 'CMD_COT_SPECULATOR', level: 'L3', nameCN: '投机净持仓', categoryCN: '大宗商品', region: 'global', oneLine: 'CFTC COT中Managed Money的净多——"对冲基金在赌什么方向"', descriptionCN: '(Managed Money多头-MM空头)/总持仓的Z-score。>2=投机净多极端(对冲基金/CTA集体做多→"拥挤交易"→往往是反向信号——"所有人都上车了"→该下车了)。<-2=投机净空极端(逆向看涨——"没人敢做多时才是底")。投机者是"动量追逐者"——极端时反而是反向指标。', highMeaning: '投机净空极端——逆向看涨', lowMeaning: '投机净多极端——"拥挤"→反向看跌', story: '🎰 对冲基金和CTA是COT中的"投机者"——他们追涨杀跌。当Managed Money净多创历史新高→"所有人都在做多"→"已经没人可买了"→顶。投机净多极端是商品最经典的反向指标——"和COT反着做"是很多CTA策略的核心。', signaldesc: '<-2=投机恐慌(逆向看涨)；-2到2=正常；>2=投机狂热(谨慎)', colors: { greenMax: 40, yellowMax: 65, redMin: 66 }, direction: 'lowerBetter', source: 'sentiment' },
    { factorId: 'CMD_COT_EXTREME', level: 'L3', nameCN: 'COT拥挤度', categoryCN: '大宗商品', region: 'global', oneLine: '商业vs投机持仓偏离历史均值的极端程度——"两拨人在打架吗"', descriptionCN: '(投机净多Z-商业净多Z)的差值——"多空对决"指数。>2=投机极度看多而商业极度看空(经典的"分歧"→商业vs投机的"大战"→通常商业赢→看空)。<-2=投机看空而商业看多(商业在"抄底"→通常商业赢→看涨)。Basu & Miffre(2013)发现持仓分歧>2σ时有显著预测力。', highMeaning: '商业看多+投机看空——产业"抄底"信号', lowMeaning: '投机看多+商业看空——市场"过热"', story: '⚔️ 商品市场每天都在上演"战争"——商业(生产者/消费者)vs投机者(对冲基金/CTA)。当投机极度看多而商业极度看空→"外行在追、内行在跑"→历史上内行赢多输少。COT拥挤度就是这场"战争"的实时记分牌。', signaldesc: '<-2=商业抄底(跟商业做多)；-2到2=均衡；>2=投机过热(小心)', colors: { greenMax: 40, yellowMax: 65, redMin: 66 }, direction: 'lowerBetter', source: 'sentiment' },
    { factorId: 'CMD_COT_CHANGE', level: 'L3', nameCN: 'COT持仓变动', categoryCN: '大宗商品', region: 'global', oneLine: 'CFTC投机净多周度变动——"对冲基金这周在买还是卖"', descriptionCN: '投机净多头寸的周环比变化率Z-score。>2=投机者本周大幅加仓(动量信号→"聪明钱在追"→短线跟)。<-2=投机大幅减仓(恐慌出逃→"聪明钱在跑")。持仓变动比持仓水平更"实时"——因为反映的是"这一周"的边际变化。', highMeaning: '投机大幅加仓——短期动量', lowMeaning: '投机大幅减仓——短期恐慌', story: '📊 COT每周公布——"上周五之前"的数据(有3天延迟)。但周环比变化告诉你"这一周对冲基金在干什么"——大幅加仓=他们在追涨(短线跟着做)，大幅减仓=他们在跑(你也该小心)。持仓变动是COT的"高频版"。', signaldesc: '>2=投机加仓(短线跟)；0-2=温和；<-2=减仓(警惕)', colors: { greenMax: 55, yellowMax: 75, redMin: 76 }, direction: 'higherBetter', source: 'sentiment' },
    { factorId: 'CMD_OPEN_INTEREST', level: 'L3', nameCN: '总持仓变化', categoryCN: '大宗商品', region: 'global', oneLine: '期货总持仓(Open Interest)的周度变化——"钱在进场还是离场"', descriptionCN: 'OI周环比变化率的Z-score。>2=总持仓大幅增加(新资金进场——"赌场在扩容"→趋势可能强化)。<-2=总持仓大幅减少(资金离场——"赌场在缩容"→流动性枯竭→趋势可能反转)。OI与价格同向=趋势确认，OI与价格反向=趋势衰竭。', highMeaning: 'OI增加+价格上涨=趋势健康', lowMeaning: 'OI减少——资金离场', story: '🎲 Open Interest是所有期货合约的"口袋"——总共有多少张合约在外面。OI暴增+价格上涨=新钱在涌入做多→趋势"根基深厚"。OI暴跌=不管价格涨跌→钱在走→"人走茶凉"。OI是趋势的"作弊器"——OI验证趋势=真趋势，OI不支持=假趋势。', signaldesc: '>2=资金进场(趋势强化)；0-2=温和；<-2=资金离场', colors: { greenMax: 50, yellowMax: 70, redMin: 71 }, direction: 'higherBetter', source: 'capital_flow' },

    // ── L4 宏观驱动 ⚡ (4) ────────────────────────────────────────────
    { factorId: 'CMD_DXY_LINKAGE', level: 'L3', nameCN: '美元关联', categoryCN: '大宗商品', region: 'global', oneLine: '各商品对美元指数(DXY)的敏感度——"美元涨1%这个商品跌多少"', descriptionCN: '商品收益对DXY日变化的60日Beta。Beta<-1=强美元负相关(典型商品→黄金=美元涨它就跌→"美元是商品的镜子")。Beta>0=脱钩(不寻常→可能该商品被其他因素驱动→独立行情)。美元是商品定价的"分母"——全球商品以美元计价→美元走强=商品变贵→需求降→商品跌。', highMeaning: '强美元负相关——"美元跌=商品涨"', lowMeaning: '脱钩——商品在走独立行情', story: '💵 商品以美元计价——美元涨=商品对全球买家变贵→需求降→价格跌。但每个商品对美元的敏感度不一样——黄金最敏感(Beta≈-1.2)，原油次之(-0.8)，农产品最低(-0.3→人总要吃饭)。DXY关联告诉你："美元今天涨了，这个商品应该跌多少"。', signaldesc: 'Beta<-1=强负相关(美元驱动)；-1到0=弱相关；>0=脱钩', colors: { greenMax: 40, yellowMax: 65, redMin: 66 }, direction: 'lowerBetter', source: 'factor_research' },
    { factorId: 'CMD_REAL_RATE', level: 'L3', nameCN: '实际利率', categoryCN: '大宗商品', region: 'global', oneLine: '10年期TIPS(通胀保护国债)收益率——"黄金的真正对手"', descriptionCN: 'TIPS 10Y收益率的Z-score(取反→实际利率越低→商品越涨)。<-2=实际利率极低(黄金最强支撑→"钱不值钱→硬资产值钱")。>2=实际利率极高(黄金最大利空→"持有黄金的机会成本太高")。实际利率是黄金的"第一性原理"——95%的金价波动可由实际利率解释。', highMeaning: '实际利率极低——硬资产最强支撑', lowMeaning: '实际利率极高——持有商品成本高', story: '📉 黄金不付利息——如果持有国债(TIPS)给你2%的实际收益，黄金0%→你为什么要持有黄金？但当TIPS收益率降到-1%→"你持有国债还要倒贴1%"→黄金变得"免费"→买。实际利率是黄金(和所有零收益商品)的"终极驱动"。', signaldesc: '<-2=实际利率极低(强利好)；-2到2=中性；>2=利率极高(利空)', colors: { greenMax: 45, yellowMax: 65, redMin: 66 }, direction: 'lowerBetter', source: 'factor_research' },
    { factorId: 'CMD_INFLATION_BE', level: 'L3', nameCN: '通胀预期', categoryCN: '大宗商品', region: 'global', oneLine: '5年/10年盈亏平衡通胀率(BEIR)——"市场赌未来通胀有多高"', descriptionCN: '5Y5Y通胀互换利率的Z-score。>2=市场在定价高通胀(通胀恐慌→"钱要变毛了"→买商品对冲通胀→商品涨——黄金/原油/铜最强)。<-1=市场定价通缩(通缩风险→商品被抛售)。BEIR是"市场用真金白银赌的未来通胀"——比经济学家预测准得多。', highMeaning: '通胀预期飙升——商品对冲需求', lowMeaning: '通缩预期——商品被抛售', story: '🎈 通胀预期(BEIR)是市场"用钱投票"的未来通胀——经济学家可以胡说，但交易员用真金白银下注。BEIR>2.5%=市场在喊"通胀来了！"→商品是对冲通胀最好的工具→能源和黄金最先反应。"通胀交易"的最佳触发器。', signaldesc: '>2=高通胀预期(商品利好)；0-2=温和；<0=通缩', colors: { greenMax: 50, yellowMax: 70, redMin: 71 }, direction: 'higherBetter', source: 'factor_research' },
    { factorId: 'CMD_GEOPOL_RISK', level: 'L3', nameCN: '地缘风险', categoryCN: '大宗商品', region: 'global', oneLine: 'GPR(地缘政治风险指数)——"世界哪个角落又出事了"', descriptionCN: 'Caldara & Iacoviello GPR指数的Z-score。>2=全球地缘风险飙升(战争/制裁/恐怖袭击→原油/黄金暴涨→"危机Alpha")。<-1=地缘平静(商品由供需驱动)。GPR对原油影响最大(战争中断供给)，黄金次之(避险)，工业金属再次(制裁)，农产品最弱(人总要吃)。', highMeaning: '地缘风险飙升——危机Alpha', lowMeaning: '地缘平静——供需驱动', story: '🌍 炮声一响，黄金万两；油管一断，原油暴涨。地缘风险指数(GPR)量化了"世界的不安程度"——俄乌战争2022年2月GPR爆表(>3σ)→原油3天涨20%→黄金涨10%。GPR是商品的"危机开关"——飙升时做多黄金=买"战争保险"。', signaldesc: '>2=地缘危机(黄金/原油利多)；0-2=偏高；<0=平静', colors: { greenMax: 45, yellowMax: 70, redMin: 71 }, direction: 'higherBetter', source: 'factor_research' },

    // ── L5 价差 ⚡ (3) ────────────────────────────────────────────────
    { factorId: 'CMD_GOLD_SILVER_RATIO', level: 'L3', nameCN: '金银比', categoryCN: '大宗商品', region: 'global', oneLine: '金价/银价的Z-score——"白银是黄金的'杠杆版'还是'折价版'"', descriptionCN: '(金价/银价)偏离5年均值的Z-score。>2=金银比极高(>90→极度恐慌——黄金避险+白银工业属性被抛→往往是底部信号→买白银)。<-2=金银比极低(<60→极度贪婪——白银追赶黄金→风险偏好极高→黄金可能被低估)。金银比是"恐惧与贪婪"在贵金属上的最纯粹表达。', highMeaning: '金银比极高——黄金避险→逆向买白银', lowMeaning: '金银比极低——风险偏好极高→白银狂欢', story: '⚖️ 黄金是"恐惧"、白银是"憧憬"。金银比>90=世界很恐惧(黄金被疯抢、白银被抛弃)→但这种极端往往预示"恐惧到顶"——接下来白银会追赶黄金。金银比<60=世界太乐观(白银被当成"高科技金属"疯炒)→黄金可能被冷落→"黄金该补涨了"。', signaldesc: '>2=极度恐慌(逆向买入白银)；-2到2=均衡；<-2=极度贪婪', colors: { greenMax: 40, yellowMax: 65, redMin: 66 }, direction: 'contextDependent', source: 'factor_research' },
    { factorId: 'CMD_GOLD_OIL_RATIO', level: 'L3', nameCN: '金油比', categoryCN: '大宗商品', region: 'global', oneLine: '(金价/盎司)/(WTI/桶)的Z-score——"世界是在避险还是在消费"', descriptionCN: '(金价/油价)偏离5年均值的Z-score。>2=金油比极高(>30→极度避险——黄金涨+原油跌→"世界在储蓄而非消费"→经济衰退信号)。<-1=金油比极低(<15→风险偏好极高——原油追黄金→"世界在消费"→经济过热信号)。金油比是"黄金(恐惧)vs原油(增长)"的宏观多空对决。', highMeaning: '金油比极高——极度避险→衰退定价', lowMeaning: '金油比极低——风险偏好+经济增长', story: '🆚 金油比是"终极宏观对决"——黄金代表"恐惧"(避险资产)，原油代表"增长"(工业的血液)。金油比>30=黄金飞涨+原油躺平→市场在说"经济要衰退了"→买保险(黄金)、卖增长(原油)。金油比<15=原油狂飙+黄金冷落→市场在说"经济很热"。', signaldesc: '>2=极度避险(衰退信号)；0-2=中性；<−1=极度增长', colors: { greenMax: 40, yellowMax: 65, redMin: 66 }, direction: 'contextDependent', source: 'factor_research' },
    { factorId: 'CMD_CRACK_SPREAD', level: 'L3', nameCN: '裂解价差', categoryCN: '大宗商品', region: 'global', oneLine: '(汽油+馏分油-3×WTI)/3的Z-score——"炼油厂赚多少"', descriptionCN: '321裂解价差(1桶原油→2桶汽油+1桶馏分油的利润空间)的Z-score。>2=炼油利润极高(炼厂在印钞→利好炼油股/原油需求强)。<-1=炼油利润极低或亏损(炼厂减产→原油需求弱→利空原油)。裂解价差是"原油需求的体温计"——炼厂亏钱就会停产→原油需求消失。', highMeaning: '炼油利润丰厚——原油需求强劲', lowMeaning: '炼油亏损——原油需求将萎缩', story: '🏭 裂解价差(Crack Spread)是炼油厂的"利润表"——原油是"原材料"，汽油+馏分油是"产品"。价差>30美元/桶=炼油厂在"印钞"→他们会开足马力买原油→原油需求暴增→原油涨。价差<10美元=炼油厂在"亏钱"→他们会减产→原油需求消失→原油跌。', signaldesc: '>2=炼油丰厚利润(利好原油)；0-2=正常；<0=炼油亏损(利空)', colors: { greenMax: 55, yellowMax: 75, redMin: 76 }, direction: 'higherBetter', source: 'factor_cloud' }

  ].map(entry => [entry.factorId, entry] as const),
);

// ── R187: 4降级因子补丁 ────────────────────────────────────────────────────
// DISPOSITION_EFFECT, ANCHORING, EQUITY_MULTIPLIER, AH_PREMIUM_CHANGE
// 从R185 L1降级为R187 L2 (行为金融/高阶财务概念，新手难理解)

const R187_DEMOTE_PATCHES: Array<{ factorId: string; level: FactorLevel; eduStory: string; eduSignal: string }> = [
  {
    factorId: 'DISPOSITION_EFFECT',
    level: 'L2',
    eduStory: '🧠 你会卖掉赚了5%的股票而去补仓亏了30%的那只吗？这是人类最顽固的投资偏见——处置效应。行为金融学诺贝尔奖得主卡尼曼发现：人们倾向于过早卖出赚钱的股票(落袋为安)，过久持有亏损的股票(不愿承认错误)。专业选手反着做：止损果断，让利润奔跑。',
    eduSignal: '效应>70=多数人在卖盈持亏(底部未到)；30-70=正常行为；<30=市场趋于理性',
  },
  {
    factorId: 'ANCHORING',
    level: 'L2',
    eduStory: '⚓ 你买机票时看到"原价2000现价999"——2000这个数字就是一个锚。股票也是：52周高点、你的买入价、分析师目标价，全是心理锚点。锚定效应最危险之处：你会用过去的"锚"判断今天的价格——70块买的股票跌到50，你觉得"亏20不能卖"，但今天这只股票就值50。',
    eduSignal: '>80=股价极度接近历史锚点(追高风险)；50-80=接近锚点；<30=远离锚点(反转可能)',
  },
  {
    factorId: 'EQUITY_MULTIPLIER',
    level: 'L2',
    eduStory: '📐 ROE=20%看起来很棒！但如果你发现这家公司每1元净资产借了4元债来放大收益(权益乘数=5)——高ROE是"真本事"还是"杠杆堆出来的"？权益乘数帮你拆解ROE质量：乘数>5=高杠杆，一次市场波动可能让"高ROE"变成"负ROE"(资不抵债)。杜邦分析第一层分解。',
    eduSignal: '乘数<2=低杠杆稳健；2-4=正常；>5=高杠杆(ROE质量存疑)',
  },
  {
    factorId: 'AH_PREMIUM_CHANGE',
    level: 'L2',
    eduStory: '🔄 AH溢价本身是"静态快照"——A股比H股贵30%。但变化率才是交易信号：溢价从40%缩小到30%=H股在追赶涨得比A快(南下资金抄底) or A股在跌。你需要判断是哪种。只看溢价绝对值就像只看温度不看变冷还是变热——动态比静态多一层信息但更难解读。',
    eduSignal: '溢价收窄=H股相对走强(南下资金推动或A股调整)；溢价扩大=H股相对走弱',
  }
];

// Apply patches: update level + story + signaldesc for demoted factors
for (const patch of R187_DEMOTE_PATCHES) {
  const entry = FACTOR_I18N_REGISTRY.get(patch.factorId);
  if (entry) {
    entry.level = patch.level;
    entry.story = patch.eduStory;
    entry.signaldesc = patch.eduSignal;
  }
}

// ── Convenience Accessors ───────────────────────────────────────────────────

export function getFactorI18n(factorId: string): FactorI18nEntry | undefined {
  return FACTOR_I18N_REGISTRY.get(factorId);
}

/** Get Chinese name for a factor, fallback to factorId */
export function getFactorCNName(factorId: string): string {
  return FACTOR_I18N_REGISTRY.get(factorId)?.nameCN ?? factorId;
}

/** Get all factor IDs for a region */
export function getFactorsByRegion(region: 'global' | 'hk' | 'us' | 'crypto'): FactorI18nEntry[] {
  return [...FACTOR_I18N_REGISTRY.values()].filter(e => e.region === region);
}

/** Get all factors at a specific level */
export function getFactorsByLevel(level: FactorLevel): FactorI18nEntry[] {
  return [...FACTOR_I18N_REGISTRY.values()].filter(e => e.level === level);
}

/** Get level label in a given language */
export function getLevelLabel(level: FactorLevel, lang: string): string {
  return FACTOR_LEVEL_LABELS[level][lang] ?? FACTOR_LEVEL_LABELS[level]['en'];
}

/** Get all factor i18n entries */
export function getAllFactorI18n(): FactorI18nEntry[] {
  return [...FACTOR_I18N_REGISTRY.values()];
}

/** Get factor level distribution stats */
export function getFactorLevelStats(): Record<FactorLevel, number> {
  const stats: Record<FactorLevel, number> = { L1: 0, L2: 0, L3: 0 };
  for (const entry of FACTOR_I18N_REGISTRY.values()) {
    stats[entry.level]++;
  }
  return stats;
}

/** Get color for a score value based on factor's color thresholds */
export function getFactorColor(
  factorId: string,
  score: number,
): 'green' | 'yellow' | 'red' {
  const entry = FACTOR_I18N_REGISTRY.get(factorId);
  if (!entry) return 'yellow';
  if (score <= entry.colors.greenMax) return 'green';
  if (score <= entry.colors.yellowMax) return 'yellow';
  return 'red';
}

/** Get CSS color hex for a score */
export function getFactorColorHex(factorId: string, score: number): string {
  const color = getFactorColor(factorId, score);
  return { green: '#22c55e', yellow: '#eab308', red: '#ef4444' }[color];
}

export default {
  FACTOR_I18N_REGISTRY,
  getFactorI18n,
  getFactorCNName,
  getFactorsByRegion,
  getAllFactorI18n,
  getFactorColor,
  getFactorColorHex,
};
