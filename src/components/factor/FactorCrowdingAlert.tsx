// @ts-nocheck
// ── R190 ML P6-02: FactorCrowdingAlert — 拥挤度仪表盘 ────────────────
// Visualizes factor crowding risk across 4 dimensions:
// 1. Valuation spread (how far current value from historical)
// 2. Holdings concentration (top holders % of total)
// 3. Turnover acceleration (recent vs avg turnover rate)
// 4. Fund flow (capital moving in/out of factor strategies)
//
// Each dimension gets a gauge + alert level.
// Overall crowding score from 0-100%.
// "Gold rush" metaphor: 80%+ = everyone's already there, run!

import React, { useState, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CrowdingDimension {
  key: 'valuation' | 'concentration' | 'turnover' | 'fund_flow';
  label: string;
  icon: string;
  value: number;       // 0-100 (higher = more crowded)
  level: 'low' | 'moderate' | 'high' | 'extreme';
  detail: string;
}

interface FactorCrowdingAlertProps {
  factorName: string;
  factorId: string;
  dimensions: CrowdingDimension[];
  overallScore: number;  // 0-100
  className?: string;
}

// ── Level config ──────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  low: { label: '宽松', emoji: '🟢', color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)', text: '拥挤度低，Alpha空间充足' },
  moderate: { label: '温和', emoji: '🟡', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)', text: '适中拥挤，需关注' },
  high: { label: '拥挤', emoji: '🟠', color: '#f97316', bgColor: 'rgba(249,115,22,0.08)', text: '拥挤度偏高，Alpha在衰减' },
  extreme: { label: '极度', emoji: '🔴', color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)', text: '极度拥挤！Alpha可能已经消失' },
};

function getLevel(score: number): typeof LEVEL_CONFIG['low'] {
  if (score >= 80) return LEVEL_CONFIG.extreme;
  if (score >= 60) return LEVEL_CONFIG.high;
  if (score >= 35) return LEVEL_CONFIG.moderate;
  return LEVEL_CONFIG.low;
}

// ── Gauge ring ───────────────────────────────────────────────────────────────

const GaugeRing: React.FC<{
  value: number;
  size?: number;
  level: 'low' | 'moderate' | 'high' | 'extreme';
}> = ({ value, size = 60, level }) => {
  const cfg = LEVEL_CONFIG[level];
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={cfg.color} strokeWidth="4"
          strokeDasharray={`${circumference}`} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <span className="text-sm font-bold text-white z-10">{value}%</span>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const FactorCrowdingAlert: React.FC<FactorCrowdingAlertProps> = ({
  factorName,
  factorId,
  dimensions,
  overallScore,
  className = '',
}) => {
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const overallLevel = getLevel(overallScore);

  const metaphor = useMemo(() => {
    if (overallScore >= 80) return { emoji: '🏃‍♂️💨', text: '淘金热！所有人都在这里了——晚来的赚不到钱了。' };
    if (overallScore >= 60) return { emoji: '👥', text: '人有点多了。Alpha在缩小，但还是能赚钱。' };
    if (overallScore >= 35) return { emoji: '🚶‍♂️', text: '有几个人在，但还没挤。空间还很够。' };
    return { emoji: '🏜️', text: '几乎没人注意到这里。Alpha还没被开发。' };
  }, [overallScore]);

  return (
    <div className={`rounded-xl border p-4 ${className}`}
      style={{ backgroundColor: overallLevel.bgColor + '30', borderColor: overallLevel.color + '40' }}>
      {/* Header with overall gauge */}
      <div className="flex items-center gap-4 mb-4">
        <GaugeRing value={overallScore} level={overallLevel.level} size={64} />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-white">{factorName}</span>
            <span className="text-[10px] text-gray-600 font-mono">{factorId}</span>
          </div>
          <div>
            <span className="text-xs font-bold" style={{ color: overallLevel.color }}>
              {overallLevel.emoji} {overallLevel.label}: {overallScore}%
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">{overallLevel.text}</p>
          <div className="flex items-center gap-1 mt-1 text-lg">{metaphor.emoji}</div>
          <p className="text-[10px] text-gray-400 italic">{metaphor.text}</p>
        </div>
      </div>

      {/* 4 dimension bars */}
      <div className="space-y-3">
        {dimensions.map(dim => {
          const dLevel = getLevel(dim.value);
          const isExpanded = expandedDim === dim.key;
          return (
            <div key={dim.key} className="space-y-1">
              <div
                className="flex items-center justify-between text-[10px] cursor-pointer"
                onClick={() => setExpandedDim(isExpanded ? null : dim.key)}
              >
                <span className="text-gray-500">{dim.icon} {dim.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white">{dim.value}%</span>
                  <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: dLevel.color + '15', color: dLevel.color }}>
                    {dLevel.emoji} {dLevel.label}
                  </span>
                </div>
              </div>
              {/* Bar */}
              <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${dim.value}%`, backgroundColor: dLevel.color }}
                />
              </div>
              {/* Scale markers */}
              <div className="flex justify-between text-[7px] text-gray-700 px-px">
                <span>0% 空旷</span>
                <span>35%</span>
                <span>60%</span>
                <span>80% 拥挤</span>
                <span>100% 爆满</span>
              </div>
              {/* Expanded detail */}
              {isExpanded && (
                <p className="text-[9px] text-gray-400 mt-1 pl-1">{dim.detail}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Call-to-action */}
      {overallScore >= 60 && (
        <div className="mt-4 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
          <p className="text-[10px] text-orange-400/90">
            ⚠️ 该因子拥挤度偏高。建议：
          </p>
          <ul className="text-[9px] text-gray-400 mt-1 space-y-0.5 pl-3">
            <li>• 降低该因子权重至组合的15%以下</li>
            <li>• 寻找低相关性替代因子（用FactorPK对比）</li>
            <li>• 增加反向因子对冲（如BAB对冲动量）</li>
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Demo data ────────────────────────────────────────────────────────────────

export function generateDemoCrowdingData(factorId: string, factorName: string): {
  dimensions: CrowdingDimension[];
  overallScore: number;
} {
  const seed = factorId.charCodeAt(0) * 7 + factorId.length * 13;
  const dims: CrowdingDimension[] = [
    {
      key: 'valuation', label: '估值溢价', icon: '💎',
      value: 15 + (seed % 80), level: 'low',
      detail: '当前因子估值处于历史65%分位——不算便宜但也不算贵。历史均值附近。',
    },
    {
      key: 'concentration', label: '持仓集中', icon: '📊',
      value: 10 + ((seed * 2) % 85), level: 'moderate',
      detail: 'Top 10持有者占该因子市值的42%，集中度中等。尚未出现"拥挤交易"现象。',
    },
    {
      key: 'turnover', label: '换手加速', icon: '🔄',
      value: 5 + ((seed * 3) % 90), level: 'low',
      detail: '近期换手率处于12月均值的1.1倍——交易频率正常，无异常加速。',
    },
    {
      key: 'fund_flow', label: '资金流向', icon: '💰',
      value: 8 + ((seed * 4) % 88), level: 'low',
      detail: '过去4周净流入$2.3B，资金温和流入。未出现"追逐交易"的急剧流入。',
    },
  ];

  // Correct levels
  for (const d of dims) {
    if (d.value >= 80) d.level = 'extreme';
    else if (d.value >= 60) d.level = 'high';
    else if (d.value >= 35) d.level = 'moderate';
    else d.level = 'low';
  }

  const overallScore = Math.round(dims.reduce((s, d) => s + d.value, 0) / dims.length);

  return { dimensions: dims, overallScore };
}

export default FactorCrowdingAlert;
