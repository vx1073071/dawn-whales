import React from 'react';
import { useAppStore } from '@/stores/appStore';
import type { SidebarView } from '@/lib/types';

interface NavItem {
  id: SidebarView;
  icon: string;
  label: string;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'market', icon: '📊', label: '行情中心', section: '交易' },
  { id: 'strategy', icon: '🧠', label: '策略工坊' },
  { id: 'marketplace', icon: '🏪', label: '策略市场' },
  { id: 'backtest', icon: '📈', label: '回测报告' },
  { id: 'live', icon: '⚡', label: '实盘运行', section: '管理' },
  { id: 'portfolio', icon: '💼', label: '持仓管理' },
  { id: 'orders', icon: '📋', label: '委托订单' },
  { id: 'risk', icon: '🛡️', label: '风控设置' },
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
      className={`bg-surface-2 border-r border-border flex flex-col transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-52'
      }`}
    >
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          return (
            <React.Fragment key={item.id}>
              {showSection && !collapsed && (
                <div className="px-4 pt-4 pb-1 text-[10px] text-gray-500 uppercase tracking-wider">
                  {item.section}
                </div>
              )}
              <button
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors border-l-2 ${
                  view === item.id
                    ? 'bg-surface-3 text-primary border-primary'
                    : 'text-gray-400 border-transparent hover:bg-surface-hover hover:text-gray-200'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Account summary in sidebar */}
      {!collapsed && (
        <div className="border-t border-border p-3">
          <div className="bg-surface-3 rounded-lg p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">总资产</div>
            <div className="text-lg font-bold font-mono text-white">--</div>
            <div className="text-xs text-gray-500 mt-1">未连接券商</div>
          </div>
        </div>
      )}
    </aside>
  );
}
