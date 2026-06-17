// ══ R257 QClaw Task 3: 行情引导文案 ══
// Quote onboarding copy — first visit, empty states, tooltips, progressive disclosure
// Design: "别让用户面对一堆数字不知道从哪下手"

export interface OnboardingStep {
  id: string; title: string; emoji: string;
  body: string; cta: string; tip: string;
}

// ═══════════════ 首次使用引导（3步） ═══════════════

export const QUOTE_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome', title: '欢迎来到你的市场指挥中心', emoji: '🧭',
    body: `这里有29个全球市场、25个交易所的实时行情。
不只是看数字——是看懂"钱在往哪里流"。
先从你熟悉的市场开始——美股、港股、还是A股？`,
    cta: '选择市场 →',
    tip: '💡 可以随时添加更多市场',
  },
  {
    id: 'heatmap', title: '这就是市场热力图', emoji: '📊',
    body: `每个方块 = 一个行业板块。
绿色 = 在涨，红色 = 在跌，方块越大 = 市值越大。
一眼看懂：今天谁强、谁弱、钱在往哪流。`,
    cta: '看一眼热力图 →',
    tip: '💡 点击任何方块 → 进入该板块，看具体股票',
  },
  {
    id: 'screener', title: '找你想买的', emoji: '🔍',
    body: `不知道买什么？筛选器帮你找。
"PE<15 + ROE>20% + 股息连涨5年" → 3秒锁定候选池。
我们有8套预设方案，或者你自己组合。`,
    cta: '试试筛选器 →',
    tip: '💡 从预设方案开始，再慢慢调你自己的参数',
  },
];

// ═══════════════ 各功能空状态 ═══════════════

export const QUOTE_EMPTY_STATES = {
  // 热力图空状态
  heatmap: {
    loading: {
      title: '正在绘制今日市场地图… 🗺️',
      subtitle: '数据牛角自转中——Yahoo Finance WS正在传送29个市场的行情',
      tip: '通常几秒就好。如果一直转→检查网络连接。',
    },
    noData: {
      title: '市场数据还没来 ☕',
      subtitle: '可能Yahoo Finance还没开始推送今天的数据。美国市场盘前数据通常在北京时间17:00后开始。',
      tip: '可以先看看昨天的热力图——热力图支持回看过去5个交易日。',
      action: '看昨天的热力图',
    },
    error: {
      title: '数据加载出问题了 ⚡',
      subtitle: '这不是你的问题——Yahoo Finance的WS偶尔会抽风。我们已经在自动重试了。',
      tip: '等待30秒自动重连。如果持续失败→切换备份源(系统自动执行)。',
      action: '手动刷新',
    },
  },

  // 筛选器空状态
  screener: {
    noResults: {
      title: '没有找到符合条件的股票 🕵️',
      subtitle: '你的条件可能太严格了——就像想找"1000万以内的北京四合院"。',
      tip: '试着放宽1-2个条件。比如：PE从<10放宽到<15，或者去掉市值限制。',
      action: '修改条件',
    },
    firstUse: {
      title: '筛选器是你找股票的"过滤网" 🎯',
      subtitle: '设定条件 → 系统从几千只股票里筛出符合的 → 不用自己翻几百页代码。',
      tip: '不知道从哪开始？试试预设方案——我们已经帮你配好了。',
      action: '从预设方案开始',
    },
    tooMany: {
      title: '找到了 {count} 只，太多啦 😅',
      subtitle: '条件太宽了。加1-2个条件缩小范围——比如加个市值下限或者ROE下限。',
      tip: '好的筛选结果通常在10-50只之间——太多说明条件有漏洞，太少说明太严格。',
      action: '加更多条件',
    },
  },

  // 行情源切换
  sourceSwitch: {
    degraded: {
      title: '行情源已自动切换 🔄',
      subtitle: '主源({fromSource})延迟过高，已切换到备选({toSource})。行情数据正常刷新中，你不会感觉到任何中断。',
      tip: '30秒后如果主源恢复，会自动切回去。',
    },
    allDown: {
      title: '所有行情源暂时不可用 ⚡',
      subtitle: '这很罕见。可能你的网络出了问题，或者所有源同时断连。我们保留了最后一次缓存的价格——但不保证是最新的。',
      tip: '检查网络→等待自动重连→如果持续5分钟→联系支持。',
      action: '重试连接',
    },
  },

  // 自选列表空状态
  watchlist: {
    empty: {
      title: '你还没添加自选股 📝',
      subtitle: '自选股 = 你的"重点关注名单"。加进来的股票会在热力图上高亮显示，异动时第一时间推送你。',
      tip: '去热力图或筛选器 → 点任何股票旁边的☆ → 加入自选',
      action: '去筛选器找股票',
    },
  },

  // 深度行情(Level 2)空状态
  depth: {
    noBroker: {
      title: '深度行情需要连接券商 📡',
      subtitle: 'Level 2订单簿数据来自券商API(如富途/IBKR)。你还没连接券商，所以暂时看不到买卖盘深度。基础报价仍然来自Yahoo Finance。',
      tip: '连接券商=免费解锁Level 2深度行情。去"设置→券商连接"开始。',
      action: '连接券商',
    },
    noL2Support: {
      title: '你的券商不支持Level 2行情 🏦',
      subtitle: '{brokerName}目前只提供基础报价(Level 1)，不提供订单簿深度(Level 2)。不同券商的数据深度不同——IBKR和富途提供最全的L2数据。',
      tip: '想升级到L2深度行情→换一家支持L2的券商连接。',
      action: '查看支持L2的券商',
    },
  },
};

// ═══════════════ 行情源说明卡片（用户设置页） ═══════════════

export const QUOTE_SOURCE_EXPLAINER = {
  title: '📡 你的行情从哪来？',
  summary: 'QUANT MOO从多个来源获取行情。免费基础行情来自Yahoo Finance，连接券商后自动升级为券商直连行情——更快、更准、更深。',

  sources: [
    {
      id: 'yahoo', name: 'Yahoo Finance', tier: '免费基础', emoji: '🌐',
      speed: '200-500ms延迟',
      coverage: '29个市场全量覆盖',
      depth: 'Level 1(实时报价+涨跌幅+成交量)',
      bestFor: '日常看盘、筛选股票',
      limit: '数据源层面的延迟(非直连交易所)，顶级交易者可能觉得不够快',
    },
    {
      id: 'broker', name: '券商直连', tier: '连接券商后免费', emoji: '🔌',
      speed: '10-80ms延迟(富途) / 30-150ms(IBKR)',
      coverage: '你连接的券商支持的市场',
      depth: 'Level 2(订单簿深度+逐笔成交+买卖盘)',
      bestFor: '精准下单、看主力买卖盘、严格止损止盈',
      limit: '需要开通券商账户+API权限。每家券商覆盖市场不同。',
    },
    {
      id: 'backup', name: '备份源', tier: '自动启用', emoji: '🔄',
      speed: '500-2000ms延迟',
      coverage: '有限市场覆盖',
      depth: 'Level 1(降级版)',
      bestFor: '主源断线时的救命稻草',
      limit: '仅在主源断线时自动启用，速度较慢。不应作为主要数据来源。',
    },
  ],

  priority: '数据优先级: 券商直连 > Yahoo Finance > 备份源。系统自动选择最优源，你不需要手动切换。',
};

// ═══════════════ 数据新鲜度指示器文案 ═══════════════

export const DATA_FRESHNESS = {
  live: { label: '实时', color: 'green', description: '数据在1秒内刷新——这是券商直连的速度。' },
  fresh: { label: '新鲜', color: 'green', description: '数据在5秒内刷新——Yahoo Finance正常延迟。' },
  stale: { label: '稍旧', color: 'yellow', description: '数据超过10秒未刷新——可能在缓存读取中。' },
  delayed: { label: '延迟', color: 'orange', description: '数据超过30秒——源可能出了问题，正在切换。' },
  cached: { label: '缓存', color: 'gray', description: '所有源断开，显示最后一次缓存价格。不保证准确。' },
};

// ═══════════════ 行情页首次提示 ═══════════════

export const QUOTE_PAGE_TOOLTIPS = {
  symbolSearch: '搜股票代码、公司名、或"腾讯"这样的中文名。支持29个市场 — 例如 US.AAPL / HK.00700 / CC.BTC',
  quoteSourceBadge: '当前行情来源。点击可切换源或查看源状态。🟢=正常 🟡=降级 🔴=断开',
  refreshButton: '手动刷新行情。数据正常会自动推送，这个按钮只在你想"确定是最新"的时候用。',
  addToWatchlist: '加入自选——会出现在你的自选列表+热力图高亮+异动推送。',
  shareButton: '分享当前股票到社交媒体。不是分享持仓——是分享你的分析。（你不会暴露任何仓位）',
};

// ═══════════════ 工具函数 ═══════════════

export function getOnboardingStep(step: number): OnboardingStep | undefined {
  return QUOTE_ONBOARDING_STEPS[step];
}

export function getEmptyState(feature: string, state: string, vars?: Record<string, string>): { title: string; subtitle: string; tip: string; action?: string } | undefined {
  const map: Record<string, any> = QUOTE_EMPTY_STATES;
  let obj = map[feature]?.[state];
  if (!obj) return undefined;
  if (vars) {
    let subtitle = obj.subtitle;
    for (const [k, v] of Object.entries(vars)) {
      subtitle = subtitle.replace(`{${k}}`, v);
    }
    return { ...obj, subtitle };
  }
  return obj;
}

export { QUOTE_ONBOARDING_STEPS as default };
