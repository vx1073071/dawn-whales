/**
 * SignalSquare — ML-61-02 [P0]
 * R61: v1.4.0-beta — Creator signal marketplace with card feed
 *
 * Features:
 * - Signal card feed with lazy/infinite scroll
 * - Filter by: market (HK/US/CN), direction, confidence range, agent type
 * - Sort by: latest, confidence, performance, subscriber count
 * - Subscribe button + subscriber count
 * - 7-day performance chart (mini sparkline on card)
 * - Signal detail modal: agent reasoning + historical accuracy
 * - Quality score badge (7-day rolling)
 * - "Verified Creator" checkmark
 */

import React, { useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface SignalCard {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  verified: boolean;
  symbol: string;
  market: 'HK' | 'US' | 'CN';
  direction: 'BUY' | 'SELL';
  confidence: number;
  price: number;
  targetPrice: number;
  stopLoss: number;
  timeframe: string;
  agents: string[];
  reason: string;
  qualityScore: number;         // 0-100
  subscribers: number;
  pastAccuracy: number;         // %
  performance7d: number[];      // daily % change
  signalCount: number;          // total signals published
  createdAt: string;
  expiresAt: string;
}

export interface SignalSquareProps {
  signals?: SignalCard[];
  onSubscribe?: (signalId: string) => void;
  onUnsubscribe?: (signalId: string) => void;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockSignals: SignalCard[] = [
  {
    id: 'sig-001', creatorId: 'c-01', creatorName: 'QuantEdge Pro', creatorAvatar: '🦊', verified: true,
    symbol: 'AAPL', market: 'US', direction: 'BUY', confidence: 0.88, price: 195.20,
    targetPrice: 210.00, stopLoss: 188.00, timeframe: '1-3 days',
    agents: ['Fundamentals', 'Technical'], reason: 'PE below sector + 50MA golden cross + volume confirmation',
    qualityScore: 92, subscribers: 1842, pastAccuracy: 78.5,
    performance7d: [1.2, -0.5, 0.8, 2.1, -0.3, 1.5, 0.9], signalCount: 328,
    createdAt: '2026-06-09T05:15:00Z', expiresAt: '2026-06-11T05:15:00Z',
  },
  {
    id: 'sig-002', creatorId: 'c-02', creatorName: 'DeepAlpha AI', creatorAvatar: '🤖', verified: true,
    symbol: '0700.HK', market: 'HK', direction: 'BUY', confidence: 0.82, price: 432.50,
    targetPrice: 460.00, stopLoss: 415.00, timeframe: '3-7 days',
    agents: ['Fundamentals', 'Macro', 'Technical'], reason: 'Stimulus-driven rally + oversold bounce from 52w low',
    qualityScore: 85, subscribers: 967, pastAccuracy: 71.2,
    performance7d: [0.5, 1.8, -1.2, 0.3, 2.5, -0.8, 1.1], signalCount: 156,
    createdAt: '2026-06-09T05:00:00Z', expiresAt: '2026-06-12T05:00:00Z',
  },
  {
    id: 'sig-003', creatorId: 'c-03', creatorName: 'CryptoFlow_CN', creatorAvatar: '🐲', verified: false,
    symbol: '601318.SH', market: 'CN', direction: 'BUY', confidence: 0.75, price: 52.30,
    targetPrice: 58.00, stopLoss: 49.00, timeframe: '5-10 days',
    agents: ['Macro', 'Sentiment'], reason: 'Insurance sector rotation + MA200 support + dividend yield 4.2%',
    qualityScore: 68, subscribers: 423, pastAccuracy: 63.8,
    performance7d: [-0.8, 0.2, 1.5, -0.4, 0.9, -1.1, 0.6], signalCount: 89,
    createdAt: '2026-06-09T04:45:00Z', expiresAt: '2026-06-14T04:45:00Z',
  },
  {
    id: 'sig-004', creatorId: 'c-01', creatorName: 'QuantEdge Pro', creatorAvatar: '🦊', verified: true,
    symbol: 'NVDA', market: 'US', direction: 'SELL', confidence: 0.65, price: 142.80,
    targetPrice: 130.00, stopLoss: 150.00, timeframe: '1-2 days',
    agents: ['Technical', 'Sentiment'], reason: 'RSI overbought 82 + bearish divergence on 4H chart',
    qualityScore: 74, subscribers: 1842, pastAccuracy: 78.5,
    performance7d: [-0.3, -1.2, 0.4, -0.9, 1.1, -0.6, 0.2], signalCount: 328,
    createdAt: '2026-06-09T04:30:00Z', expiresAt: '2026-06-10T04:30:00Z',
  },
  {
    id: 'sig-005', creatorId: 'c-04', creatorName: 'Sentiment Hawk', creatorAvatar: '🦅', verified: true,
    symbol: 'TSLA', market: 'US', direction: 'BUY', confidence: 0.91, price: 248.50,
    targetPrice: 270.00, stopLoss: 235.00, timeframe: '1-3 days',
    agents: ['Sentiment', 'Technical', 'Macro'], reason: 'Positive news sentiment spike + volume 3x average + breakout above resistance',
    qualityScore: 95, subscribers: 3150, pastAccuracy: 82.3,
    performance7d: [2.1, 1.5, -0.2, 3.2, 1.8, -0.5, 2.8], signalCount: 512,
    createdAt: '2026-06-09T05:20:00Z', expiresAt: '2026-06-11T05:20:00Z',
  },
  {
    id: 'sig-006', creatorId: 'c-05', creatorName: 'MacroWave', creatorAvatar: '🌊', verified: false,
    symbol: 'BABA', market: 'US', direction: 'BUY', confidence: 0.70, price: 92.50,
    targetPrice: 105.00, stopLoss: 87.00, timeframe: '7-14 days',
    agents: ['Macro'], reason: 'PBOC easing cycle + China ADR discount narrowing + technical bottom',
    qualityScore: 61, subscribers: 289, pastAccuracy: 58.4,
    performance7d: [0.2, -0.8, 0.5, -0.3, 1.2, -0.7, 0.3], signalCount: 45,
    createdAt: '2026-06-09T04:00:00Z', expiresAt: '2026-06-16T04:00:00Z',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const fmtPct = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

const marketFlag: Record<string, string> = { HK: '🇭🇰', US: '🇺🇸', CN: '🇨🇳' };
const qualityColor = (score: number): string =>
  score >= 80 ? 'bg-emerald-100 text-emerald-700' : score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-500';

const directionTag = (d: 'BUY' | 'SELL') =>
  d === 'BUY' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white';

// ── Mini Sparkline ──────────────────────────────────────────────────────

const MiniSparkline: React.FC<{ data: number[]; color?: string }> = ({ data, color = '#10b981' }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 0.1);
  const min = Math.min(...data, -0.1);
  const range = max - min || 1;
  const w = 80; const h = 24; const padX = 2;
  const step = (w - padX * 2) / (data.length - 1);
  const points = data.map((v, i) => `${padX + i * step},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  const isUp = data[data.length - 1] >= data[0];
  const stroke = isUp ? color : '#ef4444';
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ── SignalSquare ────────────────────────────────────────────────────────

const SignalSquare: React.FC<SignalSquareProps> = ({
  signals: inputSignals,
  onSubscribe,
  onUnsubscribe,
  className = '',
}) => {
  const [allSignals] = useState<SignalCard[]>(inputSignals ?? mockSignals);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [filterMarket, setFilterMarket] = useState<'ALL' | string>('ALL');
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'confidence' | 'quality' | 'subscribers'>('latest');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...allSignals];
    if (filterMarket !== 'ALL') result = result.filter(s => s.market === filterMarket);
    if (filterDirection !== 'ALL') result = result.filter(s => s.direction === filterDirection);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => s.symbol.toLowerCase().includes(q) || s.creatorName.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'confidence': result.sort((a, b) => b.confidence - a.confidence); break;
      case 'quality': result.sort((a, b) => b.qualityScore - a.qualityScore); break;
      case 'subscribers': result.sort((a, b) => b.subscribers - a.subscribers); break;
      default: result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return result;
  }, [allSignals, filterMarket, filterDirection, sortBy, search]);

  const handleSubscribe = useCallback((id: string) => {
    setSubscribed(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); onUnsubscribe?.(id); }
      else { next.add(id); onSubscribe?.(id); }
      return next;
    });
  }, [onSubscribe, onUnsubscribe]);

  const detailSignal = detailId ? allSignals.find(s => s.id === detailId) : null;

  return (
    <div className={`signal-square ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-800">📡 Signal Square</h2>
          <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">BETA</span>
        </div>
        <span className="text-xs text-slate-400">{allSignals.length} signals</span>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <input
          type="text" placeholder="Search symbol or creator..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 w-48 focus:ring-2 focus:ring-purple-300 outline-none"
        />

        {/* Market Filter */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {['ALL', 'HK', 'US', 'CN'].map(m => (
            <button key={m} onClick={() => setFilterMarket(m)}
              className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-all ${
                filterMarket === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              {m === 'ALL' ? '🌍 All' : `${marketFlag[m] || ''} ${m}`}
            </button>
          ))}
        </div>

        {/* Direction Filter */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['ALL', 'BUY', 'SELL'] as const).map(d => (
            <button key={d} onClick={() => setFilterDirection(d)}
              className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-all ${
                filterDirection === d ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              {d === 'ALL' ? '↕️ All' : d === 'BUY' ? '🟢 Buy' : '🔴 Sell'}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="text-[10px] border border-slate-200 rounded-lg px-2 py-1.5 font-medium">
          <option value="latest">🕐 Latest</option>
          <option value="confidence">🎯 Confidence</option>
          <option value="quality">⭐ Quality</option>
          <option value="subscribers">👥 Subscribers</option>
        </select>
      </div>

      {/* Signal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
        {filtered.map(sig => {
          const isSubbed = subscribed.has(sig.id);
          return (
            <div key={sig.id} className="bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-sm transition-all p-4">
              {/* Top: creator + quality */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{sig.creatorAvatar}</span>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-700">{sig.creatorName}</span>
                      {sig.verified && <span className="text-[10px] text-blue-500" title="Verified Creator">✓</span>}
                    </div>
                    <span className="text-[9px] text-slate-400">{sig.signalCount} signals · {sig.pastAccuracy}% accuracy</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${qualityColor(sig.qualityScore)}`}>
                  ⭐ {sig.qualityScore}
                </span>
              </div>

              {/* Symbol + Direction */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-slate-800">{marketFlag[sig.market]} {sig.symbol}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${directionTag(sig.direction)}`}>
                  {sig.direction}
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{sig.timeframe}</span>
              </div>

              {/* Price info */}
              <div className="grid grid-cols-3 gap-2 mb-2 text-[10px]">
                <div><span className="text-slate-400">Entry</span><div className="font-bold text-slate-700">${sig.price.toFixed(2)}</div></div>
                <div><span className="text-slate-400">Target</span><div className="font-bold text-emerald-600">${sig.targetPrice.toFixed(2)}</div></div>
                <div><span className="text-slate-400">Stop</span><div className="font-bold text-red-500">${sig.stopLoss.toFixed(2)}</div></div>
              </div>

              {/* Confidence bar */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${sig.confidence >= 0.8 ? 'bg-emerald-500' : sig.confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-400'}`}
                    style={{ width: `${sig.confidence * 100}%` }} />
                </div>
                <span className="text-[10px] font-bold text-slate-600">{(sig.confidence * 100).toFixed(0)}%</span>
              </div>

              {/* Reason snippet */}
              <p className="text-[10px] text-slate-500 mb-2 line-clamp-2 italic">"{sig.reason}"</p>

              {/* Bottom: sparkline + subscribe */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MiniSparkline data={sig.performance7d} />
                  <span className={`text-[10px] font-semibold ${sig.performance7d[6] >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmtPct(sig.performance7d.reduce((a, b) => a + b, 0))} 7d
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDetailId(sig.id)} className="text-[10px] text-purple-600 hover:text-purple-700 font-medium">
                    Detail
                  </button>
                  <button
                    onClick={() => handleSubscribe(sig.id)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      isSubbed ? 'bg-purple-100 text-purple-700' : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {isSubbed ? `✓ ${sig.subscribers + 1}` : `+ Subscribe ${sig.subscribers}`}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">📡</div>
            <p className="text-sm font-medium">No signals found</p>
            <p className="text-xs mt-1">Try adjusting filters</p>
          </div>
        )}
      </div>

      {/* Signal Detail Modal */}
      {detailSignal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDetailId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{detailSignal.creatorAvatar}</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{detailSignal.creatorName}</h3>
                  <span className="text-xs text-slate-400">{detailSignal.signalCount} signals · {detailSignal.pastAccuracy}% accuracy</span>
                </div>
              </div>
              {detailSignal.verified && <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">✓ Verified</span>}
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{marketFlag[detailSignal.market]} {detailSignal.symbol}</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${directionTag(detailSignal.direction)}`}>{detailSignal.direction}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-slate-400 text-xs">Entry</span><div className="font-bold">${detailSignal.price.toFixed(2)}</div></div>
                <div><span className="text-slate-400 text-xs">Target</span><div className="font-bold text-emerald-600">${detailSignal.targetPrice.toFixed(2)}</div></div>
                <div><span className="text-slate-400 text-xs">Stop Loss</span><div className="font-bold text-red-500">${detailSignal.stopLoss.toFixed(2)}</div></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Confidence:</span>
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div className="h-2 rounded-full bg-purple-500" style={{ width: `${detailSignal.confidence * 100}%` }} />
                </div>
                <span className="text-xs font-bold">{(detailSignal.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Analysis Agents</h4>
              <div className="flex flex-wrap gap-1.5">
                {detailSignal.agents.map(a => (
                  <span key={a} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-medium">{a}</span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Reasoning</h4>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 italic">"{detailSignal.reason}"</p>
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Performance (7 days)</h4>
              <div className="flex items-center gap-2">
                <MiniSparkline data={detailSignal.performance7d} color="#8b5cf6" />
                <span className={`text-sm font-bold ${detailSignal.performance7d.reduce((a, b) => a + b, 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fmtPct(detailSignal.performance7d.reduce((a, b) => a + b, 0))}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
              <span>Created {new Date(detailSignal.createdAt).toLocaleTimeString()}</span>
              <span>Expires {new Date(detailSignal.expiresAt).toLocaleDateString()}</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setDetailId(null)} className="flex-1 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl">Close</button>
              <button
                onClick={() => { handleSubscribe(detailSignal.id); setDetailId(null); }}
                className={`flex-1 text-sm font-bold px-4 py-2.5 rounded-xl ${
                  subscribed.has(detailSignal.id) ? 'bg-purple-100 text-purple-700' : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {subscribed.has(detailSignal.id) ? `Unsubscribe` : `Subscribe (${detailSignal.subscribers})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignalSquare;
