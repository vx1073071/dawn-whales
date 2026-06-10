import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

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

interface TradeTimelineProps {
  trades: Trade[];
}

export default function TradeTimeline({ trades }: TradeTimelineProps) {
  const { t } = useTranslation();
  const timelineData = useMemo(() => {
    if (trades.length === 0) return [];

    return trades
      .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
      .map((trade, index) => ({
        ...trade,
        index: index + 1,
        duration: trade.holdingDays,
      }));
  }, [trades]);

  const stats = useMemo(() => {
    if (timelineData.length === 0) {
      return {
        totalTrades: 0,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        winTrades: 0,
        lossTrades: 0,
      };
    }

    const durations = timelineData.map((t) => t.duration);
    const winTrades = timelineData.filter((t) => t.pnl > 0).length;
    const lossTrades = timelineData.filter((t) => t.pnl < 0).length;

    return {
      totalTrades: timelineData.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      winTrades,
      lossTrades,
    };
  }, [timelineData]);

  if (timelineData.length === 0) {
    return (
      <div className="bg-[#12121a] rounded-xl border border-white/5 p-8 text-center text-gray-500">{t('noTradeRecords')}</div>
    );
  }

  return (
    <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
      <div className="text-sm font-medium text-white mb-3">{t('tradeTimeline')}</div>

      {/* Stats Summary */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <div className="p-3 bg-[#1a1a25] rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{t('totalTradesLabel')}</div>
          <div className="text-lg font-bold text-white">{stats.totalTrades}</div>
        </div>
        <div className="p-3 bg-[#1a1a25] rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">平均持仓</div>
          <div className="text-lg font-bold text-white">{stats.avgDuration.toFixed(1)}天</div>
        </div>
        <div className="p-3 bg-[#1a1a25] rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">最长持仓</div>
          <div className="text-lg font-bold text-white">{stats.maxDuration}天</div>
        </div>
        <div className="p-3 bg-[#1a1a25] rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{t("components.winTrades")}</div>
          <div className="text-lg font-bold text-emerald-400">{stats.winTrades}</div>
        </div>
        <div className="p-3 bg-[#1a1a25] rounded-lg border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{t("components.lossTrades")}</div>
          <div className="text-lg font-bold text-red-400">{stats.lossTrades}</div>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {timelineData.slice(0, 50).map((trade) => {
          const isWin = trade.pnl >= 0;
          const intensity = Math.min(Math.abs(trade.pnl) / 1000, 1);
          const bgColor = isWin
            ? `rgba(34, 197, 94, ${0.05 + intensity * 0.15})`
            : `rgba(239, 68, 68, ${0.05 + intensity * 0.15})`;

          return (
            <div
              key={trade.id}
              className="p-3 rounded-lg border border-white/5"
              style={{ backgroundColor: bgColor }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">#{trade.index}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      trade.side === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {trade.side}
                  </span>
                  <span className="text-sm text-gray-300">{trade.entryDate}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{trade.holdingDays}天</span>
                  <span className="text-gray-400">→</span>
                  <span>{trade.exitDate}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">入场: </span>
                    <span className="text-gray-300 font-mono">${trade.entryPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">出场: </span>
                    <span className="text-gray-300 font-mono">${trade.exitPrice.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-bold font-mono ${
                      isWin ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {isWin ? '+' : ''}${trade.pnl.toFixed(2)}
                  </span>
                  <span
                    className={`text-xs font-mono ${
                      isWin ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    ({trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {timelineData.length > 50 && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          显示前 50 笔交易，共 {timelineData.length} 笔
        </div>
      )}
    </div>
  );
}
