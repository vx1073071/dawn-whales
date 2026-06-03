// ── KLineChart — TradingView Lightweight Charts + MA Overlays ──────────────
import { useEffect, useRef, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';

interface KLineChartProps {
  data: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
  height?: number;
  showMA?: boolean;
}

// Downsample data for large datasets (>500 candles)
function downsample(data: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>, maxBars: number) {
  if (!Array.isArray(data) || data.length <= maxBars) return data;
  const step = Math.ceil(data.length / maxBars);
  const result: typeof data = [];
  for (let i = 0; i < data.length; i += step) {
    const chunk = data.slice(i, i + step);
    result.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((c: any) => c.high)),
      low: Math.min(...chunk.map((c: any) => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum: number, c: any) => sum + (c.volume || 0), 0),
    });
  }
  return result;
}

// Calculate Simple Moving Average
function calcSMA(data: { time: number; close: number }[], period: number): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
    result.push({ time: data[i].time, value: +(sum / period).toFixed(2) });
  }
  return result;
}

export default function KLineChart({ data, height = 400, showMA = true }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Downsample for >1000 candles
  const displayData = useMemo(() => downsample(data, 1000), [data]);

  // Calculate MAs
  const ma5 = useMemo(() => showMA ? calcSMA(displayData, 5) : [], [displayData, showMA]);
  const ma20 = useMemo(() => showMA ? calcSMA(displayData, 20) : [], [displayData, showMA]);
  const ma60 = useMemo(() => showMA ? calcSMA(displayData, 60) : [], [displayData, showMA]);

  useEffect(() => {
    if (!containerRef.current) return;

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
        mode: 0,
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

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#f85149',
      downColor: '#3fb950',
      borderUpColor: '#f85149',
      borderDownColor: '#3fb950',
      wickUpColor: '#f85149',
      wickDownColor: '#3fb950',
    });

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Set data
    if (displayData.length > 0) {
      const sorted = [...displayData].sort((a, b) => a.time - b.time);
      candleSeries.setData(sorted.map(d => ({
        time: d.time as any,
        open: d.open, high: d.high, low: d.low, close: d.close,
      })));

      volumeSeries.setData(sorted.map(d => ({
        time: d.time as any,
        value: d.volume || 0,
        color: d.close >= d.open ? 'rgba(248,81,73,0.3)' : 'rgba(63,185,80,0.3)',
      })));

      // MA overlays
      if (showMA) {
        const series: ISeriesApi<'Line'>[] = [];
        if (ma5.length > 0) {
          const s = chart.addLineSeries({ color: '#D4A853', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          s.setData(ma5.map(d => ({ time: d.time as any, value: d.value })));
          series.push(s);
        }
        if (ma20.length > 0) {
          const s = chart.addLineSeries({ color: '#60a5fa', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          s.setData(ma20.map(d => ({ time: d.time as any, value: d.value })));
          series.push(s);
        }
        if (ma60.length > 0) {
          const s = chart.addLineSeries({ color: '#c084fc', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          s.setData(ma60.map(d => ({ time: d.time as any, value: d.value })));
          series.push(s);
        }
      }

      chart.timeScale().fitContent();
    }

    // Resize
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
  }, [displayData, height, showMA, ma5, ma20, ma60]);

  return (
    <div className="bg-surface-1 rounded-lg overflow-hidden border border-border relative">
      {showMA && (
        <div className="absolute top-2 left-3 z-10 flex gap-3 text-[10px]">
          <span className="text-[#D4A853]">MA5</span>
          <span className="text-[#60a5fa]">MA20</span>
          <span className="text-[#c084fc]">MA60</span>
          {data.length > 1000 && <span className="text-gray-600">已降采样至1000根</span>}
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
