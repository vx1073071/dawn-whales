// ══ R259 QClaw Task 2: 社区留存设计 ══
// Community retention design — feature architecture, retention mechanics, content strategy
// Design: 不是"做个评论区"就完了——是从DAU到"每天不打开就难受"的完整留存体系

// ═══════════════════════════════════════
// PART A: 社区定位与架构
// ═══════════════════════════════════════

export const COMMUNITY_ARCHITECTURE = {
  vision: 'QUANT MOO社区不是一个"聊天的地方"——它是"投资者的第二个屏幕"。在这里你不是在消费内容，是在\"和别人的脑回路碰撞\"。',

  positioning: {
    whatItIs: '以策略分享+信号讨论为核心的投资者社区。不追求DAU，追求"有用"。',
    whatItIsNot: '不是社交媒体、不是论坛、不是聊天群。不需要"内容量"，需要"信号质"。',
    targetUser: '已经用QUANT MOO做分析的用户。社区=把分析结果"晒出来"让更多人看到。',
  },

  coreLoop: '分析(用QUANT MOO分析) → 分享(发到社区) → 反馈(别人点赞/评论/跟单) → 激励(获得等级/称号/收入) → 再次分析(动力增强) → 循环',
};

// ═══════════════════════════════════════
// PART B: 社区功能模块
// ═══════════════════════════════════════

export const COMMUNITY_FEATURES = {

  // ── B.1 内容广场 ──
  feed: {
    name: '📡 信号广场',
    description: '不是信息流——是"信号流"。用户分享的不是\"我对大盘的看法\"，是\"我发现了一个信号\"。',
    defaultTab: 'hot', // hot | following | new | verified
    tabs: [
      { id: 'hot', name: '🔥 热门', description: '当前讨论最多的信号和分析' },
      { id: 'following', name: '👥 关注', description: '你关注的人的分析和信号' },
      { id: 'new', name: '🆕 最新', description: '刚发布的信号和分析' },
      { id: 'verified', name: '✅ 验证', description: '被回测/实盘验证过的信号（准确率>60%）' },
    ],
    postTypes: [
      { id: 'signal', name: '📡 信号分享', description: '分享一个你发现的交易信号（自带K线截图+指标+理由）' },
      { id: 'analysis', name: '📊 策略分析', description: '发布你对某个策略/股票的分析（自带QUANT MOO分析面板导出）' },
      { id: 'question', name: '❓ 提问', description: '向社区提问——\"这个双底形态算有效吗？\"' },
      { id: 'track-record', name: '📋 战绩', description: '分享你的实盘战绩记录（跟券商API自动拉取）' },
    ],
    postTemplate: {
      required: ['标题≤30字', '至少一张K线/分析截图', '至少50字的分析理由'],
      optional: ['关联股票代码', '关联策略模板', '预测方向+时间范围'],
      forbidden: ['纯文字无图帖', '\"我觉得\"式无分析帖', '纯链接贴', '纯截图无文字'],
    },
  },

  // ── B.2 个人主页 ──
  profile: {
    name: '👤 个人主页',
    sections: [
      {
        id: 'stats', name: '📊 投资履历',
        items: [
          { id: 'tradeCount', label: '信号发布数', description: '累计在社区发布了多少个信号' },
          { id: 'accuracy', label: '准确率', description: '发布的信号中，事后验证正确的比例' },
          { id: 'followers', label: '关注者', description: '有多少人关注了你的分析' },
          { id: 'level', label: '等级', description: '社区等级——L1新手→L2进阶→L3专家→L4大师' },
          { id: 'streak', label: '连续签到', description: '连续登录天数' },
        ],
      },
      {
        id: 'badges', name: '🏅 成就徽章',
        description: '不是"参与奖"——每个徽章都代表一个被验证过的能力。',
        badges: [
          { id: 'signal-10', name: '信号猎人', description: '发布了10个被验证正确的信号', tier: 'bronze' },
          { id: 'signal-50', name: '信号大师', description: '发布了50个被验证正确的信号', tier: 'silver' },
          { id: 'accuracy-60', name: '六成先生', description: '准确率超过60%', tier: 'gold' },
          { id: 'accuracy-70', name: '七成高手', description: '准确率超过70%', tier: 'platinum' },
          { id: 'early-adopter', name: '早期居民', description: '社区上线第一个月加入', tier: 'special' },
          { id: 'streak-7', name: '连续7天', description: '连续登录7天', tier: 'bronze' },
          { id: 'streak-30', name: '月度全勤', description: '连续登录30天', tier: 'silver' },
          { id: 'streak-100', name: '百日坚持', description: '连续登录100天', tier: 'gold' },
          { id: 'helper', name: '热心帮助', description: '帮助10个提问者解决了问题', tier: 'silver' },
          { id: 'verified-strategy', name: '策略匠人', description: '发布了3个通过\"策略审核\"的策略模板', tier: 'gold' },
        ],
      },
    ],
  },

  // ── B.3 讨论区 ──
  discussion: {
    name: '💬 讨论区',
    rooms: [
      { id: 'general', name: '🌍 综合讨论', description: '什么都可以聊——但要有数据支撑' },
      { id: 'technical', name: '📐 技术分析', description: 'K线形态、指标使用、画线讨论' },
      { id: 'fundamental', name: '📊 基本面', description: '财报解读、估值讨论、行业分析' },
      { id: 'strategy', name: '⚙️ 策略交流', description: '策略设计、回测结果、参数优化' },
      { id: 'crypto', name: '₿ 加密货币', description: 'BTC/ETH和加密市场' },
      { id: 'hk-cn', name: '🇨🇳 港股A股', description: '港股和A股专题' },
      { id: 'beginner', name: '🌱 新手专区', description: '新手提问区——\"愚蠢的问题\"在这里不会被嘲笑' },
    ],
    rules: [
      '发言必须附带数据/图表/逻辑——禁止纯情绪表达（"垃圾"\"起飞\"禁用）',
      '提问前先搜索——同样的问题不发第二遍',
      '可以不同意但必须给理由——"我不同意因为..."比"你说得不对"强100倍',
      '不荐股——可以分析但不能喊单（\"快买\"\"快卖\"禁止）',
    ],
  },

  // ── B.4 策略市场(创作者) ──
  strategyMarket: {
    name: '🏪 策略市场',
    description: '社区中的"高级货"——其他人创建的策略模板在这里展示和销售。',
    tiers: [
      { id: 'free', name: '免费区', description: '任何用户可免费预览+使用的策略模板' },
      { id: 'premium', name: '付费区', description: '≥9.9 USDT，创作者分级抽成（L1:30%/L2:20%/L3:10%）' },
    ],
    listing: {
      required: ['策略名称', '至少1张回测结果截图', '回测时间段', '适用市场', '策略类型标签'],
      optional: ['实盘验证记录', '使用说明', '风险提示'],
      vetting: '提交后由社区AI审核（检测是否抄袭/参数过拟合/无意义策略）+ 人工抽查',
    },
  },

  // ── B.5 跟单大厅 ──
  copytrading: {
    name: '👣 跟单大厅',
    description: '看到别人发的信号？一键跟单——不是自动帮你买，是\"把别人的信号逻辑导入你自己的分析面板\"。',
    disclaimer: '⚠️ 跟单≠无脑复制。别人的信号只是你的"输入"——最终决定权在你手里。',
    features: [
      '查看信号发布者的历史准确率和最大回撤',
      '一键导入信号到你的分析面板（指标参数自动填充）',
      '设置跟单通知（这个人发了新信号→推给你）',
      '跟单后的操作记录（你的操作vs信号发布者的建议）',
    ],
  },
};

// ═══════════════════════════════════════
// PART C: 留存机制设计
// ═══════════════════════════════════════

export const RETENTION_MECHANICS = {

  // ── C.1 签到系统 ──
  checkIn: {
    name: '📅 每日签到',
    philosophy: '签到不是为了\"给你积分\"——签到是为了让你\"每天看一眼市场\"。签到时伴随一个微量的市场信息，让你形成\"每天看市场\"的习惯。',
    rewards: [
      { day: 1, reward: '今日市场温度（一句话）+ 1 USDT体验积分', name: '🌡️ 市场温度' },
      { day: 3, reward: '解锁"连续3天"徽章', name: '🏅 三日之初' },
      { day: 7, reward: '解锁"7日全勤"徽章 + AI快评1次免费', name: '🏅 七日坚持' },
      { day: 14, reward: '解锁"两周习惯"徽章', name: '🏅 两周习惯' },
      { day: 30, reward: '解锁"月度全勤"徽章 + 每周深度1个月免费', name: '🏅 月度全勤' },
      { day: 100, reward: '解锁"百日坚持"金徽章 + 你的名字出现在社区\"名人墙\"', name: '🏅 百日坚持' },
    ],
    streakBreak: '断签不要惩罚——\"别丧气，重新开始\"。历史连续记录保留但不计入当前streak。',
  },

  // ── C.2 等级体系 ──
  levelSystem: {
    name: '📈 投资者等级',
    philosophy: '不是看\"你发了多少帖\"——是看\"你的分析质量\"。等级=你在社区里的可信度。',
    levels: [
      { 
        level: 1, name: '🌱 探索者', requirement: '注册即可',
        perks: '发布信号、评论、点赞、加入讨论区',
        unlock: '注册时自动获得',
      },
      {
        level: 2, name: '📊 分析者', requirement: '发布10个信号 或 准确率>40%',
        perks: 'L1全功能 + 策略模板上架(免费区) + 数据导出 + 帖子可以被\"精华\"',
        unlock: '10个信号 或 验证准确率>40%',
      },
      {
        level: 3, name: '⭐ 信号者', requirement: '准确率>50% 且 至少20个信号 且 被验证信号>5个',
        perks: 'L2全功能 + 策略模板上架(付费区) + 跟单大厅曝光 + 优先出现在热门Feed',
        unlock: '准确率>50% + 20信号 + 5验证通过',
      },
      {
        level: 4, name: '💎 大师', requirement: '准确率>60% 且 被验证信号>50个 且 跟单者>100人',
        perks: 'L3全功能 + 社区\"特约分析师\"标识 + 你的分析会被Whaley优先引用 + 每季度\"大师见面\"线上活动邀请',
        unlock: '准确率>60% + 50验证 + 100跟单者（极难达到，含金量高）',
      },
    ],
    decay: '超过30天未活跃→等级保留但\"活跃状态\"降级（热门Feed优先级降低）。再次活跃后自动恢复。',
  },

  // ── C.3 每周挑战 ──
  weeklyChallenge: {
    name: '🎯 每周挑战',
    philosophy: '不是\"拉新\"活动——是\"让你把QUANT MOO用得更深\"。每周一个挑战=每周学会一个功能。',
    examples: [
      { week: '第1周', challenge: '发布你的第一个信号帖', reward: '🏅 初次发声' },
      { week: '第2周', challenge: '用回测功能验证一个策略', reward: '🔄 第一次回测' },
      { week: '第3周', challenge: '给别人的信号帖写一条有数据支撑的评论', reward: '💬 深度讨论者' },
      { week: '第4周', challenge: '连续7天签到', reward: '🏅 7日全勤' },
      { week: '第5周', challenge: '发布一个策略模板到市场', reward: '🏪 策略上架者' },
      { week: '第6周', challenge: '帮助一个提问者解决他的问题', reward: '🤝 热心帮助' },
      { week: '第7周', challenge: '在3个不同的讨论区发表有价值的评论', reward: '🌍 全域贡献者' },
      { week: '第8周', challenge: '发布一个"验证过"的信号（准确率被回测确认）', reward: '✅ 信号验证者' },
    ],
  },

  // ── C.4 深度互动机制 ──
  deepEngagement: {
    name: '💡 深度互动',
    mechanics: [
      {
        id: 'signal-battle', name: '🎮 信号对决',
        description: '两个用户对同一只股票发布相反的信号（看多vs看空）。7天后看谁对——对的人获得"对决胜者"徽章，错的人得到一个"教训"（不是惩罚，是学习提示）。',
        goal: '把"争对错"变成"学习机会"——错的人收到AI分析"为什么你错了"，对的人获得社区认可。',
      },
      {
        id: 'idea-incubator', name: '💡 点子孵化器',
        description: '用户发布一个"不成熟的想法"（比如"我发现RSI在科技股上比在银行股更准？"）。其他人帮忙用QUANT MOO回测验证→验证通过→点子升级为"社区验证策略"，提出者获得"点子王"徽章。',
        goal: '鼓励\"不完整的想法\"——社区的力量是\"帮你想完它\"。',
      },
      {
        id: 'monthly-masterclass', name: '🎓 月度大师课',
        description: 'L4大师每个月举办一次线上分享——\"我是怎么用QUANT MOO找到这个信号的\"。非L4用户可以预约席位（限量100人，先到先得）。',
        goal: 'L4大师=社区\"北极星\"——他们的存在让L1-L3有明确的\"想成为谁\"的目标。',
      },
    ],
  },
};

// ═══════════════════════════════════════
// PART D: 内容策略
// ═══════════════════════════════════════

export const CONTENT_STRATEGY = {

  // ── D.1 内容质量控制 ──
  qualityControl: {
    name: '🛡️ 内容质量',
    autoFilter: [
      '纯表情/纯数字贴 → 自动隐藏（\"666\"\"哈哈\"禁发）',
      '无图帖 → 低优先级排序（不出现在Hot Tab前10）',
      'AI检测抄袭（与现有帖子相似度>80%） → 自动标记"疑似重复"',
      '喊单检测（\"快买\"\"快卖\"\"必涨\"\"要崩\"） → 自动折叠+警告',
    ],
    manual: [
      '用户举报→社区管理员审核→警告/删帖/封禁',
      'Level 3+用户可以\"标记低质量帖\"（每标记1条消耗1点\"标记额度\"，每24h补充3点）',
    ],
  },

  // ── D.2 激励机制（非金钱） ──
  nonMonetaryRewards: {
    name: '🏆 非金钱激励',
    types: [
      {
        id: 'featured-post', name: '⭐ 精选帖',
        description: '每周社区管理员精选5篇高质量帖→出现在所有人的广场首页24小时',
        value: '曝光=关注者增长=更高的社区影响力',
      },
      {
        id: 'whaley-shoutout', name: '🐋 Whaley点名',
        description: 'Whaley在AI快评中引用你的分析（附带你的名字和链接）',
        value: '被AI点名的\"分析师\"=社区内最高荣誉之一',
      },
      {
        id: 'wall-of-fame', name: '🏛️ 名人墙',
        description: '每月更新——准确率Top10、最多被验证信号Top10、最活跃贡献者Top10',
        value: '永久展示在社区首页——是\"简历\"级别的荣誉',
      },
    ],
  },

  // ── D.3 新用户激活路径 ──
  onboarding: {
    name: '🚀 新用户激活（Day 1-7）',
    journey: [
      { day: 1, action: '注册 → 完成个人资料 → 关注3个系统推荐的L3+分析师 → 发一条"自我介绍"帖', goal: '让新用户完成第一个"产出"动作' },
      { day: 2, action: '浏览信号广场 → 给1篇分析帖留言（系统推荐"最能引发讨论的新帖"）', goal: '完成第一次互动' },
      { day: 3, action: '发布第一个信号帖（系统提示："你的自选里XXX今天突破了阻力位，要分享吗？"→一键发帖）', goal: '从"消费者"变成"生产者"' },
      { day: 5, action: '解锁策略回测功能 → 回测一个预设策略 → 把结果发到社区', goal: '体验QUANT MOO的核心分析功能' },
      { day: 7, action: '收到"7日回顾"——过去7天你在社区的足迹+本周最值得关注的分析师推荐', goal: '让用户看到"我来这里不是浪费时间的"' },
    ],
    activationMetric: '发布3个帖子+评论5条+关注5人 = \"已激活\"。',
  },
};

// ═══════════════════════════════════════
// PART E: 留存指标与目标
// ═══════════════════════════════════════

export const RETENTION_TARGETS = {
  name: '📊 留存目标',
  benchmarks: {
    d1:  { target: '40%', industry: '25-30%', description: '注册后第1天回来' },
    d7:  { target: '25%', industry: '10-15%', description: '注册后第7天还在' },
    d30: { target: '15%', industry: '5-8%',  description: '注册后第30天还在' },
    d90: { target: '10%', industry: '3-5%',  description: '注册后第90天仍在活跃' },
  },

  keyActions: {
    'lurker-to-poster': { target: '15%', description: '只浏览→发第一帖' },
    'poster-to-regular': { target: '30%', description: '发了第一帖→每周至少发1帖' },
    'regular-to-creator': { target: '10%', description: '每周发帖→发布策略模板到市场' },
    'creator-to-master': { target: '2%', description: '策略创作者→L4大师级别' },
  },

  northStar: '每周\"有意义的互动\"次数 ÷ 周活跃用户数 = 互动密度。目标：互动密度 > 3（平均每个活跃用户每周产生3次有意义的互动）。',
};

// ═══════════════════════════════════════
// PART F: 反滥用与社区治理
// ═══════════════════════════════════════

export const GOVERNANCE = {
  name: '⚖️ 社区治理',

  moderationLevels: [
    { level: 'AI自动', actions: '自动折叠低质量帖、自动标记抄袭、自动检测喊单词', speed: '即时' },
    { level: 'L3+用户标记', actions: 'L3+用户标记的帖子优先进入审核队列', speed: '1-4小时' },
    { level: '社区管理员', actions: '审核被标记的帖子、处理举报、执行处罚', speed: '4-24小时' },
  ],

  penaltyLadder: [
    { offense: 1, penalty: '警告+帖子自动隐藏', duration: '即时' },
    { offense: 2, penalty: '禁止发帖24小时', duration: '24h' },
    { offense: 3, penalty: '禁止发帖7天+降级L1', duration: '7天' },
    { offense: 4, penalty: '永久封禁', duration: '永久' },
  ],

  transparency: '所有处罚决定附带理由（AI生成+人工复核）。被封禁的用户有权在7天内申诉→由第二位管理员独立复审。',

  dataPrivacy: [
    '你的持仓不公开——除非你主动"晒战绩"。',
    '你的P&L不公开——除非你主动分享。',
    '你的交易记录不公开——"战绩"帖只会显示你选择分享的统计数据（胜率/收益率区间/最大回撤），不是逐笔交易明细。',
    '其他用户无法通过你的社区资料反推你的持仓。',
  ],
};

// ═══════════════════════════════════════
// PART G: 社区文案系统
// ═══════════════════════════════════════

export const COMMUNITY_COPY = {
  // 首页欢迎
  welcome: {
    title: '👋 欢迎来到QUANT MOO社区',
    subtitle: '这里没有一个"专家"在教你怎么做——这里是一群跟你一样在学的人，在分享他们"发现的信号"。',
    emptyFeed: '信号广场上还没有内容——你来做第一个分享信号的人？',
  },

  // 发帖引导
  postPrompt: {
    signalCta: '你的自选里 {symbol} 刚刚 {anomalyText}。要分享给社区吗？→ 一键发帖',
    analysisCta: '你刚刚对 {symbol} 做了分析。要把分析结果分享到社区吗？→ 一键发帖',
    noSignalYet: '还没发现信号？去热力图看看——也许有一个信号正在等你发现。',
  },

  // 留存触发
  retentionNudges: {
    day1: '👋 昨天来了今天还在——你已经是\"回访者\"了。去看看有没有人给你的帖子留言？',
    day3: '🔥 连续3天——你的社区习惯正在形成。今天的每周挑战是：\"给一篇帖子写一条有数据的评论\"。',
    day7: '🏅 7天里程碑！你已经是\"活跃用户\"了。去个人主页看看你的7天足迹？',
    streakWarning: '⚠️ 你的连续登录还剩{pct}就要断了——花30秒看一眼市场温度就行。',
    comeback: '👋 好久不见——你离开的这段时间，社区多了{newPosts}篇新信号帖。看看有没有你感兴趣的？',
  },

  // 空状态
  emptyStates: {
    noComments: '还没有评论——来做第一个"提问者"或"补充者"？',
    noFollowers: '还没有关注者——多发几个高质量的信号帖，你的人就会来。',
    noFollowing: '你还没有关注任何人——去看看\"热门\"Tab，找到你觉得有价值的分析师。',
    noBadges: '还没有徽章——完成每周挑战来解锁第一个徽章。',
  },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getLevelInfo(level: number) {
  return RETENTION_MECHANICS.levelSystem.levels.find(l => l.level === level);
}

export function getBadge(id: string) {
  return COMMUNITY_FEATURES?.profile?.sections?.[1]?.badges?.find(b => b.id === id);
}

export function getWeeklyChallenge(week: number) {
  return RETENTION_MECHANICS.weeklyChallenge.examples.find(c => c.week === `第${week}周`)!;
}

export default COMMUNITY_ARCHITECTURE;
