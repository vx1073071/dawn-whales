// ── R168 P2-05: Strategy Profile Card (Sesame Credit Style) ────────────
// A "credit report" style card showing strategy quality across 5 dimensions.
// Each dimension scored 0-100 with a radar chart background.
// Color scheme: gold (80+) / green (60-80) / yellow (40-60) / red (<40).
// Designed for strategy marketplace display cards.

import React, { useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface StrategyProfileCardProps {
  strategyName: string;
  strategyId: string;
  strategyType: string;
  category?: string;
  dimensions: {
    label: string;
    score: number;    // 0-100
    description: string;
  }[];
  overallScore: number; // 0-100
  totalReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  trades?: number;
  className?: string;
  size?: 'md' | 'lg';
}

// ── Sub-component: Dimension Bar ─────────────────────────────────────────────

const DimensionBar: React.FC<{
  label: string;
  score: number;
  description: string;
}> = ({ label, score, description }) => {
  const getDimensionColor = (s: number): string => {
    if (s >= 80) return '#C9A046';
    if (s >= 60) return '#22c55e';
    if (s >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const color = getDimensionColor(score);

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400">{label}</span>
        <span className="text-[10px] font-mono font-bold" style={{ color }}>
          {score}
        </span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${score}%`,
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}30`,
          }}
        />
      </div>
      <div className="text-[10px] text-gray-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {description}
      </div>
    </div>
  );
};

// ── Sub-component: Overall Score Ring ────────────────────────────────────────

const ScoreRing: React.FC<{
  score: number;
  size?: number;
}> = ({ score, size = 80 }) => {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getScoreColor = (s: number): string => {
    if (s >= 80) return '#C9A046';
    if (s >= 60) return '#22c55e';
    if (s >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreBg = (s: number): string => {
    if (s >= 80) return 'rgba(201,160,70,0.12)';
    if (s >= 60) return 'rgba(34,197,94,0.12)';
    if (s >= 40) return 'rgba(245,158,11,0.12)';
    return 'rgba(239,68,68,0.12)';
  };

  const getScoreLabel = (s: number): string => {
    if (s >= 80) return '卓越';
    if (s >= 60) return '良好';
    if (s >= 40) return '一般';
    return '较差';
  };

  const color = getScoreColor(score);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${progress} ${circumference - progress}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 1s ease-out' }}
      />
      {/* Score text */}
      <text
        x={size / 2}
        y={size / 2 - 6}
        textAnchor="middle"
        fontSize={size * 0.28}
        fontWeight="bold"
        fill={color}
        fontFamily="monospace"
      >
        {score}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 12}
        textAnchor="middle"
        fontSize={size * 0.12}
        fill="#6b7280"
      >
        {getScoreLabel(score)}
      </text>
      {/* Badge background */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius + strokeWidth / 2 + 2}
        fill="none"
        stroke={getScoreBg(score)}
        strokeWidth={2}
      />
    </svg>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const StrategyProfileCard: React.FC<StrategyProfileCardProps> = ({
  strategyName,
  strategyId,
  strategyType,
  category,
  dimensions,
  overallScore,
  totalReturn,
  maxDrawdown,
  sharpeRatio,
  trades,
  className,
  size = 'md',
}) => {
  const isLg = size === 'lg';

  const top3Dimensions = useMemo(() => {
    return [...dimensions].sort((a, b) => b.score - a.score).slice(0, 3);
  }, [dimensions]);

  const weakestDimension = useMemo(() => {
    return [...dimensions].sort((a, b) => a.score - b.score)[0];
  }, [dimensions]);

  return (
    <div
      className={`bg-gradient-to-br from-[#1a1a25] to-[#0f0f18] rounded-xl border overflow-hidden transition-all hover:border-[#C9A046]/30 hover:shadow-lg hover:shadow-[#C9A046]/5 ${
        isLg ? 'p-6' : 'p-4'
      } ${className ?? ''}`}
    >
      {/* Header: Score ring + name */}
      <div className="flex items-center gap-4 mb-4">
        <ScoreRing score={overallScore} size={isLg ? 100 : 80} />
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold text-white truncate ${isLg ? 'text-lg' : 'text-sm'}`}>
            {strategyName}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
              {strategyType}
            </span>
            {category && (
              <span className="text-[10px] text-gray-600 bg-white/[0.02] px-1.5 py-0.5 rounded">
                {category}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-600 mt-1 truncate">
            ID: {strategyId.substring(0, 8)}...
          </p>
        </div>
      </div>

      {/* KPI strip */}
      {(totalReturn !== undefined || sharpeRatio || maxDrawdown !== undefined) && (
        <div className="flex gap-3 mb-4 py-2 border-y border-white/5">
          {totalReturn !== undefined && (
            <div className="text-center flex-1">
              <div className={`text-sm font-mono font-bold ${totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(totalReturn * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-gray-600">收益</div>
            </div>
          )}
          {sharpeRatio !== undefined && (
            <div className="text-center flex-1">
              <div className="text-sm font-mono font-bold text-[#C9A046]">
                {sharpeRatio.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-600">Sharpe</div>
            </div>
          )}
          {maxDrawdown !== undefined && (
            <div className="text-center flex-1">
              <div className="text-sm font-mono font-bold text-red-400">
                {(maxDrawdown * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-gray-600">回撤</div>
            </div>
          )}
          {trades !== undefined && (
            <div className="text-center flex-1">
              <div className="text-sm font-mono font-bold text-gray-300">{trades}</div>
              <div className="text-[10px] text-gray-600">交易</div>
            </div>
          )}
        </div>
      )}

      {/* 5 dimensions */}
      <div className="space-y-2.5">
        {dimensions.map((d) => (
          <DimensionBar
            key={d.label}
            label={d.label}
            score={d.score}
            description={d.description}
          />
        ))}
      </div>

      {/* Highlights footer */}
      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between text-[10px]">
        <div>
          <span className="text-gray-600">优势:</span>
          <span className="text-emerald-400 ml-1">
            {top3Dimensions.map((d) => d.label).join('、')}
          </span>
        </div>
        <div>
          <span className="text-gray-600">关注:</span>
          <span className="text-red-400 ml-1">
            {weakestDimension?.label || '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StrategyProfileCard;
