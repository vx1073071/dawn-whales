// ── R166 P1-X5: Strategy Expiry Banner ──────────────────────────────────
// Shows warning when strategy hasn't been optimized for >90 days.
// Suggests re-optimization with one-click jump to optimizer.
//
// Logic:
//  - Green (fresh): last optimized < 30 days ago
//  - Yellow (aging): 30-90 days → subtle banner
//  - Red (stale): >90 days → prominent banner → CTA to re-optimize
//
// Profit model: Re-optimization → AI optimization suggestion → 1.5U

import React, { useState, useEffect, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface StrategyExpiryBannerProps {
  strategyId: string;
  strategyName?: string;
  /** ISO date string of last optimization */
  lastOptimizedAt?: string;
  /** ISO date string of creation */
  createdAt?: string;
  /** Callback to navigate to optimizer */
  onNavigateOptimizer?: () => void;
  className?: string;
}

type StalenessLevel = 'fresh' | 'aging' | 'stale';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDaysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function getStaleness(daysSince: number): StalenessLevel {
  if (daysSince < 30) return 'fresh';
  if (daysSince < 90) return 'aging';
  return 'stale';
}

// ── Component ────────────────────────────────────────────────────────────────

export const StrategyExpiryBanner: React.FC<StrategyExpiryBannerProps> = ({
  strategyId,
  strategyName,
  lastOptimizedAt,
  createdAt,
  onNavigateOptimizer,
  className,
}) => {
  const [dismissed, setDismissed] = useState(false);

  const { staleness, daysSince, referenceDate } = useMemo(() => {
    const dateStr = lastOptimizedAt || createdAt;
    if (!dateStr) return { staleness: 'fresh' as const, daysSince: 0, referenceDate: '' };
    const days = getDaysSince(dateStr);
    return { staleness: getStaleness(days), daysSince: days, referenceDate: dateStr };
  }, [lastOptimizedAt, createdAt]);

  // Reset dismiss if staleness changes
  const [prevStaleness, setPrevStaleness] = useState(staleness);
  useEffect(() => {
    if (staleness !== prevStaleness) {
      setDismissed(false);
      setPrevStaleness(staleness);
    }
  }, [staleness, prevStaleness]);

  if (dismissed || staleness === 'fresh' || !referenceDate) return null;

  const isStale = staleness === 'stale';
  const displayName = strategyName || strategyId;

  return (
    <div
      className={`rounded-lg border p-3 text-xs transition-all ${
        isStale
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-yellow-500/5 border-yellow-500/20'
      } ${className ?? ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className={`text-lg ${isStale ? 'text-red-400' : 'text-yellow-400'}`}>
          {isStale ? '⚠️' : '⚡'}
        </span>

        {/* Content */}
        <div className="flex-1">
          <p className={`font-medium ${isStale ? 'text-red-300' : 'text-yellow-300'}`}>
            {isStale
              ? `「${displayName}」已超过${Math.floor(daysSince)}天未优化`
              : `「${displayName}」已${Math.floor(daysSince)}天未重新优化`}
          </p>
          <p className="text-gray-500 mt-1">
            {isStale
              ? '市场环境可能已发生变化，当前参数可能不再适应。建议立即重新优化策略参数以保持竞争力。'
              : '建议定期优化策略参数以适应最新的市场环境。'
            }
          </p>

          {/* CTA */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onNavigateOptimizer}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isStale
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
              }`}
            >
              {isStale ? '🔧 立即优化' : '🔧 重新优化'}
            </button>
            <span className="text-[10px] text-gray-600">
              AI优化建议 1.5U/次
            </span>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
          title="关闭"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default StrategyExpiryBanner;
