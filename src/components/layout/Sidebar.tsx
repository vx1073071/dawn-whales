import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getAccounts, getFunds } from '@/lib/bridge-api';
import type { SidebarView } from '@/lib/types';

interface NavItem {
  id: SidebarView;
  icon: string;
  label: string;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', icon: '📊', label: '总览看板', section: '总览' },
  { id: 'market', icon: '📈', label: '行情中心', section: '交易' },
  { id: 'sectorHeatmap', icon: '🗺️', label: '板块热力' },
  { id: 'macroDashboard', icon: '📉', label: '宏观数据' },
  { id: 'stockScreener', icon: '🔍', label: '智能选股' },
  { id: 'newsDashboard', icon: '📰', label: '新闻舆情' },
  { id: 'sectorRotation', icon: '🔄', label: '板块轮动' },
  { id: 'consumerDashboard', icon: '🛒', label: '消费数据' },
  { id: 'marginDashboard', icon: '💳', label: '融资融券' },
  { id: 'dragonTiger', icon: '🐉', label: '龙虎榜' },
  { id: 'capitalFlow', icon: '💰', label: '资金流向' },
  { id: 'fundHoldings', icon: '🏦', label: '基金持仓' },
  { id: 'dailyReport', icon: '📋', label: '每日简报' },
  { id: 'stockOverview', icon: '🔍', label: '个股诊断' },
  { id: 'realTimeMarket', icon: '⚡', label: '实时行情' },
  { id: 'dataQuality', icon: '🔍', label: '数据质量' },
  { id: 'cacheExplorer', icon: '💾', label: '缓存浏览' },
  { id: 'sentimentStream', icon: '🎭', label: '情绪流' },
  { id: 'smartPicker', icon: '🎯', label: '智能选股' },
  { id: 'tradeExecution', icon: '🚀', label: '交易执行' },
  { id: 'tradeHistory', icon: '📜', label: '交易历史' },
  { id: 'aiAdvisor', icon: '🤖', label: 'AI 投顾' },
  { id: 'performanceAttribution', icon: '📊', label: '绩效归因' },
  { id: 'regimeMonitor', icon: '🌊', label: '市场状态' },
  { id: 'factorExposure', icon: '🧬', label: '因子敞口' },
  { id: 'strategy', icon: '🧠', label: '策略工坊' },
  { id: 'marketplace', icon: '🏪', label: '策略市场' },
  { id: 'backtest', icon: '🔬', label: '回测报告' },
  { id: 'backtestComparison', icon: '📈', label: '回测对比' },
  { id: 'portfolio', icon: '💼', label: '持仓管理' },
  { id: 'portfolioRebalancer', icon: '⚖️', label: '组合再平衡' },
  { id: 'orders', icon: '📋', label: '委托订单' },
  { id: 'risk', icon: '🛡️', label: '风险仪表盘' },
  { id: 'opendHealth', icon: '🔌', label: 'OpenD 健康' },
  { id: 'settings', icon: '⚙️', label: '系统设置', section: '系统' },
];

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const view = useAppStore((s) => s.sidebarView);
  const setView = useAppStore((s) => s.setView);
  const conn = useAppStore((s) => s.connectionStatus);
  const [funds, setFunds] = useState<{ totalAssets: number; todayPnl: number } | null>(null);

  const isConnected = conn?.connected ?? false;

  useEffect(() => {
    if (isConnected) loadFunds();
    const interval = setInterval(() => { if (isConnected) loadFunds(); }, 30000);
    return () => clearInterval(interval);
  }, [isConnected]);

  async function loadFunds() {
    try {
      const accounts = await getAccounts();
      if (accounts.length > 0) {
        const f = await getFunds(accounts[0].accId);
        if (f) setFunds({ totalAssets: f.totalAssets, todayPnl: f.todayPnl || 0 });
      }
    } catch { /* silent */ }
  }

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

      {/* Account summary in sidebar */}
      {!collapsed && (
        <div className="border-t border-white/5 p-3">
          <div className="bg-[#0d0d14] rounded-lg p-3">
            <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">总资产</div>
            {funds ? (
              <>
                <div className="text-lg font-bold font-mono text-white">
                  ${funds.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`text-xs mt-1 font-mono ${funds.todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {funds.todayPnl >= 0 ? '+' : ''}${funds.todayPnl.toFixed(2)} 今日
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold font-mono text-gray-600">--</div>
                <div className="text-xs text-gray-600 mt-1">{isConnected ? '加载中...' : '未连接券商'}</div>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
