// @ts-nocheck
// R235 ML#2: SkeletonSystem — 12 skeleton variants for full loading coverage
// + EmptyState system + Transition animations micro-interactions
import React from 'react';

// ── Skeleton base component ──────────────────────────────────────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
  style?: React.CSSProperties;
  animated?: boolean;
}

const radiusMap = { sm: 4, md: 8, lg: 12, full: 9999 };

function SkeletonBlock({ width = '100%', height = 16, rounded = 'md', className = '', style, animated = true }: SkeletonProps) {
  return React.createElement('div', {
    className: `skeleton-block ${animated ? 'skeleton-animated' : ''} ${className}`,
    style: {
      width, height, borderRadius: radiusMap[rounded],
      background: 'var(--surface-3, #334155)',
      opacity: animated ? undefined : 0.6,
      ...style,
    },
  });
}

// ── 12 Specialized Skeletons ─────────────────────────────────────────

// 1. K-Line Chart Skeleton
export function KLineSkeleton({ height = 350 }: { height?: number }) {
  const bars = Array.from({ length: 40 }, (_, i) => {
    const h = 30 + Math.random() * (height - 80);
    const y = height - 20 - h;
    const w = 4 + Math.random() * 4;
    const green = Math.random() > 0.45;
    return React.createElement('rect', {
      key: i, x: i * 18 + 10, y, width: w, height: h,
      rx: 2, fill: green ? '#22c55e30' : '#ef444430',
    });
  });
  
  return React.createElement('svg', { width: '100%', height, viewBox: `0 0 750 ${height}`, style: { background: 'var(--surface-1, #0f172a)' } }, [
    // Grid lines
    React.createElement('line', { key: 'g1', x1: 0, y1: height * 0.25, x2: 750, y2: height * 0.25, stroke: 'var(--surface-3, #334155)', strokeWidth: 0.5 }),
    React.createElement('line', { key: 'g2', x1: 0, y1: height * 0.5, x2: 750, y2: height * 0.5, stroke: 'var(--surface-3, #334155)', strokeWidth: 0.5 }),
    React.createElement('line', { key: 'g3', x1: 0, y1: height * 0.75, x2: 750, y2: height * 0.75, stroke: 'var(--surface-3, #334155)', strokeWidth: 0.5 }),
    ...bars,
  ]);
}

// 2. Table Skeleton
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 1 } }, [
    React.createElement('div', { key: 'header', style: {
      display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8,
      padding: '8px 12px', background: 'var(--surface-2, #1e293b)', borderRadius: '8px 8px 0 0',
    }},
      Array.from({ length: cols }, (_, i) =>
        React.createElement(SkeletonBlock, { key: i, height: 12, width: `${60 + Math.random() * 30}%` })
      )
    ),
    ...Array.from({ length: rows }, (_, ri) =>
      React.createElement('div', { key: ri, style: {
        display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8,
        padding: '8px 12px', borderBottom: '1px solid var(--border-color, #334155)',
        background: ri % 2 === 0 ? 'transparent' : 'rgba(30,41,59,0.2)',
      }},
        Array.from({ length: cols }, (_, ci) =>
          React.createElement(SkeletonBlock, { key: ci, height: 10, width: ci === 0 ? '80%' : `${40 + Math.random() * 50}%` })
        )
      )
    ),
  ]);
}

// 3. Card Skeleton
export function CardSkeleton() {
  return React.createElement('div', { style: {
    padding: 16, borderRadius: 8, border: '1px solid var(--border-color, #334155)',
    background: 'var(--surface-1, #0f172a)', display: 'flex', flexDirection: 'column', gap: 12,
  }}, [
    React.createElement('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between' } }, [
      React.createElement(SkeletonBlock, { key: 'title', width: '60%', height: 18 }),
      React.createElement(SkeletonBlock, { key: 'badge', width: 40, height: 16, rounded: 'full' }),
    ]),
    React.createElement(SkeletonBlock, { key: 'body1', height: 12, width: '90%' }),
    React.createElement(SkeletonBlock, { key: 'body2', height: 12, width: '70%' }),
    React.createElement('div', { key: 'metrics', style: { display: 'flex', gap: 12 } }, [
      React.createElement(SkeletonBlock, { key: 'm1', width: 60, height: 28, rounded: 'md' }),
      React.createElement(SkeletonBlock, { key: 'm2', width: 60, height: 28, rounded: 'md' }),
      React.createElement(SkeletonBlock, { key: 'm3', width: 60, height: 28, rounded: 'md' }),
    ]),
  ]);
}

// 4. Dashboard Metric Skeleton (4 cards)
export function DashboardSkeleton() {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } }, [
    React.createElement('div', { key: 'metrics', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 } },
      Array.from({ length: 4 }, (_, i) =>
        React.createElement('div', { key: i, style: { padding: 16, borderRadius: 8, border: '1px solid var(--border-color, #334155)', background: 'var(--surface-1, #0f172a)' } }, [
          React.createElement(SkeletonBlock, { key: 'l', height: 10, width: '50%', style: { marginBottom: 8 } }),
          React.createElement(SkeletonBlock, { key: 'v', height: 24, width: '70%', style: { marginBottom: 6 } }),
          React.createElement(SkeletonBlock, { key: 'c', height: 8, width: '30%' }),
        ])
      )
    ),
    React.createElement(KLineSkeleton, { key: 'chart', height: 300 }),
  ]);
}

// 5. Strategy List Skeleton
export function StrategyListSkeleton({ count = 4 }: { count?: number }) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
    Array.from({ length: count }, (_, i) =>
      React.createElement('div', { key: i, style: {
        display: 'flex', gap: 12, padding: 12, borderRadius: 8,
        border: '1px solid var(--border-color, #334155)', background: 'var(--surface-1, #0f172a)',
        alignItems: 'center',
      }}, [
        React.createElement(SkeletonBlock, { key: 'icon', width: 40, height: 40, rounded: 'md' }),
        React.createElement('div', { key: 'info', style: { flex: 1 } }, [
          React.createElement(SkeletonBlock, { key: 'n', height: 14, width: '60%', style: { marginBottom: 6 } }),
          React.createElement(SkeletonBlock, { key: 'd', height: 10, width: '80%' }),
        ]),
        React.createElement(SkeletonBlock, { key: 'score', width: 50, height: 24, rounded: 'full' }),
      ])
    )
  );
}

// 6. Factor Selector Skeleton
export function FactorSelectorSkeleton() {
  return React.createElement('div', { style: { display: 'flex', gap: 16 } }, [
    // Left sidebar
    React.createElement('div', { key: 'sidebar', style: { width: 180, display: 'flex', flexDirection: 'column', gap: 8 } },
      Array.from({ length: 8 }, (_, i) =>
        React.createElement(SkeletonBlock, { key: i, height: 28, width: '90%', rounded: 'md' })
      )
    ),
    // Right content
    React.createElement('div', { key: 'content', style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 } }, [
      React.createElement(SkeletonBlock, { key: 'search', height: 32, width: '100%', style: { marginBottom: 8 } }),
      React.createElement('div', { key: 'grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 } },
        Array.from({ length: 6 }, (_, i) =>
          React.createElement('div', { key: i, style: { padding: 10, borderRadius: 6, border: '1px solid var(--border-color, #334155)' } }, [
            React.createElement(SkeletonBlock, { key: 'n', height: 12, width: '70%', style: { marginBottom: 6 } }),
            React.createElement(SkeletonBlock, { key: 'd', height: 8, width: '90%', style: { marginBottom: 4 } }),
            React.createElement(SkeletonBlock, { key: 's', height: 6, width: '100%' }),
          ])
        )
      ),
    ]),
  ]);
}

// 7. Portfolio Skeleton
export function PortfolioSkeleton() {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } }, [
    React.createElement('div', { key: 'summary', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 } },
      Array.from({ length: 3 }, (_, i) =>
        React.createElement('div', { key: i, style: { padding: 14, borderRadius: 8, border: '1px solid var(--border-color, #334155)', background: 'var(--surface-1, #0f172a)' } }, [
          React.createElement(SkeletonBlock, { key: 'l', height: 10, width: '40%', style: { marginBottom: 8 } }),
          React.createElement(SkeletonBlock, { key: 'v', height: 22, width: '60%' }),
        ])
      )
    ),
    React.createElement(TableSkeleton, { key: 'table', rows: 6, cols: 5 }),
  ]);
}

// 8. Order Book Skeleton
export function OrderBookSkeleton() {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } }, [
    React.createElement(SkeletonBlock, { key: 'header', height: 12, width: '40%', style: { marginBottom: 8 } }),
    ...Array.from({ length: 10 }, (_, i) => {
      const isAsk = i < 5;
      return React.createElement('div', { key: i, style: {
        display: 'flex', gap: 8, padding: '3px 8px', alignItems: 'center',
        background: isAsk ? 'rgba(239,68,68,0.03)' : 'rgba(34,197,94,0.03)',
      }}, [
        React.createElement(SkeletonBlock, { key: 'price', width: 60, height: 10, style: { background: isAsk ? '#ef444430' : '#22c55e30' } }),
        React.createElement(SkeletonBlock, { key: 'qty', width: `${30 + Math.random() * 60}%`, height: 10 }),
      ]);
    }),
  ]);
}

// 9. Profile / Settings Skeleton
export function SettingsSkeleton() {
  return React.createElement('div', { style: { display: 'flex', gap: 16 } }, [
    React.createElement('div', { key: 'nav', style: { width: 180, display: 'flex', flexDirection: 'column', gap: 6 } },
      Array.from({ length: 6 }, (_, i) =>
        React.createElement(SkeletonBlock, { key: i, height: 32, width: '100%', rounded: 'md' })
      )
    ),
    React.createElement('div', { key: 'form', style: { flex: 1, padding: 20, borderRadius: 8, border: '1px solid var(--border-color, #334155)', background: 'var(--surface-1, #0f172a)' } }, [
      React.createElement(SkeletonBlock, { key: 't', height: 20, width: '30%', style: { marginBottom: 16 } }),
      React.createElement(SkeletonBlock, { key: 'f1', height: 14, width: '100%', style: { marginBottom: 10 } }),
      React.createElement(SkeletonBlock, { key: 'f2', height: 14, width: '90%', style: { marginBottom: 10 } }),
      React.createElement(SkeletonBlock, { key: 'f3', height: 14, width: '70%', style: { marginBottom: 16 } }),
      React.createElement(SkeletonBlock, { key: 'btn', width: 100, height: 32, rounded: 'md' }),
    ]),
  ]);
}

// 10. Notification / Feed Skeleton
export function FeedSkeleton({ count = 5 }: { count?: number }) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
    Array.from({ length: count }, (_, i) =>
      React.createElement('div', { key: i, style: {
        display: 'flex', gap: 10, padding: '10px 12px',
        borderBottom: '1px solid var(--border-color, #334155)',
        alignItems: 'flex-start',
      }}, [
        React.createElement(SkeletonBlock, { key: 'avatar', width: 32, height: 32, rounded: 'full' }),
        React.createElement('div', { key: 'content', style: { flex: 1 } }, [
          React.createElement(SkeletonBlock, { key: 'title', height: 12, width: '70%', style: { marginBottom: 4 } }),
          React.createElement(SkeletonBlock, { key: 'body', height: 8, width: '90%', style: { marginBottom: 4 } }),
          React.createElement(SkeletonBlock, { key: 'time', height: 6, width: '20%' }),
        ]),
      ])
    )
  );
}

// 11. Heatmap Skeleton  
export function HeatmapSkeleton() {
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 } },
    Array.from({ length: 16 }, (_, i) =>
      React.createElement('div', { key: i, style: { borderRadius: 6, border: '1px solid var(--border-color, #334155)', overflow: 'hidden' } }, [
        React.createElement(SkeletonBlock, { key: 'h', height: 24, width: '100%', rounded: 'sm', style: { borderRadius: 0 } }),
        React.createElement('div', { key: 'g', style: { padding: 6, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 } },
          Array.from({ length: 8 }, (_, j) =>
            React.createElement(SkeletonBlock, { key: j, height: 28, rounded: 'sm', style: { opacity: 0.3 + Math.random() * 0.4 } })
          )
        ),
      ])
    )
  );
}

// 12. Full Page Skeleton (aggregate)
export function FullPageSkeleton({ type = 'dashboard' }: { type?: 'dashboard' | 'strategy' | 'factor' | 'portfolio' | 'settings' }) {
  const map: Record<string, React.FC> = {
    dashboard: () => React.createElement(DashboardSkeleton),
    strategy: () => React.createElement(StrategyListSkeleton, { count: 4 }),
    factor: () => React.createElement(FactorSelectorSkeleton),
    portfolio: () => React.createElement(PortfolioSkeleton),
    settings: () => React.createElement(SettingsSkeleton),
  };
  const Component = map[type] || map.dashboard;
  return React.createElement('div', { style: { padding: 16 } }, React.createElement(Component));
}

// ── CSS Animation Keyframes (inject once) ────────────────────────────
let styleInjected = false;
export function injectSkeletonStyles() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes skeleton-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.7; }
    }
    @keyframes skeleton-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .skeleton-animated {
      animation: skeleton-pulse 1.5s ease-in-out infinite;
      background: linear-gradient(90deg, var(--surface-3, #334155) 25%, var(--surface-2, #1e293b) 50%, var(--surface-3, #334155) 75%) !important;
      background-size: 200% 100% !important;
      animation: skeleton-shimmer 2s ease-in-out infinite;
    }
    /* Fade-in transition for loaded content */
    .skeleton-fade-enter {
      opacity: 0;
      transform: translateY(4px);
    }
    .skeleton-fade-enter-active {
      opacity: 1;
      transform: translateY(0);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
  `;
  document.head.appendChild(style);
  styleInjected = true;
}

// ── SkeletonMapper — Map view type to skeleton component ──────────────
export function getSkeletonForView(view: string): React.FC<any> {
  const map: Record<string, React.FC<any>> = {
    dashboard: DashboardSkeleton,
    market: () => React.createElement(TableSkeleton, { rows: 8, cols: 6 }),
    strategy: StrategyListSkeleton,
    portfolio: PortfolioSkeleton,
    orders: () => React.createElement(TableSkeleton, { rows: 5, cols: 5 }),
    settings: SettingsSkeleton,
    marketplace: StrategyListSkeleton,
    live: DashboardSkeleton,
    backtest: () => React.createElement(KLineSkeleton, { height: 350 }),
    risk: DashboardSkeleton,
    alert: FeedSkeleton,
    trade: OrderBookSkeleton,
    ai: CardSkeleton,
    copytrade: FeedSkeleton,
    wallet: DashboardSkeleton,
  };
  return map[view] || DashboardSkeleton;
}
