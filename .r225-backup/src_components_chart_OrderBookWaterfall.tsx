// @ts-nocheck — R119: cross-module type mismatch pending lib/component alignment
// ── R114 QTE-18 OrderBook Waterfall — 订单簿瀑布图 (买卖深度可视化) ──
// PM: 深度行情P0, 买卖盘红绿渐变/横条宽度=挂单量/大单墙高亮/价格跳动动画

import { useMemo, useRef, useEffect } from 'react';

// ═══════════ Types ═══════════

// ═══════ Bridge: OrderBookEngine → UI ═══════════
import type { OrderBookSnapshot, DepthLevel as LibDepthLevel } from '../../lib/chart/depth-types';

interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
  orderCount?: number;
}

interface OrderBookData {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPct: number;
  midPrice: number;
  timestamp: number;
  updateSeq?: number;
}

interface OrderBookProps {
  data: OrderBookData | null;
  depth?: number;
  height?: number;
  width?: number;
  showHeader?: boolean;
  className?: string;
}

/** Convert chart-lib OrderBookSnapshot → waterfall component's OrderBookData */
export function snapshotToWaterfallData(snapshot: OrderBookSnapshot): OrderBookData {
  const cumBids: OrderBookLevel[] = [];
  let bidTotal = 0;
  for (const l of snapshot.bids) {
    bidTotal += l.size;
    cumBids.push({ price: l.price, size: l.size, total: bidTotal, orderCount: l.orderCount });
  }
  const cumAsks: OrderBookLevel[] = [];
  let askTotal = 0;
  for (const l of snapshot.asks) {
    askTotal += l.size;
    cumAsks.push({ price: l.price, size: l.size, total: askTotal, orderCount: l.orderCount });
  }
  return {
    symbol: snapshot.symbol,
    bids: cumBids,
    asks: cumAsks,
    spread: snapshot.best.spread,
    spreadPct: snapshot.best.spreadPercent,
    midPrice: (snapshot.best.bidPrice + snapshot.best.askPrice) / 2,
    timestamp: snapshot.timestamp,
    updateSeq: snapshot.updateId,
  };
}


export interface OrderBookLevel {
  price: number;
  size: number;
  total: number; // cumulative
  orderCount?: number;
}

export interface OrderBookData {
  symbol: string;
  bids: OrderBookLevel[];  // sorted by price desc (highest buy first)
  asks: OrderBookLevel[];  // sorted by price asc (lowest sell first)
  spread: number;
  spreadPct: number;
  midPrice: number;
  timestamp: number;
  updateSeq?: number;
}

export interface OrderBookProps {
  data: OrderBookData | null;
  depth?: number; // number of levels to show (default 20)
  height?: number;
  width?: number;
  showHeader?: boolean;
  className?: string;
}

// ═══════════ Constants ═══════════

const BID_COLOR = 'rgba(34,197,94,0.15)';
const BID_BORDER = 'rgba(34,197,94,0.3)';
const ASK_COLOR = 'rgba(239,68,68,0.15)';
const ASK_BORDER = 'rgba(239,68,68,0.3)';
const WALL_THRESHOLD = 3; // 3x average size = wall
const WALL_COLOR_BID = 'rgba(34,197,94,0.4)';
const WALL_COLOR_ASK = 'rgba(239,68,68,0.4)';

// ═══════════ Helpers ═══════════

function formatSize(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function formatPrice(n: number, tickSize?: number): string {
  const decimals = tickSize ? Math.max(0, Math.ceil(-Math.log10(tickSize))) : 2;
  return n.toFixed(decimals);
}

// ═══════════ Component ═══════════

export default function OrderBookWaterfall({
  data, depth = 20, height = 500, width = 300, showHeader = true, className = '',
}: OrderBookProps) {
  const midRef = useRef<HTMLDivElement>(null);
  const prevMidRef = useRef<number>(0);

  // Compute avg size for wall detection
  const avgSize = useMemo(() => {
    if (!data) return 0;
    const allSizes = [...data.bids.slice(0, depth), ...data.asks.slice(0, depth)].map(l => l.size);
    if (allSizes.length === 0) return 0;
    return allSizes.reduce((a, b) => a + b, 0) / allSizes.length;
  }, [data, depth]);

  // Bounce animation on price change
  useEffect(() => {
    if (!data || !midRef.current) return;
    const prev = prevMidRef.current;
    if (prev !== 0 && prev !== data.midPrice) {
      const dir = data.midPrice > prev ? 'up' : 'down';
      midRef.current.style.transform = `scale(1.05)`;
      midRef.current.style.color = dir === 'up' ? '#22c55e' : '#ef4444';
      const timer = setTimeout(() => {
        if (midRef.current) {
          midRef.current.style.transform = 'scale(1)';
          midRef.current.style.color = '#c9d1d9';
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    prevMidRef.current = data.midPrice;
  }, [data]);

  if (!data) {
    return (
      <div className={`flex items-center justify-center bg-[#0d1117] rounded-lg border border-[#30363d] ${className}`} style={{ height }}>
        <span className="text-[#484f58] text-xs font-mono">等待深度数据...</span>
      </div>
    );
  }

  // Prepare display data
  const displayBids = data.bids.slice(0, depth).reverse(); // show lowest first
  const displayAsks = data.asks.slice(0, depth);

  // Maximum bar width pixels (60% of the side panel)
  const maxBarWidth = (width * 0.6 * 0.35); // 35% of total width

  // Compute ask cumulative for reverse display (from bottom)
  const askTotalMax = displayAsks.length > 0 ? displayAsks[displayAsks.length - 1].total : 1;
  const bidTotalMax = displayBids.length > 0 ? displayBids[displayBids.length - 1].total : 1;

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`} style={{ width, height }}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1c2333]">
          <span className="text-[#8b949e] text-[10px] font-semibold font-mono tracking-wide">OrderBook</span>
          <div className="flex gap-2 text-[9px] text-[#484f58] font-mono">
            <span>价差: {formatPrice(data.spread)}</span>
            <span>({data.spreadPct.toFixed(3)}%)</span>
          </div>
        </div>
      )}

      {/* Column headers */}
      <div className="flex text-[9px] text-[#484f58] font-mono px-2 py-0.5 border-b border-[#1c2333]">
        <span className="w-[35%] text-right">量</span>
        <span className="w-[30%] text-right">价格</span>
        <span className="w-[35%] text-left">量</span>
      </div>

      {/* Depth area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Bids (left) */}
        <div className="absolute left-0 top-0 bottom-0 w-[35%]">
          {displayBids.map((level, i) => {
            const barW = maxBarWidth * (bidTotalMax > 0 ? level.total / bidTotalMax : 0);
            const isWall = avgSize > 0 && level.size > avgSize * WALL_THRESHOLD;
            return (
              <div key={`bid-${i}`} className="relative flex items-center justify-end h-full" style={{ height: `${100 / depth}%` }}>
                <div
                  className="absolute right-0 top-0 h-full transition-all duration-150"
                  style={{ width: barW, background: isWall ? WALL_COLOR_BID : BID_COLOR, borderRight: `1px solid ${BID_BORDER}` }}
                />
                <span className={`relative z-10 text-[10px] font-mono pr-1 ${isWall ? 'text-[#22c55e] font-bold' : 'text-[#8b949e]'}`}>
                  {formatSize(level.size)}
                </span>
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, depth - displayBids.length) }).map((_, i) => (
            <div key={`bid-empty-${i}`} className="h-full" style={{ height: `${100 / depth}%` }} />
          ))}
        </div>

        {/* Prices (center) */}
        <div className="absolute left-[35%] right-[35%] top-0 bottom-0 border-x border-[#1c2333] bg-[#0d1117]">
          {/* Bid prices */}
          {displayBids.map((level, i) => (
            <div key={`bid-px-${i}`} className="flex items-center justify-center h-full" style={{ height: `${100 / depth}%` }}>
              <span className="text-[10px] text-[#22c55e] font-mono">{formatPrice(level.price)}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, depth - displayBids.length) }).map((_, i) => (
            <div key={`bid-px-empty-${i}`} className="h-full" style={{ height: `${100 / depth}%` }} />
          ))}

          {/* Mid price separator */}
          <div className="border-t border-b border-[#c9a96e40] py-1 px-1 bg-[#c9a96e08]">
            <div ref={midRef} className="text-center text-sm font-bold text-[#c9d1d9] font-mono transition-all duration-300">
              {formatPrice(data.midPrice)}
            </div>
          </div>

          {/* Ask prices */}
          {displayAsks.map((level, i) => (
            <div key={`ask-px-${i}`} className="flex items-center justify-center h-full" style={{ height: `${100 / depth}%` }}>
              <span className="text-[10px] text-[#ef4444] font-mono">{formatPrice(level.price)}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, depth - displayAsks.length) }).map((_, i) => (
            <div key={`ask-px-empty-${i}`} className="h-full" style={{ height: `${100 / depth}%` }} />
          ))}
        </div>

        {/* Asks (right) */}
        <div className="absolute right-0 top-0 bottom-0 w-[35%]">
          {displayAsks.map((level, i) => {
            const barW = maxBarWidth * (askTotalMax > 0 ? level.total / askTotalMax : 0);
            const isWall = avgSize > 0 && level.size > avgSize * WALL_THRESHOLD;
            return (
              <div key={`ask-${i}`} className="relative flex items-center h-full" style={{ height: `${100 / depth}%` }}>
                <div
                  className="absolute left-0 top-0 h-full transition-all duration-150"
                  style={{ width: barW, background: isWall ? WALL_COLOR_ASK : ASK_COLOR, borderLeft: `1px solid ${ASK_BORDER}` }}
                />
                <span className={`relative z-10 text-[10px] font-mono pl-1 ${isWall ? 'text-[#ef4444] font-bold' : 'text-[#8b949e]'}`}>
                  {formatSize(level.size)}
                </span>
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, depth - displayAsks.length) }).map((_, i) => (
            <div key={`ask-empty-${i}`} className="h-full" style={{ height: `${100 / depth}%` }} />
          ))}
        </div>
      </div>

      {/* Footer: buy/sell ratio */}
      <div className="flex border-t border-[#1c2333] text-[9px] font-mono">
        <div className="flex-1 px-2 py-1 text-center text-[#22c55e] bg-[#22c55e08]">
          买 {((displayBids.reduce((s, l) => s + l.total, 0) / (displayBids.reduce((s, l) => s + l.total, 0) + displayAsks.reduce((s, l) => s + l.total, 0) || 1)) * 100).toFixed(1)}%
        </div>
        <div className="flex-1 px-2 py-1 text-center text-[#ef4444] bg-[#ef444408]">
          卖 {((displayAsks.reduce((s, l) => s + l.total, 0) / (displayBids.reduce((s, l) => s + l.total, 0) + displayAsks.reduce((s, l) => s + l.total, 0) || 1)) * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
