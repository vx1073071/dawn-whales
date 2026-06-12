/**
 * DAWN WHALES R122 J04 — Async Indicator Worker Bridge
 * 
 * Wraps synchronous indicator computation into async Worker IPC calls.
 * Used by KLineChartPro to offload 60+ indicators from main thread.
 * 
 * Fallback: if Worker IPC is unavailable (preload not loaded), falls back to sync computation.
 */

import type { KlineBar } from '../lib/chart/types';

// ═══════════ Worker Request/Response ═══════════════════════

export interface WorkerIndicatorRequest {
  taskId: string;
  bars: KlineBar[];
  indicators: Array<{
    id: string;
    params: Record<string, number>;
  }>;
}

export interface WorkerIndicatorResult {
  id: string;
  lines: Array<{
    label: string;
    data: Array<{ time: number; value: number | null }>;
  }>;
}

export interface WorkerIndicatorResponse {
  taskId: string;
  results: WorkerIndicatorResult[];
  barCount: number;
  elapsedMs: number;
  error?: string;
}

// ═══════════ Async Worker Bridge ═══════════════════════════

/**
 * computeIndicatorsAsync — offload to Worker via IPC.
 * Falls back to sync computation if IPC unavailable.
 */
export async function computeIndicatorsAsync(
  bars: KlineBar[],
  indicatorIds: string[],
  params: Record<string, Record<string, number>> = {},
): Promise<{ results: WorkerIndicatorResult[]; elapsedMs: number }> {
  const taskId = `ind-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const request: WorkerIndicatorRequest = {
    taskId,
    bars,
    indicators: indicatorIds.map(id => ({
      id,
      params: params[id] || {},
    })),
  };

  try {
    const api = (window as any).api;
    if (api?.indicator?.compute) {
      const response: WorkerIndicatorResponse = await api.indicator.compute(request);
      if (response.error) {
        console.warn(`[IndicatorWorker] Error: ${response.error}`);
        return { results: [], elapsedMs: 0 };
      }
      console.log(`[IndicatorWorker] ${indicatorIds.length} indicators computed in ${response.elapsedMs.toFixed(1)}ms`);
      return { results: response.results, elapsedMs: response.elapsedMs };
    }
  } catch (err) {
    console.warn('[IndicatorWorker] IPC unavailable, using sync fallback:', err);
  }

  // Fallback: sync computation (imports inline to avoid circular deps)
  return computeIndicatorsSync(bars, indicatorIds, params);
}

// ═══════════ Sync Fallback ═══════════════════════════════════

async function computeIndicatorsSync(
  bars: KlineBar[],
  indicatorIds: string[],
  _params: Record<string, Record<string, number>>,
): Promise<{ results: WorkerIndicatorResult[]; elapsedMs: number }> {
  const start = performance.now();
  const results: WorkerIndicatorResult[] = [];
  const prices = bars.map(b => b.close);

  // Dynamic import to avoid circular with indicator-engine
  const { calcSMA, calcEMA, calcRSI, calcMACD, calcKDJ, calcBOLL } = await import('../lib/chart/indicator-engine');

  for (const id of indicatorIds) {
    switch (id) {
      case 'sma':
      case 'ma': {
        const ma7 = calcSMA(prices, 7);
        const ma25 = calcSMA(prices, 25);
        const ma99 = calcSMA(prices, 99);
        results.push({
          id,
          lines: [
            { label: 'MA7', data: ma7.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
            { label: 'MA25', data: ma25.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
            { label: 'MA99', data: ma99.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
          ],
        });
        break;
      }
      case 'ema': {
        const ema12 = calcEMA(prices, 12);
        const ema26 = calcEMA(prices, 26);
        results.push({
          id,
          lines: [
            { label: 'EMA12', data: ema12.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
            { label: 'EMA26', data: ema26.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
          ],
        });
        break;
      }
      case 'rsi': {
        const rsi = calcRSI(prices, 14);
        results.push({
          id: 'rsi',
          lines: [{ label: 'RSI14', data: rsi.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) }],
        });
        break;
      }
      case 'macd': {
        const [, dea, macd] = calcMACD(bars, 12, 26, 9);
        results.push({
          id: 'macd',
          lines: [
            { label: 'DIF', data: dea.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
            { label: 'MACD', data: macd.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
          ],
        });
        break;
      }
      case 'kdj': {
        const [k, d, j] = calcKDJ(bars, 9, 3, 3);
        results.push({
          id: 'kdj',
          lines: [
            { label: 'K', data: k.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
            { label: 'D', data: d.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
            { label: 'J', data: j.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
          ],
        });
        break;
      }
      case 'boll': {
        const [upper, mid, lower] = calcBOLL(prices, 20, 2);
        results.push({
          id: 'boll',
          lines: [
            { label: 'UPPER', data: upper.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
            { label: 'MID', data: mid.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
            { label: 'LOWER', data: lower.map((v: any, i: number) => ({ time: bars[i]?.time ?? 0, value: v })) },
          ],
        });
        break;
      }
    }
  }

  return { results, elapsedMs: performance.now() - start };
}
