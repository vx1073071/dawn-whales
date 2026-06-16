// ══ R253 QClaw: 驾驶舱欢迎文案 ══
// Market Cockpit welcome copy — first-run experience + daily state cards
// Design: "打开驾驶舱的第一眼——告诉你'这是做什么的'和'今天我们看到了什么'"

export interface CockpitWelcomeState {
  phase: 'FIRST_VISIT' | 'RETURNING' | 'NO_DATA' | 'LOADING' | 'ERROR';
  title: string;
  greeting: string;
  body: string;
  actionLabel: string;
  actionHint: string;
  whaleMessage: string;
}

export const COCKPIT_WELCOME_STATES: Record<string, CockpitWelcomeState> = {
  FIRST_VISIT: {
    phase: 'FIRST_VISIT',
    title: '欢迎来到你的驾驶舱',
    greeting: '嘿，这里是你的市场指挥中心 👋',
    body: `这就是QUANT MOO的心脏——你的驾驶舱。

每天打开它，你会看到：
· 📊 今天市场在什么状态（温和/恐慌/狂热…）
· 🐋 鲸灵帮你翻译"发生了什么"和"该看什么"
· 🔔 你持仓股票的异动信号
· 📅 今天有哪些公司要发财报

第一次来，先做三件事：
1. 连上一个券商账户（右上角→设置→券商）
2. 把你想关注的股票加进自选
3. 然后每天打开这里——剩下的交给我们

准备好了吗？`,
    actionLabel: '连接券商',
    actionHint: '或用虚盘账户先体验',
    whaleMessage: '我是鲸灵。以后每天早上，我会在这里告诉你：今天的市场是什么天气，你该穿什么衣服出门。🐋',
  },

  RETURNING: {
    phase: 'RETURNING',
    title: '驾驶舱就绪',
    greeting: '早。看看今天有什么。',
    body: '市场快评已更新在下方。滚动查看你持仓股票的异动信号、今天的财报日历和因子提醒。',
    actionLabel: '查看今日快评',
    actionHint: '30秒了解今天市场状态',
    whaleMessage: '今天的数据已经在下面了。如果你想先听听我的看法——点一下"AI快评"标签页。🐋',
  },

  NO_DATA: {
    phase: 'NO_DATA',
    title: '驾驶舱待命中',
    greeting: '还没看到市场数据 😶',
    body: `这可能是因为：
· 📡 你还没连接券商（券商=数据源）
· 🕐 今天市场还没开盘（港股9:30，美股21:30北京时间）
· 🔌 数据源暂时断了

试试：
→ 连接一个券商（左上角→设置→券商）
→ 或者在非交易时段来看看历史数据

中间的大卡片会告诉你"今天市场在什么状态"——等数据进来才会出现。`,
    actionLabel: '连接券商',
    actionHint: '虚盘也行，先跑起来',
    whaleMessage: '没有数据的时候，我最无聊了。快连个券商让我有活干！🐋',
  },

  LOADING: {
    phase: 'LOADING',
    title: '正在加载市场数据...',
    greeting: '稍等，数据正在路上',
    body: '正在从你连接的券商拉取最新行情。通常几秒钟就好——如果卡住了，可能是券商API暂时慢了。',
    actionLabel: '',
    actionHint: '自动刷新中',
    whaleMessage: '在等数据进来。有时候券商比我还慢——但你放心，数据到了我第一时间告诉你。',
  },

  ERROR: {
    phase: 'ERROR',
    title: '数据暂时获取不到',
    greeting: '嗯，出了点问题',
    body: `市场数据没能加载成功。可能原因：
· 🔌 券商连接暂时断了（最常见）
· 🛠️ 数据源在维护
· 🌐 网络问题

请检查：
1. 券商连接状态（设置→券商→检查连接）
2. 网络连接
3. 等几分钟再试

如果问题持续，右下角联系客服。`,
    actionLabel: '重试',
    actionHint: '或检查券商连接',
    whaleMessage: '数据没进来，但我还在。可能是券商那头的问题——检查一下连接试试。如果还不行，等一会儿再来，我会一直在这里。🐋',
  },
};

// ═══════════════════ 时段欢迎语 ═══════════════════

export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '这么晚了还没睡？注意身体。';
  if (hour < 9) return '早。今天的市场还在酝酿。';
  if (hour < 12) return '上午好。港股这会儿正热闹。';
  if (hour < 14) return '中午好。休息一下，下午还有行情。';
  if (hour < 17) return '下午好。A股快收盘了，美股在准备。';
  if (hour < 21) return '傍晚好。美股快开盘了。';
  if (hour < 23) return '晚上好。现在是美股最热闹的时候。';
  return '晚上好。今天还顺利吗？';
}

// ═══════════════════ 驾驶舱状态卡片文案 ═══════════════════

export interface CockpitStatusCard {
  key: string;
  title: string;
  icon: string;
  description: string;
  emptyState: string;
}

export const COCKPIT_STATUS_CARDS: CockpitStatusCard[] = [
  {
    key: 'marketState',
    title: '今日市场',
    icon: '📊',
    description: '一眼看今天市场在什么状态——温和、恐慌还是狂热。鲸灵帮你翻译成"该做什么"。',
    emptyState: '等待市场数据...',
  },
  {
    key: 'anomalies',
    title: '异动信号',
    icon: '🔔',
    description: '你持仓和关注列表中的异常信号——技术面/资金面/情绪面。按严重度分四级。',
    emptyState: '暂无异常——偶尔平静是好事',
  },
  {
    key: 'earnings',
    title: '财报日历',
    icon: '📅',
    description: '本周和今天有哪些公司发财报。标注了盘前/盘后和上次表现。',
    emptyState: '近期无财报日历',
  },
  {
    key: 'factors',
    title: '因子提醒',
    icon: '🧬',
    description: '你关注的因子触发了信号——别错过鲸灵帮你挑出来的关键变化。',
    emptyState: '当前没有因子信号触发——如果想收到提醒，去因子库设置关注',
  },
  {
    key: 'positions',
    title: '持仓快照',
    icon: '💼',
    description: '你当前持仓的实时表现。哪些在涨、哪些在跌、哪些该关注。',
    emptyState: '暂无持仓——去下单或者连接券商同步',
  },
];

// ═══════════════════ 驾驶舱教程（首次引导） ═══════════════════

export const COCKPIT_ONBOARDING = {
  steps: [
    {
      target: '.market-state-card',
      title: '这是驾驶舱的心脏',
      body: '每天打开，第一眼看到的就是这张卡。它告诉你：今天市场的整体状态。温和上涨？横盘？还是恐慌？',
    },
    {
      target: '.ai-commentary-tab',
      title: '点一下"AI快评"',
      body: '鲸灵会把今天的数据翻译成人话——"发生了什么""意味着什么""该看什么"。不是一堆数字，是对话。',
    },
    {
      target: '.anomalies-card',
      title: '异动信号在这里',
      body: '你的持仓或关注列表出现异常时——这里会有提醒。不是"跌了提醒你"——是"跌得不对劲"才提醒。',
    },
    {
      target: '.nav-strategies',
      title: '准备好了就开始',
      body: '看完驾驶舱→去策略页面选一个模板→跑回测→如果好→小仓位实盘。你的量化之旅从今天开始。',
    },
  ],
};

export default COCKPIT_WELCOME_STATES;
