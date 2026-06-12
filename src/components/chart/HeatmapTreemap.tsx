// ── R115 QTE-25 HeatmapTreemap — 板块热力图 ────────────────────────────
// PM: 500+标的60fps, 板块x市值方块(面积=市值/颜色=涨跌)/板块x涨跌纯色阶/个股排名/市场概览
// 4视图: MarketCap Treemap / Sector Heatmap / Top Movers / Market Overview

import { useMemo, useState } from 'react';

// ═══════════ Types ═══════════

export interface HeatmapItem {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  changePct: number;
  volume: number;
  changeAmount: number;
}

export type HeatmapView = 'treemap' | 'sector' | 'movers' | 'overview';
export type HeatmapPeriod = 'today' | '5d' | '20d' | 'ytd';

export interface HeatmapProps {
  data: HeatmapItem[];
  view?: HeatmapView;
  period?: HeatmapPeriod;
  height?: number;
  className?: string;
  onItemClick?: (item: HeatmapItem) => void;
}

// ═══════════ Constants ═══════════

const PERIOD_LABELS: Record<HeatmapPeriod, string> = { today: '今日', '5d': '5日', '20d': '20日', ytd: 'YTD' };
const VIEW_LABELS: Record<HeatmapView, string> = { treemap: '市值热力图', sector: '板块热力图', movers: '涨跌排行', overview: '市场概览' };

// ═══════════ Treemap layout (squarified algorithm) ═══════════

interface TreemapRect {
  x: number; y: number; w: number; h: number;
  item: HeatmapItem;
}

function squarify(items: { item: HeatmapItem; value: number }[], x: number, y: number, w: number, h: number): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ x, y, w, h, item: items[0].item }];

  const total = items.reduce((s, i) => s + i.value, 0);
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const result: TreemapRect[] = [];

  let row: typeof sorted = [];
  let rowValue = 0;
  let remainingTotal = total;

  for (const item of sorted) {
    row.push(item);
    rowValue += item.value;
    remainingTotal -= item.value;

    const shortSide = Math.min(w, h);
    const isRowLayout = w >= h;
    const rowWidth = isRowLayout ? (rowValue / total) * w : shortSide;
    const rowHeight = isRowLayout ? shortSide : (rowValue / total) * h;

    const prevAspect = row.length > 1 ? Math.max(rowHeight / (rowWidth / row.length), (rowWidth / row.length) / rowHeight) : 0;

    const nextAspect = remainingTotal > 0 && item.value > 0
      ? Math.max(
          Math.abs(h - (rowValue / total) * w) < 0.001 ? h : h,
          Math.abs(w - (rowValue / total) * h) < 0.001 ? w : w,
        )
      : Infinity;

    if (row.length === 1 || prevAspect < nextAspect) {
      // Simple fill
      let offset = 0;
      for (const r of row) {
        if (isRowLayout) {
          const rw = (r.value / rowValue) * ((rowValue / total) * w);
          result.push({ x: x + offset, y, w: rw, h: (rowValue / total) * h, item: r.item });
          offset += rw;
        } else {
          const rh = (r.value / rowValue) * ((rowValue / total) * h);
          result.push({ x, y: y + offset, w: (rowValue / total) * w, h: rh, item: r.item });
          offset += rh;
        }
      }
      if (isRowLayout) {
        // remaining space
        if (remainingTotal > 0) {
          result.push(...squarify(sorted.slice(row.length), x, y + (rowValue / total) * h, w, h - (rowValue / total) * h));
        }
      } else {
        if (remainingTotal > 0) {
          result.push(...squarify(sorted.slice(row.length), x + (rowValue / total) * w, y, w - (rowValue / total) * w, h));
        }
      }
      break;
    }
  }

  return result;
}

// ═══════════ Color helpers ═══════════

function changeColor(pct: number): string {
  if (pct > 5) return '#22c55e';
  if (pct > 2) return '#4ade80';
  if (pct > 0) return '#86efac';
  if (pct > -2) return '#fca5a5';
  if (pct > -5) return '#f87171';
  return '#ef4444';
}

function changeBgColor(pct: number): string {
  if (pct > 5) return 'rgba(34,197,94,0.3)';
  if (pct > 2) return 'rgba(74,222,128,0.2)';
  if (pct > 0) return 'rgba(134,239,172,0.15)';
  if (pct > -2) return 'rgba(252,165,165,0.15)';
  if (pct > -5) return 'rgba(248,113,113,0.2)';
  return 'rgba(239,68,68,0.3)';
}

// ═══════════ Component ═══════════

export default function HeatmapTreemap({
  data, height = 500, className = '', onItemClick,
}: HeatmapProps) {
  const [view, setView] = useState<HeatmapView>('treemap');
  const [period, setPeriod] = useState<HeatmapPeriod>('today');

  // Top 50 by market cap for treemap
  const displayData = useMemo(() => {
    return [...data].sort((a, b) => b.marketCap - a.marketCap).slice(0, 50);
  }, [data]);

  // Treemap layout
  const treemap = useMemo(() => {
    const items = displayData.map(d => ({ item: d, value: d.marketCap }));
    return squarify(items, 0, 0, 800, 400);
  }, [displayData]);

  // Sector aggregations
  const sectors = useMemo(() => {
    const map: Record<string, { count: number; totalMc: number; avgChange: number; items: HeatmapItem[] }> = {};
    for (const d of data) {
      if (!map[d.sector]) map[d.sector] = { count: 0, totalMc: 0, avgChange: 0, items: [] };
      map[d.sector].count++;
      map[d.sector].totalMc += d.marketCap;
      map[d.sector].items.push(d);
    }
    for (const s of Object.values(map)) s.avgChange = s.items.reduce((sum, i) => sum + i.changePct, 0) / s.items.length;
    return Object.entries(map).sort((a, b) => b[1].totalMc - a[1].totalMc);
  }, [data]);

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header + toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c2333]">
        <span className="text-[#8b949e] font-semibold text-xs tracking-wide">市场热力图</span>
        <div className="flex gap-0.5">
          {(Object.entries(VIEW_LABELS) as [HeatmapView, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2 py-0.5 text-[9px] rounded transition-colors ${view === v ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58] hover:text-[#8b949e]'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5">
          {(Object.entries(PERIOD_LABELS) as [HeatmapPeriod, string][]).map(([p, label]) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-1.5 py-0.5 text-[8px] rounded ${period === p ? 'bg-[#c9a96e20] text-[#c9a96e]' : 'text-[#484f58]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div style={{ height }}>
        {/* Treemap view */}
        {view === 'treemap' && (
          <div className="relative w-full h-full p-2">
            <svg width="100%" height="100%" viewBox="0 0 800 400" className="rounded">
              {treemap.map((rect) => (
                <g key={rect.item.symbol}>
                  <rect
                    x={rect.x} y={rect.y} width={rect.w - 0.5} height={rect.h - 0.5}
                    fill={changeBgColor(rect.item.changePct)}
                    stroke="#1c2333" strokeWidth="0.5" rx="2"
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onClick={() => { onItemClick?.(rect.item); }}
                  />
                  {rect.w > 40 && rect.h > 20 && (
                    <>
                      <text x={rect.x + 3} y={rect.y + 14} fill="#c9d1d9" fontSize="8" fontWeight="bold" fontFamily="monospace">
                        {rect.item.symbol}
                      </text>
                      <text x={rect.x + 3} y={rect.y + 26} fill={changeColor(rect.item.changePct)} fontSize="7" fontFamily="monospace">
                        {rect.item.changePct >= 0 ? '+' : ''}{rect.item.changePct.toFixed(1)}%
                      </text>
                    </>
                  )}
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* Sector heatmap view */}
        {view === 'sector' && (
          <div className="flex flex-wrap gap-2 p-3 overflow-y-auto h-full">
            {sectors.map(([sector, info]) => (
              <div key={sector}
                className="flex-1 min-w-[140px] p-2 rounded border cursor-pointer transition-colors hover:border-[#c9a96e40]"
                style={{
                  backgroundColor: changeBgColor(info.avgChange) + '10',
                  borderColor: changeBgColor(info.avgChange) + '30',
                  flexBasis: `${Math.max(10, (info.totalMc / sectors[0][1].totalMc) * 100)}%`,
                }}
              >
                <div className="text-[10px] text-[#8b949e] font-bold">{sector}</div>
                <div className={`text-lg font-bold ${info.avgChange >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {info.avgChange >= 0 ? '+' : ''}{info.avgChange.toFixed(2)}%
                </div>
                <div className="text-[9px] text-[#484f58]">{info.count}只 · ${(info.totalMc / 1e9).toFixed(0)}B</div>
              </div>
            ))}
          </div>
        )}

        {/* Top Movers view */}
        {view === 'movers' && (
          <div className="flex h-full">
            {/* Gainers */}
            <div className="flex-1 p-2 border-r border-[#1c2333] overflow-y-auto">
              <div className="text-[10px] text-[#22c55e] font-bold mb-2">📈 涨幅榜</div>
              {[...data].sort((a, b) => b.changePct - a.changePct).slice(0, 20).map(d => (
                <div key={d.symbol} className="flex items-center gap-2 py-0.5 text-[9px] hover:bg-[#161b22] rounded px-1 cursor-pointer"
                  onClick={() => onItemClick?.(d)}>
                  <span className="text-[#8b949e] w-12">{d.symbol}</span>
                  <span className="text-[#22c55e] flex-1 text-right">+{d.changePct.toFixed(1)}%</span>
                  <span className="text-[#484f58] w-16 text-right">${d.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
            {/* Losers */}
            <div className="flex-1 p-2 overflow-y-auto">
              <div className="text-[10px] text-[#ef4444] font-bold mb-2">📉 跌幅榜</div>
              {[...data].sort((a, b) => a.changePct - b.changePct).slice(0, 20).map(d => (
                <div key={d.symbol} className="flex items-center gap-2 py-0.5 text-[9px] hover:bg-[#161b22] rounded px-1 cursor-pointer"
                  onClick={() => onItemClick?.(d)}>
                  <span className="text-[#8b949e] w-12">{d.symbol}</span>
                  <span className="text-[#ef4444] flex-1 text-right">{d.changePct.toFixed(1)}%</span>
                  <span className="text-[#484f58] w-16 text-right">${d.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Overview view */}
        {view === 'overview' && (
          <div className="p-3 grid grid-cols-2 gap-2 overflow-y-auto h-full">
            <StatCard label="总市值" value={'$' + (data.reduce((s, d) => s + d.marketCap, 0) / 1e12).toFixed(2) + 'T'} color="#c9d1d9" />
            <StatCard label="上涨/下跌" value={`${data.filter(d => d.changePct > 0).length}/${data.filter(d => d.changePct < 0).length}`}
              color={data.filter(d => d.changePct > 0).length > data.filter(d => d.changePct < 0).length ? '#22c55e' : '#ef4444'} />
            <StatCard label="平均涨幅" value={(data.reduce((s, d) => s + d.changePct, 0) / data.length).toFixed(2) + '%'}
              color={data.reduce((s, d) => s + d.changePct, 0) > 0 ? '#22c55e' : '#ef4444'} />
            <StatCard label="最强板块" value={sectors[0]?.[0] || '-'} color="#f59e0b" />
            <StatCard label="总成交量" value={'$' + (data.reduce((s, d) => s + d.volume, 0) / 1e9).toFixed(1) + 'B'} color="#8b949e" />
            <StatCard label="板块数" value={String(sectors.length)} color="#8b949e" />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════ Stat Card ═══════════

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#161b22] rounded p-2 border border-[#1c2333]">
      <div className="text-[9px] text-[#484f58]">{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
