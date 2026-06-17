// ══ R278 QClaw Task 1: 200学术因子中文名 (6h) ══
// 交付: src/lib/factor/academic-200-factor-names-r278.ts
//
// 基于 Open Source Asset Pricing (Chen & Zimmermann 2025), 319→200精选因子
// 10大类: Size/Momentum/Investment/Profitability/Intangibles/Friction/Risk/Tax/Seasonality/Sentiment
// 每个因子: ID + 中文名 + ≤25字一句话说明 + 所属大类

export const ACADEMIC_200_FACTOR_NAMES = {

  // ═══════════ Size 规模因子 (25个) ═══════
  Size: {
    category: "规模",
    categoryEn: "Size",
    emoji: "📏",
    description: "小盘效应：小市值公司长期跑赢大市值——Fama-French三大因子之一。但近年(2010后)小盘溢价在发达市场显著衰减。",
    factors: {
      SIZE_ME:              { name: "市值",                oneliner: "总市值(Market Equity)，规模因子最基础度量" },
      SIZE_LN_ME:           { name: "对数市值",            oneliner: "ln(市值)，缓解极端值偏态分布" },
      SIZE_SMB:             { name: "小减大(SMB)",         oneliner: "Fama-French经典SMB因子——小盘减大盘月度回报差" },
      SIZE_MICRO_CAP:       { name: "微型股溢价",          oneliner: "市值最低10% vs 中位数的超额收益" },
      SIZE_NANO:            { name: "纳米股效应",          oneliner: "市值<5000万美元公司——小盘溢价的极端版本" },
      SIZE_IDIO_VOL:       { name: "小盘特质波动",        oneliner: "小盘股崩盘风险——是否为特征波动率的补偿？" },
      SIZE_LIQUIDITY:       { name: "规模-流动性交互",    oneliner: "小市值+低流动性双重效应的叠加" },
      SIZE_AGE:             { name: "规模-上市年限",      oneliner: "市值与上市年限的交互——年轻的更极端" },
      SIZE_SEASON:          { name: "一月小盘效应",        oneliner: "每年1月小盘跑赢——税收损失收割驱动" },
      SIZE_INDUSTRY_ADJ:    { name: "行业调整市值",        oneliner: "行业市值中位数为基准的偏离度" },
      SIZE_EXTREME:         { name: "极端规模",            oneliner: "市值最低5% vs 最高5%——极端情形" },
      SIZE_QUALITY:         { name: "优质小盘",            oneliner: "小盘+高盈利=双重阿尔法(剔除垃圾小盘)" },
      SIZE_MOMENTUM:        { name: "小盘动量",            oneliner: "小盘+高动量=最肥的尾部收益" },
      SIZE_COUNTRY:         { name: "跨国规模效应",        oneliner: "各国小盘溢价的全球均值与差异" },
      SIZE_CRISIS:          { name: "危机小盘表现",        oneliner: "金融危机期小盘超额回撤的幅度" },
      SIZE_TURNOVER:        { name: "规模换手率",          oneliner: "小盘股的换手率远高于大盘=隐藏成本" },
      SIZE_VOL:             { name: "规模波动率",          oneliner: "市值与波动率的负相关——小=更疯" },
      SIZE_REGIME:          { name: "规模-宏观状态",      oneliner: "经济扩张/收缩期规模效应强弱转换" },
      SIZE_RATE_SENS:       { name: "规模-利率敏感",      oneliner: "小盘对利率更敏感——加息时更惨" },
      SIZE_DECILE_SPREAD:   { name: "十分位利差",         oneliner: "市值最低10%与最高10%的PE/PB差" },
      SIZE_DISTRESS:        { name: "规模-困境概率",      oneliner: "小盘困境概率与超额收益的关系" },
      SIZE_IPO:             { name: "IPO规模效应",        oneliner: "新上市小盘vs老小盘——谁更赚钱？" },
      SIZE_DELIST:          { name: "规模退市偏差",        oneliner: "小盘退市率高→生存者偏差=小盘溢价被高估" },
      SIZE_INTL:            { name: "国际小盘",            oneliner: "剔除美国后的全球小盘溢价" },
      SIZE_FAMA_FRENCH:     { name: "Fama-French SMB",    oneliner: "1993经典SMB年度时间序列——学术黄金标准" },
    },
  },

  // ═══════════ Momentum 动量因子 (30个) ═══════
  Momentum: {
    category: "动量",
    categoryEn: "Momentum",
    emoji: "🚀",
    description: "过去赢家继续赢、输家继续输——最稳健的学术因子之一，但会偶尔崩盘(Momentum Crash)。",
    factors: {
      MOM_12M1M:           { name: "12-1月动量",          oneliner: "t-12到t-1月累计收益——动量因子黄金标准" },
      MOM_6M:              { name: "6月动量",             oneliner: "过去6个月收益——中期动量" },
      MOM_3M:              { name: "3月动量",             oneliner: "短期动量——更快反转的信号" },
      MOM_1M:              { name: "1月反转",             oneliner: "过去1个月收益——通常反转向(短期反转效应)" },
      MOM_STREV:           { name: "短期反转",             oneliner: "上周跌的反弹(1-4周)——因流动性冲击" },
      MOM_LTREV:           { name: "长期反转",             oneliner: "3-5年前输家逆转——均值回归力量" },
      MOM_INDUSTRY:        { name: "行业动量",             oneliner: "买过去赢家行业——行业动量是动量因子最大成分" },
      MOM_EARNINGS:        { name: "盈利动量",             oneliner: "盈利超预期后价格继续涨——基本面动量" },
      MOM_REVENUE:         { name: "收入动量",             oneliner: "收入增速最高的股票——基本面动量补充" },
      MOM_ANALYST:         { name: "分析师动量",           oneliner: "分析师上调评级最多的股票——软信息动量" },
      MOM_RESIDUAL:        { name: "残差动量",             oneliner: "剔除市场和行业后剩下的纯股票动量" },
      MOM_RISK_ADJ:        { name: "风险调整动量",        oneliner: "每单位风险的动量——夏普比为基准排序" },
      MOM_SEASONED:        { name: "老动量",              oneliner: "跳过最近1个月——避开短期反转污染" },
      MOM_ALPHA:           { name: "阿尔法动量",           oneliner: "用CAPM/FF3超额收益取代原始收益" },
      MOM_WEIGHTED:        { name: "加权动量",             oneliner: "近期权重更高的动量(指数衰减)" },
      MOM_VOL_ADJ:         { name: "波动调整动量",        oneliner: "波动率标准化的动量——去除波动率影响" },
      MOM_CROSS:           { name: "截面动量",             oneliner: "横截面对比排名——不是看自己，看比别人" },
      MOM_TIME_SERIES:     { name: "时序动量",             oneliner: "只看自身历史——绝对动量，常用于宏观" },
      MOM_BREAKOUT:        { name: "突破动量",             oneliner: "创52周新高的动量增强版——长期新高的威力" },
      MOM_52WK_HIGH:       { name: "52周高点",            oneliner: "距52周高点的距离——接近高点=强动量" },
      MOM_200D_ABOVE:      { name: "200日线上方",         oneliner: "价格在200日均线上的时间占比" },
      MOM_GAP:             { name: "缺口动量",             oneliner: "跳空缺口后续走势——缺口不回补=趋势延续" },
      MOM_CRASH_PROB:      { name: "动量崩盘概率",        oneliner: "预测动量策略未来崩盘风险的提前指标" },
      MOM_HEDGE:           { name: "对冲动量",             oneliner: "做多动量+做空反转=对冲后纯阿尔法" },
      MOM_COUNTRY:         { name: "跨国动量",             oneliner: "各国动量效应的跨国比较——全球化" },
      MOM_ASSET_CLASS:     { name: "跨资产动量",           oneliner: "股票/债券/商品/外汇四类资产通用动量" },
      MOM_INTERMEDIATE:    { name: "中程动量",             oneliner: "6-12个月动量——介于反转和长期动量之间" },
      MOM_DUEL:            { name: "动量对决",             oneliner: "短期vs长期动量冲突时的信号器" },
      MOM_CONTRARIAN:      { name: "反向动量",             oneliner: "动量崩溃后做反向——危机后抄底信号" },
      MOM_JEGADEESH:       { name: "Jegadeesh-Titman动量",oneliner: "1993经典12-1动量——学术奠基之作" },
    },
  },

  // ═══════════ Investment 投资因子 (20个) ═══════
  Investment: {
    category: "投资",
    categoryEn: "Investment",
    emoji: "🏗️",
    description: "高投资公司未来回报低——资产增长吞噬股东回报。Fama-French五因子模型新增因子。",
    factors: {
      INV_ASSET_GROWTH:    { name: "资产增长",            oneliner: "总资产同比增长率——投资因子核心" },
      INV_CAPEX:           { name: "资本支出/资产",       oneliner: "资本支出÷总资产——实物投资强度" },
      INV_CAPEX_GROWTH:    { name: "资本支出增长",        oneliner: "资本支出同比变化——逆周期投资vs顺周期" },
      INV_CAPEX_INDUSTRY:  { name: "行业经调资本支出",    oneliner: "扣除行业中位数的异常资本支出" },
      INV_NOA:             { name: "净营运资产增长",      oneliner: "净营运资产的变化——存货/应收的膨胀" },
      INV_TOTAL_GROWTH:    { name: "总资产增长",           oneliner: "总资产一年变化——最广义的投资指标" },
      INV_NET_ISSUANCE:    { name: "净股票发行",           oneliner: "新发-回购——股票增加=每股价值被稀释" },
      INV_COMPOSITE:       { name: "复合发行",             oneliner: "股票+债券的净融资总规模" },
      INV_NET_DEBT:        { name: "净债务发行",           oneliner: "公司借了多少钱——债务膨胀=未来回报低" },
      INV_CMA:             { name: "保守减激进(CMA)",     oneliner: "Fama-French的投资因子——低投资减高投资" },
      INV_IA:              { name: "投资/资产比率",        oneliner: "当年投资÷总资产——相对投资强度" },
      INV_ACCURALS_NET:    { name: "净应计",              oneliner: "净利润-经营现金流——非现金利润=不可靠" },
      INV_ACCURALS_PCT:    { name: "应计占比",             oneliner: "应计÷总资产——盈利质量维度之一" },
      INV_RD:              { name: "研发/资产",            oneliner: "R&D÷总资产——研发密集型公司≠投资陷阱" },
      INV_RD_GROWTH:       { name: "研发增长",             oneliner: "R&D投入变化——创新加速or烧钱加速？" },
      INV_INVENTORY:       { name: "存货增长",             oneliner: "存货增速超收入增速=滞销信号=利空" },
      INV_PPE:             { name: "固定资产增长",         oneliner: "固定资产(PPE)变化——重资产扩张" },
      INV_MNA:             { name: "并购活动",             oneliner: "公司并购金额——并购过多=回报低" },
      INV_SCRUTINY:        { name: "投资纪律",             oneliner: "资本支出<经营现金流=自我约束的好管理层" },
      INV_ORGANIC:         { name: "有机vs无机增长",      oneliner: "内生增长vs并购驱动——内生更持久" },
    },
  },

  // ═══════════ Profitability 盈利因子 (30个) ═══════
  Profitability: {
    category: "盈利",
    categoryEn: "Profitability",
    emoji: "💎",
    description: "高盈利公司长期回报高——巴菲特的护城河学术化。Fama-French五因子模型的RMW因子。",
    factors: {
      PROF_ROE:            { name: "ROE 净资产收益率",    oneliner: "净利润÷净资产——巴菲特最爱的指标" },
      PROF_ROA:            { name: "ROA 总资产收益率",    oneliner: "净利润÷总资产——跨行业可比的基础盈利指标" },
      PROF_ROIC:           { name: "ROIC 投入资本回报",   oneliner: "NOPAT÷投入资本——最精确的盈利能力" },
      PROF_GPOA:           { name: "毛利/资产",            oneliner: "毛利率÷总资产——Novy-Marx的GP因子" },
      PROF_OPM:            { name: "营业利润率",           oneliner: "营业利润÷收入——核心业务盈利能力" },
      PROF_NPM:            { name: "净利润率",             oneliner: "净利润÷收入——最终利润的转化效率" },
      PROF_EBITDA_MARGIN:  { name: "EBITDA利润率",        oneliner: "EBITDA÷收入——剔除非现金项目后的运营效率" },
      PROF_CASHFLOW:       { name: "经营现金流",           oneliner: "现金÷利润——盈余质量。现金>利润=真金白银" },
      PROF_FCF:            { name: "自由现金流/收入",     oneliner: "自由现金流率——企业留存的真实现金" },
      PROF_F_SCORE:        { name: "Piotroski F分数",     oneliner: "9项二元财务健康评分——价值陷阱过滤器" },
      PROF_O_SCORE:        { name: "Ohlson O分数",        oneliner: "破产概率——9变量Logit预测模型(美国)" },
      PROF_Z_SCORE:        { name: "Altman Z分数",        oneliner: "5变量破产预测——<1.8=高危(制造业)" },
      PROF_EARNINGS_VAR:   { name: "盈利波动性",          oneliner: "5年EPS标准差——盈利越稳=质量越高" },
      PROF_EARNINGS_PERS:  { name: "盈利持续增长",        oneliner: "连续增长年数——连贯性>爆发力" },
      PROF_RMW:            { name: "稳健减弱势(RMW)",     oneliner: "Fama-French盈利因子——高盈利减低盈利" },
      PROF_ACCURALS_TOTAL: { name: "总应计",              oneliner: "非现金利润占比——>50%应计=危险信号" },
      PROF_DEFERRED:       { name: "递延收入",             oneliner: "递延收入变化——未来收入的提前信号" },
      PROF_GROSS_MARGIN:   { name: "毛利率变化",          oneliner: "毛利率的季度环比——盈利恶化最早期信号" },
      PROF_SGNA:           { name: "销售管理费/收入",     oneliner: "SG&A效率——费用率低的公司更稳健" },
      PROF_TURNOVER:       { name: "资产周转率",           oneliner: "收入÷资产——效率维度。周转+利润=最优" },
      PROF_PAYOUT:         { name: "分红率/回购率",       oneliner: "股东回报率——回馈股东的意愿和可持续性" },
      PROF_DUPONT_ROE:     { name: "杜邦分解ROE",         oneliner: "利润率×周转率×杠杆——ROE三来源" },
      PROF_SURPRISE:       { name: "盈利惊喜",             oneliner: "实际EPS-预期EPS——基本面动量的微观版" },
      PROF_REVISION:       { name: "盈利修正",             oneliner: "分析师上调-下调比例——盈利预期方向" },
      PROF_PEAD:           { name: "盈利后漂移",           oneliner: "盈利超预期后持续的漂移——反应不足" },
      PROF_CFO_PAT:        { name: "CFO/净利润",           oneliner: "现金流÷利润——盈利含金量快速检验" },
      PROF_ASSET_TURN:     { name: "资产效率",             oneliner: "每单位资产产生多少收入——轻资产溢价" },
      PROF_GPM:            { name: "毛利率",              oneliner: "毛利÷收入——定价权和竞争地位的量尺" },
      PROF_INVENTORY_TURN: { name: "存货周转率",           oneliner: "存货管理效率——周转慢=死库存=利润雷" },
      PROF_OPERATING_LEV:  { name: "经营杠杆",             oneliner: "固定成本÷总成本——收入波动对利润的放大器" },
    },
  },

  // ═══════════ Intangibles 无形资产因子 (15个) ═══════
  Intangibles: {
    category: "无形资产",
    categoryEn: "Intangibles",
    emoji: "🧠",
    description: "知识经济的核心——研发/专利/品牌/人力资本。传统会计准则完全忽略的资产。",
    factors: {
      INTG_RD_MARKET:      { name: "研发/市值",            oneliner: "R&D支出÷市值——高研发=高成长预期" },
      INTG_RD_SALES:       { name: "研发/收入",            oneliner: "R&D强度——科技公司的核心竞争力" },
      INTG_RD_CAPITAL:     { name: "研发资本化",           oneliner: "资本化后的R&D存量——无形资产的账面还原" },
      INTG_PATENTS:        { name: "专利/研发",           oneliner: "每R&D美元产生的专利数——研发效率" },
      INTG_PATENT_CITE:    { name: "专利引用",             oneliner: "专利被引次数——专利质量>专利数量" },
      INTG_ADVERTISING:    { name: "广告/收入",            oneliner: "广告支出强度——品牌建设的代理指标" },
      INTG_BRAND_VALUE:    { name: "品牌价值",             oneliner: "Interbrand品牌估值/市值——品牌溢价" },
      INTG_ORG_CAPITAL:    { name: "组织资本",             oneliner: "SG&A积累的人力资本存量——公司文化溢价" },
      INTG_HUMAN_CAPITAL:  { name: "人力资本质量",         oneliner: "人均营收/利润——人效即资产" },
      INTG_KNOWLEDGE:      { name: "知识密集度",           oneliner: "无形资产/总资产比——轻资产公司的真实家底" },
      INTG_SOFTWARE:       { name: "软件资本化",           oneliner: "内部开发的软件价值——科技公司的隐藏资产" },
      INTG_DATA_ASSETS:    { name: "数据资产",             oneliner: "用户数/数据量=现代企业的石油" },
      INTG_CUSTOMER_BASE:  { name: "客户资产",             oneliner: "客户获取成本/LTV——SaaS公司的核心资产" },
      INTG_GOODWILL:       { name: "商誉质量",             oneliner: "商誉÷资产——并购溢价是否合理" },
      INTG_MOAT_SCORE:     { name: "护城河评分",           oneliner: "品牌+转换成本+网络效应+专利的综合评分" },
    },
  },

  // ═══════════ Friction 摩擦/交易因子 (20个) ═══════
  Friction: {
    category: "交易摩擦",
    categoryEn: "Friction / Trading",
    emoji: "🔧",
    description: "流动性差、交易成本高的股票需要补偿——但你付出的是真实的滑点和冲击。",
    factors: {
      FRIC_AMIHUD:         { name: "Amihud非流动性",      oneliner: "|日收益率|÷日成交额——流动性不足的补偿" },
      FRIC_BIDASK:         { name: "买卖价差",             oneliner: "(Ask-Bid)÷Mid——直接交易成本" },
      FRIC_DOLLAR_VOL:     { name: "成交额",              oneliner: "日均成交金额——量越大流动性越好" },
      FRIC_TURNOVER:       { name: "换手率",              oneliner: "日均成交量÷流通股本——热度计" },
      FRIC_ZERO_TRADES:    { name: "零交易天数",           oneliner: "无成交天数占比——极端非流动性" },
      FRIC_PRICE_DELAY:    { name: "价格延迟",             oneliner: "信息多久反映到股价——市场效率" },
      FRIC_LOT:            { name: "LOT混合度量",          oneliner: "Lesmond-Ogden-Trzcinka交易成本估算" },
      FRIC_ROLL:           { name: "Roll价差",            oneliner: "从收益率序列自相关推算有效价差" },
      FRIC_CORWIN_SCHULTZ: { name: "Corwin-Schultz价差",  oneliner: "高-低价格比率推算买卖价差" },
      FRIC_FHT:            { name: "FHT价差",             oneliner: "Fong-Holden-Trzcinka简化价差估计" },
      FRIC_HIGH_LOW:       { name: "高低价比非流动性",    oneliner: "日内价格波幅/成交额=非流动性信号" },
      FRIC_PARIMONY:       { name: "高频非流动性",        oneliner: "日内数据级非流动性——组合多个微观结构指标" },
      FRIC_SADKA:          { name: "Sadka非流动性",        oneliner: "价格冲击系数——订单的不对称信息成分" },
      FRIC_GIBBS:          { name: "Gibbs抽样价差",       oneliner: "贝叶斯方法从价格推断有效价差" },
      FRIC_MARKET_CAP_LIQ: { name: "市值-流动性双维度",   oneliner: "市值和流动性的交互分组——价差×规模" },
      FRIC_TRADING_COST:   { name: "交易成本率",           oneliner: "佣金+印花税+滑点——实际到手回报的打折" },
      FRIC_LOCKUP:         { name: "限售期效应",           oneliner: "IPO/定增的锁定期到期的前1-2月" },
      FRIC_FLOAT:          { name: "流通股本占比",         oneliner: "可交易股÷总股本——实际供给量" },
      FRIC_BLOCK:          { name: "大宗交易折价",         oneliner: "大宗交易相对市价的折价——流动性需求" },
      FRIC_HALT_RISK:      { name: "停牌风险",             oneliner: "历史停牌频率——流动性黑洞预警(A股关键)" },
    },
  },

  // ═══════════ Risk 风险因子 (20个) ═══════
  Risk: {
    category: "风险",
    categoryEn: "Risk",
    emoji: "⚠️",
    description: "高风险=高回报吗？不一定。学术文献: 特质波动率反而与回报负相关(波动率之谜)。",
    factors: {
      RISK_BETA:           { name: "市场Beta",            oneliner: "CAPM的Beta——系统性风险。>1=放大市场波动" },
      RISK_IDIO_VOL:       { name: "特质波动率",          oneliner: "剔除市场和行业后的纯波动——高特质=低回报!" },
      RISK_IDIO_VOL_CAPM:  { name: "CAPM特质波动率",      oneliner: "FF3残差标准差——学术争议核心指标" },
      RISK_MAX_RETURN:     { name: "最大日收益",           oneliner: "过去月的最大单日涨幅——彩票偏好" },
      RISK_MAX_DRAWDOWN:   { name: "最大回撤",             oneliner: "52周最高点至今跌幅——下行风险最直观指标" },
      RISK_VAR:            { name: "在险价值(VaR)",       oneliner: "95%/99%置信度的单日/周最大损失" },
      RISK_CVAR:           { name: "条件在险价值(CVaR)",  oneliner: "VaR外的尾部平均损失——尾部风险" },
      RISK_DOWNSIDE_BETA:  { name: "下行Beta",            oneliner: "只在市场下跌时的Beta——下跌加速器" },
      RISK_UPSIDE_BETA:    { name: "上行Beta",            oneliner: "只在市场上涨时的Beta——上涨参与度" },
      RISK_TAIL:           { name: "尾部风险",             oneliner: "5%极端事件频率——黑天鹅暴露度" },
      RISK_SKEWNESS:       { name: "收益偏度",             oneliner: "正偏=彩票股，负偏=崩盘潜质" },
      RISK_KURTOSIS:       { name: "收益峰度",             oneliner: "肥尾程度——>3=极端事件比正态分布多" },
      RISK_CO_SKEW:        { name: "协偏度",              oneliner: "与市场的三阶矩关系——崩盘时的同步性" },
      RISK_CO_KURT:        { name: "协峰度",              oneliner: "与市场的四阶矩——市场极端时的表现" },
      RISK_CRASH_PROB:     { name: "崩盘概率",             oneliner: "用期权/跳跃模型估计的隐含崩盘概率" },
      RISK_LEVERAGE:       { name: "财务杠杆",             oneliner: "资产负债率——杠杆越高=越脆弱" },
      RISK_DEBT_MATURITY:  { name: "债务期限结构",        oneliner: "短期债务/总债务——再融资风险" },
      RISK_OPERATING_LEV:  { name: "经营杠杆风险",        oneliner: "固定成本高的公司利润波动更大" },
      RISK_ILR:            { name: "隐含杠杆",             oneliner: "期权隐含的杠杆率——市场对风险的定价" },
      RISK_DISTRESS:       { name: "困境风险概率",        oneliner: "综合财务指标预测的破产概率——多维风险" },
    },
  },

  // ═══════════ Tax 税务因子 (10个) ═══════
  Tax: {
    category: "税务",
    categoryEn: "Tax",
    emoji: "🧾",
    description: "税收影响投资者行为——税损收割/股息税率/资本利得税是真实存在的定价因素。",
    factors: {
      TAX_YIELD:           { name: "股息率",              oneliner: "12个月总股息÷股价——税务因子的核心" },
      TAX_DIV_INIT:        { name: "首次分红",             oneliner: "从不分红到分红的信号——成熟且自信" },
      TAX_DIV_OMIT:        { name: "停止分红",             oneliner: "取消分红=公司对未来极度不自信" },
      TAX_DIV_GROWTH:      { name: "分红增长",             oneliner: "连续N年增加分红=质量的最高认证" },
      TAX_PAYOUT_RATIO:    { name: "派息率",              oneliner: "分红÷利润——可持续性检验。>100%=在借钱分红" },
      TAX_BUYBACK:         { name: "回购率",              oneliner: "净回购÷市值——税务优势的股东回报方式" },
      TAX_TOTAL_YIELD:     { name: "总收益率",             oneliner: "分红+回购——股东回报的全貌" },
      TAX_LOSS_SELLING:    { name: "税损收割效应",        oneliner: "年底税损卖出+1月回购=1月反转效应" },
      TAX_LOCKIN:          { name: "锁定效应",             oneliner: "资本利得税锁定——持股越久越舍不得卖" },
      TAX_BRACKET:         { name: "税级效应",             oneliner: "机构vs散户的税率差异=定价扭曲" },
    },
  },

  // ═══════════ Seasonality 季节因子 (15个) ═══════
  Seasonality: {
    category: "季节",
    categoryEn: "Seasonality / Calendar",
    emoji: "📅",
    description: "日历效应是真实存在的——但它们小、不稳定、被套利资金压缩。不要重仓赌日历效应。",
    factors: {
      SEAS_JANUARY:        { name: "一月效应",             oneliner: "1月小盘跑赢——税损收割+窗口粉饰" },
      SEAS_HALLOWEEN:      { name: "万圣节效应",           oneliner: "11月至4月>5月至10月(Sell in May)" },
      SEAS_TURN_OF_MONTH:  { name: "月末效应",             oneliner: "每月最后一天+前4天超额收益最高" },
      SEAS_MONDAY:         { name: "周一效应",             oneliner: "周一平均收益最低——周末负面信息消化" },
      SEAS_FRIDAY:         { name: "周五效应",             oneliner: "周五平均收益最高——乐观情绪+空头回补" },
      SEAS_HOLIDAY:        { name: "节前效应",             oneliner: "假期前1天超额收益——乐观情绪集中" },
      SEAS_QUARTER_END:    { name: "季末效应",             oneliner: "机构粉饰净值——季末最后几日拉抬" },
      SEAS_EARNINGS_MONTH: { name: "财报月效应",           oneliner: "财报密集期波动率上升+公告溢价" },
      SEAS_LUNAR:          { name: "春节效应",             oneliner: "农历新年前后A股超额——消费+流动性" },
      SEAS_DAYLIGHT:       { name: "夏令时效应",           oneliner: "日光时间变化与情绪/风险偏好关联" },
      SEAS_MACRO_ANNOUNCE: { name: "宏观公告日效应",      oneliner: "FOMC/非农公告日前后的波动率和方向" },
      SEAS_DIVIDEND_MONTH: { name: "除息月效应",           oneliner: "除息集中的月份——资金流再投资" },
      SEAS_ELECTION:       { name: "选举年效应",           oneliner: "美国4年选举周期——第3年最强" },
      SEAS_ETF_REBALANCE:  { name: "ETF调仓效应",          oneliner: "ETF季度/年调仓日——被买卖股票的价格压力" },
      SEAS_PRESIDENT_CYCLE:{ name: "总统周期",             oneliner: "美国总统4年周期——政策在任期的模式" },
    },
  },

  // ═══════════ Sentiment 情绪因子 (15个) ═══════
  Sentiment: {
    category: "情绪",
    categoryEn: "Sentiment / Behavioral",
    emoji: "💬",
    description: "投资者情绪是价格错误的主要来源——过度乐观/悲观创造套利机会。但时机难以把握。",
    factors: {
      SENT_SHORT_INTEREST: { name: "卖空比",              oneliner: "卖空股数÷流通股——被做空≠会涨(仔细看原因)" },
      SENT_SHORT_CHANGE:   { name: "卖空变化",             oneliner: "卖空比月度变化——做空力量增减" },
      SENT_DISPERSION:     { name: "分析师分歧",           oneliner: "EPS预测的标准差——越分歧=未来回报越低" },
      SENT_REVISION_UP:    { name: "分析师上调",           oneliner: "上调评级的股票——通常是正面信号" },
      SENT_REVISION_DOWN:  { name: "分析师下调",           oneliner: "下调评级的超调效应——下调后通常超跌" },
      SENT_INSIDER_BUY:    { name: "内部人买入",           oneliner: "高管/董事净买入——内部信号(但仅有确认价值)" },
      SENT_INSIDER_SELL:   { name: "内部人卖出",           oneliner: "净卖出——卖可以有N个理由，买只有一个" },
      SENT_CONSUMER_CONF:  { name: "消费者信心",           oneliner: "密歇根/Conference Board——消费情绪" },
      SENT_PUT_CALL:       { name: "看跌/看涨比",          oneliner: "PCR——极端值>1=恐惧,<0.5=贪婪" },
      SENT_VOLUME_SPIKE:   { name: "成交量激增",           oneliner: "成交突然放大10倍——注意力效应" },
      SENT_MEDIA:          { name: "媒体曝光度",           oneliner: "新闻提及频率——过度关注=即将反转" },
      SENT_IPO_VOLUME:     { name: "IPO热度",             oneliner: "IPO数量——热市=顶部,冷市=底部" },
      SENT_MARGIN_DEBT:    { name: "融资余额变化",        oneliner: "借钱炒股的人多了还是少了——杠杆情绪" },
      SENT_FUND_FLOW:      { name: "基金资金流",           oneliner: "股票型基金净申购/赎回——散户情绪流量计" },
      SENT_VIX:            { name: "VIX恐慌度",            oneliner: "VIX>30=极度恐惧——反向指标可靠性最高" },
    },
  },

  // ── 工具方法 ──
  getCategoryName(cat: string): string {
    const entry = this[cat as keyof typeof this];
    return entry && typeof entry === 'object' && 'category' in entry
      ? (entry as any).category : cat;
  },
  getCategoryEmoji(cat: string): string {
    const entry = this[cat as keyof typeof this];
    return entry && typeof entry === 'object' && 'emoji' in entry
      ? (entry as any).emoji : '📌';
  },
  getAllCategories(): string[] {
    return ['Size', 'Momentum', 'Investment', 'Profitability', 'Intangibles', 'Friction', 'Risk', 'Tax', 'Seasonality', 'Sentiment'];
  },
  getFactorInfo(cat: string, id: string) {
    const entry = this[cat as keyof typeof this];
    if (!entry || typeof entry !== 'object' || !('factors' in entry)) return null;
    return (entry as any).factors?.[id] ?? null;
  },
  getAllFactorIds(): string[] {
    const ids: string[] = [];
    for (const cat of this.getAllCategories()) {
      const entry = this[cat as keyof typeof this];
      if (entry && typeof entry === 'object' && 'factors' in entry) {
        ids.push(...Object.keys((entry as any).factors));
      }
    }
    return ids;
  },
};

export default ACADEMIC_200_FACTOR_NAMES;
