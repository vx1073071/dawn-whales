// ── R172 B2: Progressive Disclosure Controller ───────────────────────────
// Controls how much factor information is visible at each level.
// Users can toggle between 4 disclosure levels:
//   L1 一眼概括: Only the summary line (e.g., "动量因子贡献最大 32.5%")
//   L2 核心指标: + R², top 3 factors with contribution%
//   L3 详细分析: + all factors, IC values, loading betas, radar chart
//   L4 全量数据: + p-values, t-statistics, correlation matrix, monthly breakdown
//
// Persists user's chosen level in localStorage.

import React, { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type DisclosureLevel = 1 | 2 | 3 | 4;

interface ProgressiveDisclosureProps {
  /** Current disclosure level */
  level: DisclosureLevel;
  /** Callback when level changes */
  onChange: (level: DisclosureLevel) => void;
  className?: string;
}

// ── Level definitions ────────────────────────────────────────────────────────

const LEVELS: Array<{
  level: DisclosureLevel;
  label: string;
  icon: string;
  description: string;
  color: string;
}> = [
  {
    level: 1, label: '一眼概括', icon: '👁',
    description: '只显示最关键的一句话结论',
    color: '#22c55e',
  },
  {
    level: 2, label: '核心指标', icon: '📊',
    description: 'R² + Top3因子贡献度',
    color: '#f59e0b',
  },
  {
    level: 3, label: '详细分析', icon: '🔬',
    description: '全部因子 + IC值 + 加载Beta',
    color: '#3b82f6',
  },
  {
    level: 4, label: '全量数据', icon: '🧬',
    description: '含p值/t统计/相关性矩阵/月度明细',
    color: '#ec4899',
  },
];

const STORAGE_KEY = 'dw-disclosure-level';

// ── Hook: persist disclosure level ───────────────────────────────────────────

export function useDisclosureLevel(defaultLevel: DisclosureLevel = 2): [
  DisclosureLevel,
  (level: DisclosureLevel) => void,
] {
  const [level, setLevelState] = useState<DisclosureLevel>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const l = parseInt(stored, 10);
        if (l >= 1 && l <= 4) return l as DisclosureLevel;
      }
    } catch { /* ignore */ }
    return defaultLevel;
  });

  const setLevel = (newLevel: DisclosureLevel) => {
    setLevelState(newLevel);
    try { localStorage.setItem(STORAGE_KEY, String(newLevel)); } catch { /* ignore */ }
  };

  return [level, setLevel];
}

// ── Component ────────────────────────────────────────────────────────────────

export const ProgressiveDisclosure: React.FC<ProgressiveDisclosureProps> = ({
  level,
  onChange,
  className,
}) => {
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);

  return (
    <div className={`bg-white/[0.03] rounded-lg border border-white/5 p-3 ${className ?? ''}`}>
      <div className="text-[10px] text-gray-500 mb-2">📐 信息密度</div>
      <div className="flex items-center gap-1">
        {LEVELS.map((l) => {
          const isActive = level >= l.level;
          const isHovered = hoveredLevel === l.level;
          return (
            <div key={l.level} className="relative flex-1">
              <button
                onClick={() => onChange(l.level)}
                onMouseEnter={() => setHoveredLevel(l.level)}
                onMouseLeave={() => setHoveredLevel(null)}
                className={`w-full py-2 rounded-lg text-[10px] font-medium transition-all border ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-600 border-transparent hover:text-gray-400'
                }`}
                style={{
                  backgroundColor: isActive ? l.color + '15' : 'transparent',
                  borderColor: isActive ? l.color + '30' : 'transparent',
                }}
              >
                <span className="block text-xs mb-0.5">{l.icon}</span>
                <span className="block">{l.label}</span>
              </button>

              {/* Connector line */}
              {l.level < 4 && (
                <div
                  className="absolute top-1/2 -right-1 w-2 h-0.5 z-10"
                  style={{
                    backgroundColor: level > l.level ? l.color + '80' : 'rgba(255,255,255,0.08)',
                  }}
                />
              )}

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-[160px] bg-[#1a1a25] border border-white/10 rounded-lg p-2 text-[10px] text-gray-400 shadow-xl whitespace-normal text-center">
                  {l.description}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current level description */}
      <div className="mt-2 text-[10px] text-gray-600 text-center">
        L{level}: {LEVELS[level - 1].description}
        <span className="ml-2 opacity-50">
          (点击上方按钮切换 · 自动记忆偏好)
        </span>
      </div>
    </div>
  );
};

// ── Helper: Conditionally render based on level ──────────────────────────────

export function isDisclosureVisible(
  currentLevel: DisclosureLevel,
  requiredLevel: DisclosureLevel,
): boolean {
  return currentLevel >= requiredLevel;
}

export default ProgressiveDisclosure;
