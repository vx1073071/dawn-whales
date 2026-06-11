import { useState, useEffect, useRef } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import * as echarts from 'echarts';
import { getConsumerData } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface CPIData {
  month: string;
  cpi: number;
  food: number;
  nonFood: number;
  service: number;
  goods: number;
  clothing: number;
  housing: number;
  transport: number;
  education: number;
  medical: number;
}

interface RetailData {
  month: string;
  total: number;
  urban: number;
  rural: number;
  online: number;
  catering: number;
  goods: number;
}

interface ConsumerConfidence {
  month: string;
  index: number;
  expectation: number;
  satisfaction: number;
  income: number;
  employment: number;
}

export default function ConsumerDashboard() {
  const [cpiData, setCpiData] = useState<CPIData[]>([]);
  const [retailData, setRetailData] = useState<RetailData[]>([]);
  const [confidenceData, setConfidenceData] = useState<ConsumerConfidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cpiChartRef = useRef<HTMLDivElement>(null);
  const retailChartRef = useRef<HTMLDivElement>(null);
  const confidenceChartRef = useRef<HTMLDivElement>(null);
  const cpiChart = useRef<echarts.ECharts | null>(null);
  const retailChart = useRef<echarts.ECharts | null>(null);
  const confidenceChart = useRef<echarts.ECharts | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getConsumerData(12);
      if (res?.success) {
        setCpiData(res.cpi || []);
        setRetailData(res.retail || []);
        setConfidenceData(res.confidence || []);
      } else {
        setError(res?.error || i18n.t('ConsumerDashboard.k1'));
      }
    } catch (e: unknown) {
      void EngineError; // [DATA] structured error tracking
      setError((e as any).message || i18n.t('ConsumerDashboard.k2'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // CPI Chart
  useEffect(() => {
    if (!cpiChartRef.current || cpiData.length === 0) return;
    if (!cpiChart.current) cpiChart.current = echarts.init(cpiChartRef.current);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: ['CPI', i18n.t('ConsumerDashboard.k3'), i18n.t('ConsumerDashboard.k4'), i18n.t('ConsumerDashboard.k5')], textStyle: { color: '#9ca3af' } },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: cpiData.map((d) => d.month),
        axisLabel: { color: '#9ca3af' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#9ca3af', formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        { name: 'CPI', type: 'line', data: cpiData.map((d) => d.cpi), smooth: true, itemStyle: { color: '#C9A046' } },
        { name: i18n.t('ConsumerDashboard.k6'), type: 'line', data: cpiData.map((d) => d.food), smooth: true, itemStyle: { color: '#ef4444' } },
        { name: i18n.t('ConsumerDashboard.k7'), type: 'line', data: cpiData.map((d) => d.nonFood), smooth: true, itemStyle: { color: '#3b82f6' } },
        { name: i18n.t('ConsumerDashboard.k8'), type: 'line', data: cpiData.map((d) => d.service), smooth: true, itemStyle: { color: '#10b981' } },
      ],
    };
    cpiChart.current.setOption(option);
  }, [cpiData]);

  // Retail Chart
  useEffect(() => {
    if (!retailChartRef.current || retailData.length === 0) return;
    if (!retailChart.current) retailChart.current = echarts.init(retailChartRef.current);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: [i18n.t('ConsumerDashboard.k9'), i18n.t('ConsumerDashboard.k10'), i18n.t('ConsumerDashboard.k11'), i18n.t('ConsumerDashboard.k12')], textStyle: { color: '#9ca3af' } },
      grid: { left: 60, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: retailData.map((d) => d.month),
        axisLabel: { color: '#9ca3af' },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#9ca3af', formatter: (v: number) => `${(v / 10000).toFixed(0)}亿` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        { name: i18n.t('ConsumerDashboard.k13'), type: 'bar', data: retailData.map((d) => d.total), itemStyle: { color: '#C9A046' } },
        { name: i18n.t('ConsumerDashboard.k14'), type: 'bar', data: retailData.map((d) => d.urban), itemStyle: { color: '#3b82f6' } },
        { name: i18n.t('ConsumerDashboard.k15'), type: 'bar', data: retailData.map((d) => d.rural), itemStyle: { color: '#10b981' } },
        { name: i18n.t('ConsumerDashboard.k16'), type: 'line', data: retailData.map((d) => d.online), itemStyle: { color: '#ef4444' } },
      ],
    };
    retailChart.current.setOption(option);
  }, [retailData]);

  // Confidence Chart
  useEffect(() => {
    if (!confidenceChartRef.current || confidenceData.length === 0) return;
    if (!confidenceChart.current) confidenceChart.current = echarts.init(confidenceChartRef.current);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: [i18n.t('ConsumerDashboard.k17'), i18n.t('ConsumerDashboard.k18'), i18n.t('ConsumerDashboard.k19'), i18n.t('ConsumerDashboard.k20'), i18n.t('ConsumerDashboard.k21')], textStyle: { color: '#9ca3af' } },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: confidenceData.map((d) => d.month),
        axisLabel: { color: '#9ca3af' },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#9ca3af' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      series: [
        { name: i18n.t('ConsumerDashboard.k22'), type: 'line', data: confidenceData.map((d) => d.index), smooth: true, itemStyle: { color: '#C9A046' }, lineStyle: { width: 3 } },
        { name: i18n.t('ConsumerDashboard.k23'), type: 'line', data: confidenceData.map((d) => d.expectation), smooth: true, itemStyle: { color: '#3b82f6' } },
        { name: i18n.t('ConsumerDashboard.k24'), type: 'line', data: confidenceData.map((d) => d.satisfaction), smooth: true, itemStyle: { color: '#10b981' } },
        { name: i18n.t('ConsumerDashboard.k25'), type: 'line', data: confidenceData.map((d) => d.income), smooth: true, itemStyle: { color: '#ef4444' } },
        { name: i18n.t('ConsumerDashboard.k26'), type: 'line', data: confidenceData.map((d) => d.employment), smooth: true, itemStyle: { color: '#a855f7' } },
      ],
    };
    confidenceChart.current.setOption(option);
  }, [confidenceData]);

  useEffect(() => {
    const handleResize = () => {
      cpiChart.current?.resize();
      retailChart.current?.resize();
      confidenceChart.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const latestCpi = cpiData[cpiData.length - 1];
  const latestRetail = retailData[retailData.length - 1];
  const latestConfidence = confidenceData[confidenceData.length - 1];

  return (
    <div className="p-6 space-y-5 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🛒 消费数据</h1>
          <p className="text-gray-400 text-sm">CPI · 零售销售 · 消费者信心</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-3 py-2 rounded-lg border border-white/5 transition-colors"
        >
          {loading ? i18n.t('ConsumerDashboard.k27') : i18n.t('ConsumerDashboard.k28')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {latestCpi && (
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">CPI 同比</div>
            <div className="text-2xl font-bold text-white">{latestCpi.cpi?.toFixed(1) ?? '-'}%</div>
            <div className="text-xs text-gray-500 mt-1">{latestCpi.month}</div>
          </div>
        )}
        {latestRetail && (
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">零售总额</div>
            <div className="text-2xl font-bold text-white">{(latestRetail.total / 10000).toFixed(1)}亿</div>
            <div className="text-xs text-gray-500 mt-1">{latestRetail.month}</div>
          </div>
        )}
        {latestConfidence && (
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">消费者信心</div>
            <div className="text-2xl font-bold text-white">{latestConfidence.index?.toFixed(1) ?? '-'}</div>
            <div className="text-xs text-gray-500 mt-1">{latestConfidence.month}</div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-3">CPI 分项走势</h2>
          <div ref={cpiChartRef} style={{ height: 280 }} />
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-3">零售销售</h2>
          <div ref={retailChartRef} style={{ height: 280 }} />
        </div>
      </div>

      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <h2 className="text-sm font-medium text-white mb-3">消费者信心指数</h2>
        <div ref={confidenceChartRef} style={{ height: 280 }} />
      </div>
    </div>
  );
}
