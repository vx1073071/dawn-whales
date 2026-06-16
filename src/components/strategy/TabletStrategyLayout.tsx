// @ts-nocheck
// R231 ML#1: TabletStrategyLayout — Tablet-optimized strategy page
// Splits into top cards + bottom detail on tablet (2-row instead of side-by-side)
// Mobile: single-column with expand/collapse sections

import React, { useState } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import ResponsiveCard from '../common/ResponsiveCard';

export interface TabletStrategyLayoutProps {
  templateList?: React.ReactNode;
  strategyDetail?: React.ReactNode;
  parameterPanel?: React.ReactNode;
  backtestPreview?: React.ReactNode;
  className?: string;
}

export default function TabletStrategyLayout({
  templateList,
  strategyDetail,
  parameterPanel,
  backtestPreview,
  className = '',
}: TabletStrategyLayoutProps) {
  const { breakpoint, isMobile, isTablet } = useResponsive();
  const [mobileSection, setMobileSection] = useState<'templates' | 'detail' | 'params' | 'backtest'>('templates');
  
  // Mobile: single section with navigation
  if (isMobile) {
    return (
      <div className={`tablet-strategy-mobile ${className}`}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 8, overflow: 'auto' }}>
          {[
            { key: 'templates' as const, label: '模板' },
            { key: 'detail' as const, label: '详情' },
            { key: 'params' as const, label: '参数' },
            { key: 'backtest' as const, label: '回测' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setMobileSection(item.key)}
              style={{
                flex: 1, padding: '6px 4px', textAlign: 'center',
                background: mobileSection === item.key ? 'var(--surface-2, #1e293b)' : 'none',
                border: 'none', borderBottom: mobileSection === item.key ? '2px solid var(--brand, #d4a574)' : 'none',
                color: mobileSection === item.key ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {mobileSection === 'templates' && templateList}
        {mobileSection === 'detail' && strategyDetail}
        {mobileSection === 'params' && parameterPanel}
        {mobileSection === 'backtest' && backtestPreview}
      </div>
    );
  }
  
  // Tablet: 2-row layout (templates + params on top, detail + backtest below)
  if (isTablet) {
    return (
      <div className={`tablet-strategy-tablet ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ResponsiveCard title="策略模板" collapsible>{templateList}</ResponsiveCard>
          <ResponsiveCard title="参数调节" collapsible>{parameterPanel}</ResponsiveCard>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
          <ResponsiveCard title="策略详情">{strategyDetail}</ResponsiveCard>
          <ResponsiveCard title="回测预览">{backtestPreview}</ResponsiveCard>
        </div>
      </div>
    );
  }
  
  // Desktop: 3-column layout
  return (
    <div className={`tablet-strategy-desktop ${className}`} style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ResponsiveCard title="策略模板">{templateList}</ResponsiveCard>
        <ResponsiveCard title="参数">{parameterPanel}</ResponsiveCard>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <ResponsiveCard title="策略详情">{strategyDetail}</ResponsiveCard>
        <ResponsiveCard title="回测预览">{backtestPreview}</ResponsiveCard>
      </div>
    </div>
  );
}
