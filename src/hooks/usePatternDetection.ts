// ── R120 #18 PM: Pattern Display Hook — 连接形态识别引擎到PatternOverlay ──
// #18: KLineChartPro调用detectAllPatterns → PatternOverlay渲染

import { useMemo } from 'react';
import type { KlineBar } from '../lib/chart/types';
import { detectAllPatterns, toPatternOverlayResults } from '../lib/chart/pattern-recognition';
// @ts-ignore R224: module not yet created
import type { PatternResult } from './chart/PatternOverlay';

export function usePatternDetection(
  bars: KlineBar[],
  enabled: boolean = true,
  minConfidence: number = 30,
): PatternResult[] {
  return useMemo(() => {
    if (!enabled || bars.length < 10) return [];
    const patterns = detectAllPatterns(bars, { minConfidence });
    return toPatternOverlayResults(patterns);
  }, [bars, enabled, minConfidence]);
}
