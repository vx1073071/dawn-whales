// @ts-nocheck
// ── R184 ML P0-01: FactorLevelSelector — 三档无门槛切换 ─────────────────
// Three-tier factor level selector: L1 🌱 Essential (常⽤12) → L2 🌿 Advanced (进阶40)
// → L3 🌳 Expert (实验~100). No paywall — pure information tiering.
// One-click switch between levels. Remembers last choice in localStorage.
//
// Design: Level badge + count + description on a horizontal tab bar.
// Color: L1=emerald, L2=amber, L3=purple — distinct from signal colors.

import React, { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type FactorLevel = 'L1' | 'L2' | 'L3';

export interface FactorLevelInfo {
  level: FactorLevel;
  label: string;
  labelCN: string;
  description: string;
  descriptionCN: string;
  emoji: string;
  color: string;
  bgColor: string;
  count: number;             // how many factors in this level
  defaultFor: string[];      // who this level is recommended for
}

interface FactorLevelSelectorProps {
  /** Currently active level */
  activeLevel: FactorLevel;
  /** Called when user switches level */
  onLevelChange: (level: FactorLevel) => void;
  /** Factor counts per level */
  counts?: Partial<Record<FactorLevel, number>>;
  /** Additional CSS class */
  className?: string;
  /** Compact mode (no descriptions, just badges) */
  compact?: boolean;
}

// ── Level Configuration ──────────────────────────────────────────────────────

export const FACTOR_LEVELS: Record<FactorLevel, FactorLevelInfo> = {
  L1: {
    level: 'L1',
    label: 'Essential',
    labelCN: '🌱 常⽤因子',
    description: 'Core factors every trader needs. Covers momentum, value, quality, volatility. ~12 factors, no overwhelm.',
    descriptionCN: '每个投资者需要的核⼼因⼦。覆盖动量、价值、品质、波动。约12个因子，不会眼花缭乱。',
    emoji: '🌱',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
    count: 12,
    defaultFor: ['新手', '快速决策', '每日扫描'],
  },
  L2: {
    level: 'L2',
    label: 'Advanced',
    labelCN: '🌿 进阶因子',
    description: 'Expanded factor library with market-specific and technical factors. ~40 factors for intermediate traders.',
    descriptionCN: '扩展因子库，包含市场专属和技术面因子。约40个因子，适合进阶交易者。',
    emoji: '🌿',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
    count: 40,
    defaultFor: ['进阶交易者', '量化研究者', '策略构建'],
  },
  L3: {
    level: 'L3',
    label: 'Expert',
    labelCN: '🌳 实验因子',
    description: 'Full factor arsenal including experimental, alternative data, and ML-derived factors. ~100+ factors.',
    descriptionCN: '全量因子库，包含实验性、另类数据和机器学习因子。约100+个因子。',
    emoji: '🌳',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.12)',
    count: 100,
    defaultFor: ['量化专家', '深度学习', '学术研究'],
  },
};

const LOCAL_STORAGE_KEY = 'tradingeasy-factor-level';

// ── Level Tab ────────────────────────────────────────────────────────────────

const LevelTab: React.FC<{
  info: FactorLevelInfo;
  isActive: boolean;
  count: number;
  onClick: () => void;
  compact?: boolean;
}> = ({ info, isActive, count, onClick, compact }) => {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-300
        ${isActive
          ? 'border-white/20 shadow-lg'
          : 'border-white/5 hover:border-white/10 hover:bg-white/[0.03]'
        }
      `}
      style={{
        backgroundColor: isActive ? info.bgColor : 'transparent',
        boxShadow: isActive ? `0 0 20px ${info.color}15` : 'none',
      }}
    >
      {/* Level indicator dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{
          backgroundColor: info.color,
          boxShadow: isActive ? `0 0 8px ${info.color}80` : 'none',
        }}
      />

      {/* Label + count */}
      <div className="text-left">
        <div className="flex items-center gap-1.5">
          <span
            className="text-sm font-bold transition-colors"
            style={{ color: isActive ? info.color : '#9ca3af' }}
          >
            {info.labelCN}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold"
            style={{
              backgroundColor: isActive ? info.color + '20' : 'rgba(255,255,255,0.05)',
              color: isActive ? info.color : '#6b7280',
            }}
          >
            {count}
          </span>
        </div>
        {!compact && (
          <div className="text-[10px] text-gray-600 mt-0.5 leading-tight max-w-[180px]">
            {info.descriptionCN.substring(0, 50)}...
          </div>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
          <div className="w-6 h-1 rounded-full" style={{ backgroundColor: info.color }} />
          <div className="w-2 h-1 rounded-full opacity-60" style={{ backgroundColor: info.color }} />
        </div>
      )}
    </button>
  );
};

// ── Quick Summary Bar ────────────────────────────────────────────────────────

const FactorLevelSummary: React.FC<{
  activeLevel: FactorLevel;
  counts: Partial<Record<FactorLevel, number>>;
}> = ({ activeLevel, counts }) => {
  const levels: FactorLevel[] = ['L1', 'L2', 'L3'];

  return (
    <div className="flex items-center gap-1.5">
      {levels.map((lv) => {
        const info = FACTOR_LEVELS[lv];
        const count = counts[lv] ?? info.count;
        const isActive = lv === activeLevel;
        return (
          <div
            key={lv}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] transition-all"
            style={{
              backgroundColor: isActive ? info.bgColor : 'transparent',
              opacity: isActive ? 1 : 0.4,
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: info.color }}
            />
            <span style={{ color: isActive ? info.color : '#6b7280' }}>{lv}</span>
            <span className="font-mono text-gray-600">({count})</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Hook: Persist level selection ────────────────────────────────────────────

export function useFactorLevel(
  defaultLevel: FactorLevel = 'L1'
): [FactorLevel, (level: FactorLevel) => void] {
  const [level, setLevel] = useState<FactorLevel>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved && ['L1', 'L2', 'L3'].includes(saved)) {
        return saved as FactorLevel;
      }
    } catch { /* localStorage unavailable */ }
    return defaultLevel;
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, level);
    } catch { /* localStorage unavailable */ }
  }, [level]);

  return [level, setLevel];
}

// ── Component ────────────────────────────────────────────────────────────────

export const FactorLevelSelector: React.FC<FactorLevelSelectorProps> = ({
  activeLevel,
  onLevelChange,
  counts,
  className,
  compact = false,
}) => {
  const levels: FactorLevel[] = ['L1', 'L2', 'L3'];
  const activeInfo = FACTOR_LEVELS[activeLevel];
  const mergedCounts = {
    L1: counts?.L1 ?? FACTOR_LEVELS.L1.count,
    L2: counts?.L2 ?? FACTOR_LEVELS.L2.count,
    L3: counts?.L3 ?? FACTOR_LEVELS.L3.count,
  };

  return (
    <div className={`${className ?? ''}`}>
      {/* Header with summary */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-300">因子层级</h3>
          {!compact && (
            <span className="text-[10px] text-gray-600">— 无门槛，纯信息分级</span>
          )}
        </div>
        {compact && <FactorLevelSummary activeLevel={activeLevel} counts={mergedCounts} />}
      </div>

      {/* Level tabs */}
      <div className={`flex gap-3 ${compact ? 'flex-row' : ''}`}>
        {levels.map((lv) => (
          <LevelTab
            key={lv}
            info={FACTOR_LEVELS[lv]}
            isActive={lv === activeLevel}
            count={mergedCounts[lv]}
            onClick={() => onLevelChange(lv)}
            compact={compact}
          />
        ))}
      </div>

      {/* Active level details */}
      {!compact && (
        <div
          className="mt-4 p-4 rounded-lg border transition-all"
          style={{
            backgroundColor: activeInfo.bgColor + '40',
            borderColor: activeInfo.color + '20',
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{activeInfo.emoji}</span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-white">{activeInfo.labelCN}</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                  style={{
                    backgroundColor: activeInfo.color + '20',
                    color: activeInfo.color,
                  }}
                >
                  {mergedCounts[activeLevel]} 个因子
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed max-w-[500px]">
                {activeInfo.descriptionCN}
              </p>
              <div className="flex gap-2 mt-2">
                {activeInfo.defaultFor.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: activeInfo.color + '15',
                      color: activeInfo.color,
                      border: `1px solid ${activeInfo.color}30`,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Level transition hint */}
      <div className="mt-2 text-[9px] text-gray-700 text-right">
        点击切换层级 · 当前: {activeInfo.labelCN} · 所有层级完全免费
      </div>
    </div>
  );
};

export default FactorLevelSelector;
