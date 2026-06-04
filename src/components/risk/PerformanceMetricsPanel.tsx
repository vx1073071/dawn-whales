// ── DAWN WHALES — PerformanceMetricsPanel (绩效指标面板) ───────────────────

import { useMemo } from 'react';

export interface TradeRecord {
  pnl: number;
  timestamp: number;
}

interface PerformanceMetricsPanelProps {
  trades: TradeRecord[];
  title?: string;
}

export default function PerformanceMetricsPanel({
  trades,
  title = '📊 交易绩效指标',
}: PerformanceMetricsPanelProps) {
  const metrics = useMemo(() => {
    if (!trades || trades.length === 0) return null;

    const pnls = trades.map((t) => t.pnl);
    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p <= 0);

    const totalTrades = pnls.length;
    const winCount = wins.length;
    const lossCount = losses.length;
    const winRate = totalTrades > 0 ? winCount / totalTrades : 0;

    const grossProfit = wins.reduce((s, p) => s + p, 0);
    const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const avgWin = winCount > 0 ? grossProfit / winCount : 0;
    const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;
    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

    const totalPnl = pnls.reduce((s, p) => s + p, 0);
    const mean = totalPnl / totalTrades;
    const variance = pnls.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / totalTrades;
    const stdDev = Math.sqrt(variance);

    // Sharpe (assuming risk-free rate ~2% annually, daily ~0.008%)
    const riskFreeDaily = 0.00008;
    const sharpe = stdDev > 0 ? (mean - riskFreeDaily) / stdDev : 0;

    // Sortino (downside deviation only)
    const downsidePnls = losses.map((p) => Math.pow(p - mean, 2));
    const downsideDev = downsidePnls.length > 0 ? Math.sqrt(downsidePnls.reduce((s, p) => s + p, 0) / totalTrades) : 0;
    const sortino = downsideDev > 0 ? (mean - riskFreeDaily) / downsideDev : 0;

    // Max consecutive wins/losses
    let maxConsecWins = 0;
    let maxConsecLosses = 0;
    let currWins = 0;
    let currLosses = 0;
    pnls.forEach((p) => {
      if (p > 0) { currWins++; currLosses = 0; maxConsecWins = Math.max(maxConsecWins, currWins); }
      else { currLosses++; currWins = 0; maxConsecLosses = Math.max(maxConsecLosses, currLosses); }
    });

    // Expectancy
    const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

    return {
      totalTrades,
      winRate,
      profitFactor,
      payoffRatio,
      sharpe,
      sortino,
      avgWin,
      avgLoss,
      totalPnl,
      stdDev,
      maxConsecWins,
      maxConsecLosses,
      expectancy,
    };
  }, [trades]);

  if (!metrics) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">{title}</h2>
        <p className="text-gray-500 text-sm text-center py-4">暂无交易记录</p>
      </div>
    );
  }

  const m = metrics;

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">{title}</h2>
        <span className="text-gray-500 text-[10px]">基于 {m.totalTrades} 笔交易</span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="胜率"
          value={`${(m.winRate * 100).toFixed(1)}%`}
          color={m.winRate >= 0.5 ? 'text-emerald-400' : 'text-[#D4A853]'}
          bg={m.winRate >= 0.5 ? 'bg-emerald-500/10' : 'bg-[#D4A853]/10'}
        />
        <MetricCard
          label="盈亏比"
          value={m.payoffRatio === Infinity ? '∞' : m.payoffRatio.toFixed(2)}
          color={m.payoffRatio >= 1.5 ? 'text-emerald-400' : 'text-[#D4A853]'}
          bg={m.payoffRatio >= 1.5 ? 'bg-emerald-500/10' : 'bg-[#D4A853]/10'}
        />
        <MetricCard
          label="Profit Factor"
          value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)}
          color={m.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-[#D4A853]'}
          bg={m.profitFactor >= 1.5 ? 'bg-emerald-500/10' : 'bg-[#D4A853]/10'}
        />
        <MetricCard
          label="总盈亏"
          value={`${m.totalPnl >= 0 ? '+' : ''}$${m.totalPnl.toFixed(0)}`}
          color={m.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
          bg={m.totalPnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
        />
        <MetricCard
          label="夏普比率"
          value={m.sharpe.toFixed(2)}
          color={m.sharpe >= 1 ? 'text-emerald-400' : m.sharpe >= 0 ? 'text-[#D4A853]' : 'text-red-400'}
          bg={m.sharpe >= 1 ? 'bg-emerald-500/10' : 'bg-[#D4A853]/10'}
        />
        <MetricCard
          label="索提诺比率"
          value={m.sortino.toFixed(2)}
          color={m.sortino >= 1 ? 'text-emerald-400' : m.sortino >= 0 ? 'text-[#D4A853]' : 'text-red-400'}
          bg={m.sortino >= 1 ? 'bg-emerald-500/10' : 'bg-[#D4A853]/10'}
        />
        <MetricCard
          label="期望收益"
          value={`$${m.expectancy.toFixed(1)}`}
          color={m.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400'}
          bg={m.expectancy >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
        />
        <MetricCard
          label="最大连赢/连亏"
          value={`${m.maxConsecWins}/${m.maxConsecLosses}`}
          color="text-gray-300"
          bg="bg-gray-500/10"
        />
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-4 text-[10px] text-gray-500">
        <span>平均盈利 <span className="text-emerald-400 font-mono">+${m.avgWin.toFixed(0)}</span></span>
        <span>平均亏损 <span className="text-red-400 font-mono">-${m.avgLoss.toFixed(0)}</span></span>
        <span>波动率(σ) <span className="text-gray-300 font-mono">${m.stdDev.toFixed(0)}</span></span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, bg }: {
  label: string; value: string; color: string; bg?: string;
}) {
  return (
    <div className={`bg-[#12121a] rounded-lg p-3 ${bg || ''}`}>
      <div className="text-gray-500 text-[10px] mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}
