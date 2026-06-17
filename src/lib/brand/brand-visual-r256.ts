// ══ R256 QClaw BN-02: QUANT MOO 品牌视觉体系 ══
// Brand visual identity: Logo, Color, Typography, Design Tokens
// Design goal: "量化 + 牛" = 聪明地赚钱。不是赌博式的牛市狂热，是量化式的理性看多

export const BRAND = {
  name: 'QUANT MOO',
  pronunciation: 'kwɑnt muː',
  tagline: 'Smart Bull. No Hype.',
  taglineCN: '理性看多。',
  description: '量化交易平台。牛(moo)不是追涨杀跌的狂热——是用数据、因子、AI，理性地找到该涨的东西。',
} as const;

// ═══════════════ 1. LOGO ═══════════════

export const LOGO = {
  concept: '牛角 + 数据点 — 牛角由散点图/数据点构成，暗示"数据驱动的看多"。牛角上扬=向上趋势。',

  wordmark: {
    primary: 'QUANT MOO',
    style: '全大写，字母间距+0.05em，几何感强',
    font: 'Inter (或类似的几何无衬线体)',
    fontWeight: 800,
    variants: {
      full: 'QUANT MOO',
      icon: 'QM',
      symbol: '🐂 (emoji版，轻量使用)',
    },
  },

  logomark: {
    description: '数据牛角 — 由72个小圆点构成的抽象牛角/向上箭头。每个点代表一个数据信号。',
    geometry: '牛角从底部(0,0)以两种曲率向上扩散——左角略缓(价值)，右角略陡(动量)。两角在顶端汇聚成尖。',
    dotCount: 72, // 象征360度覆盖×多时间框架=72个"数据切片"
    colorL: '#00D4AA', // 左角=冷静绿(价值侧)
    colorR: '#7C3AED', // 右角=紫(动量侧)
    accent: '#FF6B00', // 两角交汇顶点=橙色(信号/行动)
    variants: {
      fullColor: '全色版，用于深色背景',
      mono: '单色版(白/黑)，用于浅色和文档',
      icon: '仅牛角轮廓(无文字)，用于favicon和app图标',
    },
  },

  appIcon: {
    shape: '圆角方形(圆角半径20%)',
    background: '#0A0E1A (深空蓝黑)',
    foreground: '数据牛角(白+渐变)',
    description: '深色背景上的数据牛角。干净、专业、不像传统交易软件(没有K线蜡烛图)，更像一台精密仪器。',
  },

  // 品牌标志性点：量子化牛角三角形
  signatureElement: '数据牛角三角 — 在卡片/页眉/加载态中作为品牌水印。由3×3网格点阵组成的简化版牛角。',
} as const;

// ═══════════════ 2. COLOR PALETTE ═══════════════

export const COLORS = {
  // —— 主色系：量化感的"冷静看多" ——
  primary: {
    name: 'Moo Green / 牛气青',
    hex: '#00D4AA',
    rgb: 'rgb(0, 212, 170)',
    hsl: 'hsl(168, 100%, 42%)',
    usage: '主要CTA按钮、交易买入按钮、账户盈余、策略看多信号、Logo右角',
    meaning: '看多。但不是华尔街赌徒式的荧光绿(#00FF00)，是带青调的理性绿——有计算的温度。',
  },
  primaryDark: {
    hex: '#00B894',
    usage: 'hover/pressed态',
  },
  primaryLight: {
    hex: '#B2F2E3',
    usage: '浅色背景上的绿色元素、看多信号背景',
  },

  secondary: {
    name: 'Quantum Purple / 量子紫',
    hex: '#7C3AED',
    rgb: 'rgb(124, 58, 237)',
    hsl: 'hsl(262, 83%, 58%)',
    usage: 'AI功能、高级功能标识、Logo左角、数据分析、二级CTA',
    meaning: '智能。不是神秘——是"正在计算"。AI/分析/洞察的颜色。',
  },
  secondaryDark: {
    hex: '#6D28D9',
    usage: 'hover/pressed态',
  },

  // —— 功能色系 ——
  signal: {
    buy: '#00D4AA',      // 买入=主色(理性看多)
    sell: '#EF4444',     // 卖出=红(清晰警告)
    warning: '#FF6B00',  // 警告/注意=橙(不是红——还没到卖出，先警惕)
    neutral: '#94A3B8',  // 中性=灰蓝(无信号)
    strongBuy: '#059669', // 强烈买入=深绿(更强信号)
    strongSell: '#DC2626', // 强烈卖出=深红(更强信号)
  },

  // —— 背景色系：深空主题 ——
  background: {
    deepest: '#0A0E1A',  // 最深背景(全屏暗模式基底)
    deep: '#111827',     // 卡片/面板背景
    surface: '#1E293B',  // 次级面(输入框/下拉)
    elevated: '#334155', // 浮层面(弹窗/工具提示)
    lightest: '#F8FAFC', // 亮模式基底
    lightCard: '#FFFFFF', // 亮模式卡片
  },

  // —— 文字色系 ——
  text: {
    white: '#FFFFFF',
    offWhite: '#E2E8F0',
    muted: '#94A3B8',      // 次级文本
    disabled: '#64748B',    // 禁用文本
    dark: '#0F172A',        // 亮模式主文本
    darkMuted: '#475569',   // 亮模式次级文本
  },

  // —— 图表色系 ——
  chart: {
    lineUp: '#00D4AA',
    lineDown: '#EF4444',
    areaUp: 'rgba(0, 212, 170, 0.15)',
    areaDown: 'rgba(239, 68, 68, 0.1)',
    grid: 'rgba(148, 163, 184, 0.1)',
    crosshair: 'rgba(255, 255, 255, 0.3)',
    volume: '#7C3AED',
    volumeOpacity: 'rgba(124, 58, 237, 0.4)',
    // 多线图配色 (10色, 在暗背景上清晰)
    multiLine: [
      '#00D4AA', '#7C3AED', '#FF6B00', '#3B82F6', '#EC4899',
      '#14B8A6', '#A855F7', '#F59E0B', '#06B6D4', '#F43F5E',
    ],
  },

  // —— 市场状态色 ——
  market: {
    up: '#00D4AA',
    down: '#EF4444',
    flat: '#94A3B8',
    volatile: '#FF6B00',
    extreme: '#7C3AED',
  },
} as const;

// ═══════════════ 3. TYPOGRAPHY ═══════════════

export const TYPOGRAPHY = {
  heading: {
    family: 'Inter',
    style: '几何无衬线体，现代、清晰、中性。不做作。',
    weights: [700, 800],
    letterSpacing: '-0.02em', // 微负间距，标题更紧凑有力
    usage: 'h1-h4，数据卡片标题，策略名称',
  },

  body: {
    family: 'Inter',
    weights: [400, 500, 600],
    letterSpacing: '0',
    usage: '正文、表格、表单',
  },

  monospace: {
    family: 'JetBrains Mono (或 SF Mono/Consolas)',
    style: '等宽字体，用于数据、代码、数字',
    weights: [400, 500],
    usage: '股价、百分比、因子值、订单价格、代码块',
  },

  chinese: {
    family: 'PingFang SC (macOS) / Microsoft YaHei (Windows) / Noto Sans SC (Linux)',
    style: '中文无衬线体，与Inter配合',
    weights: [400, 500, 700],
    usage: '所有中文内容',
  },

  scale: {
    h1: { size: '32px', weight: 800, lineHeight: 1.2, usage: '页面标题' },
    h2: { size: '24px', weight: 700, lineHeight: 1.3, usage: 'section标题' },
    h3: { size: '18px', weight: 600, lineHeight: 1.4, usage: '卡片标题' },
    h4: { size: '15px', weight: 600, lineHeight: 1.4, usage: '子标题' },
    body: { size: '14px', weight: 400, lineHeight: 1.6, usage: '正文' },
    bodySmall: { size: '12px', weight: 400, lineHeight: 1.5, usage: '辅助文本/标签' },
    caption: { size: '11px', weight: 400, lineHeight: 1.4, usage: '脚注/时间戳' },
    number: { size: '24px', weight: 600, lineHeight: 1, usage: '关键数字/股价', family: 'monospace' },
    numberLarge: { size: '36px', weight: 700, lineHeight: 1, usage: '页面核心数字', family: 'monospace' },
  },
} as const;

// ═══════════════ 4. DESIGN TOKENS ═══════════════

export const TOKENS = {
  spacing: {
    unit: 4, // 基础单位4px
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
  },
  radius: {
    none: 0,
    sm: 4,   // 按钮内角
    md: 8,   // 卡片、输入框
    lg: 12,  // 大卡片
    xl: 16,  // 模态框
    full: '9999px', // 药丸/标签
  },
  shadow: {
    card: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
    elevated: '0 4px 6px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
    modal: '0 10px 25px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.3)',
    glow: '0 0 20px rgba(0, 212, 170, 0.15)', // 品牌色微光
  },
  border: {
    subtle: '1px solid rgba(148, 163, 184, 0.1)',
    visible: '1px solid rgba(148, 163, 184, 0.2)',
    active: '1px solid #00D4AA',
    focus: '2px solid #7C3AED',
  },
  animation: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '400ms ease',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // 弹性过渡
  },
  glass: {
    light: 'rgba(17, 24, 39, 0.8)',
    heavy: 'rgba(17, 24, 39, 0.95)',
    blur: 'backdrop-filter: blur(12px)',
  },
  // 数据可视化专用
  dataViz: {
    pointSize: 3,
    lineWidth: 2,
    barWidth: 16,
    gapRatio: 0.3,
    animationDuration: '600ms',
  },
} as const;

// ═══════════════ 5. BRAND ELEMENTS ═══════════════

export const BRAND_ELEMENTS = {
  // 品牌水印 — 在任何空白/加载态使用
  watermark: '数据牛角三角(3×3点阵)，opacity: 0.03，旋转45°，作为背景水印',

  // 加载态 — 品牌化
  loading: {
    spinner: '数据牛角自转 — 72个点依次亮起(顺时针)，形成牛角轮廓',
    skeleton: '渐变色条(主色→紫色渐变)，不是灰色',
    emptyState: '简化版数据牛角图标 + 一句品牌语音文案("Wait for the data to moo. 🐂")',
  },

  // 声音品牌 (可选，提示音)
  audio: {
    buy: '上升的双音 (C5→E5)，持续200ms — 理性、干净',
    sell: '下降的双音 (E5→C5)，持续200ms — 明确、不刺耳',
    alert: '单音#D5，持续300ms — 中性警告',
    startup: '三音和弦 (C5-E5-G5)，渐强500ms — 品牌开场',
  },

  // 品牌插画风格
  illustration: {
    style: '几何+等距。纯色+渐变。牛用几何块面表示(不是写实牛)。',
    palette: ['#00D4AA', '#7C3AED', '#FF6B00', '#3B82F6', '#FFFFFF'],
    mood: '现代、理性、有温度的精确。不是emoji式可爱，不是古典写实。',
  },
} as const;

// ═══════════════ 6. SCREEN LAYOUTS ═══════════════

export const LAYOUTS = {
  // 驾驶舱首页
  cockpit: `深空背景(#0A0E1A) + 顶部品牌栏(透明玻璃效果)
  中央：大盘情绪指标(大数字+微光)
  底部网格：关注列表卡片(磨砂玻璃卡片，hover时阴影加深)
  右下角：Whaley小头像(随时呼出AI对话)`,

  // 个股详情
  stockDetail: `左侧：K线图(深背景，主色K线)
  右上：关键指标(4格数字卡片)
  右下：AI因子解读(紫色标识)`,

  // AI对话
  aiChat: `半透明面板，紫色发光边框
  Whaley头像(品牌紫)在左上
  消息气泡：AI气泡带紫边，用户气泡带青边`,

  // 策略编辑器
  strategyEditor: `分屏布局
  左侧：模板选择(卡片网格)
  右侧：参数面板(深色表单)
  底部：回测结果(图表)`,

  // 登录页
  login: `深空背景+极简品牌标识居中
  Logo数据牛角(大，半透明)在上
  "QUANT MOO"在下
  登录框：半透明卡片，毛玻璃效果`,
} as const;

// ═══════════════ 7. CSS VARIABLES ═══════════════
// CSS变量映射表 — 直接粘贴到 :root { ... } 即可使用

export const CSS_VARIABLES = `
:root {
  /* ─── Colors ─── */
  --qm-primary: #00D4AA;
  --qm-primary-dark: #00B894;
  --qm-primary-light: #B2F2E3;
  --qm-secondary: #7C3AED;
  --qm-secondary-dark: #6D28D9;
  --qm-accent: #FF6B00;

  --qm-buy: #00D4AA;
  --qm-sell: #EF4444;
  --qm-warning: #FF6B00;
  --qm-neutral: #94A3B8;

  --qm-bg-deepest: #0A0E1A;
  --qm-bg-deep: #111827;
  --qm-bg-surface: #1E293B;
  --qm-bg-elevated: #334155;
  --qm-bg-light: #F8FAFC;
  --qm-bg-light-card: #FFFFFF;

  --qm-text-primary: #FFFFFF;
  --qm-text-secondary: #E2E8F0;
  --qm-text-muted: #94A3B8;
  --qm-text-disabled: #64748B;
  --qm-text-dark: #0F172A;

  --qm-border-subtle: rgba(148, 163, 184, 0.1);
  --qm-border-visible: rgba(148, 163, 184, 0.2);
  --qm-border-active: #00D4AA;

  /* ─── Typography ─── */
  --qm-font-heading: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --qm-font-body: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --qm-font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;

  /* ─── Spacing ─── */
  --qm-space-unit: 4px;

  /* ─── Radii ─── */
  --qm-radius-sm: 4px;
  --qm-radius-md: 8px;
  --qm-radius-lg: 12px;
  --qm-radius-full: 9999px;

  /* ─── Shadows ─── */
  --qm-shadow-card: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
  --qm-shadow-elevated: 0 4px 6px rgba(0,0,0,0.4);
  --qm-shadow-modal: 0 10px 25px rgba(0,0,0,0.5);
  --qm-shadow-glow: 0 0 20px rgba(0, 212, 170, 0.15);

  /* ─── Transitions ─── */
  --qm-transition-fast: 150ms ease;
  --qm-transition-normal: 250ms ease;
  --qm-transition-slow: 400ms ease;
}
` as const;

export default BRAND;
