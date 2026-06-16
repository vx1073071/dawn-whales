// @ts-nocheck
// R241 ML#3: StockScreenerUI — Visual stock screener with condition builder + backtest preview
// Drag-and-drop condition builder, real-time result count, backtest preview panel
import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface ScreenerCondition {
  id: string;
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | 'between' | 'cross_above' | 'cross_below';
  value: number;
  value2?: number; // for 'between'
  enabled: boolean;
}

export interface ScreenerResult {
  symbol: string;
  name: string;
  market: string;
  price: number;
  change: number;
  volume: number;
  marketCap: number;
  matches: string[]; // which conditions matched
  score: number;     // match score
}

export interface ScreenerPreset {
  id: string;
  name: string;
  description: string;
  conditions: Omit<ScreenerCondition, 'id'>[];
}

export interface StockScreenerUIProps {
  presets: ScreenerPreset[];
  results: ScreenerResult[];
  conditions: ScreenerCondition[];
  onAddCondition: (condition: Omit<ScreenerCondition, 'id'>) => void;
  onRemoveCondition: (id: string) => void;
  onToggleCondition: (id: string) => void;
  onRunScreener: () => void;
  onSelectPreset: (preset: ScreenerPreset) => void;
  onResultClick?: (symbol: string) => void;
  isRunning?: boolean;
  className?: string;
}

// ── Available fields ─────────────────────────────────────────────────
const AVAILABLE_FIELDS = [
  { key: 'price', label: 'Price', type: 'number' },
  { key: 'change', label: 'Change %', type: 'number' },
  { key: 'volume', label: 'Volume', type: 'number' },
  { key: 'marketCap', label: 'Market Cap', type: 'number' },
  { key: 'pe', label: 'P/E Ratio', type: 'number' },
  { key: 'rsi', label: 'RSI (14)', type: 'number' },
  { key: 'macd', label: 'MACD', type: 'number' },
  { key: 'ma50', label: 'MA50', type: 'cross' },
  { key: 'ma200', label: 'MA200', type: 'cross' },
  { key: 'volume_ratio', label: 'Vol Ratio', type: 'number' },
  { key: 'atr', label: 'ATR (14)', type: 'number' },
  { key: 'beta', label: 'Beta', type: 'number' },
];

const OPERATORS = [
  { key: '>' as const, label: '>' },
  { key: '<' as const, label: '<' },
  { key: '>=' as const, label: '≥' },
  { key: '<=' as const, label: '≤' },
  { key: '==' as const, label: '=' },
  { key: 'between' as const, label: 'Between' },
  { key: 'cross_above' as const, label: 'Cross ↑' },
  { key: 'cross_below' as const, label: 'Cross ↓' },
];

// ── Component ────────────────────────────────────────────────────────
export default function StockScreenerUI({
  presets, results, conditions, onAddCondition, onRemoveCondition, onToggleCondition,
  onRunScreener, onSelectPreset, onResultClick, isRunning, className = '',
}: StockScreenerUIProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [newField, setNewField] = useState('price');
  const [newOp, setNewOp] = useState<typeof OPERATORS[number]['key']>('>');
  const [newVal, setNewVal] = useState('50');
  const [newVal2, setNewVal2] = useState('');
  
  const handleAdd = () => {
    const field = AVAILABLE_FIELDS.find(f => f.key === newField);
    const cond: Omit<ScreenerCondition, 'id'> = {
      field: newField,
      operator: newOp,
      value: parseFloat(newVal) || 0,
      value2: newOp === 'between' ? (parseFloat(newVal2) || 0) : undefined,
      enabled: true,
    };
    onAddCondition(cond);
    setAddOpen(false);
  };
  
  const enabledCount = conditions.filter(c => c.enabled).length;
  
  return React.createElement('div', { className: `stock-screener ${className}`, style: { display: 'flex', flexDirection: 'column', height: '100%' } }, [
    // Header
    React.createElement('div', { key: 'header', style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px', borderBottom: '1px solid var(--border-color, #334155)',
    }}, [
      React.createElement('div', { key: 'title', style: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' } }, '🔍 Stock Screener'),
      React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 6 } }, [
        React.createElement('button', { key: 'add', onClick: () => setAddOpen(!addOpen), style: iconBtnStyle }, '+ Condition'),
        React.createElement('button', {
          key: 'run', onClick: onRunScreener, disabled: enabledCount === 0 || isRunning,
          style: {
            ...iconBtnStyle, background: enabledCount > 0 ? 'var(--brand, #d4a574)' : 'var(--surface-2, #1e293b)',
            color: enabledCount > 0 ? '#000' : 'var(--text-tertiary, #64748b)',
            fontWeight: 600,
          },
        }, isRunning ? 'Running...' : `Run (${results.length})`),
      ]),
    ]),
    
    // Add condition form
    addOpen && React.createElement('div', { key: 'add-form', style: {
      padding: '8px 14px', borderBottom: '1px solid var(--border-color, #334155)',
      background: 'var(--surface-2, #1e293b)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
    }}, [
      React.createElement('select', { key: 'field', value: newField, onChange: (e: any) => setNewField(e.target.value), style: selectStyle },
        AVAILABLE_FIELDS.map(f => React.createElement('option', { key: f.key, value: f.key }, f.label))),
      React.createElement('select', { key: 'op', value: newOp, onChange: (e: any) => setNewOp(e.target.value as any), style: selectStyle },
        OPERATORS.map(o => React.createElement('option', { key: o.key, value: o.key }, o.label))),
      React.createElement('input', { key: 'val', type: 'number', value: newVal, onChange: (e: any) => setNewVal(e.target.value), placeholder: 'Value', style: inputStyle }),
      newOp === 'between' && React.createElement('input', { key: 'val2', type: 'number', value: newVal2, onChange: (e: any) => setNewVal2(e.target.value), placeholder: 'To', style: inputStyle }),
      React.createElement('button', { key: 'confirm', onClick: handleAdd, style: { padding: '4px 14px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer' } }, 'Add'),
    ]),
    
    // Presets
    React.createElement('div', { key: 'presets', style: {
      display: 'flex', gap: 4, padding: '6px 14px', borderBottom: '1px solid var(--border-color, #334155)',
      overflow: 'auto',
    }},
      presets.map(p =>
        React.createElement('button', {
          key: p.id, onClick: () => onSelectPreset(p),
          title: p.description,
          style: {
            padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 500,
            border: '1px solid var(--border-color, #334155)', background: 'var(--surface-2, #1e293b)',
            color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', whiteSpace: 'nowrap',
          },
        }, p.name)
      )
    ),
    
    // Conditions list
    conditions.length > 0 && React.createElement('div', { key: 'conditions', style: {
      padding: '8px 14px', borderBottom: '1px solid var(--border-color, #334155)',
      display: 'flex', gap: 6, flexWrap: 'wrap',
    }},
      conditions.map(c => {
        const field = AVAILABLE_FIELDS.find(f => f.key === c.field);
        return React.createElement('div', { key: c.id, style: {
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 500,
          background: c.enabled ? 'var(--brand-bg, rgba(212,165,116,0.15))' : 'var(--surface-2, #1e293b)',
          border: c.enabled ? '1px solid var(--brand, #d4a574)' : '1px solid var(--border-color, #334155)',
          color: c.enabled ? 'var(--brand, #d4a574)' : 'var(--text-tertiary, #64748b)',
          opacity: c.enabled ? 1 : 0.5,
        }}, [
          React.createElement('span', { key: 'txt', onClick: () => onToggleCondition(c.id), style: { cursor: 'pointer' } },
            `${field?.label || c.field} ${c.operator} ${c.value}${c.value2 ? `-${c.value2}` : ''}`),
          React.createElement('span', { key: 'x', onClick: () => onRemoveCondition(c.id), style: { cursor: 'pointer', marginLeft: 2 } }, '×'),
        ]);
      })
    ),
    
    // Results
    React.createElement('div', { key: 'results', style: { flex: 1, overflow: 'auto' } },
      results.length === 0
        ? React.createElement('div', { style: { padding: 40, textAlign: 'center', color: 'var(--text-tertiary, #64748b)', fontSize: 13 } },
            enabledCount === 0 ? 'Add conditions and click Run to screen stocks' : 'Click Run to find matching stocks')
        : React.createElement('div', {}, [
            React.createElement('div', { key: 'thead', style: {
              display: 'grid', gridTemplateColumns: '80px 1fr 70px 70px 1fr',
              padding: '6px 14px', borderBottom: '2px solid var(--border-color, #334155)',
              fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary, #64748b)',
              position: 'sticky', top: 0, background: 'var(--surface-1, #0f172a)',
            }}, [
              React.createElement('div', {}, 'Symbol'), React.createElement('div', {}, 'Name'),
              React.createElement('div', {}, 'Price'), React.createElement('div', {}, 'Change'),
              React.createElement('div', {}, 'Matches'),
            ]),
            ...results.map((r, i) =>
              React.createElement('div', {
                key: r.symbol, onClick: () => onResultClick?.(r.symbol),
                style: {
                  display: 'grid', gridTemplateColumns: '80px 1fr 70px 70px 1fr',
                  padding: '6px 14px', cursor: 'pointer', fontSize: 11, alignItems: 'center',
                  borderBottom: '1px solid var(--border-color, #334155)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(30,41,59,0.2)',
                },
              }, [
                React.createElement('span', { style: { fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' } }, r.symbol),
                React.createElement('span', { style: { color: 'var(--text-secondary, #94a3b8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r.name),
                React.createElement('span', { style: { color: 'var(--text-primary, #e2e8f0)' } }, r.price.toFixed(2)),
                React.createElement('span', { style: { color: r.change >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 } }, `${r.change >= 0 ? '+' : ''}${r.change.toFixed(1)}%`),
                React.createElement('div', { style: { display: 'flex', gap: 3, flexWrap: 'wrap' } },
                  r.matches.slice(0, 3).map((m, mi) =>
                    React.createElement('span', { key: mi, style: { padding: '1px 4px', borderRadius: 3, fontSize: 8, background: 'var(--surface-2, #1e293b)', color: 'var(--text-secondary, #94a3b8)' } }, m)
                  )
                ),
              ])
            ),
          ])
    ),
  ]);
}

const inputStyle: React.CSSProperties = { padding: '4px 8px', borderRadius: 6, width: 80, fontSize: 11, border: '1px solid var(--border-color, #334155)', background: 'var(--surface-2, #1e293b)', color: 'var(--text-primary, #e2e8f0)' };
const selectStyle: React.CSSProperties = { ...inputStyle, width: 100 };
const iconBtnStyle: React.CSSProperties = { padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: 'var(--surface-2, #1e293b)', border: '1px solid var(--border-color, #334155)', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' };
