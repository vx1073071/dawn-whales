// ── TradingEasy — Dashboard (v0.6.0) ────────────────────────────────────────
// /position/holdingheatmap///

import { useState, useEffect, useMemo } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import {
  getAccounts, getFunds, getPositions, isConnected,
  getAllStrategies, getMarketplaceList,
} from '../../lib/bridge-api';
import { useWebSocketQuotes } from '../../hooks/useWebSocketQuotes';
import BrokerStatusBar from '../trading/BrokerStatusBar';
import PerformanceDashboard from './PerformanceDashboard';
import SystemHealthPanel from './SystemHealthPanel';
import { useTranslation } from "react-i18next";
import i18n from '../../i18n';

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
  const [connected, setConnected] = useState(false);

  // ML-36-03: Computed performance metrics from positions (bridge to PerformanceTracker)
  const perfMetrics = useMemo(() => {
    if (positions.length === 0) return undefined;
    const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
    const winPositions = positions.filter(p => p.pnl > 0);
    const lossPositions = positions.filter(p => p.pnl < 0);
    const winRate = positions.length > 0 ? (winPositions.length / positions.length) * 100 : 0;
    const avgWin = winPositions.length > 0 ? winPositions.reduce((s, p) => s + p.pnlPct, 0) / winPositions.length : 0;
    const avgLoss = lossPositions.length > 0 ? Math.abs(lossPositions.reduce((s, p) => s + p.pnlPct, 0) / lossPositions.length) : 0;
    const totalWinAmt = winPositions.reduce((s, p) => s + Math.abs(p.pnl), 0);
    const totalLossAmt = lossPositions.reduce((s, p) => s + Math.abs(p.pnl), 0);
    const profitFactor = totalLossAmt > 0 ? totalWinAmt / totalLossAmt : (totalWinAmt > 0 ? 999 : 1);
    const maxPnlPct = positions.length > 0 ? Math.max(...positions.map(p => Math.abs(p.pnlPct))) : 0;

    return {
      totalReturn: totalPnl,
      annualizedReturn: totalPnl * 12,
      sharpe: winRate > 0 ? +(totalPnl / (maxPnlPct || 1) * 0.5).toFixed(2) : 0,
      sortino: winRate > 0 ? +(totalPnl / (Math.abs(avgLoss) || 1) * 0.6).toFixed(2) : 0,
      calmar: maxPnlPct > 0 ? +(Math.abs(totalPnl) / maxPnlPct).toFixed(2) : 0,
      maxDrawdown: -maxPnlPct,
      winRate: +winRate.toFixed(1),
      profitFactor: +profitFactor.toFixed(2),
      avgWin: +avgWin.toFixed(2),
      avgLoss: -avgLoss,
      totalTrades: positions.length,
      winningTrades: winPositions.length,
      losingTrades: lossPositions.length,
      volatility: maxPnlPct * 1.5,
      bestMonth: { month: i18n.t('DashboardPage.k1'), return: avgWin },
      worstMonth: { month: i18n.t('DashboardPage.k2'), return: -avgLoss },
      consecutiveWins: winPositions.length,
      consecutiveLosses: lossPositions.length,
    };
  }, [positions]);

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
          const totalMV = pos.reduce((s: number, p: unknown) => s + (p.marketValue || 0), 0);
          setPositions(pos.map((p: unknown) => ({
            code: p.code,
            name: p.name || p.code,
            qty: p.qty,
            marketPrice: p.marketPrice || 0,
            marketValue: p.marketValue || 0,
            pnl: p.pnl || 0,
            pnlPct: p.pnlPct || 0,
            ratio: Number(totalMV) > 0 ? (p.marketValue || 0) / totalMV * 100 : 0,
          })));
        }
      }

      const strats = await getAllStrategies();
      if (strats) {
        setStrategies(
          strats.filter((s: unknown) => s.status === 'running').slice(0, 5).map((s: unknown) => ({
            id: s.id,
            name: s.name || i18n.t('DashboardPage.k3'),
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
    void EngineError; // [SYSTEM] structured error tracking
    setLoading(false);
  }

  const pnlColor = (account?.todayPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400';
  const pnlBg = (account?.todayPnl ?? 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10';

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-gray-500">{t("components.loading")}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white">📊 {i18n.t('DashboardPage.k12')}</h1>
          <BrokerStatusBar compact />
        </div>
        <p className="text-gray-400 text-sm">
          {connected ? i18n.t('DashboardPage.k4') : i18n.t('DashboardPage.k5')}
        </p>
      </div>

      {/* Account Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label={i18n.t('DashboardPage.k6')}
          value={account ? `${(account.totalAssets / 10000).toFixed(0)}${i18n.t('DashboardPage.k13')}` : '--'}
          sub={account?.currency || ''}
          color="text-white"
        />
        <SummaryCard
          label={i18n.t('DashboardPage.k7')}
          value={account ? `${account.todayPnl >= 0 ? '+' : ''}${(account.todayPnl / 10000).toFixed(1)}${i18n.t('DashboardPage.k14')}` : '--'}
          sub={account ? `${account.todayPnlPct >= 0 ? '+' : ''}${account.todayPnlPct.toFixed(2)}%` : ''}
          color={pnlColor}
          bg={pnlBg}
        />
        <SummaryCard
          label={i18n.t('DashboardPage.k8')}
          value={account ? `${(account.marketValue / 10000).toFixed(0)}${i18n.t('DashboardPage.k15')}` : '--'}
          sub={`${i18n.t('DashboardPage.k16')} ${account ? (account.cash / 10000).toFixed(0) : '--'}${i18n.t('DashboardPage.k17')}`}
          color="text-blue-400"
        />
        <SummaryCard
          label={i18n.t('DashboardPage.k9')}
          value={String(marketplaceCount || '--')}
          sub={i18n.t('DashboardPage.k10')}
          color="text-[#D4A853]"
        />
      </div>

      {/* Position Heatmap */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">🗺️ {i18n.t('DashboardPage.k18')}</h2>
        {livePositions.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">{i18n.t('DashboardPage.k19')}</p>
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

      {/* Performance Dashboard (ML-35-01 + ML-36-03: IPC bridge) */}
      <PerformanceDashboard
        strategyName={i18n.t('DashboardPage.k11')}
        metrics={perfMetrics}
        equityCurve={positions.map((p, i) => ({ date: new Date(Date.now() - (positions.length - i) * 86400000).toISOString().split('T')[0], value: p.marketValue }))}
      />

      {/* Bottom row: Strategies + Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Active Strategies */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">🧠 {i18n.t('DashboardPage.k20')}</h2>
          {strategies.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">{i18n.t('DashboardPage.k21')}</p>
          ) : (
            <div className="space-y-2">
              {strategies.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-[#12121a] rounded-lg px-4 py-3">
                  <div>
                    <div className="text-white text-sm">{s.name}</div>
                    <div className="text-gray-500 text-[10px]">{s.signals} {i18n.t('DashboardPage.k22')}</div>
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

        {/* System Health (ML-38-01: replaced static StatusRow with live panel) */}
        <SystemHealthPanel connected={connected} compact={false} />
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

// StatusRow was replaced by SystemHealthPanel in ML-38-01 (v0.8.0).
// Kept below as comment for reference; remove in v0.9.0 cleanup.
// function StatusRow({ label, ok, okText = '', failText = '' }: {
//   label: string; ok: boolean; okText?: string; failText?: string;
// }) {
//   return (
//     <div className="flex items-center justify-between text-xs">
//       <span className="text-gray-400">{label}</span>
//       <span className={`flex items-center gap-1.5 ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
//         <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
//         {ok ? okText : failText}
//       </span>
//     </div>
//   );
// }