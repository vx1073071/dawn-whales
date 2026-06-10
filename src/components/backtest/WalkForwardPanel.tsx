/**
 * WalkForwardPanel — Walk-Forward analysis visualization
 * (ML-40-02, R40 Phase 5.0)
 *
 * Integrates with WalkForwardEngine to display:
 * - Training/testing window configuration
 * - Multi-window performance comparison chart
 * - OOS (out-of-sample) performance metrics
 * - Overfitting detection indicators
 * - Window-by-window drill-down table
 */

import { useTranslation } from "react-i18next";
import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface WFAWindow {
  index: number;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  trainSharpe: number;
  testSharpe: number;
  trainReturn: number;
  testReturn: number;
  trainMaxDD: number;
  testMaxDD: number;
  trainWinRate: number;
  testWinRate: number;
  overfitRatio: number;
  params: Record<string, number>;
}

interface WFAReport {
  totalWindows: number;
  windows: WFAWindow[];
  avgTrainSharpe: number;
  avgTestSharpe: number;
  avgTrainReturn: number;
  avgTestReturn: number;
  avgOverfitRatio: number;
  stabilityScore: number;
  bestParams: Record<string, number>;
  worstWindow: { index: number; testReturn: number };
  bestWindow: { index: number; testReturn: number };
}

// ── Mock data ────────────────────────────────────────────────────────────

const MOCK_REPORT: WFAReport = {
  totalWindows: 8,
  windows: [
    { index: 0, trainStart: '2023-01-01', trainEnd: '2023-12-31', testStart: '2024-01-01', testEnd: '2024-03-31', trainSharpe: 2.1, testSharpe: 1.8, trainReturn: 0.35, testReturn: 0.12, trainMaxDD: -0.08, testMaxDD: -0.06, trainWinRate: 0.58, testWinRate: 0.55, overfitRatio: 0.85, params: { maFast: 10, maSlow: 30 } },
    { index: 1, trainStart: '2023-04-01', trainEnd: '2024-03-31', testStart: '2024-04-01', testEnd: '2024-06-30', trainSharpe: 1.9, testSharpe: 1.6, trainReturn: 0.28, testReturn: 0.09, trainMaxDD: -0.10, testMaxDD: -0.08, trainWinRate: 0.55, testWinRate: 0.52, overfitRatio: 0.78, params: { maFast: 12, maSlow: 28 } },
    { index: 2, trainStart: '2023-07-01', trainEnd: '2024-06-30', testStart: '2024-07-01', testEnd: '2024-09-30', trainSharpe: 2.3, testSharpe: 0.4, trainReturn: 0.42, testReturn: -0.05, trainMaxDD: -0.07, testMaxDD: -0.15, trainWinRate: 0.62, testWinRate: 0.38, overfitRatio: 0.22, params: { maFast: 8, maSlow: 35 } },
    { index: 3, trainStart: '2023-10-01', trainEnd: '2024-09-30', testStart: '2024-10-01', testEnd: '2024-12-31', trainSharpe: 2.0, testSharpe: 1.7, trainReturn: 0.31, testReturn: 0.11, trainMaxDD: -0.09, testMaxDD: -0.07, trainWinRate: 0.57, testWinRate: 0.53, overfitRatio: 0.80, params: { maFast: 11, maSlow: 32 } },
    { index: 4, trainStart: '2024-01-01', trainEnd: '2024-12-31', testStart: '2025-01-01', testEnd: '2025-03-31', trainSharpe: 1.8, testSharpe: 1.5, trainReturn: 0.27, testReturn: 0.08, trainMaxDD: -0.11, testMaxDD: -0.09, trainWinRate: 0.54, testWinRate: 0.50, overfitRatio: 0.75, params: { maFast: 10, maSlow: 30 } },
    { index: 5, trainStart: '2024-04-01', trainEnd: '2025-03-31', testStart: '2025-04-01', testEnd: '2025-06-30', trainSharpe: 2.2, testSharpe: 1.9, trainReturn: 0.38, testReturn: 0.14, trainMaxDD: -0.06, testMaxDD: -0.05, trainWinRate: 0.60, testWinRate: 0.56, overfitRatio: 0.82, params: { maFast: 9, maSlow: 35 } },
    { index: 6, trainStart: '2024-07-01', trainEnd: '2025-06-30', testStart: '2025-07-01', testEnd: '2025-09-30', trainSharpe: 1.7, testSharpe: 1.4, trainReturn: 0.24, testReturn: 0.07, trainMaxDD: -0.12, testMaxDD: -0.10, trainWinRate: 0.52, testWinRate: 0.49, overfitRatio: 0.72, params: { maFast: 13, maSlow: 27 } },
    { index: 7, trainStart: '2024-10-01', trainEnd: '2025-09-30', testStart: '2025-10-01', testEnd: '2025-12-31', trainSharpe: 2.4, testSharpe: 2.0, trainReturn: 0.45, testReturn: 0.16, trainMaxDD: -0.05, testMaxDD: -0.04, trainWinRate: 0.63, testWinRate: 0.60, overfitRatio: 0.88, params: { maFast: 10, maSlow: 30 } },
  ],
  avgTrainSharpe: 2.05,
  avgTestSharpe: 1.53,
  avgTrainReturn: 0.3375,
  avgTestReturn: 0.09,
  avgOverfitRatio: 0.7275,
  stabilityScore: 0.78,
  bestParams: { maFast: 10, maSlow: 30 },
  worstWindow: { index: 2, testReturn: -0.05 },
  bestWindow: { index: 7, testReturn: 0.16 },
};

// ── Sub-components ──────────────────────────────────────────────────────

const OverfitIndicator: React.FC<{ ratio: number }> = ({ ratio }) => {
  const { t: _t } = useTranslation();
  const color = ratio >= 0.85 ? 'bg-emerald-500' : ratio >= 0.7 ? 'bg-amber-500' : ratio >= 0.5 ? 'bg-orange-500' : 'bg-red-500';
  const label = ratio >= 0.85 ? '低' : ratio >= 0.7 ? '中' : ratio >= 0.5 ? '高' : '严重';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px]`}>
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-500">{label}过拟合 ({(ratio * 100).toFixed(0)}%)</span>
    </span>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

interface WalkForwardPanelProps {
  className?: string;
  result?: WFAReport;
  loading?: boolean;
}

export const WalkForwardPanel: React.FC<WalkForwardPanelProps> = ({ className, result: extResult, loading: _loading }) => {
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [showTest, setShowTest] = useState(true);

  const report = extResult ?? MOCK_REPORT;

  // Build chart data
  const chartPoints = useMemo(() => {
    const maxVal = Math.max(
      ...report.windows.map(w => Math.max(w.trainReturn * 100, Math.abs(w.testReturn * 100), 1))
    );
    return report.windows.map(w => ({
      trainY: 70 - (w.trainReturn / (maxVal / 100)) * 60,
      testY: 70 - (Math.max(w.testReturn, -0.2) / (maxVal / 100)) * 60,
      overfitRatio: w.overfitRatio,
      index: w.index,
    }));
  }, [report]);

  // Selected window details
  const selectedW = selectedWindow !== null ? report.windows[selectedWindow] : null;

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            Walk-Forward 分析
            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 5.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {report.totalWindows} 窗口 · 稳定性 {report.stabilityScore.toFixed(2)}
          </p>
        </div>

        {/* Legend toggle */}
        <button
          onClick={() => setShowTest(s => !s)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-gray-200"
        >
          {showTest ? '隐藏测试集' : '显示测试集'}
        </button>
      </div>

      {/* Performance summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {([
          { label: '训练均Sharpe', value: report.avgTrainSharpe.toFixed(2), color: 'text-blue-400' },
          { label: '测试均Sharpe', value: report.avgTestSharpe.toFixed(2), color: 'text-amber-400' },
          { label: '训练均收益', value: `${(report.avgTrainReturn * 100).toFixed(1)}%`, color: 'text-blue-400' },
          { label: '测试均收益', value: `${(report.avgTestReturn * 100).toFixed(1)}%`, color: 'text-amber-400' },
          { label: '过拟合比', value: `${(report.avgOverfitRatio * 100).toFixed(0)}%`, color: report.avgOverfitRatio >= 0.8 ? 'text-emerald-400' : 'text-red-400' },
          { label: '稳定性', value: report.stabilityScore.toFixed(2), color: report.stabilityScore >= 0.7 ? 'text-emerald-400' : 'text-yellow-400' },
          { label: '最佳窗口', value: `#${report.bestWindow.index}`, color: 'text-emerald-400' },
          { label: '最差窗口', value: `#${report.worstWindow.index}`, color: 'text-red-400' },
        ] as const).map(card => (
          <div key={card.label} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 text-center">
            <div className="text-[10px] text-gray-500">{card.label}</div>
            <div className={`text-base font-bold mt-0.5 ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Return comparison chart */}
      <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30 mb-4">
        <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
          多窗口收益对比
        </h4>
        <svg width="100%" height="120" viewBox={`0 0 ${chartPoints.length * 80} 120`}>
          {/* Grid lines */}
          {[10, 30, 50, 70, 90].map(y => (
            <line key={y} x1="0" y1={y} x2={chartPoints.length * 80} y2={y} stroke="#374151" strokeWidth="0.5" />
          ))}
          {/* Zero line */}
          <line x1="0" y1="70" x2={chartPoints.length * 80} y2="70" stroke="#4b5563" strokeWidth="1" strokeDasharray="4,4" />

          {chartPoints.map((p, i) => {
            // Train bars
            return (
              <g key={i}>
                <rect
                  x={i * 80 + 12} y={Math.min(p.trainY, 70)}
                  width={20} height={Math.abs(70 - p.trainY)}
                  fill="#3b82f6" rx={2} opacity={0.6}
                />
                {/* Test bars (overlaid) */}
                {showTest && (
                  <rect
                    x={i * 80 + 36} y={Math.min(p.testY, 70)}
                    width={20} height={Math.abs(70 - p.testY)}
                    fill="#f59e0b" rx={2} opacity={0.7}
                    onClick={() => setSelectedWindow(i)}
                    className="cursor-pointer"
                  />
                )}
                {/* Window label */}
                <text
                  x={i * 80 + 40} y={110}
                  textAnchor="middle"
                  fontSize={9} fill="#6b7280"
                  onClick={() => setSelectedWindow(i)}
                  className="cursor-pointer"
                >
                  W{i}
                </text>
                {/* Overfit indicator dot */}
                <circle
                  cx={i * 80 + 40} cy={105}
                  r={3}
                  fill={p.overfitRatio >= 0.85 ? '#22c55e' : p.overfitRatio >= 0.7 ? '#f59e0b' : '#ef4444'}
                />
              </g>
            );
          })}
        </svg>
        <div className="flex justify-center gap-6 mt-3 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-500/60" /> 训练集收益
          </span>
          {showTest && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500/70" /> 测试集收益
            </span>
          )}
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> 低过拟合
          </span>
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> 高过拟合
          </span>
        </div>
      </div>

      {/* Selected window drill-down */}
      {selectedW && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-amber-400">
              窗口 #{selectedW.index} 详情
            </h4>
            <button
              onClick={() => setSelectedWindow(null)}
              className="text-gray-600 hover:text-gray-400 text-xs"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <div className="text-[10px] text-gray-500">训练区间</div>
              <div className="text-xs text-gray-300">{selectedW.trainStart} → {selectedW.trainEnd}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">测试区间</div>
              <div className="text-xs text-gray-300">{selectedW.testStart} → {selectedW.testEnd}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">训练收益</div>
              <div className="text-xs text-blue-400 font-bold">{(selectedW.trainReturn * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">测试收益</div>
              <div className={`text-xs font-bold ${selectedW.testReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(selectedW.testReturn * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {([
              ['Sharpe', selectedW.trainSharpe.toFixed(2), selectedW.testSharpe.toFixed(2)],
              ['回撤', `${(selectedW.trainMaxDD * 100).toFixed(1)}%`, `${(selectedW.testMaxDD * 100).toFixed(1)}%`],
              [t('components.winRate'), `${(selectedW.trainWinRate * 100).toFixed(0)}%`, `${(selectedW.testWinRate * 100).toFixed(0)}%`],
              ['过拟合比', '', `${(selectedW.overfitRatio * 100).toFixed(0)}%`],
            ] as const).map(([label, train, test]) => (
              <div key={label} className="bg-gray-800/50 rounded p-2 text-center">
                <div className="text-[10px] text-gray-600">{label}</div>
                <div className="text-[10px] text-blue-400/70">{train}</div>
                <div className="text-[10px] text-amber-400">{test || '-'}</div>
              </div>
            ))}
          </div>

          {/* Overfit assessment */}
          <div className="flex items-center gap-2">
            <OverfitIndicator ratio={selectedW.overfitRatio} />
          </div>
        </div>
      )}

      {/* Window summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-700/50">
              <th className="text-left py-2 pr-3">窗口</th>
              <th className="text-left py-2 pr-3">训练Sharpe</th>
              <th className="text-left py-2 pr-3">测试Sharpe</th>
              <th className="text-left py-2 pr-3">测试收益</th>
              <th className="text-left py-2 pr-3">测试回撤</th>
              <th className="text-left py-2">过拟合</th>
            </tr>
          </thead>
          <tbody>
            {report.windows.map(w => (
              <tr
                key={w.index}
                onClick={() => setSelectedWindow(w.index === selectedWindow ? null : w.index)}
                className={`border-b border-gray-700/20 cursor-pointer transition-colors ${
                  selectedWindow === w.index ? 'bg-amber-500/10' : 'hover:bg-gray-800/30'
                }`}
              >
                <td className="py-2 pr-3 text-gray-400">#{w.index}</td>
                <td className="py-2 pr-3 text-blue-400 font-mono">{w.trainSharpe.toFixed(2)}</td>
                <td className="py-2 pr-3 text-amber-400 font-mono">{w.testSharpe.toFixed(2)}</td>
                <td className={`py-2 pr-3 font-mono ${w.testReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(w.testReturn * 100).toFixed(1)}%
                </td>
                <td className="py-2 pr-3 text-red-400/70 font-mono">{(w.testMaxDD * 100).toFixed(1)}%</td>
                <td className="py-2">
                  <OverfitIndicator ratio={w.overfitRatio} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WalkForwardPanel;
