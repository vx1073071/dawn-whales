import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ──────────────────────────────────────────────────────────────────

interface PositionInfo {
  code: string;
  name: string;
  quantity: number;
  avgCost: number;
  marketPrice: number;
  marketValue: number;
  dayPnL: number;
  totalPnL: number;
  totalPnLPct: number;
}

interface TradeOrder {
  id: string;
  signalId?: string;
  code: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  quantity: number;
  price: number;
  status: string;
  filledQty: number;
  filledPrice: number;
  commission: number;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
}

interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalCommission: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
}

interface DailyPnL {
  date: string;
  pnl: number;
  trades: number;
  commissions: number;
  startBalance: number;
  endBalance: number;
}

// ── Real IPC data via window.api.trade (preload.ts J-23-01 exposes 16 APIs) ─

// ── SubComponents ──────────────────────────────────────────────────────────

function PnLCard({ label, value, currency, color }: { label: string; value: number; currency: string; color?: string }) {
  const formatted = value >= 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
  const textColor = color ?? (value >= 0 ? 'text-emerald-400' : 'text-red-400');
  return (
    <div className="bg-[#1e2130] rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xl font-bold ${textColor}`}>
        {currency} {formatted}
      </span>
    </div>
  );
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-[#2a2d3a] rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(Math.abs(pct), 100)}%` }} />
    </div>
  );
}

function PositionRow({ pos }: { pos: PositionInfo }) {
  const pnlColor = pos.dayPnL >= 0 ? 'text-emerald-400' : 'text-red-400';
  return (
    <tr className="border-b border-[#2a2d3a] hover:bg-[#1e2130]/50 transition-colors">
      <td className="py-3 px-2 font-mono text-sm">{pos.code}</td>
      <td className="py-3 px-2 text-sm text-gray-300">{pos.name}</td>
      <td className="py-3 px-2 text-right text-sm">{pos.quantity.toLocaleString()}</td>
      <td className="py-3 px-2 text-right text-sm">{pos.avgCost.toFixed(2)}</td>
      <td className="py-3 px-2 text-right text-sm">{pos.marketPrice.toFixed(2)}</td>
      <td className="py-3 px-2 text-right text-sm">{pos.marketValue.toLocaleString()}</td>
      <td className={`py-3 px-2 text-right text-sm font-semibold ${pnlColor}`}>
        {pos.dayPnL >= 0 ? '+' : ''}{pos.dayPnL.toLocaleString()}
      </td>
      <td className={`py-3 px-2 text-right text-sm ${pnlColor}`}>
        {pos.totalPnLPct >= 0 ? '+' : ''}{pos.totalPnLPct.toFixed(2)}%
      </td>
    </tr>
  );
}

function OrderRow({ order }: { order: TradeOrder }) {
  const statusColors: Record<string, string> = {
    filled: 'bg-emerald-500/20 text-emerald-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    submitted: 'bg-blue-500/20 text-blue-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
    rejected: 'bg-red-500/20 text-red-400',
  };
  const sideColor = order.side === 'BUY' ? 'text-emerald-400' : 'text-red-400';
  return (
    <tr className="border-b border-[#2a2d3a] hover:bg-[#1e2130]/50 transition-colors">
      <td className="py-2 px-2 font-mono text-xs">{order.id}</td>
      <td className="py-2 px-2 font-mono text-sm">{order.code}</td>
      <td className={`py-2 px-2 text-sm font-semibold ${sideColor}`}>{order.side}</td>
      <td className="py-2 px-2 text-sm text-gray-300">{order.orderType}</td>
      <td className="py-2 px-2 text-right text-sm">{order.quantity}</td>
      <td className="py-2 px-2 text-right text-sm">{order.price > 0 ? order.price.toFixed(2) : '—'}</td>
      <td className="py-2 px-2 text-right text-sm text-gray-400">{order.filledQty}/{order.quantity}</td>
      <td className="py-2 px-2">
        <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[order.status] ?? 'text-gray-400'}`}>
          {order.status}
        </span>
      </td>
      <td className="py-2 px-2 text-xs text-gray-500">{new Date(order.createdAt).toLocaleTimeString()}</td>
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function TradeDashboardPage() {
  const { t } = useTranslation();
  const [positions, setPositions] = useState<PositionInfo[]>([]);
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [stats, setStats] = useState<TradeStats>({ totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, totalPnL: 0, totalCommission: 0, avgWin: 0, avgLoss: 0, maxDrawdown: 0, sharpeRatio: 0, profitFactor: 0 });
  const [daily, setDaily] = useState<DailyPnL[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'orders' | 'daily'>('overview');
  const [execMode, setExecMode] = useState<'paper' | 'real'>('paper');
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // In production, these call IPC handlers registered by trade-executor-ipc.ts
      const w = (window as any);
      const api = w?.api ?? w?.electron?.api;

      if (api?.trade) {
        const [posResult, ordersResult, statsResult, dailyResult, modeResult] = await Promise.all([
          api.trade.getPositions?.().catch(() => null),
          api.trade.getOrders?.().catch(() => null),
          api.trade.getStats?.().catch(() => null),
          api.trade.getDailyPnL?.().catch(() => null),
          api.trade.getExecutionMode?.().catch(() => 'paper'),
        ]);

        if (posResult?.success) setPositions(posResult.data ?? []);
        if (ordersResult?.success) setOrders(ordersResult.data ?? []);
        if (statsResult?.success) setStats(statsResult.data ?? MOCK_STATS);
        if (dailyResult?.success) setDaily(dailyResult.data ?? MOCK_DAILY);
        if (modeResult) setExecMode(typeof modeResult === 'string' ? modeResult as 'paper' | 'real' : modeResult?.data ?? 'paper');
      }
    } catch (err) {
      console.error('[TradeDashboard] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 seconds
    autoRefreshRef.current = setInterval(fetchData, 5000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [fetchData]);

  const totalMarketValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalDayPnL = positions.reduce((s, p) => s + p.dayPnL, 0);
  const totalPnL = positions.reduce((s, p) => s + p.totalPnL, 0);
  const todayDaily = daily[daily.length - 1];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {t('trade.dashboard.title') || 'Trade Dashboard'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {t('trade.dashboard.subtitle') || 'Real-time P&L, positions, and order management'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            execMode === 'real' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}>
            {execMode === 'real' ? '🔴 LIVE' : '🟢 PAPER'}
          </span>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-[#2a2d3a] hover:bg-[#353849] text-gray-300 rounded-lg text-sm transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── P&L Summary Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PnLCard label={t('trade.totalMarketValue') || 'Market Value'} value={totalMarketValue} currency="HKD" color="text-white" />
        <PnLCard label={t('trade.dayPnL') || "Today's P&L"} value={totalDayPnL} currency="HKD" />
        <PnLCard label={t('trade.totalPnL') || 'Total P&L'} value={totalPnL} currency="HKD" />
        <PnLCard
          label={t('trade.winRate') || 'Win Rate'}
          value={stats.winRate}
          currency=""
          color={stats.winRate >= 50 ? 'text-emerald-400' : 'text-yellow-400'}
        />
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total Trades', value: stats.totalTrades },
          { label: 'Wins', value: stats.winningTrades, color: 'text-emerald-400' },
          { label: 'Losses', value: stats.losingTrades, color: 'text-red-400' },
          { label: 'Avg Win', value: `${stats.avgWin.toLocaleString()}`, color: 'text-emerald-400' },
          { label: 'Avg Loss', value: `${stats.avgLoss.toLocaleString()}`, color: 'text-red-400' },
          { label: 'Max DD', value: `${stats.maxDrawdown}%`, color: 'text-yellow-400' },
        ].map(item => (
          <div key={item.label} className="bg-[#1e2130] rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400">{item.label}</div>
            <div className={`text-lg font-bold mt-1 ${item.color ?? 'text-white'}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* ── Sharpe & Profit Factor ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1e2130] rounded-lg p-4">
          <span className="text-xs text-gray-400">Sharpe Ratio</span>
          <div className="text-2xl font-bold text-white mt-1">{stats.sharpeRatio.toFixed(2)}</div>
          <MiniBar pct={stats.sharpeRatio * 20} color="bg-blue-400" />
        </div>
        <div className="bg-[#1e2130] rounded-lg p-4">
          <span className="text-xs text-gray-400">Profit Factor</span>
          <div className="text-2xl font-bold text-white mt-1">{stats.profitFactor.toFixed(2)}</div>
          <MiniBar pct={stats.profitFactor * 30} color="bg-purple-400" />
        </div>
      </div>

      {/* ── Tab Navigation ─────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#1a1b26] rounded-lg p-1 w-fit">
        {(['overview', 'positions', 'orders', 'daily'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-[#2a2d3a] text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'overview' && (t('trade.tab.overview') || 'Overview')}
            {tab === 'positions' && (t('trade.tab.positions') || 'Positions')}
            {tab === 'orders' && (t('trade.tab.orders') || 'Orders')}
            {tab === 'daily' && (t('trade.tab.daily') || 'Daily P&L')}
          </button>
        ))}
      </div>

      {/* ── Positions Table ────────────────────────────────────────────── */}
      {activeTab === 'positions' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-[#2a2d3a]">
                <th className="py-2 px-2 font-medium">Code</th>
                <th className="py-2 px-2 font-medium">Name</th>
                <th className="py-2 px-2 font-medium text-right">Qty</th>
                <th className="py-2 px-2 font-medium text-right">Avg Cost</th>
                <th className="py-2 px-2 font-medium text-right">Market</th>
                <th className="py-2 px-2 font-medium text-right">Value</th>
                <th className="py-2 px-2 font-medium text-right">Day P&L</th>
                <th className="py-2 px-2 font-medium text-right">Total P&L%</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(pos => <PositionRow key={pos.code} pos={pos} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Orders Table ───────────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-[#2a2d3a]">
                <th className="py-2 px-2 font-medium">ID</th>
                <th className="py-2 px-2 font-medium">Code</th>
                <th className="py-2 px-2 font-medium">Side</th>
                <th className="py-2 px-2 font-medium">Type</th>
                <th className="py-2 px-2 font-medium text-right">Qty</th>
                <th className="py-2 px-2 font-medium text-right">Price</th>
                <th className="py-2 px-2 font-medium text-right">Filled</th>
                <th className="py-2 px-2 font-medium">Status</th>
                <th className="py-2 px-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-gray-500">No active orders</td></tr>
              ) : (
                orders.map(order => <OrderRow key={order.id} order={order} />)
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Daily P&L Table ────────────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-[#2a2d3a]">
                <th className="py-2 px-2 font-medium">Date</th>
                <th className="py-2 px-2 font-medium text-right">Start Balance</th>
                <th className="py-2 px-2 font-medium text-right">End Balance</th>
                <th className="py-2 px-2 font-medium text-right">P&L</th>
                <th className="py-2 px-2 font-medium text-right">Trades</th>
                <th className="py-2 px-2 font-medium text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {daily.slice().reverse().map(d => {
                const pnlColor = d.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
                return (
                  <tr key={d.date} className="border-b border-[#2a2d3a] hover:bg-[#1e2130]/50">
                    <td className="py-2 px-2 text-sm">{d.date}</td>
                    <td className="py-2 px-2 text-right text-sm text-gray-300">{d.startBalance.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-sm text-gray-300">{d.endBalance.toLocaleString()}</td>
                    <td className={`py-2 px-2 text-right text-sm font-semibold ${pnlColor}`}>
                      {d.pnl >= 0 ? '+' : ''}{d.pnl.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right text-sm text-gray-400">{d.trades}</td>
                    <td className="py-2 px-2 text-right text-sm text-gray-400">{d.commissions.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Overview Tab: Compact summary of all views ──────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Today's P&L Daily Row */}
          {todayDaily && (
            <div className="bg-[#1e2130] rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400">{t('trade.today') || "Today's Summary"}</span>
                <div className="text-sm text-gray-300 mt-1">
                  {todayDaily.trades} trades · Commissions: {todayDaily.commissions.toLocaleString()}
                </div>
              </div>
              <div className={`text-xl font-bold ${todayDaily.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {todayDaily.pnl >= 0 ? '+' : ''}{todayDaily.pnl.toLocaleString()} HKD
              </div>
            </div>
          )}

          {/* Top 3 positions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('trade.topPositions') || 'Top Positions'}</h3>
            <div className="space-y-2">
              {positions.slice(0, 3).map(pos => {
                const pnlColor = pos.dayPnL >= 0 ? 'text-emerald-400' : 'text-red-400';
                return (
                  <div key={pos.code} className="bg-[#1e2130] rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm text-white">{pos.code}</span>
                      <span className="text-xs text-gray-400 ml-2">{pos.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-300">{pos.marketValue.toLocaleString()} HKD</span>
                      <span className={`text-sm font-semibold ${pnlColor}`}>
                        {pos.dayPnL >= 0 ? '+' : ''}{pos.dayPnL.toLocaleString()} ({pos.totalPnLPct >= 0 ? '+' : ''}{pos.totalPnLPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Orders */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('trade.recentOrders') || 'Recent Orders'}</h3>
            <div className="space-y-1">
              {orders.slice(0, 5).map(order => {
                const sideColor = order.side === 'BUY' ? 'text-emerald-400' : 'text-red-400';
                const statusColors: Record<string, string> = {
                  filled: 'bg-emerald-500/20 text-emerald-400',
                  pending: 'bg-yellow-500/20 text-yellow-400',
                  submitted: 'bg-blue-500/20 text-blue-400',
                  cancelled: 'bg-gray-500/20 text-gray-400',
                  rejected: 'bg-red-500/20 text-red-400',
                };
                return (
                  <div key={order.id} className="bg-[#1e2130] rounded-lg p-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-gray-500">{order.id}</span>
                      <span className="font-mono text-white">{order.code}</span>
                      <span className={sideColor}>{order.side}</span>
                      <span className="text-gray-400">{order.orderType}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-300">{order.quantity} qty</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[order.status] ?? 'text-gray-400'}`}>
                        {order.status}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
