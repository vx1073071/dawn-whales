// ── DAWN WHALES — Dashboard (v0.6.0) ────────────────────────────────────────
// 总资产/持仓热力图/净值曲线/盈亏总览/最近信号

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAccounts, getFunds, getPositions, getQuotes, isConnected,
  getWatchlist, getAllStrategies, getComments, getMarketplaceList,
  exportDashboardPdf,
} from '../../lib/bridge-api';
import EquityChart from '../risk/EquityChart';
import PortfolioAllocationChart from '../risk/PortfolioAllocationChart';
import SignalTimeline from '../risk/SignalTimeline';
import MarketHeatmap from '../risk/MarketHeatmap';
import NotificationCenter from '../risk/NotificationCenter';
import MarketClock from '../risk/MarketClock';
import QuickTrade from '../risk/QuickTrade';
import PriceAlertPanel from '../risk/PriceAlertPanel';
import MarketBreadth from '../risk/MarketBreadth';
import EconomicCalendar from '../risk/EconomicCalendar';
import MarketMovers from '../risk/MarketMovers';
import WatchlistManager from '../risk/WatchlistManager';
import PerformanceMetricsPanel from '../risk/PerformanceMetricsPanel';
import DailyPnLSummary from '../risk/DailyPnLSummary';

interface AccountSummary {
  totalAssets: number;
  cash: number;
  marketValue: number;
  todayPnl: number;
  todayPnlPct: number;
  currency: string;
}

interface PositionCard {
  code: string;
  name: string;
  qty: number;
  marketPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  ratio: number;
}

interface StrategyStatus {
  id: string;
  name: string;
  status: 'running';
  totalReturn: number;
  signals: number;
}

export default function DashboardPage() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [positions, setPositions] = useState<PositionCard[]>([]);
  const [strategies, setStrategies] = useState<StrategyStatus[]>([]);
  const [marketplaceCount, setMarketplaceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadDashboard() {
    try {
      const conn = await isConnected();
      setConnected(conn);
      if (!conn) { setLoading(false); return; }

      const accs = await getAccounts();
      if (accs.length > 0) {
        const funds = await getFunds(accs[0].accountId);
        if (funds) {
          setAccount({
            totalAssets: funds.totalAssets || 0,
            cash: funds.cash || 0,
            marketValue: funds.marketValue || 0,
            todayPnl: funds.todayPnl || 0,
            todayPnlPct: funds.todayPnlPct || 0,
            currency: funds.currency || 'HKD',
          });
        }

        const pos = await getPositions(accs[0].accountId);
        if (pos && pos.length > 0) {
          const totalMV = pos.reduce((s: number, p: any) => s + (p.marketValue || 0), 0);
          setPositions(pos.map((p: any) => ({
            code: p.code,
            name: p.name || p.code,
            qty: p.qty,
            marketPrice: p.marketPrice || 0,
            marketValue: p.marketValue || 0,
            pnl: p.pnl || 0,
            pnlPct: p.pnlPct || 0,
            ratio: totalMV > 0 ? (p.marketValue || 0) / totalMV * 100 : 0,
          })));
        }
      }

      const strats = await getAllStrategies();
      if (strats) {
        setStrategies(
          strats.filter((s: any) => s.status === 'running').slice(0, 5).map((s: any) => ({
            id: s.id,
            name: s.name || '未命名',
            status: 'running' as const,
            totalReturn: s.totalReturn || 0,
            signals: s.signals || 0,
          }))
        );
      }

      const mkt = await getMarketplaceList('rating', 1);
      if (mkt?.strategies) {
        setMarketplaceCount(mkt.strategies.length);
      }
    } catch {}
    setLoading(false);
  }

  const pnlColor = (account?.todayPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400';
  const pnlBg = (account?.todayPnl ?? 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10';

  // Demo equity curve (90 days) — will be replaced with real account equity history
  const equityData = useMemo(() => {
    const data: { time: string; equity: number }[] = [];
    let equity = account?.totalAssets || 100000;
    const now = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const change = (Math.random() - 0.47) * 0.015 * equity;
      equity += change;
      data.push({ time: d.toISOString().split('T')[0], equity: Math.max(equity, 50000) });
    }
    return data;
  }, [account?.totalAssets]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">📊 总览看板</h1>
          <p className="text-gray-400 text-sm">
            {connected ? '已连接 OpenD · 实时数据' : '未连接券商 · 请先在设置中连接'}
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              const filename = `dawn-whales-dashboard-${new Date().toISOString().split('T')[0]}.pdf`;
              const result = await exportDashboardPdf(filename);
              if (result?.success) {
                alert(`PDF 已导出: ${result.path}`);
              } else {
                alert(`导出失败: ${result?.error || '未知错误'}`);
              }
            } catch (e: any) {
              alert(`导出失败: ${e.message}`);
            }
          }}
          className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-3 py-2 rounded-lg border border-white/5 transition-colors flex items-center gap-1.5"
          title="导出当前看板为 PDF"
        >
          📄 导出 PDF
        </button>
      </div>

      {/* Account Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="总资产"
          value={account ? `${(account.totalAssets / 10000).toFixed(0)}万` : '--'}
          sub={account?.currency || ''}
          color="text-white"
        />
        <SummaryCard
          label="今日盈亏"
          value={account ? `${account.todayPnl >= 0 ? '+' : ''}${(account.todayPnl / 10000).toFixed(1)}万` : '--'}
          sub={account ? `${account.todayPnlPct >= 0 ? '+' : ''}${account.todayPnlPct.toFixed(2)}%` : ''}
          color={pnlColor}
          bg={pnlBg}
        />
        <SummaryCard
          label="持仓市值"
          value={account ? `${(account.marketValue / 10000).toFixed(0)}万` : '--'}
          sub={`现金 ${account ? (account.cash / 10000).toFixed(0) : '--'}万`}
          color="text-blue-400"
        />
        <SummaryCard
          label="策略市场"
          value={String(marketplaceCount || '--')}
          sub="已上架策略"
          color="text-[#D4A853]"
        />
      </div>

      {/* Market Sector Heatmap + Market Breadth */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MarketHeatmap title="🗺️ 市场板块热力图" />
        <MarketBreadth />
      </div>

      {/* Equity Curve + Allocation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquityChart data={equityData} title="📈 账户净值走势" height={280} showDrawdown />
        <PortfolioAllocationChart
          data={positions.map((p) => ({ name: p.code.split('.')[1] || p.code, value: p.marketValue, pnl: p.pnl, pnlPct: p.pnlPct }))}
          title="🥧 持仓分配"
          height={280}
        />
      </div>

      {/* Position Heatmap */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">🗺️ 持仓热力图</h2>
        {positions.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">暂无持仓数据</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {positions.map((p) => {
              const width = Math.max(8, p.ratio);
              const h = Math.max(60, p.ratio * 4 + 40);
              const isProfit = p.pnl >= 0;
              const intensity = Math.min(1, Math.abs(p.pnlPct) / 30);
              const bg = isProfit
                ? `rgba(34, 197, 94, ${0.1 + intensity * 0.5})`
                : `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`;
              const border = isProfit ? 'border-emerald-500/30' : 'border-red-500/30';

              return (
                <div
                  key={p.code}
                  className={`flex flex-col justify-between rounded-lg p-3 border ${border} cursor-pointer hover:scale-[1.02] transition-transform`}
                  style={{ width: `${width}%`, minWidth: 120, background: bg }}
                >
                  <div>
                    <div className="text-white text-xs font-medium truncate">{p.code.split('.')[1] || p.code}</div>
                    <div className="text-gray-400 text-[10px] truncate">{p.name?.slice(0, 12)}</div>
                  </div>
                  <div>
                    <div className={`text-sm font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isProfit ? '+' : ''}{p.pnl.toFixed(0)}
                    </div>
                    <div className={`text-[10px] ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                      {isProfit ? '+' : ''}{p.pnlPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Performance Metrics + Daily PnL Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PerformanceMetricsPanel
          trades={positions.flatMap(p => [
            ...(p.pnl !== 0 ? [{ pnl: p.pnl, timestamp: Date.now() }] : [])
          ])}
          title="📊 交易绩效指标"
        />
        <DailyPnLSummary />
      </div>

      {/* Bottom row: Strategies + Quick Trade + Market Clock */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Strategies */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">🧠 运行中的策略</h2>
          {strategies.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">暂无运行中的策略</p>
          ) : (
            <div className="space-y-2">
              {strategies.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-[#12121a] rounded-lg px-4 py-3">
                  <div>
                    <div className="text-white text-sm">{s.name}</div>
                    <div className="text-gray-500 text-[10px]">{s.signals} 个信号</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className={`text-sm font-mono ${s.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {s.totalReturn >= 0 ? '+' : ''}{s.totalReturn.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Trade */}
        <QuickTrade />

        {/* Market Clock - hidden on mobile */}
        <div className="hidden md:block">
          <MarketClock />
        </div>
      </div>

      {/* Signal Timeline + Notifications + Price Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SignalTimeline maxItems={20} autoRefresh />
        <NotificationCenter />
        <PriceAlertPanel />
      </div>

      {/* Economic Calendar + Market Movers + Watchlist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EconomicCalendar />
        <MarketMovers />
        <WatchlistManager />
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color, bg }: {
  label: string; value: string; sub: string; color: string; bg?: string;
}) {
  return (
    <div className={`bg-[#1a1a25] border border-white/5 rounded-xl p-4 ${bg || ''}`}>
      <div className="text-gray-500 text-[11px] mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-gray-500 text-[10px] mt-0.5">{sub}</div>
    </div>
  );
}

function StatusRow({ label, ok, okText = '正常', failText = '异常' }: {
  label: string; ok: boolean; okText?: string; failText?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={`flex items-center gap-1.5 ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
        {ok ? okText : failText}
      </span>
    </div>
  );
}
