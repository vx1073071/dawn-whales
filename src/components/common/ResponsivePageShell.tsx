// R231 ML#1: ResponsivePageShell — Standard page template with responsive behavior  
// Auto-adapts layout, padding, font-size based on breakpoint
import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';

export interface ResponsivePageShellProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function ResponsivePageShell({
  children,
  title,
  actions,
  breadcrumb,
  fullWidth = false,
  className = '',
  style,
}: ResponsivePageShellProps) {
  const { breakpoint, isMobile, isTablet } = useResponsive();
  
  const maxWidth = fullWidth ? '100%' : breakpoint === 'lg' ? 1400 : '100%';
  const padX = isMobile ? 12 : isTablet ? 16 : 24;
  const padY = isMobile ? 8 : isTablet ? 12 : 16;
  const titleSize = isMobile ? 18 : isTablet ? 20 : 24;
  
  return (
    <div
      className={`responsive-page-shell ${className}`}
      style={{
        maxWidth,
        margin: '0 auto',
        padding: `${padY}px ${padX}px`,
        minHeight: '100%',
        ...style,
      }}
    >
      {breadcrumb && (
        <div className="responsive-page-breadcrumb" style={{ marginBottom: padY, fontSize: isMobile ? 12 : 14 }}>
          {breadcrumb}
        </div>
      )}
      {(title || actions) && (
        <div
          className="responsive-page-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: padY,
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            gap: 8,
          }}
        >
          {title && (
            <h1 style={{ fontSize: titleSize, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              {title}
            </h1>
          )}
          {actions && (
            <div className="responsive-page-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {actions}
            </div>
          )}
        </div>
      )}
      <div className="responsive-page-content" style={{ fontSize: isMobile ? 13 : 14 }}>
        {children}
      </div>
    </div>
  );
}
