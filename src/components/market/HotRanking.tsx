// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
type RankCategory = 'stocks' | 'factors' | 'strategies' | 'creators';
interface RankItem {
  id: string; rank: number; name: string; subtitle: string;
  score: number; change: 'up' | 'down' | 'same'; changeValue: string;
  icon: string; tags: string[];
}

/* ====== Mock Data ====== */
const rankData: Record<RankCategory, RankItem[]> = {
  stocks: [
    { id: 's1', rank: 1, name: 'NVDA', subtitle: 'NVIDIA · US', score: 98, change: 'up', changeValue: '+3', icon: '📈', tags: ['AI', '财报'] },
    { id: 's2', rank: 2, name: 'BTC', subtitle: 'Bitcoin · CRYPTO', score: 95, change: 'up', changeValue: '+5', icon: '🪙', tags: ['ETF', '新高'] },
    { id: 's3', rank: 3, name: '00700', subtitle: '腾讯控股 · HK', score: 88, change: 'up', changeValue: '+2', icon: '🇭🇰', tags: ['南向', 'AI'] },
    { id: 's4', rank: 4, name: 'TSLA', subtitle: 'Tesla · US', score: 82, change: 'down', changeValue: '-4', icon: '🚗', tags: ['交付', '竞争'] },
    { id: 's5', rank: 5, name: 'GLD', subtitle: '黄金ETF · US', score: 79, change: 'up', changeValue: '+1', icon: '🥇', tags: ['避险', '央行'] },
    { id: 's6', rank: 6, name: 'META', subtitle: 'Meta · US', score: 75, change: 'up', changeValue: '+2', icon: '📱', tags: ['广告', 'AI'] },
    { id: 's7', rank: 7, name: 'AAPL', subtitle: 'Apple · US', score: 71, change: 'same', changeValue: '0', icon: '🍎', tags: ['服务', '升级'] },
    { id: 's8', rank: 8, name: 'XBI', subtitle: '生物科技ETF · US', score: 65, change: 'down', changeValue: '-8', icon: '🧬', tags: ['FDA', '暴跌'] }
  ],
  factors: [
    { id: 'f1', rank: 1, name: '北向资金', subtitle: '资金流 · CN', score: 0.12, change: 'up', changeValue: '+0.02', icon: '🔴', tags: ['A股', '聪明钱'] },
    { id: 'f2', rank: 2, name: '机构资金', subtitle: '资金流 · US', score: 0.11, change: 'same', changeValue: '0', icon: '🏦', tags: ['美股', '13F'] },
    { id: 'f3', rank: 3, name: '稳定币铸币', subtitle: '加密货币 · CRYPTO', score: 0.11, change: 'up', changeValue: '+0.03', icon: '🪙', tags: ['牛市', '资金'] },
    { id: 'f4', rank: 4, name: '行业动量', subtitle: '动量 · US', score: 0.10, change: 'up', changeValue: '+0.01', icon: '📊', tags: ['季度', '轮动'] },
    { id: 'f5', rank: 5, name: '新闻情绪', subtitle: '情绪 · ALL', score: 0.09, change: 'down', changeValue: '-0.01', icon: '📰', tags: ['NLP', '实时'] }
  ],
  strategies: [
    { id: 't1', rank: 1, name: '高息股躺平组合', subtitle: 'DividendHunter · 2,103笔', score: 4.7, change: 'same', changeValue: '0', icon: '💸', tags: ['价值', '防御'] },
    { id: 't2', rank: 2, name: 'MACD金叉策略', subtitle: 'QuantWhale · 1,847笔', score: 4.5, change: 'up', changeValue: '+0.1', icon: '📈', tags: ['趋势', '简单'] },
    { id: 't3', rank: 3, name: '北向资金跟随', subtitle: '港股猎人 · 1,243笔', score: 4.8, change: 'up', changeValue: '+0.2', icon: '🇨🇳', tags: ['A股', '跟随'] },
    { id: 't4', rank: 4, name: 'BTC链上监控', subtitle: 'CryptoKing · 982笔', score: 4.6, change: 'down', changeValue: '-0.1', icon: '🪙', tags: ['加密', '链上'] },
    { id: 't5', rank: 5, name: 'VIX恐慌抄底', subtitle: 'ContrarianJoe · 891笔', score: 4.5, change: 'up', changeValue: '+0.3', icon: '🎭', tags: ['逆向', '恐慌'] }
  ],
  creators: [
    { id: 'c1', rank: 1, name: 'DividendHunter', subtitle: 'L1 · 2,103笔 · HK5,280', score: 4.7, change: 'same', changeValue: '0', icon: '💸', tags: ['股息', '价值'] },
    { id: 'c2', rank: 2, name: 'QuantWhale', subtitle: 'L3 · 1,847笔 · US18,470', score: 4.5, change: 'up', changeValue: '+0.1', icon: '🐋', tags: ['趋势', 'MACD'] },
    { id: 'c3', rank: 3, name: '港股猎人', subtitle: 'L2 · 1,243笔 · HK24,860', score: 4.8, change: 'up', changeValue: '+0.2', icon: '🏹', tags: ['A股', '北向'] },
    { id: 'c4', rank: 4, name: 'CryptoKing', subtitle: 'L3 · 982笔 · US29,460', score: 4.6, change: 'down', changeValue: '-0.1', icon: '👑', tags: ['加密', '链上'] },
    { id: 'c5', rank: 5, name: 'ThetaGang', subtitle: 'L3 · 431笔 · US15,085', score: 4.9, change: 'same', changeValue: '0', icon: '🦅', tags: ['期权', '收租'] }
  ]
};

/* ====== Main Component ====== */

export default function HotRanking() {
  const [category, setCategory] = useState<RankCategory>('stocks');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');

  const items = rankData[category];
  const cats: { key: RankCategory; label: string; icon: string }[] = [
    { key: 'stocks', label: '热门股票', icon: '📈' },
    { key: 'factors', label: '最强因子', icon: '🧬' },
    { key: 'strategies', label: '畅销策略', icon: '📋' },
    { key: 'creators', label: '创作者榜', icon: '👑' }
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white">
        <h2 className="text-lg font-bold">🔥 热度排行</h2>
        <p className="text-xs text-white/80">实时热榜 · 发现大家都在关注什么</p>
      </div>

      {/* Timeframe */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {(['24h', '7d', '30d'] as const).map(t => (
          <button key={t} onClick={() => setTimeframe(t)} className={`px-3 py-1 rounded-full text-xs font-medium ${timeframe === t ? 'bg-pink-100 text-pink-700' : 'text-gray-500 hover:bg-gray-100'}`}>{t === '24h' ? '24小时' : t === '7d' ? '7天' : '30天'}</button>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {cats.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${category === c.key ? 'bg-pink-100 text-pink-700 ring-1 ring-pink-400' : 'text-gray-500 hover:bg-gray-100'}`}>{c.icon} {c.label}</button>
        ))}
      </div>

      {/* Ranking List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {items.map(item => {
          const changeColor = item.change === 'up' ? 'text-green-600' : item.change === 'down' ? 'text-red-500' : 'text-gray-400';
          const rankColor = item.rank <= 3 ? (item.rank === 1 ? 'text-amber-600 bg-amber-50' : item.rank === 2 ? 'text-gray-500 bg-gray-50' : 'text-amber-700 bg-amber-50') : 'text-gray-400 bg-gray-50';
          return (
            <div key={item.id} className="flex items-center gap-3 py-2.5 px-2 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors cursor-pointer">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${rankColor}`}>{item.rank <= 3 ? ['🥇', '🥈', '🥉'][item.rank - 1] : item.rank}</span>
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.name}</span>
                  <span className={`text-xs font-bold ${changeColor}`}>{item.change === 'up' ? '▲' : item.change === 'down' ? '▼' : '—'} {item.changeValue}</span>
                </div>
                <p className="text-xs text-gray-400">{item.subtitle}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-pink-600">{typeof item.score === 'number' && item.score < 1 ? `+${item.score.toFixed(2)}` : item.score}</p>
                <div className="flex gap-1 mt-0.5">{item.tags.slice(0, 2).map(t => <span key={t} className="px-1 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">{t}</span>)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>🔥 每15分钟更新 · 综合热度排行</span>
        <span>免费</span>
      </div>
    </div>
  );
}
