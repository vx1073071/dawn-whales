import { useState, useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { getStockCapitalFlowRank, getSectorCapitalFlowRank, getConceptCapitalFlowRank } from '../../lib/bridge-api';

interface CapitalFlowItem {
  code: string;
  name: string;
  mainNetInflow: number;
  superLargeIn: number;
  largeIn: number;
  mediumIn: number;
  smallIn: number;
  changePct?: number;
  leadingStock?: string;
  leadingChangePct?: number;
}

export default function CapitalFlowPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'sector' | 'concept'>('stock');
  const [stockData, setStockData] = useState<CapitalFlowItem[]>([]);
  const [sectorData, setSectorData] = useState<CapitalFlowItem[]>([]);
  const [conceptData, setConceptData] = useState<CapitalFlowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const chartRef = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [stockRes, sectorRes, conceptRes] = await Promise.all([
        getStockCapitalFlowRank('mainNetInflow', 'desc', 20),
        getSectorCapitalFlowRank('mainNetInflow', 'desc', 15),
        getConceptCapitalFlowRank('mainNetInflow', 'desc', 15),
      ]);
      if (stockRes?.success) setStockData(stockRes.items || []);
      if (sectorRes?.success) setSectorData(sectorRes.items || []);
      if (conceptRes?.success) setConceptData(conceptRes.items || []);
    } catch (e: unknown) {
      setError(e.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, []);

  const currentData = activeTab === 'stock' ? stockData : activeTab === 'sector' ? sectorData : conceptData;

  // Chart
  useEffect(() => {
    if (!chartRef.current || currentData.length === 0) return;
    if (!chart.current) chart.current = echarts.init(chartRef.current);

    const sorted = [...currentData].sort((a, b) => b.mainNetInflow - a.mainNetInflow).slice(0, 15);
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { left: activeTab === 'stock' ? 100 : 80, right: 30, top: 10, bottom: 20 },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#9ca3af', formatter: (v: number) => `${(v / 1e4).toFixed(0)}万` },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((d) => d.name).reverse(),
        axisLabel: { color: '#d1d5db', fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [{
        type: 'bar',
        data: sorted.map((d) => ({
          value: d.mainNetInflow,
          itemStyle: { color: d.mainNetInflow >= 0 ? '#ef4444' : '#10b981' },
        })).reverse(),
        barWidth: 14,
        label: {
          show: true,
          position: 'right',
          formatter: (p: unknown) => `${(p.value / 1e4).toFixed(0)}万`,
          color: '#9ca3af',
          fontSize: 10,
        },
      }],
    };
    chart.current.setOption(option, true);
  }, [currentData, activeTab]);

  useEffect(() => {
    const handleResize = () => chart.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="p-6 space-y-5 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">💰 资金流向</h1>
          <p className="text-gray-400 text-sm">主力/超大/大单资金流向监控</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-3 py-2 rounded-lg border border-white/5 transition-colors"
        >
          {loading ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['stock', 'sector', 'concept'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`text-xs px-4 py-2 rounded-lg border transition-colors ${
              activeTab === t
                ? 'bg-[#C9A046]/20 border-[#C9A046]/40 text-[#C9A046]'
                : 'bg-[#1a1a25] border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'stock' ? '个股' : t === 'sector' ? t('components.industry') : t('components.concept')}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-3">
            {activeTab === 'stock' ? '个股' : activeTab === 'sector' ? t('components.industry') : t('components.concept')}资金净流入 Top 15
          </h2>
          <div ref={chartRef} style={{ height: 380 }} />
        </div>

        {/* Table */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-3">详细排行</h2>
          <div className="overflow-y-auto max-h-[380px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-white/5">
                  <th className="py-2 text-left">排名</th>
                  <th className="py-2 text-left">{t("components.name")}</th>
                  <th className="py-2 text-right">主力净流入</th>
                  <th className="py-2 text-right">超大单</th>
                  <th className="py-2 text-right">大单</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {currentData.map((item, i) => (
                  <tr key={item.code} className="hover:bg-white/[0.02]">
                    <td className="py-2 text-gray-500 text-xs">{i + 1}</td>
                    <td className="py-2">
                      <div className="text-white text-sm">{item.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{item.code}</div>
                    </td>
                    <td className={`py-2 text-right font-medium ${item.mainNetInflow >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {(item.mainNetInflow / 1e4).toFixed(0)}万
                    </td>
                    <td className={`py-2 text-right text-xs ${item.superLargeIn >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {(item.superLargeIn / 1e4).toFixed(0)}万
                    </td>
                    <td className={`py-2 text-right text-xs ${item.largeIn >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {(item.largeIn / 1e4).toFixed(0)}万
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {currentData.length === 0 && !loading && (
              <div className="text-gray-500 text-sm py-8 text-center">{t("components.noData")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
