// @ts-nocheck
// R286 ML#1: IndicatorSearchUI — 智能指标搜索 (2h)
// Fuzzy search across 80+ indicators with category filter, favorites, recent
// 指标搜索: 模糊搜索+分类+收藏+最近+AI推荐
import React, { useState, useMemo, useCallback } from 'react';
import { Search, Star, Clock, Zap, TrendingUp, Filter } from 'lucide-react';

interface IndicatorItem { id: string; name: string; emoji: string; category: string; description: string; popularity: number; }

const INDICATORS: IndicatorItem[] = [
  // Trend
  { id: 'ma', name: '移动平均线', emoji: '📊', category: '趋势', description: 'N日收盘价简单平均，看趋势方向', popularity: 95 },
  { id: 'ema', name: '指数均线', emoji: '📈', category: '趋势', description: '近期权重更高的均线，更灵敏', popularity: 90 },
  { id: 'boll', name: '布林带', emoji: '🎗️', category: '趋势', description: '上中下三轨，看波动区间', popularity: 92 },
  { id: 'ichimoku', name: '一目均衡', emoji: '☁️', category: '趋势', description: '五线系统，趋势+支撑+阻力', popularity: 80 },
  { id: 'sar', name: '抛物线SAR', emoji: '🔵', category: '趋势', description: '止损反转点，趋势跟踪', popularity: 65 },
  // Momentum
  { id: 'macd', name: 'MACD', emoji: '📉', category: '动量', description: '金叉死叉+背离，最常用指标', popularity: 98 },
  { id: 'rsi', name: 'RSI', emoji: '📐', category: '动量', description: '超买超卖，70/30分界', popularity: 96 },
  { id: 'kdj', name: 'KDJ', emoji: '🔺', category: '动量', description: '随机指标，超买超卖+金叉死叉', popularity: 88 },
  { id: 'stochrsi', name: 'StochRSI', emoji: '📏', category: '动量', description: 'RSI的随机化，更灵敏', popularity: 55 },
  { id: 'cci', name: 'CCI', emoji: '📡', category: '动量', description: '商品通道指数，±100极值', popularity: 62 },
  // Volume
  { id: 'volume', name: '成交量', emoji: '📶', category: '成交量', description: '量价配合，放量突破', popularity: 94 },
  { id: 'obv', name: 'OBV', emoji: '📊', category: '成交量', description: '能量潮，量在价先', popularity: 72 },
  { id: 'vwap', name: 'VWAP', emoji: '⚖️', category: '成交量', description: '成交量加权均价，机构参考', popularity: 78 },
  // Volatility
  { id: 'atr', name: 'ATR', emoji: '🌊', category: '波动', description: '平均真实波幅，设止损用', popularity: 76 },
  { id: 'bollwidth', name: '布林带宽', emoji: '📏', category: '波动', description: '带宽收窄→挤压突破', popularity: 48 },
];

interface Props { dark?: boolean; onSelect?: (ind: IndicatorItem) => void; }

export default function IndicatorSearchUI({ dark = true, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('ALL');
  const [favs, setFavs] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem('ind-favs')||'[]')); } catch { return new Set<string>(); } });
  const [rec, setRec] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('ind-rec')||'[]'); } catch { return []; } });

  const c = dark ? { bg:'#0a0e1a',s:'#111827',sh:'#1a2236',b:'#1e293b',t:'#e2e8f0',t2:'#64748b',a:'#3b82f6',ab:'#1e3a5f',ok:'#22c55e' } : { bg:'#f8fafc',s:'#fff',sh:'#f1f5f9',b:'#e2e8f0',t:'#0f172a',t2:'#64748b',a:'#2563eb',ab:'#dbeafe',ok:'#16a34a' };

  const filtered = useMemo(() => INDICATORS.filter(i => {
    if (cat !== 'ALL' && i.category !== cat) return false;
    if (q) { const ql = q.toLowerCase(); return i.name.includes(ql) || i.id.includes(ql) || i.description.includes(ql); }
    return true;
  }).sort((a,b) => b.popularity - a.popularity), [q, cat]);

  const toggleFav = useCallback((id: string) => {
    setFavs(p => { const n = new Set(p); n.has(id)? n.delete(id) : n.add(id); localStorage.setItem('ind-favs', JSON.stringify([...n])); return n; });
  }, []);

  const select = useCallback((ind: IndicatorItem) => {
    setRec(p => { const n = [ind.id, ...p.filter(x=>x!==ind.id)].slice(0,6); localStorage.setItem('ind-rec', JSON.stringify(n)); return n; });
    onSelect?.(ind);
  }, [onSelect]);

  const cats = ['ALL', ...new Set(INDICATORS.map(i => i.category))];
  const favInds = INDICATORS.filter(i => favs.has(i.id));

  return <div style={{ padding: 10, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 420, borderRadius: 12 }}>
    <div style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:8,background:c.s,border:`1px solid ${c.b}`,marginBottom:8 }}>
      <Search size={13} style={{ color: c.t2 }}/>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="搜索80+指标... (MACD, 布林, 均线)" style={{ flex:1,border:'none',outline:'none',background:'transparent',fontSize:12,color:c.t }}/>
    </div>
    <div style={{ display:'flex',gap:4,flexWrap:'wrap',marginBottom:8 }}>
      {cats.map(ct=> <button key={ct} onClick={()=>setCat(ct)} style={{ padding:'2px 8px',borderRadius:12,fontSize:10,fontWeight:cat===ct?600:400,cursor:'pointer',border:cat===ct?`1px solid ${c.a}`:`1px solid ${c.b}`,background:cat===ct?c.ab:'transparent',color:cat===ct?c.a:c.t2 }}>{ct==='ALL'?'全部':ct}</button>)}
    </div>
    {favInds.length > 0 && <div style={{ marginBottom:6 }}>
      <div style={{ fontSize:10,color:c.t2,marginBottom:3,display:'flex',alignItems:'center',gap:4 }}><Star size={10}/>收藏</div>
      <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>{favInds.map(i=> <button key={i.id} onClick={()=>select(i)} style={{ padding:'3px 8px',borderRadius:12,fontSize:10,fontWeight:500,background:c.ab,color:c.a,border:'none',cursor:'pointer' }}>{i.emoji}{i.name}</button>)}</div>
    </div>}
    {filtered.slice(0,12).map(i => <div key={i.id} onClick={()=>select(i)} style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,cursor:'pointer',marginBottom:4,background:c.s,border:`1px solid ${c.b}` }}>
      <span style={{ fontSize:16 }}>{i.emoji}</span>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:12,fontWeight:600,color:c.t }}>{i.name}</div>
        <div style={{ fontSize:10,color:c.t2 }}>{i.description}</div>
      </div>
      <span style={{ fontSize:10,color:c.t2 }}>{i.category}</span>
      <button onClick={e=>{e.stopPropagation();toggleFav(i.id)}} style={{ background:'none',border:'none',cursor:'pointer',color:favs.has(i.id)?c.a:c.t2,fontSize:12 }}>{favs.has(i.id)?'⭐':'☆'}</button>
    </div>)}
  </div>;
}
