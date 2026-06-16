// ══ R248 QClaw P2-07: AI学习模式文案 ══
// Explain how Whale learns user preferences — transparent, reassuring, not creepy
// Design: "我在了解你——但不是偷偷摸摸的那种"

export type LearningDimension =
  | 'risk_profile'        // 风险偏好
  | 'time_preference'     // 时间偏好
  | 'factor_affinity'     // 因子亲和
  | 'trading_style'       // 交易风格
  | 'attention_pattern'   // 注意力模式
  | 'emotional_pattern';  // 情绪模式

export interface LearningDimensionCopy {
  dimension: LearningDimension;
  /** 这个维度叫什么 */
  label: string;
  /** 一句话解释 */
  oneLiner: string;
  /** Whale从什么数据中学到的 */
  dataSource: string;
  /** 会怎么影响推荐 */
  howItHelps: string;
  /** 用户能看到什么 */
  whatUserSees: string;
  /** 用户可以改吗 */
  userControl: string;
}

export const LEARNING_DIMENSIONS: LearningDimensionCopy[] = [
  {
    dimension: 'risk_profile',
    label: '你的风险底线',
    oneLiner: '我能接受的最大亏损是多少？',
    dataSource: '你的持仓分析+你选的策略难度+Whale对话里你选的"风险承受"选项。注意：我不看你实际亏了多少钱，我看你的行为——比如你在市场大跌时是加仓还是割肉。',
    howItHelps: '知道了你的风险底线，我推荐策略时不会推荐那些会超过你承受能力的。比如你最多能接受10%回撤，我就不会给你推荐历史最大回撤40%的策略。',
    whatUserSees: '在"我的鲸灵"页面，你会看到一条评估："根据你的交易行为，你的风险承受是保守型。这意味着我推荐的策略回撤通常在5-10%。"',
    userControl: '你可以随时手动调整风险等级（保守/温和/积极）。调整后会立刻影响所有后续推荐。',
  },
  {
    dimension: 'time_preference',
    label: '你的耐心程度',
    oneLiner: '我喜欢频繁交易，还是买了就不管？',
    dataSource: '你的调仓频率+持仓时长+Whale对话里你的选择。比如你平均每周调仓3次，我就知道你喜欢短线。如果你持有超过6个月不动，我就知道你是长期投资者。',
    howItHelps: '我不会给一个喜欢每天操作的人推荐"买了就别管"的股息策略，也不会给一个半年不想看盘的人推荐需要每天盯盘的趋势策略。',
    whatUserSees: '"你的交易节奏是活跃型——平均每2.3天做一次决策。我会优先推荐周度调仓的策略。"',
    userControl: '可手动选择：短线(几天)/中线(几周)/长线(几月)/超长线(几年)。',
  },
  {
    dimension: 'factor_affinity',
    label: '你喜欢看什么指标',
    oneLiner: '哪些因子你最常关注？',
    dataSource: '你在因子页面点击最多的指标+你花时间最长的因子详情+你自定义添加到仪表盘的因子。如果你反复看RSI和MACD，我知道你是技术分析型。如果你总看ROE和PE，我知道你是基本面型。',
    howItHelps: '推送策略时我会优先推跟你"语言"一致的——你喜欢技术因子，我推的策略就用RSI/MACD/布林带这些你熟悉的指标作为卖点。不会突然丢一堆应计率/F-Score让你看不懂。',
    whatUserSees: '"你最关注的因子类型是技术指标（RSI/MACD/布林带占据了你看因子时间的68%）。我会用你熟悉的指标来解释推荐。"',
    userControl: '可手动添加/移除关注因子，标记"不理解"的因子让Whale用人话重新解释。',
  },
  {
    dimension: 'trading_style',
    label: '你的决策风格',
    oneLiner: '我是凭感觉做决定，还是跟着系统走？',
    dataSource: '你的策略使用方式：是严格跟单还是经常手动干预？是用自带止损还是手动平仓？你的胜率是否高于策略本身的胜率（说明你在手动优化）还是低于（说明你在情绪化干扰）。',
    howItHelps: '如果你经常手动干预而且结果更好——我会推荐"半自动"策略，给你更多手动操作空间。如果你严格跟单效果最好——我会推荐"全自动"策略，建议你减少手动操作。',
    whatUserSees: '"你的决策倾向是自律型——你手动操作的胜率（48%）低于策略本身胜率（62%）。建议：减少手动干预，让策略自己跑。"',
    userControl: '可切换"推荐自动策略"/"推荐手动策略"/"推荐半自动策略"。',
  },
  {
    dimension: 'attention_pattern',
    label: '你最在意什么',
    oneLiner: '你打开APP最常看什么？',
    dataSource: '你的首页访问模式+点击热区+停留时间。比如你每次都先看"今日盈亏"板块，我知道你最在意的是账户表现。如果你总是在"因子"页面停留很久，我知道你更在意分析方法。',
    howItHelps: '首页布局会根据你的注意力模式调整——最在意涨跌的人看到大号盈亏数字，最在意因子的人看到信号热力图，最在意新闻的人看到头条推送。',
    whatUserSees: '"你最常看的是持仓盈亏（每日访问3.2次），其次是因子页面（1.8次），最后是新闻（0.5次）。我已经把你的首页调整成这个顺序。"',
    userControl: '可手动拖拽首页模块顺序，不受AI学习结果干扰。',
  },
  {
    dimension: 'emotional_pattern',
    label: '你的情绪节奏',
    oneLiner: '市场什么时候会让你焦虑或冲动？',
    dataSource: '你在市场大跌时打开APP的频率（焦虑看盘）、你在连续盈利后是否加仓（过度自信）、你在连续亏损后是否立刻平仓（恐慌卖出）。注意：这些数据仅用于优化推送时机——绝不会被分享。',
    howItHelps: '如果你容易在下跌时恐慌——市场大跌时我不会推送吓人的标题，而是推送"历史上类似跌幅后的恢复数据"。如果你容易在连续盈利后冒进——我会主动推送风险提醒。',
    whatUserSees: '"根据你的行为模式，市场大跌>3%时你查看账户的频率是平时的4倍——容易产生恐慌性操作。这种情况下我会先给你推送冷静数据，再提供操作建议。"',
    userControl: '可关闭情绪分析功能（设置→隐私→AI学习模式→关闭情绪分析）。关闭后Whale仍会提供服务，但推送不再考虑情绪节奏。',
  },
];

// ═══════════════════ 学习进度对话 ═══════════════════

export interface LearningProgressStage {
  stage: 'day1' | 'week1' | 'week2' | 'month1' | 'quarter1';
  title: string;
  message: string;
  unlocked: string[];
}

export const LEARNING_PROGRESS: LearningProgressStage[] = [
  {
    stage: 'day1',
    title: '第一天：开始认识你',
    message: '嗨！我是鲸灵🐋。从今天开始，我会慢慢了解你的交易方式——不是为了评判你，是为了帮你做出更适合你的决定。刚开始的时候，我的建议会比较"通用"。给我一点时间，我会越来越懂你。',
    unlocked: ['基础策略推荐 (通用)', '因子信号提醒 (默认阈值)'],
  },
  {
    stage: 'week1',
    title: '第一周：了解你的节奏',
    message: '一周了！我已经大致了解了你的操作节奏和关注重点。你{x_trades}笔交易里{style_pattern}，你喜欢看{favorite_factor}。我开始调整推荐的策略——不再推荐跟你风格不合的东西。',
    unlocked: ['个性化策略推荐', '时间偏好匹配', '注意力模式优化'],
  },
  {
    stage: 'week2',
    title: '第二周：开始懂你的口味',
    message: '两周下来，我对你的"口味"越来越清楚了。你喜欢{risk_level}风险的策略，偏好{time_frame}的操作周期，最常看{factor_type}类因子。现在推荐的策略命中率（你实际会看的比例）已经提高了{improvement}%。',
    unlocked: ['因子亲和匹配', '风险精准匹配'],
  },
  {
    stage: 'month1',
    title: '第一个月：能看到你的模式了',
    message: '一个月了！我已经积累了足够的数据来"看见"你的交易模式。你{pattern_insight}。这不是在给你打分——而是帮你看到你自己可能没意识到的习惯。好习惯继续保持，需要改进的地方我会温柔提醒。',
    unlocked: ['情绪模式识别', '决策风格分析', '交易习惯反馈'],
  },
  {
    stage: 'quarter1',
    title: '第三个月：我们之间有默契了',
    message: '三个月了——我觉得我对你的了解已经很深入了。我知道你什么时候需要冷静，什么时候需要鼓励，什么时候需要直接的建议。最重要的是——你已经成了我最重要的"老师"。你每次的一个操作、一个反馈，都在让我变得更好。',
    unlocked: ['全部学习维度', '首页完全个性化', '鲸灵心理画像'],
  },
];

// ═══════════════════ 隐私透明文案 ═══════════════════

export const PRIVACY_TRANSPARENCY = {
  title: '鲸灵怎么了解你（透明度说明）',
  intro: '以下是对鲸灵AI学习模式的完整说明。我们相信隐私不是一句口号——你需要知道数据怎么被使用。',

  whatWeLearn: [
    '你的交易行为：持仓、调仓、止损止盈设置',
    '你的APP使用行为：看什么页面、看多久',
    '你跟鲸灵的对话：你问的问题、你做的选择',
    '你的反馈：你对推荐的"有用/没用"的标记',
  ],

  whatWeDontLearn: [
    '你的个人身份信息（姓名、身份证号、银行账号）',
    '你的其他APP或设备的使用数据',
    '你的通讯录、位置、照片、麦克风录音',
    '你和其他人（非鲸灵）的聊天内容',
  ],

  dataUsage: [
    '所有学习数据只存在你的本地设备上',
    '不会上传到任何服务器用于其他用途',
    '不会用于训练公开的AI模型',
    '你可以随时清空所有学习数据（就像"重置"鲸灵）',
  ],

  resetCopy: '如果你想"重新开始"——去"设置→隐私→AI学习→清除所有学习数据"。重置后鲸灵会回到第一天的状态，像你们刚认识一样。所有推荐会回到通用模式。这个过程不可逆。',
};

// ═══════════════════ 鲸灵心理画像 ═══════════════════

export function generateUserProfileCard(dimensions: LearningDimensionCopy[]): string {
  let card = '🐋 鲸灵眼中的你\n\n';
  card += '这不是在给你打分。这就是我看到的你——基于你过去的操作和选择。如果有不对的地方，告诉我，我会学习。\n\n';

  for (const dim of dimensions) {
    card += `📌 ${dim.label}\n`;
    card += `   ${dim.oneLiner}\n`;
    card += `   数据来源: ${dim.dataSource.split('.')[0]}。\n`;
    card += `   这帮助我: ${dim.howItHelps.split('.')[0]}。\n\n`;
  }

  card += '──\n';
  card += '🔒 这些数据只存在你的设备上。只有你和我知道。\n';
  card += '🔄 想改？点击任何一项卡片可以手动调整。\n';
  card += '🗑️ 想重来？设置→清除学习数据，鲸灵会回到第一天。';

  return card;
}

export default LEARNING_DIMENSIONS;
