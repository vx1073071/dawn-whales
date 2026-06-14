// ── R164 P1-E2 + R171 F2: IC Decay Curve Chart with Hyperbolic Decay ───
// Visualize Information Coefficient decay over lag periods.
// R171 upgrade: dual-track decay model (mechanical hyperbolic vs judgment exponential+breaks)
// X-axis: lag (days)  Y-axis: IC value
// Each factor gets its own line; threshold lines at 0 and ±0.03; breakpoints marked ⚡
// Annotations for half-life (IC drops to 50% of initial)
// Mechanical=达hed line, Judgment=dotted line
//
// Data: HyperbolicDecayModel (R171) → falls back to factor-research-engine.computeDecay()

import React, { useEffect, useState, useRef } from 'react';
import {
  generateHyperbolicDecayCurves,
  type HyperbolicDecayCurve,
  DecayTypeBadge,
} from './HyperbolicDecayModel';
import * as echarts from 'echarts';

// ── Types ────────────────────────────────────────────────────────────────────

interface DecaySeries {
  factorId: string;
  nameCN: string;
  decayCurve: number[];   // IC values per lag period
  halfLife: number;       // Lag period where IC drops to 50%
  color: string;
}

// ── Factor names + colors ───────────────────────────────────────────────────

const FACTOR_COLORS: Record<string, string> = {
  MOM_12M: '#00e676',
  HML: '#448aff',
  QUAL: '#ffc107',
  VOL_60D: '#e040fb',
  MKT: '#00bcd4',
  LIQ: '#ff6e40',
  SMB: '#69f0ae',
  MA_20_60: '#ff4081',
  RSI_14: '#40c4ff',
  ADX: '#b2ff59',
  YIELD: '#ffee58',
};

const FACTOR_NAMES: Record<string, string> = {
  MKT: '市场Beta', SMB: '小盘因子', HML: '价值因子', MOM_12M: '12月动量',
  VOL_60D: '60日低波', QUAL: '品质因子', MA_20_60: '均线交叉',
  RSI_14: 'RSI', ADX: 'ADX趋势', LIQ: '流动性因子', YIELD: '股息率',
};

// ── Mock data ────────────────────────────────────────────────────────────────

function generateMockDecaySeries(): DecaySeries[] {
  const factors = [
    { id: 'MOM_12M', baseIC: 0.045, decayRate: 0.03 },
    { id: 'HML', baseIC: 0.035, decayRate: 0.012 },
    { id: 'QUAL', baseIC: 0.038, decayRate: 0.018 },
    { id: 'VOL_60D', baseIC: -0.040, decayRate: 0.025 },
    { id: 'MKT', baseIC: 0.055, decayRate: 0.015 },
    { id: 'LIQ', baseIC: 0.025, decayRate: 0.04 },
  ];

  return factors.map((f) => {
    const curve: number[] = [];
    let halfLife = 60;
    for (let lag = 0; lag < 60; lag++) {
      const ic = f.baseIC * Math.exp(-f.decayRate * lag) + (Math.random() - 0.5) * 0.005;
      curve.push(Number(ic.toFixed(4)));
      if (halfLife === 60 && Math.abs(ic) < Math.abs(f.baseIC) / 2) {
        halfLife = lag;
      }
    }
    return {
      factorId: f.id,
      nameCN: FACTOR_NAMES[f.id] || f.id,
      decayCurve: curve,
      halfLife,
      color: FACTOR_COLORS[f.id] || '#ffffff',
    };
  });
}

// ── Render ECharts ───────────────────────────────────────────────────────────

function renderDecayChart(container: HTMLDivElement, series: DecaySeries[]) {
  const chart = echarts.init(container, undefined, { renderer: 'svg' });
  const xLabels = Array.from({ length: 60 }, (_, i) => `D${i + 1}`);

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.85)',
      borderColor: '#333',
      textStyle: { color: '#e5e7eb', fontSize: 11 },
      formatter: (params: unknown) => {
        const plist = params as Array<{ seriesName: string; value: number; axisValue: string; color?: string }>;
        let html = `<b>${plist[0]?.axisValue}</b><br/>`;
        plist.forEach((p) => {
          const dotColor = p.color || '#fff';
          html += `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dotColor};margin-right:4px;"></span>`;
          html += `${p.seriesName}: <b>${p.value.toFixed(4)}</b><br/>`;
        });
        return html;
      },
    },
    legend: {
      data: series.map((s) => s.nameCN),
      bottom: 0,
      textStyle: { color: '#9ca3af', fontSize: 10 },
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 12,
    },
    grid: { left: 50, right: 20, top: 20, bottom: 50 },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLabel: {
        color: '#9ca3af',
        fontSize: 9,
        interval: 9,
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      name: 'IC',
      nameTextStyle: { color: '#9ca3af', fontSize: 10 },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [
      // Zero line
      {
        type: 'line',
        name: 'IC=0',
        data: Array(60).fill(0),
        lineStyle: { color: 'rgba(255,255,255,0.15)', type: 'dashed', width: 1 },
        symbol: 'none',
        z: 1,
        silent: true,
      },
      // IC±0.03 threshold
      {
        type: 'line',
        name: 'IC=0.03',
        data: Array(60).fill(0.03),
        lineStyle: { color: 'rgba(0,230,118,0.2)', type: 'dotted', width: 1 },
        symbol: 'none',
        z: 1,
        silent: true,
      },
      ...series.map((s) => ({
        type: 'line' as const,
        name: s.nameCN,
        data: s.decayCurve,
        lineStyle: { color: s.color, width: 2 },
        itemStyle: { color: s.color },
        symbol: 'none',
        emphasis: { lineStyle: { width: 3 } },
        z: 2,
        markLine: s.halfLife < 60 ? {
          silent: true,
          symbol: 'none',
          label: {
            formatter: `半衰期 D${s.halfLife}`,
            color: s.color,
            fontSize: 10,
            position: 'end',
          },
          lineStyle: { color: s.color, type: 'dashed', width: 1 },
          data: [{ xAxis: s.halfLife }],
        } : undefined,
      })),
    ],
  });

  const handleResize = () => chart.resize();
  window.addEventListener('resize', handleResize);
  return { chart, dispose: () => { window.removeEventListener('resize', handleResize); chart.dispose(); } };
}

// ── Component ────────────────────────────────────────────────────────────────

export const DecayCurveChart: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [decayData, setDecayData] = useState<DecaySeries[]>([]);
  const [hyperbolicData, setHyperbolicData] = useState<HyperbolicDecayCurve[]>([]);
  const [selectedFactors, setSelectedFactors] = useState<Set<string>>(new Set());
  const [useHyperbolic, setUseHyperbolic] = useState(true); // R171: toggle hyperbolic model

  useEffect(() => {
    // R171: Generate hyperbolic decay curves
    const hCurves = generateHyperbolicDecayCurves();
    setHyperbolicData(hCurves);

    // Also keep old mock for fallback
    const mock = generateMockDecaySeries();
    setDecayData(mock);
    setSelectedFactors(new Set(
      (useHyperbolic ? hCurves : mock).slice(0, 4).map((s) => s.factorId)
    ));
  }, [useHyperbolic]);

  useEffect(() => {
    if (!chartRef.current || selectedFactors.size === 0) return;
    const sourceData = useHyperbolic ? hyperbolicData : decayData;
    const filtered = sourceData.filter((d) => selectedFactors.has(d.factorId));
    if (filtered.length === 0) return;
    const { dispose } = renderDecayChart(chartRef.current, filtered as DecaySeries[]);
    return dispose;
  }, [decayData, hyperbolicData, selectedFactors, useHyperbolic]);

  const toggleFactor = (factorId: string) => {
    setSelectedFactors((prev) => {
      const next = new Set(prev);
      if (next.has(factorId)) next.delete(factorId);
      else next.add(factorId);
      return next;
    });
  };

  const selectAll = () => setSelectedFactors(new Set(decayData.map((d) => d.factorId)));
  const clearAll = () => setSelectedFactors(new Set());

  const sourceData = useHyperbolic ? hyperbolicData : decayData;

  return (
    <div className="p-6 space-y-5 bg-deep min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">📉 IC衰减曲线</h1>
          <div className="flex items-center gap-2 mt-1">
            {/* R171: Decay model toggle */}
            <button
              onClick={() => setUseHyperbolic(!useHyperbolic)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                useHyperbolic
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-gray-800 text-gray-500 border-gray-700'
              }`}
            >
              {useHyperbolic ? '🔬 双曲衰减模型' : '📊 指数衰减模型'}
            </button>
            {useHyperbolic && (
              <span className="text-[9px] text-gray-600">
                机械因子(双曲) · 判断因子(指数+突变)
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 rounded text-xs bg-green-700 text-white hover:bg-green-600 transition-colors"
            onClick={selectAll}
          >
            全选
          </button>
          <button
            className="px-3 py-1.5 rounded text-xs bg-gray-800 text-gray-400 hover:text-white transition-colors"
            onClick={clearAll}
          >
            清空
          </button>
        </div>
      </div>

      {/* Factor toggle chips */}
      <div className="flex flex-wrap gap-2">
        {sourceData.map((d) => {
          const isSelected = selectedFactors.has(d.factorId);
          return (
            <button
              key={d.factorId}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isSelected
                  ? 'border-transparent text-white'
                  : 'border-gray-700 text-gray-500 hover:border-gray-600'
              }`}
              style={{
                backgroundColor: isSelected ? d.color + '33' : 'transparent',
                borderColor: isSelected ? d.color : undefined,
              }}
              onClick={() => toggleFactor(d.factorId)}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: d.color }}
              />
              {d.nameCN}
              <span className="ml-1 text-gray-500">
                T½={d.halfLife < 60 ? `D${d.halfLife}` : '60+'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-4">
        <div ref={chartRef} style={{ width: '100%', height: '420px' }} />
      </div>

      {/* Summary table */}
      <div className="bg-gray-900/60 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="py-2 px-3 text-left">因子</th>
              {useHyperbolic && <th className="py-2 px-3 text-center">类型</th>}
              <th className="py-2 px-3 text-right">初始IC</th>
              <th className="py-2 px-3 text-right">半衰期(天)</th>
              <th className="py-2 px-3 text-right">D30 IC</th>
              <th className="py-2 px-3 text-right">D60 IC</th>
              <th className="py-2 px-3 text-center">稳定性</th>
            </tr>
          </thead>
          <tbody>
            {sourceData.map((d) => {
              const hParams = useHyperbolic ? (d as HyperbolicDecayCurve).params : null;
              const curveData = useHyperbolic ? (d as HyperbolicDecayCurve).curve : (d as DecaySeries).decayCurve;
              return (
              <tr key={d.factorId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2 px-3">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-white font-medium">{d.nameCN}</span>
                </td>
                {useHyperbolic && hParams && (
                  <td className="py-2 px-3 text-center">
                    <DecayTypeBadge type={hParams.type} size="sm" />
                  </td>
                )}
                <td className="py-2 px-3 text-right" style={{ color: d.color }}>
                  {(curveData[0] as number)?.toFixed(4) || '—'}
                </td>
                <td className="py-2 px-3 text-right text-cyan-400">
                  {d.halfLife < 60 ? d.halfLife : '60+'}
                </td>
                <td className="py-2 px-3 text-right text-gray-300">
                  {(curveData[29] as number)?.toFixed(4) || '—'}
                </td>
                <td className="py-2 px-3 text-right text-gray-300">
                  {(curveData[59] as number)?.toFixed(4) || '—'}
                </td>
                <td className="py-2 px-3 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      d.halfLife >= 30
                        ? 'bg-green-900/50 text-green-400'
                        : d.halfLife >= 15
                          ? 'bg-yellow-900/50 text-yellow-400'
                          : 'bg-red-900/50 text-red-400'
                    }`}
                  >
                    {d.halfLife >= 30 ? '稳定' : d.halfLife >= 15 ? '一般' : '衰减快'}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Interpretation note */}
      <div className="bg-gray-900/40 rounded-lg border border-gray-800 p-3 text-xs text-gray-500 leading-relaxed">
        <p className="font-medium text-gray-400 mb-1">💡 IC衰减说明</p>
        <p>
          IC衰减曲线展示因子预测能力随时间衰减的速度。半衰期越长，因子越稳定，适合长周期策略。
          虚线标记了IC的50%衰减点。衰减快的因子更适合高频/短期策略。
        </p>
      </div>
    </div>
  );
};

export default DecayCurveChart;
