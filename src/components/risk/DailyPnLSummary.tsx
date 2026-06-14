// ── TradingEasy — DailyPnLSummary () ───────────────────────────

import { useMemo } from 'react';
import i18n from '../../i18n';

interface PnLItem {
  symbol: string;
  realized: number;
  unrealized: number;
  total: number;
}

interface DailyPnLSummaryProps {
  data?: PnLItem[];
  title?: string;
}

const DEMO_DATA: PnLItem[] = [
{ symbol: 'TQQQ', realized: 1200, unrealized: 850, total: 2050 },
{ symbol: 'AAPL', realized: 0, unrealized: -320, total: -320 },
{ symbol: 'NVDA', realized: 680, unrealized: 420, total: 1100 },
{ symbol: 'SOXL', realized: -450, unrealized: 180, total: -270 },
{ symbol: 'QQQ', realized: 0, unrealized: 210, total: 210 },
{ symbol: 'SPY', realized: 150, unrealized: 95, total: 245 }];


export default function DailyPnLSummary({
  data = DEMO_DATA,
  title = i18n.t('DailyPnLSummary.k0')
}: DailyPnLSummaryProps) {
  const summary = useMemo(() => {
    const totalRealized = data.reduce((s, d) => s + d.realized, 0);
    const totalUnrealized = data.reduce((s, d) => s + d.unrealized, 0);
    const total = totalRealized + totalUnrealized;
    const winners = data.filter((d) => d.total > 0);
    const losers = data.filter((d) => d.total < 0);
    const best = winners.length > 0 ? winners.reduce((a, b) => a.total > b.total ? a : b) : null;
    const worst = losers.length > 0 ? losers.reduce((a, b) => a.total < b.total ? a : b) : null;
    return { totalRealized, totalUnrealized, total, winners: winners.length, losers: losers.length, best, worst };
  }, [data]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">{title}</h2>
        <span className={`text-sm font-mono font-bold ${summary.total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {summary.total >= 0 ? '+' : ''}${summary.total.toFixed(0)}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-[#12121a] rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500">{i18n.t('DailyPnLSummary.k1')}</div>
          <div className={`text-sm font-mono font-medium ${summary.totalRealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {summary.totalRealized >= 0 ? '+' : ''}${summary.totalRealized.toFixed(0)}
          </div>
        </div>
        <div className="bg-[#12121a] rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500">{i18n.t('DailyPnLSummary.k2')}</div>
          <div className={`text-sm font-mono font-medium ${summary.totalUnrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {summary.totalUnrealized >= 0 ? '+' : ''}${summary.totalUnrealized.toFixed(0)}
          </div>
        </div>
        <div className="bg-[#12121a] rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500">{i18n.t("DailyPnLSummary.r92_bb82")}</div>
          <div className="text-sm font-mono font-medium text-gray-300">
            <span className="text-emerald-400">{summary.winners}</span>
            <span className="text-gray-500 mx-1">/</span>
            <span className="text-red-400">{summary.losers}</span>
          </div>
        </div>
      </div>

      {/* Best/Worst */}
      {(summary.best || summary.worst) &&
      <div className="flex items-center gap-2 mb-3 text-[10px]">
          {summary.best &&
        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded">{i18n.t("DailyPnLSummary.r92_fc9f")}
          {summary.best.symbol} +${summary.best.total.toFixed(0)}
            </span>
        }
          {summary.worst &&
        <span className="bg-red-500/10 text-red-400 px-2 py-1 rounded">{i18n.t("DailyPnLSummary.r92_356f")}
          {summary.worst.symbol} ${summary.worst.total.toFixed(0)}
            </span>
        }
        </div>
      }

      {/* Breakdown */}
      <div className="space-y-1">
        {sorted.map((item) => {
          const maxVal = Math.max(...data.map((d) => Math.abs(d.total)));
          const barWidth = maxVal > 0 ? Math.abs(item.total) / maxVal * 100 : 0;
          const isProfit = item.total >= 0;
          return (
            <div key={item.symbol} className="flex items-center gap-2">
              <span className="text-gray-400 text-[10px] w-10 flex-shrink-0">{item.symbol}</span>
              <div className="flex-1 h-4 bg-[#12121a] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isProfit ? 'bg-emerald-500/40' : 'bg-red-500/40'}`}
                  style={{ width: `${Math.max(barWidth, 4)}%` }} />
                
              </div>
              <span className={`text-[10px] font-mono w-12 text-right ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}${item.total.toFixed(0)}
              </span>
            </div>);

        })}
      </div>
    </div>);

}