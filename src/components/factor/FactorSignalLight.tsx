// @ts-nocheck
// ── R185 ML P1-01: FactorSignalLight — 四色信号灯组件 ─────────────────
// 🟢 Green (strong positive) / 🟡 Yellow (neutral) / 🔴 Red (strong negative)
// / ⚪ Gray (insufficient data). Based on QClaw R184 design spec Part C.
//
// Features:
// - 4-color system with CSS variable support
// - Animated pulse for green/red, blink for gray
// - Color-blind friendly: shape + text + arrow triple encoding
// - Compact/expanded modes
// - Tooltip with IC/trend details on hover
// - Dark mode compatible (uses rgba backgrounds)

import React, { useState, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type SignalColor = 'green' | 'yellow' | 'red' | 'gray';

export interface SignalLightData {
  /** Signal color */
  color: SignalColor;
  /** Human-readable label (e.g. "看好", "中性", "看空", "数据不足") */
  label: string;
  /** Current IC value if available */
  ic?: number;
  /** 5-day IC trend direction */
  trend?: 'up' | 'down' | 'flat';
  /** Z-score if available */
  zScore?: number;
  /** Historical win rate (0-100) */
  winRate?: number;
  /** When this signal was last updated */
  lastUpdated?: string;
}

interface FactorSignalLightProps {
  data: SignalLightData;
  /** Show compact version (just the dot, no label) */
  compact?: boolean;
  /** Show expanded details below the dot */
  expanded?: boolean;
  /** Show animated pulse (default true, disable for DND mode) */
  animated?: boolean;
  /** Tooltip detail on hover */
  showTooltip?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Accessibility label override */
  ariaLabel?: string;
}

// ── Signal Configuration ─────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<SignalColor, {
  label: string;
  labelCN: string;
  dotColor: string;
  bgColor: string;
  glowColor: string;
  borderColor: string;
  textColor: string;
  shape: 'circle' | 'diamond' | 'square' | 'dashed-circle';
  arrow: '↑' | '→' | '↓' | '?';
  animation: 'pulse' | 'none' | 'blink' | 'none-dashed';
}> = {
  green: {
    label: 'Strong Positive',
    labelCN: '看好',
    dotColor: '#4CAF50',
    bgColor: 'rgba(76, 175, 80, 0.12)',
    glowColor: 'rgba(76, 175, 80, 0.4)',
    borderColor: '#388E3C',
    textColor: '#2E7D32',
    shape: 'circle',
    arrow: '↑',
    animation: 'pulse',
  },
  yellow: {
    label: 'Neutral',
    labelCN: '中性',
    dotColor: '#FFC107',
    bgColor: 'rgba(255, 193, 7, 0.12)',
    glowColor: 'rgba(255, 193, 7, 0.4)',
    borderColor: '#F9A825',
    textColor: '#F57F17',
    shape: 'diamond',
    arrow: '→',
    animation: 'none',
  },
  red: {
    label: 'Strong Negative',
    labelCN: '看空',
    dotColor: '#F44336',
    bgColor: 'rgba(244, 67, 54, 0.12)',
    glowColor: 'rgba(244, 67, 54, 0.4)',
    borderColor: '#D32F2F',
    textColor: '#C62828',
    shape: 'square',
    arrow: '↓',
    animation: 'pulse',
  },
  gray: {
    label: 'Insufficient Data',
    labelCN: '数据不足',
    dotColor: '#9E9E9E',
    bgColor: 'rgba(158, 158, 158, 0.12)',
    glowColor: 'rgba(158, 158, 158, 0.2)',
    borderColor: '#757575',
    textColor: '#616161',
    shape: 'dashed-circle',
    arrow: '?',
    animation: 'blink',
  },
};

// ── Shape Renderer ───────────────────────────────────────────────────────────

const SignalShape: React.FC<{
  config: typeof SIGNAL_CONFIG[keyof typeof SIGNAL_CONFIG];
  animated: boolean;
}> = ({ config, animated }) => {
  const shouldAnimate = animated && config.animation !== 'none';
  const animClass = shouldAnimate
    ? config.animation === 'pulse' ? 'animate-pulse' : 'animate-blink'
    : '';

  const baseStyle: React.CSSProperties = {
    backgroundColor: config.dotColor,
    boxShadow: `0 0 8px ${config.glowColor}`,
    transition: 'background-color 0.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  switch (config.shape) {
    case 'diamond':
      return (
        <div className={`w-4 h-4 ${animClass}`} style={{
          ...baseStyle,
          transform: 'rotate(45deg)',
          borderRadius: '2px',
        }} />
      );
    case 'square':
      return (
        <div className={`w-4 h-4 ${animClass}`} style={{
          ...baseStyle,
          borderRadius: '2px',
        }} />
      );
    case 'dashed-circle':
      return (
        <div className={`w-4 h-4 ${animClass}`} style={{
          border: `2px dashed ${config.dotColor}`,
          borderRadius: '50%',
          backgroundColor: 'transparent',
          boxShadow: 'none',
        }} />
      );
    default: // circle
      return (
        <div className={`w-4 h-4 ${animClass} rounded-full`} style={baseStyle} />
      );
  }
};

// ── Tooltip Popover ──────────────────────────────────────────────────────────

const SignalTooltip: React.FC<{ data: SignalLightData; config: typeof SIGNAL_CONFIG[keyof typeof SIGNAL_CONFIG] }> = ({ data, config }) => (
  <div className="absolute z-50 left-full ml-2 top-0 w-[220px] bg-[#1a1a25] border border-white/10 rounded-lg p-3 shadow-2xl text-[10px]">
    <div className="flex items-center justify-between mb-2">
      <span className="text-white font-medium text-xs">
        {config.labelCN} {config.arrow}
      </span>
      <span
        className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
        style={{ backgroundColor: config.bgColor, color: config.dotColor }}
      >
        {config.label}
      </span>
    </div>
    <div className="space-y-1.5">
      {data.ic !== undefined && (
        <div className="flex justify-between">
          <span className="text-gray-500">当前IC</span>
          <span className="text-white font-mono">{data.ic.toFixed(4)}</span>
        </div>
      )}
      {data.zScore !== undefined && (
        <div className="flex justify-between">
          <span className="text-gray-500">Z-Score</span>
          <span className={`font-mono ${
            data.zScore > 1.5 ? 'text-green-400' :
            data.zScore < -1.5 ? 'text-red-400' :
            'text-yellow-400'
          }`}>
            {data.zScore > 0 ? '+' : ''}{data.zScore.toFixed(2)}
          </span>
        </div>
      )}
      {data.trend && (
        <div className="flex justify-between">
          <span className="text-gray-500">5日趋势</span>
          <span className={
            data.trend === 'up' ? 'text-green-400' :
            data.trend === 'down' ? 'text-red-400' :
            'text-gray-400'
          }>
            {data.trend === 'up' ? '↑ 上升' : data.trend === 'down' ? '↓ 下降' : '→ 持平'}
          </span>
        </div>
      )}
      {data.winRate !== undefined && (
        <div className="flex justify-between">
          <span className="text-gray-500">历史胜率</span>
          <span className="text-white font-mono">{data.winRate}%</span>
        </div>
      )}
      {data.lastUpdated && (
        <div className="flex justify-between">
          <span className="text-gray-500">更新时间</span>
          <span className="text-gray-400">{data.lastUpdated}</span>
        </div>
      )}
    </div>
  </div>
);

// ── Component ────────────────────────────────────────────────────────────────

export const FactorSignalLight: React.FC<FactorSignalLightProps> = ({
  data,
  compact = false,
  expanded = false,
  animated = true,
  showTooltip = true,
  className = '',
  ariaLabel,
}) => {
  const config = SIGNAL_CONFIG[data.color];
  const [showDetails, setShowDetails] = useState(false);

  const aria = ariaLabel || `因子信号: ${config.labelCN}, ${data.ic !== undefined ? `IC ${data.ic.toFixed(3)}, ` : ''}${data.trend ? `${data.trend === 'up' ? '上升' : data.trend === 'down' ? '下降' : '持平'}趋势` : ''}`;

  if (compact) {
    // ── Compact: just the shape dot ──
    return (
      <span
        className={`inline-flex items-center relative ${className}`}
        title={`${config.labelCN}${data.ic !== undefined ? ` IC:${data.ic.toFixed(3)}` : ''}`}
        role="status"
        aria-label={aria}
      >
        <SignalShape config={config} animated={animated} />
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all relative ${className}`}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor + '40',
      }}
      onMouseEnter={() => showTooltip && setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
      role="status"
      aria-label={aria}
    >
      {/* Shape dot */}
      <SignalShape config={config} animated={animated} />

      {/* Label + arrow */}
      <span className="flex items-center gap-1">
        <span
          className="text-xs font-bold"
          style={{ color: config.textColor }}
        >
          {config.labelCN}
        </span>
        <span
          className="text-[11px] font-bold"
          style={{ color: config.dotColor }}
        >
          {config.arrow}
        </span>
      </span>

      {/* IC badge (if expanded) */}
      {expanded && data.ic !== undefined && (
        <span className="text-[10px] font-mono text-gray-400 ml-1">
          IC:{data.ic.toFixed(3)}
        </span>
      )}

      {/* Tooltip */}
      {showDetails && showTooltip && (
        <SignalTooltip data={data} config={config} />
      )}
    </div>
  );
};

// ── Utility: Compute signal from numeric values ──────────────────────────────

export function computeSignalColor(params: {
  ic?: number;
  zScore?: number;
  winRate?: number;
  isReversing?: boolean;
  dataPoints?: number;
  daysSinceAdded?: number;
}): SignalLightData {
  const { ic, zScore, winRate, isReversing, dataPoints = 100, daysSinceAdded = 30 } = params;

  // Insufficient data check
  if (dataPoints < 20 || daysSinceAdded < 7) {
    return {
      color: 'gray',
      label: '数据不足',
      ic,
      lastUpdated: new Date().toLocaleString('zh-CN'),
    };
  }

  // Check strong positive
  const strongPositive =
    (ic !== undefined && ic > 0.04 && !isReversing) ||
    (zScore !== undefined && zScore > 1.5) ||
    (winRate !== undefined && winRate > 65);

  if (strongPositive) {
    return {
      color: 'green',
      label: '看好',
      ic,
      trend: ic !== undefined ? 'up' : undefined,
      zScore,
      winRate,
      lastUpdated: new Date().toLocaleString('zh-CN'),
    };
  }

  // Check strong negative
  const strongNegative =
    (ic !== undefined && ic < 0.01) ||
    (zScore !== undefined && zScore < -1.5) ||
    (winRate !== undefined && winRate < 45) ||
    isReversing;

  if (strongNegative) {
    return {
      color: 'red',
      label: '看空',
      ic,
      trend: 'down',
      zScore,
      winRate,
      lastUpdated: new Date().toLocaleString('zh-CN'),
    };
  }

  // Default: neutral
  return {
    color: 'yellow',
    label: '中性',
    ic,
    trend: ic !== undefined && ic > 0.02 ? 'flat' : 'flat',
    zScore,
    winRate,
    lastUpdated: new Date().toLocaleString('zh-CN'),
  };
}

// ── Utility: Compute aggregate signal for a scenario pack ────────────────────

export function computePackSignal(
  factorSignals: Array<{ color: SignalColor; weight: number }>
): SignalLightData {
  const colorToScore: Record<SignalColor, number> = {
    green: 2, yellow: 1, red: 0, gray: -1,
  };

  let totalWeight = 0;
  let weightedSum = 0;
  let grayCount = 0;

  for (const fs of factorSignals) {
    if (fs.color === 'gray') {
      grayCount++;
      continue; // Exclude gray from weighting
    }
    const score = colorToScore[fs.color];
    weightedSum += score * fs.weight;
    totalWeight += fs.weight;
  }

  // If more than 50% are gray → insufficient data
  if (grayCount > factorSignals.length * 0.5) {
    return { color: 'gray', label: '数据不足' };
  }

  if (totalWeight === 0) {
    return { color: 'gray', label: '数据不足' };
  }

  const avg = weightedSum / totalWeight;

  if (avg >= 1.6) return { color: 'green', label: '看好' };
  if (avg >= 0.8) return { color: 'yellow', label: '中性' };
  return { color: 'red', label: '看空' };
}

export default FactorSignalLight;
