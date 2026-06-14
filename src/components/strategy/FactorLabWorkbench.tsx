// ── R173 C1: FactorLab Unified Workbench ─────────────────────────────────
// A unified workspace for factor research, replacing scattered individual pages.
//
// Layout:
//   Left Panel: Factor Library (search, filter by category, drag to workspace)
//   Center: Workspace (selected factors, weight sliders, mini backtest)
//   Right Panel: Live feedback (IC chart, correlation warning, optimization tips)
//   Bottom Bar: Progress indicator + apply/save buttons
//
// Design: collapsible panels, dark theme, responsive breakpoints.

import React, { useState, useMemo, useCallback } from 'react';
import * as echarts from 'echarts';
import { useFactorChineseNames } from './useFactorChineseNames';

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceFactor {
  factorId: string;
  nameCN: string;
  category: string;
  weight: number;
  ic: number;
}

// ── Factor library data ──────────────────────────────────────────────────────

const FACTOR_LIBRARY: Array<{
  factorId: string;
  nameCN: string;
  category: string;
  ic: number;
  description: string;
}> = [
  { factorId: 'MKT', nameCN: '市场Beta', category: '宏观', ic: 0.055, description: '市场敏感度' },
  { factorId: 'MOM_12M', nameCN: '12月动量', category: '动量', ic: 0.045, description: '中期趋势信号' },
  { factorId: 'HML', nameCN: '价值因子', category: '价值', ic: 0.035, description: 'BP估值溢价' },
  { factorId: 'VOL_60D', nameCN: '60日低波', category: '波动', ic: -0.040, description: '防御性因子' },
  { factorId: 'QUAL', nameCN: '品质因子', category: '品质', ic: 0.040, description: '高质量企业' },
  { factorId: 'SMB', nameCN: '小盘因子', category: '规模', ic: 0.018, description: '小市值溢价' },
  { factorId: 'LIQ', nameCN: '流动性', category: '宏观', ic: 0.025, description: '交易活跃度' },
  { factorId: 'YIELD', nameCN: '股息率', category: '价值', ic: 0.028, description: '分红收益' },
  { factorId: 'RMW', nameCN: '盈利能力', category: '品质', ic: 0.032, description: '毛利筛选' },
  { factorId: 'CMA', nameCN: '投资因子', category: '品质', ic: 0.015, description: '低capex溢价' },
  { factorId: 'RSI_14', nameCN: 'RSI', category: '动量', ic: 0.022, description: '超买超卖' },
  { factorId: 'ADX', nameCN: 'ADX趋势', category: '趋势', ic: 0.020, description: '趋势强度' },
];

const CATEGORIES = ['全部', '动量', '价值', '品质', '波动', '宏观', '趋势', '规模'];

// ── Progress Bar (bottom) ────────────────────────────────────────────────────

const WorkbenchProgress: React.FC<{
  factors: WorkspaceFactor[];
  totalWeight: number;
}> = ({ factors, totalWeight }) => {
  const segments = factors.map((f) => ({
    name: f.nameCN,
    pct: f.weight,
    color: f.ic > 0.03 ? '#22c55e' : f.ic > 0 ? '#f59e0b' : '#ef4444',
  }));

  return (
    <div className="bg-gray-900/80 border-t border-gray-800 px-4 py-2">
      <div className="flex items-center gap-3 text-xs">
        <span className="text-gray-500">权重分配</span>
        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden flex">
          {segments.map((s, i) => (
            <div
              key={i}
              className="h-full transition-all"
              style={{
                width: `${(s.pct / 100) * 100}%`,
                backgroundColor: s.color,
              }}
              title={`${s.name}: ${s.pct}%`}
            />
          ))}
        </div>
        <span className={`font-mono font-bold ${totalWeight === 100 ? 'text-green-400' : 'text-red-400'}`}>
          {totalWeight}%
        </span>
        <span className="text-gray-600">| 因子数: {factors.length}</span>
      </div>
    </div>
  );
};

// ── IC Comparison Mini Chart (right panel) ───────────────────────────────────

const ICMiniChart: React.FC<{
  factors: WorkspaceFactor[];
}> = ({ factors }) => {
  const chartRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!chartRef.current || factors.length === 0) return;
    const chart = echarts.init(chartRef.current, undefined, { renderer: 'svg' });
    chart.setOption({
      grid: { left: 50, right: 10, top: 10, bottom: 30 },
      xAxis: {
        type: 'category',
        data: factors.map((f) => f.nameCN),
        axisLabel: { color: '#9ca3af', fontSize: 9, rotate: 30 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      yAxis: {
        type: 'value',
        name: 'IC',
        nameTextStyle: { color: '#6b7280', fontSize: 9 },
        axisLabel: { color: '#9ca3af', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        {
          type: 'bar',
          data: factors.map((f) => ({
            value: f.ic,
            itemStyle: {
              color: f.ic > 0.03 ? '#22c55e' : f.ic > 0 ? '#f59e0b' : '#ef4444',
            },
          })),
        },
      ],
    });
    return () => chart.dispose();
  }, [factors]);

  return <div ref={chartRef} style={{ width: '100%', height: '180px' }} />;
};

// ── Main Component ────────────────────────────────────────────────────────────

export const FactorLabWorkbench: React.FC = () => {
  const cn = useFactorChineseNames();
  const [workspaceFactors, setWorkspaceFactors] = useState<WorkspaceFactor[]>([]);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');

  const totalWeight = workspaceFactors.reduce((s, f) => s + f.weight, 0);
  const scaledWeight = totalWeight > 0
    ? workspaceFactors.map((f) => ({
        ...f,
        displayWeight: Math.round((f.weight / totalWeight) * 100),
      }))
    : workspaceFactors;

  // Filter library
  const filteredLibrary = useMemo(() => {
    let items = FACTOR_LIBRARY;
    if (activeCategory !== '全部') {
      items = items.filter((f) => f.category === activeCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (f) =>
          f.nameCN.toLowerCase().includes(q) ||
          f.factorId.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q),
      );
    }
    return items;
  }, [activeCategory, searchQuery]);

  // Add factor to workspace
  const addFactor = useCallback(
    (f: typeof FACTOR_LIBRARY[0]) => {
      setWorkspaceFactors((prev) => {
        if (prev.some((wf) => wf.factorId === f.factorId)) return prev;
        return [...prev, { factorId: f.factorId, nameCN: f.nameCN, category: f.category, weight: 10, ic: f.ic }];
      });
    },
    [],
  );

  // Remove factor
  const removeFactor = useCallback((factorId: string) => {
    setWorkspaceFactors((prev) => prev.filter((f) => f.factorId !== factorId));
  }, []);

  // Adjust weight
  const adjustWeight = useCallback((factorId: string, delta: number) => {
    setWorkspaceFactors((prev) =>
      prev.map((f) =>
        f.factorId === factorId
          ? { ...f, weight: Math.max(0, Math.min(60, f.weight + delta)) }
          : f,
      ),
    );
  }, []);

  // Apply preset
  const applyPreset = useCallback((preset: 'momentum' | 'value' | 'defensive') => {
    const presets: Record<string, WorkspaceFactor[]> = {
      momentum: [
        { factorId: 'MOM_12M', nameCN: '12月动量', category: '动量', weight: 45, ic: 0.045 },
        { factorId: 'MKT', nameCN: '市场Beta', category: '宏观', weight: 30, ic: 0.055 },
        { factorId: 'LIQ', nameCN: '流动性', category: '宏观', weight: 25, ic: 0.025 },
      ],
      value: [
        { factorId: 'HML', nameCN: '价值因子', category: '价值', weight: 40, ic: 0.035 },
        { factorId: 'QUAL', nameCN: '品质因子', category: '品质', weight: 35, ic: 0.040 },
        { factorId: 'YIELD', nameCN: '股息率', category: '价值', weight: 25, ic: 0.028 },
      ],
      defensive: [
        { factorId: 'VOL_60D', nameCN: '60日低波', category: '波动', weight: 45, ic: -0.040 },
        { factorId: 'QUAL', nameCN: '品质因子', category: '品质', weight: 35, ic: 0.040 },
        { factorId: 'YIELD', nameCN: '股息率', category: '价值', weight: 20, ic: 0.028 },
      ],
    };
    setWorkspaceFactors(presets[preset] || []);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-deep">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80">
        <h1 className="text-lg font-bold text-white">🧪 FactorLab 工作台</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="text-[10px] text-gray-400 hover:text-white px-2 py-1 rounded border border-gray-700"
          >
            {leftCollapsed ? '▶ 库' : '◀ 库'}
          </button>
          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            className="text-[10px] text-gray-400 hover:text-white px-2 py-1 rounded border border-gray-700"
          >
            {rightCollapsed ? '◀ 反馈' : '▶ 反馈'}
          </button>
          <span className="text-[10px] text-gray-600">快捷键: Ctrl+1~4 预设方案</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Factor Library */}
        {!leftCollapsed && (
          <div className="w-[240px] border-r border-gray-800 overflow-y-auto p-3 flex-shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索因子..."
              className="w-full bg-white/[0.04] border border-white/5 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/30 mb-2"
            />
            <div className="flex flex-wrap gap-1 mb-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[9px] px-2 py-0.5 rounded-full transition-all ${
                    activeCategory === cat
                      ? 'bg-[#C9A046]/20 text-[#C9A046] border border-[#C9A046]/30'
                      : 'bg-white/[0.03] text-gray-500 border border-white/5 hover:text-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              {filteredLibrary.map((f) => {
                const inWorkspace = workspaceFactors.some((wf) => wf.factorId === f.factorId);
                return (
                  <button
                    key={f.factorId}
                    onClick={() => !inWorkspace && addFactor(f)}
                    disabled={inWorkspace}
                    className={`w-full text-left px-2 py-2 rounded text-xs transition-all border ${
                      inWorkspace
                        ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400/60'
                        : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04] hover:border-white/5 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{f.nameCN}</span>
                      <span className={`font-mono text-[10px] ${f.ic > 0.03 ? 'text-green-400' : 'text-yellow-400'}`}>
                        IC: {f.ic.toFixed(3)}
                      </span>
                    </div>
                    {inWorkspace && (
                      <span className="text-[9px] text-emerald-400">✓ 已添加</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Center: Workspace */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Preset buttons */}
          <div className="flex gap-2 text-xs">
            <button onClick={() => applyPreset('momentum')} className="px-3 py-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20">
              🚀 动量型
            </button>
            <button onClick={() => applyPreset('value')} className="px-3 py-1.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20">
              💎 价值型
            </button>
            <button onClick={() => applyPreset('defensive')} className="px-3 py-1.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20">
              🛡️ 防御型
            </button>
          </div>

          {/* Workspace factors */}
          {scaledWeight.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <div className="text-4xl mb-3">🧪</div>
              <p className="text-sm">从左侧因子库选择因子开始</p>
              <p className="text-[10px] mt-1">或点击上方预设方案快速开始</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-300">选中因子 ({scaledWeight.length})</h3>
              {workspaceFactors.map((f) => {
                const effectiveWeight = Math.round((f.weight / totalWeight) * 100);
                return (
                  <div key={f.factorId} className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-white text-sm font-bold">{f.nameCN}</span>
                        <span className="ml-2 text-[10px] text-gray-500">{cn.getCategory(f.factorId)}</span>
                      </div>
                      <button onClick={() => removeFactor(f.factorId)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => adjustWeight(f.factorId, -5)} className="text-gray-400 hover:text-white text-xs">−</button>
                      <div className="flex-1">
                        <input
                          type="range"
                          min={0}
                          max={60}
                          value={f.weight}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setWorkspaceFactors((prev) =>
                              prev.map((wf) => (wf.factorId === f.factorId ? { ...wf, weight: v } : wf)),
                            );
                          }}
                          className="w-full"
                        />
                      </div>
                      <button onClick={() => adjustWeight(f.factorId, 5)} className="text-gray-400 hover:text-white text-xs">+</button>
                      <span className="w-12 text-right text-sm font-mono text-[#C9A046]">{effectiveWeight}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel: Feedback */}
        {!rightCollapsed && workspaceFactors.length > 0 && (
          <div className="w-[260px] border-l border-gray-800 overflow-y-auto p-3 flex-shrink-0 space-y-3">
            <h3 className="text-xs font-semibold text-gray-300">📊 实时反馈</h3>
            <ICMiniChart factors={scaledWeight} />
            <div className="space-y-2 text-[10px]">
              {workspaceFactors.map((f) => (
                <div key={f.factorId} className="flex justify-between">
                  <span className="text-gray-400">{f.nameCN}</span>
                  <span className="font-mono">
                    <span className={f.ic > 0.03 ? 'text-green-400' : 'text-yellow-400'}>IC {f.ic.toFixed(3)}</span>
                    <span className="mx-2 text-gray-600">·</span>
                    <span className="text-[#C9A046]">权重 {Math.round((f.weight / totalWeight) * 100)}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Progress + Actions */}
      <WorkbenchProgress factors={workspaceFactors} totalWeight={totalWeight} />
    </div>
  );
};

export default FactorLabWorkbench;
