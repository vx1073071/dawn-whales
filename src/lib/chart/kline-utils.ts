// ── R113 KLine Utilities — K线变形/复权/聚合 ──────────────────────────
import type { KlineBar, CandleType, Timeframe } from './types';

/** Convert standard candles to Heikin-Ashi */
export function toHeikinAshi(bars: KlineBar[]): KlineBar[] {
  const out: KlineBar[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      out.push({ ...bars[0] });
      continue;
    }
    const prev = out[i - 1];
    const close = (bars[i].open + bars[i].high + bars[i].low + bars[i].close) / 4;
    const open = (prev.open + prev.close) / 2;
    const high = Math.max(bars[i].high, open, close);
    const low = Math.min(bars[i].low, open, close);
    out.push({ time: bars[i].time, open: +open.toFixed(8), high: +high.toFixed(8), low: +low.toFixed(8), close: +close.toFixed(8), volume: bars[i].volume });
  }
  return out;
}

/** Apply candle type transformation */
export function transformCandles(bars: KlineBar[], type: CandleType): KlineBar[] {
  switch (type) {
    case 'heikin-ashi': return toHeikinAshi(bars);
    case 'candle': case 'hollow': case 'line': case 'area': return bars; // SVG rendering difference, same data
    default: return bars;
  }
}

/** Pre-adjustment (forward adjust): adjust historical prices based on adjustment factor */
export function applyPreAdjust(bars: KlineBar[], factor: number[]): KlineBar[] {
  if (factor.length !== bars.length) return bars;
  return bars.map((b, i) => ({
    time: b.time,
    open: +(b.open * factor[i]).toFixed(8),
    high: +(b.high * factor[i]).toFixed(8),
    low: +(b.low * factor[i]).toFixed(8),
    close: +(b.close * factor[i]).toFixed(8),
    volume: b.volume,
  }));
}

/** Post-adjustment (backward adjust): adjust current price forward */
export function applyPostAdjust(bars: KlineBar[], factor: number[]): KlineBar[] {
  if (factor.length !== bars.length) return bars;
  return bars.map((b, i) => ({
    time: b.time,
    open: +(b.open / factor[i]).toFixed(8),
    high: +(b.high / factor[i]).toFixed(8),
    low: +(b.low / factor[i]).toFixed(8),
    close: +(b.close / factor[i]).toFixed(8),
    volume: b.volume,
  }));
}

/** Downsample data for large datasets */
export function downsample(bars: KlineBar[], maxBars: number): KlineBar[] {
  if (bars.length <= maxBars) return bars;
  const step = Math.ceil(bars.length / maxBars);
  const result: KlineBar[] = [];
  for (let i = 0; i < bars.length; i += step) {
    const chunk = bars.slice(i, Math.min(i + step, bars.length));
    result.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    });
  }
  return result;
}

/** Convert raw data to a specific timeframe (simple OHLCV aggregation) */
export function aggregateTimeframe(bars: KlineBar[], tf: Timeframe): KlineBar[] {
  if (tf === '1m') return bars;
  const ms = getTimeframeMs(tf);
  const grouped = new Map<number, KlineBar[]>();
  for (const bar of bars) {
    const key = Math.floor(bar.time / ms) * ms;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(bar);
  }
  const result: KlineBar[] = [];
  for (const [time, group] of grouped) {
    result.push({
      time,
      open: group[0].open,
      high: Math.max(...group.map(b => b.high)),
      low: Math.min(...group.map(b => b.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((s, b) => s + b.volume, 0),
    });
  }
  return result.sort((a, b) => a.time - b.time);
}

/** Get ms for a timeframe */
function getTimeframeMs(tf: Timeframe): number {
  const map: Record<string, number> = {
    '1s': 1_000, '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
    '1h': 3_600_000, '4h': 14_400_000, 'D': 86_400_000,
    'W': 604_800_000, 'M': 2_592_000_000, Q: 7_776_000_000, Y: 31_536_000_000,
  };
  return map[tf] || 86_400_000;
}

/** Auto-scale Y axis for nice round numbers */
export function niceScale(min: number, max: number, ticks = 6): { min: number; max: number; step: number } {
  const range = max - min || 1;
  const roughStep = range / (ticks - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const niceSteps = [1, 2, 2.5, 5, 10];
  let bestStep = magnitude;
  for (const ns of niceSteps) {
    const candidate = ns * magnitude;
    if (candidate >= roughStep) { bestStep = candidate; break; }
    bestStep = candidate;
  }
  const niceMin = Math.floor(min / bestStep) * bestStep;
  const niceMax = Math.ceil(max / bestStep) * bestStep;
  return { min: niceMin, max: niceMax, step: bestStep };
}

/** Find visible range price extremes */
export function findPriceRange(bars: KlineBar[], startIdx: number, endIdx: number, indicatorLines?: { data: (number | null)[] }[]) {
  let min = Infinity, max = -Infinity;
  for (let i = startIdx; i <= endIdx && i < bars.length; i++) {
    min = Math.min(min, bars[i].low);
    max = Math.max(max, bars[i].high);
  }
  if (indicatorLines) {
    for (const line of indicatorLines) {
      for (let i = startIdx; i <= endIdx && i < line.data.length; i++) {
        const v = line.data[i];
        if (v != null) { min = Math.min(min, v); max = Math.max(max, v); }
      }
    }
  }
  // Add 2% padding
  const pad = (max - min) * 0.02 || min * 0.01;
  return { min: min - pad, max: max + pad };
}
