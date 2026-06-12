// ── R117 QTE-50 FootprintChart — 足迹图 (成交量分布+买卖方向) ──────────
// PM: Bid/Ask volume at each price level, delta imbalance, cumulative delta

import { useMemo } from 'react';

// ═══════════ Types ═══════════

export interface FootprintLevel {
  price: number;
  bidVol: number;
  askVol: number;
  delta: number; // bidVol - askVol
  totalVol: number;
  poc: boolean; // Point of Control (highest volume)
  vaHigh: boolean; // Value Area High
  vaLow: boolean; // Value Area Low
}

export interface FootprintData {
  symbol: string;
  levels: FootprintLevel[];
  totalBidVol: number;
  totalAskVol: number;
  cumulativeDelta: number;
  valueAreaPct: number; // default 70%
  tickSize: number;
  timestamp: number;
}

export interface FootprintChartProps {
  data: FootprintData | null;
  height?: number;
  showDelta?: boolean; // show delta bars
  className?: string;
}

// ═══════════ Value Area calculation ═══════════

function calcValueArea(levels: FootprintLevel[], pct = 70): { poc: number; vaHigh: number; vaLow: number } {
  const total = levels.reduce((s, l) => s + l.totalVol, 0);
  const threshold = total * (pct / 100);
  // Find POC
  let pocIdx = 0, maxVol = 0;
  levels.forEach((l, i) => { if (l.totalVol > maxVol) { maxVol = l.totalVol; pocIdx = i; } });
  // Expand from POC
  let lo = pocIdx, hi = pocIdx, cumVol = levels[pocIdx].totalVol;
  while (cumVol < threshold && (lo > 0 || hi < levels.length - 1)) {
    const loVol = lo > 0 ? levels[lo - 1].totalVol : 0;
    const hiVol = hi < levels.length - 1 ? levels[hi + 1].totalVol : 0;
    if (loVol >= hiVol) { lo--; cumVol += levels[lo].totalVol; }
    else { hi++; cumVol += levels[hi].totalVol; }
  }
  return { poc: pocIdx, vaHigh: hi, vaLow: lo };
}

// ═══════════ Component ═══════════

export default function FootprintChart({ data, height = 400, showDelta = true, className = '' }: FootprintChartProps) {
  const enriched = useMemo(() => {
    if (!data) return null;
    const { poc, vaHigh, vaLow } = calcValueArea(data.levels, data.valueAreaPct);
    return {
      ...data,
      levels: data.levels.map((l, i) => ({
        ...l,
        poc: i === poc,
        vaHigh: i === vaHigh,
        vaLow: i === vaLow,
      })),
    };
  }, [data]);

  if (!enriched) {
    return (
      <div className={`flex items-center justify-center bg-[#0d1117] rounded-lg border border-[#30363d] p-4 ${className}`}>
        <span className="text-[#484f58] text-xs font-mono">等待 Footprint 数据...</span>
      </div>
    );
  }

  const maxTotal = Math.max(...enriched.levels.map(l => l.totalVol), 1);
  const maxDelta = Math.max(...enriched.levels.map(l => Math.abs(l.delta)), 1);

  const barH = Math.min(12, (height - 40) / enriched.levels.length);

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1c2333]">
        <span className="text-[#8b949e] text-[10px] font-semibold tracking-wide">足迹图 {enriched.symbol}</span>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="text-[#484f58]">总买 {enriched.totalBidVol.toFixed(1)}</span>
          <span className="text-[#484f58]">总卖 {enriched.totalAskVol.toFixed(1)}</span>
          <span className={`font-bold ${enriched.cumulativeDelta >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            Δ {enriched.cumulativeDelta >= 0 ? '+' : ''}{enriched.cumulativeDelta.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Volume rows */}
      <div className="flex-1 overflow-y-auto">
        {enriched.levels.map((level, _i) => (
          <div key={level.price}
            className={`flex items-center gap-1 px-1 border-b border-[#1c2333] hover:bg-[#161b22] transition-colors
              ${level.poc ? 'bg-[#c9a96e08]' : ''}
              ${level.vaHigh ? 'border-t border-t-[#c9a96e30]' : ''}
              ${level.vaLow ? 'border-b border-b-[#c9a96e30]' : ''}`}
            style={{ height: barH }}>

            {/* Price */}
            <span className="w-16 text-[8px] text-[#8b949e] text-right shrink-0">{level.price.toFixed(4)}</span>

            {/* Bid volume bar */}
            <div className="flex-1 h-full flex items-center justify-end relative">
              <div className="absolute right-0 top-0 h-full bg-[#22c55e20]" style={{ width: `${(level.bidVol / maxTotal) * 100}%` }} />
              <span className="relative z-10 text-[7px] text-[#22c55e] pr-0.5">{level.bidVol > 0 ? level.bidVol.toFixed(1) : ''}</span>
            </div>

            {/* Total volume / POC indicator */}
            <div className="w-12 text-center shrink-0">
              <span className={`text-[7px] font-bold ${level.poc ? 'text-[#c9a96e]' : 'text-[#484f58]'}`}>
                {level.totalVol.toFixed(1)}{level.poc ? '★' : ''}
              </span>
            </div>

            {/* Ask volume bar */}
            <div className="flex-1 h-full flex items-center relative">
              <div className="absolute left-0 top-0 h-full bg-[#ef444420]" style={{ width: `${(level.askVol / maxTotal) * 100}%` }} />
              <span className="relative z-10 text-[7px] text-[#ef4444] pl-0.5">{level.askVol > 0 ? level.askVol.toFixed(1) : ''}</span>
            </div>

            {/* Delta bar */}
            {showDelta && (
              <div className="w-16 h-4 flex items-center shrink-0">
                <div className="flex-1 h-2 bg-[#161b22] rounded-sm overflow-hidden relative">
                  <div className={`absolute top-0 h-full rounded-sm ${level.delta >= 0 ? 'left-1/2 bg-[#22c55e50]' : 'right-1/2 bg-[#ef444450]'}`}
                    style={{ width: `${(Math.abs(level.delta) / maxDelta) * 50}%` }} />
                </div>
                <span className={`text-[7px] w-10 text-right ${level.delta >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {level.delta >= 0 ? '+' : ''}{level.delta.toFixed(0)}
                </span>
              </div>
            )}

            {/* Value area markers */}
            <div className="w-3 shrink-0">
              {level.vaHigh && <span className="text-[4px] text-[#c9a96e]">VAH</span>}
              {level.vaLow && <span className="text-[4px] text-[#c9a96e]">VAL</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 py-1 border-t border-[#1c2333] text-[7px] text-[#484f58]">
        <span>★ POC (最大成交量)</span>
        <span className="text-[#c9a96e]">━ Value Area (70%)</span>
        <span className="text-[#22c55e]">■ Bid</span>
        <span className="text-[#ef4444]">■ Ask</span>
        <span>Δ Delta</span>
      </div>
    </div>
  );
}
