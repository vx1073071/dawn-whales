// @ts-nocheck
// R231 ML#1: MobileDashboardLayout — Responsive dashboard for small windows
// Compact cards, stacked layout, swipe-friendly
import React, { useState } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import ResponsiveGrid from '../common/ResponsiveGrid';
import ResponsiveCard from '../common/ResponsiveCard';

export interface DashboardMetric {
  key: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
  color?: string;
}

export interface MobileDashboardLayoutProps {
  metrics: DashboardMetric[];
  chart?: React.ReactNode;
  positions?: React.ReactNode;
  alerts?: React.ReactNode;
  news?: React.ReactNode;
  className?: string;
}

export default function MobileDashboardLayout({
  metrics,
  chart,
  positions,
  alerts,
  news,
  className = '',
}: MobileDashboardLayoutProps) {
  const { isMobile, isTablet } = useResponsive();
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'alerts' | 'news'>('overview');
  
  // Mobile: tabs with swipe
  // Tablet: 2-column metrics + chart below + tabs
  // Desktop: 4-column metrics + chart side-by-side + positions + alerts/news
  
  const tabs = [
    { key: 'overview' as const, label: '概览', icon: '📊' },
    { key: 'positions' as const, label: '持仓', icon: '💼' },
    { key: 'alerts' as const, label: '警报', icon: '🔔' },
    { key: 'news' as const, label: '资讯', icon: '📰' },
  ];
  
  return (
    <div className={`mobile-dashboard ${className}`} style={{ minHeight: '100%' }}>
      {/* Mobile tab bar */}
      {isMobile && (
        <div style={{
          display: 'flex', gap: 0, marginBottom: 12,
          borderBottom: '1px solid var(--border-color, #334155)',
          overflow: 'auto',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '8px 4px', textAlign: 'center',
                background: 'none', border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--brand, #d4a574)' : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
                fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      )}
      
      {/* Overview Tab */}
      {(activeTab === 'overview' || !isMobile) && (
        <>
          {/* Metric cards */}
          <ResponsiveGrid cols={{ sm: 2, md: 3, lg: 4 }} gap={{ sm: 8, md: 12, lg: 16 }}>
            {metrics.map(m => (
              <ResponsiveCard key={m.key} hoverable>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: isMobile ? 11 : 12,
                    color: 'var(--text-secondary, #94a3b8)',
                    marginBottom: 4,
                  }}>
                    {m.icon && <span style={{ marginRight: 4 }}>{m.icon}</span>}
                    {m.label}
                  </div>
                  <div style={{
                    fontSize: isMobile ? 18 : isTablet ? 20 : 24,
                    fontWeight: 700,
                    color: m.color || 'var(--text-primary, #e2e8f0)',
                    lineHeight: 1.2,
                  }}>
                    {m.value}
                  </div>
                  {m.change !== undefined && (
                    <div style={{
                      fontSize: isMobile ? 10 : 11,
                      color: m.change >= 0 ? '#22c55e' : '#ef4444',
                      marginTop: 2,
                    }}>
                      {m.change >= 0 ? '▲' : '▼'} {Math.abs(m.change).toFixed(2)}%
                      {m.changeLabel && <span style={{ color: 'var(--text-tertiary, #64748b)', marginLeft: 4 }}>{m.changeLabel}</span>}
                    </div>
                  )}
                </div>
              </ResponsiveCard>
            ))}
          </ResponsiveGrid>
          
          {/* Chart section */}
          {chart && (
            <div style={{ marginTop: isMobile ? 12 : 16 }}>
              <ResponsiveCard title="走势图" collapsible={isMobile} defaultCollapsed={false}>
                <div style={{ minHeight: isMobile ? 200 : isTablet ? 280 : 350 }}>
                  {chart}
                </div>
              </ResponsiveCard>
            </div>
          )}
        </>
      )}
      
      {/* Positions Tab */}
      {(activeTab === 'positions' || !isMobile) && positions && (
        <div style={{ marginTop: isMobile ? 0 : 16 }}>
          {positions}
        </div>
      )}
      
      {/* Alerts Tab */}
      {(activeTab === 'alerts' || !isMobile) && alerts && (
        <div style={{ marginTop: isMobile ? 0 : 16 }}>
          {alerts}
        </div>
      )}
      
      {/* News Tab */}
      {(activeTab === 'news' || !isMobile) && news && (
        <div style={{ marginTop: isMobile ? 0 : 16 }}>
          {news}
        </div>
      )}
    </div>
  );
}
