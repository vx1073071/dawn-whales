import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useBridgeSync } from '@/hooks/useBridgeSync';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import StatusBar from '@/components/layout/StatusBar';
import OnboardingModal from '@/components/OnboardingModal';
import NotificationToast from '@/components/NotificationToast';
import KeyboardShortcutsPanel from '@/components/KeyboardShortcutsPanel';
import { connectBroker } from '@/lib/bridge-api';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// ── Lazy-loaded pages for code splitting ──────────────────────────────────
const DashboardPage = lazy(() => import('@/components/dashboard/DashboardPage'));
const MarketPage = lazy(() => import('@/components/market/MarketPage'));
const MarketHeatmapPage = lazy(() => import('@/components/market/MarketHeatmapPage'));
const MacroDashboardPage = lazy(() => import('@/components/market/MacroDashboardPage'));
const StockScreenerPage = lazy(() => import('@/components/market/StockScreenerPage'));
const NewsDashboardPage = lazy(() => import('@/components/market/NewsDashboardPage'));
const SectorRotationPage = lazy(() => import('@/components/market/SectorRotationPage'));
const ConsumerDashboard = lazy(() => import('@/components/market/ConsumerDashboard'));
const MarginDashboard = lazy(() => import('@/components/market/MarginDashboard'));
const DragonTigerPage = lazy(() => import('@/components/market/DragonTigerPage'));
const CapitalFlowPage = lazy(() => import('@/components/market/CapitalFlowPage'));
const FundHoldingsPage = lazy(() => import('@/components/market/FundHoldingsPage'));
const DailyReportPage = lazy(() => import('@/components/market/DailyReportPage'));
const StockOverviewPage = lazy(() => import('@/components/market/StockOverviewPage'));
const RealTimeMarketDashboard = lazy(() => import('@/components/market/RealTimeMarketDashboard'));
const SmartPickerPage = lazy(() => import('@/components/market/SmartPickerPage'));
const TradeExecutionPanel = lazy(() => import('@/components/trading/TradeExecutionPanel'));
const TradeHistoryPage = lazy(() => import('@/components/trading/TradeHistoryPage'));
const AIAdvisorPage = lazy(() => import('@/components/strategy/AIAdvisorPage'));
const PerformanceAttributionPage = lazy(() => import('@/components/strategy/PerformanceAttributionPage'));
const StrategyPage = lazy(() => import('@/components/strategy/StrategyPage'));
const PortfolioPage = lazy(() => import('@/components/portfolio/PortfolioPage'));
const OrdersPage = lazy(() => import('@/components/orders/OrdersPage'));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'));
const MarketplacePage = lazy(() => import('@/components/marketplace/MarketplacePage'));
const LiveMonitorPage = lazy(() => import('@/components/live/LiveMonitorPage'));
const BacktestReportPage = lazy(() => import('@/components/backtest/BacktestReportPage'));
const BacktestComparisonPage = lazy(() => import('@/components/backtest/BacktestComparisonPage'));
const RiskDashboardPage = lazy(() => import('@/components/risk/RiskDashboardPage'));

const pages: Record<string, React.LazyExoticComponent<React.FC>> = {
  dashboard: DashboardPage,
  market: MarketPage,
  sectorHeatmap: MarketHeatmapPage,
  macroDashboard: MacroDashboardPage,
  stockScreener: StockScreenerPage,
  newsDashboard: NewsDashboardPage,
  sectorRotation: SectorRotationPage,
  consumerDashboard: ConsumerDashboard,
  marginDashboard: MarginDashboard,
  dragonTiger: DragonTigerPage,
  capitalFlow: CapitalFlowPage,
  fundHoldings: FundHoldingsPage,
  dailyReport: DailyReportPage,
  stockOverview: StockOverviewPage,
  realTimeMarket: RealTimeMarketDashboard,
  smartPicker: SmartPickerPage,
  tradeExecution: TradeExecutionPanel,
  tradeHistory: TradeHistoryPage,
  aiAdvisor: AIAdvisorPage,
  performanceAttribution: PerformanceAttributionPage,
  strategy: StrategyPage,
  portfolio: PortfolioPage,
  orders: OrdersPage,
  settings: SettingsPage,
  marketplace: MarketplacePage,
  live: LiveMonitorPage,
  backtest: BacktestReportPage,
  backtestComparison: BacktestComparisonPage,
  risk: RiskDashboardPage,
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
  const [showShortcuts, setShowShortcuts] = useState(false);

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
  useKeyboardShortcuts({ onOpenShortcuts: () => setShowShortcuts(true) });

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
      <KeyboardShortcutsPanel
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
