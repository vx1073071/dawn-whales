// ══ R258 QClaw Task 1: K线引导文案 ══
// Candlestick/K-line onboarding — first-visit guide, tooltips, empty states, interactions
// Design: 不是扔一张K线图让用户自己琢磨——是把"怎么看K线"拆成人类能懂的语言

export interface KLineGuideSection {
  id: string; title: string; emoji: string;
  body: string;
  highlight: string;       // 关键句（视觉加粗）
  tip: string;
}

// ═══════════════ 首次看K线 — 3步引导 ═══════════════

export const KLINE_ONBOARDING: KLineGuideSection[] = [
  {
    id: 'anatomy', title: '一根蜡烛告诉你一个"故事"', emoji: '🕯️',
    body: `K线（蜡烛图）是世界上最古老的行情可视化方法——300年前的日本米商发明。

一根蜡烛 = 一个时间段的价格走势：
· 蜡烛的"身体"（宽的部分）= 开盘价 → 收盘价
· 蜡烛的"影线"（细的部分）= 最高价和最低价
· 绿色/白色蜡烛 = 涨了（收盘 > 开盘）
· 红色/黑色蜡烛 = 跌了（收盘 < 开盘）

绿色长蜡烛 = "多头很猛，从头买到尾"
红色长蜡烛 = "空头很猛，从头砸到尾"
十字星 = "多空打架，谁也没赢"
锤子线 = "跌了一路但尾盘有人疯狂抄底"`,
    highlight: '蜡烛的大小和影线占比，比颜色更重要。一根小绿蜡烛 = 今天很无聊，不是"在涨"。',
    tip: '💡 试着切换不同时间周期——日K看趋势，周K看方向，月K看大级别。',
  },
  {
    id: 'interaction', title: '这张图能做什么？', emoji: '🖱️',
    body: `K线图不只是"看"——是探索的工具：

· 滚轮缩放 → 看大趋势还是细微波动
· 拖拽平移 → 向左看历史，向右看未来
· 点击蜡烛 → 弹出该时段的O/H/L/C/量
· 双指缩放（手机）→ 同样缩放

下面还有配套工具：
· 成交量柱 — 判断上涨/下跌有没有"力度"
· 指标叠加 — MACD、RSI、布林带随便加
· 画线工具 — 画趋势线、支撑阻力
· 形态标注 — 系统自动帮你识别头肩顶/双底等`,
    highlight: '滚轮缩放是最常用的操作——大盘趋势用月K，日内交易用1分钟K。',
    tip: '💡 按住Ctrl+拖拽=画矩形选区域→自动跳入该时间段。手机端用两指。',
  },
  {
    id: 'timeframes', title: '选对时间周期 = 问对问题', emoji: '⏱️',
    body: `不同时间周期的K线回答不同的问题：

· 1分钟/5分钟/15分钟 → "今天盘中有没有人做局？"（适合日内交易者）
· 1小时/4小时 → "今天大盘什么节奏？"（适合波段交易者）
· 日K → "最近的趋势是什么？"（适合90%的人，这是默认视图）
· 周K → "大方向是多还是空？"（适合中期投资者）
· 月K → "这是牛市还是熊市？"（适合长期投资者）

什么时候用哪个：
→ 想做日内交易 → 1分钟+5分钟
→ 想持有1-4周 → 日K
→ 想看清大趋势 → 周K
→ 想判断牛市熊市 → 月K`,
    highlight: '别只用一根蜡烛做决定。看日K的日间波动做长期投资 = 用显微镜看地图。',
    tip: '💡 专业玩法：日K上看到信号 → 切到周K确认趋势方向 → 再回到日K找入场点。',
  },
];

// ═══════════════ K线元素解读 ═══════════════

export const CANDLE_ANATOMY = {
  parts: {
    body: { name: '实体', emoji: '⬛', description: '开盘价→收盘价。越大=多空力量越悬殊。' },
    upperWick: { name: '上影线', emoji: '📌', description: '最高点。长上影线=上面有人砸盘。' },
    lowerWick: { name: '下影线', emoji: '📌', description: '最低点。长下影线=下面有人抄底。' },
    open: { name: '开盘价', emoji: '🔓', description: '这根蜡烛开始时是什么价。' },
    close: { name: '收盘价', emoji: '🔒', description: '这根蜡烛结束时是什么价。最重要的一个数字。' },
    high: { name: '最高价', emoji: '⬆️', description: '这个时间段内最高卖到了多少。' },
    low: { name: '最低价', emoji: '⬇️', description: '这个时间段内最低跌到了多少。' },
  },
};

// ═══════════════ K线形态速查（最简单最常用的） ═══════════════

export const CANDLE_PATTERNS_QUICK = [
  {
    name: '锤子线', emoji: '🔨', signal: '看涨反转',
    description: '很长的下影线 + 小实体在上方。= 跌了一路但尾盘被人疯狂抄底。',
    action: '如果出现在下跌趋势底部 → 可能见底。等下一根确认（下一根是绿蜡烛=确认）。',
    visual: '红色小实体在上，长长的下影线朝下',
  },
  {
    name: '上吊线', emoji: '🪢', signal: '看跌反转',
    description: '跟锤子线长得一样但出现在顶部。= 涨了一路但尾盘有人在出货。',
    action: '如果出现在上涨趋势顶部 → 小心。等下一根确认（下一根是红蜡烛=出逃信号）。',
    visual: '红色小实体在上，长长的下影线朝下（和锤子线形状一样，但位置不同）',
  },
  {
    name: '吞没形态', emoji: '🐋', signal: '强反转',
    description: '今天的蜡烛把昨天整根蜡烛"吞"掉了。看涨吞没=今天的大绿蜡烛盖过了昨天的小红蜡烛。',
    action: '吞没=多空一方突然碾压另一方。是最强的反转信号之一。',
    visual: '看涨吞没：大绿蜡烛>昨天红蜡烛 | 看跌吞没：大红蜡烛>昨天绿蜡烛',
  },
  {
    name: '十字星', emoji: '➕', signal: '变盘信号',
    description: '开盘≈收盘，上下影线各一边。= "多空打了一天，谁也没赢"。',
    action: '十字星=不确定。接下来那根蜡烛的方向=市场选择了方向。等确认不要急。',
    visual: '十字：上下影线 + 中间小小实体或一条线',
  },
  {
    name: '三只乌鸦', emoji: '🐦‍⬛', signal: '强看跌',
    description: '连续三根大阴线，每根都收在最低点附近。= "空头在持续碾压"。',
    action: '出现在上涨之后=出货信号。别抄底——没有人知道底在哪。',
    visual: '三根大红色蜡烛，一根接一根，没有下影线或很短',
  },
  {
    name: '早晨之星', emoji: '⭐', signal: '看涨反转',
    description: '三根蜡烛：大阴→小十字→大阳。= 空头力量耗尽→多空平衡→多头反攻。',
    action: '最经典的见底信号之一。第三根大阳线确认=可以入场了。',
    visual: '🔴大阴 → ➕小星 → 🟢大阳',
  },
];

// ═══════════════ K线页面工具提示 ═══════════════

export const KLINE_TOOLTIPS = {
  timeframeSelector: '切换K线周期。日K最常用。短线看5/15分钟，长线看周K/月K。',
  indicatorBtn: '叠加技术指标。MACD/RSI/布林带/移动均线——想加什么加什么。',
  drawingBtn: '画线工具。趋势线/水平线/斐波那契——在图上标注你的分析。',
  compareBtn: '叠加对比股票。把两只股票放同一张图上——看谁跑赢谁。',
  volumeBars: '成交量。红柱=下跌放量，绿柱=上涨放量。上涨有量=真涨，上涨无量=假涨。',
  patternLabel: 'AI自动识别的K线形态。点击看形态的详细解读和操作建议。',
  crosshair: '十字光标。按住拖动=看任意时间点的精确价格。',
  saveScreenshot: '保存当前图表（不含你的持仓信息）→ 分享或保存到笔记。',
  aiQuickReview: '点这里 → Whaley用1秒钟给你当前股票的AI分析（基于K线+指标+基本面）。',
  favoriteBtn: '加入自选。加之后这只股票会在热力图高亮+异动推送。',
};

// ═══════════════ K线空状态 & 异常状态 ═══════════════

export const KLINE_EMPTY_STATES = {
  noSymbol: {
    title: '还没有选择股票 📈',
    subtitle: '搜索或从热力图中选择一只股票 → K线图会在这里加载。',
    tip: '试试搜索"腾讯"、"AAPL"、或"0700"。',
    action: '搜索股票',
  },
  loading: {
    title: '正在拉取K线数据… 📡',
    subtitle: '从Yahoo Finance获取历史K线。数据长度取决于你的时间周期——日K拉2年，1分钟K拉7天。',
    tip: '如果加载时间过长 → 切换到更大的时间周期（日K比1分钟K快很多）。',
  },
  noData: {
    title: '这个时间周期没有K线数据 📭',
    subtitle: '小周期K线（1分钟/5分钟）通常只有最近几天的数据。试试切到日K或更大的周期。',
    tip: '日K数据覆盖2年。周K和月K覆盖更长——适合看大趋势。',
    action: '切换到日K',
  },
  tooFewBars: {
    title: 'K线数据太少（只有{count}根）📉',
    subtitle: '数据量不足以显示有意义的趋势。要么是刚上市的新股，要么是时间周期太短。',
    tip: '新上市不足3个月的股票建议看日K就够了——没有足够的周K数据来评判趋势。',
  },
};

// ═══════════════ 画线工具说明 ═══════════════

export const DRAWING_TOOL_TIPS = [
  { name: '趋势线', emoji: '📐', 
    description: '连接两个低点（上升趋势线）或两个高点（下降趋势线）= 画出支撑/阻力方向。' },
  { name: '水平线', emoji: '➖', 
    description: '画一条固定价格的水平线。常用于标注支撑位（下方）和阻力位（上方）。' },
  { name: '斐波那契', emoji: '🌀', 
    description: '从高点拉到低点（下跌）或低点拉到高点（上涨）。自动画出38.2%/50%/61.8%回调位。' },
  { name: '矩形', emoji: '▬', 
    description: '框出一个价格区间。常用于标注盘整区或目标区间。' },
  { name: '平行通道', emoji: '⫿', 
    description: '画一条趋势线再拉一条平行线。标出价格通道的上轨和下轨。' },
];

// ═══════════════ 工具函数 ═══════════════

export function getKLineOnboardingStep(step: number): KLineGuideSection | undefined {
  return KLINE_ONBOARDING[step];
}

export function getPatternByName(name: string) {
  return CANDLE_PATTERNS_QUICK.find(p => p.name === name);
}

export default KLINE_ONBOARDING;
