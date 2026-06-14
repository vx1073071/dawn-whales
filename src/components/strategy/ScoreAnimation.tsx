// ── R168 P2-02: Score Animation Component ───────────────────────────────
// Animated score display with color transitions and ranking animation.
// Score starts at 0 and counts up to final value when displayed.
// Color changes: red(<30)→yellow(30-60)→green(60-80)→gold(80-100)
// Ranking badge animates up/down with arrows when position changes.

import React, { useState, useEffect, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ScoreData {
  label: string;
  score: number;        // 0-100
  maxScore?: number;    // default 100
  previousScore?: number; // for delta animation
  rank?: number;
  previousRank?: number;
  trend?: 'up' | 'down' | 'flat';
}

interface ScoreAnimationProps {
  items: ScoreData[];
  className?: string;
  animate?: boolean;
}

// ── Sub-component: Single Score Card ─────────────────────────────────────────

const ScoreCard: React.FC<{
  data: ScoreData;
  index: number;
  animate: boolean;
}> = ({ data, index, animate: shouldAnimate }) => {
  const [displayScore, setDisplayScore] = useState(0);
  const [showDelta, setShowDelta] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  const maxScore = data.maxScore || 100;

  // Score color
  const getColor = (s: number): string => {
    if (s >= 80) return '#C9A046'; // gold
    if (s >= 60) return '#22c55e'; // green
    if (s >= 30) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getBgColor = (s: number): string => {
    if (s >= 80) return 'rgba(201,160,70,0.15)';
    if (s >= 60) return 'rgba(34,197,94,0.15)';
    if (s >= 30) return 'rgba(245,158,11,0.15)';
    return 'rgba(239,68,68,0.15)';
  };

  // Animate score from 0 to target
  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayScore(data.score);
      return;
    }

    const delay = index * 100; // stagger
    const duration = 800; // ms
    const startTime = Date.now() + delay;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 0) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(data.score * eased));

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Show delta badge after animation
        if (data.previousScore !== undefined) {
          setShowDelta(true);
        }
      }
    };

    const timer = setTimeout(animate, delay);
    return () => {
      clearTimeout(timer);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [data.score, shouldAnimate, index, data.previousScore]);

  const color = getColor(displayScore);
  const bgColor = getBgColor(displayScore);
  const delta = data.previousScore !== undefined ? data.score - data.previousScore : 0;
  const rankDelta = data.previousRank && data.rank ? data.previousRank - data.rank : 0; // + = improved

  return (
    <div
      className="bg-white/[0.03] rounded-lg border border-white/5 p-4 relative overflow-hidden transition-all duration-500"
      style={{ backgroundColor: bgColor }}
    >
      {/* Background glow */}
      <div
        className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-xl opacity-20 transition-all duration-700"
        style={{ backgroundColor: color }}
      />

      {/* Label */}
      <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-wide">{data.label}</div>

      {/* Score circle */}
      <div className="flex items-end gap-3">
        <div
          className="text-3xl font-bold font-mono transition-all duration-300"
          style={{ color }}
        >
          {displayScore}
        </div>
        <div className="text-xs text-gray-600 pb-1">/ {maxScore}</div>

        {/* Delta badge */}
        {showDelta && delta !== 0 && (
          <div
            className={`text-xs font-medium px-1.5 py-0.5 rounded animate-bounce ${
              delta > 0
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {delta > 0 ? '+' : ''}{delta}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5 mt-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${(displayScore / maxScore) * 100}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>

      {/* Rank */}
      {(data.rank || data.previousRank) && (
        <div className="flex items-center gap-1 mt-2 text-[10px]">
          <span className="text-gray-500">排名</span>
          <span className="text-white font-bold">#{data.rank || '-'}</span>
          {rankDelta !== 0 && (
            <span
              className={`font-medium ${rankDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {rankDelta > 0 ? `↑${rankDelta}` : `↓${Math.abs(rankDelta)}`}
            </span>
          )}
        </div>
      )}

      {/* Trend indicator */}
      {data.trend && (
        <div className="absolute top-3 right-3">
          {data.trend === 'up' && <span className="text-emerald-400 text-sm">↗</span>}
          {data.trend === 'down' && <span className="text-red-400 text-sm">↘</span>}
          {data.trend === 'flat' && <span className="text-gray-500 text-sm">→</span>}
        </div>
      )}
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const ScoreAnimation: React.FC<ScoreAnimationProps> = ({
  items,
  className,
  animate = true,
}) => {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className ?? ''}`}>
      {items.map((item, i) => (
        <ScoreCard key={item.label} data={item} index={i} animate={animate} />
      ))}
    </div>
  );
};

export default ScoreAnimation;
