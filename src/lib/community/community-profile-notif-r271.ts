// ══ R271 QClaw Task 2: 社区分享文案 (2h) ══ — 增强版
// 用户资料页+通知系统+排行榜 — 社区三大扩展
// 交付: 这3块的完整文案配置

export const COMMUNITY_ENHANCED = {

  // ── 用户个人资料页 ──
  profile: {
    header: {
      username: "@{username}",
      level: "Lv.{level} {title}",
      joinDate: "{days}天前加入",
      bio: "个人简介",
      bioPlaceholder: "写一句话让别人记住你…",
      edit: "编辑资料",
    },
    titles: {
      novice: "新手",
      learner: "学习者",
      contributor: "贡献者",
      sharpshooter: "神射手",
      sage: "智者",
    },
    stats: {
      accuracy: "分析准确率",
      totalPosts: "帖子数",
      totalLikes: "获赞",
      followers: "粉丝",
      following: "关注",
      strategies: "策略数",
      earnings: "创作者收入",
    },
    tabs: {
      posts: "帖子",
      strategies: "策略",
      about: "关于",
    },
    emptyPosts: "还没有发布过分析",
    emptyStrategies: "还没有上架策略",
    accuracyNote: "{rate}%的分析被市场验证为正确。准确率=被市场走势验证的帖子数÷总帖子数。",
    levelNote: "等级按准确率排名——不是按粉丝数。这是QUANT MOO和所有其他平台的区别。",
  },

  // ── 通知系统 ──
  notifications: {
    title: "通知",
    empty: "暂无通知",
    filter: {
      all: "全部",
      mentions: "提及",
      replies: "回复",
      likes: "赞",
      follows: "关注",
      system: "系统",
    },
    templates: {
      like: "{username} 赞了你的分析 \"{title}\"",
      comment: "{username} 评论了你的分析 \"{title}\"",
      reply: "{username} 回复了你的评论",
      follow: "{username} 关注了你",
      mention: "{username} 在评论中提到了你",
      strategyBought: "有人买了你的策略 \"{strategyName}\" — 你获得了 {amount} USDT",
      accuracyMilestone: "🏆 你的分析准确率达到了 {rate}% — 升至 Lv.{level} {title}！",
      weeklyDigest: "本周行情回顾 — 上周你关注的 {count} 只股票表现如何",
      strategyTriggered: "你的策略 \"{strategyName}\" 触发了 — {condition}",
      marketUpdate: "📊 {symbol} 出现 {signal} — 点击查看",
      verifiedBadge: "🎖️ 你获得了已验证徽章 — 准确率 {rate}%",
      trendingPost: "🔥 你的分析 \"{title}\" 上了热门 — {views}次查看",
    },
    actions: {
      viewPost: "查看",
      viewProfile: "查看资料",
      reply: "回复",
      dismiss: "忽略",
      markRead: "标为已读",
      markAllRead: "全部已读",
    },
  },

  // ── 排行榜 ──
  leaderboard: {
    title: "信号大师",
    subtitle: "准确率排行 — 不是粉丝数，不是发帖量。是被市场验证的次数。",
    tabs: {
      accuracy: "准确率",
      weekly: "本周之星",
      earning: "创作者收入",
    },
    columns: {
      rank: "排名",
      user: "用户",
      accuracy: "准确率",
      verified: "已验证",
      posts: "分析数",
      followers: "粉丝",
    },
    entries: "上榜条件：至少发布10篇分析，其中至少5篇有市场验证结果。",
    empty: "还不够——等到更多用户完成足够的分析，这个排名会更有意义。",
    self: {
      label: "你的排名",
      notRanked: "你还没有上榜 — 发布10篇分析+5次验证后即可上榜",
    },
    accuracyTiers: [
      { min: 80, title: "🏆 大师", description: "准确率>80% — 在这个市场，80%已经是神" },
      { min: 65, title: "⭐ 专家", description: "准确率65-80% — 值得学习的交易者" },
      { min: 50, title: "📈 稳健", description: "准确率50-65% — 比扔硬币好" },
      { min: 30, title: "🌱 成长中", description: "准确率30-50% — 还在学习阶段" },
      { min: 0,  title: "🆕 新人", description: "准确率<30% — 每个大师都是从新手开始的" },
    ],
  },
};

export default COMMUNITY_ENHANCED;
