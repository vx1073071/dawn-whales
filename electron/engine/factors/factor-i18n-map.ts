// ── R162 P0-H1a: Factor i18n Map ──────────────────────────────────────────
// Chinese names, one-line usage guides, and color thresholds for all 42 factors.
// Used by both factor-summary-engine.ts and frontend human-readable cards.
//
// Design: hardcoded CN strings (not dependent on i18n.t()) for reliability
// and fast lookup at render time. Chinese-language UX is the primary market.

import type { FactorSourceName } from './factor-data-provider';

// ── Factor i18n entry ──────────────────────────────────────────────────────

export interface FactorI18nEntry {
  /** Factor ID (matches FactorDefinition.id) */
  factorId: string;
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
    // ═══ Universal / Fama-French (11) ═══
    {
      factorId: 'MOM_12M',
      nameCN: '12月动量',
      categoryCN: '动量',
      region: 'global',
      oneLine: '过去12个月涨幅越大，动量越强，趋势延续概率更高',
      descriptionCN: '计算过去12个月（跳过最近1个月）的总收益率。学术研究表明中期动量（3-12个月）是最稳健的因子之一。高动量股票倾向于继续上涨，但需警惕动量崩盘。',
      highMeaning: '强趋势，历史涨幅靠前',
      lowMeaning: '弱趋势或回调中，表现落后',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'MOM_1M',
      nameCN: '1月动量',
      categoryCN: '动量',
      region: 'global',
      oneLine: '最近1个月涨幅，极端值可能预示短期反转',
      descriptionCN: '计算最近1个月的收益率。短周期动量存在反转效应：极端上涨后的回调压力，以及超跌后的反弹动力。适合配合RSI判断超买超卖。',
      highMeaning: '近期强势上涨，注意回调风险',
      lowMeaning: '近期弱势下跌，可能存在反弹机会',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'LIQ',
      nameCN: '流动性',
      categoryCN: '波动率',
      region: 'global',
      oneLine: '日均换手率，流动性越高交易成本越低',
      descriptionCN: '日均成交额/流通市值比率。高流动性标志易于进出，滑点低。学术上流动性溢价表明低流动性股票长期收益更高，但实际交易需考虑摩擦成本。',
      highMeaning: '交投活跃，进出方便',
      lowMeaning: '交投清淡，可能面临流动性风险',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'neutral',
      source: 'capital_flow',
    },
    {
      factorId: 'VOL_60D',
      nameCN: '60日波动率',
      categoryCN: '波动率',
      region: 'global',
      oneLine: '60天年化波动率，高波动=高风险=高收益潜力',
      descriptionCN: '60日收益率标准差年化。低波动异常（低波动股票长期跑赢高波动）是学术界广泛记录的现象。防御型策略偏好低波动，激进型偏好高波动。',
      highMeaning: '价格波动剧烈，风险较高',
      lowMeaning: '价格平稳，适合稳健策略',
      colors: { greenMax: 50, yellowMax: 75, redMin: 76 },
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      factorId: 'GROWTH',
      nameCN: '成长性',
      categoryCN: '成长',
      region: 'global',
      oneLine: '营收和盈利3年复合增长率，成长股的核心指标',
      descriptionCN: 'Z(营收增长率) + Z(盈利增长率) 的合成指标。使用3年CAGR平滑短期噪音。高成长股估值通常较高，需配合估值因子判断是否合理。',
      highMeaning: '高增长，营收盈利双扩张',
      lowMeaning: '增长放缓或衰退，需警惕',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'QUAL',
      nameCN: '质量',
      categoryCN: '质量',
      region: 'global',
      oneLine: '高ROE、低负债、低应计项目的综合质量评分',
      descriptionCN: 'Z(ROE) + Z(-负债率) + Z(-应计项目) 的合成指标。避开财务质量差的公司。高质量公司长期超额收益显著，尤其在高通胀/高利率环境。',
      highMeaning: '财务健康，盈利真实，造血能力强',
      lowMeaning: '财务质量存疑，应计项目偏高',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'SIZE',
      nameCN: '规模(SMB)',
      categoryCN: '规模',
      region: 'global',
      oneLine: '市值对数，小盘股长期超额收益但波动更高',
      descriptionCN: 'Fama-French SMB因子。小盘股市值小、关注度低、信息不对称程度高，长期存在超额收益，但流动性差、波动大。牛市小盘强、熊市大盘稳。',
      highMeaning: '大盘蓝筹，稳定性好',
      lowMeaning: '小盘成长，弹性大、波动高',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'lowerBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'YIELD',
      nameCN: '股息率',
      categoryCN: '收益',
      region: 'global',
      oneLine: '过去12个月每股股息/当前股价，高股息=价值锚',
      descriptionCN: 'TTM股息收益率。在低利率环境中高股息策略有吸引力。需区分"真高股息"（持续派息）和"假高股息"（股价暴跌造成的虚高）。',
      highMeaning: '高分红，适合收息策略',
      lowMeaning: '低分红或不分红，更偏成长',
      colors: { greenMax: 65, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'HML',
      nameCN: '价值(HML)',
      categoryCN: '价值',
      region: 'global',
      oneLine: '市净率倒数，低估值股票长期跑赢高估值',
      descriptionCN: 'Fama-French HML因子：账面价值/市值比率。价值股在市场恐慌期折价更深，在市场复苏期弹性更大。价值因子在美国市场2018-2020表现较弱后在2022年强势回归。',
      highMeaning: '低估值，便宜货，安全边际高',
      lowMeaning: '高估值，成长溢价已充分反映',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'RMW',
      nameCN: '盈利能力(RMW)',
      categoryCN: '质量',
      region: 'global',
      oneLine: '营业利润/账面权益，利润率高=护城河宽',
      descriptionCN: 'Fama-French RMW因子：(营收-成本-费用)/账面权益。高盈利能力意味着公司有定价权、成本控制好、竞争壁垒高。盈利持续稳定的公司适合长期持有。',
      highMeaning: '盈利能力强、成本控制好、行业地位稳固',
      lowMeaning: '盈利能力弱、可能面临价格战或成本压力',
      colors: { greenMax: 70, yellowMax: 85, redMin: 86 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },
    {
      factorId: 'CMA',
      nameCN: '投资风格(CMA)',
      categoryCN: '质量',
      region: 'global',
      oneLine: '总资产变化率，低投资扩张=保守=长期溢价',
      descriptionCN: 'Fama-French CMA因子：Δ总资产/总资产。保守投资（低扩张）公司管理者更谨慎，避免过度扩张破坏股东价值。激进扩张可能稀释ROE。',
      highMeaning: '保守经营，不大举扩张，资本纪律好',
      lowMeaning: '激进扩张，可能面临整合风险',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'lowerBetter',
      source: 'stock_diagnosis',
    },

    // ═══ Technical Indicators (10) ═══
    {
      factorId: 'MA_20_60',
      nameCN: '均线交叉(20/60)',
      categoryCN: '趋势',
      region: 'global',
      oneLine: 'MA20上穿MA60=金叉看涨；下穿=死叉看跌',
      descriptionCN: '20日均线与60日均线交叉信号：短期均线上穿长期均线形成金叉（看涨），下穿形成死叉（看跌）。最经典的趋势跟踪指标之一。',
      highMeaning: '短期趋势强于中期，金叉信号',
      lowMeaning: '短期趋势弱于中期，死叉信号',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'EMA_12_26',
      nameCN: 'MACD',
      categoryCN: '趋势',
      region: 'global',
      oneLine: 'MACD柱状图转正=动能增强，转负=动能减弱',
      descriptionCN: 'EMA12-EMA26与EMA9的差值（MACD柱状图）。柱状图由负转正（金叉）和由正转负（死叉）是最常用的交易信号，配合背离判断更准确。',
      highMeaning: '上涨动能增强，金叉区域',
      lowMeaning: '下跌动能增强，死叉区域',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'RSI_14',
      nameCN: 'RSI(14)',
      categoryCN: '动量',
      region: 'global',
      oneLine: 'RSI<30超卖(反弹机会)>，RSI>70超买(回调风险)',
      descriptionCN: '14日相对强弱指数。经典用法：RSI<30为超卖区（潜在买入机会），RSI>70为超买区（潜在卖出信号）。在强趋势市场中RSI会长期停留在极端区域，不宜盲目抄底。',
      highMeaning: '超买区域，短期回调压力大',
      lowMeaning: '超卖区域，短期反弹概率高',
      colors: { greenMax: 40, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      factorId: 'KDJ',
      nameCN: 'KDJ随机指标',
      categoryCN: '动量',
      region: 'global',
      oneLine: 'K线上穿D线=金叉看涨；J值>100超买、<0超卖',
      descriptionCN: '快速随机震荡器。K线=快速线，D线=慢速线，J线=3K-2D为加速线。J值突破100为超买（警惕回调），跌破0为超卖（关注反弹）。A股市场常用短周期交易指标。',
      highMeaning: '短期强势，但警惕超买回调',
      lowMeaning: '短期弱势，但关注超卖反弹',
      colors: { greenMax: 40, yellowMax: 65, redMin: 66 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'BOLL',
      nameCN: '布林带%B',
      categoryCN: '波动率',
      region: 'global',
      oneLine: '价格在布林带的位置：上轨附近=压力，下轨附近=支撑',
      descriptionCN: '价格在布林带(20,2)中的相对位置。%B=0对应下轨（支撑），%B=1对应上轨（压力）。布林带收窄预示变盘，扩张预示趋势延续。',
      highMeaning: '价格接近上轨，短期有回调压力',
      lowMeaning: '价格接近下轨，短期有反弹动力',
      colors: { greenMax: 40, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'factor_research',
    },
    {
      factorId: 'ATR_14',
      nameCN: 'ATR(14)',
      categoryCN: '波动率',
      region: 'global',
      oneLine: '14日平均真实波幅，用于止损设置和仓位计算',
      descriptionCN: '14日平均真实波幅。不是方向性指标，而是波动幅度指标。ATR越大表示日内波动越剧烈，止损应设得更宽；ATR越小表示平静，突破往往更有效。',
      highMeaning: '波动剧烈，止损需放宽',
      lowMeaning: '波动平缓，适合突破交易',
      colors: { greenMax: 50, yellowMax: 70, redMin: 71 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'ADX',
      nameCN: 'ADX趋势强度',
      categoryCN: '趋势',
      region: 'global',
      oneLine: 'ADX>25=趋势市场(宜追涨)，ADX<20=震荡市场(宜高抛低吸)',
      descriptionCN: '14日平均趋向指数。衡量趋势强度而非方向：ADX>25表明市场处于趋势状态（适合趋势跟踪策略），ADX<20表明市场处于盘整状态（适合均值回归策略）。',
      highMeaning: '强趋势，趋势策略有效',
      lowMeaning: '弱趋势/盘整，回归策略有效',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'OBV',
      nameCN: '能量潮(OBV)',
      categoryCN: '情绪',
      region: 'global',
      oneLine: '价升量增=上涨真实，价升量缩=上涨乏力',
      descriptionCN: '累积成交量指标：OBV = Σ(Volume × sign(Close - PrevClose))。OBV与价格同步上行确认上涨趋势，OBV与价格背离是警告信号。',
      highMeaning: '量价配合好，资金持续流入',
      lowMeaning: '量能不足，上涨缺乏支撑',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'sentiment',
    },
    {
      factorId: 'CMF',
      nameCN: '蔡金资金流',
      categoryCN: '情绪',
      region: 'global',
      oneLine: '21日资金流向：正值=资金净流入(看涨)，负值=净流出(看跌)',
      descriptionCN: '蔡金资金流指标：结合价格位置和成交量判断资金流向。正值表示收盘价靠近日内高点且有量配合（资金流入），负值反之。适合中期趋势确认。',
      highMeaning: '资金持续净流入，买盘意愿强',
      lowMeaning: '资金持续净流出，抛压较重',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'capital_flow',
    },
    {
      factorId: 'ICHIMOKU',
      nameCN: '一目均衡云',
      categoryCN: '趋势',
      region: 'global',
      oneLine: '价格在云上方=牛市，云下方=熊市，云内=震荡',
      descriptionCN: '一目均衡表(Ichimoku Kinko Hyo)：包含转换线、基准线、先行带A/B和延迟线。云层（先行带A和B之间）是未来支撑/阻力区域。价格在云上方看涨，下方看跌。',
      highMeaning: '牛市结构，云层提供支撑',
      lowMeaning: '熊市结构，云层构成压力',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },

    // ═══ HK-Specific (4 unique) ═══
    {
      factorId: 'HKEX_SOUTHBOUND',
      nameCN: '南向资金',
      categoryCN: '情绪',
      region: 'hk',
      oneLine: '内地资金通过港股通净买入港股的金额，越多越看涨',
      descriptionCN: '港股通每日净买入金额(港元)的Z-score。南向资金是港股最重要的增量资金来源。持续净流入=内地资金看好港股，持续净流出=撤离信号。20日滚动标准化。',
      highMeaning: '内地资金大幅流入，看好港股后市',
      lowMeaning: '内地资金流出或流入减少',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'capital_flow',
    },
    {
      factorId: 'HKEX_CBCS_PREMIUM',
      nameCN: '牛熊证溢价',
      categoryCN: '价值',
      region: 'hk',
      oneLine: '牛熊证价格与内在价值的偏离，溢价越高越贵',
      descriptionCN: '牛熊证(CBBC)市场价格与内在价值之差与现价的比率。高溢价表示牛熊证定价偏高，低溢价或折价可能是机会。注意临近收回价的牛熊证风险极高。',
      highMeaning: '牛熊证定价偏高，买入成本高',
      lowMeaning: '牛熊证定价合理或偏便宜',
      colors: { greenMax: 40, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'HKEX_WARRANT_IV',
      nameCN: '窝轮隐含波动率',
      categoryCN: '波动率',
      region: 'hk',
      oneLine: '窝轮IV与历史波动率的差值，正=贵、负=便宜',
      descriptionCN: '窝轮BSM模型隐含波动率与正股30日历史波动率之差。正差值表示窝轮IV高于历史波动率（偏贵），负差值可能表示低估。需注意窝轮流动性。',
      highMeaning: '窝轮IV偏高，买入成本高',
      lowMeaning: '窝轮IV偏低，可能有套利机会',
      colors: { greenMax: 40, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'HKEX_FUND_HOLD',
      nameCN: '基金持仓',
      categoryCN: '质量',
      region: 'hk',
      oneLine: '前10大基金持仓重叠度，机构越多越受认可',
      descriptionCN: '前10大基金在个股的持仓重叠度Z-score。机构投资者通常代表专业判断，但需警惕抱团股在赎回期的一致性抛售。',
      highMeaning: '机构集中持有，专业认可度高',
      lowMeaning: '机构关注度低或回避该标的',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'fund_holdings',
    },

    // ═══ US-Specific (4) ═══
    {
      factorId: 'US_VIX',
      nameCN: 'VIX恐慌指数',
      categoryCN: '宏观',
      region: 'us',
      oneLine: 'VIX>30=极度恐慌(可能见底)，VIX<15=过度乐观(警惕回调)',
      descriptionCN: 'CBOE波动率指数，衡量标普500期权隐含波动率。VIX越高恐慌越大（逆势买入机会），VIX越低市场越自满（警惕黑天鹅）。著名反向指标，''当VIX高就该买''。',
      highMeaning: '市场恐慌，波动加大，可能是买入窗口',
      lowMeaning: '市场乐观/自满，警惕尾部风险',
      colors: { greenMax: 35, yellowMax: 65, redMin: 66 },
      direction: 'lowerBetter',
      source: 'sentiment',
    },
    {
      factorId: 'US_SHORT_RATIO',
      nameCN: '空头持仓',
      categoryCN: '情绪',
      region: 'us',
      oneLine: '空头持仓天数>5=可能轧空(逼空)，<2=看空情绪弱',
      descriptionCN: '空头持仓/日均成交量，即空头需要多少天才能完全平仓。高天数=大量空头持仓=潜在轧空（逼空）机会。GME事件是该因子的经典案例。',
      highMeaning: '大量空头持仓，轧空概率高',
      lowMeaning: '空头情绪不重，无逼空压力',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'sentiment',
    },
    {
      factorId: 'US_INST_HOLD',
      nameCN: '机构持仓变化',
      categoryCN: '情绪',
      region: 'us',
      oneLine: '13F报告机构持仓环比变化，增持=看涨信号',
      descriptionCN: '基于13F季报的机构总持仓环比变化/总股本。注意数据滞后45天，但机构调仓通常持续性较强。连续两个季度增持为强信号。',
      highMeaning: '机构大幅增持，专业投资者看好',
      lowMeaning: '机构减持，需关注基本面是否恶化',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'fund_holdings',
    },
    {
      factorId: 'US_BUYBACK',
      nameCN: '回购收益率',
      categoryCN: '收益',
      region: 'us',
      oneLine: '净回购/市值，回购越多股东回报越高',
      descriptionCN: '(股票回购-股票发行)/市值TTM。美股市场中回购是回报股东的主要方式。高回购收益率=管理层认为股价低估+有效提升EPS。但需区分"真回购"（注销）和"假回购"（对冲期权行权稀释）。',
      highMeaning: '大量回购，股价有支撑',
      lowMeaning: '回购少或增发稀释股权',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'stock_diagnosis',
    },

    // ═══ Global / Multi-Market (3) ═══
    {
      factorId: 'OPTION_PCR',
      nameCN: '看跌/看涨比率',
      categoryCN: '情绪',
      region: 'global',
      oneLine: 'Put/Call持仓比>1=市场看空(逆势看涨)，<0.7=过度看多(警惕)',
      descriptionCN: '看跌期权持仓/看涨期权持仓。>1.0表示市场看空情绪浓（逆势可能看涨），<0.7表示市场过度看多。是经典的逆向情绪指标。',
      highMeaning: '市场悲观情绪浓，逆向看涨',
      lowMeaning: '市场过度乐观，警惕反转',
      colors: { greenMax: 40, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'sentiment',
    },
    {
      factorId: 'SECTOR_ROTATION',
      nameCN: '行业轮动',
      categoryCN: '宏观',
      region: 'global',
      oneLine: '行业3/6/12月动量排名，前3行业=市场主线',
      descriptionCN: 'GICS 11大类行业的3/6/12月加权动量排名。选前3名行业作为市场主线配置方向。经济周期不同阶段不同行业占优：复苏期金融+可选消费，过热期能源+材料，衰退期防御+公用。',
      highMeaning: '所属行业处于轮动强势期',
      lowMeaning: '所属行业处于轮动弱势期',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'FX_EXPOSURE',
      nameCN: '汇率暴露',
      categoryCN: '宏观',
      region: 'global',
      oneLine: '非本地货币收入占比×汇率变动，本币贬值利好出口型企业',
      descriptionCN: '非本地货币收入占比 × 汇率月度变动。适用于新加坡/日本/澳大利亚等出口导向市场。本币贬值→出口企业利润增厚，本币升值→出口企业承压。',
      highMeaning: '汇率因素对盈利有利',
      lowMeaning: '汇率因素拖累盈利',
      colors: { greenMax: 60, yellowMax: 75, redMin: 76 },
      direction: 'neutral',
      source: 'factor_research',
    },

    // ═══ Crypto-Specific (10) ═══
    {
      factorId: 'CRYPTO_FUNDING',
      nameCN: '资金费率',
      categoryCN: '情绪',
      region: 'crypto',
      oneLine: '永续合约资金费率，极端正=多头拥挤(看跌)，极端负=空头拥挤(看涨)',
      descriptionCN: '8小时资金费率年化。>0.1%表示多头过度拥挤（逆势看跌），<-0.05%表示空头过度拥挤（逆势看涨）。高频率信号，适合日内/短线交易。',
      highMeaning: '多头拥挤，警惕多杀多',
      lowMeaning: '空头拥挤，可能空杀空反弹',
      colors: { greenMax: 35, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_OI_DELTA',
      nameCN: '持仓量变化',
      categoryCN: '情绪',
      region: 'crypto',
      oneLine: '24h持仓变化：价格涨+OI涨=趋势确认；价格涨+OI跌=趋势减弱',
      descriptionCN: '24小时未平仓合约变化率。OI与价格同步变化确认趋势强度，OI与价格背离是反转信号。期货市场最重要的技术指标之一。',
      highMeaning: '资金持续进场，趋势强劲',
      lowMeaning: '资金离场或观望，趋势减弱',
      colors: { greenMax: 60, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_EXCHANGE_FLOW',
      nameCN: '交易所净流量',
      categoryCN: '情绪',
      region: 'crypto',
      oneLine: '链上BTC/ETH流入交易所=抛压，流出交易所=囤币看涨',
      descriptionCN: '净流入交易所量/流通供应的7日滚动Z-score。币流入交易所通常准备卖出（利空），币流出交易所通常转入冷钱包（看涨）。链上数据最可靠的中期指标之一。',
      highMeaning: '大量币流入交易所，抛售压力',
      lowMeaning: '币流出交易所，持有者惜售',
      colors: { greenMax: 35, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_ORDERBOOK_IMB',
      nameCN: '订单簿不平衡',
      categoryCN: '波动率',
      region: 'crypto',
      oneLine: '买卖盘2%深度比，>0.55看涨、<0.45看跌',
      descriptionCN: '中间价2%范围内买盘深度/(买盘+卖盘深度)。>0.55表示买盘厚（短期看涨），<0.45表示卖盘厚（短期看跌）。高频微观结构信号。',
      highMeaning: '买盘深厚，短期看涨',
      lowMeaning: '卖盘压顶，短期看跌',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_VOL_RATIO',
      nameCN: '波动率比值',
      categoryCN: '波动率',
      region: 'crypto',
      oneLine: '7日/30日波动率比，>1.5=变盘突破，<0.7=压缩蓄力',
      descriptionCN: '短期波动率与中期波动率的比值。>1.5表示波动扩张（趋势策略），<0.7表示波动压缩（突破策略）。加密市场波动率变化剧烈，该指标可提前预警。',
      highMeaning: '波动扩张，趋势可能加速',
      lowMeaning: '波动压缩，可能酝酿大行情',
      colors: { greenMax: 50, yellowMax: 75, redMin: 76 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'CRYPTO_VOLUME_PROFILE',
      nameCN: '成交量分布POC',
      categoryCN: '趋势',
      region: 'crypto',
      oneLine: '价格与最大成交量节点(POC)的相对位置，突破POC=方向确认',
      descriptionCN: '(当前价 - POC30日)/POC。POC是过去30日成交量最密集的价格。价格在POC上方且远离=强势，价格在POC下方且远离=弱势。POC突破往往伴随放量。',
      highMeaning: '价格远高于成本区，多头优势',
      lowMeaning: '价格低于成本区，多头处于防守',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_research',
    },
    {
      factorId: 'CRYPTO_BTC_CORR',
      nameCN: 'BTC相关性',
      categoryCN: '宏观',
      region: 'crypto',
      oneLine: '30日滚动与BTC相关系数，>0.85=BTC影子，<0.3=独立行情',
      descriptionCN: '30日收益率与BTC收益率的Pearson相关系数。高相关性意味着该币种跟随BTC波动（beta play），低相关性意味着独立行情（alpha potential）。山寨季通常伴随低相关性。',
      highMeaning: '高度跟随BTC，同涨同跌',
      lowMeaning: '独立行情，可能有alpha机会',
      colors: { greenMax: 50, yellowMax: 75, redMin: 76 },
      direction: 'neutral',
      source: 'factor_research',
    },
    {
      factorId: 'CRYPTO_NVT',
      nameCN: 'NVT比率',
      categoryCN: '价值',
      region: 'crypto',
      oneLine: '加密货币的"市盈率"：市值/链上交易量，高=高估泡沫',
      descriptionCN: '市值/日链上交易量(USD)，加密货币版P/E。NVT越高表示每单位交易量支撑的市值越大（高估），NVT越低表示链上使用活跃相对市值合理（低估）。90日Z-score标准化。',
      highMeaning: '估值偏高，市值脱离实际使用量',
      lowMeaning: '估值合理/偏低，链上活跃度高',
      colors: { greenMax: 35, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_ACTIVE_ADDR',
      nameCN: '活跃地址数',
      categoryCN: '成长',
      region: 'crypto',
      oneLine: '日活地址30日均线/90日均线，增长=网络效应增强',
      descriptionCN: '(30日MA活跃地址 - 90日MA)/90日MA的Z-score。活跃地址增长是网络采用率的核心指标，领先于价格。Metcalfe定律：网络价值∝用户数²。',
      highMeaning: '网络使用率增长，基本面改善',
      lowMeaning: '网络使用率下降，用户流失',
      colors: { greenMax: 65, yellowMax: 80, redMin: 81 },
      direction: 'higherBetter',
      source: 'factor_cloud',
    },
    {
      factorId: 'CRYPTO_LIQUIDATIONS',
      nameCN: '爆仓热度',
      categoryCN: '波动率',
      region: 'crypto',
      oneLine: '4h爆仓量/OI，极端爆仓=恐慌抛售底+后续反弹',
      descriptionCN: '4小时总爆仓量/未平仓合约的Z-score。极端爆仓（>2.0）通常发生在插针行情中，清理杠杆后市场往往反弹。是加密货币市场特有的"恐慌底"指标。',
      highMeaning: '大量爆仓，恐慌抛售，注意反弹',
      lowMeaning: '爆仓正常，市场杠杆健康',
      colors: { greenMax: 35, yellowMax: 60, redMin: 61 },
      direction: 'lowerBetter',
      source: 'factor_cloud',
    },
  ].map(entry => [entry.factorId, entry] as const),
);

// ── Convenience Accessors ───────────────────────────────────────────────────

/** Get i18n entry for a factor by ID */
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

/** Get all factor i18n entries */
export function getAllFactorI18n(): FactorI18nEntry[] {
  return [...FACTOR_I18N_REGISTRY.values()];
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
