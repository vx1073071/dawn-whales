// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
interface EarningsEvent {
  id: string; symbol: string; name: string; market: string;
  date: string; time: 'pre' | 'post' | 'TBD';
  epsEstimate: number; epsActual: number | null;
  revenueEst: string; revenueActual: string | null;
  surprise: number | null; // %
  importance: '⭐⭐⭐' | '⭐⭐' | '⭐';
  isPast: boolean;
}

/* ====== Mock Data ====== */
const mockEarnings: EarningsEvent[] = [
  { id: 'e1', symbol: 'NVDA', name: 'NVIDIA', market: 'US', date: '2026-06-17', time: 'post', epsEstimate: 0.85, epsActual: 0.93, revenueEst: '$42B', revenueActual: '$43.2B', surprise: 9.4, importance: '⭐⭐⭐', isPast: true },
  { id: 'e2', symbol: 'TSLA', name: 'Tesla', market: 'US', date: '2026-06-19', time: 'post', epsEstimate: 0.72, epsActual: null, revenueEst: '$28B', revenueActual: null, surprise: null, importance: '⭐⭐⭐', isPast: false },
  { id: 'e3', symbol: 'AAPL', name: 'Apple', market: 'US', date: '2026-06-25', time: 'post', epsEstimate: 1.52, epsActual: null, revenueEst: '$92B', revenueActual: null, surprise: null, importance: '⭐⭐⭐', isPast: false },
  { id: 'e4', symbol: '00700', name: '腾讯控股', market: 'HK', date: '2026-06-20', time: 'post', epsEstimate: 5.8, epsActual: null, revenueEst: '¥185B', revenueActual: null, surprise: null, importance: '⭐⭐', isPast: false },
  { id: 'e5', symbol: 'MSFT', name: 'Microsoft', market: 'US', date: '2026-06-18', time: 'post', epsEstimate: 3.12, epsActual: null, revenueEst: '$68B', revenueActual: null, surprise: null, importance: '⭐⭐⭐', isPast: false },
  { id: 'e6', symbol: 'AMZN', name: 'Amazon', market: 'US', date: '2026-06-16', time: 'post', epsEstimate: 1.45, epsActual: 1.52, revenueEst: '$158B', revenueActual: '$160B', surprise: 4.8, importance: '⭐⭐⭐', isPast: true },
  { id: 'e7', symbol: 'GOOGL', name: 'Alphabet', market: 'US', date: '2026-06-24', time: 'post', epsEstimate: 2.05, epsActual: null, revenueEst: '$92B', revenueActual: null, surprise: null, importance: '⭐⭐', isPast: false },
  { id: 'e8', symbol: 'META', name: 'Meta', market: 'US', date: '2026-06-15', time: 'post', epsEstimate: 5.52, epsActual: 5.78, revenueEst: '$42B', revenueActual: '$43B', surprise: 4.7, importance: '⭐⭐⭐', isPast: true }
];

/* ====== Components ====== */
const EarningsRow = ({ e }: { e: EarningsEvent }) => {
  const surpriseColor = e.surprise !== null ? (e.surprise > 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50') : '';
  const dateStr = new Date(e.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  return (
    <div className={`flex items-center gap-2 py-2.5 px-3 border-b border-gray-100 dark:border-gray-700 ${e.isPast ? 'opacity-70' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
      <div className="w-14 text-center flex-shrink-0">
        <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{dateStr}</p>
        <p className={`text-xs ${e.time === 'pre' ? 'text-blue-500' : e.time === 'post' ? 'text-purple-500' : 'text-gray-400'}`}>{e.time === 'pre' ? '盘前' : e.time === 'post' ? '盘后' : 'TBD'}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{e.symbol}</span>
          <span className="text-xs text-gray-400">{e.name}</span>
          <span className="px-1 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">{e.market}</span>
          <span className="text-xs">{e.importance}</span>
        </div>
        <div className="flex items-center gap-3 text-xs mt-0.5">
          <span className="text-gray-500">EPS预期 ${e.epsEstimate}</span>
          {e.epsActual !== null && <span className="font-bold text-gray-700">实际 ${e.epsActual}</span>}
          <span className="text-gray-400">营收 {e.revenueEst}</span>
          {e.surprise !== null && (
            <span className={`px-1 py-0.5 rounded text-xs font-bold ${surpriseColor}`}>
              {e.surprise > 0 ? '↑' : '↓'} {Math.abs(e.surprise)}%
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        {e.isPast ? (
          <span className="text-xs text-gray-400">已发布</span>
        ) : (
          <button className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium">提醒我</button>
        )}
      </div>
    </div>
  );
};

/* ====== Main Component ====== */

export default function EarningsCalendar() {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [importanceFilter, setImportanceFilter] = useState('ALL');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...mockEarnings];
    if (filter === 'upcoming') list = list.filter(e => !e.isPast);
    if (filter === 'past') list = list.filter(e => e.isPast);
    if (marketFilter !== 'ALL') list = list.filter(e => e.market === marketFilter);
    if (importanceFilter !== 'ALL') list = list.filter(e => e.importance === importanceFilter);
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return list;
  }, [filter, marketFilter, importanceFilter]);

  const upcoming = mockEarnings.filter(e => !e.isPast).length;
  const todayEvents = mockEarnings.filter(e => e.date === '2026-06-17' || e.date === '2026-06-16').length;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">📅 财报日历</h2>
            <p className="text-xs text-white/80">{upcoming}个即将发布 · {todayEvents}个今明两天</p>
          </div>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">1.5U/次提醒</span>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {[
          { label: '全部', value: 'all' },
          { label: '📅 即将发布', value: 'upcoming' },
          { label: '✅ 已发布', value: 'past' }
        ].map(t => (
          <button key={t.value} onClick={() => setFilter(t.value as typeof filter)} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${filter === t.value ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>{t.label}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-white dark:bg-gray-800 border-b text-xs text-gray-500">
        <span>市场:</span>
        {(['ALL', 'US', 'HK', 'CN'] as const).map(m => (
          <button key={m} onClick={() => setMarketFilter(m)} className={`px-1.5 py-0.5 rounded ${marketFilter === m ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>{m}</button>
        ))}
        <span className="ml-2">重要度:</span>
        {(['ALL', '⭐⭐⭐'] as const).map(i => (
          <button key={i} onClick={() => setImportanceFilter(i)} className={`px-1.5 py-0.5 rounded ${importanceFilter === i ? 'bg-amber-100 text-amber-700' : 'hover:bg-gray-100'}`}>{i === 'ALL' ? '全部' : i}</button>
        ))}
      </div>

      {/* Today Highlight */}
      {filter === 'all' && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800">
          <p className="text-xs font-bold text-amber-700">⚡ 今天关注</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-amber-800">
            <span>NVDA盘后发布财报(EPS预期$0.85)</span>
            <span className="px-1 py-0.5 rounded bg-red-100 text-red-600 font-bold">⭐⭐⭐</span>
          </div>
        </div>
      )}

      {/* Event List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(e => <EarningsRow key={e.id} e={e} />)}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400"><p className="text-4xl mb-3">📅</p><p className="text-sm">无匹配财报事件</p></div>
        )}
      </div>

      {/* Insights */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">📊 财报季洞察</h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { label: '已发布', value: '3/8', sub: '37.5%' },
            { label: '超预期', value: '3/3', sub: '100%' },
            { label: '平均惊喜', value: '+6.3%', sub: '偏多信号' }
          ].map(s => (
            <div key={s.label} className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <p className="font-bold text-gray-900">{s.value}</p>
              <p className="text-gray-400">{s.label}</p>
              <p className="text-green-600">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>📅 数据来自SEC EDGAR + 港交所 · 实时更新</span>
        <span className="text-amber-600 font-bold">提醒 1.5U/次</span>
      </div>
    </div>
  );
}
