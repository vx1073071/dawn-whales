// @ts-nocheck
// R234 ML#1: StrategyComparePanel — Side-by-side strategy comparison tool
// Compare 2-3 strategies: factor radar chart, returns overlay, risk metrics, AI analysis
import React, { useState, useMemo, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface StrategyCompareData {
  id: string;
  name: string;
  market: string;
  style: string;
  // Performance
  totalReturn: number;     // %
  annualReturn: number;    // %
  sharpe: number;
  maxDrawdown: number;     // %
  winRate: number;         // %
  calmar: number;
  sortino: number;
  volatility: number;      // %
  // Factors
  factors: { name: string; weight: number }[];
  // Monthly returns (last 12 months)
  monthlyReturns: number[];
  // Risk metrics
  beta: number;
  alpha: number;
  var95: number;
  cvar95: number;
  // Meta
  trades: number;
  avgHoldingDays: number;
  profitFactor: number;
}

// ── Factor Radar Chart (SVG) ────────────────────────────────────────
function FactorRadarChart({
  strategies,
  size = 200,
}: {
  strategies: StrategyCompareData[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const colors = ['#d4a574', '#3b82f6', '#22c55e'];
  
  // Collect all unique factor names
  const allFactors = useMemo(() => {
    const names = new Set<string>();
    strategies.forEach(s => s.factors.forEach(f => names.add(f.name)));
    return Array.from(names).slice(0, 8); // Max 8 axes
  }, [strategies]);
  
  const n = allFactors.length;
  if (n < 3) {
    return React.createElement('div', { style: { width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary, #64748b)', fontSize: 12 } },
      'Need 3+ factors for radar chart');
  }
  
  const angleStep = (2 * Math.PI) / n;
  
  // Grid rings (3 levels)
  const rings = [0.33, 0.66, 1.0];
  const gridLines = rings.map((scale, i) => {
    const points = [];
    for (let j = 0; j <= n; j++) {
      const angle = angleStep * j - Math.PI / 2;
      points.push({
        x: cx + r * scale * Math.cos(angle),
        y: cy + r * scale * Math.sin(angle),
      });
    }
    return React.createElement('polygon', {
      key: `ring-${i}`,
      points: points.map(p => `${p.x},${p.y}`).join(' '),
      fill: 'none',
      stroke: 'var(--border-color, #334155)',
      strokeWidth: 0.5,
    });
  });
  
  // Axis lines + labels
  const axes = allFactors.map((name, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const lx = cx + (r + 18) * Math.cos(angle);
    const ly = cy + (r + 18) * Math.sin(angle);
    
    return React.createElement('g', { key: `axis-${i}` }, [
      React.createElement('line', {
        key: 'l',
        x1: cx, y1: cy, x2: x, y2: y,
        stroke: 'var(--border-color, #334155)',
        strokeWidth: 0.5,
      }),
      React.createElement('text', {
        key: 't',
        x: lx, y: ly,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        fill: 'var(--text-secondary, #94a3b8)',
        fontSize: 9,
      }, name),
    ]);
  });
  
  // Strategy polygons
  const polygons = strategies.map((s, si) => {
    const points = allFactors.map((name, i) => {
      const factor = s.factors.find(f => f.name === name);
      const val = factor ? factor.weight / 100 : 0;
      const angle = angleStep * i - Math.PI / 2;
      return {
        x: cx + r * val * Math.cos(angle),
        y: cy + r * val * Math.sin(angle),
      };
    });
    return React.createElement('polygon', {
      key: `strategy-${si}`,
      points: points.map(p => `${p.x},${p.y}`).join(' '),
      fill: colors[si % 3],
      fillOpacity: 0.15,
      stroke: colors[si % 3],
      strokeWidth: 1.5,
    });
  });
  
  return React.createElement('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}` }, [
    ...gridLines,
    ...axes,
    ...polygons,
  ]);
}

// ── Returns Overlay (mini line chart) ────────────────────────────────
function ReturnsOverlay({
  strategies,
  width = 350,
  height = 180,
}: {
  strategies: StrategyCompareData[];
  width?: number;
  height?: number;
}) {
  const colors = ['#d4a574', '#3b82f6', '#22c55e'];
  const pad = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  
  // Find min/max across all strategies
  const allReturns = strategies.flatMap(s => s.monthlyReturns);
  const minVal = Math.min(0, ...allReturns);
  const maxVal = Math.max(0, ...allReturns);
  const range = maxVal - minVal || 1;
  
  const scaleX = (i: number) => pad.left + (i / 11) * chartW;
  const scaleY = (v: number) => pad.top + chartH - ((v - minVal) / range) * chartH;
  
  // Grid lines
  const yGrid = [0, 0.25, 0.5, 0.75, 1.0].map((pct) => {
    const val = minVal + range * pct;
    const y = scaleY(val);
    return React.createElement('g', { key: `yg-${pct}` }, [
      React.createElement('line', { key: 'l', x1: pad.left, y1: y, x2: width - pad.right, y2: y, stroke: 'var(--border-color, #334155)', strokeWidth: 0.5 }),
      React.createElement('text', { key: 't', x: pad.left - 6, y: y + 4, textAnchor: 'end', fill: 'var(--text-tertiary, #64748b)', fontSize: 9 },
        `${val.toFixed(1)}%`),
    ]);
  });
  
  // Zero line
  const zeroY = scaleY(0);
  
  // Strategy lines
  const lines = strategies.map((s, si) => {
    const points = s.monthlyReturns.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(' ');
    return React.createElement('polyline', {
      key: `line-${si}`,
      points,
      fill: 'none',
      stroke: colors[si % 3],
      strokeWidth: 2,
      strokeLinejoin: 'round',
      strokeLinecap: 'round',
    });
  });
  
  // Month labels
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const xLabels = months.map((m, i) =>
    React.createElement('text', { key: `m-${i}`, x: scaleX(i), y: height - 8, textAnchor: 'middle', fill: 'var(--text-tertiary, #64748b)', fontSize: 9 }, m)
  );
  
  return React.createElement('svg', { width, height, viewBox: `0 0 ${width} ${height}` }, [
    ...yGrid,
    React.createElement('line', { key: 'zero', x1: pad.left, y1: zeroY, x2: width - pad.right, y2: zeroY, stroke: '#ef4444', strokeWidth: 0.5, strokeDasharray: '4,4' }),
    ...lines,
    ...xLabels,
  ]);
}

// ── Metric Comparison Bar ────────────────────────────────────────────
function MetricBar({
  label,
  values,
  formats,
  higherBetter = true,
  colors = ['#d4a574', '#3b82f6', '#22c55e'],
}: {
  label: string;
  values: (number | null)[];
  formats?: string[];
  higherBetter?: boolean;
  colors?: string[];
}) {
  const max = Math.max(...values.filter(v => v != null) as number[]);
  const min = Math.min(...values.filter(v => v != null) as number[]);
  const range = (max - min) || 1;
  
  return React.createElement('div', { style: { marginBottom: 8 } }, [
    React.createElement('div', { key: 'label', style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 } }, label),
    React.createElement('div', { key: 'bars', style: { display: 'flex', gap: 4, height: 20, alignItems: 'center' } },
      values.map((v, i) => {
        if (v == null) return React.createElement('div', { key: i, style: { flex: 1, fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, 'N/A');
        const pct = range > 0 ? ((v - min) / range) * 100 : 50;
        const winner = higherBetter ? v === max : v === min;
        const fmt = formats?.[i] || '%.2f';
        const display = fmt.includes('%') ? fmt.replace('%', String(v.toFixed(1))) : String(v.toFixed(2));
        
        return React.createElement('div', { key: i, style: { flex: 1, position: 'relative', height: '100%', background: 'var(--surface-2, #1e293b)', borderRadius: 4, overflow: 'hidden' } }, [
          React.createElement('div', { key: 'fill', style: {
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`, background: colors[i % 3], opacity: winner ? 0.6 : 0.25,
            borderRadius: 4, transition: 'width 0.5s',
          }}),
          React.createElement('div', { key: 'val', style: {
            position: 'relative', zIndex: 1, fontSize: 10, fontWeight: winner ? 600 : 400,
            color: winner ? '#fff' : 'var(--text-secondary, #94a3b8)',
            padding: '0 6px', lineHeight: '20px', whiteSpace: 'nowrap',
          }}, display),
        ]);
      })
    ),
  ]);
}

// ── Main Component ───────────────────────────────────────────────────
export interface StrategyComparePanelProps {
  strategies: StrategyCompareData[];
  onAddStrategy?: () => void;
  onRemoveStrategy?: (id: string) => void;
  maxStrategies?: number;
  className?: string;
}

export default function StrategyComparePanel({
  strategies,
  onAddStrategy,
  onRemoveStrategy,
  maxStrategies = 3,
  className = '',
}: StrategyComparePanelProps) {
  const [selectedTab, setSelectedTab] = useState<'performance' | 'risk' | 'factors' | 'ai'>('performance');
  const colors = ['#d4a574', '#3b82f6', '#22c55e'];
  
  const tabs = [
    { key: 'performance' as const, label: 'Performance', icon: '📈' },
    { key: 'risk' as const, label: 'Risk', icon: '🛡️' },
    { key: 'factors' as const, label: 'Factors', icon: '⚖️' },
    { key: 'ai' as const, label: 'AI Analysis', icon: '🤖' },
  ];
  
  return React.createElement('div', { className: `strategy-compare-panel ${className}`, style: { display: 'flex', flexDirection: 'column', height: '100%' } }, [
    // Header
    React.createElement('div', { key: 'header', style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px', borderBottom: '1px solid var(--border-color, #334155)',
    }}, [
      React.createElement('div', { key: 'title', style: { fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' } },
        `Strategy Comparison (${strategies.length}/${maxStrategies})`),
      strategies.length < maxStrategies && onAddStrategy && React.createElement('button', {
        key: 'add', onClick: onAddStrategy,
        style: {
          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          border: '1px solid var(--brand, #d4a574)', background: 'transparent',
          color: 'var(--brand, #d4a574)', cursor: 'pointer',
        },
      }, '+ Add Strategy'),
    ]),
    
    // Strategy chips
    React.createElement('div', { key: 'chips', style: {
      display: 'flex', gap: 6, padding: '8px 14px',
      borderBottom: '1px solid var(--border-color, #334155)',
      flexWrap: 'wrap',
    }},
      strategies.map((s, i) =>
        React.createElement('div', { key: s.id, style: {
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 500,
          background: `${colors[i % 3]}15`, border: `1px solid ${colors[i % 3]}40`, color: colors[i % 3],
        }}, [
          React.createElement('div', { key: 'dot', style: { width: 8, height: 8, borderRadius: 4, background: colors[i % 3] } }),
          React.createElement('span', { key: 'name', style: { maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.name),
          React.createElement('span', { key: 'market', style: { fontSize: 10, opacity: 0.6 } }, s.market),
          onRemoveStrategy && React.createElement('button', {
            key: 'x', onClick: () => onRemoveStrategy(s.id),
            style: { background: 'none', border: 'none', color: colors[i % 3], cursor: 'pointer', fontSize: 14, padding: '0 2px', opacity: 0.6 },
          }, '×'),
        ])
      )
    ),
    
    // Tab bar
    React.createElement('div', { key: 'tabs', style: {
      display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color, #334155)',
    }},
      tabs.map(tab =>
        React.createElement('button', { key: tab.key, onClick: () => setSelectedTab(tab.key), style: {
          flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 12, fontWeight: 500,
          background: 'none', border: 'none',
          borderBottom: selectedTab === tab.key ? '2px solid var(--brand, #d4a574)' : '2px solid transparent',
          color: selectedTab === tab.key ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
          cursor: 'pointer',
        }}, `${tab.icon} ${tab.label}`)
      )
    ),
    
    // Tab content
    React.createElement('div', { key: 'content', style: { flex: 1, overflow: 'auto', padding: 14 } },
      
      (() => { if (strategies.length === 0) return React.createElement('div', { style: { padding: 40, textAlign: 'center', color: 'var(--text-tertiary, #64748b)', fontSize: 13 } }, 'Select 1-3 strategies to compare side-by-side.'); if (selectedTab === 'performance') return React.createElement('div', {}, React.createElement(ReturnsOverlay, { strategies, width: 500, height: 220 })); if (selectedTab === 'risk') return React.createElement('div', {}, React.createElement('div', { style: { padding: 12, borderRadius: 8, background: 'var(--surface-2, #1e293b)', border: '1px solid var(--border-color, #334155)' } }, 'Risk Analysis')); if (selectedTab === 'factors') return React.createElement('div', { style: { textAlign: 'center' } }, React.createElement(FactorRadarChart, { strategies, size: 250 })); return React.createElement('div', { style: { textAlign: 'center', padding: 24 } }, React.createElement('div', {}, 'AI Analysis (1U)')); })()
    ),
  ]);
}

// ── Quick Compare Hook ───────────────────────────────────────────────
export function useStrategyCompare(initialStrategies: StrategyCompareData[] = []) {
  const [strategies, setStrategies] = useState<StrategyCompareData[]>(initialStrategies);
  
  const addStrategy = useCallback((s: StrategyCompareData) => {
    setStrategies(prev => prev.length < 3 ? [...prev, s] : prev);
  }, []);
  
  const removeStrategy = useCallback((id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
  }, []);
  
  const clearAll = useCallback(() => setStrategies([]), []);
  
  return { strategies, addStrategy, removeStrategy, clearAll, setStrategies };
}
