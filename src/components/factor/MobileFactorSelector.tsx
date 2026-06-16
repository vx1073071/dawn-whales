// @ts-nocheck
// R231 ML#1: MobileFactorSelector — Compact factor selector for small windows
// Shows compact cards instead of full table, swipe to browse, single-column stack
import React, { useState, useMemo } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import type { FactorI18nName } from '../../../electron/engine/factors/factor-i18n-names';

export interface MobileFactorSelectorProps {
  factors: FactorI18nName[];
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onDeselect?: (id: string) => void;
  maxSelect?: number;
  compact?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  '动量': '🚀', '价值': '💎', '波动': '📊', '质量': '⭐',
  '情绪': '😊', '宏观': '🌍', '资金': '💰', '风险': '🛡️',
  '红利': '💵', '成长': '📈', '市场': '🏛️', '加密': '₿',
  '商品': '🛢️', '衍生': '📐', '技术': '📡', '另类': '🔮'
};

export default function MobileFactorSelector({
  factors,
  selectedIds = [],
  onSelect,
  onDeselect,
  maxSelect = 10,
  compact = false,
}: MobileFactorSelectorProps) {
  const { isMobile, isTablet } = useResponsive();
  const [search, setSearch] = useState('');
  const [showSelected, setShowSelected] = useState(false);
  
  const filtered = useMemo(() => {
    let list = factors;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(f => 
        f.nameCN.toLowerCase().includes(q) || 
        (f as any).nameEn?.toLowerCase().includes(q) ||
        f.factorId.toLowerCase().includes(q)
      );
    }
    if (showSelected) {
      list = list.filter(f => selectedIds.includes(f.factorId));
    }
    return list.slice(0, 50);
  }, [factors, search, showSelected, selectedIds]);
  
  const isCompact = compact || isMobile;
  
  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, FactorI18nName[]> = {};
    filtered.forEach(f => {
      const cat = f.categoryCN || '其他';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    });
    return groups;
  }, [filtered]);
  
  return (
    <div className="mobile-factor-selector" style={{ fontSize: isCompact ? 12 : 14 }}>
      {/* Search bar */}
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="搜索因子..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-color, #334155)',
            background: 'var(--surface-2, #1e293b)',
            color: 'var(--text-primary, #e2e8f0)',
            fontSize: isCompact ? 12 : 13,
          }}
        />
        <button
          onClick={() => setShowSelected(!showSelected)}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-color, #334155)',
            background: showSelected ? 'var(--brand, #d4a574)' : 'var(--surface-2, #1e293b)',
            color: showSelected ? '#000' : 'var(--text-secondary, #94a3b8)',
            fontSize: isCompact ? 11 : 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          已选({selectedIds.length})
        </button>
      </div>
      
      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {selectedIds.slice(0, isCompact ? 3 : 6).map(id => {
            const f = factors.find(x => x.factorId === id);
            return (
              <span key={id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 7px', borderRadius: 12,
                background: 'var(--brand-bg, rgba(212,165,116,0.15))',
                border: '1px solid var(--brand, #d4a574)',
                fontSize: isCompact ? 10 : 11,
                color: 'var(--brand, #d4a574)',
              }}>
                {f?.nameCN || id}
                <span onClick={() => onDeselect?.(id)} style={{ cursor: 'pointer', marginLeft: 2 }}>×</span>
              </span>
            );
          })}
          {selectedIds.length > (isCompact ? 3 : 6) && (
            <span style={{ fontSize: isCompact ? 10 : 11, color: 'var(--text-secondary, #94a3b8)' }}>
              +{selectedIds.length - (isCompact ? 3 : 6)}
            </span>
          )}
        </div>
      )}
      
      {/* Factor list (compact cards) */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: isCompact ? 11 : 12,
            fontWeight: 600,
            color: 'var(--text-secondary, #94a3b8)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '4px 0',
          }}>
            {CATEGORY_ICONS[category] || '📋'} {category}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map(f => {
              const selected = selectedIds.includes(f.factorId);
              const canAdd = !selected && selectedIds.length < maxSelect;
              return (
                <div
                  key={f.factorId}
                  onClick={() => selected ? onDeselect?.(f.factorId) : canAdd && onSelect?.(f.factorId)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: selected
                      ? '1px solid var(--brand, #d4a574)'
                      : '1px solid transparent',
                    background: selected
                      ? 'var(--brand-bg, rgba(212,165,116,0.1))'
                      : 'var(--surface-2, #1e293b)',
                    cursor: canAdd || selected ? 'pointer' : 'not-allowed',
                    opacity: canAdd || selected ? 1 : 0.4,
                    transition: 'all 0.15s',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: isCompact ? 12 : 13, color: 'var(--text-primary, #e2e8f0)' }}>
                      {f.nameCN}
                    </div>
                    {!isCompact && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #64748b)', marginTop: 1 }}>
                        {f.oneLine?.slice(0, 40)}{(f.oneLine?.length ?? 0) > 40 ? '...' : ''}
                      </div>
                    )}
                  </div>
                  {selected ? (
                    <span style={{ color: 'var(--brand, #d4a574)', fontSize: 14 }}>✓</span>
                  ) : canAdd ? (
                    <span style={{ color: 'var(--text-tertiary, #64748b)', fontSize: 14 }}>+</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      
      {filtered.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 20,
          color: 'var(--text-tertiary, #64748b)', fontSize: isCompact ? 12 : 13,
        }}>
          {search ? '无匹配因子' : '暂无因子'}
        </div>
      )}
    </div>
  );
}
