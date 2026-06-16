// R231 ML#1: ResponsiveCard — Breakpoint-aware card with collapse on mobile
import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';

export interface ResponsiveCardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  extra?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hoverable?: boolean;
}

export default function ResponsiveCard({
  children,
  title,
  extra,
  collapsible = false,
  defaultCollapsed = false,
  className = '',
  style,
  onClick,
  hoverable = false,
}: ResponsiveCardProps) {
  const { isMobile } = useResponsive();
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  
  const padX = isMobile ? 12 : 16;
  const padY = isMobile ? 10 : 14;
  
  return (
    <div
      className={`responsive-card ${className} ${hoverable ? 'responsive-card-hoverable' : ''}`}
      onClick={onClick}
      style={{
        background: 'var(--card-bg, #ffffff)',
        borderRadius: 8,
        border: '1px solid var(--border-color, #e5e7eb)',
        overflow: 'hidden',
        cursor: onClick || hoverable ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        ...style,
      }}
    >
      {(title || extra || collapsible) && (
        <div
          className="responsive-card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${padY}px ${padX}px`,
            borderBottom: collapsed ? 'none' : '1px solid var(--border-color, #e5e7eb)',
            cursor: collapsible ? 'pointer' : 'default',
            userSelect: 'none',
          }}
          onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
        >
          <div style={{ fontWeight: 600, fontSize: isMobile ? 14 : 15 }}>
            {title}
            {collapsible && (
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.5 }}>
                {collapsed ? '▶' : '▼'}
              </span>
            )}
          </div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      {!collapsed && (
        <div className="responsive-card-body" style={{ padding: `${padY}px ${padX}px` }}>
          {children}
        </div>
      )}
    </div>
  );
}
