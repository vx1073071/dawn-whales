// ── R164 P1-E1: Factor Compare Dashboard ─────────────────────────────────
// Radar chart: compare multiple factors on IC/IR/Sharpe/HitRate/HalfLife/Crowding
// IC Heatmap: factor × month grid showing IC values with color scale
//
// Data flow: strategyStore.activeStrategy → bridge-api.getFactorSuggestions
//            → factor-research-engine.computeIC/computeDecay (IPC)
//            → rendered as ECharts radar + heatmap

import React, { useEffect, useState, useMemo } from 'react';
import * as echarts from 'echarts';

// ── Types ────────────────────────────────────────────────────────────────────

interface FactorMetric {
  factorId: string;
  nameCN: string;
  ic: number;          // Rank IC
  ir: number;          // Information Ratio
  sharpe: number;      // Long-short Sharpe
  hitRate: number;     // % IC > 0
  halfLife: number;    // Decay half-life (days)
  crowding: number;    // 0-1
}

interface ICRow {
  factorId: string;
  nameCN: string;
  months: number[];    // IC per month (Jan–Dec or last 12 months)
}

// ── Factor i18n quick map ───────────────────────────────────────────────────

const FACTOR_NAMES: Record<string, string> = {
  MKT: '市场Beta', SMB: '小盘因子', HML: '价值因子', MOM: '动量因子',
  MOM_12M: '12月动量', VOL: '低波因子', VOL_60D: '60日低波',
  QUAL: '品质因子', RMW: '盈利能力', CMA: '投资因子',
  LIQ: '流动性因子', YIELD: '股息率', SIZE: '规模因子',
  GROWTH: '成长因子', MA_20_60: '均线交叉', RSI_14: 'RSI',
  ADX: 'ADX趋势', STM: '短期动量', BETA: 'Beta系数',
};

// ── Color scale for heatmap ─────────────────────────────────────────────────

function icColor(ic: number): string {
  if (ic >= 0.06) return '#00c853';  // strong positive
  if (ic >= 0.03) return '#64dd17';
  if (ic > 0) return '#aeea00';
  if (ic > -0.03) return '#ffab00';
  if (ic > -0.06) return '#ff5252';
  return '#d50000';  // strong negative
}

// ── MOCK: Simulated factor metrics (real data via IPC) ──────────────────────

function generateMockMetrics(): FactorMetric[] {
  const factors = [
    { id: 'MOM_12M', baseIC: 0.042, baseIR: 0.72, baseSharpe: 0.85, hit: 0.62, hl: 45, crowd: 0.28 },
    { id: 'HML', baseIC: 0.035, baseIR: 0.55, baseSharpe: 0.62, hit: 0.58, hl: 90, crowd: 0.15 },
    { id: 'SMB', baseIC: 0.018, baseIR: 0.30, baseSharpe: 0.35, hit: 0.52, hl: 120, crowd: 0.08 },
    { id: 'VOL_60D', baseIC: -0.040, baseIR: 0.68, baseSharpe: 0.78, hit: 0.60, hl: 35, crowd: 0.35 },
    { id: 'QUAL', baseIC: 0.038, baseIR: 0.60, baseSharpe: 0.70, hit: 0.61, hl: 60, crowd: 0.18 },
    { id: 'LIQ', baseIC: 0.025, baseIR: 0.42, baseSharpe: 0.48, hit: 0.55, hl: 25, crowd: 0.42 },
    { id: 'MKT', baseIC: 0.055, baseIR: 0.85, baseSharpe: 0.95, hit: 0.68, hl: 52, crowd: 0.12 },
    { id: 'YIELD', baseIC: 0.028, baseIR: 0.45, baseSharpe: 0.52, hit: 0.56, hl: 80, crowd: 0.10 },
  ];

  return factors.map((f) => ({
    factorId: f.id,
    nameCN: FACTOR_NAMES[f.id] || f.id,
    ic: Number((f.baseIC + (Math.random() - 0.5) * 0.02).toFixed(4)),
    ir: Number((f.baseIR + (Math.random() - 0.5) * 0.15).toFixed(2)),
    sharpe: Number((f.baseSharpe + (Math.random() - 0.5) * 0.2).toFixed(2)),
    hitRate: Number((f.hit + (Math.random() - 0.5) * 0.06).toFixed(2)),
    halfLife: f.hl,
    crowding: Number((f.crowd + (Math.random() - 0.5) * 0.08).toFixed(2)),
  }));
}

function generateMockICGrid(): ICRow[] {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const factors = ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'MKT', 'LIQ', 'SMB', 'YIELD'];
  return factors.map((fid) => ({
    factorId: fid,
    nameCN: FACTOR_NAMES[fid] || fid,
    months: months.map(() => Number(((Math.random() - 0.35) * 0.1).toFixed(4))),
  }));
}

// ── Radar chart renderer ────────────────────────────────────────────────────

function renderRadar(container: HTMLDivElement, metrics: FactorMetric[]) {
  const chart = echarts.init(container, undefined, { renderer: 'svg' });
  const indicators = metrics.map((m) => ({
    name: m.nameCN,
    max: 1.0,
  }));

  // Normalize each metric to 0-1
  const maxIC = Math.max(...metrics.map((m) => Math.abs(m.ic)), 0.05);
  const maxIR = Math.max(...metrics.map((m) => m.ir), 1);
  const maxSharpe = Math.max(...metrics.map((m) => m.sharpe), 1);
  const maxHL = Math.max(...metrics.map((m) => m.halfLife), 120);

  const icSeries = metrics.map((m) => Math.abs(m.ic) / maxIC);
  const irSeries = metrics.map((m) => m.ir / maxIR);
  const sharpeSeries = metrics.map((m) => m.sharpe / maxSharpe);
  const hitSeries = metrics.map((m) => m.hitRate);
  const hlSeries = metrics.map((m) => m.halfLife / maxHL);
  const crowdingSeries = metrics.map((m) => 1 - m.crowding);

  chart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0,0,0,0.85)',
      borderColor: '#333',
      textStyle: { color: '#e5e7eb', fontSize: 12 },
    },
    legend: {
      data: ['IC绝对值', 'IR', 'Sharpe', '命中率', '半衰期', '1-拥挤度'],
      bottom: 0,
      textStyle: { color: '#9ca3af', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
    },
    radar: {
      center: ['50%', '45%'],
      radius: '65%',
      indicator: indicators,
      axisName: { color: '#e5e7eb', fontSize: 10, borderRadius: 3, padding: [2, 4] },
      splitArea: {
        areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] },
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    },
    series: [{
      type: 'radar',
      emphasis: { lineStyle: { width: 3 } },
      data: [
        { value: icSeries, name: 'IC绝对值', symbol: 'circle', symbolSize: 4, lineStyle: { color: '#00e676' }, areaStyle: { color: 'rgba(0,230,118,0.08)' }, itemStyle: { color: '#00e676' } },
        { value: irSeries, name: 'IR', symbol: 'circle', symbolSize: 4, lineStyle: { color: '#448aff' }, areaStyle: { color: 'rgba(68,138,255,0.08)' }, itemStyle: { color: '#448aff' } },
        { value: sharpeSeries, name: 'Sharpe', symbol: 'circle', symbolSize: 4, lineStyle: { color: '#ffc107' }, areaStyle: { color: 'rgba(255,193,7,0.08)' }, itemStyle: { color: '#ffc107' } },
        { value: hitSeries, name: '命中率', symbol: 'circle', symbolSize: 4, lineStyle: { color: '#e040fb' }, areaStyle: { color: 'rgba(224,64,251,0.08)' }, itemStyle: { color: '#e040fb' } },
        { value: hlSeries, name: '半衰期', symbol: 'circle', symbolSize: 4, lineStyle: { color: '#00bcd4' }, areaStyle: { color: 'rgba(0,188,212,0.08)' }, itemStyle: { color: '#00bcd4' } },
        { value: crowdingSeries, name: '1-拥挤度', symbol: 'circle', symbolSize: 4, lineStyle: { color: '#ff6e40' }, areaStyle: { color: 'rgba(255,110,64,0.08)' }, itemStyle: { color: '#ff6e40' } },
      ],
    }],
  });

  const handleResize = () => chart.resize();
  window.addEventListener('resize', handleResize);
  return { chart, dispose: () => { window.removeEventListener('resize', handleResize); chart.dispose(); } };
}

// ── IC Heatmap renderer ─────────────────────────────────────────────────────

function renderHeatmap(container: HTMLDivElement, grid: ICRow[]) {
  const chart = echarts.init(container, undefined, { renderer: 'svg' });
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const heatData: Array<[number, number, number]> = [];
  grid.forEach((row, yi) => {
    row.months.forEach((v, xi) => {
      heatData.push([xi, yi, v]);
    });
  });

  const maxAbs = Math.max(...heatData.flatMap((d) => [Math.abs(d[2])]), 0.06);

  chart.setOption({
    tooltip: {
      position: 'top',
      backgroundColor: 'rgba(0,0,0,0.85)',
      borderColor: '#333',
      textStyle: { color: '#e5e7eb', fontSize: 12 },
      formatter: (params: { data: [number, number, number] }) =>
        `${grid[params.data[1]]?.nameCN} · ${months[params.data[0]]}<br/>IC: <b>${params.data[2].toFixed(4)}</b>`,
    },
    grid: { left: 100, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { color: '#9ca3af', fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
    },
    yAxis: {
      type: 'category',
      data: grid.map((r) => r.nameCN),
      axisLabel: { color: '#e5e7eb', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    visualMap: {
      min: -maxAbs,
      max: maxAbs,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 120,
      inRange: { color: ['#d50000', '#ff5252', '#1a1a2e', '#64dd17', '#00c853'] },
      textStyle: { color: '#9ca3af', fontSize: 10 },
    },
    series: [{
      type: 'heatmap',
      data: heatData,
      label: { show: true, color: '#e5e7eb', fontSize: 9 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  });

  const handleResize = () => chart.resize();
  window.addEventListener('resize', handleResize);
  return { chart, dispose: () => { window.removeEventListener('resize', handleResize); chart.dispose(); } };
}

// ── Component ────────────────────────────────────────────────────────────────

export const FactorCompareDashboard: React.FC = () => {
  const radarRef = React.useRef<HTMLDivElement>(null);
  const heatmapRef = React.useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<FactorMetric[]>([]);
  const [icGrid, setIcGrid] = useState<ICRow[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'radar' | 'heatmap'>('radar');

  useEffect(() => {
    // Use mock data for now; bridge-api.getFactorSuggestions will be integrated
    // when the IPC handler factor:suggestFactors is fully wired
    setMetrics(generateMockMetrics());
    setIcGrid(generateMockICGrid());
  }, []);

  useEffect(() => {
    if (!radarRef.current || metrics.length === 0) return;
    const { dispose } = renderRadar(radarRef.current, metrics);
    return dispose;
  }, [metrics]);

  useEffect(() => {
    if (!heatmapRef.current || icGrid.length === 0) return;
    const { dispose } = renderHeatmap(heatmapRef.current, icGrid);
    return dispose;
  }, [icGrid]);

  // ── Metric cards (top summary) ──────────────────────────────────────────
  const avgIC = useMemo(() => {
    if (metrics.length === 0) return 0;
    return Number((metrics.reduce((s, m) => s + m.ic, 0) / metrics.length).toFixed(4));
  }, [metrics]);

  const bestFactor = useMemo(() => {
    if (metrics.length === 0) return null;
    return [...metrics].sort((a, b) => b.ir - a.ir)[0];
  }, [metrics]);

  return (
    <div className="p-6 space-y-5 bg-deep min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">📊 因子对比仪表板</h1>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${selectedMetric === 'radar' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            onClick={() => setSelectedMetric('radar')}
          >
            雷达对比
          </button>
          <button
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${selectedMetric === 'heatmap' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            onClick={() => setSelectedMetric('heatmap')}
          >
            IC热力图
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">平均IC</div>
          <div className={`text-xl font-bold ${avgIC > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {avgIC.toFixed(4)}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {avgIC > 0.03 ? '✅ 高于阈值' : avgIC > 0 ? '⚠️ 一般' : '❌ 低于预期'}
          </div>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">最佳IR因子</div>
          <div className="text-xl font-bold text-blue-400">{bestFactor?.nameCN || '—'}</div>
          <div className="text-xs text-gray-400 mt-1">
            IR: {bestFactor?.ir.toFixed(2) || '—'} | IC: {bestFactor?.ic.toFixed(4) || '—'}
          </div>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">最长半衰期</div>
          <div className="text-xl font-bold text-cyan-400">
            {metrics.length > 0
              ? metrics.reduce((a, b) => (b.halfLife > a.halfLife ? b : a), metrics[0]).nameCN
              : '—'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {metrics.length > 0
              ? `${metrics.reduce((a, b) => (b.halfLife > a.halfLife ? b : a), metrics[0]).halfLife}天`
              : '—'}
          </div>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">最低拥挤度</div>
          <div className="text-xl font-bold text-orange-400">
            {metrics.length > 0
              ? metrics.reduce((a, b) => (b.crowding < a.crowding ? b : a), metrics[0]).nameCN
              : '—'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {metrics.length > 0
              ? `${(metrics.reduce((a, b) => (b.crowding < a.crowding ? b : a), metrics[0]).crowding * 100).toFixed(0)}%`
              : '—'}
          </div>
        </div>
      </div>

      {/* Main chart area */}
      <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-4">
        {selectedMetric === 'radar' && (
          <div ref={radarRef} style={{ width: '100%', height: '420px' }} />
        )}
        {selectedMetric === 'heatmap' && (
          <div ref={heatmapRef} style={{ width: '100%', height: '420px' }} />
        )}
      </div>

      {/* Bottom table: Detailed metrics */}
      <div className="bg-gray-900/60 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="py-2 px-3 text-left">因子</th>
              <th className="py-2 px-3 text-right">IC</th>
              <th className="py-2 px-3 text-right">IR</th>
              <th className="py-2 px-3 text-right">Sharpe</th>
              <th className="py-2 px-3 text-right">命中率</th>
              <th className="py-2 px-3 text-right">半衰期(天)</th>
              <th className="py-2 px-3 text-right">拥挤度</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.factorId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2 px-3 text-white font-medium">{m.nameCN}</td>
                <td className="py-2 px-3 text-right" style={{ color: icColor(m.ic) }}>
                  {m.ic.toFixed(4)}
                </td>
                <td className="py-2 px-3 text-right text-blue-400">{m.ir.toFixed(2)}</td>
                <td className="py-2 px-3 text-right text-yellow-400">{m.sharpe.toFixed(2)}</td>
                <td className="py-2 px-3 text-right text-purple-400">{(m.hitRate * 100).toFixed(0)}%</td>
                <td className="py-2 px-3 text-right text-cyan-400">{m.halfLife}</td>
                <td className="py-2 px-3 text-right text-orange-400">{(m.crowding * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FactorCompareDashboard;
