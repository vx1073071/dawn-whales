// ══ R283 QClaw Task 1: 因子日记文案 (3h) ══
// 交付: src/lib/factor/factor-diary-copy-r283.ts
// 覆盖: 日记/回忆录/成就/学习闭环 — 配合 ML R283 因子日记/回忆录
//
// 产品: 用户记录每天的因子选择 → 回顾规律 → 学习进步
// 品牌: Whaley 陪伴式叙事 + 反说教 + 数据驱动

export interface DiaryEntryCopy {
  /** 日期格式 YYYY-MM-DD */
  date: string;
  /** 当日摘要 — 一句话 */
  headline: string;
  /** Whaley 的第一人称点评 */
  whaleySays: string;
  /** 学到的教训/收获 */
  takeaway: string;
  /** 情绪标签 */
  mood: '🚀' | '📈' | '📊' | '😐' | '📉' | '💤';
}

export interface DiaryTemplate {
  /** 模板分类 */
  category: 'daily' | 'weekly' | 'monthly' | 'milestone' | 'retrospective';
  /** 标题模板 */
  titles: string[];
  /** Whaley开场白 */
  openings: string[];
  /** Whaley结束语 */
  closings: string[];
}

// ═══════════ 日记模板系统 ═══════════

export const DIARY_TEMPLATES: Record<string, DiaryTemplate> = {

  // ── 日常日记模板 ──
  daily: {
    category: 'daily',
    titles: [
      '今天的因子日记',
      '今日因子手帐 📔',
      '今天跟哪些因子对了眼',
    ],
    openings: [
      '今天你打开了这些因子，我来帮你记下来。',
      '今天你在因子世界逛了一圈——这是你的足迹。',
      '又是跟数字打交道的一天，你的直觉准不准？',
    ],
    closings: [
      '明天再来，我会继续帮你记录。🌙',
      '记住：好交易员不是靠运气，是靠记录+反思。',
      '今天的你比昨天多了解了一点市场。🐋',
    ],
  },

  // ── 周记模板 ──
  weekly: {
    category: 'weekly',
    titles: [
      '本周因子回顾',
      '7天因子旅程复盘',
      '一周因子成绩单',
    ],
    openings: [
      '又一周过去了。你这周最常盯的是哪些因子？',
      '周末了，来看看这7天你跟因子的关系。',
      '一周下来，你的因子直觉有变好吗？数据说话。',
    ],
    closings: [
      '下周见！记得把学到的记在心里，下次少踩坑。💪',
      '市场下一周的事情没人知道——但了解自己总没错。',
      '周末愉快，别忘了交易之外还有生活。🐋',
    ],
  },

  // ── 月度总结 ──
  monthly: {
    category: 'monthly',
    titles: [
      '本月因子成绩单',
      '30天因子成长报告',
      '这个月你的因子洞察力进步了吗',
    ],
    openings: [
      '一个月了，来看看你选因子的眼光有没有变得更好。',
      '30天里你开过的因子、踩过的坑、学到的东西——都在这。',
      '月度总结不是来打分的，是来帮你下次更精准。',
    ],
    closings: [
      '下个月，我们继续一起成长。📈',
      '一个月又一个月，因子是你的老朋友，不是过客。',
      '记住这个月学到的最重要的一个教训，写下来。🐋',
    ],
  },

  // ── 里程碑 ──
  milestone: {
    category: 'milestone',
    titles: [
      '🎉 因子里程碑达成！',
      '你在因子的路上又前进了一步',
      '里程碑——不是因为运气',
    ],
    openings: [
      '恭喜！你又达到了一个新的里程碑。不是运气，是坚持。',
      '这个里程碑说明你正在从「看因子的用户」变成「用因子的交易员」。',
      '每个里程碑背后都是几十次的选择和反思——你做对了什么？',
    ],
    closings: [
      '下一个里程碑在等你。继续前进。🐋',
      '里程碑是路上的记号，不是终点。',
      '给自己点个赞吧——你值得。👏',
    ],
  },

  // ── 回忆录/反思 ──
  retrospective: {
    category: 'retrospective',
    titles: [
      '🐋 Whaley 的回忆录',
      '回头看：那些让你赚钱和亏钱的因子',
      '因子回忆录——过去的选择，现在的反思',
    ],
    openings: [
      '不是复盘，是回忆。让我们把时间拨回去，看看当时的选择。',
      '回忆录不是来批评你的——是来帮你看到自己没注意到的习惯。',
      '几年后再回头看，这些记录都是你成长的证据。',
    ],
    closings: [
      '过去不可改，但下次你可以做得更好。',
      '学会对过去的自己温柔一点——你当时做了最好的决定。🐋',
      '记忆会骗你，但数据不会。这就是日记的意义。',
    ],
  },
};

// ═══════════ 里程碑定义 ═══════════

export interface MilestoneCopy {
  id: string;
  name: string;
  emoji: string;
  description: string; // 达到了什么
  whaleyCelebration: string; // Whaley 的庆祝
}

export const MILESTONES: MilestoneCopy[] = [
  { id: 'first_factor_added', name: '第一个因子', emoji: '🌱', description: '你第一次添加了因子到策略中', whaleyCelebration: '第一步总是最难的——你已经迈出去了！' },
  { id: 'factors_10', name: '因子收藏家', emoji: '📚', description: '你使用过10个不同的因子', whaleyCelebration: '10个因子=10种看市场的角度。你眼界正在变宽。' },
  { id: 'factors_50', name: '因子探险者', emoji: '🗺️', description: '你探索过50个不同的因子', whaleyCelebration: '50个因子——你对市场的理解已经超出了90%的散户。' },
  { id: 'factors_100', name: '因子百科', emoji: '🎓', description: '你探索过100个因子', whaleyCelebration: '百因成王——你的因子知识已经可以给别人讲课了。' },
  { id: 'journal_7_days', name: '坚持一周', emoji: '📅', description: '连续7天记录因子日记', whaleyCelebration: '坚持7天比随便看7天强十倍。你在养成好习惯。' },
  { id: 'journal_30_days', name: '月记达人', emoji: '🏆', description: '连续30天记录因子日记', whaleyCelebration: '30天不中断——你已经比95%的交易员更自律。' },
  { id: 'journal_100_days', name: '百日修炼', emoji: '💯', description: '连续100天记录因子日记', whaleyCelebration: '一百天！从今天开始你可以自称专业人士了。' },
  { id: 'backtest_1', name: '第一次回测', emoji: '🔬', description: '你第一次用因子做了回测', whaleyCelebration: '从「我觉得」到「数据说」——这是质的飞跃。' },
  { id: 'backtest_10', name: '回测狂人', emoji: '🧪', description: '你完成了10次因子回测', whaleyCelebration: '10次回测=10次不花钱学到经验。你赚了。' },
  { id: 'insight_earned', name: '真的学到了一课', emoji: '💡', description: '从日记反思中获得了一个可操作的洞察', whaleyCelebration: '这个洞察可能值几千块——如果下次你真的用了它。' },
  { id: 'comparison_first', name: '第一次社交比较', emoji: '🪞', description: '你第一次看到了自己与同行的对比', whaleyCelebration: '比较不是为了焦虑——是为了知道自己在哪个位置。' },
  { id: 'arena_winner', name: '竞技场获胜', emoji: '👑', description: '你在因子竞技场对决中赢了一次', whaleyCelebration: '赢一次不代表永远赢——但感觉是不错的吧？😎' },
];

// ═══════════ Whaley 日记旁白库 ═══════════

export const WHALEY_DIARY_QUIPS = {
  // 凌晨 (0-5)
  early_morning: [
    '凌晨还在看因子？市场不开，你该睡了。🛏️',
    '这么早就醒了？还是根本没睡？身体要紧。',
  ],
  // 早上 (6-9)
  morning: [
    '早上好！新的一天，新的因子，新的机会。☀️',
    '盘前功课做完了吗？别偷懒哦。',
  ],
  // 交易时间 (9-16)
  trading: [
    '市场在动，你的因子在说话——你在听吗？',
    '别死盯着屏幕——因子会告诉你该看什么。',
    '赚钱的时候别忘了记下来：你当时在想什么。',
  ],
  // 收盘后 (16-20)
  after_close: [
    '收盘了，来看看今天的因子都干了什么。',
    '今天的交易结束了——但你的学习才开始。复盘吧。',
  ],
  // 晚上 (20-23)
  evening: [
    '夜深了，看看今天的因子日记，想一想明天。',
    '记下来今天学到的东西——明天就用得上。',
  ],
  // 周末
  weekend: [
    '周末了，回顾一下这周的因子选得怎么样？',
    '交易暂停，但你的大脑还在运转。写下来。',
  ],
  // 通用洞察
  insight: [
    '盯了这么多因子，真正为你赚到钱的是哪几个？',
    '这个月你最常看的因子和赚最多的因子是同几个吗？',
    '你有没有发现：看太多因子反而让你犹豫？',
    '最好的交易员不是因子多，是知道什么时候用什么。',
    '今天你避开的坑比昨天多了一个。这就是进步。',
  ],
  // 鼓励
  encouragement: [
    '别跟别人比——跟昨天的自己比就好。',
    '好的交易决策不是因为一个因子——是因为你知道它在说什么。',
    '市场不会因为你紧张就不跌。但你会因为记录而更稳。🐋',
    '亏了钱没关系——关键是记下来为什么亏了。学费不能白交。',
    '你的日记是最便宜的老师。',
    '因子不用多——用对的五个比翻一百个强。',
  ],
};

// ═══════════ 日记提示问题（引导用户反思） ═══════════

export const DIARY_PROMPTS = [
  { id: 'win_today', question: '今天最成功的一次因子选择是什么？', hint: '是哪个因子告诉了你什么信息？' },
  { id: 'miss_today', question: '今天错过的最好的机会是什么？', hint: '回头看，哪些因子在提示你但你没注意？' },
  { id: 'surprise', question: '今天有什么超出你预期的事？', hint: '市场给了你一个惊喜还是惊吓？' },
  { id: 'emotion', question: '今天你的情绪是什么状态？', hint: '平静/焦虑/兴奋/后悔——真实记录下来。' },
  { id: 'lesson_today', question: '今天学到的最重要的一件事？', hint: '哪怕一句话也行。' },
  { id: 'tomorrow_plan', question: '明天你最关注哪个因子？为什么？', hint: '提前想好，明天就不会盲目扫。' },
  { id: 'regret', question: '今天有没有后悔的操作？', hint: '不是自责——是分析：什么因子让你这样决定的？' },
  { id: 'proud', question: '今天做对了什么，为自己骄傲？', hint: '你坚持住了没有冲动交易？这也是胜利。' },
];

// ═══════════ 学习闭环文案 ═══════════

export const LEARNING_LOOP_COPY = {
  // 四步闭环
  steps: [
    { name: '📝 记录', desc: '记下今天用了什么因子、为什么用。' },
    { name: '🔍 回顾', desc: '每周回头看——哪些因子真的帮你赚了？' },
    { name: '💡 反思', desc: '你选的因子和你以为的不一样？找模式。' },
    { name: '🎯 改进', desc: '下周换一个策略——看结果变好还是变差。' },
  ],
  // 每周习惯得分
  habit_scores: {
    gold: { label: '🏆 因子战士', desc: '你这周每天都写了因子日记！你是千分之一的坚持者。' },
    silver: { label: '🥈 认真学生', desc: '5-6天日记——不错，保持这个节奏。' },
    bronze: { label: '🥉 偶尔记录', desc: '3-4天——你还有半周没说话。因子在等你。' },
    rusty: { label: '😴 需要唤醒', desc: '少于3天——你的因子日记要长草了。明天开始不晚。' },
  },
  // 趋势词
  trend_words: [
    { signal: 'consistency_up', text: '你的记录频率在上升——好习惯正在形成。' },
    { signal: 'consistency_down', text: '记录频率在下降——是太忙了还是没灵感？回来写一句也行。' },
    { signal: 'quality_up', text: '你的反思越来越有深度——不是简单记录而是真的在分析。' },
    { signal: 'quality_down', text: '日记变短了——是状态不佳还是在赶时间？没关系，真诚就好。' },
    { signal: 'diversity_up', text: '你最近在尝试新的因子类别——冒险精神值得鼓励。' },
    { signal: 'diversity_down', text: '你最近停留在同一类因子中——要不要换个角度看看市场？' },
  ],
};

// ═══════════ 回忆录叙事框架 ═══════════

export const MEMOIR_FRAMEWORK = {
  chapters: [
    {
      title: '第一章：初心',
      subtitle: '你开始使用因子的第一天',
      whaleyNarrative: '还记得你第一次打开因子面板的那天吗？也许你什么都不懂，但你打开了。好奇心是一切交易的开始。',
    },
    {
      title: '第二章：探索',
      subtitle: '你试过的第一个10个因子',
      whaleyNarrative: '从动量到价值，从基本面到情绪——你像逛超市一样尝试各种因子。有些人停在这一步，而你继续往前了。',
    },
    {
      title: '第三章：信任',
      subtitle: '你找到第一个让你赚钱的因子',
      whaleyNarrative: '不是所有因子都会带给你好消息。但总有几个，一次次给你正确的信号。它们是你的老战友。',
    },
    {
      title: '第四章：挫折',
      subtitle: '你踩过的最大的坑',
      whaleyNarrative: '每个人都有亏钱的时候。区别是：有些人怪因子，有些人怪自己——怪自己的人才真的会进步。',
    },
    {
      title: '第五章：顿悟',
      subtitle: '你突然懂了的那一天',
      whaleyNarrative: '某一天，某个因子告诉你的东西和你心里想的一模一样。那一刻你知道了——你不是在猜，你是在听。',
    },
    {
      title: '第六章：分享',
      subtitle: '你开始帮别人理解因子',
      whaleyNarrative: '当你开始能把自己懂的告诉别人——你就真的懂了。而且别人也会告诉你你不知道的。',
    },
    {
      title: '第七章：日常',
      subtitle: '因子已经是你生活的一部分',
      whaleyNarrative: '因子不再是工具——是你每天看世界的窗口。你知道哪些日子该用哪些因子，哪些日子该休息。',
    },
    {
      title: '尾声：未完待续',
      subtitle: '因子之路没有终点',
      whaleyNarrative: '市场在变，因子在变，你也在变。今天的日记是明天的回忆录。请继续写下去。🐋',
    },
  ],
};

export default {
  DIARY_TEMPLATES,
  MILESTONES,
  WHALEY_DIARY_QUIPS,
  DIARY_PROMPTS,
  LEARNING_LOOP_COPY,
  MEMOIR_FRAMEWORK,
};
