/**
* KeyboardShortcuts + BacktestProgressBar — ML R177 H5+H6 [P0]
* Ctrl+1~6 tab switching + Ctrl+Z/Y undo/redo global
* Two-phase backtest progress: rough (5s) → fine (30s)
*/

import { useEffect, useCallback, useRef } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface ShortcutAction {
  keys: string;      // e.g. "Ctrl+1"
  label: string;
  action: () => void;
}

// ── Keyboard handler ────────────────────────────────────────────────────

export function useGlobalShortcuts(shortcuts: ShortcutAction[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const modifiers: string[] = [];
      if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      const keyCombo = [...modifiers, e.key.toUpperCase()].join('+');

      const match = shortcuts.find((s) => s.keys.toUpperCase() === keyCombo);
      if (match) {
        e.preventDefault();
        match.action();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, enabled]);
}

// ── Shortcut help panel ─────────────────────────────────────────────────

export function ShortcutHelpPanel({
  shortcuts,
  className = '',
}: {
  shortcuts: ShortcutAction[];
  className?: string;
}) {
  return (
    <div className={`bg-[#1a1a25] border border-white/5 rounded-lg p-4 ${className}`}>
      <h4 className="text-xs font-semibold text-gray-300 mb-2">⌨️ 快捷键</h4>
      <div className="grid grid-cols-1 gap-1.5">
        {shortcuts.map((s) => (
          <div key={s.keys} className="flex items-center justify-between text-[11px]">
            <kbd className="px-1.5 py-0.5 bg-white/[0.05] border border-white/10 rounded text-[10px] text-gray-400 font-mono">
              {s.keys}
            </kbd>
            <span className="text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Two-phase backtest progress bar ─────────────────────────────────────

export interface BacktestProgressState {
  phase: 'idle' | 'rough' | 'fine' | 'done';
  progress: number;     // 0-100
  elapsedMs: number;
  estimatedTotalMs: number;
  message: string;
}

interface BacktestProgressProps {
  state: BacktestProgressState;
  className?: string;
}

export function BacktestProgressBar({ state, className = '' }: BacktestProgressProps) {
  if (state.phase === 'idle') return null;

  const phaseColors: Record<string, string> = {
    rough: '#C9A046',
    fine: '#448aff',
    done: '#16a34a',
  };

  const phaseLabels: Record<string, string> = {
    rough: '粗略扫描',
    fine: '精细计算',
    done: '完成',
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Phase indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {state.phase === 'done' ? (
            <span className="text-green-400 text-xs font-medium">✅ 回测完成</span>
          ) : (
            <>
              <span className="animate-spin text-xs">⏳</span>
              <span className="text-xs text-gray-300">{state.message}</span>
            </>
          )}
        </div>
        <span className="text-[10px] text-gray-500">
          {state.phase !== 'done'
            ? `${state.elapsedMs / 1000}s / ~${state.estimatedTotalMs / 1000}s`
            : `${(state.elapsedMs / 1000).toFixed(1)}s`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${state.progress}%`,
            backgroundColor: phaseColors[state.phase] || '#6b7280',
          }}
        />
      </div>

      {/* Phase indicators below bar */}
      <div className="flex items-center justify-between text-[9px]">
        <span className={state.phase === 'rough' || state.phase === 'done' ? 'text-[#C9A046]' : 'text-gray-600'}>
          ① {phaseLabels.rough}
        </span>
        <span className={state.phase === 'fine' || state.phase === 'done' ? 'text-blue-400' : 'text-gray-600'}>
          ② {phaseLabels.fine}
        </span>
        <span className={state.phase === 'done' ? 'text-green-400' : 'text-gray-600'}>
          ③ {phaseLabels.done}
        </span>
      </div>
    </div>
  );
}

// ── Progress simulator hook ─────────────────────────────────────────────

export function useBacktestProgress() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const simulate = useCallback(
    (
      roughMs: number,
      fineMs: number,
      onPhaseChange: (state: BacktestProgressState) => void
    ) => {
      const startTime = Date.now();
      const totalMs = roughMs + fineMs;

      const tick = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed < roughMs) {
          onPhaseChange({
            phase: 'rough',
            progress: (elapsed / roughMs) * 50, // first 50%
            elapsedMs: elapsed,
            estimatedTotalMs: totalMs,
            message: '粗略扫描因子表现...',
          });
          timerRef.current = setTimeout(tick, 200);
        } else if (elapsed < totalMs) {
          const fineElapsed = elapsed - roughMs;
          onPhaseChange({
            phase: 'fine',
            progress: 50 + (fineElapsed / fineMs) * 50, // remaining 50%
            elapsedMs: elapsed,
            estimatedTotalMs: totalMs,
            message: '精细计算归因分解...',
          });
          timerRef.current = setTimeout(tick, 200);
        } else {
          onPhaseChange({
            phase: 'done',
            progress: 100,
            elapsedMs: elapsed,
            estimatedTotalMs: totalMs,
            message: '回测完成',
          });
        }
      };

      tick();
    },
    []
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { simulate, cancel };
}
