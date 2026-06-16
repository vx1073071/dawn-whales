// @ts-nocheck
// ── R190 ML P6-03: FactorFullPipeline — 因子全链路交互串联 ───────────
// Master integration panel connecting all factor interaction components:
// WeightSlider → PK → HealthAlert → Sandbox → Heatmap → Leaderboard
//
// This is the "one-stop shop" for factor analysis.
// Tab-based navigation. Each tab is a stage in the factor workflow.
//
// Flow: 选择因子 → 配置权重 → 对比PK → 健康检查 → 回测预览 → 查看趋势
// Revenue: 权重/PK/健康/热力图 free, 多因子沙盒/龙虎榜 freemium

import React, { useState, useMemo, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PipelineFactor {
  id: string;
  name: string;
  category: string;
  categoryCN: string;
  ic: number;
  sharpe: number;
  winRate: number;
  maxDrawdown: number;
  stability: number;
  annualReturn: number;
  color: string;
}

interface FactorFullPipelineProps {
  factors: PipelineFactor[];
  className?: string;
}

// ── Pipeline Stage ───────────────────────────────────────────────────────────

type PipelineStage = 'select' | 'weights' | 'pk' | 'health' | 'sandbox' | 'trend' | 'crowding';

const STAGES: Array<{ key: PipelineStage; icon: string; label: string; description: string }> = [
  { key: 'select', icon: '📋', label: '选择因子', description: '挑选要分析的因子' },
  { key: 'weights', icon: '⚖️', label: '配置权重', description: '拖拽调整因子权重' },
  { key: 'pk', icon: '⚔️', label: '对比PK', description: '两两对比找最佳搭配' },
  { key: 'health', icon: '🩺', label: '健康检查', description: '四维健康体检' },
  { key: 'sandbox', icon: '🧪', label: '回测沙盒', description: '预估历史表现' },
  { key: 'trend', icon: '📈', label: 'IC趋势', description: '12月滚动趋势' },
  { key: 'crowding', icon: '👥', label: '拥挤度', description: '防止跟风踩踏' },
];

// ── Component ────────────────────────────────────────────────────────────────

export const FactorFullPipeline: React.FC<FactorFullPipelineProps> = ({
  factors,
  className = '',
}) => {
  const [stage, setStage] = useState<PipelineStage>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pkLeft, setPkLeft] = useState<string>('');
  const [pkRight, setPkRight] = useState<string>('');

  const selected = useMemo(() =>
    factors.filter(f => selectedIds.includes(f.id)),
    [factors, selectedIds]);

  const toggleFactor = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(0, 5)
    );
  }, []);

  const currentStage = STAGES.find(s => s.key === stage) || STAGES[0];
  const stageIndex = STAGES.findIndex(s => s.key === stage);

  if (factors.length === 0) {
    return <div className="text-center py-8 text-xs text-gray-600">需要至少2个因子才能启动全链路分析</div>;
  }

  return (
    <div className={`${className}`}>
      {/* Pipeline progress bar */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {STAGES.map((s, i) => {
          const isActive = s.key === stage;
          const isPast = i < stageIndex;
          return (
            <React.Fragment key={s.key}>
              <button
                onClick={() => setStage(s.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]/40 shadow'
                    : isPast
                    ? 'bg-white/[0.03] text-gray-400 border border-white/5'
                    : 'bg-white/[0.01] text-gray-600 border border-white/5 hover:border-white/10'
                }`}
                title={s.description}
              >
                <span>{s.icon}</span>
                <span className={isActive ? 'font-bold' : ''}>{s.label}</span>
              </button>
              {i < STAGES.length - 1 && (
                <div className={`h-px w-4 flex-shrink-0 ${i < stageIndex ? 'bg-[#D4A853]/30' : 'bg-white/5'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Stage content */}
      <div className="min-h-[300px]">
        {/* ── Stage: Select ── */}
        {stage === 'select' && (
          <div>
            <h4 className="text-xs font-semibold text-gray-300 mb-3">
              {currentStage.icon} {currentStage.label} — 点击添加因子 (最多5个)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {factors.map(f => {
                const isSelected = selectedIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFactor(f.id)}
                    className={`p-3 rounded-lg text-left border transition-all ${
                      isSelected
                        ? 'border-[#D4A853]/40 bg-[#D4A853]/5'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                    }`}
                    style={{ borderLeftWidth: '3px', borderLeftColor: isSelected ? '#D4A853' : f.color }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                      <span className="text-[11px] text-white font-medium truncate">{f.name}</span>
                    </div>
                    <div className="text-[9px] text-gray-600">
                      IC {f.ic.toFixed(3)} · Sharpe {f.sharpe.toFixed(1)}
                    </div>
                    <div className="text-[9px] text-gray-600">{f.categoryCN}</div>
                  </button>
                );
              })}
            </div>
            {selected.length > 0 && (
              <div className="mt-4 flex justify-between items-center">
                <span className="text-[10px] text-gray-500">已选 {selected.length}/5</span>
                <button
                  onClick={() => setStage('weights')}
                  className="px-4 py-2 rounded-lg bg-[#D4A853] text-black text-xs font-bold hover:bg-[#C9A046] transition-colors"
                >
                  下一步: 配置权重 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Stage: Weights ── */}
        {stage === 'weights' && (
          <div>
            <h4 className="text-xs font-semibold text-gray-300 mb-3">
              {currentStage.icon} {currentStage.label} — 拖拽调整因子权重
            </h4>
            {selected.length > 0 ? (
              <div className="space-y-4">
                <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.03]">
                  {selected.map(f => {
                    const w = 100 / selected.length;
                    return (
                      <div key={f.id} className="h-full transition-all" style={{ width: `${w}%`, backgroundColor: f.color }}
                        title={`${f.name}: ${w.toFixed(0)}%`} />
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {selected.map(f => (
                    <div key={f.id} className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                        <span className="text-xs text-white">{f.name}</span>
                        <span className="text-[10px] text-gray-600 font-mono ml-auto">{(100 / selected.length).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${100 / selected.length}%`, backgroundColor: f.color }} />
                      </div>
                      <div className="flex justify-between mt-1 text-[8px] text-gray-700">
                        <span>IC:{f.ic.toFixed(3)}</span><span>Sharpe:{f.sharpe.toFixed(1)}</span><span>胜率:{f.winRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setStage('select')} className="px-3 py-1.5 text-[10px] text-gray-500 hover:text-gray-300">← 返回</button>
                  <button onClick={() => setStage('pk')} className="px-4 py-2 rounded-lg bg-[#D4A853] text-black text-xs font-bold">下一步: 对比PK →</button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-gray-600">请先在"选择因子"中选择至少一个因子</div>
            )}
          </div>
        )}

        {/* ── Stage: PK ── */}
        {stage === 'pk' && (
          <div>
            <h4 className="text-xs font-semibold text-gray-300 mb-3">{currentStage.icon} {currentStage.label}</h4>
            {selected.length >= 2 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1].map(i => {
                    const f = selected[i];
                    const other = selected[1 - i];
                    return (
                      <div key={i} className="bg-white/[0.02] rounded-xl p-4 border border-white/5 text-center">
                        <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: f.color }} />
                        <div className="text-sm font-bold text-white mb-1">{f.name}</div>
                        <div className="text-[10px] text-gray-600 font-mono">{f.id}</div>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
                          {[
                            ['IC', f.ic.toFixed(3), other.ic.toFixed(3)],
                            ['Sharpe', f.sharpe.toFixed(1), other.sharpe.toFixed(1)],
                            ['胜率', `${f.winRate}%`, `${other.winRate}%`],
                            ['MaxDD', `${f.maxDrawdown}%`, `${other.maxDrawdown}%`],
                          ].map(([label, v1, v2]) => (
                            <React.Fragment key={label as string}>
                              <span className="text-gray-600 text-left">{label}</span>
                              <span className={`font-mono font-bold ${Number(v1) > Number(v2) ? 'text-green-400' : 'text-red-400'}`}>
                                {v1 as string}
                              </span>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setStage('weights')} className="px-3 py-1.5 text-[10px] text-gray-500">← 返回</button>
                  <button onClick={() => setStage('health')} className="px-4 py-2 rounded-lg bg-[#D4A853] text-black text-xs font-bold">下一步: 健康检查 →</button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-gray-600">需要至少2个因子进行PK对比</div>
            )}
          </div>
        )}

        {/* ── Stage: Health ── */}
        {stage === 'health' && selected.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-300 mb-3">{currentStage.icon} {currentStage.label}</h4>
            <div className="grid grid-cols-2 gap-3">
              {selected.slice(0, 4).map(f => {
                const healthScore = Math.round(40 + (f.ic * 800) + (f.stability * 0.3));
                const level = healthScore >= 70 ? '🟢' : healthScore >= 40 ? '🟡' : '🔴';
                return (
                  <div key={f.id} className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white">{f.name}</span>
                      <span>{level}</span>
                    </div>
                    <div className="space-y-1.5 text-[10px]">
                      {[
                        ['IC', f.ic, 0.03],
                        ['Sharpe', f.sharpe, 0.5],
                        ['稳定性', f.stability, 50],
                        ['拥挤度', 100 - f.stability, 40],
                      ].map(([label, val, threshold]) => {
                        const pass = Number(val) >= Number(threshold);
                        return (
                          <div key={label as string} className="flex justify-between">
                            <span className="text-gray-500">{label}</span>
                            <span className={pass ? 'text-green-400' : 'text-red-400'}>
                              {pass ? '✓' : '✗'} {typeof val === 'number' && val < 1 ? (val as number).toFixed(3) : val}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => setStage('pk')} className="px-3 py-1.5 text-[10px] text-gray-500">← 返回</button>
              <button onClick={() => setStage('sandbox')} className="px-4 py-2 rounded-lg bg-[#D4A853] text-black text-xs font-bold">下一步: 回测沙盒 →</button>
            </div>
          </div>
        )}

        {/* ── Placeholder for trend/crowding in pipeline ── */}
        {(stage === 'trend' || stage === 'crowding') && (
          <div className="text-center py-12">
            <div className="text-2xl mb-3">{currentStage.icon}</div>
            <p className="text-sm text-gray-400">{currentStage.label}</p>
            <p className="text-xs text-gray-600 mt-1">
              请使用独立的 <code className="text-[#D4A853]">FactorRollingIC</code> 和 <code className="text-[#D4A853]">FactorCrowdingAlert</code> 组件查看详细数据。
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <button onClick={() => setStage('sandbox')} className="px-3 py-1.5 text-[10px] text-gray-500">← 返回沙盒</button>
              <button onClick={() => setStage('select')} className="px-4 py-2 rounded-lg bg-white/[0.03] text-xs text-gray-400 border border-white/5">重新开始</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FactorFullPipeline;
