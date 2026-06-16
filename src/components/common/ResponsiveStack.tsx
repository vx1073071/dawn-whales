// R231 ML#1: ResponsiveStack — Flexbox with responsive direction/gap
import React from 'react';
import { useResponsive, BreakpointValue } from '../../hooks/useResponsive';

export interface ResponsiveStackProps {
  children: React.ReactNode;
  direction?: BreakpointValue<'row' | 'column'>;
  gap?: BreakpointValue<number>;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const JUSTIFY_MAP: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  between: 'space-between', around: 'space-around',
};

export default function ResponsiveStack({
  children,
  direction = { sm: 'column', md: 'row', lg: 'row' },
  gap = { sm: 8, md: 12, lg: 16 },
  align = 'start',
  justify = 'start',
  wrap = true,
  className = '',
  style,
}: ResponsiveStackProps) {
  const { breakpoint } = useResponsive();
  const dir = direction[breakpoint] ?? direction.sm ?? 'row';
  const gapSize = gap[breakpoint] ?? gap.sm ?? 8;
  
  return (
    <div
      className={`responsive-stack ${className}`}
      style={{
        display: 'flex',
        flexDirection: dir,
        gap: gapSize,
        alignItems: align === 'stretch' ? 'stretch' : align,
        justifyContent: JUSTIFY_MAP[justify] ?? 'flex-start',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
