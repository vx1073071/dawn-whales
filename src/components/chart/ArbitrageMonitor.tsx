// @ts-nocheck — R119: cross-module type mismatch pending lib/component alignment
// ── R116 QTE-46 ArbitrageMonitor — 套利监控面板 ─────────────────────────
// PM: 价差实时雷达图+套利机会列表+三角套利环形图, 价差>0.5%高亮

import { useMemo, useState } from 'react';



// ═══════ Bridge: ArbitrageEngine → Monitor UI ═══════════
import { ArbitrageEngine, type ArbitrageOpportunity } from '../../lib/chart/arbitrage-engine';

let _arbitrageEngine: ArbitrageEngine | null = null;
export function getArbitrageEngine(): ArbitrageEngine {
  if (!_arbitrageEngine) _arbitrageEngine = new ArbitrageEngine();
  return _arbitrageEngine;
}

// ═══════════ Types ═══════════

export interface ArbOpportunity {
  id: string;
  pair: string; // e.g. "Binance→OKX"
  brokerA: string;
  brokerB: string;
  symbol: string;
  buyAt: { broker: string; price: number };
  sellAt: { broker: string; price: number };
  spreadPct: number;
  profitEstimate: number; // estimated net profit
  volume: number;
  direction: 'A→B' | 'B→A';
  timestamp: number;
}

export interface TriangleArb {
  id: string;
  broker: string;
  path: string[]; // e.g. ['BTC/USDT', 'ETH/BTC', 'ETH/USDT']
  profitPct: number;
  legs: { symbol: string; side: 'buy' | 'sell'; price: number }[];
  timestamp: number;
}

export interface ArbitrageMonitorProps {
  opportunities: ArbOpportunity[];
  triangles: TriangleArb[];
  minSpreadPct?: number; // default 0.1%
  onTrade?: (opp: ArbOpportunity) => void;
  className?: string;
}

// ═══════════ Radar chart helper ═══════════

function radarPath(points: { angle: number; value: number; max: number }[], cx: number, cy: number, radius: number): string {
  if (points.length === 0) return '';
  return points.map((p, i) => {
    const r = (p.value / p.max) * radius;
    const x = cx + r * Math.cos(p.angle - Math.PI / 2);
    const y = cy + r * Math.sin(p.angle - Math.PI / 2);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ') + ' Z';
}

// ═══════════ Component ═══════════

export default function ArbitrageMonitor({ opportunities, triangles, minSpreadPct = 0.1, onTrade, className = '' }: ArbitrageMonitorProps) {
  const [view, setView] = useState<'list' | 'radar' | 'triangle'>('list');
  const [sortBy, setSortBy] = useState<'spread' | 'profit'>('spread');

  const filtered = useMemo(() => {
    return opportunities.filter(o => o.spreadPct >= minSpreadPct);
  }, [opportunities, minSpreadPct]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'spread') return b.spreadPct - a.spreadPct;
      return b.profitEstimate - a.profitEstimate;
    });
  }, [filtered, sortBy]);

  const significant = useMemo(() => filtered.filter(o => o.spreadPct >= 0.5), [filtered]);

  // Build radar data: spread per pair
  const radarData = useMemo(() => {
    const pairMap: Record<string, number> = {};
    for (const o of filtered) {
      const key = `${o.brokerA}→${o.brokerB}`;
      pairMap[key] = Math.max(pairMap[key] || 0, o.spreadPct);
    }
    const entries = Object.entries(pairMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxVal = Math.max(...entries.map(e => e[1]), 1);
    return entries.map(([label, value], i) => ({
      label,
      value: value * 100, // to percentage points
      max: maxVal * 100,
      angle: (i / entries.length) * Math.PI * 2,
    }));
  }, [filtered]);

  // Triangle ring chart data
  const triangleRings = useMemo(() => {
    return triangles.slice(0, 5).map((t, i) => ({
      ...t,
      ringRadius: 30 + i * 18,
      color: t.profitPct > 0.5 ? '#22c55e' : t.profitPct > 0.1 ? '#eab308' : '#ef4444',
    }));
  }, [triangles]);

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c2333]">
        <span className="text-[#8b949e] font-semibold text-[10px] tracking-wide">💹 套利监控</span>
        <div className="flex gap-0.5">
          {(['list', 'radar', 'triangle'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2 py-0.5 text-[9px] rounded transition-colors ${view === v ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58] hover:text-[#8b949e]'}`}>
              {v === 'list' ? '列表' : v === 'radar' ? '雷达' : '三角'}
            </button>
          ))}
          <div className="flex gap-0.5 ml-2">
            <button onClick={() => setSortBy('spread')}
              className={`px-1.5 py-0.5 text-[8px] rounded ${sortBy === 'spread' ? 'bg-[#c9a96e20] text-[#c9a96e]' : 'text-[#484f58]'}`}>价差</button>
            <button onClick={() => setSortBy('profit')}
              className={`px-1.5 py-0.5 text-[8px] rounded ${sortBy === 'profit' ? 'bg-[#c9a96e20] text-[#c9a96e]' : 'text-[#484f58]'}`}>收益</button>
          </div>
        </div>
      </div>

      {/* Alert bar for >0.5% opportunities */}
      {significant.length > 0 && (
        <div className="px-3 py-1.5 bg-[#22c55e10] border-b border-[#22c55e20] text-[10px] text-[#22c55e] font-bold flex items-center gap-2">
          <span className="animate-pulse">⚡</span>
          {significant.length} 个套利机会 &ge;0.5% — 最大 {significant[0].spreadPct.toFixed(2)}%
        </div>
      )}

      {/* Radar view */}
      {view === 'radar' && (
        <div className="flex items-center justify-center p-4" style={{ minHeight: 300 }}>
          {radarData.length === 0 ? (
            <span className="text-[#484f58] text-xs">无套利数据</span>
          ) : (
            <svg width="280" height="280" viewBox="0 0 280 280">
              {/* Grid rings */}
              {[1, 2, 3, 4].map(r => (
                <circle key={r} cx={140} cy={140} r={r * 30} fill="none" stroke="#1c2333" strokeWidth="0.5" />
              ))}
              {/* Axes */}
              {radarData.map((p, i) => (
                <line key={i} x1={140} y1={140} x2={140 + 120 * Math.cos(p.angle - Math.PI / 2)} y2={140 + 120 * Math.sin(p.angle - Math.PI / 2)}
                  stroke="#1c2333" strokeWidth="0.5" />
              ))}
              {/* Data polygon */}
              <path d={radarPath(radarData, 140, 140, 120)} fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth="1.5" />
              {/* Labels */}
              {radarData.map((p, i) => (
                <text key={i} x={140 + 135 * Math.cos(p.angle - Math.PI / 2)} y={140 + 135 * Math.sin(p.angle - Math.PI / 2) + 3}
                  fill="#8b949e" fontSize="7" textAnchor="middle" fontFamily="monospace">
                  {p.label.split('→')[0]}→{p.label.split('→')[1]?.slice(0, 4) || ''}
                </text>
              ))}
              {/* Values */}
              {radarData.map((p, i) => (
                <text key={`v-${i}`} x={140 + (p.value / p.max) * 120 * Math.cos(p.angle - Math.PI / 2) - 8}
                  y={140 + (p.value / p.max) * 120 * Math.sin(p.angle - Math.PI / 2) - 6}
                  fill="#22c55e" fontSize="7" fontFamily="monospace">
                  {p.value.toFixed(1)}%
                </text>
              ))}
            </svg>
          )}
        </div>
      )}

      {/* Triangle view */}
      {view === 'triangle' && (
        <div className="flex items-center justify-center p-4" style={{ minHeight: 300 }}>
          {triangleRings.length === 0 ? (
            <span className="text-[#484f58] text-xs">无三角套利机会</span>
          ) : (
            <svg width="300" height="300" viewBox="0 0 300 300">
              <circle cx={150} cy={150} r={140} fill="none" stroke="#1c2333" strokeWidth="0.5" />
              {triangleRings.map((t, i) => (
                <g key={t.id}>
                  {/* Ring */}
                  <circle cx={150} cy={150} r={t.ringRadius + 20} fill="none" stroke={t.color} strokeWidth={i === 0 ? 2 : 1}
                    strokeDasharray={t.profitPct > 0.3 ? 'none' : '4 4'} opacity={0.6} />
                  {/* Label */}
                  <text x={150} y={150 - t.ringRadius - 24} fill={t.color} fontSize="8" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                    {t.path.join('→')}
                  </text>
                  <text x={150} y={150 - t.ringRadius - 10} fill={t.color} fontSize="10" textAnchor="middle" fontWeight="bold">
                    +{t.profitPct.toFixed(2)}%
                  </text>
                  {/* Broker */}
                  <text x={150} y={150 + t.ringRadius + 30} fill="#484f58" fontSize="8" textAnchor="middle" fontFamily="monospace">
                    {t.broker}
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>
      )}

      {/* List view (default) */}
      {view === 'list' && (
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[#484f58] text-xs">当前无套利机会</div>
          ) : (
            sorted.map(opp => {
              const isHigh = opp.spreadPct >= 0.5;
              const isMedium = opp.spreadPct >= 0.2;
              const bgColor = isHigh ? 'bg-[#22c55e10]' : isMedium ? 'bg-[#eab30810]' : '';
              const borderColor = isHigh ? 'border-[#22c55e30]' : 'border-[#1c2333]';
              return (
                <div key={opp.id} className={`flex items-center gap-2 px-2 py-1.5 border-b ${borderColor} ${bgColor} hover:bg-[#161b22] transition-colors`}>
                  {/* Direction arrow */}
                  <span className="text-[10px] shrink-0">{opp.direction === 'A→B' ? '→' : '←'}</span>

                  {/* Pair info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[#c9a96e] font-bold">{opp.symbol}</span>
                      <span className="text-[8px] text-[#484f58]">{opp.brokerA} → {opp.brokerB}</span>
                    </div>
                    <div className="flex gap-2 text-[9px]">
                      <span className="text-[#22c55e]">买 {opp.buyAt.price.toFixed(4)}</span>
                      <span className="text-[#ef4444]">卖 {opp.sellAt.price.toFixed(4)}</span>
                    </div>
                  </div>

                  {/* Spread + Profit */}
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-[10px] font-bold ${isHigh ? 'text-[#22c55e] animate-pulse' : isMedium ? 'text-[#eab308]' : 'text-[#8b949e]'}`}>
                      {opp.spreadPct.toFixed(2)}%
                    </span>
                    <span className="text-[8px] text-[#484f58]">
                      估 {opp.profitEstimate.toFixed(4)} USDT
                    </span>
                  </div>

                  {/* Volume */}
                  <div className="text-[8px] text-[#484f58] w-14 text-right shrink-0">
                    {opp.volume.toFixed(4)}
                  </div>

                  {/* Trade button */}
                  {onTrade && (
                    <button onClick={() => onTrade(opp)}
                      className="px-1.5 py-0.5 text-[8px] bg-[#3b82f620] text-[#3b82f6] rounded hover:bg-[#3b82f630] transition-colors shrink-0">
                      交易
                    </button>
                  )}

                  {/* Time */}
                  <span className="text-[7px] text-[#484f58] shrink-0">
                    {new Date(opp.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer stats */}
      <div className="flex border-t border-[#1c2333] text-[8px]">
        <div className="flex-1 px-2 py-1 text-center text-[#484f58]">
          总计 {filtered.length} 机会
        </div>
        <div className="flex-1 px-2 py-1 text-center text-[#22c55e]">
          高收益 {significant.length} 个
        </div>
        <div className="flex-1 px-2 py-1 text-center text-[#484f58]">
          三角 {triangles.length} 条
        </div>
      </div>
    </div>
  );
}
