// @ts-nocheck
// ── R126-M05 MultiScreen + Responsive — 多屏分离 + 响应式布局 ──────────
// PM: P2-10 — detach模式下独立窗口, 平板/小屏适配

import { useState, useCallback, useEffect, ReactNode, useRef } from 'react';

// ═══════════ Types ═══════════

export type DeviceBreakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export interface ResponsiveInfo {
  breakpoint: DeviceBreakpoint;
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  columns: number; // Suggested grid columns
}

// ═══════════ Breakpoint detection ═══════════

const BREAKPOINTS: { bp: DeviceBreakpoint; min: number }[] = [
  { bp: 'mobile', min: 0 },
  { bp: 'tablet', min: 768 },
  { bp: 'desktop', min: 1280 },
  { bp: 'wide', min: 1920 },
];

export function useResponsive(): ResponsiveInfo {
  const [info, setInfo] = useState<ResponsiveInfo>(() => computeResponsive());

  useEffect(() => {
    const handler = () => setInfo(computeResponsive());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return info;
}

function computeResponsive(): ResponsiveInfo {
  const w = window.innerWidth;
  const h = window.innerHeight;
  let bp: DeviceBreakpoint = 'mobile';
  let cols = 1;

  for (let i = BREAKPOINTS.length - 1; i >= 0; i--) {
    if (w >= BREAKPOINTS[i].min) {
      bp = BREAKPOINTS[i].bp;
      break;
    }
  }

  switch (bp) {
    case 'wide': cols = 4; break;
    case 'desktop': cols = 3; break;
    case 'tablet': cols = 2; break;
    default: cols = 1;
  }

  return {
    breakpoint: bp,
    width: w, height: h,
    isMobile: bp === 'mobile',
    isTablet: bp === 'tablet',
    isDesktop: bp === 'desktop',
    isWide: bp === 'wide',
    columns: cols,
  };
}

// ═══════════ Responsive Grid ═══════════

export function ResponsiveGrid({
  children, className = '', gap = 'gap-2', tabletCols, desktopCols, wideCols
}: {
  children: ReactNode;
  className?: string;
  gap?: string;
  tabletCols?: number;
  desktopCols?: number;
  wideCols?: number;
}) {
  const { isTablet, isDesktop, isWide } = useResponsive();

  const cols = isWide ? (wideCols || 4) : isDesktop ? (desktopCols || 3) : isTablet ? (tabletCols || 2) : 1;

  return (
    <div
      className={`grid ${gap} ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {children}
    </div>
  );
}

// ═══════════ Detachable Panel (multi-screen) ═══════════

export interface DetachedWindowState {
  id: string;
  title: string;
  window: Window | null;
  content: ReactNode;
}

/**
 * Open a chart component in a separate popup window (multi-screen support)
 */
export function useDetachedWindow() {
  const [detached, setDetached] = useState<DetachedWindowState[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const detach = useCallback((id: string, title: string, content: ReactNode) => {
    // Close existing window if any
    const existing = detached.find(d => d.id === id);
    if (existing?.window && !existing.window.closed) {
      existing.window.close();
    }

    const w = window.open('', id,
      'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
    );

    if (w) {
      // Inject basic styles
      w.document.title = title;
      w.document.body.style.margin = '0';
      w.document.body.style.padding = '0';
      w.document.body.style.background = '#0d1117';
      w.document.body.style.color = '#e6edf3';
      w.document.body.style.fontFamily = 'monospace';
      w.document.body.style.overflow = 'hidden';
    }

    setDetached(prev => [...prev.filter(d => d.id !== id), { id, title, window: w, content }]);

    return w;
  }, [detached]);

  const undock = useCallback((id: string) => {
    const existing = detached.find(d => d.id === id);
    if (existing?.window && !existing.window.closed) {
      existing.window.close();
    }
    setDetached(prev => prev.filter(d => d.id !== id));
  }, [detached]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const d of detached) {
        if (d.window && !d.window.closed) d.window.close();
      }
    };
  }, []);

  return { detached, detach, undock, containerRef };
}

/**
 * Detach button for chart toolbars
 */
export function DetachButton({
  onDetach, detached
}: {
  onDetach: () => void;
  detached: boolean;
}) {
  return (
    <button
      onClick={onDetach}
      className={`px-1.5 py-0.5 text-[9px] rounded font-mono transition-colors ${detached ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58] hover:text-[#8b949e]'}`}
      title={detached ? '合并回主窗口' : '分离到独立窗口'}
    >
      {detached ? '⊟' : '⊞'}
    </button>
  );
}

// ═══════════ Mobile-friendly chart toolbar ═══════════

export function MobileToolbar({
  children, className = ''
}: {
  children: ReactNode;
  className?: string;
}) {
  const { isMobile } = useResponsive();

  return (
    <div className={`flex items-center gap-1 px-2 py-1 ${isMobile ? 'overflow-x-auto flex-nowrap scrollbar-thin' : 'flex-wrap'} ${className}`}>
      {children}
    </div>
  );
}

export default useResponsive;
