import React, { useState, useCallback } from 'react';

type Status = 'planned' | 'progress' | 'shipped';
type Category = 'trading' | 'social' | 'ai' | 'data' | 'platform';

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: Status;
  votes: number;
  targetVersion: string;
}

const roadmapItems: RoadmapItem[] = [
  { id: 'r1', title: 'Conditional Orders (OCO)', description: 'One-cancels-other, bracket orders, trailing stops', category: 'trading', status: 'planned', votes: 48, targetVersion: 'v1.1.0' },
  { id: 'r2', title: 'Algorithmic Execution', description: 'TWAP/VWAP execution algos, smart order routing', category: 'trading', status: 'planned', votes: 35, targetVersion: 'v1.2.0' },
  { id: 'r3', title: 'Paper Trading Simulator', description: 'Virtual portfolio with realistic fills and slippage', category: 'trading', status: 'progress', votes: 62, targetVersion: 'v1.1.0' },
  { id: 'r4', title: 'Multi-Leg Options', description: 'Spread builder, iron condor, butterfly templates', category: 'trading', status: 'planned', votes: 28, targetVersion: 'v1.3.0' },
  { id: 'r5', title: 'Strategy Comments & Ratings', description: 'Discuss strategies, rate performance, flag issues', category: 'social', status: 'planned', votes: 41, targetVersion: 'v1.1.0' },
  { id: 'r6', title: 'Copy Trading', description: 'Subscribe to top strategies with 1-click replication', category: 'social', status: 'planned', votes: 53, targetVersion: 'v1.2.0' },
  { id: 'r7', title: 'Leaderboard', description: 'Weekly/monthly performance ranking with badges', category: 'social', status: 'planned', votes: 37, targetVersion: 'v1.1.0' },
  { id: 'r8', title: 'LLM Strategy Generation', description: 'Generate complete strategy code from natural language', category: 'ai', status: 'progress', votes: 71, targetVersion: 'v1.1.0' },
  { id: 'r9', title: 'AI Backtest Enhancement', description: 'AI-powered parameter optimization and regime detection', category: 'ai', status: 'planned', votes: 44, targetVersion: 'v1.2.0' },
  { id: 'r10', title: 'Sentiment Analysis', description: 'News/social media sentiment for ticker signals', category: 'ai', status: 'shipped', votes: 89, targetVersion: 'v1.0.0' },
  { id: 'r11', title: 'Level 2 Market Data', description: 'Order book depth, bid/ask ladder visualization', category: 'data', status: 'planned', votes: 56, targetVersion: 'v1.2.0' },
  { id: 'r12', title: 'Options Chain', description: 'Full options chain with Greeks and IV surface', category: 'data', status: 'planned', votes: 45, targetVersion: 'v1.1.0' },
  { id: 'r13', title: 'Futures Data', description: 'ES/NQ/CL/GC futures with continuous contracts', category: 'data', status: 'planned', votes: 32, targetVersion: 'v1.3.0' },
  { id: 'r14', title: 'Plugin System', description: 'Community plugins: indicators, strategies, data sources', category: 'platform', status: 'planned', votes: 67, targetVersion: 'v1.2.0' },
  { id: 'r15', title: 'Public REST API', description: 'External access to strategies, backtests, market data', category: 'platform', status: 'planned', votes: 39, targetVersion: 'v1.1.0' },
  { id: 'r16', title: 'Mobile Native App', description: 'iOS/Android native app (currently PWA only)', category: 'platform', status: 'planned', votes: 58, targetVersion: 'v1.3.0' },
];

const catCfg: Record<Category, { icon: string; label: string; color: string }> = {
  trading: { icon: '\u{1F4C8}', label: 'Trading', color: '#10b981' },
  social: { icon: '\u{1F91D}', label: 'Social', color: '#3b82f6' },
  ai: { icon: '\u{1F916}', label: 'AI', color: '#8b5cf6' },
  data: { icon: '\u{1F4CA}', label: 'Data', color: '#f59e0b' },
  platform: { icon: '\u{1F6E0}', label: 'Platform', color: '#ef4444' },
};

const stCfg: Record<Status, { label: string; bg: string }> = {
  planned: { label: 'Planned', bg: 'bg-gray-500/10 text-gray-400' },
  progress: { label: 'In Progress', bg: 'bg-amber-500/10 text-amber-400' },
  shipped: { label: 'Shipped', bg: 'bg-green-500/10 text-green-400' },
};

const RoadmapPage: React.FC = () => {
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const toggleVote = useCallback((id: string) => {
    setVoted((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const filtered = filter === 'all' ? roadmapItems : roadmapItems.filter((r) => r.category === filter);
  const totalVotes = roadmapItems.reduce((s, r) => s + r.votes, 0);

  return (
    <div className="h-full bg-[#0d0d15] overflow-y-auto">
      <div className="relative px-6 py-8 text-center border-b border-white/[0.04]">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/[0.03] to-transparent" />
        <div className="relative">
          <h1 className="text-2xl font-bold text-gray-100 mb-2">{'\u{1F5FA}'} v1.1.0 Roadmap</h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">Help us prioritize! Vote for features you want most.</p>
          <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
            <span>{roadmapItems.length} features</span>
            <span>{totalVotes} votes</span>
            <span className="text-amber-400">{voted.size} your votes</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-6 py-3 border-b border-white/[0.03] overflow-x-auto">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded text-xs shrink-0 ${filter === 'all' ? 'bg-white/[0.06] text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}>
          All ({roadmapItems.length})
        </button>
        {Object.entries(catCfg).map(([k, c]) => {
          const n = roadmapItems.filter((r) => r.category === k).length;
          return <button key={k} onClick={() => setFilter(k as Category)} className={`px-3 py-1.5 rounded text-xs shrink-0 ${filter === k ? 'bg-white/[0.06] text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}>{c.icon} {c.label} ({n})</button>;
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 p-6">
        {filtered.map((item) => {
          const cat = catCfg[item.category];
          const st = stCfg[item.status];
          const v = voted.has(item.id);
          return (
            <div key={item.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 hover:border-white/[0.08] transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-[10px] text-gray-600">{cat.icon} {cat.label}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.bg}`}>{st.label}</span>
              </div>
              <h4 className="text-sm font-medium text-gray-200 mb-1">{item.title}</h4>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{item.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-700 font-mono">{item.targetVersion}</span>
                <button onClick={() => toggleVote(item.id)} className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs ${v ? 'bg-amber-500/15 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
                  {v ? '\u{25B2}' : '\u{25B3}'} {item.votes + (v ? 1 : 0)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-6 py-6 text-center border-t border-white/[0.04]">
        <a href="https://github.com/vx1073071/TradingEasy/issues/new?template=feature_request.md" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:text-amber-300">
          + Submit Feature Request
        </a>
      </div>
    </div>
  );
};

export default RoadmapPage;
