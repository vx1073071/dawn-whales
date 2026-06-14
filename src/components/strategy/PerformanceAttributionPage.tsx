import { useState, useEffect } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import * as echarts from 'echarts';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useTranslation } from "react-i18next";
import i18n from '../../i18n';
import { getPerformance } from '@/lib/bridge-api';

interface AttributionData {
  strategyName: string;
  strategyId: string;
  totalReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  allocationEffect: number;
  selectionEffect: number;
  interactionEffect: number;
  factorExposures: {factor: string;exposure: number;contribution: number;}[];
  monthlyAttribution: {month: string;excessReturn: number;allocation: number;selection: number;interaction: number;}[];
  sectorAttribution: {sector: string;portfolioWeight: number;benchmarkWeight: number;portfolioReturn: number;benchmarkReturn: number;excessReturn: number;}[];
}

export default function PerformanceAttributionPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getPerformance('default');
      if (res?.success && res.attribution) {
        setData({
          strategyName: res.attribution.strategyName || '当前策略',
          strategyId: res.attribution.strategyId || 'default',
          totalReturn: res.attribution.totalReturn ?? 0,
          benchmarkReturn: res.attribution.benchmarkReturn ?? 0,
          excessReturn: (res.attribution.totalReturn ?? 0) - (res.attribution.benchmarkReturn ?? 0),
          allocationEffect: res.attribution.allocationEffect ?? 0,
          selectionEffect: res.attribution.selectionEffect ?? 0,
          interactionEffect: res.attribution.interactionEffect ?? 0,
          factorExposures: (res.attribution.factorExposures || []).map((f: Record<string, unknown>) => ({
            factor: String(f.factor || ''),
            exposure: Number(f.exposure || 0),
            contribution: Number(f.contribution || 0),
          })),
          monthlyAttribution: res.attribution.monthlyAttribution || [],
          sectorAttribution: res.attribution.sectorAttribution || [],
        });
      } else {
        setError('未获取到归因数据');
      }
    } catch (e) {
      console.error('[PerformanceAttributionPage]', e);
      void EngineError;
      setError(String(e));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Brinson stacked bar chart
  useEffect(() => {
    if (!data) return;
    const chartDom = document.getElementById('brinson-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      legend: { data: [i18n.t('PerformanceAttributionPage.k26'), i18n.t('PerformanceAttributionPage.k27'), i18n.t('PerformanceAttributionPage.k28')], textStyle: { color: '#9ca3af' }, bottom: 0 },
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: { type: 'category', data: data.monthlyAttribution.map((m) => m.month), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [
      { name: i18n.t('PerformanceAttributionPage.k29'), type: 'bar', stack: 'total', data: data.monthlyAttribution.map((m) => m.allocation), itemStyle: { color: '#3b82f6' } },
      { name: i18n.t('PerformanceAttributionPage.k30'), type: 'bar', stack: 'total', data: data.monthlyAttribution.map((m) => m.selection), itemStyle: { color: '#C9A046' } },
      { name: i18n.t('PerformanceAttributionPage.k31'), type: 'bar', stack: 'total', data: data.monthlyAttribution.map((m) => m.interaction), itemStyle: { color: '#8b5cf6' } }]

    });

    return () => chart.dispose();
  }, [data]);

  // Factor exposure radar
  useEffect(() => {
    if (!data) return;
    const chartDom = document.getElementById('factor-radar');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      radar: {
        indicator: data.factorExposures.map((f) => ({ name: f.factor, max: 1 })),
        radius: '60%',
        axisName: { color: '#9ca3af', fontSize: 11 },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      series: [{
        type: 'radar',
        data: [{
          value: data.factorExposures.map((f) => f.exposure),
          name: i18n.t('PerformanceAttributionPage.k32'),
          areaStyle: { color: 'rgba(201,160,70,0.2)' },
          lineStyle: { color: '#C9A046', width: 2 },
          itemStyle: { color: '#C9A046' }
        }]
      }]
    });

    return () => chart.dispose();
  }, [data]);

  if (loading) return <LoadingSpinner fullscreen text={i18n.t('PerformanceAttributionPage.k33')} />;
  if (error) return (
    <div className="p-6 min-h-full bg-deep flex flex-col items-center justify-center">
      <div className="text-red-400 text-lg font-semibold mb-2">⚠️ {t('common.error')}</div>
      <p className="text-gray-500 text-sm mb-4">{error}</p>
      <button onClick={load} className="px-4 py-2 bg-[#C9A046] text-black rounded-lg text-sm">重试</button>
    </div>
  );
  if (!data) return (
    <div className="p-6 min-h-full bg-deep flex flex-col items-center justify-center">
      <div className="text-gray-400 text-lg font-semibold mb-2">📊 暂无归因数据</div>
      <p className="text-gray-600 text-sm">请运行策略获取绩效归因分析</p>
    </div>
  );

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t("PerformanceAttributionPage.r92_ea0c")}</h1>
          <p className="text-gray-400 text-sm">{data.strategyName}{i18n.t("PerformanceAttributionPage.r92_3adb")}</p>
        </div>
        <button
          onClick={load}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors">{i18n.t("PerformanceAttributionPage.r92_ce57")}


        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('PerformanceAttributionPage.k0')}</div>
          <div className="text-xl font-bold font-mono text-red-400">+{data.totalReturn.toFixed(2)}%</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('PerformanceAttributionPage.k1')}</div>
          <div className="text-xl font-bold font-mono text-red-400">+{data.benchmarkReturn.toFixed(2)}%</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{t("components.excessReturn")}</div>
          <div className="text-xl font-bold font-mono text-[#D4A853]">+{data.excessReturn.toFixed(2)}%</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{t("components.infoRatio")}</div>
          <div className="text-xl font-bold font-mono text-white">{(data.excessReturn / 5.2).toFixed(2)}</div>
        </div>
      </div>

      {/* Brinson Attribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">{i18n.t("PerformanceAttributionPage.r92_5fb1")}</h2>
          <div className="space-y-3">
            {[
            { label: i18n.t('PerformanceAttributionPage.k34'), value: data.allocationEffect, desc: i18n.t('PerformanceAttributionPage.k35') },
            { label: i18n.t('PerformanceAttributionPage.k36'), value: data.selectionEffect, desc: i18n.t('PerformanceAttributionPage.k37') },
            { label: i18n.t('PerformanceAttributionPage.k38'), value: data.interactionEffect, desc: i18n.t('PerformanceAttributionPage.k39') }].
            map((item) =>
            <div key={item.label} className="flex items-center justify-between bg-deep rounded-lg p-3">
                <div>
                  <div className="text-sm text-white font-medium">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.desc}</div>
                </div>
                <span className={`text-lg font-bold font-mono ${item.value >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {item.value >= 0 ? '+' : ''}{item.value.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">{i18n.t('PerformanceAttributionPage.k2')}</h2>
          <div id="factor-radar" className="w-full h-[240px]" />
        </div>
      </div>

      {/* Monthly Attribution Chart */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">{i18n.t('PerformanceAttributionPage.k3')}</h2>
        <div id="brinson-chart" className="w-full h-[280px]" />
      </div>

      {/* Factor Contribution */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">{i18n.t('PerformanceAttributionPage.k4')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data.factorExposures.map((f) =>
          <div key={f.factor} className="bg-deep rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white font-medium">{f.factor}</span>
                <span className={`text-sm font-mono font-bold ${f.contribution >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {f.contribution >= 0 ? '+' : ''}{f.contribution.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 rounded-full h-2">
                  <div
                  className="h-2 rounded-full bg-[#C9A046]"
                  style={{ width: `${Math.abs(f.exposure) * 100}%` }} />
                
                </div>
                <span className="text-xs text-gray-500 font-mono">{f.exposure.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sector Attribution Table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">{i18n.t('PerformanceAttributionPage.k5')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">{t("components.industry")}</th>
                <th className="px-4 py-3 text-right">{i18n.t('PerformanceAttributionPage.k6')}</th>
                <th className="px-4 py-3 text-right">{i18n.t('PerformanceAttributionPage.k7')}</th>
                <th className="px-4 py-3 text-right">{i18n.t('PerformanceAttributionPage.k8')}</th>
                <th className="px-4 py-3 text-right">{i18n.t('PerformanceAttributionPage.k9')}</th>
                <th className="px-4 py-3 text-right">{t("components.excessReturn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.sectorAttribution.map((s) =>
              <tr key={s.sector} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white font-medium">{s.sector}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">{s.portfolioWeight}%</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">{s.benchmarkWeight}%</td>
                  <td className="px-4 py-3 text-right font-mono text-red-400">+{s.portfolioReturn.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right font-mono text-red-400">+{s.benchmarkReturn.toFixed(2)}%</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${s.excessReturn >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {s.excessReturn >= 0 ? '+' : ''}{s.excessReturn.toFixed(2)}%
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>);

}