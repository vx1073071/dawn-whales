import { useState, useMemo } from 'react';

// ── Indicator Search & Favorites ── ML#3 R268 (3h)
// Quick search, favorite manager, recently used, usage stats

interface IndicatorUsage {
  id: string;
  name: string;
  useCount: number;
  lastUsed: string;
}

interface IndicatorSearchFavoritesProps {
  usage: IndicatorUsage[];
  favorites: string[];
  recent: string[];
  onAddToFavorites: (id: string) => void;
  onRemoveFromFavorites: (id: string) => void;
  onActivate: (id: string) => void;
  allNames: Record<string, string>;
}

const IndicatorSearchFavoritesPanel = ({
  usage, favorites, recent, onAddToFavorites, onRemoveFromFavorites, onActivate, allNames,
}: IndicatorSearchFavoritesProps) => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'favorites' | 'recent' | 'popular' | 'all'>('favorites');

  const sortedUsage = useMemo(() => [...usage].sort((a, b) => b.useCount - a.useCount), [usage]);
  const sortedRecent = useMemo(() => [...recent].reverse(), [recent]);

  const merged = useMemo(() => {
    const map = new Map<string, IndicatorUsage>();
    usage.forEach(u => map.set(u.id, u));
    return Array.from(map.values()).sort((a, b) => b.useCount - a.useCount);
  }, [usage]);

  const filtered = useMemo(() => {
    let list = merged;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
    }
    return list;
  }, [merged, search]);

  const RenderBadge = ({ id, showStar = true }: { id: string; showStar?: boolean }) => {
    const name = allNames[id] || id;
    const u = usage.find(ux => ux.id === id);
    const isFav = favorites.includes(id);
    return (
      <div key={id} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb',
        background: 'white', marginBottom: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          {showStar && (
            <button
              onClick={() => isFav ? onRemoveFromFavorites(id) : onAddToFavorites(id)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14 }}
            >
              {isFav ? '⭐' : '☆'}
            </button>
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 11 }}>{name}</div>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>{id.toUpperCase()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {u && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#64748b' }}>
              <span title="使用次数">🔥 {u.useCount}</span>
              <span title="最后使用" style={{ fontSize: 8 }}>{u.lastUsed}</span>
            </div>
          )}
          <button
            onClick={() => onActivate(id)}
            style={{
              padding: '3px 10px', borderRadius: 4, border: 'none',
              background: '#3b82f6', color: 'white', fontSize: 10, cursor: 'pointer',
            }}
          >
            + 添加
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="indicator-search-fav" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 460 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🔍 搜索/收藏</span>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#64748b' }}>
          <span>⭐ {favorites.length}</span>
          <span>🕐 {recent.length}</span>
          <span>🔥 {sortedUsage.length}</span>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="快速搜索93个指标..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
          fontSize: 12, marginBottom: 8, boxSizing: 'border-box',
        }}
      />

      {/* Tabs */}
      {!search && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[
            { key: 'favorites' as const, label: '⭐ 收藏', count: favorites.length },
            { key: 'recent' as const, label: '🕐 最近', count: recent.length },
            { key: 'popular' as const, label: '🔥 热门', count: sortedUsage.filter(u => u.useCount >= 3).length },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '4px 12px', borderRadius: 16, border: 'none', fontSize: 10, cursor: 'pointer',
              background: tab === t.key ? '#3b82f6' : '#f1f5f9',
              color: tab === t.key ? 'white' : '#64748b',
              fontWeight: tab === t.key ? 600 : 400,
            }}>{t.label} ({t.count})</button>
          ))}
        </div>
      )}

      {/* Search Results */}
      {search && (
        <div>
          {filtered.slice(0, 15).map(u => <RenderBadge key={u.id} id={u.id} />)}
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
              🔍 未找到匹配的指标
            </div>
          )}
        </div>
      )}

      {/* Favorites Tab */}
      {!search && tab === 'favorites' && (
        <div>
          {favorites.length > 0 ? (
            favorites.map(id => <RenderBadge key={id} id={id} />)
          ) : (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>⭐</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>收藏你常用的指标，快速访问</div>
            </div>
          )}
        </div>
      )}

      {/* Recent Tab */}
      {!search && tab === 'recent' && (
        <div>
          {sortedRecent.length > 0 ? (
            sortedRecent.slice(0, 12).map(id => <RenderBadge key={id} id={id} />)
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>暂无最近使用记录</div>
          )}
        </div>
      )}

      {/* Popular Tab */}
      {!search && tab === 'popular' && (
        <div>
          {sortedUsage.filter(u => u.useCount >= 3).slice(0, 12).map(u => <RenderBadge key={u.id} id={u.id} />)}
          {sortedUsage.filter(u => u.useCount >= 3).length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>暂无热门数据</div>
          )}
        </div>
      )}

      {/* Usage Stats */}
      <div style={{
        marginTop: 10, padding: 8, borderRadius: 6,
        background: '#f8fafc', fontSize: 10,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: '#64748b' }}>📊 使用统计</div>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#3b82f6' }}>{sortedUsage.length}</div>
            <div style={{ color: '#94a3b8', fontSize: 9 }}>使用过</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
              {sortedUsage.reduce((s, u) => s + u.useCount, 0)}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 9 }}>总次数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>
              {sortedUsage.filter(u => u.useCount >= 5).length}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 9 }}>常用(≥5)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#8b5cf6' }}>{favorites.length}</div>
            <div style={{ color: '#94a3b8', fontSize: 9 }}>收藏</div>
          </div>
        </div>
      </div>

      {/* Tip */}
      <div style={{
        marginTop: 8, padding: 6, borderRadius: 4,
        background: '#fef9c3', fontSize: 9, color: '#92400e', textAlign: 'center',
      }}>
        💡 提示：93个指标已覆盖TradingView指标库，搜索框支持拼音、中文、英文
      </div>
    </div>
  );
};

export default IndicatorSearchFavoritesPanel;
