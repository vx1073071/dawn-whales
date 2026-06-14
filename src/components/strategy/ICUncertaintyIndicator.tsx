/**
* ICUncertaintyIndicator — ML R177 H3 [P0] IC不确定性指示
* Shows IC value with confidence interval (e.g. 0.15±0.03)
* Error bar on IC bar chart + grey semi-transparent interval
*/
import { useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface ICWithUncertainty {
  factorId: string;
  nameZh: string;
  ic: number;
  icStdError: number;     // standard error of IC
  ciLow: number;           // 95% CI lower bound
  ciHigh: number;          // 95% CI upper bound
  sampleSize: number;      // number of observations
  isSignificant: boolean;  // CI doesn't cross zero
}

interface ICUncertaintyIndicatorProps {
  entries: ICWithUncertainty[];
  maxIC?: number;
  onSelectFactor?: (factorId: string) => void;
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

export const MOCK_IC_UNCERTAINTY: ICWithUncertainty[] = [
  { factorId: 'market_beta', nameZh: '市场Beta', ic: 0.055, icStdError: 0.012, ciLow: 0.031, ciHigh: 0.079, sampleSize: 252, isSignificant: true },
  { factorId: 'momentum_12m', nameZh: '12月动量', ic: 0.045, icStdError: 0.010, ciLow: 0.025, ciHigh: 0.065, sampleSize: 252, isSignificant: true },
  { factorId: 'quality_roe', nameZh: 'ROE质量', ic: 0.042, icStdError: 0.011, ciLow: 0.020, ciHigh: 0.064, sampleSize: 252, isSignificant: true },
  { factorId: 'value_ep', nameZh: '盈利收益率', ic: 0.038, icStdError: 0.015, ciLow: 0.008, ciHigh: 0.068, sampleSize: 252, isSignificant: true },
  { factorId: 'low_vol', nameZh: '低波动', ic: 0.031, icStdError: 0.018, ciLow: -0.005, ciHigh: 0.067, sampleSize: 252, isSignificant: false },
  { factorId: 'size_small', nameZh: '小市值', ic: 0.028, icStdError: 0.020, ciLow: -0.012, ciHigh: 0.068, sampleSize: 252, isSignificant: false },
  { factorId: 'reversal_short', nameZh: '短期反转', ic: 0.035, icStdError: 0.016, ciLow: 0.003, ciHigh: 0.067, sampleSize: 200, isSignificant: true },
  { factorId: 'liquidity', nameZh: '流动性', ic: 0.025, icStdError: 0.022, ciLow: -0.019, ciHigh: 0.069, sampleSize: 200, isSignificant: false },
];

// ── Main Component ─────────────────────────────────────────────────────

export default function ICUncertaintyIndicator({
  entries: propEntries,
  maxIC = 0.08,
  onSelectFactor,
  className = '',
}: ICUncertaintyIndicatorProps) {
  const entries = propEntries.length > 0 ? propEntries : MOCK_IC_UNCERTAINTY;

  const sorted = useMemo(() => [...entries].sort((a, b) => b.ic - a.ic), [entries]);

  return (
    <div className={`bg-[#0D0D14] p-4 rounded-lg border border-white/5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">📊 IC 不确定性分析</h3>
        <span className="text-[10px] text-gray-500">95% 置信区间 · n≥200</span>
      </div>

      {/* IC bar chart with error bars */}
      <div className="space-y-3">
        {sorted.map((entry) => {
          const barWidth = Math.min((Math.abs(entry.ic) / maxIC) * 100, 100);
          const ciLowWidth = Math.min((Math.abs(entry.ciLow) / maxIC) * 100, 100);
          const ciHighWidth = Math.min((Math.abs(entry.ciHigh) / maxIC) * 100, 100);

          return (
            <div
              key={entry.factorId}
              onClick={() => onSelectFactor?.(entry.factorId)}
              className="cursor-pointer group"
            >
              {/* Label row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">{entry.nameZh}</span>
                  {entry.isSignificant ? (
                    <span className="text-[9px] bg-green-500/10 text-green-400 px-1 py-0.5 rounded">显著</span>
                  ) : (
                    <span className="text-[9px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded">不显著</span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-gray-400">
                  {entry.ic >= 0 ? '+' : ''}{entry.ic.toFixed(3)} ± {entry.icStdError.toFixed(3)}
                </span>
              </div>

              {/* Bar with CI range */}
              <div className="relative h-5 bg-white/[0.03] rounded overflow-hidden">
                {/* CI range (grey band) */}
                <div
                  className="absolute top-1 bottom-1 rounded-sm bg-gray-500/20"
                  style={{
                    left: `${entry.ic >= 0 ? Math.min(ciLowWidth, barWidth * 1.5) : 0}%`,
                    right: `${entry.ic >= 0 ? 100 - Math.min(ciHighWidth, barWidth * 1.5) : 100 - barWidth}%`,
                    minWidth: 2,
                  }}
                />
                {/* IC bar */}
                <div
                  className={`absolute top-0 bottom-0 rounded transition-all ${
                    entry.isSignificant ? (entry.ic >= 0 ? 'bg-green-500/70' : 'bg-red-500/70') : 'bg-gray-500/50'
                  }`}
                  style={{ width: `${barWidth}%`, left: entry.ic >= 0 ? '50%' : `${50 - barWidth}%` }}
                />
                {/* Zero line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                {/* IC value on bar */}
                <span className="absolute left-1/2 top-1/2 -translate-y-1/2 translate-x-1 text-[9px] font-mono font-bold text-white drop-shadow">
                  {entry.ic >= 0 ? '+' : ''}{entry.ic.toFixed(3)}
                </span>
              </div>

              {/* CI text */}
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[8px] text-gray-500">
                  CI: [{entry.ciLow >= 0 ? '+' : ''}{entry.ciLow.toFixed(3)}, {entry.ciHigh >= 0 ? '+' : ''}{entry.ciHigh.toFixed(3)}]
                </span>
                <span className="text-[8px] text-gray-600">n={entry.sampleSize}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 pt-3 border-t border-white/5 text-[9px]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded bg-green-500/70" />
          <span className="text-gray-500">显著正IC</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded bg-red-500/70" />
          <span className="text-gray-500">显著负IC</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded bg-gray-500/20" />
          <span className="text-gray-500">95% CI区间</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-px h-2 bg-white/20" />
          <span className="text-gray-500">零线</span>
        </div>
      </div>
    </div>
  );
}
