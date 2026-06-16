// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
interface MarketStrategy {
  id: string; name: string; oneLiner: string; author: { name: string; avatar: string; level: 'L1' | 'L2' | 'L3'; };
  price: number; annualReturn: number; maxDrawdown: number; winRate: number; sharpe: number;
  sales: number; rating: number; reviewCount: number;
  category: string; tags: string[]; market: string[];
  isVerified: boolean; isFeatured: boolean; isNew: boolean; isBestseller: boolean;
  buyType: 'one_time' | 'subscription'; subscriptionPrice?: number;
}

interface Review { id: string; user: string; avatar: string; rating: number; text: string; time: string; helpful: number; verified: boolean; }

/* ====== Mock Data (expanded) ====== */
const mockStrategies: MarketStrategy[] = [
  { id: 'ms1', name: 'MACD金叉死叉策略', oneLiner: '你跟着MACD金叉买，死叉卖，简单有效', author: { name: 'QuantWhale', avatar: '🐋', level: 'L3' }, price: 9.9, annualReturn: 22, maxDrawdown: 18, winRate: 58, sharpe: 1.2, sales: 1847, rating: 4.5, reviewCount: 328, category: '趋势跟踪', tags: ['MACD', '简单', '高频'], market: ['US', 'HK'], isVerified: true, isFeatured: true, isNew: false, isBestseller: true, buyType: 'one_time' },
  { id: 'ms2', name: '北向资金跟随策略', oneLiner: '你跟着北向资金连续买入，聪明钱不骗人', author: { name: '港股猎人', avatar: '🏹', level: 'L2' }, price: 19.9, annualReturn: 28, maxDrawdown: 15, winRate: 65, sharpe: 1.8, sales: 1243, rating: 4.8, reviewCount: 215, category: '资金流', tags: ['北向', 'A股', '跟随'], market: ['CN'], isVerified: true, isFeatured: true, isNew: false, isBestseller: true, buyType: 'one_time' },
  { id: 'ms3', name: 'BTC链上监控策略', oneLiner: '你看交易所BTC流出就是囤币信号', author: { name: 'CryptoKing', avatar: '👑', level: 'L3' }, price: 29.9, annualReturn: 45, maxDrawdown: 25, winRate: 62, sharpe: 1.6, sales: 982, rating: 4.6, reviewCount: 156, category: '加密货币', tags: ['BTC', '链上', '巨鲸'], market: ['CRYPTO'], isVerified: true, isFeatured: false, isNew: false, isBestseller: false, buyType: 'subscription', subscriptionPrice: 9.9 },
  { id: 'ms4', name: '财报季做多策略', oneLiner: '你财报发布前一天买Call，赌波动放大', author: { name: 'OptionsMaster', avatar: '📊', level: 'L2' }, price: 14.9, annualReturn: 18, maxDrawdown: 12, winRate: 72, sharpe: 1.5, sales: 756, rating: 4.3, reviewCount: 98, category: '事件驱动', tags: ['财报', '期权', '季节性'], market: ['US'], isVerified: true, isFeatured: false, isNew: false, isBestseller: false, buyType: 'one_time' },
  { id: 'ms5', name: '高息股躺平收息组合', oneLiner: '你买分红率>4%的国企股票，躺着每年收5-8%', author: { name: 'DividendHunter', avatar: '💸', level: 'L1' }, price: 9.9, annualReturn: 10, maxDrawdown: 8, winRate: 78, sharpe: 1.25, sales: 2103, rating: 4.7, reviewCount: 452, category: '价值投资', tags: ['股息', '国企', '防御'], market: ['HK', 'CN'], isVerified: true, isFeatured: true, isNew: false, isBestseller: true, buyType: 'one_time' },
  { id: 'ms6', name: '美股期权Iron Condor', oneLiner: '你每周卖宽跨式期权，80%胜率', author: { name: 'ThetaGang', avatar: '🦅', level: 'L3' }, price: 34.9, annualReturn: 12, maxDrawdown: 5, winRate: 78, sharpe: 2.4, sales: 431, rating: 4.9, reviewCount: 87, category: '期权', tags: ['期权', '收租', '每周'], market: ['US'], isVerified: true, isFeatured: false, isNew: true, isBestseller: false, buyType: 'subscription', subscriptionPrice: 14.9 },
  { id: 'ms7', name: 'AH股溢价套利', oneLiner: '你同时买AH两地便宜卖贵的，吃价差回归', author: { name: 'ArbitragePro', avatar: '💰', level: 'L2' }, price: 24.9, annualReturn: 15, maxDrawdown: 10, winRate: 68, sharpe: 1.5, sales: 612, rating: 4.4, reviewCount: 134, category: '套利', tags: ['AH', '价差', '低风险'], market: ['HK', 'CN'], isVerified: false, isFeatured: false, isNew: false, isBestseller: false, buyType: 'one_time' },
  { id: 'ms8', name: 'AI智能调仓机器人', oneLiner: '你让AI每月自动分析持仓，省心', author: { name: 'AIQuant', avatar: '🤖', level: 'L2' }, price: 49.9, annualReturn: 20, maxDrawdown: 14, winRate: 60, sharpe: 1.4, sales: 325, rating: 4.2, reviewCount: 45, category: 'AI智能', tags: ['AI', '自动', '省心'], market: ['US', 'HK', 'CN'], isVerified: true, isFeatured: false, isNew: true, isBestseller: false, buyType: 'subscription', subscriptionPrice: 19.9 },
  { id: 'ms9', name: 'VIX恐慌抄底策略', oneLiner: 'VIX>30你勇敢抄底，恐慌是朋友', author: { name: 'ContrarianJoe', avatar: '🎭', level: 'L2' }, price: 14.9, annualReturn: 25, maxDrawdown: 20, winRate: 55, sharpe: 1.25, sales: 891, rating: 4.5, reviewCount: 167, category: '逆向交易', tags: ['VIX', '恐慌', '抄底'], market: ['US'], isVerified: true, isFeatured: false, isNew: false, isBestseller: false, buyType: 'one_time' },
  { id: 'ms10', name: '金铜比价套利', oneLiner: '你做黄金和铜的比值回归交易', author: { name: 'CommodityTrader', avatar: '🏭', level: 'L3' }, price: 19.9, annualReturn: 12, maxDrawdown: 8, winRate: 72, sharpe: 1.5, sales: 345, rating: 4.3, reviewCount: 56, category: '商品套利', tags: ['黄金', '铜', '宏观'], market: ['US'], isVerified: false, isFeatured: false, isNew: true, isBestseller: false, buyType: 'one_time' }
];

const mockReviews: Review[] = [
  { id: 'rv1', user: '散户老王', avatar: '👴', rating: 5, text: '用了三个月，收益比我之前瞎买好太多了。MACD金叉策略很简单，适合新手。鲸灵推荐给我的，靠谱。', time: '3天前', helpful: 42, verified: true },
  { id: 'rv2', user: 'TraderMike', avatar: '🧔', rating: 4, text: '北向策略确实有用，但要注意MSCI调仓日的数据失真。整体靠谱，回测数据诚实。', time: '1周前', helpful: 28, verified: true },
  { id: 'rv3', user: 'CryptoMaxi', avatar: '🚀', rating: 5, text: '链上策略 + BTC ETF 双管齐下，今年收益翻倍了。策略市场比我想象的好用。', time: '2周前', helpful: 35, verified: true },
  { id: 'rv4', user: '港女退休陈太', avatar: '👵', rating: 5, text: '高息股组合非常适合退休人士。每个月收息的感觉很安心。朋友推荐我用的。', time: '5天前', helpful: 18, verified: false }
];

/* ====== Sub-Components ====== */

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1,2,3,4,5].map(i => <span key={i} className={`text-xs ${i <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>)}
  </div>
);

const LevelBadge = ({ level }: { level: string }) => {
  const map: Record<string, string> = { L1: 'bg-green-100 text-green-700', L2: 'bg-blue-100 text-blue-700', L3: 'bg-purple-100 text-purple-700' };
  return <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${map[level] || ''}`}>{level}</span>;
};

const StrategyCardV2 = ({ s }: { s: MarketStrategy }) => (
  <div className={`rounded-xl border ${s.isFeatured ? 'border-amber-400 ring-1 ring-amber-200' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 p-4 hover:shadow-lg transition-all group`}>
    {/* Badges */}
    <div className="flex items-center gap-1.5 mb-2">
      {s.isBestseller && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">🏆 热销</span>}
      {s.isFeatured && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">精选</span>}
      {s.isNew && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">NEW</span>}
    </div>
    {/* Author */}
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xl">{s.author.avatar}</span>
      <span className="text-xs text-gray-500">{s.author.name}</span>
      <LevelBadge level={s.author.level} />
      {s.isVerified && <span className="text-xs text-blue-500">✓</span>}
    </div>
    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{s.oneLiner}</h3>
    <p className="text-xs text-gray-400 mb-2">{s.name}</p>
    {/* Stats Grid */}
    <div className="grid grid-cols-4 gap-1 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 mb-2">
      <div className="text-center"><p className="text-xs font-bold text-green-600">+{s.annualReturn}%</p><p className="text-xs text-gray-400">年化</p></div>
      <div className="text-center"><p className="text-xs font-bold text-red-500">-{s.maxDrawdown}%</p><p className="text-xs text-gray-400">回撤</p></div>
      <div className="text-center"><p className="text-xs font-bold text-gray-700">{s.winRate}%</p><p className="text-xs text-gray-400">胜率</p></div>
      <div className="text-center"><p className="text-xs font-bold text-blue-600">{s.sharpe}</p><p className="text-xs text-gray-400">夏普</p></div>
    </div>
    {/* Tags + Price */}
    <div className="flex items-center justify-between">
      <div className="flex gap-1">{s.market.map(m => <span key={m} className="px-1 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600">{m}</span>)}</div>
      <div className="text-right">
        <p className="text-lg font-bold text-amber-600">${s.price}</p>
        {s.buyType === 'subscription' && <p className="text-xs text-gray-400">/月 ${s.subscriptionPrice}</p>}
      </div>
    </div>
    {/* Rating + Sales */}
    <div className="flex items-center gap-2 mt-2">
      <StarRating rating={s.rating} />
      <span className="text-xs text-gray-400">({s.reviewCount}) · {s.sales}笔</span>
    </div>
    {/* CTA */}
    <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold">{s.buyType === 'subscription' ? `订阅 · $${s.subscriptionPrice}/月` : `购买 · $${s.price}`}</button>
      <button className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50">详情</button>
    </div>
  </div>
);

/* ====== Main Component ====== */
export default function MarketplaceV2() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [market, setMarket] = useState('ALL');
  const [sort, setSort] = useState<'popular' | 'rating' | 'price_asc' | 'price_desc' | 'return' | 'newest'>('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories = ['ALL', '趋势跟踪', '资金流', '加密货币', '事件驱动', '价值投资', '期权', '套利', 'AI智能', '逆向交易', '商品套利'];

  const filtered = useMemo(() => {
    let list = [...mockStrategies];
    if (search) { const q = search.toLowerCase(); list = list.filter(s => s.name.toLowerCase().includes(q) || s.oneLiner.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q))); }
    if (category !== 'ALL') list = list.filter(s => s.category === category);
    if (market !== 'ALL') list = list.filter(s => s.market.includes(market));
    const sortFn: Record<string, (a: MarketStrategy, b: MarketStrategy) => number> = {
      popular: (a, b) => b.sales - a.sales,
      rating: (a, b) => b.rating - a.rating,
      price_asc: (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      return: (a, b) => b.annualReturn - a.annualReturn,
      newest: (a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)
    };
    return list.sort(sortFn[sort]);
  }, [search, category, market, sort]);

  const totalRevenue = mockStrategies.reduce((sum, s) => sum + s.price * s.sales, 0);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">🛒 策略模板市场</h2>
            <p className="text-xs text-gray-500">{mockStrategies.length}个策略 · 交易额US${totalRevenue.toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100">{viewMode === 'grid' ? '📋' : '⊞'}</button>
            <button className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">+ 发布</button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索策略..." className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Category */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)} className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${category === c ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-400' : 'text-gray-500 hover:bg-gray-100'}`}>{c === 'ALL' ? '全部' : c}</button>
        ))}
      </div>

      {/* Sort + Market */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-50 dark:bg-gray-850 border-b border-gray-100 text-xs text-gray-500 overflow-x-auto">
        <span>排序:</span>
        {(['popular', 'rating', 'return', 'price_asc', 'newest'] as const).map(s => (
          <button key={s} onClick={() => setSort(s)} className={`px-1.5 py-0.5 rounded whitespace-nowrap ${sort === s ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100'}`}>{s === 'popular' ? '销量' : s === 'rating' ? '评分' : s === 'return' ? '收益' : s === 'price_asc' ? '低价' : '最新'}</button>
        ))}
        <span className="ml-2">|</span>
        {(['ALL', 'US', 'HK', 'CN', 'CRYPTO'] as const).map(m => (
          <button key={m} onClick={() => setMarket(m)} className={`px-1.5 py-0.5 rounded ${market === m ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'}`}>{m}</button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p className="text-4xl mb-3">🔍</p><p className="text-sm">没有匹配的策略</p></div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-2'}>
            {filtered.map(s => <StrategyCardV2 key={s.id} s={s} />)}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <h3 className="text-sm font-bold text-gray-900 mb-2">💬 用户评价</h3>
        {mockReviews.map(r => (
          <div key={r.id} className="p-2 border border-gray-100 rounded-lg mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span>{r.avatar}</span>
              <span className="text-sm font-semibold">{r.user}</span>
              {r.verified && <span className="text-xs text-blue-500">✓已验证购买</span>}
              <StarRating rating={r.rating} />
              <span className="text-xs text-gray-400 ml-auto">{r.time}</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{r.text}</p>
            <p className="text-xs text-gray-400 mt-1">👍 {r.helpful}人</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>🛒 $9.9起 · 70-90%创作者分成 · 30天可退</span>
        <span>v2.7 marketplace</span>
      </div>
    </div>
  );
}
