// ── DAWN WHALES — PortfolioAllocationChart (持仓分配环形图) ────────────────

import { useRef, useEffect, useMemo } from 'react';
import * as echarts from 'echarts';

export interface AllocationItem {
  name: string;
  value: number;
  pnl: number;
  pnlPct: number;
}

interface PortfolioAllocationChartProps {
  data: AllocationItem[];
  title?: string;
  height?: number;
  dark?: boolean;
}

export default function PortfolioAllocationChart({
  data,
  title = '持仓分配',
  height = 280,
  dark = true,
}: PortfolioAllocationChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const { pieData, totalValue, totalPnl } = useMemo(() => {
    if (!data || data.length === 0) return { pieData: [], totalValue: 0, totalPnl: 0 };
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const total = sorted.reduce((s, d) => s + d.value, 0);
    const pnl = sorted.reduce((s, d) => s + d.pnl, 0);
    return {
      pieData: sorted.map((d) => ({
        name: d.name,
        value: d.value,
        pnl: d.pnl,
        pnlPct: d.pnlPct,
        itemStyle: {
          color: d.pnl >= 0
            ? `rgba(34, 197, 94, ${0.4 + Math.min(Math.abs(d.pnlPct) / 50, 0.5)})`
            : `rgba(239, 68, 68, ${0.4 + Math.min(Math.abs(d.pnlPct) / 50, 0.5)})`,
        },
      })),
      totalValue: total,
      totalPnl: pnl,
    };
  }, [data]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.dispose();

    chartInstance.current = echarts.init(chartRef.current, dark ? 'dark' : undefined);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1a1a25',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: any) => {
          const d = params.data;
          const pct = params.percent;
          const pnlColor = d.pnl >= 0 ? '#34d399' : '#f87171';
          return `<div class="font-mono text-xs">
            <div class="font-medium">${d.name}</div>
            <div>占比: ${pct.toFixed(1)}%</div>
            <div>市值: $${d.value.toLocaleString()}</div>
            <div style="color:${pnlColor}">盈亏: ${d.pnl >= 0 ? '+' : ''}$${d.pnl.toFixed(0)} (${d.pnlPct.toFixed(1)}%)</div>
          </div>`;
        },
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: '#9ca3af', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
        formatter: (name: string) => {
          const item = pieData.find((d) => d.name === name);
          if (!item) return name;
          return `${name}  ${((item.value / totalValue) * 100).toFixed(0)}%`;
        },
      },
      series: [
        {
          name: '持仓分配',
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['38%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#1a1a25',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 13,
              fontWeight: 'bold',
              color: '#fff',
              formatter: '{b}\n{d}%',
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0,0,0,0.5)',
            },
          },
          data: pieData,
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [pieData, totalValue, dark]);

  if (!data || data.length === 0) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5 flex items-center justify-center" style={{ height }}>
        <div className="text-gray-500 text-sm">暂无持仓数据</div>
      </div>
    );
  }

  const pnlColor = totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-white font-semibold text-sm">{title}</h2>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="text-gray-500">
            总持仓 <span className="text-gray-300">${(totalValue / 10000).toFixed(1)}万</span>
          </span>
          <span className="text-gray-500">
            总盈亏 <span className={pnlColor}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)}</span>
          </span>
        </div>
      </div>
      <div ref={chartRef} style={{ width: '100%', height }} />
      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
          盈利持仓
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500/60" />
          亏损持仓
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-500/60" />
          颜色深浅 = 盈亏幅度
        </span>
      </div>
    </div>
  );
}
