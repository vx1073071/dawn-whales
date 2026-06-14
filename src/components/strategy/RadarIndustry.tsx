// ── R168 P2-03: Radar Industry Chart Component ──────────────────────────
// Factor exposure radar chart with industry benchmark overlay.
// Shows strategy factor exposure vs industry average.
// Each axis = one factor, grey polygon = industry baseline, colored = strategy.

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

// ── Types ────────────────────────────────────────────────────────────────────

interface FactorValue {
  factorId: string;
  nameCN: string;
  strategyExposure: number;     // -1 to +1
  industryBenchmark: number;    // -1 to +1
}

interface RadarIndustryProps {
  factors: FactorValue[];
  strategyName?: string;
  industryName?: string;
  height?: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export const RadarIndustry: React.FC<RadarIndustryProps> = ({
  factors,
  strategyName = '当前策略',
  industryName = '行业均值',
  height = 380,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || factors.length === 0) return;

    const chart = echarts.init(chartRef.current, undefined, { renderer: 'svg' });

    const indicators = factors.map((f) => ({
      name: f.nameCN,
      max: 1.0,
      min: -1.0,
    }));

    const strategyData = factors.map((f) => f.strategyExposure);
    const industryData = factors.map((f) => f.industryBenchmark);

    chart.setOption({
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: '#333',
        textStyle: { color: '#e5e7eb', fontSize: 11 },
      },
      legend: {
        data: [strategyName, industryName],
        bottom: 0,
        textStyle: { color: '#9ca3af', fontSize: 10 },
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 20,
      },
      radar: {
        center: ['50%', '48%'],
        radius: '62%',
        indicator: indicators,
        axisName: { color: '#e5e7eb', fontSize: 10, borderRadius: 3, padding: [2, 4] },
        splitArea: {
          areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] },
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [
        {
          type: 'radar',
          name: strategyName,
          data: [{ value: strategyData, name: strategyName }],
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: '#C9A046', width: 2.5 },
          areaStyle: { color: 'rgba(201,160,70,0.12)' },
          itemStyle: { color: '#C9A046' },
          emphasis: { lineStyle: { width: 3 } },
        },
        {
          type: 'radar',
          name: industryName,
          data: [{ value: industryData, name: industryName }],
          symbol: 'diamond',
          symbolSize: 4,
          lineStyle: { color: '#6b7280', width: 2, type: 'dashed' },
          areaStyle: { color: 'rgba(107,114,128,0.08)' },
          itemStyle: { color: '#6b7280' },
          emphasis: { lineStyle: { width: 2.5 } },
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [factors, strategyName, industryName]);

  if (factors.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-xs">暂无因子数据</div>
    );
  }

  // ── Divergence table ────────────────────────────────────────────────
  const divergences = factors
    .map((f) => ({
      ...f,
      diff: f.strategyExposure - f.industryBenchmark,
    }))
    .filter((f) => Math.abs(f.diff) > 0.1)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return (
    <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-4">
      <h3 className="text-xs font-semibold text-gray-300 mb-3">
        🎯 因子暴露 vs {industryName}
      </h3>
      <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />

      {/* Biggest divergences */}
      {divergences.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="text-[10px] text-gray-500 mb-2">⚡ 显著偏离行业均值 (|偏差| &gt; 0.1)</div>
          <div className="flex flex-wrap gap-2">
            {divergences.map((d) => (
              <div
                key={d.factorId}
                className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                  d.diff > 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {d.nameCN} {d.diff > 0 ? '+' : ''}{d.diff.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-3 text-[10px] text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[#C9A046] inline-block"></span> {strategyName}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0 bg-gray-500 inline-block" style={{ borderTop: '1.5px dashed #6b7280' }}></span> {industryName}
        </span>
      </div>
    </div>
  );
};

export default RadarIndustry;
