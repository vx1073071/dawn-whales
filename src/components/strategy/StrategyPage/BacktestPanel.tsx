/**
 * R161 ML: BacktestPanel — Backtest runner with progress and results
 * Connected to IPC: calls runBacktest via bridge-api.
 * Shows equity curve placeholder and key metrics.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts';

interface BacktestResult {
  totalReturn?: number;
  annualReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  profitFactor?: number;
  totalTrades?: number;
  equityCurve?: { time: number; value: number }[];
}

interface Props {
  strategyId: string;
  strategyName?: string;
  onBack: () => void;
}

export const BacktestPanel: React.FC<Props> = ({ strategyId, strategyName, onBack }) => {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState('');
  const [params, setParams] = useState({ startDate: '2024-01-01', endDate: '2026-06-14', initialCapital: '100000' });
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInst = useRef<echarts.ECharts | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError('');
    setProgress(0);
    setResult(null);

    // Simulate progress
    const progressTimer = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 300);

    try {
      const { runBacktest } = await import('../../../lib/bridge-api');
      const res = await runBacktest(strategyId);
      setResult(res);
      setProgress(100);
    } catch (e: unknown) {
      setError((e as Error).message || t('BacktestPanel.error', '回测失败'));
    }

    clearInterval(progressTimer);
    setTimeout(() => setProgress(0), 1500);
    setRunning(false);
  };

  // Equity curve chart
  useEffect(() => {
    if (!result?.equityCurve || !chartRef.current) return;
    if (!chartInst.current) {
      chartInst.current = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
    }

    const data = result.equityCurve.map((p) => [p.time, p.value]);
    chartInst.current.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: '${value}' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [{
        type: 'line',
        data,
        smooth: true,
        lineStyle: { color: '#C9A046', width: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(201,160,70,0.25)' }, { offset: 1, color: 'rgba(201,160,70,0)' }]) },
        showSymbol: false,
      }],
    });

    return () => { chartInst.current?.dispose(); chartInst.current = null; };
  }, [result]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">🔬 {t('BacktestPanel.title', '策略回测')}</h2>
          {strategyName && <p className="text-xs text-gray-500 mt-0.5">{strategyName}</p>}
        </div>
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-white">
          ← {t('BacktestPanel.back', '返回')}
        </button>
      </div>

      {/* Parameters */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-300">{t('BacktestPanel.params', '回测参数')}</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">{t('BacktestPanel.start', '开始日期')}</label>
            <input
              type="date"
              value={params.startDate}
              onChange={(e) => setParams({ ...params, startDate: e.target.value })}
              disabled={running}
              className="w-full bg-white/[0.04] border border-white/5 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#C9A046]/40 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">{t('BacktestPanel.end', '结束日期')}</label>
            <input
              type="date"
              value={params.endDate}
              onChange={(e) => setParams({ ...params, endDate: e.target.value })}
              disabled={running}
              className="w-full bg-white/[0.04] border border-white/5 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#C9A046]/40 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">{t('BacktestPanel.capital', '初始资金')}</label>
            <input
              type="number"
              value={params.initialCapital}
              onChange={(e) => setParams({ ...params, initialCapital: e.target.value })}
              disabled={running}
              className="w-full bg-white/[0.04] border border-white/5 rounded px-2 py-1 text-xs text-white text-right font-mono focus:outline-none focus:border-[#C9A046]/40 disabled:opacity-50"
            />
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="w-full text-sm bg-[#C9A046] hover:bg-[#D4A853] disabled:bg-white/10 disabled:text-gray-600 text-black font-medium py-2 rounded-lg transition-all"
        >
          {running ? '⏳ ' + t('BacktestPanel.running', '回测运行中...') : '▶ ' + t('BacktestPanel.run', '开始回测')}
        </button>

        {/* Progress bar */}
        {running && (
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-[#C9A046] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-xs text-red-400">{error}</div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: t('BacktestPanel.totalReturn', '总收益'), value: `${((result.totalReturn || 0) * 100).toFixed(1)}%`, color: (result.totalReturn || 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: t('BacktestPanel.annualReturn', '年化'), value: `${((result.annualReturn || 0) * 100).toFixed(1)}%`, color: 'text-white' },
              { label: 'Sharpe', value: (result.sharpeRatio || 0).toFixed(2), color: 'text-[#C9A046]' },
              { label: t('BacktestPanel.maxDD', '最大回撤'), value: `${((result.maxDrawdown || 0) * 100).toFixed(1)}%`, color: 'text-red-400' },
              { label: t('BacktestPanel.winRate', '胜率'), value: `${((result.winRate || 0) * 100).toFixed(0)}%`, color: 'text-white' },
              { label: t('BacktestPanel.trades', '交易'), value: `${result.totalTrades || 0}`, color: 'text-gray-300' },
            ].map((m, i) => (
              <div key={i} className="bg-[#1a1a25] border border-white/5 rounded-lg p-3 text-center">
                <p className={`text-sm font-mono font-bold ${m.color}`}>{m.value}</p>
                <span className="text-[10px] text-gray-500">{m.label}</span>
              </div>
            ))}
          </div>

          {/* Equity Curve */}
          {result.equityCurve && result.equityCurve.length > 0 && (
            <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-300 mb-3">{t('BacktestPanel.equity', '权益曲线')}</h3>
              <div ref={chartRef} className="w-full h-[250px]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BacktestPanel;
