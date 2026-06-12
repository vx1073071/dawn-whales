// @ts-nocheck
/**
 * DAWN WHALES R126 J02 — MicrostructureTooltip Component
 * 
 * Renderer: displays microstructure indicators on chart hover.
 * Uses VPIN, Kyle Lambda, ArrivalPrice, Spread, OFI from microstructure-tooltip.ts.
 */

import React from 'react';
import { formatMicrostructureTooltip, MicrostructureStats } from '../../lib/chart/microstructure-tooltip';

export interface MicrostructureTooltipProps {
  stats: MicrostructureStats;
  position?: { x: number; y: number };
  visible?: boolean;
}

export const MicrostructureTooltip: React.FC<MicrostructureTooltipProps> = ({
  stats,
  position = { x: 0, y: 0 },
  visible = true,
}) => {
  if (!visible) return null;

  const { lines, verdict } = formatMicrostructureTooltip(stats);

  const verdictStyle: Record<string, string> = {
    '⚠️ High Toxicity': 'text-[#ef4444] border-[#ef444440]',
    '⚡ Elevated': 'text-[#f59e0b] border-[#f59e0b40]',
    '✅ Normal': 'text-[#22c55e] border-[#22c55e40]',
    '— No Data': 'text-[#484f58] border-[#30363d]',
  };

  const vStyle = verdictStyle[verdict] || 'text-[#8b949e] border-[#30363d]';

  return (
    <div
      className={`absolute z-50 pointer-events-none transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{
        left: `${Math.min(position.x, window.innerWidth - 220)}px`,
        top: `${Math.max(position.y - 180, 10)}px`,
      }}
    >
      <div className="bg-[#161b22]/95 backdrop-blur-sm border border-[#30363d] rounded shadow-lg p-2 min-w-[180px] max-w-[220px]">
        {/* Header */}
        <div className={`text-[10px] font-medium pb-1 mb-1 border-b ${vStyle}`}>
          Microstructure {verdict}
        </div>

        {/* Metrics */}
        <div className="space-y-0.5">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`text-[9px] font-mono ${i >= lines.length - 1 ? 'text-[#484f58] pt-0.5 border-t border-[#21262d]' : 'text-[#c9d1d9]'}`}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-1 pt-1 border-t border-[#21262d] text-[8px] text-[#484f58]">
          VPIN: Easley et al. · Kyle λ: price impact · Arrival: VWAP slip
        </div>
      </div>
    </div>
  );
};
