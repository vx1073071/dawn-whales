// ── R114 QTE-19 TickTimeline — 逐笔成交时间轴 UI ───────────────────────
// PM: 深度行情P0, 红买绿卖/成交量分布/大单弹窗提醒

import { useMemo, useRef, useEffect, useState } from 'react';

// ═══════════ Types ═══════════

export interface TickRecord {
  time: number;      // Unix ms
  price: number;
  size: number;
  side: 'buy' | 'sell';
  bidPrice?: number;
  askPrice?: number;
  sequence?: number;
}

export interface TickTimelineProps {
  ticks: TickRecord[];
  symbol?: string;
  autoScroll?: boolean;
  maxDisplay?: number; // max records on screen
  onHoverTick?: (tick: TickRecord | null) => void;
  className?: string;
}

// ═══════════ Constants ═══════════

const BUY_COLOR = '#22c55e';
const SELL_COLOR = '#ef4444';
const BIG_TRADE_THRESHOLD_SIGMA = 3; // > 3σ = big trade
const ROW_H = 16; // px per row

// ═══════════ Component ═══════════

export default function TickTimeline({
  ticks, symbol, autoScroll = true, maxDisplay = 200, onHoverTick, className = '',
}: TickTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Stats
  const stats = useMemo(() => {
    if (ticks.length === 0) return { avgSize: 0, stdSize: 0, totalVolume: 0, buyVol: 0, sellVol: 0, bigTrades: 0 };
    const sizes = ticks.map(t => t.size);
    const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((a, b) => a + (b - avg) ** 2, 0) / sizes.length;
    const std = Math.sqrt(variance);
    const bigThreshold = avg + BIG_TRADE_THRESHOLD_SIGMA * std;
    return {
      avgSize: avg,
      stdSize: std,
      totalVolume: ticks.reduce((s, t) => s + t.size, 0),
      buyVol: ticks.filter(t => t.side === 'buy').reduce((s, t) => s + t.size, 0),
      sellVol: ticks.filter(t => t.side === 'sell').reduce((s, t) => s + t.size, 0),
      bigTrades: ticks.filter(t => t.size > bigThreshold).length,
      bigThreshold,
    };
  }, [ticks]);

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll || paused || !containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [ticks, autoScroll, paused]);

  // Format helpers
  const formatSize = (n: number): string => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(6);
  };

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  const isBigTrade = (size: number) => (stats?.bigThreshold ?? Number.MAX_SAFE_INTEGER) > 0 && size > (stats?.bigThreshold ?? Number.MAX_SAFE_INTEGER);

  const visible = ticks.slice(-maxDisplay);

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1c2333]">
        <span className="text-[#8b949e] text-[10px] font-semibold font-mono tracking-wide">
          逐笔成交 Tick {symbol ? `· ${symbol}` : ''}
        </span>
        <div className="flex items-center gap-2 text-[9px] font-mono">
          <span className="text-[#484f58]">{ticks.length}笔</span>
          {stats.bigTrades > 0 && (
            <span className="text-[#f59e0b]">大单 {stats.bigTrades}</span>
          )}
          <button
            onClick={() => setPaused(!paused)}
            className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${paused ? 'bg-[#c9a96e20] text-[#c9a96e]' : 'text-[#484f58] hover:text-[#8b949e]'}`}
          >
            {paused ? '⏸ 暂停' : '▶ 实时'}
          </button>
        </div>
      </div>

      {/* Tick rows */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onScroll={() => setHoveredIdx(null)}
      >
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#484f58] text-xs font-mono">
            等待逐笔数据...
          </div>
        ) : (
          visible.map((tick, i) => {
            const big = isBigTrade(tick.size);
            const isHovered = hoveredIdx === i;
            return (
              <div
                key={`${tick.time}-${tick.sequence ?? i}`}
                onMouseEnter={() => { setHoveredIdx(i); onHoverTick?.(tick); }}
                onMouseLeave={() => { setHoveredIdx(null); onHoverTick?.(null); }}
                className={`flex items-center gap-2 px-2 font-mono transition-colors ${
                  isHovered ? 'bg-[#1c2333]' : ''
                } ${big ? 'bg-[#f59e0b10]' : ''}`}
                style={{ height: ROW_H, fontSize: 10 }}
              >
                {/* Time */}
                <span className="w-[80px] text-[#484f58] text-[9px] shrink-0">{formatTime(tick.time)}</span>

                {/* Side indicator */}
                <span
                  className={`w-[24px] text-center font-bold shrink-0 ${tick.side === 'buy' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
                >
                  {tick.side === 'buy' ? 'B' : 'S'}
                </span>

                {/* Price */}
                <span className={`w-[70px] text-right shrink-0 ${tick.side === 'buy' ? 'text-[#22c55e]' : 'text-[#ef4444]'} ${big ? 'font-bold' : ''}`}>
                  {tick.price.toFixed(2)}
                </span>

                {/* Size */}
                <span className="w-[50px] text-right text-[#8b949e] shrink-0">
                  {formatSize(tick.size)}
                </span>

                {/* Size bar */}
                <div className="flex-1 h-3 relative">
                  <div
                    className="absolute top-0 h-full rounded-sm opacity-40"
                    style={{
                      width: `${Math.min(100, (tick.size / (stats.avgSize * 3 || 1)) * 100)}%`,
                      backgroundColor: tick.side === 'buy' ? BUY_COLOR : SELL_COLOR,
                    }}
                  />
                </div>

                {/* Big trade badge */}
                {big && <span className="text-[9px] text-[#f59e0b] font-bold animate-pulse">大单</span>}

                {/* Sequence */}
                {tick.sequence != null && isHovered && (
                  <span className="text-[8px] text-[#484f58] shrink-0">#{tick.sequence}</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      <div className="flex border-t border-[#1c2333] text-[9px] font-mono">
        <div className="flex-1 px-2 py-1 text-center text-[#22c55e] bg-[#22c55e08]">
          主动买 {stats.buyVol > 0 ? (stats.buyVol / stats.totalVolume * 100).toFixed(1) : '0'}%
        </div>
        <div className="flex-1 px-2 py-1 text-center text-[#ef4444] bg-[#ef444408]">
          主动卖 {stats.sellVol > 0 ? (stats.sellVol / stats.totalVolume * 100).toFixed(1) : '0'}%
        </div>
        <div className="flex-1 px-2 py-1 text-center text-[#8b949e] bg-[#8b949e08]">
          VWAP {ticks.length > 0 ? (ticks.reduce((s, t) => s + t.price * t.size, 0) / stats.totalVolume).toFixed(2) : '-'}
        </div>
      </div>
    </div>
  );
}
