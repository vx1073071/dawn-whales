/**
 * StrategyComparer — A/B side-by-side strategy comparison
 * (ML-43-02, R43 Phase 6.0)
 *
 * Features:
 * - Left/right split comparison
 * - Synced time axis for equity curves
 * - 4-dimension radar chart (Sharpe/Return/Drawdown/WinRate)
 * - Metric diff highlighting (green better, red worse)
 * - Strategy selector dropdowns
 */

import { useTranslation } from "react-i18next";
import React, { useState, useMemo, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface StrategySnapshot {
  id: string;
  name: string;
  type: string;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  annualVol: number;
  calmarRatio: number;
  tradeCount: number;
  avgHoldingDays: number;
  profitFactor: number;
  equityCurve: number[]; // 100 normalized points
}

// ── Mock data ────────────────────────────────────────────────────────────

const MOCK_STRATEGIES: StrategySnapshot[] = [
  {
    id: 's1', name: '双均线交叉 v3', type: 'MA_CROSS',
    sharpe: 2.1, totalReturn: 0.35, maxDrawdown: -0.12, winRate: 0.58,
    annualVol: 0.18, calmarRatio: 2.9, tradeCount: 245, avgHoldingDays: 7.2,
    profitFactor: 1.8,
    equityCurve: Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i / 8) * 15 + i * 0.35 + Math.random() * 5),
  },
  {
    id: 's2', name: '动量突破 v2', type: 'MOMENTUM',
    sharpe: 1.8, totalReturn: 0.28, maxDrawdown: -0.18, winRate: 0.52,
    annualVol: 0.22, calmarRatio: 1.6, tradeCount: 180, avgHoldingDays: 4.5,
    profitFactor: 1.4,
    equityCurve: Array.from({ length: 100 }, (_, i) => 100 + Math.cos(i / 6) * 20 + i * 0.28 + Math.random() * 8),
  },
  {
    id: 's3', name: '均值回归 v1', type: 'MEAN_REV',
    sharpe: 2.4, totalReturn: 0.42, maxDrawdown: -0.09, winRate: 0.63,
    annualVol: 0.15, calmarRatio: 4.7, tradeCount: 320, avgHoldingDays: 3.1,
    profitFactor: 2.1,
    equityCurve: Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i / 10) * 8 + i * 0.42 + Math.random() * 3),
  },
];

// ── Radar chart sub-component ───────────────────────────────────────────

const RadarChart: React.FC<{
  data: { label: string; valueA: number; valueB: number; maxVal: number }[];
  size?: number;
}> = ({ data, size = 140 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const n = data.length;

  const getPoint = (index: number, value: number, maxVal: number) => {
  const { t } = useTranslation();
    const angle = (index / n) * 2 * Math.PI - Math.PI / 2;
    const r = (value / maxVal) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const maxVal = Math.max(...data.map(d => d.maxVal), 1);

  // Background grid
  const levels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid polygons */}
      {levels.map(level => {
        const points = data.map((_, i) => {
          const p = getPoint(i, level * maxVal, maxVal);
          return `${p.x},${p.y}`;
        }).join(' ');
        return (
          <polygon
            key={level}
            points={points}
            fill="none"
            stroke="#374151"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Axes */}
      {data.map((_, i) => {
        const outer = getPoint(i, maxVal, maxVal);
        return (
          <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="#374151" strokeWidth="0.5" />
        );
      })}

      {/* Strategy A polygon */}
      <polygon
        points={data.map((d, i) => {
          const p = getPoint(i, d.valueA, maxVal);
          return `${p.x},${p.y}`;
        }).join(' ')}
        fill="#f59e0b"
        fillOpacity="0.2"
        stroke="#f59e0b"
        strokeWidth="1.5"
      />

      {/* Strategy B polygon */}
      <polygon
        points={data.map((d, i) => {
          const p = getPoint(i, d.valueB, maxVal);
          return `${p.x},${p.y}`;
        }).join(' ')}
        fill="#3b82f6"
        fillOpacity="0.2"
        stroke="#3b82f6"
        strokeWidth="1.5"
      />

      {/* Labels */}
      {data.map((d, i) => {
        const outer = getPoint(i, maxVal * 1.15, maxVal);
        return (
          <text
            key={i}
            x={outer.x}
            y={outer.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fill="#6b7280"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

interface StrategyComparerProps {
  className?: string;
}

export const StrategyComparer: React.FC<StrategyComparerProps> = ({ className }) => {
  const [stratA, setStratA] = useState(MOCK_STRATEGIES[0].id);
  const [stratB, setStratB] = useState(MOCK_STRATEGIES[1].id);
  const [synced, setSynced] = useState(true);

  const strategyA = useMemo(() => MOCK_STRATEGIES.find(s => s.id === stratA)!, [stratA]);
  const strategyB = useMemo(() => MOCK_STRATEGIES.find(s => s.id === stratB)!, [stratB]);

  const swap = useCallback(() => {
    setStratA(stratB);
    setStratB(stratA);
  }, [stratA, stratB]);

  // Scoring
  const score = useCallback((s: StrategySnapshot) =>
    s.sharpe * 30 + s.totalReturn * 100 - Math.abs(s.maxDrawdown) * 50 + s.winRate * 40,
  []);
  const scoreA = useMemo(() => score(strategyA), [strategyA, score]);
  const scoreB = useMemo(() => score(strategyB), [strategyB, score]);

  // Radar data
  const radarData = useMemo(() => {
    const metrics: { key: string; label: string; maxVal: number; get: (s: StrategySnapshot) => number }[] = [
      { key: 'sharpe', label: 'Sharpe', maxVal: 3.5, get: s => s.sharpe },
      { key: 'return', label: t('components.returnRate'), maxVal: 0.6, get: s => s.totalReturn },
      { key: 'drawdown', label: '回撤', maxVal: 0.25, get: s => Math.abs(s.maxDrawdown) },
      { key: 'winRate', label: t('components.winRate'), maxVal: 0.8, get: s => s.winRate },
    ];
    return metrics.map(m => ({
      label: m.label,
      valueA: m.get(strategyA),
      valueB: m.get(strategyB),
      maxVal: m.maxVal,
    }));
  }, [strategyA, strategyB]);

  // Equity curve SVG
  const equitySvgA = useMemo(() => {
    const maxY = Math.max(...strategyA.equityCurve);
    const minY = Math.min(...strategyA.equityCurve);
    const range = maxY - minY || 1;
    return strategyA.equityCurve
      .map((v, i) => `${(i / 99) * 100},${100 - ((v - minY) / range) * 80}`)
      .join(' ');
  }, [strategyA]);

  const equitySvgB = useMemo(() => {
    const maxY = Math.max(...strategyB.equityCurve);
    const minY = Math.min(...strategyB.equityCurve);
    const range = maxY - minY || 1;
    return strategyB.equityCurve
      .map((v, i) => `${(i / 99) * 100},${100 - ((v - minY) / range) * 80}`)
      .join(' ');
  }, [strategyB]);

  // Metric comparison rows
  const metrics = useMemo(() => {
    const list: { label: string; valueA: number; valueB: number; format: (v: number) => string; invert?: boolean }[] = [
      { label: 'Sharpe', valueA: strategyA.sharpe, valueB: strategyB.sharpe, format: v => v.toFixed(2) },
      { label: t('components.totalReturn'), valueA: strategyA.totalReturn, valueB: strategyB.totalReturn, format: v => `${(v * 100).toFixed(1)}%` },
      { label: t('components.maxDrawdown'), valueA: strategyA.maxDrawdown, valueB: strategyB.maxDrawdown, format: v => `${(v * 100).toFixed(1)}%`, invert: true },
      { label: t('components.winRate'), valueA: strategyA.winRate, valueB: strategyB.winRate, format: v => `${(v * 100).toFixed(1)}%` },
      { label: '年化波动', valueA: strategyA.annualVol, valueB: strategyB.annualVol, format: v => `${(v * 100).toFixed(1)}%` },
      { label: 'Calmar', valueA: strategyA.calmarRatio, valueB: strategyB.calmarRatio, format: v => v.toFixed(1) },
      { label: t('components.profitLossRatio'), valueA: strategyA.profitFactor, valueB: strategyB.profitFactor, format: v => v.toFixed(1) },
      { label: '交易次数', valueA: strategyA.tradeCount, valueB: strategyB.tradeCount, format: v => String(v) },
      { label: '均持仓天数', valueA: strategyA.avgHoldingDays, valueB: strategyB.avgHoldingDays, format: v => v.toFixed(1) },
      { label: '综合评分', valueA: scoreA, valueB: scoreB, format: v => v.toFixed(0) },
    ];
    return list;
  }, [strategyA, strategyB, scoreA, scoreB]);

  const getWinner = (a: number, b: number, invert = false): 'a' | 'b' | 'tie' => {
    if (invert) return a < b ? 'a' : b < a ? 'b' : 'tie';
    return a > b ? 'a' : b > a ? 'b' : 'tie';
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            A/B 策略对比
            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 6.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {strategyA.name} vs {strategyB.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <input type="checkbox" checked={synced} onChange={e => setSynced(e.target.checked)} className="accent-amber-500" />
            同步轴
          </label>
          <button onClick={swap} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400 hover:text-gray-200">
            ⇄ 交换
          </button>
        </div>
      </div>

      {/* Strategy selectors */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <span className="text-amber-400 font-bold text-sm">A</span>
          <select
            value={stratA}
            onChange={e => setStratA(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
          >
            {MOCK_STRATEGIES.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <span className="text-blue-400 font-bold text-sm">B</span>
          <select
            value={stratB}
            onChange={e => setStratB(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
          >
            {MOCK_STRATEGIES.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Equity curves side by side */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Strategy A */}
        <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-400">A: {strategyA.name}</span>
            <span className={`text-[10px] ${strategyA.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(strategyA.totalReturn * 100).toFixed(1)}%
            </span>
          </div>
          <svg viewBox="0 0 100 100" className="w-full h-24">
            <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" points={equitySvgA} />
          </svg>
          <div className="grid grid-cols-3 gap-1 mt-2 text-center text-[10px]">
            <div><span className="text-gray-600">Sharpe</span><br/><span className="text-amber-400">{strategyA.sharpe.toFixed(1)}</span></div>
            <div><span className="text-gray-600">回撤</span><br/><span className="text-red-400">{(strategyA.maxDrawdown * 100).toFixed(0)}%</span></div>
            <div><span className="text-gray-600">{t("components.winRate")}</span><br/><span className="text-gray-400">{(strategyA.winRate * 100).toFixed(0)}%</span></div>
          </div>
        </div>
        {/* Strategy B */}
        <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-400">B: {strategyB.name}</span>
            <span className={`text-[10px] ${strategyB.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(strategyB.totalReturn * 100).toFixed(1)}%
            </span>
          </div>
          <svg viewBox="0 0 100 100" className="w-full h-24">
            <polyline fill="none" stroke="#3b82f6" strokeWidth="1.5" points={equitySvgB} />
          </svg>
          <div className="grid grid-cols-3 gap-1 mt-2 text-center text-[10px]">
            <div><span className="text-gray-600">Sharpe</span><br/><span className="text-blue-400">{strategyB.sharpe.toFixed(1)}</span></div>
            <div><span className="text-gray-600">回撤</span><br/><span className="text-red-400">{(strategyB.maxDrawdown * 100).toFixed(0)}%</span></div>
            <div><span className="text-gray-600">{t("components.winRate")}</span><br/><span className="text-gray-400">{(strategyB.winRate * 100).toFixed(0)}%</span></div>
          </div>
        </div>
      </div>

      {/* Radar chart + metrics table */}
      <div className="flex items-start gap-6">
        {/* Radar */}
        <div className="flex-shrink-0">
          <RadarChart data={radarData} size={140} />
          <div className="flex justify-center gap-4 mt-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> A</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> B</span>
          </div>
        </div>

        {/* Metrics table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700/50">
                <th className="text-left py-1.5 pr-3"></th>
                <th className="text-right py-1.5 pr-3">A</th>
                <th className="text-right py-1.5 pr-3">B</th>
                <th className="text-right py-1.5">胜者</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => {
                const w = getWinner(m.valueA, m.valueB, m.invert);
                return (
                  <tr key={m.label} className="border-b border-gray-700/20 text-gray-400">
                    <td className="py-1.5 pr-3 font-medium">{m.label}</td>
                    <td className={`py-1.5 pr-3 text-right font-mono ${w === 'a' ? 'text-amber-400 font-bold' : ''}`}>
                      {m.format(m.valueA)}
                    </td>
                    <td className={`py-1.5 pr-3 text-right font-mono ${w === 'b' ? 'text-blue-400 font-bold' : ''}`}>
                      {m.format(m.valueB)}
                    </td>
                    <td className="py-1.5 text-right">
                      {w === 'a' ? <span className="text-amber-400">⬅ A</span> :
                       w === 'b' ? <span className="text-blue-400">B ➡</span> :
                       <span className="text-gray-600">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StrategyComparer;
