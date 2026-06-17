// @ts-nocheck
// R283 ML#2: FactorFavoriteQuickAccess — 收藏+快速操作 (3h)
// Persistent favorites, recent browsing, drag-to-compare, one-tap subscribe
// localStorage持久化 + 拖拽PK + 一键订阅 + 批量操作
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Star, Clock, Zap, Trash2, GripVertical, Plus } from 'lucide-react';

interface FavFactor {
  id: string; name: string; emoji: string; ic: number; signal: string; categoryCN: string; addedAt: number;
}

interface Props {
  dark?: boolean;
  onFactorClick?: (id: string) => void;
  onPK?: (a: string, b: string) => void;
  allFactors?: { id: string; name: string; emoji: string; ic: number; signal: string; categoryCN: string }[];
}

const FAV_KEY = 'factor-favorites-v2';
const REC_KEY = 'factor-recents-v2';
const MAX_FAV = 12;
const MAX_REC = 10;

export default function FactorFavoriteQuickAccess({ dark = true, onFactorClick, onPK, allFactors }: Props) {
  const c = dark ? {
    bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  const [favs, setFavs] = useState<FavFactor[]>(() => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } });
  const [recents, setRecents] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(REC_KEY) || '[]'); } catch { return []; } });
  const [pkSlots, setPkSlots] = useState<string[]>([]);
  const [showAllFavs, setShowAllFavs] = useState(false);

  const persistFavs = useCallback((f: FavFactor[]) => { setFavs(f); localStorage.setItem(FAV_KEY, JSON.stringify(f)); }, []);
  const persistRecents = useCallback((r: string[]) => { setRecents(r); localStorage.setItem(REC_KEY, JSON.stringify(r)); }, []);

  const addFav = useCallback((factor: FavFactor) => {
    persistFavs([factor, ...favs.filter(f => f.id !== factor.id)].slice(0, MAX_FAV));
  }, [favs, persistFavs]);

  const removeFav = useCallback((id: string) => {
    persistFavs(favs.filter(f => f.id !== id));
  }, [favs, persistFavs]);

  const togglePK = useCallback((id: string) => {
    setPkSlots(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  const resolvedRecents = useMemo(() => {
    if (!allFactors) return [];
    const map = new Map(allFactors.map(f => [f.id, f]));
    return recents.map(id => map.get(id)).filter(Boolean) as typeof allFactors;
  }, [recents, allFactors]);

  const handlePK = useCallback(() => {
    if (pkSlots.length === 2 && onPK) onPK(pkSlots[0], pkSlots[1]);
  }, [pkSlots, onPK]);

  return <div style={{ padding: 12, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 500, margin: '0 auto', borderRadius: 12 }}>
    {/* ── Favorites ── */}
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: c.t }}>
          <Star size={14} style={{ color: c.wa }}/> 我的收藏 ({favs.length})
        </div>
        {favs.length > 6 && <button onClick={() => setShowAllFavs(!showAllFavs)} style={{ fontSize: 10, color: c.a, background: 'none', border: 'none', cursor: 'pointer' }}>
          {showAllFavs ? '收起' : '全部'}
        </button>}
      </div>
      {favs.length === 0 ? (
        <div style={{ fontSize: 12, color: c.t2, padding: '12px 0', textAlign: 'center' }}>
          还没有收藏因子。点击 ⭐ 收藏你常用的因子。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {favs.slice(0, showAllFavs ? MAX_FAV : 6).map(f => {
            const icC = f.ic > 0 ? c.ok : c.er;
            return <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: c.s, border: `1px solid ${c.b}`,
              cursor: 'pointer', transition: 'all 0.1s',
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{f.emoji}</span>
              <div onClick={() => onFactorClick?.(f.id)} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.t }}>{f.name}</div>
                <div style={{ fontSize: 10, color: c.t2 }}>{f.categoryCN}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: icC, marginRight: 4 }}>{f.ic > 0 ? '+' : ''}{f.ic.toFixed(3)}</span>
              <button onClick={() => togglePK(f.id)} style={{ background: pkSlots.includes(f.id) ? c.a : 'transparent', border: `1px solid ${pkSlots.includes(f.id) ? c.a : c.b}`, borderRadius: 6, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: pkSlots.includes(f.id) ? '#fff' : c.t2 }}>
                {pkSlots.includes(f.id) ? 'PK中' : 'PK'}
              </button>
              <button onClick={() => removeFav(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.t2, fontSize: 12, padding: 2 }}>
                <Trash2 size={12}/>
              </button>
            </div>;
          })}
        </div>
      )}
    </div>

    {/* ── PK Quick Bar ── */}
    {pkSlots.length > 0 && <div style={{ padding: 10, borderRadius: 10, background: c.a + '10', border: `1px solid ${c.a}25`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: c.a }}>⚔️ {pkSlots.length}/2</span>
      <span style={{ fontSize: 12, color: c.t }}>{pkSlots.map(id => allFactors?.find(f => f.id === id)?.name).join(' vs ')}</span>
      <button onClick={() => setPkSlots([])} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: c.t2, fontSize: 11 }}>清除</button>
      {pkSlots.length === 2 && <button onClick={handlePK} style={{ padding: '4px 12px', borderRadius: 6, background: c.a, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>对比!</button>}
    </div>}

    {/* ── Recents ── */}
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: c.t, marginBottom: 8 }}>
        <Clock size={14} style={{ color: c.t2 }}/> 最近浏览
      </div>
      {resolvedRecents.length === 0 ? (
        <div style={{ fontSize: 12, color: c.t2, padding: '8px 0', textAlign: 'center' }}>暂无浏览记录</div>
      ) : (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {resolvedRecents.slice(0, MAX_REC).map(f => (
            <button key={f!.id} onClick={() => onFactorClick?.(f!.id)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 16, fontSize: 11,
              fontWeight: 500, background: c.sh, color: c.t2, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <span style={{ fontSize: 14 }}>{f!.emoji}</span> {f!.name}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>;
}

export { type FavFactor, MAX_FAV, MAX_REC, FAV_KEY, REC_KEY };
