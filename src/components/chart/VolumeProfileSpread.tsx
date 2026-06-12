// ── R117 QTE-51 VolumeProfile + QTE-52 SpreadMonitor ─────────────────────

import { useMemo, useState } from 'react';

// ═══════════ QTE-51 Volume Profile Types ═══════════

export interface VPLevel {
  price: number;
  volume: number;
  buyVol: number;
  sellVol: number;
  trades: number;
}

export interface VolumeProfileData {
  symbol: string;
  levels: VPLevel[];
  poc: { price: number; volume: number };
  valueAreaHigh: number;
  valueAreaLow: number;
  totalVolume: number;
  timestamp: number;
}

export interface VolumeProfileProps {
  data: VolumeProfileData | null;
  height?: number;
  width?: number;
  showBuySell?: boolean;
  className?: string;
}

// ═══════════ QTE-52 Spread Monitor Types ═══════════

export interface SpreadItem {
  symbol: string;
  exchange: string;
  bidPx: number;
  askPx: number;
  spreadPct: number;
  spreadAbs: number;
  bidSize: number;
  askSize: number;
  volume24h: number;
  timestamp: number;
}

export interface SpreadMonitorProps {
  spreads: SpreadItem[];
  highlightThreshold?: number; // default 0.5%
  onSelect?: (s: SpreadItem) => void;
  className?: string;
}

// ═══════════ QTE-51 Volume Profile Component ═══════════

export function VolumeProfile({ data, height = 350, width = 180, showBuySell = true, className = '' }: VolumeProfileProps) {
  const maxVol = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.levels.map(l => l.volume), 1);
  }, [data]);

  if (!data) {
    return (
      <div className={`flex items-center justify-center bg-[#0d1117] rounded-lg border border-[#30363d] p-4 ${className}`}>
        <span className="text-[#484f58] text-xs font-mono">等待 Volume Profile...</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`} style={{ fontFamily: 'monospace' }}>
      <div className="px-2 py-1.5 border-b border-[#1c2333] text-[10px] text-[#8b949e] font-semibold tracking-wide">
        Volume Profile
      </div>
      <div className="flex-1 relative" style={{ height }}>
        {data.levels.map((level, i) => {
          const barW = (level.volume / maxVol) * width;
          const buyRatio = level.volume > 0 ? level.buyVol / level.volume : 0;
          return (
            <div key={level.price}
              className="flex items-center h-3 px-1 hover:bg-[#161b22] cursor-pointer"
              title={`P:${level.price.toFixed(4)} V:${level.volume.toFixed(1)} B:${((level.buyVol / (level.volume || 1)) * 100).toFixed(0)}%`}
            >
              {/* Price label */}
              <span className="w-14 text-[7px] text-[#8b949e] text-right shrink-0">{level.price.toFixed(4)}</span>

              {/* Volume bar */}
              <div className="flex-1 h-2 bg-[#161b22] rounded-sm overflow-hidden relative ml-1">
                {showBuySell ? (
                  <>
                    <div className="absolute left-0 top-0 h-full bg-[#22c55e40]" style={{ width: `${buyRatio * 100}%` }} />
                    <div className="absolute right-0 top-0 h-full bg-[#ef444440]" style={{ width: `${(1 - buyRatio) * 100}%` }} />
                  </>
                ) : (
                  <div className="absolute left-0 top-0 h-full bg-[#3b82f640]" style={{ width: `${(level.volume / maxVol) * 100}%` }} />
                )}
              </div>

              {/* Volume number */}
              <span className="w-12 text-[7px] text-[#484f58] text-right shrink-0">{level.volume.toFixed(1)}</span>
            </div>
          );
        })}
      </div>

      {/* POC + VA markers */}
      <div className="flex border-t border-[#1c2333] text-[8px]">
        <div className="flex-1 px-2 py-1 text-center text-[#c9a96e]">POC {data.poc.price.toFixed(4)}</div>
        <div className="flex-1 px-2 py-1 text-center text-[#484f58]">VA {data.valueAreaLow.toFixed(4)}-{data.valueAreaHigh.toFixed(4)}</div>
        <div className="flex-1 px-2 py-1 text-center text-[#484f58]">{data.totalVolume.toFixed(0)}</div>
      </div>
    </div>
  );
}

// ═══════════ QTE-52 Spread Monitor Component ═══════════

export function SpreadMonitor({ spreads, highlightThreshold = 0.5, onSelect, className = '' }: SpreadMonitorProps) {
  const [sortBy, setSortBy] = useState<'spread' | 'volume'>('spread');
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...spreads].sort((a, b) => {
      if (sortBy === 'spread') return b.spreadPct - a.spreadPct;
      return b.volume24h - a.volume24h;
    });
  }, [spreads, sortBy]);

  const highSpreads = useMemo(() => sorted.filter(s => s.spreadPct >= highlightThreshold), [sorted, highlightThreshold]);
  const maxSpread = Math.max(...sorted.map(s => s.spreadPct), 0.1);

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1c2333]">
        <span className="text-[#8b949e] text-[10px] font-semibold tracking-wide">价差监控</span>
        <div className="flex gap-0.5 text-[9px]">
          <button onClick={() => setSortBy('spread')}
            className={`px-1.5 py-0.5 rounded ${sortBy === 'spread' ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58]'}`}>价差</button>
          <button onClick={() => setSortBy('volume')}
            className={`px-1.5 py-0.5 rounded ${sortBy === 'volume' ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58]'}`}>成交量</button>
        </div>
      </div>

      {/* High alert bar */}
      {highSpreads.length > 0 && (
        <div className="px-2 py-1 bg-[#ef444410] border-b border-[#ef444420] text-[9px] text-[#ef4444] font-bold flex items-center gap-2">
          <span className="animate-pulse">⚠</span>
          {highSpreads.length} 只 ≥{highlightThreshold}% 价差
        </div>
      )}

      {/* Spread list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map(item => {
          const isHigh = item.spreadPct >= highlightThreshold;
          const spreadW = (item.spreadPct / maxSpread) * 100;
          const isSel = selected === item.symbol;
          return (
            <div key={item.symbol}
              onClick={() => { setSelected(item.symbol); onSelect?.(item); }}
              className={`flex items-center gap-2 px-2 py-1 border-b border-[#1c2333] cursor-pointer transition-colors
                ${isSel ? 'bg-[#3b82f610]' : 'hover:bg-[#161b22]'}
                ${isHigh ? 'bg-[#ef444408]' : ''}`}>
              {/* Symbol */}
              <div className="w-20 shrink-0">
                <div className="text-[9px] text-[#c9d1d9] font-bold truncate">{item.symbol}</div>
                <div className="text-[7px] text-[#484f58]">{item.exchange}</div>
              </div>

              {/* Spread bar */}
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-2 bg-[#161b22] rounded-sm overflow-hidden">
                  <div className={`h-full rounded-sm ${isHigh ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'}`}
                    style={{ width: `${spreadW}%`, opacity: 0.6 }} />
                </div>
                <span className={`text-[9px] font-bold w-12 text-right ${isHigh ? 'text-[#ef4444]' : 'text-[#f59e0b]'}`}>
                  {item.spreadPct.toFixed(2)}%
                </span>
              </div>

              {/* Bid/Ask */}
              <div className="w-20 text-right shrink-0">
                <div className="text-[7px] text-[#22c55e]">{item.bidPx.toFixed(4)}</div>
                <div className="text-[7px] text-[#ef4444]">{item.askPx.toFixed(4)}</div>
              </div>

              {/* Volume */}
              <div className="w-14 text-right text-[8px] text-[#484f58] shrink-0">
                {item.volume24h >= 1000 ? (item.volume24h / 1000).toFixed(0) + 'K' : item.volume24h.toFixed(0)}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-4 text-[#484f58] text-xs">无价差数据</div>
        )}
      </div>

      {/* Footer */}
      <div className="flex border-t border-[#1c2333] text-[7px] text-[#484f58] px-2 py-1">
        <span>共 {spreads.length} 标的 · {highSpreads.length} 告警 · 阈值 {highlightThreshold}%</span>
      </div>
    </div>
  );
}
