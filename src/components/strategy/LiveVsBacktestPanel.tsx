// ── R167 P1-X1: Live vs Backtest Deviation Tracker ──────────────────────
// Compares live trading returns against backtest expected returns.
// Attributes deviation to: slippage / factor decay / regime shift / overfitting.
// Provides actionable buttons: [Recalibrate] [Add Hedge] [AI Diagnose]
//
// Profit model: AI health check 1U + AI optimization 1.5U

import React, { useEffect, useState, useRef } from 'react';
import * as echarts from 'echarts';

// ── Types ────────────────────────────────────────────────────────────────────

interface DeviationPoint {
  date: string;
  backtestCumulative: number;     // Expected cumulative return from backtest
  liveCumulative: number;         // Actual live cumulative return
  deviationPct: number;           // (live - backtest) / |backtest| * 100
}

interface DeviationSource {
  source: 'slippage' | 'factorDecay' | 'regimeShift' | 'overfitting' | 'other';
  label: string;
  contributionPct: number;         // % of total deviation attributed
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface LiveVsBacktestData {
  strategyId: string;
  strategyName: string;
  period: { start: string; end: string };
  totalBacktestReturn: number;
  totalLiveReturn: number;
  totalDeviationPct: number;
  series: DeviationPoint[];
  sources: DeviationSource[];
  status: 'tracking' | 'warning' | 'critical';
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  tracking: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  tracking: '跟踪正常',
  warning: '偏离预警',
  critical: '严重偏离',
};

const SOURCE_COLORS: Record<string, string> = {
  slippage: '#f59e0b',
  factorDecay: '#ef4444',
  regimeShift: '#3b82f6',
  overfitting: '#ec4899',
  other: '#6b7280',
};

// ── Mock Data ────────────────────────────────────────────────────────────────

function generateMockData(): LiveVsBacktestData {
  const dates: string[] = [];
  const series: DeviationPoint[] = [];
  let btCum = 0, liveCum = 0;
  const btDailyReturn = 0.0012;     // ~30% annual
  const liveDailyReturn = 0.0008;   // ~20% annual → 10% annual shortfall

  for (let d = 0; d < 120; d++) {
    const date = new Date(2026, 1, 1);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    dates.push(dateStr);

    const btNoise = (Math.random() - 0.5) * 0.008;
    const liveNoise = (Math.random() - 0.5) * 0.01;
    const liveDrag = -0.0001; // consistent drag from slippage + factor decay

    btCum += btDailyReturn + btNoise;
    liveCum += liveDailyReturn + liveNoise + liveDrag;

    series.push({
      date: dateStr,
      backtestCumulative: Number(btCum.toFixed(4)),
      liveCumulative: Number(liveCum.toFixed(4)),
      deviationPct: btCum !== 0 ? Number(((liveCum - btCum) / Math.abs(btCum) * 100).toFixed(2)) : 0,
    });
  }

  return {
    strategyId: 'strat-deviation-demo',
    strategyName: 'MACD双均线 (HK Tech)',
    period: { start: dates[0], end: dates[dates.length - 1] },
    totalBacktestReturn: Number(btCum.toFixed(4)),
    totalLiveReturn: Number(liveCum.toFixed(4)),
    totalDeviationPct: btCum !== 0 ? Number(((liveCum - btCum) / Math.abs(btCum) * 100).toFixed(2)) : 0,
    series,
    sources: [
      {
        source: 'slippage', label: '滑点/交易成本',
        contributionPct: 35, severity: 'medium',
        description: '实际成交价与回测模拟价的偏差，港股流动性较低时更显著',
      },
      {
        source: 'factorDecay', label: '因子衰减',
        contributionPct: 30, severity: 'high',
        description: '动量因子IC从0.045降至0.028，因子预测能力减弱',
      },
      {
        source: 'regimeShift', label: '市场风格切换',
        contributionPct: 20, severity: 'medium',
        description: '成长→价值轮动，原策略偏成长风格',
      },
      {
        source: 'overfitting', label: '过拟合',
        contributionPct: 10, severity: 'low',
        description: '回测参数优化过度，样本外表现下降',
      },
      {
        source: 'other', label: '其他因素',
        contributionPct: 5, severity: 'low',
        description: '数据延迟、分红调整等次要因素',
      },
    ],
    status: 'warning',
  };
}

// ── ECharts: Dual Cumulative Return Curves ───────────────────────────────────

function renderDualCurveChart(container: HTMLDivElement, data: LiveVsBacktestData) {
  const chart = echarts.init(container, undefined, { renderer: 'svg' });

  const dates = data.series.map((p) => p.date);
  const btCurve = data.series.map((p) => p.backtestCumulative * 100);
  const liveCurve = data.series.map((p) => p.liveCumulative * 100);
  const deviationArea = data.series.map((_p, i) => [
    Math.min(btCurve[i], liveCurve[i]),
    Math.max(btCurve[i], liveCurve[i]),
  ]);

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.85)',
      borderColor: '#333',
      textStyle: { color: '#e5e7eb', fontSize: 11 },
    },
    legend: {
      data: ['回测累计收益', '实盘累计收益', '偏离区间'],
      bottom: 0,
      textStyle: { color: '#9ca3af', fontSize: 10 },
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
    },
    grid: { left: 60, right: 20, top: 20, bottom: 50 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#9ca3af', fontSize: 9, interval: 19 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      name: '累计收益(%)',
      nameTextStyle: { color: '#9ca3af', fontSize: 10 },
      axisLabel: { color: '#9ca3af', fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [
      {
        type: 'line',
        name: '回测累计收益',
        data: btCurve,
        lineStyle: { color: '#22c55e', width: 2 },
        itemStyle: { color: '#22c55e' },
        symbol: 'none',
        z: 3,
      },
      {
        type: 'line',
        name: '实盘累计收益',
        data: liveCurve,
        lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
        itemStyle: { color: '#f59e0b' },
        symbol: 'none',
        z: 3,
      },
      {
        type: 'line',
        name: '偏离区间',
        data: deviationArea.map((d) => d[1]),
        lineStyle: { color: 'transparent', width: 0 },
        areaStyle: { color: 'rgba(239,68,68,0.08)' },
        symbol: 'none',
        z: 1,
        stack: 'deviation',
      },
      {
        type: 'line',
        name: '偏离区间',
        data: deviationArea.map((d) => d[0]),
        lineStyle: { color: 'transparent', width: 0 },
        areaStyle: { color: 'transparent' },
        symbol: 'none',
        z: 1,
        stack: 'deviation',
      },
    ],
  });

  const handleResize = () => chart.resize();
  window.addEventListener('resize', handleResize);
  return { chart, dispose: () => { window.removeEventListener('resize', handleResize); chart.dispose(); } };
}

// ── ECharts: Deviation Source Donut ──────────────────────────────────────────

function renderSourceDonut(container: HTMLDivElement, sources: DeviationSource[]) {
  const chart = echarts.init(container, undefined, { renderer: 'svg' });

  chart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0,0,0,0.85)',
      borderColor: '#333',
      textStyle: { color: '#e5e7eb', fontSize: 11 },
      formatter: (p: { name: string; value: number; percent: number }) =>
        `<b>${p.name}</b><br/>贡献: ${p.value}%<br/>占比: ${p.percent}%`,
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: '#9ca3af', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#1a1a25', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 12, fontWeight: 'bold' },
      },
      data: sources.map((s) => ({
        value: s.contributionPct,
        name: s.label,
        itemStyle: { color: SOURCE_COLORS[s.source] || '#6b7280' },
      })),
    }],
  });

  const handleResize = () => chart.resize();
  window.addEventListener('resize', handleResize);
  return { chart, dispose: () => { window.removeEventListener('resize', handleResize); chart.dispose(); } };
}

// ── Component ────────────────────────────────────────────────────────────────

export const LiveVsBacktestPanel: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const donutRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<LiveVsBacktestData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated data load; will connect to deviation-tracker API
    setTimeout(() => {
      setData(generateMockData());
      setLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    if (!chartRef.current || !data) return;
    const { dispose } = renderDualCurveChart(chartRef.current, data);
    return dispose;
  }, [data]);

  useEffect(() => {
    if (!donutRef.current || !data) return;
    const { dispose } = renderSourceDonut(donutRef.current, data.sources);
    return dispose;
  }, [data]);

  // ── Derived ────────────────────────────────────────────────────────
  const statusColor = data ? STATUS_COLORS[data.status] : '#fff';
  const statusLabel = data ? STATUS_LABELS[data.status] : '';

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        <div className="animate-spin text-2xl mb-3">⏳</div>
        <p className="text-sm">加载偏差追踪数据...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-500">
        <span className="text-3xl">📡</span>
        <p className="text-sm mt-2">暂无偏差追踪数据</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 bg-deep min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">📊 实盘 vs 回测 偏差追踪</h1>
        <span
          className="px-3 py-1 rounded-full text-xs font-bold"
          style={{ backgroundColor: statusColor + '20', color: statusColor, border: `1px solid ${statusColor}40` }}
        >
          {statusLabel}
        </span>
      </div>

      <p className="text-xs text-gray-500">
        策略: <span className="text-white font-medium">{data.strategyName}</span>
        <span className="mx-2">|</span>
        {data.period.start} ~ {data.period.end}
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">回测累计收益</div>
          <div className="text-xl font-bold text-green-400">
            {(data.totalBacktestReturn * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">实盘累计收益</div>
          <div className={`text-xl font-bold ${data.totalLiveReturn >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
            {(data.totalLiveReturn * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">总偏离</div>
          <div className={`text-xl font-bold ${data.totalDeviationPct <= -15 ? 'text-red-400' : data.totalDeviationPct <= -5 ? 'text-yellow-400' : 'text-green-400'}`}>
            {data.totalDeviationPct.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">状态</div>
          <div className="text-xl font-bold" style={{ color: statusColor }}>
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Dual Curve Chart */}
      <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-4">
        <h3 className="text-xs font-semibold text-gray-300 mb-3">📈 累计收益对比</h3>
        <div ref={chartRef} style={{ width: '100%', height: '350px' }} />
        <div className="flex gap-4 mt-2 text-[10px] text-gray-600">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-green-400 inline-block"></span> 回测预期
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-yellow-400 inline-block" style={{ borderTop: '1.5px dashed #f59e0b' }}></span> 实盘实际
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 bg-red-400/20 inline-block"></span> 偏离区间
          </span>
        </div>
      </div>

      {/* Deviation Sources */}
      <div className="grid grid-cols-2 gap-4">
        {/* Donut */}
        <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-4">
          <h3 className="text-xs font-semibold text-gray-300 mb-3">🎯 偏离来源归因</h3>
          <div ref={donutRef} style={{ width: '100%', height: '250px' }} />
        </div>

        {/* Source details */}
        <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-4">
          <h3 className="text-xs font-semibold text-gray-300 mb-3">📋 偏差分解</h3>
          <div className="space-y-2">
            {data.sources.map((s) => (
              <div key={s.source} className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white font-medium">{s.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      s.severity === 'high'
                        ? 'bg-red-500/20 text-red-400'
                        : s.severity === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {s.severity === 'high' ? '⚠️ 高' : s.severity === 'medium' ? '⚡ 中' : '✅ 低'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${s.contributionPct}%`,
                        backgroundColor: SOURCE_COLORS[s.source] || '#6b7280',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono w-10 text-right">
                    {s.contributionPct}%
                  </span>
                </div>
                <p className="text-[10px] text-gray-600 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all">
          🔧 重新校准 (重新回测)
        </button>
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all">
          🛡️ 增加对冲 (降低因子暴露)
        </button>
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C9A046]/10 border border-[#C9A046]/20 text-[#C9A046] hover:bg-[#C9A046]/20 transition-all">
          🤖 AI诊断 (1U/次)
        </button>
        <span className="text-[10px] text-gray-600 self-center ml-2">
          实盘偏离超过15%自动触发告警
        </span>
      </div>

      {/* How to interpret */}
      <div className="bg-gray-900/40 rounded-lg border border-gray-800 p-3 text-xs text-gray-500 leading-relaxed">
        <p className="font-medium text-gray-400 mb-1">💡 偏差追踪说明</p>
        <p>
          实盘与回测的差距（偏差）会被自动拆分为5个来源：滑点/交易成本、因子衰减、
          市场风格切换、过拟合、其他。每个来源的贡献度让你知道该优先解决什么问题。
          偏差超过5%触发⚠️预警，超过15%触发🔴严重告警。
        </p>
      </div>
    </div>
  );
};

export default LiveVsBacktestPanel;
