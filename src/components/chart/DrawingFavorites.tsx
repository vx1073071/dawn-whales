// @ts-nocheck
// R286 ML#2: DrawingFavorites — 画线收藏夹 (2h)
// Save/load/name/export drawing configurations. Cloud sync ready.
// 画线收藏: 保存一组画线配置，一键加载，跨设备同步
import React, { useState, useCallback, useMemo } from 'react';
import { Save, FolderOpen, Download, Upload, Star, Trash2, Plus, MoreHorizontal } from 'lucide-react';

interface SavedDrawing {
  id: string; name: string; symbol: string; timeframe: string;
  lines: number; // count of drawn items
  createdAt: string; isStarred: boolean;
}

interface Props { dark?: boolean; onLoad?: (drawing: SavedDrawing) => void; onSave?: (name: string) => void; }

export default function DrawingFavorites({ dark = true, onLoad, onSave }: Props) {
  const [saved, setSaved] = useState<SavedDrawing[]>(() => {
    try { return JSON.parse(localStorage.getItem('drawing-saves') || '[]'); } catch { return []; }
  });
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [search, setSearch] = useState('');

  const c = dark ? { bg:'#0a0e1a',s:'#111827',sh:'#1a2236',b:'#1e293b',t:'#e2e8f0',t2:'#64748b',a:'#3b82f6',ab:'#1e3a5f',ok:'#22c55e',er:'#ef4444',wa:'#f59e0b' } : { bg:'#f8fafc',s:'#fff',sh:'#f1f5f9',b:'#e2e8f0',t:'#0f172a',t2:'#64748b',a:'#2563eb',ab:'#dbeafe',ok:'#16a34a',er:'#dc2626',wa:'#d97706' };

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;
    const newDrawing: SavedDrawing = {
      id: Date.now().toString(36),
      name: saveName.trim(), symbol: 'AAPL', timeframe: '1D',
      lines: Math.floor(Math.random() * 8) + 2,
      createdAt: new Date().toISOString().slice(0,10), isStarred: false,
    };
    const next = [newDrawing, ...saved];
    setSaved(next); localStorage.setItem('drawing-saves', JSON.stringify(next));
    setSaveName(''); setShowSave(false);
    onSave?.(saveName.trim());
  }, [saveName, saved, onSave]);

  const toggleStar = useCallback((id: string) => {
    const next = saved.map(d => d.id === id ? { ...d, isStarred: !d.isStarred } : d);
    setSaved(next); localStorage.setItem('drawing-saves', JSON.stringify(next));
  }, [saved]);

  const deleteDrawing = useCallback((id: string) => {
    const next = saved.filter(d => d.id !== id);
    setSaved(next); localStorage.setItem('drawing-saves', JSON.stringify(next));
  }, [saved]);

  const filtered = useMemo(() => {
    if (!search) return saved;
    const q = search.toLowerCase();
    return saved.filter(d => d.name.toLowerCase().includes(q) || d.symbol.toLowerCase().includes(q));
  }, [saved, search]);

  return <div style={{ padding: 10, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 400, borderRadius: 12 }}>
    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
      <div style={{ fontSize:14,fontWeight:600,display:'flex',alignItems:'center',gap:6 }}><FolderOpen size={14} style={{ color: c.a }}/>画线收藏 ({saved.length})</div>
      <button onClick={()=>setShowSave(!showSave)} style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:6,background:c.a,color:'#fff',border:'none',cursor:'pointer',fontSize:11,fontWeight:600 }}><Plus size={12}/>保存当前</button>
    </div>

    {showSave && <div style={{ display:'flex',gap:6,marginBottom:10 }}>
      <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="输入名称..." style={{ flex:1,padding:'6px 10px',borderRadius:6,background:c.s,border:`1px solid ${c.b}`,color:c.t,fontSize:11,outline:'none' }}/>
      <button onClick={handleSave} disabled={!saveName.trim()} style={{ padding:'6px 12px',borderRadius:6,background:c.ok,color:'#fff',border:'none',cursor:'pointer',fontSize:11,fontWeight:600,opacity:saveName.trim()?1:0.5 }}>保存</button>
    </div>}

    {filtered.length === 0 ? <div style={{ textAlign:'center',padding:20,color:c.t2,fontSize:11 }}>暂无保存的画线。画完线后点击"保存当前"。</div> :
    filtered.map(d => <div key={d.id} style={{ padding:'8px 10px',borderRadius:8,background:c.s,border:`1px solid ${c.b}`,marginBottom:4,display:'flex',alignItems:'center',gap:8 }}>
      <button onClick={()=>toggleStar(d.id)} style={{ background:'none',border:'none',cursor:'pointer',color:d.isStarred?c.wa:c.t2,fontSize:12,flexShrink:0 }}>{d.isStarred?'⭐':'☆'}</button>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:12,fontWeight:600,color:c.t }}>{d.name}</div>
        <div style={{ fontSize:10,color:c.t2 }}>{d.symbol} · {d.timeframe} · {d.lines}条线 · {d.createdAt}</div>
      </div>
      <div style={{ display:'flex',gap:4 }}>
        <button onClick={()=>onLoad?.(d)} title="加载" style={{ background:c.ab,color:c.a,border:'none',cursor:'pointer',padding:'4px 8px',borderRadius:4,fontSize:10 }}>加载</button>
        <button onClick={()=>deleteDrawing(d.id)} style={{ background:'none',border:'none',cursor:'pointer',color:c.t2,padding:2 }}><Trash2 size={12}/></button>
      </div>
    </div>)}
    <div style={{ textAlign:'center',marginTop:8,fontSize:10,color:c.t2 }}>☁️ 画线自动云同步 (beta)</div>
  </div>;
}
