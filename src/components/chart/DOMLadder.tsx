// ── R117 QTE-49 DOM Ladder — 订单簿深度阶梯 (DOM面板) ──────────────────
// PM: Depth of Market ladder, bid/ask level-by-level view, position display

import { useState } from 'react';

// ═══════════ Types ═══════════

export interface DOMLevel {
  price: number;
  bidSize: number;
  askSize: number;
  bidOrders: number;
  askOrders: number;
  totalBid: number;
  totalAsk: number;
  imbalance: number; // -1 to 1, positive=bid dominant
}

export interface DOMSnapshot {
  symbol: string;
  levels: DOMLevel[];
  bestBid: number;
  bestAsk: number;
  spread: number;
  lastPrice: number;
  lastSize: number;
  timestamp: number;
  bidTotal: number;
  askTotal: number;
}

export interface DOMLadderProps {
  data: DOMSnapshot | null;
  depth?: number; // levels per side
  highlightLevels?: number[]; // price levels to highlight
  className?: string;
}

// ═══════════ Component ═══════════

export default function DOMLadder({ data, depth = 15, highlightLevels, className = '' }: DOMLadderProps) {
  const [_autoCenter, _setAutoCenter] = useState(true);

  if (!data) {
    return (
      <div className={`flex items-center justify-center bg-[#0d1117] rounded-lg border border-[#30363d] p-4 ${className}`}>
        <span className="text-[#484f58] text-xs font-mono">等待 DOM 数据...</span>
      </div>
    );
  }

  const maxBid = Math.max(...data.levels.map(l => l.totalBid), 1);
  const maxAsk = Math.max(...data.levels.map(l => l.totalAsk), 1);
  const maxTotal = Math.max(maxBid, maxAsk);

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1c2333]">
        <span className="text-[#8b949e] text-[10px] font-semibold tracking-wide">DOM 深度</span>
        <div className="flex items-center gap-2 text-[9px]">
          <span className="text-[#c9a96e] font-bold">{data.symbol}</span>
          <span className="text-[#484f58]">{data.lastPrice.toFixed(4)}</span>
        </div>
      </div>

      {/* Price ladder */}
      <div className="flex-1 overflow-y-auto">
        {data.levels.slice(-depth * 2).reverse().map((level, _i) => {
          const isHighlighted = highlightLevels?.includes(level.price);
          const isSpreadBoundary = level.price >= data.bestBid && level.price <= data.bestAsk;

          // Skip empty levels in the middle
          if (level.bidSize === 0 && level.askSize === 0 && !isSpreadBoundary) return null;

          return (
            <div key={level.price}
              className={`flex items-stretch text-[9px] border-b border-[#1c2333] hover:bg-[#161b22] transition-colors ${isHighlighted ? 'bg-[#c9a96e10]' : ''}`}
              style={{ height: 18 }}>

              {/* Bid bar */}
              <div className="w-[40%] relative flex items-center justify-end pr-1">
                <div className="absolute right-0 top-0 h-full bg-[#22c55e15]" style={{ width: `${(level.totalBid / maxTotal) * 100}%` }} />
                <span className="relative z-10 text-[#22c55e] text-[8px] font-bold">
                  {level.bidSize > 0 ? level.bidSize.toFixed(4) : ''}
                </span>
              </div>

              {/* Price */}
              <div className={`w-[20%] flex items-center justify-center text-[8px] font-bold relative
                ${level.price >= data.lastPrice ? 'text-[#22c55e]' : 'text-[#ef4444]'}
                ${isSpreadBoundary ? 'bg-[#c9a96e08]' : ''}`}
              >
                {level.price.toFixed(4)}
                {/* Spread highlight */}
                {isSpreadBoundary && !(level.price >= data.bestBid && level.price <= data.bestAsk) === false && (
                  <div className="absolute inset-0 border border-[#c9a96e20]" />
                )}
              </div>

              {/* Ask bar */}
              <div className="w-[40%] relative flex items-center pl-1">
                <div className="absolute left-0 top-0 h-full bg-[#ef444415]" style={{ width: `${(level.totalAsk / maxTotal) * 100}%` }} />
                <span className="relative z-10 text-[#ef4444] text-[8px] font-bold">
                  {level.askSize > 0 ? level.askSize.toFixed(4) : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="flex border-t border-[#1c2333] text-[8px]">
        <div className="flex-1 px-2 py-1 text-center text-[#22c55e]">
          Bid {data.bidTotal.toFixed(2)}
        </div>
        <div className="flex-1 px-2 py-1 text-center text-[#c9a96e]">
          {data.spread.toFixed(4)}
        </div>
        <div className="flex-1 px-2 py-1 text-center text-[#ef4444]">
          Ask {data.askTotal.toFixed(2)}
        </div>
      </div>
    </div>
  );
}