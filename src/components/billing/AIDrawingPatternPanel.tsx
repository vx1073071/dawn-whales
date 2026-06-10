import { useState, useMemo, useRef, type CSSProperties } from 'react';

// ── Types ──
interface Point { x: number; y: number; price: number; time: number }

interface Drawing {
  id: string
  type: 'trendline' | 'horizontal' | 'channel' | 'fibonacci' | 'gann' | 'ray'
  points: Point[]
  color: string
  width: number
  dash?: number[]
  label?: string
  editable: boolean
  visible: boolean
}

interface Pattern {
  id: string
  name: string
  type: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  points: Point[]
  description: string
  annotated: boolean
  corrected: boolean
}

const DRAWING_PRESETS = [
  { type: 'trendline' as const, label: '趋势线', icon: '📈', color: '#3B82F6' },
  { type: 'horizontal' as const, label: '支撑阻力', icon: '➖', color: '#F59E0B' },
  { type: 'channel' as const, label: '通道', icon: '⫼', color: '#10B981' },
  { type: 'fibonacci' as const, label: '斐波那契', icon: '🌀', color: '#8B5CF6' },
  { type: 'gann' as const, label: '江恩', icon: '📐', color: '#EC4899' },
  { type: 'ray' as const, label: '射线', icon: '➡', color: '#06B6D4' },
];

const PATTERN_PRESETS: Pattern[] = [
  { id: 'p1', name: '头肩顶', type: 'bearish', confidence: 0.87, points: [], description: '市场见顶信号', annotated: false, corrected: false },
  { id: 'p2', name: '头肩底', type: 'bullish', confidence: 0.82, points: [], description: '市场见底反转', annotated: false, corrected: false },
  { id: 'p3', name: '双顶', type: 'bearish', confidence: 0.79, points: [], description: 'M型顶部结构', annotated: false, corrected: false },
  { id: 'p4', name: '双底', type: 'bullish', confidence: 0.84, points: [], description: 'W型底部结构', annotated: false, corrected: false },
  { id: 'p5', name: '上升三角形', type: 'bullish', confidence: 0.76, points: [], description: '突破向上盘整', annotated: false, corrected: false },
  { id: 'p6', name: '下降三角形', type: 'bearish', confidence: 0.74, points: [], description: '跌破向下盘整', annotated: false, corrected: false },
  { id: 'p7', name: '上升楔形', type: 'bearish', confidence: 0.71, points: [], description: '末端加速见顶', annotated: false, corrected: false },
  { id: 'p8', name: '下降楔形', type: 'bullish', confidence: 0.73, points: [], description: '末端加速见底', annotated: false, corrected: false },
  { id: 'p9', name: '杯柄形态', type: 'bullish', confidence: 0.68, points: [], description: '中长期看涨', annotated: false, corrected: false },
  { id: 'p10', name: '旗形整理', type: 'neutral', confidence: 0.65, points: [], description: '趋势中途整理', annotated: false, corrected: false },
  { id: 'p11', name: '菱形顶', type: 'bearish', confidence: 0.62, points: [], description: '宽幅震荡见顶', annotated: false, corrected: false },
  { id: 'p12', name: '圆弧底', type: 'bullish', confidence: 0.70, points: [], description: '缓慢筑底反转', annotated: false, corrected: false },
  { id: 'p13', name: '三白兵', type: 'bullish', confidence: 0.78, points: [], description: '连续三日强势', annotated: false, corrected: false },
  { id: 'p14', name: '三乌鸦', type: 'bearish', confidence: 0.77, points: [], description: '连续三日弱势', annotated: false, corrected: false },
  { id: 'p15', name: '十字星', type: 'neutral', confidence: 0.60, points: [], description: '犹豫不决信号', annotated: false, corrected: false },
  { id: 'p16', name: '锤子线', type: 'bullish', confidence: 0.69, points: [], description: '下影长阳反', annotated: false, corrected: false },
  { id: 'p17', name: '上吊线', type: 'bearish', confidence: 0.67, points: [], description: '高尾见顶', annotated: false, corrected: false },
  { id: 'p18', name: '吞没形态', type: 'bullish', confidence: 0.75, points: [], description: '多空争夺反转', annotated: false, corrected: false },
  { id: 'p19', name: '孕线', type: 'neutral', confidence: 0.58, points: [], description: '趋势可能转变', annotated: false, corrected: false },
  { id: 'p20', name: '启明星', type: 'bullish', confidence: 0.72, points: [], description: '底部分离信号', annotated: false, corrected: false },
];

// ── Sub-components ──
function DrawingToolbar({ activeTool, setActiveTool, drawings, setDrawings }: {
  activeTool: string | null
  setActiveTool: (t: string | null) => void
  drawings: Drawing[]
  setDrawings: (d: Drawing[]) => void
}) {
  const addDrawing = (type: string) => {
    const preset = DRAWING_PRESETS.find(p => p.type === type);
    if (!preset) return;
    const d: Drawing = {
      id: `d${Date.now()}`,
      type: preset.type,
      points: [],
      color: preset.color,
      width: 2,
      editable: true,
      visible: true,
      label: preset.label,
    };
    setDrawings([...drawings, d]);
    setActiveTool(type);
  };

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 0' }}>
      {DRAWING_PRESETS.map(p => (
        <button
          key={p.type}
          onClick={() => activeTool === p.type ? setActiveTool(null) : addDrawing(p.type)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            borderRadius: 8, border: activeTool === p.type ? `2px solid ${p.color}` : '1px solid #374151',
            background: activeTool === p.type ? `${p.color}18` : '#1F2937',
            color: '#E5E7EB', cursor: 'pointer', fontSize: 13, fontWeight: activeTool === p.type ? 600 : 400,
            transition: 'all 0.15s',
          }}
        >
          <span>{p.icon}</span>
          <span>{p.label}</span>
        </button>
      ))}
      {activeTool && (
        <button
          onClick={() => setActiveTool(null)}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid #EF4444',
            background: '#EF444418', color: '#EF4444', cursor: 'pointer', fontSize: 13,
          }}
        >
          ✕ 取消
        </button>
      )}
    </div>
  );
}

function DrawingCanvas({ drawings, setDrawings, activeTool }: {
  drawings: Drawing[]
  setDrawings: (d: Drawing[]) => void
  activeTool: string | null
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 780; const H = 420;

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let x = 0; x <= W; x += 60) lines.push({ x1: x, y1: 0, x2: x, y2: H });
    for (let y = 0; y <= H; y += 42) lines.push({ x1: 0, y1: y, x2: W, y2: y });
    return lines;
  }, []);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  return (
    <div style={{ position: 'relative', background: '#111827', borderRadius: 12, overflow: 'hidden', border: '1px solid #374151' }}>
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', cursor: activeTool ? 'crosshair' : 'default' }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: (e.clientX - rect.left) / rect.width * W, y: (e.clientY - rect.top) / rect.height * H });
        }}
      >
        {/* Grid */}
        {gridLines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#1F2937" strokeWidth={0.5} />
        ))}

        {/* Crosshair */}
        {activeTool && (
          <>
            <line x1={mousePos.x} y1={0} x2={mousePos.x} y2={H} stroke="#6B7280" strokeWidth={0.5} strokeDasharray="4 4" />
            <line x1={0} y1={mousePos.y} x2={W} y2={mousePos.y} stroke="#6B7280" strokeWidth={0.5} strokeDasharray="4 4" />
          </>
        )}

        {/* Render saved drawings */}
        {drawings.filter(d => d.visible && d.points.length >= 2).map(d => (
          <g key={d.id}>
            {/* Main line */}
            <polyline
              points={d.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={d.color}
              strokeWidth={d.width}
              strokeDasharray={d.dash?.join(' ') ?? ''}
              strokeOpacity={0.9}
            />
            {/* Price/Time dots */}
            {d.points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4} fill={d.color} stroke="#111827" strokeWidth={1.5} />
            ))}
            {/* Label */}
            {d.label && (
              <text x={d.points[0].x + 8} y={d.points[0].y - 8} fontSize={12} fill={d.color} opacity={0.9}>
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Overlay toolbar */}
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
        {drawings.map(d => (
          <button
            key={d.id}
            onClick={() => {
              const updated = drawings.map(x => x.id === d.id ? { ...x, visible: !x.visible } : x);
              setDrawings(updated);
            }}
            style={{
              padding: '4px 8px', borderRadius: 6, border: '1px solid #4B5563',
              background: d.visible ? d.color + '28' : '#374151', color: d.visible ? d.color : '#6B7280',
              fontSize: 11, cursor: 'pointer',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PatternCard({ pattern, onAnnotate, onCorrect }: {
  pattern: Pattern
  onAnnotate: (id: string) => void
  onCorrect: (id: string) => void
}) {
  const typeColors: Record<string, string> = { bullish: '#10B981', bearish: '#EF4444', neutral: '#6B7280' };
  const typeLabels: Record<string, string> = { bullish: t('components.bullish'), bearish: t('components.bearish'), neutral: t('components.neutral') };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 14px', borderRadius: 10, background: '#1F2937', border: `1px solid ${pattern.annotated ? typeColors[pattern.type] : '#374151'}`,
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: typeColors[pattern.type] + '22', fontSize: 14, fontWeight: 700,
            color: typeColors[pattern.type],
          }}
        >
          {pattern.type === 'bullish' ? '↑' : pattern.type === 'bearish' ? '↓' : '–'}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#E5E7EB' }}>{pattern.name}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{pattern.description}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Confidence */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              width: 42, height: 6, borderRadius: 3, background: '#374151', overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pattern.confidence * 100}%`, height: '100%',
                background: pattern.confidence > 0.75 ? '#10B981' : pattern.confidence > 0.6 ? '#F59E0B' : '#EF4444',
                borderRadius: 3, transition: 'width 0.3s',
              }}
            />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#D1D5DB', minWidth: 32 }}>
            {(pattern.confidence * 100).toFixed(0)}%
          </span>
        </div>

        <span
          style={{
            padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: typeColors[pattern.type] + '22', color: typeColors[pattern.type],
          }}
        >
          {typeLabels[pattern.type]}
        </span>

        {!pattern.annotated && (
          <button
            onClick={() => onAnnotate(pattern.id)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid #6366F1',
              background: '#6366F118', color: '#818CF8', fontSize: 12, cursor: 'pointer',
            }}
          >
            标注
          </button>
        )}
        {pattern.annotated && !pattern.corrected && (
          <button
            onClick={() => onCorrect(pattern.id)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid #F59E0B',
              background: '#F59E0B18', color: '#FBBF24', fontSize: 12, cursor: 'pointer',
            }}
          >
            修正
          </button>
        )}
        {pattern.corrected && (
          <span style={{ fontSize: 11, color: '#10B981' }}>✅ 已修正</span>
        )}
      </div>
    </div>
  );
}

function PatternLegend() {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '6px 0' }}>
      <span style={{ fontSize: 12, color: '#10B981' }}>🟢 看涨</span>
      <span style={{ fontSize: 12, color: '#EF4444' }}>🔴 看跌</span>
      <span style={{ fontSize: 12, color: '#6B7280' }}>⚪ 中性</span>
      <span style={{ fontSize: 12, color: '#6366F1' }}>✏️ 可标注/修正</span>
    </div>
  );
}

// ── Main ──
export default function AIDrawingPatternPanel() {
  const [tab, setTab] = useState<'drawing' | 'pattern'>('drawing');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([
    { id: 'd0', type: 'trendline', color: '#3B82F6', width: 2, editable: true, visible: true, label: '上升趋势', points: [{ x: 40, y: 320, price: 18500, time: 0 }, { x: 720, y: 100, price: 21000, time: 1 }] },
    { id: 'd1', type: 'horizontal', color: '#F59E0B', width: 1, dash: [6, 3], editable: true, visible: true, label: '支撑 19000', points: [{ x: 0, y: 280, price: 19000, time: 0 }, { x: 780, y: 280, price: 19000, time: 1 }] },
    { id: 'd2', type: 'fibonacci', color: '#8B5CF6', width: 1, dash: [4, 4], editable: true, visible: true, label: 'Fib 0.618', points: [{ x: 0, y: 350, price: 18000, time: 0 }, { x: 0, y: 60, price: 22000, time: 1 }] },
  ]);
  const [patterns, setPatterns] = useState<Pattern[]>(PATTERN_PRESETS.map(p => ({
    ...p,
    annotated: ['p3', 'p4', 'p9'].includes(p.id),
  })));
  const [filterType, setFilterType] = useState<'all' | 'bullish' | 'bearish' | 'neutral'>('all');
  const [sortBy, setSortBy] = useState<'confidence' | 'name'>('confidence');

  const handleAnnotate = (id: string) => setPatterns(ps => ps.map(p => p.id === id ? { ...p, annotated: true } : p));
  const handleCorrect = (id: string) => setPatterns(ps => ps.map(p => p.id === id ? { ...p, corrected: true } : p));

  const filteredPatterns = useMemo(() => {
    let list = patterns;
    if (filterType !== 'all') list = list.filter(p => p.type === filterType);
    if (sortBy === 'confidence') list = [...list].sort((a, b) => b.confidence - a.confidence);
    else list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    return list;
  }, [patterns, filterType, sortBy]);

  const stats = useMemo(() => {
    const bullish = patterns.filter(p => p.type === 'bullish').length;
    const bearish = patterns.filter(p => p.type === 'bearish').length;
    const neutral = patterns.filter(p => p.type === 'neutral').length;
    const annotated = patterns.filter(p => p.annotated).length;
    const highConf = patterns.filter(p => p.confidence > 0.75).length;
    return { bullish, bearish, neutral, annotated, highConf, total: patterns.length };
  }, [patterns]);

  const theme: CSSProperties = {
    background: '#0A0A10', borderRadius: 16, padding: 24,
    border: '1px solid #1F2937', color: '#E5E7EB',
    maxWidth: 960, margin: '0 auto',
  };

  return (
    <div style={theme}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>
            🤖 AI 画线 & 形态识别
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            自动识别趋势线·支撑阻力·通道·斐波那契·江恩 ｜ 20+形态半透明标注
          </p>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#111827', borderRadius: 10, padding: 4 }}>
          <button
            onClick={() => setTab('drawing')}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: tab === 'drawing' ? '#6366F1' : 'transparent',
              color: tab === 'drawing' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            📐 画线工具
          </button>
          <button
            onClick={() => setTab('pattern')}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: tab === 'pattern' ? '#6366F1' : 'transparent',
              color: tab === 'pattern' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            📊 形态识别 ({patterns.filter(p => p.annotated).length}/{patterns.length})
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatBadge label="总形态" value={stats.total.toString()} color="#6366F1" />
        <StatBadge label="看涨" value={stats.bullish.toString()} color="#10B981" />
        <StatBadge label="看跌" value={stats.bearish.toString()} color="#EF4444" />
        <StatBadge label="中性" value={stats.neutral.toString()} color="#6B7280" />
        <StatBadge label="已标注" value={stats.annotated.toString()} color="#F59E0B" />
        <StatBadge label="高置信" value={stats.highConf.toString()} color="#10B981" />
      </div>

      {/* Drawing tab */}
      {tab === 'drawing' && (
        <>
          <DrawingToolbar activeTool={activeTool} setActiveTool={setActiveTool} drawings={drawings} setDrawings={setDrawings} />
          <DrawingCanvas drawings={drawings} setDrawings={setDrawings} activeTool={activeTool} />

          {/* Drawing list */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 8 }}>
              画线列表 ({drawings.length}) · 点击标签切换可见
            </div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>
              💡 提示：点击画线按钮添加 → 在Canvas上点击放置点 → 拖拽调节
            </div>
          </div>
        </>
      )}

      {/* Pattern tab */}
      {tab === 'pattern' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <PatternLegend />
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'bullish', 'bearish', 'neutral'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, border: '1px solid',
                    borderColor: filterType === f ? '#6366F1' : '#374151',
                    background: filterType === f ? '#6366F122' : 'transparent',
                    color: filterType === f ? '#818CF8' : '#6B7280', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {f === 'all' ? t('components.all') : f === 'bullish' ? '🟢 看涨' : f === 'bearish' ? '🔴 看跌' : '⚪ 中性'}
                </button>
              ))}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{
                  padding: '4px 8px', borderRadius: 6, border: '1px solid #374151',
                  background: '#1F2937', color: '#D1D5DB', fontSize: 12,
                }}
              >
                <option value="confidence">按置信度</option>
                <option value="name">按名称</option>
              </select>
            </div>
          </div>

          {/* Pattern list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
            {filteredPatterns.map(p => (
              <PatternCard key={p.id} pattern={p} onAnnotate={handleAnnotate} onCorrect={handleCorrect} />
            ))}
          </div>

          {/* Summary footer */}
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 10, background: '#111827',
            border: '1px solid #1F2937', fontSize: 12, color: '#9CA3AF',
          }}>
            💡 形态识别基于 AI 算法自动检测 · 标注后叠加到 K 线图上 · 创作者可手动修正
          </div>
        </>
      )}
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8, background: color + '14', border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
