// @ts-nocheck
// R283 ML#5: FactorArena — 因子竞技场前端 (5h)
// Users submit factor combos, community votes, leaderboard with Elo rating
// "交易员挑战" gamified factor discovery
// 因子竞技场: 提交因子组合 → 社区投票 → Elo排名
import React, { useState, useMemo, useCallback } from 'react';
import { Trophy, Swords, TrendingUp, ThumbsUp, Eye, Zap, Star, Crown } from 'lucide-react';

interface ArenaCombo {
  id: string;
  author: string;
  avatar: string;
  factors: { name: string; emoji: string; weight: number }[];
  description: string;
  backtestReturn: number; // annualized %
  sharpe: number;
  maxDrawdown: number;
  elo: number;
  votes: number;
  ranked: number;
  submittedAt: string;
}

const DEMO_COMBOS: ArenaCombo[] = [
  {
    id: '1', author: 'TraderZhang', avatar: '🐉',
    factors: [{ name: '1月动量', emoji: '⚡', weight: 40 }, { name: 'ROE', emoji: '⭐', weight: 35 }, { name: '北向资金', emoji: '💵', weight: 25 }],
    description: '动量+质量+资金流三因子组合，A股2024实测+31%',
    backtestReturn: 31.2, sharpe: 1.42, maxDrawdown: -18.5, elo: 1742, votes: 128, ranked: 1,
    submittedAt: '2026-06-15',
  },
  {
    id: '2', author: 'ValueHunter', avatar: '🦉',
    factors: [{ name: 'PE', emoji: '💰', weight: 50 }, { name: '股息率', emoji: '💎', weight: 30 }, { name: 'F-Score', emoji: '⭐', weight: 20 }],
    description: '经典价值组合——低估+高分红+财务健康，熊市防御',
    backtestReturn: 22.8, sharpe: 1.15, maxDrawdown: -12.3, elo: 1680, votes: 95, ranked: 2,
    submittedAt: '2026-06-14',
  },
  {
    id: '3', author: 'OptionGuru', avatar: '🎩',
    factors: [{ name: 'IV Rank', emoji: '🎯', weight: 35 }, { name: 'PCR', emoji: '📉', weight: 35 }, { name: 'Skew', emoji: '📐', weight: 30 }],
    description: '全期权因子组合——用衍生品信号选股，适合高波动市场',
    backtestReturn: 18.5, sharpe: 0.98, maxDrawdown: -22.1, elo: 1620, votes: 67, ranked: 3,
    submittedAt: '2026-06-16',
  },
  {
    id: '4', author: 'ESG_Believer', avatar: '🌍',
    factors: [{ name: 'MSCI ESG', emoji: '🌿', weight: 30 }, { name: '碳强度', emoji: '♻️', weight: 25 }, { name: '绿色收入', emoji: '💚', weight: 25 }, { name: 'ROE', emoji: '⭐', weight: 20 }],
    description: 'ESG+质量组合——可持续投资不牺牲收益',
    backtestReturn: 15.4, sharpe: 0.85, maxDrawdown: -16.8, elo: 1560, votes: 42, ranked: 4,
    submittedAt: '2026-06-17',
  },
  {
    id: '5', author: 'WhaleWatcher', avatar: '🐋',
    factors: [{ name: '机构流', emoji: '🏦', weight: 40 }, { name: '北向资金', emoji: '💵', weight: 35 }, { name: '主力资金', emoji: '🔥', weight: 25 }],
    description: '纯资金流——跟着聪明钱走，不做基本面判断',
    backtestReturn: 28.7, sharpe: 1.28, maxDrawdown: -19.2, elo: 1705, votes: 103, ranked: 2,
    submittedAt: '2026-06-13',
  },
];

interface Props { dark?: boolean; combos?: ArenaCombo[]; onVote?: (id: string) => void; onSubmit?: (combo: Omit<ArenaCombo, 'id' | 'votes' | 'elo' | 'ranked'>) => void; }

export default function FactorArena({ dark = true, combos: initialCombos = DEMO_COMBOS, onVote, onSubmit }: Props) {
  const [combos, setCombos] = useState<ArenaCombo[]>(initialCombos);
  const [sortBy, setSortBy] = useState<'elo' | 'return' | 'sharpe' | 'votes'>('elo');
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

  const c = dark ? {
    bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  const sorted = useMemo(() => {
    const arr = [...combos];
    if (sortBy === 'elo') arr.sort((a, b) => b.elo - a.elo);
    else if (sortBy === 'return') arr.sort((a, b) => b.backtestReturn - a.backtestReturn);
    else if (sortBy === 'sharpe') arr.sort((a, b) => b.sharpe - a.sharpe);
    else arr.sort((a, b) => b.votes - a.votes);
    return arr;
  }, [combos, sortBy]);

  const handleVote = useCallback((id: string) => {
    if (votedIds.has(id)) return;
    setCombos(prev => prev.map(c => c.id === id ? { ...c, votes: c.votes + 1, elo: c.elo + 8 } : c));
    setVotedIds(prev => new Set(prev).add(id));
    onVote?.(id);
  }, [votedIds, onVote]);

  return <div style={{ padding: 14, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '0 auto', borderRadius: 14 }}>
    {/* ── Header ── */}
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Swords size={22} style={{ color: c.wa }}/> 因子竞技场
      </div>
      <div style={{ fontSize: 12, color: c.t2, marginTop: 4 }}>
        {combos.length} 个组合参赛 · 社区投票决定排名
      </div>
    </div>

    {/* ── Sort ── */}
    <div style={{ display: 'flex', gap: 4, marginBottom: 14, justifyContent: 'center' }}>
      {[
        { v: 'elo' as const, l: '🏆 Elo' },
        { v: 'return' as const, l: '📈 收益' },
        { v: 'sharpe' as const, l: '⚖️ 夏普' },
        { v: 'votes' as const, l: '👍 票数' },
      ].map(s => <button key={s.v} onClick={() => setSortBy(s.v)} style={{
        padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: sortBy === s.v ? 600 : 400,
        cursor: 'pointer', border: 'none', background: sortBy === s.v ? c.a : c.sh, color: sortBy === s.v ? '#fff' : c.t2,
      }}>{s.l}</button>)}
    </div>

    {/* ── Leaderboard ── */}
    {sorted.map((combo, i) => (
      <div key={combo.id} style={{
        padding: 14, borderRadius: 12, marginBottom: 10,
        background: i === 0 ? `${c.wa}12` : c.s, border: `1px solid ${i === 0 ? c.wa + '30' : c.b}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          {/* Rank */}
          <div style={{
            width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: i === 0 ? c.wa : i === 1 ? c.t2 : i === 2 ? c.wa + '80' : c.sh,
            color: i < 3 ? '#fff' : c.t2, fontSize: 14, fontWeight: 700, flexShrink: 0,
          }}>
            {i === 0 ? <Crown size={16}/> : `#${i + 1}`}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18 }}>{combo.avatar}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.t }}>{combo.author}</span>
              <span style={{ fontSize: 10, color: c.wa, fontWeight: 600 }}>Elo: {combo.elo}</span>
            </div>
            <div style={{ fontSize: 12, color: c.t2, marginTop: 2 }}>
              {combo.factors.map(f => `${f.emoji} ${f.name} ${f.weight}%`).join(' · ')}
            </div>
            <div style={{ fontSize: 11, color: c.t, marginTop: 4 }}>"{combo.description}"</div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
          {[
            { l: '年化', v: `+${combo.backtestReturn}%`, cl: c.ok },
            { l: '夏普', v: combo.sharpe.toFixed(2), cl: combo.sharpe > 1 ? c.ok : c.wa },
            { l: '最大回撤', v: `${combo.maxDrawdown}%`, cl: combo.maxDrawdown > -15 ? c.er : c.ok },
            { l: '票数', v: combo.votes.toString(), cl: c.a },
          ].map(s => <div key={s.l} style={{ textAlign: 'center', fontSize: 10, color: c.t2 }}>
            <div>{s.l}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: s.cl }}>{s.v}</div>
          </div>)}
        </div>

        {/* Vote Button */}
        <button
          onClick={() => handleVote(combo.id)}
          disabled={votedIds.has(combo.id)}
          style={{
            width: '100%', padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: votedIds.has(combo.id) ? 'default' : 'pointer',
            border: 'none', background: votedIds.has(combo.id) ? c.sh : c.a,
            color: votedIds.has(combo.id) ? c.t2 : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <ThumbsUp size={13}/>
          {votedIds.has(combo.id) ? '已投票 ✓' : '为这个组合投票'}
        </button>
      </div>
    ))}

    {/* ── Submit CTA ── */}
    <div style={{ textAlign: 'center', marginTop: 14, padding: 14, borderRadius: 12, background: c.a + '08', border: `1px solid ${c.a}20` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: c.t, marginBottom: 4 }}>🏟️ 提交你的因子组合</div>
      <div style={{ fontSize: 11, color: c.t2, marginBottom: 8 }}>上传2-5个因子+权重，社区投票，Elo排名</div>
      <button style={{
        padding: '10px 24px', borderRadius: 10, background: c.a, color: '#fff',
        border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Trophy size={14}/> 参赛
      </button>
    </div>
    <div style={{ textAlign: 'center', fontSize: 10, color: c.t2, marginTop: 8 }}>
      ⚡ Elo算法确保排名公正——胜利加分，失败扣分。刷票会被发现。
    </div>
  </div>;
}
