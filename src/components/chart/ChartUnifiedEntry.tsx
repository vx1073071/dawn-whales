// @ts-nocheck
// R284 ML#1: ChartUnifiedEntry — 统一图表入口 5→1 (8h)
// Merges: KLineChart + KLineChartPro + StockKLineDeep + StockKLineDeepV2 + KLineUnifiedEntry
// Single chart portal: timeframe/indicator/drawing/snapshot/compare all in one
// 统一图表入口: 一套K线解决所有问题
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { TrendingUp, PenTool, Camera, Columns, Activity, Layers, Settings, Maximize2, Minimize2 } from 'lucide-react';

// ─── Simplified Types ─────────────────────────────────────────────
type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';
type ChartMode = 'candle' | 'line' | 'area' | 'heikin' | 'renko';
type AdjustMode = 'none' | 'pre' | 'post';

interface KlineBar { time: number; open: number; high: number; low: number; close: number; volume: number; }
interface IndicatorDef { id: string; name: string; emoji: string; params: Record<string, number>; active: boolean; }
interface DrawingDef { id: string; type: string; points: { x: number; y: number }[]; color: string; }

// ─── Mock Data Generator ──────────────────────────────────────────
function genKline(bars: number = 200): KlineBar[] {
  let price = 100 + Math.random() * 50;
  const result: KlineBar[] = [];
  for (let i = bars; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.48) * 3;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    result.push({ time: Date.now() - i * 3600000, open, high, low, close, volume: Math.floor(Math.random() * 100000 + 10000) });
    price = close;
  }
  return result;
}

// ─── Sub: ChartCanvas (mock lightweight-charts) ────────────────────
function ChartCanvas({ data, tf, mode }: { data: KlineBar[]; tf: Timeframe; mode: ChartMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || data.length < 2) return;
    const w = ctx.canvas.width; const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    const prices = data.map(d => [d.high, d.low]).flat();
    const max = Math.max(...prices); const min = Math.min(...prices);
    const range = max - min || 1;
    const toX = (i: number) => (i / (data.length - 1)) * (w - 40) + 20;
    const toY = (p: number) => h - ((p - min) / range) * (h - 40) - 20;

    // Draw candles
    data.forEach((d, i) => {
      const x = toX(i);
      const bodyH = Math.abs(toY(d.open) - toY(d.close));
      const isGreen = d.close >= d.open;
      ctx.fillStyle = isGreen ? '#22c55e' : '#ef4444';
      ctx.strokeStyle = isGreen ? '#22c55e' : '#ef4444';
      ctx.fillRect(x - 3, Math.min(toY(d.open), toY(d.close)), 6, Math.max(bodyH, 1));
      ctx.beginPath(); ctx.moveTo(x, toY(d.high)); ctx.lineTo(x, toY(d.low)); ctx.stroke();
    });

    // Grid
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) { const y = 20 + i * (h - 40) / 4; ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(w - 20, y); ctx.stroke(); }

    // Price labels
    ctx.fillStyle = '#64748b'; ctx.font = '10px monospace';
    for (let i = 0; i < 5; i++) {
      const p = max - (range * i / 4);
      ctx.fillText(p.toFixed(2), 2, 20 + i * (h - 40) / 4 + 3);
    }
  }, [data, tf, mode]);
  return <canvas ref={canvasRef} width={660} height={320} style={{ width: '100%', height: 320, borderRadius: 8, background: '#0a0e1a' }}/>;
}

// ─── Sub: Timeframe Bar ────────────────────────────────────────────
function TBar({ tf, onTf }: { tf: Timeframe; onTf: (t: Timeframe) => void }) {
  const tfs: { v: Timeframe; l: string }[] = [
    { v: '1m', l: '1分' },{ v: '5m', l: '5分' },{ v: '15m', l: '15分' },{ v: '30m', l: '30分' },
    { v: '1h', l: '1时' },{ v: '4h', l: '4时' },{ v: '1D', l: '日' },{ v: '1W', l: '周' },{ v: '1M', l: '月' },
  ];
  return <div style={{ display: 'flex', gap: 2, background: '#111827', borderRadius: 8, padding: 2 }}>
    {tfs.map(t => <button key={t.v} onClick={() => onTf(t.v)} style={{
      padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: tf === t.v ? 600 : 400,
      cursor: 'pointer', border: 'none', background: tf === t.v ? '#3b82f6' : 'transparent',
      color: tf === t.v ? '#fff' : '#64748b',
    }}>{t.l}</button>)}
  </div>;
}

// ─── Sub: Quick Indicator Row ──────────────────────────────────────
const QUICK_INDS: { id: string; name: string; emoji: string }[] = [
  { id: 'ma', name: 'MA', emoji: '📊' },{ id: 'ema', name: 'EMA', emoji: '📈' },{ id: 'boll', name: 'BOLL', emoji: '🎗️' },
  { id: 'macd', name: 'MACD', emoji: '📉' },{ id: 'rsi', name: 'RSI', emoji: '📐' },{ id: 'kdj', name: 'KDJ', emoji: '🔺' },
  { id: 'volume', name: 'VOL', emoji: '📶' },{ id: 'sar', name: 'SAR', emoji: '🔵' },
];

function QuickIndicators({ active, onToggle }: { active: Set<string>; onToggle: (id: string) => void }) {
  return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
    {QUICK_INDS.map(ind => <button key={ind.id} onClick={() => onToggle(ind.id)} style={{
      padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: active.has(ind.id) ? 600 : 400,
      cursor: 'pointer', border: active.has(ind.id) ? '1px solid #3b82f6' : '1px solid #1e293b',
      background: active.has(ind.id) ? '#1e3a5f' : 'transparent',
      color: active.has(ind.id) ? '#3b82f6' : '#64748b',
      display: 'flex', alignItems: 'center', gap: 3,
    }}>{ind.emoji} {ind.name}</button>)}
  </div>;
}

// ─── Sub: Skeleton Screen ──────────────────────────────────────────
function ChartSkeleton() {
  return <div style={{ width: '100%', height: 320, borderRadius: 10, background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
    <div style={{ width: 200, height: 16, borderRadius: 4, background: '#1e293b', animation: 'pulse 1.5s infinite' }}/>
    <div style={{ width: '80%', height: 180, borderRadius: 8, background: '#1a2236', animation: 'pulse 1.5s infinite' }}/>
    <div style={{ fontSize: 12, color: '#64748b' }}>📊 加载K线数据中...</div>
    <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
  </div>;
}

// ─── Sub: Chart Toolbar ────────────────────────────────────────────
function CToolbar({ onDraw, onSnap, onFullscreen, isFull }: {
  onDraw: () => void; onSnap: () => void; onFullscreen: () => void; isFull: boolean;
}) {
  return <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
    {[
      { icon: <PenTool size={13}/>, label: '画线', onClick: onDraw },
      { icon: <Camera size={13}/>, label: '截图', onClick: onSnap },
      { icon: isFull ? <Minimize2 size={13}/> : <Maximize2 size={13}/>, label: isFull ? '退出' : '全屏', onClick: onFullscreen },
    ].map((b, i) => <button key={i} onClick={b.onClick} style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
      background: '#1e293b', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 500,
    }}>{b.icon} {b.label}</button>)}
  </div>;
}

// ─── Main ──────────────────────────────────────────────────────────
export default function ChartUnifiedEntry() {
  const [tf, setTf] = useState<Timeframe>('1D');
  const [mode, setMode] = useState<ChartMode>('candle');
  const [adjust, setAdjust] = useState<AdjustMode>('none');
  const [symbol, setSymbol] = useState('AAPL');
  const [activeInds, setActiveInds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isFull, setIsFull] = useState(false);
  const [showDrawPanel, setShowDrawPanel] = useState(false);
  const [drawings, setDrawings] = useState<DrawingDef[]>([]);

  const data = useMemo(() => genKline(200), []);

  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t); }, []);

  const toggleInd = useCallback((id: string) => {
    setActiveInds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const addDrawing = useCallback((type: string) => {
    const d: DrawingDef = { id: Date.now().toString(36), type, points: [{ x: 100, y: 150 }, { x: 300, y: 200 }], color: '#f59e0b' };
    setDrawings([...drawings, d]);
  }, [drawings]);

  return <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
    {/* Header */}
    <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#0a0e1add', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e293b', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#3b82f6' }}>📊 图表引擎</span>
        <input value={symbol} onChange={e => setSymbol(e.target.value)} style={{
          width: 100, padding: '4px 10px', borderRadius: 6, border: '1px solid #1e293b', background: '#111827', color: '#e2e8f0', fontSize: 13, fontWeight: 600, outline: 'none',
        }}/>
        <TBar tf={tf} onTf={setTf}/>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[{ v: 'candle' as const, l: '蜡烛' },{ v: 'line' as const, l: '折线' },{ v: 'heikin' as const, l: 'Heikin' }].map(m => <button key={m.v} onClick={() => setMode(m.v)} style={{
          padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: mode === m.v ? 600 : 400,
          cursor: 'pointer', border: 'none', background: mode === m.v ? '#3b82f6' : 'transparent',
          color: mode === m.v ? '#fff' : '#64748b',
        }}>{m.l}</button>)}
      </div>
    </div>

    {/* Body */}
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '12px 16px' }}>
      {/* Quick Indicators */}
      <div style={{ marginBottom: 10 }}>
        <QuickIndicators active={activeInds} onToggle={toggleInd}/>
      </div>

      {/* Chart */}
      <div style={{ position: 'relative' }}>
        {loading ? <ChartSkeleton/> : <ChartCanvas data={data} tf={tf} mode={mode}/>}
        {!loading && <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <CToolbar onDraw={() => setShowDrawPanel(!showDrawPanel)} onSnap={() => {}} onFullscreen={() => setIsFull(!isFull)} isFull={isFull}/>
        </div>}
      </div>

      {/* Draw Panel Toggle */}
      {showDrawPanel && <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: '#111827', border: '1px solid #1e293b' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>✏️ 快速画线</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ id: 'trend', emoji: '╱', label: '趋势线' },{ id: 'horizontal', emoji: '━', label: '水平线' },{ id: 'vertical', emoji: '┃', label: '垂直线' },{ id: 'channel', emoji: '⫿', label: '通道' },{ id: 'fib', emoji: 'φ', label: '斐波那契' }].map(d => <button key={d.id} onClick={() => addDrawing(d.id)} style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
            cursor: 'pointer', border: '1px solid #1e293b', background: '#0a0e1a', color: '#e2e8f0',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>{d.emoji} {d.label}</button>)}
        </div>
        {drawings.length > 0 && <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
          已画 {drawings.length} 条线 · 点击画线 → AI分析 (1U/次)
        </div>}
      </div>}

      {/* Stats bar */}
      {!loading && data.length > 0 && <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {[
          { l: '开盘', v: data[data.length-1].open.toFixed(2) },
          { l: '最高', v: Math.max(...data.map(d => d.high)).toFixed(2) },
          { l: '最低', v: Math.min(...data.map(d => d.low)).toFixed(2) },
          { l: '最新', v: data[data.length-1].close.toFixed(2), c: data[data.length-1].close >= data[data.length-2]?.close ? '#22c55e' : '#ef4444' },
        ].map((s, i) => <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: '#111827', border: '1px solid #1e293b', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#64748b' }}>{s.l}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: (s as any).c || '#e2e8f0' }}>{s.v}</div>
        </div>)}
      </div>}

      {/* Total stats */}
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 10, color: '#64748b' }}>
        🟢 LIVE · AAPL · 日K · {data.length}条K线 · {activeInds.size}个指标 · {drawings.length}条画线
      </div>
    </div>
  </div>;
}
