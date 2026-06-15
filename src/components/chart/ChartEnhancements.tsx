// ── R126 Chart Enhancements ────────────────────────────────────────────────
// M02: 十字光标增强 (OHLC详情+时间+涨跌幅)
// M03: 持仓标记 (买入▲绿色 / 卖出▼红色)
// M04: K线截图导出 (html2canvas→PNG)
// M06: 复制到剪贴板 + 双击行为统一
// M07: Replay逐帧播放

import { useCallback, useRef, useState, useEffect } from 'react';
import type { KlineBar } from '../../lib/chart/types';

// ═══════════ M02: Crosshair detail formatter ═══════════

export interface CrosshairDetail {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Price change from the previous bar */
  changePct: number;
  /** Formatted time string */
  timeStr: string;
  /** Formatted OHLC strings */
  ohlc: string;
}

export function formatCrosshairDetail(
  bar: KlineBar | null,
  prevBar?: KlineBar | null
): CrosshairDetail | null {
  if (!bar) return null;

  const changePct = prevBar && prevBar.close !== 0
    ? ((bar.close - prevBar.close) / prevBar.close) * 100
    : 0;

  const d = new Date(bar.time);
  const timeStr = d.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });

  return {
    time: bar.time,
    open: bar.open, high: bar.high, low: bar.low, close: bar.close,
    volume: bar.volume || 0,
    changePct,
    timeStr,
    ohlc: `O:${bar.open.toFixed(2)} H:${bar.high.toFixed(2)} L:${bar.low.toFixed(2)} C:${bar.close.toFixed(2)}`,
  };
}

/**
 * Crosshair legend component — renders OHLC detail + time + change%
 * Displayed as a floating tooltip following the crosshair
 */
export function CrosshairLegend({
  detail, x, y, chartWidth
}: {
  detail: CrosshairDetail | null;
  x: number;
  y: number;
  chartWidth: number;
}) {
  if (!detail) return null;

  const isUp = detail.changePct >= 0;
  // Position: right of crosshair if room, else left
  const left = x > chartWidth / 2 ? 'auto' : x + 12;
  const right = x > chartWidth / 2 ? chartWidth - x + 12 : 'auto';

  return (
    <div
      className="absolute z-30 bg-[#161b22]/95 border border-[#30363d] rounded px-2.5 py-1.5 shadow-xl pointer-events-none select-none backdrop-blur-sm"
      style={{ left: left !== 'auto' ? left : undefined, right: right !== 'auto' ? right : undefined, top: Math.max(y - 60, 10), fontFamily: 'monospace' }}
    >
      <div className="text-[9px] text-[#484f58] mb-1">{detail.timeStr}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-[#c9d1d9]">{detail.close.toFixed(2)}</span>
        <span className={`text-[9px] ${isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {isUp ? '+' : ''}{detail.changePct.toFixed(2)}%
        </span>
      </div>
      <div className="text-[8px] text-[#8b949e] mt-0.5 leading-relaxed">
        O <span className="text-[#c9d1d9]">{detail.open.toFixed(2)}</span>
        {' '}H <span className="text-[#c9d1d9]">{detail.high.toFixed(2)}</span>
        {' '}L <span className="text-[#c9d1d9]">{detail.low.toFixed(2)}</span>
        {' '}C <span className="text-[#c9d1d9]">{detail.close.toFixed(2)}</span>
      </div>
      <div className="text-[8px] text-[#484f58] mt-0.5">
        Vol: {detail.volume >= 1e9 ? `${(detail.volume / 1e9).toFixed(2)}B` : detail.volume >= 1e6 ? `${(detail.volume / 1e6).toFixed(2)}M` : detail.volume.toLocaleString()}
      </div>
    </div>
  );
}

// ═══════════ M03: Position Markers ═══════════

export interface PositionMarker {
  id: string;
  time: number;    // timestamp
  price: number;
  side: 'buy' | 'sell';
  amount?: number;
  pnl?: number;
  pnlPct?: number;
}

/**
 * Position marker legend — shows buy/sell markers on the chart
 * Rendered via lightweight-charts primitive markers or custom series
 */
export function PositionMarkersLegend({
  markers, visible
}: {
  markers: PositionMarker[];
  visible: boolean;
}) {
  if (!visible || markers.length === 0) return null;

  const buys = markers.filter(m => m.side === 'buy');
  const sells = markers.filter(m => m.side === 'sell');

  return (
    <div className="absolute bottom-2 left-2 z-20 flex gap-2 pointer-events-none">
      {buys.length > 0 && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#161b22]/90 border border-[#22c55e30] rounded text-[9px]">
          <span className="text-[#22c55e]">▲</span>
          <span className="text-[#c9d1d9]">{buys.length} 买入</span>
        </div>
      )}
      {sells.length > 0 && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#161b22]/90 border border-[#ef444430] rounded text-[9px]">
          <span className="text-[#ef4444]">▼</span>
          <span className="text-[#c9d1d9]">{sells.length} 卖出</span>
        </div>
      )}
    </div>
  );
}

// ═══════════ M04: Screenshot Export ═══════════

export async function exportChartScreenshot(
  chartContainer: HTMLElement | null,
  symbol: string,
  timeframe: string
): Promise<void> {
  if (!chartContainer) return;

  try {
    const { default: html2canvas } = await import('html2canvas');

    const canvas = await html2canvas(chartContainer, {
      backgroundColor: '#0d1117',
      scale: 2, // retina
      useCORS: true,
      logging: false,
    });

    // Download
    const link = document.createElement('a');
    link.download = `${symbol}_${timeframe}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.warn('Screenshot export failed:', err);
    // Fallback: just download canvas directly
    const candidate = chartContainer.querySelector('canvas');
    if (candidate) {
      const link = document.createElement('a');
      link.download = `${symbol}_${timeframe}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = candidate.toDataURL('image/png');
      link.click();
    }
  }
}

// ═══════════ M06: Copy to clipboard utility ═══════════

export function useClipboard() {
  const lastCopyRef = useRef('');

  const copy = useCallback(async (text: string,_label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      lastCopyRef.current = text;
      return true;
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      lastCopyRef.current = text;
      return true;
    }
  }, []);

  return { copy, lastCopyRef };
}

/**
 * Double-click behavior: fit content (reset zoom)
 */
export function useDoubleClickFit(onFit: () => void) {
  const lastClickRef = useRef(0);

  const handleClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < 300) {
      onFit(); // double click detected
    }
    lastClickRef.current = now;
  }, [onFit]);

  return handleClick;
}

// ═══════════ M07: Replay frame-by-frame control ═══════════

export interface ReplayFrameControl {
  currentFrame: number;
  totalFrames: number;
  currentBar: KlineBar | null;
  nextFrame: () => void;
  prevFrame: () => void;
  reset: () => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
}

/**
 * Hook for frame-by-frame replay of K-line data
 */
export function useReplayFrames(
  bars: KlineBar[],
  playbackSpeed = 200 // ms between frames in auto-play
): ReplayFrameControl {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalFrames = bars.length;
  const currentBar = bars[currentFrame] || null;

  const nextFrame = useCallback(() => {
    setCurrentFrame(prev => Math.min(prev + 1, totalFrames - 1));
  }, [totalFrames]);

  const prevFrame = useCallback(() => {
    setCurrentFrame(prev => Math.max(prev - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setCurrentFrame(0);
    setIsPlaying(false);
  }, []);

  // Auto-play
  useEffect(() => {
    if (isPlaying && currentFrame < totalFrames - 1) {
      timerRef.current = setInterval(() => {
        setCurrentFrame(prev => {
          if (prev >= totalFrames - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalFrames, playbackSpeed]);

  return { currentFrame, totalFrames, currentBar, nextFrame, prevFrame, reset, isPlaying, setIsPlaying };
}
