// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
interface MarketStrategy {
  id: string; name: string; oneLiner: string; author: { name: string; avatar: string; level: 'L1' | 'L2' | 'L3'; };
  price: number; annualReturn: number; maxDrawdown: number; winRate: number;
  sales: number; rating: number; reviewCount: number;
  category: string; tags: string[]; market: string[];
  isVerified: boolean; isFeatured: boolean; isNew: boolean;
}

interface Review { id: string; user: string; avatar: string; rating: number; text: string; time: string; helpful: number; }

/* ====== Mock Data ====== */
const mockMarketStrategies: MarketStrategy[] = [
  { id: 'ms1', name: 'MACD金叉死叉策略', oneLiner: '你跟着MACD金叉买，死叉卖，简单有效', author: { name: 'QuantWhale', avatar: '🐋', level: 'L3' }, price: 9.9, annualReturn: 22, maxDrawdown: 18, winRate: 58, sales: 1847, rating: 4.5, reviewCount: 328, category: '趋势跟踪', tags: ['MACD', '简单', '高频'], market: ['US', 'HK'], isVerified: true, isFeatured: true, isNew: false },
  { id: 'ms2', name: '北向资金跟随策略', oneLiner: '你跟着北向资金连续买入，聪明钱不骗人', author: { name: '港股猎人', avatar: '🏹', level: 'L2' }, price: 19.9, annualReturn: 28, maxDrawdown: 15, winRate: 65, sales: 1243, rating: 4.8, reviewCount: 215, category: '资金流', tags: ['北向', 'A股', '跟随'], market: ['CN'], isVerified: true, isFeatured: true, isNew: false },
  { id: 'ms3', name: 'BTC链上监控策略', oneLiner: '你看交易所BTC流出就是囤币信号，流入就是准备卖', author: { name: 'CryptoKing', avatar: '👑', level: 'L3' }, price: 29.9, annualReturn: 45, maxDrawdown: 25, winRate: 62, sales: 982, rating: 4.6, reviewCount: 156, category: '加密货币', tags: ['BTC', '链上', '巨鲸'], market: ['CRYPTO'], isVerified: true, isFeatured: false, isNew: false },
  { id: 'ms4', name: '财报季做多策略', oneLiner: '你财报发布前一天买Call，赌波动放大', author: { name: 'OptionsMaster', avatar: '📊', level: 'L2' }, price: 14.9, annualReturn: 18, maxDrawdown: 12, winRate: 72, sales: 756, rating: 4.3, reviewCount: 98, category: '事件驱动', tags: ['财报', '期权', '季节性'], market: ['US'], isVerified: true, isFeatured: false, isNew: false },
  { id: 'ms5', name: '高息股躺平收息组合', oneLiner: '你买分红率>4%的国企股票，躺着每年收5-8%', author: { name: 'DividendHunter', avatar: '💸', level: 'L1' }, price: 9.9, annualReturn: 10, maxDrawdown: 8, winRate: 78, sales: 2103, rating: 4.7, reviewCount: 452, category: '价值投资', tags: ['股息', '国企', '防御'], market: ['HK', 'CN'], isVerified: true, isFeatured: true, isNew: false },
  { id: 'ms6', name: '美股期权Iron Condor', oneLiner: '你每周卖宽跨式期权，赚震荡市场的钱，80%胜率', author: { name: 'ThetaGang', avatar: '🦅', level: 'L3' }, price: 34.9, annualReturn: 12, maxDrawdown: 5, winRate: 78, sales: 431, rating: 4.9, reviewCount: 87, category: '期权', tags: ['期权', '收租', '每周'], market: ['US'], isVerified: true, isFeatured: false, isNew: true },
  { id: 'ms7', name: 'AH股溢价套利', oneLiner: '你同时买AH两地上市便宜的，卖贵的，吃价差回归', author: { name: 'ArbitragePro', avatar: '💰', level: 'L2' }, price: 24.9, annualReturn: 15, maxDrawdown: 10, winRate: 68, sales: 612, rating: 4.4, reviewCount: 134, category: '套利', tags: ['AH', '价差', '低风险'], market: ['HK', 'CN'], isVerified: false, isFeatured: false, isNew: false },
  { id: 'ms8', name: 'AI智能调仓机器人', oneLiner: '你让AI每月自动分析持仓，智能调整权重，省心', author: { name: 'AIQuant', avatar: '🤖', level: 'L2' }, price: 49.9, annualReturn: 20, maxDrawdown: 14, winRate: 60, sales: 325, rating: 4.2, reviewCount: 45, category: 'AI智能', tags: ['AI', '自动', '省心'], market: ['US', 'HK', 'CN'], isVerified: true, isFeatured: false, isNew: true }
];

const mockReviews: Review[] = [
  { id: 'rv1', user: '散户老王', avatar: '👴', rating: 5, text: '用了三个月，收益比我之前瞎买好太多了。MACD金叉策略很简单，适合新手。', time: '3天前', helpful: 42 },
  { id: 'rv2', user: 'TraderMike', avatar: '🧔', rating: 4, text: '北向策略确实有用，但要注意MSCI调仓日的数据失真。整体靠谱。', time: '1周前', helpful: 28 },
  { id: 'rv3', user: 'CryptoMaxi', avatar: '🚀', rating: 5, text: '链上策略 + BTC ETF 双管齐下，今年收益翻倍了。Just buy and hold no longer works. 有策略才有优势。', time: '2周前', helpful: 35 }
];

/* ====== Sub Components ====== */

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1,2,3,4,5].map(i => (
      <span key={i} className={`text-xs ${i <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
    ))}
  </div>
);

const LevelBadge = ({ level }: { level: string }) => {
  const map: Record<string, string> = {
    L1: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    L2: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    L3: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
  };
  const labelMap: Record<string, string> = { L1: '新手', L2: '进阶', L3: '旗舰' };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${map[level] || ''}`}>
      {labelMap[level] || level}
    </span>
  );
};

const StrategyCard = ({ s }: { s: MarketStrategy }) => (
  <div className={`rounded-xl border ${s.isFeatured ? 'border-amber-400 ring-1 ring-amber-200 dark:ring-amber-800' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 p-4 hover:shadow-lg transition-all cursor-pointer group`}>
    {/* Header */}
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">{s.author.avatar}</span>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{s.author.name}</span>
            <LevelBadge level={s.author.level} />
          </div>
          {s.isVerified && <span className="text-xs text-blue-500">✓ 已验证</span>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">${s.price}</p>
        <p className="text-xs text-gray-400">{s.sales}笔成交</p>
      </div>
    </div>

    {/* One-liner */}
    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{s.oneLiner}</p>
    <p className="text-xs text-gray-500 mb-2">{s.name}</p>

    {/* Stats */}
    <div className="grid grid-cols-3 gap-1 mb-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      <div className="text-center">
        <p className="text-xs font-bold text-green-600 dark:text-green-400">+{s.annualReturn}%</p>
        <p className="text-xs text-gray-400">年化</p>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-red-500">-{s.maxDrawdown}%</p>
        <p className="text-xs text-gray-400">最大回撤</p>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{s.winRate}%</p>
        <p className="text-xs text-gray-400">胜率</p>
      </div>
    </div>

    {/* Rating + Category */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <StarRating rating={s.rating} />
        <span className="text-xs text-gray-400">({s.reviewCount})</span>
      </div>
      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">{s.category}</span>
    </div>

    {/* Tags */}
    <div className="flex gap-1 mt-2">
      {s.market.map(m => <span key={m} className="px-1 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{m}</span>)}
      {s.tags.slice(0, 2).map(t => <span key={t} className="px-1 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">{t}</span>)}
    </div>

    {/* CTA */}
    <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold">购买 · ${s.price}</button>
      <button className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs hover:bg-gray-50 dark:hover:bg-gray-700">详情</button>
    </div>
  </div>
);

const ReviewCard = ({ r }: { r: Review }) => (
  <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 mb-2">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-lg">{r.avatar}</span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{r.user}</span>
      <StarRating rating={r.rating} />
      <span className="text-xs text-gray-400 ml-auto">{r.time}</span>
    </div>
    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{r.text}</p>
    <p className="text-xs text-gray-400 mt-1">👍 {r.helpful} 人觉得有帮助</p>
  </div>
);

/* ====== Main Component ====== */

export default function StrategyTemplateMarket() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'featured' | 'sales' | 'rating' | 'price_asc' | 'newest'>('featured');
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const categories = ['ALL', '趋势跟踪', '资金流', '加密货币', '事件驱动', '价值投资', '期权', '套利', 'AI智能'];

  const filtered = useMemo(() => {
    let list = [...mockMarketStrategies];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.oneLiner.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q)));
    }
    if (categoryFilter !== 'ALL') list = list.filter(s => s.category === categoryFilter);
    if (marketFilter !== 'ALL') list = list.filter(s => s.market.includes(marketFilter));
    // Sort
    if (sortBy === 'sales') list.sort((a, b) => b.sales - a.sales);
    else if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sortBy === 'newest') list.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    else list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || b.sales - a.sales);
    return list;
  }, [search, categoryFilter, marketFilter, sortBy]);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">🛒 策略市场</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {mockMarketStrategies.length} 个策略 · {mockMarketStrategies.filter(s => s.isVerified).length} 已验证 · 创作者分 70/80/90%
            </p>
          </div>
          <button className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">
            + 发布策略
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索策略... (如 金叉 / 北向 / 链上 / 收息)" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" />
      </div>

      {/* Category + Filters */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {categories.slice(0, 8).map(c => (
          <button key={c} onClick={() => setCategoryFilter(c)} className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${categoryFilter === c ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {c === 'ALL' ? '全部' : c}
          </button>
        ))}
      </div>

      {/* Sort + Market */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 overflow-x-auto">
        <span className="flex-shrink-0">排序:</span>
        {(['featured', 'sales', 'rating', 'price_asc', 'newest'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} className={`px-1.5 py-0.5 rounded whitespace-nowrap ${sortBy === s ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {s === 'featured' ? '推荐' : s === 'sales' ? '销量' : s === 'rating' ? '评分' : s === 'price_asc' ? '价格↑' : '最新'}
          </button>
        ))}
        <span className="flex-shrink-0 ml-2">| 市场:</span>
        {(['ALL', 'US', 'HK', 'CN', 'CRYPTO'] as const).map(m => (
          <button key={m} onClick={() => setMarketFilter(m)} className={`px-1.5 py-0.5 rounded whitespace-nowrap ${marketFilter === m ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{m === 'ALL' ? '全' : m}</button>
        ))}
      </div>

      {/* Strategy Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm font-medium">没有匹配的策略</p>
            <p className="text-xs mt-1">换个搜索词试试</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(s => <StrategyCard key={s.id} s={s} />)}
          </div>
        )}
      </div>

      {/* Reviews Section */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">💬 最新评价</h3>
            <button className="text-xs text-blue-600 hover:text-blue-800">查看全部 →</button>
          </div>
          {mockReviews.map(r => <ReviewCard key={r.id} r={r} />)}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span>🛒 9.9U 起</span>
            <span className="text-gray-300">|</span>
            <span>创作者分成 70-90%</span>
            <span className="text-gray-300">|</span>
            <span>30天无理由退</span>
          </div>
          <span>dw-market</span>
        </div>
      </div>
    </div>
  );
}
