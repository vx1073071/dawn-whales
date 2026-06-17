// ══ R264 QClaw Task 2: 行情回放盘中引导文案 ══
// In-replay contextual guidance — prompts that appear DURING playback
// Design: 不是"使用教程"——是"此时此刻，你在回放中应该注意什么"

// ═══════════════════════════════════════
// PART A: 回放时刻引导
// ═══════════════════════════════════════

export const IN_REPLAY_GUIDANCE = {

  // ── 回放阶段引导 ──
  phases: [
    {
      phase: 'starting', at: '回放开始时',
      title: { zh: '📅 欢迎回到 {date}', en: '📅 Welcome back to {date}' },
      body: {
        zh: '这是{date}的全天行情回放。当天标普{spxPct}%。你有{tradeCount}笔交易在这一天——它们会被标记在K线上（🟢买入 / 🔴卖出）。',
        en: 'Full-day replay of {date}. S&P did {spxPct}% that day. You had {tradeCount} trades — marked on the chart (🟢 Buy / 🔴 Sell).',
      },
      hint: {
        zh: '💡 按空格键暂停 · ⏩ 2×/4×/8×加速 · ⏭️ 跳到下一个事件',
        en: '💡 Space to pause · ⏩ 2×/4×/8× speed · ⏭️ Jump to next event',
      },
    },
    {
      phase: 'preMarket', at: '回放到盘前阶段',
      title: { zh: '🌅 现在是盘前 — {time}', en: '🌅 Pre-market — {time}' },
      body: {
        zh: '盘前市场：标普期货{spxFuturePct}%。{topMover}盘前已经{moverPct}%——这是当天第一个"信号"。',
        en: 'Pre-market: S&P futures {spxFuturePct}%. {topMover} already {moverPct}% pre-market — the first signal of the day.',
      },
      hint: {
        zh: '💡 注意开盘跳空——当天的高波动往往在开盘时就已经出现了。',
        en: '💡 Watch the opening gap — high-volatility days often signal themselves right at the open.',
      },
    },
    {
      phase: 'marketOpen', at: '回放到9:30开盘',
      title: { zh: '🔔 9:30 — 开盘', en: '🔔 9:30 — The Bell' },
      body: {
        zh: '开盘了。价格从开盘价{mktOpenPrice}开始走。如果你是日内交易者——这是你最关注的一分钟。',
        en: 'The open. Price starts at ${mktOpenPrice}. If you\'re a day trader — this is your minute.',
      },
      hint: {
        zh: '💡 看开盘后的方向——开盘价往往不是全天的方向，开盘后15分钟的趋势更有参考价值。',
        en: '💡 The opening price rarely sets the day\'s direction — watch the next 15 minutes instead.',
      },
    },
    {
      phase: 'midSession', at: '回放到10:00-15:00',
      title: { zh: '📊 交易时段 — {time}', en: '📊 Mid-session — {time}' },
      body: {
        zh: '现在是交易最活跃的时段。价格在{currentPrice} — 当天最高{highOfDay}，最低{lowOfDay}。',
        en: 'Prime trading hours. Price at {currentPrice} — high {highOfDay}, low {lowOfDay}.',
      },
      hint: {
        zh: '💡 如果现在你在"犹豫"要不要买/卖——记录下来。回放完后回看：你犹豫的时候做决定的成功率是多少？',
        en: '💡 If you\'re hesitating now — note it. After replay, review: how often were your hesitation moments followed by the right decision?',
      },
    },
    {
      phase: 'yourTrade', at: '回放到你的交易时间点',
      title: { zh: '💼 你在{yourTradeTime} {buyOrSell}了{symbol}', en: '💼 You {buyOrSell} {symbol} at {yourTradeTime}' },
      body: {
        zh: '你{buyOrSell}了{shares}股{symbol}@{tradePrice}。{tradeReason}。现在回头看：当时的价格是当天{pricePosition}。如果持有到收盘——{whatIfSituation}。',
        en: 'You {buyOrSell} {shares} shares of {symbol} at {tradePrice}. {tradeReason}. Looking back: this was {pricePosition} of the day. If held to close — {whatIfSituation}.',
      },
      questions: {
        zh: [
          '当时你看到了什么信号让你做出这个决定？',
          '到现在为止（回放中的这个时间点），你收到的推送是支持还是反对这个决定？',
          '如果你当时不操作——结果会怎样？',
        ],
        en: [
          'What signal did you see that made you act?',
          'Up to this point in the replay — were your pushes supporting or opposing this?',
          'If you hadn\'t acted — what would have happened?',
        ],
      },
      hint: {
        zh: '✍️ 暂停(空格) → 写下你当时的想法。这是回放最有价值的部分。',
        en: '✍️ Pause (Space) → write what you were thinking. This is the most valuable part of replay.',
      },
    },
    {
      phase: 'bigMove', at: '回放到大幅波动时刻(>2% intraday)',
      title: { zh: '⚡ 急动 — {symbol}{direction}{changePct}%', en: '⚡ Big Move — {symbol} {direction} {changePct}%' },
      body: {
        zh: '就在现在——{symbol}急{direction}{changePct}%。触发原因：{trigger}。如果你当时看到了这个——你会怎么反应？',
        en: 'Right now — {symbol} {direction} {changePct}%. Cause: {trigger}. If you had seen this live — how would you have reacted?',
      },
      hint: {
        zh: '💡 看你的推送时间——这条推送你是在事发后{delaySeconds}秒收到的。在这{delaySeconds}秒里发生了什么？',
        en: '💡 Check your push timing — you received this push {delaySeconds}s after the event. What happened in those {delaySeconds} seconds?',
      },
    },
    {
      phase: 'close', at: '回放到收盘',
      title: { zh: '🌇 16:00 — 收盘', en: '🌇 4:00 PM — The Close' },
      body: {
        zh: '收盘了。{symbol}收在{closePrice}（{dayPct}%）。全天范围：{lowPrice}-{highPrice}。',
        en: 'Market closed. {symbol} at {closePrice} ({dayPct}%). Range: {lowPrice}-{highPrice}.',
      },
      hint: {
        zh: '💡 收盘前最后15分钟往往有"收盘效应"——机构在调整仓位。这一段值得多看几遍。',
        en: '💡 The last 15 minutes often show "closing effects" — institutions adjusting. Worth rewatching.',
      },
    },
  ],

  // ── 回放完成后的引导 ──
  postReplay: {
    title: { zh: '✅ 回放完成', en: '✅ Replay Complete' },
    summary: {
      zh: '你花了{duration}分钟回顾了{date}。当天你的盈亏：{pnl}。你做了{tradeCount}笔交易。',
      en: 'You spent {duration} minutes reviewing {date}. Your P&L that day: {pnl}. You made {tradeCount} trades.',
    },
    insights: {
      bestTiming: {
        zh: '⏱️ 时机：你的最佳时机是{buyOrSell}{symbol}@{price}——当时价格在当天{percentile}分位。',
        en: '⏱️ Timing: Your best timing was {buyOrSell} {symbol} at {price} — that was the {percentile} percentile of the day.',
      },
      worstTiming: {
        zh: '⏱️ 时机：你的最差时机是{buyOrSell}{symbol}@{price}——你当时收到了{contradictingSignals}个相反信号。',
        en: '⏱️ Timing: Your worst timing was {buyOrSell} {symbol} at {price} — you had {contradictingSignals} contradicting signals at that moment.',
      },
      signalAccuracy: {
        zh: '📡 信号准确性：当天你收到了{pushCount}条推送。其中{correctCount}条信号在后来被验证正确，{wrongCount}条被证伪。',
        en: '📡 Signal accuracy: You received {pushCount} pushes that day. {correctCount} later proved correct, {wrongCount} proved false.',
      },
      emotionGuess: {
        zh: '🎭 情绪推测：根据你的操作时机和节奏——Whaley推测你当天经历了{emotionPattern}。你可以确认或纠正这个判断。',
        en: '🎭 Emotion guess: Based on timing and pace — Whaley guesses you felt {emotionPattern} that day. Confirm or correct.',
      },
    },
    nextSteps: [
      { zh: '📋 打开决策日志——写下你从这次回放中学到的', en: '📋 Open decision log — write what you learned' },
      { zh: '🔄 回放另一个交易日', en: '🔄 Replay another day' },
      { zh: '🎯 基于发现创建策略规则', en: '🎯 Create a strategy rule from your insight' },
    ],
  },

  // ── 回放"成就" ──
  replayStreak: {
    firstReplay: { zh: '🎉 第一次行情回放！踏出了"看历史"的第一步。', en: '🎉 First replay! You\'ve taken the first step in reviewing history.' },
    streak3: { zh: '🔥 连续3次回放——你在养成\"复盘习惯\"。', en: '🔥 3 replays in a row — you\'re building a review habit.' },
    streak7: { zh: '🏆 连续7次回放——你是复盘达人。大多数投资者从来不回顾自己的交易。', en: '🏆 7-in-a-row — you\'re a review master. Most investors never look back at their trades.' },
    streak30: { zh: '👑 连续30次回放——你已经超过了99%的投资者。这不是\"看走势\"，这是\"研究自己\"。', en: '👑 30-in-a-row — you\'ve surpassed 99% of investors. This isn\'t about charts — it\'s about studying yourself.' },
  },
};

// ═══════════════════════════════════════
// PART B: 回放互动提示
// ═══════════════════════════════════════

export const REPLAY_INTERACTION_TIPS = {

  // ── 键盘快捷键提示 ──
  shortcuts: [
    { key: 'Space', zh: '播放/暂停', en: 'Play/Pause' },
    { key: '→', zh: '前进1分钟', en: 'Forward 1min' },
    { key: '←', zh: '后退1分钟', en: 'Back 1min' },
    { key: '2/4/8', zh: '2×/4×/8× 速度', en: '2×/4×/8× Speed' },
    { key: 'N', zh: '跳到下一个事件', en: 'Next Event' },
    { key: 'P', zh: '跳到上一个事件', en: 'Previous Event' },
    { key: 'C', zh: '切换对比模式', en: 'Compare Mode' },
    { key: 'I', zh: '打开/关闭信号面板', en: 'Toggle Signal Panel' },
    { key: 'W', zh: '写笔记', en: 'Write Note' },
  ],

  // ── 鼠标悬浮提示 ──
  hover: {
    kline: { zh: '悬停在K线上看那一刻的精确价格', en: 'Hover on a candle to see exact price' },
    tradeDot: { zh: '{symbol} · {buyOrSell} · {shares}股 @ {price} · {time}', en: '{symbol} · {buyOrSell} · {shares} shares @ {price} · {time}' },
    eventMarker: { zh: '{eventType} · {time} · {eventDetail}', en: '{eventType} · {time} · {eventDetail}' },
    timeline: { zh: '拖拽时间轴跳到任意时间点', en: 'Drag to jump to any moment' },
    whaleyPanel: { zh: 'Whaley在{time}的实时分析——现在看来：{accuracyLabel}', en: 'Whaley\'s analysis at {time} — in hindsight: {accuracyLabel}' },
  },

  // ── 学习提示(随机出现) ──
  learningTips: {
    zh: [
      '💡 不妨用0.5×速度回放你\"做决策\"的那几分钟——那几分钟值反复看。',
      '💡 每次回放问自己一个特定问题——不是\"我赚没赚\"，而是\"我的入场/出场规则对吗\"。',
      '💡 回放后去看\"决策日志\"——当时的分析 vs. 现在的你——学到最多的地方。',
      '💡 不要只回放亏钱的日子——赚钱的日子也需要复盘。你赚钱是因为\"做对了\"还是\"运气好\"？',
      '💡 选一个你\"最痛苦\"的交易日回放。不是来自我折磨——是\"面对它比逃避它有用\"。',
      '💡 对比模式：一边看回放一边看后来发生了什么。小心\"事后聪明\"——尽量从\"当时的视角\"理解当时的决定。',
    ],
    en: [
      '💡 Try 0.5× speed on the minutes where you made decisions — those minutes are worth rewatching.',
      '💡 Ask one specific question per replay — not "did I profit" but "were my entry/exit rules correct?"',
      '💡 After replay check your decision log — old analysis vs. current you — the biggest learning.',
      '💡 Don\'t only replay losses — winning days need review too. Did you win from skill or luck?',
      '💡 Pick your most painful trading day. Not to torture yourself — facing it is more useful than avoiding it.',
      '💡 Compare mode: replay vs. what happened next. Beware hindsight bias — try to think from "that moment\'s" perspective.',
    ],
  },

  // ── 对比模式切换提示 ──
  compareMode: {
    on: {
      zh: '🔄 对比模式：右=后来的走势。你正在看\"在当时不知道后来结果\"的自己。',
      en: '🔄 Compare Mode: Right = what happened next. You\'re watching yourself "without knowing the future".',
    },
    off: {
      zh: '📺 纯回放模式：只看当时。和你在那个交易日看到的完全一样。',
      en: '📺 Pure Replay: Just that day. Exactly what you saw on that trading day.',
    },
  },
};

// ═══════════════════════════════════════
// PART C: 回放空状态/进度
// ═══════════════════════════════════════

export const REPLAY_PROGRESS_COPY = {
  loading: { zh: '⏳ 正在加载 {date} 的行情数据...', en: '⏳ Loading market data for {date}...' },
  buffering: { zh: '🔄 缓冲中... {loadedPct}%', en: '🔄 Buffering... {loadedPct}%' },
  paused: { zh: '⏸️ 暂停在 {timestamp}', en: '⏸️ Paused at {timestamp}' },
  ended: { zh: '✅ 回放结束', en: '✅ Replay ended' },
  speedIndicator: { 1: '1×', 2: '2×', 4: '4×', 8: '8×', '0.5': '0.5×' },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getPhaseGuidance(phase: string) {
  return IN_REPLAY_GUIDANCE.phases.find(p => p.phase === phase);
}

export function getShortcut(key: string) {
  return REPLAY_INTERACTION_TIPS.shortcuts.find(s => s.key === key);
}

export function getRandomLearningTip(lang: 'zh' | 'en' = 'zh'): string {
  const tips = REPLAY_INTERACTION_TIPS.learningTips[lang];
  return tips[Math.floor(Math.random() * tips.length)];
}

export function getStreakMessage(count: number, lang: 'zh' | 'en' = 'zh') {
  const key = count >= 30 ? 'streak30' : count >= 7 ? 'streak7' : count >= 3 ? 'streak3' : 'firstReplay';
  return IN_REPLAY_GUIDANCE.replayStreak[key][lang];
}

export default IN_REPLAY_GUIDANCE;
