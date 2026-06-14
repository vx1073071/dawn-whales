/**
* useMobileDetect — ML R177 H1 [P0] 移动端因子图表适配
* Responsive breakpoints + hook for conditional rendering
* Desktop: radar/heatmap charts | Mobile: list + numeric display
*/

import { useState, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

interface MobileDetectResult {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
}

const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
};

function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useMobileDetect(): MobileDetectResult {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : BREAKPOINTS.tablet
  );

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const bp = getBreakpoint(width);
  return {
    breakpoint: bp,
    isMobile: bp === 'mobile',
    isTablet: bp === 'tablet',
    isDesktop: bp === 'desktop',
    width,
  };
}

// ── Responsive Factor Card (mobile-optimized) ───────────────────────────

export interface ResponsiveFactorCardProps {
  nameZh: string;
  categoryZh: string;
  ic: number;
  ir: number;
  score: number;
  weight: number;
  direction: 'long' | 'short';
  isCompatible: boolean;
  onSelect?: () => void;
  className?: string;
}

export function ResponsiveFactorCard({
  nameZh,
  categoryZh,
  ic,
  ir,
  score,
  weight,
  direction,
  isCompatible,
  onSelect,
  className = '',
}: ResponsiveFactorCardProps) {
  const { isMobile } = useMobileDetect();

  if (isMobile) {
    // Compact mobile card — stacked layout, smaller text
    return (
      <div
        onClick={onSelect}
        className={`rounded-lg p-2 border cursor-pointer ${
          isCompatible
            ? 'bg-[#1a1a25] border-white/5 hover:border-[#D4A853]/20'
            : 'bg-white/[0.01] border-white/5 opacity-50'
        } ${className}`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-white truncate max-w-[120px]">{nameZh}</span>
          <span className="text-[9px] bg-white/5 px-1 py-0.5 rounded text-gray-500">{categoryZh}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px]">
          <span className={ic >= 0.04 ? 'text-green-400' : 'text-yellow-400'}>IC {ic >= 0 ? '+' : ''}{ic.toFixed(3)}</span>
          <span className="text-gray-500">IR {ir.toFixed(1)}</span>
          <span className={direction === 'long' ? 'text-green-400' : 'text-red-400'}>
            {direction === 'long' ? '↑' : '↓'}
          </span>
        </div>
        <div className="mt-1 w-full bg-white/5 rounded-full h-1">
          <div className="h-1 rounded-full bg-[#D4A853]" style={{ width: `${weight * 100}%` }} />
        </div>
      </div>
    );
  }

  // Desktop card — full detail
  return (
    <div
      onClick={onSelect}
      className={`rounded-lg p-3 border cursor-pointer transition-all ${
        isCompatible
          ? 'bg-[#1a1a25] border-white/5 hover:border-[#D4A853]/20'
          : 'bg-white/[0.01] border-white/5 opacity-50'
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-white/5 px-1.5 py-0.5 rounded text-gray-500">{categoryZh}</span>
          <span className="text-sm font-medium text-white">{nameZh}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${ic >= 0.04 ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
            IC {ic >= 0 ? '+' : ''}{ic.toFixed(3)}
          </span>
          <span className={`text-[10px] px-1 py-0.5 rounded ${direction === 'long' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {direction === 'long' ? '做多' : '做空'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[10px] mb-2">
        <div className="bg-deep rounded p-1.5">
          <div className="text-gray-500">IR</div>
          <div className={`font-mono ${ir >= 0.7 ? 'text-green-400' : 'text-gray-400'}`}>{ir.toFixed(2)}</div>
        </div>
        <div className="bg-deep rounded p-1.5">
          <div className="text-gray-500">评分</div>
          <div className={`font-mono ${score >= 75 ? 'text-green-400' : 'text-gray-400'}`}>{score}</div>
        </div>
        <div className="bg-deep rounded p-1.5">
          <div className="text-gray-500">权重</div>
          <div className="font-mono text-[#D4A853]">{(weight * 100).toFixed(0)}%</div>
        </div>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1.5">
        <div className="h-1.5 rounded-full bg-[#D4A853]" style={{ width: `${weight * 100}%` }} />
      </div>
    </div>
  );
}

// ── Mobile-responsive chart wrapper ─────────────────────────────────────

export function ResponsiveChartWrapper({
  children,
  mobileFallback,
  minHeight = 300,
  className = '',
}: {
  children: React.ReactNode;
  mobileFallback?: React.ReactNode;
  minHeight?: number;
  className?: string;
}) {
  const { isMobile } = useMobileDetect();

  if (isMobile && mobileFallback) {
    return <>{mobileFallback}</>;
  }

  return (
    <div className={`relative ${className}`} style={{ minHeight }}>
      {/* On mobile, add horizontal scroll hint */}
      {isMobile && (
        <div className="absolute bottom-2 right-2 z-10 bg-black/60 px-2 py-0.5 rounded text-[9px] text-gray-400">
          ← 横向滑动 →
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export default useMobileDetect;
