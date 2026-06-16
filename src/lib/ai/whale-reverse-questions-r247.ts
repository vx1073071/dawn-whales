// ══ R247 QClaw P2-09: AI反问用户文案 (Whale Dialog) ══
// When the AI needs more info before giving a recommendation, it asks questions.
// Design: "不是审问，是朋友间的了解" — like a bartender getting to know you

export type QuestionCategory =
  | 'risk_tolerance'    // 评估风险承受
  | 'time_horizon'      // 确认投资期限
  | 'preference'        // 了解交易偏好
  | 'market_view'       // 了解市场看法
  | 'goal_clarify'      // 澄清投资目标
  | 'nudge_decision'    // 催促决策（用户犹豫中）
  | 'post_loss'         // 亏损后的安抚式提问
  | 'onboarding';       // 首次使用引导

export interface ReverseQuestion {
  category: QuestionCategory;
  /** 触发场景 */
  trigger: string;
  /** 主问题 */
  question: string;
  /** 2-4个选项 (给按钮，不给开放文本框) */
  options: { label: string; value: string; nextAction: string; }[];
  /** 为什么要问这个 — 显示给用户的解释 */
  whyAsking: string;
}

export const REVERSE_QUESTIONS: ReverseQuestion[] = [
  // ── 1. 风险承受 ──
  {
    category: 'risk_tolerance',
    trigger: '用户请求推荐策略但未知其风险偏好',
    question: '在开始之前，我想问你一个问题：如果明天你的账户突然亏了15%，你的第一反应是什么？',
    options: [
      { label: '😨 立刻卖掉所有股票，保护剩下的钱', value: 'conservative', nextAction: '推荐防守型策略(股息/债券/低波动)' },
      { label: '😐 有点慌，但先看看是什么原因', value: 'moderate', nextAction: '推荐平衡型策略(价值+成长各半)' },
      { label: '😎 不慌，加仓抄底', value: 'aggressive', nextAction: '推荐进攻型策略(动量/趋势/杠杆)' },
      { label: '🤔 不确定，没经历过', value: 'unknown', nextAction: '先演示最坏情况再问' },
    ],
    whyAsking: '同一个策略，能接受15%回撤的人和只能接受5%回撤的人，用起来感受完全不一样。我不是在考你——是在帮你找到你能睡得着觉的策略。',
  },

  // ── 2. 投资期限 ──
  {
    category: 'time_horizon',
    trigger: '用户选策略但未设定期限',
    question: '你这笔钱大概多久之后要用？',
    options: [
      { label: '🏃 随时可能用（3个月内）', value: 'short', nextAction: '推荐短线策略(日内/周度/事件驱动)' },
      { label: '🚶 半年到一年内', value: 'medium', nextAction: '推荐中期策略(趋势/轮动)' },
      { label: '🧘 三五年都不急', value: 'long', nextAction: '推荐长线策略(价值/股息/指数)' },
      { label: '🤷 没想过这个问题', value: 'unknown', nextAction: '解释期限为何重要+推荐弹性策略' },
    ],
    whyAsking: '期限决定一切。如果你下个月要付首付，我不可能推荐一个历史最大回撤40%的策略给你——哪怕它长期收益再好也不行。',
  },

  // ── 3. 交易偏好 ──
  {
    category: 'preference',
    trigger: '用户浏览策略市场但未做出选择',
    question: '你更喜欢哪种感觉？',
    options: [
      { label: '📊 每天看几次盘，自己掌控节奏', value: 'active', nextAction: '推荐量化因子策略(多信号/多调仓)' },
      { label: '📱 每天看一次，做个简单决策就好', value: 'semi_active', nextAction: '推荐趋势跟随策略(周度调仓)' },
      { label: '🗄️ 买了就不管，定期收钱就行', value: 'passive', nextAction: '推荐股息/REIT/指数策略' },
      { label: '🎮 喜欢刺激，快进快出', value: 'trader', nextAction: '推荐日内/短线/爆仓捡尸策略' },
    ],
    whyAsking: '策略再赚钱，如果你的性格跟它不匹配，你坚持不了三天。喜欢慢悠悠的人炒股息策略会很舒服，让他在比特币上做短线他会疯掉的。',
  },

  // ── 4. 市场看法 ──
  {
    category: 'market_view',
    trigger: '用户在当前波动市场中犹豫',
    question: '说实话——你觉得接下来3个月市场会怎样？',
    options: [
      { label: '📈 继续涨', value: 'bullish', nextAction: '推荐顺势做多策略+设保护性止损' },
      { label: '📉 可能要跌了', value: 'bearish', nextAction: '推荐防守策略+现金占比建议' },
      { label: '↔️ 横盘震荡', value: 'sideways', nextAction: '推荐均值回归/网格策略' },
      { label: '🤷 完全看不清', value: 'unsure', nextAction: '推荐全天候分散+不押注单一方向' },
    ],
    whyAsking: '你的直觉可能对，也可能错——但重要的是，如果你的策略跟你内心对市场的看法完全相反，你会很难执行。比如你觉得要跌，但策略让你继续持有——你会在心理上和自己打架。',
  },

  // ── 5. 目标澄清 ──
  {
    category: 'goal_clarify',
    trigger: '用户在多个策略间摇摆',
    question: '来，我们想清楚——你最想要的是什么？',
    options: [
      { label: '💰 赚最多的钱（接受高风险）', value: 'max_return', nextAction: '推荐高动量/高波动策略(年化20%+目标)' },
      { label: '🛡️ 别亏太多（安全第一）', value: 'min_risk', nextAction: '推荐低回撤策略+大比例现金配置' },
      { label: '⚖️ 稳稳赚钱就好', value: 'balanced', nextAction: '推荐夏普比率最高的平衡策略' },
      { label: '📚 我想边做边学', value: 'learning', nextAction: '推荐简单易理解的策略+解释型回测' },
    ],
    whyAsking: '很多人嘴上说"我要赚最多钱"，但市场跌10%就睡不着了。所以我用这个问题帮你对自己诚实——也帮我给你真正适合的建议。',
  },

  // ── 6. 催促决策（用户犹豫不决） ──
  {
    category: 'nudge_decision',
    trigger: '用户反复查看策略但停留超过5分钟未操作',
    question: '我看你看了这个策略好一会了。是不是有什么让你犹豫的？告诉我——如果我能解决，我帮你想。如果我解决不了，至少你知道了原因。',
    options: [
      { label: '😟 怕亏钱', value: 'fear_loss', nextAction: '展示最坏情况分析+保护方案' },
      { label: '🤔 不太理解这个策略', value: 'confused', nextAction: '用人话重新解释+动画演示' },
      { label: '🔄 还在比较别的策略', value: 'comparing', nextAction: '打开对比视图+差异高亮' },
      { label: '💤 我再想想', value: 'wait', nextAction: '不打扰+加入关注列表' },
    ],
    whyAsking: '决策疲劳是真实存在的——每天在市场里面对无数选择。有时候你只是需要一个声音告诉你：犹豫没关系，搞清楚在犹豫什么就好。',
  },

  // ── 7. 亏损后安抚式提问 ──
  {
    category: 'post_loss',
    trigger: '用户策略出现较大回撤(>10%)',
    question: '我知道这不是一个好的感觉。但我们先冷静下来，判断一件事：这次亏损是因为市场整体都不好，还是你的策略出了问题？',
    options: [
      { label: '📉 市场整体都不好（跟策略无关）', value: 'market_wide', nextAction: '展示市场回撤对比+坚持建议' },
      { label: '⚠️ 好像只有我的策略在亏', value: 'strategy_issue', nextAction: '深度诊断+优化建议' },
      { label: '🤷 我不确定', value: 'unsure', nextAction: '系统自动比较:策略vs基准vs同类' },
      { label: '😔 我想休息一下', value: 'pause', nextAction: '暂停策略跟单1周+到期提醒' },
    ],
    whyAsking: '这个问题的答案差别巨大：如果市场都不好，那你的策略没问题，只是运气不好——这时候要做的就是坚持。如果只有你的策略在下滑，那确实需要调整。',
  },

  // ── 8. 新用户引导 ──
  {
    category: 'onboarding',
    trigger: '用户首次使用Whale AI功能',
    question: '欢迎！🐋 我是鲸灵。我存在只有一个目的：帮你在市场上做出更好的决定。\n\n先告诉我：你现在最关心的是什么？',
    options: [
      { label: '📊 我持有一些股票，想看看风险', value: 'check_portfolio', nextAction: '分析持仓+展示风险因子' },
      { label: '🔍 我想找一个赚钱的策略', value: 'find_strategy', nextAction: '推荐策略→反问风险/期限/偏好' },
      { label: '📖 我想搞懂这些因子和策略是什么', value: 'learn', nextAction: '因子小课堂+策略故事线' },
      { label: '👀 先随便逛逛', value: 'explore', nextAction: '展示首页驾驶舱+不打扰模式' },
    ],
    whyAsking: '我可以一口气给你看100个策略——但那没有意义。先告诉我你想要什么，我给你最需要的那个。',
  },
];

/** Get questions for a category */
export function getReverseQuestions(category: QuestionCategory): ReverseQuestion[] {
  return REVERSE_QUESTIONS.filter(q => q.category === category);
}

/** Generate a Whale follow-up message based on user's answer */
export function generateFollowUp(category: QuestionCategory, selectedValue: string): string {
  const q = REVERSE_QUESTIONS.find(x => x.category === category);
  if (!q) return '知道了。让我帮你看看。';

  const opt = q.options.find(o => o.value === selectedValue);
  const label = opt?.label || '你的回答';
  const nextAction = opt?.nextAction || '继续分析';

  const followUps: Record<QuestionCategory, string[]> = {
    risk_tolerance: [
      `了解。${label}——那我给你推荐${nextAction}。别担心，这些策略都有免费回测，你试了觉得不舒服随时换。`,
      `好的。${label}的风格。每个人的风险底线不同，没有对错。我们看看${nextAction}。`,
    ],
    time_horizon: [
      `明白了。${label}。这帮我缩小了很多范围——${nextAction}是最匹配的。`,
      `清楚。期限不同策略完全不同——${label}的话，${nextAction}最合适。`,
    ],
    preference: [
      `收到。${label}——这个风格我记住了，以后给你推荐都会按这个调。现在先看${nextAction}。`,
      `了解你的节奏了。${label}的人通常会喜欢${nextAction}。`,
    ],
    market_view: [
      `好的。你觉的{label}——我先不管你对不对，但${nextAction}。市场会告诉我们答案。`,
      `收到——注意我不是在判断你的看法对错，我是在帮你找匹配你当前判断的策略。${nextAction}。`,
    ],
    goal_clarify: [
      `清楚了。${label}——那我们的方向就是${nextAction}。记住这个目标，之后看策略时都用它来过滤。`,
      `好。${label}，那${nextAction}。不管目标是什么，最重要的是你对它诚实。`,
    ],
    nudge_decision: [
      `${label}——完全正常的。${nextAction}。慢慢来，市场不会跑。`,
      `我懂了。${label}。那${nextAction}。不着急。`,
    ],
    post_loss: [
      `${label}——这是一个非常重要的判断。${nextAction}。不管怎样，经历了亏损本身就是一种成长。`,
      `谢谢你的诚实。${label}——那${nextAction}。记住：亏钱是交易的一部分，亏得起才能赚得到。`,
    ],
    onboarding: [
      `${label}——太好了！${nextAction}。随时可以回来找我，我就在这儿。🐋`,
      `棒！${label}——那我们${nextAction}。有任何想知道的直接问我。`,
    ],
  };

  const pool = followUps[category] || ['知道了。让我帮你看看。'];
  const msg = pool[Math.floor(Math.random() * pool.length)].replace('{label}', label);

  return msg;
}

export default REVERSE_QUESTIONS;
