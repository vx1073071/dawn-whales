// ── R230 ML#2: useResponsive — Responsive breakpoint system ──────
// 3-tier breakpoints: sm (<640px) / md (640-1024px) / lg (1024px+)
// Hook + Grid system + FactorSelector responsive wrapper
// CSS-in-JS breakpoint utilities

import { useState, useEffect, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export type Breakpoint = 'sm' | 'md' | 'lg';
export type BreakpointValue<T> = { sm: T; md?: T; lg?: T };

export interface ResponsiveConfig {
  breakpoint: Breakpoint;
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
}

// ── Breakpoint thresholds ──────────────────────────────────────────
export const BREAKPOINTS = {
  sm: { max: 639 },
  md: { min: 640, max: 1023 },
  lg: { min: 1024 },
} as const;

// ── Hook ────────────────────────────────────────────────────────────
export function useResponsive(): ResponsiveConfig {
  const [config, setConfig] = useState<ResponsiveConfig>(getConfig());

  useEffect(() => {
    let rafId: number;
    let lastWidth = 0;
    let lastHeight = 0;

    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === lastWidth && h === lastHeight) return;
      lastWidth = w;
      lastHeight = h;

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setConfig(getConfig()));
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return config;
}

function getConfig(): ResponsiveConfig {
  if (typeof window === 'undefined') {
    return { breakpoint: 'md', width: 1024, height: 768, isMobile: false, isTablet: true, isDesktop: false, orientation: 'landscape' };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const bp: Breakpoint = w < 640 ? 'sm' : w < 1024 ? 'md' : 'lg';
  return {
    breakpoint: bp,
    width: w,
    height: h,
    isMobile: bp === 'sm',
    isTablet: bp === 'md',
    isDesktop: bp === 'lg',
    orientation: h > w ? 'portrait' : 'landscape',
  };
}

// ── Responsive value helper ────────────────────────────────────────
export function useResponsiveValue<T>(values: BreakpointValue<T>): T {
  const { breakpoint } = useResponsive();
  return (values[breakpoint] ?? values.sm) as T;
}

// ── Responsive grid ────────────────────────────────────────────────
export interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: BreakpointValue<number>;
  gap?: BreakpointValue<number>;
  style?: React.CSSProperties;
  className?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children, cols = { sm: 1, md: 2, lg: 3 }, gap = { sm: 8, md: 12, lg: 16 }, style, className,
}) => {
  const { breakpoint } = useResponsive();
  const colCount = (cols[breakpoint] ?? cols.sm) || 1;
  const gapSize = (gap[breakpoint] ?? gap.sm) || 8;

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${colCount}, 1fr)`,
        gap: gapSize,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ── Responsive visible/hidden ──────────────────────────────────────
export const ResponsiveVisible: React.FC<{ at: Breakpoint | Breakpoint[]; children: React.ReactNode }> = ({ at, children }) => {
  const { breakpoint } = useResponsive();
  const visible = Array.isArray(at) ? at.includes(breakpoint) : at === breakpoint;
  return visible ? <>{children}</> : null;
};

export const ResponsiveHidden: React.FC<{ at: Breakpoint | Breakpoint[]; children: React.ReactNode }> = ({ at, children }) => {
  const { breakpoint } = useResponsive();
  const hidden = Array.isArray(at) ? at.includes(breakpoint) : at === breakpoint;
  return hidden ? null : <>{children}</>;
};

// ── Responsive container ───────────────────────────────────────────
export const ResponsiveContainer: React.FC<{
  children: React.ReactNode; fluid?: boolean; maxWidth?: number; style?: React.CSSProperties;
}> = ({ children, fluid, maxWidth = 1280, style }) => {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: fluid ? '100%' : maxWidth,
        margin: '0 auto',
        padding: '0 16px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ── Responsive sidebar toggle ──────────────────────────────────────
export function useResponsiveSidebar() {
  const { breakpoint } = useResponsive();
  const [collapsed, setCollapsed] = useState(breakpoint === 'sm');

  useEffect(() => {
    if (breakpoint === 'sm') setCollapsed(true);
  }, [breakpoint]);

  const toggle = useCallback(() => setCollapsed(prev => !prev), []);

  return {
    collapsed,
    toggle,
    isMobile: breakpoint === 'sm',
    canToggle: true,
  };
}

// ── CSS breakpoint generator ───────────────────────────────────────
export function responsiveCSS(
  styles: Record<string, string | number>,
  bp: Breakpoint
): Record<string, string | number> {
  const min = BREAKPOINTS[bp].min;
  const max = BREAKPOINTS[bp].max;
  const key = min ? `@media (min-width: ${min}px)` : `@media (max-width: ${max}px)`;
  // Return marker for CSS-in-JS libraries
  return { [`__${key}`]: '' as any, ...styles };
}

export default useResponsive;
