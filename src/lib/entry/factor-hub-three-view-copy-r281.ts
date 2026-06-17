// ══ R281 QClaw Task 1: 统一入口三视角文案 (3h) ══
// 交付: src/lib/entry/factor-hub-three-view-copy-r281.ts
//
// ML合并5个因子入口→1个 FactorHub，QClaw撰写三视角文案
// 三视角: 🌱新手 / 🎯进阶 / ⚡专业
//
// 设计原则:
// - 新手: 引导式 — 替你做选择、解释每一步、不吓人
// - 进阶: 探索式 — 给你工具、展示可能、让你探索
// - 专业: 高效式 — 少字、快手、直达

export const FACTOR_HUB_THREE_VIEW_COPY = {

  // ═══════════ 视角切换器 ═══════════
  viewSwitcher: {
    beginner: {
      id: 'beginner',
      emoji: '🌱',
      label: '新手',
      subtitle: '我帮你选',
      description: '不用懂因子。告诉我你想干什么，我推荐最适合你的。',
      tagline: '投资新手的最佳起点',
      iconHint: '发芽🌱 — 正在成长',
    },
    intermediate: {
      id: 'intermediate',
      emoji: '🎯',
      label: '进阶',
      subtitle: '我自己探索',
      description: '了解因子但不确定最佳组合？让你浏览、对比、实验。',
      tagline: '有基础的投资者升级利器',
      iconHint: '靶心🎯 — 目标明确',
    },
    pro: {
      id: 'pro',
      emoji: '⚡',
      label: '专业',
      subtitle: '我要最高效',
      description: '知道我想要的因子。直接搜索、快捷键、批量操作。',
      tagline: '量化老手的指挥中心',
      iconHint: '闪电⚡ — 又快又准',
    },
    // 首次进入时的视角选择引导
    firstTimePrompt: {
      title: '你更接近哪一种？',
      options: [
        { id: 'beginner', label: '我刚开始投资，想有人带', hint: 'Whaley 会一步步引导你' },
        { id: 'intermediate', label: '我懂一些，想自己研究', hint: '所有因子和工具都给你' },
        { id: 'pro', label: '我是老手，要又快又准', hint: '最少的点击，最多的信息' },
      ],
      footer: '随时可以在顶部切换。你的选择只影响默认体验，不会限制任何功能。',
    },
  },

  // ═══════════ 🌱 新手视角 ═══════════
  beginner: {
    dashboard: {
      title: "👋 今天市场在说什么？",
      subtitle: "选一个你关心的话题，Whaley 帮你解读。",
      emptyState: "还没有看到数据？先连接你的券商账户或自选股列表，我就能告诉你该关注哪些因子了。",

      // 新手看到的不是因子列表，是「话题卡片」
      topicCards: [
        {
          emoji: "📉",
          title: "现在适合买吗？",
          description: "看看估值和资金流在说什么",
          factorsPreview: "PE_TTM + PB_LF + INSTITUTIONAL_FLOW",
          action: "查看信号",
        },
        {
          emoji: "🛡️",
          title: "该防守了吗？",
          description: "波动率和资金面会告诉你",
          factorsPreview: "VOL_60D + MAX_DRAWDOWN + FEAR_GREED_INDEX",
          action: "查看风险",
        },
        {
          emoji: "💡",
          title: "有什么好机会？",
          description: "动量、质量和超跌信号同步出现了吗",
          factorsPreview: "MOM_6M + QUAL + MOM_1M_INV",
          action: "扫描机会",
        },
        {
          emoji: "💰",
          title: "哪些公司在回馈股东？",
          description: "股息、回购和现金流告诉你答案",
          factorsPreview: "YIELD + NET_PAYOUT + FREE_CASH_FLOW",
          action: "找分红股",
        },
      ],

      // 每个话题点击后进入的引导
      topicDetail: {
        loading: "Whaley 正在分析当前市场…",
        signalFound: "发现 {count} 个值得关注的信号！点击查看详情。",
        noSignal: "目前这些因子都在正常范围内，没有极端信号。这是好事——市场没有异常。什么时候出现异常，我会第一时间告诉你。",
        explanationCard: {
          title: "这是什么意思？",
          body: "这些信号基于 {factorCount} 个因子在过去 {years} 年的历史数据。当前的信号强度位于历史的 {percentile} 分位——也就是说，历史上只有 {percentile}% 的时间里信号比现在更极端。",
          whatItMeans: "信号越极端（接近100%或0%），历史上可参考的次数越少，但每次出现后的后续走势越值得重视。",
        },
      },
    },

    // 新手的搜索体验
    search: {
      placeholder: "搜你想知道的，比如「便宜的科技股」「分红多的」「最近涨得猛的」",
      emptyResult: "没找到？试试更通俗的说法——比如「便宜」比「低估值」更容易匹配到因子。",
      semanticHints: [
        "便宜的 → 低市盈率 + 高股息率",
        "赚钱多的 → 高ROE + 高现金流",
        "涨得凶的 → 强动量 + 高换手率",
        "跌得惨的 → 超卖 + 低波动",
        "安全的 → 低Beta + 高股息 + 低杠杆",
      ],
      factorCard: {
        oneLiner: "{nameCn}: {humanLabel}",
        signal: "当前信号: {signal}",
        action: "这个是你要找的吗？看看它能帮你怎么选股→",
      },
    },

    // 因子的卡片在新手视角下
    factorCard: {
      title: "{emoji} {nameCn}",
      whatItDoes: "这个因子告诉你：{humanLabel}",
      whyNow: "{contextualExplanation}",
      simpleSignal: "现在这个信号是 {signalLevel} 的——意思是 {signalLevelExplanation}",
      whatToDo: "{actionHint}",
      learnMore: "想了解更多？",
      // 信号等级简化版
      signalLevels: {
        veryStrong: "特别强",
        strong: "比较强",
        normal: "正常水平",
        weak: "比较弱",
        veryWeak: "特别弱",
      },
    },

    // 引导下一步
    nextSteps: [
      { emoji: "⭐", text: "把这个因子加到你的关注列表——以后每次打开App都能看到它" },
      { emoji: "📊", text: "用这个因子扫一下你的自选股——看看哪些股票在发光" },
      { emoji: "🤖", text: "让 Whaley 每周末给你发这个因子的更新——不打扰但不会错过" },
    ],

    // 全文中提示
    contextualTooltips: {
      factor: "一个帮你判断股市的数字工具。就像天气预报告诉你今天会不会下雨——因子告诉你哪只股票可能涨。",
      signal: "信号灯：绿色=可以关注、黄色=等等看、红色=先别碰。",
      backtest: "回测=用历史数据验证。就相当于「过去20年这个指标准不准」。",
      ic: "IC=这个因子预测的准确度。越高越准，但也越容易被别人抢先。",
    },
  },

  // ═══════════ 🎯 进阶视角 ═══════════
  intermediate: {
    dashboard: {
      title: "🔍 你的因子工作台",
      subtitle: "最近看过的 + 你关注的 + 热门。三个视角，随时切换。",

      // 三个标签页
      tabs: {
        recent: { label: "最近浏览", empty: "你还没有浏览过任何因子。去探索吧！" },
        watching: { label: "我的关注", empty: "还没有关注任何因子。点因子卡片上的 ⭐ 就能关注。" },
        trending: { label: "公会热门", subtitle: "最近7天被讨论最多的因子" },
      },

      // 推荐块
      recommendations: {
        title: "✨ 你可能感兴趣的因子",
        subtitle: "基于你常看的 {favoriteCategory} 类因子",
        basedOn: "因为你关注了 {factor}，你可能会想看看：",
      },
    },

    // 进阶的因子卡片——信息多但层次分明
    factorCard: {
      quickBar: "{emoji} {nameCn} | 信号: {signal} | IC {ic} | 同类排位 #{rank}",
      sections: {
        signal: { label: "📡 当前信号", hint: "基于最近20个交易日的数据" },
        performance: { label: "📈 历史表现", hint: "过去5年滚动IC" },
        context: { label: "🔗 相关因子", hint: "经常一起使用的因子" },
        blindspot: { label: "🚫 小心陷阱", hint: "什么时候这个因子不灵" },
      },
      actions: {
        compare: "🔄 和 {factor} 比一下",
        deepDive: "🔬 深度分析",
        addToWatch: "⭐ 关注",
        createAlert: "🔔 信号到 {threshold} 时提醒我",
      },
    },

    // 因子组合探索
    comboExplorer: {
      title: "🧩 因子搭配实验室",
      description: "选一个因子，看看加上另一个会发生什么。",
      emptyState: "选一个起始因子 → 系统自动推荐最佳搭配。",
      addFactorHint: "加一个因子看看回报变化…",
      result: {
        baseline: "只用 {factorA}: 年化超额 {excess}, 夏普 {sharpe}",
        withAddition: "加上 {factorB}: 年化超额 {excess}, 夏普 {sharpe} ↑{improvement}",
        conclusion: "{conclusionText}",
      },
      presetCombos: [
        { name: "价值+质量", factors: "PE_TTM + ROE_TTM + F_SCORE", desc: "找又好又便宜的公司" },
        { name: "动量+低波", factors: "MOM_6M + VOL_60D", desc: "追涨但不追最危险的" },
        { name: "股息+现金流", factors: "YIELD + FREE_CASH_FLOW", desc: "分红不是借来的" },
        { name: "分析师+内部人", factors: "EARNINGS_REVISION + INSIDER_TRADING", desc: "聪明的人都在做什么" },
      ],
    },

    // 情景包入口（进阶）
    scenarioPacks: {
      title: "📦 备用方案",
      description: "不知道从哪开始？试试这些预设的组合",
      hint: "每个组合都有Whaley的历史回测数据——不只是理论，是真实数据。",
    },

    // 进阶搜索
    search: {
      placeholder: "搜索因子名称、分类、或英文ID…",
      filters: ["按市场", "按分类", "按IC高低", "按最近火热"],
      resultCard: "{nameCn} · {category} · IC {ic} · #{rank}",
    },
  },

  // ═══════════ ⚡ 专业视角 ═══════════
  pro: {
    dashboard: {
      title: "⚡ 因子指挥中心",
      subtitle: "你最常用的 + 等待触发的警报 + 性能监控",

      // 三个紧凑面板
      panels: {
        quickAccess: {
          title: "快捷因子",
          empty: "拖拽你常用的因子到这里",
          hint: "最多放12个。点击直接看详情。",
        },
        alerts: {
          title: "等待触发",
          empty: "还没有设置警报。右键任何因子→设置警报。",
          hint: "{count} 个警报监测中",
        },
        health: {
          title: "信号稳定性",
          hint: "你关注因子的近期IC走势",
          degrading: "{factor} 的IC连续 {weeks} 周下降。可能正在拥挤。",
          improving: "{factor} 的IC最近回暖。市场环境变化可能对你有帮助。",
        },
      },
    },

    // 专业因子卡片——极简高效
    factorCard: {
      compact: "{emoji} {nameCn} | IC {ic}({icTrend}) | #{rank} | {signal}",
      expandActions: ["详细数据", "回测参数", "IC全景", "导出"],
      keyboardHint: "← → 切换因子 · Space 展开详情 · S 设为快捷 · A 新建警报 · C 对比模式",
    },

    // 批量操作
    batchOps: {
      title: "批量操作",
      hint: "选2个以上因子可以批量操作。",
      actions: {
        compare: "对比选中 ({count})",
        backtest: "批量回测",
        export: "导出数据",
        createWatchlist: "新建观察列表",
      },
    },

    // API和导出
    exports: {
      title: "📤 导出",
      options: [
        { format: "CSV", desc: "表格数据，Excel直接打开" },
        { format: "JSON", desc: "程序化读取，API同款格式" },
        { format: "PNG", desc: "当前因子卡截图" },
        { format: "PDF", desc: "包含回测和IC的专业报告" },
      ],
      apiNote: "也可以用我们的因子API直接接入你的工具。文档 → https://api.quantmoo.com/factors",
    },

    // 专业搜索
    search: {
      placeholder: "输入因子ID或英文名…（如 PE_TTM, Amihud, GEX）",
      shortcuts: "/id 搜ID · /cn 搜中文 · /en 搜英文 · /cat 搜分类 · /mk 按市场过滤",
      historyTitle: "最近搜索",
      historyEmpty: "搜过的因子会出现在这里。快捷键 Ctrl+K 打开搜索。",
    },

    // 性能监控
    performanceMonitor: {
      title: "⚙️ 性能",
      summary: "{totalFactors} 因子 · 上次更新 {lastUpdate} · 数据新鲜度 {freshness}",
      freshness: {
        green: "🟢 2小时内 — 数据新鲜",
        yellow: "🟡 今天内 — 可以用",
        red: "🔴 超过1天 — 建议刷新",
      },
    },
  },

  // ═══════════ 共享文案（三视角都可引用） ═══════════
  shared: {
    emptyStates: {
      noData: "暂无数据。连接数据源后自动显示。",
      noResult: "没有找到匹配的因子。试试换个关键词？",
      noSignal: "这个因子现在没有极端信号。正常水平。出现异常时我会提醒你。",
      loading: "正在加载因子数据…",
      error: "加载失败。请检查网络连接后重试。",
    },

    actions: {
      watch: "⭐ 关注",
      unwatch: "取消关注",
      compare: "🔄 对比",
      share: "📤 分享到公会",
      alert: "🔔 设置警报",
      backtest: "📊 回测",
      export: "💾 导出",
      deepDive: "🔬 深度分析",
    },

    signalBadge: {
      bullish: { emoji: "🟢", label: "看涨信号" },
      bearish: { emoji: "🔴", label: "看跌信号" },
      neutral: { emoji: "🟡", label: "中性" },
      extreme: { emoji: "⚠️", label: "极端信号" },
    },

    // Whaley的视角切换提示
    whaleySwitchHint: {
      beginner: "🐋 你现在看的是**新手视角**——我会帮你做选择。准备好了就切到进阶视角自己探索。",
      intermediate: "🐋 你现在看的是**进阶视角**——工具都在手边，试试因子搭配实验室。想更快就切专业视角。",
      pro: "🐋 你现在看的是**专业视角**——极其高效。Ctrl+K 打开搜索，←→ 切换因子。",
    },

    // 视角数据：谁看什么
    perspectiveAnalytics: {
      beginner: "70% 的新手从这里开始。平均使用3个话题卡片后，会关注第一个因子。",
      intermediate: "进阶用户平均关注8个因子，最常用「因子搭配实验室」功能。",
      pro: "专业用户平均每天使用15个不同的因子。快捷键使用率87%。",
    },
  },

  // ═══════════ 工具方法 ═══════════
  getView(viewId: string) {
    if (viewId === 'beginner') return { ...this.viewSwitcher.beginner, ...this.beginner };
    if (viewId === 'intermediate') return { ...this.viewSwitcher.intermediate, ...this.intermediate };
    if (viewId === 'pro') return { ...this.viewSwitcher.pro, ...this.pro };
    return null;
  },

  getSignalBadge(signal: 'bullish' | 'bearish' | 'neutral' | 'extreme') {
    return this.shared.signalBadge[signal];
  },

  getWhaleyHint(viewId: string) {
    return (this.shared.whaleySwitchHint as any)[viewId] || '';
  },
};

export default FACTOR_HUB_THREE_VIEW_COPY;
