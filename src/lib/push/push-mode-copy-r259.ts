// ══ R259 QClaw Task 1: 7种推送状态文案 ══
// Push notification states/modes — every push type with its own tone, timing, and template
// Design: 不是"你有新消息"这种废话推送——是"这条推送值不值得打断我"

export interface PushMode {
  id: string; emoji: string;
  name: string;                    // 推送类型名称
  schedule: string;                // 发送节奏
  frequency: string;               // 频率说明
  description: string;             // 给用户看的说明（设置页）
  preview: string;                 // 预览示例
  onboardingCard: { title: string; body: string; icon: string }; // 首次启用卡片
  emptyState: { title: string; body: string }; // 今天没有推送时的状态
  overrideSettings: string;        // 覆盖设置说明
}

export const PUSH_MODES_7: PushMode[] = [

  // ═══════════ 1. 开盘简报 ═══════════
  {
    id: 'market-open', emoji: '🌅',
    name: '开盘简报',
    schedule: '每个交易日开盘后30分钟',
    frequency: '每天1次（交易日）',
    description: '一次推送看懂今天市场状态——昨晚有啥大事、今天盘前谁在动、开盘后方向如何。\"打开APP之前我先知道今天什么节奏\"。',
    preview: '🌅 美股开盘 | 标普+0.3% · 科技领涨 · AAPL盘前+2.1%（财报超预期）· VIX=18.5（平稳）',
    onboardingCard: {
      title: '🌅 开盘简报 — 每天打开APP之前就知道今天什么节奏',
      body: '推送在开盘后30分钟到达。内容包括：隔夜全球市场走势、盘前异动股票、开盘方向、VIX水平。30秒读完，比看20条新闻快。',
      icon: 'sunrise',
    },
    emptyState: {
      title: '今天没有开盘简报',
      body: '今天是非交易日，或者你设置的市场今天休市。下次交易日推送会自动恢复。',
    },
    overrideSettings: '选择你关注的市场（美股/港股/A股）→ 只收你看的市场的开盘简报。',
  },

  // ═══════════ 2. 收盘小结 ═══════════
  {
    id: 'market-close', emoji: '🌇',
    name: '收盘小结',
    schedule: '每个交易日收盘后',
    frequency: '每天1次（交易日）',
    description: '一天市场"总结"——谁涨谁跌、成交量如何、你的自选股今天表现。不啰嗦，3段话讲完。',
    preview: '🌇 美股收盘 | 标普+0.8%收4280 · 自选3涨2跌 · NVDA+4.2%（AI芯片需求）+TSLA-1.8%（交付数据争议）· 成交量比20日均值+15%',
    onboardingCard: {
      title: '🌇 收盘小结 — 一天结束，3段话知道今天市场长什么样',
      body: '收盘后推送到你手机。包含：大盘走势、你的自选股今日涨跌、成交量异动。不需要在收盘后翻开12个页面看。',
      icon: 'sunset',
    },
    emptyState: {
      title: '今天没有收盘小结',
      body: '今天是非交易日，或市场尚未收盘。正常交易日收盘后会推送。',
    },
    overrideSettings: '如果不想看自选股摘要 → 在\"推送内容\"中关掉\"自选股今日表现\"。',
  },

  // ═══════════ 3. 自选异动 ═══════════
  {
    id: 'watchlist-alert', emoji: '⭐',
    name: '自选异动',
    schedule: '实时（异动发生时即刻推送）',
    frequency: '1-3次/天（取决于市场波动）',
    description: '你的自选股只要有大动作——大幅涨跌、爆量、消息面突变——立刻推给你。不浪费你的推送额度在\"小波动\"上。',
    preview: '⭐ AAPL +5.2% → 突破阻力位！财报超预期+大摩上调目标价至$220。成交量4倍于20日均值。RSI=72(超买)。→ 点我看AI快评',
    onboardingCard: {
      title: '⭐ 自选异动 — 你关心的股票有动作，立刻告诉你',
      body: '只会推送\"真异动\"——涨跌幅>3% 或 成交量>3倍均值 或 AI检测到技术信号（金叉/死叉/背离）。不会因为\"涨了0.5%\"就吵你。',
      icon: 'star',
    },
    emptyState: {
      title: '你的自选股今天很稳 📈',
      body: '今天没有触发异动阈值。这是好事——说明你的自选股没有剧烈波动。异动不是\"越多越好\"。',
    },
    overrideSettings: '调整异动阈值 → 当前默认：涨跌幅>3% 或 成交量>3倍均值。敏感型投资者可以调低到2%。',
  },

  // ═══════════ 4. AI每日快评 ═══════════
  {
    id: 'ai-daily-review', emoji: '🤖',
    name: 'AI每日快评',
    schedule: '每天收盘后',
    frequency: '每天1次（交易日）',
    description: 'Whaley用AI给你做一份\"今天的市场总结\"——不是新闻摘要，是\"理解新闻背后的逻辑\"。帮你把信号从噪音里筛出来。',
    preview: '🤖 Whaley说：今天市场整体偏多，但有一个信号需要关注——10年美债收益率悄悄升到了4.3%（3周最高）。如果明天继续升→成长股可能承压。你的自选里NVDA/TTD属于\"利率敏感型成长股\"。点我看完整分析。',
    onboardingCard: {
      title: '🤖 AI每日快评 — 不是新闻，是\"新闻背后的逻辑\"',
      body: '每天1条，收盘后发。Whaley分析今天市场的核心驱动力（不给你列10条新闻标题），并点名你可能需要注意的风险。不比收盘小结长——但比它深。',
      icon: 'robot',
    },
    emptyState: {
      title: '今天没有AI快评',
      body: 'Whaley分析需要足够的成交数据。如果今天成交量极低或市场数据缺失→Whaley选择\"不凑出一篇废话\"。',
    },
    overrideSettings: '默认开启。AI快评消耗{aiCost} USDT/次（失败不收费）。如果不想付费→关闭此推送。',
  },

  // ═══════════ 5. 每周深度 ═══════════
  {
    id: 'weekly-deep', emoji: '📊',
    name: '每周深度',
    schedule: '每周六上午10:00',
    frequency: '每周1次',
    description: '一周市场回顾+你的持仓健康检查+下周关注日历。不是\"周一涨周二跌\"的事件罗列——是\"这周市场在交易什么逻辑\"。',
    preview: '📊 本周回顾 | 标普+1.2% · 你的持仓整体+0.8% · 本周驱动：①通胀数据低于预期→降息预期升温 ②科技股财报季→AI投资超预期 · 下周关注：周二CPI、周五美联储讲话（可能暗示9月降息）· 你的NVDA\"过度集中\"提醒→单一持仓占比已到28%',
    onboardingCard: {
      title: '📊 每周深度 — 周末花5分钟，知道自己的钱过去一周经历了什么',
      body: '不是新闻摘要。是\"本周市场在交易什么主题\"+\"你的持仓现在健康吗\"+\"下周有什么大事\"。信息量刚好5分钟读完。',
      icon: 'chart',
    },
    emptyState: {
      title: '这周的深度报告还没准备好',
      body: '数据还在跑。每周六上午10:00准时推送——泡杯咖啡的时间刚好读完。',
    },
    overrideSettings: '可以选择接收\"简化版\"（只有市场回顾，不含持仓分析）。',
  },

  // ═══════════ 6. 崩盘预警 ═══════════
  {
    id: 'crash-alert', emoji: '🆘',
    name: '崩盘预警',
    schedule: '实时（市场达到阈值即时推送）',
    frequency: '极少（平均每年1-3次）',
    description: '当市场出现系统性风险时——大盘跌超阈值、VIX飙涨、熔断预警——第一时间推给你。这是所有推送中优先级最高的。',
    preview: '🆘 标普正在快速下跌 -5.2%（修正级别）。VIX飙到32。这是今年以来最大的单日跌幅。→ 点我看\"现在该做什么\"（不是你想象的那样）',
    onboardingCard: {
      title: '🆘 崩盘预警 — 你最不想看到但也最需要的推送',
      body: '只在市场出现\"真风险\"时推送——大盘单日跌超3%、VIX飙上30、熔断预警。推送包含\"现在该做什么\"的冷静指南（数据≠恐惧）。',
      icon: 'warning',
    },
    emptyState: {
      title: '崩盘预警暂无触发',
      body: '这是好事。崩盘预警只在市场出现系统性风险时触发。没有推送=市场正常。',
    },
    overrideSettings: '⚠️ 不建议关闭。但如果你不想被打扰→可调高触发阈值（默认3%，可调至5%/7%/10%）。',
  },

  // ═══════════ 7. 安静模式 / 自定义 ═══════════
  {
    id: 'quiet-mode', emoji: '🔕',
    name: '自定义推送',
    schedule: '你说了算',
    frequency: '你控制频率',
    description: '不想按预设来？自己定义——\"只在美股开盘时推送\"、\"只在自选涨跌5%以上才推送\"、\"周末不推送\"。你的推送你说了算。',
    preview: '🔕 \"自定义推送已生效\" — 你当前的规则：工作日(9:00-22:00)接收·仅自选异动>5%·静音开盘/收盘简报·周末完全静音。',
    onboardingCard: {
      title: '🔕 自定义 — 你的推送，你完全控制',
      body: '默认7种推送全部开启。你可以：关掉任何你不想要的、调高任何推送的触发阈值、设置\"免打扰时段\"（晚上不推送）、设置\"仅推送自选股\"。你的手机=你的。',
      icon: 'sliders',
    },
    emptyState: {
      title: '自定义规则已生效',
      body: '你当前的规则正在筛选推送内容。如果觉得推送太少→回到推送设置放宽条件。',
    },
    overrideSettings: '完全自定义：推送类型×触发阈值×免打扰时间×推送渠道（APP/邮件/短信）自由组合。',
  },
];

// ═══════════════ 推送设置页文案 ═══════════════

export const PUSH_SETTINGS_PAGE = {
  title: '🔔 推送通知设置',
  subtitle: '好的推送是"信息"。不好的推送是"噪音"。我们尽全力做到前者。',
  
  sections: {
    daily: { title: '📬 每日推送', description: '节奏固定，不吵人。帮你建立看盘习惯。' },
    realtime: { title: '⚡ 实时预警', description: '有大事才响。不会因为小波动吵你。' },
    custom: { title: '🎛️ 自定义', description: '你的推送你的规则。' },
  },

  tips: {
    batteryOptimization: '⚠️ 如果你的手机有"省电模式"→可能会延迟推送。把QUANT MOO加入"不受限制"列表。',
    doNotDisturb: '🌙 系统\"勿扰模式\"期间推送静默（不会响，但会出现在通知中心）。',
    dataUsage: '📡 推送消耗极少流量（每条<1KB）。不会影响手机流量。',
  },

  // 全局开关
  muteAll: {
    label: '全部静音（仅保留崩盘预警）',
    description: '开启后只会在市场出现系统性风险时推你。其他推送全部静默。',
    confirm: '确认关闭所有推送？崩盘预警会保留。你随时可以重新开启。',
  },
};

// ═══════════════ 推送内容优先级说明 ═══════════════

export const PUSH_PRIORITY_EXPLAINER = {
  title: '📊 推送优先级',
  body: '不是每条推送都一样重要。我们用\"优先级\"来控制什么时候可以打断你：',
  levels: [
    { level: 'CRITICAL', name: '🔴 紧急', desc: '崩盘预警——无论什么时间都会响', example: '市场熔断、单日暴跌>10%' },
    { level: 'HIGH', name: '🟠 重要', desc: '自选异动——盘中会响，非交易时段静默', example: '自选涨跌>3%、AI检测到强信号' },
    { level: 'NORMAL', name: '🟡 普通', desc: '每日推送——在规定时间发，错过也不影响决策', example: '开盘简报、收盘小结、AI快评' },
    { level: 'LOW', name: '🟢 信息', desc: '周报/教育类——周末发，可自由关闭', example: '每周深度、量化小课堂' },
  ],
};

// ═══════════════ 推送表现统计（用户可见） ═══════════════

export const PUSH_STATS_DISPLAY = {
  title: '📈 你的推送统计',
  description: '看看QUANT MOO给你发了多少\"真信号\"和多少\"噪音\"。',
  metrics: [
    { id: 'totalSent', label: '本月推送', emoji: '📬' },
    { id: 'clicked', label: '你点击了的', emoji: '👆' },
    { id: 'actionTaken', label: '因此操作了的', emoji: '🎯' },
    { id: 'saved', label: '\"省了时间\"', emoji: '⏱️', description: '推送帮你跳过了自己翻看行情的步骤' },
  ],
};

// ═══════════════ 工具函数 ═══════════════

export function getPushMode(id: string): PushMode | undefined {
  return PUSH_MODES_7.find(m => m.id === id);
}

export function getPushModesByCategory(category: 'daily' | 'realtime'): PushMode[] {
  if (category === 'daily') {
    return PUSH_MODES_7.filter(m => ['market-open', 'market-close', 'ai-daily-review', 'weekly-deep'].includes(m.id));
  }
  return PUSH_MODES_7.filter(m => ['watchlist-alert', 'crash-alert'].includes(m.id));
}

export default PUSH_MODES_7;
