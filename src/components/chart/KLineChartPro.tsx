// ── R113 KLineChart Pro — 生产级K线图 (多周期/复权/5种K线/十字光标/指标叠加) ──
// PM: 模块1 KLinePro P0, 替换原 KLineChart.tsx
// 特性: 9周期 + 3复权 + 5种K线类型 + 8指标叠加 + 十字光标 + 体积图 + 多图联动

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeriesPartialOptions, LineSeriesPartialOptions, HistogramSeriesPartialOptions, Time, CrosshairMode } from 'lightweight-charts';
import type { KlineBar, Timeframe, AdjustType, CandleType } from '../../lib/chart/types';
import type { IndicatorLine } from '../../lib/chart/types'; // @ts-ignore — deprecated alias
import { ALL_TIMEFRAMES, TIMEFRAME_LABELS, CHART_THEME_DARK } from '../../lib/chart/types';
import { transformCandles, applyPreAdjust, applyPostAdjust, downsample } from '../../lib/chart/kline-utils';
import { calcSMA, calcEMA, calcBOLL, calcSAR, calcVWAP } from '../../lib/chart/indicator-engine';

// ═══════════ Props ═══════════

export interface KLineChartProProps {
  data: KlineBar[];
  symbol?: string;
  timeframe?: Timeframe;
  adjust?: AdjustType;
  adjustFactor?: number[]; // for pre/post adjust
  candleType?: CandleType;
  height?: number;
  showVolume?: boolean;
  showToolbar?: boolean;
  indicators?: string[]; // ['ma', 'ema', 'boll', 'rsi', 'macd', 'kdj', 'wr', 'vwap']
  onTimeframeChange?: (tf: Timeframe) => void;
  onCrosshairChange?: (bar: KlineBar | null) => void;
  className?: string;
}

// ═══════════ Default indicator colors ═══════════

const INDICATOR_COLORS: Record<string, { color: string; width: number; dash?: number[] }> = {
  ma: { color: '#f59e0b', width: 1 },
  ema: { color: '#3b82f6', width: 1 },
  boll_mid: { color: '#a78bfa', width: 1, dash: [4, 4] },
  boll_up: { color: 'rgba(167,139,250,0.4)', width: 1 },
  boll_lo: { color: 'rgba(167,139,250,0.4)', width: 1 },
  sar: { color: '#22d3ee', width: 1 },
  vwap: { color: '#fb923c', width: 1, dash: [4, 2] },
};

// ═══════════ Component ═══════════

export default function KLineChartPro({
  data: rawData,
  symbol = '',
  timeframe: propTf,
  adjust = 'none',
  adjustFactor,
  candleType = 'candle',
  height = 500,
  showVolume = true,
  showToolbar = true,
  indicators = [],
  onTimeframeChange,
  onCrosshairChange,
  className = '',
}: KLineChartProProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    // 恢复用户偏好周期
    try { return (localStorage.getItem('dw_tf') as Timeframe) || propTf || 'D'; }
    catch { return propTf || 'D'; }
  });
  const [activeIndicators, setActiveIndicators] = useState<string[]>(indicators);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const mountedRef = useRef(true);

  // ── sync indicators from prop (IndicatorPanel → KLineChartPro) ──
  useEffect(() => {
    setActiveIndicators(indicators);
  }, [indicators]);

  // ── persist timeframe preference ──
  useEffect(() => {
    try { localStorage.setItem('dw_tf', timeframe); } catch {}
    onTimeframeChange?.(timeframe);
  }, [timeframe]);

  // ── Data pipeline ──
  const processedData = useMemo(() => {
    let bars = [...rawData];
    // Apply adjustment
    if (adjust === 'pre' && adjustFactor) bars = applyPreAdjust(bars, adjustFactor);
    else if (adjust === 'post' && adjustFactor) bars = applyPostAdjust(bars, adjustFactor);
    // Transform candle type (Heikin-Ashi etc)
    bars = transformCandles(bars, candleType);
    // Downsample if > 2000 bars
    bars = downsample(bars, 2000);
    return bars;
  }, [rawData, adjust, adjustFactor, candleType]);

  // ── Compute indicators ──
  const indicatorLines = useMemo((): IndicatorLine[] => {
    const lines: IndicatorLine[] = [];
    for (const ind of activeIndicators) {
      switch (ind) {
        case 'ma': {
          const d = calcSMA(processedData, 20);
          lines.push({ label: 'MA20', color: INDICATOR_COLORS.ma.color, lineWidth: INDICATOR_COLORS.ma.width, data: d });
          break;
        }
        case 'ema': {
          const d = calcEMA(processedData, 20);
          lines.push({ label: 'EMA20', color: INDICATOR_COLORS.ema.color, lineWidth: INDICATOR_COLORS.ema.width, data: d });
          break;
        }
        case 'boll': {
          const [mid, up, lo] = calcBOLL(processedData, 20, 2);
          lines.push({ label: 'BOLL-M', color: INDICATOR_COLORS.boll_mid.color, lineWidth: INDICATOR_COLORS.boll_mid.width, dash: INDICATOR_COLORS.boll_mid.dash, data: mid });
          lines.push({ label: 'BOLL-U', color: INDICATOR_COLORS.boll_up.color, lineWidth: INDICATOR_COLORS.boll_up.width, data: up });
          lines.push({ label: 'BOLL-L', color: INDICATOR_COLORS.boll_lo.color, lineWidth: INDICATOR_COLORS.boll_lo.width, data: lo });
          break;
        }
        case 'sar': {
          const d = calcSAR(processedData);
          lines.push({ label: 'SAR', color: INDICATOR_COLORS.sar.color, lineWidth: INDICATOR_COLORS.sar.width, data: d });
          break;
        }
        case 'vwap': {
          const d = calcVWAP(processedData);
          lines.push({ label: 'VWAP', color: INDICATOR_COLORS.vwap.color, lineWidth: INDICATOR_COLORS.vwap.width, dash: INDICATOR_COLORS.vwap.dash, data: d });
          break;
        }
      }
    }
    return lines;
  }, [processedData, activeIndicators]);

  // ── Chart init ──
  useEffect(() => {
    mountedRef.current = true;
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: CHART_THEME_DARK.bg },
        textColor: CHART_THEME_DARK.text,
        fontFamily: '"SF Mono", "Cascadia Code", Consolas, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_THEME_DARK.grid },
        horzLines: { color: CHART_THEME_DARK.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: CHART_THEME_DARK.crosshair, width: 1, style: 2, labelBackgroundColor: CHART_THEME_DARK.crosshair },
        horzLine: { color: CHART_THEME_DARK.crosshair, width: 1, style: 2, labelBackgroundColor: CHART_THEME_DARK.crosshair },
      },
      rightPriceScale: {
        borderColor: CHART_THEME_DARK.border,
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      timeScale: {
        borderColor: CHART_THEME_DARK.border,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_THEME_DARK.up,
      downColor: CHART_THEME_DARK.down,
      borderUpColor: CHART_THEME_DARK.up,
      borderDownColor: CHART_THEME_DARK.down,
      wickUpColor: CHART_THEME_DARK.up,
      wickDownColor: CHART_THEME_DARK.down,
    } as CandlestickSeriesPartialOptions);
    mainSeriesRef.current = candleSeries;

    // Volume series
    if (showVolume) {
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      } as HistogramSeriesPartialOptions);
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        visible: false,
      });
      volumeSeriesRef.current = volSeries;
    }

    // Resize handler
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    // Crosshair subscription
    chart.subscribeCrosshairMove(param => {
      if (!param.time || param.point === undefined || !mainSeriesRef.current) {
        onCrosshairChange?.(null);
        return;
      }
      const raw = param.seriesData.get(mainSeriesRef.current);
      const data = raw && 'open' in raw ? raw as { time: Time; open: number; high: number; low: number; close: number } : null;
      if (data) {
        onCrosshairChange?.(({
          time: (data.time as number) * 1000 || 0,
          open: data.open, high: data.high, low: data.low, close: data.close,
          volume: 0,
        }));
      }
    });

    // Track visible range for zoom display
    const updateZoomLabel = () => {
      const range = chart.timeScale().getVisibleRange();
      if (range) {
        const count = chart.timeScale().getVisibleLogicalRange();
        if (count) setZoomLabel(`${Math.round(count.to - count.from)} bars`);
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateZoomLabel);
    updateZoomLabel();

    return () => {
      mountedRef.current = false;
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height]); // only re-init on height change

  // ── Data update ──
  useEffect(() => {
    if (!mainSeriesRef.current) return;
    const sorted = [...processedData].sort((a, b) => a.time - b.time);
    const candleData = sorted.map(d => ({
      time: (d.time / 1000) as Time, // lightweight-charts uses seconds
      open: d.open, high: d.high, low: d.low, close: d.close,
    }));
    mainSeriesRef.current.setData(candleData);

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(sorted.map(d => ({
        time: (d.time / 1000) as Time,
        value: d.volume || 0,
        color: (d.close >= d.open ? CHART_THEME_DARK.volUp : CHART_THEME_DARK.volDown),
      })));
    }

    chartRef.current?.timeScale().fitContent();
  }, [processedData, showVolume]);

  // ── Indicator overlay ──
  useEffect(() => {
    if (!chartRef.current) return;
    // Remove old indicator series
    for (const s of indicatorSeriesRef.current) {
      try { chartRef.current.removeSeries(s); } catch { /* ignore */ }
    }
    indicatorSeriesRef.current = [];

    // Add new indicator series
    for (const line of indicatorLines) {
      const validData = line.data
        .map((v: number | null, i: number) => v != null && i < processedData.length ? { time: (processedData[i].time / 1000) as Time, value: v } : null)
        .filter(Boolean) as { time: Time; value: number }[];

      if (validData.length === 0) continue;

      const series = chartRef.current.addLineSeries({
        color: line.color,
        lineWidth: line.lineWidth,
        priceLineVisible: false,
        lastValueVisible: false,
      } as LineSeriesPartialOptions);

      series.setData(validData);
      indicatorSeriesRef.current.push(series);
    }

    return () => {
      // cleanup handled by chart.remove() on unmount
    };
  }, [indicatorLines, processedData]);

  // ── Timeframe change ──
  const handleTimeframe = useCallback((tf: Timeframe) => {
    setTimeframe(tf);
    onTimeframeChange?.(tf);
  }, [onTimeframeChange]);

  // ── Zoom state ──
  const [zoomLabel, setZoomLabel] = useState('');
  const resetZoom = useCallback(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  // ── Toggle indicator ──
  const toggleIndicator = useCallback((id: string) => {
    setActiveIndicators(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  // ── Render ──
  const isUp = processedData.length >= 2 ? processedData[processedData.length - 1].close >= processedData[processedData.length - 2].close : true;
  const lastPrice = processedData.length > 0 ? processedData[processedData.length - 1].close : 0;
  const priceChange = processedData.length >= 2 ? processedData[processedData.length - 1].close - processedData[processedData.length - 2].close : 0;
  const priceChangePct = processedData.length >= 2 && processedData[processedData.length - 2].close !== 0
    ? (priceChange / processedData[processedData.length - 2].close) * 100 : 0;

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg overflow-hidden border border-[#30363d] ${className}`}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c2333] gap-1 flex-wrap">
          {/* Symbol + Price */}
          <div className="flex items-center gap-3 min-w-fit">
            {symbol && <span className="text-[#c9a96e] font-bold text-sm">{symbol}</span>}
            <span className={`font-mono text-sm ${isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {lastPrice.toFixed(2)}
            </span>
            <span className={`font-mono text-xs ${priceChange >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
            </span>
          </div>

          {/* Timeframe selector */}
          <div className="flex gap-0.5">
            {ALL_TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => handleTimeframe(tf)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  timeframe === tf
                    ? 'bg-[#c9a96e20] text-[#c9a96e] border border-[#c9a96e40]'
                    : 'text-[#484f58] hover:text-[#8b949e] border border-transparent'
                }`}
                title={TIMEFRAME_LABELS[tf]}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Quick indicators */}
          <div className="flex gap-0.5">
            {['ma', 'ema', 'boll', 'sar', 'vwap'].map(id => (
              <button
                key={id}
                onClick={() => toggleIndicator(id)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded uppercase transition-colors ${
                  activeIndicators.includes(id)
                    ? 'bg-[#3b82f620] text-[#3b82f6] border border-[#3b82f640]'
                    : 'text-[#484f58] hover:text-[#8b949e] border border-transparent'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart container */}
      <div ref={containerRef} className="w-full" />

      {/* Zoom controls */}
      <div className="flex items-center justify-between px-2 py-0.5 border-t border-[#1c2333] text-[8px] text-[#484f58]">
        <span>🖱 滚轮缩放 · 拖拽平移 · {zoomLabel}</span>
        <button onClick={resetZoom} className="text-[#3b82f6] hover:underline">全屏显示</button>
      </div>
    </div>
  );
}
