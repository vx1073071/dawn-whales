// ══ R283 QClaw Task 2: 社交比较文案 (3h) ══
// 交付: src/lib/factor/social-comparison-copy-r283.ts
// 覆盖: 排行标签/维度/徽章/分享/排行榜/建设性反馈
// 配合: ML R283 社交比较UI + 因子竞技场前端
//
// 品牌: Whaley 陪伴式比较 + 不制造焦虑 + 数据说话

// ═══════════ 比较维度定义 ═══════════

export interface ComparisonDimension {
  id: string;
  label: string;           // ≤6字
  emoji: string;
  description: string;     // 在比什么
  higherIsBetter: boolean; // true=高好, false=低好
  percentileLabel: string; // 你的百分位怎么说
}

export const COMPARISON_DIMENSIONS: ComparisonDimension[] = [
  {
    id: 'factor_diversity',
    label: '因子广度',
    emoji: '🗺️',
    description: '你使用过多少种不同类型的因子',
    higherIsBetter: true,
    percentileLabel: '你的因子宽度超过了',
  },
  {
    id: 'factor_depth',
    label: '因子深度',
    emoji: '🔬',
    description: '你最常用的因子平均使用天数',
    higherIsBetter: true,
    percentileLabel: '你的因子坚持力超过了',
  },
  {
    id: 'win_rate',
    label: '因子胜率',
    emoji: '🎯',
    description: '你选的因子整体帮你赚了多少',
    higherIsBetter: true,
    percentileLabel: '你的因子眼光超过了',
  },
  {
    id: 'journal_streak',
    label: '记录坚持',
    emoji: '📝',
    description: '你连续记录日记多少天了',
    higherIsBetter: true,
    percentileLabel: '你的自律超过了',
  },
  {
    id: 'backtest_count',
    label: '回测次数',
    emoji: '🧪',
    description: '你做过的因子回测总次数',
    higherIsBetter: true,
    percentileLabel: '你的验证次数超过了',
  },
  {
    id: 'sharing',
    label: '分享贡献',
    emoji: '🤝',
    description: '你分享因子见解的次数',
    higherIsBetter: true,
    percentileLabel: '你的分享超过了',
  },
  {
    id: 'overtrading',
    label: '少折腾',
    emoji: '🧘',
    description: '你平均每天浏览因子次数（越少越稳）',
    higherIsBetter: false,
    percentileLabel: '你比',
  },
];

// ═══════════ 百分位标签 (5档) ═══════════

export interface PercentileTier {
  range: [number, number]; // [min, max) percentile
  label: string;           // 你自己看到的标签
  peerLabel: string;       // 别人看到的标签
  emoji: string;
  tone: 'celebratory' | 'encouraging' | 'motivational' | 'humble';
}

export const PERCENTILE_TIERS: PercentileTier[] = [
  {
    range: [90, 100],
    label: '🐋 鲸灵级别',
    peerLabel: '🐋 顶级',
    emoji: '👑',
    tone: 'celebratory',
  },
  {
    range: [70, 90],
    label: '📈 进阶高手',
    peerLabel: '📈 高阶',
    emoji: '💪',
    tone: 'encouraging',
  },
  {
    range: [40, 70],
    label: '📊 中坚力量',
    peerLabel: '📊 中坚',
    emoji: '👋',
    tone: 'motivational',
  },
  {
    range: [15, 40],
    label: '🌱 成长学徒',
    peerLabel: '🌱 学徒',
    emoji: '🌱',
    tone: 'motivational',
  },
  {
    range: [0, 15],
    label: '🎓 初学者',
    peerLabel: '🎓 新手',
    emoji: '🐣',
    tone: 'humble',
  },
];

// ═══════════ Whaley 比较旁白 ═══════════

export const WHALEY_COMPARISON_NARRATIVES: Record<string, string[]> = {
  // 顶级 (90-100%)
  top_tier: [
    '你是那10%的因子深度用户。不只因为数据好——因为你知道每个因子在说什么。',
    '顶级不是目的——是你每次都会问「这个因子说的对吗」的结果。',
    '你现在的位置，是用一次次的记录和反思换来的。骄傲吧。🐋',
  ],
  // 高阶 (70-90%)
  high_tier: [
    '你在前30%——已经和大多数用户拉开了差距。再往前一步就是顶级。',
    '到了这个位置，差距不在知识在习惯。每天多写一句日记就够了。',
    '别人还在猜的时候，你已经能看出因子在说什么。继续。',
  ],
  // 中坚 (40-70%)
  middle_tier: [
    '你在正中间——比一半人好，也因为另一半人在提醒你不要停下来。',
    '中坚力量是平台最重要的用户。你不浮躁，你在稳扎稳打提升。',
    '这个位置说明你认真了——只是还没形成肌肉记忆。练下去。',
  ],
  // 学徒 (15-40%)
  apprentice_tier: [
    '你刚开始但已经上路了。别忘了——所有顶级都是从学徒开始的。',
    '还在学习期的人，反馈最明显。下个月你会看到数字不一样的。',
    '别着急和别人比。先和自己比——上次你看不懂的因子这次看懂了吗？',
  ],
  // 新手 (0-15%)
  beginner_tier: [
    '欢迎来到因子世界！你现在看到的每一个数字都是一扇窗户。',
    '新手不是坏事——新手有最大的成长空间。一个月后回头看你会吓一跳。',
    '别怕数字不好看。这个数今天不出色，但明天你再来看。🐋',
  ],
  // 进步中
  improving: [
    '你的排名在上升——不只是运气，是你真的在进步。',
    '进步的人有一个共同特征：他们在写日记。你也在写吗？',
    '下个百分位就差一步了。你上个周期做对了什么？再做一次。',
  ],
  // 退步中
  declining: [
    '排名下滑了——别慌。这可能是你最近太忙了，不是退步。',
    '降到这一档不是退步——是你最近没空跟因子聊天。回来就好。',
    '市场的节奏和你个人的节奏不总是同步。慢一点不等于退步。🐋',
  ],
};

// ═══════════ 社交徽章 ═══════════

export interface SocialBadge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  shareText: string; // 分享文案
}

export const SOCIAL_BADGES: SocialBadge[] = [
  { id: 'first_share', name: '第一次分享', emoji: '📤', description: '你第一次在社区分享了你的因子见解', rarity: 'common', shareText: '我第一次在 QUANT MOO 分享因子心得！' },
  { id: 'helpful_5', name: '有帮助的伙伴', emoji: '❤️', description: '你的分享被5个人标记为有帮助', rarity: 'uncommon', shareText: '我的因子分享帮到了5个人——感觉比赚钱还好。' },
  { id: 'helpful_50', name: '社区导师', emoji: '🏅', description: '你的分享被50个人标记为有帮助', rarity: 'rare', shareText: '50个人说我的因子分析对他们有用——这是我最好的回报。' },
  { id: 'arena_3wins', name: '三连胜', emoji: '⚔️', description: '你在因子竞技场连胜三场', rarity: 'rare', shareText: '竞技场三连胜！我的因子组合正在输出信号。' },
  { id: 'arena_10wins', name: '十连霸主', emoji: '🏆', description: '你在因子竞技场赢了十场', rarity: 'epic', shareText: '竞技场十胜——我的因子直觉越来越准。' },
  { id: 'factor_gourmet', name: '因子美食家', emoji: '👨‍🍳', description: '你完成了10个因子食谱（Recipe）', rarity: 'uncommon', shareText: '因子食谱 10/10——我知道每个因子该跟谁搭。' },
  { id: 'insight_featured', name: '精选洞察', emoji: '⭐', description: '你的因子洞察被社区精选推荐', rarity: 'epic', shareText: '我的因子分析被官方精选了！去看看。' },
  { id: 'mentor', name: '新人导师', emoji: '🧑‍🏫', description: '你回答了5个新用户的因子问题', rarity: 'rare', shareText: '帮新人看懂因子——教学相长。' },
  { id: '100_day_streak', name: '百日因子修行', emoji: '💯', description: '连续100天记录因子日记', rarity: 'legendary', shareText: '💯天因子日记完成！我用100天证明坚持比天赋重要。' },
  { id: 'factor_explorer_200', name: '200因子探索家', emoji: '🌐', description: '你探索了200个不同的因子', rarity: 'legendary', shareText: '200因子探索完成——我对市场的理解维度翻倍了。' },
  { id: 'top_1_percent', name: '1% 俱乐部', emoji: '👑', description: '你的因子胜率进入社区前1%', rarity: 'legendary', shareText: '进入了 QUANT MOO 因子胜率前1%。不是骄傲——是坚持的力量。' },
  { id: 'first_mentor_badge', name: '良师益友', emoji: '💡', description: '你第一次在社交比较中给了别人建设性反馈', rarity: 'uncommon', shareText: '我今天给了另一个交易员建议——我以前也是从别人帮我才开始的。' },
];

// ═══════════ 比较卡片文案 ═══════════

export interface ComparisonCardCopy {
  /** 卡片标题 */
  title: string;
  /** 维度列表标题 */
  dimensionsTitle: string;
  /** 你的位置标签 */
  yourPosition: string;
  /** 同行平均标签 */
  peerAverage: string;
  /** 各维度具体比较 */
  dimensionLabels: Record<string, { myScore: string; peerAvg: string; difference: string }>;
}

export const COMPARISON_CARD_DEFAULTS: ComparisonCardCopy = {
  title: '你跟同行比怎么样',
  dimensionsTitle: '因子使用对比',
  yourPosition: '你的位置',
  peerAverage: '同行平均',
  dimensionLabels: {
    factor_diversity: { myScore: '你用过', peerAvg: '平均用', difference: '差' },
    factor_depth: { myScore: '你深挖', peerAvg: '平均挖', difference: '差' },
    win_rate: { myScore: '你的胜率', peerAvg: '平均胜率', difference: '差' },
    journal_streak: { myScore: '你坚持', peerAvg: '平均坚持', difference: '差' },
    backtest_count: { myScore: '你回测了', peerAvg: '平均回测', difference: '差' },
    sharing: { myScore: '你分享了', peerAvg: '平均分享', difference: '差' },
    overtrading: { myScore: '你每天翻', peerAvg: '平均翻', difference: '差' },
  },
};

// ═══════════ 竞技场文案 ═══════════

export const ARENA_COPY = {
  // 入场
  entry: {
    title: '⚔️ 因子竞技场',
    subtitle: '跟同行比谁的因子组合更准',
    rules: [
      '从题库中选一个市场场景',
      '用你的因子组合给出判断',
      '看结果—谁更接近实际走势',
      '赢的拿勋章，输的学经验',
    ],
    startButton: '开始对决',
  },
  // 对决中
  inMatch: {
    awaitingResult: '双方已提交——等待结果揭晓...',
    yourPick: '你的因子选择',
    opponentPick: '对手的因子选择',
    analyzing: '🐋 Whaley 正在分析...',
  },
  // 结果
  results: {
    youWon: {
      title: '🏆 你赢了！',
      description: '你的因子组合更准确地预判了市场走势。',
      whaleySays: '赢得好！但不是因为你的因子比对手的好——是因为你更懂怎么用它。',
      shareText: '我在因子竞技场赢了一场！我的因子直觉正在变强。',
    },
    youLost: {
      title: '📚 这次输了',
      description: '没关系——看看对手用了哪些你没用的因子。',
      whaleySays: '输比赢学得多。对手用了哪个你没想到的因子？那就是你的盲区。',
      shareText: '输了一场因子对决——但学到了一个我没想到的因子角度。',
    },
    draw: {
      title: '🤝 平局！',
      description: '你们俩想到一块去了——都对，也都漏了同样的东西。',
      whaleySays: '平局不是没结果——说明这个市场场景非常清晰，所有人的直觉都一致。',
    },
  },
  // 排名
  leaderboard: {
    title: '🏅 本周期排行榜',
    columns: ['排名', '玩家', '胜场', '胜率', '常用因子'],
    empty: '还没人在这里——你是第一个敢来挑战的吗？',
    refreshHint: '每周末结算周冠军',
  },
};

// ═══════════ 社交分享模板 ═══════════

export const SHARE_TEMPLATES = [
  {
    id: 'win_rate_share',
    trigger: '因子胜率 > 60%',
    template: '我的因子胜率到了 {{winRate}}%！超过 {{percentile}}% 的 QUANT MOO 用户。不是运气——是每次日记都记了教训。 #因子日记',
  },
  {
    id: 'streak_share',
    trigger: '连续记录 > 7天',
    template: '{{days}}天因子日记！从瞎看到真的懂——记录的力量比我想象的大。🐋 #因子修行',
  },
  {
    id: 'milestone_share',
    trigger: '达成里程碑',
    template: '{{milestoneName}} 🎉 在 QUANT MOO 的又一步。每个里程碑都是一个教训的果实。',
  },
  {
    id: 'arena_win_share',
    trigger: '竞技场获胜',
    template: '因子竞技场 → 赢了！我的 {{factor1}}+{{factor2}}+{{factor3}} 组合预判对了这次走势。 @{{opponent}} 下次再来！⚔️',
  },
  {
    id: 'insight_share',
    trigger: '用户写了深刻反思',
    template: '今天学到的：{{insight}}。市场教我的，我记下来。 #因子日记',
  },
  {
    id: 'mentor_share',
    trigger: '帮助了新人',
    template: '今天帮一个新人解释了{{factorName}}因子。想当初我也是一头雾水——现在能帮人了，感觉真好。🤝',
  },
];

// ═══════════ 建设性反馈模板 ═══════════

export const CONSTRUCTIVE_FEEDBACK = {
  // 鼓励型（当你比对方好时）
  encourage: [
    '你用的这几个因子搭配很有意思——要不要试试再加一个{{factorName}}？',
    '看你的因子记录很有启发。你在{{dimension}}上的做法我想学学。',
    '你进步好快！上次你在{{dimension}}还是{{oldScore}}，现在已经{{newScore}}了。',
  ],
  // 建议型（中性）
  suggest: [
    '注意你在{{dimension}}上的数据——如果能在这里调整一下，下次可能会不一样。',
    '你试过用{{factorA}}替换{{factorB}}吗？在市场{{condition}}的时候{{factorA}}更准。',
    '我看到你在{{dimension}}的波动比较大——是不是市场切换时你用的因子没跟着变？',
  ],
  // 求助型（当你比对方差时）
  askForHelp: [
    '你在{{dimension}}比我强好多！能分享一下你是怎么做到的吗？',
    '你的{{factorName}}用得真稳——有什么特别的用法可以教教我吗？',
    '我刚看了你的因子日记——你在{{scenario}}时的判断逻辑是什么？想学。🙏',
  ],
};

// ═══════════ 社交比较推送文案 ═══════════

export const COMPARISON_PUSH_COPY = {
  // 每周报告
  weekly_report: {
    title: '📊 你的因子周报',
    body: '这周你在{{topDimension}}上超过了{{percentile}}%的人。来看看完整的。',
  },
  // 突破提醒
  breakthrough: {
    title: '🎉 {{dimension}}突破！',
    body: '你的{{dimension}}进入了前{{percentile}}%！这是你坚持{{action}}的结果。',
  },
  // 竞技场提醒
  arena_reminder: {
    title: '⚔️ 有人挑战你！',
    body: '{{challenger}}在因子竞技场向你发起挑战。接受还是拒绝？',
  },
  // 帮助提醒
  help_request: {
    title: '🤝 {{user}}需要你的帮助',
    body: '有人在你擅长的{{dimension}}上问了问题——你能帮帮他吗？',
  },
  // 趋势提醒
  trend_alert: {
    title: '📉 你的{{dimension}}排名在下降',
    body: '别焦虑——可能只是最近市场变了。来看看是哪里出了问题。',
  },
};

// ═══════════ 新人 onboarding 比较引导 ═══════════

export const COMPARISON_ONBOARDING = {
  title: '🪞 看看别人怎么用因子',
  steps: [
    {
      title: '了解你的位置',
      desc: '看到你在全体用户中的排名——不是攀比，是对标。',
    },
    {
      title: '向同行学习',
      desc: '找到比你强的人——看他们用什么因子、怎么搭配。',
    },
    {
      title: '请教 & 分享',
      desc: '问你想学的，帮你想帮的人。社交让因子活起来。',
    },
  ],
  privacyNote: '🔒 你的排名只有你自己能看到。分享出去的内容你说了算。我们不公开你的百分比——除非你选择展示。',
};

export default {
  COMPARISON_DIMENSIONS,
  PERCENTILE_TIERS,
  WHALEY_COMPARISON_NARRATIVES,
  SOCIAL_BADGES,
  COMPARISON_CARD_DEFAULTS,
  ARENA_COPY,
  SHARE_TEMPLATES,
  CONSTRUCTIVE_FEEDBACK,
  COMPARISON_PUSH_COPY,
  COMPARISON_ONBOARDING,
};
