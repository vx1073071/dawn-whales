// ══ R263 QClaw Task 1: 热力图板块hover提示+AI诊断话术 ══
// Heatmap hover tooltips + AI diagnosis integration copy
// Design: hover是"秒懂"——3秒读完判断要不要点进去。AI诊断是"深看"——点击后的完整分析框架话术

// ═══════════════════════════════════════
// PART A: Hover 提示 (3秒读完)
// ═══════════════════════════════════════

export const HEATMAP_HOVER_TIPS = {

  // ── 方块悬浮通用元素 ──
  blockBase: {
    changeLine: '{emoji} {sectorName} {changePct}% {directionArrow}',
    strengthLine: '{strengthLabel} · 板块内{advancers}/{total}只上涨',
    volumeClue: '成交量{volVsAvg}% vs 日均 → {volumeInterpretation}',
    // 3秒读完——三行足够
  },

  // ── 每个板块特有的hover insight ──
  sectorInsights: {
    TECHNOLOGY: {
      driver: '芯片/AI链今天{chipDirection}。10Y美债{treasuryDirection}。',
      question: '领涨的{topStock}是"真龙头"还是"被带起来的"？',
      watch: '看NVDA+AMD——AI芯片是板块"定调者"',
    },
    FINANCIAL: {
      driver: '利率面：10Y {treasuryDirection}。信贷面：利差{spreadDirection}。',
      question: '银行vs券商——谁在领涨？含义不同。',
      watch: '看JPM——它是"金融心跳"',
    },
    HEALTHCARE: {
      driver: '制药{pDirection} 生物科技{bDirection}——双线同向还是分歧？',
      question: '如果是制药涨+生物科技跌=防御流入。反过来的话=进攻。',
      watch: 'XBI(生物科技ETF)是"进攻温度计"',
    },
    ENERGY: {
      driver: 'WTI {wtiDirection}%, 布伦特 {brentDirection}%——油价是铁律。',
      question: '油价涨了{sustainedDays}天了——能源股还能跟多久？',
      watch: 'WTI $80以上能源股估值开始"跟不上"股价上涨——等于"变贵"',
    },
    CONSUMER: {
      driver: '必需{staplesDirection} 可选{discretionaryDirection}——消费"信心差"。',
      question: '可选品跌>必需品=消费者在"降级"。它在给经济发信号。',
      watch: '看AMZN——它的消费数据=美国消费者"体温"',
    },
    INDUSTRIALS: {
      driver: 'PMI={pmi}——50以上=工业在"扩张"。运输{direction}。',
      question: '运输子行业(航空/铁路)是工业的"金丝雀"——它先转向。',
      watch: '看CAT——它是全球基建的"影子"',
    },
    MATERIALS: {
      driver: '美元{dxyDirection}%, 中国PMI={chinaPmi}——两个引擎。',
      question: '铜价{copperDirection}——铜是原材料的"博士指标"。',
      watch: '铜价领先原材料板块2-4周——铜先动=板块后动',
    },
    UTILITIES: {
      driver: '10Y {treasuryDirection}——公用事业的"利率锚"。',
      question: '如果利率跌但公用事业不涨=市场在"定价衰退"（资金去了别处）。',
      watch: '公用事业"正常"波动±0.3%——今天{changePct}%={percentile}分位',
    },
    REAL_ESTATE: {
      driver: '30年按揭={mortgageRate}%——{rateVsPeak}。',
      question: '数据中心REIT是例外——它们靠AI需求，不靠利率。',
      watch: '看PLD(工业REIT)——电商/仓储需求是"新经济"地产',
    },
    COMMUNICATION: {
      driver: '平台{pDirection} 电信{tDirection}——两个世界。',
      question: '如果是平台(GOOGL/META)跌但科技整体不跌→平台自己的问题。',
      watch: '通信板块是"双胞胎"——看两边分别动。',
    },
  },

  // ── 成交量解释翻译 ──
  volumeInterpretation: {
    above2x: '放量上涨/下跌——信号可信度高',
    above15: '量能偏大——关注是真金白银还是"出货"',
    normal: '正常量能',
    below70: '量能偏低——信号"水分"偏大',
    below50: '缩量——可能是"假突破/假破位"',
  },

  // ── 强度标签翻译 ──
  strengthLabels: {
    strong_leader: '强势领涨',
    solid_up: '稳健上涨',
    mild_up: '微涨',
    flat: '平盘',
    mild_down: '微跌',
    notable_down: '明显回调',
    heavy_down: '重挫',
  },

  // ── 趋势箭头 ──
  arrows: {
    up: '↑↑↑', warm_up: '↑↑', mild_up: '↑',
    flat: '→',
    mild_down: '↓', notable_down: '↓↓', heavy_down: '↓↓↓',
  },
};

// ═══════════════════════════════════════
// PART B: AI诊断入口文案
// ═══════════════════════════════════════

export const AI_DIAGNOSIS_COPY = {

  // ── 热力图中"AI诊断"按钮 ──
  entryButton: {
    label: '🤖 Whaley 板块诊断',
    hover: '让Whaley分析这个板块今天为什么在动',
    subtitle: '1 USDT/次 · 分析失败不收费',
    costLabel: '1 USDT',
    costHint: '静默扣款，不弹窗',
  },

  // ── AI诊断结果布局文案 ──
  diagnosisLayout: {
    sections: {
      summary: {
        title: '📊 一屏总结',
        desc: '{sectorName}板块{changePct}%——一句话：{oneLiner}',
      },
      whatDrives: {
        title: '🔍 谁在驱动',
        desc: '今天这个板块是{driverExplanation}。成分股中{advancingPct}%在涨——{breadthJudgment}。',
        breadth: '广度通常在{normalRange}%之间——{breadthVerdict}。',
      },
      moneyFlow: {
        title: '💰 钱往哪走',
        desc: '从资金面看：{moneyFlowDescription}。如果你在考虑这个板块——先看资金是"真流入"还是"假动作"。',
      },
      riskScan: {
        title: '⚠️ 风险扫描',
        desc: '当前主要风险：{risks}。{mitigationAdvice}',
      },
      whaleAdvice: {
        title: '🐋 Whaley 说',
        desc: '{advice}',
        tone: 'Whaley的语气在{currentTone}模式——{toneExplanation}。',
      },
    },
  },

  // ── 诊断结果快速共享 ──
  shareCard: {
    title_prefix: '📊 Whaley诊断',
    text: '{sectorName}{changePct}% · {oneLiner}',
    cta: '查看完整诊断 → ',
  },

  // ── AI诊断空状态 ──
  emptyStates: {
    noData: {
      title: '⏳ 板块数据不足',
      body: '{sectorName}板块今天的成分股数据尚未完全加载。AI诊断需要板块内至少{minStocks}只股票的完整数据。',
      action: '等数据加载完成后点这里或{laterAction}。',
    },
    analyzing: {
      title: '🤖 Whaley正在分析{sectorName}...',
      body: '正在计算：成分股分布×领涨龙头×资金流向×板块背离度×历史对比。通常需要{speedRange}秒。',
      speedRange: '3-8',
    },
    insufficientBalance: {
      title: '💰 USDT余额不足',
      body: 'AI板块诊断需要1 USDT。你的当前余额：{balance} USDT——差{shortfall} USDT。',
      action: '充值 → 设置 → USDT钱包',
    },
    failed: {
      title: '😅 分析失败 — 不扣费',
      body: 'Whaley这次没能完成{sectorName}的分析。可能原因：数据源波动(偶尔发生)、网络瞬时中断。1 USDT未扣除。',
      action: '再试一次（不保证成功）或等30秒后重试。',
    },
    successFirstTime: {
      title: '✅ 分析完成！',
      body: '这是你第一次使用AI板块诊断。以后你随时可以回来查看任意板块——每次1 USDT，按实际分析次数扣除。',
      tip: '提示：开盘后30分钟到收盘前30分钟是AI诊断最"有价值"的时间窗口（数据足够完整）。',
    },
  },

  // ── 诊断历史文案 ──
  diagnosisHistory: {
    title: '📋 你的板块诊断历史',
    header: '{count}次诊断 · 累计{totalCost} USDT · 最近一次：{lastDiagnosisTime}',
    item: {
      when: '{relativeTime} · {sectorName}',
      what: '当时：{changePct}% · AI说：{oneLinerTruncated}',
      revisit: '🔁 再看一次',
      verdictTag: {
        correct: '✅ 符合后来的走势',
        partial: '⚠️ 部分正确',
        incorrect: '❌ 不符合后来的走势',
        unknown: '⏳ 正在验证',
      },
    },
    empty: '你还没用过AI板块诊断。在热力图上点击任意板块的"🤖 Whaley诊断"。',
  },
};

// ═══════════════════════════════════════
// PART C: 板块热力图滤镜文案
// ═══════════════════════════════════════

export const HEATMAP_FILTER_COPY = {

  filterBar: {
    title: '🔍 板块筛选',
    presets: [
      { id: 'all', zh: '全部板块', en: 'All Sectors' },
      { id: 'gainers', zh: '🟢 上涨', en: '🟢 Gainers' },
      { id: 'losers', zh: '🔴 下跌', en: '🔴 Losers' },
      { id: 'most_active', zh: '📊 最活跃', en: '📊 Most Active' },
      { id: 'money_in', zh: '💰 资金流入', en: '💰 Money In' },
      { id: 'money_out', zh: '💸 资金流出', en: '💸 Money Out' },
    ],
    sortOptions: [
      { id: 'change_desc', zh: '涨幅↓', en: 'Gain↓' },
      { id: 'change_asc', zh: '跌幅↓', en: 'Loss↓' },
      { id: 'volume_desc', zh: '成交量↓', en: 'Volume↓' },
      { id: 'marketCap', zh: '市值↓', en: 'Cap↓' },
    ],
  },

  sectorGroupTags: {
    cyclical: { zh: '🔄 周期', en: '🔄 Cyclical', sectors: ['ENERGY', 'MATERIALS', 'INDUSTRIALS', 'FINANCIAL'] },
    growth: { zh: '🚀 成长', en: '🚀 Growth', sectors: ['TECHNOLOGY', 'COMMUNICATION', 'CONSUMER'] },
    defensive: { zh: '🛡️ 防御', en: '🛡️ Defensive', sectors: ['HEALTHCARE', 'UTILITIES', 'REAL_ESTATE'] },
  },

  emptyFilter: {
    zh: '没有板块匹配当前筛选条件。试试换一个预设或重置筛选。',
    en: 'No sectors match this filter. Try a different preset or reset.',
  },

  // ── "全市场快照"一分钟概览 ──
  snapshotBar: {
    title: '📸 {marketName}市场快照',
    summary: '{advancing}/10板块上涨 · 领涨{sectorName}+{pct}% · 领跌{loserSector}{loserPct}%',
    pulse: '市场"脉搏"：{pulseLabel}。{pulseExplanation}。',
    pulseLabels: {
      risk_on: 'Risk-On——进攻模式（钱流向科技/可选品）',
      risk_off: 'Risk-Off——防御模式（钱流向公用/医疗/必需品）',
      mixed: '方向不明——钱在板块间轮动',
      quiet: '安静——大部分板块波动<1%，横盘消化',
    },
  },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getSectorInsight(sectorId: string) {
  const key = sectorId as keyof typeof HEATMAP_HOVER_TIPS.sectorInsights;
  return HEATMAP_HOVER_TIPS.sectorInsights[key] || null;
}

export function getVolumeInterpretation(ratioVsAvg: number): string {
  if (ratioVsAvg >= 200) return HEATMAP_HOVER_TIPS.volumeInterpretation.above2x;
  if (ratioVsAvg >= 150) return HEATMAP_HOVER_TIPS.volumeInterpretation.above15;
  if (ratioVsAvg >= 70) return HEATMAP_HOVER_TIPS.volumeInterpretation.normal;
  if (ratioVsAvg >= 50) return HEATMAP_HOVER_TIPS.volumeInterpretation.below70;
  return HEATMAP_HOVER_TIPS.volumeInterpretation.below50;
}

export function getStrengthLabel(changePct: number): string {
  if (changePct > 2) return 'strong_leader';
  if (changePct > 0.5) return 'solid_up';
  if (changePct > 0) return 'mild_up';
  if (changePct === 0) return 'flat';
  if (changePct > -1) return 'mild_down';
  if (changePct > -2) return 'notable_down';
  return 'heavy_down';
}

export function getArrow(changePct: number): string {
  if (changePct > 2) return '↑↑↑';
  if (changePct > 0.5) return '↑↑';
  if (changePct > 0) return '↑';
  if (changePct === 0) return '→';
  if (changePct > -1) return '↓';
  if (changePct > -2) return '↓↓';
  return '↓↓↓';
}

export function getPulseLabel(advancingCount: number): keyof typeof HEATMAP_FILTER_COPY.snapshotBar.pulseLabels {
  if (advancingCount >= 7) return 'risk_on';
  if (advancingCount >= 4) return 'mixed';
  if (advancingCount >= 2) return 'quiet';
  return 'risk_off';
}

export default HEATMAP_HOVER_TIPS;
