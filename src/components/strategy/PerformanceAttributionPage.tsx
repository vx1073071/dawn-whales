import { useState, useEffect } from 'react';
import * as echarts from 'echarts';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useTranslation } from "react-i18next";

interface AttributionData {
  strategyName: string;
  strategyId: string;
  totalReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  // Brinson attribution
  allocationEffect: number;
  selectionEffect: number;
  interactionEffect: number;
  // Factor exposures
  factorExposures: { factor: string; exposure: number; contribution: number }[];
  // Time series
  monthlyAttribution: { month: string; excessReturn: number; allocation: number; selection: number; interaction: number }[];
  // Sector attribution
  sectorAttribution: { sector: string; portfolioWeight: number; benchmarkWeight: number; portfolioReturn: number; benchmarkReturn: number; excessReturn: number }[];
}

const MOCK_DATA: AttributionData = {
  strategyName: '双均线突破策略',
  strategyId: 'strategy-001',
  totalReturn: 28.5,
  benchmarkReturn: 15.2,
  excessReturn: 13.3,
  allocationEffect: 3.2,
  selectionEffect: 8.5,
  interactionEffect: 1.6,
  factorExposures: [
    { factor: '动量', exposure: 0.65, contribution: 5.2 },
    { factor: '价值', exposure: 0.15, contribution: 0.8 },
    { factor: '质量', exposure: 0.25, contribution: 1.5 },
    { factor: '低波动', exposure: -0.10, contribution: -0.5 },
    { factor: '市值', exposure: 0.35, contribution: 2.8 },
    { factor: '成长', exposure: 0.45, contribution: 3.5 },
  ],
  monthlyAttribution: [
    { month: '1月', excessReturn: 2.1, allocation: 0.5, selection: 1.4, interaction: 0.2 },
    { month: '2月', excessReturn: -1.5, allocation: -0.3, selection: -0.9, interaction: -0.3 },
    { month: '3月', excessReturn: 3.2, allocation: 0.8, selection: 2.0, interaction: 0.4 },
    { month: '4月', excessReturn: 1.8, allocation: 0.4, selection: 1.1, interaction: 0.3 },
    { month: '5月', excessReturn: -0.5, allocation: -0.1, selection: -0.3, interaction: -0.1 },
    { month: '6月', excessReturn: 2.8, allocation: 0.6, selection: 1.8, interaction: 0.4 },
    { month: '7月', excessReturn: 1.2, allocation: 0.3, selection: 0.7, interaction: 0.2 },
    { month: '8月', excessReturn: 3.5, allocation: 0.9, selection: 2.2, interaction: 0.4 },
    { month: '9月', excessReturn: -2.1, allocation: -0.5, selection: -1.3, interaction: -0.3 },
    { month: '10月', excessReturn: 4.2, allocation: 1.0, selection: 2.6, interaction: 0.6 },
    { month: '11月', excessReturn: 1.5, allocation: 0.4, selection: 0.9, interaction: 0.2 },
    { month: '12月', excessReturn: 2.8, allocation: 0.7, selection: 1.7, interaction: 0.4 },
  ],
  sectorAttribution: [
    { sector: '科技', portfolioWeight: 35, benchmarkWeight: 28, portfolioReturn: 32.5, benchmarkReturn: 25.8, excessReturn: 6.7 },
    { sector: '金融', portfolioWeight: 15, benchmarkWeight: 18, portfolioReturn: 12.3, benchmarkReturn: 14.5, excessReturn: -2.2 },
    { sector: '消费', portfolioWeight: 20, benchmarkWeight: 22, portfolioReturn: 18.5, benchmarkReturn: 16.2, excessReturn: 2.3 },
    { sector: '医药', portfolioWeight: 12, benchmarkWeight: 10, portfolioReturn: 15.8, benchmarkReturn: 12.5, excessReturn: 3.3 },
    { sector: '能源', portfolioWeight: 8, benchmarkWeight: 12, portfolioReturn: 8.5, benchmarkReturn: 10.2, excessReturn: -1.7 },
    { sector: '工业', portfolioWeight: 10, benchmarkWeight: 10, portfolioReturn: 16.2, benchmarkReturn: 14.8, excessReturn: 1.4 },
  ],
};

export default function PerformanceAttributionPage() {
  const { t } = useTranslation();

  const [data] = useState<AttributionData>(MOCK_DATA);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // const res = await getPerformanceAttribution();
      // if (res?.success) setData(res.data);
    } catch (e) { console.error('[Error:PerformanceAttributionPage]', e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Brinson stacked bar chart
  useEffect(() => {
    const chartDom = document.getElementById('brinson-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      legend: { data: ['资产配置', '个股选择', '交互作用'], textStyle: { color: '#9ca3af' }, bottom: 0 },
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: { type: 'category', data: data.monthlyAttribution.map(m => m.month), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [
        { name: '资产配置', type: 'bar', stack: 'total', data: data.monthlyAttribution.map(m => m.allocation), itemStyle: { color: '#3b82f6' } },
        { name: '个股选择', type: 'bar', stack: 'total', data: data.monthlyAttribution.map(m => m.selection), itemStyle: { color: '#C9A046' } },
        { name: '交互作用', type: 'bar', stack: 'total', data: data.monthlyAttribution.map(m => m.interaction), itemStyle: { color: '#8b5cf6' } },
      ],
    });

    return () => chart.dispose();
  }, [data]);

  // Factor exposure radar
  useEffect(() => {
    const chartDom = document.getElementById('factor-radar');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      radar: {
        indicator: data.factorExposures.map(f => ({ name: f.factor, max: 1 })),
        radius: '60%',
        axisName: { color: '#9ca3af', fontSize: 11 },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: data.factorExposures.map(f => f.exposure),
          name: '因子敞口',
          areaStyle: { color: 'rgba(201,160,70,0.2)' },
          lineStyle: { color: '#C9A046', width: 2 },
          itemStyle: { color: '#C9A046' },
        }],
      }],
    });

    return () => chart.dispose();
  }, [data]);

  if (loading) return <LoadingSpinner fullscreen text="加载归因数据..." />;

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">📈 绩效归因</h1>
          <p className="text-gray-400 text-sm">{data.strategyName} · Brinson 归因分析</p>
        </div>
        <button
          onClick={load}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
        >
          刷新数据
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">策略收益</div>
          <div className="text-xl font-bold font-mono text-red-400">+{data.totalReturn.toFixed(2)}%</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">基准收益</div>
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
          <h2 className="text-sm font-semibold text-white mb-4">Brinson 归因分解</h2>
          <div className="space-y-3">
            {[
              { label: '资产配置效应', value: data.allocationEffect, desc: '行业配置带来的超额收益' },
              { label: '个股选择效应', value: data.selectionEffect, desc: '行业内选股带来的超额收益' },
              { label: '交互效应', value: data.interactionEffect, desc: '配置与选股的交叉影响' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between bg-deep rounded-lg p-3">
                <div>
                  <div className="text-sm text-white font-medium">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.desc}</div>
                </div>
                <span className={`text-lg font-bold font-mono ${item.value >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {item.value >= 0 ? '+' : ''}{item.value.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">因子敞口</h2>
          <div id="factor-radar" className="w-full h-[240px]" />
        </div>
      </div>

      {/* Monthly Attribution Chart */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">月度归因分解</h2>
        <div id="brinson-chart" className="w-full h-[280px]" />
      </div>

      {/* Factor Contribution */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">因子贡献度</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data.factorExposures.map((f) => (
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
                    style={{ width: `${Math.abs(f.exposure) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 font-mono">{f.exposure.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sector Attribution Table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">行业归因</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">{t("components.industry")}</th>
                <th className="px-4 py-3 text-right">组合权重</th>
                <th className="px-4 py-3 text-right">基准权重</th>
                <th className="px-4 py-3 text-right">组合收益</th>
                <th className="px-4 py-3 text-right">基准收益</th>
                <th className="px-4 py-3 text-right">{t("components.excessReturn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.sectorAttribution.map((s) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
