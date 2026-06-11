import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

interface Trade {
  id: number;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  side: 'BUY' | 'SELL';
  pnl: number;
  pnlPercent: number;
  holdingDays: number;
}

interface MonthlyReturnsHeatmapProps {
  trades: Trade[];
}

export default function MonthlyReturnsHeatmap({ trades }: MonthlyReturnsHeatmapProps) {
  const { t } = useTranslation();

  const monthlyData = useMemo(() => {
    if (trades.length === 0) return [];

    const months: Record<string, number> = {};

    trades.forEach((trade) => {
      const month = trade.exitDate.substring(0, 7); // YYYY-MM
      months[month] = (months[month] || 0) + trade.pnl;
    });

    return Object.entries(months).
    sort(([a], [b]) => a.localeCompare(b)).
    map(([month, pnl]) => ({ month, pnl }));
  }, [trades]);

  const stats = useMemo(() => {
    if (monthlyData.length === 0) {
      return { max: 0, min: 0, avg: 0, positiveMonths: 0, negativeMonths: 0 };
    }

    const pnls = monthlyData.map((m) => m.pnl);
    const max = Math.max(...pnls);
    const min = Math.min(...pnls);
    const avg = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const positiveMonths = pnls.filter((p) => p > 0).length;
    const negativeMonths = pnls.filter((p) => p < 0).length;

    return { max, min, avg, positiveMonths, negativeMonths };
  }, [monthlyData]);

  if (monthlyData.length === 0) {
    return (
      <div className="bg-[#12121a] rounded-xl border border-white/5 p-8 text-center text-gray-500">{t('noMonthlyData')}</div>);

  }

  return (
    <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
      <div className="text-sm font-medium text-white mb-3">{t('monthlyHeatmap')}</div>

      {/* Stats Summary */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <div className="p-3 bg-[#1a1a25] rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{t('bestMonth')}</div>
          <div className="text-lg font-bold text-emerald-400">
            +${stats.max.toFixed(0)}
          </div>
        </div>
        <div className="p-3 bg-[#1a1a25] rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('MonthlyReturnsHeatmap.k0')}</div>
          <div className="text-lg font-bold text-red-400">
            {stats.min >= 0 ? '+' : ''}${stats.min.toFixed(0)}
          </div>
        </div>
        <div className="p-3 bg-[#1a1a25] rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('MonthlyReturnsHeatmap.k1')}</div>
          <div className={`text-lg font-bold ${stats.avg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {stats.avg >= 0 ? '+' : ''}${stats.avg.toFixed(0)}
          </div>
        </div>
        <div className="p-3 bg-[#1a1a25] rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('MonthlyReturnsHeatmap.k2')}</div>
          <div className="text-lg font-bold text-emerald-400">{stats.positiveMonths}</div>
        </div>
        <div className="p-3 bg-[#1a1a25] rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('MonthlyReturnsHeatmap.k3')}</div>
          <div className="text-lg font-bold text-red-400">{stats.negativeMonths}</div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-6 gap-2">
        {monthlyData.map((m) => {
          const intensity = Math.min(Math.abs(m.pnl) / Math.max(stats.max, 1), 1);
          const color =
          m.pnl >= 0 ?
          `rgba(34, 197, 94, ${0.1 + intensity * 0.5})` :
          `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`;
          const textColor = m.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';

          return (
            <div
              key={m.month}
              className="p-3 rounded-lg border border-white/5"
              style={{ backgroundColor: color }}>
              
              <div className="text-xs text-gray-400 mb-1">{m.month}</div>
              <div className={`text-sm font-bold ${textColor}`}>
                {m.pnl >= 0 ? '+' : ''}${m.pnl.toFixed(0)}
              </div>
            </div>);

        })}
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">{i18n.t("MonthlyReturnsHeatmap.r92_ed5d")}
        {monthlyData.length}{i18n.t("MonthlyReturnsHeatmap.r92_d41c")}{stats.positiveMonths}{i18n.t("MonthlyReturnsHeatmap.r92_f577")}{stats.negativeMonths}{i18n.t("MonthlyReturnsHeatmap.r92_4d3f")}{(stats.positiveMonths / monthlyData.length * 100).toFixed(1)}%
      </div>
    </div>);

}