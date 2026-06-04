import { useState, useEffect, useMemo } from 'react';
import * as echarts from 'echarts';
import { getSmartPick } from '@/lib/bridge-api';

interface SmartPickItem {
  code: string;
  name: string;
  score: number;
  reasons: string[];
  dimensions: { value: number; growth: number; momentum: number; quality: number; sentiment: number };
  price: number;
  changePct: number;
  pe?: number;
  pb?: number;
  marketCap?: number;
}

const MOCK_DATA: SmartPickItem[] = [
  { code: 'NVDA', name: '英伟达', score: 94, reasons: ['AI芯片龙头', '财报超预期', '机构增持'], dimensions: { value: 75, growth: 98, momentum: 92, quality: 90, sentiment: 95 }, price: 875.28, changePct: 2.35, pe: 65.2, pb: 42.1, marketCap: 2150000000000 },
  { code: 'MSFT', name: '微软', score: 91, reasons: ['云计算增长', 'AI Copilot 变现', '稳健现金流'], dimensions: { value: 82, growth: 88, momentum: 85, quality: 95, sentiment: 90 }, price: 412.20, changePct: 0.85, pe: 36.1, pb: 12.8, marketCap: 3050000000000 },
  { code: 'AAPL', name: '苹果', score: 88, reasons: ['服务收入占比提升', '回购力度大', '品牌护城河'], dimensions: { value: 85, growth: 72, momentum: 78, quality: 96, sentiment: 85 }, price: 189.52, changePct: -0.42, pe: 29.3, pb: 45.2, marketCap: 2900000000000 },
  { code: 'AVGO', name: '博通', score: 87, reasons: ['AI芯片需求', 'VMware整合', '高股息'], dimensions: { value: 80, growth: 85, momentum: 88, quality: 88, sentiment: 82 }, price: 1280.45, changePct: 1.92, pe: 48.5, pb: 18.3, marketCap: 590000000000 },
  { code: 'META', name: 'Meta', score: 86, reasons: ['Reels变现', 'AI降本增效', '元宇宙收缩止损'], dimensions: { value: 78, growth: 80, momentum: 90, quality: 82, sentiment: 88 }, price: 474.35, changePct: 1.15, pe: 25.8, pb: 6.7, marketCap: 1210000000000 },
  { code: 'AMZN', name: '亚马逊', score: 84, reasons: ['AWS增速回升', '零售利润率改善', '物流优化'], dimensions: { value: 72, growth: 82, momentum: 80, quality: 85, sentiment: 80 }, price: 178.15, changePct: 0.55, pe: 58.2, pb: 6.2, marketCap: 1850000000000 },
  { code: 'GOOGL', name: '谷歌', score: 83, reasons: ['搜索广告韧性', '云业务减亏', 'AI整合搜索'], dimensions: { value: 76, growth: 75, momentum: 82, quality: 90, sentiment: 78 }, price: 165.85, changePct: -0.22, pe: 24.5, pb: 5.8, marketCap: 2050000000000 },
  { code: 'TSLA', name: '特斯拉', score: 79, reasons: ['FSD进展', '储能增长', '价格战趋缓'], dimensions: { value: 65, growth: 88, momentum: 85, quality: 70, sentiment: 75 }, price: 172.63, changePct: 3.12, pe: 42.1, pb: 8.5, marketCap: 550000000000 },
  { code: 'AMD', name: 'AMD', score: 77, reasons: ['MI300需求', 'PC市场复苏', '服务器份额提升'], dimensions: { value: 68, growth: 85, momentum: 80, quality: 72, sentiment: 78 }, price: 148.25, changePct: -1.05, pe: 185.3, pb: 3.8, marketCap: 239000000000 },
  { code: 'CRM', name: 'Salesforce', score: 75, reasons: ['AI Einstein增长', '利润率提升', 'CRM市场领先'], dimensions: { value: 70, growth: 72, momentum: 75, quality: 80, sentiment: 72 }, price: 298.45, changePct: 0.28, pe: 62.5, pb: 4.2, marketCap: 288000000000 },
];

export default function SmartPickerPage() {
  const [data, setData] = useState<SmartPickItem[]>(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SmartPickItem | null>(null);
  const [sortKey, setSortKey] = useState<'score' | 'changePct' | 'pe'>('score');

  async function load() {
    setLoading(true);
    try {
      const res = await getSmartPick();
      if (res?.success && Array.isArray(res.data)) setData(res.data);
    } catch (e) { console.error('[Error:SmartPickerPage]', e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortKey === 'pe') return (a.pe ?? 999) - (b.pe ?? 999);
      return (b[sortKey] ?? 0) - (a[sortKey] ?? 0);
    });
  }, [data, sortKey]);

  function renderRadar(item: SmartPickItem) {
    const chartDom = document.getElementById(`radar-${item.code}`);
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });
    chart.setOption({
      backgroundColor: 'transparent',
      radar: {
        indicator: [
          { name: '价值', max: 100 },
          { name: '成长', max: 100 },
          { name: '动量', max: 100 },
          { name: '质量', max: 100 },
          { name: '情绪', max: 100 },
        ],
        radius: '65%',
        axisName: { color: '#9ca3af', fontSize: 10 },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: [item.dimensions.value, item.dimensions.growth, item.dimensions.momentum, item.dimensions.quality, item.dimensions.sentiment],
          name: item.code,
          areaStyle: { color: 'rgba(201,160,70,0.2)' },
          lineStyle: { color: '#C9A046', width: 2 },
          itemStyle: { color: '#C9A046' },
        }],
      }],
    });
  }

  useEffect(() => {
    if (selected) {
      setTimeout(() => renderRadar(selected), 50);
    }
  }, [selected]);

  return (
    <div className="p-6 space-y-6 bg-[#0a0a12] min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🎯 智能选股</h1>
          <p className="text-gray-400 text-sm">基于多因子模型的 Top 10 推荐</p>
        </div>
        <div className="flex gap-2">
          {(['score', 'changePct', 'pe'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                sortKey === k
                  ? 'bg-[#C9A046]/20 border-[#C9A046] text-[#D4A853]'
                  : 'bg-[#1a1a25] border-white/5 text-gray-400 hover:text-gray-200'
              }`}
            >
              {k === 'score' ? '按评分' : k === 'changePct' ? '按涨跌幅' : '按PE'}
            </button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* Top 10 Table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">排名</th>
                <th className="px-4 py-3 text-left">股票</th>
                <th className="px-4 py-3 text-right">评分</th>
                <th className="px-4 py-3 text-right">价格</th>
                <th className="px-4 py-3 text-right">涨跌幅</th>
                <th className="px-4 py-3 text-right">PE</th>
                <th className="px-4 py-3 text-right">市值</th>
                <th className="px-4 py-3 text-left">推荐理由</th>
                <th className="px-4 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sorted.map((item, idx) => (
                <tr key={item.code} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      idx < 3 ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'bg-[#1a1a25] text-gray-500'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.code}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-lg font-bold text-[#D4A853]">{item.score}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">${item.price.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${item.changePct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{item.pe?.toFixed(1) ?? '--'}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    {item.marketCap ? `${(item.marketCap / 1e9).toFixed(0)}B` : '--'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.reasons.map((r) => (
                        <span key={r} className="text-[10px] bg-[#C9A046]/10 text-[#D4A853] px-1.5 py-0.5 rounded">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelected(item)}
                      className="text-xs text-[#D4A853] hover:text-[#E5B964] transition-colors"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-[#1a1a25] border border-white/10 rounded-2xl p-6 w-[600px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selected.name} <span className="text-gray-500">({selected.code})</span></h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-2xl font-bold text-[#D4A853]">{selected.score}</span>
                  <span className="text-sm text-gray-400">综合评分</span>
                  <span className={`text-sm font-mono ${selected.changePct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selected.changePct >= 0 ? '+' : ''}{selected.changePct.toFixed(2)}%
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-lg">&times;</button>
            </div>

            {/* Radar Chart */}
            <div id={`radar-${selected.code}`} className="w-full h-[280px]" />

            {/* Dimension Breakdown */}
            <div className="grid grid-cols-5 gap-2 mt-4">
              {[
                { label: '价值', val: selected.dimensions.value },
                { label: '成长', val: selected.dimensions.growth },
                { label: '动量', val: selected.dimensions.momentum },
                { label: '质量', val: selected.dimensions.quality },
                { label: '情绪', val: selected.dimensions.sentiment },
              ].map((d) => (
                <div key={d.label} className="bg-[#0a0a12] rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-white">{d.val}</div>
                  <div className="text-[10px] text-gray-500">{d.label}</div>
                  <div className="w-full bg-white/5 rounded-full h-1 mt-2">
                    <div className="bg-[#C9A046] h-1 rounded-full" style={{ width: `${d.val}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Reasons */}
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2">推荐理由</div>
              <div className="flex flex-wrap gap-2">
                {selected.reasons.map((r) => (
                  <span key={r} className="text-xs bg-[#C9A046]/10 text-[#D4A853] px-2 py-1 rounded-lg">{r}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
