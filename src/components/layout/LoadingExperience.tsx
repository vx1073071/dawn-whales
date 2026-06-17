// ── R125-M04 Loading Experience — 骨架屏 + Tab动画 + 冷启动进度 ──────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// PM: P2-9 加载体验 — 让人知道系统正在工作, 不是卡死了

import { ReactNode, useEffect, useState } from 'react';

// ═══════════ Skeleton Components ═══════════

export function SkeletonBlock({ width, height, className = '' }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#1c2333] rounded ${className}`}
      style={{ width: width || '100%', height: height || '16px' }}
    />
  );
}

export function SkeletonLine({ width = '100%' }: { width?: string }) {
  return <SkeletonBlock width={width} height="12px" />;
}

export function KLineSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4 bg-[#0d1117] rounded-lg border border-[#30363d]">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3 pb-2 border-b border-[#1c2333]">
        <SkeletonBlock width="80px" height="14px" />
        <SkeletonBlock width="60px" height="14px" />
        <div className="flex gap-1 ml-auto">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonBlock key={i} width="24px" height="14px" />
          ))}
        </div>
      </div>
      {/* Chart area skeleton */}
      <div className="relative">
        <SkeletonBlock width="100%" height="400px" className="!bg-[#0d1117] border border-[#1c2333]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-[#484f58] font-mono">加载K线数据...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PanelSkeleton({ rows = 5, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
      {title && <SkeletonBlock width="120px" height="14px" />}
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <SkeletonBlock width="60px" height="10px" />
            <SkeletonBlock width={`${40 + Math.random() * 60}%`} height="10px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ cols = 4, rows = 8 }: { cols?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-1 p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
      {/* Header */}
      <div className="flex gap-2 pb-2 border-b border-[#1c2333]">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} width={`${100 / cols}%`} height="12px" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-2 py-1">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} width={`${100 / cols}%`} height="10px" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ═══════════ Tab Transition Animation ═══════════

export function TabTransition({ children, active, className = '' }: { children: ReactNode; active: boolean; className?: string }) {
  return (
    <div
      className={`transition-all duration-200 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none absolute'} ${className}`}
    >
      {children}
    </div>
  );
}

// ═══════════ Cold Start Progress ═══════════

export interface ColdStartPhase {
  label: string;
  done: boolean;
}

export function ColdStartProgress({
  phases, progress, message
}: {
  phases: ColdStartPhase[];
  progress: number; // 0-100
  message?: string;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0d1117] select-none">
      <div className="flex flex-col items-center gap-6 w-80">
        {/* Logo */}
        <div className="text-5xl animate-bounce">🐳</div>

        {/* Title */}
        <h1 className="text-[#e6edf3] text-lg font-bold font-mono">TradingEasy</h1>

        {/* Progress bar */}
        <div className="w-full">
          <div className="h-1 bg-[#161b22] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3b82f6] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-[#484f58] font-mono">{message || '启动中...'}</span>
            <span className="text-[9px] text-[#3b82f6] font-mono">{progress}%</span>
          </div>
        </div>

        {/* Phase list */}
        <div className="flex flex-col gap-1 w-full">
          {phases.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`text-[10px] ${p.done ? 'text-[#22c55e]' : 'text-[#484f58]'}`}>
                {p.done ? '✅' : '⏳'}
              </span>
              <span className={`text-[10px] font-mono ${p.done ? 'text-[#c9d1d9]' : 'text-[#484f58]'}`}>
                {p.label}
              </span>
            </div>
          ))}
        </div>

        {/* Tip */}
        <p className="text-[8px] text-[#30363d] text-center">
          首次启动可能需要连接券商服务，请耐心等待
        </p>
      </div>
    </div>
  );
}

// ═══════════ Cold Start Hook ═══════════

const COLD_START_PHASES: ColdStartPhase[] = [
  { label: '初始化渲染引擎', done: false },
  { label: '加载用户配置', done: false },
  { label: '检测本地券商服务', done: false },
  { label: '连接行情数据源', done: false },
  { label: '准备就绪', done: false },
];

export function useColdStart() {
  const [phases, setPhases] = useState<ColdStartPhase[]>(COLD_START_PHASES.map(p => ({ ...p })));
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('启动中...');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const steps = [
      { pct: 10, msg: '初始化渲染引擎...', phase: 0, delay: 200 },
      { pct: 25, msg: '加载用户配置...', phase: 1, delay: 300 },
      { pct: 45, msg: '检测本地券商服务...', phase: 2, delay: 500 },
      { pct: 70, msg: '连接行情数据源...', phase: 3, delay: 800 },
      { pct: 100, msg: '', phase: 4, delay: 400 },
    ];

    let cancelled = false;
    let totalDelay = 0;

    for (const step of steps) {
      totalDelay += step.delay;
      setTimeout(() => {
        if (cancelled) return;
        setProgress(step.pct);
        setMessage(step.msg);
        setPhases(prev => prev.map((p, i) => i <= step.phase ? { ...p, done: true } : p));
        if (step.phase === 4) {
          setTimeout(() => {
            if (!cancelled) setReady(true);
          }, 300);
        }
      }, totalDelay);
    }

    return () => { cancelled = true; };
  }, []);

  return { phases, progress, message, ready };
}

export default KLineSkeleton;
