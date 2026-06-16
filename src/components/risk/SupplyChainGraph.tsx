// @ts-nocheck
// R240 ML#2: SupplyChainGraph — Supply chain impact visualization
// Node-relation diagram + affected stock list with severity indicators
import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface SupplyChainNode {
  id: string;
  label: string;
  type: 'event' | 'sector' | 'company' | 'supplier' | 'customer';
  x: number;
  y: number;
  impact: 'critical' | 'high' | 'medium' | 'low';
  details?: string;
}

export interface SupplyChainEdge {
  from: string;
  to: string;
  label: string;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface AffectedStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  impact: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  position?: 'supplier' | 'customer' | 'competitor' | 'related';
}

export interface SupplyChainData {
  title: string;
  event: string;
  eventDate: string;
  summary: string;
  nodes: SupplyChainNode[];
  edges: SupplyChainEdge[];
  affectedStocks: AffectedStock[];
}

export interface SupplyChainGraphProps {
  data: SupplyChainData;
  onStockClick?: (symbol: string) => void;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────
const IMPACT_COLORS = {
  critical: { bg: '#ef4444', border: '#ef4444', text: '#ef4444', glow: '#ef444440' },
  high:     { bg: '#f59e0b', border: '#f59e0b', text: '#f59e0b', glow: '#f59e0b40' },
  medium:   { bg: '#3b82f6', border: '#3b82f6', text: '#3b82f6', glow: '#3b82f640' },
  low:      { bg: '#22c55e', border: '#22c55e', text: '#22c55e', glow: '#22c55e40' },
};

const TYPE_SHAPES: Record<string, { shape: string; size: number }> = {
  event:    { shape: 'diamond', size: 40 },
  sector:   { shape: 'rect', size: 30 },
  company:  { shape: 'circle', size: 28 },
  supplier: { shape: 'circle', size: 20 },
  customer: { shape: 'circle', size: 20 },
};

const EDGE_STYLES = {
  strong:   { strokeWidth: 2.5, opacity: 0.8 },
  moderate: { strokeWidth: 1.5, opacity: 0.5, dash: '6,3' },
  weak:     { strokeWidth: 1, opacity: 0.3, dash: '3,3' },
};

const POSITION_LABELS: Record<string, { label: string; color: string }> = {
  supplier:   { label: 'Supplier', color: '#f59e0b' },
  customer:   { label: 'Customer', color: '#3b82f6' },
  competitor: { label: 'Competitor', color: '#ef4444' },
  related:    { label: 'Related', color: '#94a3b8' },
};

// ── SVG Graph ────────────────────────────────────────────────────────
function SupplyChainSVG({ data }: { data: SupplyChainData }) {
  const w = 600;
  const h = 350;
  
  return React.createElement('svg', { width: '100%', height: h, viewBox: `0 0 ${w} ${h}`, style: { background: 'var(--surface-1, #0f172a)' } }, [
    // Edges
    ...data.edges.map((edge, i) => {
      const fromNode = data.nodes.find(n => n.id === edge.from);
      const toNode = data.nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return null;
      const style = EDGE_STYLES[edge.strength];
      return React.createElement('g', { key: `edge-${i}` }, [
        React.createElement('line', {
          x1: fromNode.x, y1: fromNode.y, x2: toNode.x, y2: toNode.y,
          stroke: 'var(--border-color, #334155)', strokeWidth: style.strokeWidth,
          strokeDasharray: (style as any).dash || 'none', opacity: style.opacity,
        }),
        React.createElement('text', {
          x: (fromNode.x + toNode.x) / 2, y: (fromNode.y + toNode.y) / 2 - 6,
          textAnchor: 'middle', fill: 'var(--text-tertiary, #64748b)', fontSize: 8,
        }, edge.label),
      ]);
    }),
    // Nodes
    ...data.nodes.map(node => {
      const impact = IMPACT_COLORS[node.impact];
      const shape = TYPE_SHAPES[node.type];
      const r = shape.size / 2;
      
      // Glow
      const glow = React.createElement('circle', { cx: node.x, cy: node.y, r: r + 6, fill: impact.glow, opacity: 0.3 });
      
      // Node shape
      let shapeEl;
      if (node.type === 'event') {
        shapeEl = React.createElement('polygon', {
          points: `${node.x},${node.y - r} ${node.x + r},${node.y} ${node.x},${node.y + r} ${node.x - r},${node.y}`,
          fill: impact.bg, stroke: impact.border, strokeWidth: 2, opacity: 0.8,
        });
      } else if (node.type === 'sector') {
        shapeEl = React.createElement('rect', {
          x: node.x - r, y: node.y - r / 2, width: shape.size, height: r,
          fill: impact.bg, stroke: impact.border, strokeWidth: 2, rx: 4, opacity: 0.7,
        });
      } else {
        shapeEl = React.createElement('circle', {
          cx: node.x, cy: node.y, r, fill: impact.bg, stroke: impact.border, strokeWidth: 2, opacity: 0.7,
        });
      }
      
      return React.createElement('g', { key: `node-${node.id}` }, [
        glow,
        shapeEl,
        React.createElement('text', {
          x: node.x, y: node.y + shape.size / 2 + 12,
          textAnchor: 'middle', fill: 'var(--text-secondary, #94a3b8)', fontSize: 9, fontWeight: 600,
        }, node.label),
      ]);
    }),
  ]);
}

// ── Main Component ───────────────────────────────────────────────────
export default function SupplyChainGraph({
  data, onStockClick, className = '',
}: SupplyChainGraphProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all');
  
  const filteredStocks = useMemo(() => {
    if (filter === 'all') return data.affectedStocks;
    return data.affectedStocks.filter(s => s.impact === filter);
  }, [data.affectedStocks, filter]);
  
  const stats = useMemo(() => ({
    critical: data.affectedStocks.filter(s => s.impact === 'critical').length,
    high: data.affectedStocks.filter(s => s.impact === 'high').length,
    medium: data.affectedStocks.filter(s => s.impact === 'medium').length,
    total: data.affectedStocks.length,
  }), [data.affectedStocks]);
  
  return React.createElement('div', { className: `supply-chain ${className}`, style: { display: 'flex', flexDirection: 'column', height: '100%' } }, [
    // Event header
    React.createElement('div', { key: 'event-bar', style: {
      padding: '10px 14px', background: 'var(--surface-2, #1e293b)',
      borderLeft: '4px solid #ef4444',
    }}, [
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } }, [
        React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: '#ef4444' } }, '🔴 Supply Chain Event'),
        React.createElement('span', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, data.eventDate),
      ]),
      React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' } }, data.event),
      React.createElement('div', { style: { fontSize: 11, color: 'var(--text-secondary, #94a3b8)', marginTop: 4, lineHeight: 1.5 } }, data.summary),
    ]),
    
    // Graph
    React.createElement('div', { key: 'graph', style: { padding: '8px 0' } },
      React.createElement(SupplyChainSVG, { data })
    ),
    
    // Legend
    React.createElement('div', { key: 'legend', style: { display: 'flex', gap: 12, padding: '4px 14px', flexWrap: 'wrap', fontSize: 10, borderBottom: '1px solid var(--border-color, #334155)' } }, [
      React.createElement('span', { style: { color: '#ef4444' } }, '🔴 Critical'),
      React.createElement('span', { style: { color: '#f59e0b' } }, '🟠 High'),
      React.createElement('span', { style: { color: '#3b82f6' } }, '🔵 Medium'),
      React.createElement('span', { style: { color: '#22c55e' } }, '🟢 Low'),
      React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)' } }, '━ Strong'),
      React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)' } }, '┅ Moderate'),
      React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)' } }, '⋯ Weak'),
    ]),
    
    // Stats + filter
    React.createElement('div', { key: 'stock-header', style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 14px', borderBottom: '1px solid var(--border-color, #334155)',
    }}, [
      React.createElement('div', { key: 'stats', style: { display: 'flex', gap: 12, fontSize: 11 } }, [
        React.createElement('span', { style: { color: 'var(--text-primary, #e2e8f0)', fontWeight: 600 } }, `📊 Affected: ${stats.total} stocks`),
        React.createElement('span', { style: { color: '#ef4444', fontWeight: 600 } }, `🔴 ${stats.critical}`),
        React.createElement('span', { style: { color: '#f59e0b', fontWeight: 600 } }, `🟠 ${stats.high}`),
        React.createElement('span', { style: { color: '#3b82f6', fontWeight: 600 } }, `🔵 ${stats.medium}`),
      ]),
      React.createElement('div', { key: 'filter', style: { display: 'flex', gap: 4 } },
        (['all', 'critical', 'high'] as const).map(f =>
          React.createElement('button', {
            key: f, onClick: () => setFilter(f),
            style: {
              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 500,
              border: filter === f ? '1px solid var(--brand, #d4a574)' : '1px solid var(--border-color, #334155)',
              background: filter === f ? 'var(--brand-bg, rgba(212,165,116,0.15))' : 'transparent',
              color: filter === f ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
            },
          }, f === 'all' ? 'All' : f.toUpperCase())
        )
      ),
    ]),
    
    // Affected stocks table
    React.createElement('div', { key: 'stocks', style: { flex: 1, overflow: 'auto' } },
      filteredStocks.length === 0
        ? React.createElement('div', { style: { padding: 30, textAlign: 'center', color: 'var(--text-tertiary, #64748b)', fontSize: 12 } }, 'No stocks match filter')
        : React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } }, [
            // Table header
            React.createElement('div', { key: 'thead', style: {
              display: 'grid', gridTemplateColumns: '80px 1fr 70px 80px 100px 1fr',
              padding: '6px 14px', borderBottom: '2px solid var(--border-color, #334155)',
              fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary, #64748b)',
              position: 'sticky', top: 0, background: 'var(--surface-1, #0f172a)', zIndex: 1,
            }}, [
              React.createElement('div', { key: 'sym' }, 'Symbol'),
              React.createElement('div', { key: 'name' }, 'Name'),
              React.createElement('div', { key: 'price' }, 'Price'),
              React.createElement('div', { key: 'chg' }, 'Change'),
              React.createElement('div', { key: 'pos' }, 'Position'),
              React.createElement('div', { key: 'reason' }, 'Reason'),
            ]),
            // Table rows
            ...filteredStocks.map((stock, i) => {
              const impact = IMPACT_COLORS[stock.impact];
              const isUp = stock.change >= 0;
              const pos = POSITION_LABELS[stock.position || 'related'];
              
              return React.createElement('div', {
                key: stock.symbol,
                onClick: () => onStockClick?.(stock.symbol),
                style: {
                  display: 'grid', gridTemplateColumns: '80px 1fr 70px 80px 100px 1fr',
                  padding: '6px 14px', cursor: 'pointer', fontSize: 11, alignItems: 'center',
                  borderBottom: '1px solid var(--border-color, #334155)',
                  borderLeft: `3px solid ${impact.border}`,
                  background: i % 2 === 0 ? 'transparent' : 'rgba(30,41,59,0.2)',
                },
              }, [
                React.createElement('span', { key: 'sym', style: { fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' } }, stock.symbol),
                React.createElement('span', { key: 'name', style: { color: 'var(--text-secondary, #94a3b8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, stock.name),
                React.createElement('span', { key: 'price', style: { color: 'var(--text-primary, #e2e8f0)' } }, stock.price.toFixed(2)),
                React.createElement('span', { key: 'chg', style: { color: isUp ? '#22c55e' : '#ef4444', fontWeight: 600 } }, `${isUp ? '+' : ''}${stock.change.toFixed(1)}%`),
                React.createElement('span', { key: 'pos', style: {
                  padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 500, justifySelf: 'start',
                  background: `${pos.color}15`, color: pos.color,
                }}, pos.label),
                React.createElement('span', { key: 'reason', style: { color: 'var(--text-tertiary, #64748b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 } }, stock.reason),
              ]);
            }),
          ])
    ),
  ]);
}
