// ══ R264 QClaw Task 1: 语音播报脚本 ══
// Voice/TTS announcement scripts for Whaley
// Design: 语音不是"念一遍文案"——是"用耳朵听市场"。短、有节奏、语气随市场变

// ═══════════════════════════════════════
// PART A: 语音脚本类型体系
// ═══════════════════════════════════════

export interface VoiceScript {
  id: string; type: VoiceScriptType;
  trigger: string;                // 触发条件
  zh: string; en: string;         // 口语文本
  duration: 'micro' | 'short' | 'medium';  // 2-4s / 5-8s / 10-15s
  tone: VoiceTone;                // 语气模式
  followUp?: string;              // 后续可选追问
}

export type VoiceScriptType = 'market_open' | 'market_close' | 'pre_open' | 'intraday_alert' | 'ai_briefing' | 'crash_alert' | 'idle_checkin' | 'weekly_summary';
export type VoiceTone = 'energetic' | 'calm' | 'urgent' | 'soothing' | 'casual' | 'celebratory';

// ═══════════════════════════════════════
// PART B: 所有语音脚本
// ═══════════════════════════════════════

export const VOICE_SCRIPTS: VoiceScript[] = [

  // ── 开盘 ──
  { id: 'open-01', type: 'market_open', trigger: '美股开盘', duration: 'short', tone: 'energetic',
    zh: '美股开盘了。标普期货{spFutureDirection}。今天关注{keyEvent}。',
    en: 'US market is open. S&P futures {spFutureDirection}. Watch {keyEvent} today.',
    followUp: '想听详细开盘简报吗？' },
  { id: 'open-02', type: 'market_open', trigger: '美股开盘(有重大事件)', duration: 'medium', tone: 'urgent',
    zh: '美股开盘——注意。今天{eventType}，市场预计{expectedVol}。开盘前{topMover}已经{preMarketPct}%。',
    en: 'US open — heads up. Today is {eventType}, expecting {expectedVol}. {topMover} is already {preMarketPct}% premarket.',
    followUp: '想听详细简报吗？' },
  { id: 'open-03', type: 'market_open', trigger: '港股/A股开盘', duration: 'short', tone: 'energetic',
    zh: '{marketName}开盘了。昨晚上美股{usDirection}。今天{marketName}怎么跟——开盘见分晓。',
    en: '{marketName} is open. Overnight US was {usDirection}. Let\'s see how {marketName} follows.' },

  // ── 收盘 ──
  { id: 'close-01', type: 'market_close', trigger: '美股收盘(普通)', duration: 'short', tone: 'calm',
    zh: '美股收盘。标普{spxPct}%，纳斯达克{nqPct}%。你的自选里{watchlistGainers}只在涨。今天就这样。',
    en: 'US closed. S&P {spxPct}%, Nasdaq {nqPct}%. {watchlistGainers} of your watchlist up. That\'s the day.' },
  { id: 'close-02', type: 'market_close', trigger: '美股收盘(大幅波动)', duration: 'medium', tone: 'urgent',
    zh: '美股今天不太平。标普{spxPct}%——这是{spxPercentile}分位的日子。VIX到了{vix}。如果你今天做了什么决定——去决策日志里写下来。',
    en: 'Rough day in the US. S&P {spxPct}% — {spxPercentile} percentile. VIX at {vix}. If you made decisions today — write them in your decision log.' },
  { id: 'close-03', type: 'market_close', trigger: '港股/A股收盘', duration: 'short', tone: 'calm',
    zh: '{marketName}收盘。{index}{indexPct}%。{watchlistLine}',
    en: '{marketName} closed. {index} {indexPct}%. {watchlistLine}' },

  // ── 盘前简报 ──
  { id: 'pre-01', type: 'pre_open', trigger: '美股盘前30分钟', duration: 'short', tone: 'casual',
    zh: '还有30分钟开盘。标普期货{spxFuturePct}%。隔夜亚洲{asiaDirection}，欧洲{europeDirection}。今天{eventSummary}。',
    en: '30 minutes to US open. Futures {spxFuturePct}%. Overnight Asia {asiaDirection}, Europe {europeDirection}. Today: {eventSummary}.' },

  // ── 盘中异动 ──
  { id: 'alert-01', type: 'intraday_alert', trigger: '自选股异动>5%', duration: 'micro', tone: 'urgent',
    zh: '{symbol} {direction} {changePct}%——{changePct}个点。{anomalyHint}',
    en: '{symbol} {direction} {changePct}% — {changePct} percent. {anomalyHint}' },
  { id: 'alert-02', type: 'intraday_alert', trigger: '自选股异动>3%', duration: 'micro', tone: 'casual',
    zh: '{symbol}在动——{direction}{changePct}%。',
    en: '{symbol} moving — {direction} {changePct}%.' },
  { id: 'alert-03', type: 'intraday_alert', trigger: '大盘波动>1%(30分钟内)', duration: 'micro', tone: 'urgent',
    zh: '大盘在急动——{index} {direction}{changePct}%，{timeSpan}内。VIX到了{vix}。',
    en: 'Market moving fast — {index} {direction} {changePct}% in {timeSpan}. VIX {vix}.' },

  // ── AI快评 ──
  { id: 'ai-01', type: 'ai_briefing', trigger: '用户点击"语音播报AI快评"', duration: 'medium', tone: 'calm',
    zh: '今天市场{pulse}。{sectorHighlights}。你的自选里{watchlistSummary}。Whaley的观察是：{whaleyInsight}。',
    en: 'Market today: {pulse}. {sectorHighlights}. Your watchlist: {watchlistSummary}. Whaley says: {whaleyInsight}.' },
  { id: 'ai-02', type: 'ai_briefing', trigger: '用户点击"语音播报"且有自选异动', duration: 'medium', tone: 'energetic',
    zh: '先说你最关心的——你的自选{topMover}{direction}{topPct}%。市场整体{pulse}。想深入听吗？',
    en: 'Your top concern first — {topMover} {direction} {topPct}%. Overall market {pulse}. Want to dive deeper?' },

  // ── 崩盘语音 ──
  { id: 'crash-01', type: 'crash_alert', trigger: '大盘跌>3%', duration: 'medium', tone: 'soothing',
    zh: '市场在跌——{index}{changePct}%。我知道你现在可能在看账户。先别动——深呼吸。这不是第一次，也不会是最后一次。历史上，类似跌幅后的3个月——市场平均反弹了{avgRebound}%。我去把你的决策日志打开了——等这波过去，你可以回放今天。',
    en: 'Market is down — {index} {changePct}%. I know you might be looking at your account. Take a breath — don\'t act yet. This isn\'t the first or last time. Historically, 3 months after similar drops — the market rebounded {avgRebound}% on average. I\'ve opened your decision log — when this passes, you can replay today.' },
  { id: 'crash-02', type: 'crash_alert', trigger: '大盘跌>5%', duration: 'medium', tone: 'soothing',
    zh: '{index}跌了{changePct}%。我会一直在这里——但我不替你决定。今天什么都别做——什么都不做=一个决定。记住2020年3月、2022年——事后看，恐慌中卖出的决定是唯一真正亏钱的决定。我帮你把今天的决策日志打开了——想写就写。',
    en: '{index} down {changePct}%. I\'m here — but I won\'t decide for you. Don\'t do anything today — doing nothing IS a decision. Remember March 2020, 2022 — selling in panic was the only decision that actually lost money. I\'ve opened your decision log — write if you want.' },

  // ── 闲暇关心 ──
  { id: 'idle-01', type: 'idle_checkin', trigger: '用户打开App且距上次>3小时', duration: 'micro', tone: 'casual',
    zh: '{greeting}。市场{mktSummary}。',
    en: '{greeting}. Market: {mktSummary}.' },
  { id: 'idle-02', type: 'idle_checkin', trigger: '用户打开App且周末', duration: 'micro', tone: 'casual',
    zh: '周末快乐。市场在休息——你也是。',
    en: 'Happy weekend. The market is resting — so should you.' },

  // ── 周报 ──
  { id: 'weekly-01', type: 'weekly_summary', trigger: '周末总结', duration: 'medium', tone: 'calm',
    zh: '这周收尾了。标普这周{spxWeekPct}%。你{actionCount}次操作——{winCount}次赚钱。这周你{bestDecision}是本周最好的决定。下周五——{nextWeekKeyEvents}。',
    en: 'Week wrap. S&P {spxWeekPct}% this week. You made {actionCount} moves — {winCount} winners. {bestDecision} was your best call. Next week: {nextWeekKeyEvents}.' },
];

// ═══════════════════════════════════════
// PART C: 语音UI控制文案
// ═══════════════════════════════════════

export const VOICE_UI_COPY = {

  // ── 语音设置 ──
  settings: {
    enable: { zh: '启用Whaley语音播报', en: 'Enable Whaley Voice' },
    description: { zh: 'Whaley用声音告诉你市场变化。不是念屏——是说给你听。', en: 'Whaley speaks market updates aloud. Not reading the screen — talking to you.' },
    voiceOptions: [
      { id: 'male_calm', zh: '沉稳男声', en: 'Calm Male' },
      { id: 'female_calm', zh: '温柔女声', en: 'Warm Female' },
      { id: 'male_energetic', zh: '活力男声', en: 'Energetic Male' },
      { id: 'female_pro', zh: '专业女声', en: 'Professional Female' },
    ],
    speedLabel: { zh: '语速', en: 'Speed' },
    speedOptions: [{ id: 'slow', zh: '慢', en: 'Slow' }, { id: 'normal', zh: '正常', en: 'Normal' }, { id: 'fast', zh: '快', en: 'Fast' }],
    volumeLabel: { zh: '音量', en: 'Volume' },
    previewButton: { zh: '试听 Whaley', en: 'Preview Whaley' },
    previewText: { zh: '你好，我是Whaley。我会在你需要的时候出声。', en: 'Hi, I\'m Whaley. I\'ll speak when you need me.' },
  },

  // ── 实时语音指示器 ──
  liveIndicator: {
    playing: { zh: '🔊 Whaley正在播报...', en: '🔊 Whaley speaking...' },
    paused: { zh: '🔇 语音已暂停', en: '🔇 Voice paused' },
    disabled: { zh: '🔇 语音已关闭。点击设置→启用语音。', en: '🔇 Voice off. Settings → enable.' },
    idleWithButton: { zh: '🔊 点击播放Whaley快评', en: '🔊 Tap for Whaley recap' },
  },

  // ── 勿扰模式 ──
  dnd: {
    title: { zh: '🌙 勿扰时段', en: '🌙 Do Not Disturb' },
    description: { zh: '在设定的时段内，Whaley不会出声——除了崩盘级别的警告。', en: 'Whaley stays silent during these hours — except for crash-level alerts.' },
    override: { zh: '崩盘警告(>−3%)在勿扰时段仍会出声——这个关不掉。', en: 'Crash alerts (>−3%) will still play during DND — this cannot be turned off.' },
    enabledStatus: { zh: '🌙 勿扰模式开启 — {startTime}-{endTime}', en: '🌙 DND active — {startTime}-{endTime}' },
  },

  // ── 播报事件类型选择 ──
  eventTypes: [
    { id: 'market_open_close', zh: '🌅🌇 开盘收盘', en: '🌅🌇 Open & Close' },
    { id: 'watchlist_alert', zh: '⭐ 自选异动', en: '⭐ Watchlist Alerts' },
    { id: 'crash_alert', zh: '🆘 崩盘预警', en: '🆘 Crash Alert' },
    { id: 'ai_briefing', zh: '🤖 AI快评', en: '🤖 AI Briefing' },
    { id: 'weekly_summary', zh: '📊 周报总结', en: '📊 Weekly Summary' },
  ],
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getVoiceScript(id: string): VoiceScript | undefined {
  return VOICE_SCRIPTS.find(s => s.id === id);
}

export function getScriptsByType(type: VoiceScriptType): VoiceScript[] {
  return VOICE_SCRIPTS.filter(s => s.type === type);
}

export function getScriptText(id: string, lang: 'zh' | 'en' = 'zh'): string {
  const s = getVoiceScript(id);
  return s ? s[lang] : '';
}

export function getAppropriateTone(changePct: number): VoiceTone {
  if (changePct > 2) return 'celebratory';
  if (changePct > 0.5) return 'energetic';
  if (changePct > -1) return 'calm';
  if (changePct > -3) return 'urgent';
  return 'soothing';
}

export default VOICE_SCRIPTS;
