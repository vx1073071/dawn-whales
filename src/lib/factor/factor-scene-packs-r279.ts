// ══ R279 QClaw Task 2: 场景包5组文案 (2h) ══
// 交付: src/lib/factor/factor-scene-packs-r279.ts
//
// 5大投资场景，每组含因子配方+步骤引导+风险警告
// 一键加载→调整→下单的最小路径

export const FACTOR_SCENE_PACKS = {

  // ═══════════ 场景1: 追涨 — 趋势跟随 ═══════════
  chasing: {
    id: "chasing",
    name: "追涨",
    emoji: "🚀",
    tagline: "趋势是你的朋友——直到它不是为止",
    whenToUse: "市场处于明确上涨趋势时。均线多头排列、指数在200日均线上方。适合能忍受波动、纪律止损的人。",
    whenNotToUse: "横盘震荡市——追涨在震荡市会被反复打脸。市场刚从大底反弹的第一波慎追（可能是死猫跳）。",
    
    factorRecipe: {
      core: [
        { factor: "MOM_12M1M", name: "12-1月动量", weight: 35, reason: "主力因子——过去一年赢家继续赢" },
        { factor: "MOM_52WK_HIGH", name: "52周高点", weight: 25, reason: "创新高的股票有惯性——新高之后还有新高" },
        { factor: "MOM_6M", name: "6月动量", weight: 20, reason: "中期趋势确认——过滤掉短命反弹" },
      ],
      accessory: [
        { factor: "TURNOVER_RATE", name: "换手率", weight: 10, reason: "高动量+低换手=真趋势。高动量+高换手=拥挤止损触发。" },
        { factor: "PROF_ROE", name: "ROE", weight: 10, reason: "有利润支撑的动量比纯股价动量更持久" },
      ],
      rejects: [
        { signal: "市值<10亿+低流动性", reason: "小盘伪动量——几个大户就能拉起来，跟真动量没关系" },
        { signal: "基本面差但动量高", reason: "垃圾股惯性的终点一般是腰斩" },
      ],
    },

    steps: [
      { step: 1, title: "确认大势", action: "指数在200日均线上方+均线多头排列？不是就不追。", tip: "逆大势追个股是输家的玩法。" },
      { step: 2, title: "加载追涨因子模板", action: "一键调用MOM_12M1M + 52WK_HIGH + MOM_6M", tip: "系统自动按权重排序，动量得分最高的在前。" },
      { step: 3, title: "过滤基本面垃圾", action: "用ROE>5%和换手率<行业2倍过滤", tip: "沃伦·巴菲特不会追涨，但你至少别追垃圾。" },
      { step: 4, title: "设止损", action: "每笔亏8%就砍——追涨策略的生命线是止损", tip: "回测表明：8%止损的追涨组合夏普比无止损高出0.4。" },
      { step: 5, title: "执行并监控拥挤度", action: "每周检查换手率变化。换手率突然>历史2倍标准差=拥挤撤退信号", tip: "拥挤不是卖的理由，拥挤突然增加才是。" },
    ],

    riskWarning: "⚠️ 追涨在波动率突然飙升时（VIX>30）会遭受Momentum Crash——2009年3月追涨策略单月亏损高达-46%。永远不要在恐慌市里追涨。",
    expectedReturn: "长期年化超额3-6% | 最大回撤-30% | 建议仓位≤40%",
    beginnerNote: "🐋 Whaley说实话：追涨是新手最能赚钱的策略——但也是最容易在崩盘时加倍亏损的策略。纪律永远比公式重要。",
  },

  // ═══════════ 场景2: 抄底 — 价值发现 ═══════════
  dipBuying: {
    id: "dipBuying",
    name: "抄底",
    emoji: "🛒",
    tagline: "好公司遭遇坏价格——不是好价格遇到坏公司",
    whenToUse: "好公司(ROE>15%/5年稳定增长)因市场情绪/板块轮动/一次性利空大跌(跌幅>20%)。你需要有耐心：抄底的回报通常需要3-12个月兑现。",
    whenNotToUse: "公司基本面出现永久性恶化（技术被颠覆/商业模式失效/财务造假）。下跌超过50%的股票——能跌一半就能再跌一半。不要接飞刀。",

    factorRecipe: {
      core: [
        { factor: "PE_TTM", name: "市盈率", weight: 25, reason: "便宜的相对估值——但必须跨行业对比才有意义" },
        { factor: "PROF_ROE", name: "ROE", weight: 25, reason: "必须先确认是好公司——高ROE是护城河的最好证据" },
        { factor: "PB_LF", name: "市净率", weight: 20, reason: "PB<1是经典深价值号——但科技公司PB天然高" },
        { factor: "F_SCORE", name: "Piotroski F-Score", weight: 20, reason: "9项财务健康检查——排除价值陷阱的最重要工具" },
      ],
      accessory: [
        { factor: "DEBT_EQUITY", name: "负债率", weight: 5, reason: "高负债的价值股往往是陷阱——便宜因为快破产了" },
        { factor: "INSIDER_BUY", name: "内部人买入", weight: 5, reason: "管理层在大跌后自掏腰包买入=强烈的确认信号" },
      ],
      rejects: [
        { signal: "F-Score<3", reason: "财务在恶化的便宜不是便宜——是价值陷阱" },
        { signal: "ROE<5%且连续下降", reason: "烂公司跌得再多也不该抄——它值这个价" },
        { signal: "负债率>70%且行业逆风", reason: "高杠杆在坏环境中=破产加速器" },
      ],
    },

    steps: [
      { step: 1, title: "确认是大跌而非崩盘", action: "跌幅>20%但<50%。超过50%=可能性较高是基本面永久损伤", tip: "好公司跌20%是折价，跌50%通常是你没看清的问题被市场看清了。" },
      { step: 2, title: "加载抄底模板", action: "一键调用PE+ROE+PB+F-Score", tip: "先看质量再看价格——顺序很重要" },
      { step: 3, title: "读F-Score", action: "得分≥7才是真正值得抄底的标的。4-6是灰色地带。≤3直接过。", tip: "F-Score是 Piotroski 教授2000年的杰作，专为筛选价值陷阱设计" },
      { step: 4, title: "检查内部人动向", action: "大跌后管理层在买还是卖？", tip: "内部人买入是最强的信号——他们比任何分析师都了解公司" },
      { step: 5, title: "分批入场，别一把梭", action: "分3-4次建仓，每次间隔1-2周", tip: "你永远买不到最低点。分批是抄底者对自己诚实的方式。" },
    ],

    riskWarning: "⚠️ 抄底最大的风险不是继续跌——而是你抄到的便宜货会一直便宜下去（价值陷阱）。2000-2010年日本价值股便宜了十年都没涨。便宜不是买入的唯一理由，便宜+改善才是。",
    expectedReturn: "长期年化超额2-5% | 最大回撤-25% | 建议仓位≤30%",
    beginnerNote: "🐋 Whaley金句：专业投资者死在追涨里，业余投资者死在抄底里。抄底前先问自己：如果继续跌20%，我敢不敢加仓？不敢就别抄。",
  },

  // ═══════════ 场景3: 防风险 — 对冲保护 ═══════════
  riskDefense: {
    id: "riskDefense",
    name: "防风险",
    emoji: "🛡️",
    tagline: "进攻赢得比赛，防守赢得冠军",
    whenToUse: "组合浮盈较大+市场处于高位+VIX<15(过度乐观)=需要买保险的时候。经济数据开始恶化、收益率曲线倒挂加深、信用利差扩大。",
    whenNotToUse: "市场已经大跌后追买保护——保护在需要之前买才便宜。牛市中途频繁对冲=不断流血。",

    factorRecipe: {
      core: [
        { factor: "LOW_VOL", name: "低波动率", weight: 30, reason: "牛市后期换低波动=降低下行参与度" },
        { factor: "BETA_LOW", name: "低Beta", weight: 25, reason: "Beta<0.8的股票在下跌市中跌得少" },
        { factor: "DIVIDEND_YIELD", name: "股息率", weight: 20, reason: "高股息提供下行缓冲——哪怕股价跌了还有分红" },
        { factor: "DEBT_EQUITY_LOW", name: "低杠杆", weight: 15, reason: "债务少的公司在衰退中能活下来" },
      ],
      accessory: [
        { factor: "HY_SPREAD", name: "高收益利差", weight: 5, reason: "HY利差突破500bp=信贷危机预警=立即加保护" },
        { factor: "VIX", name: "VIX恐慌指数", weight: 5, reason: "VIX<15=市场过度乐观=买便宜保护的窗口" },
      ],
      rejects: [
        { signal: "防御型公司ROE<0", reason: "保护不是垃圾堆——亏钱的公司跌得更多" },
        { signal: "低波动但流动性极差", reason: "危机来临时无法卖出的保护是假保护" },
      ],
    },

    steps: [
      { step: 1, title: "判断是否需要防御", action: "检查VIX(是否<15?)、信用利差(是否在扩大?)、仓位浮盈(是否>20%?)", tip: "三个信号全触发=该系安全带了" },
      { step: 2, title: "加载防风险模板", action: "一键调用低波动+低Beta+高股息+低杠杆", tip: "这4个因子的组合在2008/2020年分别跑赢大盘18%/12%" },
      { step: 3, title: "逐步置换", action: "不要一次性换仓——分4-6周逐步把高风险仓位换成防御仓位", tip: "剧烈调仓本身就是在制造新的风险" },
      { step: 4, title: "保留20%成长仓位", action: "全部换成防御=如果判断错误你会踏空", tip: "防御的目标是不被踢出局，不是不漏看每一次上涨" },
      { step: 5, title: "设定解除条件", action: "提前约定：VIX跌破20+信贷利差回到正常=逐步回到正常配置", tip: "没有退出计划的防御=永远防御=永远低回报" },
    ],

    riskWarning: "⚠️ 最大的防守风险不是市场没跌——是市场继续大涨而你躲在防御里踏空。2023-2024年的AI牛市中，低波动策略被大盘甩开了30%。防御不是永久状态。",
    expectedReturn: "在市场下跌时跑赢5-15% | 上涨时跑输3-8% | 建议防御仓位≤60%",
    beginnerNote: "🐋 新手最容易犯的错：大跌后想起防御。正确的防御是在阳光最灿烂的时候买伞——那时最便宜。",
  },

  // ═══════════ 场景4: 收息 — 现金奶牛 ═══════════
  dividendIncome: {
    id: "dividendIncome",
    name: "收息",
    emoji: "💵",
    tagline: "让公司给你发工资——稳定现金流的终极来源",
    whenToUse: "你需要稳定现金收入。市场处于震荡/熊市——高股息在下跌市有缓冲。利率处于高位或即将下降——降息利好高股息。",
    whenNotToUse: "你在寻求高成长——高股息公司通常成熟，增速低。极度牛市中高股息会严重跑输。",

    factorRecipe: {
      core: [
        { factor: "DIVIDEND_YIELD", name: "股息率", weight: 30, reason: "核心信号——但>7%反而是红旗" },
        { factor: "DIV_GROWTH", name: "股息增长", weight: 25, reason: "连续5年+增派息>高派息率。增长比绝对值重要" },
        { factor: "PAYOUT_RATIO", name: "派息率", weight: 20, reason: "30-60%=健康。>80%=不可持续。<20%=太小气" },
        { factor: "FCF_DIV", name: "自由现金流覆盖", weight: 15, reason: "FCF/股息>1.2=真金白银。FCF/股息<1=在借钱分红" },
      ],
      accessory: [
        { factor: "DEBT_EQUITY", name: "负债率", weight: 5, reason: "高负债的高股息是时空炸弹——利息和股息在抢同一笔现金" },
        { factor: "PROF_ROE", name: "ROE", weight: 5, reason: "ROE>10%=派息有利润支撑=可持续" },
      ],
      rejects: [
        { signal: "派息率>90%", reason: "几乎把所有利润都分出去了——公司没有任何钱做增长" },
        { signal: "股息率>10%", reason: "极度异常——市场在用价格告诉你即将砍息" },
        { signal: "连续2年减息", reason: "减息是致命的信任破坏。一旦开始减，往往不是一次性的" },
      ],
    },

    steps: [
      { step: 1, title: "明确收入目标", action: "你想每月收多少？比如每月$500=年$6000，按4%股息率=需要$15万本金", tip: "明确数字帮助你判断需要多高的股息率和多大规模" },
      { step: 2, title: "加载收息模板", action: "一键调用股息率+股息增长+派息率+FCF覆盖", tip: "按「股息质量」从高到低排序——质量>收益率" },
      { step: 3, title: "检查股息安全边际", action: "FCF/股息>1.2且派息率<60%且连续5年不降息", tip: "这三个条件同时满足=股息极大概率安全" },
      { step: 4, title: "分散到5-8个不同行业", action: "不要在同一个行业里拿超过15%的收息仓位", tip: "银行+电信+公用事业+消费+REITs是收息经典五件套" },
      { step: 5, title: "再投资还是取出？", action: "如果不急需用钱→股息再投资=复利奇迹。如果需要生活开支→取出。", tip: "每年6%股息+再投资=12年翻倍。取出=永远不翻倍。" },
    ],

    riskWarning: "⚠️ 收息的最大陷阱：①利率上行时高股息跌得最惨（因为它像债券）②股息陷阱——高收益率通常是砍息前的最后光辉③通胀侵蚀——5%股息在3%通胀下实际只有2%。",
    expectedReturn: "股息率4-6%+股价增值1-3%=总回报5-9% | 最大回撤-20% | 适合做核心仓位",
    beginnerNote: "🐋 收息是最适合长期睡觉的策略——买好、分散、关了App、半年看一次。收息不是用来交易的是用来收的。",
  },

  // ═══════════ 场景5: 捡便宜 — 深度价值 ═══════════
  deepValue: {
    id: "deepValue",
    name: "捡便宜",
    emoji: "🔍",
    tagline: "在没人要的垃圾堆里找被错杀的黄金——最有成就感但最耗心力的策略",
    whenToUse: "市场恐慌/板块抛弃/公司遭遇一次性冲击。PB<0.8,PE<行业均值60%,EV/EBITDA<7。你能承受持有一年以上不涨。",
    whenNotToUse: "你拿不住——深度价值最常见的结局是你买入后继续跌30%，你在最低点割了，然后它两年涨了三倍。🔪🩸",

    factorRecipe: {
      core: [
        { factor: "EV_EBITDA", name: "企业价值/EBITDA", weight: 25, reason: "最纯粹的价值度量——剔除资本结构和非现金影响" },
        { factor: "F_SCORE", name: "Piotroski F分数", weight: 25, reason: "深度价值必备——没有F-Score验证就是瞎子摸象" },
        { factor: "PB_LF", name: "市净率", weight: 20, reason: "PB<1=低于清算价值——但有形资产必须真实" },
        { factor: "Z_SCORE", name: "Altman Z分数", weight: 15, reason: "破产概率——深度价值第一件事：确定公司不会在涨之前先破产" },
      ],
      accessory: [
        { factor: "INSIDER_BUY", name: "内部人买入", weight: 10, reason: "管理层比任何人都了解资产真实价值——他们在打折时买入是终极确认" },
        { factor: "NET_CASH", name: "净现金/市值", weight: 5, reason: "净现金>市值30%=你在免费获得业务" },
      ],
      rejects: [
        { signal: "Z-Score<1.8", reason: "破产概率>30%——不对将死的公司做深度价值" },
        { signal: "F-Score<4", reason: "便宜的烂公司=该便宜" },
        { signal: "商业模式被颠覆", reason: "零售/报纸/煤炭——时代抛弃你的时候不会提前通知" },
      ],
    },

    steps: [
      { step: 1, title: "打开雷达", action: "筛选PB<1 + EV/EBITDA<7 + 市值>$1亿(太小没法玩)", tip: "先看价格再看质量——深度价值是反过来的" },
      { step: 2, title: "加载捡便宜模板", action: "一键调用EV/EBITDA+F-Score+PB+Z-Score+内部人信号", tip: "每个公司跑一遍，大概筛掉80%" },
      { step: 3, title: "深度体检", action: "Z-Score>3(安全)? F-Score>7(财务在改善)? 内部人在买?", tip: "三个都YES=这可能是真金。两YES一NO=再看看。一YES=再便宜也不碰" },
      { step: 4, title: "判断催化剂", action: "是什么让市场重新发现它的价值？新管理层？行业拐点？资产出售？回购？", tip: "没有催化剂的价值股=价值陷阱——市场可以无视它很久" },
      { step: 5, title: "小仓位试水+耐心等", action: "先用目标仓位的25%入场。等催化兑现或半年无进展则撤退。", tip: "深度价值最大的成本不是资金——是时间。你等得起吗？" },
    ],

    riskWarning: "⚠️ 深度价值最大的敌人是时间。学术回测中价值因子年化超额3-5%，但这是20年平均——其中可能有连续5-8年跑输（2017-2020价值因子跑输成长40%+）。如果你等不了5年，别碰。",
    expectedReturn: "长期年化超额3-8% | 最大回撤-35% | 建议仓位≤20% | 持有期≥18个月",
    beginnerNote: "🐋 新手千万别从深度价值开始——它是五个场景里最难执行的。先去试着追涨或收息，等你有过一次「抄底后继续跌30%但没卖最后翻倍」的经历，再考虑深度价值。",
  },

  // ═══════════ 场景包元数据 ═══════════
  meta: {
    packs: [
      {
        id: "chasing", name: "追涨", emoji: "🚀", difficulty: "中等",
        timeHorizon: "3-6个月", bestMarket: "趋势市/牛市", worstMarket: "震荡市/崩盘",
        tagline: "趋势是你的朋友",
      },
      {
        id: "dipBuying", name: "抄底", emoji: "🛒", difficulty: "中高",
        timeHorizon: "3-12个月", bestMarket: "恐慌后/板块轮动", worstMarket: "持续下跌/基本面恶化",
        tagline: "好公司遭遇坏价格",
      },
      {
        id: "riskDefense", name: "防风险", emoji: "🛡️", difficulty: "低",
        timeHorizon: "1-6个月", bestMarket: "高位/过度乐观", worstMarket: "牛市加速期(踏空)",
        tagline: "进攻赢比赛，防守赢冠军",
      },
      {
        id: "dividendIncome", name: "收息", emoji: "💵", difficulty: "低",
        timeHorizon: "3年+", bestMarket: "震荡/熊市/降息周期", worstMarket: "急速牛市/高成长泛滥",
        tagline: "让公司给你发工资",
      },
      {
        id: "deepValue", name: "捡便宜", emoji: "🔍", difficulty: "高",
        timeHorizon: "18个月+", bestMarket: "恐慌/熊市底部", worstMarket: "牛市(严重跑输)",
        tagline: "垃圾堆里找黄金",
      },
    ],

    loadingOrder: {
      title: "📦 一键场景包",
      subtitle: "Whaley 帮你配好了→选场景→调参数→下单",
      buttons: {
        chasing: "🚀 我追趋势",
        dipBuying: "🛒 我抄个好底",
        riskDefense: "🛡️ 我系安全带",
        dividendIncome: "💵 我收稳定息",
        deepValue: "🔍 我挖深价值",
      },
      customize: "🎛️ 自定义", 
    },

    comparison: {
      title: "五场景对比",
      rows: [
        { label: "难度", chasing: "⭐⭐⭐", dipBuying: "⭐⭐⭐⭐", riskDefense: "⭐⭐", dividendIncome: "⭐", deepValue: "⭐⭐⭐⭐⭐" },
        { label: "需要耐心", chasing: "低", dipBuying: "中高", riskDefense: "低", dividendIncome: "极高", deepValue: "极高" },
        { label: "最大回撤", chasing: "-30%", dipBuying: "-25%", riskDefense: "-15%", dividendIncome: "-20%", deepValue: "-35%" },
        { label: "持有期", chasing: "3-6月", dipBuying: "3-12月", riskDefense: "1-6月", dividendIncome: "3年+", deepValue: "18月+" },
        { label: "新手友好", chasing: "★★★★", dipBuying: "★★★", riskDefense: "★★★★★", dividendIncome: "★★★★★", deepValue: "★★" },
      ],
    },
  },

  // ── 工具方法 ──
  getPack(id: string) {
    const map: Record<string, any> = {
      chasing: this.chasing,
      dipBuying: this.dipBuying,
      riskDefense: this.riskDefense,
      dividendIncome: this.dividendIncome,
      deepValue: this.deepValue,
    };
    return map[id] ?? null;
  },

  getPackList() {
    return this.meta.packs;
  },

  getComparison() {
    return this.meta.comparison;
  },
};

export default FACTOR_SCENE_PACKS;
