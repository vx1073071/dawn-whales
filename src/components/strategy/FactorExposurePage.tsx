import { useState, useEffect } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import * as echarts from 'echarts';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useTranslation } from "react-i18next";
import i18n from '../../i18n';

interface FactorData {
  factor: string;
  name: string;
  exposure: number;
  contribution: number;
  tStat: number;
  pValue: number;
  significance: '***' | '**' | '*' | 'ns';
}

interface FactorExposureResult {
  strategyName: string;
  rSquared: number;
  residualPnL: number;
  totalPnL: number;
  explainedPnL: number;
  factors: FactorData[];
  monthlyResiduals: {month: string;residual: number;}[];
  factorCorrelation: {factor1: string;factor2: string;correlation: number;}[];
}

const MOCK_DATA: FactorExposureResult = {
  strategyName: i18n.t('FactorExposurePage.k1'),
  rSquared: 0.72,
  residualPnL: 3250,
  totalPnL: 15280,
  explainedPnL: 12030,
  factors: [
  { factor: 'MKT', name: i18n.t('FactorExposurePage.k2'), exposure: 0.85, contribution: 6800, tStat: 4.52, pValue: 0.0001, significance: '***' },
  { factor: 'SMB', name: i18n.t('FactorExposurePage.k3'), exposure: 0.35, contribution: 1200, tStat: 2.18, pValue: 0.032, significance: '*' },
  { factor: 'HML', name: i18n.t('FactorExposurePage.k4'), exposure: -0.15, contribution: -450, tStat: -1.05, pValue: 0.298, significance: 'ns' },
  { factor: 'RMW', name: i18n.t('FactorExposurePage.k5'), exposure: 0.22, contribution: 850, tStat: 1.85, pValue: 0.068, significance: '*' },
  { factor: 'CMA', name: i18n.t('FactorExposurePage.k6'), exposure: 0.08, contribution: 180, tStat: 0.62, pValue: 0.538, significance: 'ns' },
  { factor: 'MOM', name: i18n.t('FactorExposurePage.k7'), exposure: 0.65, contribution: 5200, tStat: 5.12, pValue: 0.00001, significance: '***' },
  { factor: 'LOWVOL', name: i18n.t('FactorExposurePage.k8'), exposure: -0.25, contribution: -680, tStat: -1.42, pValue: 0.158, significance: 'ns' },
  { factor: 'QUAL', name: i18n.t('FactorExposurePage.k9'), exposure: 0.18, contribution: 930, tStat: 1.68, pValue: 0.096, significance: '*' }],

  monthlyResiduals: [
  { month: i18n.t('FactorExposurePage.k10'), residual: 320 },
  { month: i18n.t('FactorExposurePage.k11'), residual: -150 },
  { month: i18n.t('FactorExposurePage.k12'), residual: 480 },
  { month: i18n.t('FactorExposurePage.k13'), residual: 210 },
  { month: i18n.t('FactorExposurePage.k14'), residual: -80 },
  { month: i18n.t('FactorExposurePage.k15'), residual: 350 },
  { month: i18n.t('FactorExposurePage.k16'), residual: 120 },
  { month: i18n.t('FactorExposurePage.k17'), residual: 290 },
  { month: i18n.t('FactorExposurePage.k18'), residual: -210 },
  { month: i18n.t('FactorExposurePage.k19'), residual: 420 },
  { month: i18n.t('FactorExposurePage.k20'), residual: 180 },
  { month: i18n.t('FactorExposurePage.k21'), residual: 320 }],

  factorCorrelation: [
  { factor1: 'MKT', factor2: 'MOM', correlation: 0.65 },
  { factor1: 'MKT', factor2: 'SMB', correlation: 0.35 },
  { factor1: 'HML', factor2: 'RMW', correlation: 0.42 },
  { factor1: 'LOWVOL', factor2: 'QUAL', correlation: 0.28 },
  { factor1: 'MOM', factor2: 'QUAL', correlation: 0.38 }]

};

export default function FactorExposurePage() {
  const { t } = useTranslation();

  const [data] = useState<FactorExposureResult>(MOCK_DATA);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {


      // const res = await getFactorExposure();
      // if (res?.success) setData(res.data);
    } catch (e) {console.error('[Error:FactorExposurePage]', e);}void EngineError; // [SYSTEM] structured error tracking
    setLoading(false);}

  useEffect(() => {load();}, []);

  // Factor radar
  useEffect(() => {
    const chartDom = document.getElementById('factor-radar-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      radar: {
        indicator: data.factors.map((f) => ({ name: f.name, max: 1 })),
        radius: '60%',
        axisName: { color: '#9ca3af', fontSize: 10 },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      },
      series: [{
        type: 'radar',
        data: [{
          value: data.factors.map((f) => Math.abs(f.exposure)),
          name: i18n.t('FactorExposurePage.k22'),
          areaStyle: { color: 'rgba(201,160,70,0.2)' },
          lineStyle: { color: '#C9A046', width: 2 },
          itemStyle: { color: '#C9A046' }
        }]
      }]
    });

    return () => chart.dispose();
  }, [data]);

  // Contribution bar chart
  useEffect(() => {
    const chartDom = document.getElementById('factor-contribution-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      grid: { left: 80, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: '${value}' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      yAxis: { type: 'category', data: data.factors.map((f) => f.name).reverse(), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#9ca3af', fontSize: 10 } },
      series: [{
        type: 'bar',
        data: [...data.factors].reverse().map((f) => ({
          value: f.contribution,
          itemStyle: { color: f.contribution >= 0 ? '#ef4444' : '#10b981' }
        })),
        barWidth: '60%',
        label: { show: true, position: 'right', color: '#e5e7eb', fontSize: 10, formatter: (p: Record<string, unknown>) => `$${p.value}` }
      }]
    });

    return () => chart.dispose();
  }, [data]);

  // Residual chart
  useEffect(() => {
    const chartDom = document.getElementById('residual-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: data.monthlyResiduals.map((r) => r.month), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: '${value}' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [{
        type: 'bar',
        data: data.monthlyResiduals.map((r) => ({
          value: r.residual,
          itemStyle: { color: r.residual >= 0 ? '#ef4444' : '#10b981' }
        })),
        barWidth: '50%'
      }]
    });

    return () => chart.dispose();
  }, [data]);

  if (loading) return <LoadingSpinner fullscreen text={i18n.t('FactorExposurePage.k23')} />;

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t("FactorExposurePage.r92_9fd5")}</h1>
          <p className="text-gray-400 text-sm">{data.strategyName}{i18n.t("FactorExposurePage.r92_04dc")}</p>
        </div>
        <button
          onClick={load}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors">{i18n.t("FactorExposurePage.r92_ae2e")}


        </button>
      </div>

      {/* Model Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{i18n.t("FactorExposurePage.r92_9136")}</div>
          <div className="text-xl font-bold font-mono text-white">{(data.rSquared * 100).toFixed(1)}%</div>
          <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
            <div className="bg-[#C9A046] h-1.5 rounded-full" style={{ width: `${data.rSquared * 100}%` }} />
          </div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{i18n.t("FactorExposurePage.r92_126e")}</div>
          <div className="text-xl font-bold font-mono text-red-400">+${data.totalPnL.toLocaleString()}</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{i18n.t("FactorExposurePage.r92_a1ba")}</div>
          <div className="text-xl font-bold font-mono text-[#D4A853]">${data.explainedPnL.toLocaleString()}</div>
          <div className="text-xs text-gray-500">{(data.explainedPnL / data.totalPnL * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{i18n.t("FactorExposurePage.r92_3e92")}</div>
          <div className={`text-xl font-bold font-mono ${data.residualPnL >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {data.residualPnL >= 0 ? '+' : ''}${data.residualPnL.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Factor Radar + Contribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">{i18n.t('FactorExposurePage.k0')}</h2>
          <div id="factor-radar-chart" className="w-full h-[280px]" />
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">{i18n.t('FactorExposurePage.k1')}</h2>
          <div id="factor-contribution-chart" className="w-full h-[280px]" />
        </div>
      </div>

      {/* Factor Detail Table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">{i18n.t('FactorExposurePage.k2')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">{t("components.factor")}</th>
                <th className="px-4 py-3 text-right">{i18n.t('FactorExposurePage.k3')}</th>
                <th className="px-4 py-3 text-right">{i18n.t('FactorExposurePage.k4')}</th>
                <th className="px-4 py-3 text-right">{i18n.t("FactorExposurePage.r92_e6bb")}</th>
                <th className="px-4 py-3 text-right">{i18n.t("FactorExposurePage.r92_ca0c")}</th>
                <th className="px-4 py-3 text-center">{i18n.t('FactorExposurePage.k5')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.factors.map((f) =>
              <tr key={f.factor} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{f.name}</div>
                    <div className="text-[10px] text-gray-500">{f.factor}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">{f.exposure.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${f.contribution >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {f.contribution >= 0 ? '+' : ''}${f.contribution.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{f.tStat.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{f.pValue.toFixed(4)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-bold ${
                  f.significance === '***' ? 'text-red-400' :
                  f.significance === '**' ? 'text-orange-400' :
                  f.significance === '*' ? 'text-yellow-400' :
                  'text-gray-500'}`
                  }>
                      {f.significance}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Residuals */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">{i18n.t('FactorExposurePage.k6')}</h2>
        <div id="residual-chart" className="w-full h-[200px]" />
      </div>

      {/* Factor Correlation */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">{i18n.t('FactorExposurePage.k7')}</h2>
        <div className="flex flex-wrap gap-3">
          {data.factorCorrelation.map((c, idx) =>
          <div key={idx} className="bg-deep rounded-lg px-3 py-2">
              <div className="text-xs text-gray-400">{c.factor1} ↔ {c.factor2}</div>
              <div className={`text-sm font-mono font-bold ${c.correlation > 0.5 ? 'text-red-400' : c.correlation > 0.3 ? 'text-yellow-400' : 'text-gray-300'}`}>
                {c.correlation.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>);

}