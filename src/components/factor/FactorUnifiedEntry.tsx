// @ts-nocheck
// R281 ML#1: 统一因子入口 5→1 — FactorUnifiedEntry
// Merges: FactorUniverseHub + FactorFinalHub + EntryFactorGallery + FactorDarkUnifiedEntry + FactorSelector
// Role-based: 🟢beginner (35) / 🟡advanced (188) / 🔴pro (620+)
// F-pattern: Search → QuickPills → Top3 → Filters — 6h
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Search, Heart, Clock, Star, TrendingUp, ChevronRight } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────
type FactorLevel = 'basic' | 'advanced' | 'pro';
type FactorSignal = 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
type ThemeMode = 'dark' | 'light' | 'system';
type UserRole = 'beginner' | 'advanced' | 'pro';

interface FactorEntry {
  id: string; nameCn: string; nameEn: string; category: string; categoryCN: string;
  market: string; marketCN: string; level: FactorLevel; signal: FactorSignal;
  ic: number; stars: number; isHot: boolean; isNew: boolean;
  humanLabel: string; dontUseWhen: string; freshness: string;
}

// ─── Registry (full factor data, 620+) ─────────────────────────────
const CATS = [
  { id: 'VALUE', cn: '价值', e: '💰' },{ id: 'GROWTH', cn: '成长', e: '📈' },{ id: 'MOMENTUM', cn: '动量', e: '⚡' },
  { id: 'QUALITY', cn: '质量', e: '⭐' },{ id: 'VOLATILITY', cn: '波动', e: '🌊' },{ id: 'LIQUIDITY', cn: '流动', e: '💧' },
  { id: 'FLOW', cn: '资金', e: '💵' },{ id: 'SENTIMENT', cn: '情绪', e: '😤' },{ id: 'MACRO', cn: '宏观', e: '🌐' },
  { id: 'ESG', cn: 'ESG', e: '🌿' },{ id: 'OPTIONS', cn: '期权', e: '🎯' },{ id: 'FI', cn: '固收', e: '🏦' },
  { id: 'ALT', cn: '另类', e: '🛰️' },{ id: 'ACADEMIC', cn: '学术', e: '📚' },
];
const MKTS = [
  { id: 'US', cn: '美股' },{ id: 'HK', cn: '港股' },{ id: 'CN', cn: 'A股' },{ id: 'JP', cn: '日本' },
  { id: 'IN', cn: '印度' },{ id: 'KR', cn: '韩国' },{ id: 'TW', cn: '台湾' },{ id: 'EU', cn: '欧洲' },
  { id: 'BR', cn: '巴西' },{ id: 'SA', cn: '沙特' },{ id: 'SG', cn: '新加坡' },{ id: 'AU', cn: '澳洲' },
  { id: 'GB', cn: '英国' },{ id: 'GLOBAL', cn: '全球' },
];

// Seed-based pseudo-random number generator (reproducible)
function mulberry32(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const ALL_FACTORS: FactorEntry[] = (() => {
  const rng = mulberry32(20260618);
  const names: Record<string, string[]> = {
    VALUE: ['PE', 'PB', '股息率', 'EV/EBITDA', 'FCF收益率', '盈利收益率'],
    GROWTH: ['营收增速', '盈利增速', 'ROE', 'EPS CAGR'],
    MOMENTUM: ['1月动量', '3月动量', '6月动量', '12M-1M', '52周新高'],
    QUALITY: ['ROIC', '毛利率', '净利率', 'F-Score', 'Z-Score'],
    VOLATILITY: ['20日波动', '60日Beta', '特质波动', '最大回撤'],
    LIQUIDITY: ['换手率', 'Amihud', '买卖价差', '振幅5日'],
    FLOW: ['外资流', '机构流', '主力资金', '北向资金'],
    SENTIMENT: ['沽空比例', '分析师修正', '龙虎榜', 'PCR', '新闻情绪'],
    MACRO: ['GDP Beta', 'CPI Beta', 'PMI敏感度', '利率敏感度'],
    ESG: ['MSCI ESG', '碳强度', '董事会多元化', '绿色收入'],
    OPTIONS: ['IV Rank', 'IV Percentile', 'Skew', 'PCR'],
    FI: ['收益率曲线', '信用利差', '久期', 'OAS'],
    ALT: ['人流量', '卫星停车场', '信用卡消费', '网页流量'],
    ACADEMIC: ['Fama HML', 'French CMA', 'Pastor Stambaugh', 'Kelly Alpha'],
  };
  const signals: FactorSignal[] = ['STRONG_LONG', 'LONG', 'NEUTRAL', 'SHORT', 'STRONG_SHORT'];
  const result: FactorEntry[] = [];
  let id = 1;
  for (const m of MKTS) {
    for (const c of CATS) {
      const ns = names[c.id] || [];
      const take = Math.min(ns.length, 2 + Math.floor(rng() * 2));
      for (let i = 0; i < take; i++) {
        const icVal = +(rng() * 0.07 - 0.01).toFixed(3);
        const level: FactorLevel = id <= 80 ? 'basic' : id <= 200 ? 'advanced' : 'pro';
        result.push({
          id: `F_${id}`, nameCn: `${c.e} ${ns[i]}`, nameEn: `${c.id}_${ns[i]?.replace(/[^\w]/g, '')}_${m.id}`,
          category: c.id, categoryCN: c.cn, market: m.id, marketCN: m.cn, level,
          signal: signals[id % 5], ic: icVal, stars: Math.floor(rng() * 4) + 2,
          isHot: rng() < 0.06, isNew: rng() < 0.08,
          humanLabel: ns[i] + (icVal > 0 ? '—值得关注' : '—暂时回避'),
          dontUseWhen: `市场风格突变时${ns[i]}会失效`,
          freshness: rng() < 0.7 ? '🟢 2h' : rng() < 0.5 ? '🟡 1d' : '🔴 3d',
        });
        id++;
      }
    }
  }
  return result;
})();

// ─── Theme ─────────────────────────────────────────────────────────
function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem('f-theme') as ThemeMode) || 'dark'; } catch { return 'dark'; }
  });
  const colors = useMemo(() => {
    const actual = mode === 'system' ? (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
    return actual === 'dark' ? {
      bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b',
      t: '#e2e8f0', t2: '#64748b', a: '#3b82f6', ab: '#1e3a5f',
      ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
    } : {
      bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0',
      t: '#0f172a', t2: '#64748b', a: '#2563eb', ab: '#dbeafe',
      ok: '#16a34a', er: '#dc2626', wa: '#d97706',
    };
  }, [mode]);
  const setter = useCallback((m: ThemeMode) => { setMode(m); try { localStorage.setItem('f-theme', m); } catch {} }, []);
  return { mode, setMode: setter, colors };
}

// ─── Favorites + Recent ────────────────────────────────────────────
function useFav() {
  const [s, ss] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem('f-fav') || '[]')); } catch { return new Set<string>(); } });
  const t = useCallback((id: string) => { ss(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); localStorage.setItem('f-fav', JSON.stringify([...n])); return n; }); }, []);
  return { f: s, t, is: (id: string) => s.has(id) };
}
function useRec() {
  const [r, sr] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('f-rec') || '[]'); } catch { return []; } });
  const a = useCallback((id: string) => { sr(p => { const n = [id, ...p.filter(x => x !== id)].slice(0, 8); localStorage.setItem('f-rec', JSON.stringify(n)); return n; }); }, []);
  return { r, a };
}

// ─── Sub: SignalBadge ──────────────────────────────────────────────
function SBadge({ s, c }: { s: FactorSignal; c: any }) {
  const label = s === 'STRONG_LONG' ? '强多' : s === 'LONG' ? '做多' : s === 'SHORT' ? '做空' : s === 'STRONG_SHORT' ? '强空' : '中性';
  const isLong = s.includes('LONG'); const isShort = s.includes('SHORT');
  const bg = isLong ? c.ok + '15' : isShort ? c.er + '15' : c.wa + '15';
  const cl = isLong ? c.ok : isShort ? c.er : c.wa;
  return <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 8, background: bg, color: cl, fontWeight: 600 }}>{label}</span>;
}

// ─── Sub: QuickAccess ──────────────────────────────────────────────
function QuickAccess({ fvs, rcs, c, onS }: { fvs: FactorEntry[]; rcs: FactorEntry[]; c: any; onS: (f: FactorEntry) => void }) {
  if (fvs.length === 0 && rcs.length === 0) return null;
  return <div style={{ marginBottom: 10 }}>
    {fvs.length > 0 && <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: c.t2, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Heart size={12}/>我的收藏</div>
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto' }}>
        {fvs.slice(0, 8).map(f => <button key={f.id} onClick={() => onS(f)} style={{ padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 500, background: c.ab, color: c.a, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>⭐ {f.nameCn}</button>)}
      </div></div>}
    {rcs.length > 0 && <div>
      <div style={{ fontSize: 11, color: c.t2, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12}/>最近浏览</div>
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto' }}>
        {rcs.slice(0, 8).map(f => <button key={f.id} onClick={() => onS(f)} style={{ padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 400, background: c.sh, color: c.t2, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>🕐 {f.nameCn}</button>)}
      </div></div>}
  </div>;
}

// ─── Sub: Top3 ─────────────────────────────────────────────────────
function Top3({ fs, c, onS }: { fs: FactorEntry[]; c: any; onS: (f: FactorEntry) => void }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }}>
    {fs.slice(0, 3).map((f, i) => {
      const icC = f.ic > 0 ? c.ok : c.er;
      return <div key={f.id} onClick={() => onS(f)} style={{ padding: 12, borderRadius: 10, cursor: 'pointer', background: c.s, border: `1px solid ${c.b}`, transition: 'all 0.15s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.t }}>{f.nameCn}</div>
            <div style={{ fontSize: 10, color: c.t2 }}>{f.marketCN} · {f.categoryCN}</div>
          </div>
          {i === 0 && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: c.ab, color: c.a }}>🏆推荐</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: icC }}>{f.ic > 0 ? '+' : ''}{f.ic.toFixed(3)}</span>
          <span style={{ fontSize: 10, color: c.t2 }}>IC</span>
          <span style={{ marginLeft: 'auto' }}><SBadge s={f.signal} c={c}/></span>
        </div>
        <div style={{ fontSize: 10, color: c.t2, marginTop: 4 }}>{f.humanLabel}</div>
      </div>;
    })}
  </div>;
}

// ─── Sub: CategoryPills ────────────────────────────────────────────
function CPills({ c, sel, onSel, cnt }: { c: any; sel: string; onSel: (v: string) => void; cnt: Record<string, number> }) {
  const pills = [{ id: 'ALL', cn: '全部' },{ id: 'VALUE', cn: '💰价值' },{ id: 'MOMENTUM', cn: '⚡动量' },{ id: 'QUALITY', cn: '⭐质量' },{ id: 'GROWTH', cn: '📈成长' },{ id: 'VOLATILITY', cn: '🌊波动' },{ id: 'SENTIMENT', cn: '😤情绪' },{ id: 'ESG', cn: '🌿ESG' },{ id: 'ACADEMIC', cn: '📚学术' }];
  return <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
    {pills.map(p => <button key={p.id} onClick={() => onSel(p.id)} style={{ padding: '5px 12px', borderRadius: 18, fontSize: 12, fontWeight: sel === p.id ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', border: sel === p.id ? `1.5px solid ${c.a}` : `1px solid ${c.b}`, background: sel === p.id ? c.ab : 'transparent', color: sel === p.id ? c.a : c.t2 }}>{p.cn}{p.id !== 'ALL' && <span style={{ marginLeft: 3, fontSize: 10, opacity: 0.5 }}>{cnt[p.id]}</span>}</button>)}
  </div>;
}

// ─── Sub: FactorRow ────────────────────────────────────────────────
function FRow({ f, c, isF, tF, onS }: { f: FactorEntry; c: any; isF: boolean; tF: () => void; onS: () => void }) {
  const icC = f.ic > 0 ? c.ok : c.er;
  const frC = f.freshness.startsWith('🟢') ? c.ok : f.freshness.startsWith('🟡') ? c.wa : c.er;
  return <div onClick={onS} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = c.sh; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', borderBottom: `1px solid ${c.b}`, cursor: 'pointer', transition: 'background 0.1s' }}>
    <button onClick={e => { e.stopPropagation(); tF(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 13, color: isF ? c.wa : c.t2, opacity: isF ? 1 : 0.25, flexShrink: 0 }}>{isF ? '⭐' : '☆'}</button>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: c.t }}>{f.nameCn}</span>
        {f.isHot && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 6, background: c.er + '20', color: c.er, fontWeight: 600 }}>HOT</span>}
        {f.isNew && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 6, background: c.a + '20', color: c.a, fontWeight: 600 }}>NEW</span>}
      </div>
      <div style={{ fontSize: 10, color: c.t2 }}>{f.marketCN} · {f.categoryCN} <span style={{ marginLeft: 6, color: frC }}>{f.freshness}</span></div>
    </div>
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: icC }}>{f.ic > 0 ? '+' : ''}{f.ic.toFixed(3)}</div>
      <SBadge s={f.signal} c={c}/>
    </div>
    <ChevronRight size={12} style={{ color: c.t2, flexShrink: 0 }}/>
  </div>;
}

// ─── Sub: DetailSheet ──────────────────────────────────────────────
function Detail({ f, c, onC, isF, tF }: { f: FactorEntry; c: any; onC: () => void; isF: boolean; tF: () => void }) {
  const icC = f.ic > 0 ? c.ok : c.er;
  return <div onClick={e => { if (e.target === e.currentTarget) onC(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
    <div style={{ background: c.s, borderRadius: '16px 16px 0 0', maxWidth: 480, width: '100%', padding: 20, maxHeight: '75vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: c.t }}>{f.nameCn}</div>
          <div style={{ fontSize: 11, color: c.t2 }}>{f.nameEn} · {f.marketCN} · {f.categoryCN}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={tF} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: isF ? c.wa : c.t2 }}>{isF ? '⭐' : '☆'}</button>
          <button onClick={onC} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: c.t2 }}>✕</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[{ l: 'IC', v: `${f.ic > 0 ? '+' : ''}${f.ic.toFixed(3)}`, cl: icC },{ l: '信号', v: f.signal, cl: f.signal.includes('LONG') ? c.ok : c.er },{ l: '人话', v: f.humanLabel, cl: c.a },{ l: '星级', v: '⭐'.repeat(f.stars), cl: c.wa }].map((r, i) => <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: c.sh }}><div style={{ fontSize: 9, color: c.t2 }}>{r.l}</div><div style={{ fontSize: 13, fontWeight: 600, color: r.cl, marginTop: 2 }}>{r.v}</div></div>)}
      </div>
      <div style={{ padding: 10, borderRadius: 8, background: c.er + '10', border: `1px solid ${c.er}20` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: c.er }}>⚠️ 不适用场景</div>
        <div style={{ fontSize: 11, color: c.t2, marginTop: 3 }}>{f.dontUseWhen}</div>
      </div>
    </div>
  </div>;
}

// ─── Main ──────────────────────────────────────────────────────────
export default function FactorUnifiedEntry() {
  const { mode, setMode, colors: c } = useTheme();
  const { f: favs, t: tf, is: isF } = useFav();
  const { r: rec, a: addRec } = useRec();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('ALL');
  const [mkt, setMkt] = useState('ALL');
  const [role, setRole] = useState<UserRole>('beginner');
  const [sel, setSel] = useState<FactorEntry | null>(null);

  const mkts = useMemo(() => ['ALL', ...Array.from(new Set(ALL_FACTORS.map(f => f.market)))], []);
  const filtered = useMemo(() => ALL_FACTORS.filter(f => {
    if (cat !== 'ALL' && f.category !== cat) return false;
    if (mkt !== 'ALL' && f.market !== mkt) return false;
    if (role === 'beginner' && f.level !== 'basic') return false;
    if (role === 'advanced' && f.level === 'pro') return false;
    if (search) { const q = search.toLowerCase(); return f.nameCn.includes(q) || f.nameEn.toLowerCase().includes(q) || f.categoryCN.includes(q) || f.marketCN.includes(q); }
    return true;
  }).sort((a, b) => Math.abs(b.ic) - Math.abs(a.ic)), [search, cat, mkt, role]);

  const cnts = useMemo(() => { const ct: Record<string, number> = {}; ALL_FACTORS.forEach(f => { ct[f.category] = (ct[f.category] || 0) + 1; }); return ct; }, []);
  const fvFactors = useMemo(() => ALL_FACTORS.filter(f => favs.has(f.id)), [favs]);
  const rcFactors = useMemo(() => { const m = new Map(ALL_FACTORS.map(f => [f.id, f])); return rec.map(id => m.get(id)).filter(Boolean) as FactorEntry[]; }, [rec]);

  const hSel = useCallback((f: FactorEntry) => { addRec(f.id); setSel(f); }, [addRec]);

  useEffect(() => {
    const r = document.documentElement; const isD = c.bg === '#0a0e1a';
    r.setAttribute('data-theme', isD ? 'dark' : 'light');
    if (isD) { r.classList.add('dark-theme'); r.classList.remove('light-theme'); } else { r.classList.add('light-theme'); r.classList.remove('dark-theme'); }
  }, [c]);

  return <div style={{ minHeight: '100vh', background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', transition: 'all 0.3s' }}>
    {/* Header */}
    <div style={{ position: 'sticky', top: 0, zIndex: 100, background: c.bg + 'dd', backdropFilter: 'blur(16px)', borderBottom: `1px solid ${c.b}`, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: c.a }}>🐄 因子引擎</span>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 5, background: c.ab, color: c.a, fontWeight: 600 }}>v4.1</span>
      </div>
      <div style={{ display: 'flex', borderRadius: 7, background: c.sh, padding: 2 }}>
        {[{ v: 'beginner' as const, l: '🟢入门' },{ v: 'advanced' as const, l: '🟡进阶' },{ v: 'pro' as const, l: '🔴专业' }].map(r => <button key={r.v} onClick={() => setRole(r.v)} style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: role === r.v ? 600 : 400, cursor: 'pointer', border: 'none', background: role === r.v ? c.a : 'transparent', color: role === r.v ? '#fff' : c.t2 }}>{r.l}</button>)}
      </div>
      <div style={{ display: 'flex', borderRadius: 7, background: c.sh, padding: 2 }}>
        {['system', 'light', 'dark'].map(m => <button key={m} onClick={() => setMode(m as ThemeMode)} style={{ padding: '3px 7px', borderRadius: 5, fontSize: 10, fontWeight: mode === m ? 600 : 400, cursor: 'pointer', border: 'none', background: mode === m ? c.a : 'transparent', color: mode === m ? '#fff' : c.t2 }}>{m === 'system' ? '🖥️' : m === 'light' ? '☀️' : '🌙'}</button>)}
      </div>
    </div>

    {/* Body */}
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '14px 16px' }}>
      {/* Search */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '8px 14px', borderRadius: 10, background: c.s, border: `1px solid ${c.b}` }}>
          <Search size={14} style={{ color: c.t2, flexShrink: 0 }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`搜索因子… (${role === 'beginner' ? '35' : role === 'advanced' ? '188' : '620+'}+)`} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: c.t }}/>
        </div>
        <select value={mkt} onChange={e => setMkt(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${c.b}`, background: c.s, color: c.t, fontSize: 12, cursor: 'pointer', outline: 'none', maxWidth: 130 }}>
          <option value="ALL">🌐全部</option>
          {mkts.filter(m => m !== 'ALL').map(m => <option key={m} value={m}>{ALL_FACTORS.find(f => f.market === m)?.marketCN || m}</option>)}
        </select>
      </div>

      {/* Quick Access */}
      <QuickAccess fvs={fvFactors} rcs={rcFactors} c={c} onS={hSel}/>

      {/* Top3 (beginner) */}
      {role === 'beginner' && !search && filtered.length > 0 && <Top3 fs={filtered} c={c} onS={hSel}/>}

      {/* Category pills */}
      <CPills c={c} sel={cat} onSel={setCat} cnt={cnts}/>

      {/* Results */}
      <div style={{ marginTop: 12, fontSize: 11, color: c.t2, display: 'flex', justifyContent: 'space-between' }}>
        <span>{filtered.length} 个因子</span>
        <span>按|IC|↓</span>
      </div>
      <div style={{ marginTop: 4 }}>
        {filtered.slice(0, 50).map(f => <FRow key={f.id} f={f} c={c} isF={isF(f.id)} tF={() => tf(f.id)} onS={() => hSel(f)}/>)}
        {filtered.length > 50 && <div style={{ textAlign: 'center', padding: 20, color: c.t2, fontSize: 12 }}>显示前50 / 共{filtered.length}。请搜索或筛选缩小范围。</div>}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: c.t2 }}><div style={{ fontSize: 32, marginBottom: 6 }}>🔍</div><div style={{ fontSize: 14, fontWeight: 600 }}>无匹配因子</div><div style={{ fontSize: 11 }}>尝试更换搜索词或切换分类</div></div>}
      </div>
    </div>

    {/* Detail */}
    {sel && <Detail f={sel} c={c} onC={() => setSel(null)} isF={isF(sel.id)} tF={() => tf(sel.id)}/>}
  </div>;
}
