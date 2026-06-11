// ── DAWN WHALES — PortfolioStressTest (组合压力测试) ────────────────────────

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts';
import { useRef, useEffect } from 'react';
import i18n from '../../i18n';

interface Scenario {
  name: string;
  description: string;
  shockPct: number;
  probability: number;
  impact: 'high' | 'medium' | 'low';
}

const SCENARIOS: Scenario[] = [
  { name: i18n.t('PortfolioStressTest.k1'), description: i18n.t('PortfolioStressTest.k2'), shockPct: -0.30, probability: 0.05, impact: 'high' },
  { name: i18n.t('PortfolioStressTest.k3'), description: i18n.t('PortfolioStressTest.k4'), shockPct: -0.15, probability: 0.15, impact: 'high' },
  { name: i18n.t('PortfolioStressTest.k5'), description: i18n.t('PortfolioStressTest.k6'), shockPct: -0.08, probability: 0.30, impact: 'medium' },
  { name: i18n.t('PortfolioStressTest.k7'), description: i18n.t('PortfolioStressTest.k8'), shockPct: -0.02, probability: 0.35, impact: 'low' },
  { name: i18n.t('PortfolioStressTest.k9'), description: i18n.t('PortfolioStressTest.k10'), shockPct: 0.10, probability: 0.12, impact: 'medium' },
  { name: i18n.t('PortfolioStressTest.k11'), description: i18n.t('PortfolioStressTest.k12'), shockPct: 0.20, probability: 0.03, impact: 'low' },
];

export default function PortfolioStressTest() {
  const { t: _t } = useTranslation();

  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[2]);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const portfolioValue = 100000;

  const scenarioResults = useMemo(() => {
    return SCENARIOS.map((s) => ({
      ...s,
      newValue: portfolioValue * (1 + s.shockPct),
      loss: portfolioValue * s.shockPct,
    }));
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.dispose();

    chartInstance.current = echarts.init(chartRef.current, 'dark');

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { top: 20, right: 20, bottom: 30, left: 80 },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#6b7280',
          fontSize: 10,
          formatter: (v: number) => `$${(v / 1000).toFixed(0)}k`,
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      yAxis: {
        type: 'category',
        data: scenarioResults.map((s) => s.name).reverse(),
        axisLabel: { color: '#9ca3af', fontSize: 11 },
        axisLine: { show: false },
        splitLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: scenarioResults.map((s) => ({
            value: s.newValue,
            itemStyle: {
              color: s.shockPct >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)',
            },
          })).reverse(),
          barWidth: 16,
          label: {
            show: true,
            position: 'right',
            color: '#e5e7eb',
            fontSize: 10,
            formatter: (params: any) => {
              const scenario = scenarioResults[scenarioResults.length - 1 - (params as any).dataIndex];
              return `${scenario.shockPct >= 0 ? '+' : ''}${(scenario.shockPct * 100).toFixed(0)}%`;
            },
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [scenarioResults]);

  const selectedResult = scenarioResults.find((s) => s.name === selectedScenario.name)!;

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">🧪 组合压力测试</h2>
        <span className="text-gray-500 text-[10px]">假设本金 ${portfolioValue.toLocaleString()}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Chart */}
        <div ref={chartRef} style={{ width: '100%', height: 200 }} />

        {/* Scenario Detail */}
        <div className="space-y-2">
          {SCENARIOS.map((scenario) => {
            const result = scenarioResults.find((s) => s.name === scenario.name)!;
            const isSelected = selectedScenario.name === scenario.name;
            return (
              <button
                key={scenario.name}
                onClick={() => setSelectedScenario(scenario)}
                className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                  isSelected ? 'bg-[#C9A046]/10 border border-[#C9A046]/20' : 'bg-[#12121a] border border-transparent hover:bg-[#1a1a25]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-xs font-medium">{scenario.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      scenario.impact === 'high' ? 'bg-red-500/10 text-red-400' :
                      scenario.impact === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {scenario.impact === 'high' ? i18n.t('PortfolioStressTest.k13') : scenario.impact === 'medium' ? i18n.t('PortfolioStressTest.k14') : i18n.t('PortfolioStressTest.k15')}
                    </span>
                  </div>
                  <span className={`text-xs font-mono ${result.loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.loss >= 0 ? '+' : ''}${result.loss.toFixed(0)}
                  </span>
                </div>
                <div className="text-gray-500 text-[10px] mt-0.5">{scenario.description} · 概率 {(scenario.probability * 100).toFixed(0)}%</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Scenario Summary */}
      <div className="mt-4 bg-[#12121a] rounded-lg p-3 border border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">选中场景: <span className="text-white">{selectedScenario.name}</span></span>
          <span className="text-gray-500">
            组合价值: <span className={selectedResult.newValue >= portfolioValue ? 'text-emerald-400' : 'text-red-400'}>
              ${selectedResult.newValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
