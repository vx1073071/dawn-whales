// @ts-nocheck
// R231 ML#1: ResponsiveSidebar — Auto-collapsing sidebar for mobile/tablet
// On mobile: Overlay drawer with backdrop
// On tablet: Narrow inline (200px) with icon-only mode
// On desktop: Full inline (260px) with text labels

import React, { useState, useCallback, useEffect } from 'react';
import { useResponsive } from '../../hooks/useResponsive';

export interface ResponsiveSidebarProps {
  children: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  width?: { sm?: number; md?: number; lg?: number };
  overlayBreakpoint?: 'sm' | 'md';
  className?: string;
}

export default function ResponsiveSidebar({
  children,
  collapsed: externalCollapsed,
  onToggle,
  width = { sm: 280, md: 200, lg: 260 },
  overlayBreakpoint = 'sm',
  className = '',
}: ResponsiveSidebarProps) {
  const { breakpoint, isMobile } = useResponsive();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  
  const collapsed = externalCollapsed ?? internalCollapsed;
  const isOverlay = breakpoint === overlayBreakpoint;
  
  const w = width[breakpoint] ?? width.lg ?? 260;
  
  const handleOverlayClose = useCallback(() => {
    setOverlayOpen(false);
  }, []);
  
  // Close overlay on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlayOpen) {
        setOverlayOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [overlayOpen]);
  
  // Mobile: hidden by default, toggle shows overlay
  if (isOverlay) {
    return (
      <>
        {/* Hamburger button */}
        <button
          onClick={() => setOverlayOpen(true)}
          style={{
            position: 'fixed',
            top: 8,
            left: 8,
            zIndex: 1000,
            background: 'var(--surface-2, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: 8,
            padding: '8px 10px',
            color: 'var(--text-primary, #e2e8f0)',
            cursor: 'pointer',
            fontSize: 18,
            display: overlayOpen ? 'none' : 'block',
          }}
          aria-label="Open menu"
        >
          ☰
        </button>
        
        {/* Overlay backdrop */}
        {overlayOpen && (
          <div
            onClick={handleOverlayClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(2px)',
            }}
          />
        )}
        
        {/* Overlay sidebar */}
        <aside
          className={`responsive-sidebar-overlay ${className}`}
          style={{
            position: 'fixed',
            top: 0,
            left: overlayOpen ? 0 : `-${width.sm}px`,
            bottom: 0,
            width: width.sm,
            zIndex: 1000,
            background: 'var(--surface-1, #0f172a)',
            borderRight: '1px solid var(--border-color, #334155)',
            transition: 'left 0.3s ease',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Close button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 8 }}>
            <button
              onClick={handleOverlayClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: 20,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          {children}
        </aside>
      </>
    );
  }
  
  // Tablet/Desktop: inline sidebar
  return (
    <aside
      className={`responsive-sidebar-inline ${className}`}
      style={{
        width: collapsed ? 0 : w,
        minWidth: collapsed ? 0 : w,
        flexShrink: 0,
        background: 'var(--surface-1, #0f172a)',
        borderRight: '1px solid var(--border-color, #334155)',
        transition: 'width 0.3s ease, min-width 0.3s ease',
        overflow: collapsed ? 'hidden' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </aside>
  );
}
