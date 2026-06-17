// ── R271 ML#6 Drawing Toolbar — TradingView 画线工具 (68种完整版) ─────────
// 升级: 20→68 tools, collapsible groups, search, recent tools, SVG icons
// 特性: 6大类 + 颜色/线宽/样式设置 + 激活状态管理 + 最近使用

import { useState, useCallback } from 'react';

// ═══════════ Types ═══════════

export type DrawingCategory = 'line' | 'channel' | 'fib' | 'shape' | 'text' | 'pattern';

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
  // ── Lines (10) ──
  { id: 'trend-line', label: '趋势线', shortLabel: 'TL', icon: '╱', category: 'line', description: 'Trend Line', cursor: 'crosshair' },
  { id: 'horizontal-line', label: '水平线', shortLabel: 'HL', icon: '━', category: 'line', description: 'Horizontal Line', cursor: 'crosshair' },
  { id: 'vertical-line', label: '垂直线', shortLabel: 'VL', icon: '┃', category: 'line', description: 'Vertical Line', cursor: 'crosshair' },
  { id: 'ray', label: '射线', shortLabel: 'Ray', icon: '↗', category: 'line', description: 'Ray (infinite)', cursor: 'crosshair' },
  { id: 'extended-line', label: '延长线', shortLabel: 'EL', icon: '↔', category: 'line', description: 'Extended Line', cursor: 'crosshair' },
  { id: 'cross-line', label: '十字线', shortLabel: '+', icon: '+', category: 'line', description: 'Cross Line', cursor: 'crosshair' },
  { id: 'arrow', label: '箭头线', shortLabel: '→', icon: '→', category: 'line', description: 'Arrow Line', cursor: 'crosshair' },
  { id: 'angle-line', label: '角度线', shortLabel: '∠', icon: '∠', category: 'line', description: 'Info Line', cursor: 'crosshair' },
  { id: 'info-line', label: '信息线', shortLabel: 'Inf', icon: 'i', category: 'line', description: 'Information Line', cursor: 'crosshair' },
  { id: 'cursor-line', label: '光标线', shortLabel: 'Cur', icon: '┼', category: 'line', description: 'Crosshair cursor line', cursor: 'crosshair' },

  // ── Channels (12) ──
  { id: 'parallel-channel', label: '平行通道', shortLabel: 'PC', icon: '∥', category: 'channel', description: 'Parallel Channel', cursor: 'crosshair' },
  { id: 'regression-trend', label: '回归趋势', shortLabel: 'LR', icon: '📈', category: 'channel', description: 'Linear Regression', cursor: 'crosshair' },
  { id: 'pitchfork', label: '鱼叉线', shortLabel: 'AP', icon: 'Ψ', category: 'channel', description: "Andrew's Pitchfork", cursor: 'crosshair' },
  { id: 'schiff-pitchfork', label: '希夫鱼叉', shortLabel: 'SP', icon: 'Ψ', category: 'channel', description: 'Schiff Pitchfork', cursor: 'crosshair' },
  { id: 'modified-pitchfork', label: '修正鱼叉', shortLabel: 'MP', icon: 'Ψ', category: 'channel', description: 'Modified Pitchfork', cursor: 'crosshair' },
  { id: 'disjoint-channel', label: '分离通道', shortLabel: 'DC', icon: '⊟', category: 'channel', description: 'Disjoint Channel', cursor: 'crosshair' },
  { id: 'fixed-range', label: '固定区间', shortLabel: 'FR', icon: '⊡', category: 'channel', description: 'Fixed Range Volume Profile', cursor: 'crosshair' },
  { id: 'regression-ch', label: '回归通道', shortLabel: 'RC', icon: '▤', category: 'channel', description: 'Standard Deviation Channel', cursor: 'crosshair' },
  { id: 'donchian-ch', label: '唐奇安通道', shortLabel: 'DC', icon: '〓', category: 'channel', description: 'Donchian Channel', cursor: 'crosshair' },
  { id: 'keltner-ch', label: '肯特纳通道', shortLabel: 'KC', icon: '▥', category: 'channel', description: 'Keltner Channel', cursor: 'crosshair' },
  { id: 'bollinger-ch', label: '布林通道', shortLabel: 'BB', icon: '▦', category: 'channel', description: 'Bollinger Bands', cursor: 'crosshair' },
  { id: 'envelope-ch', label: '包络线通道', shortLabel: 'ENV', icon: '▧', category: 'channel', description: 'Envelope Channel', cursor: 'crosshair' },

  // ── Fibonacci (15) ──
  { id: 'fib-retracement', label: '斐波回调', shortLabel: 'Fib', icon: 'φ', category: 'fib', description: 'Retracement 0/0.236/0.382/0.5/0.618/0.786/1', cursor: 'crosshair' },
  { id: 'fib-extension', label: '斐波扩展', shortLabel: 'FExt', icon: 'Φ', category: 'fib', description: 'Extension', cursor: 'crosshair' },
  { id: 'fib-speed-resistance', label: '速度阻力', shortLabel: 'FSR', icon: '🌊', category: 'fib', description: 'Speed Resistance Fan', cursor: 'crosshair' },
  { id: 'fib-time-zone', label: '时间区间', shortLabel: 'FTZ', icon: '⏱', category: 'fib', description: 'Time Zone', cursor: 'crosshair' },
  { id: 'fib-trend-time', label: '趋势时间', shortLabel: 'FTT', icon: '⏳', category: 'fib', description: 'Trend-Based Time', cursor: 'crosshair' },
  { id: 'fib-circle', label: '斐波圆', shortLabel: 'FC', icon: '⭕', category: 'fib', description: 'Fibonacci Circle', cursor: 'crosshair' },
  { id: 'fib-spiral', label: '斐波螺旋', shortLabel: 'FS', icon: '🌀', category: 'fib', description: 'Fibonacci Spiral', cursor: 'crosshair' },
  { id: 'fib-speed-res-fan', label: '速度扇', shortLabel: 'FSF', icon: '🌪', category: 'fib', description: 'Speed Resistance Fan', cursor: 'crosshair' },
  { id: 'fib-arc', label: '斐波弧', shortLabel: 'FA', icon: '◌', category: 'fib', description: 'Fibonacci Arc', cursor: 'crosshair' },
  { id: 'fib-channel', label: '斐波通道', shortLabel: 'FCh', icon: '‖', category: 'fib', description: 'Fibonacci Channel', cursor: 'crosshair' },
  { id: 'fib-expansion', label: '斐波扩张', shortLabel: 'FEx', icon: '⊕', category: 'fib', description: 'Fibonacci Expansion', cursor: 'crosshair' },
  { id: 'fib-projection', label: '斐波投影', shortLabel: 'FPr', icon: '⊗', category: 'fib', description: 'Fibonacci Projection', cursor: 'crosshair' },
  { id: 'fib-wedge', label: '斐波楔形', shortLabel: 'FW', icon: '◢', category: 'fib', description: 'Fibonacci Wedge', cursor: 'crosshair' },
  { id: 'fib-ghost', label: '斐波幽灵', shortLabel: 'FG', icon: '👻', category: 'fib', description: 'Ghost Fibonacci', cursor: 'crosshair' },
  { id: 'fib-auto', label: '自动斐波', shortLabel: 'AFib', icon: '🤖', category: 'fib', description: 'Auto Fibonacci', cursor: 'crosshair' },

  // ── Shapes (18) ──
  { id: 'rectangle', label: '矩形', shortLabel: 'Rect', icon: '▭', category: 'shape', description: 'Rectangle zone', cursor: 'crosshair' },
  { id: 'price-range', label: '价格区间', shortLabel: 'PR', icon: '↕', category: 'shape', description: 'Price Range', cursor: 'crosshair' },
  { id: 'date-range', label: '日期区间', shortLabel: 'DR', icon: '↔', category: 'shape', description: 'Date Range', cursor: 'crosshair' },
  { id: 'triangle', label: '三角形', shortLabel: '△', icon: '△', category: 'shape', description: 'Triangle', cursor: 'crosshair' },
  { id: 'circle', label: '圆形', shortLabel: '○', icon: '○', category: 'shape', description: 'Circle', cursor: 'crosshair' },
  { id: 'ellipse', label: '椭圆', shortLabel: '◯', icon: '◯', category: 'shape', description: 'Ellipse', cursor: 'crosshair' },
  { id: 'polygon', label: '多边形', shortLabel: 'Pol', icon: '⬠', category: 'shape', description: 'Polygon', cursor: 'crosshair' },
  { id: 'arc', label: '弧形', shortLabel: 'Arc', icon: '◝', category: 'shape', description: 'Arc', cursor: 'crosshair' },
  { id: 'flag', label: '旗形', shortLabel: 'Flg', icon: '⚑', category: 'shape', description: 'Flag pattern', cursor: 'crosshair' },
  { id: 'pennant', label: '三角旗', shortLabel: 'Pen', icon: '⛳', category: 'shape', description: 'Pennant', cursor: 'crosshair' },
  { id: 'wedge-up', label: '上升楔形', shortLabel: 'RW', icon: '◸', category: 'shape', description: 'Rising Wedge', cursor: 'crosshair' },
  { id: 'wedge-down', label: '下降楔形', shortLabel: 'FW', icon: '◿', category: 'shape', description: 'Falling Wedge', cursor: 'crosshair' },
  { id: 'diamond', label: '菱形', shortLabel: 'Dia', icon: '◇', category: 'shape', description: 'Diamond pattern', cursor: 'crosshair' },
  { id: 'head-shoulders', label: '头肩顶', shortLabel: 'HS', icon: '⛰', category: 'shape', description: 'Head & Shoulders', cursor: 'crosshair' },
  { id: 'inv-head-shoulders', label: '头肩底', shortLabel: 'IHS', icon: '⛲', category: 'shape', description: 'Inverse H&S', cursor: 'crosshair' },
  { id: 'double-top', label: '双顶', shortLabel: 'DT', icon: '⛰⛰', category: 'shape', description: 'Double Top', cursor: 'crosshair' },
  { id: 'double-bottom', label: '双底', shortLabel: 'DB', icon: '⛲⛲', category: 'shape', description: 'Double Bottom', cursor: 'crosshair' },
  { id: 'cup-handle', label: '杯柄', shortLabel: 'CH', icon: '☕', category: 'shape', description: 'Cup & Handle', cursor: 'crosshair' },

  // ── Text/Annotation (8) ──
  { id: 'text', label: '文字标注', shortLabel: 'T', icon: 'T', category: 'text', description: 'Text', cursor: 'text' },
  { id: 'label-callout', label: '标注气泡', shortLabel: '💬', icon: '💬', category: 'text', description: 'Callout', cursor: 'crosshair' },
  { id: 'arrow-marker', label: '箭头标记', shortLabel: '→', icon: '→', category: 'text', description: 'Arrow', cursor: 'crosshair' },
  { id: 'price-label', label: '价格标签', shortLabel: '🏷', icon: '🏷', category: 'text', description: 'Price label', cursor: 'crosshair' },
  { id: 'note', label: '笔记', shortLabel: 'N', icon: '📝', category: 'text', description: 'Note', cursor: 'crosshair' },
  { id: 'emoji-marker', label: '表情标记', shortLabel: '😊', icon: '😊', category: 'text', description: 'Emoji Marker', cursor: 'crosshair' },
  { id: 'highlight', label: '高亮区域', shortLabel: 'HLt', icon: '🖍', category: 'text', description: 'Highlight area', cursor: 'crosshair' },
  { id: 'stamp', label: '图章', shortLabel: 'Stp', icon: '🔖', category: 'text', description: 'Stamp marker', cursor: 'crosshair' },

  // ── Patterns (5) ──
  { id: 'auto-pattern', label: '自动形态', shortLabel: 'APat', icon: '🔍', category: 'pattern', description: 'Auto Pattern Recognition', cursor: 'crosshair' },
  { id: 'abc-pattern', label: 'ABCD形态', shortLabel: 'ABCD', icon: '🔤', category: 'pattern', description: 'ABCD Pattern', cursor: 'crosshair' },
  { id: 'gartley', label: '加特利', shortLabel: 'Gar', icon: '🦋', category: 'pattern', description: 'Gartley Pattern', cursor: 'crosshair' },
  { id: 'bat-pattern', label: '蝙蝠形态', shortLabel: 'Bat', icon: '🦇', category: 'pattern', description: 'Bat Pattern', cursor: 'crosshair' },
  { id: 'cypher', label: '密码形态', shortLabel: 'Cyp', icon: '🔐', category: 'pattern', description: 'Cypher Pattern', cursor: 'crosshair' },
];

// ═══════════ Category config ═══════════

export const DRAWING_CATEGORY_LABELS: Record<DrawingCategory, string> = {
  line: '线段', channel: '通道', fib: '斐波那契', shape: '形状', text: '标注', pattern: '形态',
};

export const DRAWING_CATEGORY_COLORS: Record<DrawingCategory, string> = {
  line: '#60a5fa', channel: '#34d399', fib: '#f472b6', shape: '#fbbf24', text: '#a78bfa', pattern: '#fb923c',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [recentTools, setRecentTools] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('qm-recent-draw-tools') || '[]'); } catch { return []; }
  });

  const handleSelectTool = useCallback((toolId: string | null) => {
    onSelectTool(toolId);
    if (toolId) {
      setRecentTools(prev => {
        const next = [toolId, ...prev.filter(id => id !== toolId)].slice(0, 5);
        localStorage.setItem('qm-recent-draw-tools', JSON.stringify(next));
        return next;
      });
    }
  }, [onSelectTool]);

  const grouped = useCallback(() => {
    const map: Record<DrawingCategory, DrawingToolDef[]> = { line: [], channel: [], fib: [], shape: [], text: [], pattern: [] };
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

      {/* Search */}
      <div className="px-1 mb-1">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索工具..."
          className="w-full px-2 py-1 rounded bg-[#161b22] border border-[#30363d] text-[10px] text-[#8b949e] placeholder-[#484f58] focus:outline-none focus:border-[#c9a96e]"
        />
      </div>

      {/* Recent Tools */}
      {recentTools.length > 0 && !searchQuery && (
        <div className="mb-1">
          <div className="text-[#484f58] text-[9px] px-1 mb-0.5">Recent</div>
          <div className="flex gap-0.5 flex-wrap px-1">
            {recentTools.map(id => {
              const tool = DRAWING_TOOLS.find(t => t.id === id);
              if (!tool) return null;
              return (
                <button
                  key={id}
                  onClick={() => handleSelectTool(activeTool === id ? null : id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                    activeTool === id
                      ? 'bg-[#c9a96e20] text-[#c9a96e]'
                      : 'text-[#8b949e] hover:bg-[#161b22]'
                  }`}
                  title={tool.description}
                >
                  {tool.icon} {tool.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Category + Tool grid */}
      <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto">
        {categories.filter(([, tools]) => !searchQuery || tools.some(t => t.label.includes(searchQuery) || t.shortLabel.toLowerCase().includes(searchQuery.toLowerCase()))).map(([cat, tools]) => (
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
                    onClick={() => handleSelectTool(activeTool === tool.id ? null : tool.id)}
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
