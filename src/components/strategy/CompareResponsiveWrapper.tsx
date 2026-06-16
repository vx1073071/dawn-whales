// @ts-nocheck
// R236 ML#1: StrategyCompareResponsive — Responsive polish for strategy comparison
// Responsive 3-breakpoint layout + mobile swipe + tablet 2-row + desktop full

import React, { useState } from 'react';
import { useResponsive } from '../../hooks/useResponsive';

export interface CompareResponsiveWrapperProps {
  children: React.ReactNode;
  header: React.ReactNode;
  compareTable: React.ReactNode;
  radarChart: React.ReactNode;
  summaryCard: React.ReactNode;
}

export default function CompareResponsiveWrapper({
  children, header, compareTable, radarChart, summaryCard,
}: CompareResponsiveWrapperProps) {
  const { breakpoint, isMobile } = useResponsive();
  const [section, setSection] = useState<'table' | 'radar' | 'summary'>('table');
  
  // Mobile: swipeable sections
  if (isMobile) {
    return React.createElement('div', { style: { minHeight: '100%', display: 'flex', flexDirection: 'column' } }, [
      header,
      React.createElement('div', { key: 'tabs', style: {
        display: 'flex', gap: 0, marginBottom: 8, borderBottom: '1px solid var(--border-color, #334155)',
      }}, [
        { key: 'table' as const, label: 'Metrics', icon: '📊' },
        { key: 'radar' as const, label: 'Radar', icon: '🎯' },
        { key: 'summary' as const, label: 'Score', icon: '⭐' },
      ].map(tab =>
        React.createElement('button', {
          key: tab.key, onClick: () => setSection(tab.key),
          style: {
            flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 500,
            background: 'none', border: 'none',
            borderBottom: section === tab.key ? '2px solid var(--brand, #d4a574)' : '2px solid transparent',
            color: section === tab.key ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
            cursor: 'pointer',
          },
        }, `${tab.icon} ${tab.label}`)
      )),
      React.createElement('div', { key: 'content', style: { flex: 1, overflow: 'auto', padding: '0 4px' } },
        section === 'table' ? compareTable : section === 'radar' ? radarChart : summaryCard
      ),
    ]);
  }
  
  // Tablet: 2-row (table top, radar+summary below)
  if (breakpoint === 'md') {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } }, [
      header,
      React.createElement('div', { key: 'table', style: { overflowX: 'auto' } }, compareTable),
      React.createElement('div', { key: 'bottom', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } }, [
        React.createElement('div', { key: 'radar', style: { minHeight: 200 } }, radarChart),
        React.createElement('div', { key: 'summary' }, summaryCard),
      ]),
    ]);
  }
  
  // Desktop: side-by-side with table + radar column
  return React.createElement('div', { style: { display: 'flex', gap: 16, height: '100%' } }, [
    React.createElement('div', { key: 'left', style: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 } }, [
      header,
      React.createElement('div', { key: 'table', style: { flex: 1, overflow: 'auto', marginTop: 12 } }, compareTable),
    ]),
    React.createElement('div', { key: 'right', style: { width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 } }, [
      radarChart,
      summaryCard,
    ]),
  ]);
}
