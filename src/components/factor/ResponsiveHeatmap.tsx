// @ts-nocheck
// R231 ML#1: ResponsiveHeatmap — Small-window optimized factor heatmap
// Breaks 16-category grid into scrollable single-column on mobile
// Tablet: 2-column layout  
// Desktop: 4-column grid with full detail

import { useMemo, useState } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import ResponsiveCard from '../common/ResponsiveCard';

export interface HeatmapCell {
  factorId: string;
  nameCN: string;
  categoryCN: string;
  signalStrength: number; // 0-100
  trend: 'up' | 'down' | 'flat';
  ic?: number;
}

export interface ResponsiveHeatmapProps {
  cells: HeatmapCell[];
  onCellClick?: (cell: HeatmapCell) => void;
  className?: string;
}

// Color-blind friendly signal strength colors
function strengthColor(strength: number): string {
  if (strength >= 80) return '#f59e0b'; // amber (strong)
  if (strength >= 60) return '#84cc16'; // lime (good)
  if (strength >= 40) return '#22c55e'; // green (moderate)
  if (strength >= 20) return '#94a3b8'; // grey (weak)
  return '#64748b'; // dark grey (very weak)
}

function trendIcon(trend: 'up' | 'down' | 'flat'): string {
  if (trend === 'up') return '▲';
  if (trend === 'down') return '▼';
  return '─';
}

function trendColor(trend: 'up' | 'down' | 'flat'): string {
  if (trend === 'up') return '#22c55e';
  if (trend === 'down') return '#ef4444';
  return '#94a3b8';
}

export default function ResponsiveHeatmap({
  cells,
  onCellClick,
  className = '',
}: ResponsiveHeatmapProps) {
  const { isMobile, isTablet } = useResponsive();
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  
  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, HeatmapCell[]> = {};
    cells.forEach(c => {
      if (!groups[c.categoryCN]) groups[c.categoryCN] = [];
      groups[c.categoryCN].push(c);
    });
    // Sort cells by signal strength within each group
    Object.values(groups).forEach(g => g.sort((a, b) => b.signalStrength - a.signalStrength));
    return groups;
  }, [cells]);
  
  const categories = Object.keys(grouped);
  
  // Desktop: full grid
  if (!isMobile && !isTablet) {
    return (
      <div className={`responsive-heatmap-desktop ${className}`}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(320px, 1fr))`, gap: 12 }}>
          {categories.map(cat => (
            <ResponsiveCard key={cat} title={cat} collapsible defaultCollapsed={false}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
                {grouped[cat].map(cell => (
                  <div
                    key={cell.factorId}
                    onClick={() => onCellClick?.(cell)}
                    style={{
                      padding: '6px 4px', textAlign: 'center', borderRadius: 6,
                      background: `${strengthColor(cell.signalStrength)}15`,
                      border: `1px solid ${strengthColor(cell.signalStrength)}40`,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    title={`${cell.nameCN}: ${cell.signalStrength}/100 | IC: ${cell.ic?.toFixed(3) || 'N/A'}`}
                  >
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary, #e2e8f0)' }}>
                      {cell.nameCN}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: strengthColor(cell.signalStrength) }}>
                        {cell.signalStrength}
                      </span>
                      <span style={{ fontSize: 10, color: trendColor(cell.trend) }}>
                        {trendIcon(cell.trend)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ResponsiveCard>
          ))}
        </div>
      </div>
    );
  }
  
  // Tablet: 2-column
  if (isTablet) {
    return (
      <div className={`responsive-heatmap-tablet ${className}`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {categories.map(cat => (
            <ResponsiveCard key={cat} title={cat} collapsible>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {grouped[cat].slice(0, 6).map(cell => (
                  <div
                    key={cell.factorId}
                    onClick={() => onCellClick?.(cell)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '4px 6px', borderRadius: 4,
                      background: `${strengthColor(cell.signalStrength)}10`,
                      cursor: 'pointer', fontSize: 11,
                    }}
                  >
                    <span style={{ color: 'var(--text-primary, #e2e8f0)' }}>{cell.nameCN}</span>
                    <span style={{ color: strengthColor(cell.signalStrength), fontWeight: 600 }}>
                      {cell.signalStrength} {trendIcon(cell.trend)}
                    </span>
                  </div>
                ))}
                {grouped[cat].length > 6 && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary, #64748b)', textAlign: 'center' }}>
                    +{grouped[cat].length - 6} more
                  </div>
                )}
              </div>
            </ResponsiveCard>
          ))}
        </div>
      </div>
    );
  }
  
  // Mobile: single-column scroll with expand
  return (
    <div className={`responsive-heatmap-mobile ${className}`}>
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <div
            onClick={() => setExpandedCell(expandedCell === cat ? null : cat)}
            style={{
              padding: '8px 10px', borderRadius: 6,
              background: 'var(--surface-2, #1e293b)',
              display: 'flex', justifyContent: 'space-between',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: 'var(--text-primary, #e2e8f0)',
            }}
          >
            <span>{cat}</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary, #64748b)' }}>
              {grouped[cat].length} · {expandedCell === cat ? '▲' : '▼'}
            </span>
          </div>
          {expandedCell === cat && (
            <div style={{ padding: '6px 0' }}>
              {grouped[cat].map(cell => (
                <div
                  key={cell.factorId}
                  onClick={() => onCellClick?.(cell)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', borderBottom: '1px solid var(--border-color, #334155)',
                    cursor: 'pointer', fontSize: 12,
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--text-primary, #e2e8f0)', fontWeight: 500 }}>
                      {cell.nameCN}
                    </div>
                    {cell.ic !== undefined && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #64748b)', marginTop: 1 }}>
                        IC: {cell.ic.toFixed(3)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 40, height: 6, borderRadius: 3,
                      background: 'var(--surface-3, #334155)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${cell.signalStrength}%`, height: '100%',
                        background: strengthColor(cell.signalStrength), borderRadius: 3,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, minWidth: 22, textAlign: 'right',
                      color: strengthColor(cell.signalStrength),
                    }}>
                      {cell.signalStrength}
                    </span>
                    <span style={{ fontSize: 10, color: trendColor(cell.trend) }}>
                      {trendIcon(cell.trend)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
