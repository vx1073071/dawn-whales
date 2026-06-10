import { useAppStore } from '@/stores/appStore';
import type { SidebarView } from '@/lib/types';
import AccountSummary from '@/components/trading/AccountSummary';
import { useTranslation } from 'react-i18next';

interface NavItem {
  id: SidebarView;
  icon: string;
  label: string;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', icon: '📊', label: t('nav.overview'), section: t('nav.overview') },
  { id: 'market', icon: '📈', label: t('components.marketQuotes'), section: t('components.trade') },
  { id: 'strategy', icon: '🧠', label: t('components.strategy') },
  { id: 'ai', icon: '🐋', label: t('components.aiAssistant') },
  { id: 'marketplace', icon: '🏪', label: t('components.strategyMarketplace') },
  { id: 'creator', icon: '⭐', label: t('components.creatorCenter') },
  { id: 'signals', icon: '📡', label: t('components.signalAnalysis') },
  { id: 'backtest', icon: '🔬', label: t('components.backtest') },
  { id: 'portfolio', icon: '💼', label: t('components.portfolio') },
  { id: 'orders', icon: '📋', label: t('components.orders') },
  { id: 'trade', icon: '💹', label: t('components.tradingDesk') },
  { id: 'risk', icon: '🛡️', label: t('components.riskPanel') },
  { id: 'riskviz', icon: '📉', label: t('components.riskVisual') },
  { id: 'alert', icon: '🔔', label: t('components.alertCenter') },
  { id: 'settings', icon: '⚙️', label: t('components.settings'), section: t('components.system') },
];

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const { t } = useTranslation();
  const view = useAppStore((s) => s.sidebarView);
  const setView = useAppStore((s) => s.setView);

  let lastSection = '';

  return (
    <aside
      className={`bg-[#111119] border-r border-white/5 flex flex-col transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-52'
      }`}
    >
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          return (
            <div key={item.id}>
              {showSection && !collapsed && (
                <div className="px-4 pt-4 pb-1 text-[10px] text-gray-600 uppercase tracking-wider">
                  {item.section}
                </div>
              )}
              <button
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors border-l-2 ${
                  view === item.id
                    ? 'bg-[#C9A046]/10 text-[#D4A853] border-[#C9A046]'
                    : 'text-gray-400 border-transparent hover:bg-white/[0.03] hover:text-gray-200'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Multi-Broker Account Summary in sidebar */}
      {!collapsed && (
        <div className="border-t border-white/5">
          <AccountSummary />
        </div>
      )}
    </aside>
  );
}
