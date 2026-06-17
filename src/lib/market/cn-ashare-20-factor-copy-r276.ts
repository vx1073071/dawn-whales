// ══ R276 QClaw Task 1: A股20因子人话文案 (3h) ══
// 对齐 ML 的 cn-ashare-factors.ts 20因子定义
// 交付: src/lib/market/cn-ashare-20-factor-copy-r276.ts
//
// 每个因子 = oneliner(一句话说人话) + description(什么时候信) + dontTrust(什么时候别信)
// 设计原则: 用A股散户日常语言，不翻译华尔街术语

export const CN_ASHARE_20_FACTOR_COPY = {

  // ══════ VALUE 价值 (5) ══════
  value: {
    title: "💰 估值类",
    subtitle: "这只股票贵不贵？",

    PE_TTM: {
      id: "PE_TTM",
      name: "市盈率",
      emoji: "📊",
      oneliner: "每股价格÷每股盈利——几年能回本",
      description: "PE_TTM=滚动12个月市盈率。PE越低=回本越快。但不同行业PE不可比——银行天然低PE（5-15倍），科技天然高PE（30-100倍）。比较PE时请在同行业内。",
      ranges: [
        { condition: "PE<0", meaning: "公司亏损——PE无意义", color: "dark" },
        { condition: "PE<行业均值×0.5", meaning: "极度低估——可能有大坑（财报造假/行业衰退）", color: "red" },
        { condition: "PE在行业均值0.5-0.8倍", meaning: "低估——值得研究原因", color: "green" },
        { condition: "PE在行业均值0.8-1.2倍", meaning: "合理估值", color: "neutral" },
        { condition: "PE>行业均值×2", meaning: "严重高估——或高增长预期（看净利润增速是否匹配）", color: "red" },
      ],
      dontTrust: "周期股（钢铁/煤炭/航运）在盈利高点PE极低——不是因为便宜，是因为盈利马上要暴跌。周期性行业应该反过来用PE：PE极高甚至亏损时买，PE极低时卖。",
      useWith: ["净利润增速", "行业PE分位", "ROE"],
    },

    PB_LF: {
      id: "PB_LF",
      name: "市净率",
      emoji: "📚",
      oneliner: "股价÷每股净资产——花1块钱买几块钱的资产",
      description: "PB_LF=最新财报每股净资产对应的市净率。破净（PB<1）=股价比公司净资产还便宜。银行、钢铁、地产容易破净。轻资产公司（互联网、软件）PB意义不大——它们的价值不在资产表上。",
      ranges: [
        { condition: "PB<0.5", meaning: "深度破净——可能有大问题（坏账/资产虚高）", color: "dark" },
        { condition: "PB 0.5-0.8", meaning: "显著低估——优质破净股的反转机会", color: "green" },
        { condition: "PB 0.8-1.5", meaning: "合理区间", color: "neutral" },
        { condition: "PB 1.5-3", meaning: "估值偏高", color: "yellow" },
        { condition: "PB>3", meaning: "轻资产模式/品牌溢价——PB单独看无意义", color: "neutral" },
      ],
      dontTrust: "某些公司净资产里70%是商誉和无形资产——这些减值时PB会突然跳升。看PB前先看一眼资产负债表的「商誉占比」。商誉>净资产30%的公司，别只看PB。",
      useWith: ["ROE", "商誉占比", "分红率"],
    },

    DIVIDEND: {
      id: "DIVIDEND",
      name: "股息率",
      emoji: "💵",
      oneliner: "每年分红÷股价——不管涨跌都能拿到的钱",
      description: "股息率=近12个月每股分红÷当前股价。A股分红率普遍低于港股。>3%算高股息。但高股息未必是好公司——可能是股价跌太多了分母变小，或者公司把老本一次性分掉。",
      ranges: [
        { condition: "分红率>5%", meaning: "超高股息——查看是否为一次性分红或股价暴跌导致", color: "yellow" },
        { condition: "分红率3-5%+连续3年递增", meaning: "真·高股息——A股里的稀缺品", color: "green" },
        { condition: "分红率1.5-3%", meaning: "正常水平", color: "neutral" },
        { condition: "分红率0-1.5%", meaning: "低分红——成长型公司再投资", color: "neutral" },
        { condition: "不分红", meaning: "铁公鸡——A股很多公司盈利可观但不分红", color: "red" },
      ],
      dontTrust: "分红前一天买入，分红后卖出——你亏钱。除权除息后股价会跳空下跌，加上红利税（持有<1月20%税），短线博分红是负和博弈。",
      useWith: ["分红连续性", "每股收益", "自由现金流"],
    },

    EV_EBITDA: {
      id: "EV_EBITDA",
      name: "企业价值倍数",
      emoji: "🏢",
      oneliner: "买下整个公司（含债务）需要多少年经营利润",
      description: "EV/EBITDA=(市值+净债务)÷息税折旧摊销前利润。比PE更干净——PE被资本结构（负债率）和折旧政策扭曲，EV/EBITDA不受这些影响。跨国比较用这个更好。",
      dontTrust: "软件/互联网公司的折旧摊销极低——EBITDA和净利润差不多，EV/EBITDA≈PE，没必要单独看。重资产行业才有增量信息。",
      useWith: ["净利润", "负债率", "资本支出/折旧比"],
    },

    PS_TTM: {
      id: "PS_TTM",
      name: "市销率",
      emoji: "🛒",
      oneliner: "市值÷营收——每1块钱营收市场愿意出多少钱",
      description: "PS_TTM=滚动12个月市销率。对亏损公司唯一有意义的估值指标——没有盈利时PE无意义，但营收不会骗人。SaaS/创新药早期公司看PS。",
      ranges: [
        { condition: "PS<1", meaning: "极度低估——或者行业在萎缩", color: "green" },
        { condition: "PS 1-3", meaning: "合理", color: "neutral" },
        { condition: "PS 3-10", meaning: "成长型估值——需要营收增速>30%支撑", color: "yellow" },
        { condition: "PS>10", meaning: "高估值——市场在赌未来爆发。营收增速必须>50%", color: "red" },
      ],
      dontTrust: "毛利率极低的公司（如贸易商<5%毛利）PS再低也没用——营收再多但赚不到钱。PS必须和毛利率一起看。毛利率<15%的公司，PS没有参考价值。",
      useWith: ["毛利率", "营收增速", "净利率"],
    },
  },

  // ══════ GROWTH 成长 (3) ══════
  growth: {
    title: "🚀 成长类",
    subtitle: "这家公司跑得快不快？",

    REVENUE_YOY: {
      id: "REVENUE_YOY",
      name: "营收增速",
      emoji: "📈",
      oneliner: "今年营收比去年增长了多少——公司是做大了还是在萎缩",
      description: "营收同比增长率=（今年营收-去年同季营收）÷去年同季营收。营收增长是真实增长——不像利润可以被会计手法美化。连续3季加速增长比单季暴增更有意义。",
      ranges: [
        { condition: "增速>30%且加速", meaning: "高速成长期——最值得关注的阶段", color: "green" },
        { condition: "增速15-30%", meaning: "稳健增长——白马股特征", color: "neutral" },
        { condition: "增速0-15%", meaning: "低速增长——可能已成熟期", color: "yellow" },
        { condition: "增速为负", meaning: "营收萎缩——红色警报", color: "red" },
      ],
      dontTrust: "靠并购带来的营收增长——有机增长才值钱。收购来的营收可能明年就没。看营收增速时，扣除并购贡献后的「有机增速」才是真增速。",
      useWith: ["净利润增速", "应收账款增速", "毛利率趋势"],
    },

    EARNINGS_YOY: {
      id: "EARNINGS_YOY",
      name: "盈利增速",
      emoji: "💹",
      oneliner: "今年赚的比去年多了多少——利润能跟上营收的步伐吗",
      description: "净利润同比增长率。盈利增速>营收增速=利润率在提升（好信号）。盈利增速<营收增速=增收不增利——可能是降价抢市场或成本暴增。",
      dontTrust: "一次性收益（卖资产/政府补贴/投资收益）拉高盈利——剔除这些后看「扣非净利润增速」。A股很多公司靠卖子公司保持盈利增长，这种增长不可持续。",
      useWith: ["营收增速", "扣非净利润", "毛利率趋势"],
    },

    ROE_TTM: {
      id: "ROE_TTM",
      name: "ROE",
      emoji: "🏆",
      oneliner: "股东投进去的钱一年赚了多少——巴菲特最看重的指标",
      description: "ROE=净利润÷股东权益。持续>15%的公司=优质公司。<5%的=不值得长期持有。ROE是杜邦分析的核心——可以用净利率×周转率×杠杆拆解。",
      ranges: [
        { condition: "ROE>20%", meaning: "极优秀——茅台/海天级别", color: "green" },
        { condition: "ROE 15-20%", meaning: "优秀——值得深入研究", color: "green" },
        { condition: "ROE 10-15%", meaning: "及格", color: "neutral" },
        { condition: "ROE 5-10%", meaning: "偏低——缺乏竞争力", color: "yellow" },
        { condition: "ROE<5%", meaning: "价值毁灭——投入资金赚不到钱", color: "red" },
      ],
      dontTrust: "高杠杆推高的ROE——借钱能放大ROE但增加破产风险。ROE>20%但负债率>70%的公司，高ROE是借来的，不是赚来的。看ROE时一定要同时看负债率。",
      useWith: ["负债率", "净利率", "总资产周转率"],
    },
  },

  // ══════ MOMENTUM 动量 (2) ══════
  momentum: {
    title: "⚡ 动量类",
    subtitle: "这股票目前在涨还是在跌？",

    MOM_1M: {
      id: "MOM_1M",
      name: "1月动量",
      emoji: "🏃",
      oneliner: "最近1个月的涨跌——短期趋势在往哪走",
      description: "近20个交易日涨跌幅。>10%=近期强势。<0%=近期弱势。A股短期动量比美股更有效——A股散户多，追涨杀跌现象严重，趋势延续性强。",
      dontTrust: "连续涨停的妖股——动量虽强但完全由游资情绪驱动，随时可能天地板。20日涨幅>50%的股票追入，亏钱的概率远大于继续涨。",
      useWith: ["成交量", "3月动量", "波动率"],
    },

    MOM_3M: {
      id: "MOM_3M",
      name: "3月动量",
      emoji: "🏇",
      oneliner: "最近3个月涨了多少——中期趋势的强度",
      description: "近60个交易日涨跌幅。3月动量为正=处于上升通道。A股研究显示3-12月动量效应最强（Jegadeesh & Titman经典因子）。3月动量>20%且基本面配合=可能的主升浪。",
      dontTrust: "3月涨幅>100%的股——大概率是概念炒作而非基本面驱动。概念退潮后跌回起点是A股常态。不要追3个月翻倍的股。",
      useWith: ["1月动量", "成交量放大", "行业板块动量"],
    },
  },

  // ══════ SIZE 规模 (1) ══════
  size: {
    title: "📏 规模类",
    subtitle: "这个公司有多大？",

    MARKET_CAP: {
      id: "MARKET_CAP",
      name: "市值规模",
      emoji: "🏗️",
      oneliner: "公司总价值——越大越稳，越小越猛",
      description: "A股总市值。>1000亿=大盘蓝筹（稳但慢）。100-1000亿=中盘（性价比最高）。<100亿=小盘（弹性大风险大）。<30亿=微盘（壳价值+炒作标的）。",
      ranges: [
        { condition: ">1000亿", meaning: "大盘——流动性好，机构重仓，波动低", color: "neutral" },
        { condition: "100-1000亿", meaning: "中盘——机构+游资都能玩，性价比高", color: "green" },
        { condition: "30-100亿", meaning: "小盘——弹性大，游资最爱，波动大", color: "yellow" },
        { condition: "<30亿", meaning: "微盘——风险极高，可能有退市/ST风险", color: "red" },
      ],
      dontTrust: "小市值=高收益（规模因子）在全面注册制后可能失效——小公司退市风险比以前大多了。以前的「小市值策略」赚的是壳价值和借壳预期，注册制后壳不值钱了。",
      useWith: ["PE", "日均成交额", "机构持仓比例"],
    },
  },

  // ══════ VOLATILITY 波动 (2) ══════
  volatility: {
    title: "🌊 波动类",
    subtitle: "这股票蹦跶得厉害吗？",

    VOL_20D: {
      id: "VOL_20D",
      name: "20日波动率",
      emoji: "📉",
      oneliner: "最近20天的波动幅度——稳还是野",
      description: "20个交易日年化波动率。<20%=低波动（银行/公用事业）。20-40%=正常。>40%=高波动（题材股/次新股）。A股整体波动率天然高于美股。",
      dontTrust: "次新股（上市不到1年）的波动率没有统计意义——样本太少。刚上市半年的股票不要看波动率指标，看筹码分布和换手率更有用。",
      useWith: ["Beta", "最大回撤", "换手率"],
    },

    BETA_60D: {
      id: "BETA_60D",
      name: "Beta系数",
      emoji: "🎢",
      oneliner: "大盘涨1%这股票涨多少——跟大盘的关联度",
      description: "60日Beta=个股收益率对沪深300收益率的回归斜率。Beta>1=放大市场波动（进攻型）。Beta<1=比大盘稳（防御型）。Beta<0=跟大盘反向（极少见）。",
      ranges: [
        { condition: "Beta>1.5", meaning: "高Beta——大盘涨你赚更多，大盘跌你亏更惨", color: "red" },
        { condition: "Beta 1-1.5", meaning: "略高于大盘——适合牛市", color: "yellow" },
        { condition: "Beta 0.5-1", meaning: "略低于大盘——攻守兼备", color: "green" },
        { condition: "Beta<0.5", meaning: "低Beta——适合熊市防御。公用事业/红利股", color: "neutral" },
      ],
      dontTrust: "Beta是历史数据——市场风格切换时Beta会变。2020年的高Beta科技股到2021年可能变成低Beta。每季度应该重新评估Beta。",
      useWith: ["波动率", "最大回撤", "行业Beta"],
    },
  },

  // ══════ LIQUIDITY 流动性 (2) ══════
  liquidity: {
    title: "💧 流动类",
    subtitle: "这股票能随时买入卖出吗？",

    TURNOVER_RATE: {
      id: "TURNOVER_RATE",
      name: "换手率",
      emoji: "🔄",
      oneliner: "当天有多少比例的股票换了主人——筹码在谁手里换",
      description: "日换手率=成交量÷流通股本。<1%=交投清淡。3-8%=正常。>10%=异常活跃。>20%=极热——筹码在短线客之间高速换手。A股换手率全球最高。",
      ranges: [
        { condition: "换手率<1%", meaning: "没人关注——僵尸股", color: "dark" },
        { condition: "换手率1-3%", meaning: "正常清淡", color: "neutral" },
        { condition: "换手率3-8%", meaning: "活跃——A股常态", color: "green" },
        { condition: "换手率8-15%", meaning: "非常活跃——短线资金密集", color: "yellow" },
        { condition: "换手率>20%", meaning: "过度活跃——可能是出货/对倒", color: "red" },
      ],
      dontTrust: "低位高换手=主力吸筹。高位高换手=主力出货。同一指标在不同位置含义完全相反。换手率必须结合股价位置和趋势判断。",
      useWith: ["股价位置", "成交量", "主力资金流向"],
    },

    AMPLITUDE_5D: {
      id: "AMPLITUDE_5D",
      name: "5日振幅",
      emoji: "〰️",
      oneliner: "最近5天最高价到最低价的幅度——蹦跶得多厉害",
      description: "5日振幅=(5日最高-5日最低)÷5日均价。A股T+1交易和涨跌停制度让振幅有特殊意义。5日振幅>20%=波动剧烈。<5%=横盘整理。",
      dontTrust: "极少成交量的高振幅——可能是主力左右手对倒制造活跃假象吸引散户。高振幅+低换手=虚假振幅。真实振幅应该伴随成交量放大。",
      useWith: ["换手率", "成交量", "涨跌停天数"],
    },
  },

  // ══════ FLOW 资金流 (3) ══════
  flow: {
    title: "💰 资金类",
    subtitle: "聪明的钱在进还是出？",

    NORTHBOUND: {
      id: "NORTHBOUND",
      name: "北向资金",
      emoji: "🌏",
      oneliner: "外资通过沪港通/深港通买A股——「聪明钱」的方向",
      description: "北向资金=外资净买入A股金额。北向连续5日净买入+A股成交额>1万亿=A股最可靠的做多信号。北向资金持仓偏好：消费（白酒/食品）+新能源+金融。",
      ranges: [
        { condition: "连续5日净买入>100亿", meaning: "外资强烈看多A股——可信度最高的牛市信号", color: "green" },
        { condition: "连续净买入", meaning: "外资温和看多", color: "green" },
        { condition: "买入卖出交替", meaning: "外资观望——没有明确方向", color: "neutral" },
        { condition: "连续净卖出", meaning: "外资撤退——需要警惕但不一定暴跌", color: "yellow" },
        { condition: "单日净卖出>100亿", meaning: "外资恐慌出逃——可能触发踩踏", color: "red" },
      ],
      dontTrust: "北向资金单日大幅流入不一定是真外资——可能是境内资金绕道香港加杠杆回流的「假外资」。连续5日的趋势比单日更可靠。",
      useWith: ["两融余额", "成交量", "人民币汇率"],
    },

    INSTITUTION: {
      id: "INSTITUTION",
      name: "机构持仓",
      emoji: "🏦",
      oneliner: "基金/保险/社保持了多少——跟着机构有肉吃",
      description: "十大流通股东中机构持股占比。机构占比>30%=机构重仓（价格相对稳定但也更慢涨）。新进机构+机构增持>减持=正面信号。社保基金新进=最值得关注的信号。",
      dontTrust: "公募基金抱团股（机构持仓>50%）——机构一致性太强时没有新买家，容易出现踩踏。2021年白酒、2022年新能源都是前车之鉴。机构持仓太集中的股反而不安全。",
      useWith: ["股东户数变化", "北向资金", "融资余额"],
    },

    MAJOR_FLOW_5D: {
      id: "MAJOR_FLOW_5D",
      name: "主力资金",
      emoji: "🐋",
      oneliner: "大单（>20万/50万）的净买入——大资金在干什么",
      description: "5日主力净流入=超大单(>100万)+大单(20-100万)净买入。正数=主力在买。负数=主力在卖。注意：主力买入≠一定涨——主力也会被套。",
      ranges: [
        { condition: "连续5日净流入+股价横盘", meaning: "主力悄悄建仓——最值得关注的信号", color: "green" },
        { condition: "净流入+股价上涨", meaning: "主力加仓追涨——趋势延续", color: "green" },
        { condition: "净流入小", meaning: "主力观望", color: "neutral" },
        { condition: "净流出+股价横盘", meaning: "主力减仓——不看好后市", color: "yellow" },
        { condition: "净流出+股价下跌", meaning: "主力出货——远离", color: "red" },
      ],
      dontTrust: "软件把大单拆成小单——统计的大单净买未必是真的。主力会用拆单软件把大单伪装成小单。所以「主力净流出」未必是真的——结合盘口观察更可靠。",
      useWith: ["盘口大单", "龙虎榜", "大宗交易"],
    },
  },

  // ══════ MACRO 宏观 (1) ══════
  macro: {
    title: "🌐 宏观类",
    subtitle: "大环境对这股票有什么影响？",

    PMI_SENSITIVITY: {
      id: "PMI_SENSITIVITY",
      name: "PMI敏感度",
      emoji: "🏭",
      oneliner: "PMI数据好坏对这股票影响多大——宏观经济周期在你持仓上的投影",
      description: "PMI敏感度=个股超额收益对中国制造业PMI的回归Beta。正值=PMI好股价涨（周期股典型）。负值=PMI差反而涨（防御型/逆周期）。接近0=不受PMI影响。",
      dontTrust: "PMI是月度数据——信息有滞后。等到PMI公布时大盘已经反应完了。PMI敏感度更适合中长期配置而非短期交易。用来判断你的持仓在经济周期中的位置。",
      useWith: ["行业周期判断", "GDP敏感度", "利率敏感度"],
    },
  },

  // ══════ SENTIMENT 情绪 (1) ══════
  sentiment: {
    title: "🎭 情绪类",
    subtitle: "游资和散户在关注什么？",

    DRAGON_TIGER: {
      id: "DRAGON_TIGER",
      name: "龙虎榜信号",
      emoji: "🐉",
      oneliner: "龙虎榜上谁在买——著名游资还是机构席位",
      description: "龙虎榜5日净买入额+上榜次数。机构席位买入=中长期看好。知名游资买入=短线博弈（章盟主/赵老哥/方新侠等）。机构和游资同时买入=最强合力信号。",
      ranges: [
        { condition: "机构席位净买+游资净买", meaning: "机构和游资共振——最强短线+中线信号", color: "green" },
        { condition: "机构净买+游资净卖", meaning: "机构接盘游资——可能是洗盘后的开始", color: "green" },
        { condition: "游资净买+机构净卖", meaning: "游资在炒，机构在跑——纯概念炒作，快进快出", color: "yellow" },
        { condition: "机构+游资都净卖", meaning: "聪明钱共识出逃——远离", color: "red" },
      ],
      dontTrust: "龙虎榜只披露当日涨跌幅偏离>7%或换手率>20%的股票——没上榜不代表没有机构在买卖。而且龙虎榜数据次日才公布，有1天延迟。不要把龙虎榜当实时信号用。",
      useWith: ["主力资金", "北向资金", "换手率"],
    },
  },
};

// ── 20因子全量列表 ──
export const CN_ASHARE_20_LIST = [
  // Value 5
  "PE_TTM", "PB_LF", "DIVIDEND", "EV_EBITDA", "PS_TTM",
  // Growth 3
  "REVENUE_YOY", "EARNINGS_YOY", "ROE_TTM",
  // Momentum 2
  "MOM_1M", "MOM_3M",
  // Size 1
  "MARKET_CAP",
  // Volatility 2
  "VOL_20D", "BETA_60D",
  // Liquidity 2
  "TURNOVER_RATE", "AMPLITUDE_5D",
  // Flow 3
  "NORTHBOUND", "INSTITUTION", "MAJOR_FLOW_5D",
  // Macro 1
  "PMI_SENSITIVITY",
  // Sentiment 1
  "DRAGON_TIGER",
];

// ── 快速查找 ──
export function getFactorCopy(id: string) {
  for (const cat of Object.values(CN_ASHARE_20_FACTOR_COPY)) {
    for (const [key, val] of Object.entries(cat)) {
      if (typeof val === 'object' && val !== null && 'id' in val && (val as any).id === id) {
        return val;
      }
    }
  }
  return null;
}

export default CN_ASHARE_20_FACTOR_COPY;
