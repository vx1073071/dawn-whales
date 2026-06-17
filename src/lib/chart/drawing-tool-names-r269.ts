// ══ R269 QClaw Task 1: 68画线工具中文名 (3h) ══
// MIT lightweight-charts-drawing 68种画线工具 → 中文名+使用场景
// 超越TradingView: 一步到位覆盖全量画线工具
// 交付: 画线工具栏完整文案 → 接入DrawingToolbar/DrawingContextMenu

// ═══════════════════════════════════════
// TYPE
// ═══════════════════════════════════════

export interface DrawingToolEntry {
  id: string;
  name: string;          // ≤5字中文名
  emoji: string;
  oneliner: string;      // ≤12字 — 这是干什么的
  group: string;         // 分组名
  hotkey: string;        // 快捷键(如有)
  icon: string;          // 图标名称(前端用)
}

// ═══════════════════════════════════════
// 6大分组
// ═══════════════════════════════════════

export const DRAWING_GROUPS = [
  { id: 'line',     name: '线段',     emoji: '━',   description: '趋势线/水平线/射线等基础画线' },
  { id: 'fib',      name: '斐波那契',  emoji: '🌀',  description: '斐波那契回调/扩展/时间/扇形/弧线' },
  { id: 'shape',    name: '图形',     emoji: '◻',   description: '矩形/椭圆/三角形等几何标注' },
  { id: 'text',     name: '文字',     emoji: 'T',   description: '文字标注/箭头/测量/计数' },
  { id: 'gann',     name: '江恩',     emoji: '🔮',  description: '甘氏/江恩工具——角度线与网格' },
  { id: 'advanced', name: '高级',     emoji: '⚡',  description: '安德鲁叉/回归趋势/艾略特/价格区间' },
];

// ═══════════════════════════════════════
// 线段类 — 14个
// ═══════════════════════════════════════

export const LINE_14: DrawingToolEntry[] = [
  { id: 'trend_line',       name: '趋势线',   emoji: '↗',  oneliner: '两点连线看方向',         group: 'line', hotkey: 'T',  icon: 'trend-line' },
  { id: 'horizontal_line',  name: '水平线',   emoji: '→',  oneliner: '关键整数关口/前高前低',   group: 'line', hotkey: 'H',  icon: 'horizontal-line' },
  { id: 'vertical_line',    name: '竖线',     emoji: '↓',  oneliner: '标记关键时间点/事件日',   group: 'line', hotkey: 'V',  icon: 'vertical-line' },
  { id: 'ray',              name: '射线',     emoji: '↗',  oneliner: '从一点出发的趋势预判',    group: 'line', hotkey: '',   icon: 'ray' },
  { id: 'extended_line',    name: '延长线',   emoji: '↔',  oneliner: '两端无限延伸的趋势线',    group: 'line', hotkey: '',   icon: 'extended-line' },
  { id: 'parallel_channel', name: '平行通道',  emoji: '⫾',  oneliner: '趋势线+平行线=交易通道',  group: 'line', hotkey: '',   icon: 'parallel-channel' },
  { id: 'disjoint_channel', name: '偏移通道',  emoji: '⫿',  oneliner: '通道两端自由调整距离',    group: 'line', hotkey: '',   icon: 'disjoint-channel' },
  { id: 'cross_line',       name: '十字线',   emoji: '✚',  oneliner: '精确看某K线的价格和时间',  group: 'line', hotkey: '',   icon: 'cross-line' },
  { id: 'arrow',            name: '箭头',     emoji: '➤',  oneliner: '标注方向/目标价位',      group: 'line', hotkey: '',   icon: 'arrow' },
  { id: 'info_line',        name: '标记线',   emoji: '🏷',  oneliner: '带文字的价格/日期标记',   group: 'line', hotkey: '',   icon: 'info-line' },
  { id: 'cursor_highlight', name: '光标高亮',  emoji: '🔦',  oneliner: '高亮光标所在K线和价格',   group: 'line', hotkey: '',   icon: 'cursor-highlight' },
  { id: 'long_position',    name: '多头标记',  emoji: '🟢',  oneliner: '标注买入/做多位置',      group: 'line', hotkey: '',   icon: 'long-position' },
  { id: 'short_position',   name: '空头标记',  emoji: '🔴',  oneliner: '标注卖出/做空位置',      group: 'line', hotkey: '',   icon: 'short-position' },
  { id: 'angle_line',       name: '角度线',   emoji: '📐',  oneliner: '测量价格斜率/趋势速度',   group: 'line', hotkey: '',   icon: 'angle-line' },
];

// ═══════════════════════════════════════
// 斐波那契类 — 12个
// ═══════════════════════════════════════

export const FIB_12: DrawingToolEntry[] = [
  { id: 'fib_retracement',  name: '斐波回调',  emoji: '🌀',  oneliner: '0.382/0.5/0.618回调位', group: 'fib', hotkey: '', icon: 'fib-retracement' },
  { id: 'fib_extension',    name: '斐波扩展',  emoji: '🚀',  oneliner: '1.272/1.618止盈目标位',  group: 'fib', hotkey: '', icon: 'fib-extension' },
  { id: 'fib_fan',          name: '斐波扇形',  emoji: '📐',  oneliner: '多条射线——动态支撑阻力',  group: 'fib', hotkey: '', icon: 'fib-fan' },
  { id: 'fib_arc',          name: '斐波弧线',  emoji: '🌙',  oneliner: '弧形支撑——像半圆顶',      group: 'fib', hotkey: '', icon: 'fib-arc' },
  { id: 'fib_spiral',       name: '斐波螺旋',  emoji: '🐚',  oneliner: '时间×价格——预测拐点区域', group: 'fib', hotkey: '', icon: 'fib-spiral' },
  { id: 'fib_timezone',     name: '斐波时间',  emoji: '⏰',  oneliner: '竖线标记关键时间反转点',   group: 'fib', hotkey: '', icon: 'fib-timezone' },
  { id: 'fib_circles',      name: '斐波圆环',  emoji: '⭕',  oneliner: '同心圆——价格+时间的共振区', group: 'fib', hotkey: '', icon: 'fib-circles' },
  { id: 'fib_speed_resistance_fan', name: '速度阻力扇', emoji: '⚡', oneliner: '速度线——趋势的支撑/压力角度', group: 'fib', hotkey: '', icon: 'fib-speed-fan' },
  { id: 'fib_speed_resistance_arc', name: '速度阻力弧', emoji: '🌙', oneliner: '弧形速度线——趋势衰减的预估', group: 'fib', hotkey: '', icon: 'fib-speed-arc' },
  { id: 'fib_wolfe',        name: '沃尔夫波',  emoji: '🐺',  oneliner: '五浪结构——精确目标位预测', group: 'fib', hotkey: '', icon: 'fib-wolfe' },
  { id: 'fib_channel',      name: '斐波通道',  emoji: '〰',  oneliner: '平行通道×斐波那契百分比',  group: 'fib', hotkey: '', icon: 'fib-channel' },
  { id: 'fib_projection',   name: '斐波投影',  emoji: '📏',  oneliner: '三段测量——第三波目标位',   group: 'fib', hotkey: '', icon: 'fib-projection' },
];

// ═══════════════════════════════════════
// 图形类 — 13个
// ═══════════════════════════════════════

export const SHAPE_13: DrawingToolEntry[] = [
  { id: 'rectangle',        name: '矩形',     emoji: '▬',  oneliner: '框出交易区间/整理形态',    group: 'shape', hotkey: '', icon: 'rectangle' },
  { id: 'rotated_rectangle',name: '旋转矩形',  emoji: '▭',  oneliner: '斜着的区间——趋势中更准',   group: 'shape', hotkey: '', icon: 'rotated-rectangle' },
  { id: 'ellipse',          name: '椭圆',     emoji: '⬭',  oneliner: '标注震荡范围/周期性波动',   group: 'shape', hotkey: '', icon: 'ellipse' },
  { id: 'triangle',         name: '三角形',   emoji: '▲',  oneliner: '三角整理——收敛/对称/扩散',  group: 'shape', hotkey: '', icon: 'triangle' },
  { id: 'polygon',          name: '多边形',   emoji: '⬡',  oneliner: '自由标注任意形状区域',      group: 'shape', hotkey: '', icon: 'polygon' },
  { id: 'curve',            name: '曲线',     emoji: '⌇',  oneliner: '贝塞尔曲线——自由画线',     group: 'shape', hotkey: '', icon: 'curve' },
  { id: 'parallelogram',    name: '平行四边形', emoji: '▱',  oneliner: '平行通道的变体——倾斜底边', group: 'shape', hotkey: '', icon: 'parallelogram' },
  { id: 'flag',             name: '旗形',     emoji: '🚩',  oneliner: '上涨/下跌旗——中继形态',    group: 'shape', hotkey: '', icon: 'flag' },
  { id: 'pennant',          name: '三角旗',   emoji: '🏴',  oneliner: '楔形——趋势中的短暂休整',   group: 'shape', hotkey: '', icon: 'pennant' },
  { id: 'wedge',            name: '楔形',     emoji: '🔻',  oneliner: '上升楔/下降楔——即将反转',   group: 'shape', hotkey: '', icon: 'wedge' },
  { id: 'arc',              name: '弧线',     emoji: '⌒',  oneliner: '圆弧——自由弧线标注',      group: 'shape', hotkey: '', icon: 'arc' },
  { id: 'semicircle',       name: '半圆',     emoji: '◐',  oneliner: '圆弧底/圆弧顶形态标注',    group: 'shape', hotkey: '', icon: 'semicircle' },
  { id: 'round_shape',      name: '圆形',     emoji: '⭕',  oneliner: '标注圆形整理/底/顶区域',    group: 'shape', hotkey: '', icon: 'round-shape' },
];

// ═══════════════════════════════════════
// 文字/标注类 — 11个
// ═══════════════════════════════════════

export const TEXT_11: DrawingToolEntry[] = [
  { id: 'text',             name: '文字标注',  emoji: 'T',   oneliner: '在K线上写任意文字',       group: 'text', hotkey: '', icon: 'text' },
  { id: 'callout',          name: '气泡标注',  emoji: '💬',  oneliner: '带箭头的文字说明气泡',     group: 'text', hotkey: '', icon: 'callout' },
  { id: 'note',             name: '便签',     emoji: '📝',  oneliner: '黄色便签——备忘/交易理由',  group: 'text', hotkey: '', icon: 'note' },
  { id: 'sticky_note',     name: '贴纸',      emoji: '📌',  oneliner: '大头针标记——快速定位',     group: 'text', hotkey: '', icon: 'sticky-note' },
  { id: 'price_label',      name: '价格标签',  emoji: '💰',  oneliner: '自动显示十字线处的价格',   group: 'text', hotkey: '', icon: 'price-label' },
  { id: 'date_label',       name: '日期标签',  emoji: '📅',  oneliner: '自动显示十字线处的日期',   group: 'text', hotkey: '', icon: 'date-label' },
  { id: 'price_range',      name: '价格区间',  emoji: '↕',   oneliner: '从A点到B点画价格差',      group: 'text', hotkey: '', icon: 'price-range' },
  { id: 'date_range',       name: '日期区间',  emoji: '↔',   oneliner: '从A天到B天的时间跨度',    group: 'text', hotkey: '', icon: 'date-range' },
  { id: 'measure',          name: '测量',     emoji: '📐',  oneliner: '两点价格差+涨跌幅+K线数',   group: 'text', hotkey: '', icon: 'measure' },
  { id: 'bracket',          name: '括号标注',  emoji: '⟦',  oneliner: '大括号标注一段走势',       group: 'text', hotkey: '', icon: 'bracket' },
  { id: 'counter',          name: '涨跌计数',  emoji: '🔢',  oneliner: '自动数连续涨跌的K线数',    group: 'text', hotkey: '', icon: 'counter' },
];

// ═══════════════════════════════════════
// 江恩类 — 8个
// ═══════════════════════════════════════

export const GANN_8: DrawingToolEntry[] = [
  { id: 'gann_fan',         name: '甘氏扇形',  emoji: '📐',  oneliner: '45°/1×1线——最核心的角度', group: 'gann', hotkey: '', icon: 'gann-fan' },
  { id: 'gann_square',      name: '甘氏矩阵',  emoji: '🔲',  oneliner: '时间价格方阵——找共振点',   group: 'gann', hotkey: '', icon: 'gann-square' },
  { id: 'gann_box',         name: '甘氏箱体',  emoji: '📦',  oneliner: '固定角度框——突破边界信号',  group: 'gann', hotkey: '', icon: 'gann-box' },
  { id: 'gann_grid',        name: '甘氏网格',  emoji: '📏',  oneliner: '时间×价格二维网格——找支撑', group: 'gann', hotkey: '', icon: 'gann-grid' },
  { id: 'gann_square_fixed',name: '固定矩阵',   emoji: '🔳',  oneliner: '固定尺寸甘氏矩阵——精确预测', group: 'gann', hotkey: '', icon: 'gann-square-fixed' },
  { id: 'gann_line',        name: '甘氏线',    emoji: '━',   oneliner: '角度趋势线——斜率有数学含义', group: 'gann', hotkey: '', icon: 'gann-line' },
  { id: 'time_cycle',       name: '时间周期',  emoji: '🔄',  oneliner: '标注等间隔时间周期——找节奏', group: 'gann', hotkey: '', icon: 'time-cycle' },
  { id: 'gann_circle',      name: '甘氏圆',    emoji: '⭕',  oneliner: '圆的切点=时间价格共振位',    group: 'gann', hotkey: '', icon: 'gann-circle' },
];

// ═══════════════════════════════════════
// 高级类 — 10个
// ═══════════════════════════════════════

export const ADVANCED_10: DrawingToolEntry[] = [
  { id: 'pitchfork',        name: '安德鲁叉',  emoji: '🍴',  oneliner: '三点画叉——最准的中线策略',   group: 'advanced', hotkey: '', icon: 'pitchfork' },
  { id: 'schiff_pitchfork', name: '希夫叉',    emoji: '🔱',  oneliner: '修正版安德鲁叉——起点偏移',  group: 'advanced', hotkey: '', icon: 'schiff-pitchfork' },
  { id: 'modified_schiff',  name: '修正希夫叉', emoji: '🔰',  oneliner: '终极版——比原版更早捕捉拐点', group: 'advanced', hotkey: '', icon: 'modified-schiff' },
  { id: 'regression_trend', name: '回归趋势',  emoji: '📊',  oneliner: '最小二乘法拟合——最客观的趋势线', group: 'advanced', hotkey: '', icon: 'regression-trend' },
  { id: 'regression_channel',name: '回归通道', emoji: '📈',  oneliner: '统计通道——价格偏离均值的范围', group: 'advanced', hotkey: '', icon: 'regression-channel' },
  { id: 'elliott_wave_5',  name: '艾略特5波',  emoji: '🌊',  oneliner: '1-2-3-4-5推动波标注',      group: 'advanced', hotkey: '', icon: 'elliott-wave-5' },
  { id: 'elliott_wave_3',  name: '艾略特3波',  emoji: '🌊',  oneliner: 'A-B-C调整波标注',          group: 'advanced', hotkey: '', icon: 'elliott-wave-3' },
  { id: 'head_and_shoulders',name: '头肩底',  emoji: '👤',  oneliner: '左肩-头-右肩——最强反转信号',  group: 'advanced', hotkey: '', icon: 'head-and-shoulders' },
  { id: 'abcd_pattern',     name: 'ABCD形态',  emoji: '🔄',  oneliner: '谐波交易——AB=CD对称',      group: 'advanced', hotkey: '', icon: 'abcd' },
  { id: 'cypher_pattern',   name: '赛弗形态',  emoji: '🔷',  oneliner: '高级谐波——精准拐点预测',    group: 'advanced', hotkey: '', icon: 'cypher' },
];

// ═══════════════════════════════════════
// 合计68个
// ═══════════════════════════════════════

export const ALL_68_DRAWING_TOOLS: DrawingToolEntry[] = [
  ...LINE_14,
  ...FIB_12,
  ...SHAPE_13,
  ...TEXT_11,
  ...GANN_8,
  ...ADVANCED_10,
];

// ═══════════════════════════════════════
// 工具栏快捷入口 — 默认展示12个常用
// ═══════════════════════════════════════

export const DEFAULT_TOOLBAR: string[] = [
  'trend_line', 'horizontal_line', 'vertical_line',    // 线段三件套
  'fib_retracement', 'fib_extension',                    // 斐波那契两件
  'rectangle', 'triangle',                               // 图形两件
  'text', 'callout',                                     // 文字两件
  'pitchfork', 'regression_trend',                       // 高级两件
  'measure',                                             // 测量
];

// ═══════════════════════════════════════
// 画线时的浮动提示 (正在画线中的帮助)
// ═══════════════════════════════════════

export const DRAWING_TOOLTIPS = {
  drawing: {
    clickStart: '点击图表放置起点',
    clickEnd: '再次点击放置终点',
    holdShift: '按住Shift: 吸附到水平/垂直',
    holdCtrl: '按住Ctrl: 吸附到OHLC价格',
    escape: 'ESC取消画线',
    doubleClick: '双击完成画线',
    rightClick: '右键→转成策略',
  },
  edit: {
    dragHandle: '拖拽控制点调整位置',
    dragLine: '拖拽线条平移',
    doubleClick: '双击修改颜色/样式',
    rightClickMenu: '右键: 复制/删除/锁定/转策略',
    delete: '选中后按Delete删除',
  },
  lock: {
    locked: '🔒 已锁定 — 点击解锁后再编辑',
    unlock: '🔓 已解锁 — 可以编辑',
  },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getDrawingById(id: string): DrawingToolEntry | undefined {
  return ALL_68_DRAWING_TOOLS.find(t => t.id === id);
}

export function getDrawingsByGroup(group: string): DrawingToolEntry[] {
  return ALL_68_DRAWING_TOOLS.filter(t => t.group === group);
}

export function getDrawingsByHotkey(): Record<string, DrawingToolEntry> {
  const map: Record<string, DrawingToolEntry> = {};
  for (const t of ALL_68_DRAWING_TOOLS) {
    if (t.hotkey) map[t.hotkey] = t;
  }
  return map;
}

export default ALL_68_DRAWING_TOOLS;
