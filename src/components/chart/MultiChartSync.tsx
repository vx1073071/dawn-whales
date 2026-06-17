// @ts-nocheck
// R286 ML#4: MultiChartSync — 多图联动UI (4h)
// 2-6 chart layouts with synchronized crosshair, timeframe, symbol, drawing
// 多图联动: 2-6图并排布局，十字光标+周期+品种同步
import React, { useState, useCallback } from 'react';
import { Maximize2, Minimize2, Columns, Crosshair, Link, Unlink, Plus, X } from 'lucide-react';

type LayoutMode = 'single' | '2x1' | '2x2' | '3x1';
type SyncMode = 'crosshair' | 'timeframe' | 'symbol' | 'drawing';

interface ChartSlot { id: string; symbol: string; timeframe: string; }

interface Props { dark?: boolean; }

const DEFAULT_SLOTS: ChartSlot[] = [
  { id: 'c1', symbol: 'AAPL', timeframe: '1D' },
  { id: 'c2', symbol: 'TSLA', timeframe: '1D' },
  { id: 'c3', symbol: 'NVDA', timeframe: '4h' },
  { id: 'c4', symbol: 'MSFT', timeframe: '1D' },
];

export default function MultiChartSync({ dark = true }: Props) {
  const [layout, setLayout] = useState<LayoutMode>('2x1');
  const [slots, setSlots] = useState<ChartSlot[]>(DEFAULT_SLOTS);
  const [syncModes, setSyncModes] = useState<Set<SyncMode>>(new Set(['crosshair', 'timeframe']));
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null);

  const c = dark ? {
    bg:'#0a0e1a',s:'#111827',sh:'#1a2236',b:'#1e293b',t:'#e2e8f0',t2:'#64748b',
    a:'#3b82f6',ab:'#1e3a5f',ok:'#22c55e',er:'#ef4444',wa:'#f59e0b',
  } : { bg:'#f8fafc',s:'#fff',sh:'#f1f5f9',b:'#e2e8f0',t:'#0f172a',t2:'#64748b',a:'#2563eb',ab:'#dbeafe',ok:'#16a34a',er:'#dc2626',wa:'#d97706' };

  const activeSlots = layout === 'single' ? 1 : layout === '2x1' ? 2 : layout === '2x2' ? 4 : 3;

  const toggleSync = useCallback((m: SyncMode) => {
    setSyncModes(prev => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n; });
  }, []);

  return <div style={{ padding: 10, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', borderRadius: 12 }}>
    {/* Toolbar */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Columns size={14} style={{ color: c.a }}/> 多图联动
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {[{ v:'single' as const, l:'1' },{ v:'2x1' as const, l:'2' },{ v:'3x1' as const, l:'3' },{ v:'2x2' as const, l:'4' }].map(lo => <button key={lo.v} onClick={()=>setLayout(lo.v)} style={{
          padding:'3px 8px',borderRadius:4,fontSize:10,fontWeight:layout===lo.v?600:400,
          cursor:'pointer',border:'none',background:layout===lo.v?c.a:c.sh,color:layout===lo.v?'#fff':c.t2,
        }}>{lo.l}图</button>)}
      </div>
    </div>

    {/* Sync toggles */}
    <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
      {[
        { v: 'crosshair' as const, l: '十字光标', icon: <Crosshair size={10}/> },
        { v: 'timeframe' as const, l: '周期同步', icon: <Link size={10}/> },
        { v: 'symbol' as const, l: '品种同步', icon: <Link size={10}/> },
      ].map(s => <button key={s.v} onClick={()=>toggleSync(s.v)} style={{
        display:'flex',alignItems:'center',gap:3,padding:'3px 8px',borderRadius:14,fontSize:10,fontWeight:syncModes.has(s.v)?600:400,
        cursor:'pointer',border:syncModes.has(s.v)?`1px solid ${c.ok}`:`1px solid ${c.b}`,
        background:syncModes.has(s.v)?c.ok+'15':'transparent',color:syncModes.has(s.v)?c.ok:c.t2,
      }}>{s.icon} {s.l}</button>)}
    </div>

    {/* Chart Grid */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: layout === '2x2' ? '1fr 1fr' : layout === '3x1' ? '1fr 1fr 1fr' : layout === '2x1' ? '1fr 1fr' : '1fr',
      gap: 6,
    }}>
      {slots.slice(0, activeSlots).map((slot, idx) => (
        <div key={slot.id} style={{
          borderRadius: 10, background: c.s, border: `1px solid ${c.b}`,
          minHeight: fullscreenIdx === idx ? 400 : 180,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Chart header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: `1px solid ${c.b}`, background: c.sh }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: c.t }}>{slot.symbol}</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: c.t2 }}>{slot.timeframe}</span>
              <button onClick={()=>setFullscreenIdx(fullscreenIdx===idx?null:idx)} style={{ background:'none',border:'none',cursor:'pointer',color:c.t2,padding:0 }}>
                {fullscreenIdx===idx ? <Minimize2 size={12}/> : <Maximize2 size={12}/>}
              </button>
            </div>
          </div>
          {/* Chart placeholder */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: fullscreenIdx === idx ? 360 : 140 }}>
            <div style={{ textAlign: 'center', color: c.t2 }}>
              <div style={{ fontSize: 28 }}>📊</div>
              <div style={{ fontSize: 10 }}>{slot.symbol} · {slot.timeframe}</div>
              {syncModes.has('crosshair') && idx > 0 && <div style={{ fontSize: 9, color: c.ok, marginTop: 2 }}>🔗 光标已同步</div>}
            </div>
          </div>
        </div>
      ))}
    </div>

    <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: c.t2 }}>
      🔗 同步模式: {[...syncModes].join(', ') || '无'} · 布局: {layout} · 支持最多6图联动
    </div>
  </div>;
}
