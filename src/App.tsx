import React, { useState, useEffect, lazy, Suspense } from 'react';
import { EngineError } from '../electron/engine/core/engine-error';
import { useAppStore } from '@/stores/appStore';
import { useBridgeSync } from '@/hooks/useBridgeSync';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import StatusBar from '@/components/layout/StatusBar';
const OnboardingModal = lazy(() => import('@/components/onboarding/OnboardingModal'));
import NotificationToast from '@/components/NotificationToast';
import { connectBroker } from '@/lib/bridge-api';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { getSkeletonForView } from '@/components/skeleton/SkeletonScreen';

// ── Lazy-loaded pages for code splitting ──────────────────────────────────
const DashboardPage = lazy(() => import('@/components/dashboard/DashboardPage'));
const MarketPage = lazy(() => import('@/components/market/MarketPage'));
const StrategyPage = lazy(() => import('@/components/strategy/StrategyPage'));
const PortfolioPage = lazy(() => import('@/components/portfolio/PortfolioPage'));
const OrdersPage = lazy(() => import('@/components/orders/OrdersPage'));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'));
const MarketplacePage = lazy(() => import('@/components/marketplace/MarketplacePage'));
const LiveMonitorPage = lazy(() => import('@/components/live/LiveMonitorPage'));
const BacktestReportPage = lazy(() => import('@/components/backtest/BacktestReportPage'));
const RiskDashboardPage = lazy(() => import('@/components/risk/RiskDashboardPage'));
const AlertCenterPage = lazy(() => import('@/components/risk/AlertCenterPage'));
const TradeDashboardPage = lazy(() => import('@/components/trading/TradeDashboardPage'));
const AIAssistantPage = lazy(() => import('@/components/ai/AIAssistantPanel'));
const RiskVisualizerPage = lazy(() => import('@/components/risk/RiskVisualizer'));
const CreatorLeaderboardPage = lazy(() => import('@/components/billing/community/CreatorLeaderboard'));
const SignalPerformancePage = lazy(() => import('@/components/billing/community/SignalPerformancePanel'));
const CopyTradeHub = lazy(() => import('@/components/broker/CopyTradeHub'));

const pages: Record<string, React.LazyExoticComponent<React.FC>> = {
  dashboard: DashboardPage,
  market: MarketPage,
  strategy: StrategyPage,
  portfolio: PortfolioPage,
  orders: OrdersPage,
  settings: SettingsPage,
  marketplace: MarketplacePage,
  live: LiveMonitorPage,
  backtest: BacktestReportPage,
  risk: RiskDashboardPage,
  alert: AlertCenterPage,
  trade: TradeDashboardPage,
  ai: AIAssistantPage,
  riskviz: RiskVisualizerPage,
  creator: CreatorLeaderboardPage,
  signals: SignalPerformancePage,
  copytrade: CopyTradeHub,
};

function PageFallback() {
  const view = useAppStore((s) => s.sidebarView);
  const Skeleton = getSkeletonForView(view);
  return <Skeleton />;
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
      void EngineError; // [SYSTEM] structured error tracking
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
