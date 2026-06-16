// @ts-nocheck
// R233 ML#1: UndoRedoHistoryPanel — Full operation history viewer
// Timeline view with collapse, filter by type, jump-to-point, save/load snapshots

import React, { useMemo, useState } from 'react';
import { UndoableOperation, UndoableOpType, UndoRedoState, UndoRedoActions } from '../../hooks/useUndoRedo';

export interface UndoRedoHistoryPanelProps {
  state: UndoRedoState;
  actions: UndoRedoActions;
  className?: string;
  compact?: boolean;
}

const TYPE_LABELS: Record<UndoableOpType, { label: string; icon: string; color: string }> = {
  strategy_param:  { label: 'Strategy Param', icon: '🎯', color: '#3b82f6' },
  factor_weight:   { label: 'Factor Weight', icon: '⚖️', color: '#f59e0b' },
  factor_select:   { label: 'Factor Select', icon: '📊', color: '#22c55e' },
  order_action:    { label: 'Order',         icon: '💹', color: '#ef4444' },
  template_change: { label: 'Template',      icon: '📋', color: '#8b5cf6' },
};

export default function UndoRedoHistoryPanel({
  state,
  actions,
  className = '',
  compact = false,
}: UndoRedoHistoryPanelProps) {
  const [typeFilter, setTypeFilter] = useState<UndoableOpType | 'all'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  const history = useMemo(() => {
    let ops = actions.getHistory().reverse(); // newest first
    if (typeFilter !== 'all') {
      ops = ops.filter(op => op.type === typeFilter);
    }
    return ops;
  }, [actions, typeFilter]);
  
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const handleJumpTo = (op: UndoableOperation, index: number) => {
    // The index in reversed list needs conversion
    const actualIndex = actions.getHistory().length - 1 - index;
    actions.jumpTo(actualIndex);
  };
  
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: actions.getHistory().length };
    actions.getHistory().forEach(op => {
      counts[op.type] = (counts[op.type] || 0) + 1;
    });
    return counts;
  }, [actions]);
  
  return (
    <div className={`undo-redo-history-panel ${className}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', borderBottom: '1px solid var(--border-color, #334155)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' }}>📜 History</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #64748b)' }}>
            {state.undoCount} undo / {state.redoCount} redo
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={actions.undo} disabled={!state.canUndo} style={iconBtnStyle(!state.canUndo)} title="Undo (Ctrl+Z)">↩</button>
          <button onClick={actions.redo} disabled={!state.canRedo} style={iconBtnStyle(!state.canRedo)} title="Redo (Ctrl+Y)">↪</button>
          <button onClick={actions.clear} style={iconBtnStyle(false)} title="Clear history">🗑️</button>
        </div>
      </div>
      
      {/* Type filter bar */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 12px', borderBottom: '1px solid var(--border-color, #334155)', overflow: 'auto', flexShrink: 0 }}>
        <FilterChip active={typeFilter === 'all'} label={`All (${typeCounts.all || 0})`} onClick={() => setTypeFilter('all')} />
        {Object.entries(TYPE_LABELS).map(([type, { label, icon, color }]) => (
          <FilterChip
            key={type}
            active={typeFilter === type}
            label={`${icon} ${label} (${typeCounts[type] || 0})`}
            onClick={() => setTypeFilter(type as UndoableOpType)}
            color={color}
          />
        ))}
      </div>
      
      {/* History list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {history.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary, #64748b)', fontSize: 13 }}>
            {typeFilter === 'all' ? 'No changes yet. Start editing to build history.' : 'No operations of this type.'}
          </div>
        ) : (
          history.map((op, i) => {
            const typeInfo = TYPE_LABELS[op.type];
            const isExpanded = expandedIds.has(op.id);
            const isCurrent = i === 0 && state.undoCount > 0; // Top of undo stack
            
            return (
              <div key={op.id} style={{
                borderBottom: '1px solid var(--border-color, #334155)',
                borderLeft: isCurrent ? '3px solid var(--brand, #d4a574)' : '3px solid transparent',
              }}>
                {/* Row header */}
                <div
                  onClick={() => toggleExpand(op.id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: compact ? '4px 8px' : '6px 12px',
                    cursor: 'pointer', userSelect: 'none',
                    background: isExpanded ? 'var(--surface-2, #1e293b)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14 }}>{typeInfo.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: compact ? 11 : 12,
                        color: 'var(--text-primary, #e2e8f0)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {op.label}
                      </div>
                      {!compact && (
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #64748b)', marginTop: 1 }}>
                          {new Date(op.timestamp).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 4,
                      background: `${typeInfo.color}20`, color: typeInfo.color, fontWeight: 600,
                    }}>
                      {typeInfo.label}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleJumpTo(op, i); }}
                      title="Jump to this point"
                      style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: 10, border: 'none',
                        background: 'var(--surface-2, #1e293b)', color: 'var(--text-secondary, #94a3b8)',
                        cursor: 'pointer',
                      }}
                    >
                      ⏮
                    </button>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary, #64748b)' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
                
                {/* Expanded data */}
                {isExpanded && (
                  <div style={{ padding: '8px 12px', background: 'var(--surface-2, #1e293b)', fontSize: 11 }}>
                    <div style={{ color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>Data:</div>
                    <pre style={{
                      fontSize: 10, maxHeight: 200, overflow: 'auto',
                      padding: 8, borderRadius: 6,
                      background: 'var(--surface-1, #0f172a)', color: 'var(--text-secondary, #94a3b8)',
                      margin: 0, lineHeight: 1.5,
                    }}>
                      {JSON.stringify(op.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Filter chip ──────────────────────────────────────────────────────
function FilterChip({ active, label, onClick, color }: {
  active: boolean; label: string; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500,
        border: active ? `1px solid ${color || 'var(--brand, #d4a574)'}` : '1px solid transparent',
        background: active ? `${color || 'var(--brand, #d4a574)'}15` : 'transparent',
        color: active ? (color || 'var(--brand, #d4a574)') : 'var(--text-secondary, #94a3b8)',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

const iconBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '3px 8px', borderRadius: 6, fontSize: 13, border: 'none',
  background: disabled ? 'var(--surface-1, #0f172a)' : 'var(--surface-2, #1e293b)',
  color: disabled ? 'var(--text-tertiary, #64748b)' : 'var(--text-primary, #e2e8f0)',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
});
