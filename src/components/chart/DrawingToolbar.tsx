// ── R113 Drawing Toolbar — TradingView 画线工具 (P0 20种) ─────────────────
// PM: 模块3 DrawingTools P0, 对标 TradingView 68种 → 先做20种核心
// 特性: 5大类 + 颜色/线宽/样式设置 + 激活状态管理

import { useState, useCallback } from 'react';

// ═══════════ Types ═══════════

export type DrawingCategory = 'line' | 'channel' | 'fib' | 'shape' | 'text';

export interface DrawingToolDef {
  id: string;
  label: string;
  shortLabel: string;
  icon: string; // SVG path or emoji
  category: DrawingCategory;
  description: string;
  cursor?: string; // CSS cursor for canvas
}

// ═══════════ 20 Core Drawing Tools ═══════════

export const DRAWING_TOOLS: DrawingToolDef[] = [
  // ── Lines ──
  { id: 'trend-line', label: '趋势线', shortLabel: 'TL', icon: '╱', category: 'line', description: 'Trend Line', cursor: 'crosshair' },
  { id: 'horizontal-line', label: '水平线', shortLabel: 'HL', icon: '━', category: 'line', description: 'Horizontal Line', cursor: 'crosshair' },
  { id: 'vertical-line', label: '垂直线', shortLabel: 'VL', icon: '┃', category: 'line', description: 'Vertical Line', cursor: 'crosshair' },
  { id: 'ray', label: '射线', shortLabel: 'Ray', icon: '↗', category: 'line', description: 'Ray (infinite direction)', cursor: 'crosshair' },
  { id: 'extended-line', label: '延长线', shortLabel: 'EL', icon: '↔', category: 'line', description: 'Extended Line', cursor: 'crosshair' },

  // ── Channels ──
  { id: 'parallel-channel', label: '平行通道', shortLabel: 'PC', icon: '∥', category: 'channel', description: 'Parallel Channel', cursor: 'crosshair' },
  { id: 'regression-trend', label: '回归趋势', shortLabel: 'LR', icon: '📈', category: 'channel', description: 'Linear Regression Channel', cursor: 'crosshair' },
  { id: 'pitchfork', label: '安德鲁鱼叉', shortLabel: 'AP', icon: 'Ψ', category: 'channel', description: "Andrew's Pitchfork", cursor: 'crosshair' },

  // ── Fibonacci ──
  { id: 'fib-retracement', label: '斐波那契回调', shortLabel: 'Fib', icon: 'φ', category: 'fib', description: 'Fibonacci Retracement 0/0.236/0.382/0.5/0.618/0.786/1', cursor: 'crosshair' },
  { id: 'fib-extension', label: '斐波那契扩展', shortLabel: 'FExt', icon: 'Φ', category: 'fib', description: 'Fibonacci Extension', cursor: 'crosshair' },
  { id: 'fib-speed-resistance', label: '斐波速度阻力', shortLabel: 'FSR', icon: '🌊', category: 'fib', description: 'Speed Resistance Fan', cursor: 'crosshair' },

  // ── Shapes ──
  { id: 'rectangle', label: '矩形', shortLabel: 'Rect', icon: '▭', category: 'shape', description: 'Rectangle (support/resistance zone)', cursor: 'crosshair' },
  { id: 'price-range', label: '价格区间', shortLabel: 'PR', icon: '↕', category: 'shape', description: 'Price Range', cursor: 'crosshair' },
  { id: 'date-range', label: '日期区间', shortLabel: 'DR', icon: '↔', category: 'shape', description: 'Date Range', cursor: 'crosshair' },
  { id: 'triangle', label: '三角形', shortLabel: '△', icon: '△', category: 'shape', description: 'Triangle pattern marking', cursor: 'crosshair' },

  // ── Text/Annotation ──
  { id: 'text', label: '文字标注', shortLabel: 'T', icon: 'T', category: 'text', description: 'Text Annotation', cursor: 'text' },
  { id: 'label-callout', label: '标注气泡', shortLabel: '💬', icon: '💬', category: 'text', description: 'Callout bubble', cursor: 'crosshair' },
  { id: 'arrow-marker', label: '箭头', shortLabel: '→', icon: '→', category: 'text', description: 'Arrow marker', cursor: 'crosshair' },
  { id: 'price-label', label: '价格标签', shortLabel: '🏷', icon: '🏷', category: 'text', description: 'Price label at Y-axis', cursor: 'crosshair' },
  { id: 'note', label: '笔记', shortLabel: 'N', icon: '📝', category: 'text', description: 'Freehand note marker', cursor: 'crosshair' },
];

// ═══════════ Category config ═══════════

export const DRAWING_CATEGORY_LABELS: Record<DrawingCategory, string> = {
  line: '线段', channel: '通道', fib: '斐波那契', shape: '形状', text: '标注',
};

export const DRAWING_CATEGORY_COLORS: Record<DrawingCategory, string> = {
  line: '#60a5fa', channel: '#34d399', fib: '#f472b6', shape: '#fbbf24', text: '#a78bfa',
};

// ═══════════ Color palette + line styles ═══════════

export const DRAWING_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#94a3b8', '#f8fafc', '#c9a96e',
];

export const LINE_STYLES: { id: string; label: string; dash: number[] }[] = [
  { id: 'solid', label: '实线', dash: [] },
  { id: 'dotted', label: '点线', dash: [1, 3] },
  { id: 'dashed', label: '虚线', dash: [4, 4] },
  { id: 'dashdot', label: '点划线', dash: [6, 2, 1, 2] },
];

// ═══════════ Props ═══════════

export interface DrawingToolbarProps {
  activeTool: string | null;
  onSelectTool: (toolId: string | null) => void;
  selectedColor: string;
  onColorChange: (color: string) => void;
  lineWidth: number;
  onLineWidthChange: (w: number) => void;
  lineStyle: number[];
  onLineStyleChange: (dash: number[]) => void;
  className?: string;
}

// ═══════════ Component ═══════════

export default function DrawingToolbar({
  activeTool, onSelectTool, selectedColor, onColorChange,
  lineWidth, onLineWidthChange, lineStyle, onLineStyleChange,
  className = '',
}: DrawingToolbarProps) {
  const [expandedCat, setExpandedCat] = useState<DrawingCategory | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  const grouped = useCallback(() => {
    const map: Record<DrawingCategory, DrawingToolDef[]> = { line: [], channel: [], fib: [], shape: [], text: [] };
    for (const tool of DRAWING_TOOLS) map[tool.category].push(tool);
    return map;
  }, []);

  const categories = (Object.entries(grouped()) as [DrawingCategory, DrawingToolDef[]][]);

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-2 text-xs ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[#8b949e] font-semibold text-[10px] tracking-wide">画线 Drawing</span>
        <span className="text-[#484f58] text-[9px]">
          {activeTool ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Category + Tool grid */}
      <div className="flex flex-col gap-0.5 max-h-[350px] overflow-y-auto">
        {categories.map(([cat, tools]) => (
          <div key={cat}>
            {/* Category header */}
            <button
              onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
              className="w-full flex items-center gap-1.5 px-1 py-0.5 hover:bg-[#161b22] rounded transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DRAWING_CATEGORY_COLORS[cat] }} />
              <span className="text-[#8b949e] font-semibold text-[10px] flex-1 text-left">{DRAWING_CATEGORY_LABELS[cat]}</span>
              <span className="text-[#484f58] text-[9px]">{tools.length}</span>
              <span className={`text-[#484f58] text-[9px] transition-transform ${expandedCat === cat ? 'rotate-90' : ''}`}>▶</span>
            </button>

            {/* Tool buttons (expanded) */}
            {expandedCat === cat && (
              <div className="ml-4 grid grid-cols-2 gap-0.5 mt-0.5">
                {tools.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => onSelectTool(activeTool === tool.id ? null : tool.id)}
                    className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors text-left ${
                      activeTool === tool.id
                        ? 'bg-[#c9a96e20] text-[#c9a96e] border border-[#c9a96e40]'
                        : 'text-[#8b949e] hover:bg-[#161b22] hover:text-[#c9d1d9] border border-transparent'
                    }`}
                    title={tool.description}
                  >
                    <span className="w-4 text-center">{tool.icon}</span>
                    <span className="truncate">{tool.shortLabel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-[#1c2333] my-2" />

      {/* Color picker */}
      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-full flex items-center gap-1.5 px-1 py-0.5 hover:bg-[#161b22] rounded text-[10px] text-[#8b949e] transition-colors"
        >
          <span>🎨 颜色</span>
          <span className="w-3 h-3 rounded-full ml-auto" style={{ backgroundColor: selectedColor }} />
        </button>
        {showColorPicker && (
          <div className="ml-2 mt-1 flex flex-wrap gap-1 p-1 bg-[#161b22] rounded border border-[#1c2333]">
            {DRAWING_COLORS.map(c => (
              <button
                key={c}
                onClick={() => { onColorChange(c); setShowColorPicker(false); }}
                className={`w-5 h-5 rounded-full border-2 transition-all ${c === selectedColor ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Line width */}
      <div className="flex items-center gap-2 px-1 py-0.5 text-[10px] text-[#8b949e]">
        <span>━ 线宽</span>
        <input
          type="range"
          min={1} max={5} step={1}
          value={lineWidth}
          onChange={e => onLineWidthChange(parseInt(e.target.value))}
          className="flex-1 h-1 accent-[#c9a96e]"
        />
        <span className="text-[#484f58] w-3 text-right">{lineWidth}</span>
      </div>

      {/* Line style */}
      <div className="relative">
        <button
          onClick={() => setShowStyleMenu(!showStyleMenu)}
          className="w-full flex items-center gap-1.5 px-1 py-0.5 hover:bg-[#161b22] rounded text-[10px] text-[#8b949e] transition-colors"
        >
          <span>┅ 线型</span>
          <span className="text-[#484f58] ml-auto">
            {LINE_STYLES.find(s => String(s.dash) === String(lineStyle))?.label || '实线'}
          </span>
        </button>
        {showStyleMenu && (
          <div className="absolute left-0 right-0 top-full mt-0.5 z-20 bg-[#161b22] rounded border border-[#1c2333] p-1 flex flex-col gap-0.5">
            {LINE_STYLES.map(style => (
              <button
                key={style.id}
                onClick={() => { onLineStyleChange(style.dash); setShowStyleMenu(false); }}
                className={`px-2 py-0.5 text-[10px] text-left rounded transition-colors ${String(lineStyle) === String(style.dash) ? 'bg-[#c9a96e20] text-[#c9a96e]' : 'text-[#8b949e] hover:bg-[#0d1117]'}`}
              >
                <svg width="40" height="12" className="inline-block mr-1">
                  <line x1="2" y1="6" x2="38" y2="6" stroke="#8b949e" strokeWidth="1.5" strokeDasharray={style.dash.join(',')} />
                </svg>
                {style.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clear / undo button */}
      <div className="border-t border-[#1c2333] mt-2 pt-1 flex gap-1">
        <button
          onClick={() => onSelectTool(null)}
          className="flex-1 px-2 py-1 text-[9px] text-[#ef4444] hover:bg-[#ef444410] rounded transition-colors"
        >
          ✕ 取消
        </button>
      </div>
    </div>
  );
}
