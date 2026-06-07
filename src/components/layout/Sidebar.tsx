import { useAppStore } from '@/stores/appStore';
import type { SidebarView } from '@/lib/types';
import AccountSummary from '@/components/trading/AccountSummary';

interface NavItem {
  id: SidebarView;
  icon: string;
  label: string;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', icon: '📊', label: '总览看板', section: '总览' },
  { id: 'market', icon: '📈', label: '行情中心', section: '交易' },
  { id: 'strategy', icon: '🧠', label: '策略工坊' },
  { id: 'ai', icon: '🐋', label: 'AI 助理' },
  { id: 'marketplace', icon: '🏪', label: '策略市场' },
  { id: 'backtest', icon: '🔬', label: '回测报告' },
  { id: 'portfolio', icon: '💼', label: '持仓管理' },
  { id: 'orders', icon: '📋', label: '委托订单' },
  { id: 'trade', icon: '💹', label: '交易台' },
  { id: 'risk', icon: '🛡️', label: '风控面板' },
  { id: 'alert', icon: '🔔', label: '告警中心' },
  { id: 'settings', icon: '⚙️', label: '系统设置', section: '系统' },
];

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
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
