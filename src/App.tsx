import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useBridgeSync } from '@/hooks/useBridgeSync';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import StatusBar from '@/components/layout/StatusBar';
import MarketPage from '@/components/market/MarketPage';
import StrategyPage from '@/components/strategy/StrategyPage';
import PortfolioPage from '@/components/portfolio/PortfolioPage';
import OrdersPage from '@/components/orders/OrdersPage';
import SettingsPage from '@/components/settings/SettingsPage';
import MarketplacePage from '@/components/marketplace/MarketplacePage';
import OnboardingModal from '@/components/OnboardingModal';
import { connectBroker } from '@/lib/bridge-api';

const pages: Record<string, React.FC> = {
  market: MarketPage,
  strategy: StrategyPage,
  portfolio: PortfolioPage,
  orders: OrdersPage,
  settings: SettingsPage,
  marketplace: MarketplacePage,
  // Aliases for views that share pages
  live: MarketPage,
  backtest: StrategyPage,
  risk: SettingsPage,
};

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

  return (
    <div className="h-screen flex flex-col bg-surface-1 text-gray-200 overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <main className="flex-1 overflow-auto">
          <Page />
        </main>
      </div>
      <StatusBar />
      <OnboardingModal
        open={showOnboarding}
        onClose={handleCloseOnboarding}
        onConnect={handleConnect}
        connected={connected}
      />
    </div>
  );
}
