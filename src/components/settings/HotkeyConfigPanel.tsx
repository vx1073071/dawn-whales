// @ts-nocheck
// R232 ML#2: HotkeyConfigPanel — User-facing shortcut configuration
// View, edit, reset keyboard shortcuts with search and scope filtering
import React, { useState, useMemo, useCallback } from 'react';
import { DEFAULT_HOTKEYS, HotkeyScope, HotkeyBinding } from '../../hooks/useHotkeys';
import ResponsiveCard from '../common/ResponsiveCard';

export interface HotkeyConfigPanelProps {
  userBindings: HotkeyBinding[];
  onUpdateBinding: (id: string, newKey: string) => void;
  onResetBinding: (id: string) => void;
  onResetAll: () => void;
  activeScope?: HotkeyScope;
  className?: string;
}

const SCOPE_LABELS: Record<HotkeyScope, string> = {
  global: 'Global',
  chart: 'Chart',
  trading: 'Trading',
  strategy: 'Strategy',
  portfolio: 'Portfolio',
  settings: 'Settings',
};

const SCOPE_ICONS: Record<HotkeyScope, string> = {
  global: '🌐', chart: '📊', trading: '💹',
  strategy: '🎯', portfolio: '💼', settings: '⚙️',
};

const SCOPE_ORDER: HotkeyScope[] = ['global', 'trading', 'chart', 'strategy', 'portfolio', 'settings'];

export default function HotkeyConfigPanel({
  userBindings,
  onUpdateBinding,
  onResetBinding,
  onResetAll,
  activeScope,
  className = '',
}: HotkeyConfigPanelProps) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState('');
  const [scopeFilter, setScopeFilter] = useState<HotkeyScope | 'all'>('all');
  
  // Merge defaults with user bindings
  const allBindings = useMemo(() => {
    const map = new Map<string, HotkeyBinding>();
    DEFAULT_HOTKEYS.forEach(d => {
      map.set(d.id, { ...d, action: () => {}, enabled: true } as HotkeyBinding);
    });
    userBindings.forEach(b => map.set(b.id, b));
    return Array.from(map.values());
  }, [userBindings]);
  
  const filtered = useMemo(() => {
    return allBindings.filter(b => {
      if (scopeFilter !== 'all' && b.scope !== scopeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return b.description.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || b.key.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allBindings, scopeFilter, search]);
  
  // Group by scope
  const grouped = useMemo(() => {
    const groups: Record<string, HotkeyBinding[]> = {};
    SCOPE_ORDER.forEach(s => {
      const items = filtered.filter(b => b.scope === s);
      if (items.length > 0) groups[s] = items;
    });
    return groups;
  }, [filtered]);
  
  const startEdit = useCallback((binding: HotkeyBinding) => {
    setEditing(binding.id);
    setEditingKey(binding.key);
  }, []);
  
  const saveEdit = useCallback(() => {
    if (editing && editingKey) {
      onUpdateBinding(editing, editingKey);
    }
    setEditing(null);
    setEditingKey('');
  }, [editing, editingKey, onUpdateBinding]);
  
  const cancelEdit = useCallback(() => {
    setEditing(null);
    setEditingKey('');
  }, []);
  
  const handleKeyCapture = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.key === 'Escape') {
      cancelEdit();
      return;
    }
    if (e.key === 'Enter') {
      saveEdit();
      return;
    }
    
    // Capture single keys or combinations
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey && e.key.length > 1) parts.push('Shift');
    
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      if (e.key === 'Escape') parts.push('Escape');
      else if (e.key === ' ') parts.push('Space');
      else if (e.key.startsWith('F') && !isNaN(Number(e.key.slice(1)))) parts.push(e.key);
      else parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    }
    
    setEditingKey(parts.join('+'));
  }, [saveEdit, cancelEdit]);
  
  return React.createElement('div', { className: `hotkey-config-panel ${className}` }, [
    // Header
    React.createElement('div', { key: 'header', style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 16, flexWrap: 'wrap', gap: 8,
    }}, [
      // Search
      React.createElement('input', {
        key: 'search',
        type: 'text',
        placeholder: 'Search shortcuts...',
        value: search,
        onChange: (e: any) => setSearch(e.target.value),
        style: {
          padding: '6px 12px', borderRadius: 8, width: 220, fontSize: 13,
          border: '1px solid var(--border-color, #334155)',
          background: 'var(--surface-2, #1e293b)', color: 'var(--text-primary, #e2e8f0)',
        },
      }),
      // Scope filter
      React.createElement('div', { key: 'scopes', style: { display: 'flex', gap: 4, flexWrap: 'wrap' } }, [
        React.createElement('button', {
          key: 'all',
          onClick: () => setScopeFilter('all'),
          style: getScopeBtnStyle(scopeFilter === 'all'),
        }, 'All'),
        ...SCOPE_ORDER.map(s =>
          React.createElement('button', {
            key: s,
            onClick: () => setScopeFilter(s),
            style: getScopeBtnStyle(scopeFilter === s),
          }, `${SCOPE_ICONS[s]} ${SCOPE_LABELS[s]}`)
        ),
      ]),
      // Reset all
      React.createElement('button', {
        key: 'reset',
        onClick: onResetAll,
        style: {
          padding: '6px 14px', borderRadius: 8, fontSize: 12,
          border: '1px solid var(--border-color, #334155)',
          background: 'var(--surface-2, #1e293b)', color: 'var(--text-secondary, #94a3b8)',
          cursor: 'pointer',
        },
      }, 'Reset All'),
    ]),
    
    // Hotkey list grouped by scope
    ...Object.entries(grouped).map(([scope, bindings]) =>
      React.createElement(ResponsiveCard, {
        key: scope,
        title: `${SCOPE_ICONS[scope as HotkeyScope] || ''} ${SCOPE_LABELS[scope as HotkeyScope] || scope} (${bindings.length})`,
        style: { marginBottom: 12 },
      },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
          bindings.map(binding => {
            const isEditing = editing === binding.id;
            return React.createElement('div', { key: binding.id, style: {
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 8px', borderRadius: 6,
              background: isEditing ? 'var(--brand-bg, rgba(212,165,116,0.1))' : 'transparent',
              transition: 'background 0.15s',
            }}, [
              // Description
              React.createElement('span', { key: 'desc', style: { fontSize: 13, color: 'var(--text-primary, #e2e8f0)' } },
                binding.description),
              // Key display / editor
              React.createElement('div', { key: 'key', style: { display: 'flex', alignItems: 'center', gap: 6 } },
                isEditing
                  ? [
                    React.createElement('kbd', { key: 'input', onKeyDown: handleKeyCapture, style: {
                      ...kbdStyle, background: '#d4a574', color: '#000',
                      minWidth: 80, textAlign: 'center', outline: 'none', padding: '4px 10px',
                    }}, editingKey || 'Press key...'),
                    React.createElement('button', { key: 'save', onClick: saveEdit, style: { ...btnStyle, background: '#22c55e', color: '#000' } }, '✓'),
                    React.createElement('button', { key: 'cancel', onClick: cancelEdit, style: btnStyle }, '✕'),
                  ]
                  : [
                    React.createElement('kbd', { key: 'display', onClick: () => startEdit(binding), style: { ...kbdStyle, cursor: 'pointer' } },
                      binding.key),
                    React.createElement('button', {
                      key: 'reset',
                      onClick: () => onResetBinding(binding.id),
                      title: 'Reset to default',
                      style: { background: 'none', border: 'none', color: 'var(--text-tertiary, #64748b)', cursor: 'pointer', fontSize: 12, padding: '0 4px' },
                    }, '↺'),
                  ]
              ),
            ]);
          })
        )
      )
    ),
    
    filtered.length === 0 && React.createElement('div', { key: 'empty', style: {
      textAlign: 'center', padding: 40, color: 'var(--text-tertiary, #64748b)', fontSize: 13,
    }}, search ? 'No shortcuts match your search' : 'No shortcuts in this scope'),
    
    // Keyboard shortcut for help panel
    React.createElement('div', { key: 'hint', style: {
      marginTop: 16, padding: 10, borderRadius: 8,
      background: 'var(--surface-2, #1e293b)',
      border: '1px solid var(--border-color, #334155)',
      fontSize: 11, color: 'var(--text-tertiary, #64748b)',
      textAlign: 'center',
    }}, [
      '💡 Press ',
      React.createElement('kbd', { key: 'k', style: kbdStyle }, 'Ctrl+K'),
      ' anytime to search. Click a key to rebind. Press ',
      React.createElement('kbd', { key: 'esc', style: kbdStyle }, 'Esc'),
      ' to cancel editing.',
    ]),
  ]);
}

// ── Styles ───────────────────────────────────────────────────────────
const kbdStyle: React.CSSProperties = {
  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
  background: 'var(--surface-2, #1e293b)', color: 'var(--text-secondary, #94a3b8)',
  border: '1px solid var(--border-color, #334155)',
  fontFamily: 'monospace', whiteSpace: 'nowrap',
};

const btnStyle: React.CSSProperties = {
  padding: '3px 8px', borderRadius: 4, fontSize: 12, border: 'none',
  background: 'var(--surface-2, #1e293b)', color: 'var(--text-secondary, #94a3b8)',
  cursor: 'pointer',
};

function getScopeBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
    border: active ? '1px solid var(--brand, #d4a574)' : '1px solid transparent',
    background: active ? 'var(--brand-bg, rgba(212,165,116,0.15))' : 'transparent',
    color: active ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
    cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
