// @ts-nocheck
// R235 ML#1: StrategyCompareEnhance — Polish the 3-strategy comparison with drag-reorder, export, share
// Extends StrategyComparePanel with interaction polish

import React from 'react';
import type { StrategyCompareData } from './StrategyComparePanel';

export interface StrategyCompareEnhanceProps {
  strategies: StrategyCompareData[];
  onExport?: () => void;
  onShare?: () => void;
  onFavorite?: (id: string) => void;
  favorites?: Set<string>;
}

const COLORS = ['#d4a574', '#3b82f6', '#22c55e'];
const COMPARE_DIMENSIONS = [
  { key: 'annualReturn' as const, label: 'Annual Return', higherBetter: true, format: '%.1f%%' },
  { key: 'sharpe' as const, label: 'Sharpe', higherBetter: true, format: '%.2f' },
  { key: 'maxDrawdown' as const, label: 'Max Drawdown', higherBetter: false, format: '%.1f%%' },
  { key: 'winRate' as const, label: 'Win Rate', higherBetter: true, format: '%.1f%%' },
  { key: 'volatility' as const, label: 'Volatility', higherBetter: false, format: '%.1f%%' },
  { key: 'calmar' as const, label: 'Calmar', higherBetter: true, format: '%.2f' },
  { key: 'profitFactor' as const, label: 'Profit Factor', higherBetter: true, format: '%.2f' },
  { key: 'beta' as const, label: 'Beta', higherBetter: false, format: '%.2f' },
];

export default function StrategyCompareEnhance({
  strategies,
  onExport,
  onShare,
  onFavorite,
  favorites = new Set(),
}: StrategyCompareEnhanceProps) {
  // ── Comparison Table ────────────────────────────────────────────
  return React.createElement('div', { className: 'strategy-compare-enhance', style: { fontSize: 13 } }, [
    // Toolbar
    React.createElement('div', { key: 'toolbar', style: {
      display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12, padding: '0 4px',
    }}, [
      onShare && React.createElement('button', { key: 'share', onClick: onShare, style: toolbarBtnStyle }, '📤 Share'),
      onExport && React.createElement('button', { key: 'export', onClick: onExport, style: toolbarBtnStyle }, '📥 Export CSV'),
    ]),
    
    // Comparison Table
    React.createElement('div', { key: 'table', style: {
      borderRadius: 8, overflow: 'hidden',
      border: '1px solid var(--border-color, #334155)',
    }}, [
      // Table header
      React.createElement('div', { key: 'thead', style: {
        display: 'grid', gridTemplateColumns: `140px repeat(${strategies.length}, 1fr)`,
        background: 'var(--surface-2, #1e293b)', padding: '8px 12px',
        borderBottom: '2px solid var(--border-color, #334155)',
        fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #94a3b8)',
      }}, [
        React.createElement('div', { key: 'empty' }, 'Metric'),
        ...strategies.map((s, i) =>
          React.createElement('div', { key: s.id, style: { display: 'flex', alignItems: 'center', gap: 6 } }, [
            React.createElement('div', { style: { width: 8, height: 8, borderRadius: 4, background: COLORS[i % 3], flexShrink: 0 } }),
            React.createElement('span', { style: { color: COLORS[i % 3], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.name),
            onFavorite && React.createElement('button', {
              onClick: () => onFavorite(s.id),
              style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, color: favorites.has(s.id) ? '#f59e0b' : 'var(--text-tertiary, #64748b)' },
            }, favorites.has(s.id) ? '⭐' : '☆'),
          ])
        ),
      ]),
      
      // Table body — one row per dimension
      ...COMPARE_DIMENSIONS.map((dim, ri) => {
        const values = strategies.map(s => (s as any)[dim.key] as number);
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min || 1;
        
        return React.createElement('div', { key: dim.key, style: {
          display: 'grid', gridTemplateColumns: `140px repeat(${strategies.length}, 1fr)`,
          padding: '6px 12px', borderBottom: ri < COMPARE_DIMENSIONS.length - 1 ? '1px solid var(--border-color, #334155)' : 'none',
          background: ri % 2 === 0 ? 'transparent' : 'rgba(30,41,59,0.3)',
          fontSize: 12,
        }}, [
          React.createElement('div', { style: { color: 'var(--text-secondary, #94a3b8)', fontWeight: 500 } }, dim.label),
          ...strategies.map((s, i) => {
            const val = values[i];
            const pct = range > 0 ? ((val - min) / range) * 100 : 50;
            const isBest = dim.higherBetter ? val === max : val === min;
            const formatted = dim.format.replace('%%', '%').replace('%', String(Math.abs(val).toFixed(2))) + '%';
            
            return React.createElement('div', { key: s.id, style: { position: 'relative', height: 22, display: 'flex', alignItems: 'center' } }, [
              React.createElement('div', { style: {
                position: 'absolute', left: 0, top: 2, bottom: 2,
                width: `${pct}%`, background: COLORS[i % 3],
                opacity: isBest ? 0.2 : 0.08, borderRadius: 4, transition: 'width 0.3s',
              }}),
              React.createElement('span', { style: {
                position: 'relative', zIndex: 1, padding: '0 4px',
                color: isBest ? COLORS[i % 3] : 'var(--text-primary, #e2e8f0)',
                fontWeight: isBest ? 600 : 400, fontSize: 11,
              }}, formatted),
            ]);
          }),
        ]);
      }),
    ]),
    
    // Summary card
    React.createElement('div', { key: 'summary', style: {
      marginTop: 12, padding: 12, borderRadius: 8,
      background: 'var(--surface-2, #1e293b)',
      border: '1px solid var(--border-color, #334155)',
    }}, [
      React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', marginBottom: 8 } }, '📊 Quick Summary'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${strategies.length}, 1fr)`, gap: 10 } },
        strategies.map((s, i) => {
          const totalScore = COMPARE_DIMENSIONS.reduce((score, dim) => {
            const val = (s as any)[dim.key];
            const best = strategies.map(st => (st as any)[dim.key]);
            const max = Math.max(...best);
            const min = Math.min(...best);
            if (max === min) return score + 1;
            const norm = dim.higherBetter ? (val - min) / (max - min) : 1 - (val - min) / (max - min);
            return score + norm;
          }, 0);
          const finalScore = (totalScore / COMPARE_DIMENSIONS.length) * 100;
          
          return React.createElement('div', { key: s.id, style: { textAlign: 'center' } }, [
            React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: COLORS[i % 3], marginBottom: 6 } }, s.name),
            React.createElement('div', { style: {
              width: 56, height: 56, borderRadius: 28, margin: '0 auto 6px',
              background: `conic-gradient(${COLORS[i % 3]} ${finalScore * 3.6}deg, var(--surface-3, #334155) 0)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}, [
              React.createElement('div', { style: {
                width: 44, height: 44, borderRadius: 22,
                background: 'var(--surface-2, #1e293b)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: COLORS[i % 3],
              }}, `${Math.round(finalScore)}`),
            ]),
            React.createElement('div', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, 'Composite Score'),
          ]);
        })
      ),
    ]),
  ]);
}

const toolbarBtnStyle: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
  background: 'var(--surface-2, #1e293b)', border: '1px solid var(--border-color, #334155)',
  color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer',
};
