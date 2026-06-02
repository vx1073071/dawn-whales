// ── KLineChart — TradingView Lightweight Charts ─────────────────────────────
import { useEffect, useRef } from 'react';
import { createChart, IChartApi } from 'lightweight-charts';

interface KLineChartProps {
  data: Array<{
    time: number; // unix timestamp in seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
  height?: number;
}

export default function KLineChart({ data, height = 400 }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#0d1117' },
        textColor: '#8b949e',
        fontFamily: '"SF Mono", "Cascadia Code", Consolas, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1c2333' },
        horzLines: { color: '#1c2333' },
      },
      crosshair: {
        mode: 0, // Normal
        vertLine: { color: '#c9a96e', width: 1, style: 2, labelBackgroundColor: '#c9a96e' },
        horzLine: { color: '#c9a96e', width: 1, style: 2, labelBackgroundColor: '#c9a96e' },
      },
      rightPriceScale: {
        borderColor: '#30363d',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Add candlestick series (v4 API)
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#f85149',       // 涨 = 红 (中国市场习惯)
      downColor: '#3fb950',     // 跌 = 绿
      borderUpColor: '#f85149',
      borderDownColor: '#3fb950',
      wickUpColor: '#f85149',
      wickDownColor: '#3fb950',
    });

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Set data
    if (data.length > 0) {
      const sorted = [...data].sort((a, b) => a.time - b.time);
      candleSeries.setData(sorted.map(d => ({
        time: d.time as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })));

      volumeSeries.setData(sorted.map(d => ({
        time: d.time as any,
        value: d.volume || 0,
        color: d.close >= d.open ? 'rgba(248,81,73,0.3)' : 'rgba(63,185,80,0.3)',
      })));

      chart.timeScale().fitContent();
    }

    // Resize handler
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height]);

  return (
    <div className="bg-surface-1 rounded-lg overflow-hidden border border-border">
      <div ref={containerRef} />
    </div>
  );
}
