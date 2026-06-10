/**
 * Phase5SummaryPanel — Phase 5.0 summary dashboard with 6-engine KPI cards
 * (ML-41-03, R41 Phase 5.0)
 *
 * Displays:
 * - 6 core engine status cards with health indicators
 * - Phase 5.0 test trend chart (R37→R41)
 * - Deployment history timeline
 * - Phase 4.4 vs 5.0 comparison table
 */

import { useTranslation } from "react-i18next";
import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface EngineKPI {
  name: string;
  phase: string;
  lines: number;
  tests: number;
  status: 'stable' | 'active' | 'beta';
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  addedIn: string;
}

interface TestTrend {
  round: string;
  tests: number;
  phase: string;
}

interface DeployEvent {
  version: string;
  date: string;
  milestone: string;
  tag?: string;
}

// ── Mock data ────────────────────────────────────────────────────────────

const ENGINE_KPIS: EngineKPI[] = [
  { name: 'StrategyOptimizer', phase: '5.0', lines: 814, tests: 27, status: 'stable', p50Latency: 12, p95Latency: 45, p99Latency: 120, addedIn: 'R39' },
  { name: 'MultiTimeframeEngine', phase: '5.0', lines: 656, tests: 37, status: 'stable', p50Latency: 8, p95Latency: 28, p99Latency: 85, addedIn: 'R39' },
  { name: 'PortfolioRiskEngine', phase: '5.0', lines: 695, tests: 27, status: 'stable', p50Latency: 18, p95Latency: 52, p99Latency: 140, addedIn: 'R39' },
  { name: 'LiveTradeBridge', phase: '5.0', lines: 850, tests: 15, status: 'active', p50Latency: 25, p95Latency: 90, p99Latency: 250, addedIn: 'R40' },
  { name: 'WalkForwardEngine', phase: '5.0', lines: 450, tests: 18, status: 'active', p50Latency: 45, p95Latency: 180, p99Latency: 450, addedIn: 'R40' },
  { name: 'StrategyExportImport', phase: '5.0', lines: 620, tests: 22, status: 'stable', p50Latency: 3, p95Latency: 8, p99Latency: 15, addedIn: 'R40' },
];

const TEST_TREND: TestTrend[] = [
  { round: 'R37', tests: 1500, phase: '4.4' },
  { round: 'R38', tests: 1579, phase: '4.4' },
  { round: 'R39', tests: 1775, phase: '5.0' },
  { round: 'R40', tests: 1955, phase: '5.0' },
  { round: 'R41', tests: 2041, phase: '5.0' },
];

const DEPLOY_HISTORY: DeployEvent[] = [
  { version: 'v0.7.0', date: '06-06', milestone: 'Phase 4.3 闭环交易', tag: 'v0.7.0' },
  { version: 'v0.7.0-R38', date: '06-06', milestone: 'AdaptiveParam + Reward + BacktestReplay' },
  { version: 'v0.7.0-R39', date: '06-07', milestone: 'StrategyOptimizer + MultiTimeframe + PortfolioRisk' },
  { version: 'v0.8.0', date: '06-07', milestone: 'LiveTradeBridge + v0.8.0 Release ✅', tag: 'v0.8.0' },
];

// ── Sub-components ──────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: EngineKPI['status'] }> = ({ status }) => {
  const { t } = useTranslation();
  const colors = { stable: 'bg-emerald-500/10 text-emerald-400', active: 'bg-blue-500/10 text-blue-400', beta: 'bg-amber-500/10 text-amber-400' };
  const labels = { stable: '稳定', active: '活跃', beta: t('components.test') };
  return <span className={`px-2 py-0.5 rounded text-[10px] ${colors[status]}`}>{labels[status]}</span>;
};

// ── Main Component ──────────────────────────────────────────────────────

interface Phase5SummaryPanelProps {
  className?: string;
}

export const Phase5SummaryPanel: React.FC<Phase5SummaryPanelProps> = ({ className }) => {
  const [expandedEngine, setExpandedEngine] = useState<string | null>(null);

  const totalLines = useMemo(() => ENGINE_KPIS.reduce((s, e) => s + e.lines, 0), []);
  const totalTests = useMemo(() => ENGINE_KPIS.reduce((s, e) => s + e.tests, 0), []);
  const stableCount = useMemo(() => ENGINE_KPIS.filter(e => e.status === 'stable').length, []);
  const avgP95 = useMemo(() => Math.round(ENGINE_KPIS.reduce((s, e) => s + e.p95Latency, 0) / ENGINE_KPIS.length), []);

  // Test trend SVG
  const trendPoints = useMemo(() => {
    const maxTests = Math.max(...TEST_TREND.map(t => t.tests));
    return TEST_TREND.map((t, i) => ({
      x: (i / (TEST_TREND.length - 1)) * 100,
      y: 60 - ((t.tests - 1400) / (maxTests - 1400)) * 50,
    }));
  }, []);

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            Phase 5.0 总结看板
            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              6引擎 KPI
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            R37 → R41 · {totalLines}L 代码 · {totalTests} tests · {stableCount}/{ENGINE_KPIS.length} 稳定
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {([
          { label: '引擎总数', value: ENGINE_KPIS.length, color: 'text-white' },
          { label: '总代码', value: `${(totalLines / 1000).toFixed(1)}K`, color: 'text-blue-400' },
          { label: '引擎测试', value: totalTests, color: 'text-emerald-400' },
          { label: '均P95延迟', value: `${avgP95}ms`, color: avgP95 < 100 ? 'text-emerald-400' : 'text-amber-400' },
        ] as const).map(c => (
          <div key={c.label} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 text-center">
            <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
            <div className="text-[10px] text-gray-500">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Test trend chart */}
      <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30 mb-4">
        <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
          测试增长趋势 (R37 → R41)
        </h4>
        <svg width="100%" height="90" viewBox="0 0 100 90">
          {/* Grid lines */}
          {[10, 30, 50].map(y => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#374151" strokeWidth="0.5" />
          ))}
          {/* Line */}
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            points={trendPoints.map(p => `${p.x},${p.y}`).join(' ')}
          />
          {/* Dots */}
          {trendPoints.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={3} fill="#f59e0b" />
              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={7} fill="#9ca3af">
                {TEST_TREND[i].tests}
              </text>
              <text x={p.x} y={80} textAnchor="middle" fontSize={7} fill="#6b7280">
                {TEST_TREND[i].round}
              </text>
            </g>
          ))}
        </svg>
        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>Phase 4.4</span>
          <span>Phase 5.0</span>
          <span className="text-amber-400/70">+36% 增长</span>
        </div>
      </div>

      {/* Engine KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {ENGINE_KPIS.map(engine => (
          <div
            key={engine.name}
            onClick={() => setExpandedEngine(expandedEngine === engine.name ? null : engine.name)}
            className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30 cursor-pointer hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{engine.name}</span>
                <StatusBadge status={engine.status} />
              </div>
              <span className="text-[10px] text-gray-600">{engine.addedIn}</span>
            </div>

            <div className="flex items-center gap-4 text-[10px] text-gray-500">
              <span>{engine.lines}L</span>
              <span>{engine.tests} tests</span>
              <span>P95: {engine.p95Latency}ms</span>
            </div>

            {/* Expanded latency details */}
            {expandedEngine === engine.name && (
              <div className="mt-3 pt-3 border-t border-gray-700/30">
                <div className="text-[10px] text-gray-500 mb-2">延迟详解 (ms)</div>
                <div className="flex gap-2">
                  {[
                    { label: 'P50', value: engine.p50Latency, color: 'bg-emerald-500' },
                    { label: 'P95', value: engine.p95Latency, color: 'bg-amber-500' },
                    { label: 'P99', value: engine.p99Latency, color: 'bg-red-500' },
                  ].map(p => (
                    <div key={p.label} className="flex-1 bg-gray-900/50 rounded p-2 text-center">
                      <div className="text-[10px] text-gray-600">{p.label}</div>
                      <div className="text-xs font-mono text-white mt-0.5">{p.value}ms</div>
                      <div className="h-1 mt-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${p.color}`} style={{ width: `${Math.min(p.value / 5, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Deployment timeline */}
      <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
        <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
          部署历史 (Phase 5.0)
        </h4>
        <div className="space-y-0">
          {DEPLOY_HISTORY.map((event, i) => (
            <div key={i} className="flex items-start gap-3 pb-3 relative">
              {/* Timeline line */}
              {i < DEPLOY_HISTORY.length - 1 && (
                <div className="absolute left-[7px] top-5 bottom-0 w-0.5 bg-gray-700" />
              )}
              {/* Dot */}
              <div className={`w-3.5 h-3.5 rounded-full mt-0.5 flex-shrink-0 ${
                event.tag ? 'bg-amber-500 ring-2 ring-amber-500/30' : 'bg-gray-600'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${event.tag ? 'text-amber-400' : 'text-gray-400'}`}>
                    {event.version}
                  </span>
                  {event.tag && (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">🏷 {event.tag}</span>
                  )}
                  <span className="text-[10px] text-gray-600">{event.date}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{event.milestone}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Phase5SummaryPanel;
