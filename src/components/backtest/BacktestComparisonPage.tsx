import { useState, useEffect, useMemo } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import * as echarts from 'echarts';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

interface BacktestResult {
  strategyName: string;
  strategyId: string;
  totalReturn: number;
  annualReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  calmarRatio: number;
  sortinoRatio: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  equityCurve: {date: string;value: number;}[];
  monthlyReturns: number[];
  color: string;
}

const COLORS = ['#C9A046', '#16a34a', '#3b82f6', '#dc2626', '#8b5cf6', '#06b6d4'];

const MOCK_RESULTS: BacktestResult[] = [
{
  strategyName: i18n.t('BacktestComparisonPage.k1'),
  strategyId: 'strategy-001',
  totalReturn: 28.5,
  annualReturn: 14.2,
  maxDrawdown: -8.3,
  sharpeRatio: 1.45,
  calmarRatio: 1.71,
  sortinoRatio: 2.12,
  winRate: 58.3,
  profitFactor: 1.68,
  totalTrades: 120,
  equityCurve: generateEquityCurve(100000, 0.142, 0.15),
  monthlyReturns: [2.1, -1.5, 3.2, 1.8, -0.5, 2.8, 1.2, 3.5, -2.1, 4.2, 1.5, 2.8],
  color: COLORS[0]
},
{
  strategyName: i18n.t('BacktestComparisonPage.k2'),
  strategyId: 'strategy-002',
  totalReturn: 35.2,
  annualReturn: 17.6,
  maxDrawdown: -12.1,
  sharpeRatio: 1.28,
  calmarRatio: 1.45,
  sortinoRatio: 1.89,
  winRate: 52.1,
  profitFactor: 1.52,
  totalTrades: 86,
  equityCurve: generateEquityCurve(100000, 0.176, 0.18),
  monthlyReturns: [3.5, -2.8, 4.1, 2.5, -1.2, 3.8, 0.8, 4.2, -3.5, 5.1, 2.2, 3.5],
  color: COLORS[1]
},
{
  strategyName: i18n.t('BacktestComparisonPage.k3'),
  strategyId: 'strategy-003',
  totalReturn: 18.3,
  annualReturn: 9.1,
  maxDrawdown: -5.2,
  sharpeRatio: 1.62,
  calmarRatio: 1.75,
  sortinoRatio: 2.35,
  winRate: 65.4,
  profitFactor: 1.85,
  totalTrades: 45,
  equityCurve: generateEquityCurve(100000, 0.091, 0.10),
  monthlyReturns: [1.2, 0.8, 1.5, 0.5, 0.2, 1.8, 0.8, 1.2, -0.5, 2.1, 0.8, 1.5],
  color: COLORS[2]
},
{
  strategyName: i18n.t('BacktestComparisonPage.k4'),
  strategyId: 'strategy-004',
  totalReturn: 15.8,
  annualReturn: 7.9,
  maxDrawdown: -3.8,
  sharpeRatio: 1.78,
  calmarRatio: 2.08,
  sortinoRatio: 2.65,
  winRate: 72.3,
  profitFactor: 1.92,
  totalTrades: 210,
  equityCurve: generateEquityCurve(100000, 0.079, 0.08),
  monthlyReturns: [0.8, 0.5, 1.2, 0.3, 0.5, 1.5, 0.5, 0.8, -0.2, 1.2, 0.5, 1.0],
  color: COLORS[3]
}];


function generateEquityCurve(initial: number, annualReturn: number, volatility: number) {
  const data: {date: string;value: number;}[] = [];
  let value = initial;
  const dailyReturn = annualReturn / 252;
  const dailyVol = volatility / Math.sqrt(252);
  const start = new Date('2024-01-01');
  for (let i = 0; i < 252; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const ret = dailyReturn + (Math.random() - 0.5) * dailyVol * 2;
    value *= 1 + ret;
    data.push({
      date: date.toISOString().split('T')[0],
      value: +value.toFixed(2)
    });
  }
  return data;
}

export default function BacktestComparisonPage() {
  const { t } = useTranslation();
  const [results] = useState<BacktestResult[]>(MOCK_RESULTS);
  const [loading, setLoading] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<Set<string>>(new Set(MOCK_RESULTS.map((r) => r.strategyId)));
  const [chartType, setChartType] = useState<'equity' | 'drawdown' | 'monthly'>('equity');

  async function load() {
    setLoading(true);
    try {


      // In real implementation, call: const res = await compareBacktests(strategyIds);
      // For now use mock data
    } catch (e) {console.error('[Error:BacktestComparisonPage]', e);}void EngineError; // [SYSTEM] structured error tracking
    setLoading(false);}

  useEffect(() => {load();}, []);

  const filtered = useMemo(() => results.filter((r) => selectedStrategies.has(r.strategyId)), [results, selectedStrategies]);

  function toggleStrategy(id: string) {
    setSelectedStrategies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else
      next.add(id);
      return next;
    });
  }

  // Equity curve chart
  useEffect(() => {
    const chartDom = document.getElementById('backtest-equity-chart');
    if (!chartDom || filtered.length === 0) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    const dates = filtered[0]?.equityCurve.map((d) => d.date) || [];
    const series = filtered.map((r) => ({
      name: r.strategyName,
      type: 'line',
      data: r.equityCurve.map((d) => d.value),
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: r.color },
      itemStyle: { color: r.color }
    }));

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      legend: { data: filtered.map((r) => r.strategyName), textStyle: { color: '#9ca3af' }, bottom: 0 },
      grid: { left: 60, right: 20, top: 20, bottom: 40 },
      xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: (v: number) => `$${(v / 1000).toFixed(0)}K` }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series
    });

    return () => chart.dispose();
  }, [filtered]);

  // Monthly returns heatmap
  const monthlyHeatmapData = useMemo(() => {
    const months = [i18n.t('BacktestComparisonPage.k5'), i18n.t('BacktestComparisonPage.k6'), i18n.t('BacktestComparisonPage.k7'), i18n.t('BacktestComparisonPage.k8'), i18n.t('BacktestComparisonPage.k9'), i18n.t('BacktestComparisonPage.k10'), i18n.t('BacktestComparisonPage.k11'), i18n.t('BacktestComparisonPage.k12'), i18n.t('BacktestComparisonPage.k13'), i18n.t('BacktestComparisonPage.k14'), i18n.t('BacktestComparisonPage.k15'), i18n.t('BacktestComparisonPage.k16')];
    const data: [number, number, number][] = [];
    filtered.forEach((r, rowIdx) => {
      r.monthlyReturns.forEach((val, colIdx) => {
        data.push([colIdx, rowIdx, +val.toFixed(2)]);
      });
    });
    return { months, data };
  }, [filtered]);

  useEffect(() => {
    const chartDom = document.getElementById('backtest-monthly-heatmap');
    if (!chartDom || filtered.length === 0) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        backgroundColor: '#1a1a25',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e5e7eb' },
        formatter: (p: unknown) => `${filtered[(p as any).data[1]]?.strategyName}<br/>${monthlyHeatmapData.months[(p as any).data[0]]}: ${(p as any).data[2]}%`
      },
      grid: { left: 120, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'category', data: monthlyHeatmapData.months, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 } },
      yAxis: { type: 'category', data: filtered.map((r) => r.strategyName), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#9ca3af', fontSize: 10 } },
      visualMap: {
        min: -5, max: 5,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#dc2626', '#1a1a25', '#16a34a'] },
        textStyle: { color: '#9ca3af' }
      },
      series: [{
        type: 'heatmap',
        data: monthlyHeatmapData.data,
        label: { show: true, color: '#e5e7eb', fontSize: 10, formatter: (p: unknown) => `${(p as any).data[2]}%` },
        itemStyle: { borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1 }
      }]
    });

    return () => chart.dispose();
  }, [monthlyHeatmapData, filtered]);

  if (loading) return <LoadingSpinner fullscreen text={i18n.t('BacktestComparisonPage.k17')} />;

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t("BacktestComparisonPage.r92_eb56")}</h1>
          <p className="text-gray-400 text-sm">{i18n.t('BacktestComparisonPage.k0')}</p>
        </div>
        <button
          onClick={load}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors">{i18n.t("BacktestComparisonPage.r92_ba74")}


        </button>
      </div>

      {/* Strategy Selector */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <div className="text-xs text-gray-500 mb-3">{i18n.t('BacktestComparisonPage.k1')}</div>
        <div className="flex flex-wrap gap-2">
          {results.map((r) =>
          <button
            key={r.strategyId}
            onClick={() => toggleStrategy(r.strategyId)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
            selectedStrategies.has(r.strategyId) ?
            'bg-white/5 text-white border border-white/10' :
            'bg-transparent text-gray-500 border border-transparent'}`
            }>
            
              <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
              {r.strategyName}
            </button>
          )}
        </div>
      </div>

      {/* Metrics Comparison Table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">{i18n.t('BacktestComparisonPage.k2')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs">
                <th className="px-4 py-3 text-left">{i18n.t('BacktestComparisonPage.k3')}</th>
                {filtered.map((r) =>
                <th key={r.strategyId} className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                      <span className="text-gray-300">{r.strategyName}</span>
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
              { label: i18n.t('BacktestComparisonPage.k18'), key: 'totalReturn', fmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, color: true },
              { label: i18n.t('BacktestComparisonPage.k19'), key: 'annualReturn', fmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, color: true },
              { label: t('components.maxDrawdown'), key: 'maxDrawdown', fmt: (v: number) => `${v.toFixed(2)}%`, color: true, inverse: true },
              { label: t("components.sharpe"), key: 'sharpeRatio', fmt: (v: number) => v.toFixed(2) },
              { label: i18n.t('BacktestComparisonPage.k20'), key: 'calmarRatio', fmt: (v: number) => v.toFixed(2) },
              { label: i18n.t('BacktestComparisonPage.k21'), key: 'sortinoRatio', fmt: (v: number) => v.toFixed(2) },
              { label: t('components.winRate'), key: 'winRate', fmt: (v: number) => `${v.toFixed(1)}%` },
              { label: t('components.profitLossRatio'), key: 'profitFactor', fmt: (v: number) => v.toFixed(2) },
              { label: i18n.t('BacktestComparisonPage.k22'), key: 'totalTrades', fmt: (v: number) => `${v}` }].
              map((row) =>
              <tr key={row.label} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-gray-400">{row.label}</td>
                  {filtered.map((r) => {
                  const val = (r as any)[row.key] as number;
                  let colorClass = 'text-white';
                  if (row.color) {
                    if (row.inverse) {
                      colorClass = val >= 0 ? 'text-emerald-400' : 'text-red-400';
                    } else {
                      colorClass = val >= 0 ? 'text-red-400' : 'text-emerald-400';
                    }
                  }
                  return (
                    <td key={r.strategyId} className={`px-4 py-3 text-right font-mono ${colorClass}`}>
                        {row.fmt(val)}
                      </td>);

                })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Tabs */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">{i18n.t('BacktestComparisonPage.k4')}</h2>
          <div className="flex gap-1">
            {(['equity', 'monthly'] as const).map((ct) =>
            <button
              key={ct}
              onClick={() => setChartType(ct)}
              className={`text-xs px-3 py-1 rounded-lg transition-colors ${
              chartType === ct ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-500 hover:text-gray-300'}`
              }>
              
                {ct === 'equity' ? i18n.t('BacktestComparisonPage.k23') : t("components.monthlyRet")}
              </button>
            )}
          </div>
        </div>
        {chartType === 'equity' &&
        <div id="backtest-equity-chart" className="w-full h-[360px]" />
        }
        {chartType === 'monthly' &&
        <div id="backtest-monthly-heatmap" className="w-full h-[280px]" />
        }
      </div>
    </div>);

}