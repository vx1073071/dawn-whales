// ══ R265 QClaw Task 3: 图表快捷键引导文案 (1h) ══
// P0-07: 键盘快捷键系统 — 每个快捷键含人话说明+引导文案+首次弹窗
// 交付: 快捷键定义+分类+首次使用引导弹窗文案

// ═══════════════════════════════════════
// TYPE: 快捷键定义
// ═══════════════════════════════════════

export interface ChartHotkey {
  key: string;            // 实际按键组合 (如 'Ctrl+Z')
  category: 'nav' | 'draw' | 'mode' | 'template' | 'utility' | 'timeframe';
  name: string;           // 功能名 (≤6字)
  description: string;    // 人话说明 (≤15字)
  priority: 1|2|3;        // 1=招牌(弹窗必显示), 2=常用, 3=高级
}

export interface HotkeyCategory {
  id: string;
  name: string;
  emoji: string;
  tip: string;            // 引导语
}

// ═══════════════════════════════════════
// 快捷键分类
// ═══════════════════════════════════════

export const HOTKEY_CATEGORIES: Record<string, HotkeyCategory> = {
  nav:       { id: 'nav',       name: '浏览',   emoji: '🧭', tip: '用键盘代替鼠标 — 更快' },
  draw:      { id: 'draw',      name: '画线',   emoji: '✏️', tip: '一键画线 — 不用找工具栏' },
  mode:      { id: 'mode',      name: '模式',   emoji: '🔀', tip: '切换图表状态' },
  template:  { id: 'template',  name: '模板',   emoji: '📋', tip: '数字键加载模板' },
  utility:   { id: 'utility',   name: '工具',   emoji: '🔧', tip: '实用功能' },
  timeframe: { id: 'timeframe', name: '周期',   emoji: '⏱️', tip: '秒切时间周期' },
};

// ═══════════════════════════════════════
// 全部快捷键
// ═══════════════════════════════════════

export const CHART_HOTKEYS: ChartHotkey[] = [

  // ── 导航 (nav) ──
  { key: '← →',      category: 'nav', name: '左右移动',  description: '左右平移K线图', priority: 1 },
  { key: '↑ ↓',      category: 'nav', name: '上下移动',  description: '垂直滚动——看更多价格', priority: 2 },
  { key: '滚轮',      category: 'nav', name: '垂直缩放',  description: '滚动查看价格精细变化', priority: 1 },
  { key: 'Ctrl+滚轮', category: 'nav', name: '水平缩放',  description: '看更长或更短的时间段', priority: 1 },
  { key: 'Home',     category: 'nav', name: '跳到最新',  description: '回到最新的K线——"现在"', priority: 2 },
  { key: 'End',      category: 'nav', name: '跳到最早',  description: '跳到历史最远端', priority: 3 },

  // ── 画线 (draw) — 不启动工具栏直接画 ──
  { key: 'D',         category: 'draw', name: '画线模式',  description: '打开/关闭画线工具栏', priority: 1 },
  { key: 'T',         category: 'draw', name: '趋势线',    description: '直接开始画趋势线', priority: 1 },
  { key: 'H',         category: 'draw', name: '水平线',    description: '画水平支撑/阻力线', priority: 1 },
  { key: 'V',         category: 'draw', name: '竖直线',    description: '标记关键时间点', priority: 2 },
  { key: 'R',         category: 'draw', name: '矩形框',    description: '画矩形区域', priority: 2 },
  { key: 'F',         category: 'draw', name: '斐波那契',  description: '画斐波那契回调线', priority: 2 },
  { key: 'Escape',    category: 'draw', name: '取消画线',  description: '放弃当前正在画的线', priority: 1 },
  { key: 'Delete',    category: 'draw', name: '删除画线',  description: '删除选中的画线', priority: 1 },
  { key: 'Tab',       category: 'draw', name: '切换画线',  description: '选中下一根画线', priority: 3 },
  { key: 'Ctrl+C',    category: 'draw', name: '复制画线',  description: '复制选中画线到剪贴板', priority: 3 },

  // ── 模式 (mode) ──
  { key: 'C',         category: 'mode', name: '十字光标',  description: '开/关十字光标精确读数', priority: 1 },
  { key: 'Space',     category: 'mode', name: '锁定光标',  description: '按住临时锁定十字光标', priority: 2 },
  { key: 'G',         category: 'mode', name: '切换网格',  description: '显示/隐藏网格线', priority: 3 },
  { key: 'L',         category: 'mode', name: '对数坐标',  description: '普通坐标⇔对数坐标切换', priority: 3 },
  { key: 'A',         category: 'mode', name: '自动画线',  description: 'AI自动画趋势线+支撑压力', priority: 1 },
  { key: 'P',         category: 'mode', name: '形态识别',  description: 'AI识别图表形态并标注', priority: 2 },

  // ── 模板 (template) — 数字键 ──
  { key: '1',         category: 'template', name: '均线看趋势',  description: '加载MA5+10+20+60四条均线', priority: 1 },
  { key: '2',         category: 'template', name: 'MACD金叉',    description: '加载MACD(12,26,9)+MA20', priority: 1 },
  { key: '3',         category: 'template', name: '布林带突破',  description: '加载布林带(20,2)+%B', priority: 1 },
  { key: '4',         category: 'template', name: 'KDJ超买超卖', description: '加载KDJ(9,3,3)+RSI(14)', priority: 2 },
  { key: '5',         category: 'template', name: '趋势强度',    description: '加载Supertrend+ADX', priority: 2 },
  { key: 'Shift+Esc', category: 'template', name: '一键全清',    description: '清除所有指标和画线', priority: 1 },

  // ── 工具 (utility) ──
  { key: 'Ctrl+Z',    category: 'utility', name: '撤销',     description: '撤销上一步画线/操作', priority: 1 },
  { key: 'Ctrl+Y',    category: 'utility', name: '重做',     description: '重做被撤销的操作', priority: 2 },
  { key: 'S',         category: 'utility', name: '截图',     description: '截取当前图表区域', priority: 2 },
  { key: 'B',         category: 'utility', name: '买卖面板', description: '打开/关闭快捷下单面板', priority: 2 },
  { key: 'I',         category: 'utility', name: '指标面板', description: '打开/关闭指标选择面板', priority: 2 },
  { key: '?',         category: 'utility', name: '快捷键表', description: '显示所有快捷键列表', priority: 1 },

  // ── 周期 (timeframe) ──
  { key: '0',     category: 'timeframe', name: '1分钟',   description: '切换到1分钟K线', priority: 3 },
  { key: 'Alt+1', category: 'timeframe', name: '5分钟',   description: '切换到5分钟K线', priority: 2 },
  { key: 'Alt+2', category: 'timeframe', name: '15分钟',  description: '切换到15分钟K线', priority: 2 },
  { key: 'Alt+3', category: 'timeframe', name: '30分钟',  description: '切换到30分钟K线', priority: 2 },
  { key: 'Alt+4', category: 'timeframe', name: '1小时',   description: '切换到1小时K线', priority: 2 },
  { key: 'Alt+5', category: 'timeframe', name: '4小时',   description: '切换到4小时K线', priority: 2 },
  { key: 'Alt+D', category: 'timeframe', name: '日线',    description: '切换到日线 — 最常用', priority: 1 },
  { key: 'Alt+W', category: 'timeframe', name: '周线',    description: '切换到周线 — 看大趋势', priority: 2 },
  { key: 'Alt+M', category: 'timeframe', name: '月线',    description: '切换到月线 — 看历史', priority: 3 },
];

// ═══════════════════════════════════════
// 首次使用引导弹窗文案
// ═══════════════════════════════════════

export interface OnboardingDialog {
  title: string;
  subtitle: string;         // 副标题
  greeting: string;         // 欢迎语
  essentials: {             // "先记住这5个" — 第一批
    key: string;
    action: string;
  }[];
  tip: string;              // 小提示
  showAgainLabel: string;   // "不再显示"按钮
  confirmLabel: string;     // "知道了"按钮
}

export const HOTKEY_ONBOARDING: OnboardingDialog = {
  title: '⌨️ 图表快捷键 — 让键盘帮你画线',
  subtitle: '你用了快捷键以后 —— 就不会再用鼠标了',
  greeting: 'Welcome to the fast lane。这6个键是你最先要记住的：',

  essentials: [
    { key: 'T',       action: '直接画趋势线——不用打开工具栏' },
    { key: 'D',       action: '打开完整画线工具箱——20种工具' },
    { key: 'C',       action: '十字光标——精确看到每根K线的开高低收' },
    { key: 'A',       action: 'AI自动画线——一键画出支撑/阻力/趋势' },
    { key: '1 2 3',   action: '数字键加载模板——"均线"/"MACD"/"布林带"' },
    { key: 'Alt+D',   action: '回到日线——最常用的周期' },
  ],

  tip: '按 ? 随时查看全部快捷键。Esc 退出任何模式。Delete 删除选中的画线。',

  showAgainLabel: '不再自动弹出（按?仍可查看）',
  confirmLabel: '知道了，开始用',
};

// ═══════════════════════════════════════
// 快捷键参考面板 (按?弹出)
// ═══════════════════════════════════════

export interface HotkeyPanelSection {
  category: string;
  emoji: string;
  tip: string;
  items: { key: string; action: string }[];
}

export function buildHotkeyPanel(): HotkeyPanelSection[] {
  const sections: HotkeyPanelSection[] = [];

  const order = ['nav', 'draw', 'mode', 'template', 'timeframe', 'utility'];
  for (const catId of order) {
    const cat = HOTKEY_CATEGORIES[catId];
    const items = CHART_HOTKEYS
      .filter(h => h.category === catId)
      .sort((a, b) => a.priority - b.priority)
      .map(h => ({ key: h.key, action: h.description }));
    sections.push({ category: cat.name, emoji: cat.emoji, tip: cat.tip, items });
  }

  return sections;
}

// ═══════════════════════════════════════
// 画线过程引导文案 (画线中出现的提示)
// ═══════════════════════════════════════

export const DRAWING_GUIDANCE = {
  // 开始画趋势线时
  trendLineStart:  '点击第一个点 → 再点击第二个点 → Trend line 完成',
  trendLineExtend: '右键选择"延长线"可投影到未来',
  trendLineAlert:  '右键选择"到价提醒" — 价格到了这根线时通知你',

  // 开始画水平线时
  horizontalLineStart: '点击一个价格 → 水平线锁定',
  horizontalLineAlert: '这就是你的"止盈价"或"止损价"',

  // 开始画fibonacci时
  fibStart:  '先点起点(低点) → 再点终点(高点)',
  fibLevels: '0.382 / 0.5 / 0.618 是最重要的三个回调位置',

  // 开始AI画线时
  aiDrawing: 'AI正在分析K线… 请稍候',
  aiDone:    'AI画好了 {n} 条线。Esc 取消 / Enter 采纳全部 / 点击单个编辑',

  // 删除确认
  deleteConfirm: '确认删除选中的画线？Ctrl+Z 可撤销。',

  // 快捷键提示(画线时出现的小浮动气泡)
  quickTip: '💡 按 T=趋势线 H=水平线 R=矩形 F=斐波那契 Esc=取消',
};

// ═══════════════════════════════════════
// 导出
// ═══════════════════════════════════════

export default CHART_HOTKEYS;
