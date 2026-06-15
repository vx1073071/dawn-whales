// ── R189 ML P5-01: FactorCalendarHeatmap — 月度因子收益热力图 ────────
// GitHub-style contribution heatmap for factor performance.
// Each cell = one month's return for one factor category.
// Intensity = magnitude of return (green=positive, red=negative).
//
// Design:
// - Y-axis: factor categories (动量/价值/品质/低波/技术/情绪/加密/港股/美股)
// - X-axis: months (Jan-Dec, current year)
// - Color scale: deep red (-10%+) → light red → gray (0%) → light green → deep green (+10%+)
// - Hover tooltip: exact return + rank that month
// - "This month" highlight column
// - Dark theme, compact grid

import React, { useState, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HeatmapCell {
  category: string;
  categoryCN: string;
  month: number;      // 1-12
  monthLabel: string; // '1月','2月',...
  year: number;
  value: number;      // return % (e.g. 3.5 = +3.5%)
  rank?: number;      // rank among categories this month
}

interface FactorCalendarHeatmapProps {
  data: HeatmapCell[];
  year?: number;
  /** Categories to show */
  categories?: Array<{ key: string; label: string }>;
  className?: string;
}

// ── Color scale ──────────────────────────────────────────────────────────────

function getHeatColor(value: number): { bg: string; text: string; label: string } {
  if (value >= 8) return { bg: '#166534', text: '#4ade80', label: '强涨' };
  if (value >= 5) return { bg: '#15803d', text: '#22c55e', label: '上涨' };
  if (value >= 2) return { bg: '#16653480', text: '#86efac', label: '微涨' };
  if (value > -2) return { bg: 'rgba(255,255,255,0.03)', text: '#6b7280', label: '持平' };
  if (value > -5) return { bg: '#7f1d1d40', text: '#fca5a5', label: '微跌' };
  if (value > -8) return { bg: '#991b1b', text: '#ef4444', label: '下跌' };
  return { bg: '#7f1d1d', text: '#dc2626', label: '暴跌' };
}

// ── Component ────────────────────────────────────────────────────────────────

export const FactorCalendarHeatmap: React.FC<FactorCalendarHeatmapProps> = ({
  data,
  year = new Date().getFullYear(),
  categories: customCategories,
  className = '',
}) => {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const currentMonth = new Date().getMonth() + 1;

  const defaultCategories = [
    { key: 'momentum', label: '动量' },
    { key: 'value', label: '价值' },
    { key: 'quality', label: '品质' },
    { key: 'volatility', label: '低波' },
    { key: 'technical', label: '技术' },
    { key: 'sentiment', label: '情绪' },
    { key: 'crypto', label: '加密' },
    { key: 'hk_specific', label: '港股' },
    { key: 'us_specific', label: '美股' },
  ];
  const categories = customCategories || defaultCategories;

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  // Build matrix: categories x months
  const matrix = useMemo(() => {
    const m: Record<string, Record<number, HeatmapCell>> = {};
    for (const cell of data) {
      if (!m[cell.category]) m[cell.category] = {};
      m[cell.category][cell.month] = cell;
    }
    return m;
  }, [data]);

  // Summary stats
  const summary = useMemo(() => {
    let bestMonth = { month: 0, value: -Infinity, cat: '' };
    let worstMonth = { month: 0, value: Infinity, cat: '' };
    let totalPositive = 0;
    let totalNegative = 0;
    let totalCells = 0;
    for (const cell of data) {
      totalCells++;
      if (cell.value > bestMonth.value && cell.month <= currentMonth) {
        bestMonth = { month: cell.month, value: cell.value, cat: cell.categoryCN };
      }
      if (cell.value < worstMonth.value && cell.month <= currentMonth) {
        worstMonth = { month: cell.month, value: cell.value, cat: cell.categoryCN };
      }
      if (cell.value > 0) totalPositive++;
      if (cell.value < 0) totalNegative++;
    }
    return {
      bestMonth, worstMonth,
      positivePct: totalCells > 0 ? Math.round((totalPositive / totalCells) * 100) : 0,
      negativePct: totalCells > 0 ? Math.round((totalNegative / totalCells) * 100) : 0,
    };
  }, [data, currentMonth]);

  if (data.length === 0) {
    return <div className="text-center py-8 text-xs text-gray-600">暂无因子收益数据</div>;
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-300">📅 {year}年 因子收益热力图</h3>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-gray-600">
            🟢 {summary.positivePct}%正收益 · 🔴 {summary.negativePct}%负收益
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[10px] text-gray-600 font-normal p-1 w-16">类别</th>
              {months.map((m, i) => (
                <th
                  key={m}
                  className={`text-center text-[9px] font-normal p-1 ${
                    i + 1 === currentMonth ? 'text-[#D4A853] font-bold' : 'text-gray-600'
                  }`}
                >
                  {m}
                  {i + 1 === currentMonth && <div className="text-[7px]">本月</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.key} className="group">
                <td className="text-left text-[10px] text-gray-400 p-1 font-medium">
                  {cat.label}
                </td>
                {months.map((_, mi) => {
                  const month = mi + 1;
                  const cell = matrix[cat.key]?.[month];
                  const color = cell ? getHeatColor(cell.value) : { bg: 'rgba(255,255,255,0.01)', text: '#6b7280', label: '' };
                  const isCurrent = month === currentMonth;
                  return (
                    <td key={month} className="p-0.5">
                      <div
                        className={`w-full aspect-square rounded-sm flex items-center justify-center text-[8px] font-mono cursor-pointer transition-all hover:scale-125 hover:z-10 hover:shadow-lg relative ${
                          isCurrent ? 'ring-1 ring-[#D4A853]/50' : ''
                        } ${month > currentMonth ? 'opacity-30' : ''}`}
                        style={{ backgroundColor: color.bg, color: color.text, minWidth: '28px' }}
                        onMouseEnter={() => cell && setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {cell ? (cell.value > 0 ? '+' : '') + cell.value.toFixed(1) : '·'}

                        {/* Hover tooltip */}
                        {hoveredCell === cell && cell && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1a1a25] border border-white/10 rounded text-[9px] text-white shadow-xl whitespace-nowrap z-20">
                            <strong>{cell.categoryCN}</strong> {cell.monthLabel}
                            <span className={cell.value >= 0 ? 'text-green-400 ml-1' : 'text-red-400 ml-1'}>
                              {cell.value >= 0 ? '+' : ''}{cell.value.toFixed(1)}%
                            </span>
                            {cell.rank && (
                              <span className="text-gray-600 ml-1">#{cell.rank}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-3 text-[8px] text-gray-600">
        <span>色阶:</span>
        {[['#7f1d1d', '-10%'], ['#991b1b', '-5%'], ['rgba(255,255,255,0.03)', '0%'], ['#16653480', '+2%'], ['#15803d', '+5%'], ['#166534', '+10%']].map(([bg, label]) => (
          <span key={label} className="flex items-center gap-0.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: bg as string }} />
            {label}
          </span>
        ))}
      </div>

      {/* Best/Worst callouts */}
      <div className="flex gap-4 mt-2 text-[9px]">
        <span className="text-green-400">
          🏆 最强: {summary.bestMonth.cat} {months[summary.bestMonth.month - 1]} +{summary.bestMonth.value.toFixed(1)}%
        </span>
        <span className="text-red-400">
          📉 最弱: {summary.worstMonth.cat} {months[summary.worstMonth.month - 1]} {summary.worstMonth.value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

// ── Demo data generator ──────────────────────────────────────────────────────

export function generateDemoHeatmapData(year?: number): HeatmapCell[] {
  const y = year || new Date().getFullYear();
  const categories = [
    { key: 'momentum', cn: '动量' },
    { key: 'value', cn: '价值' },
    { key: 'quality', cn: '品质' },
    { key: 'volatility', cn: '低波' },
    { key: 'technical', cn: '技术' },
    { key: 'sentiment', cn: '情绪' },
    { key: 'crypto', cn: '加密' },
    { key: 'hk_specific', cn: '港股' },
    { key: 'us_specific', cn: '美股' },
  ];

  const cells: HeatmapCell[] = [];
  const seed = y * 31 + 7;

  for (const cat of categories) {
    for (let m = 1; m <= 12; m++) {
      // Deterministic pseudo-random based on category + month + year
      const base = ((cat.key.charCodeAt(0) * 7 + m * 13 + seed) % 200 - 100) / 10;
      // Seasonality multiplier
      const seasonal = Math.sin(m * Math.PI / 6) * 3;
      const value = Math.round((base + seasonal) * 10) / 10;

      cells.push({
        category: cat.key,
        categoryCN: cat.cn,
        month: m,
        monthLabel: `${m}月`,
        year: y,
        value,
      });
    }
  }

  // Compute ranks per month
  for (let m = 1; m <= 12; m++) {
    const monthCells = cells.filter(c => c.month === m).sort((a, b) => b.value - a.value);
    monthCells.forEach((c, i) => { c.rank = i + 1; });
  }

  return cells;
}

export default FactorCalendarHeatmap;
