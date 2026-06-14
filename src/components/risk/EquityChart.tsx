// @ts-nocheck
// ── TradingEasy — EquityChart () ───────────────────────────────────
// strategy/policy/ + 

import { useRef, useEffect, useMemo } from 'react';
import * as echarts from 'echarts';
import i18n from '../../i18n';

export interface EquityPoint {
  time: string; // ISO date or datetime string
  equity: number; // NAV
  benchmark?: number; // Benchmark NAV (optional)
}

interface EquityChartProps {
  data: EquityPoint[];
  title?: string;
  height?: number;
  showDrawdown?: boolean;
  benchmarkLabel?: string;
  dark?: boolean;
}

export default function EquityChart({
  data,
  title = i18n.t('EquityChart.k1'),
  height = 320,
  showDrawdown = true,
  benchmarkLabel = i18n.t('EquityChart.k2'),
  dark = true
}: EquityChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Compute drawdown series
  const { equitySeries, drawdownSeries, stats } = useMemo(() => {
    if (!data || data.length === 0) {
      return { equitySeries: [], drawdownSeries: [], stats: null };
    }

    let peak = data[0].equity;
    const equityArr: [string, number][] = [];
    const ddArr: [string, number][] = [];
    const benchArr: [string, number][] = [];

    data.forEach((d) => {
      if (d.equity > peak) peak = d.equity;
      const dd = peak > 0 ? (peak - d.equity) / peak * 100 : 0;
      equityArr.push([d.time, d.equity]);
      ddArr.push([d.time, dd]);
      if (d.benchmark !== undefined) {
        benchArr.push([d.time, d.benchmark]);
      }
    });

    const start = data[0].equity;
    const end = data[data.length - 1].equity;
    const totalReturn = start > 0 ? (end - start) / start * 100 : 0;
    const maxDD = Math.max(...ddArr.map((d) => d[1]));
    const annualized = data.length > 1 ?
    totalReturn / (data.length / 252) // rough annualization
    : 0;

    return {
      equitySeries: equityArr,
      drawdownSeries: ddArr,
      benchSeries: benchArr,
      stats: { totalReturn, maxDD, annualized, days: data.length }
    };
  }, [data]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    chartInstance.current = echarts.init(chartRef.current, dark ? 'dark' : undefined);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { top: 40, right: 20, bottom: 30, left: 60 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1a25',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params)) return '';
          let html = `<div class="font-mono text-xs">${params[0]?.axisValue}</div>`;
          params.forEach((p: unknown) => {
            const color = p.color;
            const val = typeof p.value === 'number' ? p.value.toFixed(2) : p.value?.[1 as any]?.toFixed(2) || '--';
            html += `<div class="flex items-center gap-2 mt-1"><span style="width:8px;height:8px;border-radius:50%;background:${color}"></span><span>${p.seriesName}: ${val}</span></div>`;
          });
          return html;
        }
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#6b7280', fontSize: 10 },
        splitLine: { show: false }
      },
      yAxis: [
      {
        type: 'value',
        name: i18n.t('EquityChart.k3'),
        nameTextStyle: { color: '#6b7280', fontSize: 10 },
        axisLine: { show: false },
        axisLabel: { color: '#6b7280', fontSize: 10, formatter: (v: number) => v.toFixed(0) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      },
      showDrawdown ?
      {
        type: 'value',
        name: i18n.t('EquityChart.k4'),
        nameTextStyle: { color: '#6b7280', fontSize: 10 },
        axisLine: { show: false },
        axisLabel: { color: '#6b7280', fontSize: 10, formatter: (v: number) => `${v.toFixed(1)}%` },
        splitLine: { show: false },
        inverse: true
      } :
      null].
      filter(Boolean) as any,
      series: [
      {
        name: i18n.t('EquityChart.k5'),
        type: 'line',
        data: equitySeries,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#C9A046' },
        areaStyle: {
          color: new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(201,160,70,0.3)' },
          { offset: 1, color: 'rgba(201,160,70,0)' }]
          )
        }
      },
      ...(showDrawdown ?
      [
      {
        name: i18n.t('EquityChart.k6'),
        type: 'line',
        yAxisIndex: 1,
        data: drawdownSeries,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1, color: '#ef4444', type: 'dashed' as const },
        areaStyle: { color: 'rgba(239,68,68,0.15)' }
      }] :

      []),
      ...(stats && data[0]?.benchmark !== undefined ?
      [
      {
        name: benchmarkLabel,
        type: 'line',
        data: (stats as any).benchSeries || [],
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#6b7280', type: 'dotted' as const }
      }] :

      [])] as
      any[],
      legend: {
        show: true,
        top: 8,
        textStyle: { color: '#9ca3af', fontSize: 11 },
        itemWidth: 14,
        itemHeight: 8
      }
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [equitySeries, drawdownSeries, dark, showDrawdown, data, stats]);

  if (!data || data.length === 0) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5 flex items-center justify-center" style={{ height }}>
        <div className="text-gray-500 text-sm">{i18n.t('EquityChart.k0')}</div>
      </div>);

  }

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-white font-semibold text-sm">{title}</h2>
        {stats &&
        <div className="flex items-center gap-4 text-[10px] font-mono">
            <span className="text-gray-500">{i18n.t("EquityChart.r92_3283")}
            <span className={stats.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {stats.totalReturn >= 0 ? '+' : ''}{stats.totalReturn.toFixed(1)}%
              </span>
            </span>
            <span className="text-gray-500">{i18n.t("EquityChart.r92_838c")}
            <span className="text-red-400">{stats.maxDD.toFixed(1)}%</span>
            </span>
            <span className="text-gray-500">{i18n.t("EquityChart.r92_fd4e")}
            <span className="text-[#D4A853]">{stats.annualized.toFixed(1)}%</span>
            </span>
          </div>
        }
      </div>
      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>);

}