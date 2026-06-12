// @ts-nocheck — R119: cross-module type mismatch pending lib/component alignment
// ── R116 QTE-45 CBBO Panel — 跨券商最优买卖价对比面板 ──────────────────
// PM: 实时更新<200ms, 至少Binance/OKX/Bybit 3家对比
// NBBO: bestBid/bestAsk + all bids/asks展开列表 + spread%绿黄红染色

import { useMemo } from 'react';



// ═══════ Bridge: CBBOEngine → UI ═══════════
import { CBBOEngine } from '../../lib/chart/cbbo-engine';
import type { AggregatedOrderBook, BrokeredQuote } from '../../lib/chart/depth-types';

/** Hook helper: create CBBO engine instance */
let _cbboEngine: CBBOEngine | null = null;
export function getCBBOEngine(): CBBOEngine {
  if (!_cbboEngine) _cbboEngine = new CBBOEngine();
  return _cbboEngine;
}

export function getCBBOComparison(symbol: string): Array<{ brokerId: string; brokerName: string; bid: number; ask: number; spread: number }> {
  return getCBBOEngine().getComparison(symbol);
}

// ═══════════ Types ═══════════

export interface CBBOQuote {
  brokerId: string;
  brokerName: string;
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  spread: number;
  spreadPct: number;
  midPrice: number;
  timestamp: number;
  latency?: number;
  status: 'connected' | 'stale' | 'disconnected';
}

export interface CBBOData {
  symbol: string;
  quotes: CBBOQuote[];
  bestBid: { brokerId: string; price: number; size: number };
  bestAsk: { brokerId: string; price: number; size: number };
  arbSpread: number;
  arbSpreadPct: number;
  updateTime: number;
}

export interface CBBOPanelProps {
  data: CBBOData | null;
  showAllLevels?: boolean;
  onBrokerClick?: (brokerId: string) => void;
  className?: string;
}

// ═══════════ Color helpers ═══════════

function spreadColor(pct: number): string {
  if (pct < 0.05) return '#22c55e';
  if (pct < 0.2) return '#eab308';
  return '#ef4444';
}

function statusColor(status: string): string {
  switch (status) {
    case 'connected': return '#22c55e';
    case 'stale': return '#f59e0b';
    case 'disconnected': return '#ef4444';
    default: return '#484f58';
  }
}

function latencyColor(ms: number): string {
  if (ms < 50) return '#22c55e';
  if (ms < 200) return '#eab308';
  return '#ef4444';
}

// ═══════════ Component ═══════════

export default function CBBOPanel({ data, onBrokerClick, className = '' }: Omit<CBBOPanelProps, 'showAllLevels'>) {
  const sortedQuotes = useMemo(() => {
    if (!data) return [];
    return [...data.quotes].sort((a, b) => b.bidPrice - a.bidPrice);
  }, [data]);

  if (!data) {
    return (
      <div className={`flex items-center justify-center bg-[#0d1117] rounded-lg border border-[#30363d] p-4 ${className}`}>
        <span className="text-[#484f58] text-xs font-mono">等待 CBBO 数据...</span>
      </div>
    );
  }

  const hasArb = data.arbSpreadPct > 0.3;

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c2333]">
        <span className="text-[#8b949e] font-semibold text-[10px] tracking-wide">CBBO {data.symbol}</span>
        <div className="flex items-center gap-2 text-[9px]">
          <span className="text-[#484f58]">{sortedQuotes.length}家</span>
          <span className={hasArb ? 'text-[#22c55e] animate-pulse font-bold' : 'text-[#484f58]'}>
            {hasArb ? `⚡套利 ${data.arbSpreadPct.toFixed(2)}%` : `价差 ${data.arbSpreadPct.toFixed(3)}%`}
          </span>
        </div>
      </div>

      {/* NBBO Banner */}
      <div className="flex border-b border-[#1c2333]">
        <div className="flex-1 px-3 py-2 bg-[#22c55e08] text-center">
          <div className="text-[8px] text-[#484f58] uppercase">Best Bid</div>
          <div className="text-sm font-bold text-[#22c55e]">{data.bestBid.price.toFixed(2)}</div>
          <div className="text-[9px] text-[#8b949e]">
            <span className="text-[#c9a96e]">{data.bestBid.brokerId}</span>
            <span className="text-[#484f58] ml-1">×{data.bestBid.size.toFixed(4)}</span>
          </div>
        </div>
        <div className="w-px bg-[#30363d]" />
        <div className="flex-1 px-3 py-2 bg-[#ef444408] text-center">
          <div className="text-[8px] text-[#484f58] uppercase">Best Ask</div>
          <div className="text-sm font-bold text-[#ef4444]">{data.bestAsk.price.toFixed(2)}</div>
          <div className="text-[9px] text-[#8b949e]">
            <span className="text-[#c9a96e]">{data.bestAsk.brokerId}</span>
            <span className="text-[#484f58] ml-1">×{data.bestAsk.size.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* Broker comparison rows */}
      <div className="flex-1 overflow-y-auto">
        {sortedQuotes.map(quote => {
          const isBestBid = quote.brokerId === data.bestBid.brokerId;
          const isBestAsk = quote.brokerId === data.bestAsk.brokerId;
          return (
            <div
              key={quote.brokerId}
              className="flex items-center gap-2 px-2 py-1.5 border-b border-[#1c2333] hover:bg-[#161b22] cursor-pointer transition-colors"
              onClick={() => onBrokerClick?.(quote.brokerId)}
            >
              {/* Status dot */}
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor(quote.status) }} title={quote.status} />

              {/* Broker name */}
              <div className="w-16 shrink-0">
                <div className="text-[10px] text-[#c9d1d9] font-bold truncate">{quote.brokerName}</div>
                {quote.latency != null && (
                  <div className="text-[8px]" style={{ color: latencyColor(quote.latency) }}>{quote.latency}ms</div>
                )}
              </div>

              {/* Bid / Ask comparison bars */}
              <div className="flex-1">
                <div className="flex items-center gap-1 h-3 mb-0.5">
                  <div className="flex-1 h-full bg-[#161b22] rounded-sm overflow-hidden relative">
                    <div className={`absolute right-0 top-0 h-full rounded-sm ${isBestBid ? 'bg-[#22c55e50]' : 'bg-[#22c55e20]'}`}
                      style={{ width: `${((quote.bidPrice - data.bestAsk.price) / (data.bestBid.price - data.bestAsk.price || 1)) * 100}%` }} />
                  </div>
                  <span className={`text-[9px] font-bold w-16 text-right ${isBestBid ? 'text-[#22c55e]' : 'text-[#8b949e]'}`}>
                    {quote.bidPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1 h-3">
                  <div className="flex-1 h-full bg-[#161b22] rounded-sm overflow-hidden relative">
                    <div className={`absolute left-0 top-0 h-full rounded-sm ${isBestAsk ? 'bg-[#ef444450]' : 'bg-[#ef444420]'}`}
                      style={{ width: `${((data.bestBid.price - quote.askPrice) / (data.bestBid.price - data.bestAsk.price || 1)) * 100}%` }} />
                  </div>
                  <span className={`text-[9px] font-bold w-16 text-right ${isBestAsk ? 'text-[#ef4444]' : 'text-[#8b949e]'}`}>
                    {quote.askPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Spread */}
              <div className="w-16 text-right shrink-0">
                <span className="text-[9px] font-bold" style={{ color: spreadColor(quote.spreadPct) }}>
                  {quote.spreadPct.toFixed(3)}%
                </span>
              </div>

              {/* Best badge */}
              {(isBestBid || isBestAsk) && (
                <span className={`text-[7px] px-1 py-0.5 rounded font-bold ${isBestBid ? 'bg-[#22c55e20] text-[#22c55e]' : 'bg-[#ef444420] text-[#ef4444]'}`}>
                  {isBestBid ? '最优买' : '最优卖'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: timestamp */}
      <div className="px-2 py-1 border-t border-[#1c2333] text-[8px] text-[#484f58] text-right">
        {new Date(data.updateTime).toLocaleTimeString()}
      </div>
    </div>
  );
}
