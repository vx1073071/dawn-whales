// @ts-nocheck
/**
* AIProgressIndicator — ML R182 P1-01 [P0] AI回复进度条
* Two-phase progress: rough scan → fine analysis
* Step hints + estimated remaining time
*/

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

type ProgressPhase = 'idle' | 'connecting' | 'computing_ic' | 'compatibility' | 'optimizing' | 'backtesting' | 'formatting' | 'done';

interface ProgressStep {
  phase: ProgressPhase;
  label: string;
  weight: number; // % of total progress
}

const PROGRESS_STEPS: ProgressStep[] = [
  { phase: 'connecting', label: '连接AI引擎', weight: 5 },
  { phase: 'computing_ic', label: '计算实时IC/IR', weight: 20 },
  { phase: 'compatibility', label: '兼容性检查', weight: 15 },
  { phase: 'optimizing', label: '权重多目标优化', weight: 30 },
  { phase: 'backtesting', label: '迷你回测验证', weight: 20 },
  { phase: 'formatting', label: '生成推荐报告', weight: 10 },
];

interface AIProgressIndicatorProps {
  /** Current phase. Component auto-advances if not controlled */
  phase?: ProgressPhase;
  /** Override progress 0-100 */
  progress?: number;
  /** Estimated total seconds */
  estimatedSeconds?: number;
  /** Auto-advance speed multiplier (1=normal) */
  speed?: number;
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────────

export default function AIProgressIndicator({
  phase: controlledPhase,
  progress: controlledProgress,
  estimatedSeconds = 12,
  speed = 1,
  className = '',
}: AIProgressIndicatorProps) {
  const [autoPhase, setAutoPhase] = useState<ProgressPhase>('connecting');
  const [autoProgress, setAutoProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startRef = useRef(Date.now());

  const phase = controlledPhase || autoPhase;
  const progress = controlledProgress ?? autoProgress;

  const simulate = useCallback(() => {
    if (controlledPhase || controlledProgress !== undefined) return;

    const tick = () => {
      const elapsedSec = (Date.now() - startRef.current) / 1000 * speed;
      setElapsed(elapsedSec);

      // Calculate progress based on steps
      let accWeight = 0;
      let currentPhase: ProgressPhase = 'done';
      for (const step of PROGRESS_STEPS) {
        accWeight += step.weight;
        const phaseThreshold = estimatedSeconds * (accWeight / 100);
        if (elapsedSec < phaseThreshold) {
          currentPhase = step.phase;
          break;
        }
      }

      if (currentPhase === 'done') {
        setAutoPhase('done');
        setAutoProgress(100);
        return;
      }

      setAutoPhase(currentPhase);

      // Progress within current phase
      const phaseIdx = PROGRESS_STEPS.findIndex((s) => s.phase === currentPhase);
      const prevWeight = PROGRESS_STEPS.slice(0, phaseIdx).reduce((s, st) => s + st.weight, 0);
      const phaseWeight = PROGRESS_STEPS[phaseIdx].weight;
      const phaseStart = estimatedSeconds * (prevWeight / 100);
      const phaseDuration = estimatedSeconds * (phaseWeight / 100);
      const phaseProgress = Math.min((elapsedSec - phaseStart) / phaseDuration, 1);
      const totalProgress = prevWeight + phaseProgress * phaseWeight;
      setAutoProgress(Math.min(totalProgress, 99));

      timerRef.current = setTimeout(tick, 200);
    };

    startRef.current = Date.now();
    tick();
  }, [controlledPhase, controlledProgress, estimatedSeconds, speed]);

  useEffect(() => {
    simulate();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [simulate]);

  if (phase === 'idle' || phase === 'done') return null;

  const currentStep = PROGRESS_STEPS.find((s) => s.phase === phase);
  const remaining = Math.max(0, estimatedSeconds - elapsed);

  return (
    <div className={`bg-[#1a1a25] border border-[#D4A853]/10 rounded-lg p-4 space-y-3 ${className}`}>
      {/* Status line */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="animate-spin text-sm">⏳</span>
          <span className="text-sm text-gray-300">
            AI正在分析您的因子组合...
          </span>
        </div>
        <span className="text-[10px] text-gray-500">
          约{Math.ceil(remaining)}秒
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-[#D4A853] rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 text-[9px]">
        {PROGRESS_STEPS.map((step, idx) => {
          const idxOf = PROGRESS_STEPS.findIndex((s) => s.phase === phase);
          const isDone = idx < idxOf;
          const isActive = idx === idxOf;
          const isPending = idx > idxOf;
          return (
            <div key={step.phase} className="flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isDone
                    ? 'bg-green-400'
                    : isActive
                    ? 'bg-[#D4A853] animate-pulse'
                    : 'bg-white/10'
                }`}
              />
              <span
                className={
                  isDone
                    ? 'text-green-400'
                    : isActive
                    ? 'text-[#D4A853]'
                    : 'text-gray-600'
                }
              >
                {step.label}
              </span>
              {idx < PROGRESS_STEPS.length - 1 && (
                <span className="text-gray-700 mx-0.5">→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
