// ══ R269 QClaw Task 3: 中国10特色文案 (3h) ══
// A股用户的第一道菜 — 10个中国专属指标/工具的营销级文案
// 这些是QUANT MOO区别于TradingView的差异化武器
// 交付: 中国10专题页 + 品牌文案 + 对比宣传

// ═══════════════════════════════════════
// TYPE
// ═══════════════════════════════════════

export interface ChinaFeatureEntry {
  id: string;
  name: string;              // 产品名
  emoji: string;
  tagline: string;           // ≤15字 slogan
  whyMatters: string;        // ≤30字 — 为什么A股用户需要这个
  description: string;       // ≤60字 — 它干什么、怎么用
  scenario: string;          // ≤40字 — 使用场景
  westernCounterpart: string;// 对标西方产品/指标
  beginnerTip: string;       // ≤25字 — 小白建议
  signalExample: string;     // ≤30字 — 一个典型信号例子
}

// ═══════════════════════════════════════
// 中国10个特色
// ═══════════════════════════════════════

export const CHINA_10_FEATURES: ChinaFeatureEntry[] = [

  // ── 1. BBI 多空指数 ──
  {
    id: 'bbi',
    name: '多空指数 (BBI)',
    emoji: '⚔️',
    tagline: '一条线判断牛熊——最简单',
    whyMatters: 'A股散户入门第一课——是持股还是持币，就这一条线',
    description: 'BBI = 3日+6日+12日+24日均线的平均值。价格在线上→多头市场，持股。价格在线下→空头市场，持币。没有参数——不用调。',
    scenario: '每天开盘看一眼BBI——价格在线上就拿着，在线下就减仓。',
    westernCounterpart: '对标：国外没有直接对应——这是纯中国发明',
    beginnerTip: 'BBI是"足够好"的趋势指标——别追求更复杂的东西',
    signalExample: '价格站上BBI="今天开始偏多"。跌破BBI="今天开始偏空"',
  },

  // ── 2. DKX 多空线 ──
  {
    id: 'dkx',
    name: '多空线 (DKX)',
    emoji: '🎚️',
    tagline: '金叉买、死叉卖——最简单的交易法则',
    whyMatters: '不用看几十根线——两条线交叉 = 你的买卖信号',
    description: 'DKX由快线和慢线组成。快线（MIDA）是价格的中频提取，慢线（MIDB）是快线的移动平均。快线上穿慢线→金叉买入。下穿→死叉卖出。',
    scenario: '中短线交易——找BBI的"细化版"。BBI告诉你方向，DKX告诉你具体什么时候动手。',
    westernCounterpart: '对标：MACD的中国版 | 比MACD更简单——没有柱状图',
    beginnerTip: '只在BBI线上方看DKX的金叉——"顺势而为"',
    signalExample: 'BBI在线上 + DKX金叉 = "方向对+时机对"——最佳入场点',
  },

  // ── 3. PBX 瀑布线 ──
  {
    id: 'pbx',
    name: '瀑布线 (PBX)',
    emoji: '🌊',
    tagline: '6条线看透趋势全貌——像瀑布一样清晰',
    whyMatters: '一眼看出趋势的"层次"——线分散→趋势强，线收拢→要变盘',
    description: '6条不同周期的EMA（4/6/9/13/18/24日），从上到下分层排开。多头排列时像"一级一级往上走的楼梯"。空头反过来。6条线粘在一起→"变盘在即"。',
    scenario: '中线波段——当6条线"开花"(向上散开)=加仓。当6条线"合拢"(粘在一起)=准备离场。',
    westernCounterpart: '对标：GMMA(顾比均线)的中国版 | 比GMMA参数更适合A股节奏',
    beginnerTip: '别被6条线吓到——核心只看"散开还是合拢"',
    signalExample: 'PBX"开花"+"放量"=最好的主升浪信号',
  },

  // ── 4. MIKE 麦克指标 ──
  {
    id: 'mike',
    name: '麦克指标 (MIKE)',
    emoji: '📏',
    tagline: '三档压力+三档支撑——像尺子量出来的',
    whyMatters: '不用自己画支撑阻力——MIKE替你算好了3档精确价位',
    description: '基于TYP(典型价格)计算的6条线——3条压力（WR1/WR2/WR3）和3条支撑（WS1/WS2/WS3）。每条线有数学依据——不是"感觉这里像支撑"。',
    scenario: '设定止盈止损。买入后——止损放WS1（弱支撑），止盈放WR1（弱压力）。走势强时用WR2/WS2。',
    westernCounterpart: '对标：Pivot Points的中国版 | 比Pivot多一档精度',
    beginnerTip: '第一档(WR1/WS1)=大概率会到。第三档(WR3/WS3)=极端情况。',
    signalExample: '价格突破WR2="强势！"——目标看WR3',
  },

  // ── 5. CYW 主力控盘 ──
  {
    id: 'cyw',
    name: '主力控盘 (CYW)',
    emoji: '🕹️',
    tagline: '主力控盘程度——越高越要拿住',
    whyMatters: 'A股的钱潮从来是"主力说了算"——看CYW就知道主力在不在',
    description: 'CYW衡量主力对该股票的控盘程度，值越高→主力掌控力越强。CYW>0=有主力在。CYW>50=高控盘——"想拉就能拉"。CYW<0=主力不在——"行情靠散户自己玩"。',
    scenario: '选股时——优先选CYW>0的股票。CYW越高→回调越浅→"主力不会让自己亏钱"。',
    westernCounterpart: '对标：国外无直接对应 | 基于中国市场的"庄家理论"',
    beginnerTip: 'CYW>50=主力说了算。此时只看BBI方向——不要跟主力对着干',
    signalExample: 'CYW从负转正+"BBI站上"=主力进场信号',
  },

  // ── 6. CYX 市场强弱 ──
  {
    id: 'cyx',
    name: '市场强弱 (CYX)',
    emoji: '💪',
    tagline: '你的股票跑赢大盘了吗？',
    whyMatters: '大盘涨5%你的股票涨2%——假强。大盘跌3%你的股票涨1%——真强。',
    description: 'CYX=个股涨跌幅减去大盘涨跌幅，再除以大盘涨跌幅的绝对值。CYX>1=显著强于大盘。0到1=略强。-1到0=略弱。<-1=显著弱于大盘。',
    scenario: '每天收盘看一眼CYX——如果连续3天CYX>1="大盘跌它不跌，大盘涨它暴涨"。这是最好的标的。',
    westernCounterpart: '对标：Beta系数的中国简化版 | 比Beta更直观',
    beginnerTip: '永远优先买CYX>0的股票——"比大盘强的才是真的好"',
    signalExample: '大盘跌2%+CYX>1.5="逆势走强"——关注度激增',
  },

  // ── 7. ZJLJ 资金统计 ──
  {
    id: 'zjlj',
    name: '资金统计 (ZJLJ)',
    emoji: '🏦',
    tagline: '谁在买、谁在卖——一清二楚',
    whyMatters: 'A股是T+1——今天买的人明天才能卖。看ZJLJ知道"今天谁进场了"',
    description: '分类统计主力（机构/游资）和散户的资金净流向。红柱=主力净买入。绿柱=主力净卖出。连续红柱="主力在持续拿货"。红绿交替="多空分歧大"。',
    scenario: '当ZJLJ出现"连续3根红柱"+"价格横盘"=主力在低位建仓——注意！',
    westernCounterpart: '对标：CMF+ADL的中国升级版 | 更细的分类统计',
    beginnerTip: '主力连续红柱=安心。主力突然翻绿=警觉——先看看再说',
    signalExample: 'ZJLJ连续5天红柱=主力在"定投"——这是最稳健的建仓',
  },

  // ── 8. ZLMM 主力买卖 ──
  {
    id: 'zlmm',
    name: '主力买卖 (ZLMM)',
    emoji: '🐋',
    tagline: '主力到底在买还是在卖——不猜',
    whyMatters: '散户最大的困惑——"涨了，主力在拉还是在出？"ZLMM直接告诉你',
    description: '分别统计主力买入力度和卖出力度。两条线——白线=主力买入强度，黄线=主力卖出强度。白线在上=主力偏买，黄线在上=主力偏卖。',
    scenario: '白线上穿黄线+"白线>50"=主力开始发力买入。白线下穿黄线+"黄线>50"=主力在跑。',
    westernCounterpart: '对标：Force Index的升级版 | 区分买卖方向',
    beginnerTip: '白线在上+价格横盘="主力偷偷买"。白线在下+价格不跌="主力托着价"',
    signalExample: '白线从30冲到70+黄线从70跌到30="买卖角色互换"——大行情前兆',
  },

  // ── 9. DDY 大单动向 ──
  {
    id: 'ddy',
    name: '大单动向 (DDY)',
    emoji: '🔭',
    tagline: '大单在买还是卖——一眼看穿',
    whyMatters: '大单=大资金。DDY告诉你:"今天的大资金是净买入还是净卖出"',
    description: 'DDY=大单买入量-大单卖出量，除以流通股本，乘以100。正数=大资金在买，负数=大资金在卖。数值越大→大资金越活跃。',
    scenario: 'DDY突然从0跳到+5以上+"价格突破阻力"=最可靠的突破信号。大资金替你确认了方向。',
    westernCounterpart: '对标：大型订单流分析的中国版 | 比西方的Block Trade更日常',
    beginnerTip: 'DDY>2=大资金在买——跟着走。DDY<-2=大资金在卖——别接飞刀',
    signalExample: 'DDY=+8+价格涨3%="大资金带队冲锋"——安心持有',
  },

  // ── 10. DDY3 三日大单 ──
  {
    id: 'ddy3',
    name: '三日大单 (DDY3)',
    emoji: '📅',
    tagline: '过滤单日噪音——看三天才准',
    whyMatters: '单日DDY可能骗人——有的主力会"拆单"。看三天累计=主力逃不掉',
    description: 'DDY3=最近3日的DDY之和。主力可以一天内拆散大单——但三天不可能。DDY3>5="三天内有确定的机构买入"。DDY3<-5="三天内有确定的机构卖出"。',
    scenario: '做波段决策——不靠单日DDY。只靠DDY3——它的方向就是"这三天资金的真实态度"。',
    westernCounterpart: '对标：3-Day OBV变体 | 但DDY3区分了大单小单',
    beginnerTip: 'DDY3和DDY同向=趋势确定。DDY3和DDY反向=信号还没确认——再等一天',
    signalExample: 'DDY连续3天为负但DDY3翻正="前两天出货的是假主力"——趋势反转',
  },
];

// ═══════════════════════════════════════
// 中国10合集宣传 — 登入页/弹窗/专题页文案
// ═══════════════════════════════════════

export const CHINA_10_PROMOTION = {
  hero: {
    title: '你在A股，就该用A股的指标',
    subtitle: 'TradingView不会告诉你CYW——因为那是给外国人用的。QUANT MOO深度适配中国——10个你认识的、你需要的、你在同花顺上舍不得关的指标，都在这。',
    cta: '打开中国10合集',
  },

  sellingPoints: [
    { title: '你认识',  body: 'BBI、DKX、主力控盘——这些名字你听过。不需要学新的东西。' },
    { title: '你需要',  body: 'A股是T+1、是主力市、是政策市。外国人设计的指标不考虑这些——中国的指标考虑。' },
    { title: '你信任',  body: '这些指标在同花顺、通达信上每天被几千万散户使用。不是"新指标"——是"成熟系统"。' },
  ],

  comparison: {
    title: 'QUANT MOO vs TradingView — 中国指标对比',
    qu: '✅ 10个中国专属指标 | ✅ 中文名+中文信号 | ✅ 主力资金追踪',
    tv:   '❌ 0个中国指标 | ❌ 只有英文 | ❌ 没有主力概念',
  },

  tags: [
    '比同花顺好看', '比东方财富专业', '比通达信用着舒服',
    '有主力控盘', '有资金统计', '有BBI多空线',
    '中国人设计', 'A股优先',
  ],
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getChinaFeature(id: string): ChinaFeatureEntry | undefined {
  return CHINA_10_FEATURES.find(f => f.id === id);
}

export function getAllChinaFeatures(): ChinaFeatureEntry[] {
  return CHINA_10_FEATURES;
}

export function getChinaFeaturePairs(): { indicator: ChinaFeatureEntry; promotion: string }[] {
  const pairings: Record<string, string> = {
    bbi: '入门先从BBI学起',
    cyw: 'A股最有特色的指标',
    zlmm: '散户偷看主力的窗口',
    ddy3: '波段交易的信赖基础',
  };
  return CHINA_10_FEATURES.map(f => ({
    indicator: f,
    promotion: pairings[f.id] || 'A股用户必备',
  }));
}

export default CHINA_10_FEATURES;
