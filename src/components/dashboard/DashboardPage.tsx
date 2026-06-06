// ── DAWN WHALES — Dashboard (v0.6.0) ────────────────────────────────────────
// 总资产/持仓热力图/净值曲线/盈亏总览/最近信号

import { useState, useEffect, useMemo } from 'react';
import {
  getAccounts, getFunds, getPositions, isConnected,
  getAllStrategies, getMarketplaceList,
} from '../../lib/bridge-api';
import { useWebSocketQuotes } from '../../hooks/useWebSocketQuotes';
import BrokerStatusBar from '../trading/BrokerStatusBar';

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
  const { t } = useTranslation();
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [positions, setPositions] = useState<PositionCard[]>([]);
  const [strategies, setStrategies] = useState<StrategyStatus[]>([]);
  const [marketplaceCount, setMarketplaceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // ML-24-03: WebSocket real-time quotes (fallback: 30s polling)
  const positionCodes = useMemo(() => positions.map(p => p.code), [positions]);
  const { quotes, connected: wsConnected } = useWebSocketQuotes({
    symbols: positionCodes,
    enabled: positionCodes.length > 0,
    fallbackIntervalMs: 30000,
  });

  // Merge WS quotes into position data
  const livePositions = useMemo(() => {
    if (!wsConnected || quotes.size === 0) return positions;
    return positions.map(p => {
      const q = quotes.get(p.code);
      if (!q) return p;
      const newMarketPrice = q.price;
      const newMarketValue = p.qty * newMarketPrice;
      const newPnl = (newMarketPrice - p.marketPrice) * p.qty + p.pnl;
      const newPnlPct = p.marketPrice > 0 ? ((newMarketPrice - p.marketPrice) / p.marketPrice) * 100 : 0;
      return { ...p, marketPrice: newMarketPrice, marketValue: newMarketValue, pnl: newPnl, pnlPct: newPnlPct };
    });
  }, [positions, quotes, wsConnected]);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadDashboard() {
    setError(null);
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
            name: s.name || t('common.unnamed'),
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
    } catch (e: any) {
      setError(e?.message || t('common.loadingFailed'));
    }
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
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-400 text-sm">{t('common.loadingFailed')}: {error}</div>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-[#D4A853] text-black rounded-lg text-sm font-medium hover:bg-[#c49a4a] transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white">📊 总览看板</h1>
          <BrokerStatusBar compact />
        </div>
        <p className="text-gray-400 text-sm">
          {connected ? '已连接 OpenD · 实时数据' : '未连接券商 · 请先在设置中连接'}
        </p>
      </div>

      {/* Account Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label={t('dashboard.totalAssets')}
          value={account ? `${(account.totalAssets / 10000).toFixed(0)}${t('common.tenThousand')}` : '--'}
          sub={account?.currency || ''}
          color="text-white"
        />
        <SummaryCard
          label={t('dashboard.todayPnl')}
          value={account ? `${account.todayPnl >= 0 ? '+' : ''}${(account.todayPnl / 10000).toFixed(1)}${t('common.tenThousand')}` : '--'}
          sub={account ? `${account.todayPnlPct >= 0 ? '+' : ''}${account.todayPnlPct.toFixed(2)}%` : ''}
          color={pnlColor}
          bg={pnlBg}
        />
        <SummaryCard
          label={t('dashboard.marketValue')}
          value={account ? `${(account.marketValue / 10000).toFixed(0)}${t('common.tenThousand')}` : '--'}
          sub={`${t('common.cash')} ${account ? (account.cash / 10000).toFixed(0) : '--'}${t('common.tenThousand')}`}
          color="text-blue-400"
        />
        <SummaryCard
          label={t('dashboard.strategyMarket')}
          value={String(marketplaceCount || '--')}
          sub={t('dashboard.listedStrategies')}
          color="text-[#D4A853]"
        />
      </div>

      {/* Market Sector Heatmap + Market Breadth */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MarketHeatmap title={t('dashboard.marketHeatmap')} />
        <MarketBreadth />
      </div>

      {/* Equity Curve + Allocation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquityChart data={equityData} title={t('dashboard.equityChart')} height={280} showDrawdown />
        <PortfolioAllocationChart
          data={positions.map((p) => ({ name: p.code.split('.')[1] || p.code, value: p.marketValue, pnl: p.pnl, pnlPct: p.pnlPct }))}
          title={t('dashboard.portfolioAllocation')}
          height={280}
        />
      </div>

      {/* Position Heatmap */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">🗺️ 持仓热力图</h2>
        {livePositions.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">暂无持仓数据</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {livePositions.map((p) => {
              const width = Math.max(8, p.ratio);
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
          title={`📊 ${t('dashboard.performanceMetrics')}`}
        />
        <DailyPnLSummary />
      </div>

      {/* Bottom row: Strategies + Quick Trade + Market Clock */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Strategies */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">🧠 {t('dashboard.activeStrategies')}</h2>
          {strategies.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">{t('dashboard.noActiveStrategies')}</p>
          ) : (
            <div className="space-y-2">
              {strategies.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-[#12121a] rounded-lg px-4 py-3">
                  <div>
                    <div className="text-white text-sm">{s.name}</div>
                    <div className="text-gray-500 text-[10px]">{s.signals} {t('dashboard.signals')}</div>
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

      {/* OpenD Health Check */}
      <div className="bg-[#12121c] border border-white/5 rounded-xl p-4">
        <OpenDHealthPanel />
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

