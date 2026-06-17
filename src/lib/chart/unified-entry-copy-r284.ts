// ══ R284 QClaw Task 2: 统一图表入口文案 (2h) ══
// ML统一图表入口后,用户通过一个门进入所有图表功能。
// 覆盖: 入口标签 / 导航tab / 快捷动作 / 空状态 / 首次引导 / Tooltips
// 交付: TS常量map — ML的UnifiedChartEntry组件直接import使用

// ═══════════════════════════════════════
// SECTION 1: 入口主标签
// ═══════════════════════════════════════

export const ENTRY_MAIN = {
  /** 侧边栏/顶部导航的主入口按钮 */
  buttonLabel: '图表',
  buttonTooltip: 'K线、指标、画线——所有图表工具的统一入口',
  /** 快捷键提示 */
  shortcutHint: 'Ctrl+K',
  /** 入口描述(用于功能引导) */
  description: '在这里看K线、加指标、画线分析、对比多股——之前分散在8个入口的功能现在一站搞定',
} as const;

// ═══════════════════════════════════════
// SECTION 2: 导航Tab
// ═══════════════════════════════════════

export const NAV_TABS = {
  kline: {
    label: 'K线',
    tooltip: '查看价格走势,切换周期,叠加指标',
    shortcut: '1',
  },
  indicators: {
    label: '指标',
    tooltip: '50+技术指标,一键叠加到图表',
    shortcut: '2',
  },
  drawing: {
    label: '画线',
    tooltip: '68种画线工具——趋势线、斐波那契、江恩',
    shortcut: '3',
  },
  compare: {
    label: '对比',
    tooltip: '两只股票放一起比——谁强谁弱一目了然',
    shortcut: '4',
  },
  patterns: {
    label: '形态',
    tooltip: '自动识别K线形态——头肩底、双底、三角突破',
    shortcut: '5',
  },
  depth: {
    label: '深度',
    tooltip: '买卖盘口深度、大单动向、资金流向',
    shortcut: '6',
  },
  playback: {
    label: '回放',
    tooltip: '历史行情逐K线回放——复盘训练你的盘感',
    shortcut: '7',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 3: 快捷动作
// ═══════════════════════════════════════

export const QUICK_ACTIONS = {
  addIndicator: {
    label: '加指标',
    tooltip: '从50+指标中挑选,叠加到图表上',
    shortcut: 'I',
  },
  addDrawing: {
    label: '画线',
    tooltip: '在图上画趋势线、支撑阻力、斐波那契',
    shortcut: 'D',
  },
  changePeriod: {
    label: '切换周期',
    tooltip: '1分钟↔日线↔周线——一键切换',
    shortcut: ',/.',
  },
  compareStock: {
    label: '加对比',
    tooltip: '输入另一只股票代码,叠加对比走势',
    shortcut: 'C',
  },
  screenshot: {
    label: '截图分享',
    tooltip: '截取当前图表,带分析标注一键分享到社区',
    shortcut: 'Ctrl+Shift+S',
  },
  fullscreen: {
    label: '全屏',
    tooltip: '沉浸式看图——不被打扰的看盘模式',
    shortcut: 'F11',
  },
  autoDraw: {
    label: '自动画线',
    tooltip: 'AI自动检测趋势线、支撑压力——一键出图',
    shortcut: 'A',
  },
  crosshair: {
    label: '十字光标',
    tooltip: '精确读取K线的开高低收和时间',
    shortcut: 'Alt+C',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 4: 首次使用引导 (3步骤)
// ═══════════════════════════════════════

export const ONBOARDING_GUIDE = {
  title: '欢迎来到图表中心',
  subtitle: '3步上手,3分钟变看图高手',
  steps: [
    {
      step: 1,
      title: '选一只股票',
      description: '在顶部搜索框输入股票代码(如"00700"、"AAPL"),或者从自选股里点一个。',
      actionLabel: '去选股',
      highlightTarget: 'stock-search-input',
    },
    {
      step: 2,
      title: '加一个指标',
      description: '点击"指标"标签,挑一个你喜欢的——新手推荐"MACD"或"布林带",老手随便选。',
      actionLabel: '去加指标',
      highlightTarget: 'nav-tab-indicators',
    },
    {
      step: 3,
      title: '调一调布局',
      description: '可以拖拽调整K线和指标面板的大小。按","和"."切周期。按F11进全屏。你说了算。',
      actionLabel: '开始用',
      highlightTarget: 'chart-main-area',
    },
  ],
  skipLabel: '跳过引导,我自己摸索',
  completeLabel: '开始看盘！',
} as const;

// ═══════════════════════════════════════
// SECTION 5: 空状态 (没有选中股票时)
// ═══════════════════════════════════════

export const EMPTY_STATE = {
  title: '还没有选中股票',
  description: '在顶部搜索框输入代码,或者从下方自选股里点一只开始看',
  searchPlaceholder: '输入股票代码——腾讯是00700、苹果是AAPL...',
  suggestions: {
    title: '热门股票',
    items: [
      { code: 'HK.00700', name: '腾讯控股', reason: '港股之王' },
      { code: 'HK.09988', name: '阿里巴巴-SW', reason: '中概龙头' },
      { code: 'US.AAPL', name: 'Apple', reason: '全球最大市值' },
      { code: 'US.NVDA', name: 'NVIDIA', reason: 'AI芯片之王' },
      { code: 'SH.600519', name: '贵州茅台', reason: 'A股股王' },
      { code: 'SZ.300750', name: '宁德时代', reason: '新能源龙头' },
    ],
  },
  // 或者从自选股加载
  fromWatchlist: '从自选股选一只 →',
  noWatchlistYet: '还没有添加自选股。在股票页面点⭐即可添加。',
} as const;

// ═══════════════════════════════════════
// SECTION 6: 无数据状态
// ═══════════════════════════════════════

export const NO_DATA_STATE = {
  kline: {
    title: '暂无K线数据',
    description: '可能是这只股票今天停牌,或者该周期没有数据。试试切换周期,或者检查股票代码。',
    actions: ['切换为日线', '检查股票代码', '查看公告(是否停牌)'],
  },
  indicators: {
    title: '还没有添加指标',
    description: '从50+指标库中挑选你喜欢的——叠加在K线图上,一眼看懂趋势。',
    cta: '添加第一个指标',
  },
  drawing: {
    title: '还没有画线',
    description: '在K线图上画趋势线、支撑阻力、斐波那契——标记你的分析和交易计划。',
    cta: '开始画线',
  },
  compare: {
    title: '还没有加入对比',
    description: '把两只股票放一起——一眼看出谁强谁弱,谁在领涨谁在拖后腿。',
    cta: '添加对比股票',
  },
  patterns: {
    title: '当前K线没有识别到形态',
    description: '不是每根K线都有形态——形态通常出现在关键位置(前高前低、整数关口、均线附近)。换个周期或者耐心等待。',
    actions: ['切换到日线(形态更可靠)', '切换到4H(更灵敏)', '浏览形态图鉴了解61种K线形态'],
  },
} as const;

// ═══════════════════════════════════════
// SECTION 7: 周期切换器文案
// ═══════════════════════════════════════

export const PERIOD_SWITCHER = {
  label: '周期',
  items: [
    { value: '1m', label: '1分', tooltip: '1分钟K线——超短线交易用' },
    { value: '5m', label: '5分', tooltip: '5分钟K线——日内T+0参考' },
    { value: '15m', label: '15分', tooltip: '15分钟K线——盘中趋势判断' },
    { value: '30m', label: '30分', tooltip: '30分钟K线——半日趋势' },
    { value: '60m', label: '60分', tooltip: '1小时K线——日间交易参考' },
    { value: '4h', label: '4小时', tooltip: '4小时K线——波段交易用' },
    { value: '1d', label: '日线', tooltip: '日线——最常用的周期,默认推荐' },
    { value: '1w', label: '周线', tooltip: '周线——中线趋势判断' },
    { value: '1M', label: '月线', tooltip: '月线——长线大势判断' },
  ],
  tip: '按","和"."快速切换周期',
} as const;

// ═══════════════════════════════════════
// SECTION 8: 图表类型切换
// ═══════════════════════════════════════

export const CHART_TYPE_SWITCHER = {
  label: '图表类型',
  items: [
    { value: 'candlestick', label: 'K线', tooltip: '标准蜡烛图——最常用,信息最全' },
    { value: 'hollow_candle', label: '空心K线', tooltip: '涨跌一眼分清——涨空心跌实心' },
    { value: 'bar', label: '美国线', tooltip: 'OHLC竖线——简洁,老派交易员最爱' },
    { value: 'line', label: '折线', tooltip: '只看收盘价——最简洁,看大趋势' },
    { value: 'area', label: '面积图', tooltip: '折线加填色——趋势感更直观' },
    { value: 'heikin_ashi', label: '平均K线', tooltip: '过滤噪声——看趋势更干净,不适合看精确价位' },
    { value: 'renko', label: '砖形图', tooltip: '忽略时间——只看价格波动的"砖块",趋势一目了然' },
  ],
} as const;

// ═══════════════════════════════════════
// SECTION 9: 指标面板辅助文案
// ═══════════════════════════════════════

export const INDICATOR_PANEL_COPY = {
  searchPlaceholder: '搜索指标——MACD、RSI、布林带...',
  categories: {
    all: { label: '全部', tooltip: '50+指标一览' },
    trend: { label: '趋势', tooltip: '看大方向——均线、通道、自适应' },
    momentum: { label: '动量', tooltip: '看力度——RSI、MACD、KD、震荡' },
    volume: { label: '成交量', tooltip: '看量价——资金流、量能、OBV' },
    volatility: { label: '波动', tooltip: '看风险——ATR、布林、波动率' },
    china: { label: 'A股特色', tooltip: '国内独有的主力控盘、多空线等' },
  },
  addButton: '添加到图表',
  removeButton: '移除',
  paramsLabel: '参数',
  resetParamsLabel: '恢复默认',
  noResults: '没有找到匹配的指标。试试换个关键词,比如"趋势"、"成交量"...',
  // 指标卡片hover文案
  cardHover: {
    name: '名称',
    oneliner: '一句话说明',
    signal: '最近信号',
    addToChart: '点击添加到图表',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 10: 画线工具面板文案
// ═══════════════════════════════════════

export const DRAWING_PANEL_COPY = {
  searchPlaceholder: '搜索画线工具——趋势线、斐波那契、江恩...',
  toolCategories: {
    basic: { label: '基础', tooltip: '趋势线、水平线、射线、箭头——最常用的' },
    fibonacci: { label: '斐波那契', tooltip: '回调、扩展、时间区间、扇形——斐波那契全套' },
    channel: { label: '通道', tooltip: '平行通道、回归通道、标准差通道' },
    geometric: { label: '几何', tooltip: '矩形、三角形、圆形、椭圆' },
    gann: { label: '江恩', tooltip: '江恩扇形、江恩箱、江恩方格——时空分析' },
    measurement: { label: '量尺', tooltip: '价格尺、百分比尺、时间尺——精确测量' },
    text: { label: '标注', tooltip: '文字、便签、气泡——在图上写分析笔记' },
  },
  drawingModeActive: '画线模式已开启——在K线图上拖拽绘制',
  drawingModeExit: '按Esc退出画线模式',
  noDrawingSelected: '从上方选一个画线工具开始',
  recentDrawings: '最近使用的画线',
  // 画线→AI分析引导
  aiAnalysisHint: '画完线后,点这里让AI帮你分析这些线的含义 →',
  aiAnalysisCTA: 'AI分析画线',
} as const;

// ═══════════════════════════════════════
// SECTION 11: AI辅助按钮文案
// ═══════════════════════════════════════

export const AI_ASSIST_COPY = {
  indicatorInterpret: {
    label: '解读指标',
    tooltip: 'AI用大白话告诉你这些指标在说什么——不再是冰冷的数字',
    loadingText: '正在解读当前指标...',
  },
  drawingAnalyze: {
    label: '分析画线',
    tooltip: 'AI分析你画的支撑阻力——看看突破概率有多大',
    loadingText: '正在分析画线...',
  },
  patternExplain: {
    label: '形态讲解',
    tooltip: 'AI解释这个K线形态意味着什么,历史胜率多少',
    loadingText: '正在讲解形态...',
  },
  generalAsk: {
    label: '问鲸灵',
    tooltip: '有任何图表问题直接问——"现在该买还是该卖?""这个支撑位可靠吗?"',
    placeholder: '问鲸灵关于这张图的问题...',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 12: 对比模式文案
// ═══════════════════════════════════════

export const COMPARE_MODE_COPY = {
  title: '多股对比',
  addStock: '添加股票',
  removeStock: '移除',
  // 对比维度
  dimensions: {
    priceChange: '涨跌幅',
    volume: '成交量',
    marketCap: '市值',
  },
  baseLabel: '基准',
  percentageMode: '百分比对比(从起点算)',
  absoluteMode: '绝对价格对比',
  emptyCompareSlot: '添加一只股票来对比',
  maxCompareReached: '最多同时对比6只股票',
  legend: {
    strongest: '最强',
    weakest: '最弱',
    hint: '颜色越深越强——一眼看出龙头',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 13: 右键菜单文案
// ═══════════════════════════════════════

export const CONTEXT_MENU_COPY = {
  addAlert: '在此价位设提醒',
  addOrder: '在此价位下单',
  copyPrice: '复制价格',
  addHorizontalLine: '在此价位画水平线',
  addVerticalLine: '在此时间画竖线',
  addNote: '在此添加备注',
  zoomToRange: '缩放到选中区间',
  resetZoom: '还原缩放',
  showCrosshair: '显示十字光标',
  toggleLogScale: '对数坐标',
  toggleGrid: '显示/隐藏网格',
  exportImage: '导出为图片',
  shareChart: '分享图表到社区',
} as const;

// ═══════════════════════════════════════
// SECTION 14: 状态栏信息文案
// ═══════════════════════════════════════

export const STATUSBAR_COPY = {
  // 底栏信息hover tooltip
  ohlc: {
    label: 'OHLC',
    format: '开 {open} 高 {high} 低 {low} 收 {close}',
    tooltip: '开盘价·最高价·最低价·收盘价',
  },
  volume: {
    label: '量',
    format: '成交量 {volume}',
    tooltip: '当前周期的成交量',
  },
  change: {
    label: '涨跌',
    format: '{change} ({changePercent}%)',
    tooltip: '相比前一根K线的涨跌',
  },
  period: {
    format: '{periodLabel}',
    tooltip: '当前图表周期——按,/。快速切换',
  },
  indicatorCount: {
    format: '{count}个指标',
    tooltip: '当前图表叠加的指标数量',
  },
  dataFreshness: {
    live: '实时数据',
    delayed: '延迟{minutes}分钟',
    cached: '缓存数据(刷新于 {time})',
    tooltip: '数据新鲜度——颜色越绿数据越新',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 15: 移动端/响应式适配文案
// ═══════════════════════════════════════

export const MOBILE_COPY = {
  compactTabLabels: {
    kline: 'K线',
    indicators: '指标',
    drawing: '画线',
    compare: '对比',
    patterns: '形态',
  },
  // 因屏幕空间压缩的文案
  fullChartHint: '横屏查看完整图表',
  tapToExpand: '点击展开',
  swipeToSwitch: '左右滑动切换周期',
  pinchToZoom: '双指缩放到区间',
} as const;

// ═══════════════════════════════════════
// SECTION 16: 错误/异常状态
// ═══════════════════════════════════════

export const ERROR_STATE_COPY = {
  dataLoadFailed: {
    title: '加载数据失败',
    description: '可能是网络问题或者这只股票暂不支持该数据类型。',
    actions: ['重试', '切换数据源', '检查股票代码'],
  },
  brokerDisconnected: {
    title: '券商连接断开',
    description: '行情数据源已断开。正在自动重连...',
    manualAction: '手动重连',
  },
  renderingError: {
    title: '图表渲染异常',
    description: '图表组件遇到一个渲染错误。这通常不影响数据,刷新即可恢复。',
    action: '刷新图表',
  },
  tooManyIndicators: {
    title: '指标太多了',
    description: '同时计算的指标不能超过8个——否则图表会变得很慢。请先移除一些再添加。',
    action: '管理已有指标',
  },
} as const;

// ═══════════════════════════════════════
// 全部导出
// ═══════════════════════════════════════

export const UNIFIED_ENTRY_COPY = {
  main: ENTRY_MAIN,
  navTabs: NAV_TABS,
  quickActions: QUICK_ACTIONS,
  onboarding: ONBOARDING_GUIDE,
  empty: EMPTY_STATE,
  noData: NO_DATA_STATE,
  periodSwitcher: PERIOD_SWITCHER,
  chartTypeSwitcher: CHART_TYPE_SWITCHER,
  indicatorPanel: INDICATOR_PANEL_COPY,
  drawingPanel: DRAWING_PANEL_COPY,
  aiAssist: AI_ASSIST_COPY,
  compare: COMPARE_MODE_COPY,
  contextMenu: CONTEXT_MENU_COPY,
  statusbar: STATUSBAR_COPY,
  mobile: MOBILE_COPY,
  errors: ERROR_STATE_COPY,
} as const;

export default UNIFIED_ENTRY_COPY;
