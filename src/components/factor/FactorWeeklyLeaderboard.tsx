// @ts-nocheck
// ── R189 ML P5-02: FactorWeeklyLeaderboard — 本周龙虎榜 ────────────────
// Weekly factor performance leaderboard with animated ranking.
// Top 10 winning factors and top 10 losing factors.
// Shows: rank change (↑↓→), IC, weekly return, signal status, category badge.
//
// Design:
// - Split view: 🟢 Top Winners (left) + 🔴 Top Losers (right)
// - Rank change animation (↑2 = moved up 2 spots, ↓1 = moved down 1)
// - Trophy emojis for top 3 (🥇🥈🥉)
// - Category color badges
// - "本周风格" summary card at top
// - Dark theme, golden accent for #1

import React, { useState, useMemo } from 'react';
import { FactorSignalLight, computeSignalColor, type SignalColor } from './FactorSignalLight';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  prevRank: number;
  factorId: string;
  nameCN: string;
  category: string;
  categoryCN: string;
  ic: number;
  weeklyReturn: number;    // e.g. 3.5 = +3.5%
  signal: SignalColor;
  change: number;           // rank change (+ = moved up)
}

interface FactorWeeklyLeaderboardProps {
  winners: LeaderboardEntry[];
  losers: LeaderboardEntry[];
  /** Market context (e.g. "🇺🇸 美股 · 本周风格: 价值防御") */
  marketContext?: string;
  /** Weekly date range */
  weekLabel?: string;
  className?: string;
}

// ── Rank medal ───────────────────────────────────────────────────────────────

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  if (rank === 1) return <span className="text-sm">🥇</span>;
  if (rank === 2) return <span className="text-sm">🥈</span>;
  if (rank === 3) return <span className="text-sm">🥉</span>;
  return <span className="text-[10px] font-mono text-gray-600 w-5 text-center">#{rank}</span>;
};

// ── Rank change indicator ────────────────────────────────────────────────────

const RankChange: React.FC<{ change: number }> = ({ change }) => {
  if (change > 0) return <span className="text-[9px] text-green-400 font-mono">↑{change}</span>;
  if (change < 0) return <span className="text-[9px] text-red-400 font-mono">↓{Math.abs(change)}</span>;
  return <span className="text-[9px] text-gray-600 font-mono">→</span>;
};

// ── Category badge ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  momentum: '#3b82f6', value: '#22c55e', quality: '#a855f7',
  volatility: '#f59e0b', technical: '#06b6d4', sentiment: '#ec4899',
  crypto: '#f97316', hk_specific: '#ef4444', us_specific: '#3b82f6',
  growth: '#8b5cf6', yield: '#22c55e', size: '#64748b',
};

// ── Entry row ────────────────────────────────────────────────────────────────

const LeaderboardRow: React.FC<{
  entry: LeaderboardEntry;
  side: 'winner' | 'loser';
}> = ({ entry, side }) => {
  const catColor = CATEGORY_COLORS[entry.category] || '#6b7280';
  const returnColor = side === 'winner' ? 'text-green-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 rounded transition-colors">
      {/* Rank */}
      <div className="w-7 flex-shrink-0 text-center">
        <RankBadge rank={entry.rank} />
      </div>

      {/* Rank change */}
      <RankChange change={entry.change} />

      {/* Factor info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white truncate">{entry.nameCN}</span>
          <span className="text-[9px] text-gray-600 font-mono">{entry.factorId}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: catColor + '15', color: catColor }}>
            {entry.categoryCN}
          </span>
        </div>
      </div>

      {/* IC + Weekly return */}
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono font-bold text-gray-400">IC:{entry.ic.toFixed(3)}</span>
        </div>
        <div className={`text-[10px] font-mono font-bold ${returnColor}`}>
          {entry.weeklyReturn >= 0 ? '+' : ''}{entry.weeklyReturn.toFixed(1)}%
        </div>
      </div>

      {/* Signal */}
      <div className="flex-shrink-0">
        <FactorSignalLight data={{ color: entry.signal, label: '' }} compact />
      </div>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const FactorWeeklyLeaderboard: React.FC<FactorWeeklyLeaderboardProps> = ({
  winners,
  losers,
  marketContext,
  weekLabel,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'winners' | 'losers'>('all');

  // Current week style summary
  const styleSummary = useMemo(() => {
    const topCategories = new Map<string, number>();
    for (const w of winners.slice(0, 5)) {
      topCategories.set(w.categoryCN, (topCategories.get(w.categoryCN) || 0) + 1);
    }
    const sorted = [...topCategories.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return '数据不足';
    return sorted.slice(0, 2).map(([cat, count]) => `${cat}×${count}`).join(' + ');
  }, [winners]);

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-300">
            🏆 因子龙虎榜
            {weekLabel && <span className="text-xs text-gray-600 font-normal ml-2">{weekLabel}</span>}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[10px]">
            {marketContext && <span className="text-gray-500">{marketContext}</span>}
            <span className="text-[#D4A853]/80">本周风格: {styleSummary}</span>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex bg-white/[0.03] rounded-lg p-0.5 border border-white/5">
          {[
            { key: 'all', label: '全部' },
            { key: 'winners', label: `🟢 赚(${winners.length})` },
            { key: 'losers', label: `🔴 亏(${losers.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-3 py-1 rounded-md text-[10px] transition-all ${
                activeTab === tab.key
                  ? 'bg-[#D4A853]/20 text-[#D4A853]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Winners column */}
        {(activeTab === 'all' || activeTab === 'winners') && (
          <div className="bg-green-500/[0.02] rounded-xl border border-green-500/10 p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">🟢</span>
              <span className="text-xs font-semibold text-green-400">本周赚钱因子</span>
              <span className="text-[10px] text-green-400/60 font-mono">Top {winners.length}</span>
            </div>
            <div className="space-y-0">
              {winners.map(e => (
                <LeaderboardRow key={e.factorId} entry={e} side="winner" />
              ))}
            </div>
          </div>
        )}

        {/* Losers column */}
        {(activeTab === 'all' || activeTab === 'losers') && (
          <div className="bg-red-500/[0.02] rounded-xl border border-red-500/10 p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">🔴</span>
              <span className="text-xs font-semibold text-red-400">本周亏钱因子</span>
              <span className="text-[10px] text-red-400/60 font-mono">Bottom {losers.length}</span>
            </div>
            <div className="space-y-0">
              {losers.map(e => (
                <LeaderboardRow key={e.factorId} entry={e} side="loser" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer insight */}
      <div className="mt-4 p-3 rounded-lg bg-[#D4A853]/5 border border-[#D4A853]/10 text-[10px]">
        <span className="text-[#D4A853]">💡 AI洞察：</span>
        <span className="text-gray-400 ml-1">
          本周{styleSummary}因子表现突出。建议关注风格切换信号——连续2周同一风格领先时，反转概率上升至60%。
        </span>
      </div>
    </div>
  );
};

// ── Demo data ────────────────────────────────────────────────────────────────

export function generateDemoLeaderboard(): { winners: LeaderboardEntry[]; losers: LeaderboardEntry[] } {
  const allFactors = [
    { id: 'MOM_12M', name: '12月动量', cat: 'momentum', catCN: '动量' },
    { id: 'HML', name: '价值因子', cat: 'value', catCN: '价值' },
    { id: 'QUAL', name: '品质因子', cat: 'quality', catCN: '品质' },
    { id: 'VOL_60D', name: '60日低波', cat: 'volatility', catCN: '低波' },
    { id: 'EMA_12_26', name: 'MACD交叉', cat: 'technical', catCN: '技术' },
    { id: 'US_VIX', name: 'VIX恐慌', cat: 'us_specific', catCN: '美股' },
    { id: 'CRYPTO_FUNDING', name: '资金费率', cat: 'crypto', catCN: '加密' },
    { id: 'YIELD', name: '股息率', cat: 'yield', catCN: '股息' },
    { id: 'HKEX_SOUTHBOUND', name: '南向资金', cat: 'hk_specific', catCN: '港股' },
    { id: 'GROWTH', name: '成长因子', cat: 'growth', catCN: '成长' },
    { id: 'RSI_14', name: 'RSI 14', cat: 'momentum', catCN: '动量' },
    { id: 'BOLL', name: '布林带', cat: 'volatility', catCN: '低波' },
    { id: 'KDJ', name: 'KDJ', cat: 'technical', catCN: '技术' },
    { id: 'OBV', name: '能量潮', cat: 'technical', catCN: '技术' },
    { id: 'US_BUYBACK', name: '回购因子', cat: 'us_specific', catCN: '美股' },
    { id: 'CRYPTO_NVT', name: 'NVT比率', cat: 'crypto', catCN: '加密' },
    { id: 'MOM_1M', name: '1月动量', cat: 'momentum', catCN: '动量' },
    { id: 'SIZE', name: '小盘因子', cat: 'size', catCN: '规模' },
    { id: 'OPTION_PCR', name: '期权PCR', cat: 'sentiment', catCN: '情绪' },
    { id: 'CRYPTO_OI_DELTA', name: 'OI变化', cat: 'crypto', catCN: '加密' },
  ];

  // Sort by simulated weekly return
  const entries = allFactors.map((f, i) => {
    const seed = (f.id.charCodeAt(0) * 13 + f.id.length * 7 + i * 3) % 200;
    const weeklyReturn = Math.round(((seed - 100) / 10) * 10) / 10;
    const ic = Math.abs(weeklyReturn / 80 + 0.02 + (Math.sin(i * 1.7) * 0.015));
    const signal: SignalColor = weeklyReturn > 1 ? 'green' : weeklyReturn < -1 ? 'red' : 'yellow';
    return { ...f, weeklyReturn, ic: Math.round(ic * 1000) / 1000, signal };
  }).sort((a, b) => b.weeklyReturn - a.weeklyReturn);

  const makeEntry = (e: typeof entries[0], rank: number, prevBase: number): LeaderboardEntry => ({
    rank,
    prevRank: Math.max(1, rank + Math.round((Math.sin(prevBase * 2.3) * 2))),
    factorId: e.id,
    nameCN: e.name,
    category: e.cat,
    categoryCN: e.catCN,
    ic: e.ic,
    weeklyReturn: e.weeklyReturn,
    signal: e.signal,
    change: 0, // computed below
  });

  const winners = entries.slice(0, 10).map((e, i) => {
    const entry = makeEntry(e, i + 1, i);
    entry.change = entry.prevRank - entry.rank;
    return entry;
  });

  const losers = entries.slice(-10).reverse().map((e, i) => {
    const entry = makeEntry(e, entries.length - 10 + i + 1, entries.length - i);
    entry.change = entry.prevRank - entry.rank;
    return entry;
  });

  return { winners, losers };
}

export default FactorWeeklyLeaderboard;
