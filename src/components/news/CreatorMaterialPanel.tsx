// @ts-nocheck
import React, { useState, useMemo, useCallback } from 'react';

/* ====== Types ====== */
interface NewsArticle {
  id: string; title: string; source: string; sourceLogo: string; time: string; summary: string; relevance: number; // 0-100
  sentiment: number; // -100 ~ +100
  tags: string[]; market: string; url: string;
}

interface AnalysisContext {
  strategyName: string; tickers: string[]; market: string; currentStage: 'draft' | 'writing' | 'review';
}

/* ====== Mock Data ====== */
const mockNews: NewsArticle[] = [
  { id: 'n1', title: 'Federal Reserve signals potential rate cut in September FOMC', source: 'Reuters', sourceLogo: '📰', time: '2h ago', summary: 'FOMC minutes reveal growing consensus on easing monetary policy, citing cooling inflation and softening labor market.', relevance: 95, sentiment: 65, tags: ['Fed', 'Rate Cut', 'Monetary Policy'], market: 'US', url: '#' },
  { id: 'n2', title: 'NVDA Q2 revenue $42B beats estimates by 10%, stock up 8% after hours', source: 'Bloomberg', sourceLogo: '📊', time: '3h ago', summary: 'NVIDIA reports record quarterly revenue driven by AI data center demand. Forward guidance raised to $45B for Q3.', relevance: 88, sentiment: 82, tags: ['Earnings', 'NVDA', 'AI'], market: 'US', url: '#' },
  { id: 'n3', title: 'SEC approves spot Ethereum ETF options trading', source: 'CoinDesk', sourceLogo: '🪙', time: '5h ago', summary: 'SEC greenlights options trading on spot ETH ETFs, expanding institutional access to crypto derivatives.', relevance: 72, sentiment: 70, tags: ['SEC', 'ETH', 'ETF', 'Crypto'], market: 'CRYPTO', url: '#' },
  { id: 'n4', title: 'Gold breaks $3,500 as central bank buying accelerates', source: 'Financial Times', sourceLogo: '💷', time: '6h ago', summary: 'Gold hits new all-time high above $3,500/oz. China PBOC adds 50 tons to reserves in May, largest monthly purchase since 2023.', relevance: 80, sentiment: 75, tags: ['Gold', 'Central Bank', 'Commodities'], market: 'COMMODITY', url: '#' },
  { id: 'n5', title: '港股通南向资金连续5日净流入超100亿港元', source: '信报', sourceLogo: '📰', time: '4h ago', summary: '南向资金本周净流入超500亿港元，腾讯(00700)、美团(03690)、快手(01024)为主要买入标的。', relevance: 90, sentiment: 70, tags: ['南向资金', '港股', '腾讯', '美团'], market: 'HK', url: '#' },
  { id: 'n6', title: 'Tencent Cloud signs $2B AI infrastructure deal with Southeast Asian governments', source: 'Nikkei Asia', sourceLogo: '🗾', time: '7h ago', summary: 'Tencent Cloud expands SEA presence with major government contracts for AI-powered smart city projects across Thailand and Indonesia.', relevance: 65, sentiment: 55, tags: ['Tencent', 'AI', 'Cloud', 'SEA'], market: 'HK', url: '#' },
  { id: 'n7', title: 'China CPI rises 0.3% YoY in May, below expectations of 0.5%', source: '财新', sourceLogo: '📋', time: '8h ago', summary: 'Consumer inflation remains subdued, reinforcing expectations of further PBOC easing measures in H2.', relevance: 60, sentiment: -20, tags: ['CPI', 'China', 'PBOC', 'Macro'], market: 'CN', url: '#' },
  { id: 'n8', title: 'SEC Chair Gensler warns crypto exchanges on compliance deadlines', source: 'WSJ', sourceLogo: '📰', time: '9h ago', summary: 'SEC chair reiterates enforcement stance, warns exchanges to register or face penalties by Q4 deadline.', relevance: 50, sentiment: -40, tags: ['SEC', 'Regulation', 'Crypto'], market: 'CRYPTO', url: '#' }
];

const mockContext: AnalysisContext = {
  strategyName: 'Global Momentum Rotation', tickers: ['NVDA', 'TSLA', 'AAPL', '00700.HK'], market: 'US/HK', currentStage: 'writing'
};

/* ====== Inline Icons ====== */
const IconPin = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>;
const IconExternal = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>;

const SentimentBadge = ({ score }: { score: number }) => {
  const color = score > 30 ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30' : score < -30 ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30' : 'text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-700';
  const label = score > 30 ? `+${score}` : `${score}`;
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold ${color}`}>{label}</span>;
};

const RelevanceBar = ({ pct }: { pct: number }) => {
  const color = pct >= 80 ? 'bg-green-400' : pct >= 60 ? 'bg-yellow-400' : pct >= 40 ? 'bg-orange-400' : 'bg-red-400';
  return (
    <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }}/>
    </div>
  );
};

/* ====== Sub-Components ====== */

const NewsCard = ({ article, onInsert }: { article: NewsArticle; onInsert: (a: NewsArticle) => void }) => (
  <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:shadow-md transition-shadow group">
    <div className="flex items-start gap-2 mb-1">
      <span className="text-lg leading-none">{article.sourceLogo}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <SentimentBadge score={article.sentiment} />
          <span className="text-xs text-gray-400">{article.time}</span>
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-1">{article.title}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{article.summary}</p>
      </div>
    </div>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Relevance</span>
        <RelevanceBar pct={article.relevance} />
        <span className="text-xs font-semibold text-gray-500">{article.relevance}%</span>
      </div>
      <button onClick={() => onInsert(article)} className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-all">
        + Insert
      </button>
    </div>
    <div className="flex gap-1 mt-2">
      {article.tags.slice(0, 3).map(t => <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{t}</span>)}
    </div>
  </div>
);

/* ====== Main Component ====== */

export default function CreatorMaterialPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'relevance' | 'sentiment' | 'recent'>('relevance');
  const [insertedIds, setInsertedIds] = useState<Set<string>>(new Set());
  const [showContext, setShowContext] = useState(true);

  const filtered = useMemo(() => {
    let list = [...mockNews];
    if (filter !== 'ALL') list = list.filter(n => n.market === filter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q)));
    }
    if (sortBy === 'relevance') list.sort((a, b) => b.relevance - a.relevance);
    else if (sortBy === 'sentiment') list.sort((a, b) => b.sentiment - a.sentiment);
    else if (sortBy === 'recent') list.sort((a, b) => a.time.localeCompare(b.time));
    return list;
  }, [searchQuery, filter, sortBy]);

  const handleInsert = useCallback((article: NewsArticle) => {
    setInsertedIds(prev => new Set(prev).add(article.id));
  }, []);

  const markets = ['ALL', 'US', 'HK', 'CN', 'CRYPTO', 'COMMODITY'];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">📰 Creator Materials</h3>
        <p className="text-xs text-gray-500">AI-recommended news for your analysis</p>
      </div>

      {/* Current Context */}
      {showContext && (
        <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              📝 {mockContext.strategyName}
            </span>
            <button onClick={() => setShowContext(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <span>{mockContext.tickers.join(' · ')}</span>
            <span className="text-gray-300">|</span>
            <span>{mockContext.currentStage}</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search news to support analysis..." className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {markets.map(m => (
          <button key={m} onClick={() => setFilter(m)} className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${filter === m ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {m}
          </button>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        {(['relevance', 'sentiment', 'recent'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} className={`px-2 py-0.5 rounded text-xs font-medium capitalize transition-colors ${sortBy === s ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Inserted Counter */}
      {insertedIds.size > 0 && (
        <div className="px-4 py-1.5 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-900/40">
          <span className="text-xs text-green-700 dark:text-green-300">✅ {insertedIds.size} article{insertedIds.size > 1 ? 's' : ''} inserted into analysis</span>
        </div>
      )}

      {/* News Cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-2xl mb-1">🔍</p>
            <p className="text-xs">No matching news. Adjust filters.</p>
          </div>
        ) : (
          filtered.map(article => (
            <NewsCard key={article.id} article={article} onInsert={handleInsert} />
          ))
        )}
      </div>

      {/* Footer Tip */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <p className="text-xs text-gray-400">💡 Tip: Insert relevant news as evidence to boost analysis credibility.</p>
      </div>
    </div>
  );
}
