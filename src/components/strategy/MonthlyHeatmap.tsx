// ── R168 P2-04: Monthly Factor Heatmap ──────────────────────────────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// 12 months × 8 factors heatmap with color scale.
// Shows IC values for each factor-month combination.
// Hover shows exact IC value + factor name + month.
// Legend with color gradient from red (negative) to green (positive).

import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

// ── Types ────────────────────────────────────────────────────────────────────

interface MonthlyHeatmapProps {
  months?: string[]; // default: Jan~Dec
  factors?: Array<{ id: string; nameCN: string }>;
  data?: number[][]; // [factorIndex][monthIndex] = IC value
  year?: number;
}

// ── Default factor list ──────────────────────────────────────────────────────

const DEFAULT_FACTORS = [
  { id: 'MKT', nameCN: '市场Beta' },
  { id: 'MOM_12M', nameCN: '12月动量' },
  { id: 'HML', nameCN: '价值因子' },
  { id: 'VOL_60D', nameCN: '60日低波' },
  { id: 'QUAL', nameCN: '品质因子' },
  { id: 'SMB', nameCN: '小盘因子' },
  { id: 'LIQ', nameCN: '流动性' },
  { id: 'YIELD', nameCN: '股息率' },
];

const DEFAULT_MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function generateMockData(): number[][] {
  return DEFAULT_FACTORS.map(() =>
    DEFAULT_MONTHS.map(() => Number(((Math.random() - 0.35) * 0.1).toFixed(4)))
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export const MonthlyHeatmap: React.FC<MonthlyHeatmapProps> = ({
  months: customMonths,
  factors: customFactors,
  data: customData,
  year,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  const months = customMonths || DEFAULT_MONTHS;
  const factors = customFactors || DEFAULT_FACTORS;
  const data = customData || generateMockData();

  useEffect(() => {
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!chartRef.current || !loaded) return;

    const chart = echarts.init(chartRef.current, undefined, { renderer: 'svg' });

    const heatData: Array<[number, number, number]> = [];
    factors.forEach((_, fi) => {
      data[fi]?.forEach((v, mi) => {
        heatData.push([mi, fi, v]);
      });
    });

    const maxAbs = Math.max(...heatData.map((d) => Math.abs(d[2])), 0.06);

    chart.setOption({
      tooltip: {
        position: 'top',
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: '#333',
        textStyle: { color: '#e5e7eb', fontSize: 11 },
        formatter: (params: { data: [number, number, number] }) => {
          const mi = params.data[0];
          const fi = params.data[1];
          return `<b>${factors[fi]?.nameCN}</b> · ${months[mi]}<br/>IC: <b>${params.data[2].toFixed(4)}</b>`;
        },
      },
      grid: { left: 90, right: 30, top: 15, bottom: 45 },
      xAxis: {
        type: 'category',
        data: months,
        position: 'top',
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      yAxis: {
        type: 'category',
        data: factors.map((f) => f.nameCN),
        axisLabel: { color: '#e5e7eb', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      visualMap: {
        min: -maxAbs,
        max: maxAbs,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 5,
        itemWidth: 12,
        itemHeight: 100,
        inRange: {
          color: ['#d50000', '#ff5252', '#ffab40', '#1a1a2e', '#aeea00', '#64dd17', '#00c853'],
        },
        textStyle: { color: '#9ca3af', fontSize: 10 },
      },
      series: [{
        type: 'heatmap',
        data: heatData,
        label: {
          show: true,
          color: '#e5e7eb',
          fontSize: 9,
          formatter: (p: { data: [number, number, number] }) =>
            p.data[2].toFixed(3).replace(/^0/, ''),
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.5)',
            borderColor: '#C9A046',
            borderWidth: 1,
          },
        },
      }],
    });

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [loaded, months, factors, data]);

  // Summary stats
  const positiveMonths = data.map((row) => row.filter((v) => v > 0).length);
  const avgIC = data.map((row) => {
    const sum = row.reduce((a, b) => a + b, 0);
    return Number((sum / row.length).toFixed(4));
  });

  return (
    <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-4">
      <h3 className="text-xs font-semibold text-gray-300 mb-3">
        🗓️ 月度因子IC热力图 {year ? `(${year}年)` : ''}
      </h3>

      {/* Heatmap */}
      <div ref={chartRef} style={{ width: '100%', height: '380px' }} />

      {/* Summary table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-white/5 text-gray-500">
              <th className="py-1.5 px-2 text-left">因子</th>
              <th className="py-1.5 px-2 text-right">正IC月数</th>
              <th className="py-1.5 px-2 text-right">平均IC</th>
              <th className="py-1.5 px-2 text-center">评估</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f, i) => {
              const pos = positiveMonths[i] ?? 0;
              const avg = avgIC[i] ?? 0;
              return (
                <tr key={f.id} className="border-b border-white/[0.02]">
                  <td className="py-1.5 px-2 text-white">{f.nameCN}</td>
                  <td className="py-1.5 px-2 text-right text-gray-300">{pos}/{months.length}</td>
                  <td className={`py-1.5 px-2 text-right font-mono ${
                    avg > 0.03 ? 'text-green-400' : avg > 0 ? 'text-green-400/50' : 'text-red-400'
                  }`}>
                    {avg.toFixed(4)}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      pos >= 9 ? 'bg-green-500/20 text-green-400' :
                      pos >= 6 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {pos >= 9 ? '稳定' : pos >= 6 ? '一般' : '不稳定'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonthlyHeatmap;
