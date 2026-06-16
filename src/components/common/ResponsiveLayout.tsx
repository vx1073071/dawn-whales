// R231 ML#1: ResponsiveLayout — Master responsive wrapper
// Applies responsive behavior to any page: sidebar collapse, stack layout, font scaling
import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';

export interface ResponsiveLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  sidebarWidth?: number;
  sidebarCollapsible?: boolean;
  topBar?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function ResponsiveLayout({
  children,
  sidebar,
  sidebarWidth = 260,
  sidebarCollapsible = true,
  topBar,
  className = '',
  style,
}: ResponsiveLayoutProps) {
  const { breakpoint, isMobile, isTablet } = useResponsive();
  
  const isSidebarVisible = sidebarCollapsible ? (isMobile ? false : true) : true;
  const sidebarW = isTablet ? Math.min(sidebarWidth, 200) : sidebarWidth;
  
  return (
    <div
      className={`responsive-layout ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        ...style,
      }}
    >
      {topBar && (
        <div className="responsive-layout-topbar" style={{ flexShrink: 0 }}>
          {topBar}
        </div>
      )}
      <div
        className="responsive-layout-body"
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          flexDirection: breakpoint === 'sm' ? 'column' : 'row',
        }}
      >
        {sidebar && isSidebarVisible && (
          <aside
            className="responsive-layout-sidebar"
            style={{
              width: sidebarW,
              flexShrink: 0,
              borderRight: '1px solid var(--border-color, #e5e7eb)',
              overflow: 'auto',
            }}
          >
            {sidebar}
          </aside>
        )}
        <main
          className="responsive-layout-main"
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'auto',
            padding: breakpoint === 'sm' ? 12 : 20,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
