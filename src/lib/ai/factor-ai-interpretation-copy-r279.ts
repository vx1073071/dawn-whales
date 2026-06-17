// ══ R279 QClaw Task 1: 因子AI解读文案 (3h) ══
// 交付: src/lib/ai/factor-ai-interpretation-copy-r279.ts
//
// 覆盖: AI解读的完整话术系统——从触发到解读到后续引导
// 三种解读模式 + 解读模板 + 动画文案 + 空状态 + 失败处理

export const FACTOR_AI_INTERPRETATION_COPY = {

  // ═══════════ 核心人格: Whaley的因子解读身份 ═══════
  persona: {
    title: "🐋 Whaley 因子解读师",
    intro: "我是鲸灵，你的因子量化翻译官。",
    tagline: "把数学变成决策——不讲行话，只讲真话。",
  },

  // ═══════════ 解读模式选择 ═══════
  modes: {
    academic: {
      id: "academic",
      name: "学术模式",
      icon: "🎓",
      label: "严谨 | 数据驱动 | 适合量化老手",
      description: "学术模式会给你：因子定义→学术证据→统计属性→回测表现。不说人话，纯数据。",
      trigger: "当你说「给我数据」「IC是多少」「统计上有效吗」时用这个模式。",
      preview: "这个因子的12月滚动IC均值0.038，夏普0.62，多头超额3.2%。",
    },
    easy: {
      id: "easy",
      name: "人话模式",
      icon: "💬",
      label: "通俗 | 白话 | 适合新手",
      description: "人话模式会给你：这个因子在说什么→你什么时候应该信它→什么时候应该把它当噪音。用大白话。",
      trigger: "当你说「用大白话」「帮我理解」「小白第一次用」时用这个模式。",
      preview: "这东西衡量的是大家抢筹的程度——人气旺的股票短期确实容易涨，但千万别在东西贵了的时候还追。",
    },
    actionable: {
      id: "actionable",
      name: "动手模式",
      icon: "⚡",
      label: "落地 | 可操作 | 适合直接派",
      description: "动手模式直接告诉你：当前信号是什么→你该做什么检查→什么时候该买/卖→历史胜率是多少。不废话。",
      trigger: "当你说「该怎么操作」「我要动手」「给建议」时用这个模式。",
      preview: "当前ROE因子信号：强。步骤——①检查是否是周期股(周期顶部ROE最高=拐点)；②如果非周期，过去20年中ROE选股的胜率是62%。",
    },
    auto: {
      id: "auto",
      name: "智能模式",
      icon: "🤖",
      label: "Whaley帮选 | 默认",
      description: "Whaley会根据你的使用习惯和当前市场状态，自动选最合适的解读方式和深度。新用户默认人话模式，老手默认学术模式。",
    },
  },

  // ═══════════ 解读生成过程动画 (用户等待时看到) ═══════
  process: {
    headline: "🐋 Whaley 正在解读这个因子...",
    steps: [
      { id: "load", text: "加载因子历史数据...", tips: "这个因子有15年历史，60万+数据点" },
      { id: "clean", text: "清洗异常值和停牌数据...", tips: "剔除极端值可以减少假信号" },
      { id: "calc", text: "计算当前信号强度和IC...", tips: "IC>0.03就算有效因子" },
      { id: "context", text: "检查当前市场环境...", tips: "牛市的动量因子和熊市的表现完全不同" },
      { id: "compare", text: "与同类因子交叉验证...", tips: "多个因子指向同一个方向时置信度更高" },
      { id: "write", text: "生成你的专属解读...", tips: "🤫" },
    ],
    final: "✅ 解读完成！",
    fast: "⚡ 这么快？Whaley 已经记住这个因子的画像了。",
  },

  // ═══════════ AI解读正文模板 ═══════
  template: {
    // 通用结构
    sections: {
      overview: {
        title: "📌 一句话总结",
        maxChars: 120,
        hint: "在120字内把因子的核心说清楚",
      },
      signal: {
        title: "📊 当前信号",
        template: "这个因子现在对{code}的判断是**{signal}**。它比过去{percentile}的时间更{positive_or_negative}。",
        signalLevels: {
          strongPositive: "强正——历史上该信号下未来3月平均超额+{pct}%",
          positive: "偏正——方向有利但力度一般",
          neutral: "中性——这个因子目前对方向没有明确偏向",
          negative: "偏负——方向不利",
          strongNegative: "强负——历史上该信号下未来3月平均超额-{pct}%",
        },
      },
      evidence: {
        title: "🔬 学术证据",
        template: "这个因子在学术文献中{evidence_quality}。",
        levels: {
          strong: "证据很强——多个独立研究(Jegadeesh-Titman 1993, Fama-French 2015等)确认了其有效性。过去20年回测中，多头组合年化超额{ann_excess}%。",
          moderate: "证据中等——学术上基本确认但在特定市场/时期效果不一致。",
          weak: "证据较弱——学术上存在争议。相关性存在但因果关系不明确。",
          context: "效果高度依赖市场和宏观环境——不是总有效。",
        },
      },
      blindSpot: {
        title: "🚫 什么时候别信它",
        hint: "这是Whaley觉得最有价值的部分——知道什么时候不看一个因子，比知道什么时候看它更难。",
        template: "⚠️ **{factor_name}最容易骗人的时候：**",
        examples: [
          "PE_TTM: 周期股PE最低的时候恰恰是盈利最高点，马上就要拐头向下了。钢铁股PE<5时反而是卖掉的时候。",
          "Momentum: 动量在波动率突然飙升时会崩盘(Momentum Crash)。2009年3月动量因子一个月跌了-46%。",
          "High ROE: ROE极高(>50%)的公司常常在借债推ROE——杠杆越高，ROE越高，风险越高。",
          "Dividend Yield: 股息率高得不正常的通常是股息即将被削减的公司。高息陷阱。",
          "Low Vol: 低波动在升息周期表现好，但在降息周期往往跑输。现在处于{rate_cycle}周期。",
        ],
      },
      companion: {
        title: "🤝 搭档因子",
        template: "单靠{primary_factor}不够，Whaley建议同时看：",
        hint: "多个因子同时指向同一方向=信噪比显著提升",
        pairs: [
          "PE + ROE → 便宜且赚钱才是真便宜。低PE高ROE=价值发现。低PE低ROE=价值陷阱。",
          "Momentum + Turnover → 高换手率的高动量=可能是过度拥挤，低换手率的高动量=真实趋势。",
          "Volatility + Beta → 高波动低Beta=纯赌博。高波动高Beta=跟随市场。",
          "Short Interest + Analyst Revision → 高卖空+上调分析师=轧空候选。高卖空+下调=真的在恶化。",
        ],
      },
      action: {
        title: "🖐️ 可以做的事",
        template: "基于当前信号，你可以：",
        checks: [
          "检查该信号是否与历史最高/最低值一致（极值不可持续的概率大）",
          "用搭档因子交叉验证（单一信号容易被市场噪音打脸）",
          "确认当前市场环境与因子最优环境是否匹配",
          "查看该因子的近期胜率——连续赢/输后可能均值回归",
        ],
      },
      disclaimer: {
        text: "⚡ 因子信号是概率，不是保证。Whaley 永远无法预测未来，只能给你历史上相似情况的结果。最终决策权在你手中。",
      },
    },
  },

  // ═══════════ 因子卡片的AI解读入口 ═══════════
  entryPoints: {
    factorCard: {
      hoverText: "🐋 Whaley 解读这个因子",
      buttonLabel: "AI解读",
      emptyState: "还没有解读过。点我试试？第一次免费。",
      retryPrompt: "上次解读过。当前信号已更新，重新解读？",
    },
    quickRead: {
      title: "⚡ 三秒速读",
      sentences: [
        "本质：{oneliner}",
        "现状：当前{signal}。",
        "结论：{verdict}。",
      ],
    },
    deepDive: {
      title: "📖 深度解读",
      prompt: "点击展开 AI 的完整分析",
    },
  },

  // ═══════════ Whaley的友好提醒 ═══════════
  reminders: {
    firstTime: "🐋 第一次用因子解读？Whaley从头给你讲：每个因子都是一个放大镜，帮你看到财报和K线里埋着的规律。但没有一个放大镜能看清全部——需要多个一起看。",
    overuse: "🐋 你今天已经看了{count}个因子的解读了。Whaley提醒你——看太多因子容易「分析瘫痪」。优中选优，3-5个核心因子够用了。",
    marketExtreme: "🐋 当前市场处于极端状态（{extreme_market_condition}）。在这种时候，大多数因子的统计规律都会暂时失效。Whaley建议这时更关注仓位和风险管理，而不是选股。",
    afterCrash: "🐋 经历过大跌后最容易冲动——想把所有因子都拉出来验证一遍。深呼吸。Whaley见过的：大跌后第一周做的决策，80%都是一周后会后悔的。",
  },

  // ═══════════ 错误和边缘状态 ═══════════
  edgeCases: {
    loading: {
      title: "🐋 Whaley 在算了...",
      message: "这个因子数据量大（{dataPoints}个数据点），给我几秒。趁现在：你知道这个因子最早是谁发现的吗？",
      funFacts: [
        "动量效应是 Jegadeesh 和 Titman 在1993年正式记录的。但100年前的交易员早就知道了。",
        "Fama 和 French 用了几十年才承认ROE比PB更有效。学术界的进步速度比你想象的慢。",
        "Amihud 非流动性指标是最简单的微观结构因子——只需要每天的收益率和成交额，但效果出乎意料的好。",
        "52周高点效应最初被学者当作「投资者不理性」的证据，后来发现只是对信息反应不足。",
      ],
    },
    noData: {
      title: "📭 暂无足够数据",
      message: "这个因子的历史数据不够长（需要至少{minYears}年的数据才能给出有意义的解读）。Whaley 大忌：用不够的数据做判断。再等等。",
    },
    lowIC: {
      title: "🤨 这个因子最近不太行",
      message: "最近{months}个月的滚动IC降到了{ic}（通常需要>0.03才算有效）。因子有失效的迹象——可能是市场结构变了，可能是暂时性均值回归。Whaley 建议先把它挪到观察区，不要现在押注。",
    },
    error: {
      title: "💥 Whaley 卡住了",
      message: "数据抽取出问题了。这不是你的问题——是基础设施的问题。等几分钟再试，或者先看看其他因子。",
      retryButton: "再试一次",
    },
    paid: {
      freeRemaining: "你还剩{count}次免费解读。之后每次解读消耗1 USDT积分。",
      costNotice: "本次解读将消耗 1 USDT。结果不满意？不扣费。",
      afterCost: "已使用 1 USDT 积分。这是 Whaley 的第{n}次分析，质量只会越来越好。",
    },
  },

  // ═══════════ 解读后的追问建议 ═══════════
  followUp: {
    title: "💡 试试追问 Whaley：",
    suggestions: [
      "这个因子在什么市场环境下表现最好/最差？",
      "和 {companion_factor} 一起看，信号会变强还是变弱？",
      "最近3年的表现和15年全历史有区别吗？",
      "这个信号在上一次经济衰退时准确吗？",
      "适合长期持有(>1年)还是波段操作(<3个月)？",
    ],
  },

  // ── 工具方法 ──
  getBlindSpot(factorId: string): string {
    const map: Record<string, string> = {
      PE_TTM: "周期股PE最低的时候恰恰是盈利最高点，马上就要拐头向下了。钢铁股PE<5时反而是卖掉的时候。",
      PB_LF: "轻资产公司(科技/服务)的PB天然高，因为真正的资产(人/品牌/数据)不计入账面。用PB衡量Google会错过一切。",
      ROE_TTM: "高ROE=高杠杆=高风险。ROE>50%的公司要学会问：这是业务强还是负债高？用杜邦分解看一下。",
      DIVIDEND_YIELD: "股息率高得不正常的通常是股息即将被削减的公司。高息陷阱。AT&T 2020年之前股息率8%→砍半后股价反而涨了。",
      MOM_12M1M: "动量在波动率突然飙升时会崩盘。2009年3月、2020年3月动量因子暴跌。你需要一个「崩盘概率」指标作为刹车。",
      IDIO_VOL: "高特质波动≠高回报——学术上叫「波动率之谜」。买彩票的人多了，彩票的价格就贵了，回报期望反而低。",
      SHORT_INTEREST: "高卖空比可以两种完全相反的解读：①做空者在正确做空(该卖)②做空者在过度集中(轧空候选)。不看理由就看比例=猜硬币。",
      EV_EBITDA: "对高折旧的重工业企业，EBITDA是失真的——折旧是真实成本。用EBITDA评估航空/物流=忽略了飞机/卡车的真实损耗。",
      AMIHUD: "Amihud在小盘股有效，在大盘股基本没信号(大盘几乎不可能有流动性溢价)。不要把一个因子用在不合适的池子里。",
    };
    return map[factorId] || "Whaley暂时没有这个因子的特定盲区记录——但不代表它没有。永远不要只听一个因子的话。";
  },

  getProcessPhrase(): string {
    const pool = [
      "好的，让我看看这个因子在说什么...",
      "嗯，这个因子最近的表现有点意思...",
      "数据在说话，让我翻译一下...",
      "等等，这里有个细节值得注意...",
      "好，我整理一下思路...",
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  },
};

export default FACTOR_AI_INTERPRETATION_COPY;
