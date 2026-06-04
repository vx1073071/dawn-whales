// ── DAWN WHALES — TradingJournal (交易日志) ────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

interface JournalEntry {
  id: string;
  date: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
  price: number;
  qty?: number;
  reasoning: string;
  emotion: 'calm' | 'greedy' | 'fearful' | 'impatient' | 'confident';
  outcome?: 'win' | 'loss' | 'pending';
  pnl?: number;
  lessons: string;
}

const EMOTION_EMOJI: Record<string, string> = {
  calm: '😌',
  greedy: '🤤',
  fearful: '😰',
  impatient: '😤',
  confident: '😎',
};

const EMOTION_LABEL: Record<string, string> = {
  calm: '平静',
  greedy: '贪婪',
  fearful: '恐惧',
  impatient: '急躁',
  confident: '自信',
};

export default function TradingJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'win' | 'loss' | 'pending'>('all');

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dawn-whales-journal');
      if (saved) setEntries(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (entries.length > 0) {
      localStorage.setItem('dawn-whales-journal', JSON.stringify(entries));
    }
  }, [entries]);

  const addEntry = useCallback((entry: Omit<JournalEntry, 'id' | 'date'>) => {
    const newEntry: JournalEntry = {
      ...entry,
      id: `journal-${Date.now()}`,
      date: new Date().toISOString(),
    };
    setEntries((prev) => [newEntry, ...prev]);
    setShowForm(false);
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const filtered = entries.filter((e) => {
    if (filter === 'all') return true;
    return e.outcome === filter;
  });

  const stats = {
    total: entries.length,
    wins: entries.filter((e) => e.outcome === 'win').length,
    losses: entries.filter((e) => e.outcome === 'loss').length,
    pending: entries.filter((e) => e.outcome === 'pending').length,
    totalPnl: entries.reduce((s, e) => s + (e.pnl || 0), 0),
  };

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-sm">📝 交易日志</h2>
          <p className="text-gray-500 text-[10px] mt-0.5">
            记录交易决策、情绪和反思 · {stats.total} 条记录
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-[#C9A046]/10 text-[#D4A853] border border-[#C9A046]/20 rounded-lg text-xs font-medium hover:bg-[#C9A046]/20 transition-colors"
        >
          {showForm ? '取消' : '+ 记一笔'}
        </button>
      </div>

      {/* Stats */}
      {entries.length > 0 && (
        <div className="flex items-center gap-4 mb-4 text-[10px]">
          <span className="text-gray-500">胜率 <span className="text-emerald-400 font-mono">{stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(0) : 0}%</span></span>
          <span className="text-gray-500">盈亏 <span className={stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'} font-mono">{stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(0)}</span></span>
          <span className="text-gray-500">赢 {stats.wins} · 亏 {stats.losses} · 待 {stats.pending}</span>
        </div>
      )}

      {/* Filter */}
      {entries.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
          {(['all', 'win', 'loss', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                filter === f ? 'bg-[#C9A046] text-black' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {f === 'all' ? '全部' : f === 'win' ? '盈利' : f === 'loss' ? '亏损' : '待定'}
            </button>
          ))}
        </div>
      )}

      {/* Add Entry Form */}
      {showForm && <JournalForm onSubmit={addEntry} onCancel={() => setShowForm(false)} />}

      {/* Entries List */}
      {filtered.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-2xl mb-2 opacity-40">📝</div>
          <p className="text-gray-500 text-sm">{entries.length === 0 ? '开始记录你的第一笔交易' : '没有符合条件的记录'}</p>
          <p className="text-gray-600 text-xs mt-1">记录决策过程，复盘得失</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-[#12121a] rounded-lg p-3 border border-white/5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-xs font-medium">{entry.symbol}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      entry.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' :
                      entry.action === 'SELL' ? 'bg-red-500/10 text-red-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {entry.action}
                    </span>
                    <span className="text-[10px] text-gray-500">${entry.price.toFixed(2)}</span>
                    {entry.qty && <span className="text-[10px] text-gray-500">×{entry.qty}</span>}
                    <span className="text-[10px]">{EMOTION_EMOJI[entry.emotion]} {EMOTION_LABEL[entry.emotion]}</span>
                  </div>
                  <div className="text-gray-400 text-xs mb-1">{entry.reasoning}</div>
                  {entry.lessons && (
                    <div className="text-[10px] text-[#D4A853] bg-[#C9A046]/5 rounded px-2 py-1">💡 {entry.lessons}</div>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  {entry.outcome && (
                    <div className={`text-xs font-mono font-medium ${
                      entry.outcome === 'win' ? 'text-emerald-400' :
                      entry.outcome === 'loss' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {entry.outcome === 'win' ? '✓ 盈利' : entry.outcome === 'loss' ? '✗ 亏损' : '⏳ 待定'}
                    </div>
                  )}
                  {entry.pnl !== undefined && (
                    <div className={`text-xs font-mono ${entry.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(0)}
                    </div>
                  )}
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="text-[10px] text-gray-600 hover:text-red-400 mt-1"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JournalForm({ onSubmit, onCancel }: {
  onSubmit: (entry: Omit<JournalEntry, 'id' | 'date'>) => void;
  onCancel: () => void;
}) {
  const [symbol, setSymbol] = useState('');
  const [action, setAction] = useState<'BUY' | 'SELL' | 'HOLD' | 'WATCH'>('BUY');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [emotion, setEmotion] = useState<'calm' | 'greedy' | 'fearful' | 'impatient' | 'confident'>('calm');
  const [outcome, setOutcome] = useState<'win' | 'loss' | 'pending'>('pending');
  const [pnl, setPnl] = useState('');
  const [lessons, setLessons] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !price || !reasoning) return;
    onSubmit({
      symbol: symbol.toUpperCase(),
      action,
      price: parseFloat(price),
      qty: qty ? parseInt(qty) : undefined,
      reasoning,
      emotion,
      outcome,
      pnl: pnl ? parseFloat(pnl) : undefined,
      lessons,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#12121a] rounded-lg p-4 border border-white/5 mb-4 space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="代码"
          className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600"
          required
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as any)}
          className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1.5 text-xs text-white"
        >
          <option value="BUY">买入</option>
          <option value="SELL">卖出</option>
          <option value="HOLD">持有</option>
          <option value="WATCH">观望</option>
        </select>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="价格"
          type="number"
          step="0.01"
          className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600"
          required
        />
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="数量"
          type="number"
          className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600"
        />
      </div>
      <textarea
        value={reasoning}
        onChange={(e) => setReasoning(e.target.value)}
        placeholder="交易理由..."
        rows={2}
        className="w-full bg-[#1a1a25] border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600"
        required
      />
      <div className="grid grid-cols-3 gap-2">
        <select
          value={emotion}
          onChange={(e) => setEmotion(e.target.value as any)}
          className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1.5 text-xs text-white"
        >
          <option value="calm">😌 平静</option>
          <option value="confident">😎 自信</option>
          <option value="greedy">🤤 贪婪</option>
          <option value="fearful">😰 恐惧</option>
          <option value="impatient">😤 急躁</option>
        </select>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as any)}
          className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1.5 text-xs text-white"
        >
          <option value="pending">⏳ 待定</option>
          <option value="win">✓ 盈利</option>
          <option value="loss">✗ 亏损</option>
        </select>
        <input
          value={pnl}
          onChange={(e) => setPnl(e.target.value)}
          placeholder="盈亏 $"
          type="number"
          className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600"
        />
      </div>
      <textarea
        value={lessons}
        onChange={(e) => setLessons(e.target.value)}
        placeholder="反思与教训 (可选)..."
        rows={2}
        className="w-full bg-[#1a1a25] border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 px-3 py-1.5 bg-[#C9A046] text-black text-xs font-medium rounded hover:bg-[#D4A853] transition-colors"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-gray-400 text-xs hover:text-gray-200 transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  );
}
