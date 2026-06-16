// @ts-nocheck
import React, { useState, useMemo, useCallback } from 'react';

/* ====== Types ====== */
type SortKey = 'latest' | 'hot' | 'top';
type CommentSortKey = 'oldest' | 'newest' | 'most_likes';

interface ThreadAuthor { name: string; avatar: string; isCreator: boolean; }
interface Comment { id: string; author: ThreadAuthor; text: string; likes: number; createdAt: string; isCreatorReply: boolean; }
interface Thread { id: string; title: string; preview: string; author: ThreadAuthor; tags: string[]; likes: number; comments: Comment[]; pinned: boolean; createdAt: string; linkedStrategy: string; market: string; }
interface DiscussionStats { totalThreads: number; totalComments: number; activeUsers: number; hotTopics: string[]; }

/* ====== Mock Data ====== */
const mockThreads: Thread[] = [
  { id: 't1', title: 'Fed signals rate cut in September – how will growth stocks react?', preview: 'FOMC minutes show growing consensus on easing. Historically growth stocks (ARKK +12%, TQQQ +18%) outperform on first cut...', author: { name: 'QuantWhale', avatar: '🐋', isCreator: true }, tags: ['Fed', 'Rate Cut', 'Growth'], likes: 48, pinned: true, createdAt: '2026-06-16T09:30:00Z', linkedStrategy: 'Momentum Rotation', market: 'US', comments: [
    { id: 'c1', author: { name: 'TraderJoe', avatar: '📈', isCreator: false }, text: 'Good analysis. I think small caps (IWM) will also benefit from lower rates.', likes: 12, createdAt: '2026-06-16T09:45:00Z', isCreatorReply: false },
    { id: 'c2', author: { name: 'QuantWhale', avatar: '🐋', isCreator: true }, text: 'Excellent point! IWM historically outperforms SPY by 3-5% in the 3 months after first cut. Added to the analysis.', likes: 8, createdAt: '2026-06-16T10:15:00Z', isCreatorReply: true }
  ] },
  { id: 't2', title: 'NVDA earnings beat – is AI rally still sustainable?', preview: 'NVDA Q2 revenue $42B vs $38B consensus. But forward PE is now 45x. Bull vs bear case breakdown...', author: { name: 'AITrader88', avatar: '🤖', isCreator: true }, tags: ['Earnings', 'NVDA', 'AI'], likes: 35, pinned: false, createdAt: '2026-06-15T22:00:00Z', linkedStrategy: 'Growth Momentum', market: 'US', comments: [
    { id: 'c3', author: { name: 'ValueHunter', avatar: '🔍', isCreator: false }, text: '45x PE is too rich for me. I am rotating into AVGO which is at 25x.', likes: 15, createdAt: '2026-06-15T23:10:00Z', isCreatorReply: false }
  ] },
  { id: 't3', title: '港股通南向资金连续5日净流入超100亿，腾讯美团受追捧', preview: '南向资金持续加仓港股科技龙头。腾讯(00700)获净买入45亿，美团(03690)获净买入28亿。资金面显示机构对港股信心恢复...', author: { name: '港股猎人', avatar: '🏹', isCreator: true }, tags: ['南向资金', '港股', '腾讯', '美团'], likes: 62, pinned: true, createdAt: '2026-06-16T08:00:00Z', linkedStrategy: '港股价值发现', market: 'HK', comments: [
    { id: 'c4', author: { name: '深港通达人', avatar: '🦅', isCreator: false }, text: '腾讯480以下都是黄金坑，我在470重仓了。', likes: 20, createdAt: '2026-06-16T08:30:00Z', isCreatorReply: false },
    { id: 'c5', author: { name: '港股猎人', avatar: '🏹', isCreator: true }, text: '同意。另外快手(01024)也很值得关注，估值比美团还低。', likes: 11, createdAt: '2026-06-16T09:00:00Z', isCreatorReply: true }
  ] },
  { id: 't4', title: 'Bitcoin breaks $120K – new ATH before ETF options expiry?', preview: 'BTC surged past $120K on massive spot ETF inflows ($2.8B this week). Options max pain at $115K. Gamma squeeze potential...', author: { name: 'CryptoWhale', avatar: '🐳', isCreator: false }, tags: ['BTC', 'Crypto', 'ATH', 'ETF'], likes: 89, pinned: false, createdAt: '2026-06-15T18:30:00Z', linkedStrategy: 'Crypto Momentum', market: 'CRYPTO', comments: [
    { id: 'c6', author: { name: 'ETHMaxi', avatar: '💎', isCreator: false }, text: 'ETH/BTC ratio at 0.035 – ETH is due for a catch-up rally.', likes: 22, createdAt: '2026-06-15T19:15:00Z', isCreatorReply: false },
    { id: 'c7', author: { name: 'OnchainSleuth', avatar: '🕵️', isCreator: false }, text: 'Whale accumulation on-chain is the strongest since November 2024.', likes: 18, createdAt: '2026-06-16T01:00:00Z', isCreatorReply: false }
  ] },
  { id: 't5', title: 'Gold at $3,500 – safe haven or bubble?', preview: 'Gold hit $3,500/oz for the first time. Central banks bought 1,200 tons in 2025. But real yields are turning positive...', author: { name: 'GoldBug', avatar: '🥇', isCreator: false }, tags: ['Gold', 'Commodities', 'Safe Haven'], likes: 27, pinned: false, createdAt: '2026-06-14T14:00:00Z', linkedStrategy: '贵金属配置', market: 'COMMODITY', comments: [] }
];

const mockStats: DiscussionStats = {
  totalThreads: 128, totalComments: 3427, activeUsers: 156,
  hotTopics: ['Fed Rate Cut', 'NVDA Earnings', '南向资金', 'BTC ATH', 'AI Regulation']
};

/* ====== Inline SVGs ====== */
const IconPin = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M6 12h12"/></svg>;
const IconHeart = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'} stroke={filled ? '#ef4444' : 'currentColor'} strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const IconComment = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconChevron = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>;

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

/* ====== Sub-components ====== */

const ThreadCard = ({ thread, expanded, onToggle, onLike }: { thread: Thread; expanded: boolean; onToggle: () => void; onLike: () => void }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg border ${thread.pinned ? 'border-amber-400' : 'border-gray-200 dark:border-gray-700'} p-4 mb-3 transition-all hover:shadow-md cursor-pointer`} onClick={onToggle}>
    <div className="flex items-start gap-3">
      <span className="text-2xl">{thread.author.avatar}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {thread.pinned && <span className="text-amber-500" title="Pinned"><IconPin /></span>}
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight">{thread.title}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{thread.preview}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400">{thread.author.name}{thread.author.isCreator ? ' · Creator' : ''}</span>
          <span className="text-xs text-gray-400">{timeAgo(thread.createdAt)}</span>
          <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{thread.market}</span>
          {thread.tags.slice(0, 2).map(t => <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{t}</span>)}
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        <button onClick={(e) => { e.stopPropagation(); onLike(); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500 transition-colors">
          <IconHeart filled={false} /> {thread.likes}
        </button>
        <span className="flex items-center gap-1 text-sm text-gray-400">
          <IconComment /> {thread.comments.length}
        </span>
      </div>
    </div>
    {expanded && (
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          {thread.comments.length} {(thread.comments.length === 1) ? 'Reply' : 'Replies'}
        </p>
        {thread.comments.map(c => (
          <div key={c.id} className={`flex gap-2 py-2 pl-2 rounded ${c.isCreatorReply ? 'bg-amber-50 dark:bg-amber-900/20 border-l-2 border-amber-400' : ''}`}>
            <span className="text-lg flex-shrink-0">{c.author.avatar}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.author.name}</span>
                {c.isCreatorReply && <span className="text-xs px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300">Creator</span>}
                <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{c.text}</p>
              <span className="text-xs text-gray-400 mt-1 inline-block">❤️ {c.likes} likes</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

/* ====== Main Component ====== */

export default function NewsDiscussionUI() {
  const [sort, setSort] = useState<SortKey>('hot');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [threads, setThreads] = useState(mockThreads);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [showNewThread, setShowNewThread] = useState(false);

  const sorted = useMemo(() => {
    let list = [...threads];
    if (marketFilter !== 'ALL') list = list.filter(t => t.market === marketFilter);
    const pinned = list.filter(t => t.pinned);
    const unpinned = list.filter(t => !t.pinned);
    if (sort === 'latest') unpinned.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sort === 'hot') unpinned.sort((a, b) => (b.likes + b.comments.length * 2) - (a.likes + a.comments.length * 2));
    else if (sort === 'top') unpinned.sort((a, b) => b.likes - a.likes);
    return [...pinned, ...unpinned];
  }, [sort, marketFilter, threads]);

  const handleLike = useCallback((id: string) => {
    setThreads(prev => prev.map(t => t.id === id ? { ...t, likes: t.likes + 1 } : t));
  }, []);

  const handleCreateThread = () => {
    if (!newThreadTitle.trim()) return;
    const newThread: Thread = {
      id: `t${Date.now()}`, title: newThreadTitle, preview: 'New discussion thread...', author: { name: 'You', avatar: '👤', isCreator: true }, tags: [], likes: 0, pinned: false, createdAt: new Date().toISOString(), linkedStrategy: 'Manual', market: 'US', comments: []
    };
    setThreads(prev => [newThread, ...prev]);
    setNewThreadTitle(''); setShowNewThread(false);
  };

  const markets = ['ALL', 'US', 'HK', 'CRYPTO', 'COMMODITY'];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">📰 News Discussion</h2>
          <p className="text-xs text-gray-500">{mockStats.totalThreads} threads · {mockStats.totalComments} comments · {mockStats.activeUsers} active</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewThread(!showNewThread)} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            + New Thread
          </button>
        </div>
      </div>

      {/* Hot Topics */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-semibold text-gray-500 flex-shrink-0">🔥 Hot:</span>
          {mockStats.hotTopics.map(topic => (
            <span key={topic} className="px-2 py-0.5 rounded-full text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 whitespace-nowrap flex-shrink-0">{topic}</span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {(['latest', 'hot', 'top'] as SortKey[]).map(k => (
          <button key={k} onClick={() => setSort(k)} className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${sort === k ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {k}
          </button>
        ))}
        <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
        {markets.map(m => (
          <button key={m} onClick={() => setMarketFilter(m)} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${marketFilter === m ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* New Thread Input */}
      {showNewThread && (
        <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <input value={newThreadTitle} onChange={e => setNewThreadTitle(e.target.value)} placeholder="Start a new discussion..." className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" onKeyDown={e => e.key === 'Enter' && handleCreateThread()} />
          <div className="flex justify-end mt-2 gap-2">
            <button onClick={() => setShowNewThread(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            <button onClick={handleCreateThread} className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">Post</button>
          </div>
        </div>
      )}

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-sm">No discussions found. Start one!</p>
          </div>
        ) : (
          sorted.map(t => (
            <ThreadCard key={t.id} thread={t} expanded={expandedId === t.id} onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)} onLike={() => handleLike(t.id)} />
          ))
        )}
      </div>
    </div>
  );
}
