// @ts-nocheck
// R241 ML#2: RiskMobileAdapter — Mobile-responsive risk scan + supply chain wrapper
// Adapts RiskScanPanel + SupplyChainGraph for mobile/tablet with swipe and collapse
import React, { useState } from 'react';
import { useResponsive } from '../../hooks/useResponsive';

export interface RiskMobileAdapterProps {
  children: React.ReactNode;
  riskPanel: React.ReactNode;
  supplyChainPanel: React.ReactNode;
  className?: string;
}

export default function RiskMobileAdapter({
  children, riskPanel, supplyChainPanel, className = '',
}: RiskMobileAdapterProps) {
  const { breakpoint, isMobile, isTablet } = useResponsive();
  const [tab, setTab] = useState<'risk' | 'supply'>('risk');
  
  // Mobile: tabs with swipe
  if (isMobile) {
    return React.createElement('div', { className: `risk-mobile-adapter ${className}`, style: { minHeight: '100%' } }, [
      React.createElement('div', { key: 'tabs', style: {
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color, #334155)',
        position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-1, #0f172a)',
      }}, [
        { key: 'risk' as const, label: '🛡️ Risk Scan', count: '' },
        { key: 'supply' as const, label: '🔗 Supply Chain', count: '' },
      ].map(t =>
        React.createElement('button', {
          key: t.key, onClick: () => setTab(t.key),
          style: {
            flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600,
            background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--brand, #d4a574)' : '2px solid transparent',
            color: tab === t.key ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
            cursor: 'pointer',
          },
        }, t.label)
      )),
      React.createElement('div', { key: 'content', style: { flex: 1, overflow: 'auto' } },
        tab === 'risk' ? riskPanel : supplyChainPanel
      ),
    ]);
  }
  
  // Tablet: stacked
  if (isTablet) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, padding: 8 } }, [
      React.createElement('div', { key: 'risk', style: { borderRadius: 8, border: '1px solid var(--border-color, #334155)', overflow: 'hidden', maxHeight: 400, overflowY: 'auto' } }, riskPanel),
      React.createElement('div', { key: 'supply', style: { borderRadius: 8, border: '1px solid var(--border-color, #334155)', overflow: 'hidden', maxHeight: 400, overflowY: 'auto' } }, supplyChainPanel),
    ]);
  }
  
  // Desktop: side-by-side
  return React.createElement('div', { style: { display: 'flex', gap: 12, height: '100%', padding: 8 } }, [
    React.createElement('div', { key: 'risk', style: { flex: 1, borderRadius: 8, border: '1px solid var(--border-color, #334155)', overflow: 'hidden' } }, riskPanel),
    React.createElement('div', { key: 'supply', style: { flex: 1, borderRadius: 8, border: '1px solid var(--border-color, #334155)', overflow: 'hidden' } }, supplyChainPanel),
  ]);
}
