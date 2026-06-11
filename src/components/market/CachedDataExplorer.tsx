import { useState, useEffect } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import * as echarts from 'echarts';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import i18n from '../../i18n';

interface CacheEntry {
  key: string;
  namespace: string;
  size: number;
  createdAt: string;
  expiresAt: string;
  hits: number;
  ttl: number;
}

interface CacheNamespace {
  name: string;
  entries: number;
  maxEntries: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  evictions: number;
  expired: number;
  memoryUsage: number;
}

const MOCK_NAMESPACES: CacheNamespace[] = [
  { name: 'quote', entries: 1520, maxEntries: 2000, hitRate: 87.5, totalHits: 12580, totalMisses: 1900, evictions: 45, expired: 120, memoryUsage: 2.5 },
  { name: 'heatmap', entries: 320, maxEntries: 500, hitRate: 92.3, totalHits: 4200, totalMisses: 350, evictions: 8, expired: 15, memoryUsage: 0.8 },
  { name: 'macro', entries: 85, maxEntries: 200, hitRate: 95.1, totalHits: 1800, totalMisses: 90, evictions: 2, expired: 5, memoryUsage: 0.3 },
  { name: 'sentiment', entries: 210, maxEntries: 500, hitRate: 78.2, totalHits: 3200, totalMisses: 890, evictions: 12, expired: 30, memoryUsage: 0.6 },
  { name: 'fund', entries: 450, maxEntries: 800, hitRate: 88.9, totalHits: 5800, totalMisses: 720, evictions: 15, expired: 40, memoryUsage: 1.2 },
  { name: 'news', entries: 680, maxEntries: 1000, hitRate: 72.5, totalHits: 4200, totalMisses: 1590, evictions: 28, expired: 85, memoryUsage: 1.8 },
  { name: 'dragonTiger', entries: 120, maxEntries: 300, hitRate: 91.0, totalHits: 2100, totalMisses: 210, evictions: 5, expired: 10, memoryUsage: 0.4 },
];

const MOCK_ENTRIES: CacheEntry[] = [
  { key: 'quote:AAPL', namespace: 'quote', size: 256, createdAt: '2024-06-05T00:50:00', expiresAt: '2024-06-05T01:50:00', hits: 45, ttl: 3600 },
  { key: 'quote:NVDA', namespace: 'quote', size: 256, createdAt: '2024-06-05T00:51:00', expiresAt: '2024-06-05T01:51:00', hits: 38, ttl: 3600 },
  { key: 'quote:TSLA', namespace: 'quote', size: 256, createdAt: '2024-06-05T00:52:00', expiresAt: '2024-06-05T01:52:00', hits: 32, ttl: 3600 },
  { key: 'heatmap:industry', namespace: 'heatmap', size: 1024, createdAt: '2024-06-05T00:45:00', expiresAt: '2024-06-05T01:15:00', hits: 12, ttl: 1800 },
  { key: 'macro:GDP', namespace: 'macro', size: 512, createdAt: '2024-06-05T00:30:00', expiresAt: '2024-06-05T06:30:00', hits: 8, ttl: 21600 },
  { key: 'sentiment:overall', namespace: 'sentiment', size: 128, createdAt: '2024-06-05T00:55:00', expiresAt: '2024-06-05T01:25:00', hits: 25, ttl: 1800 },
  { key: 'fund:005827', namespace: 'fund', size: 768, createdAt: '2024-06-05T00:40:00', expiresAt: '2024-06-05T02:40:00', hits: 15, ttl: 7200 },
  { key: 'news:AAPL:20240605', namespace: 'news', size: 2048, createdAt: '2024-06-05T00:53:00', expiresAt: '2024-06-05T01:53:00', hits: 5, ttl: 3600 },
];

export default function CachedDataExplorer() {
  const [namespaces] = useState<CacheNamespace[]>(MOCK_NAMESPACES);
  const [entries] = useState<CacheEntry[]>(MOCK_ENTRIES);
  const [loading, setLoading] = useState(false);
  const [selectedNs, setSelectedNs] = useState<string>('all');

  async function load() {
    setLoading(true);
    try {
      // const res = await getCacheStats();
      // if (res?.success) { ... }
    } catch (e) { console.error('[Error:CachedDataExplorer]', e); }
    void EngineError; // [DATA] structured error tracking
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Hit rate chart
  useEffect(() => {
    const chartDom = document.getElementById('cache-hitrate-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      grid: { left: 80, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'value', max: 100, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      yAxis: { type: 'category', data: namespaces.map(n => n.name).reverse(), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#9ca3af', fontSize: 10 } },
      series: [{
        type: 'bar',
        data: [...namespaces].reverse().map(n => ({
          value: n.hitRate,
          itemStyle: { color: n.hitRate >= 90 ? '#16a34a' : n.hitRate >= 75 ? '#C9A046' : '#dc2626' },
        })),
        barWidth: '60%',
        label: { show: true, position: 'right', color: '#e5e7eb', fontSize: 10, formatter: (p: Record<string, unknown>) => `${p.value}%` },
      }],
    });

    return () => chart.dispose();
  }, [namespaces]);

  const filteredEntries = selectedNs === 'all' ? entries : entries.filter(e => e.namespace === selectedNs);
  const totalMemory = namespaces.reduce((s, n) => s + n.memoryUsage, 0);
  const totalEntries = namespaces.reduce((s, n) => s + n.entries, 0);
  const avgHitRate = namespaces.reduce((s, n) => s + n.hitRate, 0) / namespaces.length;

  if (loading) return <LoadingSpinner fullscreen text={i18n.t('CachedDataExplorer.k1')} />;

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">💾 缓存数据浏览器</h1>
          <p className="text-gray-400 text-sm">JVS-32 智能缓存层管理</p>
        </div>
        <button
          onClick={load}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
        >
          刷新数据
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">总条目数</div>
          <div className="text-xl font-bold font-mono text-white">{totalEntries.toLocaleString()}</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">平均命中率</div>
          <div className="text-xl font-bold font-mono text-[#D4A853]">{avgHitRate.toFixed(1)}%</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">内存占用</div>
          <div className="text-xl font-bold font-mono text-white">{totalMemory.toFixed(1)} MB</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Namespace</div>
          <div className="text-xl font-bold font-mono text-white">{namespaces.length}</div>
        </div>
      </div>

      {/* Namespace Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {namespaces.map((ns) => (
          <div
            key={ns.name}
            onClick={() => setSelectedNs(ns.name)}
            className={`bg-[#1a1a25] border rounded-xl p-4 cursor-pointer transition-colors ${
              selectedNs === ns.name ? 'border-[#C9A046]' : 'border-white/5 hover:border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white font-medium capitalize">{ns.name}</span>
              <span className={`text-xs font-bold ${ns.hitRate >= 90 ? 'text-emerald-400' : ns.hitRate >= 75 ? 'text-[#D4A853]' : 'text-red-400'}`}>
                {ns.hitRate.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-gray-500 mb-1">{ns.entries}/{ns.maxEntries} 条目</div>
            <div className="w-full bg-white/5 rounded-full h-1.5">
              <div className="bg-[#C9A046] h-1.5 rounded-full" style={{ width: `${(ns.entries / ns.maxEntries) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-500">
              <span>{ns.memoryUsage}MB</span>
              <span>{ns.evictions} evict</span>
            </div>
          </div>
        ))}
      </div>

      {/* Hit Rate Chart */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Namespace 命中率</h2>
        <div id="cache-hitrate-chart" className="w-full h-[240px]" />
      </div>

      {/* Entries Table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">缓存条目</h2>
          <select
            value={selectedNs}
            onChange={(e) => setSelectedNs(e.target.value)}
            className="bg-deep border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-[#C9A046]"
          >
            <option value="all">全部 Namespace</option>
            {namespaces.map((ns) => (
              <option key={ns.name} value={ns.name}>{ns.name}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">Key</th>
                <th className="px-4 py-3 text-left">Namespace</th>
                <th className="px-4 py-3 text-right">大小</th>
                <th className="px-4 py-3 text-right">命中次数</th>
                <th className="px-4 py-3 text-right">TTL</th>
                <th className="px-4 py-3 text-right">创建时间</th>
                <th className="px-4 py-3 text-right">过期时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredEntries.map((e) => (
                <tr key={e.key} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-xs text-white font-mono">{e.key}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 capitalize">{e.namespace}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-300">{e.size}B</td>
                  <td className="px-4 py-3 text-right text-xs text-[#D4A853]">{e.hits}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-300">{e.ttl}s</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{e.createdAt.split('T')[1]}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{e.expiresAt.split('T')[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredEntries.length === 0 && (
          <div className="text-gray-500 text-sm text-center py-8">无缓存条目</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-4 py-2 rounded-lg border border-white/5 transition-colors">
          清空过期条目
        </button>
        <button className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-4 py-2 rounded-lg border border-white/5 transition-colors">
          重置统计
        </button>
        <button className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg border border-red-500/20 transition-colors">
          清空全部缓存
        </button>
      </div>
    </div>
  );
}
