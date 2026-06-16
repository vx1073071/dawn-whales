import { useAppStore } from '@/stores/appStore';
import type { SidebarView } from '@/lib/types';
import AccountSummary from '@/components/trading/AccountSummary';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

interface NavItem {
  id: SidebarView;
  icon: string;
  label: string;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', icon: '📊', label: 'nav.overview', section: 'nav.overview' },
  { id: 'market', icon: '📈', label: 'components.marketQuotes', section: 'components.trade' },
  { id: 'strategy', icon: '🧠', label: i18n.t('Sidebar.k0') },
  { id: 'ai', icon: '🐋', label: 'components.aiAssistant' },
  { id: 'ai-hub', icon: '🤖', label: 'components.aiHub', section: 'AI Services' },
  { id: 'marketplace', icon: '🏪', label: i18n.t('Sidebar.k1') },
  { id: 'creator', icon: '⭐', label: 'components.creatorCenter' },
  { id: 'signals', icon: '📡', label: 'components.signalAnalysis' },
  { id: 'backtest', icon: '🔬', label: i18n.t('Sidebar.k2') },
  { id: 'portfolio', icon: '💼', label: 'components.portfolio' },
  { id: 'orders', icon: '📋', label: i18n.t('Sidebar.k3') },
  { id: 'trade', icon: '💹', label: 'components.tradingDesk' },
  { id: 'risk', icon: '🛡️', label: 'components.riskPanel' },
  { id: 'riskviz', icon: '📉', label: 'components.riskVisual' },
  { id: 'alert', icon: '🔔', label: i18n.t('Sidebar.k4') },
  { id: 'copytrade', icon: '🐋', label: 'Copy Trade', section: 'components.trade' },
  { id: 'wallet', icon: '💰', label: 'Wallet', section: 'components.trade' },
  { id: 'settings', icon: '⚙️', label: i18n.t('Sidebar.k5'), section: i18n.t('Sidebar.k6') },
];

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const { t: _t } = useTranslation();
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
