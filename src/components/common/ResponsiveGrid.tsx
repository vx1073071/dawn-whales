// R231 ML#1: ResponsiveGrid — Breakpoint-aware grid system
import React from 'react';
import { useResponsive, BreakpointValue } from '../../hooks/useResponsive';

export interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: BreakpointValue<number>;
  gap?: BreakpointValue<number>;
  itemMinWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_COLS: BreakpointValue<number> = { sm: 1, md: 2, lg: 3 };
const DEFAULT_GAP: BreakpointValue<number> = { sm: 8, md: 12, lg: 16 };

export default function ResponsiveGrid({
  children,
  cols = DEFAULT_COLS,
  gap = DEFAULT_GAP,
  itemMinWidth = 280,
  className = '',
  style,
}: ResponsiveGridProps) {
  const { breakpoint } = useResponsive();
  const columnCount = cols[breakpoint] ?? cols.sm ?? 1;
  const gapSize = (gap[breakpoint] ?? gap.sm ?? 8);

  return (
    <div
      className={`responsive-grid ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: columnCount > 0
          ? `repeat(${columnCount}, 1fr)`
          : `repeat(auto-fill, minmax(${itemMinWidth}px, 1fr))`,
        gap: gapSize,
        ...style,
      }}
    >
      {React.Children.map(children, (child, i) => (
        <div key={i} className="responsive-grid-item">
          {child}
        </div>
      ))}
    </div>
  );
}
