// ══ R260 QClaw Task 1: P2-06 板块轮动图设计 ══
// Sector rotation visualization design — UX copy, labels, tooltips, educational overlay
// Design: 不是一张静态的饼图——是一个\"钱在动\"的动态叙事

// ═══════════════════════════════════════
// PART A: 轮动图架构与定位
// ═══════════════════════════════════════

export const ROTATION_DESIGN = {

  meta: {
    name: '🔄 板块轮动图',
    subtitle: '不是"哪些板块在涨"——是"钱正在流向哪里"',
    philosophy: '板块轮动=市场的\"呼吸\"。钱不会消失——它只是从一个板块搬到另一个板块。看懂轮动=看懂钱的方向。',
    defaultView: '4象限轮动图', // '4_quadrant' | 'flow_sankey' | 'timeline'
  },

  // ── A.1 视图模式 ──
  views: [
    {
      id: 'quadrant', name: '🎯 四象限图', icon: 'crosshair',
      description: '横轴=动量(最近涨跌)，纵轴=资金流向(流入/流出)。右上=最强(涨+吸金)，左下=最弱(跌+失血)。',
      bestFor: '一眼看懂：谁在领涨、谁在领跌、谁在\"转折\"',
      interaction: '方块大小=板块市值。颜色深浅=资金流入/流出力度。拖拽方块对比两个板块。',
    },
    {
      id: 'sankey', name: '🌊 资金流向图', icon: 'waves',
      description: '桑基图——从流出的板块画\"箭头\"到流入的板块。箭头的粗细=资金量大小。',
      bestFor: '"钱到底从哪来、到哪去"——最直观的答案',
      interaction: '点击任一板块=只看它相关的\"入\"和\"出\"。双击板块=进入该板块详情页。',
    },
    {
      id: 'timeline', name: '📅 轮动时间线', icon: 'calendar',
      description: '过去30天的板块强弱热力图——横轴=日期，纵轴=板块，颜色=涨跌幅。',
      bestFor: '"这个板块强势多少天了？在加速还是减速？"',
      interaction: '横向滑动=看历史，纵向对比=看板块谁在\"接棒\"谁。',
    },
  ],
};

// ═══════════════════════════════════════
// PART B: 四象限图 10板块×定位文案
// ═══════════════════════════════════════

export interface SectorQuadrant {
  sectorId: string; sectorName: string; emoji: string;
  quadrant: 'Q1_STRONG' | 'Q2_IMPROVING' | 'Q3_WEAK' | 'Q4_DECAYING';
  momentumPct: number;       // -100 to +100
  flowPct: number;           // -100 to +100
  sizeNote: string;          // 市值占比说明
}

export const QUADRANT_COPY = {

  // 四象限说明
  quadrants: {
    Q1_STRONG: {
      name: '🚀 领涨区', // 右上：动量↑ + 资金流入↑
      description: '在涨 + 钱在进来。这些板块是当前市场的\"发动机\"。',
      strategy: '"坐稳别下车"——这些板块现在是\"趋势\"而非\"短线\"。如果已经持仓→持有。如果没持仓→等小回调再进。',
      warning: '注意：Q1待久了可能\"过热\"——关注RSI是否>70。',
    },
    Q2_IMPROVING: {
      name: '🔄 回暖区', // 右下：动量↓但资金流入↑
      description: '还在跌但资金在悄悄流入——\"聪明钱在抄底\"。',
      strategy: '"布局期"——这些板块可能接近底部。不是明天就涨，而是\"现在的价格未来回头看是便宜的\"。',
      warning: '注意：资金流入可能是\"假抄底\"——如果流入后板块继续大跌，说明\"聪明钱\"也只是\"接了飞刀\"。等板块自身企稳再进。',
    },
    Q3_WEAK: {
      name: '⚠️ 弱势区', // 左下：动量↓ + 资金流出↓
      description: '在跌 + 钱在跑。这些板块是当前市场的\"失血点\"。',
      strategy: '"别接飞刀"——除非你有极强的信念（对行业深度了解），否则别在这些板块里\"找便宜\"。便宜是有原因的。',
      warning: '注意：如果Q3的板块跌了很久（>30%）+ 流出开始缩量 → 可能在\"筑底\"。切换到回暖区的前兆。',
    },
    Q4_DECAYING: {
      name: '📉 转弱区', // 左上：动量↑但资金流出↓
      description: '还在涨但钱在悄悄撤退——\"获利了结进行中\"。',
      strategy: '"分批止盈"——不是\"马上清仓\"，是\"不再追高，已有的仓位考虑减掉一部分锁定利润\"。',
      warning: '注意：Q4不一定马上跌——可能在\"高位横盘\"很久。但资金在流出迟早会反映到价格上。',
    },
  },

  // 板块常驻位置说明
  sectorBaseline: [
    { sectorId: 'TECHNOLOGY', defaultQuadrant: 'Q1_STRONG', note: '牛市中稳定在Q1。熊市中跌到Q3。利率=科技板块的\"象限切换键\"。' },
    { sectorId: 'FINANCIAL', defaultQuadrant: 'Q1_STRONG', note: '利率上升期进入Q1(息差扩大)。利率下降期滑向Q3。' },
    { sectorId: 'HEALTHCARE', defaultQuadrant: 'Q2_IMPROVING', note: '大盘制药=防御(稳定在Q2附近)。生物科技=波动大，牛市Q1熊市Q3。' },
    { sectorId: 'ENERGY', defaultQuadrant: 'Q1_STRONG', note: '油价>80=在Q1。油价<50=滑向Q3。跟WTI高度同步。' },
    { sectorId: 'CONSUMER', defaultQuadrant: 'Q1_STRONG', note: '必需品=防御(Q2附近)。可选品=周期(经济好Q1，经济差Q3)。' },
    { sectorId: 'INDUSTRIALS', defaultQuadrant: 'Q1_STRONG', note: 'PMI>50=Q1。PMI<50=滑向Q3。全球贸易=工业的\"起搏器\"。' },
    { sectorId: 'MATERIALS', defaultQuadrant: 'Q2_IMPROVING', note: '美元弱=Q1。美元强=Q3。中国PMI是最强领先指标。' },
    { sectorId: 'UTILITIES', defaultQuadrant: 'Q2_IMPROVING', note: '利率降=Q1(Q2→Q1)。利率升=滑向Q3。\"债券替代品\"逻辑。' },
    { sectorId: 'REAL_ESTATE', defaultQuadrant: 'Q4_DECAYING', note: '利率敏感——利率降=Q1，利率升=Q3。数据中心REITs独立于传统地产逻辑。' },
    { sectorId: 'COMMUNICATION', defaultQuadrant: 'Q1_STRONG', note: '电信=防御(Q2)。平台=科技同步(Q1)。广告预算=风向标。' },
  ],

  // 经典轮动路径
  classicRotation: {
    name: '📜 经典轮动路径',
    description: '经济周期驱动板块轮动的经典路径（\"行业轮动时钟\"）：',
    phases: [
      { phase: '复苏初期', leader: '可选消费 工业 金融', lagger: '公用事业 必需消费', description: '经济从低谷开始复苏——可选消费(人们开始花钱)、工业(订单增加)、金融(贷款需求上升)率先受益。' },
      { phase: '复苏中期', leader: '科技 工业 原材料', lagger: '公用事业', description: '经济确认回暖——科技(CapEx增加)、工业(产能扩张)、原材料(需求拉动价格)领涨。' },
      { phase: '过热', leader: '能源 原材料', lagger: '科技 可选消费', description: '经济过热、通胀上升——大宗商品(能源/原材料)领涨。科技和可选消费因利率上升承压。' },
      { phase: '滞胀/衰退', leader: '必需消费 公用事业 医疗', lagger: '科技 可选消费 工业', description: '经济下滑——防御板块(必需消费/公用事业/医疗)逆势表现。周期性板块全面承压。' },
    ],
    disclaimer: '这是\"经典路径\"，不是\"铁律\"。每一次牛熊都有自己的特色——2020年疫情=直接从\"复苏\"跳到\"过热\"，跳过了\"中期\"。',
  },
};

// ═══════════════════════════════════════
// PART C: 轮动图交互文案
// ═══════════════════════════════════════

export const ROTATION_UI_COPY = {

  header: {
    title: '🔄 板块轮动',
    subtitle: '钱不会消失——它只是从一个板块搬到另一个板块',
    periodSelector: '时间窗口',
    periods: [
      { id: '1w', label: '1周', description: '短期轮动——谁在\"短线\"领涨' },
      { id: '1m', label: '1个月', description: '中期轮动——趋势是否确立' },
      { id: '3m', label: '3个月', description: '季度轮动——\"大钱\"的方向' },
      { id: '6m', label: '6个月', description: '长期轮动——结构性趋势' },
    ],
  },

  // 象限悬停气泡
  tooltips: {
    quadrantBox: '{sector} 🟢 动量+{momentum}% · 💰 资金{flowDir}{absFlow}%',
    quadrantBoxDetail: '点击 → 看{sector}板块内哪些股票在领涨/领跌',
    sankeyArrow: '{fromSector} → {toSector}: 约{flowAmount}资金在{period}内流入',
    sankeyArrowDetail: '{fromSector}流出了{outflowPct}%的资金，其中{toSector}接收了{pct}%',
    timelineCell: '{sector} {date}: {pct}% — {events}',
  },

  // 板块间对比
  compare: {
    prompt: '拖拽两个板块到对比区 → 看\"资金博弈\"',
    result: (stronger: string, weaker: string, reason: string) =>
      `${stronger}在\"吸收\"${weaker}的资金——${reason}`,
  },

  // 重点事件标注
  eventBadges: {
    earnings: '📅 财报季：{sector}本周{count}家公司发布业绩',
    fed: '🏛️ FOMC会议日 — 利率决议可能改变板块偏好',
    cpi: '📊 CPI数据发布 — 通胀数据直接影响板块轮动',
    rebalance: '🔄 指数再平衡：{index}将在周五调整权重',
  },

  // 空状态
  emptyStates: {
    loading: '🌀 正在计算29个市场的板块资金流向……通常需要5-10秒。',
    noData: '🕳️ 今天板块数据尚未发布。板块轮动图更新频率为\"每个交易日收盘后\"。',
    singleSector: '📌 只有一个板块有数据——无法计算板块之间的资金流动。等待更多数据。',
    allNeutral: '⚖️ 所有板块资金流向都在正常范围内——没有明显的\"轮动\"正在发生。市场在\"等方向\"。',
  },
};

// ═══════════════════════════════════════
// PART D: 轮动信号文案（导航层）
// ═══════════════════════════════════════

export const ROTATION_SIGNALS = {

  title: '📡 轮动信号',
  description: '自动化检测板块轮动变化——告诉你\"谁在动、为什么\"',

  signals: [
    {
      id: 'leader_change', name: '🏆 领涨换手',
      detection: '领涨板块发生变化（旧的Q1最强退出Q1，新的板块进入Q1）',
      copy: '{oldLeader}的领涨被{newLeader}\"接棒\"了。{oldLeader}最近{oldPct}%的涨幅遭遇获利回吐，资金转向了{newLeader}。这是\"健康\"的轮动——说明市场不是\"只有一只股票在涨\"。',
      action: '关注{newLeader}——如果它在Q1站稳超过1周，可能成为下一阶段的\"主线\"。',
    },
    {
      id: 'broad_rotation', name: '🌊 大轮动',
      detection: '市场风格从\"进攻\"切换为\"防御\"（或反之），≥3个板块同时跨象限移动',
      copy: '大轮动正在发生——{fromStyle}板块集体\"让位\"给{toStyle}板块。这不是某一只股票的个别行为——是整个市场的\"风险偏好\"在变化。{toStyle}通常意味着市场预期{implication}。',
      action: '检查你的持仓——如果你的仓位主要分布在{fromStyle}→考虑是否需要增加{toStyle}方向的配置。',
      stylePairs: {
        growth_to_value: { fromStyle: '进攻型(科技/可选消费)', toStyle: '防御型(公用事业/必需消费/医疗)', implication: '经济增长在放缓' },
        value_to_growth: { fromStyle: '防御型', toStyle: '进攻型', implication: '经济复苏在加速' },
        cyclical_to_defensive: { fromStyle: '周期型(工业/能源/原材料)', toStyle: '防御型', implication: '对经济衰退的担忧在上升' },
        defensive_to_cyclical: { fromStyle: '防御型', toStyle: '周期型', implication: '经济\"软着陆\"的信心在增强' },
      },
    },
    {
      id: 'flash_rotation', name: '⚡ 闪轮动',
      detection: '单个板块在1-3天内从Q3→Q2（\"秒回暖\"）',
      copy: '{sector}在短短{days}天内从\"弱势区\"跳到了\"回暖区\"。这种速度通常意味着\"催化剂事件\"——政策变化、行业利好、或者一个龙头股带动了全板块的情绪。',
      action: '检查{sector}的新闻——看是否有实质性利好。如果是\"消息驱动\"而非\"基本面驱动\"→等2-3天看资金是否持续流入（假信号=快进快出）。',
    },
    {
      id: 'stealth_accumulation', name: '🕵️ 悄悄建仓',
      detection: '板块还在跌(Q3)但连续≥5天资金净流入(Q2特征)',
      copy: '{sector}还在跌——但\"聪明钱\"已经在悄悄流入了。连续{consecutiveDays}天资金净流入，但价格还在新低。这是典型的\"底部建仓\"行为——机构在\"慢慢买\"压低价格波动。',
      action: '列入\"重点关注\"清单。不是现在买——是等板块自身企稳（不再创新低+出现第一根放量阳线）→确认\"聪明钱\"的判断正确。',
    },
    {
      id: 'distribution_signal', name: '📤 悄悄出货',
      detection: '板块还在涨(Q1)但连续≥5天资金净流出(Q4特征)',
      copy: '{sector}还在涨——但钱在悄悄跑了。连续{consecutiveDays}天资金净流出，但价格还在高位。这是经典的\"高位派发\"信号——\"聪明钱\"在利用还在涨的价格\"出货给追涨的人\"。',
      action: '如果你持有{sector}的仓位→考虑分批止盈。涨幅已经build up了利润——锁定一部分，剩下的观察。',
    },
    {
      id: 'rotation_fade', name: '🔚 轮动消退',
      detection: '之前有清晰的轮动方向，但最近3天所有板块资金流向都在\"收窄\"',
      copy: '板块轮动在\"消退\"——所有板块的资金流向都在收窄。市场在\"等方向\"——可能是等待某个重大事件（财报季、FOMC、经济数据），事件落地后资金会重新选择方向。',
      action: '暂时不要开新的方向性仓位——等\"钱选了方向\"再跟。在\"无方向市场\"中赌方向=丢硬币。',
    },
  ],
};

// ═══════════════════════════════════════
// PART E: 板块轮动教育卡片
// ═══════════════════════════════════════

export const ROTATION_EDUCATION = {
  title: '🎓 什么是板块轮动？',
  cards: [
    {
      title: '钱不会消失',
      body: '当科技板块在跌的时候，钱去哪了？它没有\"消失\"——它去了金融、去了医疗、去了公用事业。板块轮动图就是追踪这笔\"搬家费\"的。',
    },
    {
      title: '象限=方向',
      body: '右上(领涨)=现在最强。右下(回暖)=在筑底。左下(弱势)=别碰。左上(转弱)=别追。记住这四象限就能读懂8成的板块轮动。',
    },
    {
      title: '速度=信号',
      body: '慢速轮动(几天到几周)=正常的市场调整。快速轮动(几小时到1天)=\"闪轮动\"=通常有重大新闻驱动。慢轮动更可靠，快轮动更值得关注。',
    },
    {
      title: '大轮动=大信号',
      body: '当3个以上板块同时跨象限移动=市场\"风险偏好\"在系统性变化。这是\"最大级别\"的信号——你的整个投资组合可能需要重新审视。',
    },
  ],
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getQuadrantLabel(quadrant: string): string {
  return QUADRANT_COPY.quadrants[quadrant as keyof typeof QUADRANT_COPY.quadrants]?.name || quadrant;
}

export function getRotationSignal(id: string) {
  return ROTATION_SIGNALS.signals.find(s => s.id === id);
}

export function getSectorBaseline(sectorId: string) {
  return QUADRANT_COPY.sectorBaseline.find(s => s.sectorId === sectorId);
}

export default ROTATION_DESIGN;
