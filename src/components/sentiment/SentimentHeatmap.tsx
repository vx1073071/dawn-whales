// @ts-nocheck
// R242 ML#1: SentimentHeatmap — 3D sentiment heatmap (market × sector × time)
// Grid-based heatmap with drill-down, color intensity, and hover tooltips
import React, { useState, useMemo } from 'react';

export interface SentimentCell {
  market: string;
  sector: string;
  score: number;         // -100 to +100
  change: number;        // day-over-day change
  volume: number;        // mention volume
  confidence: number;    // 0-1
}

export interface SentimentHeatmapProps {
  cells: SentimentCell[];
  markets: string[];
  sectors: string[];
  onCellClick?: (cell: SentimentCell) => void;
  className?: string;
}

function sentimentColor(score: number): string {
  if (score >= 60) return '#22c55e';
  if (score >= 30) return '#84cc16';
  if (score >= 10) return '#a3e635';
  if (score >= -10) return '#94a3b8';
  if (score >= -30) return '#fbbf24';
  if (score >= -60) return '#f59e0b';
  return '#ef4444';
}

export default function SentimentHeatmap({
  cells, markets, sectors, onCellClick, className = '',
}: SentimentHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<SentimentCell | null>(null);
  const cellW = Math.max(40, Math.min(80, 700 / markets.length));
  const cellH = Math.max(28, Math.min(40, 400 / sectors.length));
  
  return React.createElement('div', { className: `sentiment-heatmap ${className}`, style: { padding: 14 } }, [
    React.createElement('div', { key: 'title', style: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)', marginBottom: 10 } }, '🗺️ Market Sentiment Heatmap'),
    
    // Grid
    React.createElement('div', { key: 'grid', style: { overflow: 'auto', borderRadius: 8, border: '1px solid var(--border-color, #334155)' } }, [
      // X-axis labels (markets)
      React.createElement('div', { key: 'xaxis', style: { display: 'flex', marginLeft: 80 } },
        markets.map(m => React.createElement('div', { key: m, style: { width: cellW, textAlign: 'center', fontSize: 9, padding: '4px 0', color: 'var(--text-tertiary, #64748b)', fontWeight: 600 } }, m))
      ),
      // Rows
      ...sectors.map(sector =>
        React.createElement('div', { key: sector, style: { display: 'flex', alignItems: 'center' } }, [
          React.createElement('div', { key: 'label', style: { width: 80, fontSize: 9, color: 'var(--text-tertiary, #64748b)', padding: '0 4px', textAlign: 'right', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, sector),
          ...markets.map(market => {
            const cell = cells.find(c => c.market === market && c.sector === sector);
            if (!cell) return React.createElement('div', { key: market, style: { width: cellW, height: cellH, border: '1px solid var(--border-color, #334155)' } });
            
            const alpha = Math.min(1, Math.abs(cell.score) / 100 * 0.9 + 0.1);
            const color = sentimentColor(cell.score);
            
            return React.createElement('div', {
              key: market,
              onClick: () => onCellClick?.(cell),
              onMouseEnter: () => setHoveredCell(cell),
              onMouseLeave: () => setHoveredCell(null),
              style: {
                width: cellW, height: cellH, cursor: 'pointer',
                background: `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`,
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.1s',
                transform: hoveredCell === cell ? 'scale(1.1)' : 'scale(1)',
                position: 'relative', zIndex: hoveredCell === cell ? 1 : 0,
              },
            }, React.createElement('span', { style: { fontSize: 8, fontWeight: 600, color: Math.abs(cell.score) > 50 ? '#fff' : '#000' } }, cell.score));
          }),
        ])
      ),
    ]),
    
    // Hover tooltip
    hoveredCell && React.createElement('div', { key: 'tooltip', style: {
      padding: '8px 12px', borderRadius: 8, marginTop: 10,
      background: 'var(--surface-2, #1e293b)', border: '1px solid var(--border-color, #334155)',
      fontSize: 11, display: 'inline-block',
    }}, [
      React.createElement('div', { style: { fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' } }, `${hoveredCell.market} · ${hoveredCell.sector}`),
      React.createElement('div', { style: { color: sentimentColor(hoveredCell.score), fontWeight: 700, fontSize: 13 } }, `${hoveredCell.score >= 0 ? '+' : ''}${hoveredCell.score}`),
      React.createElement('div', { style: { color: 'var(--text-tertiary, #64748b)' } }, `Change: ${hoveredCell.change >= 0 ? '+' : ''}${hoveredCell.change} · Vol: ${hoveredCell.volume} · Conf: ${(hoveredCell.confidence * 100).toFixed(0)}%`),
    ]),
    
    // Legend
    React.createElement('div', { key: 'legend', style: { display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', fontSize: 10 } }, [
      React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)' } }, 'Bearish'),
      React.createElement('div', { style: { width: 200, height: 10, borderRadius: 5, background: 'linear-gradient(to right, #ef4444, #f59e0b, #94a3b8, #84cc16, #22c55e)' } }),
      React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)' } }, 'Bullish'),
    ]),
  ]);
}
