import React, { useState, useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { getMarginData, getMarginBalanceRank, getShortInterestRank } from '../../lib/bridge-api';

interface MarginBalance {
  date: string;
  marginBalance: number;
  shortBalance: number;
  marginChange: number;
  shortChange: number;
}

interface StockMargin {
  code: string;
  name: string;
  marginBalance: number;
  marginChange: number;
  shortBalance: number;
  shortChange: number;
  netBuy: number;
}

export default function MarginDashboard() {
  const [balanceHistory, setBalanceHistory] = useState<MarginBalance[]>([]);
  const [marginRank, setMarginRank] = useState<StockMargin[]>([]);
  const [shortRank, setShortRank] = useState<StockMargin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const balanceChartRef = useRef<HTMLDivElement>(null);
  const balanceChart = useRef<echarts.ECharts | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [marginRes, balanceRes, shortRes] = await Promise.all([
        getMarginData(),
        getMarginBalanceRank(20),
        getShortInterestRank(20),
      ]);
      if (marginRes?.success) setBalanceHistory(marginRes.history || []);
      if (balanceRes?.success) setMarginRank(balanceRes.data || []);
      if (shortRes?.success) setShortRank(shortRes.data || []);
    } catch (e: any) {
      setError(e.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Balance Chart
  useEffect(() => {
    if (!balanceChartRef.current || balanceHistory.length === 0) return;
    if (!balanceChart.current) balanceChart.current = echarts.init(balanceChartRef.current);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: ['融资余额', '融券余额'], textStyle: { color: '#9ca3af' } },
      grid: { left: 60, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: balanceHistory.map((d) => d.date),
        axisLabel: { color: '#9ca3af' },
      },
      yAxis: [
        {
          type: 'value',
          name: '融资(亿)',
          axisLabel: { color: '#9ca3af', formatter: (v: number) => `${(v / 1e8).toFixed(0)}` },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        },
        {
          type: 'value',
          name: '融券(亿)',
          axisLabel: { color: '#9ca3af', formatter: (v: number) => `${(v / 1e8).toFixed(0)}` },
        },
      ],
      series: [
        { name: '融资余额', type: 'line', data: balanceHistory.map((d) => d.marginBalance), smooth: true, itemStyle: { color: '#ef4444' }, areaStyle: { color: 'rgba(239,68,68,0.1)' } },
        { name: '融券余额', type: 'line', yAxisIndex: 1, data: balanceHistory.map((d) => d.shortBalance), smooth: true, itemStyle: { color: '#3b82f6' } },
      ],
    };
    balanceChart.current.setOption(option);
  }, [balanceHistory]);

  useEffect(() => {
    const handleResize = () => balanceChart.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const latest = balanceHistory[balanceHistory.length - 1];

  return (
    <div className="p-6 space-y-5 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">💳 融资融券</h1>
          <p className="text-gray-400 text-sm">市场两融余额 · 个股排行</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-3 py-2 rounded-lg border border-white/5 transition-colors"
        >
          {loading ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      {/* Summary Cards */}
      {latest && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">融资余额</div>
            <div className="text-xl font-bold text-white">{(latest.marginBalance / 1e8).toFixed(0)}亿</div>
            <div className={`text-xs mt-1 ${latest.marginChange >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {latest.marginChange >= 0 ? '+' : ''}{(latest.marginChange / 1e8).toFixed(1)}亿
            </div>
          </div>
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">融券余额</div>
            <div className="text-xl font-bold text-white">{(latest.shortBalance / 1e8).toFixed(0)}亿</div>
            <div className={`text-xs mt-1 ${latest.shortChange >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {latest.shortChange >= 0 ? '+' : ''}{(latest.shortChange / 1e8).toFixed(1)}亿
            </div>
          </div>
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">两融合计</div>
            <div className="text-xl font-bold text-white">{((latest.marginBalance + latest.shortBalance) / 1e8).toFixed(0)}亿</div>
          </div>
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">数据日期</div>
            <div className="text-xl font-bold text-white">{latest.date}</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Balance Chart */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <h2 className="text-sm font-medium text-white mb-3">两融余额走势</h2>
        <div ref={balanceChartRef} style={{ height: 300 }} />
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Margin Balance Rank */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-3">🏆 融资余额 Top 20</h2>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {marginRank.map((s, i) => (
              <div key={s.code} className="flex items-center justify-between p-2 rounded hover:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-5">{i + 1}</span>
                  <span className="text-sm text-white">{s.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{s.code}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">{(s.marginBalance / 1e8).toFixed(1)}亿</div>
                  <div className={`text-[10px] ${s.marginChange >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {s.marginChange >= 0 ? '+' : ''}{(s.marginChange / 1e8).toFixed(1)}亿
                  </div>
                </div>
              </div>
            ))}
            {marginRank.length === 0 && <div className="text-gray-500 text-sm py-4 text-center">暂无数据</div>}
          </div>
        </div>

        {/* Short Interest Rank */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-3">📉 融券余量 Top 20</h2>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {shortRank.map((s, i) => (
              <div key={s.code} className="flex items-center justify-between p-2 rounded hover:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-5">{i + 1}</span>
                  <span className="text-sm text-white">{s.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{s.code}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">{(s.shortBalance / 1e8).toFixed(1)}亿</div>
                  <div className={`text-[10px] ${s.shortChange >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {s.shortChange >= 0 ? '+' : ''}{(s.shortChange / 1e8).toFixed(1)}亿
                  </div>
                </div>
              </div>
            ))}
            {shortRank.length === 0 && <div className="text-gray-500 text-sm py-4 text-center">暂无数据</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
