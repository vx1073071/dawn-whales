/**
 * Skeleton Screen Components — ML-47-03 [P1]
 * Phase 6.4: First-Load Optimization
 *
 * Skeleton screens shown while lazy-loaded pages load.
 * Reduces perceived load time and provides visual continuity.
 */

import React from 'react';

// ── Base Components ─────────────────────────────────────────────────────

export const SkeletonBlock: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`animate-pulse bg-white/[0.04] rounded ${className ?? ''}`}
  />
);

// ── Dashboard Skeleton ──────────────────────────────────────────────────

export const DashboardSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-32" />
        <SkeletonBlock className="h-4 w-56" />
      </div>
      <SkeletonBlock className="h-9 w-28 rounded-lg" />
    </div>

    {/* Stats Cards */}
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-7 w-28" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
      ))}
    </div>

    {/* Main content grid */}
    <div className="grid grid-cols-3 gap-4">
      {/* Chart area */}
      <div className="col-span-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-4">
        <SkeletonBlock className="h-5 w-36" />
        <SkeletonBlock className="h-64 w-full rounded-lg" />
      </div>
      {/* Sidebar */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
        <SkeletonBlock className="h-5 w-24" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>

    {/* Bottom section */}
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
        <SkeletonBlock className="h-5 w-28" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonBlock className="h-6 w-6 rounded-full" />
            <SkeletonBlock className="h-3 flex-1" />
            <SkeletonBlock className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
        <SkeletonBlock className="h-5 w-24" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <SkeletonBlock key={i} className="h-24 flex-1 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ── Market Skeleton ─────────────────────────────────────────────────────

export const MarketSkeleton: React.FC = () => (
  <div className="p-6 space-y-4">
    <div className="flex items-center justify-between">
      <SkeletonBlock className="h-7 w-28" />
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-8 w-48 rounded-lg" />
        <SkeletonBlock className="h-8 w-24 rounded-lg" />
      </div>
    </div>
    {/* Market tabs */}
    <div className="flex gap-2">
      {[...Array(4)].map((_, i) => (
        <SkeletonBlock key={i} className="h-7 w-14 rounded-md" />
      ))}
    </div>
    {/* Table */}
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="grid grid-cols-7 gap-4 pb-3 border-b border-white/[0.05]">
        {[...Array(7)].map((_, i) => (
          <SkeletonBlock key={i} className="h-3 w-full" />
        ))}
      </div>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="grid grid-cols-7 gap-4 py-3 border-b border-white/[0.02]">
          {[...Array(7)].map((_, j) => (
            <SkeletonBlock key={j} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// ── Strategy Skeleton ───────────────────────────────────────────────────

export const StrategySkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-28" />
        <SkeletonBlock className="h-4 w-48" />
      </div>
      <SkeletonBlock className="h-9 w-28 rounded-lg" />
    </div>
    <div className="grid grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-3 w-32" />
            </div>
          </div>
          <SkeletonBlock className="h-24 w-full rounded-lg" />
        </div>
      ))}
    </div>
  </div>
);

// ── General Skeleton ────────────────────────────────────────────────────

export const GeneralSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-32" />
        <SkeletonBlock className="h-4 w-56" />
      </div>
    </div>
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 space-y-4">
      <SkeletonBlock className="h-5 w-40" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-4 flex-1" />
            <SkeletonBlock className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Skeleton Router ─────────────────────────────────────────────────────

const skeletonMap: Record<string, React.FC> = {
  dashboard: DashboardSkeleton,
  market: MarketSkeleton,
  strategy: StrategySkeleton,
};

/**
 * Returns the appropriate skeleton component for a given view.
 * Falls back to GeneralSkeleton for unknown views.
 */
export function getSkeletonForView(view: string): React.FC {
  return skeletonMap[view] || GeneralSkeleton;
}

export default {
  DashboardSkeleton,
  MarketSkeleton,
  StrategySkeleton,
  GeneralSkeleton,
  SkeletonBlock,
  getSkeletonForView,
};
