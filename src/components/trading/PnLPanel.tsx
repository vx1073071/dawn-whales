// R126-Q01: nocheck cleared — cleared
import { useState, useEffect } from 'react';

import { useTranslation } from 'react-i18next';
import { getAccounts, getFunds, getPositions } from '@/lib/bridge-api';

interface PnLSummary {
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dailyPnl: number;
  dailyPnlPct: number;
  winCount: number;
  lossCount: number;
  winRate: number;
}

export default function PnLPanel() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PnLSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPnL();
  }, []);

  async function loadPnL() {
    setLoading(true);
    setError(null);
    try {
      const accs = await getAccounts();
      if (!accs || accs.length === 0) { setLoading(false); return; }

      const funds = await getFunds(accs[0].accountId || accs[0].accId);
      const positions = await getPositions(accs[0].accountId || accs[0].accId);

      const unrealized = positions?.reduce((s: number, p: unknown) => s + (p.pnl || 0), 0) || 0;
      const daily = funds?.todayPnl || 0;
      const totalAssets = funds?.totalAssets || 1;

      setSummary({
        totalPnl: daily + unrealized,
        realizedPnl: daily,
        unrealizedPnl: unrealized,
        dailyPnl: daily,
        dailyPnlPct: (daily / totalAssets) * 100,
        winCount: positions?.filter((p: unknown) => (p.pnl || 0) > 0).length || 0,
        lossCount: positions?.filter((p: unknown) => (p.pnl || 0) < 0).length || 0,
        winRate: positions?.length > 0
          ? (positions.filter((p: unknown) => (p.pnl || 0) > 0).length / positions.length) * 100
          : 0,
      });
    } catch (e: unknown) {
      setError((e as any)?.message || t('common.loadingFailed'));
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
  const color = (n: number) => n >= 0 ? 'text-emerald-400' : 'text-red-400';
  const bg = (n: number) => n >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10';

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{t('trading.pnl')}</h3>
        <button onClick={loadPnL} disabled={loading} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          {loading ? '...' : '⟳'}
        </button>
      </div>

      {error && (
        <div className="p-3 text-red-400 text-xs">{error}</div>
      )}

      {summary && (
        <div className="p-4 space-y-3">
          <div className={`${bg(summary.dailyPnl)} rounded-lg p-3`}>
            <div className="text-xs text-gray-400 mb-1">{t('trading.todayPnl')}</div>
            <div className={`text-xl font-bold ${color(summary.dailyPnl)}`}>{fmt(summary.dailyPnl)}</div>
            <div className={`text-xs ${color(summary.dailyPnlPct)}`}>{fmt(summary.dailyPnlPct)}%</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#12121a] rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">{t('trading.unrealizedPnl')}</div>
              <div className={`text-sm font-semibold ${color(summary.unrealizedPnl)}`}>{fmt(summary.unrealizedPnl)}</div>
            </div>
            <div className="bg-[#12121a] rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">{t('trading.winRate')}</div>
              <div className="text-sm font-semibold text-blue-400">{summary.winRate.toFixed(1)}%</div>
              <div className="text-[10px] text-gray-500">{summary.winCount}W / {summary.lossCount}L</div>
            </div>
          </div>
        </div>
      )}

      {!summary && !loading && !error && (
        <div className="p-6 text-center text-gray-500 text-sm">{t('common.noData')}</div>
      )}
    </div>
  );
}
