// ── R187 ML P3-03: AdvancedFactorCard — 进阶因子卡片 ──────────────────
// Enhanced factor card for L2 (进阶) factors with extra controls:
// - Parameter adjustment (e.g. lookback period, threshold)
// - Advanced stats (Sharpe, MaxDD, Stability)
// - Correlation hint with parent/child factors
// - "Why advanced?" explanation tooltip
//
// Design: Extends FactorCard with collapsible parameter panel.
// Green highlight for L1 shared info, blue accent for L2 expanded info.

import React, { useState, useCallback } from 'react';
import { FactorSignalLight, type SignalLightData, computeSignalColor } from './FactorSignalLight';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AdvancedFactorData {
  id: string;
  nameCN: string;
  category: string;
  categoryCN: string;
  level: 'L1' | 'L2' | 'L3';
  ic: number;
  sharpe: number;
  winRate: number;
  maxDrawdown: number;
  stability: number;
  zScore?: number;
  isReversing?: boolean;
  dataPoints?: number;
  story: string;
  storyShort: string;
  useCase: string;
  riskWarning: string;
  /** Parameters that users can adjust */
  params?: FactorParam[];
  /** Parent factors this derives from */
  parentFactors?: string[];
  /** Why this is an advanced factor */
  advancedReason: string;
  /** Color for the card accent */
  color?: string;
}

export interface FactorParam {
  id: string;
  name: string;
  description: string;
  type: 'slider' | 'toggle' | 'select';
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: number }[];
  currentValue: number;
}

interface AdvancedFactorCardProps {
  factor: AdvancedFactorData;
  /** Called when a parameter value changes */
  onParamChange?: (factorId: string, paramId: string, value: number) => void;
  /** Show expanded by default */
  defaultExpanded?: boolean;
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export const AdvancedFactorCard: React.FC<AdvancedFactorCardProps> = ({
  factor,
  onParamChange,
  defaultExpanded = false,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showParams, setShowParams] = useState(false);
  const [showStory, setShowStory] = useState(false);

  const signal = computeSignalColor({
    ic: factor.ic,
    zScore: factor.zScore,
    winRate: factor.winRate,
    isReversing: factor.isReversing,
    dataPoints: factor.dataPoints,
  });

  const accentColor = factor.color || '#3b82f6'; // Blue for L2 default
  const levelConfig = {
    L1: { label: '常⽤', emoji: '🌱', color: '#22c55e' },
    L2: { label: '进阶', emoji: '🌿', color: '#3b82f6' },
    L3: { label: '实验', emoji: '🌳', color: '#a855f7' },
  }[factor.level];

  const handleParamChange = useCallback((paramId: string, value: number) => {
    onParamChange?.(factor.id, paramId, value);
  }, [factor.id, onParamChange]);

  return (
    <div
      className={`rounded-xl border transition-all duration-300 overflow-hidden ${className}`}
      style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderColor: expanded ? accentColor + '40' : 'rgba(255,255,255,0.08)',
        boxShadow: expanded ? `0 0 16px ${accentColor}10` : 'none',
      }}
    >
      {/* Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Level badge + expand */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">{factor.nameCN}</span>
            <span className="text-[10px] text-gray-600 font-mono">{factor.id}</span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ backgroundColor: levelConfig.color + '15', color: levelConfig.color, border: `1px solid ${levelConfig.color}30` }}
            >
              {levelConfig.emoji} {levelConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FactorSignalLight data={signal} />
            <span className="text-gray-600 text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="text-gray-600">IC</span>
            <span className={`font-mono font-bold ${factor.ic >= 0.03 ? 'text-green-400' : factor.ic > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {factor.ic.toFixed(3)}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-gray-600">Sharpe</span>
            <span className={`font-mono font-bold ${factor.sharpe >= 1.0 ? 'text-green-400' : factor.sharpe >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
              {factor.sharpe.toFixed(2)}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-gray-600">胜率</span>
            <span className="font-mono text-gray-400">{factor.winRate}%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-gray-600">MaxDD</span>
            <span className={`font-mono ${factor.maxDrawdown <= 20 ? 'text-green-400' : factor.maxDrawdown <= 35 ? 'text-yellow-400' : 'text-red-400'}`}>
              -{factor.maxDrawdown}%
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-gray-600">稳定</span>
            <span className={`font-mono ${factor.stability >= 70 ? 'text-green-400' : factor.stability >= 50 ? 'text-yellow-400' : 'text-gray-500'}`}>
              {factor.stability}/100
            </span>
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          {/* Story */}
          <div
            className="text-[10px] leading-relaxed text-gray-400 cursor-pointer"
            onMouseEnter={() => setShowStory(true)}
            onMouseLeave={() => setShowStory(false)}
          >
            {showStory ? factor.story : factor.storyShort}
            <span className="text-gray-600 ml-1">{showStory ? '(收起)' : '(展开)'}</span>
          </div>

          {/* Why advanced? */}
          <div className="mt-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <p className="text-[10px] text-blue-400/80">
              🌿 <strong>为什么是进阶因子？</strong> {factor.advancedReason}
            </p>
          </div>

          {/* Parent factors */}
          {factor.parentFactors && factor.parentFactors.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-[9px]">
              <span className="text-gray-600">基于:</span>
              {factor.parentFactors.map(p => (
                <span key={p} className="px-1.5 py-0.5 rounded bg-white/[0.03] text-gray-500 font-mono">{p}</span>
              ))}
            </div>
          )}

          {/* Parameters panel */}
          {factor.params && factor.params.length > 0 && (
            <div className="mt-3">
              <button
                onClick={(e) => { e.stopPropagation(); setShowParams(!showParams); }}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
              >
                ⚙️ 参数调节 ({factor.params.length}项) {showParams ? '▲' : '▼'}
              </button>

              {showParams && (
                <div className="mt-2 space-y-3">
                  {factor.params.map(param => (
                    <div key={param.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">{param.name}</span>
                        <span className="text-[10px] font-mono text-white">{param.currentValue}</span>
                      </div>
                      {param.type === 'slider' && (
                        <input
                          type="range"
                          min={param.min ?? 0}
                          max={param.max ?? 100}
                          step={param.step ?? 1}
                          value={param.currentValue}
                          onChange={(e) => handleParamChange(param.id, Number(e.target.value))}
                          className="w-full h-1 accent-[#3b82f6]"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      {param.type === 'toggle' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleParamChange(param.id, param.currentValue ? 0 : 1); }}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
                            param.currentValue ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'bg-white/[0.03] text-gray-600 border border-white/5'
                          }`}
                        >
                          {param.currentValue ? '✓ 开启' : '✗ 关闭'}
                        </button>
                      )}
                      {param.type === 'select' && param.options && (
                        <div className="flex gap-1 flex-wrap">
                          {param.options.map(opt => (
                            <button
                              key={opt.value}
                              onClick={(e) => { e.stopPropagation(); handleParamChange(param.id, opt.value); }}
                              className={`px-2 py-1 rounded text-[10px] transition-colors ${
                                param.currentValue === opt.value
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                  : 'bg-white/[0.03] text-gray-600 border border-white/5 hover:border-white/10'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-[9px] text-gray-700">{param.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Use case + risk */}
          <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-3 text-[10px]">
            <div>
              <span className="text-gray-500">适用场景</span>
              <p className="text-gray-400 mt-0.5">{factor.useCase}</p>
            </div>
            <div>
              <span className="text-gray-500">风险提示</span>
              <p className="text-red-400/70 mt-0.5">{factor.riskWarning}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Demo data for 4 advanced factors ─────────────────────────────────────────

export const ADVANCED_FACTOR_DEMOS: AdvancedFactorData[] = [
  {
    id: 'ROIC', nameCN: 'ROIC (资本回报率)', category: 'quality', categoryCN: '品质', level: 'L2',
    ic: 0.035, sharpe: 0.85, winRate: 56, maxDrawdown: 22, stability: 72,
    zScore: 1.0, story: 'ROIC衡量公司用投资资本赚钱的效率。ROIC>15%且持续提升=公司有护城河。巴菲特最看重的指标之一。与ROE不同，ROIC剔除了杠杆的影响，更能反映真实的经营能力。',
    storyShort: '投资资本的赚钱效率。ROIC>15%=有护城河。', useCase: '选优质公司/排除资本饕餮', riskWarning: '重资产行业ROIC天然偏低，跨行业不可直接比较',
    advancedReason: '需要理解资本结构和非经常性损益对ROIC的影响。配合DCF估值使用效果更佳。',
    parentFactors: ['QUAL', 'RMW'],
    params: [
      { id: 'min_roic', name: '最低ROIC阈值', description: '低于此值的公司被排除', type: 'slider', defaultValue: 10, min: 0, max: 30, step: 1, currentValue: 10 },
      { id: 'use_5yr_avg', name: '使用5年平均', description: '用5年平均ROIC代替单年', type: 'toggle', defaultValue: 1, currentValue: 1 },
    ],
    color: '#3b82f6',
  },
  {
    id: 'PIOTROSKI_F', nameCN: 'Piotroski F-Score', category: 'quality', categoryCN: '品质', level: 'L2',
    ic: 0.030, sharpe: 0.72, winRate: 53, maxDrawdown: 25, stability: 65,
    zScore: 0.5, story: '通过9个财务指标(盈利/杠杆/运营)给公司打分(0-9分)。F-Score≥7=财务健康，≤2=财务困境。专门用来过滤"价值陷阱"——看上去便宜但实际在恶化的公司。',
    storyShort: '9项财务体检。≥7分=健康，≤2=危险。', useCase: '价值股筛选/避开价值陷阱', riskWarning: '基于历史数据，不能预测未来突发风险',
    advancedReason: '9项指标需要专业知识解读。不同行业的正常F-Score范围不同。建议配合行业分析使用。',
    parentFactors: ['HML', 'QUAL'],
    params: [
      { id: 'min_score', name: '最低F-Score', description: '低于此分数的公司被标记为风险', type: 'slider', defaultValue: 6, min: 0, max: 9, step: 1, currentValue: 6 },
    ],
    color: '#6366f1',
  },
  {
    id: 'ANALYST_REVISION', nameCN: '分析师修正', category: 'sentiment', categoryCN: '情绪', level: 'L2',
    ic: 0.040, sharpe: 1.05, winRate: 59, maxDrawdown: 20, stability: 75,
    zScore: 1.2, story: '追踪卖方分析师对EPS预测的上调/下调。分析师集体上调预期=强烈看涨信号。IC约0.04-0.06，美股比港股更显著。机构真金白银的研究结晶。',
    storyShort: '分析师集体上调预期=强烈看涨。IC 0.04-0.06。', useCase: '财报季后追踪分析师调仓', riskWarning: '分析师有乐观偏向（sell评级极少）。关注净上调比例而非绝对数量',
    advancedReason: '需要区分是"跟风型"还是"先行型"修正。小盘股分析师覆盖不足，信号可靠性降低。',
    parentFactors: [],
    params: [
      { id: 'lookback_days', name: '回看天数', description: '统计过去N天的分析师修正', type: 'select', defaultValue: 30,
        options: [{ label: '7天', value: 7 }, { label: '30天', value: 30 }, { label: '90天', value: 90 }],
        currentValue: 30 },
      { id: 'min_analysts', name: '最少分析师数', description: '覆盖分析师少于此数则不计算', type: 'slider', defaultValue: 3, min: 1, max: 20, step: 1, currentValue: 3 },
    ],
    color: '#f59e0b',
  },
  {
    id: 'IV_SKEW', nameCN: 'IV偏度', category: 'sentiment', categoryCN: '情绪', level: 'L2',
    ic: 0.025, sharpe: 0.60, winRate: 50, maxDrawdown: 30, stability: 48,
    zScore: 0.3, story: 'OTM Put IV减去OTM Call IV。正偏度=市场在买保险(恐惧)。负偏度=市场觉得没问题(安逸)。极端偏度往往是反向指标。机构对冲需求的晴雨表。',
    storyShort: 'Put IV - Call IV。正=恐惧(该买)，负=安逸(小心)。', useCase: '市场极端情绪时的反向信号', riskWarning: '不擅长择时，更适合作为风险预警而非交易信号',
    advancedReason: '需要理解期权定价和波动率微笑。偏度变化可能由多种因素驱动（对冲/投机/事件）。建议配合VIX使用。',
    parentFactors: ['OPTION_PCR'],
    params: [
      { id: 'delta', name: '期权Delta', description: '使用的虚值程度', type: 'select', defaultValue: 25,
        options: [{ label: '25 Delta', value: 25 }, { label: '10 Delta (更深虚值)', value: 10 }],
        currentValue: 25 },
    ],
    color: '#ec4899',
  },
];

export default AdvancedFactorCard;
