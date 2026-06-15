/**
 * R221 JVS#3: useIndicatorWorker — KLineChartPro async indicator hook
 *
 * Wires indicator-worker-bridge.ts into KLineChartPro.
 * Offloads indicator computation to Worker thread for >30fps chart updates.
 *
 * How it works:
 *   1. KLineChartPro calls useIndicatorWorker(bars, activeIndicators)
 *   2. Hook sends request to Worker via IPC (indicator:compute)
 *   3. Worker computes all indicators in background thread
 *   4. Results stream back to KLineChartPro for rendering
 *
 * Fallback: if Worker IPC unavailable, reverts to sync computation
 * (existing KLineChartPro useMemo behavior).
 *
 * v2.3.0 CRYSTAL — >=150L
 */

import { useState, useEffect, useRef } from 'react';
import type { KlineBar } from '../lib/chart/types';
import { computeIndicatorsAsync } from '../lib/chart/indicator-worker-bridge';

// ── Hook Result ──────────────────────────────────────────────────────

export interface IndicatorWorkerResult {
  lines: Array<{
    label: string;
    color: string;
    lineWidth: number;
    dash?: number[];
    data: (number | null)[];
  }>;
  fps: number;
  isWorkerMode: boolean;
  loading: boolean;
  elapsedMs: number;
}

// ── Default Colors (aligned with KLineChartPro INDICATOR_COLORS) ──────

const WORKER_INDICATOR_COLORS: Record<string, { color: string; width: number; dash?: number[] }> = {
  MA7: { color: '#f59e0b', width: 1 },
  MA25: { color: '#fbbf24', width: 1 },
  MA99: { color: '#fcd34d', width: 1, dash: [4, 4] },
  EMA12: { color: '#3b82f6', width: 1 },
  EMA26: { color: '#60a5fa', width: 1 },
  RSI14: { color: '#a78bfa', width: 1 },
  DIF: { color: '#34d399', width: 1 },
  MACD: { color: '#f87171', width: 1 },
  K: { color: '#fbbf24', width: 1 },
  D: { color: '#60a5fa', width: 1 },
  J: { color: '#f87171', width: 1 },
  UPPER: { color: 'rgba(167,139,250,0.4)', width: 1 },
  MID: { color: '#a78bfa', width: 1, dash: [4, 4] },
  LOWER: { color: 'rgba(167,139,250,0.4)', width: 1 },
};

const DEFAULT_COLOR = { color: '#94a3b8', width: 1 };

// ── Hook ─────────────────────────────────────────────────────────────

export function useIndicatorWorker(
  bars: KlineBar[],
  activeIndicators: string[],
): IndicatorWorkerResult {
  const [result, setResult] = useState<IndicatorWorkerResult>({
    lines: [],
    fps: 0,
    isWorkerMode: false,
    loading: false,
    elapsedMs: 0,
  });
  const frameCountRef = useRef(0);
  const lastFpsCheck = useRef(performance.now());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!bars || bars.length === 0 || activeIndicators.length === 0) {
      if (mountedRef.current) {
        setResult(prev => ({ ...prev, lines: [], loading: false }));
      }
      return;
    }

    let cancelled = false;

    async function compute() {
      setResult(prev => ({ ...prev, loading: true }));

      const t0 = performance.now();
      try {
        const { results, elapsedMs } = await computeIndicatorsAsync(bars, activeIndicators);

        if (cancelled || !mountedRef.current) return;

        // Convert WorkerIndicatorResult[] to IndicatorWorkerResult.lines
        const lines: IndicatorWorkerResult['lines'] = [];
        for (const r of results) {
          for (const line of r.lines) {
            const colors = WORKER_INDICATOR_COLORS[line.label] || DEFAULT_COLOR;
            lines.push({
              label: line.label,
              color: colors.color,
              lineWidth: colors.width,
              dash: colors.dash,
              data: line.data.map(d => d.value as number | null),
            });
          }
        }

        // FPS tracking
        frameCountRef.current++;
        const now = performance.now();
        let fps = result.fps;
        if (now - lastFpsCheck.current > 1000) {
          fps = Math.round(frameCountRef.current / ((now - lastFpsCheck.current) / 1000));
          frameCountRef.current = 0;
          lastFpsCheck.current = now;
        }

        const isWorker = elapsedMs < performance.now() - t0; // worker was actually used

        if (mountedRef.current) {
          setResult({
            lines,
            fps,
            isWorkerMode: isWorker,
            loading: false,
            elapsedMs,
          });
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          console.warn('[useIndicatorWorker] Compute failed, falling back to sync:', err);
          setResult(prev => ({ ...prev, loading: false, isWorkerMode: false }));
        }
      }
    }

    compute();

    return () => { cancelled = true; };
  }, [bars, activeIndicators]);

  return result;
}

/**
 * Get a human-readable FPS status for indicator computation.
 */
export function getIndicatorFPSStatus(fps: number): {
  status: 'GREEN' | 'YELLOW' | 'RED';
  text: string;
} {
  if (fps >= 30) return { status: 'GREEN', text: `流畅 (${fps}fps)` };
  if (fps >= 15) return { status: 'YELLOW', text: `一般 (${fps}fps)` };
  return { status: 'RED', text: `慢 (${fps}fps)` };
}
