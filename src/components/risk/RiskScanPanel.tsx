// @ts-nocheck
// R240 ML#1: RiskScanPanel — Risk scanning dashboard with positions, risk levels, and 1-click actions
// Scans portfolio for risk factors: concentration, volatility, correlation, drawdown
import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface RiskScanItem {
  id: string;
  symbol: string;
  name: string;
  positionValue: number;
  allocation: number;      // % of portfolio
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  riskScore: number;        // 0-100
  riskFactors: RiskFactor[];
  suggestedAction: string;
  actionType: 'reduce' | 'hedge' | 'monitor' | 'exit' | 'hold';
  stopLoss?: number;
  currentDrawdown: number;
  volatility: number;
  correlation: number;      // to portfolio
}

export interface RiskFactor {
  name: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export interface RiskScanPanelProps {
  items: RiskScanItem[];
  totalValue: number;
  onExecuteAction?: (item: RiskScanItem, action: string) => void;
  onViewDetail?: (item: RiskScanItem) => void;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────
const RISK_COLORS = {
  critical: { bg: '#ef444415', border: '#ef4444', text: '#ef4444', label: 'CRITICAL', icon: '🔴' },
  high:     { bg: '#f59e0b15', border: '#f59e0b', text: '#f59e0b', label: 'HIGH', icon: '🟠' },
  medium:   { bg: '#3b82f615', border: '#3b82f6', text: '#3b82f6', label: 'MEDIUM', icon: '🔵' },
  low:      { bg: '#22c55e15', border: '#22c55e', text: '#22c55e', label: 'LOW', icon: '🟢' },
};

const ACTION_COLORS = {
  exit:    { bg: '#ef444420', color: '#ef4444', label: 'Exit Position' },
  reduce:  { bg: '#f59e0b20', color: '#f59e0b', label: 'Reduce' },
  hedge:   { bg: '#3b82f620', color: '#3b82f6', label: 'Hedge' },
  monitor: { bg: '#94a3b820', color: '#94a3b8', label: 'Monitor' },
  hold:    { bg: '#22c55e20', color: '#22c55e', label: 'Hold' },
};

const SEVERITY_ICONS = { high: '⚠️', medium: '⚡', low: 'ℹ️' };

// ── Component ────────────────────────────────────────────────────────
export default function RiskScanPanel({
  items, totalValue, onExecuteAction, onViewDetail, className = '',
}: RiskScanPanelProps) {
  const [sortBy, setSortBy] = useState<'riskScore' | 'allocation' | 'drawdown'>('riskScore');
  const [filterLevel, setFilterLevel] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  const sorted = useMemo(() => {
    let list = [...items];
    if (filterLevel !== 'all') list = list.filter(i => i.riskLevel === filterLevel);
    list.sort((a, b) => {
      if (sortBy === 'riskScore') return b.riskScore - a.riskScore;
      if (sortBy === 'allocation') return b.allocation - a.allocation;
      return b.currentDrawdown - a.currentDrawdown;
    });
    return list;
  }, [items, filterLevel, sortBy]);
  
  const stats = useMemo(() => ({
    critical: items.filter(i => i.riskLevel === 'critical').length,
    high: items.filter(i => i.riskLevel === 'high').length,
    medium: items.filter(i => i.riskLevel === 'medium').length,
    avgScore: items.length > 0 ? Math.round(items.reduce((s, i) => s + i.riskScore, 0) / items.length) : 0,
    atRiskValue: items.filter(i => i.riskLevel === 'critical' || i.riskLevel === 'high').reduce((s, i) => s + i.positionValue, 0),
  }), [items]);
  
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  
  return React.createElement('div', { className: `risk-scan ${className}`, style: { display: 'flex', flexDirection: 'column', height: '100%' } }, [
    // Header
    React.createElement('div', { key: 'header', style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px', borderBottom: '1px solid var(--border-color, #334155)',
      flexWrap: 'wrap', gap: 8,
    }}, [
      React.createElement('div', { key: 'title', style: { display: 'flex', alignItems: 'center', gap: 8 } }, [
        React.createElement('span', { style: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' } }, '🛡️ Risk Scan'),
        React.createElement('span', { style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)' } }, `${items.length} positions`),
      ]),
      React.createElement('div', { key: 'sort', style: { display: 'flex', gap: 4 } },
        (['riskScore', 'allocation', 'drawdown'] as const).map(k =>
          React.createElement('button', {
            key: k, onClick: () => setSortBy(k),
            style: {
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              border: sortBy === k ? '1px solid var(--brand, #d4a574)' : '1px solid var(--border-color, #334155)',
              background: sortBy === k ? 'var(--brand-bg, rgba(212,165,116,0.15))' : 'transparent',
              color: sortBy === k ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
            },
          }, k === 'riskScore' ? 'Risk' : k === 'allocation' ? 'Size' : 'Drawdown')
        )
      ),
    ]),
    
    // Stats bar
    React.createElement('div', { key: 'stats', style: {
      display: 'flex', gap: 12, padding: '8px 14px',
      borderBottom: '1px solid var(--border-color, #334155)',
      fontSize: 11, overflow: 'auto',
    }}, [
      React.createElement('span', { style: { color: '#ef4444', fontWeight: 600 } }, `🔴 Critical: ${stats.critical}`),
      React.createElement('span', { style: { color: '#f59e0b', fontWeight: 600 } }, `🟠 High: ${stats.high}`),
      React.createElement('span', { style: { color: '#3b82f6', fontWeight: 600 } }, `🔵 Medium: ${stats.medium}`),
      React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)' } }, `Avg Score: ${stats.avgScore}/100`),
      React.createElement('span', { style: { color: '#ef4444', fontWeight: 600 } }, `At Risk: $${(stats.atRiskValue / 1000).toFixed(1)}K`),
    ]),
    
    // Level filter
    React.createElement('div', { key: 'filters', style: {
      display: 'flex', gap: 4, padding: '6px 14px',
      borderBottom: '1px solid var(--border-color, #334155)',
      overflow: 'auto',
    }},
      (['all', 'critical', 'high', 'medium'] as const).map(level =>
        React.createElement('button', {
          key: level, onClick: () => setFilterLevel(level),
          style: {
            padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
            border: filterLevel === level ? `1px solid ${RISK_COLORS[level]?.border || '#94a3b8'}` : '1px solid transparent',
            background: filterLevel === level ? `${RISK_COLORS[level]?.bg || '#94a3b815'}` : 'transparent',
            color: filterLevel === level ? (RISK_COLORS[level]?.text || '#94a3b8') : 'var(--text-secondary, #94a3b8)',
            cursor: 'pointer', whiteSpace: 'nowrap',
          },
        }, level === 'all' ? 'All' : `${RISK_COLORS[level]?.icon} ${level.toUpperCase()}`)
      )
    ),
    
    // Risk items
    React.createElement('div', { key: 'list', style: { flex: 1, overflow: 'auto' } },
      sorted.length === 0
        ? React.createElement('div', { style: { padding: 40, textAlign: 'center', color: 'var(--text-tertiary, #64748b)', fontSize: 13 } }, 'No positions match this risk filter')
        : sorted.map(item => {
            const risk = RISK_COLORS[item.riskLevel];
            const action = ACTION_COLORS[item.actionType];
            const isExpanded = expandedIds.has(item.id);
            const allocationPct = item.allocation;
            
            return React.createElement('div', { key: item.id, style: {
              borderBottom: '1px solid var(--border-color, #334155)',
              borderLeft: `3px solid ${risk.border}`,
            }}, [
              // Row header
              React.createElement('div', {
                onClick: () => toggleExpand(item.id),
                style: {
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', cursor: 'pointer',
                  background: isExpanded ? 'var(--surface-2, #1e293b)' : 'transparent',
                },
              }, [
                // Left: symbol + risk
                React.createElement('div', { key: 'left', style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
                  React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' } }, item.symbol),
                  React.createElement('span', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, item.name),
                  React.createElement('span', { style: {
                    padding: '1px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                    background: risk.bg, color: risk.text, border: `1px solid ${risk.border}40`,
                  }}, risk.label),
                ]),
                // Right: allocation + score + action
                React.createElement('div', { key: 'right', style: { display: 'flex', alignItems: 'center', gap: 12 } }, [
                  // Allocation bar
                  React.createElement('div', { style: { width: 60, display: 'flex', alignItems: 'center', gap: 4 } }, [
                    React.createElement('div', { style: { flex: 1, height: 4, borderRadius: 2, background: 'var(--surface-3, #334155)', overflow: 'hidden' } },
                      React.createElement('div', { style: { width: `${Math.min(allocationPct, 100)}%`, height: '100%', background: allocationPct > 20 ? '#ef4444' : allocationPct > 10 ? '#f59e0b' : '#22c55e', borderRadius: 2 } })
                    ),
                    React.createElement('span', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)', width: 32, textAlign: 'right' } }, `${allocationPct.toFixed(1)}%`),
                  ]),
                  React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: risk.text, width: 32, textAlign: 'center' } }, item.riskScore),
                  React.createElement('button', {
                    onClick: (e: any) => { e.stopPropagation(); onExecuteAction?.(item, item.actionType); },
                    style: {
                      padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      background: action.bg, color: action.color, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    },
                  }, action.label),
                  React.createElement('span', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, isExpanded ? '▲' : '▼'),
                ]),
              ]),
              
              // Expanded detail
              isExpanded && React.createElement('div', { style: { padding: '8px 14px 12px', background: 'var(--surface-2, #1e293b)' } }, [
                // Metrics row
                React.createElement('div', { key: 'metrics', style: { display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' } }, [
                  React.createElement('div', { key: 'value', style: { fontSize: 11 } }, [
                    React.createElement('div', { style: { color: 'var(--text-tertiary, #64748b)' } }, 'Position'),
                    React.createElement('div', { style: { color: 'var(--text-primary, #e2e8f0)', fontWeight: 600 } }, `$${(item.positionValue / 1000).toFixed(1)}K`),
                  ]),
                  React.createElement('div', { key: 'dd', style: { fontSize: 11 } }, [
                    React.createElement('div', { style: { color: 'var(--text-tertiary, #64748b)' } }, 'Drawdown'),
                    React.createElement('div', { style: { color: '#ef4444', fontWeight: 600 } }, `${item.currentDrawdown.toFixed(1)}%`),
                  ]),
                  React.createElement('div', { key: 'vol', style: { fontSize: 11 } }, [
                    React.createElement('div', { style: { color: 'var(--text-tertiary, #64748b)' } }, 'Volatility'),
                    React.createElement('div', { style: { color: 'var(--text-primary, #e2e8f0)', fontWeight: 600 } }, `${item.volatility.toFixed(1)}%`),
                  ]),
                  React.createElement('div', { key: 'corr', style: { fontSize: 11 } }, [
                    React.createElement('div', { style: { color: 'var(--text-tertiary, #64748b)' } }, 'Correlation'),
                    React.createElement('div', { style: { color: item.correlation > 0.7 ? '#ef4444' : 'var(--text-primary, #e2e8f0)', fontWeight: 600 } }, item.correlation.toFixed(2)),
                  ]),
                  item.stopLoss && React.createElement('div', { key: 'sl', style: { fontSize: 11 } }, [
                    React.createElement('div', { style: { color: 'var(--text-tertiary, #64748b)' } }, 'Stop Loss'),
                    React.createElement('div', { style: { color: '#f59e0b', fontWeight: 600 } }, `$${item.stopLoss.toFixed(2)}`),
                  ]),
                ]),
                // Risk factors
                React.createElement('div', { key: 'factors', style: { marginBottom: 10 } }, [
                  React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 } }, 'Risk Factors'),
                  ...item.riskFactors.map((rf, ri) =>
                    React.createElement('div', { key: ri, style: { display: 'flex', gap: 6, padding: '3px 0', fontSize: 10 } }, [
                      React.createElement('span', { style: { color: rf.severity === 'high' ? '#ef4444' : rf.severity === 'medium' ? '#f59e0b' : '#94a3b8' } }, SEVERITY_ICONS[rf.severity]),
                      React.createElement('span', { style: { color: 'var(--text-secondary, #94a3b8)' } }, rf.name),
                      React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)' } }, rf.description),
                    ])
                  ),
                ]),
                // Suggested action
                React.createElement('div', { key: 'suggestion', style: {
                  padding: 8, borderRadius: 6, fontSize: 11,
                  background: action.bg, border: `1px solid ${action.color}30`,
                  color: 'var(--text-secondary, #94a3b8)',
                }}, [
                  React.createElement('span', { style: { fontWeight: 600, color: action.color } }, '💡 Suggested: '),
                  item.suggestedAction,
                ]),
              ]),
            ]);
          })
    ),
  ]);
}
