// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
interface WatchlistSmartNewsItem {
  id: string; symbol: string; symbolName: string;
  title: string; source: string; time: string;
  sentiment: number; relevance: number; // 0-100
  aiSummary: string; // AI 50字摘要
  impact: 'high' | 'medium' | 'low';
  tags: string[];
}

interface WatchlistGroup { symbol: string; symbolName: string; price: number; changePct: number; news: WatchlistSmartNewsItem[]; }

/* ====== Mock Data ====== */
const mockWatchlistNews: WatchlistGroup[] = [
  {
    symbol: 'NVDA', symbolName: 'NVIDIA', price: 148.50, changePct: 8.2,
    news: [
      { id: 'wn1', symbol: 'NVDA', symbolName: 'NVIDIA', title: 'NVDA Q2 revenue $42B beats estimates by 10%', source: 'Bloomberg', time: '2h ago', sentiment: 85, relevance: 98, aiSummary: 'NVDA季度营收创纪录$42B，超预期10%。AI数据中心需求推动H200芯片出货量翻倍，Q3指引上调至$45B。', impact: 'high', tags: ['财报', '超预期', 'AI'] },
      { id: 'wn2', symbol: 'NVDA', symbolName: 'NVIDIA', title: 'NVIDIA announces new Blackwell Ultra chip for 2027', source: 'Reuters', time: '5h ago', sentiment: 70, relevance: 90, aiSummary: 'NVDA发布下一代Blackwell Ultra芯片路线图，预计2027年量产。分析师认为将巩固AI芯片霸主地位。', impact: 'high', tags: ['新品', '芯片'] },
      { id: 'wn3', symbol: 'NVDA', symbolName: 'NVIDIA', title: 'AI chip demand forecast to grow 35% in 2026', source: 'WSJ', time: '8h ago', sentiment: 60, relevance: 75, aiSummary: '行业报告预测2026年AI芯片市场增长35%，NVDA市占率有望维持80%以上。', impact: 'medium', tags: ['行业趋势', 'AI'] }
    ]
  },
  {
    symbol: '00700', symbolName: '腾讯控股', price: 475.00, changePct: 2.1,
    news: [
      { id: 'wn4', symbol: '00700', symbolName: '腾讯控股', title: '南向资金连续5日净流入，腾讯获净买入45亿港元', source: '信报', time: '4h ago', sentiment: 75, relevance: 95, aiSummary: '南向资金本周净买入超500亿港元，腾讯为最大受益者。机构认为估值吸引，分红率提升是催化剂。', impact: 'high', tags: ['南向资金', '估值'] },
      { id: 'wn5', symbol: '00700', symbolName: '腾讯控股', title: 'Tencent Cloud signs $2B AI deal in Southeast Asia', source: 'Nikkei Asia', time: '7h ago', sentiment: 55, relevance: 80, aiSummary: '腾讯云在东南亚获$2B政府AI合同，海外业务收入占比有望从5%提升至12%。', impact: 'medium', tags: ['海外扩张', 'AI云'] }
    ]
  },
  {
    symbol: 'BTC', symbolName: 'Bitcoin', price: 122500, changePct: 3.5,
    news: [
      { id: 'wn6', symbol: 'BTC', symbolName: 'Bitcoin', title: 'Bitcoin breaks $120K — ETF inflows hit $2.8B this week', source: 'CoinDesk', time: '1h ago', sentiment: 88, relevance: 98, aiSummary: 'BTC突破$120K创年内新高。现货ETF本周净流入$28亿，期权最大痛点$115K已被突破，伽马挤压推高价格。', impact: 'high', tags: ['BTC', 'ETF', '新高'] },
      { id: 'wn7', symbol: 'BTC', symbolName: 'Bitcoin', title: 'BlackRock CIO says Bitcoin is digital gold for next generation', source: 'Bloomberg', time: '6h ago', sentiment: 72, relevance: 85, aiSummary: '贝莱德CIO公开表态BTC是新一代数字黄金，机构配置比例将从1%提升至5%。', impact: 'medium', tags: ['机构', '配置'] }
    ]
  }
];

/* ====== Sub Components ====== */

const NewsCard = ({ item }: { item: WatchlistSmartNewsItem }) => {
  const sentimentColor = item.sentiment > 60 ? 'bg-green-400' : item.sentiment > 30 ? 'bg-yellow-400' : 'bg-red-400';
  const impactColor = item.impact === 'high' ? 'bg-red-100 text-red-600' : item.impact === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600';
  return (
    <div className="p-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
      <div className="flex items-start gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${sentimentColor}`}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs px-1 py-0.5 rounded font-bold ${impactColor}`}>{item.impact}</span>
            <span className="text-xs text-gray-400">{item.source} · {item.time}</span>
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-xs font-bold ${item.sentiment > 60 ? 'text-green-600' : 'text-gray-500'}`}>+{item.sentiment}</span>
          <span className="text-xs text-gray-400">{item.relevance}%匹配</span>
        </div>
      </div>
      {/* AI Summary */}
      <div className="mt-2 ml-4 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs">🤖</span>
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">AI 摘要</span>
        </div>
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{item.aiSummary}</p>
      </div>
      <div className="flex gap-1 ml-4 mt-1.5">
        {item.tags.map(t => <span key={t} className="px-1 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">{t}</span>)}
      </div>
    </div>
  );
};

const StockGroup = ({ group }: { group: WatchlistGroup }) => {
  const [expanded, setExpanded] = useState(true);
  const overallSentiment = Math.round(group.news.reduce((s, n) => s + n.sentiment, 0) / group.news.length);
  const sentimentLabel = overallSentiment > 60 ? '🟢 偏多' : overallSentiment > 30 ? '🟡 中性' : '🔴 偏空';
  
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden mb-3">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-700 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${group.changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {group.symbol}
          </span>
          <span className="text-xs text-gray-500">{group.symbolName}</span>
          <span className={`text-xs font-bold ${group.changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {group.changePct >= 0 ? '+' : ''}{group.changePct}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{sentimentLabel}</span>
          <span className="text-xs text-gray-400">{group.news.length}条 • {overallSentiment}分</span>
          <span className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </div>
      {/* News Cards */}
      {expanded && (
        <div>
          {group.news.map(item => <NewsCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
};

/* ====== Main Component ====== */

export default function WatchlistSmartNews() {
  const [searchFilter, setSearchFilter] = useState('');
  const [impactFilter, setImpactFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const filtered = useMemo(() => {
    let groups = [...mockWatchlistNews];
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      groups = groups.map(g => ({
        ...g,
        news: g.news.filter(n => 
          n.title.toLowerCase().includes(q) || 
          n.aiSummary.toLowerCase().includes(q) ||
          n.symbol.toLowerCase().includes(q)
        )
      })).filter(g => g.news.length > 0);
    }
    if (impactFilter !== 'all') {
      groups = groups.map(g => ({
        ...g,
        news: g.news.filter(n => n.impact === impactFilter)
      })).filter(g => g.news.length > 0);
    }
    return groups;
  }, [searchFilter, impactFilter]);

  const totalNews = mockWatchlistNews.reduce((s, g) => s + g.news.length, 0);
  const highImpact = mockWatchlistNews.reduce((s, g) => s + g.news.filter(n => n.impact === 'high').length, 0);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">📰 自选股新闻</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalNews} 条新闻 · {highImpact} 条高影响 · {mockWatchlistNews.length} 个自选股
            </p>
          </div>
          <button className="px-3 py-1.5 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 font-medium">
            🔄 刷新
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <input value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="搜索新闻关键词..." className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {(['all', 'high', 'medium', 'low'] as const).map(level => (
          <button key={level} onClick={() => setImpactFilter(level)} className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${impactFilter === level ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {level === 'all' ? '全部' : level === 'high' ? '高影响' : level === 'medium' ? '中影响' : '低影响'}
          </button>
        ))}
      </div>

      {/* News Groups */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm font-medium">没有匹配的新闻</p>
            <p className="text-xs mt-1">试试添加自选股或调整筛选条件</p>
          </div>
        ) : (
          filtered.map(group => <StockGroup key={group.symbol} group={group} />)
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>💡</span>
            <span>AI为您从{totalNews}条新闻中智能筛选持仓相关</span>
          </div>
          <span className="text-blue-600 font-semibold">免费</span>
        </div>
      </div>
    </div>
  );
}
