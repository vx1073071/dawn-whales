/**
 * usePreload — Route-aware code preloading hook
 * (ML-44-01, R44 Phase 6.0)
 *
 * Preloads page bundles on hover/intent, reducing perceived latency.
 * Integrates with existing React.lazy + Suspense in App.tsx.
 */

import { useCallback, useEffect, useRef } from 'react';

// ── Page module map (mirrors App.tsx lazy imports) ──────────────────────

const PAGE_IMPORTS: Record<string, () => Promise<any>> = {
  dashboard: () => import('@/components/dashboard/DashboardPage'),
  market: () => import('@/components/market/MarketPage'),
  strategy: () => import('@/components/strategy/StrategyPage'),
  portfolio: () => import('@/components/portfolio/PortfolioPage'),
  orders: () => import('@/components/orders/OrdersPage'),
  settings: () => import('@/components/settings/SettingsPage'),
  marketplace: () => import('@/components/marketplace/MarketplacePage'),
  live: () => import('@/components/live/LiveMonitorPage'),
  backtest: () => import('@/components/backtest/BacktestReportPage'),
  risk: () => import('@/components/risk/RiskDashboardPage'),
  alerts: () => import('@/components/risk/AlertCenterPage'),
  trading: () => import('@/components/trading/TradeDashboardPage'),
};

const PRELOADED = new Set<string>();

/**
 * Preload a page bundle by key.
 * Safe to call multiple times — second call is no-op.
 */
export function preloadPage(key: string): void {
  if (PRELOADED.has(key)) return;
  const loader = PAGE_IMPORTS[key];
  if (loader) {
    PRELOADED.add(key);
    loader().catch(() => {
      PRELOADED.delete(key); // allow retry on failure
    });
  }
}

/**
 * Hook: preload sibling pages on idle to warm the cache.
 * Call once in App root.
 */
export function usePreloadAll(): void {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const preloadRemaining = () => {
      for (const key of Object.keys(PAGE_IMPORTS)) {
        preloadPage(key);
      }
    };

    // Wait for initial render, then preload all
    const id = requestIdleCallback?.(preloadRemaining, { timeout: 3000 })
      ?? setTimeout(preloadRemaining, 3000);

    return () => {
      if (typeof id === 'number') {
        cancelIdleCallback?.(id);
        clearTimeout(id);
      }
    };
  }, []);
}

/**
 * Hook: preload on hover/intent.
 * Usage: <SidebarLink onMouseEnter={() => preloadIntent('market')} />
 */
export function usePreloadIntent() {
  return useCallback((key: string) => {
    // Preload target + common siblings
    preloadPage(key);
  }, []);
}

export default usePreloadIntent;
