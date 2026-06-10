/**
 * CreatorLeaderboard — ML-66-02 [P0]
 * R66: v1.6.0 GA — Creator level system + leaderboard UI
 *
 * Features:
 * - 6-level system: 青铜→白银→黄金→铂金→钻石→王者
 * - XP progress bar per level with promotion/demotion indicators
 * - Level perks table: L1(70/30) L2(80/20) L3(90/10) revenue splits
 * - Leaderboard: 4 dimensions (total return / 30d return / Sharpe / subscribers)
 * - Time range toggle: weekly / monthly / all-time
 * - Creator card with avatar, level badge, stats, rank badge
 */

import { useState, useMemo } from 'react';
import { useTranslation } from "react-i18next";

// ── Types ───────────────────────────────────────────────────────────────

export type CreatorLevel = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'king';

export interface CreatorProfile {
  id: string;
  name: string;
  avatar: string;
  verified: boolean;
  level: CreatorLevel;
  xp: number;
  xpToNext: number;
  promotedAt?: string;
  totalReturn: number;        // %
  return30d: number;          // %
  sharpe: number;
  subscribers: number;
  strategyCount: number;
  signalCount: number;
  winRate: number;            // %
  revenue: number;            // USDT
  rank: number;
  rankChange?: number;        // + or -
}

export interface CreatorLeaderboardProps {
  profiles?: CreatorProfile[];
  currentUserId?: string;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────────

const LEVELS: { key: CreatorLevel; label: string; icon: string; color: string; bg: string; xpMin: number; split: string }[] = [
  { key: 'bronze',   label: '青铜', icon: '🥉', color: '#CD7F32', bg: 'bg-amber-900/20',   xpMin: 0,    split: '70/30' },
  { key: 'silver',   label: '白银', icon: '🥈', color: '#C0C0C0', bg: 'bg-gray-400/10',    xpMin: 100,  split: '75/25' },
  { key: 'gold',     label: '黄金', icon: '🥇', color: '#FFD700', bg: 'bg-yellow-500/10',  xpMin: 500,  split: '80/20' },
  { key: 'platinum', label: '铂金', icon: '💎', color: '#E5E4E2', bg: 'bg-slate-300/10',   xpMin: 2000, split: '85/15' },
  { key: 'diamond',  label: '钻石', icon: '👑', color: '#B9F2FF', bg: 'bg-cyan-300/10',    xpMin: 5000, split: '90/10' },
  { key: 'king',     label: '王者', icon: '🏆', color: '#FF4500', bg: 'bg-orange-600/10',  xpMin: 10000,split: '90/10' },
];

type LeaderboardDimension = 'totalReturn' | 'return30d' | 'sharpe' | 'subscribers';
type TimeRange = 'weekly' | 'monthly' | 'all';

const DIMENSIONS: { key: LeaderboardDimension; label: string; icon: string }[] = [
  { key: 'totalReturn', label: '总收益', icon: '📈' },
  { key: 'return30d',   label: '30日收益', icon: '🔥' },
  { key: 'sharpe',      label: '夏普比率', icon: '🎯' },
  { key: 'subscribers', label: '订阅数', icon: '👥' },
];

// ── Mock ─────────────────────────────────────────────────────────────────

const mockProfiles: CreatorProfile[] = [
  { id: 'c-01', name: 'QuantEdge Pro', avatar: '🦊', verified: true, level: 'diamond', xp: 6720, xpToNext: 10000, totalReturn: 42.3, return30d: 5.2, sharpe: 2.1, subscribers: 2847, strategyCount: 6, signalCount: 847, winRate: 68.2, revenue: 14250, rank: 1, rankChange: 0 },
  { id: 'c-02', name: 'VolArb', avatar: '🦅', verified: true, level: 'king', xp: 12840, xpToNext: 20000, totalReturn: 35.8, return30d: 3.1, sharpe: 3.1, subscribers: 2103, strategyCount: 4, signalCount: 1204, winRate: 78.4, revenue: 48000, rank: 2, rankChange: 0 },
  { id: 'c-03', name: 'HK Whale', avatar: '🐋', verified: true, level: 'platinum', xp: 3840, xpToNext: 5000, totalReturn: 31.2, return30d: -1.2, sharpe: 2.4, subscribers: 982, strategyCount: 3, signalCount: 321, winRate: 65.8, revenue: 8200, rank: 3, rankChange: 1 },
  { id: 'c-04', name: 'MeanReversion', avatar: '🐺', verified: true, level: 'gold', xp: 1250, xpToNext: 2000, totalReturn: 28.1, return30d: 4.8, sharpe: 1.8, subscribers: 1523, strategyCount: 5, signalCount: 523, winRate: 72.1, revenue: 5100, rank: 4, rankChange: -1 },
  { id: 'c-05', name: 'AI Insights', avatar: '🤖', verified: true, level: 'gold', xp: 890, xpToNext: 2000, totalReturn: 22.5, return30d: 2.1, sharpe: 1.6, subscribers: 756, strategyCount: 4, signalCount: 412, winRate: 61.3, revenue: 3200, rank: 5 },
  { id: 'c-06', name: 'DragonTiger', avatar: '🐉', verified: false, level: 'silver', xp: 340, xpToNext: 500, totalReturn: 18.7, return30d: -3.5, sharpe: 1.2, subscribers: 341, strategyCount: 3, signalCount: 198, winRate: 55.6, revenue: 890, rank: 6 },
  { id: 'c-07', name: 'Momentum King', avatar: '🐂', verified: true, level: 'silver', xp: 220, xpToNext: 500, totalReturn: 15.3, return30d: 7.2, sharpe: 0.9, subscribers: 234, strategyCount: 2, signalCount: 156, winRate: 58.9, revenue: 420, rank: 7, rankChange: 3 },
  { id: 'c-08', name: 'NewbieTrader', avatar: '🐣', verified: false, level: 'bronze', xp: 45, xpToNext: 100, totalReturn: 8.2, return30d: 1.5, sharpe: 0.6, subscribers: 89, strategyCount: 1, signalCount: 56, winRate: 48.3, revenue: 120, rank: 8, rankChange: -1 },
];

// ── Rank Badge ──────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const { t: _t } = useTranslation();

  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-xs text-gray-600 font-mono w-5 text-center">#{rank}</span>;
}

// ── Level Badge ─────────────────────────────────────────────────────────

function LevelBadge({ level, size }: { level: CreatorLevel; size?: 'sm' | 'md' }) {
  const cfg = LEVELS.find((l) => l.key === level)!;
  return (
    <span className={`inline-flex items-center gap-1 ${size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'} rounded font-medium ${cfg.bg}`}
          style={{ color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── XP Bar ──────────────────────────────────────────────────────────────

function XPBar({ current, next, level }: { current: number; next: number; level: CreatorLevel }) {
  const pct = Math.min(100, (current / next) * 100);
  const cfg = LEVELS.find((l) => l.key === level)!;
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>XP: {current.toLocaleString()}</span>
        <span>{next.toLocaleString()} → {LEVELS[LEVELS.findIndex((l) => l.key === level) + 1]?.label ?? 'MAX'}</span>
      </div>
      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function CreatorLeaderboard({
  profiles: propProfiles,
  currentUserId,
  className = '',
}: CreatorLeaderboardProps) {
  const profiles = propProfiles ?? mockProfiles;
  const [tab, setTab] = useState<'levels' | 'leaderboard'>('leaderboard');
  const [dimension, setDimension] = useState<LeaderboardDimension>('totalReturn');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  // ── Leaderboard sort ──────────────────────────────────────────────────
  const ranked = useMemo(() => {
    const sorted = [...profiles].sort((a, b) => {
      if (dimension === 'totalReturn') return b.totalReturn - a.totalReturn;
      if (dimension === 'return30d') return b.return30d - a.return30d;
      if (dimension === 'sharpe') return b.sharpe - a.sharpe;
      return b.subscribers - a.subscribers; // subscribers
    });
    return sorted.map((p, i) => ({ ...p, computedRank: i + 1 }));
  }, [profiles, dimension]);

  const currentProfile = profiles.find((p) => p.id === currentUserId);

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">创作者中心</h2>
            <p className="text-gray-500 text-xs mt-0.5">等级成长 · 排行榜 · 收益分成</p>
          </div>
          {/* Tabs */}
          <div className="flex bg-white/[0.04] rounded-lg p-0.5">
            <button onClick={() => setTab('leaderboard')}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'leaderboard' ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-500 hover:text-gray-300'}`}>
              🏆 排行榜
            </button>
            <button onClick={() => setTab('levels')}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'levels' ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-500 hover:text-gray-300'}`}>
              ⭐ 等级体系
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Leaderboard View ──────────────────────────────────────────── */}
        {tab === 'leaderboard' && (
          <div className="p-5">
            {/* Current user rank card */}
            {currentProfile && (
              <div className="bg-[#111119] border border-[#C9A046]/20 rounded-xl p-4 mb-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{currentProfile.avatar}</span>
                    <div>
                      <div className="text-white font-semibold">{currentProfile.name}</div>
                      <LevelBadge level={currentProfile.level} size="sm" />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">我的排名</div>
                    <div className="text-[#D4A853] font-bold text-2xl">#{currentProfile.rank}</div>
                    {currentProfile.rankChange !== undefined && currentProfile.rankChange !== 0 && (
                      <span className={`text-xs ${currentProfile.rankChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {currentProfile.rankChange > 0 ? '↑' : '↓'} {Math.abs(currentProfile.rankChange)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <XPBar current={currentProfile.xp} next={currentProfile.xpToNext} level={currentProfile.level} />
                </div>
              </div>
            )}

            {/* Dimension + Time toggles */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex gap-1">
                {DIMENSIONS.map((d) => (
                  <button key={d.key} onClick={() => setDimension(d.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dimension === d.key ? 'bg-[#C9A046]/10 text-[#D4A853] border border-[#C9A046]/30' : 'text-gray-500 border border-white/5 hover:text-gray-300'}`}>
                    {d.icon} {d.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['weekly', 'monthly', 'all'] as TimeRange[]).map((t) => (
                  <button key={t} onClick={() => setTimeRange(t)}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${timeRange === t ? 'text-white bg-white/[0.06]' : 'text-gray-600 hover:text-gray-400'}`}>
                    {t === 'weekly' ? t('components.thisWeek') : t === 'monthly' ? t('components.thisMonth') : t('components.all')}
                  </button>
                ))}
              </div>
            </div>

            {/* Leaderboard table */}
            <div className="border border-white/5 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-white/[0.03] text-[10px] text-gray-600 uppercase tracking-wider">
                <div className="col-span-1">排名</div>
                <div className="col-span-4">创作者</div>
                <div className="col-span-2 text-right">{t("components.returnRate")}</div>
                <div className="col-span-1 text-right">{t("components.sharpeRatio")}</div>
                <div className="col-span-2 text-right">订阅数</div>
                <div className="col-span-2 text-right">收入</div>
              </div>

              {ranked.map((p, i) => {
                const isMe = p.id === currentUserId;
                const val = dimension === 'totalReturn' ? p.totalReturn :
                            dimension === 'return30d' ? p.return30d :
                            dimension === 'sharpe' ? p.sharpe :
                            p.subscribers;

                return (
                  <div key={p.id}
                       className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${isMe ? 'bg-[#C9A046]/5' : 'hover:bg-white/[0.02]'}`}>
                    {/* Rank */}
                    <div className="col-span-1 flex items-center">
                      <RankBadge rank={p.computedRank ?? i + 1} />
                      {p.rankChange !== undefined && p.rankChange !== 0 && (
                        <span className={`text-[10px] ml-1 ${p.rankChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.rankChange > 0 ? '↑' : '↓'}{Math.abs(p.rankChange)}
                        </span>
                      )}
                    </div>
                    {/* Creator */}
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <span className="text-lg flex-shrink-0">{p.avatar}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-gray-200 font-medium truncate">{p.name}</span>
                          {p.verified && <span className="text-blue-400 text-[10px] flex-shrink-0">✓</span>}
                          {isMe && <span className="text-[#D4A853] text-[10px] flex-shrink-0">(你)</span>}
                        </div>
                        <LevelBadge level={p.level} size="sm" />
                      </div>
                    </div>
                    {/* Return */}
                    <div className="col-span-2 flex items-center justify-end">
                      <span className={`text-sm font-medium font-mono ${dimension === 'totalReturn' || dimension === 'return30d' ? (typeof val === 'number' && val >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-300'}`}>
                        {dimension === 'subscribers' ? val.toLocaleString() :
                         dimension === 'sharpe' ? (val as number).toFixed(2) :
                         `${(val as number) >= 0 ? '+' : ''}${(val as number).toFixed(1)}%`}
                      </span>
                    </div>
                    {/* Sharpe */}
                    <div className="col-span-1 flex items-center justify-end">
                      <span className="text-sm text-gray-400 font-mono">{p.sharpe.toFixed(1)}</span>
                    </div>
                    {/* Subscribers */}
                    <div className="col-span-2 flex items-center justify-end">
                      <span className="text-sm text-gray-300 font-mono">{p.subscribers.toLocaleString()}</span>
                    </div>
                    {/* Revenue */}
                    <div className="col-span-2 flex items-center justify-end">
                      <span className="text-sm text-[#D4A853] font-mono font-medium">${p.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Levels View ───────────────────────────────────────────────── */}
        {tab === 'levels' && (
          <div className="p-5 space-y-6">
            {/* Level progression overview */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {LEVELS.map((lvl, i) => {
                const isMax = i === LEVELS.length - 1;
                return (
                  <div key={lvl.key}
                       className={`rounded-xl p-4 text-center border transition-all ${currentProfile?.level === lvl.key ? 'border-[#C9A046]/40 bg-[#C9A046]/5' : 'border-white/5 bg-[#111119]'}`}>
                    <div className="text-3xl mb-1">{lvl.icon}</div>
                    <div className="text-sm font-semibold" style={{ color: lvl.color }}>{lvl.label}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">
                      {isMax ? `≥${lvl.xpMin.toLocaleString()} XP` : `${lvl.xpMin.toLocaleString()}+ XP`}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">{lvl.split} 分成</div>
                  </div>
                );
              })}
            </div>

            {/* Perks Table */}
            <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 text-gray-300 font-semibold text-sm">
                💰 等级权益明细
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.02] text-gray-500">
                    <th className="text-left px-5 py-2 font-medium">等级</th>
                    <th className="text-left px-5 py-2 font-medium">所需XP</th>
                    <th className="text-left px-5 py-2 font-medium">收益分成 (你:平台)</th>
                    <th className="text-left px-5 py-2 font-medium">每日发布上限</th>
                    <th className="text-left px-5 py-2 font-medium">回测权限</th>
                    <th className="text-left px-5 py-2 font-medium">认证标识</th>
                    <th className="text-left px-5 py-2 font-medium">优先推荐</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {LEVELS.map((lvl) => (
                    <tr key={lvl.key}
                        className={`${currentProfile?.level === lvl.key ? 'bg-[#C9A046]/5' : 'hover:bg-white/[0.02]'}`}>
                      <td className="px-5 py-3">
                        <span className="font-medium" style={{ color: lvl.color }}>{lvl.icon} {lvl.label}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 font-mono">{lvl.xpMin.toLocaleString()}</td>
                      <td className="px-5 py-3 text-[#D4A853] font-medium">{lvl.split}</td>
                      <td className="px-5 py-3 text-gray-400">{lvl.key === 'bronze' ? 1 : lvl.key === 'silver' ? 3 : lvl.key === 'gold' ? 5 : lvl.key === 'platinum' ? 10 : lvl.key === 'diamond' ? 20 : '无限'}</td>
                      <td className="px-5 py-3 text-gray-400">
                        {lvl.key === 'bronze' ? '基础' : lvl.key === 'silver' ? '标准' : '高级'}
                      </td>
                      <td className="px-5 py-3">
                        {['bronze', 'silver'].includes(lvl.key) ? (
                          <span className="text-gray-600">—</span>
                        ) : (
                          <span className="text-blue-400">✓</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {lvl.key === 'king' ? (
                          <span className="text-[#D4A853]">✓ 首页推荐</span>
                        ) : ['platinum', 'diamond'].includes(lvl.key) ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* XP earning rules */}
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
              <h3 className="text-gray-300 font-semibold text-sm mb-3">📈 经验值获得规则</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                  <span className="text-gray-400">🤖 AI分析完成</span>
                  <span className="text-[#D4A853] font-mono">+10 XP/次</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                  <span className="text-gray-400">👥 新订阅者</span>
                  <span className="text-[#D4A853] font-mono">+50 XP/人</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                  <span className="text-gray-400">📊 策略模板售出</span>
                  <span className="text-[#D4A853] font-mono">+30 XP/次</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                  <span className="text-gray-400">🎯 7日胜率 &gt;60%</span>
                  <span className="text-[#D4A853] font-mono">+100 XP/周</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                  <span className="text-gray-400">📉 连续亏损3天</span>
                  <span className="text-red-400 font-mono">-20 XP/天</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                  <span className="text-gray-400">⚠️ 被举报核实</span>
                  <span className="text-red-400 font-mono">-200 XP/次</span>
                </div>
              </div>
            </div>

            {/* Current Level Card (if user) */}
            {currentProfile && (
              <div className="bg-gradient-to-r from-[#111119] to-[#1A1520] border border-[#C9A046]/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{currentProfile.avatar}</span>
                    <div>
                      <div className="text-white font-semibold text-lg">{currentProfile.name}</div>
                      <LevelBadge level={currentProfile.level} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">累计收入</div>
                    <div className="text-[#D4A853] font-bold text-xl">${currentProfile.revenue.toLocaleString()}</div>
                  </div>
                </div>
                <XPBar current={currentProfile.xp} next={currentProfile.xpToNext} level={currentProfile.level} />
                {currentProfile.promotedAt && (
                  <div className="mt-3 text-xs text-gray-500">
                    🎉 最近晋升: {currentProfile.promotedAt}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
