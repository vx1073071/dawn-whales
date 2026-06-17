// ══ R262 QClaw Task 3: 行情回放引导文案 ══
// Market replay onboarding — feature intro + learning path + CTAs
// Design: 行情回放不是"看历史"——是"复盘你的决策，反思你的情绪，改善明天的你"

// ═══════════════════════════════════════
// PART A: 首次进入回放功能
// ═══════════════════════════════════════

export const REPLAY_ONBOARDING = {

  firstTime: {
    title: '⏪ 行情回放 — 回到那一天',
    subtitle: '不是看"历史"。是站在"那一天的你"的角度——看看你当时看到了什么，为什么做了那个决定。',
    
    philosophy: [
      '投资中最贵的不是亏钱——是亏了钱还不知道为什么。',
      '行情回放=你的"时光机"。回到任何一天，看市场当时是怎么"动"的。',
      '你当时的决策是对是错不重要——重要的是你能不能从"当时的自己"身上学到东西。',
    ],

    steps: [
      {
        step: 1, icon: '📅', title: '选一个你想回顾的交易日',
        description: '最好选那个你记忆犹新的日子——大涨的日子、大跌的日子、或者你"做错了"的日子。',
        tip: '提示：可以从"我的交易记录"中选择，系统会自动定位到那些你实际买卖的日期。',
      },
      {
        step: 2, icon: '▶️', title: '按下播放 — 看市场"动"起来',
        description: '你会在K线图上看到价格一根根"走出来"。不是一次显示全天的走势——而是一分钟一分钟地回放，就像你在现场一样。',
        tip: '你可以加快速度(2×/4×/8×)来快速过"无聊的"时段，也可以暂停来仔细看"关键的那几分钟"。',
      },
      {
        step: 3, icon: '🔍', title: '叠加你的信号和决策',
        description: '在回放中你会看到"当时的你"收到了哪些推送、看到了哪些信号、做了什么操作。你可以对比"当时的你看到的"和"现在的你知道的"。',
        tip: '这是最重要的功能——不是批评当时的自己，是理解"在当时的信息下，为什么那个决策是合理的"。',
      },
    ],
  },

  // ══ 回放学习路径 ══
  learningPaths: [
    {
      id: 'profit-review', title: '🟢 路径一：复盘盈利',
      tagline: '你赚钱了——但你真的知道为什么吗？',
      description: '选一笔盈利的交易，回放看看：你当时看到了什么信号？是什么让你下单？这个信号在未来还能重复吗？',
      scenarios: [
        { name: '追涨成功', question: '你的追涨触发条件在未来还能复现吗？还是这次只是运气？' },
        { name: '抄底成功', question: '你抄底的信号是技术面(超卖RSI)还是基本面(P/E低)？如果是后者——为什么别人没抄？' },
        { name: '持有盈利', question: '你挺过去了——但中间你动摇了几次？如果再经历一次，你能坚持吗？' },
      ],
      outcome: '盈利复盘的目标：把"这次赚钱"变成"一套可重复的赚钱方法论"。',
    },
    {
      id: 'loss-review', title: '🔴 路径二：复盘亏损',
      tagline: '这可能是你投资中最有价值的2小时。',
      description: '选一笔亏损的交易——你最不想回看的那一笔。不是来自我折磨——是来理解"在那个时刻，为什么你做了那个决定"。',
      scenarios: [
        { name: '追高被套', question: '当时驱动你买的是FOMO还是分析？如果是FOMO——触发你FOMO的是哪个消息/哪个人/哪个数字？' },
        { name: '恐慌卖出', question: '你卖的"原因"是什么？如果今天再发生同样的事——你会做同样的决定吗？' },
        { name: '止损太早', question: '你走对了方向但出早了。你的止损规则是什么？是规则太紧还是你太怕了？' },
      ],
      outcome: '亏损复盘的目标：让这一笔"学费"为未来每一笔交易提供价值——一次亏损，终身受益。',
    },
    {
      id: 'crash-review', title: '🆘 路径三：回顾崩盘日',
      tagline: '2020年3月、2022年熊市——回到那一天。',
      description: '选一个市场崩盘日，回放看看：市场是怎么"一步接一步"崩溃的。推送到你手机上的时候是什么？你的自选股列表是什么颜色？',
      scenarios: [
        { name: '2020年3月(疫情恐慌)', question: '那一天，你觉得"世界完了"。但3个月后发生了什么？回放让你感受"当时的情绪"和"后来的事实"之间的差距。' },
        { name: '2022年暴跌(利率风暴)', question: '科技股跌了30%+。如果你在当时"死扛"了一年——你现在怎么看？如果你"割在了底部"——为什么会割？' },
        { name: '自定义崩盘日', question: '选你自己记忆最深刻的崩盘日。看看当天的推送、当天Whaley说了什么、你当时做了什么。' },
      ],
      outcome: '崩盘日复盘的目标：不是预测下一次崩盘——是在下一次崩盘来临时，"你"已经经过了多次心理演练。',
    },
  ],

  // ══ 回放功能概述 ══
  featureOverview: {
    title: '🎮 回放控制台',
    controls: [
      { button: '▶️ 播放/暂停', description: '按分钟回放价格走势。暂停可以仔细看任何一个时刻。' },
      { button: '⏩ 2×/4×/8×', description: '加速跳过"无聊时段"。8×速度下全天回放只需30分钟。' },
      { button: '⏭️ 跳到下一信号', description: '跳过中间无事件的时间——直接跳到推送/异动/策略触发的时刻(回放的"重点")。' },
      { button: '📊 叠加指标', description: '回放中可以叠加RSI/MACD/布林带——看这些指标在"当时"是什么值。' },
      { button: '💭 笔记模式', description: '回放中随时暂停→写下你的想法。这些笔记会保存在你的"交易日志"里。' },
      { button: '🔄 对比模式', description: '左侧=回放当时，右侧=看看后来发生了什么。\"当时的我\"vs\"后来的我\"。', },
    ],

    panels: [
      { name: '左侧：K线回放', description: '价格一根一根"走出来"。叠加你当时的买卖标记(红色=卖、绿色=买)。' },
      { name: '右侧：信号时间线', description: '你在当时收到了哪些推送？信号广场上别人在说什么？你的因子信号在什么级别？' },
      { name: '底部：Whaley时间轴', description: 'Whaley在当天每个时段说了什么——你可以对比AI的分析和后来的实际走势。' },
    ],
  },

  // ══ 升级路径：回放→策略 ══
  upgradePath: {
    title: '📈 从回放到策略',
    description: '回放完后——不光是"看到了"。你学到的东西可以变成策略参数。',
    steps: [
      { step: '1️⃣', title: '发现模式', description: '回放后你可能会发现："每次某某因子变红后的3天，这只股票大概率继续跌"。' },
      { step: '2️⃣', title: '创建规则', description: '在策略模板中把这个规则写下来——"当XXX因子变红→等3天再买"。' },
      { step: '3️⃣', title: '回测验证', description: '用回测引擎验证这个规则——不只在这一次有效，在历史上其他时间也有效吗？' },
      { step: '4️⃣', title: '实盘追踪', description: '把策略设为"追踪模式"——下次这个条件触发时，Whaley会通知你。' },
    ],
    cta: '开始回放 → 发现模式 → 创建策略 → 回测 → 实盘追踪。五个步骤，把"一次领悟"变成"一套系统"。',
  },

  // ══ 空状态：没有回放数据 ══
  emptyStates: {
    noHistory: {
      title: '📭 还没有行情历史数据',
      body: '行情回放需要Yahoo Finance的历史tick数据积累。当你的QUANT MOO运行了一段时间后，你在这里能看到所有交易日的回放。',
      cta: '继续使用QUANT MOO——行情数据会自动积累。通常使用一周后就有足够的数据来回放关键交易日。',
    },
    noTrades: {
      title: '📊 你还没有关联交易记录',
      body: '如果你连接了券商或手动导入了交易记录——回放会自动标记你的买卖点。没有交易记录也行——回放纯粹看行情。',
      cta: '连接券商(设置→券商)或手动导入交易记录(CSV)。',
    },
    loading: {
      title: '🔄 正在加载{date}的行情数据...',
      body: '从Yahoo Finance历史数据中提取{date}的全天tick数据。数据量约为{dataSize}——预计{estimatedTime}完成加载。',
    },
  },

  // ══ CTA 区域 ══
  ctas: {
    primary: {
      title: '⏪ 回放你最重要的交易日',
      subtitle: '选一个日期——回到那一天，看看"当时的你"看到了什么。',
      buttonLabel: '开始回放',
      quickDates: [
        { label: '昨天', value: 'yesterday', description: '最近的一整天交易数据' },
        { label: '上周大跌日', value: 'last_week_big_down', description: 'SPX-2%+ 的日子' },
        { label: '上周大涨日', value: 'last_week_big_up', description: 'SPX+2%+ 的日子' },
        { label: '自定义日期', value: 'custom', description: '选择任何有历史数据的日子' },
      ],
    },

    secondary: [
      { icon: '📅', title: '回放交易记录', description: '从你的买卖历史中选一个日期回放', target: 'calendar' },
      { icon: '🎓', title: '看回放教程', description: '5分钟视频——如何最大化回放的学习价值', target: 'tutorial' },
      { icon: '📋', title: '我的回放笔记', description: '所有回放中写的笔记、发现的模式', target: 'notes' },
    ],
  },

  // ══ 回放后的"学到了什么"屏幕 ══
  postReplayScreen: {
    title: '✅ 回放完成 — 你学到了什么？',
    prompts: [
      '当时的推送让你恐慌了吗？如果是——这些推送在后来被"证伪"了多少？',
      '你在哪个时间点最焦虑？如果你知道后来的走势——你当时应该做什么？',
      '这个交易日和\"正常交易日\"有什么不同？不同在哪里——速度？幅度？消息？',
      '如果下周一又来一个类似的交易日——你会怎么做？和这次一样还是不一样？',
    ],
    saveNote: '✍️ 记下你的想法——未来你会感谢\"现在的你\"。',
  },
};

// ═══════════════════════════════════════
// PART B: 回放UI动态文案
// ═══════════════════════════════════════

export const REPLAY_UI_COPY = {

  timeline: {
    label: '⏱️ 回放时间轴',
    markers: {
      marketOpen: { zh: '开盘', en: 'Open' },
      marketClose: { zh: '收盘', en: 'Close' },
      signal: { zh: '📡 信号触达', en: '📡 Signal' },
      news: { zh: '📰 消息', en: '📰 News' },
      push: { zh: '🔔 推送', en: '🔔 Push' },
      buy: { zh: '🟢 你买了', en: '🟢 You Bought' },
      sell: { zh: '🔴 你卖了', en: '🔴 You Sold' },
      highOfDay: { zh: '📈 日高', en: '📈 High' },
      lowOfDay: { zh: '📉 日低', en: '📉 Low' },
    },
    tooltip: '{time} — {markerLabel} · {symbol} {price} ({changePct}%)',
    scrubHint: '拖拽时间轴到任意时刻——看在那个时刻你能看到什么。',
  },

  speedIndicator: {
    1: '1× 实时', 2: '2× 快速', 4: '4× 高速', 8: '8× 极速',
    hint: '8×速度下全天回放约30分钟。按空格键暂停。',
  },

  overlayPanel: {
    title: '📊 当时的信息面板',
    sections: [
      { id: 'push', label: '🔔 推送', description: '你在当时收到的推送' },
      { id: 'signal', label: '📡 信号广场', description: '社区在当时的信号' },
      { id: 'whaley', label: '🤖 Whaley快评', description: 'AI在当时的分析' },
      { id: 'watchlist', label: '⭐ 你的自选', description: '自选列表在当时的颜色' },
      { id: 'portfolio', label: '💼 你的持仓', description: '当时你的盈亏状态(如果关联了账户)' },
    ],
  },

  comparisonModeToggle: {
    label: '🔄 对比模式: 开',
    description: '右侧显示"后来发生了什么"——你在对比\"当时的你\"和\"后来知道结果的你\"。小心：事后聪明是人类本能。这个模式不是为了"证明自己笨"——是为了理解"在当时的信息下，什么判断是合理的"。',
  },

  progressBar: {
    label: '{playedMin}/{totalMin}分钟',
    remaining: '还剩{remaining}分钟',
    nextEvent: '下一个事件在{time} ({minutesAfterStart}分后)',
  },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getLearningPath(id: string) {
  return REPLAY_ONBOARDING.learningPaths.find(p => p.id === id);
}

export function getOnboardingStep(step: number) {
  return REPLAY_ONBOARDING.firstTime.steps.find(s => s.step === step);
}

export function getTimelineMarker(type: string, lang: 'zh' | 'en' = 'zh') {
  const marker = REPLAY_UI_COPY.timeline.markers[type as keyof typeof REPLAY_UI_COPY.timeline.markers];
  return marker ? marker[lang] : type;
}

export function getEmptyState(state: 'noHistory' | 'noTrades' | 'loading') {
  return REPLAY_ONBOARDING.emptyStates[state];
}

export default REPLAY_ONBOARDING;
