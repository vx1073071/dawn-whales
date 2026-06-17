// ══ R265 QClaw Task 2: 5套指标模板文案 (2h) ══
// P0-04: 一键指标预设模板 — 每个人话名称/使用场景/适合人群/指标列表
// 交付: 模板定义+文案map → 接入IndicatorTemplates.tsx 的5个按钮

// R266: import removed — NewIndicatorCopy unused

// ═══════════════════════════════════════
// TYPE: 模板定义
// ═══════════════════════════════════════

export interface IndicatorTemplate {
  id: string;
  name: string;              // ≤8字中文名
  emoji: string;             // 1-2 emoji
  tagline: string;           // ≤12字标语
  scenario: string;          // ≤25字适用场景
  forWhom: string;           // ≤20字适合谁
  indicators: IndicatorSlot[];
  layout: TemplateLayout;
  tips: string[];            // 2-3条使用小提示
  beginnerRating: 1|2|3|4|5; // 小白友好度: 5=最易用
}

export interface IndicatorSlot {
  id: string;                // 指标ID (匹配indicator-engine)
  position: 'main' | 'sub';  // main=主图叠加, sub=独立子图
  order: number;             // 子图内的顺序
  params?: Record<string, number>;
  color?: string;
  label?: string;            // 面板显示标签
}

export type TemplateLayout = 'single' | 'dual' | 'triple' | 'quad';

// ═══════════════════════════════════════
// 5套模板
// ═══════════════════════════════════════

export const INDICATOR_TEMPLATES: IndicatorTemplate[] = [

  // ── 模板1: 均线看趋势 ──
  {
    id: 'ma-trend',
    name: '均线看趋势',
    emoji: '📈',
    tagline: '一眼看清多空方向',
    scenario: '打开任何股票 — 先看均线排列。多头排列=持有,空头排列=观望。',
    forWhom: '所有人 — 小白第一个要学的模板',
    indicators: [
      { id: 'ma', position: 'main', order: 1, params: { period: 5 },  color: '#f59e0b', label: 'MA5' },
      { id: 'ma', position: 'main', order: 2, params: { period: 10 }, color: '#3b82f6', label: 'MA10' },
      { id: 'ma', position: 'main', order: 3, params: { period: 20 }, color: '#a78bfa', label: 'MA20' },
      { id: 'ma', position: 'main', order: 4, params: { period: 60 }, color: '#ef4444', label: 'MA60' },
    ],
    layout: 'single',
    tips: [
      'MA5上穿MA20="金叉" — 短线看涨',
      '4条均线从短到长依次排列="多头排列" — 最强的上涨信号',
      'MA5在最下面 MA60在最上面="空头排列" — 别抄底',
    ],
    beginnerRating: 5,
  },

  // ── 模板2: MACD金叉死叉 ──
  {
    id: 'macd-cross',
    name: 'MACD金叉死叉',
    emoji: '✂️',
    tagline: '捕捉趋势转换的瞬间',
    scenario: '想判断"现在是该买还是该卖"的时候 — MACD是最常用的工具。',
    forWhom: '所有人 — 散户最爱的指标',
    indicators: [
      { id: 'macd', position: 'sub', order: 1, params: { fast: 12, slow: 26, signal: 9 }, label: 'MACD(12,26,9)' },
      { id: 'ma', position: 'main', order: 1, params: { period: 20 }, color: '#a78bfa', label: 'MA20(参考)' },
    ],
    layout: 'dual',
    tips: [
      'MACD上穿信号线="金叉" — 主力图上的绿色箭头',
      '金叉在零轴上方=强趋势启动。金叉在零轴下方=可能只是反弹',
      'MACD与价格背离(价跌MACD涨)=即将反转 — 最重要信号',
    ],
    beginnerRating: 4,
  },

  // ── 模板3: 布林带突破 ──
  {
    id: 'boll-break',
    name: '布林带突破',
    emoji: '🎯',
    tagline: '看价格是"贵了"还是"便宜了"',
    scenario: '想判断"这个价格是不是太高/太低了" — 布林带告诉你答案。',
    forWhom: '短线波段交易者 — 寻找超买超卖',
    indicators: [
      { id: 'boll', position: 'main', order: 1, params: { period: 20, multiplier: 2 }, color: '#a78bfa', label: 'BOLL(20,2)' },
      { id: 'bbb', position: 'sub', order: 1, params: { period: 20, multiplier: 2 }, label: '%B位置' },
    ],
    layout: 'dual',
    tips: [
      '价格碰到上轨=贵了。碰到下轨=便宜了。但在强趋势中价格可以"骑轨"走很久',
      '%B>1=突破上轨。%B<0=跌破下轨。%B回到0.5=回到中间=安全的入场点',
      '布林带收窄="暴风雨前的宁静" — 变盘在即。收窄后的突破方向最重要',
    ],
    beginnerRating: 4,
  },

  // ── 模板4: KDJ超买超卖 ──
  {
    id: 'kdj-zone',
    name: 'KDJ超买超卖',
    emoji: '🔄',
    tagline: '看价格是不是"涨过头"或"跌过头"了',
    scenario: '短线抄底或逃顶 — KDJ是A股散户最熟悉的工具。',
    forWhom: 'A股/港股用户 — KDJ在国内比RSI更受欢迎',
    indicators: [
      { id: 'kdj', position: 'sub', order: 1, params: { kPeriod: 9, dPeriod: 3, smooth: 3 }, label: 'KDJ(9,3,3)' },
      { id: 'rsi', position: 'sub', order: 2, params: { period: 14 }, label: 'RSI(14)' },
      { id: 'ma', position: 'main', order: 1, params: { period: 20 }, color: '#a78bfa', label: 'MA20' },
    ],
    layout: 'dual',
    tips: [
      'K<20且D<20=超卖区 — "钻石底"。K>80且D>80=超买区 — "逃顶"',
      'KDJ+RSI双超卖=更可靠的买入信号。两个指标都说超卖了再动手',
      '单边大行情中KDJ会钝化 — 永远超买/永远超卖。此时别信KDJ',
    ],
    beginnerRating: 5,
  },

  // ── 模板5: 趋势强度组合 ──
  {
    id: 'trend-power',
    name: '趋势强度组合',
    emoji: '💪',
    tagline: '把"该不该跟趋势"变成YES/NO',
    scenario: '不确定是应该顺势而为还是应该等待 — ADX+Supertrend帮你做决定。',
    forWhom: '进阶用户 — 学会了前4个模板后看这个',
    indicators: [
      { id: 'supertrend', position: 'main', order: 1, params: { period: 10, multiplier: 3 }, color: '#22c55e', label: 'Supertrend(10,3)' },
      { id: 'ma', position: 'main', order: 2, params: { period: 20 }, color: '#a78bfa', label: 'MA20' },
      { id: 'adx', position: 'sub', order: 1, params: { period: 14 }, label: 'ADX(14)' },
    ],
    layout: 'dual',
    tips: [
      'ADX>25+Supertrend绿色=最强上涨信号 — "此时不要跟趋势作对"',
      'ADX<20+Supertrend频繁翻色=震荡市 — "此时任何指标都可能是假的"',
      'Supertrend翻红+ADX>25=下跌趋势 — "别抄底,等ST翻回来再说"',
    ],
    beginnerRating: 3,
  },
];

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getTemplateById(id: string): IndicatorTemplate | undefined {
  return INDICATOR_TEMPLATES.find(t => t.id === id);
}

export function getAllTemplates(): IndicatorTemplate[] {
  return INDICATOR_TEMPLATES;
}

export function getTemplatesByRating(minRating: 1|2|3|4|5): IndicatorTemplate[] {
  return INDICATOR_TEMPLATES.filter(t => t.beginnerRating >= minRating);
}

// ═══════════════════════════════════════
// UI快捷按钮文案映射
// ═══════════════════════════════════════

export interface QuickTemplateButton {
  id: string;
  emoji: string;
  name: string;
  tooltip: string;  // hover提示
  hotkey?: string;
}

export const QUICK_TEMPLATE_BUTTONS: QuickTemplateButton[] = INDICATOR_TEMPLATES.map(t => ({
  id: t.id,
  emoji: t.emoji,
  name: t.name,
  tooltip: `${t.tagline} — ${t.scenario}`,
}));

// "一键全清"按钮 — 特殊逻辑
export const CLEAR_ALL_BUTTON: QuickTemplateButton = {
  id: 'clear-all',
  emoji: '🗑️',
  name: '一键全清',
  tooltip: '清除所有指标 — 回到纯净K线',
  hotkey: 'Shift+Escape',
};

export default INDICATOR_TEMPLATES;
