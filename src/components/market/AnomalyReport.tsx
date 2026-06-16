// @ts-nocheck
import React, { useState } from 'react';

/* ====== Types ====== */
interface MarketMove {
  id: string; symbol: string; name: string; market: string;
  change: number; changePct: number; direction: 'up' | 'down';
  reason: string; confidence: number;
  moveType: 'earnings' | 'news' | 'sector' | 'macro' | 'technical' | 'social' | 'insider' | 'chain';
  severity: 'extreme' | 'major' | 'notable' | 'minor';
  volume: string; volumeRatio: number; time: string;
}

/* ====== Mock Data ====== */
const mockMoves: MarketMove[] = [
  { id: 'm1', symbol: 'NVDA', name: 'NVIDIA', market: 'US', change: 12.4, changePct: 8.3, direction: 'up', reason: 'Q2财报超预期10%，Q3指引上调至$45B。AI数据中心需求推动H200芯片出货翻倍。', confidence: 0.95, moveType: 'earnings', severity: 'major', volume: '58.2M', volumeRatio: 3.2, time: '盘后 16:30' },
  { id: 'm2', symbol: 'BTC', name: 'Bitcoin', market: 'CRYPTO', change: 4250, changePct: 3.5, direction: 'up', reason: '现货ETF连续多日净流入$2.8B。期权最大痛点$115K被突破。Gamma挤压推高。', confidence: 0.88, moveType: 'chain', severity: 'major', volume: '$85B', volumeRatio: 2.1, time: '08:15' },
  { id: 'm3', symbol: '00700', name: '腾讯控股', market: 'HK', change: 9.8, changePct: 2.1, direction: 'up', reason: '南向资金连续5日净流入超100亿港元。本周累计净买入500亿+。', confidence: 0.82, moveType: 'news', severity: 'notable', volume: '32.5M', volumeRatio: 1.5, time: '14:30' },
  { id: 'm4', symbol: 'XBI', name: '生物科技ETF', market: 'US', change: -3.2, changePct: -5.8, direction: 'down', reason: 'FDA拒绝某重磅新药申请，生物科技板块集体下跌。XBI回吐本周涨幅。', confidence: 0.78, moveType: 'sector', severity: 'major', volume: '45.1M', volumeRatio: 4.5, time: '11:00' },
  { id: 'm5', symbol: 'TSLA', name: 'Tesla', market: 'US', change: -8.5, changePct: -3.2, direction: 'down', reason: '分析师下调评级，担忧Q2交付量不及预期。竞争加剧，中国市场份额下降。', confidence: 0.72, moveType: 'news', severity: 'notable', volume: '89.3M', volumeRatio: 2.8, time: '10:00' },
  { id: 'm6', symbol: 'GLD', name: '黄金ETF', market: 'US', change: 3.5, changePct: 1.0, direction: 'up', reason: '央行持续购金+地缘政治紧张。中国央行5月增持50吨。金价突破$3,500。', confidence: 0.85, moveType: 'macro', severity: 'notable', volume: '25.7M', volumeRatio: 1.8, time: '09:45' }
];

/* ====== Sub-Components ====== */

const SeverityBadge = ({ severity, changePct, direction }: { severity: string; changePct: number; direction: string }) => {
  const map: Record<string, string> = {
    extreme: 'bg-red-600 text-white',
    major: direction === 'up' ? 'bg-red-100 text-red-700' : 'bg-red-100 text-red-700',
    notable: direction === 'up' ? 'bg-orange-100 text-orange-700' : 'bg-orange-100 text-orange-700',
    minor: 'bg-gray-100 text-gray-600'
  };
  const icons: Record<string, string> = { extreme: '💥', major: '🔥', notable: '📊', minor: '📌' };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${map[severity]}`}>
      {icons[severity]} {direction === 'up' ? '↑' : '↓'}{Math.abs(changePct).toFixed(1)}% {severity}
    </span>
  );
};

const TypeBadge = ({ type }: { type: string }) => {
  const map: Record<string, string> = {
    earnings: '财报驱动', news: '新闻驱动', sector: '板块联动', macro: '宏观驱动', technical: '技术信号', social: '社交引爆', insider: '内部人', chain: '链上信号'
  };
  return <span className="px-1.5 py-0.5 rounded text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">{map[type] || type}</span>;
};

const MoveCard = ({ m }: { m: MarketMove }) => {
  const [expanded, setExpanded] = useState(false);
  const isUp = m.direction === 'up';
  return (
    <div className={`rounded-lg border ${m.severity === 'extreme' || m.severity === 'major' ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 overflow-hidden hover:shadow-md transition-all`}>
      <div className="p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <SeverityBadge severity={m.severity} changePct={m.changePct} direction={m.direction} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{m.symbol}</span>
              <span className="text-xs text-gray-400">{m.name}</span>
              <span className="px-1 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">{m.market}</span>
              <TypeBadge type={m.moveType} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{m.reason}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-lg font-bold ${isUp ? 'text-green-600' : 'text-red-600'}`}>{isUp ? '+' : ''}{m.changePct}%</p>
            <p className="text-xs text-gray-400">{m.time}</p>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2">
          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
            <div className="p-2 rounded bg-gray-50 dark:bg-gray-700/50 text-center">
              <p className="font-bold text-gray-900">{m.volume}</p>
              <p className="text-gray-400">成交量</p>
            </div>
            <div className="p-2 rounded bg-gray-50 dark:bg-gray-700/50 text-center">
              <p className="font-bold text-blue-600">{m.volumeRatio}x</p>
              <p className="text-gray-400">量比</p>
            </div>
            <div className="p-2 rounded bg-gray-50 dark:bg-gray-700/50 text-center">
              <p className="font-bold text-green-600">{Math.round(m.confidence * 100)}%</p>
              <p className="text-gray-400">置信度</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">🤖 {m.reason}</p>
          <button className="mt-2 w-full py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">查看详情</button>
        </div>
      )}
    </div>
  );
};

/* ====== Main Component ====== */

export default function AnomalyReport() {
  const [filter, setFilter] = useState<'all' | 'up' | 'down'>('all');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const filtered = mockMoves.filter(m => {
    if (filter === 'up' && m.direction !== 'up') return false;
    if (filter === 'down' && m.direction !== 'down') return false;
    if (severityFilter !== 'ALL' && m.severity !== severityFilter) return false;
    return true;
  });

  const upCount = mockMoves.filter(m => m.direction === 'up').length;
  const downCount = mockMoves.filter(m => m.direction === 'down').length;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">⚡ 每日异动报告</h2>
            <p className="text-xs text-white/80">{mockMoves.length}只股票异常波动 · {upCount}涨{downCount}跌</p>
          </div>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">0.5U/天</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {(['all', 'up', 'down'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-xs font-medium ${filter === f ? 'bg-red-100 text-red-700' : 'text-gray-500 hover:bg-gray-100'}`}>{f === 'all' ? '全部' : f === 'up' ? '📈 上涨' : '📉 下跌'}</button>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        {(['ALL', 'extreme', 'major', 'notable'] as const).map(s => (
          <button key={s} onClick={() => setSeverityFilter(s)} className={`px-2 py-1 rounded text-xs ${severityFilter === s ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-100'}`}>{s === 'ALL' ? '全部' : s}</button>
        ))}
      </div>

      {/* Moves */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.map(m => <MoveCard key={m.id} m={m} />)}
        {filtered.length === 0 && <div className="text-center py-16 text-gray-400"><p className="text-4xl mb-3">📊</p><p className="text-sm">今日无异常波动</p></div>}
      </div>

      {/* Stats */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t text-xs text-gray-500 flex items-center justify-between">
        <span>⚡ 实时检测·每15分钟更新</span>
        <span className="text-amber-600 font-bold">0.5U/天按次</span>
      </div>
    </div>
  );
}
