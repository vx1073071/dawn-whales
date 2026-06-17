// ── R173 C7: Skeleton Loading Component ──────────────────────────────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// Replace empty LoadingSpinner with informative skeleton screens.
// Shows: loading progress "正在计算 动量因子... (3/8)"
// Skeleton: grey animated placeholders matching final layout shape.

import React, { useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SkeletonLoaderProps {
  /** Type of content to show skeleton for */
  type: 'factor-cards' | 'factor-chart' | 'factor-table' | 'factor-workbench';
  /** Number of total items being computed */
  totalItems?: number;
  /** Current item index (0-based) */
  currentItem?: number;
  /** Custom message override */
  message?: string;
  className?: string;
}

// ── Sub-component: shimmer animation ─────────────────────────────────────────

const ShimmerBar: React.FC<{
  width?: string;
  height?: string;
  className?: string;
}> = ({ width = '100%', height = '12px', className }) => (
  <div
    className={`rounded bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] bg-[length:200%_100%] animate-shimmer ${className ?? ''}`}
    style={{ width, height }}
  />
);

// ── Progress indicator ───────────────────────────────────────────────────────

const LoadingProgress: React.FC<{
  total: number;
  current: number;
  message?: string;
}> = ({ total, current, message }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400">
        {message || `正在计算因子数据... (${current + 1}/${total})`}
      </span>
      <span className="text-gray-600 font-mono">{Math.round(((current + 1) / total) * 100)}%</span>
    </div>
    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-[#C9A046] rounded-full transition-all duration-500"
        style={{ width: `${((current + 1) / total) * 100}%` }}
      />
    </div>
  </div>
);

// ── Factor Cards Skeleton ────────────────────────────────────────────────────

const FactorCardsSkeleton: React.FC<{
  count: number;
}> = ({ count = 6 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="bg-white/[0.03] rounded-lg border border-white/5 p-3">
        <ShimmerBar width="60%" height="14px" className="mb-2" />
        <ShimmerBar width="40%" height="20px" className="mb-1" />
        <ShimmerBar width="80%" height="8px" />
      </div>
    ))}
  </div>
);

// ── Factor Chart Skeleton ────────────────────────────────────────────────────

const FactorChartSkeleton: React.FC = () => (
  <div className="bg-white/[0.03] rounded-lg border border-white/5 p-4">
    <ShimmerBar width="30%" height="14px" className="mb-3" />
    <ShimmerBar width="100%" height="300px" />
    <div className="flex justify-between mt-3">
      <ShimmerBar width="80px" height="8px" />
      <ShimmerBar width="80px" height="8px" />
    </div>
  </div>
);

// ── Factor Table Skeleton ────────────────────────────────────────────────────

const FactorTableSkeleton: React.FC<{
  rows?: number;
  cols?: number;
}> = ({ rows = 8, cols = 6 }) => (
  <div className="bg-white/[0.03] rounded-lg border border-white/5 p-4">
    <ShimmerBar width="25%" height="14px" className="mb-3" />
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }, (_, j) => (
            <ShimmerBar key={j} width={`${80 + Math.random() * 40}px`} height="10px" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// ── Workbench Skeleton ───────────────────────────────────────────────────────

const WorkbenchSkeleton: React.FC = () => (
  <div className="flex h-screen bg-deep">
    <div className="w-[240px] border-r border-gray-800 p-3">
      <ShimmerBar width="100%" height="30px" className="mb-2" />
      {Array.from({ length: 6 }, (_, i) => (
        <ShimmerBar key={i} width="100%" height="36px" className="mb-1" />
      ))}
    </div>
    <div className="flex-1 p-4 space-y-3">
      <ShimmerBar width="40%" height="20px" />
      {Array.from({ length: 3 }, (_, i) => (
        <ShimmerBar key={i} width="100%" height="60px" />
      ))}
    </div>
    <div className="w-[260px] border-l border-gray-800 p-3">
      <ShimmerBar width="100%" height="180px" className="mb-3" />
      {Array.from({ length: 5 }, (_, i) => (
        <ShimmerBar key={i} width="100%" height="16px" className="mb-1" />
      ))}
    </div>
  </div>
);

// ── Component ────────────────────────────────────────────────────────────────

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type,
  totalItems = 8,
  currentItem = 0,
  message,
  className,
}) => {
  const [animStep, setAnimStep] = useState(0);

  // Simulate progress animation
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimStep((s) => (s + 1) % (totalItems + 5));
    }, 400);
    return () => clearInterval(interval);
  }, [totalItems]);

  const progress = Math.min(currentItem + Math.min(animStep, totalItems - currentItem - 1), totalItems - 1);

  return (
    <div className={`p-6 space-y-5 ${className ?? ''}`}>
      <LoadingProgress total={totalItems} current={progress} message={message} />

      {type === 'factor-cards' && <FactorCardsSkeleton count={8} />}
      {type === 'factor-chart' && <FactorChartSkeleton />}
      {type === 'factor-table' && <FactorTableSkeleton />}
      {type === 'factor-workbench' && <WorkbenchSkeleton />}
    </div>
  );
};

// ── Convenience: one-liner for factor loading ────────────────────────────────

export const FactorLoadingSkeleton: React.FC<{
  factorName?: string;
  currentIndex?: number;
  totalCount?: number;
}> = ({ factorName, currentIndex = 0, totalCount = 8 }) => (
  <SkeletonLoader
    type="factor-cards"
    totalItems={totalCount}
    currentItem={currentIndex}
    message={factorName ? `正在计算 ${factorName}... (${currentIndex + 1}/${totalCount})` : undefined}
  />
);

export default SkeletonLoader;
