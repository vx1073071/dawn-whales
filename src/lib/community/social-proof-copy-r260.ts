// ══ R260 QClaw Task 2: 社交证明文案 ══
// Social proof copy — FOMO triggers, community validation, engagement nudges
// Design: 不是\"虚假的紧迫感\"——是\"真实的数据告诉你别人在做什么\"。
// 原则: 只展示\"真实发生的\"行为，不编造数字，不制造假稀缺

export interface SocialProofToken {
  id: string;
  category: 'ACTIVITY' | 'CONSENSUS' | 'TRENDING' | 'ACHIEVEMENT' | 'TRUST' | 'ENGAGEMENT' | 'SCARCITY';
  placement: string;          // 出现在哪里
  template: string;           // 可变模板（{}占位符）
  dataSource: string;         // 数据来源（必须可验证）
  trigger: string;            // 何时显示
  cooldown: string;           // 冷却时间（避免\"刷屏\"）
}

export const SOCIAL_PROOF_TOKENS: SocialProofToken[] = [

  // ═══════════ ACTIVITY — 实时活动 ═══════════
  {
    id: 'watching-now', category: 'ACTIVITY',
    placement: '个股K线页顶部栏',
    template: '👀 {count}人正在看这只股票',
    dataSource: 'WebSocket在线用户数(当前查看{symbol}的会话数)',
    trigger: 'count ≥ 5',
    cooldown: '每30秒最多更新一次',
  },
  {
    id: 'analyzing-now', category: 'ACTIVITY',
    placement: '个股分析面板',
    template: '🔍 过去1小时有{count}人在这只股票上用了AI分析',
    dataSource: 'AI分析调用计数（匿名聚合）',
    trigger: 'count ≥ 3',
    cooldown: '每1小时最多显示一次',
  },
  {
    id: 'signals-today', category: 'ACTIVITY',
    placement: '信号广场顶部',
    template: '📡 今天社区已发布{count}个信号',
    dataSource: '信号帖计数（当日累计）',
    trigger: 'count ≥ 1 (持续显示)',
    cooldown: '实时更新',
  },
  {
    id: 'discussing-now', category: 'ACTIVITY',
    placement: '讨论区顶部',
    template: '💬 {count}人正在这个讨论区',
    dataSource: 'WebSocket在线用户数(当前查看该讨论区的会话数)',
    trigger: 'count ≥ 2',
    cooldown: '每60秒最多更新一次',
  },
  {
    id: 'joined-recently', category: 'ACTIVITY',
    placement: '新用户首页',
    template: '🤝 今天已有{count}位新投资者加入社区',
    dataSource: '注册计数（当日累计）',
    trigger: 'count ≥ 1 (仅新用户注册后7天内显示)',
    cooldown: '每天更新一次',
  },

  // ═══════════ CONSENSUS — 社区共识 ═══════════
  {
    id: 'bullish-consensus', category: 'CONSENSUS',
    placement: '个股K线页底部(信号汇总)',
    template: '📊 社区信号: {pct}%看多 · {count}个信号 · 近7天准确率{accuracy}%',
    dataSource: '该股票相关的社区看多/看空信号比例',
    trigger: 'count ≥ 3',
    cooldown: '每1小时更新',
  },
  {
    id: 'bearish-consensus', category: 'CONSENSUS',
    placement: '个股K线页底部(信号汇总)',
    template: '⚠️ 社区信号: {pct}%看空 · {count}个信号 — \"多数人在警惕\"',
    dataSource: '该股票相关的社区看多/看空信号比例',
    trigger: 'count ≥ 3 AND bearPct ≥ 60%',
    cooldown: '每1小时更新',
  },
  {
    id: 'divided-consensus', category: 'CONSENSUS',
    placement: '个股K线页底部(信号汇总)',
    template: '⚖️ 社区分歧巨大 — {bullPct}%看多 vs {bearPct}%看空 · {count}个信号',
    dataSource: 'bullPct 和 bearPct 都在40-60%之间',
    trigger: 'count ≥ 5 AND |bullPct - bearPct| < 15%',
    cooldown: '每1小时更新',
  },
  {
    id: 'top-analyst-bullish', category: 'CONSENSUS',
    placement: '个股K线页',
    template: '⭐ {name}(L{level})刚刚发布了{symbol}的看多信号——\"{reason}\"',
    dataSource: 'L3+用户的最新相关信号',
    trigger: '有L3+用户发布该股票信号',
    cooldown: '同一个L3+用户对该股票的信号24h内仅显示一次',
  },
  {
    id: 'sector-consensus', category: 'CONSENSUS',
    placement: '板块页',
    template: '🔥 社区共识: {sector}是本周讨论最多的板块({postCount}篇分析)',
    dataSource: '板块相关的帖子和信号计数',
    trigger: '该板块帖子数在所有板块中排Top3',
    cooldown: '每天更新一次',
  },

  // ═══════════ TRENDING — 趋势/热度 ═══════════
  {
    id: 'trending-signal', category: 'TRENDING',
    placement: '信号广场Hot Tab',
    template: '🔥 热议中 — {interactionCount}次互动 · {commentCount}条评论',
    dataSource: '帖子互动次数(点赞+评论+跟单)',
    trigger: 'interactionCount in top 10% of posts',
    cooldown: '实时更新',
  },
  {
    id: 'trending-stock', category: 'TRENDING',
    placement: '热力图顶部',
    template: '📈 今日社区最关注: {symbol} — {postCount}个信号帖',
    dataSource: '各股票关联的信号帖数量排名',
    trigger: 'postCount为当日最高',
    cooldown: '每30分钟更新',
  },
  {
    id: 'trending-strategy', category: 'TRENDING',
    placement: '策略市场首页',
    template: '🏆 本周最受欢迎策略: \"{strategyName}\" — {downloadCount}人下载',
    dataSource: '策略模板下载/使用次数',
    trigger: 'downloadCount为本周最高',
    cooldown: '每天更新一次',
  },
  {
    id: 'trending-analyst', category: 'TRENDING',
    placement: '社区首页侧边栏',
    template: '🌟 本周新星: {name} — 发布了{signalCount}个信号，准确率{accuracy}%',
    dataSource: '新用户(<30天)中准确率最高者',
    trigger: '每周一重新计算',
    cooldown: '每周更新一次',
  },

  // ═══════════ ACHIEVEMENT — 成就展示 ═══════════
  {
    id: 'streak-milestone', category: 'ACHIEVEMENT',
    placement: '用户个人推送',
    template: '🔥 你已连续{days}天在社区\"露面\"！还有{daysToNext}天解锁下一个徽章。',
    dataSource: '用户连续签到天数',
    trigger: 'days in [3, 6, 13, 29, 99] (里程碑的前一天)',
    cooldown: '到达里程碑时推送一次',
  },
  {
    id: 'accuracy-milestone', category: 'ACHIEVEMENT',
    placement: '用户个人推送',
    template: '🏅 你的信号准确率达到了{accuracy}% — 超过了社区{pct}%的分析师！',
    dataSource: '用户的信号验证准确率',
    trigger: 'accuracy进入新的10%分位数',
    cooldown: '每个档位最多推送一次',
  },
  {
    id: 'follower-milestone', category: 'ACHIEVEMENT',
    placement: '用户个人推送',
    template: '👥 {count}人在关注你的分析！你的第{count}个关注者刚刚来了。',
    dataSource: '用户关注者数量',
    trigger: 'count in [1, 5, 10, 50, 100, 500]',
    cooldown: '每个整数里程碑推送一次',
  },
  {
    id: 'post-milestone', category: 'ACHIEVEMENT',
    placement: '用户个人推送',
    template: '✍️ 你已经在社区发布了{count}篇帖子。其中{verifiedCount}篇被社区验证为\"有价值的分析\"。',
    dataSource: '用户发帖+精选帖计数',
    trigger: 'count in [1, 10, 50, 100]',
    cooldown: '每个里程碑推送一次',
  },

  // ═══════════ TRUST — 信任信号 ═══════════
  {
    id: 'verified-accuracy', category: 'TRUST',
    placement: '信号帖详情页',
    template: '✅ 此信号含验证数据 — 历史准确率{accuracy}% · 验证了{verifiedCount}个信号',
    dataSource: '信号发布者的回测/实盘验证数据',
    trigger: '发布者有已验证的信号记录',
    cooldown: '静态显示(不刷新)',
  },
  {
    id: 'verified-by-backtest', category: 'TRUST',
    placement: '策略市场策略详情页',
    template: '🔬 此策略已回测验证 — 胜率{winRate}% · 夏普{sharpe} · 最大回撤{maxDrawdown}%',
    dataSource: '策略回测结果',
    trigger: '策略有回测数据',
    cooldown: '静态显示',
  },
  {
    id: 'level-badge', category: 'TRUST',
    placement: '用户头像旁(全局)',
    template: 'L{level} · {levelName}',
    dataSource: '用户社区等级',
    trigger: 'level ≥ 2',
    cooldown: '静态显示',
  },
  {
    id: 'badge-showcase', category: 'TRUST',
    placement: '用户个人主页顶部',
    template: '🏅 {badgeName} — {badgeDescription}',
    dataSource: '用户获得的徽章',
    trigger: '有徽章',
    cooldown: '显示最近获得的3个',
  },

  // ═══════════ ENGAGEMENT — 互动触发 ═══════════
  {
    id: 'comment-on-your-post', category: 'ENGAGEMENT',
    placement: '推送通知',
    template: '💬 {name}评论了你的分析: \"{snippet}\"',
    dataSource: '用户帖子的新评论',
    trigger: '有新评论',
    cooldown: '同一帖子24h内最多推送3次',
  },
  {
    id: 'your-signal-verified', category: 'ENGAGEMENT',
    placement: '推送通知',
    template: '🎯 你7天前发布的{symbol}信号被验证为**正确**！(预测{dir} {pct}%，实际{dir} {actualPct}%)',
    dataSource: '信号预测结果 vs 实际走势',
    trigger: '期到验证时',
    cooldown: '每个信号验证推送一次',
  },
  {
    id: 'someone-followed-you', category: 'ENGAGEMENT',
    placement: '推送通知',
    template: '👤 {name}关注了你 — 你已经有{totalCount}位关注者了',
    dataSource: '新关注',
    trigger: '有新关注',
    cooldown: '同一关注者只推送一次',
  },
  {
    id: 'strategy-purchased', category: 'ENGAGEMENT',
    placement: '推送通知',
    template: '💰 有人购买了你的策略\"{strategyName}\"！收入+{amount} USDT (扣除{commission}%平台费后)',
    dataSource: '策略市场交易记录',
    trigger: '策略被购买',
    cooldown: '实时推送（每笔交易一次）',
  },

  // ═══════════ SCARCITY — 稀缺/紧迫 ═══════════
  {
    id: 'masterclass-seats', category: 'SCARCITY',
    placement: '月度大师课报名页',
    template: '🎓 仅剩{remaining}/{total}席 — {name}的月度大师课',
    dataSource: '预约席位计数 vs 总席位',
    trigger: 'remaining ≤ total * 0.5 (已满50%)',
    cooldown: '仅在席位变化时更新',
  },
  {
    id: 'limited-free-trial', category: 'SCARCITY',
    placement: 'AI快评首次使用',
    template: '🎁 你有{remaining}次免费AI快评剩余 — 之后{cost} USDT/次',
    dataSource: '用户免费试用配额',
    trigger: 'remaining ≤ 3',
    cooldown: '每次使用AI快评时显示',
  },
  {
    id: 'strategy-early-bird', category: 'SCARCITY',
    placement: '策略市场',
    template: '🕐 \"{strategyName}\"限时{cost} USDT — 3天后恢复原价{originalCost} USDT',
    dataSource: '策略定价信息',
    trigger: '策略有促销价',
    cooldown: '仅在促销期内显示',
  },
  {
    id: 'weekly-challenge-ending', category: 'SCARCITY',
    placement: '社区首页',
    template: '⏰ 本周挑战还剩{hours}小时 — 已完成{completed}%',
    dataSource: '用户本周挑战进度',
    trigger: 'hours ≤ 24',
    cooldown: '每4小时更新',
  },

];

// ═══════════════════════════════════════
// 社交证明设计原则（团队内部参考）
// ═══════════════════════════════════════

export const SOCIAL_PROOF_PRINCIPLES = {
  title: '📐 社交证明设计原则',

  rules: [
    {
      rule: '只展示真实数据',
      description: '不编造数字。\"{count}人正在看\"的count必须是WebSocket实时在线数的真实值。如果只有2个人在看→不显示watching-now token。',
      antiPattern: '不要说\"数百人在看\"如果实际只有50人。不要说\"大家都在用\"——量化它。',
    },
    {
      rule: '不制造假稀缺',
      description: '如果席位没有限制→不要说\"仅剩X席\"。如果免费试用没有配额限制→不要说\"剩余X次\"。假稀缺被拆穿=永远失去信任。',
      antiPattern: '\"仅剩2个名额\"——如果实际上没限制=欺骗。',
    },
    {
      rule: '成就只展示\"不容易达成\"的',
      description: '如果90%的人都有某个徽章→这个徽章没有\"证明力\"。徽章和等级的设计必须含金量递增——L4大师的比例不应超过2%。',
      antiPattern: '\"获得新人徽章\"=99%的人都有→没有社交证明价值。',
    },
    {
      rule: '负面共识也要展示',
      description: '如果社区60%看空某只股票→展示出来。只展示看多信号=选择性信息。真实的社交证明包含\"分歧\"和\"负面共识\"。',
      antiPattern: '永远不说看空——用户会发现你在\"报喜不报忧\"。',
    },
    {
      rule: '冷却=尊重',
      description: '不要反复推送同样的社交证明。冷却时间让每条证明都\"新鲜\"——而不是\"又来了\"。',
      antiPattern: '每5分钟推送\"X人在看\"=被用户关掉推送。',
    },
  ],

  doNotDo: [
    '不要用\"其他投资者正在买\"来暗示用户应该买',
    '不要隐藏\"看空\"的社区共识来制造\"大家都在买\"的假象',
    '不要用\"仅剩\"来制造假紧迫',
    '不要在数据点太小（count<5）的时候展示百分比（\"67%看多\"=4个人里有2.68个，没意义）',
    '不要展示用户的具体持仓、金额、P&L（除非用户主动选择公开）',
  ],
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getSocialProofToken(id: string): SocialProofToken | undefined {
  return SOCIAL_PROOF_TOKENS.find(t => t.id === id);
}

export function getTokensByCategory(cat: string): SocialProofToken[] {
  return SOCIAL_PROOF_TOKENS.filter(t => t.category === cat);
}

export function getTokensByPlacement(placement: string): SocialProofToken[] {
  return SOCIAL_PROOF_TOKENS.filter(t => t.placement.includes(placement));
}

export function formatSocialProof(id: string, vars: Record<string, string | number>): string {
  const token = getSocialProofToken(id);
  if (!token) return '';
  let result = token.template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return result;
}

export default SOCIAL_PROOF_TOKENS;
