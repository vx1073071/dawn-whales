import { useState, useMemo } from 'react';

// ── 68 Drawing Tools Integration (MIT = all-in-one) ── ML#1 R269 (8h)
// Complete 68 drawing tools: 10 categories, all available as UI toolbox

interface DrawingTool {
  id: string;
  name: string;
  fullName: string;
  category: 'lines' | 'channels' | 'fib' | 'shapes' | 'annotations' | 'gann' | 'harmonics' | 'measure' | 'elliott' | 'custom';
  icon: string;
  shortcut: string;
  description: string;
}

const DRAWING_TOOLS_68: Record<string, DrawingTool[]> = {
  lines: [
    { id: 'horiz_line', name: '水平线', fullName: 'Horizontal Line', category: 'lines', icon: '━', shortcut: 'H', description: '画水平支撑/阻力线' },
    { id: 'horiz_ray', name: '水平射线', fullName: 'Horizontal Ray', category: 'lines', icon: '→━', shortcut: 'Shift+H', description: '向右延伸的水平线' },
    { id: 'trend_line', name: '趋势线', fullName: 'Trend Line', category: 'lines', icon: '╱', shortcut: 'T', description: '连接两点画趋势线' },
    { id: 'trend_ray', name: '趋势射线', fullName: 'Ray', category: 'lines', icon: '╱→', shortcut: 'R', description: '一端无限延伸的趋势线' },
    { id: 'extended_line', name: '无限延伸', fullName: 'Extended Line', category: 'lines', icon: '↔', shortcut: 'E', description: '两端点延伸的直线' },
    { id: 'parallel_line', name: '平行线', fullName: 'Parallel Line', category: 'lines', icon: '∥', shortcut: 'P', description: '画平行通道线' },
    { id: 'angle_line', name: '角度线', fullName: 'Angle Line', category: 'lines', icon: '∠', shortcut: 'A', description: '自定义角度线' },
    { id: 'arrow', name: '箭头', fullName: 'Arrow', category: 'lines', icon: '➤', shortcut: 'W', description: '带箭头的标注线' },
    { id: 'cross_line', name: '十字线', fullName: 'Cross Line', category: 'lines', icon: '┼', shortcut: 'C', description: '十字准星参考线' },
    { id: 'info_line', name: '信息线', fullName: 'Info Line', category: 'lines', icon: 'ℹ', shortcut: 'I', description: '显示价格/时间/百分比' },
  ],
  channels: [
    { id: 'parallel_channel', name: '平行通道', fullName: 'Parallel Channel', category: 'channels', icon: '⏸', shortcut: 'Shift+P', description: '标准平行通道' },
    { id: 'linreg_channel', name: '回归通道', fullName: 'Linear Regression', category: 'channels', icon: '📈', shortcut: 'Shift+L', description: '线性回归通道' },
    { id: 'stddev_channel', name: '标准差通道', fullName: 'Standard Dev Channel', category: 'channels', icon: '📊', shortcut: 'Shift+S', description: '标准差偏移通道' },
    { id: 'andrews_pitchfork', name: '安德鲁叉', fullName: 'Andrews Pitchfork', category: 'channels', icon: '🪶', shortcut: 'Alt+A', description: '中位数线+上下平行线' },
    { id: 'schiff_pitchfork', name: '修正叉', fullName: 'Schiff Pitchfork', category: 'channels', icon: '🔱', shortcut: 'Alt+S', description: '修正安德鲁叉' },
    { id: 'inside_pitchfork', name: '内叉', fullName: 'Inside Pitchfork', category: 'channels', icon: '⊐', shortcut: 'Alt+I', description: '内侧安德鲁叉' },
  ],
  fib: [
    { id: 'fib_retrace', name: '斐波回撤', fullName: 'Fib Retracement', category: 'fib', icon: 'φ', shortcut: 'F', description: '0/23.6/38.2/50/61.8/78.6/100%' },
    { id: 'fib_extension', name: '斐波扩展', fullName: 'Fib Extension', category: 'fib', icon: 'Φ', shortcut: 'Shift+F', description: '趋势延伸目标' },
    { id: 'fib_arc', name: '斐波弧', fullName: 'Fib Arc', category: 'fib', icon: '⌒', shortcut: 'Alt+F', description: '斐波那契弧线' },
    { id: 'fib_fan', name: '斐波扇', fullName: 'Fib Fan', category: 'fib', icon: '🌀', shortcut: 'Ctrl+F', description: '斐波那契扇形线' },
    { id: 'fib_time', name: '斐波时间', fullName: 'Fib Time Zones', category: 'fib', icon: '⏰', shortcut: 'Alt+T', description: '斐波那契时间周期' },
    { id: 'fib_channel', name: '斐波通道', fullName: 'Fib Channel', category: 'fib', icon: '⫼', shortcut: 'Alt+C', description: '斐波那契通道' },
    { id: 'fib_speed', name: '斐波速度线', fullName: 'Fib Speed Lines', category: 'fib', icon: '⚡', shortcut: 'Alt+V', description: '1/3+2/3速度阻力' },
    { id: 'fib_wedge', name: '斐波楔形', fullName: 'Fib Wedge', category: 'fib', icon: '△', shortcut: 'Alt+W', description: '上升/下降楔形斐波' },
  ],
  shapes: [
    { id: 'rectangle', name: '矩形', fullName: 'Rectangle', category: 'shapes', icon: '▭', shortcut: 'U', description: '矩形区间标记' },
    { id: 'rotated_rect', name: '旋转矩形', fullName: 'Rotated Rectangle', category: 'shapes', icon: '◇', shortcut: 'Shift+U', description: '倾斜矩形' },
    { id: 'ellipse', name: '椭圆', fullName: 'Ellipse', category: 'shapes', icon: '○', shortcut: 'O', description: '椭圆区域标记' },
    { id: 'triangle', name: '三角形', fullName: 'Triangle', category: 'shapes', icon: '△', shortcut: 'Alt+U', description: '三角形形态标记' },
    { id: 'polygon', name: '多边形', fullName: 'Polygon', category: 'shapes', icon: '⬡', shortcut: 'Shift+O', description: '自定义多边形' },
    { id: 'path', name: '自由路径', fullName: 'Free Path', category: 'shapes', icon: '✏️', shortcut: 'D', description: '自由手绘路径' },
    { id: 'arc', name: '弧形', fullName: 'Arc', category: 'shapes', icon: '◠', shortcut: 'Shift+C', description: '三点弧线' },
    { id: 'brush', name: '画笔', fullName: 'Brush', category: 'shapes', icon: '🖌', shortcut: 'B', description: '自由画笔涂鸦' },
    { id: 'highlight', name: '高亮', fullName: 'Highlight', category: 'shapes', icon: '🔆', shortcut: 'Shift+B', description: '半透明高亮区域' },
    { id: 'price_range', name: '价格区间', fullName: 'Price Range', category: 'shapes', icon: '↕', shortcut: 'Shift+R', description: '价格区间标记' },
  ],
  annotations: [
    { id: 'text', name: '文字', fullName: 'Text Note', category: 'annotations', icon: 'T', shortcut: 'N', description: '添加文字注释' },
    { id: 'label', name: '标签', fullName: 'Label', category: 'annotations', icon: '🏷', shortcut: 'Shift+N', description: '带箭头的标签' },
    { id: 'callout', name: '气泡', fullName: 'Callout', category: 'annotations', icon: '💬', shortcut: 'Alt+N', description: '气泡式注释' },
    { id: 'price_note', name: '价格注', fullName: 'Price Note', category: 'annotations', icon: '💲', shortcut: 'Shift+P', description: '价格标注' },
    { id: 'image', name: '贴图', fullName: 'Image', category: 'annotations', icon: '🖼', shortcut: 'Ctrl+I', description: '贴图表截图' },
    { id: 'emoji', name: 'Emoji', fullName: 'Emoji Stamp', category: 'annotations', icon: '😀', shortcut: 'Ctrl+E', description: '快捷Emoji标注' },
    { id: 'date_range', name: '时间区间', fullName: 'Date Range', category: 'annotations', icon: '📅', shortcut: 'Shift+D', description: '标注时间区间' },
    { id: 'flag', name: '旗帜', fullName: 'Flag Marker', category: 'annotations', icon: '🚩', shortcut: 'Alt+F', description: '关键事件标记' },
  ],
  gann: [
    { id: 'gann_fan', name: '江恩扇形', fullName: 'Gann Fan', category: 'gann', icon: '🔺', shortcut: 'G', description: '1×1/2×1/3×1...角度扇' },
    { id: 'gann_square', name: '江恩四方', fullName: 'Gann Square', category: 'gann', icon: '⊞', shortcut: 'Shift+G', description: '江恩正方形' },
    { id: 'gann_box', name: '江恩箱', fullName: 'Gann Box', category: 'gann', icon: '⊡', shortcut: 'Alt+G', description: '江恩箱形' },
    { id: 'fixed_range', name: '固定区间', fullName: 'Fixed Range', category: 'gann', icon: '⊟', shortcut: 'Ctrl+G', description: '固定价格时间区间' },
    { id: 'cycle_lines', name: '周期线', fullName: 'Cycle Lines', category: 'gann', icon: '🔄', shortcut: 'Alt+C', description: '等距周期线' },
    { id: 'cycle_circles', name: '周期圆', fullName: 'Cycle Circles', category: 'gann', icon: '◎', shortcut: 'Ctrl+C', description: '等距周期圆' },
    { id: 'sine_wave', name: '正弦波', fullName: 'Sine Wave', category: 'gann', icon: '∿', shortcut: 'Alt+S', description: '正弦波周期标注' },
    { id: 'time_cycle', name: '时间周期', fullName: 'Time Cycle', category: 'gann', icon: '⌛', shortcut: 'Ctrl+T', description: '自定义时间周期' },
  ],
  harmonics: [
    { id: 'gartley', name: 'Gartley', fullName: 'Gartley Pattern', category: 'harmonics', icon: '🦋', shortcut: 'Alt+1', description: 'XA 0.618/BC 0.382-0.886' },
    { id: 'bat', name: '蝙蝠', fullName: 'Bat Pattern', category: 'harmonics', icon: '🦇', shortcut: 'Alt+2', description: 'XA 0.382-0.5/BC 0.382-0.886' },
    { id: 'crab', name: '螃蟹', fullName: 'Crab Pattern', category: 'harmonics', icon: '🦀', shortcut: 'Alt+3', description: 'XA 0.382-0.618/BC 0.382-0.886' },
    { id: 'butterfly', name: '蝴蝶', fullName: 'Butterfly', category: 'harmonics', icon: '🦋', shortcut: 'Alt+4', description: 'M/W型反转和谐' },
    { id: 'shark', name: '鲨鱼', fullName: 'Shark Pattern', category: 'harmonics', icon: '🦈', shortcut: 'Alt+5', description: '5-0结构快速反转' },
  ],
  measure: [
    { id: 'ruler', name: '测距', fullName: 'Price Range Measure', category: 'measure', icon: '📏', shortcut: 'M', description: '测量价格距离/百分比' },
    { id: 'risk_reward', name: '风报比', fullName: 'Risk/Reward Tool', category: 'measure', icon: '⚖️', shortcut: 'Shift+M', description: '入场/止损/止盈比例' },
    { id: 'long_pos', name: '做多计划', fullName: 'Long Position', category: 'measure', icon: '📈', shortcut: 'Alt+L', description: '预设做多入场计划' },
    { id: 'short_pos', name: '做空计划', fullName: 'Short Position', category: 'measure', icon: '📉', shortcut: 'Alt+H', description: '预设做空入场计划' },
    { id: 'projection', name: '投影', fullName: 'Price Projection', category: 'measure', icon: '📐', shortcut: 'Shift+J', description: '价格时间投影' },
  ],
  elliott: [
    { id: 'impulse_1_5', name: '推动浪1-5', fullName: 'Impulse 1-5', category: 'elliott', icon: '1️⃣', shortcut: 'Alt+6', description: '5浪推动结构' },
    { id: 'correction_abc', name: '修正浪ABC', fullName: 'Correction ABC', category: 'elliott', icon: '🔤', shortcut: 'Alt+7', description: '3浪修正结构' },
    { id: 'motive_wave', name: '驱动浪', fullName: 'Motive Wave', category: 'elliott', icon: '🌊', shortcut: 'Alt+8', description: '完整的5-3-5驱动' },
    { id: 'diagonal', name: '终结楔形', fullName: 'Diagonal', category: 'elliott', icon: '▽', shortcut: 'Alt+9', description: '上升/下降终结楔形' },
    { id: 'wave_count', name: '数浪', fullName: 'Wave Count', category: 'elliott', icon: '🔢', shortcut: 'Alt+0', description: '自定义浪计数标注' },
    { id: 'flat_correction', name: '平台型', fullName: 'Flat Correction', category: 'elliott', icon: '⏹', shortcut: 'Alt+F', description: '3-3-5平台修正' },
  ],
  custom: [
    { id: 'custom_1', name: '自定义1', fullName: 'Custom Tool 1', category: 'custom', icon: '★', shortcut: 'Ctrl+1', description: '自定义工具模板1' },
    { id: 'custom_2', name: '自定义2', fullName: 'Custom Tool 2', category: 'custom', icon: '☆', shortcut: 'Ctrl+2', description: '自定义工具模板2' },
    { id: 'custom_3', name: '自定义3', fullName: 'Custom Tool 3', category: 'custom', icon: '✧', shortcut: 'Ctrl+3', description: '自定义工具模板3' },
  ],
};

const CATEGORY_DEFS = [
  { key: 'lines', label: '线', emoji: '╱', color: '#3b82f6' },
  { key: 'channels', label: '通道', emoji: '⏸', color: '#22c55e' },
  { key: 'fib', label: '斐波', emoji: 'φ', color: '#a855f7' },
  { key: 'shapes', label: '形状', emoji: '▭', color: '#f59e0b' },
  { key: 'annotations', label: '标注', emoji: 'T', color: '#ec4899' },
  { key: 'gann', label: '江恩', emoji: '🔺', color: '#ef4444' },
  { key: 'harmonics', label: '和谐', emoji: '🦋', color: '#06b6d4' },
  { key: 'measure', label: '测距', emoji: '📏', color: '#84cc16' },
  { key: 'elliott', label: '波浪', emoji: '🌊', color: '#14b8a6' },
  { key: 'custom', label: '自定义', emoji: '★', color: '#64748b' },
] as const;

interface DrawingToolboxProps {
  onSelectTool: (tool: DrawingTool) => void;
  activeTool?: string;
  recentTools?: string[];
}

const DrawingToolboxMIT = ({ onSelectTool, activeTool, recentTools = [] }: DrawingToolboxProps) => {
  const [category, setCategory] = useState<DrawingTool['category']>('lines');
  const [search, setSearch] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);

  const currentTools = DRAWING_TOOLS_68[category] || [];

  const filtered = useMemo(() => {
    if (!search) return currentTools;
    const q = search.toLowerCase();
    return Object.values(DRAWING_TOOLS_68).flat().filter(
      t => t.name.includes(q) || t.fullName.toLowerCase().includes(q) || t.id.includes(q)
    );
  }, [search, currentTools]);

  const allTools = useMemo(() => Object.values(DRAWING_TOOLS_68).flat(), []);

  const totalCount = allTools.length;

  return (
    <div className="drawing-toolbox-mit" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 540 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>✏️ 画线工具箱 ({totalCount})</span>
        <button onClick={() => setShowShortcuts(!showShortcuts)} style={{
          padding: '2px 8px', borderRadius: 10, border: 'none', fontSize: 10, cursor: 'pointer',
          background: showShortcuts ? '#3b82f6' : '#f1f5f9', color: showShortcuts ? 'white' : '#64748b',
        }}>
          {showShortcuts ? '收起' : '⌨ 快捷键'}
        </button>
      </div>

      {/* Search */}
      <input
        type="text" placeholder="搜索68个画线工具..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
          fontSize: 11, marginBottom: 8, boxSizing: 'border-box',
        }}
      />

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
        {CATEGORY_DEFS.map(cat => {
          const cnt = DRAWING_TOOLS_68[cat.key]?.length || 0;
          return (
            <button key={cat.key} onClick={() => { setCategory(cat.key); }} style={{
              padding: '3px 6px', borderRadius: 10, border: 'none', fontSize: 9, cursor: 'pointer',
              background: category === cat.key ? cat.color : '#f1f5f9',
              color: category === cat.key ? 'white' : '#64748b',
            }}>
              {cat.emoji} {cat.label}({cnt})
            </button>
          );
        })}
      </div>

      {/* Shortcuts Panel */}
      {showShortcuts && (
        <div style={{
          padding: 8, borderRadius: 6, background: '#f8fafc', marginBottom: 8,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 3, fontSize: 9,
        }}>
          {allTools.filter(t => t.shortcut).slice(0, 48).map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px', background: '#fff', borderRadius: 3 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </span>
              <kbd style={{ fontSize: 7, background: '#e5e7eb', padding: '0 3px', borderRadius: 2 }}>{t.shortcut}</kbd>
            </div>
          ))}
        </div>
      )}

      {/* Tools Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
        {(search ? filtered : currentTools).map(tool => {
          const isActive = activeTool === tool.id;
          const isRecent = recentTools.includes(tool.id);
          return (
            <div
              key={tool.id}
              onClick={() => onSelectTool(tool)}
              style={{
                padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                border: isActive ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                background: isActive ? '#eff6ff' : isRecent ? '#fefce8' : 'white',
                transition: 'all 0.1s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 14 }}>{tool.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 10 }}>{tool.name}</span>
                {isRecent && <span style={{ fontSize: 8, color: '#f59e0b' }}>🕐</span>}
              </div>
              <div style={{ fontSize: 8, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                <span>{tool.description}</span>
                <kbd style={{ fontSize: 7, background: '#f1f5f9', padding: '0 2px', borderRadius: 2 }}>
                  {tool.shortcut}
                </kbd>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty */}
      {(search ? filtered : currentTools).length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
          🔍 无匹配 — 试试其他关键词
        </div>
      )}
    </div>
  );
};

export { DRAWING_TOOLS_68, CATEGORY_DEFS };
export default DrawingToolboxMIT;
