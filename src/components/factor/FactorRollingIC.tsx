// ── R190 ML P6-01: FactorRollingIC — 12月IC趋势热力图 ────────────────
// Visualizes factor IC (Information Coefficient) trend over 12 months.
// Shows whether each factor's predictive power is improving or decaying.
//
// Design:
// - Grid: factors (rows) × months (columns)
// - Color: green=IC>0.03, yellow=0.01-0.03, red=<0.01
// - Arrow indicators: ↗ IC rising, ↘ IC falling, → stable
// - Decay alert: red pulsing border for factors dropping below 0.03
// - Click factor row → navigate to FactorHealthAlert for details
// - Dark theme, compact layout

import React, { useState, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FactorICPoint {
  factorId: string;
  nameCN: string;
  category: string;
  months: number[];       // 12 IC values, Jan-Dec
  currentIC: number;      // latest month IC
  trend: 'rising' | 'falling' | 'stable';
  decayAlert: boolean;    // true if IC trending below 0.03
  halfLifeEstimate: number; // estimated months until IC < 0.03
}

interface FactorRollingICProps {
  factors: FactorICPoint[];
  year?: number;
  /** Callback when a factor row is clicked */
  onSelectFactor?: (factorId: string) => void;
  className?: string;
}

// ── IC color mapping ─────────────────────────────────────────────────────────

function getICColor(ic: number): { bg: string; text: string } {
  if (ic >= 0.05) return { bg: '#166534', text: '#4ade80' };
  if (ic >= 0.04) return { bg: '#15803d', text: '#22c55e' };
  if (ic >= 0.03) return { bg: '#16653480', text: '#86efac' };
  if (ic >= 0.02) return { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' };
  if (ic >= 0.01) return { bg: 'rgba(245,158,11,0.08)', text: '#fcd34d' };
  if (ic > 0) return { bg: '#7f1d1d30', text: '#fca5a5' };
  return { bg: '#7f1d1d50', text: '#ef4444' };
}

// ── Trend arrow ──────────────────────────────────────────────────────────────

const TrendArrow: React.FC<{ trend: 'rising' | 'falling' | 'stable'; decay: boolean }> = ({ trend, decay }) => {
  const config = {
    rising: { arrow: '↗', color: '#22c55e', label: '上升' },
    falling: { arrow: '↘', color: decay ? '#ef4444' : '#f59e0b', label: '下降' },
    stable: { arrow: '→', color: '#6b7280', label: '稳定' },
  };
  const c = config[trend];
  return (
    <span
      className={`text-xs font-bold ${decay && trend === 'falling' ? 'animate-pulse' : ''}`}
      style={{ color: c.color }}
      title={`IC趋势: ${c.label}${decay ? ' (衰减警报)' : ''}`}
    >
      {c.arrow}
    </span>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const FactorRollingIC: React.FC<FactorRollingICProps> = ({
  factors,
  year = new Date().getFullYear(),
  onSelectFactor,
  className = '',
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'currentIC' | 'trend'>('currentIC');
  const [filterDecay, setFilterDecay] = useState(false);

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const currentMonth = new Date().getMonth(); // 0-indexed

  const sorted = useMemo(() => {
    let list = [...factors];
    if (filterDecay) list = list.filter(f => f.decayAlert);
    switch (sortBy) {
      case 'currentIC': return list.sort((a, b) => b.currentIC - a.currentIC);
      case 'trend': return list.sort((a, b) => {
        const order = { rising: 2, stable: 1, falling: 0 };
        return order[b.trend] - order[a.trend];
      });
      default: return list.sort((a, b) => a.nameCN.localeCompare(b.nameCN));
    }
  }, [factors, sortBy, filterDecay]);

  // Summary
  const summary = useMemo(() => {
    const rising = factors.filter(f => f.trend === 'rising').length;
    const falling = factors.filter(f => f.trend === 'falling').length;
    const stable = factors.filter(f => f.trend === 'stable').length;
    const decaying = factors.filter(f => f.decayAlert).length;
    return { rising, falling, stable, decaying };
  }, [factors]);

  if (factors.length === 0) {
    return <div className="text-center py-8 text-xs text-gray-600">暂无IC数据</div>;
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-300">
          📈 {year}年 因子IC滚动趋势
        </h3>
        <div className="flex items-center gap-3">
          {/* Summary pills */}
          <div className="flex items-center gap-2 text-[9px]">
            <span className="text-green-400">↗ {summary.rising}</span>
            <span className="text-gray-500">→ {summary.stable}</span>
            <span className="text-red-400">↘ {summary.falling}</span>
            {summary.decaying > 0 && (
              <span className="text-red-400 animate-pulse font-bold">⚠ {summary.decaying} 衰减</span>
            )}
          </div>

          {/* Sort + filter */}
          <div className="flex items-center gap-1">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="text-[9px] bg-white/[0.03] border border-white/5 rounded px-1.5 py-1 text-gray-400"
            >
              <option value="currentIC">按IC排序</option>
              <option value="trend">按趋势排序</option>
              <option value="name">按名称排序</option>
            </select>
            <button
              onClick={() => setFilterDecay(!filterDecay)}
              className={`text-[9px] px-1.5 py-1 rounded border transition-colors ${
                filterDecay ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-white/[0.03] text-gray-600 border-white/5'
              }`}
            >
              {filterDecay ? '⚠ 仅衰减' : '全部'}
            </button>
          </div>
        </div>
      </div>

      {/* IC Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[9px] text-gray-600 font-normal p-1 w-16">因子</th>
              <th className="text-center text-[9px] text-gray-600 font-normal p-1 w-8">趋势</th>
              {months.map((m, i) => (
                <th key={m} className={`text-center text-[8px] font-normal p-0.5 ${i === currentMonth ? 'text-[#D4A853] font-bold' : 'text-gray-700'}`}>
                  {m}
                </th>
              ))}
              <th className="text-center text-[9px] text-gray-600 font-normal p-1 w-12">衰减</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(factor => (
              <tr
                key={factor.factorId}
                className={`group cursor-pointer hover:bg-white/[0.03] transition-colors ${
                  factor.decayAlert ? 'bg-red-500/[0.03]' : ''
                }`}
                onClick={() => onSelectFactor?.(factor.factorId)}
              >
                <td className="text-left p-1">
                  <span className="text-[10px] text-white font-medium truncate block max-w-[80px]">
                    {factor.nameCN}
                  </span>
                  <span className="text-[8px] text-gray-700 font-mono">{factor.factorId}</span>
                </td>
                <td className="text-center p-1">
                  <TrendArrow trend={factor.trend} decay={factor.decayAlert} />
                </td>
                {factor.months.map((ic, i) => {
                  const color = getICColor(ic);
                  const isCurrent = i === currentMonth;
                  const isFuture = i > currentMonth;
                  return (
                    <td key={i} className="p-0.5" style={{ opacity: isFuture ? 0.3 : 1 }}>
                      <div
                        className={`w-full aspect-square rounded-sm flex items-center justify-center text-[8px] font-mono relative ${
                          isCurrent ? 'ring-1 ring-[#D4A853]/50' : ''
                        }`}
                        style={{ backgroundColor: color.bg, color: color.text, minWidth: '26px' }}
                        title={`${factor.nameCN} ${months[i]} IC: ${ic.toFixed(3)}`}
                      >
                        {ic.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
                <td className="text-center p-1">
                  {factor.decayAlert ? (
                    <span className="text-[8px] text-red-400 font-mono font-bold animate-pulse">
                      {factor.halfLifeEstimate}月
                    </span>
                  ) : (
                    <span className="text-[8px] text-gray-700">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-[8px] text-gray-600">
        <span>IC色阶:</span>
        {['≥0.05', '0.04', '0.03', '0.02', '0.01', '<0.01'].map(label => {
          const ic = parseFloat(label.replace('≥', '').replace('<', ''));
          const color = getICColor(isNaN(ic) ? 0.01 : ic);
          return (
            <span key={label} className="flex items-center gap-0.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color.bg }} />
              {label}
            </span>
          );
        })}
        <span className="ml-4">
          <span className="text-[#D4A853]">▣</span> 本月
        </span>
      </div>

      {/* Decay summary */}
      {summary.decaying > 0 && (
        <div className="mt-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10 text-[10px]">
          <span className="text-red-400">⚠ {summary.decaying}个因子IC呈衰减趋势：</span>
          <span className="text-gray-500 ml-1">
            建议关注这些因子的信号可靠性，考虑降低权重或寻找替代因子。
          </span>
        </div>
      )}
    </div>
  );
};

// ── Demo data ────────────────────────────────────────────────────────────────

export function generateDemoICData(): FactorICPoint[] {
  const factorNames = [
    { id: 'MOM_12M', name: '12月动量', cat: 'momentum' },
    { id: 'HML', name: '价值因子', cat: 'value' },
    { id: 'QUAL', name: '品质因子', cat: 'quality' },
    { id: 'VOL_60D', name: '60日低波', cat: 'volatility' },
    { id: 'EMA_12_26', name: 'MACD交叉', cat: 'technical' },
    { id: 'US_VIX', name: 'VIX恐慌', cat: 'us_specific' },
    { id: 'CRYPTO_FUNDING', name: '资金费率', cat: 'crypto' },
    { id: 'YIELD', name: '股息率', cat: 'yield' },
    { id: 'GROWTH', name: '成长因子', cat: 'growth' },
    { id: 'RSI_14', name: 'RSI 14', cat: 'momentum' },
    { id: 'KDJ', name: 'KDJ', cat: 'technical' },
    { id: 'HKEX_SOUTHBOUND', name: '南向资金', cat: 'hk_specific' },
  ];

  const result: FactorICPoint[] = [];
  const seed = new Date().getFullYear() * 13 + 7;
  const currentMonth = new Date().getMonth();

  for (const fn of factorNames) {
    const months: number[] = [];
    let lastIC = 0.03 + (fn.id.charCodeAt(0) % 10) * 0.005;
    for (let m = 0; m < 12; m++) {
      // Simulate random walk
      const change = (Math.sin(seed + m + fn.id.length * 2.7) * 0.008) + (Math.cos(fn.id.charCodeAt(0) * 1.3) * 0.004);
      lastIC = Math.max(0, Math.min(0.08, lastIC + change));
      if (m < currentMonth) months.push(Math.round(lastIC * 1000) / 1000);
      else months.push(0); // Future months not available
    }

    // Determine trend from last 3 available
    const available = months.slice(0, currentMonth + 1).filter(v => v > 0);
    const recent = available.slice(-3);
    let trend: 'rising' | 'falling' | 'stable' = 'stable';
    if (recent.length >= 3) {
      const diff = recent[2] - recent[0];
      if (diff > 0.005) trend = 'rising';
      else if (diff < -0.005) trend = 'falling';
    }
    const currentIC = available[available.length - 1] || 0;
    const decayAlert = currentIC < 0.03 && trend === 'falling';
    const halfLifeEstimate = decayAlert ? Math.round((0.03 - currentIC) / 0.002) : 99;

    result.push({
      factorId: fn.id, nameCN: fn.name, category: fn.cat,
      months, currentIC, trend, decayAlert, halfLifeEstimate,
    });
  }

  return result;
}

export default FactorRollingIC;
