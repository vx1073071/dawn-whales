import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useBridgeSync } from '@/hooks/useBridgeSync';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import StatusBar from '@/components/layout/StatusBar';
import OnboardingModal from '@/components/OnboardingModal';
import NotificationToast from '@/components/NotificationToast';
import { connectBroker } from '@/lib/bridge-api';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// ── Lazy-loaded pages for code splitting ──────────────────────────────────
const DashboardPage = lazy(() => import('@/components/dashboard/DashboardPage'));
const MarketPage = lazy(() => import('@/components/market/MarketPage'));
const StrategyPage = lazy(() => import('@/components/strategy/StrategyPage'));
const PortfolioPage = lazy(() => import('@/components/portfolio/PortfolioPage'));
const OrdersPage = lazy(() => import('@/components/orders/OrdersPage'));
const TradingDeskPage = lazy(() => import('@/components/orders/TradingDeskPage'));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'));
const MarketplacePage = lazy(() => import('@/components/marketplace/MarketplacePage'));
const LiveMonitorPage = lazy(() => import('@/components/live/LiveMonitorPage'));
const BacktestReportPage = lazy(() => import('@/components/backtest/BacktestReportPage'));
const RiskDashboardPage = lazy(() => import('@/components/risk/RiskDashboardPage'));
const DataExportPage = lazy(() => import('@/components/tools/DataExportPage'));
const AlertCenterPage = lazy(() => import('@/components/risk/AlertCenterPage'));
const PreferencesPage = lazy(() => import('@/components/settings/PreferencesPage'));
const SentimentDashboardPage = lazy(() => import('@/components/risk/SentimentDashboardPage'));
const MonteCarloPage = lazy(() => import('@/components/backtest/MonteCarloPage'));
const DataQualityPage = lazy(() => import('@/components/tools/DataQualityPage'));

const pages: Record<string, React.LazyExoticComponent<React.FC>> = {
  dashboard: DashboardPage,
  market: MarketPage,
  strategy: StrategyPage,
  portfolio: PortfolioPage,
  orders: OrdersPage,
  trading: TradingDeskPage,
  settings: SettingsPage,
  marketplace: MarketplacePage,
  live: LiveMonitorPage,
  backtest: BacktestReportPage,
  risk: RiskDashboardPage,
  export: DataExportPage,
  alerts: AlertCenterPage,
  preferences: PreferencesPage,
  sentiment: SentimentDashboardPage,
  montecarlo: MonteCarloPage,
  quality: DataQualityPage,
};

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-500 text-sm animate-pulse">加载中...</div>
    </div>
  );
}

export default function App() {
  const view = useAppStore((s) => s.sidebarView);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const Page = pages[view] || MarketPage;

  // Onboarding: show for first-time users
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('dw_onboarding_done');
    if (!seen) setShowOnboarding(true);
  }, []);

  async function handleConnect(): Promise<boolean> {
    try {
      const result = await connectBroker();
      const ok = result?.success === true;
      setConnected(ok);
      return ok;
    } catch {
      return false;
    }
  }

  function handleCloseOnboarding() {
    localStorage.setItem('dw_onboarding_done', '1');
    setShowOnboarding(false);
  }

  // Sync real-time data from Bridge
  useBridgeSync();

  // Global keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="h-screen flex flex-col bg-surface-1 text-gray-200 overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <main className="flex-1 overflow-auto">
          <Suspense fallback={<PageFallback />}>
            <Page />
          </Suspense>
        </main>
      </div>
      <StatusBar />
      <NotificationToast />
      <OnboardingModal
        open={showOnboarding}
        onClose={handleCloseOnboarding}
        onConnect={handleConnect}
        connected={connected}
      />
    </div>
  );
}
